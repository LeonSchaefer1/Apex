// Bankabgleich: ordnet Kontoumsätze offenen Rechnungen zu – regelbasiert, nachvollziehbar, mit Sicherheitswert.
import { useData } from "@/store/data";
import { fmtDate, fmtEUR, round2 } from "@/core/dates";
import type { Akte, Kontakt, Rechnung, Transaktion } from "@/core/types";
import { erfasseZahlung, type ZahlungsErgebnis } from "./aktionen";
import { istOffen, offenerBetrag } from "./lib";

/** Ab dieser Sicherheit bucht AnwaltApex selbstständig. */
export const AUTO_SCHWELLE = 0.9;

export type Regel = "nummer" | "aktenzeichen" | "name-datum" | "name" | "az-betrag" | "betrag" | "kosten" | "keine";

export interface Treffer {
  transaktionId: string;
  art: "rechnung" | "kosten" | "keine";
  regel: Regel;
  sicherheit: number; // 0..1
  grund: string;
  rechnungId?: string;
  akteId?: string;
  kategorie?: string;
  teilzahlung?: boolean;
  /** Betrag über dem offenen Rest – wird nicht automatisch gebucht, sondern als Guthaben vorgeschlagen. */
  ueberzahlung?: number;
}

/** Regeln in der Reihenfolge ihrer Sicherheit – auch für die Erklärkarte. */
export const REGELN: { regel: Regel; titel: string; text: string; sicherheit: number | null; folge: "auto" | "vorschlag" | "kosten" }[] = [
  { regel: "nummer", titel: "Rechnungsnummer im Verwendungszweck", text: "z. B. „RE-2026-0022“ – eindeutig. Übersteigt der Betrag den offenen Rest, entscheiden Sie.", sicherheit: 0.99, folge: "auto" },
  { regel: "aktenzeichen", titel: "Aktenzeichen und offener Betrag", text: "Aktenzeichen erkannt, Betrag entspricht genau dem offenen Rest.", sicherheit: 0.95, folge: "auto" },
  {
    regel: "name-datum",
    titel: "Zahler, Betrag und Rechnungsdatum",
    text: "Name des Rechnungsempfängers, exakter Betrag und das Rechnungsdatum im Verwendungszweck.",
    sicherheit: 0.93,
    folge: "auto",
  },
  { regel: "name", titel: "Zahlername und exakter Betrag", text: "Der Zahler heißt wie der Empfänger, der Betrag stimmt auf den Cent.", sicherheit: 0.88, folge: "vorschlag" },
  { regel: "az-betrag", titel: "Aktenzeichen, abweichender Betrag", text: "Vermutlich eine Teilzahlung – Sie entscheiden.", sicherheit: 0.72, folge: "vorschlag" },
  { regel: "betrag", titel: "Nur der Betrag stimmt", text: "Kein weiterer Hinweis – reiner Vorschlag.", sicherheit: 0.6, folge: "vorschlag" },
  { regel: "kosten", titel: "Ausgänge wie Miete oder Telefon", text: "Werden als Kanzleikosten erfasst – keiner Rechnung zugeordnet.", sicherheit: null, folge: "kosten" },
];

const norm = (s: string) => s.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function kostenKategorie(t: Transaktion): string {
  const s = norm(`${t.gegenpartei} ${t.verwendungszweck}`);
  if (/miete|kanzleiräume|vermiet/.test(s)) return "Miete";
  if (/telekom|telefon|mobilfunk|internet|kundennr/.test(s)) return "Telekommunikation";
  if (/strom|energie|gas|wasser/.test(s)) return "Energie";
  if (/versicherung|haftpflicht/.test(s)) return "Versicherung";
  if (/kammer|beitrag/.test(s)) return "Kammerbeitrag";
  if (/software|lizenz|it-/.test(s)) return "IT & Software";
  return "Sonstige Kanzleikosten";
}

function namensTeile(k: Kontakt | undefined): string[] {
  if (!k) return [];
  if (k.typ === "person") return [k.nachname, k.name].filter((x): x is string => !!x && x.length >= 3).map(norm);
  const basis = (k.firma ?? k.name).replace(/\b(gmbh|ag|kg|co\.|ohg|gbr|e\.v\.|mbh|&)\b/gi, " ");
  const erstesWort = basis.split(/\s+/).find((w) => w.length >= 4);
  return [k.name, erstesWort].filter((x): x is string => !!x).map(norm);
}

/**
 * Bewertet alle offenen Umsätze gegen alle offenen Rechnungen und vergibt jede Rechnung höchstens einmal –
 * die sichersten Paare zuerst, damit ein bloßer Betragstreffer keine eindeutig referenzierte Rechnung „wegnimmt“.
 */
export function gleicheAb(input: { transaktionen: Transaktion[]; rechnungen: Rechnung[]; akten: Akte[]; kontakte: Kontakt[] }): Treffer[] {
  const aktenById = new Map(input.akten.map((a) => [a.id, a]));
  const kontakteById = new Map(input.kontakte.map((k) => [k.id, k]));
  const offen = input.rechnungen.filter(istOffen);
  const kandidaten: (Treffer & { reihenfolge: number })[] = [];

  input.transaktionen.forEach((t, idx) => {
    if (t.betrag <= 0) return;
    const vz = norm(t.verwendungszweck);
    const gp = norm(t.gegenpartei);
    for (const r of offen) {
      const akte = aktenById.get(r.akteId);
      const rest = offenerBetrag(r);
      const exakt = Math.abs(rest - t.betrag) < 0.005;
      const az = akte ? new RegExp(`(^|[^\\d])${escapeRe(akte.aktenzeichen)}($|[^\\d])`).test(vz) : false;
      const name = namensTeile(kontakteById.get(r.empfaengerId)).some((n) => gp.includes(n) || vz.includes(n));
      const datum = vz.includes(fmtDate(r.datum));
      let best: Omit<Treffer, "transaktionId" | "art"> | null = null;
      if (vz.includes(norm(r.nummer))) {
        const ueber = round2(t.betrag - rest);
        best =
          ueber > 0.004
            ? { regel: "nummer", sicherheit: 0.85, grund: `Rechnungsnummer ${r.nummer} im Verwendungszweck – Betrag übersteigt den offenen Rest um ${fmtEUR(ueber)}`, ueberzahlung: ueber }
            : { regel: "nummer", sicherheit: 0.99, grund: `Rechnungsnummer ${r.nummer} im Verwendungszweck`, teilzahlung: t.betrag < rest - 0.005 };
      } else if (az && exakt) {
        best = { regel: "aktenzeichen", sicherheit: 0.95, grund: `Aktenzeichen ${akte?.aktenzeichen} und offener Betrag stimmen überein` };
      } else if (name && exakt && datum) {
        best = { regel: "name-datum", sicherheit: 0.93, grund: `Zahler, Betrag und Rechnungsdatum ${fmtDate(r.datum)} stimmen überein` };
      } else if (name && exakt) {
        best = { regel: "name", sicherheit: 0.88, grund: "Zahlername und exakter offener Betrag stimmen überein" };
      } else if (az && t.betrag < rest) {
        best = { regel: "az-betrag", sicherheit: 0.72, grund: `Aktenzeichen ${akte?.aktenzeichen} erkannt – Betrag geringer als offen (Teilzahlung?)`, teilzahlung: true };
      } else if (exakt) {
        best = { regel: "betrag", sicherheit: 0.6, grund: "Nur der Betrag stimmt mit dem offenen Rest überein" };
      }
      if (best) kandidaten.push({ ...best, transaktionId: t.id, art: "rechnung", rechnungId: r.id, akteId: r.akteId, reihenfolge: idx });
    }
  });

  kandidaten.sort((a, b) => b.sicherheit - a.sicherheit || a.reihenfolge - b.reihenfolge);
  const vergeben = new Map<string, Treffer>();
  const benutzt = new Set<string>();
  for (const k of kandidaten) {
    if (vergeben.has(k.transaktionId) || benutzt.has(k.rechnungId!)) continue;
    const { reihenfolge: _r, ...treffer } = k;
    void _r;
    vergeben.set(k.transaktionId, treffer);
    benutzt.add(k.rechnungId!);
  }

  return input.transaktionen.map((t): Treffer => {
    if (t.betrag < 0) {
      const kategorie = kostenKategorie(t);
      return { transaktionId: t.id, art: "kosten", regel: "kosten", sicherheit: 0.97, kategorie, grund: `Kanzleikosten (keine Rechnung): ${kategorie}` };
    }
    return vergeben.get(t.id) ?? { transaktionId: t.id, art: "keine", regel: "keine", sicherheit: 0, grund: "Keine passende offene Rechnung gefunden" };
  });
}

export const istAuto = (t: Treffer) => t.art === "kosten" || (t.art === "rechnung" && t.sicherheit >= AUTO_SCHWELLE);

/**
 * Bucht einen Treffer: Rechnung (teil-)bezahlt, Zahlung im Aktenkonto, Umsatz als zugeordnet markiert. Ein Mehrbetrag
 * über dem offenen Rest wird als Guthaben der Mandantschaft gebucht (der Umsatz ist ja tatsächlich eingegangen).
 */
export function bucheTreffer(t: Transaktion, tr: Treffer, durch: "auto" | "manuell"): ZahlungsErgebnis | undefined {
  const st = useData.getState();
  if (tr.art === "kosten") {
    st.patch("transaktionen", t.id, { status: "ignoriert", zuordnung: { sicherheit: tr.sicherheit, durch, grund: tr.grund } });
    return;
  }
  if (tr.art !== "rechnung" || !tr.rechnungId) return;
  const r = st.data.rechnungen.find((x) => x.id === tr.rechnungId);
  if (!r) return;
  const erg = erfasseZahlung(r, round2(t.betrag), t.datum, { transaktionId: t.id, text: `Zahlungseingang ${r.nummer} (${t.gegenpartei})`, ueberzahlung: "guthaben" });
  const grund = erg.guthaben > 0 ? `${tr.grund} · ${fmtEUR(erg.guthaben)} Überzahlung als Guthaben gebucht` : tr.grund;
  st.patch("transaktionen", t.id, { status: "zugeordnet", zuordnung: { rechnungId: r.id, akteId: r.akteId, sicherheit: tr.sicherheit, durch, grund } });
  return erg;
}

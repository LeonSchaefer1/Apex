// Bankabgleich: ordnet Kontoumsätze offenen Rechnungen zu – regelbasiert, nachvollziehbar, mit Sicherheitswert.
import { useData } from "@/store/data";
import { fmtDate, fmtEUR, nowLocal, round2, today, uid } from "@/core/dates";
import type { Akte, Aktivitaet, Kontakt, Rechnung, Transaktion } from "@/core/types";
import { erfasseZahlung, nimmZahlungZurueck, type ZahlungsErgebnis } from "./aktionen";
import { istOffen, offenerBetrag } from "./lib";
import { escapeRe, fremdgeldTreffer, namensTeile, norm } from "@/core/abrechnung";
// Fremdgeld-Regel (§ 43a Abs. 7 BRAO) liegt in src/core/abrechnung.ts (mit Tests).
export { fremdgeldTreffer };

/** Ab dieser Sicherheit bucht AnwaltApex selbstständig. */
export const AUTO_SCHWELLE = 0.9;

export type Regel = "nummer" | "aktenzeichen" | "name-datum" | "name" | "az-betrag" | "betrag" | "fremdgeld" | "kosten" | "keine";

export interface Treffer {
  transaktionId: string;
  art: "rechnung" | "fremdgeld" | "kosten" | "keine";
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
  {
    regel: "fremdgeld",
    titel: "Zahlung eines Dritten für die Mandantschaft",
    text: "Ein Dritter (z. B. ein Versicherer) zahlt auf eine Akte, Aktenzeichen oder Schadennummer im Verwendungszweck – Fremdgeld. Wird nie automatisch weitergeleitet.",
    sicherheit: 0.85,
    folge: "vorschlag",
  },
  { regel: "kosten", titel: "Ausgänge wie Miete oder Telefon", text: "Werden als Kanzleikosten erfasst – keiner Rechnung zugeordnet.", sicherheit: null, folge: "kosten" },
];


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
      // Abgelehnte Vorschläge werden nie erneut angeboten (und nie automatisch gebucht)
      if (t.abgelehnt?.some((a) => a.rechnungId === r.id)) continue;
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
    const rechnung = vergeben.get(t.id);
    // Fremdgeld geht schwachen Rechnungstreffern (Teilzahlung, nur Betrag) vor – eine Rechnungsnummer oder ein exakter Treffer bleibt Honorar
    const fremdRoh = !rechnung || (rechnung.sicherheit < AUTO_SCHWELLE && rechnung.regel !== "nummer") ? fremdgeldTreffer(t, input.akten, kontakteById) : undefined;
    const fremd = fremdRoh && !t.abgelehnt?.some((a) => !a.rechnungId && a.akteId === fremdRoh.akteId) ? fremdRoh : undefined;
    return fremd ?? rechnung ?? { transaktionId: t.id, art: "keine", regel: "keine", sicherheit: 0, grund: t.abgelehnt?.length ? "Vorschlag abgelehnt – keine weitere passende Rechnung" : "Keine passende offene Rechnung gefunden" };
  });
}

export const istAuto = (t: Treffer) => t.art === "kosten" || (t.art === "rechnung" && t.sicherheit >= AUTO_SCHWELLE);

/** Gespeicherter Vorschlag am Umsatz → Treffer (übersteht Reiterwechsel und Neuladen). */
export function trefferAusVorschlag(t: Transaktion): Treffer | undefined {
  const v = t.vorschlag;
  if (!v || t.status !== "offen") return undefined;
  if (v.rechnungId) return { transaktionId: t.id, art: "rechnung", regel: "keine", sicherheit: v.sicherheit, grund: v.grund, rechnungId: v.rechnungId, akteId: v.akteId };
  if (v.akteId) return { transaktionId: t.id, art: "fremdgeld", regel: "fremdgeld", sicherheit: v.sicherheit, grund: v.grund, akteId: v.akteId };
  return undefined;
}

/** Vorschlag am Umsatz speichern – er steht bis zur Entscheidung (bestätigen, ablehnen, anders zuordnen). */
export function speichereVorschlag(t: Transaktion, tr: Treffer): void {
  useData.getState().patch("transaktionen", t.id, { vorschlag: { rechnungId: tr.rechnungId, akteId: tr.akteId, sicherheit: tr.sicherheit, grund: tr.grund, am: nowLocal() } }, { system: true });
}

/** Vorschlag ablehnen: wird am Umsatz vermerkt und in keinem weiteren Lauf erneut angeboten. Protokolliert. */
export function lehneVorschlagAb(t: Transaktion, tr: Pick<Treffer, "rechnungId" | "akteId">, userId?: string): void {
  const st = useData.getState();
  const aktuell = st.data.transaktionen.find((x) => x.id === t.id) ?? t;
  st.patch("transaktionen", t.id, { vorschlag: undefined, abgelehnt: [...(aktuell.abgelehnt ?? []), { rechnungId: tr.rechnungId, akteId: tr.akteId, am: nowLocal(), von: userId }] });
  const r = tr.rechnungId ? st.data.rechnungen.find((x) => x.id === tr.rechnungId) : undefined;
  const a = tr.akteId ? st.data.akten.find((x) => x.id === tr.akteId) : undefined;
  st.log({ akteur: "nutzer", userId, akteId: tr.akteId, text: `Vorschlag abgelehnt: ${umsatzKennung(t)} gehört nicht zu ${r ? r.nummer : `Fremdgeld ${a?.aktenzeichen ?? ""}`.trim()} – wird nicht erneut vorgeschlagen` });
}

/** „Umsatz vom 14.10.2026 · 1.234,56 € · ZAHLER“ – Kennung des Umsatzes im Protokoll (wer und wann zugeordnet). */
export const umsatzKennung = (t: Pick<Transaktion, "datum" | "betrag" | "gegenpartei">) => `Umsatz vom ${fmtDate(t.datum)} · ${fmtEUR(t.betrag)} · ${t.gegenpartei}`;

/** Protokolleintrag zur Zuordnung eines Umsatzes – Grundlage für „wer und wann“ im Reiter „Gebucht“. */
export function zuordnungsProtokoll(aktivitaeten: Aktivitaet[], t: Transaktion): Aktivitaet | undefined {
  const k = umsatzKennung(t);
  return aktivitaeten.filter((a) => a.text.includes(k) && /zugeordnet|gebucht|erfasst/.test(a.text) && !a.text.includes("gelöst")).sort((a, b) => b.zeit.localeCompare(a.zeit))[0];
}

/**
 * Bucht einen Treffer: Rechnung (teil-)bezahlt, Zahlung im Aktenkonto, Umsatz als zugeordnet markiert. Ein Mehrbetrag
 * über dem offenen Rest wird als Guthaben der Mandantschaft gebucht (der Umsatz ist ja tatsächlich eingegangen).
 */
export function bucheTreffer(t: Transaktion, tr: Treffer, durch: "auto" | "manuell", userId?: string): ZahlungsErgebnis | undefined {
  const st = useData.getState();
  const wie = durch === "auto" ? "automatisch" : "manuell";
  if (tr.art === "kosten") {
    st.patch("transaktionen", t.id, { status: "ignoriert", vorschlag: undefined, zuordnung: { sicherheit: tr.sicherheit, durch, grund: tr.grund, am: nowLocal(), von: durch === "manuell" ? userId : undefined } });
    st.log({ akteur: durch === "auto" ? "automation" : "nutzer", automationKey: durch === "auto" ? "bankabgleich" : undefined, userId: durch === "manuell" ? userId : undefined, text: `${umsatzKennung(t)} als Kanzleikosten erfasst (${tr.kategorie ?? "ohne Rechnung"}, ${wie})` });
    return;
  }
  if (tr.art === "fremdgeld" && tr.akteId) {
    // Eingang auf dem Anderkonto buchen – nie automatisch weiterleiten; Frist „Fremdgeld weiterleiten“ für heute
    const akte = st.data.akten.find((a) => a.id === tr.akteId);
    const mandant = akte ? st.data.kontakte.find((k) => k.id === akte.mandantId) : undefined;
    st.upsert("buchungen", { id: uid("b"), akteId: tr.akteId, datum: t.datum, art: "fremdgeld", betrag: round2(t.betrag), text: `Zahlung ${t.gegenpartei} (Fremdgeld) – an ${mandant?.name ?? "die Mandantschaft"} weiterzuleiten`, fremdgeld: true, transaktionId: t.id });
    if (akte)
      st.upsert("fristen", {
        id: uid("f"), akteId: akte.id, titel: `Fremdgeld weiterleiten (${fmtEUR(t.betrag)})`, typ: "wiedervorlage", datum: today(), status: "offen",
        verantwortlichId: akte.sachbearbeiterId ?? akte.bearbeiterId, quelle: "automatisch", createdAt: nowLocal(), notiz: "Fremdgeld unverzüglich weiterleiten (§ 43a Abs. 7 BRAO, § 4 BORA).",
      });
    st.patch("transaktionen", t.id, { status: "zugeordnet", vorschlag: undefined, zuordnung: { akteId: tr.akteId, sicherheit: tr.sicherheit, durch, grund: tr.grund, am: nowLocal(), von: userId } });
    st.log({ akteur: "nutzer", userId, akteId: tr.akteId, text: `${umsatzKennung(t)} als Fremdgeld gebucht (${wie}) – weiterleiten im Fremdgeld-Wächter${akte ? ` – ${akte.aktenzeichen}` : ""}` });
    return;
  }
  if (tr.art !== "rechnung" || !tr.rechnungId) return;
  const r = st.data.rechnungen.find((x) => x.id === tr.rechnungId);
  if (!r) return;
  const erg = erfasseZahlung(r, round2(t.betrag), t.datum, { transaktionId: t.id, text: `Zahlungseingang ${r.nummer} (${t.gegenpartei})`, ueberzahlung: "guthaben" });
  const grund = erg.guthaben > 0 ? `${tr.grund} · ${fmtEUR(erg.guthaben)} Überzahlung als Guthaben gebucht` : tr.grund;
  st.patch("transaktionen", t.id, { status: "zugeordnet", vorschlag: undefined, zuordnung: { rechnungId: r.id, akteId: r.akteId, sicherheit: tr.sicherheit, durch, grund, am: nowLocal(), von: durch === "manuell" ? userId : undefined } });
  // Menschliche Entscheidung ohne Prozentangabe – bei bestätigtem Vorschlag dessen Sicherheit als Hinweis
  st.log({
    akteur: durch === "auto" ? "automation" : "nutzer",
    automationKey: durch === "auto" ? "bankabgleich" : undefined,
    userId: durch === "manuell" ? userId : undefined,
    akteId: r.akteId,
    text: `${umsatzKennung(t)} ${r.nummer} zugeordnet (${durch === "auto" ? `automatisch, ${Math.round(tr.sicherheit * 100)} %` : tr.sicherheit < 1 ? `manuell bestätigt, Vorschlag war ${Math.round(tr.sicherheit * 100)} %` : "manuell"})`,
  });
  return erg;
}

/**
 * „Zuordnung lösen“: Der Umsatz ist wieder offen. Zahlung auf eine Rechnung → Gegenbuchung und Rechnungsstatus zurück;
 * Fremdgeld → Stornobuchung des Eingangs; Kanzleikosten → nur wieder offen. Immer mit Protokolleintrag.
 */
export function loeseZuordnung(t: Transaktion, userId?: string): string {
  const st = useData.getState();
  const z = t.zuordnung;
  if (z?.rechnungId) {
    const r = st.data.rechnungen.find((x) => x.id === z.rechnungId);
    if (r) {
      const erg = nimmZahlungZurueck(r, { userId, transaktionId: t.id, grund: "Zuordnung im Bankabgleich gelöst" });
      if (erg.buchungen) return `${fmtEUR(erg.betrag)} auf ${r.nummer} gegengebucht – Rechnung wieder offen`;
    }
  }
  const fremd = st.data.buchungen.filter((b) => b.transaktionId === t.id && b.art === "fremdgeld" && b.betrag > 0 && !b.text.startsWith("Storno: "));
  for (const b of fremd) {
    if (st.data.buchungen.some((x) => x.text === `Storno: ${b.text}` && x.transaktionId === t.id)) continue;
    st.upsert("buchungen", { id: uid("b"), akteId: b.akteId, datum: today(), art: "fremdgeld", betrag: -b.betrag, text: `Storno: ${b.text}`, fremdgeld: true, transaktionId: t.id });
  }
  st.patch("transaktionen", t.id, { status: "offen", zuordnung: undefined });
  st.log({ akteur: "nutzer", userId, akteId: z?.akteId, text: `Zuordnung gelöst: ${umsatzKennung(t)} wieder offen${fremd.length ? " – Fremdgeld-Eingang storniert" : t.status === "ignoriert" ? " (war Kanzleikosten)" : ""}` });
  return fremd.length ? "Fremdgeld-Eingang storniert" : "Umsatz wieder offen";
}

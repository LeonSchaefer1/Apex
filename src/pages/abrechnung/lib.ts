// Fachliche Hilfen der Abrechnung: offene Posten, Rechnungsnummern, Abrechnungsvorschläge je Akte.
import { addDays, fromISO, round2, today } from "@/core/dates";
import { berechneRvg, fassungFuerAuftrag, UST_SATZ, type RvgFassung, type RvgZeile } from "@/core/rvg";
import type { Akte, AktenPhase, Rechnung, RechnungsPosition, User, Zeiteintrag } from "@/core/types";

export type TabKey = "uebersicht" | "rechnungen" | "rvg" | "bank" | "forderung" | "zeit";
export const TAB_KEYS: TabKey[] = ["uebersicht", "rechnungen", "rvg", "bank", "forderung", "zeit"];

export const MINUTEN_JE_EINZELRECHNUNG = 6;
export const STANDARD_STUNDENSATZ = 250;

// ───────────── Offene Posten ─────────────
export const istOffen = (r: Rechnung) => r.status === "gestellt" || r.status === "teilbezahlt";
export const offenerBetrag = (r: Rechnung) => (istOffen(r) ? round2(r.brutto - r.bezahlt) : 0);
export const istUeberfaellig = (r: Rechnung, heute = today()) => istOffen(r) && r.faellig < heute;
/** Zählt als Umsatz: gestellte, (teil-)bezahlte Rechnungen – keine Entwürfe, keine Stornos. */
export const zaehltAlsUmsatz = (r: Rechnung) => r.status !== "entwurf" && r.status !== "storniert";

/** Nächste freie Rechnungsnummern (RE-JJJJ-NNNN) nach der höchsten vorhandenen Nummer des Jahres. */
export function naechsteNummern(rechnungen: Rechnung[], anzahl: number, jahr = today().slice(0, 4)): string[] {
  let max = 0;
  const re = new RegExp(`^RE-${jahr}-(\\d+)$`);
  for (const r of rechnungen) {
    const m = re.exec(r.nummer);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: anzahl }, (_, i) => `RE-${jahr}-${String(max + i + 1).padStart(4, "0")}`);
}

// ───────────── Formatierung ─────────────
/** Kurzform für Achsen: „0 €“, „850 €“, „2,5 Tsd. €“, „1,2 Mio. €“. */
export function fmtEURkompakt(n: number): string {
  const a = Math.abs(n);
  const f = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  if (a >= 1_000_000) return `${f(n / 1_000_000)} Mio. €`;
  if (a >= 1_000) return `${f(n / 1_000)} Tsd. €`;
  return `${Math.round(n).toLocaleString("de-DE")} €`;
}

/** Deutsche Betragseingabe („10.000,50“, „5000“, „1.000“) in eine Zahl umwandeln. */
export function parseBetrag(s: string): number {
  const clean = s.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", ".")) || 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, "")) || 0;
  return Number(clean) || 0;
}

export const fmtSatz = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
export const fmtProzent = (n: number, digits = 2) => `${n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

/** 90 → „1:30 Std.“ */
export function fmtDauer(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")} Std.`;
}

export const fmtStunden = (min: number) => (min / 60).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** ISO-Kalenderwoche (Montag als Wochenbeginn). */
export function isoWoche(iso: string): { jahr: number; kw: number; montag: string } {
  const wd = (fromISO(iso).getUTCDay() + 6) % 7;
  const montag = addDays(iso, -wd);
  const donnerstag = fromISO(addDays(montag, 3));
  const jahr = donnerstag.getUTCFullYear();
  const jan4 = new Date(Date.UTC(jahr, 0, 4));
  const kw = 1 + Math.round(((donnerstag.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { jahr, kw, montag };
}

export const FASSUNG_LABEL: Record<RvgFassung, string> = { "2025": "KostBRÄG 2025", "2021": "KostRÄG 2021" };

// ───────────── Rechenhilfen ─────────────
export interface Summen {
  netto: number;
  ust: number;
  brutto: number;
}

/** Summen aus Positionen (USt. 19 % nach Nr. 7008 VV RVG). */
export function summen(positionen: RechnungsPosition[], ust = true): Summen {
  const netto = round2(positionen.reduce((s, p) => s + p.betrag, 0));
  const u = ust ? round2(netto * UST_SATZ) : 0;
  return { netto, ust: u, brutto: round2(netto + u) };
}

export function zeileZuPosition(z: RvgZeile): RechnungsPosition {
  return { vv: z.nr, bezeichnung: z.titel, satz: z.satz, gegenstandswert: z.gegenstandswert, betrag: z.betrag };
}

export const pauschalePosition = (betrag: number): RechnungsPosition => ({ vv: "7002", bezeichnung: "Pauschale für Post- und Telekommunikation", betrag });

// ───────────── Sammelabrechnung: Vorschlag je Akte ─────────────
export const PHASE_POSITIONEN: Partial<Record<AktenPhase, string[]>> = {
  Außergerichtlich: ["2300"],
  Gerichtlich: ["3100", "3104"],
  Beweisaufnahme: ["3100", "3104"],
  Urteil: ["3100", "3104"],
  Vollstreckung: ["3309"],
};

export interface Vorschlag {
  akte: Akte;
  art: "rvg" | "stunden";
  positionen: RechnungsPosition[];
  summen: Summen;
  fassung?: RvgFassung;
  bereitsAbgerechnet: string[];
  zeitIds: string[];
  hinweis?: string;
}

export interface Ausschluss {
  akte: Akte;
  grund: string;
}

/** Stundenpositionen je Bearbeiter (Vergütungsvereinbarung nach § 3a RVG). */
export function stundenPositionen(eintraege: Zeiteintrag[], usersById: Map<string, User>, fallbackSatz: number): RechnungsPosition[] {
  const proUser = new Map<string, number>();
  for (const z of eintraege) proUser.set(z.userId, (proUser.get(z.userId) ?? 0) + z.minuten);
  return [...proUser.entries()].map(([userId, minuten]) => {
    const u = usersById.get(userId);
    const satz = u?.stundensatz ?? fallbackSatz;
    const std = round2(minuten / 60);
    return { vv: "Std", bezeichnung: `Tätigkeit ${u?.name ?? "Rechtsanwalt"} lt. Vergütungsvereinbarung (${satz.toLocaleString("de-DE")} €/Std.)`, menge: std, betrag: round2(std * satz) };
  });
}

/**
 * Ermittelt, was für eine Akte abgerechnet werden kann. Bereits berechnete Gebühren werden nicht erneut angesetzt
 * (§ 15 Abs. 2 RVG); eine früher berechnete Geschäftsgebühr wird auf die Verfahrensgebühr angerechnet (Vorbem. 3 Abs. 4 VV RVG).
 */
export function vorschlagFuerAkte(akte: Akte, rechnungenDerAkte: Rechnung[], zeitenDerAkte: Zeiteintrag[], usersById: Map<string, User>, fallbackSatz: number): Vorschlag | Ausschluss {
  const gueltig = rechnungenDerAkte.filter((r) => r.status !== "storniert");
  const abgerechnet = new Set(gueltig.flatMap((r) => r.positionen.map((p) => p.vv)));

  // Straf- und Bußgeldsachen: Betragsrahmengebühren (Teil 4/5 VV RVG) – hier nur nach Zeitaufwand abrechenbar.
  const bussgeld = /bußgeld|owi\b/i.test(akte.titel) || akte.schlagworte.includes("bußgeld");
  if (akte.sachgebiet === "Strafrecht" || bussgeld) {
    const offen = zeitenDerAkte.filter((z) => z.abrechenbar && !z.abgerechnet);
    if (!offen.length)
      return { akte, grund: bussgeld ? "Bußgeldsache: Rahmengebühren nach Teil 5 VV RVG individuell bestimmen" : "Strafsache: Rahmengebühren nach Teil 4 VV RVG individuell bestimmen" };
    const positionen = stundenPositionen(offen, usersById, fallbackSatz);
    return { akte, art: "stunden", positionen, summen: summen(positionen), bereitsAbgerechnet: [], zeitIds: offen.map((z) => z.id), hinweis: "Abrechnung nach Zeitaufwand" };
  }

  const basis = PHASE_POSITIONEN[akte.phase];
  if (!basis) return { akte, grund: akte.phase === "Mandatsaufnahme" ? "Mandatsaufnahme – noch keine abrechenbare Tätigkeit" : "Keine Gebühren für diese Phase hinterlegt" };
  if (akte.gegenstandswert <= 0) return { akte, grund: "Kein Gegenstandswert hinterlegt" };
  const neu = basis.filter((nr) => !abgerechnet.has(nr));
  if (!neu.length) return { akte, grund: "Gebühren dieser Phase bereits abgerechnet" };

  const fassung = fassungFuerAuftrag(akte.createdAt.slice(0, 10));
  const fruehere2300 = gueltig.flatMap((r) => r.positionen).find((p) => p.vv === "2300");
  const anrechnen = neu.includes("3100") && !!fruehere2300;
  const eingabe = [...(anrechnen ? [{ nr: "2300", satz: fruehere2300?.satz ?? 1.3 }] : []), ...neu.map((nr) => ({ nr }))];
  const erg = berechneRvg({ positionen: eingabe, gegenstandswert: akte.gegenstandswert, fassung, anrechnung: true });
  const zeilen = anrechnen ? erg.zeilen.filter((z) => z.nr !== "2300") : erg.zeilen;
  const gebuehren = round2(zeilen.reduce((s, z) => s + z.betrag, 0));
  const pauschale = round2(Math.min(gebuehren * 0.2, 20));
  const positionen = [...zeilen.map(zeileZuPosition), ...(pauschale > 0 ? [pauschalePosition(pauschale)] : [])];
  return {
    akte,
    art: "rvg",
    positionen,
    summen: summen(positionen),
    fassung,
    bereitsAbgerechnet: [...abgerechnet].filter((nr) => /^\d{4}$/.test(nr) && nr !== "7002"),
    zeitIds: [],
    hinweis: anrechnen ? "Geschäftsgebühr aus Vorrechnung angerechnet" : undefined,
  };
}

export const istVorschlag = (v: Vorschlag | Ausschluss): v is Vorschlag => "positionen" in v;

/** Leistungszeitraum einer Rechnung (Auftrag bis Rechnungsdatum). */
export function leistungszeitraum(akte: Akte | undefined, r: Rechnung): [string, string] {
  const von = akte?.createdAt.slice(0, 10) ?? r.datum;
  return [von < r.datum ? von : r.datum, r.datum];
}

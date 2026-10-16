// Einheitliche Zählweise für Fristen: Cockpit, Navigation, Fristenkalender und Apex Assistent
// verwenden dieselbe Definition, damit überall dieselben Zahlen stehen.
import type { Frist, ID, ISODate } from "./types";
import { addDays } from "./dates";

/**
 * Zählt als Frist: Notfristen, Fristen und Wiedervorlagen.
 * Nicht mitgezählt werden Termine (eigene Kategorie) und Vorfristen (Erinnerungen vor einer Frist).
 */
export function zaehltAlsFrist(f: Frist): boolean {
  return f.typ !== "termin" && f.typ !== "vorfrist";
}

const TYP_RANG: Record<Frist["typ"], number> = { notfrist: 0, frist: 1, wiedervorlage: 2, vorfrist: 3, termin: 4 };

export function nachDringlichkeit(a: Frist, b: Frist): number {
  return a.datum.localeCompare(b.datum) || TYP_RANG[a.typ] - TYP_RANG[b.typ] || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? "");
}

export interface FristenLage {
  /** offene Fristen bis einschließlich heute (heute fällig + überfällig) */
  faellig: Frist[];
  /** offene Fristen mit Datum heute */
  heute: Frist[];
  /** offene Fristen mit Datum vor heute */
  ueberfaellig: Frist[];
  /** offene Vorfristen bis einschließlich heute */
  vorfristen: Frist[];
  /** offene Fristen in den nächsten sieben Tagen (nach heute) */
  woche: Frist[];
  /** offene Notfristen von heute bis in sieben Tagen */
  notfristenWoche: Frist[];
}

/** Lage der offenen Fristen zum Stichtag – optional nur für eine verantwortliche Person. */
export function fristenLage(fristen: Frist[], heute: ISODate, nurFuer?: ID): FristenLage {
  const in7 = addDays(heute, 7);
  const offen = fristen.filter((f) => f.status === "offen" && (!nurFuer || f.verantwortlichId === nurFuer));
  const echte = offen.filter(zaehltAlsFrist).sort(nachDringlichkeit);
  const faellig = echte.filter((f) => f.datum <= heute);
  return {
    faellig,
    heute: faellig.filter((f) => f.datum === heute),
    ueberfaellig: faellig.filter((f) => f.datum < heute),
    vorfristen: offen.filter((f) => f.typ === "vorfrist" && f.datum <= heute).sort(nachDringlichkeit),
    woche: echte.filter((f) => f.datum > heute && f.datum <= in7),
    notfristenWoche: echte.filter((f) => f.typ === "notfrist" && f.datum >= heute && f.datum <= in7),
  };
}

// Einheitliche Zählweise für Fristen: Cockpit, Navigation, Fristenkalender, Akten und Apex Assistent
// verwenden dieselbe Definition, damit überall dieselben Zahlen stehen.
//
// „Frist“ = Notfrist oder Frist. Wiedervorlagen, Vorfristen und Termine werden getrennt genannt und nie als
// „Fristen“ gezählt („Heute sind 2 Fristen fällig, dazu 1 Wiedervorlage und 1 Vorfrist.“).
// „Kritisch“ = Notfrist oder gesetzlich nicht verlängerbare Frist (z. B. § 4 KSchG, StPO, OWiG) – rot hervorgehoben.
import type { Frist, ID, ISODate } from "./types";
import { addDays } from "./dates";
import { fristArtZu } from "./fristen";

/** Zählt als Frist: Notfristen und Fristen. Wiedervorlagen, Vorfristen und Termine sind eigene Kategorien. */
export function zaehltAlsFrist(f: Pick<Frist, "typ">): boolean {
  return f.typ === "notfrist" || f.typ === "frist";
}

/**
 * Kritische Frist: Notfrist oder gesetzlich nicht verlängerbare Frist (über die Fristregel, siehe `fristArtZu`).
 * Vorfristen tragen zwar die Regel ihrer Frist, sind aber nur Erinnerungen – nie kritisch.
 */
export function istKritisch(f: Pick<Frist, "typ" | "regelKey">): boolean {
  if (f.typ === "notfrist") return true;
  return f.typ === "frist" && !!fristArtZu(f)?.kritisch;
}

/** Rang bei gleichem Datum: kritische Fristen vor übrigen Fristen, dann Wiedervorlagen, Vorfristen, Termine. */
function rang(f: Frist): number {
  if (zaehltAlsFrist(f)) return istKritisch(f) ? 0 : 1;
  return f.typ === "wiedervorlage" ? 2 : f.typ === "vorfrist" ? 3 : 4;
}

export function nachDringlichkeit(a: Frist, b: Frist): number {
  return a.datum.localeCompare(b.datum) || rang(a) - rang(b) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? "");
}

/** Gleitendes Fenster „nächste 7 Tage“ (nicht die Kalenderwoche). */
export const FENSTER_TAGE = 7;

export interface FristenLage {
  /** offene Fristen (Notfristen und Fristen) bis einschließlich heute – heute fällig + überfällig */
  faellig: Frist[];
  /** offene Fristen mit Datum heute */
  heute: Frist[];
  /** offene Fristen mit Datum vor heute */
  ueberfaellig: Frist[];
  /** offene Wiedervorlagen bis einschließlich heute – getrennt genannt, nicht mitgezählt */
  wiedervorlagen: Frist[];
  /** offene Vorfristen bis einschließlich heute – Erinnerungen, nicht mitgezählt */
  vorfristen: Frist[];
  /** offene Fristen in den nächsten sieben Tagen (nach heute) */
  woche: Frist[];
  /** offene Wiedervorlagen in den nächsten sieben Tagen (nach heute) */
  wiedervorlagenWoche: Frist[];
  /** offene kritische Fristen (Notfrist oder nicht verlängerbar) von heute bis in sieben Tagen */
  kritischWoche: Frist[];
  /** offene Notfristen von heute bis in sieben Tagen (Teilmenge von `kritischWoche`) */
  notfristenWoche: Frist[];
}

/** Lage der offenen Fristen zum Stichtag – optional nur für eine verantwortliche Person. */
export function fristenLage(fristen: Frist[], heute: ISODate, nurFuer?: ID): FristenLage {
  const in7 = addDays(heute, FENSTER_TAGE);
  const offen = fristen.filter((f) => f.status === "offen" && (!nurFuer || f.verantwortlichId === nurFuer)).sort(nachDringlichkeit);
  const echte = offen.filter(zaehltAlsFrist);
  const wv = offen.filter((f) => f.typ === "wiedervorlage");
  const faellig = echte.filter((f) => f.datum <= heute);
  const kritischWoche = echte.filter((f) => f.datum >= heute && f.datum <= in7 && istKritisch(f));
  return {
    faellig,
    heute: faellig.filter((f) => f.datum === heute),
    ueberfaellig: faellig.filter((f) => f.datum < heute),
    wiedervorlagen: wv.filter((f) => f.datum <= heute),
    vorfristen: offen.filter((f) => f.typ === "vorfrist" && f.datum <= heute),
    woche: echte.filter((f) => f.datum > heute && f.datum <= in7),
    wiedervorlagenWoche: wv.filter((f) => f.datum > heute && f.datum <= in7),
    kritischWoche,
    notfristenWoche: kritischWoche.filter((f) => f.typ === "notfrist"),
  };
}

export interface FristenZeitraum {
  /** Fristen (Notfristen und Fristen) im Zeitraum, nach Dringlichkeit sortiert */
  fristen: Frist[];
  /** davon Notfristen */
  notfristen: Frist[];
  /** davon kritisch (Notfrist oder nicht verlängerbar) */
  kritisch: Frist[];
  /** Wiedervorlagen im Zeitraum – getrennt genannt, nicht mitgezählt */
  wiedervorlagen: Frist[];
  /** Vorfristen im Zeitraum – nur Erinnerungen, nicht mitgezählt */
  vorfristen: Frist[];
  /** Termine im Zeitraum – eigene Kategorie, nicht mitgezählt */
  termine: Frist[];
}

/**
 * Offene Einträge in einem Datumsbereich [von, bis] (jeweils einschließlich) – mit derselben Zählweise wie fristenLage().
 * `von` darf leer sein („alles bis einschließlich bis“, z. B. für heute fällig inkl. überfällig).
 */
export function fristenImZeitraum(fristen: Frist[], von: ISODate | "", bis: ISODate, nurFuer?: ID): FristenZeitraum {
  const offen = fristen.filter((f) => f.status === "offen" && (!nurFuer || f.verantwortlichId === nurFuer) && f.datum <= bis && (!von || f.datum >= von)).sort(nachDringlichkeit);
  const echte = offen.filter(zaehltAlsFrist);
  return {
    fristen: echte,
    notfristen: echte.filter((f) => f.typ === "notfrist"),
    kritisch: echte.filter(istKritisch),
    wiedervorlagen: offen.filter((f) => f.typ === "wiedervorlage"),
    vorfristen: offen.filter((f) => f.typ === "vorfrist"),
    termine: offen.filter((f) => f.typ === "termin"),
  };
}

export interface AkteFristen {
  /** dringendste offene Frist der Akte im Fenster (überfällige zuerst, dann nach Datum) */
  naechste: Frist;
  /** dringendste kritische Frist der Akte im Fenster, falls vorhanden */
  kritisch?: Frist;
  /** Anzahl offener Fristen der Akte im Fenster */
  anzahl: number;
}

/**
 * Offene Fristen je Akte bis einschließlich `bis` (inkl. überfälliger) – ohne `bis` alle offenen Fristen.
 * Gemeinsame Grundlage für die Akten-Kennzahl „Akten mit Frist ≤ 7 Tage“, die Spalte „Nächste Frist“ und
 * die Cockpit-Karte „Akten mit Handlungsbedarf“. Wiedervorlagen, Vorfristen und Termine zählen nicht.
 */
export function fristenJeAkte(fristen: Frist[], bis?: ISODate): Map<ID, AkteFristen> {
  const m = new Map<ID, AkteFristen>();
  const offen = fristen.filter((f) => f.status === "offen" && zaehltAlsFrist(f) && (!bis || f.datum <= bis)).sort(nachDringlichkeit);
  for (const f of offen) {
    const cur = m.get(f.akteId);
    const kritisch = istKritisch(f);
    if (!cur) m.set(f.akteId, { naechste: f, kritisch: kritisch ? f : undefined, anzahl: 1 });
    else {
      cur.anzahl++;
      if (kritisch && !cur.kritisch) cur.kritisch = f;
    }
  }
  return m;
}

/** „Akten mit Frist ≤ 7 Tage“: offene Fristen bis heute + 7 Tage (inkl. überfälliger), je Akte. */
export function aktenMitFrist(fristen: Frist[], heute: ISODate, tage = FENSTER_TAGE): Map<ID, AkteFristen> {
  return fristenJeAkte(fristen, addDays(heute, tage));
}

export interface OffeneVerantwortung {
  /** offene Notfristen und Fristen der Person (Zählweise wie `fristenLage`) */
  fristen: Frist[];
  wiedervorlagen: Frist[];
  termine: Frist[];
  vorfristen: Frist[];
  /** alle offenen Einträge der Person – das, was bei einer Übertragung mitgeht */
  alle: Frist[];
}

/**
 * Offene Einträge, für die eine Person verantwortlich ist (z. B. vor dem Deaktivieren eines Zugangs, I5-T23-01):
 * Fristen (Notfristen und Fristen) getrennt von Wiedervorlagen, Terminen und Vorfristen.
 */
export function offeneVerantwortung(fristen: Frist[], personId: ID): OffeneVerantwortung {
  const alle = fristen.filter((f) => f.status === "offen" && f.verantwortlichId === personId).sort(nachDringlichkeit);
  return {
    fristen: alle.filter(zaehltAlsFrist),
    wiedervorlagen: alle.filter((f) => f.typ === "wiedervorlage"),
    termine: alle.filter((f) => f.typ === "termin"),
    vorfristen: alle.filter((f) => f.typ === "vorfrist"),
    alle,
  };
}

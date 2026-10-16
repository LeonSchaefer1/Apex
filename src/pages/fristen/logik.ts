// Gemeinsame Fristen-Helfer für Fristenkalender und Posteingang (Anlegen, Erledigen, Vier-Augen-Kontrolle, Darstellung).
import { addDays, addMonthsBGB, fromISO, nowLocal, today, uid, weekday } from "@/core/dates";
import type { Einheit } from "@/core/fristen";
import { useData } from "@/store/data";
import type { Frist, FristTyp, ID, ISODate } from "@/core/types";
import type { Tone } from "@/components/ui";

export interface TypMeta {
  label: string;
  kurz: string;
  tone: Tone;
  /** Klassen für Kalender-Pillen */
  pill: string;
  /** Farbpunkt */
  dot: string;
}

export const TYP_META: Record<FristTyp, TypMeta> = {
  notfrist: { label: "Notfrist", kurz: "Notfrist", tone: "seal", pill: "bg-seal-soft text-seal", dot: "bg-seal" },
  frist: { label: "Frist", kurz: "Frist", tone: "ink", pill: "bg-ink-soft text-ink", dot: "bg-ink" },
  vorfrist: { label: "Vorfrist", kurz: "Vorfrist", tone: "outline", pill: "border border-dashed border-[var(--line-strong)] text-fg-2", dot: "border border-dashed border-fg-3" },
  wiedervorlage: { label: "Wiedervorlage", kurz: "WV", tone: "neutral", pill: "bg-[var(--ink-softer)] text-fg-2 ring-1 ring-inset ring-[var(--line)]", dot: "bg-fg-4" },
  termin: { label: "Termin", kurz: "Termin", tone: "violet", pill: "bg-violet-soft text-violet", dot: "bg-violet" },
};

export const TYP_REIHENFOLGE: FristTyp[] = ["notfrist", "frist", "vorfrist", "wiedervorlage", "termin"];

/** Herkunft einer Frist – eine Tabelle für Fristenkalender, Akten-Reiter und Filter-Chips. */
export const QUELLE_LABEL: Record<Frist["quelle"], string> = {
  ki: "Von KI erkannt",
  automatisch: "Automatisch angelegt",
  manuell: "Von Hand eingetragen",
  migration: "Aus Umzug",
};

/** Erläuterung der Herkunft (Tooltip). */
export const QUELLE_TITEL: Record<Frist["quelle"], string> = {
  ki: "Von der KI im Dokument erkannt – berechnet mit dem Fristenrechner",
  automatisch: "Automatisch angelegt (z. B. Vorfrist, Automation des 38h-Motors)",
  manuell: "Von Hand eingetragen",
  migration: "Aus der Altsoftware übernommen – Datum laut Altsystem, bitte mit dem Fristenrechner nachrechnen",
};

/**
 * Vier-Augen-Kontrolle – maßgebliche Regel für Fristenkalender, Akten-Reiter und Posteingang:
 * Jede offene Notfrist oder Frist ist bis zur Bestätigung durch eine zweite Person unkontrolliert –
 * unabhängig davon, ob sie mit einer Regel des Fristenrechners (`regelKey`) oder als richterliche
 * bzw. KI-Frist ohne Regel angelegt wurde. Vorfristen, Wiedervorlagen und Termine brauchen keine Kontrolle.
 */
export function brauchtKontrolle(f: Frist): boolean {
  return f.status === "offen" && (f.typ === "notfrist" || f.typ === "frist") && !f.kontrolliertVon;
}

/**
 * Von der KI erkannte oder aus der Altsoftware übernommene Frist, die noch nicht kontrolliert ist – eine Teilmenge
 * von `brauchtKontrolle` (die Kachel „Vier-Augen-Kontrolle offen“ nennt sie als „davon … von der KI erkannt / aus Umzug“).
 */
export function istUngeprueft(f: Frist): boolean {
  return (f.quelle === "ki" || f.quelle === "migration") && brauchtKontrolle(f);
}

/** Unterliegt der Vier-Augen-Kontrolle (Notfrist oder Frist) – unabhängig davon, ob sie schon bestätigt ist. */
export function unterliegtKontrolle(f: Frist): boolean {
  return f.typ === "notfrist" || f.typ === "frist";
}

/** Darf diese Person die Kontrolle bestätigen? Nie die verantwortliche Person selbst (keine Selbstkontrolle). */
export function darfKontrollieren(f: Frist, userId: ID): boolean {
  return brauchtKontrolle(f) && f.verantwortlichId !== userId;
}

/** Ampelfarbe für den Dringlichkeitsstreifen. */
export function streifenFarbe(f: Frist, heute: ISODate = today()): string {
  if (f.status === "erledigt") return "bg-green";
  const diff = (fromISO(f.datum).getTime() - fromISO(heute).getTime()) / 86400000;
  if (diff < 0) return "bg-seal";
  if (diff <= 2) return f.typ === "wiedervorlage" || f.typ === "vorfrist" ? "bg-amber" : "bg-seal";
  if (diff <= 7) return "bg-amber";
  return "bg-[var(--line-strong)]";
}

/** Montag der Woche, in der `iso` liegt. */
export function wochenStart(iso: ISODate): ISODate {
  const wd = weekday(iso); // 0 = So
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
}

/**
 * Erster Tag der Wochenansicht: Montag bis Donnerstag die laufende Kalenderwoche; ab Freitag ein 7-Tage-Fenster
 * ab heute – sonst stünden am Freitag vier leere Vortage im Bild und die Fristen der nächsten Woche fehlten.
 */
export function wochenAnsichtStart(heute: ISODate): ISODate {
  const wd = weekday(heute); // 0 = So
  return wd === 5 || wd === 6 || wd === 0 ? heute : wochenStart(heute);
}

/** ISO-Kalenderwoche. */
export function kalenderwoche(iso: ISODate): number {
  const d = fromISO(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** Rechnerisches Fristende vor Verschiebung (§ 188 BGB) – zur Visualisierung des § 222 Abs. 2 ZPO. */
export function rohesEnde(ereignis: ISODate, dauer: number, einheit: Einheit): ISODate {
  if (einheit === "tage") return addDays(ereignis, dauer);
  if (einheit === "wochen") return addDays(ereignis, dauer * 7);
  if (einheit === "monate") return addMonthsBGB(ereignis, dauer).date;
  return `${Number(ereignis.slice(0, 4)) + dauer}-12-31`;
}

export interface NeueFrist {
  akteId: ID;
  titel: string;
  typ: FristTyp;
  datum: ISODate;
  uhrzeit?: string;
  ort?: string;
  vorfrist?: ISODate;
  regelKey?: string;
  grundlage?: string;
  ereignisDatum?: ISODate;
  rechenweg?: string[];
  quelle: Frist["quelle"];
  verantwortlichId: ID;
  /** Verantwortlich für die Vorfrist (z. B. ReFa); Standard: wie Frist */
  vorfristVerantwortlichId?: ID;
  notiz?: string;
}

/** Legt eine Frist an – mit Vorfrist als eigenem Kalendereintrag. Kontrolle (Vier-Augen) bleibt offen. */
export function legeFristAn(p: NeueFrist): { frist: Frist; vorfrist?: Frist } {
  const { upsert } = useData.getState();
  const jetzt = nowLocal();
  const frist: Frist = {
    id: uid("f"),
    akteId: p.akteId,
    titel: p.titel,
    typ: p.typ,
    datum: p.datum,
    uhrzeit: p.uhrzeit,
    ort: p.ort,
    vorfrist: p.vorfrist,
    regelKey: p.regelKey,
    grundlage: p.grundlage,
    ereignisDatum: p.ereignisDatum,
    rechenweg: p.rechenweg,
    status: "offen",
    verantwortlichId: p.verantwortlichId,
    quelle: p.quelle,
    notiz: p.notiz,
    createdAt: jetzt,
  };
  upsert("fristen", frist);
  let vorfrist: Frist | undefined;
  if (p.vorfrist && p.vorfrist < p.datum) {
    vorfrist = {
      id: uid("f"),
      akteId: p.akteId,
      titel: `Vorfrist: ${p.titel}`,
      typ: "vorfrist",
      datum: p.vorfrist,
      bezugId: frist.id,
      grundlage: p.grundlage,
      regelKey: p.regelKey,
      status: "offen",
      verantwortlichId: p.vorfristVerantwortlichId ?? p.verantwortlichId,
      quelle: p.quelle === "manuell" ? "manuell" : "automatisch",
      notiz: `Vorfrist zu „${p.titel}“ (Fristende ${p.datum.split("-").reverse().join(".")}).`,
      createdAt: jetzt,
    };
    upsert("fristen", vorfrist);
  }
  return { frist, vorfrist };
}

/** Zugehörige Vorfrist-Einträge einer Frist – über `bezugId`, bei älteren Einträgen ohne Bezug über den Titel. */
export function vorfristenZu(f: Frist, alle: Frist[]): Frist[] {
  if (f.typ === "vorfrist") return [];
  return alle.filter((x) => x.typ === "vorfrist" && x.akteId === f.akteId && (x.bezugId ? x.bezugId === f.id : x.titel === `Vorfrist: ${f.titel}`));
}

/** Erledigt eine Frist (inkl. offener Vorfrist) und protokolliert es. */
export function erledigeFrist(f: Frist, userId: ID): void {
  const { patch, log, data } = useData.getState();
  const jetzt = nowLocal();
  patch("fristen", f.id, { status: "erledigt", erledigtAm: jetzt, erledigtVon: userId });
  for (const v of vorfristenZu(f, data.fristen)) if (v.status === "offen") patch("fristen", v.id, { status: "erledigt", erledigtAm: jetzt, erledigtVon: userId });
  log({ akteur: "nutzer", userId, akteId: f.akteId, text: `${TYP_META[f.typ].label} „${f.titel}“ als erledigt markiert` });
}

/**
 * Macht „Erledigt“ rückgängig – inklusive Vorfrist: Eine noch bevorstehende Vorfrist wird immer mit geöffnet
 * (die Erinnerung darf nicht verloren gehen), eine vergangene nur, wenn sie zusammen mit der Frist erledigt wurde.
 */
export function oeffneFristWieder(f: Frist, heute: ISODate = today()): void {
  const { patch, data } = useData.getState();
  const zeitpunkt = data.fristen.find((x) => x.id === f.id)?.erledigtAm;
  patch("fristen", f.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
  for (const v of vorfristenZu(f, data.fristen)) {
    if (v.status !== "erledigt") continue;
    if (v.datum >= heute || (zeitpunkt && v.erledigtAm === zeitpunkt)) patch("fristen", v.id, { status: "offen", erledigtAm: undefined, erledigtVon: undefined });
  }
}

/** Vier-Augen-Kontrolle bestätigen (nur durch eine andere Person als die verantwortliche, siehe `darfKontrollieren`). */
export function bestaetigeKontrolle(f: Frist, userId: ID): boolean {
  const aktuell = useData.getState().data.fristen.find((x) => x.id === f.id) ?? f;
  if (!darfKontrollieren(aktuell, userId)) return false;
  const { patch, log } = useData.getState();
  patch("fristen", f.id, { kontrolliertVon: userId });
  log({ akteur: "nutzer", userId, akteId: f.akteId, text: `Vier-Augen-Kontrolle bestätigt: ${f.titel} (${f.datum.split("-").reverse().join(".")})` });
  return true;
}

// Datums-Hilfen auf Basis von ISO-Kalendertagen (zeitzonenfest, UTC-intern).
import type { ISODate } from "./types";

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Heutiges Datum in deutscher Ortszeit. */
export function today(): ISODate {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Monate addieren nach § 188 Abs. 3 BGB: fehlt der Tag, gilt der Monatsletzte. */
export function addMonthsBGB(iso: ISODate, months: number): { date: ISODate; gekappt: boolean } {
  const d = fromISO(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const dim = daysInMonth(targetYear, targetMonth);
  const day = Math.min(d.getUTCDate(), dim);
  return {
    date: toISO(new Date(Date.UTC(targetYear, targetMonth, day))),
    gekappt: d.getUTCDate() > dim,
  };
}

export function weekday(iso: ISODate): number {
  return fromISO(iso).getUTCDay(); // 0 = Sonntag
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONATE_KURZ = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

export function wochentagName(iso: ISODate, kurz = false): string {
  return (kurz ? WOCHENTAGE_KURZ : WOCHENTAGE)[weekday(iso)];
}

export function monatName(month0: number, kurz = false): string {
  return (kurz ? MONATE_KURZ : MONATE)[month0];
}

/** 16.10.2026 */
export function fmtDate(iso?: ISODate | null): string {
  if (!iso) return "–";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/** Fr, 16.10.2026 */
export function fmtDateWd(iso?: ISODate | null): string {
  if (!iso) return "–";
  return `${wochentagName(iso, true)}, ${fmtDate(iso)}`;
}

/** 16. Okt. */
export function fmtDateShort(iso?: ISODate | null): string {
  if (!iso) return "–";
  const d = fromISO(iso);
  return `${d.getUTCDate()}. ${MONATE_KURZ[d.getUTCMonth()]}`;
}

/** 16. Oktober 2026 */
export function fmtDateLong(iso?: ISODate | null): string {
  if (!iso) return "–";
  const d = fromISO(iso);
  return `${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtTime(isoDateTime?: string | null): string {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** relative Angabe: „heute", „morgen", „in 5 Tagen", „vor 2 Tagen" */
export function relDays(iso: ISODate, ref: ISODate = today()): string {
  const n = diffDays(ref, iso);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  if (n === 2) return "übermorgen";
  if (n > 0) return `in ${n} Tagen`;
  return `vor ${-n} Tagen`;
}

/**
 * Relative Zeitangabe: „gerade eben“, „vor 12 Min.“, ab 60 Min. „vor 1 Std.“, ab 24 Std. nach Kalendertagen
 * („gestern“, „vor 3 Tagen“), danach das Datum. Zukünftige Zeitpunkte: „heute, 14:00“ bzw. Datum.
 */
export function relTime(isoDateTime: string, now = Date.now()): string {
  const t = new Date(isoDateTime);
  const diff = Math.round((now - t.getTime()) / 1000);
  if (diff < -60) {
    return new Date(now).toDateString() === t.toDateString() ? `heute, ${fmtTime(isoDateTime)}` : fmtDate(isoDateTime.slice(0, 10));
  }
  if (diff < 45) return "gerade eben";
  const min = Math.max(1, Math.round(diff / 60));
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(diff / 3600);
  // ab einem Tag nach Kalendertagen (Ortszeit), damit „gestern“ auch wirklich gestern ist
  const tag = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((tag(new Date(now)) - tag(t)) / 86400000);
  if (std < 24 || days < 1) return `vor ${Math.min(std, 23)} Std.`;
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return fmtDate(toLocalISO(t).slice(0, 10));
}

/** 1.234,50 € – negative Beträge mit typografischem Minus (U+2212) statt Bindestrich: „−423,80 €“. */
export function fmtEUR(n: number, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true;
  // −0,00 € vermeiden: Beträge, die auf 0 gerundet werden, ohne Vorzeichen
  const wert = Math.abs(n) < (cents ? 0.005 : 0.5) ? 0 : n;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
    .format(wert)
    .replace(/^-/, "\u2212");
}

export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Lokaler Zeitstempel ohne Zeitzonen-Suffix: "2026-10-16T09:30:00" */
export function toLocalISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function nowLocal(): string {
  return toLocalISO(new Date());
}

export function uid(prefix = "id"): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${r}`;
}

const NBSP = " ";
/**
 * Geschützte Leerzeichen für Fließtexte, damit nichts unglücklich umbricht: „§ 4“, „§§ 187 ff.“, „Abs. 1“, „Nr. 3305“,
 * „S. 2“, „Art. 28“ sowie Zahl und Einheit („38 Std.“, „20 €“, „7 Tage“, „99 %“, „45 Min.“).
 */
export function schuetzeLeerzeichen(text: string): string {
  return text
    .replace(/(§§?|Abs\.|Nr\.|Nrn\.|S\.|Art\.|Hs\.|Anm\.|Vorbem\.) (?=\d)/g, `$1${NBSP}`)
    .replace(/(\d) (?=(?:€|%|Std\.|Min\.|Tage?n?\b|Wochen?\b|Monate?n?\b|Jahre?n?\b|ff\.|VV\b|RVG\b|ZPO\b|BGB\b|StPO\b|KSchG\b|OWiG\b|ArbGG\b|VwGO\b|BRAO\b))/g, `$1${NBSP}`);
}

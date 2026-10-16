// Gesetzliche Feiertage in Deutschland je Bundesland (Grundlage für § 222 Abs. 2 ZPO / § 193 BGB).
import { addDays, toISO } from "./dates";
import type { Bundesland, ISODate } from "./types";

export interface Feiertag {
  datum: ISODate;
  name: string;
  /** true = nur in Teilen des Landes (z. B. Mariä Himmelfahrt in Bayern). Wird bei Fristen NICHT verlängert. */
  teilweise?: boolean;
}

export const BUNDESLAENDER: { code: Bundesland; name: string }[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

export function bundeslandName(code: Bundesland): string {
  return BUNDESLAENDER.find((b) => b.code === code)?.name ?? code;
}

/** Ostersonntag nach dem Gauß'schen Algorithmus (Meeus/Jones/Butcher). */
export function ostersonntag(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(Date.UTC(year, month - 1, day)));
}

function iso(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Buß- und Bettag: Mittwoch vor dem 23. November. */
function bussUndBettag(year: number): ISODate {
  const nov23 = new Date(Date.UTC(year, 10, 23));
  const wd = nov23.getUTCDay(); // 0 So … 3 Mi
  const diff = ((wd - 3 + 7) % 7) || 7;
  return toISO(new Date(Date.UTC(year, 10, 23 - diff)));
}

const cache = new Map<string, Feiertag[]>();

export function feiertage(year: number, land: Bundesland): Feiertag[] {
  const key = `${year}-${land}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ostern = ostersonntag(year);
  const list: Feiertag[] = [
    { datum: iso(year, 1, 1), name: "Neujahr" },
    { datum: addDays(ostern, -2), name: "Karfreitag" },
    { datum: addDays(ostern, 1), name: "Ostermontag" },
    { datum: iso(year, 5, 1), name: "Tag der Arbeit" },
    { datum: addDays(ostern, 39), name: "Christi Himmelfahrt" },
    { datum: addDays(ostern, 50), name: "Pfingstmontag" },
    { datum: iso(year, 10, 3), name: "Tag der Deutschen Einheit" },
    { datum: iso(year, 12, 25), name: "1. Weihnachtstag" },
    { datum: iso(year, 12, 26), name: "2. Weihnachtstag" },
  ];
  const add = (lands: Bundesland[], f: Feiertag) => {
    if (lands.includes(land)) list.push(f);
  };

  add(["BW", "BY", "ST"], { datum: iso(year, 1, 6), name: "Heilige Drei Könige" });
  if (year >= 2019) add(["BE"], { datum: iso(year, 3, 8), name: "Internationaler Frauentag" });
  if (year >= 2023) add(["MV"], { datum: iso(year, 3, 8), name: "Internationaler Frauentag" });
  add(["BB"], { datum: ostern, name: "Ostersonntag" });
  add(["BB"], { datum: addDays(ostern, 49), name: "Pfingstsonntag" });
  add(["BW", "BY", "HE", "NW", "RP", "SL"], { datum: addDays(ostern, 60), name: "Fronleichnam" });
  add(["SN", "TH"], { datum: addDays(ostern, 60), name: "Fronleichnam (regional)", teilweise: true });
  add(["SL"], { datum: iso(year, 8, 15), name: "Mariä Himmelfahrt" });
  add(["BY"], { datum: iso(year, 8, 15), name: "Mariä Himmelfahrt (regional)", teilweise: true });
  add(["BY"], { datum: iso(year, 8, 8), name: "Augsburger Hohes Friedensfest (nur Augsburg)", teilweise: true });
  if (year >= 2019) add(["TH"], { datum: iso(year, 9, 20), name: "Weltkindertag" });
  add(["BB", "MV", "SN", "ST", "TH"], { datum: iso(year, 10, 31), name: "Reformationstag" });
  if (year >= 2018) add(["HB", "HH", "NI", "SH"], { datum: iso(year, 10, 31), name: "Reformationstag" });
  add(["BW", "BY", "NW", "RP", "SL"], { datum: iso(year, 11, 1), name: "Allerheiligen" });
  add(["SN"], { datum: bussUndBettag(year), name: "Buß- und Bettag" });
  if (year === 2020 || year === 2025) add(["BE"], { datum: iso(year, 5, 8), name: "Tag der Befreiung (einmalig)" });
  if (year === 2017) list.push({ datum: iso(2017, 10, 31), name: "Reformationstag (500 Jahre, bundesweit)" });

  list.sort((a, b) => a.datum.localeCompare(b.datum));
  cache.set(key, list);
  return list;
}

export function feiertagAm(datum: ISODate, land: Bundesland): Feiertag | undefined {
  const year = Number(datum.slice(0, 4));
  return feiertage(year, land).find((f) => f.datum === datum);
}

/** Ist der Tag ein Werktag im Sinne des § 222 Abs. 2 ZPO (kein Samstag, Sonntag, allgemeiner Feiertag)? */
export function istWerktag(datum: ISODate, land: Bundesland): boolean {
  const wd = new Date(datum + "T00:00:00Z").getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const f = feiertagAm(datum, land);
  return !f || !!f.teilweise;
}

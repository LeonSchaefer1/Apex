// Verbindliche Rückrufzusage der festen Ansprechperson: jetzt + 30 Minuten innerhalb der Servicezeit, sonst nächster Werktag 8:30 Uhr.
import { addDays, fmtDateWd, weekday } from "./dates";
import { istWerktag } from "./feiertage";
import type { Bundesland, ISODate } from "./types";

export const RUECKRUF_MINUTEN = 30;
/** Im Prototyp gibt es keinen echten Rückruf – jede Zusage trägt diesen Zusatz. */
export const RUECKRUF_SIMULIERT = "(im Prototyp simuliert – es ruft niemand an)";

/** Servicezeit aus „Mo–Fr 7:30–19:00 Uhr“ bzw. „Mo–Fr 8–19 Uhr“ (Minuten seit Mitternacht). Unbekannt → 8:00–18:00 Uhr. */
export function servicezeit(verfuegbar: string): { von: number; bis: number } {
  const m = verfuegbar.match(/(\d{1,2})(?::(\d{2}))?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*Uhr/);
  if (!m) return { von: 8 * 60, bis: 18 * 60 };
  return { von: Number(m[1]) * 60 + Number(m[2] ?? 0), bis: Number(m[3]) * 60 + Number(m[4] ?? 0) };
}

const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

export interface RueckrufZusage {
  datum: ISODate;
  /** Minuten seit Mitternacht */
  uhrzeit: number;
  heute: boolean;
  /** „Rückruf bis spätestens 17:20 Uhr“ bzw. „Rückruf am Mo, 19.10.2026 bis spätestens 8:30 Uhr“ */
  text: string;
}

/**
 * Zusage mit Uhrzeit: Liegt „jetzt + 30 Min.“ an einem Werktag (Mo–Fr, kein Feiertag) in der Servicezeit, gilt diese Uhrzeit;
 * sonst der nächste Werktag um 8:30 Uhr (frühestens zu Beginn der Servicezeit).
 */
export function rueckrufZusage(jetzt: Date, verfuegbar: string, land: Bundesland = "BE"): RueckrufZusage {
  const { von, bis } = servicezeit(verfuegbar);
  const tag = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}-${String(jetzt.getDate()).padStart(2, "0")}`;
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  const werktag = (d: ISODate) => weekday(d) >= 1 && weekday(d) <= 5 && istWerktag(d, land);
  const ziel = min + RUECKRUF_MINUTEN;
  if (werktag(tag) && min >= von && ziel <= bis) return { datum: tag, uhrzeit: ziel, heute: true, text: `Rückruf bis spätestens ${hhmm(ziel)} Uhr` };
  // vor Beginn der Servicezeit an einem Werktag: Beginn + 30 Min., frühestens 8:30 Uhr
  const morgens = Math.max(von + RUECKRUF_MINUTEN, 8 * 60 + 30);
  if (werktag(tag) && min < von) return { datum: tag, uhrzeit: morgens, heute: true, text: `Rückruf bis spätestens ${hhmm(morgens)} Uhr` };
  let d = addDays(tag, 1);
  for (let i = 0; i < 10 && !werktag(d); i++) d = addDays(d, 1);
  return { datum: d, uhrzeit: morgens, heute: false, text: `Rückruf am ${fmtDateWd(d)} bis spätestens ${hhmm(morgens)} Uhr` };
}

const tagVon = (d: Date): ISODate => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Liegt `jetzt` in der Servicezeit (Mo–Fr, kein Feiertag im Land, zwischen Beginn und Ende)? */
export function inServicezeit(jetzt: Date, verfuegbar: string, land: Bundesland = "BE"): boolean {
  const { von, bis } = servicezeit(verfuegbar);
  const tag = tagVon(jetzt);
  const wd = weekday(tag);
  if (wd < 1 || wd > 5 || !istWerktag(tag, land)) return false;
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  return min >= von && min < bis;
}

/**
 * Kommt der zugesagte Rückruf erst nach heute 24 Uhr? Dann hilft er bei einer heute ablaufenden Frist nicht mehr –
 * die Oberfläche verweist auf die Ersatzeinreichung (§ 130d S. 2, 3 ZPO; § 46g S. 3, 4 ArbGG).
 */
export function rueckrufNachFristende(zusage: Pick<RueckrufZusage, "datum">, jetzt: Date): boolean {
  return zusage.datum !== tagVon(jetzt);
}

/** Beginn der nächsten Servicezeit (heute, wenn sie noch nicht begonnen hat), z. B. „Mo, 19.10.2026 ab 7:30 Uhr“. */
export function naechsteServicezeit(jetzt: Date, verfuegbar: string, land: Bundesland = "BE"): { datum: ISODate; ab: number; text: string } {
  const { von } = servicezeit(verfuegbar);
  const tag = tagVon(jetzt);
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  const werktag = (d: ISODate) => weekday(d) >= 1 && weekday(d) <= 5 && istWerktag(d, land);
  let d = tag;
  if (!(werktag(tag) && min < von)) {
    d = addDays(tag, 1);
    for (let i = 0; i < 10 && !werktag(d); i++) d = addDays(d, 1);
  }
  return { datum: d, ab: von, text: `${d === tag ? "heute" : fmtDateWd(d)} ab ${hhmm(von)} Uhr` };
}

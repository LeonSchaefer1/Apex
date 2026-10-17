// Vorschläge für das fristauslösende Ereignis im Dialog „Frist anlegen“ – reine Logik ohne React (Test: fristAnlegen.test.ts).
import type { Akte, Dokument, Frist, Nachricht } from "@/core/types";
import type { FristRegel } from "@/core/fristen";
import { fmtDate } from "@/core/dates";

const DATUM_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const isoAus = (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

/** Gestrichene Fristen („Fehleintrag“, Streichung mit Grund) liefern keine Daten mehr – weder Vorschlag noch Dublette. */
export const istGestrichen = (f: Pick<Frist, "erledigtNachweis">) => f.erledigtNachweis?.art === "gestrichen";

/**
 * Vorschläge für das fristauslösende Ereignis – immer mit Quelle, nie still übernommen:
 * Zugang der Kündigung aus dem Kündigungsschreiben bzw. einer notierten Frist derselben Art, Zustellung aus dem eEB.
 * Gestrichene Fristen bleiben außen vor (I4-T15-01); der Text nennt den Stand der Quelle („offene“ bzw. „erledigte Frist … vom …“).
 */
export function ereignisVorschlaege(regel: FristRegel | undefined, akte: Pick<Akte, "id">, dokumente: Dokument[], fristen: Frist[], nachrichten: Nachricht[]): { datum: string; quelle: string }[] {
  if (!regel) return [];
  const out: { datum: string; quelle: string }[] = [];
  const dazu = (datum: string, quelle: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(datum) && !out.some((v) => v.datum === datum)) out.push({ datum, quelle });
  };
  if (/kündigung/i.test(regel.ereignis)) {
    for (const d of dokumente.filter((x) => x.akteId === akte.id && /kündigung/i.test(x.name))) {
      const m = d.inhalt.match(/(?:zugegangen|zugestellt|Zugang)[^\n]{0,60}?(\d{1,2}\.\d{1,2}\.\d{4})/i);
      const mm = m?.[1].match(DATUM_RE);
      if (mm) dazu(isoAus(mm), `aus „${d.name}“`);
    }
  }
  if (/zustellung|bekanntgabe/i.test(regel.ereignis)) {
    for (const n of nachrichten.filter((x) => x.akteId === akte.id && x.eebZustellungsdatum).sort((a, b) => b.eingang.localeCompare(a.eingang)).slice(0, 2))
      dazu(n.eebZustellungsdatum!, `Zustellungsdatum laut eEB zu „${n.betreff}“`);
  }
  for (const f of fristen.filter((x) => x.akteId === akte.id && x.regelKey === regel.key && x.ereignisDatum && x.typ !== "vorfrist" && !istGestrichen(x))) {
    const stand = f.status === "offen" ? "aus der offenen Frist" : "aus der erledigten Frist";
    const vom = f.status !== "offen" && f.erledigtAm ? ` vom ${fmtDate(f.erledigtAm.slice(0, 10))}` : "";
    dazu(f.ereignisDatum!, `${stand} „${f.titel}“${vom}`);
  }
  return out;
}

// Kalenderdatei (.ics) nach RFC 5545 für Fristen, Wiedervorlagen und Termine – zum Übernehmen in Outlook, Apple oder Google Kalender.
// CRLF-Zeilenenden, UTF-8, Zeilenfaltung nach 75 Oktetten, ganztägige Einträge bzw. Termine mit Uhrzeit (Europe/Berlin).
import type { Akte, Frist } from "@/core/types";
import { fristArtZu } from "@/core/fristen";
import { addDays, fmtDate, fmtDateWd } from "@/core/dates";
import { TYP_META } from "./logik";

const CRLF = "\r\n";

/** Text-Werte maskieren (RFC 5545, 3.3.11): Backslash, Semikolon, Komma, Zeilenumbruch. */
export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen über 75 Oktette falten (Fortsetzung mit führendem Leerzeichen) – UTF-8-sicher, ohne Zeichen zu zerteilen. */
export function falte(zeile: string): string {
  const enc = new TextEncoder();
  if (enc.encode(zeile).length <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = "";
  let laenge = 0;
  let grenze = 75;
  for (const ch of zeile) {
    const n = enc.encode(ch).length;
    if (laenge + n > grenze) {
      teile.push(aktuell);
      aktuell = "";
      laenge = 0;
      grenze = 74; // Folgezeilen beginnen mit einem Leerzeichen
    }
    aktuell += ch;
    laenge += n;
  }
  teile.push(aktuell);
  return teile.join(`${CRLF} `);
}

const datum = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
function zeitstempel(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Zeitzone Europe/Berlin (MEZ/MESZ) – damit Termine mit Uhrzeit überall richtig erscheinen. */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:MESZ",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:MEZ",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** „Notfrist: Berufungsfrist – 118/26“ */
export function icsTitel(f: Frist, akte?: Akte): string {
  const art = f.typ === "notfrist" || f.typ === "frist" ? fristArtZu(f)?.label ?? TYP_META[f.typ].label : TYP_META[f.typ].label;
  return `${art}: ${f.titel.replace(/^Vorfrist: /, "")}${akte ? ` – ${akte.aktenzeichen}` : ""}`;
}

function vevent(f: Frist, akte: Akte | undefined, stamp: string): string[] {
  // UID bleibt nach der Umbenennung in Apex gleich: erneut importierte Einträge aktualisieren den Kalender statt sich zu verdoppeln.
  const zeilen = ["BEGIN:VEVENT", `UID:${f.id}@anwaltapex`, `DTSTAMP:${stamp}`];
  if (f.uhrzeit && /^\d{1,2}:\d{2}$/.test(f.uhrzeit)) {
    const [h, m] = f.uhrzeit.split(":").map(Number);
    const start = `${datum(f.datum)}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    const endeH = Math.min(23, h + 1);
    const ende = `${datum(f.datum)}T${String(endeH).padStart(2, "0")}${String(endeH === h + 1 ? m : 59).padStart(2, "0")}00`;
    zeilen.push(`DTSTART;TZID=Europe/Berlin:${start}`, `DTEND;TZID=Europe/Berlin:${ende}`);
  } else {
    zeilen.push(`DTSTART;VALUE=DATE:${datum(f.datum)}`, `DTEND;VALUE=DATE:${datum(addDays(f.datum, 1))}`);
  }
  zeilen.push(`SUMMARY:${icsText(icsTitel(f, akte))}`);
  const beschreibung = [
    akte ? `Akte ${akte.aktenzeichen} · ${akte.titel}` : "",
    f.typ === "notfrist" || f.typ === "frist" ? `Fristende ${fmtDateWd(f.datum)}, 24:00 Uhr` : "",
    f.grundlage ? `Grundlage: ${f.grundlage}` : "",
    f.vorfrist && f.typ !== "vorfrist" ? `Vorfrist: ${fmtDate(f.vorfrist)}` : "",
    f.rechenweg?.length ? `Rechenweg:\n${f.rechenweg.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : "",
    f.notiz ?? "",
    "Aus Apex übernommen – maßgeblich bleibt der Fristenkalender der Kanzlei.",
  ].filter(Boolean);
  zeilen.push(`DESCRIPTION:${icsText(beschreibung.join("\n"))}`);
  if (f.ort) zeilen.push(`LOCATION:${icsText(f.ort)}`);
  zeilen.push(`CATEGORIES:${icsText(TYP_META[f.typ].label)}`);
  if (f.status === "erledigt") zeilen.push("STATUS:CANCELLED");
  // Erinnerung: Termine 1 Std. vorher, Notfristen und Fristen am Vortag 9 Uhr, sonst am Morgen des Tages
  if (f.status === "offen") zeilen.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(icsTitel(f, akte))}`, `TRIGGER:${f.uhrzeit ? "-PT1H" : f.typ === "notfrist" || f.typ === "frist" ? "-PT15H" : "PT9H"}`, "END:VALARM");
  zeilen.push("END:VEVENT");
  return zeilen;
}

/** Erzeugt eine vollständige .ics-Datei (CRLF, gefaltet) für einen oder mehrere Einträge. */
export function erzeugeIcs(eintraege: { f: Frist; akte?: Akte }[], name = "Apex-Fristen"): string {
  const stamp = zeitstempel();
  const mitUhrzeit = eintraege.some((e) => !!e.f.uhrzeit);
  const zeilen = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apex//Fristenkalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(name)}`,
    ...(mitUhrzeit ? VTIMEZONE : []),
    ...eintraege.flatMap((e) => vevent(e.f, e.akte, stamp)),
    "END:VCALENDAR",
  ];
  return zeilen.map(falte).join(CRLF) + CRLF;
}

/** Dateiname: „Frist_118-26_2026-11-16.ics“ */
export function icsDateiname(f: Frist, akte?: Akte): string {
  return `${TYP_META[f.typ].label}_${akte ? akte.aktenzeichen.replace("/", "-") + "_" : ""}${f.datum}.ics`.replace(/\s+/g, "_");
}

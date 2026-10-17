// Betriebsstatus der Anbindungen – im Prototyp simuliert. Gleiche Werte wie der Systemstatus unter Hilfe (beA-Abruf alle 2 Min.).

/** Einheitlicher Wortlaut für simulierte Anbindungen (Kopfleiste, Posteingang, Bankabgleich). */
export const SIMULIERT_STATUS = "beA · E-Mail · Bank: im Prototyp simuliert";

/** Abrufabstand für beA und E-Mail in Minuten (Systemstatus: „Abruf alle 2 Min.“). */
export const ABRUF_MINUTEN = 2;

/** Minuten seit dem letzten (simulierten) Abruf. */
export function minutenSeitAbruf(ms = Date.now()): number {
  return Math.floor(ms / 60_000) % ABRUF_MINUTEN;
}

/** „letzte Abfrage vor 1 Min.“ bzw. „letzte Abfrage gerade eben“. */
export function letzteAbfrageText(ms = Date.now()): string {
  const m = minutenSeitAbruf(ms);
  return m === 0 ? "letzte Abfrage gerade eben" : `letzte Abfrage vor ${m} Min.`;
}

/** Zeitpunkt des letzten (simulierten) automatischen Abrufs in ms – derselbe Takt wie im Cockpit und im Systemstatus. */
export function letzterAbrufMs(ms = Date.now()): number {
  return ms - (ms % (ABRUF_MINUTEN * 60_000));
}

/** Uhrzeit des letzten (simulierten) Abrufs: „01:20 Uhr“. */
export function letzteAbfrageUhrzeit(ms = Date.now()): string {
  return `${new Date(letzterAbrufMs(ms)).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
}

/** Name des Statuspunkts für Screenreader (mobile Kopfleiste). */
export const SYSTEMSTATUS_NAME = "Systemstatus: beA und E-Mail simuliert verbunden – öffnen";

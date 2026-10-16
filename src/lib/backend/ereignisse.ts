// Rückmeldungen der Backends an die Sitzungsverwaltung (ohne Importzyklus zwischen Backend und Store).

/** Anlass, aus dem eine Anfrage wegen der Sitzung scheiterte: abgelaufen/beendet (401) oder andere Kanzlei bzw. Person angemeldet (409). */
export type SitzungsProblem = "abgelaufen" | "gewechselt";

let sitzungsHandler: ((art: SitzungsProblem) => void) | null = null;

/** Die Sitzungsverwaltung (src/store/session.ts) meldet sich hier an und gleicht bei Problemen mit dem Server ab. */
export function beiSitzungsproblem(fn: (art: SitzungsProblem) => void) {
  sitzungsHandler = fn;
}

export function meldeSitzungsproblem(art: SitzungsProblem) {
  try {
    sitzungsHandler?.(art);
  } catch (e) {
    console.warn("Sitzungsabgleich fehlgeschlagen", e);
  }
}

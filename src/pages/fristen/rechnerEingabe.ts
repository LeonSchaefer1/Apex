// Eingaben des Fristenrechners: Ereignisdatum ohne stille Vorbelegung (I3-T18-02). Reine Hilfen ohne React –
// berechnet wird ausschließlich in src/core/fristen.ts.

/** Herkunft des Ereignisdatums – erscheint im Rechenweg. */
export type EreignisHerkunft = "start" | "heute" | "hand";

export const istIsoDatum = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

/** Startzustand: vorbelegt nur mit einem ausdrücklich übergebenen Ereignisdatum (Posteingang, Akte, Assistent) – sonst leer. */
export function startEreignisZustand(startEreignis?: string): { ereignis: string; herkunft: EreignisHerkunft } {
  return istIsoDatum(startEreignis) ? { ereignis: startEreignis, herkunft: "start" } : { ereignis: "", herkunft: "hand" };
}

/** Pflichtprüfung des Ereignisdatums: ohne Datum kein Fristende (Hinweis mit Schnellwahl „heute“). */
export function ereignisFehlt(ereignis: string, ereignisLabel: string): string | undefined {
  if (!ereignis) return `Bitte das Datum eintragen: ${ereignisLabel} – oder „heute“ wählen`;
  if (!istIsoDatum(ereignis)) return "Bitte ein gültiges Datum eingeben.";
  return undefined;
}

/** Rechenweg-Zusatz zur Herkunft: „heute (Schnellwahl)“ bzw. „Ereignisdatum aus … übernommen“; von Hand eingegeben ohne Zusatz. */
export function ereignisHerkunftText(herkunft: EreignisHerkunft, startQuelle?: string): string | undefined {
  if (herkunft === "heute") return "heute (Schnellwahl)";
  if (herkunft === "start") return `Ereignisdatum aus ${startQuelle?.trim() || "dem Aufruf"} übernommen`;
  return undefined;
}

/** Erste Rechenwegzeile (Ereignis) um die Herkunft ergänzen. */
export function rechenwegMitHerkunft(rechenweg: string[], herkunftText?: string): string[] {
  return herkunftText ? rechenweg.map((z, i) => (i === 0 ? `${z} · ${herkunftText}` : z)) : rechenweg;
}

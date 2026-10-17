// Telefonnummern antippbar machen (tel:-Links) – Hilfe-Karte, Lizenz, Assistent (I3-T12-01).

/** „+49 30 555 018 42“ → „tel:+493055501842“; nationale Nummern („030 …“) bleiben national. */
export function telHref(nummer: string): string {
  const roh = nummer.trim();
  const ziffern = roh.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return `tel:${ziffern}`;
}

/**
 * Telefonnummern in einem Text: international („+49 30 555 018 42“) oder national mit Vorwahl („030 555 018 42“).
 * Aktenzeichen, Beträge und Datumsangaben passen nicht (Punkt, Komma, keine führende 0 bzw. +).
 */
export const TELEFON_MUSTER = /(\+\d{2}[\d\s/-]{6,}\d|\b0\d{2,5}[\s/-]\d[\d\s/-]{3,}\d)/g;

/** Zerlegt Text in Teile mit und ohne Telefonnummer (für die Darstellung als Link). */
export function telefonTeile(text: string): { t: string; tel?: string }[] {
  const out: { t: string; tel?: string }[] = [];
  let letzte = 0;
  for (const m of text.matchAll(TELEFON_MUSTER)) {
    const i = m.index ?? 0;
    if (i > letzte) out.push({ t: text.slice(letzte, i) });
    out.push({ t: m[0], tel: telHref(m[0]) });
    letzte = i + m[0].length;
  }
  if (letzte < text.length) out.push({ t: text.slice(letzte) });
  return out;
}

// Kopieren in die Zwischenablage – mit Rückfallebenen für eingebettete Ansichten ohne Clipboard-Berechtigung.

export type KopierErgebnis = "kopiert" | "markiert" | "fehler";

/** Markiert den Text eines Elements, damit Nutzer ihn selbst kopieren können (⌘C / Strg+C). */
export function markiereText(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  try {
    const sel = window.getSelection();
    if (!sel) return false;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kopiert Text. Reihenfolge: Clipboard-API → execCommand mit verstecktem Textfeld → Text im Element markieren.
 * Gibt zurück, was tatsächlich passiert ist, damit die Oberfläche ehrlich rückmelden kann.
 */
export async function kopiereText(text: string, fallbackEl?: HTMLElement | null): Promise<KopierErgebnis> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "kopiert";
    }
  } catch {
    /* weiter mit der nächsten Methode */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return "kopiert";
  } catch {
    /* weiter mit Markieren */
  }
  return markiereText(fallbackEl) ? "markiert" : "fehler";
}

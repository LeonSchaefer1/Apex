// Kopieren in die Zwischenablage – mit Rückfallebenen für eingebettete Ansichten ohne Clipboard-Berechtigung
// (z. B. Artefakt-Vorschau in einer Sandbox). Das Ergebnis sagt ehrlich, was tatsächlich passiert ist.

/** „kopiert“ = in der Zwischenablage · „markiert“ = Text ist markiert, Nutzer kopiert selbst (Strg/⌘+C) · „fehler“ = nichts ging. */
export type KopierErgebnis = "kopiert" | "markiert" | "fehler";

/** Markiert den Text eines Elements, damit Nutzer ihn selbst kopieren können (⌘C / Strg+C). */
export function markiereText(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  try {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.focus();
      el.select();
      return true;
    }
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

/** Sperrt die Permissions Policy der Einbettung die Clipboard-API, gleich den Rückfall nehmen (spart einen Konsolenfehler). */
function clipboardErlaubt(): boolean {
  try {
    const d = document as Document & { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } };
    const policy = d.permissionsPolicy ?? d.featurePolicy;
    return policy ? policy.allowsFeature("clipboard-write") : true;
  } catch {
    return true;
  }
}

/** Alter Weg über ein verstecktes Textfeld und execCommand("copy") – funktioniert oft auch ohne Clipboard-API-Freigabe. */
function kopiereUeberTextfeld(text: string): boolean {
  const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const ta = document.createElement("textarea");
  try {
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.tabIndex = -1;
    Object.assign(ta.style, { position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none", fontSize: "16px" });
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
    // Fokus zurück auf den auslösenden Knopf (Tastaturbedienung)
    try {
      vorher?.focus({ preventScroll: true });
    } catch {
      /* egal */
    }
  }
}

/**
 * Kopiert Text. Reihenfolge: Clipboard-API → execCommand mit verstecktem Textfeld → Text im Element markieren.
 * Gibt zurück, was tatsächlich passiert ist, damit die Oberfläche ehrlich rückmelden kann
 * (bei „markiert“ z. B. „Text markiert – jetzt Strg/⌘+C“).
 */
export async function kopiereText(text: string, fallbackEl?: HTMLElement | null): Promise<KopierErgebnis> {
  try {
    if (navigator.clipboard?.writeText && clipboardErlaubt()) {
      await navigator.clipboard.writeText(text);
      return "kopiert";
    }
  } catch {
    /* weiter mit der nächsten Methode */
  }
  if (kopiereUeberTextfeld(text)) return "kopiert";
  return markiereText(fallbackEl) ? "markiert" : "fehler";
}

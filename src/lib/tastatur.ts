// Tastaturkürzel: gemeinsame Regeln für alle globalen Handler (Rahmen und Fachseiten).
// Einzeltasten-Kürzel (W, F, Z, ?, Posteingang J/K/Enter/U/E) lassen sich abschalten (WCAG 2.1.4 „Zeichentasten-Kürzel“);
// die Alt-Varianten (Alt+W, Alt+F, Alt+Z) wirken immer – auch bei abgeschalteten Einzeltasten und in Eingabefeldern.
import { useUI } from "@/store/ui";
import { useSession } from "@/store/session";

/** Liegt das Element in einem Eingabefeld (input, textarea, select, contenteditable, Kombifeld)? */
export function istEingabeElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.closest("[contenteditable]:not([contenteditable='false'])")) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.closest("[role='combobox'], [cmdk-input]");
}

/** Ist gerade ein Dialog, Seitenpanel, Menü, die Suche, der Assistent oder die Sperre offen? Dann ruhen globale Kürzel. */
export function dialogOffen(): boolean {
  const ui = useUI.getState();
  if (ui.paletteOffen || ui.assistentOffen || ui.wiedervorlage || ui.zeiterfassung || ui.kuerzelOffen) return true;
  if (useSession.getState().gesperrt) return true;
  return typeof document !== "undefined" && !!document.querySelector('[aria-modal="true"], [role="menu"]');
}

/**
 * Darf ein Kürzel aus einer einzelnen Taste (ohne Strg/Alt/⌘) jetzt auslösen?
 * Nein, wenn die Einstellung „Kürzel mit einzelnen Buchstaben“ aus ist, eine Zusatztaste gedrückt ist,
 * der Fokus in einem Eingabefeld liegt oder ein Dialog offen ist.
 */
export function einzeltasteErlaubt(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.isComposing) return false;
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (!useUI.getState().einzeltastenKuerzel) return false;
  if (istEingabeElement(e.target) || istEingabeElement(typeof document !== "undefined" ? document.activeElement : null)) return false;
  return !dialogOffen();
}

/**
 * Alt-Kürzel (Alt+W, Alt+F, Alt+Z …): liefert den Buchstaben in Kleinschreibung, sonst `null`.
 * Wertet `e.code` aus, weil Alt auf dem Mac Sonderzeichen erzeugt (Alt+W = „∑“). AltGr (Strg+Alt) zählt nicht.
 * Wirkt unabhängig von der Einstellung und auch in Eingabefeldern – nur nicht, solange ein Dialog offen ist.
 */
export function altKuerzel(e: KeyboardEvent): string | null {
  if (e.defaultPrevented || e.isComposing || !e.altKey || e.ctrlKey || e.metaKey) return null;
  const m = /^Key([A-Z])$/.exec(e.code ?? "");
  if (!m) return null;
  if (dialogOffen()) return null;
  return m[1].toLowerCase();
}

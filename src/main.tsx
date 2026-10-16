import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { applyTheme, useUI } from "./store/ui";

// Eingebettete Ansichten (Artefakt) liefern ein eigenes Gerüst ohne <html lang> – für Vorlesen, Silbentrennung und Rechtschreibprüfung.
if (!document.documentElement.lang) document.documentElement.lang = "de";

applyTheme(useUI.getState().theme);
document.documentElement.setAttribute("data-density", useUI.getState().dichte);
formulareInSandboxErmoeglichen();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * In einer Sandbox ohne „allow-forms“ verwirft der Browser jede Formular-Absendung, noch bevor das submit-Ereignis
 * feuert – Anmelden, „Senden“ im Assistenten und Dialog-Formulare reagierten dann nicht. Erkennung ohne Probe:
 * Bleibt nach einem Absende-Klick (oder Enter) das submit-Ereignis aus, obwohl das Formular gültig ist, lösen wir es
 * selbst aus und tun das ab dann direkt. Alle Formulare der App verhindern die echte Absendung per preventDefault.
 */
function formulareInSandboxErmoeglichen() {
  let blockiert = false;
  let absendungen = 0;
  window.addEventListener("submit", () => absendungen++, true);

  const istAbsendeKnopf = (el: Element | null): el is HTMLButtonElement | HTMLInputElement =>
    (el instanceof HTMLButtonElement && el.type === "submit") || (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "image"));
  const gueltig = (form: HTMLFormElement, knopf: HTMLButtonElement | HTMLInputElement | null) => form.noValidate || !!knopf?.formNoValidate || form.checkValidity();

  const absenden = (form: HTMLFormElement, knopf: HTMLButtonElement | HTMLInputElement | null) => {
    if (!form.noValidate && !knopf?.formNoValidate && !form.reportValidity()) return;
    const ev = typeof SubmitEvent === "function" ? new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: knopf }) : new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
  };
  const pruefeNachher = (form: HTMLFormElement, knopf: HTMLButtonElement | HTMLInputElement | null) => {
    const vorher = absendungen;
    setTimeout(() => {
      if (blockiert || absendungen !== vorher || !form.isConnected || !gueltig(form, knopf)) return;
      blockiert = true;
      absenden(form, knopf);
    }, 0);
  };

  // Bubble-Phase am window: React-Handler (onClick mit preventDefault) haben dann bereits entschieden.
  // Enter in einem Feld mit Absende-Knopf löst ebenfalls einen Klick auf diesen Knopf aus.
  window.addEventListener("click", (e) => {
    if (e.defaultPrevented) return;
    const knopf = (e.target as Element | null)?.closest?.("button, input") ?? null;
    if (!istAbsendeKnopf(knopf) || knopf.disabled || !knopf.form) return;
    if (!blockiert) return pruefeNachher(knopf.form, knopf);
    e.preventDefault(); // blockierte Absendung samt Konsolenfehler vermeiden
    absenden(knopf.form, knopf);
  });

  // Enter in einem Formular ohne Absende-Knopf (implizites Absenden ohne Klick)
  const OHNE_ENTER = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.key !== "Enter" || e.isComposing) return;
    const feld = e.target;
    if (!(feld instanceof HTMLInputElement) || OHNE_ENTER.has(feld.type) || !feld.form) return;
    const form = feld.form;
    const elemente = Array.from(form.elements);
    if (elemente.some((el) => istAbsendeKnopf(el))) return;
    if (elemente.filter((el) => el instanceof HTMLInputElement && !OHNE_ENTER.has(el.type)).length !== 1) return;
    if (!blockiert) return pruefeNachher(form, null);
    e.preventDefault();
    absenden(form, null);
  });
}

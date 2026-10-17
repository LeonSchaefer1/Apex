import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/** Offener Dialog im Stapel: Art (zentriertes Modal oder Seitenpanel rechts) und sein Element – z. B. für die Lage der Meldungen. */
export interface OffenerDialog {
  id: number;
  art: "modal" | "drawer";
  el: () => HTMLElement | null;
  /** Schließt den Dialog wie Escape bzw. „Schließen“ (Fokus kehrt zum Auslöser zurück). */
  schliessen: () => void;
  /** Element, das beim Öffnen den Fokus hatte (Auslöser) – z. B. für die Rückkehr nach Strg+K. */
  ausloeser: HTMLElement | null;
}

/** Stapel offener Dialoge (Modal, Drawer) – z. B. damit die schwebende Tab-Leiste dahinter verschwindet und Meldungen ausweichen. */
const useDialoge = create<{ stapel: OffenerDialog[] }>(() => ({ stapel: [] }));
let naechsterDialog = 1;
function useDialogZaehlung(open: boolean, art: OffenerDialog["art"], ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const schliessen = useRef(onClose);
  useEffect(() => {
    schliessen.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const id = naechsterDialog++;
    const akt = typeof document !== "undefined" ? document.activeElement : null;
    const ausloeser = akt instanceof HTMLElement && akt !== document.body ? akt : null;
    useDialoge.setState((s) => ({ stapel: [...s.stapel, { id, art, el: () => ref.current, schliessen: () => schliessen.current(), ausloeser }] }));
    return () => useDialoge.setState((s) => ({ stapel: s.stapel.filter((d) => d.id !== id) }));
  }, [open, art, ref]);
}
export const useDialogOffen = () => useDialoge((s) => s.stapel.length > 0);
/** Der zuoberst liegende offene Dialog (oder undefined). */
export const useObersterDialog = () => useDialoge((s) => s.stapel[s.stapel.length - 1]);
/** Der zuoberst liegende offene Dialog – außerhalb von React (z. B. in Tastatur-Handlern). */
export const obersterDialog = (): OffenerDialog | undefined => useDialoge.getState().stapel[useDialoge.getState().stapel.length - 1];

/** Texteingaben, deren Inhalt beim Schließen verloren ginge (Auswahllisten und Schalter zählen nicht). */
const TEXTFELD = 'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="number"], input[type="tel"], input[type="url"], input[type="password"], input[type="date"], input[type="time"], input[type="datetime-local"]';

/**
 * Reine Ansicht (Dokumentvorschau, Entscheidung, Kontaktansicht): kein sichtbares Texteingabefeld – oder ausdrücklich
 * mit `ansicht` markiert. Strg+K darf sie wie Escape schließen; Dialoge mit Eingaben bleiben offen (I3-T06-03).
 */
export function istReineAnsicht(el: HTMLElement): boolean {
  if (el.dataset.ansicht === "true") return true;
  if (el.dataset.ansicht === "false") return false;
  return !Array.from(el.querySelectorAll<HTMLElement>(TEXTFELD)).some((f) => f.getClientRects().length > 0 && !(f as HTMLInputElement).disabled && !(f as HTMLInputElement).readOnly);
}

/**
 * Ebenen-Stapel für Escape: Dialoge, Seitenpanels und Menüs melden sich beim Öffnen an. Escape schließt nur die
 * zuletzt geöffnete Ebene – ein Auskunftsdialog über dem Kontakt-Drawer schließt allein, der Drawer bleibt offen.
 */
let ebenen: number[] = [];
let naechsteEbene = 1;
export function useEscEbene(open: boolean, onClose: () => void) {
  const schliessen = useRef(onClose);
  useEffect(() => {
    schliessen.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const id = naechsteEbene++;
    ebenen.push(id);
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || ebenen[ebenen.length - 1] !== id) return;
      // Der Stapel ändert sich erst nach diesem Tastendruck – darunterliegende Ebenen reagieren im selben Ereignis nicht.
      e.preventDefault();
      schliessen.current();
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      ebenen = ebenen.filter((x) => x !== id);
    };
  }, [open]);
}
const useEsc = useEscEbene;

/**
 * Fokusfalle für Modal und Drawer (WCAG 2.4.3, 2.4.11): Tab und Umschalt+Tab bleiben im obersten Dialog, der App-Hintergrund
 * (`#app-inhalt`) und tiefer liegende Dialoge sind solange inert. Beim Schließen kehrt der Fokus auf das auslösende Element zurück.
 */
let fallen: { id: number; el: () => HTMLElement | null }[] = [];
let naechsteFalle = 1;
/** Sperrbildschirm aktiv: Fokusfallen ruhen, alle Dialoge sind inert, der App-Rahmen bleibt für die Entsperrung bedienbar. */
let pausiert = false;

/** Vom App-Rahmen beim Sperren und Entsperren aufgerufen (Sperrbildschirm liegt über offenen Dialogen). */
export function pausiereDialoge(an: boolean) {
  if (pausiert === an) return;
  pausiert = an;
  aktualisiereHintergrund();
}

const FOKUSSIERBAR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls]';

/** Per Tab erreichbare Elemente eines Dialogs in Dokumentreihenfolge (sichtbar, nicht deaktiviert, nicht inert). */
export function fokussierbareIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOKUSSIERBAR)).filter((el) => {
    if (el.tabIndex < 0 || el.closest("[inert]") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.getClientRects().length === 0) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  });
}

function setzeInert(el: Element | null | undefined, an: boolean) {
  if (!el) return;
  if (an) el.setAttribute("inert", "");
  else el.removeAttribute("inert");
}

/** Hintergrund und tiefer liegende Dialoge inert setzen – nur der oberste Dialog bleibt bedienbar. */
function aktualisiereHintergrund() {
  if (typeof document === "undefined") return;
  setzeInert(document.getElementById("app-inhalt"), fallen.length > 0 && !pausiert);
  fallen.forEach((f, i) => setzeInert(f.el()?.parentElement, pausiert || i < fallen.length - 1));
}

function useFokusfalle(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const id = naechsteFalle++;
    const ausloeser = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    fallen.push({ id, el: () => ref.current });
    aktualisiereHintergrund();
    // Gestapelt (z. B. Schnellhilfe über einem Dialog): die neue Ebene liegt auch sichtbar oben.
    const huelle = ref.current?.parentElement;
    if (huelle && fallen.length > 1) huelle.style.zIndex = String(80 + fallen.length * 2);
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.defaultPrevented || pausiert || fallen[fallen.length - 1]?.id !== id) return;
      const root = ref.current;
      if (!root) return;
      const liste = fokussierbareIn(root);
      const akt = document.activeElement as HTMLElement | null;
      const drin = !!akt && root.contains(akt);
      if (liste.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const erstes = liste[0];
      const letztes = liste[liste.length - 1];
      if (e.shiftKey) {
        if (!drin || akt === erstes || akt === root) {
          e.preventDefault();
          letztes.focus();
        }
      } else if (!drin || akt === letztes) {
        e.preventDefault();
        erstes.focus();
      }
    };
    // Fokus, der den obersten Dialog verlässt (z. B. per Klick auf eine Meldung bleibt erlaubt), wird nur aus dem inerten Hintergrund zurückgeholt.
    const zurueck = (e: FocusEvent) => {
      if (pausiert || fallen[fallen.length - 1]?.id !== id) return;
      const root = ref.current;
      const ziel = e.target as Node | null;
      if (!root || !ziel || root.contains(ziel)) return;
      if (document.getElementById("app-inhalt")?.contains(ziel)) (fokussierbareIn(root)[0] ?? root).focus();
    };
    document.addEventListener("keydown", h, true);
    document.addEventListener("focusin", zurueck, true);
    return () => {
      document.removeEventListener("keydown", h, true);
      document.removeEventListener("focusin", zurueck, true);
      const root = ref.current;
      const fokusImDialog = !document.activeElement || document.activeElement === document.body || (!!root && root.contains(document.activeElement));
      fallen = fallen.filter((f) => f.id !== id);
      aktualisiereHintergrund();
      // Fokus zurück auf das auslösende Element – sofern es noch da ist und der Fokus nicht bewusst woanders hin gewandert ist.
      if (fokusImDialog && ausloeser && ausloeser.isConnected && !ausloeser.closest("[inert]")) ausloeser.focus({ preventScroll: true });
    };
  }, [open, ref]);
}

/** Erstes Fokusziel: Element mit `data-autofocus` (auch Eingabefelder) vor dem ersten Eingabefeld, sonst `fallback`. */
function setzeAnfangsfokus(root: HTMLElement | null, mitEingabe: boolean) {
  if (!root) return;
  const markiert = Array.from(root.querySelectorAll<HTMLElement>("[data-autofocus]")).find((el) => el.getClientRects().length > 0 && !(el as HTMLButtonElement).disabled);
  if (markiert) return markiert.focus();
  // Schon per autoFocus im Dialog gelandet? Dann bleibt der Fokus dort.
  const akt = document.activeElement;
  if (akt && akt !== root && root.contains(akt)) return;
  const feld = mitEingabe
    ? Array.from(root.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([disabled]),textarea:not([disabled]),select:not([disabled])")).find((el) => el.getClientRects().length > 0)
    : undefined;
  (feld ?? root.querySelector<HTMLElement>("[data-dialog-inhalt]") ?? root).focus();
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = "md", icon, ansicht }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; icon?: ReactNode; /** reine Ansicht (true) bzw. Eingabedialog (false) – sonst nach Eingabefeldern bestimmt */ ansicht?: boolean }) {
  useEsc(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useDialogZaehlung(open, "modal", ref, onClose);
  useFokusfalle(open, ref);
  const titelId = useId();
  useEffect(() => {
    // Fokus in den Dialog: markiertes Element (data-autofocus), sonst erstes Eingabefeld, sonst der Inhaltsbereich
    if (!open) return;
    const t = setTimeout(() => setzeAnfangsfokus(ref.current, true), 60);
    return () => clearTimeout(t);
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titelId}
            data-ansicht={ansicht === undefined ? undefined : String(ansicht)}
            tabIndex={-1}
            initial={{ opacity: 0, y: 40, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] outline-none sm:rounded-[28px]",
              size === "sm" && "sm:max-w-md",
              size === "md" && "sm:max-w-xl",
              size === "lg" && "sm:max-w-3xl",
              size === "xl" && "sm:max-w-5xl",
            )}
            style={{ boxShadow: "var(--glass-shadow-lg)" }}
          >
            <div className="flex items-start gap-3 px-6 pb-3 pt-5">
              {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 id={titelId} className="title-lg">{title}</h2>
                {subtitle && <p className="mt-1 text-[13px] text-fg-3">{subtitle}</p>}
              </div>
              <button aria-label="Schließen" onClick={onClose} className="icon-btn -mr-2 -mt-1">
                <X className="size-[18px]" />
              </button>
            </div>
            <div tabIndex={0} data-dialog-inhalt className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560, icon, ansicht }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; icon?: ReactNode; /** reine Ansicht (true) bzw. Eingabedialog (false) – sonst nach Eingabefeldern bestimmt */ ansicht?: boolean }) {
  useEsc(open, onClose);
  const ref = useRef<HTMLElement>(null);
  useDialogZaehlung(open, "drawer", ref, onClose);
  useFokusfalle(open, ref);
  const titelId = useId();
  useEffect(() => {
    // Fokus ins Seitenpanel: markiertes Element (data-autofocus), sonst der Inhaltsbereich
    if (!open) return;
    const t = setTimeout(() => setzeAnfangsfokus(ref.current, false), 60);
    return () => clearTimeout(t);
  }, [open]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75]">
          <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titelId}
            data-ansicht={ansicht === undefined ? undefined : String(ansicht)}
            tabIndex={-1}
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="glass-strong absolute bottom-2 right-2 top-2 flex w-[calc(100%-16px)] flex-col overflow-hidden rounded-[28px] outline-none"
            style={{ maxWidth: width, boxShadow: "var(--glass-shadow-lg)" }}
          >
            <div className="flex items-start gap-3 px-6 pb-3 pt-5">
              {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 id={titelId} className="title-lg">{title}</h2>
                {subtitle && <p className="mt-1 text-[13px] text-fg-3">{subtitle}</p>}
              </div>
              <button aria-label="Schließen" onClick={onClose} className="icon-btn -mr-2 -mt-1">
                <X className="size-[18px]" />
              </button>
            </div>
            <div tabIndex={0} data-dialog-inhalt className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-6 py-4">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Bestätigungsdialog (ersetzt window.confirm, das in eingebetteten Ansichten nicht verfügbar ist)
interface ConfirmReq {
  titel: string;
  text?: string;
  bestaetigen?: string;
  /** Beschriftung des Abbrechen-Knopfs (Standard „Abbrechen“), z. B. „Weiter bearbeiten“. */
  abbrechen?: string;
  gefahr?: boolean;
  resolve: (ok: boolean) => void;
}
const useConfirmStore = create<{ req: ConfirmReq | null; set: (r: ConfirmReq | null) => void }>((set) => ({ req: null, set: (req) => set({ req }) }));

export function confirmDialog(opts: Omit<ConfirmReq, "resolve">): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  const close = (ok: boolean) => {
    req?.resolve(ok);
    set(null);
  };
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.titel ?? ""}
      size="sm"
      footer={
        <>
          {/* Einheitlich in allen Rückfragen (I5-T07-02): Anfangsfokus auf der sicheren Wahl („Abbrechen“ bzw. opts.abbrechen),
              der Bestätigungsknopf ist der nächste Tab-Stopp. Damit gilt überall: Enter = abbrechen, Tab + Enter = bestätigen. */}
          <Button data-autofocus variant="ghost" onClick={() => close(false)}>
            {req?.abbrechen ?? "Abbrechen"}
          </Button>
          <Button variant={req?.gefahr ? "danger" : "primary"} onClick={() => close(true)}>
            {req?.bestaetigen ?? "Bestätigen"}
          </Button>
        </>
      }
    >
      {req?.text && <p className="text-[14px] text-fg-2">{req.text}</p>}
    </Modal>
  );
}

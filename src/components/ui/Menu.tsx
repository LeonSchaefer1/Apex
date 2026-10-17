import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useEscEbene } from "./Modal";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: ReactNode;
  /** Gesperrt: sichtbar und vorlesbar (Grund in `hint` bzw. `title`), aber ohne Wirkung. */
  disabled?: boolean;
  /** Tooltip, z. B. der Grund einer Sperre */
  title?: string;
  /** Umschalter (z. B. Spalte sichtbar): wird als `menuitemcheckbox` mit `aria-checked` angesagt. */
  checked?: boolean;
  /** Menü bleibt nach dem Klick offen (z. B. mehrere Spalten nacheinander ein- und ausblenden). */
  offenLassen?: boolean;
}

/** Lage des Popovers am Bildschirm (position: fixed) – gemessen am Auslöser. */
interface Lage {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxHoehe: number;
  nachOben: boolean;
}

const RAND = 8;
const ABSTAND = 8;

/**
 * Kontextmenü als Glas-Popover in eigener Ebene (Portal in `document.body`, position: fixed): Es wird von keinem Container mit
 * `overflow: hidden` abgeschnitten und liegt über Kopfleiste, Kacheln und offenen Dialogen (I3-T16-01). Es öffnet nach unten;
 * nach oben nur, wenn es dort vollständig passt – sonst scrollt es in sich. Beim Scrollen und bei Größenänderung wandert es mit
 * dem Auslöser (verschwindet der Auslöser aus dem Bild, schließt es). Pfeiltasten, Pos1/Ende, Escape und Tab wie bei Menüs üblich.
 */
export function Menu({ trigger, items, align = "end", className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: (MenuItem | "sep")[]; align?: "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  const [lage, setLage] = useState<Lage | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const innenRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  /** Öffnung per Tastatur: Fokus aufs erste Element; per Maus/Touch ebenfalls ins Menü, damit Pfeiltasten sofort gehen. */
  const imDialog = useRef(false);

  const schliessen = useCallback((fokusZurueck = true) => {
    setOpen(false);
    setLage(null);
    if (!fokusZurueck) return;
    // Fokus zurück auf den Auslöser, wenn er im Menü lag (Escape, Auswahl, Tab)
    const akt = document.activeElement;
    if (!akt || akt === document.body || menuRef.current?.contains(akt)) {
      const knopf = ref.current?.querySelector<HTMLElement>("button, [tabindex], a[href]");
      knopf?.focus({ preventScroll: true });
    }
  }, []);

  /** Misst Auslöser und Menüinhalt und legt Richtung und Höhe fest. */
  const platziere = useCallback(() => {
    const ausloeser = ref.current;
    const inhalt = innenRef.current;
    if (!ausloeser || !inhalt) return;
    const r = ausloeser.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    // Auslöser nicht mehr sichtbar (weggescrollt) → Menü schließen statt in der Luft zu hängen
    if (r.bottom < 0 || r.top > vh || r.width === 0) {
      schliessen(false);
      return;
    }
    const mobil = vw < 768;
    // Unten: mobil Tab-Leiste und schwebende Aktionsleisten; oben: Kopfleiste (im Dialog nur ein schmaler Rand)
    // Das Menü liegt über allen Ebenen (z-95) und darf deshalb auch über die Kopfleiste reichen.
    const untenFrei = mobil && !imDialog.current ? 160 : RAND;
    const obenFrei = mobil && !imDialog.current ? 64 : RAND;
    const unten = vh - r.bottom - untenFrei - ABSTAND;
    const oben = r.top - obenFrei - ABSTAND;
    const hoehe = Math.min(560, inhalt.scrollHeight + 2);
    let nachOben = false;
    if (unten >= hoehe) nachOben = false;
    else if (oben >= hoehe) nachOben = true; // passt oben vollständig
    else nachOben = oben > unten && unten < 200; // passt nirgends ganz: unten mit eigenem Scroll, außer dort ist kaum Platz
    const platz = nachOben ? oben : unten;
    const maxHoehe = Math.max(120, Math.min(560, Math.floor(platz)));
    const breite = Math.min(menuRef.current?.offsetWidth ?? 240, vw - 2 * RAND);
    const neu: Lage = { maxHoehe, nachOben };
    if (nachOben) neu.bottom = vh - r.top + ABSTAND;
    else neu.top = r.bottom + ABSTAND;
    if (align === "end") neu.right = Math.max(RAND, Math.min(vw - r.right, vw - breite - RAND));
    else neu.left = Math.max(RAND, Math.min(r.left, vw - breite - RAND));
    setLage((alt) =>
      alt && alt.top === neu.top && alt.bottom === neu.bottom && alt.left === neu.left && alt.right === neu.right && alt.maxHoehe === neu.maxHoehe && alt.nachOben === neu.nachOben ? alt : neu,
    );
  }, [align, schliessen]);

  const umschalten = () => {
    if (open) return schliessen();
    imDialog.current = !!ref.current?.closest('[role="dialog"]');
    setLage(null);
    setOpen(true);
  };

  // Vor dem ersten Zeichnen messen und platzieren (kein Springen); danach Fokus aufs erste wählbare Element
  useLayoutEffect(() => {
    if (!open) return;
    platziere();
  }, [open, platziere, items.length]);

  useEffect(() => {
    if (!open || !lage) return;
    if (menuRef.current?.contains(document.activeElement)) return;
    const erstes = menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ?? menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]');
    erstes?.focus({ preventScroll: true });
  }, [open, lage]);

  // Lage bei Scrollen (alle Scroll-Container) und Größenänderung nachführen
  useEffect(() => {
    if (!open) return;
    let rahmen = 0;
    const nachfuehren = (e?: Event) => {
      // Scrollen im Menü selbst verschiebt den Auslöser nicht
      if (e && e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      cancelAnimationFrame(rahmen);
      rahmen = requestAnimationFrame(platziere);
    };
    window.addEventListener("scroll", nachfuehren, true);
    window.addEventListener("resize", nachfuehren);
    return () => {
      cancelAnimationFrame(rahmen);
      window.removeEventListener("scroll", nachfuehren, true);
      window.removeEventListener("resize", nachfuehren);
    };
  }, [open, platziere]);

  // Klick außerhalb von Auslöser und Menü schließt
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent | MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      schliessen(false);
    };
    document.addEventListener("pointerdown", h, true);
    return () => document.removeEventListener("pointerdown", h, true);
  }, [open, schliessen]);

  // Tab verlässt das Menü: schließen und zurück zum Auslöser (vor der Fokusfalle offener Dialoge, daher Capture am Fenster)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !menuRef.current?.contains(document.activeElement)) return;
      e.preventDefault();
      schliessen();
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [open, schliessen]);

  // Escape schließt nur das Menü – ein Dialog darunter bleibt offen (gemeinsamer Ebenen-Stapel mit Modal und Drawer).
  useEscEbene(open, () => schliessen());

  const pfeile = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const liste = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []).filter((el) => el.getAttribute("aria-disabled") !== "true");
    if (!liste.length) return;
    const i = liste.indexOf(document.activeElement as HTMLElement);
    let ziel: HTMLElement | undefined;
    if (e.key === "ArrowDown") ziel = liste[(i + 1) % liste.length];
    else if (e.key === "ArrowUp") ziel = liste[(i - 1 + liste.length) % liste.length];
    else if (e.key === "Home") ziel = liste[0];
    else if (e.key === "End") ziel = liste[liste.length - 1];
    if (!ziel) return;
    e.preventDefault();
    ziel.focus();
  };

  return (
    // aria-owns: Das Menü liegt im DOM in document.body, gehört für Screenreader aber hierher – auch in Dialogen mit aria-modal
    <div ref={ref} className={cn("relative inline-block", className)} aria-owns={open ? menuId : undefined}>
      {trigger({ open, toggle: umschalten })}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                id={menuId}
                initial={{ opacity: 0, scale: 0.92, y: lage?.nachOben ? 6 : -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: lage?.nachOben ? 4 : -4 }}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
                style={{
                  transformOrigin: `${lage?.nachOben ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`,
                  top: lage ? lage.top : 0,
                  bottom: lage?.bottom,
                  left: lage ? lage.left : 0,
                  right: lage?.right,
                  // bis zur ersten Messung unsichtbar (kein Aufblitzen an falscher Stelle)
                  visibility: lage ? undefined : "hidden",
                }}
                className="glass-strong glass-menu fixed z-[95] min-w-[220px] max-w-[calc(100vw-16px)] rounded-[18px]"
                role="menu"
                onKeyDown={pfeile}
              >
                <div
                  ref={innenRef}
                  className="overflow-y-auto overscroll-contain rounded-[inherit] p-1.5"
                  style={{ maxHeight: lage ? `min(72dvh, ${lage.maxHoehe}px)` : "min(72dvh, 560px)" }}
                >
                  {items.map((it, i) =>
                    it === "sep" ? (
                      <div key={i} role="separator" className="my-1 h-px bg-[var(--line)]" />
                    ) : (
                      <button
                        key={i}
                        role={it.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                        aria-checked={it.checked === undefined ? undefined : it.checked}
                        type="button"
                        tabIndex={-1}
                        aria-disabled={it.disabled || undefined}
                        title={it.title}
                        onClick={() => {
                          if (it.disabled) return;
                          if (!it.offenLassen) schliessen();
                          it.onClick();
                        }}
                        className={cn(
                          "flex min-h-[44px] w-full items-center sm:min-h-[36px] gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13.5px] transition-colors focus-visible:bg-ink-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
                          it.disabled ? "cursor-not-allowed text-fg-3" : cn("hover:bg-ink-softer", it.danger ? "text-seal" : "text-fg"),
                        )}
                      >
                        {it.icon && <span className="text-fg-3 [&>svg]:size-4">{it.icon}</span>}
                        <span className="flex-1">{it.label}</span>
                        {it.hint && <span className="text-[12.5px] text-fg-3">{it.hint}</span>}
                      </button>
                    ),
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

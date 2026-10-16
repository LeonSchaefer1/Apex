import { useEffect, useRef, useState, type ReactNode } from "react";
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
}

/** Kontextmenü als Glas-Popover. */
export function Menu({ trigger, items, align = "end", className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: (MenuItem | "sep")[]; align?: "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  // Nach oben öffnen, wenn unten zu wenig Platz ist – mobil liegen Tab-Leiste und schwebende Aktionsleisten über dem Inhalt
  const [nachOben, setNachOben] = useState(false);
  const [maxHoehe, setMaxHoehe] = useState<number | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);
  const umschalten = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const reserviert = window.innerWidth < 768 ? 160 : 16;
      const unten = window.innerHeight - r.bottom - reserviert;
      const oben = r.top - 80; // unter der Kopfleiste bleiben
      const hoehe = Math.min(560, window.innerHeight * 0.72, items.reduce((h, it) => h + (it === "sep" ? 9 : 40), 12));
      const flip = unten < hoehe && oben > unten;
      setNachOben(flip);
      // passt das Menü auf keiner Seite ganz, scrollt es in sich (statt aus dem Bild zu ragen)
      setMaxHoehe(Math.max(160, Math.min(560, (flip ? oben : unten) - 8)));
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  // Escape schließt nur das Menü – ein Dialog darunter bleibt offen (gemeinsamer Ebenen-Stapel mit Modal und Drawer).
  useEscEbene(open, () => setOpen(false));
  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      {trigger({ open, toggle: umschalten })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: nachOben ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: nachOben ? 4 : -4 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            style={{ transformOrigin: `${nachOben ? "bottom" : "top"} ${align === "end" ? "right" : "left"}` }}
            className={cn("glass-strong glass-menu absolute z-50 min-w-[220px] rounded-[18px]", nachOben ? "bottom-full mb-2" : "mt-2", align === "end" ? "right-0" : "left-0")}
            role="menu"
          >
            <div className="max-h-[min(72dvh,560px)] overflow-y-auto overscroll-contain rounded-[inherit] p-1.5" style={maxHoehe ? { maxHeight: `min(72dvh, ${maxHoehe}px)` } : undefined}>
              {items.map((it, i) =>
                it === "sep" ? (
                  <div key={i} className="my-1 h-px bg-[var(--line)]" />
                ) : (
                  <button
                    key={i}
                    role="menuitem"
                    type="button"
                    aria-disabled={it.disabled || undefined}
                    title={it.title}
                    onClick={() => {
                      if (it.disabled) return;
                      setOpen(false);
                      it.onClick();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13.5px] transition-colors",
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
      </AnimatePresence>
    </div>
  );
}

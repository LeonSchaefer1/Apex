import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: ReactNode;
}

/** Kontextmenü als Glas-Popover. */
export function Menu({ trigger, items, align = "end", className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: (MenuItem | "sep")[]; align?: "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={cn("glass-strong absolute z-50 mt-2 min-w-[220px] rounded-[18px] p-1.5", align === "end" ? "right-0" : "left-0")}
            role="menu"
          >
            {items.map((it, i) =>
              it === "sep" ? (
                <div key={i} className="my-1 h-px bg-[var(--line)]" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                  className={cn("flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-ink-softer", it.danger ? "text-seal" : "text-fg")}
                >
                  {it.icon && <span className="text-fg-3 [&>svg]:size-4">{it.icon}</span>}
                  <span className="flex-1">{it.label}</span>
                  {it.hint && <span className="text-[11.5px] text-fg-4">{it.hint}</span>}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

/**
 * Segmentierte Auswahl mit gleitendem Glas-Indikator. `wrap`: Segmente brechen bei schmalen Breiten (360 px) in eine
 * zweite Zeile um, statt seitlich zu scrollen bzw. abgeschnitten zu werden. `mobilGross`: auf Telefonen (< 640 px) 44 px hohe
 * Segmente – Trefferfläche für den Daumen (WCAG 2.5.5), z. B. Reiter der Akte.
 */
export function Segmented<T extends string>({ options, value, onChange, size = "md", className, full, wrap, mobilGross }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; className?: string; full?: boolean; wrap?: boolean; mobilGross?: boolean }) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex max-w-full items-center gap-0.5 bg-[var(--ink-softer)] p-1 shadow-[inset_0_0_0_1px_var(--line)]",
        wrap ? "flex-wrap rounded-[18px]" : "overflow-x-auto rounded-full no-scrollbar",
        full && "flex w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors",
              // Trefferfläche mindestens 24 × 24 px (WCAG 2.5.8), auch bei kurzen Beschriftungen
              size === "sm" ? "h-7 min-w-7 px-3 text-[12.5px]" : "h-8 min-w-8 px-3.5 text-[13px]",
              mobilGross && "max-sm:h-11 max-sm:min-w-11",
              full && "flex-1",
              active ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-full bg-[var(--glass-strong)] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_2px_10px_-2px_rgba(20,30,80,0.18),0_0_0_1px_var(--line)]"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            {o.icon}
            {o.label}
            {o.count !== undefined && <span className={cn("num rounded-full px-1.5 text-[12px]", active ? "bg-ink-soft text-ink" : "bg-[var(--line)] text-fg-3")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

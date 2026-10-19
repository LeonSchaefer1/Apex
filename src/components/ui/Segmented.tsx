import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

/**
 * Segmentierte Auswahl (DESIGN-SYSTEM.md 12.5): Behälter Fläche 2 mit 1-px-Linie, Radius 6; aktives Segment als Fläche mit Rand in
 * Linie stark und Schrift 600 – der Indikator gleitet in 150 ms ohne Feder. `wrap`: Segmente brechen bei schmalen Breiten (360 px)
 * in eine zweite Zeile um, statt seitlich zu scrollen bzw. abgeschnitten zu werden. `mobilGross`: auf Telefonen (< 640 px) 44 px hohe
 * Segmente – Trefferfläche für den Daumen (WCAG 2.5.5), z. B. Reiter der Akte.
 */
export function Segmented<T extends string>({ options, value, onChange, size = "md", className, full, wrap, mobilGross }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; className?: string; full?: boolean; wrap?: boolean; mobilGross?: boolean }) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex max-w-full items-center gap-0.5 rounded-md border border-[var(--line)] bg-[var(--surface-2)] p-0.5",
        wrap ? "flex-wrap" : "overflow-x-auto no-scrollbar",
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
              "relative z-0 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[13px] leading-[18px] transition-colors duration-100 focus-visible:outline-offset-[-2px] [&>svg]:size-3.5",
              // Trefferfläche mindestens 24 × 24 px (WCAG 2.5.8), auch bei kurzen Beschriftungen
              size === "sm" ? "h-6 min-w-6 px-2.5" : "h-7 min-w-7 px-3",
              mobilGross && "max-sm:h-11 max-sm:min-w-11",
              full && "flex-1",
              active ? "font-semibold text-fg" : "font-medium text-fg-3 hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-sm bg-[var(--surface)] shadow-[inset_0_0_0_1px_var(--line-strong)]"
                transition={BEWEGUNG.standard}
              />
            )}
            {o.icon}
            {o.label}
            {o.count !== undefined && <span className={cn("num text-[12px] font-medium", active ? "text-fg-2" : "text-fg-4")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

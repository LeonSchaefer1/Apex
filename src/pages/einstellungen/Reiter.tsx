import { useEffect, useId, useRef } from "react";
import { motion } from "motion/react";
import type { SegOption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";

/**
 * Reiter für Unterseiten (DESIGN-SYSTEM.md 12.5) – Einstellungen, Abrechnung, Apex KI: Textreiter 14/500 in Text 3, Linie unter der
 * ganzen Reihe, aktiv Text 1 / 600 mit 2-px-Unterstrich im Akzent (gleitet in 150 ms ohne Feder). Am Telefon waagerecht scrollbar
 * mit 44 px Trefferhöhe; der aktive Reiter wird in den sichtbaren Bereich geholt. Gleiche Gestalt wie die Reiter der Akte.
 */
export function Reiter<T extends string>({ options, value, onChange, className, label }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; className?: string; label?: string }) {
  const id = useId();
  const leiste = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = leiste.current;
    const el = box?.querySelector<HTMLElement>("[aria-selected=true]");
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    const links = el.offsetLeft - box.offsetLeft;
    if (links < box.scrollLeft || links + el.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollTo({ left: links - box.clientWidth / 2 + el.offsetWidth / 2 });
  }, [value]);
  return (
    <div
      ref={leiste}
      role="tablist"
      aria-label={label}
      className={cn("no-scrollbar -mx-4 flex min-w-0 gap-6 overflow-x-auto border-b border-[var(--line)] px-4 sm:mx-0 sm:px-0", className)}
    >
      {options.map((o) => {
        const aktiv = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={aktiv}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap text-[14px] transition-colors duration-100 focus-visible:outline-offset-[-2px] max-sm:h-11 [&>svg]:size-4 [&>svg]:text-fg-4",
              aktiv ? "font-semibold text-fg [&>svg]:!text-fg" : "font-medium text-fg-3 hover:text-fg",
            )}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined && <span className={cn("num text-[12px] font-medium", aktiv ? "text-fg-2" : "text-fg-4")}>{o.count}</span>}
            {aktiv && <motion.span layoutId={`reiter-${id}`} className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--ink)]" transition={BEWEGUNG.standard} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

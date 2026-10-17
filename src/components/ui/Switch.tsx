import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Ein/Aus-Schalter (iOS-Stil) – genau ein Tab-Stopp (I4-T03-01): Der Knopf trägt Rolle, Namen und Fokusrahmen; der Daumen ist
 * reine Darstellung (aria-hidden, nicht fokussierbar). Der Tipp-Effekt läuft per CSS (`:active`), nicht über `whileTap` –
 * motion macht Elemente mit Tipp-Geste sonst per tabindex="0" fokussierbar. `describedBy` verweist auf einen sichtbaren Hinweis
 * (z. B. fehlende Rechte) und landet als aria-describedby am Knopf.
 */
export function Switch({ checked, onChange, label, disabled, id, describedBy }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; id?: string; describedBy?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-300",
        checked ? "bg-[var(--green)]" : "bg-[var(--line-strong)]",
        disabled && "opacity-50",
      )}
    >
      <motion.span
        layout
        aria-hidden
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        className={cn(
          "pointer-events-none block h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.04)] transition-[width] duration-150",
          !disabled && "group-active:w-[32px]",
          checked ? "ml-auto" : "",
        )}
      />
    </button>
  );
}

import { cn } from "@/lib/cn";

/**
 * Ein/Aus-Schalter (DESIGN-SYSTEM.md 12.2) – genau ein Tab-Stopp (I4-T03-01): Der Knopf trägt Rolle, Namen und Fokusrahmen; der
 * Daumen ist reine Darstellung. 36 × 20 px; aus: Spur Linie stark, Daumen Fläche (3,5 : 1); an: Spur Akzent, Daumen Gegenfarbe.
 * Übergang 120 ms ohne Feder. Am Telefon vergrößert ein unsichtbares Polster die Trefferfläche auf 44 px. `describedBy` verweist auf
 * einen sichtbaren Hinweis (z. B. fehlende Rechte) und landet als aria-describedby am Knopf.
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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-[120ms] ease-[var(--ease-out)]",
        "max-sm:after:absolute max-sm:after:-inset-x-1 max-sm:after:-inset-y-3 max-sm:after:content-['']",
        checked ? "bg-[var(--ink)]" : "bg-[var(--line-strong)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-4 rounded-full transition-transform duration-[120ms] ease-[var(--ease-out)]",
          checked ? "translate-x-4 bg-[var(--on-ink)]" : "translate-x-0 bg-[var(--surface)]",
        )}
      />
    </button>
  );
}

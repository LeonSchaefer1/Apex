import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface KiSchritt {
  label: string;
  detail?: string;
  icon: ReactNode;
}

/**
 * Animierte KI-Pipeline: zeigt, was die KI gerade tut (z. B. Lesen → Typ erkennen → Akte zuordnen).
 * `aktiv` = Index des laufenden Schritts; `aktiv >= schritte.length` bedeutet: alles erledigt.
 */
export function KiSchritte({ schritte, aktiv, className, kompakt }: { schritte: KiSchritt[]; aktiv: number; className?: string; kompakt?: boolean }) {
  const fertig = Math.min(aktiv, schritte.length);
  const pct = schritte.length ? (fertig / schritte.length) * 100 + (aktiv < schritte.length ? 100 / schritte.length / 2 : 0) : 0;
  return (
    <div className={cn("min-w-0", className)} aria-live="polite">
      <div className="bar mb-3">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <ol className={cn("grid gap-1.5", !kompakt && "sm:auto-cols-fr sm:grid-flow-col sm:gap-2")}>
        {schritte.map((s, i) => {
          const done = i < aktiv;
          const active = i === aktiv;
          return (
            <li key={s.label} className="flex min-w-0 items-center gap-2.5 px-0.5 py-1.5">
              {/* Zustand in Form: erledigt = Haken, laufend = Akzent-Rand, offen = leise – ohne Puls (DESIGN-SYSTEM.md 10) */}
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-100 [&>svg]:size-3.5",
                  done && "border-[var(--line-strong)] text-fg-2",
                  active && "border-[var(--ink)] text-fg",
                  !done && !active && "border-[var(--line)] text-fg-4",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2} aria-hidden /> : s.icon}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-[13px]", active ? "font-semibold text-fg" : done ? "font-medium text-fg-2" : "font-medium text-fg-4")}>{s.label}</span>
                {s.detail && <span className="block truncate text-[13px] text-fg-4">{s.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Führt eine Aufgabe aus und lässt die Pipeline-Schritte mit Mindestdauer ablaufen,
 * damit die Animation lesbar bleibt (aber nie länger wartet als nötig).
 */
export function usePipeline(anzahl: number, msProSchritt = 520) {
  const [aktiv, setAktiv] = useState(-1);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearInterval(timer.current)), []);

  async function lauf<T>(aufgabe: () => Promise<T>): Promise<T> {
    if (timer.current) window.clearInterval(timer.current);
    setAktiv(0);
    let schritt = 0;
    timer.current = window.setInterval(() => {
      // letzter Schritt bleibt aktiv, bis die Aufgabe fertig ist
      schritt = Math.min(schritt + 1, anzahl - 1);
      setAktiv(schritt);
    }, msProSchritt);
    try {
      const [res] = await Promise.all([aufgabe(), new Promise((r) => setTimeout(r, msProSchritt * (anzahl - 1) + 260))]);
      return res;
    } finally {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      setAktiv(anzahl);
    }
  }

  return { aktiv, lauf, zuruecksetzen: () => setAktiv(-1) };
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
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
      <div className="bar mb-3 !h-1">
        <motion.span style={{ background: "linear-gradient(90deg, var(--ai-1), var(--ai-2), var(--ai-3))", transition: "none" }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
      </div>
      <ol className={cn("grid gap-1.5", !kompakt && "sm:auto-cols-fr sm:grid-flow-col sm:gap-2")}>
        {schritte.map((s, i) => {
          const done = i < aktiv;
          const active = i === aktiv;
          return (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 460, damping: 34 }}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-[14px] px-2.5 py-2 transition-colors duration-300",
                active && "bg-[var(--ink-softer)]",
              )}
            >
              <span
                className={cn(
                  "relative grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-300 [&>svg]:size-4",
                  done && "bg-green-soft text-green",
                  active && "ai-ring bg-[var(--surface)] text-violet",
                  !done && !active && "bg-[var(--ink-softer)] text-fg-4",
                )}
              >
                {done ? (
                  <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}>
                    <Check className="size-4" strokeWidth={2.6} />
                  </motion.span>
                ) : (
                  <motion.span animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={active ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } : undefined} className="grid place-items-center [&>svg]:size-4">
                    {s.icon}
                  </motion.span>
                )}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-[13px] font-semibold", active ? "ai-text" : done ? "text-fg" : "text-fg-3")}>{s.label}</span>
                {s.detail && <span className="block truncate text-[11.5px] text-fg-3">{s.detail}</span>}
              </span>
            </motion.li>
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

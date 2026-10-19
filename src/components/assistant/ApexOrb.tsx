import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useBewegungReduziert } from "@/lib/useBewegungReduziert";
import { MARKE_PFAD, MARKE_PUNKT } from "@/components/Logo";

export type OrbZustand = "ruhe" | "hoert" | "denkt" | "spricht";

/**
 * Der Apex-Assistent als Bildmarke im runden Knopf (DESIGN-SYSTEM.md 12.13): Kreis in Robenschwarz (dunkel: Papierweiß), darin die
 * Marke „Eckpunkt“ in der Gegenfarbe (40 % der Kreisgröße). Lebendig ist nur ihr Punkt – der Eckpunkt, an dem Apex zuhört und antwortet:
 * ruhe = steht still · hoert/spricht = skaliert mit dem Pegel (1 + 0,35 × pegel) · denkt = blendet ruhig zwischen 100 % und 35 %.
 * Bei „Bewegung reduzieren“ steht der Punkt immer; den Zustand nennt das Panel als Text.
 */
export function ApexOrb({ zustand = "ruhe", size = 48, pegel = 0, className }: { zustand?: OrbZustand; size?: number; pegel?: number; className?: string }) {
  const reduziert = useBewegungReduziert();
  const marke = Math.max(14, Math.round(size * (size >= 56 ? 0.4 : 0.42)));
  const lebt = !reduziert && zustand !== "ruhe";
  const skala = zustand === "hoert" || zustand === "spricht" ? 1 + 0.35 * Math.max(0, Math.min(1, pegel)) : 1;
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--on-ink)] shadow-pop", className)}
      style={{ width: size, height: size }}
      data-zustand={zustand}
      aria-hidden
    >
      <svg width={marke} height={marke} viewBox="0 0 32 32" fill="currentColor" focusable="false">
        <path d={MARKE_PFAD} />
        {lebt ? (
          <motion.circle
            cx={MARKE_PUNKT.cx}
            cy={MARKE_PUNKT.cy}
            initial={false}
            animate={zustand === "denkt" ? { r: MARKE_PUNKT.r, opacity: [1, 0.35, 1] } : { r: MARKE_PUNKT.r * skala, opacity: 1 }}
            transition={zustand === "denkt" ? { opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" }, r: { duration: 0.08 } } : { duration: 0.08, ease: "linear" }}
          />
        ) : (
          <circle cx={MARKE_PUNKT.cx} cy={MARKE_PUNKT.cy} r={MARKE_PUNKT.r} />
        )}
      </svg>
    </div>
  );
}

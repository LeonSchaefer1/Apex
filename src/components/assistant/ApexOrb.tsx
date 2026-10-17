import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useBewegungReduziert } from "@/lib/useBewegungReduziert";

export type OrbZustand = "ruhe" | "hoert" | "denkt" | "spricht";

/** Abgerundeter Zuschnitt mit vier Eckradien (gleiches Format für alle Schlüsselbilder, damit er sich animieren lässt). */
const rund = (a: number, b: number, c: number, d: number) => `inset(0% round ${a}% ${b}% ${c}% ${d}%)`;

/**
 * Der Apex-Avatar: eine lebendige Glaskugel. Ruhig atmend im Leerlauf, wellig beim Zuhören,
 * schnell kreisend beim Nachdenken, pulsierend beim Sprechen. Bei „Bewegung reduzieren“ steht sie still (I4-T01-02).
 */
export function ApexOrb({ zustand = "ruhe", size = 56, pegel = 0, className }: { zustand?: OrbZustand; size?: number; pegel?: number; className?: string }) {
  const reduziert = useBewegungReduziert();
  if (reduziert) return <StatischeKugel zustand={zustand} size={size} className={className} />;
  const speed = zustand === "denkt" ? 2.2 : zustand === "hoert" ? 5 : 9;
  const scale = zustand === "spricht" ? 1 + pegel * 0.09 : zustand === "hoert" ? 1.04 : 1;
  const blob = zustand === "hoert" || zustand === "denkt";
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-[-6%] rounded-full blur-[10px]"
        style={{ background: "conic-gradient(from 0deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))" }}
        animate={{ rotate: 360, opacity: zustand === "ruhe" ? [0.22, 0.34, 0.22] : 0.55 }}
        transition={{ rotate: { duration: speed * 1.4, repeat: Infinity, ease: "linear" }, opacity: { duration: 4, repeat: Infinity } }}
      />
      {/* Zuschnitt per clip-path: overflow + border-radius versagt in Chromium zeitweise, sobald das Element skaliert
          und ein Kind rotiert – dann blitzten die Ecken des Farbverlaufs als Quadrat auf. */}
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-full"
        animate={{
          scale: zustand === "ruhe" ? [1, 1.03, 1] : scale,
          clipPath: blob ? [rund(50, 50, 50, 50), rund(46, 54, 52, 48), rund(53, 47, 47, 53), rund(50, 50, 50, 50)] : rund(50, 50, 50, 50),
          borderRadius: blob ? ["50%", "46% 54% 52% 48%", "53% 47% 47% 53%", "50%"] : "50%",
        }}
        transition={{
          scale: zustand === "ruhe" ? { duration: 4.5, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 380, damping: 14 },
          clipPath: { duration: 2.4, repeat: blob ? Infinity : 0 },
          borderRadius: { duration: 2.4, repeat: blob ? Infinity : 0 },
        }}
        style={{
          clipPath: rund(50, 50, 50, 50),
          boxShadow: "inset 0 1px 1px rgba(255,255,255,.6), inset 0 -6px 14px rgba(0,0,0,.25), 0 8px 24px -8px rgba(60,40,200,.6)",
          isolation: "isolate",
        }}
      >
        <motion.div
          className="absolute inset-[-25%]"
          style={{ background: "conic-gradient(from 45deg, #3d5cff, #8b5cf6, #ec5fa8, #ff9d3d, #46c8ff, #3d5cff)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-[-10%] mix-blend-screen"
          style={{ background: "radial-gradient(45% 45% at 35% 35%, rgba(255,255,255,.85), transparent 70%)" }}
          animate={{ x: ["-6%", "8%", "-4%"], y: ["-4%", "6%", "-6%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(70% 70% at 50% 120%, rgba(20,10,80,.45), transparent 60%)" }} />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35), inset 0 -10px 18px rgba(30,10,90,.35), inset 0 8px 14px rgba(255,255,255,.25)" }} />
        {/* Glanzlicht */}
        <div className="absolute left-[18%] top-[10%] h-[28%] w-[50%] rounded-full bg-white/50 blur-[2px]" style={{ transform: "rotate(-20deg)" }} />
      </motion.div>
      {zustand === "spricht" && (
        <motion.div
          className="absolute inset-[-6%] rounded-full ring-2 ring-white/50"
          animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
      )}
    </div>
  );
}

/**
 * Kugel bei „Bewegung reduzieren“: keine Endlos-Animation (kein Glühen, kein Rotieren, kein Blob, kein Sprech-Ring-Puls).
 * Die Zustände zeigt ein ruhender Ring: hört = weißer Ring, denkt = violetter Ring, spricht = weißer Außenring.
 */
function StatischeKugel({ zustand, size, className }: { zustand: OrbZustand; size: number; className?: string }) {
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden data-zustand={zustand}>
      <div
        className="absolute inset-[-6%] rounded-full blur-[10px]"
        style={{ background: "conic-gradient(from 0deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))", opacity: zustand === "ruhe" ? 0.28 : 0.5 }}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          clipPath: rund(50, 50, 50, 50),
          boxShadow: "inset 0 1px 1px rgba(255,255,255,.6), inset 0 -6px 14px rgba(0,0,0,.25), 0 8px 24px -8px rgba(60,40,200,.6)",
          isolation: "isolate",
        }}
      >
        <div className="absolute inset-[-25%]" style={{ background: "conic-gradient(from 45deg, #3d5cff, #8b5cf6, #ec5fa8, #ff9d3d, #46c8ff, #3d5cff)" }} />
        <div className="absolute inset-[-10%] mix-blend-screen" style={{ background: "radial-gradient(45% 45% at 35% 35%, rgba(255,255,255,.85), transparent 70%)" }} />
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(70% 70% at 50% 120%, rgba(20,10,80,.45), transparent 60%)" }} />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35), inset 0 -10px 18px rgba(30,10,90,.35), inset 0 8px 14px rgba(255,255,255,.25)" }} />
        <div className="absolute left-[18%] top-[10%] h-[28%] w-[50%] rounded-full bg-white/50 blur-[2px]" style={{ transform: "rotate(-20deg)" }} />
      </div>
      {zustand === "hoert" && <div className="absolute inset-[-4%] rounded-full ring-2 ring-white/70" />}
      {zustand === "denkt" && <div className="absolute inset-[-6%] rounded-full ring-2 ring-[var(--ai-2)]" />}
      {zustand === "spricht" && <div className="absolute inset-[-12%] rounded-full ring-2 ring-white/50" />}
    </div>
  );
}

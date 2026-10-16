import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export type OrbZustand = "ruhe" | "hoert" | "denkt" | "spricht";

/**
 * Der Apex-Avatar: eine lebendige Glaskugel. Ruhig atmend im Leerlauf, wellig beim Zuhören,
 * schnell kreisend beim Nachdenken, pulsierend beim Sprechen.
 */
export function ApexOrb({ zustand = "ruhe", size = 56, pegel = 0, className }: { zustand?: OrbZustand; size?: number; pegel?: number; className?: string }) {
  const speed = zustand === "denkt" ? 2.2 : zustand === "hoert" ? 5 : 9;
  const scale = zustand === "spricht" ? 1 + pegel * 0.09 : zustand === "hoert" ? 1.04 : 1;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      <motion.div
        className="absolute inset-[-6%] rounded-full blur-[10px]"
        style={{ background: "conic-gradient(from 0deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))" }}
        animate={{ rotate: 360, opacity: zustand === "ruhe" ? [0.22, 0.34, 0.22] : 0.55 }}
        transition={{ rotate: { duration: speed * 1.4, repeat: Infinity, ease: "linear" }, opacity: { duration: 4, repeat: Infinity } }}
      />
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-full"
        animate={{
          scale: zustand === "ruhe" ? [1, 1.03, 1] : scale,
          borderRadius: zustand === "hoert" || zustand === "denkt" ? ["50%", "46% 54% 52% 48%", "53% 47% 47% 53%", "50%"] : "50%",
        }}
        transition={{
          scale: zustand === "ruhe" ? { duration: 4.5, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 380, damping: 14 },
          borderRadius: { duration: 2.4, repeat: Infinity },
        }}
        style={{
          boxShadow: "inset 0 1px 1px rgba(255,255,255,.6), inset 0 -6px 14px rgba(0,0,0,.25), 0 8px 24px -8px rgba(60,40,200,.6)",
          WebkitMaskImage: "radial-gradient(white, black)",
          maskImage: "radial-gradient(white, black)",
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

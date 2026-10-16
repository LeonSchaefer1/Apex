import { motion } from "motion/react";
import { AppIcon } from "@/components/Logo";

export function LadeBildschirm({ fehler, text = "Kanzlei wird geladen …" }: { fehler?: string; text?: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-5">
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <AppIcon size={64} />
        </motion.div>
        {fehler ? (
          <div className="max-w-sm text-center text-[13px] text-seal">{fehler}</div>
        ) : (
          <>
            <div className="text-[13px] font-medium text-fg-3">{text}</div>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--line)]">
              <motion.div className="h-full w-1/3 rounded-full bg-ink" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { motion } from "motion/react";
import { LogOut, RotateCcw } from "lucide-react";
import { AppIcon } from "@/components/Logo";
import { Button } from "@/components/ui";
import { useBewegungReduziert } from "@/lib/useBewegungReduziert";

/**
 * Lade- und Fehleranzeige beim Start bzw. beim Laden der Kanzleidaten. Im Fehlerfall gibt es immer einen Ausweg:
 * „Erneut versuchen“ (ohne eigene Aktion: Seite neu laden) und – falls übergeben – „Abmelden“.
 */
export function LadeBildschirm({ fehler, text = "Kanzlei wird geladen …", onErneut, onAbmelden }: { fehler?: string; text?: string; onErneut?: () => void; onAbmelden?: () => void }) {
  // Bewegung reduzieren: kein Pulsieren, kein laufender Balken – ein ruhender Balken zeigt „lädt“
  const ruhig = useBewegungReduziert();
  return (
    <div className="grid h-full place-items-center px-4">
      <div className="flex flex-col items-center gap-5">
        <motion.div animate={fehler || ruhig ? { scale: 1 } : { scale: [1, 1.06, 1] }} transition={fehler || ruhig ? { duration: 0.3 } : { duration: 1.6, repeat: Infinity }}>
          <AppIcon size={64} />
        </motion.div>
        {fehler ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-sm flex-col items-center gap-4 text-center" role="alert">
            <div>
              <div className="text-[15px] font-semibold">Das hat nicht geklappt</div>
              <div className="mt-1 text-[13px] text-seal">{fehler}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={<RotateCcw className="size-4" />} onClick={() => (onErneut ? onErneut() : window.location.reload())}>
                Erneut versuchen
              </Button>
              {onAbmelden && (
                <Button variant="ghost" icon={<LogOut className="size-4" />} onClick={onAbmelden}>
                  Abmelden
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            <div className="text-[13px] font-medium text-fg-3">{text}</div>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--line)]">
              {ruhig ? (
                <div className="mx-auto h-full w-1/3 rounded-full bg-ink" />
              ) : (
                <motion.div className="h-full w-1/3 rounded-full bg-ink" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

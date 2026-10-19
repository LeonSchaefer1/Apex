import { motion } from "motion/react";
import { LogOut, RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui";
import { useBewegungReduziert } from "@/lib/useBewegungReduziert";

/**
 * Lade- und Fehleranzeige beim Start bzw. beim Laden der Kanzleidaten (DESIGN-SYSTEM.md 12.17): Bildmarke 32 px, Text 13/500,
 * darunter eine feine Linie mit gleichmäßigem Läufer – kein Pulsieren. Im Fehlerfall gibt es immer einen Ausweg:
 * „Erneut versuchen“ (ohne eigene Aktion: Seite neu laden) und – falls übergeben – „Abmelden“.
 */
export function LadeBildschirm({ fehler, text = "Kanzlei wird geladen …", onErneut, onAbmelden }: { fehler?: string; text?: string; onErneut?: () => void; onAbmelden?: () => void }) {
  // Bewegung reduzieren: der Läufer steht mittig
  const ruhig = useBewegungReduziert();
  return (
    <div className="grid h-full place-items-center bg-[var(--bg)] px-4">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={32} className="text-fg" />
        {fehler ? (
          <div className="flex max-w-sm flex-col items-center gap-4 text-center" role="alert">
            <div>
              <div className="text-[15px] font-semibold">Das hat nicht geklappt</div>
              <div className="mt-1 text-[13px] text-seal-text">{fehler}</div>
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
          </div>
        ) : (
          <>
            <div className="text-[13px] font-medium leading-[18px] text-fg-3">{text}</div>
            <div className="h-0.5 w-[120px] overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
              {ruhig ? (
                <div className="mx-auto h-full w-10 bg-[var(--ink)]" />
              ) : (
                <motion.div className="h-full w-10 bg-[var(--ink)]" animate={{ x: [-40, 120] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

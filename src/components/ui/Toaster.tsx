import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, XCircle, Sparkles, X } from "lucide-react";
import { useToasts, useUI } from "@/store/ui";
import { cn } from "@/lib/cn";

const ICON = {
  info: <Info className="size-[18px] text-ink" />,
  erfolg: <CheckCircle2 className="size-[18px] text-green" />,
  warnung: <AlertTriangle className="size-[18px] text-amber" />,
  fehler: <XCircle className="size-[18px] text-seal" />,
  ki: <Sparkles className="size-[18px] text-violet" />,
};

/**
 * Meldungen als Kapseln unten rechts – oberhalb des Freiraums der Assistent-Kugel, mobil über der Tab-Leiste.
 * So verdecken sie weder Suchfeld noch Seitentitel. Der Zeitgeber pausiert, solange Maus oder Fokus in der Meldung sind.
 */
export function Toaster() {
  const { toasts, dismiss, pause, weiter } = useToasts();
  const kugel = useUI((s) => s.kugel && !s.kugelEingeklappt);
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end sm:px-0",
        // mobil über der Tab-Leiste (62 px + Abstand) und der Kugel; ab Tablet über der Kugel (60 px + 16 px Abstand)
        "bottom-[calc(156px+env(safe-area-inset-bottom))] md:bottom-[96px]",
        !kugel && "bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-6",
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.8, borderRadius: 999 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.85, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="pointer-events-auto flex w-full max-w-[min(92vw,420px)] items-center gap-3 rounded-[22px] bg-[#0b0e18]/95 px-4 py-3 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-xl sm:w-auto"
            role="status"
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => weiter(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) weiter(t.id);
            }}
          >
            <div className="shrink-0 [&>svg]:size-[18px]">{t.icon ?? ICON[t.ton ?? "info"]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold leading-tight">{t.titel}</div>
              {t.text && <div className="mt-0.5 text-[13px] leading-snug text-white/80">{t.text}</div>}
            </div>
            {t.aktion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  t.aktion!.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-full bg-white/14 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/22"
              >
                {t.aktion.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white" aria-label="Meldung schließen">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

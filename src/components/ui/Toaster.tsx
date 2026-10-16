import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, XCircle, Sparkles } from "lucide-react";
import { useToasts } from "@/store/ui";

const ICON = {
  info: <Info className="size-[18px] text-ink" />,
  erfolg: <CheckCircle2 className="size-[18px] text-green" />,
  warnung: <AlertTriangle className="size-[18px] text-amber" />,
  fehler: <XCircle className="size-[18px] text-seal" />,
  ki: <Sparkles className="size-[18px] text-violet" />,
};

/** Benachrichtigungen im Stil der Dynamic Island: wachsen aus einer Kapsel oben in der Mitte. */
export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(10px,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.6, borderRadius: 999 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.7, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="pointer-events-auto flex max-w-[min(92vw,440px)] items-center gap-3 rounded-[22px] bg-[#0b0e18]/92 px-4 py-3 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-xl"
            role="status"
            onClick={() => dismiss(t.id)}
          >
            <div className="shrink-0">{ICON[t.ton ?? "info"]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold leading-tight">{t.titel}</div>
              {t.text && <div className="mt-0.5 text-[12.5px] leading-snug text-white/70">{t.text}</div>}
            </div>
            {t.aktion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  t.aktion!.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded-full bg-white/14 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-white/22"
              >
                {t.aktion.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

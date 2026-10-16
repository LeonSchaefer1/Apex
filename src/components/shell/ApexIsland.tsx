import { useMemo } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Zap } from "lucide-react";
import { useMotorStore } from "@/lib/motor";
import { useData } from "@/store/data";
import { useToasts } from "@/store/ui";
import { addDays, fmtNum, today } from "@/core/dates";

/** „Apex Island": schwarze Kapsel, die zeigt, was der 38h-Motor gerade erledigt. */
export function ApexIsland() {
  const aktuell = useMotorStore((s) => s.aktuell);
  const akt = useData((s) => s.data.aktivitaeten);
  const nav = useNavigate();
  // Benachrichtigungen erscheinen als Dynamic-Island-Kapsel oben – solange eine sichtbar ist, tritt die Island zurück,
  // statt halb verdeckt hinter ihr hervorzuschauen.
  const toastSichtbar = useToasts((s) => s.toasts.length > 0);
  const stunden = useMemo(() => {
    const grenze = addDays(today(), -6);
    return akt.filter((a) => a.zeit.slice(0, 10) >= grenze).reduce((s, a) => s + (a.minutenGespart ?? 0), 0) / 60;
  }, [akt]);

  return (
    <motion.button
      type="button"
      layout
      onClick={() => nav("/automatisierung")}
      animate={{ opacity: toastSichtbar ? 0 : 1, scale: toastSichtbar ? 0.85 : 1, filter: toastSichtbar ? "blur(4px)" : "blur(0px)" }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      aria-hidden={toastSichtbar || undefined}
      tabIndex={toastSichtbar ? -1 : undefined}
      style={{ pointerEvents: toastSichtbar ? "none" : undefined }}
      className="relative hidden h-9 max-w-full shrink-0 items-center gap-2 overflow-hidden rounded-full bg-[#090b14] pl-2 pr-3.5 text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10 lg:inline-flex"
      title="38h-Motor: Was die Automatisierung gerade für Sie erledigt"
    >
      <motion.span layout className="relative grid size-6 place-items-center rounded-full bg-white/10">
        <Zap className="size-3.5 text-[#ffd166]" fill="#ffd166" />
        <span className="absolute inset-0 animate-ping rounded-full bg-[#ffd166]/25 [animation-duration:2.6s]" />
      </motion.span>
      <AnimatePresence mode="popLayout" initial={false}>
        {aktuell ? (
          <motion.span
            key="akt"
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            className="max-w-[200px] truncate text-[12.5px] font-medium xl:max-w-[280px] 2xl:max-w-[360px]"
          >
            {aktuell.text} <span className="text-[#7ee2b8]">· +{aktuell.minuten} Min.</span>
          </motion.span>
        ) : (
          <motion.span
            key="ruhe"
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            className="whitespace-nowrap text-[12.5px] font-medium"
          >
            <span className="hidden 2xl:inline">38h-Motor aktiv · </span>
            <span className="num text-[#7ee2b8]">{fmtNum(stunden, 1)} Std.</span> gespart<span className="hidden xl:inline"> diese Woche</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

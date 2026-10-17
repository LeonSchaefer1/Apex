import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, XCircle, Sparkles, X } from "lucide-react";
import { useToasts, useUI } from "@/store/ui";
import { cn } from "@/lib/cn";
import { useObersterDialog, type OffenerDialog } from "./Modal";

const ICON = {
  info: <Info className="size-[18px] text-ink" />,
  erfolg: <CheckCircle2 className="size-[18px] text-green" />,
  warnung: <AlertTriangle className="size-[18px] text-amber" />,
  fehler: <XCircle className="size-[18px] text-seal" />,
  ki: <Sparkles className="size-[18px] text-violet" />,
};

/** Lage der Meldungen, solange ein Dialog offen ist – nie über Dialogfuß, Bottom-Sheet-Knöpfen oder Seitenpanel. */
interface DialogLage {
  stil: CSSProperties;
  /** „oben“: Meldungen hängen von oben herab (neue erscheinen von oben); sonst wachsen sie von unten. */
  oben: boolean;
  /** Ausrichtung der Kapseln im Bereich */
  ausrichtung: "mitte" | "rechts";
  maxBreite: number;
}

const KOPFLEISTE = 80;
const MELDUNG_HOEHE = 72;

/** Rechteck eines Dialogs ohne Transformation (Ein- und Ausblendanimation verschiebt ihn sonst noch). */
function dialogRechteck(el: HTMLElement): { left: number; top: number; width: number; height: number } {
  const eltern = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
  return { left: eltern.left + el.offsetLeft, top: eltern.top + el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
}

function lageFuer(d: OffenerDialog): DialogLage | null {
  const el = d.el();
  if (!el) return null;
  const vw = window.innerWidth;
  const r = dialogRechteck(el);
  if (d.art === "drawer") {
    // Seitenpanel rechts: Meldungen links daneben, unten – passt dort keine Kapsel hin (Smartphone), oben über dem Kopf des Panels
    const frei = r.left - 32;
    if (frei >= 280) return { stil: { right: vw - r.left + 16, bottom: 24 }, oben: false, ausrichtung: "rechts", maxBreite: Math.min(420, frei) };
    return { stil: { top: 12, left: 12, right: 12 }, oben: true, ausrichtung: "mitte", maxBreite: Math.max(220, Math.min(420, r.width - 112)) };
  }
  // Zentriertes Modal bzw. Bottom-Sheet (Smartphone): oben mittig unterhalb der Kopfleiste über dem Abdunkler.
  // Reicht der Platz über dem Dialog nicht, bleibt die Kapsel schmaler als der Dialog – Schließen-Knopf und Fuß bleiben frei.
  const kopf = vw < 768 ? 12 : KOPFLEISTE;
  const passtDarueber = r.top >= kopf + MELDUNG_HOEHE;
  const top = passtDarueber ? kopf : Math.max(12, Math.min(kopf, r.top - MELDUNG_HOEHE));
  const maxBreite = passtDarueber ? 420 : Math.max(220, Math.min(420, r.width - 112));
  return { stil: { top, left: 12, right: 12 }, oben: true, ausrichtung: "mitte", maxBreite };
}

/** Lage für den obersten offenen Dialog – nachgeführt bei Größenänderung; ohne Dialog `null` (Standardlage unten rechts). */
function useDialogLage(): DialogLage | null {
  const oben = useObersterDialog();
  const [lage, setLage] = useState<DialogLage | null>(null);
  useEffect(() => {
    if (!oben) {
      setLage(null);
      return;
    }
    let raf = 0;
    const messen = () => setLage(lageFuer(oben));
    // erst nach dem Einhängen des Dialogs messen (Element und Inhalt stehen dann)
    raf = requestAnimationFrame(messen);
    const spaeter = window.setTimeout(messen, 250);
    window.addEventListener("resize", messen);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(spaeter);
      window.removeEventListener("resize", messen);
    };
  }, [oben]);
  return oben ? lage : null;
}

/**
 * Meldungen als Kapseln unten rechts – oberhalb des Freiraums der Assistent-Kugel, mobil über der Tab-Leiste.
 * So verdecken sie weder Suchfeld noch Seitentitel. Ist ein Dialog offen, weichen sie aus (I3-T03-03): beim Modal oben mittig
 * unterhalb der Kopfleiste, beim Seitenpanel links daneben – bereits sichtbare Meldungen wandern mit. Meldungen nehmen nie den
 * Fokus; × schließt nur die Meldung, Escape weiter den Dialog. Der Zeitgeber pausiert, solange Maus oder Fokus in der Meldung sind.
 */
export function Toaster() {
  const { toasts, dismiss, pause, weiter } = useToasts();
  const kugel = useUI((s) => s.kugel && !s.kugelEingeklappt);
  const lage = useDialogLage();
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[100] flex flex-col gap-2",
        lage
          ? cn(lage.ausrichtung === "mitte" ? "items-center" : "items-end")
          : cn(
              "inset-x-0 items-center px-4 sm:inset-x-auto sm:right-6 sm:items-end sm:px-0",
              // mobil über der Tab-Leiste (62 px + Abstand) und der Kugel; ab Tablet über der Kugel (60 px + 16 px Abstand)
              "bottom-[calc(156px+env(safe-area-inset-bottom))] md:bottom-[96px]",
              !kugel && "bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-6",
            ),
      )}
      style={lage?.stil}
      data-meldungen={lage ? (lage.oben ? "oben" : "neben-panel") : "unten"}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: lage?.oben ? -24 : 24, scale: 0.8, borderRadius: 999 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: lage?.oben ? -16 : 16, scale: 0.85, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-[22px] bg-[#0b0e18]/95 px-4 py-3 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-xl sm:w-auto"
            style={{ maxWidth: lage ? `min(92vw, ${lage.maxBreite}px)` : "min(92vw, 420px)" }}
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

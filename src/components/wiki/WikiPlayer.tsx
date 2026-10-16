import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import type { WikiArtikel } from "@/content/wiki";
import { WikiVisualScene } from "./WikiVisual";
import { cn } from "@/lib/cn";

/** Animiertes Wiki: Schritte laufen nacheinander von selbst ab – jederzeit anhalten, vor und zurück. */
export function WikiPlayer({ artikel, kompakt, onNavigate }: { artikel: WikiArtikel; kompakt?: boolean; onNavigate?: () => void }) {
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const nav = useNavigate();
  const n = artikel.schritte.length;
  const dauer = 6500;

  useEffect(() => setI(0), [artikel.key]);
  useEffect(() => {
    if (pause) return;
    const t = setTimeout(() => setI((x) => (x + 1 < n ? x + 1 : x)), dauer);
    return () => clearTimeout(t);
  }, [i, pause, n]);

  const s = artikel.schritte[i];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5" aria-hidden>
        {artikel.schritte.map((_, k) => (
          <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
            <motion.div
              key={`${k}-${i}-${pause}`}
              className="h-full rounded-full bg-ink"
              initial={{ width: k < i ? "100%" : "0%" }}
              animate={{ width: k < i ? "100%" : k === i ? (pause ? undefined : "100%") : "0%" }}
              transition={{ duration: k === i && !pause ? dauer / 1000 : 0, ease: "linear" }}
            />
          </div>
        ))}
      </div>

      <div className={cn("relative overflow-hidden rounded-[22px] bg-[radial-gradient(120%_120%_at_20%_0%,var(--ink-soft),transparent_60%),var(--surface-2)] ring-1 ring-[var(--line)]", kompakt ? "h-[190px]" : "h-[240px]")}>
        <AnimatePresence mode="wait">
          <motion.div key={`${artikel.key}-${i}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.4 }} className="absolute inset-0">
            <WikiVisualScene visual={s.visual} />
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`t-${artikel.key}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
          <div className="eyebrow mb-1">
            Schritt {i + 1} von {n}
          </div>
          <div className="title-md">{s.titel}</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{s.text}</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <button type="button" className="icon-btn" aria-label="Vorheriger Schritt" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>
          <ChevronLeft className="size-[18px]" />
        </button>
        <button type="button" className="icon-btn" aria-label={pause ? "Abspielen" : "Anhalten"} onClick={() => setPause((p) => !p)}>
          {pause ? <Play className="size-[18px]" /> : <Pause className="size-[18px]" />}
        </button>
        <button type="button" className="icon-btn" aria-label="Nächster Schritt" disabled={i === n - 1} onClick={() => setI((x) => Math.min(n - 1, x + 1))}>
          <ChevronRight className="size-[18px]" />
        </button>
        {artikel.pfad && (
          <button
            type="button"
            className="btn btn-sm btn-secondary ml-auto"
            onClick={() => {
              onNavigate?.();
              nav(artikel.pfad!);
            }}
          >
            Direkt hin <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>

      {artikel.tipps && artikel.tipps.length > 0 && (
        <div className="rounded-[16px] bg-amber-soft p-3.5">
          {artikel.tipps.map((t, k) => (
            <div key={k} className="flex gap-2 text-[12.5px] leading-snug text-fg-2">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber" />
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

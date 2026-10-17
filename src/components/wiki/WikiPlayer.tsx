import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import type { WikiArtikel } from "@/content/wiki";
import { WikiVisualScene } from "./WikiVisual";
import { cn } from "@/lib/cn";
import { useBewegungReduziert } from "@/lib/useBewegungReduziert";

/**
 * Animiertes Wiki: Schritte laufen nacheinander von selbst ab – jederzeit anhalten, vor und zurück (auch mit ← und →).
 * Bei „Bewegung reduzieren“ startet es angehalten und schaltet nur per Klick bzw. Pfeiltaste weiter (I4-T12-01); „Abspielen“
 * bleibt möglich. Eine Änderung der Einstellung zur Laufzeit wird übernommen.
 */
export function WikiPlayer({ artikel, kompakt, onNavigate }: { artikel: WikiArtikel; kompakt?: boolean; onNavigate?: () => void }) {
  const reduziert = useBewegungReduziert();
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(reduziert);
  const nav = useNavigate();
  const n = artikel.schritte.length;
  const dauer = 6500;

  useEffect(() => {
    setI(0);
    setPause(reduziert);
  }, [artikel.key, reduziert]);
  useEffect(() => {
    if (pause) return;
    const t = setTimeout(() => setI((x) => (x + 1 < n ? x + 1 : x)), dauer);
    return () => clearTimeout(t);
  }, [i, pause, n]);

  const weiter = () => setI((x) => Math.min(n - 1, x + 1));
  const zurueck = () => setI((x) => Math.max(0, x - 1));
  // ← → wirken im ganzen Bereich um den Player (Reiter-Inhalt bzw. Dialog) – auch wenn der Fokus beim Öffnen auf dem
  // Reiter-Inhalt liegt („Weiter mit →“). Pfeiltasten von Reitern, Auswahllisten und Eingabefeldern bleiben unberührt.
  const wurzel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = wurzel.current;
    const bereich = root?.closest<HTMLElement>("[role=tabpanel], [role=dialog]") ?? root;
    if (!root || !bereich) return;
    const h = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (t.closest("[role=tablist], [role=radiogroup], [role=listbox], [role=menu], [role=slider]")) return;
      // ein anderer Player im selben Bereich ist näher am Fokus → der gilt
      const naechster = t.closest("[data-wiki-player]");
      if (naechster && naechster !== root) return;
      if (!naechster && bereich.querySelectorAll("[data-wiki-player]").length > 1) return;
      e.preventDefault();
      if (e.key === "ArrowRight") setI((x) => Math.min(n - 1, x + 1));
      else setI((x) => Math.max(0, x - 1));
    };
    bereich.addEventListener("keydown", h);
    return () => bereich.removeEventListener("keydown", h);
  }, [n]);
  const s = artikel.schritte[i];
  return (
    <div ref={wurzel} data-wiki-player className="flex flex-col gap-4">
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
          <div className="eyebrow mb-1 flex flex-wrap items-center gap-x-1.5">
            <span>
              Schritt {i + 1} von {n}
            </span>
            {pause && i < n - 1 && (
              <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                · Weiter mit <span className="kbd" aria-hidden>→</span>
                <span className="sr-only">Pfeiltaste rechts oder „Nächster Schritt“</span>
              </span>
            )}
          </div>
          <div className="title-md">{s.titel}</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{s.text}</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <button type="button" className="icon-btn" aria-label="Vorheriger Schritt" disabled={i === 0} onClick={zurueck}>
          <ChevronLeft className="size-[18px]" />
        </button>
        <button type="button" className="icon-btn" aria-label={pause ? "Abspielen" : "Anhalten"} onClick={() => setPause((p) => !p)}>
          {pause ? <Play className="size-[18px]" /> : <Pause className="size-[18px]" />}
        </button>
        <button type="button" className="icon-btn" aria-label="Nächster Schritt" disabled={i === n - 1} onClick={weiter}>
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

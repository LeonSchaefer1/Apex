import { useMemo } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Sparkles, Zap } from "lucide-react";
import type { Aktivitaet, Automation } from "@/core/types";
import { relTime } from "@/core/dates";
import { Card, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LIVE_MINUTEN } from "./shared";

/**
 * „Zuletzt erledigt“: neueste Vorgänge von Automationen und KI. „Live“ erscheint nur, wenn der jüngste Eintrag jünger als
 * 15 Minuten ist; mit Demo-Daten heißt die Karte „Zuletzt erledigt (simuliert)“.
 */
export function LiveFeed({ aktivitaeten, automationen, now, className, demo }: { aktivitaeten: Aktivitaet[]; automationen: Automation[]; now: number; className?: string; demo?: boolean }) {
  const nav = useNavigate();
  const namen = useMemo(() => new Map(automationen.map((a) => [a.key, a.name])), [automationen]);
  const eintraege = useMemo(
    () =>
      aktivitaeten
        .filter((a) => a.akteur === "automation" || a.akteur === "ki")
        .slice()
        .sort((a, b) => b.zeit.localeCompare(a.zeit))
        .slice(0, 7),
    [aktivitaeten],
  );

  const juengster = eintraege[0];
  const live = !!juengster && now - zeitMs(juengster.zeit) < LIVE_MINUTEN * 60_000;
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="title-md">{demo ? "Zuletzt erledigt (simuliert)" : "Zuletzt erledigt"}</div>
          <div className="mt-0.5 text-[12.5px] text-fg-3">Was der Motor zuletzt für Sie übernommen hat.</div>
        </div>
        {live && (
          <Chip tone="ink" className="shrink-0" title={`Letzter Vorgang vor weniger als ${LIVE_MINUTEN} Minuten`}>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60 [animation-duration:1.8s]" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[var(--green)]" />
            </span>
            Live
          </Chip>
        )}
      </div>
      <ul className="-mx-2 flex flex-col">
        <AnimatePresence initial={false}>
          {eintraege.map((e, i) => {
            const ki = e.akteur === "ki";
            return (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: -14, scale: 0.97, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
              >
                <button
                  type="button"
                  onClick={() => e.akteId && nav(`/akten/${e.akteId}`)}
                  disabled={!e.akteId}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-[14px] px-2 py-2.5 text-left transition-colors enabled:hover:bg-[var(--ink-softer)] disabled:cursor-default",
                    i === 0 && "bg-[var(--ink-softer)]",
                  )}
                >
                  <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-[9px]", ki ? "bg-violet-soft text-violet" : "bg-ink-soft text-ink")}>
                    {ki ? <Sparkles className="size-3.5" /> : <Zap className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] leading-snug text-fg">{e.text}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-fg-3">
                      {relTime(e.zeit, now)}
                      {e.automationKey && namen.get(e.automationKey) ? ` · ${namen.get(e.automationKey)}` : ""}
                    </span>
                  </span>
                  {e.minutenGespart ? <span className="num mt-0.5 shrink-0 text-[12px] font-semibold text-green">+{e.minutenGespart} Min.</span> : null}
                  {e.akteId && <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />}
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {eintraege.length === 0 && <p className="py-6 text-center text-[13px] text-fg-3">Noch nichts erledigt. Aktivieren Sie eine Automation – der erste Vorgang erscheint hier.</p>}
    </Card>
  );
}

/** Lokale Zeitangabe („2026-10-16T14:02:00“) in Millisekunden – wie `relTime`. */
function zeitMs(zeit: string): number {
  const t = new Date(zeit).getTime();
  return Number.isFinite(t) ? t : 0;
}

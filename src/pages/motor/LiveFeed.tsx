import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Sparkles, Zap } from "lucide-react";
import type { Aktivitaet, Automation } from "@/core/types";
import { relTime } from "@/core/dates";
import { Card, CardHeader, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LIVE_MINUTEN } from "./shared";

/**
 * „Zuletzt erledigt“: neueste Vorgänge von Automatiken und KI. „Live“ erscheint nur, wenn der jüngste Eintrag jünger als
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
      <CardHeader
        title={demo ? "Zuletzt erledigt (simuliert)" : "Zuletzt erledigt"}
        subtitle="Was der Motor zuletzt für Sie übernommen hat."
        className="mb-2"
        action={
          live ? (
            <Chip tone="outline" dot title={`Letzter Vorgang vor weniger als ${LIVE_MINUTEN} Minuten`}>
              Live
            </Chip>
          ) : undefined
        }
      />
      {/* Liste mit Linien: Zap bzw. Sparkles 14 px ohne Kachel, „+3 Min.“ in Text 3 (DESIGN-SYSTEM.md 13, 38h-Motor) */}
      <ul className="-mx-2 flex flex-col divide-y divide-[var(--line)]">
        {eintraege.map((e) => {
          const ki = e.akteur === "ki";
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => e.akteId && nav(`/akten/${e.akteId}`)}
                disabled={!e.akteId}
                className="group flex w-full items-start gap-2.5 rounded-sm px-2 py-3 text-left transition-colors duration-100 enabled:hover:bg-[var(--surface-2)] disabled:cursor-default"
              >
                <span className="mt-[3px] shrink-0 text-fg-4" aria-hidden>
                  {ki ? <Sparkles className="size-3.5" /> : <Zap className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  {/* Vollständig und umbrechend statt gekürzt (I5-T10-02): Hauptzeile, darunter Zeit und Automatik */}
                  <span className="block break-words text-[14px] leading-5 text-fg">{e.text}</span>
                  <span className="mt-0.5 block break-words text-[13px] leading-[18px] text-fg-4">
                    {relTime(e.zeit, now)}
                    {e.automationKey && namen.get(e.automationKey) ? ` · ${namen.get(e.automationKey)}` : ""}
                  </span>
                </span>
                {e.minutenGespart ? <span className="num mt-0.5 shrink-0 text-[13px] text-fg-3">+{e.minutenGespart} Min.</span> : null}
                {e.akteId && <ArrowUpRight className="mt-[3px] size-3.5 shrink-0 text-fg-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      {eintraege.length === 0 && <p className="py-6 text-center text-[14px] text-fg-3">Noch nichts erledigt. Aktivieren Sie eine Automatik – der erste Vorgang erscheint hier.</p>}
    </Card>
  );
}

/** Lokale Zeitangabe („2026-10-16T14:02:00“) in Millisekunden – wie `relTime`. */
function zeitMs(zeit: string): number {
  const t = new Date(zeit).getTime();
  return Number.isFinite(t) ? t : 0;
}

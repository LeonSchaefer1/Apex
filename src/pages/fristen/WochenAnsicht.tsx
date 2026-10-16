import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fromISO, monatName, wochentagName } from "@/core/dates";
import { feiertagAm } from "@/core/feiertage";
import type { Akte, Bundesland, Frist } from "@/core/types";
import { Button, Card, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FristPille } from "./FristDetail";
import { TYP_REIHENFOLGE, kalenderwoche, wochenAnsichtStart } from "./logik";

const SCHRAFFUR = "bg-[repeating-linear-gradient(135deg,var(--ink-softer)_0_6px,transparent_6px_12px)]";

export function sortiereTag(a: Frist, b: Frist) {
  return (a.uhrzeit ?? "99").localeCompare(b.uhrzeit ?? "99") || TYP_REIHENFOLGE.indexOf(a.typ) - TYP_REIHENFOLGE.indexOf(b.typ);
}

function zeitraum(start: string) {
  const ende = addDays(start, 6);
  const a = fromISO(start);
  const b = fromISO(ende);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}.–${b.getUTCDate()}. ${monatName(b.getUTCMonth())} ${b.getUTCFullYear()}`;
  return `${a.getUTCDate()}. ${monatName(a.getUTCMonth(), true)} – ${b.getUTCDate()}. ${monatName(b.getUTCMonth(), true)} ${b.getUTCFullYear()}`;
}

export function WochenAnsicht({
  fristen, akten, start, setStart, land, heute, markiert, onOpen,
}: {
  fristen: Frist[];
  akten: Map<string, Akte>;
  start: string;
  setStart: (s: string) => void;
  land: Bundesland;
  heute: string;
  /** Per Deep-Link angesprungener Tag – wird hervorgehoben und in den sichtbaren Bereich gescrollt */
  markiert?: string;
  onOpen: (f: Frist) => void;
}) {
  const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const proTag = useMemo(() => {
    const m = new Map<string, Frist[]>();
    for (const f of fristen) if (f.datum >= tage[0] && f.datum <= tage[6]) m.set(f.datum, [...(m.get(f.datum) ?? []), f]);
    for (const l of m.values()) l.sort(sortiereTag);
    return m;
  }, [fristen, tage]);
  const summe = tage.reduce((s, t) => s + (proTag.get(t)?.length ?? 0), 0);
  const standardStart = wochenAnsichtStart(heute);
  const aktuelleWoche = standardStart === start;
  const kwVon = kalenderwoche(start);
  const kwBis = kalenderwoche(addDays(start, 6));
  const markiertHier = !!markiert && tage.includes(markiert);
  /** Hervorhebungsring: der angesprungene Tag, sonst heute */
  const ring = (t: string) => (markiertHier ? t === markiert : t === heute);

  useEffect(() => {
    if (!markiert) return;
    const timer = setTimeout(() => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-tag="${markiert}"]`)).find((x) => x.offsetParent !== null);
      if (!el) return;
      // Nur scrollen, wenn der Tag nicht schon sichtbar ist (oben Kopfleiste, unten Tab-Leiste berücksichtigen)
      const r = el.getBoundingClientRect();
      if (r.top < 88 || r.top > window.innerHeight - 160) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 320);
    return () => clearTimeout(timer);
  }, [markiert]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Vorherige Woche" onClick={() => setStart(addDays(start, -7))}>
            <ChevronLeft className="size-[18px]" />
          </IconButton>
          <IconButton label="Nächste Woche" onClick={() => setStart(addDays(start, 7))}>
            <ChevronRight className="size-[18px]" />
          </IconButton>
        </div>
        <div className="min-w-0">
          <div className="title-md">
            KW {kwVon === kwBis ? kwVon : `${kwVon}/${kwBis}`} <span className="font-normal text-fg-3">· {zeitraum(start)}</span>
          </div>
        </div>
        <span className="num text-[12.5px] text-fg-3">
          {summe} {summe === 1 ? "Eintrag" : "Einträge"}
        </span>
        {!aktuelleWoche && (
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setStart(standardStart)}>
            {standardStart === heute ? "Ab heute" : "Diese Woche"}
          </Button>
        )}
      </div>

      {/* Desktop: 7 Spalten */}
      <motion.div key={start} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="hidden grid-cols-7 gap-2 lg:grid">
        {tage.map((t) => {
          const ft = feiertagAm(t, land);
          const frei = [0, 6].includes(fromISO(t).getUTCDay()) || (ft && !ft.teilweise);
          const istHeute = t === heute;
          const items = proTag.get(t) ?? [];
          return (
            <div key={t} data-tag={t} aria-current={t === markiert ? "date" : undefined} className={cn("sheet flex min-h-[320px] min-w-0 scroll-mt-24 flex-col rounded-[18px]", ring(t) && "ring-2 ring-[var(--ink)]", t === markiert && "bg-ink-softer")}>
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-2.5 py-2">
                <span className={cn("text-[12px] font-semibold uppercase tracking-[0.06em]", frei ? "text-fg-3" : "text-fg-3")}>{wochentagName(t, true)}</span>
                <span className={cn("num ml-auto grid size-7 place-items-center rounded-full text-[13.5px] font-semibold", istHeute ? "bg-ink text-on-ink" : frei ? "text-fg-3" : "text-fg")}>{Number(t.slice(8, 10))}</span>
              </div>
              <div className={cn("flex flex-1 flex-col gap-1.5 rounded-b-[18px] p-1.5", frei && SCHRAFFUR)}>
                {ft && (
                  <div className={cn("truncate rounded-[8px] px-2 py-1 text-[12px] font-semibold", ft.teilweise ? "bg-amber-soft text-amber" : "bg-surface text-fg-2 ring-1 ring-inset ring-[var(--line)]")} title={ft.teilweise ? `${ft.name} – nur regional, verlängert Fristen nicht` : `${ft.name} – gesetzlicher Feiertag`}>
                    {ft.name}
                  </div>
                )}
                {items.map((f) => (
                  <FristPille key={f.id} f={f} akte={akten.get(f.akteId)} onClick={() => onOpen(f)} />
                ))}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Smartphone/Tablet: Tagesliste */}
      <motion.div key={`m-${start}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 lg:hidden">
        {tage.map((t) => {
          const ft = feiertagAm(t, land);
          const frei = [0, 6].includes(fromISO(t).getUTCDay()) || (ft && !ft.teilweise);
          const items = proTag.get(t) ?? [];
          const istHeute = t === heute;
          return (
            <Card key={t} padded={false} data-tag={t} aria-current={t === markiert ? "date" : undefined} className={cn("flex scroll-mt-24 gap-3 p-3", ring(t) && "ring-2 ring-[var(--ink)]", frei && !items.length && t !== markiert && "opacity-80")}>
              <div className="w-11 shrink-0 text-center">
                <div className={cn("text-[12px] font-semibold uppercase", frei ? "text-fg-3" : "text-fg-3")}>{wochentagName(t, true)}</div>
                <div className={cn("num mx-auto mt-0.5 grid size-9 place-items-center rounded-full text-[16px] font-semibold", istHeute ? "bg-ink text-on-ink" : frei ? "text-fg-3" : "")}>{Number(t.slice(8, 10))}</div>
              </div>
              <div className={cn("min-w-0 flex-1 space-y-1.5 rounded-[12px]", frei && !items.length && cn(SCHRAFFUR, "min-h-10"))}>
                {ft && <div className={cn("text-[12px] font-semibold", ft.teilweise ? "text-amber" : "text-fg-2")}>{ft.name}{ft.teilweise ? " (regional)" : ""}</div>}
                {items.map((f) => (
                  <FristPille key={f.id} f={f} akte={akten.get(f.akteId)} onClick={() => onOpen(f)} />
                ))}
                {!items.length && !ft && <div className="flex h-10 items-center text-[12px] text-fg-3">{frei ? "Wochenende" : "Keine Einträge"}</div>}
              </div>
            </Card>
          );
        })}
      </motion.div>
    </div>
  );
}

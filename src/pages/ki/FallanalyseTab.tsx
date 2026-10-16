import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, FolderOpen, Gauge } from "lucide-react";
import type { Akte } from "@/core/types";
import { search } from "@/core/search";
import { relTime } from "@/core/dates";
import { useData } from "@/store/data";
import { FallanalysePanel } from "@/components/ki/FallanalysePanel";
import { Card, Chip, Empty, SearchField } from "@/components/ui";
import { cn } from "@/lib/cn";

const MAX_KARTEN = 8;

/** Standard-Akte für Präsentationen: die Hero-Akte „142/26“, sonst die zuletzt bearbeitete offene Akte. */
export function standardAkte(akten: Akte[]): Akte | undefined {
  const offen = akten.filter((a) => a.status === "offen");
  return offen.find((a) => a.aktenzeichen === "142/26") ?? offen.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/**
 * Fallanalyse: Akte wählen, dann analysiert die KI Sachverhalt, Präzedenzfälle und Erfolgsaussicht.
 * `autoStart` (Deep-Link aus dem Cockpit): scrollt zur Analyse der gewählten Akte und startet sie sofort.
 */
export function FallanalyseTab({ akteId, onAkte, autoStart, onAutoStart }: { akteId?: string; onAkte: (id: string) => void; autoStart?: boolean; onAutoStart?: () => void }) {
  const akten = useData((s) => s.data.akten);
  const kontakte = useData((s) => s.data.kontakte);
  const [q, setQ] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const offene = useMemo(() => akten.filter((a) => a.status === "offen"), [akten]);
  const gewaehlt = offene.find((a) => a.id === akteId) ?? akten.find((a) => a.id === akteId) ?? standardAkte(akten);
  const gewaehltId = gewaehlt?.id;

  // Akte, deren Analyse per Deep-Link gestartet wurde: Panel bekommt Bildschirmhöhe, damit es oben stehen kann.
  const [fokusId, setFokusId] = useState<string | null>(null);
  // Akte, deren Panel die Analyse selbst starten soll (nach dem Hingleiten)
  const [startFuer, setStartFuer] = useState<string | null>(null);

  useEffect(() => {
    if (!autoStart || !gewaehltId) return;
    setFokusId(gewaehltId);
    // kurz warten, bis Panel und Einblendung stehen – erst hingleiten, dann starten
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t1 = setTimeout(() => {
      const el = panelRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // Das Panel startet selbst (liegt bereits ein Ergebnis vor, zeigt es nur dieses an).
      t2 = setTimeout(() => setStartFuer(gewaehltId), reduce ? 0 : 520);
    }, 380);
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [autoStart, gewaehltId]);

  const liste = useMemo(() => {
    const name = (id?: string) => kontakte.find((k) => k.id === id)?.name ?? "";
    let res: Akte[];
    if (q.trim().length >= 2) {
      res = search(offene, q, [
        { get: (a) => a.aktenzeichen, weight: 4 },
        { get: (a) => a.titel, weight: 3 },
        { get: (a) => name(a.mandantId), weight: 2 },
        { get: (a) => a.sachgebiet, weight: 2 },
        { get: (a) => a.schlagworte.join(" "), weight: 1 },
        { get: (a) => a.beschreibung, weight: 1 },
      ]).map((h) => h.item);
    } else {
      const prio = { hoch: 0, normal: 1, niedrig: 2 } as const;
      res = offene.slice().sort((a, b) => (a.aktenzeichen === "142/26" ? -1 : b.aktenzeichen === "142/26" ? 1 : prio[a.prioritaet] - prio[b.prioritaet] || b.updatedAt.localeCompare(a.updatedAt)));
    }
    const top = res.slice(0, MAX_KARTEN);
    if (!q.trim() && gewaehlt && !top.some((a) => a.id === gewaehlt.id)) top[top.length - 1] = gewaehlt;
    return { top, gesamt: res.length };
  }, [offene, kontakte, q, gewaehlt]);

  if (!offene.length && !gewaehlt) {
    return (
      <Card>
        <Empty icon={<FolderOpen className="size-6" />} title="Keine offene Akte" text="Legen Sie eine Akte an – danach analysiert die KI Sachverhalt, Präzedenzfälle und Erfolgsaussicht." />
      </Card>
    );
  }

  const mandantName = (a: Akte) => kontakte.find((k) => k.id === a.mandantId)?.name;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Card className="min-w-0 !p-4 sm:!p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="title-md">Akte wählen</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Die KI liest Sachverhalt, Dokumente, Notizen und an die Akte geheftete Entscheidungen.</p>
          </div>
          <SearchField id="ki-akte-suche" value={q} onChange={setQ} placeholder={`${offene.length} offene Akten durchsuchen …`} className="w-full sm:w-[300px]" />
        </div>

        {liste.top.length ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {liste.top.map((a, i) => {
              const aktiv = a.id === gewaehlt?.id;
              return (
                <motion.button
                  key={a.id}
                  type="button"
                  onClick={() => onAkte(a.id)}
                  aria-pressed={aktiv}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 460, damping: 34, delay: Math.min(i, 10) * 0.03 }}
                  className={cn(
                    "relative flex w-[78%] shrink-0 snap-start flex-col gap-1.5 rounded-[18px] p-3.5 text-left transition-[background-color,box-shadow,transform] duration-300 ease-[var(--spring)] active:scale-[0.98] sm:w-auto",
                    aktiv ? "bg-[var(--ink-softer)]" : "ring-1 ring-[var(--line)] hover:-translate-y-0.5 hover:bg-[var(--ink-softer)]",
                  )}
                >
                  {aktiv && <motion.span layoutId="ki-akte-auswahl" className="pointer-events-none absolute inset-0 rounded-[18px] ring-2 ring-[var(--ink)]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                  <span className="flex items-center gap-2">
                    <span className="mono text-[12px] text-fg-3">{a.aktenzeichen}</span>
                    {a.prioritaet === "hoch" && <span className="size-1.5 rounded-full bg-[var(--seal)]" title="Hohe Priorität" />}
                    <span className="ml-auto">
                      {aktiv ? (
                        <span className="grid size-5 place-items-center rounded-full bg-[var(--ink)] text-[var(--on-ink)]">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : (
                        <Chip className="!h-5 !text-[10.5px]">{a.sachgebiet}</Chip>
                      )}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug tracking-[-0.01em]">{a.titel}</span>
                  <span className="mt-auto flex items-center gap-2 text-[11.5px] text-fg-3">
                    <span className="min-w-0 flex-1 truncate">{a.phase}{mandantName(a) ? ` · ${mandantName(a)}` : ""}</span>
                    {a.kiAnalyse && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-violet" title={`Letzte KI-Analyse ${relTime(a.kiAnalyse.erstelltAm)}`}>
                        <Gauge className="size-3.5" />
                        <span className="num">{a.kiAnalyse.prozent} %</span>
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[14px] bg-[var(--ink-softer)] px-4 py-3 text-[13px] text-fg-3">Keine offene Akte passt zu „{q}“.</p>
        )}
        {liste.gesamt > MAX_KARTEN && (
          <p className="mt-3 text-[12px] text-fg-4">
            {liste.top.length} von {liste.gesamt} Akten – mit der Suche finden Sie jede weitere.
          </p>
        )}
      </Card>

      {gewaehlt && (
        <motion.div ref={panelRef} key={gewaehlt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className={cn("min-w-0 scroll-mt-24", fokusId === gewaehlt.id && "min-h-[calc(100dvh-8rem)]")}>
          <FallanalysePanel
            key={gewaehlt.id}
            akteId={gewaehlt.id}
            autoStart={startFuer === gewaehlt.id}
            onAutoStart={() => {
              setStartFuer(null);
              onAutoStart?.(); // ?start=1 aus der Adresse entfernen – Neuladen startet nicht erneut
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

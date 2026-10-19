import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, FolderOpen, Gauge } from "lucide-react";
import type { Akte } from "@/core/types";
import { search } from "@/core/search";
import { relTime } from "@/core/dates";
import { stufeWort } from "@/core/einschaetzung";
import { useData } from "@/store/data";
import { FallanalysePanel } from "@/components/ki/FallanalysePanel";
import { Card, Chip, Empty, SearchField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";

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
        <Empty icon={<FolderOpen />} title="Keine offene Akte" text="Legen Sie eine Akte an – danach analysiert die KI Sachverhalt, Präzedenzfälle und Erfolgsaussicht." />
      </Card>
    );
  }

  const mandantName = (a: Akte) => kontakte.find((k) => k.id === a.mandantId)?.name;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Card className="min-w-0 !p-4 sm:!p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="title-md">Akte wählen</h2>
            <p className="mt-0.5 text-[13px] leading-[18px] text-fg-3">Die KI liest Sachverhalt, Dokumente, Notizen und an die Akte geheftete Entscheidungen.</p>
          </div>
          <SearchField id="ki-akte-suche" value={q} onChange={setQ} placeholder={`${offene.length} offene Akten durchsuchen …`} className="w-full sm:w-[300px]" />
        </div>

        {liste.top.length ? (
          // Auswahl als ruhige Liste mit Linien (keine Karten in der Karte); gewählt = Fläche 3 + 2-px-Balken + Haken
          <ul className="grid grid-cols-1 gap-x-6 border-t border-[var(--line)] lg:grid-cols-2">
            {liste.top.map((a) => {
              const aktiv = a.id === gewaehlt?.id;
              return (
                <li key={a.id} className="min-w-0 border-b border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => onAkte(a.id)}
                    aria-pressed={aktiv}
                    className={cn(
                      "flex w-full min-w-0 items-start gap-3 px-3 py-3 text-left transition-colors duration-100 focus-visible:outline-offset-[-2px]",
                      aktiv ? "bg-[var(--surface-3)] shadow-[inset_2px_0_0_var(--ink)]" : "hover:bg-[var(--surface-2)]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="mono text-[13px] text-fg-3">{a.aktenzeichen}</span>
                        {a.prioritaet === "hoch" && <span className="text-[12px] text-fg-4">· hohe Priorität</span>}
                        <Chip className="ml-auto">{a.sachgebiet}</Chip>
                      </span>
                      <span className={cn("mt-0.5 block break-words text-[14px] leading-5 text-fg", aktiv ? "font-semibold" : "font-medium")}>{a.titel}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px] text-fg-4">
                        <span className="min-w-0">
                          {a.phase}
                          {mandantName(a) ? ` · ${mandantName(a)}` : ""}
                        </span>
                        {a.kiAnalyse && (
                          <span className="inline-flex shrink-0 items-center gap-1" title={`Letzte KI-Analyse ${relTime(a.kiAnalyse.erstelltAm)} – Einschätzung, keine Prozentangabe`}>
                            <Gauge className="size-3.5" aria-hidden />
                            <span>{stufeWort(a.kiAnalyse.stufe, a.kiAnalyse.prozent)}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center", aktiv ? "text-fg" : "text-transparent")} aria-hidden>
                      <Check className="size-4" strokeWidth={2} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-t border-[var(--line)] py-4 text-[14px] text-fg-3">Keine offene Akte passt zu „{q}“.</p>
        )}
        {liste.gesamt > MAX_KARTEN && (
          <p className="mt-3 text-[13px] text-fg-4">
            {liste.top.length} von {liste.gesamt} Akten – mit der Suche finden Sie jede weitere.
          </p>
        )}
      </Card>

      {gewaehlt && (
        <motion.div ref={panelRef} key={gewaehlt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={BEWEGUNG.standard} className={cn("min-w-0 scroll-mt-24", fokusId === gewaehlt.id && "min-h-[calc(100dvh-8rem)]")}>
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

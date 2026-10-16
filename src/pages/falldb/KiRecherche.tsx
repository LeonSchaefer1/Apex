import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, BrainCircuit, ChevronRight, Database, FolderInput, RotateCcw, Scale, Sparkles, Square } from "lucide-react";
import { useData } from "@/store/data";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { fmtNum } from "@/core/dates";
import { AiChip, Button, Chip, Select, Textarea } from "@/components/ui";
import { KiSchritte, usePipeline, type KiSchritt } from "@/pages/ki/KiSchritte";
import { BEISPIEL_SACHVERHALTE, kiRecherche, zitat, type RechercheErgebnis } from "./recherche";
import { GerichtSiegel } from "./EntscheidungKarte";
import { cn } from "@/lib/cn";

const SCHRITTE: KiSchritt[] = [
  { label: "Sachverhalt verstehen", detail: "Merkmale & Rechtsfragen", icon: <BrainCircuit /> },
  { label: "Datenbank durchsuchen", detail: `${ENTSCHEIDUNGEN.length} Entscheidungen`, icon: <Database /> },
  { label: "Relevanz bewerten", detail: "Begründung je Treffer", icon: <Scale /> },
];

/** KI-Recherche: Sachverhalt in eigenen Worten → die passendsten Entscheidungen mit Begründung. */
export function KiRecherche({ startText, onOpen }: { startText?: string; onOpen: (id: string) => void }) {
  const quelle = useAiStatus((s) => s.quelle);
  const live = quelle !== "demo";
  const akten = useData((s) => s.data.akten);
  const offene = useMemo(() => akten.filter((a) => a.status === "offen").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [akten]);
  const [text, setText] = useState(startText ?? "");
  const [ergebnis, setErgebnis] = useState<RechercheErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const ergebnisRef = useRef<HTMLElement>(null);
  const { aktiv, lauf, zuruecksetzen } = usePipeline(SCHRITTE.length, live ? 700 : 560);

  useEffect(() => {
    if (startText) setText(startText);
  }, [startText]);
  useEffect(() => () => abort.current?.abort(), []);

  const starten = async () => {
    if (text.trim().length < 12) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setFehler(null);
    setErgebnis(null);
    setLaeuft(true);
    try {
      const r = await lauf(() => kiRecherche(text, { live, signal: ctl.signal }));
      if (!ctl.signal.aborted) {
        setErgebnis(r);
        // Auf dem Smartphone liegen die Treffer unterhalb – sanft dorthin scrollen
        if (window.matchMedia("(max-width: 767px)").matches) setTimeout(() => ergebnisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
    } catch (e) {
      if (!ctl.signal.aborted) setFehler(e instanceof Error ? e.message : "Die Recherche ist fehlgeschlagen.");
      zuruecksetzen();
    } finally {
      setLaeuft(false);
    }
  };

  const abbrechen = () => {
    abort.current?.abort();
    setLaeuft(false);
    zuruecksetzen();
  };

  const ausAkte = (id: string) => {
    const a = akten.find((x) => x.id === id);
    if (a) setText(a.beschreibung);
  };

  return (
    <div className="mt-5 grid gap-4">
      <div className={cn("relative rounded-[22px] transition-shadow", laeuft && "ai-ring ai-glow")}>
        <label htmlFor="falldb-sachverhalt" className="sr-only">
          Sachverhalt
        </label>
        <Textarea
          id="falldb-sachverhalt"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void starten();
          }}
          placeholder="Schildern Sie den Sachverhalt in eigenen Worten – z. B. „Mandant nach 14 Jahren fristlos gekündigt, weil er beschädigte Ware aus dem Müll mitgenommen hat. Keine Abmahnung.“"
          className="!rounded-[22px] !px-5 !py-4 text-[15px] leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-fg-3">Beispiele:</span>
        {BEISPIEL_SACHVERHALTE.map((b) => (
          <button key={b.titel} type="button" onClick={() => setText(b.text)} className="chip !h-7 !px-3 transition-colors hover:bg-ink-soft hover:text-ink">
            {b.titel}
          </button>
        ))}
        {offene.length > 0 && (
          <div className="relative ml-auto w-full sm:w-auto">
            <FolderInput className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
            <Select
              id="falldb-aus-akte"
              aria-label="Sachverhalt aus Akte übernehmen"
              value=""
              onChange={(e) => ausAkte(e.target.value)}
              className="!h-9 !rounded-full !pl-9 text-[13px] sm:!w-[260px]"
            >
              <option value="" disabled>
                Aus Akte übernehmen …
              </option>
              {offene.slice(0, 40).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.aktenzeichen} · {a.titel}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {laeuft ? (
          <Button variant="secondary" icon={<Square className="size-3.5" />} onClick={abbrechen}>
            Abbrechen
          </Button>
        ) : (
          <Button variant="ai" size="lg" icon={<Sparkles className="size-4" />} onClick={() => void starten()} disabled={text.trim().length < 12}>
            Recherche starten
          </Button>
        )}
        <span className="flex items-center gap-2 text-[12px] text-fg-3">
          {live ? <AiChip>Claude live</AiChip> : <Chip>{DEMO_KI_NAME}</Chip>}
          <span className="hidden sm:inline">{live ? "Claude wählt ausschließlich aus der Fall-Datenbank aus." : "Regelbasierte Recherche, vollständig lokal."}</span>
        </span>
        <span className="ml-auto hidden text-[12.5px] text-fg-3 md:inline">
          <span className="kbd">⌘/Strg</span> <span className="kbd">↵</span> startet
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {(laeuft || (aktiv >= 0 && !ergebnis && !fehler)) && (
          <motion.div key="schritte" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="rounded-[20px] bg-[var(--ink-softer)] p-3">
            <div className="mb-1 px-1 text-[12px] font-medium text-fg-3">Recherche läuft …</div>
            <KiSchritte schritte={SCHRITTE} aktiv={aktiv} />
          </motion.div>
        )}

        {fehler && (
          <motion.div key="fehler" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="flex items-start gap-2 rounded-[14px] bg-seal-soft px-3.5 py-3 text-[13px] text-seal">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{fehler} Bitte versuchen Sie es erneut.</span>
          </motion.div>
        )}

        {ergebnis && (
          <motion.section ref={ergebnisRef} key="ergebnis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid scroll-mt-24 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="title-md">{ergebnis.treffer.length ? `${ergebnis.treffer.length} passende Entscheidungen` : "Keine passende Entscheidung gefunden"}</div>
              {ergebnis.quelle === "live" ? <AiChip>Claude</AiChip> : <Chip>{DEMO_KI_NAME}</Chip>}
              <span className="num text-[12px] text-fg-3">
                {ergebnis.dauerMs < 1000 ? `${Math.max(1, Math.round(ergebnis.dauerMs))} ms` : `${fmtNum(ergebnis.dauerMs / 1000, 1)} s`} · {ENTSCHEIDUNGEN.length} Entscheidungen bewertet
              </span>
              <Button variant="ghost" size="sm" className="ml-auto" icon={<RotateCcw className="size-4" />} onClick={() => (setErgebnis(null), zuruecksetzen())}>
                Neue Recherche
              </Button>
            </div>
            {ergebnis.hinweis && (
              <div className="flex items-start gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] text-amber">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{ergebnis.hinweis}</span>
              </div>
            )}
            {!ergebnis.treffer.length && (
              <p className="rounded-[16px] bg-[var(--ink-softer)] px-4 py-3 text-[13px] text-fg-2">
                Im Demo-Auszug gibt es zu diesem Sachverhalt keine passende Leitentscheidung. Beschreiben Sie Rechtsgebiet und Kernproblem etwas genauer – oder nutzen Sie die Stichwortsuche nach Normen (z. B. „§ 573 BGB“).
              </p>
            )}
            <ol className="grid gap-2.5 lg:grid-cols-2">
              {ergebnis.treffer.map((t, i) => (
                <motion.li key={t.entscheidung.id} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.08 + i * 0.07 }} className="min-w-0">
                  <button type="button" onClick={() => onOpen(t.entscheidung.id)} className="sheet glow group relative flex h-full w-full flex-col gap-3 rounded-[20px] p-4 text-left transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass">
                    <span className="relative z-[1] flex items-start gap-3">
                      <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[12px] font-semibold text-[var(--surface)]">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold leading-snug">{t.entscheidung.titel}</span>
                        <span className="mono mt-0.5 block truncate text-[12.5px] text-fg-3">{zitat(t.entscheidung)}</span>
                      </span>
                      <span className="w-[64px] shrink-0 text-right">
                        <span className="num block text-[12px] font-semibold text-ink">{t.relevanz} %</span>
                        <span className="bar mt-1 block !h-1">
                          <motion.span initial={{ width: 0 }} animate={{ width: `${t.relevanz}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ transition: "none" }} />
                        </span>
                      </span>
                    </span>
                    <span className="relative z-[1] flex items-start gap-2 rounded-[14px] bg-violet-soft px-3 py-2.5 text-[13px] leading-snug text-fg-2">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet" />
                      <span>
                        <span className="font-semibold text-fg">Warum relevant: </span>
                        {t.begruendung}
                      </span>
                    </span>
                    <span className="relative z-[1] mt-auto flex items-center gap-2">
                      <GerichtSiegel e={t.entscheidung} groesse="sm" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-fg-3">{t.entscheidung.normen.join(" · ")}</span>
                      <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </motion.li>
              ))}
            </ol>
            {ergebnis.treffer.length > 0 && (
              <p className="text-[12.5px] text-fg-3">
                Die KI wählt nur aus geprüften Entscheidungen der Fall-Datenbank
                {ergebnis.verworfen ? ` – ${ergebnis.verworfen} ${ergebnis.verworfen === 1 ? "Vorschlag wurde" : "Vorschläge wurden"} verworfen, weil ${ergebnis.verworfen === 1 ? "er" : "sie"} dort nicht verzeichnet ${ergebnis.verworfen === 1 ? "ist" : "sind"}` : ""}. Leitsätze sind sinngemäß zusammengefasst – vor Verwendung im Schriftsatz bitte im Original prüfen.
              </p>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

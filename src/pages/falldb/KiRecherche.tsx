import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, BrainCircuit, ChevronRight, CircleDashed, Database, FolderInput, RotateCcw, Scale, Sparkles, Square } from "lucide-react";
import { useData } from "@/store/data";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { fmtNum } from "@/core/dates";
import { AiChip, Button, Chip, Select, Textarea } from "@/components/ui";
import { KiSchritte, usePipeline, type KiSchritt } from "@/pages/ki/KiSchritte";
import { BEISPIEL_SACHVERHALTE, kiRecherche, zitat, type RechercheErgebnis } from "./recherche";
import { GerichtSiegel } from "./EntscheidungKarte";
import { BEWEGUNG } from "@/lib/bewegung";

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
      <div className="relative">
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
          className="!px-4 !py-3 text-[15px] leading-6"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-fg-3">Beispiele:</span>
        {BEISPIEL_SACHVERHALTE.map((b) => (
          <button key={b.titel} type="button" onClick={() => setText(b.text)} className="chip chip-outline !h-7 !px-2.5 transition-colors duration-100 hover:bg-[var(--surface-2)] hover:text-fg">
            {b.titel}
          </button>
        ))}
        {offene.length > 0 && (
          <div className="relative ml-auto w-full sm:w-auto">
            <FolderInput className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-4" aria-hidden />
            <Select
              id="falldb-aus-akte"
              aria-label="Sachverhalt aus Akte übernehmen"
              value=""
              onChange={(e) => ausAkte(e.target.value)}
              className="!h-8 !pl-9 text-[13px] sm:!w-[260px]"
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
          <Button variant="primary" size="lg" icon={<Sparkles className="size-4" />} onClick={() => void starten()} disabled={text.trim().length < 12}>
            Recherche starten
          </Button>
        )}
        <span className="flex items-center gap-2 text-[13px] text-fg-3">
          {live ? <AiChip>Claude live</AiChip> : <AiChip>{DEMO_KI_NAME}</AiChip>}
          <span className="hidden sm:inline">{live ? "Claude wählt ausschließlich aus der Fall-Datenbank aus." : "Regelbasierte Recherche, vollständig lokal."}</span>
        </span>
        <span className="ml-auto hidden text-[13px] text-fg-3 md:inline">
          <span className="kbd">⌘/Strg</span> <span className="kbd">↵</span> startet
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {(laeuft || (aktiv >= 0 && !ergebnis && !fehler)) && (
          <motion.div key="schritte" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="sheet rounded-lg p-4">
            <div className="mb-2 text-[13px] font-medium text-fg-3">Recherche läuft …</div>
            <KiSchritte schritte={SCHRITTE} aktiv={aktiv} />
          </motion.div>
        )}

        {fehler && (
          <motion.div key="fehler" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} role="alert" className="banner banner-seal">
            <AlertTriangle aria-hidden />
            <span className="text-seal-text">{fehler} Bitte versuchen Sie es erneut.</span>
          </motion.div>
        )}

        {ergebnis && (
          <motion.section ref={ergebnisRef} key="ergebnis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="grid scroll-mt-24 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="title-md">{ergebnis.treffer.length ? `${ergebnis.treffer.length} passende Entscheidungen` : "Keine passende Entscheidung gefunden"}</div>
              {ergebnis.quelle === "live" ? <AiChip>Claude</AiChip> : <AiChip>{DEMO_KI_NAME}</AiChip>}
              <span className="num text-[13px] text-fg-4">
                {ergebnis.dauerMs < 1000 ? `${Math.max(1, Math.round(ergebnis.dauerMs))} ms` : `${fmtNum(ergebnis.dauerMs / 1000, 1)} s`} · {ENTSCHEIDUNGEN.length} Entscheidungen bewertet
              </span>
              <Button variant="ghost" size="sm" className="ml-auto" icon={<RotateCcw className="size-4" />} onClick={() => (setErgebnis(null), zuruecksetzen())}>
                Neue Recherche
              </Button>
            </div>
            {ergebnis.hinweis && (
              <div className="banner banner-amber">
                <AlertTriangle aria-hidden />
                <span>{ergebnis.hinweis}</span>
              </div>
            )}
            {!ergebnis.treffer.length && (
              <p className="banner">
                Im Demo-Auszug gibt es zu diesem Sachverhalt keine passende Leitentscheidung. Beschreiben Sie Rechtsgebiet und Kernproblem etwas genauer – oder nutzen Sie die Stichwortsuche nach Normen (z. B. „§ 573 BGB“).
              </p>
            )}
            <ol className="sheet divide-y divide-[var(--line)] overflow-hidden rounded-lg">
              {ergebnis.treffer.map((t, i) => (
                <li key={t.entscheidung.id} className="min-w-0">
                  <button type="button" onClick={() => onOpen(t.entscheidung.id)} className="group flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px] sm:px-5">
                    <span className="flex items-start gap-3">
                      <span className="num grid size-6 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] text-[12px] font-medium text-fg-2">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold leading-snug">{t.entscheidung.titel}</span>
                        <span className="mono mt-0.5 block truncate text-[13px] text-fg-3">{zitat(t.entscheidung)}</span>
                      </span>
                      {t.schwach ? (
                        // Schwacher Treffer: kein Prozentbalken, sondern der Grund in Worten (I4-T06-03)
                        <span className="shrink-0">
                          <Chip tone="amber" icon={<CircleDashed className="size-3" aria-hidden />} className="max-w-[180px] !whitespace-normal !text-left leading-tight" title="Passt nur über ein allgemeines Merkmal – vor Verwendung genau prüfen">
                            {t.schwach.grund}
                          </Chip>
                        </span>
                      ) : (
                        <span className="w-[64px] shrink-0 text-right">
                          <span className="num block text-[13px] font-medium text-fg">{t.relevanz} %</span>
                          <span className="bar mt-1 block">
                            <span style={{ width: `${t.relevanz}%` }} />
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="flex items-start gap-2 pl-9 text-[14px] leading-5 text-fg-2">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-fg-4" aria-hidden />
                      <span>
                        <span className="font-medium text-fg">Warum relevant: </span>
                        {t.begruendung}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 pl-9">
                      <GerichtSiegel e={t.entscheidung} groesse="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-3">{t.entscheidung.normen.join(" · ")}</span>
                      <ChevronRight className="size-4 shrink-0 text-fg-4" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {ergebnis.treffer.length > 0 && (
              <p className="text-[13px] leading-[18px] text-fg-4">
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

import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { BrainCircuit, FileScan, FileSignature } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui";
import { useIsMobile } from "@/lib/useMedia";
import { KiStatusKarte } from "./KiStatusKarte";
import { FallanalyseTab } from "./FallanalyseTab";
import { DokumentAnalyseTab } from "./DokumentAnalyseTab";
import { SchriftsatzTab } from "./SchriftsatzTab";

type Tab = "fallanalyse" | "dokument" | "schriftsatz";
const TABS: Tab[] = ["fallanalyse", "dokument", "schriftsatz"];

const ERKLAERUNG: Record<Tab, string> = {
  fallanalyse: "Erfolgsaussicht, Argumente, Risiken, passende Präzedenzfälle und nächste Schritte – für jede Akte, mit Quellen.",
  dokument: "Schreiben einfügen: Die KI erkennt Typ, Akte und Fristart – das Fristende berechnet der Fristenrechner.",
  schriftsatz: "Mandantenbriefe, Deckungsanfragen und Schriftsatz-Gerüste aus den Daten der Akte – ohne erfundene Tatsachen.",
};

/** Apex KI: Fallanalyse, Dokument-Analyse und Schriftsatz-Assistent – das KI-Schaufenster der Kanzlei. */
export default function KiStudio() {
  const [params, setParams] = useSearchParams();
  const roh = params.get("tab");
  const tab: Tab = TABS.includes(roh as Tab) ? (roh as Tab) : "fallanalyse";
  const akteParam = params.get("akte") ?? undefined;
  // Deep-Link aus dem Cockpit (?start=1): Fallanalyse der Akte sofort starten und sichtbar machen.
  const startWunsch = tab === "fallanalyse" && params.get("start") === "1";
  const mobil = useIsMobile();

  const setze = (werte: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        for (const [k, v] of Object.entries(werte)) {
          if (v) n.set(k, v);
          else n.delete(k);
        }
        return n;
      },
      { replace: true },
    );

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Intelligenz"
        title={
          <>
            Apex <span className="ai-text">KI</span>
          </>
        }
        hilfe="ki"
        subtitle="Fallanalyse, Dokument-Analyse und Schriftsatz-Entwürfe – nachvollziehbar und geprüft."
      />

      <KiStatusKarte />

      <div className="mb-5 mt-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Segmented<Tab>
          className="sm:shrink-0"
          full={mobil}
          value={tab}
          onChange={(t) => setze({ tab: t === "fallanalyse" ? null : t, start: null })}
          options={[
            { value: "fallanalyse", label: "Fallanalyse", icon: mobil ? undefined : <BrainCircuit className="size-4" /> },
            { value: "dokument", label: mobil ? "Dokument" : "Dokument-Analyse", icon: mobil ? undefined : <FileScan className="size-4" /> },
            { value: "schriftsatz", label: mobil ? "Schriftsatz" : "Schriftsatz-Assistent", icon: mobil ? undefined : <FileSignature className="size-4" /> },
          ]}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="min-w-0 text-[12.5px] leading-snug text-fg-3">
            {ERKLAERUNG[tab]}
          </motion.p>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ type: "spring", stiffness: 420, damping: 36 }} className="min-w-0">
          {tab === "fallanalyse" && <FallanalyseTab akteId={akteParam} onAkte={(id) => setze({ akte: id, start: null })} autoStart={startWunsch} onAutoStart={() => setze({ start: null })} />}
          {tab === "dokument" && <DokumentAnalyseTab akteParam={akteParam} />}
          {tab === "schriftsatz" && <SchriftsatzTab akteParam={akteParam} onAkte={(id) => setze({ akte: id })} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { PageHeader } from "@/components/ui";
import { useIsMobile } from "@/lib/useMedia";
import { Reiter } from "@/pages/einstellungen/Reiter";
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

/** Apex KI: Fallanalyse, Dokument-Analyse und Schriftsatz-Entwurf – das KI-Schaufenster der Kanzlei. */
export default function KiStudio() {
  const [params, setParams] = useSearchParams();
  const roh = params.get("tab");
  const tab: Tab = TABS.includes(roh as Tab) ? (roh as Tab) : "fallanalyse";
  const akteParam = params.get("akte") ?? undefined;
  // Deep-Link aus dem Dokumentbetrachter der Akte: /ki?tab=dokument&akte=<id>&dok=<dokId>
  const dokParam = params.get("dok") ?? undefined;
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
        title="Apex KI"
        hilfe="ki"
        subtitle="Fallanalyse, Dokument-Analyse und Schriftsatz-Entwürfe – nachvollziehbar und geprüft."
      />

      <KiStatusKarte />

      <div className="mb-6 mt-8">
        <Reiter<Tab>
          label="Bereiche der Apex KI"
          value={tab}
          onChange={(t) => setze({ tab: t === "fallanalyse" ? null : t, start: null, dok: null })}
          options={[
            { value: "fallanalyse", label: "Fallanalyse" },
            { value: "dokument", label: mobil ? "Dokument" : "Dokument-Analyse" },
            { value: "schriftsatz", label: mobil ? "Schriftsatz" : "Schriftsatz-Entwurf" },
          ]}
        />
        <p className="mt-3 min-w-0 max-w-[72ch] text-[14px] leading-5 text-fg-3">{ERKLAERUNG[tab]}</p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12, ease: "linear" }} className="min-w-0">
          {tab === "fallanalyse" && <FallanalyseTab akteId={akteParam} onAkte={(id) => setze({ akte: id, start: null })} autoStart={startWunsch} onAutoStart={() => setze({ start: null })} />}
          {tab === "dokument" && <DokumentAnalyseTab akteParam={akteParam} dokParam={dokParam} />}
          {tab === "schriftsatz" && <SchriftsatzTab akteParam={akteParam} onAkte={(id) => setze({ akte: id })} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

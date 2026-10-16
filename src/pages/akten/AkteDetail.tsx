import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, FolderSearch, Sparkles } from "lucide-react";
import { useCol, useData } from "@/store/data";
import { Button, Card, Empty, Segmented } from "@/components/ui";
import { FallanalysePanel } from "@/components/ki/FallanalysePanel";
import { AkteKopf } from "./AkteKopf";
import { TabUebersicht } from "./TabUebersicht";
import { TabDokumente } from "./TabDokumente";
import { TabFristen } from "./TabFristen";
import { TabBeteiligte } from "./TabBeteiligte";
import { TabAktenkonto } from "./TabAktenkonto";
import { TabVerlauf } from "./TabVerlauf";
import { FristAnlegen } from "./FristAnlegen";
import { EmailComposer } from "./EmailComposer";
import { listenKontext } from "./helfer";

const TABS = ["uebersicht", "dokumente", "fristen", "beteiligte", "aktenkonto", "verlauf", "ki"] as const;
type TabKey = (typeof TABS)[number];

/** Akte – alles zu einem Mandat an einem Ort: E-Akte, Fristen, Beteiligte, Aktenkonto, Verlauf und KI-Fallanalyse. */
export default function AkteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const akte = useData((s) => s.data.akten.find((a) => a.id === id));
  const dokumente = useCol("dokumente");
  const fristen = useCol("fristen");
  const [params, setParams] = useSearchParams();
  const roh = params.get("tab") as TabKey | null;
  const tab: TabKey = roh && TABS.includes(roh) ? roh : "uebersicht";
  const [emailOffen, setEmailOffen] = useState(false);
  const [fristOffen, setFristOffen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const zahlen = useMemo(
    () => ({
      doks: dokumente.filter((d) => d.akteId === id).length,
      fristen: fristen.filter((f) => f.akteId === id && f.status === "offen" && f.typ !== "vorfrist").length,
    }),
    [dokumente, fristen, id],
  );

  const setTab = useCallback(
    (t: string, extra?: Record<string, string>) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (t === "uebersicht") n.delete("tab");
          else n.set("tab", t);
          n.delete("dok");
          for (const [k, v] of Object.entries(extra ?? {})) n.set(k, v);
          return n;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const zuTabs = (t: string, extra?: Record<string, string>) => {
    setTab(t, extra);
    requestAnimationFrame(() => {
      const el = tabsRef.current;
      const sc = document.getElementById("haupt-scroll");
      if (el && sc) {
        const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 88;
        if (top < sc.scrollTop) sc.scrollTo({ top, behavior: "smooth" });
        else if (el.getBoundingClientRect().top > window.innerHeight * 0.6) sc.scrollTo({ top, behavior: "smooth" });
      }
    });
  };

  if (!akte) {
    return (
      <Card className="mt-6">
        <Empty
          icon={<FolderSearch className="size-6" />}
          title="Akte nicht gefunden"
          text="Diese Akte gibt es nicht (mehr) oder sie gehört zu einer anderen Kanzlei. Über die Aktenliste finden Sie alle Mandate."
          action={
            <Button variant="primary" onClick={() => nav("/akten")}>
              Zur Aktenliste
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="-mb-1 flex items-center gap-2">
        <Link to={`/akten${listenKontext.suche}`} className="inline-flex h-8 items-center gap-1 rounded-full pl-1.5 pr-3 text-[13px] font-medium text-fg-3 transition-colors hover:bg-ink-softer hover:text-fg">
          <ChevronLeft className="size-4" /> Alle Akten
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
        <AkteKopf akte={akte} onEmail={() => setEmailOffen(true)} onFrist={() => setFristOffen(true)} onKi={() => zuTabs("ki")} />
      </motion.div>

      <div ref={tabsRef} className="grid grid-cols-1 gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Segmented<TabKey>
            value={tab}
            onChange={(t) => setTab(t)}
            className="max-w-full"
            options={[
              { value: "uebersicht", label: "Übersicht" },
              { value: "dokumente", label: "Dokumente", count: zahlen.doks },
              { value: "fristen", label: "Fristen", count: zahlen.fristen },
              { value: "beteiligte", label: "Beteiligte" },
              { value: "aktenkonto", label: akte.forderung ? "Aktenkonto & Forderung" : "Aktenkonto" },
              { value: "verlauf", label: "Verlauf" },
              { value: "ki", label: <span className={tab === "ki" ? "ai-text font-semibold" : undefined}>KI-Fallanalyse</span>, icon: <Sparkles className={tab === "ki" ? "size-3.5 text-violet" : "size-3.5"} /> },
            ]}
          />
        </div>
        <p className="-mt-1 px-1 text-[12.5px] text-fg-3">{TAB_ERKLAERUNG[tab]}</p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} className="min-w-0">
            {tab === "uebersicht" && <TabUebersicht akte={akte} onTab={(t) => zuTabs(t)} onDok={(d) => zuTabs("dokumente", { dok: d })} onFrist={() => setFristOffen(true)} />}
            {tab === "dokumente" && <TabDokumente akte={akte} />}
            {tab === "fristen" && <TabFristen akte={akte} onNeu={() => setFristOffen(true)} />}
            {tab === "beteiligte" && <TabBeteiligte akte={akte} />}
            {tab === "aktenkonto" && <TabAktenkonto akte={akte} />}
            {tab === "verlauf" && <TabVerlauf akte={akte} />}
            {tab === "ki" && <FallanalysePanel akteId={akte.id} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <FristAnlegen akte={akte} open={fristOffen} onClose={() => setFristOffen(false)} />
      <EmailComposer akte={akte} open={emailOffen} onClose={() => setEmailOffen(false)} onGesendet={(dokId) => setTab("dokumente", { dok: dokId })} />
    </div>
  );
}

const TAB_ERKLAERUNG: Record<TabKey, string> = {
  uebersicht: "Das Wichtigste auf einen Blick: Sachverhalt, anstehende Fristen, neue Dokumente und interne Notizen.",
  dokumente: "Die E-Akte: alle Schriftstücke in Ordnern – durchsuchbar im Volltext, per Drag & Drop sortierbar, per Doppelklick umbenennbar.",
  fristen: "Alle Fristen, Wiedervorlagen und Termine dieser Akte – berechnet je Verfahrensordnung (z. B. § 222 ZPO, § 43 StPO) mit Rechenweg und Vier-Augen-Kontrolle.",
  beteiligte: "Wer an der Sache beteiligt ist – mit Kontaktdaten zum Kopieren und Verknüpfung ins Kontaktverzeichnis.",
  aktenkonto: "Honorar, Zahlungen, Vorschüsse und Fremdgeld dieser Akte – bei Forderungseinzug mit taggenauem Forderungskonto.",
  verlauf: "Lückenlose Chronik: was Ihr Team, die KI und der 38h-Motor in dieser Akte getan haben.",
  ki: "Erfolgsaussicht, passende Präzedenzfälle und nächste Schritte – nachvollziehbar mit Quellen.",
};

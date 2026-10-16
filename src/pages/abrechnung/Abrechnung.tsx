// Abrechnung: RVG-Rechner, Sammelabrechnung, Forderungskonto und automatischer Bankabgleich.
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, Landmark, LayoutGrid, Layers, Percent, Receipt, Scale, Timer } from "lucide-react";
import { Button, PageHeader, Segmented, type SegOption } from "@/components/ui";
import { useCol } from "@/store/data";
import { BankabgleichTab } from "./Bankabgleich";
import { ForderungskontoTab } from "./Forderungskonto";
import { TAB_KEYS, type TabKey } from "./lib";
import { RechnungenTab } from "./Rechnungen";
import { RechnungVorschau } from "./RechnungVorschau";
import { RvgRechnerTab } from "./RvgRechner";
import { Sammelabrechnung } from "./Sammelabrechnung";
import { useAbrechnungUI } from "./store";
import { UebersichtTab } from "./Uebersicht";
import { ZeiterfassungTab } from "./Zeiterfassung";
import { ZinsrechnerTab } from "./Zinsrechner";

const TAB_LABEL: Record<TabKey, string> = { uebersicht: "Übersicht", rechnungen: "Rechnungen", rvg: "RVG-Rechner", bank: "Bankabgleich", forderung: "Forderungskonto", zinsen: "Zinsrechner", zeit: "Zeiterfassung" };

export default function Abrechnung() {
  const [params, setParams] = useSearchParams();
  const roh = params.get("tab") as TabKey | null;
  const tab: TabKey = roh && TAB_KEYS.includes(roh) ? roh : "uebersicht";
  const { rechnungId, oeffneRechnung, sammelOffen, setSammel, timerStart } = useAbrechnungUI();
  const offeneUmsaetze = useCol("transaktionen").filter((t) => t.status === "offen").length;

  const setTab = useCallback(
    (t: TabKey, extra?: Record<string, string>) =>
      setParams(
        () => {
          const p = new URLSearchParams();
          if (t !== "uebersicht") p.set("tab", t);
          for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
          return p;
        },
        { replace: false },
      ),
    [setParams],
  );

  // Direktlink auf die Sammelabrechnung: /abrechnung?aktion=sammelabrechnung öffnet den Dialog (Parameter danach entfernt)
  const aktion = params.get("aktion");
  useEffect(() => {
    if (aktion !== "sammelabrechnung") return;
    setSammel(true);
    const p = new URLSearchParams(params);
    p.delete("aktion");
    setParams(p, { replace: true });
  }, [aktion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Direktlink auf eine Rechnung: /abrechnung?tab=rechnungen&rechnung=<id>
  const linkRechnung = params.get("rechnung");
  useEffect(() => {
    if (linkRechnung) oeffneRechnung(linkRechnung);
  }, [linkRechnung, oeffneRechnung]);
  const schliesseRechnung = () => {
    oeffneRechnung(null);
    if (linkRechnung) {
      const p = new URLSearchParams(params);
      p.delete("rechnung");
      setParams(p, { replace: true });
    }
  };

  // Aktiven Reiter auf schmalen Bildschirmen in den sichtbaren Bereich holen
  const leiste = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = leiste.current?.querySelector<HTMLElement>("[aria-selected=true]");
    const box = el?.parentElement;
    if (el && box && box.scrollWidth > box.clientWidth) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [tab]);

  // Dialoge beim Verlassen der Seite schließen
  useEffect(() => () => useAbrechnungUI.setState({ rechnungId: null, sammelOffen: false }), []);

  const tabs: SegOption<TabKey>[] = [
    { value: "uebersicht", label: "Übersicht", icon: <LayoutGrid className="size-3.5" /> },
    { value: "rechnungen", label: "Rechnungen", icon: <Receipt className="size-3.5" /> },
    { value: "rvg", label: "RVG-Rechner", icon: <Calculator className="size-3.5" /> },
    { value: "bank", label: "Bankabgleich", icon: <Landmark className="size-3.5" />, count: offeneUmsaetze || undefined },
    { value: "forderung", label: "Forderungskonto", icon: <Scale className="size-3.5" /> },
    { value: "zinsen", label: "Zinsrechner", icon: <Percent className="size-3.5" /> },
    {
      value: "zeit",
      label: (
        <span className="inline-flex items-center gap-1.5">
          Zeiterfassung
          {timerStart && <span className="size-1.5 animate-pulse rounded-full bg-seal" title="Stoppuhr läuft" />}
        </span>
      ),
      icon: <Timer className="size-3.5" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Abrechnung"
        hilfe="abrechnung"
        subtitle="RVG-Rechner, Sammelabrechnung, Forderungskonto, Zinsrechner und automatischer Bankabgleich – Honorare vollständig abrechnen, Zahlungen ohne Handarbeit zuordnen."
        actions={
          <Button variant="primary" icon={<Layers className="size-4" />} onClick={() => setSammel(true)}>
            Sammelabrechnung
          </Button>
        }
      />

      <div ref={leiste} className="mb-6">
        <Segmented options={tabs} value={tab} onChange={(t) => setTab(t)} className="max-w-full" />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          aria-label={TAB_LABEL[tab]}
        >
          {tab === "uebersicht" && <UebersichtTab onTab={setTab} />}
          {tab === "rechnungen" && <RechnungenTab key={params.get("filter") ?? ""} />}
          {tab === "rvg" && <RvgRechnerTab onTab={setTab} />}
          {tab === "bank" && <BankabgleichTab />}
          {tab === "forderung" && <ForderungskontoTab />}
          {tab === "zinsen" && <ZinsrechnerTab />}
          {tab === "zeit" && <ZeiterfassungTab onTab={setTab} />}
        </motion.section>
      </AnimatePresence>

      <Sammelabrechnung
        open={sammelOffen}
        onClose={() => setSammel(false)}
        onAnsehen={(id) => {
          setSammel(false);
          setTab("rechnungen");
          if (id) setTimeout(() => oeffneRechnung(id), 260);
        }}
      />
      <RechnungVorschau id={rechnungId} onClose={schliesseRechnung} />
    </>
  );
}

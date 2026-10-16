import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, Calculator, CalendarDays, CalendarRange, List, ShieldAlert, Sparkles, X, CalendarClock } from "lucide-react";
import { addDays, fmtDateShort, fmtDateWd, today } from "@/core/dates";
import type { Akte, FristTyp } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { AnimatedNumber, Button, PageHeader, Segmented, Select, Stat, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FristListe } from "./FristListe";
import { WochenAnsicht } from "./WochenAnsicht";
import { MonatsAnsicht } from "./MonatsAnsicht";
import { FristDetail } from "./FristDetail";
import { Fristenrechner } from "./Fristenrechner";
import { FeiertageInfo } from "./FeiertageInfo";
import { TYP_META, TYP_REIHENFOLGE, brauchtKontrolle, wochenStart } from "./logik";

type Ansicht = "liste" | "woche" | "monat";
type Fokus = "heute" | "woche" | "notfristen" | "unkontrolliert";

const FOKUS_LABEL: Record<Fokus, string> = {
  heute: "Heute fällig",
  woche: "Diese Woche",
  notfristen: "Offene Notfristen",
  unkontrolliert: "Unkontrollierte KI-Fristen",
};

function ladeAnsicht(): Ansicht {
  try {
    const v = localStorage.getItem("aa:fristen-ansicht");
    return v === "woche" || v === "monat" || v === "liste" ? v : "liste";
  } catch {
    return "liste";
  }
}

export default function Fristen() {
  const { user, tenant, team } = useKanzlei();
  const fristen = useCol("fristen");
  const aktenListe = useCol("akten");
  const [params, setParams] = useSearchParams();
  const heute = today();
  const [ansicht, setAnsichtRaw] = useState<Ansicht>(ladeAnsicht);
  const [typ, setTyp] = useState<"alle" | FristTyp>("alle");
  const [nurMeine, setNurMeine] = useState(false);
  const [erledigte, setErledigte] = useState(false);
  const [fokus, setFokus] = useState<Fokus | null>(null);
  const [wocheStart, setWocheStart] = useState(() => wochenStart(heute));
  const [monat, setMonat] = useState(() => heute.slice(0, 7));
  const [tag, setTag] = useState(heute);
  const [detailId, setDetailId] = useState<string | null>(null);

  const setAnsicht = (a: Ansicht) => {
    setAnsichtRaw(a);
    try {
      localStorage.setItem("aa:fristen-ansicht", a);
    } catch {
      /* optional */
    }
  };

  const rechnerOffen = params.get("rechner") === "1";
  const oeffneRechner = () => {
    const next = new URLSearchParams(params);
    next.set("rechner", "1");
    setParams(next);
  };
  const schliesseRechner = () => {
    const next = new URLSearchParams(params);
    ["rechner", "akte", "regel"].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };

  const akten = useMemo(() => new Map<string, Akte>(aktenListe.map((a) => [a.id, a])), [aktenListe]);

  // Kennzahlen (immer über alle Fristen)
  const kpi = useMemo(() => {
    const offen = fristen.filter((f) => f.status === "offen");
    const mo = wochenStart(heute);
    const so = addDays(mo, 6);
    const heuteFaellig = offen.filter((f) => f.datum <= heute && f.typ !== "vorfrist");
    const ueberfaellig = heuteFaellig.filter((f) => f.datum < heute).length;
    const woche = offen.filter((f) => f.datum >= mo && f.datum <= so && f.typ !== "vorfrist");
    const notfristen = offen.filter((f) => f.typ === "notfrist").sort((a, b) => a.datum.localeCompare(b.datum));
    const unkontrolliert = offen.filter((f) => f.quelle === "ki" && brauchtKontrolle(f));
    return { heute: heuteFaellig.length, ueberfaellig, woche: woche.length, so, notfristen, unkontrolliert: unkontrolliert.length };
  }, [fristen, heute]);

  const gefiltert = useMemo(() => {
    const mo = wochenStart(heute);
    const so = addDays(mo, 6);
    return fristen.filter((f) => {
      if (!erledigte && f.status === "erledigt") return false;
      if (typ !== "alle" && f.typ !== typ) return false;
      if (nurMeine && f.verantwortlichId !== user.id) return false;
      if (fokus === "heute" && !(f.status === "offen" && f.datum <= heute && f.typ !== "vorfrist")) return false;
      if (fokus === "woche" && !(f.status === "offen" && f.datum >= mo && f.datum <= so && f.typ !== "vorfrist")) return false;
      if (fokus === "notfristen" && !(f.status === "offen" && f.typ === "notfrist")) return false;
      if (fokus === "unkontrolliert" && !(f.quelle === "ki" && brauchtKontrolle(f))) return false;
      return true;
    });
  }, [fristen, erledigte, typ, nurMeine, user.id, fokus, heute]);

  const detail = detailId ? fristen.find((f) => f.id === detailId) : undefined;

  useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);

  const waehleFokus = (f: Fokus) => {
    setFokus((cur) => (cur === f ? null : f));
    setAnsicht("liste");
  };

  const istGefiltert = typ !== "alle" || nurMeine || !!fokus;

  return (
    <div>
      <PageHeader
        title="Fristen"
        hilfe="fristen"
        subtitle="Fristenkalender mit Vorfristen, Vier-Augen-Kontrolle und Fristenrechner nach § 222 ZPO."
        actions={
          <Button variant="primary" icon={<Calculator className="size-4" />} onClick={oeffneRechner}>
            Frist berechnen
          </Button>
        }
      />

      {/* Kennzahlen */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { key: "heute", label: "Heute fällig", icon: <AlarmClock className="size-4" />, tone: kpi.heute ? "seal" : "green", wert: kpi.heute, sub: kpi.ueberfaellig ? `davon ${kpi.ueberfaellig} überfällig` : kpi.heute ? "bis 24:00 Uhr" : "Nichts mehr offen" },
            { key: "woche", label: "Diese Woche", icon: <CalendarRange className="size-4" />, tone: "amber", wert: kpi.woche, sub: `bis ${fmtDateWd(kpi.so)}` },
            { key: "notfristen", label: "Notfristen", icon: <ShieldAlert className="size-4" />, tone: "seal", wert: kpi.notfristen.length, sub: kpi.notfristen[0] ? `offen · nächste ${fmtDateShort(kpi.notfristen[0].datum)}` : "keine offen" },
            { key: "unkontrolliert", label: "Unkontrolliert", icon: <Sparkles className="size-4" />, tone: "violet", wert: kpi.unkontrolliert, sub: kpi.unkontrolliert ? "Zweitkontrolle offen" : "Alle KI-Fristen geprüft" },
          ] as const
        ).map((k, i) => (
          <motion.div key={k.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34, delay: i * 0.05 }} className="min-w-0">
            <Stat
              label={k.label}
              icon={k.icon}
              tone={k.tone}
              value={<AnimatedNumber value={k.wert} />}
              sub={k.sub}
              onClick={() => waehleFokus(k.key)}
              className={cn("h-full w-full", fokus === k.key && "ring-2 ring-[var(--ink)]")}
            />
          </motion.div>
        ))}
      </div>

      {/* Steuerleiste */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Segmented<Ansicht>
          value={ansicht}
          onChange={setAnsicht}
          options={[
            { value: "liste", label: "Liste", icon: <List className="size-3.5" /> },
            { value: "woche", label: "Woche", icon: <CalendarRange className="size-3.5" /> },
            { value: "monat", label: "Monat", icon: <CalendarDays className="size-3.5" /> },
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:ml-auto">
          <Select id="fristen-typ" aria-label="Nach Typ filtern" value={typ} onChange={(e) => setTyp(e.target.value as "alle" | FristTyp)} className="!h-9 !w-auto min-w-[160px] !rounded-full !text-[13px]">
            <option value="alle">Alle Typen</option>
            {TYP_REIHENFOLGE.map((t) => (
              <option key={t} value={t}>
                {t === "wiedervorlage" ? "Wiedervorlagen" : t === "notfrist" ? "Notfristen" : t === "termin" ? "Termine" : `${TYP_META[t].label}en`}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-4">
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-fg-2" htmlFor="fristen-meine">
              <Switch id="fristen-meine" checked={nurMeine} onChange={setNurMeine} label="Nur meine Fristen" />
              Nur meine
            </label>
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-fg-2" htmlFor="fristen-erledigt">
              <Switch id="fristen-erledigt" checked={erledigte} onChange={setErledigte} label="Erledigte anzeigen" />
              Erledigte
            </label>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {fokus && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-soft py-1 pl-3 pr-1 font-medium text-ink">
                {FOKUS_LABEL[fokus]} · {gefiltert.length}
                <button type="button" onClick={() => setFokus(null)} className="grid size-6 place-items-center rounded-full hover:bg-[var(--ink-soft)]" aria-label="Filter entfernen">
                  <X className="size-3.5" />
                </button>
              </span>
              {fokus === "unkontrolliert" && <span className="text-fg-3">Von der KI erkannte Fristen müssen von einer zweiten Person bestätigt werden.</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={ansicht} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
          {ansicht === "liste" && <FristListe fristen={gefiltert} akten={akten} team={team} user={user} heute={heute} land={tenant.bundesland} gefiltert={istGefiltert} />}
          {ansicht === "woche" && <WochenAnsicht fristen={gefiltert} akten={akten} start={wocheStart} setStart={setWocheStart} land={tenant.bundesland} heute={heute} onOpen={(f) => setDetailId(f.id)} />}
          {ansicht === "monat" && (
            <MonatsAnsicht fristen={gefiltert} akten={akten} monat={monat} setMonat={setMonat} auswahl={tag} setAuswahl={setTag} land={tenant.bundesland} heute={heute} onOpen={(f) => setDetailId(f.id)} />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8">
        <FeiertageInfo land={tenant.bundesland} />
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] text-fg-4">
        <CalendarClock className="size-3.5" />
        Jede Frist speichert Regel, Ereignisdatum und Rechenweg – revisionssicher.
      </div>

      <FristDetail f={detail} akte={detail ? akten.get(detail.akteId) : undefined} team={team} user={user} onClose={() => setDetailId(null)} />
      <Fristenrechner open={rechnerOffen} onClose={schliesseRechner} startAkteId={params.get("akte") ?? undefined} startRegel={params.get("regel") ?? undefined} />
    </div>
  );
}

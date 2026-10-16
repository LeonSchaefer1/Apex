import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, Calculator, CalendarDays, CalendarRange, List, ShieldAlert, Sparkles, X, CalendarClock } from "lucide-react";
import { addDays, fmtDateShort, fmtDateWd, today } from "@/core/dates";
import { fristenLage, zaehltAlsFrist } from "@/core/fristenLage";
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
import { TYP_META, TYP_REIHENFOLGE, istUngeprueft, wochenAnsichtStart, wochenStart } from "./logik";

type Ansicht = "liste" | "woche" | "monat";
type Fokus = "heute" | "woche" | "notfristen" | "unkontrolliert";

const FOKUS_LABEL: Record<Fokus, string> = {
  heute: "Heute fällig",
  woche: "Diese Woche",
  notfristen: "Offene Notfristen",
  unkontrolliert: "Unkontrollierte KI-Fristen",
};

/** Deep-Link `?filter=…` → Kennzahl-Filter (`kontrolle` = Vier-Augen-Kontrolle ausstehend). */
const FILTER_PARAM: Record<string, Fokus> = {
  kontrolle: "unkontrolliert",
  unkontrolliert: "unkontrolliert",
  heute: "heute",
  woche: "woche",
  notfristen: "notfristen",
};

const istDatum = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

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

  // Deep-Links: ?datum=YYYY-MM-DD (Tag anspringen + hervorheben), ?filter=kontrolle|heute|woche|notfristen,
  // ?akte=<id> (Liste auf eine Akte begrenzen, nur ohne Rechner). Die Adresse bleibt Quelle der Wahrheit,
  // damit der Zustand auch beim Seitenwechsel-Übergang und nach dem Neuladen erhalten bleibt.
  const pFilter = params.get("filter");
  const pDatum = params.get("datum");
  const pAkte = params.get("rechner") === "1" ? null : params.get("akte");
  const dlFokus = (pFilter && FILTER_PARAM[pFilter]) || null;
  const dlDatum = istDatum(pDatum) ? pDatum : null;

  const [ansicht, setAnsichtRaw] = useState<Ansicht>(() => (dlFokus ? "liste" : dlDatum ? "woche" : ladeAnsicht()));
  const [typ, setTyp] = useState<"alle" | FristTyp>("alle");
  const [nurMeine, setNurMeine] = useState(false);
  const [erledigte, setErledigte] = useState(false);
  const [fokus, setFokusRaw] = useState<Fokus | null>(dlFokus);
  const [wocheStart, setWocheStart] = useState(() => (dlDatum ? wochenStart(dlDatum) : wochenAnsichtStart(heute)));
  const [monat, setMonat] = useState(() => (dlDatum ?? heute).slice(0, 7));
  const [tag, setTag] = useState(dlDatum ?? heute);
  const [detailId, setDetailId] = useState<string | null>(null);
  /** Deep-Link-Filter auf eine Akte (`?akte=` ohne Rechner) */
  const [akteFilter, setAkteFilterRaw] = useState<string | null>(pAkte);
  /** Per Deep-Link angesprungener Tag (`?datum=`), wird im Kalender hervorgehoben */
  const [markiert, setMarkiert] = useState<string | null>(dlDatum);

  // Neuer Deep-Link, während die Seite schon offen ist (z. B. aus dem Apex Assistenten)
  useEffect(() => {
    if (dlFokus) {
      setFokusRaw(dlFokus);
      setAnsichtRaw("liste");
    }
    if (pAkte) setAkteFilterRaw(pAkte);
    if (dlDatum) {
      setTag(dlDatum);
      setWocheStart(wochenStart(dlDatum));
      setMonat(dlDatum.slice(0, 7));
      setMarkiert(dlDatum);
      if (!dlFokus) setAnsichtRaw("woche");
    }
  }, [dlFokus, pAkte, dlDatum]);

  /** Entfernt Deep-Link-Parameter, sobald der Nutzer den Filter selbst ändert. */
  const entferneParam = (...keys: string[]) => {
    if (!keys.some((k) => params.has(k))) return;
    const next = new URLSearchParams(params);
    keys.forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };
  const setFokus = (f: Fokus | null | ((cur: Fokus | null) => Fokus | null)) => {
    setFokusRaw(f);
    entferneParam("filter");
  };
  const setAkteFilter = (a: string | null) => {
    setAkteFilterRaw(a);
    if (params.get("rechner") !== "1") entferneParam("akte");
  };

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
    ["rechner", "akte", "regel", "ereignis"].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };

  const akten = useMemo(() => new Map<string, Akte>(aktenListe.map((a) => [a.id, a])), [aktenListe]);

  // Kennzahlen (immer über alle Fristen). „Heute fällig“ = fristenLage().faellig (heute + überfällig, ohne Vorfristen und Termine) –
  // dieselbe Zählweise wie Seitenleiste, Cockpit und Apex Assistent.
  const kpi = useMemo(() => {
    const offen = fristen.filter((f) => f.status === "offen");
    const lage = fristenLage(fristen, heute);
    const mo = wochenStart(heute);
    const so = addDays(mo, 6);
    const woche = offen.filter((f) => f.datum >= mo && f.datum <= so && f.typ !== "vorfrist");
    const notfristen = offen.filter((f) => f.typ === "notfrist").sort((a, b) => a.datum.localeCompare(b.datum));
    const unkontrolliert = offen.filter(istUngeprueft);
    return { heute: lage.faellig.length, ueberfaellig: lage.ueberfaellig.length, woche: woche.length, so, notfristen, unkontrolliert: unkontrolliert.length };
  }, [fristen, heute]);

  const gefiltert = useMemo(() => {
    const mo = wochenStart(heute);
    const so = addDays(mo, 6);
    return fristen.filter((f) => {
      if (!erledigte && f.status === "erledigt") return false;
      if (typ !== "alle" && f.typ !== typ) return false;
      if (nurMeine && f.verantwortlichId !== user.id) return false;
      if (akteFilter && f.akteId !== akteFilter) return false;
      if (fokus === "heute" && !(f.status === "offen" && f.datum <= heute && zaehltAlsFrist(f))) return false;
      if (fokus === "woche" && !(f.status === "offen" && f.datum >= mo && f.datum <= so && f.typ !== "vorfrist")) return false;
      if (fokus === "notfristen" && !(f.status === "offen" && f.typ === "notfrist")) return false;
      if (fokus === "unkontrolliert" && !istUngeprueft(f)) return false;
      return true;
    });
  }, [fristen, erledigte, typ, nurMeine, user.id, fokus, heute, akteFilter]);

  const detail = detailId ? fristen.find((f) => f.id === detailId) : undefined;

  useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);

  const waehleFokus = (f: Fokus) => {
    setFokus((cur) => (cur === f ? null : f));
    setAnsicht("liste");
  };

  const istGefiltert = typ !== "alle" || nurMeine || !!fokus || !!akteFilter;
  const filterAkte = akteFilter ? akten.get(akteFilter) : undefined;

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
        {(fokus || akteFilter) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
              {fokus && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-soft py-1 pl-3 pr-1 font-medium text-ink">
                  {FOKUS_LABEL[fokus]}
                  {!akteFilter && ` · ${gefiltert.length}`}
                  <button type="button" onClick={() => setFokus(null)} className="grid size-6 place-items-center rounded-full hover:bg-[var(--ink-soft)]" aria-label="Filter entfernen">
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              {akteFilter && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-ink-soft py-1 pl-3 pr-1 font-medium text-ink">
                  <span className="truncate">
                    Akte <span className="mono">{filterAkte?.aktenzeichen ?? "–"}</span>
                    {filterAkte ? ` ${filterAkte.titel}` : ""} · {gefiltert.length}
                  </span>
                  <button type="button" onClick={() => setAkteFilter(null)} className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-[var(--ink-soft)]" aria-label="Aktenfilter entfernen">
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              {fokus === "unkontrolliert" && <span className="text-fg-3">Von der KI erkannte Fristen müssen von einer zweiten Person bestätigt werden – nie von der verantwortlichen Person selbst.</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={ansicht} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
          {ansicht === "liste" && (
            <FristListe
              fristen={gefiltert}
              akten={akten}
              team={team}
              user={user}
              heute={heute}
              land={tenant.bundesland}
              gefiltert={istGefiltert}
              ohneHorizont={!!akteFilter || fokus === "unkontrolliert" || fokus === "notfristen"}
              markiert={markiert ?? undefined}
            />
          )}
          {ansicht === "woche" && <WochenAnsicht fristen={gefiltert} akten={akten} start={wocheStart} setStart={setWocheStart} land={tenant.bundesland} heute={heute} markiert={markiert ?? undefined} onOpen={(f) => setDetailId(f.id)} />}
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
      <Fristenrechner
        open={rechnerOffen}
        onClose={schliesseRechner}
        startAkteId={rechnerOffen ? params.get("akte") ?? undefined : undefined}
        startRegel={params.get("regel") ?? undefined}
        startEreignis={params.get("ereignis") ?? undefined}
      />
    </div>
  );
}

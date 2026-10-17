import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, Calculator, Check, CalendarDays, CalendarRange, List, MoreHorizontal, ShieldAlert, ShieldCheck, UserCheck, Users, X, CalendarClock, CalendarPlus, Download, Printer } from "lucide-react";
import { addDays, fmtDate, fmtDateShort, today, wochentagName } from "@/core/dates";
import { FENSTER_TAGE, fristenImZeitraum, fristenLage, istKritisch, nachDringlichkeit, zaehltAlsFrist } from "@/core/fristenLage";
import type { Akte, Frist, FristTyp } from "@/core/types";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { useUI } from "@/store/ui";
import { kuenftigeVertretungen, vertreteneIds } from "@/core/vertretung";
import { AnimatedNumber, Button, Menu, PageHeader, Segmented, Select, Stat, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FristListe } from "./FristListe";
import { WochenAnsicht } from "./WochenAnsicht";
import { MonatsAnsicht } from "./MonatsAnsicht";
import { FristDetail } from "./FristDetail";
import { Fristenrechner } from "./Fristenrechner";
import { FeiertageInfo } from "./FeiertageInfo";
import { QUELLE_LABEL, TYP_META, TYP_REIHENFOLGE, brauchtKontrolle, wochenAnsichtStart, wochenStart } from "./logik";
import { Ausgangskontrolle, Druckansicht } from "./Ausgangskontrolle";
import { DateiDialog, type AusgabeDatei } from "./dateiAusgabe";
import { erzeugeIcs } from "./ics";
import { FristAutomatikHinweis } from "@/components/FristAutomatikHinweis";

type Ansicht = "liste" | "woche" | "monat" | "ausgang";
type Fokus = "heute" | "woche" | "kritisch" | "unkontrolliert";

const FOKUS_LABEL: Record<Fokus, string> = {
  heute: "Heute fällig",
  woche: "Nächste 7 Tage",
  kritisch: "Kritische Fristen",
  unkontrolliert: "Vier-Augen-Kontrolle offen",
};

/** Deep-Link `?filter=…` → Kennzahl-Filter (`kontrolle` = Vier-Augen-Kontrolle offen, `notfristen` = kritische Fristen). */
const FILTER_PARAM: Record<string, Fokus> = {
  kontrolle: "unkontrolliert",
  unkontrolliert: "unkontrolliert",
  heute: "heute",
  woche: "woche",
  notfristen: "kritisch",
  kritisch: "kritisch",
};

/** Deep-Link `?quelle=ki|migration` (z. B. aus KI-Status oder Umzug) – grenzt zusätzlich auf die Herkunft ein. */
const QUELLEN: Frist["quelle"][] = ["ki", "migration", "automatisch", "manuell"];

function anz(n: number, eins: string, viele: string) {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** „1 Frist, 2 Wiedervorlagen, 1 Vorfrist“ – Fristen und andere Einträge getrennt gezählt (wie fristenLage). */
function aufschluesselung(liste: Frist[]): string {
  const n = (p: (f: Frist) => boolean) => liste.filter(p).length;
  const teile = [
    [n(zaehltAlsFrist), "Frist", "Fristen"],
    [n((f) => f.typ === "wiedervorlage"), "Wiedervorlage", "Wiedervorlagen"],
    [n((f) => f.typ === "vorfrist"), "Vorfrist", "Vorfristen"],
    [n((f) => f.typ === "termin"), "Termin", "Termine"],
  ] as const;
  const text = teile.filter(([k]) => k > 0).map(([k, e, v]) => anz(k, e, v)).join(", ");
  return text || "keine Einträge";
}

/** „Mo, 19.10.“ – Wochentag und Tag ohne Jahr (Hinweis Vertretung vorab) */
const tagKurz = (iso: string) => `${wochentagName(iso, true)}, ${fmtDate(iso).slice(0, 6)}`;

const istDatum = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

function ladeAnsicht(): Ansicht {
  try {
    const v = localStorage.getItem("aa:fristen-ansicht");
    return v === "woche" || v === "monat" || v === "liste" || v === "ausgang" ? v : "liste";
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
  const pQuelle = params.get("quelle");
  // ?verantwortlich=<userId> (Cockpit-Hinweis „offene Fristen eines deaktivierten Zugangs“, I5-T23-01): Fristen einer Person
  const pVerantwortlich = params.get("verantwortlich");
  const quelleFilter = pQuelle && (QUELLEN as string[]).includes(pQuelle) ? (pQuelle as Frist["quelle"]) : null;
  const dlFokus = (pFilter && FILTER_PARAM[pFilter]) || null;
  const dlDatum = istDatum(pDatum) ? pDatum : null;

  const [ansicht, setAnsichtRaw] = useState<Ansicht>(() => (dlFokus || pVerantwortlich || params.get("nur") === "meine" || params.get("vertretung") === "vorab" ? "liste" : dlDatum ? "woche" : ladeAnsicht()));
  const [typ, setTyp] = useState<"alle" | FristTyp>("alle");
  // ?nur=meine (z. B. aus dem Cockpit-Hinweis „Sie vertreten heute …“): eigene Fristen samt Vertretung
  const pNur = params.get("nur");
  // ?vertretung=vorab (Cockpit-Hinweis „Ab Mo … vertreten Sie …“): künftige Vertretungsfristen gleich eingeblendet (I4-T18-04)
  const pVertretung = params.get("vertretung");
  const [nurMeine, setNurMeineRaw] = useState(pNur === "meine" || pVertretung === "vorab");
  const [vorab, setVorabRaw] = useState(pVertretung === "vorab");
  const [erledigte, setErledigte] = useState(false);
  const [fokus, setFokusRaw] = useState<Fokus | null>(dlFokus);
  const [wocheStart, setWocheStart] = useState(() => (dlDatum ? wochenStart(dlDatum) : wochenAnsichtStart(heute)));
  const [monat, setMonat] = useState(() => (dlDatum ?? heute).slice(0, 7));
  const [tag, setTag] = useState(dlDatum ?? heute);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [druck, setDruck] = useState(false);
  const [datei, setDatei] = useState<AusgabeDatei | null>(null);
  // Vertretung (§ 53 BRAO): Personen, die heute abwesend sind und mich als Vertretung eingetragen haben
  const vertretene = useMemo(() => vertreteneIds(team, user.id, heute), [team, user.id, heute]);
  const vertretungFuer = useMemo(() => new Map(vertretene.map((id) => [id, team.find((u) => u.id === id)?.name ?? "Kollegin/Kollege"])), [vertretene, team]);
  // Vertretung vorab (§ 53 BRAO): Abwesenheiten mit Beginn in ≤ 14 Tagen, für die ich als Vertretung eingetragen bin
  const kuenftig = useMemo(() => kuenftigeVertretungen(team, fristen, user.id, heute), [team, fristen, user.id, heute]);
  /** Frist-ID → „Jonas Brandt ab Mo, 19.10.“ – Kennzeichnung der vorab eingeblendeten Vertretungsfristen */
  const vorabFuer = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of kuenftig) for (const f of v.fristen) m.set(f.id, `${v.person.name} ab ${tagKurz(v.von)}`);
    return m;
  }, [kuenftig]);
  /** Deep-Link-Filter auf eine Akte (`?akte=` ohne Rechner) */
  const [akteFilter, setAkteFilterRaw] = useState<string | null>(pAkte);
  /** Deep-Link-Filter auf die verantwortliche Person (`?verantwortlich=`) */
  const [personFilter, setPersonFilterRaw] = useState<string | null>(pVerantwortlich);
  /** Per Deep-Link angesprungener Tag (`?datum=`), wird im Kalender hervorgehoben */
  const [markiert, setMarkiert] = useState<string | null>(dlDatum);

  // Neuer Deep-Link, während die Seite schon offen ist (z. B. aus dem Apex Assistenten)
  useEffect(() => {
    if (dlFokus) {
      setFokusRaw(dlFokus);
      setAnsichtRaw("liste");
    }
    if (pAkte) setAkteFilterRaw(pAkte);
    if (pVerantwortlich) {
      setPersonFilterRaw(pVerantwortlich);
      if (!dlDatum) setAnsichtRaw("liste");
    }
    if (pNur === "meine") {
      setNurMeineRaw(true);
      if (!dlDatum) setAnsichtRaw("liste");
    }
    if (pVertretung === "vorab") {
      setNurMeineRaw(true);
      setVorabRaw(true);
      if (!dlDatum) setAnsichtRaw("liste");
    }
    if (dlDatum) {
      setTag(dlDatum);
      setWocheStart(wochenStart(dlDatum));
      setMonat(dlDatum.slice(0, 7));
      setMarkiert(dlDatum);
      if (!dlFokus) setAnsichtRaw("woche");
    }
  }, [dlFokus, pAkte, dlDatum, pNur, pVertretung, pVerantwortlich]);

  /** Entfernt Deep-Link-Parameter, sobald der Nutzer den Filter selbst ändert. */
  const entferneParam = (...keys: string[]) => {
    if (!keys.some((k) => params.has(k))) return;
    const next = new URLSearchParams(params);
    keys.forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };
  const setFokus = (f: Fokus | null | ((cur: Fokus | null) => Fokus | null)) => {
    setFokusRaw(f);
    entferneParam("filter", "quelle");
  };
  const setNurMeine = (v: boolean) => {
    setNurMeineRaw(v);
    entferneParam("nur", "vertretung");
  };
  const setVorab = (v: boolean) => {
    setVorabRaw(v);
    entferneParam("vertretung");
  };
  const setAkteFilter = (a: string | null) => {
    setAkteFilterRaw(a);
    if (params.get("rechner") !== "1") entferneParam("akte");
  };
  const setPersonFilter = (id: string | null) => {
    setPersonFilterRaw(id);
    entferneParam("verantwortlich");
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
    ["rechner", "akte", "regel", "ereignis", "herkunft"].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };

  const akten = useMemo(() => new Map<string, Akte>(aktenListe.map((a) => [a.id, a])), [aktenListe]);

  // Kennzahlen (immer über alle Einträge) – dieselbe Zählweise wie Seitenleiste, Cockpit und Apex Assistent (fristenLage):
  // „Heute fällig“ = Fristen (Notfristen und Fristen) bis heute inkl. überfälliger; „Nächste 7 Tage“ = Fristen danach bis heute + 7.
  // Wiedervorlagen, Vorfristen und Termine werden jeweils getrennt genannt. „Kritisch“ = Notfrist oder nicht verlängerbar.
  // „Vier-Augen-Kontrolle offen“ = jede offene Notfrist/Frist ohne Bestätigung durch eine zweite Person (brauchtKontrolle).
  const kpi = useMemo(() => {
    const offen = fristen.filter((f) => f.status === "offen");
    const lage = fristenLage(fristen, heute);
    const in7 = addDays(heute, FENSTER_TAGE);
    const spaeter = fristenImZeitraum(fristen, addDays(heute, 1), in7);
    const kritisch = offen.filter(istKritisch).sort(nachDringlichkeit);
    const kontrolle = offen.filter(brauchtKontrolle);
    return {
      heute: lage.faellig.length,
      ueberfaellig: lage.ueberfaellig.length,
      wvHeute: lage.wiedervorlagen.length,
      vorHeute: lage.vorfristen.length,
      woche: lage.woche.length,
      wvWoche: lage.wiedervorlagenWoche.length,
      termineWoche: spaeter.termine.length,
      in7,
      kritisch,
      kontrolle: kontrolle.length,
      kontrolleKi: kontrolle.filter((f) => f.quelle === "ki").length,
      kontrolleUmzug: kontrolle.filter((f) => f.quelle === "migration").length,
    };
  }, [fristen, heute]);

  const gefiltert = useMemo(() => {
    const in7 = addDays(heute, FENSTER_TAGE);
    return fristen.filter((f) => {
      if (!erledigte && f.status === "erledigt") return false;
      if (typ !== "alle" && f.typ !== typ) return false;
      if (nurMeine && f.verantwortlichId !== user.id && !vertretene.includes(f.verantwortlichId) && !(vorab && vorabFuer.has(f.id))) return false;
      if (akteFilter && f.akteId !== akteFilter) return false;
      if (personFilter && f.verantwortlichId !== personFilter) return false;
      if (quelleFilter && f.quelle !== quelleFilter) return false;
      // Kennzahl-Filter zeigen Fristen und die getrennt genannten Einträge (Wiedervorlagen, Vorfristen, Termine) mit Typ
      if (fokus === "heute" && !(f.status === "offen" && f.datum <= heute && f.typ !== "termin")) return false;
      if (fokus === "woche" && !(f.status === "offen" && f.datum > heute && f.datum <= in7 && f.typ !== "vorfrist")) return false;
      if (fokus === "kritisch" && !(f.status === "offen" && istKritisch(f))) return false;
      if (fokus === "unkontrolliert" && !brauchtKontrolle(f)) return false;
      return true;
    });
  }, [fristen, erledigte, typ, nurMeine, user.id, fokus, heute, akteFilter, personFilter, quelleFilter, vertretene, vorab, vorabFuer]);

  /** „Meine Fristen als .ics“: offene Einträge, für die ich verantwortlich bin (inkl. Vertretung) */
  const meineIcs = () => {
    const meine = fristen.filter((f) => f.status === "offen" && f.typ !== "vorfrist" && (f.verantwortlichId === user.id || vertretene.includes(f.verantwortlichId)));
    setDatei({
      name: `Fristen_${user.name.replace(/[^A-Za-zÄÖÜäöüß]+/g, "-")}_${heute}.ics`,
      mime: "text/calendar",
      inhalt: erzeugeIcs(meine.map((f) => ({ f, akte: akten.get(f.akteId) })), `Fristen ${user.name}`),
      beschreibung: `${meine.length} offene Einträge (Fristen, Wiedervorlagen, Termine) als Kalenderdatei – kein Abo, einmalige Übernahme`,
    });
  };

  const detail = detailId ? fristen.find((f) => f.id === detailId) : undefined;

  useEffect(() => {
    if (detailId && !detail) setDetailId(null);
  }, [detailId, detail]);

  const waehleFokus = (f: Fokus) => {
    setFokus((cur) => (cur === f ? null : f));
    setAnsicht("liste");
  };

  const istGefiltert = typ !== "alle" || nurMeine || !!fokus || !!akteFilter || !!personFilter || !!quelleFilter;
  const dazu = (teile: string[]) => (teile.length ? `dazu ${teile.join(" und ")}` : "");
  const subHeute = [
    kpi.ueberfaellig ? `davon ${kpi.ueberfaellig} überfällig` : "",
    dazu([kpi.wvHeute ? anz(kpi.wvHeute, "Wiedervorlage", "Wiedervorlagen") : "", kpi.vorHeute ? anz(kpi.vorHeute, "Vorfrist", "Vorfristen") : ""].filter(Boolean)),
  ].filter(Boolean).join(" · ") || (kpi.heute ? "bis 24:00 Uhr" : "Keine Frist offen");
  // „Nächste 7 Tage“ = morgen bis heute + 7 (gleitend, nicht die Kalenderwoche); Wiedervorlagen und Termine getrennt
  const subWoche =
    dazu([kpi.wvWoche ? anz(kpi.wvWoche, "Wiedervorlage", "Wiedervorlagen") : "", kpi.termineWoche ? anz(kpi.termineWoche, "Termin", "Termine") : ""].filter(Boolean)).replace(" und ", ", ") ||
    `bis ${fmtDateShort(kpi.in7)}`;
  const subKontrolle = kpi.kontrolle
    ? [kpi.kontrolleKi ? `davon ${kpi.kontrolleKi} von der KI erkannt` : "", kpi.kontrolleUmzug ? `${kpi.kontrolleUmzug} aus Umzug` : ""].filter(Boolean).join(", ") || "Bestätigung durch zweite Person"
    : "Alle Fristen kontrolliert";
  const filterAkte = akteFilter ? akten.get(akteFilter) : undefined;
  const filterPerson = personFilter ? team.find((u) => u.id === personFilter) : undefined;
  const kennzahlen = [
    { key: "heute", label: "Heute fällig", kurz: "Heute", icon: <AlarmClock className="size-4" />, tone: kpi.heute ? "seal" : "green", wert: kpi.heute, sub: subHeute },
    { key: "woche", label: "Nächste 7 Tage", kurz: "7 Tage", icon: <CalendarRange className="size-4" />, tone: "amber", wert: kpi.woche, sub: subWoche },
    { key: "kritisch", label: "Kritische Fristen", kurz: "Kritisch", icon: <ShieldAlert className="size-4" />, tone: "seal", wert: kpi.kritisch.length, sub: kpi.kritisch[0] ? `nicht verlängerbar · nächste ${fmtDateShort(kpi.kritisch[0].datum)}` : "keine offen" },
    { key: "unkontrolliert", label: "Vier-Augen-Kontrolle offen", kurz: "Vier-Augen", icon: <UserCheck className="size-4" />, tone: kpi.kontrolle ? "amber" : "green", wert: kpi.kontrolle, sub: subKontrolle },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Fristen"
        hilfe="fristen"
        subtitle={
          <>
            <span className="sm:hidden">Kalender, Vier-Augen-Kontrolle, Fristenrechner.</span>
            <span className="hidden sm:inline">Fristenkalender mit Vorfristen, Vier-Augen-Kontrolle und Fristenrechner nach § 222 ZPO.</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Telefon: Drucken und .ics im „⋯“ der Kopfzeile – der erste Bildschirm zeigt Fristen (I3-T03-05) */}
            <div className="sm:hidden">
              <Menu
                align="start"
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} className="icon-btn !size-11 text-fg-2" aria-label="Weitere Aktionen: Drucken, Meine Fristen als .ics" title="Drucken, Meine Fristen als .ics">
                    <MoreHorizontal className="size-5" />
                  </button>
                )}
                items={[
                  { label: "Drucken", icon: <Printer />, onClick: () => setDruck(true) },
                  { label: "Meine Fristen als .ics", icon: <Download />, onClick: meineIcs },
                ]}
              />
            </div>
            <Button variant="ghost" className="max-sm:!hidden" icon={<Printer className="size-4" />} onClick={() => setDruck(true)} title="Druckansicht „Fristen heute und nächster Arbeitstag“">
              Drucken
            </Button>
            <Button variant="ghost" className="max-sm:!hidden" icon={<Download className="size-4" />} onClick={meineIcs} title="Ihre offenen Fristen, Wiedervorlagen und Termine als Kalenderdatei (.ics)">
              Meine Fristen als .ics
            </Button>
            <Button variant="secondary" className="max-sm:!px-3" icon={<CalendarPlus className="size-4" />} onClick={() => useUI.getState().setWiedervorlage({})} aria-keyshortcuts="W" title="Wiedervorlage anlegen (Taste W)">
              {/* unter 380 px die geläufige Abkürzung „WV“, damit Kopfaktionen in eine Zeile passen */}
              <span className="min-[380px]:hidden" aria-hidden>
                WV
              </span>
              <span className="max-[379px]:sr-only">Wiedervorlage</span> <kbd className="kbd ml-1 hidden sm:inline-flex">W</kbd>
            </Button>
            <Button variant="primary" className="max-sm:!px-3" icon={<Calculator className="size-4" />} onClick={oeffneRechner} aria-keyshortcuts="F" title="Frist berechnen (Taste F)">
              Frist berechnen <kbd className="kbd ml-1 hidden sm:inline-flex">F</kbd>
            </Button>
          </div>
        }
      />

      {/* Fristautomatik pausiert (Fristerkennung, Vorfristen, eEB): Hinweis mit Datum, Uhrzeit und Person (I3-T10-01) */}
      <FristAutomatikHinweis className="mb-4" />

      {/* Kennzahlen – Telefon: eine Zeile kompakter Kacheln (I3-T03-05), ab 640 px die ausführlichen Kacheln */}
      <div className="mb-4 grid grid-cols-4 gap-1.5 sm:hidden" role="group" aria-label="Kennzahlen – antippen filtert die Liste">
        {kennzahlen.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => waehleFokus(k.key)}
            aria-pressed={fokus === k.key}
            aria-label={`${k.label}: ${k.wert} – ${k.sub}`}
            title={`${k.label}: ${k.sub}`}
            className={cn(
              "sheet flex min-h-[54px] min-w-0 flex-col items-center justify-center rounded-[16px] px-1 py-1.5 text-center transition-colors",
              fokus === k.key && "ring-2 ring-[var(--ink)]",
            )}
          >
            <span className={cn("num text-[19px] font-semibold leading-none", k.tone === "seal" ? "text-seal" : k.tone === "amber" ? "text-amber" : "text-green")}>{k.wert}</span>
            <span className="mt-1 max-w-full truncate text-[11.5px] font-medium leading-tight text-fg-2">{k.kurz}</span>
          </button>
        ))}
      </div>
      <div className="mb-6 hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-4">
        {kennzahlen.map((k, i) => (
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
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:mb-5 sm:gap-y-3">
        <Segmented<Ansicht>
          value={ansicht}
          onChange={setAnsicht}
          options={[
            { value: "liste", label: "Liste", icon: <List className="size-3.5 max-[379px]:hidden" /> },
            { value: "woche", label: "Woche", icon: <CalendarRange className="size-3.5 max-[379px]:hidden" /> },
            { value: "monat", label: "Monat", icon: <CalendarDays className="size-3.5 max-[379px]:hidden" /> },
            {
              value: "ausgang",
              label: (
                <>
                  <span className="sm:hidden" aria-hidden>
                    Ausgang
                  </span>
                  <span className="max-sm:sr-only">Ausgangskontrolle</span>
                </>
              ),
              icon: <ShieldCheck className="size-3.5 max-[379px]:hidden" />,
            },
          ]}
        />
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto lg:ml-auto">
          <Select id="fristen-typ" aria-label="Nach Typ filtern" value={typ} onChange={(e) => setTyp(e.target.value as "alle" | FristTyp)} className="!h-9 !rounded-full !text-[13px] max-sm:!h-11 max-sm:min-w-0 max-sm:flex-1 sm:!w-auto sm:min-w-[160px]">
            <option value="alle">Alle Typen</option>
            {TYP_REIHENFOLGE.map((t) => (
              <option key={t} value={t}>
                {t === "wiedervorlage" ? "Wiedervorlagen" : t === "notfrist" ? "Notfristen" : t === "termin" ? "Termine" : `${TYP_META[t].label}en`}
              </option>
            ))}
          </Select>
          {/* Telefon: kompakte Umschalter in derselben Zeile wie der Typfilter (I3-T03-05) */}
          <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
            {(
              [
                { an: nurMeine, setze: setNurMeine, label: "Nur meine", lang: `Nur meine Fristen${vertretene.length ? " (+ Vertretung)" : ""}` },
                { an: erledigte, setze: setErledigte, label: "Erledigte", lang: "Erledigte anzeigen" },
              ] as const
            ).map((t) => (
              <button
                key={t.label}
                type="button"
                aria-pressed={t.an}
                aria-label={t.lang}
                onClick={() => t.setze(!t.an)}
                className={cn(
                  "inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset transition-colors",
                  t.an ? "bg-ink-soft text-ink ring-[var(--ink)]" : "text-fg-2 ring-[var(--line-strong)]",
                )}
              >
                {t.an && <Check className="size-3.5" aria-hidden />}
                {t.label}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-fg-2" htmlFor="fristen-meine">
              <Switch id="fristen-meine" checked={nurMeine} onChange={setNurMeine} label="Nur meine Fristen" />
              Nur meine{vertretene.length ? ` (+ Vertretung)` : ""}
            </label>
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-fg-2" htmlFor="fristen-erledigt">
              <Switch id="fristen-erledigt" checked={erledigte} onChange={setErledigte} label="Erledigte anzeigen" />
              Erledigte
            </label>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(fokus || akteFilter || personFilter || quelleFilter) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-fg-2 sm:mb-4">
              {fokus && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-soft py-1 pl-3 pr-1 font-medium text-ink">
                  {FOKUS_LABEL[fokus]}
                  {!akteFilter && !quelleFilter && ` · ${fokus === "heute" || fokus === "woche" ? aufschluesselung(gefiltert) : gefiltert.length}`}
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
              {personFilter && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-ink-soft py-1 pl-3 pr-1 font-medium text-ink">
                  <span className="min-w-0 break-words">
                    Verantwortlich: {filterPerson?.name ?? "unbekannter Zugang"}
                    {filterPerson?.deaktiviert ? " (deaktiviert)" : ""}
                    {!akteFilter && ` · ${aufschluesselung(gefiltert)}`}
                  </span>
                  <button type="button" onClick={() => setPersonFilter(null)} className="grid size-6 shrink-0 place-items-center rounded-full hover:bg-[var(--ink-soft)]" aria-label="Personenfilter entfernen">
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              {quelleFilter && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-soft py-1 pl-3 pr-1 font-medium text-ink">
                  {QUELLE_LABEL[quelleFilter]}
                  {!akteFilter && ` · ${gefiltert.length}`}
                  <button type="button" onClick={() => entferneParam("quelle")} className="grid size-6 place-items-center rounded-full hover:bg-[var(--ink-soft)]" aria-label="Herkunftsfilter entfernen">
                    <X className="size-3.5" />
                  </button>
                </span>
              )}
              {fokus === "unkontrolliert" && <span className="hidden text-fg-3 sm:inline">Jede Notfrist und Frist bestätigt eine zweite Person – nie die verantwortliche Person selbst.</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vertretung vorab (I4-T18-04): Hinweis unter „Nur meine“ mit Schalter zum Einblenden – Text und Symbol, nicht nur Farbe */}
      {(nurMeine || vorab) && kuenftig.length > 0 && ansicht !== "ausgang" && (
        <div role="status" className="mb-4 grid gap-2 rounded-[18px] bg-amber-soft px-4 py-3 text-[13px] text-fg-2">
          {kuenftig.map((v) => (
            <div key={v.person.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Users className="size-4 shrink-0 text-[var(--amber-text)]" aria-hidden />
              <span className="min-w-0 flex-1 basis-[260px]">
                <strong className="font-semibold text-fg">
                  Ab {tagKurz(v.von)} vertreten Sie {v.person.name}
                </strong>{" "}
                (bis {tagKurz(v.bis)}) – {v.fristen.length ? `${aufschluesselung(v.fristen)} im Zeitraum` : "keine offenen Fristen im Zeitraum"}
                {v.person.abwesenheit?.grund ? ` · ${v.person.abwesenheit.grund}` : ""}.
              </span>
              {v.fristen.length > 0 && (
                <button
                  type="button"
                  aria-pressed={vorab}
                  onClick={() => {
                    setVorab(!vorab);
                    if (!nurMeine) setNurMeineRaw(true);
                  }}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset transition-colors max-sm:min-h-11",
                    vorab ? "bg-[var(--surface)] text-fg ring-[var(--ink)]" : "bg-[var(--surface)] text-fg-2 ring-[var(--line-strong)] hover:text-fg",
                  )}
                >
                  {vorab ? <Check className="size-3.5" aria-hidden /> : <span aria-hidden>+</span>}
                  {vorab ? `Vertretung ab ${fmtDate(v.von).slice(0, 6)} eingeblendet` : `Vertretung ab ${fmtDate(v.von).slice(0, 6)} einblenden`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
              ohneHorizont={!!akteFilter || !!personFilter || !!quelleFilter || fokus === "unkontrolliert" || fokus === "kritisch"}
              markiert={markiert ?? undefined}
              vertretungFuer={vertretungFuer}
              vertretungVorab={vorab ? vorabFuer : undefined}
              onOpen={(f) => setDetailId(f.id)}
              leerTitel={fokus === "unkontrolliert" ? "Keine offene Kontrolle mehr" : undefined}
            />
          )}
          {ansicht === "ausgang" && <Ausgangskontrolle fristen={fristen} akten={akten} team={team} user={user} heute={heute} />}
          {ansicht === "woche" && <WochenAnsicht fristen={gefiltert} akten={akten} start={wocheStart} setStart={setWocheStart} land={tenant.bundesland} heute={heute} markiert={markiert ?? undefined} onOpen={(f) => setDetailId(f.id)} />}
          {ansicht === "monat" && (
            <MonatsAnsicht fristen={gefiltert} akten={akten} monat={monat} setMonat={setMonat} auswahl={tag} setAuswahl={setTag} land={tenant.bundesland} heute={heute} onOpen={(f) => setDetailId(f.id)} />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8">
        <FeiertageInfo land={tenant.bundesland} />
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[12.5px] text-fg-3">
        <CalendarClock className="size-3.5" />
        Jede Frist speichert Regel, Ereignisdatum und Rechenweg – revisionssicher.
      </div>

      <FristDetail f={detail} akte={detail ? akten.get(detail.akteId) : undefined} team={team} user={user} onClose={() => setDetailId(null)} />
      <Druckansicht open={druck} onClose={() => setDruck(false)} fristen={fristen} akten={akten} team={team} heute={heute} />
      <DateiDialog datei={datei} onClose={() => setDatei(null)} />
      <Fristenrechner
        open={rechnerOffen}
        onClose={schliesseRechner}
        startAkteId={rechnerOffen ? params.get("akte") ?? undefined : undefined}
        startRegel={params.get("regel") ?? undefined}
        startEreignis={params.get("ereignis") ?? undefined}
        startQuelle={params.get("herkunft") ?? undefined}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, ChevronDown, Clock, History, Info, Minus, Phone, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtTime, nowLocal, today, uid } from "@/core/dates";
import { Avatar, Button, Card, Chip, PageHeader, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { leseDatei, parseCsv, type CsvErgebnis, type DateiInfo } from "./csv";
import { autoZuordnung, baueZeilen, systemName as sysName, type DateiDublettenAktion, type DublettenAktion, type OhneDatumAktion, type QuellSystem, type Umfang, type ZielFeld } from "./zuordnung";
import { beispielExport } from "./beispiel";
import { fristenAusErgebnis, fristenAusLauf, fristenZaehlung, fuehreUmzugAus, laufFristenText, macheRueckgaengig, umzugPlan, type Entitaet, type Ergebnis, type Fortschritt } from "./uebernahme";
import { erreichbarkeit } from "./erreichbarkeit";
import { SchrittDaten, SchrittFertig, SchrittQuelle, SchrittUebernahme, SchrittZuordnung } from "./Schritte";
import {
  istAbgebrochen, ladeLaufMarke, protokolliereAbbruch, ladeStand, laufAusErgebnis, markiereRueckgaengig, setzeLaufMarke, sortiereLaeufe, speichereLauf, speichereStand, uebernehmeAlteLaeufe,
  type LaufMarke, type UmzugLauf,
} from "./laeufe";

/** Lauf, der gerade in diesem Fenster ausgeführt wird (auch wenn die Seite zwischendurch verlassen wurde). */
let laufImFenster: string | null = null;
const LEER_UNDO = (): UmzugLauf["undo"] => ({ erstellt: [], vorher: [] });

const SCHRITTE = [
  { titel: "Altsystem wählen", kurz: "Altsystem" },
  { titel: "Daten bereitstellen", kurz: "Daten" },
  { titel: "Zuordnung prüfen", kurz: "Zuordnung" },
  { titel: "Übernahme", kurz: "Übernahme" },
  { titel: "Fertig", kurz: "Fertig" },
];

export default function Umzug() {
  const nav = useNavigate();
  const { user, team, tenant } = useKanzlei();
  const akten = useCol("akten");
  const kontakte = useCol("kontakte");

  // Zwischenstand des Assistenten übersteht ein Neuladen (sessionStorage je Kanzlei)
  const [start] = useState(() => ladeStand(tenant.id));
  const [schritt, setSchritt] = useState(start ? Math.min(start.schritt, 3) : 0);
  const [richtung, setRichtung] = useState(1);
  const [system, setSystem] = useState<QuellSystem | null>(start?.system ?? null);
  const [csv, setCsv] = useState<CsvErgebnis | null>(start?.csv ?? null);
  const [datei, setDatei] = useState<DateiInfo | null>(start?.datei ?? null);
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [auto, setAuto] = useState<(ZielFeld | null)[]>(start?.auto ?? []);
  const [zuordnung, setZuordnung] = useState<(ZielFeld | null)[]>(start?.zuordnung ?? []);
  const [modus, setModus] = useState<DublettenAktion>(start?.modus ?? "skip");
  const [ausnahmen, setAusnahmen] = useState<Record<number, DublettenAktion>>(start?.ausnahmen ?? {});
  const [dateiAktionen, setDateiAktionen] = useState<Record<number, DateiDublettenAktion>>(start?.dateiAktionen ?? {});
  const [umfang, setUmfang] = useState<Umfang>(start?.umfang ?? "alle");
  const [ohneDatum, setOhneDatum] = useState<Record<number, OhneDatumAktion>>(start?.ohneDatum ?? {});
  // Hinweis „Zwischenstand wiederhergestellt“ nach dem Neuladen (ab Schritt 2)
  const [wiederhergestellt, setWiederhergestellt] = useState<string | null>(start && start.schritt > 0 ? (start.gespeichert ?? nowLocal()) : null);
  const fristenBestand = useCol("fristen");
  const laeufeRoh = useCol("umzugLaeufe");
  const laeufe = useMemo(() => sortiereLaeufe(laeufeRoh), [laeufeRoh]);
  // Protokolle aus dem früheren Browserspeicher einmalig in den Datenbestand der Kanzlei übernehmen
  useEffect(() => uebernehmeAlteLaeufe(tenant.id), [tenant.id]);
  const [fortschritt, setFortschritt] = useState<Partial<Record<Entitaet, Fortschritt>>>({});
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(laufImFenster);
  // „Was zieht um?“: vor der Dateiauswahl offen, danach eingeklappt (Platz für Zuordnung und Vorschau)
  const [wasZiehtUm, setWasZiehtUm] = useState(schritt < 2);
  const letzterStand = useRef<Ergebnis | null>(null);

  const name = sysName(system);
  // Dublettenprüfung gegen den Bestand vor dem Import (während/nach der Übernahme eingefroren)
  const [aktenStand, setAktenStand] = useState<typeof akten | null>(null);
  const zeilen = useMemo(() => (csv ? baueZeilen(csv, zuordnung, aktenStand ?? akten, tenant.bundesland) : []), [csv, zuordnung, akten, aktenStand, tenant.bundesland]);
  const aktionFuer = (nr: number) => ausnahmen[nr] ?? modus;
  const dateiAktionFuer = (nr: number): DateiDublettenAktion => dateiAktionen[nr] ?? "merge";

  useEffect(() => {
    // Während und nach der Übernahme nichts mehr festhalten – das Ergebnis steht im Umzugsprotokoll
    if (ergebnis || laeuft) return;
    speichereStand(tenant.id, system || csv ? { schritt, system, csv, datei, auto, zuordnung, modus, ausnahmen, dateiAktionen, umfang, ohneDatum } : null, nowLocal());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schritt, system, csv, datei, auto, zuordnung, modus, ausnahmen, dateiAktionen, umfang, ohneDatum]);

  // Unterbrochener Lauf (Fenster geschlossen oder neu geladen, während die Übernahme lief): vollständig zurücknehmen
  // und im Umzugsprotokoll als „abgebrochen – nichts übernommen“ festhalten.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pruefe = () => {
      const m: LaufMarke | null = ladeLaufMarke(tenant.id);
      if (!m || m.laufId === laufImFenster) return;
      // Puls jünger als 6 s: läuft vermutlich noch in einem anderen Fenster – kurz warten und erneut prüfen
      if (m.puls && Date.now() - new Date(m.puls).getTime() < 6000) {
        timer = setTimeout(pruefe, 6500);
        return;
      }
      const lauf = useData.getState().data.umzugLaeufe.find((l) => l.id === m.laufId);
      if (lauf?.rueckgaengig) {
        setzeLaufMarke(tenant.id, null);
        return;
      }
      macheRueckgaengig(lauf?.undo ?? LEER_UNDO(), m.system, user.id, m.laufId);
      protokolliereAbbruch(m, nowLocal());
      setzeLaufMarke(tenant.id, null);
      useData.getState().log({ akteur: "system", userId: user.id, text: `Umzug aus ${m.system} (${m.datei}) vom ${fmtDate(m.datum.slice(0, 10))}, ${fmtTime(m.datum)} Uhr wurde unterbrochen und vollständig zurückgenommen – nichts übernommen` });
      toast("Unterbrochener Umzug zurückgenommen", { text: `Der Lauf vom ${fmtDate(m.datum.slice(0, 10))}, ${fmtTime(m.datum)} Uhr wurde nicht zu Ende geführt. Es wurde nichts übernommen – bitte starten Sie die Übernahme erneut.`, ton: "info" });
    };
    pruefe();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  // Während der Übernahme: Hinweis des Browsers beim Schließen oder Neuladen des Fensters
  useEffect(() => {
    if (!laeuft) return;
    const warnen = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [laeuft]);

  // Eine Rechnung für Schritt 3 und 4 – zählt genau wie die Übernahme (Umfang, Dubletten, Zusammenführung, ohne Abschlussdatum)
  const plan = useMemo(
    () =>
      umzugPlan(zeilen, {
        aktionFuer: (z) => aktionFuer(z.nr),
        dateiAktionFuer: (z) => dateiAktionFuer(z.nr),
        umfang,
        heute: today(),
        ohneDatumAktionFuer: (z) => ohneDatum[z.nr],
        kontakte: laeuft || ergebnis ? [] : kontakte,
        bestand: fristenBestand,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zeilen, modus, ausnahmen, kontakte, dateiAktionen, umfang, ohneDatum, fristenBestand],
  );

  const ladeCsv = (text: string, info: DateiInfo) => {
    const p = parseCsv(text);
    if (p.kopf.length < 2 || p.zeilen.length === 0) {
      setDateiFehler("In der Datei wurden keine Tabellenzeilen gefunden. Bitte prüfen Sie, ob die erste Zeile die Spaltennamen enthält und die Werte durch Semikolon, Komma oder Tabulator getrennt sind.");
      return;
    }
    const a = autoZuordnung(p.kopf);
    setCsv(p);
    setDatei(info);
    setAuto(a);
    setZuordnung(a);
    setAusnahmen({});
    setDateiAktionen({});
    setOhneDatum({});
    setDateiFehler(null);
  };

  const onDatei = async (f: File) => {
    setLaedt(true);
    setDateiFehler(null);
    try {
      const { text, kodierung } = await leseDatei(f);
      ladeCsv(text, { name: f.name, groesse: f.size, kodierung, beispiel: false });
    } catch (e) {
      setDateiFehler(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setLaedt(false);
    }
  };

  const onBeispiel = () => {
    if (!system) return;
    const b = beispielExport(system, akten, kontakte, today());
    ladeCsv(b.text, { name: b.name, groesse: new Blob([b.text]).size, kodierung: "UTF-8", beispiel: true });
  };

  const resetDaten = () => {
    setCsv(null);
    setDatei(null);
    setZuordnung([]);
    setAuto([]);
    setAusnahmen({});
    setDateiAktionen({});
    setOhneDatum({});
    setDateiFehler(null);
    setWiederhergestellt(null);
  };

  const geheZu = (n: number) => {
    // ab der Zuordnung „Was zieht um?“ einklappen – Platz für Vorschau und Entscheidungen
    if (n >= 2 && schritt < 2) setWasZiehtUm(false);
    setRichtung(n > schritt ? 1 : -1);
    setSchritt(n);
    document.getElementById("haupt-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const starte = async () => {
    if (!csv || laeuft || plan.ohneDatumOffen > 0) return;
    const laufId = uid("uz");
    const marke: LaufMarke = { laufId, datum: nowLocal(), system: name, datei: datei?.name ?? "Export", userId: user.id, puls: nowLocal() };
    // Kennung „läuft“ setzen: wird das Fenster geschlossen, nimmt der nächste Aufruf den Lauf vollständig zurück
    laufImFenster = laufId;
    setLaufendeId(laufId);
    setzeLaufMarke(tenant.id, marke);
    letzterStand.current = null;
    setLaeuft(true);
    setAktenStand(akten);
    setFortschritt({});
    setWiederhergestellt(null);
    document.getElementById("haupt-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    // Puls alle 2 s: ein zweites Fenster erkennt daran, dass der Lauf noch arbeitet
    const puls = setInterval(() => setzeLaufMarke(tenant.id, { ...marke, puls: nowLocal() }), 2000);
    const sichere = (e: Ergebnis) => {
      letzterStand.current = e;
      speichereLauf(laufAusErgebnis({ ...e, undo: structuredClone(e.undo) }, { datum: marke.datum, system: name, datei: marke.datei, userId: user.id }));
      setzeLaufMarke(tenant.id, { ...marke, puls: nowLocal() });
    };
    try {
      const e = await fuehreUmzugAus({
        zeilen,
        aktionFuer: (z) => aktionFuer(z.nr),
        dateiAktionFuer: (z) => dateiAktionFuer(z.nr),
        ohneDatumAktionFuer: (z) => ohneDatum[z.nr],
        onZwischenstand: sichere,
        umfang,
        laufId,
        system: name,
        user,
        team,
        bundesland: tenant.bundesland,
        onFortschritt: (k, f) => setFortschritt((p) => ({ ...p, [k]: f })),
      });
      speichereLauf(laufAusErgebnis(e, { datum: marke.datum, system: name, datei: marke.datei, userId: user.id }));
      setzeLaufMarke(tenant.id, null);
      setErgebnis(e);
      speichereStand(tenant.id, null);
      // Dieselbe Zählung wie Kachel und Protokoll: „2 Fristen und 1 Wiedervorlage“ (I4-T11-02)
      toast("Umzug abgeschlossen", { text: `${e.aktenNeu + e.aktenAktualisiert} ${e.aktenNeu + e.aktenAktualisiert === 1 ? "Akte" : "Akten"}, ${e.kontakteNeu} ${e.kontakteNeu === 1 ? "Kontakt" : "Kontakte"}, ${fristenZaehlung(fristenAusErgebnis(e))} übernommen.`, ton: "erfolg" });
      setTimeout(() => geheZu(4), 650);
    } catch (err) {
      // Halber Lauf bleibt nicht stehen: alles zurücknehmen, im Protokoll als abgebrochen festhalten
      const stand = letzterStand.current as Ergebnis | null;
      macheRueckgaengig(stand?.undo ?? LEER_UNDO(), name, user.id, laufId);
      protokolliereAbbruch(marke, nowLocal());
      setzeLaufMarke(tenant.id, null);
      setFortschritt({});
      setAktenStand(null);
      toast("Übernahme unterbrochen – nichts übernommen", { text: `${err instanceof Error ? err.message : "Unbekannter Fehler."} Der Datenbestand entspricht dem Stand vor dem Start; bitte erneut versuchen.`, ton: "fehler" });
    } finally {
      clearInterval(puls);
      laufImFenster = null;
      setLaufendeId(null);
      setLaeuft(false);
    }
  };

  const neuStarten = () => {
    resetDaten();
    setErgebnis(null);
    setFortschritt({});
    setAktenStand(null);
    setSystem(null);
    speichereStand(tenant.id, null);
    geheZu(0);
  };

  /** Rückgängig je Lauf – auch nach dem Neuladen, aus dem Umzugsprotokoll. */
  const laufRueckgaengig = async (lauf: UmzugLauf) => {
    const ok = await confirmDialog({
      titel: `Umzug vom ${fmtDate(lauf.datum.slice(0, 10))} rückgängig machen?`,
      text: `Alle in diesem Lauf angelegten Akten, Kontakte, Fristen und Datenblätter je Akte werden entfernt – auch Fristen, Dokumente und Notizen, die seitdem in diesen Akten angelegt wurden. Aktualisierte Akten erhalten ihren vorherigen Stand zurück. Ihr Altsystem ist davon nicht betroffen.`,
      bestaetigen: "Rückgängig machen",
      gefahr: true,
    });
    if (!ok) return;
    // Aufteilung vor dem Löschen festhalten – der Protokolleintrag zählt danach gleich (I5-T11-01)
    const vorher = fristenAusLauf(lauf.id, useData.getState().data.fristen);
    macheRueckgaengig(lauf.undo, lauf.system, user.id, lauf.id);
    markiereRueckgaengig(lauf.id, { am: nowLocal(), von: user.id }, vorher);
    toast("Umzug rückgängig gemacht", { text: "Der Datenbestand entspricht wieder dem Stand vor diesem Lauf.", ton: "info" });
    if (ergebnis?.laufId === lauf.id) neuStarten();
  };

  const rueckgaengig = async () => {
    if (!ergebnis) return;
    const lauf = laeufe.find((l) => l.id === ergebnis.laufId);
    if (lauf) await laufRueckgaengig(lauf);
  };

  const terminAnfragen = () => {
    useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Rückruf zur Umzugsplanung mit ${tenant.ansprechpartner.name} angefragt (Probelauf, Parallelbetrieb, Umschalten)` });
    toast("Rückruf angefragt", { text: `${tenant.ansprechpartner.name} meldet sich zur Terminabstimmung. (Demo: keine echte Anfrage)`, ton: "erfolg" });
  };

  const kannWeiter =
    (schritt === 0 && !!system) ||
    (schritt === 1 && !!csv) ||
    (schritt === 2 && zeilen.some((z) => !z.fehler) && (zuordnung.includes("titel") || zuordnung.includes("aktenzeichen") || zuordnung.includes("mandant")));
  const weiterText = ["Weiter zu den Daten", "Weiter zur Zuordnung", "Weiter zur Übernahme"][schritt];
  const ap = tenant.ansprechpartner;
  // Erreichbarkeit nach Servicezeit (inServicezeit/naechsteServicezeit) – minütlich neu berechnet
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setJetzt(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const apStatus = erreichbarkeit(jetzt, ap.verfuegbar, tenant.bundesland);

  return (
    <div>
      <PageHeader
        title="Umzug"
        hilfe="umzug"
        eyebrow="Umzug in fünf Schritten – mit Vorschau und Rückgängig"
        subtitle="Akten, Kontakte und Fristen aus Ihrer bisherigen Software übernehmen – mit Vorschau, Dublettenprüfung (auch innerhalb der Datei), Plausibilitätsprüfung und Vier-Augen-Kontrolle der Fristen. Jeder Lauf lässt sich rückgängig machen."
      />

      {/* Schritt „Zuordnung prüfen“ einspaltig: die Vorschau braucht die volle Breite (Gegenstandswert und Frist ohne Querscrollen) */}
      <div className={cn("grid grid-cols-1 gap-4 lg:items-start", schritt !== 2 && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <Card padded={false} className="min-w-0">
          <Stepper schritt={schritt} />
          {wiederhergestellt && schritt > 0 && schritt < 4 && (
            <div role="status" className="mx-5 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-[var(--ink-softer)] px-3.5 py-2.5 text-[12.5px] text-fg-2 ring-1 ring-inset ring-[var(--line)] md:mx-7">
              <Info className="size-4 shrink-0 text-ink" />
              <span className="min-w-0 flex-1">
                Zwischenstand vom {fmtDate(wiederhergestellt.slice(0, 10))}, {fmtTime(wiederhergestellt)} Uhr wiederhergestellt – Datei, Zuordnung und Entscheidungen sind übernommen.
              </span>
              <Button size="sm" variant="ghost" onClick={neuStarten}>
                Neu beginnen
              </Button>
            </div>
          )}
          <div className="relative overflow-hidden px-5 pb-5 pt-5 md:px-7 md:pb-7">
            <AnimatePresence mode="wait" custom={richtung} initial={false}>
              <motion.div
                key={schritt}
                custom={richtung}
                initial={{ opacity: 0, x: richtung * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: richtung * -20 }}
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
              >
                {schritt === 0 && (
                  <SchrittQuelle
                    system={system}
                    onWahl={(s) => {
                      if (s !== system) resetDaten();
                      setSystem(s);
                    }}
                  />
                )}
                {schritt === 1 && <SchrittDaten systemName={name} csv={csv} datei={datei} fehler={dateiFehler} laedt={laedt} onDatei={onDatei} onBeispiel={onBeispiel} onReset={resetDaten} />}
                {schritt === 2 && csv && (
                  <SchrittZuordnung
                    csv={csv}
                    zuordnung={zuordnung}
                    auto={auto}
                    setZuordnung={setZuordnung}
                    zeilen={zeilen}
                    modus={modus}
                    setModus={(m) => {
                      setModus(m);
                      setAusnahmen({});
                    }}
                    ausnahmen={ausnahmen}
                    setAusnahme={(nr, a) => setAusnahmen((p) => ({ ...p, [nr]: a }))}
                    dateiAktionen={dateiAktionen}
                    setDateiAktion={(nr, a) => setDateiAktionen((p) => ({ ...p, [nr]: a }))}
                    plan={plan}
                  />
                )}
                {schritt === 3 && (
                  <SchrittUebernahme
                    plan={plan}
                    fortschritt={fortschritt}
                    laeuft={laeuft}
                    onStart={starte}
                    systemName={name}
                    umfang={umfang}
                    setUmfang={setUmfang}
                    ohneDatum={ohneDatum}
                    setOhneDatum={(nr, a) => setOhneDatum((p) => ({ ...p, [nr]: a }))}
                    setOhneDatumAlle={(a) => setOhneDatum(Object.fromEntries(plan.ohneDatum.map((z) => [z.nr, a])))}
                    heute={today()}
                  />
                )}
                {schritt === 4 && ergebnis && (
                  <SchrittFertig
                    ergebnis={ergebnis}
                    ansprechpartner={ap}
                    systemName={name}
                    onFristen={() => nav("/fristen?filter=kontrolle&quelle=migration")}
                    onAkten={() => nav("/akten")}
                    onTermin={() => {
                      useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Durchsicht des Umzugs mit ${ap.name} angefragt` });
                      toast("Terminwunsch übermittelt", { text: `${ap.name} meldet sich zur gemeinsamen Durchsicht. (Demo: keine echte Anfrage)`, ton: "erfolg" });
                    }}
                    onRueckgaengig={rueckgaengig}
                    onNeu={neuStarten}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {schritt < 3 && (
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4 md:px-7">
              <Button variant="ghost" icon={<ArrowLeft className="size-4" />} disabled={schritt === 0} onClick={() => geheZu(schritt - 1)}>
                Zurück
              </Button>
              <div className="flex min-w-0 items-center gap-3">
                {!kannWeiter && <span className="hidden truncate text-[12.5px] text-fg-3 sm:inline">{["Bitte ein Altsystem wählen", "Bitte eine Datei laden", "Bitte die Zuordnung prüfen"][schritt]}</span>}
                <Button variant="primary" iconRight={<ArrowRight className="size-4" />} disabled={!kannWeiter} onClick={() => geheZu(schritt + 1)}>
                  <span className="sm:hidden">Weiter</span>
                  <span className="hidden sm:inline">{weiterText}</span>
                </Button>
              </div>
            </div>
          )}
          {schritt === 3 && !laeuft && Object.keys(fortschritt).length === 0 && (
            <div className="flex items-center border-t border-[var(--line)] px-5 py-4 md:px-7">
              <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => geheZu(2)}>
                Zurück zur Zuordnung
              </Button>
            </div>
          )}
        </Card>

        <aside className={cn("grid min-w-0 grid-cols-1 gap-4", schritt === 2 && "lg:grid-cols-2 xl:grid-cols-3 lg:items-start")}>
          <Umzugsprotokoll laeufe={laeufe} onRueckgaengig={(l) => void laufRueckgaengig(l)} team={team} laufendeId={laufendeId} />
          <Card>
            <button
              type="button"
              className="-m-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-3 rounded-[12px] p-1 text-left"
              aria-expanded={wasZiehtUm}
              aria-controls="umzug-was-zieht-um"
              onClick={() => setWasZiehtUm((v) => !v)}
            >
              <span className="title-md">Was zieht um?</span>
              <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform duration-300", wasZiehtUm && "rotate-180")} aria-hidden />
            </button>
            {/* Kurzfassung vollständig – auch, was nicht aus dieser Datei kommt (I3-T11-02) */}
            {!wasZiehtUm && (
              <p className="mt-1 text-[12.5px] leading-snug text-fg-3">
                Akten, Kontakte, Fristen, Wiedervorlagen und Datenblatt je Akte. Nicht aus dieser Datei: Dokumente, Aktenkonten/offene Posten, Benutzer – gemeinsam mit {ap.name}. Nicht übernommen: FiBu und Zugangsdaten.
              </p>
            )}
            <div id="umzug-was-zieht-um" hidden={!wasZiehtUm}>
            <div className="eyebrow mb-2 mt-3">Kommt mit – aus Ihrem Export</div>
            <ul className="grid grid-cols-1 gap-2 text-[13px]">
              {[
                "Akten mit Aktenzeichen, Rubrum, Sachgebiet, Gegenstandswert und Status (offen, ruhend, abgeschlossen)",
                "Kontakte: Mandanten und Gegner – Dubletten werden zusammengeführt",
                "Fristen mit Vorfrist – zur Vier-Augen-Kontrolle vorgelegt",
                "Wiedervorlagen und Termine",
                "Datenblatt je Akte mit allen Originalwerten",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-green-soft text-green">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-fg-2">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <div className="eyebrow mb-2">Gemeinsam mit {ap.name}</div>
              <ul className="grid grid-cols-1 gap-2 text-[12.5px] text-fg-2">
                {["Dokumente der E-Akte im Volltext", "Aktenkonten, offene Posten und Fremdgeld", "Benutzer und Rechte", "beA-Postfach und E-Mail-Konten"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12.5px] text-fg-3">Umfang laut Angebot.</p>
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <div className="eyebrow mb-2">Kommt nicht mit</div>
              <ul className="grid grid-cols-1 gap-2 text-[12.5px] text-fg-2">
                {["Finanzbuchhaltung (FiBu) – bleibt beim Steuerberater bzw. im Altsystem", "Passwörter und Zugangsdaten des Altsystems", "Programmeinstellungen und Textbausteine des Altsystems"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Minus className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            </div>
          </Card>

          <Card>
            <div className="title-md">Zeitplan</div>
            <ol className="mt-3 grid grid-cols-1 gap-3 text-[13px]">
              {[
                ["Probelauf", "Export einlesen, Vorschau prüfen, Lauf rückgängig machen – so oft Sie möchten."],
                ["Parallelbetrieb", "Beide Systeme laufen; neue Fristen tragen Sie in Apex ein, das Altsystem bleibt unverändert."],
                ["Umschalten", "Letzter Export, Kontrolle der Fristen im Vier-Augen-Prinzip, danach arbeiten Sie nur noch in Apex."],
              ].map(([t, x], i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink-soft text-[12px] font-semibold text-ink">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{t}</span>
                    <span className="block text-[12.5px] text-fg-3">{x}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Button size="sm" variant="secondary" icon={<CalendarClock className="size-4" />} className="mt-3" onClick={terminAnfragen}>
              Termin mit {ap.name} vereinbaren
            </Button>
            <p className="mt-1.5 text-[12.5px] text-fg-3">Rückruf zur Terminabstimmung</p>
          </Card>

          <Card className="bg-[radial-gradient(120%_120%_at_0%_0%,var(--green-soft),transparent_60%)]">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-green-soft text-green">
                <RefreshCw className="size-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="title-md">Ihr Altsystem läuft parallel weiter, bis Sie umschalten</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">Im Altsystem wird nichts verändert oder gelöscht. Testen Sie den Umzug so oft Sie möchten – jeder Lauf lässt sich im Umzugsprotokoll rückgängig machen – auch nach dem Neuladen.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-3">
              <ShieldCheck className="size-3.5 text-green" /> Die Datei wird nur in Ihrer Apex-Umgebung verarbeitet.
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Avatar initialen={ap.initialen} size={40} />
              <div className="min-w-0 flex-1">
                <div className="break-words text-[13.5px] font-semibold">{ap.name}</div>
                {/* Untertitel umbrechen statt kürzen (I4-T11-01) */}
                <div className="break-words text-[12px] text-fg-3">begleitet Ihren Umzug persönlich</div>
                <div className="mt-1.5">
                  {/* Status aus der Servicezeit – wie der Apex Assistent, minütlich aktualisiert (Text und Symbol, nicht nur Farbe) */}
                  {apStatus.erreichbar ? (
                    <Chip tone="green" dot>
                      erreichbar
                    </Chip>
                  ) : (
                    <Chip tone="amber" icon={<Clock className="size-3" aria-hidden />} className="!h-auto min-h-6 !whitespace-normal py-0.5 leading-snug">
                      {apStatus.text}
                    </Chip>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-[12px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px]">
              <Phone className="size-3.5 shrink-0 text-ink" />
              <span className="min-w-0">
                {/* antippbar am Telefon, Markieren/Kopieren bleibt (I3-T12-01) */}
                <a href={`tel:${ap.telefon.replace(/[^\d+]/g, "")}`} className="num inline-flex min-h-6 select-all items-center whitespace-nowrap font-medium text-ink hover:underline pointer-coarse:min-h-11" aria-label={`${ap.name} anrufen: ${ap.telefon}`}>
                  {ap.telefon}
                </a>
                <span className="block truncate text-[12px] text-fg-3">{ap.verfuegbar}</span>
              </span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/** Umzugsprotokoll: alle Läufe mit Datum, Datei und Zahlen – „Rückgängig machen“ je Lauf, auch nach dem Neuladen. */
function Umzugsprotokoll({ laeufe, onRueckgaengig, team, laufendeId }: { laeufe: UmzugLauf[]; onRueckgaengig: (l: UmzugLauf) => void; team: { id: string; name: string }[]; laufendeId: string | null }) {
  const fristen = useCol("fristen");
  /** Dieselbe Zählung wie Meldung und Kachel (I4-T11-02) – vor und nach „Rückgängig“ gleich (I5-T11-01) */
  const protokollFristen = (l: UmzugLauf) => laufFristenText(l, fristen);
  if (!laeufe.length) return null;
  return (
    <Card>
      <div className="flex items-center gap-2">
        <History className="size-4 text-ink" />
        <div className="title-md">Umzugsprotokoll</div>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2.5">
        {laeufe.slice(0, 6).map((l) => {
          const z = l.zahlen;
          const abgebrochen = istAbgebrochen(l);
          const laeuftNoch = l.id === laufendeId;
          const von = abgebrochen ? undefined : team.find((u) => u.id === (l.rueckgaengig?.von ?? l.userId))?.name;
          return (
            <li key={l.id} className={cn("rounded-[14px] px-3 py-2.5 ring-1 ring-[var(--line)]", l.rueckgaengig && "opacity-75")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="num text-[12.5px] font-semibold">
                  {fmtDate(l.datum.slice(0, 10))}, {fmtTime(l.datum)} Uhr
                </span>
                {abgebrochen ? <Chip tone="amber">abgebrochen – nichts übernommen</Chip> : l.rueckgaengig ? <Chip>rückgängig gemacht</Chip> : laeuftNoch ? <Chip tone="ink" dot>läuft …</Chip> : <Chip tone="ink">aktiv</Chip>}
              </div>
              <div className="mt-0.5 break-words text-[12.5px] text-fg-2">
                {l.system} · {l.datei}
              </div>
              {abgebrochen ? (
                <div className="mt-0.5 text-[12.5px] text-fg-3">
                  Die Übernahme wurde unterbrochen (Fenster geschlossen oder neu geladen) und am {fmtDate(l.rueckgaengig!.am.slice(0, 10))}, {fmtTime(l.rueckgaengig!.am)} Uhr vollständig zurückgenommen.
                </div>
              ) : (
                <div className="mt-0.5 text-[12.5px] text-fg-3">
                  {z.aktenNeu} {z.aktenNeu === 1 ? "Akte" : "Akten"} neu{z.archiviert ? ` (${z.archiviert} abgeschlossen)` : ""}
                  {z.aktenAktualisiert ? `, ${z.aktenAktualisiert} aktualisiert` : ""}, {z.kontakteNeu} {z.kontakteNeu === 1 ? "Kontakt" : "Kontakte"}, {protokollFristen(l)}
                  {z.zusammengefuehrt ? `, ${z.zusammengefuehrt} ${z.zusammengefuehrt === 1 ? "Dublette" : "Dubletten"} zusammengeführt` : ""}
                  {l.undo.erstellt.some((x) => x.col === "dokumente") ? `, Datenblatt je Akte: ${l.undo.erstellt.filter((x) => x.col === "dokumente").length}` : ""}
                </div>
              )}
              {abgebrochen || laeuftNoch ? null : l.rueckgaengig ? (
                <div className="mt-0.5 text-[12.5px] text-fg-3">
                  rückgängig am {fmtDate(l.rueckgaengig.am.slice(0, 10))}
                  {von ? ` von ${von}` : ""}
                </div>
              ) : (
                <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} className="mt-1 !px-2 !text-seal" onClick={() => onRueckgaengig(l)}>
                  Rückgängig machen
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Stepper({ schritt }: { schritt: number }) {
  const anteil = schritt / (SCHRITTE.length - 1);
  return (
    <div className="border-b border-[var(--line)] px-5 py-4 md:px-7">
      {/* Smartphone: kompakt */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13.5px] font-semibold">{SCHRITTE[schritt].titel}</span>
          <span className="num text-[12px] text-fg-3">
            Schritt {schritt + 1} von {SCHRITTE.length}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
          <motion.div className="h-full rounded-full bg-ink" animate={{ width: `${((schritt + 1) / SCHRITTE.length) * 100}%` }} transition={{ type: "spring", stiffness: 260, damping: 30 }} />
        </div>
      </div>
      {/* Desktop */}
      <div className="relative hidden md:block">
        <div className="absolute left-[10%] right-[10%] top-[15px] h-[2px] rounded-full bg-[var(--line-strong)]" aria-hidden>
          <motion.div className="h-full rounded-full bg-ink" initial={false} animate={{ width: `${anteil * 100}%` }} transition={{ type: "spring", stiffness: 220, damping: 30 }} />
        </div>
        <ol className="relative grid grid-cols-5">
        {SCHRITTE.map((s, i) => {
          const fertig = i < schritt || schritt === SCHRITTE.length - 1;
          const aktiv = i === schritt && !fertig;
          return (
            <li key={s.titel} className="relative z-[1] flex flex-col items-center gap-1.5 text-center" aria-current={aktiv ? "step" : undefined}>
              <motion.span
                initial={false}
                animate={{ scale: aktiv ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "num grid size-8 place-items-center rounded-full text-[12.5px] font-semibold transition-colors duration-300",
                  fertig && "bg-ink text-[var(--on-ink)]",
                  aktiv && "bg-[var(--surface)] text-ink shadow-[0_0_0_2px_var(--ink),0_0_0_6px_var(--ink-soft)]",
                  !fertig && !aktiv && "bg-[var(--surface)] text-fg-3 shadow-[0_0_0_1px_var(--line-strong)]",
                )}
              >
                {fertig ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </motion.span>
              <span className={cn("text-[12.5px] font-medium leading-tight", aktiv ? "text-fg" : fertig ? "text-fg-2" : "text-fg-3")}>{s.kurz}</span>
            </li>
          );
        })}
        </ol>
      </div>
    </div>
  );
}

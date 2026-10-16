import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Clock, History, Minus, Phone, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtTime, nowLocal, today, uid } from "@/core/dates";
import { Avatar, Button, Card, Chip, PageHeader, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { leseDatei, parseCsv, type CsvErgebnis, type DateiInfo } from "./csv";
import { autoZuordnung, baueZeilen, imUmfang, normName, systemName as sysName, type DateiDublettenAktion, type DublettenAktion, type QuellSystem, type Umfang, type ZielFeld } from "./zuordnung";
import { beispielExport } from "./beispiel";
import { fuehreUmzugAus, macheRueckgaengig, type Entitaet, type Ergebnis, type Fortschritt } from "./uebernahme";
import { SchrittDaten, SchrittFertig, SchrittQuelle, SchrittUebernahme, SchrittZuordnung } from "./Schritte";
import { ladeStand, laufAusErgebnis, markiereRueckgaengig, sortiereLaeufe, speichereLauf, speichereStand, uebernehmeAlteLaeufe, type UmzugLauf } from "./laeufe";

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
  const laeufeRoh = useCol("umzugLaeufe");
  const laeufe = useMemo(() => sortiereLaeufe(laeufeRoh), [laeufeRoh]);
  // Protokolle aus dem früheren Browserspeicher einmalig in den Datenbestand der Kanzlei übernehmen
  useEffect(() => uebernehmeAlteLaeufe(tenant.id), [tenant.id]);
  const [fortschritt, setFortschritt] = useState<Partial<Record<Entitaet, Fortschritt>>>({});
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  const name = sysName(system);
  // Dublettenprüfung gegen den Bestand vor dem Import (während/nach der Übernahme eingefroren)
  const [aktenStand, setAktenStand] = useState<typeof akten | null>(null);
  const zeilen = useMemo(() => (csv ? baueZeilen(csv, zuordnung, aktenStand ?? akten, tenant.bundesland) : []), [csv, zuordnung, akten, aktenStand, tenant.bundesland]);
  const aktionFuer = (nr: number) => ausnahmen[nr] ?? modus;
  const dateiAktionFuer = (nr: number): DateiDublettenAktion => dateiAktionen[nr] ?? "merge";

  useEffect(() => {
    // Während und nach der Übernahme nichts mehr festhalten – das Ergebnis steht im Umzugsprotokoll
    if (ergebnis || laeuft) return;
    speichereStand(tenant.id, system || csv ? { schritt, system, csv, datei, auto, zuordnung, modus, ausnahmen, dateiAktionen, umfang } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schritt, system, csv, datei, auto, zuordnung, modus, ausnahmen, dateiAktionen, umfang]);

  const plan = useMemo(() => {
    const heute = today();
    const ok0 = zeilen.filter((z) => !z.fehler);
    const ausserhalb = ok0.filter((z) => !imUmfang(z, umfang, heute)).length;
    const ok = ok0.filter((z) => imUmfang(z, umfang, heute) && !(z.dateiDublette && dateiAktionFuer(z.nr) !== "keep"));
    const zusammengefuehrt = ok0.filter((z) => imUmfang(z, umfang, heute) && z.dateiDublette && dateiAktionFuer(z.nr) === "merge").length;
    const dateiUebersprungen = ok0.filter((z) => imUmfang(z, umfang, heute) && z.dateiDublette && dateiAktionFuer(z.nr) === "skip").length;
    const dub = ok.filter((z) => z.dublette);
    const ueberspringen = dub.filter((z) => aktionFuer(z.nr) === "skip").length + dateiUebersprungen;
    const aktualisieren = dub.length - dub.filter((z) => aktionFuer(z.nr) === "skip").length;
    const rein = ok.filter((z) => !(z.dublette && aktionFuer(z.nr) === "skip"));
    const namen = new Set<string>();
    for (const z of rein) for (const n of [z.mandant, z.gegner]) if (normName(n)) namen.add(normName(n));
    const vorhanden = new Set(kontakte.map((k) => normName(k.name)));
    const mitFrist = rein.filter((z) => z.fristDatum);
    const kontrolle = mitFrist.filter((z) => z.fristTyp === "notfrist" || z.fristTyp === "frist").length;
    return {
      akten: ok.length - dub.length,
      archiv: ok.filter((z) => !z.dublette && z.status === "abgeschlossen").length,
      aktualisieren,
      ueberspringen,
      zusammengefuehrt,
      ausserhalb,
      fristen: kontrolle,
      wiedervorlagen: mitFrist.length - kontrolle,
      kontakte: namen.size,
      kontakteVorhanden: [...namen].filter((n) => vorhanden.has(n)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeilen, modus, ausnahmen, kontakte, dateiAktionen, umfang]);

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
    setDateiFehler(null);
  };

  const geheZu = (n: number) => {
    setRichtung(n > schritt ? 1 : -1);
    setSchritt(n);
    document.getElementById("haupt-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const starte = async () => {
    if (!csv || laeuft) return;
    setLaeuft(true);
    setAktenStand(akten);
    setFortschritt({});
    try {
      const e = await fuehreUmzugAus({
        zeilen,
        aktionFuer: (z) => aktionFuer(z.nr),
        dateiAktionFuer: (z) => dateiAktionFuer(z.nr),
        umfang,
        laufId: uid("uz"),
        system: name,
        user,
        team,
        bundesland: tenant.bundesland,
        onFortschritt: (k, f) => setFortschritt((p) => ({ ...p, [k]: f })),
      });
      setErgebnis(e);
      speichereStand(tenant.id, null);
      speichereLauf(laufAusErgebnis(e, { datum: nowLocal(), system: name, datei: datei?.name ?? "Export", userId: user.id }));
      toast("Umzug abgeschlossen", { text: `${e.aktenNeu + e.aktenAktualisiert} Akten, ${e.kontakteNeu} Kontakte und ${e.fristen} Fristen übernommen.`, ton: "erfolg" });
      setTimeout(() => geheZu(4), 650);
    } catch (err) {
      toast("Übernahme unterbrochen", { text: err instanceof Error ? err.message : "Bitte erneut versuchen.", ton: "fehler" });
    } finally {
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
      text: `Alle in diesem Lauf angelegten Akten, Kontakte, Fristen und Dokument-Verweise werden entfernt – auch Fristen, Dokumente und Notizen, die seitdem in diesen Akten angelegt wurden. Aktualisierte Akten erhalten ihren vorherigen Stand zurück. Ihr Altsystem ist davon nicht betroffen.`,
      bestaetigen: "Rückgängig machen",
      gefahr: true,
    });
    if (!ok) return;
    macheRueckgaengig(lauf.undo, lauf.system, user.id, lauf.id);
    markiereRueckgaengig(lauf.id, { am: nowLocal(), von: user.id });
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

  return (
    <div>
      <PageHeader
        title="Umzug"
        hilfe="umzug"
        eyebrow="Umzug in fünf Schritten – mit Vorschau und Rückgängig"
        subtitle="Akten, Kontakte und Fristen aus Ihrer bisherigen Software übernehmen – mit Vorschau, Dublettenprüfung (auch innerhalb der Datei), Plausibilitätsprüfung und Vier-Augen-Kontrolle der Fristen. Jeder Lauf lässt sich rückgängig machen."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Card padded={false} className="min-w-0">
          <Stepper schritt={schritt} />
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
                    kontakte={kontakte}
                    modus={modus}
                    setModus={(m) => {
                      setModus(m);
                      setAusnahmen({});
                    }}
                    ausnahmen={ausnahmen}
                    setAusnahme={(nr, a) => setAusnahmen((p) => ({ ...p, [nr]: a }))}
                    dateiAktionen={dateiAktionen}
                    setDateiAktion={(nr, a) => setDateiAktionen((p) => ({ ...p, [nr]: a }))}
                  />
                )}
                {schritt === 3 && <SchrittUebernahme plan={plan} fortschritt={fortschritt} laeuft={laeuft} onStart={starte} systemName={name} umfang={umfang} setUmfang={setUmfang} />}
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

        <aside className="flex min-w-0 flex-col gap-4">
          <Umzugsprotokoll laeufe={laeufe} onRueckgaengig={(l) => void laufRueckgaengig(l)} team={team} />
          <Card>
            <div className="title-md">Was zieht um?</div>
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
          </Card>

          <Card>
            <div className="title-md">Zeitplan</div>
            <ol className="mt-3 grid grid-cols-1 gap-3 text-[13px]">
              {[
                ["Probelauf", "Export einlesen, Vorschau prüfen, Lauf rückgängig machen – so oft Sie möchten."],
                ["Parallelbetrieb", "Beide Systeme laufen; neue Fristen tragen Sie in AnwaltApex ein, das Altsystem bleibt unverändert."],
                ["Umschalten", "Letzter Export, Kontrolle der Fristen im Vier-Augen-Prinzip, danach arbeiten Sie nur noch in AnwaltApex."],
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
              <ShieldCheck className="size-3.5 text-green" /> Die Datei wird nur in Ihrer AnwaltApex-Umgebung verarbeitet.
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Avatar initialen={ap.initialen} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{ap.name}</div>
                <div className="truncate text-[12px] text-fg-3">begleitet Ihren Umzug persönlich</div>
              </div>
              <Chip tone="green" dot>
                erreichbar
              </Chip>
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-[12px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px]">
              <Phone className="size-3.5 shrink-0 text-ink" />
              <span className="min-w-0">
                <span className="num block select-all whitespace-nowrap font-medium">{ap.telefon}</span>
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
function Umzugsprotokoll({ laeufe, onRueckgaengig, team }: { laeufe: UmzugLauf[]; onRueckgaengig: (l: UmzugLauf) => void; team: { id: string; name: string }[] }) {
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
          const von = team.find((u) => u.id === (l.rueckgaengig?.von ?? l.userId))?.name;
          return (
            <li key={l.id} className={cn("rounded-[14px] px-3 py-2.5 ring-1 ring-[var(--line)]", l.rueckgaengig && "opacity-75")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="num text-[12.5px] font-semibold">
                  {fmtDate(l.datum.slice(0, 10))}, {fmtTime(l.datum)} Uhr
                </span>
                {l.rueckgaengig ? <Chip>rückgängig gemacht</Chip> : <Chip tone="ink">aktiv</Chip>}
              </div>
              <div className="mt-0.5 break-words text-[12.5px] text-fg-2">
                {l.system} · {l.datei}
              </div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">
                {z.aktenNeu} Akten neu{z.archiviert ? ` (${z.archiviert} abgeschlossen)` : ""}
                {z.aktenAktualisiert ? `, ${z.aktenAktualisiert} aktualisiert` : ""}, {z.kontakteNeu} Kontakte, {z.fristen} Fristen
                {z.zusammengefuehrt ? `, ${z.zusammengefuehrt} Dublette(n) zusammengeführt` : ""}
              </div>
              {l.rueckgaengig ? (
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

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Clock, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { today } from "@/core/dates";
import { Avatar, Button, Card, Chip, PageHeader, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { leseDatei, parseCsv, type CsvErgebnis, type DateiInfo } from "./csv";
import { autoZuordnung, baueZeilen, normName, systemName as sysName, type DublettenAktion, type QuellSystem, type ZielFeld } from "./zuordnung";
import { beispielExport } from "./beispiel";
import { fuehreUmzugAus, macheRueckgaengig, type Entitaet, type Ergebnis, type Fortschritt } from "./uebernahme";
import { SchrittDaten, SchrittFertig, SchrittQuelle, SchrittUebernahme, SchrittZuordnung } from "./Schritte";

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

  const [schritt, setSchritt] = useState(0);
  const [richtung, setRichtung] = useState(1);
  const [system, setSystem] = useState<QuellSystem | null>(null);
  const [csv, setCsv] = useState<CsvErgebnis | null>(null);
  const [datei, setDatei] = useState<DateiInfo | null>(null);
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [auto, setAuto] = useState<(ZielFeld | null)[]>([]);
  const [zuordnung, setZuordnung] = useState<(ZielFeld | null)[]>([]);
  const [modus, setModus] = useState<DublettenAktion>("skip");
  const [ausnahmen, setAusnahmen] = useState<Record<number, DublettenAktion>>({});
  const [fortschritt, setFortschritt] = useState<Partial<Record<Entitaet, Fortschritt>>>({});
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  const name = sysName(system);
  // Dublettenprüfung gegen den Bestand vor dem Import (während/nach der Übernahme eingefroren)
  const [aktenStand, setAktenStand] = useState<typeof akten | null>(null);
  const zeilen = useMemo(() => (csv ? baueZeilen(csv, zuordnung, aktenStand ?? akten) : []), [csv, zuordnung, akten, aktenStand]);
  const aktionFuer = (nr: number) => ausnahmen[nr] ?? modus;

  const plan = useMemo(() => {
    const ok = zeilen.filter((z) => !z.fehler);
    const dub = ok.filter((z) => z.dublette);
    const ueberspringen = dub.filter((z) => aktionFuer(z.nr) === "skip").length;
    const aktualisieren = dub.length - ueberspringen;
    const rein = ok.filter((z) => !(z.dublette && aktionFuer(z.nr) === "skip"));
    const namen = new Set<string>();
    for (const z of rein) for (const n of [z.mandant, z.gegner]) if (normName(n)) namen.add(normName(n));
    return { akten: ok.length - dub.length, aktualisieren, ueberspringen, fristen: rein.filter((z) => z.fristDatum).length, kontakte: namen.size };
  }, [zeilen, modus, ausnahmen]);

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
        system: name,
        user,
        team,
        bundesland: tenant.bundesland,
        onFortschritt: (k, f) => setFortschritt((p) => ({ ...p, [k]: f })),
      });
      setErgebnis(e);
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
    geheZu(0);
  };

  const rueckgaengig = async () => {
    if (!ergebnis) return;
    const ok = await confirmDialog({
      titel: "Umzug rückgängig machen?",
      text: `Alle in diesem Lauf angelegten Akten, Kontakte, Fristen und Dokument-Verweise werden entfernt, aktualisierte Akten erhalten ihren vorherigen Stand zurück. Ihr Altsystem ist davon nicht betroffen.`,
      bestaetigen: "Rückgängig machen",
      gefahr: true,
    });
    if (!ok) return;
    macheRueckgaengig(ergebnis.undo, name, user.id);
    toast("Umzug rückgängig gemacht", { text: "Der Datenbestand entspricht wieder dem Stand vor dem Umzug.", ton: "info" });
    neuStarten();
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
        eyebrow="One-Klick-Migration"
        subtitle="Wechseln Sie mit einem Klick: Akten, Kontakte und Fristen ziehen vollständig um – mit Vorschau, Dublettenprüfung und Fristen-Kontrolle."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                  />
                )}
                {schritt === 3 && <SchrittUebernahme plan={plan} fortschritt={fortschritt} laeuft={laeuft} onStart={starte} systemName={name} />}
                {schritt === 4 && ergebnis && (
                  <SchrittFertig
                    ergebnis={ergebnis}
                    ansprechpartner={ap}
                    systemName={name}
                    onFristen={() => nav("/fristen")}
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
                {!kannWeiter && <span className="hidden truncate text-[12px] text-fg-4 sm:inline">{["Bitte ein Altsystem wählen", "Bitte eine Datei laden", "Bitte die Zuordnung prüfen"][schritt]}</span>}
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
          <Card>
            <div className="title-md">Was zieht um?</div>
            <ul className="mt-3 grid grid-cols-1 gap-2.5 text-[13px]">
              {[
                "Akten mit Aktenzeichen, Rubrum, Sachgebiet und Gegenstandswert",
                "Mandanten und Gegner als Kontakte – Dubletten werden zusammengeführt",
                "Fristen mit Vorfrist – zur Vier-Augen-Kontrolle vorgelegt",
                "Verweis auf die Originaldaten je Akte (Datenblatt)",
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
              <div className="eyebrow mb-2">Gemeinsam mit Ihrem Ansprechpartner</div>
              <ul className="grid grid-cols-1 gap-2 text-[12.5px] text-fg-3">
                {["Dokumente der E-Akte im Volltext", "Aktenkonten, offene Posten und Fremdgeld", "beA-Postfach und E-Mail-Konten"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-fg-4" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="bg-[radial-gradient(120%_120%_at_0%_0%,var(--green-soft),transparent_60%)]">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-green-soft text-green">
                <RefreshCw className="size-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="title-md">Ihr Altsystem läuft parallel weiter, bis Sie umschalten</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-3">Im Altsystem wird nichts verändert oder gelöscht. Testen Sie den Umzug so oft Sie möchten – jeder Lauf lässt sich mit einem Klick rückgängig machen.</p>
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
                <span className="block truncate text-[11.5px] text-fg-3">{ap.verfuegbar}</span>
              </span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
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
                  !fertig && !aktiv && "bg-[var(--surface)] text-fg-4 shadow-[0_0_0_1px_var(--line-strong)]",
                )}
              >
                {fertig ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </motion.span>
              <span className={cn("text-[12px] font-medium leading-tight", aktiv ? "text-fg" : fertig ? "text-fg-2" : "text-fg-4")}>{s.kurz}</span>
            </li>
          );
        })}
        </ol>
      </div>
    </div>
  );
}

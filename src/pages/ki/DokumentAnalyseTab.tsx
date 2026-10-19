import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, BadgeCheck, Calculator, CalendarClock, ChevronDown, CircleCheck, FileText, FileUp, FolderOpen, FolderSearch, Gavel, Inbox,
 Mail, RotateCcw, ScanText, ShieldAlert, Sparkles, Stamp, Tags, X,
} from "lucide-react";
import { analysiereDokument, ausschlussfristTitel, ausschlussfristVorschlag, beispielDokumente, dauerText, type Ausschlussklausel, type DokAnalyse, type FristVorschlag } from "@/ai/dokumentAnalyse";
import { useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtDateWd, fmtNum, nowLocal, relDays, today, uid } from "@/core/dates";
import { fristArtZu, fristDringlichkeit } from "@/core/fristen";
import type { Akte, Dokument, Frist } from "@/core/types";
import { legeFristAn } from "@/pages/fristen/logik";
import { AiChip, Button, Card, Chip, Field, Input, ProgressRing, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KiSchritte, usePipeline, type KiSchritt } from "./KiSchritte";
import { standardAkte } from "./FallanalyseTab";
import { ladeDokAnalyse, merkeDokAnalyse, sitzungsSchluessel, vergissDokAnalyse } from "./dokumentAnalyseStand";
import { BEWEGUNG } from "@/lib/bewegung";

const SCHRITTE: KiSchritt[] = [
  { label: "Lesen", detail: "Text & Struktur", icon: <ScanText /> },
  { label: "Typ erkennen", detail: "Schriftstück & Ereignis", icon: <Tags /> },
  { label: "Akte zuordnen", detail: "Az., Parteien, Gericht", icon: <FolderSearch /> },
  { label: "Fristen berechnen", detail: "Fristenrechner mit Rechenweg", icon: <Calculator /> },
];

const SICHER_AB = 0.8;

const BEISPIEL_ICONS = [<Gavel key="g" className="size-4" />, <Stamp key="s" className="size-4" />, <Mail key="m" className="size-4" />];

/** Kurzer Fingerabdruck eines Textes – damit dieselbe Analyse „KI gespart“ nur einmal erhöht. */
function fingerabdruck(t: string): string {
  let h = 0;
  const n = t.replace(/\s+/g, " ").trim();
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Dokument-Analyse: Schreiben einfügen → Typ, Akte, Fristen (berechnet vom Fristenrechner), Termin und nächste Schritte. */
export function DokumentAnalyseTab({ akteParam, dokParam }: { akteParam?: string; dokParam?: string }) {
  const nav = useNavigate();
  const { tenant, user } = useKanzlei();
  const data = useData((s) => s.data);
  const quelle = useAiStatus((s) => s.quelle);
  const live = quelle !== "demo";
  const beispiele = useMemo(() => beispielDokumente(), []);
  // Letztes Ergebnis aus dieser Sitzung (I5-T19-02): zum Dokument bzw. zur Akte aus dem Deep-Link, sonst das zuletzt bearbeitete
  const [gemerkt] = useState(() => ladeDokAnalyse({ dokId: dokParam, akteId: dokParam ? undefined : akteParam }));
  const [text, setText] = useState(gemerkt?.text ?? "");
  const [betreff, setBetreff] = useState(gemerkt?.betreff ?? "");
  const [von, setVon] = useState(gemerkt?.von ?? "");
  const [beispielAktiv, setBeispielAktiv] = useState<number | null>(gemerkt?.beispielAktiv ?? null);
  // Betreff/Absender stammen aus Beispiel oder Datei – beim Ersetzen des Texts wieder leeren
  const [autoFelder, setAutoFelder] = useState(gemerkt?.autoFelder ?? false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [analyse, setAnalyse] = useState<DokAnalyse | null>(gemerkt?.analyse ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [zielAkte, setZielAkte] = useState(gemerkt?.zielAkte ?? "");
  const [uebernommen, setUebernommen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { aktiv, lauf, zuruecksetzen } = usePipeline(SCHRITTE.length, 480);
  /** Dokument aus der E-Akte, dessen Text analysiert wird (Akte steht damit fest). */
  const [ausAkte, setAusAkte] = useState<{ akteId: string; dokId: string } | null>(gemerkt?.ausAkte ?? null);
  /** Ausschlussfrist: eingegebene Fälligkeit und Anspruch – gehören zum gemerkten Ergebnis */
  const [ausschluss, setAusschluss] = useState(gemerkt?.ausschluss ?? { faellig: "", anspruch: "" });
  /** Ergebnis wird gehalten, bis es verworfen oder übernommen ist */
  const [halten, setHalten] = useState(true);
  const analyseSchluesselAkte = analyse ? sitzungsSchluessel({ ausAkte, analyse, zielAkte }) : undefined;
  const vorigerSchluessel = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!analyse || !halten || uebernommen) return;
    // Andere Akte gewählt: der Stand zieht mit um (kein veralteter Eintrag unter der vorigen Akte)
    if (vorigerSchluessel.current && vorigerSchluessel.current !== analyseSchluesselAkte) vergissDokAnalyse(vorigerSchluessel.current);
    vorigerSchluessel.current = analyseSchluesselAkte;
    merkeDokAnalyse({ text, betreff, von, beispielAktiv, autoFelder, ausAkte, analyse, zielAkte, ausschluss });
  }, [analyse, halten, uebernommen, text, betreff, von, beispielAktiv, autoFelder, ausAkte, zielAkte, ausschluss, analyseSchluesselAkte]);
  /** Gemerkten Stand loslassen (Verwerfen, Neues Dokument, Übernehmen) */
  const loslassen = () => {
    if (analyseSchluesselAkte) vergissDokAnalyse(analyseSchluesselAkte);
    setHalten(false);
  };
  const [wahlOffen, setWahlOffen] = useState(false);
  const [wahlAkte, setWahlAkte] = useState(akteParam ?? "");

  const offene = useMemo(() => data.akten.filter((a) => a.status === "offen").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data.akten]);
  const erkannteAkte = analyse?.akteId ? data.akten.find((a) => a.id === analyse.akteId) : undefined;
  // Nur eindeutige Treffer (Aktenzeichen, Gerichtsaktenzeichen, Mandantenname) gelten als zugeordnet – sonst bestätigt der Mensch.
  const sicherZugeordnet = !!erkannteAkte && (analyse?.akteSicherheit ?? 0) >= SICHER_AB;

  const waehleBeispiel = (i: number) => {
    const b = beispiele[i];
    setText(b.text);
    setBetreff(b.betreff);
    setVon(b.von);
    setBeispielAktiv(i);
    setAutoFelder(true);
  };

  /** Neuer Text: Stammen Betreff und Absender noch vom vorigen Beispiel bzw. der Datei, gehören sie nicht mehr dazu. */
  const textAendern = (neu: string) => {
    const alt = text;
    const ersetzt = !neu.trim() || (alt.length >= 40 && !neu.includes(alt.slice(0, 40)) && !alt.includes(neu.slice(0, 40)));
    if (autoFelder && ersetzt) {
      setBetreff("");
      setVon("");
      setAutoFelder(false);
    }
    setText(neu);
    setBeispielAktiv(null);
  };

  const ladeDatei = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_000_000) {
      toast("Datei zu groß", { text: "Bitte eine Textdatei bis 1 MB wählen.", ton: "warnung" });
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      setText(String(r.result ?? ""));
      setBetreff(f.name.replace(/\.[^.]+$/, ""));
      setVon(""); // Absender steht im Schreiben selbst – die Analyse liest ihn aus dem Text
      setBeispielAktiv(null);
      setAutoFelder(true);
      toast("Datei geladen", { text: f.name, ton: "info" });
    };
    r.onerror = () => toast("Datei konnte nicht gelesen werden", { text: "Bitte als UTF-8-Textdatei (.txt) speichern und erneut versuchen.", ton: "fehler" });
    r.readAsText(f, "utf-8");
  };

  const analysieren = async (eingabe?: { text: string; betreff?: string; von?: string; quelle?: { akteId: string; dokId: string } | null }) => {
    const t = eingabe?.text ?? text;
    const b = eingabe ? (eingabe.betreff ?? "") : betreff;
    const v = eingabe ? (eingabe.von ?? "") : von;
    const quelleDok = eingabe ? (eingabe.quelle ?? null) : ausAkte;
    if (t.trim().length < 20) return;
    // Neue Analyse ersetzt den gemerkten Stand derselben Akte; Fälligkeit gehört zum neuen Ergebnis
    if (analyseSchluesselAkte) vergissDokAnalyse(analyseSchluesselAkte);
    setFehler(null);
    setAnalyse(null);
    setUebernommen(null);
    setAusschluss({ faellig: "", anspruch: "" });
    setHalten(true);
    setLaeuft(true);
    try {
      const daten = useData.getState().data;
      let res = await lauf(() => analysiereDokument({ text: t, betreff: b || undefined, von: v || undefined, eingang: today() }, daten, tenant.bundesland));
      // Aus der E-Akte geladen: Die Akte steht fest – keine Zuordnung raten.
      if (quelleDok) res = { ...res, akteId: quelleDok.akteId, akteSicherheit: 1, akteGrund: "Dokument aus der E-Akte" };
      setAnalyse(res);
      setZielAkte(res.akteId ?? (akteParam && offene.some((a) => a.id === akteParam) ? akteParam : undefined) ?? standardAkte(daten.akten)?.id ?? offene[0]?.id ?? "");
      // „KI gespart“ zählt je Dokument nur bei der ersten Analyse – erneutes Analysieren desselben Texts erhöht die Zahl nicht.
      const logText = `Dokument analysiert: ${res.typ} – „${b || t.trim().slice(0, 48)}${!b && t.trim().length > 48 ? "…" : ""}“ (#${fingerabdruck(t)})`;
      const schonGezaehlt = daten.aktivitaeten.some((a) => a.akteur === "ki" && a.text === logText && (a.minutenGespart ?? 0) > 0);
      useData.getState().log({ akteur: "ki", userId: user.id, akteId: res.akteId, text: logText, minutenGespart: schonGezaehlt ? 0 : 4 });
    } catch (e) {
      zuruecksetzen();
      setFehler(e instanceof Error ? e.message : "Die Analyse ist fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  };

  const uebernehmen = () => {
    if (!analyse) return;
    const akte = data.akten.find((a) => a.id === (sicherZugeordnet ? analyse.akteId : zielAkte));
    if (!akte) {
      toast("Bitte eine Akte wählen", { ton: "warnung" });
      return;
    }
    const st = useData.getState();
    const jetzt = nowLocal();
    const herkunft = betreff ? `„${betreff}“` : "dem analysierten Schreiben";
    const neu: Frist[] = analyse.fristen.map((f) => ({
      id: uid("f"),
      akteId: akte.id,
      titel: f.titel,
      typ: f.typ,
      datum: f.ende,
      vorfrist: f.vorfrist,
      regelKey: f.regelKey,
      grundlage: f.grundlage,
      ereignisDatum: f.ereignisDatum,
      rechenweg: f.rechenweg,
      status: "offen",
      verantwortlichId: akte.bearbeiterId || user.id,
      quelle: "ki",
      notiz: `Von der KI aus ${herkunft} erkannt, berechnet vom Fristenrechner. Bitte im Vier-Augen-Prinzip kontrollieren.`,
      createdAt: jetzt,
    }));
    if (analyse.termin) {
      neu.push({
        id: uid("f"),
        akteId: akte.id,
        titel: analyse.termin.titel,
        typ: "termin",
        datum: analyse.termin.datum,
        uhrzeit: analyse.termin.uhrzeit,
        ort: analyse.termin.ort,
        status: "offen",
        verantwortlichId: akte.bearbeiterId || user.id,
        quelle: "ki",
        notiz: `Von der KI aus ${herkunft} erkannt.`,
        createdAt: jetzt,
      });
    }
    if (!neu.length) return;
    for (const f of neu) st.upsert("fristen", f);
    // Übernommen: das gemerkte Ergebnis entfällt (I5-T19-02)
    loslassen();
    const nF = analyse.fristen.length;
    const teil = [nF ? `${nF} ${nF === 1 ? "Frist" : "Fristen"}` : "", analyse.termin ? "1 Termin" : ""].filter(Boolean).join(" und ");
    st.log({ akteur: "ki", userId: user.id, akteId: akte.id, text: `${teil} aus ${herkunft} in Akte ${akte.aktenzeichen} übernommen (Fristenrechner, Kontrolle ausstehend)`, minutenGespart: 6 * neu.length });
    setUebernommen(akte.id);
    toast(nF === 1 ? "Frist eingetragen" : nF > 1 ? "Fristen eingetragen" : "Termin eingetragen", {
      text: `${teil} in ${akte.aktenzeichen} · bitte im Vier-Augen-Prinzip kontrollieren`,
      ton: "erfolg",
      aktion: {
        label: "Rückgängig",
        onClick: () => {
          for (const f of neu) useData.getState().remove("fristen", f.id);
          useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `KI-Fristenübernahme in ${akte.aktenzeichen} rückgängig gemacht` });
          setUebernommen(null);
          toast("Übernahme rückgängig gemacht", { ton: "info" });
        },
      },
    });
  };

  /** „Neues Dokument“: Ergebnis und Eingabe (Text, Betreff, Absender) leeren. */
  const neuStarten = () => {
    loslassen();
    setAnalyse(null);
    setFehler(null);
    setUebernommen(null);
    setText("");
    setBetreff("");
    setVon("");
    setBeispielAktiv(null);
    setAutoFelder(false);
    setAusAkte(null);
    zuruecksetzen();
    setTimeout(() => textRef.current?.focus(), 60);
  };

  /** „Vorschlag verwerfen“: Es wird nichts gespeichert – Akte, Fristen und Dokumente bleiben unverändert. */
  const verwerfen = () => {
    loslassen();
    setAnalyse(null);
    setUebernommen(null);
    zuruecksetzen();
    toast("Vorschlag verworfen", { text: "Nichts gespeichert – Akte, Fristen und Dokumente sind unverändert.", ton: "info" });
  };

  /** Dokument aus der E-Akte laden und sofort analysieren. */
  const ladeAusAkte = (d: Dokument) => {
    setText(d.inhalt);
    setBetreff(d.name);
    setVon("");
    setBeispielAktiv(null);
    setAutoFelder(true);
    setAusAkte({ akteId: d.akteId, dokId: d.id });
    setWahlOffen(false);
    void analysieren({ text: d.inhalt, betreff: d.name, von: "", quelle: { akteId: d.akteId, dokId: d.id } });
  };

  // Deep-Link aus dem Dokumentbetrachter der Akte: /ki?tab=dokument&akte=<id>&dok=<dokId>
  const geladen = useRef<string | null>(null);
  useEffect(() => {
    if (!dokParam || geladen.current === dokParam) return;
    // Gemerktes Ergebnis zu diesem Dokument: nicht neu analysieren, sondern weiterzeigen (I5-T19-02)
    if (gemerkt?.ausAkte?.dokId === dokParam) {
      geladen.current = dokParam;
      return;
    }
    const d = useData.getState().data.dokumente.find((x) => x.id === dokParam);
    if (!d) return;
    geladen.current = dokParam;
    ladeAusAkte(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dokParam]);

  const wahlAkteObj = data.akten.find((a) => a.id === (wahlAkte || standardAkte(data.akten)?.id));
  const wahlDokumente = useMemo(
    () => (wahlAkteObj ? data.dokumente.filter((d) => d.akteId === wahlAkteObj.id && d.inhalt.trim().length >= 20).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [data.dokumente, wahlAkteObj],
  );

  const kannUebernehmen = !!analyse && (analyse.fristen.length > 0 || !!analyse.termin);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      {/* ───────── Eingabe ───────── */}
      <Card className="!p-4 sm:!p-5">
        <div className="mb-4">
          <div className="min-w-0">
            <h2 className="title-md">Schreiben einfügen</h2>
            <p className="mt-0.5 text-[13px] leading-[18px] text-fg-3">Text einfügen, eine Textdatei laden oder ein Beispiel wählen. Eingangsdatum: heute.</p>
          </div>
        </div>

        <div className="label">Beispiele</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {beispiele.map((b, i) => (
            <button
              key={b.titel}
              type="button"
              onClick={() => waehleBeispiel(i)}
              aria-pressed={beispielAktiv === i}
              className={cn(
                "group relative flex min-w-0 items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors duration-100 sm:flex-col sm:gap-1.5",
                beispielAktiv === i ? "bg-[var(--surface-3)] shadow-[inset_0_0_0_1px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--line)] hover:bg-[var(--surface-2)]",
              )}
            >
              <span className={cn("mt-0.5 shrink-0 [&>svg]:size-4", beispielAktiv === i ? "text-fg" : "text-fg-4")} aria-hidden>
                {BEISPIEL_ICONS[i] ?? <FileText className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-5 max-sm:truncate sm:hyphens-auto">{b.titel}</span>
                <span className="block text-[13px] leading-[18px] text-fg-4 max-sm:truncate sm:hyphens-auto">{b.von}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <Button variant="secondary" size="sm" icon={<FolderOpen className="size-4" />} aria-expanded={wahlOffen} onClick={() => setWahlOffen((o) => !o)}>
            Aus Akte wählen
          </Button>
          {ausAkte && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-[13px] text-fg-2">
              <FileText className="size-3.5 text-fg-3" />
              aus der E-Akte {data.akten.find((a) => a.id === ausAkte.akteId)?.aktenzeichen}
            </span>
          )}
          <AnimatePresence initial={false}>
            {wahlOffen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                <div className="mt-3 grid gap-2 border-t border-[var(--line)] pt-3">
                  <Field label="Akte" htmlFor="dok-wahl-akte">
                    <Select id="dok-wahl-akte" value={wahlAkteObj?.id ?? ""} onChange={(e) => setWahlAkte(e.target.value)}>
                      {offene.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.aktenzeichen} · {a.titel}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="label !mb-0">Dokument der E-Akte – ein Klick analysiert</div>
                  {wahlDokumente.length ? (
                    <ul className="grid max-h-[240px] gap-1 overflow-y-auto pr-1">
                      {wahlDokumente.map((d) => (
                        <li key={d.id}>
                          <button type="button" onClick={() => ladeAusAkte(d)} className="flex w-full min-w-0 items-start gap-2 rounded-sm px-2.5 py-2 text-left transition-colors duration-100 hover:bg-[var(--surface-2)]">
                            <FileText className="mt-0.5 size-4 shrink-0 text-fg-4" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14px] font-medium leading-5">{d.name}</span>
                              <span className="block text-[13px] text-fg-4">
                                {d.ordner} · {fmtDate(d.createdAt.slice(0, 10))}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-fg-3">In dieser Akte liegt kein Dokument mit Text.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Betreff" htmlFor="dok-betreff">
            <Input id="dok-betreff" value={betreff} onChange={(e) => { setBetreff(e.target.value); setAutoFelder(false); }} placeholder="z. B. Zustellung eines Urteils" />
          </Field>
          <Field label="Absender" htmlFor="dok-von">
            <Input id="dok-von" value={von} onChange={(e) => { setVon(e.target.value); setAutoFelder(false); }} placeholder="z. B. Landgericht Berlin" />
          </Field>
        </div>
        <Field label="Text des Schreibens" htmlFor="dok-text" className="mt-3">
          <Textarea
            id="dok-text"
            ref={textRef}
            rows={9}
            value={text}
            onChange={(e) => {
              textAendern(e.target.value);
              setAusAkte(null);
            }}
            placeholder="Fügen Sie hier den Text eines Schreibens ein – z. B. eine gerichtliche Verfügung, ein Urteil, eine Kündigung oder eine Mandanten-E-Mail."
            className="text-[14px]"
          />
        </Field>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={<Sparkles className="size-4" />} onClick={() => void analysieren()} loading={laeuft} disabled={text.trim().length < 20}>
            Analysieren
          </Button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => (ladeDatei(e.target.files?.[0]), (e.target.value = ""))} />
          <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
            Textdatei laden
          </Button>
          <span className="num ml-auto text-[13px] text-fg-4">{fmtNum(text.length)} Zeichen</span>
        </div>
        <p className="mt-3 text-[13px] leading-[18px] text-fg-4">
          {live ? "Claude liest das Schreiben über Ihren gesicherten Zugang; Akte und Fristen werden anschließend nach festen Regeln geprüft und vom Fristenrechner berechnet." : "Die Demo-KI analysiert regelbasiert und vollständig lokal – der Text verlässt Ihren Browser nicht."}
        </p>
      </Card>

      {/* ───────── Ergebnis ───────── */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          {laeuft || (aktiv >= 0 && aktiv < SCHRITTE.length && !analyse) ? (
            <motion.div key="lauf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard}>
              <Card className="!p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="size-4 text-fg-4" aria-hidden />
                  <span className="title-md">Die KI liest das Schreiben …</span>
                </div>
                <KiSchritte schritte={SCHRITTE} aktiv={aktiv} kompakt />
                <div className="mt-5 grid gap-2" aria-hidden>
                  {[88, 72, 94, 60].map((w, i) => (
                    <div key={i} className="shimmer h-3" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : analyse ? (
            <motion.div key="ergebnis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="grid gap-3">
              <Ergebnis
                key={analyse.zusammenfassung + analyse.typ}
                analyse={analyse}
                onVerwerfen={verwerfen}
                erkannteAkte={erkannteAkte}
                sicherZugeordnet={sicherZugeordnet}
                offene={offene}
                zielAkte={zielAkte}
                setZielAkte={setZielAkte}
                kannUebernehmen={kannUebernehmen}
                uebernommen={uebernommen}
                onUebernehmen={uebernehmen}
                onNeu={neuStarten}
                onAkte={(id) => nav(`/akten/${id}`)}
                ausschluss={ausschluss}
                setAusschluss={setAusschluss}
                onAusschlussUebernommen={loslassen}
              />
            </motion.div>
          ) : (
            <motion.div key="leer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard}>
              <Card className="!p-5">
                {fehler && (
                  <div role="alert" className="banner banner-seal mb-4">
                    <AlertTriangle aria-hidden />
                    <span className="text-seal-text">{fehler} Bitte prüfen Sie den Text und versuchen Sie es erneut.</span>
                  </div>
                )}
                <div>
                  <h2 className="title-md">So arbeitet die Dokument-Analyse</h2>
                  <p className="mt-0.5 text-[13px] text-fg-3">Vier Schritte – nachvollziehbar und geprüft.</p>
                </div>
                <ol className="mt-4 grid">
                  {SCHRITTE.map((s, i) => (
                    <li key={s.label} className="flex items-start gap-3 border-t border-[var(--line)] py-3 last:pb-0">
                      <span className="mt-0.5 shrink-0 text-fg-4 [&>svg]:size-4" aria-hidden>
                        {s.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium leading-5">
                          {i + 1}. {s.label}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-[18px] text-fg-3">
                          {
                            [
                              "Die KI liest das Schreiben vollständig – auch lange gerichtliche Verfügungen.",
                              "Urteil, Versäumnisurteil, Verfügung, Ladung, Kündigung oder Mandanten-E-Mail.",
                              "Über Gerichtsaktenzeichen, Ihr Aktenzeichen oder die Namen der Parteien.",
                              "Die KI erkennt nur die Fristart. Das Fristende berechnet der Fristenrechner – mit den Feiertagen am Gerichtsort.",
                            ][i]
                          }
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Ergebnis({
  analyse, erkannteAkte, sicherZugeordnet, offene, zielAkte, setZielAkte, kannUebernehmen, uebernommen, onUebernehmen, onNeu, onAkte, onVerwerfen, ausschluss, setAusschluss, onAusschlussUebernommen,
}: {
  analyse: DokAnalyse;
  ausschluss: { faellig: string; anspruch: string };
  setAusschluss: (a: { faellig: string; anspruch: string }) => void;
  onAusschlussUebernommen: () => void;
  onVerwerfen: () => void;
  erkannteAkte?: { id: string; aktenzeichen: string; titel: string };
  sicherZugeordnet: boolean;
  offene: { id: string; aktenzeichen: string; titel: string }[];
  zielAkte: string;
  setZielAkte: (id: string) => void;
  kannUebernehmen: boolean;
  uebernommen: string | null;
  onUebernehmen: () => void;
  onNeu: () => void;
  onAkte: (id: string) => void;
}) {
  const sicherheit = Math.round(analyse.akteSicherheit * 100);

  return (
    <>
      {/* Ein Ergebnis = eine Karte; Abschnitte trennt eine 1-px-Linie (keine Karten in Karten, DESIGN-SYSTEM.md 12.3) */}
      <Card padded={false} className="divide-y divide-[var(--line)]">
        {/* Typ & Zusammenfassung */}
        <section className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {analyse.quelle === "demo" ? <AiChip>Demo-KI</AiChip> : <AiChip>Claude</AiChip>}
            <span className="num text-[13px] text-fg-4">{fmtNum(analyse.dauerMs / 1000, 1)} s</span>
            <Button variant="ghost" size="sm" className="ml-auto" icon={<RotateCcw className="size-4" />} onClick={onNeu}>
              Neues Dokument
            </Button>
          </div>
          <div className="eyebrow mt-3">Erkannter Typ</div>
          <h2 className="title-lg mt-0.5">{analyse.typ}</h2>
          <p className="mt-2 text-[14px] leading-6 text-fg-2">{analyse.zusammenfassung}</p>
          {analyse.eeb && (
            <div className="banner banner-amber mt-3">
              <Inbox aria-hidden />
              <span>
                <span className="font-medium text-amber-text">Elektronisches Empfangsbekenntnis (eEB) erforderlich.</span> Zugestellt ist an dem Tag, an dem Sie das Schriftstück empfangsbereit zur Kenntnis genommen haben – dieses Datum tragen Sie im eEB ein. Apex rechnet vorsorglich ab dem Eingangstag. Das eEB erst abgeben, wenn die Fristen notiert und kontrolliert sind.
              </span>
            </div>
          )}
        </section>

        {/* Akte */}
        <section className="p-5">
          {erkannteAkte && sicherZugeordnet ? (
            <div className="flex items-center gap-3">
              <ProgressRing value={analyse.akteSicherheit} size={44} stroke={4}>
                <span className="num text-[12px] font-semibold">{sicherheit}</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-fg-3">Akte zugeordnet · {sicherheit} % sicher</div>
                <button type="button" onClick={() => onAkte(erkannteAkte.id)} className="block max-w-full truncate text-left text-[14px] font-medium hover:underline">
                  <span className="mono mr-1.5 text-fg-3">{erkannteAkte.aktenzeichen}</span>
                  {erkannteAkte.titel}
                </button>
                {analyse.akteGrund && <div className="text-[13px] text-fg-4">Erkannt über: {analyse.akteGrund}</div>}
              </div>
              <FolderOpen className="size-4 shrink-0 text-fg-4" aria-hidden />
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-[14px]">
                {erkannteAkte ? (
                  <ProgressRing value={analyse.akteSicherheit} size={40} stroke={4}>
                    <span className="num text-[12px] font-semibold">{sicherheit}</span>
                  </ProgressRing>
                ) : (
                  <FolderSearch className="size-4 shrink-0 text-[var(--amber)]" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block font-medium">{erkannteAkte ? "Akte nicht eindeutig – bitte bestätigen" : "Keine Akte sicher erkannt"}</span>
                  <span className="block text-[13px] text-fg-3">
                    {erkannteAkte
                      ? `Vorschlag ${erkannteAkte.aktenzeichen} (${sicherheit} % sicher${analyse.akteGrund ? `, über ${analyse.akteGrund}` : ""}). Erst nach Ihrer Auswahl wird zugeordnet.`
                      : "Bitte die Ziel-Akte wählen – die KI ordnet nur bei eindeutigen Merkmalen selbst zu."}
                  </span>
                </span>
              </div>
              <Select id="dok-zielakte" aria-label="Ziel-Akte" value={zielAkte} onChange={(e) => setZielAkte(e.target.value)}>
                {offene.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.aktenzeichen} · {a.titel}
                    {a.id === erkannteAkte?.id ? " (Vorschlag der KI)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </section>

        {/* Vertragliche Ausschlussfrist: Fälligkeit erfragen, Ende berechnet der Fristenrechner */}
        {analyse.ausschlussfrist && (
          <AusschlussfristKarte klausel={analyse.ausschlussfrist} akteId={sicherZugeordnet && erkannteAkte ? erkannteAkte.id : zielAkte} onAkte={onAkte} wert={ausschluss} onWert={setAusschluss} onUebernommen={onAusschlussUebernommen} />
        )}

        {/* Fristen */}
        {analyse.fristen.map((f) => (
          <FristKarte key={f.regelKey + f.ende} f={f} />
        ))}

        {/* Termin */}
        {analyse.termin && (
          <section className="flex items-center gap-3 p-5">
            <CalendarClock className="size-4 shrink-0 text-fg-4" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-fg-3">Termin erkannt</div>
              <div className="text-[14px] font-medium">{analyse.termin.titel}</div>
              <div className="text-[13px] text-fg-2">
                {fmtDateWd(analyse.termin.datum)}
                {analyse.termin.uhrzeit ? `, ${analyse.termin.uhrzeit} Uhr` : ""}
                {analyse.termin.ort ? ` · ${analyse.termin.ort}` : ""}
              </div>
            </div>
            <Chip tone="ink">{relDays(analyse.termin.datum)}</Chip>
          </section>
        )}

        {/* Aktionen */}
        <section className="p-5">
          <h3 className="title-md mb-2">Empfohlene nächste Schritte</h3>
          <ul className="grid gap-1.5">
            {analyse.aktionen.map((a) => (
              <li key={a} className="flex items-start gap-2 text-[14px] leading-5 text-fg-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-fg-4" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </section>

        {/* Übernehmen */}
        {kannUebernehmen && (
          <section className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[var(--surface-2)] px-5 py-4">
            {uebernommen ? (
              <>
                <span className="flex items-center gap-2 text-[14px] font-medium text-fg">
                  <BadgeCheck className="size-4 text-[var(--green)]" aria-hidden /> In die Akte übernommen – Kontrolle im Vier-Augen-Prinzip ausstehend
                </span>
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onAkte(uebernommen)}>
                  Akte öffnen
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" icon={<CalendarClock className="size-4" />} onClick={onUebernehmen}>
                  {analyse.fristen.length ? "Fristen in Akte übernehmen" : "Termin in Akte übernehmen"}
                </Button>
                <span className="text-[13px] text-fg-3">
                  {sicherZugeordnet && erkannteAkte ? `in ${erkannteAkte.aktenzeichen}` : `in ${offene.find((a) => a.id === zielAkte)?.aktenzeichen ?? "die gewählte Akte"}`} · Quelle „KI“, Rechenweg wird gespeichert
                </span>
              </>
            )}
          </section>
        )}
      </Card>

      {/* Verwerfen – ändert nichts */}
      {!uebernommen && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={onVerwerfen}>
            Vorschlag verwerfen
          </Button>
          <span className="min-w-0 flex-1 basis-[220px] text-[13px] leading-[18px] text-fg-4">Es wird nichts gespeichert – Akte, Fristen und Dokumente bleiben unverändert.</span>
        </div>
      )}
    </>
  );
}

/**
 * Ausschlussfrist aus einem Vertrag: Die Fälligkeit wird erfragt (nie erfunden), das Fristende berechnet der
 * Fristenrechner. Übernahme als Frist (Vier-Augen-Kontrolle offen) oder als Wiedervorlage.
 */
function AusschlussfristKarte({
  klausel, akteId, onAkte, wert, onWert, onUebernommen,
}: {
  klausel: Ausschlussklausel;
  akteId: string;
  onAkte: (id: string) => void;
  /** Fälligkeit und Anspruch – im gemerkten Ergebnis gehalten (I5-T19-02) */
  wert: { faellig: string; anspruch: string };
  onWert: (w: { faellig: string; anspruch: string }) => void;
  onUebernommen: () => void;
}) {
  const { tenant, user } = useKanzlei();
  const akten = useData((s) => s.data.akten);
  const akte: Akte | undefined = akten.find((a) => a.id === akteId);
  const { faellig, anspruch } = wert;
  const setFaellig = (v: string) => onWert({ ...wert, faellig: v });
  const setAnspruch = (v: string) => onWert({ ...wert, anspruch: v });
  const [angelegt, setAngelegt] = useState<{ art: "frist" | "wiedervorlage"; ids: string[] } | null>(null);
  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(faellig);
  const vorschlag = useMemo(
    () => (gueltig ? ausschlussfristVorschlag(klausel, faellig, tenant.bundesland, { kanzleiLand: tenant.bundesland, anspruch: anspruch.trim() || undefined }) : null),
    [gueltig, klausel, faellig, tenant.bundesland, anspruch],
  );

  const anlegen = (art: "frist" | "wiedervorlage") => {
    if (!vorschlag || !akte) return;
    const verantwortlich = akte.bearbeiterId || user.id;
    const notiz = `Von der KI im ${klausel.quelle} erkannt (${klausel.zitat.slice(0, 120)}${klausel.zitat.length > 120 ? "…" : ""}); Fälligkeit ${fmtDate(faellig)} von ${user.name} eingegeben, berechnet vom Fristenrechner.`;
    let ids: string[];
    if (art === "frist") {
      // Frist ohne Kontrollvermerk → erscheint in der Vier-Augen-Kontrolle
      const r = legeFristAn({
        akteId: akte.id, titel: vorschlag.titel, typ: "frist", datum: vorschlag.ende, vorfrist: vorschlag.vorfrist, regelKey: vorschlag.regelKey, grundlage: vorschlag.grundlage,
        ereignisDatum: faellig, rechenweg: vorschlag.rechenweg, quelle: "ki", verantwortlichId: verantwortlich, vorfristVerantwortlichId: akte.sachbearbeiterId ?? verantwortlich, notiz,
      });
      ids = [r.frist.id, ...(r.vorfrist ? [r.vorfrist.id] : [])];
    } else {
      const r = legeFristAn({
        akteId: akte.id, titel: `Wiedervorlage: Ausschlussfrist läuft am ${fmtDate(vorschlag.ende)} ab – Ansprüche geltend machen`, typ: "wiedervorlage", datum: vorschlag.vorfrist,
        grundlage: vorschlag.grundlage, ereignisDatum: faellig, rechenweg: vorschlag.rechenweg, quelle: "ki", verantwortlichId: verantwortlich, notiz,
      });
      ids = [r.frist.id];
    }
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Ausschlussfrist aus ${klausel.quelle} als ${art === "frist" ? "Frist" : "Wiedervorlage"} übernommen: ${fmtDate(art === "frist" ? vorschlag.ende : vorschlag.vorfrist)} (Fälligkeit ${fmtDate(faellig)})` });
    setAngelegt({ art, ids });
    onUebernommen();
    toast(art === "frist" ? "Ausschlussfrist eingetragen" : "Wiedervorlage eingetragen", {
      text: `${akte.aktenzeichen} · ${fmtDateWd(art === "frist" ? vorschlag.ende : vorschlag.vorfrist)}${art === "frist" ? " · Vier-Augen-Kontrolle offen" : ""}`,
      ton: "erfolg",
      aktion: {
        label: "Rückgängig",
        onClick: () => {
          ids.forEach((id) => useData.getState().remove("fristen", id));
          useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Übernahme der Ausschlussfrist in ${akte.aktenzeichen} rückgängig gemacht` });
          setAngelegt(null);
        },
      },
    });
  };

  return (
    // Kritisch (Anspruchsverlust): 2-px-Balken in Siegelrot links statt farbigem Rahmen (DESIGN-SYSTEM.md 8)
    <section className="shadow-[inset_2px_0_0_var(--seal)]">
      <div className="flex items-start gap-3 p-5">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--seal)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-5">{ausschlussfristTitel(klausel)}</h3>
          <p className="mt-1 text-[14px] leading-5 text-fg-2">
            Vertragliche Ausschlussfrist – Anspruchsverlust bei Versäumung. Das Fristende hängt von der Fälligkeit des jeweiligen Anspruchs ab: Bitte die Fälligkeit eingeben – Apex erfindet kein Datum.
          </p>
          <blockquote className="mt-2 border-l-2 border-[var(--line-strong)] pl-3 text-[14px] leading-5 text-fg-3">„{klausel.zitat.replace(/[„“]/g, "")}“</blockquote>
          {klausel.zweiteStufe && (
            <div className="banner banner-amber mt-3">
              <AlertTriangle aria-hidden />
              <span>
                Zweite Stufe: gerichtliche Geltendmachung binnen {dauerText(klausel.zweiteStufe.dauer, klausel.zweiteStufe.einheit)} nach {klausel.zweiteStufe.beginn} – bei Eingang der Ablehnung gesondert notieren.
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
        <Field label="Fälligkeit des Anspruchs" htmlFor="af-faellig" hint="Pflichtangabe – z. B. Fälligkeit des Septemberlohns">
          <Input id="af-faellig" type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} required aria-required="true" />
        </Field>
        <Field label="Anspruch (optional)" htmlFor="af-anspruch">
          <Input id="af-anspruch" value={anspruch} onChange={(e) => setAnspruch(e.target.value)} placeholder="z. B. Überstundenvergütung 09/2026" />
        </Field>
      </div>
      {vorschlag ? (
        <div className="border-t border-[var(--line)]">
          <FristKarte f={vorschlag} eingebettet />
          <div className="border-t border-[var(--line)] px-5 py-4">
            {angelegt ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2 text-[14px] font-medium text-fg">
                  <BadgeCheck className="size-4 text-[var(--green)]" aria-hidden />
                  {angelegt.art === "frist" ? "Als Frist übernommen – Vier-Augen-Kontrolle ausstehend" : "Als Wiedervorlage übernommen"}
                </span>
                {akte && (
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onAkte(akte.id)}>
                    Akte öffnen
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" icon={<CalendarClock className="size-4" />} onClick={() => anlegen("frist")} disabled={!akte}>
                  Als Frist übernehmen
                </Button>
                <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={() => anlegen("wiedervorlage")} disabled={!akte}>
                  Als Wiedervorlage
                </Button>
                <span className="text-[13px] text-fg-3">
                  {akte ? `in ${akte.aktenzeichen} · Frist mit Vier-Augen-Kontrolle, Wiedervorlage am ${fmtDate(vorschlag.vorfrist)}` : "Bitte zuerst eine Akte wählen"}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="border-t border-[var(--line)] px-5 py-3 text-[13px] text-fg-3">Noch keine Berechnung – ohne Fälligkeit gibt es kein Fristende.</p>
      )}
    </section>
  );
}

/** Erkannte Frist als Abschnitt der Ergebniskarte: Titel, Status-Chip, Fristende rechts; Rechenweg aufklappbar. Kritisch = roter Balken. */
function FristKarte({ f, eingebettet }: { f: FristVorschlag; eingebettet?: boolean }) {
  const [offen, setOffen] = useState(false);
  const d = fristDringlichkeit(f.ende, today());
  const art = fristArtZu(f);
  const notfrist = f.typ === "notfrist";
  const kritisch = !!art?.kritisch;
  return (
    <section className={cn(kritisch && !eingebettet && "shadow-[inset_2px_0_0_var(--seal)]")}>
      <div className="flex flex-wrap items-start gap-3 p-5">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-fg-4" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-semibold">{f.titel}</span>
            {notfrist ? (
              <Chip tone="seal" title={art?.kurz}>Notfrist</Chip>
            ) : kritisch ? (
              <Chip tone="seal" title={art?.kurz}>Frist · nicht verlängerbar</Chip>
            ) : (
              <Chip tone="amber" title={art?.kurz}>Frist</Chip>
            )}
          </div>
          <div className="mt-0.5 text-[13px] text-fg-4">{f.grundlage}</div>
        </div>
        <div className="basis-full pl-7 sm:basis-auto sm:pl-0 sm:text-right">
          <div className="text-[13px] text-fg-3">Fristende</div>
          <div className={cn("num text-[15px] font-semibold", d === "kritisch" || d === "ueberfaellig" ? "text-seal-text" : "text-fg")}>{fmtDateWd(f.ende)}</div>
          <div className="text-[13px] text-fg-3">
            {relDays(f.ende)} · Vorfrist {fmtDateWd(f.vorfrist)}
          </div>
        </div>
      </div>
      {f.warnungen.length > 0 && (
        <div className="banner banner-amber mx-5 mb-4">
          <AlertTriangle aria-hidden />
          <span>{f.warnungen.join(" ")}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-2 border-t border-[var(--line)] px-5 py-2.5 text-left text-[13px] transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]"
      >
        <Calculator className="size-4 shrink-0 text-fg-4" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-fg">Berechnet vom Fristenrechner</span>
          <span className="text-fg-3"> – nicht von der KI. Rechenweg</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-4 transition-transform duration-150", offen && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {offen && (
          <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={BEWEGUNG.standard} className="overflow-hidden">
            <div className="grid gap-0 px-5 pb-4 pt-1">
              {f.rechenweg.map((r, i) => (
                <li key={i} className="relative flex gap-3 pb-2.5 last:pb-0">
                  <span className="relative flex flex-col items-center">
                    <span className="num z-[1] grid size-5 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface)] text-[12px] font-medium text-fg-3">{i + 1}</span>
                    {i < f.rechenweg.length - 1 && <span className="absolute top-5 h-full w-px bg-[var(--line)]" aria-hidden />}
                  </span>
                  <span className="pt-px text-[13px] leading-[18px] text-fg-2">{r}</span>
                </li>
              ))}
            </div>
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, BadgeCheck, Calculator, CalendarClock, ChevronDown, CircleCheck, FileScan, FileSearch, FileText, FileUp, FolderOpen, FolderSearch, Gavel, Inbox,
  ListChecks, Mail, RotateCcw, ScanText, Sparkles, Stamp, Tags,
} from "lucide-react";
import { analysiereDokument, beispielDokumente, type DokAnalyse, type FristVorschlag } from "@/ai/dokumentAnalyse";
import { useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDateWd, fmtNum, nowLocal, relDays, today, uid } from "@/core/dates";
import { fristDringlichkeit } from "@/core/fristen";
import type { Frist } from "@/core/types";
import { AiChip, Button, Card, Chip, Field, Input, ProgressRing, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KiSchritte, usePipeline, type KiSchritt } from "./KiSchritte";
import { standardAkte } from "./FallanalyseTab";

const SCHRITTE: KiSchritt[] = [
  { label: "Lesen", detail: "Text & Struktur", icon: <ScanText /> },
  { label: "Typ erkennen", detail: "Schriftstück & Ereignis", icon: <Tags /> },
  { label: "Akte zuordnen", detail: "Az., Parteien, Gericht", icon: <FolderSearch /> },
  { label: "Fristen berechnen", detail: "Fristenrechner § 222 ZPO", icon: <Calculator /> },
];

const SICHER_AB = 0.8;

const BEISPIEL_ICONS = [<Gavel key="g" className="size-4" />, <Stamp key="s" className="size-4" />, <Mail key="m" className="size-4" />];

/** Dokument-Analyse: Schreiben einfügen → Typ, Akte, Fristen (berechnet vom Fristenrechner), Termin und nächste Schritte. */
export function DokumentAnalyseTab({ akteParam }: { akteParam?: string }) {
  const nav = useNavigate();
  const { tenant, user } = useKanzlei();
  const data = useData((s) => s.data);
  const quelle = useAiStatus((s) => s.quelle);
  const live = quelle !== "demo";
  const beispiele = useMemo(() => beispielDokumente(), []);
  const [text, setText] = useState("");
  const [betreff, setBetreff] = useState("");
  const [von, setVon] = useState("");
  const [beispielAktiv, setBeispielAktiv] = useState<number | null>(null);
  const [analyse, setAnalyse] = useState<DokAnalyse | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [zielAkte, setZielAkte] = useState("");
  const [uebernommen, setUebernommen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { aktiv, lauf, zuruecksetzen } = usePipeline(SCHRITTE.length, 480);

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
      setVon("Upload");
      setBeispielAktiv(null);
      toast("Datei geladen", { text: f.name, ton: "info" });
    };
    r.onerror = () => toast("Datei konnte nicht gelesen werden", { text: "Bitte als UTF-8-Textdatei (.txt) speichern und erneut versuchen.", ton: "fehler" });
    r.readAsText(f, "utf-8");
  };

  const analysieren = async () => {
    if (text.trim().length < 20) return;
    setFehler(null);
    setAnalyse(null);
    setUebernommen(null);
    setLaeuft(true);
    try {
      const res = await lauf(() => analysiereDokument({ text, betreff: betreff || undefined, von: von || undefined, eingang: today() }, data, tenant.bundesland));
      setAnalyse(res);
      setZielAkte(res.akteId ?? (akteParam && offene.some((a) => a.id === akteParam) ? akteParam : undefined) ?? standardAkte(data.akten)?.id ?? offene[0]?.id ?? "");
      useData.getState().log({ akteur: "ki", userId: user.id, akteId: res.akteId, text: `Dokument analysiert: ${res.typ}${res.fristen.length ? ` – ${res.fristen.length} Frist(en) erkannt` : ""}`, minutenGespart: 4 });
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

  const neuStarten = () => {
    setAnalyse(null);
    setFehler(null);
    setUebernommen(null);
    zuruecksetzen();
  };

  const kannUebernehmen = !!analyse && (analyse.fristen.length > 0 || !!analyse.termin);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      {/* ───────── Eingabe ───────── */}
      <Card className="!p-4 sm:!p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
            <FileScan className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="title-md">Schreiben einfügen</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Text einfügen, eine Textdatei laden oder ein Beispiel wählen. Eingangsdatum: heute.</p>
          </div>
        </div>

        <div className="eyebrow mb-2">Beispiele</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {beispiele.map((b, i) => (
            <button
              key={b.titel}
              type="button"
              onClick={() => waehleBeispiel(i)}
              aria-pressed={beispielAktiv === i}
              className={cn(
                "group relative flex min-w-0 items-center gap-2.5 rounded-[16px] p-2.5 text-left transition-[background-color,box-shadow,transform] duration-300 ease-[var(--spring)] active:scale-[0.98] sm:flex-col sm:items-start",
                beispielAktiv === i ? "bg-ink-soft ring-2 ring-[var(--ink)]" : "ring-1 ring-[var(--line)] hover:-translate-y-0.5 hover:bg-[var(--ink-softer)]",
              )}
            >
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", beispielAktiv === i ? "bg-[var(--ink)] text-[var(--on-ink)]" : "bg-ink-soft text-ink")}>{BEISPIEL_ICONS[i] ?? <FileText className="size-4" />}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold leading-tight sm:whitespace-normal">{b.titel}</span>
                <span className="block truncate text-[11.5px] text-fg-3">{b.von}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Betreff" htmlFor="dok-betreff">
            <Input id="dok-betreff" value={betreff} onChange={(e) => setBetreff(e.target.value)} placeholder="z. B. Zustellung eines Urteils" />
          </Field>
          <Field label="Absender" htmlFor="dok-von">
            <Input id="dok-von" value={von} onChange={(e) => setVon(e.target.value)} placeholder="z. B. Landgericht Berlin" />
          </Field>
        </div>
        <Field label="Text des Schreibens" htmlFor="dok-text" className="mt-3">
          <Textarea
            id="dok-text"
            rows={9}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setBeispielAktiv(null);
            }}
            placeholder="Fügen Sie hier den Text eines Schreibens ein – z. B. eine gerichtliche Verfügung, ein Urteil, eine Kündigung oder eine Mandanten-E-Mail."
            className="text-[13.5px]"
          />
        </Field>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="ai" icon={<Sparkles className="size-4" />} onClick={() => void analysieren()} loading={laeuft} disabled={text.trim().length < 20}>
            Analysieren
          </Button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => (ladeDatei(e.target.files?.[0]), (e.target.value = ""))} />
          <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
            Textdatei laden
          </Button>
          <span className="num ml-auto text-[11.5px] text-fg-4">{fmtNum(text.length)} Zeichen</span>
        </div>
        <p className="mt-3 text-[11.5px] leading-snug text-fg-4">
          {live ? "Claude liest das Schreiben über Ihren gesicherten Zugang; Akte und Fristen werden anschließend deterministisch geprüft und berechnet." : "Die Demo-KI analysiert regelbasiert und vollständig lokal – der Text verlässt Ihren Browser nicht."}
        </p>
      </Card>

      {/* ───────── Ergebnis ───────── */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          {laeuft || (aktiv >= 0 && aktiv < SCHRITTE.length && !analyse) ? (
            <motion.div key="lauf" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="ai-ring ai-glow rounded-[22px]">
                <Card className="!p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="title-md ai-text">Die KI liest das Schreiben …</span>
                  </div>
                  <KiSchritte schritte={SCHRITTE} aktiv={aktiv} kompakt />
                  <div className="mt-5 grid gap-2">
                    {[88, 72, 94, 60].map((w, i) => (
                      <div key={i} className="shimmer h-3 rounded-full" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </Card>
              </div>
            </motion.div>
          ) : analyse ? (
            <motion.div key="ergebnis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-3">
              <Ergebnis
                analyse={analyse}
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
              />
            </motion.div>
          ) : (
            <motion.div key="leer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="!p-5">
                {fehler && (
                  <div role="alert" className="mb-4 flex items-start gap-2 rounded-[14px] bg-seal-soft px-3.5 py-3 text-[13px] text-seal">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{fehler} Bitte prüfen Sie den Text und versuchen Sie es erneut.</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-[12px] bg-violet-soft text-violet">
                    <FileSearch className="size-[18px]" />
                  </span>
                  <div>
                    <h2 className="title-md">So arbeitet die Dokument-Analyse</h2>
                    <p className="text-[12.5px] text-fg-3">Vier Schritte – nachvollziehbar und geprüft.</p>
                  </div>
                </div>
                <ol className="mt-4 grid gap-2">
                  {SCHRITTE.map((s, i) => (
                    <motion.li key={s.label} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.05 }} className="flex items-start gap-3 rounded-[14px] p-2.5 ring-1 ring-[var(--line)]">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ink-softer)] text-fg-3 [&>svg]:size-4">{s.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold">
                          {i + 1}. {s.label}
                        </span>
                        <span className="block text-[12px] leading-snug text-fg-3">
                          {
                            [
                              "Die KI liest das Schreiben vollständig – auch lange gerichtliche Verfügungen.",
                              "Urteil, Versäumnisurteil, Verfügung, Ladung, Kündigung oder Mandanten-E-Mail.",
                              "Über Gerichtsaktenzeichen, Ihr Aktenzeichen oder die Namen der Parteien.",
                              "Die KI erkennt nur die Fristart. Das Fristende berechnet der Fristenrechner – mit Feiertagen Ihres Bundeslands.",
                            ][i]
                          }
                        </span>
                      </span>
                    </motion.li>
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
  analyse, erkannteAkte, sicherZugeordnet, offene, zielAkte, setZielAkte, kannUebernehmen, uebernommen, onUebernehmen, onNeu, onAkte,
}: {
  analyse: DokAnalyse;
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
  const stagger = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring" as const, stiffness: 420, damping: 34, delay: 0.04 + i * 0.06 } });

  return (
    <>
      {/* Typ & Zusammenfassung */}
      <motion.div {...stagger(0)}>
        <Card className="!p-5">
          <div className="flex flex-wrap items-center gap-2">
            {analyse.quelle === "demo" ? <Chip>Demo-KI</Chip> : <AiChip>Claude</AiChip>}
            <span className="num text-[12px] text-fg-3">{fmtNum(analyse.dauerMs / 1000, 1)} s</span>
            <Button variant="ghost" size="sm" className="ml-auto" icon={<RotateCcw className="size-4" />} onClick={onNeu}>
              Neues Dokument
            </Button>
          </div>
          <div className="eyebrow mt-3">Erkannter Typ</div>
          <h2 className="title-lg mt-1">{analyse.typ}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-fg-2">{analyse.zusammenfassung}</p>
          {analyse.eeb && (
            <div className="mt-3 flex items-start gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] text-amber">
              <Inbox className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">Elektronisches Empfangsbekenntnis (eEB) erforderlich.</span> Erst abgeben, wenn die Fristen notiert und kontrolliert sind – das Abgabedatum gilt als Zustellungsdatum.
              </span>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Akte */}
      <motion.div {...stagger(1)}>
        <Card className="!p-4">
          {erkannteAkte && sicherZugeordnet ? (
            <div className="flex items-center gap-3">
              <ProgressRing value={analyse.akteSicherheit} size={46} stroke={4} color="var(--green)">
                <span className="num text-[11px] font-semibold">{sicherheit}</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] text-fg-3">Akte zugeordnet · {sicherheit} % sicher</div>
                <button type="button" onClick={() => onAkte(erkannteAkte.id)} className="block max-w-full truncate text-left text-[14px] font-semibold hover:underline">
                  <span className="mono mr-1.5 text-fg-3">{erkannteAkte.aktenzeichen}</span>
                  {erkannteAkte.titel}
                </button>
                {analyse.akteGrund && <div className="truncate text-[12px] text-fg-3">Erkannt über: {analyse.akteGrund}</div>}
              </div>
              <FolderOpen className="size-5 shrink-0 text-green" />
            </div>
          ) : (
            <div className="grid gap-2.5">
              <div className="flex items-center gap-3 text-[13px]">
                {erkannteAkte ? (
                  <ProgressRing value={analyse.akteSicherheit} size={40} stroke={4} color="var(--amber)">
                    <span className="num text-[10.5px] font-semibold">{sicherheit}</span>
                  </ProgressRing>
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-amber-soft text-amber">
                    <FolderSearch className="size-[18px]" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block font-semibold">{erkannteAkte ? "Akte nicht eindeutig – bitte bestätigen" : "Keine Akte sicher erkannt"}</span>
                  <span className="block text-[12px] text-fg-3">
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
        </Card>
      </motion.div>

      {/* Fristen */}
      {analyse.fristen.length > 0 && (
        <motion.div {...stagger(2)} className="grid gap-2.5">
          {analyse.fristen.map((f) => (
            <FristKarte key={f.regelKey + f.ende} f={f} />
          ))}
        </motion.div>
      )}

      {/* Termin */}
      {analyse.termin && (
        <motion.div {...stagger(3)}>
          <Card className="flex items-center gap-3 !p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
              <CalendarClock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] text-fg-3">Termin erkannt</div>
              <div className="text-[14px] font-semibold">{analyse.termin.titel}</div>
              <div className="text-[12.5px] text-fg-2">
                {fmtDateWd(analyse.termin.datum)}
                {analyse.termin.uhrzeit ? `, ${analyse.termin.uhrzeit} Uhr` : ""}
                {analyse.termin.ort ? ` · ${analyse.termin.ort}` : ""}
              </div>
            </div>
            <Chip tone="ink">{relDays(analyse.termin.datum)}</Chip>
          </Card>
        </motion.div>
      )}

      {/* Aktionen */}
      <motion.div {...stagger(4)}>
        <Card className="!p-4">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <ListChecks className="size-3.5" /> Empfohlene nächste Schritte
          </div>
          <ul className="grid gap-1.5">
            {analyse.aktionen.map((a) => (
              <li key={a} className="flex items-start gap-2 text-[13px] leading-snug text-fg-2">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-violet" />
                {a}
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

      {/* Übernehmen */}
      {kannUebernehmen && (
        <motion.div {...stagger(5)} className="flex flex-wrap items-center gap-2 rounded-[20px] bg-[var(--ink-softer)] p-3">
          {uebernommen ? (
            <>
              <span className="flex items-center gap-2 text-[13px] font-medium text-green">
                <BadgeCheck className="size-5" /> In die Akte übernommen – Kontrolle im Vier-Augen-Prinzip ausstehend
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
              <span className="text-[12px] text-fg-3">
                {sicherZugeordnet && erkannteAkte ? `in ${erkannteAkte.aktenzeichen}` : `in ${offene.find((a) => a.id === zielAkte)?.aktenzeichen ?? "die gewählte Akte"}`} · Quelle „KI“, Rechenweg wird gespeichert
              </span>
            </>
          )}
        </motion.div>
      )}
    </>
  );
}

function FristKarte({ f }: { f: FristVorschlag }) {
  const [offen, setOffen] = useState(false);
  const d = fristDringlichkeit(f.ende, today());
  const notfrist = f.typ === "notfrist";
  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-[12px]", notfrist ? "bg-seal-soft text-seal" : "bg-amber-soft text-amber")}>
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[14px] font-semibold">{f.titel}</span>
            {notfrist ? <Chip tone="seal">Notfrist</Chip> : <Chip tone="amber">Frist</Chip>}
          </div>
          <div className="mt-0.5 text-[12px] text-fg-3">{f.grundlage}</div>
        </div>
        <div className="basis-full pl-[52px] sm:basis-auto sm:pl-0 sm:text-right">
          <div className="text-[11px] text-fg-3">Fristende</div>
          <div className={cn("num text-[16px] font-semibold tracking-[-0.01em]", d === "kritisch" || d === "ueberfaellig" ? "text-seal" : "text-fg")}>{fmtDateWd(f.ende)}</div>
          <div className="text-[11.5px] text-fg-3">
            {relDays(f.ende)} · Vorfrist {fmtDateWd(f.vorfrist)}
          </div>
        </div>
      </div>
      {f.warnungen.length > 0 && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12px] text-amber">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{f.warnungen.join(" ")}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-2 border-t border-[var(--line)] px-4 py-2.5 text-left text-[12.5px] transition-colors hover:bg-[var(--ink-softer)]"
      >
        <Calculator className="size-4 shrink-0 text-green" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-fg">Berechnet vom Fristenrechner nach § 222 ZPO</span>
          <span className="text-fg-3"> – nicht von der KI. Rechenweg</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform duration-300", offen && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {offen && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="grid gap-0 px-4 pb-4 pt-1">
              {f.rechenweg.map((r, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }} className="relative flex gap-3 pb-2.5 last:pb-0">
                  <span className="relative flex flex-col items-center">
                    <span className={cn("num z-[1] grid size-5 place-items-center rounded-full text-[10.5px] font-semibold", i === f.rechenweg.length - 1 ? "bg-green-soft text-green" : "bg-[var(--ink-softer)] text-fg-3")}>{i + 1}</span>
                    {i < f.rechenweg.length - 1 && <span className="absolute top-5 h-full w-px bg-[var(--line-strong)]" />}
                  </span>
                  <span className="pt-px text-[12.5px] leading-snug text-fg-2">{r}</span>
                </motion.li>
              ))}
            </div>
          </motion.ol>
        )}
      </AnimatePresence>
    </Card>
  );
}

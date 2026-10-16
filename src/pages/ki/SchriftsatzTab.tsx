import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, BookCheck, Check, CircleAlert, Copy, FastForward, FileSignature, FolderOpen, MessageSquareReply, MessageSquareText, PenLine, Receipt, RotateCcw, Save, Scale, Send,
  ShieldCheck, Sparkles, Square, Wand2,
} from "lucide-react";
import { DemoModus, llmText } from "@/ai/llm";
import { useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { nowLocal, uid } from "@/core/dates";
import type { Dokument } from "@/core/types";
import { AiChip, Button, Card, Chip, Field, Segmented, Select, Textarea, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { kopiereText } from "@/pages/falldb/zwischenablage";
import { pruefeZitate } from "@/pages/falldb/recherche";
import { KiSchritte, type KiSchritt } from "./KiSchritte";
import { artInfo, artenFuer, dokumentName, entwurfOffline, entwurfPrompt, fruehereFassung, mandantRolle, type SchriftsatzArt, type Ton } from "./schriftsatz";
import { standardAkte } from "./FallanalyseTab";

const ICONS: Record<SchriftsatzArt, ReactNode> = {
  sachstand: <MessageSquareText className="size-4" />,
  deckung: <ShieldCheck className="size-4" />,
  aufforderung: <Send className="size-4" />,
  klageerwiderung: <Scale className="size-4" />,
  replik: <MessageSquareReply className="size-4" />,
  kosten: <Receipt className="size-4" />,
};

const SCHRITTE: KiSchritt[] = [
  { label: "Akte lesen", detail: "Sachverhalt, Fristen, Parteien", icon: <FolderOpen /> },
  { label: "Quellen prüfen", detail: "nur Fall-Datenbank", icon: <BookCheck /> },
  { label: "Formulieren", detail: "Entwurf mit Platzhaltern", icon: <PenLine /> },
];

type Status = "leer" | "vorbereitung" | "schreibt" | "fertig" | "fehler";

interface Erzeugt {
  akteId: string;
  art: SchriftsatzArt;
  quelle: "live" | "vorlage";
}

/** Schriftsatz-Assistent: Akte + Dokumentart + Ton → Entwurf auf Papier, mit Platzhaltern und Zitatprüfung. */
export function SchriftsatzTab({ akteParam, onAkte }: { akteParam?: string; onAkte: (id: string) => void }) {
  const nav = useNavigate();
  const { tenant, user } = useKanzlei();
  const data = useData((s) => s.data);
  const quelle = useAiStatus((s) => s.quelle);
  const live = quelle !== "demo";

  const offene = useMemo(() => data.akten.filter((a) => a.status === "offen").sort((a, b) => a.aktenzeichen.localeCompare(b.aktenzeichen, "de", { numeric: true })), [data.akten]);
  const akteId = (akteParam && data.akten.some((a) => a.id === akteParam) ? akteParam : standardAkte(data.akten)?.id) ?? "";
  const akte = data.akten.find((a) => a.id === akteId);

  const [artWahl, setArt] = useState<SchriftsatzArt>("sachstand");
  // Klagt die Mandantschaft, steht statt der Klageerwiderung die Replik zur Wahl – die Auswahl folgt der Akte.
  const arten = useMemo(() => artenFuer(akte, data), [akte, data]);
  const rolle = useMemo(() => (akte ? mandantRolle(akte, data) : undefined), [akte, data]);
  const art: SchriftsatzArt = arten.some((a) => a.key === artWahl) ? artWahl : artWahl === "klageerwiderung" ? "replik" : artWahl === "replik" ? "klageerwiderung" : "sachstand";
  const [ton, setTon] = useState<Ton>("sachlich");
  const [hinweise, setHinweise] = useState("");
  const [status, setStatus] = useState<Status>("leer");
  const [text, setText] = useState("");
  const [sichtbar, setSichtbar] = useState(0);
  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erzeugt, setErzeugt] = useState<Erzeugt | null>(null);
  const [gespeichert, setGespeichert] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const tipp = useRef<number | null>(null);
  const laufNr = useRef(0); // verhindert, dass ein abgebrochener Lauf später noch schreibt
  const papierRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (tipp.current) window.clearInterval(tipp.current);
    },
    [],
  );

  // „Denkphase“: Schritte laufen, bis der Text beginnt
  useEffect(() => {
    if (status !== "vorbereitung") return;
    setSchritt(0);
    const t = window.setInterval(() => setSchritt((s) => Math.min(s + 1, SCHRITTE.length - 1)), 380);
    return () => window.clearInterval(t);
  }, [status]);

  const angezeigt = erzeugt?.quelle === "vorlage" ? text.slice(0, sichtbar) : text;
  const schreibt = status === "schreibt" || status === "vorbereitung";

  // Beim Schreiben mitscrollen (nur innerhalb der Vorschau, solange man unten ist)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || status !== "schreibt") return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [angezeigt, status]);

  const stoppeTipp = () => {
    if (tipp.current) window.clearInterval(tipp.current);
    tipp.current = null;
  };

  const schreibmaschine = (voll: string) => {
    stoppeTipp();
    setText(voll);
    setSichtbar(0);
    setStatus("schreibt");
    const schritt = Math.max(3, Math.ceil(voll.length / 320));
    let n = 0;
    tipp.current = window.setInterval(() => {
      n = Math.min(voll.length, n + schritt);
      setSichtbar(n);
      if (n >= voll.length) {
        stoppeTipp();
        setStatus("fertig");
      }
    }, 20);
  };

  const sofortAnzeigen = () => {
    stoppeTipp();
    setSichtbar(text.length);
    setStatus("fertig");
  };

  const erstellen = async (nurVorlage = false) => {
    if (!akte) {
      toast("Bitte eine Akte wählen", { ton: "warnung" });
      return;
    }
    abort.current?.abort();
    stoppeTipp();
    const nr = ++laufNr.current;
    setFehler(null);
    setGespeichert(null);
    setText("");
    setSichtbar(0);
    setStatus("vorbereitung");
    // Auf schmalen Bildschirmen liegt die Vorschau unter dem Formular – dorthin scrollen.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      const ziel = document.getElementById("schriftsatz-vorschau");
      const scroller = document.getElementById("haupt-scroll");
      if (ziel && scroller) scroller.scrollTo({ top: ziel.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 88, behavior: "smooth" });
      else ziel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const kontext = { akte, data, tenant, user };

    const offline = async () => {
      setErzeugt({ akteId: akte.id, art, quelle: "vorlage" });
      await new Promise((r) => setTimeout(r, 1150));
      if (nr !== laufNr.current) return;
      schreibmaschine(entwurfOffline(art, ton, hinweise, kontext));
    };

    if (!live || nurVorlage) return offline();

    const ctl = new AbortController();
    abort.current = ctl;
    setErzeugt({ akteId: akte.id, art, quelle: "live" });
    let teil = "";
    try {
      const { system, user: prompt } = entwurfPrompt(art, ton, hinweise, kontext);
      const res = await llmText({
        system,
        messages: [{ role: "user", content: prompt }],
        signal: ctl.signal,
        effort: "medium",
        maxTokens: 8000,
        onText: (t) => {
          if (nr !== laufNr.current) return;
          teil = t;
          setText(t);
          setStatus("schreibt");
        },
      });
      if (nr !== laufNr.current) return;
      setText((res || teil).trim());
      setStatus("fertig");
    } catch (e) {
      if (nr !== laufNr.current) return;
      if (e instanceof DemoModus) return offline();
      if (ctl.signal.aborted) {
        setStatus(teil ? "fertig" : "leer");
        if (teil) toast("Entwurf angehalten", { text: "Der bisher geschriebene Text bleibt erhalten.", ton: "info" });
        return;
      }
      setFehler(e instanceof Error ? e.message : "Die KI ist gerade nicht erreichbar.");
      setStatus(teil ? "fehler" : "fehler");
    }
  };

  const abbrechen = () => {
    if (erzeugt?.quelle === "vorlage") return sofortAnzeigen();
    abort.current?.abort();
  };

  const nurText = (t: string) => t.replace(/\*\*/g, "");

  const speichern = async () => {
    if (!erzeugt || !text.trim()) return;
    const a = data.akten.find((x) => x.id === erzeugt.akteId);
    if (!a) return;
    const info = artInfo(erzeugt.art);
    const inhalt = nurText(text);
    const offenePlatzhalter = (inhalt.match(/\[[^\]\n]+\]/g) ?? []).length;
    const kiText = `${info.titel} – Entwurf (${erzeugt.quelle === "live" ? "Claude" : "Vorlage"})${offenePlatzhalter ? `, ${offenePlatzhalter} Platzhalter offen` : ""}`;
    // Gleiches Schreiben an denselben Empfänger schon in der Akte (noch nicht versandt)? Dann neue Version statt zweitem Dokument.
    const frueher = fruehereFassung(erzeugt.art, a, useData.getState().data);
    if (frueher) {
      const neu = frueher.version + 1;
      const ok = await confirmDialog({
        titel: `Als Version ${neu} von „${frueher.name}“ speichern?`,
        text: `In ${a.aktenzeichen} liegt bereits „${frueher.name}“ vom ${frueher.createdAt.slice(0, 10).split("-").reverse().join(".")} (Version ${frueher.version}${frueher.status === "freigegeben" ? ", freigegeben" : frueher.status === "entwurf" ? ", Entwurf" : ""}). Der neue Entwurf wird als Version ${neu} desselben Dokuments gespeichert – es entsteht keine zweite Datei${frueher.status === "freigegeben" ? "; die Freigabe muss danach erneuert werden" : ""}.`,
        bestaetigen: `Als Version ${neu} speichern`,
      });
      if (!ok) return;
      useData.getState().patch("dokumente", frueher.id, {
        inhalt,
        version: neu,
        status: "entwurf",
        autorId: user.id,
        createdAt: nowLocal(),
        portal: undefined,
        groesseKb: Math.max(14, Math.round(inhalt.length / 60)),
        seiten: Math.max(1, Math.ceil(inhalt.length / 2800)),
        ki: { zusammenfassung: kiText },
      });
      useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: a.id, text: `KI-Entwurf als Version ${neu} von „${frueher.name}“ gespeichert (${info.titel})${offenePlatzhalter ? ` – ${offenePlatzhalter} Platzhalter offen` : ""} – ${a.aktenzeichen}` });
      setGespeichert(frueher.id);
      toast(`Version ${neu} gespeichert`, {
        text: `${frueher.name} · ${a.aktenzeichen}`,
        ton: "erfolg",
        aktion: { label: "Akte öffnen", onClick: () => nav(`/akten/${a.id}?tab=dokumente&dok=${frueher.id}`) },
      });
      return;
    }
    const dok: Dokument = {
      id: uid("d"),
      akteId: a.id,
      name: dokumentName(erzeugt.art, a, data),
      art: "schriftsatz",
      ordner: info.ordner,
      format: "docx",
      groesseKb: Math.max(14, Math.round(inhalt.length / 60)),
      seiten: Math.max(1, Math.ceil(inhalt.length / 2800)),
      inhalt,
      quelle: "generiert",
      autorId: user.id,
      version: 1,
      status: "entwurf",
      createdAt: nowLocal(),
      ki: { zusammenfassung: kiText },
    };
    useData.getState().upsert("dokumente", dok);
    // „KI gespart“ je Akte und Vorgangsart nur einmal: erneutes Speichern desselben Entwurfs zählt nicht noch einmal.
    const marke = `(${info.titel})`;
    const schonGezaehlt = useData.getState().data.aktivitaeten.some((x) => x.akteur === "ki" && x.akteId === a.id && (x.minutenGespart ?? 0) > 0 && x.text.includes(marke));
    useData.getState().log({ akteur: "ki", userId: user.id, akteId: a.id, text: `Entwurf „${dok.name}“ ${marke} erstellt und in ${a.aktenzeichen} gespeichert`, minutenGespart: schonGezaehlt ? 0 : 20 });
    setGespeichert(dok.id);
    toast("Entwurf gespeichert", {
      text: `${dok.name} · Ordner „${info.ordner}“ in ${a.aktenzeichen}`,
      ton: "erfolg",
      aktion: { label: "Akte öffnen", onClick: () => nav(`/akten/${a.id}?tab=dokumente&dok=${dok.id}`) },
    });
  };

  const kopieren = async () => {
    const r = await kopiereText(nurText(text), papierRef.current);
    if (r === "kopiert") {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1800);
      toast("Entwurf kopiert", { ton: "erfolg" });
    } else if (r === "markiert") toast("Text markiert", { text: "Kopieren Sie ihn mit ⌘C bzw. Strg+C.", ton: "info" });
    else toast("Kopieren nicht möglich", { text: "Bitte markieren Sie den Text von Hand.", ton: "warnung" });
  };

  const neu = () => {
    laufNr.current++;
    abort.current?.abort();
    stoppeTipp();
    setStatus("leer");
    setText("");
    setSichtbar(0);
    setErzeugt(null);
    setGespeichert(null);
    setFehler(null);
  };

  const zitate = useMemo(() => (status === "fertig" || status === "fehler" ? pruefeZitate(text, [akte?.gerichtsAz]) : []), [status, text, akte?.gerichtsAz]);
  const platzhalter = useMemo(() => (status === "fertig" ? (text.match(/\[[^\]\n]+\]/g) ?? []).length : 0), [status, text]);
  const unbekannt = zitate.filter((z) => !z.entscheidung);

  const hinweisAkte =
    akte && art === "deckung" && !akte.rsv
      ? "Für diese Akte ist keine Rechtsschutzversicherung hinterlegt – der Entwurf enthält Platzhalter."
      : akte && (art === "klageerwiderung" || art === "replik") && !akte.gerichtsAz
        ? `Für diese Akte ist kein Gerichtsverfahren hinterlegt. Das Gerüst geht davon aus, dass Ihre Mandantschaft ${art === "replik" ? "klagt" : "verklagt wurde"} – Parteirollen und Aktenzeichen bitte prüfen.`
        : akte && art === "klageerwiderung" && !rolle
          ? "Ob Ihre Mandantschaft klagt oder verklagt wurde, geht aus der Akte nicht eindeutig hervor. Das Gerüst geht von einer Klageerwiderung aus – Parteirollen bitte prüfen."
          : akte && art === "kosten" && !akte.gegenstandswert
            ? "Ohne Gegenstandswert kann keine Gebühr berechnet werden."
            : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:items-start">
      {/* ───────── Einstellungen ───────── */}
      <Card className="min-w-0 !p-4 sm:!p-5 lg:sticky lg:top-24">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
            <FileSignature className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="title-md">Entwurf vorbereiten</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-3">Die KI nutzt nur Angaben aus der Akte. Fehlendes wird als [Platzhalter] markiert.</p>
          </div>
        </div>

        <Field label="Akte" htmlFor="schrift-akte">
          <Select id="schrift-akte" value={akteId} onChange={(e) => onAkte(e.target.value)}>
            {offene.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aktenzeichen} · {a.titel}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-4">
          <div className="label">Dokumentart</div>
          <div role="radiogroup" aria-label="Dokumentart" className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {arten.map((a) => {
              const aktiv = a.key === art;
              return (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={aktiv}
                  onClick={() => setArt(a.key)}
                  className={cn("relative flex w-full min-w-0 items-center gap-3 rounded-[14px] p-2.5 text-left transition-colors", aktiv ? "" : "hover:bg-[var(--ink-softer)]")}
                >
                  {aktiv && <motion.span layoutId="schrift-art" className="absolute inset-0 rounded-[14px] bg-ink-soft ring-1 ring-[var(--ink)]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
                  <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-[10px] transition-colors", aktiv ? "bg-[var(--ink)] text-[var(--on-ink)]" : "bg-[var(--ink-softer)] text-fg-2")}>{ICONS[a.key]}</span>
                  <span className="relative min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{a.titel}</span>
                    <span className="block truncate text-[12.5px] text-fg-3">{a.kurz}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="label">Tonalität</div>
          <Segmented<Ton>
            full
            value={ton}
            onChange={setTon}
            options={[
              { value: "sachlich", label: "Sachlich" },
              { value: "verbindlich", label: "Verbindlich" },
            ]}
          />
        </div>

        <Field label="Zusätzliche Hinweise (optional)" htmlFor="schrift-hinweise" className="mt-4">
          <Textarea id="schrift-hinweise" rows={3} value={hinweise} onChange={(e) => setHinweise(e.target.value)} placeholder="z. B. „Vergleichsbereitschaft andeuten“ oder „Zeugen Seifert erwähnen“" className="text-[13px]" />
        </Field>

        <AnimatePresence initial={false}>
          {hinweisAkte && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12px] text-amber">
                <CircleAlert className="mt-px size-3.5 shrink-0" />
                {hinweisAkte}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button variant="ai" size="lg" className="mt-4 w-full" icon={<Wand2 className="size-4" />} onClick={() => void erstellen()} loading={status === "vorbereitung"} disabled={!akte || schreibt}>
          Entwurf erstellen
        </Button>
        <p className="mt-2.5 text-center text-[12.5px] text-fg-3">{live ? "Claude formuliert live – Sie sehen jedes Wort entstehen." : "Demo-KI: Entwurf aus geprüften Vorlagen und den Daten der Akte."}</p>
      </Card>

      {/* ───────── Vorschau ───────── */}
      <section id="schriftsatz-vorschau" className="min-w-0 scroll-mt-24">
        <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-[20px] px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold">
              <span className="text-fg-3">Entwurf · </span>
              {artInfo(erzeugt?.art ?? art).label}
            </span>
            {erzeugt && (erzeugt.quelle === "live" ? <AiChip>Claude</AiChip> : <Chip tone="violet">Demo-Vorlage</Chip>)}
            {schreibt && (
              <span className="ai-text hidden text-[12px] font-semibold sm:inline" aria-live="polite">
                {status === "vorbereitung" ? "bereitet vor …" : "schreibt …"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {schreibt ? (
              <Button size="sm" variant="secondary" icon={erzeugt?.quelle === "vorlage" ? <FastForward className="size-4" /> : <Square className="size-3.5" />} onClick={abbrechen} disabled={status === "vorbereitung" && erzeugt?.quelle === "vorlage"}>
                {erzeugt?.quelle === "vorlage" ? "Sofort anzeigen" : "Anhalten"}
              </Button>
            ) : text ? (
              <>
                <Button size="sm" variant="primary" icon={gespeichert ? <Check className="size-4" /> : <Save className="size-4" />} onClick={speichern} disabled={!!gespeichert}>
                  {gespeichert ? "Gespeichert" : "In Akte speichern"}
                </Button>
                <Button size="sm" variant="secondary" aria-label="Entwurf kopieren" title="Entwurf kopieren" icon={kopiert ? <Check className="size-4 text-green" /> : <Copy className="size-4" />} onClick={() => void kopieren()}>
                  <span className="hidden sm:inline">{kopiert ? "Kopiert" : "Kopieren"}</span>
                </Button>
                <Button size="sm" variant="ghost" aria-label="Neu erstellen" title="Neu erstellen" icon={<RotateCcw className="size-4" />} onClick={neu}>
                  <span className="hidden sm:inline">Neu erstellen</span>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <AnimatePresence>
          {fehler && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mb-3 flex flex-wrap items-start gap-2 rounded-[14px] bg-seal-soft px-3.5 py-3 text-[13px] text-seal">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {fehler} {text ? "Der bisher erzeugte Text bleibt erhalten." : ""} Mit „Entwurf erstellen“ versuchen Sie es erneut – oder nutzen Sie die geprüfte Vorlage.
              </span>
              <Button size="sm" variant="secondary" className="shrink-0" onClick={() => void erstellen(true)}>
                Vorlage verwenden
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {status === "fertig" && text && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-3 flex flex-wrap items-center gap-1.5">
            {platzhalter > 0 ? (
              <Chip tone="amber" icon={<PenLine className="size-3" />}>
                {platzhalter} {platzhalter === 1 ? "Platzhalter" : "Platzhalter"} vor dem Versand ausfüllen
              </Chip>
            ) : (
              <Chip tone="green" icon={<Check className="size-3" />}>
                Keine offenen Platzhalter
              </Chip>
            )}
            {zitate.length > unbekannt.length && (
              <Chip tone="green" icon={<BookCheck className="size-3" />} title={zitate.filter((z) => z.entscheidung).map((z) => z.az).join(", ")}>
                {zitate.length - unbekannt.length} {zitate.length - unbekannt.length === 1 ? "Zitat" : "Zitate"} mit der Fall-Datenbank abgeglichen
              </Chip>
            )}
            {unbekannt.length > 0 && (
              <Chip tone="seal" icon={<AlertTriangle className="size-3" />} title={unbekannt.map((z) => z.az).join(", ")}>
                {unbekannt.length} {unbekannt.length === 1 ? "Zitat" : "Zitate"} nicht in der Fall-Datenbank – im Text markiert
              </Chip>
            )}
            <span className="text-[12.5px] text-fg-3">Entwurf – vor Versand anwaltlich prüfen.</span>
          </motion.div>
        )}

        <div ref={scrollRef} tabIndex={0} role="region" aria-label="Vorschau des Entwurfs" className="rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] lg:max-h-[min(80vh,980px)] lg:overflow-y-auto lg:pb-2">
          <motion.article
            layout="position"
            className={cn("paper relative mx-auto max-w-[800px] px-5 py-7 sm:px-12 sm:py-11", schreibt && "ai-ring")}
            onClick={() => erzeugt?.quelle === "vorlage" && status === "schreibt" && sofortAnzeigen()}
          >
            <Briefkopf name={tenant.name} adresse={tenant.adresse} farbe={tenant.farbe} person={user.name} titel={user.titel} email={user.email} />
            {status === "leer" ? (
              <LeeresPapier />
            ) : status === "vorbereitung" && !angezeigt ? (
              <div className="py-6">
                <KiSchritte schritte={SCHRITTE} aktiv={schritt} kompakt />
              </div>
            ) : (
              <div ref={papierRef} className="text-[13.5px] leading-[1.7]">
                <Brief text={angezeigt} cursor={status === "schreibt"} warnAz={unbekannt.map((z) => z.az)} />
              </div>
            )}
          </motion.article>
        </div>
      </section>
    </div>
  );
}

function Briefkopf({ name, adresse, farbe, person, titel, email }: { name: string; adresse: string; farbe: string; person: string; titel: string; email: string }) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4 border-b border-black/10 pb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full" style={{ background: farbe }} />
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{name}</span>
        </div>
        <div className="mt-0.5 truncate pl-3 text-[12.5px] opacity-60">{adresse}</div>
      </div>
      <div className="hidden shrink-0 text-right text-[12.5px] leading-snug opacity-60 sm:block">
        <div className="font-medium">{person}</div>
        <div className="max-w-[220px] truncate">{titel}</div>
        <div>{email}</div>
      </div>
    </header>
  );
}

function LeeresPapier() {
  return (
    <div className="relative">
      <div className="grid gap-2.5 opacity-70" aria-hidden>
        {[42, 30, 0, 26, 64, 0, 92, 88, 95, 70, 0, 90, 84, 60].map((w, i) => (w ? <div key={i} className="h-2.5 rounded-full bg-black/[0.06]" style={{ width: `${w}%` }} /> : <div key={i} className="h-2" />))}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="max-w-[300px] rounded-[18px] bg-white/85 px-5 py-4 text-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
          <Sparkles className="mx-auto mb-2 size-5 text-violet" />
          <div className="text-[13.5px] font-semibold">Ihr Entwurf erscheint hier</div>
          <div className="mt-1 text-[12px] leading-snug opacity-60">Akte und Dokumentart wählen, dann „Entwurf erstellen“. Platzhalter in [Klammern] sind farbig markiert.</div>
        </div>
      </div>
    </div>
  );
}

/** Mini-Formatierung: **fett**, [Platzhalter] markiert, Leerzeilen als Absätze – robust auch für halbfertigen Text. */
function Brief({ text, cursor, warnAz = [] }: { text: string; cursor: boolean; warnAz?: string[] }) {
  const zeilen = text.replace(/\r/g, "").split("\n");
  return (
    <>
      {zeilen.map((z, i) => {
        const letzte = i === zeilen.length - 1;
        if (!z.trim() && !letzte) return <div key={i} className="h-[0.85em]" />;
        const ueberschrift = /^#{1,3}\s/.test(z);
        const inhalt = ueberschrift ? z.replace(/^#{1,3}\s/, "") : z;
        return (
          <p key={i} className={cn("whitespace-pre-wrap break-words", ueberschrift && "font-semibold")}>
            {inline(inhalt, warnAz)}
            {letzte && cursor && <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse rounded-full bg-[var(--ai-2)]" />}
          </p>
        );
      })}
    </>
  );
}

function warnungen(t: string, warnAz: string[], key: string): ReactNode {
  if (!warnAz.length) return t;
  const re = new RegExp(`(${warnAz.map((a) => a.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})`, "g");
  return t.split(re).map((teil, j) =>
    warnAz.includes(teil) ? (
      <span key={`${key}-${j}`} title="Nicht in der Fall-Datenbank – bitte im Original prüfen" className="rounded-[3px] bg-seal-soft text-seal underline decoration-wavy decoration-1 underline-offset-2">
        {teil}
      </span>
    ) : (
      teil
    ),
  );
}

function inline(z: string, warnAz: string[] = []): ReactNode[] {
  const teile = z.split(/(\*\*[^*]+\*\*|\*\*[^*]*$|\[[^\]\n]+\]|\[[^\]\n]*$)/g);
  return teile.map((t, i) => {
    if (!t) return null;
    if (t.startsWith("**")) return <strong key={i} className="font-semibold">{warnungen(t.replace(/\*\*/g, ""), warnAz, String(i))}</strong>;
    if (t.startsWith("[")) {
      return (
        <mark key={i} className="rounded-[4px] bg-amber-soft px-0.5 text-inherit ring-1 ring-[color-mix(in_oklab,var(--amber)_35%,transparent)]">
          {t}
        </mark>
      );
    }
    return <span key={i}>{warnungen(t, warnAz, String(i))}</span>;
  });
}

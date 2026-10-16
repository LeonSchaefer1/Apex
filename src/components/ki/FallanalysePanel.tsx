import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Sparkles, Scale, CheckCircle2, XCircle, AlertTriangle, ListChecks, FileText, Library, RotateCcw, Copy, Save, Square, BookOpen, Loader2, ChevronRight, FolderOpen,
} from "lucide-react";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { istConsole } from "@/lib/backend";
import { toast } from "@/store/ui";
import { useAiStatus } from "@/ai/status";
import { analysiereFall, ANALYSE_PHASEN, type Fallanalyse } from "@/ai/fallanalyse";
import { nowLocal, relTime } from "@/core/dates";
import { Button, Card, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { kopiereText } from "@/lib/zwischenablage";

/** Fehler der Analyse verständlich formulieren – keine Rohmeldungen wie „Failed to fetch“ oder „Fehler 500“. */
function fehlerText(e: unknown): string {
  const roh = e instanceof Error ? e.message : String(e);
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(roh))
    return "Keine Verbindung zum Kanzlei-Server. Bitte prüfen Sie die Netzwerkverbindung und starten Sie die Analyse erneut.";
  if (/\b5\d\d\b|server error|bad gateway|service unavailable/i.test(roh)) return "Der Kanzlei-Server antwortet gerade nicht. Bitte versuchen Sie es in einer Minute erneut.";
  if (/\b(401|403)\b|nicht angemeldet|unauthori[sz]ed/i.test(roh)) return "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an und starten Sie die Analyse noch einmal.";
  if (/timeout|zeitüberschreitung|zeitlimit/i.test(roh)) return "Die Analyse hat zu lange gedauert. Bitte starten Sie sie erneut.";
  // bereits verständliche Meldungen (z. B. vom Kanzlei-Server übersetzt) übernehmen
  return /^[A-ZÄÖÜ][a-zäöüß]/.test(roh) && /[äöüß]|\b(der|die|das|nicht|bitte)\b/i.test(roh)
    ? `Die Fallanalyse konnte nicht erstellt werden: ${roh}`
    : "Die Fallanalyse konnte gerade nicht erstellt werden. Bitte starten Sie sie erneut – bleibt der Fehler, hilft Ihr Ansprechpartner weiter.";
}

/**
 * Zwischenspeicher der letzten Analyse je Akte – Mandantentrennung: geschlüsselt nach Kanzlei-ID,
 * Daten-Epoche (`useData().epoch`, erhöht sich bei Laden/Zurücksetzen/Abmelden) und Akten-ID.
 * Akten-IDs wiederholen sich in jeder Kanzlei (hero-a-1 …); ein Eintrag einer anderen Kanzlei
 * oder eines älteren Datenstands wird daher nie angezeigt.
 */
const cache = new Map<string, Fallanalyse>();
let cacheStand = "";

function cacheSchluessel(tenantId: string, epoch: number, akteId: string) {
  const stand = `${tenantId}:${epoch}`;
  if (stand !== cacheStand) {
    cache.clear();
    cacheStand = stand;
  }
  return `${stand}:${akteId}`;
}

/** Kanzlei-ID der aktuellen Sitzung (außerhalb des Renderns, für laufende Analysen). */
function aktuelleKanzleiId(): string {
  const s = useSession.getState().sitzung;
  return s && !istConsole(s) ? s.tenant.id : "-";
}

/** Stabile Dokument-ID des gespeicherten Entwurfs – ein Entwurf je Analyse, kein Duplikat bei erneutem Klick. */
function entwurfDokId(akteId: string, r: Fallanalyse) {
  return `dok-fa-${akteId}-${r.erstelltAm.replace(/\D/g, "")}`;
}

/** KI-Fallanalyse einer Akte: animierte Analyse-Pipeline, Erfolgsaussicht, Präzedenzfälle, nächste Schritte, Entwurf. */
/**
 * `autoStart`: startet die Analyse einmal von selbst (Deep-Link), sofern noch kein Ergebnis im Cache liegt;
 * `onAutoStart` meldet, dass der Auftrag erledigt ist (z. B. um ?start=1 aus der Adresse zu entfernen).
 */
export function FallanalysePanel({ akteId, kompakt, autoStart, onAutoStart }: { akteId: string; kompakt?: boolean; autoStart?: boolean; onAutoStart?: () => void }) {
  const data = useData((s) => s.data);
  const epoch = useData((s) => s.epoch);
  const { user, tenant } = useKanzlei();
  const ai = useAiStatus();
  const akte = data.akten.find((a) => a.id === akteId);
  const schluessel = cacheSchluessel(tenant.id, epoch, akteId);
  const [ergebnis, setErgebnis] = useState<Fallanalyse | null>(() => cache.get(schluessel) ?? null);
  const [phase, setPhase] = useState(-1);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stream, setStream] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const startRef = useRef<(() => Promise<void>) | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    setErgebnis(cache.get(schluessel) ?? null);
    setPhase(-1);
    setFehler(null);
    setLaeuft(false);
    return () => ctl.current?.abort();
  }, [schluessel]);

  useEffect(() => {
    if (!autoStart) return;
    // Liegt bereits ein Ergebnis vor, wird es nur angezeigt.
    if (!cache.get(schluessel)) void startRef.current?.();
    onAutoStart?.();
  }, [autoStart, schluessel]);

  if (!akte) return null;

  const entwurfId = ergebnis ? entwurfDokId(akteId, ergebnis) : null;
  const entwurfGespeichert = !!entwurfId && data.dokumente.some((d) => d.id === entwurfId);

  const start = async () => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const startSchluessel = schluessel;
    /** Kanzlei oder Datenstand gewechselt? Dann darf die Analyse nichts mehr schreiben. */
    const veraltet = () => c.signal.aborted || cacheSchluessel(aktuelleKanzleiId(), useData.getState().epoch, akteId) !== startSchluessel;
    setLaeuft(true);
    setFehler(null);
    setErgebnis(null);
    setStream("");
    setPhase(0);
    try {
      const r = await analysiereFall(akteId, useData.getState().data, {
        onPhase: (p) => {
          if (!veraltet()) setPhase(p);
        },
        signal: c.signal,
        onText: (t) => {
          if (!veraltet()) setStream(t);
        },
      });
      if (veraltet()) return;
      cache.set(startSchluessel, r);
      setErgebnis(r);
      setPhase(ANALYSE_PHASEN.length);
      const st = useData.getState();
      st.patch("akten", akteId, { kiAnalyse: { erstelltAm: r.erstelltAm, prozent: r.erfolgsaussicht.prozent, quelle: r.quelle } });
      st.log({ akteur: "ki", akteId, text: `KI-Fallanalyse erstellt – Erfolgsaussicht ${r.erfolgsaussicht.prozent} % (${akte.aktenzeichen})`, minutenGespart: 45 });
    } catch (e) {
      if (!veraltet()) setFehler(fehlerText(e));
    } finally {
      if (ctl.current === c) setLaeuft(false);
    }
  };

  startRef.current = start;

  const oeffneEntwurf = () => {
    if (entwurfId) nav(`/akten/${akteId}?tab=dokumente&dok=${encodeURIComponent(entwurfId)}`);
  };

  const speichereEntwurf = () => {
    if (!ergebnis || !entwurfId) return;
    if (useData.getState().data.dokumente.some((d) => d.id === entwurfId)) {
      oeffneEntwurf();
      return;
    }
    useData.getState().upsert("dokumente", {
      id: entwurfId,
      akteId,
      name: ergebnis.entwurf.titel,
      art: "schriftsatz",
      ordner: "Schriftsätze",
      format: "docx",
      groesseKb: Math.max(8, Math.round(ergebnis.entwurf.text.length / 900)),
      seiten: Math.max(1, Math.round(ergebnis.entwurf.text.length / 2600)),
      inhalt: ergebnis.entwurf.text,
      quelle: "generiert",
      autorId: user.id,
      version: 1,
      createdAt: nowLocal(),
      ki: { zusammenfassung: "Von der KI-Fallanalyse erstellter Entwurf – bitte prüfen." },
    });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId, text: `KI-Entwurf „${ergebnis.entwurf.titel}“ in der E-Akte gespeichert (Schriftsätze)` });
    const id = entwurfId;
    toast("Entwurf in der E-Akte gespeichert", { ton: "erfolg", text: "Ordner „Schriftsätze“", aktion: { label: "Öffnen", onClick: () => nav(`/akten/${akteId}?tab=dokumente&dok=${encodeURIComponent(id)}`) } });
  };

  const kopieren = async () => {
    if (!ergebnis) return;
    const r = await kopiereText(ergebnis.entwurf.text, document.getElementById("fa-entwurf-text"));
    if (r === "kopiert") toast("Entwurf kopiert", { ton: "erfolg" });
    else if (r === "markiert") toast("Text markiert – jetzt Strg/⌘+C", { ton: "info", text: "Die Zwischenablage ist hier gesperrt. Der Entwurf ist markiert und lässt sich direkt kopieren." });
    else toast("Kopieren nicht möglich", { ton: "warnung", text: "Bitte den Text markieren und manuell kopieren." });
  };

  // ── Startzustand ──
  if (!ergebnis && !laeuft) {
    return (
      <Card className="ai-ring ai-glow overflow-hidden !p-0">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-violet" />
              <span className="ai-text text-[12px] font-semibold uppercase tracking-[0.08em]">KI-Fallanalyse</span>
            </div>
            <h3 className="title-lg">In 30 Sekunden zur fundierten Einschätzung</h3>
            <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-fg-3">
              Die KI liest Sachverhalt, Dokumente und Notizen der Akte <span className="mono text-fg-2">{akte.aktenzeichen}</span>, sucht passende Entscheidungen in der Fall-Datenbank und liefert Erfolgsaussicht, Argumente, Risiken, nächste Schritte und einen Schriftsatz-Entwurf – mit Quellen.
            </p>
            {fehler && <div className="mt-3 rounded-[12px] bg-seal-soft px-3 py-2 text-[12.5px] text-seal">{fehler}</div>}
            {akte.kiAnalyse && <div className="mt-3 text-[12px] text-fg-4">Letzte Analyse {relTime(akte.kiAnalyse.erstelltAm)} · Erfolgsaussicht {akte.kiAnalyse.prozent} %</div>}
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <Button variant="ai" size="lg" icon={<Sparkles className="size-4" />} onClick={start}>
              Fallanalyse starten
            </Button>
            <span className="text-[11.5px] text-fg-4">{ai.quelle === "demo" ? "Demo-KI (offline)" : `Live mit Claude${ai.modell ? ` · ${ai.modell}` : ""}`}</span>
          </div>
        </div>
      </Card>
    );
  }

  // ── Analyse läuft ──
  if (laeuft) {
    return (
      <Card className="ai-ring ai-glow overflow-hidden">
        <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
          <div className="grid place-items-center py-2">
            <AnalyseOrb />
          </div>
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="ai-text text-[12px] font-semibold uppercase tracking-[0.08em]">Analyse läuft</div>
                <div className="title-md mt-1">{akte.titel}</div>
              </div>
              <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={() => ctl.current?.abort()}>
                Stoppen
              </Button>
            </div>
            <ol className="grid gap-2.5">
              {ANALYSE_PHASEN.map((p, i) => (
                <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 text-[13.5px]">
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-500", i < phase ? "bg-green text-[var(--on-green)]" : i === phase ? "ai-fill text-white" : "bg-[var(--line)] text-fg-4")}>
                    {i < phase ? <CheckCircle2 className="size-4" /> : i === phase ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
                  </span>
                  <span className={cn(i <= phase ? "text-fg" : "text-fg-4", i === phase && "font-medium")}>{p}</span>
                </motion.li>
              ))}
            </ol>
            {stream && (
              <div className="mt-4 max-h-24 overflow-hidden rounded-[12px] bg-[var(--ink-softer)] p-3 font-mono text-[11px] leading-snug text-fg-3 [mask-image:linear-gradient(transparent,#000_40%)]">
                {stream.slice(-600)}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const r = ergebnis!;
  const farbe = r.erfolgsaussicht.stufe === "hoch" ? "var(--green)" : r.erfolgsaussicht.stufe === "mittel" ? "var(--amber)" : "var(--seal)";
  const stagger = (i: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 + i * 0.06, type: "spring" as const, stiffness: 300, damping: 30 } });

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      {/* Kopf: Erfolgsaussicht */}
      <motion.div {...stagger(0)}>
        <Card className="ai-ring overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <Gauge prozent={r.erfolgsaussicht.prozent} farbe={farbe} />
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="ai-text text-[12px] font-semibold uppercase tracking-[0.08em]">KI-Fallanalyse</span>
                <Chip tone={r.erfolgsaussicht.stufe === "hoch" ? "green" : r.erfolgsaussicht.stufe === "mittel" ? "amber" : "seal"}>Erfolgsaussicht {r.erfolgsaussicht.stufe}</Chip>
                <Chip tone="outline">{r.quelle === "demo" ? "Demo-KI" : "Claude live"}</Chip>
                <span className="text-[11.5px] text-fg-4">in {(r.dauerMs / 1000).toFixed(1).replace(".", ",")} s</span>
              </div>
              <p className="text-[14px] leading-relaxed text-fg-2">{r.zusammenfassung}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-3">
                <strong className="text-fg">Begründung:</strong> {r.erfolgsaussicht.begruendung}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={start}>
                Neu analysieren
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Zwei unabhängige Spalten ab xl: Karten unterschiedlicher Höhe strecken sich nicht gegenseitig (keine halbleeren
          Karten). Darunter lösen sich die Spalten auf (contents), die Reihenfolge bleibt 1–4. */}
      <div className={cn("grid gap-4 [&>*]:min-w-0", !kompakt && "xl:grid-cols-2 xl:items-start")}>
        <div className={cn("contents", !kompakt && "xl:grid xl:gap-4")}>
          <motion.div {...stagger(1)} className="order-1 min-w-0">
            <Card className="h-full">
              <SectionTitle icon={<Scale className="size-4" />} title="Rechtsfragen" />
              <ol className="grid gap-2">
                {r.rechtsfragen.map((q, i) => (
                  <li key={i} className="flex gap-3 text-[13.5px] leading-snug text-fg-2">
                    <span className="num mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink-soft text-[11px] font-semibold text-ink">{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ol>
            </Card>
          </motion.div>

          <motion.div {...stagger(3)} className="order-3 min-w-0">
            <Card className="h-full">
              <SectionTitle icon={<CheckCircle2 className="size-4" />} title="Was für uns spricht" tone="green" />
              <ul className="grid gap-2">
                {r.argumentePro.map((a, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-fg-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green" />
                    {a}
                  </li>
                ))}
              </ul>
              <div className="my-4 h-px bg-[var(--line)]" />
              <SectionTitle icon={<XCircle className="size-4" />} title="Was dagegen spricht" tone="seal" />
              <ul className="grid gap-2">
                {r.argumenteContra.map((a, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-fg-2">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-seal" />
                    {a}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        </div>
        <div className={cn("contents", !kompakt && "xl:grid xl:gap-4")}>
          <motion.div {...stagger(2)} className="order-2 min-w-0">
            <Card className="h-full">
              <SectionTitle icon={<Library className="size-4" />} title="Präzedenzfälle aus der Fall-Datenbank" />
              <div className="grid gap-2.5">
                {r.praezedenzfaelle.map((p) => (
                  <button key={p.id} type="button" onClick={() => nav(`/fall-datenbank?id=${p.id}`)} className="group min-w-0 rounded-[14px] p-3 text-left ring-1 ring-[var(--line)] transition-all hover:bg-ink-softer hover:ring-[var(--ink-soft)]">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[12px] font-semibold text-ink">
                        {p.gericht} {p.az}
                      </span>
                      <span className="truncate text-[12.5px] font-medium">{p.titel}</span>
                      <ChevronRight className="ml-auto size-4 shrink-0 text-fg-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="bar h-1 flex-1">
                        <motion.span initial={{ width: 0 }} animate={{ width: `${p.relevanz}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
                      </div>
                      <span className="num text-[11px] text-fg-3">{p.relevanz} %</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-snug text-fg-3">{p.warum}</p>
                  </button>
                ))}
                {!r.praezedenzfaelle.length && <p className="text-[13px] text-fg-3">Keine passende Entscheidung im Demo-Bestand gefunden.</p>}
              </div>
            </Card>
          </motion.div>

          <motion.div {...stagger(4)} className="order-4 min-w-0">
            <Card className="h-full">
              <SectionTitle icon={<ListChecks className="size-4" />} title="Nächste Schritte" />
              <ol className="relative grid gap-3 border-l border-[var(--line)] pl-5">
                {r.naechsteSchritte.map((s, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-0.5 grid size-[14px] place-items-center rounded-full bg-[var(--surface)] ring-2 ring-[var(--ink)]" />
                    <div className="text-[13.5px] font-semibold">{s.titel}</div>
                    <div className="text-[12.5px] leading-snug text-fg-3">{s.detail}</div>
                  </li>
                ))}
              </ol>
              {r.risiken.length > 0 && (
                <div className="mt-4 rounded-[14px] bg-amber-soft p-3">
                  {r.risiken.map((x, i) => (
                    <div key={i} className="flex gap-2 text-[12.5px] leading-snug text-fg-2">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
                      {x}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </div>

      <motion.div {...stagger(5)}>
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SectionTitle icon={<FileText className="size-4" />} title={r.entwurf.titel} className="!mb-0 flex-1" />
            <Button size="sm" icon={<Copy className="size-3.5" />} onClick={kopieren}>
              Kopieren
            </Button>
            {entwurfGespeichert ? (
              <>
                <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
                  In E-Akte gespeichert
                </Chip>
                <Button size="sm" variant="secondary" icon={<FolderOpen className="size-3.5" />} onClick={oeffneEntwurf}>
                  Im Ordner „Schriftsätze“ öffnen
                </Button>
              </>
            ) : (
              <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} onClick={speichereEntwurf}>
                In E-Akte speichern
              </Button>
            )}
          </div>
          <div id="fa-entwurf-text" className="paper max-h-[520px] overflow-y-auto whitespace-pre-wrap px-6 py-7 sm:px-10">{r.entwurf.text}</div>
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-fg-4">
            <BookOpen className="size-3.5" /> Entwurf der KI – vor Verwendung anwaltlich prüfen. Zitierte Entscheidungen stammen ausschließlich aus der Fall-Datenbank.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

function SectionTitle({ icon, title, tone = "ink", className }: { icon: React.ReactNode; title: string; tone?: "ink" | "green" | "seal"; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      <span className={cn("grid size-7 place-items-center rounded-[9px]", tone === "green" ? "bg-green-soft text-green" : tone === "seal" ? "bg-seal-soft text-seal" : "bg-ink-soft text-ink")}>{icon}</span>
      <span className="title-md">{title}</span>
    </div>
  );
}

function Gauge({ prozent, farbe }: { prozent: number; farbe: string }) {
  const r = 52;
  const c = Math.PI * r; // Halbkreis
  return (
    <div className="relative mx-auto h-[96px] w-[150px]">
      <svg viewBox="0 0 140 80" className="h-full w-full" aria-label={`Erfolgsaussicht ${prozent} Prozent`}>
        <path d="M18 72 A52 52 0 0 1 122 72" stroke="var(--line)" strokeWidth="12" fill="none" strokeLinecap="round" />
        <motion.path
          d="M18 72 A52 52 0 0 1 122 72"
          stroke={farbe}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - prozent / 100) }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="num text-[30px] font-bold leading-none tracking-[-0.04em]">{prozent} %</div>
        <div className="text-[11px] text-fg-3">Erfolgsaussicht</div>
      </div>
    </div>
  );
}

function AnalyseOrb() {
  return (
    <div className="relative size-[150px]">
      <motion.div
        className="absolute inset-0 rounded-full opacity-60 blur-2xl"
        style={{ background: "conic-gradient(from 0deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full"
        style={{ background: "conic-gradient(from 90deg, var(--ai-1), var(--ai-2), var(--ai-3), var(--ai-4), var(--ai-1))" }}
        animate={{ rotate: -360, borderRadius: ["50%", "46% 54% 52% 48%", "52% 48% 46% 54%", "50%"] }}
        transition={{ rotate: { duration: 9, repeat: Infinity, ease: "linear" }, borderRadius: { duration: 3, repeat: Infinity } }}
      />
      <div className="absolute inset-7 grid place-items-center rounded-full bg-[var(--glass-strong)] backdrop-blur-xl">
        <AnimatePresence mode="wait">
          <motion.div key="s" initial={{ scale: 0.8 }} animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <Sparkles className="size-8 text-violet" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

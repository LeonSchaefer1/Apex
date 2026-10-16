import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Mic, MicOff, Volume2, VolumeX, X, RotateCcw, Square, Phone, Wrench, ArrowRight, Check, CalendarPlus, Pencil, Undo2, ChevronRight, FolderOpen, StickyNote } from "lucide-react";
import { useUI } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { ansprechBitte, frageAssistent, pruefeDatum, vorschlaege, vorschlagArtName, vorschlagEintragen, vorschlagZuruecknehmen, type AssistentLink, type AuswahlKnopf, type Eintragung, type SchreibVorschlag } from "@/ai/assistent";
import { fmtDateWd } from "@/core/dates";
import { RUECKRUF_SIMULIERT } from "@/core/rueckruf";
import { gruss } from "@/lib/rollen";
import { toast } from "@/store/ui";
import { useData } from "@/store/data";
import type { LlmMessage } from "@/ai/llm";
import { hoeren, sprechen, spracheingabeVerfuegbar, sprachausgabeVerfuegbar } from "@/lib/speech";
import { useIsMobile } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { ApexOrb, type OrbZustand } from "./ApexOrb";

interface Msg {
  id: number;
  rolle: "nutzer" | "apex";
  text: string;
  links?: AssistentLink[];
  werkzeuge?: string[];
  laedt?: boolean;
  fehler?: boolean;
  auswahl?: AuswahlKnopf[];
  vorschlag?: SchreibVorschlag;
  /** Zustand der Bestätigungskarte */
  karte?: { status: "offen" | "eingetragen" | "verworfen" | "zurueckgenommen"; eintragung?: Eintragung };
}

let mid = 0;

/** Apex Assistent: sprechender KI-Avatar für Live-Support und Kanzleiarbeit (unten rechts). */
export function AssistantDock() {
  const { assistentOffen, oeffneAssistent, schliesseAssistent, konsumierePrompt, assistentPrompt, kugel, kugelEingeklappt, setKugelEingeklappt } = useUI();
  const sitzung = useKanzlei();
  const ai = useAiStatus();
  const nav = useNavigate();
  const mobile = useIsMobile();
  const akten = useData((s) => s.data.akten);
  // Vorschläge aus den tatsächlichen Daten der Kanzlei (z. B. eine vorhandene Akte statt eines festen Aktenzeichens)
  const ap = sitzung.tenant.ansprechpartner;
  const chips = useMemo(() => vorschlaege({ ...useData.getState().data, akten }, ap), [akten, ap]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [zustand, setZustand] = useState<OrbZustand>("ruhe");
  const [pegel, setPegel] = useState(0);
  const [interim, setInterim] = useState("");
  const [ton, setTon] = useState(() => {
    try {
      return localStorage.getItem("aa:assistent-ton") !== "0";
    } catch {
      return true;
    }
  });
  const [hinweis, setHinweis] = useState<string | null>(null);
  const stopHoeren = useRef<(() => void) | null>(null);
  const stopSprechen = useRef<(() => void) | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const beschaeftigt = zustand === "denkt";

  useEffect(() => {
    try {
      localStorage.setItem("aa:assistent-ton", ton ? "1" : "0");
    } catch {
      /* optional */
    }
  }, [ton]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, interim]);

  const vorlesen = useCallback(
    (text: string) => {
      if (!ton || !sprachausgabeVerfuegbar()) {
        setZustand("ruhe");
        return;
      }
      stopSprechen.current = sprechen(text, {
        onStart: () => setZustand("spricht"),
        onPegel: setPegel,
        onEnde: () => setZustand("ruhe"),
      });
    },
    [ton],
  );

  const senden = useCallback(
    async (text: string, perSprache = false) => {
      const frage = text.trim();
      if (!frage || beschaeftigt) return;
      stopSprechen.current?.();
      setEingabe("");
      setHinweis(null);
      const nutzer: Msg = { id: ++mid, rolle: "nutzer", text: frage };
      const antwortId = ++mid;
      const verlauf: LlmMessage[] = [...msgs.filter((m) => !m.laedt && !m.fehler).map((m) => ({ role: m.rolle === "nutzer" ? ("user" as const) : ("assistant" as const), content: m.text })), { role: "user", content: frage }];
      setMsgs((m) => [...m, nutzer, { id: antwortId, rolle: "apex", text: "", laedt: true, werkzeuge: [] }]);
      setZustand("denkt");
      const c = new AbortController();
      ctl.current = c;
      try {
        const r = await frageAssistent({
          verlauf,
          sitzung,
          nav: (to) => {
            nav(to);
            if (mobile) setTimeout(() => schliesseAssistent(), 900);
          },
          voice: perSprache || ton,
          signal: c.signal,
          onText: (t) => setMsgs((m) => m.map((x) => (x.id === antwortId ? { ...x, text: t } : x))),
          onTool: (label) => setMsgs((m) => m.map((x) => (x.id === antwortId ? { ...x, werkzeuge: [...new Set([...(x.werkzeuge ?? []), label])] } : x))),
        });
        setMsgs((m) => m.map((x) => (x.id === antwortId ? { ...x, text: r.text, links: r.links, werkzeuge: r.werkzeuge, auswahl: r.auswahl, vorschlag: r.vorschlag, karte: r.vorschlag ? { status: "offen" } : undefined, laedt: false } : x)));
        if (perSprache || ton) vorlesen(r.text);
        else setZustand("ruhe");
      } catch (e) {
        const abgebrochen = c.signal.aborted;
        setMsgs((m) => m.map((x) => (x.id === antwortId ? { ...x, laedt: false, fehler: !abgebrochen, text: abgebrochen ? x.text || "Abgebrochen." : e instanceof Error ? e.message : "Das hat nicht geklappt." } : x)));
        setZustand("ruhe");
      }
    },
    [beschaeftigt, msgs, sitzung, nav, mobile, schliesseAssistent, ton, vorlesen],
  );

  // Prompt von außen (⌘K, Schnellhilfe, Cockpit)
  useEffect(() => {
    if (assistentOffen && assistentPrompt) {
      const p = konsumierePrompt();
      if (p) setTimeout(() => void senden(p), 250);
    }
  }, [assistentOffen, assistentPrompt, konsumierePrompt, senden]);

  const mikrofon = () => {
    if (zustand === "hoert") {
      stopHoeren.current?.();
      return;
    }
    stopSprechen.current?.();
    setHinweis(null);
    setInterim("");
    setZustand("hoert");
    stopHoeren.current = hoeren({
      onInterim: setInterim,
      onFinal: (t) => {
        setInterim("");
        void senden(t, true);
      },
      onEnde: () => {
        setInterim("");
        setZustand((z) => (z === "hoert" ? "ruhe" : z));
      },
      onFehler: (msg, dauerhaft) => {
        setHinweis(msg);
        // Spracheingabe für diese Sitzung gesperrt: Mikrofon-Knopf verschwindet, weiter per Tastatur
        if (dauerhaft) setTimeout(() => inputRef.current?.focus(), 0);
      },
    });
  };

  const neu = () => {
    ctl.current?.abort();
    stopSprechen.current?.();
    stopHoeren.current?.();
    setMsgs([]);
    setZustand("ruhe");
  };

  useEffect(() => {
    if (!assistentOffen) {
      stopHoeren.current?.();
      stopSprechen.current?.();
    } else setTimeout(() => inputRef.current?.focus(), 300);
  }, [assistentOffen]);

  // Escape schließt den Assistenten – außer ein Dialog oder Menü liegt darüber und der Fokus ist dort
  // (die globale Suche fängt Escape selbst ab).
  useEffect(() => {
    if (!assistentOffen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || useUI.getState().paletteOffen) return;
      const imPanel = !!panelRef.current?.contains(document.activeElement);
      if (!imPanel && document.querySelector('[aria-modal="true"], [role="menu"]')) return;
      schliesseAssistent();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [assistentOffen, schliesseAssistent]);

  // Öffnet sich ein Dialog (z. B. der Fristenrechner über einen Link des Assistenten), tritt der Assistent zurück –
  // sonst läge er weichgezeichnet und unbedienbar hinter dem Dialog. Das Gespräch bleibt erhalten.
  useEffect(() => {
    if (!assistentOffen) return;
    const dialoge = () => Array.from(document.querySelectorAll('[aria-modal="true"]'));
    const vorher = new Set(dialoge());
    const obs = new MutationObserver(() => {
      if (dialoge().some((d) => !vorher.has(d))) schliesseAssistent();
    });
    obs.observe(document.body, { childList: true });
    return () => obs.disconnect();
  }, [assistentOffen, schliesseAssistent]);

  const begruessung = gruss(sitzung.user);
  const setKarte = (id: number, karte: Msg["karte"], vorschlag?: SchreibVorschlag) => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, karte, vorschlag: vorschlag ?? x.vorschlag } : x)));
  const eintragen = (m: Msg, v: SchreibVorschlag) => {
    try {
      const e = vorschlagEintragen(v, sitzung);
      setKarte(m.id, { status: "eingetragen", eintragung: e }, v);
      toast(`${vorschlagArtName(v)} eingetragen`, { text: `${v.aktenzeichen} · ${v.titel}${v.datum ? ` · ${fmtDateWd(v.datum)}` : ""}`, ton: "erfolg" });
    } catch (e) {
      toast("Eintragen nicht möglich", { text: e instanceof Error ? e.message : "Bitte versuchen Sie es erneut.", ton: "fehler" });
    }
  };
  const zuruecknehmen = (m: Msg) => {
    if (!m.vorschlag || !m.karte?.eintragung) return;
    const ok = vorschlagZuruecknehmen(m.vorschlag, m.karte.eintragung, sitzung);
    setKarte(m.id, { status: "zurueckgenommen" });
    toast(ok ? "Rückgängig gemacht" : "Bereits entfernt", { text: ok ? `${vorschlagArtName(m.vorschlag)} „${m.vorschlag.titel}“ wurde wieder entfernt und protokolliert.` : "Der Eintrag war schon nicht mehr vorhanden.", ton: "info" });
  };
  const statusText = zustand === "hoert" ? "Ich höre zu …" : zustand === "denkt" ? "Denkt nach …" : zustand === "spricht" ? "Spricht …" : ai.quelle === "demo" ? DEMO_KI_NAME : "Live · Claude";

  return (
    <>
      {/* Avatar-Knopf (ab Tablet; auf dem Smartphone sitzt die Kugel in der Tab-Leiste). Einklappbar zu einem Griff am Rand,
          abschaltbar unter Einstellungen → Darstellung – der Assistent bleibt über Strg+K bzw. das Menü erreichbar. */}
      <AnimatePresence>
        {!assistentOffen && !mobile && kugel && !kugelEingeklappt && (
          <motion.div
            key="kugel"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="group fixed bottom-6 right-6 z-50"
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => oeffneAssistent()}
              className="grid place-items-center rounded-full"
              aria-label="Apex Assistent öffnen – per Sprache oder Text fragen"
              title="Apex Assistent – fragen Sie per Sprache oder Text"
            >
              <ApexOrb size={60} />
            </motion.button>
            <button
              type="button"
              onClick={() => setKugelEingeklappt(true)}
              className="absolute -left-2 -top-2 grid size-6 place-items-center rounded-full bg-[var(--surface)] text-fg-2 opacity-0 shadow ring-1 ring-[var(--line-strong)] transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="Assistent-Kugel an den Rand einklappen"
              title="An den Rand einklappen"
            >
              <ChevronRight className="size-3.5" />
            </button>
            <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#0b0e18]/90 px-3 py-1.5 text-[13px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Apex Assistent fragen
            </span>
          </motion.div>
        )}
        {!assistentOffen && !mobile && kugel && kugelEingeklappt && (
          <motion.button
            key="griff"
            type="button"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={() => setKugelEingeklappt(false)}
            className="ai-fill fixed bottom-10 right-0 z-50 h-14 w-3.5 rounded-l-full shadow-[0_6px_18px_-6px_rgba(60,40,200,.6)] ring-1 ring-white/30 transition-[width] hover:w-5 focus-visible:w-5"
            aria-label="Assistent-Kugel wieder einblenden"
            title="Apex Assistent einblenden"
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {assistentOffen && (
          <>
            {mobile && <motion.div className="fixed inset-0 z-[84] bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={schliesseAssistent} />}
            <motion.section
              ref={panelRef}
              role="dialog"
              aria-label="Apex Assistent"
              initial={{ opacity: 0, scale: 0.6, y: 40, x: mobile ? 0 : 40 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: 30, x: mobile ? 0 : 30 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              style={{ transformOrigin: "bottom right", boxShadow: "var(--glass-shadow-lg)", background: "linear-gradient(160deg, var(--glass-sheen) 0%, transparent 40%), color-mix(in oklab, var(--surface) 90%, transparent)" }}
              className={cn(
                "glass-strong fixed z-[85] flex flex-col overflow-hidden",
                mobile ? "inset-x-2 bottom-2 top-[max(12px,env(safe-area-inset-top))] rounded-[28px]" : "bottom-6 right-6 h-[min(700px,calc(100vh-48px))] w-[410px] rounded-[30px]",
              )}
            >
              {/* Kopf */}
              <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                <ApexOrb size={40} zustand={zustand} pegel={pegel} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold tracking-[-0.01em]">Apex Assistent</div>
                  <div className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
                    <span className={cn("size-1.5 rounded-full", ai.quelle === "demo" ? "bg-amber" : "bg-green")} />
                    {statusText}
                  </div>
                </div>
                {sprachausgabeVerfuegbar() && (
                  <button type="button" className="icon-btn !size-9" onClick={() => { setTon((t) => !t); stopSprechen.current?.(); }} aria-label={ton ? "Sprachausgabe ausschalten" : "Sprachausgabe einschalten"} title={ton ? "Sprachausgabe an" : "Sprachausgabe aus"}>
                    {ton ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
                  </button>
                )}
                <button type="button" className="icon-btn !size-9" onClick={neu} aria-label="Neues Gespräch" title="Neues Gespräch">
                  <RotateCcw className="size-[17px]" />
                </button>
                <button type="button" className="icon-btn !size-9" onClick={schliesseAssistent} aria-label="Assistent schließen">
                  <X className="size-[18px]" />
                </button>
              </header>

              {/* Verlauf */}
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {msgs.length === 0 ? (
                  <div className="flex h-full flex-col">
                    <div className="flex flex-col items-center pt-4 text-center">
                      <ApexOrb size={96} zustand={zustand} pegel={pegel} />
                      <div className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">{begruessung} – wie kann ich helfen?</div>
                      <p className="mt-1.5 max-w-[30ch] text-[13px] leading-snug text-fg-3">Fragen Sie {spracheingabeVerfuegbar() ? "per Sprache oder Text" : "per Text"} – zu Ihren Akten, Fristen oder zur Bedienung von AnwaltApex.</p>
                    </div>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {chips.map((v, i) => (
                        <motion.button
                          key={v}
                          type="button"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + i * 0.04 }}
                          onClick={() => void senden(v)}
                          className="rounded-full bg-[var(--ink-softer)] px-3 py-1.5 text-[12.5px] text-fg-2 ring-1 ring-[var(--line)] transition-colors hover:bg-ink-soft hover:text-fg"
                        >
                          {v}
                        </motion.button>
                      ))}
                    </div>
                    <div className="mt-auto pt-6">
                      <button
                        type="button"
                        onClick={() => void senden(ansprechBitte(ap))}
                        className="flex w-full items-center gap-3 rounded-[18px] p-3 text-left ring-1 ring-[var(--line)] transition-colors hover:bg-ink-softer"
                      >
                        <span className="grid size-9 place-items-center rounded-full bg-green-soft text-green">
                          <Phone className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold">Lieber mit einem Menschen sprechen?</span>
                          <span className="block truncate text-[13px] text-fg-3">
                            {sitzung.tenant.ansprechpartner.name} · {sitzung.tenant.ansprechpartner.telefon}
                          </span>
                          <span className="block text-[12.5px] text-fg-3">Rückruf {RUECKRUF_SIMULIERT}</span>
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {msgs.map((m) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className={cn("flex", m.rolle === "nutzer" ? "justify-end" : "justify-start")}>
                        {m.rolle === "nutzer" ? (
                          <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-ink px-3.5 py-2 text-[13.5px] leading-snug text-white">{m.text}</div>
                        ) : (
                          <div className="max-w-[92%]">
                            {m.werkzeuge && m.werkzeuge.length > 0 && (
                              <div className="mb-1.5 flex flex-wrap gap-1">
                                {m.werkzeuge.map((w) => (
                                  <motion.span key={w} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2 py-0.5 text-[12.5px] font-medium text-violet">
                                    <Wrench className="size-3" />
                                    {w}
                                  </motion.span>
                                ))}
                              </div>
                            )}
                            <div className={cn("rounded-[20px] rounded-bl-[6px] px-3.5 py-2.5 text-[13.5px] leading-relaxed", m.fehler ? "bg-seal-soft text-seal" : "bg-[var(--surface)] text-fg ring-1 ring-[var(--line)]")}>
                              {m.laedt && !m.text ? <Tippen /> : <Rich text={m.text} />}
                            </div>
                            {m.auswahl && m.auswahl.length > 0 && (
                              <div className="mt-2 grid gap-1.5" role="group" aria-label="Bitte wählen Sie">
                                {m.auswahl.map((a) => (
                                  <button
                                    key={a.frage}
                                    type="button"
                                    disabled={beschaeftigt}
                                    onClick={() => void senden(a.frage)}
                                    className="flex items-center gap-2.5 rounded-[14px] bg-[var(--surface)] px-3 py-2 text-left ring-1 ring-[var(--line)] transition-colors hover:bg-ink-softer disabled:opacity-50"
                                  >
                                    <FolderOpen className="size-4 shrink-0 text-ink" />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[13px] font-medium">{a.label}</span>
                                      {a.sub && <span className="block truncate text-[12.5px] text-fg-3">{a.sub}</span>}
                                    </span>
                                    <ArrowRight className="size-3.5 shrink-0 text-fg-3" />
                                  </button>
                                ))}
                              </div>
                            )}
                            {m.vorschlag && m.karte && (
                              <BestaetigungsKarte
                                v={m.vorschlag}
                                status={m.karte.status}
                                land={sitzung.tenant.bundesland}
                                onEintragen={(v) => eintragen(m, v)}
                                onVerwerfen={() => setKarte(m.id, { status: "verworfen" })}
                                onRueckgaengig={() => zuruecknehmen(m)}
                              />
                            )}
                            {m.links && m.links.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {m.links.map((l) => (
                                  <button
                                    key={l.to}
                                    type="button"
                                    onClick={() => {
                                      nav(l.to);
                                      if (mobile) schliesseAssistent();
                                    }}
                                    className="inline-flex items-center gap-1 rounded-full bg-ink-soft px-2.5 py-1 text-[12.5px] font-medium text-ink transition-colors hover:bg-[var(--ink)] hover:text-white"
                                  >
                                    {l.label}
                                    <ArrowRight className="size-3" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Zuhören */}
              <AnimatePresence>
                {zustand === "hoert" && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="mx-4 mb-2 flex items-center gap-3 rounded-[18px] bg-[var(--ink-softer)] p-3 ring-1 ring-[var(--line)]">
                    <Wellen />
                    <div className="min-w-0 flex-1 text-[13px] text-fg-2">{interim || "Ich höre zu – sprechen Sie einfach."}</div>
                  </motion.div>
                )}
              </AnimatePresence>
              {hinweis && (
                <div role="status" className="mx-4 mb-2 rounded-[14px] bg-amber-soft px-3 py-2 text-[13px] text-fg-2">
                  {hinweis}
                </div>
              )}

              {/* Eingabe */}
              <form
                className="flex items-end gap-2 border-t border-[var(--line)] p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void senden(eingabe);
                }}
              >
                {spracheingabeVerfuegbar() && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={mikrofon}
                    className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-colors", zustand === "hoert" ? "bg-seal text-white" : "bg-[var(--ink-softer)] text-fg-2 hover:bg-ink-soft hover:text-ink")}
                    aria-label={zustand === "hoert" ? "Zuhören beenden" : "Per Sprache fragen"}
                    title={zustand === "hoert" ? "Zuhören beenden" : "Per Sprache fragen"}
                  >
                    {zustand === "hoert" ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </motion.button>
                )}
                <textarea
                  id="assistent-eingabe"
                  ref={inputRef}
                  rows={1}
                  value={eingabe}
                  onChange={(e) => setEingabe(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void senden(eingabe);
                    }
                  }}
                  placeholder="Frage oder Auftrag …"
                  className="field max-h-28 min-h-11 flex-1 resize-none !rounded-[22px] !py-2.5"
                />
                {beschaeftigt ? (
                  <button type="button" onClick={() => ctl.current?.abort()} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--line-strong)] text-fg" aria-label="Antwort stoppen">
                    <Square className="size-4" />
                  </button>
                ) : (
                  <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!eingabe.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white transition-opacity disabled:opacity-35" aria-label="Senden">
                    <ArrowUp className="size-5" />
                  </motion.button>
                )}
              </form>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Tippen() {
  return (
    <span className="flex h-5 items-center gap-1" aria-label="Antwort wird erstellt">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="size-1.5 rounded-full bg-fg-3" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

function Wellen() {
  return (
    <span className="flex h-6 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.span key={i} className="w-[3px] rounded-full bg-seal" animate={{ height: [5, 18 - (i % 3) * 3, 5] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.09 }} />
      ))}
    </span>
  );
}

/** Minimale Formatierung: **fett**, Aufzählungen, Zeilenumbrüche. */
function Rich({ text }: { text: string }) {
  const zeilen = text.split("\n");
  return (
    <div className="grid gap-1">
      {zeilen.map((z, i) => {
        const istPunkt = /^\s*([•\-*]|\d+\.)\s+/.test(z);
        const inhalt = z.replace(/^\s*([•\-*]|\d+\.)\s+/, "");
        const teile = inhalt.split(/(\*\*[^*]+\*\*)/g).map((t, k) => (t.startsWith("**") ? <strong key={k} className="font-semibold">{t.slice(2, -2)}</strong> : <span key={k}>{t}</span>));
        if (!z.trim()) return <div key={i} className="h-1" />;
        return istPunkt ? (
          <div key={i} className="flex gap-2">
            <span className="mt-[9px] size-1 shrink-0 rounded-full bg-fg-3" />
            <span>{teile}</span>
          </div>
        ) : (
          <p key={i}>{teile}</p>
        );
      })}
    </div>
  );
}

/**
 * Bestätigungskarte für schreibende Aktionen des Assistenten: Akte, Titel, Datum mit Wochentag (bei Wochenende/Feiertag mit
 * Vorschlag des nächsten Werktags) – „Eintragen“, „Ändern“, „Verwerfen“. Nach dem Eintragen: „Rückgängig“.
 */
function BestaetigungsKarte({ v, status, land, onEintragen, onVerwerfen, onRueckgaengig }: {
  v: SchreibVorschlag;
  status: "offen" | "eingetragen" | "verworfen" | "zurueckgenommen";
  land: import("@/core/types").Bundesland;
  onEintragen: (v: SchreibVorschlag) => void;
  onVerwerfen: () => void;
  onRueckgaengig: () => void;
}) {
  const [aendern, setAendern] = useState(false);
  const [titel, setTitel] = useState(v.art === "notiz" ? v.text ?? "" : v.titel);
  const [datum, setDatum] = useState(v.datum ?? "");
  const notiz = v.art === "notiz";
  const p = !notiz && datum ? pruefeDatum(datum, land) : { werktag: true as const };
  const aktuell: SchreibVorschlag = notiz ? { ...v, text: titel.trim() || v.text } : { ...v, titel: titel.trim() || v.titel, datum };
  const Icon = notiz ? StickyNote : CalendarPlus;
  return (
    <div className="mt-2 overflow-hidden rounded-[18px] bg-[var(--surface)] ring-1 ring-[var(--line-strong)]" role="group" aria-label={`${vorschlagArtName(v)} bestätigen`}>
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px] font-semibold text-ink">
        <Icon className="size-3.5" /> {vorschlagArtName(v)} – {status === "offen" ? "bitte bestätigen" : status === "eingetragen" ? "eingetragen" : status === "verworfen" ? "verworfen" : "rückgängig gemacht"}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
        <dt className="text-fg-3">Akte</dt>
        <dd className="min-w-0 truncate font-medium">
          {v.aktenzeichen} · {v.akteTitel}
        </dd>
        <dt className="text-fg-3">{notiz ? "Text" : "Titel"}</dt>
        <dd className="min-w-0">
          {aendern && status === "offen" ? (
            <input aria-label={notiz ? "Text der Notiz" : "Titel"} value={titel} onChange={(e) => setTitel(e.target.value)} className="field !h-8 w-full !py-1 !text-[13px]" />
          ) : (
            <span className="font-medium">{notiz ? aktuell.text : aktuell.titel}</span>
          )}
        </dd>
        {!notiz && (
          <>
            <dt className="text-fg-3">Datum</dt>
            <dd className="min-w-0">
              {aendern && status === "offen" ? (
                <input type="date" aria-label="Datum" value={datum} onChange={(e) => setDatum(e.target.value)} className="field !h-8 !py-1 !text-[13px]" />
              ) : (
                <span className="font-medium">{datum ? fmtDateWd(datum) : "–"}</span>
              )}
            </dd>
          </>
        )}
      </dl>
      {!p.werktag && "naechster" in p && p.naechster && status === "offen" && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-[12px] bg-amber-soft px-2.5 py-1.5 text-[12.5px] text-fg-2">
          {fmtDateWd(datum)} ist kein Werktag.
          <button type="button" className="font-semibold text-ink underline-offset-2 hover:underline" onClick={() => setDatum(p.naechster!)}>
            Auf {fmtDateWd(p.naechster)} legen
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] px-3 py-2">
        {status === "offen" && (
          <>
            <button type="button" onClick={() => onEintragen(aktuell)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[13px] font-semibold text-white hover:opacity-90">
              <Check className="size-3.5" /> Eintragen
            </button>
            <button type="button" onClick={() => setAendern((x) => !x)} aria-pressed={aendern} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-2 ring-1 ring-[var(--line-strong)] hover:bg-ink-softer">
              <Pencil className="size-3.5" /> {aendern ? "Fertig" : "Ändern"}
            </button>
            <button type="button" onClick={onVerwerfen} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-3 hover:bg-ink-softer hover:text-fg">
              <X className="size-3.5" /> Verwerfen
            </button>
          </>
        )}
        {status === "eingetragen" && (
          <>
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
              <Check className="size-3.5" /> {notiz ? "In der Akte gespeichert" : "Im Fristenkalender"}
            </span>
            <button type="button" onClick={onRueckgaengig} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink ring-1 ring-[var(--line-strong)] hover:bg-ink-softer">
              <Undo2 className="size-3.5" /> Rückgängig
            </button>
          </>
        )}
        {status === "verworfen" && <span className="text-[13px] text-fg-3">Nichts eingetragen.</span>}
        {status === "zurueckgenommen" && <span className="text-[13px] text-fg-3">Wieder entfernt – im Protokoll vermerkt.</span>}
      </div>
    </div>
  );
}

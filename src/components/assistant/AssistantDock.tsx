import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Mic, MicOff, Volume2, VolumeX, X, RotateCcw, Square, Phone, Wrench, ArrowRight } from "lucide-react";
import { useUI } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { ansprechBitte, frageAssistent, vorschlaege, type AssistentLink } from "@/ai/assistent";
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
}

let mid = 0;

/** Apex Assistent: sprechender KI-Avatar für Live-Support und Kanzleiarbeit (unten rechts). */
export function AssistantDock() {
  const { assistentOffen, oeffneAssistent, schliesseAssistent, konsumierePrompt, assistentPrompt } = useUI();
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
        setMsgs((m) => m.map((x) => (x.id === antwortId ? { ...x, text: r.text, links: r.links, werkzeuge: r.werkzeuge, laedt: false } : x)));
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

  const vorname = sitzung.user.name.replace(/^(Dr\.|Prof\.)\s+/, "").split(" ")[0];
  const statusText = zustand === "hoert" ? "Ich höre zu …" : zustand === "denkt" ? "Denkt nach …" : zustand === "spricht" ? "Spricht …" : ai.quelle === "demo" ? DEMO_KI_NAME : "Live · Claude";

  return (
    <>
      {/* Avatar-Knopf */}
      <AnimatePresence>
        {!assistentOffen && (
          <motion.button
            type="button"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            onClick={() => oeffneAssistent()}
            className="group fixed z-50 grid place-items-center rounded-full bottom-[calc(88px+env(safe-area-inset-bottom))] right-[max(16px,env(safe-area-inset-right))] md:bottom-6 md:right-6"
            aria-label="Apex Assistent öffnen – per Sprache oder Text fragen"
            title="Apex Assistent – fragen Sie per Sprache oder Text"
          >
            <ApexOrb size={mobile ? 54 : 60} />
            <span className="pointer-events-none absolute right-[calc(100%+10px)] hidden whitespace-nowrap rounded-full bg-[#0b0e18]/90 px-3 py-1.5 text-[12px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 md:block">
              Apex Assistent fragen
            </span>
          </motion.button>
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
                  <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3">
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
                      <div className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">Hallo {vorname}, wie kann ich helfen?</div>
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
                          <span className="block truncate text-[12px] text-fg-3">
                            {sitzung.tenant.ansprechpartner.name} · {sitzung.tenant.ansprechpartner.telefon}
                          </span>
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
                                  <motion.span key={w} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2 py-0.5 text-[11px] font-medium text-violet">
                                    <Wrench className="size-3" />
                                    {w}
                                  </motion.span>
                                ))}
                              </div>
                            )}
                            <div className={cn("rounded-[20px] rounded-bl-[6px] px-3.5 py-2.5 text-[13.5px] leading-relaxed", m.fehler ? "bg-seal-soft text-seal" : "bg-[var(--surface)] text-fg ring-1 ring-[var(--line)]")}>
                              {m.laedt && !m.text ? <Tippen /> : <Rich text={m.text} />}
                            </div>
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
                                    className="inline-flex items-center gap-1 rounded-full bg-ink-soft px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:bg-[var(--ink)] hover:text-white"
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
              {hinweis && <div className="mx-4 mb-2 rounded-[14px] bg-amber-soft px-3 py-2 text-[12px] text-fg-2">{hinweis}</div>}

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

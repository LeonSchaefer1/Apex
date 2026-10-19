import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Mic, MicOff, Volume2, VolumeX, X, RotateCcw, Square, Phone, Wrench, ArrowRight, Check, CalendarPlus, Pencil, Undo2, ChevronRight, FolderOpen, StickyNote, PanelRightClose, AlertTriangle } from "lucide-react";
import { useUI } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { RUECKRUF_ZUSTIMMUNG, ansprechBitte, bietetRueckruf, doppelterEintrag, frageAssistent, pruefeDatum, vorschlaege, vorschlagArtName, vorschlagEintragen, vorschlagZuruecknehmen, type AssistentLink, type AuswahlKnopf, type Eintragung, type SchreibVorschlag } from "@/ai/assistent";
import { fmtDateWd } from "@/core/dates";
import { RUECKRUF_SIMULIERT } from "@/core/rueckruf";
import { gruss } from "@/lib/rollen";
import { toast } from "@/store/ui";
import { useData } from "@/store/data";
import type { LlmMessage } from "@/ai/llm";
import { hoeren, sprechen, spracheingabeVerfuegbar, sprachausgabeVerfuegbar } from "@/lib/speech";
import { useIsMobile } from "@/lib/useMedia";
import { telefonTeile, telHref } from "@/lib/telefon";
import { cn } from "@/lib/cn";
import { ApexOrb, type OrbZustand } from "./ApexOrb";
import { BEWEGUNG } from "@/lib/bewegung";

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

/** Gesprächsverlauf je Kanzlei und Person für diese Browsersitzung (übersteht Neuladen, nicht das Schließen des Tabs). */
const verlaufSchluessel = (tenantId: string, userId: string) => `aa:assistent-verlauf:${tenantId}:${userId}`;
function ladeVerlauf(key: string): Msg[] {
  try {
    const roh = sessionStorage.getItem(key);
    const liste = roh ? (JSON.parse(roh) as Msg[]) : [];
    const ok = Array.isArray(liste) ? liste.filter((m) => m && typeof m.text === "string" && !m.laedt) : [];
    mid = Math.max(mid, ...ok.map((m) => m.id || 0));
    return ok;
  } catch {
    return [];
  }
}
function speichereVerlauf(key: string, msgs: Msg[]) {
  try {
    const fertig = msgs.filter((m) => !m.laedt).slice(-40);
    if (fertig.length) sessionStorage.setItem(key, JSON.stringify(fertig));
    else sessionStorage.removeItem(key);
  } catch {
    /* Speicher gesperrt – Verlauf gilt dann nur bis zum Neuladen */
  }
}

/** Assistent-Knopf: 48 px, 24 px vom Rand (bottom-6 right-6) – bei größerer Schrift per zoom entsprechend größer. */
const KUGEL = 48;
const KUGEL_RAND = 24;
/** Griff der ausgewichenen Kugel: 14 × 56 px am rechten Rand, Grundlage 40 px über dem unteren Rand. */
const GRIFF_BREITE = 14;
const GRIFF_HOEHE = 56;
const GRIFF_UNTEN = 40;

/** Skalierung der Oberfläche durch die Schriftgröße (Einstellungen → Darstellung setzt zoom am Wurzelelement). */
function zoomFaktor(): number {
  const z = parseFloat(getComputedStyle(document.documentElement).zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** Bedienelement, Text, Kennzahl oder Diagramm unter einem Punkt (die Kugel selbst ist dabei durchlässig)? */
function belegtAn(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y);
  if (!el || el === document.documentElement || el === document.body) return false;
  // Diagramme, Verlaufsstreifen und Bilder sind Inhalt – auch ohne Textknoten (z. B. 90-Tage-Verlauf im Systemstatus)
  if (el.closest("svg, canvas, img, [role=img], [role=progressbar], [role=meter]")) return true;
  if (el.closest("a[href], button, input, select, textarea, summary, label, [role=button], [role=link], [role=tab], [role=switch], [role=checkbox], [role=menuitem], [tabindex]:not([tabindex='-1'])")) {
    // große, klickbare Flächen (z. B. eine ganze Karte) zählen nur, wenn dort auch Text steht
    const r = el.closest("a[href], button, [role=button], [role=link]")?.getBoundingClientRect();
    if (!r || r.width * r.height < 60_000) return true;
  }
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const range = doc.caretRangeFromPoint?.(x, y);
  const knoten = range?.startContainer;
  if (!knoten || knoten.nodeType !== Node.TEXT_NODE || !knoten.textContent?.trim()) return false;
  const r = document.createRange();
  r.selectNodeContents(knoten);
  return Array.from(r.getClientRects()).some((b) => x >= b.left - 2 && x <= b.right + 2 && y >= b.top - 2 && y <= b.bottom + 2);
}

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
  const verlaufKey = verlaufSchluessel(sitzung.tenant.id, sitzung.user.id);
  const [msgs, setMsgs] = useState<Msg[]>(() => ladeVerlauf(verlaufKey));
  // Kugel weicht automatisch an den Rand aus, wenn darunter Text oder ein Bedienelement liegt
  const [ausweichen, setAusweichen] = useState(false);
  const kugelRef = useRef<HTMLElement | null>(null);
  const setzeKugelRef = useCallback((el: HTMLElement | null) => {
    kugelRef.current = el;
  }, []);
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

  // Verlauf sitzungsweise merken (je Kanzlei und Person)
  useEffect(() => {
    speichereVerlauf(verlaufKey, msgs);
  }, [msgs, verlaufKey]);
  // Personen- oder Kanzleiwechsel im selben Tab: deren eigenen Verlauf laden
  const letzterKey = useRef(verlaufKey);
  useEffect(() => {
    if (letzterKey.current === verlaufKey) return;
    letzterKey.current = verlaufKey;
    setMsgs(ladeVerlauf(verlaufKey));
  }, [verlaufKey]);

  // Kugel nur zeigen, wo sie nichts verdeckt: liegt unter ihr Text oder ein Bedienelement, weicht sie als Griff an den Rand aus.
  // Liegt auch der Griff über Text, rückt er auf eine freie Höhe (I4-T13-01).
  const kugelSichtbar = !assistentOffen && !mobile && kugel && !kugelEingeklappt;
  const [griffUnten, setGriffUnten] = useState(GRIFF_UNTEN);
  useEffect(() => {
    if (!kugelSichtbar) return;
    let raf = 0;
    const pruefe = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // Tatsächlich gerenderte Größe: Die Schriftgröße (Einstellungen → Darstellung) skaliert die Oberfläche per zoom –
        // bei 125 % ist die Kugel 75 statt 60 px groß und sitzt 30 statt 24 px vom Rand. Geprüft wird die ganze Kreisfläche
        // plus 8 px Sicherheitsabstand, damit auch Zeilenenden, Kennzahlen und Tabellenzellen am Rand erkannt werden.
        const z = zoomFaktor();
        const groesse = KUGEL * z;
        const rand = KUGEL_RAND * z;
        const cx = w - rand - groesse / 2;
        const cy = h - rand - groesse / 2;
        const radius = groesse / 2 + 8;
        const huelle = kugelRef.current;
        const vorher = huelle?.style.pointerEvents ?? "";
        if (huelle) huelle.style.pointerEvents = "none";
        const punkte: [number, number][] = [];
        const schritt = Math.max(6, Math.round(radius / 5));
        for (let dx = -radius; dx <= radius; dx += schritt) for (let dy = -radius; dy <= radius; dy += schritt) if (dx * dx + dy * dy <= radius * radius) punkte.push([cx + dx, cy + dy]);
        for (let a = 0; a < 360; a += 20) punkte.push([cx + Math.cos((a * Math.PI) / 180) * radius, cy + Math.sin((a * Math.PI) / 180) * radius]);
        const frei = (pts: [number, number][]) => !pts.some(([x, y]) => x >= 0 && y >= 0 && x < w && y < h && belegtAn(x, y));
        const belegt = !frei(punkte);
        // Griff (14 × 56 px am rechten Rand): erste freie Höhe ab der Grundlage, sonst die Grundlage
        let unten = GRIFF_UNTEN;
        if (belegt) {
          const gb = GRIFF_BREITE * z + 6;
          const gh = GRIFF_HOEHE * z;
          const griffPunkte = (u: number): [number, number][] => {
            const pts: [number, number][] = [];
            for (let x = w - gb; x < w; x += 4) for (let y = h - u * z - gh - 6; y <= h - u * z + 6; y += 8) pts.push([x, y]);
            return pts;
          };
          const kandidat = [GRIFF_UNTEN, 120, 200, 280, 360, 440].filter((u) => (u * z + gh) < h - 96 * z).find((u) => frei(griffPunkte(u)));
          unten = kandidat ?? GRIFF_UNTEN;
        }
        if (huelle) huelle.style.pointerEvents = vorher;
        setAusweichen(belegt);
        setGriffUnten(unten);
      });
    };
    pruefe();
    // Beim Scrollen gedrosselt prüfen (alle Scroll-Container, z. B. auch Tabellen) und nach dem Ende noch einmal
    let zuletzt = 0;
    let ende: ReturnType<typeof setTimeout> | undefined;
    const beimScrollen = () => {
      const jetzt = performance.now();
      if (jetzt - zuletzt > 120) {
        zuletzt = jetzt;
        pruefe();
      }
      clearTimeout(ende);
      ende = setTimeout(pruefe, 160);
    };
    window.addEventListener("scroll", beimScrollen, { passive: true, capture: true });
    window.addEventListener("resize", pruefe);
    let t: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver(() => {
      clearTimeout(t);
      clearTimeout(t2);
      t = setTimeout(pruefe, 150);
      // Listen gleiten nach einer Änderung animiert nach (z. B. erledigte Frist in der Ausgangskontrolle) – danach erneut prüfen
      t2 = setTimeout(pruefe, 900);
    });
    const main = document.querySelector("main");
    if (main) obs.observe(main, { childList: true, subtree: true, characterData: true });
    // Schriftgröße geändert (data-schrift am Wurzelelement): neu messen
    const wurzel = new MutationObserver(() => pruefe());
    wurzel.observe(document.documentElement, { attributes: true, attributeFilter: ["data-schrift"] });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(ende);
      obs.disconnect();
      wurzel.disconnect();
      window.removeEventListener("scroll", beimScrollen, { capture: true });
      window.removeEventListener("resize", pruefe);
    };
  }, [kugelSichtbar]);

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
        // Jeder Mikrofonfehler (kein Gerät, kein Zugriff, nichts gehört – auch nach dem Start): Pegelzeile sofort weg, Knopf zurück
        // auf „Per Sprache fragen“, Erkennung abgebrochen – Kopf, Zeile und Knopf widersprechen der Meldung nie (I5-T20-01)
        stopHoeren.current?.();
        setInterim("");
        setZustand((z) => (z === "hoert" ? "ruhe" : z));
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
          abschaltbar unter Einstellungen → Darstellung – der Assistent bleibt über Strg+K bzw. das Menü erreichbar.
          Feste Tab-Folge (I4-T07-02): Die Knöpfe stehen am Ende der Seite (nach dem Hauptinhalt) und immer in derselben Reihenfolge –
          „Apex Assistent öffnen“, dann „Assistent-Kugel an den Rand einklappen“ –, ob die Kugel sichtbar oder an den Rand
          ausgewichen ist. Beim Ausweichen bleibt es derselbe Knopf (der Fokus geht nicht verloren). */}
      <AnimatePresence>
        {kugelSichtbar && (
          <motion.div
            ref={setzeKugelRef}
            data-kugel
            data-ausgewichen={ausweichen || undefined}
            key="kugel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BEWEGUNG.standard}
            className={cn("group fixed z-50", ausweichen ? "right-0" : "bottom-6 right-6")}
            style={ausweichen ? { bottom: griffUnten } : undefined}
          >
            <button
              type="button"
              onClick={() => oeffneAssistent()}
              className={cn(
                ausweichen
                  ? "block h-14 w-3.5 rounded-l-md bg-[var(--ink)] shadow-pop transition-[width] duration-100 hover:w-5 focus-visible:w-5"
                  : "grid place-items-center rounded-full [&>div]:transition-colors [&>div]:duration-100 hover:[&>div]:bg-[var(--ink-hover)]",
              )}
              aria-label={ausweichen ? "Apex Assistent öffnen (Kugel ist an den Rand ausgewichen, damit sie nichts verdeckt)" : "Apex Assistent öffnen – per Sprache oder Text fragen"}
              title={ausweichen ? "Apex Assistent öffnen" : "Apex Assistent – fragen Sie per Sprache oder Text"}
            >
              {!ausweichen && <ApexOrb size={KUGEL} />}
            </button>
            <button
              type="button"
              onClick={() => setKugelEingeklappt(true)}
              className={cn(
                "absolute grid size-6 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-pop)] text-fg-2 opacity-0 transition-opacity duration-100 hover:text-fg focus-visible:opacity-100",
                // ausgewichen: nur bei Tastaturfokus sichtbar und klickbar – verdeckt sonst nichts am Rand
                ausweichen ? "pointer-events-none right-[calc(100%+6px)] top-1/2 -translate-y-1/2 focus-visible:pointer-events-auto" : "-left-2 -top-2 group-hover:opacity-100",
              )}
              aria-label="Assistent-Kugel an den Rand einklappen"
              title="An den Rand einklappen"
            >
              <ChevronRight className="size-3.5" />
            </button>
            {!ausweichen && (
              <span className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-[var(--fg)] px-2 py-1 text-[12px] font-medium leading-4 text-[var(--bg)] opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Apex Assistent fragen
              </span>
            )}
          </motion.div>
        )}
        {!assistentOffen && !mobile && kugel && kugelEingeklappt && (
          <motion.button
            key="griff"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BEWEGUNG.standard}
            onClick={() => setKugelEingeklappt(false)}
            className="fixed bottom-10 right-0 z-50 h-14 w-3.5 rounded-l-md bg-[var(--ink)] shadow-pop transition-[width] duration-100 hover:w-5 focus-visible:w-5"
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: BEWEGUNG.dialog }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15, ease: [0.2, 0, 0, 1] } }}
              className={cn(
                "fixed z-[85] flex flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface-pop)] shadow-modal",
                mobile ? "inset-x-0 bottom-0 top-[max(12px,env(safe-area-inset-top))] rounded-t-xl border-b-0" : "bottom-6 right-6 h-[min(700px,calc(100vh-48px))] w-[400px] rounded-xl",
              )}
            >
              {/* Kopf */}
              <header className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 pl-4 pr-2">
                <ApexOrb size={32} zustand={zustand} pegel={pegel} className="!shadow-none" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-5 tracking-[-0.005em]">Apex Assistent</div>
                  <div className="flex items-center gap-1.5 text-[12px] leading-4 text-fg-4">
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
                {!mobile && kugel && (
                  <button
                    type="button"
                    className="icon-btn !size-9"
                    onClick={() => {
                      setKugelEingeklappt(true);
                      schliesseAssistent();
                    }}
                    aria-label="Assistent-Kugel an den Rand einklappen"
                    title="Kugel an den Rand einklappen – wieder einblenden über den Griff am rechten Rand"
                  >
                    <PanelRightClose className="size-[17px]" />
                  </button>
                )}
                <button type="button" className="icon-btn !size-9" onClick={schliesseAssistent} aria-label="Assistent schließen">
                  <X className="size-[18px]" />
                </button>
              </header>

              {/* Verlauf */}
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {msgs.length === 0 ? (
                  <div className="flex h-full flex-col">
                    <div className="flex flex-col items-center pt-4 text-center">
                      <ApexOrb size={56} zustand={zustand} pegel={pegel} className="!shadow-none" />
                      <div className="title-lg mt-4">{begruessung} – wie kann ich helfen?</div>
                      <p className="mt-1 max-w-[32ch] text-[13px] leading-[18px] text-fg-3">Fragen Sie {spracheingabeVerfuegbar() ? "per Sprache oder Text" : "per Text"} – zu Ihren Akten, Fristen oder zur Bedienung von Apex.</p>
                    </div>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {chips.map((v, i) => (
                        <motion.button
                          key={v}
                          type="button"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.16, delay: i * 0 }}
                          onClick={() => void senden(v)}
                          className="min-h-8 rounded-md border border-[var(--line-strong)] bg-[var(--surface-pop)] px-2.5 py-1 text-[13px] text-fg-2 transition-colors duration-100 hover:bg-[var(--surface-pop-hover)] hover:text-fg"
                        >
                          {v}
                        </motion.button>
                      ))}
                    </div>
                    <div className="mt-auto pt-6">
                      <div className="rounded-lg border border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => void senden(ansprechBitte(ap))}
                          className="flex w-full items-center gap-3 rounded-t-lg p-3 pb-1.5 text-left transition-colors duration-100 hover:bg-[var(--surface-pop-hover)]"
                        >
                          <span className="grid size-9 place-items-center text-fg-3">
                            <Phone className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold">Lieber mit einem Menschen sprechen?</span>
                            <span className="block truncate text-[13px] text-fg-3">{ap.name}</span>
                            <span className="block text-[12.5px] text-fg-3">Rückruf {RUECKRUF_SIMULIERT}</span>
                          </span>
                        </button>
                        {/* Durchwahl antippbar (tel:) – eigener Link, nicht im Knopf verschachtelt (I3-T12-01) */}
                        <div className="flex items-center gap-2 px-3 pb-2.5 pl-[60px] text-[13px]">
                          <span className="text-fg-3">Durchwahl</span>
                          <a href={telHref(ap.telefon)} className="link inline-flex min-h-[32px] items-center font-medium" aria-label={`${ap.name} anrufen: ${ap.telefon}`}>
                            {ap.telefon}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    {msgs.map((m, mi) => (
                      <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={BEWEGUNG.standard} className={cn("flex min-w-0", m.rolle === "nutzer" ? "justify-end" : "justify-start")}>
                        {m.rolle === "nutzer" ? (
                          <div className="min-w-0 max-w-[85%] rounded-lg bg-[var(--surface-pop-hover)] px-3 py-2 text-[14px] leading-5 text-fg [overflow-wrap:anywhere]">{m.text}</div>
                        ) : (
                          <div className="min-w-0 max-w-[92%] [overflow-wrap:anywhere]">
                            {m.werkzeuge && m.werkzeuge.length > 0 && (
                              <div className="mb-1.5 flex flex-wrap gap-1">
                                {m.werkzeuge.map((w) => (
                                  <motion.span key={w} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chip chip-outline">
                                    <Wrench className="size-3" />
                                    {w}
                                  </motion.span>
                                ))}
                              </div>
                            )}
                            <div className={cn("text-[14px] leading-[22px]", m.fehler ? "rounded-md bg-seal-soft px-3 py-2 text-seal-text" : "text-fg-2")}>
                              {m.laedt && !m.text ? <Tippen /> : <Rich text={m.text} />}
                            </div>
                            {m.auswahl && m.auswahl.length > 0 && (
                              <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-1.5" role="group" aria-label="Bitte wählen Sie">
                                {m.auswahl.map((a) => (
                                  <button
                                    key={a.frage}
                                    type="button"
                                    disabled={beschaeftigt}
                                    onClick={() => void senden(a.frage)}
                                    className="flex items-center gap-2.5 rounded-md border border-[var(--line)] bg-[var(--surface-pop)] px-3 py-2 text-left transition-colors duration-100 hover:bg-[var(--surface-pop-hover)] disabled:opacity-50"
                                  >
                                    <FolderOpen className="size-4 shrink-0 text-fg-4" />
                                    <span className="min-w-0 flex-1">
                                      <span className="line-clamp-2 block text-[13px] font-medium leading-snug">{a.label}</span>
                                      {a.sub && <span className="line-clamp-2 block text-[12.5px] leading-snug text-fg-3">{a.sub}</span>}
                                    </span>
                                    <ArrowRight className="size-3.5 shrink-0 text-fg-3" />
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* „Soll ich einen Rückruf … anfordern?“ – Knopf wirkt wie „Ja, bitte.“; getipptes „Ja“ bleibt möglich (I5-T20-02) */}
                            {mi === msgs.length - 1 && !m.laedt && !m.fehler && bietetRueckruf(m.text) && (
                              <button
                                type="button"
                                disabled={beschaeftigt}
                                onClick={() => void senden(RUECKRUF_ZUSTIMMUNG)}
                                className="mt-2 flex min-h-[44px] w-full items-center gap-2.5 rounded-md border border-[var(--line)] bg-[var(--surface-pop)] px-3 py-2 text-left transition-colors duration-100 hover:bg-[var(--surface-pop-hover)] disabled:opacity-50"
                              >
                                <span className="grid size-8 shrink-0 place-items-center text-fg-3">
                                  <Phone className="size-4" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-semibold">Rückruf anfordern</span>
                                  <span className="block text-[12.5px] leading-snug text-fg-3">
                                    {ap.name} {RUECKRUF_SIMULIERT}
                                  </span>
                                </span>
                                <ArrowRight className="size-3.5 shrink-0 text-fg-3" aria-hidden />
                              </button>
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
                                    className="inline-flex min-h-7 items-center gap-1 rounded-md border border-[var(--line-strong)] px-2 py-0.5 text-[13px] font-medium text-fg-2 transition-colors duration-100 hover:bg-[var(--surface-pop-hover)] hover:text-fg"
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

              {/* Zuhören – bei einem Mikrofonfehler sofort weg, nie zugleich mit der Meldung (I5-T20-01): Mit der Meldung wird die
                  ganze Animationsgruppe ausgehängt – die Pegelzeile verschwindet im selben Schritt, ohne Ausblendanimation. */}
              {!hinweis && (
                <AnimatePresence>
                  {zustand === "hoert" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-pop-hover)] p-3">
                      <Wellen />
                      <div className="min-w-0 flex-1 text-[13px] text-fg-2">{interim || "Ich höre zu – sprechen Sie einfach."}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
              {hinweis && (
                <div role="status" className="mx-4 mb-2 rounded-md bg-amber-soft px-3 py-2 text-[13px] text-fg-2">
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
                  <button
                    type="button"
                    onClick={mikrofon}
                    className={cn("relative grid size-11 shrink-0 place-items-center rounded-md transition-colors duration-100", zustand === "hoert" ? "bg-[var(--seal-soft)] text-seal-text shadow-[inset_0_0_0_1px_var(--seal)]" : "bg-[var(--surface-pop)] text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-[var(--surface-pop-hover)] hover:text-fg")}
                    aria-label={zustand === "hoert" ? "Zuhören beenden" : "Per Sprache fragen"}
                    title={zustand === "hoert" ? "Zuhören beenden" : "Per Sprache fragen"}
                  >
                    {zustand === "hoert" ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    {zustand === "hoert" && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--seal)]" aria-hidden />}
                  </button>
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
                  className="field max-h-28 min-h-11 flex-1 resize-none !py-2.5 !text-[14px] max-sm:!text-[16px]"
                />
                {beschaeftigt ? (
                  <button type="button" onClick={() => ctl.current?.abort()} className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--surface-pop)] text-fg shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-[var(--surface-pop-hover)]" aria-label="Antwort stoppen">
                    <Square className="size-4" />
                  </button>
                ) : (
                  <button type="submit" disabled={!eingabe.trim()} className="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--ink)] text-[var(--on-ink)] transition-colors duration-100 hover:bg-[var(--ink-hover)] disabled:bg-transparent disabled:text-fg-4 disabled:shadow-[inset_0_0_0_1px_var(--line-strong)]" aria-label="Senden">
                    <ArrowUp className="size-5" />
                  </button>
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
        <motion.span key={i} className="size-1.5 rounded-full bg-fg-3" animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }} />
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
        // **fett** und Telefonnummern als antippbare Links (tel:) – z. B. die Durchwahl der Ansprechpartnerin (I3-T12-01)
        const mitTel = (t: string, k: number) =>
          telefonTeile(t).map((x, j) =>
            x.tel ? (
              <a key={`${k}-${j}`} href={x.tel} className="link whitespace-nowrap font-medium" aria-label={`${x.t} anrufen`}>
                {x.t}
              </a>
            ) : (
              <span key={`${k}-${j}`}>{x.t}</span>
            ),
          );
        const teile = inhalt.split(/(\*\*[^*]+\*\*)/g).map((t, k) => (t.startsWith("**") ? <strong key={k} className="font-semibold">{mitTel(t.slice(2, -2), k)}</strong> : <span key={k}>{mitTel(t, k)}</span>));
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
  // Doppelungsprüfung (I4-T20-01) – live, auch nach „Ändern“ des Datums: gleicher Tag, gleiche Art, offen
  const fristen = useData((st) => st.data.fristen);
  const doppelt = status === "offen" ? doppelterEintrag(aktuell, fristen) : undefined;
  const Icon = notiz ? StickyNote : CalendarPlus;
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-pop)]" role="group" aria-label={`${vorschlagArtName(v)} bestätigen`}>
      <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-[13px] font-medium text-fg">
        <Icon className="size-3.5 text-fg-4" /> {vorschlagArtName(v)} – {status === "offen" ? "bitte bestätigen" : status === "eingetragen" ? "eingetragen" : status === "verworfen" ? "verworfen" : "rückgängig gemacht"}
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
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-md bg-amber-soft px-2.5 py-1.5 text-[13px] text-fg-2">
          {fmtDateWd(datum)} ist kein Werktag.
          <button type="button" className="link font-medium" onClick={() => setDatum(p.naechster!)}>
            Auf {fmtDateWd(p.naechster)} legen
          </button>
        </div>
      )}
      {doppelt && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-md bg-amber-soft px-2.5 py-1.5 text-[13px] leading-snug text-fg-2" role="note">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" aria-hidden />
          <span>
            <span className="font-semibold text-fg">Doppelung? </span>
            {doppelt.hinweis}. Eintragen nur, wenn Sie bewusst einen zweiten Eintrag möchten.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] px-3 py-2">
        {status === "offen" && (
          <>
            {doppelt ? (
              <button type="button" onClick={() => onEintragen(aktuell)} className="btn btn-secondary btn-sm !text-[var(--amber-text)]">
                <AlertTriangle className="size-3.5" /> Trotzdem eintragen
              </button>
            ) : (
              <button type="button" onClick={() => onEintragen(aktuell)} className="btn btn-primary btn-sm">
                <Check className="size-3.5" /> Eintragen
              </button>
            )}
            <button type="button" onClick={() => setAendern((x) => !x)} aria-pressed={aendern} className="btn btn-secondary btn-sm">
              <Pencil className="size-3.5" /> {aendern ? "Fertig" : "Ändern"}
            </button>
            <button type="button" onClick={onVerwerfen} className="btn btn-ghost btn-sm">
              <X className="size-3.5" /> Verwerfen
            </button>
          </>
        )}
        {status === "eingetragen" && (
          <>
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green-text">
              <Check className="size-3.5" /> {notiz ? "In der Akte gespeichert" : "Im Fristenkalender"}
            </span>
            <button type="button" onClick={onRueckgaengig} className="btn btn-secondary btn-sm ml-auto">
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

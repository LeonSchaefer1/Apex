import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarClock, FolderInput, Inbox, MailOpen, Sparkles } from "lucide-react";
import { normalize } from "@/core/search";
import type { Akte, Nachricht } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { useMedia } from "@/lib/useMedia";
import { einzeltasteErlaubt } from "@/lib/tastatur";
import { cn } from "@/lib/cn";
import { Button, Card, PageHeader, SearchField, Segmented } from "@/components/ui";
import { NachrichtenListe } from "./NachrichtenListe";
import { Lesebereich } from "./Lesebereich";
import { Verbindungsstatus } from "./Verbindungsstatus";
import { analyseSchluessel, ersteOeffnungMerken, kiAnsicht, starteAnalyse, useAnalyse, useAnalyseStand } from "./analyse";
import { BEWEGUNG } from "@/lib/bewegung";

type Filter = "alle" | "neu" | "bea" | "email" | "ohne";

const FILTER: { value: Filter; label: string; test: (n: Nachricht) => boolean }[] = [
  { value: "alle", label: "Alle", test: () => true },
  { value: "neu", label: "Neu", test: (n) => n.status === "neu" },
  { value: "bea", label: "beA", test: (n) => n.kanal === "bea" },
  { value: "email", label: "E-Mail", test: (n) => n.kanal === "email" },
  { value: "ohne", label: "Ohne Akte", test: (n) => !n.akteId },
];

/** Füllt auf großen Bildschirmen die restliche Fensterhöhe (zweispaltiges Postfach wie in „Mail“). */
function useFuellHoehe(aktiv: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoehe, setHoehe] = useState<number>();
  useLayoutEffect(() => {
    if (!aktiv) {
      setHoehe(undefined);
      return;
    }
    const messen = () => {
      const el = ref.current;
      if (!el) return;
      const scroller = document.getElementById("haupt-scroll");
      const top = el.getBoundingClientRect().top + (scroller?.scrollTop ?? 0) - (scroller?.getBoundingClientRect().top ?? 0);
      setHoehe(Math.max(560, (scroller?.clientHeight ?? window.innerHeight) - top - 28));
    };
    messen();
    const t = setTimeout(messen, 420);
    window.addEventListener("resize", messen);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", messen);
    };
  }, [aktiv]);
  return { ref, hoehe };
}

export default function Posteingang() {
  const { tenant, user } = useKanzlei();
  const nachrichten = useCol("nachrichten");
  const aktenListe = useCol("akten");
  const data = useData((s) => s.data);
  const epoch = useData((s) => s.epoch);
  const { laufend, ergebnisse, fehler } = useAnalyseStand();
  const stapelTimer = useRef<number[]>([]);
  const [params, setParams] = useSearchParams();
  const selId = params.get("id");
  const [filter, setFilter] = useState<Filter>("alle");
  const [q, setQ] = useState("");
  const zweispaltig = useMedia("(min-width: 1280px)");
  const schmal = useMedia("(max-width: 520px)");
  const { ref: fuellRef, hoehe } = useFuellHoehe(zweispaltig);
  const scrollRef = useRef<HTMLDivElement>(null);

  const akten = useMemo(() => new Map<string, Akte>(aktenListe.map((a) => [a.id, a])), [aktenListe]);
  const eingang = useMemo(() => nachrichten.filter((n) => n.richtung === "ein").sort((a, b) => b.eingang.localeCompare(a.eingang)), [nachrichten]);
  const sel = selId ? eingang.find((n) => n.id === selId) : undefined;

  const zaehler = useMemo(() => Object.fromEntries(FILTER.map((f) => [f.value, eingang.filter(f.test).length])) as Record<Filter, number>, [eingang]);

  const sichtbar = useMemo(() => {
    const f = FILTER.find((x) => x.value === filter)!;
    const nq = normalize(q.trim());
    return eingang.filter((n) => {
      if (n.id === selId) return true; // geöffnete Nachricht bleibt sichtbar, auch wenn sie nicht mehr „neu“ ist
      if (!f.test(n)) return false;
      if (!nq) return true;
      const az = n.akteId ? akten.get(n.akteId)?.aktenzeichen ?? "" : "";
      return normalize(`${n.von} ${n.betreff} ${n.text} ${az}`).includes(nq);
    });
  }, [eingang, filter, q, selId, akten]);

  const oeffnen = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set("id", id);
      else next.delete("id");
      setParams(next, { replace: zweispaltig || !id });
      if (!zweispaltig) document.getElementById("haupt-scroll")?.scrollTo({ top: 0 });
    },
    [params, setParams, zweispaltig],
  );

  // Geöffnete Nachricht als gelesen markieren – automatischer Schreibvorgang: zählt nicht als Änderung durch die Kanzlei
  // (Beispieldaten werden weiter täglich neu erzeugt).
  useEffect(() => {
    if (sel?.status === "neu") useData.getState().patch("nachrichten", sel.id, { status: "gelesen" }, { system: true });
  }, [sel?.id, sel?.status]);

  // eEB-Protokoll: erster Lesezeitpunkt und Person – nur beim allerersten Öffnen (später nie überschrieben)
  useEffect(() => {
    if (sel && !sel.geoeffnetAm) ersteOeffnungMerken(sel, user);
  }, [sel?.id, sel?.geoeffnetAm, user.id]);

  // Analyse automatisch starten, sobald eine unbearbeitete Nachricht geöffnet wird – auch nach einem Datenwechsel (Reset, Kanzleiwechsel)
  useEffect(() => {
    if (!sel) return;
    const st = useAnalyse.getState();
    const aktuell = st.schluessel === analyseSchluessel();
    if ((sel.kiStatus === "ausstehend" || !sel.ki) && (!aktuell || (st.laufend[sel.id] === undefined && !st.ergebnisse[sel.id] && !st.fehler[sel.id]))) void starteAnalyse(sel, tenant.bundesland);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [sel?.id, epoch, tenant.id]);

  // Zeitversetzte Stapel-Analysen beim Verlassen verwerfen
  useEffect(() => () => stapelTimer.current.forEach((t) => clearTimeout(t)), []);

  // Vorausgewählte Nachricht (?id=) in der Liste sichtbar machen
  useEffect(() => {
    if (!zweispaltig || !selId) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-nachricht="${CSS.escape(selId)}"]`);
      const box = el?.closest<HTMLElement>("[data-listscroll]");
      if (!el || !box) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) box.scrollTo({ top: box.scrollTop + r.top - b.top - 72, behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  }, [selId, zweispaltig]);

  const ansicht = useMemo(() => (sel ? kiAnsicht(sel, data, tenant.bundesland, ergebnisse[sel.id]) : null), [sel, data, tenant.bundesland, ergebnisse]);

  // Einzeltasten-Kürzel (abschaltbar, WCAG 2.1.4): J/K nächste bzw. vorige Nachricht, U „Vorschlag übernehmen“ (Fristen samt
  // Akte bzw. ohne Fristvorschlag die Akte zuordnen), E eEB-Dialog. Die Aktionen lösen genau die sichtbaren Knöpfe aus
  // (data-kuerzel) – gesperrte Knöpfe bleiben gesperrt. Bleibt U wirkungslos, sagt eine Meldung warum (I5-T22-01).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!einzeltasteErlaubt(e)) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k") {
        if (!sichtbar.length) return;
        const i = sichtbar.findIndex((n) => n.id === selId);
        const ziel = i < 0 ? sichtbar[0] : sichtbar[k === "j" ? Math.min(sichtbar.length - 1, i + 1) : Math.max(0, i - 1)];
        if (!ziel) return;
        e.preventDefault();
        oeffnen(ziel.id);
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-nachricht="${CSS.escape(ziel.id)}"]`)?.focus({ preventScroll: false }));
      } else if ((k === "u" || k === "e") && selId) {
        const knopf = document.querySelector<HTMLButtonElement>(`[data-kuerzel="${k}"]:not(:disabled)`);
        if (knopf) {
          e.preventDefault();
          knopf.click();
          return;
        }
        if (k !== "u") return;
        e.preventDefault();
        const m = unwirksamesU(selId);
        toast(m.titel, { text: m.text, ton: "info" });
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar, selId, oeffnen, akten]);

  /** Grund, warum U nichts übernimmt: Analyse läuft, Knopf gesperrt (dessen Titel), schon zugeordnet oder keine Akte erkannt. */
  const unwirksamesU = (id: string): { titel: string; text?: string } => {
    if (useAnalyse.getState().laufend[id] !== undefined) return { titel: "Die KI-Analyse läuft noch", text: "Gleich danach übernimmt U den Vorschlag." };
    const gesperrt = document.querySelector<HTMLButtonElement>('[data-kuerzel="u"]:disabled');
    if (gesperrt) return { titel: gesperrt.title || "Der Vorschlag ist noch nicht übernehmbar" };
    const aktuell = useData.getState().data.nachrichten.find((x) => x.id === id);
    const az = aktuell?.akteId ? akten.get(aktuell.akteId)?.aktenzeichen : undefined;
    if (az) return { titel: "Nichts zu übernehmen", text: `Die Nachricht ist bereits ${az} zugeordnet.` };
    return { titel: "Keine Akte erkannt", text: "Bitte eine Akte wählen – dann übernimmt U den Vorschlag." };
  };

  const ausstehend = eingang.filter((n) => n.kiStatus === "ausstehend" || !n.ki);
  const fristenErkannt = eingang.filter((n) => n.ki?.frist && n.kiStatus === "analysiert").length;
  const naechsteNeue = eingang.find((n) => n.status === "neu");

  const alleAnalysieren = () => {
    const schluessel = analyseSchluessel();
    stapelTimer.current = ausstehend.map((n, i) => window.setTimeout(() => void starteAnalyse(n, tenant.bundesland, { schluessel }), i * 260));
  };

  const liste = (
    <Card padded={false} className={cn("flex min-w-0 flex-col overflow-hidden", zweispaltig && "h-full")}>
      <div className="space-y-2.5 border-b border-[var(--line)] p-2.5 sm:p-3">
        {/* Zähler dort, wo sie zum Handeln auffordern (neu, ohne Akte) – auch am Telefon („Neu 5“, „Ohne Akte 5“, I3-T02-02):
            dort waagerecht scrollbar, mit Randabstand, statt Zähler wegzulassen */}
        {schmal ? (
          <div className="-mx-2.5 overflow-x-auto px-2.5 no-scrollbar [scroll-padding-inline:10px]">
            <Segmented<Filter>
              size="sm"
              mobilGross
              className="!max-w-none !overflow-visible"
              options={FILTER.map((f) => ({ value: f.value, label: f.label, count: f.value === "neu" || f.value === "ohne" ? zaehler[f.value] : undefined }))}
              value={filter}
              onChange={setFilter}
            />
          </div>
        ) : (
          <Segmented<Filter>
            size="sm"
            full
            wrap
            options={FILTER.map((f) => ({ value: f.value, label: f.label, count: f.value === "neu" || f.value === "ohne" ? zaehler[f.value] : undefined }))}
            value={filter}
            onChange={setFilter}
          />
        )}
        <SearchField id="posteingang-suche" value={q} onChange={setQ} placeholder="Absender, Betreff, Aktenzeichen …" />
      </div>
      <div data-listscroll className={cn("min-h-0 flex-1", zweispaltig && "overflow-y-auto")}>
        <NachrichtenListe items={sichtbar} selectedId={selId} onSelect={oeffnen} akten={akten} laufend={laufend} q={q} gefiltert={filter !== "alle" || !!q.trim()} />
      </div>
      <div className="border-t border-[var(--line)] px-4 py-2.5 text-[13px] text-fg-3">
        {eingang.length} Nachrichten · {zaehler.neu} neu · {ausstehend.length} warten auf KI
        <span id="posteingang-tipp" className="mt-0.5 hidden lg:block">
          <span className="kbd">↑</span> <span className="kbd">↓</span> wählen · <span className="kbd">Enter</span> öffnet · <span className="kbd">J</span>/<span className="kbd">K</span> nächste bzw. vorige
        </span>
      </div>
    </Card>
  );

  const ueberblick = (
    <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
      <MailOpen className="mb-3 size-5 text-fg-4" aria-hidden />
      <div className="title-md">Wählen Sie eine Nachricht</div>
      <p className="mt-1.5 max-w-sm text-[14px] text-fg-3">Die KI-Karte zeigt sofort, zu welcher Akte die Nachricht gehört, was drinsteht und welche Frist läuft.</p>
      <div className="mt-6 grid w-full max-w-md grid-cols-3 divide-x divide-[var(--line)] border-y border-[var(--line)]">
        {[
          { icon: <Inbox className="size-4" />, wert: zaehler.neu, text: "neu" },
          { icon: <Sparkles className="size-4" />, wert: ausstehend.length, text: "warten auf KI" },
          { icon: <CalendarClock className="size-4" />, wert: fristenErkannt, text: "Fristen erkannt" },
        ].map((k) => (
          <div key={k.text} className="px-3 py-3">
            <div className="flex justify-center text-fg-4" aria-hidden>{k.icon}</div>
            <div className="num mt-1.5 text-[24px] font-semibold leading-8 tracking-[-0.02em]">{k.wert}</div>
            <div className="mt-1 text-[13px] text-fg-3">{k.text}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {naechsteNeue && (
          <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => oeffnen(naechsteNeue.id)}>
            Nächste neue Nachricht
          </Button>
        )}
        {ausstehend.length > 0 && (
          <Button variant="ai" icon={<Sparkles className="size-4" />} onClick={alleAnalysieren}>
            Alle {ausstehend.length} mit KI analysieren
          </Button>
        )}
      </div>
      {!naechsteNeue && !ausstehend.length && (
        <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-green">
          <FolderInput className="size-4" />
          Alles zugeordnet – Posteingang aufgeräumt.
        </div>
      )}
    </div>
  );

  const lesen = sel ? (
    <Lesebereich
      n={sel}
      ansicht={ansicht}
      schritt={laufend[sel.id]}
      fehler={fehler[sel.id]}
      onAnalyse={() => void starteAnalyse(sel, tenant.bundesland)}
      onBack={zweispaltig ? undefined : () => oeffnen(null)}
    />
  ) : null;

  // Smartphone/Tablet: Liste → Vollbild-Detail
  if (!zweispaltig && sel) {
    return (
      <motion.div key={sel.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={BEWEGUNG.standard} className="-mx-1">
        <Card padded={false}>{lesen}</Card>
      </motion.div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Posteingang"
        hilfe="posteingang"
        subtitle="beA & E-Mail in einem Postfach – die KI ordnet zu und erkennt Fristen."
        actions={<Verbindungsstatus className="w-full sm:w-auto" />}
      />
      {zweispaltig ? (
        <div ref={fuellRef} className="grid grid-cols-[420px_minmax(0,1fr)] gap-5" style={{ height: hoehe }}>
          {liste}
          <Card padded={false} className="min-w-0 overflow-hidden">
            <div ref={scrollRef} data-lesescroll className="h-full overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={sel?.id ?? "leer"} className="h-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                  {lesen ?? ueberblick}
                </motion.div>
              </AnimatePresence>
            </div>
          </Card>
        </div>
      ) : (
        liste
      )}
    </div>
  );
}

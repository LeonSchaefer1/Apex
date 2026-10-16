import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarClock, FolderInput, Inbox, MailOpen, Sparkles } from "lucide-react";
import { normalize } from "@/core/search";
import type { Akte, Nachricht } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { useMedia } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { Button, Card, PageHeader, SearchField, Segmented } from "@/components/ui";
import { NachrichtenListe } from "./NachrichtenListe";
import { Lesebereich } from "./Lesebereich";
import { Verbindungsstatus } from "./Verbindungsstatus";
import { kiAnsicht, starteAnalyse, useAnalyse } from "./analyse";

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
      setHoehe(Math.max(560, window.innerHeight - top - 28));
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
  const { tenant } = useKanzlei();
  const nachrichten = useCol("nachrichten");
  const aktenListe = useCol("akten");
  const data = useData((s) => s.data);
  const { laufend, ergebnisse, fehler } = useAnalyse();
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

  // Geöffnete Nachricht als gelesen markieren
  useEffect(() => {
    if (sel?.status === "neu") useData.getState().patch("nachrichten", sel.id, { status: "gelesen" });
  }, [sel?.id, sel?.status]);

  // Analyse automatisch starten, sobald eine unbearbeitete Nachricht geöffnet wird
  useEffect(() => {
    if (!sel) return;
    const st = useAnalyse.getState();
    if ((sel.kiStatus === "ausstehend" || !sel.ki) && st.laufend[sel.id] === undefined && !st.ergebnisse[sel.id] && !st.fehler[sel.id]) void starteAnalyse(sel, tenant.bundesland);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [sel?.id]);

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

  const ausstehend = eingang.filter((n) => n.kiStatus === "ausstehend" || !n.ki);
  const fristenErkannt = eingang.filter((n) => n.ki?.frist && n.kiStatus === "analysiert").length;
  const naechsteNeue = eingang.find((n) => n.status === "neu");

  const alleAnalysieren = () => {
    ausstehend.forEach((n, i) => setTimeout(() => void starteAnalyse(n, tenant.bundesland), i * 260));
  };

  const liste = (
    <Card padded={false} className={cn("flex min-w-0 flex-col overflow-hidden", zweispaltig && "h-full")}>
      <div className="space-y-2.5 border-b border-[var(--line)] p-2.5 sm:p-3">
        <Segmented<Filter> size="sm" full options={FILTER.map((f) => ({ value: f.value, label: f.label, count: f.value === "alle" || schmal ? undefined : zaehler[f.value] }))} value={filter} onChange={setFilter} />
        <SearchField id="posteingang-suche" value={q} onChange={setQ} placeholder="Absender, Betreff, Aktenzeichen …" />
      </div>
      <div data-listscroll className={cn("min-h-0 flex-1", zweispaltig && "overflow-y-auto")}>
        <NachrichtenListe items={sichtbar} selectedId={selId} onSelect={oeffnen} akten={akten} laufend={laufend} q={q} gefiltert={filter !== "alle" || !!q.trim()} />
      </div>
      <div className="border-t border-[var(--line)] px-4 py-2.5 text-[11.5px] text-fg-3">
        {eingang.length} Nachrichten · {zaehler.neu} neu · {ausstehend.length} warten auf KI
      </div>
    </Card>
  );

  const ueberblick = (
    <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-[20px] bg-ink-soft text-ink">
        <MailOpen className="size-7" />
      </div>
      <div className="title-lg">Wählen Sie eine Nachricht</div>
      <p className="mt-1.5 max-w-sm text-[13.5px] text-fg-3">Die KI-Karte zeigt sofort, zu welcher Akte die Nachricht gehört, was drinsteht und welche Frist läuft.</p>
      <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-2.5">
        {[
          { icon: <Inbox className="size-4" />, wert: zaehler.neu, text: "neu" },
          { icon: <Sparkles className="size-4" />, wert: ausstehend.length, text: "warten auf KI" },
          { icon: <CalendarClock className="size-4" />, wert: fristenErkannt, text: "Fristen erkannt" },
        ].map((k) => (
          <div key={k.text} className="rounded-[18px] bg-[var(--ink-softer)] p-3 ring-1 ring-inset ring-[var(--line)]">
            <div className="flex justify-center text-ink">{k.icon}</div>
            <div className="num mt-1.5 text-[22px] font-semibold leading-none">{k.wert}</div>
            <div className="mt-1 text-[11.5px] text-fg-3">{k.text}</div>
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
        <div className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] text-green">
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
      <motion.div key={sel.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="-mx-1">
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

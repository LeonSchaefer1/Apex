import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, Zap } from "lucide-react";
import { useMotorStore } from "@/lib/motor";
import { useData } from "@/store/data";
import { toast, useUI } from "@/store/ui";
import { fmtNum, today } from "@/core/dates";
import { motorZahlen } from "@/core/kennzahlen";

/** Mindestabstand zwischen zwei Live-Meldungen – die Island bleibt ruhig (höchstens eine Bewegung je 90 Sekunden). */
const RUHE_MS = 90_000;
/** So lange bleibt eine Live-Meldung stehen. */
const ANZEIGE_MS = 8_000;

const ERKLAERUNG = "Apex Island – zeigt, was der 38h-Motor zuletzt erledigt hat (Beispielwerte). Klick öffnet den 38h-Motor; × blendet sie aus.";

/** Island ausblenden – mit Hinweis, wo sie sich wieder einschalten lässt, und „Rückgängig“. */
export function islandAusblenden() {
  const ui = useUI.getState();
  ui.setIsland(false);
  toast("Apex Island ausgeblendet", {
    text: "Wieder einschalten unter Einstellungen → Darstellung.",
    ton: "info",
    aktion: { label: "Rückgängig", onClick: () => useUI.getState().setIsland(true) },
  });
}

/**
 * „Apex Island“: ruhiges Feld (Fläche, 1-px-Linie, Radius 8) mit der Bilanz des 38h-Motors (DESIGN-SYSTEM.md 12.12). Feste Breite (kein Aus- und Einklappen), keine Daueranimation;
 * Live-Meldungen höchstens alle 90 s, abschaltbar unter Einstellungen → Darstellung, bei „Bewegung reduzieren“ gar keine.
 * Im Prototyp sind die Werte simuliert – deshalb immer mit der Plakette „Beispiel“.
 */
export function ApexIsland() {
  const aktuell = useMotorStore((s) => s.aktuell);
  const akt = useData((s) => s.data.aktivitaeten);
  const live = useUI((s) => s.liveMeldungen);
  const sichtbar = useUI((s) => s.island);
  const reduziert = useReducedMotion();
  const nav = useNavigate();
  // Gesparte Zeit der letzten 7 Tage – dieselbe Berechnung wie Cockpit und Apex Assistent
  const stunden = useMemo(() => motorZahlen(akt, today()).stunden, [akt]);
  const [meldung, setMeldung] = useState<{ text: string; minuten: number } | null>(null);
  const zuletzt = useRef(0);

  useEffect(() => {
    if (!aktuell || !live || reduziert) return;
    if (Date.now() - zuletzt.current < RUHE_MS) return;
    zuletzt.current = Date.now();
    setMeldung(aktuell);
    const t = setTimeout(() => setMeldung(null), ANZEIGE_MS);
    return () => clearTimeout(t);
  }, [aktuell, live, reduziert]);
  useEffect(() => {
    if (!live) setMeldung(null);
  }, [live]);

  if (!sichtbar) return null;
  const zahl = `${fmtNum(stunden, 1)} Std.`;
  const label = meldung
    ? `Apex Island: ${meldung.text}${meldung.minuten > 0 ? `, ${meldung.minuten} Minuten gespart` : ""} – Beispielwerte, im Prototyp simuliert. 38h-Motor öffnen`
    : `Apex Island: ${fmtNum(stunden, 1)} Std. gespart in den letzten 7 Tagen – Beispielwerte, im Prototyp simuliert. 38h-Motor öffnen`;

  return (
    <span className="group relative hidden max-w-full shrink-0 lg:inline-flex">
      <button
        type="button"
        onClick={() => nav("/automatisierung")}
        className="relative inline-flex h-8 w-[248px] min-w-[196px] max-w-full items-center gap-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-2.5 pr-1.5 text-fg transition-colors duration-100 hover:border-[var(--line-strong)] xl:w-[300px] 2xl:w-[360px]"
        aria-label={label}
        aria-describedby="apex-island-tipp"
      >
        <Zap className="size-3.5 shrink-0 text-fg-3" aria-hidden />
        <span className="relative min-w-0 flex-1 text-left">
          <AnimatePresence initial={false} mode="wait">
            {meldung ? (
              <motion.span key="meldung" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="block truncate text-[13px] font-medium" title={meldung.text}>
                {meldung.text}
                {meldung.minuten > 0 && <span className="font-normal text-fg-3"> · +{meldung.minuten} Min.</span>}
              </motion.span>
            ) : (
              <motion.span key="ruhe" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="flex min-w-0 items-baseline gap-1 text-[13px]">
                <span className="num shrink-0 font-semibold text-fg">{zahl}</span>
                <span className="min-w-0 truncate text-fg-3">in 7 Tagen</span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="chip chip-outline shrink-0 !h-5 !px-1.5">Beispiel</span>
      </button>
      {/* Ausblenden direkt an der Island (1 Aktion) – wieder einschalten unter Einstellungen → Darstellung */}
      {/* Trefferfläche 24×24 px (WCAG 2.5.8), sichtbar bleibt der 20-px-Kreis */}
      <button
        type="button"
        onClick={islandAusblenden}
        className="absolute -right-2.5 -top-2.5 z-10 grid size-6 place-items-center rounded-full text-fg-2 opacity-0 transition-opacity duration-100 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
        aria-label="Apex Island ausblenden"
        title="Apex Island ausblenden"
      >
        <span aria-hidden className="grid size-5 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-pop)]">
          <X className="size-3" />
        </span>
      </button>
      <span
        id="apex-island-tipp"
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-50 w-[300px] -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface-pop)] px-3 py-2 text-[13px] leading-[18px] text-fg-2 opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {ERKLAERUNG}
      </span>
    </span>
  );
}

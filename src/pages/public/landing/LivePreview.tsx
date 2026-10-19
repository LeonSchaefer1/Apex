import { useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { CalendarClock, FolderOpen, Inbox, LayoutDashboard, Search, Sparkles, Zap } from "lucide-react";
import { AiChip, Chip } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { berechneNachRegel } from "@/core/fristen";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { addDays, fmtDateShort, fmtDateWd, today, wochentagName } from "@/core/dates";
import { STUFE_WORT } from "@/core/einschaetzung";
import { BEWEGUNG } from "@/lib/bewegung";
import { cn } from "@/lib/cn";
import { useTakt } from "./basis";

/**
 * Produktfenster im Einstieg (DESIGN-SYSTEM.md 14.2): flach – Fläche, 1-px-Linie, Radius 12, kein Schatten, Fenster-Punkte in
 * Linie stark. Innen gliedern Linien statt Karten, wie in der App.
 * Ablauf (je Takt): beA-Zustellung trifft ein → KI erkennt die Frist → der Fristenrechner rechnet mit Rechenweg →
 * Frist übernommen → KI-Fallanalyse nennt die Einschätzung in Worten (nie „0 %“). Im Ruhezustand ist der Endzustand sichtbar;
 * bei reduzierter Bewegung bleibt er stehen.
 */
const SCHRITTE = 17;
const TAKT = 950;

// Urteil des Landgerichts Berlin II → Berufung zum Kammergericht: Feiertage am Ort des Berufungsgerichts (I3-T00-03)
const GERICHTSORT = { feiertagsOrt: "Kammergericht, Berufungsgericht", kanzleiLand: "BE" } as const;

function beispiel() {
  const heute = today();
  for (let i = 3; i < 60; i++) {
    const ereignis = addDays(heute, -i);
    const r = berechneNachRegel("berufung", ereignis, "BE", undefined, GERICHTSORT);
    if (r.verschoben && r.ende >= heute) return { ereignis, ...r };
  }
  const ereignis = addDays(heute, -3);
  return { ereignis, ...berechneNachRegel("berufung", ereignis, "BE", undefined, GERICHTSORT) };
}

const kurz = (z: string) =>
  z
    .replace(" → Verschiebung auf den nächsten Werktag", " → nächster Werktag")
    .replace("Zustellung des vollständigen Urteils", "Zustellung des Urteils")
    .replace(/^Fristbeginn am Folgetag – .*$/, "Fristbeginn am Folgetag (§ 187 Abs. 1 BGB)")
    .replace("Fristende nach § 222 Abs. 2 ZPO", "Fristende (§ 222 Abs. 2 ZPO)")
    .replace("Fristende fällt auf einen Werktag – keine Verschiebung", "Fristende – Werktag, keine Verschiebung")
    .replace("Ende am Tag mit derselben Zahl – ", "")
    .replace(", auf Werktag gelegt", "");

const NAV = [
  { k: "cockpit", i: <LayoutDashboard className="size-4" /> },
  { k: "akten", i: <FolderOpen className="size-4" /> },
  { k: "post", i: <Inbox className="size-4" /> },
  { k: "frist", i: <CalendarClock className="size-4" /> },
  { k: "ki", i: <Sparkles className="size-4" /> },
];

export function LivePreview() {
  const ref = useRef<HTMLDivElement>(null);
  const sichtbar = useInView(ref, { amount: 0.3 });
  const s = useTakt(SCHRITTE, TAKT, sichtbar, 2400);
  const f = useMemo(beispiel, []);
  const praezedenz = useMemo(() => ["bag-2azr541-09", ...ENTSCHEIDUNGEN.filter((e) => e.rechtsgebiet === "Arbeitsrecht" && e.id !== "bag-2azr541-09").map((e) => e.id)].slice(0, 3).map((id) => ENTSCHEIDUNGEN.find((e) => e.id === id)!).filter(Boolean), []);

  const post = s < 1 ? "neu" : s < 3 ? "liest" : "erkannt";
  const zeilen = Math.max(0, Math.min(f.rechenweg.length, s - 3));
  const uebernommen = s >= 9;
  const analyseFertig = s >= 12;
  const bereich = s < 3 ? "post" : s < 10 ? "frist" : "ki";

  return (
    <div ref={ref} className="relative w-full max-w-[640px] xl:ml-auto">
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        {/* Titelleiste */}
        <div className="flex h-10 items-center gap-3 border-b border-[var(--line)] px-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
            <span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
            <span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
          </div>
          <div className="mx-auto hidden h-6 min-w-0 max-w-[260px] flex-1 items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-2.5 text-[12px] text-fg-4 sm:flex" aria-hidden>
            <Search className="size-3 shrink-0" />
            <span className="truncate">Akten, Fristen, Urteile durchsuchen …</span>
          </div>
          <span className="ml-auto text-[12px] font-medium text-fg-3 sm:ml-0">Vorschau mit Beispieldaten</span>
        </div>

        <div className="grid grid-cols-[44px_minmax(0,1fr)] bg-[var(--bg)] sm:grid-cols-[48px_minmax(0,1fr)]">
          {/* Mini-Seitenleiste wie in der App: Grund, Linie rechts, Auswahl auf Fläche 3 */}
          <nav aria-hidden className="flex flex-col items-center gap-1 border-r border-[var(--line)] py-3">
            <LogoMark size={18} className="mb-3 text-fg" />
            {NAV.map((x) => (
              <span key={x.k} className={cn("grid size-8 place-items-center rounded-md transition-colors duration-150", bereich === x.k ? "bg-[var(--surface-3)] text-fg" : "text-fg-4")}>
                {x.i}
              </span>
            ))}
          </nav>

          {/* Inhalt: zwei Spalten, getrennt durch Linien – keine Karten im Fenster */}
          <div className="grid min-w-0 bg-[var(--surface)] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
            <div className="grid min-w-0 content-start divide-y divide-[var(--line)] border-b border-[var(--line)] sm:border-b-0 sm:border-r">
              {/* Posteingang */}
              <Bereich titel="Posteingang · beA">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-fg">Landgericht Berlin II</div>
                    <div className="truncate text-[12px] text-fg-3">
                      beA · {wochentagName(f.ereignis, true)}, {fmtDateShort(f.ereignis)}
                    </div>
                  </div>
                  <Chip className="!h-5 !px-1.5">eEB</Chip>
                </div>
                <div className="mt-2 text-[12px] leading-[18px] text-fg-2">Zustellung Urteil · Neumann ./. Arslan Autohaus GmbH</div>
                <div className="mt-2.5 h-[22px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {post === "neu" && (
                      <Wechsel k="neu">
                        <Chip tone="ink">Neu eingegangen</Chip>
                      </Wechsel>
                    )}
                    {post === "liest" && (
                      <Wechsel k="liest" className="flex h-[22px] items-center gap-1.5 text-[12px] font-medium text-fg-3">
                        <Sparkles className="size-3" aria-hidden />
                        KI liest das Urteil …
                      </Wechsel>
                    )}
                    {post === "erkannt" && (
                      <Wechsel k="erkannt" className="flex flex-wrap items-center gap-1.5">
                        <Chip tone="ink">Frist erkannt</Chip>
                        <span className="mono text-[12px] text-fg-3">→ Akte 118/26</span>
                      </Wechsel>
                    )}
                  </AnimatePresence>
                </div>
              </Bereich>

              {/* KI-Fallanalyse */}
              <Bereich titel="KI-Fallanalyse" rechts={<AiChip className="!h-5">KI</AiChip>}>
                <div className="truncate text-[12px] text-fg-3">
                  <span className="mono">142/26</span> · Kündigungsschutz Weber
                </div>
                <div className="mt-2.5 min-h-[58px]">
                  <div className="text-[12px] text-fg-4">Einschätzung der Erfolgsaussicht</div>
                  <AnimatePresence mode="wait" initial={false}>
                    {analyseFertig ? (
                      <Wechsel k="fertig">
                        <div className="text-[16px] font-semibold leading-6 tracking-[-0.01em] text-fg">{STUFE_WORT.hoch} (Beispiel)</div>
                        <div className="text-[12px] leading-[18px] text-fg-2">14 Jahre ohne Abmahnung, Bagatellwert – Abmahnung hätte genügt.</div>
                      </Wechsel>
                    ) : (
                      <Wechsel k="laeuft" className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-fg-3">
                        <Sparkles className="size-3" aria-hidden />
                        Analyse läuft …
                      </Wechsel>
                    )}
                  </AnimatePresence>
                </div>
                <ul className="mt-2.5 grid grid-cols-1 gap-1">
                  {praezedenz.map((e, k) => (
                    <motion.li key={e.id} animate={{ opacity: s >= 11 + k * 0.5 || s === SCHRITTE - 1 ? 1 : 0.55 }} transition={BEWEGUNG.standard} className="flex min-w-0 items-baseline gap-2 text-[12px]">
                      <span className="w-8 shrink-0 font-medium text-fg-2">{e.gericht}</span>
                      <span className="mono shrink-0 text-fg-2">{e.az}</span>
                      <span className="truncate text-fg-3">{e.titel.replace(/[„“]/g, "")}</span>
                    </motion.li>
                  ))}
                </ul>
              </Bereich>
            </div>

            {/* Frist mit Rechenweg */}
            <Bereich titel="Fristenrechner" className="flex flex-col">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-[18px] text-fg">{f.regel.titel}</div>
                  <div className="text-[12px] text-fg-3">{f.regel.grundlage} · Akte 118/26</div>
                </div>
                <Chip tone="seal" className="!h-5 !px-1.5">
                  Notfrist
                </Chip>
              </div>
              <div className="mt-3 text-[12px] text-fg-4">Rechenweg</div>
              <ol className="mt-1.5 grid grid-cols-1 gap-px">
                {f.rechenweg.map((z, k) => (
                  // Rechenweg von Anfang an in voller Deckkraft lesbar – der Ablauf markiert nur den aktuellen Schritt (Balken links)
                  <li
                    key={k}
                    className={cn(
                      "flex gap-2 rounded-sm py-0.5 pl-1.5 pr-1 text-[12px] leading-[17px] transition-[background-color,box-shadow] duration-150",
                      k === f.rechenweg.length - 2 ? "font-semibold text-fg" : "text-fg-2",
                      k === zeilen - 1 && "bg-[var(--surface-2)] shadow-[inset_2px_0_0_var(--ink)]",
                    )}
                  >
                    <span className="num w-3 shrink-0 text-right text-fg-4">{k + 1}</span>
                    <span className="min-w-0">{kurz(z)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto pt-3">
                <div className="flex items-end justify-between gap-2 border-t border-[var(--line)] pt-3">
                  <div>
                    <div className="text-[12px] text-fg-3">Fristende</div>
                    <div className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{fmtDateWd(f.ende)}</div>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    {uebernommen ? (
                      <Wechsel k="ok">
                        <Chip tone="green">Übernommen</Chip>
                      </Wechsel>
                    ) : (
                      <Wechsel k="btn" className="inline-flex h-7 items-center rounded-md bg-[var(--ink)] px-2.5 text-[12px] font-medium text-[var(--on-ink)]">
                        Frist übernehmen
                      </Wechsel>
                    )}
                  </AnimatePresence>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-fg-4">
                  <Sparkles className="size-3 shrink-0" aria-hidden />
                  KI erkennt · Rechenkern berechnet · Vier-Augen-Kontrolle
                </div>
              </div>
            </Bereich>
          </div>
        </div>
      </div>

      {/* Apex Island: Zeitersparnis – helles Feld mit Linie, „+6 Min.“ in Text 3 */}
      <AnimatePresence>
        {uebernommen && s < SCHRITTE - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={BEWEGUNG.standard}
            className="absolute -bottom-4 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-lg border border-[var(--line)] bg-[var(--surface-pop)] px-3 text-[12px] font-medium text-fg shadow-[var(--shadow-pop)] sm:text-[13px]"
          >
            <Zap className="size-3.5 text-fg-3" aria-hidden />
            Frist eingetragen, Vorfrist gesetzt <span className="font-normal text-fg-3">· +6 Min.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Bereich im Produktfenster: kleine Überschrift wie ein Paneltitel, Polster 16 px, keine eigene Fläche. */
function Bereich({ titel, rechts, children, className }: { titel: string; rechts?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 p-3.5 sm:p-4", className)}>
      <div className="mb-2.5 flex h-5 items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-fg-3">{titel}</span>
        {rechts}
      </div>
      {children}
    </div>
  );
}

/** Kurzes Überblenden zwischen zwei Zuständen (160 ms, ohne Versatz-Feder). */
function Wechsel({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className={className}>
      {children}
    </motion.div>
  );
}

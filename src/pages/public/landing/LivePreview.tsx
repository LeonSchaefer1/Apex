import { useMemo, useRef } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { CalendarClock, Check, FolderOpen, Inbox, Landmark, LayoutDashboard, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AiChip, Chip } from "@/components/ui";
import { AppIcon } from "@/components/Logo";
import { berechneNachRegel } from "@/core/fristen";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { addDays, fmtDateShort, fmtDateWd, today, wochentagName } from "@/core/dates";
import { STUFE_WORT } from "@/core/einschaetzung";
import { cn } from "@/lib/cn";
import { useTakt } from "./basis";

/**
 * Vorschau im Hero: ein Miniatur-Fenster der echten App.
 * Ablauf (je Takt): beA-Zustellung trifft ein → KI erkennt die Frist → der Fristenrechner rechnet mit Rechenweg →
 * Frist übernommen → KI-Fallanalyse nennt die Einschätzung in Worten (nie „0 %“). Im Ruhezustand ist der Endzustand sichtbar.
 */
const SCHRITTE = 17;
const TAKT = 950;

function beispiel() {
  const heute = today();
  for (let i = 3; i < 60; i++) {
    const ereignis = addDays(heute, -i);
    const r = berechneNachRegel("berufung", ereignis, "BE");
    if (r.verschoben && r.ende >= heute) return { ereignis, ...r };
  }
  const ereignis = addDays(heute, -3);
  return { ereignis, ...berechneNachRegel("berufung", ereignis, "BE") };
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
    <div ref={ref} className="relative mx-auto w-full max-w-[620px]">
      {/* Licht hinter dem Fenster */}
      <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[48px] opacity-70 blur-2xl" style={{ background: "radial-gradient(60% 55% at 70% 30%, var(--aura-1), transparent 70%), radial-gradient(50% 50% at 20% 85%, var(--aura-4), transparent 70%)" }} />

      <div className="glass-strong relative overflow-hidden rounded-[26px] sm:rounded-[30px]" style={{ boxShadow: "var(--glass-shadow-lg)" }}>
        {/* Titelleiste */}
        <div className="relative z-[2] flex h-11 items-center gap-3 border-b border-[var(--line)] px-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-seal opacity-70" />
            <span className="size-2.5 rounded-full bg-amber opacity-70" />
            <span className="size-2.5 rounded-full bg-green opacity-70" />
          </div>
          <div className="mx-auto hidden h-6 min-w-0 max-w-[260px] flex-1 items-center gap-1.5 rounded-full bg-[var(--ink-softer)] px-3 text-[12px] text-fg-3 shadow-[inset_0_0_0_1px_var(--line)] sm:flex">
            <Search className="size-3 shrink-0" />
            <span className="truncate">Akten, Fristen, Urteile durchsuchen …</span>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-fg-3 sm:ml-0">
            <span className="relative inline-flex size-1.5 rounded-full bg-[var(--green)]" aria-hidden />
            Vorschau mit Beispieldaten
          </span>
        </div>

        <div className="relative z-[2] grid grid-cols-[44px_1fr] sm:grid-cols-[52px_1fr]">
          {/* Mini-Seitenleiste */}
          <nav aria-hidden className="flex flex-col items-center gap-1.5 border-r border-[var(--line)] py-3">
            <AppIcon size={26} className="mb-2" />
            {[
              { k: "cockpit", i: <LayoutDashboard className="size-4" /> },
              { k: "akten", i: <FolderOpen className="size-4" /> },
              { k: "post", i: <Inbox className="size-4" /> },
              { k: "frist", i: <CalendarClock className="size-4" /> },
              { k: "ki", i: <Sparkles className="size-4" /> },
            ].map((x) => (
              <span key={x.k} className={cn("relative grid size-8 place-items-center rounded-[10px] transition-colors duration-300", bereich === x.k ? "text-ink" : "text-fg-4")}>
                {bereich === x.k && (
                  <motion.span layoutId="lp-nav" className="absolute inset-0 rounded-[10px] bg-[var(--surface)] shadow-[0_2px_8px_-2px_rgba(20,30,80,0.18),0_0_0_1px_var(--line)]" transition={{ type: "spring", stiffness: 480, damping: 36 }} />
                )}
                <span className="relative">{x.i}</span>
              </span>
            ))}
          </nav>

          {/* Inhalt */}
          <div className="grid min-w-0 gap-2.5 p-2.5 sm:grid-cols-[1fr_1.12fr] sm:gap-3 sm:p-3">
            <div className="grid min-w-0 content-start gap-2.5 sm:gap-3">
              {/* Posteingang */}
              <Kachel aktiv={bereich === "post"}>
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-ink-soft text-ink">
                    <Landmark className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">Landgericht Berlin II</div>
                    <div className="truncate text-[12px] text-fg-3">beA · {wochentagName(f.ereignis, true)}, {fmtDateShort(f.ereignis)}</div>
                  </div>
                  <Chip tone="amber" className="!h-[21px] !px-1.5 !text-[12px]">
                    eEB
                  </Chip>
                </div>
                <div className="mt-2 text-[12.5px] leading-snug text-fg-2">Zustellung Urteil · Neumann ./. Arslan Autohaus GmbH</div>
                <div className="mt-2 h-[22px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {post === "neu" && (
                      <motion.div key="neu" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        <Chip tone="ink" className="!h-[21px] !text-[12px]">
                          Neu eingegangen
                        </Chip>
                      </motion.div>
                    )}
                    {post === "liest" && (
                      <motion.div key="liest" className="flex items-center gap-2 text-[12px] font-medium text-violet" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                        <span className="shimmer h-1.5 w-12 rounded-full" />
                        KI liest das Urteil …
                      </motion.div>
                    )}
                    {post === "erkannt" && (
                      <motion.div key="erkannt" className="flex flex-wrap items-center gap-1.5" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                        <Chip tone="seal" className="!h-[21px] !text-[12px]" dot>
                          Frist erkannt
                        </Chip>
                        <span className="mono text-[12px] text-fg-3">→ Akte 118/26</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Kachel>

              {/* KI-Fallanalyse */}
              <Kachel aktiv={bereich === "ki"} ai>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold">KI-Fallanalyse</span>
                  <AiChip className="!h-[21px] !text-[12px]">KI</AiChip>
                </div>
                <div className="mt-1 truncate text-[12px] text-fg-3">
                  <span className="mono">142/26</span> · Kündigungsschutz Weber
                </div>
                <div className="mt-2 min-h-[58px]">
                  <div className="text-[12px] font-medium text-fg-3">Einschätzung der Erfolgsaussicht</div>
                  <AnimatePresence mode="wait" initial={false}>
                    {analyseFertig ? (
                      <motion.div key="fertig" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
                        <div className="text-[17px] font-semibold leading-tight tracking-[-0.02em] text-green">{STUFE_WORT.hoch} (Beispiel)</div>
                        <div className="mt-0.5 text-[12px] leading-snug text-fg-2">14 Jahre ohne Abmahnung, Bagatellwert – Abmahnung hätte genügt.</div>
                      </motion.div>
                    ) : (
                      <motion.div key="laeuft" className="mt-1 flex items-center gap-2 text-[12.5px] font-medium text-violet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <span className="shimmer h-1.5 w-12 rounded-full" aria-hidden />
                        Analyse läuft …
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-1">
                  {praezedenz.map((e, k) => (
                    <motion.li
                      key={e.id}
                      animate={{ opacity: s >= 11 + k * 0.5 || s === SCHRITTE - 1 ? 1 : 0.25, x: s >= 11 + k * 0.5 || s === SCHRITTE - 1 ? 0 : -4 }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="flex min-w-0 items-center gap-1.5 text-[12px]"
                    >
                      <span className="shrink-0 rounded-[5px] bg-violet-soft px-1 font-semibold text-violet">{e.gericht}</span>
                      <span className="mono shrink-0 text-fg-2">{e.az}</span>
                      <span className="truncate text-fg-3">{e.titel.replace(/[„“]/g, "")}</span>
                    </motion.li>
                  ))}
                </ul>
              </Kachel>
            </div>

            {/* Frist mit Rechenweg */}
            <Kachel aktiv={bereich === "frist"} className="flex flex-col">
              <div className="flex items-start gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-seal-soft text-seal">
                  <CalendarClock className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold leading-tight">{f.regel.titel}</div>
                  <div className="text-[12px] text-fg-3">{f.regel.grundlage} · Akte 118/26</div>
                </div>
                <Chip tone="seal" className="!h-[21px] !px-1.5 !text-[12px]">
                  Notfrist
                </Chip>
              </div>
              <div className="mt-2.5 rounded-[12px] bg-[var(--ink-softer)] p-2.5">
                <div className="eyebrow mb-1.5">Rechenweg</div>
                <ol className="grid grid-cols-1 gap-1">
                  {f.rechenweg.map((z, k) => (
                    <motion.li
                      key={k}
                      animate={{ opacity: k < zeilen ? 1 : 0.18, y: k < zeilen ? 0 : 3 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={cn("flex gap-1.5 text-[12px] leading-snug", k === f.rechenweg.length - 2 ? "font-semibold text-fg" : "text-fg-2")}
                    >
                      <span className="num mt-px grid size-4 shrink-0 place-items-center rounded-full bg-ink-soft text-[10px] font-bold text-ink">{k + 1}</span>
                      <span className="min-w-0">{kurz(z)}</span>
                    </motion.li>
                  ))}
                </ol>
              </div>
              <div className="mt-auto pt-2.5">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-medium text-fg-3">Fristende</div>
                    <div className="text-[15px] font-semibold tracking-[-0.02em] text-seal">{fmtDateWd(f.ende)}</div>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    {uebernommen ? (
                      <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 26 }} className="inline-flex h-7 items-center gap-1 rounded-full bg-green-soft px-2.5 text-[12px] font-semibold text-green">
                        <Check className="size-3.5" /> Übernommen
                      </motion.span>
                    ) : (
                      <motion.span key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="btn btn-primary btn-sm !h-7 !px-2.5 !text-[12px]">
                        Frist übernehmen
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-3">
                  <ShieldCheck className="size-3 text-green" />
                  KI erkennt · Rechenkern berechnet · Vier-Augen-Kontrolle
                </div>
              </div>
            </Kachel>
          </div>
        </div>
      </div>

      {/* Apex Island: Zeitersparnis */}
      <AnimatePresence>
        {uebernommen && s < SCHRITTE - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
            className="absolute -bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#090b14] py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-medium text-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
          >
            <span className="grid size-5 place-items-center rounded-full bg-white/10">
              <Zap className="size-3 text-[#ffd166]" fill="#ffd166" />
            </span>
            Frist eingetragen, Vorfrist gesetzt <span className="text-[#7ee2b8]">· +6 Min.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kachel({ children, aktiv, ai, className }: { children: React.ReactNode; aktiv: boolean; ai?: boolean; className?: string }) {
  return (
    <motion.div
      animate={{ scale: aktiv ? 1 : 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "relative min-w-0 rounded-[16px] border p-2.5 transition-[box-shadow,border-color,background-color] duration-500 sm:p-3",
        aktiv ? "border-transparent bg-[var(--surface)] shadow-[0_10px_28px_-14px_rgba(20,30,80,0.35)]" : "border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]",
        aktiv && ai && "ai-ring",
        aktiv && !ai && "ring-2 ring-[var(--ink-soft)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

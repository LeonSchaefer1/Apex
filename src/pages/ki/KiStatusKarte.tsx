import { useMemo } from "react";
import { motion } from "motion/react";
import { BookCheck, Calculator, Clock, Cpu, ShieldCheck, Sparkles, UserCheck, Zap } from "lucide-react";
import { useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { addDays, fmtNum, today } from "@/core/dates";
import { AnimatedNumber, Chip, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";

const GRUNDSAETZE = [
  { icon: <Calculator className="size-4" />, text: "Die KI erkennt – der Fristenrechner berechnet" },
  { icon: <BookCheck className="size-4" />, text: "Nur geprüfte Quellen zitieren" },
  { icon: <ShieldCheck className="size-4" />, text: "Mandantendaten bleiben in Ihrer Infrastruktur" },
];

/** Status der KI: woher die Antworten kommen (Claude live oder Demo-KI), Modell, Grundsätze und Wirkung. */
export function KiStatusKarte() {
  const { quelle, modell, verfuegbar, bevorzugeDemo, setBevorzugeDemo } = useAiStatus();
  const live = quelle !== "demo";
  const liveMoeglich = verfuegbar.some((v) => v !== "demo");
  const aktivitaeten = useData((s) => s.data.aktivitaeten);
  const fristen = useData((s) => s.data.fristen);

  const kennzahlen = useMemo(() => {
    const ab = addDays(today(), -7);
    const ki = aktivitaeten.filter((a) => a.akteur === "ki" && a.zeit.slice(0, 10) >= ab);
    const minuten = ki.reduce((s, a) => s + (a.minutenGespart ?? 0), 0);
    const kiFristen = fristen.filter((f) => f.quelle === "ki");
    const kontrolliert = kiFristen.filter((f) => f.kontrolliertVon).length;
    return { vorgaenge: ki.length, stunden: minuten / 60, kiFristen: kiFristen.length, kontrolliert };
  }, [aktivitaeten, fristen]);

  const quelleText = quelle === "server" ? "über Ihren Kanzlei-Server" : quelle === "artefakt" ? "über die gesicherte Vorschau-Laufzeit" : "";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32, delay: 0.05 }}
      className="glass-strong glow relative overflow-hidden rounded-[28px] p-5 sm:p-6"
      style={{ boxShadow: "var(--glass-shadow-lg)" }}
    >
      {/* sanfter KI-Schimmer im Hintergrund */}
      <div aria-hidden className="ai-fill pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-[0.13] blur-3xl" />
      <div className="relative z-[2] grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="ai-fill grid size-11 shrink-0 place-items-center rounded-[14px] text-white shadow-[0_10px_24px_-10px_var(--ai-2)]">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="title-md">KI-Status</span>
                {live ? (
                  <span className="chip ai-ring !bg-transparent">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-[var(--green)]" />
                    </span>
                    <span className="ai-text font-semibold">Claude live</span>
                  </span>
                ) : (
                  <Chip tone="amber" dot>
                    Demo-KI (offline)
                  </Chip>
                )}
                {live && (
                  <span className="mono inline-flex items-center gap-1 text-[11.5px] text-fg-3">
                    <Cpu className="size-3.5" />
                    {modell ?? "Claude"}
                  </span>
                )}
              </div>
              <p className="mt-1 hidden max-w-[72ch] text-[13px] leading-snug text-fg-3 sm:block">
                {live
                  ? `Claude liest und formuliert ${quelleText}. Fristen berechnet weiterhin der Fristenrechner, Zitate stammen ausschließlich aus der Fall-Datenbank.`
                  : "Die Demo-KI arbeitet regelbasiert und vollständig in Ihrem Browser – ideal zum Ausprobieren. Mit Claude-Anbindung formuliert die KI frei; geprüft und berechnet wird weiterhin deterministisch."}
              </p>
            </div>
          </div>

          <ul className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 no-scrollbar [mask-image:linear-gradient(90deg,transparent,#000_20px,#000_calc(100%-28px),transparent)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]">
            {GRUNDSAETZE.map((g, i) => (
              <motion.li
                key={g.text}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 420, damping: 32 }}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--ink-softer)] py-1.5 pl-2 pr-3 text-[12.5px] font-medium text-fg-2 ring-1 ring-[var(--line)]"
              >
                <span className="grid size-6 place-items-center rounded-full bg-[var(--surface)] text-ink [&>svg]:size-3.5">{g.icon}</span>
                {g.text}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Kennzahl icon={<Zap className="size-3.5" />} label="Vorgänge" sub="KI · 7 Tage" wert={<AnimatedNumber value={kennzahlen.vorgaenge} />} />
            <Kennzahl icon={<Clock className="size-3.5" />} label="Gespart" sub="7 Tage" wert={<AnimatedNumber value={kennzahlen.stunden} format={(n) => `${fmtNum(n, 1)} h`} />} />
            <Kennzahl
              icon={<UserCheck className="size-3.5" />}
              label="Geprüft"
              sub="KI-Fristen"
              wert={
                <span className="num">
                  <AnimatedNumber value={kennzahlen.kontrolliert} />
                  <span className="text-fg-4">/{kennzahlen.kiFristen}</span>
                </span>
              }
            />
          </div>
          {liveMoeglich && (
            <label className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px] text-fg-2">
              <span>Offline-Demo-KI verwenden</span>
              <Switch checked={bevorzugeDemo} onChange={setBevorzugeDemo} label="Offline-Demo-KI verwenden" />
            </label>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function Kennzahl({ icon, label, sub, wert }: { icon: React.ReactNode; label: string; sub: string; wert: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-[16px] bg-[var(--surface)]/70 px-3 py-2.5 ring-1 ring-[var(--line)] lg:w-[132px]")}>
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3">
        <span className="hidden text-violet min-[400px]:inline">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em]">{wert}</div>
      <div className="mt-1 truncate text-[10.5px] text-fg-4">{sub}</div>
    </div>
  );
}

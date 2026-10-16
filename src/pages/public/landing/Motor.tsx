import { useId, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, FileText, Inbox, Landmark, MessagesSquare, Timer, UsersRound } from "lucide-react";
import { AnimatedNumber } from "@/components/ui";
import { AUTOMATION_DEFS, WERT_PRO_STUNDE, WOCHEN_PRO_JAHR } from "@/core/automationen";
import { fmtEUR, fmtNum } from "@/core/dates";
import { cn } from "@/lib/cn";
import { Abschnitt, Kopf, Reveal } from "./basis";

/** Richtwert der Werbeaussage: Ø 38 Std. automatisierte Routine pro Kanzlei und Woche ≈ 36.000 € pro Jahr. */
const RICHTWERT_STUNDEN = 38;
/** Vollzeitstelle für die Umrechnung „≙ Stellen". */
const STUNDEN_JE_STELLE = 40;

const KATEGORIE_ICON = {
  Posteingang: <Inbox className="size-4" />,
  Fristen: <CalendarClock className="size-4" />,
  Mandanten: <MessagesSquare className="size-4" />,
  Dokumente: <FileText className="size-4" />,
  Finanzen: <Landmark className="size-4" />,
} as const;

const AUSWAHL = ["posteingang-fristen", "zuordnung", "vorfristen", "mandanten-update", "mandatsaufnahme", "deckungsanfrage", "bankabgleich", "mahnwesen"];

export function MotorAbschnitt() {
  const autos = AUSWAHL.map((k) => AUTOMATION_DEFS.find((a) => a.key === k)!).filter(Boolean);
  return (
    <Abschnitt id="motor">
      <Kopf
        eyebrow="So spart der 38h-Motor Zeit"
        titel={
          <>
            Routine erledigt sich.
            <br /> <span className="text-fg-3">Sie bleiben beim Mandat.</span>
          </>
        }
        text="Jede Automation misst, wie viel Zeit sie spart. Im Durchschnitt sind es 38 Stunden pro Woche und Kanzlei – fast eine volle Stelle, die wieder für Mandate frei wird."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Reveal className="sheet relative overflow-hidden rounded-[28px] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="title-lg">Was der Motor übernimmt</h3>
            <span className="hidden text-[12px] text-fg-3 sm:inline">Zeit je Vorgang</span>
          </div>
          <ul className="mt-5 grid gap-1">
            {autos.map((a, k) => (
              <Reveal as="li" key={a.key} delay={k * 0.035} y={12} className="group flex items-center gap-3 rounded-[16px] px-2 py-2.5 transition-colors hover:bg-ink-softer">
                <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink">{KATEGORIE_ICON[a.kategorie]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{a.name}</span>
                  <span className="block truncate text-[12px] text-fg-3">Auslöser: {a.ausloeser}</span>
                </span>
                <span className="num shrink-0 rounded-full bg-green-soft px-2.5 py-1 text-[12px] font-semibold text-green">{a.minutenProLauf} Min.</span>
              </Reveal>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-fg-3">Alle Automationen laufen im Hintergrund, protokollieren jeden Schritt und lassen sich einzeln ein- und ausschalten. Fristen legt der Motor immer zur Vier-Augen-Kontrolle vor.</p>
        </Reveal>
        <Rechner />
      </div>
    </Abschnitt>
  );
}

function Rechner() {
  // Standardwerte ergeben genau die Werbeaussage: 38 Std. × 48 Wochen × ≈ 19,74 € ≈ 36.000 € pro Jahr.
  const [stunden, setStunden] = useState(RICHTWERT_STUNDEN);
  const [satz, setSatz] = useState(WERT_PRO_STUNDE);
  const stundenJahr = stunden * WOCHEN_PRO_JAHR;
  const jahr = stundenJahr * satz;
  const stellen = stunden / STUNDEN_JE_STELLE;
  const satzText = fmtEUR(satz, { cents: !Number.isInteger(satz) });
  return (
    <Reveal delay={0.06} className="sheet relative flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, var(--green-soft), transparent 70%)" }} />
      <div className="relative flex items-center justify-between gap-3">
        <h3 className="title-lg">Ihre Ersparnis</h3>
        <span className="chip chip-outline">Beispielrechnung</span>
      </div>

      <div className="relative mt-6 grid gap-6">
        <Regler
          id="roi-stunden"
          label="Automatisierte Routine pro Woche"
          wert={stunden}
          min={5}
          max={120}
          schritt={1}
          onChange={setStunden}
          anzeige={`${fmtNum(stunden)} Std.`}
          hinweis="Richtwert Ø 38 Std. je Kanzlei – an Ihre Kanzleigröße anpassen."
        />
        <Regler
          id="roi-satz"
          label="Interner Stundensatz (Kosten je Arbeitsstunde)"
          wert={satz}
          min={15}
          max={80}
          schritt={1}
          onChange={setSatz}
          anzeige={satzText}
          hinweis="Routinearbeit erledigen meist Fachangestellte – Richtwert rund 20 €."
        />
      </div>

      <div className="relative mt-7 rounded-[22px] bg-[var(--ink-softer)] p-5 shadow-[inset_0_0_0_1px_var(--line)]">
        <div className="text-[13px] font-medium text-fg-3">Wert der gesparten Zeit pro Jahr</div>
        <div className="mt-1 text-[clamp(38px,5vw,56px)] font-bold leading-none tracking-[-0.045em] text-green">
          ≈ <AnimatedNumber value={jahr} format={(n) => fmtEUR(Math.round(n / 100) * 100, { cents: false })} />
        </div>
        <div className="num mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-2">
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{fmtNum(stunden)} Std./Woche</span>
          <span className="text-fg-4">×</span>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{WOCHEN_PRO_JAHR} Arbeitswochen</span>
          <span className="text-fg-4">×</span>
          <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{satzText}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[16px] bg-[var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <Timer className="size-4 text-ink" />
            <div className="num mt-2 whitespace-nowrap text-[clamp(18px,4.8vw,22px)] font-semibold leading-none tracking-[-0.03em]">
              <AnimatedNumber value={stundenJahr} /> Std.
            </div>
            <div className="mt-1 text-[12px] text-fg-3">pro Jahr zurückgewonnen</div>
          </div>
          <div className="rounded-[16px] bg-[var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
            <UsersRound className="size-4 text-ink" />
            <div className="num mt-2 whitespace-nowrap text-[clamp(18px,4.8vw,22px)] font-semibold leading-none tracking-[-0.03em]">≈ {fmtNum(stellen, stellen < 10 ? 2 : 1)}</div>
            <div className="mt-1 text-[12px] text-fg-3">Vollzeitstellen ({STUNDEN_JE_STELLE} Std.) frei für Mandate</div>
          </div>
        </div>
      </div>
      <p className="relative mt-4 text-[11.5px] leading-relaxed text-fg-4">
        Beispielrechnung: Stunden pro Woche × {WOCHEN_PRO_JAHR} Arbeitswochen × interner Stundensatz. Voreingestellt ist der Richtwert von Ø 38 Stunden automatisierter Routinearbeit pro Kanzlei und Woche – das entspricht rund 36.000 € im Jahr. Die tatsächliche Ersparnis hängt von Fallzahlen, Sachgebieten und Abläufen ab – der 38h-Motor misst sie in Ihrer Kanzlei laufend.
      </p>
    </Reveal>
  );
}

/** Schieberegler im iOS-Stil – nativer Range-Input, voll per Tastatur bedienbar. */
function Regler({ id, label, wert, min, max, schritt, onChange, anzeige, hinweis }: { id: string; label: string; wert: number; min: number; max: number; schritt: number; onChange: (v: number) => void; anzeige: string; hinweis?: string }) {
  const p = ((wert - min) / (max - min)) * 100;
  const hid = useId();
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.5px] font-medium text-fg-2">
          {label}
        </label>
        <motion.span key={anzeige} initial={{ scale: 0.9, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="num shrink-0 whitespace-nowrap text-[18px] font-semibold tracking-[-0.02em]">
          {anzeige}
        </motion.span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={schritt}
        value={wert}
        aria-describedby={hinweis ? hid : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-7 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none",
          "[&::-webkit-slider-runnable-track]:h-[6px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[image:var(--track)]",
          "[&::-webkit-slider-thumb]:-mt-[11px] [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.06)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200 active:[&::-webkit-slider-thumb]:scale-110",
          "[&::-moz-range-track]:h-[6px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[image:var(--track)]",
          "[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.22)]",
          "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-[var(--focus)]",
        )}
        style={{ ["--track" as string]: `linear-gradient(to right, var(--ink) 0%, var(--ink-bright) ${p}%, var(--line-strong) ${p}%)` }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-fg-4">
        <span>{min}</span>
        {hinweis && (
          <span id={hid} className="px-2 text-center">
            {hinweis}
          </span>
        )}
        <span>{max}</span>
      </div>
    </div>
  );
}

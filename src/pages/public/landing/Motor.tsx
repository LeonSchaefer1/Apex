import { useId, useState } from "react";
import { CalendarClock, FileText, Inbox, Landmark, MessagesSquare, Timer, UsersRound } from "lucide-react";
import { AnimatedNumber, Input, Segmented } from "@/components/ui";
import { AUTOMATION_DEFS, JAHRESARBEITSSTUNDEN, PERSONALKOSTEN_JAHR, REFA_VOLLKOSTEN_STUNDE, WERT_PRO_STUNDE, WOCHEN_PRO_JAHR, jahreswert, kostensatz } from "@/core/automationen";
import { fmtEUR, fmtNum } from "@/core/dates";
import { cn } from "@/lib/cn";
import { useMedia } from "@/lib/useMedia";
import { Abschnitt, Kopf, Leise } from "./basis";
import { NBSP, mitEinheit, schuetzeKennzahlen } from "@/lib/typografie";

/** Zielwert der Werbeaussage: Ø 38 Std. gesparte Routine pro Kanzlei und Woche ≈ 36.000 € pro Jahr (mit 19,74 €/Std.). */
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

/**
 * 38h-Motor (DESIGN-SYSTEM.md 14.5): links die Automatiken als Liste mit Linien (Zeit je Vorgang rechts, ohne grüne Plaketten),
 * rechts der Rechner als ein flacher Block (Radius 12, Linie, kein Schatten). Alle Werte gleichrangig in Text 1.
 */
export function MotorAbschnitt() {
  const autos = AUSWAHL.map((k) => AUTOMATION_DEFS.find((a) => a.key === k)!).filter(Boolean);
  return (
    <Abschnitt id="motor" labelledBy="motor-titel">
      <Kopf
        id="motor-titel"
        eyebrow="So spart der 38h-Motor Zeit"
        titel={
          <>
            Routine erledigt sich.
            <br /> <Leise>Sie bleiben beim Mandat.</Leise>
          </>
        }
        text={schuetzeKennzahlen("Jede Automatik misst, wie viel Zeit sie je bearbeitetem Vorgang spart. Nach außen geht nichts ohne Ihre Freigabe. Unser Ziel: Ø 38 Stunden Routinearbeit pro Woche und Kanzlei – fast eine volle Stelle, die wieder für Mandate frei wird.")}
      />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 pb-3">
            <h3 className="title-md">Was der Motor übernimmt</h3>
            <span className="text-[13px] text-fg-4">Zeit je Vorgang</span>
          </div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {autos.map((a) => (
              <li key={a.key} className="flex min-w-0 items-start gap-3 py-3.5">
                <span className="mt-0.5 shrink-0 text-fg-4" aria-hidden>
                  {KATEGORIE_ICON[a.kategorie]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block hyphens-auto break-words text-[15px] font-medium leading-[22px] text-fg">{a.name}</span>
                  <span className="block text-[13px] leading-[18px] text-fg-3">Auslöser: {a.ausloeser}</span>
                  {a.freigabe && <span className="block text-[13px] leading-[18px] text-fg-3">Freigabe: {a.freigabe}</span>}
                </span>
                <span className="shrink-0 text-right" title={a.vorgang}>
                  <span className="num block text-[14px] font-semibold leading-5 text-fg">{a.minutenProLauf}{NBSP}Min.</span>
                  {a.vorgang && <span className="block text-[12px] leading-4 text-fg-4">{a.vorgang}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[14px] leading-[22px] text-fg-3">Alle Automatiken laufen im Hintergrund, protokollieren jeden Schritt und lassen sich einzeln ein- und ausschalten. Was die Kanzlei verlässt, legt der Motor immer zur Freigabe vor; Fristen gehen in die Vier-Augen-Kontrolle. Gezählt wird nur, was tatsächlich bearbeitet wurde – ein Bankabruf ohne neue Zahlung spart keine Minute.</p>
        </div>
        <Rechner />
      </div>
    </Abschnitt>
  );
}

type SatzModus = "ziel" | "personal";

function Rechner() {
  // Standardwerte ergeben genau die Werbeaussage: 38 Std. × 48 Wochen × ≈ 19,74 € ≈ 36.000 € pro Jahr.
  const [stunden, setStunden] = useState(RICHTWERT_STUNDEN);
  const [modus, setModus] = useState<SatzModus>("ziel");
  const [personal, setPersonal] = useState(String(PERSONALKOSTEN_JAHR));
  const personalWert = Math.max(0, Number(personal.replace(/\./g, "").replace(",", ".")) || 0);
  const satz = modus === "ziel" ? WERT_PRO_STUNDE : kostensatz(personalWert);
  const stundenJahr = stunden * WOCHEN_PRO_JAHR;
  const jahr = jahreswert(stunden, satz);
  const stellen = stunden / STUNDEN_JE_STELLE;
  const satzText = fmtEUR(satz);
  const schmal = useMedia("(max-width: 359px)");
  return (
    // Unter 360 px (Reflow 320 px, WCAG 1.4.10): Innenabstand 16 px, Werte unter dem Etikett, Skala und Umschalter umbrechend
    <div className="flex min-w-0 flex-col self-start rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 min-[360px]:p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="title-lg">Ihre Ersparnis</h3>
        <span className="chip chip-outline">Beispielrechnung</span>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6">
        <Regler
          id="roi-stunden"
          label="Gesparte Routine pro Woche"
          wert={stunden}
          min={5}
          max={120}
          schritt={1}
          onChange={setStunden}
          anzeige={mitEinheit(fmtNum(stunden), "Std.")}
          hinweis={schuetzeKennzahlen("Zielwert Ø 38 Std. je Kanzlei – an Ihre Kanzleigröße anpassen.")}
        />
        <div>
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 max-[359px]:flex-col max-[359px]:items-start">
            <span className="text-[14px] font-medium text-fg-2" id="roi-satz-label">
              Interner Kostensatz je Stunde
            </span>
            <span className="num shrink-0 whitespace-nowrap text-[18px] font-semibold tracking-[-0.01em] text-fg">{satzText}</span>
          </div>
          <Segmented<SatzModus>
            full
            wrap={schmal}
            mobilGross
            size="sm"
            value={modus}
            onChange={setModus}
            options={[
              { value: "ziel", label: schuetzeKennzahlen("Zielwert 19,74 €/Std.") },
              { value: "personal", label: "Aus Personalkosten" },
            ]}
          />
          {modus === "personal" ? (
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <label htmlFor="roi-personal" className="grid gap-1.5 text-[13px] text-fg-2">
                Personalkosten pro Jahr (Arbeitgeber-Brutto, €)
                <Input id="roi-personal" inputMode="numeric" value={personal} onChange={(e) => setPersonal(e.target.value)} className="num" />
              </label>
              <span className="pb-2 text-[13px] text-fg-3">÷ {mitEinheit(fmtNum(JAHRESARBEITSSTUNDEN), "Std.")} = {satzText}</span>
            </div>
          ) : (
            <p className="mt-2 text-[13px] leading-5 text-fg-3">{schuetzeKennzahlen("36.000 € ÷ (38 Std. × 48 Wochen) – ein bewusst niedrig angesetzter Zielwert.")}</p>
          )}
        </div>
      </div>

      <div className="mt-8 border-t border-[var(--line)] pt-6">
        <div className="text-[13px] font-medium text-fg-3">Wert der gesparten Zeit pro Jahr</div>
        <div className="num mt-1 text-[clamp(32px,8vw,44px)] font-semibold leading-[1.1] tracking-[-0.03em] text-fg">
          ≈{NBSP}<AnimatedNumber value={jahr} format={(n) => fmtEUR(Math.round(n / 100) * 100, { cents: false })} />
        </div>
        <p className="num mt-2 text-[13px] text-fg-3">
          {mitEinheit(fmtNum(stunden), "Std./Woche")} × {mitEinheit(WOCHEN_PRO_JAHR, "Arbeitswochen")} × {satzText}
        </p>
        <dl className="mt-6 grid grid-cols-2 border-t border-[var(--line)] max-[359px]:grid-cols-1">
          <div className="pr-4 pt-4">
            <dt className="flex items-center gap-1.5 text-[13px] text-fg-3">
              <Timer className="size-4 text-fg-4" aria-hidden /> pro Jahr zurückgewonnen
            </dt>
            <dd className="num mt-1 whitespace-nowrap text-[20px] font-semibold leading-7 tracking-[-0.015em] text-fg">
              <AnimatedNumber value={stundenJahr} />{NBSP}Std.
            </dd>
          </div>
          <div className="border-l border-[var(--line)] pl-4 pt-4 max-[359px]:border-l-0 max-[359px]:pl-0">
            <dt className="flex items-center gap-1.5 text-[13px] text-fg-3">
              <UsersRound className="size-4 shrink-0 text-fg-4" aria-hidden /> Vollzeitstellen ({mitEinheit(STUNDEN_JE_STELLE, "Std.")}) frei für Mandate
            </dt>
            <dd className="num mt-1 whitespace-nowrap text-[20px] font-semibold leading-7 tracking-[-0.015em] text-fg">≈{NBSP}{fmtNum(stellen, stellen < 10 ? 2 : 1)}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-6 text-[13px] leading-5 text-fg-2">
        {schuetzeKennzahlen(
          `Unser Zielwert von ≈ 36.000 € rechnet bewusst mit 19,74 €/Std.; mit ReFa-Vollkosten von ca. 26 €/Std. wären es ≈ ${fmtEUR(Math.round(jahreswert(RICHTWERT_STUNDEN, REFA_VOLLKOSTEN_STUNDE) / 100) * 100, { cents: false })} (38 × 48 × ${fmtEUR(REFA_VOLLKOSTEN_STUNDE)}).`,
        )}
      </p>
      <p className="mt-2 text-[13px] leading-5 text-fg-3">
        Beispielrechnung: Stunden pro Woche × {mitEinheit(WOCHEN_PRO_JAHR, "Arbeitswochen")} × interner Kostensatz. ReFa-Vollkosten als Annahme: {fmtEUR(PERSONALKOSTEN_JAHR, { cents: false })} Personalkosten ÷ {mitEinheit(fmtNum(JAHRESARBEITSSTUNDEN), "Jahresarbeitsstunden")}. Kein garantiertes Ergebnis: Die tatsächliche Ersparnis hängt von Fallzahlen, Sachgebieten und Abläufen ab – der 38h-Motor misst sie in Ihrer Kanzlei je bearbeitetem Vorgang.
      </p>
    </div>
  );
}

/**
 * Schieberegler: nativer Range-Input (voll per Tastatur bedienbar) über einer eigenen Spur – gefüllter Teil Akzent, Rest Linie
 * stark (≥ 3 : 1), Daumen in Akzent. Kein Verlauf. Trefferfläche 28 px, am Telefon 44 px.
 */
function Regler({ id, label, wert, min, max, schritt, onChange, anzeige, hinweis }: { id: string; label: string; wert: number; min: number; max: number; schritt: number; onChange: (v: number) => void; anzeige: string; hinweis?: string }) {
  const p = ((wert - min) / (max - min)) * 100;
  const hid = useId();
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-x-3 gap-y-0.5 max-[359px]:flex-col max-[359px]:items-start">
        <label htmlFor={id} className="text-[14px] font-medium text-fg-2">
          {label}
        </label>
        <span className="num shrink-0 whitespace-nowrap text-[18px] font-semibold tracking-[-0.01em] text-fg">{anzeige}</span>
      </div>
      <div className="relative h-11 sm:h-7">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--line-strong)]">
          <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--ink)]" style={{ width: `calc(${(p / 100).toFixed(4)} * (100% - 18px) + 9px)` }} />
        </span>
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
            "relative block h-full w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none",
            "[&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:mt-[calc((var(--rh)-18px)/2)] [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--ink)] [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--surface)]",
            "[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--ink)] [&::-moz-range-thumb]:shadow-[0_0_0_3px_var(--surface)]",
            "focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--focus)] focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--focus)]",
            "[--rh:44px] sm:[--rh:28px]",
          )}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-2 text-[12px] leading-4 text-fg-4">
        <span>{min}</span>
        {hinweis && (
          // am Telefon eigene Zeile unter der Skala (5 … 120), sonst mittig zwischen den Marken
          <span id={hid} className="px-2 text-center text-fg-3 max-sm:order-last max-sm:mt-1 max-sm:basis-full max-sm:px-0 max-sm:text-left">
            {hinweis}
          </span>
        )}
        <span>{max}</span>
      </div>
    </div>
  );
}

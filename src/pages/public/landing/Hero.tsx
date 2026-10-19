import { useNavigate } from "react-router";
import { ArrowRight, ChevronRight, Infinity as InfinityIcon, ServerCog, ShieldCheck } from "lucide-react";
import { AnimatedNumber, Button } from "@/components/ui";
import { scrollZu } from "./basis";
import { LivePreview } from "./LivePreview";
import { useAnfrage } from "./Anfrage";
import { NBSP, schuetzeKennzahlen } from "@/lib/typografie";

/**
 * Einstieg (DESIGN-SYSTEM.md 14.2): ein Satz, eine Einleitung, eine Primäraktion – rechts (ab 1280 px; schmaler wäre das Fenster
 * zu eng für seine zwei Spalten) bzw. darunter das flache Produktfenster. Keine Einblendung beim Laden, kein Verlauf, keine Farbe.
 */
export function Hero() {
  const nav = useNavigate();
  return (
    <section aria-labelledby="hero-titel" className="px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-20 lg:px-8 lg:pb-24">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 md:gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="min-w-0">
          <p className="chip chip-outline !h-7 !px-2.5 !text-[13px]">
            <span className="font-semibold text-fg">Neu</span>
            <span aria-hidden className="text-fg-4">·</span>
            KI-Fallanalyse mit Präzedenzfällen
          </p>

          <h1 id="hero-titel" className="mt-6 text-[40px] font-semibold leading-[44px] tracking-[-0.035em] text-fg sm:text-[48px] sm:leading-[52px] xl:text-[56px] xl:leading-[60px]">
            <span className="whitespace-nowrap">Ein Werkzeug.</span>
            <br />
            <span className="whitespace-nowrap text-fg-3">Volle Kontrolle.</span>
          </h1>

          <p className="mt-6 max-w-[600px] text-[17px] leading-7 text-fg-2 md:text-[18px]">
            Die Kanzlei-Software, die mitdenkt: Akten, beA, Fristen, Abrechnung und eine KI, die passende Präzedenzfälle in Sekunden findet – mit Gericht, Datum und Aktenzeichen. Einmal investieren, dauerhaft nutzen – ohne Abo und ohne versteckte Monatsgebühren.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/login")}>
              Demo starten
            </Button>
            <Button variant="secondary" size="lg" onClick={() => useAnfrage.getState().oeffne("testzugang")}>
              Testzugang anfordern
            </Button>
            <button type="button" onClick={() => scrollZu("funktionen")} className="link-leise min-h-11 !text-[14px] sm:ml-2 sm:min-h-10">
              Funktionen ansehen <ChevronRight aria-hidden />
            </button>
          </div>

          <ul className="mt-10 flex flex-col gap-2.5 text-[13px] leading-[18px] text-fg-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {[
              { i: <ShieldCheck className="size-4" />, t: "Verschwiegenheit nach § 203 StGB" },
              { i: <ServerCog className="size-4" />, t: "Deutsches Rechenzentrum oder eigener Server in der Kanzlei" },
              { i: <InfinityIcon className="size-4" />, t: "Lifetime-Lizenz statt Abo" },
            ].map((x) => (
              <li key={x.t} className="flex items-center gap-2">
                <span className="shrink-0 text-fg-4" aria-hidden>
                  {x.i}
                </span>
                {x.t}
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <LivePreview />
        </div>
      </div>
    </section>
  );
}

/** Herleitung der Kennzahlen (Fußnoten ¹ ² ³) – inhaltlich unverändert; Zahl und Einheit stehen immer zusammen (I5-T00-01). */
const FUSSNOTEN = [
  "Zielwert, kein garantiertes Ergebnis – die tatsächliche Ersparnis hängt von Kanzleigröße, Fallzahlen und Abläufen; der 38h-Motor misst sie je bearbeitetem Vorgang.",
  "38 Std. × 48 Arbeitswochen × ≈ 19,74 € interner Kostensatz je Stunde – ein bewusst niedrig angesetzter Zielwert; mit ReFa-Vollkosten von ca. 26 €/Std. wären es ≈ 47.500 €.",
  "Messbar im Produkt: Die Suche in der Fall-Datenbank zeigt ihre Dauer in Millisekunden an (Strg+K), die KI-Fallanalyse nennt ihre Laufzeit im Ergebnis – im Prototyp über einen kuratierten Auszug echter Leitentscheidungen.",
].map(schuetzeKennzahlen);

/** Kennzahlen (DESIGN-SYSTEM.md 14.3): eine Zeile, vier Spalten, getrennt durch 1-px-Linien – ohne Karte, ohne Symbolkacheln. */
export function Kennzahlen() {
  const items = [
    { wert: <><span className="text-fg-3">Ø</span>{NBSP}<AnimatedNumber value={38} />{NBSP}Std.</>, text: "Zielwert: Routinearbeit pro Woche und Kanzlei, erledigt oder zur Freigabe vorbereitet¹", fussnote: 1 },
    { wert: <>≈{NBSP}<AnimatedNumber value={36000} />{NBSP}€</>, text: "Wert der gesparten Zeit pro Jahr – im Rechenbeispiel²", fussnote: 2 },
    { wert: <><AnimatedNumber value={0} />{NBSP}€</>, text: "Monatliche Abo-Gebühren mit der Lifetime-Lizenz" },
    { wert: <>Sekunden</>, text: "bis zum passenden Präzedenzfall³", fussnote: 3 },
  ];
  return (
    <section aria-label="Apex in Zahlen" className="px-4 py-8 sm:px-6 md:py-12 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-[1200px]">
        <ul className="grid grid-cols-2 border-y border-[var(--line)] lg:grid-cols-4">
          {items.map((x, k) => (
            <li
              key={k}
              className={
                "flex min-w-0 flex-col gap-2 py-6 sm:py-8 lg:px-8 " +
                (k % 2 === 0 ? "pr-4 sm:pr-6 " : "border-l border-[var(--line)] pl-4 sm:pl-6 ") +
                (k >= 2 ? "border-t border-[var(--line)] lg:border-t-0 " : "") +
                (k === 0 ? "lg:!pl-0 " : "lg:border-l lg:border-[var(--line)] ") +
                (k === items.length - 1 ? "lg:!pr-0" : "")
              }
              aria-describedby={x.fussnote ? `fussnote-${x.fussnote}` : undefined}
            >
              <span className="num text-[26px] font-semibold leading-8 tracking-[-0.025em] text-fg sm:text-[36px] sm:leading-[44px]">{x.wert}</span>
              <span className="text-[14px] leading-5 text-fg-3">{x.text}</span>
            </li>
          ))}
        </ul>
        {/* Fußnoten als Liste – eine je Zeile, lesbare Zeilenlänge (≤ 65 Zeichen) und eine Stufe größer (I4-T00-03) */}
        <ol aria-label="Fußnoten" className="mt-6 grid max-w-[62ch] gap-2 text-[14px] leading-[22px] text-fg-3">
          {FUSSNOTEN.map((f, k) => (
            <li key={k} id={`fussnote-${k + 1}`} className="flex gap-2">
              <span aria-hidden className="w-2 shrink-0 text-fg-4">
                {"¹²³"[k]}
              </span>
              <span>
                <span className="sr-only">Fußnote {k + 1}: </span>
                {f}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

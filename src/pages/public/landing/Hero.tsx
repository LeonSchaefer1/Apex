import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, Infinity as InfinityIcon, ServerCog, ShieldCheck, Clock3, Euro, Library } from "lucide-react";
import { AnimatedNumber, Button } from "@/components/ui";
import { Reveal, scrollZu } from "./basis";
import { LivePreview } from "./LivePreview";
import { useAnfrage } from "./Anfrage";
import { NBSP, schuetzeKennzahlen } from "@/lib/typografie";

const spring = { type: "spring" as const, stiffness: 240, damping: 28 };

export function Hero() {
  const nav = useNavigate();
  return (
    <section className="relative px-4 pb-14 pt-10 sm:px-6 md:pt-16 lg:pb-20">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }} className="glass-thin inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-[12.5px] font-medium text-fg-2">
            <span className="grid h-5 place-items-center rounded-full bg-ink px-2 text-[12px] font-semibold text-[var(--on-ink)]">Neu</span>
            KI-Fallanalyse mit Präzedenzfällen
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="mt-6 text-[clamp(42px,5.1vw,72px)] font-bold leading-[0.98] tracking-[-0.05em] [&>span]:whitespace-nowrap"
          >
            <span>Ein Werkzeug.</span>
            <br />
            <span className="bg-clip-text pb-[0.06em] text-transparent" style={{ backgroundImage: "linear-gradient(100deg, var(--ink-bright) 0%, var(--ink) 45%, var(--ink-deep) 100%)" }}>
              Volle Kontrolle.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }} className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-fg-2 md:text-[18px]">
            Die Kanzlei-Software, die mitdenkt: Akten, beA, Fristen, Abrechnung und eine KI, die passende Präzedenzfälle in Sekunden findet – mit Gericht, Datum und Aktenzeichen. Einmal investieren, dauerhaft nutzen – ohne Abo und ohne versteckte Monatsgebühren.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.26 }} className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/login")}>
              Demo starten
            </Button>
            <Button variant="secondary" size="lg" onClick={() => useAnfrage.getState().oeffne("testzugang")}>
              Testzugang anfordern
            </Button>
            <Button variant="ghost" size="lg" onClick={() => scrollZu("funktionen")}>
              Funktionen ansehen
            </Button>
          </motion.div>

          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 text-[13px] text-fg-3">
            {[
              { i: <ShieldCheck className="size-4 text-green" />, t: "Verschwiegenheit nach § 203 StGB" },
              { i: <ServerCog className="size-4 text-ink" />, t: "Deutsches Rechenzentrum oder eigener Server in der Kanzlei" },
              { i: <InfinityIcon className="size-4 text-ink" />, t: "Lifetime-Lizenz statt Abo" },
            ].map((x) => (
              <li key={x.t} className="flex items-center gap-2">
                {x.i}
                {x.t}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.15 }} className="min-w-0">
          <LivePreview />
        </motion.div>
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

/** Kennzahlenleiste unter dem Hero. */
export function Kennzahlen() {
  const items = [
    { icon: <Clock3 className="size-[18px]" />, wert: <><span className="font-semibold text-fg-3">Ø</span>{NBSP}<AnimatedNumber value={38} />{NBSP}Std.</>, text: "Zielwert: Routinearbeit pro Woche und Kanzlei, erledigt oder zur Freigabe vorbereitet¹", fussnote: 1 },
    { icon: <Euro className="size-[18px]" />, wert: <>≈{NBSP}<AnimatedNumber value={36000} />{NBSP}€</>, text: "Wert der gesparten Zeit pro Jahr – im Rechenbeispiel²", fussnote: 2 },
    { icon: <InfinityIcon className="size-[18px]" />, wert: <><AnimatedNumber value={0} />{NBSP}€</>, text: "Monatliche Abo-Gebühren mit der Lifetime-Lizenz" },
    { icon: <Library className="size-[18px]" />, wert: <>Sekunden</>, text: "bis zum passenden Präzedenzfall³", fussnote: 3 },
  ];
  return (
    <section aria-label="AnwaltApex in Zahlen" className="px-4 sm:px-6">
      <Reveal className="mx-auto max-w-[1200px]">
        <ul className="glass grid grid-cols-2 gap-px overflow-hidden rounded-[26px] lg:grid-cols-4">
          {items.map((x, k) => (
            <li key={k} className="relative z-[2] flex flex-col gap-2 p-5 sm:p-6" aria-describedby={x.fussnote ? `fussnote-${x.fussnote}` : undefined}>
              <span className="grid size-9 place-items-center rounded-[12px] bg-ink-soft text-ink">{x.icon}</span>
              <span className="num text-[clamp(24px,3vw,34px)] font-bold leading-none tracking-[-0.04em]">{x.wert}</span>
              <span className="text-[13px] leading-snug text-fg-3">{x.text}</span>
            </li>
          ))}
        </ul>
        {/* Fußnoten als Liste – eine je Zeile, lesbare Zeilenlänge (≤ 65 Zeichen) und eine Stufe größer (I4-T00-03) */}
        <ol aria-label="Fußnoten" className="mt-4 grid max-w-[54ch] gap-1.5 px-2 text-[14px] leading-relaxed text-fg-2">
          {FUSSNOTEN.map((f, k) => (
            <li key={k} id={`fussnote-${k + 1}`} className="flex gap-1.5">
              <span aria-hidden className="shrink-0">
                {"¹²³"[k]}
              </span>
              <span>
                <span className="sr-only">Fußnote {k + 1}: </span>
                {f}
              </span>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}

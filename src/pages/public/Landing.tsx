import { useRef } from "react";
import { MotionConfig } from "motion/react";
import { Navigation } from "./landing/Navigation";
import { Hero, Kennzahlen } from "./landing/Hero";
import { Funktionen } from "./landing/Funktionen";
import { MotorAbschnitt } from "./landing/Motor";
import { Vergleich } from "./landing/Vergleich";
import { Lifetime } from "./landing/Lifetime";
import { UmzugBand, Vertrauen } from "./landing/Vertrauen";
import { Erfahrungen, Faq, Fusszeile, Schluss } from "./landing/Abschluss";
import { AnfrageDialog } from "./landing/Anfrage";

/** Öffentliche Produktseite (/willkommen) – stellt AnwaltApex Interessenten vor. Scrollt im eigenen Container. */
export default function Landing() {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <MotionConfig reducedMotion="user">
    <div ref={scrollRef} id="landing-scroll" className="relative z-10 h-full overflow-y-auto overflow-x-hidden">
      <Navigation scrollRef={scrollRef} />
      <main>
        <Hero />
        <Kennzahlen />
        <Funktionen />
        <MotorAbschnitt />
        <Vergleich />
        <Lifetime />
        <UmzugBand />
        <Vertrauen />
        <Erfahrungen />
        <Faq />
        <Schluss />
      </main>
      <Fusszeile />
      <AnfrageDialog />
    </div>
    </MotionConfig>
  );
}

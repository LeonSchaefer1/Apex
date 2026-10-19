import { useRef } from "react";
import { MotionConfig } from "motion/react";
import { Navigation } from "./landing/Navigation";
import { Hero, Kennzahlen } from "./landing/Hero";
import { Funktionen } from "./landing/Funktionen";
import { MotorAbschnitt } from "./landing/Motor";
import { Vergleich } from "./landing/Vergleich";
import { Lifetime } from "./landing/Lifetime";
import { UmzugBand, Vertrauen } from "./landing/Vertrauen";
import { Faq, Fusszeile, Schluss } from "./landing/Abschluss";
import { AnfrageDialog } from "./landing/Anfrage";

/**
 * Öffentliche Produktseite (/willkommen) – stellt Apex Interessenten vor. Scrollt im eigenen Container.
 * Aufbau nach DESIGN-SYSTEM.md 14: alles auf --bg, Abschnitte nur durch Abstand und höchstens eine Linie getrennt.
 * scroll-padding = Höhe des Kopfs: Sprungziele und fokussierte Elemente liegen nie unter der Navigation (WCAG 2.4.11).
 * Der frühere Abschnitt „Erfahrungen“ entfällt – seine Punkte stehen inhaltlich gleich im Vergleich.
 */
export default function Landing() {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <MotionConfig reducedMotion="user">
      <div ref={scrollRef} id="landing-scroll" className="relative z-10 h-full scroll-pt-16 overflow-y-auto overflow-x-hidden bg-[var(--bg)]">
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
          <Faq />
          <Schluss />
        </main>
        <Fusszeile />
        <AnfrageDialog />
      </div>
    </MotionConfig>
  );
}

// „Bewegung reduzieren“ für alle motion-Animationen (I4-T01-02, I4-T12-01): `MotionConfig reducedMotion="user"` schaltet nur
// Transform- und Layout-Animationen ab – Deckkraft, Farbe, Höhe, clip-path liefen weiter, auch als Endlos-Animation (Glühen der
// Kugel, Lade- und Sprechanzeigen, Wiki-Szenen). Bei reduzierter Bewegung springt deshalb jede motion-Animation sofort an ihr
// Ziel (wie die CSS-Regel in index.css für CSS-Animationen). Änderungen der Systemeinstellung zur Laufzeit werden übernommen.
import { MotionGlobalConfig } from "motion/react";

export function bewegungReduzierenAnwenden(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  const setzen = () => {
    MotionGlobalConfig.skipAnimations = m.matches;
  };
  setzen();
  m.addEventListener?.("change", setzen);
}

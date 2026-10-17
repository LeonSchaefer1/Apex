import { useMedia } from "./useMedia";

/**
 * „Bewegung reduzieren“ (prefers-reduced-motion) – reagiert auch auf eine Änderung zur Laufzeit (anders als `useReducedMotion`
 * aus motion, das den Wert nur einmal liest). `MotionConfig reducedMotion="user"` schaltet nur Transform- und Layout-Animationen
 * ab; Endlos-Animationen von Deckkraft, clip-path, Farbe usw. müssen die Komponenten selbst abschalten (I4-T01-02).
 */
export function useBewegungReduziert(): boolean {
  return useMedia("(prefers-reduced-motion: reduce)");
}

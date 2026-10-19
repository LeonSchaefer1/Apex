import { cn } from "@/lib/cn";

/**
 * Bildmarke „Eckpunkt“ (docs/design/DESIGN-SYSTEM.md 0.1/3): zwei gleich lange Schenkel im rechten Winkel, in der Öffnung ein
 * Punkt auf der Winkelhalbierenden – Scheitel (apex), rechter Winkel, geheftete Aktenecke; der Punkt ist auch das Fristende.
 * 32er-Raster: Schenkel 20 × 5, Punkt r 3,5 bei (18,5 | 18,5), 4 Einheiten Luft zu beiden Schenkeln.
 */
export const MARKE_PFAD = "M6 6h20v5H11v15H6z";
export const MARKE_PUNKT = { cx: 18.5, cy: 18.5, r: 3.5 } as const;

/** Bildmarke, immer einfarbig in `currentColor`. `mono` bleibt aus Kompatibilität, hat aber keine Wirkung mehr. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} fill="currentColor" aria-hidden focusable="false">
      <path d={MARKE_PFAD} />
      <circle cx={MARKE_PUNKT.cx} cy={MARKE_PUNKT.cy} r={MARKE_PUNKT.r} />
    </svg>
  );
}

/**
 * App-Icon: flaches Quadrat in Robenschwarz (dunkel: Papierweiß), Radius = Größe × 0,22, Marke in der Gegenfarbe – optisch um
 * 1/32 nach rechts unten versetzt, weil das Gewicht des Zeichens links oben liegt. Kein Verlauf, kein Schatten, keine Innenkante.
 */
export function AppIcon({ size = 36, className }: { size?: number; className?: string }) {
  const marke = size * 0.625; // wie brand/app-icon.svg: 32er-Feld = 62,5 % der Kante, Versatz 1 Rastereinheit
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size, borderRadius: size * 0.22, background: "var(--ink)", color: "var(--on-ink)" }}
      aria-hidden
    >
      <svg width={marke} height={marke} viewBox="0 0 32 32" fill="currentColor" style={{ transform: `translate(${(marke / 32).toFixed(2)}px, ${(marke / 32).toFixed(2)}px)` }} focusable="false">
        <path d={MARKE_PFAD} />
        <circle cx={MARKE_PUNKT.cx} cy={MARKE_PUNKT.cy} r={MARKE_PUNKT.r} />
      </svg>
    </span>
  );
}

/** Schriftzug „Apex“ (ohne Bildmarke; die Beschreibung „Apex – Kanzleisoftware“ steht nur in Seitentitel und Meta-Angaben). */
export function Wordmark({ className, size = 15 }: { className?: string; size?: number }) {
  return (
    <span className={cn("font-semibold tracking-[-0.02em] text-fg", className)} style={{ fontSize: size, lineHeight: 1.2 }}>
      Apex
    </span>
  );
}

/** Wortmarke: Bildmarke + „Apex“ – Marke 20 px, Schrift 15/600, Abstand 8 px (bei anderer Größe proportional). */
export function Wortmarke({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center text-fg", className)} style={{ gap: Math.round(size * 0.4) }}>
      <LogoMark size={size} />
      <Wordmark size={Math.round(size * 0.75)} />
    </span>
  );
}

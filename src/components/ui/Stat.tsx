import { Children, createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * Kennzahl mit tabellarischen Ziffern. Standard: sofort der Endwert – Geldbeträge und Kennzahlen zeigen nie Zwischenwerte
 * (kein „36,93 €“ statt „40,00 €“). `hochzaehlen` nur für reine Mengen; bei „Bewegung reduzieren“ nie.
 */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("de-DE"), className, hochzaehlen = false }: { value: number; format?: (n: number) => string; className?: string; hochzaehlen?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduziert = useReducedMotion();
  const zaehlen = hochzaehlen && !reduziert;
  const [shown, setShown] = useState(zaehlen ? 0 : value);
  const gezaehlt = useRef(false);
  useEffect(() => {
    if (!zaehlen || gezaehlt.current) {
      setShown(value);
      return;
    }
    if (!inView) return;
    gezaehlt.current = true;
    // nur einmal beim ersten Erscheinen und nur ganzzahlig – spätere Änderungen erscheinen sofort
    const ctl = animate(0, value, { duration: 0.6, ease: [0.2, 0, 0, 1], onUpdate: (n) => setShown(Math.round(n)), onComplete: () => setShown(value) });
    return () => {
      ctl.stop();
      setShown(value);
    };
  }, [value, inView, zaehlen]);
  return (
    <span ref={ref} className={cn("num", className)}>
      {format(zaehlen ? shown : value)}
    </span>
  );
}

/** Innerhalb einer StatLeiste stehen Kennzahlen ohne eigene Karte (Linien trennen sie). */
const LeisteKontext = createContext(false);

/**
 * Kennzahl (DESIGN-SYSTEM.md 12.14): Label 13 Text 3 (optional Symbol 14 px davor), Wert 28/600 mit tabellarischen Ziffern, Zusatz
 * 13 Text 4. `tone` färbt nur das Symbol, nie den Wert oder eine Fläche. Allein steht die Kennzahl auf einer Karte; mehrere stehen
 * besser in einer `StatLeiste` (eine Karte, getrennt durch 1-px-Linien). Mit `onClick` ist die ganze Kachel ein Knopf.
 */
export function Stat({ label, value, sub, icon, tone = "ink", className, onClick }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "ink" | "seal" | "amber" | "green" | "violet"; className?: string; onClick?: () => void }) {
  const inLeiste = useContext(LeisteKontext);
  const toneCls = { ink: "text-fg-4", seal: "text-seal", amber: "text-amber", green: "text-green", violet: "text-fg-4" }[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col gap-2 text-left",
        inLeiste ? "px-5 py-4" : "sheet rounded-lg p-4",
        onClick && "transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {icon && <span className={cn("shrink-0 [&>svg]:size-3.5", toneCls)} aria-hidden>{icon}</span>}
        {/* schmale Kacheln (2 Spalten mobil): Beschriftung darf umbrechen statt abgeschnitten zu werden */}
        <div className="line-clamp-2 min-w-0 text-[13px] leading-[18px] text-fg-3">{label}</div>
      </div>
      <div className="num text-[28px] font-semibold leading-8 tracking-[-0.02em] text-fg">{value}</div>
      {sub && <div className="line-clamp-2 text-[13px] leading-[18px] text-fg-4">{sub}</div>}
    </Comp>
  );
}

/** Kennzahlenleiste: mehrere `Stat` in einer Karte, getrennt durch 1-px-Linien; am Telefon zwei Spalten. */
export function StatLeiste({ children, spalten, className }: { children: ReactNode; spalten?: number; className?: string }) {
  const anzahl = spalten ?? Children.toArray(children).filter(Boolean).length;
  return (
    <LeisteKontext.Provider value>
      <div className={cn("stat-leiste", className)} style={{ ["--stat-spalten" as string]: String(Math.max(1, anzahl)) }}>
        {children}
      </div>
    </LeisteKontext.Provider>
  );
}

/** Ring für genau einen Anteil: Strich 4 px, Spur Linie, Wert Akzent, gerade Enden, Übergang 220 ms. */
export function ProgressRing({ value, size = 44, stroke = 4, className, children, color = "var(--ink)" }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="butt" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: "stroke-dashoffset 220ms cubic-bezier(0.2,0,0,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Mini-Verlauf: Linie 1,5 px in --chart-1, keine Fläche, kein Verlauf, Endpunkt 3 px. */
export function Sparkline({ values, width = 160, height = 44, color = "var(--chart-1)", className }: { values: number[]; width?: number; height?: number; color?: string; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pad = 4;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Verlauf">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="var(--line)" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={color} />
    </svg>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
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
    const ctl = animate(0, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (n) => setShown(Math.round(n)), onComplete: () => setShown(value) });
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

export function Stat({ label, value, sub, icon, tone = "ink", className, onClick }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "ink" | "seal" | "amber" | "green" | "violet"; className?: string; onClick?: () => void }) {
  const toneCls = { ink: "bg-ink-soft text-ink", seal: "bg-seal-soft text-seal", amber: "bg-amber-soft text-amber", green: "bg-green-soft text-green", violet: "bg-violet-soft text-violet" }[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn("sheet glow relative flex min-w-0 flex-col gap-3 rounded-[22px] p-4 text-left", onClick && "transition-transform duration-300 ease-[var(--spring)] hover:-translate-y-0.5 active:scale-[0.98]", className)}
    >
      <div className="flex items-center gap-2.5">
        {icon && <div className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", toneCls)}>{icon}</div>}
        {/* schmale Kacheln (2 Spalten mobil): Beschriftung darf umbrechen statt abgeschnitten zu werden */}
        <div className="line-clamp-2 min-w-0 text-[12.5px] font-medium leading-snug text-fg-3">{label}</div>
      </div>
      <div className="text-[28px] font-semibold leading-none tracking-[-0.03em]">{value}</div>
      {sub && <div className="line-clamp-2 text-[12px] leading-snug text-fg-3">{sub}</div>}
    </Comp>
  );
}

export function ProgressRing({ value, size = 44, stroke = 5, className, children, color = "var(--ink)" }: { value: number; size?: number; stroke?: number; className?: string; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Mini-Verlauf mit Fläche, dezentem Raster und betontem Endpunkt. */
export function Sparkline({ values, width = 160, height = 44, color = "var(--ink)", className }: { values: number[]; width?: number; height?: number; color?: string; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pad = 4;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(values.length - 1)},${height - pad} L${x(0)},${height - pad} Z`;
  const gid = `sg-${Math.round(values.reduce((s, v) => s + v, 0))}-${values.length}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Verlauf">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="var(--line)" />
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

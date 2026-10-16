// Monatsumsatz als maßstabsgetreues Säulendiagramm: Nulllinie, dezentes Raster, betonter aktueller Monat, Tooltip.
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtEUR } from "@/core/dates";
import { fmtEURkompakt } from "./lib";
import { useMeasure } from "./ui";

export interface MonatsWert {
  key: string;
  label: string; // „Okt.“
  langLabel: string; // „Oktober 2026“
  wert: number;
  anzahl: number;
  aktuell: boolean;
}

export function niceTicks(max: number): number[] {
  const m = max > 0 ? max : 1000;
  let best: number[] | null = null;
  for (const ziel of [4, 5, 3]) {
    const roh = m / ziel;
    const pot = 10 ** Math.floor(Math.log10(roh));
    const n = roh / pot;
    const schritt = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
    const oben = Math.ceil(m / schritt) * schritt;
    const ticks: number[] = [];
    for (let v = 0; v <= oben + schritt / 2; v += schritt) ticks.push(Math.round(v));
    if (!best || oben < best[best.length - 1]) best = ticks;
  }
  return best!;
}

function saeule(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function UmsatzChart({ daten, hoehe = 236 }: { daten: MonatsWert[]; hoehe?: number }) {
  const [ref, breite] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...daten.map((d) => d.wert), 0));
  const oben = ticks[ticks.length - 1] || 1;
  const m = { l: breite < 420 ? 52 : 62, r: 6, t: 30, b: 28 };
  const iw = Math.max(0, breite - m.l - m.r);
  const ih = hoehe - m.t - m.b;
  const band = daten.length ? iw / daten.length : 0;
  const bw = Math.min(band * 0.58, 58);
  const y = (v: number) => m.t + ih * (1 - v / oben);
  const xs = daten.map((_, i) => m.l + i * band + (band - bw) / 2);
  const aktivIdx = hover ?? daten.findIndex((d) => d.aktuell);
  const aktiv = aktivIdx >= 0 ? daten[aktivIdx] : undefined;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: hoehe }}>
      {breite > 0 && (
        <svg width={breite} height={hoehe} role="img" aria-label={`Abgerechneter Umsatz je Monat: ${daten.map((d) => `${d.langLabel} ${fmtEUR(d.wert)}`).join(", ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={breite - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line-strong)" : "var(--line)"} strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={m.l - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--fg-3)" className="num">
                {fmtEURkompakt(t)}
              </text>
            </g>
          ))}
          {daten.map((d, i) => {
            const h = Math.max(0, y(0) - y(d.wert));
            const an = hover === i;
            return (
              <g key={d.key}>
                <motion.path
                  d={saeule(xs[i], y(d.wert), bw, h, 7)}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 30, delay: 0.08 + i * 0.05 }}
                  style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                  fill="var(--ink)"
                  fillOpacity={d.aktuell ? 1 : an ? 0.42 : 0.22}
                />
                {d.aktuell && d.wert > 0 && (
                  <motion.text
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    x={xs[i] + bw / 2}
                    y={y(d.wert) - 9}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={650}
                    fill="var(--fg)"
                    className="num"
                  >
                    {fmtEUR(d.wert, { cents: false })}
                  </motion.text>
                )}
                <text x={xs[i] + bw / 2} y={hoehe - 8} textAnchor="middle" fontSize={11.5} fontWeight={d.aktuell ? 650 : 500} fill={d.aktuell ? "var(--fg)" : "var(--fg-3)"}>
                  {d.label}
                </text>
                <rect
                  x={m.l + i * band}
                  y={m.t - 10}
                  width={band}
                  height={ih + 10}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((h0) => (h0 === i ? null : h0))}
                  onClick={() => setHover((h0) => (h0 === i ? null : i))}
                />
              </g>
            );
          })}
        </svg>
      )}
      <AnimatePresence>
        {hover !== null && aktiv && breite > 0 && (
          <motion.div
            key={aktiv.key}
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="glass-strong pointer-events-none absolute z-10 min-w-[150px] rounded-[14px] px-3 py-2 text-[12px]"
            style={{
              left: Math.min(Math.max(xs[aktivIdx] + bw / 2, 80), breite - 80),
              top: Math.max(4, y(aktiv.wert) - 12),
              translateX: "-50%",
              translateY: "-100%",
            }}
          >
            <div className="font-semibold">
              {aktiv.langLabel}
              {aktiv.aktuell && <span className="font-normal text-fg-3"> · bis heute</span>}
            </div>
            <div className="num mt-0.5 text-[14px] font-semibold">{fmtEUR(aktiv.wert)}</div>
            <div className="text-fg-3">
              netto · {aktiv.anzahl} {aktiv.anzahl === 1 ? "Rechnung" : "Rechnungen"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

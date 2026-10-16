import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDate, fmtNum, fromISO, wochentagName } from "@/core/dates";
import { useBreite } from "./shared";

export interface TagWert {
  datum: string;
  minuten: number;
  /** bearbeitete Vorgänge (je Vorgang gezählt) */
  laeufe: number;
}

/** Säulendiagramm: gesparte Stunden je Tag der letzten 7 Tage – maßstabsgetreu, mit Tooltip je Säule. */
export function WochenChart({ tage, heute }: { tage: TagWert[]; heute: string }) {
  const [ref, breite] = useBreite<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hoehe = 196;
  const pad = { l: 34, r: 6, t: 26, b: 40 };
  const w = Math.max(breite, 240);
  const plotW = w - pad.l - pad.r;
  const plotH = hoehe - pad.t - pad.b;

  const maxStd = Math.max(...tage.map((t) => t.minuten / 60), 1);
  const schritt = maxStd > 12 ? 4 : maxStd > 6 ? 2 : 1;
  const yMax = Math.ceil(maxStd / schritt) * schritt;
  const ticks = Array.from({ length: yMax / schritt + 1 }, (_, i) => i * schritt);
  const slot = plotW / tage.length;
  const barW = Math.min(24, slot * 0.5);
  const y = (std: number) => pad.t + plotH - (std / yMax) * plotH;
  const base = pad.t + plotH;

  const balken = (x: number, top: number) => {
    const h = base - top;
    const r = Math.min(4, h);
    if (h <= 0.5) return "";
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
  };

  const aktiv = hover ?? tage.length - 1;
  const t = tage[aktiv];

  return (
    <div ref={ref} className="relative w-full select-none">
      {breite > 0 && (
        <svg width={w} height={hoehe} role="img" aria-label="Gesparte Stunden je Tag, letzte 7 Tage" className="block overflow-visible">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="num fill-[var(--fg-3)] text-[12px]">
                {v}
              </text>
            </g>
          ))}
          <text x={pad.l - 8} y={pad.t - 14} textAnchor="end" className="fill-[var(--fg-3)] text-[12px]">
            Std.
          </text>
          {tage.map((d, i) => {
            const std = d.minuten / 60;
            const cx = pad.l + slot * i + slot / 2;
            const x = cx - barW / 2;
            const istHeute = d.datum === heute;
            const betont = i === aktiv;
            return (
              <g key={d.datum}>
                <motion.path
                  d={balken(x, y(std))}
                  fill="var(--ink)"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1, opacity: betont ? 1 : istHeute ? 0.85 : 0.42 }}
                  transition={{ scaleY: { type: "spring", stiffness: 260, damping: 26, delay: 0.15 + i * 0.05 }, opacity: { duration: 0.2 } }}
                  style={{ originX: 0.5, originY: 1 }}
                />
                {betont && std > 0 && (
                  <text x={cx} y={y(std) - 8} textAnchor="middle" className="num fill-[var(--fg)] text-[12px] font-semibold">
                    {fmtNum(std, 1)}
                  </text>
                )}
                <text x={cx} y={base + 16} textAnchor="middle" className={istHeute ? "fill-[var(--fg)] text-[12px] font-semibold" : "fill-[var(--fg-3)] text-[12px]"}>
                  {istHeute ? "Heute" : wochentagName(d.datum, true)}
                </text>
                <text x={cx} y={base + 31} textAnchor="middle" className="num fill-[var(--fg-3)] text-[12px]">
                  {`${fromISO(d.datum).getUTCDate()}.${fromISO(d.datum).getUTCMonth() + 1}.`}
                </text>
                <rect
                  x={pad.l + slot * i}
                  y={pad.t - 10}
                  width={slot}
                  height={plotH + 10}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(i)}
                  style={{ cursor: "default" }}
                />
              </g>
            );
          })}
        </svg>
      )}
      <AnimatePresence>
        {hover !== null && t && (
          <motion.div
            key="tt"
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="glass-strong pointer-events-none absolute z-10 rounded-[12px] px-3 py-2 text-[12px] leading-tight"
            style={{
              left: Math.min(Math.max(pad.l + slot * hover + slot / 2, 80), w - 80),
              top: Math.max(0, y(t.minuten / 60) - 64),
              x: "-50%",
            }}
          >
            <div className="font-semibold">
              {wochentagName(t.datum, true)}, {fmtDate(t.datum)}
            </div>
            <div className="mt-0.5 text-fg-2">
              <span className="num font-semibold text-fg">{fmtNum(t.minuten / 60, 1)} Std.</span> gespart · <span className="num">{t.laeufe}</span> {t.laeufe === 1 ? "Vorgang" : "Vorgänge"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <table className="sr-only">
        <caption>Gesparte Stunden je Tag</caption>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Stunden</th>
            <th>Vorgänge</th>
          </tr>
        </thead>
        <tbody>
          {tage.map((d) => (
            <tr key={d.datum}>
              <td>{fmtDate(d.datum)}</td>
              <td>{fmtNum(d.minuten / 60, 1)}</td>
              <td>{d.laeufe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

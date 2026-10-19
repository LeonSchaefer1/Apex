import { useState } from "react";
import { fmtDate, fmtNum, fromISO, wochentagName } from "@/core/dates";
import { useBreite } from "./shared";

export interface TagWert {
  datum: string;
  minuten: number;
  /** bearbeitete Vorgänge (je Vorgang gezählt) */
  laeufe: number;
}

/**
 * Säulendiagramm (DESIGN-SYSTEM.md 12.15): gesparte Stunden je Tag der letzten 7 Tage – maßstabsgetreu. Übrige Tage in --chart-2,
 * heute bzw. der gewählte Tag in --chart-1 mit Wert darüber; Tooltip als Menü-Fläche. Kein Verlauf, keine Federn.
 */
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
  const barW = Math.min(32, slot * 0.5);
  const y = (std: number) => pad.t + plotH - (std / yMax) * plotH;
  const base = pad.t + plotH;

  const balken = (x: number, top: number) => {
    const h = base - top;
    const r = Math.min(2, h);
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
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--chart-grid)"} strokeWidth={1} />
              <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="num fill-[var(--fg-4)] text-[12px]">
                {v}
              </text>
            </g>
          ))}
          <text x={pad.l - 8} y={pad.t - 14} textAnchor="end" className="fill-[var(--fg-4)] text-[12px]">
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
                <path d={balken(x, y(std))} fill={betont ? "var(--chart-1)" : "var(--chart-2)"} style={{ transition: "fill 100ms cubic-bezier(0.2,0,0,1)" }} />
                {betont && std > 0 && (
                  <text x={cx} y={y(std) - 8} textAnchor="middle" className="num fill-[var(--fg-2)] text-[12px] font-medium">
                    {fmtNum(std, 1)}
                  </text>
                )}
                <text x={cx} y={base + 16} textAnchor="middle" className={istHeute ? "fill-[var(--fg)] text-[12px] font-semibold" : "fill-[var(--fg-4)] text-[12px]"}>
                  {istHeute ? "Heute" : wochentagName(d.datum, true)}
                </text>
                <text x={cx} y={base + 31} textAnchor="middle" className="num fill-[var(--fg-4)] text-[12px]">
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
      {hover !== null && t && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-sm border border-[var(--line)] bg-[var(--surface-pop)] px-2 py-1.5 text-[12px] leading-4 shadow-pop"
          style={{
            left: Math.min(Math.max(pad.l + slot * hover + slot / 2, 80), w - 80),
            top: Math.max(0, y(t.minuten / 60) - 56),
          }}
        >
          <div className="font-medium text-fg">
            {wochentagName(t.datum, true)}, {fmtDate(t.datum)}
          </div>
          <div className="mt-0.5 text-fg-3">
            <span className="num font-medium text-fg">{fmtNum(t.minuten / 60, 1)} Std.</span> gespart · <span className="num">{t.laeufe}</span> {t.laeufe === 1 ? "Vorgang" : "Vorgänge"}
          </div>
        </div>
      )}
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

import { motion } from "motion/react";
import { addDays, daysInMonth, fromISO, monatName } from "@/core/dates";
import { feiertagAm } from "@/core/feiertage";
import type { Bundesland, ISODate } from "@/core/types";
import { cn } from "@/lib/cn";
import { wochenStart } from "./logik";

export interface KalenderMarken {
  ereignis: ISODate;
  roh: ISODate;
  ende: ISODate;
  vorfrist?: ISODate;
  notfrist?: boolean;
}

function Monat({ monat, marken, land, index }: { monat: string; marken: KalenderMarken; land: Bundesland; index: number }) {
  const [y, m] = monat.split("-").map(Number);
  const erster = `${monat}-01`;
  const start = wochenStart(erster);
  const zellen = Math.ceil((((fromISO(erster).getUTCDay() + 6) % 7) + daysInMonth(y, m - 1)) / 7) * 7;
  const tage = Array.from({ length: zellen }, (_, i) => addDays(start, i));
  const verschoben = marken.roh !== marken.ende;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[12.5px] font-semibold">
        {monatName(m - 1)} {y}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["M", "D", "M", "D", "F", "S", "S"].map((w, i) => (
          <div key={i} className={cn("text-[10px] font-semibold", i >= 5 ? "text-fg-4" : "text-fg-3")}>
            {w}
          </div>
        ))}
        {tage.map((t) => {
          const imM = t.startsWith(monat);
          if (!imM) return <div key={t} />;
          const ft = feiertagAm(t, land);
          const wd = fromISO(t).getUTCDay();
          const frei = wd === 0 || wd === 6 || (ft && !ft.teilweise);
          const istEreignis = t === marken.ereignis;
          const istEnde = t === marken.ende;
          const istRoh = verschoben && t === marken.roh;
          const istVorfrist = t === marken.vorfrist;
          const dazwischen = verschoben && t > marken.roh && t < marken.ende;
          const markiert = istEreignis || istEnde || istRoh || istVorfrist;
          return (
            <div key={t} className={cn("relative flex justify-center", (dazwischen || istRoh) && "bg-[repeating-linear-gradient(135deg,var(--amber-soft)_0_3px,transparent_3px_6px)]")} title={ft ? `${ft.name}${ft.teilweise ? " (regional – keine Verlängerung)" : ""}` : undefined}>
              <motion.span
                initial={markiert ? { scale: 0.4, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 22, delay: markiert ? 0.15 + index * 0.1 + (istEnde ? 0.25 : istRoh ? 0.12 : 0) : 0 }}
                className={cn(
                  "num relative grid size-7 place-items-center rounded-full text-[11.5px]",
                  frei ? "text-fg-4" : "text-fg-2",
                  istEreignis && "bg-ink-soft font-semibold text-ink ring-1 ring-inset ring-[var(--ink)]",
                  istVorfrist && !istEnde && "font-semibold text-fg outline-dashed outline-[1.5px] -outline-offset-2 outline-[var(--fg-3)]",
                  istRoh && "font-semibold text-amber line-through ring-[1.5px] ring-inset ring-[var(--amber)]",
                  istEnde && cn("font-bold text-on-ink shadow-[0_6px_16px_-6px_var(--ink)]", marken.notfrist ? "bg-seal" : "bg-ink"),
                )}
              >
                {Number(t.slice(8, 10))}
                {ft && !istEnde && <span className={cn("absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full", ft.teilweise ? "bg-amber" : "bg-seal")} />}
              </motion.span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mini-Kalender: Ereignistag, rechnerisches Ende, Verschiebung (§ 222 Abs. 2 ZPO) und Fristende. */
export function MiniKalender({ marken, land }: { marken: KalenderMarken; land: Bundesland }) {
  const monate = Array.from(new Set([marken.ereignis.slice(0, 7), marken.ende.slice(0, 7)]));
  const verschoben = marken.roh !== marken.ende;
  return (
    <div>
      <div className={cn("grid gap-5", monate.length > 1 && "sm:grid-cols-2")}>
        {monate.map((mo, i) => (
          <Monat key={`${mo}-${marken.ereignis}-${marken.ende}`} monat={mo} marken={marken} land={land} index={i} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11px] text-fg-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink-soft ring-1 ring-[var(--ink)]" /> Ereignis
        </span>
        {verschoben && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full ring-[1.5px] ring-[var(--amber)]" /> rechnerisches Ende (kein Werktag)
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", marken.notfrist ? "bg-seal" : "bg-ink")} /> Fristende
        </span>
        {marken.vorfrist && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full outline-dashed outline-1 outline-[var(--fg-3)]" /> Vorfrist
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-seal" /> Feiertag
        </span>
        <span className="inline-flex items-center gap-1.5" title="Regionale Feiertage verlängern Fristen nicht">
          <span className="size-1.5 rounded-full bg-amber" /> regional (keine Verlängerung)
        </span>
      </div>
    </div>
  );
}

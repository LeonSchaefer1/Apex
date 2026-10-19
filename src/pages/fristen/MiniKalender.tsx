import { motion } from "motion/react";
import { addDays, daysInMonth, fromISO, monatName } from "@/core/dates";
import { feiertagAm } from "@/core/feiertage";
import type { Bundesland, ISODate } from "@/core/types";
import { cn } from "@/lib/cn";
import { wochenStart } from "./logik";
import { BEWEGUNG } from "@/lib/bewegung";

export interface KalenderMarken {
  ereignis: ISODate;
  roh: ISODate;
  ende: ISODate;
  vorfrist?: ISODate;
  notfrist?: boolean;
}

function Monat({ monat, marken, land }: { monat: string; marken: KalenderMarken; land: Bundesland; index: number }) {
  const [y, m] = monat.split("-").map(Number);
  const erster = `${monat}-01`;
  const start = wochenStart(erster);
  const zellen = Math.ceil((((fromISO(erster).getUTCDay() + 6) % 7) + daysInMonth(y, m - 1)) / 7) * 7;
  const tage = Array.from({ length: zellen }, (_, i) => addDays(start, i));
  const verschoben = marken.roh !== marken.ende;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[13px] font-semibold">
        {monatName(m - 1)} {y}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["M", "D", "M", "D", "F", "S", "S"].map((w, i) => (
          <div key={i} className={cn("text-[12px] font-semibold", i >= 5 ? "text-fg-3" : "text-fg-3")}>
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
            <div key={t} className={cn("relative flex justify-center", (dazwischen || istRoh) && "bg-amber-soft")} title={ft ? `${ft.name}${ft.teilweise ? " (regional – keine Verlängerung)" : ""}` : undefined}>
              <motion.span
                initial={markiert ? { scale: 0.4, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                transition={BEWEGUNG.standard}
                className={cn(
                  "num relative grid size-7 place-items-center rounded-full text-[12px]",
                  frei ? "text-fg-3" : "text-fg-2",
                  istEreignis && "bg-[var(--surface-3)] font-semibold text-fg ring-1 ring-inset ring-[var(--fg)]",
                  istVorfrist && !istEnde && "font-semibold text-fg outline-dashed outline-[1.5px] -outline-offset-2 outline-[var(--fg-3)]",
                  istRoh && "font-semibold text-amber line-through ring-[1.5px] ring-inset ring-[var(--amber)]",
                  istEnde && cn("font-semibold", marken.notfrist ? "bg-[var(--seal)] text-[var(--on-seal)]" : "bg-[var(--ink)] text-[var(--on-ink)]"),
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

/** Monatsabstand zweier Monate „JJJJ-MM“. */
const monatsIndex = (mo: string) => Number(mo.slice(0, 4)) * 12 + Number(mo.slice(5, 7)) - 1;

/**
 * Welche Monate zeigt der Kalender? Alle Monate mit einer Markierung (Ereignis, Vorfrist, rechnerisches Ende, Fristende) –
 * höchstens drei; bei mehr nur Ereignis-, Rechen- und Endmonat. Lücken zwischen nicht benachbarten Monaten als „…“ (I4-T18-02).
 */
export function kalenderMonate(marken: KalenderMarken): (string | "…")[] {
  const alle = [marken.ereignis, marken.vorfrist, marken.roh, marken.ende].filter((d): d is string => !!d && /^\d{4}-\d{2}/.test(d)).map((d) => d.slice(0, 7));
  let monate = [...new Set(alle)].sort();
  if (monate.length > 3) monate = [...new Set([marken.ereignis, marken.roh, marken.ende].map((d) => d.slice(0, 7)))].sort();
  const out: (string | "…")[] = [];
  monate.forEach((mo, i) => {
    if (i > 0 && monatsIndex(mo) - monatsIndex(monate[i - 1]) > 1) out.push("…");
    out.push(mo);
  });
  return out;
}

/** Mini-Kalender: Ereignistag, rechnerisches Ende, Verschiebung (§ 222 Abs. 2 ZPO) und Fristende. */
export function MiniKalender({ marken, land }: { marken: KalenderMarken; land: Bundesland }) {
  const monate = kalenderMonate(marken);
  const verschoben = marken.roh !== marken.ende;
  let nr = 0;
  return (
    <div>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        {monate.map((mo, i) =>
          mo === "…" ? (
            <div key={`luecke-${i}`} className="self-center px-0.5 text-[15px] font-semibold text-fg-3" role="img" aria-label="Monate dazwischen ausgelassen" title="Monate dazwischen ausgelassen">
              …
            </div>
          ) : (
            <div key={`${mo}-${marken.ereignis}-${marken.ende}`} className="min-w-[196px] flex-1 basis-[196px]">
              <Monat monat={mo} marken={marken} land={land} index={nr++} />
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12px] text-fg-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[var(--surface-3)] ring-1 ring-[var(--fg)]" /> Ereignis
        </span>
        {verschoben && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full ring-[1.5px] ring-[var(--amber)]" /> rechnerisches Ende (kein Werktag)
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", marken.notfrist ? "bg-[var(--seal)]" : "bg-[var(--ink)]")} /> Fristende
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

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { addDays, daysInMonth, fmtDateLong, fromISO, monatName, wochentagName } from "@/core/dates";
import { istKritisch } from "@/core/fristenLage";
import { feiertagAm } from "@/core/feiertage";
import type { Akte, Bundesland, Frist } from "@/core/types";
import { Button, Card, Chip, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TypChip } from "./FristZeile";
import { TYP_META, kalenderMeta, streifenFarbe, wochenStart } from "./logik";
import { sortiereTag } from "./WochenAnsicht";

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function MonatsAnsicht({
  fristen, akten, monat, setMonat, auswahl, setAuswahl, land, heute, onOpen,
}: {
  fristen: Frist[];
  akten: Map<string, Akte>;
  monat: string; // YYYY-MM
  setMonat: (m: string) => void;
  auswahl: string;
  setAuswahl: (d: string) => void;
  land: Bundesland;
  heute: string;
  onOpen: (f: Frist) => void;
}) {
  const [y, m] = monat.split("-").map(Number);
  const erster = `${monat}-01`;
  const start = wochenStart(erster);
  const dim = daysInMonth(y, m - 1);
  const zellen = Math.ceil((((fromISO(erster).getUTCDay() + 6) % 7) + dim) / 7) * 7;
  const tage = useMemo(() => Array.from({ length: zellen }, (_, i) => addDays(start, i)), [start, zellen]);
  const proTag = useMemo(() => {
    const map = new Map<string, Frist[]>();
    for (const f of fristen) map.set(f.datum, [...(map.get(f.datum) ?? []), f]);
    for (const l of map.values()) l.sort(sortiereTag);
    return map;
  }, [fristen]);
  const imMonat = fristen.filter((f) => f.datum.startsWith(monat)).length;
  const verschiebe = (d: number) => {
    const idx = y * 12 + (m - 1) + d;
    const nm = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
    setMonat(nm);
  };
  const auswahlItems = proTag.get(auswahl) ?? [];
  const auswahlFt = feiertagAm(auswahl, land);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <IconButton label="Vorheriger Monat" onClick={() => verschiebe(-1)}>
              <ChevronLeft className="size-[18px]" />
            </IconButton>
            <IconButton label="Nächster Monat" onClick={() => verschiebe(1)}>
              <ChevronRight className="size-[18px]" />
            </IconButton>
          </div>
          <div className="title-md">
            {monatName(m - 1)} {y}
          </div>
          <span className="num text-[12.5px] text-fg-3">
            {imMonat} {imMonat === 1 ? "Eintrag" : "Einträge"}
          </span>
          {!heute.startsWith(monat) && (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => {
                setMonat(heute.slice(0, 7));
                setAuswahl(heute);
              }}
            >
              Heute
            </Button>
          )}
        </div>
        <Card padded={false} className="overflow-hidden p-1.5 sm:p-2">
          <div className="grid grid-cols-7 pb-1">
            {WT.map((w, i) => (
              <div key={w} className={cn("py-1.5 text-center text-[12px] font-semibold uppercase tracking-[0.06em]", i >= 5 ? "text-fg-3" : "text-fg-3")}>
                {w}
              </div>
            ))}
          </div>
          <motion.div key={monat} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="grid grid-cols-7 gap-1">
            {tage.map((t) => {
              const items = proTag.get(t) ?? [];
              const ft = feiertagAm(t, land);
              const wd = fromISO(t).getUTCDay();
              const frei = wd === 0 || wd === 6 || (ft && !ft.teilweise);
              const imM = t.startsWith(monat);
              const istHeute = t === heute;
              const sel = t === auswahl;
              const notfrist = items.some((f) => f.status === "offen" && istKritisch(f)); // Notfrist oder nicht verlängerbar
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAuswahl(t)}
                  aria-pressed={sel}
                  aria-label={`${wochentagName(t)}, ${fmtDateLong(t)}: ${items.length} Einträge${ft ? `, ${ft.name}` : ""}`}
                  className={cn(
                    "relative flex min-h-[54px] min-w-0 flex-col rounded-[12px] p-1 text-left transition-colors sm:min-h-[76px] sm:p-1.5 xl:min-h-[104px]",
                    frei && "bg-[repeating-linear-gradient(135deg,var(--ink-softer)_0_5px,transparent_5px_10px)]",
                    !imM && "opacity-40",
                    sel ? "bg-ink-soft ring-2 ring-[var(--ink)]" : "hover:bg-[var(--ink-softer)]",
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className={cn("num grid size-6 place-items-center rounded-full text-[12.5px] font-semibold", istHeute ? "bg-ink text-on-ink" : frei ? "text-fg-3" : "text-fg")}>{Number(t.slice(8, 10))}</span>
                    {notfrist && <ShieldAlert className="size-3 text-seal" aria-hidden />}
                    {items.length > 0 && <span className="num ml-auto hidden text-[12px] font-semibold text-fg-3 sm:inline">{items.length}</span>}
                  </div>
                  {ft && <div className={cn("mt-0.5 hidden truncate text-[12px] font-semibold sm:block", ft.teilweise ? "text-amber" : "text-fg-2")}>{ft.name}</div>}
                  {/* Pillen (breit) */}
                  <div className="mt-1 hidden space-y-1 xl:block">
                    {items.slice(0, 3).map((f) => {
                      const k = kalenderMeta(f);
                      return (
                        <div key={f.id} className={cn("rounded-[6px] px-1.5 py-0.5 text-[12px] font-semibold", k.pill, f.status === "erledigt" && "line-through opacity-50")}>
                          {k.kritisch && <div className="truncate text-[10.5px] font-bold uppercase tracking-[0.04em]">{k.kritisch}</div>}
                          <div className="truncate">{f.titel.replace(/^Vorfrist: /, "")}</div>
                        </div>
                      );
                    })}
                    {items.length > 3 && <div className="px-1.5 text-[12px] font-medium text-fg-3">+{items.length - 3} weitere</div>}
                  </div>
                  {/* Punkte (schmal) */}
                  {items.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-[3px] pt-1 xl:hidden">
                      {items.slice(0, 5).map((f) => (
                        <span key={f.id} className={cn("size-1.5 rounded-full", kalenderMeta(f).dot)} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>
        </Card>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[12px] text-fg-3">
          {(["notfrist", "frist", "vorfrist", "wiedervorlage", "termin"] as const).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", TYP_META[t].dot)} />
              {t === "notfrist" ? "Notfrist / nicht verlängerbar" : TYP_META[t].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_2px,transparent_2px_4px)]" />
            Wochenende / Feiertag
          </span>
        </div>
      </div>

      {/* Tagesliste */}
      <div className="min-w-0 xl:pt-[52px]">
        <Card padded={false} className="xl:sticky xl:top-[92px]">
          <div className="border-b border-[var(--line)] px-4 py-3.5">
            <div className="eyebrow">{wochentagName(auswahl)}</div>
            <div className="title-md mt-0.5">{fmtDateLong(auswahl)}</div>
            {auswahlFt && (
              <div className="mt-1.5">
                <Chip tone={auswahlFt.teilweise ? "amber" : "outline"}>{auswahlFt.name}{auswahlFt.teilweise ? " · regional" : " · gesetzlicher Feiertag"}</Chip>
              </div>
            )}
          </div>
          <div className="p-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {auswahlItems.length ? (
                auswahlItems.map((f, i) => {
                  const akte = akten.get(f.akteId);
                  return (
                    <motion.button
                      key={f.id}
                      type="button"
                      onClick={() => onOpen(f)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 460, damping: 36, delay: i * 0.03 }}
                      className="relative flex w-full gap-3 rounded-[14px] py-2.5 pl-4 pr-3 text-left hover:bg-[var(--ink-softer)]"
                    >
                      <span className={cn("absolute bottom-2.5 left-1.5 top-2.5 w-[3px] rounded-full", f.status === "erledigt" ? "bg-green" : streifenFarbe(f, heute))} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <TypChip typ={f.typ} regelKey={f.regelKey} />
                          {f.uhrzeit && <span className="num text-[12px] text-fg-3">{f.uhrzeit} Uhr</span>}
                        </div>
                        <div className={cn("mt-1 text-[13.5px] font-semibold leading-snug", f.status === "erledigt" && "text-fg-3 line-through")}>{f.titel}</div>
                        {akte && (
                          <div className="mt-0.5 truncate text-[12px] text-fg-3">
                            <span className="mono text-fg-2">{akte.aktenzeichen}</span> {akte.titel}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              ) : (
                <motion.div key="leer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center px-4 py-10 text-center">
                  <CalendarCheck2 className="size-6 text-fg-3" />
                  <div className="mt-2 text-[13px] font-medium text-fg-2">Keine Einträge</div>
                  <div className="mt-0.5 text-[12px] text-fg-3">An diesem Tag läuft keine Frist ab.</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </div>
  );
}

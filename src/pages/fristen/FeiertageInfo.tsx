import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarOff, ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { fmtDateWd, fromISO, today } from "@/core/dates";
import { BUNDESLAENDER, bundeslandName, feiertage } from "@/core/feiertage";
import type { Bundesland } from "@/core/types";
import { Card, Chip, IconButton, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Feiertage des Jahres je Bundesland – Grundlage für die Verschiebung nach § 222 Abs. 2 ZPO. */
export function FeiertageInfo({ land: start }: { land: Bundesland }) {
  const heute = today();
  const [offen, setOffen] = useState(false);
  const [jahr, setJahr] = useState(Number(heute.slice(0, 4)));
  const [land, setLand] = useState<Bundesland>(start);
  const liste = feiertage(jahr, land);
  const regional = liste.filter((f) => f.teilweise).length;

  return (
    <Card padded={false} className="overflow-hidden">
      <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="flex w-full items-center gap-3 p-4 text-left sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
          <CalendarOff className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="title-md block">
            Feiertage {jahr} · {bundeslandName(land)}
          </span>
          <span className="block text-[12.5px] text-fg-3">
            {liste.length} Feiertage{regional ? `, davon ${regional} nur regional` : ""} – maßgeblich sind die Feiertage am Gerichtsort, nicht am Kanzleisitz (§ 222 Abs. 2 ZPO)
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-fg-3 transition-transform duration-300", offen && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {offen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="border-t border-[var(--line)] p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <IconButton label="Vorheriges Jahr" size="sm" onClick={() => setJahr((j) => j - 1)}>
                    <ChevronLeft className="size-4" />
                  </IconButton>
                  <span className="num w-12 text-center text-[14px] font-semibold">{jahr}</span>
                  <IconButton label="Nächstes Jahr" size="sm" onClick={() => setJahr((j) => j + 1)}>
                    <ChevronRight className="size-4" />
                  </IconButton>
                </div>
                <Select id="feiertage-land" aria-label="Bundesland" value={land} onChange={(e) => setLand(e.target.value as Bundesland)} className="!h-9 !w-auto min-w-[200px]">
                  {BUNDESLAENDER.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {liste.map((f, i) => {
                  const wd = fromISO(f.datum).getUTCDay();
                  const vorbei = f.datum < heute;
                  return (
                    <motion.li
                      key={f.datum + f.name}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 460, damping: 36, delay: Math.min(i, 12) * 0.025 }}
                      className={cn("flex items-center gap-3 rounded-[14px] px-3 py-2.5 ring-1 ring-inset ring-[var(--line)]", f.teilweise ? "bg-amber-soft" : "bg-[var(--ink-softer)]", vorbei && "opacity-55")}
                    >
                      <span className="num w-[92px] shrink-0 text-[12.5px] font-medium text-fg-2">{fmtDateWd(f.datum)}</span>
                      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug">{f.name.replace(/ \(regional\)$/, "")}</span>
                      {f.teilweise ? (
                        <Chip tone="amber" title="Nur in Teilen des Landes Feiertag – AnwaltApex verlängert Fristen hier vorsorglich nicht">
                          teilweise
                        </Chip>
                      ) : wd === 0 || wd === 6 ? (
                        <Chip tone="outline" title="Fällt ohnehin auf ein Wochenende">
                          Wochenende
                        </Chip>
                      ) : null}
                    </motion.li>
                  );
                })}
              </ul>
              <div className="mt-4 flex gap-2.5 rounded-[14px] bg-amber-soft p-3.5 text-[12.5px] leading-relaxed text-fg-2">
                <Info className="mt-0.5 size-4 shrink-0 text-amber" />
                <span>
                  <strong className="font-semibold text-fg">Gerichtsort statt Kanzleisitz.</strong> Ein Feiertag nur am Kanzleisitz (z. B. Allerheiligen in Nordrhein-Westfalen bei einem Gericht in Hessen) verlängert die Frist nicht – der Fristenrechner weist im Rechenweg darauf hin.{" "}
                  <strong className="font-semibold text-fg">Regionale Feiertage: AnwaltApex verlängert vorsorglich nicht.</strong> Maßgeblich sind die Feiertage am Ort des Gerichts bzw. der Behörde, bei der die Frist zu wahren ist
                  (§ 222 Abs. 2 ZPO). Gilt ein nur regionaler Feiertag dort (z. B. Mariä Himmelfahrt in München), endet die Frist rechtlich erst am nächsten Werktag – AnwaltApex notiert trotzdem den früheren Tag als
                  sichere Seite und weist bei der Berechnung darauf hin.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

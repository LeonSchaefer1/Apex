import { motion } from "motion/react";
import { Lightbulb, Paperclip } from "lucide-react";
import type { Entscheidung } from "@/core/types";
import { fmtDate } from "@/core/dates";
import { Highlight } from "@/components/Highlight";
import { Card, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Kürzel des Gerichts als ruhiges Siegel. */
export function GerichtSiegel({ e, groesse = "md" }: { e: Entscheidung; groesse?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "mono grid shrink-0 place-items-center rounded-[11px] bg-ink-soft font-semibold text-ink",
        groesse === "md" ? "h-9 min-w-9 px-1.5 text-[11.5px]" : "h-7 min-w-7 px-1 text-[10.5px]",
      )}
      title={e.gericht}
    >
      {e.gericht}
    </span>
  );
}

/** Ergebniskarte der Suche: Gericht, Art, Datum, Az, Titel, Leitsatz mit Treffern, Normen, Bedeutung, Relevanz. */
export function EntscheidungKarte({ e, q, relevanz, index, geheftet, onOpen }: { e: Entscheidung; q: string; relevanz?: number; index: number; geheftet?: number; onOpen: () => void }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 460, damping: 36, delay: Math.min(index, 10) * 0.03 }}
      className="min-w-0"
    >
      <Card
        interactive
        role="button"
        tabIndex={0}
        aria-label={`${e.gericht} ${e.az}: ${e.titel} öffnen`}
        onClick={onOpen}
        onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onOpen())}
        className="flex h-full flex-col gap-3 !p-4 sm:!p-5"
      >
        <div className="relative z-[1] flex items-start gap-3">
          <GerichtSiegel e={e} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-3">
              <span className="font-medium text-fg-2">{e.spruchkoerper ?? e.gericht}</span>
              <span aria-hidden>·</span>
              <span>{e.art}</span>
              <span aria-hidden>·</span>
              <span className="num">{fmtDate(e.datum)}</span>
            </div>
            <div className="mono mt-0.5 truncate text-[12.5px] text-fg-2">
              <Highlight text={e.az} q={q} />
            </div>
          </div>
          {relevanz !== undefined && (
            <div className="w-[74px] shrink-0 text-right" title="Relevanz für Ihre Suche">
              <div className="num text-[12px] font-semibold text-ink">{relevanz} %</div>
              <div className="bar mt-1 !h-1">
                <span style={{ width: `${relevanz}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="relative z-[1] min-w-0">
          <h3 className="title-md">
            <Highlight text={e.titel} q={q} />
          </h3>
          <p className="mt-1.5 line-clamp-4 text-[13.5px] leading-relaxed text-fg-2">
            <Highlight text={e.leitsatz} q={q} />
          </p>
        </div>

        <div className="relative z-[1] mt-auto flex flex-wrap items-center gap-1.5">
          {e.normen.map((n) => (
            <Chip key={n} tone="outline" className="mono !font-normal">
              <Highlight text={n} q={q} />
            </Chip>
          ))}
          <Chip>{e.rechtsgebiet}</Chip>
          {!!geheftet && (
            <Chip tone="green" icon={<Paperclip className="size-3" />} title="An Akten geheftet">
              {geheftet === 1 ? "1 Akte" : `${geheftet} Akten`}
            </Chip>
          )}
        </div>

        <div className="relative z-[1] flex items-start gap-2 rounded-[12px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px] leading-snug text-fg-2">
          <Lightbulb className="mt-px size-3.5 shrink-0 text-amber" />
          <span>
            <Highlight text={e.bedeutung} q={q} />
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

/** Kompakte Karte für die Übersicht „Leitentscheidungen nach Rechtsgebiet“. */
export function EntscheidungKompakt({ e, index, onOpen, zeigeGebiet }: { e: Entscheidung; index: number; onOpen: () => void; zeigeGebiet?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ type: "spring", stiffness: 460, damping: 36, delay: Math.min(index, 10) * 0.03 }}
      className="sheet glow group relative flex min-w-0 flex-col gap-2 rounded-[18px] p-4 text-left transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass active:scale-[0.99]"
    >
      <span className="relative z-[1] flex items-center gap-2.5">
        <GerichtSiegel e={e} groesse="sm" />
        <span className="mono min-w-0 flex-1 truncate text-[12px] text-fg-3">{e.az}</span>
        <span className="num shrink-0 text-[11.5px] text-fg-4">{zeigeGebiet ? `${e.rechtsgebiet} · ${e.datum.slice(0, 4)}` : e.datum.slice(0, 4)}</span>
      </span>
      <span className="relative z-[1] block text-[14px] font-semibold leading-snug tracking-[-0.01em] text-fg">{e.titel}</span>
      <span className="relative z-[1] line-clamp-2 text-[12.5px] leading-snug text-fg-3">{e.leitsatz}</span>
    </motion.button>
  );
}

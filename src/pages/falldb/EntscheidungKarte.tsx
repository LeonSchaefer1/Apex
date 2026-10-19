import { Lightbulb, Paperclip } from "lucide-react";
import type { Entscheidung } from "@/core/types";
import { fmtDate } from "@/core/dates";
import { Highlight } from "@/components/Highlight";
import { Chip } from "@/components/ui";
import { cn } from "@/lib/cn";

/** Kürzel des Gerichts als Kennung: Umriss in Linie stark, Mono 12/600 – ohne farbige Kachel. */
export function GerichtSiegel({ e, groesse = "md" }: { e: Entscheidung; groesse?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "mono inline-grid shrink-0 place-items-center rounded-sm font-semibold text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)]",
        groesse === "md" ? "h-7 min-w-10 px-1.5 text-[12px]" : "h-6 min-w-9 px-1 text-[12px]",
      )}
      title={e.gericht}
    >
      {e.gericht}
    </span>
  );
}

/**
 * Treffer der Suche als Listenzeile (in einer Karte mit Linien): Gericht, Art, Datum, Az, Titel, Leitsatz mit Treffern, Normen,
 * Bedeutung, Relevanz. Die ganze Zeile öffnet die Entscheidung.
 */
export function EntscheidungKarte({ e, q, relevanz, geheftet, onOpen }: { e: Entscheidung; q: string; relevanz?: number; index: number; geheftet?: number; onOpen: () => void }) {
  return (
    <li className="min-w-0">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${e.gericht} ${e.az}: ${e.titel} öffnen`}
        onClick={onOpen}
        onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onOpen())}
        className="flex cursor-pointer flex-col gap-3 px-4 py-4 transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px] sm:px-5"
      >
        <div className="flex items-start gap-3">
          <GerichtSiegel e={e} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-fg-3">
              <span className="font-medium text-fg-2">{e.spruchkoerper ?? e.gericht}</span>
              <span aria-hidden>·</span>
              <span>{e.art}</span>
              <span aria-hidden>·</span>
              <span className="num">{fmtDate(e.datum)}</span>
              <span aria-hidden>·</span>
              <span className="mono text-fg-2">
                <Highlight text={e.az} q={q} />
              </span>
            </div>
            <h3 className="title-md mt-1">
              <Highlight text={e.titel} q={q} />
            </h3>
          </div>
          {relevanz !== undefined && (
            <div className="w-[72px] shrink-0 text-right" title="Relevanz für Ihre Suche">
              <div className="num text-[13px] font-medium text-fg">{relevanz} %</div>
              <div className="bar mt-1">
                <span style={{ width: `${relevanz}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 sm:pl-[52px]">
          <p className="line-clamp-4 max-w-[80ch] text-[14px] leading-6 text-fg-2">
            <Highlight text={e.leitsatz} q={q} />
          </p>
          <p className="mt-2 flex max-w-[80ch] items-start gap-2 text-[13px] leading-[18px] text-fg-3">
            <Lightbulb className="mt-px size-3.5 shrink-0 text-fg-4" aria-hidden />
            <span>
              <Highlight text={e.bedeutung} q={q} />
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {e.normen.map((n) => (
              <Chip key={n} tone="outline" className="mono !font-normal">
                <Highlight text={n} q={q} />
              </Chip>
            ))}
            <Chip>{e.rechtsgebiet}</Chip>
            {!!geheftet && (
              <Chip tone="ink" icon={<Paperclip aria-hidden />} title="An Akten geheftet">
                {geheftet === 1 ? "1 Akte" : `${geheftet} Akten`}
              </Chip>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Zeile für die Übersicht „Leitentscheidungen nach Rechtsgebiet“ (Liste mit Linien in einer Karte). */
export function EntscheidungKompakt({ e, onOpen, zeigeGebiet }: { e: Entscheidung; index: number; onOpen: () => void; zeigeGebiet?: boolean }) {
  return (
    <li className="min-w-0">
      <button type="button" onClick={onOpen} className="group flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]">
        <GerichtSiegel e={e} groesse="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium leading-5 text-fg">{e.titel}</span>
          <span className="mt-0.5 block text-[13px] leading-[18px] text-fg-4">
            <span className="mono text-fg-3">{e.az}</span>
            <span className="num"> · {zeigeGebiet ? `${e.rechtsgebiet} · ${e.datum.slice(0, 4)}` : e.datum.slice(0, 4)}</span>
          </span>
          <span className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-fg-3">{e.leitsatz}</span>
        </span>
      </button>
    </li>
  );
}

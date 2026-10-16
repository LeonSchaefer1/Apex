import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Inbox, Landmark, Loader2, Mail, Paperclip } from "lucide-react";
import { fmtTime, relTime, today } from "@/core/dates";
import type { Akte, Nachricht } from "@/core/types";
import { fristArtZu } from "@/core/fristen";
import { istKritisch } from "@/core/fristenLage";
import { AiChip, Chip, Empty } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";

export function KanalSymbol({ kanal, className }: { kanal: Nachricht["kanal"]; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[12px]",
        kanal === "bea" ? "bg-ink-soft text-ink" : "bg-[var(--ink-softer)] text-fg-2 ring-1 ring-inset ring-[var(--line)]",
        className,
      )}
      aria-hidden
    >
      {kanal === "bea" ? <Landmark className="size-[17px]" /> : <Mail className="size-[17px]" />}
    </span>
  );
}

export function KanalChip({ kanal }: { kanal: Nachricht["kanal"] }) {
  return kanal === "bea" ? (
    <Chip tone="ink" title="Besonderes elektronisches Anwaltspostfach">
      beA
    </Chip>
  ) : (
    <Chip tone="outline">E-Mail</Chip>
  );
}

/** KI-Zustand einer Nachricht als Chip: „KI analysiert …“ (läuft), „Wartet auf KI-Analyse“, „KI-Analyse fertig“ bzw. Frist-Stand. */
export function KiStatusChip({ n, laufend }: { n: Nachricht; laufend: boolean }) {
  if (laufend)
    return (
      <span className="chip ai-ring !bg-transparent">
        <Loader2 className="size-3 animate-spin text-violet" />
        <span className="ai-text font-semibold">KI analysiert …</span>
      </span>
    );
  if (!n.ki || n.kiStatus === "ausstehend") return <Chip tone="outline" dot className="!text-fg-3">Wartet auf KI-Analyse</Chip>;
  if (n.ki.frist) {
    if (n.kiStatus === "uebernommen")
      return (
        <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
          Frist notiert
        </Chip>
      );
    return (
      <Chip tone={istKritisch(n.ki.frist) ? "seal" : "amber"} dot title={fristArtZu(n.ki.frist)?.kurz}>
        Frist erkannt
      </Chip>
    );
  }
  return <AiChip>KI-Analyse fertig</AiChip>;
}

/** Eingangszeit: heute relativ („vor 12 Min.“) bzw. Uhrzeit, ältere Nachrichten „gestern“, „vor 3 Tagen“ … */
export function eingangsZeit(eingang: string) {
  if (eingang.slice(0, 10) === today()) return new Date(eingang).getTime() <= Date.now() ? relTime(eingang) : fmtTime(eingang);
  return relTime(eingang);
}

function vorschau(text: string) {
  const zeilen = text
    .split("\n")
    .map((z) => z.trim())
    .filter(Boolean);
  const ohneAnrede = /^(sehr geehrte|guten (morgen|tag)|hallo|liebe)/i.test(zeilen[0] ?? "") ? zeilen.slice(1) : zeilen;
  return ohneAnrede.join(" ").replace(/\s+/g, " ");
}

export function NachrichtenListe({
  items, selectedId, onSelect, akten, laufend, q, gefiltert,
}: {
  items: Nachricht[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  akten: Map<string, Akte>;
  laufend: Record<string, number>;
  q: string;
  gefiltert: boolean;
}) {
  if (!items.length)
    return (
      <Empty
        icon={<Inbox className="size-6" />}
        title={gefiltert ? "Keine passenden Nachrichten" : "Posteingang ist leer"}
        text={gefiltert ? "Ändern Sie den Filter oder die Suche, um weitere Nachrichten zu sehen." : "Neue beA-Nachrichten und E-Mails erscheinen hier automatisch – die KI ordnet sie Ihren Akten zu."}
      />
    );
  return <Liste items={items} selectedId={selectedId} onSelect={onSelect} akten={akten} laufend={laufend} q={q} />;
}

/**
 * Nachrichtenliste als Listbox mit „roving tabindex“: ein einziger Tab-Stopp, ↑/↓ (bzw. Pos1/Ende) wandern durch die
 * Nachrichten, Enter oder Leertaste öffnet. J/K (nächste/vorige) wirken seitenweit, siehe Posteingang.
 */
function Liste({ items, selectedId, onSelect, akten, laufend, q }: { items: Nachricht[]; selectedId: string | null; onSelect: (id: string) => void; akten: Map<string, Akte>; laufend: Record<string, number>; q: string }) {
  const [fokusId, setFokusId] = useState<string | null>(selectedId);
  const refs = useRef<Record<string, HTMLLIElement | null>>({});
  // Tab-Stopp folgt der geöffneten Nachricht; ohne Auswahl die erste
  useEffect(() => {
    if (selectedId) setFokusId(selectedId);
  }, [selectedId]);
  const aktivId = fokusId && items.some((n) => n.id === fokusId) ? fokusId : (items[0]?.id ?? null);
  const fokussiere = (id: string) => {
    setFokusId(id);
    refs.current[id]?.focus();
  };
  const taste = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = items.findIndex((n) => n.id === aktivId);
    const ziel =
      e.key === "ArrowDown" ? items[Math.min(items.length - 1, i + 1)] : e.key === "ArrowUp" ? items[Math.max(0, i - 1)] : e.key === "Home" ? items[0] : e.key === "End" ? items[items.length - 1] : undefined;
    if (ziel) {
      e.preventDefault();
      fokussiere(ziel.id);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && aktivId) {
      e.preventDefault();
      onSelect(aktivId);
    }
  };
  return (
    <ul role="listbox" aria-label="Nachrichten" aria-describedby="posteingang-tipp" className="space-y-0.5 p-1.5" onKeyDown={taste}>
      {items.map((n, i) => {
        const akte = n.akteId ? akten.get(n.akteId) : undefined;
        const neu = n.status === "neu";
        const sel = n.id === selectedId;
        const eebOffen = n.eebErforderlich && !n.eebAbgegeben;
        return (
          <motion.li
            key={n.id}
            ref={(el) => {
              refs.current[n.id] = el;
            }}
            role="option"
            aria-selected={sel}
            tabIndex={n.id === aktivId ? 0 : -1}
            data-nachricht={n.id}
            onFocus={() => setFokusId(n.id)}
            onClick={() => onSelect(n.id)}
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 36, delay: Math.min(i, 10) * 0.03 }}
            className="cursor-pointer rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
          >
            <div
              className={cn(
                "group relative isolate flex w-full gap-3 rounded-[16px] px-3 py-3 pl-4 text-left transition-colors",
                !sel && "hover:bg-[var(--ink-softer)]",
                n.status === "erledigt" && !sel && "opacity-65",
              )}
            >
              {sel && (
                <motion.span
                  layoutId="post-auswahl"
                  className="absolute inset-0 -z-10 rounded-[16px] bg-ink-soft shadow-[inset_0_0_0_1px_var(--line)]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              {neu && (
                <>
                  <span className="absolute left-1.5 top-[26px] size-2 rounded-full bg-ink" aria-hidden />
                  <span className="sr-only">Ungelesen: </span>
                </>
              )}
              <KanalSymbol kanal={n.kanal} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={cn("min-w-0 break-words text-[13.5px]", neu ? "font-semibold text-fg" : "font-medium text-fg-2")}>
                    <Highlight text={n.von} q={q} />
                  </span>
                  <span className={cn("num ml-auto shrink-0 text-[12.5px]", neu ? "font-medium text-ink" : "text-fg-3")}>{eingangsZeit(n.eingang)}</span>
                </div>
                <div className={cn("mt-0.5 flex min-w-0 items-start gap-1.5 text-[13px]", neu ? "font-semibold text-fg" : "text-fg-2")}>
                  <span className="line-clamp-2 min-w-0 break-words">
                    <Highlight text={n.betreff} q={q} />
                  </span>
                  {n.anhaenge.length > 0 && (
                    <>
                      <Paperclip className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden />
                      <span className="sr-only">{n.anhaenge.length === 1 ? "1 Anhang" : `${n.anhaenge.length} Anhänge`}</span>
                    </>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-fg-3">{vorschau(n.text)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <KanalChip kanal={n.kanal} />
                  <KiStatusChip n={n} laufend={laufend[n.id] !== undefined} />
                  {akte && (
                    <Chip className="mono" title={akte.titel}>
                      {akte.aktenzeichen}
                    </Chip>
                  )}
                  {eebOffen && <Chip tone="amber">eEB offen</Chip>}
                  {n.status === "erledigt" && (
                    <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
                      Erledigt
                    </Chip>
                  )}
                </div>
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

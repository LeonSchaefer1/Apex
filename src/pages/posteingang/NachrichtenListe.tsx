import { motion } from "motion/react";
import { CheckCircle2, Inbox, Landmark, Loader2, Mail, Paperclip } from "lucide-react";
import { fmtTime, relTime, today } from "@/core/dates";
import type { Akte, Nachricht } from "@/core/types";
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

/** KI-Zustand einer Nachricht als Chip. */
export function KiStatusChip({ n, laufend }: { n: Nachricht; laufend: boolean }) {
  if (laufend)
    return (
      <span className="chip ai-ring !bg-transparent">
        <Loader2 className="size-3 animate-spin text-violet" />
        <span className="ai-text font-semibold">KI analysiert …</span>
      </span>
    );
  if (!n.ki || n.kiStatus === "ausstehend") return <Chip tone="outline" dot className="!text-fg-3">Wartet auf KI</Chip>;
  if (n.ki.frist) {
    if (n.kiStatus === "uebernommen")
      return (
        <Chip tone="green" icon={<CheckCircle2 className="size-3" />}>
          Frist notiert
        </Chip>
      );
    return (
      <Chip tone={n.ki.frist.typ === "notfrist" ? "seal" : "amber"} dot>
        Frist erkannt
      </Chip>
    );
  }
  return <AiChip>KI analysiert</AiChip>;
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
  return (
    <ul className="space-y-0.5 p-1.5" role="listbox" aria-label="Nachrichten">
      {items.map((n, i) => {
        const akte = n.akteId ? akten.get(n.akteId) : undefined;
        const neu = n.status === "neu";
        const sel = n.id === selectedId;
        const eebOffen = n.eebErforderlich && !n.eebAbgegeben;
        return (
          <motion.li
            key={n.id}
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 36, delay: Math.min(i, 10) * 0.03 }}
          >
            <button
              type="button"
              data-nachricht={n.id}
              role="option"
              aria-selected={sel}
              onClick={() => onSelect(n.id)}
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
              {neu && <span className="absolute left-1.5 top-[26px] size-2 rounded-full bg-ink" aria-label="ungelesen" />}
              <KanalSymbol kanal={n.kanal} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={cn("truncate text-[13.5px]", neu ? "font-semibold text-fg" : "font-medium text-fg-2")}>
                    <Highlight text={n.von} q={q} />
                  </span>
                  <span className={cn("num ml-auto shrink-0 text-[11.5px]", neu ? "font-medium text-ink" : "text-fg-3")}>{eingangsZeit(n.eingang)}</span>
                </div>
                <div className={cn("mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px]", neu ? "font-semibold text-fg" : "text-fg-2")}>
                  <span className="truncate">
                    <Highlight text={n.betreff} q={q} />
                  </span>
                  {n.anhaenge.length > 0 && <Paperclip className="size-3.5 shrink-0 text-fg-3" aria-label={`${n.anhaenge.length} Anhänge`} />}
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
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

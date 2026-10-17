// Reiter „Verlauf“: lückenlose Zeitleiste aus Aktivitäten, Notizen und Nachrichten der Akte.
import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Inbox, Info, Send, Sparkles, StickyNote, UserRound, Zap, History } from "lucide-react";
import type { Akte } from "@/core/types";
import { fmtDateLong, fmtTime, relDays, today } from "@/core/dates";
import { useCol } from "@/store/data";
import { Avatar, Card, Chip, Empty, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTeam } from "./helfer";

type Filter = "alle" | "menschen" | "auto";

interface Eintrag {
  id: string;
  zeit: string;
  art: "nutzer" | "ki" | "automation" | "system" | "notiz" | "nachricht-ein" | "nachricht-aus";
  titel: ReactNode;
  text?: string;
  userId?: string;
  minuten?: number;
  /** Beispieleintrag aus den Demodaten */
  beispiel?: boolean;
  kanal?: "bea" | "email";
}

const ICON: Record<Eintrag["art"], { icon: ReactNode; cls: string; label: string }> = {
  nutzer: { icon: <UserRound className="size-3.5" />, cls: "bg-ink-soft text-ink", label: "Team" },
  ki: { icon: <Sparkles className="size-3.5" />, cls: "bg-violet-soft text-violet", label: "KI" },
  automation: { icon: <Zap className="size-3.5" />, cls: "bg-green-soft text-green", label: "Automatisch" },
  system: { icon: <Bot className="size-3.5" />, cls: "bg-ink-softer text-fg-2", label: "System" },
  notiz: { icon: <StickyNote className="size-3.5" />, cls: "bg-amber-soft text-amber", label: "Notiz" },
  "nachricht-ein": { icon: <Inbox className="size-3.5" />, cls: "bg-ink-soft text-ink", label: "Eingang" },
  "nachricht-aus": { icon: <Send className="size-3.5" />, cls: "bg-ink-soft text-ink", label: "Ausgang" },
};

export function TabVerlauf({ akte }: { akte: Akte }) {
  const aktivitaeten = useCol("aktivitaeten");
  const notizen = useCol("notizen");
  const nachrichten = useCol("nachrichten");
  const { byId } = useTeam();
  const [filter, setFilter] = useState<Filter>("alle");

  const eintraege = useMemo(() => {
    const out: Eintrag[] = [];
    for (const a of aktivitaeten) if (a.akteId === akte.id) out.push({ id: a.id, zeit: a.zeit, art: a.akteur, titel: a.text, userId: a.userId, minuten: a.minutenGespart, beispiel: a.beispiel });
    for (const n of notizen) if (n.akteId === akte.id) out.push({ id: n.id, zeit: n.zeit, art: "notiz", titel: "Notiz", text: n.text, userId: n.userId });
    // Ausgehende Nachrichten sind bereits als Aktivität protokolliert – nur Eingänge ergänzen
    for (const n of nachrichten)
      if (n.akteId === akte.id && n.richtung === "ein")
        out.push({
          id: n.id, zeit: n.eingang, art: "nachricht-ein", kanal: n.kanal,
          titel: `${n.kanal === "bea" ? "beA-Nachricht" : "E-Mail"} von ${n.von}: ${n.betreff}`,
          text: n.ki?.zusammenfassung,
        });
    return out.sort((a, b) => b.zeit.localeCompare(a.zeit));
  }, [aktivitaeten, notizen, nachrichten, akte.id]);

  const gefiltert = eintraege.filter((e) => (filter === "alle" ? true : filter === "menschen" ? ["nutzer", "notiz", "nachricht-ein", "nachricht-aus"].includes(e.art) : e.art === "ki" || e.art === "automation"));
  const gespart = eintraege.reduce((s, e) => s + (e.minuten ?? 0), 0);
  // Zeitersparnis ist eine Schätzung (Annahme je Vorgang aus dem 38h-Motor) – wie im Bankabgleich gekennzeichnet (I4-T05-01)
  const mitBeispiel = eintraege.some((e) => e.minuten && e.beispiel);
  const ANNAHME = "Schätzung: Annahme je Vorgang aus dem 38h-Motor – keine gemessene Arbeitszeit";

  // nach Tagen gruppieren
  const gruppen = useMemo(() => {
    const m = new Map<string, Eintrag[]>();
    for (const e of gefiltert) {
      const tag = e.zeit.slice(0, 10);
      m.set(tag, [...(m.get(tag) ?? []), e]);
    }
    return [...m.entries()];
  }, [gefiltert]);

  let laufend = 0;
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "alle", label: "Alles", count: eintraege.length },
            { value: "menschen", label: "Team & Post" },
            { value: "auto", label: "KI & Automatik" },
          ]}
        />
        {gespart > 0 && (
          <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
            <Chip tone="green" icon={<Zap className="size-3 shrink-0" />} className="max-w-full" title={`≈ ${gespart} Min. Routinearbeit in dieser Akte automatisch erledigt – ${ANNAHME}`}>
              <span className="truncate">
                ≈ {gespart} Min.<span className="hidden sm:inline"> Routinearbeit in dieser Akte</span> automatisch erledigt
              </span>
            </Chip>
            <Chip tone="amber" icon={<Info className="size-3 shrink-0" aria-hidden />} className="!h-5 !px-1.5 !text-[11px]" title={ANNAHME}>
              Schätzung{mitBeispiel ? " (Beispielwerte)" : ""}
            </Chip>
            <span className="hidden text-[12.5px] text-fg-3 md:inline">Annahme je Vorgang aus dem 38h-Motor</span>
          </span>
        )}
      </div>
      <Card>
        {gruppen.length === 0 ? (
          <Empty icon={<History className="size-6" />} title="Noch keine Einträge" text="Alles, was in dieser Akte passiert – von Ihnen, der KI oder dem 38h-Motor – erscheint hier mit Zeitstempel." />
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {gruppen.map(([tag, liste]) => (
              <section key={tag}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold">{tagLabel(tag)}</h3>
                  <span className="text-[12.5px] text-fg-3">{fmtDateLong(tag)}</span>
                </div>
                {/* Nur li als direkte Kinder der Liste – die Zeitleisten-Linie liegt im umgebenden Element */}
                <div className="relative">
                  <span className="absolute bottom-3 left-[13px] top-3 w-px bg-[var(--line-strong)]" aria-hidden />
                <ol className="relative">
                  <AnimatePresence initial={false}>
                    {liste.map((e) => {
                      const i = laufend++;
                      const u = e.userId ? byId.get(e.userId) : undefined;
                      const ic = ICON[e.art];
                      return (
                        <motion.li
                          key={e.id}
                          layout="position"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 10) * 0.035, type: "spring", stiffness: 420, damping: 34 } }}
                          className="relative flex gap-3 pb-4 last:pb-0"
                        >
                          <span className={cn("relative z-10 grid size-[27px] shrink-0 place-items-center rounded-full ring-4 ring-[var(--surface)]", ic.cls)}>{ic.icon}</span>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[13.5px] leading-snug text-fg">{e.titel}</span>
                            </div>
                            {e.text && <p className={cn("mt-1 text-[13px] leading-relaxed", e.art === "notiz" ? "rounded-[12px] bg-amber-soft/50 px-3 py-2 text-fg-2" : "text-fg-3")}>{e.text}</p>}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-3">
                              <span className="num">{fmtTime(e.zeit)} Uhr</span>
                              <span>·</span>
                              {u ? (
                                <span className="inline-flex items-center gap-1">
                                  <Avatar initialen={u.initialen} farbe={u.farbe} size={16} /> {u.name}
                                </span>
                              ) : (
                                <span>{e.kanal === "bea" ? "beA" : ic.label}</span>
                              )}
                              {e.minuten ? (
                                <Chip tone="green" className="!h-5 !px-1.5" title={ANNAHME}>
                                  ≈ {e.minuten} Min. gespart (Schätzung)
                                </Chip>
                              ) : null}
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function tagLabel(tag: string): string {
  const r = relDays(tag, today());
  if (r === "heute" || r === "gestern") return r[0].toUpperCase() + r.slice(1);
  return r.startsWith("vor") ? r[0].toUpperCase() + r.slice(1) : fmtDateLong(tag);
}

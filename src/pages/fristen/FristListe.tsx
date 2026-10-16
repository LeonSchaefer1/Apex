import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck2, ChevronDown } from "lucide-react";
import { addDays, diffDays, fmtDateWd, relDays } from "@/core/dates";
import { feiertagAm } from "@/core/feiertage";
import type { Akte, Bundesland, Frist, User } from "@/core/types";
import { Button, Card, Empty } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FristZeile } from "./FristZeile";

interface Gruppe {
  key: string;
  titel: string;
  sub?: string;
  ton?: "seal" | "ink" | "green";
  items: Frist[];
}

const HORIZONT_TAGE = 21;

function gruppiere(fristen: Frist[], heute: string, land: Bundesland): Gruppe[] {
  const offen = fristen.filter((f) => f.status === "offen").sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? ""));
  const erledigt = fristen.filter((f) => f.status === "erledigt").sort((a, b) => (b.erledigtAm ?? b.datum).localeCompare(a.erledigtAm ?? a.datum));
  const gruppen: Gruppe[] = [];
  const ueber = offen.filter((f) => f.datum < heute);
  if (ueber.length) gruppen.push({ key: "ueber", titel: "Überfällig", sub: "Sofort prüfen", ton: "seal", items: ueber });
  const map = new Map<string, Frist[]>();
  for (const f of offen.filter((x) => x.datum >= heute)) map.set(f.datum, [...(map.get(f.datum) ?? []), f]);
  for (const [datum, items] of map) {
    const n = diffDays(heute, datum);
    const ft = feiertagAm(datum, land);
    const titel = n === 0 ? "Heute" : n === 1 ? "Morgen" : fmtDateWd(datum);
    const sub = [n <= 1 ? fmtDateWd(datum) : relDays(datum, heute), ft?.name].filter(Boolean).join(" · ");
    gruppen.push({ key: datum, titel, sub, ton: n === 0 ? "ink" : undefined, items });
  }
  if (erledigt.length) gruppen.push({ key: "erledigt", titel: "Erledigt", sub: "zuletzt abgeschlossen", ton: "green", items: erledigt.slice(0, 40) });
  return gruppen;
}

export function FristListe({
  fristen, akten, team, user, heute, land, gefiltert, ohneHorizont, markiert, vertretungFuer, onOpen,
}: {
  fristen: Frist[];
  akten: Map<string, Akte>;
  team: User[];
  user: User;
  heute: string;
  land: Bundesland;
  gefiltert: boolean;
  /** Alle späteren Fristen sofort zeigen (z. B. bei Akten- oder Kontrollfilter aus einem Deep-Link) */
  ohneHorizont?: boolean;
  /** Per Deep-Link angesprungener Tag: Gruppe hervorheben und hinscrollen */
  markiert?: string;
  /** Vertretene Personen (heute abwesend, ich bin Vertretung): ID → Name */
  vertretungFuer?: Map<string, string>;
  /** Klick auf eine Fristzeile öffnet das Fristdetail */
  onOpen?: (f: Frist) => void;
}) {
  const [alle, setAlle] = useState(false);
  const gruppen = useMemo(() => gruppiere(fristen, heute, land), [fristen, heute, land]);
  const grenze = addDays(heute, HORIZONT_TAGE);
  const ohneGrenze = alle || ohneHorizont || (!!markiert && markiert > grenze);
  const sichtbar = ohneGrenze ? gruppen : gruppen.filter((g) => g.key === "ueber" || g.key === "erledigt" || g.key <= grenze);
  const versteckt = gruppen.filter((g) => !sichtbar.includes(g)).reduce((s, g) => s + g.items.length, 0);
  const markRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!markiert) return;
    const t = setTimeout(() => markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 260);
    return () => clearTimeout(t);
  }, [markiert]);

  if (!gruppen.length)
    return (
      <Card>
        <Empty
          icon={<CalendarCheck2 className="size-6" />}
          title={gefiltert ? "Keine Fristen für diesen Filter" : "Keine offenen Fristen"}
          text={gefiltert ? "Ändern Sie die Filter, um weitere Fristen zu sehen." : "Alles erledigt. Neue Fristen erkennt die KI automatisch im Posteingang – oder Sie berechnen sie mit dem Fristenrechner."}
        />
      </Card>
    );

  let zaehler = 0;
  return (
    <div className="space-y-6">
      <AnimatePresence initial={false}>
        {sichtbar.map((g) => {
          const start = zaehler;
          zaehler += g.items.length;
          return (
            <motion.section
              key={g.key}
              ref={g.key === markiert ? markRef : undefined}
              data-gruppe={g.key}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className={cn(g.key === markiert && "-m-2 rounded-[24px] bg-ink-softer p-2 ring-2 ring-[var(--ink)]")}
            >
              <div className="mb-2 flex items-baseline gap-2.5 px-1">
                <h3 className={cn("title-md", g.ton === "seal" && "text-seal", g.ton === "ink" && "text-ink", g.ton === "green" && "text-green")}>{g.titel}</h3>
                {g.sub && <span className="num min-w-0 text-[12.5px] text-fg-3">{g.sub}</span>}
                <span className="num ml-auto rounded-full bg-[var(--ink-softer)] px-2 py-0.5 text-[12.5px] font-medium text-fg-3">{g.items.length}</span>
              </div>
              <Card padded={false} className={cn("overflow-hidden", g.ton === "seal" && "ring-1 ring-[color-mix(in_oklab,var(--seal)_25%,transparent)]")}>
                <div className="divide-y divide-[var(--line)]">
                  <AnimatePresence initial={false}>
                    {g.items.map((f, i) => (
                      <FristZeile key={f.id} f={f} akte={akten.get(f.akteId)} team={team} user={user} index={start + i} zeigeDatum={g.key === "ueber" || g.key === "erledigt"} vertretungFuer={vertretungFuer?.get(f.verantwortlichId)} onOpen={onOpen} />
                    ))}
                  </AnimatePresence>
                </div>
              </Card>
            </motion.section>
          );
        })}
      </AnimatePresence>
      {versteckt > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" icon={<ChevronDown className="size-4" />} onClick={() => setAlle(true)}>
            {versteckt} spätere {versteckt === 1 ? "Frist" : "Fristen"} anzeigen (nach {fmtDateWd(grenze)})
          </Button>
        </div>
      )}
    </div>
  );
}

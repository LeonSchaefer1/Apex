import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Clock, MapPin, RotateCcw, ShieldAlert, Sparkles, UserCheck, Users } from "lucide-react";
import { fmtDate, fmtDateShort, fmtDateWd } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import type { Akte, Frist, FristTyp, User } from "@/core/types";
import { toast } from "@/store/ui";
import { Avatar, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { QUELLE_LABEL, TYP_META, bestaetigeKontrolle, brauchtKontrolle, darfKontrollieren, erledigeFrist, istUngeprueft, oeffneFristWieder, streifenFarbe } from "./logik";

const spring = { type: "spring", stiffness: 460, damping: 36 } as const;

export function TypChip({ typ, regelKey }: { typ: FristTyp; regelKey?: string }) {
  const m = TYP_META[typ];
  // Rechtsnatur aus der Fristregel: „Notfrist“ nur, wo das Gesetz die Frist so nennt; nicht verlängerbare Fristen ebenfalls rot
  const art = typ === "notfrist" || typ === "frist" ? fristArtZu({ typ, regelKey }) : undefined;
  if (typ === "vorfrist")
    return (
      <span className="chip !bg-transparent text-fg-2 outline-dashed outline-1 -outline-offset-1 outline-[var(--line-strong)]" title="Vorfrist – Erinnerung vor dem Fristende">
        {m.label}
      </span>
    );
  return (
    <Chip tone={art?.kritisch ? "seal" : m.tone} icon={art?.kritisch ? <ShieldAlert className="size-3" /> : undefined} title={art?.kurz}>
      {art?.label ?? m.label}
    </Chip>
  );
}

export function QuelleChip({ quelle }: { quelle: Frist["quelle"] }) {
  if (quelle === "ki")
    return (
      <span className="chip ai-ring !bg-transparent" title="Von der KI im Posteingang erkannt – berechnet mit dem Fristenrechner">
        <Sparkles className="size-3 text-violet" />
        <span className="ai-text font-semibold">KI</span>
      </span>
    );
  return (
    <Chip tone="neutral" title={quelle === "automatisch" ? "Automatisch angelegt (z. B. Vorfrist, Automation)" : quelle === "migration" ? "Aus der Altsoftware übernommen" : "Von Hand eingetragen"}>
      {QUELLE_LABEL[quelle]}
    </Chip>
  );
}

/** „Erledigt“ mit animiertem Häkchen (Kreis füllt sich, Haken zeichnet sich). */
export function ErledigtKnopf({ erledigt, onClick, className }: { erledigt: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("btn btn-sm btn-secondary !pl-2", className)} aria-pressed={erledigt} title={erledigt ? "Wieder öffnen" : "Als erledigt markieren"}>
      <span className={cn("relative grid size-[18px] place-items-center rounded-full border-[1.5px] transition-colors", erledigt ? "border-green" : "border-[var(--line-strong)]")}>
        <motion.span className="absolute inset-[-1.5px] rounded-full bg-green" initial={false} animate={{ scale: erledigt ? 1 : 0, opacity: erledigt ? 1 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 26 }} />
        <svg viewBox="0 0 24 24" className="relative size-3 text-[var(--surface)]" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: erledigt ? 1 : 0, opacity: erledigt ? 1 : 0 }} transition={{ duration: 0.32, delay: erledigt ? 0.08 : 0 }} />
        </svg>
      </span>
      Erledigt
    </button>
  );
}

export function RechenwegListe({ schritte, className }: { schritte: string[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-2", className)}>
      {schritte.map((s, i) => (
        <motion.li key={`${i}-${s}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.07 }} className="relative flex gap-3">
          {i < schritte.length - 1 && <span className="absolute left-[10px] top-6 h-[calc(100%-12px)] w-px bg-[var(--line-strong)]" aria-hidden />}
          <span className="num relative grid size-[21px] shrink-0 place-items-center rounded-full bg-surface text-[10.5px] font-semibold text-ink ring-1 ring-[var(--line-strong)]">{i + 1}</span>
          <span className="pt-px text-[12.5px] leading-relaxed text-fg-2">{s}</span>
        </motion.li>
      ))}
    </ol>
  );
}

export function useFristAktionen(f: Frist, user: User) {
  const [abhaken, setAbhaken] = useState(false);
  const erledigt = f.status === "erledigt" || abhaken;
  const umschalten = () => {
    if (f.status === "erledigt") {
      oeffneFristWieder(f);
      toast("Wieder geöffnet", { text: f.titel, ton: "info" });
      return;
    }
    setAbhaken(true);
    setTimeout(() => {
      erledigeFrist(f, user.id);
      setAbhaken(false);
      toast(`${TYP_META[f.typ].label} erledigt`, { text: f.titel, ton: "erfolg", aktion: { label: "Rückgängig", onClick: () => oeffneFristWieder(f) } });
    }, 520);
  };
  const kontrollieren = () => {
    if (bestaetigeKontrolle(f, user.id)) toast("Kontrolle bestätigt", { text: `Vier-Augen-Prinzip erfüllt: ${f.titel} (${fmtDate(f.datum)})`, ton: "erfolg" });
  };
  return { erledigt, umschalten, kontrollieren };
}

export function KontrolleAktion({ f, user, kontrollieren, verantwortlich }: { f: Frist; user: User; kontrollieren: () => void; verantwortlich?: User }) {
  if (!brauchtKontrolle(f)) return null;
  if (!darfKontrollieren(f, user.id))
    return (
      <span
        className="chip chip-amber"
        title={`Sie sind für diese Frist verantwortlich. Eine zweite Person muss Datum und Rechenweg bestätigen (Vier-Augen-Prinzip).`}
      >
        <Users className="size-3" />
        Prüfung durch zweite Person
      </span>
    );
  return (
    <button type="button" onClick={kontrollieren} className="btn btn-sm btn-secondary" title={`Frist von ${verantwortlich?.name ?? "Kollegin/Kollege"} prüfen und bestätigen (Vier-Augen-Prinzip)`}>
      <UserCheck className="size-4 text-ink" />
      Kontrolle bestätigen
    </button>
  );
}

export function KontrollStatus({ f, team }: { f: Frist; team: User[] }) {
  if (f.kontrolliertVon) {
    const k = team.find((u) => u.id === f.kontrolliertVon);
    return (
      <Chip tone="green" icon={<UserCheck className="size-3" />} title={`Vier-Augen-Kontrolle durch ${k?.name ?? "Teammitglied"}`}>
        Geprüft{k ? ` · ${k.initialen}` : ""}
      </Chip>
    );
  }
  if (istUngeprueft(f))
    return (
      <Chip tone="amber" dot title="KI-erkannte Frist – noch nicht durch eine zweite Person bestätigt">
        Ungeprüft
      </Chip>
    );
  return null;
}

/** Eine Frist als Zeile: Ampelstreifen, Typ, Akte, Grundlage, Verantwortlich, Quelle, Aktionen, Rechenweg. */
export function FristZeile({ f, akte, team, user, index = 0, zeigeDatum }: { f: Frist; akte?: Akte; team: User[]; user: User; index?: number; zeigeDatum?: boolean }) {
  const [offen, setOffen] = useState(false);
  const { erledigt, umschalten, kontrollieren } = useFristAktionen(f, user);
  const verantwortlich = team.find((u) => u.id === f.verantwortlichId);
  const hatDetails = !!(f.rechenweg?.length || f.notiz || f.ereignisDatum);
  const art = f.typ === "notfrist" || f.typ === "frist" ? fristArtZu(f) : undefined;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
      transition={{ ...spring, delay: Math.min(index, 10) * 0.03 }}
      className="relative overflow-hidden"
    >
      <span className={cn("absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full transition-colors", erledigt ? "bg-green" : streifenFarbe(f))} aria-hidden />
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 py-3.5 pl-5 pr-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <TypChip typ={f.typ} regelKey={f.regelKey} />
            <span className={cn("text-[14px] font-semibold tracking-[-0.01em] transition-colors", erledigt && "text-fg-3 line-through decoration-[var(--line-strong)]")}>{f.titel}</span>
            {zeigeDatum && <span className="num text-[12.5px] text-fg-3">· {fmtDateWd(f.datum)}</span>}
            {f.uhrzeit && (
              <span className="num inline-flex items-center gap-1 text-[12.5px] text-fg-2">
                <Clock className="size-3" />
                {f.uhrzeit} Uhr
              </span>
            )}
          </div>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] text-fg-3">
            {akte ? (
              <Link to={`/akten/${akte.id}?tab=fristen`} className="group inline-flex min-w-0 max-w-full items-baseline gap-1.5 hover:text-ink">
                <span className="mono shrink-0 font-medium text-fg-2 group-hover:text-ink">{akte.aktenzeichen}</span>
                <span className="truncate">{akte.titel}</span>
              </Link>
            ) : (
              <span>Akte nicht gefunden</span>
            )}
            {f.grundlage && <span className="shrink-0">· {f.grundlage}</span>}
            {f.vorfrist && f.typ !== "vorfrist" && f.status === "offen" && <span className="num shrink-0">· Vorfrist {fmtDateShort(f.vorfrist)}</span>}
            {f.ort && (
              <span className="inline-flex min-w-0 items-center gap-1">
                · <MapPin className="size-3 shrink-0" />
                <span className="truncate">{f.ort}</span>
              </span>
            )}
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <QuelleChip quelle={f.quelle} />
              <KontrollStatus f={f} team={team} />
              {hatDetails && (
                <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[11.5px] font-medium text-ink hover:bg-ink-softer">
                  <ChevronDown className={cn("size-3 transition-transform duration-300", offen && "rotate-180")} />
                  {f.rechenweg?.length ? "Rechenweg" : "Details"}
                </button>
              )}
            </span>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {verantwortlich && <Avatar initialen={verantwortlich.initialen} farbe={verantwortlich.farbe} size={28} title={`Verantwortlich: ${verantwortlich.name}`} />}
          {f.status === "offen" && <KontrolleAktion f={f} user={user} kontrollieren={kontrollieren} verantwortlich={verantwortlich} />}
          {f.status === "offen" ? (
            <ErledigtKnopf erledigt={erledigt} onClick={umschalten} />
          ) : (
            <button type="button" onClick={umschalten} className="btn btn-sm btn-ghost" title="Wieder öffnen">
              <RotateCcw className="size-3.5" />
              Wieder öffnen
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {offen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mx-4 mb-4 ml-5 rounded-[16px] bg-[var(--ink-softer)] p-4 ring-1 ring-inset ring-[var(--line)]">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
                {f.ereignisDatum && (
                  <div>
                    <div className="eyebrow !text-[10px]">Ereignis</div>
                    <div className="num mt-0.5 font-medium">{fmtDateWd(f.ereignisDatum)}</div>
                  </div>
                )}
                <div>
                  <div className="eyebrow !text-[10px]">Fristende</div>
                  <div className={cn("num mt-0.5 font-semibold", art?.kritisch && "text-seal")}>{fmtDateWd(f.datum)}</div>
                </div>
                {f.vorfrist && (
                  <div>
                    <div className="eyebrow !text-[10px]">Vorfrist</div>
                    <div className="num mt-0.5 font-medium">{fmtDateWd(f.vorfrist)}</div>
                  </div>
                )}
                {verantwortlich && (
                  <div>
                    <div className="eyebrow !text-[10px]">Verantwortlich</div>
                    <div className="mt-0.5 font-medium">{verantwortlich.name}</div>
                  </div>
                )}
              </div>
              {f.rechenweg?.length ? <RechenwegListe schritte={f.rechenweg} /> : null}
              {art?.versaeumnis && f.status === "offen" && (
                <p className={cn("mt-3 flex gap-2 text-[12.5px] leading-relaxed", art.kritisch ? "text-seal" : "text-fg-2")}>
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {art.art && <strong className="font-semibold">{art.art} </strong>}
                    {art.versaeumnis}
                  </span>
                </p>
              )}
              {f.notiz && <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">{f.notiz}</p>}
              {brauchtKontrolle(f) && f.verantwortlichId === user.id && (
                <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-amber">
                  <Users className="mt-0.5 size-3.5 shrink-0" />
                  Sie sind verantwortlich – die Kontrolle muss eine zweite Person bestätigen (Vier-Augen-Prinzip).
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

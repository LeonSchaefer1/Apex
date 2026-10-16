import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bot, CheckCircle2, ChevronDown, Clock, MapPin, RotateCcw, ShieldAlert, Sparkles, UserCheck, Users } from "lucide-react";
import { fmtDate, fmtDateShort, fmtDateWd, schuetzeLeerzeichen, today } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import type { Akte, Frist, FristTyp, User } from "@/core/types";
import { toast } from "@/store/ui";
import { useCol } from "@/store/data";
import { Avatar, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { QUELLE_LABEL, QUELLE_TITEL, TYP_META, bestaetigeKontrolle, brauchtKontrolle, darfKontrollieren, durchAssistent, erfordertNachweis, erledigeFrist, nachweisText, oeffneFristWieder, streifenFarbe } from "./logik";
import { ErledigenDialog } from "./ErledigenDialog";

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

/** Herkunft der Frist – dieselben Bezeichnungen im Fristenkalender und im Akten-Reiter (QUELLE_LABEL). */
export function QuelleChip({ quelle, notiz }: { quelle: Frist["quelle"]; notiz?: string }) {
  if (durchAssistent({ notiz }))
    return (
      <Chip tone="violet" icon={<Bot className="size-3" />} title="Vom Apex Assistenten auf Ihren Auftrag angelegt">
        Durch Assistent angelegt
      </Chip>
    );
  if (quelle === "ki")
    return (
      <span className="chip ai-ring !bg-transparent" title={QUELLE_TITEL.ki}>
        <Sparkles className="size-3 text-violet" />
        <span className="ai-text font-semibold">{QUELLE_LABEL.ki}</span>
      </span>
    );
  return (
    <Chip tone={quelle === "migration" ? "ink" : "neutral"} title={QUELLE_TITEL[quelle]}>
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
        // Rechenweg sofort vollständig zeigen – kein zeilenweises Einblenden (liest sich ruhiger)
        <li key={`${i}-${s}`} className="relative flex gap-3">
          {i < schritte.length - 1 && <span className="absolute left-[10px] top-6 h-[calc(100%-12px)] w-px bg-[var(--line-strong)]" aria-hidden />}
          <span className="num relative grid size-[21px] shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold text-ink ring-1 ring-[var(--line-strong)]" aria-hidden>
            {i + 1}
          </span>
          <span className="pt-px text-[12.5px] leading-relaxed text-fg-2">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Erledigen, Wiederöffnen, Streichen und Vier-Augen-Kontrolle. Notfristen und Fristen öffnen „Wie wurde die Frist gewahrt?“
 * (Nachweis oder Grund), Wiedervorlagen, Vorfristen und Termine bleiben bei einem Klick. `dialog` muss gerendert werden.
 */
export function useFristAktionen(f: Frist, user: User) {
  const [abhaken, setAbhaken] = useState(false);
  const [dialog, setDialog] = useState<false | "erledigen" | "streichen">(false);
  const erledigt = f.status === "erledigt" || abhaken;
  const umschalten = () => {
    if (f.status === "erledigt") {
      oeffneFristWieder(f, today(), user.id);
      toast("Wieder geöffnet", { text: `${f.titel} – im Verlauf protokolliert`, ton: "info" });
      return;
    }
    if (erfordertNachweis(f)) {
      setDialog("erledigen");
      return;
    }
    setAbhaken(true);
    setTimeout(() => {
      erledigeFrist(f, user.id);
      setAbhaken(false);
      toast(`${TYP_META[f.typ].label} erledigt`, { text: f.titel, ton: "erfolg", aktion: { label: "Rückgängig", onClick: () => oeffneFristWieder(f, today(), user.id) } });
    }, 520);
  };
  const streichen = () => setDialog("streichen");
  const kontrollieren = () => {
    if (bestaetigeKontrolle(f, user.id)) toast("Kontrolle bestätigt", { text: `Vier-Augen-Kontrolle erfüllt: ${f.titel} (${fmtDate(f.datum)})`, ton: "erfolg" });
  };
  const dialogElement = <ErledigenDialog f={f} user={user} open={!!dialog} modus={dialog || "erledigen"} onClose={() => setDialog(false)} />;
  return { erledigt, umschalten, kontrollieren, streichen, dialog: dialogElement };
}

/** Status der Ausgangskontrolle einer erledigten Frist („versandt – Nachweis: beA 16:42 Uhr (Dr. Hartmann)“). */
export function NachweisZeile({ f, team }: { f: Frist; team: User[] }) {
  const nachrichten = useCol("nachrichten");
  if (f.status !== "erledigt" || !erfordertNachweis(f)) return null;
  const text = nachweisText(f, team, nachrichten);
  const ok = !!f.erledigtNachweis && f.erledigtNachweis.art !== "gestrichen";
  return (
    <span className={cn("inline-flex items-start gap-1 text-[12.5px] font-medium", ok ? "text-green" : f.erledigtNachweis ? "text-fg-2" : "text-amber")}>
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
}

/**
 * Aktion zur Vier-Augen-Kontrolle: „Kontrolle bestätigen“ für eine zweite Person. Für die verantwortliche Person selbst
 * gibt es keine Aktion (keine Selbstkontrolle) – den Stand zeigt `KontrollStatus` („Vier-Augen-Kontrolle offen“).
 */
export function KontrolleAktion({ f, user, kontrollieren, verantwortlich }: { f: Frist; user: User; kontrollieren: () => void; verantwortlich?: User }) {
  if (!brauchtKontrolle(f) || !darfKontrollieren(f, user.id)) return null;
  return (
    <button type="button" onClick={kontrollieren} className="btn btn-sm btn-secondary" title={`Datum und Rechenweg der Frist von ${verantwortlich?.name ?? "Kollegin/Kollege"} prüfen und bestätigen (Vier-Augen-Kontrolle)`}>
      <UserCheck className="size-4 text-ink" />
      Kontrolle bestätigen
    </button>
  );
}

/** Stand der Vier-Augen-Kontrolle – einheitlich „Vier-Augen-Kontrolle offen“ bzw. „Kontrolliert von …“. */
export function KontrollStatus({ f, team }: { f: Frist; team: User[] }) {
  if (f.kontrolliertVon) {
    const k = team.find((u) => u.id === f.kontrolliertVon);
    return (
      <Chip tone="green" icon={<UserCheck className="size-3" />} title={`Vier-Augen-Kontrolle durch ${k?.name ?? "ein Teammitglied"}`}>
        Kontrolliert von {k ? k.initialen : "Team"}
      </Chip>
    );
  }
  if (brauchtKontrolle(f))
    return (
      <Chip
        tone="amber"
        icon={<Users className="size-3" />}
        title={`${f.quelle === "ki" ? "Von der KI erkannt – " : f.quelle === "migration" ? "Aus der Altsoftware übernommen – " : ""}noch nicht durch eine zweite Person bestätigt. Die verantwortliche Person kann sich nicht selbst kontrollieren.`}
      >
        Vier-Augen-Kontrolle offen
      </Chip>
    );
  return null;
}

/** Eine Frist als Zeile: Ampelstreifen, Typ, Akte, Grundlage, Verantwortlich, Quelle, Aktionen, Rechenweg. */
export function FristZeile({ f, akte, team, user, index = 0, zeigeDatum, vertretungFuer }: { f: Frist; akte?: Akte; team: User[]; user: User; index?: number; zeigeDatum?: boolean; vertretungFuer?: string }) {
  const [offen, setOffen] = useState(false);
  const { erledigt, umschalten, kontrollieren, dialog } = useFristAktionen(f, user);
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
                <span className="min-w-0 break-words">{akte.titel}</span>
              </Link>
            ) : (
              <span>Akte nicht gefunden</span>
            )}
            {f.grundlage && <span className="shrink-0">· {f.grundlage}</span>}
            {f.vorfrist && f.typ !== "vorfrist" && f.status === "offen" && <span className="num shrink-0">· Vorfrist {fmtDateShort(f.vorfrist)}</span>}
            {f.ort && (
              <span className="inline-flex min-w-0 items-center gap-1">
                · <MapPin className="size-3 shrink-0" />
                <span className="min-w-0 break-words">{f.ort}</span>
              </span>
            )}
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {vertretungFuer && (
                <Chip tone="amber" icon={<Users className="size-3" />} title="Die verantwortliche Person ist heute abwesend und hat Sie als Vertretung eingetragen (§ 53 BRAO)">
                  Vertretung für {vertretungFuer}
                </Chip>
              )}
              <QuelleChip quelle={f.quelle} notiz={f.notiz} />
              <KontrollStatus f={f} team={team} />
              <NachweisZeile f={f} team={team} />
              {hatDetails && (
                <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-ink hover:bg-ink-softer">
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
      {dialog}
      <AnimatePresence initial={false}>
        {offen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="mx-4 mb-4 ml-5 rounded-[16px] bg-[var(--ink-softer)] p-4 ring-1 ring-inset ring-[var(--line)]">
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
                {f.ereignisDatum && (
                  <div>
                    <div className="eyebrow">Ereignis</div>
                    <div className="num mt-0.5 font-medium">{fmtDateWd(f.ereignisDatum)}</div>
                  </div>
                )}
                <div>
                  <div className="eyebrow">Fristende</div>
                  <div className={cn("num mt-0.5 font-semibold", art?.kritisch && "text-seal")}>{fmtDateWd(f.datum)}</div>
                </div>
                {f.vorfrist && (
                  <div>
                    <div className="eyebrow">Vorfrist</div>
                    <div className="num mt-0.5 font-medium">{fmtDateWd(f.vorfrist)}</div>
                  </div>
                )}
                {verantwortlich && (
                  <div>
                    <div className="eyebrow">Verantwortlich</div>
                    <div className="mt-0.5 font-medium">{verantwortlich.name}</div>
                  </div>
                )}
              </div>
              {f.rechenweg?.length ? <RechenwegListe schritte={f.rechenweg} /> : null}
              {art?.versaeumnis && f.status === "offen" && (
                <p className={cn("mt-3 flex gap-2 text-[12.5px] leading-relaxed", art.kritisch ? "text-seal" : "text-fg-2")}>
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {art.art && <strong className="font-semibold">{schuetzeLeerzeichen(art.art)} </strong>}
                    {schuetzeLeerzeichen(art.versaeumnis)}
                  </span>
                </p>
              )}
              {f.notiz && <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">{f.notiz}</p>}
              {brauchtKontrolle(f) && f.verantwortlichId === user.id && (
                <p className="mt-3 flex gap-2 text-[12.5px] leading-relaxed text-amber">
                  <Users className="mt-0.5 size-3.5 shrink-0" />
                  Sie sind verantwortlich – die Vier-Augen-Kontrolle muss eine zweite Person bestätigen.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

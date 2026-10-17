import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bot, CalendarClock, CheckCircle2, ChevronDown, Clock, MapPin, MoreHorizontal, PanelRightOpen, PenLine, RotateCcw, ShieldAlert, Sparkles, Trash2, Undo2, UserCheck, Users } from "lucide-react";
import { fmtDate, fmtDateShort, fmtDateWd, schuetzeLeerzeichen, today } from "@/core/dates";
import { fristArtZu } from "@/core/fristen";
import type { Akte, Frist, FristTyp, User } from "@/core/types";
import { toast } from "@/store/ui";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { Avatar, Chip, Menu } from "@/components/ui";
import { cn } from "@/lib/cn";
import { QUELLE_LABEL, QUELLE_TITEL, TYP_META, bestaetigeKontrolle, brauchtKontrolle, darfKontrollieren, durchAssistent, erfordertNachweis, erledigeFrist, nachweisText, oeffneFristWieder, streifenFarbe } from "./logik";
import { ErledigenDialog } from "./ErledigenDialog";
import { KorrekturAnfordernDialog, KorrekturDialog } from "./KorrekturDialog";

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
      {/* nicht verlängerbare Fristen (§ 4 KSchG …) mit Text, nicht nur Farbe – wie im Kalender (I2-T04-01) */}
      {art?.kritisch && art.label !== "Notfrist" ? `${art.label} · nicht verlängerbar` : (art?.label ?? m.label)}
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
    <button type="button" onClick={onClick} data-aktion="erledigt" className={cn("btn btn-sm btn-secondary !pl-2", className)} aria-pressed={erledigt} title={erledigt ? "Wieder öffnen" : "Als erledigt markieren"}>
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
  const [korrektur, setKorrektur] = useState<false | "korrigieren" | "anfordern">(false);
  const { team } = useKanzlei();
  const verantwortlich = team.find((u) => u.id === f.verantwortlichId);
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
  const korrigieren = () => setKorrektur("korrigieren");
  const korrekturAnfordern = () => setKorrektur("anfordern");
  const dialogElement = (
    <>
      <ErledigenDialog f={f} user={user} open={!!dialog} modus={dialog || "erledigen"} onClose={() => setDialog(false)} />
      <KorrekturDialog f={f} user={user} open={korrektur === "korrigieren"} onClose={() => setKorrektur(false)} />
      <KorrekturAnfordernDialog f={f} user={user} open={korrektur === "anfordern"} onClose={() => setKorrektur(false)} verantwortlich={verantwortlich} />
    </>
  );
  return { erledigt, umschalten, kontrollieren, streichen, korrigieren, korrekturAnfordern, dialog: dialogElement };
}

/** Darf korrigiert bzw. gestrichen werden? Offene Einträge außer Vorfristen (die folgen ihrer Frist). */
export const korrigierbar = (f: Frist) => f.status === "offen" && f.typ !== "vorfrist";

/** Status der Ausgangskontrolle einer erledigten Frist („versandt – Nachweis: beA 16:42 Uhr (Dr. Hartmann)“). */
export function NachweisZeile({ f, team }: { f: Frist; team: User[] }) {
  const nachrichten = useCol("nachrichten");
  const transaktionen = useCol("transaktionen");
  if (f.status !== "erledigt" || !erfordertNachweis(f)) return null;
  const text = nachweisText(f, team, nachrichten, transaktionen);
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
export function KontrolleAktion({ f, user, kontrollieren, verantwortlich, anfordern }: { f: Frist; user: User; kontrollieren: () => void; verantwortlich?: User; anfordern?: () => void }) {
  if (!brauchtKontrolle(f) || !darfKontrollieren(f, user.id)) return null;
  return (
    <>
      <button type="button" onClick={kontrollieren} data-aktion="kontrolle" className="btn btn-sm btn-secondary" title={`Datum und Rechenweg der Frist von ${verantwortlich?.name ?? "Kollegin/Kollege"} prüfen und bestätigen (Vier-Augen-Kontrolle)`}>
        <UserCheck className="size-4 text-ink" />
        Kontrolle bestätigen
      </button>
      {anfordern && !f.korrekturAngefordert && (
        <button type="button" onClick={anfordern} className="btn btn-sm btn-ghost" title={`Mit Grund an ${verantwortlich?.name ?? "die verantwortliche Person"} zurückgeben`}>
          <Undo2 className="size-4" />
          Korrektur anfordern
        </button>
      )}
    </>
  );
}

/** „Korrektur angefordert von Mia Becker: …“ – sichtbar an der Frist, bis korrigiert oder bestätigt ist. */
export function KorrekturHinweis({ f, team }: { f: Frist; team: User[] }) {
  if (!f.korrekturAngefordert || f.status !== "offen") return null;
  const von = team.find((u) => u.id === f.korrekturAngefordert!.vonId)?.name ?? "Kontrolle";
  return (
    <p className="mt-1.5 flex items-start gap-1.5 rounded-[10px] bg-amber-soft px-2.5 py-1.5 text-[12.5px] leading-snug text-fg-2">
      <Undo2 className="mt-0.5 size-3.5 shrink-0 text-amber" aria-hidden />
      <span>
        <strong className="font-semibold text-fg">Korrektur angefordert von {von}:</strong> {f.korrekturAngefordert.grund}
      </span>
    </p>
  );
}

/** Stand der Vier-Augen-Kontrolle – einheitlich „Vier-Augen-Kontrolle offen“ bzw. „Kontrolliert von …“. */
export function KontrollStatus({ f, team }: { f: Frist; team: User[] }) {
  if (f.korrekturAngefordert && f.status === "offen") {
    const von = team.find((u) => u.id === f.korrekturAngefordert!.vonId);
    return (
      <Chip tone="amber" icon={<Undo2 className="size-3" />} title={`Korrektur angefordert: ${f.korrekturAngefordert.grund}`}>
        Korrektur angefordert{von ? ` von ${von.initialen}` : ""}
      </Chip>
    );
  }
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

/**
 * Eigene Frist mit offener Vier-Augen-Kontrolle: Für die verantwortliche Person gibt es keine Kontrollaktion – an der Zeile
 * steht sichtbar, warum (I3-T03-04), nicht nur im Tooltip.
 */
export function EigeneKontrolleHinweis({ f, user, className }: { f: Frist; user: User; className?: string }) {
  if (!brauchtKontrolle(f) || f.verantwortlichId !== user.id) return null;
  return (
    <span className={cn("inline-flex items-start gap-1 text-[12px] leading-snug text-fg-2", className)}>
      <Users className="mt-0.5 size-3.5 shrink-0 text-amber" aria-hidden />
      <span>{f.quelle === "manuell" ? "Von Ihnen notiert – Kontrolle durch Kollegin/Kollegen" : "Vier-Augen offen – bestätigt eine zweite Person"}</span>
    </span>
  );
}

/** Eine Frist als Zeile: Ampelstreifen, Typ, Akte, Grundlage, Verantwortlich, Quelle, Aktionen, Rechenweg. */
export function FristZeile({
  f, akte, team, user, index = 0, zeigeDatum, vertretungFuer, vertretungVorab, onOpen,
}: {
  f: Frist;
  akte?: Akte;
  team: User[];
  user: User;
  index?: number;
  zeigeDatum?: boolean;
  vertretungFuer?: string;
  /** Künftige Vertretung: „Jonas Brandt ab Mo, 19.10.“ */
  vertretungVorab?: string;
  /** Klick auf die Zeile öffnet das Fristdetail */
  onOpen?: (f: Frist) => void;
}) {
  const [offen, setOffen] = useState(false);
  const { erledigt, umschalten, kontrollieren, streichen, korrigieren, korrekturAnfordern, dialog } = useFristAktionen(f, user);
  const verantwortlich = team.find((u) => u.id === f.verantwortlichId);
  const hatDetails = !!(f.rechenweg?.length || f.notiz || f.ereignisDatum);
  const art = f.typ === "notfrist" || f.typ === "frist" ? fristArtZu(f) : undefined;
  const letzteKorrektur = f.korrekturen?.[f.korrekturen.length - 1];
  const letzteKorrekturVon = letzteKorrektur ? team.find((u) => u.id === letzteKorrektur.vonId)?.name : undefined;
  // Telefon: „Kontrolle bestätigen“ (falls erlaubt) bzw. „Erledigt“ sichtbar, alles Übrige im „⋯“-Menü (I3-T03-01)
  const kannKontrolle = f.status === "offen" && darfKontrollieren(f, user.id);
  const mobilMenue = [
    ...(kannKontrolle && !f.korrekturAngefordert ? [{ label: "Korrektur anfordern …", icon: <Undo2 />, onClick: korrekturAnfordern }] : []),
    ...(kannKontrolle ? [{ label: erfordertNachweis(f) ? "Erledigt – mit Nachweis …" : "Erledigt", icon: <CheckCircle2 />, onClick: umschalten }] : []),
    ...(korrigierbar(f)
      ? [
          { label: "Korrigieren …", icon: <PenLine />, onClick: korrigieren },
          ...(f.typ !== "termin" ? [{ label: "Streichen – mit Grund …", icon: <Trash2 />, danger: true, onClick: streichen }] : []),
        ]
      : []),
    ...(onOpen ? [{ label: "Details öffnen", icon: <PanelRightOpen />, onClick: () => onOpen(f) }] : []),
  ];

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
      transition={{ ...spring, delay: Math.min(index, 10) * 0.03 }}
      data-frist-zeile={f.id}
      // Gewählte Zeile (Tastatur: J/K, ↑/↓, Tab) sichtbar markiert – Fläche und Balken, nicht nur der Fokusring (I4-T03-05)
      className="relative overflow-hidden has-[:focus-visible]:bg-ink-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--ink)]"
    >
      <span className={cn("absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full transition-colors", erledigt ? "bg-green" : streifenFarbe(f))} aria-hidden />
      <div
        className={cn("flex flex-wrap items-start gap-x-4 gap-y-3 py-3.5 pl-5 pr-4", onOpen && "cursor-pointer transition-colors hover:bg-ink-softer")}
        onClick={(e) => {
          // Klick auf freie Fläche öffnet das Fristdetail – Knöpfe, Links und Menüs behalten ihre Funktion
          if (!onOpen || (e.target as HTMLElement).closest("button,a,input,select,textarea,[role=menu],[role=menuitem]")) return;
          onOpen(f);
        }}
      >
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <TypChip typ={f.typ} regelKey={f.regelKey} />
            {onOpen ? (
              // Öffnen-Ziel der Zeile: J/K bzw. ↑/↓ setzen den Fokus hierher, Enter öffnet die Details (tabIndex −1: kein zusätzlicher Tab-Stopp)
              <button
                type="button"
                tabIndex={-1}
                data-aktion="titel"
                onClick={() => onOpen(f)}
                aria-label={`${f.titel}${akte ? ` – ${akte.aktenzeichen}` : ""} – ${fmtDateWd(f.datum)} – Details öffnen`}
                className={cn("rounded-[6px] text-left text-[14px] font-semibold tracking-[-0.01em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus)]", erledigt && "text-fg-3 line-through decoration-[var(--line-strong)]")}
              >
                {f.titel}
              </button>
            ) : (
              <span className={cn("text-[14px] font-semibold tracking-[-0.01em] transition-colors", erledigt && "text-fg-3 line-through decoration-[var(--line-strong)]")}>{f.titel}</span>
            )}
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
              {f.korrekturen?.length ? (
                <Chip tone="neutral" icon={<PenLine className="size-3" />} title={f.korrekturen.map((k, i) => `${fmtDate(k.am.slice(0, 10))}: ${fmtDate(k.vorher.datum)} → ${fmtDate(f.korrekturen![i + 1]?.vorher.datum ?? f.datum)} – ${k.grund}`).join(" · ")}>
                  korrigiert
                </Chip>
              ) : null}
              {vertretungFuer && (
                <Chip tone="amber" icon={<Users className="size-3" />} title="Die verantwortliche Person ist heute abwesend und hat Sie als Vertretung eingetragen (§ 53 BRAO)">
                  Vertretung für {vertretungFuer}
                </Chip>
              )}
              {!vertretungFuer && vertretungVorab && (
                <Chip tone="amber" icon={<CalendarClock className="size-3" />} title="Die verantwortliche Person ist dann abwesend und hat Sie als Vertretung eingetragen (§ 53 BRAO) – vorab eingeblendet">
                  Vertretung für {vertretungVorab}
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
        {/* Telefon (< 640 px): nie abschneiden – eine Hauptaktion sichtbar, alle übrigen im „⋯“-Menü (immer rechts, 44 × 44 px) */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:hidden">
          <EigeneKontrolleHinweis f={f} user={user} className="basis-full" />
          {verantwortlich && <Avatar initialen={verantwortlich.initialen} farbe={verantwortlich.farbe} size={28} title={`Verantwortlich: ${verantwortlich.name}`} />}
          {kannKontrolle ? (
            <button type="button" onClick={kontrollieren} data-aktion="kontrolle" className="btn btn-sm btn-secondary min-h-11 shrink-0" title={`Datum und Rechenweg der Frist von ${verantwortlich?.name ?? "Kollegin/Kollege"} prüfen und bestätigen (Vier-Augen-Kontrolle)`}>
              <UserCheck className="size-4 text-ink" />
              Kontrolle bestätigen
            </button>
          ) : f.status === "offen" ? (
            <ErledigtKnopf erledigt={erledigt} onClick={umschalten} className="min-h-11 shrink-0" />
          ) : (
            <button type="button" onClick={umschalten} data-aktion="wieder" className="btn btn-sm btn-ghost min-h-11 shrink-0" title="Wieder öffnen">
              <RotateCcw className="size-3.5" />
              Wieder öffnen
            </button>
          )}
          {mobilMenue.length > 0 && (
            <div className="ml-auto shrink-0">
              <Menu
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} data-aktion="menue" className="icon-btn !size-11 text-fg-2" aria-label={`Weitere Aktionen für ${f.titel}`} title="Weitere Aktionen">
                    <MoreHorizontal className="size-5" />
                  </button>
                )}
                items={mobilMenue}
              />
            </div>
          )}
        </div>
        <div className="ml-auto hidden shrink-0 flex-wrap items-center justify-end gap-2 sm:flex">
          {verantwortlich && <Avatar initialen={verantwortlich.initialen} farbe={verantwortlich.farbe} size={28} title={`Verantwortlich: ${verantwortlich.name}`} />}
          <EigeneKontrolleHinweis f={f} user={user} className="max-w-[230px]" />
          {f.status === "offen" && <KontrolleAktion f={f} user={user} kontrollieren={kontrollieren} verantwortlich={verantwortlich} anfordern={korrekturAnfordern} />}
          {f.status === "offen" ? (
            <ErledigtKnopf erledigt={erledigt} onClick={umschalten} />
          ) : (
            <button type="button" onClick={umschalten} data-aktion="wieder" className="btn btn-sm btn-ghost" title="Wieder öffnen">
              <RotateCcw className="size-3.5" />
              Wieder öffnen
            </button>
          )}
          {(onOpen || korrigierbar(f)) && (
            <Menu
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} data-aktion="menue" className="icon-btn !size-9 text-fg-3" aria-label={`Weitere Aktionen für ${f.titel}`} title="Korrigieren, Streichen, Details">
                  <MoreHorizontal className="size-4" />
                </button>
              )}
              items={[
                ...(onOpen ? [{ label: "Details öffnen", icon: <PanelRightOpen />, onClick: () => onOpen(f) }] : []),
                ...(korrigierbar(f)
                  ? [
                      { label: "Korrigieren …", icon: <PenLine />, onClick: korrigieren },
                      ...(f.typ !== "termin" ? [{ label: "Streichen – mit Grund …", icon: <Trash2 />, danger: true, onClick: streichen }] : []),
                    ]
                  : []),
              ]}
            />
          )}
        </div>
      </div>
      <div className="-mt-2 pb-2 pl-5 pr-4 empty:hidden">
        <KorrekturHinweis f={f} team={team} />
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
              {f.korrekturen?.length ? (
                <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">
                  {f.korrekturen.length === 1 ? "1 Korrektur" : `${f.korrekturen.length} Korrekturen`} – zuletzt: {letzteKorrektur?.grund} ({letzteKorrektur ? fmtDate(letzteKorrektur.vorher.datum) : ""} → {fmtDate(f.datum)}
                  {letzteKorrekturVon ? `, ${letzteKorrekturVon}` : ""})
                </p>
              ) : null}
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

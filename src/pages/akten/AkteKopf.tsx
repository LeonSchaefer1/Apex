// Kopf der Akte: Aktenzeichen, Titel, Status-Chips, Beteiligte, Aktionen und Phasen-Leiste.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Archive, CalendarClock, CalendarPlus, Check, ChevronDown, CircleDot, CircleHelp, Copy, Eye, FolderOpen, Globe, Lock, Mail, MoreHorizontal, PauseCircle, PlayCircle, Sparkles, StickyNote } from "lucide-react";
import type { Akte, AktenPhase, Buchung, Frist, Rechnung } from "@/core/types";
import { istKritisch, zaehltAlsFrist } from "@/core/fristenLage";
import { addMonthsBGB, fmtDate, fmtDateWd, fmtEUR, nowLocal, round2, today } from "@/core/dates";
import { istOffen, offenerBetrag } from "@/pages/abrechnung/lib";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast, useUI } from "@/store/ui";
import { Avatar, Button, Card, Chip, Field, IconButton, Input, Menu, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KontaktAvatar, kopiere } from "@/pages/kontakte/kontaktHelfer";
import { DECKUNG_INFO, PHASEN, PRIO_INFO, SACHGEBIET_ICON, STATUS_INFO, SachgebietChip, abschlussText, kontoSummen, useKontaktMap, useTeam } from "./helfer";
import { PORTAL_WV_TITEL, portalOffenBis, sperrePortal, useMandantenportal } from "./Mandantenportal";
import { legeFristAn } from "@/pages/fristen/logik";
import { DateiDialog, type AusgabeDatei } from "@/pages/fristen/dateiAusgabe";
import { erzeugeIcs, icsDateiname } from "@/pages/fristen/ics";

/** Nächster offener Termin einer Akte (Datum, Uhrzeit, Gericht/Saal) */
export function naechsterTermin(akteId: string, fristen: Frist[]): Frist | undefined {
  const heute = today();
  return fristen
    .filter((f) => f.akteId === akteId && f.typ === "termin" && f.status === "offen" && f.datum >= heute)
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? ""))[0];
}

export interface OffeneEintraege {
  /** Notfristen und Fristen (`zaehltAlsFrist`) */
  fristen: number;
  /** davon kritisch: Notfrist oder nicht verlängerbar (`istKritisch`) */
  notfristen: number;
  wiedervorlagen: number;
  termine: number;
}

/** Offene Einträge einer Akte – Fristen (Notfristen und Fristen), Wiedervorlagen und Termine getrennt gezählt (wie fristenLage). */
export function offeneEintraege(akteId: string, fristen: Frist[]): OffeneEintraege {
  const offen = fristen.filter((f) => f.akteId === akteId && f.status === "offen");
  const echte = offen.filter(zaehltAlsFrist);
  return {
    fristen: echte.length,
    notfristen: echte.filter(istKritisch).length,
    wiedervorlagen: offen.filter((f) => f.typ === "wiedervorlage").length,
    termine: offen.filter((f) => f.typ === "termin").length,
  };
}

/** „2 offene Fristen (davon 1 nicht verlängerbar), 1 Wiedervorlage und 1 offener Termin“ – leer, wenn nichts offen ist. */
export function offeneEintraegeText(o: OffeneEintraege): string {
  const teile: string[] = [];
  if (o.fristen) teile.push(`${o.fristen} offene ${o.fristen === 1 ? "Frist" : "Fristen"}${o.notfristen ? ` (davon ${o.notfristen} nicht verlängerbar)` : ""}`);
  if (o.wiedervorlagen) teile.push(`${o.wiedervorlagen} ${o.wiedervorlagen === 1 ? "offene Wiedervorlage" : "offene Wiedervorlagen"}`);
  if (o.termine) teile.push(`${o.termine} ${o.termine === 1 ? "offener Termin" : "offene Termine"}`);
  return teile.length > 1 ? `${teile.slice(0, -1).join(", ")} und ${teile[teile.length - 1]}` : teile.join("");
}

/** Schließt eine Akte ohne Rückfrage ab: Status, Phase, Datum und Protokoll (Archivierung, Aufbewahrung nach § 50 BRAO). */
export function schliesseAkteAb(akte: Akte, userId: string): number {
  const st = useData.getState();
  const jahr = Number(today().slice(0, 4)) + 6;
  st.patch("akten", akte.id, { status: "abgeschlossen", phase: "Abgeschlossen", abgeschlossenAm: today(), updatedAt: nowLocal() });
  st.log({ akteur: "nutzer", userId, akteId: akte.id, text: `Akte abgeschlossen – ${akte.aktenzeichen} ${akte.titel}` });
  st.log({ akteur: "automation", automationKey: "archivierung", akteId: akte.id, minutenGespart: 6, text: `Akte archiviert, Aufbewahrungsfrist bis 31.12.${jahr} vorgemerkt – ${akte.aktenzeichen}` });
  return jahr;
}

/**
 * Hinweise vor dem Abschließen: offene Einträge im Fristenkalender (mit richtigem Numerus), offene Rechnungen, offener Saldo
 * des Honorarkontos und nicht weitergeleitetes Fremdgeld (§ 43a Abs. 7 BRAO).
 */
export function abschlussHinweise(akteId: string, data: { fristen: Frist[]; rechnungen: Rechnung[]; buchungen: Buchung[] }): { text: string; warnung: boolean } {
  const o = offeneEintraege(akteId, data.fristen);
  const anzahl = o.fristen + o.wiedervorlagen + o.termine;
  const teile: string[] = [];
  if (anzahl) teile.push(`Es ${anzahl === 1 ? "ist" : "sind"} noch ${offeneEintraegeText(o)} eingetragen – ${anzahl === 1 ? "der Eintrag bleibt" : "die Einträge bleiben"} im Fristenkalender stehen.`);
  const rechnungen = data.rechnungen.filter((r) => r.akteId === akteId && istOffen(r));
  const offenR = round2(rechnungen.reduce((s, r) => s + offenerBetrag(r), 0));
  const konto = kontoSummen(data.buchungen.filter((b) => b.akteId === akteId));
  if (rechnungen.length) teile.push(`${rechnungen.length === 1 ? "1 Rechnung ist" : `${rechnungen.length} Rechnungen sind`} noch offen (${fmtEUR(offenR)}).`);
  if (konto.offen > 0) teile.push(`Offener Saldo im Aktenkonto: ${fmtEUR(konto.offen)}.`);
  if (konto.fremdOffen > 0) teile.push(`${fmtEUR(konto.fremdOffen)} Fremdgeld sind noch nicht weitergeleitet (§ 43a Abs. 7 BRAO).`);
  const warnung = teile.length > 0;
  if (!rechnungen.length && konto.offen <= 0 && konto.fremdOffen <= 0) teile.push("Keine offenen Rechnungen, das Aktenkonto ist ausgeglichen.");
  return { text: `${warnung ? "Achtung: " : ""}${teile.join(" ")}`, warnung };
}

/** Mandantenportal beim Abschluss: sperren (Standard) oder bis zu einem Datum offen lassen (Wiedervorlage zum Sperren). */
export type PortalBeimAbschluss = { art: "sperren" } | { art: "offen"; bis: string };

/**
 * Akte abschließen – bei aktivem Mandantenportal mit Entscheidung „Portal sperren“ bzw. „offen lassen bis …“ (I3-T23-03):
 * Verlaufseintrag, beim Offenlassen eine Wiedervorlage zum Sperren am gewählten Tag.
 */
export function akteAbschliessenMitPortal(akte: Akte, userId: string, portal?: PortalBeimAbschluss): number {
  const jahr = schliesseAkteAb(akte, userId);
  if (akte.mandantenportal && portal?.art === "sperren") sperrePortal(akte, userId, "beim Abschluss der Akte");
  if (akte.mandantenportal && portal?.art === "offen") {
    legeFristAn({
      akteId: akte.id,
      titel: PORTAL_WV_TITEL,
      typ: "wiedervorlage",
      datum: portal.bis,
      quelle: "automatisch",
      verantwortlichId: akte.bearbeiterId,
      notiz: `Beim Abschluss am ${fmtDate(today())} offen gelassen – am ${fmtDate(portal.bis)} sperren.`,
    });
    useData.getState().log({ akteur: "nutzer", userId, akteId: akte.id, text: `Mandantenportal bleibt nach dem Abschluss aktiv bis ${fmtDate(portal.bis)} – Wiedervorlage zum Sperren angelegt – ${akte.aktenzeichen}` });
  }
  return jahr;
}

/** Rückfrage „Akte abschließen?“ mit Hinweisen und – bei aktivem Portal – der Entscheidung zum Mandantenportal. */
function AbschlussDialog({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
  const { user } = useKanzlei();
  const data = useData((s) => s.data);
  const vorschlag = addMonthsBGB(today(), 3).date;
  const [portalArt, setPortalArt] = useState<"sperren" | "offen">("sperren");
  const [bis, setBis] = useState(vorschlag);
  useEffect(() => {
    if (!open) return;
    setPortalArt("sperren");
    setBis(addMonthsBGB(today(), 3).date);
  }, [open]);
  const { text, warnung } = useMemo(() => (open ? abschlussHinweise(akte.id, data) : { text: "", warnung: false }), [open, akte.id, data]);
  const bisOk = /^\d{4}-\d{2}-\d{2}$/.test(bis) && bis > today();
  const abschliessen = () => {
    if (akte.mandantenportal && portalArt === "offen" && !bisOk) return;
    const jahr = akteAbschliessenMitPortal(akte, user.id, akte.mandantenportal ? (portalArt === "offen" ? { art: "offen", bis } : { art: "sperren" }) : undefined);
    onClose();
    toast("Akte abgeschlossen", {
      ton: "erfolg",
      text: `Aufbewahrung bis 31.12.${jahr} vorgemerkt (§ 50 BRAO)${akte.mandantenportal ? (portalArt === "offen" ? ` · Mandantenportal aktiv bis ${fmtDate(bis)}` : " · Mandantenportal gesperrt") : ""}`,
    });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      icon={<Archive className="size-[18px]" />}
      title={`Akte ${akte.aktenzeichen} abschließen?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={abschliessen} disabled={!!akte.mandantenportal && portalArt === "offen" && !bisOk}>
            Akte abschließen
          </Button>
        </>
      }
    >
      <p className="text-[14px] text-fg-2">
        {text} Die Akte wird archiviert und die Aufbewahrungsfrist der Handakte (§ 50 BRAO, sechs Jahre) vorgemerkt.{warnung ? "" : " Sie können sie jederzeit wieder öffnen."}
      </p>
      {akte.mandantenportal && (
        <fieldset className="mt-4 rounded-[16px] bg-ink-softer p-3.5 ring-1 ring-inset ring-[var(--line)]">
          <legend className="sr-only">Mandantenportal nach dem Abschluss</legend>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Globe className="size-4 text-green" aria-hidden /> Das Mandantenportal ist aktiv – was soll damit geschehen?
          </div>
          <label className="mt-2.5 flex min-h-11 cursor-pointer items-start gap-2.5 text-[13.5px]">
            <input type="radio" name={`portal-${akte.id}`} className="mt-1 size-4 accent-[var(--ink)]" checked={portalArt === "sperren"} onChange={() => setPortalArt("sperren")} />
            <span>
              <span className="font-medium">Portal sperren</span>
              <span className="block text-[12.5px] text-fg-3">Der Mandant verliert den Zugang mit dem Abschluss (empfohlen).</span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-[13.5px]">
            <input type="radio" name={`portal-${akte.id}`} className="mt-1 size-4 accent-[var(--ink)]" checked={portalArt === "offen"} onChange={() => setPortalArt("offen")} />
            <span className="min-w-0 flex-1">
              <span className="font-medium">Offen lassen bis …</span>
              <span className="block text-[12.5px] text-fg-3">Für Nachfragen oder Unterlagen; am gewählten Tag erinnert eine Wiedervorlage ans Sperren.</span>
            </span>
          </label>
          {portalArt === "offen" && (
            <Field label="Portal aktiv bis" htmlFor={`portal-bis-${akte.id}`} className="ml-6 mt-1" hint={!bisOk ? "Bitte ein Datum nach heute wählen." : `Vorschlag: drei Monate (${fmtDate(vorschlag)})`}>
              <Input id={`portal-bis-${akte.id}`} type="date" min={today()} value={bis} onChange={(e) => setBis(e.target.value)} aria-invalid={!bisOk} />
            </Field>
          )}
        </fieldset>
      )}
    </Modal>
  );
}

export function AkteKopf({
  akte,
  onEmail,
  onFrist,
  onKi,
  onNotiz,
  onWiedervorlage,
}: {
  akte: Akte;
  onEmail: () => void;
  onFrist: () => void;
  onKi: () => void;
  /** Notiz bzw. Wiedervorlage – auch ohne die mobile Schnellaktionsleiste erreichbar (I3-T05-01) */
  onNotiz?: () => void;
  onWiedervorlage?: () => void;
}) {
  const kontakte = useKontaktMap();
  const fristen = useCol("fristen");
  const termin = naechsterTermin(akte.id, fristen);
  const portalAktionen = useMandantenportal(akte);
  const { byId } = useTeam();
  const { user } = useKanzlei();
  const mandant = kontakte.get(akte.mandantId);
  const gegner = akte.gegnerId ? kontakte.get(akte.gegnerId) : undefined;
  const gegneranwalt = akte.gegneranwaltId ? kontakte.get(akte.gegneranwaltId) : undefined;
  const gericht = akte.gerichtId ? kontakte.get(akte.gerichtId) : undefined;
  const ra = byId.get(akte.bearbeiterId);
  const sb = akte.sachbearbeiterId ? byId.get(akte.sachbearbeiterId) : undefined;
  const Icon = SACHGEBIET_ICON[akte.sachgebiet];
  const [datei, setDatei] = useState<AusgabeDatei | null>(null);
  const [abschluss, setAbschluss] = useState(false);
  const aktivitaeten = useCol("aktivitaeten");
  const portalBis = akte.mandantenportal ? portalOffenBis(akte.id, fristen) : undefined;
  // „Mandantenportal gesperrt“ im Kopf einer abgeschlossenen Akte, deren Portal (beim Abschluss oder danach) gesperrt wurde
  const portalGesperrt = !akte.mandantenportal && akte.status === "abgeschlossen" && aktivitaeten.some((a) => a.akteId === akte.id && a.text.startsWith("Mandantenportal gesperrt"));
  const terminIcs = () =>
    termin &&
    setDatei({
      name: icsDateiname(termin, akte),
      mime: "text/calendar",
      inhalt: erzeugeIcs([{ f: termin, akte }], `Termin ${akte.aktenzeichen}`),
      beschreibung: "Kalendereintrag zum Übernehmen in Outlook, Apple oder Google Kalender",
    });

  const setzeStatus = (status: Akte["status"]) => {
    const st = useData.getState();
    st.patch("akten", akte.id, { status, phase: status === "offen" && akte.phase === "Abgeschlossen" ? "Außergerichtlich" : akte.phase, abgeschlossenAm: undefined, updatedAt: nowLocal() });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Status geändert: ${STATUS_INFO[status].label} – ${akte.aktenzeichen}` });
    toast(status === "ruhend" ? "Akte ruht" : "Akte wieder offen", { ton: "erfolg" });
  };
  // Freischalten nur nach Rückfrage (Empfängeradresse, was sichtbar ist), Sperren sofort – beides protokolliert
  const portal = () => (akte.mandantenportal ? portalAktionen.sperren() : portalAktionen.freischalten());

  return (
    <Card padded={false}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-[240px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid grid-cols-1 size-8 place-items-center rounded-[10px] bg-ink-soft text-ink">
                <Icon className="size-4" />
              </span>
              <button
                type="button"
                onClick={() => kopiere(akte.aktenzeichen, "Aktenzeichen")}
                title="Aktenzeichen kopieren"
                className="group mono inline-flex h-8 items-center gap-1.5 rounded-full max-sm:h-11 bg-ink-softer px-3 text-[13.5px] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-ink-soft"
              >
                {akte.aktenzeichen}
                <Copy className="size-3 text-fg-3 transition-colors group-hover:text-ink" />
              </button>
              <span className="text-[12.5px] text-fg-3">angelegt am {fmtDate(akte.createdAt.slice(0, 10))}</span>
            </div>
          </div>
          {/* Telefon: Ist diese Knopfreihe aus dem Bild gescrollt, erscheint unten die Aktionsleiste „Notiz · Frist · Wiedervorlage“ (AkteDetail, I5-T14-01) */}
          <div id="akte-kopf-aktionen" className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
            <Button variant="secondary" icon={<Mail className="size-4" />} onClick={onEmail} className="flex-1 max-sm:[--h:44px] sm:flex-none">
              <span className="sm:hidden">E-Mail</span>
              <span className="hidden sm:inline">E-Mail schreiben</span>
            </Button>
            <Button variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={onFrist} className="flex-1 max-sm:[--h:44px] sm:flex-none">
              <span className="sm:hidden">Frist</span>
              <span className="hidden sm:inline">Frist anlegen</span>
            </Button>
            {/* Telefon: Schnellaktionen im Aktenkopf – nichts liegt über Termin, Gericht oder „KI-Analyse“ (I4-T14-01); nach dem
                Scrollen dieselben Aktionen in der Leiste im Daumenbereich (I5-T14-01) */}
            {onNotiz && (
              <Button variant="secondary" icon={<StickyNote className="size-4" />} onClick={onNotiz} className="flex-1 [--h:44px] sm:!hidden">
                Notiz
              </Button>
            )}
            {onWiedervorlage && (
              <Button variant="secondary" icon={<CalendarClock className="size-4" />} onClick={onWiedervorlage} className="flex-1 [--h:44px] sm:!hidden">
                <span className="min-[380px]:hidden" aria-hidden>
                  WV
                </span>
                <span className="max-[379px]:sr-only">Wiedervorlage</span>
              </Button>
            )}
            <Button variant="ai" icon={<Sparkles className="size-4" />} onClick={onKi} className="flex-1 max-sm:[--h:44px] sm:flex-none">
              <span className="sm:hidden">KI-Analyse</span>
              <span className="hidden sm:inline">KI-Fallanalyse</span>
            </Button>
            <Menu
              trigger={({ toggle }) => (
                <IconButton label="Weitere Aktionen" onClick={toggle} className="shadow-[inset_0_0_0_1px_var(--line)] max-sm:!size-11">
                  <MoreHorizontal className="size-[18px]" />
                </IconButton>
              )}
              items={[
                ...(onNotiz ? [{ label: "Notiz …", icon: <StickyNote />, onClick: onNotiz }] : []),
                ...(onWiedervorlage ? [{ label: "Wiedervorlage …", icon: <CalendarClock />, onClick: onWiedervorlage }, "sep" as const] : []),
                akte.status === "ruhend"
                  ? { label: "Bearbeitung wieder aufnehmen", icon: <PlayCircle />, onClick: () => setzeStatus("offen") }
                  : akte.status === "offen"
                    ? { label: "Akte ruhen lassen", icon: <PauseCircle />, onClick: () => setzeStatus("ruhend"), hint: "Status" }
                    : { label: "Akte wieder öffnen", icon: <FolderOpen />, onClick: () => setzeStatus("offen") },
                ...(akte.status !== "abgeschlossen" ? [{ label: "Akte abschließen …", icon: <Archive />, onClick: () => setAbschluss(true) }] : []),
                "sep" as const,
                { label: akte.mandantenportal ? "Mandantenportal sperren" : "Mandantenportal freischalten …", icon: akte.mandantenportal ? <Lock /> : <Globe />, onClick: portal },
                { label: "Als Mandant ansehen", icon: <Eye />, onClick: portalAktionen.ansehen },
                { label: "Aktenzeichen kopieren", icon: <Copy />, onClick: () => void kopiere(akte.aktenzeichen, "Aktenzeichen") },
              ]}
            />
          </div>
          <div className="min-w-0 basis-full">
            <div className="flex items-start gap-2">
              <h1 className="title-xl min-w-0 break-words">{akte.titel}</h1>
              {/* Schnellhilfe wie im PageHeader der Bereichsseiten */}
              <IconButton label="Was ist das? Schnellhilfe öffnen" size="sm" onClick={() => useUI.getState().zeigeHilfe("akten")} className="mt-0.5 shrink-0 text-fg-3 max-sm:!size-11">
                <CircleHelp className="size-[18px]" />
              </IconButton>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SachgebietChip sg={akte.sachgebiet} />
              {!(akte.status === "abgeschlossen" && akte.phase === "Abgeschlossen") && (
                <Chip tone="ink" icon={<CircleDot className="size-3" />}>
                  {akte.phase}
                </Chip>
              )}
              {akte.status !== "offen" && (
                <Chip tone={STATUS_INFO[akte.status].tone} dot title={akte.abschlussdatumUnbekannt ? "Aus dem Umzug: Abschlussdatum im Altsystem nicht übertragen – Aufbewahrung (§ 50 BRAO) vorsorglich ab Übernahme" : undefined}>
                  {abschlussText(akte)}
                </Chip>
              )}
              {akte.prioritaet !== "normal" && (
                <Chip tone={PRIO_INFO[akte.prioritaet].tone} dot={akte.prioritaet === "hoch"}>
                  {PRIO_INFO[akte.prioritaet].label}
                </Chip>
              )}
              {akte.rsv && (
                <Chip tone={DECKUNG_INFO[akte.rsv.deckung].tone} title={`${akte.rsv.versicherung} · ${akte.rsv.versicherungsnummer || "Versicherungsnummer wird nachgereicht"}`}>
                  RSV · {DECKUNG_INFO[akte.rsv.deckung].label}
                </Chip>
              )}
              {akte.mandantenportal && (
                <Chip tone="green" icon={<Globe className="size-3" />} title={portalBis ? `Wiedervorlage zum Sperren am ${fmtDate(portalBis.datum)}` : undefined}>
                  Mandantenportal aktiv{portalBis ? ` bis ${fmtDate(portalBis.datum)}` : ""}
                </Chip>
              )}
              {portalGesperrt && (
                <Chip tone="neutral" icon={<Lock className="size-3" />}>
                  Mandantenportal gesperrt
                </Chip>
              )}
            </div>
          </div>
        </div>

        {/* Kompakt: auf L eine Zeile mit sechs Angaben (Gericht mit gerichtlichem Az.), damit die Reiter ohne Scrollen sichtbar sind */}
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[var(--line)] pt-4 lg:grid-cols-3 xl:grid-cols-6">
          <Fakt label="Mandant">
            {mandant ? (
              <Link to={`/kontakte?id=${mandant.id}`} className="group flex min-h-11 min-w-0 items-center gap-2 sm:min-h-6 pointer-coarse:min-h-11">
                <KontaktAvatar k={mandant} size={24} />
                <span className="min-w-0 break-words font-medium group-hover:text-ink">{mandant.name}</span>
              </Link>
            ) : (
              "–"
            )}
          </Fakt>
          <Fakt label="Gegner" sub={gegneranwalt ? `vertreten durch ${gegneranwalt.name}` : undefined}>
            {gegner ? (
              <Link to={`/kontakte?id=${gegner.id}`} className="flex min-h-11 min-w-0 items-center break-words font-medium hover:text-ink sm:min-h-6 pointer-coarse:min-h-11">
                {gegner.name}
              </Link>
            ) : (
              <span className="text-fg-3">nicht erfasst</span>
            )}
          </Fakt>
          <Fakt
            label="Gericht"
            sub={
              akte.gerichtsAz ? (
                <button type="button" onClick={() => void kopiere(akte.gerichtsAz!, "Gerichtliches Aktenzeichen")} title="Gerichtliches Aktenzeichen kopieren" className="mono inline-flex min-h-11 items-center break-all text-left font-medium text-fg-2 hover:text-ink sm:min-h-6 pointer-coarse:min-h-11">
                  Az. {akte.gerichtsAz}
                </button>
              ) : gericht ? (
                "Az. noch nicht bekannt"
              ) : undefined
            }
          >
            {gericht ? (
              <Link to={`/kontakte?id=${gericht.id}`} className="flex min-h-11 min-w-0 items-center break-words font-medium hover:text-ink sm:min-h-6 pointer-coarse:min-h-11">
                {gericht.name}
              </Link>
            ) : (
              <span className="text-fg-3">noch kein Verfahren</span>
            )}
          </Fakt>
          <Fakt
            label="Nächster Termin"
            sub={
              termin ? (
                <>
                  <span className="block">{[termin.titel, termin.ort].filter(Boolean).join(" · ")}</span>
                  <button type="button" onClick={terminIcs} className="mt-0.5 inline-flex min-h-11 items-center gap-1 font-medium text-ink hover:underline sm:min-h-6 pointer-coarse:min-h-11" title="Termin als Kalenderdatei (.ics) für Outlook, Apple oder Google Kalender">
                    <CalendarPlus className="size-3.5" aria-hidden />
                    In Kalender (.ics)
                  </button>
                </>
              ) : undefined
            }
          >
            {termin ? (
              <span className="num font-medium">
                {fmtDateWd(termin.datum)}
                {termin.uhrzeit ? `, ${termin.uhrzeit} Uhr` : ""}
              </span>
            ) : (
              <span className="text-fg-3">kein Termin</span>
            )}
          </Fakt>
          <Fakt label="Gegenstandswert" sub={akte.forderung ? `Hauptforderung ${fmtEUR(akte.forderung.hauptforderung)}` : akte.rsv ? `${akte.rsv.versicherung}` : undefined}>
            <span className="num text-[15px] font-semibold">{akte.gegenstandswert ? fmtEUR(akte.gegenstandswert) : "–"}</span>
          </Fakt>
          <Fakt label="Bearbeitung" sub={sb ? `Sachbearbeitung: ${sb.name}` : undefined}>
            {ra ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar initialen={ra.initialen} farbe={ra.farbe} size={24} />
                <span className="min-w-0 break-words font-medium">{ra.name}</span>
              </span>
            ) : (
              "–"
            )}
          </Fakt>
        </dl>
      </div>
      <PhasenLeiste akte={akte} onAbschliessen={() => setAbschluss(true)} />
      {portalAktionen.dialoge}
      <AbschlussDialog akte={akte} open={abschluss} onClose={() => setAbschluss(false)} />
      <DateiDialog datei={datei} onClose={() => setDatei(null)} />
    </Card>
  );
}

function Fakt({ label, sub, children, className }: { label: string; sub?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 min-w-0 text-[13.5px]">
        <div className="flex min-w-0 items-center">{children}</div>
        {sub && <div className="mt-0.5 break-words text-[12.5px] text-fg-3">{sub}</div>}
      </dd>
    </div>
  );
}

/** Verfahrensstand als klickbare Schrittfolge mit gleitender Markierung. */
const VERFAHRENSSTAND_KEY = "apex.akte.verfahrensstand";
function leseOffen(): boolean {
  // ohne eigene Wahl: auf niedrigen Bildschirmen (L, 1366 × 768) eingeklappt – die Reiter bleiben ohne Scrollen sichtbar
  const standard = typeof window === "undefined" || window.innerHeight >= 900;
  try {
    const v = localStorage.getItem(VERFAHRENSSTAND_KEY);
    return v ? v !== "zu" : standard;
  } catch {
    return standard;
  }
}

function PhasenLeiste({ akte, onAbschliessen }: { akte: Akte; onAbschliessen: () => void }) {
  const { user } = useKanzlei();
  // Einklappbar – der Zustand bleibt je Gerät erhalten
  const [offen, setOffen] = useState(leseOffen);
  const umschalten = () => {
    setOffen((o) => {
      try {
        localStorage.setItem(VERFAHRENSSTAND_KEY, o ? "zu" : "auf");
      } catch {
        /* optional */
      }
      return !o;
    });
  };
  const fristen = useCol("fristen");
  const idx = PHASEN.indexOf(akte.phase);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aktivRef = useRef<HTMLLIElement>(null);
  const fertig = akte.phase === "Abgeschlossen";

  useEffect(() => {
    const c = scrollRef.current;
    const el = aktivRef.current;
    if (!c || !el || c.scrollWidth <= c.clientWidth) return;
    c.scrollTo({ left: el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [idx, offen]);

  const setze = async (p: AktenPhase) => {
    if (p === akte.phase) return;
    if (p === "Abgeschlossen") {
      onAbschliessen();
      return;
    }
    const st = useData.getState();
    st.patch("akten", akte.id, { phase: p, status: akte.status === "abgeschlossen" ? "offen" : akte.status, abgeschlossenAm: akte.status === "abgeschlossen" ? undefined : akte.abgeschlossenAm, updatedAt: nowLocal() });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Phase geändert: ${akte.phase} → ${p} – ${akte.aktenzeichen}` });
    const hinweis = p === "Gerichtlich" && !fristen.some((f) => f.akteId === akte.id && f.status === "offen") ? "Tipp: Gerichtliche Fristen jetzt im Reiter „Fristen“ eintragen." : undefined;
    toast(`Phase: ${p}`, { ton: "erfolg", text: hinweis });
  };

  return (
    <div className={cn("rounded-b-[22px] border-t border-[var(--line)] bg-[color-mix(in_oklab,var(--ink-softer)_70%,transparent)] px-2 sm:px-4", offen ? "pb-2 pt-1.5" : "py-1.5")}>
      <div className="flex items-center justify-between gap-3 px-1 sm:px-3">
        <button type="button" onClick={umschalten} aria-expanded={offen} className="flex min-h-11 min-w-0 items-center gap-2 rounded-full pr-2 text-left sm:min-h-9">
          <ChevronDown className={cn("size-4 shrink-0 text-fg-3 transition-transform duration-300", !offen && "-rotate-90")} />
          <span className="eyebrow">Verfahrensstand</span>
          {!offen && (
            <span className="min-w-0 text-[12.5px] font-medium text-fg-2">
              Phase {idx + 1} von {PHASEN.length}: {akte.phase}
            </span>
          )}
        </button>
        {offen && <span className="hidden text-[12.5px] text-fg-3 sm:inline">Zum Ändern auf eine Phase klicken</span>}
      </div>
      {offen && (
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto">
        <div className="relative min-w-[700px] pt-1">
          <div className="pointer-events-none absolute top-[24px] h-[2px] rounded-full bg-[var(--line-strong)]" style={{ left: `${100 / 14}%`, right: `${100 / 14}%` }} aria-hidden>
            <motion.div
              className={cn("h-full rounded-full", fertig ? "bg-green" : "bg-ink")}
              initial={false}
              animate={{ width: `${(idx / (PHASEN.length - 1)) * 100}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
            />
          </div>
        {/* Nur li als direkte Kinder der Liste (Fortschrittslinie liegt außerhalb) */}
        <ol className="relative flex" aria-label={`Verfahrensstand: Phase ${idx + 1} von ${PHASEN.length}, ${akte.phase}`}>
          {PHASEN.map((p, i) => {
            const aktiv = i === idx;
            const erledigt = i < idx || fertig;
            return (
              <li key={p} ref={aktiv ? aktivRef : undefined} className="relative flex-1">
                <button
                  type="button"
                  onClick={() => void setze(p)}
                  aria-current={aktiv ? "step" : undefined}
                  title={aktiv ? `Aktuelle Phase: ${p}` : `Phase auf „${p}“ setzen`}
                  className="group relative flex w-full flex-col items-center gap-1.5 rounded-[14px] px-1 pb-2 pt-2.5"
                >
                  {aktiv && (
                    <motion.span
                      layoutId={`phase-pill-${akte.id}`}
                      transition={{ type: "spring", stiffness: 480, damping: 36 }}
                      className="absolute inset-x-1 inset-y-0 rounded-[14px] bg-[var(--glass-strong)] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_4px_14px_-6px_rgba(20,30,80,0.22),0_0_0_1px_var(--line)]"
                    />
                  )}
                  <span
                    className={cn(
                      "relative grid size-[24px] place-items-center rounded-full transition-all duration-300",
                      aktiv ? (fertig ? "bg-green text-surface" : "bg-ink text-on-ink shadow-[0_0_0_5px_var(--ink-soft)]") : erledigt ? (fertig ? "bg-green text-surface" : "bg-ink text-on-ink") : "bg-[var(--surface)] text-fg-3 shadow-[inset_0_0_0_1.5px_var(--line-strong)] group-hover:shadow-[inset_0_0_0_1.5px_var(--ink)]",
                    )}
                  >
                    {erledigt || (aktiv && fertig) ? <Check className="size-3.5" strokeWidth={3} /> : aktiv ? <span className="size-2 rounded-full bg-on-ink" /> : <span className="num text-[12.5px] font-semibold">{i + 1}</span>}
                  </span>
                  <span className={cn("relative whitespace-nowrap text-[12.5px] font-medium transition-colors", aktiv ? "text-fg" : erledigt ? "text-fg-2" : "text-fg-3 group-hover:text-fg-2")}>{p}</span>
                </button>
              </li>
            );
          })}
        </ol>
        </div>
      </div>
      )}
    </div>
  );
}

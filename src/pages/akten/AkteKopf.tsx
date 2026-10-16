// Kopf der Akte: Aktenzeichen, Titel, Status-Chips, Beteiligte, Aktionen und Phasen-Leiste.
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Archive, CalendarPlus, Check, CircleDot, CircleHelp, Copy, FolderOpen, Globe, Lock, Mail, MoreHorizontal, PauseCircle, PlayCircle, Sparkles } from "lucide-react";
import type { Akte, AktenPhase, Frist } from "@/core/types";
import { istKritisch, zaehltAlsFrist } from "@/core/fristenLage";
import { fmtDate, fmtEUR, nowLocal, today } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast, useUI } from "@/store/ui";
import { Avatar, Button, Card, Chip, IconButton, Menu, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KontaktAvatar, kopiere } from "@/pages/kontakte/kontaktHelfer";
import { DECKUNG_INFO, PHASEN, PRIO_INFO, SACHGEBIET_ICON, STATUS_INFO, SachgebietChip, useKontaktMap, useTeam } from "./helfer";

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

export async function akteAbschliessen(akte: Akte, userId: string) {
  const offen = offeneEintraegeText(offeneEintraege(akte.id, useData.getState().data.fristen));
  const ok = await confirmDialog({
    titel: `Akte ${akte.aktenzeichen} abschließen?`,
    text: offen
      ? `Achtung: Es sind noch ${offen} eingetragen – sie bleiben im Fristenkalender stehen. Die Akte wird archiviert und die Aufbewahrungsfrist der Handakte (§ 50 BRAO, sechs Jahre) vorgemerkt.`
      : "Die Akte wird archiviert und die Aufbewahrungsfrist der Handakte (§ 50 BRAO, sechs Jahre) vorgemerkt. Sie können sie jederzeit wieder öffnen.",
    bestaetigen: "Akte abschließen",
  });
  if (!ok) return false;
  const jahr = schliesseAkteAb(akte, userId);
  toast("Akte abgeschlossen", { ton: "erfolg", text: `Aufbewahrung bis 31.12.${jahr} vorgemerkt (§ 50 BRAO)` });
  return true;
}

export function AkteKopf({ akte, onEmail, onFrist, onKi }: { akte: Akte; onEmail: () => void; onFrist: () => void; onKi: () => void }) {
  const kontakte = useKontaktMap();
  const { byId } = useTeam();
  const { user } = useKanzlei();
  const mandant = kontakte.get(akte.mandantId);
  const gegner = akte.gegnerId ? kontakte.get(akte.gegnerId) : undefined;
  const gegneranwalt = akte.gegneranwaltId ? kontakte.get(akte.gegneranwaltId) : undefined;
  const gericht = akte.gerichtId ? kontakte.get(akte.gerichtId) : undefined;
  const ra = byId.get(akte.bearbeiterId);
  const sb = akte.sachbearbeiterId ? byId.get(akte.sachbearbeiterId) : undefined;
  const Icon = SACHGEBIET_ICON[akte.sachgebiet];

  const setzeStatus = (status: Akte["status"]) => {
    const st = useData.getState();
    st.patch("akten", akte.id, { status, phase: status === "offen" && akte.phase === "Abgeschlossen" ? "Außergerichtlich" : akte.phase, abgeschlossenAm: undefined, updatedAt: nowLocal() });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Status geändert: ${STATUS_INFO[status].label} – ${akte.aktenzeichen}` });
    toast(status === "ruhend" ? "Akte ruht" : "Akte wieder offen", { ton: "erfolg" });
  };
  const portal = () => {
    const an = !akte.mandantenportal;
    useData.getState().patch("akten", akte.id, { mandantenportal: an, updatedAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Mandantenportal ${an ? "freigeschaltet" : "gesperrt"} – ${akte.aktenzeichen}` });
    toast(an ? "Mandantenportal freigeschaltet" : "Mandantenportal gesperrt", { ton: "erfolg", text: an ? `${mandant?.name ?? "Der Mandant"} sieht jetzt den Stand der Sache.` : "Der Mandant hat keinen Zugriff mehr." });
  };

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
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
                className="group mono inline-flex h-8 items-center gap-1.5 rounded-full bg-ink-softer px-3 text-[13.5px] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-ink-soft"
              >
                {akte.aktenzeichen}
                <Copy className="size-3 text-fg-4 transition-colors group-hover:text-ink" />
              </button>
              <span className="text-[12.5px] text-fg-3">angelegt am {fmtDate(akte.createdAt.slice(0, 10))}</span>
            </div>
          </div>
          <div className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
            <Button variant="secondary" icon={<Mail className="size-4" />} onClick={onEmail} className="flex-1 sm:flex-none">
              <span className="sm:hidden">E-Mail</span>
              <span className="hidden sm:inline">E-Mail schreiben</span>
            </Button>
            <Button variant="secondary" icon={<CalendarPlus className="size-4" />} onClick={onFrist} className="flex-1 sm:flex-none">
              <span className="sm:hidden">Frist</span>
              <span className="hidden sm:inline">Frist anlegen</span>
            </Button>
            <Button variant="ai" icon={<Sparkles className="size-4" />} onClick={onKi} className="flex-1 sm:flex-none">
              <span className="sm:hidden">KI-Analyse</span>
              <span className="hidden sm:inline">KI-Fallanalyse</span>
            </Button>
            <Menu
              trigger={({ toggle }) => (
                <IconButton label="Weitere Aktionen" onClick={toggle} className="shadow-[inset_0_0_0_1px_var(--line)]">
                  <MoreHorizontal className="size-[18px]" />
                </IconButton>
              )}
              items={[
                akte.status === "ruhend"
                  ? { label: "Bearbeitung wieder aufnehmen", icon: <PlayCircle />, onClick: () => setzeStatus("offen") }
                  : akte.status === "offen"
                    ? { label: "Akte ruhen lassen", icon: <PauseCircle />, onClick: () => setzeStatus("ruhend"), hint: "Status" }
                    : { label: "Akte wieder öffnen", icon: <FolderOpen />, onClick: () => setzeStatus("offen") },
                ...(akte.status !== "abgeschlossen" ? [{ label: "Akte abschließen …", icon: <Archive />, onClick: () => void akteAbschliessen(akte, user.id) }] : []),
                "sep" as const,
                { label: akte.mandantenportal ? "Mandantenportal sperren" : "Mandantenportal freischalten", icon: akte.mandantenportal ? <Lock /> : <Globe />, onClick: portal },
                { label: "Aktenzeichen kopieren", icon: <Copy />, onClick: () => void kopiere(akte.aktenzeichen, "Aktenzeichen") },
              ]}
            />
          </div>
          <div className="min-w-0 basis-full">
            <div className="flex items-start gap-2">
              <h1 className="title-xl min-w-0 break-words">{akte.titel}</h1>
              {/* Schnellhilfe wie im PageHeader der Bereichsseiten */}
              <IconButton label="Was ist das? Schnellhilfe öffnen" size="sm" onClick={() => useUI.getState().zeigeHilfe("akten")} className="mt-0.5 shrink-0 text-fg-3">
                <CircleHelp className="size-[18px]" />
              </IconButton>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <SachgebietChip sg={akte.sachgebiet} />
              {!(akte.status === "abgeschlossen" && akte.phase === "Abgeschlossen") && (
                <Chip tone="ink" icon={<CircleDot className="size-3" />}>
                  {akte.phase}
                </Chip>
              )}
              {akte.status !== "offen" && (
                <Chip tone={STATUS_INFO[akte.status].tone} dot>
                  {STATUS_INFO[akte.status].label}
                  {akte.abgeschlossenAm ? ` am ${fmtDate(akte.abgeschlossenAm)}` : ""}
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
                <Chip tone="green" icon={<Globe className="size-3" />}>
                  Mandantenportal aktiv
                </Chip>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[var(--line)] pt-5 lg:grid-cols-3 xl:grid-cols-5">
          <Fakt label="Mandant">
            {mandant ? (
              <Link to={`/kontakte?id=${mandant.id}`} title={mandant.name} className="group flex min-w-0 items-center gap-2">
                <KontaktAvatar k={mandant} size={24} />
                <span className="truncate font-medium group-hover:text-ink">{mandant.name}</span>
              </Link>
            ) : (
              "–"
            )}
          </Fakt>
          <Fakt label="Gegner" sub={gegneranwalt ? `vertreten durch ${gegneranwalt.name}` : undefined}>
            {gegner ? (
              <Link to={`/kontakte?id=${gegner.id}`} title={gegner.name} className="truncate font-medium hover:text-ink">
                {gegner.name}
              </Link>
            ) : (
              <span className="text-fg-3">nicht erfasst</span>
            )}
          </Fakt>
          <Fakt label="Gericht" sub={akte.gerichtsAz ? <span className="mono">Az. {akte.gerichtsAz}</span> : undefined}>
            {gericht ? (
              <Link to={`/kontakte?id=${gericht.id}`} title={gericht.name} className="truncate font-medium hover:text-ink">
                {gericht.name}
              </Link>
            ) : (
              <span className="text-fg-3">noch kein Verfahren</span>
            )}
          </Fakt>
          <Fakt label="Gegenstandswert" sub={akte.forderung ? `Hauptforderung ${fmtEUR(akte.forderung.hauptforderung)}` : akte.rsv ? `${akte.rsv.versicherung}` : undefined}>
            <span className="num text-[15px] font-semibold">{akte.gegenstandswert ? fmtEUR(akte.gegenstandswert) : "–"}</span>
          </Fakt>
          <Fakt label="Bearbeitung" sub={sb ? `Sachbearbeitung: ${sb.name}` : undefined} className="col-span-2 lg:col-span-1">
            {ra ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar initialen={ra.initialen} farbe={ra.farbe} size={24} />
                <span className="truncate font-medium">{ra.name}</span>
              </span>
            ) : (
              "–"
            )}
          </Fakt>
        </dl>
      </div>
      <PhasenLeiste akte={akte} />
    </Card>
  );
}

function Fakt({ label, sub, children, className }: { label: string; sub?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="eyebrow !text-[10.5px]">{label}</dt>
      <dd className="mt-1.5 min-w-0 text-[13.5px]">
        <div className="flex min-w-0 items-center">{children}</div>
        {sub && <div className="mt-0.5 truncate text-[12px] text-fg-3">{sub}</div>}
      </dd>
    </div>
  );
}

/** Verfahrensstand als klickbare Schrittfolge mit gleitender Markierung. */
function PhasenLeiste({ akte }: { akte: Akte }) {
  const { user } = useKanzlei();
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
  }, [idx]);

  const setze = async (p: AktenPhase) => {
    if (p === akte.phase) return;
    if (p === "Abgeschlossen") {
      await akteAbschliessen(akte, user.id);
      return;
    }
    const st = useData.getState();
    st.patch("akten", akte.id, { phase: p, status: akte.status === "abgeschlossen" ? "offen" : akte.status, abgeschlossenAm: akte.status === "abgeschlossen" ? undefined : akte.abgeschlossenAm, updatedAt: nowLocal() });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Phase geändert: ${akte.phase} → ${p} – ${akte.aktenzeichen}` });
    const hinweis = p === "Gerichtlich" && !fristen.some((f) => f.akteId === akte.id && f.status === "offen") ? "Tipp: Gerichtliche Fristen jetzt im Reiter „Fristen“ eintragen." : undefined;
    toast(`Phase: ${p}`, { ton: "erfolg", text: hinweis });
  };

  return (
    <div className="rounded-b-[22px] border-t border-[var(--line)] bg-[color-mix(in_oklab,var(--ink-softer)_70%,transparent)] px-2 pb-2 pt-3 sm:px-4">
      <div className="flex items-center justify-between gap-3 px-3">
        <span className="eyebrow !text-[10.5px]">Verfahrensstand</span>
        <span className="hidden text-[11.5px] text-fg-4 sm:inline">Zum Ändern auf eine Phase klicken</span>
      </div>
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto">
        <ol className="relative flex min-w-[700px] pt-1">
          <div className="pointer-events-none absolute top-[24px] h-[2px] rounded-full bg-[var(--line-strong)]" style={{ left: `${100 / 14}%`, right: `${100 / 14}%` }}>
            <motion.div
              className={cn("h-full rounded-full", fertig ? "bg-green" : "bg-ink")}
              initial={false}
              animate={{ width: `${(idx / (PHASEN.length - 1)) * 100}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
            />
          </div>
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
                      aktiv ? (fertig ? "bg-green text-surface" : "bg-ink text-on-ink shadow-[0_0_0_5px_var(--ink-soft)]") : erledigt ? (fertig ? "bg-green text-surface" : "bg-ink text-on-ink") : "bg-[var(--surface)] text-fg-4 shadow-[inset_0_0_0_1.5px_var(--line-strong)] group-hover:shadow-[inset_0_0_0_1.5px_var(--ink)]",
                    )}
                  >
                    {erledigt || (aktiv && fertig) ? <Check className="size-3.5" strokeWidth={3} /> : aktiv ? <span className="size-2 rounded-full bg-on-ink" /> : <span className="num text-[10px] font-semibold">{i + 1}</span>}
                  </span>
                  <span className={cn("relative whitespace-nowrap text-[11.5px] font-medium transition-colors", aktiv ? "text-fg" : erledigt ? "text-fg-2" : "text-fg-3 group-hover:text-fg-2")}>{p}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

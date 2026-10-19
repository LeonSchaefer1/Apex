import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Check, History, Lock, Play, Radio, ShieldCheck, Zap } from "lucide-react";
import type { Aktivitaet, Automation } from "@/core/types";
import { addDays, fmtNum, nowLocal, relTime, toLocalISO, today } from "@/core/dates";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { useMotorStore } from "@/lib/motor";
import { Button, Card, Chip, Drawer, Empty, Switch, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { automationDef, folgeBeimPausieren, folgeWaehrendPause, istFristAutomatik } from "@/core/automationen";
import { automatikSchaltText } from "@/lib/backend/protokoll";
import { darfAutomatikSchalten } from "@/lib/rollen";
import { KATEGORIE_ICON, fmtStd, vorgaengeVon } from "./shared";

/** „Freigabe: …“ – aus der Definition der Automatik (Paket A, A-17). */
/**
 * Weiche Trennstellen in langen Zusammensetzungen („Rechtsschutz­versicherung“) – bei 360 px passt der Titel neben den Schalter,
 * auch wo der Browser kein deutsches Trennwörterbuch hat (I4-T10-01).
 */
const weichGetrennt = (name: string) => name.replace(/(\p{L}{5,})(versicherung|zuordnung|kontrolle|erfassung|abrechnung|anfrage)/gu, "$1\u00AD$2");

export function freigabeVon(key: string): string {
  return automationDef(key)?.freigabe ?? "nach Ihrer Freigabe";
}
/** Was als ein Vorgang zählt, z. B. „je erkannter Frist“. */
export function vorgangVon(key: string): string {
  return automationDef(key)?.vorgang ?? "je Vorgang";
}

/** Zeile „Auslöser: …“ bzw. „Freigabe: …“ – Symbol 14 px in Text 4, Bezeichnung Text 4, Wert Text 2; ohne Fläche. */
function AngabeZeile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[13px] leading-[18px]">
      <span className="mt-0.5 shrink-0 text-fg-4 [&>svg]:size-3.5" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-fg-4">{label}: </span>
        <span className="text-fg-2">{children}</span>
      </span>
    </div>
  );
}

/** Freigabezeile für Karte und Detailansicht. */
function FreigabeZeile({ k }: { k: string }) {
  return (
    <AngabeZeile icon={<ShieldCheck />} label="Freigabe">
      {freigabeVon(k)}
    </AngabeZeile>
  );
}

/**
 * Schaltet eine Automatik um – mit Protokolleintrag (Audit). Die Rückmeldung steht an der Karte selbst (Status mit
 * aria-live), nicht als Meldung über dem Schalter (WCAG 2.4.11).
 */
/** Text am gesperrten Schalter einer Fristautomatik (I3-T10-01). */
export const FRIST_AUTOMATIK_RECHT = "Fristautomatiken schalten Partner und Administration";

/**
 * Schalter einer Automatik (I5-T10-03): fester zugänglicher Name „Automatik „Name““ in Karte und Detail – der Zustand steht nur
 * in aria-checked (und im sichtbaren Zustandstext), nicht im Namen. Fehlende Rechte nennt aria-describedby (sichtbarer Hinweis
 * mit `rechtId`) über die Prop `describedBy` des Basis-Schalters.
 */
function AutomatikSchalter({ a, darf, onChange, rechtId }: { a: Automation; darf: boolean; onChange: (v: boolean) => void; rechtId: string }) {
  return <Switch checked={a.aktiv} disabled={!darf} onChange={onChange} label={`Automatik „${a.name}“`} describedBy={darf ? undefined : rechtId} />;
}

/**
 * Ein- bzw. Ausschalten einer Automatik. Fristautomatiken (Fristerkennung, Vorfristen, eEB) nur mit Recht (Partner,
 * Administration) und vor dem Pausieren mit Rückfrage samt Folge (Fokus auf „Abbrechen“); übrige Automatiken bei einem Klick.
 * Pausieren merkt Zeitpunkt und Person, das Protokoll nennt die Folge; Aktivieren löscht die Pausenangaben.
 */
export function useAutomationUmschalten() {
  const { user } = useKanzlei();
  return async (a: Automation, aktiv: boolean) => {
    if (!darfAutomatikSchalten(user, a.key)) return;
    const frist = istFristAutomatik(a.key);
    if (frist && !aktiv) {
      const ok = await confirmDialog({
        titel: `„${a.name}“ pausieren?`,
        text: `${folgeBeimPausieren(a.key)} Solange die Automatik pausiert ist, weisen Cockpit und Fristen mit Datum, Uhrzeit und Person darauf hin.`,
        bestaetigen: "Pausieren",
        gefahr: true,
      });
      if (!ok) return;
    }
    const st = useData.getState();
    st.patch("automationen", a.id, aktiv ? { aktiv, pausiertAm: undefined, pausiertVon: undefined } : { aktiv, pausiertAm: nowLocal(), pausiertVon: user.id });
    // Einheitlicher Protokolltext mit Person und Folge (wie Server und Demo-Backend): „Automatik „…“ pausiert – durch …. Folge“
    st.log({ akteur: "nutzer", userId: user.id, text: automatikSchaltText(a, aktiv, user.name) });
    if (frist) toast(aktiv ? `„${a.name}“ wieder aktiv` : `„${a.name}“ pausiert`, { text: aktiv ? "Die Fristenkontrolle läuft wieder automatisch." : folgeWaehrendPause(a.key), ton: aktiv ? "erfolg" : "warnung" });
  };
}

/**
 * Kompakter Ablauf: nummerierte Stationen auf einer feinen Linie (DESIGN-SYSTEM.md 10: keine Dauerbewegung). Hover oder Fokus
 * auf einer Station nennt den Schritt; sonst steht „erster Schritt → … → letzter Schritt“ darunter.
 */
export function MiniFlow({ schritte, aktiv }: { schritte: string[]; aktiv: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const k = schritte.length - 1;
  return (
    <div>
      <div className="flex items-center" onMouseLeave={() => setHover(null)}>
        {schritte.map((s, i) => (
          <Fragment key={i}>
            <span
              title={s}
              onMouseEnter={() => setHover(i)}
              className={cn(
                "num relative z-[2] grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-medium transition-colors duration-100",
                hover === i ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]" : aktiv ? "border-[var(--line-strong)] bg-[var(--surface)] text-fg-2" : "border-[var(--line)] bg-[var(--surface)] text-fg-4",
              )}
            >
              {i === k ? <Check className="size-3" strokeWidth={2} /> : i + 1}
            </span>
            {i < k && <span className="mx-1 h-px min-w-2 flex-1 bg-[var(--line-strong)]" aria-hidden />}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 min-h-[18px] text-[13px] leading-[18px] text-fg-3">
        {hover !== null ? (
          <>
            <span className="font-medium text-fg-2">Schritt {hover + 1}:</span> {schritte[hover]}
          </>
        ) : (
          <>
            {schritte[0]} <span className="text-fg-4">→ … →</span> {schritte[k]}
          </>
        )}
      </div>
    </div>
  );
}

/** Jüngste protokollierte Läufe je Automation (Schlüssel → Zeitpunkt) – Grundlage für „Letzter Lauf“ wie im Live-Feed. */
export function letzteLaeufe(aktivitaeten: Aktivitaet[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of aktivitaeten) {
    if (!x.automationKey) continue;
    const cur = m.get(x.automationKey);
    if (!cur || x.zeit > cur) m.set(x.automationKey, x.zeit);
  }
  return m;
}

/** „Letzter Lauf“: der jüngste Zeitpunkt aus Automation und Protokoll – nie in der Zukunft. */
function letzterLaufVon(a: Automation, ausFeed: string | undefined, now: number): string | undefined {
  const jetzt = toLocalISO(new Date(now));
  return [a.letzterLauf, ausFeed].filter((z): z is string => !!z && z <= jetzt).sort().pop();
}

export function AutomationKarte({ a, onOpen, now, ausFeed }: { a: Automation; onOpen: () => void; now: number; ausFeed?: string }) {
  const letzter = letzterLaufVon(a, ausFeed, now);
  const umschalten = useAutomationUmschalten();
  const { user } = useKanzlei();
  const darf = darfAutomatikSchalten(user, a.key);
  return (
    <Card className="group flex h-full flex-col gap-4 transition-[border-color] duration-100 hover:border-[var(--line-strong)]">
      {/* Gesamte Karte öffnet die Details – Schalter liegt darüber */}
      <button type="button" onClick={onOpen} className="absolute inset-0 z-[1] rounded-lg" aria-label={`Details zu „${a.name}“ öffnen`} />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="title-md line-clamp-3 hyphens-auto break-words">{weichGetrennt(a.name)}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip>{a.kategorie}</Chip>
            <span aria-live="polite" className="inline-flex">
              {a.aktiv ? <Chip tone="green">Aktiv</Chip> : <Chip tone="outline">Pausiert – ruht, bis Sie sie einschalten</Chip>}
            </span>
          </div>
        </div>
        <div className="relative z-[2]">
          <AutomatikSchalter a={a} darf={darf} onChange={(v) => void umschalten(a, v)} rechtId={`${a.key}-recht-karte`} />
        </div>
      </div>
      {!darf && (
        <p id={`${a.key}-recht-karte`} className="-mt-2 flex items-center gap-1.5 text-[13px] text-fg-3">
          <Lock className="size-3.5 shrink-0" aria-hidden /> {FRIST_AUTOMATIK_RECHT}
        </p>
      )}

      {/* Das „Was“ vollständig – nicht gekürzt, in Fließtextgröße (I4-T10-01) */}
      <p className="text-[14px] leading-5 text-fg-2">{a.beschreibung}</p>

      <div className="grid gap-1.5">
        <AngabeZeile icon={<Radio />} label="Auslöser">
          {a.ausloeser}
        </AngabeZeile>
        <FreigabeZeile k={a.key} />
      </div>

      <div className="relative z-[2] cursor-pointer" onClick={onOpen}>
        <MiniFlow schritte={a.schritte} aktiv={a.aktiv} />
      </div>

      {/* Kennzahlen untereinander – lange Bezeichnungen („je Mandanteninformation“) überlagern nichts */}
      <dl className="mt-auto grid gap-1.5 border-t border-[var(--line)] pt-4">
        <Kennzahl label={`Ersparnis ${vorgangVon(a.key)}`} wert={`${a.minutenProLauf} Min.`} />
        <Kennzahl label="Vorgänge gesamt" wert={fmtNum(a.laeufe)} />
        <Kennzahl label="Zuletzt" wert={letzter ? relTime(letzter, now) : "–"} />
      </dl>
    </Card>
  );
}

function Kennzahl({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className="min-w-0 break-words text-[13px] leading-[18px] text-fg-3">{label}</dt>
      <dd className="num shrink-0 text-[14px] font-medium text-fg">{wert}</dd>
    </div>
  );
}

const AKTEN_LOS = ["bankabgleich", "zeiterfassung"];

/** Detailansicht einer Automation: Ablauf, Kennzahlen und die letzten Läufe. */
export function AutomationDrawer({ a: aktuell, onClose, aktivitaeten, now }: { a: Automation | null; onClose: () => void; aktivitaeten: Aktivitaet[]; now: number }) {
  // Inhalt während der Schließen-Animation stehen lassen
  const [zuletzt, setZuletzt] = useState<Automation | null>(aktuell);
  useEffect(() => {
    if (aktuell) setZuletzt(aktuell);
  }, [aktuell]);
  const a = aktuell ?? zuletzt;
  const nav = useNavigate();
  const umschalten = useAutomationUmschalten();
  const { user: angemeldet } = useKanzlei();
  const darfDrawer = a ? darfAutomatikSchalten(angemeldet, a.key) : false;
  const [laeuft, setLaeuft] = useState(false);
  const laeufe = useMemo(() => (a ? aktivitaeten.filter((x) => x.automationKey === a.key).slice(0, 14) : []), [a, aktivitaeten]);
  const grenze = addDays(today(), -6);
  const letzte7 = useMemo(() => (a ? aktivitaeten.filter((x) => x.automationKey === a.key && x.zeit.slice(0, 10) >= grenze) : []), [a, aktivitaeten, grenze]);
  const vorgaenge7 = letzte7.reduce((s, x) => s + vorgaengeVon(x), 0);
  const Icon = a ? KATEGORIE_ICON[a.kategorie] : Zap;

  const jetztAusfuehren = () => {
    if (!a) return;
    setLaeuft(true);
    setTimeout(() => {
      const st = useData.getState();
      const cur = st.data.automationen.find((x) => x.id === a.id) ?? a;
      const offene = st.data.akten.filter((x) => x.status === "offen");
      const akte = AKTEN_LOS.includes(a.key) ? undefined : offene[Math.floor(Math.random() * offene.length)];
      const text = `${a.name}: Lauf abgeschlossen${akte ? ` – Akte ${akte.aktenzeichen}` : ""}`;
      st.patch("automationen", a.id, { laeufe: cur.laeufe + 1, letzterLauf: nowLocal() });
      st.log({ akteur: "automation", automationKey: a.key, akteId: akte?.id, text, minutenGespart: a.minutenProLauf });
      useMotorStore.getState().zeige(text, a.minutenProLauf);
      setLaeuft(false);
      toast("Lauf abgeschlossen", { text: `+${a.minutenProLauf} Min. gespart · im Demo-Betrieb simuliert`, ton: "erfolg" });
    }, 1400);
  };

  return (
    <Drawer
      open={!!aktuell}
      onClose={onClose}
      title={a?.name ?? ""}
      subtitle={a ? `${a.kategorie} · ${a.aktiv ? "aktiv" : "pausiert"} · Freigabe: ${freigabeVon(a.key)}` : undefined}
      icon={<Icon className="size-5" />}
      width={560}
      footer={
        a && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
            <Button variant="primary" icon={<Play className="size-4" />} loading={laeuft} disabled={!a.aktiv} onClick={jetztAusfuehren} title={a.aktiv ? "Einen Lauf sofort ausführen" : "Erst aktivieren"}>
              Jetzt ausführen
            </Button>
          </>
        )
      }
    >
      {a && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-fg" aria-live="polite">{a.aktiv ? "Automatik ist aktiv" : "Automatik ist pausiert"}</div>
              <div className="mt-0.5 text-[13px] text-fg-3">{a.aktiv ? `Freigabe: ${freigabeVon(a.key)}.` : "Es werden keine Vorgänge bearbeitet."}</div>
              {!darfDrawer && (
                <div id={`${a.key}-recht-detail`} className="mt-1 flex items-center gap-1.5 text-[13px] text-fg-3">
                  <Lock className="size-3.5 shrink-0" aria-hidden /> {FRIST_AUTOMATIK_RECHT}
                </div>
              )}
            </div>
            <AutomatikSchalter a={a} darf={darfDrawer} onChange={(v) => void umschalten(a, v)} rechtId={`${a.key}-recht-detail`} />
          </div>

          <p className="text-[14px] leading-5 text-fg-2">{a.beschreibung}</p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <MiniStat label={`Min. ${vorgangVon(a.key)}`} wert={`${a.minutenProLauf} Min.`} />
            <MiniStat label="Vorgänge gesamt" wert={fmtNum(a.laeufe)} />
            <MiniStat label="Gesamt gespart" wert={`${fmtStd(a.laeufe * a.minutenProLauf)} Std.`} />
            <MiniStat label="Letzte 7 Tage" wert={`${vorgaenge7} ${vorgaenge7 === 1 ? "Vorgang" : "Vorgänge"}`} />
          </dl>

          <section>
            <h3 className="title-md mb-2">Auslöser und Freigabe</h3>
            <div className="grid gap-1.5">
              <AngabeZeile icon={<Radio />} label="Auslöser">
                {a.ausloeser}
              </AngabeZeile>
              <FreigabeZeile k={a.key} />
            </div>
          </section>

          <section>
            <h3 className="title-md mb-3">Ablauf</h3>
            <ol className="relative">
              {a.schritte.map((s, i) => {
                const letzter = i === a.schritte.length - 1;
                return (
                  <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
                    {!letzter && <span className="absolute left-[11px] top-7 h-[calc(100%-28px)] w-px bg-[var(--line-strong)]" aria-hidden />}
                    <span className="num relative grid size-6 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-pop)] text-[12px] font-medium text-fg-2">
                      {letzter ? <Check className="size-3" strokeWidth={2} /> : i + 1}
                    </span>
                    <span className="pt-0.5 text-[14px] leading-5">{s}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h3 className="title-md mb-2 flex items-center gap-2">
              <History className="size-4 text-fg-4" aria-hidden />
              Zuletzt bearbeitet
            </h3>
            {laeufe.length === 0 ? (
              <Empty icon={<Zap />} title="Noch keine Vorgänge" text="Sobald der Auslöser eintritt, erscheinen die bearbeiteten Vorgänge hier – mit gesparter Zeit." />
            ) : (
              <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)]">
                {laeufe.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={!l.akteId}
                      onClick={() => l.akteId && nav(`/akten/${l.akteId}`)}
                      className="group flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors duration-100 enabled:hover:bg-[var(--surface-pop-hover)] disabled:cursor-default focus-visible:outline-offset-[-2px]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[14px] leading-5">{l.text}</span>
                        <span className="text-[13px] text-fg-4">{relTime(l.zeit, now)}</span>
                      </span>
                      {l.minutenGespart ? <span className="num mt-0.5 shrink-0 text-[13px] text-fg-3">+{l.minutenGespart} Min.</span> : null}
                      {l.akteId && <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-fg-4 transition-colors group-hover:text-fg" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {a.aktiv && <p className="text-[13px] leading-[18px] text-fg-4">„Jetzt ausführen“ wird im Demo-Betrieb simuliert und erscheint wie ein echter Vorgang im Protokoll.</p>}
        </div>
      )}
    </Drawer>
  );
}

function MiniStat({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] leading-[18px] text-fg-3">{label}</dt>
      <dd className="num mt-0.5 truncate text-[15px] font-semibold" title={wert}>
        {wert}
      </dd>
    </div>
  );
}

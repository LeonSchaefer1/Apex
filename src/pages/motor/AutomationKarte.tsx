import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, Clock, History, Play, Radio, Repeat, Timer, Zap } from "lucide-react";
import type { Aktivitaet, Automation } from "@/core/types";
import { addDays, fmtNum, nowLocal, relTime, today } from "@/core/dates";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { useMotorStore } from "@/lib/motor";
import { Button, Card, Chip, Drawer, Empty, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FLOW_SEGMENT_S, KATEGORIE_ICON, fmtStd } from "./shared";

/** Schaltet eine Automation um – mit Rückmeldung und Protokolleintrag (Audit). */
export function useAutomationUmschalten() {
  const { user } = useKanzlei();
  return (a: Automation, aktiv: boolean) => {
    const st = useData.getState();
    st.patch("automationen", a.id, { aktiv });
    st.log({ akteur: "nutzer", userId: user.id, text: `Automation „${a.name}“ ${aktiv ? "aktiviert" : "pausiert"}` });
    toast(aktiv ? "Automation aktiviert" : "Automation pausiert", {
      text: aktiv ? `„${a.name}“ läuft ab sofort im Hintergrund.` : `„${a.name}“ ruht, bis Sie sie wieder einschalten.`,
      ton: aktiv ? "erfolg" : "info",
    });
  };
}

/** Kompakter Ablauf: nummerierte Stationen, zwischen denen ein Lichtpunkt wandert, solange die Automation aktiv ist. */
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
                "num relative z-[2] grid size-6 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold transition-all duration-300 ease-[var(--spring)]",
                aktiv ? "bg-ink-soft text-ink" : "bg-[var(--line)] text-fg-4",
                hover === i && "scale-110 bg-ink text-[var(--on-ink)]",
              )}
            >
              {i === k ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            {i < k && (
              <span className="relative mx-1 h-[2px] min-w-2 flex-1 overflow-hidden rounded-full bg-[var(--line-strong)]">
                {aktiv && (
                  <span className="absolute inset-0" style={{ animation: `aa-flow-${k} ${k * FLOW_SEGMENT_S}s linear ${i * FLOW_SEGMENT_S}s infinite`, opacity: 0 }}>
                    <span className="absolute left-0 top-1/2 h-[4px] w-3 -translate-x-full -translate-y-1/2 rounded-full bg-ink shadow-[0_0_8px_var(--ink)]" />
                  </span>
                )}
              </span>
            )}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 h-[18px] truncate text-[12px] text-fg-3">
        {hover !== null ? (
          <>
            <span className="font-semibold text-fg-2">Schritt {hover + 1}:</span> {schritte[hover]}
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

export function AutomationKarte({ a, onOpen, now }: { a: Automation; onOpen: () => void; now: number }) {
  const umschalten = useAutomationUmschalten();
  const Icon = KATEGORIE_ICON[a.kategorie];
  return (
    <Card className={cn("group flex h-full flex-col gap-4 transition-[transform,box-shadow,opacity] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass", !a.aktiv && "opacity-[0.82]")}>
      {/* Gesamte Karte öffnet die Details – Schalter liegt darüber */}
      <button type="button" onClick={onOpen} className="absolute inset-0 z-[1] rounded-[22px]" aria-label={`Details zu „${a.name}“ öffnen`} />
      <div className="flex items-start gap-3">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-[12px] transition-colors", a.aktiv ? "bg-ink-soft text-ink" : "bg-[var(--line)] text-fg-3")}>
          <Icon className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="title-md line-clamp-2">{a.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip>{a.kategorie}</Chip>
            {a.aktiv ? (
              <Chip tone="green" dot>
                Aktiv
              </Chip>
            ) : (
              <Chip tone="outline">Pausiert</Chip>
            )}
          </div>
        </div>
        <div className="relative z-[2]">
          <Switch checked={a.aktiv} onChange={(v) => umschalten(a, v)} label={`${a.name} ${a.aktiv ? "pausieren" : "aktivieren"}`} />
        </div>
      </div>

      <p className="line-clamp-3 text-[13px] leading-relaxed text-fg-3">{a.beschreibung}</p>

      <div className="flex items-start gap-2 rounded-[12px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px]">
        <Radio className="mt-0.5 size-3.5 shrink-0 text-ink" />
        <span className="min-w-0">
          <span className="text-fg-3">Auslöser: </span>
          <span className="font-medium text-fg-2">{a.ausloeser}</span>
        </span>
      </div>

      <div className="relative z-[2] cursor-pointer" onClick={onOpen}>
        <MiniFlow schritte={a.schritte} aktiv={a.aktiv} />
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3.5">
        <Kennzahl icon={<Timer className="size-3.5" />} label="Pro Lauf" wert={`${a.minutenProLauf} Min.`} />
        <Kennzahl icon={<Repeat className="size-3.5" />} label="Läufe gesamt" wert={fmtNum(a.laeufe)} />
        <Kennzahl icon={<Clock className="size-3.5" />} label="Letzter Lauf" wert={a.letzterLauf ? relTime(a.letzterLauf, now) : "–"} />
      </div>
    </Card>
  );
}

function Kennzahl({ icon, label, wert }: { icon: React.ReactNode; label: string; wert: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] text-fg-4">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="num mt-0.5 truncate text-[13.5px] font-semibold">{wert}</div>
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
  const [laeuft, setLaeuft] = useState(false);
  const laeufe = useMemo(() => (a ? aktivitaeten.filter((x) => x.automationKey === a.key).slice(0, 14) : []), [a, aktivitaeten]);
  const grenze = addDays(today(), -6);
  const dieseWoche = useMemo(() => (a ? aktivitaeten.filter((x) => x.automationKey === a.key && x.zeit.slice(0, 10) >= grenze) : []), [a, aktivitaeten, grenze]);
  const Icon = a ? KATEGORIE_ICON[a.kategorie] : Zap;
  const reduziert = useReducedMotion();

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
      subtitle={a ? `${a.kategorie} · ${a.aktiv ? "läuft automatisch im Hintergrund" : "pausiert"}` : undefined}
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
          <div className="flex items-center justify-between gap-3 rounded-[16px] bg-[var(--ink-softer)] p-3.5">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">{a.aktiv ? "Automation ist aktiv" : "Automation ist pausiert"}</div>
              <div className="text-[12px] text-fg-3">{a.aktiv ? "Sie läuft bei jedem Auslöser selbstständig." : "Es werden keine Läufe ausgeführt."}</div>
            </div>
            <Switch checked={a.aktiv} onChange={(v) => umschalten(a, v)} label={a.aktiv ? "Automation pausieren" : "Automation aktivieren"} />
          </div>

          <p className="text-[14px] leading-relaxed text-fg-2">{a.beschreibung}</p>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MiniStat label="Pro Lauf" wert={`${a.minutenProLauf} Min.`} />
            <MiniStat label="Läufe gesamt" wert={fmtNum(a.laeufe)} />
            <MiniStat label="Gesamt gespart" wert={`${fmtStd(a.laeufe * a.minutenProLauf)} Std.`} />
            <MiniStat label="Diese Woche" wert={`${dieseWoche.length} Läufe`} />
          </div>

          <section>
            <div className="eyebrow mb-2">Auslöser</div>
            <div className="flex items-center gap-2.5 rounded-[14px] border border-[var(--line)] px-3.5 py-3 text-[13.5px]">
              <Radio className="size-4 shrink-0 text-ink" />
              {a.ausloeser}
            </div>
          </section>

          <section>
            <div className="eyebrow mb-3">Ablauf</div>
            <ol className="relative">
              {a.schritte.map((s, i) => {
                const letzter = i === a.schritte.length - 1;
                return (
                  <motion.li
                    key={s}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 460, damping: 34, delay: 0.08 + i * 0.05 }}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {!letzter && (
                      <span className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-[2px] overflow-hidden rounded-full bg-[var(--line-strong)]">
                        {a.aktiv && !reduziert && (
                          <motion.span
                            className="absolute left-0 top-0 h-3 w-full rounded-full bg-ink"
                            animate={{ y: ["-100%", "400%"] }}
                            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: (a.schritte.length - 2) * 1.2, delay: i * 1.2, ease: "easeInOut" }}
                          />
                        )}
                      </span>
                    )}
                    <span className={cn("num relative grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold", letzter ? "bg-green-soft text-green" : "bg-ink-soft text-ink")}>
                      {letzter ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="pt-1 text-[13.5px] leading-snug">{s}</span>
                  </motion.li>
                );
              })}
            </ol>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <History className="size-4 text-fg-3" />
              <span className="eyebrow">Letzte Läufe</span>
            </div>
            {laeufe.length === 0 ? (
              <Empty icon={<Zap className="size-6" />} title="Noch keine Läufe" text="Sobald der Auslöser eintritt, erscheinen die Läufe hier – mit gesparter Zeit." />
            ) : (
              <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[16px] border border-[var(--line)]">
                {laeufe.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={!l.akteId}
                      onClick={() => l.akteId && nav(`/akten/${l.akteId}`)}
                      className="group flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors enabled:hover:bg-[var(--ink-softer)] disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[13px] leading-snug">{l.text}</span>
                        <span className="text-[11.5px] text-fg-4">{relTime(l.zeit, now)}</span>
                      </span>
                      {l.minutenGespart ? (
                        <Chip tone="green" className="num shrink-0">
                          +{l.minutenGespart} Min.
                        </Chip>
                      ) : null}
                      {l.akteId && <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-fg-4 transition-colors group-hover:text-ink" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {a.aktiv && <p className="text-[11.5px] leading-snug text-fg-4">„Jetzt ausführen“ wird im Demo-Betrieb simuliert und erscheint wie ein echter Lauf im Protokoll.</p>}
        </div>
      )}
    </Drawer>
  );
}

function MiniStat({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-[var(--line)] px-3 py-2.5">
      <div className="truncate text-[11px] text-fg-4">{label}</div>
      <div className="num mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em]">{wert}</div>
    </div>
  );
}

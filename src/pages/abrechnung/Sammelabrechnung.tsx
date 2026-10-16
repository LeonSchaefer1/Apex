// Sammelabrechnung: alle abrechenbaren Akten in einem Durchgang abrechnen.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronDown, Clock, Layers, Sparkles, Zap } from "lucide-react";
import { AnimatedNumber, Button, Checkbox, Chip, Modal, Segmented } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { addDays, fmtEUR, round2, today } from "@/core/dates";
import type { Rechnung } from "@/core/types";
import { cn } from "@/lib/cn";
import { erstelleRechnungen } from "./aktionen";
import { FASSUNG_LABEL, fmtSatz, istVorschlag, MINUTEN_JE_EINZELRECHNUNG, STANDARD_STUNDENSATZ, vorschlagFuerAkte, type Ausschluss, type Vorschlag } from "./lib";
import { FORMAT_INFO, useLookups } from "./ui";

/** Akten, die abgerechnet werden können (offen, in den letzten 30 Tagen nicht abgerechnet, mit offenen Gebühren). */
export function useSammelKandidaten() {
  const akten = useCol("akten");
  const rechnungen = useCol("rechnungen");
  const zeiten = useCol("zeiten");
  const fristen = useCol("fristen");
  const dokumente = useCol("dokumente");
  const kontakte = useCol("kontakte");
  const { team, user } = useKanzlei();
  return useMemo(() => {
    const heute = today();
    const grenze = addDays(heute, -30);
    const usersById = new Map(team.map((u) => [u.id, u]));
    const kontaktById = new Map(kontakte.map((k) => [k.id, k]));
    const rProAkte = new Map<string, Rechnung[]>();
    for (const r of rechnungen) rProAkte.set(r.akteId, [...(rProAkte.get(r.akteId) ?? []), r]);
    const gruppe = <T extends { akteId: string }>(xs: T[]) => {
      const m = new Map<string, T[]>();
      for (const x of xs) m.set(x.akteId, [...(m.get(x.akteId) ?? []), x]);
      return m;
    };
    const fProAkte = gruppe(fristen);
    const dProAkte = gruppe(dokumente);
    const zProAkte = gruppe(zeiten);
    const vorschlaege: Vorschlag[] = [];
    const ausgeschlossen: Ausschluss[] = [];
    for (const a of akten) {
      if (a.status !== "offen") continue;
      const rs = rProAkte.get(a.id) ?? [];
      if (rs.some((r) => r.status === "entwurf")) {
        ausgeschlossen.push({ akte: a, grund: "Rechnungsentwurf liegt bereits vor" });
        continue;
      }
      if (rs.some((r) => r.status !== "storniert" && r.datum >= grenze)) {
        ausgeschlossen.push({ akte: a, grund: "In den letzten 30 Tagen abgerechnet" });
        continue;
      }
      const v = vorschlagFuerAkte(a, rs, zProAkte.get(a.id) ?? [], usersById, user.stundensatz ?? STANDARD_STUNDENSATZ, {
        gericht: a.gerichtId ? kontaktById.get(a.gerichtId) : undefined,
        fristen: fProAkte.get(a.id) ?? [],
        dokumente: dProAkte.get(a.id) ?? [],
        heute,
      });
      if (istVorschlag(v)) vorschlaege.push(v);
      else ausgeschlossen.push(v);
    }
    vorschlaege.sort((x, y) => y.summen.brutto - x.summen.brutto);
    return { vorschlaege, ausgeschlossen };
  }, [akten, rechnungen, zeiten, fristen, dokumente, kontakte, team, user.stundensatz]);
}

const FORMATE: Rechnung["format"][] = ["PDF", "XRechnung", "ZUGFeRD"];

export function Sammelabrechnung({ open, onClose, onAnsehen }: { open: boolean; onClose: () => void; onAnsehen: (rechnungId?: string) => void }) {
  const { vorschlaege, ausgeschlossen } = useSammelKandidaten();
  const { kontakte, akten } = useLookups();
  const { user } = useKanzlei();
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Rechnung["format"]>("PDF");
  const [erstellt, setErstellt] = useState<Rechnung[] | null>(null);
  const [zeigeAusgeschlossen, setZeigeAusgeschlossen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErstellt(null);
    setLaeuft(false);
    setZeigeAusgeschlossen(false);
    setAuswahl(new Set(vorschlaege.map((v) => v.akte.id)));
    // nur beim Öffnen vorbelegen
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const gewaehlt = vorschlaege.filter((v) => auswahl.has(v.akte.id));
  const summe = round2(gewaehlt.reduce((s, v) => s + v.summen.brutto, 0));
  const alle = vorschlaege.length > 0 && gewaehlt.length === vorschlaege.length;
  const toggle = (id: string) =>
    setAuswahl((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const erstellen = () => {
    if (!gewaehlt.length) return;
    setLaeuft(true);
    setTimeout(() => {
      // XRechnung ist reines XML – Privatpersonen erhalten sie nicht (B2C), sondern die PDF-Rechnung.
      const rs = erstelleRechnungen(
        gewaehlt.map((v) => ({
          akte: v.akte,
          positionen: v.positionen,
          summen: v.summen,
          zeitIds: v.zeitIds,
          vorschuss: v.vorschuss,
          format: format === "XRechnung" && kontakte.get(v.akte.mandantId)?.typ === "person" ? ("PDF" as const) : format,
        })),
        format,
        "gestellt",
        user.id,
      );
      const gesamt = round2(rs.reduce((s, r) => s + r.brutto, 0));
      const vorschuesse = rs.filter((r) => r.art === "vorschuss").length;
      useData.getState().log({
        akteur: "automation",
        userId: user.id,
        text: `Sammelabrechnung: ${rs.length} ${rs.length === 1 ? "Rechnung" : "Rechnungen"} in einem Durchgang erstellt${vorschuesse ? `, davon ${vorschuesse} ${vorschuesse === 1 ? "Vorschussrechnung" : "Vorschussrechnungen"} (§ 9 RVG)` : ""} (${format}, gesamt ${fmtEUR(gesamt)})`,
        minutenGespart: rs.length * MINUTEN_JE_EINZELRECHNUNG,
      });
      setErstellt(rs);
      setLaeuft(false);
    }, 650);
  };

  const gespart = (erstellt?.length ?? gewaehlt.length) * MINUTEN_JE_EINZELRECHNUNG;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<Layers className="size-[18px]" />}
      title={erstellt ? "Sammelabrechnung abgeschlossen" : "Sammelabrechnung"}
      subtitle={
        erstellt
          ? "Alle Rechnungen sind gestellt, im Aktenkonto gebucht und in der E-Akte abgelegt."
          : "Alle abrechenbaren Akten in einem Durchgang abrechnen – statt jede Rechnung einzeln zu erstellen."
      }
      footer={
        erstellt ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Fertig
            </Button>
            <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => onAnsehen()}>
              Rechnungen ansehen
            </Button>
          </>
        ) : (
          <>
            <div className="mr-auto min-w-0 text-[12.5px] text-fg-3">
              Summe der Auswahl <AnimatedNumber value={summe} format={(n) => fmtEUR(n)} className="ml-1 text-[15px] font-semibold text-fg" />
            </div>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={<Zap className="size-4" />} disabled={!gewaehlt.length} loading={laeuft} onClick={erstellen}>
              {gewaehlt.length} {gewaehlt.length === 1 ? "Rechnung" : "Rechnungen"} erstellen
            </Button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {erstellt ? (
          <motion.div key="fertig" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
            <div className="flex flex-col items-center py-4 text-center">
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 480, damping: 22 }}
                className="grid size-16 place-items-center rounded-full bg-green-soft text-green"
              >
                <Check className="size-8" strokeWidth={2.6} />
              </motion.div>
              <div className="mt-4 text-[26px] font-semibold tracking-[-0.03em]">
                <AnimatedNumber value={erstellt.length} /> {erstellt.length === 1 ? "Rechnung" : "Rechnungen"} erstellt
              </div>
              <div className="mt-1 text-[13px] text-fg-3">
                Gesamt <AnimatedNumber value={round2(erstellt.reduce((s, r) => s + r.brutto, 0))} format={(n) => fmtEUR(n)} className="font-semibold text-fg" /> brutto · Format {format}
                {erstellt.some((r) => r.format !== format) && ` · ${erstellt.filter((r) => r.format !== format).length} an Privatpersonen als PDF`}
              </div>
              <Chip tone="green" icon={<Clock className="size-3.5" />} className="mt-3">
                ≈ {gespart} Min. gegenüber Einzelabrechnung gespart
              </Chip>
            </div>
            <ul className="mt-2 divide-y divide-[var(--line)] overflow-hidden rounded-[18px] border border-[var(--line)]">
              {erstellt.map((r, i) => {
                const akte = akten.get(r.akteId);
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + Math.min(i, 10) * 0.06, type: "spring", stiffness: 460, damping: 34 }}
                  >
                    <button type="button" onClick={() => onAnsehen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-softer">
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.25 + Math.min(i, 10) * 0.06, type: "spring", stiffness: 600, damping: 20 }}
                        className="grid size-6 shrink-0 place-items-center rounded-full bg-green text-white"
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </motion.span>
                      <span className="mono w-[108px] shrink-0 text-[12.5px] font-medium">{r.nummer}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        <span className="mono mr-2 text-[12px] text-fg-3">{akte?.aktenzeichen}</span>
                        {akte?.titel}
                      </span>
                      <span className="num shrink-0 text-[13px] font-semibold">{fmtEUR(r.brutto)}</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.div key="auswahl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
            {/* Engpass sichtbar machen */}
            <div className="grid gap-2 rounded-[20px] bg-ink-softer p-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-[16px] px-4 py-3">
                <div className="eyebrow">Einzeln abrechnen</div>
                <div className="mt-1 text-[14px] text-fg-2">
                  <span className="num font-semibold text-fg">{vorschlaege.length}</span> Durchgänge · ≈ <span className="num">{vorschlaege.length * MINUTEN_JE_EINZELRECHNUNG}</span> Min.
                </div>
              </div>
              <ArrowRight className="mx-auto hidden size-5 text-fg-4 sm:block" />
              <div className="glass-thin rounded-[16px] px-4 py-3">
                <div className="eyebrow flex items-center gap-1.5 !text-ink">
                  <Sparkles className="size-3" /> Sammelabrechnung
                </div>
                <div className="mt-1 text-[14px] text-fg-2">
                  <span className="font-semibold text-fg">1 Durchgang</span> · unter einer Minute
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-[12px] font-semibold text-fg-3">Format</span>
              <Segmented size="sm" options={FORMATE.map((f) => ({ value: f, label: f }))} value={format} onChange={setFormat} />
              <span className="min-w-0 basis-full text-[12px] text-fg-3 sm:basis-auto sm:flex-1">{FORMAT_INFO[format].text}
                {format === "XRechnung" && " Privatmandanten erhalten die Rechnung als PDF."}
              </span>
            </div>

            {vorschlaege.length === 0 ? (
              <div className="mt-6 rounded-[18px] border border-dashed border-[var(--line-strong)] px-6 py-10 text-center">
                <div className="title-md">Alles abgerechnet</div>
                <p className="mt-1 text-[13px] text-fg-3">Für keine offene Akte stehen derzeit Gebühren zur Abrechnung an.</p>
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-[18px] border border-[var(--line)]">
                <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-[12px] font-semibold text-fg-3">
                  <Checkbox
                    checked={alle}
                    indeterminate={!alle && gewaehlt.length > 0}
                    onChange={() => setAuswahl(alle ? new Set() : new Set(vorschlaege.map((v) => v.akte.id)))}
                    label="Alle auswählen"
                  />
                  <span className="flex-1">
                    {gewaehlt.length} von {vorschlaege.length} Akten ausgewählt
                  </span>
                  <span className="hidden sm:inline">Vorschau brutto</span>
                </div>
                <ul className="max-h-[46dvh] divide-y divide-[var(--line)] overflow-y-auto">
                  {vorschlaege.map((v, i) => {
                    const an = auswahl.has(v.akte.id);
                    const mandant = kontakte.get(v.akte.mandantId);
                    return (
                      <motion.li
                        key={v.akte.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.03 }}
                        className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors", an ? "bg-transparent" : "opacity-55", "hover:bg-ink-softer")}
                        onClick={() => toggle(v.akte.id)}
                      >
                        <div className="pt-0.5">
                          <Checkbox checked={an} onChange={() => toggle(v.akte.id)} label={`Akte ${v.akte.aktenzeichen} auswählen`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="mono shrink-0 text-[12px] text-fg-3">{v.akte.aktenzeichen}</span>
                            <span className="truncate text-[13.5px] font-medium">{v.akte.titel}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Chip tone="outline">{v.akte.phase}</Chip>
                            {v.vorschuss && (
                              <Chip tone="violet" title="Vergütung im laufenden Verfahren noch nicht fällig (§ 8 Abs. 1 RVG) – Vorschuss nach § 9 RVG">
                                Vorschuss § 9
                              </Chip>
                            )}
                            {v.positionen
                              .filter((p) => p.vv !== "7002")
                              .map((p, pi) => (
                                <Chip key={`${p.vv}-${pi}`} tone={p.betrag < 0 ? "amber" : "ink"} title={p.bezeichnung}>
                                  <span className="mono">{p.vv === "Std" ? `${fmtSatz(p.menge ?? 0)} Std.` : p.vv}</span>
                                  {p.satz !== undefined && p.vv !== "Std" && <span className="opacity-70">{fmtSatz(Math.abs(p.satz))}</span>}
                                </Chip>
                              ))}
                            {v.fassung && <span className="text-[11px] text-fg-4">RVG · {FASSUNG_LABEL[v.fassung]}</span>}
                            {v.hinweis && <span className="text-[11px] text-fg-4">· {v.hinweis}</span>}
                          </div>
                          <div className="mt-1 truncate text-[11.5px] text-fg-4">an {mandant?.name ?? "Mandant"}</div>
                        </div>
                        <div className="num shrink-0 pt-0.5 text-right text-[13.5px] font-semibold">{fmtEUR(v.summen.brutto)}</div>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            )}

            {ausgeschlossen.length > 0 && (
              <div className="mt-4">
                <button type="button" onClick={() => setZeigeAusgeschlossen((x) => !x)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3 hover:text-fg">
                  <ChevronDown className={cn("size-4 transition-transform duration-300", zeigeAusgeschlossen && "rotate-180")} />
                  Nicht berücksichtigt ({ausgeschlossen.length}) – nur entstandene, noch nicht berechnete Gebühren (§ 15 Abs. 2 RVG)
                </button>
                <AnimatePresence initial={false}>
                  {zeigeAusgeschlossen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 38 }}
                      className="overflow-hidden"
                    >
                      {ausgeschlossen.map((a) => (
                        <li key={a.akte.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 py-1 text-[12.5px] first:pt-2">
                          <span className="mono shrink-0 text-fg-3">{a.akte.aktenzeichen}</span>
                          <span className="min-w-0 flex-1 truncate">{a.akte.titel}</span>
                          <span className="min-w-0 basis-full text-[12px] text-fg-4 sm:basis-auto sm:max-w-[62%] sm:truncate sm:text-right" title={a.grund}>
                            {a.grund}
                          </span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

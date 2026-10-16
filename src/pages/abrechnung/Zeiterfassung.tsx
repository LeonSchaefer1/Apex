// Reiter „Zeiterfassung“: Zeiten je Akte erfassen (Formular oder Stoppuhr) und nach Stundensatz abrechnen.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Clock, FilePlus2, FileSignature, Hourglass, PenLine, Play, Plus, Square, Timer, Wallet } from "lucide-react";
import { AnimatedNumber, Avatar, Button, Card, CardHeader, Chip, Empty, Field, Input, Segmented, Select, Stat, Switch } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { addDays, fmtDate, fmtDateShort, fmtDateWd, fmtEUR, relDays, round2, today, uid } from "@/core/dates";
import type { Zeiteintrag } from "@/core/types";
import { cn } from "@/lib/cn";
import { erstelleRechnungen } from "./aktionen";
import { fmtDauer, fmtStunden, hatVerguetungsvereinbarung, isoWoche, parseBetrag, satzFuerAbrechnung, satzFuerEintrag, STANDARD_STUNDENSATZ, stundenPositionen, summen, wertEintrag, type TabKey } from "./lib";
import { useAbrechnungUI } from "./store";
import { TabKopf, useLookups } from "./ui";

const TAETIGKEITEN = [
  "Telefonat mit Mandant",
  "Aktenstudium",
  "Entwurf Schriftsatz",
  "Recherche Rechtsprechung",
  "Besprechung",
  "Korrespondenz Gegenseite",
  "Terminvorbereitung",
  "Wahrnehmung Gerichtstermin",
];
const SCHNELL_MIN = [6, 15, 30, 60];

function Uhr({ start }: { start: number }) {
  const [jetzt, setJetzt] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const s = Math.max(0, Math.floor((jetzt - start) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return <span className="mono num">{`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`}</span>;
}

export function ZeiterfassungTab({ onTab }: { onTab: (t: TabKey) => void }) {
  const zeiten = useCol("zeiten");
  const aktenArr = useCol("akten");
  const dokumente = useCol("dokumente");
  const { akten, users } = useLookups();
  const { user } = useKanzlei();
  const { timerStart, timerAkteId, starteTimer, stoppeTimer, oeffneRechnung } = useAbrechnungUI();
  const offeneAkten = useMemo(() => aktenArr.filter((a) => a.status === "offen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [aktenArr]);

  const [akteId, setAkteId] = useState("");
  const [minuten, setMinuten] = useState("30");
  const [taetigkeit, setTaetigkeit] = useState("");
  const [datum, setDatum] = useState(today());
  const [abrechenbar, setAbrechenbar] = useState(true);
  const [wer, setWer] = useState<"alle" | "meine">("alle");
  const [abrAkte, setAbrAkte] = useState("");

  const satzVon = (userId: string) => users.get(userId)?.stundensatz ?? STANDARD_STUNDENSATZ;
  // Wert einer Zeit: vereinbarter Stundensatz der Akte (§ 3a RVG) vor dem Satz der Person, die die Zeit erfasst hat –
  // dieselbe Funktion wie in der Abrechnungsvorschau, der Rechnung und dem Tätigkeitsnachweis (nie der Satz der angemeldeten Person).
  const wert = (z: Zeiteintrag) => wertEintrag(z, akten.get(z.akteId), users);

  const heute = today();
  const wocheJetzt = isoWoche(heute).montag;
  const sichtbar = useMemo(() => zeiten.filter((z) => wer === "alle" || z.userId === user.id), [zeiten, wer, user.id]);

  const kpi = useMemo(() => {
    const woche = sichtbar.filter((z) => z.datum >= wocheJetzt && z.datum <= addDays(wocheJetzt, 6));
    const offen = sichtbar.filter((z) => z.abrechenbar && !z.abgerechnet);
    return {
      woche: woche.reduce((s, z) => s + z.minuten, 0),
      wocheAbr: woche.filter((z) => z.abrechenbar).reduce((s, z) => s + z.minuten, 0),
      offenWert: round2(offen.reduce((s, z) => s + wert(z), 0)),
      offenMin: offen.reduce((s, z) => s + z.minuten, 0),
    };
  }, [sichtbar, wocheJetzt]); // eslint-disable-line react-hooks/exhaustive-deps

  const wochen = useMemo(() => {
    const m = new Map<string, { kw: number; montag: string; tage: Map<string, Zeiteintrag[]> }>();
    for (const z of [...sichtbar].sort((a, b) => b.datum.localeCompare(a.datum))) {
      const w = isoWoche(z.datum);
      const e = m.get(w.montag) ?? { kw: w.kw, montag: w.montag, tage: new Map() };
      e.tage.set(z.datum, [...(e.tage.get(z.datum) ?? []), z]);
      m.set(w.montag, e);
    }
    return [...m.values()].sort((a, b) => b.montag.localeCompare(a.montag));
  }, [sichtbar]);

  const abrechenbareAkten = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of zeiten) if (z.abrechenbar && !z.abgerechnet) m.set(z.akteId, (m.get(z.akteId) ?? 0) + z.minuten);
    return [...m.entries()]
      .map(([id, min]) => ({ akte: akten.get(id), min }))
      .filter((x) => x.akte)
      .sort((a, b) => b.min - a.min);
  }, [zeiten, akten]);
  const abrAkteObj = akten.get(abrAkte || abrechenbareAkten[0]?.akte?.id || "");
  const offeneEintraege = abrAkteObj ? zeiten.filter((z) => z.akteId === abrAkteObj.id && z.abrechenbar && !z.abgerechnet).sort((a, b) => a.datum.localeCompare(b.datum)) : [];
  // Einzelauswahl: standardmäßig alle offenen Einträge; abgewählte bleiben offen und können später abgerechnet werden.
  const [abgewaehlt, setAbgewaehlt] = useState<Set<string>>(new Set());
  useEffect(() => setAbgewaehlt(new Set()), [abrAkteObj?.id]);
  const abrEintraege = offeneEintraege.filter((z) => !abgewaehlt.has(z.id));
  const umschaltenAuswahl = (id: string) =>
    setAbgewaehlt((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  const vv = abrAkteObj?.verguetungsvereinbarung;
  // Stundensatz dieser Abrechnung: vorbelegt mit dem vereinbarten Satz, sichtbar und je Abrechnung überschreibbar
  const [satzEingabe, setSatzEingabe] = useState("");
  useEffect(() => {
    setSatzEingabe(vv?.stundensatz ? String(vv.stundensatz).replace(".", ",") : "");
  }, [abrAkteObj?.id, vv?.stundensatz]);
  const eingabeSatz = satzEingabe.trim() ? parseBetrag(satzEingabe) : undefined;
  // Quelle des Satzes dieser Abrechnung (für Hinweise); die Beträge rechnet stundenPositionen je Eintrag mit satzFuerEintrag.
  const satzWahl = satzFuerAbrechnung(abrAkteObj, eingabeSatz, STANDARD_STUNDENSATZ);
  const abrPositionen = stundenPositionen(abrEintraege, abrAkteObj, users, { abrechnungsSatz: eingabeSatz });
  const abrSummen = summen(abrPositionen);
  // Abrechnung nach Zeit nur mit Vergütungsvereinbarung in Textform (§ 3a Abs. 1 RVG) – sonst gelten die gesetzlichen Gebühren.
  const abrVereinbarung = abrAkteObj ? hatVerguetungsvereinbarung(abrAkteObj, dokumente) : false;
  // Vergütungsvereinbarung erfassen: Datum und vereinbarter Stundensatz (netto) sind Pflichtangaben
  const [vvForm, setVvForm] = useState<{ datum: string; satz: string } | null>(null);
  useEffect(() => setVvForm(null), [abrAkteObj?.id]);
  const vvSpeichern = () => {
    if (!abrAkteObj || !vvForm) return;
    const satz = parseBetrag(vvForm.satz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vvForm.datum)) return toast("Bitte das Datum der Vereinbarung angeben", { text: "Pflichtangabe – Textform nach § 3a Abs. 1 RVG.", ton: "warnung" });
    if (!(satz > 0)) return toast("Bitte den vereinbarten Stundensatz angeben", { text: "Netto in Euro, z. B. 240", ton: "warnung" });
    const vorher = abrAkteObj.verguetungsvereinbarung;
    useData.getState().patch("akten", abrAkteObj.id, { verguetungsvereinbarung: { datum: vvForm.datum, stundensatz: satz, erfasstVon: user.id } });
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: abrAkteObj.id,
      text: `Vergütungsvereinbarung (§ 3a RVG) ${vorher ? "geändert" : "erfasst"}: vom ${fmtDate(vvForm.datum)}, ${fmtEUR(satz)}/Std. netto${vorher?.stundensatz && vorher.stundensatz !== satz ? ` (vorher ${fmtEUR(vorher.stundensatz)}/Std.)` : ""} – ${abrAkteObj.aktenzeichen}`,
    });
    setVvForm(null);
    toast("Vergütungsvereinbarung gespeichert", { text: `${abrAkteObj.aktenzeichen} · ${fmtEUR(satz)}/Std. netto`, ton: "erfolg" });
  };
  const vvEntfernen = () => {
    if (!abrAkteObj) return;
    useData.getState().patch("akten", abrAkteObj.id, { verguetungsvereinbarung: undefined });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: abrAkteObj.id, text: `Vergütungsvereinbarung (§ 3a RVG) entfernt – ${abrAkteObj.aktenzeichen}` });
  };
  const erfassenAkte = akteId ? akten.get(akteId) : undefined;

  const erfassen = () => {
    const min = Math.round(Number(minuten.replace(",", ".")));
    if (!akteId) return toast("Bitte eine Akte wählen", { text: "Jede Zeit gehört zu einer Akte.", ton: "warnung" });
    if (!min || min <= 0) return toast("Bitte die Dauer in Minuten angeben", { ton: "warnung" });
    if (!taetigkeit.trim()) return toast("Bitte die Tätigkeit beschreiben", { text: "z. B. „Telefonat mit Mandant“", ton: "warnung" });
    const z: Zeiteintrag = { id: uid("z"), akteId, userId: user.id, datum: datum || heute, minuten: min, taetigkeit: taetigkeit.trim(), abrechenbar };
    useData.getState().upsert("zeiten", z);
    toast("Zeit erfasst", { text: `${fmtDauer(min)} · ${akten.get(akteId)?.aktenzeichen ?? ""} · ${z.taetigkeit}`, ton: "erfolg" });
    setTaetigkeit("");
  };

  const timerUmschalten = () => {
    if (timerStart) {
      const min = stoppeTimer();
      // Nur eine Akte dieser Kanzlei übernehmen (Mandantentrennung).
      if (timerAkteId && akten.has(timerAkteId)) setAkteId(timerAkteId);
      setMinuten(String(min));
      setDatum(heute);
      toast("Stoppuhr angehalten", { text: `${min} Min. übernommen – Tätigkeit ergänzen und erfassen`, ton: "info" });
    } else {
      starteTimer(akteId);
      toast("Stoppuhr läuft", { text: akteId ? `Akte ${akten.get(akteId)?.aktenzeichen}` : "Die Akte können Sie beim Erfassen wählen", ton: "info" });
    }
  };

  const abrechnen = () => {
    if (!abrAkteObj || !abrEintraege.length || !abrVereinbarung) return;
    const offenBleiben = offeneEintraege.length - abrEintraege.length;
    const [r] = erstelleRechnungen([{ akte: abrAkteObj, positionen: abrPositionen, summen: abrSummen, zeitIds: abrEintraege.map((z) => z.id) }], "auto", "entwurf", user.id);
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: abrAkteObj.id,
      text: `Rechnungsentwurf aus ${fmtStunden(abrEintraege.reduce((s, z) => s + z.minuten, 0))} Std. (${abrEintraege.length} ${abrEintraege.length === 1 ? "Eintrag" : "Einträge"}) erstellt (${r.nummer}) ${satzWahl.quelle === "person" ? "zum Satz der jeweiligen Person (kein vereinbarter Stundensatz hinterlegt)" : `zu ${fmtEUR(satzWahl.satz)}/Std.${satzWahl.quelle === "vereinbarung" ? " lt. Vergütungsvereinbarung" : " (abweichend für diese Abrechnung)"}`}${offenBleiben ? ` – ${offenBleiben} ${offenBleiben === 1 ? "Eintrag bleibt" : "Einträge bleiben"} offen` : ""} – ${abrAkteObj.aktenzeichen}`,
    });
    setAbrAkte("");
    toast("Rechnungsentwurf aus Zeiten erstellt", {
      text: `${r.nummer} · ${fmtEUR(r.brutto)}${offenBleiben ? ` · ${offenBleiben} ${offenBleiben === 1 ? "Eintrag bleibt" : "Einträge bleiben"} offen` : ""}`,
      ton: "erfolg",
      aktion: {
        label: "Ansehen",
        onClick: () => {
          onTab("rechnungen");
          oeffneRechnung(r.id);
        },
      },
    });
  };

  return (
    <>
      <TabKopf
        icon={<Timer className="size-[18px]" />}
        titel="Zeiterfassung"
        text="Zeiten je Akte erfassen – per Formular oder Stoppuhr – und mit dem Stundensatz der Vergütungsvereinbarung abrechnen."
        aktionen={
          <Segmented
            size="sm"
            options={[
              { value: "alle", label: "Ganzes Team" },
              { value: "meine", label: "Nur meine" },
            ]}
            value={wer}
            onChange={setWer}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
        <Stat
          label="Diese Woche"
          icon={<Clock className="size-4" />}
          tone="ink"
          value={<span className="num text-[20px] sm:text-[28px]">{fmtDauer(kpi.woche)}</span>}
          sub={`KW ${isoWoche(heute).kw} · ${wer === "meine" ? "Ihre Zeiten" : "ganzes Team"}`}
        />
        <Stat
          label="Abrechenbar"
          icon={<Hourglass className="size-4" />}
          tone="green"
          value={<span className="num text-[20px] sm:text-[28px]">{fmtDauer(kpi.wocheAbr)}</span>}
          sub={kpi.woche ? `${Math.round((kpi.wocheAbr / kpi.woche) * 100)} % Quote` : "noch keine Zeiten"}
        />
        <Stat
          label="Noch nicht abgerechnet"
          icon={<Wallet className="size-4" />}
          tone="amber"
          value={<AnimatedNumber value={kpi.offenWert} format={(n) => fmtEUR(n, { cents: false })} className="text-[20px] sm:text-[28px]" />}
          sub={`${fmtDauer(kpi.offenMin)} abrechenbar, noch offen`}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="order-2 grid grid-cols-1 min-w-0 gap-4 xl:order-1">
          {wochen.length === 0 && (
            <Card>
              <Empty icon={<Timer className="size-6" />} title="Noch keine Zeiten" text="Erfassen Sie Ihre erste Zeit über das Formular oder starten Sie die Stoppuhr." />
            </Card>
          )}
          {wochen.map((w, wi) => {
            const alle = [...w.tage.values()].flat();
            const gesamt = alle.reduce((s, z) => s + z.minuten, 0);
            const abr = alle.filter((z) => z.abrechenbar);
            const abrMin = abr.reduce((s, z) => s + z.minuten, 0);
            const abrWert = round2(abr.reduce((s, z) => s + wert(z), 0));
            return (
              <motion.div key={w.montag} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(wi, 6) * 0.05 }}>
                <Card padded={false} className="overflow-hidden">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="title-md">KW {w.kw}</span>
                      <span className="text-[12.5px] text-fg-3">
                        {fmtDateShort(w.montag)} – {fmtDateShort(addDays(w.montag, 6))}
                        {w.montag === wocheJetzt && " · diese Woche"}
                      </span>
                    </div>
                    <div className="ml-auto flex flex-wrap gap-x-4 text-[12.5px] text-fg-3">
                      <span>
                        <span className="num font-semibold text-fg">{fmtDauer(gesamt)}</span> gesamt
                      </span>
                      <span>
                        <span className="num font-semibold text-green">{fmtDauer(abrMin)}</span> abrechenbar
                      </span>
                      <span>
                        Wert <span className="num font-semibold text-fg">{fmtEUR(abrWert, { cents: false })}</span>
                      </span>
                    </div>
                  </div>
                  {[...w.tage.entries()].map(([tag, eintraege]) => (
                    <div key={tag}>
                      <div className="flex items-center justify-between px-4 pb-1 pt-3">
                        <span className="eyebrow">
                          {fmtDateWd(tag)}
                          {(tag === heute || tag === addDays(heute, -1)) && ` · ${relDays(tag, heute)}`}
                        </span>
                        <span className="num text-[12.5px] text-fg-3">{fmtDauer(eintraege.reduce((s, z) => s + z.minuten, 0))}</span>
                      </div>
                      <ul className="pb-1">
                        <AnimatePresence initial={false}>
                          {eintraege.map((z) => {
                            const u = users.get(z.userId);
                            const a = akten.get(z.akteId);
                            const status = z.abgerechnet ? (
                              <Chip tone="ink">abgerechnet</Chip>
                            ) : (
                              <button
                                type="button"
                                onClick={() => useData.getState().patch("zeiten", z.id, { abrechenbar: !z.abrechenbar })}
                                title="Abrechenbarkeit umschalten"
                                className="rounded-full"
                              >
                                <Chip tone={z.abrechenbar ? "green" : "neutral"} dot>
                                  {z.abrechenbar ? "abrechenbar" : "nicht abrechenbar"}
                                </Chip>
                              </button>
                            );
                            return (
                              <motion.li key={z.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-ink-softer">
                                  <Avatar initialen={u?.initialen ?? "?"} farbe={u?.farbe} size={30} title={u?.name} />
                                  <div className="min-w-0 flex-1">
                                    <div className="break-words text-[13.5px] font-medium">{z.taetigkeit}</div>
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12.5px] text-fg-3">
                                      <span className="mono shrink-0">{a?.aktenzeichen}</span>
                                      <span className="min-w-0">{a?.titel}</span>
                                      <span className="hidden shrink-0 sm:inline">· {u?.name}</span>
                                    </div>
                                    <div className="mt-1 sm:hidden">{status}</div>
                                  </div>
                                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{status}</div>
                                  <div className="w-[76px] shrink-0 text-right">
                                    <div className="num text-[13.5px] font-semibold">{fmtDauer(z.minuten)}</div>
                                    <div className={cn("num text-[12.5px]", z.abrechenbar ? "text-fg-3" : "text-fg-3 line-through")}>{fmtEUR(wert(z), { cents: false })}</div>
                                  </div>
                                </div>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </ul>
                    </div>
                  ))}
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="order-1 grid grid-cols-1 gap-4 xl:order-2">
          <Card className={cn("overflow-hidden", timerStart && "ai-ring")}>
            <CardHeader icon={<Plus className="size-4" />} title="Zeit erfassen" subtitle="Dauer eintragen oder die Stoppuhr mitlaufen lassen." />
            <div className="mb-4 flex items-center gap-3 rounded-[18px] bg-ink-softer px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-fg-3">
                  {timerStart ? (
                    <>
                      <motion.span className="size-2 rounded-full bg-seal" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
                      Stoppuhr läuft{timerAkteId && akten.get(timerAkteId) ? ` · ${akten.get(timerAkteId)!.aktenzeichen}` : ""}
                    </>
                  ) : (
                    "Stoppuhr"
                  )}
                </div>
                <div className={cn("mt-0.5 text-[26px] font-semibold tracking-[-0.02em]", !timerStart && "text-fg-3")}>
                  {timerStart ? <Uhr start={timerStart} /> : <span className="mono num">00:00:00</span>}
                </div>
              </div>
              <Button variant={timerStart ? "danger" : "secondary"} icon={timerStart ? <Square className="size-4" /> : <Play className="size-4" />} onClick={timerUmschalten}>
                {timerStart ? "Stoppen" : "Starten"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Akte" htmlFor="ze-akte">
                <Select id="ze-akte" value={akteId} onChange={(e) => setAkteId(e.target.value)}>
                  <option value="">Akte wählen …</option>
                  {offeneAkten.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.aktenzeichen} · {a.titel}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minuten" htmlFor="ze-min">
                  <Input id="ze-min" inputMode="numeric" value={minuten} onChange={(e) => setMinuten(e.target.value.replace(/[^\d]/g, ""))} className="num" />
                </Field>
                <Field label="Datum" htmlFor="ze-datum">
                  <Input id="ze-datum" type="date" value={datum} max={heute} onChange={(e) => setDatum(e.target.value)} />
                </Field>
              </div>
              <div className="-mt-1 flex flex-wrap gap-1.5">
                {SCHNELL_MIN.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinuten(String(m))}
                    className={cn("chip num cursor-pointer transition-colors", minuten === String(m) ? "chip-ink" : "hover:bg-ink-soft")}
                  >
                    {m} Min.
                  </button>
                ))}
              </div>
              <Field label="Tätigkeit" htmlFor="ze-taetigkeit">
                <Input
                  id="ze-taetigkeit"
                  list="ze-taetigkeiten"
                  value={taetigkeit}
                  onChange={(e) => setTaetigkeit(e.target.value)}
                  placeholder="z. B. Telefonat mit Mandant"
                  onKeyDown={(e) => e.key === "Enter" && erfassen()}
                />
                <datalist id="ze-taetigkeiten">
                  {TAETIGKEITEN.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <div className="flex items-center gap-3">
                <label htmlFor="ze-abr" className="flex-1 text-[13px]">
                  Abrechenbar{" "}
                  <span className="text-fg-3">
                    · {fmtEUR(erfassenAkte?.verguetungsvereinbarung?.stundensatz ?? satzVon(user.id), { cents: false })}/Std.
                    {erfassenAkte?.verguetungsvereinbarung?.stundensatz ? " lt. Vergütungsvereinbarung" : ""}
                  </span>
                </label>
                <Switch id="ze-abr" checked={abrechenbar} onChange={setAbrechenbar} label="Abrechenbar" />
              </div>
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={erfassen}>
                Zeit erfassen
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<FilePlus2 className="size-4" />} title="Aus Zeiten abrechnen" subtitle="Offene, abrechenbare Zeiten einer Akte als Rechnung nach Stundensatz (§ 3a RVG)." />
            {abrechenbareAkten.length === 0 ? (
              <p className="text-[13px] text-fg-3">Alle abrechenbaren Zeiten sind abgerechnet.</p>
            ) : (
              <>
                <Field label="Akte" htmlFor="ze-abr-akte">
                  <Select id="ze-abr-akte" value={abrAkteObj?.id ?? ""} onChange={(e) => setAbrAkte(e.target.value)}>
                    {abrechenbareAkten.map((x) => (
                      <option key={x.akte!.id} value={x.akte!.id}>
                        {x.akte!.aktenzeichen} · {fmtStunden(x.min)} Std. · {x.akte!.titel}
                      </option>
                    ))}
                  </Select>
                </Field>
                {/* Einzelauswahl der offenen Einträge – die Summe läuft mit, nicht gewählte bleiben offen */}
                <fieldset className="mt-3">
                  <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-[12.5px] font-medium text-fg-2">
                    <span>Offene Einträge abrechnen</span>
                    <span className="num font-normal text-fg-3">
                      {abrEintraege.length} von {offeneEintraege.length} gewählt
                    </span>
                  </legend>
                  <ul className="grid max-h-[260px] grid-cols-1 gap-0.5 overflow-y-auto rounded-[14px] border border-[var(--line)] p-1">
                    {offeneEintraege.map((z) => {
                      const an = !abgewaehlt.has(z.id);
                      const u = users.get(z.userId);
                      const { satz } = satzFuerEintrag(z, abrAkteObj, users, eingabeSatz);
                      return (
                        <li key={z.id}>
                          <label className={cn("flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px] transition-colors hover:bg-ink-softer", !an && "opacity-60")}>
                            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--ink)]" checked={an} onChange={() => umschaltenAuswahl(z.id)} />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words font-medium text-fg">{z.taetigkeit}</span>
                              <span className="block text-fg-3">
                                {fmtDateShort(z.datum)} · {u?.name ?? "–"} · {fmtEUR(satz, { cents: false })}/Std.
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="num block font-medium">{fmtDauer(z.minuten)}</span>
                              <span className="num block text-fg-3">{fmtEUR(wertEintrag(z, abrAkteObj, users, eingabeSatz))}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {offeneEintraege.length > 1 && (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[12.5px]">
                      <button type="button" className="rounded-full px-2 py-1 font-medium text-ink hover:bg-ink-soft" onClick={() => setAbgewaehlt(new Set())}>
                        Alle wählen
                      </button>
                      <button type="button" className="rounded-full px-2 py-1 font-medium text-ink hover:bg-ink-soft" onClick={() => setAbgewaehlt(new Set(offeneEintraege.map((z) => z.id)))}>
                        Keine
                      </button>
                    </div>
                  )}
                </fieldset>
                {!abrVereinbarung && abrPositionen.length > 0 && (
                  <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-medium text-amber">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    Satz der Person – ohne Vereinbarung, nur Vorschau
                  </p>
                )}
                <ul className="mt-3 grid grid-cols-1 gap-1.5" aria-label="Positionen der Abrechnung">
                  {abrPositionen.map((p, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 text-fg-2">
                        <span className="num font-semibold text-fg">{fmtStunden((p.menge ?? 0) * 60)} Std.</span> ·{" "}
                        {p.bezeichnung.replace(/^Tätigkeit /, "").replace(/ (lt\. Vergütungsvereinbarung( vom [\d.]+)?|nach Zeitaufwand)/, "")}
                      </span>
                      <span className="num shrink-0 font-medium">{fmtEUR(p.betrag)}</span>
                    </li>
                  ))}
                </ul>
                {/* Vergütungsvereinbarung (§ 3a RVG): Datum und vereinbarter Stundensatz */}
                <div className="mt-3 rounded-[14px] bg-ink-softer p-3">
                  <div className="flex items-start gap-2">
                    <FileSignature className="mt-0.5 size-4 shrink-0 text-ink" />
                    <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
                      <div className="font-semibold">Vergütungsvereinbarung · § 3a RVG, Textform</div>
                      {vv ? (
                        <div className="text-fg-2">
                          vom {fmtDate(vv.datum)}
                          {vv.stundensatz ? (
                            <>
                              {" "}· <span className="num font-medium text-fg">{fmtEUR(vv.stundensatz)}/Std.</span> netto
                            </>
                          ) : (
                            <span className="text-amber"> · kein vereinbarter Stundensatz hinterlegt</span>
                          )}
                        </div>
                      ) : abrVereinbarung ? (
                        <div className="text-amber">In der E-Akte vorhanden – kein vereinbarter Stundensatz hinterlegt</div>
                      ) : (
                        <div className="text-fg-3">Noch nicht erfasst</div>
                      )}
                    </div>
                    {!vvForm && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<PenLine className="size-4" />}
                        onClick={() => setVvForm({ datum: vv?.datum ?? "", satz: vv?.stundensatz ? String(vv.stundensatz).replace(".", ",") : "" })}
                      >
                        {vv ? "Ändern" : "Erfassen"}
                      </Button>
                    )}
                  </div>
                  {vvForm && (
                    <div className="mt-3 grid gap-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field label="Datum der Vereinbarung" htmlFor="ze-vv-datum">
                          <Input id="ze-vv-datum" type="date" max={heute} required aria-required="true" value={vvForm.datum} onChange={(e) => setVvForm({ ...vvForm, datum: e.target.value })} />
                        </Field>
                        <Field label="Vereinbarter Stundensatz (netto)" htmlFor="ze-vv-satz">
                          <Input id="ze-vv-satz" inputMode="decimal" required aria-required="true" placeholder="z. B. 240" value={vvForm.satz} onChange={(e) => setVvForm({ ...vvForm, satz: e.target.value })} className="num" />
                        </Field>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="primary" onClick={vvSpeichern}>
                          Vereinbarung speichern
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setVvForm(null)}>
                          Abbrechen
                        </Button>
                        {vv && (
                          <Button size="sm" variant="ghost" className="ml-auto !text-seal" onClick={() => { vvEntfernen(); setVvForm(null); }}>
                            Entfernen
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {abrVereinbarung && (
                  <Field
                    label="Stundensatz dieser Abrechnung (netto)"
                    htmlFor="ze-abr-satz"
                    className="mt-3"
                    hint={
                      satzWahl.quelle === "vereinbarung"
                        ? "Vorbelegt mit dem vereinbarten Satz – für diese Abrechnung änderbar."
                        : satzWahl.quelle === "abrechnung"
                          ? `Abweichend vom vereinbarten Satz${vv?.stundensatz ? ` (${fmtEUR(vv.stundensatz)})` : ""} – gilt nur für diese Rechnung.`
                          : undefined
                    }
                  >
                    <Input id="ze-abr-satz" inputMode="decimal" value={satzEingabe} onChange={(e) => setSatzEingabe(e.target.value)} placeholder="Satz der jeweiligen Person" className="num" />
                  </Field>
                )}
                {abrVereinbarung && satzWahl.quelle === "person" && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] leading-snug text-fg-2">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
                    <span>
                      Kein vereinbarter Stundensatz hinterlegt – abgerechnet wird mit dem Satz der jeweiligen Person ohne den Zusatz „lt. Vergütungsvereinbarung“. Bitte den Satz der Vereinbarung erfassen.
                    </span>
                  </p>
                )}
                <div className="mt-3 grid gap-1 border-t border-[var(--line)] pt-3 text-[12.5px]">
                  <div className="flex justify-between">
                    <span className="text-fg-3">Netto</span>
                    <span className="num">{fmtEUR(abrSummen.netto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg-3">19 % USt. (Nr. 7008 VV RVG)</span>
                    <span className="num">{fmtEUR(abrSummen.ust)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-fg-3">
                      {abrEintraege.length} {abrEintraege.length === 1 ? "Eintrag" : "Einträge"} · {fmtDauer(abrEintraege.reduce((s, z) => s + z.minuten, 0))} · brutto
                    </span>
                    <span className="num text-[17px] font-semibold">{fmtEUR(abrSummen.brutto)}</span>
                  </div>
                </div>
                {!abrVereinbarung && (
                  <p className="mt-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12.5px] leading-snug text-fg-2">
                    Nach Zeit abrechnen setzt eine Vergütungsvereinbarung in Textform voraus (§ 3a Abs. 1 RVG). Ohne Vereinbarung gelten die gesetzlichen Gebühren – dann über den RVG-Rechner.
                  </p>
                )}
                <Button variant="primary" className="mt-3 w-full" icon={<FilePlus2 className="size-4" />} onClick={abrechnen} disabled={!abrVereinbarung || !abrEintraege.length}>
                  {abrEintraege.length && abrEintraege.length < offeneEintraege.length ? `${abrEintraege.length} von ${offeneEintraege.length} Einträgen abrechnen` : "Aus Zeiten abrechnen"}
                </Button>
                <p className="mt-2 text-center text-[12.5px] text-fg-3">Erstellt einen Rechnungsentwurf mit Tätigkeitsnachweis; die Zeiten werden als abgerechnet markiert und beim Löschen des Entwurfs wieder frei.</p>
              </>
            )}
          </Card>
        </div>
      </div>
      {wochen.length > 0 && (
        <p className="mt-4 text-[12.5px] text-fg-3">Erfasste Zeiten vom {fmtDate(wochen[wochen.length - 1].montag)} bis heute. Abrechenbarkeit per Tipp auf den Status umschalten.</p>
      )}
    </>
  );
}

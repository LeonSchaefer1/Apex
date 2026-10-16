// Reiter „Zeiterfassung“: Zeiten je Akte erfassen (Formular oder Stoppuhr) und nach Stundensatz abrechnen.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, FilePlus2, Hourglass, Play, Plus, Square, Timer, Wallet } from "lucide-react";
import { AnimatedNumber, Avatar, Button, Card, CardHeader, Chip, Empty, Field, Input, Segmented, Select, Stat, Switch } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { addDays, fmtDate, fmtDateShort, fmtDateWd, fmtEUR, relDays, round2, today, uid } from "@/core/dates";
import type { Zeiteintrag } from "@/core/types";
import { cn } from "@/lib/cn";
import { erstelleRechnungen } from "./aktionen";
import { fmtDauer, fmtStunden, hatVerguetungsvereinbarung, isoWoche, STANDARD_STUNDENSATZ, stundenPositionen, summen, type TabKey } from "./lib";
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

  const satzVon = (userId: string) => users.get(userId)?.stundensatz ?? user.stundensatz ?? STANDARD_STUNDENSATZ;
  const wert = (z: Zeiteintrag) => round2((z.minuten / 60) * satzVon(z.userId));

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
  const abrEintraege = abrAkteObj ? zeiten.filter((z) => z.akteId === abrAkteObj.id && z.abrechenbar && !z.abgerechnet) : [];
  const abrPositionen = stundenPositionen(abrEintraege, users, user.stundensatz ?? STANDARD_STUNDENSATZ, abrAkteObj?.verguetungsvereinbarung?.stundensatz);
  const abrSummen = summen(abrPositionen);
  // Abrechnung nach Zeit nur mit Vergütungsvereinbarung in Textform (§ 3a Abs. 1 RVG) – sonst gelten die gesetzlichen Gebühren.
  const abrVereinbarung = abrAkteObj ? hatVerguetungsvereinbarung(abrAkteObj, dokumente) : false;
  const vereinbarungUmschalten = (an: boolean) => {
    if (!abrAkteObj) return;
    useData.getState().patch("akten", abrAkteObj.id, { verguetungsvereinbarung: an ? { datum: heute, erfasstVon: user.id } : undefined });
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: abrAkteObj.id,
      text: `Vergütungsvereinbarung (§ 3a RVG) ${an ? "als vorliegend vermerkt" : "entfernt"} – ${abrAkteObj.aktenzeichen}`,
    });
  };

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
    const [r] = erstelleRechnungen([{ akte: abrAkteObj, positionen: abrPositionen, summen: abrSummen, zeitIds: abrEintraege.map((z) => z.id) }], "PDF", "entwurf", user.id);
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: abrAkteObj.id,
      text: `Rechnungsentwurf aus ${fmtStunden(abrEintraege.reduce((s, z) => s + z.minuten, 0))} Std. erstellt (${r.nummer}) – ${abrAkteObj.aktenzeichen}`,
    });
    setAbrAkte("");
    toast("Rechnungsentwurf aus Zeiten erstellt", {
      text: `${r.nummer} · ${fmtEUR(r.brutto)}`,
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
                      <span className="text-[12px] text-fg-3">
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
                        <span className="num text-[11.5px] text-fg-4">{fmtDauer(eintraege.reduce((s, z) => s + z.minuten, 0))}</span>
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
                                    <div className="truncate text-[13.5px] font-medium">{z.taetigkeit}</div>
                                    <div className="flex min-w-0 items-baseline gap-2 text-[12px] text-fg-3">
                                      <span className="mono shrink-0">{a?.aktenzeichen}</span>
                                      <span className="truncate">{a?.titel}</span>
                                      <span className="hidden shrink-0 text-fg-4 sm:inline">· {u?.name}</span>
                                    </div>
                                    <div className="mt-1 sm:hidden">{status}</div>
                                  </div>
                                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{status}</div>
                                  <div className="w-[76px] shrink-0 text-right">
                                    <div className="num text-[13.5px] font-semibold">{fmtDauer(z.minuten)}</div>
                                    <div className={cn("num text-[11px]", z.abrechenbar ? "text-fg-3" : "text-fg-4 line-through")}>{fmtEUR(wert(z), { cents: false })}</div>
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

        <div className="order-1 grid grid-cols-1 gap-4 xl:sticky xl:top-24 xl:order-2">
          <Card className={cn("overflow-hidden", timerStart && "ai-ring")}>
            <CardHeader icon={<Plus className="size-4" />} title="Zeit erfassen" subtitle="Dauer eintragen oder die Stoppuhr mitlaufen lassen." />
            <div className="mb-4 flex items-center gap-3 rounded-[18px] bg-ink-softer px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11.5px] font-medium text-fg-3">
                  {timerStart ? (
                    <>
                      <motion.span className="size-2 rounded-full bg-seal" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
                      Stoppuhr läuft{timerAkteId && akten.get(timerAkteId) ? ` · ${akten.get(timerAkteId)!.aktenzeichen}` : ""}
                    </>
                  ) : (
                    "Stoppuhr"
                  )}
                </div>
                <div className={cn("mt-0.5 text-[26px] font-semibold tracking-[-0.02em]", !timerStart && "text-fg-4")}>
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
                  Abrechenbar <span className="text-fg-3">· {fmtEUR(satzVon(user.id), { cents: false })}/Std.</span>
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
                <ul className="mt-3 grid grid-cols-1 gap-1.5">
                  {abrPositionen.map((p, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span className="min-w-0 truncate text-fg-2">
                        <span className="num font-semibold text-fg">{fmtStunden((p.menge ?? 0) * 60)} Std.</span> ·{" "}
                        {p.bezeichnung.replace(/^Tätigkeit /, "").replace(/ lt\. Vergütungsvereinbarung/, "")}
                      </span>
                      <span className="num shrink-0 font-medium">{fmtEUR(p.betrag)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between border-t border-[var(--line)] pt-3">
                  <span className="text-[12.5px] text-fg-3">{abrEintraege.length} Einträge · brutto inkl. 19 % USt.</span>
                  <span className="num text-[17px] font-semibold">{fmtEUR(abrSummen.brutto)}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label htmlFor="ze-vv" className="min-w-0 flex-1 text-[12.5px] leading-snug">
                    Vergütungsvereinbarung liegt vor <span className="text-fg-3">· § 3a RVG, Textform</span>
                  </label>
                  <Switch id="ze-vv" checked={abrVereinbarung} onChange={vereinbarungUmschalten} label="Vergütungsvereinbarung liegt vor" />
                </div>
                {!abrVereinbarung && (
                  <p className="mt-2 rounded-[12px] bg-amber-soft px-3 py-2 text-[12px] leading-snug text-fg-2">
                    Nach Zeit abrechnen setzt eine Vergütungsvereinbarung in Textform voraus. Ohne Vereinbarung gelten die gesetzlichen Gebühren – dann über den RVG-Rechner.
                  </p>
                )}
                <Button variant="secondary" className="mt-3 w-full" icon={<FilePlus2 className="size-4" />} onClick={abrechnen} disabled={!abrVereinbarung}>
                  Aus Zeiten abrechnen
                </Button>
                <p className="mt-2 text-center text-[11.5px] text-fg-4">Erstellt einen Rechnungsentwurf; die Zeiten werden als abgerechnet markiert und beim Löschen des Entwurfs wieder frei.</p>
              </>
            )}
          </Card>
        </div>
      </div>
      {wochen.length > 0 && (
        <p className="mt-4 text-[11.5px] text-fg-4">Erfasste Zeiten vom {fmtDate(wochen[wochen.length - 1].montag)} bis heute. Abrechenbarkeit per Tipp auf den Status umschalten.</p>
      )}
    </>
  );
}

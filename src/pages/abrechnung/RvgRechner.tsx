// Reiter „RVG-Rechner“: Wertgebühren nach § 13 RVG mit automatischer Tabellenwahl (§ 60 RVG), Anrechnung und Auslagen.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, CalendarDays, ChevronDown, FilePlus2, Info, Minus, Plus, Table2, Users } from "lucide-react";
import { AnimatedNumber, Button, Card, CardHeader, Checkbox, Chip, Field, Input, Select, Switch } from "@/components/ui";
import { useCol } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtEUR, round2, today } from "@/core/dates";
import { berechneRvg, fassungFuerAuftrag, gebuehr, RVG_TABELLE, RVG_TABELLE_2021, rvgRechnungsPositionen, VV_KATALOG, wertgebuehr, type RvgZeile, type VVPosition } from "@/core/rvg";
import { cn } from "@/lib/cn";
import { erstelleRechnungen } from "./aktionen";
import { FASSUNG_LABEL, fmtSatz, parseBetrag, type TabKey } from "./lib";
import { useAbrechnungUI } from "./store";

const PHASEN: VVPosition["phase"][] = ["Beratung", "Außergerichtlich", "Mahnverfahren", "Gerichtlich", "Berufung", "Vollstreckung", "Allgemein"];
const SCHNELL = [1000, 5000, 10000, 50000];
const PRUEFWERTE = [500, 1000, 5000, 10000, 50000];
const STANDARD_AN = new Set(["2300", "3100", "3104"]);

type PosState = Record<string, { an: boolean; satz: number }>;

function SatzRegler({ p, satz, onChange }: { p: VVPosition; satz: number; onChange: (v: number) => void }) {
  const [min, max] = p.rahmen!;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)));
  return (
    <div className="flex w-full items-center gap-2 sm:w-[230px]" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="icon-btn !size-7 shrink-0" aria-label="Satz verringern" onClick={() => set(satz - 0.1)} disabled={satz <= min}>
        <Minus className="size-3.5" />
      </button>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={satz}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={`Gebührensatz Nr. ${p.nr} VV RVG`}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--ink)]"
      />
      <button type="button" className="icon-btn !size-7 shrink-0" aria-label="Satz erhöhen" onClick={() => set(satz + 0.1)} disabled={satz >= max}>
        <Plus className="size-3.5" />
      </button>
      <span className="num w-8 shrink-0 text-right text-[13px] font-semibold">{fmtSatz(satz)}</span>
    </div>
  );
}

export function RvgRechnerTab({ onTab }: { onTab: (t: TabKey) => void }) {
  const akten = useCol("akten");
  const { user } = useKanzlei();
  const oeffne = useAbrechnungUI((s) => s.oeffneRechnung);
  const [wertText, setWertText] = useState("10.000");
  const [auftrag, setAuftrag] = useState(today());
  const [pos, setPos] = useState<PosState>(() => Object.fromEntries(VV_KATALOG.map((p) => [p.nr, { an: STANDARD_AN.has(p.nr), satz: p.satz }])));
  const [auftraggeber, setAuftraggeber] = useState(1);
  const [anrechnung, setAnrechnung] = useState(true);
  const [pauschale, setPauschale] = useState(true);
  const [ust, setUst] = useState(true);
  const [akteId, setAkteId] = useState("");
  const [tabelleOffen, setTabelleOffen] = useState(false);

  const wert = parseBetrag(wertText);
  const fassung = fassungFuerAuftrag(auftrag || today());
  const tabelle = fassung === "2021" ? RVG_TABELLE_2021 : RVG_TABELLE;
  const erhoehung = Math.min(0.3 * (auftraggeber - 1), 2);
  const offeneAkten = useMemo(() => akten.filter((a) => a.status === "offen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  const akte = akten.find((a) => a.id === akteId);

  const erg = useMemo(() => {
    const positionen = VV_KATALOG.filter((p) => p.nr !== "1008" && pos[p.nr]?.an).map((p) => ({ nr: p.nr, satz: pos[p.nr].satz }));
    if (erhoehung > 0) positionen.push({ nr: "1008", satz: round2(erhoehung) });
    return berechneRvg({ positionen, gegenstandswert: Math.max(0, wert), anrechnung, auslagenpauschale: pauschale, ust, fassung });
  }, [pos, erhoehung, wert, anrechnung, pauschale, ust, fassung]);

  const voll = wertgebuehr(Math.max(0, wert), fassung);
  const hatPositionen = erg.zeilen.length > 0 && wert > 0;
  // Vorbem. 3 Abs. 4 (2300 → 3305 bzw. 3100) und Anm. zu Nr. 3305 (3305 → 3100)
  const an = (nr: string) => !!pos[nr]?.an;
  const anrechnungMoeglich = (an("2300") && (an("3100") || an("3305"))) || (an("3305") && an("3100"));

  const toggle = (nr: string) => setPos((s) => ({ ...s, [nr]: { ...s[nr], an: !s[nr].an } }));
  const setSatz = (nr: string, satz: number) => setPos((s) => ({ ...s, [nr]: { ...s[nr], satz, an: true } }));

  const uebernehmen = () => {
    if (!akte) return;
    setWertText(akte.gegenstandswert.toLocaleString("de-DE"));
    setAuftrag(akte.createdAt.slice(0, 10));
    toast("Werte übernommen", { text: `Gegenstandswert und Auftragsdatum aus Akte ${akte.aktenzeichen}`, ton: "info" });
  };

  const alsRechnung = () => {
    if (!akte || !hatPositionen) return;
    const positionen = rvgRechnungsPositionen(erg.angelegenheiten);
    const [r] = erstelleRechnungen([{ akte, positionen, summen: { netto: erg.netto, ust: erg.ust, brutto: erg.brutto } }], "PDF", "entwurf", user.id);
    toast("Rechnungsentwurf erstellt", {
      text: `${r.nummer} · ${akte.aktenzeichen} · ${fmtEUR(r.brutto)}`,
      ton: "erfolg",
      aktion: {
        label: "Ansehen",
        onClick: () => {
          onTab("rechnungen");
          oeffne(r.id);
        },
      },
    });
  };

  const akteWeicht = akte && (akte.gegenstandswert !== wert || akte.createdAt.slice(0, 10) !== auftrag);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid grid-cols-1 min-w-0 gap-4">
        <Card>
          <CardHeader
            icon={<Calculator className="size-4" />}
            title="Gegenstandswert und Auftrag"
            subtitle="Die Gebührentabelle richtet sich nach dem Tag der unbedingten Auftragserteilung (§ 60 RVG)."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Gegenstandswert (€)" htmlFor="rvg-wert">
              <Input
                id="rvg-wert"
                inputMode="decimal"
                value={wertText}
                onChange={(e) => setWertText(e.target.value)}
                onBlur={() => wert > 0 && setWertText(wert.toLocaleString("de-DE", { maximumFractionDigits: 2 }))}
                className="num !h-11 !text-[16px] font-semibold"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SCHNELL.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setWertText(v.toLocaleString("de-DE"))}
                    className={cn("chip num cursor-pointer transition-colors", wert === v ? "chip-ink" : "hover:bg-ink-soft")}
                  >
                    {v.toLocaleString("de-DE")} €
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Auftrag erteilt am" htmlFor="rvg-auftrag">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-4" />
                <Input id="rvg-auftrag" type="date" value={auftrag} onChange={(e) => setAuftrag(e.target.value)} className="!h-11 !pl-10" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={fassung}
                    initial={{ opacity: 0, scale: 0.85, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 520, damping: 30 }}
                  >
                    <Chip tone={fassung === "2025" ? "ink" : "amber"} dot>
                      Tabelle {FASSUNG_LABEL[fassung]}
                    </Chip>
                  </motion.span>
                </AnimatePresence>
                <span className="text-[11.5px] text-fg-3">{fassung === "2025" ? "für Aufträge ab 01.06.2025" : "für Aufträge bis 31.05.2025 (Übergangsrecht)"}</span>
              </div>
            </Field>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-[14px] bg-ink-softer px-3.5 py-2.5 text-[12.5px] text-fg-2">
            <Info className="mt-0.5 size-4 shrink-0 text-ink" />
            <span>
              Volle Gebühr (1,0) bei <span className="num font-semibold">{fmtEUR(Math.max(0, wert))}</span>: <span className="num font-semibold text-ink">{fmtEUR(voll)}</span> – {tabelle.stand}.
            </span>
          </div>
        </Card>

        {/* Mobil: Ergebnis bleibt beim Scrollen sichtbar */}
        <button
          type="button"
          onClick={() => document.getElementById("rvg-ergebnis")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="glass-strong sticky top-[78px] z-20 flex items-center gap-3 rounded-full py-2 pl-4 pr-2 text-left xl:hidden"
        >
          <span className="min-w-0 flex-1 text-[12.5px] text-fg-3">
            Gesamt brutto · {erg.zeilen.length} {erg.zeilen.length === 1 ? "Position" : "Positionen"}
          </span>
          <AnimatedNumber value={erg.brutto} format={(n) => fmtEUR(n)} className="text-[16px] font-semibold" />
          <Chip tone={fassung === "2025" ? "ink" : "amber"}>RVG {fassung}</Chip>
        </button>

        <Card>
          <CardHeader icon={<FilePlus2 className="size-4" />} title="Gebührentatbestände" subtitle="Wählen Sie die angefallenen Gebühren; Rahmengebühren stellen Sie innerhalb des Rahmens ein." />
          <div className="grid grid-cols-1 gap-5">
            {PHASEN.map((ph) => {
              const liste = VV_KATALOG.filter((p) => p.phase === ph && p.nr !== "1008");
              return (
                <div key={ph}>
                  <div className="eyebrow mb-1.5">{ph}</div>
                  <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-[16px] border border-[var(--line)]">
                    {liste.map((p) => {
                      const s = pos[p.nr];
                      const ueberSchwelle = p.nr === "2300" && s.satz > 1.3;
                      return (
                        <li key={p.nr} className={cn("cursor-pointer px-3.5 py-3 transition-colors hover:bg-ink-softer", s.an && "bg-[var(--ink-softer)]")} onClick={() => toggle(p.nr)}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Checkbox checked={s.an} onChange={() => toggle(p.nr)} label={`Nr. ${p.nr} VV RVG wählen`} />
                            <span className="mono w-10 shrink-0 text-[12.5px] font-semibold text-fg-2">{p.nr}</span>
                            <div className="min-w-0 flex-1 basis-[160px]">
                              <div className="text-[13.5px] font-medium">{p.titel}</div>
                              {p.rahmen && (
                                <div className="text-[11.5px] text-fg-3">
                                  Rahmen {fmtSatz(p.rahmen[0])} – {fmtSatz(p.rahmen[1])}
                                  {p.hinweis ? ` · ${p.hinweis}` : ""}
                                </div>
                              )}
                            </div>
                            {p.rahmen ? <SatzRegler p={p} satz={s.satz} onChange={(v) => setSatz(p.nr, v)} /> : <span className="num text-[13px] font-semibold text-fg-2">{fmtSatz(s.satz)}</span>}
                            <span className={cn("num w-[92px] shrink-0 text-right text-[13px]", s.an ? "font-semibold" : "text-fg-4")}>{fmtEUR(gebuehr(Math.max(0, wert), s.satz, fassung))}</span>
                          </div>
                          <AnimatePresence initial={false}>
                            {ueberSchwelle && s.an && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-2 rounded-[10px] bg-amber-soft px-3 py-1.5 text-[12px] text-amber">
                                  Über der Schwellengebühr von 1,3: nur bei umfangreicher oder schwieriger Tätigkeit – Begründung in der Akte vermerken.
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                    {ph === "Allgemein" && (
                      <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                        <Users className="size-[18px] text-fg-3" />
                        <span className="mono w-10 shrink-0 text-[12.5px] font-semibold text-fg-2">1008</span>
                        <div className="min-w-0 flex-1 basis-[160px]">
                          <div className="text-[13.5px] font-medium">Anzahl Auftraggeber</div>
                          <div className="text-[11.5px] text-fg-3">Erhöht die Geschäfts- bzw. Verfahrensgebühr jeder Angelegenheit um 0,3 je weiterem Auftraggeber, höchstens 2,0</div>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-[var(--ink-softer)] p-0.5 shadow-[inset_0_0_0_1px_var(--line)]">
                          <button type="button" className="icon-btn !size-7" aria-label="Weniger Auftraggeber" disabled={auftraggeber <= 1} onClick={() => setAuftraggeber((n) => Math.max(1, n - 1))}>
                            <Minus className="size-3.5" />
                          </button>
                          <span className="num w-6 text-center text-[13px] font-semibold">{auftraggeber}</span>
                          <button type="button" className="icon-btn !size-7" aria-label="Mehr Auftraggeber" disabled={auftraggeber >= 30} onClick={() => setAuftraggeber((n) => Math.min(30, n + 1))}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className={cn("num w-[92px] shrink-0 text-right text-[13px]", erhoehung > 0 ? "font-semibold" : "text-fg-4")}>+{fmtSatz(erhoehung)}</span>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                id: "rvg-anr",
                label: "Anrechnung",
                text: "Geschäftsgebühr zur Hälfte, höchstens 0,75, auf die Verfahrensgebühr (Vorbem. 3 Abs. 4 VV RVG) – im Mahnverfahren auf Nr. 3305; Nr. 3305 auf die Verfahrensgebühr des Rechtsstreits (Anm. zu Nr. 3305).",
                v: anrechnung,
                set: setAnrechnung,
                aus: !anrechnungMoeglich,
              },
              { id: "rvg-7002", label: "Auslagenpauschale 7002", text: "20 % der Gebühren, höchstens 20,00 € je Angelegenheit.", v: pauschale, set: setPauschale, aus: false },
              { id: "rvg-7008", label: "Umsatzsteuer 7008", text: "19 % auf Gebühren und Auslagen.", v: ust, set: setUst, aus: false },
            ].map((o) => (
              <div key={o.id} className={cn("flex items-start gap-3", o.aus && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <label htmlFor={o.id} className="text-[13.5px] font-medium">
                    {o.label}
                  </label>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{o.aus ? "Greift, wenn 2300 und 3100 gewählt sind." : o.text}</p>
                </div>
                <Switch id={o.id} checked={o.v} onChange={o.set} label={o.label} />
              </div>
            ))}
          </div>
        </Card>

        <Card padded={false}>
          <button type="button" onClick={() => setTabelleOffen((x) => !x)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
            <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-ink-soft text-ink">
              <Table2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="title-md">Gebührentabelle</div>
              <div className="text-[12.5px] text-fg-3">Prüfwerte der 1,0-Gebühr nach § 13 RVG – zur Kontrolle beider Fassungen.</div>
            </div>
            <ChevronDown className={cn("size-5 text-fg-3 transition-transform duration-300", tabelleOffen && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {tabelleOffen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
                className="overflow-hidden"
              >
                <div className="overflow-x-auto px-5 pb-5">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Gegenstandswert</th>
                        <th className={cn("!text-right", fassung === "2025" && "!text-ink")}>KostBRÄG 2025</th>
                        <th className={cn("!text-right", fassung === "2021" && "!text-ink")}>KostRÄG 2021</th>
                        <th className="!text-right">Erhöhung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Set([...PRUEFWERTE, ...(wert > 0 && !PRUEFWERTE.includes(wert) ? [wert] : [])])]
                        .sort((a, b) => a - b)
                        .map((w) => {
                          const neu = wertgebuehr(w, "2025");
                          const alt = wertgebuehr(w, "2021");
                          const ist = w === wert;
                          return (
                            <tr key={w} className={cn(ist && "bg-ink-softer")}>
                              <td className="num font-medium">
                                {fmtEUR(w, { cents: w % 1 !== 0 })}
                                {ist && <span className="ml-2 text-[11px] font-normal text-ink">Ihre Eingabe</span>}
                              </td>
                              <td className={cn("num text-right", fassung === "2025" && "font-semibold")}>{fmtEUR(neu)}</td>
                              <td className={cn("num text-right", fassung === "2021" && "font-semibold")}>{fmtEUR(alt)}</td>
                              <td className="num text-right text-fg-3">+{((neu / alt - 1) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11.5px] text-fg-4">
                    Rundung auf volle Cent (§ 2 Abs. 2 S. 2 RVG). Stand der Tabellen: {RVG_TABELLE.stand}; {RVG_TABELLE_2021.stand}.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <div id="rvg-ergebnis" className="scroll-mt-24 xl:sticky xl:top-24">
        <Card className="glow overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">Ergebnis</div>
              <div className="mt-1 text-[12.5px] text-fg-3">
                Gegenstandswert <span className="num font-medium text-fg-2">{fmtEUR(Math.max(0, wert))}</span>
              </div>
            </div>
            <Chip tone={fassung === "2025" ? "ink" : "amber"}>RVG {fassung}</Chip>
          </div>

          {/* Je Angelegenheit (§ 15 RVG): Gebühren, Anrechnung und eigene Auslagenpauschale */}
          <div className="mt-4 grid grid-cols-1 gap-3">
            {erg.angelegenheiten.map((a, i) => (
              <section key={a.key} aria-label={a.titel} className={cn(i > 0 && "border-t border-dashed border-[var(--line)] pt-3")}>
                {erg.angelegenheiten.length > 1 && <div className="eyebrow mb-1">{a.titel}</div>}
                <ul className="grid grid-cols-1 gap-0.5">
                  <AnimatePresence initial={false}>
                    {a.zeilen.map((z) => (
                      <ErgebnisZeile key={z.nr} z={z} kurz={erg.angelegenheiten.length > 1} />
                    ))}
                    {pauschale && (
                      <ErgebnisZeile
                        key="7002"
                        z={{ nr: "7002", titel: "Auslagenpauschale", satz: 0, gegenstandswert: 0, betrag: a.auslagenpauschale, angelegenheit: a.key }}
                        hinweis=""
                      />
                    )}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
            {!erg.zeilen.length && <p className="py-4 text-center text-[13px] text-fg-3">Wählen Sie mindestens einen Gebührentatbestand.</p>}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-1.5 border-t border-[var(--line)] pt-3 text-[13px]">
            <Zeile k="Summe Gebühren" v={erg.gebuehrenSumme} />
            <Zeile
              k={erg.angelegenheiten.length > 1 && pauschale ? `Auslagenpauschalen (${erg.angelegenheiten.length} × Nr. 7002)` : "Auslagenpauschale (Nr. 7002)"}
              v={erg.auslagenpauschale}
              leise={!pauschale}
            />
            <Zeile k="Netto" v={erg.netto} stark />
            <Zeile k="Umsatzsteuer 19 % (Nr. 7008)" v={erg.ust} leise={!ust} />
          </div>
          <div className="mt-3 flex items-end justify-between rounded-[16px] bg-ink-softer px-4 py-3">
            <span className="text-[13px] font-semibold">Gesamtbetrag brutto</span>
            <AnimatedNumber value={erg.brutto} format={(n) => fmtEUR(n)} className="text-[26px] font-semibold tracking-[-0.03em]" />
          </div>

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <Field label="Akte" htmlFor="rvg-akte">
              <Select id="rvg-akte" value={akteId} onChange={(e) => setAkteId(e.target.value)}>
                <option value="">Akte wählen …</option>
                {offeneAkten.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.aktenzeichen} · {a.titel}
                  </option>
                ))}
              </Select>
            </Field>
            <AnimatePresence initial={false}>
              {akteWeicht && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <button type="button" onClick={uebernehmen} className="mt-2 text-left text-[12.5px] font-medium text-ink hover:underline">
                    Werte der Akte übernehmen ({fmtEUR(akte!.gegenstandswert, { cents: false })}, Auftrag {fmtDate(akte!.createdAt.slice(0, 10))})
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <Button variant="primary" className="mt-3 w-full" icon={<FilePlus2 className="size-4" />} disabled={!akte || !hatPositionen} onClick={alsRechnung}>
              Als Rechnung für Akte erstellen
            </Button>
            <p className="mt-2 text-center text-[11.5px] text-fg-4">Wird als Entwurf angelegt – Sie prüfen und stellen die Rechnung anschließend.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ErgebnisZeile({ z, hinweis, kurz }: { z: RvgZeile; hinweis?: string; kurz?: boolean }) {
  // Unter einer Angelegenheits-Überschrift ist der Instanz-Zusatz („(1. Instanz)“) doppelt.
  const titel = z.anrechnung ? z.titel.replace(/ \([\d,]+\)$/, "") : kurz ? z.titel.replace(/ \((1\. Instanz|Berufung)\)$/, "") : z.titel;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ type: "spring", stiffness: 480, damping: 36 }}
      className="flex items-baseline gap-2 py-1.5 text-[13px]"
    >
      <span className={cn("mono w-[58px] shrink-0 text-[11.5px]", z.anrechnung ? "text-amber" : "text-fg-3")}>
        {z.anrechnung ? (z.nr.startsWith("Vorb.") ? "Vorb. 3" : z.nr) : z.nr}
        {z.erhoehung ? <span className="block text-[10.5px] leading-tight">+ 1008</span> : null}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", z.nr === "7002" && "text-fg-2")} title={z.erhoehung ? `${z.titel}, erhöht nach Nr. 1008 VV RVG um ${fmtSatz(z.erhoehung)}` : z.titel}>
        {titel}
        {z.erhoehung ? <span className="block truncate text-[11.5px] text-fg-3">erhöht um {fmtSatz(z.erhoehung)}</span> : null}
      </span>
      <span className="num shrink-0 text-[12px] text-fg-3">{hinweis ?? fmtSatz(Math.abs(z.satz))}</span>
      <span className={cn("num w-[88px] shrink-0 text-right font-medium", z.betrag < 0 && "text-amber")}>{fmtEUR(z.betrag)}</span>
    </motion.li>
  );
}

function Zeile({ k, v, stark, leise }: { k: string; v: number; stark?: boolean; leise?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", leise && "text-fg-4", stark && "font-semibold")}>
      <span className={cn("min-w-0", !stark && !leise && "text-fg-2")}>{k}</span>
      <AnimatedNumber value={v} format={(n) => fmtEUR(n)} />
    </div>
  );
}

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, Infinity as InfinityIcon, Info, RotateCcw, TrendingUp } from "lucide-react";
import { fmtEUR, fmtNum } from "@/core/dates";
import { automationDef } from "@/core/automationen";
import type { Automation } from "@/core/types";
import { kostenMitWartung, LIZENZ_KENNZEICHNUNG, WARTUNG, WARTUNG_SATZ } from "@/content/lizenz";
import { AnimatedNumber, Button, Card, Chip, Field, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ARBEITSWOCHEN, JAHRESARBEITSSTUNDEN, KATEGORIEN, PERSONALKOSTEN_JAHR, WERT_PRO_STUNDE, ZIEL_STUNDEN, kostensatz, ungefaehr } from "./shared";

const JAHRE = 5;
/** Abo-Vorbelegung: mittlerer Marktpreis je Arbeitsplatz und Monat (Marktspanne ca. 50–110 €). */
const ABO_START = 80;
const LIFETIME_START = 2490;

function zahl(v: string, fallback: number, min = 0, max = 1e9): number {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  if (String(v).trim() === "") return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function ZahlFeld({ id, label, value, onChange, suffix, hint, step = 1, className, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: React.ReactNode; step?: number; className?: string; placeholder?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" min={0} step={step} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn("num", suffix && "!pr-16")} />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12.5px] text-fg-3">{suffix}</span>}
      </div>
    </Field>
  );
}

/**
 * Ersparnis-Rechner mit eigenen Mengen: Vorgänge pro Woche je Automatik × Minuten je Vorgang (aus der Definition) ergeben die
 * Stunden pro Woche; bewertet zum internen Kostensatz aus Personalkosten ÷ Jahresarbeitsstunden. Umsatzpotenzial nur, wenn
 * anwaltliche Zeit ausdrücklich eingegeben ist. Daneben der Kostenvergleich Lifetime-Lizenz (mit Wartung) vs. Abo.
 */
export function RoiRechner({ startSatz, startArbeitsplaetze, automationen, mengen, demo }: { startSatz: number; startArbeitsplaetze: number; automationen: Automation[]; mengen: Record<string, number>; demo?: boolean }) {
  const liste = useMemo(() => [...automationen].sort((a, b) => KATEGORIEN.indexOf(a.kategorie) - KATEGORIEN.indexOf(b.kategorie) || a.name.localeCompare(b.name, "de")), [automationen]);
  const vorbelegung = () => Object.fromEntries(liste.map((a) => [a.key, String(mengen[a.key] ?? 0)]));
  const [anzahl, setAnzahl] = useState<Record<string, string>>(vorbelegung);
  const [personal, setPersonal] = useState(String(PERSONALKOSTEN_JAHR));
  const [jahresstunden, setJahresstunden] = useState(String(JAHRESARBEITSSTUNDEN));
  const [anwaltStd, setAnwaltStd] = useState("");
  const [satz, setSatz] = useState(String(startSatz));
  const [plaetze, setPlaetze] = useState(String(startArbeitsplaetze));
  const [abo, setAbo] = useState(String(ABO_START));
  const [lifetime, setLifetime] = useState(String(LIFETIME_START));
  const [steigerung, setSteigerung] = useState(true);
  const [wartung, setWartung] = useState(true);

  const minuten = liste.reduce((s, a) => s + zahl(anzahl[a.key] ?? "0", 0, 0, 100000) * (automationDef(a.key)?.minutenProLauf ?? a.minutenProLauf), 0);
  const h = minuten / 60;
  const pk = zahl(personal, PERSONALKOSTEN_JAHR, 0, 1e7);
  const js = zahl(jahresstunden, JAHRESARBEITSSTUNDEN, 1, 5000);
  const k = kostensatz(pk, js);
  const anw = anwaltStd.trim() ? zahl(anwaltStd, 0, 0, h) : 0;
  const s = zahl(satz, startSatz, 0, 2000);
  const ap = zahl(plaetze, 1, 1, 1000);
  const aboPreis = zahl(abo, ABO_START, 0, 5000);
  const ltPreis = zahl(lifetime, LIFETIME_START, 0, 100000);

  const stundenJahr = h * ARBEITSWOCHEN;
  const jahresWert = stundenJahr * k;
  const potenzial = anw * ARBEITSWOCHEN * s;

  const vergleich = useMemo(() => {
    const g = steigerung ? 0.05 : 0;
    const jahre = Array.from({ length: JAHRE }, (_, j) => ap * aboPreis * 12 * Math.pow(1 + g, j));
    const aboSumme = jahre.reduce((x, y) => x + y, 0);
    const lizenz = ap * ltPreis;
    const ltSumme = wartung ? ap * kostenMitWartung(ltPreis, JAHRE) : lizenz;
    const wartungSumme = ltSumme - lizenz;
    // Kumulierte Kosten je Jahr – Lifetime: Lizenz in Jahr 1, Wartung ab Jahr 2
    let kumAbo = 0;
    let breakEven: number | null = null;
    jahre.forEach((x, j) => {
      kumAbo += x;
      const kumLt = lizenz + (wartung ? lizenz * WARTUNG_SATZ * j : 0);
      if (breakEven === null && kumAbo >= kumLt) breakEven = j + 1;
    });
    const max = Math.max(aboSumme, ltSumme, 1);
    return { jahre, aboSumme, ltSumme, lizenz, wartungSumme, breakEven: breakEven as number | null, max, diff: aboSumme - ltSumme };
  }, [ap, aboPreis, ltPreis, steigerung, wartung]);

  return (
    <Card padded={false}>
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Ersparnis */}
        <div className="flex flex-col gap-5 p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
              <Calculator className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="title-md">Ersparnis-Rechner – mit Ihren Mengen</div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">Vorgänge pro Woche × Minuten je Vorgang = gesparte Stunden – bewertet zu Ihren Personalkosten.</div>
            </div>
            <Chip tone="amber" icon={<Info className="size-3" />}>
              Rechenbeispiel
            </Chip>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold">Ihre Vorgänge pro Woche</div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setAnzahl(vorbelegung())}>
                  {demo ? "Demo-Mengen" : "Gemessene Mengen"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAnzahl(Object.fromEntries(liste.map((a) => [a.key, "0"])))}>
                  Alle auf 0
                </Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[16px] ring-1 ring-[var(--line)]">
              <div className="hidden grid-cols-[minmax(0,1fr)_88px_96px_72px] gap-2 bg-[var(--surface-2)] px-3 py-2 text-[12px] font-semibold text-fg-3 sm:grid">
                <span>Automatik · was zählt als Vorgang</span>
                <span className="text-right">Min./Vorgang</span>
                <span className="text-right">Vorgänge/Woche</span>
                <span className="text-right">Std.</span>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {liste.map((a) => {
                  const def = automationDef(a.key);
                  const min = def?.minutenProLauf ?? a.minutenProLauf;
                  const n = zahl(anzahl[a.key] ?? "0", 0, 0, 100000);
                  return (
                    <li key={a.key} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-x-2 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_88px_96px_72px]">
                      <div className="min-w-0">
                        <div className="break-words text-[13px] font-medium">{a.name}</div>
                        <div className="text-[12px] text-fg-3">
                          {def?.vorgang ?? "je Vorgang"}
                          <span className="sm:hidden"> · {min} Min.</span>
                        </div>
                      </div>
                      <div className="num hidden text-right text-[13px] text-fg-2 sm:block">{min}</div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={`Vorgänge pro Woche: ${a.name}`}
                        value={anzahl[a.key] ?? "0"}
                        onChange={(e) => setAnzahl((x) => ({ ...x, [a.key]: e.target.value }))}
                        className="num !h-9 text-right"
                      />
                      <div className="num hidden text-right text-[13px] text-fg-2 sm:block">{fmtNum((n * min) / 60, 1)}</div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-3 bg-[var(--surface-2)] px-3 py-2.5 text-[13px]">
                <span className="font-semibold">Summe gesparte Zeit</span>
                <span className="num font-semibold">{fmtNum(h, 1)} Std./Woche</span>
              </div>
            </div>
            <p className="mt-1.5 text-[12.5px] text-fg-3">{demo ? "Vorbelegt mit den Demo-Mengen der letzten 7 Tage – tragen Sie Ihre eigenen Mengen ein." : "Vorbelegt mit den gemessenen Mengen der letzten 7 Tage."} Minuten je Vorgang aus der Definition der Automatik.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ZahlFeld id="roi-personal" label="Personalkosten pro Jahr" value={personal} onChange={setPersonal} suffix="€" step={1000} hint="Arbeitgeber-Bruttokosten einer Fachangestellten" />
            <ZahlFeld id="roi-jahresstunden" label="Jahresarbeitsstunden" value={jahresstunden} onChange={setJahresstunden} suffix="Std." step={10} hint="z. B. 40 Std. × 48 Wochen" />
          </div>
          <div className="rounded-[14px] bg-ink-softer px-3.5 py-2.5 text-[12.5px] text-fg-2">
            Interner Kostensatz: <span className="num font-semibold text-fg">{fmtEUR(pk, { cents: false })}</span> ÷ <span className="num font-semibold text-fg">{fmtNum(js)} Std.</span> ={" "}
            <span className="num font-semibold text-fg">{fmtEUR(k)}/Std.</span>
          </div>

          <div className="rounded-[18px] bg-[radial-gradient(120%_140%_at_0%_0%,var(--ink-soft),transparent_65%)] p-4 ring-1 ring-[var(--line)]">
            <div className="text-[12.5px] font-medium text-fg-3">Wert der gesparten Zeit pro Jahr · zu internen Kosten</div>
            <div className="mt-1 text-[clamp(34px,5vw,46px)] font-semibold leading-none tracking-[-0.04em]">
              ≈ <AnimatedNumber value={ungefaehr(jahresWert)} format={(x) => fmtEUR(x, { cents: false })} />
            </div>
            <div className="num mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-2">
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{fmtNum(h, 1)} Std./Woche</span>
              <span className="text-fg-3">×</span>
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{ARBEITSWOCHEN} Arbeitswochen</span>
              <span className="text-fg-3">×</span>
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{fmtEUR(k)}/Std.</span>
              <span className="text-fg-3">= {fmtEUR(Math.round(jahresWert), { cents: false })}</span>
            </div>
            <div className="mt-3 text-[12.5px]">
              <span className="num text-[15px] font-semibold text-fg">{fmtNum(Math.round(stundenJahr))} Std.</span> <span className="text-fg-3">pro Jahr frei für Mandatsarbeit</span>
            </div>
            {h >= 36 && (
              <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-fg-2">
                <TrendingUp className="size-3.5 text-green" /> {fmtNum(h, 0)} Std. pro Woche entsprechen etwa einer Vollzeitstelle.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ZahlFeld id="roi-anwalt" label="davon anwaltliche Zeit (Std./Woche)" value={anwaltStd} onChange={setAnwaltStd} suffix="Std." step={0.5} placeholder="leer = keine" hint="Nur wenn frei gewordene Zeit abrechenbar ist" />
            <ZahlFeld id="roi-satz" label="Anwaltsstundensatz" value={satz} onChange={setSatz} suffix="€/Std." step={10} placeholder={String(startSatz)} />
          </div>
          {anw > 0 && (
            <div className="rounded-[14px] bg-green-soft px-3.5 py-2.5 text-[13px] text-fg-2">
              Umsatzpotenzial: <span className="num font-semibold text-fg">{fmtNum(anw, 1)} Std.</span> × {ARBEITSWOCHEN} Wochen × {fmtEUR(s, { cents: false })}/Std. ={" "}
              <span className="num font-semibold text-fg">≈ {fmtEUR(ungefaehr(potenzial), { cents: false })} pro Jahr</span> – nur, soweit die Zeit tatsächlich abrechenbar ist.
            </div>
          )}
          <p className="text-[12.5px] leading-snug text-fg-3">
            Rechenbeispiel, kaufmännisch gerundet. Zielwert des 38h-Motors: Ø {ZIEL_STUNDEN} Std. pro Woche ≈ 36.000 € pro Jahr (interner Richtwert {fmtEUR(WERT_PRO_STUNDE)}/Std.) – Ihr Wert ergibt sich aus Ihren Mengen.
          </p>
        </div>

        {/* Lifetime vs. Abo */}
        <div className="flex flex-col gap-5 border-t border-[var(--line)] p-5 md:p-6 lg:border-l lg:border-t-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
              <InfinityIcon className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="title-md">Lifetime-Lizenz vs. Abo über 5 Jahre</div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">Einmal investiert, dazu die optionale Wartung – gegenüber monatlichen Abo-Gebühren.</div>
            </div>
            <Chip tone="amber" icon={<Info className="size-3" />}>
              Beispielrechnung
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ZahlFeld id="roi-plaetze" label="Arbeitsplätze" value={plaetze} onChange={setPlaetze} />
            <ZahlFeld id="roi-abo" label="Abo je Platz/Monat" value={abo} onChange={setAbo} suffix="€" hint="Marktspanne ca. 50–110 €" />
            <ZahlFeld id="roi-lifetime" label="Lifetime je Platz" value={lifetime} onChange={setLifetime} suffix="€" hint="Annahme, einmalig" step={100} className="col-span-2 sm:col-span-1" />
          </div>
          <label className="flex items-center justify-between gap-3 text-[13px]" htmlFor="roi-wartung">
            <span className="min-w-0">
              <span className="font-medium">Wartung einrechnen</span>
              <span className="block text-[12.5px] text-fg-3">{WARTUNG.kurz}</span>
            </span>
            <Switch id="roi-wartung" checked={wartung} onChange={setWartung} label="Wartung einrechnen" />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px]" htmlFor="roi-steigerung">
            <span className="min-w-0">
              <span className="font-medium">Preiserhöhung beim Abo einrechnen</span>
              <span className="block text-[12.5px] text-fg-3">Annahme: + 5 % pro Jahr</span>
            </span>
            <Switch id="roi-steigerung" checked={steigerung} onChange={setSteigerung} label="Preiserhöhung einrechnen" />
          </label>

          <div className="flex flex-col gap-4">
            <BalkenZeile label={`Abo · ${fmtEUR(aboPreis, { cents: false })} je Arbeitsplatz/Monat`} summe={vergleich.aboSumme}>
              <div className="flex h-7 gap-[2px]" style={{ width: `${(vergleich.aboSumme / vergleich.max) * 100}%` }}>
                {vergleich.jahre.map((x, j) => (
                  <motion.div
                    key={j}
                    title={`Jahr ${j + 1}: ${fmtEUR(x, { cents: false })}`}
                    className={cn("h-full bg-[var(--fg-4)] transition-opacity hover:opacity-80", j === JAHRE - 1 && "rounded-r-[4px]")}
                    initial={false}
                    animate={{ flexGrow: x }}
                    style={{ flexBasis: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 32 }}
                  />
                ))}
              </div>
              <div className="mt-1 flex text-[12.5px] text-fg-3" style={{ width: `${(vergleich.aboSumme / vergleich.max) * 100}%` }}>
                {vergleich.jahre.map((x, j) => (
                  <span key={j} className="num truncate text-center" style={{ flex: `${x} 1 0` }}>
                    J{j + 1}
                  </span>
                ))}
              </div>
            </BalkenZeile>
            <BalkenZeile label={wartung ? "Lifetime-Lizenz · einmalig + Wartung ab Jahr 2" : "Lifetime-Lizenz · einmalig"} summe={vergleich.ltSumme}>
              <div className="flex h-7 gap-[2px]" style={{ width: `${(vergleich.ltSumme / vergleich.max) * 100}%` }}>
                <motion.div className={cn("h-full bg-ink", !wartung && "rounded-r-[4px]")} initial={false} animate={{ flexGrow: vergleich.lizenz }} style={{ flexBasis: 0 }} title={`Lizenz: ${fmtEUR(vergleich.lizenz, { cents: false })}`} />
                {wartung && vergleich.wartungSumme > 0 && (
                  <motion.div className="h-full rounded-r-[4px] bg-[color-mix(in_oklab,var(--ink)_45%,transparent)]" initial={false} animate={{ flexGrow: vergleich.wartungSumme }} style={{ flexBasis: 0 }} title={`Wartung Jahr 2–5: ${fmtEUR(vergleich.wartungSumme, { cents: false })}`} />
                )}
              </div>
              {wartung && (
                <div className="mt-1 text-[12px] text-fg-3">
                  Lizenz {fmtEUR(vergleich.lizenz, { cents: false })} + Wartung Jahr 2–5 {fmtEUR(vergleich.wartungSumme, { cents: false })} ({Math.round(WARTUNG_SATZ * 100)} % p. a.)
                </div>
              )}
            </BalkenZeile>
          </div>

          <div className={cn("rounded-[16px] p-3.5 text-[13px]", vergleich.diff > 0 ? "bg-green-soft" : "bg-[var(--ink-softer)]")}>
            {vergleich.diff > 0 ? (
              <>
                <div className="font-semibold text-fg">
                  <span className="num text-green">{fmtEUR(vergleich.diff, { cents: false })}</span> weniger Kosten in 5 Jahren{wartung ? " – einschließlich Wartung" : ""}
                </div>
                <div className="mt-0.5 text-[12.5px] text-fg-2">
                  {vergleich.breakEven ? `Die Lifetime-Lizenz hat sich in diesem Beispiel nach ${vergleich.breakEven === 1 ? "dem ersten Jahr" : `${vergleich.breakEven} Jahren`} bezahlt gemacht.` : "In diesem Beispiel ist die Lifetime-Lizenz über 5 Jahre günstiger."}
                </div>
              </>
            ) : (
              <div className="text-fg-2">Mit diesen Annahmen ist das Abo innerhalb von 5 Jahren günstiger.</div>
            )}
          </div>
          <p className="text-[12.5px] leading-snug text-fg-3">
            Beispielrechnung mit selbst gewählten Annahmen (Abo-Preis als mittlerer Marktpreis, Lifetime-Preis als Platzhalter, Wartung als Richtwert) – kein Angebot. {LIZENZ_KENNZEICHNUNG}; Ihren verbindlichen Preis nennt Ihnen Ihre feste Ansprechperson.
          </p>
        </div>
      </div>
    </Card>
  );
}

function BalkenZeile({ label, summe, children }: { label: string; summe: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="min-w-0 text-fg-2">{label}</span>
        <span className="num shrink-0 font-semibold text-fg">{fmtEUR(summe, { cents: false })}</span>
      </div>
      {children}
    </div>
  );
}

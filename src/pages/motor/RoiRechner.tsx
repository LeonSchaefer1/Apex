import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, Infinity as InfinityIcon, Info, TrendingUp } from "lucide-react";
import { fmtEUR, fmtNum } from "@/core/dates";
import { AnimatedNumber, Card, Chip, Field, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ARBEITSWOCHEN, ZIEL_STUNDEN } from "./shared";

const JAHRE = 5;

function zahl(v: string, fallback: number, min = 0, max = 1e9): number {
  const n = Number(String(v).replace(",", "."));
  if (String(v).trim() === "") return fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function ZahlFeld({ id, label, value, onChange, suffix, hint, step = 1, className }: { id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: React.ReactNode; step?: number; className?: string }) {
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <div className="relative">
        <Input id={id} type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} className={cn("num", suffix && "!pr-16")} />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12.5px] text-fg-4">{suffix}</span>}
      </div>
    </Field>
  );
}

/** ROI-Rechner: Wert der gesparten Zeit pro Jahr und Kostenvergleich Lifetime-Lizenz vs. Abo (Beispielrechnung). */
export function RoiRechner({ startAnwaelte, startSatz, startArbeitsplaetze, gemessen }: { startAnwaelte: number; startSatz: number; startArbeitsplaetze: number; gemessen: number }) {
  const [anwaelte, setAnwaelte] = useState(String(startAnwaelte));
  const [satz, setSatz] = useState(String(startSatz));
  const [stunden, setStunden] = useState(String(ZIEL_STUNDEN));
  const [plaetze, setPlaetze] = useState(String(startArbeitsplaetze));
  const [abo, setAbo] = useState("109");
  const [lifetime, setLifetime] = useState("2490");
  const [steigerung, setSteigerung] = useState(true);

  const n = zahl(anwaelte, 1, 1, 500);
  const s = zahl(satz, 250, 0, 2000);
  const h = zahl(stunden, ZIEL_STUNDEN, 0, 400);
  const ap = zahl(plaetze, 1, 1, 1000);
  const aboPreis = zahl(abo, 109, 0, 5000);
  const ltPreis = zahl(lifetime, 2490, 0, 100000);

  const jahresWert = h * ARBEITSWOCHEN * s;
  const stundenJahr = h * ARBEITSWOCHEN;

  const vergleich = useMemo(() => {
    const g = steigerung ? 0.05 : 0;
    const jahre = Array.from({ length: JAHRE }, (_, j) => ap * aboPreis * 12 * Math.pow(1 + g, j));
    const aboSumme = jahre.reduce((x, y) => x + y, 0);
    const ltSumme = ap * ltPreis;
    let kum = 0;
    let breakEven: number | null = null;
    jahre.forEach((k, j) => {
      kum += k;
      if (breakEven === null && kum >= ltSumme) breakEven = j + 1;
    });
    const max = Math.max(aboSumme, ltSumme, 1);
    return { jahre, aboSumme, ltSumme, breakEven: breakEven as number | null, max, diff: aboSumme - ltSumme };
  }, [ap, aboPreis, ltPreis, steigerung]);

  return (
    <Card padded={false}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Ersparnis */}
        <div className="flex flex-col gap-5 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
              <Calculator className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="title-md">Ersparnis-Rechner</div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">Was die gesparte Zeit Ihrer Kanzlei pro Jahr wert ist.</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ZahlFeld id="roi-anwaelte" label="Anwältinnen & Anwälte" value={anwaelte} onChange={setAnwaelte} />
            <ZahlFeld id="roi-satz" label="Ø Stundensatz" value={satz} onChange={setSatz} suffix="€/Std." step={10} />
            <ZahlFeld
              id="roi-stunden"
              label="Gesparte Std./Woche"
              value={stunden}
              onChange={setStunden}
              suffix="Std."
              hint={
                <button type="button" className="text-left text-ink hover:underline" onClick={() => setStunden(String(Math.round(gemessen * 10) / 10))}>
                  Gemessen: {fmtNum(gemessen, 1)} Std. übernehmen
                </button>
              }
            />
          </div>

          <div className="rounded-[18px] bg-[radial-gradient(120%_140%_at_0%_0%,var(--ink-soft),transparent_65%)] p-4 ring-1 ring-[var(--line)]">
            <div className="text-[12.5px] font-medium text-fg-3">Wert der gesparten Zeit pro Jahr</div>
            <div className="mt-1 text-[clamp(34px,5vw,46px)] font-semibold leading-none tracking-[-0.04em]">
              <AnimatedNumber value={jahresWert} format={(x) => fmtEUR(Math.round(x / 100) * 100, { cents: false })} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <div className="num text-[15px] font-semibold text-fg">{fmtNum(stundenJahr)} Std.</div>
                <div className="text-fg-3">frei für Mandatsarbeit ({ARBEITSWOCHEN} Arbeitswochen)</div>
              </div>
              <div>
                <div className="num text-[15px] font-semibold text-fg">{fmtNum(h / n, 1)} Std./Woche</div>
                <div className="text-fg-3">mehr Zeit je Anwältin bzw. Anwalt</div>
              </div>
            </div>
            {h >= 36 && (
              <div className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-2">
                <TrendingUp className="size-3.5 text-green" /> {fmtNum(h, 0)} Std. pro Woche entsprechen etwa einer Vollzeitstelle.
              </div>
            )}
          </div>
          <p className="text-[11.5px] leading-snug text-fg-4">Rechnung: Stunden × {ARBEITSWOCHEN} Arbeitswochen × Stundensatz. Ob die Zeit abrechenbar ist, hängt von Ihrer Kanzlei ab.</p>
        </div>

        {/* Lifetime vs. Abo */}
        <div className="flex flex-col gap-5 border-t border-[var(--line)] p-5 md:p-6 lg:border-l lg:border-t-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
              <InfinityIcon className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="title-md">Lifetime-Lizenz vs. Abo über 5 Jahre</div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">Keine wiederkehrenden Abo-Kosten – und keine Preiserhöhungen.</div>
            </div>
            <Chip tone="amber" icon={<Info className="size-3" />}>
              Beispielrechnung
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ZahlFeld id="roi-plaetze" label="Arbeitsplätze" value={plaetze} onChange={setPlaetze} />
            <ZahlFeld id="roi-abo" label="Abo je Platz/Monat" value={abo} onChange={setAbo} suffix="€" hint="typischer Marktpreis" />
            <ZahlFeld id="roi-lifetime" label="Lifetime je Platz" value={lifetime} onChange={setLifetime} suffix="€" hint="Annahme, einmalig" step={100} className="col-span-2 sm:col-span-1" />
          </div>
          <label className="flex items-center justify-between gap-3 text-[13px]" htmlFor="roi-steigerung">
            <span className="min-w-0">
              <span className="font-medium">Preiserhöhung beim Abo einrechnen</span>
              <span className="block text-[12px] text-fg-3">Annahme: + 5 % pro Jahr</span>
            </span>
            <Switch id="roi-steigerung" checked={steigerung} onChange={setSteigerung} label="Preiserhöhung einrechnen" />
          </label>

          <div className="flex flex-col gap-4">
            <BalkenZeile label={`Abo · ${fmtEUR(aboPreis, { cents: false })} je Arbeitsplatz/Monat`} summe={vergleich.aboSumme}>
              <div className="flex h-7 gap-[2px]" style={{ width: `${(vergleich.aboSumme / vergleich.max) * 100}%` }}>
                {vergleich.jahre.map((k, j) => (
                  <motion.div
                    key={j}
                    title={`Jahr ${j + 1}: ${fmtEUR(k, { cents: false })}`}
                    className={cn("h-full bg-[var(--fg-4)] transition-opacity hover:opacity-80", j === JAHRE - 1 && "rounded-r-[4px]")}
                    initial={false}
                    animate={{ flexGrow: k }}
                    style={{ flexBasis: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 32 }}
                  />
                ))}
              </div>
              <div className="mt-1 flex text-[10.5px] text-fg-4" style={{ width: `${(vergleich.aboSumme / vergleich.max) * 100}%` }}>
                {vergleich.jahre.map((k, j) => (
                  <span key={j} className="num truncate text-center" style={{ flex: `${k} 1 0` }}>
                    J{j + 1}
                  </span>
                ))}
              </div>
            </BalkenZeile>
            <BalkenZeile label="Lifetime-Lizenz · einmalig" summe={vergleich.ltSumme}>
              <motion.div
                className="h-7 rounded-r-[4px] bg-ink"
                initial={false}
                animate={{ width: `${(vergleich.ltSumme / vergleich.max) * 100}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
              />
            </BalkenZeile>
          </div>

          <div className={cn("rounded-[16px] p-3.5 text-[13px]", vergleich.diff > 0 ? "bg-green-soft" : "bg-[var(--ink-softer)]")}>
            {vergleich.diff > 0 ? (
              <>
                <div className="font-semibold text-fg">
                  <span className="num text-green">{fmtEUR(vergleich.diff, { cents: false })}</span> weniger Lizenzkosten in 5 Jahren
                </div>
                <div className="mt-0.5 text-[12.5px] text-fg-2">
                  {vergleich.breakEven ? `Die Lifetime-Lizenz hat sich in diesem Beispiel nach ${vergleich.breakEven === 1 ? "dem ersten Jahr" : `${vergleich.breakEven} Jahren`} bezahlt gemacht` : "In diesem Beispiel"} – danach fallen keine Lizenzgebühren mehr an.
                </div>
              </>
            ) : (
              <div className="text-fg-2">Mit diesen Annahmen ist das Abo innerhalb von 5 Jahren günstiger. Ab dann fallen bei der Lifetime-Lizenz keine Gebühren mehr an.</div>
            )}
          </div>
          <p className="text-[11.5px] leading-snug text-fg-4">
            Beispielrechnung mit selbst gewählten Annahmen (Abo-Preis als typischer Marktwert, Lifetime-Preis als Platzhalter) – kein Angebot. Ihren verbindlichen Preis nennt Ihnen Ihr Ansprechpartner.
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
        <span className="min-w-0 truncate text-fg-2">{label}</span>
        <span className="num shrink-0 font-semibold text-fg">{fmtEUR(summe, { cents: false })}</span>
      </div>
      {children}
    </div>
  );
}

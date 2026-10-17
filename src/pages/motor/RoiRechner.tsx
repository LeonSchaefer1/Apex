import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Calculator, Infinity as InfinityIcon, Info, Printer, RotateCcw, Save, TrendingUp } from "lucide-react";
import { fmtDate, fmtEUR, fmtNum, nowLocal, round2, today } from "@/core/dates";
import { automationDef, ZIEL_EURO_JAHR } from "@/core/automationen";
import type { Automation } from "@/core/types";
import { kostenLifetime, LIZENZ_KENNZEICHNUNG, PREIS_HINWEIS, WARTUNG_HINWEIS, WARTUNG_INHALT } from "@/content/lizenz";
import { AnimatedNumber, Button, Card, Chip, Field, Input, Modal, Switch } from "@/components/ui";
import { toast } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { festeAnsprechBezeichnung } from "@/lib/rollen";
import { cn } from "@/lib/cn";
import { ARBEITSWOCHEN, JAHRESARBEITSSTUNDEN, KATEGORIEN, PERSONALKOSTEN_JAHR, WERT_PRO_STUNDE, ZIEL_STUNDEN, kostensatz, ungefaehr } from "./shared";

const JAHRE = 5;
/** Abo-Vorbelegung: mittlerer Marktpreis je Arbeitsplatz und Monat (Marktspanne ca. 50–110 € laut öffentlichen Preislisten gängiger Kanzleisoftware). */
const ABO_START = 80;

/** Eingaben des Rechners – „Meine Werte“ je Kanzlei (localStorage), laufende Eingaben je Sitzung (sessionStorage). */
interface RoiWerte {
  anzahl: Record<string, string>;
  personal: string;
  jahresstunden: string;
  anwaltStd: string;
  satz: string;
  plaetze: string;
  abo: string;
  lizenz: string;
  wartungJahr: string;
  /** Angabe aus dem Angebot: Wartung des ersten Jahres im Lizenzpreis enthalten (Standard aus – keine Annahme, I5-T13-01). */
  erstesJahr?: boolean;
  steigerung: boolean;
  gespeichertAm?: string;
}
const speicherKey = (kanzleiId: string) => `apex.roi.${kanzleiId}`;
function lese(store: "local" | "session", key: string): RoiWerte | null {
  try {
    const s = store === "local" ? localStorage : sessionStorage;
    const v = JSON.parse(s.getItem(key) ?? "null") as RoiWerte | null;
    return v && typeof v === "object" && v.anzahl ? v : null;
  } catch {
    return null;
  }
}
function schreibe(store: "local" | "session", key: string, v: RoiWerte): boolean {
  try {
    (store === "local" ? localStorage : sessionStorage).setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

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
 * anwaltliche Zeit ausdrücklich eingegeben ist. Daneben der Kostenvergleich Lifetime-Lizenz (mit Wartung) oder Abo.
 */
export function RoiRechner({ startSatz, startArbeitsplaetze, automationen, mengen, demo, kanzleiId, kanzleiName }: { startSatz: number; startArbeitsplaetze: number; automationen: Automation[]; mengen: Record<string, number>; demo?: boolean; kanzleiId: string; kanzleiName: string }) {
  const { tenant } = useKanzlei();
  const liste = useMemo(() => [...automationen].sort((a, b) => KATEGORIEN.indexOf(a.kategorie) - KATEGORIEN.indexOf(b.kategorie) || a.name.localeCompare(b.name, "de")), [automationen]);
  const vorbelegung = () => Object.fromEntries(liste.map((a) => [a.key, String(mengen[a.key] ?? 0)]));
  const key = speicherKey(kanzleiId);
  // Laufende Eingaben (Sitzung) vor gespeicherten „Meinen Werten“ (Kanzlei) vor den Demo-Mengen
  const [start] = useState<RoiWerte | null>(() => lese("session", key) ?? lese("local", key));
  const [gespeichert, setGespeichert] = useState<RoiWerte | null>(() => lese("local", key));
  const [anzahl, setAnzahl] = useState<Record<string, string>>(() => ({ ...vorbelegung(), ...(start?.anzahl ?? {}) }));
  const [personal, setPersonal] = useState(start?.personal ?? String(PERSONALKOSTEN_JAHR));
  const [jahresstunden, setJahresstunden] = useState(start?.jahresstunden ?? String(JAHRESARBEITSSTUNDEN));
  const [anwaltStd, setAnwaltStd] = useState(start?.anwaltStd ?? "");
  const [satz, setSatz] = useState(start?.satz ?? String(startSatz));
  const [plaetze, setPlaetze] = useState(start?.plaetze ?? String(startArbeitsplaetze));
  const [abo, setAbo] = useState(start?.abo ?? String(ABO_START));
  // Lizenzpreis und Wartung: keine Vorbelegung – die Werte stehen im Angebot des Auftraggebers
  const [lizenz, setLizenz] = useState(start?.lizenz ?? "");
  const [wartungJahr, setWartungJahr] = useState(start?.wartungJahr ?? "");
  // Ob das erste Wartungsjahr im Lizenzpreis enthalten ist, regelt allein das Angebot – Standard aus (keine stille Annahme)
  const [erstesJahr, setErstesJahr] = useState(start?.erstesJahr ?? false);
  const [steigerung, setSteigerung] = useState(start?.steigerung ?? true);
  const [druck, setDruck] = useState(false);

  const werte: RoiWerte = { anzahl, personal, jahresstunden, anwaltStd, satz, plaetze, abo, lizenz, wartungJahr, erstesJahr, steigerung };
  // Eingaben überstehen einen Seitenwechsel (Cockpit und zurück) und ein Neuladen innerhalb der Sitzung
  useEffect(() => {
    schreibe("session", key, werte);
  }, [anzahl, personal, jahresstunden, anwaltStd, satz, plaetze, abo, lizenz, wartungJahr, erstesJahr, steigerung]); // eslint-disable-line react-hooks/exhaustive-deps

  const meineWerteSpeichern = () => {
    const v = { ...werte, gespeichertAm: nowLocal() };
    if (schreibe("local", key, v)) {
      setGespeichert(v);
      toast("Ihre Werte sind gespeichert", { text: "Für diese Kanzlei in diesem Browser – „Demo-Mengen“ setzt sie zurück.", ton: "erfolg" });
    } else toast("Speichern nicht möglich", { text: "Der Browser erlaubt keinen Speicher – die Werte gelten bis zum Schließen.", ton: "warnung" });
  };
  const demoMengen = () => {
    setAnzahl(vorbelegung());
    setPersonal(String(PERSONALKOSTEN_JAHR));
    setJahresstunden(String(JAHRESARBEITSSTUNDEN));
    setAnwaltStd("");
    setSatz(String(startSatz));
    setPlaetze(String(startArbeitsplaetze));
    setAbo(String(ABO_START));
    setLizenz("");
    setWartungJahr("");
    setErstesJahr(false);
    setSteigerung(true);
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ohne Speicher nichts zu löschen */
    }
    setGespeichert(null);
  };

  const minuten = liste.reduce((s, a) => s + zahl(anzahl[a.key] ?? "0", 0, 0, 100000) * (automationDef(a.key)?.minutenProLauf ?? a.minutenProLauf), 0);
  // Angezeigte Faktoren = gerechnete Faktoren: Stunden und Satz auf 2 Nachkommastellen, das Ergebnis genau daraus
  const h = round2(minuten / 60);
  const pk = zahl(personal, PERSONALKOSTEN_JAHR, 0, 1e7);
  const js = zahl(jahresstunden, JAHRESARBEITSSTUNDEN, 1, 5000);
  const k = round2(kostensatz(pk, js));
  const anw = anwaltStd.trim() ? round2(zahl(anwaltStd, 0, 0, h)) : 0;
  const s = zahl(satz, startSatz, 0, 2000);
  const ap = zahl(plaetze, 1, 1, 1000);
  const aboPreis = zahl(abo, ABO_START, 0, 5000);
  const ltPreis = lizenz.trim() ? zahl(lizenz, 0, 0, 1e6) : 0;
  const wtPreis = wartungJahr.trim() ? zahl(wartungJahr, 0, 0, 1e6) : 0;
  const mitAngebot = ltPreis > 0;

  const stundenJahr = round2(h * ARBEITSWOCHEN);
  const jahresWert = round2(h * ARBEITSWOCHEN * k);
  const potenzial = round2(anw * ARBEITSWOCHEN * s);

  const vergleich = useMemo(() => {
    const g = steigerung ? 0.05 : 0;
    const jahre = Array.from({ length: JAHRE }, (_, j) => ap * aboPreis * 12 * Math.pow(1 + g, j));
    const aboSumme = jahre.reduce((x, y) => x + y, 0);
    const lizenzSumme = ap * ltPreis;
    // Gesamtkosten aus den Angebotswerten; ob die Wartung des ersten Jahres im Lizenzpreis steckt, gibt der Schalter an (laut Angebot)
    const ltSumme = ap * kostenLifetime(ltPreis, wtPreis, JAHRE, erstesJahr);
    const wartungSumme = ltSumme - lizenzSumme;
    let kumAbo = 0;
    let breakEven: number | null = null;
    jahre.forEach((x, j) => {
      kumAbo += x;
      const kumLt = ap * kostenLifetime(ltPreis, wtPreis, j + 1, erstesJahr);
      if (breakEven === null && kumAbo >= kumLt) breakEven = j + 1;
    });
    const max = Math.max(aboSumme, ltSumme, 1);
    return { jahre, aboSumme, ltSumme, lizenz: lizenzSumme, wartungSumme, breakEven: breakEven as number | null, max, diff: aboSumme - ltSumme };
  }, [ap, aboPreis, ltPreis, wtPreis, erstesJahr, steigerung]);
  /** Wartungsjahre im Vergleich – „Jahr 1–5“ bzw. „Jahr 2–5“, wenn das Angebot das erste Jahr einschließt. */
  const wartungJahre = erstesJahr ? `Jahr 2–${JAHRE}` : `Jahr 1–${JAHRE}`;

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
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Save className="size-4" />} onClick={meineWerteSpeichern}>
              Meine Werte speichern
            </Button>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={demoMengen}>
              {demo ? "Demo-Mengen" : "Gemessene Mengen"}
            </Button>
            <Button size="sm" variant="ghost" icon={<Printer className="size-4" />} onClick={() => setDruck(true)}>
              Drucken
            </Button>
            <span className="text-[12.5px] text-fg-3" aria-live="polite">
              {gespeichert?.gespeichertAm ? `Gespeichert am ${fmtDate(gespeichert.gespeichertAm.slice(0, 10))} – nur in diesem Browser` : "Eingaben bleiben in dieser Sitzung erhalten"}
            </span>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold">Ihre Vorgänge pro Woche</div>
              <div className="flex gap-1.5">
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
                <span className="num font-semibold">{fmtNum(h, 2)} Std./Woche</span>
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
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{fmtNum(h, 2)} Std./Woche</span>
              <span className="text-fg-3">×</span>
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{ARBEITSWOCHEN} Arbeitswochen</span>
              <span className="text-fg-3">×</span>
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 shadow-[inset_0_0_0_1px_var(--line)]">{fmtEUR(k)}/Std.</span>
              <span className="text-fg-3">= {fmtEUR(jahresWert)}</span>
            </div>
            <div className="mt-3 text-[12.5px]">
              <span className="num text-[15px] font-semibold text-fg">{fmtNum(stundenJahr, 2)} Std.</span> <span className="text-fg-3">pro Jahr frei für Mandatsarbeit ({fmtNum(h, 2)} × {ARBEITSWOCHEN})</span>
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
              Umsatzpotenzial: <span className="num font-semibold text-fg">{fmtNum(anw, 2)} Std.</span> × {ARBEITSWOCHEN} Wochen × {fmtEUR(s)}/Std. = <span className="num font-semibold text-fg">{fmtEUR(potenzial)}</span> pro Jahr (≈{" "}
              {fmtEUR(ungefaehr(potenzial), { cents: false })}) – nur, soweit die Zeit tatsächlich abrechenbar ist.
            </div>
          )}
          <p className="text-[12.5px] leading-snug text-fg-3">
            Rechenbeispiel, kaufmännisch gerundet. {zielwertText(k)} Ihr Wert ergibt sich aus Ihren Mengen.
          </p>
        </div>

        {/* Lifetime-Lizenz oder Abo */}
        <div className="flex flex-col gap-5 border-t border-[var(--line)] p-5 md:p-6 lg:border-l lg:border-t-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
              <InfinityIcon className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="title-md">Lifetime-Lizenz oder Abo – Kosten über 5 Jahre</div>
              <div className="mt-0.5 text-[12.5px] text-fg-3">Einmal investiert, dazu die optionale Wartung – gegenüber monatlichen Abo-Gebühren.</div>
            </div>
            <Chip tone="amber" icon={<Info className="size-3" />}>
              Beispielrechnung
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ZahlFeld id="roi-plaetze" label="Arbeitsplätze" value={plaetze} onChange={setPlaetze} />
            <ZahlFeld id="roi-abo" label="Abo je Platz/Monat" value={abo} onChange={setAbo} suffix="€" hint="Marktspanne ca. 50–110 € (Preislisten gängiger Kanzleisoftware)" />
            <ZahlFeld id="roi-lizenz" label="Lizenzpreis je Platz laut Angebot" value={lizenz} onChange={setLizenz} suffix="€" placeholder="aus Ihrem Angebot" hint="einmalig" step={100} />
            <ZahlFeld id="roi-wartung" label="Wartung pro Jahr laut Angebot" value={wartungJahr} onChange={setWartungJahr} suffix="€" placeholder="aus Ihrem Angebot" hint={erstesJahr ? "je Platz und Jahr, ab Jahr 2 – leer = ohne Wartung" : "je Platz und Jahr – leer = ohne Wartung"} step={10} />
          </div>
          <label className="flex items-center justify-between gap-3 text-[13px]" htmlFor="roi-erstes-jahr">
            <span className="min-w-0">
              <span className="font-medium">Wartung im ersten Jahr im Lizenzpreis enthalten (laut Angebot)</span>
              <span className="block text-[12.5px] text-fg-3">Nur einschalten, wenn Ihr Angebot das so regelt – sonst rechnet der Vergleich die Wartung ab Jahr 1.</span>
            </span>
            <Switch id="roi-erstes-jahr" checked={erstesJahr} onChange={setErstesJahr} label="Wartung im ersten Jahr im Lizenzpreis enthalten (laut Angebot)" />
          </label>
          <p className="text-[12.5px] text-fg-3">
            {PREIS_HINWEIS}. {WARTUNG_HINWEIS}.
          </p>
          <label className="flex items-center justify-between gap-3 text-[13px]" htmlFor="roi-steigerung">
            <span className="min-w-0">
              <span className="font-medium">Preiserhöhung beim Abo einrechnen</span>
              <span className="block text-[12.5px] text-fg-3">Annahme: + 5 % pro Jahr</span>
            </span>
            <Switch id="roi-steigerung" checked={steigerung} onChange={setSteigerung} label="Preiserhöhung einrechnen" />
          </label>

          {!mitAngebot ? (
            <div role="status" className="rounded-[16px] bg-[var(--ink-softer)] p-4 text-[13px] leading-relaxed text-fg-2 ring-1 ring-inset ring-[var(--line)]">
              <div className="font-semibold text-fg">Preis und Wartung regelt Ihr Angebot – tragen Sie die Angebotswerte ein.</div>
              <div className="mt-1 text-[12.5px] text-fg-3">
                Erst dann zeigt der Vergleich die Kosten über {JAHRE} Jahre. AnwaltApex setzt keinen Preis und keinen Wartungssatz an.
              </div>
            </div>
          ) : (
          <>
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
            <BalkenZeile label={wtPreis > 0 ? `Lifetime-Lizenz · einmalig + Wartung ${wartungJahre} (laut Angebot)` : "Lifetime-Lizenz · einmalig (laut Angebot)"} summe={vergleich.ltSumme}>
              <div className="flex h-7 gap-[2px]" style={{ width: `${(vergleich.ltSumme / vergleich.max) * 100}%` }}>
                <motion.div className={cn("h-full bg-ink", !(vergleich.wartungSumme > 0) && "rounded-r-[4px]")} initial={false} animate={{ flexGrow: vergleich.lizenz }} style={{ flexBasis: 0 }} title={`Lizenz: ${fmtEUR(vergleich.lizenz, { cents: false })}`} />
                {vergleich.wartungSumme > 0 && (
                  <motion.div className="h-full rounded-r-[4px] bg-[color-mix(in_oklab,var(--ink)_45%,transparent)]" initial={false} animate={{ flexGrow: vergleich.wartungSumme }} style={{ flexBasis: 0 }} title={`Wartung ${wartungJahre}: ${fmtEUR(vergleich.wartungSumme, { cents: false })}`} />
                )}
              </div>
              {vergleich.wartungSumme > 0 && (
                <div className="mt-1 text-[12px] text-fg-3">
                  Lizenz {fmtEUR(vergleich.lizenz, { cents: false })} + Wartung {wartungJahre} {fmtEUR(vergleich.wartungSumme, { cents: false })} (Ihre Angebotswerte)
                </div>
              )}
            </BalkenZeile>
          </div>

          <div className={cn("rounded-[16px] p-3.5 text-[13px]", vergleich.diff > 0 ? "bg-green-soft" : "bg-[var(--ink-softer)]")}>
            {vergleich.diff > 0 ? (
              <>
                <div className="font-semibold text-fg">
                  <span className="num text-green">{fmtEUR(vergleich.diff, { cents: false })}</span> weniger Kosten in 5 Jahren{vergleich.wartungSumme > 0 ? " – einschließlich Wartung" : ""}
                </div>
                <div className="mt-0.5 text-[12.5px] text-fg-2">
                  {vergleich.breakEven ? `Die Lifetime-Lizenz hat sich in diesem Beispiel nach ${vergleich.breakEven === 1 ? "dem ersten Jahr" : `${vergleich.breakEven} Jahren`} bezahlt gemacht.` : "In diesem Beispiel ist die Lifetime-Lizenz über 5 Jahre günstiger."}
                </div>
              </>
            ) : (
              <div className="text-fg-2">Mit diesen Annahmen ist das Abo innerhalb von 5 Jahren günstiger.</div>
            )}
          </div>
          </>
          )}
          <p className="text-[12.5px] leading-snug text-fg-3">
            Beispielrechnung mit Ihren Eingaben (Abo-Preis als mittlerer Marktpreis, Lizenz und Wartung aus Ihrem Angebot) – kein Angebot. {LIZENZ_KENNZEICHNUNG}; Ihren verbindlichen Preis nennt Ihnen {festeAnsprechBezeichnung(tenant.ansprechpartner)}.
          </p>
        </div>
      </div>
      <RoiDruck
        open={druck}
        onClose={() => setDruck(false)}
        kanzleiName={kanzleiName}
        zeilen={liste.map((a) => {
          const min = automationDef(a.key)?.minutenProLauf ?? a.minutenProLauf;
          const n = zahl(anzahl[a.key] ?? "0", 0, 0, 100000);
          return { name: a.name, vorgang: automationDef(a.key)?.vorgang ?? "je Vorgang", min, n };
        })}
        h={h}
        pk={pk}
        js={js}
        k={k}
        jahresWert={jahresWert}
        anw={anw}
        s={s}
        potenzial={potenzial}
        demo={!!demo}
        vergleich={mitAngebot ? { ap, aboPreis, ltPreis, wtPreis, erstesJahr, aboSumme: vergleich.aboSumme, ltSumme: vergleich.ltSumme } : undefined}
      />
    </Card>
  );
}

/** Druckansicht des Rechners – papierweiß, schwarz, mit Herleitung und Kennzeichnung als Rechenbeispiel. */
/**
 * Zielwert des 38h-Motors zum eingestellten Kostensatz (I5-T10-01) – derselbe Satz wie Kopf und Rechner, sinngemäß wie
 * Fußnote ² der Landing: „Ø 38 Std. pro Woche – zu Ihrem Kostensatz von 26,04 €/Std. ≈ 47.500 € pro Jahr (38 × 48 × 26,04 € =
 * 47.496,96 €). Unser veröffentlichter Zielwert ≈ 36.000 € rechnet bewusst niedrig mit 19,74 €/Std.“ Gerundet auf volle
 * Hundert wie die Landing (47.496,96 € → 47.500 €); Zahl und Einheit mit geschütztem Leerzeichen.
 */
function zielwertText(k: number): string {
  const exakt = round2(ZIEL_STUNDEN * ARBEITSWOCHEN * k);
  const gerundet = Math.round(exakt / 100) * 100;
  return `Zielwert des 38h-Motors: Ø\u00a0${ZIEL_STUNDEN}\u00a0Std. pro Woche – zu Ihrem Kostensatz von ${fmtEUR(k)}/Std. ≈ ${fmtEUR(gerundet, { cents: false })} pro Jahr (${ZIEL_STUNDEN} × ${ARBEITSWOCHEN} × ${fmtEUR(k)} = ${fmtEUR(exakt)}). Unser veröffentlichter Zielwert ≈ ${fmtEUR(ZIEL_EURO_JAHR, { cents: false })} rechnet bewusst niedrig mit ${fmtEUR(WERT_PRO_STUNDE)}/Std.`;
}

function RoiDruck({
  open, onClose, kanzleiName, zeilen, h, pk, js, k, jahresWert, anw, s, potenzial, demo, vergleich,
}: {
  open: boolean;
  onClose: () => void;
  kanzleiName: string;
  zeilen: { name: string; vorgang: string; min: number; n: number }[];
  h: number;
  pk: number;
  js: number;
  k: number;
  jahresWert: number;
  anw: number;
  s: number;
  potenzial: number;
  demo: boolean;
  vergleich?: { ap: number; aboPreis: number; ltPreis: number; wtPreis: number; erstesJahr: boolean; aboSumme: number; ltSumme: number };
}) {
  const blatt = (
    <div className="roi-blatt">
      <h1>38h-Motor – Ersparnis-Rechnung</h1>
      <p className="roi-unter">
        {kanzleiName} · Stand {fmtDate(today())} · Rechenbeispiel{demo ? " mit Demo-Mengen" : ""} – kein Angebot
      </p>
      <table>
        <thead>
          <tr>
            <th>Automatik</th>
            <th>Vorgang</th>
            <th>Min./Vorgang</th>
            <th>Vorgänge/Woche</th>
            <th>Std./Woche</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.name}>
              <td>{z.name}</td>
              <td>{z.vorgang}</td>
              <td>{z.min}</td>
              <td>{z.n}</td>
              <td>{fmtNum((z.n * z.min) / 60, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Herleitung:</strong> Summe {fmtNum(h, 2)} Std./Woche × {ARBEITSWOCHEN} Arbeitswochen × interner Kostensatz {fmtEUR(k)}/Std. ({fmtEUR(pk, { cents: false })} Personalkosten ÷ {fmtNum(js)} Jahresarbeitsstunden) ={" "}
        <strong>{fmtEUR(jahresWert)}</strong> pro Jahr.
      </p>
      <p>{zielwertText(k)}</p>
      {anw > 0 && (
        <p>
          Umsatzpotenzial: {fmtNum(anw, 2)} Std./Woche anwaltliche Zeit × {ARBEITSWOCHEN} × {fmtEUR(s)}/Std. = {fmtEUR(potenzial)} pro Jahr – nur, soweit abrechenbar.
        </p>
      )}
      {vergleich ? (
        <p>
          <strong>Lifetime-Lizenz oder Abo – Kosten über {JAHRE} Jahre</strong> bei {vergleich.ap} Arbeitsplätzen: Abo {fmtEUR(vergleich.aboSumme, { cents: false })} ({fmtEUR(vergleich.aboPreis, { cents: false })} je Platz/Monat) · Lifetime-Lizenz laut Angebot{" "}
          {fmtEUR(vergleich.ltSumme, { cents: false })} ({fmtEUR(vergleich.ltPreis, { cents: false })} je Platz{vergleich.wtPreis ? ` + Wartung ${fmtEUR(vergleich.wtPreis, { cents: false })} je Platz und Jahr${vergleich.erstesJahr ? " ab Jahr 2 (erstes Jahr laut Angebot im Lizenzpreis)" : " ab Jahr 1"}` : ""}).
        </p>
      ) : (
        <p>Preis und Wartung regelt Ihr Angebot – ohne Angebotswerte kein Kostenvergleich.</p>
      )}
      <p className="roi-klein">
        Rechenbeispiel, gerundet auf Cent; Minuten je Vorgang aus der Definition der Automatik. {LIZENZ_KENNZEICHNUNG}. {WARTUNG_INHALT.titel}: {WARTUNG_HINWEIS}.
      </p>
    </div>
  );
  const css = `
    #roi-druck { display: none; }
    .roi-blatt { background: white; color: black; font: 12px/1.5 system-ui, sans-serif; padding: 18px; }
    .roi-blatt h1 { font-size: 18px; margin: 0 0 2px; }
    .roi-unter { margin: 0 0 12px; }
    .roi-blatt table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .roi-blatt th, .roi-blatt td { border: 1px solid black; padding: 3px 6px; text-align: left; vertical-align: top; }
    .roi-blatt p { margin: 8px 0; }
    .roi-klein { font-size: 11px; }
    @media print {
      body > *:not(#roi-druck) { display: none !important; }
      #roi-druck { display: block !important; }
      @page { size: A4; margin: 14mm; }
    }`;
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title="Druckansicht: Ersparnis-Rechnung"
        subtitle="Papierweiß, schwarz – mit Herleitung und Kennzeichnung als Rechenbeispiel"
        icon={<Printer className="size-[18px]" />}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
            <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Drucken
            </Button>
          </>
        }
      >
        <style>{css}</style>
        <div className="overflow-x-auto rounded-[12px] ring-1 ring-[var(--line)]">{blatt}</div>
      </Modal>
      {open && createPortal(<div id="roi-druck">{blatt}</div>, document.body)}
    </>
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

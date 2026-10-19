import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { Calculator, FlaskConical } from "lucide-react";
import { useCol } from "@/store/data";
import { hatBeispieldaten } from "@/lib/backend";
import { useKanzlei } from "@/store/session";
import { addDays, fmtDateShort, fmtEUR, fmtNum, today } from "@/core/dates";
import type { Automation } from "@/core/types";
import { AnimatedNumber, Button, Card, CardHeader, Chip, PageHeader, ProgressRing, Segmented, StatLeiste } from "@/components/ui";
import { WochenChart, type TagWert } from "./WochenChart";
import { AutomationDrawer, AutomationKarte, letzteLaeufe } from "./AutomationKarte";
import { LiveFeed } from "./LiveFeed";
import { RoiRechner } from "./RoiRechner";
import { FristAutomatikHinweis } from "@/components/FristAutomatikHinweis";
import { ARBEITSWOCHEN, JAHRESARBEITSSTUNDEN, KATEGORIEN, PERSONALKOSTEN_JAHR, ZIEL_STUNDEN, kostensatz, ungefaehr, useNow, vorgaengeVon } from "./shared";

type Filter = "alle" | Automation["kategorie"];

/** Interner Kostensatz je gesparter Stunde: Personalkosten ÷ Jahresarbeitsstunden (50.000 € ÷ 1.920 Std. = 26,04 €/Std.) – auf Cent, wie angezeigt. */
const KOSTENSATZ = Math.round(kostensatz() * 100) / 100;

export default function Motor() {
  const automationen = useCol("automationen");
  const aktivitaeten = useCol("aktivitaeten");
  const sitzung = useKanzlei();
  const { user, tenant } = sitzung;
  const now = useNow(20000);
  const [filter, setFilter] = useState<Filter>("alle");
  const [offenId, setOffenId] = useState<string | null>(null);
  const loc = useLocation();

  // Direktsprung zum Rechner (z. B. aus Einstellungen → Lizenz)
  useEffect(() => {
    if (loc.hash !== "#roi") return;
    const t = setTimeout(() => document.getElementById("roi")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    return () => clearTimeout(t);
  }, [loc.hash, loc.key]);

  const satz = user.stundensatz ?? 250;
  // Beispieldaten-Kanzlei: Die Läufe stammen aus dem simulierten Betrieb (Demo-Daten) – in echten Kanzleidaten nicht.
  const demo = hatBeispieldaten(sitzung);
  const heute = today();
  const grenze = addDays(heute, -6);

  const tage = useMemo<TagWert[]>(() => {
    const map = new Map<string, TagWert>();
    for (let i = 0; i < 7; i++) {
      const d = addDays(grenze, i);
      map.set(d, { datum: d, minuten: 0, laeufe: 0 });
    }
    for (const a of aktivitaeten) {
      const t = map.get(a.zeit.slice(0, 10));
      if (!t || !a.minutenGespart) continue;
      t.minuten += a.minutenGespart;
      t.laeufe += vorgaengeVon(a);
    }
    return [...map.values()];
  }, [aktivitaeten, grenze]);

  // Bearbeitete Vorgänge je Automatik in den letzten 7 Tagen – Vorbelegung der eigenen Mengen im Rechner
  const mengen = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of aktivitaeten) {
      if (!a.automationKey || !a.minutenGespart || a.zeit.slice(0, 10) < grenze) continue;
      m[a.automationKey] = (m[a.automationKey] ?? 0) + vorgaengeVon(a);
    }
    return m;
  }, [aktivitaeten, grenze]);

  const wochenMin = tage.reduce((s, t) => s + t.minuten, 0);
  const vorgaengeWoche = tage.reduce((s, t) => s + t.laeufe, 0);
  // Angezeigte Faktoren = gerechnete Faktoren (Stunden auf 2 Nachkommastellen, Satz auf Cent)
  const stunden = Math.round((wochenMin / 60) * 100) / 100;
  const anteil = stunden / ZIEL_STUNDEN;
  const wertWoche = Math.round(stunden * KOSTENSATZ * 100) / 100;
  // Gleiche Rechenfolge wie der Ersparnis-Rechner (Std./Woche × Arbeitswochen × Kostensatz) – beide zeigen denselben Jahreswert
  const wertJahr = Math.round(stunden * ARBEITSWOCHEN * KOSTENSATZ * 100) / 100;
  const aktiv = automationen.filter((a) => a.aktiv).length;

  const gefiltert = filter === "alle" ? automationen : automationen.filter((a) => a.kategorie === filter);
  // „Letzter Lauf“ der Karten aus demselben Protokoll wie der Live-Feed
  const laeufeAusFeed = useMemo(() => letzteLaeufe(aktivitaeten), [aktivitaeten]);
  const offen = automationen.find((a) => a.id === offenId) ?? null;

  return (
    <div>
      {demo && (
        <div className="banner mb-6" role="note">
          <FlaskConical aria-hidden />
          <span>
            <span className="font-medium text-fg">Demo-Daten</span> – im Echtbetrieb misst der Motor Ihre Kanzlei. Alle Werte hier sind simuliert.
          </span>
        </div>
      )}
      <PageHeader
        eyebrow={`${aktiv} von ${automationen.length} Automatiken aktiv`}
        title="38h-Motor"
        hilfe="motor"
        subtitle="Routineprozesse laufen im Hintergrund – mit messbarer Zeitersparnis und klarer Freigabe: Was die Kanzlei verlässt, geht erst nach Ihrer Freigabe hinaus. Jede Automatik lässt sich einzeln ein- und ausschalten."
        actions={
          <Button icon={<Calculator className="size-4" />} onClick={() => document.getElementById("roi")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Ersparnis berechnen
          </Button>
        }
      />
      {/* Pausierte Fristautomatik: Hinweis mit Datum, Uhrzeit und Person (I3-T10-01) */}
      <FristAutomatikHinweis className="mb-6" />

      <div className="grid grid-cols-1 gap-x-8 gap-y-8 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {/* Leitzahl der Seite: gesparte Stunden, daneben der Anteil am Wochenziel */}
          <section aria-label="Wochenbilanz" className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <ProgressRing value={anteil} size={128} stroke={4}>
              <div className="text-center">
                <div className="num text-[20px] font-semibold leading-6 tracking-[-0.02em]">
                  <AnimatedNumber value={Math.min(999, anteil * 100)} format={(n) => `${Math.round(n)} %`} />
                </div>
                <div className="mt-0.5 text-[12px] leading-4 text-fg-3">
                  des Wochenziels
                  <br />
                  von {ZIEL_STUNDEN} Std.
                </div>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1 basis-[280px]">
              <div className="eyebrow">
                Letzte 7 Tage · {fmtDateShort(grenze)} – {fmtDateShort(heute)}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[40px] font-semibold leading-[44px] tracking-[-0.03em]">
                  <AnimatedNumber value={stunden} format={(n) => fmtNum(n, 1)} /> Std.
                </span>
                <span className="text-[15px] text-fg-2">gespart in den letzten 7 Tagen</span>
                {demo && <Chip tone="outline">Beispielwerte</Chip>}
              </div>
              <p className="mt-2 max-w-[60ch] text-[14px] leading-5 text-fg-3">
                Automatisch erledigt, während Sie an Mandaten arbeiten. Unser Ziel für jede Kanzlei: Ø {ZIEL_STUNDEN} Std. pro Woche.
              </p>
            </div>
          </section>

          {/* Drei gleichrangige Kennzahlen in einer Leiste – Rechenweg vollständig darunter */}
          <StatLeiste spalten={3} className="max-sm:grid-cols-1">
            <Kennzahl
              label="Gesparte Kosten · letzte 7 Tage"
              wert={fmtEUR(wertWoche)}
              sub={`${fmtNum(stunden, 2)} Std. × ${fmtEUR(KOSTENSATZ)}/Std. (${fmtEUR(PERSONALKOSTEN_JAHR, { cents: false })} ÷ ${fmtNum(JAHRESARBEITSSTUNDEN)} Std.)`}
            />
            <Kennzahl label="Hochgerechnet pro Jahr" wert={`≈ ${fmtEUR(ungefaehr(wertJahr), { cents: false })}`} sub={`${fmtNum(stunden, 2)} Std. × ${ARBEITSWOCHEN} Arbeitswochen × ${fmtEUR(KOSTENSATZ)}/Std. = ${fmtEUR(wertJahr)}`} />
            <Kennzahl label="Bearbeitete Vorgänge" wert={fmtNum(vorgaengeWoche)} sub="in den letzten 7 Tagen – je Vorgang gezählt" />
          </StatLeiste>

          <Card>
            <CardHeader title="Gesparte Stunden je Tag" subtitle={demo ? "Gemessen je Vorgang · Demo-Daten (simuliert)" : "Gemessen je Vorgang"} className="mb-2" />
            <WochenChart tage={tage} heute={heute} />
          </Card>
        </div>

        <LiveFeed aktivitaeten={aktivitaeten} automationen={automationen} now={now} demo={demo} className="min-w-0 xl:col-span-4" />
      </div>

      {/* Automationen */}
      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="title-lg">Automatiken</h2>
            <p className="mt-1 text-[14px] leading-5 text-fg-3">Was im Hintergrund läuft, wodurch es ausgelöst wird, wer freigibt und wie viel Zeit es je Vorgang spart.</p>
          </div>
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "alle", label: "Alle", count: automationen.length },
              ...KATEGORIEN.map((k) => ({ value: k, label: k, count: automationen.filter((a) => a.kategorie === k).length })),
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gefiltert.map((a) => (
            <div key={a.id} className="min-w-0">
              <AutomationKarte a={a} now={now} ausFeed={laeufeAusFeed.get(a.key)} onOpen={() => setOffenId(a.id)} />
            </div>
          ))}
        </div>
      </section>

      {/* ROI */}
      <section id="roi" className="mt-12 scroll-mt-24">
        <div className="mb-4">
          <h2 className="title-lg">So rechnet sich das</h2>
          <p className="mt-1 text-[14px] leading-5 text-fg-3">Gesparte Zeit in Euro – und der Kostenvergleich zwischen Lifetime-Lizenz und Abo-Modell.</p>
        </div>
        <RoiRechner startSatz={satz} startArbeitsplaetze={tenant.lizenz.arbeitsplaetze} automationen={automationen} mengen={mengen} demo={demo} kanzleiId={tenant.id} kanzleiName={tenant.name} />
      </section>

      <AutomationDrawer a={offen} onClose={() => setOffenId(null)} aktivitaeten={aktivitaeten} now={now} />
    </div>
  );
}

/** Kennzahl in der Leiste: Label 13 Text 3, Wert 28/600, Rechenweg 13 Text 4 – vollständig, ohne Kürzung. */
function Kennzahl({ label, wert, sub }: { label: string; wert: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 px-5 py-4">
      <div className="text-[13px] leading-[18px] text-fg-3">{label}</div>
      <div className="num text-[28px] font-semibold leading-8 tracking-[-0.02em] text-fg">{wert}</div>
      <div className="text-[13px] leading-[18px] text-fg-4">{sub}</div>
    </div>
  );
}

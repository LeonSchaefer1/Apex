import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { motion } from "motion/react";
import { Calculator, Euro, FlaskConical, Repeat, Target } from "lucide-react";
import { useCol } from "@/store/data";
import { hatBeispieldaten } from "@/lib/backend";
import { useKanzlei } from "@/store/session";
import { addDays, fmtDateShort, fmtEUR, fmtNum, today } from "@/core/dates";
import type { Automation } from "@/core/types";
import { AnimatedNumber, Button, Card, Chip, PageHeader, ProgressRing, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import { WochenChart, type TagWert } from "./WochenChart";
import { AutomationDrawer, AutomationKarte, letzteLaeufe } from "./AutomationKarte";
import { LiveFeed } from "./LiveFeed";
import { RoiRechner } from "./RoiRechner";
import { ARBEITSWOCHEN, FLOW_CSS, JAHRESARBEITSSTUNDEN, KATEGORIEN, PERSONALKOSTEN_JAHR, ZIEL_STUNDEN, kostensatz, ungefaehr, useNow, vorgaengeVon } from "./shared";

type Filter = "alle" | Automation["kategorie"];

/** Interner Kostensatz je gesparter Stunde: Personalkosten ÷ Jahresarbeitsstunden (50.000 € ÷ 1.920 Std. = 26,04 €/Std.). */
const KOSTENSATZ = kostensatz();

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
  const stunden = wochenMin / 60;
  const anteil = stunden / ZIEL_STUNDEN;
  const wertWoche = stunden * KOSTENSATZ;
  const wertJahr = wertWoche * ARBEITSWOCHEN;
  const aktiv = automationen.filter((a) => a.aktiv).length;

  const gefiltert = filter === "alle" ? automationen : automationen.filter((a) => a.kategorie === filter);
  // „Letzter Lauf“ der Karten aus demselben Protokoll wie der Live-Feed
  const laeufeAusFeed = useMemo(() => letzteLaeufe(aktivitaeten), [aktivitaeten]);
  const offen = automationen.find((a) => a.id === offenId) ?? null;

  return (
    <div>
      <style>{FLOW_CSS}</style>
      {demo && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[16px] bg-amber-soft px-4 py-3 text-[13px] text-fg-2" role="note">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber" />
          <span>
            <span className="font-semibold text-fg">Demo-Daten</span> – im Echtbetrieb misst der Motor Ihre Kanzlei. Alle Werte hier sind simuliert.
          </span>
        </div>
      )}
      <PageHeader
        eyebrow={`${aktiv} von ${automationen.length} Automationen aktiv`}
        title="38h-Motor"
        hilfe="motor"
        subtitle="Routineprozesse laufen im Hintergrund – mit messbarer Zeitersparnis und klarer Freigabe: Was die Kanzlei verlässt, geht erst nach Ihrer Freigabe hinaus. Jede Automation lässt sich einzeln ein- und ausschalten."
        actions={
          <Button icon={<Calculator className="size-4" />} onClick={() => document.getElementById("roi")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Ersparnis berechnen
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Hero: Wochenbilanz */}
        <Card padded={false} className="overflow-hidden xl:col-span-2">
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center md:p-6">
            <div className="flex justify-center sm:block">
              <ProgressRing value={anteil} size={176} stroke={14} color={anteil >= 1 ? "var(--green)" : "var(--ink)"}>
                <div className="text-center">
                  <div className="text-[30px] font-semibold leading-none tracking-[-0.03em]">
                    <AnimatedNumber value={Math.min(999, anteil * 100)} format={(n) => `${Math.round(n)} %`} />
                  </div>
                  <div className="mt-1.5 text-[12px] leading-tight text-fg-3">
                    des Wochenziels
                    <br />
                    von {ZIEL_STUNDEN} Std.
                  </div>
                  {demo && (
                    <Chip tone="amber" className="mt-1.5">
                      Beispielwerte
                    </Chip>
                  )}
                </div>
              </ProgressRing>
            </div>
            <div className="min-w-0">
              <div className="eyebrow">
                Letzte 7 Tage · {fmtDateShort(grenze)} – {fmtDateShort(heute)}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[clamp(44px,7vw,64px)] font-semibold leading-[0.95] tracking-[-0.045em]">
                  <AnimatedNumber value={stunden} format={(n) => fmtNum(n, 1)} className="[font-variant-numeric:normal]" /> <span className="text-[0.55em] tracking-[-0.03em]">Std.</span>
                </span>
                <span className="text-[15px] font-medium text-fg-2">gespart in den letzten 7 Tagen</span>
                {demo && <Chip tone="amber">Beispielwerte</Chip>}
              </div>
              <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-fg-3">
                Automatisch erledigt, während Sie an Mandaten arbeiten. Unser Ziel für jede Kanzlei: Ø {ZIEL_STUNDEN} Std. pro Woche.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:col-span-2 sm:grid-cols-3">
              <Kpi
                icon={<Euro className="size-3.5" />}
                label="Gesparte Kosten · letzte 7 Tage"
                wert={fmtEUR(Math.round(wertWoche), { cents: false })}
                sub={`zu Personalkosten ${fmtEUR(KOSTENSATZ)}/Std. (${fmtEUR(PERSONALKOSTEN_JAHR, { cents: false })} ÷ ${fmtNum(JAHRESARBEITSSTUNDEN)} Std.)`}
              />
              <Kpi icon={<Target className="size-3.5" />} label="Hochgerechnet pro Jahr" wert={`≈ ${fmtEUR(ungefaehr(wertJahr), { cents: false })}`} sub={`7-Tage-Wert × ${ARBEITSWOCHEN} Arbeitswochen`} betont />
              <Kpi icon={<Repeat className="size-3.5" />} label="Bearbeitete Vorgänge" wert={fmtNum(vorgaengeWoche)} sub="in den letzten 7 Tagen – je Vorgang gezählt" />
            </div>
          </div>
          <div className="border-t border-[var(--line)] px-5 pb-3 pt-4 md:px-6">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <div className="text-[13px] font-semibold">Gesparte Stunden je Tag</div>
              <div className="text-[12.5px] text-fg-3">{demo ? "Gemessen je Vorgang · Demo-Daten (simuliert)" : "Gemessen je Vorgang"}</div>
            </div>
            <WochenChart tage={tage} heute={heute} />
          </div>
        </Card>

        <LiveFeed aktivitaeten={aktivitaeten} automationen={automationen} now={now} demo={demo} className="xl:col-span-1" />
      </div>

      {/* Automationen */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="title-lg">Automationen</h2>
            <p className="mt-1 text-[13px] text-fg-3">Was im Hintergrund läuft, wodurch es ausgelöst wird, wer freigibt und wie viel Zeit es je Vorgang spart.</p>
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
        <motion.div layout className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gefiltert.map((a, i) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, delay: Math.min(i, 10) * 0.03 }}
              className="min-w-0"
            >
              <AutomationKarte a={a} now={now} ausFeed={laeufeAusFeed.get(a.key)} onOpen={() => setOffenId(a.id)} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ROI */}
      <section id="roi" className="mt-8 scroll-mt-24">
        <div className="mb-4">
          <h2 className="title-lg">So rechnet sich das</h2>
          <p className="mt-1 text-[13px] text-fg-3">Gesparte Zeit in Euro – und der Kostenvergleich zwischen Lifetime-Lizenz und Abo-Modell.</p>
        </div>
        <RoiRechner startSatz={satz} startArbeitsplaetze={tenant.lizenz.arbeitsplaetze} automationen={automationen} mengen={mengen} demo={demo} />
      </section>

      <AutomationDrawer a={offen} onClose={() => setOffenId(null)} aktivitaeten={aktivitaeten} now={now} />
    </div>
  );
}

function Kpi({ icon, label, wert, sub, betont }: { icon: React.ReactNode; label: string; wert: string; sub: string; betont?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-[16px] px-3.5 py-3 ring-1 ring-[var(--line)]", betont ? "bg-green-soft ring-0" : "bg-[var(--surface-2)]")}>
      <div className={cn("flex items-center gap-1.5 text-[12px] font-medium", betont ? "text-green" : "text-fg-3")}>
        {icon}
        <span className="min-w-0">{label}</span>
      </div>
      <div className="mt-1 truncate text-[20px] font-semibold tracking-[-0.02em]">{wert}</div>
      <div className="text-[12px] leading-snug text-fg-3">{sub}</div>
    </div>
  );
}


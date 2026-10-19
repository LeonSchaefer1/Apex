// Reiter „Übersicht“: Kennzahlen, Monatsumsatz, Fremdgeld-Wächter und was der 38h-Motor übernimmt.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, Clock, Info, Landmark, Layers, Zap } from "lucide-react";
import { AnimatedNumber, Button, Card, CardHeader, Chip, Stat, StatLeiste, Switch } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { hatBeispieldaten } from "@/lib/backend";
import { toast } from "@/store/ui";
import { addDays, diffDays, fmtDateShort, fmtEUR, monatName, relDays, round2, today } from "@/core/dates";
import { cn } from "@/lib/cn";
import { fremdgeldKonto, fremdgeldLiegtText } from "./abgleich";
import { sendeZahlungserinnerungen } from "./aktionen";
import { WeiterleitungsDialog } from "./WeiterleitungsDialog";
import { istOffen, istUeberfaellig, offenerBetrag, zaehltAlsUmsatz, type TabKey } from "./lib";
import { useSammelKandidaten } from "./Sammelabrechnung";
import { useAbrechnungUI } from "./store";
import { UmsatzChart, type MonatsWert } from "./UmsatzChart";
import { useLookups } from "./ui";
import { BEWEGUNG } from "@/lib/bewegung";

const EUR0 = (n: number) => fmtEUR(n, { cents: false });
/** „1 Rechnung“ / „2 Rechnungen“ – Singular und Plural (I4-T08-03) */
const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

function KpiWert({ n }: { n: number }) {
  return <AnimatedNumber value={n} format={EUR0} className="text-[20px] sm:text-[28px]" />;
}

/** Offenes Fremdgeld je Akte (Saldo der Fremdgeldbuchungen). */
export function useFremdgeld() {
  const buchungen = useCol("buchungen");
  const transaktionen = useCol("transaktionen");
  const { akten, kontakte } = useLookups();
  return useMemo(() => {
    const proAkte = new Map<string, { saldo: number; letzterEingang: string; text: string }>();
    for (const b of buchungen) {
      if (b.art !== "fremdgeld" || !b.fremdgeld) continue;
      const cur = proAkte.get(b.akteId) ?? { saldo: 0, letzterEingang: b.datum, text: b.text };
      cur.saldo = round2(cur.saldo + b.betrag);
      if (b.betrag > 0 && b.datum >= cur.letzterEingang) {
        cur.letzterEingang = b.datum;
        cur.text = b.text;
      }
      proAkte.set(b.akteId, cur);
    }
    return [...proAkte.entries()]
      .filter(([, v]) => v.saldo > 0.005)
      .map(([akteId, v]) => {
        const akte = akten.get(akteId);
        // Konto, auf dem das Fremdgeld eingegangen ist (I4-T08-01)
        return { akteId, akte, mandant: akte ? kontakte.get(akte.mandantId) : undefined, konto: fremdgeldKonto(akteId, buchungen, transaktionen), ...v };
      })
      .sort((a, b) => a.letzterEingang.localeCompare(b.letzterEingang));
  }, [buchungen, transaktionen, akten, kontakte]);
}

/** Altersstufen: noch nicht fällig neutral, überfällige Beträge in Siegelrot – die Bedeutung steht zusätzlich als Beschriftung da. */
const ALTER = [
  { key: "nf", label: "noch nicht fällig", bis: 0, farbe: "var(--chart-2)" },
  { key: "30", label: "1–30 Tage", bis: 30, farbe: "var(--seal)" },
  { key: "60", label: "31–60 Tage", bis: 60, farbe: "var(--seal)" },
  { key: "90", label: "61–90 Tage", bis: 90, farbe: "var(--seal)" },
  { key: "x", label: "über 90 Tage", bis: Number.POSITIVE_INFINITY, farbe: "var(--seal)" },
];

/** Offene Posten nach Tagen seit Fälligkeit – maßstabsgetreue Balken, älteste Rechnungen zum Nachfassen. */
function OffenePosten() {
  const rechnungen = useCol("rechnungen");
  const { akten } = useLookups();
  const { user } = useKanzlei();
  const oeffne = useAbrechnungUI((s) => s.oeffneRechnung);
  const heute = today();
  const offen = rechnungen.filter(istOffen);
  const stufen = ALTER.map((a) => ({ ...a, summe: 0, anzahl: 0 }));
  for (const r of offen) {
    const tage = diffDays(r.faellig, heute);
    const st = stufen.find((x) => tage <= x.bis)!;
    st.summe = round2(st.summe + offenerBetrag(r));
    st.anzahl++;
  }
  const max = Math.max(...stufen.map((x) => x.summe), 1);
  const aelteste = offen
    .filter((r) => r.faellig < heute)
    .sort((a, b) => a.faellig.localeCompare(b.faellig))
    .slice(0, 3);
  const ueber = offen.filter((r) => r.faellig < heute);
  return (
    <Card>
      <CardHeader
        title="Offene Posten nach Fälligkeit"
        subtitle="Offene Beträge nach Tagen seit Fälligkeit – je älter, desto dringender die Erinnerung."
        action={
          ueber.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<BellRing className="size-4" />}
              onClick={() => {
                const n = sendeZahlungserinnerungen(ueber, user.id);
                toast(`${n} ${n === 1 ? "Zahlungserinnerung" : "Zahlungserinnerungen"} versendet`, { text: "An alle überfälligen Rechnungen", ton: "erfolg" });
              }}
            >
              {/* Telefon: nur das Symbol – der Name bleibt für Screenreader erhalten (axe button-name) */}
              <span className="sr-only sm:not-sr-only">Alle erinnern</span>
            </Button>
          )
        }
      />
      <ul className="grid grid-cols-1 gap-2.5">
        {stufen.map((x) => (
          <li key={x.key} className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3 text-[13px] sm:grid-cols-[132px_minmax(0,1fr)_150px]">
            <span className="truncate text-fg-3">{x.label}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div className="h-full rounded-full transition-[width] duration-200" style={{ background: x.farbe, width: `${(x.summe / max) * 100}%` }} />
            </div>
            <span className="text-right">
              <span className="num font-medium">{EUR0(x.summe)}</span>
              <span className="num ml-1.5 text-[13px] text-fg-4">{x.anzahl}×</span>
            </span>
          </li>
        ))}
      </ul>
      {aelteste.length > 0 && (
        <div className="mt-5 border-t border-[var(--line)] pt-3">
          <div className="eyebrow mb-1.5">Am längsten überfällig</div>
          <ul className="-mx-2 grid grid-cols-1 divide-y divide-[var(--line)]">
            {aelteste.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => oeffne(r.id)} className="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-2)]">
                  <span className="mono w-[112px] shrink-0 text-[13px]">{r.nummer}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{akten.get(r.akteId)?.titel}</span>
                  <span className="hidden shrink-0 text-[13px] text-seal-text sm:inline">seit {diffDays(r.faellig, heute)} Tagen</span>
                  <span className="num w-[90px] shrink-0 text-right text-[14px] font-medium">{fmtEUR(offenerBetrag(r))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function UebersichtTab({ onTab }: { onTab: (t: TabKey, extra?: Record<string, string>) => void }) {
  const rechnungen = useCol("rechnungen");
  const transaktionen = useCol("transaktionen");
  const automationen = useCol("automationen");
  const sitzung = useKanzlei();
  const beispiel = hatBeispieldaten(sitzung);
  const nav = useNavigate();
  const setSammel = useAbrechnungUI((s) => s.setSammel);
  const { vorschlaege } = useSammelKandidaten();
  const fremdgeld = useFremdgeld();
  const heute = today();

  // Direktlink auf den Fremdgeld-Wächter: /abrechnung?fokus=fremdgeld (z. B. aus „Fremdgeld auszahlen“ im Erledigen-Dialog)
  const [params, setParams] = useSearchParams();
  const fokus = params.get("fokus");
  useEffect(() => {
    if (fokus !== "fremdgeld") return;
    const t = window.setTimeout(() => {
      document.getElementById("fremdgeld-waechter")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const p = new URLSearchParams(params);
      p.delete("fokus");
      setParams(p, { replace: true });
    }, 400);
    return () => window.clearTimeout(t);
  }, [fokus]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    const grenze = addDays(heute, -30);
    const umsatz = rechnungen.filter((r) => zaehltAlsUmsatz(r) && r.datum >= grenze);
    const offen = rechnungen.filter(istOffen);
    const ueber = rechnungen.filter((r) => istUeberfaellig(r, heute));
    return {
      umsatz: round2(umsatz.reduce((s, r) => s + r.netto, 0)),
      umsatzN: umsatz.length,
      offen: round2(offen.reduce((s, r) => s + offenerBetrag(r), 0)),
      offenN: offen.length,
      ueber: round2(ueber.reduce((s, r) => s + offenerBetrag(r), 0)),
      ueberN: ueber.length,
      aeltesteUeber: ueber.reduce<string | null>((m, r) => (!m || r.faellig < m ? r.faellig : m), null),
    };
  }, [rechnungen, heute]);

  const fremdSumme = round2(fremdgeld.reduce((s, f) => s + f.saldo, 0));

  const monate = useMemo<MonatsWert[]>(() => {
    const [jj, mm] = heute.split("-").map(Number);
    return Array.from({ length: 6 }, (_, k) => {
      const i = 5 - k;
      const d = new Date(Date.UTC(jj, mm - 1 - i, 1));
      const key = d.toISOString().slice(0, 7);
      const rs = rechnungen.filter((r) => zaehltAlsUmsatz(r) && r.datum.startsWith(key));
      return {
        key,
        label: monatName(d.getUTCMonth(), true),
        langLabel: `${monatName(d.getUTCMonth())} ${d.getUTCFullYear()}`,
        wert: round2(rs.reduce((s, r) => s + r.netto, 0)),
        anzahl: rs.length,
        aktuell: i === 0,
      };
    });
  }, [rechnungen, heute]);
  const sechsMonate = round2(monate.reduce((s, m) => s + m.wert, 0));

  const offeneUmsaetze = transaktionen.filter((t) => t.status === "offen").length;
  const sammelSumme = round2(vorschlaege.reduce((s, v) => s + v.summen.brutto, 0));
  const motor = ["bankabgleich", "mahnwesen", "zeiterfassung"].map((k) => automationen.find((a) => a.key === k)).filter((a): a is NonNullable<typeof a> => !!a);
  // Ersparnis je bearbeitetem Vorgang (zugeordneter Umsatz, erstellte Rechnung, Erinnerung) – wie auf der Motor-Seite.
  // Läufe ohne Ergebnis zählen nicht: Der Bankabgleich zählt nur automatisch zugeordnete Umsätze als Vorgänge.
  const motorStunden = round2(motor.reduce((s, a) => s + a.laeufe * a.minutenProLauf, 0) / 60);
  const herleitung = `Herleitung: Vorgänge × Minuten je Vorgang (${motor.map((a) => `${a.name} ${a.minutenProLauf} Min.`).join(", ")}). Gezählt wird nur, was tatsächlich erledigt wurde – ein Abgleich ohne Zuordnung zählt 0.${beispiel ? " Beispielwerte aus dem simulierten Betrieb." : ""}`;

  // „Weiterleiten“ öffnet den Dialog mit Empfänger, IBAN (Pflicht), Betrag, Verwendungszweck und Wirkung
  const [weiterleitung, setWeiterleitung] = useState<(typeof fremdgeld)[number] | null>(null);
  const weiterleiten = (f: (typeof fremdgeld)[number]) => {
    if (f.akte) setWeiterleitung(f);
  };

  const aufgaben = [
    {
      key: "sammel",
      icon: <Layers />,
      signal: false,
      titel: vorschlaege.length ? `${vorschlaege.length} Akten abrechenbar` : "Alles abgerechnet",
      text: vorschlaege.length ? `≈ ${EUR0(sammelSumme)} Honorar – in einem Durchgang abrechnen` : "Keine offenen Gebühren",
      onClick: () => setSammel(true),
    },
    {
      key: "bank",
      icon: <Landmark />,
      signal: false,
      titel: offeneUmsaetze ? `${anzahl(offeneUmsaetze, "Kontoumsatz", "Kontoumsätze")} offen` : "Konto abgeglichen",
      text: offeneUmsaetze ? "Automatisch Rechnungen zuordnen" : "Alle Umsätze sind zugeordnet",
      onClick: () => onTab("bank"),
    },
    {
      key: "ueber",
      icon: kpi.ueberN ? <AlertTriangle /> : <BellRing />,
      signal: kpi.ueberN > 0,
      titel: kpi.ueberN ? `${anzahl(kpi.ueberN, "Rechnung", "Rechnungen")} überfällig` : "Nichts überfällig",
      text: kpi.ueberN ? `${EUR0(kpi.ueber)} offen – Zahlungserinnerung senden` : "Alle Fälligkeiten im grünen Bereich",
      onClick: () => onTab("rechnungen", { filter: "ueberfaellig" }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      {/* Kennzahlenleiste: vier Werte in einer Karte; Farbe nur am Symbol und nur bei Bedeutung (überfällig, Fremdgeld offen) */}
      <StatLeiste spalten={4}>
        <Stat label="Umsatz letzte 30 Tage" value={<KpiWert n={kpi.umsatz} />} sub={`netto · ${kpi.umsatzN} ${kpi.umsatzN === 1 ? "Rechnung" : "Rechnungen"}`} />
        <Stat label="Offene Forderungen" value={<KpiWert n={kpi.offen} />} sub={`${anzahl(kpi.offenN, "Rechnung", "Rechnungen")} offen`} onClick={() => onTab("rechnungen", { filter: "offen" })} />
        <Stat
          label="Überfällig"
          tone="seal"
          icon={kpi.ueberN ? <AlertTriangle /> : undefined}
          value={<KpiWert n={kpi.ueber} />}
          sub={kpi.aeltesteUeber ? `${anzahl(kpi.ueberN, "Rechnung", "Rechnungen")} · ${kpi.ueberN === 1 ? "seit" : "älteste seit"} ${fmtDateShort(kpi.aeltesteUeber)}` : "keine überfälligen Rechnungen"}
          onClick={() => onTab("rechnungen", { filter: "ueberfaellig" })}
        />
        <Stat
          label={
            <>
              Fremdgeld<span className="hidden sm:inline"> zur Weiterleitung</span>
            </>
          }
          tone="amber"
          icon={fremdSumme > 0 ? <Clock /> : undefined}
          value={<KpiWert n={fremdSumme} />}
          sub={fremdgeld.length ? `${fremdgeld.length} ${fremdgeld.length === 1 ? "Akte" : "Akten"} · § 43a Abs. 7 BRAO` : "alles weitergeleitet"}
        />
      </StatLeiste>

      <div className="grid gap-x-8 gap-y-8 xl:grid-cols-3">
        <div className="grid grid-cols-1 content-start gap-8 xl:col-span-2">
          <Card>
            <CardHeader
              title="Abgerechneter Umsatz je Monat"
              subtitle="Netto-Honorar aus gestellten Rechnungen der letzten sechs Monate – der laufende Monat ist hervorgehoben."
              action={
                <div className="text-right">
                  <div className="eyebrow">6 Monate</div>
                  <div className="num text-[15px] font-semibold">{EUR0(sechsMonate)}</div>
                </div>
              }
            />
            <UmsatzChart daten={monate} />
          </Card>

          {/* Jetzt erledigen: drei Aufgaben als ruhige Liste statt Kacheln */}
          <section aria-labelledby="abr-erledigen">
            <h2 id="abr-erledigen" className="title-md mb-2">
              Jetzt erledigen
            </h2>
            <ul className="sheet divide-y divide-[var(--line)] overflow-hidden rounded-lg">
              {aufgaben.map((a) => (
                <li key={a.key}>
                  <button type="button" onClick={a.onClick} className="group flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]">
                    <span className={cn("shrink-0 [&>svg]:size-4", a.signal ? "text-[var(--seal)]" : "text-fg-4")} aria-hidden>
                      {a.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-5 text-fg">{a.titel}</span>
                      <span className="block text-[13px] leading-[18px] text-fg-3">{a.text}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-fg-4 transition-colors group-hover:text-fg" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <OffenePosten />
        </div>
        <div className="grid grid-cols-1 content-start gap-8">
          <Card className="flex flex-col scroll-mt-24" id="fremdgeld-waechter">
            <CardHeader title="Fremdgeld-Wächter" subtitle="Fremdgeld ist unverzüglich an die Berechtigten weiterzuleiten (§ 43a Abs. 7 BRAO)." />
            <ul className="flex-1 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              <AnimatePresence initial={false}>
                {fremdgeld.map((f) => {
                  const tage = diffDays(f.letzterEingang, heute);
                  return (
                    <motion.li key={f.akteId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="mono shrink-0 text-[13px] text-fg-3">{f.akte?.aktenzeichen}</span>
                            <span className="break-words text-[14px] font-medium">{f.akte?.titel}</span>
                          </div>
                          <div className="mt-0.5 break-words text-[13px] text-fg-3">{f.text}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Chip tone={tage >= 3 ? "seal" : "amber"}>
                              eingegangen {relDays(f.letzterEingang, heute)}
                            </Chip>
                            <span className="text-[13px] text-fg-3">an {f.mandant?.name ?? "Mandant"}</span>
                          </div>
                          {f.konto && (
                            <div className={cn("mt-1 flex items-start gap-1.5 text-[13px]", f.konto === "ander" ? "text-fg-3" : "font-medium text-[var(--amber-text)]")}>
                              <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                              <span>{fremdgeldLiegtText(f.saldo, f.konto)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="num text-[14px] font-semibold">{fmtEUR(f.saldo)}</span>
                          <Button size="sm" variant="secondary" icon={<ArrowRight className="size-4" />} onClick={() => weiterleiten(f)}>
                            Weiterleiten
                          </Button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {fremdgeld.length === 0 && (
                <li className="flex flex-col items-center px-4 py-8 text-center">
                  <CheckCircle2 className="size-5 text-fg-4" aria-hidden />
                  <div className="title-md mt-3">Kein Fremdgeld offen</div>
                  <p className="mt-1 text-[14px] text-fg-3">Alle Fremdgelder sind an die Berechtigten weitergeleitet.</p>
                </li>
              )}
            </ul>
            <p className="border-t border-[var(--line)] pt-3 text-[13px] leading-[18px] text-fg-4">
              Ab drei Tagen Liegezeit wird rot markiert. „Weiterleiten“ fragt Empfänger, IBAN und Wirkung ab, bucht die Auszahlung im Aktenkonto und erledigt die zugehörige Frist – nie automatisch.
            </p>
            <WeiterleitungsDialog akte={weiterleitung?.akte} mandant={weiterleitung?.mandant} offen={weiterleitung?.saldo ?? 0} open={!!weiterleitung} onClose={() => setWeiterleitung(null)} />
          </Card>
          <Card>
            <CardHeader
              icon={<Zap />}
              title="Was der 38h-Motor hier automatisiert"
              subtitle={
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span>Bisher ≈ {motorStunden.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std. Routinearbeit in der Abrechnung übernommen.</span>
                  <span className="inline-flex items-center gap-1 text-fg-3" title={herleitung}>
                    <Info className="size-3.5" aria-hidden />
                    <span className="sr-only">{herleitung}</span>
                  </span>
                </span>
              }
              action={beispiel ? <Chip tone="outline">Beispielwerte</Chip> : undefined}
            />
            <ul className="grid grid-cols-1 divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {motor.map((a) => {
                return (
                  <li key={a.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium">{a.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-[13px] leading-[18px] text-fg-3">{a.beschreibung}</div>
                      <div className="num mt-1 text-[13px] text-fg-4" title={herleitung}>
                        {a.minutenProLauf} Min. je Vorgang · {a.laeufe.toLocaleString("de-DE")} {a.laeufe === 1 ? "Vorgang" : "Vorgänge"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Switch
                        checked={a.aktiv}
                        label={`${a.name} ${a.aktiv ? "pausieren" : "aktivieren"}`}
                        onChange={(v) => {
                          useData.getState().patch("automationen", a.id, { aktiv: v });
                          useData.getState().log({ akteur: "nutzer", userId: sitzung.user.id, text: `Automatik „${a.name}“ ${v ? "aktiviert" : "pausiert"}` });
                        }}
                      />
                      {/* Rückmeldung an der Karte selbst statt Meldung über dem Schalter (WCAG 2.4.11) */}
                      <span aria-live="polite" className="text-[12px] font-medium text-fg-3">
                        {a.aktiv ? "aktiv" : "pausiert"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/automatisierung")}>
              Zum 38h-Motor
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

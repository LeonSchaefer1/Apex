// Reiter „RVG-Rechner“: Wertgebühren nach § 13 RVG mit automatischer Tabellenwahl (§ 60 RVG), Anrechnung und Auslagen.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CalendarDays, ChevronDown, FilePlus2, Info, Minus, Plus, Table2, Users } from "lucide-react";
import { AnimatedNumber, Button, Card, CardHeader, Checkbox, Chip, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { useCol } from "@/store/data";
import type { Rechnung, RechnungsPosition } from "@/core/types";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtEUR, round2, today } from "@/core/dates";
import { berechneRvg, fassungFuerAuftrag, gebuehr, RVG_TABELLE, RVG_TABELLE_2021, rvgRechnungsPositionen, VV_KATALOG, wertgebuehr, type RvgZeile, type VVPosition } from "@/core/rvg";
import { cn } from "@/lib/cn";
import { erstelleRechnungen } from "./aktionen";
import { FASSUNG_LABEL, fmtSatz, pruefeBetragEingabe, type TabKey } from "./lib";
import { useAbrechnungUI } from "./store";
import { BeispielHinweis } from "./Zinsrechner";
import { BEWEGUNG } from "@/lib/bewegung";

const PHASEN: VVPosition["phase"][] = ["Beratung", "Außergerichtlich", "Mahnverfahren", "Gerichtlich", "Berufung", "Vollstreckung", "Allgemein"];
const SCHNELL = [1000, 5000, 10000, 50000];
const PRUEFWERTE = [500, 1000, 5000, 10000, 50000];
const STANDARD_AN = new Set(["2300", "3100", "3104"]);

type PosState = Record<string, { an: boolean; satz: number }>;

/** Einigungsgebühren im passenden Abschnitt: 1000 außergerichtlich, 1003 gerichtlich (nach 3100/3104). */
const ANZEIGE_PHASE: Record<string, VVPosition["phase"]> = {
  "1000": "Außergerichtlich",
  "1003": "Gerichtlich",
};
const anzeigePhase = (p: VVPosition) => ANZEIGE_PHASE[p.nr] ?? p.phase;

/**
 * Eingaben des Rechners bleiben je Person erhalten – auch über ein Neuladen und ein geschlossenes Fenster (localStorage dieses
 * Browsers; nur Rechenwerte und die gewählte Akten-ID, keine Mandantendaten).
 */
const SPEICHER = "apex.rvg.eingaben";
const speicherKey = (userId: string) => `${SPEICHER}.${userId}`;
interface Eingaben {
  wertText: string;
  auftrag: string;
  pos: PosState;
  auftraggeber: number;
  anrechnung: boolean;
  pauschale: boolean;
  ust: boolean;
  akteId: string;
  /** Noch die Startwerte (Beispiel) – keine eigene Eingabe */
  beispiel?: boolean;
}
function ladeEingaben(userId: string): Partial<Eingaben> {
  for (const lies of [() => localStorage.getItem(speicherKey(userId)), () => sessionStorage.getItem(SPEICHER)]) {
    try {
      const roh = lies();
      if (!roh) continue;
      const e = JSON.parse(roh) as Partial<Eingaben>;
      if (e && typeof e === "object") return e;
    } catch {
      /* Speicher gesperrt – nächste Quelle */
    }
  }
  return {};
}

function SatzRegler({ p, satz, onChange }: { p: VVPosition; satz: number; onChange: (v: number) => void }) {
  const [min, max] = p.rahmen!;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)));
  return (
    <div className="flex w-full items-center gap-2 sm:w-[230px]" onClick={(e) => e.stopPropagation()}>
      <button type="button" tabIndex={-1} className="icon-btn !size-7 shrink-0" aria-label="Satz verringern" onClick={() => set(satz - 0.1)} disabled={satz <= min}>
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
      <button type="button" tabIndex={-1} className="icon-btn !size-7 shrink-0" aria-label="Satz erhöhen" onClick={() => set(satz + 0.1)} disabled={satz >= max}>
        <Plus className="size-3.5" />
      </button>
      <span className="num w-8 shrink-0 text-right text-[13px] font-semibold">{fmtSatz(satz)}</span>
    </div>
  );
}

/** Gleiche Positionen (Nr., Satz, Wert, Betrag) – erkennt einen schon angelegten, identischen Entwurf. */
function gleichePositionen(a: RechnungsPosition[], b: RechnungsPosition[]): boolean {
  const sig = (ps: RechnungsPosition[]) =>
    ps
      .map((p) => `${p.vv}|${p.satz ?? ""}|${p.gegenstandswert ?? ""}|${round2(p.betrag)}`)
      .sort()
      .join(";");
  return sig(a) === sig(b);
}

export function RvgRechnerTab({ onTab }: { onTab: (t: TabKey) => void }) {
  const akten = useCol("akten");
  const rechnungen = useCol("rechnungen");
  // Für diese Akte liegt schon ein Entwurf mit denselben Positionen vor → Rückfrage „öffnen / trotzdem neu anlegen“
  const [dublette, setDublette] = useState<Rechnung | null>(null);
  const { user } = useKanzlei();
  const oeffne = useAbrechnungUI((s) => s.oeffneRechnung);
  const [gespeichert] = useState(() => ladeEingaben(user.id));
  const [wertText, setWertText] = useState(gespeichert.wertText ?? "10.000");
  const [auftrag, setAuftrag] = useState(gespeichert.auftrag ?? today());
  const [pos, setPos] = useState<PosState>(() => ({
    ...Object.fromEntries(VV_KATALOG.map((p) => [p.nr, { an: STANDARD_AN.has(p.nr), satz: p.satz }])),
    ...Object.fromEntries(Object.entries(gespeichert.pos ?? {}).filter(([nr]) => VV_KATALOG.some((p) => p.nr === nr))),
  }));
  const [auftraggeber, setAuftraggeber] = useState(gespeichert.auftraggeber ?? 1);
  const [anrechnung, setAnrechnung] = useState(gespeichert.anrechnung ?? true);
  const [pauschale, setPauschale] = useState(gespeichert.pauschale ?? true);
  const [ust, setUst] = useState(gespeichert.ust ?? true);
  const [akteId, setAkteId] = useState(gespeichert.akteId ?? "");
  // Beispielwerte (10.000 €, Geschäftsgebühr) gekennzeichnet, bis zur ersten eigenen Eingabe – gespeicherte eigene Eingaben gelten nicht als Beispiel (I4-T09-02)
  const [beispiel, setBeispiel] = useState(gespeichert.wertText === undefined || gespeichert.beispiel === true);
  const eigen = () => setBeispiel(false);
  useEffect(() => {
    try {
      localStorage.setItem(
        speicherKey(user.id),
        JSON.stringify({
          wertText,
          auftrag,
          pos,
          auftraggeber,
          anrechnung,
          pauschale,
          ust,
          akteId,
          beispiel,
        } satisfies Eingaben),
      );
    } catch {
      /* Speicher nicht verfügbar – Eingaben gelten dann nur bis zum Neuladen */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wertText, auftrag, pos, auftraggeber, anrechnung, pauschale, ust, akteId, beispiel]);

  // Tastatur (I4-T07-02): beim Öffnen des Rechners (Reiter, Strg+K, Direktlink) Fokus ins Feld Gegenstandswert – nicht auf BODY
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const akt = document.activeElement;
      // Nur, wenn der Fokus nicht schon bewusst in einem Eingabefeld steht
      if (akt && akt !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(akt.tagName)) return;
      document.getElementById("rvg-wert")?.focus({ preventScroll: true });
    }, 180);
    return () => window.clearTimeout(t);
  }, []);
  const erstellenRef = useRef<HTMLButtonElement>(null);
  const [tabelleOffen, setTabelleOffen] = useState(false);

  // Eingabeprüfung (I5-T07-01): leer, keine Zahl oder ≤ 0 → Meldung am Feld, kein Ergebnis – kein stilles Klemmen auf 0
  const wertPruefung = pruefeBetragEingabe(wertText);
  const gueltig = !wertPruefung.fehler;
  const wert = wertPruefung.wert ?? 0;
  const [beruehrt, setBeruehrt] = useState(false);
  const wertFehler = !gueltig && (beruehrt || wertText.trim() !== "") ? wertPruefung.fehler : undefined;
  const fassung = fassungFuerAuftrag(auftrag || today());
  const tabelle = fassung === "2021" ? RVG_TABELLE_2021 : RVG_TABELLE;
  const erhoehung = Math.min(0.3 * (auftraggeber - 1), 2);
  const offeneAkten = useMemo(() => akten.filter((a) => a.status === "offen").sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true })), [akten]);
  const akte = akten.find((a) => a.id === akteId);

  const erg = useMemo(() => {
    const positionen = VV_KATALOG.filter((p) => p.nr !== "1008" && pos[p.nr]?.an).map((p) => ({ nr: p.nr, satz: pos[p.nr].satz }));
    if (erhoehung > 0) positionen.push({ nr: "1008", satz: round2(erhoehung) });
    return berechneRvg({
      positionen,
      gegenstandswert: wert,
      anrechnung,
      auslagenpauschale: pauschale,
      ust,
      fassung,
    });
  }, [pos, erhoehung, wert, anrechnung, pauschale, ust, fassung]);

  const voll = wertgebuehr(wert, fassung);
  const hatPositionen = erg.zeilen.length > 0 && gueltig;
  // Vorbem. 3 Abs. 4 (2300 → 3305 bzw. 3100) und Anm. zu Nr. 3305 (3305 → 3100)
  const an = (nr: string) => !!pos[nr]?.an;
  const anrechnungMoeglich = (an("2300") && (an("3100") || an("3305"))) || (an("3305") && an("3100"));

  const toggle = (nr: string) => {
    eigen();
    setPos((s) => ({ ...s, [nr]: { ...s[nr], an: !s[nr].an } }));
  };
  const setSatz = (nr: string, satz: number) => {
    eigen();
    setPos((s) => ({ ...s, [nr]: { ...s[nr], satz, an: true } }));
  };

  const uebernehmen = () => {
    if (!akte) return;
    eigen();
    setWertText(akte.gegenstandswert.toLocaleString("de-DE"));
    setAuftrag(akte.createdAt.slice(0, 10));
    toast("Werte übernommen", {
      text: `Gegenstandswert und Auftragsdatum aus Akte ${akte.aktenzeichen}`,
      ton: "info",
    });
    // Der Knopf verschwindet – Fokus auf „Als Rechnung für Akte erstellen“ (nicht BODY)
    window.setTimeout(() => (erstellenRef.current && !erstellenRef.current.disabled ? erstellenRef.current : document.getElementById("rvg-ergebnis-titel"))?.focus(), 30);
  };

  const alsRechnung = (trotzdem = false) => {
    if (!akte || !hatPositionen) return;
    const positionen = rvgRechnungsPositionen(erg.angelegenheiten);
    const gleich = rechnungen.find((x) => x.akteId === akte.id && x.status === "entwurf" && gleichePositionen(x.positionen, positionen));
    if (gleich && !trotzdem) return setDublette(gleich);
    setDublette(null);
    const [r] = erstelleRechnungen(
      [
        {
          akte,
          positionen,
          summen: { netto: erg.netto, ust: erg.ust, brutto: erg.brutto },
        },
      ],
      "auto",
      "entwurf",
      user.id,
    );
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
  // Grund, warum „Als Rechnung für Akte erstellen“ gesperrt ist – sichtbar unter dem Knopf (wie im Fristenrechner)
  const sperrGruende = [!gueltig ? "einen Gegenstandswert über 0 € eintragen" : "", !erg.zeilen.length ? "mindestens einen Gebührentatbestand wählen" : "", !akte ? "eine Akte wählen" : ""].filter(Boolean);
  const sperrGrund = sperrGruende.length ? `Erst ${sperrGruende.join(" und ")}` : "";

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid grid-cols-1 min-w-0 gap-4">
        {/* Sprungmarken für die Tastatur: ohne 29 Tab-Stopps zur Aktenwahl bzw. zum Ergebnis (I4-T07-02) */}
        <nav aria-label="Sprungmarken im RVG-Rechner" className="-mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
          <span>Springen zu:</span>
          <button type="button" className="link rounded-sm px-0.5 font-medium max-sm:min-h-11" onClick={() => document.getElementById("rvg-akte")?.focus()}>
            Aktenwahl
          </button>
          <button
            type="button"
            className="link rounded-sm px-0.5 font-medium max-sm:min-h-11"
            onClick={() => {
              const h = document.getElementById("rvg-ergebnis-titel");
              h?.focus({ preventScroll: true });
              document.getElementById("rvg-ergebnis")?.scrollIntoView({ block: "start" });
            }}
          >
            Ergebnis
          </button>
        </nav>
        <Card>
          <CardHeader
            title="Gegenstandswert und Auftrag"
            subtitle="Die Gebührentabelle richtet sich nach dem Tag der unbedingten Auftragserteilung (§ 60 RVG)."
          />
          {beispiel && (
            <div className="mb-4">
              <BeispielHinweis id="rvg-beispiel-hinweis" />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Gegenstandswert (€)" htmlFor="rvg-wert">
              <Input
                id="rvg-wert"
                inputMode="decimal"
                value={wertText}
                aria-invalid={wertFehler ? true : undefined}
                aria-describedby={[wertFehler ? "rvg-wert-fehler" : "", beispiel ? "rvg-beispiel-hinweis" : ""].filter(Boolean).join(" ") || undefined}
                onChange={(e) => {
                  eigen();
                  setWertText(e.target.value);
                }}
                onBlur={() => {
                  setBeruehrt(true);
                  if (gueltig) setWertText(wert.toLocaleString("de-DE", { maximumFractionDigits: 2 }));
                }}
                className="num !h-10 !text-[16px] font-medium"
              />
              {wertFehler && (
                <p id="rvg-wert-fehler" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-seal-text">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {wertFehler}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SCHNELL.map((v) => (
                  <button
                    key={v}
                    type="button"
                    // Schnellwahl für die Maus – per Tastatur tippt man den Wert (kein Tab-Stopp zwischen den Pflichtfeldern)
                    tabIndex={-1}
                    onClick={() => {
                      eigen();
                      setWertText(v.toLocaleString("de-DE"));
                    }}
                    className={cn("chip num cursor-pointer transition-colors duration-100", wert === v ? "chip-ink" : "chip-outline hover:bg-[var(--surface-2)]")}
                  >
                    {v.toLocaleString("de-DE")} €
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Auftrag erteilt am" htmlFor="rvg-auftrag">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-4" aria-hidden />
                <Input
                  id="rvg-auftrag"
                  type="date"
                  value={auftrag}
                  onChange={(e) => {
                    eigen();
                    setAuftrag(e.target.value);
                  }}
                  className="!h-10 !pl-9"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={fassung} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.schnell}>
                    <Chip tone={fassung === "2025" ? "ink" : "amber"} dot symbol={false}>
                      Tabelle {FASSUNG_LABEL[fassung]}
                    </Chip>
                  </motion.span>
                </AnimatePresence>
                <span className="text-[13px] text-fg-3">{fassung === "2025" ? "für Aufträge ab 01.06.2025" : "für Aufträge bis 31.05.2025 (Übergangsrecht)"}</span>
              </div>
            </Field>
          </div>
          <div className="banner mt-4">
            <Info aria-hidden />
            {gueltig ? (
              <span>
                Volle Gebühr (1,0) bei <span className="num font-semibold">{fmtEUR(wert)}</span>: <span className="num font-semibold text-fg">{fmtEUR(voll)}</span> – {tabelle.stand}.
              </span>
            ) : (
              <span>Die volle Gebühr (1,0) erscheint, sobald ein gültiger Gegenstandswert eingetragen ist – {tabelle.stand}.</span>
            )}
          </div>
        </Card>

        {/* Mobil/Tablet: Ergebnis bleibt beim Scrollen sichtbar – unten über der Tab-Leiste (bzw. am unteren Rand) statt oben
            über den Gebührenzeilen, in der Ebene der Tab-Leiste (außerhalb des Seiteninhalts). Der untere Innenabstand des Inhalts
            und scroll-padding-bottom halten Häkchen und Fokus darüber frei (I3-T07-02, WCAG 2.4.11). */}
        {createPortal(
          <button
            type="button"
            data-rvg-summe
            onClick={() => document.getElementById("rvg-ergebnis")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            aria-label={gueltig ? `Gesamt brutto ${fmtEUR(erg.brutto)}, ${erg.zeilen.length} ${erg.zeilen.length === 1 ? "Position" : "Positionen"}, RVG ${fassung} – zum Ergebnis` : "Noch kein Ergebnis – Gegenstandswert über 0 € eintragen – zum Ergebnis"}
            className="fixed bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)] left-3 right-[84px] z-30 flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-pop)] py-1.5 pl-4 pr-2 text-left shadow-pop md:bottom-5 md:left-auto md:right-24 md:w-[min(460px,calc(100vw-10rem))] xl:hidden"
          >
            {gueltig ? (
              <>
                <span className="min-w-0 flex-1 text-[13px] text-fg-3">
                  Gesamt brutto · {erg.zeilen.length} {erg.zeilen.length === 1 ? "Position" : "Positionen"}
                </span>
                <AnimatedNumber value={erg.brutto} format={(n) => fmtEUR(n)} className="text-[15px] font-semibold" />
              </>
            ) : (
              <span className="min-w-0 flex-1 text-[13px] text-fg-2">Noch kein Ergebnis – Gegenstandswert eintragen</span>
            )}
            <Chip tone={fassung === "2025" ? "ink" : "amber"}>RVG {fassung}</Chip>
          </button>,
          document.body,
        )}

        <Card>
          <CardHeader title="Gebührentatbestände" subtitle="Wählen Sie die angefallenen Gebühren; Rahmengebühren stellen Sie innerhalb des Rahmens ein." />
          <div className="grid grid-cols-1 gap-5">
            {PHASEN.map((ph) => {
              const liste = VV_KATALOG.filter((p) => anzeigePhase(p) === ph && p.nr !== "1008");
              return (
                <div key={ph}>
                  <div className="eyebrow mb-1.5">{ph}</div>
                  <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
                    {liste.map((p) => {
                      const s = pos[p.nr];
                      const ueberSchwelle = p.nr === "2300" && s.satz > 1.3;
                      return (
                        <li key={p.nr} className={cn("-mx-2 cursor-pointer rounded-sm px-2 py-3 transition-colors duration-100 hover:bg-[var(--surface-2)]", s.an && "shadow-[inset_2px_0_0_var(--ink)]")} onClick={() => toggle(p.nr)}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Checkbox checked={s.an} onChange={() => toggle(p.nr)} label={`Nr. ${p.nr} VV RVG wählen`} />
                            <span className="mono w-10 shrink-0 text-[13px] font-medium text-fg-2">{p.nr}</span>
                            <div className="min-w-0 flex-1 basis-[160px]">
                              <div className="text-[14px] font-medium">{p.titel}</div>
                              {p.rahmen && (
                                <div className="text-[13px] text-fg-3">
                                  Rahmen {fmtSatz(p.rahmen[0])} – {fmtSatz(p.rahmen[1])}
                                  {p.hinweis ? ` · ${p.hinweis}` : ""}
                                </div>
                              )}
                            </div>
                            {p.rahmen ? <SatzRegler p={p} satz={s.satz} onChange={(v) => setSatz(p.nr, v)} /> : <span className="num text-[13px] font-semibold text-fg-2">{fmtSatz(s.satz)}</span>}
                            <span className={cn("num w-[92px] shrink-0 text-right text-[13px]", s.an ? "font-semibold" : "text-fg-3")}>{gueltig ? fmtEUR(gebuehr(wert, s.satz, fassung)) : "–"}</span>
                          </div>
                          <AnimatePresence initial={false}>
                            {ueberSchwelle && s.an && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="banner banner-amber mt-2 !py-1.5 !text-[13px] !leading-[18px] text-amber-text">
                                  Über der Schwellengebühr von 1,3: nur bei umfangreicher oder schwieriger Tätigkeit – Begründung in der Akte vermerken.
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                    {ph === "Allgemein" && (
                      <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                        <Users className="size-4 text-fg-4" aria-hidden />
                        <span className="mono w-10 shrink-0 text-[13px] font-medium text-fg-2">1008</span>
                        <div className="min-w-0 flex-1 basis-[160px]">
                          <div className="text-[14px] font-medium">Anzahl Auftraggeber</div>
                          <div className="text-[13px] text-fg-3">Erhöht die Geschäfts- bzw. Verfahrensgebühr jeder Angelegenheit um 0,3 je weiterem Auftraggeber, höchstens 2,0</div>
                        </div>
                        <div className="flex items-center gap-1 rounded-md p-0.5 shadow-[inset_0_0_0_1px_var(--line-strong)]">
                          <button type="button" className="icon-btn !size-7" aria-label="Weniger Auftraggeber" disabled={auftraggeber <= 1} onClick={() => setAuftraggeber((n) => Math.max(1, n - 1))}>
                            <Minus className="size-3.5" />
                          </button>
                          <span className="num w-6 text-center text-[13px] font-semibold">{auftraggeber}</span>
                          <button type="button" className="icon-btn !size-7" aria-label="Mehr Auftraggeber" disabled={auftraggeber >= 30} onClick={() => setAuftraggeber((n) => Math.min(30, n + 1))}>
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className={cn("num w-[92px] shrink-0 text-right text-[13px]", erhoehung > 0 ? "font-semibold" : "text-fg-3")}>+{fmtSatz(erhoehung)}</span>
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
              {
                id: "rvg-7002",
                label: "Auslagenpauschale 7002",
                text: "20 % der Gebühren, höchstens 20,00 € je Angelegenheit.",
                v: pauschale,
                set: setPauschale,
                aus: false,
              },
              {
                id: "rvg-7008",
                label: "Umsatzsteuer 7008",
                text: "19 % auf Gebühren und Auslagen.",
                v: ust,
                set: setUst,
                aus: false,
              },
            ].map((o) => (
              <div key={o.id} className={cn("flex items-start gap-3", o.aus && "opacity-55")}>
                <div className="min-w-0 flex-1">
                  <label htmlFor={o.id} className="text-[14px] font-medium">
                    {o.label}
                  </label>
                  <p className="mt-0.5 text-[13px] leading-[18px] text-fg-3">{o.aus ? "Greift, wenn 2300 und 3100 gewählt sind." : o.text}</p>
                </div>
                <Switch id={o.id} checked={o.v} onChange={o.set} label={o.label} />
              </div>
            ))}
          </div>
        </Card>

        <Card padded={false}>
          <button type="button" onClick={() => setTabelleOffen((x) => !x)} aria-expanded={tabelleOffen} className="flex w-full items-center gap-3 rounded-lg px-5 py-4 text-left focus-visible:outline-offset-[-2px]">
            <Table2 className="size-4 shrink-0 text-fg-4" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="title-md">Gebührentabelle</div>
              <div className="text-[13px] text-fg-3">Prüfwerte der 1,0-Gebühr nach § 13 RVG – zur Kontrolle beider Fassungen.</div>
            </div>
            <ChevronDown className={cn("size-4 text-fg-4 transition-transform duration-150", tabelleOffen && "rotate-180")} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {tabelleOffen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={BEWEGUNG.standard}
                className="overflow-hidden"
              >
                <div className="overflow-x-auto px-5 pb-5">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Gegenstandswert</th>
                        <th className={cn("!text-right", fassung === "2025" && "!text-fg")}>KostBRÄG 2025</th>
                        <th className={cn("!text-right", fassung === "2021" && "!text-fg")}>KostRÄG 2021</th>
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
                            <tr key={w} data-selected={ist ? "true" : undefined}>
                              <td className="num font-medium">
                                {fmtEUR(w, { cents: w % 1 !== 0 })}
                                {ist && <span className="ml-2 text-[13px] font-normal text-fg-3">Ihre Eingabe</span>}
                              </td>
                              <td className={cn("num text-right", fassung === "2025" && "font-semibold")}>{fmtEUR(neu)}</td>
                              <td className={cn("num text-right", fassung === "2021" && "font-semibold")}>{fmtEUR(alt)}</td>
                              <td className="num text-right text-fg-3">+{((neu / alt - 1) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[13px] text-fg-3">
                    Rundung auf volle Cent (§ 2 Abs. 2 S. 2 RVG). Stand der Tabellen: {RVG_TABELLE.stand}; {RVG_TABELLE_2021.stand}.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <div id="rvg-ergebnis" className="scroll-mt-24 xl:sticky xl:top-7">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="rvg-ergebnis-titel" tabIndex={-1} className="title-md rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
                Ergebnis
              </h2>
              <div className="mt-1 text-[13px] text-fg-3">
                Gegenstandswert <span className="num font-medium text-fg-2">{gueltig ? fmtEUR(wert) : "–"}</span>
              </div>
            </div>
            <Chip tone={fassung === "2025" ? "ink" : "amber"}>RVG {fassung}</Chip>
          </div>

          {!gueltig ? (
            <div role="status" className="banner mt-4">
              <Info aria-hidden />
              <span>Das Ergebnis erscheint, sobald ein gültiger Gegenstandswert eingetragen ist.</span>
            </div>
          ) : (
          <>
          {/* Je Angelegenheit (§ 15 RVG): Gebühren, Anrechnung und eigene Auslagenpauschale */}
          <div className="mt-4 grid grid-cols-1 gap-3">
            {erg.angelegenheiten.map((a, i) => (
              <section key={a.key} aria-label={a.titel} className={cn(i > 0 && "border-t border-[var(--line)] pt-3")}>
                {erg.angelegenheiten.length > 1 && <div className="eyebrow mb-1">{a.titel}</div>}
                <ul className="grid grid-cols-1 gap-0.5">
                  <AnimatePresence initial={false}>
                    {a.zeilen.map((z) => (
                      <ErgebnisZeile key={z.nr} z={z} kurz={erg.angelegenheiten.length > 1} />
                    ))}
                    {pauschale && (
                      <ErgebnisZeile
                        key="7002"
                        z={{
                          nr: "7002",
                          titel: "Auslagenpauschale",
                          satz: 0,
                          gegenstandswert: 0,
                          betrag: a.auslagenpauschale,
                          angelegenheit: a.key,
                        }}
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
          <div className="mt-3 flex items-end justify-between border-t border-[var(--line)] pt-3">
            <span className="text-[14px] font-medium">Gesamtbetrag brutto</span>
            <AnimatedNumber value={erg.brutto} format={(n) => fmtEUR(n)} className="text-[28px] font-semibold leading-8 tracking-[-0.02em]" />
          </div>
          </>
          )}

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <Field label="Akte" htmlFor="rvg-akte">
              <Select id="rvg-akte" value={akteId} onChange={(e) => setAkteId(e.target.value)} aria-describedby={akteWeicht ? "rvg-uebernehmen" : undefined}>
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
                  <button id="rvg-uebernehmen" type="button" onClick={uebernehmen} className="link mt-2 rounded-sm text-left text-[13px] font-medium">
                    Werte der Akte übernehmen ({fmtEUR(akte!.gegenstandswert, { cents: false })}, Auftrag {fmtDate(akte!.createdAt.slice(0, 10))})
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <Button ref={erstellenRef} variant="primary" className="mt-3 w-full" icon={<FilePlus2 className="size-4" />} disabled={!akte || !hatPositionen} onClick={() => alsRechnung()} aria-describedby={sperrGrund ? "rvg-sperrgrund" : undefined}>
              Als Rechnung für Akte erstellen
            </Button>
            {sperrGrund && (
              <p id="rvg-sperrgrund" className="mt-2 flex items-start justify-center gap-1.5 text-center text-[13px] text-fg-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden />
                {sperrGrund}
              </p>
            )}
            <p className="mt-2 text-center text-[13px] text-fg-4">Wird als Entwurf angelegt – Sie prüfen und stellen die Rechnung anschließend.</p>
          </div>
        </Card>
      </div>
      <Modal
        open={!!dublette}
        onClose={() => setDublette(null)}
        title="Entwurf bereits vorhanden"
        icon={<FilePlus2 className="size-[18px]" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDublette(null)}>
              Abbrechen
            </Button>
            <Button variant="secondary" onClick={() => alsRechnung(true)}>
              Trotzdem neu anlegen
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const id = dublette?.id;
                setDublette(null);
                if (!id) return;
                onTab("rechnungen");
                oeffne(id);
              }}
            >
              Vorhandenen Entwurf öffnen
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-fg-2">
          Für <span className="mono font-medium text-fg">{akte?.aktenzeichen}</span> liegt bereits ein Entwurf mit denselben Positionen vor
          {dublette ? (
            <>
              {" "}
              (<span className="mono">{dublette.nummer}</span>, {fmtEUR(dublette.brutto)} brutto, angelegt am {fmtDate(dublette.createdAt.slice(0, 10))})
            </>
          ) : null}
          . Öffnen Sie ihn – oder legen Sie bewusst einen zweiten Entwurf an.
        </p>
      </Modal>
    </div>
  );
}

function ErgebnisZeile({ z, hinweis, kurz }: { z: RvgZeile; hinweis?: string; kurz?: boolean }) {
  // Unter einer Angelegenheits-Überschrift ist der Instanz-Zusatz („(1. Instanz)“) doppelt.
  const titel = z.anrechnung ? z.titel.replace(/ \([\d,]+\)$/, "") : kurz ? z.titel.replace(/ \((1\. Instanz|Berufung)\)$/, "") : z.titel;
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="flex items-baseline gap-2 py-1.5 text-[13px]">
      <span className={cn("mono w-[58px] shrink-0 text-[13px]", z.anrechnung ? "text-fg-2" : "text-fg-3")}>
        {z.anrechnung ? (z.nr.startsWith("Vorb.") ? "Vorb. 3" : z.nr) : z.nr}
        {z.erhoehung ? <span className="block text-[13px] leading-tight">+ 1008</span> : null}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", z.nr === "7002" && "text-fg-2")} title={z.erhoehung ? `${z.titel}, erhöht nach Nr. 1008 VV RVG um ${fmtSatz(z.erhoehung)}` : z.titel}>
        {titel}
        {z.erhoehung ? <span className="block truncate text-[13px] text-fg-3">erhöht um {fmtSatz(z.erhoehung)}</span> : null}
      </span>
      <span className="num shrink-0 text-[12px] text-fg-4">{hinweis ?? fmtSatz(Math.abs(z.satz))}</span>
      <span className="num w-[88px] shrink-0 text-right font-medium">{fmtEUR(z.betrag)}</span>
    </motion.li>
  );
}

function Zeile({ k, v, stark, leise }: { k: string; v: number; stark?: boolean; leise?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", leise && "text-fg-3", stark && "font-semibold")}>
      <span className={cn("min-w-0", !stark && !leise && "text-fg-2")}>{k}</span>
      <AnimatedNumber value={v} format={(n) => fmtEUR(n)} />
    </div>
  );
}

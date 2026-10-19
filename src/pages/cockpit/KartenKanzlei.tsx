import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowRightLeft, Calculator, ChevronRight, Clock, FolderPlus, Landmark, Search, Sparkles, TriangleAlert, UsersRound, Zap } from "lucide-react";
import { AiChip, AnimatedNumber, Button, Chip, ProgressRing, Sparkline } from "@/components/ui";
import { useUI } from "@/store/ui";
import { diffDays, fmtDateShort, fmtNum, relTime, wochentagName } from "@/core/dates";
import { istKritisch } from "@/core/fristenLage";
import { stufeWort } from "@/core/einschaetzung";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";
import { schlagwortAnzeige } from "@/pages/akten/helfer";
import { Abschnitt, ListenKarte } from "./Basis";
import { ARBEITSWOCHEN, WERT_PRO_STUNDE, ZIEL_STUNDEN, artLabel, euro, type CockpitDaten } from "./daten";

/** Aktualisiert relative Zeitangaben („vor 3 Min.") regelmäßig. */
function useJetzt(ms = 30000) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return jetzt;
}

// ───────────────────────── 38h-Motor ─────────────────────────
/** Nebeninformation ohne Karte: Leitzahl, Wert, Verlauf und die zuletzt erledigten Routinen (DESIGN-SYSTEM.md 12.14/12.15). */
export function MotorKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  const jetzt = useJetzt();
  const m = d.motor;
  const anteil = m.stunden / ZIEL_STUNDEN;
  const erreicht = anteil >= 1;
  return (
    <Abschnitt
      flach
      label="38h-Motor: gesparte Zeit in den letzten 7 Tagen – Beispielwerte (Demo)"
      className={className}
      titel="38h-Motor"
      unter={
        <>
          <span className="font-medium text-fg-2">Beispielwerte (Demo)</span> · letzte 7 Tage
        </>
      }
      mehr={{ to: "/automatisierung", label: "Details" }}
    >
      <div className="flex items-center gap-4">
        <ProgressRing value={anteil} size={48} stroke={4} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber value={m.stunden} format={(n) => fmtNum(n, 1)} className="text-[28px] font-semibold leading-8 tracking-[-0.02em] text-fg" />
            <span className="text-[13px] text-fg-3">von {ZIEL_STUNDEN} Std.</span>
          </div>
          {erreicht && <Chip tone="green" className="mt-1">Wochenziel erreicht</Chip>}
        </div>
      </div>
      <dl className="mt-4 grid gap-0.5">
        <dt className="text-[13px] text-fg-3">Wert der letzten 7 Tage</dt>
        <dd className="text-[15px] font-semibold text-fg">
          <AnimatedNumber value={m.euroWoche} format={(n) => euro(n)} />
        </dd>
        <dd className="text-[13px] text-fg-3">
          hochgerechnet <span className="num font-medium text-fg-2">≈ {euro(Math.round(m.euroJahr / 1000) * 1000)}</span> pro Jahr
        </dd>
      </dl>
      <div className="mt-4">
        <Sparkline values={m.tage} width={300} height={40} className="h-10 w-full" />
        <div className="mt-1 flex justify-between px-1 text-[12px] text-fg-4">
          {m.tagLabels.map((t, k) => (
            <span key={k} className={cn(k === m.tagLabels.length - 1 && "font-medium text-fg-2")}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-[18px] text-fg-3">
        Hochrechnung: Std. der letzten 7 Tage × {ARBEITSWOCHEN} Wochen × interner Kostensatz ({fmtNum(WERT_PRO_STUNDE, 2)} €/Std.) –{" "}
        <Link to="/automatisierung" className="link">
          So rechnen wir
        </Link>
      </p>
      <div className="mt-4 border-t border-[var(--line)] pt-3">
        <div className="mb-1 text-[12px] font-medium leading-4 text-fg-3">Zuletzt erledigt</div>
        {m.zuletzt.length === 0 && <p className="text-[13px] text-fg-3">Der Motor legt los, sobald Akten, Fristen und Post eingehen – jede erledigte Routine erscheint hier.</p>}
        <ul className="grid divide-y divide-[var(--line)]">
          <AnimatePresence initial={false} mode="popLayout">
            {m.zuletzt.map((a) => (
              <motion.li key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={BEWEGUNG.standard} className="flex items-start gap-2.5 py-2">
                <span className="mt-0.5 shrink-0 text-fg-4" role="img" aria-label={a.akteur === "ki" ? "KI" : "Automatik"}>
                  {a.akteur === "ki" ? <Sparkles className="size-3.5" /> : <Zap className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] leading-[18px] text-fg-2">{a.text}</span>
                  <span className="text-[12px] text-fg-4">{relTime(a.zeit, jetzt)}</span>
                </span>
                {a.minutenGespart ? <span className="num shrink-0 text-[13px] text-fg-3">+{a.minutenGespart} Min.</span> : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </Abschnitt>
  );
}

// ───────────────────────── Finanzen ─────────────────────────
export function FinanzenKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  const f = d.finanzen;
  const anteilUeber = f.offen > 0 ? f.ueberfaellig / f.offen : 0;
  // Rot nur für den Wert, der diese Bedeutung hat (überfällig) – alles andere in Text 1 (DESIGN-SYSTEM.md 12.15)
  const zeilen = [
    { label: "Offene Forderungen", wert: f.offen, sub: `${f.offenAnzahl} ${f.offenAnzahl === 1 ? "Rechnung" : "Rechnungen"} offen`, rot: false },
    { label: "Davon überfällig", wert: f.ueberfaellig, sub: `${f.ueberfaelligAnzahl} über dem Zahlungsziel`, rot: f.ueberfaellig > 0 },
    { label: "Fremdgeld zur Weiterleitung", wert: f.fremdgeld, sub: f.fremdgeldAkten ? `${f.fremdgeldAkten} ${f.fremdgeldAkten === 1 ? "Akte" : "Akten"} · § 43a Abs. 7 BRAO` : "Nichts offen · § 43a Abs. 7 BRAO", rot: false },
  ];
  return (
    <Abschnitt flach label="Finanzen: Forderungen und Fremdgeld" className={className} titel="Finanzen" unter="Forderungen, Fremdgeld, Bank" mehr={{ to: "/abrechnung", label: "Abrechnung" }}>
      {f.offen <= 0 ? (
        <p className="mb-3 text-[13px] text-fg-3">Keine offenen Forderungen – alle gestellten Rechnungen sind bezahlt.</p>
      ) : (
        <div className="mb-3">
          <div className="flex h-1 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            <span className="h-full rounded-full bg-[var(--seal)]" style={{ width: `${anteilUeber * 100}%` }} />
            <span className="h-full flex-1 rounded-full bg-[var(--chart-2)]" />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px] text-fg-3">
            <span>{Math.round(anteilUeber * 100)} % überfällig</span>
            <span>{Math.round((1 - anteilUeber) * 100)} % im Zahlungsziel</span>
          </div>
        </div>
      )}
      <ul className="grid divide-y divide-[var(--line)]">
        {zeilen.map((z) => (
          <li key={z.label} className="flex items-baseline gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-fg-2">{z.label}</span>
              <span className="block text-[12px] text-fg-4">{z.sub}</span>
            </span>
            <span className={cn("num shrink-0 text-[15px] font-semibold", z.rot ? "text-[var(--seal-text)]" : "text-fg")}>
              <AnimatedNumber value={z.wert} format={(n) => euro(n)} />
            </span>
          </li>
        ))}
      </ul>
      {f.aelteste.length > 0 && (
        <div className="mt-2 border-t border-[var(--line)] pt-3">
          <div className="mb-1 text-[12px] font-medium leading-4 text-fg-3">Am längsten überfällig</div>
          <ul className="flex flex-col">
            {f.aelteste.map((r) => {
              const a = d.akten.get(r.akteId);
              return (
                <li key={r.id}>
                  <Link to={`/akten/${r.akteId}`} className="-mx-1 flex min-h-8 items-center gap-2 rounded-sm px-1 text-[13px] transition-colors duration-100 hover:bg-[var(--surface-2)] max-sm:min-h-11">
                    <span className="mono shrink-0 text-fg-2">{r.nummer}</span>
                    <span className="min-w-0 flex-1 truncate text-fg-3">{a?.titel}</span>
                    <span className="shrink-0 text-[var(--seal-text)]" title={`seit ${r.tage} ${r.tage === 1 ? "Tag" : "Tagen"} überfällig`}>{r.tage}&nbsp;{r.tage === 1 ? "Tag" : "Tage"}</span>
                    <span className="num w-[68px] shrink-0 text-right font-medium text-fg">{euro(r.betrag)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Link to="/abrechnung?tab=bank" className="link-leise mt-3 min-h-8 self-start rounded-sm max-sm:min-h-11">
        <Landmark className="!size-4 text-fg-4" aria-hidden />
        <span>
          {f.bankOffen > 0 ? (
            <>
              <span className="font-semibold text-fg">{f.bankOffen} Bankumsätze</span> warten auf den Abgleich
            </>
          ) : (
            "Bankabgleich ist aktuell"
          )}
        </span>
        <ChevronRight aria-hidden />
      </Link>
    </Abschnitt>
  );
}

// ───────────────────────── KI-Empfehlung ─────────────────────────
/** KI-Kennzeichnung dezent: Wort „KI“ + Sparkles, keine Farbe, kein Schein (DESIGN-SYSTEM.md 12.19). */
export function KiKarte({ d, className }: { d: CockpitDaten; className?: string }) {
  const nav = useNavigate();
  const a = d.kiAkte;
  if (!a) return <StartKarte className={className} />;
  const analyse = a.kiAnalyse;
  const f = d.kiAkteFrist;
  const tage = f ? diffDays(d.heute, f.datum) : 0;
  const dringend = f ? istKritisch(f) || tage <= 2 : false;
  return (
    <Abschnitt flach label="KI-Empfehlung" className={className} titel="KI-Empfehlung" unter="Apex KI hat diese Akte vorbereitet" extra={<AiChip />}>
      <p className="text-[15px] font-semibold leading-[22px] text-fg">
        {analyse ? `Fallanalyse liegt vor: ${stufeWort(analyse.stufe, analyse.prozent)}` : "KI-Fallanalyse bereit: Erfolgsaussicht prüfen"}
      </p>
      <Link to={`/akten/${a.id}`} className="mt-1 block truncate rounded-sm text-[13px] text-fg-2 hover:text-fg">
        <span className="mono underline decoration-[var(--line-strong)] underline-offset-[3px]">{a.aktenzeichen}</span> · {a.titel}
      </Link>
      <p className="mt-2 line-clamp-3 text-[13px] leading-[18px] text-fg-3">{a.beschreibung}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Chip>{a.sachgebiet}</Chip>
        {a.schlagworte.slice(0, 3).map((s) => (
          <Chip key={s} tone="outline">
            {schlagwortAnzeige(s)}
          </Chip>
        ))}
      </div>
      {f && (
        <div className="mt-3 flex items-start gap-2 text-[13px] leading-[18px]">
          {dringend ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--seal)]" aria-hidden /> : <Clock className="mt-0.5 size-3.5 shrink-0 text-[var(--amber)]" aria-hidden />}
          <span className="min-w-0">
            <span className={cn("block font-medium", dringend ? "text-[var(--seal-text)]" : "text-fg")}>{f.titel}</span>
            <span className="block text-fg-3">
              {(() => {
                const l = artLabel(f);
                return l.charAt(0).toUpperCase() + l.slice(1);
              })()}{" "}
              {tage < 0 ? `seit ${-tage} ${tage === -1 ? "Tag" : "Tagen"} überfällig` : tage === 0 ? "endet heute" : `endet in ${tage} ${tage === 1 ? "Tag" : "Tagen"}`} · {wochentagName(f.datum)}, {fmtDateShort(f.datum)}
            </span>
          </span>
        </div>
      )}
      {!analyse && (
        <ul className="mt-3 grid gap-1 text-[13px] leading-[18px] text-fg-2">
          {["Einschätzung der Erfolgsaussicht – mit Begründung und Quellen", "Passende Präzedenzfälle aus der Fall-Datenbank", "Risiken, Gegenargumente und nächste Schritte"].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--fg-4)]" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <Button variant="ai" iconRight={<ArrowRight className="size-4" />} onClick={() => nav(`/ki?akte=${encodeURIComponent(a.id)}&start=1`)}>
          {analyse ? "Analyse öffnen" : "Fallanalyse starten"}
        </Button>
        <p className="mt-2 text-[12px] text-fg-4">Mit Präzedenzfällen aus der Fall-Datenbank · Sie entscheiden</p>
      </div>
    </Abschnitt>
  );
}

/** Für neue Kanzleien ohne Akten: die ersten drei Schritte. */
function StartKarte({ className }: { className?: string }) {
  const nav = useNavigate();
  const schritte = [
    { icon: <ArrowRightLeft className="size-4" />, t: "Daten übernehmen", s: "Akten, Kontakte und Fristen aus der bisherigen Software", to: "/umzug" },
    { icon: <FolderPlus className="size-4" />, t: "Erste Akte anlegen", s: "Mandat mit Beteiligten und Fristen", to: "/akten?neu=1" },
    { icon: <UsersRound className="size-4" />, t: "Team einladen", s: "Zugänge für Kolleginnen und Kollegen", to: "/einstellungen" },
  ];
  return (
    <Abschnitt label="Erste Schritte" className={className} titel="Erste Schritte" unter="In wenigen Minuten startklar">
      <ListenKarte>
        <ol className="grid divide-y divide-[var(--line)]">
          {schritte.map((x, k) => (
            <li key={x.t}>
              <button type="button" onClick={() => nav(x.to)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]">
                <span className="num w-4 shrink-0 text-[13px] font-semibold text-fg-3">{k + 1}</span>
                <span className="shrink-0 text-fg-4" aria-hidden>{x.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-fg">{x.t}</span>
                  <span className="block truncate text-[13px] text-fg-3">{x.s}</span>
                </span>
                <ChevronRight className="size-4 text-fg-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </ListenKarte>
    </Abschnitt>
  );
}

// ───────────────────────── Schnellaktionen ─────────────────────────
/** Zeile aus vier sekundären Knöpfen mit Symbol (und Kürzel, wo es eines gibt) statt großer Karten (DESIGN-SYSTEM.md 13). */
export function Schnellaktionen() {
  const nav = useNavigate();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const aktionen = [
    { key: "akte", label: "Neue Akte", hint: "Mandat anlegen", icon: <FolderPlus className="size-4" aria-hidden />, onClick: () => nav("/akten?neu=1") },
    { key: "frist", label: "Frist berechnen", hint: "Mit Rechenweg, § 222 ZPO", icon: <Calculator className="size-4" aria-hidden />, onClick: () => nav("/fristen?rechner=1"), kbd: "F" },
    { key: "ki", label: "Apex Assistent fragen", hint: "Sprechen oder schreiben", icon: <Sparkles className="size-4" aria-hidden />, onClick: () => useUI.getState().oeffneAssistent() },
    { key: "suche", label: "Suche", hint: "Akten, Fristen, Urteile", icon: <Search className="size-4" aria-hidden />, onClick: () => useUI.getState().setPalette(true), kbd: isMac ? "⌘K" : "Strg K" },
  ];
  return (
    <nav aria-label="Schnellaktionen" className="grid grid-cols-2 gap-2 @3xl:flex @3xl:flex-wrap">
      {aktionen.map((a) => (
        <Button key={a.key} variant="secondary" icon={a.icon} onClick={a.onClick} title={`${a.label} – ${a.hint}`} className="justify-start text-left">
          <span>{a.label}</span>
          <span className="sr-only"> – {a.hint}</span>
          {a.kbd && <span className="kbd ml-1 hidden @5xl:inline-grid" aria-hidden>{a.kbd}</span>}
        </Button>
      ))}
    </nav>
  );
}

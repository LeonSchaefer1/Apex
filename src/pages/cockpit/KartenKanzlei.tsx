import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowRightLeft, Calculator, FolderPlus, Landmark, ReceiptEuro, Rocket, Search, ShieldAlert, Sparkles, UsersRound, Wallet, Zap, AlarmClock } from "lucide-react";
import { AiChip, AnimatedNumber, Button, Chip, ProgressRing, Sparkline } from "@/components/ui";
import { useUI } from "@/store/ui";
import { diffDays, fmtDateShort, fmtNum, relTime, wochentagName } from "@/core/dates";
import { cn } from "@/lib/cn";
import { BentoKarte, KartenKopf } from "./Basis";
import { ZIEL_STUNDEN, euro, type CockpitDaten } from "./daten";

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
export function MotorKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
  const jetzt = useJetzt();
  const m = d.motor;
  const anteil = m.stunden / ZIEL_STUNDEN;
  const erreicht = anteil >= 1;
  return (
    <BentoKarte i={i} label="38h-Motor: gesparte Zeit diese Woche" className={className}>
      <KartenKopf icon={<Zap />} ton="green" titel="38h-Motor" unter="Automatisch erledigt · letzte 7 Tage" mehr={{ to: "/automatisierung", label: "Details" }} />
      <div className="relative z-[1] flex items-center gap-4">
        <ProgressRing value={anteil} size={104} stroke={9} color="var(--green)">
          <div className="text-center leading-none">
            <AnimatedNumber value={m.stunden} format={(n) => fmtNum(n, 1)} className="text-[24px] font-semibold tracking-[-0.03em]" />
            <div className="mt-1 text-[10.5px] font-medium text-fg-3">von {ZIEL_STUNDEN} Std.</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-fg-3">Wert dieser Woche</div>
          <div className="text-[24px] font-semibold leading-tight tracking-[-0.03em]">
            <AnimatedNumber value={m.euroWoche} format={(n) => euro(n)} />
          </div>
          <div className="mt-0.5 text-[12px] text-fg-3">
            hochgerechnet <span className="num font-semibold text-green">≈ {euro(Math.round(m.euroJahr / 1000) * 1000)}</span> pro Jahr
          </div>
          {erreicht && (
            <Chip tone="green" className="mt-2">
              Wochenziel erreicht
            </Chip>
          )}
        </div>
      </div>
      <div className="relative z-[1] mt-3">
        <Sparkline values={m.tage} width={300} height={46} color="var(--green)" className="h-[46px] w-full" />
        <div className="mt-0.5 flex justify-between px-1 text-[10px] font-medium text-fg-4">
          {m.tagLabels.map((t, k) => (
            <span key={k} className={cn(k === m.tagLabels.length - 1 && "text-fg-2")}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="relative z-[1] mt-3 border-t border-[var(--line)] pt-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60 [animation-duration:2.2s]" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--green)]" />
          </span>
          <span className="eyebrow !text-[10.5px]">Gerade erledigt</span>
        </div>
        {m.zuletzt.length === 0 && <p className="px-1 text-[12.5px] text-fg-3">Der Motor legt los, sobald Akten, Fristen und Post eingehen – jede erledigte Routine erscheint hier.</p>}
        <ul className="grid gap-1">
          <AnimatePresence initial={false} mode="popLayout">
            {m.zuletzt.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 460, damping: 34 }}
                className="flex items-start gap-2.5 rounded-[12px] px-1 py-1"
              >
                <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-[8px]", a.akteur === "ki" ? "bg-violet-soft text-violet" : "bg-green-soft text-green")}>
                  {a.akteur === "ki" ? <Sparkles className="size-3.5" /> : <Zap className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[12.5px] leading-snug text-fg-2">{a.text}</span>
                  <span className="text-[11px] text-fg-4">{relTime(a.zeit, jetzt)}</span>
                </span>
                {a.minutenGespart ? <span className="num shrink-0 text-[11.5px] font-semibold text-green">+{a.minutenGespart} Min.</span> : null}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </BentoKarte>
  );
}

// ───────────────────────── Finanzen ─────────────────────────
export function FinanzenKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
  const f = d.finanzen;
  const anteilUeber = f.offen > 0 ? f.ueberfaellig / f.offen : 0;
  const zeilen = [
    { icon: <ReceiptEuro className="size-4" />, ton: "ink", label: "Offene Forderungen", wert: f.offen, sub: `${f.offenAnzahl} ${f.offenAnzahl === 1 ? "Rechnung" : "Rechnungen"} gestellt` },
    { icon: <AlarmClock className="size-4" />, ton: "seal", label: "Davon überfällig", wert: f.ueberfaellig, sub: `${f.ueberfaelligAnzahl} über dem Zahlungsziel` },
    { icon: <Wallet className="size-4" />, ton: "amber", label: "Fremdgeld zur Weiterleitung", wert: f.fremdgeld, sub: f.fremdgeldAkten ? `${f.fremdgeldAkten} ${f.fremdgeldAkten === 1 ? "Akte" : "Akten"} · § 43a Abs. 7 BRAO` : "Nichts offen · § 43a Abs. 7 BRAO" },
  ] as const;
  const kachel = { ink: "bg-ink-soft text-ink", seal: "bg-seal-soft text-seal", amber: "bg-amber-soft text-amber" } as const;
  const wertTon = { ink: "text-fg", seal: "text-seal", amber: "text-amber" } as const;
  return (
    <BentoKarte i={i} label="Finanzen: Forderungen und Fremdgeld" className={className}>
      <KartenKopf icon={<ReceiptEuro />} titel="Finanzen" unter="Forderungen, Fremdgeld, Bank" mehr={{ to: "/abrechnung", label: "Abrechnung" }} />
      {f.offen <= 0 ? (
        <p className="relative z-[1] mb-3 rounded-[12px] bg-green-soft px-3 py-2 text-[12.5px] text-fg-2">Keine offenen Forderungen – alle gestellten Rechnungen sind bezahlt.</p>
      ) : (
      <div className="relative z-[1] mb-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <motion.span className="h-full bg-seal" initial={{ width: 0 }} animate={{ width: `${anteilUeber * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }} />
          <motion.span className="h-full bg-ink" initial={{ width: 0 }} animate={{ width: `${(1 - anteilUeber) * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-fg-4">
          <span>{Math.round(anteilUeber * 100)} % überfällig</span>
          <span>{Math.round((1 - anteilUeber) * 100)} % im Zahlungsziel</span>
        </div>
      </div>
      )}
      <ul className="relative z-[1] grid gap-1">
        {zeilen.map((z) => (
          <li key={z.label} className="flex items-center gap-3 rounded-[14px] px-1 py-1.5">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", kachel[z.ton])}>{z.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-fg-2">{z.label}</span>
              <span className="block truncate text-[11.5px] text-fg-4">{z.sub}</span>
            </span>
            <span className={cn("num shrink-0 text-[15px] font-semibold tracking-[-0.01em]", wertTon[z.ton])}>
              <AnimatedNumber value={z.wert} format={(n) => euro(n)} />
            </span>
          </li>
        ))}
      </ul>
      {f.aelteste.length > 0 && (
        <div className="relative z-[1] mt-2 border-t border-[var(--line)] pt-2.5">
          <div className="eyebrow mb-1 px-1 !text-[10.5px]">Am längsten offen</div>
          <ul className="flex flex-col">
            {f.aelteste.map((r) => {
              const a = d.akten.get(r.akteId);
              return (
                <li key={r.id}>
                  <Link to={`/akten/${r.akteId}`} className="flex items-center gap-2 rounded-[10px] px-1 py-1 text-[12.5px] transition-colors hover:bg-ink-softer">
                    <span className="mono shrink-0 text-fg-2">{r.nummer}</span>
                    <span className="min-w-0 flex-1 truncate text-fg-4">{a?.titel}</span>
                    <span className="shrink-0 font-medium text-seal">{r.tage} T.</span>
                    <span className="num w-[68px] shrink-0 text-right font-semibold">{euro(r.betrag)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="min-h-3 flex-1" />
      <Link
        to="/abrechnung?tab=bank"
        className="relative z-[1] flex items-center gap-2.5 rounded-[14px] bg-[var(--ink-softer)] px-3 py-2.5 text-[12.5px] transition-colors hover:bg-ink-soft"
      >
        <Landmark className="size-4 text-ink" />
        <span className="flex-1 text-fg-2">
          {f.bankOffen > 0 ? (
            <>
              <span className="font-semibold text-fg">{f.bankOffen} Bankumsätze</span> warten auf den Abgleich
            </>
          ) : (
            "Bankabgleich ist aktuell"
          )}
        </span>
        <ArrowRight className="size-4 text-fg-4" />
      </Link>
    </BentoKarte>
  );
}

// ───────────────────────── KI-Empfehlung ─────────────────────────
export function KiKarte({ d, i, className }: { d: CockpitDaten; i: number; className?: string }) {
  const nav = useNavigate();
  const a = d.kiAkte;
  if (!a) return <StartKarte i={i} className={className} />;
  const analyse = a.kiAnalyse;
  const f = d.kiAkteFrist;
  const tage = f ? diffDays(d.heute, f.datum) : 0;
  return (
    <BentoKarte i={i} ai label="KI-Empfehlung" className={cn("overflow-hidden", className)}>
      <div aria-hidden className="ai-fill pointer-events-none absolute -bottom-24 -right-16 size-56 rounded-full opacity-[0.16] blur-3xl" />
      <header className="relative z-[1] mb-3 flex items-center gap-3">
        <span className="ai-fill grid size-9 shrink-0 place-items-center rounded-[12px] text-white shadow-[0_6px_16px_-6px_var(--ai-2)]">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="title-md">KI-Empfehlung</h2>
          <div className="mt-0.5 truncate text-[12.5px] text-fg-3">Apex KI hat diese Akte vorbereitet</div>
        </div>
        <AiChip />
      </header>
      <div className="relative z-[1] flex flex-1 flex-col">
        <p className="text-[16px] font-semibold leading-snug tracking-[-0.015em]">
          {analyse ? `Fallanalyse liegt vor: Erfolgsaussicht ${analyse.prozent} %` : "KI-Fallanalyse bereit: Erfolgsaussicht prüfen"}
        </p>
        <Link to={`/akten/${a.id}`} className="mt-1.5 block truncate text-[13px] text-fg-2 hover:text-ink">
          <span className="mono font-semibold text-ink">{a.aktenzeichen}</span> · {a.titel}
        </Link>
        <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-fg-3">{a.beschreibung}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip tone="violet" className="!h-[20px] !text-[10.5px]">
            {a.sachgebiet}
          </Chip>
          {a.schlagworte.slice(0, 3).map((s) => (
            <Chip key={s} tone="outline" className="!h-[20px] !text-[10.5px] capitalize">
              {s}
            </Chip>
          ))}
        </div>
        {f && (
          <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-seal-soft px-2.5 py-2 text-[12px] text-seal">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="block font-semibold">{f.titel}</span>
              <span className="block opacity-85">
                {f.typ === "notfrist" ? "Notfrist" : "Frist"} {tage <= 0 ? "endet heute" : `endet in ${tage} ${tage === 1 ? "Tag" : "Tagen"}`} · {wochentagName(f.datum)}, {fmtDateShort(f.datum)}
              </span>
            </span>
          </div>
        )}
        {!analyse && (
          <ul className="mt-3 grid gap-1.5 text-[12.5px] text-fg-2">
            {["Erfolgsaussicht in Prozent – mit Begründung", "Passende Präzedenzfälle von BAG bis Amtsgericht", "Risiken, Gegenargumente und nächste Schritte"].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-[5px] size-1.5 shrink-0 rounded-full ai-fill" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-4">
          <Button variant="ai" className="w-full" icon={<Sparkles className="size-4" />} iconRight={<ArrowRight className="size-4" />} onClick={() => nav(`/ki?akte=${encodeURIComponent(a.id)}&start=1`)}>
            {analyse ? "Analyse öffnen" : "Fallanalyse starten"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-fg-4">Mit Präzedenzfällen aus der Fall-Datenbank · Sie entscheiden</p>
        </div>
      </div>
    </BentoKarte>
  );
}

/** Für neue Kanzleien ohne Akten: die ersten drei Schritte. */
function StartKarte({ i, className }: { i: number; className?: string }) {
  const nav = useNavigate();
  const schritte = [
    { icon: <ArrowRightLeft className="size-4" />, t: "Daten übernehmen", s: "Akten, Kontakte und Fristen aus der bisherigen Software", to: "/umzug" },
    { icon: <FolderPlus className="size-4" />, t: "Erste Akte anlegen", s: "Mandat mit Beteiligten und Fristen", to: "/akten?neu=1" },
    { icon: <UsersRound className="size-4" />, t: "Team einladen", s: "Zugänge für Kolleginnen und Kollegen", to: "/einstellungen" },
  ];
  return (
    <BentoKarte i={i} label="Erste Schritte" className={className}>
      <KartenKopf icon={<Rocket />} titel="Erste Schritte" unter="In wenigen Minuten startklar" />
      <ol className="relative z-[1] grid gap-1.5">
        {schritte.map((x, k) => (
          <li key={x.t}>
            <button type="button" onClick={() => nav(x.to)} className="group flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-ink-softer">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink">
                {x.icon}
                <span className="num absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-ink text-[9px] font-bold text-[var(--on-ink)]">{k + 1}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold group-hover:text-ink">{x.t}</span>
                <span className="block truncate text-[12px] text-fg-3">{x.s}</span>
              </span>
              <ArrowRight className="size-4 text-fg-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ol>
    </BentoKarte>
  );
}

// ───────────────────────── Schnellaktionen ─────────────────────────
export function Schnellaktionen() {
  const nav = useNavigate();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const aktionen = [
    { key: "akte", label: "Neue Akte", hint: "Mandat anlegen", icon: <FolderPlus className="size-[18px]" />, onClick: () => nav("/akten?neu=1") },
    { key: "frist", label: "Frist berechnen", hint: "Mit Rechenweg, § 222 ZPO", icon: <Calculator className="size-[18px]" />, onClick: () => nav("/fristen?rechner=1") },
    { key: "ki", label: "Apex Assistent fragen", hint: "Sprechen oder schreiben", icon: <Sparkles className="size-[18px]" />, onClick: () => useUI.getState().oeffneAssistent(), ai: true },
    { key: "suche", label: "Suche", hint: "Akten, Fristen, Urteile", icon: <Search className="size-[18px]" />, onClick: () => useUI.getState().setPalette(true), kbd: isMac ? "⌘K" : "Strg K" },
  ];
  return (
    <nav aria-label="Schnellaktionen" className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 @2xl:mx-0 @2xl:grid @2xl:grid-cols-2 @2xl:overflow-visible @2xl:px-0 @2xl:pb-0 @4xl:grid-cols-4">
      {aktionen.map((a, k) => (
        <motion.button
          key={a.key}
          type="button"
          onClick={a.onClick}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 34, delay: 0.08 + k * 0.04 }}
          whileTap={{ scale: 0.97 }}
          className="glass-thin glow group relative flex min-w-[210px] shrink-0 snap-start items-center gap-3 rounded-[18px] p-3 text-left transition-[transform,box-shadow] duration-300 ease-[var(--spring)] hover:-translate-y-0.5 hover:shadow-glass @2xl:min-w-0"
        >
          <span className={cn("relative z-[1] grid size-9 shrink-0 place-items-center rounded-[11px]", a.ai ? "ai-fill text-white shadow-[0_6px_14px_-6px_var(--ai-2)]" : "bg-ink-soft text-ink")}>{a.icon}</span>
          <span className="relative z-[1] min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{a.label}</span>
            <span className="block truncate text-[11.5px] text-fg-3">{a.hint}</span>
          </span>
          {a.kbd && <span className="kbd relative z-[1] hidden !text-[10.5px] @5xl:inline-grid">{a.kbd}</span>}
        </motion.button>
      ))}
    </nav>
  );
}

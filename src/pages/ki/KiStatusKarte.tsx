import { useMemo } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { BookCheck, Calculator, Clock, Cpu, ShieldCheck, Sparkles, UserCheck, Zap } from "lucide-react";
import { DEMO_KI_NAME, useAiStatus, type KiQuelle } from "@/ai/status";
import { useData } from "@/store/data";
import { addDays, fmtNum, today } from "@/core/dates";
import { AnimatedNumber, Chip, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { brauchtKontrolle, unterliegtKontrolle } from "@/pages/fristen/logik";

/** Datenfluss je KI-Quelle – nur im Offline-/Demo-Betrieb bleiben die Inhalte ohne KI-Anbieter. */
const DATENFLUSS: Record<KiQuelle, string> = {
  demo: "Demo-KI: keine Daten an einen KI-Anbieter",
  server: "Verarbeitung über die Anthropic-API – nur aufgabenbezogen",
  artefakt: "Verarbeitung durch Claude (Anthropic) in der Vorschau",
};

function grundsaetze(quelle: KiQuelle) {
  return [
    { icon: <Calculator className="size-4" />, text: "Die KI erkennt – der Fristenrechner berechnet" },
    { icon: <BookCheck className="size-4" />, text: "Präzedenzfälle nur aus der Fall-Datenbank" },
    { icon: <ShieldCheck className="size-4" />, text: DATENFLUSS[quelle] },
  ];
}

/** Status der KI: woher die Antworten kommen (Claude live oder Demo-KI), Modell, Grundsätze und Wirkung. */
export function KiStatusKarte() {
  const { quelle, modell, verfuegbar, bevorzugeDemo, setBevorzugeDemo } = useAiStatus();
  const live = quelle !== "demo";
  const liveMoeglich = verfuegbar.some((v) => v !== "demo");
  const aktivitaeten = useData((s) => s.data.aktivitaeten);
  const fristen = useData((s) => s.data.fristen);

  const kennzahlen = useMemo(() => {
    // letzte 7 Tage einschließlich heute – wie Apex Island, Cockpit und 38h-Motor
    const ab = addDays(today(), -6);
    const ki = aktivitaeten.filter((a) => a.akteur === "ki" && a.zeit.slice(0, 10) >= ab);
    const minuten = ki.reduce((s, a) => s + (a.minutenGespart ?? 0), 0);
    // KI-Fristen mit Kontrollpflicht (Notfristen und Fristen): bestätigt bzw. Vier-Augen-Kontrolle offen –
    // „offen“ ist dieselbe Zahl wie „davon … von der KI erkannt“ in der Fristen-Kachel „Vier-Augen-Kontrolle offen“.
    const kiFristen = fristen.filter((f) => f.quelle === "ki" && unterliegtKontrolle(f));
    const kontrolliert = kiFristen.filter((f) => f.kontrolliertVon).length;
    const offen = kiFristen.filter(brauchtKontrolle).length;
    return { vorgaenge: ki.length, stunden: minuten / 60, kiFristen: kontrolliert + offen, kontrolliert, offen };
  }, [aktivitaeten, fristen]);

  const quelleText = quelle === "server" ? "über Ihren Kanzlei-Server" : quelle === "artefakt" ? "über die gesicherte Vorschau-Laufzeit" : "";
  const datenText =
    quelle === "server"
      ? "Dafür sendet der Kanzlei-Server die für die Aufgabe nötigen Akteninhalte an die Anthropic-API – das setzt einen Vertrag nach § 43e BRAO und eine Auftragsverarbeitung nach Art. 28 DSGVO voraus."
      : "Dafür gehen die für die Aufgabe nötigen Inhalte an Claude (Anthropic) – in der Vorschau nur mit Beispieldaten arbeiten.";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32, delay: 0.05 }}
      className="glass-strong glow relative overflow-hidden rounded-[28px] p-5 sm:p-6"
      style={{ boxShadow: "var(--glass-shadow-lg)" }}
    >
      {/* sanfter KI-Schimmer im Hintergrund */}
      <div aria-hidden className="ai-fill pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-[0.13] blur-3xl" />
      <div className="relative z-[2] grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="ai-fill grid size-11 shrink-0 place-items-center rounded-[14px] text-white shadow-[0_10px_24px_-10px_var(--ai-2)]">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="title-md">KI-Status</span>
                {live ? (
                  <span className="chip ai-ring !bg-transparent">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-[var(--green)]" />
                    </span>
                    <span className="ai-text font-semibold">Claude live</span>
                  </span>
                ) : (
                  <Chip tone="amber" dot>
                    {DEMO_KI_NAME}
                  </Chip>
                )}
                {live && (
                  <span className="mono inline-flex items-center gap-1 text-[12.5px] text-fg-3">
                    <Cpu className="size-3.5" />
                    {modell ?? "Claude"}
                  </span>
                )}
              </div>
              <p className="mt-1 hidden max-w-[72ch] text-[13px] leading-snug text-fg-3 sm:block">
                {live
                  ? `Claude liest und formuliert ${quelleText}. ${datenText} Fristen berechnet weiterhin der Fristenrechner, Präzedenzfälle stammen ausschließlich aus der Fall-Datenbank.`
                  : "Die Demo-KI arbeitet regelbasiert und vollständig in Ihrem Browser – ideal zum Ausprobieren. Mit Claude-Anbindung formuliert die KI frei; geprüft und berechnet wird weiterhin nach festen Regeln."}
              </p>
            </div>
          </div>

          {/* Telefon: untereinander statt Wischleiste – der Datenhinweis ist ohne Wischen sichtbar (I3-T06-01) */}
          <ul className="mt-4 grid gap-1.5 sm:flex sm:flex-wrap sm:gap-2" aria-label="Grundsätze der KI">
            {grundsaetze(quelle).map((g, i) => (
              <motion.li
                key={g.text}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 420, damping: 32 }}
                className="flex min-w-0 items-center gap-2 rounded-[14px] bg-[var(--ink-softer)] py-1.5 pl-2 pr-3 text-[12.5px] font-medium text-fg-2 ring-1 ring-[var(--line)] sm:inline-flex sm:shrink-0 sm:whitespace-nowrap sm:rounded-full"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-ink [&>svg]:size-3.5">{g.icon}</span>
                <span className="min-w-0">{g.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Kennzahl icon={<Zap className="size-3.5" />} label="KI-Vorgänge" sub="letzte 7 Tage" wert={<AnimatedNumber value={kennzahlen.vorgaenge} />} />
            <Kennzahl
              icon={<Clock className="size-3.5" />}
              label="KI gespart"
              sub={
                <Chip tone="amber" className="!h-5 !px-1.5" title="Beispielwerte aus den Demodaten – im Echtbetrieb zählt AnwaltApex Ihre eigenen Vorgänge">
                  Beispielwerte
                </Chip>
              }
              title="So rechnen wir: je Vorgangsart fester Minutenwert, je Akte und Vorgang nur einmal gezählt (letzte 7 Tage)"
              wert={<AnimatedNumber value={kennzahlen.stunden} format={(n) => `${fmtNum(n, 1)} Std.`} />}
            />
            <Kennzahl
              icon={<UserCheck className="size-3.5" />}
              label="Geprüft"
              sub={
                <>
                  KI-Fristen{kennzahlen.offen ? <span className="hidden min-[480px]:inline"> · {kennzahlen.offen} offen</span> : null}
                </>
              }
              to={kennzahlen.offen ? "/fristen?filter=kontrolle&quelle=ki" : undefined}
              title={kennzahlen.offen ? `${kennzahlen.offen} von der KI erkannte ${kennzahlen.offen === 1 ? "Frist wartet" : "Fristen warten"} auf die Vier-Augen-Kontrolle – anzeigen` : "Alle von der KI erkannten Fristen sind kontrolliert"}
              wert={
                <span className="num">
                  <AnimatedNumber value={kennzahlen.kontrolliert} />
                  <span className="text-fg-3">/{kennzahlen.kiFristen}</span>
                </span>
              }
            />
          </div>
          <p className="flex max-w-[440px] items-start gap-1.5 text-[12.5px] leading-snug text-fg-3">
            <Clock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-medium text-fg-2">So rechnen wir:</span> je Vorgangsart fester Minutenwert, je Akte und Vorgang nur einmal gezählt · letzte 7 Tage.
            </span>
          </p>
          {liveMoeglich && (
            <label className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px] text-fg-2">
              <span>{DEMO_KI_NAME} verwenden</span>
              <Switch checked={bevorzugeDemo} onChange={setBevorzugeDemo} label={`${DEMO_KI_NAME} verwenden`} />
            </label>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function Kennzahl({ icon, label, sub, wert, to, title }: { icon: React.ReactNode; label: string; sub: React.ReactNode; wert: React.ReactNode; to?: string; title?: string }) {
  const inhalt = (
    <>
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg-3">
        <span className="hidden text-violet min-[400px]:inline">{icon}</span>
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em]">{wert}</div>
      <div className="mt-1 text-[12.5px] leading-snug text-fg-3">{sub}</div>
    </>
  );
  const klasse = "block min-w-0 rounded-[16px] bg-[var(--surface)]/70 px-3 py-2.5 ring-1 ring-[var(--line)] lg:w-[140px]";
  return to ? (
    <Link to={to} title={title} className={cn(klasse, "transition-colors hover:bg-ink-softer hover:ring-[var(--line-strong)]")}>
      {inhalt}
    </Link>
  ) : (
    <div className={klasse} title={title}>
      {inhalt}
    </div>
  );
}

import { useMemo } from "react";
import { Link } from "react-router";
import { BookCheck, Calculator, Clock, Cpu, ShieldCheck, UserCheck, Zap } from "lucide-react";
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
    <section aria-label="KI-Status" className="sheet rounded-lg p-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="title-md">KI-Status</h2>
            {live ? (
              <Chip tone="green">Claude live</Chip>
            ) : (
              <Chip tone="amber" dot symbol={false}>
                {DEMO_KI_NAME}
              </Chip>
            )}
            {live && (
              <span className="mono inline-flex items-center gap-1 text-[13px] text-fg-3">
                <Cpu className="size-3.5 text-fg-4" aria-hidden />
                {modell ?? "Claude"}
              </span>
            )}
          </div>
          <p className="mt-1 hidden max-w-[72ch] text-[14px] leading-5 text-fg-3 sm:block">
            {live
              ? `Claude liest und formuliert ${quelleText}. ${datenText} Fristen berechnet weiterhin der Fristenrechner, Präzedenzfälle stammen ausschließlich aus der Fall-Datenbank.`
              : "Die Demo-KI arbeitet regelbasiert und vollständig in Ihrem Browser – ideal zum Ausprobieren. Mit Claude-Anbindung formuliert die KI frei; geprüft und berechnet wird weiterhin nach festen Regeln."}
          </p>

          {/* Grundsätze als ruhige Zeile mit Symbolen 14 px – am Telefon untereinander, ohne Wischen sichtbar (I3-T06-01) */}
          <ul className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2" aria-label="Grundsätze der KI">
            {grundsaetze(quelle).map((g) => (
              <li key={g.text} className="flex min-w-0 items-start gap-2 text-[13px] leading-[18px] text-fg-2">
                <span className="mt-0.5 shrink-0 text-fg-4 [&>svg]:size-3.5" aria-hidden>
                  {g.icon}
                </span>
                <span className="min-w-0">{g.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 lg:w-[440px]">
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-y border-[var(--line)] lg:border-y-0">
            <Kennzahl icon={<Zap className="size-3.5" />} label="KI-Vorgänge" sub="letzte 7 Tage" wert={<AnimatedNumber value={kennzahlen.vorgaenge} />} />
            <Kennzahl
              icon={<Clock className="size-3.5" />}
              label="KI gespart"
              sub={
                <Chip tone="outline" className="!h-5 !px-1.5" title="Beispielwerte aus den Demodaten – im Echtbetrieb zählt Apex Ihre eigenen Vorgänge">
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
                  <span className="text-fg-4">/{kennzahlen.kiFristen}</span>
                </span>
              }
            />
          </div>
          <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-fg-4">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-medium text-fg-3">So rechnen wir:</span> je Vorgangsart fester Minutenwert, je Akte und Vorgang nur einmal gezählt · letzte 7 Tage.
            </span>
          </p>
          {liveMoeglich && (
            <label className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3 text-[14px] text-fg-2">
              <span>{DEMO_KI_NAME} verwenden</span>
              <Switch checked={bevorzugeDemo} onChange={setBevorzugeDemo} label={`${DEMO_KI_NAME} verwenden`} />
            </label>
          )}
        </div>
      </div>
    </section>
  );
}

function Kennzahl({ icon, label, sub, wert, to, title }: { icon: React.ReactNode; label: string; sub: React.ReactNode; wert: React.ReactNode; to?: string; title?: string }) {
  const inhalt = (
    <>
      <div className="flex items-center gap-1.5 text-[13px] leading-[18px] text-fg-3">
        <span className="hidden text-fg-4 min-[400px]:inline" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="num mt-1.5 text-[20px] font-semibold leading-6 tracking-[-0.02em]">{wert}</div>
      <div className="mt-1 text-[13px] leading-[18px] text-fg-4">{sub}</div>
    </>
  );
  // Kennzahlen nebeneinander, getrennt durch 1-px-Linien – ohne eigene Kachel
  const klasse = "block min-w-0 px-3 py-3 first:pl-0 lg:py-0";
  return to ? (
    <Link to={to} title={title} className={cn(klasse, "rounded-sm transition-colors duration-100 hover:text-fg [&:hover_.num]:underline focus-visible:outline-offset-[-2px]")}>
      {inhalt}
    </Link>
  ) : (
    <div className={klasse} title={title}>
      {inhalt}
    </div>
  );
}

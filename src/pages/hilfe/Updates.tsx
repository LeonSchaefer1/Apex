import { useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, Check, FlaskConical, GitBranch, Rocket, ShieldCheck, Undo2, Users } from "lucide-react";
import { getInfo } from "@/lib/backend";
import { fmtDate, fmtNum } from "@/core/dates";
import { toast } from "@/store/ui";
import { useKanzlei } from "@/store/session";
import { Card, Chip, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Version {
  version: string;
  datum: string;
  tests: number;
  notizen: string[];
}

const VERSIONEN: Version[] = [
  {
    version: "0.9.0", datum: "2026-10-06", tests: 1248,
    notizen: ["Umzug mit Dublettenprüfung und Rückgängig-Funktion", "Systemstatus mit 90-Tage-Verlauf je Schnittstelle", "Fristenrechner: Feiertage 2027 für alle Bundesländer hinterlegt"],
  },
  {
    version: "0.8.4", datum: "2026-09-22", tests: 1231,
    notizen: ["eEB-Abgabe erst, nachdem die Frist notiert ist", "Bankabgleich: Import von CAMT.053-Dateien beschleunigt"],
  },
  {
    version: "0.8.2", datum: "2026-09-08", tests: 1214,
    notizen: ["RVG-Tabelle nach KostBRÄG 2025 für Aufträge ab 01.06.2025 (§ 60 RVG)", "E-Akte: Dokumente per Doppelklick umbenennen"],
  },
  {
    version: "0.8.0", datum: "2026-08-18", tests: 1187,
    notizen: ["Apex Assistent mit Spracheingabe", "Sammelabrechnung als PDF, XRechnung und ZUGFeRD"],
  },
];

const STUFEN = [
  { icon: <GitBranch className="size-4" />, titel: "Entwicklung", text: "Jede Änderung von einer zweiten Person gegengelesen" },
  { icon: <FlaskConical className="size-4" />, titel: "Testumgebung", text: "Probelauf mit anonymisierten Kanzlei-Datenbeständen" },
  { icon: <ShieldCheck className="size-4" />, titel: "Automatische Prüfungen", text: "Fristen, RVG, Zinsen und beA-Abläufe bei jeder Version erneut geprüft" },
  { icon: <Users className="size-4" />, titel: "Pilotkanzleien", text: "Erst im Alltag einiger Kanzleien, dann für alle" },
  { icon: <Rocket className="size-4" />, titel: "Ihre Freigabe", text: "Sie bestimmen den Zeitpunkt – mit Rückkehr zur Vorversion" },
];

type Zeitpunkt = "manuell" | "nachts" | "wochenende";
const ZEIT_TEXT: Record<Zeitpunkt, string> = { manuell: "Sie spielen Updates selbst per Klick ein.", nachts: "Updates werden nachts um 02:00 Uhr eingespielt.", wochenende: "Updates werden samstags um 08:00 Uhr eingespielt." };

function ladeZeitpunkt(): Zeitpunkt {
  try {
    const v = localStorage.getItem("aa:update-zeitpunkt");
    return v === "nachts" || v === "wochenende" ? v : "manuell";
  } catch {
    return "manuell";
  }
}

/** Geprüfte Updates: jede Version durchläuft eine Testumgebung und automatische Prüfungen – eingespielt wird, wann Sie wollen. */
export function GepruefteUpdates() {
  const installiert = getInfo()?.version ?? VERSIONEN[0].version;
  const [zeitpunkt, setZeitpunkt] = useState<Zeitpunkt>(ladeZeitpunkt);
  const ap = useKanzlei().tenant.ansprechpartner;

  return (
    <section>
      <div className="mb-4">
        <h2 className="title-lg">Geprüfte Updates</h2>
        <p className="mt-1 text-[13px] text-fg-3">Keine Überraschungen nach dem Update: Jede Version wird vorab getestet – und Updates spielen Sie ein, wann Sie wollen.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <ol className="relative">
            {VERSIONEN.map((v, i) => {
              const aktuell = v.version === installiert;
              return (
                <motion.li
                  key={v.version}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, delay: i * 0.05 }}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  {i < VERSIONEN.length - 1 && <span className="absolute bottom-0 left-[15px] top-9 w-[2px] rounded-full bg-[var(--line)]" aria-hidden />}
                  <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", aktuell ? "bg-ink text-[var(--on-ink)]" : "bg-[var(--ink-softer)] text-fg-3 ring-1 ring-[var(--line)]")}>
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-[15px] font-semibold">Version {v.version}</span>
                      <span className="text-[12.5px] text-fg-3">{fmtDate(v.datum)}</span>
                      {aktuell && <Chip tone="ink">Installiert</Chip>}
                    </div>
                    <div className="mt-1.5">
                      <Chip tone="green" icon={<ShieldCheck className="size-3" />} className="!h-auto whitespace-normal py-0.5 text-left">
                        In einer Testumgebung geprüft · {fmtNum(v.tests)} automatische Prüfungen bestanden
                      </Chip>
                    </div>
                    <ul className="mt-2 grid grid-cols-1 gap-1 text-[13px] text-fg-2">
                      {v.notizen.map((n) => (
                        <li key={n} className="flex gap-2">
                          <span className="mt-[9px] size-1 shrink-0 rounded-full bg-[var(--fg-4)]" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.li>
              );
            })}
          </ol>
          <p className="mt-5 text-[12.5px] text-fg-3">Versionsangaben und Testzahlen sind in dieser Demo Beispielwerte.</p>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="title-md">So prüfen wir jedes Update</div>
            <ol className="mt-4 grid grid-cols-1 gap-0">
              {STUFEN.map((s, i) => (
                <motion.li
                  key={s.titel}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, delay: 0.1 + i * 0.07 }}
                  className="relative flex gap-3 pb-4 last:pb-0"
                >
                  {i < STUFEN.length - 1 && <span className="absolute bottom-1 left-[15px] top-9 w-[2px] rounded-full bg-[linear-gradient(var(--ink-soft),var(--line))]" aria-hidden />}
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", i === STUFEN.length - 1 ? "bg-green-soft text-green" : "bg-ink-soft text-ink")}>{s.icon}</span>
                  <span className="min-w-0 pt-0.5">
                    <span className="block text-[13.5px] font-semibold leading-tight">{s.titel}</span>
                    <span className="block text-[12.5px] text-fg-3">{s.text}</span>
                  </span>
                </motion.li>
              ))}
            </ol>
          </Card>
          <Card>
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                <CalendarClock className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="title-md">Updates einspielen</div>
                <p className="mt-0.5 text-[12.5px] text-fg-3">{ZEIT_TEXT[zeitpunkt]}</p>
              </div>
            </div>
            <Segmented<Zeitpunkt>
              full
              size="sm"
              className="mt-4"
              value={zeitpunkt}
              onChange={(z) => {
                setZeitpunkt(z);
                try {
                  localStorage.setItem("aa:update-zeitpunkt", z);
                } catch {
                  /* optional */
                }
                toast("Update-Zeitpunkt gespeichert", { text: ZEIT_TEXT[z], ton: "erfolg" });
              }}
              options={[
                { value: "manuell", label: "Manuell" },
                { value: "nachts", label: "Nachts" },
                { value: "wochenende", label: "Samstags" },
              ]}
            />
            <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-3">
              <Undo2 className="size-3.5 shrink-0 text-ink" /> Rückkehr zur Vorversion jederzeit – gemeinsam mit {ap.name}.
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

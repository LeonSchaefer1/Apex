import { Fragment } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Calculator, Cpu, Eye, Laptop, Quote, Server, Sparkles, UserCheck } from "lucide-react";
import { useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AiChip, Chip, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FLOW_CSS } from "@/pages/motor/shared";
import { Abschnitt, Zeile } from "./teile";

const QUELLE_TEXT = { server: "Claude über Ihren Kanzlei-Server", artefakt: "Claude über die Vorschau-Laufzeit", demo: "Offline-Demo-KI" } as const;

const GRUNDSAETZE = [
  { icon: <Calculator className="size-4" />, t: "Die KI erkennt, der Fristenrechner berechnet", s: "Fristen berechnet ausschließlich der geprüfte Rechenkern nach §§ 187 ff. BGB, § 222 ZPO – mit Rechenweg." },
  { icon: <UserCheck className="size-4" />, t: "Vorschläge statt Entscheidungen", s: "Jede Übernahme bestätigen Sie. KI-erkannte Fristen gehen immer in die Vier-Augen-Kontrolle." },
  { icon: <Quote className="size-4" />, t: "Quellen statt Behauptungen", s: "Zitiert werden nur Entscheidungen aus der Fall-Datenbank – keine erfundenen Aktenzeichen." },
  { icon: <Eye className="size-4" />, t: "Klar gekennzeichnet", s: "Was die KI erstellt hat, trägt den KI-Schimmer – im Posteingang, in der Akte und in Entwürfen." },
];

export function KiTab() {
  const ai = useAiStatus();
  const { user } = useKanzlei();
  const nurDemo = !ai.verfuegbar.some((q) => q !== "demo");
  const live = ai.quelle !== "demo";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <style>{FLOW_CSS}</style>
      <div className="flex min-w-0 flex-col gap-4">
        <Abschnitt titel="KI-Quelle" text="Welche KI gerade für Fallanalyse, Posteingang und den Apex Assistenten arbeitet." icon={<Sparkles className="size-[18px]" />} aktion={<AiChip>KI</AiChip>}>
          <div className={cn("flex items-center gap-3 rounded-[18px] p-4", live ? "bg-green-soft" : "bg-[var(--ink-softer)]")}>
            <span className="relative flex size-2.5 shrink-0">
              {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60 [animation-duration:2s]" />}
              <span className={cn("relative inline-flex size-2.5 rounded-full", live ? "bg-[var(--green)]" : "bg-[var(--fg-4)]")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{ai.label}</div>
              <div className="text-[12.5px] text-fg-3">
                {QUELLE_TEXT[ai.quelle]}
                {live && ai.modell ? ` · Modell ${ai.modell}` : ""}
              </div>
            </div>
            <div className="hidden flex-wrap justify-end gap-1 sm:flex">
              {ai.verfuegbar.map((q) => (
                <Chip key={q} tone={q === ai.quelle ? "ink" : "outline"}>
                  {q === "server" ? "Server" : q === "artefakt" ? "Vorschau" : "Demo"}
                </Chip>
              ))}
            </div>
          </div>
          <div className="mt-2 divide-y divide-[var(--line)]">
            <Zeile
              titel="Präsentationsmodus: Demo-KI verwenden"
              htmlFor="ki-demo"
              text={nurDemo ? "Derzeit ist keine Claude-Anbindung verfügbar – es läuft automatisch die Demo-KI." : "Für Vorführungen ohne Netz: Die Offline-KI antwortet sofort und sendet keine Daten."}
              className="pt-4"
            >
              <Switch
                id="ki-demo"
                checked={ai.bevorzugeDemo || nurDemo}
                disabled={nurDemo}
                onChange={(v) => {
                  ai.setBevorzugeDemo(v);
                  useData.getState().log({ akteur: "nutzer", userId: user.id, text: v ? "Präsentationsmodus (Demo-KI) eingeschaltet" : "Live-KI (Claude) eingeschaltet" });
                  toast(v ? "Demo-KI aktiv" : "Live-KI aktiv", { text: v ? "Antworten kommen von der Offline-KI." : "Antworten kommen von Claude über Ihren Kanzlei-Server.", ton: "ki" });
                }}
                label="Präsentationsmodus: Demo-KI verwenden"
              />
            </Zeile>
          </div>
        </Abschnitt>

        <Abschnitt titel="So fließen die Daten" text="Mandantendaten verlassen Ihre Infrastruktur nur über den Kanzlei-Server." icon={<Server className="size-[18px]" />}>
          <Datenfluss live={live} />
          <p className="mt-4 text-[12.5px] leading-relaxed text-fg-2">
            {live
              ? "Live-Betrieb: Ihr Arbeitsplatz spricht nur mit dem Kanzlei-Server. Er leitet Anfragen an Claude weiter, protokolliert sie ohne Inhalte und begrenzt die Nutzung je Kanzlei."
              : "Demo-Betrieb: Die Offline-KI rechnet vollständig in Ihrem Browser – es werden keine Daten übertragen."}
          </p>
          <div className="mt-3 rounded-[14px] bg-[var(--ink-softer)] px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-2">
            <span className="font-semibold text-fg">Konfigurationsgrundsatz:</span> Anfragen enthalten nur die Inhalte, die für die jeweilige Aufgabe nötig sind. Die Anbindung ist so eingerichtet, dass Inhalte nicht zu Trainingszwecken
            gespeichert oder verwendet werden. Maßgeblich sind die Vereinbarungen mit dem Anbieter – prüfen Sie diese im Rahmen Ihrer Pflichten nach § 43e BRAO.
          </div>
        </Abschnitt>
      </div>

      <Abschnitt titel="Grundsätze der Apex KI" text="Damit Sie der KI vertrauen können, ohne ihr blind zu vertrauen." icon={<BadgeCheck className="size-[18px]" />}>
        <ul className="grid grid-cols-1 gap-3">
          {GRUNDSAETZE.map((g, i) => (
            <motion.li key={g.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 420, damping: 34 }} className="flex gap-3 rounded-[16px] bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-violet-soft text-violet">{g.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">{g.t}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-fg-3">{g.s}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </Abschnitt>
    </div>
  );
}

function Datenfluss({ live }: { live: boolean }) {
  const knoten = [
    { icon: <Laptop className="size-5" />, t: "Ihr Arbeitsplatz", s: "Browser, ohne Admin-Rechte" },
    { icon: <Server className="size-5" />, t: "Kanzlei-Server", s: "Zugriffsprüfung, Protokoll ohne Inhalte" },
    { icon: <Cpu className="size-5" />, t: "Claude", s: "Verarbeitung der Anfrage" },
  ];
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {knoten.map((k, i) => {
        const aktiv = live || i === 0;
        return (
          <Fragment key={k.t}>
            <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-[16px] p-3 ring-1 ring-[var(--line)] transition-opacity sm:flex-col sm:text-center", aktiv ? "bg-[var(--surface-2)]" : "opacity-45")}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px]", i === 2 ? "bg-violet-soft text-violet" : "bg-ink-soft text-ink")}>{k.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{k.t}</span>
                <span className="block text-[11.5px] leading-snug text-fg-3">{k.s}</span>
              </span>
            </div>
            {i < knoten.length - 1 && (
              <div className="relative mx-auto h-6 w-[2px] shrink-0 overflow-hidden rounded-full bg-[var(--line-strong)] sm:h-[2px] sm:w-8">
                {live && (
                  <span className="absolute inset-0 hidden sm:block" style={{ animation: `aa-flow-2 1.8s linear ${i * 0.9}s infinite`, opacity: 0 }}>
                    <span className="absolute left-0 top-1/2 h-1 w-2.5 -translate-x-full -translate-y-1/2 rounded-full bg-ink shadow-[0_0_6px_var(--ink)]" />
                  </span>
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

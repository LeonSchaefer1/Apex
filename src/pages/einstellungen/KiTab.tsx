import { Fragment } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Calculator, Cpu, Eye, Laptop, Quote, Server, Sparkles, UserCheck } from "lucide-react";
import { DEMO_KI_NAME, useAiStatus } from "@/ai/status";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AiChip, Chip, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FLOW_CSS } from "@/pages/motor/shared";
import { DRITTLAND, VERARBEITUNGSORT } from "@/content/datenschutz";
import { Abschnitt, Zeile } from "./teile";
import { BEWEGUNG } from "@/lib/bewegung";

const QUELLE_TEXT = { server: "Claude (Anthropic-API) über Ihren Kanzlei-Server", artefakt: "Claude (Anthropic) über die Vorschau-Laufzeit", demo: "Arbeitet nach festen Regeln vollständig in Ihrem Browser" } as const;
/** Einheitlicher Name der Offline-KI in der ganzen App: DEMO_KI_NAME aus src/ai/status.ts. */
const QUELLE_NAME = { server: "KI live · Claude", artefakt: "KI live · Claude", demo: DEMO_KI_NAME } as const;

const GRUNDSAETZE = [
  { icon: <Calculator className="size-4" />, t: "Die KI erkennt, der Fristenrechner berechnet", s: "Fristen berechnet ausschließlich der geprüfte Rechenkern nach §§ 187 ff. BGB und der jeweiligen Verfahrensordnung (z. B. § 222 ZPO, § 43 StPO) – mit Rechenweg." },
  { icon: <UserCheck className="size-4" />, t: "Vorschläge statt Entscheidungen", s: "Jede Übernahme bestätigen Sie. KI-erkannte Fristen gehen immer in die Vier-Augen-Kontrolle." },
  { icon: <Quote className="size-4" />, t: "Quellen statt Behauptungen", s: "Präzedenzfälle übernimmt Apex nur aus der Fall-Datenbank – mit Gericht, Datum und Aktenzeichen zum Nachprüfen. KI-Texte bleiben Entwürfe zur anwaltlichen Prüfung." },
  { icon: <Eye className="size-4" />, t: "Klar gekennzeichnet", s: "Was die KI erstellt hat, trägt das Etikett „KI“ – im Posteingang, in der Akte und in Entwürfen." },
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
          <div className={cn("flex items-center gap-3 rounded-lg p-4", live ? "bg-green-soft" : "bg-[var(--ink-softer)]")}>
            <span className="relative flex size-2.5 shrink-0">
              {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--green)] opacity-60 [animation-duration:2s]" />}
              <span className={cn("relative inline-flex size-2.5 rounded-full", live ? "bg-[var(--green)]" : "bg-[var(--fg-4)]")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{QUELLE_NAME[ai.quelle]}</div>
              <div className="text-[13px] text-fg-3">
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
              text={nurDemo ? "Derzeit ist keine Claude-Anbindung verfügbar – es läuft automatisch die Demo-KI." : `Für Vorführungen ohne Netz: Die ${DEMO_KI_NAME} antwortet sofort und sendet keine Daten.`}
              className="pt-4"
            >
              <Switch
                id="ki-demo"
                checked={ai.bevorzugeDemo || nurDemo}
                disabled={nurDemo}
                onChange={(v) => {
                  ai.setBevorzugeDemo(v);
                  useData.getState().log({ akteur: "nutzer", userId: user.id, text: v ? "Präsentationsmodus (Demo-KI) eingeschaltet" : "Live-KI (Claude) eingeschaltet" });
                  toast(v ? "Demo-KI aktiv" : "Live-KI aktiv", { text: v ? `Antworten kommen von der ${DEMO_KI_NAME}.` : `Antworten kommen von Claude ${ai.verfuegbar[0] === "artefakt" ? "über die Vorschau-Laufzeit" : "über Ihren Kanzlei-Server"}.`, ton: "ki" });
                }}
                label="Präsentationsmodus: Demo-KI verwenden"
              />
            </Zeile>
          </div>
        </Abschnitt>

        <Abschnitt
          titel="So fließen die Daten"
          text={live ? "Im Live-Betrieb verlassen Akteninhalte Ihre Infrastruktur: Sie gehen aufgabenbezogen an den KI-Anbieter Anthropic (Claude)." : "Im Demo-Betrieb gehen keine Inhalte an einen KI-Anbieter."}
          icon={<Server className="size-[18px]" />}
        >
          <Datenfluss live={live} quelle={ai.quelle} />
          <p className="mt-4 text-[13px] leading-relaxed text-fg-2">
            {ai.quelle === "server"
              ? "Live-Betrieb: Ihr Arbeitsplatz spricht nur mit dem Kanzlei-Server. Er prüft die Berechtigung, sendet die für die Aufgabe nötigen Inhalte (z. B. Sachverhalt und Dokumente einer Akte) an die Anthropic-API, protokolliert die Anfrage ohne Inhalte und begrenzt die Nutzung je Kanzlei."
              : ai.quelle === "artefakt"
                ? "Vorschau-Betrieb: Anfragen gehen über die Vorschau-Laufzeit an Claude (Anthropic) – ohne Kanzlei-Server. Arbeiten Sie hier nur mit Beispieldaten."
                : `Demo-Betrieb: Die ${DEMO_KI_NAME} arbeitet vollständig in Ihrem Browser – es werden keine Inhalte an einen KI-Anbieter übertragen.`}
          </p>
          <Verarbeitungsort live={live} />
          <div className="mt-3 rounded-lg bg-[var(--ink-softer)] px-3.5 py-3 text-[13px] leading-relaxed text-fg-2">
            <span className="font-semibold text-fg">Vor dem Live-Betrieb:</span> Anthropic verarbeitet Mandatsinhalte als Dienstleister. Erforderlich sind ein Vertrag nach § 43e BRAO (Verschwiegenheit, Zugriff nur soweit nötig) und eine Auftragsverarbeitung nach
            Art. 28 DSGVO. {DRITTLAND} Die Anbindung sendet nur aufgabenbezogene Inhalte und ist so eingerichtet, dass sie nicht zu Trainingszwecken verwendet werden –
            maßgeblich sind die Vereinbarungen mit dem Anbieter.
          </div>
        </Abschnitt>
      </div>

      <Abschnitt titel="Grundsätze der Apex KI" text="Damit Sie der KI vertrauen können, ohne ihr blind zu vertrauen." icon={<BadgeCheck className="size-[18px]" />}>
        <ul className="grid grid-cols-1 gap-3">
          {GRUNDSAETZE.map((g) => (
            <motion.li key={g.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={BEWEGUNG.standard} className="flex gap-3 rounded-lg bg-[var(--surface-2)] p-3.5 ring-1 ring-[var(--line)]">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--surface-2)] text-fg-3">{g.icon}</span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">{g.t}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-3">{g.s}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </Abschnitt>
    </div>
  );
}

function Datenfluss({ live, quelle }: { live: boolean; quelle: "server" | "artefakt" | "demo" }) {
  const knoten = [
    { icon: <Laptop className="size-5" />, t: "Ihr Arbeitsplatz", s: "Browser, ohne Admin-Rechte" },
    quelle === "artefakt"
      ? { icon: <Server className="size-5" />, t: "Vorschau-Laufzeit", s: "ohne Kanzlei-Server" }
      : { icon: <Server className="size-5" />, t: "Kanzlei-Server", s: "Zugriffsprüfung, Protokoll ohne Inhalte" },
    { icon: <Cpu className="size-5" />, t: "Claude · Anthropic", s: "Verarbeitung der Anfrage beim KI-Anbieter" },
  ];
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      {knoten.map((k, i) => {
        const aktiv = live || i === 0;
        return (
          <Fragment key={k.t}>
            <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg p-3 ring-1 sm:flex-col sm:text-center", aktiv ? "bg-[var(--surface-2)] ring-[var(--line)]" : "border border-dashed border-[var(--line-strong)] bg-transparent ring-transparent")}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-md", !aktiv ? "bg-[var(--ink-softer)] text-fg-2" : i === 2 ? "bg-[var(--surface-2)] text-fg-3" : "bg-ink-soft text-ink")}>{k.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-fg">{k.t}</span>
                <span className="block text-[13px] leading-snug text-fg-2">{k.s}</span>
                {!aktiv && <span className="mt-1 inline-block rounded-full bg-[var(--ink-softer)] px-2 py-px text-[12px] font-semibold text-fg-2 ring-1 ring-[var(--line)]">nicht aktiv</span>}
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

/** „Verarbeitungsort“ – gleichlautend mit der Landing-FAQ „Wo liegen unsere Daten?“ (src/content/datenschutz.ts). Der aktuelle Modus ist markiert. */
function Verarbeitungsort({ live }: { live: boolean }) {
  const zeilen = [
    { key: "live", text: VERARBEITUNGSORT.live, aktiv: live },
    { key: "demo", text: VERARBEITUNGSORT.demo, aktiv: !live },
  ];
  return (
    <section aria-labelledby="ki-verarbeitungsort" className="mt-4 rounded-lg p-3.5 ring-1 ring-[var(--line)]">
      <h3 id="ki-verarbeitungsort" className="text-[14px] font-semibold">
        {VERARBEITUNGSORT.titel}
      </h3>
      <ul className="mt-2 grid gap-2">
        {zeilen.map((z) => (
          <li key={z.key} className={cn("flex items-start gap-2.5 rounded-md px-3 py-2 text-[13px] leading-relaxed", z.aktiv ? "bg-ink-soft text-fg" : "text-fg-2")}>
            <span className={cn("mt-[7px] size-2 shrink-0 rounded-full", z.aktiv ? "bg-ink" : "bg-[var(--fg-4)]")} aria-hidden />
            <span className="min-w-0">
              {z.text}
              {z.aktiv && <span className="ml-1.5 inline-block rounded-full bg-[var(--surface)] px-2 py-px text-[13px] font-semibold text-ink ring-1 ring-[var(--line)]">aktueller Modus</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 px-3 text-[13px] leading-relaxed text-fg-3">{VERARBEITUNGSORT.eu}</p>
    </section>
  );
}

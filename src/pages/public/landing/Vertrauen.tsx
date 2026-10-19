import { BookCheck, Calculator, Check, ChevronRight, Lock, ServerCog, ShieldCheck } from "lucide-react";
import { AiChip } from "@/components/ui";
import { Abschnitt, Kopf, Leise, scrollZu, useFaq } from "./basis";
import { FRAGEN } from "./Abschluss";
import { DEMO_KI_NAME } from "@/ai/status";
import { VERARBEITUNGSORT } from "@/content/datenschutz";

const UMZUG_PUNKTE = ["Akten mit Rubrum & Sachgebiet", "Kontakte – Dubletten zusammengeführt", "Fristen – geprüft, zur Vier-Augen-Kontrolle", "Datenblatt mit Originalwerten je Akte"];

/** „Umzug in fünf Schritten – mit Vorschau und Rückgängig“ (DESIGN-SYSTEM.md 14.8): ein ruhiges Band auf Fläche 2, ohne Dauerbewegung. */
export function UmzugBand() {
  const zurFrage = () => {
    const i = Math.max(0, FRAGEN.findIndex((q) => q.f.startsWith("Wie läuft der Umzug")));
    useFaq.getState().setOffen(i);
    scrollZu("faq");
    // Tastatur: der Fokus folgt zur geöffneten Frage (ohne den sanften Bildlauf zu unterbrechen)
    requestAnimationFrame(() => document.getElementById(`faq-k-${i}`)?.focus({ preventScroll: true }));
  };
  return (
    <Abschnitt id="umzug" labelledBy="umzug-titel">
      <div className="grid items-start gap-10 rounded-lg bg-[var(--surface-2)] p-6 sm:p-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="mb-3 text-[13px] font-medium leading-[18px] text-fg-3">Umzug</p>
          <h2 id="umzug-titel" className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-fg md:text-[28px] md:leading-9">
            Umzug in fünf Schritten – mit Vorschau und Rückgängig.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[15px] leading-6 text-fg-2">
            Akten, Kontakte und Fristen übernimmt der Umzug vollständig; Dokumente und Aktenkonten übernehmen Sie gemeinsam mit Ihrer Ansprechpartnerin. Sie sehen vorab eine Vorschau, Dubletten werden erkannt, Fristen auf Plausibilität geprüft und zur Vier-Augen-Kontrolle vorgelegt. Jeder Lauf lässt sich rückgängig machen; bei Bedarf laufen beide Systeme parallel.
          </p>
          <button type="button" onClick={zurFrage} className="link-leise mt-5 min-h-11 sm:min-h-6">
            Wie der Umzug abläuft <ChevronRight aria-hidden />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-fg-3">Umzug aus Ihrer bisherigen Software</p>
          <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {UMZUG_PUNKTE.map((p) => (
              <li key={p} className="flex items-start gap-3 py-3 text-[14px] leading-5 text-fg">
                <Check className="mt-0.5 size-4 shrink-0 text-fg-2" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Abschnitt>
  );
}

const PRINZIPIEN = [
  { i: <Calculator className="size-4" />, t: "KI erkennt – Rechenkern berechnet", s: "Fristen rät keine KI. Sie erkennt das auslösende Ereignis, der geprüfte Fristenrechner rechnet nach §§ 187 ff. BGB und der jeweiligen Verfahrensordnung (z. B. § 222 ZPO, § 43 StPO) – mit Rechenweg und Feiertagen je Bundesland." },
  { i: <BookCheck className="size-4" />, t: "Nachprüfbare Quellen", s: "Präzedenzfälle übernimmt die KI nur aus der Fall-Datenbank – jeweils mit Gericht, Datum und Aktenzeichen zum Nachprüfen. KI-Texte sind als Entwurf gekennzeichnet und werden vor Verwendung anwaltlich geprüft." },
  { i: <ServerCog className="size-4" />, t: "Deutsches Rechenzentrum oder eigener Server", s: "Betrieb in einem deutschen Rechenzentrum oder auf einem eigenen Server in der Kanzlei. Live-KI – also die Verarbeitung durch das Sprachmodell eines KI-Anbieters – nur aufgabenbezogen über Ihren Server bei Anthropic (USA), oder komplett offline. Keine externen Schriften, ohne Nutzungsverfolgung." },
  { i: <Lock className="size-4" />, t: "Verschwiegenheit nach § 203 StGB", s: "Strikte Mandantentrennung auf Datenbankebene, verschlüsselte Übertragung, Rollen und Rechte. Sie behalten die Kontrolle über jede Freigabe." },
];

const SCHRITTE = [
  { t: "beA-Zustellung", s: "Urteil geht ein" },
  { t: "KI erkennt", s: "Ereignis & Akte", ai: true },
  { t: "Rechenkern", s: "§ 222 ZPO, Feiertage" },
  { t: "Sie prüfen", s: "Vier-Augen-Prinzip" },
];

/** KI und Datenschutz (DESIGN-SYSTEM.md 14.9): Ablauf in vier nummerierten Schritten, zweispaltige Liste, Verarbeitungsort als Hinweis. */
export function Vertrauen() {
  return (
    <Abschnitt id="ki" labelledBy="ki-titel">
      <Kopf
        id="ki-titel"
        eyebrow="KI, der Sie vertrauen können"
        titel={
          <>
            Die KI schlägt vor.
            <br /> <Leise>Sie entscheiden.</Leise>
          </>
        }
        text="Apex setzt KI dort ein, wo sie Zeit spart – und hält sie dort heraus, wo es auf Exaktheit ankommt. Jede KI-Aktion ist klar gekennzeichnet und bleibt ein Vorschlag, bis Sie ihn übernehmen."
      />

      <ol className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-4" aria-label="Von der Zustellung zur Frist">
        {SCHRITTE.map((x, k) => (
          <li key={x.t} className="flex items-start gap-3 border-t border-[var(--line)] py-4 sm:pb-0">
            <span className="num w-5 shrink-0 text-[13px] font-semibold leading-[22px] text-fg-4">{k + 1}</span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-[22px] text-fg">
                {x.t}
                {x.ai && <AiChip />}
              </span>
              <span className="block text-[13px] leading-[18px] text-fg-3">{x.s}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-8 md:mt-16 md:grid-cols-2">
        {PRINZIPIEN.map((p) => (
          <div key={p.t} className="flex items-start gap-3">
            <span className="mt-[3px] shrink-0 text-fg-2" aria-hidden>
              {p.i}
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-[22px] text-fg">{p.t}</h3>
              <p className="mt-1 text-[14px] leading-[22px] text-fg-3">{p.s}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-[var(--line)] px-5 py-4 text-[14px] leading-[22px] text-fg-2 md:mt-16">
        <h3 className="text-[15px] font-semibold text-fg">{VERARBEITUNGSORT.titel} der KI</h3>
        <ul className="mt-1.5 grid gap-1">
          <li>{VERARBEITUNGSORT.live}</li>
          <li>{VERARBEITUNGSORT.demo}</li>
          <li className="text-fg-3">{VERARBEITUNGSORT.eu}</li>
        </ul>
        <p className="mt-3 flex items-start gap-2.5 border-t border-[var(--line)] pt-3">
          <ShieldCheck className="mt-[3px] size-4 shrink-0 text-fg-3" aria-hidden />
          <span>
            <span className="font-semibold text-fg">Sie behalten die Hoheit:</span> In den Einstellungen legen Sie fest, ob die Live-KI (Claude) oder die {DEMO_KI_NAME} arbeitet – und sehen jederzeit, wohin Daten fließen.
          </span>
        </p>
      </div>
    </Abschnitt>
  );
}

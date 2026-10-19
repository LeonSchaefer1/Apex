import { useMemo, useState, type ReactNode } from "react";
import { ArrowRightLeft, BookOpenText, ChevronRight, Headphones, Infinity as InfinityIcon, Library, LifeBuoy, Mic, Search, Sparkles, Zap } from "lucide-react";
import { AiChip } from "@/components/ui";
import { ApexOrb } from "@/components/assistant/ApexOrb";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { STANDARD_ANSPRECHPARTNER } from "@/core/seed/kunde";
import { cn } from "@/lib/cn";
import { Abschnitt, Kopf, Leise, scrollZu } from "./basis";

const SUCHEN: { q: string; kurz: string; g: string; w: string[] }[] = [
  { q: "Bagatellkündigung nach 14 Jahren ohne Abmahnung", kurz: "Arbeitsrecht", g: "Arbeitsrecht", w: ["bagatelle", "abmahnung", "betriebszugehörigkeit", "fristlose kündigung", "geringwertig", "interessenabwägung"] },
  { q: "Schönheitsreparaturen bei unrenovierter Wohnung", kurz: "Mietrecht", g: "Mietrecht", w: ["schönheitsreparaturen", "unrenoviert", "renovierung", "formularklausel", "kaution"] },
  { q: "Versicherung verweist auf freie Werkstatt", kurz: "Verkehrsrecht", g: "Verkehrsrecht", w: ["freie werkstatt", "reparaturkosten", "verweis", "markenwerkstatt", "stundenverrechnungssatz"] },
];

/** Gerichte, die im kuratierten Auszug tatsächlich vorkommen – keine Instanzen versprechen, die der Prototyp nicht enthält. */
const GERICHTE = ["BVerfG", "EuGH", "BGH", "BAG", "BVerwG", "BSG", "BFH", "OLG", "LG", "AG"].filter((g) => ENTSCHEIDUNGEN.some((e) => e.gericht === g));

function treffer(g: string, w: string[]) {
  return ENTSCHEIDUNGEN.filter((e) => e.rechtsgebiet === g)
    .map((e) => {
      const text = (e.schlagworte.join(" ") + " " + e.titel + " " + e.leitsatz).toLowerCase();
      return { e, score: w.reduce((s, x) => s + (text.includes(x) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Funktionen (DESIGN-SYSTEM.md 14.4): zuerst die Fall-Datenbank mit echtem Suchergebnis als Beleg, darunter ein Raster ohne
 * Karten – je Funktion Symbol 20 px, Titel, Text in Text 3 und eine Linie oben. Kein Verlauf, keine Symbolkacheln.
 */
export function Funktionen() {
  return (
    <Abschnitt id="funktionen" labelledBy="funktionen-titel">
      <Kopf
        id="funktionen-titel"
        eyebrow="Ein Werkzeug statt fünf"
        titel={
          <>
            Alles, was Ihre Kanzlei braucht.
            <br /> <Leise>In einer Oberfläche.</Leise>
          </>
        }
        text="Akten, beA und E-Mail, Fristen, Dokumente, RVG-Abrechnung, Forderungen und Zeiten – verbunden durch eine KI, die mitdenkt, und einen Motor, der Routine vorbereitet und erledigt, was die Kanzlei nicht verlässt."
      />

      {/* Fall-Datenbank: Text links, echtes Suchergebnis rechts */}
      <article aria-labelledby="fdb-titel" className="grid grid-cols-1 items-center gap-10 border-t border-[var(--line)] pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pt-12">
        <div className="min-w-0">
          <Library className="size-5 text-fg-2" aria-hidden />
          <h3 id="fdb-titel" className="mt-4 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-fg">
            Die Fall-Datenbank
          </h3>
          <p className="mt-2 text-[16px] leading-[26px] text-fg-3">
            Präzedenzfall-Recherche in Sekunden: passende Entscheidungen mit Gericht, Datum und Aktenzeichen zum Nachprüfen. Im Prototyp ein kuratierter Auszug echter Leitentscheidungen von BVerfG, EuGH und Bundesgerichten – im Produktivbetrieb angebunden an offene Quellen wie Open Legal Data und die amtlichen Veröffentlichungen der Bundesgerichte.
          </p>
        </div>
        <SucheDemo />
      </article>

      <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:mt-20 lg:grid-cols-3">
        <Funktion
          icon={<Zap />}
          titel="Der 38h-Motor"
          text="Routine im Hintergrund: Standard-Schriftsätze (z. B. Kostenfestsetzungsantrag) bereitet der 38h-Motor vor – zur Prüfung und Unterschrift. Vorfristen setzt er intern, Mandanteninformationen gehen erst nach Ihrer Freigabe hinaus. Ziel: Ø 38 Stunden weniger Routinearbeit pro Woche und Kanzlei. Fristen legt der Motor zur Vier-Augen-Kontrolle vor."
          mehr={{ text: "So spart der Motor Zeit", ziel: "motor" }}
        />
        <Funktion
          icon={<InfinityIcon />}
          titel="Lifetime-Lizenz (Kauflizenz ohne Laufzeit)"
          text="Kaufen statt mieten: Sie investieren einmal und erhalten eine unbefristete Lizenz – ohne Abo-Falle und ohne Monatsgebühren. Die Wartung ist optional – Umfang und Preis regelt das Angebot. Ihre Kanzlei-Software gehört Ihnen."
          mehr={{ text: "Kosten über fünf Jahre", ziel: "lifetime" }}
        />
        <Funktion
          icon={<ArrowRightLeft />}
          titel="Umzug in fünf Schritten – mit Vorschau und Rückgängig"
          text="Akten, Kontakte und Fristen aus Ihrer bisherigen Software ziehen vollständig um – mit Vorschau, Dublettenprüfung, Plausibilitätsprüfung der Fristen, Vier-Augen-Kontrolle und Rückgängig je Lauf."
          mehr={{ text: "Ablauf des Umzugs", ziel: "umzug" }}
        />
        <Funktion icon={<LifeBuoy />} titel="Persönliche Hilfe, die wirklich hilft" text="Animiertes Wiki und Schnellhilfe direkt in der Software – plus eine feste Ansprechpartnerin mit direkter Durchwahl statt Telefon-Warteschleife.">
          <ul className="mt-5 grid gap-2 text-[13px] leading-[18px] text-fg-3">
            <li className="flex items-center gap-2">
              <BookOpenText className="size-4 shrink-0 text-fg-4" aria-hidden />
              <span>
                <span className="font-medium text-fg-2">Eine Berufungsfrist berechnen</span> · Schnellhilfe · 30 Sek.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Headphones className="size-4 shrink-0 text-fg-4" aria-hidden />
              <span>
                <span className="font-medium text-fg-2">Ihre feste Ansprechpartnerin</span> · Direkte Durchwahl · {STANDARD_ANSPRECHPARTNER.verfuegbar}
              </span>
            </li>
          </ul>
        </Funktion>
        <AssistentDemo />
      </div>
    </Abschnitt>
  );
}

function Funktion({ icon, titel, text, mehr, children, className }: { icon: ReactNode; titel: string; text: string; mehr?: { text: string; ziel: string }; children?: ReactNode; className?: string }) {
  return (
    <article className={cn("flex min-w-0 flex-col border-t border-[var(--line)] pt-6", className)}>
      <span className="text-fg-2 [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-fg">{titel}</h3>
      <p className="mt-2 text-[15px] leading-6 text-fg-3">{text}</p>
      {children}
      {mehr && (
        <button type="button" onClick={() => scrollZu(mehr.ziel)} className="link-leise mt-4 min-h-11 self-start sm:min-h-6">
          {mehr.text} <ChevronRight aria-hidden />
        </button>
      )}
    </article>
  );
}

/**
 * Beleg statt Behauptung: echte Entscheidungen aus der Fall-Datenbank. Drei Beispielsuchen zum Umschalten – ohne
 * Tipp-Animation und ohne Dauerbewegung.
 */
function SucheDemo() {
  const [idx, setIdx] = useState(0);
  const ergebnisse = useMemo(() => SUCHEN.map((s) => treffer(s.g, s.w)), []);
  const liste = ergebnisse[idx];
  return (
    <div className="buehne min-w-0 !rounded-xl p-3 sm:p-6">
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex h-11 items-center gap-2.5 border-b border-[var(--line)] px-4 text-[14px]">
          <Search className="size-4 shrink-0 text-fg-4" aria-hidden />
          <span className="min-w-0 truncate text-fg" aria-live="polite">
            {SUCHEN[idx].q}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3 text-[12px] text-fg-3">
          <span>{liste.length} passende Entscheidungen</span>
          <span className="hidden text-fg-4 sm:inline">Im Auszug: {GERICHTE.join(" · ")}</span>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {liste.map(({ e, score }) => (
            <li key={`${idx}-${e.id}`} className="min-w-0 px-4 py-3">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="chip">{e.gericht}</span>
                <span className="mono text-fg-2">{e.az}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-fg-4">
                  <span className="h-1 w-10 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
                    <span className="block h-full rounded-full bg-[var(--ink)]" style={{ width: `${Math.min(100, 45 + score * 12)}%` }} />
                  </span>
                  Relevanz
                </span>
              </div>
              <div className="mt-1.5 truncate text-[13px] font-semibold text-fg">{e.titel}</div>
              <div className="line-clamp-1 text-[12px] leading-[18px] text-fg-3">{e.leitsatz}</div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Beispielsuche wählen">
        <span className="text-[12px] text-fg-3">Beispielsuche:</span>
        {SUCHEN.map((x, k) => (
          <button
            key={x.q}
            type="button"
            aria-pressed={idx === k}
            title={x.q}
            onClick={() => setIdx(k)}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-2.5 text-[12px] font-medium transition-colors duration-100 max-sm:h-11",
              idx === k ? "bg-[var(--surface)] text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-fg-3 hover:bg-[var(--surface-3)] hover:text-fg",
            )}
          >
            {x.kurz}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Apex Assistent: Assistent-Knopf (Bildmarke im Kreis) und ein Gesprächsauszug – eigene Nachricht auf Fläche, Antwort als Text. */
function AssistentDemo() {
  return (
    <article className="grid min-w-0 gap-8 border-t border-[var(--line)] pt-6 md:col-span-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0">
        <ApexOrb size={40} className="!shadow-none" />
        <div className="mt-4">
          <AiChip>Per Sprache oder Text</AiChip>
        </div>
        <h3 className="mt-3 text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-fg">Apex Assistent – Ihr Sprachassistent für persönliche Hilfe</h3>
        <p className="mt-2 text-[15px] leading-6 text-fg-3">Sprechen Sie einfach los: Der Assistent versteht gesprochene Fragen, kennt die Software und Ihre Akten – und antwortet sofort. Was er einträgt, bestätigen Sie vorher. Wenn es knifflig wird, verbindet er Sie mit Ihrer festen Ansprechpartnerin.</p>
      </div>
      <div className="grid min-w-0 content-start gap-4 text-[14px] leading-[22px]">
        <p className="ml-auto max-w-[88%] rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-fg">
          <Mic className="mr-1.5 inline size-3.5 -translate-y-px text-fg-3" aria-hidden />
          <span className="sr-only">Gesprochene Frage: </span>„Welche nicht verlängerbaren Fristen stehen als Nächstes an?“
        </p>
        <div className="max-w-[92%] text-fg-2">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-fg-3">
            <Sparkles className="size-3" aria-hidden />
            Apex Assistent
          </p>
          <p>
            Als Nächstes der <b className="font-semibold text-fg">Einspruch gegen einen Bußgeldbescheid</b> (§ 67 OWiG), danach die Klagefristen für <b className="font-semibold text-fg">Kündigungsschutzklagen</b> (§ 4 KSchG) – darunter Herr Weber in Akte <span className="mono">142/26</span>. Alle mit Vorfrist und Vier-Augen-Kontrolle. Soll ich die Klageschrift für Herrn Weber vorbereiten?
          </p>
        </div>
        <p className="ml-auto max-w-[88%] rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-fg">„Ja, bitte – mit dem Emmely-Urteil.“</p>
      </div>
    </article>
  );
}

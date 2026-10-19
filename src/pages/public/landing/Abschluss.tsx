import { useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FileText, Lock, Minus, Plus } from "lucide-react";
import { Button, Chip, Modal } from "@/components/ui";
import { LogoMark, Wortmarke } from "@/components/Logo";
import { BEWEGUNG } from "@/lib/bewegung";
import { Abschnitt, Kopf, scrollZu, useFaq } from "./basis";
import { ANKER } from "./Navigation";
import { VERARBEITUNGSORT } from "@/content/datenschutz";
import { ESCROW_HINWEIS, LIZENZ_KENNZEICHNUNG, PREIS_HINWEIS, UEBERTRAGBARKEIT_HINWEIS, WARTUNG_HINWEIS, WARTUNG_INHALT } from "@/content/lizenz";
import { KontaktBlock, useAnfrage } from "./Anfrage";

export const FRAGEN = [
  {
    f: "Was bedeutet „Lifetime-Lizenz“ genau?",
    a: `Lifetime-Lizenz heißt: Kauflizenz ohne Laufzeit. Sie erwerben Apex einmalig und dürfen die Software dauerhaft nutzen – ohne monatliche Lizenzgebühren. ${WARTUNG_HINWEIS}. Ohne Wartung bleiben Software und Daten unbefristet nutzbar und vollständig exportierbar. ${UEBERTRAGBARKEIT_HINWEIS}. ${ESCROW_HINWEIS}. (${LIZENZ_KENNZEICHNUNG}.)`,
  },
  {
    f: "Was kostet Apex?",
    a: `${PREIS_HINWEIS}: Die einmalige Investition richtet sich nach der Kanzleigröße, also nach Arbeitsplätzen und gewünschten Modulen. ${WARTUNG_HINWEIS}. Enthalten: ${WARTUNG_INHALT.enthalten.join(", ")}. Ohne Wartung: ${WARTUNG_INHALT.ohne.join("; ")}. Ihr Angebot fordern Sie über „Angebot anfordern“ an – im Echtbetrieb meldet sich Ihre Ansprechpartnerin innerhalb eines Werktags. (${LIZENZ_KENNZEICHNUNG}.)`,
  },
  {
    f: "Wo liegen unsere Daten?",
    a: `Entweder in einem deutschen Rechenzentrum oder auf einem eigenen Server in Ihrer Kanzlei. Die Daten jeder Kanzlei sind auf Datenbankebene streng getrennt. ${VERARBEITUNGSORT.titel} der KI – ${VERARBEITUNGSORT.live} ${VERARBEITUNGSORT.demo} ${VERARBEITUNGSORT.eu}`,
  },
  { f: "Ersetzt die KI die anwaltliche Prüfung?", a: "Nein. Die KI erkennt, fasst zusammen und schlägt vor – etwa eine Frist aus einem Urteil oder passende Präzedenzfälle. Fristen berechnet ausschließlich der geprüfte Fristenrechner mit nachvollziehbarem Rechenweg. Übernommen wird nur, was Sie freigeben." },
  { f: "Wie läuft der Umzug aus unserer bisherigen Software?", a: "Sie laden den Export Ihrer bisherigen Kanzleisoftware hoch. Apex zeigt eine Vorschau, erkennt Dubletten, prüft die Fristen auf Plausibilität (z. B. Fristende an einem Wochenende oder Feiertag) und legt sie zur Vier-Augen-Kontrolle vor. Auf Wunsch arbeiten Sie eine Zeit lang parallel." },
  { f: "Ist das beA angebunden?", a: "Im Produktivbetrieb über die Schnittstelle der BRAK für Kanzleisoftware – in dieser Demo sind beA-Eingang und Empfangsbekenntnis simuliert. beA-Nachrichten und E-Mails landen in einem gemeinsamen Posteingang. Die KI ordnet sie der Akte zu, erkennt Fristen und bereitet das elektronische Empfangsbekenntnis vor – abgegeben wird es erst, wenn die Frist notiert ist." },
  { f: "Können wir Apex vorher testen?", a: "Gern. Über „Testzugang anfordern“ erhalten Sie einen eigenen Testzugang – auf Wunsch mit Beispieldaten – und eine feste Ansprechpartnerin, die Sie durch die ersten Schritte begleitet. Die öffentliche Demo starten Sie sofort über „Demo starten“." },
];

/** Fragen (DESIGN-SYSTEM.md 14.11): Liste mit Linien, Frage 16/500, Plus/Minus rechts, Antwort 15/24 – Aufklappen 160 ms. */
export function Faq() {
  const { offen, setOffen } = useFaq();
  return (
    <Abschnitt id="faq" labelledBy="faq-titel">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <Kopf
          id="faq-titel"
          className="!mb-0 lg:sticky lg:top-24 lg:self-start"
          eyebrow="Häufige Fragen"
          titel="Gut zu wissen."
          text="Ihre Frage ist nicht dabei? Rufen Sie Ihre Ansprechpartnerin an – die Nummer steht unten unter „Kontakt“."
        />
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {FRAGEN.map((q, i) => {
            const auf = offen === i;
            return (
              <li key={q.f}>
                <h3>
                  <button
                    type="button"
                    id={`faq-k-${i}`}
                    aria-expanded={auf}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOffen(auf ? null : i)}
                    className="flex min-h-14 w-full items-center gap-4 py-4 text-left focus-visible:outline-offset-[-2px] sm:py-5"
                  >
                    <span className="flex-1 text-[16px] font-medium leading-6 text-fg">{q.f}</span>
                    <span className="shrink-0 text-fg-3" aria-hidden>
                      {auf ? <Minus className="size-4" /> : <Plus className="size-4" />}
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {auf && (
                    <motion.div
                      id={`faq-a-${i}`}
                      role="region"
                      aria-labelledby={`faq-k-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={BEWEGUNG.standard}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[68ch] pb-5 pr-8 text-[15px] leading-6 text-fg-2">{q.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </Abschnitt>
  );
}

/** Schluss (DESIGN-SYSTEM.md 14.12): mittig ein Satz und eine Primäraktion auf --bg; darunter der Kontakt als ruhiger Block. */
export function Schluss() {
  const nav = useNavigate();
  return (
    <Abschnitt id="kontakt" labelledBy="schluss-titel" className="pb-16 md:pb-24 lg:pb-32">
      <div className="mx-auto flex max-w-[720px] flex-col items-center text-center">
        <LogoMark size={32} className="text-fg" />
        <h2 id="schluss-titel" className="mt-6 text-[28px] font-semibold leading-9 tracking-[-0.025em] text-fg md:text-[40px] md:leading-[48px]">
          Eine Kanzlei-Software, die Ihnen gehört.
        </h2>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-[26px] text-fg-3 md:text-[18px] md:leading-7">Testen Sie Apex mit Beispieldaten – Fristen, Posteingang, KI-Fallanalyse und 38h-Motor, so wie sie morgen in Ihrer Kanzlei laufen.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/login")}>
            Demo starten
          </Button>
          <Button variant="secondary" size="lg" onClick={() => useAnfrage.getState().oeffne("testzugang")}>
            Testzugang anfordern
          </Button>
        </div>
      </div>
      <div className="schluss-karte mx-auto mt-16 max-w-[880px] p-6 sm:p-8">
        <h3 className="mb-4 text-[15px] font-semibold text-fg">Kontakt</h3>
        <KontaktBlock />
      </div>
    </Abschnitt>
  );
}

type Rechtliches = "impressum" | "datenschutz" | "agb";

/** Rechtliche Seiten sind im Prototyp bewusst nicht hinterlegt – der Dialog sagt das offen, statt Angaben zu erfinden. */
const RECHTLICHES: Record<Rechtliches, { label: string; titel: string; text: string }> = {
  impressum: {
    label: "Impressum",
    titel: "Impressum",
    text: "Die Anbieterkennzeichnung (§ 5 DDG) ist in diesem Prototyp noch nicht hinterlegt. Sie wird ergänzt, bevor die Seite öffentlich erreichbar ist.",
  },
  datenschutz: {
    label: "Datenschutz",
    titel: "Datenschutzerklärung",
    text: "Die Datenschutzerklärung (Informationen nach Art. 13 DSGVO) ist in diesem Prototyp noch nicht hinterlegt. Diese Seite lädt keine externen Schriften und verzichtet auf jede Nutzungsverfolgung.",
  },
  agb: {
    label: "AGB & Lizenzbedingungen",
    titel: "AGB & Lizenzbedingungen",
    text: "Die Allgemeinen Geschäfts- und Lizenzbedingungen sind in diesem Prototyp noch nicht hinterlegt. Verbindliche Bedingungen enthält erst ein konkretes Angebot.",
  },
};

/** Link in der Fußzeile: 13 px Text 3, am Telefon 44 px Trefferhöhe. */
const fussLink = "inline-flex min-h-11 min-w-11 items-center text-left text-[13px] text-fg-3 transition-colors duration-100 hover:text-fg sm:min-h-6";

/** Fuß (DESIGN-SYSTEM.md 14.13): Linie oben, Links 13 Text 3, kleine Wortmarke, Pflichtangaben unverändert. */
export function Fusszeile() {
  const jahr = new Date().getFullYear();
  const [rechtliches, setRechtliches] = useState<Rechtliches | null>(null);
  // Inhalt beim Ausblenden stehen lassen, damit der Dialog nicht leer animiert
  const [zuletzt, setZuletzt] = useState<Rechtliches>("impressum");
  const oeffne = (k: Rechtliches) => {
    setZuletzt(k);
    setRechtliches(k);
  };
  const info = RECHTLICHES[rechtliches ?? zuletzt];
  return (
    <footer className="border-t border-[var(--line)] px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
        <div>
          <Wortmarke size={18} />
          <p className="mt-4 max-w-[40ch] text-[13px] leading-5 text-fg-3">Ein Werkzeug. Volle Kontrolle. Die Kanzlei-Software, die mitdenkt – mit Lifetime-Lizenz statt Abo.</p>
          <p className="mt-3 flex items-center gap-2 text-[13px] leading-5 text-fg-3">
            <Lock className="size-3.5 shrink-0 text-fg-4" aria-hidden /> Keine externen Schriften, ohne Nutzungsverfolgung.
          </p>
        </div>
        <nav aria-labelledby="fuss-produkt">
          <h2 id="fuss-produkt" className="mb-2 text-[13px] font-medium text-fg">
            Produkt
          </h2>
          <ul className="grid sm:gap-1.5">
            {ANKER.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => scrollZu(a.id)} className={fussLink}>
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-2 text-[13px] font-medium text-fg">Rechtliches</h2>
          <ul className="grid sm:gap-1.5">
            {(Object.keys(RECHTLICHES) as Rechtliches[]).map((k) => (
              <li key={k}>
                <button type="button" onClick={() => oeffne(k)} className={fussLink} aria-haspopup="dialog">
                  {RECHTLICHES[k].label}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => useAnfrage.getState().oeffne("angebot")} className={fussLink + " mt-3 font-medium !text-fg-2 hover:!text-fg"} aria-haspopup="dialog">
            Angebot anfordern – Antwort innerhalb eines Werktags
          </button>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--line)] pt-6 text-[12px] leading-4 text-fg-4">
        <span>© {jahr} Apex. Alle Rechte vorbehalten.</span>
        <span>Vergleiche beziehen sich auf klassische Kanzleisoftware im Allgemeinen.</span>
      </div>
      <Modal
        open={rechtliches !== null}
        onClose={() => setRechtliches(null)}
        size="sm"
        icon={<FileText className="size-5" />}
        title={info.titel}
        subtitle="Platzhalter im Prototyp"
        footer={
          <Button variant="primary" data-autofocus onClick={() => setRechtliches(null)}>
            Verstanden
          </Button>
        }
      >
        <Chip tone="amber">Im Prototyp nicht hinterlegt</Chip>
        <p className="mt-3 text-[14px] leading-[22px] text-fg-2">{info.text}</p>
        <p className="mt-3 text-[13px] leading-5 text-fg-3">Diese Produktseite ist eine Vorschau von Apex für Präsentationen. Firmen- und Kontaktangaben werden hier bewusst nicht vorweggenommen.</p>
      </Modal>
    </footer>
  );
}

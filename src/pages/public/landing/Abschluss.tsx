import { useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertOctagon, ArrowRight, Clock, FileText, Hourglass, Link2Off, Lock, Mail, Plus, Receipt, Search, ShieldAlert, TrendingUp } from "lucide-react";
import { Button, Chip, Modal } from "@/components/ui";
import { AppIcon, Wordmark } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { Abschnitt, Kopf, Reveal, scrollZu } from "./basis";
import { ANKER } from "./Navigation";

const PROBLEME = [
  { i: <AlertOctagon className="size-5" />, p: "Nach dem Update funktioniert der gewohnte Ablauf nicht mehr.", l: "Getestete Updates – Zeitpunkt wählen Sie." },
  { i: <Hourglass className="size-5" />, p: "45 bis 60 Minuten in der Hotline-Warteschleife.", l: "Fester Ansprechpartner mit Durchwahl." },
  { i: <Link2Off className="size-5" />, p: "beA oder E-Mail streikt – mit einer Fehlermeldung, die niemand versteht.", l: "Live-Status und Fehler in Klartext." },
  { i: <Search className="size-5" />, p: "Die Suche in großen Akten dauert länger als das Blättern.", l: "Volltextsuche über alles mit ⌘K." },
  { i: <Receipt className="size-5" />, p: "Das Forderungskonto rechnet Zinsen nicht vollständig.", l: "Taggenaue Zinsen, Verrechnung nach § 367 BGB." },
  { i: <Mail className="size-5" />, p: "Nach dem E-Mail-Versand ist der Fallkontext weg.", l: "Versand aus der Akte bleibt in der Akte." },
  { i: <ShieldAlert className="size-5" />, p: "Für die Software braucht es lokale Admin-Rechte.", l: "Läuft ohne Admin-Rechte." },
  { i: <TrendingUp className="size-5" />, p: "Jedes Jahr höhere Monatsgebühren.", l: "Einmal investieren, für immer nutzen." },
];

export function Erfahrungen() {
  return (
    <Abschnitt>
      <Kopf
        eyebrow="Gebaut nach den Erfahrungen von Kanzleien"
        titel={
          <>
            Wir haben zugehört.
            <br /> <span className="text-fg-3">Und diese Probleme gelöst.</span>
          </>
        }
        text="AnwaltApex entstand aus den häufigsten Ärgernissen, die Anwältinnen, Anwälte und Fachangestellte mit ihrer Kanzleisoftware erleben."
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PROBLEME.map((x, k) => (
          <Reveal as="li" key={x.p} delay={(k % 4) * 0.05} className="sheet glow group relative flex flex-col rounded-[24px] p-5">
            <span className="relative z-[1] grid size-10 place-items-center rounded-[13px] bg-seal-soft text-seal transition-colors duration-300 group-hover:bg-green-soft group-hover:text-green">{x.i}</span>
            <p className="relative z-[1] mb-4 mt-4 text-[14.5px] font-medium leading-snug text-fg-2">{x.p}</p>
            <p className="relative z-[1] mt-auto flex items-start gap-2 border-t border-[var(--line)] pt-3 text-[13px] font-semibold text-green">
              <ArrowRight className="mt-0.5 size-4 shrink-0" />
              {x.l}
            </p>
          </Reveal>
        ))}
      </ul>
    </Abschnitt>
  );
}

const FRAGEN = [
  { f: "Was bedeutet „Lifetime-Lizenz“ genau?", a: "Sie erwerben AnwaltApex einmalig und dürfen die Software dauerhaft nutzen – ohne monatliche Lizenzgebühren. Eine optionale Wartung ist transparent geregelt; ob und wie lange Sie sie nutzen, entscheiden Sie." },
  { f: "Was kostet AnwaltApex?", a: "Die einmalige Investition richtet sich nach der Kanzleigröße, also nach Arbeitsplätzen und gewünschten Modulen. Ihr persönliches Angebot erhalten Sie innerhalb von 24 Stunden." },
  { f: "Wo liegen unsere Daten?", a: "Entweder in einem deutschen Rechenzentrum (Private Cloud) oder auf einem Server in Ihrer Kanzlei (On-Premise). Die Daten jeder Kanzlei sind auf Datenbankebene streng getrennt." },
  { f: "Ersetzt die KI die anwaltliche Prüfung?", a: "Nein. Die KI erkennt, fasst zusammen und schlägt vor – etwa eine Frist aus einem Urteil oder passende Präzedenzfälle. Fristen berechnet ausschließlich der geprüfte Fristenrechner mit nachvollziehbarem Rechenweg. Übernommen wird nur, was Sie freigeben." },
  { f: "Wie läuft der Umzug aus unserer bisherigen Software?", a: "Sie laden den Export Ihrer bisherigen Kanzleisoftware hoch. AnwaltApex zeigt eine Vorschau, erkennt Dubletten, rechnet Fristen nach und legt sie zur Vier-Augen-Kontrolle vor. Auf Wunsch arbeiten Sie eine Zeit lang parallel." },
  { f: "Ist das beA angebunden?", a: "Ja. beA-Nachrichten und E-Mails landen in einem gemeinsamen Posteingang. Die KI ordnet sie der Akte zu, erkennt Fristen und bereitet das elektronische Empfangsbekenntnis vor – abgegeben wird es erst, wenn die Frist notiert ist." },
  { f: "Können wir AnwaltApex vorher testen?", a: "Gern. Sie erhalten einen eigenen Testzugang – auf Wunsch mit Beispieldaten – und einen festen Ansprechpartner, der Sie durch die ersten Schritte begleitet." },
];

export function Faq() {
  const [offen, setOffen] = useState<number | null>(0);
  return (
    <Abschnitt id="faq">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
        <Kopf
          className="!mb-0 lg:sticky lg:top-24 lg:self-start"
          eyebrow="Häufige Fragen"
          titel="Gut zu wissen."
          text="Ihre Frage ist nicht dabei? Stellen Sie sie in der Demo – direkt Ihrem persönlichen Ansprechpartner."
        />
        <Reveal>
          <ul className="sheet divide-y divide-[var(--line)] overflow-hidden rounded-[28px]">
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
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--ink-softer)] sm:px-6 sm:py-5"
                    >
                      <span className="flex-1 text-[15.5px] font-semibold tracking-[-0.01em]">{q.f}</span>
                      <motion.span animate={{ rotate: auf ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cn("grid size-8 shrink-0 place-items-center rounded-full transition-colors", auf ? "bg-ink text-[var(--on-ink)]" : "bg-[var(--ink-softer)] text-fg-2")}>
                        <Plus className="size-4" />
                      </motion.span>
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
                        transition={{ type: "spring", stiffness: 420, damping: 38 }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[68ch] px-5 pb-5 text-[14.5px] leading-relaxed text-fg-2 sm:px-6">{q.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </Abschnitt>
  );
}

export function Schluss() {
  const nav = useNavigate();
  return (
    <section className="px-4 pb-16 pt-4 sm:px-6 md:pb-24">
      <Reveal className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[34px] bg-[var(--fg)] px-6 py-12 text-[var(--bg)] sm:px-12 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, var(--ink-bright), transparent 65%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-10 size-[360px] rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, var(--aura-3), transparent 65%)" }} />
        <div className="relative grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <AppIcon size={48} />
            <h2 className="mt-6 max-w-[16ch] text-[clamp(32px,4.6vw,56px)] font-bold leading-[1.02] tracking-[-0.045em]">Eine Kanzlei-Software, die Ihnen gehört.</h2>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed opacity-75">Testen Sie AnwaltApex mit Beispieldaten – Fristen, Posteingang, KI-Fallanalyse und 38h-Motor, so wie sie morgen in Ihrer Kanzlei laufen.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" iconRight={<ArrowRight className="size-4" />} onClick={() => nav("/login")}>
              Demo starten
            </Button>
            <button type="button" onClick={() => nav("/login")} className="btn btn-lg bg-[color-mix(in_oklab,var(--bg)_14%,transparent)] text-[var(--bg)] hover:bg-[color-mix(in_oklab,var(--bg)_22%,transparent)]">
              Anmelden
            </button>
          </div>
        </div>
      </Reveal>
    </section>
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
    text: "Die Datenschutzerklärung (Informationen nach Art. 13 DSGVO) ist in diesem Prototyp noch nicht hinterlegt. Diese Seite lädt keine externen Schriften und setzt kein Tracking ein.",
  },
  agb: {
    label: "AGB & Lizenzbedingungen",
    titel: "AGB & Lizenzbedingungen",
    text: "Die Allgemeinen Geschäfts- und Lizenzbedingungen sind in diesem Prototyp noch nicht hinterlegt. Verbindliche Bedingungen enthält erst ein konkretes Angebot.",
  },
};

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
    <footer className="border-t border-[var(--line)] px-4 pb-[max(28px,env(safe-area-inset-bottom))] pt-10 sm:px-6">
      <div className="mx-auto grid max-w-[1200px] gap-8 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div>
          <div className="flex items-center gap-2.5">
            <AppIcon size={30} />
            <Wordmark size={17} />
          </div>
          <p className="mt-3 max-w-[38ch] text-[13px] leading-relaxed text-fg-3">Ein Werkzeug. Volle Kontrolle. Die Kanzlei-Software, die mitdenkt – mit Lifetime-Lizenz statt Abo.</p>
          <p className="mt-4 flex items-center gap-2 text-[12px] text-fg-4">
            <Lock className="size-3.5" /> Keine externen Schriften, kein Tracking auf dieser Seite.
          </p>
        </div>
        <nav aria-label="Produkt">
          <div className="eyebrow mb-3">Produkt</div>
          <ul className="grid gap-2 text-[13.5px]">
            {ANKER.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => scrollZu(a.id)} className="text-fg-2 transition-colors hover:text-ink">
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <div className="eyebrow mb-3">Rechtliches</div>
          <ul className="grid gap-2 text-[13.5px]">
            {(Object.keys(RECHTLICHES) as Rechtliches[]).map((k) => (
              <li key={k}>
                <button type="button" onClick={() => oeffne(k)} className="text-fg-2 transition-colors hover:text-ink" aria-haspopup="dialog">
                  {RECHTLICHES[k].label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-fg-4">
            <Clock className="size-3.5" /> Angebot innerhalb von 24 Stunden
          </p>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1200px] flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-[12px] text-fg-4">
        <span>© {jahr} AnwaltApex. Alle Rechte vorbehalten.</span>
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
        <Chip tone="amber" dot>
          Im Prototyp nicht hinterlegt
        </Chip>
        <p className="mt-3 text-[14px] leading-relaxed text-fg-2">{info.text}</p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">Diese Produktseite ist eine Vorschau von AnwaltApex für Präsentationen. Firmen- und Kontaktangaben werden hier bewusst nicht vorweggenommen.</p>
      </Modal>
    </footer>
  );
}

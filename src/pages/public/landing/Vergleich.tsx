import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { AppIcon } from "@/components/Logo";
import { Abschnitt, Kopf, Reveal } from "./basis";

export const VERGLEICH: { thema: string; klassisch: string; apex: string }[] = [
  { thema: "Aktualisierungen", klassisch: "Aktualisierungen kommen ungefragt – und bringen Abläufe durcheinander.", apex: "Vor der Auslieferung automatisiert geprüft; Sie wählen den Zeitpunkt, Rückweg inklusive – im Rahmen der Wartung." },
  { thema: "Persönliche Hilfe", klassisch: "Lange Telefon-Warteschleifen, Anfragen ohne Lösung.", apex: "Feste Ansprechpartnerin mit Durchwahl, Schnellhilfe in jeder Ansicht und der Apex Assistent als Sprachassistent." },
  { thema: "Betriebsstatus der Schnittstellen", klassisch: "beA-, E-Mail- und Word-Anbindung mit kryptischen Fehlermeldungen.", apex: "Betriebsstatus für beA, E-Mail, Bank und KI – Fehler in Klartext mit nächstem Schritt." },
  { thema: "Suche in großen Akten", klassisch: "Suchen dauert – gerade in umfangreichen Akten.", apex: "Volltextsuche über Akten, Dokumente, Fristen und Urteile mit einem Tastendruck." },
  { thema: "Forderungskonto", klassisch: "Lückenhaft: Zinsen und Verrechnung werden nachgerechnet.", apex: "Taggenaue Zinsen nach § 288 BGB, Verrechnung nach § 367 BGB, Forderungsaufstellung." },
  { thema: "Kontext nach E-Mail-Versand", klassisch: "Nach dem Versand ist der Fall aus dem Blick – Ablage von Hand.", apex: "Versand aus der Akte bleibt in der Akte – Sie arbeiten ohne Unterbrechung weiter." },
  { thema: "Sicherheit ohne Admin-Rechte", klassisch: "Lokale Admin-Rechte und Virenscanner-Ausnahmen als Notlösung.", apex: "Läuft ohne lokale Admin-Rechte; Rollen und Rechte zentral verwaltet." },
  { thema: "Kostenmodell", klassisch: "Monatliche Gebühren – Preiserhöhungen inklusive.", apex: "Einmalige Investition, unbefristete Lizenz ohne Monatsgebühren; Wartung optional – Umfang und Preis regelt das Angebot." },
  { thema: "Umzug", klassisch: "Hoher Migrationsaufwand bindet an den Anbieter.", apex: "Umzug in fünf Schritten – mit Vorschau und Rückgängig: Akten, Kontakte und Fristen ziehen mit Dublettenprüfung um." },
];

/** Symbol plus Text für Screenreader (statt aria-label an einem Element ohne Rolle). */
function Nein() {
  return (
    <>
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-seal-soft text-seal" aria-hidden>
        <X className="size-3.5" strokeWidth={2.6} />
      </span>
      <span className="sr-only">Nachteil: </span>
    </>
  );
}
function Ja({ i }: { i: number }) {
  return (
    <motion.span
      initial={{ scale: 0.6, rotate: -20 }}
      whileInView={{ scale: 1, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 520, damping: 22, delay: 0.1 + i * 0.04 }}
      className="grid size-6 shrink-0 place-items-center rounded-full bg-green-soft text-green"
      aria-hidden
    >
      <Check className="size-3.5" strokeWidth={2.8} />
    </motion.span>
  );
}
function JaText() {
  return <span className="sr-only">Vorteil: </span>;
}

export function Vergleich() {
  return (
    <Abschnitt id="vergleich">
      <Kopf
        eyebrow="Der Unterschied im Alltag"
        titel={
          <>
            Apex gegenüber
            <br /> <span className="text-fg-3">klassischer Kanzleisoftware</span>
          </>
        }
        text="Was Kanzleien an ihrer Software am meisten bremst – und wie Apex es löst."
      />

      {/* Desktop: Tabelle */}
      <Reveal className="sheet relative hidden overflow-hidden rounded-[28px] md:block">
        <table className="w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">Vergleich von Apex mit klassischer Kanzleisoftware</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] px-6 pb-4 pt-6 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-fg-3">
                Thema
              </th>
              <th scope="col" className="w-[37%] px-6 pb-4 pt-6 text-[14px] font-semibold text-fg-2">
                Klassische Kanzleisoftware
              </th>
              <th scope="col" className="w-[41%] bg-ink-softer px-6 pb-4 pt-6">
                <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                  <AppIcon size={26} />
                  Apex
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {VERGLEICH.map((z, i) => (
              <tr key={z.thema} className="group">
                <th scope="row" className="border-t border-[var(--line)] px-6 py-4 align-top text-[14px] font-semibold transition-colors group-hover:bg-[var(--ink-softer)]">
                  {z.thema}
                </th>
                <td className="border-t border-[var(--line)] px-6 py-4 align-top transition-colors group-hover:bg-[var(--ink-softer)]">
                  <span className="flex gap-3 text-[14px] leading-relaxed text-fg-3">
                    <Nein />
                    {z.klassisch}
                  </span>
                </td>
                <td className="border-t border-[var(--line)] bg-ink-softer px-6 py-4 align-top transition-colors group-hover:bg-ink-soft">
                  <span className="flex gap-3 text-[14px] font-medium leading-relaxed text-fg">
                    <Ja i={i} />
                    <JaText />
                    {z.apex}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>

      {/* Smartphone: Karten */}
      <ul className="grid gap-3 md:hidden">
        {VERGLEICH.map((z, i) => (
          <Reveal as="li" key={z.thema} y={14} className="sheet rounded-[22px] p-4">
            <div className="eyebrow mb-3">{z.thema}</div>
            <div className="flex gap-3 text-[13.5px] leading-relaxed text-fg-3">
              <Nein />
              <span>
                <span className="block text-[12.5px] font-semibold text-fg-3">Klassisch</span>
                {z.klassisch}
              </span>
            </div>
            <div className="mt-3 flex gap-3 rounded-[14px] bg-ink-softer p-3 text-[13.5px] font-medium leading-relaxed">
              <Ja i={i} />
              <JaText />
              <span>
                <span className="block text-[12.5px] font-semibold text-ink">Apex</span>
                {z.apex}
              </span>
            </div>
          </Reveal>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-fg-2">Zusammenfassung typischer Erfahrungsberichte aus Kanzleien; einzelne Produkte können abweichen.</p>
    </Abschnitt>
  );
}

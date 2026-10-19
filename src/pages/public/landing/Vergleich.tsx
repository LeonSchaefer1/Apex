import { Check, Minus } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Abschnitt, Kopf, Leise } from "./basis";

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

/** Symbol plus Text für Screenreader (statt aria-label an einem Element ohne Rolle). Neutral: kein Rot, kein Grün. */
function Nein() {
  return (
    <>
      <Minus className="mt-[3px] size-4 shrink-0 text-fg-4" aria-hidden />
      <span className="sr-only">Nachteil: </span>
    </>
  );
}
function Ja() {
  return (
    <>
      <Check className="mt-[3px] size-4 shrink-0 text-fg" aria-hidden />
      <span className="sr-only">Vorteil: </span>
    </>
  );
}

/**
 * Vergleich (DESIGN-SYSTEM.md 14.6): Tabelle nach 12.4 – waagerechte Linien, Apex-Spalte mit Kopf 600 und Fläche 2;
 * Check in Text 1, Minus in Text 4. Am Telefon eine Liste mit Linien statt Karten.
 */
export function Vergleich() {
  return (
    <Abschnitt id="vergleich" labelledBy="vergleich-titel">
      <Kopf
        id="vergleich-titel"
        eyebrow="Der Unterschied im Alltag"
        titel={
          <>
            Apex gegenüber
            <br /> <Leise>klassischer Kanzleisoftware</Leise>
          </>
        }
        text="Was Kanzleien an ihrer Software am meisten bremst – und wie Apex es löst."
      />

      {/* Desktop: Tabelle */}
      <div className="hidden overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] md:block">
        <table className="w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">Vergleich von Apex mit klassischer Kanzleisoftware</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] px-6 py-3.5 text-[13px] font-medium text-fg-3">
                Thema
              </th>
              <th scope="col" className="w-[37%] px-6 py-3.5 text-[13px] font-medium text-fg-3">
                Klassische Kanzleisoftware
              </th>
              <th scope="col" className="w-[41%] bg-[var(--surface-2)] px-6 py-3.5">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <LogoMark size={16} />
                  Apex
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {VERGLEICH.map((z) => (
              <tr key={z.thema}>
                <th scope="row" className="border-t border-[var(--line)] px-6 py-4 align-top text-[14px] font-medium leading-[22px] text-fg">
                  {z.thema}
                </th>
                <td className="border-t border-[var(--line)] px-6 py-4 align-top">
                  <span className="flex gap-3 text-[14px] leading-[22px] text-fg-3">
                    <Nein />
                    {z.klassisch}
                  </span>
                </td>
                <td className="border-t border-[var(--line)] bg-[var(--surface-2)] px-6 py-4 align-top">
                  <span className="flex gap-3 text-[14px] leading-[22px] text-fg">
                    <Ja />
                    {z.apex}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Telefon: Liste mit Linien */}
      <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] md:hidden">
        {VERGLEICH.map((z) => (
          <li key={z.thema} className="py-5">
            <h3 className="text-[15px] font-semibold leading-[22px] text-fg">{z.thema}</h3>
            <div className="mt-3 flex gap-3 text-[14px] leading-[22px] text-fg-3">
              <Nein />
              <span>
                <span className="block text-[12px] font-medium leading-4 text-fg-4">Klassisch</span>
                {z.klassisch}
              </span>
            </div>
            <div className="mt-3 flex gap-3 text-[14px] leading-[22px] text-fg">
              <Ja />
              <span>
                <span className="block text-[12px] font-semibold leading-4 text-fg">Apex</span>
                {z.apex}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] leading-5 text-fg-3">Zusammenfassung typischer Erfahrungsberichte aus Kanzleien; einzelne Produkte können abweichen.</p>
    </Abschnitt>
  );
}

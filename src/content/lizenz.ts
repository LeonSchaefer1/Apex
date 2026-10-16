// Einheitlicher Wortlaut zu Preis, Lizenz, Wartung, Übertragbarkeit und Quellcode-Hinterlegung – für Lizenz-Tab, Landing und ROI-Rechner.
// Geschäftliche Zusagen (Preis, Wartungssatz, Übertragbarkeit, Escrow, EU-Verarbeitung der Live-KI) entscheidet der Auftraggeber.
// Im Produkt steht dazu nur Neutrales („im Angebot geregelt“ bzw. „auf Anfrage“) – keine erfundenen Zahlen oder Zusagen.

/** Ein Satz für alle Preisangaben (Landing, Lizenz-Tab, Rechner). */
export const PREIS_HINWEIS = "Preis auf Anfrage – verbindlich im Angebot";
/** Wartung ohne Satz und ohne Betrag. */
export const WARTUNG_HINWEIS = "Wartung: Umfang und Preis regelt das Angebot";
export const UEBERTRAGBARKEIT_HINWEIS = "Übertragbarkeit der Lizenz: im Angebot geregelt";
export const ESCROW_HINWEIS = "Quellcode-Hinterlegung (Escrow): auf Anfrage";
/** Verarbeitungsort der Live-KI (EU-Option) – Entscheidung des Auftraggebers. */
export const KI_EU_HINWEIS = "Verarbeitung der Live-KI in der EU: auf Anfrage";

export const LIZENZ_KENNZEICHNUNG = "Entwurf der Lizenzbedingungen – verbindlich ist das Angebot";

/** Was die Wartung umfasst und was ohne Wartung gilt – ohne Satz und ohne Preis. */
export const WARTUNG_INHALT = {
  titel: "Wartung (optional)",
  kurz: `${WARTUNG_HINWEIS}.`,
  enthalten: [
    "Anpassungen an Gesetzes- und Tabellenänderungen (RVG/GKG, halbjährlicher Basiszins, Feiertage, Fristregeln)",
    "Anpassungen an Änderungen der beA-Schnittstelle",
    "Sicherheits- und Funktionsaktualisierungen",
    "Betreuung durch Ihre feste Ansprechpartnerin",
  ],
  ohne: [
    "Software und Daten bleiben unbefristet nutzbar und vollständig exportierbar",
    "Tabellen, Basiszins und Feiertage pflegen Sie selbst",
    "die beA-Anbindung kann bei Schnittstellenänderungen der BRAK ausfallen",
    "keine Betreuung",
  ],
} as const;

/** Vollständiger Satz zur Wartung (für Fließtext und FAQ). */
export const WARTUNG_TEXT = `${WARTUNG_HINWEIS}. Enthalten: ${WARTUNG_INHALT.enthalten.join(", ")}. Ohne Wartung: ${WARTUNG_INHALT.ohne.join("; ")}.`;

/**
 * Gesamtkosten einer Lifetime-Lizenz über `jahre` Jahre: Lizenzpreis plus Wartung je Jahr (Werte aus dem eigenen Angebot).
 * `erstesJahrEnthalten` = die Wartung des ersten Jahres ist im Lizenzpreis enthalten.
 */
export function kostenLifetime(lizenzpreis: number, wartungJahr: number, jahre: number, erstesJahrEnthalten = true): number {
  const j = Math.max(0, Math.floor(jahre));
  const wartungsjahre = Math.max(0, j - (erstesJahrEnthalten ? 1 : 0));
  return Math.max(0, lizenzpreis) + Math.max(0, wartungJahr) * wartungsjahre;
}

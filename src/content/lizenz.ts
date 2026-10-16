// Einheitlicher Wortlaut zu Lizenz, Wartung, Übertragbarkeit und Quellcode-Hinterlegung – für Lizenz-Tab, Landing und ROI-Rechner.
// Richtwerte bzw. Entwurf der Lizenzbedingungen: verbindlich ist das Angebot (vom Auftraggeber vor externer Nutzung zu bestätigen).

export const LIZENZ_KENNZEICHNUNG = "Richtwert/Entwurf der Lizenzbedingungen – verbindlich im Angebot";

/** Wartung: Richtwert 15 % des Lizenzpreises pro Jahr, das erste Jahr ist enthalten. */
export const WARTUNG_SATZ = 0.15;
export const WARTUNG_ERSTES_JAHR_ENTHALTEN = true;

export const WARTUNG = {
  titel: "Wartung (optional)",
  kurz: "Wartung (optional): Richtwert 15 % des Lizenzpreises pro Jahr, das erste Jahr ist enthalten.",
  enthalten: [
    "Anpassungen an Gesetzes- und Tabellenänderungen (RVG/GKG, halbjährlicher Basiszins, Feiertage, Fristregeln)",
    "Anpassungen an Änderungen der beA-Schnittstelle",
    "Sicherheits- und Funktionsupdates",
    "Support durch Ihre feste Ansprechpartnerin",
  ],
  ohne: [
    "Software und Daten bleiben unbefristet nutzbar und vollständig exportierbar",
    "Tabellen, Basiszins und Feiertage pflegen Sie selbst",
    "die beA-Anbindung kann bei Schnittstellenänderungen der BRAK ausfallen",
    "kein Support",
  ],
} as const;

/** Vollständiger Satz zur Wartung (für Fließtext und FAQ). */
export const WARTUNG_TEXT = `${WARTUNG.kurz} Enthalten: ${WARTUNG.enthalten.join(", ")}. Ohne Wartung: ${WARTUNG.ohne.join("; ")}.`;

export const UEBERTRAGBARKEIT = "Übertragbarkeit: bei Kanzleiübergabe, Fusion oder Verkauf auf die Nachfolge übertragbar (vorgesehen)";
export const ESCROW = "Quellcode-Hinterlegung (Escrow) bei einem Treuhänder mit Herausgabe bei Insolvenz oder Einstellung (vorgesehen)";

/** Jahreskosten der Lifetime-Lizenz inkl. Wartung ab Jahr 2 – Jahr 1 ist enthalten. */
export function kostenMitWartung(lizenzpreis: number, jahre: number): number {
  const wartungsjahre = Math.max(0, jahre - (WARTUNG_ERSTES_JAHR_ENTHALTEN ? 1 : 0));
  return lizenzpreis + lizenzpreis * WARTUNG_SATZ * wartungsjahre;
}

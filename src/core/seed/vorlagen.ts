// Fallvorlagen je Sachgebiet – erzeugen glaubwürdige Akten mit Dokumenten, Fristen und Abrechnung.
import type { AktenPhase, DokumentArt, Dokument, FristTyp, Sachgebiet } from "../types";
import type { StadtDaten } from "./pools";

export interface Parteien {
  M: string; // Mandant (Anzeige)
  MA: string; // Anrede-Name „Herr Müller"
  G: string; // Gegner
  GER: string; // Gericht
  ORT: string;
  J: number; // Jahre (Betriebszugehörigkeit etc.)
  BETRAG: string; // formatierter Betrag
  DATUM: string; // relevantes Datum (formatiert)
  AZ: string; // gerichtliches Aktenzeichen
}

export interface FallVorlage {
  key: string;
  sachgebiet: Sachgebiet;
  titel: (p: Parteien) => string;
  beschreibung: (p: Parteien) => string;
  schlagworte: string[];
  gegner: "person" | "firma" | "hausverwaltung" | "kfzversicherer" | "behoerde" | "keiner";
  gericht?: keyof StadtDaten["gerichte"];
  wert: [number, number];
  fristen: { regel?: string; titel?: string; typ?: FristTyp; offset: [number, number] }[];
  dokumente: { name: string; art: DokumentArt; ordner: Dokument["ordner"]; text: (p: Parteien) => string }[];
  phasen: AktenPhase[];
  forderung?: boolean;
  rvg: string[];
  rsv?: boolean;
}

const brief = (p: Parteien, betreff: string, body: string) =>
  `${p.ORT}, ${p.DATUM}\n\nBetreff: ${betreff}\n\n${body}\n\nMit freundlichen Grüßen`;

export const VORLAGEN: FallVorlage[] = [
  // ── Arbeitsrecht ──
  {
    key: "ar-kuendigung", sachgebiet: "Arbeitsrecht",
    titel: (p) => `${p.M} ./. ${p.G}`,
    beschreibung: (p) => `Ordentliche, betriebsbedingte Kündigung nach ${p.J} Jahren Betriebszugehörigkeit. Sozialauswahl nicht nachvollziehbar, Betriebsratsanhörung unklar. Ziel: Weiterbeschäftigung, hilfsweise Abfindung. Offen sind zwölf Tage Resturlaub aus dem Vorjahr – auf den Verfall hat die Arbeitgeberin nie hingewiesen.`,
    schlagworte: ["kündigung", "kündigungsschutz", "sozialauswahl", "abfindung", "betriebsbedingt", "urlaub", "urlaubsabgeltung"],
    gegner: "firma", gericht: "arbg", wert: [9000, 19000], rsv: true,
    fristen: [{ regel: "kschg_klage", offset: [6, 18] }],
    dokumente: [
      { name: "Kündigungsschreiben", art: "brief", ordner: "Mandant", text: (p) => `${p.G}\n\nKündigung des Arbeitsverhältnisses\n\nSehr geehrte(r) ${p.MA},\nhiermit kündigen wir das mit Ihnen bestehende Arbeitsverhältnis ordentlich und fristgerecht zum nächstmöglichen Zeitpunkt. Grund ist der Wegfall Ihres Arbeitsplatzes infolge der Umstrukturierung der Abteilung. Der Betriebsrat wurde angehört.` },
      { name: "Arbeitsvertrag", art: "vertrag", ordner: "Mandant", text: (p) => `Arbeitsvertrag zwischen ${p.G} und ${p.M}. Beginn vor ${p.J} Jahren, Vollzeit 40 Stunden, Kündigungsfristen nach § 622 BGB, Ausschlussfrist drei Monate.` },
      { name: "Gesprächsnotiz Erstberatung", art: "notiz", ordner: "Mandant", text: (p) => `Mandant ${p.M} schildert: seit ${p.J} Jahren beschäftigt, zwei unterhaltsberechtigte Kinder, keine Abmahnungen. Kolleg:innen mit kürzerer Betriebszugehörigkeit wurden nicht gekündigt. Wunsch: Abfindung von mindestens 0,5 Bruttomonatsgehältern je Jahr.` },
    ],
    phasen: ["Mandatsaufnahme", "Außergerichtlich", "Gerichtlich"], rvg: ["3100", "3104"],
  },
  {
    key: "ar-ueberstunden", sachgebiet: "Arbeitsrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Überstunden)`,
    beschreibung: (p) => `Mandant macht 214 nicht vergütete Überstunden aus den letzten 18 Monaten geltend (${p.BETRAG}). Arbeitgeber bestreitet Anordnung und Duldung; Zeiterfassung lückenhaft.`,
    schlagworte: ["überstunden", "arbeitszeit", "zeiterfassung", "vergütung", "lohn"],
    gegner: "firma", gericht: "arbg", wert: [5000, 12000],
    fristen: [{ titel: "Stellungnahme zur Klageerwiderung", typ: "frist", offset: [8, 25] }],
    dokumente: [
      { name: "Stundenaufstellung 2025–2026", art: "anlage", ordner: "Anlagen", text: () => `Aufstellung der geleisteten Mehrarbeit nach Kalenderwochen, gesamt 214 Stunden; Belege: Schichtpläne, E-Mails außerhalb der Arbeitszeit, Fahrtenbuch.` },
      { name: "Geltendmachung Überstunden", art: "schriftsatz", ordner: "Korrespondenz", text: (p) => brief(p, "Geltendmachung von Überstundenvergütung", `namens und in Vollmacht unseres Mandanten machen wir Vergütung für 214 Überstunden in Höhe von ${p.BETRAG} brutto geltend und setzen eine Frist von zwei Wochen.`) },
    ],
    phasen: ["Außergerichtlich", "Gerichtlich"], rvg: ["2300", "3100"],
  },
  {
    key: "ar-zeugnis", sachgebiet: "Arbeitsrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Zeugnis)`,
    beschreibung: () => `Berichtigung des Arbeitszeugnisses: Leistungs- und Verhaltensbeurteilung entsprechen nur der Note „befriedigend“, Mandantin verlangt „gut“. Schlussformel fehlt.`,
    schlagworte: ["arbeitszeugnis", "zeugnis", "berichtigung", "notenstufe"],
    gegner: "firma", wert: [3200, 4800],
    fristen: [{ titel: "Wiedervorlage: Antwort Arbeitgeber", typ: "wiedervorlage", offset: [3, 12] }],
    dokumente: [
      { name: "Arbeitszeugnis (Entwurf Arbeitgeber)", art: "anlage", ordner: "Mandant", text: (p) => `Zeugnis für ${p.M}: „... erledigte die übertragenen Aufgaben zu unserer Zufriedenheit ...“ – keine Dankes- und Bedauernsformel.` },
    ],
    phasen: ["Außergerichtlich"], rvg: ["2300"],
  },
  // ── Mietrecht ──
  {
    key: "mr-kaution", sachgebiet: "Mietrecht",
    titel: (p) => `${p.M} ./. ${p.G}`,
    beschreibung: (p) => `Rückzahlung der Mietkaution (${p.BETRAG}). Vermieterin rechnet mit Renovierungskosten auf; die Wohnung wurde bei Einzug unrenoviert übergeben.`,
    schlagworte: ["kaution", "schönheitsreparaturen", "auszug", "renovierung", "unrenoviert"],
    gegner: "hausverwaltung", gericht: "ag", wert: [1500, 3600], rsv: true,
    fristen: [{ titel: "Wiedervorlage: Zahlungsfrist Vermieterin", typ: "wiedervorlage", offset: [2, 14] }],
    dokumente: [
      { name: "Mietvertrag mit Renovierungsklausel", art: "vertrag", ordner: "Mandant", text: () => `§ 8 Schönheitsreparaturen: Der Mieter übernimmt die Schönheitsreparaturen in den üblichen Fristen (Küche 3 Jahre, Wohnräume 5 Jahre). Übergabeprotokoll: Wände vergilbt, Bohrlöcher vorhanden.` },
      { name: "Abrechnung der Kaution", art: "brief", ordner: "Korrespondenz", text: (p) => brief(p, "Kautionsabrechnung", `wir rechnen die Kaution mit Kosten für Malerarbeiten in Höhe von ${p.BETRAG} ab. Ein Auszahlungsbetrag verbleibt nicht.`) },
    ],
    phasen: ["Außergerichtlich", "Gerichtlich"], rvg: ["2300", "3100", "3104"],
  },
  {
    key: "mr-eigenbedarf", sachgebiet: "Mietrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Eigenbedarf)`,
    beschreibung: () => `Eigenbedarfskündigung gegenüber 78-jähriger Mandantin nach 31 Jahren Mietdauer. Widerspruch nach § 574 BGB wegen Härte (Erkrankung, Verwurzelung im Quartier) vorbereitet.`,
    schlagworte: ["eigenbedarf", "härte", "widerspruch", "räumung", "alter", "krankheit"],
    gegner: "person", gericht: "ag", wert: [9000, 15000], rsv: true,
    fristen: [{ titel: "Widerspruch gegen Kündigung (§ 574b BGB)", typ: "frist", offset: [10, 30] }],
    dokumente: [
      { name: "Kündigung wegen Eigenbedarfs", art: "brief", ordner: "Mandant", text: (p) => brief(p, "Kündigung wegen Eigenbedarfs", `hiermit kündige ich das Mietverhältnis wegen Eigenbedarfs für meine Tochter fristgerecht zum Ablauf der gesetzlichen Kündigungsfrist von neun Monaten.`) },
      { name: "Ärztliches Attest", art: "anlage", ordner: "Mandant", text: () => `Attest: Die Patientin leidet an einer fortgeschrittenen Herzinsuffizienz; ein Umzug ist mit erheblichen gesundheitlichen Risiken verbunden.` },
    ],
    phasen: ["Außergerichtlich"], rvg: ["2300"],
  },
  {
    key: "mr-minderung", sachgebiet: "Mietrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Mietminderung)`,
    beschreibung: () => `Schimmelbefall im Schlafzimmer seit Februar, Vermieterin verweist auf falsches Lüftungsverhalten. Minderung von 15 % angekündigt, Gutachten beauftragt.`,
    schlagworte: ["mietminderung", "schimmel", "mangel", "gutachten"],
    gegner: "hausverwaltung", wert: [1200, 4200],
    fristen: [{ titel: "Wiedervorlage: Gutachten Feuchtigkeit", typ: "wiedervorlage", offset: [4, 20] }],
    dokumente: [
      { name: "Mängelanzeige Schimmel", art: "brief", ordner: "Korrespondenz", text: (p) => brief(p, "Mängelanzeige", `unsere Mandantschaft zeigt erneut den Schimmelbefall im Schlafzimmer an und mindert die Miete ab sofort um 15 %.`) },
    ],
    phasen: ["Außergerichtlich"], rvg: ["2300"],
  },
  // ── Verkehrsrecht ──
  {
    key: "vr-unfall", sachgebiet: "Verkehrsrecht",
    titel: (p) => `${p.M} ./. ${p.G}`,
    beschreibung: (p) => `Verkehrsunfall an einer Kreuzung in ${p.ORT}, Vorfahrtsverletzung des Unfallgegners. Gegnerische Haftpflichtversicherung kürzt Reparaturkosten laut Gutachten (${p.BETRAG}) und verweist auf freie Werkstatt.`,
    schlagworte: ["verkehrsunfall", "haftungsquote", "reparaturkosten", "gutachten", "versicherung kürzt", "freie werkstatt"],
    gegner: "kfzversicherer", wert: [3800, 14500],
    fristen: [{ titel: "Wiedervorlage: Regulierung Versicherung", typ: "wiedervorlage", offset: [2, 15] }],
    dokumente: [
      { name: "Schadensgutachten", art: "gutachten", ordner: "Anlagen", text: (p) => `Kfz-Gutachten: Reparaturkosten netto ${p.BETRAG}, Wertminderung 600 €, Nutzungsausfall 12 Tage à 59 €. Fahrzeug 2 Jahre alt, scheckheftgepflegt in Markenwerkstatt.` },
      { name: "Abrechnungsschreiben Versicherung", art: "brief", ordner: "Korrespondenz", text: (p) => brief(p, "Ihr Schadenfall", `wir regulieren auf Basis der Stundenverrechnungssätze einer zumutbaren freien Fachwerkstatt und kürzen um 1.284,50 €.`) },
    ],
    phasen: ["Außergerichtlich"], rvg: ["2300"],
  },
  {
    key: "vr-bussgeld", sachgebiet: "Verkehrsrecht",
    titel: (p) => `Bußgeldsache ${p.M}`,
    beschreibung: () => `Geschwindigkeitsüberschreitung innerorts um 32 km/h (Messung mit Lasermessgerät). Drohend: 260 € Bußgeld, 2 Punkte, 1 Monat Fahrverbot. Mandant ist beruflich auf den Führerschein angewiesen.`,
    schlagworte: ["bußgeld", "blitzer", "geschwindigkeit", "fahrverbot", "rohmessdaten"],
    gegner: "behoerde", wert: [500, 1200], rsv: true,
    fristen: [{ regel: "einspruch_bussgeld", offset: [3, 11] }],
    dokumente: [
      { name: "Bußgeldbescheid", art: "bea", ordner: "Mandant", text: (p) => `Bußgeldbescheid gegen ${p.M}: Überschreitung der zulässigen Höchstgeschwindigkeit innerorts um 32 km/h. Geldbuße 260 €, Fahrverbot 1 Monat. Gegen diesen Bescheid kann innerhalb von zwei Wochen nach Zustellung Einspruch eingelegt werden.` },
    ],
    phasen: ["Außergerichtlich", "Gerichtlich"], rvg: [],
  },
  // ── Erbrecht ──
  {
    key: "er-pflichtteil", sachgebiet: "Erbrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Pflichtteil)`,
    beschreibung: (p) => `Pflichtteilsanspruch der enterbten Tochter. Nachlass: Eigentumswohnung in ${p.ORT}, Depot, Lebensversicherung. Auskunft und Wertermittlung nach § 2314 BGB verlangt.`,
    schlagworte: ["pflichtteil", "nachlass", "auskunft", "wertermittlung", "enterbung"],
    gegner: "person", wert: [25000, 95000],
    fristen: [{ titel: "Wiedervorlage: Nachlassverzeichnis", typ: "wiedervorlage", offset: [5, 21] }],
    dokumente: [
      { name: "Notarielles Testament", art: "anlage", ordner: "Mandant", text: () => `Testament: Alleinerbe wird der Sohn. Die Tochter wird auf den Pflichtteil gesetzt.` },
      { name: "Auskunftsverlangen § 2314 BGB", art: "schriftsatz", ordner: "Korrespondenz", text: (p) => brief(p, "Auskunft über den Nachlassbestand", `namens unserer Mandantin verlangen wir Auskunft durch ein notarielles Nachlassverzeichnis sowie Wertermittlung der Immobilie durch Sachverständigengutachten.`) },
    ],
    phasen: ["Außergerichtlich"], rvg: ["2300"],
  },
  {
    key: "er-testament", sachgebiet: "Erbrecht",
    titel: (p) => `Testamentsgestaltung ${p.M}`,
    beschreibung: () => `Ehepaar wünscht Berliner Testament mit Pflichtteilsstrafklausel; Patchwork-Familie mit Kind aus erster Ehe. Zusätzlich Vorsorgevollmacht und Patientenverfügung.`,
    schlagworte: ["testament", "berliner testament", "pflichtteilsstrafklausel", "vorsorge"],
    gegner: "keiner", wert: [150000, 400000],
    fristen: [{ titel: "Besprechungstermin Testamentsentwurf", typ: "termin", offset: [2, 12] }],
    dokumente: [{ name: "Fragebogen Vermögen", art: "notiz", ordner: "Mandant", text: () => `Vermögensübersicht: Einfamilienhaus, Bankguthaben, vermietete Wohnung, Kind aus erster Ehe des Ehemanns.` }],
    phasen: ["Mandatsaufnahme"], rvg: ["2300"],
  },
  // ── Forderungseinzug ──
  {
    key: "fe-werklohn", sachgebiet: "Forderungseinzug",
    titel: (p) => `${p.M} ./. ${p.G}`,
    beschreibung: (p) => `Offene Werklohnforderung ${p.BETRAG} aus Schlussrechnung. Zwei Mahnungen erfolglos, Schuldner reagiert nicht. Mahnbescheid beantragt; Zinsen nach § 288 Abs. 2 BGB.`,
    schlagworte: ["forderung", "mahnbescheid", "verzug", "vollstreckung", "inkasso", "werklohn"],
    gegner: "firma", gericht: "mahn", wert: [1800, 24000], forderung: true,
    fristen: [{ titel: "Wiedervorlage: Zustellung Mahnbescheid", typ: "wiedervorlage", offset: [2, 14] }],
    dokumente: [
      { name: "Schlussrechnung", art: "rechnung", ordner: "Mandant", text: (p) => `Schlussrechnung über ${p.BETRAG} brutto, zahlbar binnen 14 Tagen.` },
      { name: "Antrag auf Erlass eines Mahnbescheids", art: "schriftsatz", ordner: "Gericht", text: (p) => `Online-Mahnantrag an ${p.GER}: Hauptforderung ${p.BETRAG}, Zinsen 9 Prozentpunkte über dem Basiszinssatz, Verzugspauschale 40 € (§ 288 Abs. 5 BGB).` },
    ],
    phasen: ["Außergerichtlich", "Gerichtlich", "Vollstreckung"], rvg: ["3305", "3308"],
  },
  {
    key: "fe-kaufpreis", sachgebiet: "Forderungseinzug",
    titel: (p) => `${p.M} ./. ${p.G} (Kaufpreis)`,
    beschreibung: (p) => `Kaufpreisforderung aus Warenlieferung ${p.BETRAG}. Vollstreckungsbescheid liegt vor; Schuldner leistet Teilzahlungen. Forderungskonto mit Verrechnung nach § 367 BGB.`,
    schlagworte: ["kaufpreis", "vollstreckungsbescheid", "teilzahlung", "forderungskonto", "zwangsvollstreckung"],
    gegner: "person", gericht: "mahn", wert: [900, 9000], forderung: true,
    fristen: [{ titel: "Wiedervorlage: Ratenzahlung prüfen", typ: "wiedervorlage", offset: [1, 10] }],
    dokumente: [{ name: "Vollstreckungsbescheid", art: "beschluss", ordner: "Gericht", text: (p) => `Vollstreckungsbescheid des ${p.GER} über ${p.BETRAG} nebst Zinsen und Kosten.` }],
    phasen: ["Vollstreckung"], rvg: ["3305", "3308", "3309"],
  },
  // ── Vertragsrecht ──
  {
    key: "vt-gewaehr", sachgebiet: "Vertragsrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Gewährleistung)`,
    beschreibung: (p) => `Mangelhafte Lieferung einer Küchenanlage (${p.BETRAG}). Nacherfüllung zweimal fehlgeschlagen; Rücktritt (§§ 437 Nr. 2, 323 BGB) und daneben Ersatz der Ausbau- und Folgekosten (§§ 437 Nr. 3, 280, 281, 325 BGB).`,
    schlagworte: ["kaufrecht", "mangel", "nacherfüllung", "rücktritt", "einbau", "ausbau"],
    // Gericht folgt dem Wert (§ 23 Nr. 1 GVG): bis 10.000 € Amtsgericht – siehe generischeAkte
    gegner: "firma", gericht: "lg", wert: [8000, 28000],
    fristen: [{ titel: "Klageerwiderung Gegenseite abwarten", typ: "wiedervorlage", offset: [6, 24] }],
    dokumente: [{ name: "Rücktrittserklärung", art: "schriftsatz", ordner: "Korrespondenz", text: (p) => brief(p, "Rücktritt vom Kaufvertrag", `namens unserer Mandantschaft erklären wir den Rücktritt vom Kaufvertrag, nachdem zwei Nachbesserungsversuche fehlgeschlagen sind.`) }],
    phasen: ["Außergerichtlich", "Gerichtlich"], rvg: ["2300", "3100", "3104"],
  },
  {
    key: "vt-pruefung", sachgebiet: "Vertragsrecht",
    titel: (p) => `Vertragsprüfung ${p.M}`,
    beschreibung: () => `Prüfung eines SaaS-Rahmenvertrags (Laufzeit 36 Monate) inkl. AVV nach Art. 28 DSGVO, Haftungsbegrenzung und Kündigungsrechten. Der Anbieter setzt für Cloud-Hosting einen Unterauftragsverarbeiter in den USA ein (Drittlandübermittlung).`,
    schlagworte: ["vertrag", "agb", "prüfung", "haftung", "dsgvo", "avv", "datenschutz", "cloud", "drittland"],
    gegner: "keiner", wert: [20000, 60000],
    fristen: [{ titel: "Abgabe Prüfvermerk an Mandantin", typ: "frist", offset: [1, 8] }],
    dokumente: [{ name: "Rahmenvertrag (Entwurf Anbieter)", art: "vertrag", ordner: "Mandant", text: () => `SaaS-Rahmenvertrag: automatische Verlängerung um 12 Monate, Haftung auf Auftragswert begrenzt, Gerichtsstand Dublin.` }],
    phasen: ["Mandatsaufnahme"], rvg: ["2300"],
  },
  // ── Baurecht ──
  {
    key: "br-maengel", sachgebiet: "Baurecht",
    titel: (p) => `${p.M} ./. ${p.G} (Baumängel)`,
    beschreibung: (p) => `Feuchtigkeitsschäden im Keller des Neubaus, mangelhafte Abdichtung. Selbständiges Beweisverfahren eingeleitet; Kostenvorschuss zur Mängelbeseitigung ${p.BETRAG} (§ 637 Abs. 3 BGB).`,
    schlagworte: ["werkvertrag", "mangel", "gewährleistung", "bau", "vorschuss", "beweisverfahren", "abdichtung"],
    gegner: "firma", gericht: "lg", wert: [30000, 140000],
    fristen: [{ titel: "Ortstermin Sachverständiger", typ: "termin", offset: [5, 26] }],
    dokumente: [
      { name: "Antrag selbständiges Beweisverfahren", art: "schriftsatz", ordner: "Gericht", text: (p) => `Antrag an das ${p.GER} auf Einholung eines Sachverständigengutachtens zu Ursache und Beseitigungskosten der Feuchtigkeitsschäden.` },
      { name: "Fotodokumentation Keller", art: "anlage", ordner: "Anlagen", text: () => `24 Fotos: Ausblühungen, Feuchtigkeitsränder bis 40 cm Höhe, abgelöster Putz.` },
    ],
    phasen: ["Gerichtlich", "Beweisaufnahme"], rvg: ["3100", "3104"],
  },
  {
    key: "br-werklohn", sachgebiet: "Baurecht",
    titel: (p) => `${p.M} ./. ${p.G} (Werklohn)`,
    beschreibung: (p) => `Bauunternehmen klagt Restwerklohn aus Schlussrechnung ein (${p.BETRAG}). Auftraggeber verweigert Abnahme, rügt Mängel am Estrich und kündigt die Aufrechnung mit fiktiven Mängelbeseitigungskosten an.`,
    schlagworte: ["werklohn", "werkvertrag", "abnahme", "schlussrechnung", "vob", "estrich", "mangel", "fiktive kosten"],
    gegner: "firma", gericht: "lg", wert: [18000, 85000],
    fristen: [{ regel: "klageerwiderung", offset: [7, 22] }],
    dokumente: [{ name: "Schlussrechnung und Aufmaß", art: "rechnung", ordner: "Mandant", text: (p) => `Schlussrechnung nach VOB/B über ${p.BETRAG}, Aufmaß vom Estrichleger, Abnahmeprotokoll nicht unterzeichnet.` }],
    phasen: ["Gerichtlich"], rvg: ["3100", "3104"],
  },
  // ── Familienrecht ──
  {
    key: "fr-scheidung", sachgebiet: "Familienrecht",
    titel: (p) => `Scheidung ${p.M}`,
    beschreibung: () => `Einvernehmliche Scheidung nach Ablauf des Trennungsjahres; Versorgungsausgleich durchzuführen, Folgevereinbarung zu Hausrat und Ehewohnung.`,
    schlagworte: ["scheidung", "versorgungsausgleich", "trennungsjahr", "ehewohnung"],
    gegner: "person", gericht: "fam", wert: [9000, 32000],
    fristen: [{ titel: "Fragebogen Versorgungsausgleich zurücksenden", typ: "frist", offset: [4, 20] }],
    dokumente: [{ name: "Scheidungsantrag", art: "schriftsatz", ordner: "Gericht", text: (p) => `Antrag an das ${p.GER}: Die am 12.06.2009 geschlossene Ehe der Beteiligten wird geschieden. Die Beteiligten leben seit mehr als einem Jahr getrennt.` }],
    phasen: ["Gerichtlich"], rvg: ["3100", "3104"],
  },
  {
    key: "fr-unterhalt", sachgebiet: "Familienrecht",
    titel: (p) => `${p.M} ./. ${p.G} (Kindesunterhalt)`,
    beschreibung: () => `Kindesunterhalt für zwei Kinder (7 und 11 Jahre) nach Düsseldorfer Tabelle; unterhaltspflichtiger Vater verweigert Auskunft über sein Einkommen.`,
    schlagworte: ["unterhalt", "kindesunterhalt", "düsseldorfer tabelle", "auskunft"],
    gegner: "person", gericht: "fam", wert: [6000, 14000],
    fristen: [{ titel: "Auskunftsfrist Unterhaltspflichtiger", typ: "wiedervorlage", offset: [3, 14] }],
    dokumente: [{ name: "Auskunftsverlangen § 1605 BGB", art: "schriftsatz", ordner: "Korrespondenz", text: (p) => brief(p, "Unterhalt – Auskunft", `wir fordern Sie auf, Auskunft über Ihre Einkünfte der letzten zwölf Monate zu erteilen und diese zu belegen.`) }],
    phasen: ["Außergerichtlich", "Gerichtlich"], rvg: ["2300"],
  },
  {
    key: "fr-umgang", sachgebiet: "Familienrecht",
    titel: (p) => `Umgangsverfahren ${p.M}`,
    beschreibung: () => `Vater beantragt paritätisches Wechselmodell; Mutter (Mandantin) lehnt wegen hoher Konfliktbelastung ab. Jugendamt und Verfahrensbeistand beteiligt.`,
    schlagworte: ["umgang", "wechselmodell", "kindeswohl", "sorgerecht", "jugendamt"],
    gegner: "person", gericht: "fam", wert: [4000, 4000],
    fristen: [{ titel: "Anhörungstermin Familiengericht", typ: "termin", offset: [6, 28] }],
    dokumente: [{ name: "Antrag Gegenseite Wechselmodell", art: "schriftsatz", ordner: "Gericht", text: () => `Antrag: Die Betreuung der gemeinsamen Tochter erfolgt im wöchentlichen Wechsel.` }],
    phasen: ["Gerichtlich"], rvg: ["3100", "3104"],
  },
  // ── Strafrecht ──
  {
    key: "st-betrug", sachgebiet: "Strafrecht",
    titel: (p) => `Strafsache ${p.M}`,
    beschreibung: () => `Ermittlungsverfahren wegen Betrugs (§ 263 StGB) im Zusammenhang mit Online-Verkäufen. Akteneinsicht beantragt, Einlassung erst nach Akteneinsicht.`,
    schlagworte: ["betrug", "ermittlungsverfahren", "akteneinsicht", "strafverteidigung"],
    gegner: "behoerde", gericht: "sta", wert: [0, 0],
    fristen: [{ titel: "Wiedervorlage Akteneinsicht", typ: "wiedervorlage", offset: [2, 12] }],
    dokumente: [{ name: "Antrag auf Akteneinsicht", art: "schriftsatz", ordner: "Gericht", text: (p) => `An die ${p.GER}: Ich zeige die Verteidigung an und beantrage Einsicht in die Ermittlungsakte gemäß § 147 StPO.` }],
    phasen: ["Außergerichtlich"], rvg: [],
  },
  {
    key: "st-strafbefehl", sachgebiet: "Strafrecht",
    titel: (p) => `Strafsache ${p.M} (Strafbefehl)`,
    beschreibung: () => `Strafbefehl wegen unerlaubten Entfernens vom Unfallort (§ 142 StGB): 40 Tagessätze, Entziehung der Fahrerlaubnis. Einspruch geprüft – Fremdschaden unter 1.300 €.`,
    schlagworte: ["strafbefehl", "unfallflucht", "fahrerlaubnis", "einspruch"],
    gegner: "behoerde", gericht: "straf", wert: [0, 0],
    fristen: [{ regel: "einspruch_strafbefehl", offset: [3, 10] }],
    dokumente: [{ name: "Strafbefehl", art: "beschluss", ordner: "Gericht", text: (p) => `Strafbefehl des ${p.GER} gegen ${p.M}: 40 Tagessätze zu je 55 €. Einspruch binnen zwei Wochen nach Zustellung möglich.` }],
    phasen: ["Gerichtlich"], rvg: [],
  },
];

export function vorlagenFuer(sachgebiet: Sachgebiet): FallVorlage[] {
  return VORLAGEN.filter((v) => v.sachgebiet === sachgebiet);
}

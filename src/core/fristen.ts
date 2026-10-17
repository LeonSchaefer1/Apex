// Fristenrechner – deterministisch und mit Rechenweg. Die Berechnungsnormen folgen der Verfahrensordnung:
// ZPO/ArbGG: § 222 ZPO i. V. m. §§ 187, 188 BGB · StPO: §§ 42, 43 StPO · OWiG: § 46 Abs. 1 OWiG i. V. m. §§ 42, 43 StPO ·
// VwGO: § 57 Abs. 2 VwGO i. V. m. § 222 ZPO · FamFG: § 16 Abs. 2 FamFG i. V. m. § 222 ZPO ·
// KSchG, materielles Recht und vertraglich vereinbarte Fristen: §§ 187, 188, 193 BGB.
// Grundsatz von AnwaltApex: Die KI ERKENNT Fristen in Dokumenten, BERECHNET werden sie ausschließlich hier.
import { addDays, addMonthsBGB, diffDays, fmtDate, fmtDateWd, wochentagName } from "./dates";
import { bundeslandAusGericht, bundeslandAusOrt, bundeslandName, feiertagAm, istWerktag } from "./feiertage";
import type { Akte, Bundesland, Frist, FristGerichtsort, FristTyp, ISODate, Kontakt } from "./types";

export type Einheit = "tage" | "wochen" | "monate" | "jahresende";

/** Verfahrensordnung einer Frist – bestimmt Berechnungsnormen und Rechtsbehelfe bei Versäumnis. */
export type Verfahren = "ZPO" | "ArbGG" | "KSchG" | "StPO" | "OWiG" | "VwGO" | "FamFG" | "BGB";

export interface FristRegel {
  key: string;
  titel: string;
  grundlage: string;
  dauer: number;
  einheit: Einheit;
  /** „notfrist“ nur für Fristen, die das Gesetz ausdrücklich so nennt (§ 224 Abs. 1 S. 2 ZPO) – sonst „frist“. */
  typ: FristTyp;
  ereignis: string; // "Zustellung des Urteils"
  gebiet: "Zivilprozess" | "Arbeitsrecht" | "Familienrecht" | "Strafrecht" | "Verwaltungsrecht" | "Materielles Recht" | "Mahnverfahren" | "Vertraglich vereinbart";
  verfahren: Verfahren;
  /** Die Dauer ergibt sich nicht aus dem Gesetz, sondern aus Verfügung, Vertrag oder Vergleich – sie muss eingegeben werden (kein stiller Standardwert). */
  dauerPflicht?: boolean;
  /** Fristende als festes Datum: „pflicht“ = nur Datum (vereinbarte Frist), „moeglich“ = Datum oder Dauer (z. B. Widerrufsfrist im Vergleich). */
  festesDatum?: "pflicht" | "moeglich";
  /** Eigene Kurzform für Chips und Tooltips (sonst aus Typ und Verfahrensordnung). */
  kurz?: string;
  /** Eigener Satz zur Rechtsnatur (sonst aus Typ und Verfahrensordnung), z. B. bei § 61b ArbGG. */
  artText?: string;
  /** Gesetzliche Frist, die nicht verlängert werden kann, ohne Notfrist zu sein (z. B. § 4 KSchG, StPO, OWiG, VwGO). */
  unverlaengerbar?: boolean;
  /** Rechtsfolge und Rechtsbehelf bei Versäumnis (Wiedereinsetzung, nachträgliche Zulassung …). */
  versaeumnis: string;
  /** Feste Stelle, bei der die Frist zu wahren ist (z. B. BGH in Karlsruhe) – deren Feiertage gelten (§ 222 Abs. 2 ZPO). */
  handlungsort?: { land: Bundesland; ort: string };
  vorfristTage: number;
  hinweis?: string;
  stichworte: string[];
}

// Wiederkehrende Versäumnis-Hinweise je Verfahrensordnung
const WE_ZPO = "Bei Versäumnis: Wiedereinsetzung in den vorigen Stand (§§ 233, 234 ZPO) – Antrag binnen zwei Wochen nach Behebung des Hindernisses, die versäumte Handlung zugleich nachholen (§ 236 Abs. 2 S. 2 ZPO).";
const WE_ZPO_BEGRUENDUNG = "Bei Versäumnis: Wiedereinsetzung möglich (§ 233 ZPO) – Antragsfrist ein Monat (§ 234 Abs. 1 S. 2 ZPO). Verlängerungsantrag vor Fristablauf stellen.";
const WE_ARBGG = "Bei Versäumnis: Wiedereinsetzung (§ 64 Abs. 6 ArbGG i. V. m. §§ 233, 234 ZPO) – Antrag binnen zwei Wochen nach Behebung des Hindernisses, die Berufung zugleich nachholen.";
const WE_STPO = "Bei Versäumnis: Wiedereinsetzung in den vorigen Stand (§§ 44, 45 StPO) – Antrag binnen einer Woche nach Wegfall des Hindernisses, die versäumte Handlung zugleich nachholen (§ 45 Abs. 2 S. 2 StPO).";

export const FRIST_REGELN: FristRegel[] = [
  {
    key: "berufung", titel: "Berufungsfrist", grundlage: "§ 517 ZPO", dauer: 1, einheit: "monate", typ: "notfrist", verfahren: "ZPO",
    ereignis: "Zustellung des vollständigen Urteils", gebiet: "Zivilprozess", vorfristTage: 7, versaeumnis: WE_ZPO,
    hinweis: "Die Frist beginnt spätestens mit Ablauf von fünf Monaten nach Verkündung (§ 517 Hs. 2 ZPO).", stichworte: ["berufung", "urteil", "zustellung", "517"],
  },
  {
    key: "berufungsbegruendung", titel: "Berufungsbegründungsfrist", grundlage: "§ 520 Abs. 2 S. 1 ZPO", dauer: 2, einheit: "monate", typ: "frist", verfahren: "ZPO",
    ereignis: "Zustellung des vollständigen Urteils", gebiet: "Zivilprozess", vorfristTage: 14, versaeumnis: WE_ZPO_BEGRUENDUNG,
    hinweis: "Keine Notfrist: Verlängerung auf Antrag möglich (§ 520 Abs. 2 S. 2, 3 ZPO). Beginn spätestens mit Ablauf von fünf Monaten nach Verkündung (§ 520 Abs. 2 S. 1 ZPO).",
    stichworte: ["berufungsbegründung", "520"],
  },
  {
    key: "revision", titel: "Revisionsfrist", grundlage: "§ 548 ZPO", dauer: 1, einheit: "monate", typ: "notfrist", verfahren: "ZPO",
    ereignis: "Zustellung des Berufungsurteils", gebiet: "Zivilprozess", vorfristTage: 7, versaeumnis: WE_ZPO,
    handlungsort: { land: "BW", ort: "Bundesgerichtshof (Karlsruhe)" },
    hinweis: "Einlegung beim Revisionsgericht (§ 549 Abs. 1 ZPO); Beginn spätestens mit Ablauf von fünf Monaten nach Verkündung.", stichworte: ["revision", "548"],
  },
  {
    key: "revisionsbegruendung", titel: "Revisionsbegründungsfrist", grundlage: "§ 551 Abs. 2 ZPO", dauer: 2, einheit: "monate", typ: "frist", verfahren: "ZPO",
    ereignis: "Zustellung des Berufungsurteils", gebiet: "Zivilprozess", vorfristTage: 14, versaeumnis: WE_ZPO_BEGRUENDUNG,
    handlungsort: { land: "BW", ort: "Bundesgerichtshof (Karlsruhe)" },
    hinweis: "Keine Notfrist: Verlängerung auf Antrag möglich (§ 551 Abs. 2 S. 5, 6 ZPO).", stichworte: ["revisionsbegründung", "551"],
  },
  {
    key: "einspruch_vu", titel: "Einspruch gegen Versäumnisurteil", grundlage: "§ 339 Abs. 1 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist", verfahren: "ZPO",
    ereignis: "Zustellung des Versäumnisurteils", gebiet: "Zivilprozess", vorfristTage: 4, versaeumnis: WE_ZPO, stichworte: ["versäumnisurteil", "einspruch", "339"],
  },
  {
    key: "sofortige_beschwerde", titel: "Sofortige Beschwerde", grundlage: "§ 569 Abs. 1 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist", verfahren: "ZPO",
    ereignis: "Zustellung der Entscheidung", gebiet: "Zivilprozess", vorfristTage: 4, versaeumnis: WE_ZPO,
    hinweis: "Beginn spätestens mit Ablauf von fünf Monaten nach Verkündung des Beschlusses (§ 569 Abs. 1 S. 2 ZPO).", stichworte: ["beschwerde", "beschluss", "569"],
  },
  {
    key: "verteidigungsanzeige", titel: "Anzeige der Verteidigungsbereitschaft", grundlage: "§ 276 Abs. 1 S. 1 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist", verfahren: "ZPO",
    ereignis: "Zustellung der Klageschrift", gebiet: "Zivilprozess", vorfristTage: 4,
    versaeumnis: "Bei Versäumnis droht ein Versäumnisurteil im schriftlichen Vorverfahren (§ 331 Abs. 3 ZPO); eine verspätete Anzeige wirkt nur, solange das Urteil noch nicht der Geschäftsstelle übermittelt ist.",
    hinweis: "Die Frist zur Klageerwiderung setzt das Gericht (mind. zwei weitere Wochen).", stichworte: ["klage", "verteidigung", "276", "schriftliches vorverfahren"],
  },
  {
    key: "klageerwiderung", titel: "Klageerwiderungsfrist (gerichtlich gesetzt)", grundlage: "§ 276 Abs. 1 S. 2 ZPO", dauer: 4, einheit: "wochen", typ: "frist", verfahren: "ZPO",
    ereignis: "Zustellung der Klageschrift", gebiet: "Zivilprozess", vorfristTage: 7,
    versaeumnis: "Richterliche Frist: auf Antrag verlängerbar, wenn erhebliche Gründe glaubhaft gemacht sind (§ 224 Abs. 2 ZPO). Verspätetes Vorbringen kann zurückgewiesen werden (§ 296 Abs. 1 ZPO).",
    hinweis: "Dauer laut Verfügung des Gerichts prüfen.", stichworte: ["klageerwiderung", "erwiderung", "stellungnahme"],
  },
  {
    key: "widerspruch_mb", titel: "Widerspruch gegen Mahnbescheid", grundlage: "§ 692 Abs. 1 Nr. 3, § 694 ZPO", dauer: 2, einheit: "wochen", typ: "frist", verfahren: "ZPO",
    ereignis: "Zustellung des Mahnbescheids", gebiet: "Mahnverfahren", vorfristTage: 4,
    versaeumnis: "Keine Ausschlussfrist: Widerspruch ist möglich, solange der Vollstreckungsbescheid nicht verfügt ist (§ 694 Abs. 1 ZPO); danach nur noch Einspruch (§ 700 ZPO).",
    hinweis: "Nach Ablauf der zwei Wochen kann der Antragsteller den Vollstreckungsbescheid beantragen (§ 699 ZPO).", stichworte: ["mahnbescheid", "widerspruch", "694"],
  },
  {
    key: "einspruch_vb", titel: "Einspruch gegen Vollstreckungsbescheid", grundlage: "§§ 700 Abs. 1, 339 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist", verfahren: "ZPO",
    ereignis: "Zustellung des Vollstreckungsbescheids", gebiet: "Mahnverfahren", vorfristTage: 4, versaeumnis: WE_ZPO, stichworte: ["vollstreckungsbescheid", "700"],
  },
  {
    key: "kschg_klage", titel: "Kündigungsschutzklage", grundlage: "§ 4 S. 1 KSchG", dauer: 3, einheit: "wochen", typ: "frist", verfahren: "KSchG", unverlaengerbar: true,
    ereignis: "Zugang der schriftlichen Kündigung", gebiet: "Arbeitsrecht", vorfristTage: 7,
    versaeumnis: "Bei Versäumnis gilt die Kündigung als von Anfang an rechtswirksam (§ 7 KSchG). Keine Wiedereinsetzung nach § 233 ZPO – nur nachträgliche Zulassung der Klage (§ 5 KSchG): Antrag binnen zwei Wochen nach Behebung des Hindernisses, spätestens sechs Monate nach Fristende.",
    hinweis: "Bedarf die Kündigung der Zustimmung einer Behörde, läuft die Frist erst ab Bekanntgabe der Entscheidung an den Arbeitnehmer (§ 4 S. 4 KSchG).",
    stichworte: ["kündigung", "kündigungsschutz", "kschg", "arbeitsverhältnis"],
  },
  {
    key: "entfristungsklage", titel: "Entfristungsklage (Befristungskontrolle)", grundlage: "§ 17 S. 1 TzBfG", dauer: 3, einheit: "wochen", typ: "frist", verfahren: "KSchG", unverlaengerbar: true,
    ereignis: "Vereinbartes Ende des befristeten Arbeitsvertrags", gebiet: "Arbeitsrecht", vorfristTage: 7,
    versaeumnis: "Bei Versäumnis gilt die Befristung als rechtswirksam (§ 17 S. 2 TzBfG i. V. m. § 7 KSchG). Keine Wiedereinsetzung nach § 233 ZPO – nur nachträgliche Zulassung der Klage (§ 17 S. 2 TzBfG i. V. m. § 5 KSchG): Antrag binnen zwei Wochen nach Behebung des Hindernisses, spätestens sechs Monate nach Fristende.",
    hinweis: "Wird das Arbeitsverhältnis nach dem vereinbarten Ende fortgesetzt, beginnt die Frist erst mit Zugang der schriftlichen Erklärung des Arbeitgebers, das Arbeitsverhältnis sei auf Grund der Befristung beendet (§ 17 S. 3 TzBfG). Die Klage kann schon vor dem vereinbarten Ende erhoben werden. Zweckbefristung bzw. auflösende Bedingung: § 15 Abs. 2, § 21 TzBfG beachten.",
    kurz: "Klagefrist – nicht verlängerbar; bei Versäumnis nur nachträgliche Zulassung (§ 17 S. 2 TzBfG i. V. m. § 5 KSchG)",
    stichworte: ["entfristung", "entfristungsklage", "befristung", "befristet", "befristungskontrolle", "befristungskontrollklage", "tzbfg", "17 tzbfg", "befristeter arbeitsvertrag", "arbeitsvertrag"],
  },
  {
    key: "entschaedigung_agg", titel: "Entschädigungsklage (AGG)", grundlage: "§ 61b Abs. 1 ArbGG", dauer: 3, einheit: "monate", typ: "frist", verfahren: "BGB", unverlaengerbar: true,
    ereignis: "Schriftliche Geltendmachung des Anspruchs (§ 15 Abs. 4 AGG)", gebiet: "Arbeitsrecht", vorfristTage: 14,
    artText: "Gesetzliche Klagefrist (§ 61b Abs. 1 ArbGG) – nicht verlängerbar.",
    versaeumnis: "Bei Versäumnis ist der Entschädigungsanspruch nach § 15 AGG ausgeschlossen – keine Wiedereinsetzung (§ 233 ZPO gilt nicht für diese Klagefrist), keine nachträgliche Zulassung.",
    hinweis: "Die Klagefrist knüpft an die schriftliche Geltendmachung an – vorsorglich ab dem Tag rechnen, an dem sie abgesandt wurde (der frühere Tag ist die sichere Seite). Vorher gilt die Geltendmachungsfrist von zwei Monaten (§ 15 Abs. 4 AGG).",
    kurz: "Klagefrist – nicht verlängerbar; bei Versäumnis ist der Anspruch ausgeschlossen (§ 61b Abs. 1 ArbGG)",
    stichworte: ["entschädigung", "entschädigungsklage", "agg", "diskriminierung", "benachteiligung", "15 agg", "61b", "61b arbgg", "gleichbehandlung"],
  },
  {
    key: "berufung_arbg", titel: "Berufungsfrist (Arbeitsgericht)", grundlage: "§ 66 Abs. 1 S. 1 ArbGG", dauer: 1, einheit: "monate", typ: "notfrist", verfahren: "ArbGG",
    ereignis: "Zustellung des vollständigen Urteils", gebiet: "Arbeitsrecht", vorfristTage: 7, versaeumnis: WE_ARBGG,
    hinweis: "Beginn spätestens mit Ablauf von fünf Monaten nach Verkündung (§ 66 Abs. 1 S. 2 ArbGG).", stichworte: ["arbeitsgericht", "berufung", "66 arbgg"],
  },
  {
    key: "berufungsbegruendung_arbg", titel: "Berufungsbegründungsfrist (Arbeitsgericht)", grundlage: "§ 66 Abs. 1 S. 1 ArbGG", dauer: 2, einheit: "monate", typ: "frist", verfahren: "ArbGG",
    ereignis: "Zustellung des vollständigen Urteils", gebiet: "Arbeitsrecht", vorfristTage: 14,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung möglich (§ 64 Abs. 6 ArbGG i. V. m. §§ 233, 234 Abs. 1 S. 2 ZPO) – Antragsfrist ein Monat. Verlängerungsantrag vor Fristablauf stellen.",
    hinweis: "Keine Notfrist: nur einmal auf Antrag verlängerbar (§ 66 Abs. 1 S. 5 ArbGG). Beginn spätestens mit Ablauf von fünf Monaten nach Verkündung (§ 66 Abs. 1 S. 2 ArbGG).",
    stichworte: ["berufungsbegründung", "arbeitsgericht", "66 arbgg"],
  },
  {
    key: "einspruch_strafbefehl", titel: "Einspruch gegen Strafbefehl", grundlage: "§ 410 Abs. 1 StPO", dauer: 2, einheit: "wochen", typ: "frist", verfahren: "StPO", unverlaengerbar: true,
    ereignis: "Zustellung des Strafbefehls", gebiet: "Strafrecht", vorfristTage: 4,
    versaeumnis: `${WE_STPO} Ohne rechtzeitigen Einspruch steht der Strafbefehl einem rechtskräftigen Urteil gleich (§ 410 Abs. 3 StPO).`,
    stichworte: ["strafbefehl", "410"],
  },
  {
    key: "berufung_stpo", titel: "Berufung (Strafsachen)", grundlage: "§ 314 Abs. 1 StPO", dauer: 1, einheit: "wochen", typ: "frist", verfahren: "StPO", unverlaengerbar: true,
    ereignis: "Verkündung des Urteils", gebiet: "Strafrecht", vorfristTage: 2, versaeumnis: WE_STPO,
    hinweis: "Wurde das Urteil in Abwesenheit des Angeklagten verkündet, beginnt die Frist grundsätzlich mit der Zustellung (§ 314 Abs. 2 StPO).",
    stichworte: ["strafurteil", "berufung", "314"],
  },
  {
    key: "revision_stpo", titel: "Revision (Strafsachen)", grundlage: "§ 341 Abs. 1 StPO", dauer: 1, einheit: "wochen", typ: "frist", verfahren: "StPO", unverlaengerbar: true,
    ereignis: "Verkündung des Urteils", gebiet: "Strafrecht", vorfristTage: 2, versaeumnis: WE_STPO,
    hinweis: "Begründung binnen eines Monats nach Ablauf der Einlegungsfrist, bei späterer Zustellung des Urteils ab Zustellung (§ 345 Abs. 1 StPO).",
    stichworte: ["revision", "341"],
  },
  {
    key: "einspruch_bussgeld", titel: "Einspruch gegen Bußgeldbescheid", grundlage: "§ 67 Abs. 1 OWiG", dauer: 2, einheit: "wochen", typ: "frist", verfahren: "OWiG", unverlaengerbar: true,
    ereignis: "Zustellung des Bußgeldbescheids", gebiet: "Strafrecht", vorfristTage: 4,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung nach § 52 OWiG i. V. m. §§ 44, 45 StPO – Antrag binnen einer Woche nach Wegfall des Hindernisses; darüber entscheidet die Verwaltungsbehörde (§ 52 Abs. 2 OWiG).",
    hinweis: "Einspruch bei der Verwaltungsbehörde, die den Bescheid erlassen hat (§ 67 Abs. 1 OWiG).", stichworte: ["bußgeld", "owig", "67"],
  },
  {
    key: "widerspruch_va", titel: "Widerspruch gegen Verwaltungsakt", grundlage: "§ 70 Abs. 1 VwGO", dauer: 1, einheit: "monate", typ: "frist", verfahren: "VwGO", unverlaengerbar: true,
    ereignis: "Bekanntgabe des Verwaltungsakts", gebiet: "Verwaltungsrecht", vorfristTage: 7,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung (§ 70 Abs. 2 i. V. m. § 60 VwGO) – Antrag binnen zwei Wochen nach Wegfall des Hindernisses.",
    hinweis: "Ohne ordnungsgemäße Rechtsbehelfsbelehrung: ein Jahr (§ 58 Abs. 2 VwGO).", stichworte: ["bescheid", "widerspruch", "verwaltungsakt"],
  },
  {
    key: "anfechtungsklage", titel: "Anfechtungsklage", grundlage: "§ 74 Abs. 1 VwGO", dauer: 1, einheit: "monate", typ: "frist", verfahren: "VwGO", unverlaengerbar: true,
    ereignis: "Zustellung des Widerspruchsbescheids", gebiet: "Verwaltungsrecht", vorfristTage: 7,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung (§ 60 VwGO) – Antrag binnen zwei Wochen nach Wegfall des Hindernisses.",
    stichworte: ["widerspruchsbescheid", "klage", "74"],
  },
  {
    key: "regelverjaehrung", titel: "Regelverjährung", grundlage: "§§ 195, 199 Abs. 1 BGB", dauer: 3, einheit: "jahresende", typ: "frist", verfahren: "BGB",
    ereignis: "Entstehung des Anspruchs und Kenntnis", gebiet: "Materielles Recht", vorfristTage: 60,
    versaeumnis: "Nach Ablauf kann der Schuldner die Leistung verweigern (§ 214 Abs. 1 BGB). Rechtzeitig hemmen, z. B. durch Klage oder Mahnbescheid (§ 204 BGB).",
    hinweis: "Fristbeginn mit Schluss des Jahres der Entstehung/Kenntnis; Hemmung nach §§ 203 ff. BGB prüfen.",
    stichworte: ["verjährung", "195", "199"],
  },
  {
    key: "beschwerde_famfg", titel: "Beschwerdefrist (FamFG)", grundlage: "§ 63 Abs. 1 FamFG", dauer: 1, einheit: "monate", typ: "frist", verfahren: "FamFG", unverlaengerbar: true,
    ereignis: "Schriftliche Bekanntgabe des Beschlusses (§ 63 Abs. 3 S. 1 FamFG)", gebiet: "Familienrecht", vorfristTage: 7,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung in den vorigen Stand (§§ 17 ff. FamFG) – Antrag binnen zwei Wochen nach Wegfall des Hindernisses, die versäumte Handlung zugleich nachholen (§ 18 Abs. 1, 3 FamFG). In Familienstreitsachen gelten §§ 233 ff. ZPO (§ 117 Abs. 5 FamFG).",
    hinweis: "Nicht verlängerbar. Kann der Beschluss nicht schriftlich bekanntgegeben werden, beginnt die Frist spätestens mit Ablauf von fünf Monaten nach Erlass (§ 63 Abs. 3 S. 2 FamFG). Einlegung beim Ausgangsgericht (§ 64 Abs. 1 FamFG).",
    stichworte: ["famfg", "familie", "familiensache", "familienrecht", "beschwerde", "endentscheidung", "beschluss", "63 famfg"],
  },
  {
    key: "beschwerde_famfg_kurz", titel: "Beschwerdefrist – Zwischen- und Nebenentscheidungen (FamFG)", grundlage: "§ 63 Abs. 2 FamFG", dauer: 2, einheit: "wochen", typ: "frist", verfahren: "FamFG", unverlaengerbar: true,
    ereignis: "Schriftliche Bekanntgabe des Beschlusses (§ 63 Abs. 3 S. 1 FamFG)", gebiet: "Familienrecht", vorfristTage: 4,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung in den vorigen Stand (§§ 17 ff. FamFG) – Antrag binnen zwei Wochen nach Wegfall des Hindernisses (§ 18 Abs. 1 FamFG).",
    hinweis: "Zwei Wochen gelten nach § 63 Abs. 2 FamFG für einstweilige Anordnungen (Nr. 1) und Genehmigungen eines Rechtsgeschäfts (Nr. 2); Zwischen- und Nebenentscheidungen mit sofortiger Beschwerde (§§ 567–572 ZPO) ebenfalls binnen zwei Wochen. Nicht verlängerbar.",
    stichworte: ["famfg", "familie", "familiensache", "beschwerde", "einstweilige anordnung", "zwischenentscheidung", "nebenentscheidung", "63 famfg"],
  },
  {
    key: "beschwerdebegruendung_famfg", titel: "Beschwerdebegründung in Familienstreitsachen", grundlage: "§ 117 Abs. 1 S. 3 FamFG", dauer: 2, einheit: "monate", typ: "frist", verfahren: "FamFG",
    ereignis: "Schriftliche Bekanntgabe des Beschlusses", gebiet: "Familienrecht", vorfristTage: 14,
    versaeumnis: "Bei Versäumnis: Wiedereinsetzung möglich (§ 117 Abs. 5 FamFG i. V. m. §§ 233, 234 Abs. 1 S. 2 ZPO) – Antragsfrist ein Monat. Verlängerungsantrag vor Fristablauf stellen.",
    hinweis: "Keine Notfrist: verlängerbar nach § 117 Abs. 1 S. 4 FamFG i. V. m. § 520 Abs. 2 S. 2, 3 ZPO. Beginn spätestens mit Ablauf von fünf Monaten nach Erlass des Beschlusses (§ 117 Abs. 1 S. 3 FamFG).",
    stichworte: ["famfg", "familie", "familienstreitsache", "beschwerdebegründung", "begründung", "117 famfg"],
  },
  {
    key: "widerruf_vergleich", titel: "Widerrufsfrist (Vergleich)", grundlage: "Gerichtlicher Vergleich mit Widerrufsvorbehalt", dauer: 2, einheit: "wochen", typ: "frist", verfahren: "BGB", unverlaengerbar: true,
    dauerPflicht: true, festesDatum: "moeglich",
    ereignis: "Verkündung bzw. Zustellung des Protokolls (laut Vergleich)", gebiet: "Zivilprozess", vorfristTage: 3,
    versaeumnis: "Bei Versäumnis wird der Vergleich wirksam – vertragliche Frist, keine Wiedereinsetzung.",
    hinweis: "Dauer bzw. Datum, Adressat (Gericht oder Gegenseite) und Form des Widerrufs laut Vergleich – keine Verlängerung ohne Zustimmung der Gegenseite.",
    kurz: "Widerrufsfrist laut Vergleich – keine Verlängerung ohne Zustimmung der Gegenseite, keine Wiedereinsetzung",
    stichworte: ["vergleich", "widerruf", "widerrufsvorbehalt", "prozessvergleich", "794"],
  },
  {
    key: "vereinbart_datum", titel: "Vereinbarte Frist (festes Datum)", grundlage: "Vereinbarung der Parteien", dauer: 0, einheit: "tage", typ: "frist", verfahren: "BGB",
    festesDatum: "pflicht",
    ereignis: "Vereinbarung bzw. Eingang des Schreibens", gebiet: "Vertraglich vereinbart", vorfristTage: 7,
    versaeumnis: "Folgen der Versäumnis laut Vereinbarung prüfen.",
    hinweis: "Das vereinbarte Datum wird übernommen. Fällt es auf einen Samstag, Sonntag oder Feiertag, tritt an seine Stelle der nächste Werktag (§ 193 BGB) – vorsorglich gilt das genannte Datum.",
    stichworte: ["vereinbart", "vereinbarung", "festes datum", "datum", "absprache"],
  },
  {
    key: "ausschlussfrist_vertrag", titel: "Vertragliche Ausschlussfrist", grundlage: "Ausschlussklausel im Vertrag", dauer: 3, einheit: "monate", typ: "frist", verfahren: "BGB", unverlaengerbar: true,
    dauerPflicht: true,
    ereignis: "Fälligkeit des Anspruchs", gebiet: "Vertraglich vereinbart", vorfristTage: 14,
    versaeumnis: "Anspruchsverlust bei Versäumung: Der Anspruch verfällt – keine Wiedereinsetzung, keine nachträgliche Heilung.",
    hinweis: "Vertragliche Ausschlussfrist – Anspruchsverlust bei Versäumung. Form der Geltendmachung und eine zweite Stufe (gerichtliche Geltendmachung) laut Vertrag prüfen. In vorformulierten Verträgen sind kürzere Fristen als drei Monate je Stufe regelmäßig unwirksam (§ 307 BGB) – vorsorglich trotzdem wahren. Ansprüche auf den Mindestlohn erfasst die Klausel nicht (§ 3 S. 1 MiLoG).",
    kurz: "Vertragliche Ausschlussfrist – Anspruchsverlust bei Versäumung",
    stichworte: ["ausschlussfrist", "verfallfrist", "verfallklausel", "arbeitsvertrag", "vertrag", "fälligkeit", "geltendmachung"],
  },
  {
    key: "frei_tage", titel: "Frei bestimmte Frist", grundlage: "§§ 187, 188 BGB, § 222 ZPO", dauer: 10, einheit: "tage", typ: "frist", verfahren: "ZPO",
    dauerPflicht: true,
    ereignis: "Fristauslösendes Ereignis", gebiet: "Zivilprozess", vorfristTage: 3,
    versaeumnis: "Richterliche Fristen sind auf Antrag verlängerbar, wenn erhebliche Gründe glaubhaft gemacht sind (§ 224 Abs. 2 ZPO).",
    hinweis: "Dauer laut Verfügung bzw. Schreiben eingeben – Tage, Wochen oder Monate.", stichworte: ["tage", "wochen", "frei", "richterlich", "gerichtlich gesetzt", "verfügung"],
  },
];

export function regel(key: string): FristRegel | undefined {
  return FRIST_REGELN.find((r) => r.key === key);
}

/** Art der Frist für Chips, Tooltips und Hinweise – „Notfrist“ nur, wo das Gesetz die Frist so nennt. */
export interface FristArt {
  label: "Notfrist" | "Frist";
  /** nicht verlängerbar (Notfrist oder unverlängerbare gesetzliche Frist) → rot hervorheben */
  kritisch: boolean;
  /** Ein Satz zur Rechtsnatur, z. B. „Notfrist (§ 224 Abs. 1 S. 2 ZPO) – nicht verlängerbar (§ 224 Abs. 2 ZPO).“ */
  art: string;
  /** Rechtsfolge und Rechtsbehelf bei Versäumnis */
  versaeumnis: string;
  /** Kurzform für Tooltips */
  kurz: string;
}

export function fristArt(r: FristRegel): FristArt {
  if (r.typ === "notfrist") {
    const arbgg = r.verfahren === "ArbGG";
    return {
      label: "Notfrist",
      kritisch: true,
      art: arbgg ? "Notfrist (§ 64 Abs. 6 ArbGG i. V. m. § 517 ZPO) – nicht verlängerbar (§ 224 Abs. 2 ZPO)." : "Notfrist (§ 224 Abs. 1 S. 2 ZPO) – nicht verlängerbar (§ 224 Abs. 2 ZPO).",
      versaeumnis: r.versaeumnis,
      kurz: r.key === "verteidigungsanzeige" ? "Notfrist – nicht verlängerbar (§ 224 Abs. 2 ZPO); bei Versäumnis droht Versäumnisurteil (§ 331 Abs. 3 ZPO)" : "Notfrist – nicht verlängerbar (§ 224 Abs. 2 ZPO); bei Versäumnis Wiedereinsetzung (§§ 233 ff. ZPO)",
    };
  }
  if (r.unverlaengerbar) {
    const kurz: Record<Verfahren, string> = {
      KSchG: "Klagefrist – nicht verlängerbar; bei Versäumnis nur nachträgliche Zulassung (§ 5 KSchG)",
      StPO: "Nicht verlängerbar; bei Versäumnis Wiedereinsetzung (§§ 44, 45 StPO)",
      OWiG: "Nicht verlängerbar; bei Versäumnis Wiedereinsetzung (§ 52 OWiG i. V. m. §§ 44, 45 StPO)",
      VwGO: "Nicht verlängerbar; bei Versäumnis Wiedereinsetzung (§ 60 VwGO)",
      FamFG: "Nicht verlängerbar; bei Versäumnis Wiedereinsetzung (§§ 17 ff. FamFG)",
      ZPO: "Nicht verlängerbar",
      ArbGG: "Nicht verlängerbar",
      BGB: "Nicht verlängerbar",
    };
    const vertraglich = r.key === "ausschlussfrist_vertrag" || r.key === "widerruf_vergleich";
    return {
      label: "Frist",
      kritisch: true,
      art: r.artText
        ? r.artText
        : r.verfahren === "KSchG"
        ? "Keine Notfrist im Sinne der ZPO, aber nicht verlängerbar."
        : vertraglich
          ? `Vertraglich vereinbarte Frist – nicht einseitig verlängerbar.`
          : `Gesetzliche Frist (${r.verfahren}) – nicht verlängerbar.`,
      versaeumnis: r.versaeumnis,
      kurz: r.kurz ?? kurz[r.verfahren],
    };
  }
  return { label: "Frist", kritisch: false, art: "", versaeumnis: r.versaeumnis, kurz: r.kurz ?? r.hinweis ?? r.versaeumnis };
}

/**
 * Normen zur Berechnung einer Fristart – für Hinweise wie „der Tag des Ereignisses zählt nicht mit (…)“.
 * KSchG: „§ 4 S. 1 KSchG; §§ 187 Abs. 1, 188 Abs. 2, 193 BGB“ · ZPO: „§ 222 Abs. 1 ZPO i. V. m. §§ 187 Abs. 1, 188 Abs. 2 BGB“ …
 */
export function berechnungsNormen(r: Pick<FristRegel, "verfahren" | "einheit" | "grundlage" | "key">): string {
  switch (r.verfahren) {
    case "KSchG":
      return `${r.grundlage}; §§ 187 Abs. 1, 188 Abs. 2, 193 BGB`;
    case "StPO":
      return r.einheit === "tage" ? "§ 42 StPO" : "§ 43 Abs. 1 StPO";
    case "OWiG":
      return `§ 46 Abs. 1 OWiG i. V. m. ${r.einheit === "tage" ? "§ 42 StPO" : "§ 43 Abs. 1 StPO"}`;
    case "VwGO":
      return "§ 57 Abs. 2 VwGO i. V. m. § 222 Abs. 1 ZPO, § 187 Abs. 1 BGB";
    case "FamFG":
      return "§ 16 Abs. 2 FamFG i. V. m. § 222 Abs. 1 ZPO, §§ 187 Abs. 1, 188 Abs. 2 BGB";
    case "BGB":
      return r.einheit === "jahresende" ? "§§ 195, 199 Abs. 1 BGB" : "§§ 187 Abs. 1, 188 Abs. 2, 193 BGB";
    default:
      return "§ 222 Abs. 1 ZPO i. V. m. §§ 187 Abs. 1, 188 Abs. 2 BGB";
  }
}

/** Fristart zu einem gespeicherten Eintrag (über `regelKey`); ohne Regel nur nach Typ. */
export function fristArtZu(f: { typ: FristTyp; regelKey?: string }): FristArt | undefined {
  const r = f.regelKey ? regel(f.regelKey) : undefined;
  if (r) return fristArt(r);
  if (f.typ === "notfrist") return { label: "Notfrist", kritisch: true, art: "Notfrist – nicht verlängerbar.", versaeumnis: "", kurz: "Notfrist – nicht verlängerbar" };
  return undefined;
}

export interface FristErgebnis {
  ende: ISODate;
  rohesEnde: ISODate; // rechnerisches Ende vor Verschiebung (§ 222 Abs. 2 ZPO, § 43 Abs. 2 StPO, § 193 BGB)
  vorfrist: ISODate;
  rechenweg: string[];
  verschoben: boolean;
  /** Norm der Verschiebung auf den nächsten Werktag, z. B. „§ 222 Abs. 2 ZPO“ oder „§ 43 Abs. 2 StPO“ */
  verschiebungsNorm: string;
  /** Bundesland, dessen Feiertage verwendet wurden */
  land: Bundesland;
  /** Woher das Bundesland stammt, z. B. „Hessisches LAG“, „Ort der Handlung: Bundesgerichtshof (Karlsruhe)“ oder „Kanzleisitz“ */
  feiertagsOrt: string;
  warnungen: string[];
}

interface Normen {
  /** Satz zum nicht mitgezählten Ereignistag */
  beginn: (einheit: Einheit) => string;
  ende: string;
  monatsletzter: string;
  verschiebung: string;
}

const BGB_BEGINN = (norm: string) => () => `Fristbeginn am Folgetag – der Ereignistag zählt nicht mit (${norm})`;
const NORMEN: Record<Verfahren, Normen> = {
  ZPO: { beginn: BGB_BEGINN("§ 222 Abs. 1 ZPO i. V. m. § 187 Abs. 1 BGB"), ende: "§ 188 Abs. 2 BGB", monatsletzter: "§ 188 Abs. 3 BGB", verschiebung: "§ 222 Abs. 2 ZPO" },
  ArbGG: { beginn: BGB_BEGINN("§ 222 Abs. 1 ZPO i. V. m. § 187 Abs. 1 BGB"), ende: "§ 188 Abs. 2 BGB", monatsletzter: "§ 188 Abs. 3 BGB", verschiebung: "§ 222 Abs. 2 ZPO" },
  KSchG: { beginn: BGB_BEGINN("§ 187 Abs. 1 BGB"), ende: "§ 188 Abs. 2 BGB", monatsletzter: "§ 188 Abs. 3 BGB", verschiebung: "§ 193 BGB, § 222 Abs. 2 ZPO" },
  VwGO: { beginn: BGB_BEGINN("§ 57 Abs. 2 VwGO, § 222 Abs. 1 ZPO i. V. m. § 187 Abs. 1 BGB"), ende: "§ 188 Abs. 2 BGB", monatsletzter: "§ 188 Abs. 3 BGB", verschiebung: "§ 57 Abs. 2 VwGO i. V. m. § 222 Abs. 2 ZPO" },
  FamFG: { beginn: BGB_BEGINN("§ 16 Abs. 2 FamFG, § 222 Abs. 1 ZPO i. V. m. § 187 Abs. 1 BGB"), ende: "§ 188 Abs. 2 BGB", monatsletzter: "§ 188 Abs. 3 BGB", verschiebung: "§ 16 Abs. 2 FamFG i. V. m. § 222 Abs. 2 ZPO" },
  BGB: { beginn: BGB_BEGINN("§ 187 Abs. 1 BGB"), ende: "§ 188 Abs. 2 BGB", monatsletzter: "§ 188 Abs. 3 BGB", verschiebung: "§ 193 BGB" },
  StPO: {
    beginn: (e) => `Der Ereignistag zählt nicht mit (${e === "tage" ? "§ 42 StPO" : "§ 43 Abs. 1 StPO"})`,
    ende: "§ 43 Abs. 1 StPO", monatsletzter: "§ 43 Abs. 1 Hs. 2 StPO", verschiebung: "§ 43 Abs. 2 StPO",
  },
  OWiG: {
    beginn: (e) => `Der Ereignistag zählt nicht mit (§ 46 Abs. 1 OWiG i. V. m. ${e === "tage" ? "§ 42 StPO" : "§ 43 Abs. 1 StPO"})`,
    ende: "§ 43 Abs. 1 StPO", monatsletzter: "§ 43 Abs. 1 Hs. 2 StPO", verschiebung: "§ 46 Abs. 1 OWiG i. V. m. § 43 Abs. 2 StPO",
  },
};

function einheitText(dauer: number, einheit: Einheit): string {
  if (einheit === "tage") return dauer === 1 ? "1 Tag" : `${dauer} Tage`;
  if (einheit === "wochen") return dauer === 1 ? "1 Woche" : `${dauer} Wochen`;
  if (einheit === "monate") return dauer === 1 ? "1 Monat" : `${dauer} Monate`;
  return `${dauer} Jahre ab Jahresende`;
}

/** Hinweis für ein Fristende auf einem nur regional geltenden Feiertag (AnwaltApex verlängert vorsorglich nicht). */
function regionalWarnung(ende: ISODate, land: Bundesland, norm: string): string | undefined {
  const tf = feiertagAm(ende, land);
  if (!tf?.teilweise) return undefined;
  return `${tf.name.replace(/ \(regional\)$/, "")} ist nur in Teilen von ${bundeslandName(land)} Feiertag – AnwaltApex verlängert vorsorglich nicht. Gilt er am Ort des Gerichts, endet die Frist rechtlich erst am nächsten Werktag (${norm}); der frühere Termin bleibt die sichere Seite.`;
}

/** Grund, warum ein Tag kein Werktag ist: Feiertagsname (mit Land) oder Samstag/Sonntag. */
function keinWerktagGrund(datum: ISODate, land: Bundesland): string {
  const f = feiertagAm(datum, land);
  const wd = new Date(datum + "T00:00:00Z").getUTCDay();
  if (f && !f.teilweise) return `${f.name} (${bundeslandName(land)})`;
  return wd === 6 ? "Samstag" : "Sonntag";
}

/** Pflichtzeile im Rechenweg: Welche Feiertage wurden geprüft? – immer, auch ohne Verschiebung (ohne Normzitat). */
function feiertagsZeile(land: Bundesland, ort: string, kanzleiLand?: Bundesland): string {
  if (ort === "Kanzleisitz") {
    // Bundesland weicht vom Kanzleisitz ab, ohne dass ein Gericht genannt ist: von Hand gewählt
    if (kanzleiLand && kanzleiLand !== land) return `Feiertage am Gerichtsort geprüft: ${bundeslandName(land)} (von Hand gewählt)`;
    // Ohne Gericht nicht „am Gerichtsort geprüft … (Kanzleisitz)“ behaupten – das wäre widersprüchlich (I2-T04-02)
    return `Gerichtsort noch offen – geprüft mit den Feiertagen am Kanzleisitz (${bundeslandName(land)})`;
  }
  return `Feiertage am Gerichtsort geprüft: ${bundeslandName(land)} (${ort})`;
}

/**
 * Feiertag am Kanzleisitz, der am Gerichtsort nicht gilt – dort verlängert er die Frist nicht.
 * „01.11.2027 Allerheiligen – in Nordrhein-Westfalen Feiertag, in Hessen (Gerichtsort) nicht – keine Verschiebung“
 */
function kanzleisitzZeile(ende: ISODate, land: Bundesland, kanzleiLand: Bundesland | undefined, ortArt: string): string | undefined {
  if (!kanzleiLand || kanzleiLand === land) return undefined;
  const k = feiertagAm(ende, kanzleiLand);
  if (!k || k.teilweise) return undefined;
  const g = feiertagAm(ende, land);
  if (g && !g.teilweise) return undefined;
  return `${fmtDate(ende)} ${k.name} – in ${bundeslandName(kanzleiLand)} Feiertag, in ${bundeslandName(land)} (${ortArt}) nicht – keine Verschiebung`;
}

function vorfristVon(ende: ISODate, tage: number, land: Bundesland): ISODate {
  let vorfrist = addDays(ende, -tage);
  let guard = 0;
  while (!istWerktag(vorfrist, land) && guard++ < 10) vorfrist = addDays(vorfrist, -1);
  return vorfrist;
}

/**
 * Vorfrist nie vor dem fristauslösenden Ereignis (I5-T15-02): Vorfrist = max(Ereignistag, Fristende − Abstand, zurück auf
 * Werktag). Liegt sie vor dem Ereignis (kurze Frist), gilt der Ereignistag – mit Hinweis im Rechenweg.
 */
function vorfristAbEreignis(ende: ISODate, tage: number, land: Bundesland, ereignis: ISODate): { vorfrist: ISODate; zeile: string } {
  const berechnet = vorfristVon(ende, tage, land);
  const abstand = `${tage} ${tage === 1 ? "Tag" : "Tagen"}`;
  if (berechnet < ereignis) {
    return { vorfrist: ereignis, zeile: `Vorfrist auf den Ereignistag gelegt (${fmtDateWd(ereignis)}) – die Frist ist kürzer als der Vorfrist-Abstand von ${abstand}.` };
  }
  return { vorfrist: berechnet, zeile: `Vorfrist ${tage} ${tage === 1 ? "Tag" : "Tage"} vorher, auf Werktag gelegt: ${fmtDateWd(berechnet)}` };
}

/**
 * Berechnet das Fristende.
 * - Ereignisfrist: Der Tag des Ereignisses wird nicht mitgerechnet (§ 187 Abs. 1 BGB i. V. m. § 222 Abs. 1 ZPO; §§ 42, 43 StPO).
 * - Tage: Ende = Ereignis + n Tage. Wochen/Monate: Ablauf mit dem Tag, der durch Benennung oder Zahl dem Ereignistag
 *   entspricht; fehlt er, Monatsletzter (§ 188 Abs. 2, 3 BGB bzw. § 43 Abs. 1 StPO).
 * - Fällt das Ende auf Samstag, Sonntag oder allgemeinen Feiertag: nächster Werktag (§ 222 Abs. 2 ZPO, § 43 Abs. 2 StPO, § 193 BGB).
 *   Maßgeblich sind die Feiertage am Ort, an dem die Handlung vorzunehmen ist (Gericht bzw. Behörde).
 * - Vorfrist: n Tage vor Fristende, zurückverlegt auf den vorherigen Werktag – frühestens am Tag des Ereignisses (I5-T15-02).
 */
export function berechneFrist(params: {
  ereignis: ISODate;
  dauer: number;
  einheit: Einheit;
  land: Bundesland;
  vorfristTage?: number;
  ereignisLabel?: string;
  /** Rechtsgrundlage der Fristdauer (z. B. „§ 517 ZPO“) – erscheint im Rechenweg. */
  grundlage?: string;
  /** Verfahrensordnung für die Berechnungsnormen (Standard: ZPO). */
  verfahren?: Verfahren;
  /** Woher die Feiertage stammen (z. B. „Landgericht München I – laut Schreiben“); ohne Angabe: „Kanzleisitz“. Erscheint immer im Rechenweg. */
  feiertagsOrt?: string;
  /** Bundesland des Kanzleisitzes – ein Feiertag nur dort verlängert nicht; der Rechenweg weist darauf hin. */
  kanzleiLand?: Bundesland;
  /** „Ort der Handlung“ statt „Gerichtsort“ (z. B. Revision beim BGH). */
  ortArt?: string;
}): FristErgebnis {
  const { ereignis, dauer, einheit, land } = params;
  const feiertagsOrt = params.feiertagsOrt ?? "Kanzleisitz";
  const n = NORMEN[params.verfahren ?? "ZPO"];
  const rechenweg: string[] = [];
  const warnungen: string[] = [];
  const label = params.ereignisLabel ?? "Fristauslösendes Ereignis";
  const dauerText = `Dauer ${einheitText(dauer, einheit)}${params.grundlage ? ` (${params.grundlage})` : ""}`;
  rechenweg.push(`${label}: ${fmtDateWd(ereignis)}`);

  let roh: ISODate;
  if (einheit === "tage") {
    roh = addDays(ereignis, dauer);
    rechenweg.push(n.beginn(einheit));
    rechenweg.push(`${dauerText} → rechnerisches Ende ${fmtDateWd(roh)}`);
  } else if (einheit === "wochen") {
    roh = addDays(ereignis, dauer * 7);
    rechenweg.push(n.beginn(einheit));
    rechenweg.push(`${dauerText}: Ende am gleichnamigen Wochentag (${wochentagName(ereignis)}) – ${n.ende} → ${fmtDateWd(roh)}`);
  } else if (einheit === "monate") {
    const r = addMonthsBGB(ereignis, dauer);
    roh = r.date;
    rechenweg.push(n.beginn(einheit));
    if (r.gekappt) {
      // „rechnerisch 29.02.2027 – diesen Tag gibt es nicht → Monatsletzter 28.02.2027 (§ 188 Abs. 3 BGB)“
      const rechnerisch = `${ereignis.slice(8, 10)}.${roh.slice(5, 7)}.${roh.slice(0, 4)}`;
      rechenweg.push(`${dauerText}: Ende am Tag mit derselben Zahl (${n.ende}) – rechnerisch ${rechnerisch} – diesen Tag gibt es nicht → Monatsletzter ${fmtDateWd(roh)} (${n.monatsletzter})`);
    } else {
      rechenweg.push(`${dauerText}: Ende am Tag mit derselben Zahl – ${n.ende} → ${fmtDateWd(roh)}`);
    }
  } else {
    const year = Number(ereignis.slice(0, 4));
    roh = `${year + dauer}-12-31`;
    rechenweg.push(`Beginn mit Schluss des Jahres ${year} (§ 199 Abs. 1 BGB), Dauer ${dauer} Jahre${params.grundlage ? ` (${params.grundlage})` : ""} → ${fmtDateWd(roh)}`);
  }
  rechenweg.push(feiertagsZeile(land, feiertagsOrt, params.kanzleiLand));

  let ende = roh;
  let verschoben = false;
  let guard = 0;
  const freieTage: string[] = [];
  while (!istWerktag(ende, land) && guard++ < 10) {
    freieTage.push(`${fmtDateWd(ende)} ist ${keinWerktagGrund(ende, land)}`);
    ende = addDays(ende, 1);
    verschoben = true;
  }
  // „So, 28.02.2027 ist Sonntag → nächster Werktag Mo, 01.03.2027“
  if (verschoben) rechenweg.push(`${freieTage.join(", ")} → nächster Werktag ${fmtDateWd(ende)}`);
  const kanzlei = kanzleisitzZeile(ende, land, params.kanzleiLand, params.ortArt ?? "Gerichtsort");
  if (kanzlei) rechenweg.push(kanzlei);
  if (verschoben) rechenweg.push(`Fristende nach ${n.verschiebung}: ${fmtDateWd(ende)}, 24:00 Uhr`);
  else rechenweg.push(`Fristende fällt auf einen Werktag – keine Verschiebung: ${fmtDateWd(ende)}, 24:00 Uhr`);

  const regional = regionalWarnung(ende, land, n.verschiebung);
  if (regional) warnungen.push(regional);

  const vt = params.vorfristTage ?? 7;
  const { vorfrist, zeile } = vorfristAbEreignis(ende, vt, land, ereignis);
  rechenweg.push(zeile);

  return { ende, rohesEnde: roh, vorfrist, rechenweg, verschoben, verschiebungsNorm: n.verschiebung, land, feiertagsOrt, warnungen };
}

export interface RegelOptionen {
  ereignisLabel?: string;
  /** Gericht bzw. Herkunft des Bundeslands (z. B. „Hessisches LAG“, „Landgericht Berlin II – laut Akte“); ohne Angabe „Kanzleisitz“. */
  feiertagsOrt?: string;
  /** Bundesland des Kanzleisitzes – für den Hinweis auf Feiertage, die nur dort gelten. */
  kanzleiLand?: Bundesland;
  /** Abweichende Einheit zur eingegebenen Dauer (frei bestimmte Fristen, Widerrufs- und Ausschlussfristen). */
  einheit?: Exclude<Einheit, "jahresende">;
  /** Festes Fristende laut Vergleich bzw. Vereinbarung (nur bei Regeln mit `festesDatum`). */
  festesEnde?: ISODate;
}

export function berechneNachRegel(
  key: string,
  ereignis: ISODate,
  land: Bundesland,
  dauerOverride?: number,
  opts: RegelOptionen = {},
): FristErgebnis & { regel: FristRegel } {
  const r = regel(key) ?? regel("frei_tage")!;
  // Feste Stelle der Handlung (z. B. BGH Karlsruhe) geht dem Gerichtsort laut Schreiben bzw. Kanzleisitz vor.
  const ort = r.handlungsort && r.handlungsort.land !== land ? r.handlungsort : undefined;
  if (r.festesDatum && opts.festesEnde) {
    const res = berechneFestesEnde({
      ende: opts.festesEnde,
      ereignis,
      land,
      ereignisLabel: opts.ereignisLabel ?? r.ereignis,
      quelle: r.key === "widerruf_vergleich" ? "Vergleich" : "Vereinbarung",
      vorfristTage: r.vorfristTage,
      verschiebungsNorm: r.verfahren === "BGB" ? "§ 193 BGB" : NORMEN[r.verfahren].verschiebung,
      feiertagsOrt: opts.feiertagsOrt,
      kanzleiLand: opts.kanzleiLand,
    });
    return { ...res, regel: r };
  }
  const res = berechneFrist({
    ereignis,
    dauer: dauerOverride ?? r.dauer,
    einheit: opts.einheit && r.einheit !== "jahresende" ? opts.einheit : r.einheit,
    land: ort?.land ?? land,
    vorfristTage: r.vorfristTage,
    ereignisLabel: opts.ereignisLabel ?? r.ereignis,
    // Bei frei bestimmten Fristen ist die „Grundlage“ nur die Berechnungsvorschrift – nicht als Dauer-Grundlage nennen.
    grundlage: r.key === "frei_tage" ? undefined : r.grundlage,
    verfahren: r.verfahren,
    feiertagsOrt: ort ? `Ort der Handlung: ${ort.ort}` : opts.feiertagsOrt,
    ortArt: ort ? "Ort der Handlung" : undefined,
    kanzleiLand: opts.kanzleiLand,
  });
  return { ...res, regel: r };
}

/**
 * Frist mit festem Enddatum (z. B. „bis zum 20.11.2026 Stellung zu nehmen“). Das genannte Datum wird übernommen.
 * Fällt es auf Wochenende/Feiertag, endet die Frist nach § 222 Abs. 2 ZPO erst am nächsten Werktag – AnwaltApex
 * notiert vorsorglich das genannte Datum und weist darauf hin.
 */
export function berechneFestesEnde(params: {
  ende: ISODate;
  ereignis: ISODate;
  land: Bundesland;
  ereignisLabel?: string;
  quelle?: string;
  vorfristTage?: number;
  /** Norm für Wochenende/Feiertag – Standard § 222 Abs. 2 ZPO (gerichtliche Frist); vereinbarte Fristen: § 193 BGB. */
  verschiebungsNorm?: string;
  feiertagsOrt?: string;
  kanzleiLand?: Bundesland;
}): FristErgebnis {
  const { ende, ereignis, land } = params;
  const norm = params.verschiebungsNorm ?? "§ 222 Abs. 2 ZPO";
  const feiertagsOrt = params.feiertagsOrt ?? "Kanzleisitz";
  const rechenweg: string[] = [];
  const warnungen: string[] = [];
  rechenweg.push(`${params.ereignisLabel ?? "Eingang des Schreibens"}: ${fmtDateWd(ereignis)}`);
  rechenweg.push(`Fristende laut ${params.quelle ?? "Schreiben"} (festes Datum): ${fmtDateWd(ende)}`);
  rechenweg.push(feiertagsZeile(land, feiertagsOrt, params.kanzleiLand));
  let naechster = ende;
  let guard = 0;
  while (!istWerktag(naechster, land) && guard++ < 10) naechster = addDays(naechster, 1);
  if (naechster !== ende) {
    const f = feiertagAm(ende, land);
    const wd = new Date(ende + "T00:00:00Z").getUTCDay();
    const grund = f && !f.teilweise ? f.name : wd === 6 ? "Samstag" : "Sonntag";
    rechenweg.push(`${fmtDate(ende)} ist ${grund}${f && !f.teilweise ? ` (${bundeslandName(land)})` : ""} – nach ${norm} endet die Frist erst am ${fmtDateWd(naechster)}; vorsorglich gilt das genannte Datum`);
    warnungen.push(`Das genannte Datum ist ein ${grund}. Rechtlich endet die Frist erst am ${fmtDateWd(naechster)} (${norm}) – AnwaltApex notiert vorsorglich den ${fmtDate(ende)}.`);
  } else {
    const kanzlei = kanzleisitzZeile(ende, land, params.kanzleiLand, "Gerichtsort");
    if (kanzlei) rechenweg.push(kanzlei);
    rechenweg.push(`${fmtDate(ende)} ist ein Werktag – keine Verschiebung: ${fmtDateWd(ende)}, 24:00 Uhr`);
    const regional = regionalWarnung(ende, land, norm);
    if (regional) warnungen.push(regional);
  }
  const spanne = diffDays(ereignis, ende);
  const vt = params.vorfristTage ?? (spanne >= 21 ? 7 : spanne >= 8 ? 3 : 1);
  const { vorfrist, zeile } = vorfristAbEreignis(ende, vt, land, ereignis);
  rechenweg.push(zeile);
  return { ende, rohesEnde: ende, vorfrist, rechenweg, verschoben: false, verschiebungsNorm: norm, land, feiertagsOrt, warnungen };
}

/** Gerichtsort einer Akte (über das hinterlegte Gericht) – für die Feiertage nach § 222 Abs. 2 ZPO. */
export function gerichtsortDerAkte(akte: Pick<Akte, "gerichtId"> | undefined, kontakte: Kontakt[]): { land: Bundesland; gericht: string } | undefined {
  const k = akte?.gerichtId ? kontakte.find((x) => x.id === akte.gerichtId) : undefined;
  if (!k) return undefined;
  const land = bundeslandAusGericht(k.name)?.land ?? (k.ort ? bundeslandAusOrt(k.ort) : undefined);
  return land ? { land, gericht: k.name } : undefined;
}

/**
 * Ort, mit dessen Feiertagen eine gespeicherte Frist (neu) berechnet wird – z. B. in der Fristkorrektur (§ 222 Abs. 2 ZPO).
 * Reihenfolge: an der Frist gespeicherter Gerichtsort (z. B. Berufungsgericht aus dem Posteingang) → Gericht der Akte →
 * Kanzleisitz. `feiertagsOrt` passt direkt in `RegelOptionen.feiertagsOrt` von `berechneNachRegel` (undefined = Kanzleisitz).
 */
export function feiertagsortFuerFrist(
  frist: Pick<Frist, "gerichtsort">,
  akte: Pick<Akte, "gerichtId"> | undefined,
  kontakte: Kontakt[],
  kanzleiLand: Bundesland,
): { land: Bundesland; feiertagsOrt?: string; quelle: FristGerichtsort["quelle"] } {
  const g = frist.gerichtsort;
  if (g) {
    const gericht = g.gericht?.trim();
    if (g.quelle === "kanzleisitz") return { land: g.land, quelle: "kanzleisitz" };
    // „Kammergericht, Berufungsgericht“ (Posteingang) bzw. „Landgericht Berlin II – laut Akte“; von Hand ohne Gericht: „(von Hand gewählt)“
    const ort = !gericht ? undefined : g.quelle === "akte" && !/ – laut Akte$/.test(gericht) ? `${gericht} – laut Akte` : gericht;
    return { land: g.land, feiertagsOrt: ort, quelle: g.quelle };
  }
  const ausAkte = gerichtsortDerAkte(akte, kontakte);
  if (ausAkte) return { land: ausAkte.land, feiertagsOrt: `${ausAkte.gericht} – laut Akte`, quelle: "akte" };
  return { land: kanzleiLand, quelle: "kanzleisitz" };
}

/** Ampel für Fristen: rot ≤ 2 Werktage / überfällig, gelb ≤ 7 Tage, sonst ruhig. */
export function fristDringlichkeit(datum: ISODate, heute: ISODate): "ueberfaellig" | "kritisch" | "bald" | "normal" {
  const diff = (new Date(datum + "T00:00:00Z").getTime() - new Date(heute + "T00:00:00Z").getTime()) / 86400000;
  if (diff < 0) return "ueberfaellig";
  if (diff <= 2) return "kritisch";
  if (diff <= 7) return "bald";
  return "normal";
}

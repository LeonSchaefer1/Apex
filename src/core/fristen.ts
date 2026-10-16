// Fristenrechner – deterministisch und mit Rechenweg. Die Berechnungsnormen folgen der Verfahrensordnung:
// ZPO/ArbGG: § 222 ZPO i. V. m. §§ 187, 188 BGB · StPO: §§ 42, 43 StPO · OWiG: § 46 Abs. 1 OWiG i. V. m. §§ 42, 43 StPO ·
// VwGO: § 57 Abs. 2 VwGO i. V. m. § 222 ZPO · KSchG und materielles Recht: §§ 187, 188, 193 BGB.
// Grundsatz von AnwaltApex: Die KI ERKENNT Fristen in Dokumenten, BERECHNET werden sie ausschließlich hier.
import { addDays, addMonthsBGB, diffDays, fmtDate, fmtDateWd, wochentagName } from "./dates";
import { bundeslandAusGericht, bundeslandAusOrt, bundeslandName, feiertagAm, istWerktag } from "./feiertage";
import type { Akte, Bundesland, FristTyp, ISODate, Kontakt } from "./types";

export type Einheit = "tage" | "wochen" | "monate" | "jahresende";

/** Verfahrensordnung einer Frist – bestimmt Berechnungsnormen und Rechtsbehelfe bei Versäumnis. */
export type Verfahren = "ZPO" | "ArbGG" | "KSchG" | "StPO" | "OWiG" | "VwGO" | "BGB";

export interface FristRegel {
  key: string;
  titel: string;
  grundlage: string;
  dauer: number;
  einheit: Einheit;
  /** „notfrist“ nur für Fristen, die das Gesetz ausdrücklich so nennt (§ 224 Abs. 1 S. 2 ZPO) – sonst „frist“. */
  typ: FristTyp;
  ereignis: string; // "Zustellung des Urteils"
  gebiet: "Zivilprozess" | "Arbeitsrecht" | "Strafrecht" | "Verwaltungsrecht" | "Materielles Recht" | "Mahnverfahren";
  verfahren: Verfahren;
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
    key: "berufungsbegruendung", titel: "Berufungsbegründungsfrist", grundlage: "§ 520 Abs. 2 ZPO", dauer: 2, einheit: "monate", typ: "frist", verfahren: "ZPO",
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
    key: "frei_tage", titel: "Frei bestimmte Frist (Tage)", grundlage: "§§ 187, 188 BGB, § 222 ZPO", dauer: 10, einheit: "tage", typ: "frist", verfahren: "ZPO",
    ereignis: "Fristauslösendes Ereignis", gebiet: "Zivilprozess", vorfristTage: 3,
    versaeumnis: "Richterliche Fristen sind auf Antrag verlängerbar, wenn erhebliche Gründe glaubhaft gemacht sind (§ 224 Abs. 2 ZPO).", stichworte: ["tage"],
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
      ZPO: "Nicht verlängerbar",
      ArbGG: "Nicht verlängerbar",
      BGB: "Nicht verlängerbar",
    };
    return {
      label: "Frist",
      kritisch: true,
      art: r.verfahren === "KSchG" ? "Keine Notfrist im Sinne der ZPO, aber nicht verlängerbar." : `Gesetzliche Frist (${r.verfahren}) – nicht verlängerbar.`,
      versaeumnis: r.versaeumnis,
      kurz: kurz[r.verfahren],
    };
  }
  return { label: "Frist", kritisch: false, art: "", versaeumnis: r.versaeumnis, kurz: r.hinweis ?? r.versaeumnis };
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

function vorfristVon(ende: ISODate, tage: number, land: Bundesland): ISODate {
  let vorfrist = addDays(ende, -tage);
  let guard = 0;
  while (!istWerktag(vorfrist, land) && guard++ < 10) vorfrist = addDays(vorfrist, -1);
  return vorfrist;
}

/**
 * Berechnet das Fristende.
 * - Ereignisfrist: Der Tag des Ereignisses wird nicht mitgerechnet (§ 187 Abs. 1 BGB i. V. m. § 222 Abs. 1 ZPO; §§ 42, 43 StPO).
 * - Tage: Ende = Ereignis + n Tage. Wochen/Monate: Ablauf mit dem Tag, der durch Benennung oder Zahl dem Ereignistag
 *   entspricht; fehlt er, Monatsletzter (§ 188 Abs. 2, 3 BGB bzw. § 43 Abs. 1 StPO).
 * - Fällt das Ende auf Samstag, Sonntag oder allgemeinen Feiertag: nächster Werktag (§ 222 Abs. 2 ZPO, § 43 Abs. 2 StPO, § 193 BGB).
 *   Maßgeblich sind die Feiertage am Ort, an dem die Handlung vorzunehmen ist (Gericht bzw. Behörde).
 * - Vorfrist: n Tage vor Fristende, zurückverlegt auf den vorherigen Werktag.
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
  /** Woher die Feiertage stammen (z. B. „Gerichtsort laut Schreiben: Landgericht München I“) – erscheint im Rechenweg. */
  feiertagsOrt?: string;
}): FristErgebnis {
  const { ereignis, dauer, einheit, land } = params;
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
    rechenweg.push(`${dauerText}: Ende am Tag mit derselben Zahl – ${n.ende} → ${fmtDateWd(roh)}`);
    if (r.gekappt) rechenweg.push(`Diesen Tag gibt es im Zielmonat nicht → Monatsletzter (${n.monatsletzter})`);
  } else {
    const year = Number(ereignis.slice(0, 4));
    roh = `${year + dauer}-12-31`;
    rechenweg.push(`Beginn mit Schluss des Jahres ${year} (§ 199 Abs. 1 BGB), Dauer ${dauer} Jahre${params.grundlage ? ` (${params.grundlage})` : ""} → ${fmtDateWd(roh)}`);
  }
  if (params.feiertagsOrt) rechenweg.push(`Feiertage: ${bundeslandName(land)} – ${params.feiertagsOrt}`);

  let ende = roh;
  let verschoben = false;
  let guard = 0;
  while (!istWerktag(ende, land) && guard++ < 10) {
    const f = feiertagAm(ende, land);
    const wd = new Date(ende + "T00:00:00Z").getUTCDay();
    const grund = f && !f.teilweise ? f.name : wd === 6 ? "Samstag" : "Sonntag";
    rechenweg.push(`${fmtDate(ende)} ist ${grund} (${bundeslandName(land)}) → Verschiebung auf den nächsten Werktag`);
    ende = addDays(ende, 1);
    verschoben = true;
  }
  if (verschoben) rechenweg.push(`Fristende nach ${n.verschiebung}: ${fmtDateWd(ende)}, 24:00 Uhr`);
  else rechenweg.push(`Fristende fällt auf einen Werktag – keine Verschiebung: ${fmtDateWd(ende)}, 24:00 Uhr`);

  const regional = regionalWarnung(ende, land, n.verschiebung);
  if (regional) warnungen.push(regional);

  const vt = params.vorfristTage ?? 7;
  const vorfrist = vorfristVon(ende, vt, land);
  rechenweg.push(`Vorfrist ${vt} Tage vorher, auf Werktag gelegt: ${fmtDateWd(vorfrist)}`);

  return { ende, rohesEnde: roh, vorfrist, rechenweg, verschoben, verschiebungsNorm: n.verschiebung, land, warnungen };
}

export function berechneNachRegel(
  key: string,
  ereignis: ISODate,
  land: Bundesland,
  dauerOverride?: number,
  opts: { ereignisLabel?: string; feiertagsOrt?: string } = {},
): FristErgebnis & { regel: FristRegel } {
  const r = regel(key) ?? FRIST_REGELN[FRIST_REGELN.length - 1];
  // Feste Stelle der Handlung (z. B. BGH Karlsruhe) geht dem Gerichtsort laut Schreiben bzw. Kanzleisitz vor.
  const ort = r.handlungsort && r.handlungsort.land !== land ? r.handlungsort : undefined;
  const res = berechneFrist({
    ereignis,
    dauer: dauerOverride ?? r.dauer,
    einheit: r.einheit,
    land: ort?.land ?? land,
    vorfristTage: r.vorfristTage,
    ereignisLabel: opts.ereignisLabel ?? r.ereignis,
    // Bei frei bestimmten Fristen ist die „Grundlage“ nur die Berechnungsvorschrift – nicht als Dauer-Grundlage nennen.
    grundlage: r.key === "frei_tage" ? undefined : r.grundlage,
    verfahren: r.verfahren,
    feiertagsOrt: ort ? `Ort der Handlung: ${ort.ort}` : opts.feiertagsOrt,
  });
  return { ...res, regel: r };
}

/**
 * Frist mit festem Enddatum (z. B. „bis zum 20.11.2026 Stellung zu nehmen“). Das genannte Datum wird übernommen.
 * Fällt es auf Wochenende/Feiertag, endet die Frist nach § 222 Abs. 2 ZPO erst am nächsten Werktag – AnwaltApex
 * notiert vorsorglich das genannte Datum und weist darauf hin.
 */
export function berechneFestesEnde(params: { ende: ISODate; ereignis: ISODate; land: Bundesland; ereignisLabel?: string; quelle?: string; vorfristTage?: number }): FristErgebnis {
  const { ende, ereignis, land } = params;
  const rechenweg: string[] = [];
  const warnungen: string[] = [];
  rechenweg.push(`${params.ereignisLabel ?? "Eingang des Schreibens"}: ${fmtDateWd(ereignis)}`);
  rechenweg.push(`Fristende laut ${params.quelle ?? "Schreiben"} (festes Datum): ${fmtDateWd(ende)}`);
  let naechster = ende;
  let guard = 0;
  while (!istWerktag(naechster, land) && guard++ < 10) naechster = addDays(naechster, 1);
  if (naechster !== ende) {
    const f = feiertagAm(ende, land);
    const wd = new Date(ende + "T00:00:00Z").getUTCDay();
    const grund = f && !f.teilweise ? f.name : wd === 6 ? "Samstag" : "Sonntag";
    rechenweg.push(`${fmtDate(ende)} ist ${grund} (${bundeslandName(land)}) – nach § 222 Abs. 2 ZPO endet die Frist erst am ${fmtDateWd(naechster)}; vorsorglich gilt das genannte Datum`);
    warnungen.push(`Das genannte Datum ist ein ${grund}. Rechtlich endet die Frist erst am ${fmtDateWd(naechster)} (§ 222 Abs. 2 ZPO) – AnwaltApex notiert vorsorglich den ${fmtDate(ende)}.`);
  } else {
    rechenweg.push(`${fmtDate(ende)} ist ein Werktag – keine Verschiebung: ${fmtDateWd(ende)}, 24:00 Uhr`);
    const regional = regionalWarnung(ende, land, "§ 222 Abs. 2 ZPO");
    if (regional) warnungen.push(regional);
  }
  const spanne = diffDays(ereignis, ende);
  const vt = params.vorfristTage ?? (spanne >= 21 ? 7 : spanne >= 8 ? 3 : 1);
  let vorfrist = vorfristVon(ende, vt, land);
  if (vorfrist < ereignis) vorfrist = ereignis;
  rechenweg.push(`Vorfrist ${vt} ${vt === 1 ? "Tag" : "Tage"} vorher, auf Werktag gelegt: ${fmtDateWd(vorfrist)}`);
  return { ende, rohesEnde: ende, vorfrist, rechenweg, verschoben: false, verschiebungsNorm: "§ 222 Abs. 2 ZPO", land, warnungen };
}

/** Gerichtsort einer Akte (über das hinterlegte Gericht) – für die Feiertage nach § 222 Abs. 2 ZPO. */
export function gerichtsortDerAkte(akte: Pick<Akte, "gerichtId"> | undefined, kontakte: Kontakt[]): { land: Bundesland; gericht: string } | undefined {
  const k = akte?.gerichtId ? kontakte.find((x) => x.id === akte.gerichtId) : undefined;
  if (!k) return undefined;
  const land = bundeslandAusGericht(k.name)?.land ?? (k.ort ? bundeslandAusOrt(k.ort) : undefined);
  return land ? { land, gericht: k.name } : undefined;
}

/** Ampel für Fristen: rot ≤ 2 Werktage / überfällig, gelb ≤ 7 Tage, sonst ruhig. */
export function fristDringlichkeit(datum: ISODate, heute: ISODate): "ueberfaellig" | "kritisch" | "bald" | "normal" {
  const diff = (new Date(datum + "T00:00:00Z").getTime() - new Date(heute + "T00:00:00Z").getTime()) / 86400000;
  if (diff < 0) return "ueberfaellig";
  if (diff <= 2) return "kritisch";
  if (diff <= 7) return "bald";
  return "normal";
}

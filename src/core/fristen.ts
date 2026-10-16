// Fristenrechner nach §§ 187, 188, 193 BGB i. V. m. § 222 ZPO – deterministisch und mit Rechenweg.
// Grundsatz von AnwaltApex: Die KI ERKENNT Fristen in Dokumenten, BERECHNET werden sie ausschließlich hier.
import { addDays, addMonthsBGB, fmtDate, fmtDateWd, wochentagName } from "./dates";
import { bundeslandName, feiertagAm, istWerktag } from "./feiertage";
import type { Bundesland, FristTyp, ISODate } from "./types";

export type Einheit = "tage" | "wochen" | "monate" | "jahresende";

export interface FristRegel {
  key: string;
  titel: string;
  grundlage: string;
  dauer: number;
  einheit: Einheit;
  typ: FristTyp; // notfrist | frist
  ereignis: string; // "Zustellung des Urteils"
  gebiet: "Zivilprozess" | "Arbeitsrecht" | "Strafrecht" | "Verwaltungsrecht" | "Materielles Recht" | "Mahnverfahren";
  vorfristTage: number;
  hinweis?: string;
  stichworte: string[];
}

export const FRIST_REGELN: FristRegel[] = [
  {
    key: "berufung", titel: "Berufungsfrist", grundlage: "§ 517 ZPO", dauer: 1, einheit: "monate", typ: "notfrist",
    ereignis: "Zustellung des vollständigen Urteils", gebiet: "Zivilprozess", vorfristTage: 7,
    hinweis: "Spätestens fünf Monate nach Verkündung.", stichworte: ["berufung", "urteil", "zustellung", "517"],
  },
  {
    key: "berufungsbegruendung", titel: "Berufungsbegründungsfrist", grundlage: "§ 520 Abs. 2 ZPO", dauer: 2, einheit: "monate", typ: "frist",
    ereignis: "Zustellung des vollständigen Urteils", gebiet: "Zivilprozess", vorfristTage: 14,
    hinweis: "Verlängerung auf Antrag möglich (§ 520 Abs. 2 S. 2, 3 ZPO).", stichworte: ["berufungsbegründung", "520"],
  },
  {
    key: "revision", titel: "Revisionsfrist", grundlage: "§ 548 ZPO", dauer: 1, einheit: "monate", typ: "notfrist",
    ereignis: "Zustellung des Berufungsurteils", gebiet: "Zivilprozess", vorfristTage: 7, stichworte: ["revision", "548"],
  },
  {
    key: "revisionsbegruendung", titel: "Revisionsbegründungsfrist", grundlage: "§ 551 Abs. 2 ZPO", dauer: 2, einheit: "monate", typ: "frist",
    ereignis: "Zustellung des Berufungsurteils", gebiet: "Zivilprozess", vorfristTage: 14, stichworte: ["revisionsbegründung", "551"],
  },
  {
    key: "einspruch_vu", titel: "Einspruch gegen Versäumnisurteil", grundlage: "§ 339 Abs. 1 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist",
    ereignis: "Zustellung des Versäumnisurteils", gebiet: "Zivilprozess", vorfristTage: 4, stichworte: ["versäumnisurteil", "einspruch", "339"],
  },
  {
    key: "sofortige_beschwerde", titel: "Sofortige Beschwerde", grundlage: "§ 569 Abs. 1 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist",
    ereignis: "Zustellung der Entscheidung", gebiet: "Zivilprozess", vorfristTage: 4, stichworte: ["beschwerde", "beschluss", "569"],
  },
  {
    key: "verteidigungsanzeige", titel: "Anzeige der Verteidigungsbereitschaft", grundlage: "§ 276 Abs. 1 S. 1 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist",
    ereignis: "Zustellung der Klageschrift", gebiet: "Zivilprozess", vorfristTage: 4,
    hinweis: "Die Frist zur Klageerwiderung setzt das Gericht (mind. zwei weitere Wochen).", stichworte: ["klage", "verteidigung", "276", "schriftliches vorverfahren"],
  },
  {
    key: "klageerwiderung", titel: "Klageerwiderungsfrist (gerichtlich gesetzt)", grundlage: "§ 276 Abs. 1 S. 2 ZPO", dauer: 4, einheit: "wochen", typ: "frist",
    ereignis: "Zustellung der Klageschrift", gebiet: "Zivilprozess", vorfristTage: 7,
    hinweis: "Dauer laut Verfügung des Gerichts prüfen.", stichworte: ["klageerwiderung", "erwiderung", "stellungnahme"],
  },
  {
    key: "widerspruch_mb", titel: "Widerspruch gegen Mahnbescheid", grundlage: "§ 692 Abs. 1 Nr. 3, § 694 ZPO", dauer: 2, einheit: "wochen", typ: "frist",
    ereignis: "Zustellung des Mahnbescheids", gebiet: "Mahnverfahren", vorfristTage: 4,
    hinweis: "Widerspruch ist bis zum Erlass des Vollstreckungsbescheids möglich.", stichworte: ["mahnbescheid", "widerspruch", "694"],
  },
  {
    key: "einspruch_vb", titel: "Einspruch gegen Vollstreckungsbescheid", grundlage: "§§ 700 Abs. 1, 339 ZPO", dauer: 2, einheit: "wochen", typ: "notfrist",
    ereignis: "Zustellung des Vollstreckungsbescheids", gebiet: "Mahnverfahren", vorfristTage: 4, stichworte: ["vollstreckungsbescheid", "700"],
  },
  {
    key: "kschg_klage", titel: "Kündigungsschutzklage", grundlage: "§ 4 S. 1 KSchG", dauer: 3, einheit: "wochen", typ: "notfrist",
    ereignis: "Zugang der schriftlichen Kündigung", gebiet: "Arbeitsrecht", vorfristTage: 7,
    hinweis: "Bei Versäumnis gilt die Kündigung als wirksam (§ 7 KSchG); nachträgliche Zulassung nur nach § 5 KSchG.",
    stichworte: ["kündigung", "kündigungsschutz", "kschg", "arbeitsverhältnis"],
  },
  {
    key: "berufung_arbg", titel: "Berufungsfrist (Arbeitsgericht)", grundlage: "§ 66 Abs. 1 ArbGG", dauer: 1, einheit: "monate", typ: "notfrist",
    ereignis: "Zustellung des Urteils", gebiet: "Arbeitsrecht", vorfristTage: 7, stichworte: ["arbeitsgericht", "berufung", "66 arbgg"],
  },
  {
    key: "einspruch_strafbefehl", titel: "Einspruch gegen Strafbefehl", grundlage: "§ 410 Abs. 1 StPO", dauer: 2, einheit: "wochen", typ: "notfrist",
    ereignis: "Zustellung des Strafbefehls", gebiet: "Strafrecht", vorfristTage: 4, stichworte: ["strafbefehl", "410"],
  },
  {
    key: "berufung_stpo", titel: "Berufung (Strafsachen)", grundlage: "§ 314 Abs. 1 StPO", dauer: 1, einheit: "wochen", typ: "notfrist",
    ereignis: "Verkündung des Urteils", gebiet: "Strafrecht", vorfristTage: 2, stichworte: ["strafurteil", "berufung", "314"],
  },
  {
    key: "revision_stpo", titel: "Revision (Strafsachen)", grundlage: "§ 341 Abs. 1 StPO", dauer: 1, einheit: "wochen", typ: "notfrist",
    ereignis: "Verkündung des Urteils", gebiet: "Strafrecht", vorfristTage: 2, stichworte: ["revision", "341"],
  },
  {
    key: "einspruch_bussgeld", titel: "Einspruch gegen Bußgeldbescheid", grundlage: "§ 67 Abs. 1 OWiG", dauer: 2, einheit: "wochen", typ: "notfrist",
    ereignis: "Zustellung des Bußgeldbescheids", gebiet: "Strafrecht", vorfristTage: 4, stichworte: ["bußgeld", "owig", "67"],
  },
  {
    key: "widerspruch_va", titel: "Widerspruch gegen Verwaltungsakt", grundlage: "§ 70 Abs. 1 VwGO", dauer: 1, einheit: "monate", typ: "frist",
    ereignis: "Bekanntgabe des Verwaltungsakts", gebiet: "Verwaltungsrecht", vorfristTage: 7,
    hinweis: "Ohne ordnungsgemäße Rechtsbehelfsbelehrung: ein Jahr (§ 58 Abs. 2 VwGO).", stichworte: ["bescheid", "widerspruch", "verwaltungsakt"],
  },
  {
    key: "anfechtungsklage", titel: "Anfechtungsklage", grundlage: "§ 74 Abs. 1 VwGO", dauer: 1, einheit: "monate", typ: "frist",
    ereignis: "Zustellung des Widerspruchsbescheids", gebiet: "Verwaltungsrecht", vorfristTage: 7, stichworte: ["widerspruchsbescheid", "klage", "74"],
  },
  {
    key: "regelverjaehrung", titel: "Regelverjährung", grundlage: "§§ 195, 199 Abs. 1 BGB", dauer: 3, einheit: "jahresende", typ: "frist",
    ereignis: "Entstehung des Anspruchs und Kenntnis", gebiet: "Materielles Recht", vorfristTage: 60,
    hinweis: "Fristbeginn mit Schluss des Jahres der Entstehung/Kenntnis; Hemmung nach §§ 203 ff. BGB prüfen.",
    stichworte: ["verjährung", "195", "199"],
  },
  {
    key: "frei_tage", titel: "Frei bestimmte Frist (Tage)", grundlage: "§§ 187, 188 BGB, § 222 ZPO", dauer: 10, einheit: "tage", typ: "frist",
    ereignis: "Fristauslösendes Ereignis", gebiet: "Zivilprozess", vorfristTage: 3, stichworte: ["tage"],
  },
];

export function regel(key: string): FristRegel | undefined {
  return FRIST_REGELN.find((r) => r.key === key);
}

export interface FristErgebnis {
  ende: ISODate;
  rohesEnde: ISODate; // rechnerisches Ende vor Verschiebung nach § 222 Abs. 2 ZPO
  vorfrist: ISODate;
  rechenweg: string[];
  verschoben: boolean;
  warnungen: string[];
}

function einheitText(dauer: number, einheit: Einheit): string {
  if (einheit === "tage") return dauer === 1 ? "1 Tag" : `${dauer} Tage`;
  if (einheit === "wochen") return dauer === 1 ? "1 Woche" : `${dauer} Wochen`;
  if (einheit === "monate") return dauer === 1 ? "1 Monat" : `${dauer} Monate`;
  return `${dauer} Jahre ab Jahresende`;
}

/**
 * Berechnet das Fristende.
 * - Ereignisfrist (§ 187 Abs. 1 BGB): Der Tag des Ereignisses wird nicht mitgerechnet.
 * - Tage: Ende = Ereignis + n Tage. Wochen/Monate (§ 188 Abs. 2 BGB): Ablauf mit dem Tag,
 *   der durch Benennung oder Zahl dem Ereignistag entspricht; fehlt er, Monatsletzter (§ 188 Abs. 3 BGB).
 * - Fällt das Ende auf Samstag, Sonntag oder allgemeinen Feiertag: nächster Werktag (§ 222 Abs. 2 ZPO, § 193 BGB).
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
}): FristErgebnis {
  const { ereignis, dauer, einheit, land } = params;
  const rechenweg: string[] = [];
  const warnungen: string[] = [];
  const label = params.ereignisLabel ?? "Fristauslösendes Ereignis";
  const dauerText = `Dauer ${einheitText(dauer, einheit)}${params.grundlage ? ` (${params.grundlage})` : ""}`;
  rechenweg.push(`${label}: ${fmtDateWd(ereignis)}`);

  let roh: ISODate;
  if (einheit === "tage") {
    roh = addDays(ereignis, dauer);
    rechenweg.push(`Fristbeginn am Folgetag – der Ereignistag zählt nicht mit (§ 187 Abs. 1 BGB)`);
    rechenweg.push(`${dauerText} → rechnerisches Ende ${fmtDateWd(roh)}`);
  } else if (einheit === "wochen") {
    roh = addDays(ereignis, dauer * 7);
    rechenweg.push(`Fristbeginn am Folgetag – der Ereignistag zählt nicht mit (§ 187 Abs. 1 BGB)`);
    rechenweg.push(`${dauerText}: Ende am gleichnamigen Wochentag (${wochentagName(ereignis)}) – § 188 Abs. 2 BGB → ${fmtDateWd(roh)}`);
  } else if (einheit === "monate") {
    const r = addMonthsBGB(ereignis, dauer);
    roh = r.date;
    rechenweg.push(`Fristbeginn am Folgetag – der Ereignistag zählt nicht mit (§ 187 Abs. 1 BGB)`);
    rechenweg.push(`${dauerText}: Ende am Tag mit derselben Zahl – § 188 Abs. 2 BGB → ${fmtDateWd(roh)}`);
    if (r.gekappt) rechenweg.push(`Diesen Tag gibt es im Zielmonat nicht → Monatsletzter (§ 188 Abs. 3 BGB)`);
  } else {
    const year = Number(ereignis.slice(0, 4));
    roh = `${year + dauer}-12-31`;
    rechenweg.push(`Beginn mit Schluss des Jahres ${year} (§ 199 Abs. 1 BGB), Dauer ${dauer} Jahre${params.grundlage ? ` (${params.grundlage})` : ""} → ${fmtDateWd(roh)}`);
  }

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
  if (verschoben) rechenweg.push(`Fristende nach § 222 Abs. 2 ZPO / § 193 BGB: ${fmtDateWd(ende)}, 24:00 Uhr`);
  else rechenweg.push(`Fristende fällt auf einen Werktag – keine Verschiebung: ${fmtDateWd(ende)}, 24:00 Uhr`);

  const tf = feiertagAm(ende, land);
  if (tf?.teilweise) {
    warnungen.push(`${tf.name}: nur regional Feiertag – AnwaltApex verlängert vorsorglich nicht. Gerichtsort prüfen.`);
  }

  const vt = params.vorfristTage ?? 7;
  let vorfrist = addDays(ende, -vt);
  guard = 0;
  while (!istWerktag(vorfrist, land) && guard++ < 10) vorfrist = addDays(vorfrist, -1);
  rechenweg.push(`Vorfrist ${vt} Tage vorher, auf Werktag gelegt: ${fmtDateWd(vorfrist)}`);

  return { ende, rohesEnde: roh, vorfrist, rechenweg, verschoben, warnungen };
}

export function berechneNachRegel(key: string, ereignis: ISODate, land: Bundesland, dauerOverride?: number): FristErgebnis & { regel: FristRegel } {
  const r = regel(key) ?? FRIST_REGELN[FRIST_REGELN.length - 1];
  const res = berechneFrist({
    ereignis,
    dauer: dauerOverride ?? r.dauer,
    einheit: r.einheit,
    land,
    vorfristTage: r.vorfristTage,
    ereignisLabel: r.ereignis,
    // Bei frei bestimmten Fristen ist die „Grundlage“ nur die Berechnungsvorschrift – nicht als Dauer-Grundlage nennen.
    grundlage: r.key === "frei_tage" ? undefined : r.grundlage,
  });
  return { ...res, regel: r };
}

/** Ampel für Fristen: rot ≤ 2 Werktage / überfällig, gelb ≤ 7 Tage, sonst ruhig. */
export function fristDringlichkeit(datum: ISODate, heute: ISODate): "ueberfaellig" | "kritisch" | "bald" | "normal" {
  const diff = (new Date(datum + "T00:00:00Z").getTime() - new Date(heute + "T00:00:00Z").getTime()) / 86400000;
  if (diff < 0) return "ueberfaellig";
  if (diff <= 2) return "kritisch";
  if (diff <= 7) return "bald";
  return "normal";
}

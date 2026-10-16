// Spaltenzuordnung Altsystem → AnwaltApex: Synonym-Erkennung, Werte-Umwandlung und Dublettenprüfung.
import type { Akte, Bundesland, FristTyp, ISODate, Sachgebiet } from "@/core/types";
import { addDays, fmtDate, fmtDateWd, today } from "@/core/dates";
import { feiertagAm, istWerktag } from "@/core/feiertage";
import type { CsvErgebnis } from "./csv";

export type QuellSystem = "ramicro" | "actaport" | "advoware" | "renostar" | "csv";

export const SYSTEME: { key: QuellSystem; name: string; kuerzel: string; text: string }[] = [
  { key: "ramicro", name: "RA-MICRO", kuerzel: "RM", text: "Akten- und Adresslisten als CSV-Export" },
  { key: "actaport", name: "ACTAPORT", kuerzel: "AP", text: "Aktenliste als CSV aus der Aktenübersicht" },
  { key: "advoware", name: "Advoware", kuerzel: "AW", text: "Aktenauswertung als CSV-Datei" },
  { key: "renostar", name: "ReNoStar", kuerzel: "RS", text: "Aktenliste als Text-/CSV-Export" },
  { key: "csv", name: "CSV / Excel-Export", kuerzel: "CSV", text: "Jede Tabelle mit Kopfzeile – auch aus Excel" },
];

export function systemName(k: QuellSystem | null | undefined): string {
  return SYSTEME.find((s) => s.key === k)?.name ?? "Altsystem";
}

export type ZielFeld = "aktenzeichen" | "titel" | "mandant" | "gegner" | "sachgebiet" | "gegenstandswert" | "angelegt" | "fristDatum" | "fristTitel";

export const ZIELFELDER: { key: ZielFeld; label: string; kurz: string }[] = [
  { key: "aktenzeichen", label: "Aktenzeichen", kurz: "Az." },
  { key: "titel", label: "Bezeichnung (Rubrum)", kurz: "Bezeichnung" },
  { key: "mandant", label: "Mandant", kurz: "Mandant" },
  { key: "gegner", label: "Gegner", kurz: "Gegner" },
  { key: "sachgebiet", label: "Sachgebiet", kurz: "Sachgebiet" },
  { key: "gegenstandswert", label: "Gegenstandswert", kurz: "Wert" },
  { key: "angelegt", label: "Angelegt am", kurz: "Angelegt" },
  { key: "fristDatum", label: "Fristdatum", kurz: "Frist" },
  { key: "fristTitel", label: "Fristart / Bezeichnung", kurz: "Fristart" },
];

export function zielLabel(z: ZielFeld): string {
  return ZIELFELDER.find((f) => f.key === z)?.label ?? z;
}

const SYNONYME: Record<ZielFeld, string[]> = {
  aktenzeichen: ["aktenzeichen", "az", "aktennummer", "aktennr", "aktenno", "akte", "unseraz", "unserzeichen", "referenz", "aktenzeichenintern", "nummer", "nr"],
  titel: ["kurzbezeichnung", "bezeichnung", "rubrum", "kurzrubrum", "titel", "aktenbezeichnung", "aktentitel", "betreff", "sache", "bez"],
  mandant: ["mandant", "mandantname", "mandantin", "mandantenname", "auftraggeber", "kunde", "client"],
  gegner: ["gegner", "gegnername", "gegnerin", "gegenseite", "gegenpartei", "anspruchsgegner", "beklagter", "beklagte"],
  sachgebiet: ["sachgebiet", "rechtsgebiet", "referat", "fachgebiet", "gebiet", "bereich", "kategorie"],
  gegenstandswert: ["gegenstandswert", "gegenstandwert", "streitwert", "wert", "gw", "forderung", "betrag"],
  angelegt: ["anlagedatum", "angelegt", "angelegtam", "anlage", "datumanlage", "erstellt", "erstelltam", "eroeffnet", "eroeffnetam", "beginn"],
  fristDatum: ["naechstefrist", "frist", "fristdatum", "fristende", "fristablauf", "wiedervorlage", "wiedervorlagefrist", "wvdatum", "faelligam"],
  fristTitel: ["fristart", "fristbezeichnung", "fristgrund", "artderfrist", "fristtyp", "fristbeschreibung", "fristtext", "wvgrund"],
};

export function normKopf(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Ordnet Quellspalten automatisch zu (exakter Synonym-Treffer vor Teiltreffer, jedes Zielfeld höchstens einmal). */
export function autoZuordnung(kopf: string[]): (ZielFeld | null)[] {
  const kandidaten: { spalte: number; feld: ZielFeld; score: number }[] = [];
  kopf.forEach((h, spalte) => {
    const n = normKopf(h);
    if (!n) return;
    for (const feld of Object.keys(SYNONYME) as ZielFeld[]) {
      let best = 0;
      for (const syn of SYNONYME[feld]) {
        if (n === syn) best = Math.max(best, 3);
        else if (syn.length >= 4 && n.startsWith(syn)) best = Math.max(best, 2);
        else if (syn.length >= 5 && n.includes(syn)) best = Math.max(best, 1);
      }
      if (best) kandidaten.push({ spalte, feld, score: best });
    }
  });
  kandidaten.sort((a, b) => b.score - a.score || a.spalte - b.spalte);
  const out: (ZielFeld | null)[] = kopf.map(() => null);
  const vergeben = new Set<ZielFeld>();
  for (const k of kandidaten) {
    if (out[k.spalte] || vergeben.has(k.feld)) continue;
    out[k.spalte] = k.feld;
    vergeben.add(k.feld);
  }
  return out;
}

/** Kleinbuchstaben, Umlaute ausgeschrieben, Satzzeichen → Leerzeichen: Wortgrenzen bleiben erhalten (anders als `normKopf`). */
export function normWorte(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9§]+/g, " ")
    .trim();
}

// Wortanfänge bzw. ganze Begriffe – „wegen“ ist kein WEG, „Wettbewerbsrecht“ kein Erbrecht, „Bauer“ kein Baurecht.
const SG_REGELN: [RegExp, Sachgebiet][] = [
  [/\barbeit|\bkschg\b|kuendigungsschutz|\barbg\b|\bbetriebsrat/, "Arbeitsrecht"],
  [/miet|\bpacht|\bweg\b|wohnungseigentum|\bwohnraum/, "Mietrecht"],
  [/\bverkehr|strassenverkehr|unfall|bussgeld|\bkfz\b|fahrverbot|\bstvg\b|\bstvo\b/, "Verkehrsrecht"],
  [/\bfamili|scheidung|unterhalt|sorgerecht|\bumgang|zugewinn|versorgungsausgleich|\bkindschaft/, "Familienrecht"],
  [/\berb(recht|schaft|schein|en|in|fall|teil|auseinander|vertrag)|nachlass|testament|pflichtteil|vermaechtnis|ausschlagung/, "Erbrecht"],
  [/\bstraf|\bowi\b|ordnungswidrig|\bstpo\b|\bstgb\b|ermittlungsverfahren/, "Strafrecht"],
  [/forderung|inkasso|\bmahn|beitreib|vollstreck/, "Forderungseinzug"],
  [/\bbau(recht|vertrag|maengel|mangel|leistung|sache|prozess|stelle|herr|unternehm|haftung|planung|genehmigung)|\bbau\b|\barchitekt|\bvob\b|\bhoai\b/, "Baurecht"],
  [/\bverwaltungs|\bbeamt|\bsozial|auslaender|aufenthalt|\basyl|\bbehoerd|\bvwgo\b/, "Verwaltungsrecht"],
  [/vertrag|\bkauf|zivil|handel|gesellsch|allgemein|schuldrecht|\bbgb\b/, "Vertragsrecht"],
];

/** Gebiete ohne eigenes Sachgebiet in AnwaltApex – werden als Vertragsrecht übernommen, aber zur Prüfung markiert. */
const OHNE_SACHGEBIET = /wettbewerb|\buwg\b|\bmarke|gewerblich\w* rechtsschutz|\burheber|\bpatent|\bdesign|\bkartell|\bmedienrecht/;

export interface SachgebietTreffer {
  sg: Sachgebiet;
  /** sicher zugeordnet (aus der Sachgebiets-Spalte oder eindeutig aus der Bezeichnung) */
  erkannt: boolean;
  /** Erklärung für die Vorschau, wenn das Sachgebiet geprüft werden sollte */
  hinweis?: string;
}

/** Sachgebiet aus dem Wert des Altsystems; die Bezeichnung zählt nur nachrangig, wenn die Spalte leer ist. */
export function sachgebietAus(wert: string, titel = ""): SachgebietTreffer {
  const w = normWorte(wert);
  if (w) {
    if (OHNE_SACHGEBIET.test(w)) return { sg: "Vertragsrecht", erkannt: false, hinweis: `„${wert}“ hat kein eigenes Sachgebiet – als Vertragsrecht übernommen, bitte prüfen.` };
    for (const [re, sg] of SG_REGELN) if (re.test(w)) return { sg, erkannt: true };
    return { sg: "Vertragsrecht", erkannt: false, hinweis: `Sachgebiet „${wert}“ nicht erkannt – als Vertragsrecht übernommen, bitte prüfen.` };
  }
  const t = normWorte(titel);
  if (t && !OHNE_SACHGEBIET.test(t)) for (const [re, sg] of SG_REGELN) if (re.test(t)) return { sg, erkannt: true, hinweis: `Sachgebiet aus der Bezeichnung abgeleitet (${sg}) – bitte prüfen.` };
  return { sg: "Vertragsrecht", erkannt: false, hinweis: "Kein Sachgebiet angegeben – als Vertragsrecht übernommen, bitte prüfen." };
}

/** Rechtsformen und Stellen – solche Namen sind keine Personen. */
export const ORG = /\b(GmbH|AG|KG|UG|eG|e\.\s?V\.|GbR|mbH|OHG|SE|PartG|Stadt|Landkreis|Gemeinde|Versicherung|Erbengemeinschaft|Bußgeldstelle|Stadtwerke|Rechtsanwälte|Kanzlei)\b/i;

/** „Müller, Hans“ (Adresslisten vieler Altsysteme) → „Hans Müller“; Firmen und mehrteilige Angaben bleiben unverändert. */
const NACHNAME = /^(?:(?:von|van|de|zu|vom|zum|ter|der|den|di|da|le|la)\s+)*[\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*)?$/u;
const VORNAMEN = /^(?:(?:Dr\.|Prof\.|Dipl\.-\p{L}+\.?)\s+)*[\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}.'’-]*){0,2}$/u;

export function personName(roh: string): string {
  const s = roh.replace(/\s+/g, " ").trim();
  if (ORG.test(s) || /\d/.test(s)) return s;
  const teile = s.split(",");
  if (teile.length !== 2) return s;
  let nach = teile[0].trim();
  const vor = teile[1].trim();
  // Titel vor dem Nachnamen („Dr. Müller, Hans“) wandern nach vorn: „Dr. Hans Müller“
  const titel = /^((?:(?:Dr\.|Prof\.)\s+)+)/.exec(nach)?.[1] ?? "";
  nach = nach.slice(titel.length);
  if (!NACHNAME.test(nach) || !VORNAMEN.test(vor) || /\bInh\b/i.test(vor)) return s;
  return `${titel}${vor} ${nach}`;
}

/**
 * Art einer übernommenen Frist aus der Fristart des Altsystems. „Notfrist“ nur, wenn das Altsystem sie so nennt oder es sich
 * erkennbar um eine gesetzliche Notfrist der ZPO handelt (§ 224 Abs. 1 S. 2 ZPO) – im Zweifel „Frist“; geprüft wird ohnehin im Vier-Augen-Prinzip.
 */
export function fristTypAus(fristart: string, sg?: Sachgebiet): FristTyp {
  const t = normWorte(fristart);
  if (!t) return "frist";
  if (/\bwiedervorlage|\bwv\b/.test(t)) return "wiedervorlage";
  if (/termin|verhandlung|besprechung/.test(t)) return "termin";
  if (/notfrist/.test(t)) return "notfrist";
  if (/begruendung|stellungnahme|erwiderung|replik|widerspruch/.test(t)) return "frist";
  if (sg === "Strafrecht") return "frist"; // StPO/OWiG: nicht verlängerbar, aber keine Notfristen der ZPO
  if (/berufungsfrist|\bberufung\b|revisionsfrist|\brevision\b|versaeumnisurteil|vollstreckungsbescheid|sofortige beschwerde|verteidigungsanzeige|verteidigungsbereitschaft|§ 517\b|§ 548\b|§ 339\b|§ 569\b|§ 700\b/.test(t)) return "notfrist";
  return "frist";
}

/** Rechtsgrundlage, wenn die Fristart sie ausdrücklich nennt (z. B. „Berufungsbegründung § 520 ZPO“). */
export function grundlageAus(fristart: string): string | undefined {
  const m = /§§?\s*\d+[a-z]?(?:\s*Abs\.\s*\d+)?(?:\s*(?:S|Satz)\.?\s*\d+)?\s*(?:ZPO|BGB|KSchG|ArbGG|StPO|OWiG|VwGO|FamFG|SGG|FGO|InsO|ZVG)\b/.exec(fristart);
  return m?.[0].replace(/\s+/g, " ");
}

/** Plausibilität eines übernommenen Fristendes: abgelaufen bzw. Wochenende/Feiertag (§ 222 Abs. 2 ZPO, § 193 BGB). */
export function fristPruefung(datum: ISODate, typ: FristTyp, land: Bundesland, heute: ISODate = today()): string | undefined {
  if (typ === "termin" || typ === "wiedervorlage") return datum < heute ? `Datum ${fmtDate(datum)} liegt in der Vergangenheit – bitte im Altsystem prüfen, ob erledigt.` : undefined;
  if (datum < heute) return `Fristende ${fmtDate(datum)} liegt in der Vergangenheit – bitte prüfen, ob die Frist im Altsystem erledigt wurde. Sie wird als überfällig angelegt.`;
  if (!istWerktag(datum, land)) {
    let naechster = addDays(datum, 1);
    for (let i = 0; i < 10 && !istWerktag(naechster, land); i++) naechster = addDays(naechster, 1);
    const ft = feiertagAm(datum, land);
    const wd = new Date(`${datum}T00:00:00Z`).getUTCDay();
    return `Fristende ${fmtDateWd(datum)} ist ${ft && wd !== 0 && wd !== 6 ? `ein Feiertag (${ft.name})` : wd === 6 ? "ein Samstag" : wd === 0 ? "ein Sonntag" : "kein Werktag"} – bei gesetzlichen und richterlichen Fristen endet die Frist erst am nächsten Werktag, ${fmtDateWd(naechster)} (§ 222 Abs. 2 ZPO, § 193 BGB). Bitte mit dem Fristenrechner nachrechnen.`;
  }
  return undefined;
}

/** „12.500,00 €", „12500.5", „1,234.56" → Zahl */
export function parseBetrag(v: string): number {
  let s = v.replace(/[€\s]|EUR/gi, "").replace(/ /g, "");
  if (!s) return 0;
  const komma = s.lastIndexOf(",");
  const punkt = s.lastIndexOf(".");
  if (komma > -1 && punkt > -1) {
    s = komma > punkt ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (komma > -1) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (punkt > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** „16.10.2026", „16.10.26", „2026-10-16" → ISO-Datum */
export function parseDatum(v: string): ISODate | undefined {
  const s = v.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/.exec(s);
  if (r) {
    d = +r[1];
    m = +r[2];
    y = +r[3];
    if (r[3].length === 2) y += y < 70 ? 2000 : 1900;
  } else if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) {
    y = +r[1];
    m = +r[2];
    d = +r[3];
  } else return undefined;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return dt.toISOString().slice(0, 10);
}

export function normName(s: string): string {
  return normKopf(s.replace(/\b(herr|frau|dr|prof)\b\.?/gi, ""));
}

export type DublettenAktion = "skip" | "overwrite";

export interface MigZeile {
  nr: number; // Zeile in der Datei (ab 2, Kopfzeile = 1)
  quellAz: string;
  titel: string;
  mandant: string;
  gegner: string;
  sachgebiet: Sachgebiet;
  sachgebietRoh: string;
  gegenstandswert: number;
  angelegt?: ISODate;
  fristDatum?: ISODate;
  fristTitel: string;
  /** aus der Fristart abgeleitet (Notfrist, Frist, Wiedervorlage, Termin) */
  fristTyp: FristTyp;
  /** Plausibilitätswarnung zum Fristende (abgelaufen, Wochenende/Feiertag) */
  fristWarnung?: string;
  /** Sachgebiet sicher erkannt? Sonst Hinweis in der Vorschau */
  sachgebietErkannt: boolean;
  sachgebietHinweis?: string;
  roh: [string, string][];
  dublette?: { akteId: string; az: string; titel: string; grund: "Aktenzeichen" | "Bezeichnung" | "Aktenzeichen und Bezeichnung" };
  fehler?: string; // Zeile wird nicht übernommen
  hinweis?: string; // Zeile wird übernommen, Teilwert fehlt
}

/** Wendet die Zuordnung auf alle Zeilen an, prüft Dubletten gegen den vorhandenen Aktenbestand und die Plausibilität der Fristen. */
export function baueZeilen(csv: CsvErgebnis, zuordnung: (ZielFeld | null)[], akten: Akte[], land: Bundesland = "BE", heute: ISODate = today()): MigZeile[] {
  const idx = (f: ZielFeld) => zuordnung.indexOf(f);
  const get = (row: string[], f: ZielFeld) => {
    const i = idx(f);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };
  const nachAz = new Map(akten.map((a) => [a.aktenzeichen.trim().toLowerCase(), a]));
  const nachTitel = new Map(akten.map((a) => [normName(a.titel), a]));
  return csv.zeilen.map((row, i) => {
    const quellAz = get(row, "aktenzeichen");
    const mandant = personName(get(row, "mandant"));
    const gegner = personName(get(row, "gegner"));
    let titel = get(row, "titel");
    if (!titel && mandant) titel = gegner ? `${mandant} ./. ${gegner}` : mandant;
    if (!titel && quellAz) titel = `Akte ${quellAz}`;
    const sgRoh = get(row, "sachgebiet");
    const sgTreffer = sachgebietAus(sgRoh, titel);
    const sg = sgTreffer.sg;
    const fristTitel = get(row, "fristTitel");
    const fristTyp = fristTypAus(fristTitel, sg);
    const fristDatum = parseDatum(get(row, "fristDatum"));
    const z: MigZeile = {
      nr: i + 2,
      quellAz,
      titel,
      mandant,
      gegner,
      sachgebiet: sg,
      sachgebietRoh: sgRoh,
      gegenstandswert: parseBetrag(get(row, "gegenstandswert")),
      angelegt: parseDatum(get(row, "angelegt")),
      fristDatum,
      fristTitel,
      fristTyp,
      fristWarnung: fristDatum ? fristPruefung(fristDatum, fristTyp, land, heute) : undefined,
      sachgebietErkannt: sgTreffer.erkannt && !sgTreffer.hinweis,
      sachgebietHinweis: sgTreffer.hinweis,
      roh: csv.kopf.map((h, k) => [h, row[k] ?? ""] as [string, string]),
    };
    if (!titel && !quellAz) z.fehler = "Weder Aktenzeichen noch Bezeichnung – Zeile wird übersprungen.";
    const fristRoh = get(row, "fristDatum");
    if (fristRoh && !z.fristDatum) z.hinweis = `Fristdatum „${fristRoh}“ nicht lesbar – Frist bitte manuell eintragen.`;
    const azTreffer = quellAz ? nachAz.get(quellAz.toLowerCase()) : undefined;
    const titelTreffer = titel ? nachTitel.get(normName(titel)) : undefined;
    const treffer = azTreffer ?? titelTreffer;
    if (treffer) {
      z.dublette = {
        akteId: treffer.id,
        az: treffer.aktenzeichen,
        titel: treffer.titel,
        grund: azTreffer && titelTreffer && azTreffer.id === titelTreffer.id ? "Aktenzeichen und Bezeichnung" : azTreffer ? "Aktenzeichen" : "Bezeichnung",
      };
    }
    return z;
  });
}

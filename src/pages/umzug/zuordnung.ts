// Spaltenzuordnung Altsystem → AnwaltApex: Synonym-Erkennung, Werte-Umwandlung und Dublettenprüfung.
import type { Akte, ISODate, Sachgebiet } from "@/core/types";
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

const SG_REGELN: [RegExp, Sachgebiet][] = [
  [/arbeit|kschg|kuendigungsschutz/, "Arbeitsrecht"],
  [/miet|wohn|pacht|weg/, "Mietrecht"],
  [/verkehr|unfall|bussgeld|kfz/, "Verkehrsrecht"],
  [/famil|scheid|unterhalt|sorgerecht|umgang/, "Familienrecht"],
  [/erb|nachlass|testament|pflichtteil/, "Erbrecht"],
  [/straf|owi/, "Strafrecht"],
  [/forder|inkasso|mahn|beitreib|vollstreck/, "Forderungseinzug"],
  [/bau|architekt|vob/, "Baurecht"],
  [/verwalt|beamt|sozial|auslaend|asyl/, "Verwaltungsrecht"],
  [/vertrag|kauf|zivil|handel|gesellsch|allgemein/, "Vertragsrecht"],
];

export function sachgebietAus(text: string): { sg: Sachgebiet; erkannt: boolean } {
  const n = normKopf(text);
  for (const [re, sg] of SG_REGELN) if (re.test(n)) return { sg, erkannt: true };
  return { sg: "Vertragsrecht", erkannt: false };
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
  roh: [string, string][];
  dublette?: { akteId: string; az: string; titel: string; grund: "Aktenzeichen" | "Bezeichnung" | "Aktenzeichen und Bezeichnung" };
  fehler?: string; // Zeile wird nicht übernommen
  hinweis?: string; // Zeile wird übernommen, Teilwert fehlt
}

/** Wendet die Zuordnung auf alle Zeilen an und prüft Dubletten gegen den vorhandenen Aktenbestand. */
export function baueZeilen(csv: CsvErgebnis, zuordnung: (ZielFeld | null)[], akten: Akte[]): MigZeile[] {
  const idx = (f: ZielFeld) => zuordnung.indexOf(f);
  const get = (row: string[], f: ZielFeld) => {
    const i = idx(f);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };
  const nachAz = new Map(akten.map((a) => [a.aktenzeichen.trim().toLowerCase(), a]));
  const nachTitel = new Map(akten.map((a) => [normName(a.titel), a]));
  return csv.zeilen.map((row, i) => {
    const quellAz = get(row, "aktenzeichen");
    const mandant = get(row, "mandant");
    const gegner = get(row, "gegner");
    let titel = get(row, "titel");
    if (!titel && mandant) titel = gegner ? `${mandant} ./. ${gegner}` : mandant;
    if (!titel && quellAz) titel = `Akte ${quellAz}`;
    const sgRoh = get(row, "sachgebiet");
    const { sg } = sachgebietAus(sgRoh || titel);
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
      fristDatum: parseDatum(get(row, "fristDatum")),
      fristTitel: get(row, "fristTitel"),
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

// Gesetzliche Feiertage in Deutschland je Bundesland (Grundlage für § 222 Abs. 2 ZPO, § 43 Abs. 2 StPO, § 193 BGB).
import { addDays, toISO } from "./dates";
import type { Bundesland, ISODate } from "./types";

export interface Feiertag {
  datum: ISODate;
  name: string;
  /** true = nur in Teilen des Landes (z. B. Mariä Himmelfahrt in Bayern). AnwaltApex verlängert hier vorsorglich NICHT
   *  (rechtlich verlängert der Feiertag die Frist, wenn er am Ort des Gerichts gilt – der frühere Termin ist die sichere Seite). */
  teilweise?: boolean;
}

export const BUNDESLAENDER: { code: Bundesland; name: string }[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

export function bundeslandName(code: Bundesland): string {
  return BUNDESLAENDER.find((b) => b.code === code)?.name ?? code;
}

/** Ostersonntag nach dem Gauß'schen Algorithmus (Meeus/Jones/Butcher). */
export function ostersonntag(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(Date.UTC(year, month - 1, day)));
}

function iso(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Buß- und Bettag: Mittwoch vor dem 23. November. */
function bussUndBettag(year: number): ISODate {
  const nov23 = new Date(Date.UTC(year, 10, 23));
  const wd = nov23.getUTCDay(); // 0 So … 3 Mi
  const diff = ((wd - 3 + 7) % 7) || 7;
  return toISO(new Date(Date.UTC(year, 10, 23 - diff)));
}

const cache = new Map<string, Feiertag[]>();

export function feiertage(year: number, land: Bundesland): Feiertag[] {
  const key = `${year}-${land}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ostern = ostersonntag(year);
  const list: Feiertag[] = [
    { datum: iso(year, 1, 1), name: "Neujahr" },
    { datum: addDays(ostern, -2), name: "Karfreitag" },
    { datum: addDays(ostern, 1), name: "Ostermontag" },
    { datum: iso(year, 5, 1), name: "Tag der Arbeit" },
    { datum: addDays(ostern, 39), name: "Christi Himmelfahrt" },
    { datum: addDays(ostern, 50), name: "Pfingstmontag" },
    { datum: iso(year, 10, 3), name: "Tag der Deutschen Einheit" },
    { datum: iso(year, 12, 25), name: "1. Weihnachtstag" },
    { datum: iso(year, 12, 26), name: "2. Weihnachtstag" },
  ];
  const add = (lands: Bundesland[], f: Feiertag) => {
    if (lands.includes(land)) list.push(f);
  };

  add(["BW", "BY", "ST"], { datum: iso(year, 1, 6), name: "Heilige Drei Könige" });
  if (year >= 2019) add(["BE"], { datum: iso(year, 3, 8), name: "Internationaler Frauentag" });
  if (year >= 2023) add(["MV"], { datum: iso(year, 3, 8), name: "Internationaler Frauentag" });
  add(["BB"], { datum: ostern, name: "Ostersonntag" });
  add(["BB"], { datum: addDays(ostern, 49), name: "Pfingstsonntag" });
  add(["BW", "BY", "HE", "NW", "RP", "SL"], { datum: addDays(ostern, 60), name: "Fronleichnam" });
  add(["SN", "TH"], { datum: addDays(ostern, 60), name: "Fronleichnam (regional)", teilweise: true });
  add(["SL"], { datum: iso(year, 8, 15), name: "Mariä Himmelfahrt" });
  add(["BY"], { datum: iso(year, 8, 15), name: "Mariä Himmelfahrt (regional)", teilweise: true });
  add(["BY"], { datum: iso(year, 8, 8), name: "Augsburger Hohes Friedensfest (nur Augsburg)", teilweise: true });
  if (year >= 2019) add(["TH"], { datum: iso(year, 9, 20), name: "Weltkindertag" });
  add(["BB", "MV", "SN", "ST", "TH"], { datum: iso(year, 10, 31), name: "Reformationstag" });
  if (year >= 2018) add(["HB", "HH", "NI", "SH"], { datum: iso(year, 10, 31), name: "Reformationstag" });
  add(["BW", "BY", "NW", "RP", "SL"], { datum: iso(year, 11, 1), name: "Allerheiligen" });
  add(["SN"], { datum: bussUndBettag(year), name: "Buß- und Bettag" });
  if (year === 2020 || year === 2025) add(["BE"], { datum: iso(year, 5, 8), name: "Tag der Befreiung (einmalig)" });
  if (year === 2017) list.push({ datum: iso(2017, 10, 31), name: "Reformationstag (500 Jahre, bundesweit)" });

  list.sort((a, b) => a.datum.localeCompare(b.datum));
  cache.set(key, list);
  return list;
}

export function feiertagAm(datum: ISODate, land: Bundesland): Feiertag | undefined {
  const year = Number(datum.slice(0, 4));
  return feiertage(year, land).find((f) => f.datum === datum);
}

// ───────────── Gerichtsort → Bundesland ─────────────
// Maßgeblich für die Verschiebung nach § 222 Abs. 2 ZPO / § 43 Abs. 2 StPO sind die Feiertage am Ort, an dem die
// Handlung vorzunehmen ist – in der Regel am Sitz des Gerichts bzw. der Behörde, nicht am Kanzleisitz.

/** Gerichts- und Behördensitze (Auswahl). Unbekannte Orte → kein Treffer; dann gilt das Bundesland der Kanzlei. */
const ORTE: Record<string, Bundesland> = {};
const orte = (land: Bundesland, liste: string) => liste.split(",").forEach((o) => (ORTE[o.trim().toLowerCase()] = land));
orte("BW", "Stuttgart, Karlsruhe, Mannheim, Freiburg, Heidelberg, Heilbronn, Ulm, Pforzheim, Reutlingen, Tübingen, Konstanz, Ravensburg, Rottweil, Baden-Baden, Ellwangen, Hechingen, Mosbach, Offenburg, Waldshut-Tiengen, Ludwigsburg, Esslingen, Böblingen, Göppingen, Aalen");
orte("BY", "München, Nürnberg, Augsburg, Regensburg, Würzburg, Bamberg, Bayreuth, Coburg, Ingolstadt, Landshut, Passau, Kempten, Memmingen, Erlangen, Fürth, Ansbach, Aschaffenburg, Schweinfurt, Hof, Amberg, Weiden, Deggendorf, Traunstein, Rosenheim, Straubing, Viechtach");
orte("BE", "Berlin, Charlottenburg, Mitte, Wedding, Tiergarten, Schöneberg, Spandau, Köpenick, Lichtenberg, Pankow, Neukölln, Tempelhof-Kreuzberg, Kreuzberg, Tempelhof, Hohenschönhausen");
orte("BB", "Potsdam, Cottbus, Neuruppin, Eberswalde, Oranienburg, Luckenwalde, Brandenburg");
orte("HB", "Bremen, Bremerhaven");
orte("HH", "Hamburg");
orte("HE", "Frankfurt, Wiesbaden, Darmstadt, Kassel, Gießen, Marburg, Fulda, Hanau, Offenbach, Limburg");
orte("MV", "Schwerin, Rostock, Stralsund, Neubrandenburg, Greifswald");
orte("NI", "Hannover, Braunschweig, Oldenburg, Osnabrück, Göttingen, Hildesheim, Lüneburg, Stade, Verden, Aurich, Bückeburg, Celle, Wolfsburg, Salzgitter");
orte("NW", "Köln, Düsseldorf, Dortmund, Essen, Duisburg, Bochum, Wuppertal, Bielefeld, Bonn, Münster, Aachen, Hagen, Arnsberg, Detmold, Paderborn, Siegen, Krefeld, Mönchengladbach, Kleve, Gelsenkirchen, Oberhausen, Hamm, Recklinghausen, Gütersloh, Leverkusen, Solingen");
orte("RP", "Mainz, Koblenz, Trier, Kaiserslautern, Ludwigshafen, Landau, Frankenthal, Bad Kreuznach, Zweibrücken");
orte("SL", "Saarbrücken, Saarlouis, Neunkirchen, Homburg");
orte("SN", "Dresden, Leipzig, Chemnitz, Zwickau, Görlitz, Bautzen, Plauen");
orte("ST", "Magdeburg, Halle, Dessau-Roßlau, Dessau, Stendal, Naumburg");
orte("SH", "Kiel, Lübeck, Flensburg, Itzehoe, Schleswig, Neumünster");
orte("TH", "Erfurt, Jena, Gera, Weimar, Meiningen, Mühlhausen, Suhl, Nordhausen, Gotha, Eisenach");
// Landesnamen als Gerichtsbezeichnung („LAG Hessen“, „LAG Berlin-Brandenburg“, „LSG Niedersachsen-Bremen“, „OVG Nordrhein-Westfalen“)
orte("BW", "Baden-Württemberg"); orte("BY", "Bayern"); orte("HE", "Hessen"); orte("MV", "Mecklenburg-Vorpommern");
orte("NI", "Niedersachsen"); orte("NW", "Nordrhein-Westfalen, NRW"); orte("RP", "Rheinland-Pfalz"); orte("SL", "Saarland");
orte("SN", "Sachsen"); orte("ST", "Sachsen-Anhalt"); orte("SH", "Schleswig-Holstein"); orte("TH", "Thüringen");

/** Gerichte und Behörden ohne Ortsnamen bzw. mit Landesbezeichnung. */
const NAMEN: [RegExp, Bundesland][] = [
  [/\bKammergerichts?\b/g, "BE"],
  [/\bBundesgerichtshofs?\b|\bBundesverfassungsgerichts?\b/g, "BW"],
  [/\bBundesarbeitsgerichts?\b/g, "TH"],
  [/\bBundesverwaltungsgerichts?\b/g, "SN"],
  [/\bBundessozialgerichts?\b/g, "HE"],
  [/\bBundesfinanzhofs?\b|\bBayerische[snmr]? (?:Polizeiverwaltungsamt|Obersten? Landesgericht|Verwaltungsgerichtshof|Landessozialgericht)/g, "BY"],
  [/\bHessische[snmr]? (?:Verwaltungsgerichtshof|VGH|Landessozialgericht|LSG|Finanzgericht|Landesarbeitsgericht|LAG)\b/g, "HE"],
  [/\bNiedersächsische[snmr]? (?:Oberverwaltungsgericht|OVG|Finanzgericht|Landesarbeitsgericht|LAG)\b/g, "NI"],
  [/\bHanseatische[snmr]? (?:Oberlandesgericht|OLG) (?:in )?Bremen|\bFreie Hansestadt Bremen/g, "HB"],
  [/\bHanseatische[snmr]? (?:Oberlandesgericht|OLG)|\bFreie und Hansestadt Hamburg/g, "HH"],
  [/\bSchleswig-Holsteinische[snmr]? (?:Oberlandesgericht|OLG|Landessozialgericht|LSG|Finanzgericht|Landesarbeitsgericht|LAG|Oberverwaltungsgericht|OVG)\b/g, "SH"],
  [/\bBrandenburgische[snmr]? (?:Oberlandesgericht|OLG)/g, "BB"],
  [/\bThüringer (?:Oberlandesgericht|OLG|Landessozialgericht|LSG|Oberverwaltungsgericht|OVG|Finanzgericht|Landesarbeitsgericht|LAG)\b/g, "TH"],
  [/\bSaarländische[snmr]? (?:Oberlandesgericht|OLG)/g, "SL"],
  [/\bPfälzische[snmr]? (?:Oberlandesgericht|OLG)/g, "RP"],
  [/\bSächsische[snmr]? (?:Oberverwaltungsgericht|OVG|Landesarbeitsgericht|LAG|Landessozialgericht|LSG|Finanzgericht)\b/g, "SN"],
];

const GERICHT_RE =
  /\b(?:(?:Amts|Land|Oberlandes|Arbeits|Landesarbeits|Verwaltungs|Oberverwaltungs|Sozial|Landessozial|Finanz|Familien|Mahn)gerichts?|(?:General)?[Ss]taatsanwaltschaft|Polizei(?:präsidium)?|Bußgeldstelle|LG|OLG|ArbG|LAG|VG|OVG|LSG)\s+((?:Bad\s)?[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)(?:\s+I{1,3}\b)?(\s*(?:\(Oder\)|\/Oder|an der Oder|a(?:n der|\.\s?d\.)\s?Havel))?/g;

/** Bundesland zu einem Ortsnamen (z. B. „Hamburg-Altona“ → HH), sonst undefined. */
export function bundeslandAusOrt(ort: string): Bundesland | undefined {
  const o = ort.trim().toLowerCase();
  if (/^frankfurt\s*(\(oder\)|\/\s*oder|an der oder)/.test(o)) return "BB";
  return ORTE[o] ?? ORTE[o.split(/[-\s]/)[0]];
}

/**
 * Erkennt das Gericht bzw. die Behörde in einem Text und liefert dessen Bundesland – Grundlage für die Feiertage
 * am Ort der Handlung (§ 222 Abs. 2 ZPO). Registerangaben („Amtsgericht München HRB …“) zählen nicht.
 */
export function bundeslandAusGericht(text: string): { land: Bundesland; gericht: string } | undefined {
  const treffer: { land: Bundesland; gericht: string; index: number }[] = [];
  for (const m of text.matchAll(GERICHT_RE)) {
    const i = m.index ?? 0;
    const nach = text.slice(i + m[0].length, i + m[0].length + 14);
    const vor = text.slice(Math.max(0, i - 30), i);
    if (/^\s*,?\s*(HRB|HRA|VR|GnR|PR)\b/.test(nach) || /register/i.test(vor)) continue;
    const land = m[2] && /oder/i.test(m[2]) ? "BB" : bundeslandAusOrt(m[1]);
    if (land) treffer.push({ land, gericht: m[0].trim(), index: i });
  }
  for (const [re, land] of NAMEN) for (const m of text.matchAll(re)) treffer.push({ land, gericht: m[0].trim(), index: m.index ?? 0 });
  const erster = treffer.sort((a, b) => a.index - b.index)[0];
  return erster && { land: erster.land, gericht: erster.gericht };
}

/** Ist der Tag ein Werktag im Sinne des § 222 Abs. 2 ZPO (kein Samstag, Sonntag, allgemeiner Feiertag)? */
export function istWerktag(datum: ISODate, land: Bundesland): boolean {
  const wd = new Date(datum + "T00:00:00Z").getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const f = feiertagAm(datum, land);
  return !f || !!f.teilweise;
}

/** Erster Arbeitstag NACH `datum` (Mo–Fr, kein landesweiter Feiertag in `land`) – z. B. für „nächster Arbeitstag“ in der Ausgangskontrolle. */
export function naechsterArbeitstag(datum: ISODate, land: Bundesland): ISODate {
  let tag = datum.slice(0, 10);
  for (let i = 0; i < 30; i++) {
    tag = addDays(tag, 1);
    if (istWerktag(tag, land)) return tag;
  }
  return tag;
}

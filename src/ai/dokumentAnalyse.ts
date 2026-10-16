// Dokument- & Posteingangs-Analyse: Die KI erkennt Akte, Ereignis und Fristart – berechnet wird ausschließlich mit dem Fristenrechner.
import { berechneFestesEnde, berechneFrist, berechneNachRegel, FRIST_REGELN, gerichtsortDerAkte, type Einheit } from "@/core/fristen";
import { bundeslandAusGericht, bundeslandAusOrt } from "@/core/feiertage";
import { fmtDate, today, addDays, addMonthsBGB, wochentagName } from "@/core/dates";
import { normalize } from "@/core/search";
import type { Bundesland, FristTyp, ISODate, Kontakt, KiVorschlag, Nachricht, TenantData, DokumentArt } from "@/core/types";
import { mandantBezeichnung } from "@/lib/rollen";
import { DemoModus, llmJson, aktuelleQuelle } from "./llm";
import type { KiQuelle } from "./status";

export interface FristVorschlag {
  regelKey: string;
  titel: string;
  typ: FristTyp;
  ereignisDatum: ISODate;
  ende: ISODate;
  vorfrist: ISODate;
  grundlage: string;
  rechenweg: string[];
  warnungen: string[];
}

/** Vertragliche Ausschluss- bzw. Verfallklausel (z. B. „Ausschlussfrist: drei Monate ab Fälligkeit“). */
export interface Ausschlussklausel {
  dauer: number;
  einheit: "tage" | "wochen" | "monate";
  /** fristauslösendes Ereignis laut Klausel, z. B. „Fälligkeit“ */
  beginn: string;
  /** Wortlaut der Klausel (gekürzt) */
  zitat: string;
  /** Vertragsparagraph, falls im Text genannt („§ 12“) */
  fundstelle?: string;
  /** Art des Dokuments, z. B. „Arbeitsvertrag“ */
  quelle: string;
  /** Zweite Stufe: gerichtliche Geltendmachung nach Ablehnung bzw. Schweigen der Gegenseite */
  zweiteStufe?: { dauer: number; einheit: "tage" | "wochen" | "monate"; beginn: string; zitat: string };
}

/** Rechtsmittelgericht bei Urteilen, z. B. „Berufung einzulegen beim Kammergericht, § 519 Abs. 1 ZPO“. */
export interface Rechtsmittelhinweis {
  art: "Berufung" | "Revision";
  gericht: string;
  norm: string;
  /** Satz für die Oberfläche */
  text: string;
  /** Gericht steht in der Rechtsbehelfsbelehrung (sonst aus dem Instanzenzug abgeleitet) */
  ausBelehrung: boolean;
}

export interface DokAnalyse {
  typ: string;
  dokumentArt: DokumentArt;
  zusammenfassung: string;
  /** Erkannte vertragliche Ausschlussfrist – das Fristende berechnet der Fristenrechner erst mit der Fälligkeit. */
  ausschlussfrist?: Ausschlussklausel;
  /** Rechtsmittelgericht bei Urteilen */
  rechtsmittel?: Rechtsmittelhinweis;
  akteId?: string;
  akteSicherheit: number;
  akteGrund?: string;
  fristen: FristVorschlag[];
  termin?: { datum: ISODate; uhrzeit?: string; ort?: string; titel: string };
  aktionen: string[];
  eeb: boolean;
  quelle: KiQuelle;
  dauerMs: number;
}

const ZAHLWORT: Record<string, number> = { eine: 1, einer: 1, einem: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, vierzehn: 14, einundzwanzig: 21 };
const MONATE: Record<string, number> = { januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };

function zahl(s: string): number | undefined {
  const t = s.toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return ZAHLWORT[t];
}

function parseDatum(s: string): ISODate | undefined {
  const m = s.match(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  }
  const m2 = s.match(/(\d{1,2})\.\s?(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})/i);
  if (m2) return `${m2[3]}-${String(MONATE[m2[2].toLowerCase()]).padStart(2, "0")}-${String(m2[1]).padStart(2, "0")}`;
  return undefined;
}

/** E-Mail-Adresse vereinheitlichen („Thomas Weber <Thomas.Weber@posteo.de>“ → „thomas.weber@posteo.de“). */
function adresse(s?: string): string | undefined {
  const m = s?.match(/[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[a-z]{2,}/i)?.[0];
  return m?.toLowerCase();
}

/**
 * Findet die passende Akte über Gerichtsaktenzeichen, eigenes Aktenzeichen, Absenderadresse oder Parteinamen.
 * Die Absenderadresse ist ein starkes Signal: Stimmt sie exakt mit der gespeicherten E-Mail des Mandanten (bzw. des
 * Gegneranwalts) überein und gibt es dazu genau eine offene Akte, ist die Zuordnung sicher.
 */
export function findeAkte(text: string, data: TenantData, hinweise: string[] = [], absender?: string): { akteId?: string; sicherheit: number; grund?: string } {
  const norm = normalize(text + " " + hinweise.join(" ")).replace(/\s+/g, " ");
  for (const a of data.akten) {
    if (a.gerichtsAz && norm.includes(normalize(a.gerichtsAz).replace(/\s+/g, " "))) return { akteId: a.id, sicherheit: 0.99, grund: `Gerichtsaktenzeichen ${a.gerichtsAz}` };
  }
  for (const a of data.akten) {
    const re = new RegExp(`(^|[^0-9])${a.aktenzeichen.replace("/", "\\/")}([^0-9]|$)`);
    if (re.test(norm)) return { akteId: a.id, sicherheit: 0.97, grund: `Aktenzeichen ${a.aktenzeichen}` };
  }
  const offen = data.akten.filter((x) => x.status !== "abgeschlossen");
  const von = adresse(absender);
  const kontaktMitAdresse = von ? data.kontakte.filter((k) => adresse(k.email) === von) : [];
  const aktenDes = (rolle: "mandantId" | "gegneranwaltId" | "gegnerId", kontaktId: string) => offen.filter((a) => a[rolle] === kontaktId);
  let best: { akteId?: string; sicherheit: number; grund?: string } = { sicherheit: 0 };
  for (const a of offen) {
    const mandant = data.kontakte.find((k) => k.id === a.mandantId);
    const gegner = data.kontakte.find((k) => k.id === a.gegnerId);
    let s = 0;
    const gruende: string[] = [];
    const vomMandanten = !!mandant && kontaktMitAdresse.some((k) => k.id === mandant.id);
    const gegenseite = (["gegneranwaltId", "gegnerId"] as const).find((r) => !!a[r] && kontaktMitAdresse.some((k) => k.id === a[r]));
    if (vomMandanten) {
      // eindeutig, wenn der Mandant nur diese eine offene Akte hat – sonst entscheiden die übrigen Merkmale mit
      const eindeutig = aktenDes("mandantId", mandant.id).length === 1;
      s += eindeutig ? 0.95 : 0.55;
      gruende.push(`Absenderadresse ${von} (${mandantBezeichnung(mandant)} ${mandant.name})`);
    } else if (gegenseite) {
      const eindeutig = aktenDes(gegenseite, a[gegenseite]!).length === 1;
      s += eindeutig ? 0.9 : 0.35;
      const name = data.kontakte.find((k) => k.id === a[gegenseite])?.name;
      gruende.push(`Absenderadresse ${von}${name ? ` (${gegenseite === "gegnerId" ? "Gegner" : "Gegenseite"} ${name})` : ""}`);
    }
    if (mandant && norm.includes(normalize(mandant.name))) {
      s += vomMandanten ? 0.03 : 0.62;
      if (!vomMandanten) gruende.push(`${mandantBezeichnung(mandant)} ${mandant.name}`);
    } else if (mandant?.nachname && new RegExp(`\\b${normalize(mandant.nachname)}\\b`).test(norm)) {
      s += vomMandanten ? 0.02 : 0.38;
      if (!vomMandanten) gruende.push(`Name ${mandant.nachname}`);
    }
    if (gegner && norm.includes(normalize(gegner.name))) {
      s += 0.33;
      if (!gruende.some((g) => g.includes(`(Gegner ${gegner.name})`))) gruende.push(`Gegner ${gegner.name}`);
    }
    const obergrenze = vomMandanten || gegenseite ? 0.98 : 0.96;
    if (s > best.sicherheit) best = { akteId: a.id, sicherheit: Math.min(obergrenze, s + 0.02), grund: gruende.join(" · ") };
  }
  // Nur Nachname allein reicht nicht für eine automatische Zuordnung (zu unsicher).
  return best.sicherheit >= 0.5 ? best : { sicherheit: 0 };
}

function klassifiziere(t: string): { typ: string; art: DokumentArt } {
  const n = t.toLowerCase();
  if (/versäumnisurteil/.test(n)) return { typ: "Versäumnisurteil", art: "urteil" };
  if (/\burteil\b|urteil vom/.test(n) && /zugestellt|zustellung|verurteilt|abgewiesen/.test(n)) return { typ: "Urteil", art: "urteil" };
  // Verträge vor den Stichwortregeln prüfen („Kündigungsfristen“, „vergleichbar“ …)
  if (/^\s*(?:\S+\s+){0,3}arbeitsvertrag\b/.test(n) || /arbeitsvertrag zwischen|anstellungsvertrag zwischen/.test(n)) return { typ: "Arbeitsvertrag", art: "vertrag" };
  if (/^\s*[a-zäöüß-]*vertrag\b[^.\n]{0,80}\bzwischen\b/.test(n)) return { typ: "Vertrag", art: "vertrag" };
  if (/strafbefehl/.test(n)) return { typ: "Strafbefehl", art: "beschluss" };
  if (/bußgeldbescheid/.test(n)) return { typ: "Bußgeldbescheid", art: "bea" };
  if (/widerspruch gegen (den )?mahnbescheid|widerspruch erhoben/.test(n)) return { typ: "Mitteilung Mahngericht (Widerspruch)", art: "beschluss" };
  if (/vollstreckungsbescheid/.test(n)) return { typ: "Vollstreckungsbescheid", art: "beschluss" };
  if (/mahnbescheid/.test(n)) return { typ: "Mahnbescheid", art: "beschluss" };
  if (/vermögensauskunft|gerichtsvollzieher/.test(n)) return { typ: "Mitteilung Gerichtsvollzieher", art: "brief" };
  if (/verkündungstermin|termin zur verkündung/.test(n)) return { typ: "Terminsmitteilung (Verkündung)", art: "beschluss" };
  if (/ladung|termin[^.]{0,80}(bestimmt|anberaumt)|bestimmt auf|anberaumt auf|güteverhandlung|kammertermin|hauptverhandlung/.test(n)) return { typ: "Ladung / Terminbestimmung", art: "beschluss" };
  if (/bericht/.test(n) && /stellungnahme|stellung/.test(n)) return { typ: "Gerichtliche Mitteilung mit Stellungnahmefrist", art: "beschluss" };
  if (/verfügung|aufgegeben|stellung zu nehmen/.test(n)) return { typ: "Gerichtliche Verfügung", art: "beschluss" };
  if (/beschluss/.test(n)) return { typ: "Beschluss", art: "beschluss" };
  if (/klageerwiderung|beantragt klageabweisung/.test(n)) return { typ: "Klageerwiderung", art: "schriftsatz" };
  if (/vergleich/.test(n)) return { typ: "Vergleichsvorschlag", art: "brief" };
  if (/kündig/.test(n) && /arbeitsverhältnis/.test(n)) return { typ: "Kündigung (Arbeitsverhältnis)", art: "brief" };
  if (/kündig/.test(n) && /eigenbedarf|mietverhältnis|wohnung/.test(n)) return { typ: "Mandatsanfrage (Mietrecht)", art: "email" };
  if (/newsletter|kammerreport|abmelden/.test(n)) return { typ: "Newsletter", art: "email" };
  if (/rechnung/.test(n) && /zahlbar|betrag/.test(n)) return { typ: "Rechnung", art: "rechnung" };
  if (/anbei|unterlagen|lohnabrechnung/.test(n)) return { typ: "Mandantenkorrespondenz", art: "email" };
  if (/anfrage|können sie mir helfen|mandat/.test(n)) return { typ: "Mandatsanfrage", art: "email" };
  return { typ: "Schreiben", art: "brief" };
}

const GEWICHTE: [RegExp, number][] = [
  [/verurteilt|abgewiesen|stattgegeben|aufgehoben|zurückgewiesen/, 3],
  [/widerspruch erhoben|vermögensauskunft|vergleich|vorschlag|kündig|eigenbedarf|fristlos/, 2.5],
  [/aufgegeben|stellung zu nehmen|binnen|frist|termin|ladung|bestimmt/, 1.5],
  [/kollege|kollegin|zeugin|schichtleiter|vorgesetzte/, 1.2],
  [/zeuge|bestätigen|gesehen|ablehn|lehnen|zahlung|zahlen|kosten|rechtsschutz|herzkrank|jahre alt/, 1],
  [/zugestellt|zustellung|übersandt|anbei/, 0.6],
];
const ABKUERZUNGEN = ["./.", "Az.", "Abs.", "Nr.", "z. B.", "ggf.", "bzw.", "Dr.", "Str.", "Prof.", "u. a.", "i. A.", "Ziff.", "S.", "Art."];

/** Extraktive Zusammenfassung: die aussagekräftigsten Sätze (ohne Anrede, Grußformel und Belehrungen). */
function zusammenfassen(text: string, max = 2): string {
  let t = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(sehr geehrte|mit freundlichen|viele grüße|beste grüße|herzliche grüße|guten (morgen|tag)|hallo|liebe[rs]?\s|ihr schadenservice|rechtsbehelfsbelehrung)/i.test(l))
    .filter((l) => /[.!?:]$/.test(l) || (l.length > 38 && !l.includes("./.")))
    .join(" ");
  ABKUERZUNGEN.forEach((a, i) => (t = t.split(a).join(`§AB${i}§`)));
  const saetze = t
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/)
    .map((x) => x.trim())
    .filter((x) => x.length > 25 && !/ist die berufung zulässig|ist binnen einer|rechtsbehelfsbelehrung|bitte senden sie|werden gebeten/i.test(x));
  const scored = saetze.map((x, i) => ({ x, i, score: GEWICHTE.reduce((acc, [re, w]) => acc + (re.test(x.toLowerCase()) ? w : 0), 0) + (i === 0 ? 0.4 : 0) }));
  const top = scored.sort((a, b) => b.score - a.score).slice(0, max).sort((a, b) => a.i - b.i);
  let out = top.map((o) => (o.x.length > 260 ? o.x.slice(0, 257) + "…" : o.x)).join(" ");
  ABKUERZUNGEN.forEach((a, i) => (out = out.split(`§AB${i}§`).join(a)));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Dokumente, die Mandantinnen und Mandanten typischerweise schicken – für „übersendet Arbeitsvertrag und Lohnabrechnungen“. */
const UNTERLAGEN: [RegExp, string][] = [
  [/\barbeitsvertrag/, "Arbeitsvertrag"], [/\b(lohn|gehalts)abrechnung/, "Lohnabrechnungen"], [/\bkündigung(sschreiben)?\b/, "Kündigungsschreiben"],
  [/\bmietvertrag/, "Mietvertrag"], [/\bübergabeprotokoll/, "Übergabeprotokoll"], [/\b(fotos?|bilder)\b/, "Fotos"], [/\bgutachten/, "Gutachten"],
  [/\brechnung(en)?\b/, "Rechnungen"], [/\bkontoauszüge?/, "Kontoauszüge"], [/\bbescheid\b/, "Bescheid"], [/\bvertrag\b/, "Vertrag"],
  [/\b(verzeichnis|liste)\b/, "Verzeichnis"], [/\bvollmacht\b/, "Vollmacht"],
];

/** „Muss ich wegen der Arbeitsagentur noch etwas machen?“ → „ob er wegen der Arbeitsagentur noch etwas machen muss“ */
function indirekteFrage(frage: string, w: boolean): string | undefined {
  const er = w ? "sie" : "er";
  const pron = (t: string) =>
    t.replace(/\bmich\b/g, "sich").replace(/\bmir\b/g, "sich").replace(/\bmein(e|en|em|er|es)?\b/g, (_, e = "") => `${w ? "ihr" : "sein"}${e}`).replace(/\bich\b/g, er);
  const modal = frage.match(/^(Muss|Soll|Sollte|Kann|Darf|Müsste|Brauche) ich (.+?)\s*\?$/);
  if (modal) {
    const verb = { Muss: "muss", Soll: "soll", Sollte: "sollte", Kann: "kann", Darf: "darf", Müsste: "müsste", Brauche: "braucht" }[modal[1]] ?? modal[1].toLowerCase();
    return `ob ${er} ${pron(modal[2])} ${verb}`;
  }
  const gibt = frage.match(/^Gibt es (.+?)\s*\?$/);
  if (gibt) return `ob es ${pron(gibt[1])} gibt`;
  const wq = frage.match(/^(Wie|Wann|Was|Wo|Warum|Welche[nrsm]?) (muss|soll|kann|darf) ich (.+?)\s*\?$/);
  if (wq) return `${wq[1].toLowerCase()} ${er} ${pron(wq[3])} ${wq[2]}`;
  return undefined;
}

/**
 * Zusammenfassung in der dritten Person für Post von Mandantinnen und Mandanten: Wer schreibt, was liegt bei, welche Hinweise
 * und Fragen enthält die Nachricht – statt eines Ich-Zitats aus der E-Mail.
 */
function mandantenZusammenfassung(text: string, absender: { name: string; kontakt?: Kontakt; bezeichnung?: string }): string | undefined {
  // „sie“ für Mandantinnen und für Unternehmen (die Gesellschaft), sonst „er“
  const w = absender.kontakt?.anrede === "Frau" || absender.kontakt?.typ === "organisation";
  const person = absender.kontakt?.typ !== "organisation";
  const n = text.toLowerCase();
  const teile: string[] = [];
  if (/erkundigen|neuigkeiten|sachstand|stand (der|meiner|unserer) sache/.test(n)) teile.push("erkundigt sich nach dem Stand der Sache");
  if (/anbei|im anhang|anhängend|übersende|schicke ich|sende ich/.test(n)) {
    const docs = [...new Set(UNTERLAGEN.filter(([re]) => re.test(n)).map(([, label]) => label))].filter((x, _, a) => !(x === "Vertrag" && a.some((y) => y !== "Vertrag" && /vertrag/i.test(y))));
    teile.push(`übersendet ${docs.length ? docs.slice(0, 3).join(docs.length === 2 ? " und " : ", ").replace(/, ([^,]+)$/, " und $1") : "Unterlagen"}`);
  }
  const zeuge = text.match(/\b(Kollege|Kollegin|Nachbar|Nachbarin)\s+(Herr|Frau)\s+([A-ZÄÖÜ][a-zäöüß]+)/);
  if (zeuge && person && /zeug|bestätigen|bezeugen|gesehen/.test(n)) {
    const rolle = { Kollege: "Kollegen", Kollegin: "Kollegin", Nachbar: "Nachbarn", Nachbarin: "Nachbarin" }[zeuge[1]] ?? zeuge[1];
    const poss = w ? (zeuge[1].endsWith("in") ? "ihre" : "ihren") : zeuge[1].endsWith("in") ? "seine" : "seinen";
    teile.push(`nennt ${poss} ${rolle} ${zeuge[2] === "Herr" ? "Herrn" : "Frau"} ${zeuge[3]} als möglichen Zeugen`);
  }
  const fragen = (text.match(/[^.!?\n]+\?/g) ?? []).map((f) => f.trim()).map((f) => indirekteFrage(f, w)).filter((x): x is string => !!x);
  if (!teile.length && !fragen.length) return undefined;
  const wer = absender.bezeichnung ? `${absender.bezeichnung} ${absender.name}` : absender.name;
  const saetze: string[] = [];
  if (teile.length) saetze.push(`${wer} ${teile.join(" und ")}.`);
  if (fragen.length) saetze.push(`${teile.length ? (w ? "Sie" : "Er") : wer} fragt, ${fragen.slice(0, 2).join(" und ")}.`);
  return saetze.join(" ");
}

/** Sätze eines Textes (Abkürzungen wie „Abs.“, „Nr.“ und „./.“ trennen nicht). */
function saetzeVon(text: string): string[] {
  let t = text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ");
  ABKUERZUNGEN.forEach((a, i) => (t = t.split(a).join(`§AB${i}§`)));
  return t
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„(])/)
    .map((x) => {
      let y = x.trim();
      ABKUERZUNGEN.forEach((a, i) => (y = y.split(`§AB${i}§`).join(a)));
      return y;
    })
    .filter(Boolean);
}

type Partei = "Kläger" | "Beklagte";

/** Kostenquote aus dem Tenor: „tragen der Kläger zu 25 %, die Beklagte zu 75 %“ → { Kläger: 25, Beklagte: 75 }. */
function kostenquote(satz: string): Partial<Record<Partei, number>> | undefined {
  const q: Partial<Record<Partei, number>> = {};
  for (const m of satz.matchAll(/(?:der|die|den)\s+(Kläger(?:in)?|Beklagten?)\s+(?:zu\s+)?(\d{1,3}(?:,\d+)?)\s*%/gi)) {
    q[/^kläger/i.test(m[1]) ? "Kläger" : "Beklagte"] = Number(m[2].replace(",", "."));
  }
  if (q.Kläger !== undefined && q.Beklagte === undefined) q.Beklagte = 100 - q.Kläger;
  if (q.Beklagte !== undefined && q.Kläger === undefined) q.Kläger = 100 - q.Beklagte;
  if (q.Kläger !== undefined) return q;
  // „Die Kosten des Rechtsstreits trägt die Beklagte.“ / „… hat der Kläger zu tragen.“
  const allein = satz.match(/(?:trägt|tragen|hat|haben)\s+(?:die|der)\s+(Kläger(?:in)?|Beklagten?)\b|(?:die|der)\s+(Kläger(?:in)?|Beklagten?)\s+(?:zu tragen|trägt)/i);
  const wer = allein?.[1] ?? allein?.[2];
  if (wer) return /^kläger/i.test(wer) ? { Kläger: 100, Beklagte: 0 } : { Kläger: 0, Beklagte: 100 };
  return undefined;
}

/** Rolle der Mandantschaft im Rechtsstreit: im Rubrum „Kläger ./. Beklagte“, sonst laut Aktenbezeichnung. */
function eigeneRolle(text: string, data: TenantData, akteId: string | undefined): { rolle: Partei; name: string; bezeichnung: string } | undefined {
  const akte = akteId ? data.akten.find((a) => a.id === akteId) : undefined;
  const mandant = akte ? data.kontakte.find((k) => k.id === akte.mandantId) : undefined;
  if (!akte || !mandant) return undefined;
  const merkmal = normalize(mandant.nachname ?? mandant.name);
  const rubrum = text.match(/([^\n]{2,80}?)\s+\.\/\.\s+([^\n]{2,80})/) ?? akte.titel.match(/(.+?)\s+\.\/\.\s+(.+)/);
  if (!rubrum) return undefined;
  const links = normalize(rubrum[1]).includes(merkmal);
  const rechts = normalize(rubrum[2]).includes(merkmal);
  if (links === rechts) return undefined;
  return { rolle: links ? "Kläger" : "Beklagte", name: mandant.name, bezeichnung: mandantBezeichnung(mandant) };
}

/**
 * Tenor eines Urteils vollständig: Hauptsache, Abweisung im Übrigen, Kostenquote, vorläufige Vollstreckbarkeit und das
 * Ergebnis für die eigene Partei („überwiegend erfolgreich“). Fehlt eine Angabe im Schreiben, steht das ausdrücklich da.
 */
function tenorZusammenfassung(text: string, data: TenantData, akteId: string | undefined): string | undefined {
  const saetze = saetzeVon(text);
  const haupt = saetze.find((x) => /\b(?:wird|werden) (?:verurteilt|verpflichtet)\b|\bwird stattgegeben\b|wird festgestellt, dass/i.test(x));
  const abweisung = saetze.find((x) => x !== haupt && /\b(?:klage|berufung|einspruch)\b[^.]{0,40}\b(?:abgewiesen|zurückgewiesen|verworfen)\b/i.test(x));
  if (!haupt && !abweisung) return undefined;
  const kostenSatz = saetze.find((x) => /\bkosten des (?:rechtsstreits|verfahrens|berufungsverfahrens)\b/i.test(x));
  const quote = kostenSatz ? kostenquote(kostenSatz) : undefined;
  const vollstr = saetze.find((x) => /vorläufig vollstreckbar/i.test(x));
  const teile: string[] = [];
  teile.push(`Tenor: ${[haupt, abweisung].filter(Boolean).join(" ")}`);
  if (quote) teile.push(`Kostenquote ${quote.Kläger}/${quote.Beklagte} (Kläger ${quote.Kläger} %, Beklagte ${quote.Beklagte} %).`);
  else if (kostenSatz) teile.push(kostenSatz);
  else teile.push("Kostenentscheidung: im Schreiben nicht genannt – im Urteil prüfen.");
  teile.push(vollstr ? `Vorläufige Vollstreckbarkeit: ${vollstr}` : "Vorläufige Vollstreckbarkeit: im Schreiben nicht genannt – im Urteil prüfen.");
  const eigen = eigeneRolle(text, data, akteId);
  if (eigen) {
    let ergebnis: string | undefined;
    const last = quote?.[eigen.rolle];
    if (last !== undefined) {
      ergebnis = last === 0 ? "voll erfolgreich" : last < 50 ? "überwiegend erfolgreich" : last === 50 ? "zur Hälfte erfolgreich" : last < 100 ? "überwiegend unterlegen" : "unterlegen";
      ergebnis += ` (trägt ${last} % der Kosten)`;
    } else if (haupt && abweisung) ergebnis = "teilweise erfolgreich";
    else if (haupt) ergebnis = eigen.rolle === "Kläger" ? "erfolgreich" : "unterlegen";
    else if (abweisung) ergebnis = /klage/i.test(abweisung) ? (eigen.rolle === "Kläger" ? "unterlegen" : "erfolgreich") : undefined;
    const rolle = eigen.rolle === "Kläger" ? (/^Frau|in$/.test(eigen.bezeichnung) ? "Klägerin" : "Kläger") : "Beklagte";
    if (ergebnis) teile.push(`Ergebnis für ${eigen.bezeichnung} ${eigen.name} (${rolle}): ${ergebnis}.`);
  }
  return teile.join(" ");
}

// ───────────── Rechtsmittelgericht (Instanzenzug) ─────────────

const OLG_BEZIRK: [RegExp, string][] = [
  [/\bberlin\b/, "Kammergericht"],
  [/\b(paderborn|bielefeld|detmold|dortmund|essen|bochum|hagen|arnsberg|siegen|münster|hamm)\b/, "Oberlandesgericht Hamm"],
  [/\b(köln|bonn|aachen)\b/, "Oberlandesgericht Köln"],
  [/\b(düsseldorf|duisburg|wuppertal|krefeld|mönchengladbach|kleve)\b/, "Oberlandesgericht Düsseldorf"],
  [/\b(münchen|landshut|traunstein|augsburg|kempten|memmingen|ingolstadt|passau|deggendorf)\b/, "Oberlandesgericht München"],
  [/\b(nürnberg|regensburg|amberg|ansbach|weiden)\b/, "Oberlandesgericht Nürnberg"],
  [/\b(bamberg|würzburg|bayreuth|coburg|hof|aschaffenburg|schweinfurt)\b/, "Oberlandesgericht Bamberg"],
  [/\bfrankfurt\s*(?:\(oder\)|\/\s*oder|an der oder)|\b(potsdam|cottbus|neuruppin)\b/, "Brandenburgisches Oberlandesgericht"],
  [/\b(frankfurt|wiesbaden|darmstadt|kassel|gießen|marburg|fulda|hanau|limburg)\b/, "Oberlandesgericht Frankfurt am Main"],
  [/\b(stuttgart|heilbronn|ulm|tübingen|ellwangen|hechingen|ravensburg|rottweil)\b/, "Oberlandesgericht Stuttgart"],
  [/\b(karlsruhe|mannheim|heidelberg|freiburg|baden-baden|konstanz|mosbach|offenburg|waldshut-tiengen)\b/, "Oberlandesgericht Karlsruhe"],
  [/\b(hannover|hildesheim|lüneburg|stade|verden|bückeburg)\b/, "Oberlandesgericht Celle"],
  [/\b(braunschweig|göttingen)\b/, "Oberlandesgericht Braunschweig"],
  [/\b(oldenburg|osnabrück|aurich)\b/, "Oberlandesgericht Oldenburg"],
  [/\bbremen\b/, "Hanseatisches Oberlandesgericht in Bremen"],
  [/\bhamburg\b/, "Hanseatisches Oberlandesgericht"],
  [/\b(dresden|leipzig|chemnitz|zwickau|görlitz)\b/, "Oberlandesgericht Dresden"],
  [/\b(halle|magdeburg|dessau|stendal)\b/, "Oberlandesgericht Naumburg"],
  [/\b(erfurt|gera|meiningen|mühlhausen)\b/, "Thüringer Oberlandesgericht"],
  [/\b(rostock|schwerin|stralsund|neubrandenburg)\b/, "Oberlandesgericht Rostock"],
  [/\b(kiel|lübeck|flensburg|itzehoe)\b/, "Schleswig-Holsteinisches Oberlandesgericht"],
  [/\b(koblenz|mainz|trier|bad kreuznach)\b/, "Oberlandesgericht Koblenz"],
  [/\b(kaiserslautern|frankenthal|landau|zweibrücken)\b/, "Pfälzisches Oberlandesgericht Zweibrücken"],
  [/\bsaarbrücken\b/, "Saarländisches Oberlandesgericht"],
];

const LAG_BEZIRK: [RegExp, string][] = [
  [/\b(berlin|potsdam|cottbus|eberswalde|brandenburg|neuruppin)\b|frankfurt\s*\(oder\)/, "Landesarbeitsgericht Berlin-Brandenburg"],
  [/\b(paderborn|bielefeld|detmold|dortmund|bochum|hagen|herne|gelsenkirchen|hamm|iserlohn|minden|rheine|siegen|arnsberg|münster|herford)\b/, "Landesarbeitsgericht Hamm"],
  [/\b(köln|bonn|aachen|siegburg)\b/, "Landesarbeitsgericht Köln"],
  [/\b(düsseldorf|duisburg|essen|krefeld|mönchengladbach|oberhausen|solingen|wesel|wuppertal)\b/, "Landesarbeitsgericht Düsseldorf"],
  [/\b(münchen|augsburg|kempten|passau|rosenheim)\b/, "Landesarbeitsgericht München"],
  [/\b(nürnberg|bamberg|bayreuth|würzburg|weiden|regensburg)\b/, "Landesarbeitsgericht Nürnberg"],
];
const LAG_LAND: Partial<Record<Bundesland, string>> = {
  BW: "Landesarbeitsgericht Baden-Württemberg", HE: "Hessisches Landesarbeitsgericht", NI: "Landesarbeitsgericht Niedersachsen", HB: "Landesarbeitsgericht Bremen",
  HH: "Landesarbeitsgericht Hamburg", SN: "Sächsisches Landesarbeitsgericht", ST: "Landesarbeitsgericht Sachsen-Anhalt", TH: "Thüringer Landesarbeitsgericht",
  MV: "Landesarbeitsgericht Mecklenburg-Vorpommern", SH: "Landesarbeitsgericht Schleswig-Holstein", RP: "Landesarbeitsgericht Rheinland-Pfalz", SL: "Landesarbeitsgericht Saarland",
  BE: "Landesarbeitsgericht Berlin-Brandenburg", BB: "Landesarbeitsgericht Berlin-Brandenburg",
};

/** Länder mit nur einem Oberlandesgericht */
const OLG_LAND: Partial<Record<Bundesland, string>> = {
  BE: "Kammergericht", BB: "Brandenburgisches Oberlandesgericht", HB: "Hanseatisches Oberlandesgericht in Bremen", HH: "Hanseatisches Oberlandesgericht",
  HE: "Oberlandesgericht Frankfurt am Main", MV: "Oberlandesgericht Rostock", SL: "Saarländisches Oberlandesgericht", SN: "Oberlandesgericht Dresden",
  ST: "Oberlandesgericht Naumburg", SH: "Schleswig-Holsteinisches Oberlandesgericht", TH: "Thüringer Oberlandesgericht",
};

/** Ort aus dem Gerichtsnamen („Arbeitsgericht Kassel“ → „kassel“). */
function gerichtsOrt(gericht: string): string {
  return gericht.toLowerCase().replace(/^(?:amts|land|arbeits|familien)gericht\s+|^(?:ag|lg|arbg)\s+/, "").replace(/\s+i{1,3}\b/, "").trim();
}

/**
 * Rechtsmittelgericht zur Berufung: aus der Rechtsbehelfsbelehrung („… beim Kammergericht einzulegen“), sonst aus dem
 * Instanzenzug (LG → OLG bzw. KG, AG → LG bzw. OLG in Familiensachen, ArbG → LAG).
 */
export function rechtsmittelgerichtZu(text: string, ausgangsgericht: string | undefined, art: { arbeitsgericht: boolean }): Rechtsmittelhinweis | undefined {
  const norm = art.arbeitsgericht ? "§ 64 Abs. 6 ArbGG i. V. m. § 519 Abs. 1 ZPO" : "§ 519 Abs. 1 ZPO";
  const belehrung = text.match(/(?:beim|bei dem)\s+((?:[A-ZÄÖÜ][\wäöüß.()-]*\s?){1,6}?)\s*(?:schriftlich\s+)?einzulegen/);
  let gericht = belehrung?.[1].trim();
  if (!gericht && ausgangsgericht) {
    const g = ausgangsgericht.toLowerCase();
    const ort = gerichtsOrt(ausgangsgericht);
    const familie = /familiengericht|familiensache/.test(`${g} ${text.toLowerCase()}`);
    if (/arbeitsgericht|\barbg\b/.test(g)) {
      gericht = LAG_BEZIRK.find(([re]) => re.test(ort))?.[1];
      if (!gericht) {
        const land = bundeslandAusGericht(ausgangsgericht)?.land ?? bundeslandAusOrt(ort);
        gericht = land ? LAG_LAND[land] : undefined;
      }
      gericht ??= "zuständigen Landesarbeitsgericht";
    } else if (/landgericht|\blg\b/.test(g) || familie) {
      const land = bundeslandAusGericht(ausgangsgericht)?.land ?? bundeslandAusOrt(ort);
      gericht = OLG_BEZIRK.find(([re]) => re.test(ort))?.[1] ?? (land ? OLG_LAND[land] : undefined) ?? "zuständigen Oberlandesgericht";
    } else if (/amtsgericht|\bag\b/.test(g)) {
      gericht = bundeslandAusGericht(ausgangsgericht)?.land === "BE" ? "Landgericht Berlin II" : /\b(münchen)\b/.test(ort) ? "Landgericht München I" : /\bhamburg\b/.test(ort) ? "Landgericht Hamburg" : "zuständigen Landgericht";
    }
  }
  if (!gericht) return undefined;
  return { art: "Berufung", gericht, norm, text: `Berufung einzulegen beim ${gericht}, ${norm}`, ausBelehrung: !!belehrung };
}

// ───────────── Vertragliche Ausschlussfristen ─────────────

const EINHEIT_RE = "(tag|tage|tagen|woche|wochen|monat|monate|monaten)";
function einheitAus(w: string): "tage" | "wochen" | "monate" {
  return w.startsWith("tag") ? "tage" : w.startsWith("woche") ? "wochen" : "monate";
}

/** Satz um eine Fundstelle (für das Zitat der Klausel). */
function satzUm(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf(". ", index) + 1, text.lastIndexOf("\n", index) + 1, 0);
  const endePunkt = text.indexOf(". ", index);
  const endeZeile = text.indexOf("\n", index);
  const ende = [endePunkt, endeZeile].filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? text.length;
  const satz = text.slice(start, ende + 1).trim();
  return satz.length > 240 ? `${satz.slice(0, 237)}…` : satz;
}

/**
 * Erkennt vertragliche Ausschluss- und Verfallklauseln: „Ausschlussfrist: drei Monate ab Fälligkeit“, „… verfallen, wenn sie
 * nicht innerhalb von drei Monaten nach Fälligkeit schriftlich geltend gemacht werden“, zweite Stufe „… gerichtlich geltend
 * gemacht“. Zahlwörter und Ziffern. Das Fristende berechnet erst der Fristenrechner – mit der erfragten Fälligkeit.
 */
export function erkenneAusschlussfrist(text: string, quelle = "Vertrag"): Ausschlussklausel | undefined {
  const t = text.replace(/[ \t]+/g, " ");
  const n = t.toLowerCase();
  if (!/ausschlussfrist|verfallfrist|ausschlussklausel|verfallklausel|\bverfallen\b|\bverfällt\b|ausgeschlossen, wenn/.test(n)) return undefined;
  const ZAHL = ZAHLWORT_RE;
  const stufe1: RegExp[] = [
    // „Ausschlussfrist: drei Monate ab Fälligkeit“ / „Ausschlussfrist drei Monate“
    new RegExp(`(?:ausschluss|verfall)(?:frist|klausel)(?:en)?\\s*(?:[:–-]|von|beträgt)?\\s*${ZAHL}\\s+${EINHEIT_RE}\\b(?:\\s+(?:ab|nach|seit)\\s+(?:der\\s+|ihrer\\s+|deren\\s+)?(fälligkeit|entstehung|beendigung des arbeitsverhältnisses))?`),
    // „… innerhalb von drei Monaten nach (ihrer) Fälligkeit … geltend gemacht …“
    new RegExp(`innerhalb\\s+(?:von\\s+|einer frist von\\s+)?${ZAHL}\\s+${EINHEIT_RE}\\s+(?:ab|nach|seit)\\s+(?:der\\s+|ihrer\\s+|deren\\s+|dem\\s+)?(fälligkeit|entstehung|beendigung des arbeitsverhältnisses)[^.]{0,120}?geltend`),
  ];
  let treffer: RegExpExecArray | null = null;
  for (const re of stufe1) {
    treffer = re.exec(n);
    if (treffer) break;
  }
  if (!treffer) return undefined;
  const dauer = zahl(treffer[1]);
  if (!dauer) return undefined;
  const beginnRoh = treffer[3] ?? "fälligkeit";
  const beginn = beginnRoh === "fälligkeit" ? "Fälligkeit" : beginnRoh === "entstehung" ? "Entstehung des Anspruchs" : "Beendigung des Arbeitsverhältnisses";
  // Zweite Stufe: gerichtliche Geltendmachung
  const stufe2 = new RegExp(`innerhalb\\s+(?:von\\s+|einer (?:weiteren )?frist von\\s+)?${ZAHL}\\s+${EINHEIT_RE}\\s+(?:nach|ab|seit)\\s+(?:der\\s+|dem\\s+|deren\\s+)?([a-zäöüß ]{3,40}?)\\s+(?:[a-zäöüß]+\\s+){0,4}?gerichtlich geltend`).exec(n)
    ?? new RegExp(`gerichtlich geltend[^.]{0,80}?innerhalb\\s+(?:von\\s+)?${ZAHL}\\s+${EINHEIT_RE}\\s+(?:nach|ab|seit)\\s+(?:der\\s+|dem\\s+)?([a-zäöüß ]{3,40}?)(?=[,.;]|$)`).exec(n);
  let zweiteStufe: Ausschlussklausel["zweiteStufe"];
  if (stufe2 && stufe2.index !== treffer.index) {
    const d2 = zahl(stufe2[1]);
    if (d2) zweiteStufe = { dauer: d2, einheit: einheitAus(stufe2[2]), beginn: stufe2[3].trim().replace(/^der |^dem /, "") || "Ablehnung", zitat: satzUm(t, stufe2.index) };
  }
  // Vertragsparagraph als Überschrift („§ 12 Ausschlussfristen“), keine Gesetzeszitate wie „§ 622 BGB“
  const vor = t.slice(Math.max(0, treffer.index - 400), treffer.index + 40);
  const paragraphen = [...vor.matchAll(/§\s*(\d+[a-z]?)\s+(?!(?:Abs\.|S\.|Nr\.|[A-ZÄÖÜ][A-Za-zÄÖÜäöü]*(?:G|B|O)\b))([A-ZÄÖÜ][a-zäöüß]+)/g)];
  const fundstelle = paragraphen.length ? `§ ${paragraphen[paragraphen.length - 1][1]}` : undefined;
  return { dauer, einheit: einheitAus(treffer[2]), beginn, zitat: satzUm(t, treffer.index), fundstelle, quelle, zweiteStufe };
}

/** „3 Monate“, „2 Wochen“, „1 Monat“ */
export function dauerText(dauer: number, einheit: "tage" | "wochen" | "monate"): string {
  const e = { tage: ["Tag", "Tage"], wochen: ["Woche", "Wochen"], monate: ["Monat", "Monate"] }[einheit];
  return `${dauer} ${dauer === 1 ? e[0] : e[1]}`;
}

/** Überschrift der Ausschlussfrist-Karte: „Ausschlussfrist erkannt: 3 Monate ab Fälligkeit (Arbeitsvertrag, § 12)“ */
export function ausschlussfristTitel(k: Ausschlussklausel): string {
  return `Ausschlussfrist erkannt: ${dauerText(k.dauer, k.einheit)} ab ${k.beginn} (${k.quelle}${k.fundstelle ? `, ${k.fundstelle}` : ""})`;
}

/**
 * Fristvorschlag zur Ausschlussfrist – erst mit der (erfragten, nie erfundenen) Fälligkeit. Berechnet vom Fristenrechner
 * (Regel „ausschlussfrist_vertrag“: §§ 187 Abs. 1, 188 Abs. 2, 193 BGB).
 */
export function ausschlussfristVorschlag(k: Ausschlussklausel, faelligkeit: ISODate, land: Bundesland, opts: { feiertagsOrt?: string; kanzleiLand?: Bundesland; anspruch?: string } = {}): FristVorschlag {
  const r = berechneNachRegel("ausschlussfrist_vertrag", faelligkeit, land, k.dauer, {
    einheit: k.einheit,
    ereignisLabel: `${k.beginn === "Fälligkeit" ? "Fälligkeit des Anspruchs" : k.beginn}${opts.anspruch ? ` (${opts.anspruch})` : ""}`,
    feiertagsOrt: opts.feiertagsOrt ?? "Kanzleisitz",
    kanzleiLand: opts.kanzleiLand,
  });
  const warnungen = [...r.warnungen];
  if (k.zweiteStufe)
    warnungen.push(`Zweite Stufe: Lehnt die Gegenseite ab oder äußert sie sich nicht, ist der Anspruch binnen ${dauerText(k.zweiteStufe.dauer, k.zweiteStufe.einheit)} nach ${k.zweiteStufe.beginn} gerichtlich geltend zu machen – sonst verfällt er. Diese Frist bei Eingang der Ablehnung gesondert notieren.`);
  return {
    regelKey: "ausschlussfrist_vertrag",
    titel: `Ausschlussfrist (${k.quelle}): Ansprüche geltend machen${opts.anspruch ? ` – ${opts.anspruch}` : ""}`,
    typ: "frist",
    ereignisDatum: faelligkeit,
    ende: r.ende,
    vorfrist: r.vorfrist,
    grundlage: `${k.quelle}${k.fundstelle ? `, ${k.fundstelle}` : ""} – vertragliche Ausschlussfrist (§§ 187 Abs. 1, 188 Abs. 2, 193 BGB)`,
    rechenweg: [`Klausel: „${k.zitat.replace(/[„“]/g, "")}“`, ...r.rechenweg],
    warnungen,
  };
}

/** Zusammenfassung: Post von Mandanten in der dritten Person, sonst die aussagekräftigsten Sätze (als Zitat, wenn in Ich-Form). */
function zusammenfassungFuer(typ: string, input: { text: string; von?: string; vonAdresse?: string; kanal?: string }, data: TenantData, akteId: string | undefined): string {
  const akte = akteId ? data.akten.find((a) => a.id === akteId) : undefined;
  const mandant = akte ? data.kontakte.find((k) => k.id === akte.mandantId) : undefined;
  const von = adresse(input.vonAdresse ?? input.von);
  const vomMandanten = !!mandant && ((!!von && adresse(mandant.email) === von) || (!!input.von && normalize(input.von) === normalize(mandant.name)));
  if (typ === "Mandantenkorrespondenz" || (vomMandanten && !GERICHTSPOST.test(typ))) {
    const name = vomMandanten ? mandant!.name : (input.von ?? "").replace(/\s*<.*>$/, "").trim();
    const s = name ? mandantenZusammenfassung(input.text, { name, kontakt: vomMandanten ? mandant : undefined, bezeichnung: vomMandanten ? mandantBezeichnung(mandant) : undefined }) : undefined;
    if (s) return s;
  }
  if (typ === "Urteil" || typ === "Versäumnisurteil") {
    const tenor = tenorZusammenfassung(input.text, data, akteId);
    if (tenor) return tenor;
  }
  const auszug = zusammenfassen(input.text);
  // Ich-Form aus E-Mails nicht als eigene Aussage der KI stehen lassen, sondern als Zitat kennzeichnen
  if (auszug && /\b(ich|mein|meine|meinen|meinem|mir|mich)\b/i.test(auszug) && input.von && (/^Mandat/.test(typ) || input.kanal === "email")) {
    return `${input.von.replace(/\s*<.*>$/, "").trim()} schreibt: „${auszug.replace(/[„“]/g, "")}“`;
  }
  return auszug;
}

/** Feiertags-Bundesland für die Fristberechnung: Gerichtsort laut Schreiben bzw. Akte, sonst Kanzleisitz. */
interface FristOrt {
  land: Bundesland;
  /** Gericht und Herkunft, z. B. „Landgericht Berlin II – laut Schreiben“ – erscheint immer im Rechenweg (ohne: „Kanzleisitz“) */
  hinweis?: string;
  /** Bundesland des Kanzleisitzes – für den Hinweis auf Feiertage, die nur dort gelten */
  kanzleiLand?: Bundesland;
  /** erkanntes Gericht (für das Rechtsmittelgericht) */
  gericht?: string;
}

function vorschlag(key: string, ereignis: ISODate, ort: FristOrt, opts: { ereignisLabel?: string; warnung?: string } = {}): FristVorschlag {
  const r = berechneNachRegel(key, ereignis, ort.land, undefined, { ereignisLabel: opts.ereignisLabel, feiertagsOrt: ort.hinweis, kanzleiLand: ort.kanzleiLand });
  return {
    regelKey: key, titel: r.regel.titel, typ: r.regel.typ, ereignisDatum: ereignis, ende: r.ende, vorfrist: r.vorfrist, grundlage: r.regel.grundlage, rechenweg: r.rechenweg,
    warnungen: opts.warnung ? [opts.warnung, ...r.warnungen] : r.warnungen,
  };
}

function freieFrist(titel: string, dauer: number, einheit: Einheit, ereignis: ISODate, ort: FristOrt, grundlage = "Richterliche Frist"): FristVorschlag {
  const r = berechneFrist({ ereignis, dauer, einheit, land: ort.land, vorfristTage: einheit === "tage" && dauer <= 10 ? 3 : 7, ereignisLabel: "Zustellung der Verfügung", feiertagsOrt: ort.hinweis, kanzleiLand: ort.kanzleiLand });
  return { regelKey: "richterlich", titel, typ: "frist", ereignisDatum: ereignis, ende: r.ende, vorfrist: r.vorfrist, grundlage, rechenweg: r.rechenweg, warnungen: r.warnungen };
}

/** Schreiben eines Gerichts bzw. einer Behörde? Dann bestimmt deren Sitz die Feiertage. */
const GERICHTSPOST = /^(Urteil|Versäumnisurteil|Strafbefehl|Bußgeldbescheid|Mitteilung Mahngericht|Vollstreckungsbescheid|Mahnbescheid|Ladung|Terminsmitteilung|Gerichtliche|Beschluss)/;

/**
 * Ort der fristwahrenden Handlung (§ 222 Abs. 2 ZPO): Gericht/Behörde laut Absender bzw. Schreiben, sonst das Gericht
 * der zugeordneten Akte, sonst der Kanzleisitz. Der Rechenweg nennt immer Land und Gericht („Feiertage am Gerichtsort geprüft …“).
 */
function fristOrt(typ: string, input: { von?: string; text: string; betreff?: string }, data: TenantData, akteId: string | undefined, land: Bundesland): FristOrt {
  const ausSchreiben = GERICHTSPOST.test(typ) ? bundeslandAusGericht(`${input.von ?? ""}\n${input.betreff ?? ""}\n${input.text.slice(0, 1500)}`) : undefined;
  if (ausSchreiben) return { land: ausSchreiben.land, hinweis: `${ausSchreiben.gericht} – laut Schreiben`, kanzleiLand: land, gericht: ausSchreiben.gericht };
  const akte = akteId ? data.akten.find((a) => a.id === akteId) : undefined;
  const ausAkte = gerichtsortDerAkte(akte, data.kontakte);
  if (ausAkte) return { land: ausAkte.land, hinweis: `${ausAkte.gericht} – laut Akte`, kanzleiLand: land, gericht: ausAkte.gericht };
  return { land, hinweis: "Kanzleisitz", kanzleiLand: land };
}

/**
 * Ort der Fristwahrung bei Rechtsmitteln: das Gericht, bei dem die Frist zu wahren ist (§ 519 Abs. 1 ZPO), nicht das
 * Ausgangsgericht – z. B. „Berlin (Kammergericht, Berufungsgericht)“. Unbekanntes Berufungsgericht → bisheriger Ort.
 */
export function rechtsmittelOrt(rm: Rechtsmittelhinweis | undefined, ort: FristOrt): FristOrt {
  if (!rm || /^zuständigen\b/.test(rm.gericht)) return ort;
  const g = bundeslandAusGericht(rm.gericht);
  if (!g) return ort;
  return { land: g.land, hinweis: `${rm.gericht}, ${rm.art === "Revision" ? "Revisionsgericht" : "Berufungsgericht"}`, kanzleiLand: ort.kanzleiLand, gericht: ort.gericht };
}

/** Zustellung später als fünf Monate nach Verkündung? Dann beginnt die Rechtsmittelfrist schon mit Ablauf der fünf Monate. */
function fuenfMonatsGrenze(n: string, zustellung: ISODate, norm: string): { ereignis: ISODate; label?: string; warnung?: string } {
  const verkuendet = parseDatum(n.match(/urteil vom ([0-9.\s]+\d{2,4}|\d{1,2}\.\s?[a-zä]+\s+\d{4})/)?.[1] ?? "");
  if (!verkuendet) return { ereignis: zustellung };
  const grenze = addMonthsBGB(verkuendet, 5).date;
  if (grenze >= zustellung) return { ereignis: zustellung };
  return {
    ereignis: grenze,
    label: `Ablauf von fünf Monaten nach Verkündung am ${fmtDate(verkuendet)} (${norm})`,
    warnung: `Das Urteil wurde am ${fmtDate(verkuendet)} verkündet – die Frist begann spätestens mit Ablauf von fünf Monaten danach (${norm}), nicht erst mit der Zustellung. Fristende sofort prüfen!`,
  };
}

const ZAHLWORT_RE = "(\\d+|eine[rm]?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|vierzehn|einundzwanzig)";
const DATUM_RE = "(\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{2,4}|\\d{1,2}\\.\\s?(?:januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\\s+\\d{4})";
/** „bis zum 20.11.2026“, „bis spätestens 20. November 2026“, „spätestens bis zum …“ */
const FEST_RE = new RegExp(`(?:bis\\s+(?:spätestens\\s+)?(?:zum\\s+|einschließlich\\s+)?|spätestens\\s+(?:bis\\s+)?(?:zum\\s+|am\\s+)?)(?:[a-zäöü]+,\\s+(?:den\\s+)?)?${DATUM_RE}`);
/** Handlungsaufforderung, ohne die ein Datum keine Frist ist */
const AUFGABE_RE = /frist|aufgegeben|stellung|gelegenheit|äußer|erwider|einzureichen|vorzulegen|nachzureichen|mitzuteilen|zu zahlen|zahlbar|zu begleichen|zu überweisen|zurückzusenden|zu bestätigen|zu unterzeichnen/;
/** Termine: „Termin zur mündlichen Verhandlung wird bestimmt auf …“, „Termin zur Verkündung einer Entscheidung: …“, „Verkündungstermin: …“ */
const TERMIN_RE = new RegExp(
  `(?:termin|verhandlung|anhörung|ladung)[^.\\n]{0,80}?(?:bestimmt auf|anberaumt auf|findet am|am|auf|:)\\s+(?:[a-zäöü]+,\\s+)?(?:den\\s+)?${DATUM_RE}[,\\s]+(?:um\\s+)?(\\d{1,2}[:.]\\d{2})\\s*uhr(?:(?:,\\s*|\\s+(?:in|im)\\s+)([^\\n]+?)(?=\\.\\s|\\.?$|\\n))?`,
  "im",
);

/**
 * Arbeitsuchendmeldung (§ 38 Abs. 1 SGB III): spätestens drei Monate vor Ende des Arbeitsverhältnisses, bei kürzerer
 * Zeit innerhalb von drei Tagen nach Kenntnis. Bei fristloser Kündigung mit bekanntem Zugang wird der Zeitablauf geprüft.
 */
function meldepflichtHinweis(data: TenantData, akteId: string | undefined, heute: ISODate, land: Bundesland): string {
  const kschg = akteId ? data.fristen.find((f) => f.akteId === akteId && f.regelKey === "kschg_klage" && f.ereignisDatum) : undefined;
  const akte = akteId ? data.akten.find((a) => a.id === akteId) : undefined;
  const fristlos = !!akte && (/fristlos|außerordentlich/i.test(akte.beschreibung) || data.dokumente.some((d) => d.akteId === akte.id && /kündigung/i.test(d.name) && /fristlos/i.test(d.inhalt)));
  if (kschg?.ereignisDatum && fristlos) {
    // drei Tage ab Kenntnis (Zugang); Ende am Wochenende/Feiertag → nächster Werktag (§ 26 Abs. 3 SGB X)
    const ablauf = berechneFrist({ ereignis: kschg.ereignisDatum, dauer: 3, einheit: "tage", land, verfahren: "BGB" }).ende;
    if (ablauf < heute)
      return `Mandanten auf die Arbeitsuchendmeldung hinweisen: Die Dreitagesfrist ab Kenntnis der fristlosen Kündigung (§ 38 Abs. 1 S. 2 SGB III) ist am ${fmtDate(ablauf)} abgelaufen – Meldung sofort nachholen, sonst droht eine Sperrzeit von einer Woche (§ 159 Abs. 1 S. 2 Nr. 7, Abs. 6 SGB III).`;
    return `Mandanten auf die Arbeitsuchendmeldung hinweisen: wegen der fristlosen Kündigung bis spätestens ${fmtDate(ablauf)} – drei Tage nach Kenntnis (§ 38 Abs. 1 S. 2 SGB III); sonst droht eine Sperrzeit (§ 159 SGB III).`;
  }
  return "Mandanten auf die Arbeitsuchendmeldung hinweisen: spätestens drei Monate vor Ende des Arbeitsverhältnisses, bei kürzerer Zeit innerhalb von drei Tagen nach Kenntnis (§ 38 Abs. 1 SGB III) – sonst droht eine Sperrzeit (§ 159 SGB III).";
}

/** „Die Revision wird zugelassen“ – aber nicht „Die Revision wird nicht zugelassen“. */
function revisionZugelassen(n: string): boolean {
  const m = n.match(/revision (?:wird|ist)((?: [a-zäöüß]+){0,3}) (?:zugelassen|zulässig)|lässt die revision zu/);
  return !!m && !/\bnicht\b/.test(m[1] ?? "");
}

function terminTitel(kontext: string): string {
  if (/verkündung/.test(kontext)) return "Verkündungstermin";
  if (/hauptverhandlung/.test(kontext)) return "Hauptverhandlung";
  if (/güte/.test(kontext)) return "Gütetermin";
  if (/anhörung/.test(kontext)) return "Anhörungstermin";
  return "Mündliche Verhandlung";
}

/** Regelbasierte Analyse (offline) – auch Basis zur Prüfung der Live-KI. */
export function analysiereRegelbasiert(input: { text: string; betreff?: string; von?: string; vonAdresse?: string; eingang?: string; kanal?: string }, data: TenantData, land: Bundesland): Omit<DokAnalyse, "quelle" | "dauerMs"> {
  const voll = `${input.betreff ?? ""}\n${input.text}`;
  const n = voll.toLowerCase();
  const { typ, art } = klassifiziere(voll);
  const match = findeAkte(voll, data, [input.von ?? ""], input.vonAdresse ?? input.von);
  const eingang = (input.eingang ?? today()).slice(0, 10);
  const fristen: FristVorschlag[] = [];
  const aktionen: string[] = [];
  let termin: DokAnalyse["termin"];
  const eeb = /empfangsbekenntnis|\beeb\b/.test(n);
  // Zustellung gegen (e)EB: zugestellt ist am Tag, an dem die Anwältin bzw. der Anwalt das Schriftstück empfangsbereit
  // zur Kenntnis genommen hat (dieses Datum steht im eEB) – vorsorglich rechnet AnwaltApex ab dem Eingangstag.
  const zustellung = eingang;
  const ort = fristOrt(typ, input, data, match.akteId, land);
  let rechtsmittel: Rechtsmittelhinweis | undefined;

  if (typ === "Urteil") {
    // Jedes zugestellte Urteil löst eine Rechtsmittelfrist aus – auch ohne Rechtsmittelbelehrung im Text.
    const absender = (input.von ?? "").toLowerCase();
    const strafsache = /angeklagte|strafsache|strafverfahren|staatsanwaltschaft|freiheitsstrafe|geldstrafe|tagessätze/.test(n);
    const lag = /landesarbeitsgericht|\blag\b/.test(absender) || /urteil des landesarbeitsgerichts/.test(n);
    const zweiteInstanz = lag || /oberlandesgericht|kammergericht|\bolg\b/.test(absender) || /urteil des (oberlandesgerichts|kammergerichts)|berufungsurteil|auf die berufung (des|der)/.test(n);
    const arbeitsgericht = /arbeitsgericht/.test(absender) || /urteil des arbeitsgerichts|\barbeitsgericht\b/.test(n);
    if (strafsache) {
      aktionen.push("Rechtsmittelfrist sofort prüfen: Berufung bzw. Revision binnen einer Woche nach Verkündung (§§ 314, 341 StPO), bei Verkündung in Abwesenheit ab Zustellung.");
    } else if (/verwaltungsgericht/.test(`${absender} ${n}`) && !/oberverwaltungsgericht|verwaltungsgerichtshof/.test(absender)) {
      aktionen.push("Antrag auf Zulassung der Berufung prüfen – binnen eines Monats nach Zustellung des vollständigen Urteils (§ 124a Abs. 4 VwGO).");
    } else if (lag) {
      aktionen.push("Rechtsmittel prüfen: Revision zum BAG nur bei Zulassung (§ 72 ArbGG), sonst Nichtzulassungsbeschwerde (§ 72a ArbGG) – Frist jeweils ein Monat ab Zustellung.");
    } else if (zweiteInstanz && revisionZugelassen(n)) {
      fristen.push(vorschlag("revision", zustellung, ort), vorschlag("revisionsbegruendung", zustellung, ort));
      rechtsmittel = lag
        ? { art: "Revision", gericht: "Bundesarbeitsgericht", norm: "§ 74 Abs. 1 ArbGG", text: "Revision einzulegen beim Bundesarbeitsgericht (Erfurt), § 74 Abs. 1 ArbGG", ausBelehrung: false }
        : { art: "Revision", gericht: "Bundesgerichtshof", norm: "§ 549 Abs. 1 ZPO", text: "Revision einzulegen beim Bundesgerichtshof (Karlsruhe), § 549 Abs. 1 ZPO", ausBelehrung: false };
      aktionen.push("Mandanten über das Berufungsurteil informieren und Revision prüfen.");
    } else if (zweiteInstanz) {
      aktionen.push("Rechtsmittel prüfen: Revision nur bei Zulassung, sonst Nichtzulassungsbeschwerde – Frist jeweils ein Monat ab Zustellung.");
    } else {
      const [ein, begr, norm] = arbeitsgericht ? (["berufung_arbg", "berufungsbegruendung_arbg", "§ 66 Abs. 1 S. 2 ArbGG"] as const) : (["berufung", "berufungsbegruendung", "§ 517 Hs. 2 ZPO"] as const);
      const g = fuenfMonatsGrenze(n, zustellung, norm);
      rechtsmittel = rechtsmittelgerichtZu(input.text, ort.gericht ?? (arbeitsgericht ? input.von : undefined), { arbeitsgericht });
      // Berufung und Begründung werden beim Berufungsgericht eingereicht (§ 519 Abs. 1, § 520 Abs. 3 S. 1 ZPO) – dessen Feiertage gelten
      const rmOrt = rechtsmittelOrt(rechtsmittel, ort);
      fristen.push(vorschlag(ein, g.ereignis, rmOrt, { ereignisLabel: g.label, warnung: g.warnung }), vorschlag(begr, g.ereignis, rmOrt, { ereignisLabel: g.label }));
      aktionen.push(`Mandanten über das Urteil informieren und Berufung prüfen (${arbeitsgericht ? "Zulassung, Beschwer über 600 € oder Bestandsstreit, § 64 Abs. 2 ArbGG" : "Beschwer über 1.000 € oder Zulassung, § 511 Abs. 2 ZPO"}; Kostenrisiko).`);
    }
  } else if (typ === "Versäumnisurteil") {
    fristen.push(vorschlag("einspruch_vu", zustellung, ort));
    aktionen.push("Einspruch einlegen und Säumnisgrund klären.");
  } else if (typ === "Strafbefehl") {
    const zd = parseDatum(n.match(/zugestellt am ([^.\n]+\.\d{2,4})/)?.[1] ?? "") ?? zustellung;
    fristen.push(vorschlag("einspruch_strafbefehl", zd, ort));
    aktionen.push("Einspruch prüfen – ggf. auf Rechtsfolgen beschränken.");
  } else if (typ === "Bußgeldbescheid") {
    fristen.push(vorschlag("einspruch_bussgeld", zustellung, ort));
    aktionen.push("Einspruch einlegen und Akteneinsicht inkl. Rohmessdaten beantragen.");
  } else if (typ === "Mahnbescheid") {
    fristen.push(vorschlag("widerspruch_mb", zustellung, ort));
  } else if (typ === "Kündigung (Arbeitsverhältnis)") {
    const zug = parseDatum(n.match(/zugegangen[^0-9]*(\d{1,2}\.\d{1,2}\.\d{2,4})/)?.[1] ?? "") ?? eingang;
    fristen.push(vorschlag("kschg_klage", zug, ort));
    aktionen.push("Kündigungsschutzklage vorbereiten; Betriebsratsanhörung (§ 102 BetrVG) prüfen.");
  }

  // Vertragliche Ausschlussfristen (Arbeitsvertrag u. a.): Dauer aus der Klausel, Fälligkeit wird erfragt – nie erfunden.
  const ausschlussfrist = art === "vertrag" || /ausschlussfrist|verfallfrist|verfallen, wenn/.test(n) ? erkenneAusschlussfrist(voll, typ === "Schreiben" ? "Vertrag" : typ) : undefined;
  if (ausschlussfrist) {
    aktionen.push(`${ausschlussfristTitel(ausschlussfrist)} – Fälligkeit der Ansprüche klären und die Frist notieren. Bei Versäumung verfällt der Anspruch.`);
    if (ausschlussfrist.zweiteStufe) aktionen.push(`Zweite Stufe beachten: gerichtliche Geltendmachung binnen ${dauerText(ausschlussfrist.zweiteStufe.dauer, ausschlussfrist.zweiteStufe.einheit)} nach ${ausschlussfrist.zweiteStufe.beginn}.`);
  }

  // Richterliche Fristen: „binnen drei Wochen", „innerhalb von zehn Tagen"
  const rich = ausschlussfrist ? null : n.match(new RegExp(`(?:binnen|innerhalb von|innerhalb)\\s+(?:einer frist von\\s+)?${ZAHLWORT_RE}\\s+(tag|tagen|woche|wochen|monat|monaten)`));
  const fristTitel = /stellung|äußer|erwider/.test(n) ? "Stellungnahmefrist (gerichtlich gesetzt)" : /zahl|begleich|überweis/.test(n) ? "Zahlungsfrist" : "Frist laut Schreiben";
  if (rich && !fristen.length) {
    const dauer = zahl(rich[1]) ?? 2;
    const einheit: Einheit = rich[2].startsWith("tag") ? "tage" : rich[2].startsWith("woche") ? "wochen" : "monate";
    fristen.push(freieFrist(fristTitel, dauer, einheit, zustellung, ort));
  }

  // Fristen mit festem Datum: „bis zum 20.11.2026 Stellung zu nehmen“
  const fest = !fristen.length && typ !== "Rechnung" && typ !== "Newsletter" ? n.match(FEST_RE) : null;
  const festEnde = fest ? parseDatum(fest[1]) : undefined;
  if (festEnde && festEnde >= zustellung && festEnde <= addDays(zustellung, 730) && AUFGABE_RE.test(n)) {
    const gericht = GERICHTSPOST.test(typ) || /gericht/i.test(input.von ?? "");
    const titel = gericht
      ? fristTitel === "Frist laut Schreiben" ? "Frist laut Verfügung (gerichtlich gesetzt)" : fristTitel
      : fristTitel === "Stellungnahmefrist (gerichtlich gesetzt)" ? "Stellungnahmefrist laut Schreiben" : fristTitel;
    const r = berechneFestesEnde({ ende: festEnde, ereignis: zustellung, land: ort.land, ereignisLabel: gericht ? "Zustellung der Verfügung" : "Eingang des Schreibens", quelle: gericht ? "Verfügung" : "Schreiben", feiertagsOrt: ort.hinweis, kanzleiLand: ort.kanzleiLand });
    fristen.push({ regelKey: "richterlich", titel, typ: "frist", ereignisDatum: zustellung, ende: r.ende, vorfrist: r.vorfrist, grundlage: gericht ? "Richterliche Frist (Datum laut Verfügung)" : "Frist laut Schreiben (festes Datum)", rechenweg: r.rechenweg, warnungen: r.warnungen });
  }

  // Termine
  const tm = voll.match(TERMIN_RE);
  if (tm && /termin|ladung|verhandlung|anhörung/.test(n)) {
    const datum = parseDatum(tm[1]);
    const ortText = tm[3]?.trim().replace(/[.,;]+$/, "");
    const kontext = voll.slice(Math.max(0, (tm.index ?? 0) - 40), (tm.index ?? 0) + tm[0].length).toLowerCase();
    if (datum) termin = { datum, uhrzeit: tm[2].replace(".", ":"), ort: ortText || undefined, titel: terminTitel(kontext) };
  }

  // Weitere Handlungsempfehlungen
  if (/vergleich/.test(n)) aktionen.push("Vergleichsangebot mit Mandantschaft abstimmen (Erfolgsaussichten gegenüberstellen).");
  if (/zeuge|bestätigen/.test(n) && typ === "Mandantenkorrespondenz") aktionen.push("Zeugenhinweis in der Akte notieren und Zeugen benennen lassen.");
  if (/arbeitsagentur|arbeitsuchend/.test(n)) aktionen.push(meldepflichtHinweis(data, match.akteId, eingang, land));
  if (/anbei|anhang|unterlagen/.test(n) && typ === "Mandantenkorrespondenz") aktionen.push("Anhänge in der E-Akte (Ordner „Mandant“) ablegen.");
  if (/erkundigen|neuigkeiten|sachstand|stand (der|meiner|unserer) sache/.test(n) && !GERICHTSPOST.test(typ)) aktionen.push("Mandantschaft über den aktuellen Stand informieren (Mandanten-Update).");
  if (/vermögensauskunft/.test(n)) aktionen.push("Vermögensverzeichnis auswerten und Pfändungsmöglichkeiten prüfen (Kontopfändung, Lohnpfändung).");
  if (/widerspruch erhoben|widerspruch gegen (den )?mahnbescheid/.test(n)) aktionen.push("Weitere Gerichtskosten einzahlen und Anspruchsbegründung vorbereiten (§ 697 ZPO).");
  if (typ === "Klageerwiderung") aktionen.push("Replik vorbereiten – Einwendungen der Gegenseite einzeln prüfen.");
  if (typ.startsWith("Mandatsanfrage")) aktionen.push("Mandatsaufnahme starten: Akte anlegen, Vollmacht und Deckungsanfrage automatisch erzeugen.");
  if (typ === "Newsletter") aktionen.push("Kein Handlungsbedarf – als erledigt markieren.");
  if (termin) aktionen.push("Termin in den Kalender übernehmen und Mandantschaft informieren.");
  if (fristen.length && !aktionen.length) aktionen.push(fristen[0].titel.startsWith("Zahlungsfrist") ? "Frist eintragen und Zahlung bzw. Einwendungen mit der Mandantschaft klären." : "Frist eintragen und Stellungnahme in der Akte vorbereiten.");
  if (eeb) aktionen.unshift("Elektronisches Empfangsbekenntnis abgeben, sobald die Fristen notiert sind.");
  if (!aktionen.length) aktionen.push(match.akteId ? "Zur Kenntnis nehmen und in der E-Akte ablegen." : "Prüfen, ob eine neue Akte angelegt werden soll.");

  return {
    typ,
    dokumentArt: art,
    zusammenfassung: zusammenfassungFuer(typ, input, data, match.akteId) || input.betreff || typ,
    akteId: match.akteId,
    akteSicherheit: match.sicherheit,
    akteGrund: match.grund,
    fristen,
    termin,
    aktionen,
    eeb,
    ausschlussfrist,
    rechtsmittel,
  };
}

interface LlmDokErgebnis {
  typ: string;
  zusammenfassung: string;
  hinweiseAkte?: string[];
  ereignisDatum?: string;
  fristen?: { regelKey?: string; titel?: string; dauer?: number; einheit?: Einheit }[];
  termin?: { datum?: string; uhrzeit?: string; ort?: string; titel?: string };
  aktionen?: string[];
}

/**
 * Vollständige Analyse. Mit Live-KI liest Claude das Schreiben; Akte & Fristen werden anschließend
 * deterministisch geprüft bzw. berechnet. Ohne Live-KI: regelbasierte Analyse.
 */
export async function analysiereDokument(
  input: { text: string; betreff?: string; von?: string; vonAdresse?: string; eingang?: string; kanal?: string },
  data: TenantData,
  land: Bundesland,
  opts: { signal?: AbortSignal; onText?: (t: string) => void } = {},
): Promise<DokAnalyse> {
  const t0 = performance.now();
  const basis = analysiereRegelbasiert(input, data, land);
  if (aktuelleQuelle() === "demo") {
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
    return { ...basis, quelle: "demo", dauerMs: performance.now() - t0 };
  }
  try {
    const katalog = FRIST_REGELN.map((r) => `${r.key}: ${r.titel} (${r.grundlage}, ${r.dauer} ${r.einheit}, Ereignis: ${r.ereignis})`).join("\n");
    const res = await llmJson<LlmDokErgebnis>({
      system:
        "Du bist die Posteingangs-KI einer deutschen Anwaltskanzlei. Du liest Schreiben (beA, E-Mail) und extrahierst strukturiert, was die Kanzlei wissen muss. Du berechnest KEINE Fristenden – du nennst nur Fristart, Dauer und das fristauslösende Ereignisdatum; die Berechnung übernimmt ein geprüfter Fristenrechner. Erfinde keine Aktenzeichen. Schreibe auf Deutsch, präzise und knapp.",
      messages: [
        {
          role: "user",
          content: `Analysiere dieses Schreiben. Eingangsdatum: ${fmtDate(input.eingang?.slice(0, 10) ?? today())} (gilt als Zustellungsdatum, wenn nichts anderes genannt ist).\n\nFristkatalog (regelKey: Beschreibung):\n${katalog}\n\nAntwortformat (JSON):\n{"typ": string, "zusammenfassung": string (max. 2 Sätze), "hinweiseAkte": string[] (Aktenzeichen, Gerichtsaktenzeichen, Parteinamen aus dem Text), "ereignisDatum": "YYYY-MM-DD" | null, "fristen": [{"regelKey": string | null, "titel": string, "dauer": number, "einheit": "tage"|"wochen"|"monate"}], "termin": {"datum": "YYYY-MM-DD", "uhrzeit": "HH:MM", "ort": string, "titel": string} | null, "aktionen": string[] (max. 4 konkrete nächste Schritte)}\n\nAbsender: ${input.von ?? "–"}\nBetreff: ${input.betreff ?? "–"}\n\n${input.text.slice(0, 8000)}`,
        },
      ],
      signal: opts.signal,
      effort: "low",
    });
    const ereignis = res.ereignisDatum && /^\d{4}-\d{2}-\d{2}$/.test(res.ereignisDatum) ? res.ereignisDatum : (input.eingang ?? today()).slice(0, 10);
    const match = findeAkte(`${input.betreff ?? ""}\n${input.text}`, data, [...(res.hinweiseAkte ?? []), input.von ?? ""], input.vonAdresse ?? input.von);
    const ort = fristOrt(basis.typ, input, data, match.akteId ?? basis.akteId, land);
    const fristen: FristVorschlag[] = [];
    for (const f of res.fristen ?? []) {
      if (f.regelKey && FRIST_REGELN.some((r) => r.key === f.regelKey)) fristen.push(vorschlag(f.regelKey, ereignis, ort));
      else if (f.dauer && f.einheit) fristen.push(freieFrist(f.titel ?? "Frist laut Schreiben", f.dauer, f.einheit, ereignis, ort));
    }
    const termin = res.termin?.datum && /^\d{4}-\d{2}-\d{2}$/.test(res.termin.datum) ? { datum: res.termin.datum, uhrzeit: res.termin.uhrzeit, ort: res.termin.ort, titel: res.termin.titel ?? "Termin" } : basis.termin;
    return {
      ...basis,
      typ: res.typ || basis.typ,
      zusammenfassung: res.zusammenfassung || basis.zusammenfassung,
      akteId: match.akteId ?? basis.akteId,
      akteSicherheit: match.akteId ? match.sicherheit : basis.akteSicherheit,
      akteGrund: match.grund ?? basis.akteGrund,
      fristen: fristen.length ? fristen : basis.fristen,
      termin,
      // Die regelbasierte Erkennung der Ausschlussfrist läuft auch bei Live-KI – ihr Hinweis bleibt immer erhalten.
      aktionen: res.aktionen?.length ? [...basis.aktionen.filter((a) => /^Ausschlussfrist erkannt|^Zweite Stufe beachten/.test(a)), ...res.aktionen] : basis.aktionen,
      quelle: aktuelleQuelle(),
      dauerMs: performance.now() - t0,
    };
  } catch (e) {
    if (!(e instanceof DemoModus)) console.warn("Live-Analyse fehlgeschlagen, nutze Regeln", e);
    return { ...basis, quelle: "demo", dauerMs: performance.now() - t0 };
  }
}

/** Analyse einer Posteingangs-Nachricht → speicherbarer KI-Vorschlag. */
export async function analysiereNachricht(n: Nachricht, data: TenantData, land: Bundesland, opts: { signal?: AbortSignal } = {}): Promise<{ analyse: DokAnalyse; vorschlag: KiVorschlag }> {
  const analyse = await analysiereDokument({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: n.eingang, kanal: n.kanal }, data, land, opts);
  const f = analyse.fristen[0];
  const vorschlag: KiVorschlag = {
    akteId: analyse.akteId,
    sicherheit: analyse.akteId ? analyse.akteSicherheit : 0.9,
    zusammenfassung: analyse.zusammenfassung,
    aktion: analyse.aktionen.join(" "),
    dokumentArt: analyse.dokumentArt,
    frist: f ? { regelKey: f.regelKey, titel: f.titel, ereignisDatum: f.ereignisDatum, datum: f.ende, vorfrist: f.vorfrist, grundlage: f.grundlage, rechenweg: f.rechenweg, typ: f.typ } : undefined,
    fristen: analyse.fristen.map((x) => ({ regelKey: x.regelKey, titel: x.titel, ereignisDatum: x.ereignisDatum, datum: x.ende, vorfrist: x.vorfrist, grundlage: x.grundlage, rechenweg: x.rechenweg, typ: x.typ })),
    termin: analyse.termin,
    akteGrund: analyse.akteGrund,
    typ: analyse.typ,
    aktionen: analyse.aktionen,
  };
  return { analyse, vorschlag };
}

/** Beispieldokumente für die Dokument-Analyse im KI-Bereich. */
export function beispielDokumente(): { titel: string; text: string; betreff: string; von: string }[] {
  const zust = fmtDate(today());
  // Verhandlungstermin auf einen Werktag in rund sechs Wochen legen (Wochentag passend zum Datum)
  let termin = addDays(today(), 41);
  while ([0, 6].includes(new Date(termin + "T00:00:00Z").getUTCDay())) termin = addDays(termin, 1);
  return [
    {
      titel: "Versäumnisurteil (Zivilsache)",
      von: "Amtsgericht Mitte",
      betreff: "Zustellung eines Versäumnisurteils",
      text: `In dem Rechtsstreit Kastanienhof Wohnbau eG ./. Schulz wird Ihnen das Versäumnisurteil vom ${fmtDate(addDays(today(), -5))} zugestellt. Der Beklagte wird verurteilt, an die Klägerin 3.240,00 € nebst Zinsen zu zahlen. Gegen dieses Urteil kann binnen einer Notfrist von zwei Wochen ab Zustellung Einspruch eingelegt werden.`,
    },
    {
      titel: "Richterliche Verfügung",
      von: "Landgericht",
      betreff: "Verfügung – Stellungnahmefrist",
      text: `Der Klagepartei wird aufgegeben, zu dem Schriftsatz der Gegenseite binnen drei Wochen Stellung zu nehmen. Termin zur mündlichen Verhandlung wird bestimmt auf ${wochentagName(termin)}, den ${fmtDate(termin)}, 10:30 Uhr, Sitzungssaal 2.14.`,
    },
    {
      titel: "Kündigung (Arbeitsrecht)",
      von: "Mandant (per E-Mail)",
      betreff: "Kündigung erhalten",
      text: `Sehr geehrte Damen und Herren, hiermit kündigen wir das mit Ihnen bestehende Arbeitsverhältnis ordentlich zum ${fmtDate(addDays(today(), 60))}. Zugegangen am ${zust}. Gründe: Auftragsrückgang in der Abteilung Vertrieb.`,
    },
  ];
}

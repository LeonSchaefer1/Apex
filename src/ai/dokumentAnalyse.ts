// Dokument- & Posteingangs-Analyse: Die KI erkennt Akte, Ereignis und Fristart – berechnet wird ausschließlich mit dem Fristenrechner.
import { berechneFrist, berechneNachRegel, FRIST_REGELN, type Einheit } from "@/core/fristen";
import { fmtDate, today, addDays } from "@/core/dates";
import { normalize } from "@/core/search";
import type { Bundesland, FristTyp, ISODate, KiVorschlag, Nachricht, TenantData, DokumentArt } from "@/core/types";
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

export interface DokAnalyse {
  typ: string;
  dokumentArt: DokumentArt;
  zusammenfassung: string;
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
      gruende.push(`Absender ${von} ist Mandant ${mandant.name}`);
    } else if (gegenseite) {
      const eindeutig = aktenDes(gegenseite, a[gegenseite]!).length === 1;
      s += eindeutig ? 0.9 : 0.35;
      gruende.push(`Absender ${von} ist ${gegenseite === "gegnerId" ? "Gegner" : "Gegenseite"} ${data.kontakte.find((k) => k.id === a[gegenseite])?.name ?? ""}`.trim());
    }
    if (mandant && norm.includes(normalize(mandant.name))) {
      s += vomMandanten ? 0.03 : 0.62;
      if (!vomMandanten) gruende.push(`Mandant ${mandant.name}`);
    } else if (mandant?.nachname && new RegExp(`\\b${normalize(mandant.nachname)}\\b`).test(norm)) {
      s += vomMandanten ? 0.02 : 0.38;
      if (!vomMandanten) gruende.push(`Name ${mandant.nachname}`);
    }
    if (gegner && norm.includes(normalize(gegner.name))) {
      s += 0.33;
      gruende.push(`Gegner ${gegner.name}`);
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
  if (/strafbefehl/.test(n)) return { typ: "Strafbefehl", art: "beschluss" };
  if (/bußgeldbescheid/.test(n)) return { typ: "Bußgeldbescheid", art: "bea" };
  if (/widerspruch gegen (den )?mahnbescheid|widerspruch erhoben/.test(n)) return { typ: "Mitteilung Mahngericht (Widerspruch)", art: "beschluss" };
  if (/vollstreckungsbescheid/.test(n)) return { typ: "Vollstreckungsbescheid", art: "beschluss" };
  if (/mahnbescheid/.test(n)) return { typ: "Mahnbescheid", art: "beschluss" };
  if (/vermögensauskunft|gerichtsvollzieher/.test(n)) return { typ: "Mitteilung Gerichtsvollzieher", art: "brief" };
  if (/ladung|termin[^.]{0,80}bestimmt|bestimmt auf/.test(n)) return { typ: "Ladung / Terminbestimmung", art: "beschluss" };
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

function vorschlag(key: string, ereignis: ISODate, land: Bundesland): FristVorschlag {
  const r = berechneNachRegel(key, ereignis, land);
  return { regelKey: key, titel: r.regel.titel, typ: r.regel.typ, ereignisDatum: ereignis, ende: r.ende, vorfrist: r.vorfrist, grundlage: r.regel.grundlage, rechenweg: r.rechenweg, warnungen: r.warnungen };
}

function freieFrist(titel: string, dauer: number, einheit: Einheit, ereignis: ISODate, land: Bundesland, grundlage = "Richterliche Frist"): FristVorschlag {
  const r = berechneFrist({ ereignis, dauer, einheit, land, vorfristTage: einheit === "tage" && dauer <= 10 ? 3 : 7, ereignisLabel: "Zustellung der Verfügung" });
  return { regelKey: "richterlich", titel, typ: "frist", ereignisDatum: ereignis, ende: r.ende, vorfrist: r.vorfrist, grundlage, rechenweg: r.rechenweg, warnungen: r.warnungen };
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
  const zustellung = eingang; // beA: Zustellung mit Abgabe des eEB – vorsorglich Eingangstag

  if (typ === "Urteil" && /berufung/.test(n)) {
    fristen.push(vorschlag("berufung", zustellung, land), vorschlag("berufungsbegruendung", zustellung, land));
    aktionen.push("Mandanten über das Urteil informieren und Berufung prüfen (Beschwer, Kostenrisiko).");
    if (/arbeitsgericht/.test(n)) fristen.splice(0, 1, vorschlag("berufung_arbg", zustellung, land));
  } else if (typ === "Versäumnisurteil") {
    fristen.push(vorschlag("einspruch_vu", zustellung, land));
    aktionen.push("Einspruch einlegen und Säumnisgrund klären.");
  } else if (typ === "Strafbefehl") {
    const zd = parseDatum(n.match(/zugestellt am ([^.\n]+\.\d{2,4})/)?.[1] ?? "") ?? zustellung;
    fristen.push(vorschlag("einspruch_strafbefehl", zd, land));
    aktionen.push("Einspruch prüfen – ggf. auf Rechtsfolgen beschränken.");
  } else if (typ === "Bußgeldbescheid") {
    fristen.push(vorschlag("einspruch_bussgeld", zustellung, land));
    aktionen.push("Einspruch einlegen und Akteneinsicht inkl. Rohmessdaten beantragen.");
  } else if (typ === "Mahnbescheid") {
    fristen.push(vorschlag("widerspruch_mb", zustellung, land));
  } else if (typ === "Kündigung (Arbeitsverhältnis)") {
    const zug = parseDatum(n.match(/zugegangen[^0-9]*(\d{1,2}\.\d{1,2}\.\d{2,4})/)?.[1] ?? "") ?? eingang;
    fristen.push(vorschlag("kschg_klage", zug, land));
    aktionen.push("Kündigungsschutzklage vorbereiten; Betriebsratsanhörung (§ 102 BetrVG) prüfen.");
  }

  // Richterliche Fristen: „binnen drei Wochen", „innerhalb von zehn Tagen"
  const rich = n.match(/(?:binnen|innerhalb von|innerhalb)\s+(?:einer frist von\s+)?(\d+|eine[rm]?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|vierzehn|einundzwanzig)\s+(tag|tagen|woche|wochen|monat|monaten)/);
  if (rich && !fristen.length) {
    const dauer = zahl(rich[1]) ?? 2;
    const einheit: Einheit = rich[2].startsWith("tag") ? "tage" : rich[2].startsWith("woche") ? "wochen" : "monate";
    const titel = /stellung/.test(n) ? "Stellungnahmefrist (gerichtlich gesetzt)" : /zahl/.test(n) ? "Zahlungsfrist" : "Frist laut Schreiben";
    fristen.push(freieFrist(titel, dauer, einheit, zustellung, land));
  }

  // Termine
  const tm = voll.match(/(?:termin[^.]*?(?:bestimmt auf|am)|auf)\s+(?:[A-Za-zäöü]+,\s+)?(?:den\s+)?(\d{1,2}\.\s?(?:\d{1,2}\.\s?\d{2,4}|[A-Za-zä]+\s+\d{4}))[,\s]+(\d{1,2}[:.]\d{2})\s*Uhr(?:,\s*([^.\n]+))?/i);
  if (tm && /termin|ladung|verhandlung|anhörung/.test(n)) {
    const datum = parseDatum(tm[1]);
    if (datum) termin = { datum, uhrzeit: tm[2].replace(".", ":"), ort: tm[3]?.trim(), titel: /anhörung/.test(n) ? "Anhörungstermin" : "Mündliche Verhandlung" };
  }

  // Weitere Handlungsempfehlungen
  if (/vergleich/.test(n)) aktionen.push("Vergleichsangebot mit Mandantschaft abstimmen (Erfolgsaussichten gegenüberstellen).");
  if (/zeuge|bestätigen/.test(n) && typ === "Mandantenkorrespondenz") aktionen.push("Zeugenhinweis in der Akte notieren und Zeugen benennen lassen.");
  if (/arbeitsagentur|arbeitsuchend/.test(n)) aktionen.push("Mandanten auf die Meldepflicht bei der Agentur für Arbeit (§ 38 SGB III, innerhalb von 3 Tagen) hinweisen.");
  if (/anbei|anhang|unterlagen/.test(n) && typ === "Mandantenkorrespondenz") aktionen.push("Anhänge in der E-Akte (Ordner „Mandant“) ablegen.");
  if (/vermögensauskunft/.test(n)) aktionen.push("Vermögensverzeichnis abrufen und Pfändungsmöglichkeiten prüfen (Kontopfändung, Lohnpfändung).");
  if (/widerspruch erhoben|widerspruch gegen (den )?mahnbescheid/.test(n)) aktionen.push("Weitere Gerichtskosten einzahlen und Anspruchsbegründung vorbereiten (§ 697 ZPO).");
  if (typ === "Klageerwiderung") aktionen.push("Replik vorbereiten – Einwendungen der Gegenseite einzeln prüfen.");
  if (typ.startsWith("Mandatsanfrage")) aktionen.push("Mandatsaufnahme starten: Akte anlegen, Vollmacht und Deckungsanfrage automatisch erzeugen.");
  if (typ === "Newsletter") aktionen.push("Kein Handlungsbedarf – archivieren.");
  if (termin) aktionen.push("Termin in den Kalender übernehmen und Mandantschaft informieren.");
  if (fristen.length && !aktionen.length) aktionen.push("Frist eintragen und Stellungnahme in der Akte vorbereiten.");
  if (eeb) aktionen.unshift("Elektronisches Empfangsbekenntnis abgeben, sobald die Fristen notiert sind.");
  if (!aktionen.length) aktionen.push(match.akteId ? "Zur Kenntnis nehmen und in der E-Akte ablegen." : "Prüfen, ob eine neue Akte angelegt werden soll.");

  return {
    typ,
    dokumentArt: art,
    zusammenfassung: zusammenfassen(input.text) || input.betreff || typ,
    akteId: match.akteId,
    akteSicherheit: match.sicherheit,
    akteGrund: match.grund,
    fristen,
    termin,
    aktionen,
    eeb,
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
    const fristen: FristVorschlag[] = [];
    for (const f of res.fristen ?? []) {
      if (f.regelKey && FRIST_REGELN.some((r) => r.key === f.regelKey)) fristen.push(vorschlag(f.regelKey, ereignis, land));
      else if (f.dauer && f.einheit) fristen.push(freieFrist(f.titel ?? "Frist laut Schreiben", f.dauer, f.einheit, ereignis, land));
    }
    const match = findeAkte(`${input.betreff ?? ""}\n${input.text}`, data, [...(res.hinweiseAkte ?? []), input.von ?? ""], input.vonAdresse ?? input.von);
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
      aktionen: res.aktionen?.length ? res.aktionen : basis.aktionen,
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
      text: `Der Klagepartei wird aufgegeben, zu dem Schriftsatz der Gegenseite binnen drei Wochen Stellung zu nehmen. Termin zur mündlichen Verhandlung wird bestimmt auf Donnerstag, den ${fmtDate(addDays(today(), 41))}, 10:30 Uhr, Sitzungssaal 2.14.`,
    },
    {
      titel: "Kündigung (Arbeitsrecht)",
      von: "Mandant (per E-Mail)",
      betreff: "Kündigung erhalten",
      text: `Sehr geehrte Damen und Herren, hiermit kündigen wir das mit Ihnen bestehende Arbeitsverhältnis ordentlich zum ${fmtDate(addDays(today(), 60))}. Zugegangen am ${zust}. Gründe: Auftragsrückgang in der Abteilung Vertrieb.`,
    },
  ];
}

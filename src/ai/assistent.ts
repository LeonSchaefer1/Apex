// Apex Assistent: Support & Arbeits-Agent. Live mit Claude (Werkzeuge = Funktionen dieser App) oder offline per Absichtserkennung.
import { berechneNachRegel, FRIST_REGELN, fristDringlichkeit } from "@/core/fristen";
import { fristenImZeitraum, fristenLage } from "@/core/fristenLage";
import { berechneRvg, VV_KATALOG } from "@/core/rvg";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { search, normalize, tokenize } from "@/core/search";
import { addDays, fmtDate, fmtDateWd, fmtEUR, nowLocal, relDays, today, uid } from "@/core/dates";
import { WIKI } from "@/content/wiki";
import { NAV } from "@/app/nav";
import { useData } from "@/store/data";
import type { Akte, Frist, SessionInfo, FristTyp, TenantData } from "@/core/types";
import { DemoModus, llmAgent, type AgentTool, type LlmMessage } from "./llm";
import { bewertePraezedenz, findePraezedenzfaelle } from "./kontext";

export interface AssistentLink {
  label: string;
  to: string;
}

export interface AssistentAntwort {
  text: string;
  links: AssistentLink[];
  werkzeuge: string[];
}

export const WERKZEUG_LABEL: Record<string, string> = {
  suche_akten: "Akten durchsucht",
  akte_details: "Akte gelesen",
  fristen_liste: "Fristenkalender geprüft",
  frist_berechnen: "Frist berechnet (§ 222 ZPO)",
  frist_anlegen: "Frist eingetragen",
  rvg_berechnen: "RVG berechnet",
  rechtsprechung_suchen: "Fall-Datenbank durchsucht",
  entscheidung_erlaeutern: "Entscheidung erläutert",
  navigiere: "Bereich geöffnet",
  hilfe_artikel: "Wiki durchsucht",
  ansprechpartner: "Ansprechpartner abgerufen",
  rueckruf_anfordern: "Rückruf angefordert",
  posteingang_status: "Posteingang geprüft",
  tagesbriefing: "Tag zusammengefasst",
};

interface Kontext {
  sitzung: SessionInfo;
  nav: (to: string) => void;
  links: AssistentLink[];
  werkzeuge: string[];
}

function daten() {
  return useData.getState().data;
}

function mandantName(d: TenantData, a: Akte) {
  return d.kontakte.find((k) => k.id === a.mandantId)?.name;
}

function findeAkteNachAz(az: string): Akte | undefined {
  const d = daten();
  const n = az.replace(/\s/g, "").toLowerCase();
  if (!n) return undefined;
  const exakt = d.akten.find((a) => a.aktenzeichen.toLowerCase() === n || (/^\d+$/.test(n.split("/")[0]) && a.aktenzeichen.split("/")[0] === n.split("/")[0]));
  if (exakt) return exakt;
  if (/^\d{2,3}(\/\d{2})?$/.test(n)) return undefined; // ein unbekanntes Aktenzeichen nicht „ähnlich“ auflösen
  return search(d.akten, az, [{ get: (a) => a.aktenzeichen, weight: 4 }, { get: (a) => a.titel, weight: 3 }, { get: (a) => mandantName(d, a), weight: 2 }], 1)[0]?.item;
}

function naechsteFrist(akteId: string) {
  return daten().fristen.filter((f) => f.akteId === akteId && f.status === "offen" && f.typ !== "vorfrist").sort((a, b) => a.datum.localeCompare(b.datum))[0];
}

/** Anzahl mit Singular/Plural: anz(1, "Frist", "Fristen") → „eine Frist“, anz(3, …) → „3 Fristen“. */
function anz(n: number, sing: string, plur: string, eins = "eine"): string {
  return n === 1 ? `${eins} ${sing}` : `${n} ${plur}`;
}

// ───────────── Bereiche der App (Navigation & Bedienfragen) ─────────────

interface Bereich {
  label: string;
  to: string;
  /** Wo man den Bereich findet (für „Wo finde ich …?“) */
  ort: string;
  beschreibung: string;
  worte: string[];
}

const BEREICHE: Bereich[] = [
  ...NAV.map((n) => ({ label: n.label, to: n.to, ort: `in der Seitenleiste unter „${n.label}“`, beschreibung: n.beschreibung, worte: [n.label, n.kurz ?? "", n.to.slice(1).replace(/-/g, " ")].filter(Boolean) })),
  { label: "Fristenrechner", to: "/fristen?rechner=1", ort: "unter „Fristen“ → „Frist berechnen“", beschreibung: "Berechnet gesetzliche Fristen nach §§ 187, 188 BGB und § 222 ZPO – mit Feiertagen Ihres Bundeslands und vollständigem Rechenweg.", worte: ["Fristenrechner", "Frist berechnen", "Fristberechnung"] },
  { label: "Fristenkalender", to: "/fristen", ort: "in der Seitenleiste unter „Fristen“", beschreibung: "Alle Fristen, Vorfristen und Termine mit Vier-Augen-Kontrolle.", worte: ["Fristenkalender", "Kalender"] },
  { label: "Neue Akte (Mandatsaufnahme)", to: "/akten?neu=1", ort: "unter „Akten“ → „Neue Akte“", beschreibung: "Die Mandatsaufnahme führt in vier Schritten durch Mandant, Sache, Rechtsschutz und Zusammenfassung – Vollmacht, Mandatsbestätigung und Datenschutzhinweise entstehen automatisch.", worte: ["Mandatsaufnahme", "Neue Akte", "Akte anlegen", "neues Mandat"] },
  { label: "RVG-Rechner", to: "/abrechnung?tab=rvg", ort: "unter „Abrechnung“ → „RVG-Rechner“", beschreibung: "Gebühren nach RVG mit Anrechnung, Auslagenpauschale und Umsatzsteuer.", worte: ["RVG-Rechner", "RVG Rechner", "Gebührenrechner"] },
  { label: "Bankabgleich", to: "/abrechnung?tab=bank", ort: "unter „Abrechnung“ → „Bankabgleich“", beschreibung: "Kontoumsätze werden automatisch Rechnungen und Aktenkonten zugeordnet.", worte: ["Bankabgleich", "Kontoumsätze", "Bankumsätze"] },
  { label: "Rechnungen", to: "/abrechnung?tab=rechnungen", ort: "unter „Abrechnung“ → „Rechnungen“", beschreibung: "Alle Rechnungen mit Status – auch als Sammelabrechnung und XRechnung.", worte: ["Rechnungen", "Sammelabrechnung"] },
  { label: "Forderungskonto", to: "/abrechnung?tab=forderung", ort: "unter „Abrechnung“ → „Forderungskonto“", beschreibung: "Zinsen taggenau nach § 288 BGB, Verrechnung nach § 367 BGB.", worte: ["Forderungskonto"] },
  { label: "Zeiterfassung", to: "/abrechnung?tab=zeit", ort: "unter „Abrechnung“ → „Zeiterfassung“", beschreibung: "Zeiten je Akte erfassen und abrechnen.", worte: ["Zeiterfassung"] },
  { label: "Team & Zugänge", to: "/einstellungen?tab=team", ort: "unter „Einstellungen“ → „Team“", beschreibung: "Kolleginnen und Kollegen mit Rolle anlegen und Zugänge verwalten.", worte: ["Team", "Zugänge", "Benutzer", "Mitarbeiter"] },
  { label: "Lizenz", to: "/einstellungen?tab=lizenz", ort: "unter „Einstellungen“ → „Lizenz“", beschreibung: "Ihre Lifetime-Lizenz mit Arbeitsplätzen und Lizenznummer.", worte: ["Lizenz"] },
  { label: "KI-Einstellungen", to: "/einstellungen?tab=ki", ort: "unter „Einstellungen“ → „KI“", beschreibung: "Live-KI oder Präsentationsmodus mit Demo-KI.", worte: ["KI-Einstellungen", "KI Einstellungen"] },
  { label: "Darstellung", to: "/einstellungen?tab=darstellung", ort: "unter „Einstellungen“ → „Darstellung“", beschreibung: "Hell- oder Dunkelmodus und Zeilendichte.", worte: ["Darstellung", "Dunkelmodus", "Dark Mode"] },
  { label: "Datenschutz", to: "/einstellungen?tab=datenschutz", ort: "unter „Einstellungen“ → „Datenschutz“", beschreibung: "Datenschutz-Einstellungen und Demodaten zurücksetzen.", worte: ["Datenschutz"] },
  { label: "Systemstatus", to: "/hilfe", ort: "unter „Hilfe & Support“", beschreibung: "Zeigt, ob beA, E-Mail, Bank und KI verbunden sind.", worte: ["Systemstatus"] },
];

const BEREICH_WORTE = BEREICHE.flatMap((b) => b.worte.map((w) => ({ b, w: normalize(w).replace(/[^a-z0-9]+/g, " ").trim() }))).filter((x) => x.w.length >= 2);

/** Erkennt einen Bereich der App im Text (spezifischster Begriff gewinnt, ganze Wörter). */
export function findeBereich(text: string): Bereich | undefined {
  const n = ` ${normalize(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
  let best: { b: Bereich; w: string } | undefined;
  for (const x of BEREICH_WORTE) {
    if (n.includes(` ${x.w} `) && (!best || x.w.length > best.w.length)) best = x;
  }
  return best?.b;
}

const FUELLWOERTER = new Set(["bitte", "mal", "den", "die", "das", "der", "dem", "zum", "zur", "zu", "in", "mein", "meine", "meinen", "mir", "uns", "oeffnen", "anzeigen", "aufrufen", "bereich", "seite", "danke", "jetzt"]);

/** Besteht die Eingabe nur aus einem Bereichsnamen (z. B. „Einstellungen“ oder „Bankabgleich bitte“)? */
function nurBereich(text: string): Bereich | undefined {
  const rest = normalize(text).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && !FUELLWOERTER.has(w)).join(" ");
  if (!rest) return undefined;
  return BEREICH_WORTE.find((x) => x.w === rest)?.b;
}

/** Werkzeuge = echte Funktionen der App, die die KI aufrufen darf. */
const PRIORITAET = ["hilfe_artikel", "fristen_liste", "suche_akten", "akte_details", "frist_berechnen", "frist_anlegen", "navigiere", "ansprechpartner", "rueckruf_anfordern", "entscheidung_erlaeutern", "rechtsprechung_suchen", "rvg_berechnen", "posteingang_status"];

export function werkzeuge(ctx: Kontext): AgentTool[] {
  return alleWerkzeuge(ctx).sort((a, b) => PRIORITAET.indexOf(a.name) - PRIORITAET.indexOf(b.name));
}

type Zeitraum = "heute" | "morgen" | "woche" | "monat";

interface FristEintrag {
  titel: string;
  typ: FristTyp;
  datum: string;
  relativ: string;
  dringlichkeit: ReturnType<typeof fristDringlichkeit>;
  akte: string;
  grundlage: string | null;
}

export interface FristenListe {
  zeitraum: Zeitraum;
  /** Gesamtzahl der Fristen im Zeitraum (Notfristen, Fristen, Wiedervorlagen – ohne Vorfristen und Termine) */
  anzahl: number;
  /** davon überfällig (nur „heute“: fällig = heute + überfällig) */
  ueberfaellig: number;
  /** davon Notfristen */
  notfristen: number;
  /** Vorfristen im Zeitraum – gesondert, nicht in anzahl enthalten */
  vorfristen: number;
  /** Termine im Zeitraum – gesondert, nicht in anzahl enthalten */
  termine: number;
  /** die dringendsten Einträge (höchstens 12) */
  eintraege: FristEintrag[];
  /** nicht aufgeführte weitere Fristen */
  weitere: number;
}

/** Fristen eines Zeitraums – mit derselben Zählweise wie Cockpit, Seitenleiste und Fristenkalender (fristenLage). */
export function fristenListe(d: TenantData, zeitraum: Zeitraum, heute: string, nurFuer?: string): FristenListe {
  const lage = fristenLage(d.fristen, heute, nurFuer);
  let fristen: Frist[];
  let vorfristen: Frist[];
  let termine: Frist[];
  if (zeitraum === "heute") {
    const z = fristenImZeitraum(d.fristen, heute, heute, nurFuer);
    fristen = lage.faellig;
    vorfristen = lage.vorfristen;
    termine = z.termine;
  } else {
    const von = addDays(heute, 1);
    const bis = zeitraum === "morgen" ? addDays(heute, 1) : zeitraum === "monat" ? addDays(heute, 30) : addDays(heute, 7);
    const z = fristenImZeitraum(d.fristen, von, bis, nurFuer);
    fristen = zeitraum === "woche" ? lage.woche : z.fristen;
    vorfristen = z.vorfristen;
    termine = z.termine;
  }
  const eintraege = fristen.slice(0, 12).map((f) => {
    const a = d.akten.find((x) => x.id === f.akteId);
    return { titel: f.titel, typ: f.typ, datum: fmtDateWd(f.datum), relativ: relDays(f.datum), dringlichkeit: fristDringlichkeit(f.datum, heute), akte: a ? `${a.aktenzeichen} ${a.titel}` : "", grundlage: f.grundlage ?? null };
  });
  return {
    zeitraum,
    anzahl: fristen.length,
    ueberfaellig: fristen.filter((f) => f.datum < heute).length,
    notfristen: fristen.filter((f) => f.typ === "notfrist").length,
    vorfristen: vorfristen.length,
    termine: termine.length,
    eintraege,
    weitere: Math.max(0, fristen.length - eintraege.length),
  };
}

/** Link-Vertrag zum Fristenrechner: /fristen?rechner=1&regel=<regelKey>&ereignis=<YYYY-MM-DD>&akte=<akteId> */
export function fristenrechnerLink(regelKey: string, ereignis: string, akteId?: string): string {
  const p = new URLSearchParams({ rechner: "1", regel: regelKey, ereignis });
  if (akteId) p.set("akte", akteId);
  return `/fristen?${p.toString()}`;
}

// ───────────── Argumentationshilfe zu einer Entscheidung der Fall-Datenbank ─────────────

/**
 * Argumentationsbausteine zu den Leitentscheidungen des Demo-Auszugs (kuratiert). Für andere Entscheidungen
 * entstehen die Bausteine aus Leitsatz, Bedeutung und Normen.
 */
const ARGUMENTATION: Record<string, string[]> = {
  "bag-2azr541-09": [
    "Kein Freibrief, aber Abwägung: Auch ein Bagatelldelikt kann an sich ein wichtiger Grund sein – entscheidend ist die Interessenabwägung im Einzelfall (§ 626 Abs. 1 BGB).",
    "Vertrauenskapital betonen: Eine lange, beanstandungsfreie Beschäftigung ist als erworbenes Vertrauen zu gewichten; ein einmaliger Vorfall mit geringem Schaden zehrt es nicht ohne Weiteres auf.",
    "Abmahnung als milderes Mittel: Ist eine Verhaltensänderung zu erwarten, genügt regelmäßig eine Abmahnung (Ultima-Ratio-Prinzip).",
    "Konkret vortragen: Dauer der Beschäftigung, fehlende Abmahnungen, Höhe des Schadens und Umstände der Tat (z. B. Duldung durch Vorgesetzte).",
  ],
  "bag-2azr133-18": [
    "Für die Arbeitgeberseite günstig: Aufnahmen einer rechtmäßigen offenen Videoüberwachung dürfen auch nach längerer Zeit verwertet werden.",
    "Verteidigung: Rechtmäßigkeit der Überwachung bestreiten – Hinweisschilder, Zweckbindung, Beteiligung des Betriebsrats (§ 87 Abs. 1 Nr. 6 BetrVG).",
    "Der Verwertung im Prozess ausdrücklich widersprechen, wenn die Überwachung rechtswidrig war.",
  ],
  "bag-2azr681-16": [
    "Beruht der Vorwurf auf verdeckter Überwachung ohne konkreten Verdacht, besteht ein Beweisverwertungsverbot.",
    "Der Verwertung frühzeitig widersprechen und die Anlasslosigkeit der Überwachung darlegen.",
  ],
  "bag-1abr22-21": [
    "Die Pflicht zur Arbeitszeiterfassung stützt Auskunfts- und Vorlageansprüche zu den Arbeitszeiten.",
    "Achtung: An der Darlegungslast im Überstundenprozess ändert sie nach der Rechtsprechung des BAG nichts – Stunden nach Tagen und Uhrzeiten aufstellen und Anordnung oder Duldung vortragen.",
  ],
  "bag-9azr423-16": [
    "Urlaub verfällt nur, wenn die Arbeitgeberin konkret zur Urlaubnahme aufgefordert und auf den Verfall hingewiesen hat – das muss sie beweisen.",
    "Bei Beendigung des Arbeitsverhältnisses Abgeltung des Resturlaubs (§ 7 Abs. 4 BUrlG) mitverlangen – auch im Abfindungsvergleich regeln.",
  ],
  "bgh-viiizr185-14": [
    "Unrenovierte Übergabe darlegen und beweisen (Übergabeprotokoll, Fotos, Zeugen) – die Beweislast trägt die Mieterseite.",
    "Fehlenden angemessenen Ausgleich vortragen (kein Mietnachlass, keine Renovierung durch die Vermieterin).",
    "Folge: Die Renovierungsklausel ist unwirksam – Schadensersatz wegen unterlassener Schönheitsreparaturen und eine Aufrechnung gegen die Kaution entfallen.",
  ],
  "bgh-viiizr242-13": [
    "Verlangt die Vermieterin anteilige Renovierungskosten aufgrund einer Quotenabgeltungsklausel, ist die Klausel unwirksam (§ 307 BGB).",
    "Gemeinsam mit VIII ZR 185/14 vortragen, wenn Renovierungs- und Quotenklausel kombiniert sind.",
  ],
  "bgh-viiizr180-18": [
    "Härtegründe substantiiert vortragen und mit ärztlichen Attesten belegen.",
    "Ein Sachverständigengutachten beantragen – das Gericht muss gesundheitliche Härten besonders sorgfältig aufklären.",
  ],
  "bgh-vizr53-09": [
    "Die Gleichwertigkeit der freien Werkstatt muss der Schädiger darlegen und beweisen.",
    "Unzumutbar ist der Verweis regelmäßig bei Fahrzeugen bis drei Jahre oder durchgehender Wartung in der Markenwerkstatt – Alter und Scheckheft belegen.",
  ],
  "bgh-vizr233-17": [
    "Dashcam-Aufnahmen sind trotz datenschutzrechtlicher Bedenken im Unfallprozess verwertbar – maßgeblich ist die Interessenabwägung.",
    "Aufnahme sichern (Originaldatei, Metadaten) und den Unfallhergang anhand der Standbilder konkret darstellen.",
  ],
  "bgh-vizr398-02": [
    "Bei fiktiver Abrechnung dürfen die Stundenverrechnungssätze einer markengebundenen Fachwerkstatt laut Gutachten zugrunde gelegt werden.",
    "Grenzen beachten: Ein Verweis auf eine gleichwertige freie Werkstatt ist möglich (vgl. VI ZR 53/09).",
  ],
  "bgh-iiizr183-17": [
    "Der Nutzungsvertrag geht im Wege der Gesamtrechtsnachfolge auf die Erben über (§ 1922 Abs. 1 BGB) – einschließlich der Kommunikationsinhalte.",
    "Weder das postmortale Persönlichkeitsrecht noch das Fernmeldegeheimnis oder der Datenschutz stehen dem Zugang entgegen.",
    "Erbschein vorlegen und dem Betreiber eine Frist zur Freischaltung setzen.",
  ],
  "bverfg-2bvr1616-18": [
    "Frühzeitig Zugang zu Rohmessdaten, Eichschein und Lebensakte des Messgeräts bei der Bußgeldbehörde beantragen.",
    "Bei Ablehnung gerichtliche Entscheidung beantragen (§ 62 OWiG) – der Anspruch folgt aus dem Recht auf ein faires Verfahren.",
  ],
  "bgh-xiizb601-15": [
    "Maßstab ist allein das Kindeswohl (§ 1697a BGB) – nicht der Wunsch nach Gleichverteilung zwischen den Eltern.",
    "Ein Wechselmodell setzt eine tragfähige Kommunikation und Kooperation der Eltern voraus; hohe Konfliktbelastung spricht dagegen.",
  ],
  "eugh-c65-09": [
    "Im Rahmen der Nacherfüllung muss der Verkäufer auch Ausbau der mangelhaften und Einbau der Ersatzsache leisten oder die Kosten tragen – heute § 439 Abs. 3 BGB.",
    "Voraussetzung: Die Käuferin hat die Sache gemäß ihrer Art und ihrem Verwendungszweck eingebaut.",
  ],
  "bgh-viizr46-17": [
    "Im Werkvertragsrecht kann der Besteller den Schaden nicht nach fiktiven Mängelbeseitigungskosten bemessen.",
    "Für die Unternehmerseite: Eine Aufrechnung mit fiktiven Mängelbeseitigungskosten zurückweisen. Für die Bestellerseite: Vorschuss (§ 637 Abs. 3 BGB), Minderwert oder tatsächliche Kosten verlangen.",
  ],
  "eugh-c311-18": [
    "Bei Datenübermittlungen in die USA oder andere Drittländer die Rechtsgrundlage prüfen: Angemessenheitsbeschluss (z. B. Zertifizierung des Anbieters nach dem EU-US Data Privacy Framework) oder Standardvertragsklauseln mit ergänzenden Maßnahmen.",
    "In der AVV Unterauftragsverarbeiter, Speicherorte und Zugriffsmöglichkeiten offenlegen lassen.",
  ],
};

/** Entscheidung über ihr Aktenzeichen im Text („2 AZR 541/09“, „VIII ZR 185/14“, „C-55/18“). */
export function findeEntscheidung(text: string): (typeof ENTSCHEIDUNGEN)[number] | undefined {
  const n = ` ${normalize(text).replace(/\s+/g, " ")} `;
  const passt = (az: string) => new RegExp(`[^a-z0-9]${normalize(az).replace(/\s+/g, " ").replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")}[^0-9]`).test(n);
  return ENTSCHEIDUNGEN.find((e) => e.az.split(/\s+und\s+/).some(passt));
}

/** Argumentationshilfe: Kernaussage, Bausteine, Normen und die Akten der Kanzlei, zu denen die Entscheidung passt. */
export function argumentationshilfe(e: (typeof ENTSCHEIDUNGEN)[number], d: TenantData, fuerAkte?: Akte) {
  const geheftet = d.akten.filter((a) => a.entscheidungen?.includes(e.id));
  const passend = d.akten
    .filter((a) => a.status === "offen" && !geheftet.includes(a))
    .map((a) => ({ a, t: findePraezedenzfaelle(a, d, 5).find((x) => x.entscheidung.id === e.id) }))
    .filter((x): x is { a: Akte; t: NonNullable<typeof x.t> } => !!x.t)
    .sort((x, y) => y.t.score - x.t.score);
  const akten = [
    ...(fuerAkte && !geheftet.includes(fuerAkte) && !passend.some((p) => p.a.id === fuerAkte.id) ? [{ akte: fuerAkte, geheftet: false, gemeinsam: bewertePraezedenz(fuerAkte, d, e).gemeinsam }] : []),
    ...geheftet.map((a) => ({ akte: a, geheftet: true, gemeinsam: bewertePraezedenz(a, d, e).gemeinsam })),
    ...passend.map((p) => ({ akte: p.a, geheftet: false, gemeinsam: p.t.gemeinsam })),
  ];
  if (fuerAkte) akten.sort((x, y) => Number(y.akte.id === fuerAkte.id) - Number(x.akte.id === fuerAkte.id));
  const bausteine = ARGUMENTATION[e.id] ?? [`Kernaussage für den Schriftsatz nutzen: ${e.leitsatz}`, `Praxis: ${e.bedeutung}`];
  return {
    zitat: `${e.gericht}, ${e.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(e.datum)} – ${e.az}`,
    titel: e.titel,
    leitsatz: e.leitsatz,
    bedeutung: e.bedeutung,
    normen: e.normen,
    bausteine,
    akten: akten.slice(0, 3).map((x) => ({ aktenzeichen: x.akte.aktenzeichen, titel: x.akte.titel, id: x.akte.id, geheftet: x.geheftet, gemeinsam: x.gemeinsam.slice(0, 3) })),
  };
}

/** Füllwörter, die im lockeren Rückfall der Rechtsprechungssuche nicht zählen. */
const RECHTSPRECHUNG_STOP = new Set(tokenize("wegen über sowie einer eines einem gegen ohne durch nach unter zwischen"));

function alleWerkzeuge(ctx: Kontext): AgentTool[] {
  const land = ctx.sitzung.tenant.bundesland;
  const t = (name: string) => {
    if (!ctx.werkzeuge.includes(name)) ctx.werkzeuge.push(name);
  };
  return [
    {
      name: "suche_akten",
      description: "Durchsucht die Akten der Kanzlei (Aktenzeichen, Titel, Mandant, Sachverhalt). Gibt bis zu 6 Treffer mit nächster Frist zurück.",
      inputSchema: { type: "object", properties: { suchbegriff: { type: "string" } }, required: ["suchbegriff"] },
      execute: (i) => {
        t("suche_akten");
        const d = daten();
        const hits = search(d.akten, String(i.suchbegriff ?? ""), [
          { get: (a) => a.aktenzeichen, weight: 4 }, { get: (a) => a.titel, weight: 3 }, { get: (a) => mandantName(d, a), weight: 2 },
          { get: (a) => a.beschreibung, weight: 1 }, { get: (a) => a.schlagworte.join(" "), weight: 1 },
        ], 6);
        hits.slice(0, 3).forEach((h) => ctx.links.push({ label: `Akte ${h.item.aktenzeichen}`, to: `/akten/${h.item.id}` }));
        return hits.map(({ item: a }) => {
          const f = naechsteFrist(a.id);
          return { aktenzeichen: a.aktenzeichen, titel: a.titel, sachgebiet: a.sachgebiet, phase: a.phase, status: a.status, naechsteFrist: f ? `${f.titel} am ${fmtDateWd(f.datum)}` : null };
        });
      },
    },
    {
      name: "akte_details",
      description: "Liest eine Akte über ihr Aktenzeichen (z. B. '142/26' oder '142'): Sachverhalt, Beteiligte, offene Fristen, Dokumente.",
      inputSchema: { type: "object", properties: { aktenzeichen: { type: "string" } }, required: ["aktenzeichen"] },
      execute: (i) => {
        const a = findeAkteNachAz(String(i.aktenzeichen ?? ""));
        if (!a) throw new Error(`Eine Akte „${String(i.aktenzeichen ?? "")}“ gibt es in dieser Kanzlei nicht.`);
        t("akte_details");
        const d = daten();
        ctx.links.push({ label: `Akte ${a.aktenzeichen} öffnen`, to: `/akten/${a.id}` });
        return {
          aktenzeichen: a.aktenzeichen, titel: a.titel, sachgebiet: a.sachgebiet, phase: a.phase, gegenstandswert: fmtEUR(a.gegenstandswert),
          mandant: mandantName(d, a), gegner: d.kontakte.find((k) => k.id === a.gegnerId)?.name,
          gericht: d.kontakte.find((k) => k.id === a.gerichtId)?.name, gerichtsAz: a.gerichtsAz, sachverhalt: a.beschreibung,
          offeneFristen: d.fristen.filter((f) => f.akteId === a.id && f.status === "offen" && f.typ !== "vorfrist").sort((x, y) => x.datum.localeCompare(y.datum)).map((f) => `${f.titel} – ${fmtDateWd(f.datum)} (${relDays(f.datum)})`),
          dokumente: d.dokumente.filter((x) => x.akteId === a.id).slice(0, 8).map((x) => x.name),
        };
      },
    },
    {
      name: "fristen_liste",
      description:
        "Zählt und listet offene Fristen der Kanzlei: 'heute' (heute fällig inklusive überfälliger), 'morgen', 'woche' (die sieben Tage nach heute) oder 'monat' (30 Tage nach heute). Gezählt werden Notfristen, Fristen und Wiedervorlagen – Vorfristen und Termine werden gesondert ausgewiesen. Nenne immer die Gesamtzahl aus 'anzahl'; 'eintraege' enthält nur die dringendsten (max. 12).",
      inputSchema: { type: "object", properties: { zeitraum: { type: "string", enum: ["heute", "morgen", "woche", "monat"] }, nurMeine: { type: "boolean" } }, required: ["zeitraum"] },
      execute: (i) => {
        t("fristen_liste");
        const z = (["heute", "morgen", "woche", "monat"] as const).find((x) => x === i.zeitraum) ?? "woche";
        ctx.links.push({ label: "Fristenkalender öffnen", to: "/fristen" });
        return fristenListe(daten(), z, today(), i.nurMeine ? ctx.sitzung.user.id : undefined);
      },
    },
    {
      name: "frist_berechnen",
      description: "Berechnet eine gesetzliche Frist deterministisch nach §§ 187, 188 BGB und § 222 ZPO inklusive Wochenenden und Feiertagen des Bundeslands. Gibt Fristende, Vorfrist und Rechenweg zurück.",
      inputSchema: {
        type: "object",
        properties: {
          regel: { type: "string", enum: FRIST_REGELN.map((r) => r.key), description: `Fristregel: ${FRIST_REGELN.map((r) => `${r.key}=${r.titel}`).join("; ")}` },
          ereignisDatum: { type: "string", description: "Datum des fristauslösenden Ereignisses (Zustellung, Zugang), Format YYYY-MM-DD" },
          aktenzeichen: { type: "string", description: "Optional: Aktenzeichen der Akte, für die die Frist gilt (z. B. 142/26)" },
        },
        required: ["regel", "ereignisDatum"],
      },
      execute: (i) => {
        t("frist_berechnen");
        const ereignis = String(i.ereignisDatum).slice(0, 10);
        const r = berechneNachRegel(String(i.regel), ereignis, land);
        const akte = i.aktenzeichen ? findeAkteNachAz(String(i.aktenzeichen)) : undefined;
        ctx.links.push({ label: "Im Fristenrechner öffnen", to: fristenrechnerLink(r.regel.key, ereignis, akte?.id) });
        return { frist: r.regel.titel, grundlage: r.regel.grundlage, fristende: fmtDateWd(r.ende), vorfrist: fmtDateWd(r.vorfrist), verschoben: r.verschoben, rechenweg: r.rechenweg, hinweise: r.warnungen, akte: akte ? `${akte.aktenzeichen} ${akte.titel}` : null };
      },
    },
    {
      name: "frist_anlegen",
      description: "Trägt eine Frist, Wiedervorlage oder einen Termin in eine Akte ein. Nur aufrufen, wenn der Nutzer das ausdrücklich möchte.",
      inputSchema: {
        type: "object",
        properties: { aktenzeichen: { type: "string" }, titel: { type: "string" }, datum: { type: "string", description: "YYYY-MM-DD" }, typ: { type: "string", enum: ["frist", "wiedervorlage", "termin", "notfrist"] } },
        required: ["aktenzeichen", "titel", "datum"],
      },
      execute: (i) => {
        const a = findeAkteNachAz(String(i.aktenzeichen ?? ""));
        if (!a) throw new Error(`Eine Akte „${String(i.aktenzeichen ?? "")}“ gibt es in dieser Kanzlei nicht.`);
        t("frist_anlegen");
        const datum = String(i.datum).slice(0, 10);
        const st = useData.getState();
        st.upsert("fristen", {
          id: uid("f"), akteId: a.id, titel: String(i.titel), typ: (String(i.typ ?? "wiedervorlage") as FristTyp), datum, status: "offen",
          verantwortlichId: ctx.sitzung.user.id, quelle: "ki", createdAt: nowLocal(), notiz: "Vom Apex Assistenten angelegt",
        });
        st.log({ akteur: "ki", akteId: a.id, text: `Assistent: „${i.titel}“ für ${fmtDate(datum)} eingetragen – ${a.aktenzeichen}`, minutenGespart: 2 });
        ctx.links.push({ label: `Fristen der Akte ${a.aktenzeichen}`, to: `/akten/${a.id}?tab=fristen` });
        return { ok: true, akte: `${a.aktenzeichen} ${a.titel}`, titel: i.titel, datum: fmtDateWd(datum) };
      },
    },
    {
      name: "rvg_berechnen",
      description: "Berechnet RVG-Gebühren nach der Tabelle 2025 inklusive Anrechnung, Auslagenpauschale und 19 % USt. Außergerichtlich: 2300; Klageverfahren: 3100 und 3104.",
      inputSchema: {
        type: "object",
        properties: {
          gegenstandswert: { type: "number", description: "Gegenstandswert in Euro" },
          positionen: { type: "array", items: { type: "string", enum: VV_KATALOG.map((v) => v.nr) }, description: `VV-Nummern: ${VV_KATALOG.map((v) => `${v.nr} ${v.titel}`).join("; ")}` },
        },
        required: ["gegenstandswert", "positionen"],
      },
      execute: (i) => {
        t("rvg_berechnen");
        const pos = (Array.isArray(i.positionen) ? i.positionen : ["2300"]).map((nr) => ({ nr: String(nr) }));
        const r = berechneRvg({ positionen: pos, gegenstandswert: Number(i.gegenstandswert) || 0 });
        ctx.links.push({ label: "RVG-Rechner öffnen", to: "/abrechnung?tab=rvg" });
        // Auslagenpauschale Nr. 7002 je Angelegenheit (z. B. außergerichtlich und gerichtlich getrennt)
        const zeilen = r.angelegenheiten.flatMap((a) => [
          ...a.zeilen.map((z) => `${z.nr} ${z.titel} ${String(Math.abs(z.satz)).replace(".", ",")}: ${fmtEUR(z.betrag)}`),
          ...(a.auslagenpauschale > 0 ? [`7002 Auslagenpauschale${r.angelegenheiten.length > 1 ? ` (${a.titel})` : ""}: ${fmtEUR(a.auslagenpauschale)}`] : []),
        ]);
        return { zeilen, auslagenpauschale: fmtEUR(r.auslagenpauschale), netto: fmtEUR(r.netto), ust: fmtEUR(r.ust), brutto: fmtEUR(r.brutto) };
      },
    },
    {
      name: "rechtsprechung_suchen",
      description: "Sucht passende Entscheidungen in der Fall-Datenbank (nur diese dürfen zitiert werden).",
      inputSchema: { type: "object", properties: { suchbegriffe: { type: "string" } }, required: ["suchbegriffe"] },
      execute: (i) => {
        t("rechtsprechung_suchen");
        const q = String(i.suchbegriffe ?? "");
        // Ein genanntes Aktenzeichen ist eindeutig – dann nur diese Entscheidung, keine fachfremden Beifänge
        const exakt = findeEntscheidung(q);
        let hits = exakt ? [{ item: exakt, score: 100 }] : search(ENTSCHEIDUNGEN, q, [{ get: (e) => e.az, weight: 4 }, { get: (e) => e.titel, weight: 3 }, { get: (e) => e.schlagworte.join(" "), weight: 2 }, { get: (e) => e.leitsatz, weight: 1 }], 4);
        // Mindestrelevanz: deutlich schwächere Treffer als der beste nicht zeigen
        if (!exakt && hits.length) hits = hits.filter((h) => h.score >= hits[0].score * 0.5);
        if (!hits.length) {
          // lockerer Rückfall: Anteil der Suchwörter, die vorkommen – schwächere Treffer als der beste werden nicht gezeigt
          const toks = tokenize(q).filter((x) => x.length >= 4 && !RECHTSPRECHUNG_STOP.has(x));
          const bewertet = ENTSCHEIDUNGEN.map((e) => ({ item: e, score: toks.filter((x) => normalize(`${e.titel} ${e.schlagworte.join(" ")} ${e.leitsatz}`).includes(x)).length }))
            .filter((h) => h.score > 0).sort((a, b) => b.score - a.score);
          const top = bewertet[0]?.score ?? 0;
          hits = bewertet.filter((h) => h.score >= Math.max(1, top * 0.6)).slice(0, 4);
        }
        hits.slice(0, 2).forEach((h) => ctx.links.push({ label: `${h.item.gericht} ${h.item.az}`, to: `/fall-datenbank?id=${h.item.id}` }));
        return hits.map(({ item: e }) => ({ zitat: `${e.gericht}, ${e.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(e.datum)} – ${e.az}`, titel: e.titel, rechtsgebiet: e.rechtsgebiet, leitsatz: e.leitsatz, bedeutung: e.bedeutung, normen: e.normen }));
      },
    },
    {
      name: "entscheidung_erlaeutern",
      description: "Erläutert eine Entscheidung der Fall-Datenbank für die eigene Argumentation: Kernaussage, Normen, Argumentationsbausteine und die Akten der Kanzlei, zu denen sie passt. Für Fragen wie „Wie nutze ich 2 AZR 541/09 in meiner Argumentation?“.",
      inputSchema: {
        type: "object",
        properties: { aktenzeichen: { type: "string", description: "Aktenzeichen der Entscheidung, z. B. '2 AZR 541/09'" }, akte: { type: "string", description: "Optional: Aktenzeichen der eigenen Akte, z. B. '142/26'" } },
        required: ["aktenzeichen"],
      },
      execute: (i) => {
        const e = findeEntscheidung(String(i.aktenzeichen ?? ""));
        if (!e) throw new Error(`Die Entscheidung „${String(i.aktenzeichen ?? "")}“ ist nicht im Demo-Bestand der Fall-Datenbank.`);
        t("entscheidung_erlaeutern");
        const fuer = i.akte ? findeAkteNachAz(String(i.akte)) : undefined;
        const h = argumentationshilfe(e, daten(), fuer);
        ctx.links.push({ label: `${e.gericht} ${e.az}`, to: `/fall-datenbank?id=${e.id}` });
        const erste = h.akten[0];
        if (erste) ctx.links.push({ label: `Akte ${erste.aktenzeichen}`, to: `/akten/${erste.id}` }, { label: `KI-Fallanalyse ${erste.aktenzeichen}`, to: `/ki?akte=${erste.id}` });
        return h;
      },
    },
    {
      name: "navigiere",
      description: "Öffnet einen Bereich der App (z. B. Fristen, Posteingang, Abrechnung, Bankabgleich, Fristenrechner, Einstellungen) oder eine Akte über ihr Aktenzeichen.",
      inputSchema: { type: "object", properties: { ziel: { type: "string", description: `Bereich (${BEREICHE.map((b) => b.label).join(", ")}) oder Aktenzeichen wie 142/26` } }, required: ["ziel"] },
      execute: (i) => {
        const ziel = String(i.ziel ?? "");
        const b = findeBereich(ziel);
        if (b) {
          t("navigiere");
          ctx.nav(b.to);
          return { geoeffnet: b.label, beschreibung: b.beschreibung };
        }
        const a = findeAkteNachAz(ziel.replace(/^(die\s+)?akte\s+/i, ""));
        if (a) {
          t("navigiere");
          ctx.nav(`/akten/${a.id}`);
          return { geoeffnet: `Akte ${a.aktenzeichen}`, titel: a.titel };
        }
        throw new Error(`„${ziel}“ habe ich weder als Bereich noch als Akte gefunden.`);
      },
    },
    {
      name: "hilfe_artikel",
      description: "Durchsucht das AnwaltApex-Wiki (Bedienung der Software, Funktionen, Support). Für jede Frage zur Benutzung der Software verwenden.",
      inputSchema: { type: "object", properties: { frage: { type: "string" } }, required: ["frage"] },
      execute: (i) => {
        t("hilfe_artikel");
        const list = wikiSuche(String(i.frage ?? ""));
        list.slice(0, 1).forEach((w) => w.pfad && ctx.links.push({ label: `Zu „${w.titel}“`, to: w.pfad }));
        return list.map((w) => ({ titel: w.titel, kurz: w.kurz, schritte: w.schritte.map((s) => `${s.titel}: ${s.text}`), tipps: w.tipps ?? [] }));
      },
    },
    {
      name: "ansprechpartner",
      description: "Gibt den persönlichen Ansprechpartner der Kanzlei bei AnwaltApex zurück (Name, Telefon, E-Mail, Erreichbarkeit).",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("ansprechpartner");
        ctx.links.push({ label: "Hilfe & Support", to: "/hilfe" });
        return ctx.sitzung.tenant.ansprechpartner;
      },
    },
    {
      name: "rueckruf_anfordern",
      description: "Fordert einen Rückruf des persönlichen Ansprechpartners an (Eskalation an einen Menschen).",
      inputSchema: { type: "object", properties: { thema: { type: "string" } }, required: ["thema"] },
      execute: (i) => {
        t("rueckruf_anfordern");
        useData.getState().log({ akteur: "nutzer", userId: ctx.sitzung.user.id, text: `Rückruf bei ${ctx.sitzung.tenant.ansprechpartner.name} angefordert: ${String(i.thema)}` });
        return { ok: true, ansprechpartner: ctx.sitzung.tenant.ansprechpartner.name, zusage: "Rückruf innerhalb von 30 Minuten während der Servicezeiten" };
      },
    },
    {
      name: "posteingang_status",
      description: "Zeigt neue Nachrichten im Posteingang (beA & E-Mail) inkl. KI-Status.",
      inputSchema: { type: "object", properties: {} },
      execute: () => {
        t("posteingang_status");
        const d = daten();
        // gleiche Zählweise wie das Cockpit-Briefing
        const neu = d.nachrichten.filter((n) => n.richtung === "ein" && n.status === "neu").sort((a, b) => b.eingang.localeCompare(a.eingang));
        ctx.links.push({ label: "Posteingang öffnen", to: "/posteingang" });
        return {
          neu: neu.length,
          ausgewertet: neu.filter((n) => n.kiStatus === "analysiert" || n.kiStatus === "uebernommen").length,
          wartenAufKi: neu.filter((n) => n.kiStatus === "ausstehend" || !n.kiStatus).length,
          eeb: neu.filter((n) => n.eebErforderlich && !n.eebAbgegeben).length,
          nachrichten: neu.slice(0, 6).map((n) => ({ kanal: n.kanal === "bea" ? "beA" : "E-Mail", von: n.von, betreff: n.betreff })),
        };
      },
    },
  ];
}

const FRAGEWORTE = new Set(["wie", "was", "wo", "wann", "warum", "funktioniert", "funktionieren", "geht", "kann", "ich", "man", "mache", "machen", "erklaer", "erklaere", "erkläre", "bitte", "mir", "zeig", "zeige", "gibt", "es", "eine", "einen", "richtig"]);

/** Lockere Wiki-Suche: zählt Treffer je Suchwort (Titel stärker gewichtet). */
function wikiSuche(frage: string) {
  const toks = tokenize(frage).filter((t) => !FRAGEWORTE.has(t));
  if (!toks.length) return [];
  return WIKI.map((w) => {
    const titel = normalize(`${w.titel} ${w.key}`);
    const rest = normalize(`${w.kurz} ${w.schritte.map((s) => `${s.titel} ${s.text}`).join(" ")} ${(w.tipps ?? []).join(" ")}`);
    const score = toks.reduce((s, t) => s + (titel.includes(t) ? 4 : 0) + (rest.includes(t) ? 1 : 0), 0);
    return { w, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((x) => x.w);
}

export function systemPrompt(s: SessionInfo, voice: boolean): string {
  return `Du bist „Apex“, der integrierte KI-Assistent der Kanzlei-Software AnwaltApex. Du sprichst mit ${s.user.name} (${s.user.titel}) von ${s.tenant.name} in ${s.tenant.stadt}. Heute ist ${fmtDateWd(today())}.
Du hilfst bei zwei Dingen: (1) Live-Support zur Bedienung von AnwaltApex (nutze dafür hilfe_artikel) und (2) Kanzleiarbeit mit den Daten der Kanzlei (Akten, Fristen, Posteingang, RVG, Rechtsprechung) über die Werkzeuge.
Regeln:
- Antworte auf Deutsch, knapp und freundlich, in 1–4 Sätzen oder einer kurzen Liste.${voice ? " Die Antwort wird vorgelesen: keine Tabellen, keine Markdown-Formatierung, Zahlen gut sprechbar." : " Leichtes Markdown (Fett, Listen) ist erlaubt."}
- Daten der Kanzlei immer über Werkzeuge abfragen – nie erfinden. Fristen ausschließlich mit frist_berechnen berechnen.
- Nenne bei Fristen immer die Gesamtzahl aus fristen_liste (Feld „anzahl“); die Liste „eintraege“ kann gekürzt sein. Überfällige Fristen und Vorfristen nennst du gesondert.
- Zitiere Rechtsprechung nur aus rechtsprechung_suchen oder entscheidung_erlaeutern. Fragt der Nutzer, wie er eine bestimmte Entscheidung nutzen kann, rufe entscheidung_erlaeutern auf und gib eine Argumentationshilfe (Kernaussage, Bausteine, passende Akte) – keine bloße Trefferliste.
- Ändere Daten (frist_anlegen) nur, wenn der Nutzer das ausdrücklich wünscht; bestätige danach, was du eingetragen hast.
- Kurze Antworten wie „Ja“, „Gerne“ oder „Nein“ beziehen sich auf deine letzte Rückfrage – führe dann genau das Angebotene aus.
- Wenn du nicht weiterkommst oder der Nutzer einen Menschen möchte: biete den persönlichen Ansprechpartner an und nutze rueckruf_anfordern. Formuliere ohne Pronomen für die Ansprechperson: „Ihr fester Ansprechpartner: ${s.tenant.ansprechpartner.name}“ und wiederhole bei Bedarf den Namen.
- Wenn der Nutzer einen Bereich sehen möchte, nutze navigiere.`;
}

// ───────────── Offline-Assistent (Demo-Modus) ─────────────

const MONATE: Record<string, number> = { januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };

function datumAus(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bheute\b/.test(t)) return today();
  if (/\bvorgestern\b/.test(t)) return addDays(today(), -2);
  if (/\bgestern\b/.test(t)) return addDays(today(), -1);
  if (/\bübermorgen\b|\buebermorgen\b/.test(t)) return addDays(today(), 2);
  if (/\bmorgen\b/.test(t)) return addDays(today(), 1);
  const inTagen = t.match(/in (\d+|einer|einem|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|vierzehn) (tag|tagen|woche|wochen)/);
  if (inTagen) {
    const z: Record<string, number> = { einer: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, vierzehn: 14 };
    const n = /^\d+$/.test(inTagen[1]) ? Number(inTagen[1]) : z[inTagen[1]] ?? 1;
    return addDays(today(), inTagen[2].startsWith("woche") ? n * 7 : n);
  }
  const m = t.match(/(\d{1,2})\.\s?(\d{1,2})\.?\s?(\d{2,4})?/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today().slice(0, 4));
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const m2 = t.match(/(\d{1,2})\.\s?(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/);
  if (m2) return `${today().slice(0, 4)}-${String(MONATE[m2[2]]).padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return undefined;
}

function azAus(text: string): string | undefined {
  const mitAkte = text.match(/akte\s+(?:nr\.?\s*)?(\d{2,3}(?:\s?\/\s?\d{2})?)/i)?.[1];
  if (mitAkte) return mitAkte.replace(/\s/g, "");
  const voll = text.match(/\b\d{2,3}\s?\/\s?\d{2}\b/)?.[0];
  if (voll) return voll.replace(/\s/g, "");
  return text.match(/\b(\d{3})\b(?![.,]\d|\s?(?:€|euro|tage|wochen|%))/i)?.[1];
}

/** Wörter, die beim Erkennen einer Akte über den Namen nicht zählen. */
const AKTEN_STOP = new Set(tokenize(
  "chancen sache akte akten fallanalyse erfolgsaussicht erfolgsaussichten stehen gewinnen wiedervorlage frist fristen termin termine erinnerung lege leg trag trage eintragen erstelle setze setz anlegen tagen tage woche wochen monat heute morgen übermorgen drei zwei vier fünf sechs sieben zehn vierzehn bitte einen eine einer mandant mandantin mandanten wie was wann starte start analyse prüfe pruefe öffne oeffne zeige zeig details stand",
));

/** Akte aus dem Text: Aktenzeichen oder eindeutiger Name (Mandant/Titel). */
function akteAusText(text: string): Akte | undefined {
  const az = azAus(text);
  if (az) {
    const a = findeAkteNachAz(az);
    if (a) return a;
  }
  const d = daten();
  const offen = d.akten.filter((a) => a.status !== "abgeschlossen");
  for (const tok of tokenize(text).filter((t) => t.length >= 4 && !AKTEN_STOP.has(t))) {
    const hits = search(offen, tok, [{ get: (a) => a.titel, weight: 3 }, { get: (a) => mandantName(d, a), weight: 3 }], 3);
    if (hits.length === 1 || (hits.length > 1 && hits[0].score > hits[1].score)) return hits[0].item;
  }
  return undefined;
}

/** Ein Aktenzeichen, das es in dieser Kanzlei wirklich gibt – für Beispiele in Antworten. */
function beispielAz(): string {
  const d = daten();
  const a = d.akten.find((x) => x.status === "offen" && x.prioritaet === "hoch") ?? d.akten.find((x) => x.status === "offen") ?? d.akten[0];
  return a?.aktenzeichen ?? "142/26";
}

function regelAus(text: string): string | undefined {
  const t = normalize(text);
  if (/berufungsbegrund/.test(t)) return "berufungsbegruendung";
  if (/revision/.test(t)) return "revision";
  if (/berufung/.test(t)) return /arbeitsgericht/.test(t) ? "berufung_arbg" : "berufung";
  if (/versaeumnisurteil/.test(t)) return "einspruch_vu";
  if (/strafbefehl/.test(t)) return "einspruch_strafbefehl";
  if (/bussgeld/.test(t)) return "einspruch_bussgeld";
  if (/mahnbescheid/.test(t)) return "widerspruch_mb";
  if (/vollstreckungsbescheid/.test(t)) return "einspruch_vb";
  if (/kuendigungsschutz|kschg|kuendigung/.test(t)) return "kschg_klage";
  if (/beschwerde/.test(t)) return "sofortige_beschwerde";
  if (/verjaehr/.test(t)) return "regelverjaehrung";
  if (/widerspruch/.test(t)) return "widerspruch_va";
  return undefined;
}

function liste(items: string[]): string {
  return items.map((x) => `• ${x}`).join("\n");
}

// ── Gesprächskontext: Rückfragen des Assistenten und kurze Antworten darauf ──

type Rueckfrage = "rueckruf" | "akte" | "datum" | "akte-analyse";

const RUECKFRAGEN: [Rueckfrage, RegExp][] = [
  ["rueckruf", /soll ich einen rückruf anfordern\?/i],
  ["akte", /^für welche akte soll ich das eintragen\?/i],
  ["datum", /^zu welchem datum\?/i],
  ["akte-analyse", /^für welche akte soll ich die fallanalyse/i],
];

function rueckfrageIn(text: string | undefined): Rueckfrage | undefined {
  if (!text) return undefined;
  return RUECKFRAGEN.find(([, re]) => re.test(text.trim()))?.[0];
}

const ZUSTIMMUNG = /^(ja|jo|jep|jawohl|gern|gerne|bitte|ok|okay|klar|genau|einverstanden|unbedingt|auf jeden fall|mach das|mach mal|machen sie das|sehr gerne?|ja bitte|ja gerne|ja gern|bitte ja|ja klar|ja mach das|ja das waere toll|ja das wäre toll|ja bitte gerne)$/;
const ABLEHNUNG = /^(nein|nee|ne|nö|noe|nicht noetig|nicht nötig|lieber nicht|nein danke|danke nein|nein danke nicht noetig|kein bedarf|spaeter|später|jetzt nicht|nein jetzt nicht)$/;
const GRUSS = /^(hallo|hi|hey|moin|moin moin|servus|guten morgen|guten tag|guten abend|grüß gott|gruess gott|grüezi)\b[\s,!.]*/;
const DANK = /^(danke|danke schön|dankeschön|vielen dank|danke sehr|super danke|perfekt danke|prima danke|toll danke|klasse danke|danke dir|danke ihnen)$/;
const ABSCHIED = /^(tschüss|tschuess|ciao|bis bald|bis später|auf wiedersehen|bye)$/;

function kurzform(text: string): string {
  return text.toLowerCase().replace(/[!.?,;:„“"]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Antwortet der Nutzer auf eine Rückfrage nach fehlenden Angaben (Akte, Datum), wird die ursprüngliche Bitte mit den
 * Antworten zusammengeführt – z. B. „Lege eine Wiedervorlage an“ → „Für welche Akte …?“ → „142/26“.
 */
function zusammengefuehrt(verlauf: LlmMessage[]): string | undefined {
  let i = verlauf.length - 1;
  const teile = [verlauf[i]?.content ?? ""];
  let ergaenzt = false;
  while (i >= 2 && verlauf[i - 1].role === "assistant" && verlauf[i - 2].role === "user") {
    const r = rueckfrageIn(verlauf[i - 1].content);
    if (r !== "akte" && r !== "datum" && r !== "akte-analyse") break;
    teile.unshift(verlauf[i - 2].content);
    ergaenzt = true;
    i -= 2;
  }
  return ergaenzt ? teile.join(" ") : undefined;
}

/** Vorschläge für den leeren Assistenten – aus den tatsächlichen Daten der Kanzlei (keine festen Aktenzeichen). */
export const VORSCHLAEGE = [
  "Was steht heute an?",
  "Welche Fristen laufen diese Woche ab?",
  "Berechne die Berufungsfrist bei Zustellung heute",
  "Wie lege ich eine neue Akte an?",
  "Urteile zu Kündigung wegen Bagatelle",
  "Wie funktioniert der Bankabgleich?",
  "RVG für 10.000 € außergerichtlich",
  "Ich möchte mit meinem Ansprechpartner sprechen",
];

export function vorschlaege(data: TenantData = daten()): string[] {
  const offen = data.akten.filter((a) => a.status === "offen");
  const akte =
    offen.find((a) => a.id.startsWith("hero-") && a.prioritaet === "hoch") ??
    [...offen].filter((a) => a.prioritaet === "hoch").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
    [...offen].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!akte) return VORSCHLAEGE;
  return VORSCHLAEGE.map((v) => (v === "Wie lege ich eine neue Akte an?" ? `Öffne die Akte ${akte.aktenzeichen}` : v));
}

function fristZeile(f: FristEintrag): string {
  return `${f.datum}: ${f.titel}${f.typ === "notfrist" ? " (Notfrist)" : ""}${f.akte ? ` – ${f.akte}` : ""}`;
}

/** Zusatzsätze zu Vorfristen und Terminen (nicht in der Fristenzahl enthalten). */
function zusatz(l: FristenListe, wann: string): string {
  const s: string[] = [];
  if (l.vorfristen) s.push(`${l.vorfristen === 1 ? "Eine Vorfrist erinnert" : `${l.vorfristen} Vorfristen erinnern`} ${wann} an kommende Fristen.`);
  if (l.termine) s.push(`Außerdem ${l.termine === 1 ? "steht ein Termin" : `stehen ${l.termine} Termine`} ${wann === "heute" ? "heute" : wann} an.`);
  return s.length ? `\n${s.join(" ")}` : "";
}

async function demoAntwort(frage: string, ctx: Kontext, verlauf: LlmMessage[] = []): Promise<string> {
  const tools = Object.fromEntries(werkzeuge(ctx).map((t) => [t.name, t]));
  const run = async (name: string, input: Record<string, unknown> = {}) => tools[name].execute(input) as Promise<never> | never;
  await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));
  const ap = ctx.sitzung.tenant.ansprechpartner;

  // ── Gesprächskontext ──
  const vorher = verlauf.length >= 2 && verlauf[verlauf.length - 2].role === "assistant" ? verlauf[verlauf.length - 2].content : undefined;
  const offeneRueckfrage = rueckfrageIn(vorher);
  const kurz = kurzform(frage);

  if (offeneRueckfrage === "rueckruf" && (ZUSTIMMUNG.test(kurz) || (/^(ja|gern|gerne|bitte|ok|okay|klar)\b/.test(kurz) && !/^(ja|bitte)? ?(nein|nicht)\b/.test(kurz)))) {
    const vorherFrage = verlauf.length >= 3 ? verlauf[verlauf.length - 3].content : "";
    await run("ansprechpartner");
    await run("rueckruf_anfordern", { thema: vorherFrage || "Rückruf gewünscht" });
    return `Erledigt: Ich habe einen Rückruf bei ${ap.name} angefordert – in der Regel meldet sich ${ap.name} innerhalb von 30 Minuten (${ap.verfuegbar}). Direkt erreichbar unter ${ap.telefon}.`;
  }
  if (offeneRueckfrage === "rueckruf" && (ABLEHNUNG.test(kurz) || /^(nein|nee|lieber nicht)\b/.test(kurz))) {
    return `Alles klar, kein Rückruf. ${ap.name} ist jederzeit direkt erreichbar unter ${ap.telefon} oder ${ap.email} (${ap.verfuegbar}).`;
  }
  // Antwort auf „Für welche Akte …?“ bzw. „Zu welchem Datum?“ – nur, wenn sie die erfragte Angabe auch enthält
  const vollstaendig = zusammengefuehrt(verlauf);
  const liefertAngabe = offeneRueckfrage === "datum" ? /^(am|zum|bis|in|ab|heute|morgen|übermorgen|uebermorgen|\d)/.test(kurz) && !!datumAus(kurz) : !!akteAusText(frage);
  if (vollstaendig && liefertAngabe) return demoAntwort(vollstaendig, ctx, []);
  if (ZUSTIMMUNG.test(kurz) || ABLEHNUNG.test(kurz)) {
    return ZUSTIMMUNG.test(kurz)
      ? "Gern – wobei darf ich helfen? Zum Beispiel: „Was steht heute an?“, „Welche Fristen laufen diese Woche ab?“ oder „Wie funktioniert der Bankabgleich?“"
      : "Alles klar. Sagen Sie einfach Bescheid, wenn ich etwas für Sie tun kann.";
  }

  // ── Smalltalk ──
  const ohneGruss = frage.replace(new RegExp(GRUSS.source, "i"), "").trim();
  if (GRUSS.test(kurz) && !kurzform(ohneGruss)) {
    return `Hallo! Ich bin Apex, Ihr Assistent in AnwaltApex. Ich kann Fristen prüfen, Akten öffnen, Fristen berechnen, RVG-Gebühren ausrechnen, Urteile finden oder die Bedienung erklären. Womit fange ich an?`;
  }
  if (DANK.test(kurz)) return "Gern geschehen! Wenn noch etwas ist – einfach fragen.";
  if (ABSCHIED.test(kurz)) return "Bis bald! Ich bin jederzeit unten rechts für Sie da.";
  if (ohneGruss !== frage && ohneGruss) return demoAntwort(ohneGruss, ctx, []);

  const q = frage.toLowerCase();

  // ── Nur ein Bereichsname („Einstellungen“, „Bankabgleich“) → Bereich öffnen; danach Mensch / Ansprechpartner ──
  const bereichAllein = nurBereich(frage);
  if (bereichAllein) {
    const r = (await run("navigiere", { ziel: bereichAllein.label })) as { geoeffnet: string; beschreibung: string };
    return `Ich habe „${r.geoeffnet}“ für Sie geöffnet. ${r.beschreibung}`;
  }
  if (/ansprechpartner|ansprechperson|mensch|rückruf|rueckruf|hotline|anrufen|support|kontakt zu (euch|ihnen)/.test(q) || normalize(q).includes(normalize(ap.name))) {
    const a = (await run("ansprechpartner")) as { name: string; telefon: string; email: string; verfuegbar: string };
    if (/rückruf|rueckruf|ruf.*an\b|anrufen/.test(q)) {
      await run("rueckruf_anfordern", { thema: frage });
      return `Erledigt: Ich habe einen Rückruf bei ${a.name} angefordert – in der Regel meldet sich ${a.name} innerhalb von 30 Minuten (${a.verfuegbar}). Direkt erreichbar unter ${a.telefon}.`;
    }
    return `Ihr fester Ansprechpartner: ${a.name} – direkt erreichbar unter ${a.telefon} oder ${a.email} (${a.verfuegbar}), ohne Warteschleife. Soll ich einen Rückruf anfordern?`;
  }

  // ── Tagesbriefing ──
  if (/was steht (heute )?an|mein tag|briefing|überblick|ueberblick|zusammenfassung des tages|was ist heute/.test(q)) {
    if (!ctx.werkzeuge.includes("tagesbriefing")) ctx.werkzeuge.push("tagesbriefing");
    const heute = (await run("fristen_liste", { zeitraum: "heute" })) as FristenListe;
    const woche = (await run("fristen_liste", { zeitraum: "woche" })) as FristenListe;
    const post = (await run("posteingang_status")) as { neu: number; ausgewertet: number; wartenAufKi: number; eeb: number };
    const s: string[] = [];
    const zuerst = heute.eintraege[0];
    if (heute.anzahl) {
      s.push(`Heute ${heute.anzahl === 1 ? "ist eine Frist" : `sind ${heute.anzahl} Fristen`} fällig${heute.ueberfaellig ? ` (davon ${heute.ueberfaellig} überfällig)` : ""}${zuerst ? ` – zuerst „${zuerst.titel}“${zuerst.akte ? ` (${zuerst.akte})` : ""}` : ""}.`);
    } else s.push("Heute ist keine Frist fällig.");
    s.push(woche.anzahl ? `In den nächsten sieben Tagen folgen ${woche.anzahl} weitere${woche.notfristen ? `, darunter ${anz(woche.notfristen, "Notfrist", "Notfristen")}` : ""}.` : "In den nächsten sieben Tagen sind keine weiteren Fristen notiert.");
    if (heute.vorfristen) s.push(`${heute.vorfristen === 1 ? "Eine Vorfrist erinnert" : `${heute.vorfristen} Vorfristen erinnern`} heute an kommende Fristen.`);
    if (post.neu === 0) s.push("Der Posteingang ist aufgeräumt.");
    else {
      const ki = post.ausgewertet && post.wartenAufKi
        ? ` – ${post.ausgewertet} hat die KI bereits ausgewertet, ${post.wartenAufKi} ${post.wartenAufKi === 1 ? "wartet" : "warten"} noch auf die KI-Analyse`
        : post.wartenAufKi ? ` – ${post.wartenAufKi === 1 ? "sie wartet" : "alle warten"} noch auf die KI-Analyse` : " – die KI hat bereits alle ausgewertet";
      s.push(`Im Posteingang ${post.neu === 1 ? "wartet eine neue Nachricht" : `warten ${post.neu} neue Nachrichten`}${ki}${post.eeb ? `, darunter ${anz(post.eeb, "Zustellung", "Zustellungen")} gegen eEB` : ""}.`);
    }
    return s.join(" ");
  }

  // ── Posteingang ──
  if (/posteingang|neue (post|nachrichten|mails?)|\bbea\b/.test(q) && !/\bwie\b|\bwo\b/.test(q)) {
    const p = (await run("posteingang_status")) as { neu: number; nachrichten: { kanal: string; von: string; betreff: string }[] };
    if (!p.neu) return "Im Posteingang gibt es keine neuen Nachrichten.";
    return `Sie haben ${anz(p.neu, "neue Nachricht", "neue Nachrichten")}:\n${liste(p.nachrichten.slice(0, 4).map((n) => `${n.kanal} von ${n.von}: ${n.betreff}`))}${p.neu > 4 ? `\n… und ${p.neu - 4} weitere.` : ""}`;
  }

  // ── „Wo finde ich …?“ ──
  const bereich = findeBereich(frage);
  if (bereich && /\bwo (finde|ist|sind|kann|stelle|richte)|\bwo\b.*\b(finden|einstellen)\b/.test(q)) {
    ctx.links.push({ label: `Zu „${bereich.label}“`, to: bereich.to });
    return `„${bereich.label}“ finden Sie ${bereich.ort}. ${bereich.beschreibung}`;
  }

  // ── Navigation mit Verb („Öffne den Bankabgleich“) ──
  const navVerb = /^(bitte\s+)?(öffne|oeffne|geh|gehe|wechsle|navigiere|bring mich|springe|zeig|zeige)\b/.test(q);
  const fristenFrage = /heute|morgen|woche|monat|meine|nächste|naechste|anstehend|fällig|faellig/.test(q);
  if (navVerb && bereich && !(bereich.to === "/fristen" && (fristenFrage || /^(bitte\s+)?zeig/.test(q)))) {
    const r = (await run("navigiere", { ziel: bereich.label })) as { geoeffnet: string };
    return `Ich habe „${r.geoeffnet}“ für Sie geöffnet.`;
  }

  // ── Argumentationshilfe zu einer bestimmten Entscheidung (z. B. aus der Fall-Datenbank „Mit dem Assistenten besprechen“) ──
  const entscheidung = findeEntscheidung(frage);
  if (entscheidung && !/(lege|leg |trag|erstelle|setz).*(frist|wiedervorlage|termin)/.test(q)) {
    const fuer = /\bakte\b/.test(q) && azAus(q.replace(entscheidung.az.toLowerCase(), " ")) ? findeAkteNachAz(azAus(q.replace(entscheidung.az.toLowerCase(), " "))!) : undefined;
    const h = (await run("entscheidung_erlaeutern", { aktenzeichen: entscheidung.az, akte: fuer?.aktenzeichen })) as ReturnType<typeof argumentationshilfe>;
    const akteZeile = h.akten.length
      ? `\nPasst zu Akte ${h.akten[0].aktenzeichen} ${h.akten[0].titel}${h.akten[0].geheftet ? " (angeheftet)" : ""}${h.akten[0].gemeinsam.length ? ` – gemeinsame Merkmale: ${h.akten[0].gemeinsam.join(", ")}` : ""}.${h.akten.length > 1 ? ` Außerdem: ${h.akten.slice(1).map((a) => a.aktenzeichen).join(", ")}.` : ""}`
      : "";
    const titel = h.titel.includes("„") ? h.titel : `„${h.titel}“`;
    return `**So nutzen Sie ${h.zitat} (${titel}):**\nKernaussage: ${h.leitsatz}\n${liste(h.bausteine)}\nNormen: ${h.normen.join(", ")}.${akteZeile}\nVor Verwendung im Schriftsatz bitte im Original prüfen.`;
  }

  // ── Frist berechnen ──
  const regel = regelAus(q);
  if (regel && /(berechne|wann|bis wann|frist|endet|ablauf)/.test(q) && !/(lege|leg |trag|erstelle)/.test(q)) {
    const datum = datumAus(q) ?? today();
    const akte = azAus(q) ? findeAkteNachAz(azAus(q)!) : undefined;
    const r = (await run("frist_berechnen", { regel, ereignisDatum: datum, aktenzeichen: akte?.aktenzeichen })) as { frist: string; grundlage: string; fristende: string; vorfrist: string; verschoben: boolean; hinweise: string[] };
    return `Die ${r.frist} (${r.grundlage}) endet am **${r.fristende}**, ausgehend vom ${fmtDate(datum)}.${r.verschoben ? " Das rechnerische Ende fiel auf ein Wochenende oder einen Feiertag – deshalb verschoben nach § 222 Abs. 2 ZPO." : ""} Vorfrist: ${r.vorfrist}. Den vollständigen Rechenweg sehen Sie im Fristenrechner.${r.hinweise.length ? ` Hinweis: ${r.hinweise[0]}` : ""}`;
  }

  // ── Frist / Wiedervorlage anlegen ──
  if (/(lege|leg |trag|erstelle|setz).*(frist|wiedervorlage|termin|erinnerung)|(frist|wiedervorlage|termin).*(an|ein)legen/.test(q)) {
    const akte = akteAusText(q);
    const datum = datumAus(q);
    if (!akte) {
      return azAus(q)
        ? `Für welche Akte soll ich das eintragen? Eine Akte ${azAus(q)} habe ich in Ihrer Kanzlei nicht gefunden – nennen Sie mir bitte das Aktenzeichen, z. B. „${beispielAz()}“.`
        : `Für welche Akte soll ich das eintragen? Nennen Sie mir bitte das Aktenzeichen, z. B. „${beispielAz()}“.`;
    }
    if (!datum) return "Zu welchem Datum? Sagen Sie z. B. „in drei Tagen“ oder „am 30.10.“.";
    const typ = /termin/.test(q) ? "termin" : /frist/.test(q) && !/wiedervorlage/.test(q) ? "frist" : "wiedervorlage";
    const titel = typ === "termin" ? "Termin" : typ === "frist" ? "Frist (manuell)" : "Wiedervorlage";
    const r = (await run("frist_anlegen", { aktenzeichen: akte.aktenzeichen, titel, datum, typ })) as { akte: string; datum: string };
    return `Erledigt: ${titel} für ${r.akte} am ${r.datum} eingetragen. Sie finden den Eintrag im Fristenkalender.`;
  }

  // ── Fristen auflisten ──
  if (/frist|termin|wiedervorlage/.test(q) && !/^(wie|wo)\b/.test(q)) {
    const zeitraum: Zeitraum = /heute/.test(q) ? "heute" : /morgen/.test(q) ? "morgen" : /monat/.test(q) ? "monat" : "woche";
    const l = (await run("fristen_liste", { zeitraum, nurMeine: /\bmeine\b/.test(q) })) as FristenListe;
    const fuer = /\bmeine\b/.test(q) ? " für Sie" : "";
    const top = l.eintraege.slice(0, 6);
    const rest = l.anzahl - top.length;
    const aufzaehlung = top.length ? `\n${liste(top.map(fristZeile))}${rest > 0 ? `\n… und ${rest} weitere.` : ""}` : "";
    if (zeitraum === "heute") {
      if (!l.anzahl) return `Heute ist${fuer} keine Frist fällig.${zusatz(l, "heute")}`;
      return `Heute ${l.anzahl === 1 ? "ist" : "sind"}${fuer} ${anz(l.anzahl, "Frist", "Fristen")} fällig${l.ueberfaellig ? ` (davon ${l.ueberfaellig} überfällig)` : ""}:${aufzaehlung}${zusatz(l, "heute")}`;
    }
    const label = zeitraum === "morgen" ? "morgen" : zeitraum === "monat" ? "in den nächsten 30 Tagen" : "in den nächsten sieben Tagen";
    let text: string;
    if (!l.anzahl) text = `${label.charAt(0).toUpperCase() + label.slice(1)} laufen${fuer} keine Fristen ab.`;
    else text = `${label.charAt(0).toUpperCase() + label.slice(1)} ${l.anzahl === 1 ? "läuft" : "laufen"}${fuer} ${anz(l.anzahl, "Frist", "Fristen")} ab${l.notfristen ? `, darunter ${anz(l.notfristen, "Notfrist", "Notfristen")}` : ""}${top.length < l.anzahl ? `. Die dringendsten:` : ":"}${aufzaehlung}`;
    text += zusatz(l, label);
    if (zeitraum === "woche") {
      const h = (await run("fristen_liste", { zeitraum: "heute", nurMeine: /\bmeine\b/.test(q) })) as FristenListe;
      if (h.anzahl) text += `\nDazu ${h.anzahl === 1 ? "kommt eine heute fällige Frist" : `kommen ${h.anzahl} heute fällige Fristen`}${h.ueberfaellig ? ` (davon ${h.ueberfaellig} überfällig)` : ""}.`;
    }
    return text;
  }

  // ── RVG ──
  if (/rvg|gebühr|gebuehr|honorar/.test(q) && /\d/.test(q)) {
    const wert = Number((q.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?\s*(€|euro|eur)?/)?.[1] ?? "0").replace(/[.\s]/g, ""));
    const pos = /au(ß|ss)ergerichtlich/.test(q) ? ["2300"] : /gericht|klage|prozess|verfahren/.test(q) ? ["3100", "3104"] : ["2300"];
    const r = (await run("rvg_berechnen", { gegenstandswert: wert, positionen: pos })) as { zeilen: string[]; brutto: string; netto: string };
    return `Bei einem Gegenstandswert von ${fmtEUR(wert, { cents: false })}:\n${liste(r.zeilen)}\nGesamt ${r.netto} netto, ${r.brutto} brutto inkl. 19 % USt.`;
  }

  // ── Rechtsprechung ──
  if (/urteil|rechtsprechung|präzedenz|praezedenz|\bbgh\b|\bbag\b|entscheidung|gericht hat/.test(q)) {
    const begriffe = frage.replace(/(such|finde|zeig|gibt es|mir|bitte|urteile?|rechtsprechung|präzedenzfälle?|entscheidungen?|zu|zum|zur|dem|der|die|das)\b/gi, " ");
    const r = (await run("rechtsprechung_suchen", { suchbegriffe: begriffe })) as { zitat: string; titel: string; bedeutung: string }[];
    if (!r.length) return "Dazu habe ich im Demo-Bestand der Fall-Datenbank keine passende Entscheidung gefunden. Probieren Sie es mit anderen Stichworten, z. B. „Bagatellkündigung“ oder „Schönheitsreparaturen“.";
    return `Passende Entscheidungen aus der Fall-Datenbank:\n${liste(r.slice(0, 3).map((e) => `${e.zitat} – ${e.titel}: ${e.bedeutung}`))}`;
  }

  // ── Fallanalyse ──
  if (/fallanalyse|erfolgsaussicht|chancen|gewinnen/.test(q) && !/^(wie|was) (funktioniert|macht|ist|geht|bedeutet)\b|erklär|erklaer/.test(q)) {
    const a = akteAusText(q);
    if (!a) return `Für welche Akte soll ich die Fallanalyse vorbereiten? Nennen Sie mir das Aktenzeichen oder den Mandanten, z. B. „${beispielAz()}“.`;
    ctx.links.push({ label: `KI-Fallanalyse ${a.aktenzeichen}`, to: `/ki?akte=${a.id}` });
    return `Gern. Die KI-Fallanalyse für ${a.aktenzeichen} (${a.titel}) prüft Sachverhalt, Dokumente und passende Rechtsprechung und schätzt die Erfolgsaussicht. Tippen Sie auf „KI-Fallanalyse ${a.aktenzeichen}“, um sie zu starten.`;
  }

  // ── Navigation zu einer Akte („Öffne die Akte 142/26“, „Zeig mir die Akte Weber“) ──
  const navMatch = q.match(/(öffne|oeffne|zeig|zeige|geh|gehe|wechsle|navigiere|bring mich)\s+(mir\s+)?(zu[mr]?\s+|in\s+(den|die|das)\s+|die\s+|den\s+|das\s+)?(.+)/);
  if (navMatch) {
    const ziel = navMatch[5].replace(/[?.!]+$/, "").replace(/^akte\s+/, "");
    try {
      const r = (await run("navigiere", { ziel })) as { geoeffnet: string; titel?: string };
      return r.titel ? `Ich habe die ${r.geoeffnet} (${r.titel}) für Sie geöffnet.` : `Ich habe „${r.geoeffnet}“ für Sie geöffnet.`;
    } catch {
      if (/akte/.test(q) || azAus(q)) {
        return `Eine Akte ${azAus(q) ?? `„${ziel}“`} habe ich in Ihrer Kanzlei nicht gefunden. Versuchen Sie es mit einem anderen Aktenzeichen, z. B. „Öffne die Akte ${beispielAz()}“, oder suchen Sie nach dem Namen des Mandanten.`;
      }
    }
  }
  const az = azAus(q);
  const nachAkteGefragt = /\bakte\b|stand|was ist mit|details/.test(q);
  if (nachAkteGefragt && (az || akteAusText(q))) {
    const a = az ? findeAkteNachAz(az) : akteAusText(q);
    if (!a) return `Eine Akte ${az} gibt es in Ihrer Kanzlei nicht. Ein Beispiel aus Ihrem Bestand: „Was ist mit Akte ${beispielAz()}?“`;
    const d = (await run("akte_details", { aktenzeichen: a.aktenzeichen })) as { aktenzeichen: string; titel: string; phase: string; offeneFristen: string[]; sachverhalt: string };
    return `${d.aktenzeichen} – ${d.titel} (${d.phase}). ${d.sachverhalt.split(". ")[0].replace(/\.$/, "")}.${d.offeneFristen.length ? `\nOffene Fristen:\n${liste(d.offeneFristen.slice(0, 3))}` : " Keine offenen Fristen."}`;
  }

  // ── Bedienung / Hilfe ──
  const hilfe = (await run("hilfe_artikel", { frage })) as { titel: string; kurz: string; schritte: string[] }[];
  if (hilfe.length && /(wie|wo|was|kann ich|erklär|erklaer|hilfe|funktioniert|geht)/.test(q)) {
    const h = hilfe[0];
    return `**${h.titel}:** ${h.kurz}\n${liste(h.schritte.slice(0, 3))}`;
  }
  if (bereich) {
    ctx.links.push({ label: `Zu „${bereich.label}“`, to: bereich.to });
    return `„${bereich.label}“ finden Sie ${bereich.ort}. ${bereich.beschreibung}`;
  }

  // ── Aktensuche als Rückfall (nur aussagekräftige Wörter ab drei Zeichen) ──
  const suchwoerter = tokenize(frage).filter((t) => t.length >= 3 && !FRAGEWORTE.has(t)).join(" ");
  const akten = suchwoerter ? ((await run("suche_akten", { suchbegriff: suchwoerter })) as { aktenzeichen: string; titel: string; naechsteFrist: string | null }[]) : [];
  if (akten.length) {
    const zeilen = liste(akten.slice(0, 4).map((a) => `${a.aktenzeichen} ${a.titel}${a.naechsteFrist ? ` – nächste Frist: ${a.naechsteFrist}` : ""}`));
    return akten.length === 1 ? `Dazu habe ich eine passende Akte gefunden:\n${zeilen}` : `Dazu habe ich ${akten.length} passende Akten gefunden:\n${zeilen}`;
  }
  if (hilfe.length) return `**${hilfe[0].titel}:** ${hilfe[0].kurz}`;

  return `Das kann ich im Demo-Modus noch nicht beantworten. Ich helfe Ihnen gern bei Fristen („Welche Fristen laufen diese Woche ab?“), Akten („Öffne die Akte ${beispielAz()}“), RVG („RVG für 10.000 € außergerichtlich“), Rechtsprechung („Urteile zu Schönheitsreparaturen“) oder der Bedienung. Oder ich verbinde Sie mit ${ap.name}.`;
}

/** Eine Frage an den Assistenten. */
export async function frageAssistent(opts: {
  verlauf: LlmMessage[];
  sitzung: SessionInfo;
  nav: (to: string) => void;
  voice: boolean;
  onText?: (t: string) => void;
  onTool?: (label: string) => void;
  signal?: AbortSignal;
}): Promise<AssistentAntwort> {
  const ctx: Kontext = { sitzung: opts.sitzung, nav: opts.nav, links: [], werkzeuge: [] };
  const letzte = opts.verlauf[opts.verlauf.length - 1]?.content ?? "";
  try {
    const text = await llmAgent({
      system: systemPrompt(opts.sitzung, opts.voice),
      messages: opts.verlauf.slice(-12),
      tools: werkzeuge(ctx),
      onText: opts.onText,
      onTool: (name) => opts.onTool?.(WERKZEUG_LABEL[name] ?? name),
      signal: opts.signal,
    });
    return { text: text.trim() || "Erledigt.", links: dedupe(ctx.links), werkzeuge: ctx.werkzeuge.map((w) => WERKZEUG_LABEL[w] ?? w) };
  } catch (e) {
    if (!(e instanceof DemoModus)) {
      if (opts.signal?.aborted) throw e;
      console.warn("Live-Assistent nicht verfügbar – Demo-Antwort", e);
    }
    let text: string;
    try {
      // Gesprächskontext: die letzten Nachrichten genügen für Rückfragen („Ja“, „142/26“)
      text = await demoAntwort(letzte, ctx, opts.verlauf.slice(-8));
    } catch (err) {
      text = `Das hat leider nicht geklappt: ${err instanceof Error ? err.message : String(err)} Versuchen Sie es bitte noch einmal – oder ich verbinde Sie mit ${opts.sitzung.tenant.ansprechpartner.name}.`;
    }
    ctx.werkzeuge.forEach((w) => opts.onTool?.(WERKZEUG_LABEL[w] ?? w));
    return { text, links: dedupe(ctx.links), werkzeuge: ctx.werkzeuge.map((w) => WERKZEUG_LABEL[w] ?? w) };
  }
}

function dedupe(l: AssistentLink[]): AssistentLink[] {
  const seen = new Set<string>();
  return l.filter((x) => (seen.has(x.to) ? false : (seen.add(x.to), true))).slice(0, 3);
}

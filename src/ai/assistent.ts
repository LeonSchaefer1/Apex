// Apex Assistent: Support & Arbeits-Agent. Live mit Claude (Werkzeuge = Funktionen dieser App) oder offline per Absichtserkennung.
import { berechneNachRegel, FRIST_REGELN, fristDringlichkeit } from "@/core/fristen";
import { berechneRvg, VV_KATALOG } from "@/core/rvg";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { search, normalize, tokenize } from "@/core/search";
import { addDays, fmtDate, fmtDateWd, fmtEUR, nowLocal, relDays, today, uid } from "@/core/dates";
import { WIKI } from "@/content/wiki";
import { NAV } from "@/app/nav";
import { useData } from "@/store/data";
import type { Akte, SessionInfo, FristTyp } from "@/core/types";
import { DemoModus, llmAgent, type AgentTool, type LlmMessage } from "./llm";

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

function findeAkteNachAz(az: string): Akte | undefined {
  const d = daten();
  const n = az.replace(/\s/g, "").toLowerCase();
  const exakt = d.akten.find((a) => a.aktenzeichen.toLowerCase() === n || a.aktenzeichen.split("/")[0] === n.split("/")[0]);
  if (exakt) return exakt;
  return search(d.akten, az, [{ get: (a) => a.aktenzeichen, weight: 4 }, { get: (a) => a.titel, weight: 3 }, { get: (a) => d.kontakte.find((k) => k.id === a.mandantId)?.name, weight: 2 }], 1)[0]?.item;
}

function naechsteFrist(akteId: string) {
  return daten().fristen.filter((f) => f.akteId === akteId && f.status === "offen" && f.typ !== "vorfrist").sort((a, b) => a.datum.localeCompare(b.datum))[0];
}

const ROUTEN: Record<string, string> = Object.fromEntries(NAV.map((n) => [normalize(n.label), n.to]));

/** Werkzeuge = echte Funktionen der App, die die KI aufrufen darf. */
const PRIORITAET = ["hilfe_artikel", "fristen_liste", "suche_akten", "akte_details", "frist_berechnen", "frist_anlegen", "navigiere", "ansprechpartner", "rueckruf_anfordern", "rechtsprechung_suchen", "rvg_berechnen", "posteingang_status"];

export function werkzeuge(ctx: Kontext): AgentTool[] {
  return alleWerkzeuge(ctx).sort((a, b) => PRIORITAET.indexOf(a.name) - PRIORITAET.indexOf(b.name));
}

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
          { get: (a) => a.aktenzeichen, weight: 4 }, { get: (a) => a.titel, weight: 3 }, { get: (a) => d.kontakte.find((k) => k.id === a.mandantId)?.name, weight: 2 },
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
        t("akte_details");
        const a = findeAkteNachAz(String(i.aktenzeichen ?? ""));
        if (!a) throw new Error("Akte nicht gefunden");
        const d = daten();
        ctx.links.push({ label: `Akte ${a.aktenzeichen} öffnen`, to: `/akten/${a.id}` });
        return {
          aktenzeichen: a.aktenzeichen, titel: a.titel, sachgebiet: a.sachgebiet, phase: a.phase, gegenstandswert: fmtEUR(a.gegenstandswert),
          mandant: d.kontakte.find((k) => k.id === a.mandantId)?.name, gegner: d.kontakte.find((k) => k.id === a.gegnerId)?.name,
          gericht: d.kontakte.find((k) => k.id === a.gerichtId)?.name, gerichtsAz: a.gerichtsAz, sachverhalt: a.beschreibung,
          offeneFristen: d.fristen.filter((f) => f.akteId === a.id && f.status === "offen").map((f) => `${f.titel} – ${fmtDateWd(f.datum)} (${relDays(f.datum)})`),
          dokumente: d.dokumente.filter((x) => x.akteId === a.id).slice(0, 8).map((x) => x.name),
        };
      },
    },
    {
      name: "fristen_liste",
      description: "Listet offene Fristen und Termine der Kanzlei in einem Zeitraum: 'heute', 'morgen', 'woche' (nächste 7 Tage) oder 'monat'.",
      inputSchema: { type: "object", properties: { zeitraum: { type: "string", enum: ["heute", "morgen", "woche", "monat"] }, nurMeine: { type: "boolean" } }, required: ["zeitraum"] },
      execute: (i) => {
        t("fristen_liste");
        const d = daten();
        const h = today();
        const bis = i.zeitraum === "heute" ? h : i.zeitraum === "morgen" ? addDays(h, 1) : i.zeitraum === "monat" ? addDays(h, 30) : addDays(h, 7);
        const von = i.zeitraum === "morgen" ? addDays(h, 1) : "0000";
        ctx.links.push({ label: "Fristenkalender öffnen", to: "/fristen" });
        return d.fristen
          .filter((f) => f.status === "offen" && f.typ !== "vorfrist" && f.datum <= bis && f.datum >= von && (!i.nurMeine || f.verantwortlichId === ctx.sitzung.user.id))
          .sort((a, b) => a.datum.localeCompare(b.datum))
          .slice(0, 12)
          .map((f) => {
            const a = d.akten.find((x) => x.id === f.akteId);
            return { titel: f.titel, typ: f.typ, datum: fmtDateWd(f.datum), relativ: relDays(f.datum), dringlichkeit: fristDringlichkeit(f.datum, h), akte: a ? `${a.aktenzeichen} ${a.titel}` : "", grundlage: f.grundlage ?? null };
          });
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
        },
        required: ["regel", "ereignisDatum"],
      },
      execute: (i) => {
        t("frist_berechnen");
        const r = berechneNachRegel(String(i.regel), String(i.ereignisDatum).slice(0, 10), land);
        ctx.links.push({ label: "Im Fristenrechner öffnen", to: "/fristen?rechner=1" });
        return { frist: r.regel.titel, grundlage: r.regel.grundlage, fristende: fmtDateWd(r.ende), vorfrist: fmtDateWd(r.vorfrist), rechenweg: r.rechenweg, hinweise: r.warnungen };
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
        t("frist_anlegen");
        const a = findeAkteNachAz(String(i.aktenzeichen ?? ""));
        if (!a) throw new Error("Akte nicht gefunden");
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
        return { zeilen: r.zeilen.map((z) => `${z.nr} ${z.titel} ${String(z.satz).replace(".", ",")}: ${fmtEUR(z.betrag)}`), auslagenpauschale: fmtEUR(r.auslagenpauschale), netto: fmtEUR(r.netto), ust: fmtEUR(r.ust), brutto: fmtEUR(r.brutto) };
      },
    },
    {
      name: "rechtsprechung_suchen",
      description: "Sucht passende Entscheidungen in der Fall-Datenbank (nur diese dürfen zitiert werden).",
      inputSchema: { type: "object", properties: { suchbegriffe: { type: "string" } }, required: ["suchbegriffe"] },
      execute: (i) => {
        t("rechtsprechung_suchen");
        const q = String(i.suchbegriffe ?? "");
        let hits = search(ENTSCHEIDUNGEN, q, [{ get: (e) => e.az, weight: 4 }, { get: (e) => e.titel, weight: 3 }, { get: (e) => e.schlagworte.join(" "), weight: 2 }, { get: (e) => e.leitsatz, weight: 1 }], 4);
        if (!hits.length) {
          const toks = tokenize(q);
          hits = ENTSCHEIDUNGEN.map((e) => ({ item: e, score: toks.filter((x) => normalize(`${e.titel} ${e.schlagworte.join(" ")} ${e.leitsatz}`).includes(x)).length }))
            .filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
        }
        hits.slice(0, 2).forEach((h) => ctx.links.push({ label: `${h.item.gericht} ${h.item.az}`, to: `/fall-datenbank?id=${h.item.id}` }));
        return hits.map(({ item: e }) => ({ zitat: `${e.gericht}, ${e.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(e.datum)} – ${e.az}`, titel: e.titel, leitsatz: e.leitsatz, bedeutung: e.bedeutung }));
      },
    },
    {
      name: "navigiere",
      description: "Öffnet einen Bereich der App (z. B. Fristen, Posteingang, Abrechnung) oder eine Akte über ihr Aktenzeichen.",
      inputSchema: { type: "object", properties: { ziel: { type: "string", description: `Bereich (${NAV.map((n) => n.label).join(", ")}) oder Aktenzeichen wie 142/26` } }, required: ["ziel"] },
      execute: (i) => {
        t("navigiere");
        const ziel = String(i.ziel ?? "");
        const n = normalize(ziel);
        const route = Object.entries(ROUTEN).find(([k]) => n.includes(k) || k.includes(n))?.[1];
        if (route) {
          ctx.nav(route);
          return { geoeffnet: ziel };
        }
        const a = findeAkteNachAz(ziel);
        if (a) {
          ctx.nav(`/akten/${a.id}`);
          return { geoeffnet: `Akte ${a.aktenzeichen} ${a.titel}` };
        }
        throw new Error("Ziel nicht gefunden");
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
        const neu = d.nachrichten.filter((n) => n.status === "neu");
        ctx.links.push({ label: "Posteingang öffnen", to: "/posteingang" });
        return { neu: neu.length, wartenAufKi: neu.filter((n) => n.kiStatus === "ausstehend").length, nachrichten: neu.slice(0, 6).map((n) => ({ kanal: n.kanal === "bea" ? "beA" : "E-Mail", von: n.von, betreff: n.betreff })) };
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
- Zitiere Rechtsprechung nur aus rechtsprechung_suchen.
- Ändere Daten (frist_anlegen) nur, wenn der Nutzer das ausdrücklich wünscht; bestätige danach, was du eingetragen hast.
- Wenn du nicht weiterkommst oder der Nutzer einen Menschen möchte: biete den persönlichen Ansprechpartner (${s.tenant.ansprechpartner.name}) an und nutze rueckruf_anfordern.
- Wenn der Nutzer einen Bereich sehen möchte, nutze navigiere.`;
}

// ───────────── Offline-Assistent (Demo-Modus) ─────────────

const MONATE: Record<string, number> = { januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };

function datumAus(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\bheute\b/.test(t)) return today();
  if (/\bgestern\b/.test(t)) return addDays(today(), -1);
  if (/\bvorgestern\b/.test(t)) return addDays(today(), -2);
  if (/\bmorgen\b/.test(t)) return addDays(today(), 1);
  const inTagen = t.match(/in (\d+|einer|zwei|drei|vier|fünf|sechs|sieben|zehn|vierzehn) (tag|tagen|woche|wochen)/);
  if (inTagen) {
    const z: Record<string, number> = { einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, zehn: 10, vierzehn: 14 };
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

async function demoAntwort(frage: string, ctx: Kontext): Promise<string> {
  const tools = Object.fromEntries(werkzeuge(ctx).map((t) => [t.name, t]));
  const q = frage.toLowerCase();
  const run = async (name: string, input: Record<string, unknown> = {}) => tools[name].execute(input) as Promise<never> | never;
  await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));

  // Mensch / Ansprechpartner
  if (/ansprechpartner|mensch|rückruf|rueckruf|hotline|anrufen|support|kontakt zu (euch|ihnen)/.test(q)) {
    const ap = (await run("ansprechpartner")) as { name: string; telefon: string; email: string; verfuegbar: string };
    if (/rückruf|rueckruf|ruf.*an|anrufen/.test(q)) {
      await run("rueckruf_anfordern", { thema: frage });
      return `Erledigt: ${ap.name} ruft Sie zurück – in der Regel innerhalb von 30 Minuten (${ap.verfuegbar}). Direkt erreichen Sie sie unter ${ap.telefon}.`;
    }
    return `Ihre persönliche Ansprechpartnerin ist ${ap.name}. Sie erreichen sie direkt unter ${ap.telefon} oder ${ap.email} (${ap.verfuegbar}) – ohne Warteschleife. Soll ich einen Rückruf anfordern?`;
  }

  // Tagesbriefing
  if (/was steht (heute )?an|mein tag|briefing|überblick|ueberblick|zusammenfassung des tages|was ist heute/.test(q)) {
    if (!ctx.werkzeuge.includes("tagesbriefing")) ctx.werkzeuge.push("tagesbriefing");
    const fr = (await run("fristen_liste", { zeitraum: "heute" })) as { titel: string; akte: string; typ: string }[];
    const woche = (await run("fristen_liste", { zeitraum: "woche" })) as { titel: string }[];
    const post = (await run("posteingang_status")) as { neu: number; wartenAufKi: number };
    const kritisch = fr.find((f) => f.typ === "notfrist") ?? fr[0];
    return `Heute sind ${fr.length} ${fr.length === 1 ? "Frist" : "Fristen"} fällig${kritisch ? ` – zuerst „${kritisch.titel}“ (${kritisch.akte})` : ""}. In den nächsten sieben Tagen laufen insgesamt ${woche.length} Fristen ab. Im Posteingang warten ${post.neu} neue Nachrichten, ${post.wartenAufKi} davon analysiert die KI gerade für Sie.`;
  }

  // Posteingang
  if (/posteingang|neue (post|nachrichten|mails?)|bea/.test(q) && !/wie/.test(q)) {
    const p = (await run("posteingang_status")) as { neu: number; nachrichten: { kanal: string; von: string; betreff: string }[] };
    return `Sie haben ${p.neu} neue Nachrichten:\n${liste(p.nachrichten.slice(0, 4).map((n) => `${n.kanal} von ${n.von}: ${n.betreff}`))}`;
  }

  // Frist berechnen
  const regel = regelAus(q);
  if (regel && /(berechne|wann|bis wann|frist|endet|ablauf)/.test(q) && !/(lege|leg |trag|erstelle)/.test(q)) {
    const datum = datumAus(q) ?? today();
    const r = (await run("frist_berechnen", { regel, ereignisDatum: datum })) as { frist: string; grundlage: string; fristende: string; vorfrist: string; hinweise: string[] };
    return `Die ${r.frist} (${r.grundlage}) endet am **${r.fristende}**, ausgehend vom ${fmtDate(datum)}. Vorfrist: ${r.vorfrist}. Den vollständigen Rechenweg sehen Sie im Fristenrechner.${r.hinweise.length ? ` Hinweis: ${r.hinweise[0]}` : ""}`;
  }

  // Frist / Wiedervorlage anlegen
  if (/(lege|leg |trag|erstelle|setz).*(frist|wiedervorlage|termin|erinnerung)|(frist|wiedervorlage|termin).*(an|ein)legen/.test(q)) {
    const az = azAus(q);
    const datum = datumAus(q);
    if (!az) return "Für welche Akte soll ich das eintragen? Nennen Sie mir bitte das Aktenzeichen, z. B. „142/26“.";
    if (!datum) return "Zu welchem Datum? Sagen Sie z. B. „in drei Tagen“ oder „am 30.10.“.";
    const typ = /termin/.test(q) ? "termin" : /frist/.test(q) && !/wiedervorlage/.test(q) ? "frist" : "wiedervorlage";
    const titel = typ === "termin" ? "Termin" : typ === "frist" ? "Frist (manuell)" : "Wiedervorlage";
    const r = (await run("frist_anlegen", { aktenzeichen: az, titel, datum, typ })) as { akte: string; datum: string };
    return `Erledigt: ${titel} für ${r.akte} am ${r.datum} eingetragen. Sie finden den Eintrag im Fristenkalender.`;
  }

  // Fristen auflisten
  if (/frist|termin|wiedervorlage/.test(q)) {
    const zeitraum = /heute/.test(q) ? "heute" : /morgen/.test(q) ? "morgen" : /monat/.test(q) ? "monat" : "woche";
    const fr = (await run("fristen_liste", { zeitraum, nurMeine: /meine/.test(q) })) as { titel: string; datum: string; akte: string; typ: string }[];
    if (!fr.length) return `Für ${zeitraum === "woche" ? "diese Woche" : zeitraum} sind keine offenen Fristen eingetragen.`;
    const label = zeitraum === "heute" ? "heute" : zeitraum === "morgen" ? "morgen" : zeitraum === "monat" ? "in den nächsten 30 Tagen" : "in den nächsten 7 Tagen";
    return `${fr.length} ${fr.length === 1 ? "Frist läuft" : "Fristen laufen"} ${label} ab:\n${liste(fr.slice(0, 6).map((f) => `${f.datum}: ${f.titel}${f.typ === "notfrist" ? " (Notfrist)" : ""} – ${f.akte}`))}`;
  }

  // RVG
  if (/rvg|gebühr|gebuehr|honorar/.test(q) && /\d/.test(q)) {
    const wert = Number((q.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?\s*(€|euro|eur)?/)?.[1] ?? "0").replace(/[.\s]/g, ""));
    const pos = /au(ß|ss)ergerichtlich/.test(q) ? ["2300"] : /gericht|klage|prozess|verfahren/.test(q) ? ["3100", "3104"] : ["2300"];
    const r = (await run("rvg_berechnen", { gegenstandswert: wert, positionen: pos })) as { zeilen: string[]; brutto: string; netto: string };
    return `Bei einem Gegenstandswert von ${fmtEUR(wert, { cents: false })}:\n${liste(r.zeilen)}\nGesamt ${r.netto} netto, ${r.brutto} brutto inkl. Auslagenpauschale und 19 % USt.`;
  }

  // Rechtsprechung
  if (/urteil|rechtsprechung|präzedenz|praezedenz|bgh|bag|entscheidung|gericht hat/.test(q)) {
    const begriffe = frage.replace(/(such|finde|zeig|gibt es|mir|bitte|urteile?|rechtsprechung|präzedenzfälle?|entscheidungen?|zu|zum|zur|dem|der|die|das)\b/gi, " ");
    const r = (await run("rechtsprechung_suchen", { suchbegriffe: begriffe })) as { zitat: string; titel: string; bedeutung: string }[];
    if (!r.length) return "Dazu habe ich im Demo-Bestand der Fall-Datenbank keine passende Entscheidung gefunden. Probieren Sie es mit anderen Stichworten, z. B. „Bagatellkündigung“ oder „Schönheitsreparaturen“.";
    return `Passende Entscheidungen aus der Fall-Datenbank:\n${liste(r.slice(0, 3).map((e) => `${e.zitat} – ${e.titel}: ${e.bedeutung}`))}`;
  }

  // Fallanalyse
  if (/fallanalyse|erfolgsaussicht|chancen|gewinnen/.test(q)) {
    const az = azAus(q);
    const a = az ? findeAkteNachAz(az) : daten().akten.find((x) => x.aktenzeichen.startsWith("142/"));
    if (a) {
      ctx.links.push({ label: `KI-Fallanalyse ${a.aktenzeichen}`, to: `/ki?akte=${a.id}` });
      return `Gern. Die KI-Fallanalyse für ${a.aktenzeichen} (${a.titel}) prüft Sachverhalt, Dokumente und passende Rechtsprechung und schätzt die Erfolgsaussicht. Tippen Sie auf „KI-Fallanalyse“, um sie zu starten.`;
    }
  }

  // Navigation
  const navMatch = q.match(/(öffne|oeffne|zeig|zeige|geh|gehe|wechsle|navigiere|bring mich)\s+(mir\s+)?(zu[mr]?\s+|in\s+(den|die|das)\s+|die\s+|den\s+|das\s+)?(.+)/);
  if (navMatch) {
    const ziel = navMatch[5].replace(/[?.!]$/, "").replace(/^akte\s+/, "");
    try {
      const r = (await run("navigiere", { ziel })) as { geoeffnet: string };
      return `Ich habe ${r.geoeffnet} für Sie geöffnet.`;
    } catch {
      /* weiter unten */
    }
  }
  const az = azAus(q);
  if (az && /akte|stand|was ist mit|details/.test(q)) {
    const d = (await run("akte_details", { aktenzeichen: az })) as { aktenzeichen: string; titel: string; phase: string; offeneFristen: string[]; sachverhalt: string };
    return `${d.aktenzeichen} – ${d.titel} (${d.phase}). ${d.sachverhalt.split(". ")[0]}.${d.offeneFristen.length ? `\nOffene Fristen:\n${liste(d.offeneFristen.slice(0, 3))}` : " Keine offenen Fristen."}`;
  }

  // Bedienung / Hilfe
  const hilfe = (await run("hilfe_artikel", { frage })) as { titel: string; kurz: string; schritte: string[] }[];
  if (hilfe.length && /(wie|wo|was|kann ich|erklär|erklaer|hilfe|funktioniert|geht)/.test(q)) {
    const h = hilfe[0];
    return `**${h.titel}:** ${h.kurz}\n${liste(h.schritte.slice(0, 3))}`;
  }

  // Aktensuche als Rückfall
  const akten = (await run("suche_akten", { suchbegriff: frage })) as { aktenzeichen: string; titel: string; naechsteFrist: string | null }[];
  if (akten.length) return `Dazu habe ich ${akten.length} passende Akten gefunden:\n${liste(akten.slice(0, 4).map((a) => `${a.aktenzeichen} ${a.titel}${a.naechsteFrist ? ` – nächste Frist: ${a.naechsteFrist}` : ""}`))}`;
  if (hilfe.length) return `**${hilfe[0].titel}:** ${hilfe[0].kurz}`;

  return `Das kann ich im Demo-Modus noch nicht beantworten. Ich helfe Ihnen gern bei Fristen („Welche Fristen laufen diese Woche ab?“), Akten („Öffne Akte 142“), RVG („RVG für 10.000 € außergerichtlich“), Rechtsprechung („Urteile zu Schönheitsreparaturen“) oder der Bedienung. Oder ich verbinde Sie mit ${ctx.sitzung.tenant.ansprechpartner.name}.`;
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
    const text = await demoAntwort(letzte, ctx);
    ctx.werkzeuge.forEach((w) => opts.onTool?.(WERKZEUG_LABEL[w] ?? w));
    return { text, links: dedupe(ctx.links), werkzeuge: ctx.werkzeuge.map((w) => WERKZEUG_LABEL[w] ?? w) };
  }
}

function dedupe(l: AssistentLink[]): AssistentLink[] {
  const seen = new Set<string>();
  return l.filter((x) => (seen.has(x.to) ? false : (seen.add(x.to), true))).slice(0, 3);
}

export const VORSCHLAEGE = [
  "Was steht heute an?",
  "Welche Fristen laufen diese Woche ab?",
  "Berechne die Berufungsfrist bei Zustellung heute",
  "Öffne die Akte 142/26",
  "Urteile zu Kündigung wegen Bagatelle",
  "Wie funktioniert der Bankabgleich?",
  "RVG für 10.000 € außergerichtlich",
  "Ich brauche meine Ansprechpartnerin",
];

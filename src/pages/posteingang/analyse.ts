// Posteingang: KI-Analyse (Ablauf, Zwischenspeicher) und die fachlichen Aktionen (zuordnen, Fristen übernehmen, eEB …).
import { create } from "zustand";
import { analysiereNachricht, analysiereRegelbasiert, type DokAnalyse, type FristVorschlag, type Rechtsmittelhinweis } from "@/ai/dokumentAnalyse";
import type { KiQuelle } from "@/ai/status";
import { fmtDate, fmtDateWd, fmtTime, nowLocal, today, uid } from "@/core/dates";
import type { Akte, Anhang, Bundesland, Dokument, DokumentArt, Frist, ID, ISODate, Nachricht, TenantData, User } from "@/core/types";
import { darfEebAbgeben as darfEebAbgebenRolle, istConsole } from "@/lib/backend";
import { normalize } from "@/core/search";
import { useData } from "@/store/data";
import { useSession } from "@/store/session";
import { gerichtsortAusRechenweg, legeFristAn, vorfristenZu } from "@/pages/fristen/logik";

export const SCHRITTE = [
  { titel: "Dokument lesen", text: "Text und Anhänge werden erfasst" },
  { titel: "Akte erkennen", text: "Aktenzeichen, Gericht und Parteien abgleichen" },
  { titel: "Fristen prüfen", text: "Fristauslösende Ereignisse finden" },
  { titel: "Rechenweg erstellen", text: "Fristenrechner nach §§ 187 ff. BGB, § 222 ZPO" },
] as const;

interface AnalyseStand {
  /** Nachricht-ID → aktueller Schritt (0 … SCHRITTE.length) */
  laufend: Record<string, number>;
  ergebnisse: Record<string, DokAnalyse>;
  fehler: Record<string, string>;
}

interface AnalyseState extends AnalyseStand {
  /** Kanzlei + Daten-Epoche, für die die Einträge gelten (siehe `analyseSchluessel`). */
  schluessel: string;
}

/**
 * Mandantentrennung für den KI-Zwischenspeicher: Ergebnisse gelten nur für genau eine Kanzlei
 * und einen Datenstand. Nachrichten-IDs (n-1 …) wiederholen sich in jeder Kanzlei und nach
 * „Demo-Daten zurücksetzen“ – deshalb wird nach Kanzlei-ID UND `useData().epoch` geschlüsselt.
 */
export function analyseSchluessel(): string {
  const s = useSession.getState().sitzung;
  return `${s && !istConsole(s) ? s.tenant.id : "-"}:${useData.getState().epoch}`;
}

const LEER: AnalyseStand = { laufend: {}, ergebnisse: {}, fehler: {} };

export const useAnalyse = create<AnalyseState>(() => ({ schluessel: analyseSchluessel(), ...LEER }));

/** Verwirft alle Ergebnisse, Fehler und laufenden Analysen, sobald Kanzlei oder Datenstand wechseln. */
function pruefeSchluessel() {
  const k = analyseSchluessel();
  if (useAnalyse.getState().schluessel !== k) useAnalyse.setState({ schluessel: k, laufend: {}, ergebnisse: {}, fehler: {} });
}
useData.subscribe((s, vorher) => {
  if (s.epoch !== vorher.epoch) pruefeSchluessel();
});
useSession.subscribe((s, vorher) => {
  if (s.sitzung !== vorher.sitzung) pruefeSchluessel();
});

/** KI-Stand für die Oberfläche – leer, falls er (noch) zu einer anderen Kanzlei bzw. einem älteren Datenstand gehört. */
export function useAnalyseStand(): AnalyseStand {
  const st = useAnalyse();
  const epoch = useData((s) => s.epoch);
  const tenantId = useSession((s) => (s.sitzung && !istConsole(s.sitzung) ? s.sitzung.tenant.id : "-"));
  return st.schluessel === `${tenantId}:${epoch}` ? st : LEER;
}

function setSchritt(id: string, schritt: number | undefined) {
  const laufend = { ...useAnalyse.getState().laufend };
  if (schritt === undefined) delete laufend[id];
  else laufend[id] = schritt;
  useAnalyse.setState({ laufend });
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Startet die KI-Analyse einer Nachricht (animierter Ablauf, mind. ~2 s) und speichert den Vorschlag an der Nachricht.
 * `schluessel`: optional der beim Auslösen gültige `analyseSchluessel()` (z. B. bei zeitversetztem Start) –
 * passt er nicht mehr, wird nichts gestartet. Wechseln Kanzlei oder Datenstand während der Analyse,
 * schreibt sie nichts mehr (weder Nachricht noch Protokoll noch Zwischenspeicher).
 */
export async function starteAnalyse(n: Nachricht, land: Bundesland, opts: { schluessel?: string } = {}): Promise<DokAnalyse | undefined> {
  pruefeSchluessel();
  const key = analyseSchluessel();
  if (opts.schluessel !== undefined && opts.schluessel !== key) return undefined;
  const gueltig = () => analyseSchluessel() === key && useAnalyse.getState().schluessel === key;
  // Nur Nachrichten des aktuellen Datenstands analysieren
  if (!useData.getState().data.nachrichten.some((x) => x.id === n.id && x.eingang === n.eingang && x.betreff === n.betreff)) return undefined;
  if (useAnalyse.getState().laufend[n.id] !== undefined) return undefined;
  const fehler = { ...useAnalyse.getState().fehler };
  delete fehler[n.id];
  useAnalyse.setState({ fehler });
  setSchritt(n.id, 0);
  let schritt = 0;
  const takt = setInterval(() => {
    if (!gueltig()) {
      clearInterval(takt);
      return;
    }
    schritt = Math.min(schritt + 1, SCHRITTE.length - 1);
    setSchritt(n.id, schritt);
  }, 540);
  try {
    const data = useData.getState().data;
    const [{ analyse, vorschlag }] = await Promise.all([analysiereNachricht(n, data, land), warte(2150)]);
    clearInterval(takt);
    if (!gueltig()) return undefined;
    setSchritt(n.id, SCHRITTE.length);
    await warte(380);
    if (!gueltig()) return undefined;
    const aktuell = useData.getState().data.nachrichten.find((x) => x.id === n.id) ?? n;
    // Analyse-Ergebnis und Protokoll sind automatische Schreibvorgänge (keine Änderung durch die Kanzlei).
    const system = { system: true };
    useData.getState().patch(
      "nachrichten",
      n.id,
      {
        ki: vorschlag,
        kiStatus: aktuell.kiStatus === "uebernommen" ? "uebernommen" : "analysiert",
      },
      system,
    );
    useAnalyse.setState({ ergebnisse: { ...useAnalyse.getState().ergebnisse, [n.id]: analyse } });
    const akte = analyse.akteId ? data.akten.find((a) => a.id === analyse.akteId) : undefined;
    const fristText = analyse.fristen.length ? `${analyse.fristen.length} ${analyse.fristen.length === 1 ? "Frist" : "Fristen"} erkannt` : "keine Frist erkannt";
    useData.getState().log({
      akteur: "ki",
      akteId: akte?.id,
      text: `Posteingang analysiert: „${n.betreff}“ – ${analyse.typ}, ${fristText}${akte ? `, Akte ${akte.aktenzeichen} zugeordnet (Vorschlag)` : ""}`,
      minutenGespart: 6,
    }, system);
    return analyse;
  } catch (e) {
    clearInterval(takt);
    if (gueltig()) useAnalyse.setState({ fehler: { ...useAnalyse.getState().fehler, [n.id]: e instanceof Error ? e.message : String(e) } });
    return undefined;
  } finally {
    if (gueltig()) setSchritt(n.id, undefined);
  }
}

/** Einheitliche Sicht auf die KI-Ergebnisse – frisch analysiert oder aus dem gespeicherten Vorschlag rekonstruiert. */
export interface KiAnsicht {
  typ: string;
  zusammenfassung: string;
  akteId?: string;
  sicherheit: number;
  akteGrund?: string;
  fristen: FristVorschlag[];
  termin?: DokAnalyse["termin"];
  aktionen: string[];
  /** eEB ist für diese Nachricht relevant */
  eeb: boolean;
  dokumentArt?: DokumentArt;
  quelle?: KiQuelle;
  dauerMs?: number;
  frisch: boolean;
  /** Rechtsmittelgericht bei Urteilen („Berufung einzulegen beim Kammergericht, § 519 Abs. 1 ZPO“) */
  rechtsmittel?: Rechtsmittelhinweis;
}

function eebRelevant(n: Nachricht, analyseEeb: boolean) {
  return !!n.eebErforderlich || (n.kanal === "bea" && analyseEeb);
}

function bereinigeAktionen(aktionen: string[], eeb: boolean) {
  return aktionen.filter((a) => eeb || !/empfangsbekenntnis/i.test(a));
}

function satzweise(t?: string): string[] {
  if (!t) return [];
  return t
    .split(/(?<=[.!])\s+(?=[A-ZÄÖÜ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function kiAnsicht(n: Nachricht, data: TenantData, land: Bundesland, frisch?: DokAnalyse): KiAnsicht | null {
  if (frisch) {
    const eeb = eebRelevant(n, frisch.eeb);
    return {
      typ: frisch.typ,
      zusammenfassung: frisch.zusammenfassung,
      akteId: frisch.akteId,
      sicherheit: frisch.akteId ? frisch.akteSicherheit : 0,
      akteGrund: frisch.akteGrund,
      fristen: frisch.fristen,
      termin: frisch.termin,
      aktionen: bereinigeAktionen(frisch.aktionen, eeb),
      eeb,
      dokumentArt: frisch.dokumentArt,
      quelle: frisch.quelle,
      dauerMs: frisch.dauerMs,
      frisch: true,
      rechtsmittel: frisch.rechtsmittel,
    };
  }
  if (!n.ki || n.kiStatus === "ausstehend") return null;
  const rb = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: n.eingang, kanal: n.kanal }, data, land);
  const ki = n.ki;
  let fristen: FristVorschlag[] = [];
  if (ki.frist) {
    fristen =
      rb.fristen[0]?.regelKey === ki.frist.regelKey && rb.fristen[0]?.ereignisDatum === ki.frist.ereignisDatum
        ? rb.fristen
        : [{ regelKey: ki.frist.regelKey, titel: ki.frist.titel, typ: ki.frist.typ, ereignisDatum: ki.frist.ereignisDatum, ende: ki.frist.datum, vorfrist: ki.frist.vorfrist ?? ki.frist.datum, grundlage: ki.frist.grundlage, rechenweg: ki.frist.rechenweg, warnungen: [] }];
  }
  const eeb = eebRelevant(n, rb.eeb);
  const gespeicherteAktionen = satzweise(ki.aktion);
  return {
    typ: rb.typ,
    zusammenfassung: ki.zusammenfassung,
    akteId: ki.akteId,
    sicherheit: ki.akteId ? ki.sicherheit : 0,
    akteGrund: rb.akteId === ki.akteId ? rb.akteGrund : ki.akteId ? "Zuordnung aus früherer Analyse" : undefined,
    fristen,
    termin: rb.termin,
    aktionen: bereinigeAktionen(gespeicherteAktionen.length ? gespeicherteAktionen : rb.aktionen, eeb),
    eeb,
    dokumentArt: ki.dokumentArt ?? rb.dokumentArt,
    frisch: false,
    rechtsmittel: rb.rechtsmittel,
  };
}

/** Wurde dieser Fristvorschlag bereits in der Akte notiert? */
export function istNotiert(p: FristVorschlag, akteId: string | undefined, fristen: Frist[]): boolean {
  if (!akteId) return false;
  return fristen.some((f) => f.akteId === akteId && f.typ !== "vorfrist" && f.datum === p.ende && (f.regelKey === p.regelKey || f.titel === p.titel));
}

/**
 * Ist der Fristvorschlag in der Akte notiert? Wie `istNotiert` (gleiches Fristende) – oder eine aus dieser Nachricht übernommene
 * Frist derselben Fristart wurde inzwischen korrigiert (z. B. Ereignis laut Empfangsprotokoll, I5-T03-01; das Fristende weicht
 * dann ab). Sonst böten KI-Karte und Taste U „Fristen übernehmen“ erneut an und `fristenUebernehmen` legte eine zweite Frist an.
 */
export function istNotiertAusNachricht(p: FristVorschlag, n: Pick<Nachricht, "betreff">, akteId: string | undefined, fristen: Frist[]): boolean {
  if (istNotiert(p, akteId, fristen)) return true;
  if (!akteId || !p.regelKey) return false;
  return fristenAusNachricht(n, akteId, fristen).haupt.some((f) => f.regelKey === p.regelKey && !!f.korrekturen?.length);
}

export function istGerichtspost(n: Nachricht): boolean {
  return n.kanal === "bea" && /gericht|justiz|kammergericht|staatsanwaltschaft|gerichtsvollzieher/i.test(`${n.von} ${n.vonAdresse ?? ""}`);
}

// ───────────────────────── Aktionen ─────────────────────────

/** Anhänge, die als eigene Dokumente in die E-Akte gehören (technische XJustiz-Strukturdaten bleiben an der Nachricht). */
export function ablegbareAnhaenge(n: Nachricht): Anhang[] {
  return n.anhaenge.filter((a) => !/\.xml$/i.test(a.name));
}

const anhangDokId = (n: Pick<Nachricht, "id">, i: number) => `dok-${n.id}-anhang-${i + 1}`;

/**
 * Alle Anhänge beim Namen nennen – auch die, die nicht abgelegt werden (I3-T02-03):
 * „2 Anhänge: Urteil_28O211-26.pdf in ‚Gericht‘ abgelegt · Zustellungsnachricht.xml (Strukturdaten) nicht abgelegt“.
 */
export function anhaengeText(n: Pick<Nachricht, "anhaenge">, ordner: string): string {
  const alle = n.anhaenge;
  if (!alle.length) return "";
  const abgelegt = ablegbareAnhaenge(n as Nachricht);
  const nicht = alle.filter((a) => !abgelegt.includes(a));
  const teile = [abgelegt.length ? `${abgelegt.map((a) => a.name).join(", ")} in ‚${ordner}‘ abgelegt` : "", ...nicht.map((a) => `${a.name} (Strukturdaten) nicht abgelegt`)].filter(Boolean);
  return `${alle.length} ${alle.length === 1 ? "Anhang" : "Anhänge"}: ${teile.join(" · ")}`;
}

/** Alle Dokumente, die aus dieser Nachricht in einer E-Akte abgelegt wurden: die Nachricht selbst und ihre Anhänge. */
export function dokumenteAusNachricht(n: Pick<Nachricht, "id">, dokumente: Dokument[]): Dokument[] {
  const basis = `dok-${n.id}`;
  return dokumente.filter((d) => d.id === basis || d.id.startsWith(`${basis}-anhang-`));
}

/**
 * Fristen, Termine und Wiedervorlagen, die aus dieser Nachricht in der Akte notiert wurden (erkennbar am Vermerk
 * „… „Betreff“ …“), dazu ihre Vorfristen. `haupt` ohne Vorfristen – für die Rückfrage beim Umhängen.
 */
export function fristenAusNachricht(n: Pick<Nachricht, "betreff">, akteId: string, fristen: Frist[]): { haupt: Frist[]; alle: Frist[] } {
  const marke = `„${n.betreff}“`;
  const haupt = fristen.filter((f) => f.akteId === akteId && f.typ !== "vorfrist" && !!f.notiz?.includes(marke));
  const ids = new Set(haupt.map((f) => f.id));
  const vor = fristen.filter((f) => f.akteId === akteId && f.typ === "vorfrist" && !!f.bezugId && ids.has(f.bezugId));
  return { haupt, alle: [...haupt, ...vor] };
}

/**
 * Widerspruch zwischen Gerichtsaktenzeichen und gewählter Akte: Nennt die Nachricht das Gerichts-Az. einer anderen Akte
 * (laut Bestand) und nicht das der gewählten, droht eine Notfrist in der falschen Akte zu landen.
 */
export function gerichtsAzKonflikt(n: Pick<Nachricht, "betreff" | "text">, ziel: Akte, akten: Akte[]): { az: string; akte: Akte } | undefined {
  const norm = normalize(`${n.betreff}\n${n.text}`).replace(/\s+/g, " ");
  const enthaelt = (az?: string) => !!az && norm.includes(normalize(az).replace(/\s+/g, " "));
  if (enthaelt(ziel.gerichtsAz)) return undefined;
  const andere = akten.find((a) => a.id !== ziel.id && enthaelt(a.gerichtsAz));
  return andere ? { az: andere.gerichtsAz!, akte: andere } : undefined;
}

/** Zielordner für die Anhänge: Gerichtspost → „Gericht“, Post des Mandanten → „Mandant“, sonst „Anlagen“. */
export function anhangOrdner(n: Nachricht, akte: Akte, data: TenantData): Dokument["ordner"] {
  if (istGerichtspost(n)) return "Gericht";
  const mandant = data.kontakte.find((k) => k.id === akte.mandantId);
  const adresse = (n.vonAdresse ?? "").trim().toLowerCase();
  if (mandant && ((adresse && mandant.email?.trim().toLowerCase() === adresse) || (n.kanal === "email" && mandant.name === n.von))) return "Mandant";
  return "Anlagen";
}

/** Liegen alle Anhänge der Nachricht als Dokumente in dieser Akte? */
export function anhaengeAbgelegt(n: Nachricht, akteId: string | undefined, dokumente: Dokument[]): boolean {
  if (!akteId) return false;
  const ids = new Set(dokumente.filter((d) => d.akteId === akteId).map((d) => d.id));
  return ablegbareAnhaenge(n).every((_, i) => ids.has(anhangDokId(n, i)));
}

function anhangArt(name: string, n: Nachricht): DokumentArt {
  if (/urteil/i.test(name)) return "urteil";
  if (/beschluss|verf(ue|ü)gung/i.test(name)) return "beschluss";
  if (/vertrag/i.test(name)) return "vertrag";
  if (/gutachten|bericht/i.test(name)) return "gutachten";
  return istGerichtspost(n) ? "beschluss" : "anlage";
}

/**
 * Legt die Anhänge der Nachricht als eigene Dokumente in der E-Akte ab (idempotent). Liegt ein Anhang schon in einer
 * ANDEREN Akte (frühere Zuordnung), wird er in diese Akte verschoben – samt Entzug einer Portalfreigabe (§ 43a Abs. 2 BRAO).
 */
export function anhaengeAblegen(n: Nachricht, akte: Akte, user: User, opts: { leise?: boolean } = {}): { anzahl: number; ordner: Dokument["ordner"]; verschoben: number } {
  const { upsert, patch, log, data } = useData.getState();
  const ordner = anhangOrdner(n, akte, data);
  const vorhanden = new Map(data.dokumente.map((d) => [d.id, d]));
  let anzahl = 0;
  let verschoben = 0;
  ablegbareAnhaenge(n).forEach((a, i) => {
    const id = anhangDokId(n, i);
    const alt = vorhanden.get(id);
    if (alt) {
      if (alt.akteId !== akte.id) {
        patch("dokumente", id, { akteId: akte.id, ordner, portal: undefined });
        verschoben++;
      }
      return;
    }
    const endung = a.name.split(".").pop()?.toLowerCase();
    upsert("dokumente", {
      id,
      akteId: akte.id,
      name: a.name,
      art: anhangArt(a.name, n),
      ordner,
      format: endung === "docx" || endung === "txt" ? endung : "pdf",
      groesseKb: a.groesseKb,
      inhalt: `Anhang zu ${n.kanal === "bea" ? "beA-Nachricht" : "E-Mail"} „${n.betreff}“ von ${n.von} (Eingang ${n.eingang.slice(0, 10).split("-").reverse().join(".")}).`,
      quelle: n.kanal === "bea" ? "bea" : "email",
      version: 1,
      createdAt: n.eingang,
    });
    anzahl++;
  });
  if (anzahl && !opts.leise) log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Anhänge aus „${n.betreff}“ in der E-Akte – ${anhaengeText(n, ordner)}` });
  return { anzahl, ordner, verschoben };
}

export interface ZuordnenOptionen {
  leise?: boolean;
  /** Beim Umhängen: Fristen/Termine aus dieser Nachricht in der bisherigen Akte mitnehmen (empfohlen) oder dort lassen. */
  fristen?: "mitnehmen" | "lassen";
  /** Bestätigter Widerspruch zum Gerichtsaktenzeichen (wird protokolliert). */
  konflikt?: { az: string; akteAz: string };
}

export interface ZuordnenErgebnis {
  ordner: Dokument["ordner"];
  anhaenge: number;
  anhangOrdner: Dokument["ordner"];
  /** Umzuordnung: bisherige Akte, verschobene Dokumente und Fristen */
  vorher?: { akte?: Akte; dokumente: number; fristen: number; fristenBelassen: number };
}

/**
 * Ordnet die Nachricht einer Akte zu und legt sie samt Anhängen als Dokumente in der E-Akte ab.
 * Umzuordnung (Akte gewechselt): ALLE aus der Nachricht abgelegten Dokumente wandern in die neue Akte, eine Portalfreigabe
 * entfällt, Fristen aus der Nachricht ziehen je nach `opts.fristen` mit um; beide Verläufe halten den Wechsel fest.
 */
export function zuordnen(n: Nachricht, akte: Akte, user: User, ansicht: KiAnsicht | null, opts: ZuordnenOptionen = {}): ZuordnenErgebnis {
  const { patch, upsert, log, data } = useData.getState();
  const aktuell = data.nachrichten.find((x) => x.id === n.id) ?? n;
  const vorherId = aktuell.akteId && aktuell.akteId !== akte.id ? aktuell.akteId : undefined;
  const vorherAkte = vorherId ? data.akten.find((a) => a.id === vorherId) : undefined;
  // Dokumente aus dieser Nachricht, die (noch) in einer anderen Akte liegen – gleich welche
  const fremd = dokumenteAusNachricht(n, data.dokumente).filter((d) => d.akteId !== akte.id);
  // Fristen aus der Nachricht in der bisherigen Akte
  const ausVorher = vorherId ? fristenAusNachricht(n, vorherId, data.fristen) : { haupt: [], alle: [] };
  const mitnehmen = ausVorher.haupt.length > 0 && opts.fristen !== "lassen";
  if (mitnehmen) for (const f of ausVorher.alle) patch("fristen", f.id, { akteId: akte.id });
  const fristenInZiel = ansicht?.fristen.length ? ansicht.fristen.every((p) => istNotiert(p, akte.id, mitnehmen ? data.fristen.map((f) => (ausVorher.alle.some((x) => x.id === f.id) ? { ...f, akteId: akte.id } : f)) : data.fristen)) : true;
  const ohneFristen = !ansicht || ansicht.fristen.length === 0;
  patch("nachrichten", n.id, {
    akteId: akte.id,
    zugeordnet: true,
    kiStatus:
      n.kiStatus === "analysiert" && ohneFristen && ansicht?.akteId === akte.id
        ? "uebernommen"
        : vorherId && aktuell.kiStatus === "uebernommen" && !fristenInZiel
          ? "analysiert"
          : aktuell.kiStatus,
  });
  const art: DokumentArt = ansicht?.dokumentArt ?? (n.kanal === "bea" ? "bea" : "email");
  const dok: Dokument = {
    id: `dok-${n.id}`,
    akteId: akte.id,
    name: n.betreff,
    art,
    ordner: istGerichtspost(n) ? "Gericht" : "Korrespondenz",
    format: n.kanal === "email" ? "eml" : "pdf",
    groesseKb: Math.max(4, Math.ceil(n.text.length / 900)),
    inhalt: n.text,
    quelle: n.kanal === "bea" ? "bea" : "email",
    version: 1,
    createdAt: n.eingang,
    ki: ansicht ? { zusammenfassung: ansicht.zusammenfassung, erkannteFristen: ansicht.fristen.length } : undefined,
  };
  // Neu geschrieben (ohne Portalfreigabe) – ersetzt ein in einer anderen Akte abgelegtes Exemplar
  upsert("dokumente", dok);
  const anh = anhaengeAblegen(n, akte, user, { leise: true });
  const konfliktText = opts.konflikt ? ` – Gerichts-Az. ${opts.konflikt.az} gehört laut Bestand zu ${opts.konflikt.akteAz}; Zuordnung bewusst bestätigt` : "";
  const nachEeb = aktuell.eebAbgegeben ? " – nach Abgabe des eEB, bestätigt" : "";
  // Verlauf der bisherigen Akte(n): Rücknahme mit Ziel
  const vorherIds = [...new Set([...(vorherId ? [vorherId] : []), ...fremd.map((d) => d.akteId)])];
  for (const id of vorherIds) {
    const anzahlDoks = fremd.filter((d) => d.akteId === id).length;
    const fristText =
      id === vorherId && ausVorher.haupt.length
        ? mitnehmen
          ? `; ${ausVorher.haupt.length} ${ausVorher.haupt.length === 1 ? "Frist bzw. Termin" : "Fristen bzw. Termine"} mit umgezogen`
          : `; ${ausVorher.haupt.length} ${ausVorher.haupt.length === 1 ? "Frist bzw. Termin aus der Nachricht bleibt" : "Fristen bzw. Termine aus der Nachricht bleiben"} bewusst hier`
        : "";
    log({
      akteur: "nutzer",
      userId: user.id,
      akteId: id,
      text: `Zuordnung von „${n.betreff}“ zurückgenommen – ${anzahlDoks ? `${anzahlDoks} ${anzahlDoks === 1 ? "Dokument" : "Dokumente"} nach ${akte.aktenzeichen} verschoben` : `Nachricht gehört zu ${akte.aktenzeichen}`}${fristText}${nachEeb}`,
    });
  }
  if (!opts.leise || vorherIds.length)
    log({
      akteur: "nutzer",
      userId: user.id,
      akteId: akte.id,
      text: `Nachricht „${n.betreff}“ der Akte ${akte.aktenzeichen} zugeordnet und in der E-Akte abgelegt (${dok.ordner}${n.anhaenge.length ? ` · ${anhaengeText(n, anh.ordner)}` : ""})${vorherAkte ? ` – vorher ${vorherAkte.aktenzeichen}${mitnehmen ? `, ${ausVorher.haupt.length} ${ausVorher.haupt.length === 1 ? "Frist bzw. Termin" : "Fristen bzw. Termine"} mit umgezogen` : ""}` : ""}${konfliktText}${nachEeb}`,
    });
  return {
    ordner: dok.ordner,
    anhaenge: anh.anzahl + anh.verschoben,
    anhangOrdner: anh.ordner,
    vorher: vorherIds.length ? { akte: vorherAkte, dokumente: fremd.length, fristen: mitnehmen ? ausVorher.haupt.length : 0, fristenBelassen: mitnehmen ? 0 : ausVorher.haupt.length } : undefined,
  };
}

/** Übernimmt die erkannten Fristen (mit Vorfristen) in die Akte. Die Vier-Augen-Kontrolle bleibt offen. */
export function fristenUebernehmen(n: Nachricht, akte: Akte, user: User, ansicht: KiAnsicht, fristen: Frist[]): { anzahl: number; rueckgaengig: () => boolean } {
  const { patch, log } = useData.getState();
  if (n.akteId !== akte.id) zuordnen(n, akte, user, ansicht, { leise: true });
  let anzahl = 0;
  const neu: string[] = [];
  for (const p of ansicht.fristen) {
    if (istNotiertAusNachricht(p, n, akte.id, fristen)) continue;
    const r = legeFristAn({
      akteId: akte.id,
      titel: p.titel,
      typ: p.typ,
      datum: p.ende,
      vorfrist: p.vorfrist,
      regelKey: p.regelKey,
      grundlage: p.grundlage,
      ereignisDatum: p.ereignisDatum,
      rechenweg: p.rechenweg,
      // Ort der Fristwahrung, mit dessen Feiertagen gerechnet wurde (z. B. Kammergericht als Berufungsgericht) – für Korrekturen (I3-T03-02)
      gerichtsort: gerichtsortAusRechenweg(p.rechenweg),
      quelle: "ki",
      verantwortlichId: akte.bearbeiterId,
      vorfristVerantwortlichId: akte.sachbearbeiterId ?? akte.bearbeiterId,
      notiz: `Von der KI aus ${n.kanal === "bea" ? "beA-Nachricht" : "E-Mail"} „${n.betreff}“ erkannt.`,
    });
    neu.push(r.frist.id, ...(r.vorfrist ? [r.vorfrist.id] : []));
    anzahl++;
  }
  patch("nachrichten", n.id, { kiStatus: "uebernommen", akteId: akte.id, zugeordnet: true });
  log({
    akteur: "nutzer",
    userId: user.id,
    akteId: akte.id,
    text: `${anzahl} ${anzahl === 1 ? "Frist" : "Fristen"} aus dem Posteingang übernommen (${ansicht.fristen.map((f) => f.titel).join(", ")}) – Vier-Augen-Kontrolle ausstehend`,
  });
  const epoch = useData.getState().epoch;
  /** Nimmt die Übernahme zurück – nicht mehr, sobald das eEB abgegeben ist (dann laufen die Fristen) oder der Datenstand gewechselt hat. */
  const rueckgaengig = (): boolean => {
    const st = useData.getState();
    if (st.epoch !== epoch) return false;
    const aktuell = st.data.nachrichten.find((x) => x.id === n.id);
    if (!aktuell || aktuell.eebAbgegeben) return false;
    neu.forEach((id) => st.remove("fristen", id));
    st.patch("nachrichten", n.id, { kiStatus: "analysiert" });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Fristübernahme aus dem Posteingang rückgängig gemacht (${n.betreff})` });
    return true;
  };
  return { anzahl, rueckgaengig };
}

export function terminEintragen(n: Nachricht, akte: Akte, user: User, termin: NonNullable<KiAnsicht["termin"]>) {
  legeFristAn({
    akteId: akte.id,
    titel: termin.titel,
    typ: "termin",
    datum: termin.datum,
    uhrzeit: termin.uhrzeit,
    ort: termin.ort,
    quelle: "ki",
    verantwortlichId: akte.bearbeiterId,
    notiz: `Aus ${n.kanal === "bea" ? "beA-Nachricht" : "E-Mail"} „${n.betreff}“ übernommen.`,
  });
  useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Termin „${termin.titel}“ am ${termin.datum.split("-").reverse().join(".")} eingetragen` });
}

// ───────────────────────── eEB: Abgabe nur durch Berufsträger, Vorlage durch das Sekretariat ─────────────────────────

/**
 * Nur Rechtsanwältinnen und Rechtsanwälte geben das eEB ab (Whitelist – neue Rollen wie „azubi“ sind automatisch ausgeschlossen).
 * Gleiche Regel wie Rechte-Matrix, Demo- und Server-Backend (`darfEebAbgeben` aus `@/lib/backend`).
 */
export function darfEebAbgeben(u: Pick<User, "rolle">): boolean {
  return darfEebAbgebenRolle(u.rolle);
}

/** Erklärsatz für Sekretariat und Auszubildende */
export const EEB_ERKLAERUNG =
  "Das eEB gibt die Anwältin bzw. der Anwalt selbst ab – ohne qualifizierte elektronische Signatur nur über den eigenen sicheren Übermittlungsweg (§ 173 Abs. 3 ZPO). Sie bereiten vor und legen vor.";

function zeitpunkt(iso: string): string {
  return `${fmtDate(iso.slice(0, 10))}, ${fmtTime(iso)} Uhr`;
}

/** Name zu einer Personen-ID (Team der Kanzlei) */
function nameVon(id: ID | undefined, team: User[]): string {
  return (id && team.find((u) => u.id === id)?.name) || "unbekannt";
}

/**
 * eEB-Protokoll in einer Zeile: wer, wann, Zustellungsdatum, erster Lesezeitpunkt.
 * „eEB abgegeben von Dr. Julia Hartmann am 16.10.2026, 15:43 Uhr · Zustellungsdatum 16.10.2026 · erstmals geöffnet am 16.10.2026, 15:39 Uhr von Dr. Julia Hartmann“
 */
export function eebProtokoll(n: Pick<Nachricht, "eebAbgegeben" | "eebAbgegebenVon" | "eebZustellungsdatum" | "geoeffnetAm" | "geoeffnetVon" | "eingang">, team: User[]): string {
  const teile = [`eEB abgegeben von ${nameVon(n.eebAbgegebenVon, team)} am ${n.eebAbgegeben ? zeitpunkt(n.eebAbgegeben) : "–"}`];
  teile.push(`Zustellungsdatum ${fmtDate(n.eebZustellungsdatum ?? n.eingang.slice(0, 10))}`);
  teile.push(n.geoeffnetAm ? `erstmals geöffnet am ${zeitpunkt(n.geoeffnetAm)} von ${nameVon(n.geoeffnetVon, team)}` : "erstmals geöffnet: nicht erfasst");
  return teile.join(" · ");
}

/** Hält den ersten Lesezeitpunkt fest – nur, wenn er noch fehlt (Protokoll „wann erstmals zur Kenntnis genommen“). */
export function ersteOeffnungMerken(n: Nachricht, user: User) {
  if (n.geoeffnetAm) return;
  useData.getState().patch("nachrichten", n.id, { geoeffnetAm: nowLocal(), geoeffnetVon: user.id });
}

/**
 * „Zur eEB-Abgabe vorlegen“: Vorlage an der Nachricht, Wiedervorlage für heute bei der Anwältin bzw. dem Anwalt
 * (erscheint in Fristen und Cockpit) und Eintrag im Verlauf der Akte.
 */
export function eebVorlegen(n: Nachricht, akte: Akte | undefined, user: User, an: User, notiz: string): Frist | undefined {
  const { patch, log } = useData.getState();
  const am = nowLocal();
  patch("nachrichten", n.id, { eebVorlage: { von: user.id, am, an: an.id, notiz: notiz.trim() || undefined } });
  let wv: Frist | undefined;
  if (akte) {
    const az = akte.gerichtsAz ?? n.betreff.split(" – ")[0];
    wv = legeFristAn({
      akteId: akte.id,
      titel: `eEB abgeben – ${az} (vorgelegt von ${user.name})`,
      typ: "wiedervorlage",
      datum: today(),
      quelle: "manuell",
      verantwortlichId: an.id,
      notiz: `Empfangsbekenntnis zu „${n.betreff}“ zur Abgabe vorgelegt von ${user.name} am ${zeitpunkt(am)}.${notiz.trim() ? ` Notiz: ${notiz.trim()}` : ""}`,
    }).frist;
  }
  log({
    akteur: "nutzer",
    userId: user.id,
    akteId: akte?.id ?? n.akteId,
    text: `eEB zur Abgabe vorgelegt an ${an.name} (${n.betreff})${notiz.trim() ? ` – Notiz: ${notiz.trim()}` : ""}`,
  });
  return wv;
}

/** Fristvorschläge der Nachricht mit einem anderen Zustellungsdatum neu berechnen – Fristenrechner, gleiche Regeln. */
export function fristenZumZustellungsdatum(n: Nachricht, data: TenantData, land: Bundesland, datum: ISODate, ansicht: KiAnsicht): { alt: FristVorschlag; neu: FristVorschlag }[] {
  const rb = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: datum, kanal: n.kanal }, data, land);
  return ansicht.fristen.map((alt, i) => {
    const neu = rb.fristen.find((x) => x.regelKey === alt.regelKey && x.titel === alt.titel) ?? rb.fristen.find((x) => x.regelKey === alt.regelKey) ?? rb.fristen[i];
    return { alt, neu: neu ?? alt };
  });
}

/** „Berufungsfrist: Mo 16.11. → Di 17.11.2026“ */
export function fristAenderungText(p: { alt: FristVorschlag; neu: FristVorschlag }): string {
  const kurz = (d: ISODate) => fmtDateWd(d).replace(/\d{4}$/, "").replace(/,/, "");
  return `${p.alt.titel}: ${kurz(p.alt.ende)} → ${fmtDateWd(p.neu.ende).replace(/,/, "")}`;
}

/**
 * Gibt das eEB ab (nur Berufsträger). Protokolliert Wer, Wann, Zustellungsdatum und ersten Lesezeitpunkt in einer Zeile.
 * Weicht das Zustellungsdatum vom Eingangstag ab, werden die bereits notierten Kalenderfristen samt Vorfristen angepasst.
 */
export function eebAbgeben(
  n: Nachricht,
  user: User,
  opts: { zustellungsdatum: ISODate; team: User[]; akte?: Akte; anpassungen?: { alt: FristVorschlag; neu: FristVorschlag }[]; kontrolleOffenBestaetigt?: boolean },
): string | undefined {
  if (!darfEebAbgeben(user)) return undefined;
  const { patch, log, data } = useData.getState();
  const aktuell = data.nachrichten.find((x) => x.id === n.id) ?? n;
  if (aktuell.eebAbgegeben) return undefined;
  const am = nowLocal();
  // Erster Lesezeitpunkt fehlt (z. B. ältere Daten): Abgabe gilt als spätester Kenntniszeitpunkt
  const geoeffnet = aktuell.geoeffnetAm ? {} : { geoeffnetAm: am, geoeffnetVon: user.id };
  patch("nachrichten", n.id, { eebAbgegeben: am, eebAbgegebenVon: user.id, eebZustellungsdatum: opts.zustellungsdatum, ...geoeffnet });
  const akteId = opts.akte?.id ?? aktuell.akteId;
  // Notierte Fristen an das erklärte Zustellungsdatum anpassen (protokolliert)
  const geaendert: string[] = [];
  if (opts.akte && opts.anpassungen?.length) {
    for (const p of opts.anpassungen) {
      if (p.alt.ende === p.neu.ende && p.alt.ereignisDatum === p.neu.ereignisDatum) continue;
      const f = data.fristen.find((x) => x.akteId === opts.akte!.id && x.typ !== "vorfrist" && x.status === "offen" && x.datum === p.alt.ende && (x.regelKey === p.alt.regelKey || x.titel === p.alt.titel));
      if (!f) continue;
      patch("fristen", f.id, { datum: p.neu.ende, vorfrist: p.neu.vorfrist, ereignisDatum: p.neu.ereignisDatum, rechenweg: p.neu.rechenweg });
      for (const v of vorfristenZu(f, data.fristen))
        patch("fristen", v.id, { datum: p.neu.vorfrist, notiz: `Vorfrist zu „${f.titel}“ (Fristende ${fmtDate(p.neu.ende)}).` });
      geaendert.push(fristAenderungText(p));
    }
  }
  const protokoll = eebProtokoll({ ...aktuell, ...geoeffnet, eebAbgegeben: am, eebAbgegebenVon: user.id, eebZustellungsdatum: opts.zustellungsdatum }, opts.team.some((u) => u.id === user.id) ? opts.team : [...opts.team, user]);
  const zusatz = opts.kontrolleOffenBestaetigt ? " · Vier-Augen-Kontrolle stand noch aus – notierte Fristen selbst geprüft (bestätigt)" : "";
  log({ akteur: "nutzer", userId: user.id, akteId, text: `${protokoll}${zusatz} – ${n.betreff}` });
  if (geaendert.length) log({ akteur: "nutzer", userId: user.id, akteId, text: `Fristen an das Zustellungsdatum ${fmtDate(opts.zustellungsdatum)} angepasst: ${geaendert.join("; ")}` });
  // Offene Vorlage-Wiedervorlage „eEB abgeben – …“ erledigt sich mit der Abgabe
  for (const wv of data.fristen.filter((x) => x.akteId === akteId && x.typ === "wiedervorlage" && x.status === "offen" && x.titel.startsWith("eEB abgeben – ")))
    patch("fristen", wv.id, { status: "erledigt", erledigtAm: am, erledigtVon: user.id });
  return protokoll;
}

export function alsErledigt(n: Nachricht, user: User, erledigt = true) {
  const { patch, log } = useData.getState();
  patch("nachrichten", n.id, { status: erledigt ? "erledigt" : "gelesen" });
  if (erledigt) log({ akteur: "nutzer", userId: user.id, akteId: n.akteId, text: `Nachricht erledigt: ${n.betreff}` });
}

export function antwortSenden(n: Nachricht, user: User, p: { an: string; betreff: string; text: string }): Nachricht {
  const { upsert, log } = useData.getState();
  const msg: Nachricht = {
    id: uid("n"),
    kanal: n.kanal,
    richtung: "aus",
    von: user.name,
    vonAdresse: user.email,
    an: p.an,
    betreff: p.betreff,
    text: p.text,
    eingang: nowLocal(),
    akteId: n.akteId,
    anhaenge: [],
    status: "gelesen",
    zugeordnet: !!n.akteId,
  };
  upsert("nachrichten", msg);
  log({ akteur: "nutzer", userId: user.id, akteId: n.akteId, text: `Antwort ${n.kanal === "bea" ? "per beA" : "per E-Mail"} gesendet: ${p.betreff}` });
  return msg;
}

export function antwortBetreff(betreff: string) {
  return /^aw:/i.test(betreff) ? betreff : `AW: ${betreff}`;
}

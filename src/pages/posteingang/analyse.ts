// Posteingang: KI-Analyse (Ablauf, Zwischenspeicher) und die fachlichen Aktionen (zuordnen, Fristen übernehmen, eEB …).
import { create } from "zustand";
import { analysiereNachricht, analysiereRegelbasiert, type DokAnalyse, type FristVorschlag } from "@/ai/dokumentAnalyse";
import type { KiQuelle } from "@/ai/status";
import { nowLocal, uid } from "@/core/dates";
import type { Akte, Bundesland, Dokument, DokumentArt, Frist, Nachricht, TenantData, User } from "@/core/types";
import { useData } from "@/store/data";
import { legeFristAn } from "@/pages/fristen/logik";

export const SCHRITTE = [
  { titel: "Dokument lesen", text: "Text und Anhänge werden erfasst" },
  { titel: "Akte erkennen", text: "Aktenzeichen, Gericht und Parteien abgleichen" },
  { titel: "Fristen prüfen", text: "Fristauslösende Ereignisse finden" },
  { titel: "Rechenweg erstellen", text: "Fristenrechner nach §§ 187 ff. BGB, § 222 ZPO" },
] as const;

interface AnalyseState {
  /** Nachricht-ID → aktueller Schritt (0 … SCHRITTE.length) */
  laufend: Record<string, number>;
  ergebnisse: Record<string, DokAnalyse>;
  fehler: Record<string, string>;
}

export const useAnalyse = create<AnalyseState>(() => ({ laufend: {}, ergebnisse: {}, fehler: {} }));

function setSchritt(id: string, schritt: number | undefined) {
  const laufend = { ...useAnalyse.getState().laufend };
  if (schritt === undefined) delete laufend[id];
  else laufend[id] = schritt;
  useAnalyse.setState({ laufend });
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Startet die KI-Analyse einer Nachricht (animierter Ablauf, mind. ~2 s) und speichert den Vorschlag an der Nachricht. */
export async function starteAnalyse(n: Nachricht, land: Bundesland): Promise<DokAnalyse | undefined> {
  if (useAnalyse.getState().laufend[n.id] !== undefined) return undefined;
  const fehler = { ...useAnalyse.getState().fehler };
  delete fehler[n.id];
  useAnalyse.setState({ fehler });
  setSchritt(n.id, 0);
  let schritt = 0;
  const takt = setInterval(() => {
    schritt = Math.min(schritt + 1, SCHRITTE.length - 1);
    setSchritt(n.id, schritt);
  }, 540);
  try {
    const data = useData.getState().data;
    const [{ analyse, vorschlag }] = await Promise.all([analysiereNachricht(n, data, land), warte(2150)]);
    clearInterval(takt);
    setSchritt(n.id, SCHRITTE.length);
    await warte(380);
    const aktuell = useData.getState().data.nachrichten.find((x) => x.id === n.id) ?? n;
    useData.getState().patch("nachrichten", n.id, {
      ki: vorschlag,
      kiStatus: aktuell.kiStatus === "uebernommen" ? "uebernommen" : "analysiert",
    });
    useAnalyse.setState({ ergebnisse: { ...useAnalyse.getState().ergebnisse, [n.id]: analyse } });
    const akte = analyse.akteId ? data.akten.find((a) => a.id === analyse.akteId) : undefined;
    const fristText = analyse.fristen.length ? `${analyse.fristen.length} ${analyse.fristen.length === 1 ? "Frist" : "Fristen"} erkannt` : "keine Frist erkannt";
    useData.getState().log({
      akteur: "ki",
      akteId: akte?.id,
      text: `Posteingang analysiert: „${n.betreff}“ – ${analyse.typ}, ${fristText}${akte ? `, Akte ${akte.aktenzeichen} zugeordnet (Vorschlag)` : ""}`,
      minutenGespart: 6,
    });
    return analyse;
  } catch (e) {
    clearInterval(takt);
    useAnalyse.setState({ fehler: { ...useAnalyse.getState().fehler, [n.id]: e instanceof Error ? e.message : String(e) } });
    return undefined;
  } finally {
    setSchritt(n.id, undefined);
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
    };
  }
  if (!n.ki || n.kiStatus === "ausstehend") return null;
  const rb = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, eingang: n.eingang, kanal: n.kanal }, data, land);
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
  };
}

/** Wurde dieser Fristvorschlag bereits in der Akte notiert? */
export function istNotiert(p: FristVorschlag, akteId: string | undefined, fristen: Frist[]): boolean {
  if (!akteId) return false;
  return fristen.some((f) => f.akteId === akteId && f.typ !== "vorfrist" && f.datum === p.ende && (f.regelKey === p.regelKey || f.titel === p.titel));
}

export function istGerichtspost(n: Nachricht): boolean {
  return n.kanal === "bea" && /gericht|justiz|kammergericht|staatsanwaltschaft|gerichtsvollzieher/i.test(`${n.von} ${n.vonAdresse ?? ""}`);
}

// ───────────────────────── Aktionen ─────────────────────────

/** Ordnet die Nachricht einer Akte zu und legt sie als Dokument in der E-Akte ab. */
export function zuordnen(n: Nachricht, akte: Akte, user: User, ansicht: KiAnsicht | null, opts: { leise?: boolean } = {}) {
  const { patch, upsert, log } = useData.getState();
  const ohneFristen = !ansicht || ansicht.fristen.length === 0;
  patch("nachrichten", n.id, {
    akteId: akte.id,
    zugeordnet: true,
    kiStatus: n.kiStatus === "analysiert" && ohneFristen && ansicht?.akteId === akte.id ? "uebernommen" : n.kiStatus,
  });
  const art: DokumentArt = ansicht?.dokumentArt ?? (n.kanal === "bea" ? "bea" : "email");
  const anhangKb = n.anhaenge.reduce((s, a) => s + a.groesseKb, 0);
  const dok: Dokument = {
    id: `dok-${n.id}`,
    akteId: akte.id,
    name: n.betreff,
    art,
    ordner: istGerichtspost(n) ? "Gericht" : "Korrespondenz",
    format: n.kanal === "email" ? "eml" : "pdf",
    groesseKb: Math.max(4, anhangKb || Math.ceil(n.text.length / 900)),
    inhalt: n.text,
    quelle: n.kanal === "bea" ? "bea" : "email",
    version: 1,
    createdAt: n.eingang,
    ki: ansicht ? { zusammenfassung: ansicht.zusammenfassung, erkannteFristen: ansicht.fristen.length } : undefined,
  };
  upsert("dokumente", dok);
  if (!opts.leise) log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Nachricht „${n.betreff}“ der Akte ${akte.aktenzeichen} zugeordnet und in der E-Akte abgelegt (${dok.ordner})` });
}

/** Übernimmt die erkannten Fristen (mit Vorfristen) in die Akte. Die Vier-Augen-Kontrolle bleibt offen. */
export function fristenUebernehmen(n: Nachricht, akte: Akte, user: User, ansicht: KiAnsicht, fristen: Frist[]): { anzahl: number; rueckgaengig: () => void } {
  const { patch, log } = useData.getState();
  if (n.akteId !== akte.id) zuordnen(n, akte, user, ansicht, { leise: true });
  let anzahl = 0;
  const neu: string[] = [];
  for (const p of ansicht.fristen) {
    if (istNotiert(p, akte.id, fristen)) continue;
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
  const rueckgaengig = () => {
    const st = useData.getState();
    neu.forEach((id) => st.remove("fristen", id));
    st.patch("nachrichten", n.id, { kiStatus: "analysiert" });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Fristübernahme aus dem Posteingang rückgängig gemacht (${n.betreff})` });
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

export function eebAbgeben(n: Nachricht, user: User) {
  const { patch, log } = useData.getState();
  patch("nachrichten", n.id, { eebAbgegeben: nowLocal() });
  log({ akteur: "nutzer", userId: user.id, akteId: n.akteId, text: `Elektronisches Empfangsbekenntnis abgegeben: ${n.betreff}` });
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

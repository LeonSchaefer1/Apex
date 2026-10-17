// Rechtsschutz (RSV) erfassen – gemeinsamer Weg für die Mandatsaufnahme (Schritt 3) und „Beteiligte → Rechtsschutz ergänzen“
// in der Akte (I4-T04-01): Rechtsschutz-Angaben mit Deckung „offen“, Versicherer als Kontakt, Deckungsanfrage als Entwurf
// (wartet auf die anwaltliche Freigabe) und Wiedervorlage „Deckungszusage …“. Beide Wege erzeugen dasselbe.
import type { Akte, Bundesland, Dokument, Frist, Kontakt, Rechtsschutz, Tenant, User } from "@/core/types";
import { fmtDate, fmtEUR, nowLocal, today, uid } from "@/core/dates";
import { VERSICHERUNGEN } from "@/core/seed/pools";
import { aktenVonKontakt, nameSchluessel } from "@/core/kontaktpruefung";
import { useData } from "@/store/data";
import { werktagIn } from "./helfer";

/** Eingaben wie in Schritt 3 der Mandatsaufnahme (Texte, Beträge im deutschen Format). */
export interface RsvEingabe {
  versicherung: string;
  nummer: string;
  schadennummer: string;
  selbstbeteiligung: string;
}

export const LEERE_RSV_EINGABE: RsvEingabe = { versicherung: "", nummer: "", schadennummer: "", selbstbeteiligung: "" };

/** Betrag „150“, „250,00“, „1.250,50 €“ → Zahl (NaN bei ungültiger Eingabe). */
export function rsvBetrag(s: string): number {
  const t = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Selbstbeteiligung: leer → keine; ungültig oder negativ → Fehler. */
export function sbFehlerhaft(s: string): boolean {
  if (!s.trim()) return false;
  const n = rsvBetrag(s);
  return Number.isNaN(n) || n < 0;
}

/** Rechtsschutz-Angaben aus der Eingabe – neue Versicherung immer mit Deckung „offen“. */
export function rsvAusEingabe(e: RsvEingabe): Rechtsschutz {
  const sb = e.selbstbeteiligung.trim() ? rsvBetrag(e.selbstbeteiligung) : undefined;
  return {
    versicherung: e.versicherung.trim(),
    versicherungsnummer: e.nummer.trim(),
    schadennummer: e.schadennummer.trim() || undefined,
    deckung: "offen",
    selbstbeteiligung: sb !== undefined && !Number.isNaN(sb) && sb >= 0 ? sb : undefined,
  };
}

/**
 * Versicherer zur Auswahl (I5-T04-01): Kontakte mit Rolle „Versicherung“ und die bekannten Rechtsschutzversicherer (ohne
 * Doppelung) – jede Option nennt ihre Rollen aus dem Aktenbestand („RSV in 116/26 · Gegnerin in 131/26“). Mehrspartenversicherer
 * sind je Akte etwas anderes; deshalb keine feste Unterart am Kontakt, sondern die Rollen je Akte.
 * Reihenfolge: bekannte Rechtsschutzversicherer (RSV in mindestens einer Akte oder „Rechtsschutz“ im Namen) – darin zuerst die,
 * die nirgends Gegner sind –, dann „Weitere Versicherer“, je Gruppe alphabetisch.
 */
export interface VersichererOption {
  name: string;
  kontakt?: Kontakt;
  /** Aktenzeichen, in denen der Versicherer Rechtsschutzversicherer ist */
  rsvAkten: string[];
  /** Aktenzeichen, in denen der Versicherer Gegner ist */
  gegnerAkten: string[];
  gruppe: "rsv" | "weitere";
  /** „RSV in 116/26 · Gegnerin in 131/26“ (höchstens zwei Aktenzeichen je Rolle, dann „…“) – leer ohne Akten */
  rollen: string;
}

export const VERSICHERER_GRUPPE: Record<VersichererOption["gruppe"], string> = { rsv: "Rechtsschutzversicherer", weitere: "Weitere Versicherer" };

/** „116/26“, „154/26, 150/26 …“ – höchstens zwei Aktenzeichen, dann „…“. */
function azListe(az: string[]): string {
  return az.length > 2 ? `${az.slice(0, 2).join(", ")} …` : az.join(", ");
}

/** Rollen-Zeile einer Option: „RSV in 116/26 · Gegnerin in 131/26“. */
export function rollenText(rsvAkten: string[], gegnerAkten: string[]): string {
  return [rsvAkten.length ? `RSV in ${azListe(rsvAkten)}` : "", gegnerAkten.length ? `Gegnerin in ${azListe(gegnerAkten)}` : ""].filter(Boolean).join(" · ");
}

const nachAz = (a: string, b: string) => b.localeCompare(a, "de", { numeric: true });

function option(name: string, kontakt: Kontakt | undefined, akten: Akte[]): VersichererOption {
  const schluessel = nameSchluessel(name);
  const rsvAkten = akten.filter((a) => !!a.rsv?.versicherung && nameSchluessel(a.rsv.versicherung) === schluessel).map((a) => a.aktenzeichen).sort(nachAz);
  const gegnerAkten = kontakt ? aktenVonKontakt(kontakt, akten).filter((x) => x.rolle === "Gegner").map((x) => x.akte.aktenzeichen).sort(nachAz) : [];
  const gruppe = rsvAkten.length > 0 || /rechtsschutz/i.test(name) ? "rsv" : "weitere";
  return { name, kontakt, rsvAkten, gegnerAkten, gruppe, rollen: rollenText(rsvAkten, gegnerAkten) };
}

export function versichererOptionen(kontakte: Kontakt[], akten: Akte[] = []): VersichererOption[] {
  const aus: VersichererOption[] = kontakte.filter((k) => k.rollen.includes("versicherung")).map((k) => option(k.name, k, akten));
  const schluessel = new Set(aus.map((o) => nameSchluessel(o.name)));
  // Bekannte Rechtsschutzversicherer: als Kontakt vorhanden (auch ohne Rolle) oder als Vorschlag, der beim Speichern angelegt wird
  for (const n of VERSICHERUNGEN) {
    if (schluessel.has(nameSchluessel(n))) continue;
    schluessel.add(nameSchluessel(n));
    const vorhanden = kontakte.find((k) => nameSchluessel(k.name) === nameSchluessel(n));
    aus.push(vorhanden ? option(vorhanden.name, vorhanden, akten) : option(n, undefined, akten));
  }
  const rang = (o: VersichererOption) => (o.gruppe === "rsv" ? (o.gegnerAkten.length ? 1 : 0) : 2);
  return aus.sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, "de"));
}

/** Gegner der eigenen Akte (Nachtragen: `akte.gegnerId`) bzw. des neuen Mandats (Mandatsaufnahme: eingegebener Gegner). */
export interface EigenerGegner {
  kontaktId?: string;
  name?: string;
  /** Aktenzeichen der eigenen Akte (Nachtragen) – fehlt in der Mandatsaufnahme */
  az?: string;
}

/**
 * Pflichtbestätigung bei der Versicherer-Wahl (I5-T04-01) – nur in zwei Fällen:
 * (a) Der Versicherer ist bisher nur als Gegner bekannt (nie RSV), z. B. die Hanseatische in 107/26;
 * (b) er ist Gegner der eigenen Akte bzw. des neuen Mandats.
 * Ein Mehrspartenversicherer, der woanders Gegner ist (Isarwerk, Elbtal), braucht in fremden Akten keine Bestätigung.
 */
export function versichererWarnung(name: string, kontakte: Kontakt[], akten: Akte[], eigenerGegner: EigenerGegner = {}): string | undefined {
  const n = name.trim();
  if (!n) return undefined;
  const schluessel = nameSchluessel(n);
  const kontakt = versichererKontakt(kontakte, n) ?? kontakte.find((k) => nameSchluessel(k.name) === schluessel);
  const o = option(kontakt?.name ?? n, kontakt, akten);
  const eigen = (!!eigenerGegner.kontaktId && eigenerGegner.kontaktId === kontakt?.id) || (!!eigenerGegner.name?.trim() && nameSchluessel(eigenerGegner.name) === schluessel);
  if (eigen) return `${o.name} ist Gegnerin ${eigenerGegner.az ? `in ${eigenerGegner.az}` : "in diesem Mandat"} – eine Deckungsanfrage ginge an die Gegenseite.`;
  if (o.gegnerAkten.length && !o.rsvAkten.length) return `${o.name} ist bisher nur als Gegnerin bekannt (${azListe(o.gegnerAkten)}) – eine Deckungsanfrage ginge an die Gegenseite.`;
  return undefined;
}

/** Passt der eingetippte Name zu einem vorhandenen Kontakt (gleicher Name ohne Rechtsform)? */
export function versichererKontakt(kontakte: Kontakt[], name: string): Kontakt | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return kontakte.find((k) => k.name.trim().toLowerCase() === n) ?? kontakte.find((k) => k.rollen.includes("versicherung") && nameSchluessel(k.name) === nameSchluessel(name));
}

/** Versicherer als Kontakt führen: vorhandenen Kontakt um die Rolle „Versicherung“ ergänzen oder neu anlegen. */
export function versichererSichern(name: string, jetzt = nowLocal()): Kontakt {
  const st = useData.getState();
  const vName = name.trim();
  const ex = versichererKontakt(st.data.kontakte, vName);
  if (ex) {
    if (!ex.rollen.includes("versicherung")) st.patch("kontakte", ex.id, { rollen: [...ex.rollen, "versicherung"] });
    return ex;
  }
  const k: Kontakt = { id: uid("k"), typ: "organisation", name: vName, firma: vName, rollen: ["versicherung"], createdAt: jetzt };
  st.upsert("kontakte", k);
  return k;
}

/** Deckungsanfrage als Entwurf (Ordner „Korrespondenz“) – erst nach anwaltlicher Freigabe versandt, nie im Portal. */
export function deckungsanfrageDokument(p: { akte: Akte; rsv: Rechtsschutz; mandant: Pick<Kontakt, "name">; gegnerName?: string; ra: Pick<User, "id" | "name" | "titel">; tenant: Pick<Tenant, "name" | "stadt">; jetzt?: string; heute?: string }): Dokument {
  const { akte, rsv, mandant, gegnerName, ra, tenant } = p;
  const jetzt = p.jetzt ?? nowLocal();
  const heute = p.heute ?? today();
  const gruss = `Mit freundlichen Grüßen\n\n${ra.name}\n${ra.titel}\n${tenant.name}`;
  const inhalt = `${rsv.versicherung}\nSchadenabteilung\n\n${tenant.stadt}, ${fmtDate(heute)}\n\nVersicherungsnehmer: ${mandant.name}\nVersicherungsnummer: ${rsv.versicherungsnummer || "wird nachgereicht"}${rsv.schadennummer ? `\nSchadennummer: ${rsv.schadennummer}` : ""}\nUnser Zeichen: ${akte.aktenzeichen}\n\nDeckungsanfrage – ${akte.titel}\n\nSehr geehrte Damen und Herren,\n\nwir zeigen an, dass uns Ihr Versicherungsnehmer mit der Wahrnehmung seiner rechtlichen Interessen beauftragt hat, und bitten um Erteilung der Deckungszusage für die außergerichtliche und gegebenenfalls gerichtliche Tätigkeit (${akte.sachgebiet}).\n\nSachverhalt:\n${akte.beschreibung || "Die ausführliche Sachverhaltsschilderung reichen wir kurzfristig nach."}${gegnerName ? `\n\nGegner: ${gegnerName}` : ""}\nGegenstandswert (vorläufig): ${fmtEUR(akte.gegenstandswert)}\n\nFür eine kurzfristige Bestätigung wären wir dankbar.\n\n${gruss}`;
  return {
    id: uid("d"),
    akteId: akte.id,
    name: `Deckungsanfrage ${rsv.versicherung}`,
    art: "brief",
    ordner: "Korrespondenz",
    format: "docx",
    status: "entwurf",
    groesseKb: Math.round(28 + inhalt.length / 40),
    seiten: Math.max(1, Math.ceil(inhalt.length / 1800)),
    inhalt,
    quelle: "generiert",
    autorId: ra.id,
    version: 1,
    createdAt: jetzt,
  };
}

/** Wiedervorlage „Deckungszusage …“ – 7 Tage nach heute, auf den nächsten Werktag verschoben. */
export function deckungsWiedervorlage(p: { akteId: string; versicherung: string; verantwortlichId: string; land: Bundesland; jetzt?: string; notiz: string }): Frist {
  return {
    id: uid("f"),
    akteId: p.akteId,
    titel: `Wiedervorlage: Deckungszusage ${p.versicherung}`,
    typ: "wiedervorlage",
    datum: werktagIn(7, p.land),
    status: "offen",
    verantwortlichId: p.verantwortlichId,
    quelle: "automatisch",
    createdAt: p.jetzt ?? nowLocal(),
    notiz: p.notiz,
  };
}

/** Lauf der Automatik „Deckungsanfrage“ im 38h-Motor protokollieren (Zähler und Verlauf). */
export function deckungsanfrageProtokollieren(akte: Pick<Akte, "id" | "aktenzeichen">, versicherung: string, wiedervorlage: string, jetzt = nowLocal()) {
  const st = useData.getState();
  st.log({
    akteur: "automation",
    automationKey: "deckungsanfrage",
    akteId: akte.id,
    minutenGespart: 15,
    text: `Deckungsanfrage an ${versicherung} erstellt, Wiedervorlage am ${fmtDate(wiedervorlage)} gesetzt – ${akte.aktenzeichen}`,
  });
  const au = st.data.automationen.find((a) => a.key === "deckungsanfrage");
  if (au) st.patch("automationen", au.id, { laeufe: au.laeufe + 1, letzterLauf: jetzt });
}

/**
 * „Rechtsschutz ergänzen“ in einer bestehenden Akte: dasselbe wie die Mandatsaufnahme mit Rechtsschutz –
 * `akte.rsv` (Deckung offen), Versicherer als Kontakt, Deckungsanfrage-Entwurf, Wiedervorlage und Verlauf.
 */
export function rsvNachtragen(p: { akte: Akte; eingabe: RsvEingabe; user: User; team: User[]; tenant: Tenant }): { rsv: Rechtsschutz; dokument: Dokument; wiedervorlage: Frist } {
  const { akte, eingabe, user, team, tenant } = p;
  const st = useData.getState();
  const jetzt = nowLocal();
  const kontakt = versichererSichern(eingabe.versicherung, jetzt);
  const rsv: Rechtsschutz = { ...rsvAusEingabe(eingabe), versicherung: kontakt.name };
  const neu: Akte = { ...akte, rsv, updatedAt: jetzt };
  st.patch("akten", akte.id, { rsv, updatedAt: jetzt });

  const mandant = st.data.kontakte.find((k) => k.id === akte.mandantId) ?? { name: "Versicherungsnehmer" };
  const gegner = akte.gegnerId ? st.data.kontakte.find((k) => k.id === akte.gegnerId) : undefined;
  const ra = team.find((u) => u.id === akte.bearbeiterId) ?? user;
  const refa = (akte.sachbearbeiterId ? team.find((u) => u.id === akte.sachbearbeiterId) : undefined) ?? team.find((u) => u.rolle === "refa");
  const dokument = deckungsanfrageDokument({ akte: neu, rsv, mandant, gegnerName: gegner?.name, ra, tenant, jetzt });
  st.upsert("dokumente", dokument);
  const wiedervorlage = deckungsWiedervorlage({
    akteId: akte.id,
    versicherung: rsv.versicherung,
    verantwortlichId: refa?.id ?? ra.id,
    land: tenant.bundesland,
    jetzt,
    notiz: "Automatisch gesetzt beim Ergänzen des Rechtsschutzes (Beteiligte → Rechtsschutz ergänzen).",
  });
  st.upsert("fristen", wiedervorlage);

  const angaben = [
    rsv.versicherungsnummer ? `VS-Nr. ${rsv.versicherungsnummer}` : "VS-Nr. wird nachgereicht",
    rsv.schadennummer ? `Schaden-Nr. ${rsv.schadennummer}` : "",
    rsv.selbstbeteiligung !== undefined ? `Selbstbeteiligung ${fmtEUR(rsv.selbstbeteiligung)}` : "",
  ].filter(Boolean);
  st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Rechtsschutz ergänzt: ${rsv.versicherung} (Deckung offen) · ${angaben.join(" · ")} – ${akte.aktenzeichen}` });
  deckungsanfrageProtokollieren(akte, rsv.versicherung, wiedervorlage.datum, jetzt);
  return { rsv, dokument, wiedervorlage };
}

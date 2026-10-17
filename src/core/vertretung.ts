// Abwesenheit und Vertretung (§ 53 BRAO) – reine Fachlogik ohne React.
import { addDays, wochentagName } from "./dates";
import { offeneVerantwortung, zaehltAlsFrist, type OffeneVerantwortung } from "./fristenLage";
import type { Frist, ID, ISODate, User } from "./types";

/** Ist die Person am Tag `heute` laut eingetragener Abwesenheit abwesend? (von und bis jeweils einschließlich) */
export function istAbwesend(u: User, heute: ISODate): boolean {
  const a = u.abwesenheit;
  if (!a || !a.von || !a.bis) return false;
  const tag = heute.slice(0, 10);
  return a.von.slice(0, 10) <= tag && tag <= a.bis.slice(0, 10);
}

/**
 * Berufsträger im Sinne der Vertretung (§ 53 BRAO), der Aktenbearbeitung und der Fristverantwortung:
 * Partner und Rechtsanwälte – nicht Fachangestellte, Auszubildende oder die Administration.
 */
export function istBerufstraeger(u: Pick<User, "rolle">): boolean {
  return u.rolle === "partner" || u.rolle === "anwalt";
}

/** IDs aller Personen, die heute abwesend sind und `userId` als Vertretung eingetragen haben. */
export function vertreteneIds(team: User[], userId: ID, heute: ISODate): ID[] {
  return team
    .filter((u) => u.id !== userId && u.abwesenheit?.vertretungId === userId && istAbwesend(u, heute))
    .map((u) => u.id);
}

/**
 * Wer vertritt `userId` am Tag `heute`? Die eingetragene Vertretung – nur solange die Person abwesend ist.
 * `undefined`, wenn sie anwesend ist, keine Vertretung eingetragen hat oder die Vertretung deaktiviert ist.
 */
export function vertretungFuer(team: User[], userId: ID, heute: ISODate): User | undefined {
  const person = team.find((u) => u.id === userId);
  if (!person || !istAbwesend(person, heute)) return undefined;
  const vid = person.abwesenheit?.vertretungId;
  if (!vid || vid === userId) return undefined;
  const v = team.find((u) => u.id === vid);
  return v && !v.deaktiviert ? v : undefined;
}

export interface VertretungsUmfang {
  /** Letzter gezählter Tag: Ende der Abwesenheit (bzw. heute + 7 Tage, wenn kein Ende eingetragen ist). */
  bis: ISODate;
  /** true = `bis` ist das eingetragene Ende der Abwesenheit. */
  bisAbwesenheitsende: boolean;
  /** offene Fristen und Notfristen der vertretenen Person bis `bis` (auch überfällige). */
  fristen: number;
  /** offene Wiedervorlagen und Vorfristen bis `bis`. */
  weitere: number;
}

/**
 * Umfang einer Vertretung: alle offenen Einträge der vertretenen Person über den gesamten Abwesenheitszeitraum
 * (nicht nur die nächsten 7 Tage) – Termine zählen nicht mit.
 */
export function vertretungsUmfang(fristen: Frist[], person: User, heute: ISODate): VertretungsUmfang {
  const ende = person.abwesenheit?.bis?.slice(0, 10);
  const bisAbwesenheitsende = !!ende && ende >= heute.slice(0, 10);
  const bis = bisAbwesenheitsende ? ende! : addDays(heute.slice(0, 10), 7);
  const seine = fristen.filter((f) => f.status === "offen" && f.verantwortlichId === person.id && f.typ !== "termin" && f.datum <= bis);
  const echte = seine.filter(zaehltAlsFrist).length;
  return { bis, bisAbwesenheitsende, fristen: echte, weitere: seine.length - echte };
}

/** Eine Vertretung, die noch nicht begonnen hat – mit den Einträgen der abwesenden Person im Zeitraum. */
export interface KuenftigeVertretung {
  person: User;
  von: ISODate;
  bis: ISODate;
  /** offene Fristen, Notfristen, Wiedervorlagen und Vorfristen der Person mit Datum von–bis (keine Termine), nach Datum sortiert. */
  fristen: Frist[];
}

/**
 * Vertretung vorab (I4-T18-04, § 53 BRAO): Abwesenheiten ANDERER Personen mit `userId` als Vertretung, die noch nicht begonnen
 * haben und spätestens in `vorlaufTage` Tagen beginnen. Ab dem ersten Abwesenheitstag gilt `vertreteneIds`.
 * Ist die Vertretung selbst deaktiviert, gibt es nichts zu übernehmen.
 */
export function kuenftigeVertretungen(team: User[], fristen: Frist[], userId: ID, heute: ISODate, vorlaufTage = 14): KuenftigeVertretung[] {
  const ich = team.find((u) => u.id === userId);
  if (ich?.deaktiviert) return [];
  const tag = heute.slice(0, 10);
  const spaetestens = addDays(tag, vorlaufTage);
  const out: KuenftigeVertretung[] = [];
  for (const u of team) {
    const a = u.abwesenheit;
    if (u.id === userId || !a?.von || !a.bis || a.vertretungId !== userId) continue;
    const von = a.von.slice(0, 10);
    const bis = a.bis.slice(0, 10);
    if (von <= tag || von > spaetestens || bis < von) continue;
    const seine = fristen
      .filter((f) => f.status === "offen" && f.verantwortlichId === u.id && f.typ !== "termin" && f.datum >= von && f.datum <= bis)
      .sort((x, y) => x.datum.localeCompare(y.datum) || (x.uhrzeit ?? "").localeCompare(y.uhrzeit ?? ""));
    out.push({ person: u, von, bis, fristen: seine });
  }
  return out.sort((x, y) => x.von.localeCompare(y.von));
}

/** „Mo, 19.10.“ */
export function tagKurz(iso: ISODate): string {
  return `${wochentagName(iso, true)}, ${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

function zahlWort(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

/** Umfang einer künftigen Vertretung in Worten: „4 Fristen“, „2 Fristen, dazu 1 Wiedervorlage“ (Zählweise wie `fristenLage`). */
export function vertretungUmfangText(fristen: Frist[]): string {
  const echte = fristen.filter(zaehltAlsFrist).length;
  const wv = fristen.filter((f) => f.typ === "wiedervorlage").length;
  const vf = fristen.filter((f) => f.typ === "vorfrist").length;
  const dazu = [wv ? zahlWort(wv, "Wiedervorlage", "Wiedervorlagen") : "", vf ? zahlWort(vf, "Vorfrist", "Vorfristen") : ""].filter(Boolean);
  if (!echte && !dazu.length) return "keine offenen Fristen";
  if (!echte) return `keine Frist, aber ${dazu.join(" und ")}`;
  return `${zahlWort(echte, "Frist", "Fristen")}${dazu.length ? `, dazu ${dazu.join(" und ")}` : ""}`;
}

/**
 * Hinweis vor dem ersten Abwesenheitstag (I4-T18-04): „Ab Mo, 19.10. vertreten Sie Jonas Brandt (bis Fr, 30.10.) – 4 Fristen im
 * Zeitraum, die erste Mo, 19.10.: Replik auf Klageerwiderung (137/26)“. `aktenzeichen` liefert das Az. zur Akte.
 */
export function vertretungVorabText(v: KuenftigeVertretung, aktenzeichen: (akteId: ID) => string | undefined): string {
  const kopf = `Ab ${tagKurz(v.von)} vertreten Sie ${v.person.name} (bis ${tagKurz(v.bis)})`;
  if (!v.fristen.length) return `${kopf} – im Zeitraum liegen keine offenen Fristen.`;
  const erste = v.fristen[0];
  const az = aktenzeichen(erste.akteId);
  return `${kopf} – ${vertretungUmfangText(v.fristen)} im Zeitraum, die erste ${tagKurz(erste.datum)}: ${erste.titel}${az ? ` (${az})` : ""}`;
}

// ───────────── Deaktivieren bzw. Entfernen eines Zugangs: wer übernimmt die offenen Fristen? (I5-T23-01) ─────────────

/** Bewusste Wahl im Feld „Bearbeitung und Fristverantwortung übertragen an …“: „Nicht übertragen – ich stelle die Überwachung selbst sicher“. */
export const NICHT_UEBERTRAGEN = "nicht-uebertragen";

/**
 * Vorbelegung des Felds „Bearbeitung und Fristverantwortung übertragen an …“ – in dieser Reihenfolge:
 * 1. die eingetragene Vertretung der Person, wenn sie aktiv ist und übernehmen darf (Partner/Anwalt),
 * 2. sonst die angemeldete Person, wenn sie übernehmen darf,
 * 3. sonst leer – dann ist die Wahl Pflicht („Bitte wählen …“).
 * Fristen eines gesperrten Zugangs bleiben so nie still ohne aktive verantwortliche Person (Organisationspflicht).
 */
export function uebertragungVorbelegung(person: Pick<User, "id" | "abwesenheit">, angemeldet: Pick<User, "id">, kandidaten: Pick<User, "id" | "rolle" | "deaktiviert">[]): ID | "" {
  const darf = (id: ID | undefined): id is ID => !!id && id !== person.id && kandidaten.some((k) => k.id === id && !k.deaktiviert && istBerufstraeger(k));
  const vertretung = person.abwesenheit?.vertretungId;
  if (darf(vertretung)) return vertretung;
  if (darf(angemeldet.id)) return angemeldet.id;
  return "";
}

/**
 * Warum „Deaktivieren“ bzw. „Zugang entfernen“ noch gesperrt ist – `undefined` = ausführbar.
 * Ohne offene Fristen bleibt der Ablauf frei; sonst ist eine Person zu wählen oder „Nicht übertragen“ mit Pflichthäkchen.
 */
export function uebertragungSperrgrund(o: { offeneFristen: number; wahl: string; bestaetigt: boolean; name: string }): string | undefined {
  if (o.offeneFristen <= 0) return undefined;
  const fristen = o.offeneFristen === 1 ? "die offene Frist" : `die ${o.offeneFristen} offenen Fristen`;
  if (!o.wahl) return `Bitte wählen Sie, wer ${fristen} von ${o.name} übernimmt.`;
  if (o.wahl === NICHT_UEBERTRAGEN && !o.bestaetigt) return `Bitte bestätigen Sie, dass Sie die Überwachung für ${fristen} von ${o.name} sicherstellen.`;
  return undefined;
}

/** „7 offene Fristen, dazu 1 Wiedervorlage und 1 Termin“ – Fristen zuerst, übrige Einträge getrennt genannt (Zählweise wie `fristenLage`). */
export function verantwortungText(v: OffeneVerantwortung): string {
  const dazu = [
    v.wiedervorlagen.length ? zahlWort(v.wiedervorlagen.length, "Wiedervorlage", "Wiedervorlagen") : "",
    v.termine.length ? zahlWort(v.termine.length, "Termin", "Termine") : "",
    v.vorfristen.length ? zahlWort(v.vorfristen.length, "Vorfrist", "Vorfristen") : "",
  ].filter(Boolean);
  const liste = (x: string[]) => (x.length > 1 ? `${x.slice(0, -1).join(", ")} und ${x[x.length - 1]}` : x[0] ?? "");
  if (!v.fristen.length) return dazu.length ? liste(dazu) : "keine offenen Einträge";
  return `${zahlWort(v.fristen.length, "offene Frist", "offene Fristen")}${dazu.length ? `, dazu ${liste(dazu)}` : ""}`;
}

export interface VerwaisteVerantwortung {
  /** deaktivierter Zugang */
  person: User;
  offen: OffeneVerantwortung;
}

/** Offene Einträge, die auf einen deaktivierten Zugang zeigen – je Person, mit den meisten Fristen zuerst (Cockpit-Hinweis). */
export function fristenDeaktivierterZugaenge(fristen: Frist[], team: User[]): VerwaisteVerantwortung[] {
  return team
    .filter((u) => u.deaktiviert)
    .map((person) => ({ person, offen: offeneVerantwortung(fristen, person.id) }))
    .filter((x) => x.offen.alle.length > 0)
    .sort((a, b) => b.offen.fristen.length - a.offen.fristen.length || b.offen.alle.length - a.offen.alle.length);
}

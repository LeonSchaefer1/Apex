// Abwesenheit und Vertretung (§ 53 BRAO) – reine Fachlogik ohne React.
import { addDays } from "./dates";
import { zaehltAlsFrist } from "./fristenLage";
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

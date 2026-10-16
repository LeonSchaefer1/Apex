// Abwesenheit und Vertretung (§ 53 BRAO) – reine Fachlogik ohne React.
import type { ID, ISODate, User } from "./types";

/** Ist die Person am Tag `heute` laut eingetragener Abwesenheit abwesend? (von und bis jeweils einschließlich) */
export function istAbwesend(u: User, heute: ISODate): boolean {
  const a = u.abwesenheit;
  if (!a || !a.von || !a.bis) return false;
  const tag = heute.slice(0, 10);
  return a.von.slice(0, 10) <= tag && tag <= a.bis.slice(0, 10);
}

/** IDs aller Personen, die heute abwesend sind und `userId` als Vertretung eingetragen haben. */
export function vertreteneIds(team: User[], userId: ID, heute: ISODate): ID[] {
  return team
    .filter((u) => u.id !== userId && u.abwesenheit?.vertretungId === userId && istAbwesend(u, heute))
    .map((u) => u.id);
}

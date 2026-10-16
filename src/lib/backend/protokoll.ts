// Kanzleiprotokoll: echte Vorgänge rund um Zugänge und Datenbestand – gleiche Texte im Demo-Backend und auf dem Server.
// Diese Einträge liegen getrennt von den (ggf. täglich neu erzeugten) Beispieldaten und werden beim Laden eingemischt,
// damit Anmeldungen, Passwortvergaben und Anbieter-Eingriffe nie verloren gehen.
import type { Aktivitaet, ID } from "@/core/types";

/** Zeitstempel in deutscher Ortszeit („2026-10-16T09:30:00“) – wie die übrigen Aktivitäten, auch auf einem Server in UTC. */
export function zeitBerlin(d = new Date()): string {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${teile.year}-${teile.month}-${teile.day}T${teile.hour}:${teile.minute}:${teile.second}`;
}

export const VORGANG = {
  zugangAngelegt: (name: string, rolle: string) => `Zugang für ${name} angelegt (${rolle}) – durch AnwaltApex (Apex Console)`,
  startpasswortVergeben: (name: string) => `Startpasswort für ${name} vergeben – eigenes Passwort bei der ersten Anmeldung Pflicht`,
  ersteAnmeldung: (name: string) => `Erste Anmeldung von ${name}`,
  eigenesPasswort: (name: string) => `Eigenes Passwort festgelegt – ${name}`,
  consolePasswort: (name: string) => `Startpasswort für ${name} durch AnwaltApex (Apex Console) neu vergeben`,
  standardPasswort: (name: string) => `Demo-Passwort für ${name} durch AnwaltApex (Apex Console) wiederhergestellt`,
  beispieldatenZurueckgesetzt: (durch?: string) => (durch ? `Beispieldaten zurückgesetzt – durch ${durch}` : "Beispieldaten durch AnwaltApex (Apex Console) zurückgesetzt"),
  zweiFaktorEingerichtet: (name: string) => `Zwei-Faktor-Anmeldung eingerichtet – ${name}`,
  zweiFaktorDeaktiviert: (name: string) => `Zwei-Faktor-Anmeldung deaktiviert – ${name}`,
  zweiFaktorZurueckgesetzt: (name: string, durch: string) => `Zwei-Faktor-Anmeldung von ${name} zurückgesetzt – durch ${durch}`,
  zweiFaktorWiederherstellung: (name: string) => `Anmeldung mit Wiederherstellungscode – ${name}`,
  anmeldung: (name: string) => `Anmeldung – ${name}`,
  abmeldung: (name: string) => `Abmeldung – ${name}`,
  anmeldungFehlgeschlagen: (name: string, grund: FehlGrund) => `Anmeldung fehlgeschlagen (${FEHL_GRUND[grund]}) – ${name}`,
  sperreInaktivitaet: (name: string) => `Sperre wegen Inaktivität – ${name}`,
  fehlversucheWarnung: (name: string, n: number) => `${n} fehlgeschlagene Anmeldungen für ${name} innerhalb von 15 Minuten – bitte prüfen`,
  bundeslandGeaendert: (vorher: string, nachher: string) => `Bundesland geändert: ${vorher} → ${nachher}`,
} as const;

/** Grund eines Fehlversuchs – nie das eingegebene Passwort. */
export type FehlGrund = "passwort" | "startpasswort" | "zweifaktor";
export const FEHL_GRUND: Record<FehlGrund, string> = {
  passwort: "falsches Passwort",
  startpasswort: "Startpasswort nicht mehr gültig",
  zweifaktor: "Zwei-Faktor-Code falsch",
};

/** Ab so vielen Fehlversuchen für dasselbe Konto innerhalb des Fensters gibt es einen Hinweis an Partner und Administration. */
export const ANMELDE_WARN_SCHWELLE = 3;
export const ANMELDE_WARN_FENSTER_MS = 15 * 60_000;

/** Anmeldeereignis im Kanzleiprotokoll (Filter „Anmeldungen“). */
export function anmeldeVorgang(text: string, opts: { akteur: "system" | "nutzer"; userId?: ID; meldung?: boolean }): Aktivitaet {
  const a = vorgang(text, opts);
  return { ...a, kategorie: "anmeldung", ...(opts.meldung ? { meldung: true } : {}) };
}

/**
 * Zählt Fehlversuche je Konto (nur im Arbeitsspeicher). Liefert die Anzahl im Fenster – genau beim Erreichen der Schwelle
 * meldet der Aufrufer „3 fehlgeschlagene Anmeldungen für …“.
 */
export function zaehleFehlversuch(speicher: Map<string, number[]>, kontoId: string, jetzt = Date.now()): number {
  const liste = (speicher.get(kontoId) ?? []).filter((t) => jetzt - t < ANMELDE_WARN_FENSTER_MS);
  liste.push(jetzt);
  speicher.set(kontoId, liste);
  if (speicher.size > 5000) for (const [k, v] of speicher) if (!v.some((t) => jetzt - t < ANMELDE_WARN_FENSTER_MS)) speicher.delete(k);
  return liste.length;
}

let zaehler = 0;
/** Neuer Protokolleintrag. `system`: Vorgang durch AnwaltApex bzw. das System; `nutzer`: von der Person selbst ausgelöst. */
export function vorgang(text: string, opts: { akteur: "system" | "nutzer"; userId?: ID; zeit?: string }): Aktivitaet {
  zaehler = (zaehler + 1) % 1_000_000;
  const zufall = Math.random().toString(36).slice(2, 8);
  return { id: `vg-${Date.now().toString(36)}-${zaehler}-${zufall}`, zeit: opts.zeit ?? zeitBerlin(), akteur: opts.akteur, userId: opts.userId, text, icon: "shield" };
}

/** Echte Vorgänge in den Datenbestand einmischen (ohne Dubletten, neueste zuerst). */
export function mischeVorgaenge(aktivitaeten: Aktivitaet[], vorgaenge: Aktivitaet[]): Aktivitaet[] {
  if (!vorgaenge.length) return aktivitaeten;
  const ids = new Set(aktivitaeten.map((a) => a.id));
  const neu = vorgaenge.filter((v) => !ids.has(v.id));
  if (!neu.length) return aktivitaeten;
  return [...aktivitaeten, ...neu].sort((a, b) => b.zeit.localeCompare(a.zeit));
}

/** Jüngster echter Vorgang bzw. jüngste echte Anmeldung – Beispieleinträge (`beispiel`) zählen nie. */
export function letzteEchteAktivitaet(werte: (string | null | undefined)[]): string | undefined {
  return werte.filter((x): x is string => !!x).sort().pop();
}

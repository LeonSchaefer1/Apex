// Kanzleiprotokoll (Anmeldungen, Fehlversuche, Abmeldung) und Teamregeln (§ 53 BRAO) – gleiche Logik in Demo-Backend und Server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANMELDE_WARN_FENSTER_MS, ANMELDE_WARN_SCHWELLE, VORGANG, anmeldeVorgang, mischeVorgaenge, vorgang, zaehleFehlversuch } from "../lib/backend/protokoll";
import { pruefeTeamAenderung } from "../lib/backend/types";
import type { User } from "./types";

function person(id: string, extra: Partial<User> = {}): User {
  return { id, tenantId: "t", name: id, email: `${id}@kanzlei.de`, rolle: "anwalt", titel: "Rechtsanwalt", initialen: "XX", farbe: "#000", ...extra };
}

test("Protokoll: Anmeldung, Fehlversuch und Abmeldung tragen die Kategorie „anmeldung“", () => {
  const erfolg = anmeldeVorgang(VORGANG.anmeldung("Claudia Reinholz"), { akteur: "nutzer", userId: "u1" });
  assert.equal(erfolg.text, "Anmeldung – Claudia Reinholz");
  assert.equal(erfolg.kategorie, "anmeldung");
  assert.equal(erfolg.akteur, "nutzer");
  assert.equal(erfolg.userId, "u1");
  assert.equal(erfolg.meldung, undefined, "eine normale Anmeldung ist keine Meldung an die Verwaltung");

  const fehl = anmeldeVorgang(VORGANG.anmeldungFehlgeschlagen("Mia Becker", "passwort"), { akteur: "system", userId: "u2" });
  assert.equal(fehl.text, "Anmeldung fehlgeschlagen (falsches Passwort) – Mia Becker");
  assert.equal(fehl.kategorie, "anmeldung");
  assert.equal(fehl.akteur, "system");

  const ab = anmeldeVorgang(VORGANG.abmeldung("Mia Becker"), { akteur: "nutzer", userId: "u2" });
  assert.equal(ab.text, "Abmeldung – Mia Becker");
  assert.equal(ab.kategorie, "anmeldung");

  assert.equal(VORGANG.anmeldungFehlgeschlagen("X", "startpasswort"), "Anmeldung fehlgeschlagen (Startpasswort nicht mehr gültig) – X");
  assert.equal(VORGANG.anmeldungFehlgeschlagen("X", "zweifaktor"), "Anmeldung fehlgeschlagen (Zwei-Faktor-Code falsch) – X");
  assert.equal(VORGANG.sperreInaktivitaet("X"), "Sperre wegen Inaktivität – X");
});

test("Protokoll: Hinweis an die Verwaltung erst beim dritten Fehlversuch im 15-Minuten-Fenster", () => {
  assert.equal(ANMELDE_WARN_SCHWELLE, 3);
  const speicher = new Map<string, number[]>();
  const t0 = Date.parse("2026-10-16T09:00:00Z");
  assert.equal(zaehleFehlversuch(speicher, "u2", t0), 1);
  assert.equal(zaehleFehlversuch(speicher, "u2", t0 + 60_000), 2);
  assert.equal(zaehleFehlversuch(speicher, "anderes-konto", t0 + 90_000), 1, "je Konto getrennt");
  assert.equal(zaehleFehlversuch(speicher, "u2", t0 + 120_000), 3);
  // nach Ablauf des Fensters beginnt die Zählung neu
  assert.equal(zaehleFehlversuch(speicher, "u2", t0 + 120_000 + ANMELDE_WARN_FENSTER_MS), 1);

  const warn = anmeldeVorgang(VORGANG.fehlversucheWarnung("Mia Becker", 3), { akteur: "system", userId: "u2", meldung: true });
  assert.equal(warn.meldung, true);
  assert.match(warn.text, /^3 fehlgeschlagene Anmeldungen für Mia Becker innerhalb von 15 Minuten/);
});

test("Protokoll: Vorgänge werden ohne Dubletten und neueste zuerst eingemischt", () => {
  const a = vorgang("alt", { akteur: "system", zeit: "2026-10-15T08:00:00" });
  const b = vorgang("neu", { akteur: "nutzer", zeit: "2026-10-16T09:30:00" });
  const gemischt = mischeVorgaenge([a], [a, b]);
  assert.deepEqual(gemischt.map((x) => x.text), ["neu", "alt"]);
});

test("Team: Vertretung eines Berufsträgers nur durch Partner oder Anwälte (§ 53 BRAO), Sachbearbeitung getrennt", () => {
  const julia = person("julia", { rolle: "partner", titel: "Rechtsanwältin · Partnerin" });
  const jonas = person("jonas", { rolle: "anwalt" });
  const mia = person("mia", { rolle: "refa", titel: "Rechtsanwaltsfachangestellte" });
  const jana = person("jana", { rolle: "refa", titel: "Rechtsanwaltsfachangestellte" });
  const team = { users: [julia, jonas, mia, jana] };
  const zeitraum = { von: "2026-10-12", bis: "2026-10-30" };

  assert.throws(() => pruefeTeamAenderung(team, julia, jonas, { abwesenheit: { ...zeitraum, vertretungId: "mia" } }), /§ 53 BRAO/);
  assert.doesNotThrow(() => pruefeTeamAenderung(team, julia, jonas, { abwesenheit: { ...zeitraum, vertretungId: "julia", sachbearbeitungId: "mia" } }));
  // Fachangestellte vertreten sich untereinander – das ist keine Vertretung nach § 53 BRAO
  assert.doesNotThrow(() => pruefeTeamAenderung(team, julia, mia, { abwesenheit: { ...zeitraum, vertretungId: "jana" } }));
  assert.throws(() => pruefeTeamAenderung(team, julia, jonas, { abwesenheit: { ...zeitraum, sachbearbeitungId: "jonas" } }), /andere Person/);
});

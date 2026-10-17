// Kanzleiprotokoll (Anmeldungen, Fehlversuche, Abmeldung) und Teamregeln (§ 53 BRAO) – gleiche Logik in Demo-Backend und Server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANMELDE_WARN_FENSTER_MS, ANMELDE_WARN_SCHWELLE, VORGANG, anbieterUrheber, anbieterVorgang, anmeldeVorgang, istAnbieterEintrag, mischeVorgaenge, vorgang, zaehleFehlversuch } from "../lib/backend/protokoll";
import { pruefeDokument } from "../lib/backend/schema";
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

// Usability-Iteration 3 (A-08, A-09, A-15, A-16): Anbieter-Eingriff mit Person und Anlass, Ortsdatum, eigenes Passwort, Automatiken
test("Console: Startpasswort nur mit Anforderer und Anlass – Protokoll nennt Anbieter-Person, Anforderer und Anlass", async () => {
  const { pruefeConsolePasswortAnlass } = await import("../lib/backend/protokoll");
  assert.deepEqual(Object.keys(pruefeConsolePasswortAnlass({})), ["angefordertVon", "anlass"]);
  assert.deepEqual(Object.keys(pruefeConsolePasswortAnlass({ angefordertVon: "Dr. Julia Hartmann", anlass: "" })), ["anlass"]);
  assert.deepEqual(pruefeConsolePasswortAnlass({ angefordertVon: "Dr. Julia Hartmann", anlass: "Passwort vergessen – telefonisch angefordert" }), {});
  const text = VORGANG.consolePasswort("Mia Becker", { angefordertVon: "Dr. Julia Hartmann", anlass: "Passwort vergessen – telefonisch angefordert", bearbeiter: "Lena Vogt" });
  assert.equal(text, "Startpasswort für Mia Becker durch AnwaltApex neu vergeben – Lena Vogt auf Anforderung von Dr. Julia Hartmann, Anlass: Passwort vergessen – telefonisch angefordert");
  // ohne bearbeitende Person: der angemeldete Console-Zugang
  assert.match(VORGANG.consolePasswort("Mia Becker", { angefordertVon: "Dr. Julia Hartmann", anlass: "Passwort vergessen" }, "AnwaltApex Team"), /– AnwaltApex Team auf Anforderung von Dr\. Julia Hartmann/);
  assert.doesNotMatch(text, /\(System\)/);
  // Hinweis in der Glocke nur für Partner und Administration (Kategorie „anmeldung“ mit Meldung)
  const a = anmeldeVorgang(text, { akteur: "system", userId: "u3", meldung: true });
  assert.equal(a.kategorie, "anmeldung");
  assert.equal(a.meldung, true);
});

test("Kundenanlage um 01:05 Uhr Ortszeit (23:05 UTC): Lizenz „seit“ ist das Ortsdatum", async () => {
  const { baueKunde } = await import("./seed/kunde");
  const { heuteBerlin } = await import("./dates");
  const nacht = new Date("2026-10-16T23:05:00Z"); // = Sa, 17.10.2026, 01:05 Uhr (MESZ)
  assert.equal(heuteBerlin(nacht), "2026-10-17");
  const { tenant } = baueKunde({ kanzlei: "Reinholz & Hollmann", stadt: "Paderborn", bundesland: "NW", adminName: "Claudia Reinholz", adminEmail: "c@kanzlei.de", arbeitsplaetze: 7, schwerpunkte: [], testBis: "2026-11-16" }, "probe", nacht);
  assert.equal(tenant.lizenz.seit, "2026-10-17");
  assert.match(tenant.lizenz.lizenzNr, /^AAX-LT-2026-/);
  // Winterzeit: 23:30 UTC am 31.12. ist schon Neujahr in Berlin
  assert.equal(heuteBerlin(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assert.equal(heuteBerlin(new Date("2026-10-17T21:59:00Z")), "2026-10-17");
});

test("Eigenes Passwort ändern: Protokolltext und Regeln wie bei der ersten Anmeldung", async () => {
  const { pruefeNeuesPasswort, ALTES_PASSWORT_FALSCH } = await import("../lib/backend/types");
  assert.equal(VORGANG.eigenesPasswortGeaendert("Mia Becker"), "Eigenes Passwort geändert – Mia Becker");
  assert.match(pruefeNeuesPasswort("kurz1", "Apex-Demo-2026", "dem bisherigen Passwort")!, /zu kurz/);
  assert.match(pruefeNeuesPasswort("Apex-Demo-2026", "Apex-Demo-2026", "dem bisherigen Passwort")!, /identisch mit dem bisherigen Passwort/);
  assert.equal(pruefeNeuesPasswort("Mia-Neu-Passwort-2026", "Apex-Demo-2026", "dem bisherigen Passwort"), null);
  assert.match(ALTES_PASSWORT_FALSCH, /Team & Zugänge/);
});

test("Protokoll: Automatik pausieren nennt Person und Folge; Rechnungsangaben nennen die Felder", async () => {
  const { automatikSchaltText } = await import("../lib/backend/protokoll");
  const t = automatikSchaltText({ key: "posteingang-fristen", name: "Fristen aus Posteingang erkennen" }, false, "Dr. Julia Hartmann");
  assert.equal(t, "Automatik „Fristen aus Posteingang erkennen“ pausiert – durch Dr. Julia Hartmann. Neue beA-Nachrichten werden dann nicht mehr auf Fristen geprüft – Sie notieren Fristen von Hand.");
  assert.equal(automatikSchaltText({ key: "eeb", name: "Empfangsbekenntnis (eEB) vorbereiten" }, true, "Dr. Julia Hartmann"), "Automatik „Empfangsbekenntnis (eEB) vorbereiten“ wieder eingeschaltet – durch Dr. Julia Hartmann");
  assert.equal(VORGANG.rechnungsangabenGeaendert(["Steuernummer", "IBAN"], "Dr. Julia Hartmann"), "Rechnungsangaben geändert (Steuernummer, IBAN) – durch Dr. Julia Hartmann");
  const { geaenderteRechnungsangaben, normalisiereRechnungsangaben } = await import("./abrechnung");
  const n = normalisiereRechnungsangaben({ ustIdNr: "de 123 456 789", geschaeftskonto: { iban: "de89370400440532013000", bic: " cobadeffxxx ", bank: " Commerzbank " } });
  assert.deepEqual(n, { ustIdNr: "DE123456789", geschaeftskonto: { iban: "DE89 3704 0044 0532 0130 00", bic: "COBADEFFXXX", bank: "Commerzbank" } });
  assert.deepEqual(geaenderteRechnungsangaben({}, n), ["USt-IdNr.", "IBAN", "BIC", "Bank"]);
  assert.deepEqual(geaenderteRechnungsangaben(n, n), []);
});

test("Protokoll (I4-T16-01): Anbieter-Eingriffe tragen quelle „anbieter“ und die Person beim Anbieter", () => {
  const anlass = { angefordertVon: "Claudia Reinholz", anlass: "Passwort vergessen – telefonisch angefordert", bearbeiter: "Lena Vogt" };
  const a = anbieterVorgang(VORGANG.consolePasswort("Claudia Reinholz", anlass, "AnwaltApex Team"), { userId: "u1", anbieterPerson: anlass.bearbeiter, kategorie: "anmeldung", meldung: true });
  assert.equal(a.quelle, "anbieter");
  assert.equal(a.anbieterPerson, "Lena Vogt");
  assert.equal(a.akteur, "system");
  assert.equal(a.kategorie, "anmeldung");
  assert.equal(a.meldung, true);
  assert.equal(a.text, "Startpasswort für Claudia Reinholz durch AnwaltApex neu vergeben – Lena Vogt auf Anforderung von Claudia Reinholz, Anlass: Passwort vergessen – telefonisch angefordert");
  assert.equal(anbieterUrheber(a), "AnwaltApex – Lena Vogt (Apex Console)");
  assert.equal(istAnbieterEintrag(a), true);

  // allgemeiner Console-Zugang ohne Person
  const z = anbieterVorgang(VORGANG.zugangAngelegt("Claudia Reinholz", "Partnerin"), { userId: "u1", anbieterPerson: "AnwaltApex Team" });
  assert.equal(z.anbieterPerson, undefined);
  assert.equal(z.kategorie, undefined);
  assert.equal(anbieterUrheber(z), "AnwaltApex (Apex Console)");

  // Alt-Einträge ohne `quelle`: am Text erkannt, Person aus dem Text
  const alt = anmeldeVorgang(VORGANG.consolePasswort("Mia Becker", { ...anlass, bearbeiter: "Lena Vogt" }), { akteur: "system", userId: "u2", meldung: true });
  assert.equal(alt.quelle, undefined);
  assert.equal(anbieterUrheber(alt), "AnwaltApex – Lena Vogt (Apex Console)");
  assert.equal(anbieterUrheber(vorgang(VORGANG.standardPasswort("Mia Becker"), { akteur: "system" })), "AnwaltApex (Apex Console)");

  // echte automatische Anmeldeereignisse sind keine Anbieter-Eingriffe
  const fehl = anmeldeVorgang(VORGANG.anmeldungFehlgeschlagen("Mia Becker", "passwort"), { akteur: "system", userId: "u2" });
  assert.equal(istAnbieterEintrag(fehl), false);
  assert.equal(anbieterUrheber(fehl), undefined);
  assert.equal(anbieterUrheber(vorgang(VORGANG.sperreInaktivitaet("Mia Becker"), { akteur: "system" })), undefined);
});

test("Schema (I4-T16-01, I4-T08-01): quelle, anbieterPerson und konto nur mit gültigen Werten", () => {
  const akt = { id: "a1", zeit: "2026-10-17T06:00:00", text: "x", akteur: "system" };
  assert.equal(pruefeDokument("aktivitaeten", { ...akt, quelle: "anbieter", anbieterPerson: "Lena Vogt" }), null);
  assert.match(pruefeDokument("aktivitaeten", { ...akt, quelle: "kanzlei" }) ?? "", /quelle/);
  assert.match(pruefeDokument("aktivitaeten", { ...akt, anbieterPerson: 42 }) ?? "", /anbieterPerson/);
  const tx = { id: "t1", datum: "2026-10-12", betrag: 5670, gegenpartei: "Hanseatische", iban: "DE", verwendungszweck: "x", status: "offen" };
  assert.equal(pruefeDokument("transaktionen", tx), null);
  assert.equal(pruefeDokument("transaktionen", { ...tx, konto: "ander" }), null);
  assert.equal(pruefeDokument("transaktionen", { ...tx, konto: "geschaeft" }), null);
  assert.match(pruefeDokument("transaktionen", { ...tx, konto: "privat" }) ?? "", /konto/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { istAbwesend, istBerufstraeger, kuenftigeVertretungen, tagKurz, vertreteneIds, vertretungFuer, vertretungsUmfang, vertretungUmfangText, vertretungVorabText } from "./vertretung";
import { naechsterArbeitstag } from "./feiertage";
import type { Frist, User } from "./types";

function person(id: string, extra: Partial<User> = {}): User {
  return { id, tenantId: "t", name: id, email: `${id}@kanzlei.de`, rolle: "anwalt", titel: "Rechtsanwalt", initialen: "XX", farbe: "#000", ...extra };
}

test("istAbwesend: von und bis zählen mit, außerhalb nicht", () => {
  const u = person("brandt", { abwesenheit: { von: "2026-10-12", bis: "2026-10-23", vertretungId: "hartmann" } });
  assert.equal(istAbwesend(u, "2026-10-11"), false);
  assert.equal(istAbwesend(u, "2026-10-12"), true);
  assert.equal(istAbwesend(u, "2026-10-16"), true);
  assert.equal(istAbwesend(u, "2026-10-23"), true);
  assert.equal(istAbwesend(u, "2026-10-24"), false);
  assert.equal(istAbwesend(person("ohne"), "2026-10-16"), false);
});

test("vertreteneIds: nur heute Abwesende mit dieser Vertretung", () => {
  const team = [
    person("hartmann", { rolle: "partner" }),
    person("brandt", { abwesenheit: { von: "2026-10-12", bis: "2026-10-23", vertretungId: "hartmann" } }),
    person("wiese", { abwesenheit: { von: "2026-10-20", bis: "2026-10-30", vertretungId: "hartmann" } }), // noch nicht abwesend
    person("becker", { abwesenheit: { von: "2026-10-01", bis: "2026-10-31", vertretungId: "brandt" } }), // andere Vertretung
  ];
  assert.deepEqual(vertreteneIds(team, "hartmann", "2026-10-16"), ["brandt"]);
  assert.deepEqual(vertreteneIds(team, "hartmann", "2026-10-21"), ["brandt", "wiese"]);
  assert.deepEqual(vertreteneIds(team, "brandt", "2026-10-16"), ["becker"]);
  assert.deepEqual(vertreteneIds(team, "hartmann", "2026-11-02"), []);
});

test("vertreteneIds: niemand vertritt sich selbst", () => {
  const team = [person("a", { abwesenheit: { von: "2026-10-01", bis: "2026-10-31", vertretungId: "a" } })];
  assert.deepEqual(vertreteneIds(team, "a", "2026-10-16"), []);
});

test("istBerufstraeger: nur Partner und Rechtsanwälte", () => {
  assert.equal(istBerufstraeger({ rolle: "partner" }), true);
  assert.equal(istBerufstraeger({ rolle: "anwalt" }), true);
  assert.equal(istBerufstraeger({ rolle: "refa" }), false);
  assert.equal(istBerufstraeger({ rolle: "azubi" }), false);
  assert.equal(istBerufstraeger({ rolle: "admin" }), false);
});

test("vertretungFuer: eingetragene Vertretung nur während der Abwesenheit", () => {
  const team = [
    person("hartmann", { rolle: "partner" }),
    person("brandt", { abwesenheit: { von: "2026-10-12", bis: "2026-10-30", vertretungId: "hartmann" } }),
    person("wiese", { abwesenheit: { von: "2026-10-20", bis: "2026-10-30", vertretungId: "inaktiv" } }),
    person("inaktiv", { deaktiviert: true }),
    person("selbst", { abwesenheit: { von: "2026-10-01", bis: "2026-10-31", vertretungId: "selbst" } }),
  ];
  assert.equal(vertretungFuer(team, "brandt", "2026-10-16")?.id, "hartmann");
  assert.equal(vertretungFuer(team, "brandt", "2026-10-31"), undefined); // wieder da
  assert.equal(vertretungFuer(team, "hartmann", "2026-10-16"), undefined); // anwesend
  assert.equal(vertretungFuer(team, "wiese", "2026-10-21"), undefined); // Vertretung deaktiviert
  assert.equal(vertretungFuer(team, "selbst", "2026-10-16"), undefined);
  assert.equal(vertretungFuer(team, "unbekannt", "2026-10-16"), undefined);
});

function frist(id: string, datum: string, extra: Partial<Frist> = {}): Frist {
  return { id, akteId: "a", titel: id, typ: "frist", datum, status: "offen", verantwortlichId: "brandt", quelle: "manuell", createdAt: "2026-10-01T08:00:00.000Z", ...extra };
}

test("vertretungsUmfang: zählt über die ganze Abwesenheit, nicht nur 7 Tage (I2-T18-03)", () => {
  const brandt = person("brandt", { abwesenheit: { von: "2026-10-12", bis: "2026-10-30", vertretungId: "hartmann" } });
  const fristen = [
    frist("f1", "2026-10-19"),
    frist("f2", "2026-10-22", { typ: "notfrist" }),
    frist("f3", "2026-10-26"), // 144/26 – nach 7 Tagen, vor Abwesenheitsende
    frist("f4", "2026-11-02"), // nach der Abwesenheit
    frist("w1", "2026-10-28", { typ: "wiedervorlage" }),
    frist("t1", "2026-10-21", { typ: "termin" }),
    frist("e1", "2026-10-20", { status: "erledigt" }),
    frist("x1", "2026-10-20", { verantwortlichId: "hartmann" }),
  ];
  const u = vertretungsUmfang(fristen, brandt, "2026-10-16");
  assert.equal(u.bis, "2026-10-30");
  assert.equal(u.bisAbwesenheitsende, true);
  assert.equal(u.fristen, 3);
  assert.equal(u.weitere, 1);
  // ohne Ende: 7 Tage
  const ohne = vertretungsUmfang(fristen, person("brandt"), "2026-10-16");
  assert.equal(ohne.bis, "2026-10-23");
  assert.equal(ohne.bisAbwesenheitsende, false);
  assert.equal(ohne.fristen, 2);
});

test("naechsterArbeitstag: erster Arbeitstag nach dem Datum", () => {
  assert.equal(naechsterArbeitstag("2026-10-16", "BE"), "2026-10-19"); // Fr → Mo
  assert.equal(naechsterArbeitstag("2026-10-19", "BE"), "2026-10-20");
  assert.equal(naechsterArbeitstag("2026-10-30", "BB"), "2026-11-02"); // Fr, Sa = Reformationstag
  assert.equal(naechsterArbeitstag("2026-12-24", "NW"), "2026-12-28"); // Weihnachten + Wochenende
  assert.equal(naechsterArbeitstag("2027-03-05", "BE"), "2027-03-09"); // Mo 08.03. Frauentag in Berlin
  assert.equal(naechsterArbeitstag("2027-03-05", "NW"), "2027-03-08");
});

test("kuenftigeVertretungen (I4-T18-04): Abwesenheit ab Mo 19.10., heute Sa 17.10. → Vertreterin sieht die Montagsfrist vorab", () => {
  const team = [
    person("hartmann", { rolle: "partner", name: "Dr. Julia Hartmann" }),
    person("brandt", { name: "Jonas Brandt", abwesenheit: { von: "2026-10-19", bis: "2026-10-30", vertretungId: "hartmann" } }),
    person("wiese", { abwesenheit: { von: "2026-11-20", bis: "2026-11-30", vertretungId: "hartmann" } }), // beginnt erst in > 14 Tagen
    person("becker", { abwesenheit: { von: "2026-10-20", bis: "2026-10-30", vertretungId: "brandt" } }), // andere Vertretung
  ];
  const fristen = [
    frist("replik", "2026-10-19", { titel: "Replik auf Klageerwiderung", akteId: "a137" }),
    frist("t1", "2026-10-20", { typ: "termin" }),
    frist("e1", "2026-10-21", { status: "erledigt" }),
    frist("vorher", "2026-10-18"),
    frist("nachher", "2026-11-02"),
    frist("hart", "2026-10-22", { verantwortlichId: "hartmann" }),
  ];
  const r = kuenftigeVertretungen(team, fristen, "hartmann", "2026-10-17");
  assert.equal(r.length, 1);
  assert.equal(r[0].person.name, "Jonas Brandt");
  assert.equal(r[0].von, "2026-10-19");
  assert.equal(r[0].bis, "2026-10-30");
  assert.deepEqual(r[0].fristen.map((f) => f.titel), ["Replik auf Klageerwiderung"]);
  // Am ersten Abwesenheitstag selbst gilt `vertreteneIds`
  assert.deepEqual(kuenftigeVertretungen(team, fristen, "hartmann", "2026-10-19"), []);
  assert.deepEqual(vertreteneIds(team, "hartmann", "2026-10-19"), ["brandt"]);
  // Vorlauf: mit 40 Tagen auch die Abwesenheit im November
  assert.deepEqual(kuenftigeVertretungen(team, fristen, "hartmann", "2026-10-17", 40).map((v) => v.person.id), ["brandt", "wiese"]);
  // Wiedervorlagen und Vorfristen zählen mit, sortiert nach Datum
  const mehr = [...fristen, frist("wv", "2026-10-23", { typ: "wiedervorlage" }), frist("vf", "2026-10-20", { typ: "vorfrist" })];
  assert.deepEqual(kuenftigeVertretungen(team, mehr, "hartmann", "2026-10-17")[0].fristen.map((f) => f.id), ["replik", "vf", "wv"]);
});

test("kuenftigeVertretungen: deaktivierte Vertretung und Selbstvertretung ergeben nichts", () => {
  const team = [
    person("hartmann", { rolle: "partner", deaktiviert: true }),
    person("brandt", { abwesenheit: { von: "2026-10-19", bis: "2026-10-30", vertretungId: "hartmann" } }),
    person("selbst", { abwesenheit: { von: "2026-10-19", bis: "2026-10-30", vertretungId: "selbst" } }),
  ];
  const fristen = [frist("f1", "2026-10-19")];
  assert.deepEqual(kuenftigeVertretungen(team, fristen, "hartmann", "2026-10-17"), []);
  assert.deepEqual(kuenftigeVertretungen(team, fristen, "selbst", "2026-10-17"), []);
});

test("kuenftigeVertretungen mit Demodaten (Hartmann & Partner, Sa 17.10.2026): 4 Einträge, der erste 137/26 am Mo 19.10.", async () => {
  const { generateTenantData } = await import("./seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("./seed/tenants");
  const t = DEMO_TENANTS[0];
  const users = t.users.map(publicUser);
  const d = generateTenantData({ tenant: t.tenant, users, profil: t.profil }, "2026-10-17");
  const brandt = users.find((u) => u.name === "Jonas Brandt")!;
  const hartmann = users.find((u) => u.name === "Dr. Julia Hartmann")!;
  const team = users.map((u) => (u.id === brandt.id ? { ...u, abwesenheit: { von: "2026-10-19", bis: "2026-10-30", vertretungId: hartmann.id } } : u));
  const r = kuenftigeVertretungen(team, d.fristen, hartmann.id, "2026-10-17");
  assert.equal(r.length, 1);
  assert.equal(r[0].person.id, brandt.id);
  assert.equal(r[0].fristen.length, 4);
  const erste = r[0].fristen[0];
  assert.equal(erste.titel, "Replik auf Klageerwiderung");
  assert.equal(erste.datum, "2026-10-19");
  assert.equal(d.akten.find((a) => a.id === erste.akteId)?.aktenzeichen, "137/26");
  assert.deepEqual(kuenftigeVertretungen(team, d.fristen, hartmann.id, "2026-10-19"), []);
});

test("vertretungVorabText (I4-T18-04): Hinweis vor dem ersten Abwesenheitstag mit erster Frist und Az.", () => {
  const brandt = person("brandt", { name: "Jonas Brandt", abwesenheit: { von: "2026-10-19", bis: "2026-10-30", vertretungId: "hartmann" } });
  const fristen = [
    frist("f1", "2026-10-19", { titel: "Replik auf Klageerwiderung", akteId: "a137" }),
    frist("f2", "2026-10-21"),
    frist("f3", "2026-10-22"),
    frist("f4", "2026-10-27"),
  ];
  const v = { person: brandt, von: "2026-10-19", bis: "2026-10-30", fristen };
  assert.equal(tagKurz("2026-10-19"), "Mo, 19.10.");
  assert.equal(
    vertretungVorabText(v, (id) => (id === "a137" ? "137/26" : undefined)),
    "Ab Mo, 19.10. vertreten Sie Jonas Brandt (bis Fr, 30.10.) – 4 Fristen im Zeitraum, die erste Mo, 19.10.: Replik auf Klageerwiderung (137/26)",
  );
  assert.equal(vertretungVorabText({ ...v, fristen: [] }, () => undefined), "Ab Mo, 19.10. vertreten Sie Jonas Brandt (bis Fr, 30.10.) – im Zeitraum liegen keine offenen Fristen.");
  assert.equal(vertretungUmfangText([frist("a", "2026-10-20"), frist("b", "2026-10-21", { typ: "wiedervorlage" })]), "1 Frist, dazu 1 Wiedervorlage");
  assert.equal(vertretungUmfangText([frist("b", "2026-10-21", { typ: "wiedervorlage" }), frist("c", "2026-10-22", { typ: "vorfrist" })]), "keine Frist, aber 1 Wiedervorlage und 1 Vorfrist");
});

test("uebertragungVorbelegung (I5-T23-01): Vertretung vor angemeldeter Person, sonst leer", async () => {
  const { uebertragungVorbelegung } = await import("./vertretung");
  const hartmann = person("hartmann", { rolle: "partner" });
  const brandt = person("brandt", { abwesenheit: { von: "2026-10-12", bis: "2026-10-23", vertretungId: "kaya" } });
  const kaya = person("kaya");
  const becker = person("becker", { rolle: "refa" });
  const admin = person("admin", { rolle: "admin" });
  // 1. eingetragene Vertretung, wenn aktiv und Kandidatin
  assert.equal(uebertragungVorbelegung(brandt, hartmann, [hartmann, kaya, becker]), "kaya");
  // Vertretung deaktiviert oder keine Kandidatin → angemeldete Person
  assert.equal(uebertragungVorbelegung(brandt, hartmann, [hartmann, { ...kaya, deaktiviert: true }]), "hartmann");
  assert.equal(uebertragungVorbelegung({ ...brandt, abwesenheit: { von: "2026-10-12", bis: "2026-10-23", vertretungId: "becker" } }, hartmann, [hartmann, becker]), "hartmann");
  // 2. ohne Vertretung: angemeldete Person, wenn Partner/Anwalt
  assert.equal(uebertragungVorbelegung(person("x"), hartmann, [hartmann, kaya]), "hartmann");
  // 3. angemeldet ist die Administration (keine Kandidatin) und keine Vertretung → leer (Pflichtwahl)
  assert.equal(uebertragungVorbelegung(person("x"), admin, [kaya, becker]), "");
  // nie die Person selbst
  assert.equal(uebertragungVorbelegung(hartmann, hartmann, [hartmann]), "");
});

test("uebertragungSperrgrund: ohne Wahl oder ohne Häkchen gesperrt, ohne offene Fristen frei", async () => {
  const { NICHT_UEBERTRAGEN, uebertragungSperrgrund } = await import("./vertretung");
  assert.equal(uebertragungSperrgrund({ offeneFristen: 0, wahl: "", bestaetigt: false, name: "Jonas Brandt" }), undefined);
  assert.equal(uebertragungSperrgrund({ offeneFristen: 8, wahl: "", bestaetigt: false, name: "Jonas Brandt" }), "Bitte wählen Sie, wer die 8 offenen Fristen von Jonas Brandt übernimmt.");
  assert.equal(uebertragungSperrgrund({ offeneFristen: 8, wahl: NICHT_UEBERTRAGEN, bestaetigt: false, name: "Jonas Brandt" }), "Bitte bestätigen Sie, dass Sie die Überwachung für die 8 offenen Fristen von Jonas Brandt sicherstellen.");
  assert.equal(uebertragungSperrgrund({ offeneFristen: 8, wahl: NICHT_UEBERTRAGEN, bestaetigt: true, name: "Jonas Brandt" }), undefined);
  assert.equal(uebertragungSperrgrund({ offeneFristen: 1, wahl: "hartmann", bestaetigt: false, name: "Jonas Brandt" }), undefined);
});

test("fristenDeaktivierterZugaenge: offene Einträge eines deaktivierten Zugangs, Text mit Zählweise wie fristenLage", async () => {
  const { fristenDeaktivierterZugaenge, verantwortungText } = await import("./vertretung");
  const f = (id: string, typ: Frist["typ"], wer: string, status: Frist["status"] = "offen"): Frist => ({ id, akteId: "a", titel: id, typ, datum: "2026-10-20", status, verantwortlichId: wer, quelle: "manuell" }) as Frist;
  const team = [person("hartmann", { rolle: "partner" }), person("brandt", { deaktiviert: true }), person("kaya", { deaktiviert: true })];
  const fristen = [f("1", "frist", "brandt"), f("2", "notfrist", "brandt"), f("3", "wiedervorlage", "brandt"), f("4", "termin", "brandt"), f("5", "frist", "brandt", "erledigt"), f("6", "frist", "hartmann")];
  const v = fristenDeaktivierterZugaenge(fristen, team);
  assert.equal(v.length, 1);
  assert.equal(v[0].person.id, "brandt");
  assert.equal(v[0].offen.fristen.length, 2);
  assert.equal(v[0].offen.alle.length, 4);
  assert.equal(verantwortungText(v[0].offen), "2 offene Fristen, dazu 1 Wiedervorlage und 1 Termin");
  assert.equal(verantwortungText({ fristen: [fristen[0]], wiedervorlagen: [], termine: [], vorfristen: [], alle: [fristen[0]] }), "1 offene Frist");
  assert.deepEqual(fristenDeaktivierterZugaenge(fristen, team.map((u) => ({ ...u, deaktiviert: undefined }))), []);
});

test("Fristregel im Backend (I5-T23-01): Deaktivieren mit Übertragung oder Bestätigung, Entfernen nur mit Übertragung", async () => {
  const { pruefeFristEntscheidung, pruefeFristEntscheidungEntfernen } = await import("../lib/backend/types");
  const f = (id: string, typ: Frist["typ"], wer: string): Frist => ({ id, akteId: "a", titel: id, typ, datum: "2026-10-20", status: "offen", verantwortlichId: wer, quelle: "manuell" }) as Frist;
  const hartmann = person("hartmann", { rolle: "partner" });
  const brandt = person("brandt");
  const becker = person("becker", { rolle: "refa" });
  const team = [hartmann, brandt, becker];
  const fristen = [f("1", "notfrist", "brandt"), f("2", "frist", "brandt"), f("3", "wiedervorlage", "brandt")];
  // Deaktivieren: ohne Entscheidung abgelehnt, mit Bestätigung erlaubt (Zahl für das Protokoll), mit Übertragung 0
  assert.throws(() => pruefeFristEntscheidung(team, brandt, { deaktiviert: true }, fristen), /2 offene Fristen/);
  assert.equal(pruefeFristEntscheidung(team, brandt, { deaktiviert: true, fristen: { ueberwachungBestaetigt: true } }, fristen), 2);
  assert.equal(pruefeFristEntscheidung(team, brandt, { deaktiviert: true, fristen: { uebertragenAn: "hartmann" } }, fristen), 0);
  assert.throws(() => pruefeFristEntscheidung(team, brandt, { deaktiviert: true, fristen: { uebertragenAn: "becker" } }, fristen), /Rechtsanwältin/);
  // Entfernen: Bestätigung reicht nicht, nur Übertragung an eine aktive Berufsträgerin bzw. einen aktiven Berufsträger
  assert.throws(() => pruefeFristEntscheidungEntfernen(team, brandt, undefined, fristen), /bevor Sie den Zugang entfernen/);
  assert.throws(() => pruefeFristEntscheidungEntfernen(team, brandt, { ueberwachungBestaetigt: true }, fristen), /bevor Sie den Zugang entfernen/);
  assert.doesNotThrow(() => pruefeFristEntscheidungEntfernen(team, brandt, { uebertragenAn: "hartmann" }, fristen));
  assert.throws(() => pruefeFristEntscheidungEntfernen(team, brandt, { uebertragenAn: "brandt" }, fristen), /Rechtsanwältin/);
  // ohne offene Fristen (nur Wiedervorlage) frei
  assert.doesNotThrow(() => pruefeFristEntscheidungEntfernen(team, brandt, undefined, [fristen[2]]));
});

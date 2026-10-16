import { test } from "node:test";
import assert from "node:assert/strict";
import { istAbwesend, istBerufstraeger, vertreteneIds, vertretungFuer, vertretungsUmfang } from "./vertretung";
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

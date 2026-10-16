import { test } from "node:test";
import assert from "node:assert/strict";
import { istAbwesend, vertreteneIds } from "./vertretung";
import type { User } from "./types";

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

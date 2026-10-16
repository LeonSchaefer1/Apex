// Fristart-Suche: wortweise, mit Gerichtsabkürzungen, Titeltreffer zuerst (I2-T18-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sucheFristarten } from "./fristartSuche";

const erste = (q: string) => sucheFristarten(q)[0]?.key;
const keys = (q: string) => sucheFristarten(q).map((r) => r.key);

test("Berufung beim Arbeitsgericht – alle Schreibweisen", () => {
  for (const q of ["Berufung Arbeit", "Berufung ArbG", "berufung arbg", "Berufung Arbeitsgericht", "arbeitsgericht berufung"]) {
    assert.equal(erste(q), "berufung_arbg", q);
    assert.ok(!keys(q).includes("berufung"), `${q}: keine ZPO-Berufung`);
  }
});

test("LAG findet die arbeitsgerichtliche Berufung, nicht „Klage“ als Wortteil", () => {
  assert.equal(erste("LAG"), "berufung_arbg");
  assert.ok(!keys("LAG").includes("kschg_klage"));
  assert.ok(!keys("lag").includes("anfechtungsklage"));
});

test("UND-Suche, Wortanfänge, Paragraf, Begründung", () => {
  assert.equal(erste("Berufung"), "berufung");
  assert.equal(erste("517"), "berufung");
  assert.equal(erste("§ 520"), "berufungsbegruendung");
  assert.ok(keys("Begründung").includes("berufungsbegruendung"));
  assert.ok(keys("Berufung Begründung").every((k) => k.includes("begruendung")));
  assert.equal(erste("OLG Berufung"), "berufung");
  assert.deepEqual(keys("xyz unbekannt"), []);
  assert.equal(keys("").length > 20, true);
});

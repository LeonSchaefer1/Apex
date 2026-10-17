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

test("Nach der Übernahme steht der Name im Feld: jede Fristart findet sich über ihren eigenen Titel (I3-T18-01)", async () => {
  const { FRIST_REGELN } = await import("@/core/fristen");
  for (const r of FRIST_REGELN) assert.ok(keys(r.titel).includes(r.key), r.titel);
  assert.equal(erste("Berufung 517"), "berufung");
});

test("Fristenrechner ohne Ereignis ohne Ergebnis – „heute“ nur als Schnellwahl, Vorbelegung nur bei Übergabe (I3-T18-02)", async () => {
  const { ereignisFehlt, ereignisHerkunftText, rechenwegMitHerkunft, startEreignisZustand } = await import("./rechnerEingabe");
  assert.deepEqual(startEreignisZustand(undefined), { ereignis: "", herkunft: "hand" });
  assert.deepEqual(startEreignisZustand("kaputt"), { ereignis: "", herkunft: "hand" });
  assert.deepEqual(startEreignisZustand("2026-10-01"), { ereignis: "2026-10-01", herkunft: "start" });
  assert.match(ereignisFehlt("", "Zustellung des vollständigen Urteils") ?? "", /Zustellung des vollständigen Urteils – oder „heute“ wählen/);
  assert.equal(ereignisFehlt("2026-13-45", "Zustellung"), "Bitte ein gültiges Datum eingeben.");
  assert.equal(ereignisFehlt("2026-10-17", "Zustellung"), undefined);
  assert.equal(ereignisHerkunftText("heute"), "heute (Schnellwahl)");
  assert.equal(ereignisHerkunftText("start", "dem Posteingang"), "Ereignisdatum aus dem Posteingang übernommen");
  assert.equal(ereignisHerkunftText("hand"), undefined);
  assert.deepEqual(rechenwegMitHerkunft(["Zustellung: Sa, 17.10.2026", "Beginn"], "heute (Schnellwahl)"), ["Zustellung: Sa, 17.10.2026 · heute (Schnellwahl)", "Beginn"]);
});

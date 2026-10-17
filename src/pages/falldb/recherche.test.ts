// KI-Recherche (Offline): Treffer nur über ein allgemeines Stichwort als „schwacher Treffer“ kennzeichnen und nachrangig sortieren (I4-T06-03).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BEISPIEL_SACHVERHALTE, istAllgemeinesMerkmal, offlineRecherche, ordneNachStaerke } from "./recherche";

test("Bagatellkündigung: Emmely stark, Keylogger- und Video-Urteil nur über „Kündigung“ → schwach und hinten", () => {
  const t = offlineRecherche(BEISPIEL_SACHVERHALTE[0].text);
  assert.equal(t[0].entscheidung.az, "2 AZR 541/09");
  assert.equal(t[0].schwach, undefined);
  const schwach = t.filter((x) => x.schwach);
  assert.ok(schwach.length >= 2);
  for (const x of schwach) assert.equal(x.schwach!.grund, "schwacher Treffer – nur Stichwort ‚Kündigung‘");
  // starke Treffer stehen vor den schwachen
  const erster = t.findIndex((x) => x.schwach);
  assert.ok(t.slice(erster).every((x) => x.schwach));
  // spezifisches Stichwort allein reicht: „Bagatellkündigung“ → Emmely ohne Kennzeichnung
  assert.equal(offlineRecherche("Bagatellkündigung")[0].schwach, undefined);
  assert.equal(istAllgemeinesMerkmal("kündigung"), true);
  assert.equal(istAllgemeinesMerkmal("bagatelle"), false);
});

test("Live-KI: nur die Schwelle zählt (unter 70 % schwach)", () => {
  const e = offlineRecherche(BEISPIEL_SACHVERHALTE[0].text)[0].entscheidung;
  const r = ordneNachStaerke([{ entscheidung: e, relevanz: 55, begruendung: "", gemeinsam: [] }, { entscheidung: e, relevanz: 90, begruendung: "", gemeinsam: [] }], { nurSchwelle: true });
  assert.equal(r[0].relevanz, 90);
  assert.equal(r[1].schwach?.grund, "schwacher Treffer – Relevanz unter 70 %");
});

test("Kurze Wörter wie „über“ treffen keine Stichworte wie „Überwachung“ oder „Überstunden“", () => {
  const t = offlineRecherche("Fristlose Kündigung nach 14 Jahren Betriebszugehörigkeit wegen eines Pfandbons über 1,30 €, keine Abmahnung.");
  assert.equal(t[0].entscheidung.az, "2 AZR 541/09");
  for (const x of t) {
    assert.ok(!x.gemeinsam.some((g) => /überwachung|überstunden/i.test(g)), `${x.entscheidung.titel}: ${x.gemeinsam.join(", ")}`);
    if (x !== t[0]) assert.ok(x.schwach, `${x.entscheidung.titel} sollte als schwach gekennzeichnet sein`);
  }
  // längere Wörter im Sachverhalt treffen weiterhin: „Kündigungsschutzklage“ → „Kündigung“, „Überwachung“ → „Überwachung“
  const k = offlineRecherche("Überwachung am Arbeitsplatz mit Keylogger, danach Kündigung");
  assert.equal(k[0].entscheidung.az, "2 AZR 681/16");
  assert.equal(k[0].schwach, undefined);
});

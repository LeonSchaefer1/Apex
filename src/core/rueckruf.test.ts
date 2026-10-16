import { test } from "node:test";
import assert from "node:assert/strict";
import { inServicezeit, naechsteServicezeit, rueckrufNachFristende, rueckrufZusage, servicezeit } from "./rueckruf";

const V = "Mo–Fr 7:30–19:00 Uhr";

test("Rückruf: Servicezeit aus dem Text", () => {
  assert.deepEqual(servicezeit(V), { von: 450, bis: 1140 });
  assert.deepEqual(servicezeit("Mo–Fr 8–19 Uhr"), { von: 480, bis: 1140 });
});

test("Rückruf: jetzt + 30 Min. in der Servicezeit, sonst nächster Werktag 8:30 Uhr", () => {
  // Fr, 16.10.2026, 16:50 → 17:20 Uhr
  assert.equal(rueckrufZusage(new Date(2026, 9, 16, 16, 50), V).text, "Rückruf bis spätestens 17:20 Uhr");
  // Fr, 16.10.2026, 18:45 → nach Ende der Servicezeit → Mo, 19.10.2026, 8:30 Uhr
  const spaet = rueckrufZusage(new Date(2026, 9, 16, 18, 45), V);
  assert.equal(spaet.datum, "2026-10-19");
  assert.equal(spaet.text, "Rückruf am Mo, 19.10.2026 bis spätestens 8:30 Uhr");
  // Sa → Montag
  assert.equal(rueckrufZusage(new Date(2026, 9, 17, 11, 0), V).datum, "2026-10-19");
  // Mo früh 6:00 → 8:30 Uhr am selben Tag
  assert.equal(rueckrufZusage(new Date(2026, 9, 19, 6, 0), V).text, "Rückruf bis spätestens 8:30 Uhr");
  // Feiertage: Do, 24.12., 18:50 Uhr → 25. und 26.12. Feiertage, 27.12. Sonntag → Mo, 28.12.
  assert.equal(rueckrufZusage(new Date(2026, 11, 24, 18, 50), V).datum, "2026-12-28");
});

test("Rückruf nach Fristende: Fr 21 Uhr → Zusage erst Mo, Di 10 Uhr → heute", () => {
  const fr = new Date(2026, 9, 16, 21, 0);
  assert.equal(rueckrufNachFristende(rueckrufZusage(fr, V), fr), true);
  const di = new Date(2026, 9, 20, 10, 0);
  assert.equal(rueckrufNachFristende(rueckrufZusage(di, V), di), false);
  // Di 18:45 → Ende der Servicezeit überschritten → Mi → nach Fristende
  const spaet = new Date(2026, 9, 20, 18, 45);
  assert.equal(rueckrufNachFristende(rueckrufZusage(spaet, V), spaet), true);
});

test("inServicezeit: Mo–Fr 7:30–19:00 Uhr, nicht am Wochenende und an Feiertagen", () => {
  assert.equal(inServicezeit(new Date(2026, 9, 16, 21, 0), V), false); // Fr 21 Uhr
  assert.equal(inServicezeit(new Date(2026, 9, 20, 10, 0), V), true); // Di 10 Uhr
  assert.equal(inServicezeit(new Date(2026, 9, 20, 7, 29), V), false);
  assert.equal(inServicezeit(new Date(2026, 9, 20, 7, 30), V), true);
  assert.equal(inServicezeit(new Date(2026, 9, 20, 19, 0), V), false);
  assert.equal(inServicezeit(new Date(2026, 9, 17, 11, 0), V), false); // Samstag
  assert.equal(inServicezeit(new Date(2026, 11, 25, 10, 0), V), false); // 1. Weihnachtstag
});

test("naechsteServicezeit: Fr abends → Mo ab 7:30 Uhr, Mo früh → heute", () => {
  assert.equal(naechsteServicezeit(new Date(2026, 9, 16, 21, 0), V).text, "Mo, 19.10.2026 ab 7:30 Uhr");
  assert.equal(naechsteServicezeit(new Date(2026, 9, 19, 6, 0), V).text, "heute ab 7:30 Uhr");
});

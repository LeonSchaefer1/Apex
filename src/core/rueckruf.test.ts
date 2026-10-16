import { test } from "node:test";
import assert from "node:assert/strict";
import { rueckrufZusage, servicezeit } from "./rueckruf";

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

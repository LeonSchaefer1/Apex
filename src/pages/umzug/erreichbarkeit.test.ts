// Erreichbarkeit der Ansprechpartnerin nach Servicezeit (I4-T11-01) – mit fester Uhr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { erreichbarkeit } from "./erreichbarkeit";

const ZEIT = "Mo–Fr 7:30–19:00 Uhr";

test("Samstag 06:20 Uhr: nicht erreichbar – wieder Mo, 19.10. ab 7:30 Uhr", () => {
  const r = erreichbarkeit(new Date(2026, 9, 17, 6, 20), ZEIT, "NW");
  assert.equal(r.erreichbar, false);
  assert.equal(r.text, "nicht erreichbar – wieder Mo, 19.10. ab 7:30 Uhr");
});

test("werktags 10:00 Uhr erreichbar, vor 7:30 Uhr „wieder heute ab 7:30 Uhr“, nach 19 Uhr am nächsten Werktag", () => {
  assert.deepEqual(erreichbarkeit(new Date(2026, 9, 20, 10, 0), ZEIT, "NW"), { erreichbar: true, text: "erreichbar" });
  assert.equal(erreichbarkeit(new Date(2026, 9, 20, 6, 50), ZEIT, "NW").text, "nicht erreichbar – wieder heute ab 7:30 Uhr");
  assert.equal(erreichbarkeit(new Date(2026, 9, 20, 19, 5), ZEIT, "NW").text, "nicht erreichbar – wieder Mi, 21.10. ab 7:30 Uhr");
  // Allerheiligen (So 01.11.2026) – Fr 30.10. abends → Mo 02.11.
  assert.equal(erreichbarkeit(new Date(2026, 9, 30, 20, 0), ZEIT, "NW").text, "nicht erreichbar – wieder Mo, 02.11. ab 7:30 Uhr");
});

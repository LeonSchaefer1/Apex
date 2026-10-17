// Frist anlegen: Ereignis-Vorschläge nie aus gestrichenen Fristen, Quelle mit Stand (I4-T15-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Akte, Frist } from "@/core/types";
import { FRIST_REGELN } from "@/core/fristen";
import { ereignisVorschlaege } from "./fristVorschlaege";

const akte = { id: "a131", aktenzeichen: "131/26" } as Akte;
const frei = FRIST_REGELN.find((r) => r.key === "frei_tage")!;
const frist = (p: Partial<Frist>): Frist => ({
  id: p.id ?? "f1", akteId: "a131", titel: "Frei bestimmte Frist (2 Tage)", typ: "frist", datum: "2026-10-07", regelKey: "frei_tage", ereignisDatum: "2026-10-05",
  status: "offen", verantwortlichId: "u1", quelle: "manuell", createdAt: "2026-10-17T06:00:00.000Z", ...p,
});

test("gestrichene Frist liefert keinen Ereignis-Vorschlag", () => {
  const gestrichen = frist({ status: "erledigt", erledigtAm: "2026-10-17T06:05:00.000Z", erledigtNachweis: { art: "gestrichen", text: "Fehleintrag – falsche Dauer" } });
  assert.deepEqual(ereignisVorschlaege(frei, akte, [], [gestrichen], []), []);
});

test("offene Frist → Vorschlag mit Stand „offene Frist“", () => {
  const v = ereignisVorschlaege(frei, akte, [], [frist({})], []);
  assert.equal(v.length, 1);
  assert.equal(v[0].datum, "2026-10-05");
  assert.match(v[0].quelle, /^aus der offenen Frist „Frei bestimmte Frist \(2 Tage\)“$/);
});

test("erledigte Frist → Vorschlag mit Stand und Erledigungsdatum; Vorfristen und andere Akten zählen nicht", () => {
  const erledigt = frist({ id: "f2", status: "erledigt", erledigtAm: "2026-10-12T09:00:00.000Z", erledigtNachweis: { art: "bea" } });
  const vorfrist = frist({ id: "f3", typ: "vorfrist", ereignisDatum: "2026-10-01" });
  const fremd = frist({ id: "f4", akteId: "a999", ereignisDatum: "2026-09-30" });
  const v = ereignisVorschlaege(frei, akte, [], [erledigt, vorfrist, fremd], []);
  assert.equal(v.length, 1);
  assert.equal(v[0].quelle, "aus der erledigten Frist „Frei bestimmte Frist (2 Tage)“ vom 12.10.2026");
});

test("ohne gewählte Fristart keine Vorschläge", () => {
  assert.deepEqual(ereignisVorschlaege(undefined, akte, [], [frist({})], []), []);
});

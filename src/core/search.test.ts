import { test } from "node:test";
import assert from "node:assert/strict";
import { sucheRechnungen } from "./search";

const rechnungen = [
  { id: "r24", nummer: "RE-2026-0024", stornoNummer: "RE-2026-0031", akteId: "a142", empfaengerId: "k-weber" },
  { id: "r25", nummer: "RE-2026-0025", akteId: "a150", empfaengerId: "k-kroeger" },
  { id: "e1", nummer: "Entwurf-001", akteId: "a150", empfaengerId: "k-kroeger" },
  { id: "e2", nummer: "Entwurf-002", akteId: "a142", empfaengerId: "k-weber" },
];
const akten: Record<string, { aktenzeichen: string; titel: string }> = {
  a142: { aktenzeichen: "142/26", titel: "Weber ./. Kröger Logistik GmbH" },
  a150: { aktenzeichen: "150/26", titel: "Kröger Logistik GmbH – Forderung" },
};
const namen = { akte: (id: string) => akten[id], empfaenger: (id: string) => ({ "k-weber": "Thomas Weber", "k-kroeger": "Kröger Logistik GmbH" })[id] };

test("sucheRechnungen (I4-T07-01): Rechnungsnummer, Entwurfskennung, Stornonummer, Empfänger und Aktenzeichen", () => {
  assert.deepEqual(sucheRechnungen(rechnungen, "RE-2026-0024", namen).map((t) => t.rechnung.id), ["r24"]);
  assert.deepEqual(sucheRechnungen(rechnungen, "Entwurf-001", namen).map((t) => t.rechnung.id), ["e1"]);
  assert.equal(sucheRechnungen(rechnungen, "entwurf", namen).length, 2);
  const storno = sucheRechnungen(rechnungen, "RE-2026-0031", namen);
  assert.equal(storno.length, 1);
  assert.equal(storno[0].rechnung.id, "r24");
  assert.equal(storno[0].storno, true);
  assert.deepEqual(sucheRechnungen(rechnungen, "Thomas Weber", namen).map((t) => t.rechnung.id).sort(), ["e2", "r24"]);
  assert.deepEqual(sucheRechnungen(rechnungen, "Storno", namen).map((t) => [t.rechnung.id, t.storno]), [["r24", true]]);
  assert.ok(sucheRechnungen(rechnungen, "150/26", namen).every((t) => t.rechnung.akteId === "a150"));
  assert.equal(sucheRechnungen(rechnungen, "150/26", namen).length, 2);
  assert.equal(sucheRechnungen(rechnungen, "RE-2026-0099", namen).length, 0);
});

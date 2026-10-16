import { test } from "node:test";
import assert from "node:assert/strict";
import { ESCROW_HINWEIS, PREIS_HINWEIS, UEBERTRAGBARKEIT_HINWEIS, WARTUNG_HINWEIS, WARTUNG_TEXT, kostenLifetime } from "../content/lizenz";

test("kostenLifetime: Lizenz plus Wartung je Jahr, erstes Jahr wahlweise enthalten", () => {
  assert.equal(kostenLifetime(10000, 1500, 5), 10000 + 4 * 1500);
  assert.equal(kostenLifetime(10000, 1500, 5, false), 10000 + 5 * 1500);
  assert.equal(kostenLifetime(10000, 1500, 1), 10000);
  assert.equal(kostenLifetime(10000, 0, 5), 10000);
  assert.equal(kostenLifetime(10000, 1500, 0), 10000);
});

test("Lizenztexte: neutral, ohne Prozentsatz und ohne erfundene Zusage", () => {
  assert.equal(PREIS_HINWEIS, "Preis auf Anfrage – verbindlich im Angebot");
  assert.equal(WARTUNG_HINWEIS, "Wartung: Umfang und Preis regelt das Angebot");
  assert.equal(UEBERTRAGBARKEIT_HINWEIS, "Übertragbarkeit der Lizenz: im Angebot geregelt");
  assert.equal(ESCROW_HINWEIS, "Quellcode-Hinterlegung (Escrow): auf Anfrage");
  for (const t of [WARTUNG_TEXT, UEBERTRAGBARKEIT_HINWEIS, ESCROW_HINWEIS]) {
    assert.doesNotMatch(t, /%|Richtwert|vorgesehen/);
  }
});

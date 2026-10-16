import { test } from "node:test";
import assert from "node:assert/strict";
import { belegeIn, deckungsanfrageStatus, deckungsText, faktorenAus, OHNE_BELEG, STUFE_WORT, stufeAusProzent, stufeWort } from "./einschaetzung";
import type { Aktivitaet } from "./types";

test("Stufen-Wörter statt Prozent als Hauptanzeige", () => {
  assert.equal(stufeAusProzent(78), "hoch");
  assert.equal(stufeAusProzent(65), "hoch");
  assert.equal(stufeAusProzent(64), "mittel");
  assert.equal(stufeAusProzent(40), "mittel");
  assert.equal(stufeAusProzent(39), "gering");
  assert.equal(STUFE_WORT.hoch, "Gute Aussichten");
  assert.equal(STUFE_WORT.mittel, "Offen");
  assert.equal(STUFE_WORT.gering, "Schwierig");
  assert.equal(stufeWort(undefined, 82), "Gute Aussichten");
  assert.ok(OHNE_BELEG.includes("anwaltlich prüfen"));
});

test("Belege: Entscheidung, Norm und Aktendokument werden erkannt – sonst ohne Beleg", () => {
  const k = {
    entscheidungen: [{ id: "bag-2azr541-09", gericht: "BAG", az: "2 AZR 541/09" }],
    dokumente: [{ id: "d1", name: "Übergabeprotokoll 01.08.2019.pdf" }, { id: "d2", name: "Schreiben Gegenseite.pdf" }],
  };
  const e = belegeIn("14 Jahre beanstandungsfreie Betriebszugehörigkeit – hohes „Vertrauenskapital“ (BAG 2 AZR 541/09).", k);
  assert.deepEqual(e.map((q) => q.art), ["entscheidung"]);
  assert.equal(e[0].id, "bag-2azr541-09");
  const n = belegeIn("Ein wichtiger Grund nach § 626 Abs. 1 BGB fehlt; Sperrzeit nach § 159 Abs. 1 S. 2 Nr. 7 SGB III.", k);
  assert.deepEqual(n.map((q) => q.label), ["§ 626 Abs. 1 BGB", "§ 159 Abs. 1 S. 2 Nr. 7 SGB III"]);
  const d = belegeIn("Übergabeprotokoll dokumentiert „Wohnung wird unrenoviert übergeben“.", k);
  assert.deepEqual(d.map((q) => [q.art, q.id]), [["dokument", "d1"]]);
  // Allgemeine Wörter („Schreiben“, „Gegenseite“) sind kein Beleg
  assert.equal(belegeIn("Das Schreiben der Gegenseite ist knapp.", k).length, 0);
  const f = faktorenAus(["A (BAG 2 AZR 541/09)", "B", "C"], ["D nach § 307 BGB"], k);
  assert.deepEqual(f.map((x) => [x.richtung, x.gewicht, x.quellen.length]), [["pro", "stark", 1], ["pro", "mittel", 0], ["pro", "gering", 0], ["contra", "stark", 1]]);
});

test("Deckungsanfrage: Vorlage des Motors ist ein Entwurf, erst die Freigabe einer Person ein Versand", () => {
  const dok = [{ id: "dok-1", akteId: "a1", name: "Deckungsanfrage Nordlicht Rechtsschutz AG", createdAt: "2026-10-14T11:34:00" }];
  const motor: Aktivitaet = { id: "x1", zeit: "2026-10-14T11:34:00", akteur: "automation", akteId: "a1", text: "Deckungsanfrage an Nordlicht Rechtsschutz AG zur Freigabe vorgelegt – 142/26" };
  const s1 = deckungsanfrageStatus("a1", [motor], dok);
  assert.equal(s1.status, "entwurf");
  assert.equal(deckungsText(s1), "Entwurf – wartet auf Ihre Freigabe");
  const frei: Aktivitaet = { id: "x2", zeit: "2026-10-15T09:10:00", akteur: "nutzer", userId: "u-mia", akteId: "a1", text: "Deckungsanfrage an Nordlicht Rechtsschutz AG freigegeben und versandt – 142/26" };
  const s2 = deckungsanfrageStatus("a1", [motor, frei], dok);
  assert.equal(s2.status, "versandt");
  assert.equal(deckungsText(s2, () => "Mia Becker"), "versandt am 15.10.2026 von Mia Becker");
  assert.equal(deckungsanfrageStatus("a2", [motor, frei], dok).status, "keine");
});

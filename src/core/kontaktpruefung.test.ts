import { test } from "node:test";
import assert from "node:assert/strict";
import { aktenVonKontakt, findeDublette, kollisionFuerNeuesMandat, loeschSperre, nameSchluessel, telefonZiffern } from "./kontaktpruefung";
import type { Akte, Kontakt } from "./types";

function kontakt(id: string, name: string, extra: Partial<Kontakt> = {}): Kontakt {
  return { id, typ: "person", name, rollen: [], createdAt: "2026-01-02T09:00:00", ...extra };
}
function akte(id: string, az: string, extra: Partial<Akte> = {}): Akte {
  return {
    id, aktenzeichen: az, titel: `Akte ${az}`, sachgebiet: "Arbeitsrecht", phase: "Außergerichtlich", status: "offen", mandantId: "m", gegenstandswert: 1000,
    bearbeiterId: "ra", beschreibung: "", schlagworte: [], prioritaet: "normal", createdAt: "2026-01-02T09:00:00", updatedAt: "2026-01-02T09:00:00", ...extra,
  };
}

test("nameSchluessel: ohne Titel, Rechtsform und Satzzeichen vergleichbar", () => {
  assert.equal(nameSchluessel("Kröger Logistik GmbH"), nameSchluessel("kröger logistik"));
  assert.equal(nameSchluessel("Dr. Anna Berger"), "anna berger");
  assert.equal(nameSchluessel("Müller Bau GmbH & Co. KG"), "müller bau");
});

test("telefonZiffern: +49, 0049, (0) und Leerzeichen ergeben dieselbe Nummer", () => {
  for (const t of ["+49 176 2214 8830", "+49 (0)176 22148830", "0049 176 22148830", "0176 2214 8830"]) assert.equal(telefonZiffern(t), "017622148830");
});

test("findeDublette: Name, E-Mail oder Telefon – der Kontakt selbst zählt nicht", () => {
  const bestand = [
    kontakt("k1", "Kröger Logistik GmbH", { typ: "organisation", email: "info@kroeger-logistik.de" }),
    kontakt("k2", "Thomas Weber", { telefon: "+49 176 2214 8830" }),
  ];
  assert.equal(findeDublette(bestand, { name: "Kröger Logistik" })?.grund, "name");
  assert.equal(findeDublette(bestand, { name: "Spedition Kröger", email: "INFO@kroeger-logistik.de " })?.kontakt.id, "k1");
  assert.equal(findeDublette(bestand, { name: "T. Weber", telefon: "0176 22148830" })?.grund, "telefon");
  assert.equal(findeDublette(bestand, { name: "Thomas Weber" }, "k2"), undefined);
  assert.equal(findeDublette(bestand, { name: "Jana Neu", email: "jana@neu.de" }), undefined);
});

test("aktenVonKontakt und Kollisionsprüfung: Gegner in offener Akte ist Konflikt für ein neues Mandat", () => {
  const k = kontakt("g", "Kröger Logistik GmbH");
  const akten = [akte("a1", "142/26", { gegnerId: "g" }), akte("a2", "87/18", { mandantId: "g", status: "abgeschlossen", abgeschlossenAm: "2019-03-01" })];
  assert.deepEqual(aktenVonKontakt(k, akten).map((x) => x.rolle), ["Gegner", "Mandant"]);
  const alsMandant = kollisionFuerNeuesMandat(k, akten, "mandant");
  assert.deepEqual(alsMandant.konflikte.map((x) => x.akte.aktenzeichen), ["142/26"]);
  assert.equal(alsMandant.frueher.length, 0);
  const alsGegner = kollisionFuerNeuesMandat(k, akten, "gegner");
  assert.equal(alsGegner.konflikte.length, 0);
  assert.deepEqual(alsGegner.frueher.map((x) => x.akte.aktenzeichen), ["87/18"]);
});

test("loeschSperre (§ 50 Abs. 1 BRAO): offen gesperrt, sonst bis 1.1. des siebten Folgejahres", () => {
  const k = kontakt("m", "Thomas Weber");
  assert.deepEqual(loeschSperre(k, []), { gesperrt: false });
  const offen = loeschSperre(k, [akte("a1", "142/26")]);
  assert.equal(offen.gesperrt, true);
  assert.equal(offen.gesperrt && offen.offen, 1);
  const zu = loeschSperre(k, [akte("a1", "12/20", { status: "abgeschlossen", abgeschlossenAm: "2020-05-04" })]);
  assert.equal(zu.gesperrt && zu.abDatum, "2027-01-01");
  assert.match(zu.gesperrt ? zu.grund : "", /01\.01\.2027/);
});

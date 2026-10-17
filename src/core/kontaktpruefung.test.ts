import { test } from "node:test";
import assert from "node:assert/strict";
import { aktenVonKontakt, emailDomain, findeDublette, gleicheKontakte, istFreemailer, kollisionFuerEntwurf, kollisionFuerNeuesMandat, loeschSperre, nameSchluessel, telefonZiffern } from "./kontaktpruefung";
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

// I4-T17-01 (K, § 43a Abs. 4 BRAO): Kollisionsprüfung über alle Datensätze derselben Firma, nicht nur über die Kontakt-ID.
function kroegerBestand() {
  const original = kontakt("k-kroeger", "Kröger Logistik GmbH", { typ: "organisation", email: "info@kroeger-logistik.de", telefon: "+49 40 3344 5500" });
  const weber = kontakt("k-weber", "Thomas Weber", { email: "t.weber@gmx.de" });
  const akten = [akte("a142", "142/26", { mandantId: "k-weber", gegnerId: "k-kroeger", titel: "Weber ./. Kröger Logistik GmbH" })];
  return { original, weber, akten };
}

test("I4-T17-01: Dublette „Kröger Logistik GmbH“ ohne Akten → als Mandant Konflikt „Gegner in 142/26“ über das Original", () => {
  const { original, weber, akten } = kroegerBestand();
  const dublette = kontakt("k-kroeger-2", "Kröger Logistik GmbH", { typ: "organisation", rollen: ["mandant"] });
  const kontakte = [original, weber, dublette];
  const r = kollisionFuerNeuesMandat(dublette, akten, "mandant", kontakte);
  assert.equal(r.konflikte.length, 1);
  assert.equal(r.konflikte[0].akte.aktenzeichen, "142/26");
  assert.equal(r.konflikte[0].rolle, "Gegner");
  assert.equal(r.konflikte[0].ueber?.id, "k-kroeger");
  assert.equal(r.frueher.length, 0);
  // als Gegner keine widerstreitende Rolle
  assert.equal(kollisionFuerNeuesMandat(dublette, akten, "gegner", kontakte).konflikte.length, 0);
  // Der Originaldatensatz selbst: Treffer ohne `ueber`
  const selbst = kollisionFuerNeuesMandat(original, akten, "mandant", kontakte);
  assert.equal(selbst.konflikte.length, 1);
  assert.equal(selbst.konflikte[0].ueber, undefined);
});

test("I4-T17-01: Schreibvarianten „Kröger Logistik“ und „KRÖGER LOGISTIK GMBH“ ergeben denselben Treffer", () => {
  const { original, weber, akten } = kroegerBestand();
  for (const name of ["Kröger Logistik", "KRÖGER LOGISTIK GMBH", "Kröger Logistik GmbH.", "„Kröger Logistik“ GmbH"]) {
    const d = kontakt("k-neu", name, { typ: "organisation" });
    const r = kollisionFuerNeuesMandat(d, akten, "mandant", [original, weber, d]);
    assert.deepEqual(r.konflikte.map((x) => [x.akte.aktenzeichen, x.rolle, x.ueber?.id]), [["142/26", "Gegner", "k-kroeger"]], name);
    const e = kollisionFuerEntwurf({ name }, [original, weber], akten, "mandant");
    assert.deepEqual(e.konflikte.map((x) => [x.akte.aktenzeichen, x.ueber?.id]), [["142/26", "k-kroeger"]], `Entwurf ${name}`);
  }
  assert.deepEqual(gleicheKontakte({ id: "x", name: "KRÖGER LOGISTIK GMBH", typ: "organisation" }, [original, weber]).map((g) => [g.kontakt.id, g.grund]), [["k-kroeger", "name"]]);
});

test("I4-T17-01: gleiche Firmen-Domain ist ein Treffer, E-Mail und Telefon ebenso", () => {
  const { original, weber, akten } = kroegerBestand();
  const spedition = kontakt("k-sped", "Spedition Kröger Nord", { typ: "organisation", email: "buchhaltung@Kroeger-Logistik.de" });
  const g = gleicheKontakte(spedition, [original, weber, spedition]);
  assert.deepEqual(g.map((x) => [x.kontakt.id, x.grund]), [["k-kroeger", "domain"]]);
  assert.equal(kollisionFuerNeuesMandat(spedition, akten, "mandant", [original, weber, spedition]).konflikte[0]?.akte.aktenzeichen, "142/26");
  assert.equal(kollisionFuerEntwurf({ name: "Neue Firma", email: "info@kroeger-logistik.de" }, [original, weber], akten, "mandant").konflikte.length, 1);
  assert.deepEqual(gleicheKontakte({ id: "", name: "K. L.", telefon: "040 33445500", typ: "organisation" }, [original, weber]).map((x) => x.grund), ["telefon"]);
  // Bei Personen zählt die Domain nicht
  assert.equal(gleicheKontakte({ id: "", name: "Max Muster", email: "max@kroeger-logistik.de", typ: "person" }, [original, weber]).length, 0);
});

test("I4-T17-01: Freemail-Domains (gmx.de, web.de, hotmail.*) sind kein Domain-Treffer", () => {
  const { original, weber, akten } = kroegerBestand();
  const firmaGmx = kontakt("k-gmx", "Kurierdienst Schnell", { typ: "organisation", email: "kurier.schnell@gmx.de" });
  const andereGmx = kontakt("k-gmx2", "Umzüge Weber & Söhne", { typ: "organisation", email: "info.umzug@gmx.de" });
  assert.equal(gleicheKontakte(firmaGmx, [original, weber, andereGmx]).length, 0);
  assert.equal(kollisionFuerEntwurf({ name: "Irgendwer GmbH", email: "neu@gmx.de", typ: "organisation" }, [original, weber, andereGmx], akten, "mandant").konflikte.length, 0);
  for (const d of ["gmx.de", "gmx.net", "web.de", "gmail.com", "googlemail.com", "posteo.de", "t-online.de", "outlook.de", "outlook.com", "hotmail.de", "hotmail.co.uk", "yahoo.com", "yahoo.de", "icloud.com", "mail.de", "freenet.de"]) {
    assert.equal(istFreemailer(d), true, d);
  }
  assert.equal(istFreemailer("kroeger-logistik.de"), false);
  assert.equal(emailDomain(" Info@Kroeger-Logistik.de "), "kroeger-logistik.de");
  assert.equal(emailDomain("keine-adresse"), undefined);
});

test("I4-T17-01: unverwandte Firma ergibt keine Treffer", () => {
  const { original, weber, akten } = kroegerBestand();
  const fremd = kontakt("k-fremd", "Hanse Bau GmbH", { typ: "organisation", email: "info@hanse-bau.de", telefon: "040 1234567" });
  assert.equal(gleicheKontakte(fremd, [original, weber, fremd]).length, 0);
  const r = kollisionFuerNeuesMandat(fremd, akten, "mandant", [original, weber, fremd]);
  assert.deepEqual(r, { konflikte: [], frueher: [] });
  assert.deepEqual(kollisionFuerEntwurf({ name: "Hanse Bau GmbH", email: "info@hanse-bau.de" }, [original, weber], akten, "mandant"), { konflikte: [], frueher: [] });
});

test("I4-T17-01: ohne viertes Argument unverändertes Ergebnis (nur über die Kontakt-ID)", () => {
  const { original, weber, akten } = kroegerBestand();
  const dublette = kontakt("k-kroeger-2", "Kröger Logistik GmbH", { typ: "organisation" });
  assert.deepEqual(kollisionFuerNeuesMandat(dublette, akten, "mandant"), { konflikte: [], frueher: [] });
  const r = kollisionFuerNeuesMandat(original, akten, "mandant");
  assert.equal(r.konflikte.length, 1);
  assert.equal("ueber" in r.konflikte[0], false);
  // als Gegner: Weber ist Mandant in 142/26
  assert.deepEqual(kollisionFuerNeuesMandat(weber, akten, "gegner").konflikte.map((x) => x.akte.aktenzeichen), ["142/26"]);
  // Abgeschlossene Akten über die Dublette landen in „früher“
  const alt = [akte("a87", "87/18", { gegnerId: "k-kroeger", status: "abgeschlossen", abgeschlossenAm: "2019-03-01" })];
  const f = kollisionFuerNeuesMandat(dublette, alt, "mandant", [original, dublette]);
  assert.equal(f.konflikte.length, 0);
  assert.equal(f.frueher[0]?.ueber?.id, "k-kroeger");
});

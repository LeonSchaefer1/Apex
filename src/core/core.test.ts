import { test } from "node:test";
import assert from "node:assert/strict";
import { ostersonntag, feiertage, istWerktag } from "./feiertage";
import { berechneFrist, berechneNachRegel } from "./fristen";
import { wertgebuehr, berechneRvg } from "./rvg";
import { forderungskonto, verzugszinsen } from "./zinsen";

test("Ostersonntag", () => {
  assert.equal(ostersonntag(2024), "2024-03-31");
  assert.equal(ostersonntag(2025), "2025-04-20");
  assert.equal(ostersonntag(2026), "2026-04-05");
  assert.equal(ostersonntag(2027), "2027-03-28");
});

test("Feiertage je Bundesland", () => {
  const be = feiertage(2026, "BE").map((f) => f.name);
  assert.ok(be.includes("Internationaler Frauentag"));
  assert.ok(!be.includes("Reformationstag"));
  const sn = feiertage(2026, "SN").find((f) => f.name === "Buß- und Bettag");
  assert.equal(sn?.datum, "2026-11-18");
  assert.equal(istWerktag("2026-10-31", "HH"), false); // Samstag
  assert.equal(istWerktag("2026-06-04", "NW"), false); // Fronleichnam
  assert.equal(istWerktag("2026-06-04", "BE"), true);
});

test("Monatsfrist mit Monatsletztem und Wochenende", () => {
  // 31.01.2026 + 1 Monat → 28.02.2026 (Samstag) → Montag 02.03.2026
  const r = berechneFrist({ ereignis: "2026-01-31", dauer: 1, einheit: "monate", land: "BE" });
  assert.equal(r.ende, "2026-03-02");
  assert.equal(r.verschoben, true);
});

test("Wochenfrist über Weihnachten", () => {
  // 11.12.2026 (Fr) + 2 Wochen → 25.12. (Feiertag) → 26.12. (Feiertag/Sa) → 27.12. So → Mo 28.12.
  const r = berechneFrist({ ereignis: "2026-12-11", dauer: 2, einheit: "wochen", land: "BY" });
  assert.equal(r.ende, "2026-12-28");
});

test("Kündigungsschutzklage drei Wochen", () => {
  const r = berechneNachRegel("kschg_klage", "2026-10-09", "BE");
  assert.equal(r.ende, "2026-10-30");
  assert.equal(r.vorfrist, "2026-10-23");
});

test("Regelverjährung", () => {
  const r = berechneNachRegel("regelverjaehrung", "2023-05-10", "NW");
  assert.equal(r.ende, "2026-12-31"); // Schluss 2023 + 3 Jahre, 31.12.2026 ist ein Donnerstag
});

test("RVG Wertgebühren (KostBRÄG 2025)", () => {
  assert.equal(wertgebuehr(500), 51.5);
  assert.equal(wertgebuehr(1000), 93);
  assert.equal(wertgebuehr(5000), 354.5);
  assert.equal(wertgebuehr(10000), 652);
  assert.equal(wertgebuehr(50000), 1357);
  assert.equal(wertgebuehr(10000, "2021"), 614);
  assert.equal(wertgebuehr(50000, "2021"), 1279);
});

test("RVG mit Anrechnung", () => {
  const r = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3100" }, { nr: "3104" }], gegenstandswert: 10000 });
  assert.equal(r.auslagenpauschale, 20);
  assert.ok(r.zeilen.some((z) => z.anrechnung));
});

test("Verzugszinsen und § 367 BGB", () => {
  const z = verzugszinsen(1000, "2026-01-01", "2026-12-31", false);
  assert.equal(z.reduce((s, a) => s + a.tage, 0), 365);
  const k = forderungskonto({
    verzugAb: "2026-01-01",
    stichtag: "2026-06-30",
    verbraucher: true,
    vorgaenge: [
      { datum: "2025-12-01", art: "hauptforderung", betrag: 5000, text: "Rechnung" },
      { datum: "2026-02-01", art: "kosten", betrag: 100, text: "Mahnkosten" },
      { datum: "2026-03-01", art: "zahlung", betrag: 500, text: "Teilzahlung" },
    ],
  });
  const zahlung = k.verlauf.find((v) => v.art === "zahlung")!;
  assert.equal(zahlung.aufKosten, 100);
  assert.ok((zahlung.aufZinsen ?? 0) > 0);
  assert.ok(k.hauptforderung < 5000);
});

test("Fristenlage: einheitliche Zählweise", async () => {
  const { fristenLage } = await import("./fristenLage");
  const basis = { akteId: "a", titel: "t", status: "offen" as const, verantwortlichId: "u1", quelle: "manuell" as const, createdAt: "2026-10-01T09:00" };
  const fr = [
    { ...basis, id: "1", typ: "notfrist" as const, datum: "2026-10-16" },
    { ...basis, id: "2", typ: "vorfrist" as const, datum: "2026-10-16" },
    { ...basis, id: "3", typ: "termin" as const, datum: "2026-10-16" },
    { ...basis, id: "4", typ: "frist" as const, datum: "2026-10-14", verantwortlichId: "u2" },
    { ...basis, id: "5", typ: "wiedervorlage" as const, datum: "2026-10-20" },
    { ...basis, id: "6", typ: "frist" as const, datum: "2026-10-16", status: "erledigt" as const },
  ];
  const l = fristenLage(fr, "2026-10-16");
  assert.deepEqual(l.faellig.map((f) => f.id), ["4", "1"]);
  assert.equal(l.heute.length, 1);
  assert.equal(l.ueberfaellig.length, 1);
  assert.equal(l.vorfristen.length, 1);
  assert.deepEqual(l.woche.map((f) => f.id), ["5"]);
  assert.equal(fristenLage(fr, "2026-10-16", "u1").faellig.length, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { ostersonntag, feiertage, istWerktag } from "./feiertage";
import { berechneFrist, berechneNachRegel } from "./fristen";
import { wertgebuehr, berechneRvg, berechnetePauschalen, rvgRechnungsPositionen } from "./rvg";
import { forderungskonto, verzugszinsen } from "./zinsen";
import type { Sachgebiet } from "./types";

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

test("RVG mit Anrechnung und Auslagenpauschale je Angelegenheit", () => {
  // 2300 (außergerichtlich) und 3100/3104 (gerichtlich) sind verschiedene Angelegenheiten: zweimal Nr. 7002.
  const r = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3100" }, { nr: "3104" }], gegenstandswert: 10000 });
  assert.ok(r.zeilen.some((z) => z.anrechnung));
  assert.deepEqual(r.angelegenheiten.map((a) => [a.key, a.auslagenpauschale]), [["aussergerichtlich", 20], ["gerichtlich", 20]]);
  assert.equal(r.gebuehrenSumme, 2053.8);
  assert.equal(r.auslagenpauschale, 40);
  assert.equal(r.netto, 2093.8);
  assert.equal(r.ust, 397.82);
  assert.equal(r.brutto, 2491.62);
  // Anrechnung gehört zur gerichtlichen Angelegenheit, mindert aber nicht die Grundlage der Pauschale.
  const ger = r.angelegenheiten.find((a) => a.key === "gerichtlich")!;
  assert.ok(ger.zeilen.some((z) => z.anrechnung));
  assert.equal(ger.gebuehren, 1630);

  // Kleiner Wert: 20 % der jeweiligen Gebühren (2300 vor Anrechnung)
  const k = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3100" }], gegenstandswert: 500 });
  assert.deepEqual(k.angelegenheiten.map((a) => a.auslagenpauschale), [13.39, 13.39]);

  // Eine Angelegenheit: einmal; Mahnverfahren und Vollstreckung getrennt
  assert.equal(berechneRvg({ positionen: [{ nr: "3100" }, { nr: "3104" }], gegenstandswert: 10000 }).auslagenpauschale, 20);
  assert.equal(berechneRvg({ positionen: [{ nr: "3305" }, { nr: "3308" }, { nr: "3309" }], gegenstandswert: 10000 }).angelegenheiten.length, 2);
  // Einigungsgebühr 1003 läuft in der vorhandenen Angelegenheit mit
  assert.equal(berechneRvg({ positionen: [{ nr: "3100" }, { nr: "1003" }], gegenstandswert: 10000 }).angelegenheiten.length, 1);

  // Schon berechnete Pauschale derselben Angelegenheit wird nicht erneut angesetzt
  const vorher = berechnetePauschalen([{ positionen: rvgRechnungsPositionen(berechneRvg({ positionen: [{ nr: "3100" }], gegenstandswert: 10000 }).angelegenheiten) }]);
  assert.deepEqual(vorher, { gerichtlich: 20 });
  assert.equal(berechneRvg({ positionen: [{ nr: "3104" }], gegenstandswert: 10000, bereitsPauschale: vorher }).auslagenpauschale, 0);
  assert.equal(berechneRvg({ positionen: [{ nr: "2300" }], gegenstandswert: 10000, bereitsPauschale: vorher }).auslagenpauschale, 20);
});

test("RVG: Erhöhung Nr. 1008 je Angelegenheit, Anrechnung aus der erhöhten Geschäftsgebühr", () => {
  // zwei Auftraggeber: 2300 und 3100 je 1,6; Anrechnung 1,6 / 2 = 0,8 → höchstens 0,75
  const r = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3100" }, { nr: "3104" }, { nr: "1008", satz: 0.3 }], gegenstandswert: 10000 });
  const satz = (nr: string) => r.zeilen.find((z) => z.nr === nr)?.satz;
  assert.equal(satz("2300"), 1.6);
  assert.equal(satz("3100"), 1.6);
  assert.equal(satz("3104"), 1.2);
  assert.equal(r.zeilen.some((z) => z.nr === "1008"), false);
  assert.equal(r.zeilen.find((z) => z.anrechnung)?.betrag, -489);
  assert.equal(r.netto, 2419.8);
  // Höchstens 2,0 Erhöhung insgesamt
  const viele = berechneRvg({ positionen: [{ nr: "3100" }, { nr: "1008", satz: 2.4 }], gegenstandswert: 10000 });
  assert.equal(viele.zeilen[0].satz, 3.3);
  // Mahnverfahren: 3308 nicht erhöhen, wenn schon 3305 erhöht ist
  const mahn = berechneRvg({ positionen: [{ nr: "3305" }, { nr: "3308" }, { nr: "1008", satz: 0.3 }], gegenstandswert: 5000 });
  assert.deepEqual(mahn.zeilen.map((z) => z.satz), [1.3, 0.5]);
  // Rechnungsposition nennt die Erhöhung
  assert.match(rvgRechnungsPositionen(r.angelegenheiten)[0].bezeichnung, /erhöht nach Nr\. 1008/);
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

test("Fristenlage: einheitliche Zählweise – Fristen getrennt von Wiedervorlagen, Vorfristen und Terminen", async () => {
  const { fristenLage, istKritisch, zaehltAlsFrist } = await import("./fristenLage");
  const basis = { akteId: "a", titel: "t", status: "offen" as const, verantwortlichId: "u1", quelle: "manuell" as const, createdAt: "2026-10-01T09:00" };
  const fr = [
    { ...basis, id: "1", typ: "notfrist" as const, datum: "2026-10-16" },
    { ...basis, id: "2", typ: "vorfrist" as const, datum: "2026-10-16" },
    { ...basis, id: "3", typ: "termin" as const, datum: "2026-10-16" },
    { ...basis, id: "4", typ: "frist" as const, datum: "2026-10-14", verantwortlichId: "u2" },
    { ...basis, id: "5", typ: "wiedervorlage" as const, datum: "2026-10-20" },
    { ...basis, id: "6", typ: "frist" as const, datum: "2026-10-16", status: "erledigt" as const },
    { ...basis, id: "7", typ: "wiedervorlage" as const, datum: "2026-10-16" },
    { ...basis, id: "8", typ: "frist" as const, datum: "2026-10-22", regelKey: "kschg_klage" },
    { ...basis, id: "9", typ: "frist" as const, datum: "2026-10-21" },
    { ...basis, id: "10", typ: "vorfrist" as const, datum: "2026-10-15", regelKey: "kschg_klage" },
  ];
  const l = fristenLage(fr, "2026-10-16");
  // „Heute sind 2 Fristen fällig, dazu 1 Wiedervorlage und 2 Vorfristen.“
  assert.deepEqual(l.faellig.map((f) => f.id), ["4", "1"]);
  assert.equal(l.heute.length, 1);
  assert.equal(l.ueberfaellig.length, 1);
  assert.deepEqual(l.wiedervorlagen.map((f) => f.id), ["7"]);
  assert.deepEqual(l.vorfristen.map((f) => f.id), ["10", "2"]);
  // nächste 7 Tage: nur Fristen; Wiedervorlagen getrennt
  assert.deepEqual(l.woche.map((f) => f.id), ["9", "8"]);
  assert.deepEqual(l.wiedervorlagenWoche.map((f) => f.id), ["5"]);
  // kritisch: Notfrist heute und nicht verlängerbare KSchG-Klagefrist – nicht die Vorfrist mit derselben Regel
  assert.deepEqual(l.kritischWoche.map((f) => f.id), ["1", "8"]);
  assert.deepEqual(l.notfristenWoche.map((f) => f.id), ["1"]);
  assert.ok(istKritisch(fr[7]) && !istKritisch(fr[9]) && !istKritisch(fr[8]));
  assert.ok(!zaehltAlsFrist(fr[4]) && !zaehltAlsFrist(fr[1]) && !zaehltAlsFrist(fr[2]));
  assert.equal(fristenLage(fr, "2026-10-16", "u1").faellig.length, 1);
});

test("Akten mit Frist ≤ 7 Tage: dieselbe Hilfsfunktion für Akten-Kennzahl, Spalte und Cockpit", async () => {
  const { aktenMitFrist, fristenJeAkte } = await import("./fristenLage");
  const basis = { titel: "t", status: "offen" as const, verantwortlichId: "u1", quelle: "manuell" as const, createdAt: "2026-10-01T09:00" };
  const fr = [
    { ...basis, id: "1", akteId: "a", typ: "wiedervorlage" as const, datum: "2026-10-17" },
    { ...basis, id: "2", akteId: "a", typ: "frist" as const, datum: "2026-10-30" },
    { ...basis, id: "3", akteId: "b", typ: "frist" as const, datum: "2026-10-12" },
    { ...basis, id: "4", akteId: "b", typ: "frist" as const, datum: "2026-10-20", regelKey: "einspruch_bussgeld" },
    { ...basis, id: "5", akteId: "c", typ: "termin" as const, datum: "2026-10-18" },
    { ...basis, id: "6", akteId: "d", typ: "notfrist" as const, datum: "2026-10-23" },
  ];
  const m = aktenMitFrist(fr, "2026-10-16");
  assert.deepEqual([...m.keys()].sort(), ["b", "d"]); // Akte a nur mit Wiedervorlage im Fenster, c nur mit Termin
  assert.equal(m.get("b")!.naechste.id, "3"); // überfällige zuerst
  assert.equal(m.get("b")!.kritisch?.id, "4");
  assert.equal(m.get("b")!.anzahl, 2);
  assert.equal(m.get("d")!.kritisch?.id, "6");
  // ohne Fenster: nächste Frist je Akte (Spalte „Nächste Frist“) – Wiedervorlagen zählen nicht
  assert.equal(fristenJeAkte(fr).get("a")!.naechste.id, "2");
  assert.equal(fristenJeAkte(fr).has("c"), false);
});

test("Rechenweg: § 187 Abs. 1 BGB, Dauer-Grundlage und § 222 Abs. 2 ZPO nur bei Verschiebung", () => {
  // Zustellung Fr 16.10.2026 → Mo 16.11.2026 (Werktag, keine Verschiebung)
  const werktag = berechneNachRegel("berufung", "2026-10-16", "BE");
  assert.equal(werktag.ende, "2026-11-16");
  assert.ok(werktag.rechenweg.some((s) => s.includes("§ 187 Abs. 1 BGB")));
  assert.ok(werktag.rechenweg.some((s) => s.includes("Dauer 1 Monat (§ 517 ZPO)") && s.includes("§ 188 Abs. 2 BGB")));
  assert.ok(!werktag.rechenweg.some((s) => s.includes("§ 222 Abs. 2 ZPO")));
  assert.ok(werktag.rechenweg.some((s) => s.includes("keine Verschiebung")));
  // Zustellung Sa 31.01.2026 → 28.02. (Sa) → Mo 02.03.2026: Verschiebung nach § 222 Abs. 2 ZPO
  const wochenende = berechneNachRegel("berufung", "2026-01-31", "BE");
  assert.equal(wochenende.ende, "2026-03-02");
  assert.ok(wochenende.rechenweg.some((s) => s.includes("§ 222 Abs. 2 ZPO")));
  assert.ok(wochenende.rechenweg.some((s) => s.includes("Samstag")));
});

test("Fristen im Zeitraum: gleiche Zählweise wie fristenLage", async () => {
  const { fristenImZeitraum } = await import("./fristenLage");
  const basis = { akteId: "a", titel: "t", status: "offen" as const, verantwortlichId: "u1", quelle: "manuell" as const, createdAt: "2026-10-01T09:00" };
  const fr = [
    { ...basis, id: "1", typ: "notfrist" as const, datum: "2026-10-17" },
    { ...basis, id: "2", typ: "vorfrist" as const, datum: "2026-10-17" },
    { ...basis, id: "3", typ: "termin" as const, datum: "2026-10-18" },
    { ...basis, id: "4", typ: "wiedervorlage" as const, datum: "2026-10-18" },
    { ...basis, id: "5", typ: "frist" as const, datum: "2026-10-30" },
    { ...basis, id: "6", typ: "frist" as const, datum: "2026-10-19", regelKey: "einspruch_strafbefehl" },
  ];
  const z = fristenImZeitraum(fr, "2026-10-17", "2026-10-23");
  assert.deepEqual(z.fristen.map((f) => f.id), ["1", "6"]);
  assert.equal(z.notfristen.length, 1);
  assert.deepEqual(z.kritisch.map((f) => f.id), ["1", "6"]);
  assert.deepEqual(z.wiedervorlagen.map((f) => f.id), ["4"]);
  assert.equal(z.vorfristen.length, 1);
  assert.equal(z.termine.length, 1);
});

test("Demodaten: Zeitkorrektur „nicht in der Zukunft“ ist monoton und verbraucht keinen Zufall", async () => {
  const { zeitBisJetzt } = await import("./seed/generate");
  const jetzt = 8 * 3600 + 45 * 60; // 08:45
  const zeiten = [7 * 3600, 7 * 3600 + 41 * 60, 8 * 3600 + 12 * 60, 9 * 3600 + 3 * 60, 17 * 3600, 23 * 3600 + 59 * 60];
  const neu = zeiten.map((z) => zeitBisJetzt(z, jetzt));
  for (let i = 1; i < neu.length; i++) assert.ok(neu[i] >= neu[i - 1], "Reihenfolge bleibt erhalten");
  assert.ok(neu.every((z) => z <= jetzt - 60), "nichts in der Zukunft");
  assert.equal(neu[0], zeiten[0]); // frühe Zeitpunkte bleiben unverändert
  assert.equal(zeitBisJetzt(17 * 3600, undefined), 17 * 3600); // nicht für heute erzeugt → keine Korrektur
});

test("Demodaten: Inhalt hängt nur von Datum und Kanzlei ab", async () => {
  const { generateTenantData } = await import("./seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("./seed/tenants");
  const t = DEMO_TENANTS[0];
  const gen = () => JSON.stringify(generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-16"));
  assert.equal(gen(), gen());
});

test("Demodaten: Verlauf der Präsentationsakten ist stimmig", async () => {
  const { generateTenantData } = await import("./seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("./seed/tenants");
  for (const t of DEMO_TENANTS) {
    const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-16");
    for (const x of d.aktivitaeten.filter((a) => a.akteId)) {
      const akte = d.akten.find((a) => a.id === x.akteId)!;
      assert.ok(x.zeit >= akte.createdAt, `${x.text} liegt vor der Aktenanlage (${akte.aktenzeichen})`);
      if (x.automationKey === "archivierung") assert.equal(akte.status, "abgeschlossen", x.text);
      if (x.automationKey === "kostenfestsetzung") assert.ok(["Urteil", "Vollstreckung"].includes(akte.phase), x.text);
      if (akte.id.startsWith("hero-")) assert.ok(!/archiviert|Kostenfestsetzung/.test(x.text), x.text);
    }
  }
  const t = DEMO_TENANTS[0];
  const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-16");
  const weber = d.akten.find((a) => a.aktenzeichen === "142/26")!;
  const verlauf = d.aktivitaeten.filter((a) => a.akteId === weber.id).map((a) => a.text);
  assert.ok(verlauf.some((v) => v.includes("Mandatsaufnahme-Paket")));
  assert.ok(!verlauf.some((v) => v.includes("zugeordnet")), "Die Weber-Mail ist noch nicht zugeordnet");
  // Vorschuss: als Zahlung gebucht und auch so beschriftet (nicht „angefordert“)
  const vorschuss = d.buchungen.find((b) => b.akteId === weber.id && b.art === "vorschuss")!;
  assert.ok(vorschuss.betrag < 0 && /Zahlungseingang/.test(vorschuss.text));
});

test("Demodaten: Gerichte und Orte passend zur Stadt der Kanzlei", async () => {
  const { stadtDatenFuer, STAEDTE } = await import("./seed/pools");
  assert.equal(stadtDatenFuer("Berlin", "BE", "berlin"), STAEDTE.berlin);
  assert.equal(stadtDatenFuer("München", "BY", "muenchen"), STAEDTE.muenchen);
  const koeln = stadtDatenFuer("Köln", "NW", "berlin");
  assert.equal(koeln.ort, "Köln");
  assert.equal(koeln.gerichte.arbg, "Arbeitsgericht Köln");
  assert.equal(koeln.gerichte.olg, "Oberlandesgericht Köln");
  assert.match(koeln.gerichte.mahn, /Euskirchen/);
  assert.equal(stadtDatenFuer("Nürnberg", "BY", "muenchen").gerichte.lg, "Landgericht Nürnberg-Fürth");
  // Frankfurt (Oder) ist nicht Frankfurt am Main
  const ffo = stadtDatenFuer("Frankfurt (Oder)", "BB", "berlin");
  assert.equal(ffo.gerichte.ag[0], "Amtsgericht Frankfurt (Oder)");
  assert.match(ffo.gerichte.mahn, /Wedding/);
  // unbekannte Stadt: Gerichte der Stadt, OLG und Mahngericht des Bundeslands
  const x = stadtDatenFuer("Gütersloh", "NW", "berlin");
  assert.equal(x.gerichte.ag[0], "Amtsgericht Gütersloh");
  assert.match(x.gerichte.mahn, /Hagen/);
  // keine Stadt angegeben: Landeshauptstadt
  assert.equal(stadtDatenFuer("", "SN", "berlin").ort, "Dresden");

  const { generateTenantData } = await import("./seed/generate");
  const { baueKunde, profilFuer } = await import("./seed/kunde");
  const { tenant, admin } = baueKunde({ kanzlei: "Becker & Schulz Rechtsanwälte", stadt: "Köln", bundesland: "NW", adminName: "Anna Becker", adminEmail: "anna@becker.example", arbeitsplaetze: 3, schwerpunkte: ["Arbeitsrecht", "Mietrecht", "Strafrecht"] as Sachgebiet[] }, "test");
  const d = generateTenantData({ tenant, users: [admin], profil: profilFuer(tenant.schwerpunkte as Sachgebiet[], "NW") }, "2026-10-16");
  const namen = d.kontakte.map((k) => `${k.name} ${k.ort ?? ""}`).join(" | ");
  assert.ok(!/Berlin|Neukölln|Tempelhof|Charlottenburg|Wedding/.test(namen), namen);
  assert.ok(d.kontakte.some((k) => k.name === "Arbeitsgericht Köln" || k.name === "Amtsgericht Köln"));
});

test("Suche „pfandbon kündigung“ findet Akte, Dokument und Urteil", async () => {
  const { search } = await import("./search");
  const { ENTSCHEIDUNGEN } = await import("./rechtsprechung");
  const { generateTenantData } = await import("./seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("./seed/tenants");
  const t = DEMO_TENANTS[0];
  const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-16");
  const q = "pfandbon kündigung";
  assert.deepEqual(search(d.akten, q, [{ get: (a) => a.beschreibung, weight: 1 }, { get: (a) => a.schlagworte.join(" "), weight: 1 }]).map((h) => h.item.aktenzeichen), ["142/26"]);
  assert.ok(search(d.dokumente, q, [{ get: (x) => x.name, weight: 3 }, { get: (x) => x.inhalt, weight: 1 }]).some((h) => h.item.name === "Gesprächsnotiz Erstberatung"));
  assert.equal(search(ENTSCHEIDUNGEN, q, [{ get: (e) => e.titel, weight: 3 }, { get: (e) => e.schlagworte.join(" "), weight: 2 }, { get: (e) => e.leitsatz, weight: 1 }])[0].item.az, "2 AZR 541/09");
});

// ───────────── Fristen-Fachlogik je Verfahrensordnung (QA-Runde 2) ─────────────

test("Regelkatalog: „Notfrist“ nur für Fristen, die das Gesetz so nennt (§ 224 Abs. 1 S. 2 ZPO)", async () => {
  const { FRIST_REGELN, fristArt, regel } = await import("./fristen");
  const notfristen = FRIST_REGELN.filter((r) => r.typ === "notfrist");
  assert.ok(notfristen.every((r) => r.verfahren === "ZPO" || r.verfahren === "ArbGG"), notfristen.map((r) => r.key).join(", "));
  for (const k of ["kschg_klage", "einspruch_strafbefehl", "berufung_stpo", "revision_stpo", "einspruch_bussgeld"]) {
    const r = regel(k)!;
    assert.equal(r.typ, "frist", k);
    assert.ok(r.unverlaengerbar, k);
    const a = fristArt(r);
    assert.ok(a.kritisch, k);
    // kein ZPO-Notfrist-Hinweis (§ 224 ZPO, Wiedereinsetzung nach §§ 233 ff. ZPO)
    assert.ok(!/§ 224|§§ 233|233 ff\./.test(`${a.art} ${a.versaeumnis} ${a.kurz}`), `${k}: ${a.art} ${a.versaeumnis}`);
  }
  // § 4 KSchG: nachträgliche Zulassung nach § 5 KSchG statt Wiedereinsetzung
  const kschg = fristArt(regel("kschg_klage")!);
  assert.match(kschg.versaeumnis, /§ 5 KSchG/);
  assert.match(kschg.versaeumnis, /§ 7 KSchG/);
  assert.match(kschg.kurz, /§ 5 KSchG/);
  // StPO: §§ 44, 45 StPO – OWiG: § 52 OWiG
  assert.match(fristArt(regel("einspruch_strafbefehl")!).versaeumnis, /§§ 44, 45 StPO/);
  assert.match(fristArt(regel("einspruch_bussgeld")!).versaeumnis, /§ 52 OWiG/);
  // ZPO-Notfrist: § 224 Abs. 2 ZPO (nicht verlängerbar) und §§ 233, 234 ZPO
  const ber = fristArt(regel("berufung")!);
  assert.match(ber.art, /§ 224 Abs\. 2 ZPO/);
  assert.match(ber.versaeumnis, /§§ 233, 234 ZPO/);
  // Hinweistexte: Fünf-Monats-Grenze und ArbG-Begründungsfrist
  assert.match(regel("berufung")!.hinweis!, /beginnt spätestens mit Ablauf von fünf Monaten nach Verkündung \(§ 517 Hs\. 2 ZPO\)/);
  const arbgBegr = regel("berufungsbegruendung_arbg")!;
  assert.equal(arbgBegr.dauer, 2);
  assert.match(arbgBegr.hinweis!, /nur einmal .*§ 66 Abs\. 1 S\. 5 ArbGG/);
});

test("Rechenweg je Verfahrensordnung: StPO § 43, OWiG § 46 i. V. m. § 43 StPO, ZPO § 222", async () => {
  const { berechneNachRegel } = await import("./fristen");
  // Zustellung Sa 17.10.2026 + 2 Wochen = Sa 31.10.2026 → Mo 02.11.2026
  const stpo = berechneNachRegel("einspruch_strafbefehl", "2026-10-17", "BE");
  assert.equal(stpo.ende, "2026-11-02");
  assert.ok(stpo.rechenweg.some((s) => s.includes("§ 43 Abs. 1 StPO")));
  assert.ok(stpo.rechenweg.some((s) => s.includes("Fristende nach § 43 Abs. 2 StPO")));
  assert.ok(!stpo.rechenweg.some((s) => /BGB|ZPO/.test(s)), stpo.rechenweg.join(" | "));
  assert.equal(stpo.verschiebungsNorm, "§ 43 Abs. 2 StPO");
  const owi = berechneNachRegel("einspruch_bussgeld", "2026-10-17", "BE");
  assert.ok(owi.rechenweg.some((s) => s.includes("§ 46 Abs. 1 OWiG i. V. m. § 43 Abs. 1 StPO")));
  assert.ok(owi.rechenweg.some((s) => s.includes("§ 46 Abs. 1 OWiG i. V. m. § 43 Abs. 2 StPO")));
  const kschg = berechneNachRegel("kschg_klage", "2026-10-17", "BE");
  assert.equal(kschg.ende, "2026-11-09");
  assert.ok(kschg.rechenweg.some((s) => s.includes("§ 193 BGB")));
  const zpo = berechneNachRegel("einspruch_vu", "2026-10-17", "BE");
  assert.ok(zpo.rechenweg.some((s) => s.includes("Fristende nach § 222 Abs. 2 ZPO")));
});

test("Feiertage am Ort der Handlung: Revision beim BGH (Karlsruhe) und regionale Feiertage", async () => {
  const { berechneNachRegel } = await import("./fristen");
  // 01.11.2027 (Mo) ist Allerheiligen in Baden-Württemberg, in Berlin ein Werktag
  assert.equal(berechneNachRegel("berufung", "2027-10-01", "BE").ende, "2027-11-01");
  const rev = berechneNachRegel("revision", "2027-10-01", "BE");
  assert.equal(rev.ende, "2027-11-02");
  assert.ok(rev.rechenweg.some((s) => s.includes("Bundesgerichtshof (Karlsruhe)")));
  // Mariä Himmelfahrt (nur in Teilen Bayerns): vorsorglich keine Verlängerung, aber Hinweis auf die Rechtslage
  const by = berechneNachRegel("berufung", "2028-07-15", "BY");
  assert.equal(by.ende, "2028-08-15");
  assert.match(by.warnungen[0], /nur in Teilen von Bayern Feiertag – AnwaltApex verlängert vorsorglich nicht\. Gilt er am Ort des Gerichts/);
});

test("Gerichtsort aus Gerichtsnamen", async () => {
  const { bundeslandAusGericht, bundeslandAusOrt } = await import("./feiertage");
  assert.equal(bundeslandAusGericht("Landgericht München I")?.land, "BY");
  assert.equal(bundeslandAusGericht("Landgericht München I")?.gericht, "Landgericht München I");
  assert.equal(bundeslandAusGericht("Strafbefehl des Amtsgerichts Hamburg vom 01.10.2026")?.land, "HH");
  assert.equal(bundeslandAusGericht("Amtsgericht Hamburg-Altona")?.land, "HH");
  assert.equal(bundeslandAusGericht("Rechtsmittel beim Kammergericht einlegen")?.land, "BE");
  assert.equal(bundeslandAusGericht("Amtsgericht Frankfurt (Oder)")?.land, "BB");
  assert.equal(bundeslandAusGericht("Amtsgericht Frankfurt am Main")?.land, "HE");
  assert.equal(bundeslandAusGericht("Amtsgericht Coburg – Zentrales Mahngericht")?.land, "BY");
  assert.equal(bundeslandAusGericht("Muster GmbH, Registergericht: Amtsgericht München HRB 12345"), undefined);
  assert.equal(bundeslandAusGericht("Sehr geehrte Damen und Herren"), undefined);
  assert.equal(bundeslandAusOrt("Köln"), "NW");
});

test("Frist mit festem Enddatum: Datum bleibt, Wochenende nur als Hinweis", async () => {
  const { berechneFestesEnde } = await import("./fristen");
  const r = berechneFestesEnde({ ende: "2026-11-21", ereignis: "2026-10-16", land: "BE" });
  assert.equal(r.ende, "2026-11-21");
  assert.equal(r.vorfrist, "2026-11-13");
  assert.match(r.warnungen[0], /Mo, 23\.11\.2026 \(§ 222 Abs\. 2 ZPO\)/);
  const kurz = berechneFestesEnde({ ende: "2026-10-19", ereignis: "2026-10-16", land: "BE" });
  assert.ok(kurz.vorfrist >= "2026-10-16");
});

// ───────────── RVG-Anrechnung im Mahnverfahren und Abrechnungsvorschläge (QA-Runde 3) ─────────────

test("RVG-Anrechnung: Geschäftsgebühr auf 3305, Mahnverfahrensgebühr auf 3100 (Vorbem. 3 Abs. 4, Anm. zu Nr. 3305)", () => {
  // 2300 → 3305 (ohne 3100): 1,3 / 2 = 0,65 aus 5.000 € = 230,43 €
  const mahn = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3305" }], gegenstandswert: 5000 });
  const a1 = mahn.zeilen.filter((z) => z.anrechnung);
  assert.deepEqual(a1.map((z) => [z.nr, z.betrag, z.angelegenheit]), [["Vorb. 3 IV", -230.43, "mahnverfahren"]]);
  // 3305 → 3100: volle Mahnverfahrensgebühr 1,0 = 354,50 €; die Geschäftsgebühr geht auf 3305, nicht ein zweites Mal auf 3100
  const alle = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3305" }, { nr: "3100" }], gegenstandswert: 5000 });
  const a2 = alle.zeilen.filter((z) => z.anrechnung);
  assert.deepEqual(a2.map((z) => [z.nr, z.betrag, z.angelegenheit]), [["Vorb. 3 IV", -230.43, "mahnverfahren"], ["Anm. 3305", -354.5, "gerichtlich"]]);
  const streit = berechneRvg({ positionen: [{ nr: "3305" }, { nr: "3100" }], gegenstandswert: 5000 });
  assert.deepEqual(streit.zeilen.filter((z) => z.anrechnung).map((z) => z.nr), ["Anm. 3305"]);
  // ohne Anrechnung bleibt alles stehen
  assert.equal(berechneRvg({ positionen: [{ nr: "3305" }, { nr: "3100" }], gegenstandswert: 5000, anrechnung: false }).zeilen.some((z) => z.anrechnung), false);
  // bisheriger Fall unverändert: 2300 → 3100
  const klassisch = berechneRvg({ positionen: [{ nr: "2300" }, { nr: "3100" }], gegenstandswert: 10000 });
  assert.deepEqual(klassisch.zeilen.filter((z) => z.anrechnung).map((z) => [z.nr, z.angelegenheit]), [["Vorb. 3 IV", "gerichtlich"]]);
});

test("Abrechnungsvorschlag: Anrechnungen aus Vorrechnungen, Mahnverfahren, Terminsgebühr, Strafsachen", async () => {
  const { vorschlagFuerAkte, istVorschlag, terminWahrgenommen } = await import("../pages/abrechnung/lib");
  const { DEMO_TENANTS, publicUser } = await import("./seed/tenants");
  const users = DEMO_TENANTS[0].users.map(publicUser);
  const usersById = new Map(users.map((u) => [u.id, u]));
  type A = Parameters<typeof vorschlagFuerAkte>[0];
  type R = Parameters<typeof vorschlagFuerAkte>[1][number];
  const basis = {
    id: "x1", aktenzeichen: "901/26", titel: "Muster ./. Beispiel wegen Forderung", mandantId: "k1", sachgebiet: "Forderungseinzug", phase: "Gerichtlich",
    status: "offen", prioritaet: "normal", bearbeiterId: users[0].id, gegenstandswert: 5000, schlagworte: [], beschreibung: "", gerichtId: "g1",
    createdAt: "2026-01-10T09:00:00", updatedAt: "2026-10-01T09:00:00",
  } as unknown as A;
  const mahngericht = { id: "g1", typ: "organisation" as const, name: "Amtsgericht Coburg – Zentrales Mahngericht", rollen: ["gericht" as const], createdAt: "" };
  const lg = { ...mahngericht, id: "g2", name: "Landgericht Coburg" };
  const r2300 = { id: "r1", nummer: "RE-2026-0001", akteId: "x1", empfaengerId: "", datum: "2026-02-01", faellig: "2026-02-15", positionen: [{ vv: "2300", bezeichnung: "GG", satz: 1.3, gegenstandswert: 5000, betrag: 460.85 }, { vv: "7002", bezeichnung: "P", betrag: 20 }], netto: 0, ust: 0, brutto: 0, status: "bezahlt", bezahlt: 0, format: "PDF", createdAt: "" } as unknown as R;
  const r3305 = { ...r2300, id: "r2", nummer: "RE-2026-0002", positionen: [{ vv: "3305", bezeichnung: "VG Mahn", satz: 1, gegenstandswert: 5000, betrag: 354.5 }, { vv: "7002", bezeichnung: "P", betrag: 20 }] } as R;

  // Mahnverfahren mit früher berechneter Geschäftsgebühr: 3305 mit Anrechnung, keine 3100/3104
  const v1 = vorschlagFuerAkte(basis, [r2300], [], usersById, 250, { gericht: mahngericht, fristen: [], dokumente: [] });
  assert.ok(istVorschlag(v1));
  assert.ok(v1.positionen.some((p) => p.vv === "3305"));
  assert.deepEqual(v1.positionen.filter((p) => p.betrag < 0).map((p) => [p.vv, p.betrag]), [["Vorb. 3 IV", -230.43]]);
  assert.ok(!v1.positionen.some((p) => p.vv === "3100" || p.vv === "3104" || p.vv === "2300"));
  // Vollstreckungsbescheid beantragt → 3308
  const v1b = vorschlagFuerAkte({ ...basis, forderung: { hauptforderung: 5000, faelligAb: "2026-01-01", verbraucher: true, titel: "Vollstreckungsbescheid AG Coburg" } } as A, [], [], usersById, 250, { gericht: mahngericht });
  assert.ok(istVorschlag(v1b) && v1b.positionen.some((p) => p.vv === "3308"));
  // Streitgericht nach Mahnverfahren: 3305 angerechnet, Geschäftsgebühr nicht doppelt, 3104 erst nach Termin
  const v2 = vorschlagFuerAkte({ ...basis, gerichtId: "g2" } as A, [r2300, r3305], [], usersById, 250, { gericht: lg, fristen: [] });
  assert.ok(istVorschlag(v2));
  assert.deepEqual(v2.positionen.filter((p) => p.betrag < 0).map((p) => [p.vv, p.betrag]), [["Anm. 3305", -354.5]]);
  assert.ok(!v2.positionen.some((p) => p.vv === "3305" && p.betrag > 0), "Mahnverfahrensgebühr nicht erneut berechnet");
  assert.ok(!v2.positionen.some((p) => p.vv === "3104"));
  // Rechtsstreit ohne Mahnverfahren: Geschäftsgebühr auf 3100
  const v2b = vorschlagFuerAkte({ ...basis, gerichtId: "g2" } as A, [r2300], [], usersById, 250, { gericht: lg, fristen: [] });
  assert.ok(istVorschlag(v2b));
  assert.deepEqual(v2b.positionen.filter((p) => p.betrag < 0).map((p) => p.vv), ["Vorb. 3 IV"]);
  assert.ok(!v2b.positionen.some((p) => p.vv === "2300"), "Geschäftsgebühr dient nur der Anrechnung");
  // Termin vergangen → Terminsgebühr 3104, Urteil → kein Vorschuss
  const termin = { id: "f1", akteId: "x1", titel: "Mündliche Verhandlung", typ: "termin" as const, datum: "2026-10-01", status: "offen" as const, verantwortlichId: "", quelle: "manuell" as const, createdAt: "" };
  const v3 = vorschlagFuerAkte({ ...basis, gerichtId: "g2", phase: "Urteil" } as A, [], [], usersById, 250, { gericht: lg, fristen: [termin], heute: "2026-10-16" });
  assert.ok(istVorschlag(v3) && v3.positionen.some((p) => p.vv === "3104") && !v3.vorschuss);
  assert.ok(terminWahrgenommen([], [{ id: "z", akteId: "x1", userId: "u", datum: "2026-10-01", minuten: 60, taetigkeit: "Wahrnehmung Gerichtstermin", abrechenbar: true }]));
  assert.ok(!terminWahrgenommen([{ ...termin, datum: "2026-10-20" }], [], "2026-10-16"));
  // Strafsache: nach Zeit nur mit Vergütungsvereinbarung (§ 3a RVG)
  const straf = { ...basis, id: "x2", sachgebiet: "Strafrecht", gerichtId: undefined, verguetungsvereinbarung: { datum: "2026-01-01", stundensatz: 300 } } as A;
  const v4 = vorschlagFuerAkte(straf, [], [{ id: "z1", akteId: "x2", userId: users[0].id, datum: "2026-10-01", minuten: 90, taetigkeit: "Akteneinsicht", abrechenbar: true }], usersById, 250);
  assert.ok(istVorschlag(v4) && v4.art === "stunden" && v4.positionen[0].betrag === 450);
  assert.ok(!istVorschlag(vorschlagFuerAkte({ ...straf, verguetungsvereinbarung: undefined } as A, [], [], usersById, 250)));
});

test("Formatierung: typografisches Minus, relative Zeit ab 60 Min. in Std., geschützte Leerzeichen", async () => {
  const { fmtEUR, relTime, schuetzeLeerzeichen } = await import("./dates");
  assert.equal(fmtEUR(-423.8), "−423,80 €");
  assert.equal(fmtEUR(-0.001), "0,00 €");
  const jetzt = new Date("2026-10-16T11:40:00").getTime();
  assert.equal(relTime("2026-10-16T11:20:00", jetzt), "vor 20 Min.");
  assert.equal(relTime("2026-10-16T10:40:30", jetzt), "vor 1 Std."); // nicht „vor 60 Min.“
  assert.equal(relTime("2026-10-15T12:00:00", jetzt), "gestern");
  assert.equal(relTime("2026-10-14T23:00:00", jetzt), "vor 2 Tagen");
  assert.equal(schuetzeLeerzeichen("§ 5 KSchG, 38 Std."), "§ 5 KSchG, 38 Std.");
});

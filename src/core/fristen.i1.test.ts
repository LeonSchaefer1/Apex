// Usability-Iteration 1 (Paket B, B-04): Prüfwerte aus T18, FamFG, Widerrufs- und vereinbarte Frist,
// Feiertagszeile im Rechenweg, Feiertag nur am Kanzleisitz, Monatsende-Wortlaut.
import { test } from "node:test";
import assert from "node:assert/strict";
import { berechneNachRegel, FRIST_REGELN, fristArt, regel } from "./fristen";
import { bundeslandAusGericht } from "./feiertage";

const zeile = (rw: string[], text: string) => rw.find((s) => s.includes(text));

test("T18 Fall 1: Monatsende (29.02. fehlt) und Ostermontag – Berlin", () => {
  const ber = berechneNachRegel("berufung", "2027-01-29", "BE", undefined, { feiertagsOrt: "Landgericht Berlin II" });
  assert.equal(ber.rohesEnde, "2027-02-28");
  assert.equal(ber.ende, "2027-03-01");
  // „rechnerisch 29.02.2027 – diesen Tag gibt es nicht → Monatsletzter 28.02.2027 (§ 188 Abs. 3 BGB)“
  const monat = zeile(ber.rechenweg, "rechnerisch 29.02.2027");
  assert.ok(monat, ber.rechenweg.join(" | "));
  assert.match(monat!, /diesen Tag gibt es nicht → Monatsletzter So, 28\.02\.2027 \(§ 188 Abs\. 3 BGB\)/);
  // „Sonntag → nächster Werktag Mo 01.03.2027“, danach Fristende mit § 222 Abs. 2 ZPO
  assert.ok(ber.rechenweg.some((s) => /Sonntag → nächster Werktag Mo, 01\.03\.2027/.test(s)), ber.rechenweg.join(" | "));
  assert.ok(ber.rechenweg.some((s) => s.startsWith("Fristende nach § 222 Abs. 2 ZPO: Mo, 01.03.2027")));
  const begr = berechneNachRegel("berufungsbegruendung", "2027-01-29", "BE");
  assert.equal(begr.rohesEnde, "2027-03-29");
  assert.equal(begr.ende, "2027-03-30");
  assert.ok(begr.rechenweg.some((s) => s.includes("Ostermontag (Berlin)")), begr.rechenweg.join(" | "));
});

test("T18 Fall 2: Internationaler Frauentag nur in Berlin", () => {
  const be = berechneNachRegel("berufung", "2027-02-08", "BE");
  assert.equal(be.ende, "2027-03-09");
  assert.ok(be.rechenweg.some((s) => s.includes("Internationaler Frauentag (Berlin)")));
  const nw = berechneNachRegel("berufung", "2027-02-08", "NW");
  assert.equal(nw.ende, "2027-03-08");
});

test("T18 Fall 3a: Berliner Kanzlei, OLG Brandenburg – Feiertag am Gerichtsort maßgeblich", () => {
  const ort = bundeslandAusGericht("OLG Brandenburg");
  assert.equal(ort?.land, "BB");
  const r = berechneNachRegel("berufung", "2027-02-08", ort!.land, undefined, { feiertagsOrt: "OLG Brandenburg", kanzleiLand: "BE" });
  assert.equal(r.ende, "2027-03-08");
  assert.equal(zeile(r.rechenweg, "Feiertage am Gerichtsort geprüft"), "Feiertage am Gerichtsort geprüft: Brandenburg (OLG Brandenburg)");
  assert.ok(r.rechenweg.includes("08.03.2027 Internationaler Frauentag – in Berlin Feiertag, in Brandenburg (Gerichtsort) nicht – keine Verschiebung"), r.rechenweg.join(" | "));
});

test("T18 Fall 3b: Paderborner Kanzlei, Hessisches LAG – Allerheiligen nur am Kanzleisitz", () => {
  assert.equal(bundeslandAusGericht("Hessisches LAG")?.land, "HE");
  assert.equal(bundeslandAusGericht("Hessisches Landesarbeitsgericht")?.land, "HE");
  assert.equal(bundeslandAusGericht("LAG Hessen Frankfurt")?.land, "HE");
  const r = berechneNachRegel("berufung_arbg", "2027-10-01", "HE", undefined, { feiertagsOrt: "Hessisches LAG", kanzleiLand: "NW" });
  assert.equal(r.ende, "2027-11-01");
  assert.ok(r.rechenweg.includes("01.11.2027 Allerheiligen – in Nordrhein-Westfalen Feiertag, in Hessen (Gerichtsort) nicht – keine Verschiebung"), r.rechenweg.join(" | "));
  assert.ok(r.rechenweg.some((s) => s.includes("keine Verschiebung: Mo, 01.11.2027")));
  // Gegenprobe: Gericht in NRW → Verschiebung auf Di 02.11.2027
  assert.equal(berechneNachRegel("berufung_arbg", "2027-10-01", "NW").ende, "2027-11-02");
});

test("Rechenweg nennt immer Land und Gerichtsort – ohne Normzitat, StPO ohne BGB/ZPO", () => {
  const ohne = berechneNachRegel("berufung", "2026-10-16", "NW");
  assert.equal(zeile(ohne.rechenweg, "Gerichtsort noch offen"), "Gerichtsort noch offen – geprüft mit den Feiertagen am Kanzleisitz (Nordrhein-Westfalen)");
  assert.ok(!ohne.rechenweg.some((s) => s.includes("§ 222 Abs. 2 ZPO")));
  assert.equal(ohne.feiertagsOrt, "Kanzleisitz");
  const stpo = berechneNachRegel("einspruch_strafbefehl", "2026-10-17", "BE", undefined, { kanzleiLand: "NW" });
  assert.ok(stpo.rechenweg.some((s) => s.startsWith("Feiertage am Gerichtsort geprüft: Berlin")));
  assert.ok(!stpo.rechenweg.some((s) => /BGB|ZPO/.test(s)), stpo.rechenweg.join(" | "));
  // Revision: Ort der Handlung BGH
  const rev = berechneNachRegel("revision", "2027-10-01", "BE", undefined, { kanzleiLand: "BE" });
  assert.ok(rev.rechenweg.some((s) => s === "Feiertage am Gerichtsort geprüft: Baden-Württemberg (Ort der Handlung: Bundesgerichtshof (Karlsruhe))"), rev.rechenweg.join(" | "));
});

test("FamFG: Beschwerde ein Monat, Begründung in Familienstreitsachen zwei Monate", () => {
  const b = berechneNachRegel("beschwerde_famfg", "2027-01-15", "NW");
  assert.equal(b.ende, "2027-02-15");
  assert.equal(b.regel.grundlage, "§ 63 Abs. 1 FamFG");
  assert.ok(b.rechenweg.some((s) => s.includes("§ 16 Abs. 2 FamFG")));
  assert.match(b.regel.hinweis!, /§ 63 Abs\. 3 S\. 2 FamFG/);
  assert.match(b.regel.versaeumnis, /§§ 17 ff\. FamFG/);
  assert.equal(fristArt(b.regel).kritisch, true);
  const begr = berechneNachRegel("beschwerdebegruendung_famfg", "2027-01-15", "NW");
  assert.equal(begr.ende, "2027-03-15");
  assert.match(begr.regel.hinweis!, /§ 117 Abs\. 1 S\. 4 FamFG i\. V\. m\. § 520 Abs\. 2 S\. 2, 3 ZPO/);
  assert.equal(fristArt(begr.regel).kritisch, false);
  const kurz = berechneNachRegel("beschwerde_famfg_kurz", "2027-01-15", "NW");
  assert.equal(kurz.ende, "2027-01-29");
  // Suchbegriffe „FamFG“, „Familie“, „Beschwerde“
  const such = (q: string) => FRIST_REGELN.filter((r) => [r.titel, r.grundlage, r.ereignis, r.gebiet, ...r.stichworte].join(" ").toLowerCase().includes(q)).map((r) => r.key);
  for (const q of ["famfg", "familie", "beschwerde"]) assert.ok(such(q).includes("beschwerde_famfg"), q);
});

test("Widerrufsfrist (Vergleich): Dauer ab Verkündung oder festes Datum laut Vergleich", () => {
  const r = regel("widerruf_vergleich")!;
  assert.equal(r.grundlage, "Gerichtlicher Vergleich mit Widerrufsvorbehalt");
  assert.equal(r.dauerPflicht, true);
  assert.match(r.hinweis!, /Adressat .* Form .* keine Verlängerung ohne Zustimmung/);
  // Verkündung Fr 16.10.2026 + 2 Wochen → Fr 30.10.2026
  const dauer = berechneNachRegel("widerruf_vergleich", "2026-10-16", "NW", 2, { einheit: "wochen" });
  assert.equal(dauer.ende, "2026-10-30");
  // Drei Wochen ab Sa 17.10.2026 → Sa 07.11.2026 → Mo 09.11.2026 (§ 193 BGB)
  const sa = berechneNachRegel("widerruf_vergleich", "2026-10-17", "NW", 3, { einheit: "wochen" });
  assert.equal(sa.ende, "2026-11-09");
  assert.ok(sa.rechenweg.some((s) => s.includes("Fristende nach § 193 BGB")));
  // Festes Datum laut Vergleich
  const fest = berechneNachRegel("widerruf_vergleich", "2026-10-16", "NW", undefined, { festesEnde: "2026-11-06" });
  assert.equal(fest.ende, "2026-11-06");
  assert.ok(fest.rechenweg.some((s) => s.includes("Fristende laut Vergleich (festes Datum)")));
  assert.ok(fest.rechenweg.some((s) => s.includes("Kanzleisitz (Nordrhein-Westfalen)")));
  // Vereinbarte Frist mit festem Datum am Sonntag: Datum bleibt, Hinweis auf § 193 BGB
  const v = berechneNachRegel("vereinbart_datum", "2026-10-16", "NW", undefined, { festesEnde: "2026-11-08" });
  assert.equal(v.ende, "2026-11-08");
  assert.match(v.warnungen.join(" "), /§ 193 BGB/);
});

test("Frei bestimmte Frist: eingegebene Dauer mit Einheit statt stiller 10 Tage", () => {
  assert.equal(regel("frei_tage")!.dauerPflicht, true);
  assert.equal(berechneNachRegel("frei_tage", "2026-10-16", "NW", 3, { einheit: "wochen" }).ende, "2026-11-06");
  assert.equal(berechneNachRegel("frei_tage", "2026-10-16", "NW", 1, { einheit: "monate" }).ende, "2026-11-16");
  assert.equal(berechneNachRegel("unbekannt", "2026-10-16", "NW", 5).regel.key, "frei_tage");
});

test("Vertragliche Ausschlussfrist: drei Monate ab Fälligkeit (§§ 187, 188, 193 BGB)", () => {
  const r = berechneNachRegel("ausschlussfrist_vertrag", "2026-09-30", "BE", 3, { einheit: "monate" });
  assert.equal(r.ende, "2026-12-30");
  assert.match(r.regel.hinweis!, /^Vertragliche Ausschlussfrist – Anspruchsverlust bei Versäumung/);
  assert.ok(r.rechenweg.some((s) => s.includes("§ 187 Abs. 1 BGB")));
  assert.equal(fristArt(r.regel).kurz, "Vertragliche Ausschlussfrist – Anspruchsverlust bei Versäumung");
});

// ───────────── Iteration 2 (A-15): neue Fristarten, Normzitat, Text ohne Gericht ─────────────

test("Entfristungsklage § 17 S. 1 TzBfG: 3 Wochen nach dem vereinbarten Ende, nicht verlängerbar, §§ 5–7 KSchG", () => {
  const r = regel("entfristungsklage")!;
  assert.equal(r.grundlage, "§ 17 S. 1 TzBfG");
  assert.equal(r.unverlaengerbar, true);
  assert.equal(fristArt(r).kritisch, true);
  assert.match(r.versaeumnis, /§ 17 S\. 2 TzBfG i\. V\. m\. § 7 KSchG/);
  assert.match(r.versaeumnis, /§ 5 KSchG/);
  assert.match(r.hinweis!, /§ 17 S\. 3 TzBfG/);
  // vereinbartes Ende Fr 30.10.2026 → Fr 20.11.2026
  assert.equal(berechneNachRegel("entfristungsklage", "2026-10-30", "BE").ende, "2026-11-20");
  // Ende Sa 31.10.2026 → Sa 21.11.2026 → Mo 23.11.2026 (§ 193 BGB)
  const sa = berechneNachRegel("entfristungsklage", "2026-10-31", "BE");
  assert.equal(sa.ende, "2026-11-23");
  assert.ok(r.stichworte.includes("entfristungsklage") && r.stichworte.includes("befristung"));
});

test("Entschädigungsklage § 61b Abs. 1 ArbGG: 3 Monate nach schriftlicher Geltendmachung, nicht verlängerbar", () => {
  const r = regel("entschaedigung_agg")!;
  assert.equal(r.grundlage, "§ 61b Abs. 1 ArbGG");
  assert.equal(fristArt(r).kritisch, true);
  assert.equal(fristArt(r).art, "Gesetzliche Klagefrist (§ 61b Abs. 1 ArbGG) – nicht verlängerbar.");
  assert.match(r.ereignis, /§ 15 Abs\. 4 AGG/);
  // Geltendmachung Di 15.09.2026 → Di 15.12.2026
  assert.equal(berechneNachRegel("entschaedigung_agg", "2026-09-15", "BE").ende, "2026-12-15");
  // 30.11.2026 + 3 Monate → 28.02.2027 (So) → Mo 01.03.2027
  assert.equal(berechneNachRegel("entschaedigung_agg", "2026-11-30", "BE").ende, "2027-03-01");
  assert.ok(r.stichworte.includes("entschädigungsklage") && r.stichworte.includes("agg"));
});

test("Berufungsbegründungsfrist zitiert § 520 Abs. 2 S. 1 ZPO; ohne Gericht „Gerichtsort noch offen“", () => {
  assert.equal(regel("berufungsbegruendung")!.grundlage, "§ 520 Abs. 2 S. 1 ZPO");
  const r = berechneNachRegel("berufungsbegruendung", "2026-10-16", "BB");
  assert.ok(r.rechenweg.includes("Gerichtsort noch offen – geprüft mit den Feiertagen am Kanzleisitz (Brandenburg)"), r.rechenweg.join(" | "));
  assert.ok(!r.rechenweg.some((s) => s.startsWith("Feiertage am Gerichtsort geprüft")));
  // mit Gericht bleibt die bisherige Zeile
  const mit = berechneNachRegel("berufungsbegruendung", "2026-10-16", "BE", undefined, { feiertagsOrt: "Kammergericht, Berufungsgericht" });
  assert.ok(mit.rechenweg.includes("Feiertage am Gerichtsort geprüft: Berlin (Kammergericht, Berufungsgericht)"));
});

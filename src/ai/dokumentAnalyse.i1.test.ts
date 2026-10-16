// Usability-Iteration 1 (Paket B, B-02/B-03): vertragliche Ausschlussfrist, vollständiger Tenor, Rechtsmittelgericht.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "../core/seed/tenants";
import { generateTenantData } from "../core/seed/generate";
import { analysiereRegelbasiert, ausschlussfristTitel, ausschlussfristVorschlag, erkenneAusschlussfrist, rechtsmittelgerichtZu } from "./dokumentAnalyse";

const HEUTE = "2026-10-16";
const t = DEMO_TENANTS[0];
const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, HEUTE);
const WEBER = data.akten.find((a) => a.aktenzeichen === "142/26")!;

test("Arbeitsvertrag Weber (142/26): Ausschlussfrist erkannt, Fälligkeit erfragt, Ende vom Fristenrechner", () => {
  const dok = data.dokumente.find((d) => d.akteId === WEBER.id && /^Arbeitsvertrag/.test(d.name))!;
  assert.ok(dok, "Arbeitsvertrag in der E-Akte 142/26");
  const a = analysiereRegelbasiert({ text: dok.inhalt, betreff: dok.name, eingang: HEUTE }, data, "BE");
  assert.equal(a.typ, "Arbeitsvertrag");
  assert.equal(a.dokumentArt, "vertrag");
  assert.ok(a.ausschlussfrist, "Ausschlussfrist erkannt");
  assert.equal(a.ausschlussfrist!.dauer, 3);
  assert.equal(a.ausschlussfrist!.einheit, "monate");
  assert.equal(a.ausschlussfrist!.beginn, "Fälligkeit");
  assert.equal(ausschlussfristTitel(a.ausschlussfrist!), "Ausschlussfrist erkannt: 3 Monate ab Fälligkeit (Arbeitsvertrag)");
  // Kein frei erfundenes Datum: ohne Fälligkeit keine berechnete Frist
  assert.equal(a.fristen.length, 0);
  assert.ok(!a.aktionen.some((x) => /zur kenntnis nehmen/i.test(x)), a.aktionen.join(" | "));
  assert.ok(a.aktionen.some((x) => x.startsWith("Ausschlussfrist erkannt: 3 Monate ab Fälligkeit")));
  // Fälligkeit 30.09.2026 → Mi 30.12.2026
  const f = ausschlussfristVorschlag(a.ausschlussfrist!, "2026-09-30", "BE", { kanzleiLand: "BE" });
  assert.equal(f.ende, "2026-12-30");
  assert.equal(f.regelKey, "ausschlussfrist_vertrag");
  assert.equal(f.typ, "frist");
  assert.ok(f.rechenweg.some((s) => s.includes("§ 187 Abs. 1 BGB")));
  assert.ok(f.rechenweg.some((s) => s.startsWith("Feiertage am Gerichtsort geprüft: Berlin")));
});

test("Ausschluss- und Verfallklauseln: Zahlwörter, Ziffern, zweite Stufe, Vertragsparagraph", () => {
  const zweistufig = erkenneAusschlussfrist(
    "§ 14 Ausschlussfristen\nAlle Ansprüche aus dem Arbeitsverhältnis verfallen, wenn sie nicht innerhalb von drei Monaten nach Fälligkeit schriftlich geltend gemacht werden. Lehnt die Gegenpartei den Anspruch ab oder erklärt sie sich nicht innerhalb von zwei Wochen, so verfällt dieser, wenn er nicht innerhalb von 3 Monaten nach der Ablehnung gerichtlich geltend gemacht wird.",
    "Arbeitsvertrag",
  )!;
  assert.equal(zweistufig.dauer, 3);
  assert.equal(zweistufig.einheit, "monate");
  assert.equal(zweistufig.fundstelle, "§ 14");
  assert.ok(zweistufig.zweiteStufe, "zweite Stufe erkannt");
  assert.equal(zweistufig.zweiteStufe!.dauer, 3);
  assert.match(zweistufig.zweiteStufe!.beginn, /ablehnung/);
  const v = ausschlussfristVorschlag(zweistufig, "2026-09-30", "NW");
  assert.match(v.warnungen.join(" "), /Zweite Stufe/);
  const ziffern = erkenneAusschlussfrist("Ausschlussfrist: 6 Monate ab Fälligkeit.")!;
  assert.equal(ziffern.dauer, 6);
  // Gesetzeszitate sind kein Vertragsparagraph
  const ohne = erkenneAusschlussfrist("Kündigungsfristen nach § 622 BGB. Ausschlussfrist: drei Monate ab Fälligkeit.")!;
  assert.equal(ohne.fundstelle, undefined);
  assert.equal(erkenneAusschlussfrist("Die Ware verfällt nicht."), undefined);
});

test("Urteil 28 O 211/26: Tenor vollständig mit Kostenquote 25/75 und Ergebnis für den Mandanten", () => {
  const n = data.nachrichten.find((x) => x.betreff.startsWith("28 O 211/"))!;
  const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, eingang: n.eingang }, data, "BE");
  assert.match(a.zusammenfassung, /verurteilt, an den Kläger 14\.250,00 €/);
  assert.match(a.zusammenfassung, /Im Übrigen wird die Klage abgewiesen/);
  assert.match(a.zusammenfassung, /Kostenquote 25\/75 \(Kläger 25 %, Beklagte 75 %\)/);
  assert.match(a.zusammenfassung, /Vorläufige Vollstreckbarkeit: Das Urteil ist gegen Sicherheitsleistung in Höhe von 110 %/);
  assert.match(a.zusammenfassung, /Ergebnis für Mandant Michael Neumann \(Kläger\): überwiegend erfolgreich/);
  // Rechtsmittelgericht laut Rechtsbehelfsbelehrung
  assert.equal(a.rechtsmittel?.text, "Berufung einzulegen beim Kammergericht, § 519 Abs. 1 ZPO");
  // Rechenweg nennt den Gerichtsort
  assert.ok(a.fristen[0].rechenweg.some((s) => s === "Feiertage am Gerichtsort geprüft: Berlin (Landgericht Berlin II – laut Schreiben)"), a.fristen[0].rechenweg.join(" | "));
});

test("Rechtsmittelgericht aus dem Instanzenzug: LG → OLG/KG, AG → LG, ArbG → LAG", () => {
  assert.equal(rechtsmittelgerichtZu("", "Landgericht Berlin II", { arbeitsgericht: false })?.gericht, "Kammergericht");
  assert.equal(rechtsmittelgerichtZu("", "Landgericht Paderborn", { arbeitsgericht: false })?.gericht, "Oberlandesgericht Hamm");
  assert.equal(rechtsmittelgerichtZu("", "Amtsgericht Mitte", { arbeitsgericht: false })?.gericht, "Landgericht Berlin II");
  assert.equal(rechtsmittelgerichtZu("", "Amtsgericht Tempelhof-Kreuzberg – Familiengericht", { arbeitsgericht: false })?.gericht, "Kammergericht");
  const arbg = rechtsmittelgerichtZu("", "Arbeitsgericht Kassel", { arbeitsgericht: true })!;
  assert.equal(arbg.gericht, "Hessisches Landesarbeitsgericht");
  assert.equal(arbg.norm, "§ 64 Abs. 6 ArbGG i. V. m. § 519 Abs. 1 ZPO");
  assert.equal(rechtsmittelgerichtZu("", "Arbeitsgericht Paderborn", { arbeitsgericht: true })?.gericht, "Landesarbeitsgericht Hamm");
  assert.equal(rechtsmittelgerichtZu("", "Arbeitsgericht Berlin", { arbeitsgericht: true })?.gericht, "Landesarbeitsgericht Berlin-Brandenburg");
});

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

test("Eine Aussage zur Wartung (I5-T13-01): Lizenz-Tab wie Landing, keine Zusage eines enthaltenen Wartungsjahres", async () => {
  const { WARTUNG_OPTIONAL, LIZENZ_KERN } = await import("../content/lizenz");
  const fs = await import("node:fs");
  const path = await import("node:path");
  assert.equal(WARTUNG_OPTIONAL, "Wartung optional – Umfang und Preis regelt das Angebot");
  assert.equal(LIZENZ_KERN, "Einmal investiert, dauerhaft genutzt – keine Monatsgebühren");
  // Landing nennt dieselben Worte („Wartung optional“ · „Umfang und Preis regelt das Angebot“), der Lizenz-Tab nutzt die Konstante
  const wurzel = path.resolve(import.meta.dirname, "..");
  const lizenzTab = fs.readFileSync(path.join(wurzel, "pages/einstellungen/LizenzTab.tsx"), "utf8");
  assert.match(lizenzTab, /\$\{WARTUNG_OPTIONAL\}/);
  const landing = fs.readFileSync(path.join(wurzel, "pages/public/landing/Lifetime.tsx"), "utf8");
  assert.ok(landing.includes("Wartung optional") && landing.includes("Umfang und Preis regelt das Angebot"));
  // In keinem sichtbaren Text unter src/ eine Zusage zum ersten Wartungsjahr – ausgenommen Code-Kommentare und
  // Angebotsfelder (Zeilen mit „laut Angebot“, z. B. eine Angabe im ROI-Rechner)
  const verboten = /^(?!.*laut Angebot).*(erste Jahr|erstes Wartungsjahr|Wartung inklusive|Wartung enthalten)/m;
  const treffer: string[] = [];
  const lauf = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) lauf(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) {
        const ohneKommentare = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
        if (verboten.test(ohneKommentare)) treffer.push(path.relative(wurzel, p));
      }
    }
  };
  lauf(wurzel);
  assert.deepEqual(treffer, []);
});

test("ROI-Rechner (I5-T13-01): enthaltenes erstes Wartungsjahr nur als Angabe laut Angebot, Standard aus", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const roi = fs.readFileSync(path.resolve(import.meta.dirname, "../pages/motor/RoiRechner.tsx"), "utf8");
  // Jeder Aufruf übergibt die Angabe ausdrücklich – kein stiller Standardwert „enthalten“
  const aufrufe = roi.match(/kostenLifetime\([^)]*\)/g) ?? [];
  assert.ok(aufrufe.length >= 2);
  for (const a of aufrufe) assert.match(a, /,\s*erstesJahr\)$/);
  assert.match(roi, /useState\(start\?\.erstesJahr \?\? false\)/);
  assert.match(roi, /Wartung im ersten Jahr im Lizenzpreis enthalten \(laut Angebot\)/);
  assert.doesNotMatch(roi, /je Platz, ab Jahr 2 – leer = ohne Wartung"/);
});

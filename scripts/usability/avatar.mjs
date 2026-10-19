// Avatar-Steuerung für Apex: bedient die App wie ein Mensch – Schritt für Schritt, mit Screenshots.
// Aufruf: node avatar.mjs <profilordner> <schritte.json | '-' für stdin>
// Das Profil (IndexedDB, localStorage, Cookies) bleibt zwischen Aufrufen erhalten – wie ein echter Browser.
// Schritte (JSON-Array), z. B.:
// [{"viewport":"desktop"},{"goto":"/login"},{"fill":["#login-email","julia.hartmann@hartmann-partner.de"]},
//  {"click":"text=Anmelden"},{"wait":1500},{"shot":"cockpit"},{"text":true},{"scroll":600},{"press":"Escape"}]
// viewport: desktop (1440×900) | laptop (1366×768) | tablet (1024×768) | tablet-hoch (768×1024) | handy (390×844) | klein (360×740)
// theme: "dark" | "light" (prefers-color-scheme) · motion: "reduce" · vision: "deuteranopia" | "protanopia" | "achromatopsia" | "none"
// viewport zusätzlich: reflow (320×640, WCAG 1.4.10) | zoom200 (720×450 @2x ≙ 200 % Zoom auf 1440×900, WCAG 1.4.4)
// {"axe": true} prüft die aktuelle Ansicht mit axe-core (WCAG 2.2 A/AA) und meldet serious/critical-Verstöße.
// click/hover/fill/press akzeptieren Playwright-Selektoren: "text=…", "role=button[name=\"…\"]", CSS, "#id".
// clickXY: [x, y] klickt an eine Bildschirmposition (wie eine Maus). type: "Text" tippt in das fokussierte Feld.
// Ausgabe: Screenshots als JPEG unter <profilordner>/shots/, eine Zusammenfassung (URL, sichtbare Texte, Fehler) auf stdout.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AVATAR_BASE ?? "http://127.0.0.1:5173";
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 1024, height: 768 },
  "tablet-hoch": { width: 768, height: 1024 },
  handy: { width: 390, height: 844 },
  klein: { width: 360, height: 740 },
  reflow: { width: 320, height: 640 },
  zoom200: { width: 720, height: 450, scale: 2 },
};

const [profil, quelle] = process.argv.slice(2);
if (!profil || !quelle) {
  console.error("Aufruf: node avatar.mjs <profilordner> <schritte.json|->");
  process.exit(2);
}
const schritte = JSON.parse(quelle === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(quelle, "utf8"));
fs.mkdirSync(path.join(profil, "shots"), { recursive: true });
const zustandDatei = path.join(profil, "zustand.json");
const zustand = fs.existsSync(zustandDatei) ? JSON.parse(fs.readFileSync(zustandDatei, "utf8")) : { url: "/", viewport: "desktop", theme: "light" };

const vpWahl = schritte.find((s) => s.viewport)?.viewport ?? zustand.viewport;
const themeWahl = schritte.find((s) => s.theme)?.theme ?? zustand.theme;
const motionWahl = schritte.find((s) => s.motion)?.motion ?? zustand.motion ?? "no-preference";
const visionWahl = schritte.find((s) => s.vision)?.vision ?? zustand.vision ?? "none";
const vp = VIEWPORTS[vpWahl] ?? VIEWPORTS.desktop;
const mobil = vp.width < 768;

const ctx = await chromium.launchPersistentContext(path.join(profil, "browser"), {
  executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined,
  viewport: { width: vp.width, height: vp.height },
  deviceScaleFactor: vp.scale ?? 1,
  reducedMotion: motionWahl === "reduce" ? "reduce" : "no-preference",
  isMobile: mobil,
  hasTouch: mobil,
  colorScheme: themeWahl === "dark" ? "dark" : "light",
  locale: "de-DE",
  timezoneId: "Europe/Berlin",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
if (visionWahl !== "none") {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: visionWahl });
}
const fehler = [];
page.on("pageerror", (e) => fehler.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/api\/info|status of 500|Failed to load resource/.test(m.text())) fehler.push(`console: ${m.text().slice(0, 300)}`);
});

const protokoll = [];
let shotNr = fs.readdirSync(path.join(profil, "shots")).length;
const ziel = (u) => (u.startsWith("http") ? u : BASE + u);

if (!schritte.some((s) => s.goto)) {
  await page.goto(ziel(zustand.url), { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1200);
}

for (const s of schritte) {
  try {
    if (s.viewport || s.theme || s.motion || s.vision) continue;
    if (s.goto) {
      await page.goto(ziel(s.goto), { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(s.warte ?? 1500);
      protokoll.push(`goto ${s.goto}`);
    } else if (s.click) {
      await page.locator(s.click).first().click({ timeout: s.timeout ?? 6000 });
      await page.waitForTimeout(s.warte ?? 700);
      protokoll.push(`click ${s.click}`);
    } else if (s.dblclick) {
      await page.locator(s.dblclick).first().dblclick({ timeout: 6000 });
      await page.waitForTimeout(s.warte ?? 700);
      protokoll.push(`dblclick ${s.dblclick}`);
    } else if (s.clickXY) {
      await page.mouse.click(s.clickXY[0], s.clickXY[1]);
      await page.waitForTimeout(s.warte ?? 700);
      protokoll.push(`clickXY ${s.clickXY.join(",")}`);
    } else if (s.hover) {
      await page.locator(s.hover).first().hover({ timeout: 6000 });
      await page.waitForTimeout(400);
      protokoll.push(`hover ${s.hover}`);
    } else if (s.fill) {
      await page.locator(s.fill[0]).first().fill(s.fill[1], { timeout: 6000 });
      protokoll.push(`fill ${s.fill[0]}`);
    } else if (s.type) {
      await page.keyboard.type(s.type, { delay: 25 });
      protokoll.push(`type ${s.type.slice(0, 40)}`);
    } else if (s.press) {
      await page.keyboard.press(s.press);
      await page.waitForTimeout(s.warte ?? 500);
      protokoll.push(`press ${s.press}`);
    } else if (s.select) {
      await page.locator(s.select[0]).first().selectOption(s.select[1]);
      protokoll.push(`select ${s.select[0]}`);
    } else if (s.upload) {
      await page.locator(s.upload[0]).first().setInputFiles(s.upload[1]);
      protokoll.push(`upload ${s.upload[1]}`);
    } else if (s.scroll !== undefined) {
      await page.evaluate((y) => {
        const el = document.querySelector("#haupt-scroll") ?? document.querySelector("#landing-scroll") ?? document.scrollingElement;
        el?.scrollBy({ top: y, behavior: "instant" });
      }, s.scroll);
      await page.waitForTimeout(500);
      protokoll.push(`scroll ${s.scroll}`);
    } else if (s.wait) {
      await page.waitForTimeout(s.wait);
    } else if (s.shot) {
      shotNr++;
      const datei = path.join(profil, "shots", `${String(shotNr).padStart(3, "0")}-${s.shot}.jpg`);
      await page.screenshot({ path: datei, type: "jpeg", quality: 70, fullPage: false });
      protokoll.push(`SCREENSHOT ${datei}`);
    } else if (s.text) {
      const t = await page.evaluate(() => {
        const sichtbar = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
        };
        const teile = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const txt = n.textContent.replace(/\s+/g, " ").trim();
          if (txt && n.parentElement && sichtbar(n.parentElement)) teile.push(txt);
        }
        const knoepfe = [...document.querySelectorAll("button, a, [role=tab], input, select, textarea")]
          .filter(sichtbar)
          .map((b) => (b.getAttribute("aria-label") || b.textContent || b.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 80);
        return { text: teile.join(" | ").slice(0, 4000), bedienelemente: [...new Set(knoepfe)] };
      });
      protokoll.push(`SICHTBARER TEXT: ${t.text}`);
      protokoll.push(`BEDIENELEMENTE: ${t.bedienelemente.join(" · ")}`);
    } else if (s.axe) {
      await page.addScriptTag({ path: new URL("./axe/package/axe.min.js", import.meta.url).pathname /* axe-core: im Ordner scripts/usability/axe mit `npm pack axe-core@4.10.2` und `tar xzf` bereitstellen */ });
      const r = await page.evaluate(async () => {
        // @ts-ignore
        const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        const v = res.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, hilfe: x.help, beispiel: x.nodes[0]?.target?.join(" ") }));
        return { serious: v.filter((x) => x.impact === "serious").length, critical: v.filter((x) => x.impact === "critical").length, verstoesse: v };
      });
      protokoll.push(`AXE: serious ${r.serious} · critical ${r.critical} · ${JSON.stringify(r.verstoesse).slice(0, 2500)}`);
    } else if (s.eval) {
      const r = await page.evaluate(s.eval);
      protokoll.push(`eval → ${JSON.stringify(r).slice(0, 1500)}`);
    }
  } catch (e) {
    protokoll.push(`FEHLER bei ${JSON.stringify(s)}: ${String(e.message ?? e).split("\n")[0]}`);
    if (s.abbrechen) break;
  }
}

const url = page.url().replace(BASE, "") || "/";
const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1).catch(() => false);
fs.writeFileSync(zustandDatei, JSON.stringify({ url, viewport: vpWahl, theme: themeWahl, motion: motionWahl, vision: visionWahl }));
await ctx.close();

console.log(`URL: ${url} · Viewport: ${vpWahl} ${vp.width}×${vp.height}${vp.scale ? " @" + vp.scale + "x" : ""} · Theme: ${themeWahl}${motionWahl === "reduce" ? " · reduzierte Bewegung" : ""}${visionWahl !== "none" ? " · Sehsimulation " + visionWahl : ""}${ueberlauf ? " · ACHTUNG: horizontales Scrollen" : ""}`);
for (const p of protokoll) console.log(p);
if (fehler.length) console.log(`KONSOLENFEHLER:\n${fehler.slice(0, 10).join("\n")}`);

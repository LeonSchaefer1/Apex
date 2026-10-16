// Interaktive Prüfabläufe: node scripts/flow.mjs <flow> <outDir> [--mobile] [--dark]
import { chromium } from "playwright";
import fs from "node:fs";
const [, , flow = "assistent", out = "screenshots", ...flags] = process.argv;
const base = process.env.BASE ?? "http://127.0.0.1:5173";
const mobile = flags.includes("--mobile");
const dark = flags.includes("--dark");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, colorScheme: dark ? "dark" : "light", isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("500")) errors.push(m.text()); });
const sfx = `${mobile ? "-m" : ""}${dark ? "-dark" : ""}`;
async function login(email = "julia.hartmann@hartmann-partner.de") {
  await page.goto(base + "/login");
  await page.waitForSelector("#login-email");
  await page.fill("#login-email", email);
  await page.fill("#login-passwort", "Apex-Demo-2026");
  await page.click("button[type=submit]");
  await page.waitForTimeout(2500);
}
if (flow === "assistent") {
  await login();
  await page.click('button[aria-label^="Apex Assistent öffnen"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/assistent-start${sfx}.png` });
  for (const [i, q] of ["Was steht heute an?", "Berechne die Berufungsfrist bei Zustellung heute"].entries()) {
    await page.fill("#assistent-eingabe", q);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${out}/assistent-${i + 1}${sfx}.png` });
  }
}
if (flow === "fallanalyse") {
  await login();
  await page.goto(base + "/akten/hero-a-1?tab=ki");
  await page.waitForTimeout(1500);
  const btn = page.getByRole("button", { name: "Fallanalyse starten" });
  await btn.click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}/fall-laeuft${sfx}.png` });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/fall-ergebnis${sfx}.png`, fullPage: true });
}
if (flow === "palette") {
  await login();
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(500);
  await page.keyboard.type("kündigung weber");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/palette${sfx}.png` });
}
if (flow === "hilfe") {
  await login();
  await page.goto(base + "/fristen");
  await page.waitForTimeout(1200);
  await page.click('button[aria-label^="Was ist das?"]');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/quickhelp${sfx}.png` });
}
console.log("done", flow, errors.length ? "\nERRORS:\n" + errors.slice(0, 10).join("\n") : "");
await browser.close();

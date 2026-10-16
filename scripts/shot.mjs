// Screenshots für die Qualitätssicherung: node scripts/shot.mjs <baseUrl> <outDir> <routes,...> [--mobile] [--dark] [--login=email]
import { chromium } from "playwright";
import fs from "node:fs";
const [, , base = "http://localhost:5173", out = "screenshots", routesArg = "/cockpit", ...flags] = process.argv;
const mobile = flags.includes("--mobile");
const dark = flags.includes("--dark");
const loginFlag = flags.find((f) => f.startsWith("--login="));
const email = loginFlag ? loginFlag.split("=")[1] : "julia.hartmann@hartmann-partner.de";
const fullPage = flags.includes("--full");
const wait = Number((flags.find((f) => f.startsWith("--wait=")) ?? "--wait=1200").split("=")[1]);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  colorScheme: dark ? "dark" : "light",
  isMobile: mobile,
  hasTouch: mobile,
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
const routes = routesArg.split(",");
if (!routes[0].startsWith("/login") && !routes[0].startsWith("/willkommen") && email !== "none") {
  await page.goto(base + "/login");
  await page.waitForSelector("#login-email", { timeout: 20000 });
  await page.fill("#login-email", email);
  await page.fill("#login-passwort", email.includes("admin@") ? "Apex-Console-2026" : "Apex-Demo-2026");
  await page.click("button[type=submit]");
  await page.waitForTimeout(2500);
}
for (const r of routes) {
  await page.goto(base + r);
  await page.waitForTimeout(wait);
  const name = `${r.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}${mobile ? "-m" : ""}${dark ? "-dark" : ""}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage });
  console.log("saved", `${out}/${name}`);
}
if (errors.length) console.log("CONSOLE ERRORS:\n" + errors.slice(0, 15).join("\n"));
await browser.close();

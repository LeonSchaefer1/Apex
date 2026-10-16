import { chromium } from "playwright";
const [, , url, out] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.goto(url);
await p.waitForTimeout(3500);
await p.screenshot({ path: out + "-1.png" });
const login = p.getByRole("button", { name: /Anmelden|Demo starten/ }).first();
if (await login.count()) { await login.click(); await p.waitForTimeout(1500); }
await p.screenshot({ path: out + "-2.png" });
const hart = p.getByRole("button", { name: /Hartmann/ }).first();
if (await hart.count()) { await hart.click(); await p.waitForTimeout(3500); }
await p.screenshot({ path: out + "-3.png" });
console.log("errors:", errs.slice(0, 8));
await b.close();

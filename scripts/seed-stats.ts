import { DEMO_TENANTS, publicUser } from "../src/core/seed/tenants";
import { generateTenantData } from "../src/core/seed/generate";
import { today } from "../src/core/dates";
for (const t of DEMO_TENANTS) {
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, today());
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as unknown[]).length]));
  const week = data.aktivitaeten.filter((a) => a.zeit >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).reduce((s, a) => s + (a.minutenGespart ?? 0), 0);
  console.log(t.tenant.kurzname, JSON.stringify(counts), "Woche gespart (h):", (week / 60).toFixed(1), "JSON KB:", Math.round(JSON.stringify(data).length / 1024));
  console.log("  Akten:", data.akten.slice(0, 8).map((a) => `${a.aktenzeichen} ${a.titel} [${a.status}]`).join(" | "));
  console.log("  Fristen heute:", data.fristen.filter((f) => f.datum === today() && f.status === "offen").map((f) => f.titel).join(", "));
}

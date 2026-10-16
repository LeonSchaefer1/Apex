import { DEMO_TENANTS, publicUser } from "../src/core/seed/tenants";
import { generateTenantData } from "../src/core/seed/generate";
import { today } from "../src/core/dates";
import { useData } from "../src/store/data";
import { frageAssistent } from "../src/ai/assistent";
const t = DEMO_TENANTS[0];
const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, today());
useData.setState({ data, status: "bereit" });
// Backend-Stub für putDoc
const sitzung = { user: publicUser(t.users[0]), tenant: t.tenant, team: t.users.map(publicUser) };
const fragen = [
  "Was steht heute an?", "Welche Fristen laufen diese Woche ab?", "Berechne die Berufungsfrist bei Zustellung heute",
  "Öffne die Akte 142/26", "Urteile zu Kündigung wegen Bagatelle", "Wie funktioniert der Bankabgleich?",
  "RVG für 10.000 € außergerichtlich", "Ich brauche meine Ansprechpartnerin", "Lege eine Wiedervorlage für Akte 137 in drei Tagen an",
  "Wie stehen die Chancen in der Sache Weber?", "Was ist mit Akte 126?",
];
for (const f of fragen) {
  const r = await frageAssistent({ verlauf: [{ role: "user", content: f }], sitzung, nav: (to) => console.log("   [nav]", to), voice: false });
  console.log(`\n» ${f}\n${r.text}\n   Werkzeuge: ${r.werkzeuge.join(", ")} | Links: ${r.links.map((l) => l.label).join(", ")}`);
}

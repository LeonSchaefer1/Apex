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
  // T0: Zahlenfragen (Cockpit-Zählweise) und Wiki mit Mindestscore
  "Wie viele neue Nachrichten habe ich?", "Wie viel Fremdgeld haben wir?", "Wie hoch sind die offenen Forderungen?",
  "Wie viele Stunden haben wir diese Woche gespart?", "Wie viele Akten haben wir?", "Was ist die Apex Island?", "Was macht die Apex Island?",
  "Wie funktioniert die Apex Island?", "Was macht der 38h-Motor?", "Wie lege ich eine neue Akte an?", "Wie funktioniert der Posteingang?",
  "Wie kann ich die Quantenflux-Synchronisation einstellen?", "Hallo",
  // T4/T1/T2: kritische Fristen, Kalenderwoche, Wiedervorlagen getrennt
  "Welche nicht verlängerbaren Fristen stehen als Nächstes an?", "Welche Notfristen laufen diese Woche ab?", "Welche kritischen Fristen habe ich?",
  "Welche Fristen sind heute fällig?", "Welche Fristen laufen in den nächsten 7 Tagen ab?", "Welche Fristen laufen nächste Woche ab?", "Wie viele Fristen habe ich heute?",
];
const warn = console.error;
console.error = () => {}; // Persistenz ist im Skript nicht initialisiert
for (const f of fragen) {
  const r = await frageAssistent({ verlauf: [{ role: "user", content: f }], sitzung, nav: (to) => console.log("   [nav]", to), voice: false });
  console.log(`\n» ${f}\n${r.text}\n   Werkzeuge: ${r.werkzeuge.join(", ")} | Links: ${r.links.map((l) => l.label).join(", ")}`);
}

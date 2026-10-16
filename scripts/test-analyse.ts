import { DEMO_TENANTS, publicUser } from "../src/core/seed/tenants";
import { generateTenantData } from "../src/core/seed/generate";
import { today, fmtDate } from "../src/core/dates";
import { analysiereRegelbasiert } from "../src/ai/dokumentAnalyse";
for (const t of DEMO_TENANTS) {
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, today());
  for (const n of data.nachrichten.filter((x) => x.kiStatus === "ausstehend")) {
    const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, eingang: n.eingang }, data, t.tenant.bundesland);
    const akte = data.akten.find((x) => x.id === a.akteId);
    console.log(`\n[${t.tenant.kurzname}] ${n.betreff}\n  Typ: ${a.typ} | Akte: ${akte?.aktenzeichen ?? "-"} ${akte?.titel ?? ""} (${Math.round(a.akteSicherheit * 100)}% ${a.akteGrund ?? ""})\n  Zusammenfassung: ${a.zusammenfassung}\n  Fristen: ${a.fristen.map((f) => `${f.titel} → ${fmtDate(f.ende)} (VF ${fmtDate(f.vorfrist)})`).join("; ") || "-"}\n  Termin: ${a.termin ? fmtDate(a.termin.datum) + " " + a.termin.uhrzeit + " " + (a.termin.ort ?? "") : "-"}\n  Aktionen: ${a.aktionen.join(" | ")}`);
  }
}

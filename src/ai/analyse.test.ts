import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "../core/seed/tenants";
import { generateTenantData } from "../core/seed/generate";
import { analysiereRegelbasiert } from "./dokumentAnalyse";
import { findePraezedenzfaelle } from "./kontext";

const HEUTE = "2026-10-16";
const t = DEMO_TENANTS[0];
const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, HEUTE);

test("Urteil per beA: Akte über Gerichtsaktenzeichen, Berufungs- und Begründungsfrist", () => {
  const n = data.nachrichten.find((x) => x.betreff.includes("28 O 211/25"))!;
  const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, eingang: n.eingang }, data, "BE");
  assert.equal(data.akten.find((x) => x.id === a.akteId)?.aktenzeichen, "118/26");
  assert.deepEqual(a.fristen.map((f) => f.regelKey), ["berufung", "berufungsbegruendung"]);
  assert.equal(a.fristen[0].ende, "2026-11-16");
  assert.equal(a.fristen[1].ende, "2026-12-16");
  assert.ok(a.eeb);
});

test("Richterliche Frist „binnen drei Wochen“", () => {
  const a = analysiereRegelbasiert({ text: "Der Klagepartei wird aufgegeben, binnen drei Wochen Stellung zu nehmen.", eingang: HEUTE }, data, "BE");
  assert.equal(a.fristen[0].ende, "2026-11-06");
});

test("Kündigung: Zugangsdatum aus dem Text, § 4 KSchG", () => {
  const a = analysiereRegelbasiert({ text: "Hiermit kündigen wir das Arbeitsverhältnis. Zugegangen am 09.10.2026.", eingang: HEUTE }, data, "BE");
  assert.equal(a.fristen[0].regelKey, "kschg_klage");
  assert.equal(a.fristen[0].ende, "2026-10-30");
});

test("Mandanten-E-Mail wird über den Namen zugeordnet", () => {
  const n = data.nachrichten.find((x) => x.von === "Thomas Weber")!;
  const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, eingang: n.eingang }, data, "BE");
  assert.equal(data.akten.find((x) => x.id === a.akteId)?.aktenzeichen, "142/26");
  assert.equal(a.fristen.length, 0);
});

test("Präzedenzfälle: Emmely für die Bagatellkündigung", () => {
  const akte = data.akten.find((x) => x.aktenzeichen === "142/26")!;
  assert.equal(findePraezedenzfaelle(akte, data, 3)[0].entscheidung.az, "2 AZR 541/09");
});

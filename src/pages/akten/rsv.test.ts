// Versicherer-Auswahl (I5-T04-01): Rollen je Akte, bekannte Rechtsschutzversicherer zuerst, Pflichtbestätigung nur beim reinen
// Gegner-Versicherer und beim Gegner der eigenen Akte – geprüft mit den Demodaten der Präsentationskanzlei.
import { test } from "node:test";
import assert from "node:assert/strict";
import { versichererOptionen, versichererWarnung } from "./rsv";

async function demo() {
  const { generateTenantData } = await import("@/core/seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("@/core/seed/tenants");
  const t = DEMO_TENANTS.find((x) => x.tenant.id === "t-hartmann")!;
  return generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-17");
}

test("Optionen: Gruppen und Rollen je Akte – Nordlicht/Spreebogen oben, Hanseatische unter „Weitere Versicherer“", async () => {
  const data = await demo();
  const o = versichererOptionen(data.kontakte, data.akten);
  const name = (s: string) => o.find((x) => x.name.startsWith(s))!;
  assert.deepEqual(o.slice(0, 2).map((x) => x.name), ["Nordlicht Rechtsschutz AG", "Spreebogen Rechtsschutz VVaG"]);
  assert.equal(name("Elbtal").rollen, "RSV in 116/26 · Gegnerin in 131/26");
  assert.equal(name("Elbtal").gruppe, "rsv");
  assert.equal(name("Isarwerk").rollen, "RSV in 154/26, 150/26 … · Gegnerin in 130/26", "höchstens zwei Az. je Rolle, dann „…“");
  assert.deepEqual(name("Isarwerk").rsvAkten, ["154/26", "150/26", "146/26", "128/26"]);
  assert.equal(name("Hanseatische").rollen, "Gegnerin in 107/26");
  assert.equal(name("Hanseatische").gruppe, "weitere");
  assert.equal(o.at(-1)!.name, "Hanseatische Kraftfahrt-Versicherung AG", "weitere Versicherer nach den Rechtsschutzversicherern");
  assert.ok(o.findIndex((x) => x.gruppe === "weitere") > o.findLastIndex((x) => x.gruppe === "rsv"));
});

test("Pflichtbestätigung nur (a) beim reinen Gegner-Versicherer und (b) beim Gegner der eigenen Akte", async () => {
  const data = await demo();
  const akte = (az: string) => data.akten.find((a) => a.aktenzeichen === az)!;
  const gegnerVon = (az: string) => ({ kontaktId: akte(az).gegnerId, az });
  // (a) Hanseatische – bisher nur Gegnerin in 107/26
  assert.equal(
    versichererWarnung("Hanseatische Kraftfahrt-Versicherung AG", data.kontakte, data.akten, gegnerVon("149/26")),
    "Hanseatische Kraftfahrt-Versicherung AG ist bisher nur als Gegnerin bekannt (107/26) – eine Deckungsanfrage ginge an die Gegenseite.",
  );
  // Elbtal: in fremden Akten ohne Pflicht, in 131/26 (dort Gegnerin) mit Pflicht (b)
  assert.equal(versichererWarnung("Elbtal Versicherung AG", data.kontakte, data.akten, gegnerVon("149/26")), undefined);
  assert.equal(versichererWarnung("Elbtal Versicherung AG", data.kontakte, data.akten, gegnerVon("131/26")), "Elbtal Versicherung AG ist Gegnerin in 131/26 – eine Deckungsanfrage ginge an die Gegenseite.");
  // Isarwerk in einer Akte, deren Gegner jemand anderes ist: keine Pflicht
  assert.equal(versichererWarnung("Isarwerk Versicherung AG", data.kontakte, data.akten, gegnerVon("142/26")), undefined);
  assert.ok(versichererWarnung("Isarwerk Versicherung AG", data.kontakte, data.akten, gegnerVon("130/26")));
  // Mandatsaufnahme: eingegebener Gegner (nur Name) = gewählter Versicherer
  assert.match(versichererWarnung("Nordlicht Rechtsschutz AG", data.kontakte, data.akten, { name: "Nordlicht Rechtsschutz" }) ?? "", /ist Gegnerin in diesem Mandat/);
  assert.equal(versichererWarnung("Nordlicht Rechtsschutz AG", data.kontakte, data.akten, { name: "Kröger Logistik GmbH" }), undefined);
  // Freitext für einen neuen Versicherer bleibt möglich – ohne Warnung
  assert.equal(versichererWarnung("Neue Rechtsschutz AG", data.kontakte, data.akten, {}), undefined);
});

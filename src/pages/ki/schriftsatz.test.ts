// Deckungsanfrage (Offline-Entwurf): Gegenstandswert wie im Klageentwurf, Herkunft der Schadennummer (I3-T19-01, I3-T07-06).
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTenantData } from "@/core/seed/generate";
import { DEMO_TENANTS, publicUser } from "@/core/seed/tenants";
import { entwurfOffline, kschGegenstandswert } from "./schriftsatz";

const n = (s: string) => s.replace(/\s/g, " ");

test("Kündigungsschutz: Antragsbestandteile 10.200 € + 3.400 € = 13.600 € aus dem Gegenstandswert der Akte ÷ 3", () => {
  const w = kschGegenstandswert(10200);
  assert.deepEqual([w.monat, w.bestand, w.weiterbeschaeftigung, w.gesamt], [3400, 10200, 3400, 13600]);
  assert.equal(
    n(w.text),
    "Kündigungsschutzantrag 10.200,00 € (drei Bruttomonatsentgelte à 3.400 €, § 42 Abs. 2 S. 1 GKG) + Weiterbeschäftigungsantrag 3.400,00 € (ein Bruttomonatsentgelt) = 13.600,00 €",
  );
  assert.equal(n(w.hinweisAkte), "Gegenstandswert der Akte (10.200 €) ohne Weiterbeschäftigungsantrag – bei Klageerhebung anpassen");
});

test("Deckungsanfrage 142/26 nennt 13.600 € wie der Klageentwurf, Schaden-Nr. mit Herkunft, Platzhalter bleibt", () => {
  const t = DEMO_TENANTS.find((x) => x.tenant.id === "t-hartmann")!;
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-17");
  const akte = data.akten.find((a) => a.aktenzeichen === "142/26")!;
  assert.equal(akte.gegenstandswert, 10200, "Wert der Akte bleibt (Präsentationsablauf T07)");
  const user = publicUser(t.users[0]);
  const text = n(entwurfOffline("deckung", "sachlich", "", { akte, data, tenant: t.tenant, user }));
  assert.match(text, /Gegenstandswert: Kündigungsschutzantrag 10\.200,00 € \(drei Bruttomonatsentgelte à 3\.400 €, § 42 Abs\. 2 S\. 1 GKG\) \+ Weiterbeschäftigungsantrag 3\.400,00 € \(ein Bruttomonatsentgelt\) = 13\.600,00 € \[Berechnung prüfen\]/);
  assert.match(text, /Gegenstandswert der Akte \(10\.200 €\) ohne Weiterbeschäftigungsantrag – bei Klageerhebung anpassen/);
  assert.match(text, /Schadennummer: S26-88412 \(Schadenmeldung durch Ihren Versicherungsnehmer\)/);
});

// Zeithonorar: ein Stundensatz je Eintrag – Zeitliste, Abrechnungsvorschau, Rechnung und Tätigkeitsnachweis stimmen überein (I2-T07-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Akte, Rechnung, User, Zeiteintrag } from "@/core/types";
import { betragFuerMinuten, istReineZeitrechnung, leistungszeitraum, satzAusPosition, satzFuerEintrag, stundenPositionen, summen, wertEintrag } from "./lib";

const users: User[] = [
  { id: "u-jh", tenantId: "t", name: "Dr. Julia Hartmann", email: "", rolle: "partner", titel: "Rechtsanwältin", initialen: "JH", farbe: "", stundensatz: 280 } as User,
  { id: "u-jb", tenantId: "t", name: "Jonas Brandt", email: "", rolle: "anwalt", titel: "Rechtsanwalt", initialen: "JB", farbe: "", stundensatz: 220 } as User,
];
const usersById = new Map(users.map((u) => [u.id, u]));
const z = (id: string, userId: string, minuten: number, datum = "2026-10-01", taetigkeit = "Aktenstudium"): Zeiteintrag => ({ id, akteId: "a", userId, datum, minuten, taetigkeit, abrechenbar: true });
const ohneVereinbarung = {} as Pick<Akte, "verguetungsvereinbarung">;
const mitVereinbarung = { verguetungsvereinbarung: { datum: "2026-09-01", stundensatz: 240 } } as Pick<Akte, "verguetungsvereinbarung">;

test("Zeitliste = Abrechnungsvorschau je Person (104/26: Brandt 0:18 + 0:36 zu 220 €)", () => {
  const eintraege = [z("1", "u-jb", 36, "2026-09-18"), z("2", "u-jb", 18, "2026-09-30"), z("3", "u-jh", 72, "2026-10-08")];
  // Zeitliste: jeder Eintrag mit dem Satz seiner Person – nie dem Satz der angemeldeten Person
  assert.equal(wertEintrag(eintraege[0], ohneVereinbarung, usersById), 132);
  assert.equal(wertEintrag(eintraege[1], ohneVereinbarung, usersById), 66);
  assert.equal(satzFuerEintrag(eintraege[0], ohneVereinbarung, usersById).quelle, "person");
  const pos = stundenPositionen(eintraege, ohneVereinbarung as Akte, usersById);
  const brandt = pos.find((p) => p.bezeichnung.includes("Jonas Brandt"))!;
  assert.equal(brandt.menge, 0.9);
  assert.equal(brandt.betrag, 198);
  assert.equal(satzAusPosition(brandt), 220);
  const hartmann = pos.find((p) => p.bezeichnung.includes("Julia Hartmann"))!;
  assert.equal(hartmann.betrag, 336);
  // Summe der Zeitliste = Summe der Positionen
  const liste = eintraege.reduce((s, e) => s + wertEintrag(e, ohneVereinbarung, usersById), 0);
  assert.equal(summen(pos).netto, liste);
});

test("Vereinbarter Satz (§ 3a RVG) gilt für alle Personen, abweichender Satz der Abrechnung hat Vorrang", () => {
  const eintraege = [z("1", "u-jh", 90), z("2", "u-jb", 12)];
  const pos = stundenPositionen(eintraege, mitVereinbarung as Akte, usersById);
  assert.deepEqual(pos.map((p) => p.betrag), [360, 48]);
  assert.ok(pos.every((p) => p.bezeichnung.includes("lt. Vergütungsvereinbarung vom 01.09.2026 (240 €/Std.)")));
  const abweichend = stundenPositionen(eintraege, mitVereinbarung as Akte, usersById, { abrechnungsSatz: 250 });
  assert.deepEqual(abweichend.map((p) => p.betrag), [375, 50]);
  assert.ok(abweichend.every((p) => !p.bezeichnung.includes("Vergütungsvereinbarung")));
  // Eingabe gleich dem vereinbarten Satz → Quelle bleibt „Vereinbarung“
  assert.equal(satzFuerEintrag(eintraege[0], mitVereinbarung, usersById, 240).quelle, "vereinbarung");
});

test("Betrag aus Minuten, nicht aus gerundeten Stunden: 20 Min. × 240 € = 80,00 €", () => {
  assert.equal(betragFuerMinuten(20, 240), 80);
  assert.equal(stundenPositionen([z("1", "u-jh", 20)], mitVereinbarung as Akte, usersById)[0].betrag, 80);
  assert.equal(betragFuerMinuten(7, 280), 32.67);
  assert.equal(betragFuerMinuten(12, 280), 56);
});

test("Einzelauswahl: nur die gewählten Einträge (125/26: Beratung 1:30 von 2:18 Std.)", () => {
  const offen = [z("b", "u-jh", 90, "2026-10-16", "Beratung"), z("a", "u-jh", 36, "2026-10-15"), z("c", "u-jb", 12, "2026-10-08", "Besprechung")];
  const gewaehlt = offen.filter((e) => e.id === "b");
  const s = summen(stundenPositionen(gewaehlt, mitVereinbarung as Akte, usersById));
  assert.deepEqual([s.netto, s.ust, s.brutto], [360, 68.4, 428.4]);
  const alle = summen(stundenPositionen(offen, mitVereinbarung as Akte, usersById));
  assert.equal(alle.netto, 552);
  const rest = offen.filter((e) => !gewaehlt.includes(e)).reduce((m, e) => m + e.minuten, 0);
  assert.equal(rest, 48);
});

test("Leistungszeitraum einer Zeitrechnung: erster bis letzter abgerechneter Eintrag; kein Gegenstandswert bei reiner Zeitrechnung", () => {
  const zeiten = [z("1", "u-jh", 90, "2026-10-16"), z("2", "u-jh", 30, "2026-10-02"), z("3", "u-jh", 30, "2026-09-01")];
  const r = { datum: "2026-10-16", zeitIds: ["1", "2"], positionen: [{ vv: "Std", bezeichnung: "Tätigkeit (240 €/Std.)", menge: 2, betrag: 480 }] } as unknown as Rechnung;
  const akte = { createdAt: "2026-04-27T09:00:00" } as Akte;
  assert.deepEqual(leistungszeitraum(akte, r, zeiten), ["2026-10-02", "2026-10-16"]);
  assert.deepEqual(leistungszeitraum(akte, { ...r, zeitIds: undefined }, zeiten), ["2026-04-27", "2026-10-16"]);
  assert.ok(istReineZeitrechnung(r));
  assert.ok(!istReineZeitrechnung({ positionen: [...r.positionen, { vv: "2300", bezeichnung: "GG", betrag: 100, gegenstandswert: 5000 }] }));
  assert.ok(istReineZeitrechnung({ positionen: [...r.positionen, { vv: "7002", bezeichnung: "Pauschale", betrag: 20 }] }));
});

// Zusammenführen eines Doppel-Datensatzes hängt alle Verweise um (I4-T17-01, B-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Akte, Kontakt, Rechnung } from "@/core/types";
import { darfZusammenfuehren, originalUndDublette, planeZusammenfuehrung, wendeZusammenfuehrungAn, zusammenfuehrText } from "./zusammenfuehren";

const k = (p: Partial<Kontakt> & Pick<Kontakt, "id" | "name">): Kontakt => ({ typ: "organisation", rollen: [], createdAt: "2026-01-01T09:00:00.000Z", ...p });
const kroeger = k({ id: "k-kro", name: "Kröger Logistik GmbH", firma: "Kröger Logistik GmbH", ort: "Berlin", rollen: ["gegner"], email: "personal@kroeger-logistik.de" });
const dublette = k({ id: "k-kro2", name: "Kröger Logistik GmbH", firma: "Kröger Logistik GmbH", rollen: ["mandant", "versicherung"], telefon: "+49 30 1234567", strasse: "Hafenstraße 4", plz: "10557", ort: "Hamburg", notiz: "Anruf von Herrn Kröger", createdAt: "2026-10-17T05:40:00.000Z" });
const weber = k({ id: "k-web", name: "Thomas Weber", typ: "person", rollen: ["mandant"] });
const gericht = k({ id: "k-arbg", name: "Arbeitsgericht Berlin", rollen: ["gericht"] });

const akte = (p: Partial<Akte> & Pick<Akte, "id" | "aktenzeichen" | "mandantId">): Akte => ({ titel: "Akte", sachgebiet: "Arbeitsrecht", phase: "Mandatsaufnahme", status: "offen", gegenstandswert: 0, bearbeiterId: "u1", beschreibung: "", schlagworte: [], prioritaet: "normal", createdAt: "2026-01-01T09:00:00.000Z", updatedAt: "2026-01-01T09:00:00.000Z", ...p }) as Akte;
const a142 = akte({ id: "a142", aktenzeichen: "142/26", titel: "Weber ./. Kröger Logistik GmbH", mandantId: "k-web", gegnerId: "k-kro", gerichtId: "k-arbg" });
const a160 = akte({ id: "a160", aktenzeichen: "160/26", mandantId: "k-kro2", gegnerId: "k-web" });
const a161 = akte({ id: "a161", aktenzeichen: "161/26", mandantId: "k-web", gegneranwaltId: "k-kro2", gerichtId: "k-kro2", forderung: { hauptforderung: 100, faelligAb: "2026-01-01", verbraucher: false, schuldnerId: "k-kro2" } });
const a162 = akte({ id: "a162", aktenzeichen: "162/26", mandantId: "k-web", rsv: { versicherung: "Kröger Logistik GmbH", versicherungsnummer: "", deckung: "offen" } });
const re = (id: string, empfaengerId: string): Rechnung => ({ id, nummer: `RE-${id}`, akteId: "a160", empfaengerId, datum: "2026-10-01", faellig: "2026-10-15", positionen: [], netto: 0, ust: 0, brutto: 0, status: "gestellt", bezahlt: 0, format: "PDF", createdAt: "2026-10-01T09:00:00.000Z" });

test("Zusammenführen hängt Mandant, Gegneranwalt, Gericht, Schuldner, Rechnungsempfänger und RSV (per Name) um", () => {
  const akten = [a142, a160, a161, a162];
  const rechnungen = [re("r1", "k-kro2"), re("r2", "k-web")];
  const plan = planeZusammenfuehrung(kroeger, dublette, { akten, rechnungen });
  assert.deepEqual(plan.akten.map((x) => x.akte.aktenzeichen), ["160/26", "161/26", "162/26"]);
  assert.deepEqual(plan.akten.find((x) => x.akte.id === "a161")!.rollen, ["Gegneranwalt", "Gericht", "Schuldner"]);
  assert.equal(plan.rechnungen.length, 1);

  const neu = wendeZusammenfuehrungAn(plan, { akten, rechnungen, kontakte: [kroeger, dublette, weber, gericht] });
  // Kein Verweis auf die Dublette bleibt übrig
  const json = JSON.stringify({ akten: neu.akten, rechnungen: neu.rechnungen, kontakte: neu.kontakte });
  assert.equal(json.includes("k-kro2"), false);
  const n160 = neu.akten.find((a) => a.id === "a160")!;
  assert.equal(n160.mandantId, "k-kro");
  const n161 = neu.akten.find((a) => a.id === "a161")!;
  assert.equal(n161.gegneranwaltId, "k-kro");
  assert.equal(n161.gerichtId, "k-kro");
  assert.equal(n161.forderung?.schuldnerId, "k-kro");
  assert.equal(n161.forderung?.hauptforderung, 100);
  assert.equal(neu.rechnungen.find((r) => r.id === "r1")!.empfaengerId, "k-kro");
  assert.equal(neu.rechnungen.find((r) => r.id === "r2")!.empfaengerId, "k-web");
  // Unbeteiligte Akte bleibt unverändert (dasselbe Objekt)
  assert.equal(neu.akten.find((a) => a.id === "a142"), a142);
  // Dublette gelöscht, Original mit Rollen und fehlenden Daten ergänzt – vorhandene Angaben des Originals bleiben
  assert.equal(neu.kontakte.some((x) => x.id === "k-kro2"), false);
  const orig = neu.kontakte.find((x) => x.id === "k-kro")!;
  assert.deepEqual(orig.rollen, ["gegner", "mandant", "versicherung"]);
  assert.equal(orig.telefon, "+49 30 1234567");
  assert.equal(orig.strasse, "Hafenstraße 4");
  assert.equal(orig.ort, "Berlin");
  assert.equal(orig.email, "personal@kroeger-logistik.de");
  assert.equal(orig.notiz, "Anruf von Herrn Kröger");
  assert.deepEqual(plan.abweichend.map((x) => x.feld), ["ort"]);
});

test("RSV-Verweis per Name wird auf den Namen des Originals umgestellt", () => {
  const vers = k({ id: "v1", name: "Nordlicht Rechtsschutz AG", rollen: ["versicherung"] });
  const vers2 = k({ id: "v2", name: "Nordlicht", rollen: ["versicherung"], createdAt: "2026-10-17T06:00:00.000Z" });
  const a = akte({ id: "a1", aktenzeichen: "155/26", mandantId: "k-web", rsv: { versicherung: "Nordlicht", versicherungsnummer: "RS-1", deckung: "offen", selbstbeteiligung: 150 } });
  const plan = planeZusammenfuehrung(vers, vers2, { akten: [a], rechnungen: [] });
  const neu = wendeZusammenfuehrungAn(plan, { akten: [a], rechnungen: [], kontakte: [vers, vers2] });
  assert.equal(neu.akten[0].rsv?.versicherung, "Nordlicht Rechtsschutz AG");
  assert.equal(neu.akten[0].rsv?.selbstbeteiligung, 150);
});

test("Richtung: der ältere Datensatz bleibt; Rechte; Protokolltext nennt Person und Akten; nicht mit sich selbst", () => {
  assert.equal(originalUndDublette(dublette, kroeger).original.id, "k-kro");
  assert.equal(darfZusammenfuehren("partner"), true);
  assert.equal(darfZusammenfuehren("admin"), true);
  assert.equal(darfZusammenfuehren("refa"), false);
  assert.equal(darfZusammenfuehren("azubi"), false);
  const plan = planeZusammenfuehrung(kroeger, dublette, { akten: [a160], rechnungen: [] });
  const t = zusammenfuehrText(plan, "Dr. Julia Hartmann");
  assert.match(t, /„Kröger Logistik GmbH“ \(Hamburg\) in „Kröger Logistik GmbH“ \(Berlin\)/);
  assert.match(t, /160\/26 \(Mandant\)/);
  assert.match(t, /durch Dr\. Julia Hartmann$/);
  // Rollen im Protokoll lesbar („Mandant, Versicherung“ statt Schlüsseln)
  assert.match(t, /Rollen ergänzt: Mandant, Versicherung/);
  assert.throws(() => planeZusammenfuehrung(kroeger, kroeger, { akten: [], rechnungen: [] }));
});

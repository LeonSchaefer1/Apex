import { test } from "node:test";
import assert from "node:assert/strict";
import { fremdgeldTreffer, ibanFormatiert, ibanGueltig, rsvAufteilung, rsvBlockText, summen, vorschussVorschlag } from "./abrechnung";
import type { Akte, Kontakt, Rechnung, Transaktion } from "./types";

function akte(extra: Partial<Akte> = {}): Akte {
  return {
    id: "a1", aktenzeichen: "131/26", titel: "Yilmaz ./. Elbtal Versicherung AG", sachgebiet: "Verkehrsrecht", phase: "Außergerichtlich", status: "offen", mandantId: "m", gegnerId: "v",
    gegenstandswert: 7420, bearbeiterId: "ra", beschreibung: "", schlagworte: [], prioritaet: "normal", createdAt: "2026-09-01T09:00:00", updatedAt: "2026-09-01T09:00:00", ...extra,
  };
}
const kontakte = new Map<string, Kontakt>([
  ["m", { id: "m", typ: "person", name: "Elif Yilmaz", vorname: "Elif", nachname: "Yilmaz", rollen: ["mandant"], createdAt: "2026-09-01T09:00:00" }],
  ["v", { id: "v", typ: "organisation", name: "Elbtal Versicherung AG", firma: "Elbtal Versicherung AG", rollen: ["gegner", "versicherung"], createdAt: "2026-09-01T09:00:00" }],
]);
function umsatz(extra: Partial<Transaktion>): Transaktion {
  return { id: "t1", datum: "2026-10-15", betrag: 6120, gegenpartei: "ELBTAL VERSICHERUNG AG", iban: "DE02 1203 0000 0000 2020 51", verwendungszweck: "Ihr Az. 131/26 Regulierung", status: "offen", ...extra };
}

test("summen: 19 % USt. (Nr. 7008 VV RVG), kaufmännisch gerundet", () => {
  assert.deepEqual(summen([{ vv: "2300", text: "", betrag: 100.01 } as never, { vv: "7002", text: "", betrag: 20 } as never]), { netto: 120.01, ust: 22.8, brutto: 142.81 });
  assert.deepEqual(summen([{ vv: "x", text: "", betrag: 50 } as never], false), { netto: 50, ust: 0, brutto: 50 });
});

test("rsvAufteilung: Rechnung bleibt beim Mandanten, Selbstbeteiligung höchstens bis zum Bruttobetrag", () => {
  const rsv = { versicherung: "Nordlicht Rechtsschutz AG", versicherungsnummer: "RS-4471209", deckung: "erteilt" as const, selbstbeteiligung: 150 };
  assert.deepEqual(rsvAufteilung(akte({ rsv }), 1000), { versicherung: "Nordlicht Rechtsschutz AG", versicherungsnummer: "RS-4471209", selbstbeteiligung: 150, anteilVersicherung: 850, zugesagt: true });
  const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  assert.match(rsvBlockText(rsvAufteilung(akte({ rsv }), 1000)!, fmt), /^Davon übernimmt Nordlicht Rechtsschutz AG \(Vers\.-Nr\. RS-4471209\): 850,00 €; Ihre Selbstbeteiligung: 150,00 €$/);
  // Deckung noch nicht erteilt: kein „Davon übernimmt“ als Tatsache
  const offen = rsvAufteilung(akte({ rsv: { ...rsv, deckung: "offen" } }), 1000)!;
  assert.equal(offen.zugesagt, false);
  assert.match(rsvBlockText(offen, fmt), /^Vorbehaltlich der Deckungszusage übernimmt Nordlicht/);
  assert.equal(rsvAufteilung(akte({ rsv }), 100)?.anteilVersicherung, 0);
  assert.equal(rsvAufteilung(akte({ rsv: { ...rsv, deckung: "abgelehnt" } }), 1000), undefined);
  assert.equal(rsvAufteilung(akte(), 1000), undefined);
});

test("vorschussVorschlag (§ 9 RVG): Gebühren der Phase, ohne bereits berechnete", () => {
  const v = vorschussVorschlag(akte(), []);
  assert.ok("positionen" in v);
  if ("positionen" in v) {
    assert.ok(v.positionen.some((p) => p.vv === "2300"));
    assert.equal(v.summen.brutto, summen(v.positionen).brutto);
  }
  const schon = { id: "r1", akteId: "a1", status: "gestellt", positionen: [{ vv: "2300", text: "", betrag: 1 }] } as unknown as Rechnung;
  assert.ok("grund" in vorschussVorschlag(akte(), [schon]));
  assert.match((vorschussVorschlag(akte({ gegenstandswert: 0 }), []) as { grund: string }).grund, /Gegenstandswert/);
});

test("ibanGueltig: Prüfziffer nach ISO 13616, deutsche IBAN mit 22 Stellen", () => {
  assert.equal(ibanGueltig("DE89 3704 0044 0532 0130 00"), true);
  assert.equal(ibanGueltig("de02120300000000202051"), true);
  assert.equal(ibanGueltig("DE89 3704 0044 0532 0130 01"), false);
  assert.equal(ibanGueltig("DE89 3704 0044 0532 0130"), false);
  assert.equal(ibanFormatiert("de89370400440532013000"), "DE89 3704 0044 0532 0130 00");
});

test("fremdgeldTreffer: Versicherer zahlt auf die Akte – Fremdgeld; Mandant, Abschluss, Ausgang nicht", () => {
  const t = fremdgeldTreffer(umsatz({}), [akte()], kontakte);
  assert.equal(t?.art, "fremdgeld");
  assert.equal(t?.akteId, "a1");
  assert.match(t?.grund ?? "", /Fremdgeld/);
  assert.equal(fremdgeldTreffer(umsatz({ gegenpartei: "ELIF YILMAZ" }), [akte()], kontakte), undefined);
  assert.equal(fremdgeldTreffer(umsatz({}), [akte({ status: "abgeschlossen" })], kontakte), undefined);
  assert.equal(fremdgeldTreffer(umsatz({ betrag: -100 }), [akte()], kontakte), undefined);
  assert.equal(fremdgeldTreffer(umsatz({ verwendungszweck: "Regulierung 1131/26" }), [akte()], kontakte), undefined);
  const mitSchaden = akte({ aktenzeichen: "9/26", rsv: { versicherung: "Elbtal Versicherung AG", versicherungsnummer: "", schadennummer: "EV-2026-448812", deckung: "erteilt" } });
  assert.equal(fremdgeldTreffer(umsatz({ verwendungszweck: "Schaden EV-2026-448812" }), [mitSchaden], kontakte)?.akteId, "a1");
});

test("Demodaten: Präsentationskanzleien enthalten einen offenen Versicherer-Umsatz, den die Fremdgeld-Regel erkennt", async () => {
  const { generateTenantData } = await import("./seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("./seed/tenants");
  const hartmann = DEMO_TENANTS[0];
  const d = generateTenantData({ tenant: hartmann.tenant, users: hartmann.users.map(publicUser), profil: hartmann.profil }, "2026-10-16");
  const km = new Map(d.kontakte.map((k) => [k.id, k]));
  const treffer = d.transaktionen.filter((t) => t.status === "offen").map((t) => fremdgeldTreffer(t, d.akten, km)).filter(Boolean);
  assert.ok(treffer.length >= 1, "kein Fremdgeld-Umsatz in den Demodaten");
  assert.equal(d.umzugLaeufe.length, 0);
});

// Usability-Iteration 3 (A-00, A-16, I3-T07-03): Rechnungsangaben im Kanzleiprofil
test("fehlendeRechnungsangaben: Steuernummer/USt-IdNr. und IBAN mit Prüfziffer", async () => {
  const { fehlendeRechnungsangaben, pruefeRechnungsangaben, ustIdNrGueltig, steuernummerGueltig, bicGueltig } = await import("./abrechnung");
  assert.deepEqual(fehlendeRechnungsangaben({}), ["Steuernummer oder USt-IdNr. (§ 14 Abs. 4 S. 1 Nr. 2 UStG)", "Bankverbindung (IBAN)"]);
  // Platzhalter der Rechnungsvorschau zählt nicht
  assert.deepEqual(fehlendeRechnungsangaben({ ustIdNr: "DE000000000", geschaeftskonto: { iban: "DE89 3704 0044 0532 0130 00" } }), ["Steuernummer oder USt-IdNr. (§ 14 Abs. 4 S. 1 Nr. 2 UStG)"]);
  // falsche Prüfziffer → IBAN fehlt
  assert.deepEqual(fehlendeRechnungsangaben({ steuernummer: "12/345/67890", geschaeftskonto: { iban: "DE89 3704 0044 0532 0130 01" } }), ["Bankverbindung (IBAN)"]);
  assert.deepEqual(fehlendeRechnungsangaben({ ustIdNr: "DE 123 456 789", geschaeftskonto: { iban: "DE89370400440532013000", bic: "COBADEFFXXX", bank: "Commerzbank" } }), []);
  assert.deepEqual(fehlendeRechnungsangaben({ steuernummer: "2181508150", geschaeftskonto: { iban: "de02120300000000202051" } }), []);
  assert.equal(ustIdNrGueltig("DE123456789"), true);
  assert.equal(ustIdNrGueltig("DE12345678"), false);
  assert.equal(ustIdNrGueltig("AT123456789"), false);
  assert.equal(steuernummerGueltig("12/345/67890"), true);
  assert.equal(steuernummerGueltig("1234567890123"), true);
  assert.equal(steuernummerGueltig("12/345"), false);
  assert.equal(steuernummerGueltig("12-345-67890"), false);
  assert.equal(bicGueltig("COBADEFF"), true);
  assert.equal(bicGueltig("COBADEFFXXX"), true);
  assert.equal(bicGueltig("COBA"), false);
  // feldgenaue Meldungen
  assert.deepEqual(pruefeRechnungsangaben({}), {});
  const f = pruefeRechnungsangaben({ ustIdNr: "DE12345", steuernummer: "12/3", geschaeftskonto: { iban: "DE89 3704 0044 0532 0130 01", bic: "XX" } });
  assert.match(f.ustIdNr!, /„DE“ und 9 Ziffern/);
  assert.match(f.steuernummer!, /10, 11 oder 13 Ziffern/);
  assert.match(f.iban!, /Prüfziffer/);
  assert.match(f.bic!, /8 oder 11 Zeichen/);
  assert.match(pruefeRechnungsangaben({ ustIdNr: "DE000000000" }).ustIdNr!, /Platzhalter/);
  assert.match(pruefeRechnungsangaben({ geschaeftskonto: { iban: "", bank: "Sparkasse" } }).iban!, /IBAN des Geschäftskontos/);
});

// Usability-Iteration 4 (Prüfung, Rest B-04 zu I4-T08-01): Anderkonto im Kanzleiprofil als Auftraggeberkonto der Fremdgeld-Weiterleitung
test("Rechnungsangaben: Anderkonto prüfen, normalisieren, protokollieren – nie gleich dem Geschäftskonto", async () => {
  const { fehlendeRechnungsangaben, pruefeRechnungsangaben, normalisiereRechnungsangaben, geaenderteRechnungsangaben } = await import("./abrechnung");
  const gk = { iban: "DE89 3704 0044 0532 0130 00" };
  // gültiges, eigenes Anderkonto → keine Meldung, Schreibweise in Vierergruppen
  assert.deepEqual(pruefeRechnungsangaben({ geschaeftskonto: gk, anderkonto: { iban: "de02120300000000202051", bank: " Deutsche Kreditbank " } }), {});
  assert.deepEqual(normalisiereRechnungsangaben({ geschaeftskonto: gk, anderkonto: { iban: "de02120300000000202051", bank: " Deutsche Kreditbank " } }).anderkonto, { iban: "DE02 1203 0000 0000 2020 51", bank: "Deutsche Kreditbank" });
  // falsche Prüfziffer, nur Bank, gleiche IBAN wie das Geschäftskonto
  assert.match(pruefeRechnungsangaben({ anderkonto: { iban: "DE02120300000000202052" } }).anderIban!, /Prüfziffer/);
  assert.match(pruefeRechnungsangaben({ anderkonto: { iban: "", bank: "Sparkasse" } }).anderIban!, /IBAN des Anderkontos/);
  assert.match(pruefeRechnungsangaben({ geschaeftskonto: gk, anderkonto: { iban: "DE89370400440532013000" } }).anderIban!, /verschiedene Konten.*§ 4 BORA/);
  // leer bleibt leer; keine Pflichtangabe auf Rechnungen
  assert.equal(normalisiereRechnungsangaben({ anderkonto: { iban: " " } }).anderkonto, undefined);
  assert.deepEqual(fehlendeRechnungsangaben({ steuernummer: "12/345/67890", geschaeftskonto: gk }), []);
  // Protokoll nennt die Änderung
  assert.deepEqual(geaenderteRechnungsangaben({ geschaeftskonto: gk }, { geschaeftskonto: gk, anderkonto: { iban: "DE02 1203 0000 0000 2020 51" } }), ["Anderkonto-IBAN"]);
});

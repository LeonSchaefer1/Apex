// E-Rechnung: Steuerkennung und Geschäftskonto aus dem Kanzleiprofil – Platzhalter nur, wenn leer, und dann gekennzeichnet (I3-T07-03).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Rechnung, Tenant } from "@/core/types";
import { xrechnungXml, zugferdXml } from "./erechnung";

const rechnung = {
  id: "r1",
  nummer: "RE-2026-0026",
  akteId: "a1",
  empfaengerId: "k1",
  datum: "2026-10-17",
  faellig: "2026-10-31",
  status: "gestellt",
  positionen: [{ vv: "2300", bezeichnung: "Geschäftsgebühr", betrag: 1000 }],
  netto: 1000,
  ust: 190,
  brutto: 1190,
  bezahlt: 0,
} as unknown as Rechnung;
const leer = { id: "t", name: "Hartmann & Partner", adresse: "Kurfürstendamm 186, 10707 Berlin" } as unknown as Tenant;
const vollstaendig = { ...leer, ustIdNr: "DE 123456789", steuernummer: "27/123/45678", geschaeftskonto: { iban: "DE89 3704 0044 0532 0130 00", bic: "COBADEFFXXX", bank: "Commerzbank" } } as Tenant;

test("XRechnung und ZUGFeRD: IBAN, BIC, USt-IdNr. und Steuernummer aus dem Kanzleiprofil", () => {
  const ubl = xrechnungXml(rechnung, { tenant: vollstaendig });
  assert.match(ubl, /<cbc:ID>DE89370400440532013000<\/cbc:ID>/);
  assert.match(ubl, /COBADEFFXXX/);
  assert.match(ubl, /DE123456789/);
  assert.match(ubl, /27\/123\/45678/);
  assert.doesNotMatch(ubl, /DE00000000000000000000|Platzhalter/);
  const cii = zugferdXml(rechnung, { tenant: vollstaendig });
  assert.match(cii, /<ram:IBANID>DE89370400440532013000<\/ram:IBANID>/);
  assert.match(cii, /<ram:BICID>COBADEFFXXX<\/ram:BICID>/);
  assert.match(cii, /schemeID="VA">DE123456789/);
  assert.match(cii, /schemeID="FC">27\/123\/45678/);
});

test("Ohne Angaben im Kanzleiprofil: gekennzeichnete Platzhalter statt stiller Fantasiewerte", () => {
  for (const xml of [xrechnungXml(rechnung, { tenant: leer }), zugferdXml(rechnung, { tenant: leer })]) {
    assert.match(xml, /DE00000000000000000000/);
    assert.match(xml, /Platzhalter: im Kanzleiprofil/);
  }
});

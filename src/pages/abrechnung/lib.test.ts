// Zeithonorar: ein Stundensatz je Eintrag – Zeitliste, Abrechnungsvorschau, Rechnung und Tätigkeitsnachweis stimmen überein (I2-T07-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Akte, Aktivitaet, Rechnung, Tenant, User, Zeiteintrag } from "@/core/types";
import {
  auswahlFuerAbrechnung,
  auswahlFuerFilter,
  betragFuerMinuten,
  fehlendKurz,
  fmtDauer,
  fmtDauerAusMenge,
  GEGENSTANDSWERT_FEHLER,
  istReineZeitrechnung,
  kopfUmschalten,
  kopfZustand,
  leistungszeitraum,
  naechsteNummern,
  pruefeBetragEingabe,
  pruefeZinssatzEingabe,
  satzAusPosition,
  satzFuerEintrag,
  sichtbareVorschlaege,
  stellenErlaubt,
  unterzeichnerVon,
  stellenTitel,
  stundenPositionen,
  summen,
  wertEintrag,
} from "./lib";

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

// ───────────── Sammelabrechnung: nur Sichtbares abrechnen (I3-T07-01) ─────────────

const sv = (id: string, deckung?: "erteilt" | "angefragt", umzug = false) => ({
  akte: { id, rsv: deckung ? ({ deckung } as Akte["rsv"]) : undefined, umzugLaufId: umzug ? "lauf" : undefined, abrechnungGeprueft: false },
  brutto: 100,
});

test("Sammelabrechnung: Auswahl ∩ Filter – ausgeblendete Auswahl wird nie abgerechnet", () => {
  const vs = [sv("a", "erteilt"), sv("b", "erteilt"), sv("c"), sv("d", "angefragt"), sv("e"), sv("f", "erteilt", true)];
  const alleGewaehlt = auswahlFuerFilter(vs, "alle");
  assert.equal(alleGewaehlt.size, 5, "Umzugsakte mit ungeprüftem Stand nicht vorausgewählt");
  // Filter „Deckung erteilt“: abgerechnet wird nur, was sichtbar UND gewählt ist
  assert.deepEqual(auswahlFuerAbrechnung(vs, alleGewaehlt, "erteilt").map((v) => v.akte.id), ["a", "b"]);
  assert.equal(sichtbareVorschlaege(vs, "erteilt").length, 3);
  // Filterwechsel setzt die Auswahl auf die sichtbaren Akten des neuen Filters
  const nachFilter = auswahlFuerFilter(vs, "erteilt");
  assert.deepEqual([...nachFilter].sort(), ["a", "b"]);
  assert.equal(kopfZustand(vs, nachFilter, "erteilt"), "an");
  // Kopf-Häkchen: 1× → 0 gewählt, 2× → alle wählbaren sichtbaren
  const einmal = kopfUmschalten(vs, nachFilter, "erteilt");
  assert.equal(einmal.size, 0);
  assert.equal(kopfZustand(vs, einmal, "erteilt"), "aus");
  const zweimal = kopfUmschalten(vs, einmal, "erteilt");
  assert.deepEqual([...zweimal].sort(), ["a", "b"]);
  // Teilweise: nur eine sichtbare gewählt; ausgeblendete Wahl zählt nicht
  const teil = new Set(["a", "c", "e"]);
  assert.equal(kopfZustand(vs, teil, "erteilt"), "teilweise");
  assert.deepEqual([...kopfUmschalten(vs, teil, "erteilt")].sort(), ["a", "b"], "Kopf-Häkchen verwirft ausgeblendete Auswahl");
  // Von Hand gewählte Umzugsakte zählt mit
  assert.equal(kopfZustand(vs, new Set(["a", "b", "f"]), "erteilt"), "an");
});

test("Zinsabschnitte: Grund je Abschnitt – Kostenbuchung teilt den Lauf bei gleichem Kapital und Satz (I3-T09-01)", async () => {
  const { forderungskonto } = await import("@/core/zinsen");
  const { zinsAbschnittGrund } = await import("./lib");
  const stand = forderungskonto({
    verzugAb: "2026-05-01",
    stichtag: "2026-10-17",
    verbraucher: false,
    vorgaenge: [
      { datum: "2026-05-01", art: "hauptforderung", betrag: 2000, text: "Hauptforderung" },
      { datum: "2026-06-19", art: "kosten", betrag: 40, text: "Mahnkosten" },
      { datum: "2026-08-16", art: "kosten", betrag: 25, text: "Auskunft" },
    ],
  } as Parameters<typeof forderungskonto>[0]);
  const gruende = stand.zinsAbschnitte.map((z, i) => zinsAbschnittGrund(z, stand.zinsAbschnitte[i - 1], stand.verlauf));
  assert.equal(gruende[0], "Verzugsbeginn 01.05.2026");
  assert.ok(gruende.includes("Kostenbuchung 19.06.2026"), gruende.join(" | "));
  assert.ok(gruende.includes("Kostenbuchung 16.08.2026"), gruende.join(" | "));
  assert.ok(gruende.includes("Basiszinssatz geändert zum 01.07.2026"), gruende.join(" | "));
});

test("Rückfrage „Rechnung stellen“: nächste Nummer(n), Pflichtangaben einmal mit Paragraph, Sperre nur außerhalb der Präsentationskanzlei", () => {
  const rechnungen = [
    { nummer: "RE-2026-0024", stornoNummer: "RE-2026-0025" },
    { nummer: "Entwurf-001" },
  ] as Rechnung[];
  const eine = naechsteNummern(rechnungen, 1, "2026");
  assert.deepEqual(eine, ["RE-2026-0026"]);
  assert.equal(stellenTitel(eine), "RE-2026-0026 stellen?");
  assert.deepEqual(naechsteNummern(rechnungen, 3, "2026"), ["RE-2026-0026", "RE-2026-0027", "RE-2026-0028"]);
  assert.equal(stellenTitel(naechsteNummern(rechnungen, 3, "2026")), "3 Rechnungen stellen?");
  const fehlend = ["Steuernummer oder USt-IdNr. (§ 14 Abs. 4 S. 1 Nr. 2 UStG)", "Bankverbindung (IBAN)"];
  assert.equal(fehlendKurz(fehlend), "Pflichtangaben fehlen: Steuernummer oder USt-IdNr. (§ 14 Abs. 4 UStG) · Bankverbindung (IBAN) für den Zahlungsweg");
  assert.equal(fehlendKurz(fehlend.slice(1)), "Rechnungsangaben fehlen: Bankverbindung (IBAN) für den Zahlungsweg");
  assert.equal(stellenErlaubt([], false, false), true);
  assert.equal(stellenErlaubt(fehlend, false, true), false, "Kundenkanzlei: gesperrt, auch mit Häkchen");
  assert.equal(stellenErlaubt(fehlend, true, false), false, "Präsentationskanzlei: nur mit Häkchen");
  assert.equal(stellenErlaubt(fehlend, true, true), true);
});

// ───────────── Eingabeprüfung (I5-T07-01) und ein Zeitformat je Ansicht (I5-T07-05) ─────────────

test("Gegenstandswert: „-500“, „0“, „abc“, leer → Meldung, kein Wert; gültige deutsche Eingaben → Wert", () => {
  for (const ein of ["-500", "−500", "0", "0,00", "abc", "12abc", "", "  "]) {
    const r = pruefeBetragEingabe(ein);
    assert.equal(r.fehler, GEGENSTANDSWERT_FEHLER, `„${ein}“`);
    assert.equal(r.wert, undefined, `„${ein}“ ohne Wert – kein stilles Klemmen auf 0`);
  }
  assert.equal(GEGENSTANDSWERT_FEHLER, "Bitte einen Gegenstandswert über 0 € eingeben.");
  assert.deepEqual(pruefeBetragEingabe("10.000"), { wert: 10000 });
  assert.deepEqual(pruefeBetragEingabe("10.000,50"), { wert: 10000.5 });
  assert.deepEqual(pruefeBetragEingabe("5000 €"), { wert: 5000 });
  assert.deepEqual(pruefeBetragEingabe("35.000"), { wert: 35000 });
  assert.equal(pruefeBetragEingabe("-1", "Bitte einen Betrag über 0 € eingeben.").fehler, "Bitte einen Betrag über 0 € eingeben.");
});

test("Zinsrechner: fester Zinssatz über 0 und bis 30 %, „4,5“ wie „4.5“", () => {
  assert.deepEqual(pruefeZinssatzEingabe("4"), { wert: 4 });
  assert.deepEqual(pruefeZinssatzEingabe("4,5"), { wert: 4.5 });
  assert.deepEqual(pruefeZinssatzEingabe("4.5 %"), { wert: 4.5 });
  for (const ein of ["0", "-3", "abc", "", "31", "120"]) assert.ok(pruefeZinssatzEingabe(ein).fehler, `„${ein}“ unplausibel`);
});

test("Zeitformat Std:Min in der Zeiterfassung: Einträge, Summen, Aktenwähler und Positionen gleich", () => {
  assert.equal(fmtDauer(36), "0:36 Std.");
  assert.equal(fmtDauer(138), "2:18 Std.");
  assert.equal(fmtDauerAusMenge(0.6), "0:36 Std.");
  assert.equal(fmtDauerAusMenge(0.2), "0:12 Std.");
  assert.equal(fmtDauerAusMenge(2.3), "2:18 Std.");
  assert.equal(fmtDauerAusMenge(1.5), "1:30 Std.");
  // 7 Min. → Menge 0,12 Std. (gerundet) → wieder 0:07
  assert.equal(fmtDauerAusMenge(Math.round((7 / 60) * 100) / 100), "0:07 Std.");
});

// ───────────── Korrekturrechnung: Leistungszeitraum und Bearbeitung der stornierten Rechnung (I5-T07-03) ─────────────

test("Korrekturentwurf zu RE-2026-0024: Zeitraum 22.08.–15.10.2026 und Bearbeitung Jonas Brandt wie das Original – auch im XML", async () => {
  const { xrechnungXml, zugferdXml } = await import("./erechnung");
  const akte = { id: "a150", aktenzeichen: "150/26", createdAt: "2026-08-22T10:00:00", bearbeiterId: "u-jh" } as Akte;
  const original = {
    id: "r24", nummer: "RE-2026-0024", akteId: "a150", empfaengerId: "k", datum: "2026-10-15", faellig: "2026-10-29", status: "storniert",
    stornoNummer: "RE-2026-0027", positionen: [{ vv: "2300", bezeichnung: "Geschäftsgebühr", betrag: 1000 }], netto: 1000, ust: 190, brutto: 1190, bezahlt: 0,
  } as unknown as Rechnung;
  const entwurf = { ...original, id: "r-k", nummer: "Entwurf-002", datum: "2026-10-17", faellig: "2026-10-31", status: "entwurf", stornoNummer: undefined, korrekturVon: "r24" } as unknown as Rechnung;
  const rechnungen = [original, entwurf];
  assert.deepEqual(leistungszeitraum(akte, entwurf, [], rechnungen), ["2026-08-22", "2026-10-15"]);
  assert.deepEqual(leistungszeitraum(akte, entwurf), ["2026-08-22", "2026-10-17"], "ohne Rechnungsbestand wie bisher bis zum Rechnungsdatum");
  // Kette ohne Schleife: Korrektur einer Korrektur
  const zweite = { ...entwurf, id: "r-k2", korrekturVon: "r-k" } as Rechnung;
  assert.deepEqual(leistungszeitraum(akte, zweite, [], [...rechnungen, zweite]), ["2026-08-22", "2026-10-15"]);
  const zyklisch = { ...entwurf, id: "r-x", korrekturVon: "r-x" } as Rechnung;
  assert.deepEqual(leistungszeitraum(akte, zyklisch, [], [zyklisch]), ["2026-08-22", "2026-10-17"]);

  const julia = users[0];
  const aktivitaeten = [
    { id: "x1", zeit: "2026-10-15T11:00:00", akteur: "nutzer", userId: "u-jb", akteId: "a150", text: "Rechnung RE-2026-0024 gestellt – 150/26" },
  ] as Aktivitaet[];
  assert.equal(unterzeichnerVon(entwurf, aktivitaeten, usersById, julia, usersById.get("u-jh"), rechnungen)?.name, "Jonas Brandt");
  assert.equal(unterzeichnerVon(entwurf, aktivitaeten, usersById, julia, usersById.get("u-jh"))?.name, "Dr. Julia Hartmann", "ohne Bestand: angemeldete Person (bisheriges Verhalten)");
  assert.equal(unterzeichnerVon({ ...entwurf, korrekturVon: undefined }, aktivitaeten, usersById, julia, undefined, rechnungen)?.name, "Dr. Julia Hartmann", "gewöhnlicher Entwurf unverändert");

  const tenant = { id: "t", name: "Hartmann & Partner", adresse: "Kurfürstendamm 186, 10707 Berlin" } as unknown as Tenant;
  const ubl = xrechnungXml(entwurf, { akte, tenant, rechnungen });
  assert.match(ubl, /<cbc:StartDate>2026-08-22<\/cbc:StartDate><cbc:EndDate>2026-10-15<\/cbc:EndDate>/);
  const cii = zugferdXml(entwurf, { akte, tenant, rechnungen });
  assert.match(cii, /<ram:StartDateTime><udt:DateTimeString format="102">20260822<\/udt:DateTimeString><\/ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">20261015</);
});

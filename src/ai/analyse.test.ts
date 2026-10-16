import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "../core/seed/tenants";
import { generateTenantData } from "../core/seed/generate";
import { analysiereRegelbasiert, beispielDokumente } from "./dokumentAnalyse";
import { findePraezedenzfaelle } from "./kontext";
import { addDays, fmtDate, wochentagName } from "../core/dates";

const HEUTE = "2026-10-16";
const t = DEMO_TENANTS[0];
const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, HEUTE);

test("Urteil per beA: Akte über Gerichtsaktenzeichen, Berufungs- und Begründungsfrist", () => {
  const n = data.nachrichten.find((x) => x.betreff.startsWith("28 O 211/"))!;
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

test("Mandanten-E-Mail: exakt passende Absenderadresse ergibt eine sichere Zuordnung", () => {
  const n = data.nachrichten.find((x) => x.von === "Thomas Weber")!;
  const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: n.eingang }, data, "BE");
  assert.equal(data.akten.find((x) => x.id === a.akteId)?.aktenzeichen, "142/26");
  assert.ok(a.akteSicherheit >= 0.95, `Sicherheit ${a.akteSicherheit}`);
  assert.match(a.akteGrund ?? "", /thomas\.weber@posteo\.de/);
  // Die Zusammenfassung nennt den Zeugenhinweis
  assert.match(a.zusammenfassung, /Pohl/);
});

test("Präzedenzfälle: keine fachfremden Treffer über einzelne Wörter aus Dokumenten", () => {
  const akte = data.akten.find((x) => x.aktenzeichen === "142/26")!;
  const azs = findePraezedenzfaelle(akte, data, 5).map((t) => t.entscheidung.az);
  assert.ok(!azs.includes("1 ABR 22/21") && !azs.includes("9 AZR 423/16") && !azs.includes("C-55/18"), azs.join(", "));
});

test("Fallanalyse Weber: kuratierte Präzedenzfälle, Kündigungsdatum aus dem Schreiben, Unterschrift mit Namen", async () => {
  const { analysiereFall, kuendigungsDaten } = await import("./fallanalyse");
  const akte = data.akten.find((x) => x.aktenzeichen === "142/26")!;
  const kd = kuendigungsDaten(akte, data);
  const frist = data.fristen.find((f) => f.akteId === akte.id && f.regelKey === "kschg_klage")!;
  assert.equal(kd.zugang, fmtDate(frist.ereignisDatum!));
  assert.notEqual(kd.kuendigung, kd.zugang);
  const r = await analysiereFall(akte.id, data, { verfasser: { name: "Dr. Julia Hartmann", titel: "Rechtsanwältin · Fachanwältin für Arbeitsrecht" } });
  assert.deepEqual(r.praezedenzfaelle.map((p) => p.az), ["2 AZR 541/09", "2 AZR 133/18", "2 AZR 681/16"]);
  assert.ok(r.praezedenzfaelle[0].relevanz > r.praezedenzfaelle[1].relevanz);
  assert.ok(r.entwurf.text.includes(`Kündigung der Beklagten vom ${kd.kuendigung}, dem Kläger zugegangen am ${kd.zugang},`));
  assert.ok(r.entwurf.text.trim().endsWith("Dr. Julia Hartmann\nRechtsanwältin\nFachanwältin für Arbeitsrecht"));
});

test("Assistent: Fristenzahl ungekürzt, gleiche Zählweise wie fristenLage", async () => {
  const { fristenListe } = await import("./assistent");
  const { fristenLage } = await import("../core/fristenLage");
  // Testdaten künstlich anreichern: mehr als 12 Fristen in den nächsten 7 Tagen
  const vorlage = data.fristen.find((f) => f.typ === "frist" && !f.regelKey)!;
  const extra = Array.from({ length: 14 }, (_, i) => ({ ...vorlage, id: `t-f${i}`, status: "offen" as const, typ: "frist" as const, datum: addDays(HEUTE, 1 + (i % 7)) }));
  const reich = { ...data, fristen: [...data.fristen, ...extra] };
  const lage = fristenLage(reich.fristen, HEUTE);
  const woche = fristenListe(reich, "woche", HEUTE);
  assert.equal(woche.anzahl, lage.woche.length);
  assert.ok(woche.anzahl > 12, "Testdaten enthalten mehr als 12 Fristen in der Woche");
  assert.equal(woche.eintraege.length, 12);
  assert.equal(woche.weitere, woche.anzahl - 12);
  assert.equal(woche.wiedervorlagen, lage.wiedervorlagenWoche.length);
  const heute = fristenListe(reich, "heute", HEUTE);
  assert.equal(heute.anzahl, lage.faellig.length);
  assert.equal(heute.ueberfaellig, lage.ueberfaellig.length);
  assert.equal(heute.vorfristen, lage.vorfristen.length);
  assert.equal(heute.wiedervorlagen, lage.wiedervorlagen.length);
  // Wiedervorlagen, Vorfristen und Termine zählen nie als Fristen
  for (const z of ["heute", "woche", "kalenderwoche", "monat", "kommend"] as const) {
    const l = fristenListe(reich, z, HEUTE);
    assert.ok(l.eintraege.every((e) => e.typ === "frist" || e.typ === "notfrist"), z);
  }
  // „diese Woche“ = Kalenderwoche bis Sonntag (16.10.2026 ist ein Freitag)
  assert.equal(fristenListe(reich, "kalenderwoche", HEUTE).bis, "2026-10-18");
});

test("Assistent (offline): „Ja“ auf die Rückfrage nach dem Rückruf, Ansprechpartner ohne Pronomen, Link zum Fristenrechner", async () => {
  const { frageAssistent, vorschlaege } = await import("./assistent");
  const { useData } = await import("../store/data");
  const warn = console.warn;
  console.warn = () => {}; // Persistenz ist im Test nicht initialisiert
  try {
    useData.setState({ data: structuredClone(data), status: "bereit" });
    const lindner = DEMO_TENANTS[1];
    const sitzung = { user: publicUser(lindner.users[0]), tenant: lindner.tenant, team: lindner.users.map(publicUser) };
    const nav = () => {};
    const erste = await frageAssistent({ verlauf: [{ role: "user", content: "Ich brauche meine Ansprechpartnerin" }], sitzung, nav, voice: false });
    assert.match(erste.text, /^Ihr fester Ansprechpartner: Markus Seidel/);
    assert.ok(!/\b(sie|ihn|er)\b erreichen|erreichen Sie (sie|ihn)/i.test(erste.text), erste.text);
    const ja = await frageAssistent({ verlauf: [{ role: "user", content: "Ich brauche meine Ansprechpartnerin" }, { role: "assistant", content: erste.text }, { role: "user", content: "Ja" }], sitzung, nav, voice: false });
    assert.ok(ja.werkzeuge.includes("Rückruf angefordert"), ja.text);
    assert.match(ja.text, /Rückruf bei Markus Seidel angefordert/);
    const frist = await frageAssistent({ verlauf: [{ role: "user", content: "Wann endet die Kündigungsschutzklage bei Zugang am 1.10.2026?" }], sitzung, nav, voice: false });
    assert.ok(frist.links.some((l) => l.to === "/fristen?rechner=1&regel=kschg_klage&ereignis=2026-10-01"), JSON.stringify(frist.links));
    // Vorschläge nur mit Aktenzeichen, die es gibt
    const leer = { ...data, akten: data.akten.filter((a) => !a.id.startsWith("hero-")) };
    const v = vorschlaege(leer).find((x) => x.startsWith("Öffne die Akte"));
    assert.ok(!v || leer.akten.some((a) => v.endsWith(a.aktenzeichen)));
  } finally {
    console.warn = warn;
  }
});

// ───────────── Dokument-Analyse: Fristen, Termine, Gerichtsort (QA-Runde 2) ─────────────
const NEUMANN = data.akten.find((x) => x.aktenzeichen === "118/26")!;

test("Zugestelltes Urteil ohne Rechtsmittelbelehrung: trotzdem Berufungs- und Begründungsfrist", () => {
  const text = `Landgericht Berlin II, Az. ${NEUMANN.gerichtsAz}. In dem Rechtsstreit Neumann ./. Arslan Autohaus GmbH wird Ihnen das Urteil vom 09.10.2026 zugestellt. Die Klage wird überwiegend zugesprochen.`;
  const a = analysiereRegelbasiert({ text, eingang: HEUTE }, data, "BE");
  assert.equal(a.typ, "Urteil");
  assert.equal(a.akteId, NEUMANN.id);
  assert.deepEqual(a.fristen.map((f) => [f.regelKey, f.ende]), [["berufung", "2026-11-16"], ["berufungsbegruendung", "2026-12-16"]]);
  assert.ok(!a.aktionen.some((x) => /zur kenntnis nehmen/i.test(x)), a.aktionen.join(" | "));
});

test("Urteil des Arbeitsgerichts: Berufung und Begründung nach § 66 ArbGG", () => {
  const a = analysiereRegelbasiert({ text: "In dem Rechtsstreit Weber ./. Kröger Logistik GmbH wird Ihnen das Urteil vom 09.10.2026 zugestellt. Die Kündigung ist unwirksam.", von: "Arbeitsgericht Berlin", eingang: HEUTE }, data, "BE");
  assert.deepEqual(a.fristen.map((f) => f.regelKey), ["berufung_arbg", "berufungsbegruendung_arbg"]);
  assert.equal(a.fristen[1].grundlage, "§ 66 Abs. 1 S. 1 ArbGG");
});

test("Berufungsurteil: Revisionsfrist nur bei Zulassung, sonst Hinweis", () => {
  const nicht = analysiereRegelbasiert({ text: "In dem Rechtsstreit Müller ./. Schmidt wird Ihnen das Urteil vom 09.10.2026 zugestellt. Die Berufung wird zurückgewiesen. Die Revision wird nicht zugelassen.", von: "Kammergericht", eingang: HEUTE }, data, "BE");
  assert.equal(nicht.fristen.length, 0);
  assert.ok(nicht.aktionen.some((x) => /Nichtzulassungsbeschwerde/.test(x)));
  const zu = analysiereRegelbasiert({ text: "In dem Rechtsstreit Müller ./. Schmidt wird Ihnen das Urteil vom 09.10.2026 zugestellt. Die Revision wird zugelassen.", von: "Kammergericht", eingang: HEUTE }, data, "BE");
  assert.deepEqual(zu.fristen.map((f) => f.regelKey), ["revision", "revisionsbegruendung"]);
  // Revision wird beim BGH in Karlsruhe eingelegt – dessen Feiertage gelten
  assert.ok(zu.fristen[0].rechenweg.some((s) => s.includes("Bundesgerichtshof (Karlsruhe)")));
});

test("Strafurteil: keine ZPO-Berufung, sondern Hinweis auf §§ 314, 341 StPO", () => {
  const a = analysiereRegelbasiert({ text: "In der Strafsache gegen Max Muster wird Ihnen das Urteil vom 09.10.2026 zugestellt. Der Angeklagte wird zu einer Geldstrafe verurteilt.", von: "Amtsgericht Tiergarten", eingang: HEUTE }, data, "BE");
  assert.equal(a.fristen.length, 0);
  assert.ok(a.aktionen.some((x) => /§§ 314, 341 StPO/.test(x)));
});

test("Fünf-Monats-Grenze: späte Zustellung verschiebt den Fristbeginn nach vorn", () => {
  const a = analysiereRegelbasiert({ text: "In dem Rechtsstreit Müller ./. Schmidt wird Ihnen das Urteil vom 02.03.2026 zugestellt. Die Klage wird abgewiesen.", von: "Landgericht Berlin II", eingang: HEUTE }, data, "BE");
  assert.equal(a.fristen[0].ereignisDatum, "2026-08-02");
  assert.equal(a.fristen[0].ende, "2026-09-02");
  assert.match(a.fristen[0].warnungen[0], /fünf Monaten/);
});

test("Frist mit festem Datum („bis zum …“) wird als richterliche Frist übernommen", () => {
  const a = analysiereRegelbasiert({ text: `In dem Rechtsstreit Az. ${NEUMANN.gerichtsAz} wird dem Beklagten aufgegeben, bis zum 20.11.2026 zu dem Schriftsatz vom 02.10.2026 Stellung zu nehmen.`, von: "Landgericht Berlin II", eingang: HEUTE }, data, "BE");
  assert.equal(a.typ, "Gerichtliche Verfügung");
  assert.equal(a.fristen.length, 1);
  assert.equal(a.fristen[0].ende, "2026-11-20");
  assert.equal(a.fristen[0].typ, "frist");
  assert.ok(a.fristen[0].rechenweg.some((s) => s.includes("festes Datum")));
  // Samstag: Datum bleibt (sichere Seite), Hinweis auf § 222 Abs. 2 ZPO
  const sa = analysiereRegelbasiert({ text: "Dem Kläger wird aufgegeben, bis zum 21.11.2026 Unterlagen vorzulegen.", von: "Landgericht Berlin II", eingang: HEUTE }, data, "BE");
  assert.equal(sa.fristen[0].ende, "2026-11-21");
  assert.match(sa.fristen[0].warnungen.join(" "), /§ 222 Abs\. 2 ZPO/);
  // Ohne Handlungsaufforderung ist ein Datum keine Frist
  const miete = analysiereRegelbasiert({ text: "Mein Vermieter hat mir wegen Eigenbedarf gekündigt, ich soll bis zum 31.03.2027 ausziehen.", eingang: HEUTE }, data, "BE");
  assert.equal(miete.fristen.length, 0);
});

test("Termine: Verkündungstermin und Ort mit Dezimalpunkt", () => {
  const v = analysiereRegelbasiert({ text: "Termin zur Verkündung einer Entscheidung: 10.12.2026, 9:00 Uhr, Saal 1.101", von: "Landgericht Berlin II", eingang: HEUTE }, data, "BE");
  assert.deepEqual(v.termin, { datum: "2026-12-10", uhrzeit: "9:00", ort: "Saal 1.101", titel: "Verkündungstermin" });
  const l = analysiereRegelbasiert({ text: "Ladung zum Termin am 12.11.2026 um 9:30 Uhr. Das persönliche Erscheinen wird angeordnet.", von: "Amtsgericht Mitte", eingang: HEUTE }, data, "BE");
  assert.equal(l.termin?.datum, "2026-11-12");
  assert.equal(l.termin?.ort, undefined);
});

test("Beispiel „Richterliche Verfügung“: Wochentag passt zum Datum, Sitzungssaal vollständig", () => {
  const b = beispielDokumente()[1];
  const a = analysiereRegelbasiert({ text: b.text, betreff: b.betreff, von: b.von, eingang: HEUTE }, data, "BE");
  assert.equal(a.termin?.ort, "Sitzungssaal 2.14");
  const d = a.termin!.datum;
  assert.ok(b.text.includes(`${wochentagName(d)}, den ${fmtDate(d)}`), b.text);
  assert.ok(d > addDays(HEUTE, 30));
});

test("Gerichtsort laut Schreiben: Feiertage des Gerichts, nicht des Kanzleisitzes", () => {
  const a = analysiereRegelbasiert({ text: "In dem Rechtsstreit Huber ./. Maier wird Ihnen das Urteil vom 09.07.2028 zugestellt. Die Klage wird abgewiesen.", von: "Landgericht München I", eingang: "2028-07-15" }, data, "BE");
  // 15.08.2028 (Di): Mariä Himmelfahrt gilt nur in Teilen Bayerns – keine Verlängerung, aber Hinweis
  assert.equal(a.fristen[0].ende, "2028-08-15");
  assert.ok(a.fristen[0].rechenweg.some((s) => s.includes("Bayern") && s.includes("Landgericht München I")));
  assert.match(a.fristen[0].warnungen.join(" "), /nur in Teilen von Bayern/);
});

test("Arbeitsuchendmeldung: Dreitagesfrist bei fristloser Kündigung bereits abgelaufen", () => {
  const n = data.nachrichten.find((x) => x.von === "Thomas Weber")!;
  const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: n.eingang }, data, "BE");
  assert.ok(a.aktionen.some((x) => /§ 38 Abs\. 1 S\. 2 SGB III/.test(x) && /abgelaufen/.test(x)), a.aktionen.join(" | "));
});

// ───────────── KI-Inhalte, Demodaten & Rechtszitate ─────────────

test("Demodaten: Mahngericht NRW nach OLG-Bezirk (Hagen für Düsseldorf und Hamm, Euskirchen für Köln)", async () => {
  const { stadtDatenFuer } = await import("../core/seed/pools");
  for (const s of ["Düsseldorf", "Duisburg", "Wuppertal", "Dortmund", "Essen"]) assert.match(stadtDatenFuer(s, "NW", "berlin").gerichte.mahn, /Hagen/, s);
  for (const s of ["Köln", "Bonn", "Aachen"]) assert.match(stadtDatenFuer(s, "NW", "berlin").gerichte.mahn, /Euskirchen/, s);
});

test("Demodaten: Rechnungsnummern fortlaufend nach Datum, Landgericht erst über 10.000 € (§ 23 Nr. 1 GVG)", () => {
  for (const tt of DEMO_TENANTS) {
    const d = generateTenantData({ tenant: tt.tenant, users: tt.users.map(publicUser), profil: tt.profil }, HEUTE);
    const sortiert = [...d.rechnungen].sort((a, b) => a.nummer.localeCompare(b.nummer));
    for (let i = 1; i < sortiert.length; i++) assert.ok(sortiert[i - 1].datum <= sortiert[i].datum, `${sortiert[i - 1].nummer} (${sortiert[i - 1].datum}) vor ${sortiert[i].nummer} (${sortiert[i].datum})`);
    for (const r of d.rechnungen) for (const b of d.buchungen.filter((x) => x.rechnungId === r.id)) assert.ok(b.text.endsWith(r.nummer), b.text);
    for (const a of d.akten) {
      const g = d.kontakte.find((k) => k.id === a.gerichtId)?.name ?? "";
      if (/^Landgericht/.test(g)) assert.ok(a.gegenstandswert > 10000, `${tt.tenant.kurzname} ${a.aktenzeichen}: ${g} bei ${a.gegenstandswert} €`);
    }
  }
});

test("Präsentationsakten: Gerichtsaktenzeichen 118/.. aus dem Jahr der Klage, Kosten des Mahnverfahrens 126/..", () => {
  const a = data.akten.find((x) => x.aktenzeichen === "118/26")!;
  const klage = data.dokumente.find((d) => d.akteId === a.id && d.name === "Klageschrift")!;
  assert.equal(a.gerichtsAz, `28 O 211/${klage.createdAt.slice(2, 4)}`);
  const b = data.akten.find((x) => x.aktenzeichen === "126/26")!;
  assert.deepEqual(data.buchungen.filter((x) => x.akteId === b.id && x.art === "kosten").map((x) => x.betrag), [85.25, 374.5, 177.25]);
  const gv = data.nachrichten.find((n) => /Vermögensauskunft/.test(n.betreff))!;
  assert.match(gv.von, /Gerichtsvollzieher/);
  assert.match(gv.text, /§ 802f Abs\. 6 ZPO/);
  assert.ok(!data.fristen.some((f) => /43a Abs\. 5/.test(f.titel)));
});

test("Fallanalyse offline: Urteil, Vollstreckung, Bußgeld und Berufungssumme passend zu Phase und Sachgebiet", async () => {
  const { analysiereFall } = await import("./fallanalyse");
  const v = { name: "Dr. Julia Hartmann" };
  const neumann = await analysiereFall(data.akten.find((x) => x.aktenzeichen === "118/26")!.id, data, { verfasser: v });
  assert.match(neumann.entwurf.titel, /Mandanteninformation/);
  assert.ok(neumann.rechtsfragen.some((f) => /1\.000 €/.test(f) && /§ 511 Abs\. 2 Nr\. 1 ZPO/.test(f)), neumann.rechtsfragen.join(" | "));
  assert.ok(!/wir zeigen an/i.test(neumann.entwurf.text));
  const berger = await analysiereFall(data.akten.find((x) => x.aktenzeichen === "126/26")!.id, data, { verfasser: v });
  assert.match(berger.erfolgsaussicht.begruendung, /Realisierungsaussicht/);
  assert.ok(!berger.argumenteContra.some((x) => /Beweislast/.test(x)));
  assert.ok(berger.naechsteSchritte.some((s) => /Vermögensverzeichnis/.test(s.titel)));
  const schneider = await analysiereFall(data.akten.find((x) => x.aktenzeichen === "137/26")!.id, data, { verfasser: v });
  assert.ok(schneider.risiken.some((r) => /1\.000 €/.test(r)) && !schneider.risiken.some((r) => /600 €/.test(r)));
  const weber = await analysiereFall(data.akten.find((x) => x.aktenzeichen === "142/26")!.id, data, { verfasser: v });
  assert.match(weber.entwurf.text, /Streitwert \(vorläufig\): 13\.600,00 €/);
  const bussgeld = data.akten.find((x) => /^Bußgeldsache/.test(x.titel) && x.status === "offen");
  assert.ok(bussgeld, "Testdaten enthalten eine Bußgeldsache");
  const r = await analysiereFall(bussgeld!.id, data, { verfasser: v });
  assert.ok(!r.rechtsfragen.some((f) => /Ansprüche/.test(f)) && !r.argumenteContra.some((x) => /Beweislast/.test(x)), JSON.stringify(r.rechtsfragen));
  assert.match(r.entwurf.titel, /Einspruch/);
});

test("Schriftsatz: Replik statt Klageerwiderung bei klagender Mandantin (137/..), Anrede in der Deckungsanfrage", async () => {
  const { artenFuer, entwurfOffline, mandantRolle } = await import("../pages/ki/schriftsatz");
  const a = data.akten.find((x) => x.aktenzeichen === "137/26")!;
  assert.equal(mandantRolle(a, data), "klaeger");
  const arten = artenFuer(a, data).map((x) => x.key);
  assert.ok(arten.includes("replik") && !arten.includes("klageerwiderung"), arten.join(", "));
  const k = { akte: a, data, tenant: t.tenant, user: publicUser(t.users[0]) };
  const replik = entwurfOffline("replik", "sachlich", "", k);
  assert.match(replik, /Katharina Schneider\n– Klagepartei –/);
  assert.match(replik, /Lindenhof Hausverwaltung GmbH\n– Beklagtenpartei –, Prozessbevollmächtigte: Möller & Thiel Rechtsanwälte/);
  assert.ok(!replik.includes("„„"), replik);
  const deckung = entwurfOffline("deckung", "sachlich", "", { ...k, akte: data.akten.find((x) => x.aktenzeichen === "142/26")! });
  assert.match(deckung, /Ihren Versicherungsnehmer, Herrn Thomas Weber,/);
});

test("Assistent (offline): Argumentationshilfe zu einer Entscheidung statt fachfremder Trefferliste", async () => {
  const { frageAssistent } = await import("./assistent");
  const { useData } = await import("../store/data");
  const warn = console.warn;
  console.warn = () => {};
  try {
    useData.setState({ data: structuredClone(data), status: "bereit" });
    const sitzung = { user: publicUser(t.users[0]), tenant: t.tenant, team: t.users.map(publicUser) };
    const frage = "Wie nutze ich BAG, Urt. v. 10.06.2010 – 2 AZR 541/09 („Emmely“ – Bagatellkündigung) in meiner Argumentation für Akte 142/26?";
    const r = await frageAssistent({ verlauf: [{ role: "user", content: frage }], sitzung, nav: () => {}, voice: false });
    assert.match(r.text, /^\*\*So nutzen Sie BAG, Urt\. v\. 10\.06\.2010 – 2 AZR 541\/09/);
    assert.match(r.text, /Abmahnung/);
    assert.match(r.text, /Akte 142\/26/);
    assert.ok(!/VI ZR 53\/09|1 ABR 22\/21/.test(r.text), r.text);
  } finally {
    console.warn = warn;
  }
});

// ───────────── Apex Assistent: Zahlen wie im Cockpit, kritische Fristen, Wiki mit Mindestscore (Texte C, Runde 2) ─────────────

test("Assistent (offline): Zahlenfragen mit Cockpit-Zählweise statt Wiki-Artikel", async () => {
  const { frageAssistent, wikiSuche } = await import("./assistent");
  const { useData } = await import("../store/data");
  const { posteingangZahlen, finanzZahlen, aktenZahlen } = await import("../core/kennzahlen");
  const { fmtEUR, today } = await import("../core/dates");
  const warn = console.warn;
  const err = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    // Daten zum echten Datum, weil der Assistent mit today() rechnet
    const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, today());
    useData.setState({ data: structuredClone(d), status: "bereit" });
    const sitzung = { user: publicUser(t.users[0]), tenant: t.tenant, team: t.users.map(publicUser) };
    const frag = async (content: string) => (await frageAssistent({ verlauf: [{ role: "user", content }], sitzung, nav: () => {}, voice: false })).text;
    const p = posteingangZahlen(d.nachrichten);
    assert.match(await frag("Wie viele neue Nachrichten habe ich?"), new RegExp(`^Sie haben ${p.neu.length} neue Nachrichten`));
    const f = finanzZahlen(d.rechnungen, d.buchungen, d.transaktionen, today());
    assert.ok((await frag("Wie viel Fremdgeld haben wir?")).includes(fmtEUR(f.fremdgeld)));
    const fo = await frag("Wie hoch sind die offenen Forderungen?");
    assert.ok(fo.includes(fmtEUR(f.offen)) && fo.includes(fmtEUR(f.ueberfaellig)), fo);
    assert.match(await frag("Wie viele Stunden haben wir diese Woche gespart?"), /letzten 7 Tagen hat der 38h-Motor [\d,]+ Std\./);
    const a = aktenZahlen(d.akten, d.fristen, today());
    assert.match(await frag("Wie viele Akten haben wir?"), new RegExp(`^Sie haben ${a.offen} offene Akten`));
    assert.match(await frag("Was ist die Apex Island?"), /schwarze Kapsel/);
    assert.match(await frag("Hallo"), /Ich bin der Apex Assistent/);
    // Wiki: Bedienfragen treffen den passenden Artikel, Unsinn bekommt eine ehrliche Rückfrage
    assert.equal(wikiSuche("Wie funktioniert die Apex Island?")[0]?.w.key, "motor");
    assert.equal(wikiSuche("Wie viele neue Nachrichten habe ich?").length, 0);
    assert.match(await frag("Wie kann ich die Quantenflux-Synchronisation einstellen?"), /keine sichere Antwort/);
    // Ansprechpartnerin mit passender Bezeichnung
    assert.match(await frag("Ich brauche meine Ansprechpartnerin"), /^Ihre feste Ansprechpartnerin: Lena Vogt/);
  } finally {
    console.warn = warn;
    console.error = err;
  }
});

test("Assistent (offline): nicht verlängerbare Fristen nach Dringlichkeit, Notfristen ehrlich, Wiedervorlagen getrennt", async () => {
  const { frageAssistent } = await import("./assistent");
  const { useData } = await import("../store/data");
  const { istKritisch, nachDringlichkeit, fristenLage } = await import("../core/fristenLage");
  const { today } = await import("../core/dates");
  const warn = console.warn;
  console.warn = () => {};
  try {
    const heute = today();
    const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, heute);
    useData.setState({ data: structuredClone(d), status: "bereit" });
    const sitzung = { user: publicUser(t.users[0]), tenant: t.tenant, team: t.users.map(publicUser) };
    const frag = async (content: string) => (await frageAssistent({ verlauf: [{ role: "user", content }], sitzung, nav: () => {}, voice: false })).text;
    const kritisch = d.fristen.filter((f) => f.status === "offen" && istKritisch(f)).sort(nachDringlichkeit);
    const r = await frag("Welche nicht verlängerbaren Fristen stehen als Nächstes an?");
    assert.match(r, new RegExp(`^Als Nächstes stehen ${kritisch.length} nicht verlängerbare Fristen an`));
    const pos = kritisch.slice(0, 4).map((f) => r.indexOf(f.titel));
    assert.ok(pos.every((x, i) => x > 0 && (i === 0 || x >= pos[i - 1])), r);
    // Klagefrist (§ 4 KSchG) und Bußgeld-Einspruch sind keine Notfristen im Sinne der ZPO
    if (!kritisch.some((f) => f.typ === "notfrist")) assert.match(await frag("Welche Notfristen stehen an?"), /Notfristen im Sinne der ZPO stehen derzeit keine an/);
    const lage = fristenLage(d.fristen, heute);
    const h = await frag("Welche Fristen sind heute fällig?");
    if (lage.faellig.length > 1) assert.ok(h.startsWith(`Heute sind ${lage.faellig.length} Fristen fällig`), h);
    if (lage.wiedervorlagen.length === 1) assert.match(h, /dazu eine Wiedervorlage/);
  } finally {
    console.warn = warn;
  }
});

test("Posteingang-Analyse: Begründung grammatisch, Zusammenfassung in der dritten Person", () => {
  const n = data.nachrichten.find((x) => x.von === "Thomas Weber")!;
  const a = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: n.eingang }, data, "BE");
  assert.equal(a.akteGrund, "Absenderadresse thomas.weber@posteo.de (Mandant Thomas Weber)");
  assert.ok(!/\b(ich|mein|meine|mir)\b/i.test(a.zusammenfassung), a.zusammenfassung);
  assert.match(a.zusammenfassung, /^Mandant Thomas Weber übersendet Arbeitsvertrag und Lohnabrechnungen/);
  assert.match(a.zusammenfassung, /fragt, ob er wegen der Arbeitsagentur noch etwas machen muss\./);
  const nl = analysiereRegelbasiert({ text: "Liebe Kammermitglieder, in dieser Ausgabe: Neuerungen beim beA.", betreff: "Kammerreport", von: "Rechtsanwaltskammer – Kammerreport", eingang: HEUTE }, data, "BE");
  assert.ok(nl.aktionen.includes("Kein Handlungsbedarf – als erledigt markieren."), nl.aktionen.join(" | "));
});

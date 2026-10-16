import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "../core/seed/tenants";
import { generateTenantData } from "../core/seed/generate";
import { analysiereRegelbasiert } from "./dokumentAnalyse";
import { findePraezedenzfaelle } from "./kontext";
import { fmtDate } from "../core/dates";

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
  const lage = fristenLage(data.fristen, HEUTE);
  const woche = fristenListe(data, "woche", HEUTE);
  assert.equal(woche.anzahl, lage.woche.length);
  assert.ok(woche.anzahl > 12, "Testdaten enthalten mehr als 12 Fristen in der Woche");
  assert.equal(woche.eintraege.length, 12);
  assert.equal(woche.weitere, woche.anzahl - 12);
  const heute = fristenListe(data, "heute", HEUTE);
  assert.equal(heute.anzahl, lage.faellig.length);
  assert.equal(heute.ueberfaellig, lage.ueberfaellig.length);
  assert.equal(heute.vorfristen, lage.vorfristen.length);
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

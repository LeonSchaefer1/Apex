// Iteration 1: Apex Assistent – Notfallwissen beA-Störung, Rückfrage bei mehreren Treffern, Bestätigung vor dem Schreiben, Rückgängig.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "../core/seed/tenants";
import { generateTenantData } from "../core/seed/generate";
import { addDays, today, weekday } from "../core/dates";
import type { Akte, Kontakt } from "../core/types";
import type { LlmMessage } from "./llm";

const t = DEMO_TENANTS[0];
const sitzung = { user: publicUser(t.users[0]), tenant: t.tenant, team: t.users.map(publicUser) };

async function vorbereiten() {
  const { useData } = await import("../store/data");
  const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, today());
  // drei Akten „Müller“ (wie im Usability-Test: 101/26, 12/26, 14/26)
  const k = (id: string, name: string): Kontakt => ({ id, typ: "person", name, rollen: ["mandant"], createdAt: `${today()}T08:00:00` });
  const a = (id: string, az: string, titel: string, mandantId: string): Akte => ({
    ...d.akten[0], id, aktenzeichen: az, titel, mandantId, status: "offen", entscheidungen: [], kiAnalyse: undefined,
  });
  d.kontakte.push(k("k-mue-1", "Johanna Müller"), k("k-mue-2", "Peter Müller"), k("k-mue-3", "Karin Müller"));
  d.akten = d.akten.filter((x) => !/müller/i.test(x.titel) && !["12/26", "14/26", "901/26"].includes(x.aktenzeichen));
  d.akten.push(a("a-mue-1", "901/26", "Johanna Müller ./. Hausverwaltung Kranz", "k-mue-1"), a("a-mue-2", "12/26", "Müller ./. Stadtwerke Nord", "k-mue-2"), a("a-mue-3", "14/26", "Müller ./. Böhm Maschinenbau", "k-mue-3"));
  useData.setState({ data: structuredClone(d), status: "bereit", epoch: useData.getState().epoch + 1 });
  // Ohne Backend (Node): Änderungen nur im Speicher halten – sonst rollt der Store den Schreibvorgang zurück
  useData.setState({
    upsert: (col, doc) => {
      const st = useData.getState();
      const arr = st.data[col] as { id: string }[];
      useData.setState({ data: { ...st.data, [col]: [doc, ...arr.filter((x) => x.id !== (doc as { id: string }).id)] } });
    },
    remove: (col, id) => {
      const st = useData.getState();
      useData.setState({ data: { ...st.data, [col]: (st.data[col] as { id: string }[]).filter((x) => x.id !== id) } });
    },
  });
  return useData;
}

async function frag(verlauf: LlmMessage[]) {
  const { frageAssistent } = await import("./assistent");
  const geoeffnet: string[] = [];
  const r = await frageAssistent({ verlauf, sitzung, nav: (to) => geoeffnet.push(to), voice: false });
  return { ...r, geoeffnet };
}

const still = <T>(fn: () => Promise<T>) => async () => {
  const w = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = w;
  }
};

test("beA-Störung: LAG → § 46g S. 3, 4 ArbGG mit Ersatzeinreichung, Glaubhaftmachung und Dokumentation; Folgefrage OLG → § 130d ZPO", still(async () => {
  await vorbereiten();
  const frage = "Was mache ich, wenn das beA gestört ist und meine Berufungsbegründung zum Landesarbeitsgericht heute raus muss?";
  const r = await frag([{ role: "user", content: frage }]);
  assert.match(r.text, /^\*\*beA-Störung/);
  assert.match(r.text, /§ 46g S\. 3, 4 ArbGG/);
  assert.match(r.text, /Ersatzeinreichung/);
  assert.match(r.text, /Glaubhaftmachung/);
  assert.match(r.text, /Dokumentation|dokumentieren/);
  assert.match(r.text, /Sendebericht/);
  assert.ok(!/Posteingang geprüft|neue Nachrichten/.test(r.text), "keine Posteingangs-Antwort");
  const r2 = await frag([{ role: "user", content: frage }, { role: "assistant", content: r.text }, { role: "user", content: "Und bei einer Berufung zum Oberlandesgericht?" }]);
  assert.match(r2.text, /§ 130d S\. 2, 3 ZPO/);
  assert.match(r2.text, /Ersatzeinreichung/);
  // ohne Gericht: beide Hauptvorschriften
  const r3 = await frag([{ role: "user", content: "Das beA geht nicht – was tun?" }]);
  assert.match(r3.text, /§ 130d S\. 2, 3 ZPO/);
  assert.match(r3.text, /§ 46g S\. 3, 4 ArbGG/);
}));

test("„Öffne die Akte Müller“: Rückfrage mit drei Auswahlknöpfen, keine Akte still geöffnet", still(async () => {
  await vorbereiten();
  const r = await frag([{ role: "user", content: "Öffne die Akte Müller" }]);
  assert.equal(r.geoeffnet.length, 0, "keine Navigation");
  assert.equal(r.auswahl?.length, 3);
  assert.deepEqual(r.auswahl!.map((a) => a.frage).sort(), ["Öffne die Akte 12/26", "Öffne die Akte 14/26", "Öffne die Akte 901/26"]);
  assert.match(r.text, /3 Akten/);
  // Auswahl → genau diese Akte
  const r2 = await frag([{ role: "user", content: "Öffne die Akte 14/26" }]);
  assert.deepEqual(r2.geoeffnet, ["/akten/a-mue-3"]);
  // kein Treffer: klare Meldung mit Vorschlag
  const r3 = await frag([{ role: "user", content: "Öffne die Akte Zylinderhut" }]);
  assert.equal(r3.geoeffnet.length, 0);
  assert.match(r3.text, /nicht gefunden/);
}));

test("Wiedervorlage über den Assistenten: erst Bestätigung, Titel aus dem Auftrag, dann Eintragen und Rückgängig", still(async () => {
  const useData = await vorbereiten();
  const { vorschlagEintragen, vorschlagZuruecknehmen, pruefeDatum } = await import("./assistent");
  const vorher = useData.getState().data.fristen.length;
  const r = await frag([{ role: "user", content: "Lege eine Wiedervorlage für Akte 137 in drei Tagen an: Zeugen Seifert benennen" }]);
  assert.ok(r.vorschlag, "Bestätigungskarte");
  assert.equal(useData.getState().data.fristen.length, vorher, "noch nichts eingetragen");
  assert.equal(r.vorschlag!.titel, "Zeugen Seifert benennen");
  assert.equal(r.vorschlag!.datum, addDays(today(), 3));
  assert.equal(r.vorschlag!.aktenzeichen, "137/26");
  assert.match(r.text, /Bitte bestätigen/);
  // Wochenende → Vorschlag nächster Werktag
  assert.deepEqual(pruefeDatum("2026-10-17", "BE"), { werktag: false, naechster: "2026-10-19" });
  assert.deepEqual(pruefeDatum("2026-10-19", "BE"), { werktag: true });
  const e = vorschlagEintragen(r.vorschlag!, sitzung);
  const f = useData.getState().data.fristen.find((x) => x.id === e.id)!;
  assert.equal(f.titel, "Zeugen Seifert benennen");
  assert.equal(f.quelle, "ki");
  assert.match(f.notiz ?? "", /^Vom Apex Assistenten angelegt/);
  assert.ok(useData.getState().data.aktivitaeten.some((a) => /Zeugen Seifert benennen.*eingetragen/.test(a.text)));
  assert.equal(vorschlagZuruecknehmen(r.vorschlag!, e, sitzung), true);
  assert.ok(!useData.getState().data.fristen.some((x) => x.id === e.id), "wieder entfernt");
  assert.ok(useData.getState().data.aktivitaeten.some((a) => /^Rückgängig: Wiedervorlage „Zeugen Seifert benennen“/.test(a.text)), "protokolliert");
  assert.equal(vorschlagZuruecknehmen(r.vorschlag!, e, sitzung), false, "zweites Rückgängig ohne Wirkung");
}));

test("Wiedervorlage für „Müller“ ohne Aktenzeichen: Rückfrage statt Eintrag", still(async () => {
  const useData = await vorbereiten();
  const vorher = useData.getState().data.fristen.length;
  const r = await frag([{ role: "user", content: "Lege eine Wiedervorlage für Müller in drei Tagen an" }]);
  assert.equal(r.vorschlag, undefined);
  assert.equal(r.auswahl?.length, 3);
  assert.equal(useData.getState().data.fristen.length, vorher);
}));

test("Rückruf: Zusage mit Uhrzeit und Kennzeichnung als Simulation; förmliche Begrüßung", still(async () => {
  await vorbereiten();
  const r = await frag([{ role: "user", content: "Bitte um Rückruf von meiner Ansprechpartnerin" }]);
  assert.match(r.text, /Rückruf (am .+ )?bis spätestens \d{1,2}:\d{2} Uhr/);
  assert.match(r.text, /im Prototyp simuliert – es ruft niemand an/);
  const g = await frag([{ role: "user", content: "Hallo" }]);
  assert.match(g.text, /Frau Dr\. Hartmann/);
  assert.ok(!/Julia/.test(g.text));
}));

// ───────────── Iteration 2 (A-02, A-13) ─────────────

test("Wiedervorlage ohne Auftragstext: Rückfrage „Worum geht es …?“, die Antwort wird zum Titel (I1-T20-03)", still(async () => {
  await vorbereiten();
  const befehl = "Lege eine Wiedervorlage für Akte 137 in drei Tagen an.";
  const r = await frag([{ role: "user", content: befehl }]);
  assert.equal(r.vorschlag, undefined, "kein stiller Titel „Wiedervorlage“");
  assert.match(r.text, /^Worum geht es bei der Wiedervorlage für 137\/26/);
  const r2 = await frag([{ role: "user", content: befehl }, { role: "assistant", content: r.text }, { role: "user", content: "Zeugen Seifert benennen" }]);
  assert.equal(r2.vorschlag?.titel, "Zeugen Seifert benennen");
  assert.equal(r2.vorschlag?.datum, addDays(today(), 3));
  assert.match(r2.vorschlag?.auftrag ?? "", /Lege eine Wiedervorlage für Akte 137/);
  // Auftrag nach einem Komma
  const r3 = await frag([{ role: "user", content: "Lege eine Wiedervorlage für Akte 137 in drei Tagen an, Zeugen Seifert benennen" }]);
  assert.equal(r3.vorschlag?.titel, "Zeugen Seifert benennen");
  // bewusst ohne Titel
  const r4 = await frag([{ role: "user", content: befehl }, { role: "assistant", content: r.text }, { role: "user", content: "ohne Titel" }]);
  assert.equal(r4.vorschlag?.titel, "Wiedervorlage");
}));

test("Rückfrage bei mehreren Akten: Chip „Akten durchsucht“ statt „Bereich geöffnet“ (I2-T20-02); Bankabgleich mit Direktlink (I2-T20-04)", still(async () => {
  await vorbereiten();
  const r = await frag([{ role: "user", content: "Öffne die Akte Müller" }]);
  assert.ok(!r.werkzeuge.includes("Bereich geöffnet"), r.werkzeuge.join(", "));
  const b = await frag([{ role: "user", content: "Wie funktioniert der Bankabgleich?" }]);
  assert.ok(b.links.some((l) => l.to === "/abrechnung?tab=bank" && /Bankabgleich öffnen/.test(l.label)), JSON.stringify(b.links));
}));

test("„Und bei einer Berufung zum Oberlandesgericht?“ ohne Vorfrage → Berufungsfrist § 517 ZPO (I2-T12-02)", still(async () => {
  await vorbereiten();
  const r = await frag([{ role: "user", content: "Und bei einer Berufung zum Oberlandesgericht?" }]);
  assert.match(r.text, /§ 517 ZPO/);
  assert.match(r.text, /§ 520 Abs\. 2 S\. 1 ZPO/);
  assert.ok(!/keine sichere Antwort/.test(r.text));
  assert.ok(r.links.some((l) => l.to.includes("regel=berufung")));
}));

test("Ansprechpartnerin außerhalb der Servicezeit: „nicht erreichbar“, Rückruf frühestens Mo ab 7:30 Uhr, Hinweis auf Ersatzeinreichung (I2-T20-03)", still(async () => {
  const { mock } = await import("node:test");
  await vorbereiten();
  mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 16, 21, 0) });
  try {
    const r = await frag([{ role: "user", content: "Ich brauche meine Ansprechpartnerin – meine Frist läuft heute ab" }]);
    // Durchwahl immer genannt (I3-T20-03), Rückrufregel erklärt die Zusage (I3-T12-04)
    assert.match(r.text, /^Ihre feste Ansprechpartnerin: Lena Vogt \(Durchwahl \+49 30 555 018 42\)\. Lena Vogt ist jetzt nicht erreichbar – Rückruf frühestens Mo, 19\.10\.2026 ab 7:30 Uhr/);
    assert.match(r.text, /in der ersten Stunde nach Beginn zurück \(bis 8:30 Uhr\); in der Servicezeit innerhalb von 30 Minuten/);
    assert.match(r.text, /§ 130d S\. 2, 3 ZPO/);
    assert.match(r.text, /§ 46g S\. 3, 4 ArbGG/);
    assert.ok(r.links.some((l) => l.to === "/hilfe?wiki=bea-stoerung"));
    assert.ok(!/direkt erreichbar/.test(r.text));
  } finally {
    mock.timers.reset();
  }
  // in der Servicezeit: direkt erreichbar
  mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 20, 10, 0) });
  try {
    const r = await frag([{ role: "user", content: "Ich brauche meine Ansprechpartnerin" }]);
    assert.match(r.text, /direkt erreichbar unter der Durchwahl \+49 30 555 018 42/);
  } finally {
    mock.timers.reset();
  }
}));

test("Kanzleikürzel: „wv 137 in 3 tagen zeugenliste prüfen“ → Bestätigungskarte mit Akte, Termin und Titel (I3-T20-01)", still(async () => {
  const useData = await vorbereiten();
  const { kuerzelNormal, kurzbefehlAlsBitte } = await import("./assistent");
  assert.equal(kuerzelNormal("wv 137"), "Wiedervorlage 137");
  assert.equal(kuerzelNormal("Wv. 137"), "Wiedervorlage 137");
  assert.equal(kuerzelNormal("Wiedervorl. 142"), "Wiedervorlage 142");
  assert.equal(kuerzelNormal("Az. 137"), "Akte 137");
  assert.equal(kuerzelNormal("Fr. 142 morgen"), "Frist 142 morgen");
  assert.equal(kuerzelNormal("Termin mit Fr. Weber"), "Termin mit Fr. Weber", "„Fr.“ mitten im Satz bleibt");
  assert.equal(kurzbefehlAlsBitte("wiedervorlagen heute"), undefined, "Abfrage ohne Aktenbezug bleibt eine Abfrage");
  const vorher = useData.getState().data.fristen.length;
  const faelle: [string, string, string, string][] = [
    ["wv 137 in 3 tagen zeugenliste prüfen", "137/26", "Zeugenliste prüfen", addDays(today(), 3)],
    ["WV 142 morgen Deckung nachfassen", "142/26", "Deckung nachfassen", addDays(today(), 1)],
    ["Wv. 137 übermorgen Zeugen laden", "137/26", "Zeugen laden", addDays(today(), 2)],
    ["wiedervorl 142 30.10. Fristverlängerung prüfen", "142/26", "Fristverlängerung prüfen", `${today().slice(0, 4)}-10-30`],
    ["WIEDERVORL. 142 MORGEN ZEUGEN LADEN", "142/26", "Zeugen laden", addDays(today(), 1)],
  ];
  for (const [eingabe, az, titel, datum] of faelle) {
    const r = await frag([{ role: "user", content: eingabe }]);
    assert.ok(r.vorschlag, `Bestätigungskarte für „${eingabe}“`);
    assert.equal(r.vorschlag!.art, "wiedervorlage", eingabe);
    assert.equal(r.vorschlag!.aktenzeichen, az, eingabe);
    assert.equal(r.vorschlag!.titel, titel, eingabe);
    assert.equal(r.vorschlag!.datum, datum, eingabe);
    assert.match(r.text, /Bitte bestätigen/);
    assert.ok(!/im Demo-Modus noch nicht/.test(r.text), eingabe);
  }
  // „nächste Woche“: Montag der nächsten Woche
  const r = await frag([{ role: "user", content: "Wiedervorl. 142 nächste woche Akte prüfen" }]);
  const wd = weekday(today());
  assert.equal(r.vorschlag?.datum, addDays(today(), wd === 0 ? 1 : 8 - wd));
  assert.equal(weekday(r.vorschlag!.datum), 1, "Montag");
  assert.equal(r.vorschlag?.titel, "Akte prüfen");
  assert.equal(useData.getState().data.fristen.length, vorher, "eingetragen wird erst nach „Eintragen“");
  // Ziffern mit mehreren Jahrgängen → Rückfrage mit Karten
  const st = useData.getState();
  const basis = st.data.akten[0];
  useData.setState({ data: { ...st.data, akten: [...st.data.akten, { ...basis, id: "a-555-25", aktenzeichen: "555/25", titel: "Alt ./. Neu", status: "offen" }, { ...basis, id: "a-555-26", aktenzeichen: "555/26", titel: "Neu ./. Alt", status: "offen" }] } });
  const r2 = await frag([{ role: "user", content: "wv 555 morgen Unterlagen anfordern" }]);
  assert.equal(r2.vorschlag, undefined);
  assert.equal(r2.auswahl?.length, 2);
  assert.match(r2.text, /2 Akten/);
}));

test("Kurzformen der Aktensuche: „akte müller“, „müller“, „akte 12“ – dieselbe Mehrdeutigkeitsprüfung wie „Öffne die Akte …“ (I3-T20-02)", still(async () => {
  await vorbereiten();
  for (const eingabe of ["akte müller", "müller", "Akte Müller", "MÜLLER"]) {
    const r = await frag([{ role: "user", content: eingabe }]);
    assert.equal(r.geoeffnet.length, 0, `keine Akte still geöffnet bei „${eingabe}“`);
    assert.equal(r.auswahl?.length, 3, eingabe);
    assert.match(r.text, /3 Akten/, eingabe);
    assert.ok(!/im Demo-Modus noch nicht/.test(r.text), eingabe);
  }
  const r = await frag([{ role: "user", content: "akte 12" }]);
  assert.match(r.text, /12\/26/);
  assert.match(r.text, /Müller \.\/\. Stadtwerke Nord/);
}));

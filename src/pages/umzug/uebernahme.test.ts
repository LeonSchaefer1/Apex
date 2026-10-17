// Umzug: Vorschau (Schritt 3/4) und Übernahme zählen gleich (I2-T11-02); Akten ohne Abschlussdatum werden nicht still
// ausgelassen (I2-T11-04); ein unterbrochener Lauf lässt sich vollständig zurücknehmen (I2-T11-05).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "@/core/seed/tenants";
import { generateTenantData } from "@/core/seed/generate";
import { nowLocal, today, uid } from "@/core/dates";
import type { Aktivitaet, TenantData } from "@/core/types";

const t = DEMO_TENANTS[0];
const user = publicUser(t.users[0]);
const team = t.users.map(publicUser);

async function vorbereiten() {
  const { useData } = await import("@/store/data");
  const d: TenantData = generateTenantData({ tenant: t.tenant, users: team, profil: t.profil }, today());
  useData.setState({ data: structuredClone(d), status: "bereit", epoch: useData.getState().epoch + 1 });
  // Ohne Backend (Node): Änderungen nur im Speicher halten
  useData.setState({
    upsert: (col, doc) => {
      const st = useData.getState();
      const arr = st.data[col] as { id: string }[];
      useData.setState({ data: { ...st.data, [col]: [doc, ...arr.filter((x) => x.id !== (doc as { id: string }).id)] } });
    },
    patch: (col, id, p) => {
      const st = useData.getState();
      useData.setState({ data: { ...st.data, [col]: (st.data[col] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } });
    },
    remove: (col, id) => {
      const st = useData.getState();
      useData.setState({ data: { ...st.data, [col]: (st.data[col] as { id: string }[]).filter((x) => x.id !== id) } });
    },
    log: (a) => {
      const st = useData.getState();
      const eintrag: Aktivitaet = { id: uid("akt"), zeit: nowLocal(), ...a } as Aktivitaet;
      useData.setState({ data: { ...st.data, aktivitaeten: [eintrag, ...st.data.aktivitaeten] } });
    },
  });
  const { beispielExport } = await import("./beispiel");
  const { parseCsv } = await import("./csv");
  const { autoZuordnung, baueZeilen } = await import("./zuordnung");
  const data = useData.getState().data;
  const b = beispielExport("ramicro", data.akten, data.kontakte, today());
  const csv = parseCsv(b.text);
  const zeilen = baueZeilen(csv, autoZuordnung(csv.kopf), data.akten, t.tenant.bundesland);
  return { useData, zeilen };
}

test("Beispiel-Export: Dublette in der Datei und abgeschlossene Akte ohne Abschlussdatum", async () => {
  const { zeilen } = await vorbereiten();
  const { ohneAbschlussdatum } = await import("./zuordnung");
  assert.ok(zeilen.some((z) => z.dateiDublette?.gleicheFrist), "Dublette in der Datei mit gleicher Frist");
  assert.equal(zeilen.filter((z) => ohneAbschlussdatum(z, "sechsJahre")).length, 1, "eine Akte ohne Abschlussdatum");
  assert.ok(zeilen.some((z) => z.status === "abgeschlossen" && z.abgeschlossenAm), "abgeschlossene Akte mit Datum");
  assert.ok(zeilen.some((z) => z.gegenstandswert === 2180.5), "Gegenstandswert mit Cent");
});

test("Vorschau und Übernahme zählen gleich – Entscheidung „übernehmen“ legt die Akte ruhend an", async () => {
  const { useData, zeilen } = await vorbereiten();
  const { umzugPlan, fuehreUmzugAus, macheRueckgaengig } = await import("./uebernahme");
  const { ohneAbschlussdatum } = await import("./zuordnung");
  const ohne = zeilen.find((z) => ohneAbschlussdatum(z, "sechsJahre"))!;
  const regeln = { aktionFuer: () => "skip" as const, dateiAktionFuer: () => "merge" as const, umfang: "sechsJahre" as const, heute: today() };

  // ohne Entscheidung: vorgelegt, nicht „außerhalb des Umfangs“ und nicht still ausgelassen
  const offen = umzugPlan(zeilen, { ...regeln, kontakte: useData.getState().data.kontakte, bestand: useData.getState().data.fristen });
  assert.equal(offen.ohneDatumOffen, 1);
  assert.equal(offen.ohneDatum[0].nr, ohne.nr);

  const entscheidung = { ohneDatumAktionFuer: (z: { nr: number }) => (z.nr === ohne.nr ? ("uebernehmen" as const) : undefined) };
  const plan = umzugPlan(zeilen, { ...regeln, ...entscheidung, kontakte: useData.getState().data.kontakte, bestand: useData.getState().data.fristen });
  assert.equal(plan.ohneDatumOffen, 0);
  assert.equal(plan.ruhendPruefung, 1);
  assert.equal(plan.zusammengefuehrt, 1);

  const vorher = useData.getState().data;
  const laufId = uid("uz");
  const zwischen: number[] = [];
  const e = await fuehreUmzugAus({
    zeilen, ...regeln, ...entscheidung, laufId, system: "RA-MICRO", user, team, bundesland: t.tenant.bundesland,
    onFortschritt: () => {}, onZwischenstand: (x) => zwischen.push(x.undo.erstellt.length),
  });
  assert.equal(e.aktenNeu, plan.akten, "neue Akten");
  assert.equal(e.aktenAktualisiert, plan.aktualisieren, "aktualisierte Akten");
  assert.equal(e.archiviert, plan.archiv, "abgeschlossen (Archiv)");
  assert.equal(e.fristenKontrolle, plan.fristen, "Fristen zur Kontrolle");
  assert.equal(e.fristen - e.fristenKontrolle, plan.wiedervorlagen, "Wiedervorlagen/Termine");
  assert.equal(e.kontakteNeu, plan.kontakte - plan.kontakteVorhanden, "neue Kontakte");
  assert.equal(e.kontakteZusammengefuehrt, plan.kontakteVorhanden, "zusammengeführte Kontakte");
  assert.equal(e.zusammengefuehrt, plan.zusammengefuehrt);
  assert.equal(e.ausserhalbUmfang, plan.ausserhalb);
  assert.ok(zwischen.length >= 3, "Zwischenstand nach Kontakten, Akten und Fristen gesichert");

  const ruhend = useData.getState().data.akten.find((a) => a.umzugLaufId === laufId && a.titel === ohne.titel);
  assert.equal(ruhend?.status, "ruhend", "ohne Abschlussdatum + übernehmen → ruhend zur Prüfung");

  // Abbruch-Rücknahme allein über die Laufkennung (ohne gespeicherte Rückgängig-Daten): nichts bleibt zurück
  macheRueckgaengig({ erstellt: [], vorher: [] }, "RA-MICRO", user.id, laufId);
  const nachher = useData.getState().data;
  assert.equal(nachher.akten.length, vorher.akten.length);
  assert.equal(nachher.kontakte.length, vorher.kontakte.length);
  assert.equal(nachher.fristen.length, vorher.fristen.length);
  assert.equal(nachher.dokumente.length, vorher.dokumente.length);
});

test("Abgebrochener Lauf: eigenes Feld „abgebrochen“, ältere Protokolle mit Sonderwert bleiben erkennbar", async () => {
  const { useData } = await vorbereiten();
  const { protokolliereAbbruch, istAbgebrochen, ABBRUCH } = await import("./laeufe");
  const am = nowLocal();
  // Noch kein Zwischenstand gesichert → leerer Lauf im Protokoll
  protokolliereAbbruch({ laufId: "uz-abbruch-1", datum: am, system: "RA-MICRO", datei: "export.csv", userId: user.id }, am);
  const neu = useData.getState().data.umzugLaeufe.find((l) => l.id === "uz-abbruch-1")!;
  assert.equal(neu.abgebrochen, true);
  assert.equal(neu.rueckgaengig?.von, user.id, "„von“ ist eine Person, kein Sonderwert");
  assert.ok(istAbgebrochen(neu));
  // Zwischenstand vorhanden → derselbe Lauf wird als abgebrochen markiert
  useData.getState().upsert("umzugLaeufe", { ...neu, id: "uz-abbruch-2", abgebrochen: undefined, rueckgaengig: undefined });
  protokolliereAbbruch({ laufId: "uz-abbruch-2", datum: am, system: "RA-MICRO", datei: "export.csv", userId: user.id }, am);
  assert.ok(istAbgebrochen(useData.getState().data.umzugLaeufe.find((l) => l.id === "uz-abbruch-2")!));
  // Altbestand aus Iteration 2: Kennzeichen im Feld rueckgaengig.von
  assert.ok(istAbgebrochen({ ...neu, abgebrochen: undefined, rueckgaengig: { am, von: ABBRUCH } }));
  assert.ok(!istAbgebrochen({ ...neu, abgebrochen: undefined, rueckgaengig: { am, von: user.id } }), "normales Rückgängig ist kein Abbruch");
});

test("Archivakte ohne Abschlussdatum: abschlussdatumUnbekannt, abgeschlossenAm = Übernahmetag (§ 50 BRAO vorsorglich)", async () => {
  const { useData, zeilen } = await vorbereiten();
  const { fuehreUmzugAus } = await import("./uebernahme");
  const { ohneAbschlussdatum } = await import("./zuordnung");
  const { abschlussText } = await import("@/pages/akten/helfer");
  const ohne = zeilen.find((z) => ohneAbschlussdatum(z, "sechsJahre"))!;
  const mitDatum = zeilen.find((z) => z.status === "abgeschlossen" && z.abgeschlossenAm)!;
  const laufId = uid("uz");
  await fuehreUmzugAus({
    zeilen,
    aktionFuer: () => "skip",
    dateiAktionFuer: () => "merge",
    umfang: "sechsJahre",
    ohneDatumAktionFuer: (z) => (z.nr === ohne.nr ? "archiv" : undefined),
    laufId,
    system: "RA-MICRO",
    user,
    team,
    bundesland: t.tenant.bundesland,
    onFortschritt: () => {},
    onZwischenstand: () => {},
  });
  const akten = useData.getState().data.akten.filter((a) => a.umzugLaufId === laufId);
  const archiv = akten.find((a) => a.titel === ohne.titel)!;
  assert.equal(archiv.status, "abgeschlossen");
  assert.equal(archiv.abschlussdatumUnbekannt, true);
  assert.equal(archiv.abgeschlossenAm, today(), "Aufbewahrung vorsorglich ab Übernahme");
  const [j, m, d] = today().split("-");
  assert.equal(abschlussText(archiv), `Abgeschlossen (Datum im Altsystem unbekannt) · übernommen am ${d}.${m}.${j}`);
  // Archivakten mit Abschlussdatum aus dem Altsystem: Datum übernommen, keine Kennzeichnung
  for (const a of akten.filter((x) => x.status === "abgeschlossen" && x.id !== archiv.id)) {
    assert.equal(a.abschlussdatumUnbekannt, undefined, a.titel);
    assert.notEqual(a.abgeschlossenAm, undefined);
  }
  assert.ok(mitDatum.abgeschlossenAm);
});

test("Zählung der Fristen: Fristen, Wiedervorlagen und Termine getrennt und ohne doppeltes „und“ (I4-T11-02)", async () => {
  const { fristenZaehlung, weitereText } = await import("./uebernahme");
  assert.equal(fristenZaehlung({ fristen: 2, wiedervorlagen: 1, termine: 0 }), "2 Fristen und 1 Wiedervorlage");
  assert.equal(fristenZaehlung({ fristen: 9, wiedervorlagen: 2, termine: 1 }), "9 Fristen, 2 Wiedervorlagen und 1 Termin");
  assert.equal(fristenZaehlung({ fristen: 1, wiedervorlagen: 0, termine: 0 }), "1 Frist");
  assert.equal(fristenZaehlung({ fristen: 0, wiedervorlagen: 0, termine: 0 }), "keine Fristen");
  assert.equal(weitereText({ wiedervorlagen: 2, termine: 1 }), "2 Wiedervorlagen und 1 Termin");
});

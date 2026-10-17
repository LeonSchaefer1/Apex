// Überweisungsnachweis einer Zahlungsfrist (I3-T15-01): nur Ausgänge, zuerst die der Akte, fremde nur mit Begründung.
// Fristkorrektur behält den Gerichtsort (I3-T03-02) und ist an das eEB-Zustellungsdatum gebunden (I5-T03-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Aktivitaet, Buchung, Frist, Nachricht, Transaktion } from "@/core/types";
import { feiertagsortFuerFrist, regel } from "@/core/fristen";
import { nowLocal, uid } from "@/core/dates";
import { eebAbweichungDerFrist, eebZurFrist, fremdHinweis, geschwisterFristen, gerichtsortAusRechenweg, korrekturNeuBerechnet, korrigiereMitGeschwistern, nachweisUmsaetze, pruefeKorrekturDatum } from "./logik";

const akten = [
  { id: "a131", aktenzeichen: "131/26" },
  { id: "a137", aktenzeichen: "137/26" },
];
const frist = { akteId: "a131", titel: "Fremdgeld an Mandantin weiterleiten (§ 43a Abs. 7 BRAO)" };
const t = (id: string, betrag: number, akteId?: string, status: Transaktion["status"] = "zugeordnet"): Transaktion => ({
  id,
  datum: "2026-10-16",
  betrag,
  gegenpartei: id === "gs" ? "Katharina Schneider" : "Empfänger",
  iban: "DE00",
  verwendungszweck: "AZ",
  status,
  ...(akteId ? { zuordnung: { akteId, sicherheit: 1, durch: "manuell" as const, grund: "" } } : {}),
});
const eingangFremdgeld: Buchung = { id: "b-ein", akteId: "a131", datum: "2026-10-13", art: "fremdgeld", betrag: 6120, text: "Zahlung Elbtal Versicherung (Fremdgeld)", fremdgeld: true };
const weiterleitung: Buchung = {
  id: "b-wl",
  akteId: "a131",
  datum: "2026-10-17",
  art: "fremdgeld",
  betrag: -6120,
  text: "Weiterleitung Fremdgeld an Elif Yilmaz (SEPA-Überweisung zur Freigabe)",
  fremdgeld: true,
  weiterleitung: { empfaenger: "Elif Yilmaz", iban: "DE89", verwendungszweck: "131/26", wirkung: "sepa-datei", am: "2026-10-17T09:00:00", von: "u" },
};

test("Gutschrift (Eingang) einer fremden Akte wird nie angeboten – auch nicht unter „Anderen Umsatz“", () => {
  const q = nachweisUmsaetze(frist, [t("gs", 388.12, "a137"), t("ein131", 6120, "a131")], [eingangFremdgeld], akten);
  assert.equal(q.passend.length, 0, "kein passender Ausgang → Erledigt gesperrt");
  assert.equal(q.fremd.length, 0);
  assert.ok(![...q.passend, ...q.fremd].some((x) => x.betrag >= 0));
  assert.equal(q.erwartet, 6120);
});

test("Weiterleitung der Akte zuerst, dann Ausgänge der Akte; Ausgang fremder Akte nur unter „fremd“ mit Warnung", () => {
  const umsaetze = [t("aus137", -388.12, "a137"), t("aus131", -6100, "a131"), t("ohne", -50, undefined, "offen"), t("ign", -10, "a131", "ignoriert")];
  const q = nachweisUmsaetze(frist, umsaetze, [eingangFremdgeld, weiterleitung], akten);
  assert.deepEqual(q.passend.map((x) => x.id), ["b:b-wl", "t:aus131"]);
  assert.equal(q.passend[0].label.replace(/\s/g, " "), "Weiterleitung vom 17.10.2026 · 6.120,00 € an Elif Yilmaz (SEPA-Datei)");
  assert.deepEqual(q.fremd.map((x) => x.id), ["t:aus137", "t:ohne"]);
  assert.equal(fremdHinweis(q.fremd[0], "131/26"), "Umsatz gehört zu 137/26 – nicht zu 131/26");
  assert.equal(fremdHinweis(q.fremd[1], "131/26"), "Umsatz ist keiner Akte zugeordnet – nicht 131/26");
});

test("Stornierte Weiterleitung ist kein Nachweis; Betrag aus dem Titel geht vor", () => {
  const storno: Buchung = { id: "b-st", akteId: "a131", datum: "2026-10-17", art: "fremdgeld", betrag: 6120, text: `Storno: ${weiterleitung.text}`, fremdgeld: true };
  const q = nachweisUmsaetze(frist, [], [eingangFremdgeld, weiterleitung, storno], akten);
  assert.equal(q.passend.length, 0);
  const mitBetrag = nachweisUmsaetze({ akteId: "a131", titel: "Zahlung an Gutachter 1.250,00 € überweisen" }, [], [eingangFremdgeld], akten);
  assert.equal(mitBetrag.erwartet, 1250);
});

// ───────────── Fristkorrektur behält den Gerichtsort (I3-T03-02) ─────────────

const ortFuer = (f: Parameters<typeof feiertagsortFuerFrist>[0], kanzlei: "NW" | "BE") => {
  const o = feiertagsortFuerFrist(f, undefined, [], kanzlei);
  const gericht = o.feiertagsOrt?.replace(/ – laut Akte$/, "");
  return { land: o.land, feiertagsOrt: o.feiertagsOrt, gerichtsort: { land: o.land, ...(gericht ? { gericht } : {}), quelle: o.quelle } };
};

test("Korrektur einer Frist mit Gerichtsort Hessen bei Kanzlei in NRW rechnet mit Hessen (Allerheiligen verlängert nicht)", () => {
  const f = { regelKey: "berufung", gerichtsort: { land: "HE" as const, gericht: "Hessisches LAG", quelle: "gericht" as const } };
  const k = korrekturNeuBerechnet(f, "berufung", "2027-10-01", ortFuer(f, "NW"), "NW");
  assert.equal(k.datum, "2027-11-01", "Mo 01.11.2027 – in Hessen kein Feiertag");
  assert.ok(k.rechenweg!.some((z) => z === "Feiertage am Gerichtsort geprüft: Hessen (Hessisches LAG)"), k.rechenweg!.join("\n"));
  assert.deepEqual(k.gerichtsort, { land: "HE", gericht: "Hessisches LAG", quelle: "gericht" });
  // Gegenprobe: ohne gespeicherten Ort (Kanzleisitz NRW) verschiebt Allerheiligen auf Di 02.11.2027
  const ohne = korrekturNeuBerechnet({ regelKey: "berufung" }, "berufung", "2027-10-01", ortFuer({}, "NW"), "NW");
  assert.equal(ohne.datum, "2027-11-02");
});

test("Berufungsfrist 118/26 aus dem Posteingang: Gerichtsort Kammergericht gespeichert, Korrektur nennt ihn – 17.11.2026", async () => {
  const { generateTenantData } = await import("@/core/seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("@/core/seed/tenants");
  const { analysiereRegelbasiert } = await import("@/ai/dokumentAnalyse");
  const t = DEMO_TENANTS.find((x) => x.tenant.id === "t-hartmann")!;
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-17");
  // Urteil des LG Berlin II in 28 O 211/26 (Akte 118/26 Neumann ./. Arslan Autohaus GmbH)
  const n = data.nachrichten.find((x) => /zustellung urteil/i.test(x.betreff) && /28 O 211\/26/.test(x.betreff))!;
  assert.ok(n, "Urteil 118/26 im Posteingang");
  const rb = analysiereRegelbasiert({ text: n.text, betreff: n.betreff, von: n.von, vonAdresse: n.vonAdresse, eingang: "2026-10-17T09:00:00", kanal: n.kanal }, data, t.tenant.bundesland);
  const berufung = rb.fristen.find((p) => p.regelKey === "berufung")!;
  const go = gerichtsortAusRechenweg(berufung.rechenweg);
  assert.deepEqual(go, { land: "BE", gericht: "Kammergericht, Berufungsgericht", quelle: "gericht" });
  const f = { regelKey: "berufung", gerichtsort: go };
  const k = korrekturNeuBerechnet(f, "berufung", "2026-10-17", ortFuer(f, "BE"), "BE");
  assert.equal(k.datum, "2026-11-17");
  assert.ok(k.rechenweg!.includes("Feiertage am Gerichtsort geprüft: Berlin (Kammergericht, Berufungsgericht)"), k.rechenweg!.join("\n"));
});

test("Gerichtsort aus dem Rechenweg: laut Akte, von Hand, Kanzleisitz", () => {
  assert.deepEqual(gerichtsortAusRechenweg(["Feiertage am Gerichtsort geprüft: Berlin (Landgericht Berlin II – laut Akte)"]), { land: "BE", gericht: "Landgericht Berlin II – laut Akte", quelle: "akte" });
  assert.deepEqual(gerichtsortAusRechenweg(["Feiertage am Gerichtsort geprüft: Bayern (von Hand gewählt)"]), { land: "BY", quelle: "hand" });
  assert.deepEqual(gerichtsortAusRechenweg(["Gerichtsort noch offen – geprüft mit den Feiertagen am Kanzleisitz (Nordrhein-Westfalen)"]), { land: "NW", quelle: "kanzleisitz" });
  assert.equal(gerichtsortAusRechenweg(["Beginn"]), undefined);
});

// ───────────── Fristkorrektur am eEB-Zustellungsdatum (I5-T03-01) ─────────────

const berufung = regel("berufung")!;
const entfristung = regel("entfristungsklage")!;

test("Korrektur: Zustellung in der Zukunft gesperrt – Befristungsende in der Zukunft nicht", () => {
  const z = pruefeKorrekturDatum({ ereignis: "2026-10-19", heute: "2026-10-17", regel: berufung });
  assert.equal(z.sperre, "Zustellungsdatum kann nicht in der Zukunft liegen.");
  const b = pruefeKorrekturDatum({ ereignis: "2026-12-31", heute: "2026-10-17", regel: entfristung });
  assert.equal(b.sperre, undefined);
  assert.equal(b.abweichung, undefined);
  // vor dem Eingangstag der Nachricht (Zustellung gegen eEB) ebenfalls gesperrt
  const vor = pruefeKorrekturDatum({ ereignis: "2026-10-15", heute: "2026-10-17", eingang: "2026-10-16", regel: berufung });
  assert.match(vor.sperre ?? "", /^Zustellungsdatum frühestens am Eingangstag 16\.10\.2026/);
});

test("Korrektur: Ereignis 2 Tage nach dem eEB → Abweichung „später“ mit Fristenden; früher nur Hinweis; ohne eEB nichts", () => {
  const ort = { land: "BE" as const, gerichtsort: { land: "BE" as const, quelle: "kanzleisitz" as const } };
  const endeEeb = korrekturNeuBerechnet({ regelKey: "berufung" }, "berufung", "2026-10-17", ort, "BE").datum;
  const endeNeu = korrekturNeuBerechnet({ regelKey: "berufung" }, "berufung", "2026-10-19", ort, "BE").datum;
  assert.equal(endeEeb, "2026-11-17", "Prüfwert Di 17.11.2026 bleibt");
  const s = pruefeKorrekturDatum({ ereignis: "2026-10-19", heute: "2026-10-20", eingang: "2026-10-16", eebDatum: "2026-10-17", regel: berufung, endeNeu, endeEeb });
  assert.equal(s.sperre, undefined);
  assert.equal(s.abweichung?.spaeter, true);
  assert.equal(s.abweichung?.tage, 2);
  assert.equal(s.abweichung?.text.replace(/\u00a0/g, " "), "Die Frist endet dann 2 Tage nach dem Fristende laut eEB (Di, 17.11.2026 → Do, 19.11.2026). Eine Notfrist kann nicht verlängert werden (§ 224 Abs. 2 ZPO).");
  const f = pruefeKorrekturDatum({ ereignis: "2026-10-16", heute: "2026-10-17", eingang: "2026-10-16", eebDatum: "2026-10-17", regel: berufung });
  assert.equal(f.sperre, undefined);
  assert.equal(f.abweichung?.spaeter, false, "früher – Hinweis ohne Pflichtbestätigung");
  assert.equal(f.abweichung?.tage, 1);
  const ohne = pruefeKorrekturDatum({ ereignis: "2026-10-16", heute: "2026-10-17", regel: berufung });
  assert.deepEqual(ohne, {});
});

function speicherOhneBackend(useData: typeof import("@/store/data").useData) {
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
}

test("eEB zur Frist über den Vermerk; Geschwisterfrist (Begründung) wird gefunden und mitkorrigiert; Chip „weicht vom eEB ab“", async () => {
  const { useData } = await import("@/store/data");
  const { generateTenantData } = await import("@/core/seed/generate");
  const { DEMO_TENANTS, publicUser } = await import("@/core/seed/tenants");
  const t = DEMO_TENANTS.find((x) => x.tenant.id === "t-hartmann")!;
  const data = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-17");
  const akte = data.akten.find((a) => a.aktenzeichen === "118/26")!;
  const betreff = "Zustellung Urteil – 28 O 211/26";
  const n: Nachricht = { id: "n-urteil", kanal: "bea", richtung: "ein", von: "LG Berlin II", an: "Kanzlei", betreff, text: "", eingang: "2026-10-16T09:00:00", akteId: akte.id, anhaenge: [], status: "gelesen", zugeordnet: true, eebErforderlich: true, eebAbgegeben: "2026-10-17T09:12:00", eebAbgegebenVon: "u-hartmann", eebZustellungsdatum: "2026-10-17" };
  const andere: Nachricht = { ...n, id: "n-andere", betreff: "Anderes Schreiben", eebZustellungsdatum: "2026-10-12" };
  const notiz = `Von der KI aus beA-Nachricht „${betreff}“ erkannt.`;
  const basis = { akteId: akte.id, status: "offen" as const, verantwortlichId: akte.bearbeiterId, quelle: "ki" as const, notiz, ereignisDatum: "2026-10-17", createdAt: "2026-10-17T09:00:00" };
  const fb: Frist = { ...basis, id: "f-ber", titel: "Berufungsfrist", typ: "notfrist", datum: "2026-11-17", regelKey: "berufung", grundlage: "§ 517 ZPO" };
  const fbg: Frist = { ...basis, id: "f-begr", titel: "Berufungsbegründungsfrist", typ: "frist", datum: "2026-12-17", regelKey: "berufungsbegruendung", grundlage: "§ 520 Abs. 2 S. 1 ZPO" };
  const fremd: Frist = { ...basis, id: "f-fremd", titel: "Stellungnahme", typ: "frist", datum: "2026-11-02", notiz: "Von Hand eingetragen." };
  assert.equal(eebZurFrist(fb, [andere, n])?.id, "n-urteil", "über den Vermerk");
  assert.equal(eebZurFrist({ ...fb, notiz: undefined, ereignisDatum: "2026-10-12" }, [andere, n])?.id, "n-andere", "Rückfall: eEB-Datum = Ereignisdatum");
  assert.equal(eebZurFrist({ ...fb, typ: "wiedervorlage" }, [n]), undefined);
  assert.deepEqual(geschwisterFristen(fb, [fb, fbg, fremd], [n]).map((x) => x.id), ["f-begr"]);

  useData.setState({ data: structuredClone({ ...data, nachrichten: [n, ...data.nachrichten], fristen: [fb, fbg, fremd, ...data.fristen] }), status: "bereit", epoch: useData.getState().epoch + 1 });
  speicherOhneBackend(useData);
  const ort = { land: "BE" as const, gerichtsort: { land: "BE" as const, gericht: "Kammergericht, Berufungsgericht", quelle: "gericht" as const } };
  const neu = korrekturNeuBerechnet(fb, "berufung", "2026-10-19", ort, "BE");
  const neuBegr = korrekturNeuBerechnet(fbg, "berufungsbegruendung", "2026-10-19", ort, "BE");
  assert.equal(neu.datum, "2026-11-19");
  assert.equal(neuBegr.datum, "2026-12-21", "Sa 19.12. → Mo 21.12.2026");
  const anzahl = korrigiereMitGeschwistern(fb, "u-hartmann", neu, "Zustellung laut Empfangsprotokoll am 19.10.", [{ f: fbg, neu: neuBegr }], { eebDatum: "2026-10-17", eebAbweichungBestaetigt: true });
  assert.equal(anzahl, 2);
  const st = useData.getState().data;
  const b1 = st.fristen.find((x) => x.id === "f-ber")!;
  const b2 = st.fristen.find((x) => x.id === "f-begr")!;
  assert.equal(b1.datum, "2026-11-19");
  assert.equal(b2.datum, "2026-12-21");
  assert.equal(b2.ereignisDatum, "2026-10-19");
  assert.equal(b1.kontrolliertVon, undefined);
  assert.equal(b2.korrekturen?.[0].grund, "Zustellung laut Empfangsprotokoll am 19.10.");
  assert.equal(st.fristen.find((x) => x.id === "f-fremd")!.datum, "2026-11-02", "fremde Frist unverändert");
  const logs = st.aktivitaeten.filter((a) => a.text.includes("Zustellungsdatum laut eEB 17.10.2026"));
  assert.equal(logs.length, 2, "ein Verlaufseintrag je Frist, mit eEB-Datum");
  // Chip: Ereignis ≠ eEB-Datum, auch nach der Korrektur über den Vermerk erkannt
  const abw = eebAbweichungDerFrist(b1, st.nachrichten);
  assert.deepEqual(abw && { eeb: abw.eebDatum, ereignis: abw.ereignis, spaeter: abw.spaeter }, { eeb: "2026-10-17", ereignis: "2026-10-19", spaeter: true });
  // Korrektur zurück auf das eEB-Datum: Prüfwerte Di 17.11.2026 und Do 17.12.2026, kein Chip
  const zurueck = korrekturNeuBerechnet(b1, "berufung", "2026-10-17", ort, "BE");
  const zurueckBegr = korrekturNeuBerechnet(b2, "berufungsbegruendung", "2026-10-17", ort, "BE");
  assert.equal(zurueck.datum, "2026-11-17");
  assert.equal(zurueckBegr.datum, "2026-12-17");
  assert.equal(eebAbweichungDerFrist({ ...b1, ereignisDatum: "2026-10-17" }, st.nachrichten), undefined);
});

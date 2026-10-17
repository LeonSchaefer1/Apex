// Posteingang: Zuordnung hin und zurück (I2-T02-01, § 43a Abs. 2 BRAO, § 203 StGB) – nach der Rücknahme bleibt in der
// fremden Akte kein Dokument und keine Frist der Nachricht; beide Verläufe halten den Wechsel fest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_TENANTS, publicUser } from "@/core/seed/tenants";
import { generateTenantData } from "@/core/seed/generate";
import { nowLocal, today, uid } from "@/core/dates";
import type { Aktivitaet, TenantData } from "@/core/types";

const t = DEMO_TENANTS[0];
const user = publicUser(t.users[0]);

async function vorbereiten() {
  const { useData } = await import("@/store/data");
  const d: TenantData = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, today());
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
  const data = useData.getState().data;
  const urteil = data.nachrichten.find((n) => /28 O 211/.test(n.betreff))!;
  const neumann = data.akten.find((a) => a.aktenzeichen === "118/26")!;
  const albrecht = data.akten.find((a) => a.aktenzeichen === "150/26")!;
  assert.ok(urteil && neumann && albrecht, "Demodaten: Urteil 28 O 211, Akten 118/26 und 150/26");
  const { analysiereRegelbasiert } = await import("@/ai/dokumentAnalyse");
  const { kiAnsicht } = await import("./analyse");
  const frisch = { ...analysiereRegelbasiert({ text: urteil.text, betreff: urteil.betreff, von: urteil.von, vonAdresse: urteil.vonAdresse, eingang: urteil.eingang, kanal: urteil.kanal }, data, "BE"), quelle: "demo" as const, dauerMs: 0 };
  const ansicht = kiAnsicht(urteil, data, "BE", frisch)!;
  assert.ok(ansicht.fristen.length >= 2, "Berufung und Begründung erkannt");
  return { useData, urteil, neumann, albrecht, ansicht };
}

test("Zuordnung hin und zurück: 150/26 behält kein Dokument, keine Frist und keine Portalfreigabe", async () => {
  const { useData, urteil, neumann, albrecht, ansicht } = await vorbereiten();
  const { zuordnen, fristenUebernehmen, dokumenteAusNachricht, fristenAusNachricht } = await import("./analyse");

  // hin: Urteil versehentlich 150/26 zugeordnet, Fristen dort notiert, ein Anhang im Portal freigegeben
  zuordnen(urteil, albrecht, user, ansicht);
  let st = useData.getState().data;
  const doks = dokumenteAusNachricht(urteil, st.dokumente);
  assert.ok(doks.length >= 2, "Nachricht und Anhang abgelegt");
  assert.ok(doks.every((d) => d.akteId === albrecht.id));
  fristenUebernehmen(st.nachrichten.find((n) => n.id === urteil.id)!, albrecht, user, ansicht, st.fristen);
  const anhang = doks.find((d) => d.id.includes("-anhang-"))!;
  useData.getState().patch("dokumente", anhang.id, { portal: { am: nowLocal(), vonId: user.id } });
  st = useData.getState().data;
  const fristenHin = fristenAusNachricht(urteil, albrecht.id, st.fristen);
  assert.equal(fristenHin.haupt.length, ansicht.fristen.length);

  // zurück: 118/26, Fristen ziehen mit um (empfohlen)
  const r = zuordnen(st.nachrichten.find((n) => n.id === urteil.id)!, neumann, user, ansicht, { fristen: "mitnehmen" });
  st = useData.getState().data;
  assert.equal(st.nachrichten.find((n) => n.id === urteil.id)!.akteId, neumann.id);
  assert.deepEqual(dokumenteAusNachricht(urteil, st.dokumente).filter((d) => d.akteId === albrecht.id), [], "kein Dokument der Nachricht mehr in 150/26");
  assert.ok(dokumenteAusNachricht(urteil, st.dokumente).every((d) => d.akteId === neumann.id && !d.portal), "alle in 118/26, ohne Portalfreigabe");
  assert.equal(fristenAusNachricht(urteil, albrecht.id, st.fristen).alle.length, 0, "keine Frist der Nachricht mehr in 150/26");
  assert.equal(fristenAusNachricht(urteil, neumann.id, st.fristen).alle.length, fristenHin.alle.length, "Fristen samt Vorfristen in 118/26");
  assert.equal(r.vorher?.akte?.id, albrecht.id);
  // Verlauf beider Akten
  assert.ok(st.aktivitaeten.some((a) => a.akteId === albrecht.id && /^Zuordnung von „.*“ zurückgenommen – \d+ Dokumente? nach 118\/26 verschoben/.test(a.text)), "Rücknahme im Verlauf 150/26");
  assert.ok(st.aktivitaeten.some((a) => a.akteId === neumann.id && /der Akte 118\/26 zugeordnet.*vorher 150\/26/.test(a.text)), "Zuordnung im Verlauf 118/26");
});

test("Umhängen mit „in 150/26 lassen“: Dokumente ziehen um, Fristen bleiben – protokolliert", async () => {
  const { useData, urteil, neumann, albrecht, ansicht } = await vorbereiten();
  const { zuordnen, fristenUebernehmen, dokumenteAusNachricht, fristenAusNachricht, anhaengeAblegen } = await import("./analyse");
  zuordnen(urteil, albrecht, user, ansicht);
  let st = useData.getState().data;
  fristenUebernehmen(st.nachrichten.find((n) => n.id === urteil.id)!, albrecht, user, ansicht, st.fristen);
  zuordnen(useData.getState().data.nachrichten.find((n) => n.id === urteil.id)!, neumann, user, ansicht, { fristen: "lassen" });
  st = useData.getState().data;
  assert.equal(dokumenteAusNachricht(urteil, st.dokumente).filter((d) => d.akteId === albrecht.id).length, 0);
  assert.equal(fristenAusNachricht(urteil, albrecht.id, st.fristen).haupt.length, ansicht.fristen.length);
  assert.ok(st.aktivitaeten.some((a) => a.akteId === albrecht.id && /bleiben bewusst hier|bleibt bewusst hier/.test(a.text)));
  assert.equal(st.nachrichten.find((n) => n.id === urteil.id)!.kiStatus, "analysiert", "in 118/26 noch nicht notiert");
  // anhaengeAblegen prüft die Akte: ein Anhang in fremder Akte wird verschoben, nicht übersprungen
  const anhang = dokumenteAusNachricht(urteil, st.dokumente).find((d) => d.id.includes("-anhang-"))!;
  useData.getState().patch("dokumente", anhang.id, { akteId: albrecht.id });
  const erg = anhaengeAblegen(useData.getState().data.nachrichten.find((n) => n.id === urteil.id)!, neumann, user, { leise: true });
  assert.equal(erg.verschoben, 1);
  assert.equal(useData.getState().data.dokumente.find((d) => d.id === anhang.id)!.akteId, neumann.id);
});

test("Widerspruch Gerichts-Az. ↔ gewählte Akte wird erkannt", async () => {
  const { useData, urteil, neumann, albrecht } = await vorbereiten();
  const { gerichtsAzKonflikt } = await import("./analyse");
  const akten = useData.getState().data.akten;
  const k = gerichtsAzKonflikt(urteil, albrecht, akten);
  assert.equal(k?.akte.id, neumann.id);
  assert.match(k!.az, /28 O 211/);
  assert.equal(gerichtsAzKonflikt(urteil, neumann, akten), undefined);
});

test("Alle Anhänge beim Namen: abgelegte und nicht abgelegte Strukturdaten (I3-T02-03)", async () => {
  const { anhaengeText } = await import("./analyse");
  const n = { anhaenge: [{ name: "Urteil_28O211-26.pdf", groesseKb: 120 }, { name: "Zustellungsnachricht.xml", groesseKb: 4 }] } as Parameters<typeof anhaengeText>[0];
  assert.equal(anhaengeText(n, "Gericht"), "2 Anhänge: Urteil_28O211-26.pdf in ‚Gericht‘ abgelegt · Zustellungsnachricht.xml (Strukturdaten) nicht abgelegt");
  assert.equal(anhaengeText({ anhaenge: [] }, "Gericht"), "");
});

test("Korrigierte Frist aus der Nachricht gilt als notiert – „Fristen übernehmen“ legt keine zweite an (I5-T03-01)", async () => {
  const { useData, urteil, neumann, ansicht } = await vorbereiten();
  const { fristenUebernehmen, fristenAusNachricht, istNotiert, istNotiertAusNachricht } = await import("./analyse");
  fristenUebernehmen(urteil, neumann, user, ansicht, useData.getState().data.fristen);
  let st = useData.getState().data;
  const vorher = fristenAusNachricht(urteil, neumann.id, st.fristen);
  assert.equal(vorher.haupt.length, ansicht.fristen.length);
  // Berufungsfrist korrigiert: anderes Fristende, Korrektur vermerkt
  const berufung = vorher.haupt.find((f) => f.typ === "notfrist")!;
  const vorschlag = ansicht.fristen.find((p) => p.regelKey === berufung.regelKey)!;
  useData.getState().patch("fristen", berufung.id, {
    datum: "2026-11-19",
    korrekturen: [{ am: nowLocal(), vonId: user.id, grund: "Probe", vorher: { datum: berufung.datum, titel: berufung.titel } }],
  });
  st = useData.getState().data;
  assert.equal(istNotiert(vorschlag, neumann.id, st.fristen), false, "über das Fristende allein nicht mehr erkannt");
  assert.equal(istNotiertAusNachricht(vorschlag, urteil, neumann.id, st.fristen), true, "über Nachricht und Fristart erkannt");
  const r = fristenUebernehmen(st.nachrichten.find((n) => n.id === urteil.id)!, neumann, user, ansicht, st.fristen);
  assert.equal(r.anzahl, 0, "keine doppelte Frist");
  assert.equal(fristenAusNachricht(urteil, neumann.id, useData.getState().data.fristen).alle.length, vorher.alle.length);
});

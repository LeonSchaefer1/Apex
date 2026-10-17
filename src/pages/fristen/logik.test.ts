// Überweisungsnachweis einer Zahlungsfrist (I3-T15-01): nur Ausgänge, zuerst die der Akte, fremde nur mit Begründung.
// Fristkorrektur behält den Gerichtsort (I3-T03-02).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Buchung, Transaktion } from "@/core/types";
import { feiertagsortFuerFrist } from "@/core/fristen";
import { fremdHinweis, gerichtsortAusRechenweg, korrekturNeuBerechnet, nachweisUmsaetze } from "./logik";

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

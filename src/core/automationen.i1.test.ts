import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUSGEHEND, AUTOMATION_DEFS, JAHRESARBEITSSTUNDEN, PERSONALKOSTEN_JAHR, REFA_VOLLKOSTEN_STUNDE, WERT_PRO_STUNDE, WOCHEN_PRO_JAHR,
  ersparnisMinuten, jahreswert, kostensatz,
} from "./automationen";
import { generateTenantData } from "./seed/generate";
import { DEMO_TENANTS, publicUser } from "./seed/tenants";
import { motorZahlen } from "./kennzahlen";

test("38h-Motor: jede Automatik nennt ihre Freigabe – nichts geht ohne Freigabe nach außen", () => {
  for (const d of AUTOMATION_DEFS) {
    assert.ok(d.freigabe && d.freigabe.length > 5, `${d.key}: Freigabe fehlt`);
    assert.ok(d.vorgang, `${d.key}: Vorgang fehlt`);
    const text = `${d.beschreibung} ${d.schritte.join(" ")}`;
    assert.ok(!/sendet automatisch|selbstständig|mit einem Klick|autonom/i.test(text), `${d.key}: ${text}`);
    assert.ok(!d.schritte.includes("Versenden"), `${d.key}: Schritt „Versenden“`);
  }
  for (const key of AUSGEHEND) {
    const d = AUTOMATION_DEFS.find((x) => x.key === key)!;
    assert.match(d.freigabe!, /Freigabe/, key);
    assert.ok(d.schritte.some((s) => /Zur Freigabe vorlegen/.test(s)), `${key}: Schritt „Zur Freigabe vorlegen“`);
  }
  assert.equal(AUTOMATION_DEFS.find((x) => x.key === "deckungsanfrage")!.freigabe, "Entwurf – Versand erst nach Ihrer Freigabe");
  assert.equal(AUTOMATION_DEFS.find((x) => x.key === "eeb")!.freigabe, "Abgabe nur durch Anwältin/Anwalt");
  assert.equal(AUTOMATION_DEFS.find((x) => x.key === "vorfristen")!.freigabe, "intern – nichts verlässt die Kanzlei");
});

test("38h-Motor: Ersparnis je bearbeitetem Vorgang – ein Bankabruf ohne neue Zahlung spart nichts", () => {
  assert.equal(ersparnisMinuten("bankabgleich", 0), 0);
  assert.equal(ersparnisMinuten("bankabgleich", 4), 4 * AUTOMATION_DEFS.find((x) => x.key === "bankabgleich")!.minutenProLauf);
  assert.equal(ersparnisMinuten("kostenfestsetzung", 1), 20);
  assert.equal(ersparnisMinuten("unbekannt", 3), 0);
  assert.equal(ersparnisMinuten("zuordnung", -2), 0);
});

test("Kostensatz: Zielwert 19,74 €/Std. bewusst niedrig, ReFa-Vollkosten 26,04 €/Std. – beides nachrechenbar", () => {
  assert.equal(Math.round(WERT_PRO_STUNDE * 100) / 100, 19.74);
  assert.equal(PERSONALKOSTEN_JAHR, 50_000);
  assert.equal(JAHRESARBEITSSTUNDEN, 1_920);
  assert.equal(Math.round(REFA_VOLLKOSTEN_STUNDE * 100) / 100, 26.04);
  assert.equal(Math.round(kostensatz(60_000, 1_600) * 100) / 100, 37.5);
  assert.equal(kostensatz(50_000, 0), 0);
  assert.equal(Math.round(jahreswert(38)), 36_000);
  assert.equal(Math.round(jahreswert(38, REFA_VOLLKOSTEN_STUNDE) / 100) * 100, 47_500);
  assert.equal(WOCHEN_PRO_JAHR, 48);
});

test("Demodaten: Motor zählt plausibel je Vorgang – Bankabgleich ohne 12 Std. aus stündlichen Abrufen, wenige Kostenfestsetzungen", () => {
  for (const t of DEMO_TENANTS) {
    const d = generateTenantData({ tenant: t.tenant, users: t.users.map(publicUser), profil: t.profil }, "2026-10-16");
    const woche = d.aktivitaeten.filter((a) => a.zeit >= "2026-10-10" && a.zeit < "2026-10-17");
    const bank = woche.filter((a) => a.automationKey === "bankabgleich").reduce((s, a) => s + (a.minutenGespart ?? 0), 0);
    assert.ok(bank <= 4 * 60, `${t.tenant.kurzname}: Bankabgleich ${bank} Min. in 7 Tagen`);
    const kf = woche.filter((a) => a.automationKey === "kostenfestsetzung").length;
    assert.ok(kf <= 1, `${t.tenant.kurzname}: ${kf} Kostenfestsetzungen in 7 Tagen`);
    // Sammeleinträge nennen die Anzahl der Vorgänge und rechnen Minuten je Vorgang
    for (const a of d.aktivitaeten.filter((x) => x.automationKey === "bankabgleich" && /^Bankabgleich: \\d+/.test(x.text))) {
      const n = Number(a.text.match(/^Bankabgleich: (\\d+)/)![1]);
      assert.equal(a.minutenGespart, ersparnisMinuten("bankabgleich", n), a.text);
    }
    // Ausgehende Automatiken melden „zur Freigabe vorgelegt“, nie „versendet“
    for (const a of d.aktivitaeten.filter((x) => x.akteur === "automation")) assert.ok(!/versendet|versandt/.test(a.text), a.text);
    // Die Summe wird ausgewiesen, wie sie fällt – plausibel zwischen 10 und 60 Std.
    const std = motorZahlen(d.aktivitaeten, "2026-10-16").stunden;
    assert.ok(std > 10 && std < 60, `${t.tenant.kurzname}: ${std} Std.`);
  }
});

// Usability-Iteration 3 (A-00, I3-T10-01): Fristautomatiken – Folge beim Pausieren, Rechte, pausierte Liste
test("Fristautomatiken: Folge beim Pausieren, nur Partner/Administration, pausierte in fester Reihenfolge", async () => {
  const { FRIST_AUTOMATIKEN, folgeBeimPausieren, folgeWaehrendPause, istFristAutomatik, pausierteFristAutomatiken } = await import("./automationen");
  const { darfAutomatikSchalten } = await import("../lib/rollen");
  assert.deepEqual([...FRIST_AUTOMATIKEN], ["posteingang-fristen", "vorfristen", "eeb"]);
  for (const k of FRIST_AUTOMATIKEN) {
    assert.ok(istFristAutomatik(k));
    assert.ok(AUTOMATION_DEFS.some((d) => d.key === k), `${k} fehlt in AUTOMATION_DEFS`);
  }
  assert.equal(istFristAutomatik("bankabgleich"), false);
  assert.equal(folgeBeimPausieren("posteingang-fristen"), "Neue beA-Nachrichten werden dann nicht mehr auf Fristen geprüft – Sie notieren Fristen von Hand.");
  assert.match(folgeBeimPausieren("eeb"), /Frist beginnt trotzdem mit der Zustellung/);
  // als Zustand (Hinweisband, Briefing) ohne „dann“
  assert.equal(folgeWaehrendPause("posteingang-fristen"), "Neue beA-Nachrichten werden nicht mehr auf Fristen geprüft – Sie notieren Fristen von Hand.");
  assert.equal(folgeWaehrendPause("eeb"), folgeBeimPausieren("eeb"));
  assert.match(folgeBeimPausieren("vorfristen"), /Vorfristen und Wiedervorlagen/);
  assert.match(folgeBeimPausieren("bankabgleich"), /Bankabgleich/);
  for (const rolle of ["partner", "admin"] as const) assert.equal(darfAutomatikSchalten({ rolle }, "posteingang-fristen"), true);
  for (const rolle of ["anwalt", "refa", "azubi"] as const) {
    assert.equal(darfAutomatikSchalten({ rolle }, "eeb"), false, rolle);
    assert.equal(darfAutomatikSchalten({ rolle }, "bankabgleich"), true, rolle);
  }
  assert.equal(darfAutomatikSchalten(undefined, "bankabgleich"), false);
  const liste = [
    { key: "eeb", aktiv: false },
    { key: "bankabgleich", aktiv: false },
    { key: "posteingang-fristen", aktiv: false },
    { key: "vorfristen", aktiv: true },
  ];
  assert.deepEqual(pausierteFristAutomatiken(liste).map((a) => a.key), ["posteingang-fristen", "eeb"]);
  assert.deepEqual(pausierteFristAutomatiken([]), []);
});

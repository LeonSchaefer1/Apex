// Bankabgleich: Buchungsart bei Zuordnung zur Akte (I3-T08-01) und stornierte Rechnung im Verwendungszweck (I3-T08-02).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtEUR, nowLocal, uid } from "@/core/dates";
import type { Akte, Aktivitaet, Kontakt, Rechnung, TenantData, Transaktion } from "@/core/types";
import { buchungsartVorschlag, mandantenIbans, stornierteRechnungImZweck } from "./abgleich";

const kontakt = (id: string, name: string, typ: Kontakt["typ"] = "person", nachname?: string) => ({ id, name, typ, nachname, rollen: [] }) as unknown as Kontakt;
const albrecht = kontakt("k-alb", "Stefan Albrecht", "person", "Albrecht");
const yilmaz = kontakt("k-yil", "Elif Yilmaz", "person", "Yilmaz");
const elbtal = kontakt("k-elb", "Elbtal Versicherung AG", "organisation");
const kontakte = new Map([albrecht, yilmaz, elbtal].map((k) => [k.id, k]));
const a150 = { id: "a150", aktenzeichen: "150/26", mandantId: "k-alb", status: "offen" } as Akte;
const a131 = { id: "a131", aktenzeichen: "131/26", mandantId: "k-yil", gegnerId: "k-elb", status: "offen" } as Akte;
const umsatz = (p: Partial<Transaktion>): Transaktion => ({ id: uid("t"), datum: "2026-10-16", betrag: 1117.53, gegenpartei: "STEFAN ALBRECHT", iban: "DE12 3456 7890 1234 5678 90", verwendungszweck: "RE-2026-0024 AZ 150/26", status: "offen", ...p });

test("Zahler = Mandant → Honorar/Vorschuss; Versicherer auf 131/26 → Fremdgeld", () => {
  const v = buchungsartVorschlag(umsatz({}), a150, kontakte);
  assert.equal(v.art, "vorschuss");
  assert.equal(v.zahlerIstMandant, true);
  const f = buchungsartVorschlag(umsatz({ gegenpartei: "ELBTAL VERSICHERUNG AG", betrag: 6120, verwendungszweck: "Schaden EV-2026-448812 Ihr Az. 131/26" }), a131, kontakte);
  assert.equal(f.art, "fremdgeld");
  assert.equal(f.zahlerIstMandant, false);
  assert.match(f.grund, /Versicherer/);
  // Unbekannter Zahler mit bekannter IBAN der Mandantschaft → Mandant
  const iban = mandantenIbans("k-alb", [umsatz({ gegenpartei: "S. A.", status: "zugeordnet", zuordnung: { rechnungId: "r1", akteId: "a150", sicherheit: 1, durch: "manuell", grund: "" } })], [{ id: "r1", empfaengerId: "k-alb" }], [a150]);
  assert.equal(buchungsartVorschlag(umsatz({ gegenpartei: "S. A." }), a150, kontakte, iban).art, "vorschuss");
  assert.equal(buchungsartVorschlag(umsatz({ gegenpartei: "Unbekannt", iban: "DE00 1111" }), a150, kontakte, iban).art, "fremdgeld");
});

test("Stornierte Rechnung im Verwendungszweck: mit Korrekturentwurf bzw. ohne", () => {
  const storniert = { id: "r24", nummer: "RE-2026-0024", status: "storniert", stornoNummer: "RE-2026-0025", akteId: "a150", createdAt: "2026-10-01T10:00:00" } as Rechnung;
  const entwurf = { id: "r-e2", nummer: "Entwurf-002", status: "entwurf", korrekturVon: "r24", akteId: "a150", createdAt: "2026-10-17T10:00:00" } as Rechnung;
  const ohne = stornierteRechnungImZweck(umsatz({}), [storniert]);
  assert.equal(ohne?.storniert.id, "r24");
  assert.equal(ohne?.korrektur, undefined);
  assert.equal(stornierteRechnungImZweck(umsatz({}), [storniert, entwurf])?.korrektur?.nummer, "Entwurf-002");
  // keine Teiltreffer (RE-2026-00241), keine Ausgänge, keine offenen Rechnungen
  assert.equal(stornierteRechnungImZweck(umsatz({ verwendungszweck: "RE-2026-00241" }), [storniert]), undefined);
  assert.equal(stornierteRechnungImZweck(umsatz({ betrag: -10 }), [storniert]), undefined);
  assert.equal(stornierteRechnungImZweck(umsatz({}), [{ ...storniert, status: "gestellt" }]), undefined);
});

test("Buchung Honorar/Vorschuss: Guthaben im Aktenkonto, keine Fremdgeld-Wiedervorlage; Lösen storniert die Vorschussbuchung", async () => {
  const { useData } = await import("@/store/data");
  const { bucheTreffer, loeseZuordnung } = await import("./abgleich");
  const { kontoSummen } = await import("@/pages/akten/helfer");
  const t = umsatz({});
  const leer = { akten: [a150, a131], kontakte: [albrecht, yilmaz, elbtal], transaktionen: [t], buchungen: [], fristen: [], rechnungen: [], aktivitaeten: [] } as unknown as TenantData;
  useData.setState({ data: leer, status: "bereit" });
  useData.setState({
    upsert: (col, doc) => {
      const st = useData.getState();
      const arr = (st.data[col] ?? []) as { id: string }[];
      useData.setState({ data: { ...st.data, [col]: [doc, ...arr.filter((x) => x.id !== (doc as { id: string }).id)] } });
    },
    patch: (col, id, p) => {
      const st = useData.getState();
      useData.setState({ data: { ...st.data, [col]: (st.data[col] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x)) } });
    },
    log: (a) => {
      const st = useData.getState();
      useData.setState({ data: { ...st.data, aktivitaeten: [{ id: uid("akt"), zeit: nowLocal(), ...a } as Aktivitaet, ...st.data.aktivitaeten] } });
    },
  });
  bucheTreffer(t, { transaktionId: t.id, art: "vorschuss", regel: "keine", sicherheit: 1, grund: "Manuell", akteId: "a150" }, "manuell", "u1");
  let d = useData.getState().data;
  const tx = d.transaktionen.find((x) => x.id === t.id)!;
  assert.equal(tx.status, "zugeordnet");
  assert.equal(tx.zuordnung?.art, "vorschuss");
  assert.equal(d.fristen.length, 0, "keine Fremdgeld-Wiedervorlage");
  assert.ok(!d.buchungen.some((b) => b.fremdgeld || b.art === "fremdgeld"), "kein Fremdgeld");
  const s1 = kontoSummen(d.buchungen.filter((b) => b.akteId === "a150"));
  assert.equal(s1.vorschuss, 1117.53);
  assert.equal(s1.offen, -1117.53, "Guthaben 1.117,53 € im Aktenkonto 150/26");
  assert.equal(s1.fremdOffen, 0);
  // Zuordnung lösen: Gegenbuchung, Umsatz wieder offen, Konto ausgeglichen, kein „angeforderter“ Vorschuss
  loeseZuordnung(tx, "u1");
  d = useData.getState().data;
  assert.equal(d.transaktionen.find((x) => x.id === t.id)!.status, "offen");
  const s2 = kontoSummen(d.buchungen.filter((b) => b.akteId === "a150"));
  assert.deepEqual([s2.vorschuss, s2.angefordert, s2.offen], [0, 0, 0]);
  assert.ok(d.aktivitaeten.some((a) => /Honorar\/Vorschuss .* gegengebucht/.test(a.text)), "Protokoll");
});

test("Konto je Umsatz: Meldung und Fremdgeld-Text nennen das tatsächliche Konto (I4-T08-01)", async () => {
  const { fremdgeldMeldung, fremdgeldKonto, fremdgeldLiegtText, kontoVon, KONTO_NAME } = await import("./abgleich");
  // fehlt = Geschäftskonto (Altbestände)
  assert.equal(kontoVon({}), "geschaeft");
  assert.equal(kontoVon({ konto: "ander" }), "ander");
  assert.equal(KONTO_NAME.ander, "Anderkonto");
  assert.equal(fremdgeldMeldung(5670, "ander", "107/26"), `${fmtEUR(5670)} auf dem Anderkonto · 107/26 – bitte unverzüglich weiterleiten (§ 43a Abs. 7 BRAO)`);
  assert.equal(
    fremdgeldMeldung(6120, "geschaeft", "131/26"),
    `${fmtEUR(6120)} auf dem Geschäftskonto eingegangen · 131/26 – unverzüglich weiterleiten oder auf das Anderkonto umbuchen (§ 43a Abs. 7 BRAO, § 4 BORA)`,
  );
  assert.doesNotMatch(fremdgeldMeldung(100, "geschaeft"), /auf dem Anderkonto ·/);
  // Konto des Fremdgeld-Eingangs einer Akte aus dem Bankumsatz; Storno und Weiterleitungen zählen nicht
  const tx = [{ id: "t1", konto: "ander" as const }, { id: "t2" }];
  const b = (p: Partial<import("@/core/types").Buchung>) => ({ id: uid("b"), akteId: "a131", datum: "2026-10-16", art: "fremdgeld" as const, betrag: 100, text: "Zahlung", fremdgeld: true, ...p });
  assert.equal(fremdgeldKonto("a131", [b({ transaktionId: "t1" })], tx), "ander");
  assert.equal(fremdgeldKonto("a131", [b({ transaktionId: "t2" })], tx), "geschaeft");
  assert.equal(fremdgeldKonto("a131", [b({ transaktionId: "t1" }), b({ transaktionId: "t2" })], tx), "gemischt");
  assert.equal(fremdgeldKonto("a131", [b({})], tx), undefined, "ohne Bankumsatz unbekannt");
  assert.equal(fremdgeldKonto("a131", [b({ transaktionId: "t2", betrag: -100, text: "Weiterleitung" }), b({ transaktionId: "t1" })], tx), "ander");
  assert.match(fremdgeldLiegtText(6120, "geschaeft"), /^Auf dem Geschäftskonto eingegangen: 6\.120,00\s€ Fremdgeld – unverzüglich weiterleiten oder auf das Anderkonto umbuchen/);
  assert.match(fremdgeldLiegtText(5670, "ander"), /^Auf dem Anderkonto liegen 5\.670,00\s€/);
});

test("Fremdgeld buchen: Buchungstext, Frist-Notiz und Protokoll nach dem Konto des Umsatzes", async () => {
  const { useData } = await import("@/store/data");
  const { bucheTreffer } = await import("./abgleich");
  const t = umsatz({ gegenpartei: "ELBTAL VERSICHERUNG AG", betrag: 6120, verwendungszweck: "Schaden EV-2026-448812 Ihr Az. 131/26" });
  const leer = { akten: [a150, a131], kontakte: [albrecht, yilmaz, elbtal], transaktionen: [t], buchungen: [], fristen: [], rechnungen: [], aktivitaeten: [] } as unknown as TenantData;
  useData.setState({ data: leer, status: "bereit" });
  bucheTreffer(t, { transaktionId: t.id, art: "fremdgeld", regel: "fremdgeld", sicherheit: 1, grund: "Manuell", akteId: "a131" }, "manuell", "u1");
  const d = useData.getState().data;
  assert.match(d.buchungen[0].text, /Eingang Geschäftskonto/);
  assert.match(d.fristen[0].notiz ?? "", /Geschäftskonto eingegangen – unverzüglich weiterleiten oder auf das Anderkonto umbuchen/);
  assert.ok(d.aktivitaeten.some((a) => /Eingang auf dem Geschäftskonto/.test(a.text)));
});

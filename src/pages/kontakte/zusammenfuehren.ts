// Doppel-Datensätze zusammenführen (I4-T17-01): Die Dublette geht im Original-Kontakt auf – alle Verweise in Akten und
// Rechnungen werden umgehängt, Rollen und fehlende Kontaktdaten übernommen, die Dublette danach gelöscht.
// Reine Funktionen ohne React (Test: zusammenfuehren.test.ts); die Oberfläche liegt in KontaktDrawer.tsx.
import type { Akte, Kontakt, KontaktRolle, Rechnung, Rolle } from "@/core/types";
import type { BeteiligtenRolle } from "@/core/kontaktpruefung";

/** Zusammenführen dürfen Partner, Anwälte und die Administration (nicht Fachangestellte und Auszubildende). */
export const DARF_ZUSAMMENFUEHREN: Rolle[] = ["partner", "anwalt", "admin"];
export const darfZusammenfuehren = (rolle: Rolle) => DARF_ZUSAMMENFUEHREN.includes(rolle);

/** Kontaktdaten, die aus der Dublette übernommen werden, wenn sie beim Original fehlen. */
const DATENFELDER = ["anrede", "vorname", "nachname", "firma", "email", "telefon", "strasse", "plz", "ort", "safeId"] as const;
type Datenfeld = (typeof DATENFELDER)[number];
export const DATENFELD_LABEL: Record<Datenfeld, string> = {
  anrede: "Anrede", vorname: "Vorname", nachname: "Nachname", firma: "Firma", email: "E-Mail", telefon: "Telefon", strasse: "Straße", plz: "PLZ", ort: "Ort", safeId: "beA SAFE-ID",
};

export interface AktenUmhaengung {
  akte: Akte;
  rollen: BeteiligtenRolle[];
  patch: Partial<Akte>;
}

export interface ZusammenfuehrPlan {
  original: Kontakt;
  dublette: Kontakt;
  /** Original nach dem Zusammenführen (Rollen und fehlende Daten ergänzt) */
  kontakt: Kontakt;
  akten: AktenUmhaengung[];
  rechnungen: { rechnung: Rechnung; patch: Partial<Rechnung> }[];
  neueRollen: Kontakt["rollen"];
  uebernommen: { feld: Datenfeld; wert: string }[];
  /** Abweichende Angaben, die NICHT übernommen werden (das Original gilt) */
  abweichend: { feld: Datenfeld; original: string; dublette: string }[];
}

/** Plan für „Dublette in Original überführen“ – ohne etwas zu ändern (Vorschau und Test). */
export function planeZusammenfuehrung(original: Kontakt, dublette: Kontakt, daten: { akten: Akte[]; rechnungen: Rechnung[] }): ZusammenfuehrPlan {
  if (original.id === dublette.id) throw new Error("Ein Kontakt kann nicht mit sich selbst zusammengeführt werden.");
  const d = dublette.id;
  const o = original.id;

  const akten: AktenUmhaengung[] = [];
  for (const a of daten.akten) {
    const patch: Partial<Akte> = {};
    const rollen: BeteiligtenRolle[] = [];
    const setze = (rolle: BeteiligtenRolle, p: Partial<Akte>) => {
      Object.assign(patch, p);
      rollen.push(rolle);
    };
    if (a.mandantId === d) setze("Mandant", { mandantId: o });
    if (a.gegnerId === d) setze("Gegner", { gegnerId: o });
    if (a.gegneranwaltId === d) setze("Gegneranwalt", { gegneranwaltId: o });
    if (a.gerichtId === d) setze("Gericht", { gerichtId: o });
    if (a.forderung?.schuldnerId === d) setze("Schuldner", { forderung: { ...a.forderung, schuldnerId: o } });
    // Rechtsschutz verweist per Name auf die Versicherung
    if (a.rsv && a.rsv.versicherung.trim() === dublette.name.trim()) setze("Versicherung", dublette.name.trim() !== original.name.trim() ? { rsv: { ...a.rsv, versicherung: original.name } } : {});
    if (rollen.length) akten.push({ akte: a, rollen, patch });
  }
  const rechnungen = daten.rechnungen.filter((r) => r.empfaengerId === d).map((r) => ({ rechnung: r, patch: { empfaengerId: o } as Partial<Rechnung> }));

  const neueRollen = dublette.rollen.filter((r) => !original.rollen.includes(r));
  const uebernommen: ZusammenfuehrPlan["uebernommen"] = [];
  const abweichend: ZusammenfuehrPlan["abweichend"] = [];
  const kontakt: Kontakt = { ...original, rollen: [...original.rollen, ...neueRollen] };
  for (const f of DATENFELDER) {
    // Vor- und Nachname nur bei Personen, Firma nur bei Organisationen übernehmen
    if ((f === "vorname" || f === "nachname" || f === "anrede") && original.typ !== "person") continue;
    if (f === "firma" && original.typ !== "organisation") continue;
    const ow = (original[f] ?? "").trim();
    const dw = (dublette[f] ?? "").trim();
    if (!dw) continue;
    if (!ow) {
      (kontakt as unknown as Record<string, string>)[f] = dw;
      uebernommen.push({ feld: f, wert: dw });
    } else if (ow.toLowerCase() !== dw.toLowerCase()) {
      abweichend.push({ feld: f, original: ow, dublette: dw });
    }
  }
  const dn = dublette.notiz?.trim();
  if (dn && dn !== original.notiz?.trim()) kontakt.notiz = original.notiz?.trim() ? `${original.notiz.trim()}\n\nAus zusammengeführtem Datensatz: ${dn}` : dn;
  if (!original.versicherung && dublette.versicherung) kontakt.versicherung = dublette.versicherung;
  return { original, dublette, kontakt, akten, rechnungen, neueRollen, uebernommen, abweichend };
}

/** Plan anwenden: Akten und Rechnungen umgehängt, Original ergänzt, Dublette entfernt – als neue Bestände (rein, für Test und Store). */
export function wendeZusammenfuehrungAn(plan: ZusammenfuehrPlan, daten: { akten: Akte[]; rechnungen: Rechnung[]; kontakte: Kontakt[] }): { akten: Akte[]; rechnungen: Rechnung[]; kontakte: Kontakt[] } {
  const aktenPatch = new Map(plan.akten.map((x) => [x.akte.id, x.patch]));
  const rechnungPatch = new Map(plan.rechnungen.map((x) => [x.rechnung.id, x.patch]));
  return {
    akten: daten.akten.map((a) => (aktenPatch.has(a.id) ? { ...a, ...aktenPatch.get(a.id) } : a)),
    rechnungen: daten.rechnungen.map((r) => (rechnungPatch.has(r.id) ? { ...r, ...rechnungPatch.get(r.id) } : r)),
    kontakte: daten.kontakte.filter((k) => k.id !== plan.dublette.id).map((k) => (k.id === plan.original.id ? plan.kontakt : k)),
  };
}

/** Welcher Datensatz bleibt? Standard: der ältere (zuerst angelegte) – er ist in der Regel in den Akten verknüpft. */
export function originalUndDublette(a: Kontakt, b: Kontakt): { original: Kontakt; dublette: Kontakt } {
  return a.createdAt <= b.createdAt ? { original: a, dublette: b } : { original: b, dublette: a };
}

/** Rollennamen für den Protokolltext (wie in der Kontaktliste). */
const ROLLE_NAME: Record<KontaktRolle, string> = { mandant: "Mandant", gegner: "Gegner", gegneranwalt: "Gegneranwalt", gericht: "Gericht", versicherung: "Versicherung", behoerde: "Behörde", sonstige: "Sonstige" };

/** Protokolltext für das Kanzleiprotokoll. */
export function zusammenfuehrText(plan: ZusammenfuehrPlan, person: string): string {
  const akten = plan.akten.length ? plan.akten.map((x) => `${x.akte.aktenzeichen} (${x.rollen.join(", ")})`).join(", ") : "keine";
  const rechnungen = plan.rechnungen.length ? plan.rechnungen.map((x) => x.rechnung.nummer).join(", ") : "keine";
  const daten = plan.uebernommen.length ? ` · übernommen: ${plan.uebernommen.map((x) => DATENFELD_LABEL[x.feld]).join(", ")}` : "";
  const rollen = plan.neueRollen.length ? ` · Rollen ergänzt: ${plan.neueRollen.map((r) => ROLLE_NAME[r] ?? r).join(", ")}` : "";
  return `Kontakte zusammengeführt: Doppel-Datensatz „${plan.dublette.name}“${plan.dublette.ort ? ` (${plan.dublette.ort})` : ""} in „${plan.original.name}“${plan.original.ort ? ` (${plan.original.ort})` : ""} überführt – Akten umgehängt: ${akten}; Rechnungen umgehängt: ${rechnungen}${rollen}${daten}; Doppel-Datensatz gelöscht · durch ${person}`;
}

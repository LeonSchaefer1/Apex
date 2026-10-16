// Anlage neuer Kunden-Kanzleien (Apex Console) – gemeinsam für Demo- und Server-Betrieb.
import type { Ansprechpartner, Bundesland, Sachgebiet, Tenant, User, Rolle } from "../types";
import type { StadtKey } from "./pools";

export function initialen(name: string): string {
  const teile = name.replace(/^(Dr\.|Prof\.)\s+/g, "").split(/\s+/).filter(Boolean);
  return ((teile[0]?.[0] ?? "") + (teile[teile.length - 1]?.[0] ?? "")).toUpperCase();
}

/** Feste Ansprechpartnerin neuer Kundenzugänge (Testzugänge) – Quelle für Einladung, Anmeldeseite und Landing. */
export const STANDARD_ANSPRECHPARTNER: Ansprechpartner = {
  name: "Lena Vogt", rolle: "Ihre feste Ansprechpartnerin", bezeichnung: "Ansprechpartnerin", telefon: "+49 30 555 018 42",
  email: "lena.vogt@anwaltapex.de", initialen: "LV", verfuegbar: "Mo–Fr 7:30–19:00 Uhr",
};

/** Berufsbezeichnung der Hauptnutzerin bzw. des Hauptnutzers nach Anrede. */
export function anwaltTitel(anrede?: "Frau" | "Herr"): string {
  return anrede === "Frau" ? "Rechtsanwältin" : anrede === "Herr" ? "Rechtsanwalt" : "Rechtsanwältin / Rechtsanwalt";
}

const FARBEN = ["#2440D8", "#0E7C66", "#BE185D", "#7C3AED", "#B45309", "#0369A1", "#15803D", "#C2410C"];

export function stadtProfil(bundesland: Bundesland): StadtKey {
  if (bundesland === "BY" || bundesland === "BW") return "muenchen";
  if (["HH", "SH", "HB", "NI", "MV"].includes(bundesland)) return "hamburg";
  return "berlin";
}

export function baueKunde(input: {
  kanzlei: string; stadt: string; bundesland: Bundesland; adminName: string; adminEmail: string;
  arbeitsplaetze: number; schwerpunkte: Sachgebiet[]; testBis?: string; adminAnrede?: "Frau" | "Herr";
}, idSuffix: string): { tenant: Tenant; admin: User } {
  const tenantId = `t-${idSuffix}`;
  const farbe = FARBEN[Math.floor(Math.random() * FARBEN.length)];
  const kurz = input.kanzlei.replace(/\s+(Rechtsanwälte|Rechtsanwaltsgesellschaft|PartG mbB|mbH|GbR)\b.*$/i, "").trim() || input.kanzlei;
  const now = new Date();
  const jahr = now.getFullYear();
  const tenant: Tenant = {
    id: tenantId,
    name: input.kanzlei,
    kurzname: kurz,
    stadt: input.stadt,
    adresse: input.stadt,
    bundesland: input.bundesland,
    schwerpunkte: input.schwerpunkte.length ? input.schwerpunkte : ["Vertragsrecht"],
    lizenz: { typ: "lifetime", seit: now.toISOString().slice(0, 10), arbeitsplaetze: input.arbeitsplaetze, lizenzNr: `AAX-LT-${jahr}-${String(Math.floor(Math.random() * 9000) + 1000)}` },
    ansprechpartner: { ...STANDARD_ANSPRECHPARTNER },
    farbe,
    createdAt: now.toISOString(),
    status: "test",
    testBis: input.testBis,
  };
  const admin: User = {
    id: `u-${idSuffix}-1`,
    tenantId,
    name: input.adminName,
    email: input.adminEmail.trim().toLowerCase(),
    rolle: "partner",
    titel: anwaltTitel(input.adminAnrede),
    initialen: initialen(input.adminName),
    farbe,
    stundensatz: 250,
    ...(input.adminAnrede ? { anrede: input.adminAnrede } : {}),
  };
  return { tenant, admin };
}

export function baueNutzer(tenantId: string, input: { name: string; email: string; rolle: Rolle; titel: string; anrede?: "Frau" | "Herr" }, idx: number): User {
  return {
    ...(input.anrede ? { anrede: input.anrede } : {}),
    id: `u-${tenantId.replace(/^t-/, "")}-${idx}`,
    tenantId,
    name: input.name,
    email: input.email.trim().toLowerCase(),
    rolle: input.rolle,
    titel: input.titel,
    initialen: initialen(input.name),
    farbe: FARBEN[idx % FARBEN.length],
    stundensatz: input.rolle === "refa" || input.rolle === "azubi" ? undefined : 220,
  };
}

export function profilFuer(schwerpunkte: Sachgebiet[], bundesland: Bundesland) {
  const sg: [Sachgebiet, number][] = (schwerpunkte.length ? schwerpunkte : ["Vertragsrecht", "Mietrecht", "Arbeitsrecht"] as Sachgebiet[]).map((s, i) => [s, Math.max(1, 5 - i)]);
  return { sachgebiete: sg, heroes: "none" as const, stadt: stadtProfil(bundesland) };
}

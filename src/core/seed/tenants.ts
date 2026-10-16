// Demo-Kanzleien („Kunden") mit Zugängen. In der Server-Version legt die Apex Console weitere Kunden an.
import type { Sachgebiet, Tenant, User } from "../types";

export interface DemoUser extends User {
  passwort: string;
}

export interface DemoTenant {
  tenant: Tenant;
  users: DemoUser[];
  profil: { sachgebiete: [Sachgebiet, number][]; heroes: "berlin" | "muenchen" | "hamburg" | "none"; stadt: "berlin" | "muenchen" | "hamburg" };
}

export const DEMO_PASSWORT = "Apex-Demo-2026";
export const CONSOLE_DEMO = { email: "admin@anwaltapex.de", passwort: "Apex-Console-2026", name: "AnwaltApex Team" };

export const DEMO_TENANTS: DemoTenant[] = [
  {
    tenant: {
      id: "t-hartmann",
      name: "Hartmann & Partner Rechtsanwälte",
      kurzname: "Hartmann & Partner",
      stadt: "Berlin",
      adresse: "Kurfürstendamm 186, 10707 Berlin",
      bundesland: "BE",
      schwerpunkte: ["Arbeitsrecht", "Mietrecht", "Verkehrsrecht", "Erbrecht"],
      lizenz: { typ: "lifetime", seit: "2026-03-02", arbeitsplaetze: 8, lizenzNr: "AAX-LT-2026-0142" },
      ansprechpartner: {
        name: "Lena Vogt", rolle: "Ihre persönliche Ansprechpartnerin", telefon: "+49 30 555 018 42",
        email: "lena.vogt@anwaltapex.de", initialen: "LV", verfuegbar: "Mo–Fr 7:30–19:00 Uhr",
      },
      farbe: "#2440D8",
      createdAt: "2026-03-02T09:00:00",
      status: "test",
      testBis: "2026-12-31",
    },
    users: [
      { id: "u-hartmann-1", tenantId: "t-hartmann", name: "Dr. Julia Hartmann", email: "julia.hartmann@hartmann-partner.de", rolle: "partner", titel: "Rechtsanwältin · Fachanwältin für Arbeitsrecht", initialen: "JH", farbe: "#2440D8", stundensatz: 280, passwort: DEMO_PASSWORT },
      { id: "u-hartmann-2", tenantId: "t-hartmann", name: "Jonas Brandt", email: "jonas.brandt@hartmann-partner.de", rolle: "anwalt", titel: "Rechtsanwalt", initialen: "JB", farbe: "#0E8C7E", stundensatz: 220, passwort: DEMO_PASSWORT },
      { id: "u-hartmann-3", tenantId: "t-hartmann", name: "Mia Becker", email: "mia.becker@hartmann-partner.de", rolle: "refa", titel: "Rechtsanwaltsfachangestellte", initialen: "MB", farbe: "#C2410C", passwort: DEMO_PASSWORT },
    ],
    profil: {
      sachgebiete: [["Arbeitsrecht", 5], ["Mietrecht", 4], ["Verkehrsrecht", 3], ["Erbrecht", 2], ["Forderungseinzug", 2], ["Vertragsrecht", 1]],
      heroes: "berlin",
      stadt: "berlin",
    },
  },
  {
    tenant: {
      id: "t-lindner",
      name: "Lindner Rechtsanwälte PartG mbB",
      kurzname: "Lindner Rechtsanwälte",
      stadt: "München",
      adresse: "Maximilianstraße 31, 80539 München",
      bundesland: "BY",
      schwerpunkte: ["Forderungseinzug", "Vertragsrecht", "Baurecht", "Verkehrsrecht"],
      lizenz: { typ: "lifetime", seit: "2026-05-18", arbeitsplaetze: 12, lizenzNr: "AAX-LT-2026-0217" },
      ansprechpartner: {
        name: "Markus Seidel", rolle: "Ihr persönlicher Ansprechpartner", telefon: "+49 89 555 027 13",
        email: "markus.seidel@anwaltapex.de", initialen: "MS", verfuegbar: "Mo–Fr 7:30–19:00 Uhr",
      },
      farbe: "#0E7C66",
      createdAt: "2026-05-18T09:00:00",
      status: "test",
      testBis: "2026-12-31",
    },
    users: [
      { id: "u-lindner-1", tenantId: "t-lindner", name: "Stefan Lindner", email: "stefan.lindner@lindner-recht.de", rolle: "partner", titel: "Rechtsanwalt · Fachanwalt für Bau- und Architektenrecht", initialen: "SL", farbe: "#0E7C66", stundensatz: 300, passwort: DEMO_PASSWORT },
      { id: "u-lindner-2", tenantId: "t-lindner", name: "Aylin Kaya", email: "aylin.kaya@lindner-recht.de", rolle: "anwalt", titel: "Rechtsanwältin", initialen: "AK", farbe: "#7C3AED", stundensatz: 230, passwort: DEMO_PASSWORT },
      { id: "u-lindner-3", tenantId: "t-lindner", name: "Thomas Huber", email: "thomas.huber@lindner-recht.de", rolle: "refa", titel: "Rechtsfachwirt", initialen: "TH", farbe: "#B45309", passwort: DEMO_PASSWORT },
    ],
    profil: {
      sachgebiete: [["Forderungseinzug", 6], ["Vertragsrecht", 4], ["Baurecht", 4], ["Verkehrsrecht", 2], ["Arbeitsrecht", 1]],
      heroes: "muenchen",
      stadt: "muenchen",
    },
  },
  {
    tenant: {
      id: "t-demir",
      name: "Demir & Kollegen Rechtsanwälte",
      kurzname: "Demir & Kollegen",
      stadt: "Hamburg",
      adresse: "Neuer Wall 54, 20354 Hamburg",
      bundesland: "HH",
      schwerpunkte: ["Familienrecht", "Strafrecht", "Erbrecht", "Mietrecht"],
      lizenz: { typ: "lifetime", seit: "2026-07-01", arbeitsplaetze: 6, lizenzNr: "AAX-LT-2026-0288" },
      ansprechpartner: {
        name: "Lena Vogt", rolle: "Ihre persönliche Ansprechpartnerin", telefon: "+49 30 555 018 42",
        email: "lena.vogt@anwaltapex.de", initialen: "LV", verfuegbar: "Mo–Fr 7:30–19:00 Uhr",
      },
      farbe: "#BE185D",
      createdAt: "2026-07-01T09:00:00",
      status: "test",
      testBis: "2026-12-31",
    },
    users: [
      { id: "u-demir-1", tenantId: "t-demir", name: "Selin Demir", email: "selin.demir@demir-kollegen.de", rolle: "partner", titel: "Rechtsanwältin · Fachanwältin für Familienrecht", initialen: "SD", farbe: "#BE185D", stundensatz: 260, passwort: DEMO_PASSWORT },
      { id: "u-demir-2", tenantId: "t-demir", name: "Paul Hansen", email: "paul.hansen@demir-kollegen.de", rolle: "anwalt", titel: "Rechtsanwalt · Fachanwalt für Strafrecht", initialen: "PH", farbe: "#1D4ED8", stundensatz: 240, passwort: DEMO_PASSWORT },
      { id: "u-demir-3", tenantId: "t-demir", name: "Greta Jensen", email: "greta.jensen@demir-kollegen.de", rolle: "refa", titel: "Rechtsanwaltsfachangestellte", initialen: "GJ", farbe: "#0F766E", passwort: DEMO_PASSWORT },
    ],
    profil: {
      sachgebiete: [["Familienrecht", 5], ["Strafrecht", 4], ["Erbrecht", 3], ["Mietrecht", 3], ["Verkehrsrecht", 1]],
      heroes: "hamburg",
      stadt: "hamburg",
    },
  },
];

export function publicUser(u: DemoUser): User {
  const { passwort: _pw, ...rest } = u;
  void _pw;
  return rest;
}

// Erzeugt einen realistischen Beispiel-Export (Beispieldaten!) im Stil des gewählten Altsystems –
// mit bewusst eingebauten Dubletten, Sonderzeichen und unterschiedlichen Formaten, um die Übernahme zu zeigen.
import type { Akte, Kontakt } from "@/core/types";
import { addDays, fromISO } from "@/core/dates";
import type { QuellSystem } from "./zuordnung";

interface Format {
  kopf: string[];
  trenn: ";" | ",";
  bom: boolean;
  az: (n: number, jahr: number) => string;
  datum: (iso: string) => string;
  betrag: (n: number) => string;
}

const de2 = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const dmyKurz = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;
const pad = (n: number, l: number) => String(n).padStart(l, "0");

const FORMATE: Record<QuellSystem, Format> = {
  ramicro: {
    kopf: ["Aktennummer", "Kurzbezeichnung", "Mandant", "Gegner", "Sachgebiet", "Gegenstandswert", "Anlagedatum", "Nächste Frist", "Fristart"],
    trenn: ";", bom: false, az: (n, j) => `${n}/${String(j).slice(2)}`, datum: dmy, betrag: de2,
  },
  actaport: {
    kopf: ["Aktenzeichen", "Bezeichnung", "Mandant Name", "Gegner Name", "Rechtsgebiet", "Streitwert", "Angelegt am", "Fristdatum", "Fristbezeichnung"],
    trenn: ",", bom: true, az: (n, j) => `${j}-${pad(n, 4)}`, datum: (iso) => iso, betrag: (n) => `${de2(n)} €`,
  },
  advoware: {
    kopf: ["Az.", "Rubrum", "Auftraggeber", "Gegenseite", "Referat", "Gegenstandswert", "Anlage", "Frist", "Fristgrund"],
    trenn: ";", bom: false, az: (n, j) => `${pad(n, 5)}/${String(j).slice(2)}`, datum: dmy, betrag: de2,
  },
  renostar: {
    kopf: ["AktenNr", "Aktenbezeichnung", "Mandant", "Gegner", "Sachgebiet", "Wert", "Datum Anlage", "Wiedervorlage/Frist", "Art der Frist"],
    trenn: ";", bom: false, az: (n, j) => `${String(j).slice(2)}/${n}`, datum: dmyKurz, betrag: (n) => de2(n).replace(/\./g, ""),
  },
  csv: {
    kopf: ["Aktenzeichen", "Titel", "Mandant", "Gegner", "Sachgebiet", "Gegenstandswert", "Angelegt", "Frist", "Fristart"],
    trenn: ";", bom: true, az: (n, j) => `${n}/${String(j).slice(2)}`, datum: dmy, betrag: de2,
  },
};

interface Fall {
  mandant: string;
  gegner: string;
  sg: string;
  wert: number;
  frist?: string;
  titel?: string;
}

const FAELLE: Fall[] = [
  { mandant: "Katharina Wolff", gegner: "Brandenburger Möbelwerke GmbH", sg: "Arbeitsrecht", wert: 14850, frist: "Klageerwiderung Arbeitsgericht" },
  { mandant: "Thomas Albrecht", gegner: "Wohnbau Spreeufer eG", sg: "Mietrecht", wert: 4320, frist: "Stellungnahme Mieterhöhungsverlangen" },
  { mandant: "Sabine Krüger", gegner: "Nordstern Versicherung AG", sg: "Verkehrsunfall", wert: 8760, frist: "Wiedervorlage Regulierung" },
  { mandant: "Elektro Petersen GmbH", gegner: "Hausmann Bau KG", sg: "Forderungseinzug", wert: 23415.8, frist: "Widerspruchsfrist Mahnbescheid" },
  { mandant: "Erbengemeinschaft Lorenz", gegner: "", sg: "Erbrecht", wert: 186000, frist: "Ausschlagungsfrist § 1944 BGB", titel: "Nachlass Gerhard Lorenz" },
  { mandant: "Julia Sander", gegner: "Markus Sander", sg: "Familienrecht", wert: 9000, frist: "Stellungnahme Versorgungsausgleich" },
  { mandant: "Brückner Logistik GmbH", gegner: "Ostsee Spedition GmbH & Co. KG", sg: "Zivilrecht/Vertrag", wert: 56200, frist: "Berufungsbegründung § 520 ZPO" },
  { mandant: "Peter Lindemann", gegner: "Landkreis Havelland, Bußgeldstelle", sg: "Verkehrsrecht (OWi)", wert: 0, frist: "Akteneinsicht Bußgeldbehörde" },
  { mandant: "Café Morgenrot UG (haftungsbeschränkt)", gegner: "Immobilien Weißensee GmbH", sg: "Gewerbemiete", wert: 31800, frist: "Klageerwiderung" },
  { mandant: "Andreas Vogel", gegner: "TechNova Systems GmbH", sg: "Arbeitsrecht", wert: 22500, frist: "Gütetermin vorbereiten" },
  { mandant: "Monika Schuster", gegner: "Dr. Frank Beyer", sg: "Baurecht", wert: 17640.5 },
  { mandant: "Elektro Petersen GmbH", gegner: "Gastro Plus Berlin GmbH", sg: "Inkasso", wert: 3980.5, frist: "Wiedervorlage Zahlungseingang" },
  { mandant: "Ralf Neumeier", gegner: "", sg: "Strafrecht", wert: 0, frist: "Stellungnahme im Ermittlungsverfahren", titel: "Ermittlungsverfahren Neumeier" },
  { mandant: "Lena Hartwig", gegner: "Stadtwerke Havelland GmbH", sg: "Vertragsrecht", wert: 1240 },
];

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function kurz(name: string): string {
  if (/\b(GmbH|AG|KG|UG|eG|e\.V\.|GbR|mbH)\b/.test(name) || name.startsWith("Erbengemeinschaft")) return name.replace(/\s*\(haftungsbeschränkt\)/, "");
  const teile = name.replace(/^(Dr\.|Prof\.)\s+/, "").split(" ");
  return teile[teile.length - 1];
}

function werktag(iso: string): string {
  const wd = fromISO(iso).getUTCDay();
  return wd === 6 ? addDays(iso, 2) : wd === 0 ? addDays(iso, 1) : iso;
}

function zelle(v: string, trenn: string): string {
  return v.includes(trenn) || /["\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Beispiel-Export: 16 Akten im Stil des Systems, inkl. einer Aktenzeichen- und einer Bezeichnungs-Dublette. */
export function beispielExport(system: QuellSystem, akten: Akte[], kontakte: Kontakt[], heute: string): { name: string; text: string } {
  const f = FORMATE[system];
  const r = rng(system + heute.slice(0, 7));
  const jahr = Number(heute.slice(0, 4));
  const zeilen: string[][] = [];
  let n = 300 + Math.floor(r() * 400);

  const zeile = (az: string, titel: string, fall: Fall, angelegt: string, frist?: string) => [
    az, titel, fall.mandant, fall.gegner, fall.sg, fall.wert ? f.betrag(fall.wert) : "", f.datum(angelegt), frist ? f.datum(frist) : "", frist ? fall.frist ?? "" : "",
  ];

  // Ein Mandant, der in AnwaltApex bereits als Kontakt existiert (wird zusammengeführt statt doppelt angelegt)
  const vorhandenerMandant = kontakte.find((k) => k.rollen.includes("mandant") && k.typ === "person");
  const faelle = FAELLE.map((fall, i) => (i === 9 && vorhandenerMandant ? { ...fall, mandant: vorhandenerMandant.name } : fall));

  faelle.forEach((fall, i) => {
    const angelegt = addDays(heute, -Math.floor(40 + r() * 620));
    const jahrAnlage = Number(angelegt.slice(0, 4));
    const frist = fall.frist ? werktag(addDays(heute, Math.floor(4 + r() * 40))) : undefined;
    const titel = fall.titel ?? (fall.gegner ? `${kurz(fall.mandant)} ./. ${fall.gegner.split(",")[0]}` : `${kurz(fall.mandant)} – ${fall.sg}`);
    zeilen.push(zeile(f.az(n, jahrAnlage), titel, fall, angelegt, frist));
    n += 1 + Math.floor(r() * 3);
    // Dubletten an Position 4 und 11 einstreuen
    if (i === 3 || i === 10) {
      const offen = akten.filter((a) => a.status === "offen");
      const a = offen[(i === 3 ? 0 : Math.min(5, offen.length - 1))];
      if (!a) return;
      const mandant = kontakte.find((k) => k.id === a.mandantId)?.name ?? kurz(a.titel.split(" ./. ")[0] ?? a.titel);
      const gegner = kontakte.find((k) => k.id === a.gegnerId)?.name ?? "";
      const dupFall: Fall = { mandant, gegner, sg: a.sachgebiet, wert: a.gegenstandswert, frist: "Wiedervorlage" };
      const az = i === 3 ? a.aktenzeichen : f.az(n++, jahr - 1);
      zeilen.push(zeile(az, a.titel, dupFall, a.createdAt.slice(0, 10), werktag(addDays(heute, 9 + i))));
    }
  });

  const text = (f.bom ? "﻿" : "") + [f.kopf, ...zeilen].map((z) => z.map((v) => zelle(v, f.trenn)).join(f.trenn)).join("\r\n") + "\r\n";
  const datei = { ramicro: "RA-MICRO_Aktenliste", actaport: "actaport-akten-export", advoware: "Advoware_Aktenauswertung", renostar: "ReNoStar_Akten", csv: "Aktenliste" }[system];
  return { name: `${datei}_Beispieldaten.csv`, text };
}

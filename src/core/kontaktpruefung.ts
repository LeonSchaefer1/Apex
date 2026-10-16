// Prüfungen rund um Kontakte – reine Fachlogik ohne React, genutzt von Kontakte, Mandatsaufnahme und Akte:
// Dublettenprüfung, Rollen eines Kontakts in den Akten, Kollisionsprüfung für ein neues Mandat (§ 43a Abs. 4 BRAO)
// und Löschsperre nach § 50 Abs. 1 BRAO.
import { fmtDate } from "./dates";
import type { Akte, Kontakt } from "./types";

export type BeteiligtenRolle = "Mandant" | "Gegner" | "Gegneranwalt" | "Gericht" | "Versicherung" | "Schuldner";

/** Alle Akten, in denen ein Kontakt vorkommt – mit seiner Rolle in der jeweiligen Akte. */
export function aktenVonKontakt(k: Kontakt, akten: Akte[]): { akte: Akte; rolle: BeteiligtenRolle }[] {
  const out: { akte: Akte; rolle: BeteiligtenRolle }[] = [];
  for (const a of akten) {
    if (a.mandantId === k.id) out.push({ akte: a, rolle: "Mandant" });
    else if (a.gegnerId === k.id) out.push({ akte: a, rolle: "Gegner" });
    else if (a.forderung?.schuldnerId === k.id) out.push({ akte: a, rolle: "Schuldner" });
    else if (a.gegneranwaltId === k.id) out.push({ akte: a, rolle: "Gegneranwalt" });
    else if (a.gerichtId === k.id) out.push({ akte: a, rolle: "Gericht" });
    else if (a.rsv?.versicherung && a.rsv.versicherung === k.name) out.push({ akte: a, rolle: "Versicherung" });
  }
  return out;
}

const RECHTSFORM_AM_ENDE = /(?:\s+(?:gmbh\s*&\s*co\.?\s*kg|gmbh|ag|kg|ohg|gbr|ug(?:\s*\(haftungsbeschränkt\))?|e\.\s?v\.?|eg|se|mbb|partg(?:\s*mbb)?|ltd\.?|inc\.?))+\.?$/i;

/** Namen vergleichbar machen: Kleinschreibung, ohne Titel, Rechtsform am Ende und Satzzeichen („Kröger Logistik GmbH“ ≈ „kröger logistik“). */
export function nameSchluessel(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(?:dr|prof)\.\s*/g, "")
    .replace(/[„“"'’,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(RECHTSFORM_AM_ENDE, "")
    .replace(/[.\s-]+$/g, "")
    .trim();
}

/**
 * Telefonnummer auf Ziffern reduzieren und Ländervorwahl vereinheitlichen –
 * „+49 176 2214 8830“, „+49 (0)176 22148830“, „0049 176…“ und „0176 2214 8830“ ergeben „017622148830“.
 */
export function telefonZiffern(s: string): string {
  const t = s.replace(/\(0\)/g, "").trim();
  let d = t.replace(/\D/g, "");
  if (t.startsWith("+") || t.startsWith("00")) {
    d = d.replace(/^00/, "");
    if (d.startsWith("49")) d = `0${d.slice(2)}`;
  }
  return d;
}

export interface Dublette {
  kontakt: Kontakt;
  grund: "name" | "email" | "telefon";
}

export const DUBLETTE_GRUND: Record<Dublette["grund"], string> = { name: "gleicher Name", email: "gleiche E-Mail-Adresse", telefon: "gleiche Telefonnummer" };

/**
 * Dublettenprüfung – gleicher Name (ohne Titel und Rechtsform), gleiche E-Mail-Adresse oder gleiche Telefonnummer.
 * Genutzt von „Neuer Kontakt“ und der Mandatsaufnahme („Kontakt besteht bereits“).
 */
export function findeDublette(kontakte: Kontakt[], e: { name: string; email?: string; telefon?: string }, ohneId?: string): Dublette | undefined {
  const andere = ohneId ? kontakte.filter((k) => k.id !== ohneId) : kontakte;
  const schluessel = nameSchluessel(e.name);
  if (schluessel.length >= 2) {
    const k = andere.find((x) => nameSchluessel(x.name) === schluessel);
    if (k) return { kontakt: k, grund: "name" };
  }
  const mail = e.email?.trim().toLowerCase();
  if (mail && /@/.test(mail)) {
    const k = andere.find((x) => x.email?.trim().toLowerCase() === mail);
    if (k) return { kontakt: k, grund: "email" };
  }
  const tel = e.telefon ? telefonZiffern(e.telefon) : "";
  if (tel.length >= 6) {
    const k = andere.find((x) => !!x.telefon && telefonZiffern(x.telefon) === tel);
    if (k) return { kontakt: k, grund: "telefon" };
  }
  return undefined;
}

/** Frühester Löschzeitpunkt: sechs Jahre nach Ablauf des Kalenderjahres, in dem das letzte Mandat endete (§ 50 Abs. 1 BRAO). */
export function loeschSperre(k: Kontakt, akten: Akte[]): { gesperrt: false } | { gesperrt: true; grund: string; offen: number; abDatum?: string } {
  const verknuepft = aktenVonKontakt(k, akten);
  if (!verknuepft.length) return { gesperrt: false };
  const offen = verknuepft.filter((x) => x.akte.status !== "abgeschlossen").length;
  if (offen) {
    return {
      gesperrt: true,
      offen,
      grund: `Aufbewahrung der Handakte 6 Jahre nach Mandatsende (§ 50 Abs. 1 BRAO) – löschbar erst nach Abschluss der Akten (${offen} ${offen === 1 ? "Akte" : "Akten"} noch offen).`,
    };
  }
  const letztes = verknuepft.map((x) => x.akte.abgeschlossenAm ?? x.akte.updatedAt.slice(0, 10)).sort().at(-1)!;
  const ab = `${Number(letztes.slice(0, 4)) + 7}-01-01`;
  return {
    gesperrt: true,
    offen: 0,
    abDatum: ab,
    grund: `Aufbewahrung der Handakte 6 Jahre nach Mandatsende (§ 50 Abs. 1 BRAO) – frühestens löschbar ab ${fmtDate(ab)} (letztes Mandatsende ${fmtDate(letztes)}).`,
  };
}

/** Kollisionsprüfung für ein neues Mandat: Wo hat der Kontakt eine widerstreitende Rolle? */
export function kollisionFuerNeuesMandat(k: Kontakt, akten: Akte[], als: "mandant" | "gegner"): { konflikte: { akte: Akte; rolle: BeteiligtenRolle }[]; frueher: { akte: Akte; rolle: BeteiligtenRolle }[] } {
  const widerstreitend = (r: BeteiligtenRolle) => (als === "mandant" ? r === "Gegner" || r === "Schuldner" : r === "Mandant");
  const treffer = aktenVonKontakt(k, akten).filter((x) => widerstreitend(x.rolle));
  return { konflikte: treffer.filter((x) => x.akte.status !== "abgeschlossen"), frueher: treffer.filter((x) => x.akte.status === "abgeschlossen") };
}

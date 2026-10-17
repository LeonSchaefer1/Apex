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

/** Grund, warum zwei Datensätze als dieselbe Person bzw. Firma gelten. */
export type GleichGrund = Dublette["grund"] | "domain";

export const GLEICH_GRUND: Record<GleichGrund, string> = { ...DUBLETTE_GRUND, domain: "gleiche E-Mail-Domain der Firma" };

/**
 * Freemailer – eine gemeinsame Domain bei gmx.de, web.de, gmail.com … sagt nichts über dieselbe Firma aus.
 * `hotmail.*`, `yahoo.*`, `live.*` und `outlook.*` gelten in jeder Länderendung.
 */
const FREEMAILER = new Set([
  "gmx.de", "gmx.net", "gmx.at", "gmx.ch", "gmx.com", "web.de", "gmail.com", "googlemail.com", "posteo.de", "posteo.net", "t-online.de",
  "icloud.com", "me.com", "mac.com", "mail.de", "freenet.de", "aol.com", "aol.de", "arcor.de", "online.de", "email.de", "1und1.de",
  "mailbox.org", "proton.me", "protonmail.com", "vodafone.de", "kabelmail.de",
]);
const FREEMAILER_FAMILIE = /^(?:hotmail|yahoo|outlook|live|msn|ymail)\.[a-z.]+$/;

/** Domain einer E-Mail-Adresse in Kleinschreibung – `undefined` ohne gültige Adresse. */
export function emailDomain(email?: string): string | undefined {
  const m = email?.trim().toLowerCase().match(/^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? m[1].replace(/^www\./, "") : undefined;
}

/** Freemail-Domain (gmx.de, web.de, gmail.com, hotmail.* …)? */
export function istFreemailer(domain: string): boolean {
  const d = domain.toLowerCase();
  return FREEMAILER.has(d) || FREEMAILER_FAMILIE.test(d);
}

/**
 * Alle ANDEREN Datensätze derselben Person bzw. Firma (I4-T17-01): gleicher Name ohne Titel, Rechtsform, Groß-/Kleinschreibung
 * und Satzzeichen (`nameSchluessel`), gleiche E-Mail-Adresse, gleiche Telefonnummer (`telefonZiffern`) und – bei Organisationen –
 * gleiche E-Mail-Domain (ohne Freemailer). Je Datensatz ein Treffer mit dem ersten zutreffenden Grund.
 */
export function gleicheKontakte(
  k: Pick<Kontakt, "id" | "name" | "email" | "telefon" | "typ">,
  kontakte: Kontakt[],
): { kontakt: Kontakt; grund: GleichGrund }[] {
  const schluessel = nameSchluessel(k.name ?? "");
  const mail = k.email?.trim().toLowerCase();
  const tel = k.telefon ? telefonZiffern(k.telefon) : "";
  const domain = k.typ !== "person" ? emailDomain(k.email) : undefined;
  const domainZaehlt = !!domain && !istFreemailer(domain);
  const out: { kontakt: Kontakt; grund: GleichGrund }[] = [];
  for (const x of kontakte) {
    if (k.id && x.id === k.id) continue;
    let grund: GleichGrund | undefined;
    if (schluessel.length >= 2 && nameSchluessel(x.name) === schluessel) grund = "name";
    else if (mail && /@/.test(mail) && x.email?.trim().toLowerCase() === mail) grund = "email";
    else if (tel.length >= 6 && !!x.telefon && telefonZiffern(x.telefon) === tel) grund = "telefon";
    else if (domainZaehlt && x.typ === "organisation" && emailDomain(x.email) === domain) grund = "domain";
    if (grund) out.push({ kontakt: x, grund });
  }
  return out;
}

/** Treffer der Kollisionsprüfung – `ueber` ist der gleiche Datensatz, über den er gefunden wurde (fehlt beim geprüften Kontakt selbst). */
export interface KollisionsTreffer {
  akte: Akte;
  rolle: BeteiligtenRolle;
  ueber?: Kontakt;
}

export interface KollisionsErgebnis {
  konflikte: KollisionsTreffer[];
  frueher: KollisionsTreffer[];
}

function kollisionUeber(pruefen: { k: Kontakt; ueber?: Kontakt }[], akten: Akte[], als: "mandant" | "gegner"): KollisionsErgebnis {
  const widerstreitend = (r: BeteiligtenRolle) => (als === "mandant" ? r === "Gegner" || r === "Schuldner" : r === "Mandant");
  const treffer: KollisionsTreffer[] = [];
  const gesehen = new Set<string>();
  for (const { k, ueber } of pruefen) {
    for (const x of aktenVonKontakt(k, akten)) {
      if (!widerstreitend(x.rolle)) continue;
      const key = `${x.akte.id}|${x.rolle}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      treffer.push(ueber ? { ...x, ueber } : x);
    }
  }
  return { konflikte: treffer.filter((x) => x.akte.status !== "abgeschlossen"), frueher: treffer.filter((x) => x.akte.status === "abgeschlossen") };
}

/**
 * Kollisionsprüfung für ein neues Mandat (§ 43a Abs. 4 BRAO, § 3 BORA): Wo hat der Kontakt eine widerstreitende Rolle?
 * Mit `kontakte` prüft sie den Kontakt UND alle gleichen Datensätze (Dubletten, `gleicheKontakte`) – ein Treffer über eine Dublette
 * trägt `ueber`. Ohne `kontakte` nur über die Kontakt-ID (bisheriges Ergebnis).
 */
export function kollisionFuerNeuesMandat(k: Kontakt, akten: Akte[], als: "mandant" | "gegner", kontakte?: Kontakt[]): KollisionsErgebnis {
  const pruefen: { k: Kontakt; ueber?: Kontakt }[] = [{ k }];
  if (kontakte) for (const g of gleicheKontakte(k, kontakte)) pruefen.push({ k: g.kontakt, ueber: g.kontakt });
  return kollisionUeber(pruefen, akten, als);
}

/**
 * Kollisionsprüfung für einen neu getippten Namen (Mandatsaufnahme „Neuer Mandant“, Gegner): über alle Datensätze, die nach Name,
 * E-Mail, Telefon bzw. Firmen-Domain dieselbe Person oder Firma sind. Jeder Treffer trägt `ueber` (der gefundene Datensatz).
 */
export function kollisionFuerEntwurf(
  e: { name: string; email?: string; telefon?: string; typ?: Kontakt["typ"] },
  kontakte: Kontakt[],
  akten: Akte[],
  als: "mandant" | "gegner",
): KollisionsErgebnis {
  const gleiche = gleicheKontakte({ id: "", name: e.name, email: e.email, telefon: e.telefon, typ: e.typ ?? "organisation" }, kontakte);
  return kollisionUeber(gleiche.map((g) => ({ k: g.kontakt, ueber: g.kontakt })), akten, als);
}

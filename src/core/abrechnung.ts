// Abrechnung – reine Fachlogik ohne React (mit Tests in abrechnung.test.ts): Rechnungssummen, Aufteilung bei Rechtsschutz,
// Vorschuss nach § 9 RVG, IBAN-Prüfung und die Fremdgeld-Regel des Bankabgleichs (§ 43a Abs. 7 BRAO).
import { round2 } from "./dates";
import { berechnetePauschalen, berechneRvg, fassungFuerAuftrag, rvgRechnungsPositionen, UST_SATZ, type RvgFassung } from "./rvg";
import type { Akte, AktenPhase, Kontakt, Rechnung, RechnungsPosition, Transaktion } from "./types";

// ───────────── Summen ─────────────
export interface Summen {
  netto: number;
  ust: number;
  brutto: number;
}

/** Summen aus Positionen (USt. 19 % nach Nr. 7008 VV RVG). */
export function summen(positionen: RechnungsPosition[], ust = true): Summen {
  const netto = round2(positionen.reduce((s, p) => s + p.betrag, 0));
  const u = ust ? round2(netto * UST_SATZ) : 0;
  return { netto, ust: u, brutto: round2(netto + u) };
}

// ───────────── Rechtsschutz ─────────────

/**
 * Aufteilung bei Rechtsschutz: Die Rechnung bleibt an den Mandanten adressiert (Leistungsempfänger nach § 14 UStG und
 * Vergütungsschuldner); der Block nennt, was die RSV übernimmt und was als Selbstbeteiligung beim Mandanten bleibt.
 * Ohne RSV oder bei abgelehnter Deckung: keine Aufteilung.
 */
export function rsvAufteilung(akte: Pick<Akte, "rsv"> | undefined, brutto: number): Rechnung["rsv"] {
  const r = akte?.rsv;
  if (!r || r.deckung === "abgelehnt" || !r.versicherung.trim()) return undefined;
  const sb = round2(Math.min(Math.max(0, r.selbstbeteiligung ?? 0), Math.max(0, brutto)));
  return {
    versicherung: r.versicherung,
    ...(r.versicherungsnummer ? { versicherungsnummer: r.versicherungsnummer } : {}),
    ...(r.schadennummer ? { schadennummer: r.schadennummer } : {}),
    selbstbeteiligung: sb,
    anteilVersicherung: round2(Math.max(0, brutto - sb)),
    zugesagt: r.deckung === "erteilt",
  };
}

/**
 * „Davon übernimmt Nordlicht Rechtsschutz AG (Vers.-Nr. RS-4471209, Schaden-Nr. S-…): 2.818,46 €; Ihre Selbstbeteiligung: 150,00 €“ –
 * solange die Deckungszusage aussteht: „Vorbehaltlich der Deckungszusage übernimmt …“.
 */
export function rsvBlockText(rsv: NonNullable<Rechnung["rsv"]>, fmt: (n: number) => string): string {
  const nr = [rsv.versicherungsnummer ? `Vers.-Nr. ${rsv.versicherungsnummer}` : "", rsv.schadennummer ? `Schaden-Nr. ${rsv.schadennummer}` : ""].filter(Boolean).join(", ");
  const auftakt = rsv.zugesagt === false ? "Vorbehaltlich der Deckungszusage übernimmt" : "Davon übernimmt";
  return `${auftakt} ${rsv.versicherung}${nr ? ` (${nr})` : ""}: ${fmt(rsv.anteilVersicherung)}; Ihre Selbstbeteiligung: ${fmt(rsv.selbstbeteiligung)}`;
}

// ───────────── Vorschuss nach § 9 RVG ─────────────

/** Gebühren, auf die je Phase ein Vorschuss angefordert wird – entstandene und voraussichtlich entstehende (§ 9 RVG). */
const VORSCHUSS_POSITIONEN: Partial<Record<AktenPhase, string[]>> = {
  Mandatsaufnahme: ["2300"],
  Außergerichtlich: ["2300"],
  Gerichtlich: ["3100", "3104"],
  Beweisaufnahme: ["3100", "3104"],
  Urteil: ["3100", "3104"],
  Vollstreckung: ["3309"],
};

/**
 * Vorschlag für eine Vorschussrechnung (§ 9 RVG): Gebühren der aktuellen Phase nach dem Gegenstandswert, ohne bereits
 * berechnete Gebühren (§ 15 Abs. 2 RVG) und ohne bereits berechnete Auslagenpauschale. Ohne Gegenstandswert: kein Vorschlag.
 */
export function vorschussVorschlag(akte: Akte, rechnungenDerAkte: Rechnung[]): { positionen: RechnungsPosition[]; summen: Summen; fassung: RvgFassung } | { grund: string } {
  if (akte.gegenstandswert <= 0) return { grund: "Kein Gegenstandswert hinterlegt – bitte zuerst in der Akte eintragen." };
  const basis = VORSCHUSS_POSITIONEN[akte.phase];
  if (!basis) return { grund: `Für die Phase „${akte.phase}“ ist kein Vorschuss vorgesehen.` };
  const gueltig = rechnungenDerAkte.filter((r) => r.status !== "storniert");
  const berechnet = new Set(gueltig.flatMap((r) => r.positionen.map((p) => p.vv)));
  const neu = basis.filter((nr) => !berechnet.has(nr));
  if (!neu.length) {
    const entwurf = gueltig.find((r) => r.status === "entwurf" && r.positionen.some((p) => basis.includes(p.vv)));
    return { grund: entwurf ? `Für diese Gebühren liegt bereits der Rechnungsentwurf ${entwurf.nummer} vor – bitte dort weiterarbeiten (Abrechnung → Rechnungen → Entwürfe).` : "Die Gebühren dieser Phase sind bereits berechnet." };
  }
  const fassung = fassungFuerAuftrag(akte.createdAt.slice(0, 10));
  const erg = berechneRvg({ positionen: neu.map((nr) => ({ nr })), gegenstandswert: akte.gegenstandswert, fassung, anrechnung: false, bereitsPauschale: berechnetePauschalen(gueltig) });
  const positionen = rvgRechnungsPositionen(erg.angelegenheiten);
  return { positionen, summen: summen(positionen), fassung };
}

// ───────────── IBAN (Fremdgeld-Weiterleitung) ─────────────

/** IBAN ohne Leerzeichen, Großbuchstaben. */
export const ibanKompakt = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();
/** „DE89 3704 0044 0532 0130 00“ */
export const ibanFormatiert = (iban: string) => ibanKompakt(iban).replace(/(.{4})/g, "$1 ").trim();

/** Prüfziffer nach ISO 13616 (Modulo 97) – deutsche IBAN zusätzlich mit 22 Stellen. */
export function ibanGueltig(iban: string): boolean {
  const k = ibanKompakt(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(k)) return false;
  if (k.startsWith("DE") && k.length !== 22) return false;
  const umgestellt = k.slice(4) + k.slice(0, 4);
  let rest = 0;
  for (const ch of umgestellt) {
    const wert = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

// ───────────── Fremdgeld im Bankabgleich ─────────────

export const norm = (s: string) => s.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function namensTeile(k: Kontakt | undefined): string[] {
  if (!k) return [];
  if (k.typ === "person") return [k.nachname, k.name].filter((x): x is string => !!x && x.length >= 3).map(norm);
  const basis = (k.firma ?? k.name).replace(/\b(gmbh|ag|kg|co\.|ohg|gbr|e\.v\.|mbh|&)\b/gi, " ");
  const erstesWort = basis.split(/\s+/).find((w) => w.length >= 4);
  return [k.name, erstesWort].filter((x): x is string => !!x).map(norm);
}

export const VERSICHERER = /versicherung|versicherer|assekuranz|vvag|haftpflicht|allianz|ergo|huk|axa|r\+v|debeka|devk|provinzial|signal iduna|generali|zurich|arag|roland|d\.a\.s\.|advocard|auxilia/i;

/** Treffer der Fremdgeld-Regel – passt zur Treffer-Struktur des Bankabgleichs. */
export interface FremdgeldTreffer {
  transaktionId: string;
  art: "fremdgeld";
  regel: "fremdgeld";
  sicherheit: number;
  akteId: string;
  grund: string;
}

/**
 * Regel „Zahlung eines Dritten für die Mandantschaft = Fremdgeld“ (§ 43a Abs. 7 BRAO): Ein Zahler, der nicht die Mandantschaft
 * ist (z. B. ein Versicherer), zahlt auf eine offene Akte – Aktenzeichen oder Schadennummer stehen im Verwendungszweck.
 */
export function fremdgeldTreffer(t: Transaktion, akten: Akte[], kontakteById: Map<string, Kontakt>): FremdgeldTreffer | undefined {
  if (t.betrag <= 0) return undefined;
  const vz = norm(t.verwendungszweck);
  const gp = norm(t.gegenpartei);
  for (const a of akten) {
    if (a.status === "abgeschlossen") continue;
    const az = new RegExp(`(^|[^\\d])${escapeRe(a.aktenzeichen)}($|[^\\d])`).test(vz);
    const schaden = !!a.rsv?.schadennummer && vz.includes(norm(a.rsv.schadennummer));
    if (!az && !schaden) continue;
    const mandant = kontakteById.get(a.mandantId);
    const vomMandanten = namensTeile(mandant).some((n) => gp.includes(n));
    if (vomMandanten) continue;
    const dritter = VERSICHERER.test(t.gegenpartei) || /schaden/i.test(t.verwendungszweck) || (a.gegnerId ? namensTeile(kontakteById.get(a.gegnerId)).some((n) => gp.includes(n)) : false);
    if (!dritter) continue;
    return {
      transaktionId: t.id,
      art: "fremdgeld",
      regel: "fremdgeld",
      sicherheit: 0.85,
      akteId: a.id,
      grund: `Zahlung eines Dritten (${t.gegenpartei}) für ${mandant?.name ?? "die Mandantschaft"} – ${schaden ? `Schadennummer ${a.rsv?.schadennummer}` : `Aktenzeichen ${a.aktenzeichen}`} im Verwendungszweck: Fremdgeld, an die Mandantschaft weiterzuleiten`,
    };
  }
  return undefined;
}


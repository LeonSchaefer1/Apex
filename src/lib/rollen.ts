// Personen- und Rollenbezeichnungen: je Person genau ein passender Begriff statt „Partner/in“ oder „ReFa“.
import type { Ansprechpartner, Kontakt, Rolle, User } from "@/core/types";

type Form = "w" | "m";

/** Grammatisches Geschlecht aus der Berufsbezeichnung („Rechtsanwältin“, „Rechtsanwaltsfachangestellte“ → w); unbekannt → undefined. */
export function formAusTitel(titel: string | undefined): Form | undefined {
  const erstes = (titel ?? "").split("·")[0].trim().toLowerCase();
  if (!erstes) return undefined;
  if (/(in|angestellte|kauffrau)$/.test(erstes)) return "w";
  return "m";
}

const ROLLE_FORM: Record<Rolle, { w: string; m: string; neutral: string }> = {
  partner: { w: "Partnerin", m: "Partner", neutral: "Partnerin/Partner" },
  anwalt: { w: "Rechtsanwältin", m: "Rechtsanwalt", neutral: "Rechtsanwältin/Rechtsanwalt" },
  refa: { w: "Fachangestellte", m: "Fachangestellter", neutral: "Fachangestellte/-r" },
  admin: { w: "Administration", m: "Administration", neutral: "Administration" },
};

/** Rolle einer bestimmten Person – „Partnerin“, „Rechtsanwalt“, „Fachangestellte“ … */
export function rollenLabel(u: Pick<User, "rolle" | "titel">): string {
  const f = ROLLE_FORM[u.rolle] ?? ROLLE_FORM.anwalt;
  const form = formAusTitel(u.titel);
  return form ? f[form] : f.neutral;
}

/** Auswahl-/Spaltenbezeichnung einer Rolle ohne bestimmte Person (z. B. im Einladungsdialog). */
export const ROLLE_AUSWAHL: Record<Rolle, string> = {
  partner: ROLLE_FORM.partner.neutral,
  anwalt: ROLLE_FORM.anwalt.neutral,
  refa: ROLLE_FORM.refa.neutral,
  admin: ROLLE_FORM.admin.neutral,
};

/** Kurze Spaltenköpfe für die Rechte-Tabelle – Funktionsbezeichnungen ohne Abkürzungen wie „ReFa“. */
export const ROLLE_SPALTE: Record<Rolle, string> = { partner: "Partner", anwalt: "Anwälte", refa: "Fachangestellte", admin: "Administration" };

type MitBezeichnung = Ansprechpartner & { bezeichnung?: "Ansprechpartner" | "Ansprechpartnerin" };

/** „Ansprechpartnerin“ oder „Ansprechpartner“ – aus dem Feld `bezeichnung`, sonst aus der hinterlegten Rolle. */
export function ansprechBezeichnung(ap: MitBezeichnung): "Ansprechpartner" | "Ansprechpartnerin" {
  if (ap.bezeichnung) return ap.bezeichnung;
  return /ansprechpartnerin/i.test(ap.rolle) ? "Ansprechpartnerin" : "Ansprechpartner";
}

/** „Ihre feste Ansprechpartnerin“ / „Ihr fester Ansprechpartner“; `ohneIhr` → „Feste Ansprechpartnerin“ / „Fester Ansprechpartner“. */
export function festeAnsprechperson(ap: MitBezeichnung, opts: { ohneIhr?: boolean } = {}): string {
  const b = ansprechBezeichnung(ap);
  const w = b === "Ansprechpartnerin";
  if (opts.ohneIhr) return `${w ? "Feste" : "Fester"} ${b}`;
  return `${w ? "Ihre feste" : "Ihr fester"} ${b}`;
}

/** „Mandantin“ oder „Mandant“ nach Anrede; Unternehmen gelten als „Mandantin“ (die Gesellschaft). */
export function mandantBezeichnung(k: Pick<Kontakt, "typ" | "anrede"> | undefined): "Mandant" | "Mandantin" {
  if (!k) return "Mandant";
  if (k.anrede === "Frau" || k.typ === "organisation") return "Mandantin";
  return "Mandant";
}

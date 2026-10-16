// Personen- und Rollenbezeichnungen: je Person genau ein passender Begriff statt „Partner/in“ oder „ReFa“.
import type { Ansprechpartner, Kontakt, Rolle, User } from "@/core/types";

type Form = "w" | "m";

/**
 * Grammatisches Geschlecht aus der Berufsbezeichnung („Rechtsanwältin“, „Rechtsanwaltsfachangestellte“ → w); unbekannt → undefined.
 * Doppelformen mit Schrägstrich („Rechtsanwaltsfachangestellte/r“, „Rechtsanwältin / Rechtsanwalt“) gelten als neutral (undefined).
 */
export function formAusTitel(titel: string | undefined): Form | undefined {
  const erstes = (titel ?? "").split("·")[0].trim().toLowerCase();
  if (!erstes) return undefined;
  if (erstes.includes("/") || /\(r\)|\(in\)|innen\b|\*in\b|:in\b/.test(erstes)) return undefined;
  if (/(in|angestellte|kauffrau|auszubildende)$/.test(erstes)) return "w";
  return "m";
}

/** Form einer Person: zuerst die hinterlegte Anrede, sonst die Berufsbezeichnung. */
export function formVon(u: Pick<User, "titel"> & { anrede?: User["anrede"] }): Form | undefined {
  if (u.anrede === "Frau") return "w";
  if (u.anrede === "Herr") return "m";
  return formAusTitel(u.titel);
}

/** „Dr. Julia Hartmann“ → „Dr. Hartmann“ (akademischer Grad bleibt, Vorname entfällt). */
export function nachnameMitGrad(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const grade: string[] = [];
  while (teile.length > 1 && /^(Dr\.|Prof\.|Dr\.-Ing\.|Dipl\.-[A-Za-zä]+\.|LL\.M\.)$/.test(teile[0])) grade.push(teile.shift()!);
  // Namenszusätze („von Berg“, „van der Meer“) gehören zum Nachnamen
  const zusatz = teile.findIndex((t, i) => i > 0 && /^(von|van|de|der|den|zu|vom|zur|da|di|le|la)$/.test(t));
  const nachname = zusatz > 0 ? teile.slice(zusatz).join(" ") : teile[teile.length - 1] ?? "";
  return [...grade, nachname].join(" ");
}

/** Förmliche Anrede einer Person: „Frau Dr. Hartmann“ / „Herr Brandt“ – ohne bestimmbare Anrede der volle Name („Claudia Reinholz“). */
export function foermlicherName(u: Pick<User, "name" | "titel"> & { anrede?: User["anrede"] }): string {
  const f = formVon(u);
  if (!f) return u.name;
  return `${f === "w" ? "Frau" : "Herr"} ${nachnameMitGrad(u.name)}`;
}

/** Briefanrede: „Sehr geehrte Frau Dr. Hartmann,“ / „Sehr geehrter Herr Brandt,“ / „Guten Tag Claudia Reinholz,“. */
export function briefAnrede(u: Pick<User, "name" | "titel"> & { anrede?: User["anrede"] }): string {
  const f = formVon(u);
  if (f === "w") return `Sehr geehrte Frau ${nachnameMitGrad(u.name)},`;
  if (f === "m") return `Sehr geehrter Herr ${nachnameMitGrad(u.name)},`;
  return `Guten Tag ${u.name},`;
}

/** Tagesgruß im Cockpit und im Assistenten: „Guten Morgen, Frau Dr. Hartmann“. */
export function gruss(u: Pick<User, "name" | "titel"> & { anrede?: User["anrede"] }, stunde = new Date().getHours()): string {
  const zeit = stunde < 11 ? "Guten Morgen" : stunde < 18 ? "Guten Tag" : "Guten Abend";
  return `${zeit}, ${foermlicherName(u)}`;
}

/** „Hauptnutzerin“ / „Hauptnutzer“ / „Hauptnutzerin bzw. Hauptnutzer“ nach Anrede. */
export function hauptnutzerBegriff(u: Pick<User, "titel"> & { anrede?: User["anrede"] }): string {
  const f = formVon(u);
  return f === "w" ? "Hauptnutzerin" : f === "m" ? "Hauptnutzer" : "Hauptnutzerin bzw. Hauptnutzer";
}

const ROLLE_FORM: Record<Rolle, { w: string; m: string; neutral: string }> = {
  partner: { w: "Partnerin", m: "Partner", neutral: "Partnerin/Partner" },
  anwalt: { w: "Rechtsanwältin", m: "Rechtsanwalt", neutral: "Rechtsanwältin/Rechtsanwalt" },
  refa: { w: "Fachangestellte", m: "Fachangestellter", neutral: "Fachangestellte/-r" },
  admin: { w: "Administration", m: "Administration", neutral: "Administration" },
  azubi: { w: "Auszubildende", m: "Auszubildender", neutral: "Auszubildende/-r" },
};

/** Rolle einer bestimmten Person – „Partnerin“, „Rechtsanwalt“, „Fachangestellte“, „Auszubildende“ … (Anrede vor Titel). */
export function rollenLabel(u: Pick<User, "rolle" | "titel"> & { anrede?: User["anrede"] }): string {
  const f = ROLLE_FORM[u.rolle] ?? ROLLE_FORM.anwalt;
  const form = formVon(u);
  return form ? f[form] : f.neutral;
}

/** Auswahl-/Spaltenbezeichnung einer Rolle ohne bestimmte Person (z. B. im Einladungsdialog). */
export const ROLLE_AUSWAHL: Record<Rolle, string> = {
  partner: ROLLE_FORM.partner.neutral,
  anwalt: ROLLE_FORM.anwalt.neutral,
  refa: ROLLE_FORM.refa.neutral,
  admin: ROLLE_FORM.admin.neutral,
  azubi: ROLLE_FORM.azubi.neutral,
};

/** Kurze Spaltenköpfe für die Rechte-Tabelle – Funktionsbezeichnungen ohne Abkürzungen wie „ReFa“. */
export const ROLLE_SPALTE: Record<Rolle, string> = { partner: "Partner", anwalt: "Anwälte", refa: "Fachangestellte", admin: "Administration", azubi: "Auszubildende" };

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

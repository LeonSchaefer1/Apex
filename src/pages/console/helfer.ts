// Apex Console – Hilfsfunktionen (Kopieren, Einladungstext, Vorschläge).
import { toast } from "@/store/ui";
import { DEMO_TENANTS } from "@/core/seed/tenants";
import { diffDays, fmtDate, today } from "@/core/dates";
import type { Bundesland, Sachgebiet, Tenant, User } from "@/core/types";
import { bundeslandAusOrt } from "@/core/feiertage";
import { ansprechBezeichnung, briefAnrede, hauptnutzerBegriff, rollenLabel } from "@/lib/rollen";

export const SACHGEBIETE: Sachgebiet[] = ["Arbeitsrecht", "Mietrecht", "Verkehrsrecht", "Familienrecht", "Erbrecht", "Strafrecht", "Forderungseinzug", "Vertragsrecht", "Baurecht", "Verwaltungsrecht"];

/** Fest eingebaute Präsentationskanzleien – können zurückgesetzt, aber nicht gelöscht werden. */
export const DEMO_IDS = new Set(DEMO_TENANTS.map((t) => t.tenant.id));

/** Zugänge der eingebauten Beispielkanzleien – ihr Passwort lässt sich auf das öffentliche Demo-Passwort zurücksetzen. */
export const DEMO_NUTZER_IDS = new Set(DEMO_TENANTS.flatMap((t) => t.users.map((u) => u.id)));

/** Bundesland zur Stadt – über die Ortsliste des Fristenrechners (src/core/feiertage.ts), z. B. „Paderborn“ → NW. Unbekannt → undefined. */
export function landFuerStadt(stadt: string): Bundesland | undefined {
  return stadt.trim() ? bundeslandAusOrt(stadt) : undefined;
}

export async function kopieren(text: string, was = "Text") {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (ok) toast(`${was} kopiert`, { text: "In der Zwischenablage – jetzt einfügen.", ton: "erfolg" });
  else toast("Kopieren nicht möglich", { text: "Bitte markieren Sie den Text und kopieren Sie ihn manuell (Strg/⌘ + C).", ton: "warnung" });
}

/** Hinweis statt einer kaputten Adresse (Artefakt-Vorschau, Datei-Aufruf, Sandbox ohne eigenen Ursprung). */
export const LOGIN_URL_HINWEIS = "Ihre persönliche Anmeldeadresse erhalten Sie mit der Einrichtung.";

/**
 * Anmeldeadresse für Einladungen und Zugangsdaten – `null`, wenn diese Ansicht keine echte Web-Adresse hat
 * (z. B. Artefakt: origin „null“, Memory-Router) und auch keine öffentliche Adresse konfiguriert ist (VITE_PUBLIC_URL).
 */
export function loginUrl(): string | null {
  const oeffentlich = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim().replace(/\/+$/, "");
  const memory = (import.meta.env.VITE_ROUTER as string | undefined) === "memory";
  let origin = "";
  try {
    origin = window.location.origin;
  } catch {
    origin = "";
  }
  if (!memory && /^https?:\/\/[^/]+$/i.test(origin)) return `${origin}/login`;
  if (oeffentlich && /^https?:\/\//i.test(oeffentlich)) return `${oeffentlich}/login`;
  return null;
}

/** Zeile „Anmeldung: …“ für Einladungs- und Zugangsdatentexte. */
export function anmeldeZeile(): string {
  const url = loginUrl();
  return url ? `Anmeldung: ${url}` : LOGIN_URL_HINWEIS;
}

/**
 * Vollständige Einladung (beim Anlegen, nach einem neuen Startpasswort und auf jeder Kundenkarte gleich): Anmeldeadresse,
 * E-Mail, Ansprechpartnerin mit Durchwahl, Testende – aber kein Passwort. Das Startpasswort geht getrennt (Telefon/SMS).
 */
export function einladungsText(p: { tenant: Tenant; user: User; hauptnutzer?: boolean; beispieldaten?: boolean; neuesPasswort?: boolean }) {
  const { tenant, user } = p;
  const ap = tenant.ansprechpartner;
  const bez = ansprechBezeichnung(ap);
  const ihre = bez === "Ansprechpartnerin" ? "Ihre feste Ansprechpartnerin" : "Ihren festen Ansprechpartner";
  const rolle = rollenLabel(user) + (p.hauptnutzer ? ` (${hauptnutzerBegriff(user)} der Kanzlei)` : "");
  return [
    p.neuesPasswort ? "Betreff: Ihr Zugang zu Apex – neues Startpasswort" : "Betreff: Ihr Testzugang zu Apex",
    "",
    briefAnrede(user),
    "",
    p.neuesPasswort
      ? `für Ihren Zugang zu Apex (${tenant.name}) wurde ein neues Startpasswort vergeben. Das bisherige Passwort ist nicht mehr gültig.`
      : `vielen Dank für Ihr Interesse an Apex. Ihr persönlicher Testzugang für ${tenant.name} ist eingerichtet${p.beispieldaten ? " – mit Beispielakten, damit Sie Fristen, Posteingang, KI-Fallanalyse und 38h-Motor sofort ausprobieren können" : ""}.`,
    "",
    anmeldeZeile(),
    `E-Mail: ${user.email}`,
    `Ihre Rolle: ${rolle}`,
    "Ihr Startpasswort erhalten Sie getrennt – telefonisch oder per SMS.",
    "Bei der ersten Anmeldung legen Sie ein eigenes Passwort fest.",
    "",
    tenant.status === "test" && tenant.testBis ? `Ihr Testzugang ist bis zum ${fmtDate(tenant.testBis)} freigeschaltet.` : tenant.status === "test" ? "Ihr Testzugang ist ab sofort und ohne festes Enddatum freigeschaltet." : "Ihr Zugang ist ab sofort freigeschaltet.",
    "Die Daten Ihrer Kanzlei sind strikt von allen anderen Kanzleien getrennt. Der Anbieter sieht keine Akteninhalte. Ein neues Startpasswort vergibt er nur auf Ihren Wunsch; jeder solche Vorgang steht in Ihrem Protokoll.",
    "",
    `Bei Fragen erreichen Sie ${ihre} ${ap.name} direkt unter ${ap.telefon} oder ${ap.email} (${ap.verfuegbar}).`,
    "",
    "Mit freundlichen Grüßen",
    "Ihr Apex-Team",
  ].join("\n");
}

export function testStatus(t: Tenant): { text: string; ton: "seal" | "amber" | "neutral" | "green" } | null {
  if (!t.testBis) return null;
  const n = diffDays(today(), t.testBis);
  if (n < 0) return { text: `abgelaufen seit ${fmtDate(t.testBis)}`, ton: "seal" };
  if (n === 0) return { text: "läuft heute ab", ton: "seal" };
  if (n <= 7) return { text: `noch ${n} ${n === 1 ? "Tag" : "Tage"}`, ton: "amber" };
  return { text: `noch ${n} Tage`, ton: "neutral" };
}

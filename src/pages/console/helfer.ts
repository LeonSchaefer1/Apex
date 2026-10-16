// Apex Console – Hilfsfunktionen (Kopieren, Einladungstext, Vorschläge).
import { toast } from "@/store/ui";
import { DEMO_TENANTS } from "@/core/seed/tenants";
import { diffDays, fmtDate, today } from "@/core/dates";
import type { Bundesland, Sachgebiet, Tenant, User } from "@/core/types";

export const SACHGEBIETE: Sachgebiet[] = ["Arbeitsrecht", "Mietrecht", "Verkehrsrecht", "Familienrecht", "Erbrecht", "Strafrecht", "Forderungseinzug", "Vertragsrecht", "Baurecht", "Verwaltungsrecht"];

/** Fest eingebaute Präsentationskanzleien – können zurückgesetzt, aber nicht gelöscht werden. */
export const DEMO_IDS = new Set(DEMO_TENANTS.map((t) => t.tenant.id));

/** Zugänge der eingebauten Beispielkanzleien – ihr Passwort lässt sich auf das öffentliche Demo-Passwort zurücksetzen. */
export const DEMO_NUTZER_IDS = new Set(DEMO_TENANTS.flatMap((t) => t.users.map((u) => u.id)));

const STADT_LAND: Record<string, Bundesland> = {
  berlin: "BE", potsdam: "BB", hamburg: "HH", bremen: "HB", bremerhaven: "HB", münchen: "BY", muenchen: "BY", nürnberg: "BY", nuernberg: "BY", augsburg: "BY", regensburg: "BY", würzburg: "BY",
  stuttgart: "BW", karlsruhe: "BW", mannheim: "BW", freiburg: "BW", heidelberg: "BW", ulm: "BW", köln: "NW", koeln: "NW", düsseldorf: "NW", duesseldorf: "NW", dortmund: "NW", essen: "NW",
  bonn: "NW", münster: "NW", bielefeld: "NW", aachen: "NW", duisburg: "NW", bochum: "NW", wuppertal: "NW", frankfurt: "HE", "frankfurt am main": "HE", wiesbaden: "HE", kassel: "HE", darmstadt: "HE",
  hannover: "NI", braunschweig: "NI", oldenburg: "NI", osnabrück: "NI", göttingen: "NI", leipzig: "SN", dresden: "SN", chemnitz: "SN", erfurt: "TH", jena: "TH", weimar: "TH", magdeburg: "ST", halle: "ST",
  rostock: "MV", schwerin: "MV", kiel: "SH", lübeck: "SH", flensburg: "SH", mainz: "RP", koblenz: "RP", trier: "RP", ludwigshafen: "RP", saarbrücken: "SL", saarbruecken: "SL",
};

export function landFuerStadt(stadt: string): Bundesland | undefined {
  return STADT_LAND[stadt.trim().toLowerCase()];
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

export function einladungsText(p: { tenant: Tenant; admin: User; passwort: string; beispieldaten: boolean }) {
  const { tenant, admin, passwort } = p;
  const ap = tenant.ansprechpartner;
  return [
    "Betreff: Ihr Testzugang zu AnwaltApex",
    "",
    `Guten Tag ${admin.name},`,
    "",
    `vielen Dank für Ihr Interesse an AnwaltApex. Ihr persönlicher Testzugang für ${tenant.name} ist eingerichtet${p.beispieldaten ? " – mit Beispielakten, damit Sie Fristen, Posteingang, KI-Fallanalyse und 38h-Motor sofort erleben können" : ""}.`,
    "",
    anmeldeZeile(),
    `E-Mail: ${admin.email}`,
    `Passwort: ${passwort}`,
    "",
    tenant.testBis ? `Ihr Testzugang ist bis zum ${fmtDate(tenant.testBis)} freigeschaltet.` : "Ihr Testzugang ist ab sofort freigeschaltet.",
    "Die Daten Ihrer Kanzlei sind strikt von allen anderen Kanzleien getrennt – nur Ihr Team hat Zugriff.",
    "",
    `Bei Fragen erreichen Sie ${ap.rolle.replace(/^Ihr fester /, "Ihren festen ").replace(/^Ihr persönlicher /, "Ihren persönlichen ")} ${ap.name} direkt unter ${ap.telefon} oder ${ap.email} (${ap.verfuegbar}).`,
    "",
    "Mit freundlichen Grüßen",
    "Ihr AnwaltApex-Team",
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

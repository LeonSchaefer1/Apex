// Datenschutz-Auskunft (Art. 15 DSGVO) und Datenexport (Art. 20 DSGVO) zu einem Kontakt, Löschsperre nach § 50 BRAO,
// Kollisionsprüfung für ein neues Mandat. Reine Funktionen ohne React – die Oberfläche liegt in KontaktDrawer.tsx.
import type { Akte, Dokument, Kontakt, Nachricht, Tenant } from "@/core/types";
import { fmtDate } from "@/core/dates";
import { aktenVonKontakt, kollisionFuerNeuesMandat, loeschSperre, type BeteiligtenRolle } from "@/core/kontaktpruefung";
import { kontaktAdresse, ROLLE_LABEL } from "./kontaktHelfer";
// Löschsperre und Kollisionsprüfung liegen in src/core/kontaktpruefung.ts (mit Tests) – hier für bestehende Importe weitergereicht.
export { kollisionFuerNeuesMandat, loeschSperre };

export interface AuskunftAkte {
  aktenzeichen: string;
  titel: string;
  rolle: BeteiligtenRolle;
  von: string;
  bis: string;
  status: Akte["status"];
}

export interface Auskunft {
  erstelltAm: string;
  verantwortlicher: { name: string; anschrift: string };
  person: {
    name: string;
    art: "Person" | "Organisation";
    anrede?: string;
    email?: string;
    telefon?: string;
    anschrift?: string;
    safeId?: string;
    angelegtAm: string;
    rollen: string[];
  };
  akten: AuskunftAkte[];
  dokumente: { titel: string; datum: string; akte: string }[];
  nachrichten: { betreff: string; datum: string; kanal: string; richtung: string; akte?: string }[];
  zwecke: string[];
  empfaenger: string[];
  herkunft: string;
  speicherdauer: string;
  rechte: string;
  pruefhinweis: string;
}

const PRUEFHINWEIS =
  "Vor Herausgabe auf Rechte Dritter und das Mandatsgeheimnis prüfen (Art. 15 Abs. 4 DSGVO, § 43a Abs. 2 BRAO) – insbesondere bei Gegnern und Dritten: Angaben aus der Handakte des Mandanten nur, soweit die Verschwiegenheit nicht entgegensteht.";

/** „Konflikt: Gegner in 142/26 (Weber ./. Kröger Logistik GmbH)“ */
export function kollisionsText(k: Kontakt, akten: Akte[], als: "mandant" | "gegner"): { konflikt: boolean; text: string } {
  const { konflikte, frueher } = kollisionFuerNeuesMandat(k, akten, als);
  const liste = (l: { akte: Akte; rolle: BeteiligtenRolle }[]) => l.map((x) => `${x.rolle} in ${x.akte.aktenzeichen} (${x.akte.titel})`).join("; ");
  if (konflikte.length) return { konflikt: true, text: `Konflikt: ${liste(konflikte)}${frueher.length ? ` · früher: ${liste(frueher)}` : ""}` };
  return {
    konflikt: false,
    text: `Keine widerstreitende Rolle für „${als === "mandant" ? "Mandant" : "Gegner"}“ gefunden${frueher.length ? ` – in abgeschlossenen Akten: ${liste(frueher)} (gleicher Lebenssachverhalt?)` : ""}`,
  };
}

/** Nachrichten mit Bezug zum Kontakt: Absender-/Empfängeradresse oder Name, bei Mandanten auch alle Nachrichten ihrer Akten. */
function nachrichtenZu(k: Kontakt, nachrichten: Nachricht[], mandantAkten: Set<string>): Nachricht[] {
  const mail = k.email?.trim().toLowerCase();
  const name = k.name.trim().toLowerCase();
  return nachrichten.filter(
    (n) =>
      (mail && (n.vonAdresse?.trim().toLowerCase() === mail || n.an.toLowerCase().includes(mail))) ||
      n.von.trim().toLowerCase() === name ||
      n.an.toLowerCase().includes(name) ||
      (n.akteId && mandantAkten.has(n.akteId)),
  );
}

export function erstelleAuskunft(k: Kontakt, daten: { akten: Akte[]; dokumente: Dokument[]; nachrichten: Nachricht[] }, tenant: Pick<Tenant, "name" | "adresse">, heute: string): Auskunft {
  const verknuepft = aktenVonKontakt(k, daten.akten);
  const mandantAkten = new Set(verknuepft.filter((x) => x.rolle === "Mandant").map((x) => x.akte.id));
  const aktenIds = new Map(verknuepft.map((x) => [x.akte.id, x]));
  const name = k.name.trim().toLowerCase();
  const nachname = (k.nachname ?? "").trim().toLowerCase();
  const dokumente = daten.dokumente
    .filter((d) => {
      const x = aktenIds.get(d.akteId);
      if (!x) return false;
      if (x.rolle === "Mandant") return true;
      const t = `${d.name}\n${d.inhalt}`.toLowerCase();
      return t.includes(name) || (nachname.length > 3 && t.includes(nachname));
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const nachrichten = nachrichtenZu(k, daten.nachrichten, mandantAkten).sort((a, b) => a.eingang.localeCompare(b.eingang));
  const istMandant = verknuepft.some((x) => x.rolle === "Mandant") || k.rollen.includes("mandant");
  const nurDritter = !istMandant;
  const sperre = loeschSperre(k, daten.akten);
  const azVon = (id: string) => daten.akten.find((a) => a.id === id)?.aktenzeichen ?? "–";

  return {
    erstelltAm: heute,
    verantwortlicher: { name: tenant.name, anschrift: tenant.adresse },
    person: {
      name: k.name,
      art: k.typ === "person" ? "Person" : "Organisation",
      anrede: k.anrede || undefined,
      email: k.email,
      telefon: k.telefon,
      anschrift: kontaktAdresse(k) || undefined,
      safeId: k.safeId,
      angelegtAm: k.createdAt.slice(0, 10),
      rollen: k.rollen.map((r) => ROLLE_LABEL[r]),
    },
    akten: verknuepft.map(({ akte, rolle }) => ({
      aktenzeichen: akte.aktenzeichen,
      titel: akte.titel,
      rolle,
      von: akte.createdAt.slice(0, 10),
      bis: akte.status === "abgeschlossen" ? akte.abgeschlossenAm ?? akte.updatedAt.slice(0, 10) : "laufend",
      status: akte.status,
    })),
    dokumente: dokumente.map((d) => ({ titel: d.name, datum: d.createdAt.slice(0, 10), akte: azVon(d.akteId) })),
    nachrichten: nachrichten.map((n) => ({
      betreff: n.betreff,
      datum: n.eingang.slice(0, 10),
      kanal: n.kanal === "bea" ? "beA" : "E-Mail",
      richtung: n.richtung === "ein" ? "eingegangen" : "versandt",
      akte: n.akteId ? azVon(n.akteId) : undefined,
    })),
    zwecke: [
      ...(istMandant ? ["Durchführung des Mandats und Vertretung Ihrer rechtlichen Interessen (Art. 6 Abs. 1 lit. b DSGVO)"] : []),
      ...(nurDritter || verknuepft.some((x) => x.rolle !== "Mandant")
        ? ["Wahrnehmung der rechtlichen Interessen unserer Mandanten, z. B. Korrespondenz und Verfahren, an denen Sie beteiligt sind (Art. 6 Abs. 1 lit. f DSGVO)"]
        : []),
      "Erfüllung berufs- und steuerrechtlicher Pflichten, u. a. Aktenführung und Aufbewahrung (§ 50 BRAO), Geldwäschegesetz, Abgabenordnung (Art. 6 Abs. 1 lit. c DSGVO)",
    ],
    empfaenger: [
      "Gerichte, Behörden und Schiedsstellen – soweit für das Verfahren erforderlich",
      "Gegenseite und deren Bevollmächtigte – soweit für die Sache erforderlich",
      "Rechtsschutz- und Haftpflichtversicherer – bei Deckungsanfragen",
      "IT-Dienstleister als Auftragsverarbeiter (Art. 28 DSGVO), z. B. Hosting der Kanzleisoftware in Deutschland",
    ],
    herkunft: istMandant ? "Von Ihnen selbst sowie aus Schreiben von Gerichten, Behörden und der Gegenseite." : "Aus Angaben unserer Mandanten, aus Schreiben von Gerichten und Behörden sowie aus Ihrer Korrespondenz mit uns (Art. 14 DSGVO).",
    speicherdauer: sperre.gesperrt
      ? `Die Handakte bewahren wir nach § 50 Abs. 1 BRAO sechs Jahre nach Ablauf des Kalenderjahres auf, in dem der Auftrag beendet wurde. ${sperre.abDatum ? `Frühester Löschzeitpunkt: ${fmtDate(sperre.abDatum)}.` : "Die Frist beginnt mit Abschluss der laufenden Akten."}`
      : "Es besteht kein Aktenbezug – die Daten können auf Verlangen gelöscht werden (Art. 17 DSGVO).",
    rechte:
      "Sie haben das Recht auf Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO).",
    pruefhinweis: PRUEFHINWEIS,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const d = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? fmtDate(iso) : iso);

/** Druckbares HTML der Auskunft – papierweiß, schwarz, ohne externe Ressourcen. */
export function auskunftHtml(a: Auskunft): string {
  const zeile = (label: string, wert?: string) => (wert ? `<tr><th>${esc(label)}</th><td>${esc(wert)}</td></tr>` : "");
  const tabelle = (kopf: string[], zeilen: string[][]) =>
    zeilen.length
      ? `<table class="liste"><thead><tr>${kopf.map((k) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${zeilen.map((z) => `<tr>${z.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : "<p>Keine Einträge.</p>";
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Auskunft nach Art. 15 DSGVO – ${esc(a.person.name)}</title>
<style>
  body { font: 12px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; background: #fff; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
  table.stamm th { width: 32%; font-weight: 600; }
  .hinweis { border: 2px solid #000; padding: 8px 10px; margin: 12px 0; }
  ul { margin: 4px 0; padding-left: 18px; }
  @page { size: A4; margin: 15mm; }
</style>
</head>
<body>
<h1>Auskunft nach Art. 15 DSGVO</h1>
<p>${esc(a.verantwortlicher.name)} · ${esc(a.verantwortlicher.anschrift)}<br>Erstellt am ${d(a.erstelltAm)} – betrifft: <strong>${esc(a.person.name)}</strong></p>
<div class="hinweis"><strong>Interner Prüfhinweis:</strong> ${esc(a.pruefhinweis)}</div>
<h2>1. Gespeicherte Stammdaten</h2>
<table class="stamm"><tbody>
${zeile("Name", a.person.name)}${zeile("Art", a.person.art)}${zeile("Anrede", a.person.anrede)}${zeile("E-Mail", a.person.email)}${zeile("Telefon", a.person.telefon)}${zeile("Anschrift", a.person.anschrift)}${zeile("beA SAFE-ID", a.person.safeId)}${zeile("Gespeichert seit", d(a.person.angelegtAm))}${zeile("Rollen", a.person.rollen.join(", "))}
</tbody></table>
<h2>2. Verknüpfte Akten</h2>
${tabelle(["Az.", "Bezeichnung", "Ihre Rolle", "Zeitraum"], a.akten.map((x) => [x.aktenzeichen, x.titel, x.rolle, `${d(x.von)} – ${d(x.bis)}`]))}
<h2>3. Dokumente mit Bezug zu Ihrer Person</h2>
${tabelle(["Datum", "Titel", "Akte"], a.dokumente.map((x) => [d(x.datum), x.titel, x.akte]))}
<h2>4. Nachrichten</h2>
${tabelle(["Datum", "Betreff", "Weg", "Akte"], a.nachrichten.map((x) => [d(x.datum), x.betreff, `${x.kanal}, ${x.richtung}`, x.akte ?? "–"]))}
<h2>5. Zwecke und Rechtsgrundlagen</h2>
<ul>${a.zwecke.map((z) => `<li>${esc(z)}</li>`).join("")}</ul>
<h2>6. Empfänger</h2>
<ul>${a.empfaenger.map((z) => `<li>${esc(z)}</li>`).join("")}</ul>
<h2>7. Herkunft der Daten</h2>
<p>${esc(a.herkunft)}</p>
<h2>8. Speicherdauer</h2>
<p>${esc(a.speicherdauer)}</p>
<h2>9. Ihre Rechte</h2>
<p>${esc(a.rechte)}</p>
<p>Eine Kopie der Daten in maschinenlesbarer Form (Art. 20 DSGVO) stellen wir auf Wunsch als JSON-Datei bereit.</p>
</body>
</html>
`;
}

/** Maschinenlesbarer Export (Art. 20 DSGVO) – ohne internen Prüfhinweis. */
export function auskunftJson(a: Auskunft): string {
  const { pruefhinweis: _intern, ...rest } = a;
  void _intern;
  return `${JSON.stringify({ format: "AnwaltApex Datenexport (Art. 20 DSGVO)", version: 1, ...rest }, null, 2)}\n`;
}

/** Dateiname „Auskunft_Art15_Thomas-Weber_2026-10-16.html“ */
export function auskunftDateiname(a: Auskunft, endung: "html" | "json"): string {
  const name = a.person.name.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${endung === "html" ? "Auskunft_Art15" : "Datenexport_Art20"}_${name}_${a.erstelltAm}.${endung}`;
}

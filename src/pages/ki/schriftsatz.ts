// Schriftsatz-Assistent: Vorlagen für den Offline-Betrieb und Prompt für die Live-KI.
// Grundsatz: keine erfundenen Tatsachen – was in der Akte fehlt, wird als [Platzhalter] markiert.
import { addDays, fmtDate, fmtDateLong, fmtEUR, today } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import { berechneRvg, fassungFuerAuftrag } from "@/core/rvg";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import type { Akte, Bundesland, Dokument, Kontakt, Tenant, TenantData, User } from "@/core/types";
import { akteAlsText, findePraezedenzfaelle } from "@/ai/kontext";
import { zitat } from "@/pages/falldb/recherche";

export type SchriftsatzArt = "sachstand" | "deckung" | "aufforderung" | "klageerwiderung" | "replik" | "kosten";
export type Ton = "sachlich" | "verbindlich";

export const SCHRIFTSATZ_ARTEN: { key: SchriftsatzArt; titel: string; label: string; kurz: string; ordner: "Korrespondenz" | "Schriftsätze" }[] = [
  { key: "sachstand", titel: "Mandantenanschreiben „Sachstand“", label: "Sachstand", kurz: "Verständlicher Zwischenstand für die Mandantschaft", ordner: "Korrespondenz" },
  { key: "deckung", titel: "Deckungsanfrage Rechtsschutz", label: "Deckungsanfrage", kurz: "Anfrage an die Rechtsschutzversicherung mit Sachverhalt", ordner: "Korrespondenz" },
  { key: "aufforderung", titel: "Aufforderungsschreiben an Gegner", label: "Aufforderung", kurz: "Außergerichtliche Aufforderung mit Fristsetzung", ordner: "Korrespondenz" },
  { key: "klageerwiderung", titel: "Klageerwiderung (Gerüst)", label: "Klageerwiderung", kurz: "Anträge, Gliederung und Beweisangebote als Gerüst", ordner: "Schriftsätze" },
  { key: "replik", titel: "Replik (Gerüst)", label: "Replik", kurz: "Stellungnahme der Klagepartei zur Klageerwiderung", ordner: "Schriftsätze" },
  { key: "kosten", titel: "Kostenvoranschlag / Honorarhinweis", label: "Kostenhinweis", kurz: "Gebührenschätzung nach RVG und Hinweis nach § 49b Abs. 5 BRAO", ordner: "Korrespondenz" },
];

export function artInfo(art: SchriftsatzArt) {
  return SCHRIFTSATZ_ARTEN.find((a) => a.key === art)!;
}

export type Parteirolle = "klaeger" | "beklagter";

/**
 * Parteirolle der Mandantschaft im Zivilprozess – aus den Dokumenten der E-Akte (wer hat die Klage bzw. die
 * Klageerwiderung geschrieben?), aus Fristen („Replik auf Klageerwiderung“) und aus dem Sachverhalt.
 * `undefined`, wenn die Akte es nicht hergibt.
 */
export function mandantRolle(akte: Akte, data: TenantData): Parteirolle | undefined {
  if (akte.sachgebiet === "Strafrecht" || akte.sachgebiet === "Familienrecht") return undefined;
  const doks = data.dokumente.filter((d) => d.akteId === akte.id);
  const eigen = (d: (typeof doks)[number]) => d.quelle === "generiert" || !!d.autorId;
  if (doks.some((d) => /klageerwiderung/i.test(d.name) && !eigen(d))) return "klaeger";
  if (doks.some((d) => /klageschrift/i.test(d.name) && eigen(d))) return "klaeger";
  if (doks.some((d) => /klageschrift/i.test(d.name) && !eigen(d))) return "beklagter";
  if (doks.some((d) => /klageerwiderung/i.test(d.name) && eigen(d))) return "beklagter";
  if (data.fristen.some((f) => f.akteId === akte.id && /(replik|stellungnahme) (auf|zur) (die )?klageerwiderung/i.test(f.titel))) return "klaeger";
  const t = `${akte.titel} ${akte.beschreibung}`.toLowerCase();
  if (/verklagt|räumungsklage gegen|klage gegen (unsere|den|die) mandant/.test(t)) return "beklagter";
  if (/\bklage auf\b|\bklagt\b|restwerklohnklage|kündigungsschutzklage|rückzahlung der mietkaution/.test(t)) return "klaeger";
  // Typische Konstellationen: Gläubigerin im Forderungseinzug, Arbeitnehmer gegen Arbeitgeberin
  if (akte.sachgebiet === "Forderungseinzug") return "klaeger";
  const m = kontakt(data, akte.mandantId);
  const g = kontakt(data, akte.gegnerId);
  if (akte.sachgebiet === "Arbeitsrecht" && m?.typ === "person" && g?.typ === "organisation") return "klaeger";
  return undefined;
}

/** Die passenden Dokumentarten für eine Akte: Klagt die Mandantschaft, ersetzt die Replik die Klageerwiderung. */
export function artenFuer(akte: Akte | undefined, data: TenantData) {
  const klaeger = !!akte && mandantRolle(akte, data) === "klaeger";
  return SCHRIFTSATZ_ARTEN.filter((a) => (klaeger ? a.key !== "klageerwiderung" : a.key !== "replik"));
}

/** Titel einer Entscheidung in Klammern – ohne doppelte Anführungszeichen („„Emmely“ – …“). */
export function titelInKlammern(titel: string): string {
  return titel.includes("„") ? `(${titel})` : `(„${titel}“)`;
}

interface Kontext {
  akte: Akte;
  data: TenantData;
  tenant: Tenant;
  user: User;
}

function kontakt(data: TenantData, id?: string): Kontakt | undefined {
  return id ? data.kontakte.find((k) => k.id === id) : undefined;
}

function anrede(k?: Kontakt): string {
  if (!k || k.typ === "organisation") return "Sehr geehrte Damen und Herren,";
  const name = k.nachname ?? k.name.split(" ").pop();
  if (k.anrede === "Herr") return `Sehr geehrter Herr ${name},`;
  if (k.anrede === "Frau") return `Sehr geehrte Frau ${name},`;
  return `Guten Tag ${k.name},`;
}

function anschrift(k: Kontakt | undefined, fallback: string): string {
  if (!k) return `[${fallback}]\n[Anschrift]`;
  const zeilen = [k.name, k.strasse ?? "[Straße]", k.plz && k.ort ? `${k.plz} ${k.ort}` : "[PLZ Ort]"];
  return zeilen.join("\n");
}

/** Versicherungsnehmer im Akkusativ – mit bekannter Anrede statt „Versicherungsnehmerin bzw. Versicherungsnehmer“. */
function versicherungsnehmer(k?: Kontakt): string {
  if (!k) return "Ihre Versicherungsnehmerin bzw. Ihren Versicherungsnehmer, [Name],";
  if (k.typ === "organisation") return `Ihre Versicherungsnehmerin, die ${k.name},`;
  if (k.anrede === "Herr") return `Ihren Versicherungsnehmer, Herrn ${k.name},`;
  if (k.anrede === "Frau") return `Ihre Versicherungsnehmerin, Frau ${k.name},`;
  return `Ihre Versicherungsnehmerin bzw. Ihren Versicherungsnehmer, ${k.name},`;
}

/** Die Mandantschaft im Fließtext: „Herrn Thomas Weber“ / „Frau …“ / Firmenname. */
function mandantAkkusativ(k?: Kontakt): string {
  if (!k) return "[Mandantschaft]";
  if (k.anrede === "Herr") return `Herrn ${k.name}`;
  if (k.anrede === "Frau") return `Frau ${k.name}`;
  return k.name;
}

function naechsterWerktag(iso: string, land: Bundesland): string {
  let d = iso;
  for (let i = 0; i < 10 && !istWerktag(d, land); i++) d = addDays(d, 1);
  return d;
}

function ort(tenant: Tenant): string {
  return tenant.stadt || "[Ort]";
}

function gruss(ton: Ton, kollegial = false): string {
  if (kollegial) return "Mit freundlichen kollegialen Grüßen";
  return ton === "verbindlich" ? "Mit besten Grüßen" : "Mit freundlichen Grüßen";
}

function signatur(user: User): string {
  return `${user.name}\n${user.titel}`;
}

const PHASE_TEXT: Record<string, string> = {
  Mandatsaufnahme: "Wir haben Ihre Unterlagen gesichtet und die Angelegenheit rechtlich geprüft.",
  Außergerichtlich: "Wir stehen derzeit in außergerichtlichem Austausch mit der Gegenseite.",
  Gerichtlich: "Das Verfahren ist bei Gericht anhängig.",
  Beweisaufnahme: "Das Gericht ist in die Beweisaufnahme eingetreten.",
  Urteil: "Es liegt eine gerichtliche Entscheidung vor, die wir für Sie ausgewertet haben.",
  Vollstreckung: "Wir betreiben die Zwangsvollstreckung aus dem vorliegenden Titel.",
  Abgeschlossen: "Die Angelegenheit ist abgeschlossen.",
};

/** Zitierfähige Entscheidungen: zuerst die an die Akte gehefteten, sonst die besten Treffer der Fall-Datenbank. */
export function gepruefteQuellen(akte: Akte, data: TenantData, n = 2): { zitat: string; titel: string; geheftet: boolean }[] {
  const geheftet = (akte.entscheidungen ?? []).map((id) => ENTSCHEIDUNGEN.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  const liste = geheftet.length ? geheftet.map((e) => ({ e, geheftet: true })) : findePraezedenzfaelle(akte, data, n).map((t) => ({ e: t.entscheidung, geheftet: false }));
  return liste.slice(0, n).map(({ e, geheftet: g }) => ({ zitat: zitat(e), titel: e.titel, geheftet: g }));
}

/** Entwurf ohne Live-KI: solide Vorlage, befüllt mit den Daten der Akte. */
export function entwurfOffline(art: SchriftsatzArt, ton: Ton, hinweise: string, k: Kontext): string {
  const { akte, data, tenant, user } = k;
  const mandant = kontakt(data, akte.mandantId);
  const gegner = kontakt(data, akte.gegnerId);
  const gegneranwalt = kontakt(data, akte.gegneranwaltId);
  const gericht = kontakt(data, akte.gerichtId);
  const heute = today();
  const kopf = `${ort(tenant)}, ${fmtDateLong(heute)}`;
  const zeichen = `Unser Zeichen: ${akte.aktenzeichen}`;
  const fristen = data.fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && f.typ !== "wiedervorlage").sort((a, b) => a.datum.localeCompare(b.datum));
  const hinweisAbsatz = hinweise.trim() ? `\n[Berücksichtigen: ${hinweise.trim()}]\n` : "";
  const v = ton === "verbindlich";

  switch (art) {
    case "sachstand": {
      const fristZeilen = fristen
        .filter((f) => f.typ !== "vorfrist")
        .slice(0, 4)
        .map((f) => `• ${f.titel}: ${fmtDate(f.datum)}${f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""}${f.grundlage ? ` (${f.grundlage})` : ""}`);
      const rsv = akte.rsv
        ? akte.rsv.deckung === "erteilt"
          ? `Ihre Rechtsschutzversicherung (${akte.rsv.versicherung}) hat die Kostendeckung erteilt${akte.rsv.selbstbeteiligung ? `; die vereinbarte Selbstbeteiligung beträgt ${fmtEUR(akte.rsv.selbstbeteiligung)}` : ""}.`
          : akte.rsv.deckung === "abgelehnt"
            ? `Ihre Rechtsschutzversicherung (${akte.rsv.versicherung}) hat die Deckung abgelehnt. [Weiteres Vorgehen zur Deckung besprechen]`
            : akte.rsv.deckung === "offen"
              ? `Die Deckungszusage Ihrer Rechtsschutzversicherung (${akte.rsv.versicherung}) fragen wir an; wir informieren Sie, sobald sie vorliegt.`
              : `Die Deckungszusage Ihrer Rechtsschutzversicherung (${akte.rsv.versicherung}) haben wir angefragt; wir informieren Sie, sobald sie vorliegt.`
        : "";
      return [
        anschrift(mandant, "Mandantschaft"),
        "",
        kopf,
        zeichen,
        "",
        `**Sachstand in Ihrer Angelegenheit ${akte.titel}**`,
        "",
        anrede(mandant),
        "",
        v
          ? "vielen Dank für Ihr Vertrauen. Gern möchte ich Sie auf den aktuellen Stand bringen – damit Sie jederzeit wissen, wo wir stehen und was als Nächstes geschieht."
          : "hiermit informieren wir Sie über den aktuellen Stand Ihrer Angelegenheit.",
        "",
        "**1. Ausgangslage**",
        akte.beschreibung,
        "",
        "**2. Aktueller Stand**",
        `${PHASE_TEXT[akte.phase] ?? ""}${gericht ? (akte.gerichtsAz ? ` Das Verfahren wird beim ${gericht.name} unter dem Aktenzeichen ${akte.gerichtsAz} geführt.` : ` Zuständiges Gericht: ${gericht.name}.`) : ""}`.trim(),
        rsv,
        ...(fristZeilen.length ? ["", "Folgende Fristen und Termine haben wir für Sie notiert und überwachen sie:", ...fristZeilen] : []),
        "",
        "**3. Nächste Schritte**",
        "[Nächste Schritte ergänzen – z. B. Einreichung der Klage, Stellungnahme an das Gericht, Vergleichsgespräch]",
        hinweisAbsatz,
        v
          ? "Wenn Sie Fragen haben oder etwas unklar ist, rufen Sie mich gern an – ich nehme mir Zeit für Sie."
          : "Für Rückfragen stehen wir Ihnen gern zur Verfügung.",
        "",
        gruss(ton),
        "",
        signatur(user),
      ]
        .filter((z, i, a) => !(z === "" && a[i - 1] === ""))
        .join("\n");
    }

    case "deckung": {
      const rsv = akte.rsv;
      const kuendigung = /kündigung/i.test(`${akte.titel} ${akte.beschreibung}`);
      const massnahme =
        akte.sachgebiet === "Arbeitsrecht" && kuendigung
          ? `Erhebung einer Kündigungsschutzklage${gericht ? ` vor dem ${gericht.name}` : ""} und außergerichtliche Interessenwahrnehmung`
          : akte.phase === "Gerichtlich" || akte.phase === "Beweisaufnahme"
            ? `Vertretung im gerichtlichen Verfahren${gericht ? ` vor dem ${gericht.name}` : ""}${akte.gerichtsAz ? ` (Az. ${akte.gerichtsAz})` : ""}`
            : "außergerichtliche Interessenwahrnehmung und, falls erforderlich, gerichtliche Geltendmachung in erster Instanz";
      const eilig = fristen.find((f) => f.typ === "notfrist" || f.typ === "frist");
      return [
        rsv ? `${rsv.versicherung}\n[Anschrift der Versicherung]` : "[Rechtsschutzversicherung]\n[Anschrift]",
        "",
        kopf,
        zeichen,
        "",
        `${mandant?.typ === "organisation" || mandant?.anrede === "Frau" ? "Versicherungsnehmerin" : "Versicherungsnehmer"}: ${mandant?.name ?? "[Name]"}`,
        `Versicherungsnummer: ${rsv?.versicherungsnummer ?? "[Versicherungsnummer]"}`,
        `Schadennummer: ${rsv?.schadennummer ?? "[falls bereits vergeben]"}`,
        "",
        `**Deckungsanfrage – ${akte.titel}**`,
        "",
        "Sehr geehrte Damen und Herren,",
        "",
        `wir zeigen an, dass wir ${versicherungsnehmer(mandant)} in der oben genannten Angelegenheit vertreten. Eine Vollmacht liegt uns vor.`,
        "",
        "**Sachverhalt**",
        akte.beschreibung,
        "",
        "**Beabsichtigte Maßnahmen**",
        `${massnahme}.`,
        "",
        `Gegenstandswert: ${akte.gegenstandswert ? fmtEUR(akte.gegenstandswert) : "[Gegenstandswert]"} [Berechnung prüfen]`,
        "",
        `Wir bitten um Erteilung der Deckungszusage für die außergerichtliche und die erstinstanzliche gerichtliche Tätigkeit.${eilig ? ` Wegen der laufenden Frist (${eilig.titel} bis ${fmtDate(eilig.datum)}) bitten wir um kurzfristige Bearbeitung.` : ""}`,
        "",
        "Die maßgeblichen Unterlagen fügen wir bei: [Anlagen benennen].",
        hinweisAbsatz,
        v ? "Für Ihre zügige Rückmeldung danken wir Ihnen bereits im Voraus." : "",
        "",
        gruss(ton),
        "",
        signatur(user),
      ]
        .filter((z, i, a) => !(z === "" && a[i - 1] === ""))
        .join("\n");
    }

    case "aufforderung": {
      const empf = gegneranwalt ?? gegner;
      const kollege = !!gegneranwalt;
      const fristBis = naechsterWerktag(addDays(heute, 14), tenant.bundesland);
      const forderung = akte.forderung
        ? `zur Zahlung von ${fmtEUR(akte.forderung.hauptforderung)} nebst Zinsen in Höhe von ${akte.forderung.verbraucher ? "5" : "9"} Prozentpunkten über dem jeweiligen Basiszinssatz seit dem ${fmtDate(akte.forderung.faelligAb)}`
        : "[konkrete Forderung – z. B. Zahlung von … €, Rücknahme der Kündigung, Herausgabe …]";
      return [
        anschrift(empf, "Gegenseite"),
        "",
        kopf,
        zeichen,
        "",
        `**${akte.titel}**`,
        "",
        kollege ? "Sehr geehrte Kolleginnen und Kollegen," : anrede(gegner),
        "",
        `wir zeigen an, dass wir ${mandantAkkusativ(mandant)} anwaltlich vertreten. Eine auf uns lautende Vollmacht ${kollege ? "versichern wir anwaltlich" : "fügen wir bei"}.`,
        "",
        "Unserer Mandantschaft liegt folgender Sachverhalt zugrunde:",
        akte.beschreibung,
        "",
        "[Rechtliche Würdigung: Anspruchsgrundlage und Begründung in zwei bis drei Sätzen ergänzen]",
        "",
        `Namens und in Vollmacht unserer Mandantschaft fordern wir ${kollege ? "Ihre Mandantschaft" : "Sie"} auf, ${forderung} bis spätestens`,
        "",
        `**${fmtDate(fristBis)}**`,
        "",
        "(Eingang bei uns) nachzukommen.",
        "",
        v
          ? "Wir sind zuversichtlich, dass sich die Angelegenheit außergerichtlich klären lässt, und stehen für ein Gespräch gern zur Verfügung. Sollte die Frist jedoch ungenutzt verstreichen, werden wir unserer Mandantschaft empfehlen, gerichtliche Hilfe in Anspruch zu nehmen."
          : "Sollte die Frist fruchtlos verstreichen, werden wir unserer Mandantschaft empfehlen, ohne weitere Ankündigung gerichtliche Hilfe in Anspruch zu nehmen. Die hierdurch entstehenden Kosten wären von Ihrer Seite zu tragen.",
        hinweisAbsatz,
        gruss(ton, kollege),
        "",
        signatur(user),
      ]
        .filter((z, i, a) => !(z === "" && a[i - 1] === ""))
        .join("\n");
    }

    case "klageerwiderung": {
      const quellen = gepruefteQuellen(akte, data, 2);
      return [
        gericht ? `An das\n${gericht.name}\n${gericht.strasse ?? "[Anschrift]"}${gericht.plz ? `\n${gericht.plz} ${gericht.ort ?? ""}` : ""}` : "An das\n[Gericht]\n[Anschrift]",
        "",
        kopf,
        "",
        `Az.: ${akte.gerichtsAz ?? "[Gerichtsaktenzeichen]"}`,
        "",
        "**Klageerwiderung**",
        "",
        "In dem Rechtsstreit",
        "",
        `${gegner?.name ?? "[Klagepartei]"}`,
        `– Klagepartei –${gegneranwalt ? `, Prozessbevollmächtigte: ${gegneranwalt.name}` : ""}`,
        "",
        "gegen",
        "",
        `${mandant?.name ?? "[Beklagtenpartei]"}`,
        `– Beklagtenpartei –, Prozessbevollmächtigte: ${tenant.name}`,
        "",
        "zeigen wir die Vertretung der Beklagtenpartei an. Wir werden beantragen:",
        "",
        "1. Die Klage wird abgewiesen.",
        "2. Die Klagepartei trägt die Kosten des Rechtsstreits.",
        "[3. Ggf. Vollstreckungsschutzantrag nach § 712 ZPO]",
        "",
        "**Begründung**",
        "",
        "**I. Sachverhalt**",
        akte.beschreibung,
        "[Sachverhalt aus Sicht der Beklagtenpartei darstellen; streitige Tatsachen ausdrücklich bestreiten]",
        "",
        "**II. Rechtliche Würdigung**",
        "1. [Zulässigkeit: Zuständigkeit, Rechtsschutzbedürfnis]",
        "2. [Begründetheit: Anspruchsgrundlage der Klagepartei und Einwendungen der Beklagtenpartei]",
        ...(quellen.length
          ? ["", "Zur Rechtslage verweisen wir auf:", ...quellen.map((q) => `• ${q.zitat} ${titelInKlammern(q.titel)}${q.geheftet ? "" : " [Fundstelle prüfen]"}`)]
          : []),
        "",
        "**III. Beweisangebote**",
        "[Zeugen, Urkunden, Sachverständigengutachten – Anlagen B 1 ff.]",
        hinweisAbsatz,
        "Beglaubigte und einfache Abschrift anbei.",
        "",
        signatur(user),
      ]
        .filter((z, i, a) => !(z === "" && a[i - 1] === ""))
        .join("\n");
    }

    case "replik": {
      const quellen = gepruefteQuellen(akte, data, 2);
      const erwiderung = data.dokumente
        .filter((d) => d.akteId === akte.id && /klageerwiderung/i.test(d.name) && d.quelle !== "generiert" && !d.autorId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const aufrechnung = data.dokumente.some((d) => d.akteId === akte.id && /aufrechn|aufgerechnet/i.test(d.inhalt));
      return [
        gericht ? `An das\n${gericht.name}\n${gericht.strasse ?? "[Anschrift]"}${gericht.plz ? `\n${gericht.plz} ${gericht.ort ?? ""}` : ""}` : "An das\n[Gericht]\n[Anschrift]",
        "",
        kopf,
        "",
        `Az.: ${akte.gerichtsAz ?? "[Gerichtsaktenzeichen]"}`,
        "",
        "**Replik**",
        "",
        "In dem Rechtsstreit",
        "",
        `${mandant?.name ?? "[Klagepartei]"}`,
        `– Klagepartei –, Prozessbevollmächtigte: ${tenant.name}`,
        "",
        "gegen",
        "",
        `${gegner?.name ?? "[Beklagtenpartei]"}`,
        `– Beklagtenpartei –${gegneranwalt ? `, Prozessbevollmächtigte: ${gegneranwalt.name}` : ""}`,
        "",
        `nehmen wir zur Klageerwiderung ${erwiderung ? `vom ${fmtDate(erwiderung.createdAt.slice(0, 10))}` : "[vom Datum]"} wie folgt Stellung. Die Klagepartei hält an ihren Anträgen aus der Klageschrift fest.`,
        "",
        "**I. Zum Vorbringen der Beklagtenpartei**",
        "[Einwendungen der Klageerwiderung einzeln aufgreifen; streitige Tatsachen ausdrücklich bestreiten und mit Beweisangebot versehen]",
        ...(aufrechnung ? ["[Zur Hilfsaufrechnung: Gegenforderung dem Grunde und der Höhe nach bestreiten]"] : []),
        "",
        "**II. Rechtliche Würdigung**",
        akte.beschreibung,
        "[Rechtliche Würdigung ergänzen]",
        ...(quellen.length
          ? ["", "Zur Rechtslage verweisen wir auf:", ...quellen.map((q) => `• ${q.zitat} ${titelInKlammern(q.titel)}${q.geheftet ? "" : " [Fundstelle prüfen]"}`)]
          : []),
        "",
        "**III. Beweisangebote**",
        "[Zeugen, Urkunden, Sachverständigengutachten – Anlagen K … ff.]",
        hinweisAbsatz,
        "Beglaubigte und einfache Abschrift anbei.",
        "",
        signatur(user),
      ]
        .filter((z, i, a) => !(z === "" && a[i - 1] === ""))
        .join("\n");
    }

    case "kosten": {
      const wert = akte.gegenstandswert || 0;
      // Übergangsrecht § 60 RVG: maßgeblich ist der Tag der Auftragserteilung (z. B. bei übernommenen Altakten)
      const fassung = fassungFuerAuftrag(akte.createdAt.slice(0, 10));
      const aussergerichtlich = wert ? berechneRvg({ positionen: [{ nr: "2300" }], gegenstandswert: wert, fassung }) : null;
      const gerichtlich = wert ? berechneRvg({ positionen: [{ nr: "3100" }, { nr: "3104" }], gegenstandswert: wert, fassung }) : null;
      const zeile = (titel: string, betrag: number) => `• ${titel}: ${fmtEUR(betrag)}`;
      const arbeitsrecht = akte.sachgebiet === "Arbeitsrecht";
      return [
        anschrift(mandant, "Mandantschaft"),
        "",
        kopf,
        zeichen,
        "",
        `**Kostenhinweis und voraussichtliche Gebühren – ${akte.titel}**`,
        "",
        anrede(mandant),
        "",
        v
          ? "Transparenz ist uns wichtig. Deshalb erhalten Sie vorab einen Überblick über die voraussichtlichen Kosten Ihrer Angelegenheit."
          : "nachfolgend erhalten Sie eine Übersicht über die voraussichtlichen Kosten Ihrer Angelegenheit.",
        "",
        "Nach § 49b Abs. 5 BRAO weisen wir darauf hin, dass sich die Gebühren nach dem Gegenstandswert richten (Rechtsanwaltsvergütungsgesetz, RVG).",
        `Gegenstandswert: ${wert ? fmtEUR(wert) : "[Gegenstandswert]"}`,
        `Gebührentabelle: ${fassung === "2025" ? "RVG in der Fassung ab 01.06.2025" : "RVG in der bis 31.05.2025 geltenden Fassung (Auftrag vor dem 01.06.2025, § 60 RVG)"}`,
        "",
        ...(aussergerichtlich && gerichtlich
          ? [
              "**Außergerichtliche Vertretung**",
              zeile("1,3 Geschäftsgebühr Nr. 2300 VV RVG", aussergerichtlich.zeilen[0].betrag),
              zeile("Auslagenpauschale Nr. 7002 VV RVG", aussergerichtlich.auslagenpauschale),
              zeile("19 % Umsatzsteuer Nr. 7008 VV RVG", aussergerichtlich.ust),
              `• Summe: ${fmtEUR(aussergerichtlich.brutto)}`,
              "",
              "**Gerichtliches Verfahren, erste Instanz**",
              zeile("1,3 Verfahrensgebühr Nr. 3100 VV RVG", gerichtlich.zeilen[0].betrag),
              zeile("1,2 Terminsgebühr Nr. 3104 VV RVG", gerichtlich.zeilen[1].betrag),
              zeile("Auslagenpauschale Nr. 7002 VV RVG", gerichtlich.auslagenpauschale),
              zeile("19 % Umsatzsteuer Nr. 7008 VV RVG", gerichtlich.ust),
              `• Summe: ${fmtEUR(gerichtlich.brutto)}`,
              "",
              "Bei einer Einigung kann zusätzlich eine Einigungsgebühr (Nr. 1000 ff. VV RVG) entstehen. Wird nach außergerichtlicher Tätigkeit Klage erhoben, wird die Geschäftsgebühr zur Hälfte, höchstens mit 0,75, auf die Verfahrensgebühr angerechnet (Vorbem. 3 Abs. 4 VV RVG). Gerichtskosten und Auslagen Dritter kommen gegebenenfalls hinzu.",
            ]
          : ["[Gebührenberechnung ergänzen – Gegenstandswert in der Akte hinterlegen]"]),
        ...(arbeitsrecht
          ? ["", "**Wichtiger Hinweis nach § 12a Abs. 1 S. 2 ArbGG:** Im arbeitsgerichtlichen Urteilsverfahren erster Instanz trägt jede Partei ihre Anwaltskosten selbst – auch im Fall des Obsiegens; eine Kostenerstattung findet nicht statt (§ 12a Abs. 1 S. 1 ArbGG)."]
          : []),
        ...(akte.rsv
          ? ["", `Ihre Rechtsschutzversicherung (${akte.rsv.versicherung}) ${akte.rsv.deckung === "erteilt" ? "hat die Deckung erteilt" : akte.rsv.deckung === "offen" ? "wird um Deckung gebeten" : "ist angefragt"}${akte.rsv.selbstbeteiligung ? `; Ihre Selbstbeteiligung beträgt ${fmtEUR(akte.rsv.selbstbeteiligung)}` : ""}.`]
          : []),
        hinweisAbsatz,
        "Die Angaben sind eine unverbindliche Schätzung auf Grundlage des derzeitigen Sachstands.",
        "",
        gruss(ton),
        "",
        signatur(user),
      ]
        .filter((z, i, a) => !(z === "" && a[i - 1] === ""))
        .join("\n");
    }
  }
}

/** Prompt für die Live-KI (Claude). */
export function entwurfPrompt(art: SchriftsatzArt, ton: Ton, hinweise: string, k: Kontext): { system: string; user: string } {
  const { akte, data, tenant, user } = k;
  const quellen = gepruefteQuellen(akte, data, 3);
  const system = [
    "Du bist eine erfahrene Rechtsanwältin bzw. ein erfahrener Rechtsanwalt in Deutschland und entwirfst Schreiben und Schriftsätze für die eigene Kanzlei.",
    "Regeln:",
    "- Verwende ausschließlich Tatsachen aus der Akte. Erfinde keine Tatsachen, Daten, Beträge, Namen, Aktenzeichen oder Fundstellen.",
    "- Wo Angaben fehlen, setze einen Platzhalter in eckigen Klammern, z. B. [Anschrift der Versicherung].",
    "- Zitiere Rechtsprechung nur aus der Liste „Geprüfte Entscheidungen“ – wörtlich in der dort angegebenen Zitierweise.",
    "- Berechne keine Fristen selbst; übernimm nur Fristen, die in der Akte stehen.",
    "- Schreibe korrektes, klares Deutsch im Stil einer deutschen Kanzlei. Kein Markdown außer **Fettdruck** für Betreff und Zwischenüberschriften.",
    "- Gib nur den Brieftext aus (Anschrift, Ort/Datum, Zeichen, Betreff, Anrede, Text, Grußformel, Unterschrift) – ohne Einleitung oder Erläuterung davor oder danach.",
  ].join("\n");
  const rolle = mandantRolle(akte, data);
  const user_ = [
    `Dokumentart: ${artInfo(art).titel} – ${artInfo(art).kurz}.`,
    art === "klageerwiderung" || art === "replik"
      ? `Parteirolle der Mandantschaft: ${rolle === "klaeger" ? "Klagepartei" : rolle === "beklagter" ? "Beklagtenpartei" : "geht aus der Akte nicht hervor – Parteibezeichnungen als [Platzhalter]"}.`
      : "",
    `Tonalität: ${ton === "sachlich" ? "sachlich, präzise und knapp" : "verbindlich, freundlich-zugewandt, aber juristisch präzise"}.`,
    hinweise.trim() ? `Zusätzliche Anweisungen der Anwältin/des Anwalts: ${hinweise.trim()}` : "",
    "",
    `Kanzlei: ${tenant.name}, ${tenant.adresse}`,
    `Unterzeichnet von: ${user.name}, ${user.titel}`,
    `Datum: ${fmtDateLong(today())}, Ort: ${tenant.stadt}`,
    "",
    "Geprüfte Entscheidungen (nur diese dürfen zitiert werden):",
    quellen.length ? quellen.map((q) => `- ${q.zitat} ${titelInKlammern(q.titel)}`).join("\n") : "- keine",
    "",
    "Akte:",
    akteAlsText(akte, data, 5),
  ]
    .filter((z) => z !== "")
    .join("\n");
  return { system, user: user_ };
}

/** Name ohne Datum – erkennt frühere Fassungen desselben Schreibens an denselben Empfänger (gleicher Typ, gleicher Empfänger). */
export function dokumentBasisName(art: SchriftsatzArt, akte: Akte, data: TenantData): string {
  const mandant = kontakt(data, akte.mandantId)?.name;
  const versicherung = akte.rsv?.versicherung;
  switch (art) {
    case "sachstand":
      return `Sachstandsmitteilung an ${mandant ?? "Mandantschaft"}`;
    case "deckung":
      return `Deckungsanfrage ${versicherung ?? "Rechtsschutz"}`;
    case "aufforderung":
      return `Aufforderungsschreiben an ${kontakt(data, akte.gegneranwaltId ?? akte.gegnerId)?.name ?? "Gegenseite"}`;
    case "klageerwiderung":
      return "Klageerwiderung";
    case "replik":
      return "Replik";
    case "kosten":
      return "Kostenhinweis nach § 49b Abs. 5 BRAO";
  }
}

/** Name eines neuen KI-Entwurfs: „Deckungsanfrage Nordlicht Rechtsschutz AG (Entwurf vom 16.10.2026)“. */
export function dokumentName(art: SchriftsatzArt, akte: Akte, data: TenantData): string {
  return `${dokumentBasisName(art, akte, data)} (Entwurf vom ${fmtDate(today())})`;
}

/** Frühere, noch nicht versandte Fassung desselben Schreibens in der Akte (neueste Version) – dann Version statt Dublette. */
export function fruehereFassung(art: SchriftsatzArt, akte: Akte, data: TenantData): Dokument | undefined {
  const basis = dokumentBasisName(art, akte, data).toLowerCase();
  return data.dokumente
    .filter((d) => d.akteId === akte.id && d.quelle === "generiert" && d.status !== "versandt" && d.name.toLowerCase().startsWith(basis))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version)[0];
}

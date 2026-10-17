// Präsentationsfälle („Hero-Akten") – in sich stimmige Geschichten für die Live-Demo.
import { AUTOMATION_DEFS } from "../automationen";
import { addDays, fmtDate, fmtDateLong, round2 } from "../dates";
import { berechneNachRegel } from "../fristen";
import { berechneRvg, fassungFuerAuftrag } from "../rvg";
import type { Akte, Aktivitaet, Dokument, Frist, Kontakt } from "../types";
import { addDok, addFrist, addMsg, addRechnung, addRegelFrist, fristVerantwortung, nextAz, type Ctx } from "./generate";
import { GERICHTSANSCHRIFTEN, STAEDTE } from "./pools";

function akte(ctx: Ctx, a: Omit<Akte, "id" | "updatedAt"> & { updatedAt?: string }): Akte {
  const full: Akte = { id: `hero-${ctx.id("a")}`, updatedAt: a.updatedAt ?? a.createdAt, ...a };
  ctx.data.akten.push(full);
  return full;
}

/** Zeitpunkt + Minuten (für Einträge in der Vergangenheit, z. B. „kurz nach Aktenanlage“). */
function plusMin(zeit: string, min: number): string {
  const d = new Date(`${zeit.slice(0, 19)}Z`);
  d.setUTCMinutes(d.getUTCMinutes() + min);
  return d.toISOString().slice(0, 19);
}

type VerlaufEintrag = { zeit: string; akteur: Aktivitaet["akteur"]; text: string; key?: string; userId?: string };

/** Fester, zur Geschichte passender Verlauf einer Präsentationsakte (statt Zufallseinträgen). */
function verlauf(ctx: Ctx, a: Akte, eintraege: VerlaufEintrag[]) {
  for (const e of eintraege) {
    if (e.zeit < a.createdAt) continue;
    const def = e.key ? AUTOMATION_DEFS.find((x) => x.key === e.key) : undefined;
    ctx.data.aktivitaeten.push({
      id: ctx.id("ak"), zeit: e.zeit, akteur: e.akteur, akteId: a.id, text: e.text, userId: e.userId,
      automationKey: e.key, minutenGespart: e.akteur === "nutzer" ? undefined : def?.minutenProLauf,
    });
  }
}

// ───────────────────────── Berlin: Hartmann & Partner ─────────────────────────
export function heroesBerlin(ctx: Ctx) {
  const { d, dt, data } = ctx;
  const [julia, jonas] = ctx.anwaelte;
  const mia = ctx.refas[0];
  const G = STAEDTE.berlin.gerichte;

  // 1) Kündigungsschutz Weber – Flaggschiff für KI-Fallanalyse
  const weber = ctx.person(["mandant"], { vorname: "Thomas", nachname: "Weber", weiblich: false });
  weber.email = "thomas.weber@posteo.de";
  weber.telefon = "+49 176 2214 8830";
  weber.strasse = "Seestraße 41";
  weber.plz = "13353";
  const kroeger = ctx.firma("Kröger Logistik GmbH", ["gegner"], { strasse: "Am Juliusturm 12", plz: "13599", email: "personal@kroeger-logistik.de" });
  const arbg = ctx.gericht(G.arbg);
  const kuendDatum = d(-6);
  const zugang = d(-5);
  const a1 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 142), titel: "Weber ./. Kröger Logistik GmbH", sachgebiet: "Arbeitsrecht", phase: "Mandatsaufnahme", status: "offen",
    mandantId: weber.id, gegnerId: kroeger.id, gerichtId: arbg.id, gegenstandswert: 10200, bearbeiterId: julia.id, sachbearbeiterId: mia?.id,
    rsv: { versicherung: "Nordlicht Rechtsschutz AG", versicherungsnummer: "RS-4471209", schadennummer: `S${ctx.yy}-88412`, deckung: "offen", selbstbeteiligung: 150 },
    beschreibung: "Fristlose, hilfsweise ordentliche Kündigung nach 14 Jahren Betriebszugehörigkeit wegen Mitnahme von drei beschädigten, zur Entsorgung bestimmten Kaffeepackungen (Warenwert 8,97 €). Keine Abmahnung. Mandant (52, verheiratet, zwei Kinder) möchte den Arbeitsplatz behalten.",
    schlagworte: ["fristlose kündigung", "bagatelle", "geringwertig", "abmahnung", "interessenabwägung", "betriebszugehörigkeit", "kündigungsschutz", "emmely", "pfandbon"],
    prioritaet: "hoch", createdAt: dt(-2, 10, 12), updatedAt: dt(0, 8, 2), mandantenportal: true,
  });
  addDok(ctx, {
    akteId: a1.id, name: `Kündigungsschreiben vom ${fmtDate(kuendDatum)}`, art: "brief", ordner: "Mandant", quelle: "scan", seiten: 2, createdAt: dt(-2, 10, 40),
    inhalt: `Kröger Logistik GmbH · Am Juliusturm 12 · 13599 Berlin\n\nHerrn Thomas Weber\nSeestraße 41\n13353 Berlin\n\nBerlin, ${fmtDate(kuendDatum)}\n\nAußerordentliche, hilfsweise ordentliche Kündigung\n\nSehr geehrter Herr Weber,\n\nhiermit kündigen wir das mit Ihnen seit dem 01.04.2012 bestehende Arbeitsverhältnis außerordentlich und fristlos, hilfsweise ordentlich zum nächstmöglichen Termin.\n\nAm ${fmtDate(addDays(kuendDatum, -3))} haben Sie gegen 21:40 Uhr drei Packungen Röstkaffee (Warenwert insgesamt 8,97 €) aus dem Bereich „Bruchware“ des Lagers in Spandau an sich genommen und das Betriebsgelände damit verlassen. Damit haben Sie das in Sie gesetzte Vertrauen unwiederbringlich zerstört.\n\nDer Betriebsrat wurde vor Ausspruch der Kündigung angehört.\n\nWir fordern Sie auf, Ihren Werksausweis und den Spindschlüssel bis zum ${fmtDate(addDays(kuendDatum, 7))} zurückzugeben. Auf die Pflicht zur unverzüglichen Arbeitsuchendmeldung (§ 38 SGB III) weisen wir hin.\n\nMit freundlichen Grüßen\ni. A. Sandra Kröger, Personalleitung\n\nZugegangen per Bote am ${fmtDate(zugang)}.`,
    ki: { zusammenfassung: "Fristlose, hilfsweise ordentliche Kündigung wegen Mitnahme von Bruchware (8,97 €). Zugang per Bote.", erkannteFristen: 1 },
  });
  addDok(ctx, {
    akteId: a1.id, name: "Arbeitsvertrag vom 15.03.2012", art: "vertrag", ordner: "Mandant", quelle: "email", seiten: 6, createdAt: dt(0, 7, 41),
    inhalt: "Arbeitsvertrag zwischen der Kröger Logistik GmbH und Herrn Thomas Weber. Beginn: 01.04.2012. Tätigkeit: Lagerist / Kommissionierer, Lager Spandau. Bruttomonatsvergütung zuletzt 3.400 €. Arbeitszeit 40 Stunden/Woche im Schichtbetrieb. Kündigungsfristen nach § 622 BGB. Ausschlussfrist: drei Monate ab Fälligkeit.",
  });
  addDok(ctx, {
    akteId: a1.id, name: "Gesprächsnotiz Erstberatung", art: "notiz", ordner: "Mandant", quelle: "generiert", format: "docx", autorId: julia.id, createdAt: dt(-2, 11, 5),
    inhalt: `Erstberatung mit Herrn Weber am ${fmtDate(d(-2))} (Dauer 45 Min.).\n• 52 Jahre, verheiratet, zwei Kinder (14 und 17), seit 01.04.2012 bei Kröger Logistik, keine Abmahnungen, sehr gute Beurteilungen.\n• Die drei Packungen waren eingerissen und lagen im Container „Bruch – Entsorgung“. Laut Mandant nehmen Kollegen regelmäßig Bruchware mit; der Schichtleiter habe das mehrfach gesehen und geduldet.\n• Eine Anhörung des Mandanten vor der Kündigung fand nicht statt.\n• Ob und wann der Betriebsrat angehört wurde, ist unklar.\n• Rechtsschutzversicherung: Nordlicht Rechtsschutz AG, Vertrag seit 2016.\n• Ziel: Weiterbeschäftigung. Abfindung nur als zweite Option.\n• Vor Übernahme des Mandats darauf hingewiesen, dass sich die Gebühren nach dem Gegenstandswert richten (§ 49b Abs. 5 BRAO) und im ersten Rechtszug vor dem Arbeitsgericht keine Kostenerstattung stattfindet (§ 12a Abs. 1 S. 2 ArbGG) – Hinweisblatt gegengezeichnet.\n• Erste Einschätzung: Konstellation wie im „Emmely“-Fall (Kündigung wegen zweier Pfandbons über 1,30 €, BAG 2 AZR 541/09) – nach 14 Jahren ohne Abmahnung ist die fristlose Kündigung voraussichtlich unverhältnismäßig.`,
  });
  addDok(ctx, {
    akteId: a1.id, name: "Kostenhinweise vor Mandatsübernahme (§ 49b Abs. 5 BRAO, § 12a ArbGG)", art: "brief", ordner: "Mandant", quelle: "generiert", seiten: 1, createdAt: dt(-2, 10, 58),
    portal: { am: dt(-2, 11, 40), vonId: julia.id },
    inhalt: `Hinweise vor Übernahme des Mandats\n\nUnser Zeichen: 142/${ctx.yy} – Weber ./. Kröger Logistik GmbH\n\n1. Abrechnung nach dem Gegenstandswert (§ 49b Abs. 5 BRAO)\nDie für unsere Tätigkeit zu erhebenden Gebühren richten sich nach dem Gegenstandswert (§ 2 Abs. 1 RVG). Für die Kündigungsschutzklage beträgt er voraussichtlich drei Bruttomonatsentgelte (§ 42 Abs. 2 S. 1 GKG), für einen Weiterbeschäftigungsantrag kommt ein Bruttomonatsentgelt hinzu.\n\n2. Keine Kostenerstattung im ersten Rechtszug (§ 12a Abs. 1 S. 2 ArbGG)\nIm Urteilsverfahren des ersten Rechtszugs vor dem Arbeitsgericht trägt jede Partei ihre Anwaltskosten selbst – auch wenn sie den Prozess gewinnt. Ein Anspruch auf Erstattung der Kosten für die Hinzuziehung eines Prozessbevollmächtigten besteht nicht.\n\nBeide Hinweise wurden im Erstgespräch am ${fmtDate(d(-2))} vor Übernahme des Mandats erteilt.\n\nZur Kenntnis genommen:\nBerlin, den ${fmtDate(d(-2))}\n\nThomas Weber (digital gegengezeichnet)`,
  });
  addDok(ctx, { akteId: a1.id, name: "Vollmacht (digital unterzeichnet)", art: "vollmacht", ordner: "Mandant", quelle: "generiert", createdAt: dt(-2, 11, 30), inhalt: "Prozessvollmacht Thomas Weber für Hartmann & Partner Rechtsanwälte, digital unterzeichnet.", portal: { am: dt(-2, 11, 40), vonId: julia.id } });
  addDok(ctx, {
    // Brief an die Versicherung (kein Schriftsatz an ein Gericht) – Entwurf des 38h-Motors, Versand erst nach Freigabe
    akteId: a1.id, name: "Deckungsanfrage Nordlicht Rechtsschutz AG", art: "brief", status: "entwurf", ordner: "Korrespondenz", quelle: "generiert", format: "docx", createdAt: dt(-2, 11, 34),
    // Gegenstandswert mit denselben Antragsbestandteilen wie der KI-Klageentwurf (src/ai/fallanalyse.ts); der Aktenwert bleibt 10.200 € (I3-T19-01)
    inhalt: `Automatisch erstellte Deckungsanfrage für Versicherungsnehmer Thomas Weber (RS-4471209), Schaden-Nr. S${ctx.yy}-88412 (Schadenmeldung durch Ihren Versicherungsnehmer): Kündigungsschutzklage gegen die fristlose Kündigung der Kröger Logistik GmbH. Gegenstandswert: Kündigungsschutzantrag 10.200,00 € (drei Bruttomonatsentgelte à 3.400 €, § 42 Abs. 2 S. 1 GKG) + Weiterbeschäftigungsantrag 3.400,00 € = 13.600,00 €. Sachverhaltsschilderung und Kündigungsschreiben anbei.`,
  });
  addRegelFrist(ctx, a1, "kschg_klage", zugang, { quelle: "ki", kontrolliertVon: mia?.id, notiz: "Von der KI aus dem Kündigungsschreiben erkannt (Zugang per Bote)." });
  addFrist(ctx, { akteId: a1.id, titel: "Wiedervorlage: Deckungszusage Nordlicht", typ: "wiedervorlage", datum: ctx.werktag(3), verantwortlichId: mia?.id ?? julia.id, quelle: "automatisch" });
  data.notizen.push({ id: ctx.id("no"), akteId: a1.id, userId: julia.id, text: "Emmely-Rechtsprechung (BAG 2 AZR 541/09) passt sehr gut: lange ungestörte Betriebszugehörigkeit, geringer Wert. Duldung durch Schichtleiter klären – Zeugen benennen lassen.", zeit: dt(-2, 11, 12) });
  // Herkunft der Schadennummer (I3-T07-06): Der Versicherer vergibt sie mit der Schadenmeldung – hier durch den Mandanten selbst,
  // vor der Deckungsanfrage der Kanzlei. Feste IDs und Uhrzeiten, damit der übrige Bestand (Zähler, Zufallsfolge) unverändert bleibt.
  const schadenmeldung = `Schadenmeldung durch Herrn Weber telefonisch bei der Nordlicht Rechtsschutz AG am ${fmtDate(d(-3))} – Schaden-Nr. S${ctx.yy}-88412; Deckungsanfrage der Kanzlei noch nicht versandt`;
  data.notizen.push({ id: "hero-no-schadenmeldung", akteId: a1.id, userId: julia.id, text: `${schadenmeldung}. (Angabe des Mandanten in der Erstberatung)`, zeit: dt(-2, 11, 6) });
  data.aktivitaeten.push({ id: "hero-ak-schadenmeldung", zeit: dt(-2, 11, 7), akteur: "nutzer", userId: julia.id, akteId: a1.id, text: `Rechtsschutz erfasst – ${schadenmeldung} – ${a1.aktenzeichen}` });

  // 2) Mietrecht Schneider – Gerichtstermin
  const schneider = ctx.person(["mandant"], { vorname: "Katharina", nachname: "Schneider", weiblich: true });
  const lindenhof = ctx.firma("Lindenhof Hausverwaltung GmbH", ["gegner"]);
  const moeller = ctx.firma("Möller & Thiel Rechtsanwälte", ["gegneranwalt"]);
  const agCh = ctx.gericht("Amtsgericht Charlottenburg");
  const a2 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 137), titel: "Schneider ./. Lindenhof Hausverwaltung GmbH", sachgebiet: "Mietrecht", phase: "Gerichtlich", status: "offen",
    mandantId: schneider.id, gegnerId: lindenhof.id, gegneranwaltId: moeller.id, gerichtId: agCh.id, gerichtsAz: `211 C 148/${ctx.yy}`,
    gegenstandswert: 2850, bearbeiterId: jonas.id, sachbearbeiterId: mia?.id,
    rsv: { versicherung: "Spreebogen Rechtsschutz VVaG", versicherungsnummer: "RS-2290031", schadennummer: `S${ctx.yy}-41207`, deckung: "erteilt", selbstbeteiligung: 0 },
    beschreibung: "Klage auf Rückzahlung der Mietkaution (2.850 €). Die Vermieterin verrechnet Malerkosten; die Wohnung wurde 2019 unrenoviert übergeben (Übergabeprotokoll), ein Ausgleich wurde nicht gewährt.",
    schlagworte: ["kaution", "schönheitsreparaturen", "unrenoviert", "renovierung", "auszug", "formularklausel"],
    prioritaet: "normal", createdAt: dt(-74, 9, 30), updatedAt: dt(-1, 15, 2), mandantenportal: true,
  });
  addDok(ctx, { akteId: a2.id, name: "Mietvertrag vom 01.08.2019", art: "vertrag", ordner: "Mandant", quelle: "upload", seiten: 11, createdAt: dt(-74, 10, 0), inhalt: "Formularmietvertrag. § 8 Schönheitsreparaturen: Der Mieter ist verpflichtet, die Schönheitsreparaturen während der Mietzeit fachgerecht auszuführen (Küche/Bad alle 3 Jahre, Wohnräume alle 5 Jahre). Mietkaution: 2.850 €." });
  addDok(ctx, { akteId: a2.id, name: "Übergabeprotokoll Einzug 2019", art: "anlage", ordner: "Anlagen", quelle: "scan", createdAt: dt(-74, 10, 3), inhalt: "Übergabeprotokoll vom 01.08.2019: Wände im Wohnzimmer und Flur vergilbt, zahlreiche Dübellöcher, Heizkörper mit Farbabplatzungen. Vermerk: „Wohnung wird unrenoviert übergeben.“ Kein Mietnachlass vereinbart." });
  addDok(ctx, { akteId: a2.id, name: "Klageschrift", art: "schriftsatz", ordner: "Gericht", quelle: "generiert", format: "docx", autorId: jonas.id, createdAt: dt(-52), status: "versandt", portal: { am: dt(-52, 16, 10), vonId: jonas.id }, inhalt: "Klage auf Zahlung von 2.850 € nebst Zinsen. Die Renovierungsklausel ist unwirksam, weil die Wohnung unrenoviert übergeben wurde (BGH, Urt. v. 18.03.2015 – VIII ZR 185/14). Eine Aufrechnung mit Malerkosten scheidet aus." });
  addDok(ctx, { akteId: a2.id, name: "Klageerwiderung Möller & Thiel", art: "schriftsatz", ordner: "Gericht", quelle: "bea", createdAt: dt(-12), inhalt: "Die Beklagte beantragt Klageabweisung. Die Klägerin habe die Wohnung bei Einzug als „renoviert“ akzeptiert; die Vergilbung sei geringfügig gewesen. Hilfsweise wird mit Schadensersatz wegen Beschädigungen der Einbauküche in Höhe von 640 € aufgerechnet." });
  addFrist(ctx, { akteId: a2.id, titel: "Replik auf Klageerwiderung", typ: "frist", datum: ctx.werktag(2), verantwortlichId: jonas.id, quelle: "ki", grundlage: "Richterliche Frist (§ 277 Abs. 4 ZPO)", notiz: "Frist laut Verfügung des AG Charlottenburg." });
  addFrist(ctx, { akteId: a2.id, titel: "Mündliche Verhandlung", typ: "termin", datum: ctx.werktag(9), uhrzeit: "10:30", ort: "Amtsgericht Charlottenburg, Saal 1/215", verantwortlichId: jonas.id, quelle: "ki" });
  addRechnung(ctx, a2, { positionen: ["3100"], datumOffset: -50, status: "bezahlt" });

  // 3) Verkehrsunfall Yilmaz – Fremdgeld
  const yilmaz = ctx.person(["mandant"], { vorname: "Elif", nachname: "Yilmaz", weiblich: true });
  const elbtal = ctx.firma("Elbtal Versicherung AG", ["gegner", "versicherung"], { email: "schadenservice@elbtal-versicherung.de" });
  const a3 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 131), titel: "Yilmaz ./. Elbtal Versicherung AG", sachgebiet: "Verkehrsrecht", phase: "Außergerichtlich", status: "offen",
    mandantId: yilmaz.id, gegnerId: elbtal.id, gegenstandswert: 7420, bearbeiterId: jonas.id, sachbearbeiterId: mia?.id,
    beschreibung: "Verkehrsunfall auf der Kreuzung Kantstraße/Wilmersdorfer Straße: Unfallgegner missachtete Rotlicht (Dashcam-Aufnahme liegt vor). Versicherung zahlte 6.120 €, kürzt aber Reparaturkosten um 1.284,50 € unter Verweis auf eine freie Werkstatt. Fahrzeug 2 Jahre alt, scheckheftgepflegt.",
    schlagworte: ["verkehrsunfall", "dashcam", "freie werkstatt", "reparaturkosten", "versicherung kürzt", "haftungsquote", "fremdgeld"],
    prioritaet: "normal", createdAt: dt(-23, 14, 0), updatedAt: dt(-1, 9, 0), mandantenportal: true,
  });
  addDok(ctx, { akteId: a3.id, name: "Dashcam-Auswertung (Standbilder)", art: "anlage", ordner: "Anlagen", quelle: "upload", seiten: 4, createdAt: dt(-22), inhalt: "Standbilder 0:14–0:19: Ampel für Gegenverkehr zeigt Rot, Fahrzeug des Unfallgegners fährt mit ca. 40 km/h in die Kreuzung ein." });
  addDok(ctx, { akteId: a3.id, name: "Gutachten Kfz-Sachverständiger", art: "gutachten", ordner: "Anlagen", quelle: "email", seiten: 18, createdAt: dt(-20), inhalt: "Reparaturkosten netto 5.874,50 € (Stundenverrechnungssätze Markenwerkstatt), merkantiler Minderwert 650 €, Nutzungsausfall 12 Tage à 59 € = 708 €, Gutachterkosten 1.130 €." });
  addDok(ctx, { akteId: a3.id, name: "Abrechnung Elbtal Versicherung", art: "brief", ordner: "Korrespondenz", quelle: "email", createdAt: dt(-1), inhalt: "Schadennummer EV-2026-448812: Wir haben 6.120 € auf Ihr Anderkonto überwiesen. Eine weitere Zahlung lehnen wir ab, da die Reparatur in der gleichwertigen freien Fachwerkstatt Autoservice Ring GmbH um 1.284,50 € günstiger möglich ist." });
  // Kontoumsatz der Elbtal-Zahlung auf dem Anderkonto, vom Bankabgleich bereits als Fremdgeld der Akte zugeordnet (SEED_VERSION 13,
  // Vorgabe der Projektleitung, Rest aus I4-T08-01). Feste ID und Uhrzeit ohne Zufallszug – IDs und Zufallsfolge des übrigen Bestands bleiben.
  // Zeitpunkt der Zuordnung = Automatik-Eintrag „Bankabgleich: Zahlung Elbtal … als Fremdgeld erkannt“ im Verlauf.
  const elbtalErkannt = dt(-4, 8, 5);
  const elbtalUmsatz = "hero-t-elbtal";
  ctx.data.transaktionen.push({
    id: elbtalUmsatz, datum: d(-4), betrag: 6120, gegenpartei: "ELBTAL VERSICHERUNG AG", iban: "DE65 8504 0000 0448 8120 26",
    verwendungszweck: `Schaden-Nr. EV-2026-448812 / Ihr Az. ${a3.aktenzeichen} Yilmaz – Regulierung Fahrzeugschaden`, status: "zugeordnet",
    zuordnung: { akteId: a3.id, art: "fremdgeld", durch: "auto", sicherheit: 0.98, grund: `Schadennummer EV-2026-448812 und Aktenzeichen ${a3.aktenzeichen} im Verwendungszweck – Regulierung der Gegnerin für die Mandantin (Fremdgeld)`, am: elbtalErkannt },
    konto: "ander",
  });
  ctx.data.buchungen.push({ id: ctx.id("b"), akteId: a3.id, datum: d(-4), art: "fremdgeld", betrag: 6120, text: "Zahlung Elbtal Versicherung (Fremdgeld) – an Mandantin weiterzuleiten", fremdgeld: true, transaktionId: elbtalUmsatz });
  // Büroaufgabe der Fachangestellten → Wiedervorlage (Vorgabe der Projektleitung, SEED_VERSION 11); echte Fristen tragen Berufsträger
  addFrist(ctx, { akteId: a3.id, titel: "Fremdgeld an Mandantin weiterleiten (§ 43a Abs. 7 BRAO)", typ: "wiedervorlage", datum: ctx.today, verantwortlichId: mia?.id ?? jonas.id, quelle: "automatisch" });
  addFrist(ctx, { akteId: a3.id, titel: "Wiedervorlage: Nachforderung Reparaturkosten", typ: "wiedervorlage", datum: ctx.werktag(14), verantwortlichId: jonas.id, quelle: "ki" });

  // 4) Kaufrecht Neumann – Urteil kommt heute per beA
  const neumann = ctx.person(["mandant"], { vorname: "Michael", nachname: "Neumann", weiblich: false });
  const arslan = ctx.firma("Arslan Autohaus GmbH", ["gegner"]);
  const lg = ctx.gericht(G.lg);
  // Registerjahr des Gerichtsaktenzeichens = Jahr der Klageerhebung (Klageschrift vor 230 Tagen)
  const neumannAz = `28 O 211/${addDays(ctx.today, -230).slice(2, 4)}`;
  const a4 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 118), titel: "Neumann ./. Arslan Autohaus GmbH", sachgebiet: "Vertragsrecht", phase: "Urteil", status: "offen",
    mandantId: neumann.id, gegnerId: arslan.id, gerichtId: lg.id, gerichtsAz: neumannAz, gegenstandswert: 18900, bearbeiterId: julia.id, sachbearbeiterId: mia?.id,
    beschreibung: "Rücktritt vom Kauf eines Gebrauchtwagens (18.900 €) wegen verschwiegenem Unfallschaden. Klage auf Rückzahlung Zug um Zug gegen Rückgabe; Verkündungstermin war vor einer Woche.",
    schlagworte: ["kaufrecht", "kaufvertrag", "gebrauchtwagen", "rücktritt", "unfallschaden", "arglist", "nutzungsentschädigung"],
    prioritaet: "hoch", createdAt: dt(-260, 11, 0), updatedAt: dt(-7, 12, 0),
  });
  addDok(ctx, { akteId: a4.id, name: "Klageschrift", art: "schriftsatz", ordner: "Gericht", quelle: "generiert", format: "docx", autorId: julia.id, createdAt: dt(-230), inhalt: "Klage auf Rückzahlung des Kaufpreises von 18.900 € Zug um Zug gegen Rückgabe des Fahrzeugs; arglistiges Verschweigen eines Vorschadens." });
  addDok(ctx, { akteId: a4.id, name: "Protokoll mündliche Verhandlung", art: "beschluss", ordner: "Gericht", quelle: "bea", createdAt: dt(-40), inhalt: "Termin zur Verkündung einer Entscheidung wird bestimmt." });
  addRechnung(ctx, a4, { positionen: ["2300", "3100", "3104"], datumOffset: -38, status: "gestellt" });
  addMsg(ctx, {
    kanal: "bea", von: G.lg, vonAdresse: "DE.Justiz.LG-Berlin-II", betreff: `${neumannAz} – Neumann ./. Arslan Autohaus GmbH – Zustellung Urteil gegen eEB`,
    text: `In dem Rechtsstreit\nMichael Neumann ./. Arslan Autohaus GmbH\nAz.: ${neumannAz}\n\nwird Ihnen anliegend das Urteil vom ${fmtDate(ctx.gerichtstag(-7))} zugestellt.\n\nDie Beklagte wird verurteilt, an den Kläger 14.250,00 € nebst Zinsen Zug um Zug gegen Rückgabe des Fahrzeugs zu zahlen. Im Übrigen wird die Klage abgewiesen (Nutzungsentschädigung 4.650,00 €). Die Kosten des Rechtsstreits tragen der Kläger zu 25 %, die Beklagte zu 75 %. Das Urteil ist gegen Sicherheitsleistung in Höhe von 110 % des jeweils zu vollstreckenden Betrags vorläufig vollstreckbar.\n\nSie werden gebeten, das elektronische Empfangsbekenntnis abzugeben.\n\nRechtsbehelfsbelehrung: Gegen dieses Urteil ist die Berufung zulässig. Sie ist binnen einer Notfrist von einem Monat ab Zustellung beim Kammergericht einzulegen und binnen zwei Monaten ab Zustellung zu begründen.`,
    eingang: dt(0, 8, 12), akteId: undefined, status: "neu", zugeordnet: false, eebErforderlich: true, kiStatus: "ausstehend",
    anhaenge: [{ name: `Urteil_${neumannAz.replace(/\s/g, "").replace("/", "-")}.pdf`, groesseKb: 412 }, { name: "Zustellungsnachricht.xml", groesseKb: 6 }],
  });

  // 5) Forderungseinzug Berger ./. Lenz – Forderungskonto
  const berger = ctx.firma("Berger Haustechnik GmbH", ["mandant"], { email: "buchhaltung@berger-haustechnik.de" });
  const lenz = ctx.person(["gegner"], { vorname: "Rainer", nachname: "Lenz", weiblich: false });
  const mahn = ctx.gericht(G.mahn);
  const a5 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 126), titel: "Berger Haustechnik GmbH ./. Lenz", sachgebiet: "Forderungseinzug", phase: "Vollstreckung", status: "offen",
    mandantId: berger.id, gegnerId: lenz.id, gerichtId: mahn.id, gerichtsAz: `${ctx.yy}-4471820-0-3`, gegenstandswert: 4860, bearbeiterId: jonas.id, sachbearbeiterId: mia?.id,
    beschreibung: "Werklohn aus Heizungsreparatur (Rechnung 4.860 €). Vollstreckungsbescheid erwirkt, Schuldner zahlt unregelmäßig in Raten. Verbraucher – Verzugszinsen 5 Prozentpunkte über Basiszinssatz.",
    schlagworte: ["forderung", "vollstreckungsbescheid", "teilzahlung", "forderungskonto", "verzug", "zwangsvollstreckung"],
    prioritaet: "normal", createdAt: dt(-170, 9, 0), updatedAt: dt(-15, 9, 0),
    forderung: { hauptforderung: 4860, faelligAb: d(-182), verbraucher: true, schuldnerId: lenz.id, titel: `Vollstreckungsbescheid des Amtsgerichts Wedding vom ${fmtDate(ctx.gerichtstag(-62))}` },
  });
  // Kosten des Mahnverfahrens (im Vollstreckungsbescheid tituliert):
  // Gericht: 0,5-Gebühr Nr. 1100 KV GKG aus 4.860 € – GKG-Tabelle ab 01.06.2025: 1,0 = 170,50 € → 85,25 € (Mindestgebühr 38 €).
  // Anwalt: 1,0 Nr. 3305 + 0,5 Nr. 3308 VV RVG zzgl. Pauschale Nr. 7002 – netto, die Gläubigerin ist vorsteuerabzugsberechtigt.
  const mahnRvg = berechneRvg({ positionen: [{ nr: "3305" }, { nr: "3308" }], gegenstandswert: 4860, fassung: fassungFuerAuftrag(a5.createdAt.slice(0, 10)) });
  const rvgBetrag = (nr: string) => mahnRvg.angelegenheiten.flatMap((x) => x.zeilen).find((z) => z.nr === nr)?.betrag ?? 0;
  ctx.data.buchungen.push(
    { id: ctx.id("b"), akteId: a5.id, datum: d(-120), art: "kosten", betrag: 85.25, text: "Gerichtskosten Mahnverfahren (Nr. 1100 KV GKG)" },
    { id: ctx.id("b"), akteId: a5.id, datum: d(-120), art: "kosten", betrag: round2(rvgBetrag("3305") + mahnRvg.auslagenpauschale), text: "RA-Kosten Mahnbescheid (Nr. 3305, 7002 VV RVG)" },
    { id: ctx.id("b"), akteId: a5.id, datum: d(-62), art: "kosten", betrag: rvgBetrag("3308"), text: "RA-Kosten Vollstreckungsbescheid (Nr. 3308)" },
    { id: ctx.id("b"), akteId: a5.id, datum: d(-45), art: "zahlung", betrag: -500, text: "Teilzahlung Schuldner Lenz", fremdgeld: true },
    { id: ctx.id("b"), akteId: a5.id, datum: d(-15), art: "zahlung", betrag: -500, text: "Teilzahlung Schuldner Lenz", fremdgeld: true },
  );
  addDok(ctx, { akteId: a5.id, name: "Vollstreckungsbescheid", art: "beschluss", ordner: "Gericht", quelle: "bea", createdAt: dt(-62), inhalt: `Vollstreckungsbescheid des Amtsgerichts Wedding über 4.860,00 € nebst Zinsen in Höhe von 5 Prozentpunkten über dem Basiszinssatz seit ${fmtDate(d(-182))}, Kosten des Verfahrens.` });
  addFrist(ctx, { akteId: a5.id, titel: "Wiedervorlage: Ratenzahlung prüfen", typ: "wiedervorlage", datum: ctx.werktag(1), verantwortlichId: mia?.id ?? jonas.id, quelle: "automatisch" });
  // Den Ausdruck des Vermögensverzeichnisses leitet der Gerichtsvollzieher dem Gläubiger selbst zu (§ 802f Abs. 6 ZPO).
  const drII = `DR II 2214/${ctx.yy}`;
  addMsg(ctx, {
    kanal: "bea", von: "Gerichtsvollzieherin Petra Lindemann (Amtsgericht Charlottenburg)", betreff: `Vermögensauskunft Rainer Lenz – ${drII} – Geschäftsnr. ${ctx.yy}-4471820-0-3`,
    text: `Zwangsvollstreckungssache Berger Haustechnik GmbH ./. Rainer Lenz\nTitel: AG Wedding, ${ctx.yy}-4471820-0-3\nDienstregister: ${drII}\n\nDer Schuldner hat am ${fmtDate(ctx.gerichtstag(-3))} die Vermögensauskunft nach § 802c ZPO abgegeben. Den Ausdruck des Vermögensverzeichnisses übersende ich Ihnen anliegend (§ 802f Abs. 6 ZPO). Das Verzeichnis ist beim zentralen Vollstreckungsgericht hinterlegt.\n\nLindemann\nGerichtsvollzieherin`,
    eingang: dt(-1, 16, 20), status: "neu", zugeordnet: false, kiStatus: "ausstehend", anhaenge: [{ name: `Vermoegensverzeichnis_DRII-2214-${ctx.yy}.pdf`, groesseKb: 212 }],
  });

  // 6) Digitaler Nachlass
  const hoffmann = ctx.person(["mandant"], { vorname: "Ingrid", nachname: "Hoffmann", weiblich: true });
  const a6 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 149), titel: "Nachlass Lukas Hoffmann – Zugang Online-Konten", sachgebiet: "Erbrecht", phase: "Außergerichtlich", status: "offen",
    mandantId: hoffmann.id, gegenstandswert: 5000, bearbeiterId: julia.id, sachbearbeiterId: mia?.id,
    beschreibung: "Mandantin (Mutter und Miterbin) verlangt vom Betreiber eines sozialen Netzwerks Zugang zum Benutzerkonto ihres verstorbenen Sohnes, um Hinweise auf die Umstände seines Todes zu erhalten. Der Betreiber verweigert unter Hinweis auf den Gedenkzustand.",
    schlagworte: ["digitaler nachlass", "erben", "benutzerkonto", "social media", "gesamtrechtsnachfolge"],
    prioritaet: "normal", createdAt: dt(-9, 15, 0), updatedAt: dt(-3, 10, 0),
  });
  addDok(ctx, { akteId: a6.id, name: "Erbschein", art: "beschluss", ordner: "Mandant", quelle: "scan", createdAt: dt(-9), inhalt: "Erbschein: Erben sind Ingrid Hoffmann und Klaus Hoffmann zu je 1/2." });
  addFrist(ctx, { akteId: a6.id, titel: "Frist an Plattformbetreiber (Zugang)", typ: "wiedervorlage", datum: ctx.werktag(6), verantwortlichId: julia.id, quelle: "manuell" });

  // Posteingang – Präsentationsnachrichten
  addMsg(ctx, {
    kanal: "email", von: "Thomas Weber", vonAdresse: weber.email, betreff: "Unterlagen + wichtiger Hinweis zu Herrn Seifert",
    text: `Guten Morgen Frau Dr. Hartmann,\n\nanbei wie besprochen mein Arbeitsvertrag und die letzten drei Lohnabrechnungen.\n\nMir ist noch etwas eingefallen: Mein Kollege Herr Seifert hat im März ebenfalls Kaffee aus dem Bruch mitgenommen. Der Schichtleiter hat das gesehen und nur gesagt, das sei „sowieso Müll“. Er wäre auch bereit, das zu bestätigen.\n\nMuss ich wegen der Arbeitsagentur noch etwas machen?\n\nViele Grüße\nThomas Weber`,
    eingang: dt(0, 7, 41), status: "neu", zugeordnet: false, kiStatus: "ausstehend",
    anhaenge: [{ name: "Arbeitsvertrag_2012.pdf", groesseKb: 1240 }, { name: "Lohnabrechnungen_Q3.pdf", groesseKb: 860 }],
  });
  addMsg(ctx, {
    kanal: "email", von: "Ursula Franke", vonAdresse: "ursula.franke@t-online.de", betreff: "Anfrage: Eigenbedarfskündigung meiner Wohnung",
    text: "Sehr geehrte Damen und Herren,\n\nich wohne seit 1994 in meiner Wohnung in der Bergmannstraße. Gestern kam die Kündigung wegen Eigenbedarfs, der Sohn des Vermieters soll einziehen. Ich bin 79 Jahre alt und herzkrank. Können Sie mir helfen? Ich habe eine Rechtsschutzversicherung bei der Spreebogen.\n\nMit freundlichen Grüßen\nUrsula Franke",
    eingang: dt(0, 9, 3), status: "neu", zugeordnet: false, kiStatus: "analysiert",
    ki: { sicherheit: 0.96, zusammenfassung: "Neue Mandatsanfrage: Eigenbedarfskündigung, Mieterin 79 Jahre, herzkrank, Mietdauer seit 1994. Rechtsschutz vorhanden. Härtefall nach § 574 BGB naheliegend (vgl. BGH VIII ZR 180/18).", aktion: "Mandatsaufnahme starten: Akte anlegen, Vollmacht und Deckungsanfrage automatisch erzeugen." },
  });
  addMsg(ctx, {
    kanal: "email", von: "Elbtal Versicherung AG – Schadenservice", vonAdresse: elbtal.email, betreff: "Schaden EV-2026-448812 – keine weitere Regulierung",
    text: "Sehr geehrte Damen und Herren,\n\nwir verweisen auf unsere Abrechnung. Eine Reparatur in der gleichwertigen freien Fachwerkstatt ist der Geschädigten zumutbar. Weitere Zahlungen lehnen wir ab.\n\nMit freundlichen Grüßen\nIhr Schadenservice",
    eingang: dt(-1, 11, 22), akteId: a3.id, status: "gelesen", zugeordnet: true, kiStatus: "uebernommen",
    ki: { akteId: a3.id, sicherheit: 0.99, zusammenfassung: "Versicherung lehnt Nachzahlung von 1.284,50 € ab (Verweis auf freie Werkstatt). Fahrzeug ist 2 Jahre alt und scheckheftgepflegt – Verweis nach BGH VI ZR 53/09 unzumutbar.", aktion: "Wiedervorlage in 14 Tagen gesetzt; Nachforderungsschreiben mit BGH VI ZR 53/09 vorbereitet." },
  });
  addMsg(ctx, {
    kanal: "bea", von: "Möller & Thiel Rechtsanwälte", betreff: `211 C 148/${ctx.yy} – Vergleichsvorschlag`,
    text: "Sehr geehrter Herr Kollege Brandt,\n\nzur Vermeidung weiterer Kosten schlägt unsere Mandantin vor, die Sache durch Zahlung von 1.400,00 € an Ihre Mandantin vergleichsweise zu erledigen.\n\nMit freundlichen kollegialen Grüßen\nDr. Möller",
    eingang: dt(-1, 15, 2), akteId: a2.id, status: "neu", zugeordnet: true, kiStatus: "analysiert",
    ki: { akteId: a2.id, sicherheit: 0.99, zusammenfassung: "Vergleichsangebot über 1.400 € (49 % der Klageforderung). Nach BGH VIII ZR 185/14 sind die Erfolgsaussichten gut – Angebot eher zu niedrig.", aktion: "Mandantin informieren und Gegenvorschlag (mind. 2.400 €) abstimmen." },
  });
  addMsg(ctx, {
    kanal: "bea", von: "Amtsgericht Charlottenburg", betreff: `211 C 148/${ctx.yy} – Ladung zum Termin`,
    text: `In Sachen Schneider ./. Lindenhof Hausverwaltung GmbH wird Termin zur mündlichen Verhandlung bestimmt auf ${fmtDateLong(ctx.werktag(9))}, 10:30 Uhr, Saal 1/215. Das persönliche Erscheinen der Klägerin wird angeordnet.`,
    eingang: dt(-6, 10, 14), akteId: a2.id, status: "erledigt", zugeordnet: true, kiStatus: "uebernommen", eebErforderlich: true, eebAbgegeben: dt(-6, 10, 40),
    ki: { akteId: a2.id, sicherheit: 0.99, zusammenfassung: "Ladung zur mündlichen Verhandlung, persönliches Erscheinen angeordnet.", aktion: "Termin im Kalender eingetragen, Mandantin informiert, eEB abgegeben." },
  });

  // Rechnungen für Hero-Akten
  addRechnung(ctx, a3, { positionen: ["2300"], datumOffset: -6, status: "gestellt" });
  // Vorschuss: bei der Erstberatung angefordert, am Folgetag eingegangen (− = Zahlung/Gutschrift)
  const vorschussTag = d(-1);
  ctx.data.buchungen.push({ id: ctx.id("b"), akteId: a1.id, datum: vorschussTag, art: "vorschuss", betrag: -500, text: "Vorschuss nach § 9 RVG – Zahlungseingang Thomas Weber" });

  // Verlauf der Präsentationsakten – passend zu Dokumenten, Fristen und Posteingang
  verlauf(ctx, a1, [
    { zeit: plusMin(a1.createdAt, 1), akteur: "automation", key: "mandatsaufnahme", text: "Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) erstellt und zur Freigabe vorgelegt – 142/26" },
    { zeit: dt(-2, 10, 41), akteur: "ki", key: "posteingang-fristen", text: "Kündigungsschreiben gelesen: Klagefrist nach § 4 S. 1 KSchG erkannt und berechnet – 142/26" },
    { zeit: dt(-2, 10, 42), akteur: "automation", key: "vorfristen", text: "Vorfrist zur Kündigungsschutzklage gesetzt und Verantwortliche informiert – 142/26" },
    { zeit: dt(-2, 11, 5), akteur: "nutzer", userId: julia.id, text: "Gesprächsnotiz Erstberatung angelegt – 142/26" },
    { zeit: dt(-2, 11, 34), akteur: "automation", key: "deckungsanfrage", text: "Deckungsanfrage an Nordlicht Rechtsschutz AG zur Freigabe vorgelegt – 142/26" },
    { zeit: dt(-2, 11, 35), akteur: "automation", key: "vorfristen", text: "Wiedervorlage „Deckungszusage Nordlicht“ gesetzt – 142/26" },
    ...(mia ? [{ zeit: dt(-1, 9, 14), akteur: "nutzer" as const, userId: mia.id, text: "Klagefrist (§ 4 KSchG) im Vier-Augen-Prinzip kontrolliert – 142/26" }] : []),
    { zeit: dt(-1, 7, 30), akteur: "automation", key: "bankabgleich", text: "Bankabgleich: Vorschuss Thomas Weber (500,00 €) auf 142/26 gebucht" },
  ]);
  const klageerwiderung = data.dokumente.find((x) => x.akteId === a2.id && x.name.startsWith("Klageerwiderung"));
  verlauf(ctx, a2, [
    ...(klageerwiderung ? [
      { zeit: plusMin(klageerwiderung.createdAt, 1), akteur: "automation" as const, key: "zuordnung", text: "Klageerwiderung Möller & Thiel (beA) der Akte 137/26 zugeordnet" },
      { zeit: plusMin(klageerwiderung.createdAt, 2), akteur: "ki" as const, key: "posteingang-fristen", text: "Richterliche Frist zur Replik erkannt und eingetragen – 137/26" },
    ] : []),
    { zeit: dt(-6, 10, 15), akteur: "ki", key: "posteingang-fristen", text: "Ladung erkannt: Termin zur mündlichen Verhandlung eingetragen – 137/26" },
    { zeit: dt(-6, 10, 16), akteur: "automation", key: "eeb", text: "Empfangsbekenntnis vorbereitet – 137/26" },
    { zeit: dt(-6, 10, 40), akteur: "nutzer", userId: jonas.id, text: "Empfangsbekenntnis abgegeben – 137/26" },
    { zeit: dt(-1, 15, 3), akteur: "automation", key: "zuordnung", text: "Vergleichsvorschlag Möller & Thiel der Akte 137/26 zugeordnet" },
  ]);
  verlauf(ctx, a3, [
    { zeit: plusMin(a3.createdAt, 1), akteur: "automation", key: "mandatsaufnahme", text: "Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) erstellt und zur Freigabe vorgelegt – 131/26" },
    { zeit: elbtalErkannt, akteur: "automation", key: "bankabgleich", text: "Bankabgleich: Zahlung Elbtal Versicherung (6.120,00 €) als Fremdgeld erkannt – Weiterleitung an die Mandantin vorgemerkt – 131/26" },
    { zeit: dt(-1, 11, 23), akteur: "automation", key: "zuordnung", text: "Schreiben der Elbtal Versicherung der Akte 131/26 zugeordnet" },
    { zeit: dt(-1, 11, 24), akteur: "automation", key: "vorfristen", text: "Wiedervorlage „Nachforderung Reparaturkosten“ gesetzt – 131/26" },
  ]);
  verlauf(ctx, a4, [
    { zeit: dt(-10, 9, 0), akteur: "automation", key: "mahnwesen", text: "Zahlungserinnerung zur Freigabe vorgelegt – 118/26" },
    { zeit: dt(-10, 9, 26), akteur: "nutzer", userId: julia.id, text: "Zahlungserinnerung freigegeben und versandt – 118/26" },
  ]);
  verlauf(ctx, a5, [
    { zeit: dt(-45, 7, 50), akteur: "automation", key: "bankabgleich", text: "Bankabgleich: Teilzahlung Rainer Lenz (500,00 €) auf das Forderungskonto 126/26 gebucht" },
    { zeit: dt(-15, 7, 50), akteur: "automation", key: "bankabgleich", text: "Bankabgleich: Teilzahlung Rainer Lenz (500,00 €) auf das Forderungskonto 126/26 gebucht" },
  ]);
  verlauf(ctx, a6, [
    { zeit: plusMin(a6.createdAt, 2), akteur: "automation", key: "mandatsaufnahme", text: "Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) erstellt und zur Freigabe vorgelegt – 149/26" },
  ]);
}

// ───────────────────────── München: Lindner Rechtsanwälte ─────────────────────────
export function heroesMuenchen(ctx: Ctx) {
  const { d, dt } = ctx;
  const [stefan, aylin] = ctx.anwaelte;
  const thomas = ctx.refas[0];
  const G = STAEDTE.muenchen.gerichte;

  const isartal = ctx.firma("Isartal Projektbau GmbH", ["mandant"]);
  const bhg = ctx.firma("Bauherrengemeinschaft Sendlinger Höfe GbR", ["gegner"]);
  const kessler = ctx.firma("Dr. Kessler & Kollegen", ["gegneranwalt"]);
  const lg = ctx.gericht(G.lg);
  const a1 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 133), titel: "Isartal Projektbau GmbH ./. BHG Sendlinger Höfe", sachgebiet: "Baurecht", phase: "Gerichtlich", status: "offen",
    mandantId: isartal.id, gegnerId: bhg.id, gegneranwaltId: kessler.id, gerichtId: lg.id, gerichtsAz: `24 O 9182/${ctx.yy}`, gegenstandswert: 86400,
    bearbeiterId: stefan.id, sachbearbeiterId: thomas?.id,
    beschreibung: "Restwerklohnklage über 86.400 € aus Schlussrechnung (Rohbau, 3 Mehrfamilienhäuser). Bauherren verweigern Abnahme und rügen Risse im Estrich; Sachverständiger der Mandantin hält die Risse für unwesentlich (Schwindrisse).",
    schlagworte: ["werklohn", "werkvertrag", "abnahme", "schlussrechnung", "vob", "estrich", "risse", "mangel", "bau"],
    prioritaet: "hoch", createdAt: dt(-96), updatedAt: dt(-1),
  });
  addDok(ctx, { akteId: a1.id, name: "Klageerwiderung Dr. Kessler & Kollegen", art: "schriftsatz", ordner: "Gericht", quelle: "bea", createdAt: dt(-3), inhalt: "Die Beklagte beantragt Klageabweisung. Die Werkleistung sei nicht abnahmereif, da der Estrich in 14 Wohnungen Risse aufweise. Hilfsweise Zurückbehaltungsrecht in Höhe des doppelten Mängelbeseitigungsaufwands (§ 641 Abs. 3 BGB)." });
  addMsg(ctx, {
    kanal: "bea", von: G.lg, betreff: `24 O 9182/${ctx.yy} – Verfügung: Stellungnahmefrist`,
    text: `In Sachen Isartal Projektbau GmbH ./. Bauherrengemeinschaft Sendlinger Höfe GbR wird der Klagepartei aufgegeben, zur Klageerwiderung vom ${fmtDate(d(-3))} binnen drei Wochen ab Zustellung dieser Verfügung Stellung zu nehmen.`,
    eingang: dt(0, 8, 31), status: "neu", zugeordnet: false, kiStatus: "ausstehend", eebErforderlich: true,
    anhaenge: [{ name: "Verfuegung_24O9182.pdf", groesseKb: 96 }],
  });
  addFrist(ctx, { akteId: a1.id, titel: "Ortstermin Sachverständiger Estrich", typ: "termin", datum: ctx.werktag(11), uhrzeit: "09:00", ort: "Baustelle Sendlinger Höfe, Haus B", verantwortlichId: stefan.id, quelle: "manuell" });
  addRechnung(ctx, a1, { positionen: ["3100"], datumOffset: -70, status: "bezahlt" });

  const schreiner = ctx.firma("Schreinerei Hofbauer GmbH", ["mandant"]);
  const schuldner = ctx.person(["gegner"], { vorname: "Florian", nachname: "Winkler", weiblich: false });
  const mahn = ctx.gericht(G.mahn);
  const a2 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 128), titel: "Schreinerei Hofbauer GmbH ./. Winkler", sachgebiet: "Forderungseinzug", phase: "Gerichtlich", status: "offen",
    mandantId: schreiner.id, gegnerId: schuldner.id, gerichtId: mahn.id, gerichtsAz: `${ctx.yy}-1182734-0-6`, gegenstandswert: 7340, bearbeiterId: aylin.id, sachbearbeiterId: thomas?.id,
    beschreibung: "Werklohn für Einbauschränke (7.340 €). Mahnbescheid zugestellt; Schuldner hat Widerspruch eingelegt mit der Begründung, die Schränke seien zu spät geliefert worden.",
    schlagworte: ["forderung", "mahnbescheid", "widerspruch", "werklohn", "verzug"],
    prioritaet: "normal", createdAt: dt(-58), updatedAt: dt(-1),
    forderung: { hauptforderung: 7340, faelligAb: d(-84), verbraucher: true, schuldnerId: schuldner.id },
  });
  addMsg(ctx, {
    kanal: "bea", von: G.mahn, betreff: `Widerspruch gegen Mahnbescheid – ${ctx.yy}-1182734-0-6`,
    text: "In der Mahnsache Schreinerei Hofbauer GmbH ./. Florian Winkler hat der Antragsgegner gegen den Mahnbescheid insgesamt Widerspruch erhoben. Die Abgabe an das Streitgericht erfolgt nach Einzahlung der weiteren Gerichtskosten.",
    eingang: dt(-1, 13, 5), status: "neu", zugeordnet: false, kiStatus: "ausstehend", anhaenge: [{ name: "Widerspruchsnachricht.pdf", groesseKb: 54 }],
  });
  addFrist(ctx, { akteId: a2.id, titel: "Weitere Gerichtskosten einzahlen / Anspruchsbegründung", typ: "frist", datum: ctx.werktag(4), verantwortlichId: aylin.id, quelle: "automatisch" });

  const mandantin = ctx.person(["mandant"], { vorname: "Claudia", nachname: "Seidel", weiblich: true });
  const kueche = ctx.firma("Alpenküchen Vertrieb GmbH", ["gegner"]);
  const a3 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 121), titel: "Seidel ./. Alpenküchen Vertrieb GmbH", sachgebiet: "Vertragsrecht", phase: "Außergerichtlich", status: "offen",
    mandantId: mandantin.id, gegnerId: kueche.id, gegenstandswert: 23800, bearbeiterId: aylin.id, sachbearbeiterId: thomas?.id,
    beschreibung: "Einbauküche (23.800 €) mit mangelhaften Arbeitsplatten; zwei Nachbesserungen gescheitert. Rücktritt (§§ 437 Nr. 2, 323 BGB) und daneben Ersatz der Ausbau- und Folgekosten (§§ 437 Nr. 3, 280, 281, 325 BGB).",
    schlagworte: ["kaufrecht", "mangel", "nacherfüllung", "rücktritt", "einbau", "ausbau", "küche"],
    prioritaet: "normal", createdAt: dt(-31), updatedAt: dt(0, 7, 56),
  });
  addMsg(ctx, {
    kanal: "email", von: "Claudia Seidel", vonAdresse: mandantin.email, betreff: "Küche – neue Fotos der Arbeitsplatte",
    text: "Hallo Frau Kaya,\n\nanbei neue Fotos: Die Arbeitsplatte hat sich an der Spüle weiter aufgewölbt. Der Monteur war gestern da und meinte, man könne nichts mehr machen.\n\nViele Grüße\nClaudia Seidel",
    eingang: dt(0, 7, 55), akteId: a3.id, status: "neu", zugeordnet: true, kiStatus: "analysiert", anhaenge: [{ name: "Foto_Spuele_1.jpg", groesseKb: 2210 }, { name: "Foto_Spuele_2.jpg", groesseKb: 1980 }],
    ki: { akteId: a3.id, sicherheit: 0.98, zusammenfassung: "Mandantin dokumentiert fortschreitenden Mangel; dritter Nachbesserungsversuch faktisch gescheitert (Erklärung des Monteurs).", aktion: "Rücktrittserklärung mit Fristsetzung für Rückabwicklung vorbereiten." },
  });
  verlauf(ctx, a3, [
    { zeit: dt(0, 7, 56), akteur: "automation", key: "zuordnung", text: `Nachricht der Akte ${a3.aktenzeichen} zugeordnet` },
  ]);
  void a2;
}

// ───────────────────────── Hamburg: Demir & Kollegen ─────────────────────────
export function heroesHamburg(ctx: Ctx) {
  const { d, dt } = ctx;
  const [selin, paul] = ctx.anwaelte;
  const greta = ctx.refas[0];
  const G = STAEDTE.hamburg.gerichte;

  const kowalski = ctx.person(["mandant"], { vorname: "Piotr", nachname: "Kowalski", weiblich: false });
  const agStraf = ctx.gericht(G.straf);
  const a1 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 139), titel: "Strafsache Kowalski (Strafbefehl § 142 StGB)", sachgebiet: "Strafrecht", phase: "Gerichtlich", status: "offen",
    mandantId: kowalski.id, gerichtId: agStraf.id, gerichtsAz: `241 Cs 512/${ctx.yy}`, gegenstandswert: 0, bearbeiterId: paul.id, sachbearbeiterId: greta?.id,
    beschreibung: "Strafbefehl wegen unerlaubten Entfernens vom Unfallort: 40 Tagessätze à 55 €, Entziehung der Fahrerlaubnis mit 8 Monaten Sperre. Parkrempler, Fremdschaden laut Gutachten 1.180 €. Mandant ist Berufskraftfahrer.",
    schlagworte: ["strafbefehl", "unfallflucht", "fahrerlaubnis", "einspruch", "bedeutender schaden"],
    prioritaet: "hoch", createdAt: dt(-3), updatedAt: dt(0, 8, 0),
  });
  addDok(ctx, { akteId: a1.id, name: "Strafbefehl", art: "beschluss", ordner: "Gericht", quelle: "scan", createdAt: dt(-3), inhalt: `Strafbefehl des Amtsgerichts Hamburg vom ${fmtDate(ctx.gerichtstag(-8))}, zugestellt am ${fmtDate(d(-4))}: 40 Tagessätze zu je 55 €, Entziehung der Fahrerlaubnis, Sperrfrist 8 Monate. Einspruch binnen zwei Wochen nach Zustellung.` });
  addRegelFrist(ctx, a1, "einspruch_strafbefehl", d(-4), { quelle: "ki", kontrolliertVon: greta?.id });

  const lehmann = ctx.person(["mandant"], { vorname: "Sarah", nachname: "Lehmann", weiblich: true });
  const exmann = ctx.person(["gegner"], { vorname: "Daniel", nachname: "Lehmann", weiblich: false });
  const fam = ctx.gericht(G.fam);
  const a2 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 134), titel: "Umgangsverfahren Lehmann", sachgebiet: "Familienrecht", phase: "Gerichtlich", status: "offen",
    mandantId: lehmann.id, gegnerId: exmann.id, gerichtId: fam.id, gerichtsAz: `285 F 211/${ctx.yy}`, gegenstandswert: 4000, bearbeiterId: selin.id, sachbearbeiterId: greta?.id,
    beschreibung: "Kindsvater beantragt paritätisches Wechselmodell für Tochter Mila (6). Mandantin lehnt wegen hoher Konfliktbelastung und Schulweg ab; Verfahrensbeistand bestellt.",
    schlagworte: ["umgang", "wechselmodell", "kindeswohl", "sorgerecht", "verfahrensbeistand"],
    prioritaet: "normal", createdAt: dt(-40), updatedAt: dt(-2),
  });
  addFrist(ctx, { akteId: a2.id, titel: "Anhörungstermin Familiengericht", typ: "termin", datum: ctx.werktag(8), uhrzeit: "11:00", ort: `Amtsgericht Hamburg, ${GERICHTSANSCHRIFTEN[G.fam].strasse}, Raum 312`, verantwortlichId: selin.id, quelle: "ki" });
  addMsg(ctx, {
    kanal: "bea", von: G.fam, betreff: `285 F 211/${ctx.yy} – Bericht Verfahrensbeistand`,
    text: "In der Kindschaftssache Lehmann wird der Bericht des Verfahrensbeistands zur Kenntnis- und Stellungnahme binnen zehn Tagen übersandt. Der Anhörungstermin bleibt bestehen.",
    eingang: dt(0, 9, 12), status: "neu", zugeordnet: false, kiStatus: "ausstehend", anhaenge: [{ name: "Bericht_Verfahrensbeistand.pdf", groesseKb: 380 }],
  });

  const nachlass = ctx.person(["mandant"], { vorname: "Johanna", nachname: "Peters", weiblich: true });
  const bruder = ctx.person(["gegner"], { vorname: "Hendrik", nachname: "Peters", weiblich: false });
  const a3 = akte(ctx, {
    aktenzeichen: nextAz(ctx, 127), titel: "Peters ./. Peters (Pflichtteil)", sachgebiet: "Erbrecht", phase: "Außergerichtlich", status: "offen",
    mandantId: nachlass.id, gegnerId: bruder.id, gegenstandswert: 68000, bearbeiterId: selin.id, sachbearbeiterId: greta?.id,
    beschreibung: "Mandantin wurde vom Vater enterbt, Alleinerbe ist der Bruder. Nachlass: Eigentumswohnung in Eppendorf, Depot. Auskunft nach § 2314 BGB verlangt, Bruder legt nur privates Verzeichnis vor.",
    schlagworte: ["pflichtteil", "nachlass", "auskunft", "wertermittlung", "notarielles nachlassverzeichnis"],
    prioritaet: "normal", createdAt: dt(-64), updatedAt: dt(-5),
  });
  addMsg(ctx, {
    kanal: "email", von: "Johanna Peters", vonAdresse: nachlass.email, betreff: "Verzeichnis von meinem Bruder – reicht das?",
    text: "Liebe Frau Demir,\n\nmein Bruder hat mir jetzt eine handschriftliche Liste geschickt (Foto anbei). Die Wohnung ist mit 310.000 € angegeben – Nachbarwohnungen wurden zuletzt für über 480.000 € verkauft.\n\nHerzliche Grüße\nJohanna Peters",
    eingang: dt(0, 7, 20), akteId: a3.id, status: "neu", zugeordnet: true, kiStatus: "analysiert", anhaenge: [{ name: "Verzeichnis_Foto.jpg", groesseKb: 1670 }],
    ki: { akteId: a3.id, sicherheit: 0.97, zusammenfassung: "Privates Nachlassverzeichnis mit vermutlich zu niedrigem Immobilienwert (310.000 € vs. ca. 480.000 € Vergleichswert).", aktion: "Notarielles Nachlassverzeichnis und Wertgutachten nach § 2314 Abs. 1 S. 2, 3 BGB verlangen (Entwurf liegt bereit)." },
  });
  verlauf(ctx, a1, [
    { zeit: plusMin(a1.createdAt, 1), akteur: "automation", key: "mandatsaufnahme", text: `Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) erstellt und zur Freigabe vorgelegt – ${a1.aktenzeichen}` },
    { zeit: plusMin(a1.createdAt, 3), akteur: "ki", key: "posteingang-fristen", text: `Strafbefehl gelesen: Einspruchsfrist (§ 410 StPO) erkannt und berechnet – ${a1.aktenzeichen}` },
  ]);
  verlauf(ctx, a3, [
    { zeit: dt(0, 7, 21), akteur: "automation", key: "zuordnung", text: `Nachricht der Akte ${a3.aktenzeichen} zugeordnet` },
  ]);
}

// ───────────────────────── Berlin: Zusatzakten (am Ende erzeugt) ─────────────────────────
// Werden NACH dem übrigen Bestand angelegt – mit festen Werten, eigenen IDs (hero-guete-…, hero-rsv-…) und ohne Zufallszug,
// damit Zufallsfolge, IDs und Aktenzeichen aller übrigen Akten, Fristen und Nachrichten unverändert bleiben.
// Keine Posteingangsnachrichten, keine Frist und kein Termin heute (Morgenzahlen des Cockpits bleiben gleich).

/** Kontakt mit fester ID und festen Daten (ohne Zufall). */
function festerKontakt(ctx: Ctx, k: Omit<Kontakt, "createdAt"> & { createdAt?: string }): Kontakt {
  const voll: Kontakt = { createdAt: k.createdAt ?? ctx.dt(-60, 9, 0), ...k };
  ctx.data.kontakte.push(voll);
  return voll;
}
function festesDok(ctx: Ctx, d: Omit<Dokument, "version" | "groesseKb"> & { groesseKb?: number }): Dokument {
  const dok: Dokument = { version: 1, groesseKb: d.groesseKb ?? 180, ...d };
  ctx.data.dokumente.push(dok);
  return dok;
}

export function zusatzBerlin(ctx: Ctx) {
  const { d, dt, data } = ctx;
  const [julia, jonas] = ctx.anwaelte;
  const mia = ctx.refas[0];
  const G = STAEDTE.berlin.gerichte;
  const naechsteNr = () => nextAz(ctx, Math.max(100, ...ctx.usedAz) + 1);

  // 1) T14 „mobil am Gericht“: Kündigungsschutz Ostermann – Klage eingereicht, Gütetermin in den nächsten Tagen
  // Anschrift des Arbeitsgerichts aus der Stammliste – dieselbe Quelle für Kontakt, Klageschrift, Ladung und Terminsort (I5-T17-01)
  const arbgAdr = GERICHTSANSCHRIFTEN[G.arbg];
  const arbgStrasse = arbgAdr.strasse ?? "";
  const arbgOrt = [arbgAdr.plz, arbgAdr.ort].filter(Boolean).join(" ");
  const arbg = data.kontakte.find((k) => k.name === G.arbg) ?? festerKontakt(ctx, { id: "hero-guete-k-arbg", typ: "organisation", name: G.arbg, firma: G.arbg, rollen: ["gericht"], strasse: arbgAdr.strasse, plz: arbgAdr.plz, ort: arbgAdr.ort });
  const ostermann = festerKontakt(ctx, {
    id: "hero-guete-k1", typ: "person", name: "Katrin Ostermann", vorname: "Katrin", nachname: "Ostermann", anrede: "Frau",
    email: "katrin.ostermann@posteo.de", telefon: "+49 157 3390 2716", strasse: "Gotzkowskystraße 17", plz: "10555", ort: "Berlin", rollen: ["mandant"], createdAt: dt(-24, 9, 40),
  });
  const havelbrueck = festerKontakt(ctx, {
    id: "hero-guete-k2", typ: "organisation", name: "Havelbrück Pflegedienste GmbH", firma: "Havelbrück Pflegedienste GmbH",
    email: "personal@havelbrueck-pflege.de", telefon: "+49 30 4471 2280", strasse: "Havelchaussee 66", plz: "14193", ort: "Berlin", rollen: ["gegner"], createdAt: dt(-24, 9, 45),
  });
  const tanneberg = festerKontakt(ctx, {
    id: "hero-guete-k3", typ: "organisation", name: "Tanneberg & Sternberg Rechtsanwälte PartG mbB", firma: "Tanneberg & Sternberg Rechtsanwälte PartG mbB",
    email: "kanzlei@tanneberg-sternberg.de", telefon: "+49 30 8812 4400", strasse: "Kurfürstendamm 52", plz: "10707", ort: "Berlin", rollen: ["gegneranwalt"], safeId: "DE.BRAK.5f2c71a0-8e14-4b8b-9d0a-3c55a7e01b62.6b1e", createdAt: dt(-8, 11, 0),
  });
  const kuendigung = d(-27);
  const zugang = d(-26);
  const klageAm = d(-12);
  const guete = ctx.werktag(3);
  const gerichtsAz = `28 Ca 11873/${ctx.yy}`;
  const ost: Akte = {
    id: "hero-guete-a1", aktenzeichen: naechsteNr(), titel: "Ostermann ./. Havelbrück Pflegedienste GmbH", sachgebiet: "Arbeitsrecht", phase: "Gerichtlich", status: "offen",
    mandantId: ostermann.id, gegnerId: havelbrueck.id, gegneranwaltId: tanneberg.id, gerichtId: arbg.id, gerichtsAz,
    gegenstandswert: 11700, bearbeiterId: julia.id, sachbearbeiterId: mia?.id,
    rsv: { versicherung: "Spreebogen Rechtsschutz VVaG", versicherungsnummer: "RS-6604418", schadennummer: `S${ctx.yy}-73390`, deckung: "erteilt", selbstbeteiligung: 150 },
    beschreibung: "Ordentliche, auf betriebliche Gründe gestützte Kündigung einer Pflegefachkraft nach zehn Jahren Betriebszugehörigkeit (Bruttomonatsgehalt 3.900 €). Die Arbeitgeberin beruft sich auf die Schließung der Tagespflege Spandau; die Sozialauswahl ist nicht nachvollziehbar. Kündigungsschutzklage beim Arbeitsgericht Berlin eingereicht, Gütetermin steht an.",
    schlagworte: ["kündigungsschutz", "betriebsbedingt", "sozialauswahl", "gütetermin", "pflege", "kündigungsschutzklage"],
    prioritaet: "normal", createdAt: dt(-24, 10, 0), updatedAt: dt(-8, 14, 30), mandantenportal: true,
  };
  data.akten.push(ost);
  const dok = (n: number, x: Omit<Dokument, "id" | "akteId" | "version" | "groesseKb"> & { groesseKb?: number }) => festesDok(ctx, { id: `hero-guete-d${n}`, akteId: ost.id, ...x });
  dok(1, {
    name: `Kündigungsschreiben vom ${fmtDate(kuendigung)}`, art: "brief", ordner: "Mandant", format: "pdf", quelle: "scan", seiten: 2, createdAt: dt(-24, 10, 20),
    inhalt: `Havelbrück Pflegedienste GmbH · Havelchaussee 66 · 14193 Berlin\n\nFrau Katrin Ostermann\nGotzkowskystraße 17\n10555 Berlin\n\nBerlin, ${fmtDate(kuendigung)}\n\nOrdentliche Kündigung\n\nSehr geehrte Frau Ostermann,\n\nhiermit kündigen wir das mit Ihnen seit dem 01.03.2016 bestehende Arbeitsverhältnis ordentlich und fristgerecht zum ${fmtDate(addDays(kuendigung, 92))}. Grund ist die Schließung unserer Tagespflege in Spandau zum Jahresende; eine Weiterbeschäftigung an einem anderen Standort ist nicht möglich.\n\nDer Betriebsrat wurde angehört. Auf die Pflicht zur Arbeitsuchendmeldung (§ 38 Abs. 1 SGB III) weisen wir hin.\n\nMit freundlichen Grüßen\nHavelbrück Pflegedienste GmbH\n– Geschäftsführung –\n\nZugegangen per Einwurf-Einschreiben am ${fmtDate(zugang)}.`,
    ki: { zusammenfassung: "Ordentliche, betriebsbedingte Kündigung (Schließung Tagespflege Spandau). Zugang per Einwurf-Einschreiben.", erkannteFristen: 1 },
  });
  dok(2, {
    name: "Arbeitsvertrag vom 01.03.2016", art: "vertrag", ordner: "Mandant", format: "pdf", quelle: "email", seiten: 7, createdAt: dt(-24, 10, 25),
    inhalt: "Arbeitsvertrag zwischen der Havelbrück Pflegedienste GmbH und Frau Katrin Ostermann. Beginn: 01.03.2016. Tätigkeit: Pflegefachkraft, Einsatzort nach Dienstplan (Standorte Spandau und Charlottenburg). Bruttomonatsvergütung zuletzt 3.900 €. Kündigungsfristen nach § 622 BGB.",
  });
  dok(3, {
    name: "Gesprächsnotiz Erstberatung", art: "notiz", ordner: "Mandant", format: "docx", quelle: "generiert", autorId: julia.id, seiten: 1, createdAt: dt(-24, 11, 5),
    inhalt: `Erstberatung mit Frau Ostermann am ${fmtDate(d(-24))} (Dauer 40 Min.).\n• 46 Jahre, ledig, ein unterhaltsberechtigtes Kind (12), seit 01.03.2016 bei Havelbrück, Pflegefachkraft.\n• Kündigung wegen Schließung der Tagespflege Spandau; am Standort Charlottenburg werden weiter Pflegefachkräfte gesucht (Stellenanzeige liegt vor).\n• Sozialauswahl: Zwei jüngere Kolleginnen ohne Unterhaltspflichten wurden nach Charlottenburg versetzt.\n• Ziel: Weiterbeschäftigung, hilfsweise Abfindung.\n• Rechtsschutz: Spreebogen Rechtsschutz VVaG, Deckung erteilt.\n• Kostenhinweise (§ 49b Abs. 5 BRAO, § 12a Abs. 1 S. 2 ArbGG) vor Mandatsübernahme erteilt.`,
  });
  dok(4, {
    name: "Vollmacht (digital unterzeichnet)", art: "vollmacht", ordner: "Mandant", format: "pdf", quelle: "generiert", seiten: 1, createdAt: dt(-24, 11, 30),
    inhalt: "Prozessvollmacht Katrin Ostermann für Hartmann & Partner Rechtsanwälte, digital unterzeichnet.", portal: { am: dt(-24, 11, 45), vonId: julia.id },
  });
  dok(5, {
    name: "Klageschrift (Kündigungsschutzklage)", art: "schriftsatz", ordner: "Schriftsätze", format: "docx", quelle: "generiert", autorId: julia.id, seiten: 5, createdAt: dt(-12, 15, 5), status: "versandt",
    portal: { am: dt(-12, 15, 40), vonId: julia.id },
    inhalt: `An das\n${G.arbg}\n${arbgStrasse}\n${arbgOrt}\n\nKlage\n\nder Frau Katrin Ostermann, Gotzkowskystraße 17, 10555 Berlin\n– Klägerin –\nProzessbevollmächtigte: Hartmann & Partner Rechtsanwälte\n\ngegen\n\ndie Havelbrück Pflegedienste GmbH, Havelchaussee 66, 14193 Berlin\n– Beklagte –\n\nwegen: Kündigungsschutz\nStreitwert (vorläufig): 11.700,00 € (drei Bruttomonatsentgelte, § 42 Abs. 2 S. 1 GKG)\n\nNamens und in Vollmacht der Klägerin erheben wir Klage und werden beantragen:\n\n1. Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die Kündigung der Beklagten vom ${fmtDate(kuendigung)} nicht aufgelöst wird.\n2. Die Beklagte wird verurteilt, die Klägerin bis zum rechtskräftigen Abschluss des Verfahrens zu unveränderten Arbeitsbedingungen als Pflegefachkraft weiterzubeschäftigen.\n\nBegründung:\nDie Kündigung ist sozial ungerechtfertigt (§ 1 Abs. 2, 3 KSchG). Eine Weiterbeschäftigung am Standort Charlottenburg ist möglich; die Sozialauswahl ist fehlerhaft. Die ordnungsgemäße Anhörung des Betriebsrats (§ 102 BetrVG) wird mit Nichtwissen bestritten.\n\nDr. Julia Hartmann\nRechtsanwältin\n\nÜbermittelt per beA am ${fmtDate(klageAm)}.`,
  });
  dok(6, {
    name: `Ladung zum Gütetermin am ${fmtDate(guete)}`, art: "beschluss", ordner: "Gericht", format: "pdf", quelle: "bea", seiten: 2, createdAt: dt(-8, 14, 12),
    inhalt: `Arbeitsgericht Berlin\nGeschäftszeichen: ${gerichtsAz}\n\nIn dem Rechtsstreit Ostermann ./. Havelbrück Pflegedienste GmbH wird Termin zur Güteverhandlung (§ 54 ArbGG) bestimmt auf\n\n${fmtDateLong(guete)}, 09:00 Uhr, Saal 3,\n${G.arbg}, ${arbgStrasse}, ${arbgOrt}.\n\nDas persönliche Erscheinen der Parteien wird angeordnet (§ 51 Abs. 1 ArbGG). Bleibt eine Partei aus, kann ein Ordnungsgeld festgesetzt werden.\n\nAuf Anordnung\nJustizbeschäftigte als Urkundsbeamtin der Geschäftsstelle`,
    ki: { zusammenfassung: `Ladung zur Güteverhandlung am ${fmtDate(guete)}, 9:00 Uhr, Saal 3; persönliches Erscheinen angeordnet.` },
  });
  // Klagefrist (§ 4 S. 1 KSchG): rechtzeitig eingereicht – erledigt mit Nachweis
  const kf = berechneNachRegel("kschg_klage", zugang, ctx.tenant.bundesland, undefined, { feiertagsOrt: `${G.arbg} – laut Akte` });
  const klagefrist: Frist = {
    id: "hero-guete-f1", akteId: ost.id, titel: kf.regel.titel, typ: kf.regel.typ, datum: kf.ende, vorfrist: kf.vorfrist, regelKey: "kschg_klage", grundlage: kf.regel.grundlage,
    ereignisDatum: zugang, rechenweg: kf.rechenweg, status: "erledigt", erledigtAm: dt(-12, 15, 22), erledigtVon: julia.id, verantwortlichId: julia.id, quelle: "ki",
    kontrolliertVon: mia?.id, createdAt: dt(-24, 10, 21),
    erledigtNachweis: { art: "bea", text: "Kündigungsschutzklage per beA an das Arbeitsgericht Berlin übermittelt (Eingangsbestätigung liegt vor)", versandAm: dt(-12, 15, 18) },
  };
  const termin: Frist = {
    id: "hero-guete-f2", akteId: ost.id, titel: "Gütetermin", typ: "termin", datum: guete, uhrzeit: "09:00", ort: `${G.arbg}, ${arbgStrasse}, Saal 3`,
    status: "offen", verantwortlichId: julia.id, quelle: "ki", createdAt: dt(-8, 14, 13), notiz: "Persönliches Erscheinen der Mandantin angeordnet (§ 51 Abs. 1 ArbGG).",
  };
  klagefrist.verantwortlichId = fristVerantwortung(ctx, klagefrist);
  data.fristen.push(klagefrist, termin);
  const zeitpunkte: [string, Aktivitaet["akteur"], string, string?, string?][] = [
    [dt(-24, 10, 1), "automation", `Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) erstellt und zur Freigabe vorgelegt – ${ost.aktenzeichen}`, "mandatsaufnahme"],
    [dt(-24, 10, 21), "ki", `Kündigungsschreiben gelesen: Klagefrist nach § 4 S. 1 KSchG erkannt und berechnet – ${ost.aktenzeichen}`, "posteingang-fristen"],
    [dt(-12, 15, 18), "nutzer", `Kündigungsschutzklage per beA an das Arbeitsgericht Berlin übermittelt – ${ost.aktenzeichen}`, undefined, julia.id],
    [dt(-12, 15, 22), "nutzer", `Klagefrist (§ 4 KSchG) als erledigt markiert – Nachweis: beA-Versand ${fmtDate(klageAm)}, 15:18 Uhr – ${ost.aktenzeichen}`, undefined, julia.id],
    [dt(-8, 14, 13), "ki", `Ladung erkannt: Gütetermin am ${fmtDate(guete)}, 9:00 Uhr eingetragen – ${ost.aktenzeichen}`, "posteingang-fristen"],
  ];
  zeitpunkte.forEach(([zeit, akteur, text, key, userId], i) => {
    const def = key ? AUTOMATION_DEFS.find((x) => x.key === key) : undefined;
    data.aktivitaeten.push({ id: `hero-guete-ak${i + 1}`, zeit, akteur, akteId: ost.id, text, userId, automationKey: key, minutenGespart: akteur === "nutzer" ? undefined : def?.minutenProLauf });
  });

  // 2) Weitere abrechenbare RSV-Akten mit erteilter Deckung (Sammelabrechnung: „4 RSV-Akten in einem Durchgang“)
  const rsvAkten: { nr: number; mandant: Omit<Kontakt, "id" | "rollen" | "createdAt">; gegner: Omit<Kontakt, "id" | "rollen" | "createdAt">; akte: Pick<Akte, "titel" | "sachgebiet" | "gegenstandswert" | "beschreibung" | "schlagworte" | "rsv">; bearbeiter: string; tage: number }[] = [
    {
      nr: 1, bearbeiter: julia.id, tage: 41,
      mandant: { typ: "person", name: "Doris Engelke", vorname: "Doris", nachname: "Engelke", anrede: "Frau", email: "doris.engelke@web.de", telefon: "+49 160 4471 9023", strasse: "Sonnenallee 112", plz: "12045", ort: "Berlin" },
      gegner: { typ: "organisation", name: "Stadtwerke Spreetal GmbH", firma: "Stadtwerke Spreetal GmbH", email: "personal@stadtwerke-spreetal.de", strasse: "Spreeufer 4", plz: "10178", ort: "Berlin" },
      akte: {
        titel: "Engelke ./. Stadtwerke Spreetal GmbH (Zeugnis)", sachgebiet: "Arbeitsrecht", gegenstandswert: 3900,
        beschreibung: "Berichtigung des Arbeitszeugnisses (Leistungsbeurteilung „stets zu unserer Zufriedenheit“ statt „vollsten“). Außergerichtliche Aufforderung mit Fristsetzung versandt.",
        schlagworte: ["arbeitszeugnis", "zeugnisberichtigung", "leistungsbeurteilung"],
        rsv: { versicherung: "Spreebogen Rechtsschutz VVaG", versicherungsnummer: "RS-3318842", schadennummer: `S${ctx.yy}-50311`, deckung: "erteilt", selbstbeteiligung: 150 },
      },
    },
    {
      nr: 2, bearbeiter: jonas.id, tage: 55,
      mandant: { typ: "person", name: "Malte Rehbein", vorname: "Malte", nachname: "Rehbein", anrede: "Herr", email: "malte.rehbein@gmx.de", telefon: "+49 151 2290 6614", strasse: "Allee der Kosmonauten 31", plz: "12681", ort: "Berlin" },
      gegner: { typ: "organisation", name: "Wohnungsgenossenschaft Marzahn-Ost eG", firma: "Wohnungsgenossenschaft Marzahn-Ost eG", email: "vermietung@wg-marzahn-ost.de", strasse: "Landsberger Allee 520", plz: "12681", ort: "Berlin" },
      akte: {
        titel: "Rehbein ./. Wohnungsgenossenschaft Marzahn-Ost eG", sachgebiet: "Mietrecht", gegenstandswert: 1680,
        beschreibung: "Mieterhöhungsverlangen um 140 € monatlich (§ 558 BGB) – Vergleichswohnungen nicht vergleichbar, Kappungsgrenze überschritten. Zustimmung außergerichtlich verweigert, Begründung gegenüber der Vermieterin.",
        schlagworte: ["mieterhöhung", "558 bgb", "kappungsgrenze", "vergleichswohnungen"],
        rsv: { versicherung: "Nordlicht Rechtsschutz AG", versicherungsnummer: "RS-5520917", schadennummer: `S${ctx.yy}-60824`, deckung: "erteilt", selbstbeteiligung: 250 },
      },
    },
    {
      nr: 3, bearbeiter: jonas.id, tage: 33,
      mandant: { typ: "person", name: "Henrik Vossberg", vorname: "Henrik", nachname: "Vossberg", anrede: "Herr", email: "henrik.vossberg@posteo.de", telefon: "+49 176 3381 4507", strasse: "Prenzlauer Allee 188", plz: "10405", ort: "Berlin" },
      gegner: { typ: "organisation", name: "Reiseveranstalter Sonnenkap GmbH", firma: "Reiseveranstalter Sonnenkap GmbH", email: "kundenservice@sonnenkap-reisen.de", strasse: "Friedrichstraße 95", plz: "10117", ort: "Berlin" },
      akte: {
        titel: "Vossberg ./. Reiseveranstalter Sonnenkap GmbH (Reisemangel)", sachgebiet: "Vertragsrecht", gegenstandswert: 2400,
        beschreibung: "Minderung des Reisepreises wegen Baulärms und fehlenden Pools (§ 651m BGB); Mängelanzeige vor Ort dokumentiert. Anspruch außergerichtlich geltend gemacht.",
        schlagworte: ["reisemangel", "minderung", "pauschalreise", "651m bgb"],
        rsv: { versicherung: "Isarwerk Versicherung AG", versicherungsnummer: "RS-7740265", schadennummer: `S${ctx.yy}-71956`, deckung: "erteilt", selbstbeteiligung: 0 },
      },
    },
  ];
  for (const r of rsvAkten) {
    const m = festerKontakt(ctx, { id: `hero-rsv-k${r.nr}m`, rollen: ["mandant"], createdAt: dt(-r.tage, 9, 10), ...r.mandant });
    const g = festerKontakt(ctx, { id: `hero-rsv-k${r.nr}g`, rollen: ["gegner"], createdAt: dt(-r.tage, 9, 12), ...r.gegner });
    const a: Akte = {
      id: `hero-rsv-a${r.nr}`, aktenzeichen: naechsteNr(), phase: "Außergerichtlich", status: "offen", mandantId: m.id, gegnerId: g.id,
      bearbeiterId: r.bearbeiter, sachbearbeiterId: mia?.id, prioritaet: "normal", createdAt: dt(-r.tage, 9, 30), updatedAt: dt(-r.tage + 9, 11, 0), ...r.akte,
    };
    data.akten.push(a);
    festesDok(ctx, { id: `hero-rsv-d${r.nr}a`, akteId: a.id, name: "Vollmacht", art: "vollmacht", ordner: "Mandant", format: "pdf", quelle: "generiert", seiten: 1, createdAt: dt(-r.tage, 9, 45), inhalt: `Vollmacht: ${m.name} bevollmächtigt ${ctx.tenant.name} in der Sache ${a.titel}.` });
    festesDok(ctx, {
      id: `hero-rsv-d${r.nr}b`, akteId: a.id, name: `Deckungszusage ${r.akte.rsv!.versicherung}`, art: "brief", ordner: "Korrespondenz", format: "pdf", quelle: "email", seiten: 1, createdAt: dt(-r.tage + 6, 10, 15),
      inhalt: `${r.akte.rsv!.versicherung} – Schaden-Nr. ${r.akte.rsv!.schadennummer}\n\nVersicherungsnehmer: ${m.name} (${r.akte.rsv!.versicherungsnummer})\n\nWir erteilen Deckungszusage für die außergerichtliche Interessenwahrnehmung in der Angelegenheit ${a.titel}. Selbstbeteiligung: ${r.akte.rsv!.selbstbeteiligung ? `${r.akte.rsv!.selbstbeteiligung} €` : "keine"}.`,
    });
    festesDok(ctx, {
      id: `hero-rsv-d${r.nr}c`, akteId: a.id, name: `Aufforderungsschreiben an ${g.name}`, art: "brief", ordner: "Korrespondenz", format: "docx", quelle: "generiert", autorId: r.bearbeiter, seiten: 2, status: "versandt", createdAt: dt(-r.tage + 9, 11, 0),
      inhalt: `${g.name}\n${g.strasse}\n${g.plz} ${g.ort}\n\nIn der Angelegenheit ${a.titel} zeigen wir an, dass wir ${m.anrede === "Frau" ? "Frau" : "Herrn"} ${m.nachname} vertreten. ${r.akte.beschreibung}\n\nMit freundlichen Grüßen\n${ctx.tenant.name}`,
    });
  }
}

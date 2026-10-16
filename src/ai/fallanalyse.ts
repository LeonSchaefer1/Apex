// KI-Fallanalyse: Sachverhalt → Rechtsfragen → Präzedenzfälle → Erfolgsaussicht → nächste Schritte → Entwurf.
import { addDays, diffDays, fmtDate, fmtEUR, today } from "@/core/dates";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import { deckungsanfrageStatus, deckungsText, stufeAusProzent } from "@/core/einschaetzung";
import type { Akte, Frist, Kontakt, TenantData } from "@/core/types";
import { forderungskonto, type ForderungsVorgang } from "@/core/zinsen";
import { istConsole } from "@/lib/backend";
import { useSession } from "@/store/session";
import { akteAlsText, bewertePraezedenz, findePraezedenzfaelle, kontaktName, relevanzProzent, type Treffer } from "./kontext";
import { DemoModus, llmJson, aktuelleQuelle } from "./llm";
import type { KiQuelle } from "./status";

export interface Fallanalyse {
  zusammenfassung: string;
  rechtsfragen: string[];
  erfolgsaussicht: { prozent: number; stufe: "hoch" | "mittel" | "gering"; begruendung: string };
  argumentePro: string[];
  argumenteContra: string[];
  praezedenzfaelle: { id: string; gericht: string; az: string; titel: string; relevanz: number; warum: string }[];
  naechsteSchritte: { titel: string; detail: string }[];
  risiken: string[];
  entwurf: { titel: string; text: string };
  quelle: KiQuelle;
  dauerMs: number;
  erstelltAm: string;
}

export const ANALYSE_PHASEN = [
  "Akte und Dokumente lesen",
  "Sachverhalt strukturieren",
  "Fall-Datenbank durchsuchen",
  "Rechtliche Würdigung",
  "Nächste Schritte & Entwurf",
] as const;

function stufe(p: number): "hoch" | "mittel" | "gering" {
  return stufeAusProzent(p);
}

/** Echter Stand der Deckung statt „läuft automatisch“: Zusage, Entwurf zur Freigabe, versandt am … von … */
export function deckungsDetail(akte: Akte, data: TenantData): string {
  const vers = akte.rsv?.versicherung ?? "der Rechtsschutzversicherung";
  if (akte.rsv?.deckung === "erteilt") return `Deckungszusage von ${vers} liegt vor.`;
  if (akte.rsv?.deckung === "abgelehnt") return `${vers} hat die Deckung abgelehnt – Mandantschaft informieren, ggf. Stichentscheid (§ 128 VVG) prüfen.`;
  const s = deckungsanfrageStatus(akte.id, data.aktivitaeten, data.dokumente);
  const name = (id: string) => {
    const sz = useSession.getState().sitzung;
    return sz && !istConsole(sz) ? sz.team.find((u) => u.id === id)?.name : undefined;
  };
  const wv = data.fristen.find((f) => f.akteId === akte.id && f.status === "offen" && f.typ === "wiedervorlage" && /deckung/i.test(f.titel));
  const wvText = wv ? ` Wiedervorlage am ${fmtDate(wv.datum)} gesetzt.` : "";
  if (s.status === "keine") return `Deckungsanfrage an ${vers}: ${deckungsText(s)} – das Mandatsaufnahme-Paket bereitet sie zur Freigabe vor.${wvText}`;
  return `Deckungsanfrage an ${vers}: ${deckungsText(s, name, (iso) => fmtDate(iso.slice(0, 10)))}${s.status === "entwurf" ? " (E-Akte, Ordner „Korrespondenz“)" : ""}.${wvText}`;
}

/** Schritte zur Deckung nennen immer den tatsächlichen Stand – auch bei Antworten der Live-KI. */
function mitDeckungsstand(schritte: { titel: string; detail: string }[], akte: Akte, data: TenantData): { titel: string; detail: string }[] {
  if (!akte.rsv && !data.dokumente.some((d) => d.akteId === akte.id && /deckungsanfrage/i.test(d.name))) return schritte;
  return schritte.map((x) => (/deckung/i.test(`${x.titel}`) ? { titel: x.titel, detail: deckungsDetail(akte, data) } : x));
}

/** Verfasser eines Entwurfs (Unterschrift). */
export interface Verfasser {
  name: string;
  titel?: string;
}

/** Bearbeiter der Akte aus der Sitzung – sonst die angemeldete Person. */
function verfasserAusSitzung(akte: Akte): Verfasser | undefined {
  const s = useSession.getState().sitzung;
  if (!s || istConsole(s)) return undefined;
  const u = s.team.find((x) => x.id === akte.bearbeiterId) ?? s.user;
  return u ? { name: u.name, titel: u.titel } : undefined;
}

function unterschrift(v: Verfasser | undefined): string {
  if (!v) return "[Name]\nRechtsanwältin / Rechtsanwalt";
  const titel = (v.titel ?? "").split(/\s*·\s*/).filter(Boolean);
  return [v.name, ...(titel.length ? titel : ["Rechtsanwältin / Rechtsanwalt"])].join("\n");
}

/** Datum des Kündigungsschreibens und Zugangsdatum aus der E-Akte (Kündigungsdatum ≠ Zugang!). */
export function kuendigungsDaten(akte: Akte, data: TenantData): { kuendigung?: string; zugang?: string } {
  const doks = data.dokumente.filter((d) => d.akteId === akte.id && (/kündigung/i.test(d.name) || /hiermit kündigen wir/i.test(d.inhalt)));
  let kuendigung: string | undefined;
  let zugang: string | undefined;
  for (const d of doks) {
    kuendigung ??= d.name.match(/vom (\d{2}\.\d{2}\.\d{4})/)?.[1] ?? d.inhalt.match(/^[A-ZÄÖÜ][\wÄÖÜäöüß .()-]*, (?:den )?(\d{2}\.\d{2}\.\d{4})\s*$/m)?.[1];
    zugang ??= d.inhalt.match(/zugegangen[^0-9\n]{0,40}(\d{2}\.\d{2}\.\d{4})/i)?.[1];
  }
  const frist = data.fristen.find((f) => f.akteId === akte.id && f.regelKey === "kschg_klage" && f.ereignisDatum);
  if (!zugang && frist?.ereignisDatum) zugang = fmtDate(frist.ereignisDatum);
  return { kuendigung, zugang };
}

function praezedenzListe(treffer: Treffer[], warum: Record<string, string> = {}) {
  const max = treffer[0]?.score ?? 1;
  return treffer.map((t) => ({
    id: t.entscheidung.id,
    gericht: t.entscheidung.gericht,
    az: t.entscheidung.az,
    titel: t.entscheidung.titel,
    relevanz: relevanzProzent(t.score, max),
    warum: warum[t.entscheidung.id] ?? `Gemeinsame Merkmale: ${t.gemeinsam.slice(0, 3).join(", ") || t.entscheidung.rechtsgebiet}. ${t.entscheidung.bedeutung}`,
  }));
}

/** Kuratierte Präzedenzfälle in fester Reihenfolge – mit ihrer tatsächlich berechneten Relevanz. */
function kuratierteListe(akte: Akte, data: TenantData, treffer: Treffer[], warum: Record<string, string>) {
  const liste = Object.keys(warum)
    .map((id) => treffer.find((t) => t.entscheidung.id === id) ?? (() => {
      const e = ENTSCHEIDUNGEN.find((x) => x.id === id);
      return e ? bewertePraezedenz(akte, data, e) : undefined;
    })())
    .filter((t): t is Treffer => !!t);
  const max = Math.max(1, ...liste.map((t) => t.score));
  return liste.map((t, i) => ({
    id: t.entscheidung.id,
    gericht: t.entscheidung.gericht,
    az: t.entscheidung.az,
    titel: t.entscheidung.titel,
    // Reihenfolge der Kuratierung bleibt erhalten, auch wenn ein späterer Fall rechnerisch knapp höher läge
    relevanz: Math.min(relevanzProzent(t.score, max), i === 0 ? 99 : 98 - i * 2),
    warum: warum[t.entscheidung.id],
  }));
}

// ───────────── Offline-Analysen (Demo-Modus) ─────────────

function demoAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser?: Verfasser): Omit<Fallanalyse, "quelle" | "dauerMs" | "erstelltAm"> {
  const mandant = kontaktName(data, akte.mandantId) ?? "Mandant";
  const gegner = kontaktName(data, akte.gegnerId) ?? "Gegenseite";
  const frist = offeneFristen(akte, data)[0];
  const fristText = frist ? `${frist.titel} bis ${fmtDate(frist.datum)}` : undefined;
  // Die ausformulierten Analysen gehören zu den Präsentationsakten – andere Akten mit ähnlichem Thema erhalten die allgemeine Analyse.
  const praesentation = akte.id.startsWith("hero-");

  if (praesentation && akte.sachgebiet === "Arbeitsrecht" && /fristlos|bagatell|kaffee|geringwertig/i.test(akte.beschreibung)) {
    const kd = kuendigungsDaten(akte, data);
    const kuendigungVom = kd.kuendigung ? ` vom ${kd.kuendigung}` : " vom [Datum des Kündigungsschreibens]";
    const zugegangen = kd.zugang ? `, dem Kläger zugegangen am ${kd.zugang},` : "";
    // § 38 Abs. 1 S. 2 SGB III: Meldung binnen drei Tagen ab Kenntnis des Beendigungszeitpunkts (hier: Zugang der fristlosen Kündigung)
    const zugangIso = data.fristen.find((f) => f.akteId === akte.id && f.regelKey === "kschg_klage")?.ereignisDatum ?? isoAusDe(kd.zugang);
    const meldungVerspaetet = !!zugangIso && diffDays(zugangIso, today()) > 3;
    const meldeSchritt = meldungVerspaetet
      ? { titel: "Arbeitsuchendmeldung sofort nachholen", detail: "Die Dreitagesfrist ab Kenntnis der Beendigung (§ 38 Abs. 1 S. 2 SGB III) ist bereits verstrichen. Meldung bei der Agentur für Arbeit sofort nachholen; wegen der verspäteten Meldung droht eine Sperrzeit von einer Woche (§ 159 Abs. 1 S. 2 Nr. 7, Abs. 6 SGB III)." }
      : { titel: "Mandanten auf § 38 SGB III hinweisen", detail: "Arbeitsuchendmeldung innerhalb von drei Tagen nach Kenntnis der Beendigung (§ 38 Abs. 1 S. 2 SGB III) – sonst droht eine Sperrzeit von einer Woche (§ 159 Abs. 1 S. 2 Nr. 7, Abs. 6 SGB III)." };
    return {
      zusammenfassung: `${mandant} (52) ist seit 14 Jahren ohne Abmahnung bei der ${gegner} beschäftigt und wurde fristlos, hilfsweise ordentlich gekündigt, weil er drei beschädigte, zur Entsorgung bestimmte Kaffeepackungen (8,97 €) mitgenommen haben soll. Eine Anhörung vor der Kündigung fand nicht statt; nach Angaben des Mandanten wurde die Mitnahme von Bruchware durch den Schichtleiter geduldet.`,
      rechtsfragen: [
        "Liegt ein wichtiger Grund nach § 626 Abs. 1 BGB vor – und überwiegt das Beendigungsinteresse nach 14 Jahren ungestörter Beschäftigung?",
        "Wäre eine Abmahnung als milderes Mittel ausreichend gewesen (Verhältnismäßigkeit)?",
        "Ist die hilfsweise ordentliche Kündigung sozial gerechtfertigt (§ 1 Abs. 2 KSchG, verhaltensbedingt)?",
        "Wurde der Betriebsrat ordnungsgemäß angehört (§ 102 BetrVG)?",
        "Wurde die Zwei-Wochen-Frist des § 626 Abs. 2 BGB gewahrt?",
      ],
      erfolgsaussicht: {
        prozent: 78,
        stufe: "hoch",
        begruendung: "Nach der „Emmely“-Rechtsprechung des BAG fällt das über 14 Jahre aufgebaute Vertrauen erheblich ins Gewicht; der Schaden ist minimal, die Ware war zur Entsorgung bestimmt und eine Duldung durch Vorgesetzte steht im Raum. Eine Abmahnung hätte genügt. Hinzu kommen mögliche formelle Fehler (Betriebsratsanhörung).",
      },
      argumentePro: [
        "14 Jahre beanstandungsfreie Betriebszugehörigkeit – hohes „Vertrauenskapital“ (BAG 2 AZR 541/09).",
        "Geringer Wert (8,97 €), Ware war beschädigt und zur Entsorgung bestimmt – kein echter Vermögensschaden (Kündigungsschreiben).",
        "Duldung durch den Schichtleiter: Mandant durfte annehmen, die Mitnahme sei erlaubt (Zeuge: Kollege Pohl; Gesprächsnotiz Erstberatung).",
        "Keine vorherige Abmahnung, keine Anhörung des Mandanten (Gesprächsnotiz Erstberatung).",
        "Soziale Gesichtspunkte: 52 Jahre, zwei unterhaltsberechtigte Kinder (Gesprächsnotiz Erstberatung).",
      ],
      argumenteContra: [
        "Auch Bagatelldelikte können grundsätzlich einen wichtigen Grund nach § 626 Abs. 1 BGB darstellen.",
        "Falls es eine klare, bekannte Anweisung „Bruchware ist Eigentum des Betriebs“ gab, schwächt das die Duldungsargumentation.",
        "Mögliche Videoaufzeichnung könnte den Vorgang belegen (vgl. BAG 2 AZR 133/18) – Verwertbarkeit prüfen.",
      ],
      praezedenzfaelle: kuratierteListe(akte, data, treffer, {
        "bag-2azr541-09": "Fast identische Konstellation: geringwertige Sache, langjährige ungestörte Beschäftigung – Kündigung unwirksam, Abmahnung hätte genügt.",
        "bag-2azr133-18": "Relevant, falls die Arbeitgeberin Videoaufnahmen aus dem Lager vorlegt: Verwertbarkeit offener Videoüberwachung.",
        "bag-2azr681-16": "Falls Beweise aus verdeckter Überwachung stammen: Beweisverwertungsverbot.",
      }),
      naechsteSchritte: [
        { titel: `Kündigungsschutzklage beim Arbeitsgericht einreichen`, detail: `${fristText ?? "Klagefrist nach § 4 KSchG beachten"} – Entwurf liegt unten bereit.` },
        { titel: "Betriebsratsanhörung anfordern", detail: "Im Gütetermin vollständige Unterlagen zur Anhörung nach § 102 BetrVG verlangen; Fehler führen zur Unwirksamkeit." },
        { titel: "Zeugen benennen", detail: "Kollege Pohl und Schichtleiter zur gelebten Praxis bei Bruchware befragen." },
        meldeSchritt,
        { titel: "Deckungszusage der Rechtsschutzversicherung", detail: deckungsDetail(akte, data) },
      ],
      risiken: [
        "Kostenrisiko gering: In der 1. Instanz trägt jede Partei ihre Anwaltskosten selbst (§ 12a Abs. 1 S. 1 ArbGG); Rechtsschutz angefragt.",
        "Bei Vergleich: Abfindung realistisch 0,5–1,0 Bruttomonatsgehälter je Beschäftigungsjahr (rund 23.800–47.600 €).",
      ],
      entwurf: {
        titel: "Kündigungsschutzklage (Entwurf)",
        text: `An das\nArbeitsgericht Berlin\n\nKlage\n\ndes Herrn Thomas Weber, Seestraße 41, 13353 Berlin\n– Kläger –\nProzessbevollmächtigte: Hartmann & Partner Rechtsanwälte\n\ngegen\n\ndie Kröger Logistik GmbH, Am Juliusturm 12, 13599 Berlin\n– Beklagte –\n\nwegen: Kündigungsschutz\nStreitwert (vorläufig): 13.600,00 € (Bestandsschutz: drei Bruttomonatsentgelte, § 42 Abs. 2 S. 1 GKG; Weiterbeschäftigung: ein Bruttomonatsentgelt)\n\nNamens und in Vollmacht des Klägers erheben wir Klage und werden beantragen:\n\n1. Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die außerordentliche Kündigung der Beklagten${kuendigungVom}${zugegangen} nicht aufgelöst worden ist.\n2. Es wird festgestellt, dass das Arbeitsverhältnis auch nicht durch die hilfsweise erklärte ordentliche Kündigung${kuendigungVom} aufgelöst wird.\n3. Die Beklagte wird verurteilt, den Kläger bis zum rechtskräftigen Abschluss des Verfahrens zu unveränderten Arbeitsbedingungen als Lagerist weiterzubeschäftigen.\n\nBegründung:\n\nI. Der 52-jährige Kläger ist seit dem 01.04.2012 bei der Beklagten als Lagerist beschäftigt, zuletzt zu einem Bruttomonatsentgelt von 3.400,00 €. Er ist verheiratet und zwei Kindern zum Unterhalt verpflichtet. Das Arbeitsverhältnis verlief in 14 Jahren beanstandungsfrei; eine Abmahnung wurde nie ausgesprochen.\n\nII. Die Beklagte stützt die Kündigung darauf, der Kläger habe drei beschädigte, zur Entsorgung bestimmte Kaffeepackungen im Wert von 8,97 € mitgenommen. Die Mitnahme von Bruchware wurde im Betrieb seit Jahren praktiziert und vom Schichtleiter geduldet.\nBeweis: Zeugnis des Herrn Pohl, zu laden über die Beklagte.\n\nIII. Ein wichtiger Grund im Sinne des § 626 Abs. 1 BGB liegt nicht vor. Nach der Rechtsprechung des Bundesarbeitsgerichts ist bei der Interessenabwägung die durch langjährige, ungestörte Zusammenarbeit entstandene Vertrauensposition zu berücksichtigen (BAG, Urt. v. 10.06.2010 – 2 AZR 541/09). Angesichts des minimalen Werts, der Duldung durch Vorgesetzte und der 14-jährigen Betriebszugehörigkeit wäre eine Abmahnung als milderes Mittel ausreichend gewesen.\n\nIV. Die ordnungsgemäße Anhörung des Betriebsrats nach § 102 BetrVG wird mit Nichtwissen bestritten.\n\n${unterschrift(verfasser)}`,
      },
    };
  }

  if (praesentation && akte.sachgebiet === "Mietrecht" && /kaution|unrenoviert/i.test(akte.beschreibung)) {
    return {
      zusammenfassung: `${mandant} verlangt die Mietkaution von ${fmtEUR(akte.gegenstandswert)} zurück. Die Vermieterin rechnet mit Malerkosten auf. Laut Übergabeprotokoll wurde die Wohnung 2019 unrenoviert übergeben, ein Ausgleich wurde nicht vereinbart. Die Gegenseite bietet einen Vergleich über 1.400 € an.`,
      rechtsfragen: ["Ist die formularmäßige Schönheitsreparaturklausel wirksam, obwohl die Wohnung unrenoviert übergeben wurde?", "Besteht der hilfsweise geltend gemachte Schadensersatz wegen der Einbauküche (640 €)?", "Ist das Vergleichsangebot über 1.400 € wirtschaftlich sinnvoll?"],
      erfolgsaussicht: { prozent: 82, stufe: "hoch", begruendung: "Nach BGH VIII ZR 185/14 ist die Renovierungsklausel bei unrenoviert übergebener Wohnung ohne Ausgleich unwirksam; das Übergabeprotokoll belegt den Zustand. Unsicher ist nur die Gegenforderung wegen der Küche (640 €)." },
      argumentePro: ["Übergabeprotokoll dokumentiert „Wohnung wird unrenoviert übergeben“.", "Kein Mietnachlass oder sonstiger Ausgleich vereinbart.", "Gefestigte BGH-Rechtsprechung (VIII ZR 185/14, VIII ZR 242/13)."],
      argumenteContra: ["Gegenseite behauptet, Mieterin habe den Zustand als „renoviert“ akzeptiert.", "Hilfsaufrechnung mit 640 € wegen Beschädigung der Einbauküche – Beweislage offen."],
      praezedenzfaelle: praezedenzListe(treffer),
      naechsteSchritte: [
        { titel: "Replik einreichen", detail: `${fristText ?? "Frist laut Verfügung"} – Übergabeprotokoll als Anlage K3 vorlegen.` },
        { titel: "Vergleich ablehnen oder Gegenangebot", detail: "Empfehlung: Gegenvorschlag nicht unter 2.400 € (Klageforderung abzüglich Prozessrisiko Küche)." },
        { titel: "Mandantin auf Termin vorbereiten", detail: "Persönliches Erscheinen ist angeordnet – Fragen zur Küche vorab klären." },
      ],
      risiken: [
        "Bei Teilunterliegen wegen der Küche anteilige Kostentragung (§ 92 ZPO).",
        "Unterliegt die Klägerin nur wegen der Hilfsaufrechnung (640 €), liegt ihre Beschwer unter der Berufungssumme von 1.000 € (§ 511 Abs. 2 Nr. 1 ZPO) – eine Berufung wäre dann nur bei Zulassung möglich (§ 511 Abs. 4 ZPO).",
      ],
      entwurf: { titel: "Replik (Entwurf, Auszug)", text: `In dem Rechtsstreit Schneider ./. Lindenhof Hausverwaltung GmbH\n\nnehmen wir zur Klageerwiderung wie folgt Stellung:\n\n1. Die Behauptung, die Klägerin habe die Wohnung als „renoviert“ übernommen, ist unzutreffend. Das von beiden Parteien unterzeichnete Übergabeprotokoll vom 01.08.2019 vermerkt ausdrücklich: „Wohnung wird unrenoviert übergeben.“ (Anlage K3)\n\n2. Damit ist die formularmäßige Überwälzung der Schönheitsreparaturen nach § 307 BGB unwirksam (BGH, Urt. v. 18.03.2015 – VIII ZR 185/14). Ein angemessener Ausgleich wurde nicht gewährt.\n\n3. Die Hilfsaufrechnung wird bestritten …` },
    };
  }

  if (praesentation && akte.sachgebiet === "Verkehrsrecht" && /werkstatt|kürzt|dashcam/i.test(akte.beschreibung)) {
    return {
      zusammenfassung: `${mandant} wurde unverschuldet in einen Unfall verwickelt (Rotlichtverstoß des Gegners, Dashcam-Aufnahme). Die ${gegner} hat 6.120 € gezahlt, kürzt aber die Reparaturkosten um 1.284,50 € unter Verweis auf eine freie Werkstatt.`,
      rechtsfragen: ["Ist der Verweis auf eine freie Fachwerkstatt bei einem zwei Jahre alten, scheckheftgepflegten Fahrzeug zumutbar?", "Ist die Dashcam-Aufnahme als Beweis verwertbar?"],
      erfolgsaussicht: { prozent: 86, stufe: "hoch", begruendung: "Nach BGH VI ZR 53/09 ist der Verweis bei Fahrzeugen bis drei Jahre bzw. durchgehender Markenwartung regelmäßig unzumutbar. Die Haftung dem Grunde nach ist durch die Dashcam (BGH VI ZR 233/17) gut belegt." },
      argumentePro: ["Fahrzeug erst zwei Jahre alt.", "Lückenloses Scheckheft in der Markenwerkstatt.", "Dashcam belegt Rotlichtverstoß – Haftung 100 %."],
      argumenteContra: ["Versicherung könnte die Gleichwertigkeit der freien Werkstatt behaupten – für Neuwagen aber irrelevant."],
      praezedenzfaelle: praezedenzListe(treffer),
      naechsteSchritte: [
        { titel: "Fremdgeld weiterleiten", detail: "6.120 € an die Mandantin auszahlen (§ 43a Abs. 7 BRAO) – heute fällig." },
        { titel: "Nachforderung 1.284,50 € stellen", detail: "Mit Verweis auf BGH VI ZR 53/09 und Scheckheft, Frist 14 Tage." },
        { titel: "Bei Ablehnung: Klage beim Amtsgericht", detail: "Kostenrisiko gering, Erfolgsaussicht hoch." },
      ],
      risiken: ["Gutachterkosten und Nutzungsausfall gesondert prüfen (noch offen?)."],
      entwurf: { titel: "Nachforderungsschreiben (Entwurf)", text: `Schaden-Nr. EV-2026-448812\n\nSehr geehrte Damen und Herren,\n\nIhre Kürzung der Reparaturkosten um 1.284,50 € ist unberechtigt. Das Fahrzeug unserer Mandantin ist erst zwei Jahre alt und wurde ausschließlich in einer Markenwerkstatt gewartet. Ein Verweis auf eine freie Werkstatt ist nach der Rechtsprechung des BGH (Urt. v. 20.10.2009 – VI ZR 53/09) in diesem Fall unzumutbar.\n\nWir fordern Sie auf, den Restbetrag von 1.284,50 € binnen 14 Tagen auf unser Konto zu überweisen.\n\nMit freundlichen Grüßen` },
    };
  }

  // Neumann: Urteil liegt vor – Rechtsmittelprüfung und Mandanteninformation
  if (praesentation && akte.phase === "Urteil" && akte.sachgebiet === "Vertragsrecht") {
    const u = urteilsNachricht(akte, data);
    if (u) return urteilNeumann(akte, data, treffer, verfasser, u);
  }

  // Berger: Vollstreckung aus dem Vollstreckungsbescheid – Maßnahmen statt Erfolgsaussicht
  if (praesentation && akte.sachgebiet === "Forderungseinzug" && akte.phase === "Vollstreckung") {
    return vollstreckungsAnalyse(akte, data, treffer, verfasser, true);
  }

  // Allgemeine Analyse – unterschieden nach Phase und Sachgebiet
  switch (fallart(akte)) {
    case "verteidigung":
      return verteidigungsAnalyse(akte, data, treffer, verfasser);
    case "owi":
      return bussgeldAnalyse(akte, data, treffer, verfasser);
    case "vollstreckung":
      return vollstreckungsAnalyse(akte, data, treffer, verfasser, false);
    case "urteil":
      return urteilsAnalyse(akte, data, treffer, verfasser);
    case "gestaltung":
      return gestaltungsAnalyse(akte, data, treffer, verfasser);
    default:
      return anspruchsAnalyse(akte, data, treffer, verfasser);
  }
}

// ───────────── Bausteine der allgemeinen Analyse ─────────────

type Ergebnis = Omit<Fallanalyse, "quelle" | "dauerMs" | "erstelltAm">;
type Fallart = "verteidigung" | "owi" | "vollstreckung" | "urteil" | "gestaltung" | "anspruch";

function fallart(akte: Akte): Fallart {
  const t = `${akte.titel} ${akte.beschreibung}`.toLowerCase();
  if (akte.sachgebiet === "Strafrecht") return "verteidigung";
  if (/bußgeld/.test(t)) return "owi";
  if (akte.phase === "Vollstreckung") return "vollstreckung";
  if (akte.phase === "Urteil") return "urteil";
  if (!akte.gegnerId && /testament|vertragsprüfung|prüfung eines|vorsorgevollmacht|gestaltung/.test(t)) return "gestaltung";
  return "anspruch";
}

/** „01.10.2026“ → „2026-10-01“ */
function isoAusDe(d?: string): string | undefined {
  const m = d?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

/** Offene Fristen der Akte (ohne Vorfristen und Termine), nach Datum. */
function offeneFristen(akte: Akte, data: TenantData, typen: Frist["typ"][] = ["notfrist", "frist"]): Frist[] {
  return data.fristen.filter((f) => f.akteId === akte.id && f.status === "offen" && typen.includes(f.typ)).sort((a, b) => a.datum.localeCompare(b.datum));
}

function hatVorfrist(f: Frist, data: TenantData): boolean {
  return !!f.vorfrist || data.fristen.some((x) => x.typ === "vorfrist" && x.bezugId === f.id && x.status === "offen");
}

/** Nächster Schritt zur Frist – „Vorfrist gesetzt“ nur, wenn es sie wirklich gibt. */
function fristSchritt(akte: Akte, data: TenantData, ersatz: { titel: string; detail: string }, typen?: Frist["typ"][]): { titel: string; detail: string } {
  // ohne vorgegebene Typen: zuerst echte Fristen, sonst die nächste Wiedervorlage
  const f = offeneFristen(akte, data, typen)[0] ?? (typen ? undefined : offeneFristen(akte, data, ["wiedervorlage"])[0]);
  if (!f) return ersatz;
  if (f.typ === "wiedervorlage" || f.typ === "termin") return { titel: `${f.titel} am ${fmtDate(f.datum)}${f.uhrzeit ? `, ${f.uhrzeit} Uhr` : ""}`, detail: "Im Fristenkalender eingetragen." };
  return {
    titel: `${f.typ === "notfrist" ? "Notfrist" : "Frist"} beachten: ${f.titel} bis ${fmtDate(f.datum)}`,
    detail: hatVorfrist(f, data) ? "Die Vorfrist ist im Fristenkalender eingetragen." : "Die Frist steht im Fristenkalender – eine Vorfrist ist nicht notiert.",
  };
}

/** Schritt, wenn die Fall-Datenbank (Demo-Auszug) nichts Passendes enthält: ehrlicher Hinweis mit Handlungsangebot. */
function rechercheSchritt(treffer: Treffer[]): { titel: string; detail: string }[] {
  return treffer.length
    ? []
    : [{ titel: "Rechtsprechung recherchieren", detail: "Im Demo-Auszug der Fall-Datenbank fand sich keine hinreichend ähnliche Entscheidung – in der Fall-Datenbank die KI-Recherche mit dem Sachverhalt starten." }];
}

function rechtsprechungsFrage(treffer: Treffer[]): string {
  const top = treffer[0]?.entscheidung;
  return top ? `Lässt sich die Entscheidung „${top.titel.replace(/[„“]/g, "")}“ (${top.gericht} ${top.az}) auf den Fall übertragen?` : "Welche Rechtsprechung ist einschlägig? (Im Demo-Auszug der Fall-Datenbank noch keine passende Entscheidung.)";
}

function praezedenzArgument(treffer: Treffer[]): string[] {
  const top = treffer[0]?.entscheidung;
  return top ? [`Einschlägige Rechtsprechung: ${top.gericht} ${top.az} – ${top.bedeutung}`] : [];
}

function anrede(k?: Kontakt): string {
  if (!k || k.typ === "organisation") return "Sehr geehrte Damen und Herren,";
  const name = k.nachname ?? k.name.split(" ").pop();
  return k.anrede === "Frau" ? `Sehr geehrte Frau ${name},` : k.anrede === "Herr" ? `Sehr geehrter Herr ${name},` : `Guten Tag ${k.name},`;
}

function anschrift(k: Kontakt | undefined, fallback: string): string {
  if (!k) return `[${fallback}]\n[Anschrift]`;
  const vor = k.typ === "person" && k.anrede === "Herr" ? "Herrn\n" : k.typ === "person" && k.anrede === "Frau" ? "Frau\n" : "";
  return `${vor}${k.name}\n${k.strasse ?? "[Straße]"}\n${k.plz && k.ort ? `${k.plz} ${k.ort}` : "[PLZ Ort]"}`;
}

function kontakt(data: TenantData, id?: string): Kontakt | undefined {
  return id ? data.kontakte.find((k) => k.id === id) : undefined;
}

/** Name im Fließtext: Gesellschaften mit Artikel („die Berger Haustechnik GmbH“), Personen ohne. */
function imText(k: Kontakt | undefined, ersatz: string, gross = false): string {
  if (!k) return ersatz;
  if (k.typ === "organisation" && /\b(GmbH|AG|KG|eG|SE|GbR|UG|mbH|OHG|PartG|e\. ?V\.)(\b|$)|Versicherung|Verwaltung|Rechtsanwälte/.test(k.name)) return `${gross ? "Die" : "die"} ${k.name}`;
  return k.name;
}

/** Beweislast passend zu Sachgebiet und Konstellation – statt pauschal „liegt beim Mandanten“. */
function beweislast(akte: Akte): string {
  const t = `${akte.titel} ${akte.beschreibung} ${akte.schlagworte.join(" ")}`.toLowerCase();
  switch (akte.sachgebiet) {
    case "Arbeitsrecht":
      if (/überstunden/.test(t)) return "Für Überstunden trägt der Arbeitnehmer die Darlegungslast: geleistete Stunden sowie Anordnung, Billigung oder Duldung durch die Arbeitgeberin.";
      if (/kündigung/.test(t)) return "Die Kündigungsgründe muss die Arbeitgeberin beweisen (§ 1 Abs. 2 S. 4 KSchG); Fehler der Sozialauswahl muss der Arbeitnehmer darlegen (§ 1 Abs. 3 S. 3 KSchG).";
      return "Für die anspruchsbegründenden Tatsachen trägt die Mandantschaft die Darlegungs- und Beweislast.";
    case "Mietrecht":
      if (/eigenbedarf|härte/.test(t)) return "Härtegründe nach § 574 BGB muss die Mieterseite darlegen und beweisen – ärztliche Atteste und Nachweise zur Verwurzelung sichern.";
      if (/schimmel|minderung/.test(t)) return "Bei Schimmel muss zunächst die Vermieterin beweisen, dass die Ursache nicht in der Bausubstanz liegt – das Gutachten ist entscheidend.";
      if (/kaution|renovier/.test(t)) return "Gegenforderungen muss die Vermieterin beweisen; die unrenovierte Übergabe muss die Mieterseite beweisen (Übergabeprotokoll).";
      break;
    case "Verkehrsrecht":
      return "Haftung und Schadenshöhe muss die Geschädigte beweisen – Gutachten, Fotos und Zeugen sichern.";
    case "Erbrecht":
      if (/pflichtteil/.test(t)) return "Für den Bestand und Wert des Nachlasses ist die Pflichtteilsberechtigte beweisbelastet – deshalb zuerst Auskunft und Wertermittlung (§ 2314 BGB).";
      break;
    case "Baurecht":
      if (/werklohn/.test(t)) return "Ohne Abnahme muss die Unternehmerin die Abnahmereife bzw. Mangelfreiheit ihrer Leistung beweisen.";
      return "Vor der Abnahme muss der Unternehmer die Mangelfreiheit beweisen, danach der Besteller den Mangel.";
    case "Vertragsrecht":
      if (/mangel|gewährleistung|nacherfüllung/.test(t)) return "Den Mangel bei Gefahrübergang muss die Käuferseite beweisen; beim Verbrauchsgüterkauf hilft die Vermutung des § 477 BGB im ersten Jahr.";
      break;
    case "Familienrecht":
      if (/umgang|wechselmodell|sorge/.test(t)) return "Maßstab ist allein das Kindeswohl – Konfliktbelastung, Bindungen und Kindeswille konkret belegen (Berichte von Schule, Kita und Verfahrensbeistand).";
      if (/unterhalt/.test(t)) return "Bedarf und Leistungsfähigkeit müssen belegt werden – ohne Auskunft (§ 1605 BGB) fehlen die Einkommensnachweise.";
      return "Trennungszeitpunkt und Auskünfte zum Versorgungsausgleich müssen belegt werden.";
  }
  return "Für die anspruchsbegründenden Tatsachen trägt die Mandantschaft die Darlegungs- und Beweislast.";
}

/** Rechtsfragen je Sachgebiet (allgemeiner Fall mit Anspruch oder Verfahren). */
function rechtsfragenAnspruch(akte: Akte, treffer: Treffer[]): string[] {
  const t = `${akte.titel} ${akte.beschreibung}`.toLowerCase();
  const fragen: string[] = [];
  if (akte.sachgebiet === "Familienrecht") {
    if (/wechselmodell|umgang/.test(t)) fragen.push("Entspricht das beantragte Betreuungsmodell dem Kindeswohl (§ 1697a BGB) – wie belastbar sind Kommunikation und Kooperation der Eltern?", "Welche Empfehlungen geben Jugendamt und Verfahrensbeistand?");
    else if (/unterhalt/.test(t)) fragen.push("Wie hoch ist der Bedarf nach der Düsseldorfer Tabelle – und ist der Unterhaltspflichtige leistungsfähig?", "Wie wird der Auskunftsanspruch (§ 1605 BGB) durchgesetzt – ggf. im Stufenantrag?");
    else if (/scheidung/.test(t)) fragen.push("Ist das Trennungsjahr abgelaufen (§ 1565 Abs. 1, § 1566 Abs. 1 BGB)?", "Liegen alle Auskünfte für den Versorgungsausgleich vor, und welche Folgesachen sind zu regeln?");
  }
  if (!fragen.length) fragen.push(akte.phase === "Gerichtlich" || akte.phase === "Beweisaufnahme"
    ? "Welche Tatsachen sind streitig – und mit welchen Beweismitteln lassen sie sich belegen?"
    : "Welche Ansprüche und Einwendungen bestehen – und lassen sie sich außergerichtlich durchsetzen?");
  fragen.push(rechtsprechungsFrage(treffer));
  if (fragen.length < 3) fragen.push("Welche Beweismittel stehen zur Verfügung?");
  return fragen;
}

function anspruchsAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser?: Verfasser): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  const gegner = kontakt(data, akte.gegnerId);
  const gegneranwalt = kontakt(data, akte.gegneranwaltId);
  const gericht = kontakt(data, akte.gerichtId);
  const p = Math.min(88, 52 + treffer.length * 5 + (akte.prioritaet === "hoch" ? 4 : 0));
  const doks = data.dokumente.filter((d) => d.akteId === akte.id).length;
  const gerichtlich = (akte.phase === "Gerichtlich" || akte.phase === "Beweisaufnahme") && !!gericht;
  const top = treffer[0]?.entscheidung;
  const zitatTop = top ? `\n\nWir verweisen auf die Entscheidung ${top.gericht}, ${top.art === "Urteil" ? "Urt." : "Beschl."} v. ${fmtDate(top.datum)} – ${top.az}.` : "";
  const entwurf = gerichtlich
    ? {
        titel: "Schriftsatz an das Gericht (Gerüst)",
        text: `An das\n${gericht!.name}\n\nAz.: ${akte.gerichtsAz ?? "[Gerichtsaktenzeichen]"}\n\nIn Sachen ${akte.titel}\n\nnehmen wir für ${mandant?.name ?? "die Mandantschaft"} wie folgt Stellung:\n\n1. [Streitige Tatsachen benennen und mit Beweisangebot versehen]\n2. [Rechtliche Würdigung]${zitatTop}\n\n${unterschrift(verfasser)}`,
      }
    : gegner
      ? {
          titel: "Schreiben an die Gegenseite (Entwurf)",
          text: `${anschrift(gegneranwalt ?? gegner, "Gegenseite")}\n\nIn Sachen ${akte.titel}\nUnser Zeichen: ${akte.aktenzeichen}\n\n${gegneranwalt ? "Sehr geehrte Kolleginnen und Kollegen," : anrede(gegner)}\n\nwir zeigen an, dass wir ${mandant?.name ?? "[Mandantschaft]"} vertreten. ${akte.beschreibung}\n\n[Forderung bzw. Anliegen konkret benennen]${zitatTop}\n\nWir bitten um Ihre Stellungnahme bis zum ${fmtDate(addDays(today(), 14))}.\n\n${gegneranwalt ? "Mit freundlichen kollegialen Grüßen" : "Mit freundlichen Grüßen"}\n\n${unterschrift(verfasser)}`,
        }
      : {
          titel: "Mandantenschreiben (Entwurf)",
          text: `${anschrift(mandant, "Mandantschaft")}\n\nUnser Zeichen: ${akte.aktenzeichen} – ${akte.titel}\n\n${anrede(mandant)}\n\nwir haben Ihre Angelegenheit geprüft und fassen den Stand zusammen:\n\n[Sachstand verständlich zusammenfassen]${top ? `\n\nNach der Rechtsprechung des ${top.gericht} (${top.az}) gilt: ${top.bedeutung}` : ""}\n\n[Empfehlung und nächste Schritte]\n\nMit freundlichen Grüßen\n\n${unterschrift(verfasser)}`,
        };
  return {
    zusammenfassung: `${akte.titel}: ${akte.beschreibung}`,
    rechtsfragen: rechtsfragenAnspruch(akte, treffer),
    erfolgsaussicht: {
      prozent: p,
      stufe: stufe(p),
      begruendung: `Vorläufige Einschätzung auf Basis des Sachverhalts${treffer.length === 0 ? " – im Demo-Auszug der Fall-Datenbank fand sich keine hinreichend ähnliche Entscheidung" : treffer.length === 1 ? " und einer passenden Entscheidung aus der Fall-Datenbank" : ` und ${treffer.length} passender Entscheidungen aus der Fall-Datenbank`}. Mit vollständiger Beweislage präzisierbar.`,
    },
    argumentePro: [...praezedenzArgument(treffer), doks >= 2 ? "Die wesentlichen Unterlagen liegen in der E-Akte vor." : "Der Sachverhalt ist in der Akte erfasst – weitere Unterlagen bei der Mandantschaft anfordern."],
    argumenteContra: [gegner ? "Einwendungen der Gegenseite sind noch nicht vollständig bekannt." : "Wesentliche Angaben der Mandantschaft sind noch zu prüfen.", beweislast(akte)],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      fristSchritt(akte, data, { titel: "Fristen prüfen", detail: "Für diese Akte ist keine offene Frist notiert – Fristen aus neuen Schreiben im Posteingang prüfen." }),
      { titel: "Sachverhalt mit der Mandantschaft abstimmen", detail: "Offene Punkte im nächsten Mandanten-Update abfragen." },
      ...rechercheSchritt(treffer),
      { titel: gerichtlich ? "Schriftsatz vorbereiten" : "Schreiben vorbereiten", detail: "Entwurf unten als Ausgangspunkt nutzen." },
    ],
    risiken: [`Kostenrisiko abhängig vom Gegenstandswert ${akte.gegenstandswert ? fmtEUR(akte.gegenstandswert) : "–"}.`],
    entwurf,
  };
}

/** Straf- und Ermittlungsverfahren: Verteidigung statt „Ansprüche“, Beweislast bei den Strafverfolgungsbehörden. */
function verteidigungsAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser?: Verfasser): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  const gericht = kontakt(data, akte.gerichtId);
  const behoerde = kontakt(data, akte.gegnerId);
  const t = `${akte.titel} ${akte.beschreibung}`.toLowerCase();
  const strafbefehl = /strafbefehl/.test(t);
  const fahrerlaubnis = /fahrerlaubnis/.test(t);
  const p = strafbefehl ? 55 : 50;
  const adressat = gericht?.name ?? behoerde?.name;
  return {
    zusammenfassung: `${akte.titel}: ${akte.beschreibung}`,
    rechtsfragen: [
      "Ist der Tatvorwurf nach Aktenlage nachweisbar – welche Beweismittel nennt die Ermittlungsakte?",
      ...(fahrerlaubnis ? ["Liegen die Voraussetzungen für die Entziehung der Fahrerlaubnis vor (§ 69 Abs. 2 Nr. 3 StGB: „bedeutender Schaden“) – oder genügt ein Fahrverbot?"] : []),
      "Kommt eine Einstellung in Betracht (§§ 153, 153a StPO)?",
      ...(strafbefehl ? ["Ist ein Einspruch insgesamt sinnvoll oder eine Beschränkung auf die Rechtsfolgen (§ 410 Abs. 2 StPO)?"] : ["Liegen Verfahrenshindernisse oder Beweisverwertungsverbote vor?"]),
    ],
    erfolgsaussicht: {
      prozent: p,
      stufe: stufe(p),
      begruendung: "Vorläufige Einschätzung der Verteidigungsaussichten – belastbar erst nach Akteneinsicht. Den Tatnachweis müssen die Strafverfolgungsbehörden führen; Zweifel gehen zugunsten der Mandantschaft.",
    },
    argumentePro: [
      "Den Tatvorwurf müssen Staatsanwaltschaft und Gericht nachweisen – die Mandantschaft muss sich nicht entlasten.",
      "Die Akteneinsicht (§ 147 StPO) kann Lücken in der Beweisführung zeigen.",
      ...(fahrerlaubnis ? ["Die Schadenshöhe entscheidet über den „bedeutenden Schaden“ – Gutachten und Reparaturrechnung kritisch prüfen."] : []),
      ...praezedenzArgument(treffer),
    ],
    argumenteContra: [
      "Das Ermittlungsergebnis ist noch nicht bekannt – Einlassung erst nach Akteneinsicht.",
      ...(strafbefehl ? ["Nach einem Einspruch ist das Gericht nicht an den Strafbefehl gebunden – eine Verschlechterung ist möglich (§ 411 Abs. 4 StPO)."] : []),
    ],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      fristSchritt(akte, data, strafbefehl ? { titel: "Einspruchsfrist prüfen", detail: "Zwei Wochen ab Zustellung des Strafbefehls (§ 410 Abs. 1 StPO) – im Fristenrechner eintragen." } : { titel: "Fristen prüfen", detail: "Für diese Akte ist keine offene Frist notiert." }, ["notfrist", "frist"]),
      { titel: "Akteneinsicht beantragen", detail: "Verteidigung anzeigen und Einsicht in die Ermittlungsakte beantragen (§ 147 StPO)." },
      { titel: "Mandantschaft beraten", detail: "Bis zur Akteneinsicht keine Angaben zur Sache machen; Rechtsfolgen und Kosten erläutern." },
      ...(fahrerlaubnis ? [{ titel: "Fahrerlaubnis absichern", detail: "Berufliche Folgen (Berufskraftfahrer) belegen und Alternativen zur Entziehung vortragen." }] : []),
    ],
    risiken: [
      strafbefehl ? "Verschlechterung nach Einspruch möglich (§ 411 Abs. 4 StPO) – Rücknahme des Einspruchs bleibt bis zur Urteilsverkündung im ersten Rechtszug möglich (§ 411 Abs. 3 StPO)." : "Eintragung im Bundeszentralregister bei einer Verurteilung.",
    ],
    entwurf: {
      titel: strafbefehl ? "Einspruch und Akteneinsichtsgesuch (Entwurf)" : "Verteidigeranzeige und Akteneinsichtsgesuch (Entwurf)",
      text: `An ${adressat ? `das\n${adressat}` : "[Gericht / Staatsanwaltschaft]"}\n\nAz.: ${akte.gerichtsAz ?? "[Aktenzeichen]"}\n\nIn der Strafsache gegen ${mandant?.name ?? "[Mandant]"}\n\nzeigen wir an, dass wir die Verteidigung übernommen haben; die Vollmacht ist beigefügt.\n\n${strafbefehl ? "Gegen den Strafbefehl legen wir namens und in Vollmacht des Angeklagten\n\nEinspruch\n\nein. Eine Begründung sowie eine etwaige Beschränkung des Einspruchs bleiben vorbehalten.\n\n" : ""}Wir beantragen Einsicht in die Verfahrensakte einschließlich aller Beiakten und Beweismittel (§ 147 StPO). Bis zur Akteneinsicht wird sich unser Mandant zur Sache nicht äußern.\n\n${unterschrift(verfasser)}`,
    },
  };
}

/** Bußgeldsachen: Messung, Akteneinsicht, Fahrverbot – die Behörde muss den Verstoß nachweisen. */
function bussgeldAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser?: Verfasser): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  const behoerde = kontakt(data, akte.gegnerId);
  const fahrverbot = /fahrverbot/i.test(akte.beschreibung);
  const p = 45 + (treffer.length ? 5 : 0);
  return {
    zusammenfassung: `${akte.titel}: ${akte.beschreibung}`,
    rechtsfragen: [
      "Ist die Messung verwertbar – standardisiertes Messverfahren, Eichung, Bedienung durch geschultes Personal?",
      "Lässt sich der Mandant auf dem Messfoto als Fahrer identifizieren?",
      ...(fahrverbot ? ["Kann vom Fahrverbot gegen eine erhöhte Geldbuße abgesehen werden (§ 4 Abs. 4 BKatV) – liegt eine außergewöhnliche Härte vor?"] : []),
    ],
    erfolgsaussicht: {
      prozent: p,
      stufe: stufe(p),
      begruendung: "Vorläufige Einschätzung der Verteidigungsaussichten. Die Bußgeldbehörde muss den Verstoß nachweisen; bei standardisierten Messverfahren genügt aber zunächst das Messergebnis – Einwände brauchen konkrete Anhaltspunkte, die sich oft erst aus den Messunterlagen ergeben.",
    },
    argumentePro: [
      "Anspruch auf Zugang zu Rohmessdaten und Messunterlagen, auch wenn sie nicht in der Akte sind (BVerfG 2 BvR 1616/18).",
      ...(fahrverbot ? ["Bei existenzgefährdender Härte (z. B. drohender Arbeitsplatzverlust) kann vom Fahrverbot abgesehen werden – Arbeitgeberbescheinigung einholen."] : []),
      ...praezedenzArgument(treffer).filter((x) => !x.includes("2 BvR 1616/18")),
    ],
    argumenteContra: [
      "Ohne konkrete Messfehler folgt das Gericht beim standardisierten Messverfahren regelmäßig der Messung.",
      ...(fahrverbot ? ["Bloße berufliche Nachteile genügen für ein Absehen vom Fahrverbot meist nicht."] : []),
    ],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      fristSchritt(akte, data, { titel: "Einspruchsfrist prüfen", detail: "Zwei Wochen ab Zustellung des Bußgeldbescheids (§ 67 Abs. 1 OWiG) – im Fristenrechner eintragen." }, ["notfrist", "frist"]),
      { titel: "Akteneinsicht und Messunterlagen anfordern", detail: "Akteneinsicht (§ 46 Abs. 1 OWiG i. V. m. § 147 StPO) sowie Rohmessdaten, Eichschein und Lebensakte des Messgeräts beantragen." },
      ...(fahrverbot ? [{ titel: "Härtegründe belegen", detail: "Arbeitgeberbescheinigung und Nachweise zur beruflichen Angewiesenheit auf die Fahrerlaubnis zusammenstellen." }] : []),
      ...(akte.rsv ? [{ titel: "Deckung der Rechtsschutzversicherung", detail: deckungsDetail(akte, data) }] : []),
    ],
    risiken: ["Nach dem Einspruch ist das Gericht nicht an den Bescheid gebunden – eine höhere Geldbuße ist möglich; das Gericht muss darauf hinweisen.", "Punkte im Fahreignungsregister fallen unabhängig vom Fahrverbot an."],
    entwurf: {
      titel: "Einspruch und Akteneinsichtsgesuch (Entwurf)",
      text: `An die\n${behoerde?.name ?? "[Bußgeldbehörde]"}\n\nBußgeldverfahren gegen ${mandant?.name ?? "[Betroffene/r]"}\nAz.: [Aktenzeichen des Bußgeldbescheids]\n\nWir zeigen an, dass wir den Betroffenen vertreten; die Vollmacht ist beigefügt.\n\nGegen den Bußgeldbescheid legen wir\n\nEinspruch\n\nein. Wir beantragen Akteneinsicht sowie die Überlassung der vollständigen Messunterlagen, insbesondere der Rohmessdaten der gesamten Messreihe, des Eichscheins und der Lebensakte des Messgeräts. Eine Begründung folgt nach Akteneinsicht.\n\n${unterschrift(verfasser)}`,
    },
  };
}

/** Gestaltungs- und Prüfungsmandate (Testament, Vertragsprüfung): Umsetzbarkeit statt Prozessaussicht. */
function gestaltungsAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser?: Verfasser): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  const t = `${akte.titel} ${akte.beschreibung}`.toLowerCase();
  const testament = /testament/.test(t);
  const fragen = testament
    ? ["Welche Bindungswirkung soll das gemeinschaftliche Testament haben (§ 2270 BGB) – mit Änderungsvorbehalt für den Längerlebenden?", "Wie lassen sich Pflichtteilsansprüche begrenzen (Pflichtteilsstrafklausel, Pflichtteilsverzicht)?", "Sind Vorsorgevollmacht und Patientenverfügung aufeinander abgestimmt?"]
    : ["Sind Laufzeit und automatische Verlängerung wirksam vereinbart?", "Hält die Haftungsbegrenzung der AGB-Kontrolle stand (§ 307 BGB, Wertung des § 309 Nr. 7 BGB)?", "Genügt die Auftragsverarbeitung den Anforderungen des Art. 28 DSGVO – auch bei Unterauftragnehmern im Drittland?"];
  return {
    zusammenfassung: `${akte.titel}: ${akte.beschreibung}`,
    rechtsfragen: [...fragen, ...(treffer.length ? [rechtsprechungsFrage(treffer)] : [])],
    erfolgsaussicht: {
      prozent: 85,
      stufe: "hoch",
      begruendung: "Gestaltungs- bzw. Prüfungsmandat ohne Gegenseite: Die Einschätzung bezieht sich darauf, die Ziele der Mandantschaft rechtssicher umzusetzen.",
    },
    argumentePro: [testament ? "Die Ziele der Eheleute sind bekannt; der Vermögensfragebogen liegt vor." : "Der Vertragsentwurf liegt vor; Änderungen lassen sich vor Unterzeichnung verhandeln.", ...praezedenzArgument(treffer)],
    argumenteContra: [testament ? "Patchwork-Konstellation: Pflichtteilsrechte des Kindes aus erster Ehe lassen sich nicht vollständig ausschließen." : "Verhandlungsspielraum gegenüber großen Anbietern ist oft begrenzt."],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      fristSchritt(akte, data, { titel: "Termin abstimmen", detail: "Besprechungstermin mit der Mandantschaft vereinbaren." }, ["frist", "termin"]),
      { titel: testament ? "Entwurf erstellen" : "Prüfvermerk erstellen", detail: testament ? "Testamentsentwurf mit Erläuterung der Bindungswirkung vorbereiten." : "Kritische Klauseln mit Änderungsvorschlägen markieren." },
      { titel: "Mandantschaft beraten", detail: "Ergebnis besprechen und offene Entscheidungen festhalten." },
    ],
    risiken: [testament ? "Formfehler (§ 2247, § 2267 BGB) machen das Testament unwirksam – eigenhändige Errichtung oder notarielle Beurkundung." : "Ungeprüft übernommene Klauseln (Gerichtsstand, Haftung) können im Streitfall teuer werden."],
    entwurf: {
      titel: "Mandantenschreiben (Entwurf)",
      text: `${anschrift(mandant, "Mandantschaft")}\n\nUnser Zeichen: ${akte.aktenzeichen} – ${akte.titel}\n\n${anrede(mandant)}\n\nvielen Dank für Ihren Auftrag. Wir haben ${testament ? "Ihre Wünsche zur Nachlassgestaltung" : "den Vertragsentwurf"} geprüft und fassen die wichtigsten Punkte zusammen:\n\n1. [Punkt 1]\n2. [Punkt 2]\n3. [Punkt 3]\n\nGern besprechen wir das Ergebnis in einem Termin.\n\nMit freundlichen Grüßen\n\n${unterschrift(verfasser)}`,
    },
  };
}

/** Allgemeiner Fall „Urteil liegt vor“: Rechtsmittelprüfung und Mandanteninformation. */
function urteilsAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser?: Verfasser): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  return {
    zusammenfassung: `${akte.titel}: ${akte.beschreibung} Es liegt eine gerichtliche Entscheidung vor – jetzt sind Rechtsmittel, Kosten und Vollstreckung zu prüfen.`,
    rechtsfragen: [
      "Ist die Entscheidung für die Mandantschaft ganz oder teilweise nachteilig – wie hoch ist die Beschwer?",
      "Ist die Berufung statthaft (Beschwer über 1.000 € oder Zulassung, § 511 Abs. 2 ZPO) und gibt es Berufungsgründe (§ 513 ZPO)?",
      "Ist mit einem Rechtsmittel der Gegenseite zu rechnen?",
    ],
    erfolgsaussicht: { prozent: 50, stufe: "mittel", begruendung: "Vorläufige Einschätzung für ein mögliches Rechtsmittel – belastbar erst nach Auswertung der Entscheidungsgründe." },
    argumentePro: ["Das Urteil liegt vor; die Gründe lassen sich gezielt auf Rechtsfehler prüfen.", ...praezedenzArgument(treffer)],
    argumenteContra: ["Neue Tatsachen sind in der Berufung nur eingeschränkt zulässig (§ 531 Abs. 2 ZPO).", "Ein Rechtsmittel verursacht weitere Kosten."],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      fristSchritt(akte, data, { titel: "Rechtsmittelfristen notieren", detail: "Berufungsfrist (§ 517 ZPO) und Begründungsfrist (§ 520 Abs. 2 ZPO) laufen ab Zustellung – mit dem Fristenrechner eintragen." }, ["notfrist", "frist"]),
      { titel: "Urteil auswerten und Mandantschaft informieren", detail: "Ergebnis, Kostenquote und Empfehlung erläutern; Entscheidung über ein Rechtsmittel einholen." },
      { titel: "Kostenfestsetzung und Vollstreckung vorbereiten", detail: "Kostenfestsetzungsantrag (§ 104 ZPO) bzw. vollstreckbare Ausfertigung vorbereiten." },
    ],
    risiken: ["Versäumte Rechtsmittelfristen sind nur über die Wiedereinsetzung (§ 233 ZPO) heilbar."],
    entwurf: {
      titel: "Mandanteninformation zum Urteil (Entwurf)",
      text: `${anschrift(mandant, "Mandantschaft")}\n\nUnser Zeichen: ${akte.aktenzeichen} – ${akte.titel}\n\n${anrede(mandant)}\n\nin Ihrer Sache liegt die Entscheidung des Gerichts vor. [Ergebnis in zwei Sätzen]\n\nGegen die Entscheidung ist [ein Rechtsmittel / kein Rechtsmittel] möglich. [Empfehlung]\n\nBitte teilen Sie uns bis zum [Datum] mit, wie Sie vorgehen möchten.\n\nMit freundlichen Grüßen\n\n${unterschrift(verfasser)}`,
    },
  };
}

// ── Präsentationsakte 118/.. Neumann: Urteil per beA ──

interface UrteilsInfo {
  datum?: string;
  zugesprochen?: number;
  abgewiesen?: number;
  quote?: string;
}

/** Die Urteilszustellung zur Akte – im Posteingang (über das Gerichtsaktenzeichen) oder bereits in der E-Akte. */
function urteilsNachricht(akte: Akte, data: TenantData): UrteilsInfo | undefined {
  const az = akte.gerichtsAz;
  const n = data.nachrichten.find((x) => /urteil/i.test(x.betreff) && (x.akteId === akte.id || (!!az && x.betreff.includes(az))));
  const text = n?.text ?? data.dokumente.find((d) => d.akteId === akte.id && /urteil/i.test(d.name) && /verurteilt/i.test(d.inhalt))?.inhalt;
  if (!text) return undefined;
  const betrag = (s?: string) => (s ? Number(s.replace(/\./g, "").replace(",", ".")) : undefined);
  return {
    datum: text.match(/Urteil vom (\d{2}\.\d{2}\.\d{4})/)?.[1],
    zugesprochen: betrag(text.match(/an den Kläger ([\d.]+,\d{2}) €/)?.[1]),
    abgewiesen: betrag(text.match(/Nutzungsentschädigung ([\d.]+,\d{2}) €/)?.[1]),
    quote: text.match(/tragen der Kläger zu (\d+) %, die Beklagte zu (\d+) %/)?.slice(1, 3).join(" / "),
  };
}

function urteilNeumann(akte: Akte, data: TenantData, treffer: Treffer[], verfasser: Verfasser | undefined, u: UrteilsInfo): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  const gegner = kontakt(data, akte.gegnerId);
  const gericht = kontakt(data, akte.gerichtId);
  const zu = u.zugesprochen ?? 14250;
  const ab = u.abgewiesen ?? Math.max(0, akte.gegenstandswert - zu);
  const [qKlaeger, qBeklagte] = (u.quote ?? "25 / 75").split(" / ");
  const berufung = data.fristen.find((f) => f.akteId === akte.id && f.status === "offen" && f.regelKey === "berufung");
  const begruendung = data.fristen.find((f) => f.akteId === akte.id && f.status === "offen" && f.regelKey === "berufungsbegruendung");
  const fristText = berufung ? ` – sie endet am ${fmtDate(berufung.datum)}${begruendung ? `, die Begründungsfrist am ${fmtDate(begruendung.datum)}` : ""}` : "";
  return {
    zusammenfassung: `Das ${gericht?.name ?? "Landgericht"} hat der Klage von ${mandant?.name ?? "Herrn Neumann"} überwiegend stattgegeben: Die ${gegner?.name ?? "Beklagte"} muss ${fmtEUR(zu)} nebst Zinsen Zug um Zug gegen Rückgabe des Fahrzeugs zahlen. In Höhe von ${fmtEUR(ab)} wurde die Klage abgewiesen – das Gericht hat eine Nutzungsentschädigung für die gefahrenen Kilometer abgezogen. Die Kosten tragen der Kläger zu ${qKlaeger} %, die Beklagte zu ${qBeklagte} %.`,
    rechtsfragen: [
      `Ist der Abzug der Nutzungsentschädigung (${fmtEUR(ab)}) der Höhe nach richtig – vor allem die angenommene Gesamtlaufleistung des Fahrzeugs?`,
      `Lohnt eine eigene Berufung? Die Beschwer von ${fmtEUR(ab)} übersteigt die Berufungssumme von 1.000 € (§ 511 Abs. 2 Nr. 1 ZPO).`,
      `Legt die Beklagte Berufung ein (Beschwer ${fmtEUR(zu)}) – und sollte dann Anschlussberufung eingelegt werden (§ 524 ZPO)?`,
      "Ist der Annahmeverzug der Beklagten festgestellt? Ohne ihn ist die Vollstreckung Zug um Zug aufwendiger (§§ 756, 765 ZPO).",
    ],
    erfolgsaussicht: {
      prozent: Math.round((zu / Math.max(1, zu + ab)) * 100),
      stufe: stufe(Math.round((zu / Math.max(1, zu + ab)) * 100)),
      begruendung: `Erfolg in erster Instanz: ${Math.round((zu / Math.max(1, zu + ab)) * 100)} % der Klageforderung zugesprochen, ${qBeklagte} % der Kosten trägt die Gegenseite. Eine eigene Berufung hätte nur geringe Aussicht: Nutzungsersatz schuldet der Käufer nach dem Rücktritt dem Grunde nach (§ 346 Abs. 1, Abs. 2 S. 1 Nr. 1 BGB) – angreifbar ist allenfalls die Höhe, etwa eine zu niedrig angesetzte Gesamtlaufleistung.`,
    },
    argumentePro: [
      `Berufung statthaft: Beschwer ${fmtEUR(ab)} > 1.000 € (§ 511 Abs. 2 Nr. 1 ZPO).`,
      "Bei Gebrauchtwagen ist die erwartete Restlaufleistung maßgeblich – eine zu niedrig angenommene Gesamtlaufleistung erhöht den Abzug zu Unrecht.",
      "Die Hauptsache ist gewonnen: Rücktritt und Rückzahlung Zug um Zug sind zugesprochen.",
    ],
    argumenteContra: [
      "Nutzungsersatz ist dem Grunde nach geschuldet – ohne konkreten Rechenfehler kaum Aussicht.",
      `Kostenrisiko der zweiten Instanz (Kammergericht) aus ${fmtEUR(ab)}.`,
      "Eine eigene Berufung kann die Beklagte zur Anschlussberufung veranlassen – dann steht der gesamte Rücktritt erneut zur Prüfung.",
    ],
    praezedenzfaelle: kuratierteListe(akte, data, treffer, {
      "bgh-vizr252-19": "Vergleichsmaßstab für die Höhe des Nutzungsersatzes: Der BGH bemisst gezogene Nutzungen linear (Kaufpreis × gefahrene Kilometer ÷ erwartete Restlaufleistung) – dort im Rahmen des Schadensersatzes nach § 826 BGB.",
    }),
    naechsteSchritte: [
      berufung
        ? { titel: `Notfrist beachten: Berufung bis ${fmtDate(berufung.datum)}`, detail: `${begruendung ? `Begründung bis ${fmtDate(begruendung.datum)} (§ 520 Abs. 2 ZPO). ` : ""}${hatVorfrist(berufung, data) ? "Vorfristen sind eingetragen." : "Vorfrist prüfen."}` }
        : { titel: "Urteil gegen eEB entgegennehmen und Fristen notieren", detail: "Die Zustellung liegt im Posteingang. Berufungsfrist (1 Monat, § 517 ZPO) und Begründungsfrist (2 Monate, § 520 Abs. 2 ZPO) ab Zustellung berechnet der Fristenrechner." },
      { titel: "Berechnung der Nutzungsentschädigung prüfen", detail: "Kilometerstand bei Übergabe und heute, Kaufpreis und angesetzte Gesamtlaufleistung mit den Urteilsgründen abgleichen." },
      { titel: "Mandanten informieren", detail: `Ergebnis, Kostenquote ${qKlaeger} / ${qBeklagte} und Empfehlung erläutern – Entwurf unten.` },
      { titel: "Rückgabe und Vollstreckung vorbereiten", detail: "Rückgabe des Fahrzeugs anbieten bzw. Annahmeverzug klären; vollstreckbare Ausfertigung beantragen." },
      { titel: "Kostenausgleichung vorbereiten", detail: "Kosten nach der Quote ausgleichen lassen (§ 106 ZPO), sobald das Urteil rechtskräftig oder vorläufig vollstreckbar ist." },
    ],
    risiken: [
      `Berufung der Beklagten möglich (Beschwer ${fmtEUR(zu)}) – deren Berufungsfrist läuft ab ihrer Zustellung; ggf. Anschlussberufung (§ 524 ZPO).`,
      "Kostenrisiko einer eigenen Berufung bei geringer Erfolgsaussicht.",
    ],
    entwurf: {
      titel: "Mandanteninformation zum Urteil (Entwurf)",
      text: `${anschrift(mandant, "Mandant")}\n\nUnser Zeichen: ${akte.aktenzeichen} – ${akte.titel}\nUrteil vom ${u.datum ?? "[Datum]"} (${gericht?.name ?? "[Gericht]"}, Az. ${akte.gerichtsAz ?? "[Aktenzeichen]"})\n\n${anrede(mandant)}\n\ndas Gericht hat Ihrer Klage überwiegend stattgegeben. Die ${gegner?.name ?? "Beklagte"} muss Ihnen ${fmtEUR(zu)} nebst Zinsen zahlen – Zug um Zug gegen Rückgabe des Fahrzeugs. In Höhe von ${fmtEUR(ab)} hat das Gericht die Klage abgewiesen: Diesen Betrag hat es als Nutzungsentschädigung für die mit dem Fahrzeug gefahrenen Kilometer abgezogen. Die Kosten des Rechtsstreits tragen Sie zu ${qKlaeger} %, die Gegenseite zu ${qBeklagte} %.\n\nGegen das Urteil können beide Seiten Berufung zum Kammergericht einlegen. Die Frist beträgt einen Monat ab Zustellung${fristText}. Eine Nutzungsentschädigung schulden Sie nach dem Rücktritt grundsätzlich (§ 346 BGB). Eine Berufung lohnt sich daher nur, wenn die Berechnung – insbesondere die angenommene Gesamtlaufleistung – fehlerhaft ist. Wir prüfen die Urteilsgründe und melden uns mit einer Empfehlung.\n\nBitte teilen Sie uns bis zum [Datum] mit, ob Sie eine Berufung in Betracht ziehen. Sobald feststeht, ob die Gegenseite Berufung einlegt, besprechen wir die Rückgabe des Fahrzeugs und die Vollstreckung.\n\nMit freundlichen Grüßen\n\n${unterschrift(verfasser)}`,
    },
  };
}

// ── Vollstreckung (Präsentationsakte 126/.. Berger und allgemeine Forderungsakten mit Titel) ──

/** Stand des Forderungskontos – gleiche Vorgänge wie im Reiter „Forderungskonto“ (Kosten, Teilzahlungen). */
function forderungsStand(akte: Akte, data: TenantData) {
  const f = akte.forderung;
  if (!f) return undefined;
  const stichtag = today();
  const vorgaenge: ForderungsVorgang[] = [{ datum: f.faelligAb, art: "hauptforderung", betrag: f.hauptforderung, text: "Hauptforderung" }];
  for (const b of data.buchungen) {
    if (b.akteId !== akte.id || b.datum > stichtag) continue;
    if (b.art === "kosten") vorgaenge.push({ datum: b.datum, art: "kosten", betrag: Math.abs(b.betrag), text: b.text });
    else if (b.art === "zahlung" && b.fremdgeld) vorgaenge.push({ datum: b.datum, art: "zahlung", betrag: Math.abs(b.betrag), text: b.text });
  }
  if (!f.verbraucher) vorgaenge.push({ datum: f.faelligAb, art: "kosten", betrag: 40, text: "Verzugspauschale (§ 288 Abs. 5 BGB)" });
  return forderungskonto({ vorgaenge, verzugAb: f.faelligAb, stichtag: stichtag < f.faelligAb ? f.faelligAb : stichtag, verbraucher: f.verbraucher });
}

/** Noch nicht weitergeleitetes Fremdgeld der Akte (gleiche Rechnung wie im Aktenkonto). */
function fremdgeldOffen(akte: Akte, data: TenantData): number {
  let ein = 0;
  let aus = 0;
  for (const b of data.buchungen) {
    if (b.akteId !== akte.id || !(b.fremdgeld || b.art === "fremdgeld")) continue;
    if (b.art === "fremdgeld" && b.betrag < 0) aus += -b.betrag;
    else ein += Math.abs(b.betrag);
  }
  return Math.round((ein - aus) * 100) / 100;
}

function vollstreckungsAnalyse(akte: Akte, data: TenantData, treffer: Treffer[], verfasser: Verfasser | undefined, kuratiert: boolean): Ergebnis {
  const mandant = kontakt(data, akte.mandantId);
  const schuldner = kontakt(data, akte.forderung?.schuldnerId ?? akte.gegnerId);
  const stand = forderungsStand(akte, data);
  const raten = data.buchungen.filter((b) => b.akteId === akte.id && b.art === "zahlung" && b.fremdgeld);
  const summeRaten = raten.reduce((s, b) => s + Math.abs(b.betrag), 0);
  const az = akte.gerichtsAz;
  const vermoegen = data.nachrichten.find((n) => /vermögensauskunft|vermögensverzeichnis/i.test(`${n.betreff} ${n.text}`) && (n.akteId === akte.id || (!!az && `${n.betreff} ${n.text}`.includes(az))));
  const fremd = fremdgeldOffen(akte, data);
  const titel = akte.forderung?.titel ?? "Vollstreckungstitel";
  const standText = stand ? `Offen laut Forderungskonto: ${fmtEUR(stand.gesamt)} (Hauptforderung ${fmtEUR(stand.hauptforderung)}, Zinsen ${fmtEUR(stand.zinsen)}, Kosten ${fmtEUR(stand.kosten)}).` : "";
  const p = Math.min(85, 55 + (raten.length ? 10 : 0) + (vermoegen ? 7 : 0));
  return {
    zusammenfassung: `${imText(mandant, "Die Mandantschaft", true)} vollstreckt aus dem ${titel}${schuldner ? ` gegen ${schuldner.name}` : ""}.${raten.length ? ` Der Schuldner zahlt unregelmäßig in Raten (bisher ${raten.length} × ${fmtEUR(summeRaten / raten.length)}).` : ""}${vermoegen ? " Laut Mitteilung des Gerichtsvollziehers hat er die Vermögensauskunft abgegeben; der Ausdruck des Vermögensverzeichnisses liegt vor." : ""} ${standText}`.trim(),
    rechtsfragen: [
      vermoegen ? "Welche Pfändungsmöglichkeiten zeigt das Vermögensverzeichnis (Arbeitseinkommen, Konten, Forderungen)?" : "Welche Vollstreckungsmaßnahme verspricht Erfolg – Vermögensauskunft, Konto- oder Lohnpfändung?",
      "Ist eine Ratenzahlungsvereinbarung mit Verfallklausel sinnvoller als sofortige Pfändung?",
      "Wie werden die Teilzahlungen verrechnet (§ 367 Abs. 1 BGB: Kosten, Zinsen, Hauptforderung)?",
    ],
    erfolgsaussicht: {
      prozent: p,
      stufe: stufe(p),
      begruendung: `Realisierungsaussicht – der Anspruch selbst ist tituliert. ${raten.length ? "Der Schuldner zahlt, wenn auch unregelmäßig. " : ""}${vermoegen ? "Mit dem Vermögensverzeichnis lassen sich Pfändungen gezielt ansetzen. " : ""}Die Beitreibung hängt von Einkommen und Vermögen des Schuldners ab.`,
    },
    argumentePro: [
      "Ein vollstreckbarer Titel liegt vor – Einwendungen gegen die Forderung sind weitgehend ausgeschlossen.",
      ...(raten.length ? ["Zahlungsbereitschaft ist erkennbar – eine Ratenvereinbarung ist realistisch."] : []),
      "Zinsen laufen taggenau weiter (§ 288 BGB) und werden mit jeder Zahlung zuerst verrechnet.",
    ],
    argumenteContra: [
      ...(raten.length ? ["Ohne Vereinbarung gibt es keinen verlässlichen Zahlungsplan."] : []),
      "Pfändungsschutz begrenzt den Zugriff: Freibeträge beim Arbeitseinkommen (§ 850c ZPO) und auf dem P-Konto (§ 850k ZPO).",
    ],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      ...(vermoegen ? [{ titel: "Vermögensverzeichnis auswerten", detail: "Arbeitgeber, Konten und Forderungen des Schuldners prüfen und daraus die Pfändung ableiten." }] : [{ titel: "Vermögensauskunft beantragen", detail: "Gerichtsvollzieher mit der Abnahme der Vermögensauskunft beauftragen (§ 802c ZPO)." }]),
      { titel: "Pfändungs- und Überweisungsbeschluss beantragen", detail: "Bei Arbeitseinkommen oder Konto: Antrag mit amtlichem Formular beim Vollstreckungsgericht (§§ 829, 835 ZPO)." },
      { titel: "Raten schriftlich vereinbaren", detail: "Monatliche Raten mit Verfallklausel anbieten – Entwurf unten." },
      ...(fremd > 0 ? [{ titel: "Fremdgeld weiterleiten", detail: `Eingegangene Zahlungen des Schuldners (${fmtEUR(fremd)}) unverzüglich an die Mandantin weiterleiten oder mit abgerechneten Kosten verrechnen (§ 43a Abs. 7 BRAO, § 4 BORA).` }] : []),
      fristSchritt(akte, data, { titel: "Wiedervorlage setzen", detail: "Zahlungseingang der nächsten Rate überwachen." }, ["frist", "wiedervorlage"]),
    ],
    risiken: [
      "Fällt der Schuldner aus, trägt die Gläubigerin die Vollstreckungskosten zunächst selbst (Vorschuss).",
      "Titulierte Ansprüche verjähren erst nach 30 Jahren (§ 197 Abs. 1 Nr. 3 BGB) – künftig fällig werdende Zinsen aber nach drei Jahren (§ 197 Abs. 2 BGB).",
    ],
    entwurf: {
      titel: kuratiert ? "Ratenzahlungsvereinbarung – Angebot an den Schuldner (Entwurf)" : "Zahlungsaufforderung mit Ratenangebot (Entwurf)",
      text: `${anschrift(schuldner, "Schuldner")}\n\nUnser Zeichen: ${akte.aktenzeichen} – ${akte.titel}\nZwangsvollstreckung aus dem ${titel}${az ? ` – Geschäftsnr. ${az}` : ""}\n\n${anrede(schuldner)}\n\nwir vertreten ${imText(mandant, "unsere Mandantschaft")}. ${summeRaten ? `Ihre bisherigen Teilzahlungen über insgesamt ${fmtEUR(summeRaten)} haben wir nach § 367 Abs. 1 BGB zunächst auf die Kosten, dann auf die Zinsen und zuletzt auf die Hauptforderung angerechnet. ` : ""}${stand ? `Zum ${fmtDate(today())} beträgt die Restforderung ${fmtEUR(stand.gesamt)} (Hauptforderung ${fmtEUR(stand.hauptforderung)}, Zinsen ${fmtEUR(stand.zinsen)}, Kosten ${fmtEUR(stand.kosten)}); weitere Zinsen laufen täglich auf.` : "[Restforderung laut Forderungskonto]"}\n\nUnsere Mandantschaft ist bereit, von weiteren Vollstreckungsmaßnahmen vorerst abzusehen, wenn Sie\n1. monatliche Raten von [Betrag] €, jeweils zum [Tag] eines Monats, beginnend am [Datum], zahlen und\n2. diese Vereinbarung bis zum [Datum] unterschrieben zurücksenden.\n\nGeraten Sie mit einer Rate länger als [zwei Wochen] in Rückstand, wird die gesamte Restforderung sofort fällig und die Vollstreckung fortgesetzt.\n\nMit freundlichen Grüßen\n\n${unterschrift(verfasser)}`,
    },
  };
}

// ───────────── Hauptfunktion ─────────────

interface LlmFall {
  zusammenfassung: string;
  rechtsfragen: string[];
  erfolgsaussichtProzent: number;
  erfolgsaussichtBegruendung: string;
  argumentePro: string[];
  argumenteContra: string[];
  praezedenzfaelle: { id: string; warum: string }[];
  naechsteSchritte: { titel: string; detail: string }[];
  risiken: string[];
  entwurfTitel: string;
  entwurfText: string;
}

export async function analysiereFall(
  akteId: string,
  data: TenantData,
  opts: { onPhase?: (i: number) => void; signal?: AbortSignal; onText?: (t: string) => void; verfasser?: Verfasser } = {},
): Promise<Fallanalyse> {
  const t0 = performance.now();
  const akte = data.akten.find((a) => a.id === akteId);
  if (!akte) throw new Error("Akte nicht gefunden.");
  const verfasser = opts.verfasser ?? verfasserAusSitzung(akte);
  const phase = (i: number) => opts.onPhase?.(i);
  const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
  phase(0);
  const kontext = akteAlsText(akte, data);
  await warte(450);
  phase(1);
  await warte(350);
  phase(2);
  const treffer = findePraezedenzfaelle(akte, data, 5);
  await warte(500);
  phase(3);

  if (aktuelleQuelle() !== "demo") {
    try {
      // Kandidaten für die Live-KI: die relevanten Treffer plus weitere Entscheidungen desselben Rechtsgebiets –
      // die KI wählt daraus begründet aus (nur diese dürfen zitiert werden).
      const weitere = ENTSCHEIDUNGEN.filter((e) => e.rechtsgebiet === akte.sachgebiet && !treffer.some((x) => x.entscheidung.id === e.id))
        .map((e) => bewertePraezedenz(akte, data, e))
        .sort((a, b) => b.score - a.score);
      const kandidaten = [...treffer, ...weitere].slice(0, 8);
      const res = await llmJson<LlmFall>({
        system:
          "Du bist eine erfahrene deutsche Rechtsanwältin und erstellst für Kolleginnen und Kollegen eine präzise, ehrliche Fallanalyse. Zitiere ausschließlich Entscheidungen aus der mitgelieferten Liste (über ihre id) – erfinde keine Aktenzeichen, Gerichte oder Fundstellen. Nenne Normen korrekt. Berechne keine Fristen. Übernimm Daten (z. B. das Datum eines Kündigungsschreibens) exakt aus den Dokumenten; das Zugangsdatum ist nicht das Datum der Kündigung. Richte die Analyse an Phase und Sachgebiet aus: Liegt ein Urteil vor, prüfe Rechtsmittel (Beschwer, Berufungssumme 1.000 € nach § 511 Abs. 2 Nr. 1 ZPO) und informiere die Mandantschaft; in der Vollstreckung geht es um Maßnahmen und Realisierung, nicht um Prozessaussichten; im Straf- und Bußgeldverfahren um die Verteidigung – den Tatnachweis führen die Behörden. Seit dem 01.01.2026 sind die Amtsgerichte bis 10.000 € zuständig (§ 23 Nr. 1 GVG). Schreibe auf Deutsch, sachlich, ohne Floskeln.",
        messages: [
          {
            role: "user",
            content: `Heute ist der ${fmtDate(today())}.${verfasser ? ` Der Entwurf wird unterschrieben von: ${verfasser.name}${verfasser.titel ? ` (${verfasser.titel})` : ""}.` : ""}\n\nAKTE:\n${kontext}\n\nKANDIDATEN AUS DER FALL-DATENBANK (nur diese dürfen zitiert werden):\n${kandidaten.map((t) => `- id=${t.entscheidung.id} | ${t.entscheidung.gericht} ${t.entscheidung.art} v. ${fmtDate(t.entscheidung.datum)} – ${t.entscheidung.az} | ${t.entscheidung.titel} | Leitsatz: ${t.entscheidung.leitsatz}`).join("\n")}\n\nErstelle die Fallanalyse als JSON:\n{"zusammenfassung": string (3-4 Sätze), "rechtsfragen": string[3-5], "erfolgsaussichtProzent": number 0-100, "erfolgsaussichtBegruendung": string, "argumentePro": string[3-5], "argumenteContra": string[2-4], "praezedenzfaelle": [{"id": string (aus der Liste), "warum": string}] (2-4, nach Relevanz), "naechsteSchritte": [{"titel": string, "detail": string}] (3-5), "risiken": string[1-3], "entwurfTitel": string, "entwurfText": string (passender Schriftsatz- oder Schreiben-Entwurf, max. 2.500 Zeichen, mit Platzhaltern in [eckigen Klammern] wo Angaben fehlen)}`,
          },
        ],
        signal: opts.signal,
        effort: "medium",
        onText: opts.onText,
      });
      phase(4);
      const max = Math.max(1, ...kandidaten.map((k) => k.score));
      const praez = (res.praezedenzfaelle ?? [])
        .map((p, i) => {
          const t = kandidaten.find((k) => k.entscheidung.id === p.id);
          if (!t) return null;
          return { id: t.entscheidung.id, gericht: t.entscheidung.gericht, az: t.entscheidung.az, titel: t.entscheidung.titel, relevanz: Math.max(60, relevanzProzent(t.score, max) - i * 3), warum: p.warum };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
      const prozent = Math.max(0, Math.min(100, Math.round(res.erfolgsaussichtProzent)));
      return {
        zusammenfassung: res.zusammenfassung,
        rechtsfragen: res.rechtsfragen ?? [],
        erfolgsaussicht: { prozent, stufe: stufe(prozent), begruendung: res.erfolgsaussichtBegruendung },
        argumentePro: res.argumentePro ?? [],
        argumenteContra: res.argumenteContra ?? [],
        praezedenzfaelle: praez.length ? praez : praezedenzListe(treffer),
        naechsteSchritte: mitDeckungsstand(res.naechsteSchritte ?? [], akte, data),
        risiken: res.risiken ?? [],
        entwurf: { titel: res.entwurfTitel || "Entwurf", text: res.entwurfText || "" },
        quelle: aktuelleQuelle(),
        dauerMs: performance.now() - t0,
        erstelltAm: new Date().toISOString(),
      };
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      if (!(e instanceof DemoModus)) console.warn("Live-Fallanalyse fehlgeschlagen – Offline-Analyse", e);
    }
  }
  await warte(700);
  phase(4);
  await warte(450);
  const demo = demoAnalyse(akte, data, treffer, verfasser);
  return { ...demo, naechsteSchritte: mitDeckungsstand(demo.naechsteSchritte, akte, data), quelle: "demo", dauerMs: performance.now() - t0, erstelltAm: new Date().toISOString() };
}

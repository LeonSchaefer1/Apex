// KI-Fallanalyse: Sachverhalt → Rechtsfragen → Präzedenzfälle → Erfolgsaussicht → nächste Schritte → Entwurf.
import { addDays, fmtDate, fmtEUR, today } from "@/core/dates";
import { ENTSCHEIDUNGEN } from "@/core/rechtsprechung";
import type { Akte, TenantData } from "@/core/types";
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
  return p >= 65 ? "hoch" : p >= 40 ? "mittel" : "gering";
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
  const frist = data.fristen.find((f) => f.akteId === akte.id && f.status === "offen" && (f.typ === "notfrist" || f.typ === "frist"));
  const fristText = frist ? `${frist.titel} bis ${fmtDate(frist.datum)}` : undefined;
  // Die ausformulierten Analysen gehören zu den Präsentationsakten – andere Akten mit ähnlichem Thema erhalten die allgemeine Analyse.
  const praesentation = akte.id.startsWith("hero-");

  if (praesentation && akte.sachgebiet === "Arbeitsrecht" && /fristlos|bagatell|kaffee|geringwertig/i.test(akte.beschreibung)) {
    const kd = kuendigungsDaten(akte, data);
    const kuendigungVom = kd.kuendigung ? ` vom ${kd.kuendigung}` : " vom [Datum des Kündigungsschreibens]";
    const zugegangen = kd.zugang ? `, dem Kläger zugegangen am ${kd.zugang},` : "";
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
        "Geringer Wert (8,97 €), Ware war beschädigt und zur Entsorgung bestimmt – kein echter Vermögensschaden.",
        "Duldung durch den Schichtleiter: Mandant durfte annehmen, die Mitnahme sei erlaubt (Zeuge: Kollege Pohl).",
        "Keine vorherige Abmahnung, keine Anhörung des Mandanten.",
        "Soziale Gesichtspunkte: 52 Jahre, zwei unterhaltsberechtigte Kinder.",
      ],
      argumenteContra: [
        "Auch Bagatelldelikte können grundsätzlich einen wichtigen Grund darstellen.",
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
        { titel: "Mandanten auf § 38 SGB III hinweisen", detail: "Arbeitsuchendmeldung innerhalb von drei Tagen – sonst droht eine Sperrzeit." },
        { titel: "Deckungszusage der Rechtsschutzversicherung abwarten", detail: "Anfrage an Nordlicht Rechtsschutz AG läuft automatisch, Wiedervorlage ist gesetzt." },
      ],
      risiken: [
        "Kostenrisiko gering: In der 1. Instanz trägt jede Partei ihre Anwaltskosten selbst (§ 12a ArbGG); Rechtsschutz angefragt.",
        "Bei Vergleich: Abfindung realistisch 0,5–1,0 Bruttomonatsgehälter je Beschäftigungsjahr (rund 23.800–47.600 €).",
      ],
      entwurf: {
        titel: "Kündigungsschutzklage (Entwurf)",
        text: `An das\nArbeitsgericht Berlin\n\nKlage\n\ndes Herrn Thomas Weber, Seestraße 41, 13353 Berlin\n– Kläger –\nProzessbevollmächtigte: Hartmann & Partner Rechtsanwälte\n\ngegen\n\ndie Kröger Logistik GmbH, Am Juliusturm 12, 13599 Berlin\n– Beklagte –\n\nwegen: Kündigungsschutz\nStreitwert: 10.200,00 €\n\nNamens und in Vollmacht des Klägers erheben wir Klage und werden beantragen:\n\n1. Es wird festgestellt, dass das Arbeitsverhältnis der Parteien durch die außerordentliche Kündigung der Beklagten${kuendigungVom}${zugegangen} nicht aufgelöst worden ist.\n2. Es wird festgestellt, dass das Arbeitsverhältnis auch nicht durch die hilfsweise erklärte ordentliche Kündigung${kuendigungVom} aufgelöst wird.\n3. Die Beklagte wird verurteilt, den Kläger bis zum rechtskräftigen Abschluss des Verfahrens zu unveränderten Arbeitsbedingungen als Lagerist weiterzubeschäftigen.\n\nBegründung:\n\nI. Der 52-jährige Kläger ist seit dem 01.04.2012 bei der Beklagten als Lagerist beschäftigt, zuletzt zu einem Bruttomonatsentgelt von 3.400,00 €. Er ist verheiratet und zwei Kindern zum Unterhalt verpflichtet. Das Arbeitsverhältnis verlief in 14 Jahren beanstandungsfrei; eine Abmahnung wurde nie ausgesprochen.\n\nII. Die Beklagte stützt die Kündigung darauf, der Kläger habe drei beschädigte, zur Entsorgung bestimmte Kaffeepackungen im Wert von 8,97 € mitgenommen. Die Mitnahme von Bruchware wurde im Betrieb seit Jahren praktiziert und vom Schichtleiter geduldet.\nBeweis: Zeugnis des Herrn Pohl, zu laden über die Beklagte.\n\nIII. Ein wichtiger Grund im Sinne des § 626 Abs. 1 BGB liegt nicht vor. Nach der Rechtsprechung des Bundesarbeitsgerichts ist bei der Interessenabwägung die durch langjährige, ungestörte Zusammenarbeit entstandene Vertrauensposition zu berücksichtigen (BAG, Urt. v. 10.06.2010 – 2 AZR 541/09). Angesichts des minimalen Werts, der Duldung durch Vorgesetzte und der 14-jährigen Betriebszugehörigkeit wäre eine Abmahnung als milderes Mittel ausreichend gewesen.\n\nIV. Die ordnungsgemäße Anhörung des Betriebsrats nach § 102 BetrVG wird mit Nichtwissen bestritten.\n\n${unterschrift(verfasser)}`,
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
      risiken: ["Bei Teilunterliegen wegen der Küche anteilige Kostentragung.", "Streitwert unter 600 € für die Gegenforderung – keine Berufung möglich."],
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
        { titel: "Fremdgeld weiterleiten", detail: "6.120 € an die Mandantin auszahlen (§ 43a Abs. 5 BRAO) – heute fällig." },
        { titel: "Nachforderung 1.284,50 € stellen", detail: "Mit Verweis auf BGH VI ZR 53/09 und Scheckheft, Frist 14 Tage." },
        { titel: "Bei Ablehnung: Klage beim Amtsgericht", detail: "Kostenrisiko gering, Erfolgsaussicht hoch." },
      ],
      risiken: ["Gutachterkosten und Nutzungsausfall gesondert prüfen (noch offen?)."],
      entwurf: { titel: "Nachforderungsschreiben (Entwurf)", text: `Schaden-Nr. EV-2026-448812\n\nSehr geehrte Damen und Herren,\n\nIhre Kürzung der Reparaturkosten um 1.284,50 € ist unberechtigt. Das Fahrzeug unserer Mandantin ist erst zwei Jahre alt und wurde ausschließlich in einer Markenwerkstatt gewartet. Ein Verweis auf eine freie Werkstatt ist nach der Rechtsprechung des BGH (Urt. v. 20.10.2009 – VI ZR 53/09) in diesem Fall unzumutbar.\n\nWir fordern Sie auf, den Restbetrag von 1.284,50 € binnen 14 Tagen auf unser Konto zu überweisen.\n\nMit freundlichen Grüßen` },
    };
  }

  // Generische Analyse je Sachgebiet
  const p = Math.min(88, 52 + treffer.length * 5 + (akte.prioritaet === "hoch" ? 4 : 0));
  const top = treffer[0]?.entscheidung;
  return {
    zusammenfassung: `${akte.titel}: ${akte.beschreibung}`,
    rechtsfragen: [
      `Welche Ansprüche bestehen im Bereich ${akte.sachgebiet} und sind sie durchsetzbar?`,
      top ? `Lässt sich die Rechtsprechung „${top.titel}“ (${top.gericht} ${top.az}) übertragen?` : "Welche Rechtsprechung ist einschlägig?",
      "Welche Beweismittel stehen zur Verfügung?",
    ],
    erfolgsaussicht: {
      prozent: p,
      stufe: stufe(p),
      begruendung: `Vorläufige Einschätzung auf Basis des Sachverhalts${treffer.length === 0 ? " – in der Fall-Datenbank fand sich keine hinreichend ähnliche Entscheidung" : treffer.length === 1 ? " und einer passenden Entscheidung aus der Fall-Datenbank" : ` und ${treffer.length} passender Entscheidungen aus der Fall-Datenbank`}. Mit vollständiger Beweislage präzisierbar.`,
    },
    argumentePro: [top ? `Einschlägige Rechtsprechung: ${top.gericht} ${top.az} – ${top.bedeutung}` : "Sachverhalt ist gut dokumentiert.", "Vollständige Unterlagen in der E-Akte vorhanden."],
    argumenteContra: ["Einwendungen der Gegenseite noch nicht vollständig bekannt.", "Beweislast für anspruchsbegründende Tatsachen liegt beim Mandanten."],
    praezedenzfaelle: praezedenzListe(treffer),
    naechsteSchritte: [
      { titel: fristText ? `Frist beachten: ${fristText}` : "Fristen prüfen", detail: "Im Fristenkalender ist die Vorfrist bereits gesetzt." },
      { titel: "Sachverhalt mit Mandant abstimmen", detail: "Offene Punkte im nächsten Mandanten-Update abfragen." },
      { titel: "Schriftsatz vorbereiten", detail: "Entwurf unten als Ausgangspunkt nutzen." },
    ],
    risiken: ["Kostenrisiko abhängig vom Gegenstandswert " + (akte.gegenstandswert ? fmtEUR(akte.gegenstandswert) : "–") + "."],
    entwurf: { titel: "Schreiben an die Gegenseite (Entwurf)", text: `In Sachen ${akte.titel}\nunser Zeichen: ${akte.aktenzeichen}\n\nSehr geehrte Damen und Herren,\n\nwir zeigen an, dass wir ${mandant} vertreten. ${akte.beschreibung}\n\n${top ? `Wir verweisen auf die Entscheidung ${top.gericht}, ${top.art} vom ${fmtDate(top.datum)} – ${top.az}.\n\n` : ""}Wir fordern Sie auf, bis zum ${fmtDate(addDays(today(), 14))} Stellung zu nehmen.\n\nMit freundlichen Grüßen\n\n${unterschrift(verfasser)}` },
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
          "Du bist eine erfahrene deutsche Rechtsanwältin und erstellst für Kolleginnen und Kollegen eine präzise, ehrliche Fallanalyse. Zitiere ausschließlich Entscheidungen aus der mitgelieferten Liste (über ihre id) – erfinde keine Aktenzeichen, Gerichte oder Fundstellen. Nenne Normen korrekt. Berechne keine Fristen. Übernimm Daten (z. B. das Datum eines Kündigungsschreibens) exakt aus den Dokumenten; das Zugangsdatum ist nicht das Datum der Kündigung. Schreibe auf Deutsch, sachlich, ohne Floskeln.",
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
        naechsteSchritte: res.naechsteSchritte ?? [],
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
  return { ...demoAnalyse(akte, data, treffer, verfasser), quelle: "demo", dauerMs: performance.now() - t0, erstelltAm: new Date().toISOString() };
}

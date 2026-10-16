// Cockpit: leitet aus den Kanzleidaten alles ab, was „Ihr Tag auf einen Blick" zeigt – inkl. KI-Tagesbriefing.
import { useMemo } from "react";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { addDays, diffDays, fmtDateShort, fmtEUR, today, wochentagName } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import { vertreteneIds, vertretungsUmfang } from "@/core/vertretung";
import { gruss as foermlicherGruss } from "@/lib/rollen";
import { aktenMitFrist, fristenLage, istKritisch, nachDringlichkeit, zaehltAlsFrist, type FristenLage } from "@/core/fristenLage";
import {
  briefingText, finanzZahlen, fristArtLabel, motorZahlen, naechsteTermine, posteingangZahlen, tagesbriefing,
  type BriefingSatz, type BriefingTeil, type FinanzZahlen,
} from "@/core/kennzahlen";
import type { Akte, Aktivitaet, Bundesland, Frist, FristTyp, ISODate, Nachricht, User } from "@/core/types";

/** Ziel des 38h-Motors (Stunden je Woche und Kanzlei). */
export const ZIEL_STUNDEN = 38;
/** Bewertung einer gesparten Stunde: 38 Std./Woche × 48 Arbeitswochen ≙ ca. 36.000 €/Jahr (Markenversprechen). */
export { WERT_PRO_STUNDE, WOCHEN_PRO_JAHR as ARBEITSWOCHEN } from "@/core/automationen";

export type Ansicht = "kanzlei" | "meine";

const TITEL = /^(?:Dr\.|Prof\.|Dipl\.-[\wäöü]+\.?|med\.|jur\.|rer\.|pol\.|h\.\s?c\.|LL\.\s?M\.|Mag\.)\s*/i;

/** Vorname ohne akademische Titel: „Dr. Julia Hartmann" → „Julia". */
export function vorname(name: string): string {
  let n = name.trim();
  for (let i = 0; i < 6 && TITEL.test(n); i++) n = n.replace(TITEL, "");
  return n.split(/\s+/)[0] || name;
}

/** Tageszeitgruß ohne Namen. */
export function gruss(d = new Date()): string {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "Guten Morgen";
  if (h >= 11 && h < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Förmliche Begrüßung mit Anrede und Grad: „Guten Tag, Frau Dr. Hartmann“ – nie mit Vornamen (src/lib/rollen.ts). */
export function begruessung(u: User, d = new Date()): string {
  return foermlicherGruss(u, d.getHours());
}

export function naechsterWerktag(iso: string, land: Bundesland): string {
  let d = addDays(iso, 1);
  for (let i = 0; i < 10 && !istWerktag(d, land); i++) d = addDays(d, 1);
  return d;
}

export const TYP_RANG: Record<FristTyp, number> = { notfrist: 0, frist: 1, vorfrist: 2, wiedervorlage: 3, termin: 4 };
export const TYP_LABEL: Record<FristTyp, string> = { notfrist: "Notfrist", frist: "Frist", vorfrist: "Vorfrist", wiedervorlage: "Wiedervorlage", termin: "Termin" };

/** Sortierung wie in der Fristenzählung (src/core/fristenLage.ts): Datum, dann kritische Fristen zuerst. */
export const sortiereFristen = nachDringlichkeit;

/** Bezeichnung im Satz: „Notfrist“, „nicht verlängerbare Frist“, „Frist“, „Wiedervorlage“ … (wie im Tagesbriefing) */
export const artLabel = fristArtLabel;

/** „heute", „morgen", „Mo, 19. Okt." */
export function tagLabel(iso: string, heute: string): string {
  const n = diffDays(heute, iso);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  return `${wochentagName(iso, true)}, ${fmtDateShort(iso)}`;
}

/** Ein Teil eines Briefing-Satzes: Anzeige-Text, optional abweichend gesprochen, optional betont/verlinkt. */
export type Teil = BriefingTeil;
export type Satz = BriefingSatz;

export interface CockpitDaten {
  heute: string;
  bisTag: string; // nächster Werktag
  wochenende: boolean; // morgen ist kein Werktag
  user: User;
  team: Map<string, User>;
  akten: Map<string, Akte>;
  /** Einheitliche Fristenzählung (wie Navigation, Fristenkalender und Assistent): Fristen getrennt von Wiedervorlagen, Vorfristen, Terminen. */
  lage: FristenLage;
  /** Liste der Fristenkarte: offen, ≤ nächster Werktag, ohne Termine (Fristen, Wiedervorlagen und Vorfristen – je mit Typ). */
  bisWerktag: Frist[];
  ueberfaellig: number;
  heuteFaellig: number;
  /** kritische Fristen (Notfrist oder nicht verlängerbar) von heute bis in 7 Tagen */
  kritischWoche: Frist[];
  woche: Frist[]; // offene Fristen (Notfristen und Fristen), heute < datum ≤ heute + 7
  kritischste?: Frist;
  posteingang: Nachricht[];
  wartetAufKi: number;
  kiFertig: number;
  eeb: number;
  termine: Frist[];
  /** Termine heute (typ 'termin', offen) – nach Uhrzeit, in „Nur meine“ auch die der vertretenen Personen */
  termineHeute: Frist[];
  /** Personen, die heute abwesend sind und von mir vertreten werden (§ 53 BRAO) – mit ihren heute und bald fälligen Einträgen */
  vertretung: { person: User; fristen: number; weitere: number; bis: ISODate; bisAbwesenheitsende: boolean }[];
  /** verantwortlichId → vertretene Person, für die Kennzeichnung „Vertretung für …“ */
  vertreten: Map<string, User>;
  /** Wochenblick: Fristen und Termine je Werktag; Wiedervorlagen getrennt (nur im Tooltip) */
  wochenTage: { datum: string; fristen: number; wiedervorlagen: number; termine: number; kritisch: boolean }[];
  /** Offene Akten mit Frist ≤ 7 Tage (wie Akten-Kennzahl, `aktenMitFrist`), danach Akten mit hoher Priorität */
  handlungsbedarf: { akte: Akte; naechste?: Frist; gruende: { text: string; ton: "seal" | "amber" | "ink" | "violet" | "neutral" }[] }[];
  /** davon Akten mit Frist ≤ 7 Tage – dieselbe Zahl wie die Akten-Kennzahl „Akten mit Frist ≤ 7 Tage“ */
  aktenMitFrist: number;
  /** davon Akten ohne Frist im Fenster, aber mit hoher Priorität */
  aktenNurPrio: number;
  motor: { stunden: number; tage: number[]; tagLabels: string[]; zuletzt: Aktivitaet[]; euroWoche: number; euroJahr: number };
  /** offene Forderungen, Fremdgeld, Bankabgleich – dieselbe Berechnung wie Apex Assistent und Abrechnung (src/core/kennzahlen.ts) */
  finanzen: FinanzZahlen;
  kiAkte?: Akte;
  kiAkteFrist?: Frist;
  briefing: Satz[];
}

/** Gesprochene Fassung: Aktenzeichen und Paragrafen so, wie man sie vorliest. */
export function sprechText(s: Satz): string {
  return briefingText(s, true)
    .replace(/(\d+)\/(\d{2})\b/g, "$1 Strich $2")
    .replace(/§§/g, "Paragrafen")
    .replace(/§/g, "Paragraf")
    .replace(/–/g, ",");
}
export function anzeigeText(s: Satz): string {
  return briefingText(s);
}

export function useCockpitDaten(ansicht: Ansicht): CockpitDaten {
  const { user, team, tenant } = useKanzlei();
  const fristen = useData((s) => s.data.fristen);
  const aktenArr = useData((s) => s.data.akten);
  const nachrichten = useData((s) => s.data.nachrichten);
  const aktivitaeten = useData((s) => s.data.aktivitaeten);
  const rechnungen = useData((s) => s.data.rechnungen);
  const buchungen = useData((s) => s.data.buchungen);
  const transaktionen = useData((s) => s.data.transaktionen);

  return useMemo(() => {
    const heute = today();
    const land = tenant.bundesland;
    const bisTag = naechsterWerktag(heute, land);
    const akten = new Map(aktenArr.map((a) => [a.id, a]));
    const teamMap = new Map(team.map((u) => [u.id, u]));
    const meine = ansicht === "meine";
    // Vertretung (§ 53 BRAO): Wer heute abwesend ist und mich als Vertretung eingetragen hat – dessen Fristen gehören in „Nur meine“.
    const vIds = vertreteneIds(team, user.id, heute);
    const vertreten = new Map<string, User>();
    for (const id of vIds) {
      const p = teamMap.get(id);
      if (p) vertreten.set(id, p);
    }
    const zustaendig = (f: Frist) => f.verantwortlichId === user.id || vertreten.has(f.verantwortlichId);
    const meineFristen = meine ? fristen.filter(zustaendig) : fristen;

    const offen = fristen.filter((f) => f.status === "offen" && (!meine || zustaendig(f)));
    const ohneTermine = offen.filter((f) => f.typ !== "termin");
    // Zahlen für Briefing und Kennzahlen: dieselbe Zählweise wie Navigation, Fristenkalender und Apex Assistent.
    const lage = fristenLage(meineFristen, heute);
    const bisWerktag = ohneTermine.filter((f) => f.datum <= bisTag).sort(sortiereFristen);
    const ueberfaellig = lage.ueberfaellig.length;
    const heuteFaellig = lage.heute.length;
    const woche = lage.woche;
    // bei gleichem Datum: kritische Fristen, dann Akten mit hoher Priorität zuerst
    const prio = (f: Frist) => (akten.get(f.akteId)?.prioritaet === "hoch" ? 0 : 1);
    const nachPrio = (a: Frist, b: Frist) => nachDringlichkeit(a, b) || prio(a) - prio(b);
    const kritischWoche = [...lage.kritischWoche].sort(nachPrio);
    // Am dringendsten: Überfälliges, dann heute Fälliges (kritische zuerst), dann kritische Fristen der nächsten 7 Tage, dann die nächste Frist.
    const kritischste =
      [...lage.ueberfaellig].sort(nachPrio)[0] ??
      [...lage.heute].sort(nachPrio)[0] ??
      kritischWoche[0] ??
      [...lage.woche].sort(nachPrio)[0];

    // Posteingang (eingehend, neu) – wie Briefing, Navigation und Apex Assistent
    const post = posteingangZahlen(nachrichten);
    const posteingang = post.neu;
    const { wartetAufKi, kiFertig, eeb } = post;

    // Termine (offen, ab heute; in „Meine Sicht“ nur eigene)
    const termine = naechsteTermine(fristen, heute, meine ? user.id : undefined);
    const termineHeute = offen.filter((f) => f.typ === "termin" && f.datum === heute).sort((a, b) => (a.uhrzeit ?? "99").localeCompare(b.uhrzeit ?? "99"));
    // über den ganzen Abwesenheitszeitraum (nicht nur 7 Tage) – sonst fehlt z. B. die Frist kurz vor der Rückkehr
    const vertretung = [...vertreten.values()].map((person) => ({ person, ...vertretungsUmfang(fristen, person, heute) }));

    // Wochenblick: die nächsten 5 Werktage ab heute
    const wochenTage: CockpitDaten["wochenTage"] = [];
    let d = istWerktag(heute, land) ? heute : naechsterWerktag(heute, land);
    for (let i = 0; i < 5; i++) {
      const tagF = offen.filter((f) => f.datum === d);
      wochenTage.push({
        datum: d,
        fristen: tagF.filter(zaehltAlsFrist).length,
        wiedervorlagen: tagF.filter((f) => f.typ === "wiedervorlage").length,
        termine: tagF.filter((f) => f.typ === "termin").length,
        kritisch: tagF.some(istKritisch),
      });
      d = naechsterWerktag(d, land);
    }

    // Akten mit Handlungsbedarf: offene Akten mit Frist ≤ 7 Tage (inkl. überfälliger) – dieselbe Hilfsfunktion und Zahl
    // wie die Akten-Kennzahl „Akten mit Frist ≤ 7 Tage“ –, danach Akten mit hoher Priorität. Wiedervorlagen zählen nicht.
    const jeAkte = aktenMitFrist(fristen, heute);
    const handlungsbedarf = aktenArr
      .filter((a) => a.status === "offen" && (!meine || a.bearbeiterId === user.id || a.sachbearbeiterId === user.id))
      .map((a) => {
        const info = jeAkte.get(a.id);
        const bald = info?.naechste;
        const gruende: CockpitDaten["handlungsbedarf"][number]["gruende"] = [];
        if (bald) {
          const tage = diffDays(heute, bald.datum);
          const wann = tage < 0 ? `seit ${-tage} ${-tage === 1 ? "Tag" : "Tagen"} überfällig` : tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
          gruende.push({ text: `${TYP_LABEL[bald.typ]} ${wann}`, ton: istKritisch(bald) || tage <= 1 ? "seal" : "amber" });
          if (info.kritisch && info.kritisch !== bald) {
            const kt = diffDays(heute, info.kritisch.datum);
            gruende.push({ text: `${info.kritisch.typ === "notfrist" ? "Notfrist" : "Nicht verlängerbar"} ${kt === 0 ? "heute" : kt === 1 ? "morgen" : `in ${kt} Tagen`}`, ton: "seal" });
          }
        }
        if (a.prioritaet === "hoch") gruende.push({ text: "Hohe Priorität", ton: "ink" });
        return { akte: a, naechste: bald, kritisch: !!info?.kritisch, gruende };
      })
      .filter((x) => x.gruende.length > 0)
      .sort((x, y) => {
        // zuerst Akten mit Frist (kritische vorn, dann nach Datum), danach Akten nur mit hoher Priorität
        const fx = x.naechste ? (x.kritisch ? 0 : 1) : 2;
        const fy = y.naechste ? (y.kritisch ? 0 : 1) : 2;
        if (fx !== fy) return fx - fy;
        const dx = x.naechste?.datum ?? "9999";
        const dy = y.naechste?.datum ?? "9999";
        if (dx !== dy) return dx.localeCompare(dy);
        return (x.akte.prioritaet === "hoch" ? 0 : 1) - (y.akte.prioritaet === "hoch" ? 0 : 1);
      })
      .map(({ akte, naechste, gruende }) => ({ akte, naechste, gruende }));
    const aktenMitFristAnzahl = handlungsbedarf.filter((x) => x.naechste).length;

    // 38h-Motor: letzte 7 Tage – dieselbe Berechnung wie Apex Island und Apex Assistent
    const mz = motorZahlen(aktivitaeten, heute);
    const motor = {
      stunden: mz.stunden,
      tage: mz.proTag.map((t) => t.minuten / 60),
      tagLabels: mz.proTag.map((t) => wochentagName(t.datum, true)),
      zuletzt: aktivitaeten.filter((a) => a.akteur === "automation" || a.akteur === "ki").slice(0, 3),
      euroWoche: mz.euro,
      euroJahr: mz.euroJahr,
    };

    // Finanzen – wie Apex Assistent
    const finanzen = finanzZahlen(rechnungen, buchungen, transaktionen, heute);

    // KI-Empfehlung: Präsentationsakte 142/.. – sonst wichtigste Akte mit hoher Priorität ohne Analyse
    const kiAkte =
      aktenArr.find((a) => a.status === "offen" && a.aktenzeichen.startsWith("142/")) ??
      aktenArr.find((a) => a.status === "offen" && a.prioritaet === "hoch" && !a.kiAnalyse) ??
      aktenArr.find((a) => a.status === "offen" && a.prioritaet === "hoch");
    // wichtigste offene Frist der Akte: kritische zuerst, dann die nächste (Wiedervorlagen und Vorfristen zählen nicht)
    const kiAkteFrist = kiAkte
      ? fristen.filter((f) => f.akteId === kiAkte.id && f.status === "offen" && zaehltAlsFrist(f)).sort((a, b) => Number(istKritisch(b)) - Number(istKritisch(a)) || nachDringlichkeit(a, b))[0]
      : undefined;

    // ── KI-Tagesbriefing: drei Sätze aus den Daten – wortgleich mit dem Apex Assistenten („Was steht heute an?“) ──
    // „fällig“ = heute fällig + überfällig; gezählt werden nur Fristen (Notfristen und Fristen) – wie Badge, Fristen-Kennzahl
    // und Assistent. Wiedervorlagen und Vorfristen werden getrennt genannt.
    // Mit Vertretung zählen in „Nur meine“ auch die Fristen der vertretenen Person mit – sonst wortgleich mit dem Assistenten.
    const briefing: Satz[] =
      meine && vertreten.size > 0
        ? tagesbriefing({ heute, fristen: meineFristen, akten: aktenArr, nachrichten })
        : tagesbriefing({ heute, fristen, akten: aktenArr, nachrichten, nurFuer: meine ? user.id : undefined });

    return {
      heute, bisTag, wochenende: bisTag !== addDays(heute, 1), user, team: teamMap, akten,
      lage, bisWerktag, ueberfaellig, heuteFaellig, kritischWoche, woche, kritischste,
      posteingang, wartetAufKi, kiFertig, eeb, termine, termineHeute, vertretung, vertreten, wochenTage, handlungsbedarf,
      aktenMitFrist: aktenMitFristAnzahl, aktenNurPrio: handlungsbedarf.length - aktenMitFristAnzahl, motor, finanzen,
      kiAkte, kiAkteFrist, briefing,
    };
  }, [fristen, aktenArr, nachrichten, aktivitaeten, rechnungen, buchungen, transaktionen, ansicht, user, team, tenant.bundesland]);
}

export function euro(n: number) {
  return fmtEUR(n, { cents: false });
}

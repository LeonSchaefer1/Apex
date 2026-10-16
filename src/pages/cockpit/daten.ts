// Cockpit: leitet aus den Kanzleidaten alles ab, was „Ihr Tag auf einen Blick" zeigt – inkl. KI-Tagesbriefing.
import { useMemo } from "react";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { addDays, diffDays, fmtDateShort, fmtEUR, fmtNum, today, wochentagName } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import { aktenMitFrist, fristenLage, istKritisch, nachDringlichkeit, zaehltAlsFrist, type FristenLage } from "@/core/fristenLage";
import type { Akte, Aktivitaet, Bundesland, Frist, FristTyp, Nachricht, User } from "@/core/types";

/** Ziel des 38h-Motors (Stunden je Woche und Kanzlei). */
export const ZIEL_STUNDEN = 38;
/** Bewertung einer gesparten Stunde: 38 Std./Woche × 48 Arbeitswochen ≙ ca. 36.000 €/Jahr (Markenversprechen). */
export { WERT_PRO_STUNDE, WOCHEN_PRO_JAHR as ARBEITSWOCHEN } from "@/core/automationen";
import { WERT_PRO_STUNDE, WOCHEN_PRO_JAHR as ARBEITSWOCHEN } from "@/core/automationen";

export type Ansicht = "kanzlei" | "meine";

const TITEL = /^(?:Dr\.|Prof\.|Dipl\.-[\wäöü]+\.?|med\.|jur\.|rer\.|pol\.|h\.\s?c\.|LL\.\s?M\.|Mag\.)\s*/i;

/** Vorname ohne akademische Titel: „Dr. Julia Hartmann" → „Julia". */
export function vorname(name: string): string {
  let n = name.trim();
  for (let i = 0; i < 6 && TITEL.test(n); i++) n = n.replace(TITEL, "");
  return n.split(/\s+/)[0] || name;
}

export function gruss(d = new Date()): string {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "Guten Morgen";
  if (h >= 11 && h < 18) return "Guten Tag";
  return "Guten Abend";
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

/** Bezeichnung im Satz: „Notfrist“, „nicht verlängerbare Frist“, „Frist“, „Wiedervorlage“ … */
export function artLabel(f: Frist): string {
  if (f.typ === "frist" && istKritisch(f)) return "nicht verlängerbare Frist";
  return TYP_LABEL[f.typ];
}

/** „heute", „morgen", „Mo, 19. Okt." */
export function tagLabel(iso: string, heute: string): string {
  const n = diffDays(heute, iso);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  return `${wochentagName(iso, true)}, ${fmtDateShort(iso)}`;
}

/** Ein Teil eines Briefing-Satzes: Anzeige-Text, optional abweichend gesprochen, optional betont/verlinkt. */
export interface Teil {
  t: string;
  s?: string;
  ton?: "fg" | "seal" | "amber" | "ink" | "violet";
  href?: string;
}
export type Satz = Teil[];

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
  /** Wochenblick: Fristen und Termine je Werktag; Wiedervorlagen getrennt (nur im Tooltip) */
  wochenTage: { datum: string; fristen: number; wiedervorlagen: number; termine: number; kritisch: boolean }[];
  /** Offene Akten mit Frist ≤ 7 Tage (wie Akten-Kennzahl, `aktenMitFrist`), danach Akten mit hoher Priorität */
  handlungsbedarf: { akte: Akte; naechste?: Frist; gruende: { text: string; ton: "seal" | "amber" | "ink" | "violet" | "neutral" }[] }[];
  /** davon Akten mit Frist ≤ 7 Tage – dieselbe Zahl wie die Akten-Kennzahl „Akten mit Frist ≤ 7 Tage“ */
  aktenMitFrist: number;
  /** davon Akten ohne Frist im Fenster, aber mit hoher Priorität */
  aktenNurPrio: number;
  motor: { stunden: number; tage: number[]; tagLabels: string[]; zuletzt: Aktivitaet[]; euroWoche: number; euroJahr: number };
  finanzen: { offen: number; offenAnzahl: number; ueberfaellig: number; ueberfaelligAnzahl: number; fremdgeld: number; fremdgeldAkten: number; bankOffen: number; aelteste: { id: string; nummer: string; akteId: string; tage: number; betrag: number }[] };
  kiAkte?: Akte;
  kiAkteFrist?: Frist;
  briefing: Satz[];
}

function satzText(s: Satz, gesprochen: boolean) {
  return s.map((p) => (gesprochen ? p.s ?? p.t : p.t)).join("");
}

/** Schließt einen Satz mit Punkt ab – ohne doppelten Punkt nach Abkürzungen („22. Okt."). */
function punkt(s: Satz) {
  const letzter = s[s.length - 1];
  if (letzter && /\.$/.test(letzter.t)) return;
  s.push({ t: "." });
}

/** Gesprochene Fassung: Aktenzeichen und Paragrafen so, wie man sie vorliest. */
export function sprechText(s: Satz): string {
  return satzText(s, true)
    .replace(/(\d+)\/(\d{2})\b/g, "$1 Strich $2")
    .replace(/§§/g, "Paragrafen")
    .replace(/§/g, "Paragraf")
    .replace(/–/g, ",");
}
export function anzeigeText(s: Satz): string {
  return satzText(s, false);
}

function plural(n: number, eins: string, viele: string) {
  return `${n === 1 ? "eine" : fmtNum(n)} ${n === 1 ? eins : viele}`;
}

function langDatum(iso: string) {
  return `${wochentagName(iso)}, ${fmtDateShort(iso).replace(/\.$/, "")}`;
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

    const offen = fristen.filter((f) => f.status === "offen" && (!meine || f.verantwortlichId === user.id));
    const ohneTermine = offen.filter((f) => f.typ !== "termin");
    // Zahlen für Briefing und Kennzahlen: dieselbe Zählweise wie Navigation, Fristenkalender und Apex Assistent.
    const lage = fristenLage(fristen, heute, meine ? user.id : undefined);
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

    // Posteingang (eingehend, neu)
    const posteingang = nachrichten.filter((n) => n.richtung === "ein" && n.status === "neu").sort((a, b) => b.eingang.localeCompare(a.eingang));
    const wartetAufKi = posteingang.filter((n) => n.kiStatus === "ausstehend" || !n.kiStatus).length;
    const kiFertig = posteingang.filter((n) => n.kiStatus === "analysiert" || n.kiStatus === "uebernommen").length;
    const eeb = posteingang.filter((n) => n.eebErforderlich && !n.eebAbgegeben).length;

    // Termine
    const termine = offen
      .filter((f) => f.typ === "termin" && f.datum >= heute)
      .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? ""))
      .slice(0, 5);

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

    // 38h-Motor: letzte 7 Tage (wie in der Apex Island)
    const grenze = addDays(heute, -6);
    const tageKeys = Array.from({ length: 7 }, (_, i) => addDays(grenze, i));
    const proTag = new Map(tageKeys.map((k) => [k, 0]));
    let minuten = 0;
    for (const a of aktivitaeten) {
      const tag = a.zeit.slice(0, 10);
      if (tag >= grenze && a.minutenGespart) {
        minuten += a.minutenGespart;
        proTag.set(tag, (proTag.get(tag) ?? 0) + a.minutenGespart);
      }
    }
    const stunden = minuten / 60;
    const zuletzt = aktivitaeten.filter((a) => a.akteur === "automation" || a.akteur === "ki").slice(0, 3);
    const motor = {
      stunden,
      tage: tageKeys.map((k) => (proTag.get(k) ?? 0) / 60),
      tagLabels: tageKeys.map((k) => wochentagName(k, true)),
      zuletzt,
      euroWoche: stunden * WERT_PRO_STUNDE,
      euroJahr: stunden * WERT_PRO_STUNDE * ARBEITSWOCHEN,
    };

    // Finanzen
    const offeneRe = rechnungen.filter((r) => r.status === "gestellt" || r.status === "teilbezahlt");
    const rest = (r: (typeof offeneRe)[number]) => Math.max(0, r.brutto - r.bezahlt);
    const ueberRe = offeneRe.filter((r) => r.faellig < heute);
    const fremdJeAkte = new Map<string, number>();
    for (const b of buchungen) if (b.art === "fremdgeld") fremdJeAkte.set(b.akteId, (fremdJeAkte.get(b.akteId) ?? 0) + b.betrag);
    const fremdOffen = [...fremdJeAkte.values()].filter((v) => v > 0.005);
    const finanzen = {
      offen: offeneRe.reduce((s, r) => s + rest(r), 0),
      offenAnzahl: offeneRe.length,
      ueberfaellig: ueberRe.reduce((s, r) => s + rest(r), 0),
      ueberfaelligAnzahl: ueberRe.length,
      fremdgeld: fremdOffen.reduce((s, v) => s + v, 0),
      fremdgeldAkten: fremdOffen.length,
      bankOffen: transaktionen.filter((t) => t.status === "offen").length,
      aelteste: [...ueberRe]
        .sort((a, b) => a.faellig.localeCompare(b.faellig))
        .slice(0, 2)
        .map((r) => ({ id: r.id, nummer: r.nummer, akteId: r.akteId, tage: diffDays(r.faellig, heute), betrag: rest(r) })),
    };

    // KI-Empfehlung: Präsentationsakte 142/.. – sonst wichtigste Akte mit hoher Priorität ohne Analyse
    const kiAkte =
      aktenArr.find((a) => a.status === "offen" && a.aktenzeichen.startsWith("142/")) ??
      aktenArr.find((a) => a.status === "offen" && a.prioritaet === "hoch" && !a.kiAnalyse) ??
      aktenArr.find((a) => a.status === "offen" && a.prioritaet === "hoch");
    // wichtigste offene Frist der Akte: kritische zuerst, dann die nächste (Wiedervorlagen und Vorfristen zählen nicht)
    const kiAkteFrist = kiAkte
      ? fristen.filter((f) => f.akteId === kiAkte.id && f.status === "offen" && zaehltAlsFrist(f)).sort((a, b) => Number(istKritisch(b)) - Number(istKritisch(a)) || nachDringlichkeit(a, b))[0]
      : undefined;

    // ── KI-Tagesbriefing: drei Sätze aus den Daten ──
    const briefing: Satz[] = [];
    {
      // „fällig" = heute fällig + überfällig; gezählt werden nur Fristen (Notfristen und Fristen) – wie Badge, Fristen-Kennzahl
      // und Assistent. Wiedervorlagen und Vorfristen werden getrennt genannt: „Heute sind 2 Fristen fällig, dazu 1 Wiedervorlage und 1 Vorfrist.“
      const s: Satz = [];
      const nF = lage.faellig.length;
      const nU = lage.ueberfaellig.length;
      const nWv = lage.wiedervorlagen.length;
      const nV = lage.vorfristen.length;
      const nW = lage.woche.length;
      const nWvW = lage.wiedervorlagenWoche.length;
      const dazu: Teil[] = [];
      if (nWv > 0) dazu.push({ t: plural(nWv, "Wiedervorlage", "Wiedervorlagen"), ton: "fg" });
      if (nV > 0) dazu.push({ t: plural(nV, "Vorfrist", "Vorfristen"), ton: "fg" });
      const dazuTeile = dazu.flatMap((p, k) => (k === 0 ? [p] : [{ t: " und " }, p]));
      if (nF + nWv + nV + nW + nWvW === 0) {
        s.push({ t: meine ? "Für Sie sind in den nächsten sieben Tagen keine Fristen notiert." : "In den nächsten sieben Tagen sind keine Fristen notiert." });
      } else {
        if (nF > 0) {
          s.push({ t: meine ? `Für Sie ${nF === 1 ? "ist" : "sind"} heute ` : `Heute ${nF === 1 ? "ist" : "sind"} ` });
          s.push({ t: plural(nF, "Frist", "Fristen"), ton: "fg" });
          s.push({ t: " fällig" });
          if (nU > 0) s.push({ t: nU === nF ? (nF === 1 ? " (bereits überfällig)" : " (alle bereits überfällig)") : ` (davon ${fmtNum(nU)} überfällig)`, ton: "seal" });
          if (dazuTeile.length) s.push({ t: ", dazu " }, ...dazuTeile);
        } else {
          s.push({ t: meine ? "Für Sie ist heute keine Frist fällig" : "Heute ist keine Frist fällig" });
          if (dazuTeile.length) s.push({ t: ", nur " }, ...dazuTeile);
        }
        if (nW > 0 || nWvW > 0) {
          s.push({ t: ". In den nächsten sieben Tagen " });
          if (nW > 0) {
            s.push({ t: nW === 1 ? (nF > 0 ? "folgt " : "steht ") : nF > 0 ? "folgen " : "stehen " });
            s.push({ t: nF > 0 ? (nW === 1 ? "eine weitere Frist" : `${fmtNum(nW)} weitere Fristen`) : plural(nW, "Frist", "Fristen"), ton: "fg" });
            if (nWvW > 0) s.push({ t: " und " }, { t: plural(nWvW, "Wiedervorlage", "Wiedervorlagen"), ton: "fg" });
            if (nF === 0) s.push({ t: " an" });
          } else {
            s.push({ t: "stehen keine weiteren Fristen an, nur " }, { t: plural(nWvW, "Wiedervorlage", "Wiedervorlagen"), ton: "fg" });
          }
        }
        if (kritischste) {
          const a = akten.get(kritischste.akteId);
          const ueber = kritischste.datum < heute;
          const kritisch = istKritisch(kritischste);
          s.push({ t: ueber ? " – sofort zu erledigen ist " : kritischste.datum === heute ? " – zuerst zu erledigen ist " : " – am dringendsten ist " });
          s.push({ t: `die ${artLabel(kritischste)} „${kritischste.titel}“`, ton: kritisch || ueber ? "seal" : "amber" });
          if (a) s.push({ t: " in " }, { t: a.aktenzeichen, ton: "ink", href: `/akten/${a.id}?tab=fristen` });
          if (ueber) s.push({ t: ` (fällig seit ${tagLabel(kritischste.datum, heute)})` });
          else if (kritischste.datum === heute) s.push({ t: " (heute fällig)" });
          else s.push({ t: ` bis ${tagLabel(kritischste.datum, heute)}`, s: ` bis ${langDatum(kritischste.datum)}` });
        }
        punkt(s);
      }
      briefing.push(s);
    }
    {
      const s: Satz = [];
      if (posteingang.length === 0) {
        s.push({ t: "Der Posteingang ist aufgeräumt – keine neuen Nachrichten." });
      } else {
        s.push({ t: "Im Posteingang " }, { t: posteingang.length === 1 ? "wartet " : "warten " });
        s.push({ t: plural(posteingang.length, "neue Nachricht", "neue Nachrichten"), ton: "fg" });
        if (kiFertig > 0 && wartetAufKi > 0) {
          s.push({ t: ` – bei ${fmtNum(kiFertig)} ist die KI-Analyse fertig, ` });
          s.push({ t: `${fmtNum(wartetAufKi)} ${wartetAufKi === 1 ? "wartet" : "warten"} noch auf die KI-Analyse`, ton: "violet" });
        } else if (wartetAufKi > 0) {
          s.push({ t: " – " }, { t: wartetAufKi === 1 ? "sie wartet noch auf die KI-Analyse" : "alle warten noch auf die KI-Analyse", ton: "violet" });
        } else {
          s.push({ t: " – " }, { t: "die KI hat bereits alle ausgewertet", ton: "violet" });
        }
        if (eeb > 0) s.push({ t: `, darunter ${eeb === 1 ? "eine Zustellung" : `${fmtNum(eeb)} Zustellungen`} gegen eEB`, s: `, darunter ${eeb === 1 ? "eine Zustellung" : `${eeb} Zustellungen`} gegen elektronisches Empfangsbekenntnis` });
        punkt(s);
      }
      briefing.push(s);
    }
    {
      const s: Satz = [];
      const t = termine[0];
      if (!t) {
        s.push({ t: meine ? "Für Sie stehen derzeit keine Termine im Kalender." : "Derzeit stehen keine Gerichts- oder Ortstermine im Kalender." });
      } else {
        const a = akten.get(t.akteId);
        s.push({ t: "Ihr nächster Termin: " });
        s.push({ t: t.titel, ton: "fg" });
        if (a) s.push({ t: " in " }, { t: a.aktenzeichen, ton: "ink", href: `/akten/${a.id}` });
        s.push({ t: ` ${diffDays(heute, t.datum) <= 1 ? tagLabel(t.datum, heute) : `am ${tagLabel(t.datum, heute)}`}`, s: ` am ${langDatum(t.datum)}` });
        if (t.uhrzeit) s.push({ t: ` um ${t.uhrzeit} Uhr` });
        if (t.ort) s.push({ t: ` – ${t.ort}` });
        punkt(s);
      }
      briefing.push(s);
    }

    return {
      heute, bisTag, wochenende: bisTag !== addDays(heute, 1), user, team: teamMap, akten,
      lage, bisWerktag, ueberfaellig, heuteFaellig, kritischWoche, woche, kritischste,
      posteingang, wartetAufKi, kiFertig, eeb, termine, wochenTage, handlungsbedarf,
      aktenMitFrist: aktenMitFristAnzahl, aktenNurPrio: handlungsbedarf.length - aktenMitFristAnzahl, motor, finanzen,
      kiAkte, kiAkteFrist, briefing,
    };
  }, [fristen, aktenArr, nachrichten, aktivitaeten, rechnungen, buchungen, transaktionen, ansicht, user, team, tenant.bundesland]);
}

export function euro(n: number) {
  return fmtEUR(n, { cents: false });
}

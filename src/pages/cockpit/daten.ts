// Cockpit: leitet aus den Kanzleidaten alles ab, was „Ihr Tag auf einen Blick" zeigt – inkl. KI-Tagesbriefing.
import { useMemo } from "react";
import { useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { addDays, diffDays, fmtDateShort, fmtEUR, fmtNum, today, wochentagName } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
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

export function sortiereFristen(a: Frist, b: Frist) {
  return a.datum.localeCompare(b.datum) || TYP_RANG[a.typ] - TYP_RANG[b.typ] || (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? "");
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
  faellig: Frist[]; // offen, ≤ nächster Werktag, ohne Termine
  ueberfaellig: number;
  heuteFaellig: number;
  notfristenWoche: Frist[]; // Notfristen der nächsten 7 Tage
  woche: Frist[]; // offen, heute < datum ≤ heute + 7
  kritischste?: Frist;
  posteingang: Nachricht[];
  wartetAufKi: number;
  kiFertig: number;
  eeb: number;
  termine: Frist[];
  wochenTage: { datum: string; fristen: number; termine: number; notfrist: boolean }[];
  handlungsbedarf: { akte: Akte; naechste?: Frist; gruende: { text: string; ton: "seal" | "amber" | "ink" | "violet" | "neutral" }[] }[];
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
    const in7 = addDays(heute, 7);
    const akten = new Map(aktenArr.map((a) => [a.id, a]));
    const teamMap = new Map(team.map((u) => [u.id, u]));
    const meine = ansicht === "meine";

    const offen = fristen.filter((f) => f.status === "offen" && (!meine || f.verantwortlichId === user.id));
    const ohneTermine = offen.filter((f) => f.typ !== "termin");
    const faellig = ohneTermine.filter((f) => f.datum <= bisTag).sort(sortiereFristen);
    const ueberfaellig = faellig.filter((f) => f.datum < heute).length;
    const heuteFaellig = faellig.filter((f) => f.datum === heute).length;
    const woche = ohneTermine.filter((f) => f.datum > heute && f.datum <= in7).sort(sortiereFristen);
    // bei gleichem Datum: Akten mit hoher Priorität zuerst
    const prio = (f: Frist) => (akten.get(f.akteId)?.prioritaet === "hoch" ? 0 : 1);
    const nachDringlichkeit = (a: Frist, b: Frist) => a.datum.localeCompare(b.datum) || TYP_RANG[a.typ] - TYP_RANG[b.typ] || prio(a) - prio(b);
    const notfristenWoche = ohneTermine.filter((f) => f.typ === "notfrist" && f.datum >= heute && f.datum <= in7).sort(nachDringlichkeit);
    const kritischste =
      ohneTermine.filter((f) => f.datum < heute).sort(nachDringlichkeit)[0] ??
      notfristenWoche[0] ??
      ohneTermine.filter((f) => f.typ === "frist" && f.datum >= heute && f.datum <= in7).sort(nachDringlichkeit)[0];

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
        fristen: tagF.filter((f) => f.typ !== "termin").length,
        termine: tagF.filter((f) => f.typ === "termin").length,
        notfrist: tagF.some((f) => f.typ === "notfrist"),
      });
      d = naechsterWerktag(d, land);
    }

    // Akten mit Handlungsbedarf
    const naechsteJeAkte = new Map<string, Frist>();
    for (const f of [...ohneTermine].sort(sortiereFristen)) if (!naechsteJeAkte.has(f.akteId)) naechsteJeAkte.set(f.akteId, f);
    const handlungsbedarf = aktenArr
      .filter((a) => a.status === "offen" && (!meine || a.bearbeiterId === user.id || a.sachbearbeiterId === user.id))
      .map((a) => {
        const n = naechsteJeAkte.get(a.id);
        const bald = n && n.datum <= in7 ? n : undefined;
        const gruende: CockpitDaten["handlungsbedarf"][number]["gruende"] = [];
        if (bald) {
          const tage = diffDays(heute, bald.datum);
          const wann = tage < 0 ? `seit ${-tage} T. überfällig` : tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
          gruende.push({ text: `${TYP_LABEL[bald.typ]} ${wann}`, ton: bald.typ === "notfrist" || tage <= 1 ? "seal" : "amber" });
        }
        if (a.prioritaet === "hoch") gruende.push({ text: "Hohe Priorität", ton: "ink" });
        return { akte: a, naechste: bald, gruende };
      })
      .filter((x) => x.gruende.length > 0)
      .sort((x, y) => {
        const nx = x.naechste?.typ === "notfrist" ? 0 : 1;
        const ny = y.naechste?.typ === "notfrist" ? 0 : 1;
        if (nx !== ny) return nx - ny;
        const dx = x.naechste?.datum ?? "9999";
        const dy = y.naechste?.datum ?? "9999";
        if (dx !== dy) return dx.localeCompare(dy);
        return (x.akte.prioritaet === "hoch" ? 0 : 1) - (y.akte.prioritaet === "hoch" ? 0 : 1);
      });

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
    const kiAkteFrist = kiAkte
      ? fristen.filter((f) => f.akteId === kiAkte.id && f.status === "offen" && f.typ !== "termin" && f.typ !== "vorfrist").sort((a, b) => TYP_RANG[a.typ] - TYP_RANG[b.typ] || a.datum.localeCompare(b.datum))[0]
      : undefined;

    // ── KI-Tagesbriefing: drei Sätze aus den Daten ──
    const briefing: Satz[] = [];
    const wer = meine ? "Für Sie" : "Heute";
    {
      const s: Satz = [];
      if (faellig.length === 0 && woche.length === 0) {
        s.push({ t: meine ? "Für Sie sind in den nächsten sieben Tagen keine Fristen notiert." : "In den nächsten sieben Tagen sind keine Fristen notiert." });
      } else {
        if (heuteFaellig + ueberfaellig > 0) {
          s.push({ t: `${wer} ${heuteFaellig + ueberfaellig === 1 ? "ist" : "sind"} ` });
          s.push({ t: plural(heuteFaellig + ueberfaellig, "Frist", "Fristen"), ton: "fg" });
          s.push({ t: meine ? " heute fällig" : " fällig" });
          if (ueberfaellig > 0) s.push({ t: ` (davon ${fmtNum(ueberfaellig)} überfällig)`, ton: "seal" });
        } else {
          s.push({ t: meine ? "Für Sie ist heute keine Frist fällig" : "Heute ist keine Frist fällig" });
        }
        if (woche.length > 0) {
          s.push({ t: ", in den nächsten sieben Tagen folgen " });
          s.push({ t: `${fmtNum(woche.length)} weitere`, ton: "fg" });
        }
        if (kritischste) {
          const a = akten.get(kritischste.akteId);
          const ueber = kritischste.datum < heute;
          s.push({ t: ueber ? " – sofort zu erledigen ist " : " – am dringendsten ist " });
          s.push({ t: `die ${TYP_LABEL[kritischste.typ]} „${kritischste.titel}“`, ton: kritischste.typ === "notfrist" || ueber ? "seal" : "amber" });
          if (a) s.push({ t: " in " }, { t: a.aktenzeichen, ton: "ink", href: `/akten/${a.id}?tab=fristen` });
          s.push({ t: ueber ? ` (fällig seit ${tagLabel(kritischste.datum, heute)})` : ` bis ${tagLabel(kritischste.datum, heute)}`, s: ueber ? undefined : ` bis ${langDatum(kritischste.datum)}` });
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
          s.push({ t: ` – ${fmtNum(kiFertig)} hat die KI bereits ausgewertet, ` });
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
      faellig, ueberfaellig, heuteFaellig, notfristenWoche, woche, kritischste,
      posteingang, wartetAufKi, kiFertig, eeb, termine, wochenTage, handlungsbedarf, motor, finanzen,
      kiAkte, kiAkteFrist, briefing,
    };
  }, [fristen, aktenArr, nachrichten, aktivitaeten, rechnungen, buchungen, transaktionen, ansicht, user, team, tenant.bundesland]);
}

export function euro(n: number) {
  return fmtEUR(n, { cents: false });
}

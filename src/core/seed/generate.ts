// Erzeugt einen vollständigen, in sich stimmigen Datenbestand für eine Kanzlei – relativ zum heutigen Datum.
import { AUTOMATION_DEFS, ausloesungAm, ersparnisMinuten } from "../automationen";
import { addDays, addMonthsBGB, diffDays, fmtDate, fmtEUR, round2, toLocalISO } from "../dates";
import { istWerktag } from "../feiertage";
import { berechneNachRegel, regel as fristRegel } from "../fristen";
import { berechneRvg, fassungFuerAuftrag, rvgRechnungsPositionen } from "../rvg";
import { istBerufstraeger } from "../vertretung";
import type {
  Akte, Aktivitaet, Automation, Dokument, Frist, Kontakt, KontaktRolle, Nachricht,
  Rechnung, Sachgebiet, Tenant, TenantData, Transaktion, User, Zeiteintrag,
} from "../types";
import { KAMMERN, stadtDatenFuer, type StadtDaten, type StadtKey, VORNAMEN_M, VORNAMEN_W, NACHNAMEN, BRANCHEN, HAUSVERWALTUNGEN, GEGNERANWAELTE, VERSICHERUNGEN, KFZ_VERSICHERER } from "./pools";
import { createRng, hashString, type Rng } from "./rng";
import { vorlagenFuer, type FallVorlage, type Parteien } from "./vorlagen";
import { heroesBerlin, heroesMuenchen, heroesHamburg, zusatzBerlin } from "./heroes";

/**
 * 10: ArbG-Präsentationsakte mit Gütetermin (T14) und drei weitere RSV-Akten am Ende, Portal-Freigaben, Freigabestatus,
 * Deckungsanfrage 142/26 als Brief-Entwurf, Zeuge „Seifert“, kein Gerichts-Az. in vorgerichtlichen Phasen.
 * 11: Fristverantwortung (Vorgabe der Projektleitung): Notfristen und Fristen tragen immer Berufsträger; „Fremdgeld an
 * Mandantin weiterleiten“ (131/26) ist eine Wiedervorlage von Mia Becker. 142/26: Herkunft der Schaden-Nr. (Notiz, Verlauf),
 * Deckungsanfrage mit Antragsbestandteilen (10.200 € + 3.400 € = 13.600 €).
 */
export const SEED_VERSION = 12;

export interface SeedInput {
  tenant: Tenant;
  users: User[];
  profil: { sachgebiete: [Sachgebiet, number][]; heroes: "berlin" | "muenchen" | "hamburg" | "none"; stadt: StadtKey };
}

export interface Ctx {
  rng: Rng;
  today: string;
  yy: string;
  tenant: Tenant;
  users: User[];
  anwaelte: User[];
  refas: User[];
  stadt: StadtKey;
  /** Orts- und Gerichtsdaten passend zur Stadt der Kanzlei */
  ort: StadtDaten;
  data: TenantData;
  usedAz: Set<number>;
  counters: Record<string, number>;
  d: (offset: number) => string;
  dt: (offset: number, hh?: number, mm?: number) => string;
  id: (prefix: string) => string;
  person: (rollen: KontaktRolle[], opts?: { weiblich?: boolean; vorname?: string; nachname?: string; email?: boolean }) => Kontakt;
  firma: (name: string, rollen: KontaktRolle[], extra?: Partial<Kontakt>) => Kontakt;
  gericht: (name: string) => Kontakt;
  werktag: (offset: number) => string;
}

function emptyData(): TenantData {
  return {
    kontakte: [], akten: [], fristen: [], dokumente: [], nachrichten: [], rechnungen: [],
    buchungen: [], transaktionen: [], zeiten: [], automationen: [], aktivitaeten: [], notizen: [], umzugLaeufe: [], meta: [],
  };
}

function slug(s: string) {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
}

const pad2 = (n: number) => String(n).padStart(2, "0");
function uhr(sek: number): string {
  return `${pad2(Math.floor(sek / 3600))}:${pad2(Math.floor(sek / 60) % 60)}:${pad2(sek % 60)}`;
}

/**
 * Bildet einen Zeitpunkt von heute auf „nicht in der Zukunft“ ab: Alles ab (jetzt − 45 Min.) wird gleichmäßig in das
 * Fenster [jetzt − 45 Min., jetzt − 1 Min.] gestaucht. Die Abbildung ist monoton – die Reihenfolge aller Ereignisse
 * des Tages bleibt unabhängig von der Uhrzeit erhalten – und verbraucht keinen Zufall.
 */
export function zeitBisJetzt(sek: number, jetzt: number | undefined): number {
  if (jetzt === undefined) return sek;
  const fenster = Math.min(45 * 60, Math.max(0, jetzt - 60));
  const start = jetzt - 60 - fenster;
  if (sek <= start) return sek;
  const anteil = (sek - start) / Math.max(1, 86399 - start);
  return Math.max(0, Math.min(jetzt - 60, Math.round(start + anteil * fenster)));
}

/**
 * „Jetzt“ je Kanzlei und Erzeugungstag einmal festhalten: Wird derselbe Bestand am selben Tag erneut erzeugt
 * (z. B. zwei Aufrufe kurz nacheinander), ist der Inhalt identisch – auch wenn dazwischen eine Sekunde vergeht.
 */
const JETZT_JE_TAG = new Map<string, number>();

export function createCtx(input: SeedInput, today: string): Ctx {
  // Aktuelle Uhrzeit nur, wenn für heute erzeugt wird (sonst keine Korrektur)
  const jetzt = typeof Date !== "undefined" ? new Date() : undefined;
  const schluessel = `${input.tenant.id}|${today}`;
  const sekundenJetzt = jetzt && toLocalISO(jetzt).slice(0, 10) === today
    ? (JETZT_JE_TAG.get(schluessel) ?? (JETZT_JE_TAG.set(schluessel, jetzt.getHours() * 3600 + jetzt.getMinutes() * 60 + jetzt.getSeconds()), JETZT_JE_TAG.get(schluessel)!))
    : undefined;
  const rng = createRng(hashString(input.tenant.id + "|apex"));
  const s = stadtDatenFuer(input.tenant.stadt, input.tenant.bundesland, input.profil.stadt);
  const data = emptyData();
  const counters: Record<string, number> = {};
  const gerichte = new Map<string, Kontakt>();
  const ctx: Ctx = {
    rng,
    today,
    yy: today.slice(2, 4),
    tenant: input.tenant,
    users: input.users,
    anwaelte: input.users.filter((u) => u.rolle === "partner" || u.rolle === "anwalt"),
    refas: input.users.filter((u) => u.rolle === "refa"),
    stadt: input.profil.stadt,
    ort: s,
    data,
    usedAz: new Set(),
    counters,
    d: (o) => addDays(today, o),
    dt: (o, hh = rng.int(8, 17), mm = rng.int(0, 59)) => {
      // Zeitpunkte von heute nie in der Zukunft erzeugen – ohne zusätzlichen Zufallszug, damit der Inhalt
      // nur von Datum und Kanzlei abhängt (nicht von Uhrzeit oder Zeitzone des ersten Logins).
      const sek = o === 0 ? zeitBisJetzt(hh * 3600 + mm * 60, sekundenJetzt) : hh * 3600 + mm * 60;
      return `${addDays(today, o)}T${uhr(sek)}`;
    },
    id: (prefix) => {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${counters[prefix]}`;
    },
    person: (rollen, opts = {}) => {
      const weiblich = opts.weiblich ?? rng.chance(0.5);
      const vorname = opts.vorname ?? rng.pick(weiblich ? VORNAMEN_W : VORNAMEN_M);
      const nachname = opts.nachname ?? rng.pick(NACHNAMEN);
      const k: Kontakt = {
        id: ctx.id("k"), typ: "person", name: `${vorname} ${nachname}`, vorname, nachname,
        anrede: weiblich ? "Frau" : "Herr",
        email: opts.email === false ? undefined : `${slug(vorname)}.${slug(nachname)}@${rng.pick(["web.de", "gmx.de", "t-online.de", "posteo.de", "mail.de"])}`,
        telefon: `+49 ${rng.pick(["151", "160", "170", "176", "157"])} ${rng.int(1000000, 9999999)}`,
        strasse: `${rng.pick(s.strassen)} ${rng.int(1, 140)}`, plz: rng.pick(s.plz), ort: s.ort,
        rollen, createdAt: ctx.dt(-rng.int(10, 300)),
      };
      data.kontakte.push(k);
      return k;
    },
    firma: (name, rollen, extra = {}) => {
      const existing = data.kontakte.find((k) => k.name === name);
      if (existing) {
        for (const r of rollen) if (!existing.rollen.includes(r)) existing.rollen.push(r);
        return existing;
      }
      const k: Kontakt = {
        id: ctx.id("k"), typ: "organisation", name, firma: name,
        email: `info@${slug(name.replace(/^((Dr|Prof)\.\s+)+/, "").split(" ")[0])}.de`,
        telefon: `+49 ${s.vorwahl.slice(1)} ${rng.int(100000, 9999999)}`,
        strasse: `${rng.pick(s.strassen)} ${rng.int(1, 140)}`, plz: rng.pick(s.plz), ort: s.ort,
        rollen, createdAt: ctx.dt(-rng.int(30, 400)), ...extra,
      };
      data.kontakte.push(k);
      return k;
    },
    gericht: (name) => {
      const hit = gerichte.get(name);
      if (hit) return hit;
      const k = ctx.firma(name, ["gericht"], { email: undefined, safeId: `DE.Justiz.${rng.int(10000000, 99999999)}.${rng.int(1000, 9999)}` });
      gerichte.set(name, k);
      return k;
    },
    werktag: (o) => {
      let dd = addDays(today, o);
      let guard = 0;
      while (!istWerktag(dd, input.tenant.bundesland) && guard++ < 7) dd = addDays(dd, o >= 0 ? 1 : -1);
      return dd;
    },
  };
  return ctx;
}

/**
 * Verantwortliche einer Frist in den Demodaten: Notfristen und Fristen tragen immer eine Anwältin, einen Anwalt bzw. Partner
 * (Vorgabe der Projektleitung). Ist eine Fachangestellte oder Auszubildende eingetragen, übernimmt die Bearbeiterin bzw. der
 * Bearbeiter der Akte, sonst der erste Berufsträger. Wiedervorlagen, Vorfristen und Termine dürfen Fachangestellten gehören.
 */
export function fristVerantwortung(ctx: Pick<Ctx, "users" | "anwaelte" | "data">, f: Pick<Frist, "typ" | "akteId" | "verantwortlichId">): string {
  if (f.typ !== "frist" && f.typ !== "notfrist") return f.verantwortlichId;
  const person = ctx.users.find((u) => u.id === f.verantwortlichId);
  if (person && istBerufstraeger(person)) return f.verantwortlichId;
  const bearbeiter = ctx.data.akten.find((a) => a.id === f.akteId)?.bearbeiterId;
  const ra = ctx.users.find((u) => u.id === bearbeiter && istBerufstraeger(u)) ?? ctx.anwaelte[0];
  return ra?.id ?? f.verantwortlichId;
}

/** Fügt eine Frist hinzu (mit Rechenweg, falls Regel). */
export function addFrist(ctx: Ctx, f: Partial<Frist> & { akteId: string; titel: string; datum: string }): Frist {
  const frist: Frist = {
    id: ctx.id("f"),
    typ: "frist",
    status: "offen",
    verantwortlichId: ctx.anwaelte[0]?.id ?? ctx.users[0].id,
    quelle: "manuell",
    createdAt: ctx.dt(-ctx.rng.int(1, 20)),
    ...f,
  };
  frist.verantwortlichId = fristVerantwortung(ctx, frist);
  ctx.data.fristen.push(frist);
  return frist;
}

export function addRegelFrist(ctx: Ctx, akte: Akte, key: string, ereignis: string, extra: Partial<Frist> = {}): Frist {
  const r = berechneNachRegel(key, ereignis, ctx.tenant.bundesland);
  const frist = addFrist(ctx, {
    akteId: akte.id,
    titel: r.regel.titel,
    typ: r.regel.typ,
    datum: r.ende,
    vorfrist: r.vorfrist,
    regelKey: key,
    grundlage: r.regel.grundlage,
    ereignisDatum: ereignis,
    rechenweg: r.rechenweg,
    verantwortlichId: akte.bearbeiterId,
    ...extra,
  });
  // Vorfrist als eigener Kalendereintrag
  if (r.vorfrist >= ctx.today || frist.status === "erledigt") {
    addFrist(ctx, {
      akteId: akte.id, titel: `Vorfrist: ${r.regel.titel}`, typ: "vorfrist", datum: r.vorfrist, bezugId: frist.id,
      verantwortlichId: akte.sachbearbeiterId ?? akte.bearbeiterId, quelle: "automatisch", status: frist.status,
    });
  }
  return frist;
}

export function addDok(ctx: Ctx, d: Partial<Dokument> & { akteId: string; name: string; inhalt: string }): Dokument {
  const dok: Dokument = {
    id: ctx.id("d"),
    art: "brief",
    ordner: "Korrespondenz",
    format: "pdf",
    groesseKb: ctx.rng.int(38, 920),
    seiten: ctx.rng.int(1, 9),
    quelle: "upload",
    version: 1,
    createdAt: ctx.dt(-ctx.rng.int(1, 30)),
    ...d,
  };
  ctx.data.dokumente.push(dok);
  return dok;
}

export function addMsg(ctx: Ctx, n: Partial<Nachricht> & { von: string; betreff: string; text: string; eingang: string }): Nachricht {
  const m: Nachricht = {
    id: ctx.id("n"),
    kanal: "email",
    richtung: "ein",
    an: ctx.tenant.kurzname,
    anhaenge: [],
    status: "gelesen",
    zugeordnet: !!n.akteId,
    ...n,
  };
  ctx.data.nachrichten.push(m);
  return m;
}

export function nextAz(ctx: Ctx, wunsch?: number): string {
  let n = wunsch ?? 101;
  while (ctx.usedAz.has(n)) n++;
  ctx.usedAz.add(n);
  return `${n}/${ctx.yy}`;
}

let rechnungsNr = 0;
export function addRechnung(ctx: Ctx, akte: Akte, opts: { positionen?: string[]; datumOffset: number; status?: Rechnung["status"]; stunden?: number }): Rechnung | undefined {
  const datum = ctx.d(opts.datumOffset);
  let r: Rechnung;
  rechnungsNr++;
  const nummer = `RE-20${ctx.yy}-${String(ctx.counters["re"] = (ctx.counters["re"] ?? 0) + 1).padStart(4, "0")}`;
  if (opts.stunden) {
    const satz = ctx.users.find((u) => u.id === akte.bearbeiterId)?.stundensatz ?? 250;
    // Abrechnung nach Stunden setzt eine Vergütungsvereinbarung in Textform voraus (§ 3a Abs. 1 RVG) – an der Akte vermerkt
    akte.verguetungsvereinbarung ??= { datum: akte.createdAt.slice(0, 10), stundensatz: satz, erfasstVon: akte.bearbeiterId };
    const netto = round2(opts.stunden * satz);
    const ust = round2(netto * 0.19);
    r = {
      id: ctx.id("r"), nummer, akteId: akte.id, empfaengerId: akte.mandantId, datum, faellig: addDays(datum, 14),
      positionen: [{ vv: "Std", bezeichnung: "Tätigkeit lt. Vergütungsvereinbarung", menge: opts.stunden, betrag: netto }],
      netto, ust, brutto: round2(netto + ust), status: "gestellt", bezahlt: 0, format: "PDF", createdAt: `${datum}T10:00:00`,
    };
  } else {
    const pos = opts.positionen ?? [];
    if (!pos.length || akte.gegenstandswert <= 0) return undefined;
    const calc = berechneRvg({ positionen: pos.map((nr) => ({ nr })), gegenstandswert: akte.gegenstandswert, fassung: fassungFuerAuftrag(akte.createdAt.slice(0, 10)) });
    // E-Rechnung (XRechnung) nur an Unternehmen – Verbraucher erhalten eine PDF-Rechnung
    const eRechnung = ctx.rng.chance(0.3) && ctx.data.kontakte.find((k) => k.id === akte.mandantId)?.typ === "organisation";
    r = {
      id: ctx.id("r"), nummer, akteId: akte.id, empfaengerId: akte.rsv?.deckung === "erteilt" ? akte.mandantId : akte.mandantId,
      datum, faellig: addDays(datum, 14),
      positionen: rvgRechnungsPositionen(calc.angelegenheiten),
      netto: calc.netto, ust: calc.ust, brutto: calc.brutto, status: "gestellt", bezahlt: 0,
      format: eRechnung ? "XRechnung" : "PDF", createdAt: `${datum}T10:00:00`,
    };
  }
  const age = -opts.datumOffset;
  const status = opts.status ?? (age > 40 ? (ctx.rng.chance(0.85) ? "bezahlt" : "gestellt") : age > 14 ? (ctx.rng.chance(0.55) ? "bezahlt" : ctx.rng.chance(0.3) ? "teilbezahlt" : "gestellt") : "gestellt");
  r.status = status;
  ctx.data.buchungen.push({ id: ctx.id("b"), akteId: akte.id, datum, art: "honorar", betrag: r.brutto, text: `Rechnung ${r.nummer}`, rechnungId: r.id });
  if (status === "bezahlt") {
    r.bezahlt = r.brutto;
    r.bezahltAm = addDays(datum, ctx.rng.int(4, Math.max(5, Math.min(age, 30))));
    ctx.data.buchungen.push({ id: ctx.id("b"), akteId: akte.id, datum: r.bezahltAm, art: "zahlung", betrag: -r.brutto, text: `Zahlungseingang ${r.nummer}`, rechnungId: r.id });
  } else if (status === "teilbezahlt") {
    r.bezahlt = round2(Math.floor(r.brutto / 2 / 50) * 50 || r.brutto / 2);
    r.bezahltAm = addDays(datum, ctx.rng.int(4, 12));
    ctx.data.buchungen.push({ id: ctx.id("b"), akteId: akte.id, datum: r.bezahltAm, art: "zahlung", betrag: -r.bezahlt, text: `Teilzahlung ${r.nummer}`, rechnungId: r.id });
  } else if (status === "entwurf") {
    ctx.data.buchungen.pop();
  }
  ctx.data.rechnungen.push(r);
  return r;
}

function pickWeighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rng.next() * total;
  for (const [it, w] of items) {
    x -= w;
    if (x <= 0) return it;
  }
  return items[0][0];
}

function gegnerFuer(ctx: Ctx, v: FallVorlage): Kontakt | undefined {
  const { rng } = ctx;
  switch (v.gegner) {
    case "firma":
      return ctx.firma(`${rng.pick(NACHNAMEN)} ${rng.pick(BRANCHEN)}`, ["gegner"]);
    case "hausverwaltung":
      return ctx.firma(rng.pick(HAUSVERWALTUNGEN), ["gegner"]);
    case "kfzversicherer":
      return ctx.firma(rng.pick(KFZ_VERSICHERER), ["gegner", "versicherung"]);
    case "person":
      return ctx.person(["gegner"], { email: rng.chance(0.4) });
    case "behoerde":
      return ctx.firma(v.sachgebiet === "Verkehrsrecht" ? ctx.ort.gerichte.bussgeld : ctx.ort.gerichte.sta, ["behoerde"]);
    default:
      return undefined;
  }
}

function generischeAkte(ctx: Ctx, sachgebiet: Sachgebiet, azNummer: number) {
  const { rng, data } = ctx;
  const vorlagen = vorlagenFuer(sachgebiet);
  if (!vorlagen.length) return;
  const v = rng.pick(vorlagen);
  const stadt = ctx.ort;
  const mandantFirma = v.sachgebiet === "Forderungseinzug" || (v.key === "br-werklohn") || (v.key === "vt-pruefung");
  const mandant = mandantFirma
    ? ctx.firma(`${rng.pick(NACHNAMEN)} ${rng.pick(BRANCHEN)}`, ["mandant"])
    : ctx.person(["mandant"]);
  const gegner = gegnerFuer(ctx, v);
  const wert = v.wert[0] === v.wert[1] ? v.wert[0] : Math.round(rng.int(v.wert[0], v.wert[1]) / 50) * 50;
  // Sachliche Zuständigkeit (§ 23 Nr. 1 GVG): Amtsgericht bis einschließlich 10.000 € (seit 01.01.2026, vorher 5.000 €), darüber Landgericht
  const agGrenze = ctx.today >= "2026-01-01" ? 10000 : 5000;
  const gerichtArt = v.gericht === "lg" && wert <= agGrenze ? "ag" : v.gericht;
  const gerichtName = gerichtArt ? (gerichtArt === "ag" ? rng.pick(stadt.gerichte.ag) : stadt.gerichte[gerichtArt]) : undefined;
  const gericht = gerichtName && gerichtArt !== "sta" ? ctx.gericht(gerichtName) : undefined;
  const az = nextAz(ctx, azNummer);
  const yearStart = `20${ctx.yy}-01-05`;
  const span = Math.max(30, diffDays(yearStart, ctx.today) - 4);
  const createdOffset = Math.min(-3, diffDays(ctx.today, addDays(yearStart, Math.round(((azNummer - 101) / 60) * span))));
  const statusRoll = rng.next();
  const status: Akte["status"] = createdOffset < -150 && statusRoll < 0.35 ? "abgeschlossen" : statusRoll < 0.08 ? "ruhend" : "offen";
  const phase = status === "abgeschlossen" ? "Abgeschlossen" : rng.pick(v.phasen);
  const bearbeiter = rng.pick(ctx.anwaelte);
  const p: Parteien = {
    M: mandant.name,
    MA: mandant.typ === "person" ? `${mandant.anrede} ${mandant.nachname}` : mandant.name,
    G: gegner?.name ?? "",
    GER: gerichtName ?? "",
    ORT: stadt.ort,
    J: rng.int(4, 22),
    BETRAG: fmtEUR(Math.round(wert * (0.6 + rng.next() * 0.4))),
    DATUM: fmtDate(ctx.d(createdOffset + rng.int(0, 6))),
    AZ: "",
  };
  // Kammer- und Abteilungsnummern nach Gerichtsgröße: ArbG Paderborn 1–4 Ca, AG Paderborn 1–20 C und 1–8 F; Großstädte wie bisher
  const k = KAMMERN[stadt.groesse ?? "gross"];
  const nr = (r: [number, number]) => rng.int(r[0], r[1]);
  const gerichtsAzGezogen = gericht
    ? gerichtArt === "arbg" ? `${nr(k.arbg)} Ca ${rng.int(1000, 9999)}/${ctx.yy}`
      : gerichtArt === "fam" ? `${nr(k.fam)} F ${rng.int(100, 999)}/${ctx.yy}`
      : gerichtArt === "mahn" ? `${ctx.yy}-${rng.int(1000000, 9999999)}-0-${rng.int(1, 9)}`
      : gerichtArt === "lg" ? `${nr(k.lg)} O ${rng.int(100, 480)}/${ctx.yy}`
      : gerichtArt === "straf" ? `${nr(k.straf)} Cs ${rng.int(100, 999)}/${ctx.yy}`
      : `${nr(k.ag)} C ${rng.int(100, 999)}/${ctx.yy}`
    : gerichtArt === "sta" ? `${nr(k.sta)} Js ${rng.int(1000, 9999)}/${ctx.yy}` : undefined;
  // Vorgerichtliche Phasen haben (noch) kein gerichtliches Aktenzeichen – der Wert wird trotzdem gezogen, damit die Zufallsfolge
  // und damit der übrige Demobestand unverändert bleiben (I2-T23-05). Die Phase bleibt, sie steuert die Gebühren der Sammelabrechnung.
  const gerichtsAz = phase === "Mandatsaufnahme" || phase === "Außergerichtlich" ? undefined : gerichtsAzGezogen;
  p.AZ = gerichtsAz ?? "";
  const akte: Akte = {
    id: ctx.id("a"),
    aktenzeichen: az,
    titel: v.titel(p),
    sachgebiet: v.sachgebiet,
    phase,
    status,
    mandantId: mandant.id,
    gegnerId: gegner?.id,
    gegneranwaltId: gegner && v.gegner !== "behoerde" && rng.chance(0.45) ? ctx.firma(rng.pick(GEGNERANWAELTE), ["gegneranwalt"]).id : undefined,
    gerichtId: gericht?.id,
    gerichtsAz,
    gegenstandswert: wert,
    bearbeiterId: bearbeiter.id,
    sachbearbeiterId: ctx.refas[0]?.id,
    rsv: v.rsv && rng.chance(0.6)
      ? { versicherung: rng.pick(VERSICHERUNGEN), versicherungsnummer: `RS-${rng.int(1000000, 9999999)}`, schadennummer: `S${ctx.yy}-${rng.int(10000, 99999)}`, deckung: rng.chance(0.75) ? "erteilt" : "angefragt", selbstbeteiligung: rng.pick([0, 150, 250]) }
      : undefined,
    beschreibung: v.beschreibung(p),
    schlagworte: v.schlagworte,
    prioritaet: rng.chance(0.18) ? "hoch" : rng.chance(0.2) ? "niedrig" : "normal",
    createdAt: ctx.dt(createdOffset, 9, rng.int(0, 59)),
    updatedAt: ctx.dt(Math.max(createdOffset, -rng.int(0, 12))),
    abgeschlossenAm: status === "abgeschlossen" ? ctx.d(rng.int(-40, -5)) : undefined,
    mandantenportal: rng.chance(0.55),
  };
  if (v.forderung) {
    akte.forderung = {
      hauptforderung: Math.round(wert * 0.92 * 100) / 100,
      faelligAb: ctx.d(createdOffset - rng.int(20, 60)),
      verbraucher: mandant.typ === "person" ? true : gegner?.typ === "person",
      schuldnerId: gegner?.id,
    };
  }
  data.akten.push(akte);

  // Dokumente
  const vollmacht = addDok(ctx, { akteId: akte.id, name: "Vollmacht", art: "vollmacht", ordner: "Mandant", quelle: "generiert", format: "pdf", inhalt: `Vollmacht: ${mandant.name} bevollmächtigt ${ctx.tenant.name} in der Sache ${akte.titel}.`, createdAt: ctx.dt(createdOffset + 1) });
  // Mandantenportal: eigene, für den Mandanten bestimmte Schreiben ausdrücklich freigeben (ohne Zufallszug)
  if (akte.mandantenportal) vollmacht.portal = { am: vollmacht.createdAt, vonId: bearbeiter.id };
  for (const dv of v.dokumente) {
    addDok(ctx, {
      akteId: akte.id, name: dv.name, art: dv.art, ordner: dv.ordner,
      format: dv.art === "schriftsatz" ? "docx" : "pdf",
      quelle: dv.art === "schriftsatz" ? "generiert" : dv.ordner === "Gericht" ? "bea" : rng.pick(["upload", "scan", "email"] as const),
      inhalt: dv.text(p),
      autorId: dv.art === "schriftsatz" ? bearbeiter.id : undefined,
      createdAt: ctx.dt(Math.min(-1, createdOffset + rng.int(1, 20))),
    });
  }

  // Fristen
  if (status === "offen") {
    for (const fv of v.fristen) {
      const ziel = rng.int(fv.offset[0], fv.offset[1]);
      if (fv.regel) {
        const r = fristRegel(fv.regel);
        if (!r) continue;
        let ereignis = r.einheit === "monate" ? addMonthsBGB(ctx.d(ziel), -r.dauer).date : addDays(ctx.d(ziel), -(r.einheit === "wochen" ? r.dauer * 7 : r.dauer));
        if (ereignis >= ctx.today) ereignis = ctx.d(-1);
        addRegelFrist(ctx, akte, fv.regel, ereignis, { quelle: rng.chance(0.6) ? "ki" : "manuell", kontrolliertVon: rng.chance(0.7) ? ctx.refas[0]?.id : undefined });
      } else {
        const datum = ctx.werktag(ziel);
        addFrist(ctx, {
          akteId: akte.id, titel: fv.titel ?? "Wiedervorlage", typ: fv.typ ?? "wiedervorlage", datum,
          uhrzeit: fv.typ === "termin" ? `${rng.pick(["09", "10", "11", "13", "14"])}:${rng.pick(["00", "30"])}` : undefined,
          ort: fv.typ === "termin" ? gerichtName ?? ctx.tenant.adresse : undefined,
          verantwortlichId: fv.typ === "wiedervorlage" ? akte.sachbearbeiterId ?? bearbeiter.id : bearbeiter.id,
          quelle: rng.chance(0.4) ? "automatisch" : "manuell",
        });
      }
    }
    if (rng.chance(0.5)) {
      addFrist(ctx, {
        akteId: akte.id, titel: rng.pick(["Sachstandsanfrage Gegenseite", "Rücksprache Mandant", "Zahlungseingang prüfen", "Akte vorlegen"]),
        typ: "wiedervorlage", datum: ctx.werktag(rng.int(1, 30)), verantwortlichId: akte.sachbearbeiterId ?? bearbeiter.id, quelle: "automatisch",
      });
    }
  }
  // erledigte Fristen aus der Vergangenheit
  if (rng.chance(0.6)) {
    addFrist(ctx, {
      akteId: akte.id, titel: rng.pick(["Stellungnahme an Gegenseite", "Unterlagen vom Mandanten", "Frist zur Zahlung", "Antwort Versicherung"]),
      typ: rng.chance(0.5) ? "frist" : "wiedervorlage", datum: ctx.werktag(-rng.int(3, 60)), status: "erledigt",
      erledigtAm: ctx.dt(-rng.int(1, 3)), erledigtVon: bearbeiter.id, verantwortlichId: bearbeiter.id,
    });
  }

  // Abrechnung
  if (v.rvg.length && phase !== "Mandatsaufnahme" && rng.chance(0.75)) {
    const pos: string[] = phase === "Außergerichtlich" ? (v.rvg.includes("2300") ? ["2300"] : v.rvg.slice(0, 1)) : v.rvg;
    addRechnung(ctx, akte, { positionen: pos, datumOffset: Math.min(-2, createdOffset + rng.int(15, 60)) });
  } else if (v.sachgebiet === "Strafrecht" && rng.chance(0.7)) {
    addRechnung(ctx, akte, { stunden: rng.int(3, 14) + rng.pick([0, 0.5]), datumOffset: Math.min(-2, createdOffset + rng.int(10, 40)) });
  }
  if (rng.chance(0.3) && status === "offen") {
    const vb = Math.round(rng.int(300, 1500) / 50) * 50;
    data.buchungen.push({ id: ctx.id("b"), akteId: akte.id, datum: ctx.d(createdOffset + 2), art: "vorschuss", betrag: -vb, text: "Vorschuss nach § 9 RVG (bezahlt)" });
  }
}

/**
 * Rechnungsnummern fortlaufend nach Rechnungsdatum (§ 14 Abs. 4 Nr. 4 UStG): Die Rechnungen entstehen beim Erzeugen
 * akteweise, nicht chronologisch – deshalb werden sie zum Schluss je Jahr nach Datum durchnummeriert. Buchungstexte
 * („Rechnung RE-…“, „Zahlungseingang RE-…“) ziehen mit.
 */
export function nummeriereRechnungen(data: TenantData): void {
  const reihenfolge = data.rechnungen.map((r, i) => ({ r, i })).sort((a, b) => a.r.datum.localeCompare(b.r.datum) || a.r.createdAt.localeCompare(b.r.createdAt) || a.i - b.i);
  const zaehler: Record<string, number> = {};
  const neu = new Map<string, string>();
  for (const { r } of reihenfolge) {
    const jahr = r.datum.slice(0, 4);
    zaehler[jahr] = (zaehler[jahr] ?? 0) + 1;
    const nummer = `RE-${jahr}-${String(zaehler[jahr]).padStart(4, "0")}`;
    if (nummer !== r.nummer) neu.set(r.id, nummer);
  }
  if (!neu.size) return;
  const alt = new Map(data.rechnungen.map((r) => [r.id, r.nummer]));
  for (const r of data.rechnungen) r.nummer = neu.get(r.id) ?? r.nummer;
  for (const b of data.buchungen) {
    const n = b.rechnungId ? neu.get(b.rechnungId) : undefined;
    if (n) b.text = b.text.replace(alt.get(b.rechnungId!)!, n);
  }
}

function generischerPosteingang(ctx: Ctx) {
  const { rng, data } = ctx;
  const offene = data.akten.filter((a) => a.status === "offen" && !a.id.startsWith("hero"));
  const pick = rng.shuffle(offene).slice(0, 7);
  pick.forEach((a, i) => {
    const mandant = data.kontakte.find((k) => k.id === a.mandantId)!;
    const gericht = a.gerichtId ? data.kontakte.find((k) => k.id === a.gerichtId) : undefined;
    const variant = i % 4;
    if (variant === 0) {
      addMsg(ctx, {
        kanal: "email", von: mandant.name, vonAdresse: mandant.email, betreff: `Frage zum Stand – Az. ${a.aktenzeichen}`,
        text: `Guten Tag,\n\nich wollte mich erkundigen, ob es in meiner Sache (${a.titel}) Neuigkeiten gibt. Muss ich noch etwas unternehmen?\n\nViele Grüße\n${mandant.name}`,
        eingang: ctx.dt(-rng.int(0, 3)), akteId: a.id, status: rng.chance(0.5) ? "neu" : "gelesen", kiStatus: "analysiert",
        ki: { akteId: a.id, sicherheit: 0.98, zusammenfassung: "Sachstandsanfrage des Mandanten. Kein fristrelevanter Inhalt.", aktion: "Mandanten-Update mit aktuellem Stand senden (Entwurf liegt bereit)." },
      });
    } else if (variant === 1 && gericht) {
      // Ohne Gerichts-Az. (vorgerichtliche Phase): Eingangsbestätigung statt Terminsverfügung – gleiche Zufallszüge wie bisher
      const ohneAz = !a.gerichtsAz;
      addMsg(ctx, {
        kanal: "bea", von: gericht.name, betreff: ohneAz ? `${a.titel} – Eingangsbestätigung` : `${a.gerichtsAz} – Verfügung`,
        text: ohneAz
          ? `In Sachen ${a.titel} wird der Eingang Ihres Schreibens bestätigt. Ein gerichtliches Verfahren ist bislang nicht anhängig; ein Aktenzeichen wird erst mit Eingang einer Klage bzw. eines Antrags vergeben.`
          : `In Sachen ${a.titel} (Az. ${a.gerichtsAz}) wird mitgeteilt, dass der Termin zur mündlichen Verhandlung vom Vorsitzenden aufrechterhalten bleibt. Den Parteien wird aufgegeben, etwaige weitere Unterlagen bis spätestens eine Woche vor dem Termin einzureichen.`,
        eingang: ctx.dt(-rng.int(1, 5)), akteId: a.id, status: "gelesen", kiStatus: "uebernommen", zugeordnet: true,
        anhaenge: [{ name: ohneAz ? "Eingangsbestaetigung.pdf" : "Verfuegung.pdf", groesseKb: rng.int(40, 180) }],
        ki: ohneAz
          ? { akteId: a.id, sicherheit: 0.99, zusammenfassung: "Eingangsbestätigung des Gerichts – kein fristrelevanter Inhalt.", aktion: "Zur Akte genommen – keine Frist." }
          : { akteId: a.id, sicherheit: 0.99, zusammenfassung: "Gerichtliche Verfügung: Termin bleibt bestehen, Unterlagen bis eine Woche vor Termin.", aktion: "Wiedervorlage eine Woche vor Termin gesetzt." },
      });
    } else if (variant === 2) {
      const ga = a.gegneranwaltId ? data.kontakte.find((k) => k.id === a.gegneranwaltId) : a.gegnerId ? data.kontakte.find((k) => k.id === a.gegnerId) : undefined;
      if (!ga) return;
      addMsg(ctx, {
        kanal: ga.rollen.includes("gegneranwalt") ? "bea" : "email", von: ga.name, vonAdresse: ga.email, betreff: `${a.titel} – Ihr Schreiben`,
        text: `Sehr geehrte Kolleginnen und Kollegen,\n\nin vorbezeichneter Angelegenheit nehmen wir Bezug auf Ihr Schreiben. Unsere Mandantschaft weist die geltend gemachten Ansprüche zurück. Zur Vermeidung eines Rechtsstreits wären wir jedoch zu Gesprächen über eine vergleichsweise Regelung bereit.\n\nMit freundlichen kollegialen Grüßen`,
        eingang: ctx.dt(-rng.int(0, 4)), akteId: a.id, status: rng.chance(0.5) ? "neu" : "gelesen", kiStatus: "analysiert",
        ki: { akteId: a.id, sicherheit: 0.95, zusammenfassung: "Gegenseite weist Ansprüche zurück, signalisiert aber Vergleichsbereitschaft.", aktion: "Mandanten informieren und Vergleichsrahmen abstimmen." },
      });
    } else {
      addMsg(ctx, {
        kanal: "email", von: mandant.name, vonAdresse: mandant.email, betreff: `Unterlagen zu ${a.aktenzeichen}`,
        text: `Hallo,\n\nanbei die angeforderten Unterlagen als PDF. Bitte geben Sie kurz Bescheid, ob noch etwas fehlt.\n\nBeste Grüße\n${mandant.name}`,
        eingang: ctx.dt(-rng.int(1, 6)), akteId: a.id, status: "gelesen", kiStatus: "uebernommen",
        anhaenge: [{ name: "Unterlagen.pdf", groesseKb: rng.int(200, 2400) }],
        ki: { akteId: a.id, sicherheit: 0.97, zusammenfassung: "Mandant übersendet angeforderte Unterlagen.", aktion: "Anhänge in E-Akte (Ordner Mandant) abgelegt." },
      });
    }
  });
  addMsg(ctx, {
    kanal: "email", von: "Rechtsanwaltskammer – Kammerreport", vonAdresse: "kammerreport@rak-mitgliederservice.de", betreff: "Kammerreport: Neuerungen zum beA und zur E-Rechnung",
    text: "Liebe Kammermitglieder, in dieser Ausgabe: Neuerungen beim beA, Pflicht zum Empfang von E-Rechnungen, Fortbildungsangebote im Herbst.",
    eingang: ctx.dt(-2, 7, 30), status: "gelesen", kiStatus: "analysiert", zugeordnet: false,
    ki: { sicherheit: 0.99, zusammenfassung: "Newsletter der Rechtsanwaltskammer mit allgemeinen Informationen – keiner Akte zuzuordnen.", aktion: "Kein Handlungsbedarf – als erledigt markieren." },
  });
}

function bankUmsaetze(ctx: Ctx) {
  const { rng, data } = ctx;
  const offen = data.rechnungen.filter((r) => r.status === "gestellt" || r.status === "teilbezahlt");
  const auswahl = rng.shuffle(offen).slice(0, 7);
  auswahl.forEach((r, i) => {
    const akte = data.akten.find((a) => a.id === r.akteId)!;
    const zahler = data.kontakte.find((k) => k.id === r.empfaengerId)!;
    const rest = round2(r.brutto - r.bezahlt);
    const mode = i % 3;
    const t: Transaktion = {
      id: ctx.id("t"),
      datum: ctx.d(-rng.int(0, 3)),
      betrag: rest,
      gegenpartei: zahler.name.toUpperCase(),
      iban: `DE${rng.int(10, 99)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)} ${rng.int(10, 99)}`,
      verwendungszweck: mode === 0 ? `${r.nummer} AZ ${akte.aktenzeichen}` : mode === 1 ? `Rechnung vom ${fmtDate(r.datum)} ${zahler.nachname ?? ""}`.trim() : `Honorar ${akte.titel.split(" ./. ")[0]}`,
      status: "offen",
      // Honorare und Mandantenzahlungen gehen auf das Geschäftskonto der Kanzlei (I4-T08-01)
      konto: "geschaeft",
    };
    data.transaktionen.push(t);
  });
  // Versicherungszahlung (Fremdgeld): Ein Kfz-Haftpflichtversicherer reguliert für die Mandantschaft auf das Anderkonto –
  // erkennbar an Aktenzeichen und Schadennummer. Ohne Zufallszug, damit der übrige Demobestand unverändert bleibt.
  // Konto je Umsatz (SEED_VERSION 12, I4-T08-01): Regulierungen für die Mandantschaft „ander“, alles Übrige „geschaeft“.
  const fremdAkte = data.akten.find(
    (a) => a.status === "offen" && a.gegenstandswert > 0 && !!a.gegnerId && data.kontakte.find((k) => k.id === a.gegnerId)?.rollen.includes("versicherung") && !data.buchungen.some((b) => b.akteId === a.id && b.fremdgeld),
  );
  if (fremdAkte) {
    const versicherer = data.kontakte.find((k) => k.id === fremdAkte.gegnerId)!;
    const nr = fremdAkte.aktenzeichen.replace(/\D/g, "");
    data.transaktionen.push({
      id: ctx.id("t"), datum: ctx.d(-1), betrag: Math.max(500, Math.round((fremdAkte.gegenstandswert * 0.6) / 10) * 10), gegenpartei: versicherer.name.toUpperCase(),
      iban: "DE02 1203 0000 0000 2020 51", verwendungszweck: `Schaden-Nr. KH-${ctx.yy}-${nr.padStart(6, "0")} / Ihr Az. ${fremdAkte.aktenzeichen} – Regulierung Fahrzeugschaden`, status: "offen",
      konto: "ander",
    });
  }
  // Sonstige Umsätze
  data.transaktionen.push(
    { id: ctx.id("t"), datum: ctx.d(-1), betrag: -2450, gegenpartei: "Bürohaus Verwaltung GmbH", iban: "DE44 1001 0010 0123 4567 89", verwendungszweck: `Miete Kanzleiräume ${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][Number(ctx.today.slice(5, 7)) - 1]}`, status: "offen", konto: "geschaeft" },
    { id: ctx.id("t"), datum: ctx.d(-2), betrag: -189.9, gegenpartei: "Telekommunikation AG", iban: "DE12 3004 0000 0123 4567 00", verwendungszweck: "Kundennr. 4711-0815 Rechnung", status: "offen", konto: "geschaeft" },
  );
  // bereits zugeordnete historische Umsätze
  data.rechnungen.filter((r) => r.status === "bezahlt").slice(0, 6).forEach((r) => {
    const akte = data.akten.find((a) => a.id === r.akteId)!;
    const zahler = data.kontakte.find((k) => k.id === r.empfaengerId)!;
    data.transaktionen.push({
      id: ctx.id("t"), datum: r.bezahltAm ?? r.datum, betrag: r.brutto, gegenpartei: zahler.name.toUpperCase(),
      iban: `DE${rng.int(10, 99)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)} ${rng.int(1000, 9999)} ${rng.int(10, 99)}`,
      verwendungszweck: `${r.nummer} ${akte.aktenzeichen}`, status: "zugeordnet",
      zuordnung: { rechnungId: r.id, akteId: akte.id, sicherheit: 0.99, durch: "auto", grund: "Rechnungsnummer im Verwendungszweck" },
      konto: "geschaeft",
    });
  });
}

function zeiten(ctx: Ctx) {
  const { rng, data } = ctx;
  const offene = data.akten.filter((a) => a.status === "offen");
  const taetigkeiten = ["Telefonat mit Mandant", "Aktenstudium", "Entwurf Schriftsatz", "Recherche Rechtsprechung", "Besprechung", "Korrespondenz Gegenseite", "Terminvorbereitung", "Prüfung Vergleichsangebot"];
  for (let i = 0; i < 46; i++) {
    const a = rng.pick(offene);
    const u = rng.pick(ctx.anwaelte);
    // Erfasste Zeiten liegen nie in der Zukunft: Fällt „heute“ auf ein Wochenende, gilt der letzte Werktag davor.
    const tag = -rng.int(0, 28);
    const datum = ctx.werktag(tag) > ctx.d(0) ? ctx.werktag(tag - 1) : ctx.werktag(tag);
    const z: Zeiteintrag = {
      id: ctx.id("z"), akteId: a.id, userId: u.id, datum,
      minuten: rng.pick([12, 18, 24, 30, 36, 42, 48, 60, 72, 90, 120]), taetigkeit: rng.pick(taetigkeiten), abrechenbar: rng.chance(0.85),
    };
    data.zeiten.push(z);
  }
}

function automationenUndAktivitaeten(ctx: Ctx) {
  const { data } = ctx;
  // Eigener Zufallsstrom für den Verlauf des 38h-Motors: Änderungen hier verschieben nicht den übrigen Demobestand.
  const rng = createRng(hashString(`${ctx.tenant.id}|motor`));
  /** Zeitpunkt ohne Zufallszug aus dem Hauptstrom (Stunde und Minute kommen immer aus dem Motor-Strom). */
  const zeitpunkt = (off: number, hh = rng.int(8, 17), mm = rng.int(0, 59)) => ctx.dt(off, hh, mm);
  const autos: Automation[] = AUTOMATION_DEFS.map((def, i) => ({
    ...def,
    id: ctx.id("au"),
    aktiv: !(def.key === "kostenfestsetzung" && rng.chance(0.4)),
    laeufe: rng.int(60, 420) + (i === 0 ? 300 : 0),
  }));
  data.automationen.push(...autos);

  // Präsentationsakten („hero-…“) erzählen eine feste Geschichte – ihr Verlauf kommt aus heroes.ts, nicht vom Zufall.
  const generisch = data.akten.filter((a) => !a.id.startsWith("hero"));
  const offeneRechnung = new Set(data.rechnungen.filter((r) => r.status !== "bezahlt").map((r) => r.akteId));
  const tag = (zeit: string) => zeit.slice(0, 10);
  /** Passt die Automation fachlich zur Akte – und lag die Akte zu diesem Zeitpunkt schon vor? */
  const passt = (key: string, a: Akte, zeit: string): boolean => {
    if (a.createdAt > zeit) return false;
    const alter = diffDays(tag(a.createdAt), tag(zeit));
    switch (key) {
      case "archivierung": return a.status === "abgeschlossen" && !!a.abgeschlossenAm && a.abgeschlossenAm <= tag(zeit);
      case "kostenfestsetzung": return a.status === "offen" && (a.phase === "Urteil" || a.phase === "Vollstreckung");
      case "mandatsaufnahme": return a.status === "offen" && alter <= 2;
      case "deckungsanfrage": return a.status === "offen" && !!a.rsv && alter <= 14;
      case "eeb": return a.status === "offen" && !!a.gerichtId;
      case "mahnwesen": return offeneRechnung.has(a.id);
      default: return a.status === "offen";
    }
  };
  const texte: Record<string, (a: Akte) => string> = {
    "posteingang-fristen": (a) => `Frist aus Posteingang erkannt und nach § 222 ZPO berechnet – ${a.aktenzeichen} ${a.titel}`,
    "mandatsaufnahme": (a) => `Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) zur Freigabe vorgelegt – ${a.aktenzeichen}`,
    "deckungsanfrage": (a) => `Deckungsanfrage an ${a.rsv?.versicherung ?? "Rechtsschutzversicherung"} zur Freigabe vorgelegt – ${a.aktenzeichen}`,
    "mandanten-update": (a) => `Mandanten-Update zur Freigabe vorgelegt – ${a.aktenzeichen} ${a.titel.split(" ./. ")[0]}`,
    "vorfristen": (a) => `Vorfrist gesetzt und Verantwortliche informiert – ${a.aktenzeichen}`,
    "eeb": (a) => `Empfangsbekenntnis vorbereitet – ${a.aktenzeichen}`,
    "bankabgleich": () => "Kontoumsatz einer offenen Rechnung zugeordnet",
    "mahnwesen": (a) => `Zahlungserinnerung zur Freigabe vorgelegt – ${a.aktenzeichen}`,
    "kostenfestsetzung": (a) => `Kostenfestsetzungsantrag zur Prüfung und Unterschrift vorbereitet – ${a.aktenzeichen}`,
    "archivierung": (a) => `Archivierung vorgeschlagen, Aufbewahrungsfrist bis ${Number((a.abgeschlossenAm ?? ctx.today).slice(0, 4)) + 6} vorgemerkt – ${a.aktenzeichen}`,
    "zeiterfassung": () => "Zeiteinträge vorgeschlagen",
    "zuordnung": (a) => `Nachricht der Akte ${a.aktenzeichen} zugeordnet`,
  };
  /** Sammeleinträge (ein Lauf, mehrere Vorgänge): Minuten je Vorgang × Anzahl. */
  const SAMMEL: Record<string, (n: number) => string> = {
    "bankabgleich": (n) => `Bankabgleich: ${n} ${n === 1 ? "Zahlung" : "Zahlungen"} zugeordnet (ab 90 % gebucht, Rest zur Bestätigung)`,
    "zeiterfassung": (n) => `${n} Zeiteinträge aus Telefonaten und E-Mails vorgeschlagen`,
    "zuordnung": (n) => `${n} Nachrichten den Akten zugeordnet (Vorschläge)`,
    "posteingang-fristen": (n) => `${n} Fristen aus dem Posteingang erkannt und zur Vier-Augen-Kontrolle vorgelegt`,
    "vorfristen": (n) => `${n} Vorfristen gesetzt`,
    "eeb": (n) => `${n} Empfangsbekenntnisse vorbereitet`,
  };
  const akteur = (key: string): Aktivitaet["akteur"] => (key === "posteingang-fristen" ? "ki" : "automation");
  // Plausible Mengen für eine Kanzlei dieser Größe – gezählt wird je tatsächlich bearbeitetem Vorgang (src/core/automationen.ts).
  // Die Summe der letzten 7 Tage ergibt sich daraus; sie darf vom Zielwert 38 Std. abweichen und wird ausgewiesen, wie sie fällt.
  // Größe nach Arbeitsplätzen der Lizenz (bzw. Teamgröße): 6 Arbeitsplätze = Faktor 1
  const groesse = Math.min(2.5, Math.max(0.6, Math.max(ctx.users.length, ctx.tenant.lizenz?.arbeitsplaetze ?? 0) / 6));
  const menge = (min: number, max: number) => Math.max(0, Math.round(rng.int(min, max) * groesse));
  /** Ereignisgesteuerte Vorgänge je Werktag [min, max] (für 6 Personen; skaliert mit der Teamgröße) */
  const JE_WERKTAG: [string, number, number][] = [
    ["zuordnung", 35, 50], ["posteingang-fristen", 4, 7], ["vorfristen", 4, 6], ["eeb", 2, 4],
  ];
  /** Seltene Vorgänge je Woche [min, max] – Kostenfestsetzung nur nach obsiegenden Urteilen, höchstens einer pro Woche */
  const JE_WOCHE: [string, number, number][] = [
    ["mandatsaufnahme", 2, 5], ["deckungsanfrage", 1, 3], ["mahnwesen", 2, 6], ["archivierung", 1, 4], ["kostenfestsetzung", 0, 1],
  ];
  const werktag = (datum: string) => istWerktag(datum, ctx.tenant.bundesland);
  /** Einzelner Vorgang an einer passenden Akte – ohne passende Akte entfällt er (nichts wird erfunden). */
  const einzel = (key: string, zeit: string): Aktivitaet | undefined => {
    const kandidaten = generisch.filter((a) => passt(key, a, zeit));
    if (!kandidaten.length) return undefined;
    const a = rng.pick(kandidaten);
    return { id: ctx.id("ak"), zeit, akteur: akteur(key), automationKey: key, akteId: a.id, text: texte[key](a), minutenGespart: ersparnisMinuten(key, 1) };
  };
  const sammel = (key: string, zeit: string, n: number): Aktivitaet => ({
    id: ctx.id("ak"), zeit, akteur: akteur(key), automationKey: key, text: SAMMEL[key](n), minutenGespart: ersparnisMinuten(key, n) || undefined,
  });

  const acts: Aktivitaet[] = [];
  // Zeitgesteuerte Läufe der letzten fünf Wochen – nur an vergangenen Tagen, damit kein Lauf vor seiner Uhrzeit liegt:
  // Zeiterfassung werktags um 18:00 Uhr (Minuten je Vorschlag), Mandanten-Update freitags ab 14:00 Uhr (je Akte mit Mandantenportal).
  for (let off = -34; off <= -1; off++) {
    const datum = ctx.d(off);
    const ze = ausloesungAm("zeiterfassung", datum, ctx.tenant.bundesland);
    if (ze) acts.push(sammel("zeiterfassung", ze, menge(5, 11)));
    const mu = ausloesungAm("mandanten-update", datum, ctx.tenant.bundesland);
    if (mu) {
      const empfaenger = rng.shuffle(generisch.filter((a) => a.mandantenportal && passt("mandanten-update", a, mu))).slice(0, rng.int(5, 8));
      empfaenger.forEach((a, i) => {
        const zeit = `${datum}T14:${String(i * 2 + rng.int(0, 1)).padStart(2, "0")}:00`;
        acts.push({ id: ctx.id("ak"), zeit, akteur: "automation", automationKey: "mandanten-update", akteId: a.id, text: texte["mandanten-update"](a), minutenGespart: ersparnisMinuten("mandanten-update", 1) });
      });
    }
  }

  // Letzte 7 Tage: jeder Vorgang einzeln (heute nur bis 9 Uhr, damit nichts in der Zukunft liegt)
  for (let off = -6; off <= 0; off++) {
    const datum = ctx.d(off);
    if (!werktag(datum)) continue;
    const anteil = off === 0 ? 0.25 : 1;
    const stunde = () => (off === 0 ? rng.int(7, 8) : rng.int(7, 18));
    for (const [key, min, max] of JE_WERKTAG) {
      const n = Math.round(menge(min, max) * anteil);
      for (let i = 0; i < n; i++) {
        const e = einzel(key, zeitpunkt(off, stunde()));
        if (e) acts.push(e);
      }
    }
    // Bankabgleich: stündlicher Abruf – gezählt werden nur zugeordnete Umsätze (ein Sammeleintrag je Abruf mit neuen Zahlungen)
    const abrufe = off === 0 ? 1 : rng.int(2, 4);
    for (let i = 0; i < abrufe; i++) {
      const n = menge(0, 3);
      if (n > 0) acts.push(sammel("bankabgleich", zeitpunkt(off, stunde()), n));
    }
  }
  for (const [key, min, max] of JE_WOCHE) {
    const n = key === "kostenfestsetzung" ? rng.int(min, max) : menge(min, max);
    for (let i = 0; i < n; i++) {
      let off = -rng.int(0, 6);
      for (let k = 0; k < 7 && !werktag(ctx.d(off)); k++) off = off <= -6 ? 0 : off - 1;
      if (!werktag(ctx.d(off))) continue;
      const e = einzel(key, zeitpunkt(off, off === 0 ? rng.int(7, 8) : rng.int(8, 17)));
      if (e) acts.push(e);
    }
  }

  // Vorwochen: je Werktag ein Sammeleintrag pro Automatik (Anzahl Vorgänge × Minuten je Vorgang) – ohne Einzelakten
  for (let off = -34; off <= -7; off++) {
    const datum = ctx.d(off);
    if (!werktag(datum)) continue;
    for (const [key, min, max] of JE_WERKTAG) {
      const n = menge(min, max);
      if (n > 0) acts.push(sammel(key, zeitpunkt(off, rng.int(17, 18)), n));
    }
    const bank = menge(3, 9);
    if (bank > 0) acts.push(sammel("bankabgleich", zeitpunkt(off, rng.int(9, 16)), bank));
  }
  for (let w = 1; w <= 4; w++) {
    for (const [key, min, max] of JE_WOCHE) {
      const n = key === "kostenfestsetzung" ? rng.int(min, max) : menge(min, max);
      for (let i = 0; i < n; i++) {
        const off = -7 * w - rng.int(0, 6);
        if (!werktag(ctx.d(off))) continue;
        const e = einzel(key, zeitpunkt(off, rng.int(8, 17)));
        if (e) acts.push(e);
      }
    }
  }
  // menschliche Aktivitäten
  for (let i = 0; i < 18; i++) {
    const zeit = zeitpunkt(-rng.int(0, 6));
    const kandidaten = generisch.filter((a) => a.status === "offen" && a.createdAt <= zeit);
    const a = rng.pick(kandidaten.length ? kandidaten : generisch);
    const u = rng.pick(ctx.users);
    const text = rng.pick([`Schriftsatz bearbeitet – ${a.aktenzeichen}`, `Notiz hinzugefügt – ${a.aktenzeichen}`, `Frist als erledigt markiert – ${a.aktenzeichen}`, `Dokument hochgeladen – ${a.aktenzeichen}`]);
    if (a.createdAt <= zeit) acts.push({ id: ctx.id("ak"), zeit, akteur: "nutzer", userId: u.id, akteId: a.id, text });
  }
  data.aktivitaeten.push(...acts);

  // „Letzter Lauf“ jeder Automation = jüngster Eintrag im Verlauf (Karte und Live-Feed zeigen dieselbe Zeit)
  for (const au of autos) {
    const eigene = data.aktivitaeten.filter((x) => x.automationKey === au.key);
    au.letzterLauf = eigene.reduce<string | undefined>((max, x) => (!max || x.zeit > max ? x.zeit : max), undefined);
    au.laeufe = Math.max(au.laeufe, eigene.length);
  }
}

/**
 * Gerichtlich gesetzte Fristen in laufenden Verfahren (Stellungnahme, Replik, Anspruchsbegründung): In einer Kanzlei dieser
 * Größe laufen jede Woche mehrere echte Fristen – nicht nur Wiedervorlagen. Eigener Zufallsstrom; Präsentationsakten bleiben unberührt.
 */
function gerichtlicheFristen(ctx: Ctx) {
  const rng = createRng(hashString(`${ctx.tenant.id}|gerichtliche-fristen`));
  const { data } = ctx;
  const mitFrist = new Set(data.fristen.filter((f) => f.status === "offen" && (f.typ === "frist" || f.typ === "notfrist")).map((f) => f.akteId));
  const kandidaten = data.akten.filter((a) => !a.id.startsWith("hero") && a.status === "offen" && a.gerichtId && a.gerichtsAz && (a.phase === "Gerichtlich" || a.phase === "Beweisaufnahme") && !mitFrist.has(a.id));
  let zpo = 0;
  const art = (a: Akte): { titel: string; grundlage: string } | undefined => {
    const az = a.gerichtsAz ?? "";
    const sw = a.schlagworte.join(" ");
    if (a.phase === "Beweisaufnahme") return { titel: "Stellungnahme zum Sachverständigengutachten", grundlage: "Richterliche Frist (§ 411 Abs. 4 ZPO)" };
    if (/ Ca /.test(az)) return { titel: "Stellungnahme zur Klageerwiderung (Auflage des Arbeitsgerichts)", grundlage: "Richterliche Frist (Auflagenbeschluss)" };
    if (/ F /.test(az)) {
      if (/umgang|sorgerecht/.test(sw)) return { titel: "Stellungnahme zum Bericht des Jugendamts", grundlage: "Gerichtlich gesetzte Frist (FamFG)" };
      if (/unterhalt/.test(sw)) return { titel: "Auskunft über Einkünfte und Belege vorlegen", grundlage: "Gerichtliche Auflage (§ 235 Abs. 1 FamFG)" };
      return { titel: "Stellungnahme zum Schriftsatz der Gegenseite", grundlage: "Gerichtlich gesetzte Frist (FamFG)" };
    }
    if (/-0-/.test(az)) return { titel: "Anspruchsbegründung einreichen", grundlage: "Aufforderung nach § 697 Abs. 1 ZPO" };
    if (/ (O|C) /.test(az)) {
      const varianten = [
        { titel: "Stellungnahme zum Schriftsatz der Gegenseite", grundlage: "Richterliche Frist (§ 273 Abs. 2 Nr. 1 ZPO)" },
        { titel: "Beweisantritt: Zeugen mit ladungsfähiger Anschrift benennen", grundlage: "Richterliche Frist (§ 273 Abs. 2 Nr. 1 ZPO)" },
        { titel: "Unterlagen nach Hinweisbeschluss vorlegen", grundlage: "Richterliche Frist (§ 139 Abs. 5 ZPO)" },
      ];
      return varianten[zpo++ % varianten.length];
    }
    return undefined;
  };
  // Verteilung über die nächsten zwei Wochen, Schwerpunkt auf den nächsten Werktagen
  const abstaende = [2, 3, 4, 5, 7, 9, 11, 13];
  let i = 0;
  const je = new Map<string, number>();
  for (const a of rng.shuffle(kandidaten)) {
    const x = art(a);
    // höchstens zwei gleichlautende Fristen, damit die Liste nicht eintönig wirkt
    if (!x || i >= abstaende.length || (je.get(x.titel) ?? 0) >= 2) continue;
    je.set(x.titel, (je.get(x.titel) ?? 0) + 1);
    addFrist(ctx, {
      akteId: a.id, titel: x.titel, typ: "frist", datum: ctx.werktag(abstaende[i++] + rng.int(0, 1)), grundlage: x.grundlage,
      verantwortlichId: a.bearbeiterId, quelle: rng.chance(0.5) ? "ki" : "manuell", kontrolliertVon: rng.chance(0.7) ? ctx.refas[0]?.id : undefined,
      createdAt: ctx.dt(-rng.int(2, 12), rng.int(8, 17), rng.int(0, 59)),
    });
  }
}

/**
 * Heute und an den nächsten Werktagen liegt immer etwas an: heute eine Frist und eine Wiedervorlage, am nächsten Werktag
 * eine Wiedervorlage, am übernächsten eine Frist (zusätzlich zu den Präsentationsakten).
 */
function verteileHeuteFristen(ctx: Ctx) {
  const offen = ctx.data.fristen.filter((f) => f.status === "offen" && (f.typ === "wiedervorlage" || f.typ === "frist") && !f.regelKey && !f.akteId.startsWith("hero") && f.datum > ctx.d(3));
  const fristen = ctx.rng.shuffle(offen.filter((f) => f.typ === "frist"));
  const wv = ctx.rng.shuffle(offen.filter((f) => f.typ === "wiedervorlage"));
  if (istWerktag(ctx.today, ctx.tenant.bundesland)) {
    if (fristen[0]) fristen[0].datum = ctx.today;
    if (wv[0]) wv[0].datum = ctx.today;
  }
  if (wv[1]) wv[1].datum = ctx.werktag(1);
  if (fristen[1]) fristen[1].datum = ctx.werktag(2);
}

/** Hauptfunktion: kompletter Datenbestand für eine Kanzlei. */
/**
 * `kundentest`: Kanzlei aus der Apex Console (keine Präsentationskanzlei). Ihre Beispielaktivitäten werden als `beispiel`
 * gekennzeichnet und keiner echten Person zugeschrieben – im Protokoll steht nichts auf den Namen der Kundin, was sie nicht
 * selbst ausgelöst hat. Standard: Kanzleien ohne Präsentationsakten (`heroes: "none"`).
 */
export function generateTenantData(input: SeedInput, today: string, opts: { leer?: boolean; kundentest?: boolean } = {}): TenantData {
  rechnungsNr = 0;
  const ctx = createCtx(input, today);
  ctx.data.meta.push({ seedVersion: SEED_VERSION, seededAt: `${today}T06:00:00` });
  if (opts.leer) {
    // Kunden-Kanzlei ohne Beispieldaten: Der simulierte Hintergrundbetrieb läuft hier nicht. Aktiv sind zu Beginn nur die
    // Automationen, die AnwaltApex selbst beim auslösenden Schritt erledigt (Akte anlegen, Frist eintragen, Akte abschließen);
    // alle übrigen schaltet die Kanzlei nach der Einrichtung (beA, Konto, Mandantenportal) im 38h-Motor ein.
    const sofort = new Set(["mandatsaufnahme", "deckungsanfrage", "vorfristen", "archivierung"]);
    const autos: Automation[] = AUTOMATION_DEFS.map((def) => ({ ...def, id: ctx.id("au"), aktiv: sofort.has(def.key), laeufe: 0 }));
    ctx.data.automationen.push(...autos);
    return ctx.data;
  }
  if (input.profil.heroes === "berlin") heroesBerlin(ctx);
  if (input.profil.heroes === "muenchen") heroesMuenchen(ctx);
  if (input.profil.heroes === "hamburg") heroesHamburg(ctx);

  const anzahl = 34;
  let az = 101;
  for (let i = 0; i < anzahl; i++) {
    while (ctx.usedAz.has(az)) az++;
    const sg = pickWeighted(ctx.rng, input.profil.sachgebiete);
    generischeAkte(ctx, sg, az);
    az += ctx.rng.chance(0.25) ? 2 : 1;
  }
  nummeriereRechnungen(ctx.data);
  generischerPosteingang(ctx);
  bankUmsaetze(ctx);
  zeiten(ctx);
  automationenUndAktivitaeten(ctx);
  gerichtlicheFristen(ctx);
  verteileHeuteFristen(ctx);
  // Zusatzakten mit festen Werten und eigenen IDs – erst ganz am Ende, damit der übrige Bestand unverändert bleibt
  if (input.profil.heroes === "berlin") zusatzBerlin(ctx);

  if (opts.kundentest ?? input.profil.heroes === "none") {
    for (const a of ctx.data.aktivitaeten) {
      a.beispiel = true;
      delete a.userId;
    }
  }

  ctx.data.akten.sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true }));
  ctx.data.nachrichten.sort((a, b) => b.eingang.localeCompare(a.eingang));
  ctx.data.aktivitaeten.sort((a, b) => b.zeit.localeCompare(a.zeit));
  ctx.data.fristen.sort((a, b) => a.datum.localeCompare(b.datum));
  return ctx.data;
}

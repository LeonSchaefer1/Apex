// Erzeugt einen vollständigen, in sich stimmigen Datenbestand für eine Kanzlei – relativ zum heutigen Datum.
import { AUTOMATION_DEFS } from "../automationen";
import { addDays, addMonthsBGB, diffDays, fmtDate, fmtEUR, round2, toLocalISO } from "../dates";
import { istWerktag } from "../feiertage";
import { berechneNachRegel, regel as fristRegel } from "../fristen";
import { berechneRvg, fassungFuerAuftrag, rvgRechnungsPositionen } from "../rvg";
import type {
  Akte, Aktivitaet, Automation, Dokument, Frist, Kontakt, KontaktRolle, Nachricht,
  Rechnung, Sachgebiet, Tenant, TenantData, Transaktion, User, Zeiteintrag,
} from "../types";
import { stadtDatenFuer, type StadtDaten, type StadtKey, VORNAMEN_M, VORNAMEN_W, NACHNAMEN, BRANCHEN, HAUSVERWALTUNGEN, GEGNERANWAELTE, VERSICHERUNGEN, KFZ_VERSICHERER } from "./pools";
import { createRng, hashString, type Rng } from "./rng";
import { vorlagenFuer, type FallVorlage, type Parteien } from "./vorlagen";
import { heroesBerlin, heroesMuenchen, heroesHamburg } from "./heroes";

export const SEED_VERSION = 6;

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
    buchungen: [], transaktionen: [], zeiten: [], automationen: [], aktivitaeten: [], notizen: [], meta: [],
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
        email: `info@${slug(name.split(" ")[0])}.de`,
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
    r = {
      id: ctx.id("r"), nummer, akteId: akte.id, empfaengerId: akte.rsv?.deckung === "erteilt" ? akte.mandantId : akte.mandantId,
      datum, faellig: addDays(datum, 14),
      positionen: rvgRechnungsPositionen(calc.angelegenheiten),
      netto: calc.netto, ust: calc.ust, brutto: calc.brutto, status: "gestellt", bezahlt: 0,
      format: ctx.rng.chance(0.3) ? "XRechnung" : "PDF", createdAt: `${datum}T10:00:00`,
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
  const gerichtsAz = gericht
    ? gerichtArt === "arbg" ? `${rng.int(1, 60)} Ca ${rng.int(1000, 9999)}/${ctx.yy}`
      : gerichtArt === "fam" ? `${rng.int(270, 290)} F ${rng.int(100, 999)}/${ctx.yy}`
      : gerichtArt === "mahn" ? `${ctx.yy}-${rng.int(1000000, 9999999)}-0-${rng.int(1, 9)}`
      : gerichtArt === "lg" ? `${rng.int(2, 35)} O ${rng.int(100, 480)}/${ctx.yy}`
      : gerichtArt === "straf" ? `${rng.int(200, 290)} Cs ${rng.int(100, 999)}/${ctx.yy}`
      : `${rng.int(1, 240)} C ${rng.int(100, 999)}/${ctx.yy}`
    : gerichtArt === "sta" ? `${rng.int(200, 290)} Js ${rng.int(1000, 9999)}/${ctx.yy}` : undefined;
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
  addDok(ctx, { akteId: akte.id, name: "Vollmacht", art: "vollmacht", ordner: "Mandant", quelle: "generiert", format: "pdf", inhalt: `Vollmacht: ${mandant.name} bevollmächtigt ${ctx.tenant.name} in der Sache ${akte.titel}.`, createdAt: ctx.dt(createdOffset + 1) });
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
      addMsg(ctx, {
        kanal: "bea", von: gericht.name, betreff: `${a.gerichtsAz ?? ""} – Verfügung`,
        text: `In Sachen ${a.titel} (Az. ${a.gerichtsAz}) wird mitgeteilt, dass der Termin zur mündlichen Verhandlung vom Vorsitzenden aufrechterhalten bleibt. Den Parteien wird aufgegeben, etwaige weitere Unterlagen bis spätestens eine Woche vor dem Termin einzureichen.`,
        eingang: ctx.dt(-rng.int(1, 5)), akteId: a.id, status: "gelesen", kiStatus: "uebernommen", zugeordnet: true,
        anhaenge: [{ name: "Verfuegung.pdf", groesseKb: rng.int(40, 180) }],
        ki: { akteId: a.id, sicherheit: 0.99, zusammenfassung: "Gerichtliche Verfügung: Termin bleibt bestehen, Unterlagen bis eine Woche vor Termin.", aktion: "Wiedervorlage eine Woche vor Termin gesetzt." },
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
    kanal: "email", von: "Rechtsanwaltskammer – Kammerreport", vonAdresse: "newsletter@rak.example", betreff: "Kammerreport: Neuerungen zum beA und zur E-Rechnung",
    text: "Liebe Kammermitglieder, in dieser Ausgabe: Neuerungen beim beA, Pflicht zum Empfang von E-Rechnungen, Fortbildungsangebote im Herbst.",
    eingang: ctx.dt(-2, 7, 30), status: "gelesen", kiStatus: "analysiert", zugeordnet: false,
    ki: { sicherheit: 0.99, zusammenfassung: "Newsletter der Kammer, keiner Akte zuzuordnen.", aktion: "Kein Handlungsbedarf – archiviert." },
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
    };
    data.transaktionen.push(t);
  });
  // Versicherungszahlung (Fremdgeld) und sonstige Umsätze
  data.transaktionen.push(
    { id: ctx.id("t"), datum: ctx.d(-1), betrag: -2450, gegenpartei: "Bürohaus Verwaltung GmbH", iban: "DE44 1001 0010 0123 4567 89", verwendungszweck: `Miete Kanzleiräume ${["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"][Number(ctx.today.slice(5, 7)) - 1]}`, status: "offen" },
    { id: ctx.id("t"), datum: ctx.d(-2), betrag: -189.9, gegenpartei: "Telekommunikation AG", iban: "DE12 3004 0000 0123 4567 00", verwendungszweck: "Kundennr. 4711-0815 Rechnung", status: "offen" },
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
    const z: Zeiteintrag = {
      id: ctx.id("z"), akteId: a.id, userId: u.id, datum: ctx.werktag(-rng.int(0, 28)),
      minuten: rng.pick([12, 18, 24, 30, 36, 42, 48, 60, 72, 90, 120]), taetigkeit: rng.pick(taetigkeiten), abrechenbar: rng.chance(0.85),
    };
    data.zeiten.push(z);
  }
}

function automationenUndAktivitaeten(ctx: Ctx) {
  const { rng, data } = ctx;
  const autos: Automation[] = AUTOMATION_DEFS.map((def, i) => ({
    ...def,
    id: ctx.id("au"),
    aktiv: !(def.key === "kostenfestsetzung" && rng.chance(0.4)),
    laeufe: rng.int(60, 420) + (i === 0 ? 300 : 0),
    letzterLauf: ctx.dt(-rng.int(0, 1)),
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
    "mandatsaufnahme": (a) => `Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutz) erstellt – ${a.aktenzeichen}`,
    "deckungsanfrage": (a) => `Deckungsanfrage an ${a.rsv?.versicherung ?? "Rechtsschutzversicherung"} versendet – ${a.aktenzeichen}`,
    "mandanten-update": (a) => `Mandanten-Update versendet – ${a.aktenzeichen} ${a.titel.split(" ./. ")[0]}`,
    "vorfristen": (a) => `Vorfrist gesetzt und Verantwortliche informiert – ${a.aktenzeichen}`,
    "eeb": (a) => `Empfangsbekenntnis vorbereitet – ${a.aktenzeichen}`,
    "bankabgleich": () => `Bankabgleich: ${rng.int(2, 6)} Zahlungen automatisch zugeordnet`,
    "mahnwesen": (a) => `Zahlungserinnerung versendet – ${a.aktenzeichen}`,
    "kostenfestsetzung": (a) => `Kostenfestsetzungsantrag vorbereitet – ${a.aktenzeichen}`,
    "archivierung": (a) => `Akte archiviert, Aufbewahrungsfrist bis ${Number((a.abgeschlossenAm ?? ctx.today).slice(0, 4)) + 6} vorgemerkt – ${a.aktenzeichen}`,
    "zeiterfassung": () => `${rng.int(4, 11)} Zeiteinträge aus Telefonaten und E-Mails vorgeschlagen`,
    "zuordnung": (a) => `Nachricht automatisch der Akte ${a.aktenzeichen} zugeordnet`,
  };
  const ohneAkte = ["bankabgleich", "zeiterfassung"];
  const gewichte: [string, number][] = [
    ["posteingang-fristen", 10], ["zuordnung", 12], ["vorfristen", 8], ["mandanten-update", 7], ["bankabgleich", 4],
    ["mandatsaufnahme", 3], ["deckungsanfrage", 3], ["eeb", 4], ["mahnwesen", 3], ["zeiterfassung", 5], ["archivierung", 2], ["kostenfestsetzung", 1],
  ];
  /** Eine Automations-Aktivität zum Zeitpunkt `zeit` – passt keine Akte, wird es ein Lauf ohne Aktenbezug. */
  const eintrag = (zeit: string, faktor = 1): Aktivitaet => {
    let key = pickWeighted(rng, gewichte);
    const kandidaten = ohneAkte.includes(key) ? [] : generisch.filter((a) => passt(key, a, zeit));
    const a = kandidaten.length ? rng.pick(kandidaten) : undefined;
    if (!a && !ohneAkte.includes(key)) key = rng.chance(0.5) ? "bankabgleich" : "zeiterfassung";
    const def = AUTOMATION_DEFS.find((x) => x.key === key)!;
    return {
      id: ctx.id("ak"), zeit, akteur: key === "posteingang-fristen" ? "ki" : "automation", automationKey: key,
      akteId: a?.id, text: texte[key](a as Akte), minutenGespart: def.minutenProLauf * faktor,
    };
  };

  // Woche: Ziel ≈ 38 Std. gesparte Zeit (inkl. der festen Einträge der Präsentationsakten)
  const wochenStart = ctx.d(-6);
  let wochenMin = data.aktivitaeten.filter((x) => x.zeit >= wochenStart).reduce((sum, x) => sum + (x.minutenGespart ?? 0), 0);
  const ziel = 2280 + rng.int(-40, 60);
  const acts: Aktivitaet[] = [];
  while (wochenMin < ziel) {
    const off = -rng.int(0, 6);
    let hh = rng.int(7, 19);
    if (off === 0) hh = Math.min(hh, 9);
    const e = eintrag(ctx.dt(off, hh));
    acts.push(e);
    wochenMin += e.minutenGespart ?? 0;
  }
  // ältere Einträge (Vorwochen)
  for (let i = 0; i < 70; i++) acts.push(eintrag(ctx.dt(-rng.int(7, 34)), rng.int(4, 9)));
  // menschliche Aktivitäten
  for (let i = 0; i < 18; i++) {
    const zeit = ctx.dt(-rng.int(0, 6));
    const kandidaten = generisch.filter((a) => a.status === "offen" && a.createdAt <= zeit);
    const a = rng.pick(kandidaten.length ? kandidaten : generisch);
    const u = rng.pick(ctx.users);
    const text = rng.pick([`Schriftsatz bearbeitet – ${a.aktenzeichen}`, `Notiz hinzugefügt – ${a.aktenzeichen}`, `Frist als erledigt markiert – ${a.aktenzeichen}`, `Dokument hochgeladen – ${a.aktenzeichen}`]);
    if (a.createdAt <= zeit) acts.push({ id: ctx.id("ak"), zeit, akteur: "nutzer", userId: u.id, akteId: a.id, text });
  }
  data.aktivitaeten.push(...acts);
}

function verteileHeuteFristen(ctx: Ctx) {
  const offen = ctx.data.fristen.filter((f) => f.status === "offen" && (f.typ === "wiedervorlage" || f.typ === "frist") && !f.regelKey && f.datum > ctx.d(3));
  const pick = ctx.rng.shuffle(offen).slice(0, 4);
  if (istWerktag(ctx.today, ctx.tenant.bundesland)) {
    if (pick[0]) pick[0].datum = ctx.today;
    if (pick[1]) pick[1].datum = ctx.today;
  }
  if (pick[2]) pick[2].datum = ctx.werktag(1);
  if (pick[3]) pick[3].datum = ctx.werktag(2);
}

/** Hauptfunktion: kompletter Datenbestand für eine Kanzlei. */
export function generateTenantData(input: SeedInput, today: string, opts: { leer?: boolean } = {}): TenantData {
  rechnungsNr = 0;
  const ctx = createCtx(input, today);
  ctx.data.meta.push({ seedVersion: SEED_VERSION, seededAt: `${today}T06:00:00` });
  if (opts.leer) {
    const autos: Automation[] = AUTOMATION_DEFS.map((def) => ({ ...def, id: ctx.id("au"), aktiv: true, laeufe: 0 }));
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
  verteileHeuteFristen(ctx);

  ctx.data.akten.sort((a, b) => b.aktenzeichen.localeCompare(a.aktenzeichen, "de", { numeric: true }));
  ctx.data.nachrichten.sort((a, b) => b.eingang.localeCompare(a.eingang));
  ctx.data.aktivitaeten.sort((a, b) => b.zeit.localeCompare(a.zeit));
  ctx.data.fristen.sort((a, b) => a.datum.localeCompare(b.datum));
  return ctx.data;
}

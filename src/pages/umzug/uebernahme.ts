// Führt die Übernahme aus: Kontakte (zusammengeführt), Akten, Fristen (zur Vier-Augen-Kontrolle) und Datenblatt je Akte.
// Jeder Lauf trägt eine `umzugLaufId` an allen angelegten Datensätzen und wird für „Rückgängig machen“ vorgemerkt.
import type { Akte, Aktivitaet, Bundesland, CollectionKey, Dokument, Frist, Kontakt, User } from "@/core/types";
import { addDays, fmtDate, nowLocal, today, uid } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import { useData } from "@/store/data";
import { ORG, grundlageAus, imUmfang, normName, ohneAbschlussdatum, type DateiDublettenAktion, type DublettenAktion, type MigZeile, type OhneDatumAktion, type Umfang } from "./zuordnung";

export type Entitaet = "kontakte" | "akten" | "fristen" | "dokumente";

export interface Fortschritt {
  done: number;
  total: number;
}

export interface UndoInfo {
  erstellt: { col: CollectionKey; id: string }[];
  vorher: { col: "akten" | "kontakte"; doc: Akte | Kontakt }[];
}

export interface Ergebnis {
  kontakteNeu: number;
  kontakteZusammengefuehrt: number;
  aktenNeu: number;
  aktenAktualisiert: number;
  aktenUmbenannt: number;
  uebersprungen: number;
  fehlerhaft: number;
  fristen: number;
  /** davon Notfristen und Fristen – sie gehen in die Vier-Augen-Kontrolle (Wiedervorlagen und Termine nicht) */
  fristenKontrolle: number;
  dokumente: number;
  /** Dubletten innerhalb der Datei, die mit der ersten Zeile zusammengeführt wurden */
  zusammengefuehrt: number;
  /** als abgeschlossen (Archiv) übernommene Akten */
  archiviert: number;
  /** wegen des gewählten Umfangs (nur offene / letzte 6 Jahre) nicht übernommen */
  ausserhalbUmfang: number;
  laufId: string;
  undo: UndoInfo;
}

function neuerKontakt(name: string, rolle: "mandant" | "gegner", system: string, laufId: string): Kontakt {
  const org = ORG.test(name);
  const ohneTitel = name.replace(/^(Dr\.|Prof\.)\s+/g, "");
  const teile = ohneTitel.split(/\s+/);
  return {
    id: uid("k"),
    typ: org ? "organisation" : "person",
    name,
    ...(org ? { firma: name } : { vorname: teile.slice(0, -1).join(" ") || undefined, nachname: teile[teile.length - 1] }),
    rollen: [rolle],
    notiz: `Aus ${system} übernommen.`,
    createdAt: nowLocal(),
    umzugLaufId: laufId,
  };
}

/** Kanzleistandard für übernommene Fristen ohne Rechenweg: Vorfrist eine Woche vor Fristende, auf den Werktag davor gelegt – nie vor heute. */
const VORFRIST_TAGE = 7;

function vorfristFuer(datum: string, land: Bundesland, heute: string): string | undefined {
  if (datum <= heute) return undefined;
  let d = addDays(datum, -VORFRIST_TAGE);
  for (let i = 0; i < 7 && !istWerktag(d, land); i++) d = addDays(d, -1);
  return d < heute ? heute : d;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Entscheidungen, nach denen die Übernahme Zeilen auswählt – dieselben für Vorschau (Schritt 3 und 4) und Lauf. */
export interface AuswahlRegeln {
  aktionFuer: (z: MigZeile) => DublettenAktion;
  dateiAktionFuer: (z: MigZeile) => DateiDublettenAktion;
  umfang: Umfang;
  heute: string;
  ohneDatumAktionFuer?: (z: MigZeile) => OhneDatumAktion | undefined;
}

/** Ergebnis der Auswahl: übernommene Zeilen (abgeschlossen ohne Datum + „übernehmen“ als ruhend), angehängte Dateidubletten, Zähler. */
export interface Auswahl {
  rein: MigZeile[];
  angehaengt: Map<number, MigZeile[]>;
  fehlerhaft: number;
  ausserhalb: number;
  uebersprungen: number;
  zusammengefuehrt: number;
  /** abgeschlossen ohne Abschlussdatum (Umfang „letzte 6 Jahre“) – zur Entscheidung vorgelegt */
  ohneDatum: MigZeile[];
}

/**
 * Wählt die Zeilen so aus, wie die Übernahme sie anlegt: Umfang (mit Entscheidung für Akten ohne Abschlussdatum),
 * Dubletten der Datei (zusammenführen, beide behalten, überspringen) und Dubletten im Bestand (überspringen, überschreiben).
 */
export function waehleZeilen(zeilen: MigZeile[], p: AuswahlRegeln): Auswahl {
  const a: Auswahl = { rein: [], angehaengt: new Map(), fehlerhaft: 0, ausserhalb: 0, uebersprungen: 0, zusammengefuehrt: 0, ohneDatum: [] };
  for (const z of zeilen) {
    if (z.fehler) {
      a.fehlerhaft++;
      continue;
    }
    let zeile = z;
    if (ohneAbschlussdatum(z, p.umfang)) {
      a.ohneDatum.push(z);
      const e = p.ohneDatumAktionFuer?.(z);
      if (!e || e === "auslassen") {
        a.ausserhalb++;
        continue;
      }
      // „übernehmen“: als ruhend zur Prüfung anlegen (nicht still archivieren), „als Archiv“: abgeschlossen
      if (e === "uebernehmen") zeile = { ...z, status: "ruhend", statusRoh: `${z.statusRoh} – ohne Abschlussdatum, ruhend zur Prüfung` };
    } else if (!imUmfang(z, p.umfang, p.heute)) {
      a.ausserhalb++;
      continue;
    }
    if (z.dateiDublette) {
      const d = p.dateiAktionFuer(z);
      if (d === "skip") {
        a.uebersprungen++;
        continue;
      }
      if (d === "merge") {
        a.angehaengt.set(z.dateiDublette.nr, [...(a.angehaengt.get(z.dateiDublette.nr) ?? []), z]);
        a.zusammengefuehrt++;
        continue;
      }
    }
    if (z.dublette && p.aktionFuer(z) === "skip") {
      a.uebersprungen++;
      continue;
    }
    a.rein.push(zeile);
  }
  return a;
}

/**
 * Fristen und Wiedervorlagen so zählen wie die Übernahme: nach Umfang, Dubletten und Zusammenführung – eine
 * zusammengeführte Dublette bringt ihre Frist nur mit, wenn sie abweicht; eine überschriebene Bestandsakte nur Fristen,
 * die sie noch nicht hat. Schritt 3, 4 und 5 zeigen dieselben Zahlen.
 */
export function fristenPlan(zeilen: MigZeile[], p: AuswahlRegeln & { bestand?: Pick<Frist, "akteId" | "datum" | "titel">[] }, auswahl: Auswahl = waehleZeilen(zeilen, p)): { fristen: number; wiedervorlagen: number } {
  const gesehen = new Set<string>();
  let fristen = 0;
  let wiedervorlagen = 0;
  for (const z of auswahl.rein)
    for (const x of [z, ...(auswahl.angehaengt.get(z.nr) ?? [])]) {
      if (!x.fristDatum) continue;
      const titel = normName(x.fristTitel || "Frist aus Altsystem");
      const key = `${z.nr}|${x.fristDatum}|${titel}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      const ziel = z.dublette && p.aktionFuer(z) === "overwrite" ? z.dublette.akteId : undefined;
      if (ziel && p.bestand?.some((f) => f.akteId === ziel && f.datum === x.fristDatum && normName(f.titel) === titel)) continue;
      if (x.fristTyp === "notfrist" || x.fristTyp === "frist") fristen++;
      else wiedervorlagen++;
    }
  return { fristen, wiedervorlagen };
}

/** Vorschau der Übernahme (Schritt 3 und 4) – zählt genau wie `fuehreUmzugAus`. */
export interface UmzugPlan {
  akten: number;
  archiv: number;
  /** abgeschlossen ohne Abschlussdatum, „übernehmen“ – als ruhend zur Prüfung */
  ruhendPruefung: number;
  aktualisieren: number;
  ueberspringen: number;
  zusammengefuehrt: number;
  ausserhalb: number;
  ohneDatum: MigZeile[];
  ohneDatumOffen: number;
  fristen: number;
  wiedervorlagen: number;
  /** Kontakte aus den übernommenen Zeilen (neu + vorhandene) */
  kontakte: number;
  kontakteVorhanden: number;
}

export function umzugPlan(zeilen: MigZeile[], p: AuswahlRegeln & { kontakte: Pick<Kontakt, "name">[]; bestand?: Pick<Frist, "akteId" | "datum" | "titel">[] }): UmzugPlan {
  const a = waehleZeilen(zeilen, p);
  const ueberschreiben = (z: MigZeile) => !!z.dublette && p.aktionFuer(z) === "overwrite";
  const neu = a.rein.filter((z) => !ueberschreiben(z));
  const namen = new Set<string>();
  for (const z of a.rein) for (const n of [z.mandant, z.gegner]) if (normName(n)) namen.add(normName(n));
  const vorhanden = new Set(p.kontakte.map((k) => normName(k.name)));
  // ohne Mandant legt die Übernahme je neuer Akte einen Mandanten aus der Bezeichnung an
  const ersatzMandanten = neu.filter((z) => !normName(z.mandant)).length;
  const f = fristenPlan(zeilen, p, a);
  const ohneDatumOffen = a.ohneDatum.filter((z) => !p.ohneDatumAktionFuer?.(z)).length;
  return {
    akten: neu.length,
    archiv: neu.filter((z) => z.status === "abgeschlossen").length,
    ruhendPruefung: neu.filter((z) => z.status === "ruhend" && a.ohneDatum.some((o) => o.nr === z.nr)).length,
    aktualisieren: a.rein.length - neu.length,
    ueberspringen: a.uebersprungen,
    zusammengefuehrt: a.zusammengefuehrt,
    // noch nicht entschiedene Akten ohne Abschlussdatum zählen nicht als „außerhalb“ – sie stehen zur Entscheidung
    ausserhalb: a.ausserhalb - ohneDatumOffen,
    ohneDatum: a.ohneDatum,
    ohneDatumOffen,
    fristen: f.fristen,
    wiedervorlagen: f.wiedervorlagen,
    kontakte: namen.size + ersatzMandanten,
    kontakteVorhanden: [...namen].filter((n) => vorhanden.has(n)).length,
  };
}

export async function fuehreUmzugAus(opts: {
  zeilen: MigZeile[];
  aktionFuer: (z: MigZeile) => DublettenAktion;
  /** Dubletten innerhalb der Datei: zusammenführen (Standard), beide behalten, überspringen */
  dateiAktionFuer?: (z: MigZeile) => DateiDublettenAktion;
  umfang?: Umfang;
  /** Abgeschlossene Akten ohne Abschlussdatum (Umfang „letzte 6 Jahre“): übernehmen (ruhend), als Archiv, auslassen */
  ohneDatumAktionFuer?: (z: MigZeile) => OhneDatumAktion | undefined;
  /** Zwischenstand nach jedem Abschnitt – hält Zahlen und Rückgängig-Daten fest, falls das Fenster geschlossen wird */
  onZwischenstand?: (e: Ergebnis) => void;
  laufId?: string;
  system: string;
  user: User;
  team: User[];
  bundesland: Bundesland;
  onFortschritt: (e: Entitaet, f: Fortschritt) => void;
}): Promise<Ergebnis> {
  const { zeilen, aktionFuer, system, user, team, bundesland, onFortschritt } = opts;
  const dateiAktionFuer = opts.dateiAktionFuer ?? (() => "merge" as const);
  const umfang = opts.umfang ?? "alle";
  const laufId = opts.laufId ?? uid("uz");
  const st = () => useData.getState();
  const undo: UndoInfo = { erstellt: [], vorher: [] };
  const e: Ergebnis = {
    kontakteNeu: 0, kontakteZusammengefuehrt: 0, aktenNeu: 0, aktenAktualisiert: 0, aktenUmbenannt: 0, uebersprungen: 0, fehlerhaft: 0, fristen: 0, fristenKontrolle: 0, dokumente: 0,
    zusammengefuehrt: 0, archiviert: 0, ausserhalbUmfang: 0, laufId, undo,
  };

  const anwalt = user.rolle === "partner" || user.rolle === "anwalt" ? user : team.find((u) => u.rolle === "partner" || u.rolle === "anwalt") ?? user;
  const refa = team.find((u) => u.rolle === "refa");
  const heuteTag = today();

  // Auswahl wie in der Vorschau: Umfang, Entscheidung „ohne Abschlussdatum“, Dubletten der Datei und im Bestand.
  // „zusammenführen“ hängt eine Dateidublette an die erste Zeile an (Frist nur, wenn sie abweicht).
  const auswahl = waehleZeilen(zeilen, { aktionFuer, dateiAktionFuer, umfang, heute: heuteTag, ohneDatumAktionFuer: opts.ohneDatumAktionFuer });
  const { angehaengt } = auswahl;
  const zuImportieren = auswahl.rein;
  e.fehlerhaft = auswahl.fehlerhaft;
  e.ausserhalbUmfang = auswahl.ausserhalb;
  e.uebersprungen = auswahl.uebersprungen;
  e.zusammengefuehrt = auswahl.zusammengefuehrt;

  // 1 · Kontakte (Zusammenführung über den normalisierten Namen)
  const namen = new Map<string, { name: string; rollen: Set<"mandant" | "gegner"> }>();
  for (const z of zuImportieren) {
    for (const [name, rolle] of [[z.mandant, "mandant"], [z.gegner, "gegner"]] as const) {
      if (!name) continue;
      const key = normName(name);
      if (!key) continue;
      const cur = namen.get(key) ?? { name, rollen: new Set() };
      cur.rollen.add(rolle);
      namen.set(key, cur);
    }
  }
  const kontaktId = new Map<string, string>();
  const vorhandene = new Map(st().data.kontakte.map((k) => [normName(k.name), k]));
  const kTotal = namen.size;
  let kDone = 0;
  onFortschritt("kontakte", { done: 0, total: kTotal });
  const kPause = Math.max(14, Math.min(60, 900 / Math.max(1, kTotal)));
  for (const [key, { name, rollen }] of namen) {
    const ex = vorhandene.get(key);
    if (ex) {
      const fehlend = [...rollen].filter((r) => !ex.rollen.includes(r));
      if (fehlend.length) {
        undo.vorher.push({ col: "kontakte", doc: structuredClone(ex) });
        // vorherigen Stand sichern, bevor der vorhandene Kontakt eine Rolle dazubekommt
        opts.onZwischenstand?.(e);
        st().patch("kontakte", ex.id, { rollen: [...ex.rollen, ...fehlend] });
      }
      kontaktId.set(key, ex.id);
      e.kontakteZusammengefuehrt++;
    } else {
      const rolle = rollen.has("mandant") ? "mandant" : "gegner";
      const k = neuerKontakt(name, rolle, system, laufId);
      if (rollen.size > 1) k.rollen = ["mandant", "gegner"];
      st().upsert("kontakte", k);
      undo.erstellt.push({ col: "kontakte", id: k.id });
      kontaktId.set(key, k.id);
      e.kontakteNeu++;
    }
    onFortschritt("kontakte", { done: ++kDone, total: kTotal });
    await pause(kPause);
  }

  opts.onZwischenstand?.(e);

  // 2 · Akten
  const vergebeneAz = new Set(st().data.akten.map((a) => a.aktenzeichen.trim().toLowerCase()));
  const yy = today().slice(2, 4);
  let naechsteNr = Math.max(100, ...st().data.akten.map((a) => (a.aktenzeichen.endsWith(`/${yy}`) ? parseInt(a.aktenzeichen, 10) || 0 : 0))) + 1;
  const freiesAz = (wunsch: string): { az: string; umbenannt: boolean } => {
    if (!wunsch) {
      while (vergebeneAz.has(`${naechsteNr}/${yy}`)) naechsteNr++;
      const az = `${naechsteNr}/${yy}`;
      vergebeneAz.add(az);
      return { az, umbenannt: false };
    }
    if (!vergebeneAz.has(wunsch.toLowerCase())) {
      vergebeneAz.add(wunsch.toLowerCase());
      return { az: wunsch, umbenannt: false };
    }
    let k = 2;
    while (vergebeneAz.has(`${wunsch}-${k}`.toLowerCase())) k++;
    vergebeneAz.add(`${wunsch}-${k}`.toLowerCase());
    return { az: `${wunsch}-${k}`, umbenannt: true };
  };

  const heute = today();
  const akteFuer = new Map<number, Akte>();
  const aTotal = zuImportieren.length;
  onFortschritt("akten", { done: 0, total: aTotal });
  const aPause = Math.max(16, Math.min(70, 1100 / Math.max(1, aTotal)));
  for (let i = 0; i < zuImportieren.length; i++) {
    const z = zuImportieren[i];
    const mandantId = z.mandant ? kontaktId.get(normName(z.mandant)) : undefined;
    const gegnerId = z.gegner ? kontaktId.get(normName(z.gegner)) : undefined;
    const dazu = angehaengt.get(z.nr) ?? [];
    const herkunft = `Aus ${system} übernommen am ${fmtDate(heute)}${z.quellAz ? ` (Aktenzeichen im Altsystem: ${z.quellAz})` : ""}.${dazu.length ? ` Zusammengeführt mit ${dazu.map((d) => `Zeile ${d.nr}${d.quellAz ? ` (Az. ${d.quellAz})` : ""}`).join(", ")} – Dublette in der Datei.` : ""}`;
    if (z.dublette && aktionFuer(z) === "overwrite") {
      const ex = st().data.akten.find((a) => a.id === z.dublette!.akteId);
      if (ex) {
        undo.vorher.push({ col: "akten", doc: structuredClone(ex) });
        // vorherigen Stand sichern, bevor die Bestandsakte überschrieben wird
        opts.onZwischenstand?.(e);
        const upd: Partial<Akte> = {
          titel: z.titel || ex.titel,
          sachgebiet: z.sachgebietRoh ? z.sachgebiet : ex.sachgebiet,
          gegenstandswert: z.gegenstandswert || ex.gegenstandswert,
          mandantId: mandantId ?? ex.mandantId,
          gegnerId: gegnerId ?? ex.gegnerId,
          beschreibung: `${ex.beschreibung}\n\n${herkunft} Vorhandene Akte mit den Daten des Altsystems aktualisiert.`.trim(),
          updatedAt: nowLocal(),
        };
        st().patch("akten", ex.id, upd);
        akteFuer.set(z.nr, { ...ex, ...upd });
        e.aktenAktualisiert++;
      }
    } else {
      const { az, umbenannt } = freiesAz(z.quellAz);
      if (umbenannt) e.aktenUmbenannt++;
      const mId = mandantId ?? (() => {
        const k = neuerKontakt(z.titel.split(" ./. ")[0] || "Mandant (aus Altsystem)", "mandant", system, laufId);
        st().upsert("kontakte", k);
        undo.erstellt.push({ col: "kontakte", id: k.id });
        e.kontakteNeu++;
        return k.id;
      })();
      const abgeschlossen = z.status === "abgeschlossen";
      if (abgeschlossen) e.archiviert++;
      const akte: Akte = {
        id: uid("a"),
        aktenzeichen: az,
        titel: z.titel,
        sachgebiet: z.sachgebiet,
        phase: abgeschlossen ? "Abgeschlossen" : "Außergerichtlich",
        status: z.status,
        // Ohne Abschlussdatum im Export: Aufbewahrung vorsorglich ab Übernahme (§ 50 Abs. 1 BRAO) – gekennzeichnet, damit der
        // Kopf nicht „Abgeschlossen am <Übernahmetag>“ behauptet (I3-T11-01)
        ...(abgeschlossen ? { abgeschlossenAm: z.abgeschlossenAm ?? heute, ...(z.abgeschlossenAm ? {} : { abschlussdatumUnbekannt: true }) } : {}),
        umzugLaufId: laufId,
        mandantId: mId,
        gegnerId,
        gegenstandswert: z.gegenstandswert,
        bearbeiterId: anwalt.id,
        sachbearbeiterId: refa?.id,
        beschreibung:
          herkunft +
          (umbenannt ? ` Aktenzeichen war bereits vergeben und wurde zu ${az} ergänzt.` : "") +
          (abgeschlossen ? ` Im Altsystem „${z.statusRoh}“ – als abgeschlossen (Archiv) übernommen${z.abgeschlossenAm ? "" : "; Abschlussdatum nicht übertragen, Aufbewahrung (§ 50 BRAO) vorsorglich ab Übernahme vorgemerkt"}.` : ""),
        schlagworte: ["Umzug", system],
        prioritaet: "normal",
        createdAt: z.angelegt ? `${z.angelegt}T09:00:00` : nowLocal(),
        updatedAt: nowLocal(),
      };
      st().upsert("akten", akte);
      undo.erstellt.push({ col: "akten", id: akte.id });
      akteFuer.set(z.nr, akte);
      e.aktenNeu++;
    }
    onFortschritt("akten", { done: i + 1, total: aTotal });
    await pause(aPause);
  }

  opts.onZwischenstand?.(e);

  // 3 · Fristen – Quelle „migration", ohne Kontrollvermerk: zur Vier-Augen-Kontrolle vorgelegt.
  // Zusammengeführte Dubletten bringen ihre Frist nur mit, wenn sie abweicht – nie doppelt.
  const mitFrist = zuImportieren
    .filter((z) => akteFuer.has(z.nr))
    .flatMap((z) => [z, ...(angehaengt.get(z.nr) ?? []).map((d) => ({ ...d, nr: z.nr }))])
    .filter((z) => z.fristDatum);
  onFortschritt("fristen", { done: 0, total: mitFrist.length });
  const fPause = Math.max(20, Math.min(80, 900 / Math.max(1, mitFrist.length)));
  for (let i = 0; i < mitFrist.length; i++) {
    const z = mitFrist[i];
    const akte = akteFuer.get(z.nr)!;
    const titel = z.fristTitel || "Frist aus Altsystem";
    const schonDa = st().data.fristen.some((f) => f.akteId === akte.id && f.datum === z.fristDatum && normName(f.titel) === normName(titel));
    if (!schonDa) {
      const echteFrist = z.fristTyp === "notfrist" || z.fristTyp === "frist";
      const grundlage = grundlageAus(z.fristTitel);
      const frist: Frist = {
        id: uid("f"),
        akteId: akte.id,
        titel,
        typ: z.fristTyp,
        datum: z.fristDatum!,
        vorfrist: echteFrist ? vorfristFuer(z.fristDatum!, bundesland, heute) : undefined,
        ...(grundlage ? { grundlage } : {}),
        status: "offen",
        verantwortlichId: akte.bearbeiterId,
        quelle: "migration",
        umzugLaufId: laufId,
        notiz: [
          echteFrist ? `Aus ${system} übernommen – Datum laut Altsystem, nicht nachgerechnet. Bitte im Vier-Augen-Prinzip prüfen und mit dem Fristenrechner nachrechnen.` : `Aus ${system} übernommen (${z.fristTyp === "termin" ? "Termin" : "Wiedervorlage"}).`,
          z.fristWarnung,
        ].filter(Boolean).join(" "),
        createdAt: nowLocal(),
      };
      st().upsert("fristen", frist);
      undo.erstellt.push({ col: "fristen", id: frist.id });
      e.fristen++;
      if (echteFrist) e.fristenKontrolle++;
    }
    onFortschritt("fristen", { done: i + 1, total: mitFrist.length });
    await pause(fPause);
  }

  opts.onZwischenstand?.(e);

  // 4 · Datenblatt je Akte mit allen Originalwerten
  const akten = zuImportieren.filter((z) => akteFuer.has(z.nr));
  onFortschritt("dokumente", { done: 0, total: akten.length });
  const dPause = Math.max(14, Math.min(50, 700 / Math.max(1, akten.length)));
  for (let i = 0; i < akten.length; i++) {
    const z = akten[i];
    const akte = akteFuer.get(z.nr)!;
    const dazu = angehaengt.get(z.nr) ?? [];
    const inhalt = [
      `Datenblatt aus ${system} (Zeile ${z.nr} des Exports)`,
      "",
      ...z.roh.map(([k, v]) => `${k}: ${v || "–"}`),
      ...dazu.flatMap((d) => ["", `Zusammengeführt: Zeile ${d.nr} des Exports (Dublette)`, ...d.roh.map(([k, v]) => `${k}: ${v || "–"}`)]),
    ].join("\n");
    const dok: Dokument = {
      id: uid("d"),
      akteId: akte.id,
      name: `Datenblatt ${system}${z.quellAz ? ` – Az. ${z.quellAz}` : ""}`,
      art: "notiz",
      ordner: "Anlagen",
      format: "txt",
      groesseKb: Math.max(1, Math.round(inhalt.length / 1024)),
      inhalt,
      quelle: "migration",
      autorId: user.id,
      version: 1,
      createdAt: nowLocal(),
      umzugLaufId: laufId,
    };
    st().upsert("dokumente", dok);
    undo.erstellt.push({ col: "dokumente", id: dok.id });
    e.dokumente++;
    // Verlaufseintrag in der Akte (als Handlung der Person, die den Umzug gestartet hat)
    const verlauf: Aktivitaet = {
      id: uid("ak"),
      zeit: nowLocal(),
      akteur: "nutzer",
      userId: user.id,
      akteId: akte.id,
      text: z.dublette && aktionFuer(z) === "overwrite" ? `Akte mit Daten aus ${system} aktualisiert` : `Akte aus ${system} übernommen${z.quellAz ? ` (Az. im Altsystem: ${z.quellAz})` : ""}`,
    };
    st().upsert("aktivitaeten", verlauf);
    undo.erstellt.push({ col: "aktivitaeten", id: verlauf.id });
    onFortschritt("dokumente", { done: i + 1, total: akten.length });
    await pause(dPause);
  }

  st().log({
    akteur: "system",
    userId: user.id,
    text: `Umzug aus ${system}: ${e.aktenNeu} Akten neu${e.archiviert ? ` (davon ${e.archiviert} als abgeschlossen)` : ""}, ${e.aktenAktualisiert} aktualisiert, ${e.kontakteNeu} Kontakte, ${e.fristenKontrolle} Fristen zur Kontrolle vorgelegt${e.fristen > e.fristenKontrolle ? `, ${e.fristen - e.fristenKontrolle} ${e.fristen - e.fristenKontrolle === 1 ? "Wiedervorlage/Termin" : "Wiedervorlagen/Termine"}` : ""}${e.zusammengefuehrt ? `, ${e.zusammengefuehrt} ${e.zusammengefuehrt === 1 ? "Dublette" : "Dubletten"} der Datei zusammengeführt` : ""}`,
  });
  return e;
}

/**
 * Macht einen Umzug vollständig rückgängig: neu angelegte Datensätze entfernen (auch alles mit der `umzugLaufId` des Laufs und
 * später in diesen Akten angelegte Fristen, Dokumente und Notizen), geänderte Akten und Kontakte wiederherstellen.
 */
export function macheRueckgaengig(undo: UndoInfo, system: string, userId: string, laufId?: string) {
  const st = useData.getState();
  const data = st.data;
  const neueAkten = new Set(undo.erstellt.filter((x) => x.col === "akten").map((x) => x.id));
  if (laufId) for (const a of data.akten) if (a.umzugLaufId === laufId) neueAkten.add(a.id);
  const weg: { col: CollectionKey; id: string }[] = [...undo.erstellt];
  if (laufId) {
    for (const k of data.kontakte) if (k.umzugLaufId === laufId) weg.push({ col: "kontakte", id: k.id });
    for (const a of data.akten) if (a.umzugLaufId === laufId) weg.push({ col: "akten", id: a.id });
  }
  for (const f of data.fristen) if (neueAkten.has(f.akteId) || (laufId && f.umzugLaufId === laufId)) weg.push({ col: "fristen", id: f.id });
  for (const d of data.dokumente) if (neueAkten.has(d.akteId) || (laufId && d.umzugLaufId === laufId)) weg.push({ col: "dokumente", id: d.id });
  for (const n of data.notizen) if (neueAkten.has(n.akteId)) weg.push({ col: "notizen", id: n.id });
  const gesehen = new Set<string>();
  for (const { col, id } of [...weg].reverse()) {
    const key = `${col}:${id}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    if ((data[col] as { id: string }[]).some((x) => x.id === id)) st.remove(col, id);
  }
  // rückwärts, damit bei mehrfach geänderten Akten der ursprüngliche Stand zuletzt geschrieben wird
  for (const { col, doc } of [...undo.vorher].reverse()) {
    if (col === "akten") st.upsert("akten", doc as Akte);
    else st.upsert("kontakte", doc as Kontakt);
  }
  st.log({ akteur: "nutzer", userId, text: `Umzug aus ${system} rückgängig gemacht` });
}

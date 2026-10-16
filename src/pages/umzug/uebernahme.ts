// Führt die Übernahme aus: Kontakte (zusammengeführt), Akten, Fristen (zur Vier-Augen-Kontrolle) und Dokument-Verweise.
// Jede Änderung wird für „Umzug rückgängig machen" vorgemerkt.
import type { Akte, Aktivitaet, Bundesland, CollectionKey, Dokument, Frist, Kontakt, User } from "@/core/types";
import { addDays, fmtDate, nowLocal, today, uid } from "@/core/dates";
import { istWerktag } from "@/core/feiertage";
import { useData } from "@/store/data";
import { ORG, grundlageAus, normName, type DublettenAktion, type MigZeile } from "./zuordnung";

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
  undo: UndoInfo;
}

function neuerKontakt(name: string, rolle: "mandant" | "gegner", system: string): Kontakt {
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

export async function fuehreUmzugAus(opts: {
  zeilen: MigZeile[];
  aktionFuer: (z: MigZeile) => DublettenAktion;
  system: string;
  user: User;
  team: User[];
  bundesland: Bundesland;
  onFortschritt: (e: Entitaet, f: Fortschritt) => void;
}): Promise<Ergebnis> {
  const { zeilen, aktionFuer, system, user, team, bundesland, onFortschritt } = opts;
  const st = () => useData.getState();
  const undo: UndoInfo = { erstellt: [], vorher: [] };
  const e: Ergebnis = { kontakteNeu: 0, kontakteZusammengefuehrt: 0, aktenNeu: 0, aktenAktualisiert: 0, aktenUmbenannt: 0, uebersprungen: 0, fehlerhaft: 0, fristen: 0, fristenKontrolle: 0, dokumente: 0, undo };

  const anwalt = user.rolle === "partner" || user.rolle === "anwalt" ? user : team.find((u) => u.rolle === "partner" || u.rolle === "anwalt") ?? user;
  const refa = team.find((u) => u.rolle === "refa");

  const zuImportieren = zeilen.filter((z) => {
    if (z.fehler) {
      e.fehlerhaft++;
      return false;
    }
    if (z.dublette && aktionFuer(z) === "skip") {
      e.uebersprungen++;
      return false;
    }
    return true;
  });

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
        st().patch("kontakte", ex.id, { rollen: [...ex.rollen, ...fehlend] });
      }
      kontaktId.set(key, ex.id);
      e.kontakteZusammengefuehrt++;
    } else {
      const rolle = rollen.has("mandant") ? "mandant" : "gegner";
      const k = neuerKontakt(name, rolle, system);
      if (rollen.size > 1) k.rollen = ["mandant", "gegner"];
      st().upsert("kontakte", k);
      undo.erstellt.push({ col: "kontakte", id: k.id });
      kontaktId.set(key, k.id);
      e.kontakteNeu++;
    }
    onFortschritt("kontakte", { done: ++kDone, total: kTotal });
    await pause(kPause);
  }

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
    const herkunft = `Aus ${system} übernommen am ${fmtDate(heute)}${z.quellAz ? ` (Aktenzeichen im Altsystem: ${z.quellAz})` : ""}.`;
    if (z.dublette && aktionFuer(z) === "overwrite") {
      const ex = st().data.akten.find((a) => a.id === z.dublette!.akteId);
      if (ex) {
        undo.vorher.push({ col: "akten", doc: structuredClone(ex) });
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
        const k = neuerKontakt(z.titel.split(" ./. ")[0] || "Mandant (aus Altsystem)", "mandant", system);
        st().upsert("kontakte", k);
        undo.erstellt.push({ col: "kontakte", id: k.id });
        e.kontakteNeu++;
        return k.id;
      })();
      const akte: Akte = {
        id: uid("a"),
        aktenzeichen: az,
        titel: z.titel,
        sachgebiet: z.sachgebiet,
        phase: "Außergerichtlich",
        status: "offen",
        mandantId: mId,
        gegnerId,
        gegenstandswert: z.gegenstandswert,
        bearbeiterId: anwalt.id,
        sachbearbeiterId: refa?.id,
        beschreibung: herkunft + (umbenannt ? ` Aktenzeichen war bereits vergeben und wurde zu ${az} ergänzt.` : ""),
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

  // 3 · Fristen – Quelle „migration", ohne Kontrollvermerk: zur Vier-Augen-Kontrolle vorgelegt
  const mitFrist = zuImportieren.filter((z) => z.fristDatum && akteFuer.has(z.nr));
  onFortschritt("fristen", { done: 0, total: mitFrist.length });
  const fPause = Math.max(20, Math.min(80, 900 / Math.max(1, mitFrist.length)));
  for (let i = 0; i < mitFrist.length; i++) {
    const z = mitFrist[i];
    const akte = akteFuer.get(z.nr)!;
    const titel = z.fristTitel || "Frist aus Altsystem";
    const schonDa = st().data.fristen.some((f) => f.akteId === akte.id && f.datum === z.fristDatum && f.titel === titel);
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

  // 4 · Dokument-Verweise: Datenblatt je Akte mit allen Originalwerten
  const akten = zuImportieren.filter((z) => akteFuer.has(z.nr));
  onFortschritt("dokumente", { done: 0, total: akten.length });
  const dPause = Math.max(14, Math.min(50, 700 / Math.max(1, akten.length)));
  for (let i = 0; i < akten.length; i++) {
    const z = akten[i];
    const akte = akteFuer.get(z.nr)!;
    const inhalt = [`Datenblatt aus ${system} (Zeile ${z.nr} des Exports)`, "", ...z.roh.map(([k, v]) => `${k}: ${v || "–"}`)].join("\n");
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
    text: `Umzug aus ${system}: ${e.aktenNeu} Akten neu, ${e.aktenAktualisiert} aktualisiert, ${e.kontakteNeu} Kontakte, ${e.fristenKontrolle} Fristen zur Kontrolle vorgelegt${e.fristen > e.fristenKontrolle ? `, ${e.fristen - e.fristenKontrolle} Wiedervorlagen/Termine` : ""}`,
  });
  return e;
}

/** Macht einen Umzug vollständig rückgängig: neu angelegte Datensätze entfernen, geänderte wiederherstellen. */
export function macheRueckgaengig(undo: UndoInfo, system: string, userId: string) {
  const st = useData.getState();
  for (const { col, id } of [...undo.erstellt].reverse()) st.remove(col, id);
  // rückwärts, damit bei mehrfach geänderten Akten der ursprüngliche Stand zuletzt geschrieben wird
  for (const { col, doc } of [...undo.vorher].reverse()) {
    if (col === "akten") st.upsert("akten", doc as Akte);
    else st.upsert("kontakte", doc as Kontakt);
  }
  st.log({ akteur: "nutzer", userId, text: `Umzug aus ${system} rückgängig gemacht` });
}

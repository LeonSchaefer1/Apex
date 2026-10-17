// Mindestschema für gespeicherte Kanzleidokumente – der Server weist fehlerhafte Dokumente ab (400) und überspringt beim Laden
// beschädigte Altbestände, statt die ganze Kanzlei mit einem Fehler zu blockieren. Bewusst nur Pflichtfelder: Die Oberfläche
// darf neue optionale Felder ergänzen, ohne dass der Server angepasst werden muss. Optionale Felder mit fester Form (Freigabestatus,
// Portalfreigabe, Fristkorrekturen, Bankvorschläge) werden nur geprüft, wenn sie vorhanden sind – Altbestände ohne sie bleiben gültig.
import type { Bundesland, CollectionKey } from "@/core/types";

type Art = "text" | "zahl" | "wahr" | "liste" | "datum" | "zeit" | "objekt";

const PFLICHT: Record<CollectionKey, [string, Art][]> = {
  kontakte: [["name", "text"], ["typ", "text"]],
  akten: [["aktenzeichen", "text"], ["titel", "text"], ["status", "text"]],
  fristen: [["akteId", "text"], ["titel", "text"], ["datum", "datum"], ["status", "text"]],
  dokumente: [["akteId", "text"], ["name", "text"]],
  nachrichten: [["betreff", "text"], ["eingang", "zeit"], ["status", "text"]],
  rechnungen: [["nummer", "text"], ["datum", "datum"], ["positionen", "liste"]],
  buchungen: [["datum", "datum"], ["betrag", "zahl"]],
  transaktionen: [["datum", "datum"], ["betrag", "zahl"]],
  zeiten: [["datum", "datum"], ["minuten", "zahl"]],
  automationen: [["key", "text"], ["name", "text"], ["aktiv", "wahr"]],
  aktivitaeten: [["zeit", "zeit"], ["text", "text"], ["akteur", "text"]],
  notizen: [["text", "text"], ["zeit", "zeit"]],
  umzugLaeufe: [["datum", "zeit"], ["system", "text"], ["undo", "objekt"]],
};

/** Optionale Felder: fehlen darf, vorhanden muss die Form stimmen (Text-Auswahl als Liste erlaubter Werte). */
const OPTIONAL: Partial<Record<CollectionKey, [string, Art | readonly string[]][]>> = {
  akten: [["abschlussdatumUnbekannt", "wahr"]],
  dokumente: [["status", ["entwurf", "freigegeben", "versandt"]], ["portal", "objekt"]],
  fristen: [["erledigtNachweis", "objekt"], ["korrekturAngefordert", "objekt"], ["korrekturen", "liste"], ["gerichtsort", "objekt"]],
  transaktionen: [["vorschlag", "objekt"], ["abgelehnt", "liste"], ["zuordnung", "objekt"], ["konto", ["geschaeft", "ander"]]],
  aktivitaeten: [["quelle", ["anbieter"]], ["anbieterPerson", "text"]],
  automationen: [["pausiertAm", "zeit"], ["pausiertVon", "text"]],
  umzugLaeufe: [["abgebrochen", "wahr"]],
};

/** Bundesländer (Kürzel) – für den Gerichtsort einer Frist. */
const LAENDER: readonly Bundesland[] = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"];
/** Herkunft des Gerichtsorts einer Frist (Frist.gerichtsort.quelle). */
const GERICHTSORT_QUELLEN = ["gericht", "akte", "kanzleisitz", "hand"];
/** Buchungsart einer Bankzuordnung (Transaktion.zuordnung.art). */
const ZUORDNUNG_ARTEN = ["rechnung", "vorschuss", "fremdgeld", "kosten"];

/** Erlaubte Nachweisarten der Ausgangskontrolle (Frist.erledigtNachweis.art). */
const NACHWEIS_ARTEN = ["bea", "fax", "bote", "post", "persoenlich", "ueberweisung", "gestrichen", "sonstiges"];

function passt(v: unknown, art: Art): boolean {
  switch (art) {
    case "text":
      return typeof v === "string";
    case "zahl":
      return typeof v === "number" && Number.isFinite(v);
    case "wahr":
      return typeof v === "boolean";
    case "liste":
      return Array.isArray(v);
    case "datum":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
    case "zeit":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
    case "objekt":
      return !!v && typeof v === "object" && !Array.isArray(v);
  }
}

/** `null`, wenn das Dokument die Pflichtfelder seiner Sammlung erfüllt – sonst ein Hinweis für die Fehlermeldung. */
export function pruefeDokument(col: CollectionKey, doc: unknown): string | null {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "Das Dokument ist kein Objekt.";
  const d = doc as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id || d.id.length > 200) return "Die Kennung (id) fehlt oder ist ungültig.";
  const regeln = PFLICHT[col];
  if (!regeln) return "Unbekannte Sammlung.";
  for (const [feld, art] of regeln) {
    if (!passt(d[feld], art)) return `Pflichtfeld „${feld}“ fehlt oder hat ein ungültiges Format.`;
  }
  for (const [feld, art] of OPTIONAL[col] ?? []) {
    const v = d[feld];
    if (v === undefined || v === null) continue;
    const ok = typeof art === "string" ? passt(v, art) : typeof v === "string" && art.includes(v);
    if (!ok) return `Feld „${feld}“ hat ein ungültiges Format.`;
  }
  if (col === "fristen" && d.erledigtNachweis) {
    const n = d.erledigtNachweis as Record<string, unknown>;
    if (n.art !== undefined && (typeof n.art !== "string" || !NACHWEIS_ARTEN.includes(n.art))) return "Feld „erledigtNachweis.art“ hat einen unbekannten Wert.";
    if (n.versandAm !== undefined && !passt(n.versandAm, "zeit")) return "Feld „erledigtNachweis.versandAm“ ist keine Zeitangabe.";
  }
  if (col === "fristen" && d.gerichtsort) {
    const g = d.gerichtsort as Record<string, unknown>;
    if (typeof g.land !== "string" || !(LAENDER as readonly string[]).includes(g.land)) return "Feld „gerichtsort.land“ braucht ein Bundesland-Kürzel (z. B. NW).";
    if (g.gericht !== undefined && (typeof g.gericht !== "string" || g.gericht.length > 300)) return "Feld „gerichtsort.gericht“ ist kein gültiger Text.";
    if (typeof g.quelle !== "string" || !GERICHTSORT_QUELLEN.includes(g.quelle)) return "Feld „gerichtsort.quelle“ hat einen unbekannten Wert.";
  }
  if (col === "transaktionen" && d.zuordnung) {
    const z = d.zuordnung as Record<string, unknown>;
    if (z.art !== undefined && (typeof z.art !== "string" || !ZUORDNUNG_ARTEN.includes(z.art))) return "Feld „zuordnung.art“ hat einen unbekannten Wert.";
  }
  if (col === "aktivitaeten" && typeof d.anbieterPerson === "string" && d.anbieterPerson.length > 200) return "Feld „anbieterPerson“ ist zu lang.";
  if (col === "dokumente" && d.portal) {
    const p = d.portal as Record<string, unknown>;
    if (!passt(p.am, "zeit") || typeof p.vonId !== "string") return "Feld „portal“ braucht Zeitpunkt (am) und Person (vonId).";
  }
  return null;
}

// Mindestschema für gespeicherte Kanzleidokumente – der Server weist fehlerhafte Dokumente ab (400) und überspringt beim Laden
// beschädigte Altbestände, statt die ganze Kanzlei mit einem Fehler zu blockieren. Bewusst nur Pflichtfelder: Die Oberfläche
// darf neue optionale Felder ergänzen, ohne dass der Server angepasst werden muss.
import type { CollectionKey } from "@/core/types";

type Art = "text" | "zahl" | "wahr" | "liste" | "datum" | "zeit";

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
};

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
  return null;
}

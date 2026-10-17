// Papier-Dimmung im Dunkelmodus (I4-T06-01): Jedes `.paper` (E-Akte-Vorschau, Schriftsatz, Rechnungsvorschau, KI-Entwurf) ist im
// Dunkelmodus leicht abgedunkelt – außer die Nutzerin wählt „Original“. Die Wahl gilt gemeinsam für alle Vorschauen, wird je Gerät
// gemerkt (gleicher Schlüssel wie bisher in der E-Akte) und über `html[data-papier="original"]` an das CSS gegeben. Druck immer im Original.
import { useSyncExternalStore } from "react";
import { useDunkelModus } from "@/lib/useDunkelModus";
import { Segmented } from "./Segmented";

const SCHLUESSEL = "apex.dokumentvorschau.abdunkeln";

function ladeGedimmt(): boolean {
  try {
    return localStorage.getItem(SCHLUESSEL) !== "aus";
  } catch {
    return true;
  }
}

let gedimmt = ladeGedimmt();
const hoerer = new Set<() => void>();

function attributSetzen(v: boolean) {
  try {
    const root = document.documentElement;
    if (v) root.removeAttribute("data-papier");
    else root.setAttribute("data-papier", "original");
  } catch {
    /* ohne DOM (Tests) */
  }
}

// Beim Laden der App sofort anwenden – auch Seiten ohne Schalter zeigen das Papier dann wie zuletzt gewählt.
if (typeof document !== "undefined") attributSetzen(gedimmt);
if (typeof window !== "undefined") {
  // Wahl in einem anderen Fenster derselben App übernehmen
  window.addEventListener("storage", (e) => {
    if (e.key !== SCHLUESSEL) return;
    const neu = ladeGedimmt();
    if (neu === gedimmt) return;
    gedimmt = neu;
    attributSetzen(neu);
    hoerer.forEach((h) => h());
  });
}

function setzeGedimmt(v: boolean) {
  gedimmt = v;
  try {
    localStorage.setItem(SCHLUESSEL, v ? "an" : "aus");
  } catch {
    /* ohne Speicher: Wahl gilt bis zum Neuladen */
  }
  attributSetzen(v);
  hoerer.forEach((h) => h());
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/**
 * Papier im Dunkelmodus abdunkeln? `[gedimmt, setGedimmt]` – Standard „an“, gemeinsam für alle offenen Vorschauen.
 * Wirkt nur im Dunkelmodus; im Hellmodus bleibt das Papier immer im Original.
 */
export function usePapierGedimmt(): [boolean, (v: boolean) => void] {
  const wert = useSyncExternalStore(abonnieren, () => gedimmt, () => true);
  return [wert, setzeGedimmt];
}

/** Umschalter „Seite abdunkeln · Original“ – nur im Dunkelmodus sichtbar (im Hellmodus gibt es nichts umzuschalten). */
export function PapierSchalter({ className }: { className?: string }) {
  const dunkel = useDunkelModus();
  const [an, setAn] = usePapierGedimmt();
  if (!dunkel) return null;
  return (
    <Segmented
      size="sm"
      className={className}
      value={an ? "an" : "aus"}
      onChange={(v) => setAn(v === "an")}
      options={[
        { value: "an", label: "Seite abdunkeln" },
        { value: "aus", label: "Original" },
      ]}
    />
  );
}

export { useDunkelModus };

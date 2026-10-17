// „Rückgängig“ nach einer ersten Zuordnung (Akte zuordnen, auch per Taste U – I5-T22-01): Die Nachricht ist wieder
// ohne Akte, die dabei in der E-Akte abgelegten Dokumente (Nachricht und Anhänge) werden entfernt – protokolliert.
// Nur für die erste Zuordnung; ein Umhängen (vorherige Akte) nimmt man durch erneutes Umhängen zurück.
import type { Nachricht, User } from "@/core/types";
import { useData } from "@/store/data";
import { dokumenteAusNachricht, fristenAusNachricht } from "./analyse";

/** Stand vor der Zuordnung festhalten und eine Rücknahme liefern (false, wenn sich der Datenstand inzwischen geändert hat). */
export function merkeVorZuordnung(n: Nachricht, user: User): () => boolean {
  const st = useData.getState();
  const vorher = st.data.nachrichten.find((x) => x.id === n.id) ?? n;
  const stand = { akteId: vorher.akteId, zugeordnet: vorher.zugeordnet, kiStatus: vorher.kiStatus };
  const dokVorher = new Set(dokumenteAusNachricht(n, st.data.dokumente).map((d) => d.id));
  const epoch = st.epoch;
  return () => {
    const s = useData.getState();
    if (s.epoch !== epoch) return false;
    const aktuell = s.data.nachrichten.find((x) => x.id === n.id);
    if (!aktuell || !aktuell.akteId || aktuell.akteId === stand.akteId) return false;
    // Nach der eEB-Abgabe oder mit inzwischen notierten Fristen aus der Nachricht nicht mehr still zurücknehmen
    if (aktuell.eebAbgegeben || fristenAusNachricht(n, aktuell.akteId, s.data.fristen).haupt.length > 0) return false;
    const akteId = aktuell.akteId;
    const az = s.data.akten.find((a) => a.id === akteId)?.aktenzeichen ?? "der Akte";
    const neu = dokumenteAusNachricht(n, s.data.dokumente).filter((d) => !dokVorher.has(d.id));
    neu.forEach((d) => s.remove("dokumente", d.id));
    s.patch("nachrichten", n.id, { akteId: stand.akteId, zugeordnet: stand.zugeordnet, kiStatus: stand.kiStatus });
    s.log({ akteur: "nutzer", userId: user.id, akteId, text: `Zuordnung von „${n.betreff}“ zu ${az} rückgängig gemacht${neu.length ? ` – ${neu.length} ${neu.length === 1 ? "Dokument" : "Dokumente"} aus der E-Akte entfernt` : ""}` });
    return true;
  };
}

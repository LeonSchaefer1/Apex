// Erreichbarkeit der persönlichen Ansprechpartnerin (I4-T11-01): aus der Servicezeit (src/core/rueckruf.ts), nicht fest verdrahtet –
// damit Karte und Apex Assistent dasselbe sagen. Reine Funktion (Test: erreichbarkeit.test.ts).
import type { Bundesland } from "@/core/types";
import { fmtDate, weekday } from "@/core/dates";
import { inServicezeit, naechsteServicezeit } from "@/core/rueckruf";

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

/** „erreichbar“ bzw. „nicht erreichbar – wieder Mo, 19.10. ab 7:30 Uhr“ (heute später: „wieder heute ab 7:30 Uhr“). */
export function erreichbarkeit(jetzt: Date, verfuegbar: string, land?: Bundesland): { erreichbar: boolean; text: string; wieder?: string } {
  if (inServicezeit(jetzt, verfuegbar, land)) return { erreichbar: true, text: "erreichbar" };
  const n = naechsteServicezeit(jetzt, verfuegbar, land);
  const heute = n.text.startsWith("heute");
  const wieder = `${heute ? "heute" : `${WT[weekday(n.datum)]}, ${fmtDate(n.datum).slice(0, 6)}`} ab ${hhmm(n.ab)} Uhr`;
  return { erreichbar: false, text: `nicht erreichbar – wieder ${wieder}`, wieder };
}

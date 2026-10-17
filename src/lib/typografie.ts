// Typografie für Kennzahlen (I5-T00-01): Zahl und Einheit stehen immer zusammen in einer Zeile –
// „26 €/Std.“, „38 Std.“, „48 Arbeitswochen“, „≈ 47.500 €“. fmtEUR liefert bereits ein geschütztes Leerzeichen.
import { schuetzeLeerzeichen } from "@/core/dates";

/** geschütztes Leerzeichen (U+00A0) */
export const NBSP = " ";
/** Wortverbinder (U+2060): verhindert den Umbruch nach „/“ in „€/Std.“ – unsichtbar, auch für Screenreader */
const WJ = "⁠";

/** Einheit mit Schrägstrich unteilbar machen: „€/Std.“, „Std./Woche“. */
function einheitUnteilbar(einheit: string): string {
  return einheit.replace(/\/(?!⁠)/g, `/${WJ}`);
}

/** Zahl und Einheit untrennbar: mitEinheit(26, "€/Std.") → „26 €/Std.“ (mit geschütztem Leerzeichen). */
export function mitEinheit(zahl: string | number, einheit: string): string {
  return `${zahl}${NBSP}${einheitUnteilbar(einheit)}`;
}

/**
 * Kennzahlen in einem Fließtext schützen: Zahl + Einheit (€, %, Std., Min., Tage, Wochen, Arbeitswochen, …),
 * „≈ 47.500 €“, „ca. 26 €/Std.“, „Ø 38 Std.“ – und „€/Std.“, „Std./Woche“ ohne Umbruch nach dem Schrägstrich.
 */
export function schuetzeKennzahlen(text: string): string {
  return schuetzeLeerzeichen(text)
    .replace(/(≈|ca\.|Ø|rund) (?=\d)/g, `$1${NBSP}`)
    .replace(/(\d) (?=(?:Arbeitswochen|Arbeitstage|Arbeitsplätze|Vollzeitstellen|Jahresarbeitsstunden|Stunden|Minuten|Sekunden)\b)/g, `$1${NBSP}`)
    .replace(/(€|Std\.)\/(?=\S)(?!⁠)/g, `$1/${WJ}`);
}

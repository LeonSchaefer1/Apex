// Robuster CSV-Leser für Exporte aus Kanzlei-Altsystemen und Excel:
// Trennzeichen ; , oder Tab (automatisch erkannt, auch „sep=;"-Kopfzeile), Anführungszeichen mit "" als Escape,
// Zeilenumbrüche in Feldern, CRLF/LF/CR, UTF-8 mit/ohne BOM und Windows-1252 (ANSI) als Rückfall.

export type Trennzeichen = ";" | "," | "\t";

export interface CsvErgebnis {
  kopf: string[];
  zeilen: string[][];
  trennzeichen: Trennzeichen;
  bom: boolean;
}

export interface DateiInfo {
  name: string;
  groesse: number;
  kodierung: "UTF-8" | "Windows-1252";
  beispiel: boolean;
}

export const TRENNZEICHEN_NAME: Record<Trennzeichen, string> = { ";": "Semikolon", ",": "Komma", "\t": "Tabulator" };

function erkenneTrennzeichen(text: string): Trennzeichen {
  const zaehler: Record<Trennzeichen, number> = { ";": 0, ",": 0, "\t": 0 };
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    else if (!inQ && (c === "\n" || c === "\r")) break;
    else if (!inQ && (c === ";" || c === "," || c === "\t")) zaehler[c]++;
  }
  const best = (Object.entries(zaehler) as [Trennzeichen, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ";";
}

export function parseCsv(input: string): CsvErgebnis {
  let text = input;
  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) text = text.slice(1);

  // Excel-Hinweiszeile „sep=;"
  let trenn: Trennzeichen | null = null;
  const sep = /^sep=(.)\r?\n/i.exec(text);
  if (sep && (sep[1] === ";" || sep[1] === "," || sep[1] === "\t")) {
    trenn = sep[1] as Trennzeichen;
    text = text.slice(sep[0].length);
  }
  const t = trenn ?? erkenneTrennzeichen(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  let warQuoted = false;
  const feldEnde = () => {
    row.push(warQuoted ? field : field.trim());
    field = "";
    warQuoted = false;
  };
  const zeileEnde = () => {
    feldEnde();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field.trim() === "") {
      q = true;
      warQuoted = true;
      field = "";
    } else if (c === t) feldEnde();
    else if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      zeileEnde();
    } else if (c === "\n") zeileEnde();
    else field += c;
  }
  if (field !== "" || row.length > 0 || warQuoted) zeileEnde();

  const sauber = rows.filter((r) => r.some((f) => f.trim() !== ""));
  const roherKopf = sauber[0] ?? [];
  const breite = Math.max(roherKopf.length, ...sauber.slice(1).map((r) => r.length), 0);
  const kopf = Array.from({ length: breite }, (_, i) => roherKopf[i]?.trim() || `Spalte ${i + 1}`);
  const zeilen = sauber.slice(1).map((r) => Array.from({ length: breite }, (_, i) => (r[i] ?? "").trim()));
  return { kopf, zeilen, trennzeichen: t, bom };
}

export const MAX_DATEI_MB = 15;

/** Liest eine Datei als Text: zuerst streng UTF-8, sonst Windows-1252 (typisch für ältere Windows-Exporte). */
export async function leseDatei(file: File): Promise<{ text: string; kodierung: DateiInfo["kodierung"] }> {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xls|xlsm|ods)$/.test(name)) {
    throw new Error("Excel-Arbeitsmappen bitte zuerst in Excel über „Speichern unter → CSV (Trennzeichen-getrennt)“ als CSV speichern und dann hier hochladen.");
  }
  if (file.size > MAX_DATEI_MB * 1024 * 1024) throw new Error(`Die Datei ist größer als ${MAX_DATEI_MB} MB. Bitte teilen Sie den Export auf – oder Ihr Ansprechpartner übernimmt ihn für Sie.`);
  const buf = await file.arrayBuffer();
  try {
    // ignoreBOM: true behält ein BOM im Text – parseCsv erkennt und entfernt es
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
    return { text, kodierung: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(buf), kodierung: "Windows-1252" };
  }
}

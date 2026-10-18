// Kanzleiprotokoll: echte Vorgänge rund um Zugänge und Datenbestand – gleiche Texte im Demo-Backend und auf dem Server.
// Diese Einträge liegen getrennt von den (ggf. täglich neu erzeugten) Beispieldaten und werden beim Laden eingemischt,
// damit Anmeldungen, Passwortvergaben und Anbieter-Eingriffe nie verloren gehen.
import type { Aktivitaet, ID } from "@/core/types";
import { folgeBeimPausieren } from "../../core/automationen";

/** Zeitstempel in deutscher Ortszeit („2026-10-16T09:30:00“) – wie die übrigen Aktivitäten, auch auf einem Server in UTC. */
export function zeitBerlin(d = new Date()): string {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${teile.year}-${teile.month}-${teile.day}T${teile.hour}:${teile.minute}:${teile.second}`;
}

/** Angaben zu einem neuen Startpasswort über die Apex Console – Pflicht: wer hat es angefordert, aus welchem Anlass. */
export interface ConsolePasswortAnlass {
  /** Person in der Kanzlei, die das neue Passwort angefordert hat (Name). */
  angefordertVon: string;
  /** Anlass, z. B. „Passwort vergessen – telefonisch angefordert“. */
  anlass: string;
  /** Bearbeitende Person bei Apex (z. B. „Lena Vogt“); ohne Angabe der angemeldete Console-Zugang. */
  bearbeiter?: string;
}

/** Prüft die Pflichtangaben für ein neues Startpasswort – Meldung je Feld (leer = vollständig). Gleiche Regel in Oberfläche, Demo und Server. */
export function pruefeConsolePasswortAnlass(a: Partial<ConsolePasswortAnlass> | undefined): Partial<Record<"angefordertVon" | "anlass", string>> {
  const f: Partial<Record<"angefordertVon" | "anlass", string>> = {};
  const wer = (a?.angefordertVon ?? "").trim();
  const warum = (a?.anlass ?? "").trim();
  if (wer.length < 2) f.angefordertVon = "Bitte angeben, wer in der Kanzlei das neue Passwort angefordert hat (Name).";
  else if (wer.length > 120) f.angefordertVon = "Bitte höchstens 120 Zeichen.";
  if (warum.length < 4) f.anlass = "Bitte den Anlass angeben, z. B. „Passwort vergessen – telefonisch angefordert“.";
  else if (warum.length > 200) f.anlass = "Bitte höchstens 200 Zeichen.";
  return f;
}

export const VORGANG = {
  zugangAngelegt: (name: string, rolle: string) => `Zugang für ${name} angelegt (${rolle}) – durch Apex`,
  startpasswortVergeben: (name: string) => `Startpasswort für ${name} vergeben – eigenes Passwort bei der ersten Anmeldung Pflicht`,
  ersteAnmeldung: (name: string) => `Erste Anmeldung von ${name}`,
  eigenesPasswort: (name: string) => `Eigenes Passwort festgelegt – ${name}`,
  /** „Startpasswort für Mia Becker durch Apex neu vergeben – Lena Vogt auf Anforderung von Dr. Julia Hartmann, Anlass: …“ */
  consolePasswort: (name: string, a?: ConsolePasswortAnlass, consoleName = ANBIETER_TEAM) =>
    a
      ? `Startpasswort für ${name} durch Apex neu vergeben – ${(a.bearbeiter ?? "").trim() || consoleName} auf Anforderung von ${a.angefordertVon.trim()}, Anlass: ${a.anlass.trim()}`
      : `Startpasswort für ${name} durch Apex neu vergeben`,
  eigenesPasswortGeaendert: (name: string) => `Eigenes Passwort geändert – ${name}`,
  rechnungsangabenGeaendert: (felder: string[], durch: string) => `Rechnungsangaben geändert${felder.length ? ` (${felder.join(", ")})` : ""} – durch ${durch}`,
  automatikPausiert: (automatik: string, durch: string, folge: string) => `Automatik „${automatik}“ pausiert – durch ${durch}. ${folge}`,
  automatikEingeschaltet: (automatik: string, durch: string) => `Automatik „${automatik}“ wieder eingeschaltet – durch ${durch}`,
  standardPasswort: (name: string) => `Demo-Passwort für ${name} durch Apex wiederhergestellt`,
  beispieldatenZurueckgesetzt: (durch?: string) => (durch ? `Beispieldaten zurückgesetzt – durch ${durch}` : "Beispieldaten durch Apex zurückgesetzt"),
  zweiFaktorEingerichtet: (name: string) => `Zwei-Faktor-Anmeldung eingerichtet – ${name}`,
  zweiFaktorDeaktiviert: (name: string) => `Zwei-Faktor-Anmeldung deaktiviert – ${name}`,
  zweiFaktorZurueckgesetzt: (name: string, durch: string) => `Zwei-Faktor-Anmeldung von ${name} zurückgesetzt – durch ${durch}`,
  zweiFaktorWiederherstellung: (name: string) => `Anmeldung mit Wiederherstellungscode – ${name}`,
  anmeldung: (name: string) => `Anmeldung – ${name}`,
  abmeldung: (name: string) => `Abmeldung – ${name}`,
  anmeldungFehlgeschlagen: (name: string, grund: FehlGrund) => `Anmeldung fehlgeschlagen (${FEHL_GRUND[grund]}) – ${name}`,
  sperreInaktivitaet: (name: string) => `Sperre wegen Inaktivität – ${name}`,
  fehlversucheWarnung: (name: string, n: number) => `${n} fehlgeschlagene Anmeldungen für ${name} innerhalb von 15 Minuten – bitte prüfen`,
  bundeslandGeaendert: (vorher: string, nachher: string) => `Bundesland geändert: ${vorher} → ${nachher}`,
  /** I5-T23-01: „Zugang von Jonas Brandt deaktiviert – 7 offene Fristen nicht übertragen; Überwachung sichergestellt durch Dr. Julia Hartmann“ */
  fristenNichtUebertragen: (name: string, anzahl: number, durch: string) =>
    `Zugang von ${name} deaktiviert – ${anzahl === 1 ? "1 offene Frist" : `${anzahl} offene Fristen`} nicht übertragen; Überwachung sichergestellt durch ${durch}`,
} as const;

/**
 * Protokolltext beim Schalten einer Automatik im 38h-Motor (I3-T10-01) – mit Person und, beim Pausieren, der Folge:
 * „Automatik „Fristen aus Posteingang erkennen“ pausiert – durch Dr. Julia Hartmann. Neue beA-Nachrichten werden …“
 */
export function automatikSchaltText(a: { key: string; name: string }, aktiv: boolean, durch: string): string {
  return aktiv ? VORGANG.automatikEingeschaltet(a.name, durch) : VORGANG.automatikPausiert(a.name, durch, folgeBeimPausieren(a.key));
}

/** Grund eines Fehlversuchs – nie das eingegebene Passwort. */
export type FehlGrund = "passwort" | "startpasswort" | "zweifaktor";
export const FEHL_GRUND: Record<FehlGrund, string> = {
  passwort: "falsches Passwort",
  startpasswort: "Startpasswort nicht mehr gültig",
  zweifaktor: "Zwei-Faktor-Code falsch",
};

/** Ab so vielen Fehlversuchen für dasselbe Konto innerhalb des Fensters gibt es einen Hinweis an Partner und Administration. */
export const ANMELDE_WARN_SCHWELLE = 3;
export const ANMELDE_WARN_FENSTER_MS = 15 * 60_000;

/** Anmeldeereignis im Kanzleiprotokoll (Filter „Anmeldungen“). */
export function anmeldeVorgang(text: string, opts: { akteur: "system" | "nutzer"; userId?: ID; meldung?: boolean }): Aktivitaet {
  const a = vorgang(text, opts);
  return { ...a, kategorie: "anmeldung", ...(opts.meldung ? { meldung: true } : {}) };
}

/**
 * Zählt Fehlversuche je Konto (nur im Arbeitsspeicher). Liefert die Anzahl im Fenster – genau beim Erreichen der Schwelle
 * meldet der Aufrufer „3 fehlgeschlagene Anmeldungen für …“.
 */
export function zaehleFehlversuch(speicher: Map<string, number[]>, kontoId: string, jetzt = Date.now()): number {
  const liste = (speicher.get(kontoId) ?? []).filter((t) => jetzt - t < ANMELDE_WARN_FENSTER_MS);
  liste.push(jetzt);
  speicher.set(kontoId, liste);
  if (speicher.size > 5000) for (const [k, v] of speicher) if (!v.some((t) => jetzt - t < ANMELDE_WARN_FENSTER_MS)) speicher.delete(k);
  return liste.length;
}

/** Name des allgemeinen Console-Zugangs – keine Person; im Protokoll steht dann nur „Apex Console“. */
export const ANBIETER_TEAM = "Apex-Team";
/** Auch frühere Namen des allgemeinen Zugangs (bis 18.10.2026 hieß das Produkt „AnwaltApex“) gelten in Alt-Einträgen nicht als Person. */
const ANBIETER_TEAM_NAMEN = new Set([ANBIETER_TEAM, "Apex Team", "AnwaltApex Team"]);

/** Person beim Anbieter aus „Vergeben durch“ bzw. dem Namen des Console-Zugangs – ohne den allgemeinen Teamnamen. */
export function anbieterPersonAus(...namen: (string | null | undefined)[]): string | undefined {
  for (const n of namen) {
    const t = (n ?? "").trim().slice(0, 120);
    if (t && !ANBIETER_TEAM_NAMEN.has(t)) return t;
  }
  return undefined;
}

/**
 * Eingriff des Anbieters über die Apex Console (I4-T16-01): Zugang angelegt, Startpasswort, Demo-Passwort, Beispieldaten.
 * Eigener Urheber im Kanzleiprotokoll („Apex Console – Lena Vogt“) und Filter „Anbieter“. Ein neues Startpasswort
 * gehört zusätzlich zu den Anmeldungen (`kategorie`) und meldet sich bei Partner und Administration (`meldung`).
 */
export function anbieterVorgang(text: string, opts: { userId?: ID; anbieterPerson?: string; kategorie?: "anmeldung"; meldung?: boolean } = {}): Aktivitaet {
  const a = vorgang(text, { akteur: "system", userId: opts.userId });
  const person = anbieterPersonAus(opts.anbieterPerson);
  return {
    ...a,
    quelle: "anbieter",
    ...(person ? { anbieterPerson: person } : {}),
    ...(opts.kategorie ? { kategorie: opts.kategorie } : {}),
    ...(opts.meldung ? { meldung: true } : {}),
  };
}

/**
 * Text eines Anbieter-Eingriffs: „durch AnwaltApex“ bzw. „(Apex Console)“ (Einträge vor der Umbenennung am 18.10.2026)
 * oder „durch Apex“ vor „neu vergeben“, „wiederhergestellt“, „zurückgesetzt“ bzw. am Satzende.
 */
const ANBIETER_TEXT = /durch AnwaltApex|\(Apex Console\)|durch Apex(?= neu vergeben| wiederhergestellt| zurückgesetzt|$)/;

/** Stammt der Eintrag vom Anbieter? Neue Einträge über `quelle`, ältere (ohne `quelle`) am Text. */
export function istAnbieterEintrag(a: Pick<Aktivitaet, "quelle" | "text">): boolean {
  return a.quelle === "anbieter" || ANBIETER_TEXT.test(a.text);
}

/**
 * Urheber eines Anbieter-Eintrags im Kanzleiprotokoll: „Apex Console – Lena Vogt“ bzw. „Apex Console“.
 * `undefined`, wenn der Eintrag nicht vom Anbieter stammt. Bei Alt-Einträgen wird die Person aus dem Text gelesen.
 */
export function anbieterUrheber(a: Pick<Aktivitaet, "quelle" | "anbieterPerson" | "text">): string | undefined {
  if (!istAnbieterEintrag(a)) return undefined;
  const person = a.quelle === "anbieter" ? anbieterPersonAus(a.anbieterPerson) : anbieterPersonAus(/durch (?:Anwalt)?Apex neu vergeben – (.+?) auf Anforderung von /.exec(a.text)?.[1]);
  return person ? `Apex Console – ${person}` : "Apex Console";
}

let zaehler = 0;
/** Neuer Protokolleintrag. `system`: Vorgang durch Apex bzw. das System; `nutzer`: von der Person selbst ausgelöst. */
export function vorgang(text: string, opts: { akteur: "system" | "nutzer"; userId?: ID; zeit?: string }): Aktivitaet {
  zaehler = (zaehler + 1) % 1_000_000;
  const zufall = Math.random().toString(36).slice(2, 8);
  return { id: `vg-${Date.now().toString(36)}-${zaehler}-${zufall}`, zeit: opts.zeit ?? zeitBerlin(), akteur: opts.akteur, userId: opts.userId, text, icon: "shield" };
}

/** Echte Vorgänge in den Datenbestand einmischen (ohne Dubletten, neueste zuerst). */
export function mischeVorgaenge(aktivitaeten: Aktivitaet[], vorgaenge: Aktivitaet[]): Aktivitaet[] {
  if (!vorgaenge.length) return aktivitaeten;
  const ids = new Set(aktivitaeten.map((a) => a.id));
  const neu = vorgaenge.filter((v) => !ids.has(v.id));
  if (!neu.length) return aktivitaeten;
  return [...aktivitaeten, ...neu].sort((a, b) => b.zeit.localeCompare(a.zeit));
}

/** Jüngster echter Vorgang bzw. jüngste echte Anmeldung – Beispieleinträge (`beispiel`) zählen nie. */
export function letzteEchteAktivitaet(werte: (string | null | undefined)[]): string | undefined {
  return werte.filter((x): x is string => !!x).sort().pop();
}

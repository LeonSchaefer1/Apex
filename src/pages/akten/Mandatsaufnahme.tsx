// Mandatsaufnahme: neue Akte in vier Schritten – inkl. automatischem Mandatsaufnahme-Paket.
// Kollisionsprüfung mit verbindlicher Entscheidung (§ 43a Abs. 4 BRAO, § 3 BORA), Entwurf in sessionStorage,
// bei Kündigungen Klagefrist (§ 4 S. 1 KSchG) und Gegenstandswert-Vorschlag (§ 42 Abs. 2 S. 1 GKG).
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, CalendarClock, Check, CheckCircle2, FilePlus2, FolderOpen, FolderPlus, History, Inbox, Info, ShieldCheck, Sparkles, UserCheck, Zap } from "lucide-react";
import { Link } from "react-router";
import type { Akte, Dokument, Frist, Kontakt, Nachricht, Sachgebiet } from "@/core/types";
import { fmtDate, fmtDateWd, fmtEUR, fmtTime, nowLocal, today, uid } from "@/core/dates";
import { berechneNachRegel } from "@/core/fristen";
import { VERSICHERUNGEN, VORNAMEN_M, VORNAMEN_W } from "@/core/seed/pools";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Field, Input, Modal, Segmented, Select, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KontaktAuswahl, KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, entwurfZuKontakt, leererEntwurf, type KontaktEntwurf } from "@/pages/kontakte/KontaktFormular";
import { aktenVonKontakt, findeKontaktNachName, istOrganisationsName, KontaktAvatar } from "@/pages/kontakte/kontaktHelfer";
import { GLEICH_GRUND, gleicheKontakte, kollisionFuerEntwurf, kollisionFuerNeuesMandat, type KollisionsTreffer } from "@/core/kontaktpruefung";
import { ueberText } from "@/pages/kontakte/auskunft";
import { SACHGEBIETE, naechstesAktenzeichen, useTeam } from "./helfer";
import { deckungsanfrageDokument, deckungsanfrageProtokollieren, deckungsWiedervorlage, rsvAusEingabe, versichererSichern, versichererWarnung } from "./rsv";
import { VersichererAuswahl } from "./VersichererAuswahl";

const SCHRITTE = ["Mandant", "Sache", "Rechtsschutz", "Zusammenfassung"] as const;

/** Umfang der Kollisionsprüfung – erscheint in Zusammenfassung, Aktennotiz und Verlauf (I4-T17-01). */
const GEPRUEFT_TEXT = "geprüft gegen den Aktenbestand: Name (ohne Rechtsform), E-Mail/Firmen-Domain, Telefon über alle Kontakte";

const SCHRITT_VARIANTEN = {
  rein: (r: number) => ({ opacity: 0, x: r * 28 }),
  da: { opacity: 1, x: 0 },
  raus: (r: number) => ({ opacity: 0, x: r * -20, transition: { duration: 0.14, ease: "easeIn" as const } }),
};

interface Sache {
  titel: string;
  titelManuell: boolean;
  /** Stichwort für den Aktentitel, z. B. aus dem Betreff einer Mandatsanfrage („Eigenbedarfskündigung“) */
  thema: string;
  sachgebiet: Sachgebiet;
  gegner: string;
  wert: string;
  beschreibung: string;
  prioritaet: Akte["prioritaet"];
  bearbeiterId: string;
}

interface Rsv {
  aktiv: boolean;
  versicherung: string;
  nummer: string;
  schadennummer: string;
  selbstbeteiligung: string;
  /** Pflichtbestätigung: Versicherer ist bisher nur als Gegner bekannt bzw. Gegner dieses Mandats (I5-T04-01) */
  gegenseiteOk?: boolean;
}

/** Kündigungsschutz: Zugang der Kündigung und Bruttomonatsentgelt (nur Arbeitsrecht). */
interface Kschg {
  zugang: string;
  entgelt: string;
}

/** Entscheidung über Kollisionstreffer – gilt nur für die Treffer, für die sie getroffen wurde (`fuer`). */
interface Kollision {
  entscheidung: "" | "uebernommen" | "abgelehnt";
  vermerk: string;
  fuer: string;
}

/**
 * Entwurf der Mandatsaufnahme – je Person, bis zum Abschluss: sessionStorage und eine Kopie im localStorage dieses Browsers
 * (übersteht Neuladen und geschlossene Fenster, höchstens 24 Stunden; gelöscht mit Abschluss oder „Neu beginnen“).
 */
interface Entwurf {
  gespeichert: string;
  nachrichtId: string | null;
  schritt: number;
  modus: "bestehend" | "neu";
  mandantId?: string;
  entwurf: KontaktEntwurf;
  sache: Sache;
  rsv: Rsv;
  portalWahl: boolean | null;
  kschg: Kschg;
  kollision: Kollision;
}

/**
 * Hat der Entwurf inhaltliche Eingaben? Bloßes Umschalten („Neuer Mandant“, „Firma / Organisation“) zählt nicht –
 * erst Name, Mandant, Sache, Rechtsschutz, Kündigungsdaten oder eine Kollisionsentscheidung (I3-T04-01).
 */
export function entwurfHatInhalt(e: Pick<Entwurf, "nachrichtId" | "mandantId" | "entwurf" | "sache" | "rsv" | "kschg" | "kollision">): boolean {
  const voll = (v: unknown) => typeof v === "string" && v.trim() !== "";
  if (e.nachrichtId || e.mandantId) return true;
  const { typ: _typ, ...kontakt } = e.entwurf;
  void _typ;
  if (Object.values(kontakt).some(voll)) return true;
  if ([e.sache.titel, e.sache.thema, e.sache.gegner, e.sache.wert, e.sache.beschreibung].some(voll)) return true;
  if ([e.rsv.versicherung, e.rsv.nummer, e.rsv.schadennummer, e.rsv.selbstbeteiligung].some(voll)) return true;
  if ([e.kschg?.zugang, e.kschg?.entgelt].some(voll)) return true;
  return !!e.kollision && [e.kollision.entscheidung, e.kollision.vermerk].some(voll);
}

const entwurfKey = (userId: string) => `apex.mandatsaufnahme.entwurf.${userId}`;
const ENTWURF_MAX_MS = 24 * 60 * 60 * 1000;
const SPEICHER = [() => sessionStorage, () => localStorage];
function liesEntwurf(speicher: () => Storage, userId: string): Entwurf | null {
  try {
    const raw = speicher().getItem(entwurfKey(userId));
    if (!raw) return null;
    const e = JSON.parse(raw) as Entwurf;
    if (!e || typeof e.schritt !== "number" || !e.sache || !e.entwurf || !e.rsv) return null;
    // Leere Entwürfe (nur „Neuer Mandant“ angeklickt) nicht anbieten
    if (!entwurfHatInhalt(e)) return null;
    return Date.now() - new Date(e.gespeichert).getTime() > ENTWURF_MAX_MS ? null : e;
  } catch {
    return null;
  }
}
/** Offener Entwurf der Person (auch für den Hinweis „Mandatsaufnahme fortsetzen“ in der Aktenliste). */
export function ladeMandatsEntwurf(userId: string): { gespeichert: string; schritt: number } | null {
  return ladeEntwurf(userId);
}
function ladeEntwurf(userId: string): Entwurf | null {
  return liesEntwurf(SPEICHER[0], userId) ?? liesEntwurf(SPEICHER[1], userId);
}
function speichereEntwurf(userId: string, e: Entwurf) {
  for (const s of SPEICHER) {
    try {
      s().setItem(entwurfKey(userId), JSON.stringify(e));
    } catch {
      /* Speicher nicht verfügbar – der Entwurf lebt dann nur im Dialog */
    }
  }
}
function loescheEntwurf(userId: string) {
  for (const s of SPEICHER) {
    try {
      s().removeItem(entwurfKey(userId));
      s().removeItem("apex.mandatsaufnahme.entwurf"); // früherer Schlüssel ohne Person
    } catch {
      /* ignorieren */
    }
  }
}

/** Gegenstandswert der Kündigungsschutzklage: Vierteljahresentgelt (§ 42 Abs. 2 S. 1 GKG). */
export function vierteljahresentgelt(bruttomonat: number): number {
  return Math.round(bruttomonat * 3 * 100) / 100;
}

const betragText = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Escape in Feldern mit Vorschlagsliste schließt nur die Liste – nicht den Dialog. */
function escapeNurListe(e: ReactKeyboardEvent<HTMLInputElement>) {
  if (e.key === "Escape") e.stopPropagation();
}

export function parseEuro(s: string): number {
  const t = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// Grobe Zuordnung des Sachgebiets aus einer Mandatsanfrage (nur Vorschlag – der Nutzer bestätigt)
const SACHGEBIET_HINWEISE: [Sachgebiet, RegExp][] = [
  ["Mietrecht", /\b(miet|vermiet|wohnung|kaution|eigenbedarf|nebenkosten|hausverwalt)/i],
  ["Arbeitsrecht", /\b(arbeitgeber|arbeitsvertrag|arbeitsplatz|abmahnung|lohn|gehalt|betriebsrat|kündigungsschutz)/i],
  ["Verkehrsrecht", /\b(unfall|verkehr|bußgeld|bussgeld|fahrzeug|kfz|blitzer|führerschein)/i],
  ["Familienrecht", /\b(scheidung|unterhalt|sorgerecht|umgang|ehe)/i],
  ["Erbrecht", /\b(erb|nachlass|testament|pflichtteil)/i],
  ["Strafrecht", /\b(straf|anklage|ermittlungsverfahren|polizei|vorladung)/i],
  ["Forderungseinzug", /\b(offene rechnung|forderung|mahnbescheid|inkasso|zahlt nicht)/i],
  ["Baurecht", /\b(bauherr|baustelle|werklohn|handwerker|bauvertrag)/i],
  ["Verwaltungsrecht", /\b(bescheid|behörde|widerspruch gegen)/i],
  ["Vertragsrecht", /\b(vertrag|kauf|gewährleistung|reklamation)/i],
];

function sachgebietAusText(text: string): Sachgebiet | undefined {
  return SACHGEBIET_HINWEISE.find(([, re]) => re.test(text))?.[0];
}

function regexEscape(s: string): string {
  return s.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function titelAusBetreff(betreff: string): string {
  return betreff.replace(/^\s*((AW|WG|RE|Re|Fwd|FW|Anfrage)\s*:\s*)+/i, "").trim();
}

// Stichwort aus dem Betreff einer Anfrage – ohne Ich-Form („Eigenbedarfskündigung meiner Wohnung“ → „Eigenbedarfskündigung“)
const ALLGEMEIN = /^(frage|fragen|anfrage|hilfe|problem|termin|terminanfrage|beratung|kontakt|rechtsberatung|mandat|anliegen)$/i;
export function themaAusBetreff(betreff: string): string {
  let t = titelAusBetreff(betreff).split(/\s+(?:meine[rsmn]?|mein|unsere[rsmn]?|unser|ich|wir|mir|mich|bitte)\b/i)[0] ?? "";
  t = t.replace(/\s+(?:zu[mr]?|wegen|für|bei|mit|über|von|vom|gegen|bzgl\.?|bezüglich)$/i, "").replace(/[?!.,;:–-]+$/, "").trim();
  if (t.length < 3 || t.length > 48 || ALLGEMEIN.test(t) || /\b(ich|mein\w*|wir|unser\w*)\b/i.test(t)) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const WEIBLICH = new Set([...VORNAMEN_W, "Maria", "Elisabeth", "Renate", "Helga", "Karin", "Brigitte", "Ingrid", "Erika", "Andrea", "Gisela", "Susanne", "Christine", "Christina", "Barbara", "Gabriele", "Heike", "Sandra", "Stefanie", "Julia", "Lisa", "Lena", "Hannah", "Sophie", "Emma", "Mia", "Jana", "Katrin", "Nicole", "Martina", "Ingeborg", "Hildegard", "Gertrud", "Ilse", "Christa", "Ute", "Doris", "Angelika", "Silke", "Anja", "Tanja", "Daniela", "Simone", "Kerstin", "Bettina", "Jutta", "Marion", "Elke", "Waltraud", "Irmgard", "Ayşe", "Zeynep", "Agnieszka", "Olga"].map((n) => n.toLowerCase()));
const MAENNLICH = new Set([...VORNAMEN_M, "Peter", "Wolfgang", "Hans", "Jürgen", "Dieter", "Uwe", "Werner", "Manfred", "Horst", "Günter", "Gerhard", "Frank", "Bernd", "Ralf", "Jörg", "Holger", "Martin", "Alexander", "Maximilian", "Paul", "Felix", "Jonas", "Leon", "Lars", "Sven", "Torsten", "Thorsten", "Heinz", "Helmut", "Karl", "Kurt", "Walter", "Josef", "Joachim", "Detlef", "Volker", "Norbert", "Hartmut", "Georg", "Robert", "Patrick", "Philipp", "David", "Simon", "Benjamin", "Mustafa", "Ahmet", "Hasan", "Tomasz", "Krzysztof"].map((n) => n.toLowerCase()));

/** Anrede für die Briefe vorschlagen – aus „Frau/Herr <Nachname>“ im Text oder aus dem Vornamen. Unklar → leer. */
export function anredeVorschlag(vorname: string, nachname: string, text = ""): KontaktEntwurf["anrede"] {
  if (nachname) {
    const m = new RegExp(`\\b(Frau|Herr)\\s+(?:Dr\\.\\s+)?${regexEscape(nachname)}\\b`).exec(text);
    if (m) return m[1] as "Frau" | "Herr";
  }
  const erster = vorname.trim().split(/[\s-]+/)[0]?.toLowerCase() ?? "";
  if (WEIBLICH.has(erster)) return "Frau";
  if (MAENNLICH.has(erster)) return "Herr";
  return "";
}

function kurzName(k: { typ: Kontakt["typ"]; name: string; nachname?: string }): string {
  return k.typ === "person" ? k.nachname || k.name : k.name;
}

export function Mandatsaufnahme({ open, onClose, onErstellt, nachrichtId }: { open: boolean; onClose: () => void; onErstellt: (akteId: string) => void; nachrichtId?: string | null }) {
  const { user, tenant, team } = useKanzlei();
  const { anwaelte } = useTeam();
  const kontakte = useCol("kontakte");
  const akten = useCol("akten");

  const [schritt, setSchritt] = useState(0);
  const [richtung, setRichtung] = useState(1);
  const [modus, setModus] = useState<"bestehend" | "neu">("bestehend");
  const [mandantId, setMandantId] = useState<string | undefined>();
  const [entwurf, setEntwurf] = useState<KontaktEntwurf>(leererEntwurf());
  const standardBearbeiter = anwaelte.some((a) => a.id === user.id) ? user.id : anwaelte[0]?.id ?? user.id;
  const [sache, setSache] = useState<Sache>({ titel: "", titelManuell: false, thema: "", sachgebiet: "Arbeitsrecht", gegner: "", wert: "", beschreibung: "", prioritaet: "normal", bearbeiterId: standardBearbeiter });
  const [rsv, setRsv] = useState<Rsv>({ aktiv: false, versicherung: "", nummer: "", schadennummer: "", selbstbeteiligung: "" });
  // Mandantenportal: null = automatisch (an, sobald eine E-Mail-Adresse erfasst ist)
  const [portalWahl, setPortalWahl] = useState<boolean | null>(null);
  const [kschg, setKschg] = useState<Kschg>({ zugang: "", entgelt: "" });
  const [kollision, setKollision] = useState<Kollision>({ entscheidung: "", vermerk: "", fuer: "" });
  const [erfolg, setErfolg] = useState<{ akte: Akte; schritte: { text: string; sub?: string }[]; minuten: number } | null>(null);
  const [quelle, setQuelle] = useState<Nachricht | undefined>();
  // Anfrage ist schon einer Akte zugeordnet (z. B. nach Browser-Zurück) → keine zweite Akte aus derselben Nachricht
  const [bereits, setBereits] = useState<{ nachricht: Nachricht; akte?: Akte } | undefined>();
  const [zeigeFehler, setZeigeFehler] = useState(false);
  // Gespeicherter Entwurf aus einer früheren Sitzung – „Entwurf fortsetzen?“
  const [offenerEntwurf, setOffenerEntwurf] = useState<Entwurf | null>(null);
  const [verwerfenFrage, setVerwerfenFrage] = useState(false);
  const fragtRef = useRef(false);
  const startJson = useRef<string | null>(null);
  const [startMarke, setStartMarke] = useState(0);

  // Beim Öffnen frisch beginnen – ein offener Entwurf wird angeboten
  useEffect(() => {
    if (!open) return;
    setSchritt(0);
    setModus("bestehend");
    setMandantId(undefined);
    setEntwurf(leererEntwurf());
    setSache({ titel: "", titelManuell: false, thema: "", sachgebiet: (tenant.schwerpunkte[0] as Sachgebiet) ?? "Arbeitsrecht", gegner: "", wert: "", beschreibung: "", prioritaet: "normal", bearbeiterId: standardBearbeiter });
    setRsv({ aktiv: false, versicherung: "", nummer: "", schadennummer: "", selbstbeteiligung: "" });
    setPortalWahl(null);
    setKschg({ zugang: "", entgelt: "" });
    setKollision({ entscheidung: "", vermerk: "", fuer: "" });
    setErfolg(null);
    setQuelle(undefined);
    setBereits(undefined);
    setZeigeFehler(false);
    setVerwerfenFrage(false);
    fragtRef.current = false;
    startJson.current = null;
    setStartMarke((m) => m + 1);

    // Aus dem Posteingang: /akten?neu=1&nachricht=<id> – Anfrage übernehmen
    const st = useData.getState().data;
    const n = nachrichtId ? st.nachrichten.find((x) => x.id === nachrichtId) : undefined;
    if (n?.akteId) {
      setOffenerEntwurf(null);
      setBereits({ nachricht: n, akte: st.akten.find((a) => a.id === n.akteId) });
      return;
    }
    setOffenerEntwurf(ladeEntwurf(user.id));
    if (n) {
      setQuelle(n);
      const adresse = n.vonAdresse?.trim().toLowerCase();
      const bekannt = adresse ? st.kontakte.find((k) => k.email?.trim().toLowerCase() === adresse) : undefined;
      if (bekannt) {
        setMandantId(bekannt.id);
      } else {
        const org = istOrganisationsName(n.von);
        const teile = n.von.trim().split(/\s+/);
        const vorname = org ? "" : teile.slice(0, -1).join(" ");
        const nachname = org ? "" : teile[teile.length - 1] ?? "";
        setModus("neu");
        setEntwurf({
          ...leererEntwurf(org ? "organisation" : "person"),
          anrede: org ? "" : anredeVorschlag(vorname, nachname, `${n.text}\n${n.ki?.zusammenfassung ?? ""}`),
          vorname,
          nachname,
          firma: org ? n.von.trim() : "",
          email: n.vonAdresse ?? "",
        });
      }
      const text = `${n.betreff}\n${n.text}\n${n.ki?.zusammenfassung ?? ""}`;
      // Titel nicht wörtlich aus dem Betreff (oft Ich-Form), sondern „Mandant ./. Gegner – Thema“ automatisch bilden
      setSache((s) => ({ ...s, titel: "", titelManuell: false, thema: themaAusBetreff(n.betreff), beschreibung: n.text.trim(), sachgebiet: sachgebietAusText(text) ?? s.sachgebiet }));
      const versicherer = [...new Set([...VERSICHERUNGEN, ...st.kontakte.filter((k) => k.rollen.includes("versicherung")).map((k) => k.name)])];
      const treffer = versicherer.find((v) => new RegExp(`\\b${regexEscape(v.split(/\s+/)[0])}`, "i").test(text));
      if (treffer || /rechtsschutz/i.test(text)) setRsv((r) => ({ ...r, aktiv: true, versicherung: treffer ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nachrichtId]);

  // Ausgangszustand merken – „Eingaben vorhanden?“ vergleicht dagegen
  const formJson = JSON.stringify({ modus, mandantId: mandantId ?? null, entwurf, sache, rsv, portalWahl, kschg, kollision });
  useEffect(() => {
    if (startMarke) startJson.current = formJson;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMarke]);
  const inhalt = entwurfHatInhalt({ nachrichtId: quelle?.id ?? null, mandantId, entwurf, sache, rsv, kschg, kollision });
  const geaendert = startJson.current !== null && formJson !== startJson.current && inhalt;

  // Entwurf bis zum Abschluss in sessionStorage halten – erst ab der ersten inhaltlichen Eingabe (I3-T04-01)
  useEffect(() => {
    if (!open || erfolg || bereits || offenerEntwurf || startJson.current === null) return;
    if (formJson === startJson.current) return;
    if (!inhalt) {
      // Eingaben wieder gelöscht: kein leerer Entwurf bleibt stehen
      loescheEntwurf(user.id);
      return;
    }
    speichereEntwurf(user.id, { gespeichert: nowLocal(), nachrichtId: quelle?.id ?? null, schritt, modus, mandantId, entwurf, sache, rsv, portalWahl, kschg, kollision });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formJson, schritt, open, erfolg, bereits, offenerEntwurf]);

  const entwurfFortsetzen = () => {
    const e = offenerEntwurf;
    if (!e) return;
    const st = useData.getState().data;
    const n = e.nachrichtId ? st.nachrichten.find((x) => x.id === e.nachrichtId && !x.akteId) : undefined;
    setQuelle(n);
    setModus(e.modus);
    setMandantId(e.mandantId && st.kontakte.some((k) => k.id === e.mandantId) ? e.mandantId : undefined);
    setEntwurf(e.entwurf);
    setSache({ ...e.sache, bearbeiterId: anwaelte.some((a) => a.id === e.sache.bearbeiterId) ? e.sache.bearbeiterId : standardBearbeiter });
    setRsv(e.rsv);
    setPortalWahl(e.portalWahl ?? null);
    setKschg(e.kschg ?? { zugang: "", entgelt: "" });
    setKollision(e.kollision ?? { entscheidung: "", vermerk: "", fuer: "" });
    setRichtung(1);
    setSchritt(Math.min(3, Math.max(0, e.schritt)));
    setOffenerEntwurf(null);
    letzterWechsel.current = Date.now();
    setFokusMarke((m) => m + 1);
  };
  const neuBeginnen = () => {
    loescheEntwurf(user.id);
    setOffenerEntwurf(null);
  };

  // Schließen mit Eingaben → Rückfrage „Weiter bearbeiten / Eingaben verwerfen“ (Escape, X, Abbrechen, Klick daneben)
  const schliessen = useCallback(() => {
    if (fragtRef.current) return;
    if (erfolg || bereits || offenerEntwurf || !geaendert) {
      onClose();
      return;
    }
    fragtRef.current = true;
    setVerwerfenFrage(true);
  }, [erfolg, bereits, offenerEntwurf, geaendert, onClose]);
  const weiterBearbeiten = () => {
    setVerwerfenFrage(false);
    // erst nach dem Tastendruck freigeben – sonst öffnet dasselbe Escape die Rückfrage erneut
    window.setTimeout(() => (fragtRef.current = false), 0);
  };
  const verwerfen = () => {
    loescheEntwurf(user.id);
    setVerwerfenFrage(false);
    window.setTimeout(() => (fragtRef.current = false), 0);
    onClose();
  };
  const entwurfBehalten = () => {
    setVerwerfenFrage(false);
    window.setTimeout(() => (fragtRef.current = false), 0);
    onClose();
    toast("Entwurf behalten", { text: "Beim nächsten Öffnen der Mandatsaufnahme können Sie ihn fortsetzen.", ton: "info" });
  };

  const mandant = modus === "bestehend" ? kontakte.find((k) => k.id === mandantId) : undefined;
  const mandantName = modus === "bestehend" ? mandant?.name ?? "" : entwurfName(entwurf);
  const mandantKurz = modus === "bestehend" ? (mandant ? kurzName(mandant) : "") : entwurf.typ === "person" ? entwurf.nachname.trim() : entwurf.firma.trim();
  const thema = sache.thema.trim();
  const titelVorschlag = mandantKurz
    ? sache.gegner.trim()
      ? `${mandantKurz} ./. ${sache.gegner.trim()}${thema ? ` – ${thema}` : ""}`
      : `${mandantKurz} – ${thema || sache.sachgebiet}`
    : "";
  const titel = sache.titelManuell ? sache.titel : titelVorschlag;
  const wert = sache.wert.trim() ? parseEuro(sache.wert) : 0;
  const az = useMemo(() => naechstesAktenzeichen(akten), [akten]);
  const bearbeiter = team.find((u) => u.id === sache.bearbeiterId);

  // Dublette: Der neue Mandant existiert schon als Kontakt (Name ohne Rechtsform, E-Mail oder Telefon)
  const dublette = useMemo(
    () => (modus === "neu" && (entwurfName(entwurf) || entwurf.email || entwurf.telefon) ? gleicheKontakte({ id: "", name: entwurfName(entwurf), email: emailUngueltig(entwurf.email) ? undefined : entwurf.email, telefon: entwurf.telefon, typ: entwurf.typ }, kontakte)[0] : undefined),
    [modus, entwurf, kontakte],
  );
  const bestehendenVerwenden = (k: Kontakt) => {
    setModus("bestehend");
    setMandantId(k.id);
    toast("Bestehender Kontakt übernommen", { text: `${k.name} wird als Mandant verknüpft – keine Dublette.`, ton: "erfolg" });
  };

  // Kollisionsprüfung (§ 43a Abs. 4 BRAO): Mandant ist anderswo Gegner, Gegner ist anderswo Mandant – über den Kontakt UND alle
  // gleichen Datensätze (Name ohne Rechtsform, E-Mail, Telefon, Firmen-Domain), damit eine Dublette die Prüfung nicht aushebelt (I4-T17-01)
  const mandantKonflikt = useMemo((): KollisionsTreffer[] => {
    if (modus === "bestehend") return mandant ? kollisionFuerNeuesMandat(mandant, akten, "mandant", kontakte).konflikte : [];
    const name = entwurfName(entwurf);
    if (!name && !entwurf.email.trim() && !entwurf.telefon.trim()) return [];
    return kollisionFuerEntwurf({ name, email: emailUngueltig(entwurf.email) ? undefined : entwurf.email, telefon: entwurf.telefon, typ: entwurf.typ }, kontakte, akten, "mandant").konflikte;
  }, [modus, mandant, entwurf, kontakte, akten]);
  const gegnerKontakt = findeKontaktNachName(kontakte, sache.gegner) ?? (sache.gegner.trim() ? gleicheKontakte({ id: "", name: sache.gegner, typ: istOrganisationsName(sache.gegner) ? "organisation" : "person" }, kontakte).find((g) => g.grund === "name")?.kontakt : undefined);
  const gegnerKonflikt = useMemo((): KollisionsTreffer[] => {
    const g = sache.gegner.trim();
    if (!g) return [];
    if (gegnerKontakt) return kollisionFuerNeuesMandat(gegnerKontakt, akten, "gegner", kontakte).konflikte;
    return kollisionFuerEntwurf({ name: g, typ: istOrganisationsName(g) ? "organisation" : "person" }, kontakte, akten, "gegner").konflikte;
  }, [gegnerKontakt, sache.gegner, kontakte, akten]);
  /** Treffer über einen anderen Datensatz nennen ihn – bei neu getipptem gleichem Namen bleibt der Text wie bisher. */
  const ueber = (x: KollisionsTreffer, getippt?: string) => (x.ueber && !(getippt && x.ueber.name.trim().toLowerCase() === getippt.trim().toLowerCase()) ? ` (${ueberText(x.ueber)})` : "");
  const treffer = useMemo(
    () => [
      ...mandantKonflikt.map((x) => `${mandantName || "Mandant"}: ${x.rolle} in ${x.akte.aktenzeichen} ${x.akte.titel}${ueber(x, modus === "neu" ? mandantName : undefined)}`),
      ...gegnerKonflikt.map((x) => `${gegnerKontakt?.name ?? sache.gegner.trim()}: Mandant in ${x.akte.aktenzeichen} ${x.akte.titel}${ueber(x, gegnerKontakt ? undefined : sache.gegner)}`),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mandantKonflikt, gegnerKonflikt, mandantName, gegnerKontakt, sache.gegner, modus],
  );
  /** Gleiche Datensätze des gewählten Mandanten (Doppel-Datensatz) – die Prüfung oben bezieht sie schon ein */
  const mandantGleiche = useMemo(() => (modus === "bestehend" && mandant ? gleicheKontakte(mandant, kontakte) : []), [modus, mandant, kontakte]);
  const trefferKey = treffer.join("|");
  const entscheidungGilt = !!kollision.entscheidung && kollision.fuer === trefferKey;
  const entscheidung = entscheidungGilt ? kollision.entscheidung : "";

  // Mandantenportal: ohne E-Mail-Adresse kein Zugang – dann standardmäßig aus; bei Kollisionstreffern ebenfalls aus,
  // bis das Mandat übernommen ist (I3-T04-02)
  const mandantEmail = (modus === "bestehend" ? mandant?.email : emailUngueltig(entwurf.email) ? "" : entwurf.email)?.trim() ?? "";
  const abgelehnt = treffer.length > 0 && entscheidung === "abgelehnt";
  const portal = !abgelehnt && !!mandantEmail && (portalWahl ?? treffer.length === 0);

  // Kündigungsschutz: Klagefrist (Fristenkern, Regel kschg_klage) und Gegenstandswert-Vorschlag 3 × Bruttomonatsentgelt
  const arbeitsrecht = sache.sachgebiet === "Arbeitsrecht";
  const zugangOk = /^\d{4}-\d{2}-\d{2}$/.test(kschg.zugang);
  const klagefrist: ReturnType<typeof berechneNachRegel> | null = useMemo(() => {
    if (!arbeitsrecht || !zugangOk) return null;
    try {
      return berechneNachRegel("kschg_klage", kschg.zugang, tenant.bundesland, undefined, { feiertagsOrt: "Kanzleisitz", kanzleiLand: tenant.bundesland });
    } catch {
      return null;
    }
  }, [arbeitsrecht, zugangOk, kschg.zugang, tenant.bundesland]);
  const entgelt = kschg.entgelt.trim() ? parseEuro(kschg.entgelt) : 0;
  const wertVorschlag = arbeitsrecht && entgelt > 0 ? vierteljahresentgelt(entgelt) : 0;
  // „Übernehmen“ verschwindet nach dem Klick – der Fokus geht ins Feld Gegenstandswert (bzw. in der Zusammenfassung auf „übernommen“)
  const wertUebernehmen = (ziel: string) => {
    setSache((s) => ({ ...s, wert: betragText(wertVorschlag) }));
    window.setTimeout(() => document.getElementById(ziel)?.focus(), 30);
  };

  // Versicherer der Gegenseite als RSV gewählt? (nur als Gegner bekannt bzw. Gegner dieses Mandats) – Pflichtbestätigung
  const eigenerGegner = useMemo(() => ({ kontaktId: gegnerKontakt?.id, name: sache.gegner }), [gegnerKontakt?.id, sache.gegner]);
  const rsvWarnung = rsv.aktiv ? versichererWarnung(rsv.versicherung, kontakte, akten, eigenerGegner) : undefined;

  // Was fehlt noch? – erklärt, statt den Knopf kommentarlos zu sperren
  const fehler: (string | undefined)[] = [
    modus === "bestehend"
      ? !mandant
        ? "Bitte einen bestehenden Kontakt auswählen – oder oben „Neuer Mandant“ wählen."
        : undefined
      : !entwurfGueltig(entwurf)
        ? entwurf.typ === "person"
          ? "Bitte den Nachnamen des Mandanten eintragen."
          : "Bitte den Firmennamen eintragen."
        : emailUngueltig(entwurf.email)
          ? "Die E-Mail-Adresse ist ungültig – bitte korrigieren oder das Feld leeren."
          : undefined,
    !titel.trim()
      ? "Bitte einen Titel für die Akte eintragen."
      : !sache.bearbeiterId
        ? "Bitte die Bearbeitung (Rechtsanwalt) wählen."
        : Number.isNaN(wert) || wert < 0
          ? "Bitte einen gültigen Gegenstandswert eintragen, z. B. 10.200 – oder das Feld leeren."
          : arbeitsrecht && (Number.isNaN(entgelt) || entgelt < 0)
            ? "Bitte ein gültiges Bruttomonatsentgelt eintragen, z. B. 3.800 – oder das Feld leeren."
            : arbeitsrecht && kschg.zugang && !zugangOk
              ? "Bitte das Datum des Zugangs der Kündigung vollständig eintragen – oder das Feld leeren."
              : undefined,
    rsv.aktiv && !rsv.versicherung.trim()
      ? "Bitte die Rechtsschutzversicherung eintragen – oder den Schalter ausschalten, wenn keine besteht."
      : rsvWarnung && !rsv.gegenseiteOk
        ? `Bitte prüfen und bestätigen, dass ${rsv.versicherung.trim()} die Rechtsschutzversicherung des Mandanten ist – sonst ginge die Deckungsanfrage an die Gegenseite.`
        : undefined,
    treffer.length && !entscheidung
      ? "Bitte über den Kollisionstreffer entscheiden: „Mandat trotzdem übernehmen“ mit Begründung oder „Mandat ablehnen“."
      : entscheidung === "uebernommen" && !kollision.vermerk.trim()
        ? "Bitte begründen, warum kein widerstreitendes Interesse vorliegt – z. B. „anderer Lebenssachverhalt – kein widerstreitendes Interesse nach § 43a Abs. 4 BRAO, § 3 BORA“."
        : undefined,
  ];
  const gueltig = fehler.map((f) => !f);

  // Fehlermeldung sichtbar machen – auf dem Smartphone liegt sie sonst unterhalb des sichtbaren Bereichs
  useEffect(() => {
    if (!zeigeFehler) return;
    const t = window.setTimeout(() => document.getElementById("ma-fehler")?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, [zeigeFehler, schritt]);

  // Fokus nach jedem Schrittwechsel auf die Schrittüberschrift (WCAG 2.4.3, I4-T04-02) – nie auf BODY und nie auf dem
  // Fußknopf, der in Schritt 3 zu „Ohne Rechtsschutz weiter“ und in Schritt 4 zu „Akte anlegen“ wird.
  const [fokusMarke, setFokusMarke] = useState(0);
  const letzterWechsel = useRef(0);
  useEffect(() => {
    if (!fokusMarke) return;
    const t = window.setTimeout(() => {
      const h = document.getElementById(`ma-schritt-titel-${schritt}`);
      if (!h) return;
      h.focus({ preventScroll: true });
      h.closest<HTMLElement>("[data-dialog-inhalt]")?.scrollTo({ top: 0 });
    }, 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokusMarke]);

  const gehe = (n: number) => {
    setRichtung(n > schritt ? 1 : -1);
    setSchritt(n);
    setZeigeFehler(false);
    letzterWechsel.current = Date.now();
    setFokusMarke((m) => m + 1);
  };
  /** Gleich nach einem Schrittwechsel (Doppelklick, gehaltene Enter-Taste) keinen weiteren Schritt auslösen. */
  const zuSchnell = () => Date.now() - letzterWechsel.current < 350;

  const weiter = () => {
    if (zuSchnell()) return;
    if (!gueltig[schritt]) {
      setZeigeFehler(true);
      // Rechtsschutz (I5-T04-01): Fokus dorthin, wo die Angabe fehlt – Versicherer oder das Pflichthäkchen „Gegenseite?“
      if (schritt === 2 && rsv.aktiv) {
        window.setTimeout(() => document.getElementById(rsv.versicherung.trim() ? "ma-vers-gegenseite-ok" : "ma-vers")?.focus(), 0);
      }
      return;
    }
    gehe(schritt + 1);
  };

  // „Mandat ablehnen“: keine Akte, Protokolleintrag mit den Treffern (ohne Aktenbezug)
  const ablehnen = () => {
    const vermerk = kollision.vermerk.trim();
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      text: `Mandat abgelehnt – Interessenkollision (§ 43a Abs. 4 BRAO): ${mandantName || "Mandant"}${sache.gegner.trim() ? ` ./. ${sache.gegner.trim()}` : ""} · Treffer: ${treffer.join("; ")}${vermerk ? ` · Vermerk: ${vermerk}` : ""} · keine Akte angelegt`,
    });
    loescheEntwurf(user.id);
    onClose();
    toast("Mandat abgelehnt – keine Akte angelegt", { text: "Die Entscheidung mit den Kollisionstreffern steht im Protokoll.", ton: "info" });
  };

  const anlegen = () => {
    if (zuSchnell()) return;
    if (treffer.length && entscheidung === "abgelehnt") {
      ablehnen();
      return;
    }
    const erster = gueltig.findIndex((g) => !g);
    if (erster >= 0) {
      gehe(erster);
      setZeigeFehler(true);
      return;
    }
    erstelle();
  };

  const erstelle = () => {
    const st = useData.getState();
    const data = st.data;
    // Schutz vor Doppelanlage: Anfrage inzwischen schon einer Akte zugeordnet?
    const aktuell = quelle ? data.nachrichten.find((x) => x.id === quelle.id) : undefined;
    if (aktuell?.akteId) {
      setBereits({ nachricht: aktuell, akte: data.akten.find((a) => a.id === aktuell.akteId) });
      return;
    }
    const jetzt = nowLocal();
    const heute = today();
    const aktenzeichen = naechstesAktenzeichen(data.akten);
    const ort = tenant.stadt;

    // Mandant
    let m: Kontakt;
    if (modus === "bestehend" && mandant) {
      m = mandant;
      if (!m.rollen.includes("mandant")) st.patch("kontakte", m.id, { rollen: [...m.rollen, "mandant"] });
    } else {
      m = entwurfZuKontakt(entwurf, ["mandant"]);
      st.upsert("kontakte", m);
    }

    // Gegner
    let gegnerId: string | undefined;
    const gName = sache.gegner.trim();
    if (gName) {
      // derselbe Kontakt wie im Hinweis „Bestehender Kontakt … wird verknüpft“ (auch bei Schreibweise ohne Rechtsform)
      const ex = findeKontaktNachName(data.kontakte, gName) ?? (gegnerKontakt && data.kontakte.some((k) => k.id === gegnerKontakt.id) ? gegnerKontakt : undefined);
      if (ex) {
        gegnerId = ex.id;
        if (!ex.rollen.includes("gegner")) st.patch("kontakte", ex.id, { rollen: [...ex.rollen, "gegner"] });
      } else {
        const org = istOrganisationsName(gName);
        const teile = gName.split(/\s+/);
        const k: Kontakt = {
          id: uid("k"), typ: org ? "organisation" : "person", name: gName,
          firma: org ? gName : undefined, vorname: org ? undefined : teile.slice(0, -1).join(" ") || undefined, nachname: org ? undefined : teile[teile.length - 1],
          rollen: ["gegner"], createdAt: jetzt,
        };
        st.upsert("kontakte", k);
        gegnerId = k.id;
      }
    }

    // Versicherung als Kontakt führen – gemeinsamer Weg mit „Beteiligte → Rechtsschutz ergänzen“ (rsv.ts)
    const versicherer = rsv.aktiv && rsv.versicherung.trim() ? versichererSichern(rsv.versicherung, jetzt) : undefined;

    const refa = team.find((u) => u.rolle === "refa");
    const ra = team.find((u) => u.id === sache.bearbeiterId) ?? user;
    const akte: Akte = {
      id: uid("a"),
      aktenzeichen,
      titel: titel.trim(),
      sachgebiet: sache.sachgebiet,
      phase: "Mandatsaufnahme",
      status: "offen",
      mandantId: m.id,
      gegnerId,
      gegenstandswert: Number.isNaN(wert) ? 0 : wert,
      bearbeiterId: ra.id,
      sachbearbeiterId: refa?.id,
      rsv: versicherer ? { ...rsvAusEingabe(rsv), versicherung: versicherer.name } : undefined,
      beschreibung: sache.beschreibung.trim(),
      schlagworte: [sache.sachgebiet.toLowerCase()],
      prioritaet: sache.prioritaet,
      createdAt: jetzt,
      updatedAt: jetzt,
      mandantenportal: portal,
      kollisionspruefung: {
        am: jetzt,
        von: user.id,
        treffer,
        entscheidung: "uebernommen",
        vermerk: treffer.length ? kollision.vermerk.trim() : `Keine Treffer – Mandant${gName ? " und Gegner" : ""} ${GEPRUEFT_TEXT}.`,
      },
    };
    st.upsert("akten", akte);

    // Kollisionsprüfung: Vermerk als Aktennotiz und im Verlauf
    const kollisionsText = treffer.length
      ? `Kollisionsprüfung (§ 43a Abs. 4 BRAO, § 3 BORA): ${treffer.length} Treffer – ${treffer.join("; ")}. Entscheidung: Mandat trotzdem übernommen. Begründung: ${kollision.vermerk.trim()}`
      : `Kollisionsprüfung (§ 43a Abs. 4 BRAO, § 3 BORA): keine Treffer – Mandant${gName ? " und Gegner" : ""} ${GEPRUEFT_TEXT}.`;
    st.upsert("notizen", { id: uid("no"), akteId: akte.id, userId: user.id, text: kollisionsText, zeit: jetzt });

    // Arbeitssachen: Hinweis auf den Ausschluss der Kostenerstattung vor Abschluss der Vertretungsvereinbarung (§ 12a Abs. 1 S. 2 ArbGG)
    const arbeitssache = akte.sachgebiet === "Arbeitsrecht";
    const anrede = m.typ === "person" ? (m.anrede === "Frau" ? `Sehr geehrte Frau ${m.nachname ?? m.name}` : m.anrede === "Herr" ? `Sehr geehrter Herr ${m.nachname ?? m.name}` : `Guten Tag ${m.name}`) : "Sehr geehrte Damen und Herren";
    const gruss = `Mit freundlichen Grüßen\n\n${ra.name}\n${ra.titel}\n${tenant.name}`;
    const dok = (d: Pick<Dokument, "name" | "art" | "ordner" | "inhalt"> & Partial<Dokument>): Dokument => ({
      id: uid("d"), akteId: akte.id, format: "pdf", groesseKb: Math.round(28 + d.inhalt.length / 40), seiten: Math.max(1, Math.ceil(d.inhalt.length / 1800)),
      quelle: "generiert", autorId: ra.id, version: 1, createdAt: jetzt, ...d,
    });
    const paket: Dokument[] = [
      dok({
        name: "Vollmacht", art: "vollmacht", ordner: "Mandant",
        inhalt: `VOLLMACHT\n\n${tenant.name}\n${tenant.adresse}\n\nwird hiermit in Sachen\n${akte.titel}\n(unser Zeichen: ${aktenzeichen})\n\nVollmacht erteilt\n\n1. zur Prozessführung (u. a. nach §§ 81 ff. ZPO) einschließlich der Befugnis zur Erhebung und Rücknahme von Widerklagen,\n2. zur Vertretung in sonstigen Verfahren und bei außergerichtlichen Verhandlungen aller Art,\n3. zur Begründung und Aufhebung von Vertragsverhältnissen sowie zur Abgabe und Entgegennahme einseitiger Willenserklärungen (z. B. Kündigungen),\n4. zur Entgegennahme von Zustellungen, Geld, Wertsachen und Urkunden, insbesondere des Streitgegenstands und der von der Gegenseite, der Justizkasse oder anderen Stellen zu erstattenden Beträge,\n5. zur Bestellung von Vertretern (Untervollmacht) und zur Beseitigung des Rechtsstreits durch Vergleich, Verzicht oder Anerkenntnis.\n\n${ort}, den ${fmtDate(heute)}\n\n______________________________\n${m.name}\n(digitale Unterschrift angefordert)`,
      }),
      dok({
        name: "Mandatsbestätigung", art: "brief", ordner: "Mandant", format: "docx",
        inhalt: `${m.name}\n${[m.strasse, [m.plz, m.ort].filter(Boolean).join(" ")].filter(Boolean).join("\n")}\n\n${ort}, ${fmtDate(heute)}\nUnser Zeichen: ${aktenzeichen}\n\nMandatsbestätigung – ${akte.titel}\n\n${anrede},\n\nvielen Dank für Ihr Vertrauen. Hiermit bestätigen wir die Übernahme des Mandats in der oben genannten Angelegenheit. Zuständig ist ${ra.name}${refa ? `; im Sekretariat erreichen Sie ${refa.name}` : ""}.\n\nIhre nächsten Schritte:\n• Bitte unterzeichnen Sie die beigefügte Vollmacht digital.\n• Senden Sie uns alle Unterlagen zur Sache (Schreiben, Verträge, Fotos, Fristsetzungen) – gern über das Mandantenportal oder per E-Mail.${akte.rsv ? `\n• Wir haben Ihre Rechtsschutzversicherung (${akte.rsv.versicherung}) um Deckungszusage gebeten und informieren Sie über die Antwort.` : ""}${portal ? "\n• Über das Mandantenportal können Sie den Stand Ihrer Sache jederzeit einsehen." : ""}\n\nBitte beachten Sie die beigefügten Datenschutzhinweise. Die vor Übernahme des Mandats erteilten Hinweise ${arbeitssache ? "zur Abrechnung nach dem Gegenstandswert und zur Kostentragung im arbeitsgerichtlichen Verfahren" : "zur Abrechnung nach dem Gegenstandswert"} erhalten Sie zur Bestätigung.\n\n${gruss}`,
      }),
      dok({
        name: "Datenschutzhinweise (Art. 13 DSGVO)", art: "brief", ordner: "Mandant",
        inhalt: `Informationen zur Verarbeitung Ihrer personenbezogenen Daten nach Art. 13 DSGVO\n\n1. Verantwortlicher\n${tenant.name}, ${tenant.adresse}\n\n2. Zwecke und Rechtsgrundlagen\nWir verarbeiten Ihre Daten zur Durchführung des Mandats (Art. 6 Abs. 1 lit. b DSGVO) und zur Erfüllung berufsrechtlicher und gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO, u. a. § 50 BRAO, Geldwäschegesetz).\n\n3. Empfänger\nGerichte, Behörden, die Gegenseite und deren Bevollmächtigte sowie Versicherungen – jeweils nur, soweit dies für die Bearbeitung des Mandats erforderlich ist.\n\n4. Speicherdauer\nDie Handakte bewahren wir nach § 50 Abs. 1 BRAO sechs Jahre nach Ablauf des Kalenderjahres auf, in dem der Auftrag beendet wurde.\n\n5. Ihre Rechte\nAuskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) sowie Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO).\n\n6. Verschwiegenheit\nAlle Informationen unterliegen der anwaltlichen Verschwiegenheitspflicht (§ 43a Abs. 2 BRAO, § 203 StGB).`,
      }),
      dok({
        name: "Hinweis Abrechnung nach Gegenstandswert (§ 49b Abs. 5 BRAO)", art: "brief", ordner: "Mandant",
        inhalt: `Hinweis nach § 49b Abs. 5 BRAO – Bestätigung\n\nUnser Zeichen: ${aktenzeichen} – ${akte.titel}\n\n${anrede},\n\nwie vor Übernahme des Auftrags mit Ihnen besprochen, richten sich die für unsere Tätigkeit zu erhebenden Gebühren nach dem Gegenstandswert (§ 2 Abs. 1 RVG). Den Gegenstandswert schätzen wir derzeit vorläufig auf ${fmtEUR(akte.gegenstandswert)}. Er kann sich im Verlauf des Mandats ändern.\n\nMit Ihrer Unterschrift bestätigen Sie, dass wir Sie vor Übernahme des Auftrags auf die Abrechnung nach dem Gegenstandswert hingewiesen haben.\n\n${ort}, den ${fmtDate(heute)}\n\n______________________________\n${m.name}`,
      }),
      ...(arbeitssache
        ? [
            dok({
              name: "Hinweis Kostentragung Arbeitsgericht (§ 12a Abs. 1 S. 2 ArbGG)", art: "brief", ordner: "Mandant",
              inhalt: `Hinweis nach § 12a Abs. 1 S. 2 ArbGG – Bestätigung\n\nUnser Zeichen: ${aktenzeichen} – ${akte.titel}\n\n${anrede},\n\nwie vor Abschluss der Vereinbarung über die Vertretung mit Ihnen besprochen, besteht im Urteilsverfahren des ersten Rechtszugs vor dem Arbeitsgericht kein Anspruch auf Erstattung der Kosten für die Zuziehung eines Prozessbevollmächtigten (§ 12a Abs. 1 S. 1 ArbGG). Jede Partei trägt ihre Anwaltskosten selbst – auch wenn sie den Rechtsstreit gewinnt.${akte.rsv ? " Ob und in welchem Umfang Ihre Rechtsschutzversicherung die Kosten übernimmt, klären wir mit der Deckungsanfrage." : ""}\n\nMit Ihrer Unterschrift bestätigen Sie, dass wir Sie vor Übernahme des Mandats auf den Ausschluss der Kostenerstattung hingewiesen haben.\n\n${ort}, den ${fmtDate(heute)}\n\n______________________________\n${m.name}`,
            }),
          ]
        : []),
    ];
    let wiedervorlage: string | undefined;
    if (akte.rsv) {
      // Entwurf des 38h-Motors: erst nach anwaltlicher Freigabe versandt (Beteiligte → „Freigeben und versenden“), nie im Portal
      paket.push(deckungsanfrageDokument({ akte, rsv: akte.rsv, mandant: m, gegnerName: gName || undefined, ra, tenant, jetzt, heute }));
      const f = deckungsWiedervorlage({ akteId: akte.id, versicherung: akte.rsv.versicherung, verantwortlichId: refa?.id ?? ra.id, land: tenant.bundesland, jetzt, notiz: "Automatisch gesetzt durch das Mandatsaufnahme-Paket." });
      wiedervorlage = f.datum;
      st.upsert("fristen", f);
    }
    for (const d of paket) st.upsert("dokumente", d);

    // Kündigungsschutzklage: Klagefrist und Vorfrist automatisch – zur Vier-Augen-Kontrolle
    let klage: Frist | undefined;
    if (arbeitssache && klagefrist) {
      klage = {
        id: uid("f"), akteId: akte.id, titel: "Klagefrist Kündigungsschutzklage", typ: klagefrist.regel.typ, datum: klagefrist.ende, vorfrist: klagefrist.vorfrist,
        regelKey: "kschg_klage", grundlage: klagefrist.regel.grundlage, ereignisDatum: kschg.zugang, rechenweg: klagefrist.rechenweg, status: "offen",
        verantwortlichId: ra.id, quelle: "automatisch", createdAt: jetzt,
        notiz: `Automatisch aus der Mandatsaufnahme (Zugang der Kündigung am ${fmtDate(kschg.zugang)}) – bitte im Vier-Augen-Prinzip kontrollieren.`,
      };
      st.upsert("fristen", klage);
      st.upsert("fristen", {
        id: uid("f"), akteId: akte.id, titel: `Vorfrist: ${klage.titel}`, typ: "vorfrist", datum: klagefrist.vorfrist, bezugId: klage.id, status: "offen",
        verantwortlichId: refa?.id ?? ra.id, quelle: "automatisch", createdAt: jetzt,
      });
    }

    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Akte angelegt – ${aktenzeichen} ${akte.titel}` });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `${kollisionsText} – ${aktenzeichen}` });
    if (klage && klagefrist) {
      st.log({ akteur: "automation", automationKey: "vorfristen", akteId: akte.id, minutenGespart: 4, text: `Klagefrist (§ 4 S. 1 KSchG) bis ${fmtDate(klagefrist.ende)} und Vorfrist am ${fmtDate(klagefrist.vorfrist)} eingetragen – zur Vier-Augen-Kontrolle – ${aktenzeichen}` });
    }
    if (portal && mandantEmail) {
      st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Mandantenportal freigeschaltet für ${m.name} (Zugangs-E-Mail an ${mandantEmail}) – ${aktenzeichen}` });
    }
    st.log({
      akteur: "automation", automationKey: "mandatsaufnahme", akteId: akte.id, minutenGespart: 25,
      text: `Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutzhinweise, Hinweis § 49b Abs. 5 BRAO${arbeitssache ? ", Hinweis § 12a ArbGG" : ""}) erstellt – ${aktenzeichen}`,
    });
    if (akte.rsv && wiedervorlage) deckungsanfrageProtokollieren(akte, akte.rsv.versicherung, wiedervorlage, jetzt);
    // Ursprüngliche Anfrage aus dem Posteingang der Akte zuordnen und in der E-Akte ablegen
    if (quelle) {
      st.patch("nachrichten", quelle.id, { akteId: akte.id, zugeordnet: true, status: "erledigt" });
      st.upsert("dokumente", dok({
        name: `${quelle.kanal === "bea" ? "beA-Nachricht" : "E-Mail"}: ${quelle.betreff}`, art: quelle.kanal === "bea" ? "bea" : "email", ordner: "Korrespondenz", format: "eml",
        quelle: quelle.kanal === "bea" ? "bea" : "email", autorId: undefined, createdAt: quelle.eingang,
        inhalt: `Von: ${quelle.von}${quelle.vonAdresse ? ` <${quelle.vonAdresse}>` : ""}\nBetreff: ${quelle.betreff}\nEingang: ${new Date(quelle.eingang).toLocaleString("de-DE")}\n\n${quelle.text}`,
        ki: quelle.ki?.zusammenfassung ? { zusammenfassung: quelle.ki.zusammenfassung } : undefined,
      }));
    }
    const au = data.automationen.find((a) => a.key === "mandatsaufnahme");
    if (au) st.patch("automationen", au.id, { laeufe: au.laeufe + 1, letzterLauf: jetzt });

    setErfolg({
      akte,
      minuten: akte.rsv ? 40 : 25,
      schritte: [
        { text: `Akte ${aktenzeichen} angelegt`, sub: akte.titel },
        { text: "Vollmacht erzeugt", sub: "Zur digitalen Unterschrift an den Mandanten" },
        { text: "Mandatsbestätigung erstellt", sub: `Ordner „Mandant“ · ${ra.name}` },
        { text: "Datenschutzhinweise nach Art. 13 DSGVO", sub: "Automatisch beigefügt" },
        { text: "Hinweis Abrechnung nach Gegenstandswert", sub: "§ 49b Abs. 5 BRAO – zur Bestätigung" },
        ...(arbeitssache ? [{ text: "Hinweis Kostentragung Arbeitsgericht", sub: "§ 12a Abs. 1 S. 2 ArbGG – zur Bestätigung" }] : []),
        ...(akte.rsv && wiedervorlage
          ? [
              { text: `Deckungsanfrage an ${akte.rsv.versicherung}`, sub: "Ordner „Korrespondenz“ – mit Sachverhalt und Gegenstandswert" },
              { text: `Wiedervorlage am ${fmtDateWd(wiedervorlage)}`, sub: "Deckungszusage nachhalten" },
            ]
          : []),
        ...(klage && klagefrist ? [{ text: `Klagefrist bis ${fmtDateWd(klagefrist.ende)} eingetragen`, sub: `Vorfrist ${fmtDateWd(klagefrist.vorfrist)} · zur Vier-Augen-Kontrolle` }] : []),
        { text: treffer.length ? "Kollisionsprüfung mit Begründung dokumentiert" : "Kollisionsprüfung ohne Treffer dokumentiert", sub: "Aktennotiz „Kollisionsprüfung“ und Verlauf" },
        ...(quelle ? [{ text: "Anfrage aus dem Posteingang zugeordnet", sub: `„${quelle.betreff}“ – abgelegt in „Korrespondenz“` }] : []),
      ],
    });
    loescheEntwurf(user.id);
  };

  // Nach Erfolg automatisch in die Akte wechseln
  useEffect(() => {
    if (!erfolg) return;
    const t = setTimeout(() => onErstellt(erfolg.akte.id), 5200);
    return () => clearTimeout(t);
  }, [erfolg, onErstellt]);

  const footer = erfolg ? (
    <Button variant="primary" onClick={() => onErstellt(erfolg.akte.id)} iconRight={<ArrowRight className="size-4" />}>
      Akte öffnen
    </Button>
  ) : bereits ? (
    <>
      <Button variant="ghost" onClick={onClose} className="mr-auto">
        Schließen
      </Button>
      <Button variant="secondary" onClick={() => setBereits(undefined)}>
        Andere neue Akte anlegen
      </Button>
      {bereits.akte && (
        <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => onErstellt(bereits.akte!.id)}>
          Akte öffnen
        </Button>
      )}
    </>
  ) : offenerEntwurf ? (
    <>
      <Button variant="ghost" onClick={onClose} className="mr-auto">
        Später
      </Button>
      <Button variant="secondary" onClick={neuBeginnen}>
        Neu beginnen
      </Button>
      <Button variant="primary" icon={<History className="size-4" />} onClick={entwurfFortsetzen} data-autofocus>
        Entwurf fortsetzen
      </Button>
    </>
  ) : (
    <div className="contents" onKeyDownCapture={(e) => e.key === "Enter" && e.repeat && e.preventDefault()}>
      <Button variant="ghost" onClick={schliessen} className="mr-auto">
        Abbrechen
      </Button>
      {schritt > 0 && (
        <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => gehe(schritt - 1)}>
          Zurück
        </Button>
      )}
      {schritt < 3 ? (
        <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={weiter} aria-describedby={zeigeFehler && fehler[schritt] ? "ma-fehler" : undefined}>
          {schritt === 2 && !rsv.aktiv ? "Ohne Rechtsschutz weiter" : "Weiter"}
        </Button>
      ) : treffer.length && entscheidung === "abgelehnt" ? (
        <Button variant="danger" icon={<Ban className="size-4" />} onClick={anlegen}>
          Mandat ablehnen
        </Button>
      ) : (
        <Button variant="primary" icon={<FolderPlus className="size-4" />} onClick={anlegen} aria-describedby={zeigeFehler && fehler[3] ? "ma-fehler" : undefined}>
          Akte anlegen
        </Button>
      )}
    </div>
  );

  return (
    <>
    <Modal
      open={open}
      onClose={schliessen}
      size="lg"
      icon={erfolg ? <CheckCircle2 className="size-[18px]" /> : <FolderPlus className="size-[18px]" />}
      title={erfolg ? "Akte angelegt" : offenerEntwurf ? "Entwurf fortsetzen?" : "Mandatsaufnahme"}
      subtitle={erfolg ? "Das Mandatsaufnahme-Paket wurde automatisch erstellt." : offenerEntwurf ? "Es gibt eine nicht abgeschlossene Mandatsaufnahme." : "Neue Akte in vier Schritten – Vollmacht, Mandatsbestätigung und Datenschutzhinweise erstellt Apex automatisch."}
      footer={footer}
    >
      {erfolg ? (
        <ErfolgsAnsicht erfolg={erfolg} />
      ) : bereits ? (
        <BereitsZugeordnet nachricht={bereits.nachricht} akte={bereits.akte} onOeffnen={onClose} />
      ) : offenerEntwurf ? (
        <EntwurfFrage e={offenerEntwurf} kontakte={kontakte} />
      ) : (
        <>
          {quelle && (
            <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-violet-soft px-3.5 py-2.5 text-[12.5px]">
              <Inbox className="size-4 shrink-0 text-violet" />
              <span className="min-w-0 flex-1 break-words text-fg-2">
                Übernommen aus dem Posteingang: <span className="font-semibold text-fg">{quelle.von}</span> – „{quelle.betreff}“
              </span>
            </div>
          )}
          <Schrittleiste schritt={schritt} gueltig={gueltig} onGehe={gehe} />
          {schritt < 3 && <KonfliktHinweis treffer={treffer} />}
          <div className="relative mt-5 min-h-[340px]">
            <AnimatePresence mode="popLayout" custom={richtung} initial={false}>
              <motion.div
                key={schritt}
                custom={richtung}
                variants={SCHRITT_VARIANTEN}
                initial="rein"
                animate="da"
                exit="raus"
                transition={{ type: "spring", stiffness: 460, damping: 38 }}
              >
                <h3 id={`ma-schritt-titel-${schritt}`} tabIndex={-1} className="mb-3 rounded-[8px] text-[13px] font-semibold text-fg-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]">
                  Schritt {schritt + 1} von 4: {SCHRITTE[schritt]}
                </h3>
                {schritt === 0 && (
                  <div className="grid grid-cols-1 gap-4">
                    <Segmented
                      full
                      value={modus}
                      onChange={setModus}
                      options={[
                        { value: "bestehend", label: "Bestehender Kontakt" },
                        { value: "neu", label: "Neuer Mandant" },
                      ]}
                    />
                    {modus === "bestehend" ? (
                      <>
                        <KontaktAuswahl id="ma-mandant" value={mandantId} onSelect={(k) => setMandantId(k.id)} bevorzugt={["mandant"]} nurRollen={["mandant"]} hoehe={260} />
                        {mandant && mandantGleiche.length > 0 && (
                          <p role="status" className="flex items-start gap-2 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] text-fg-2">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--amber-text)]" aria-hidden />
                            <span>
                              <span className="font-semibold text-fg">Möglicher Doppel-Datensatz: </span>
                              {mandantGleiche.slice(0, 2).map((g) => `„${g.kontakt.name}“${g.kontakt.ort ? ` (${g.kontakt.ort})` : ""} – ${GLEICH_GRUND[g.grund]}`).join("; ")}. Die Kollisionsprüfung bezieht {mandantGleiche.length === 1 ? "diesen Datensatz" : "diese Datensätze"} ein; zusammenführen lässt er sich unter „Kontakte“.
                            </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        {dublette && (
                          <div className="flex flex-wrap items-start gap-3 rounded-[16px] bg-amber-soft p-3.5 text-[13px]" role="status">
                            <KontaktAvatar k={dublette.kontakt} size={32} />
                            <div className="min-w-[180px] flex-1">
                              <div className="font-semibold text-fg">Kontakt besteht bereits</div>
                              <div className="mt-0.5 text-fg-2">
                                „{dublette.kontakt.name}“{dublette.kontakt.ort ? ` aus ${dublette.kontakt.ort}` : ""} – {GLEICH_GRUND[dublette.grund]}.
                                {aktenVonKontakt(dublette.kontakt, akten).length > 0 &&
                                  ` Beteiligt in ${aktenVonKontakt(dublette.kontakt, akten)
                                    .slice(0, 2)
                                    .map((x) => `${x.akte.aktenzeichen} (${x.rolle})`)
                                    .join(", ")}.`}
                              </div>
                            </div>
                            <Button size="sm" variant="secondary" icon={<UserCheck className="size-4" />} onClick={() => bestehendenVerwenden(dublette.kontakt)}>
                              Bestehenden Kontakt verwenden
                            </Button>
                          </div>
                        )}
                        <KontaktFelder idPrefix="ma-neu" value={entwurf} onChange={setEntwurf} />
                        <PflichtHinweis />
                      </>
                    )}
                  </div>
                )}

                {schritt === 1 && (
                  <div className="grid grid-cols-1 gap-3.5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Sachgebiet" htmlFor="ma-sg">
                        <Select id="ma-sg" value={sache.sachgebiet} onChange={(e) => setSache({ ...sache, sachgebiet: e.target.value as Sachgebiet })}>
                          {SACHGEBIETE.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Gegner"
                        htmlFor="ma-gegner"
                        hint={sache.gegner.trim() ? (gegnerKontakt ? `Bestehender Kontakt „${gegnerKontakt.name}“ wird verknüpft.` : "Wird als neuer Kontakt angelegt.") : "Optional – z. B. Arbeitgeber, Vermieter, Versicherung."}
                      >
                        <Input id="ma-gegner" list="ma-gegner-liste" value={sache.gegner} onChange={(e) => setSache({ ...sache, gegner: e.target.value })} onKeyDown={escapeNurListe} placeholder="Name oder Firma" autoComplete="off" />
                        <datalist id="ma-gegner-liste">
                          {kontakte.filter((k) => !k.rollen.includes("gericht")).slice(0, 300).map((k) => (
                            <option key={k.id} value={k.name} />
                          ))}
                        </datalist>
                      </Field>
                    </div>
                    <Field
                      label="Titel der Akte *"
                      htmlFor="ma-titel"
                      hint={!sache.titelManuell && titelVorschlag ? (thema ? "Automatisch aus Mandant, Gegner und Betreff der Anfrage – Sie können ihn anpassen." : "Automatisch aus Mandant und Gegner – Sie können ihn anpassen.") : undefined}
                    >
                      <Input id="ma-titel" value={titel} onChange={(e) => setSache({ ...sache, titel: e.target.value, titelManuell: true })} placeholder="z. B. Weber ./. Kröger Logistik GmbH" />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Gegenstandswert" htmlFor="ma-wert" hint={Number.isNaN(wert) ? <span className="text-seal">Bitte einen Betrag wie 10.200 oder 4860,50 eingeben.</span> : wert > 0 ? `${fmtEUR(wert)} – Grundlage der Gebühren nach RVG` : "Vorläufig, kann später angepasst werden."}>
                        <div className="relative">
                          <Input id="ma-wert" inputMode="decimal" value={sache.wert} onChange={(e) => setSache({ ...sache, wert: e.target.value })} placeholder="0" className="num !pr-9" />
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-3">€</span>
                        </div>
                      </Field>
                      <Field label="Bearbeitung (Rechtsanwalt) *" htmlFor="ma-ra">
                        <Select id="ma-ra" value={sache.bearbeiterId} onChange={(e) => setSache({ ...sache, bearbeiterId: e.target.value })}>
                          {anwaelte.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    {arbeitsrecht && (
                      <div className="grid grid-cols-1 gap-3 rounded-[16px] bg-ink-softer p-3.5 shadow-[inset_0_0_0_1px_var(--line)]">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <CalendarClock className="size-4 text-ink" /> Kündigung? Klagefrist und Gegenstandswert
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Zugang der Kündigung" htmlFor="ma-zugang" hint={zugangOk ? `${fmtDateWd(kschg.zugang)} – Ereignis für die Klagefrist (§ 4 S. 1 KSchG)` : "Leer lassen, wenn es nicht um eine Kündigung geht."}>
                            <Input id="ma-zugang" type="date" value={kschg.zugang} max={today()} onChange={(e) => setKschg({ ...kschg, zugang: e.target.value })} />
                          </Field>
                          <Field label="Bruttomonatsentgelt" htmlFor="ma-entgelt" hint={Number.isNaN(entgelt) ? <span className="text-seal">Bitte einen Betrag wie 3.800 eingeben.</span> : "Für den Gegenstandswert (§ 42 Abs. 2 S. 1 GKG)"}>
                            <div className="relative">
                              <Input id="ma-entgelt" inputMode="decimal" value={kschg.entgelt} onChange={(e) => setKschg({ ...kschg, entgelt: e.target.value })} placeholder="z. B. 3.800" className="num !pr-9" />
                              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-3">€</span>
                            </div>
                          </Field>
                        </div>
                        <KschgVorschau klagefrist={klagefrist} entgelt={entgelt} wertVorschlag={wertVorschlag} wert={wert} onUebernehmen={() => wertUebernehmen("ma-wert")} />
                      </div>
                    )}
                    <Field label="Sachverhalt" htmlFor="ma-beschreibung">
                      <Textarea id="ma-beschreibung" rows={3} value={sache.beschreibung} onChange={(e) => setSache({ ...sache, beschreibung: e.target.value })} placeholder="Worum geht es? Was möchte der Mandant erreichen?" />
                    </Field>
                    <div>
                      <div className="label">Priorität</div>
                      <Segmented
                        value={sache.prioritaet}
                        onChange={(p) => setSache({ ...sache, prioritaet: p })}
                        options={[
                          { value: "hoch", label: "Hoch" },
                          { value: "normal", label: "Normal" },
                          { value: "niedrig", label: "Niedrig" },
                        ]}
                      />
                    </div>
                    <PflichtHinweis />
                  </div>
                )}

                {schritt === 2 && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 rounded-[16px] bg-ink-softer p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                      <label htmlFor="ma-rsv" className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <span className="grid grid-cols-1 size-10 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                          <ShieldCheck className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold">Mandant ist rechtsschutzversichert</span>
                          <span className="block text-[12.5px] text-fg-3">Apex erstellt dann automatisch die Deckungsanfrage und setzt eine Wiedervorlage in 7 Tagen.</span>
                        </span>
                      </label>
                      <Switch id="ma-rsv" checked={rsv.aktiv} onChange={(v) => setRsv({ ...rsv, aktiv: v })} label="Mandant ist rechtsschutzversichert" />
                    </div>
                    <AnimatePresence initial={false}>
                      {rsv.aktiv && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="overflow-hidden">
                          <div className="grid grid-cols-1 gap-3 p-0.5 sm:grid-cols-2">
                            <Field label="Versicherung *" htmlFor="ma-vers" className="sm:col-span-2">
                              <VersichererAuswahl
                                id="ma-vers"
                                value={rsv.versicherung}
                                onChange={(v) => setRsv({ ...rsv, versicherung: v, gegenseiteOk: false })}
                                fehler={zeigeFehler && !!fehler[2]}
                                describedBy={zeigeFehler && fehler[2] ? "ma-fehler" : undefined}
                                eigenerGegner={eigenerGegner}
                                bestaetigt={!!rsv.gegenseiteOk}
                                onBestaetigt={(v) => setRsv({ ...rsv, gegenseiteOk: v })}
                              />
                            </Field>
                            <Field label="Versicherungsnummer" htmlFor="ma-vnr" hint="Optional – wird nachgereicht, falls noch nicht bekannt. Die Deckungsanfrage nennt dann den Versicherungsnehmer.">
                              <Input id="ma-vnr" value={rsv.nummer} onChange={(e) => setRsv({ ...rsv, nummer: e.target.value })} placeholder="z. B. RS-4471209" className="mono" autoComplete="off" />
                            </Field>
                            <Field label="Schadennummer" htmlFor="ma-snr" hint="Falls schon vergeben.">
                              <Input id="ma-snr" value={rsv.schadennummer} onChange={(e) => setRsv({ ...rsv, schadennummer: e.target.value })} className="mono" autoComplete="off" />
                            </Field>
                            <Field label="Selbstbeteiligung" htmlFor="ma-sb" hint="Optional – erscheint in der Zusammenfassung und später in der Rechnung.">
                              <div className="relative">
                                <Input id="ma-sb" inputMode="decimal" value={rsv.selbstbeteiligung} onChange={(e) => setRsv({ ...rsv, selbstbeteiligung: e.target.value })} placeholder="0" className="num !pr-9" />
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-3">€</span>
                              </div>
                            </Field>
                            <PflichtHinweis className="sm:col-span-2" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!rsv.aktiv && <p className="px-1 text-[13px] text-fg-3">Kein Rechtsschutz? Dann überspringen Sie diesen Schritt einfach. Sie können die Versicherung später in der Akte unter „Beteiligte → Rechtsschutz ergänzen“ nachtragen.</p>}
                  </div>
                )}

                {schritt === 3 && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)]">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Bei Ablehnung entsteht keine Akte – also auch kein Aktenzeichen (I3-T04-02) */}
                        {abgelehnt ? <Chip tone="seal">Abgelehnt – keine Akte</Chip> : <span className="mono rounded-[8px] bg-ink-soft px-2 py-0.5 text-[13px] font-semibold text-ink">{az}</span>}
                        <Chip>{sache.sachgebiet}</Chip>
                        {sache.prioritaet === "hoch" && <Chip tone="seal">Hohe Priorität</Chip>}
                      </div>
                      <div className="title-lg mt-2">{titel}</div>
                      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                        <Zeile label="Mandant">
                          <span className="flex items-center gap-2">
                            {mandant && <KontaktAvatar k={mandant} size={22} />}
                            {mandantName}
                            {modus === "neu" && <Chip tone="ink">neu</Chip>}
                          </span>
                        </Zeile>
                        <Zeile label="Gegner">{sache.gegner.trim() || "–"}</Zeile>
                        <Zeile label="Gegenstandswert">
                          <span className="num">{fmtEUR(Number.isNaN(wert) ? 0 : wert)}</span>
                        </Zeile>
                        <Zeile label="Bearbeitung">{bearbeiter?.name ?? "–"}</Zeile>
                        <Zeile label="Rechtsschutz">{rsv.aktiv ? `${rsv.versicherung} · ${rsv.nummer.trim() || "Nr. wird nachgereicht"}${rsv.schadennummer.trim() ? ` · Schaden-Nr. ${rsv.schadennummer.trim()}` : ""}` : "Keiner"}</Zeile>
                        {rsv.aktiv && (
                          <Zeile label="Selbstbeteiligung">
                            <span className="num">{rsv.selbstbeteiligung.trim() && !Number.isNaN(parseEuro(rsv.selbstbeteiligung)) ? fmtEUR(parseEuro(rsv.selbstbeteiligung)) : "keine angegeben"}</span>
                          </Zeile>
                        )}
                        {!abgelehnt && <Zeile label="Phase">Mandatsaufnahme</Zeile>}
                      </dl>
                    </div>
                    {!abgelehnt && arbeitsrecht && (klagefrist || wertVorschlag > 0) && (
                      <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)]">
                        <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                          <CalendarClock className="size-4 text-ink" /> Kündigungsschutz
                        </div>
                        <KschgVorschau klagefrist={klagefrist} entgelt={entgelt} wertVorschlag={wertVorschlag} wert={wert} onUebernehmen={() => wertUebernehmen("ma-wert-uebernommen")} mitRechenweg uebernommenId="ma-wert-uebernommen" />
                      </div>
                    )}
                    <KollisionsEntscheidung
                      treffer={treffer}
                      entscheidung={entscheidung}
                      vermerk={kollision.vermerk}
                      onEntscheidung={(e) => setKollision({ ...kollision, entscheidung: e, fuer: trefferKey })}
                      onVermerk={(v) => setKollision({ ...kollision, vermerk: v })}
                      fehler={zeigeFehler && !!fehler[3]}
                    />
                    {abgelehnt ? (
                      <div role="status" className="flex items-start gap-2.5 rounded-[18px] bg-ink-softer p-4 text-[13px] leading-snug text-fg-2 shadow-[inset_0_0_0_1px_var(--line)]">
                        <Info className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                        <span>
                          <span className="block font-semibold text-fg">Bei Ablehnung: keine Akte, kein Portal, Vermerk im Protokoll</span>
                          Es werden keine Vollmacht, keine Mandatsbestätigung und keine Fristen angelegt; die Entscheidung mit den Kollisionstreffern steht im Protokoll.
                        </span>
                      </div>
                    ) : (
                    <>
                    <div className="flex items-center gap-3 rounded-[16px] p-1">
                      <label htmlFor="ma-portal" className={cn("min-w-0 flex-1", mandantEmail && "cursor-pointer")}>
                        <span className="block text-[13.5px] font-semibold">Mandantenportal freischalten</span>
                        <span className="block text-[12.5px] text-fg-3">
                          {mandantEmail
                            ? `Zugangs-E-Mail an ${mandantEmail} – der Mandant sieht den Stand seiner Sache und kann Unterlagen sicher hochladen.${treffer.length && portalWahl === null ? " Wegen der Kollisionstreffer zunächst aus." : ""}`
                            : "Keine E-Mail-Adresse des Mandanten erfasst – ohne Adresse kein Portalzugang. Sie können das Portal später in der Akte freischalten."}
                        </span>
                      </label>
                      <Switch id="ma-portal" checked={portal} disabled={!mandantEmail} onChange={setPortalWahl} label="Mandantenportal freischalten" />
                    </div>
                    <div className="rounded-[18px] bg-ink-softer p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
                        <Zap className="size-4 text-ink" /> Das erledigt Apex automatisch
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5 text-[13px] text-fg-2">
                        {["Vollmacht zur digitalen Unterschrift", "Mandatsbestätigung", "Datenschutzhinweise (Art. 13 DSGVO)", "Bestätigung Hinweis Abrechnung nach Gegenstandswert (§ 49b Abs. 5 BRAO)", ...(sache.sachgebiet === "Arbeitsrecht" ? ["Bestätigung Hinweis Kostentragung Arbeitsgericht (§ 12a Abs. 1 S. 2 ArbGG)"] : []), ...(klagefrist ? [`Klagefrist bis ${fmtDate(klagefrist.ende)} und Vorfrist eintragen (zur Vier-Augen-Kontrolle)`] : []), "Aktennotiz „Kollisionsprüfung“", ...(rsv.aktiv ? [`Deckungsanfrage an ${rsv.versicherung || "die Versicherung"}`, "Wiedervorlage in 7 Tagen (Deckungszusage)"] : [])].map((t) => (
                          <li key={t} className="flex items-start gap-2">
                            <FilePlus2 className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="flex items-start gap-2 px-1 text-[12.5px] leading-snug text-fg-3">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Vor Übernahme des Mandats: Hinweis auf die Abrechnung nach dem Gegenstandswert (§ 49b Abs. 5 BRAO)
                        {sache.sachgebiet === "Arbeitsrecht" ? " und auf den Ausschluss der Kostenerstattung im ersten Rechtszug (§ 12a Abs. 1 S. 2 ArbGG)" : ""} erteilen – das Paket dokumentiert {sache.sachgebiet === "Arbeitsrecht" ? "beide Hinweise" : "den Hinweis"} zur Gegenzeichnung.
                      </span>
                    </p>
                    </>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {zeigeFehler && fehler[schritt] && (
              <motion.div
                key={`fehler-${schritt}`}
                id="ma-fehler"
                role="alert"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
                className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 flex-1 font-medium">{fehler[schritt]}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Modal>
    <Modal
      open={verwerfenFrage}
      onClose={weiterBearbeiten}
      size="sm"
      title="Eingaben verwerfen?"
      icon={<AlertTriangle className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={entwurfBehalten} className="mr-auto">
            Als Entwurf behalten
          </Button>
          <Button variant="danger" onClick={verwerfen}>
            Eingaben verwerfen
          </Button>
          <Button variant="primary" onClick={weiterBearbeiten} data-autofocus>
            Weiter bearbeiten
          </Button>
        </>
      }
    >
      <p className="text-[14px] text-fg-2">Die Mandatsaufnahme ist noch nicht abgeschlossen. Ihre Eingaben gehen beim Verwerfen verloren – als Entwurf behalten, können Sie sie beim nächsten Öffnen fortsetzen.</p>
    </Modal>
    </>
  );
}

/** „Entwurf fortsetzen?“ – Inhalt des gespeicherten Entwurfs in einer Zeile. */
function EntwurfFrage({ e, kontakte }: { e: Entwurf; kontakte: Kontakt[] }) {
  const mandant = e.modus === "bestehend" ? kontakte.find((k) => k.id === e.mandantId)?.name : entwurfName(e.entwurf);
  const titel = e.sache.titelManuell ? e.sache.titel : "";
  return (
    <div className="grid grid-cols-1 gap-3 py-2">
      <div className="flex items-start gap-3 rounded-[18px] bg-ink-softer p-4 text-[13.5px] shadow-[inset_0_0_0_1px_var(--line)]">
        <History className="mt-0.5 size-5 shrink-0 text-ink" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fg">Nicht abgeschlossene Mandatsaufnahme</div>
          <dl className="mt-1.5 grid gap-1 text-fg-2">
            <div>
              <dt className="inline text-fg-3">Mandant: </dt>
              <dd className="inline font-medium text-fg">{mandant || "noch nicht gewählt"}</dd>
            </div>
            {(titel || e.sache.gegner) && (
              <div>
                <dt className="inline text-fg-3">{titel ? "Titel: " : "Gegner: "}</dt>
                <dd className="inline">{titel || e.sache.gegner}</dd>
              </div>
            )}
            <div>
              <dt className="inline text-fg-3">Stand: </dt>
              <dd className="inline">
                Schritt {e.schritt + 1} von 4 „{SCHRITTE[Math.min(3, e.schritt)]}“ · zuletzt bearbeitet {fmtDate(e.gespeichert.slice(0, 10))}, {fmtTime(e.gespeichert)} Uhr
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <p className="px-1 text-[12.5px] text-fg-3">Der Entwurf liegt nur in diesem Browser – höchstens 24 Stunden, bis die Akte angelegt ist. „Neu beginnen“ verwirft ihn.</p>
    </div>
  );
}

/** Klagefrist (Fristenkern, Regel kschg_klage) und Gegenstandswert 3 × Bruttomonatsentgelt (§ 42 Abs. 2 S. 1 GKG). */
function KschgVorschau({
  klagefrist,
  entgelt,
  wertVorschlag,
  wert,
  onUebernehmen,
  mitRechenweg,
  uebernommenId,
}: {
  klagefrist: ReturnType<typeof berechneNachRegel> | null;
  entgelt: number;
  wertVorschlag: number;
  wert: number;
  onUebernehmen: () => void;
  mitRechenweg?: boolean;
  /** Fokusziel nach „Übernehmen“, wenn kein Eingabefeld daneben steht (Zusammenfassung) */
  uebernommenId?: string;
}) {
  if (!klagefrist && !wertVorschlag) return null;
  const uebernommen = wertVorschlag > 0 && Math.abs(wert - wertVorschlag) < 0.005;
  return (
    <div className="grid grid-cols-1 gap-2.5 text-[13px]">
      {klagefrist && (
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-fg-3">Klagefrist (§ 4 S. 1 KSchG):</span>
            <span className="font-semibold text-fg">{fmtDateWd(klagefrist.ende)}</span>
            <span className="text-fg-3">· Vorfrist {fmtDateWd(klagefrist.vorfrist)}</span>
          </div>
          {mitRechenweg && (
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[12.5px] leading-relaxed text-fg-2">
              {klagefrist.rechenweg.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          )}
          <p className="mt-1 text-[12.5px] text-fg-3">Wird bei der Anlage mit Vorfrist eingetragen – zur Vier-Augen-Kontrolle. Feiertage: Kanzleisitz; den Gerichtsort bei Klageerhebung prüfen.</p>
        </div>
      )}
      {wertVorschlag > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-fg-3">Gegenstandswert-Vorschlag:</span>
          <span className="num font-semibold text-fg">
            3 × {fmtEUR(entgelt)} = {fmtEUR(wertVorschlag)}
          </span>
          <span className="text-[12.5px] text-fg-3">(§ 42 Abs. 2 S. 1 GKG)</span>
          {uebernommen ? (
            <span id={uebernommenId} tabIndex={uebernommenId ? -1 : undefined} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]">
              <Chip tone="green" icon={<Check className="size-3" />}>
                übernommen
              </Chip>
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={onUebernehmen}>
              Übernehmen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Kollisionstreffer: Entscheidung „trotzdem übernehmen“ (mit Pflichtbegründung) oder „ablehnen“. */
function KollisionsEntscheidung({
  treffer,
  entscheidung,
  vermerk,
  onEntscheidung,
  onVermerk,
  fehler,
}: {
  treffer: string[];
  entscheidung: Kollision["entscheidung"];
  vermerk: string;
  onEntscheidung: (e: "uebernommen" | "abgelehnt") => void;
  onVermerk: (v: string) => void;
  fehler: boolean;
}) {
  if (!treffer.length)
    return (
      <p className="flex items-start gap-2 px-1 text-[12.5px] text-fg-3">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green" />
        <span>Kollisionsprüfung: keine Treffer im Aktenbestand – {GEPRUEFT_TEXT}. Das Ergebnis wird als Aktennotiz „Kollisionsprüfung“ dokumentiert.</span>
      </p>
    );
  return (
    <section className={cn("rounded-[18px] bg-seal-soft p-4 text-[13px]", fehler && "ring-2 ring-[var(--seal)]")} aria-labelledby="ma-kollision-titel">
      <div id="ma-kollision-titel" className="flex items-center gap-2 font-semibold text-seal">
        <AlertTriangle className="size-4 shrink-0" /> Kollisionsprüfung: {treffer.length} Treffer – Entscheidung erforderlich
      </div>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-fg-2">
        {treffer.map((t) => (
          <li key={t} className="break-words">
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Entscheidung über die Kollision">
        {(
          [
            ["uebernommen", "Mandat trotzdem übernehmen", "Mit Begründung (Pflicht) – Vermerk in Akte und Verlauf"],
            ["abgelehnt", "Mandat ablehnen", "Keine Akte – Protokolleintrag mit den Treffern"],
          ] as const
        ).map(([wert, label, sub]) => (
          <button
            key={wert}
            type="button"
            role="radio"
            aria-checked={entscheidung === wert}
            onClick={() => onEntscheidung(wert)}
            className={cn(
              "min-h-11 rounded-[14px] px-3.5 py-2.5 text-left ring-1 ring-inset transition-colors",
              entscheidung === wert ? "bg-[var(--surface)] text-fg ring-2 ring-[var(--ink)]" : "bg-[var(--surface)]/60 text-fg-2 ring-[var(--line)] hover:bg-[var(--surface)]",
            )}
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              {wert === "uebernommen" ? <UserCheck className="size-4" /> : <Ban className="size-4" />} {label}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-fg-3">{sub}</span>
          </button>
        ))}
      </div>
      {entscheidung && (
        <Field label={entscheidung === "uebernommen" ? "Begründung (Pflicht)" : "Vermerk (optional)"} htmlFor="ma-kollision-vermerk" className="mt-3">
          <Textarea
            id="ma-kollision-vermerk"
            rows={2}
            value={vermerk}
            onChange={(e) => onVermerk(e.target.value)}
            placeholder={entscheidung === "uebernommen" ? "z. B. anderer Lebenssachverhalt – kein widerstreitendes Interesse nach § 43a Abs. 4 BRAO, § 3 BORA" : "z. B. Mandant an Kollegin verwiesen"}
          />
        </Field>
      )}
    </section>
  );
}

function PflichtHinweis({ className }: { className?: string }) {
  return <p className={cn("px-1 text-[12.5px] text-fg-3", className)}>* Pflichtfeld</p>;
}

function BereitsZugeordnet({ nachricht, akte, onOeffnen }: { nachricht: Nachricht; akte?: Akte; onOeffnen: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 py-2">
      <div className="flex items-start gap-3 rounded-[18px] bg-amber-soft p-4 text-[13.5px]" role="status">
        <Info className="mt-0.5 size-5 shrink-0 text-amber" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fg">Diese Anfrage ist bereits einer Akte zugeordnet</div>
          <p className="mt-1 text-fg-2">
            „{nachricht.betreff}“ von {nachricht.von} wurde schon übernommen. Damit keine doppelte Akte entsteht, legt Apex aus derselben Nachricht keine zweite an.
          </p>
        </div>
      </div>
      {akte ? (
        <Link
          to={`/akten/${akte.id}`}
          onClick={onOeffnen}
          className="group flex min-w-0 items-center gap-3 rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)] transition-colors hover:bg-ink-softer"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
            <FolderOpen className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mono block text-[12.5px] font-semibold text-ink">{akte.aktenzeichen}</span>
            <span className="block truncate text-[14px] font-semibold">{akte.titel}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
      ) : (
        <p className="px-1 text-[13px] text-fg-3">Die zugeordnete Akte ist nicht mehr vorhanden.</p>
      )}
    </div>
  );
}

function Zeile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{children}</dd>
    </div>
  );
}

/** Kollisionstreffer bleiben bis zur Zusammenfassung sichtbar – dort fällt die Entscheidung. */
function KonfliktHinweis({ treffer }: { treffer: string[] }) {
  return (
    <AnimatePresence initial={false}>
      {treffer.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 flex gap-3 rounded-[16px] bg-seal-soft p-3.5 text-[13px] text-seal" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">Möglicher Interessenkonflikt (§ 43a Abs. 4 BRAO) – {treffer.length} Treffer</div>
            <ul className="mt-1 list-disc pl-4 text-fg-2">
              {treffer.slice(0, 4).map((t) => (
                <li key={t} className="break-words">
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-[12.5px] text-fg-2">Sie entscheiden in der Zusammenfassung: Mandat mit Begründung übernehmen oder ablehnen.</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Schrittleiste({ schritt, gueltig, onGehe }: { schritt: number; gueltig: boolean[]; onGehe: (n: number) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5 rounded-full bg-ink-softer p-1 shadow-[inset_0_0_0_1px_var(--line)]">
      {SCHRITTE.map((s, i) => {
        const erreichbar = i <= schritt || gueltig.slice(0, i).every(Boolean);
        const fertig = i < schritt;
        const aktiv = i === schritt;
        return (
          <li key={s}>
            <button
              type="button"
              disabled={!erreichbar}
              onClick={() => onGehe(i)}
              className={cn("relative flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors", aktiv ? "text-fg" : fertig ? "text-fg-2 hover:text-fg" : "text-fg-3")}
              aria-current={aktiv ? "step" : undefined}
            >
              {aktiv && (
                <motion.span
                  layoutId="ma-schritt"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  className="absolute inset-0 rounded-full bg-[var(--glass-strong)] shadow-[0_1px_0_0_var(--glass-rim-3)_inset,0_2px_10px_-2px_rgba(20,30,80,0.18),0_0_0_1px_var(--line)]"
                />
              )}
              <span className={cn("relative grid size-5 place-items-center rounded-full text-[10.5px] font-semibold", fertig ? "bg-green text-surface" : aktiv ? "bg-ink text-on-ink" : "bg-[var(--line-strong)] text-fg-2")}>
                {fertig ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="relative hidden sm:inline">{s}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ErfolgsAnsicht({ erfolg }: { erfolg: { akte: Akte; schritte: { text: string; sub?: string }[]; minuten: number } }) {
  return (
    <div className="grid grid-cols-1 gap-5 pb-2 pt-4">
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          className="ai-ring ai-glow grid grid-cols-1 size-16 place-items-center rounded-[22px] bg-[var(--surface)]"
        >
          <Sparkles className="size-7 text-violet" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-4">
          <div className="mono text-[13px] font-semibold text-ink">{erfolg.akte.aktenzeichen}</div>
          <div className="title-lg mt-0.5">{erfolg.akte.titel}</div>
        </motion.div>
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {erfolg.schritte.map((s, i) => (
          <motion.li
            key={s.text}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.16, type: "spring", stiffness: 460, damping: 34 }}
            className="flex items-center gap-3 rounded-[14px] bg-[var(--surface)] px-3.5 py-2.5 shadow-[0_0_0_1px_var(--line)]"
          >
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.42 + i * 0.16, type: "spring", stiffness: 600, damping: 22 }} className="grid grid-cols-1 size-6 shrink-0 place-items-center rounded-full bg-green text-surface">
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[13.5px] font-medium">{s.text}</span>
              {s.sub && <span className="block break-words text-[12.5px] text-fg-3">{s.sub}</span>}
            </span>
          </motion.li>
        ))}
      </ul>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + erfolg.schritte.length * 0.16 }} className="grid grid-cols-1 gap-2">
        <div className="flex items-center justify-center gap-2 text-[13px] text-fg-2">
          <Zap className="size-4 text-ink" />
          <span>
            <span className="num font-semibold text-fg">≈ {erfolg.minuten} Minuten</span> Routinearbeit automatisch erledigt
          </span>
        </div>
        <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden>
          <motion.span className="block h-full rounded-full bg-ink" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 5.2, ease: "linear" }} />
        </div>
        <div className="text-center text-[12.5px] text-fg-3">Die Akte öffnet sich gleich automatisch.</div>
      </motion.div>
    </div>
  );
}

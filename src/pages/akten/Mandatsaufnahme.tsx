// Mandatsaufnahme: neue Akte in vier Schritten – inkl. automatischem Mandatsaufnahme-Paket.
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, FilePlus2, FolderPlus, Inbox, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { Akte, Dokument, Frist, Kontakt, Nachricht, Sachgebiet } from "@/core/types";
import { fmtDate, fmtDateWd, fmtEUR, nowLocal, today, uid } from "@/core/dates";
import { VERSICHERUNGEN } from "@/core/seed/pools";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { Button, Chip, Field, Input, Modal, Segmented, Select, Switch, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { KontaktAuswahl, KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, entwurfZuKontakt, leererEntwurf, type KontaktEntwurf } from "@/pages/kontakte/KontaktFormular";
import { aktenVonKontakt, findeKontaktNachName, istOrganisationsName, KontaktAvatar } from "@/pages/kontakte/kontaktHelfer";
import { SACHGEBIETE, naechstesAktenzeichen, useTeam, werktagIn } from "./helfer";

const SCHRITTE = ["Mandant", "Sache", "Rechtsschutz", "Zusammenfassung"] as const;

const SCHRITT_VARIANTEN = {
  rein: (r: number) => ({ opacity: 0, x: r * 28 }),
  da: { opacity: 1, x: 0 },
  raus: (r: number) => ({ opacity: 0, x: r * -20, transition: { duration: 0.14, ease: "easeIn" as const } }),
};

interface Sache {
  titel: string;
  titelManuell: boolean;
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
  const [sache, setSache] = useState<Sache>({ titel: "", titelManuell: false, sachgebiet: "Arbeitsrecht", gegner: "", wert: "", beschreibung: "", prioritaet: "normal", bearbeiterId: standardBearbeiter });
  const [rsv, setRsv] = useState<Rsv>({ aktiv: false, versicherung: "", nummer: "", schadennummer: "", selbstbeteiligung: "" });
  const [portal, setPortal] = useState(true);
  const [erfolg, setErfolg] = useState<{ akte: Akte; schritte: { text: string; sub?: string }[]; minuten: number } | null>(null);
  const [quelle, setQuelle] = useState<Nachricht | undefined>();

  // Beim Öffnen frisch beginnen
  useEffect(() => {
    if (!open) return;
    setSchritt(0);
    setModus("bestehend");
    setMandantId(undefined);
    setEntwurf(leererEntwurf());
    setSache({ titel: "", titelManuell: false, sachgebiet: (tenant.schwerpunkte[0] as Sachgebiet) ?? "Arbeitsrecht", gegner: "", wert: "", beschreibung: "", prioritaet: "normal", bearbeiterId: standardBearbeiter });
    setRsv({ aktiv: false, versicherung: "", nummer: "", schadennummer: "", selbstbeteiligung: "" });
    setPortal(true);
    setErfolg(null);
    setQuelle(undefined);

    // Aus dem Posteingang: /akten?neu=1&nachricht=<id> – Anfrage übernehmen
    const st = useData.getState().data;
    const n = nachrichtId ? st.nachrichten.find((x) => x.id === nachrichtId) : undefined;
    if (n) {
      setQuelle(n);
      const adresse = n.vonAdresse?.trim().toLowerCase();
      const bekannt = adresse ? st.kontakte.find((k) => k.email?.trim().toLowerCase() === adresse) : undefined;
      if (bekannt) {
        setMandantId(bekannt.id);
      } else {
        const org = istOrganisationsName(n.von);
        const teile = n.von.trim().split(/\s+/);
        setModus("neu");
        setEntwurf({
          ...leererEntwurf(org ? "organisation" : "person"),
          vorname: org ? "" : teile.slice(0, -1).join(" "),
          nachname: org ? "" : teile[teile.length - 1] ?? "",
          firma: org ? n.von.trim() : "",
          email: n.vonAdresse ?? "",
        });
      }
      const text = `${n.betreff}\n${n.text}\n${n.ki?.zusammenfassung ?? ""}`;
      const titelVorschlag = titelAusBetreff(n.betreff);
      setSache((s) => ({ ...s, titel: titelVorschlag, titelManuell: !!titelVorschlag, beschreibung: n.text.trim(), sachgebiet: sachgebietAusText(text) ?? s.sachgebiet }));
      const versicherer = [...new Set([...VERSICHERUNGEN, ...st.kontakte.filter((k) => k.rollen.includes("versicherung")).map((k) => k.name)])];
      const treffer = versicherer.find((v) => new RegExp(`\\b${regexEscape(v.split(/\s+/)[0])}`, "i").test(text));
      if (treffer || /rechtsschutz/i.test(text)) setRsv((r) => ({ ...r, aktiv: true, versicherung: treffer ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nachrichtId]);

  const mandant = modus === "bestehend" ? kontakte.find((k) => k.id === mandantId) : undefined;
  const mandantName = modus === "bestehend" ? mandant?.name ?? "" : entwurfName(entwurf);
  const mandantKurz = modus === "bestehend" ? (mandant ? kurzName(mandant) : "") : entwurf.typ === "person" ? entwurf.nachname.trim() : entwurf.firma.trim();
  const titelVorschlag = mandantKurz ? (sache.gegner.trim() ? `${mandantKurz} ./. ${sache.gegner.trim()}` : `${mandantKurz} – ${sache.sachgebiet}`) : "";
  const titel = sache.titelManuell ? sache.titel : titelVorschlag;
  const wert = sache.wert.trim() ? parseEuro(sache.wert) : 0;
  const az = useMemo(() => naechstesAktenzeichen(akten), [akten]);
  const bearbeiter = team.find((u) => u.id === sache.bearbeiterId);

  // Interessenkonflikt-Hinweise
  const mandantKonflikt = useMemo(() => {
    const k = modus === "bestehend" ? mandant : findeKontaktNachName(kontakte, entwurfName(entwurf));
    if (!k) return [];
    return aktenVonKontakt(k, akten).filter((x) => (x.rolle === "Gegner" || x.rolle === "Schuldner") && x.akte.status !== "abgeschlossen");
  }, [modus, mandant, entwurf, kontakte, akten]);
  const gegnerKontakt = findeKontaktNachName(kontakte, sache.gegner);
  const gegnerKonflikt = useMemo(() => (gegnerKontakt ? aktenVonKontakt(gegnerKontakt, akten).filter((x) => x.rolle === "Mandant" && x.akte.status !== "abgeschlossen") : []), [gegnerKontakt, akten]);

  const versicherungen = useMemo(() => [...new Set([...VERSICHERUNGEN, ...kontakte.filter((k) => k.rollen.includes("versicherung")).map((k) => k.name)])], [kontakte]);

  const gueltig = [
    modus === "bestehend" ? !!mandant : entwurfGueltig(entwurf) && !emailUngueltig(entwurf.email),
    !!titel.trim() && !!sache.bearbeiterId && !Number.isNaN(wert) && wert >= 0,
    !rsv.aktiv || (!!rsv.versicherung.trim() && !!rsv.nummer.trim()),
    true,
  ];

  const gehe = (n: number) => {
    setRichtung(n > schritt ? 1 : -1);
    setSchritt(n);
  };

  const erstelle = () => {
    const st = useData.getState();
    const data = st.data;
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
      const ex = findeKontaktNachName(data.kontakte, gName);
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

    // Versicherung als Kontakt führen
    const vName = rsv.versicherung.trim();
    if (rsv.aktiv && vName) {
      const ex = findeKontaktNachName(data.kontakte, vName);
      if (!ex) st.upsert("kontakte", { id: uid("k"), typ: "organisation", name: vName, firma: vName, rollen: ["versicherung"], createdAt: jetzt });
      else if (!ex.rollen.includes("versicherung")) st.patch("kontakte", ex.id, { rollen: [...ex.rollen, "versicherung"] });
    }

    const refa = team.find((u) => u.rolle === "refa");
    const ra = team.find((u) => u.id === sache.bearbeiterId) ?? user;
    const sb = rsv.selbstbeteiligung.trim() ? parseEuro(rsv.selbstbeteiligung) : undefined;
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
      rsv: rsv.aktiv ? { versicherung: vName, versicherungsnummer: rsv.nummer.trim(), schadennummer: rsv.schadennummer.trim() || undefined, deckung: "angefragt", selbstbeteiligung: sb !== undefined && !Number.isNaN(sb) ? sb : undefined } : undefined,
      beschreibung: sache.beschreibung.trim(),
      schlagworte: [sache.sachgebiet.toLowerCase()],
      prioritaet: sache.prioritaet,
      createdAt: jetzt,
      updatedAt: jetzt,
      mandantenportal: portal,
    };
    st.upsert("akten", akte);

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
        inhalt: `${m.name}\n${[m.strasse, [m.plz, m.ort].filter(Boolean).join(" ")].filter(Boolean).join("\n")}\n\n${ort}, ${fmtDate(heute)}\nUnser Zeichen: ${aktenzeichen}\n\nMandatsbestätigung – ${akte.titel}\n\n${anrede},\n\nvielen Dank für Ihr Vertrauen. Hiermit bestätigen wir die Übernahme des Mandats in der oben genannten Angelegenheit. Zuständig ist ${ra.name}${refa ? `; im Sekretariat erreichen Sie ${refa.name}` : ""}.\n\nIhre nächsten Schritte:\n• Bitte unterzeichnen Sie die beigefügte Vollmacht digital.\n• Senden Sie uns alle Unterlagen zur Sache (Schreiben, Verträge, Fotos, Fristsetzungen) – gern über das Mandantenportal oder per E-Mail.${akte.rsv ? `\n• Wir haben Ihre Rechtsschutzversicherung (${akte.rsv.versicherung}) um Deckungszusage gebeten und informieren Sie über die Antwort.` : ""}${portal ? "\n• Über das Mandantenportal können Sie den Stand Ihrer Sache jederzeit einsehen." : ""}\n\nBitte beachten Sie die beigefügten Datenschutzhinweise und den Hinweis zur Abrechnung nach dem Gegenstandswert.\n\n${gruss}`,
      }),
      dok({
        name: "Datenschutzhinweise (Art. 13 DSGVO)", art: "brief", ordner: "Mandant",
        inhalt: `Informationen zur Verarbeitung Ihrer personenbezogenen Daten nach Art. 13 DSGVO\n\n1. Verantwortlicher\n${tenant.name}, ${tenant.adresse}\n\n2. Zwecke und Rechtsgrundlagen\nWir verarbeiten Ihre Daten zur Durchführung des Mandats (Art. 6 Abs. 1 lit. b DSGVO) und zur Erfüllung berufsrechtlicher und gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO, u. a. § 50 BRAO, Geldwäschegesetz).\n\n3. Empfänger\nGerichte, Behörden, die Gegenseite und deren Bevollmächtigte sowie Versicherungen – jeweils nur, soweit dies für die Bearbeitung des Mandats erforderlich ist.\n\n4. Speicherdauer\nDie Handakte bewahren wir nach § 50 Abs. 1 BRAO sechs Jahre nach Ablauf des Kalenderjahres auf, in dem der Auftrag beendet wurde.\n\n5. Ihre Rechte\nAuskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) sowie Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO).\n\n6. Verschwiegenheit\nAlle Informationen unterliegen der anwaltlichen Verschwiegenheitspflicht (§ 43a Abs. 2 BRAO, § 203 StGB).`,
      }),
      dok({
        name: "Hinweis Abrechnung nach Gegenstandswert (§ 49b Abs. 5 BRAO)", art: "brief", ordner: "Mandant",
        inhalt: `Hinweis nach § 49b Abs. 5 BRAO\n\nUnser Zeichen: ${aktenzeichen} – ${akte.titel}\n\n${anrede},\n\ndie für unsere Tätigkeit zu erhebenden Gebühren richten sich nach dem Gegenstandswert (§ 2 Abs. 1 RVG). Den Gegenstandswert schätzen wir derzeit vorläufig auf ${fmtEUR(akte.gegenstandswert)}. Er kann sich im Verlauf des Mandats ändern.\n\nZu diesem Hinweis sind wir vor Übernahme des Auftrags gesetzlich verpflichtet.\n\nZur Kenntnis genommen:\n\n${ort}, den ${fmtDate(heute)}\n\n______________________________\n${m.name}`,
      }),
    ];
    let wiedervorlage: string | undefined;
    if (akte.rsv) {
      paket.push(
        dok({
          name: `Deckungsanfrage ${akte.rsv.versicherung}`, art: "schriftsatz", ordner: "Korrespondenz", format: "docx",
          inhalt: `${akte.rsv.versicherung}\nSchadenabteilung\n\n${ort}, ${fmtDate(heute)}\n\nVersicherungsnehmer: ${m.name}\nVersicherungsnummer: ${akte.rsv.versicherungsnummer}${akte.rsv.schadennummer ? `\nSchadennummer: ${akte.rsv.schadennummer}` : ""}\nUnser Zeichen: ${aktenzeichen}\n\nDeckungsanfrage – ${akte.titel}\n\nSehr geehrte Damen und Herren,\n\nwir zeigen an, dass uns Ihr Versicherungsnehmer mit der Wahrnehmung seiner rechtlichen Interessen beauftragt hat, und bitten um Erteilung der Deckungszusage für die außergerichtliche und gegebenenfalls gerichtliche Tätigkeit (${akte.sachgebiet}).\n\nSachverhalt:\n${akte.beschreibung || "Die ausführliche Sachverhaltsschilderung reichen wir kurzfristig nach."}${gName ? `\n\nGegner: ${gName}` : ""}\nGegenstandswert (vorläufig): ${fmtEUR(akte.gegenstandswert)}\n\nFür eine kurzfristige Bestätigung wären wir dankbar.\n\n${gruss}`,
        }),
      );
      wiedervorlage = werktagIn(7, tenant.bundesland);
      const f: Frist = {
        id: uid("f"), akteId: akte.id, titel: `Wiedervorlage: Deckungszusage ${akte.rsv.versicherung}`, typ: "wiedervorlage", datum: wiedervorlage,
        status: "offen", verantwortlichId: refa?.id ?? ra.id, quelle: "automatisch", createdAt: jetzt, notiz: "Automatisch gesetzt durch das Mandatsaufnahme-Paket.",
      };
      st.upsert("fristen", f);
    }
    for (const d of paket) st.upsert("dokumente", d);

    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Akte angelegt – ${aktenzeichen} ${akte.titel}` });
    st.log({
      akteur: "automation", automationKey: "mandatsaufnahme", akteId: akte.id, minutenGespart: 25,
      text: `Mandatsaufnahme-Paket (Vollmacht, Mandatsbestätigung, Datenschutzhinweise, Hinweis § 49b Abs. 5 BRAO) erstellt – ${aktenzeichen}`,
    });
    if (akte.rsv && wiedervorlage) {
      st.log({
        akteur: "automation", automationKey: "deckungsanfrage", akteId: akte.id, minutenGespart: 15,
        text: `Deckungsanfrage an ${akte.rsv.versicherung} erstellt, Wiedervorlage am ${fmtDate(wiedervorlage)} gesetzt – ${aktenzeichen}`,
      });
    }
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
    for (const key of akte.rsv ? ["mandatsaufnahme", "deckungsanfrage"] : ["mandatsaufnahme"]) {
      const au = data.automationen.find((a) => a.key === key);
      if (au) st.patch("automationen", au.id, { laeufe: au.laeufe + 1, letzterLauf: jetzt });
    }

    setErfolg({
      akte,
      minuten: akte.rsv ? 40 : 25,
      schritte: [
        { text: `Akte ${aktenzeichen} angelegt`, sub: akte.titel },
        { text: "Vollmacht erzeugt", sub: "Zur digitalen Unterschrift an den Mandanten" },
        { text: "Mandatsbestätigung erstellt", sub: `Ordner „Mandant“ · ${ra.name}` },
        { text: "Datenschutzhinweise nach Art. 13 DSGVO", sub: "Automatisch beigefügt" },
        { text: "Hinweis Abrechnung nach Gegenstandswert", sub: "§ 49b Abs. 5 BRAO" },
        ...(akte.rsv && wiedervorlage
          ? [
              { text: `Deckungsanfrage an ${akte.rsv.versicherung}`, sub: "Ordner „Korrespondenz“ – mit Sachverhalt und Gegenstandswert" },
              { text: `Wiedervorlage am ${fmtDateWd(wiedervorlage)}`, sub: "Deckungszusage nachhalten" },
            ]
          : []),
        ...(quelle ? [{ text: "Anfrage aus dem Posteingang zugeordnet", sub: `„${quelle.betreff}“ – abgelegt in „Korrespondenz“` }] : []),
      ],
    });
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
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} className="mr-auto">
        Abbrechen
      </Button>
      {schritt > 0 && (
        <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => gehe(schritt - 1)}>
          Zurück
        </Button>
      )}
      {schritt < 3 ? (
        <Button variant="primary" disabled={!gueltig[schritt]} iconRight={<ArrowRight className="size-4" />} onClick={() => gehe(schritt + 1)}>
          {schritt === 2 && !rsv.aktiv ? "Ohne Rechtsschutz weiter" : "Weiter"}
        </Button>
      ) : (
        <Button variant="primary" icon={<FolderPlus className="size-4" />} onClick={erstelle} disabled={!gueltig.slice(0, 3).every(Boolean)}>
          Akte anlegen
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={erfolg ? <CheckCircle2 className="size-[18px]" /> : <FolderPlus className="size-[18px]" />}
      title={erfolg ? "Akte angelegt" : "Mandatsaufnahme"}
      subtitle={erfolg ? "Das Mandatsaufnahme-Paket wurde automatisch erstellt." : "Neue Akte in vier Schritten – Vollmacht, Mandatsbestätigung und Datenschutzhinweise erstellt AnwaltApex automatisch."}
      footer={footer}
    >
      {erfolg ? (
        <ErfolgsAnsicht erfolg={erfolg} />
      ) : (
        <>
          {quelle && (
            <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-violet-soft px-3.5 py-2.5 text-[12.5px]">
              <Inbox className="size-4 shrink-0 text-violet" />
              <span className="min-w-0 flex-1 truncate text-fg-2">
                Übernommen aus dem Posteingang: <span className="font-semibold text-fg">{quelle.von}</span> – „{quelle.betreff}“
              </span>
            </div>
          )}
          <Schrittleiste schritt={schritt} gueltig={gueltig} onGehe={gehe} />
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
                      <KontaktAuswahl id="ma-mandant" value={mandantId} onSelect={(k) => setMandantId(k.id)} bevorzugt={["mandant"]} hoehe={260} />
                    ) : (
                      <KontaktFelder idPrefix="ma-neu" value={entwurf} onChange={setEntwurf} />
                    )}
                    <KonfliktHinweis
                      treffer={mandantKonflikt.map((x) => `${x.akte.aktenzeichen} ${x.akte.titel}`)}
                      text={`${mandantName || "Dieser Kontakt"} ist in folgenden Akten Gegner:`}
                    />
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
                      <Field label="Gegner" htmlFor="ma-gegner" hint={sache.gegner.trim() ? (gegnerKontakt ? "Bestehender Kontakt wird verknüpft." : "Wird als neuer Kontakt angelegt.") : "Optional – z. B. Arbeitgeber, Vermieter, Versicherung."}>
                        <Input id="ma-gegner" list="ma-gegner-liste" value={sache.gegner} onChange={(e) => setSache({ ...sache, gegner: e.target.value })} placeholder="Name oder Firma" autoComplete="off" />
                        <datalist id="ma-gegner-liste">
                          {kontakte.filter((k) => !k.rollen.includes("gericht")).slice(0, 300).map((k) => (
                            <option key={k.id} value={k.name} />
                          ))}
                        </datalist>
                      </Field>
                    </div>
                    <Field label="Titel der Akte" htmlFor="ma-titel" hint={!sache.titelManuell && titelVorschlag ? "Automatisch aus Mandant und Gegner – Sie können ihn anpassen." : undefined}>
                      <Input id="ma-titel" value={titel} onChange={(e) => setSache({ ...sache, titel: e.target.value, titelManuell: true })} placeholder="z. B. Weber ./. Kröger Logistik GmbH" />
                    </Field>
                    <KonfliktHinweis treffer={gegnerKonflikt.map((x) => `${x.akte.aktenzeichen} ${x.akte.titel}`)} text={`${sache.gegner.trim()} ist Mandant in:`} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Gegenstandswert" htmlFor="ma-wert" hint={Number.isNaN(wert) ? <span className="text-seal">Bitte einen Betrag wie 10.200 oder 4860,50 eingeben.</span> : wert > 0 ? `${fmtEUR(wert)} – Grundlage der Gebühren nach RVG` : "Vorläufig, kann später angepasst werden."}>
                        <div className="relative">
                          <Input id="ma-wert" inputMode="decimal" value={sache.wert} onChange={(e) => setSache({ ...sache, wert: e.target.value })} placeholder="0" className="num !pr-9" />
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-4">€</span>
                        </div>
                      </Field>
                      <Field label="Bearbeitung (Rechtsanwalt)" htmlFor="ma-ra">
                        <Select id="ma-ra" value={sache.bearbeiterId} onChange={(e) => setSache({ ...sache, bearbeiterId: e.target.value })}>
                          {anwaelte.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
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
                  </div>
                )}

                {schritt === 2 && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 rounded-[16px] bg-ink-softer p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                      <span className="grid grid-cols-1 size-10 shrink-0 place-items-center rounded-[12px] bg-ink-soft text-ink">
                        <ShieldCheck className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold">Mandant ist rechtsschutzversichert</div>
                        <div className="text-[12.5px] text-fg-3">AnwaltApex erstellt dann automatisch die Deckungsanfrage und setzt eine Wiedervorlage in 7 Tagen.</div>
                      </div>
                      <Switch id="ma-rsv" checked={rsv.aktiv} onChange={(v) => setRsv({ ...rsv, aktiv: v })} label="Rechtsschutzversicherung vorhanden" />
                    </div>
                    <AnimatePresence initial={false}>
                      {rsv.aktiv && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 420, damping: 38 }} className="overflow-hidden">
                          <div className="grid grid-cols-1 gap-3 p-0.5 sm:grid-cols-2">
                            <Field label="Versicherung *" htmlFor="ma-vers" className="sm:col-span-2">
                              <Input id="ma-vers" list="ma-vers-liste" value={rsv.versicherung} onChange={(e) => setRsv({ ...rsv, versicherung: e.target.value })} placeholder="z. B. Nordlicht Rechtsschutz AG" autoComplete="off" />
                              <datalist id="ma-vers-liste">
                                {versicherungen.map((v) => (
                                  <option key={v} value={v} />
                                ))}
                              </datalist>
                            </Field>
                            <Field label="Versicherungsnummer *" htmlFor="ma-vnr">
                              <Input id="ma-vnr" value={rsv.nummer} onChange={(e) => setRsv({ ...rsv, nummer: e.target.value })} placeholder="z. B. RS-4471209" className="mono" autoComplete="off" />
                            </Field>
                            <Field label="Schadennummer" htmlFor="ma-snr" hint="Falls schon vergeben.">
                              <Input id="ma-snr" value={rsv.schadennummer} onChange={(e) => setRsv({ ...rsv, schadennummer: e.target.value })} className="mono" autoComplete="off" />
                            </Field>
                            <Field label="Selbstbeteiligung" htmlFor="ma-sb">
                              <div className="relative">
                                <Input id="ma-sb" inputMode="decimal" value={rsv.selbstbeteiligung} onChange={(e) => setRsv({ ...rsv, selbstbeteiligung: e.target.value })} placeholder="0" className="num !pr-9" />
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-4">€</span>
                              </div>
                            </Field>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!rsv.aktiv && <p className="px-1 text-[13px] text-fg-3">Kein Rechtsschutz? Dann überspringen Sie diesen Schritt einfach. Sie können die Versicherung später in der Akte ergänzen.</p>}
                  </div>
                )}

                {schritt === 3 && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-[18px] bg-[var(--surface)] p-4 shadow-[0_0_0_1px_var(--line)]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="mono rounded-[8px] bg-ink-soft px-2 py-0.5 text-[13px] font-semibold text-ink">{az}</span>
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
                        <Zeile label="Rechtsschutz">{rsv.aktiv ? `${rsv.versicherung} · ${rsv.nummer}` : "Keiner"}</Zeile>
                        <Zeile label="Phase">Mandatsaufnahme</Zeile>
                      </dl>
                    </div>
                    <div className="flex items-center gap-3 rounded-[16px] p-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold">Mandantenportal freischalten</div>
                        <div className="text-[12.5px] text-fg-3">Der Mandant sieht den Stand seiner Sache und kann Unterlagen sicher hochladen.</div>
                      </div>
                      <Switch id="ma-portal" checked={portal} onChange={setPortal} label="Mandantenportal freischalten" />
                    </div>
                    <div className="rounded-[18px] bg-ink-softer p-4 shadow-[inset_0_0_0_1px_var(--line)]">
                      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
                        <Zap className="size-4 text-ink" /> Das erledigt AnwaltApex automatisch
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5 text-[13px] text-fg-2">
                        {["Vollmacht zur digitalen Unterschrift", "Mandatsbestätigung", "Datenschutzhinweise (Art. 13 DSGVO)", "Hinweis Abrechnung nach Gegenstandswert (§ 49b Abs. 5 BRAO)", ...(rsv.aktiv ? [`Deckungsanfrage an ${rsv.versicherung || "die Versicherung"}`, "Wiedervorlage in 7 Tagen (Deckungszusage)"] : [])].map((t) => (
                          <li key={t} className="flex items-start gap-2">
                            <FilePlus2 className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </Modal>
  );
}

function Zeile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow !text-[10px]">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  );
}

function KonfliktHinweis({ treffer, text }: { treffer: string[]; text: string }) {
  return (
    <AnimatePresence initial={false}>
      {treffer.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex gap-3 rounded-[16px] bg-seal-soft p-3.5 text-[13px] text-seal" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold">Möglicher Interessenkonflikt (§ 43a Abs. 4 BRAO)</div>
            <div className="mt-0.5 text-fg-2">{text}</div>
            <ul className="mt-1 list-disc pl-4 text-fg-2">
              {treffer.slice(0, 4).map((t) => (
                <li key={t} className="truncate">
                  {t}
                </li>
              ))}
            </ul>
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
              <span className="block truncate text-[13.5px] font-medium">{s.text}</span>
              {s.sub && <span className="block truncate text-[12px] text-fg-3">{s.sub}</span>}
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
        <div className="text-center text-[11.5px] text-fg-4">Die Akte öffnet sich gleich automatisch.</div>
      </motion.div>
    </div>
  );
}

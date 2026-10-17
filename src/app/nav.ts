import {
  LayoutDashboard, FolderOpen, Inbox, CalendarClock, Sparkles, Library, Zap, ReceiptEuro, Users, ArrowRightLeft, LifeBuoy, Settings,
  type LucideIcon,
} from "lucide-react";
import type { Ansprechpartner, Rolle } from "@/core/types";
import { ansprechText } from "@/lib/rollen";

export interface NavItem {
  to: string;
  label: string;
  /** Kurzbeschriftung für schmale Leisten (Tablet-Leiste, mobile Tab-Leiste) – höchstens ein Wort. */
  kurz?: string;
  icon: LucideIcon;
  beschreibung: string;
  gruppe: "Arbeiten" | "Intelligenz" | "Kanzlei" | "Service";
  hilfe: string;
  /** Rollen ohne Zugriff (Navigation blendet den Bereich aus, die Route zeigt „Kein Zugriff“). */
  gesperrtFuer?: Rolle[];
}

/** Zentrale Navigation – jede Funktion mit klarem Namen und einem Satz, der sie erklärt. */
export const NAV: NavItem[] = [
  { to: "/cockpit", label: "Cockpit", icon: LayoutDashboard, gruppe: "Arbeiten", hilfe: "cockpit", beschreibung: "Ihr Tag auf einen Blick: Fristen, Posteingang, Zeitersparnis und offene Aufgaben." },
  { to: "/akten", label: "Akten", icon: FolderOpen, gruppe: "Arbeiten", hilfe: "akten", beschreibung: "Alle Mandate mit E-Akte, Fristen, Beteiligten, Aktenkonto und KI-Fallanalyse." },
  { to: "/posteingang", label: "Posteingang", kurz: "Post", icon: Inbox, gruppe: "Arbeiten", hilfe: "posteingang", beschreibung: "beA und E-Mail in einem Postfach – die KI ordnet zu und erkennt Fristen." },
  { to: "/fristen", label: "Fristen", icon: CalendarClock, gruppe: "Arbeiten", hilfe: "fristen", beschreibung: "Fristenkalender mit Vier-Augen-Kontrolle und Fristenrechner nach § 222 ZPO." },
  { to: "/ki", label: "Apex KI", kurz: "KI", icon: Sparkles, gruppe: "Intelligenz", hilfe: "ki", beschreibung: "KI-Fallanalyse, Dokument-Analyse und Schriftsatz-Entwürfe – nachvollziehbar und geprüft." },
  { to: "/fall-datenbank", label: "Fall-Datenbank", kurz: "Fälle", icon: Library, gruppe: "Intelligenz", hilfe: "falldb", beschreibung: "Präzedenzfälle in Sekunden: Leitentscheidungen von BVerfG, EuGH und Bundesgerichten durchsuchen." },
  { to: "/automatisierung", label: "38h-Motor", kurz: "Motor", icon: Zap, gruppe: "Intelligenz", hilfe: "motor", beschreibung: "Routineprozesse laufen im Hintergrund – was die Kanzlei verlässt, erst nach Ihrer Freigabe. Mit messbarer Zeitersparnis." },
  { to: "/abrechnung", label: "Abrechnung", icon: ReceiptEuro, gruppe: "Kanzlei", hilfe: "abrechnung", gesperrtFuer: ["azubi"], beschreibung: "RVG-Rechner, Sammelabrechnung, Forderungskonto und automatischer Bankabgleich." },
  { to: "/kontakte", label: "Kontakte", icon: Users, gruppe: "Kanzlei", hilfe: "kontakte", beschreibung: "Mandanten, Gegner, Gerichte und Versicherungen – mit allen verknüpften Akten." },
  { to: "/umzug", label: "Umzug", icon: ArrowRightLeft, gruppe: "Kanzlei", hilfe: "umzug", beschreibung: "Umzug in fünf Schritten – mit Vorschau und Rückgängig: Akten, Kontakte und Fristen aus Ihrer bisherigen Software übernehmen." },
  { to: "/hilfe", label: "Hilfe & Support", kurz: "Hilfe", icon: LifeBuoy, gruppe: "Service", hilfe: "hilfe", beschreibung: "Animiertes Wiki, Schnellhilfe, Systemstatus und {Ihre feste Ansprechperson}." },
  { to: "/einstellungen", label: "Einstellungen", kurz: "Einstell.", icon: Settings, gruppe: "Service", hilfe: "einstellungen", beschreibung: "Kanzlei, Team & Zugänge, Lizenz, KI und Darstellung." },
];

export const MOBILE_TABS = ["/cockpit", "/akten", "/posteingang", "/fristen"];

/** Direktziel „Systemstatus“ (Kopfleiste, Mehr-Menü, Cockpit) – Abschnitt in Hilfe & Support. */
export const SYSTEMSTATUS = {
  to: "/hilfe#status",
  label: "Systemstatus",
  beschreibung: "beA, E-Mail, Bank und KI: Verbindung, letzte Abfrage und Störungen auf einen Blick – im Prototyp simuliert.",
} as const;

/** Navigation für eine Rolle – gesperrte Bereiche (z. B. Abrechnung für Auszubildende) erscheinen nicht. */
export function navFuer(rolle: Rolle | undefined): NavItem[] {
  return NAV.filter((n) => !rolle || !n.gesperrtFuer?.includes(rolle));
}

/** Darf die Rolle den Bereich zu diesem Pfad öffnen? */
export function bereichErlaubt(pathname: string, rolle: Rolle | undefined): boolean {
  const n = navFor(pathname);
  return !n || !rolle || !n.gesperrtFuer?.includes(rolle);
}

export function navFor(pathname: string): NavItem | undefined {
  return NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
}

/** Beschreibung eines Bereichs mit der geschlechtsrichtigen Bezeichnung der Ansprechperson („Ihre feste Ansprechpartnerin“). */
export function beschreibungFuer(n: Pick<NavItem, "beschreibung">, ap?: Ansprechpartner): string {
  return ansprechText(n.beschreibung, ap);
}

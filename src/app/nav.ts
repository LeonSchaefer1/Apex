import {
  LayoutDashboard, FolderOpen, Inbox, CalendarClock, Sparkles, Library, Zap, ReceiptEuro, Users, ArrowRightLeft, LifeBuoy, Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  kurz?: string;
  icon: LucideIcon;
  beschreibung: string;
  gruppe: "Arbeiten" | "Intelligenz" | "Kanzlei" | "Service";
  hilfe: string;
}

/** Zentrale Navigation – jede Funktion mit klarem Namen und einem Satz, der sie erklärt. */
export const NAV: NavItem[] = [
  { to: "/cockpit", label: "Cockpit", icon: LayoutDashboard, gruppe: "Arbeiten", hilfe: "cockpit", beschreibung: "Ihr Tag auf einen Blick: Fristen, Posteingang, Zeitersparnis und offene Aufgaben." },
  { to: "/akten", label: "Akten", icon: FolderOpen, gruppe: "Arbeiten", hilfe: "akten", beschreibung: "Alle Mandate mit E-Akte, Fristen, Beteiligten, Aktenkonto und KI-Fallanalyse." },
  { to: "/posteingang", label: "Posteingang", icon: Inbox, gruppe: "Arbeiten", hilfe: "posteingang", beschreibung: "beA und E-Mail in einem Postfach – die KI ordnet zu und erkennt Fristen." },
  { to: "/fristen", label: "Fristen", icon: CalendarClock, gruppe: "Arbeiten", hilfe: "fristen", beschreibung: "Fristenkalender mit Vier-Augen-Kontrolle und Fristenrechner nach § 222 ZPO." },
  { to: "/ki", label: "Apex KI", icon: Sparkles, gruppe: "Intelligenz", hilfe: "ki", beschreibung: "KI-Fallanalyse, Dokument-Analyse und Schriftsatz-Entwürfe – nachvollziehbar und geprüft." },
  { to: "/fall-datenbank", label: "Fall-Datenbank", kurz: "Fälle", icon: Library, gruppe: "Intelligenz", hilfe: "falldb", beschreibung: "Präzedenzfälle in Sekunden: Leitentscheidungen von BVerfG, EuGH und Bundesgerichten durchsuchen." },
  { to: "/automatisierung", label: "38h-Motor", kurz: "Motor", icon: Zap, gruppe: "Intelligenz", hilfe: "motor", beschreibung: "Routineprozesse laufen autonom im Hintergrund – mit messbarer Zeitersparnis." },
  { to: "/abrechnung", label: "Abrechnung", icon: ReceiptEuro, gruppe: "Kanzlei", hilfe: "abrechnung", beschreibung: "RVG-Rechner, Sammelabrechnung, Forderungskonto und automatischer Bankabgleich." },
  { to: "/kontakte", label: "Kontakte", icon: Users, gruppe: "Kanzlei", hilfe: "kontakte", beschreibung: "Mandanten, Gegner, Gerichte und Versicherungen – mit allen verknüpften Akten." },
  { to: "/umzug", label: "Umzug", icon: ArrowRightLeft, gruppe: "Kanzlei", hilfe: "umzug", beschreibung: "Umzug mit einem Klick: Akten, Kontakte und Fristen aus Ihrer bisherigen Software übernehmen." },
  { to: "/hilfe", label: "Hilfe & Support", kurz: "Hilfe", icon: LifeBuoy, gruppe: "Service", hilfe: "hilfe", beschreibung: "Animiertes Wiki, Schnellhilfe, Systemstatus und Ihre feste Ansprechperson." },
  { to: "/einstellungen", label: "Einstellungen", icon: Settings, gruppe: "Service", hilfe: "einstellungen", beschreibung: "Kanzlei, Team & Zugänge, Lizenz, KI und Darstellung." },
];

export const MOBILE_TABS = ["/cockpit", "/akten", "/posteingang", "/fristen"];

export function navFor(pathname: string): NavItem | undefined {
  return NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
}

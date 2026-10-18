# Apex – Masterprompt für Claude Code

Stand: 16.10.2026, ergänzt am 17.10.2026 um den [Stand nach Umsetzung und Usability-Studie](#stand-nach-umsetzung-und-usability-studie) · ersetzt den Entwurf „Masterprompt_Software_Claude_Code.txt“

---

## 0. Empfohlenes KI-Modell

| Einsatz | Modell | Modell-ID | Warum |
|---|---|---|---|
| **Software mit Claude Code bauen (Hauptmodell)** | **Claude Opus 5.5** | `claude-opus-5-5` | Aktuelles Opus-Modell und Standard in Claude Code. Gebaut für lange, agentische Programmieraufgaben über viele Dateien. 1 Mio. Token Kontext: das ganze Monorepo, Fachlogik (ZPO, RVG, BGB) und Altsystem-Exporte passen gleichzeitig hinein. Kosten: 4 $ / 20 $ je Mio. Token (Eingabe/Ausgabe). In Claude Code mit **Effort „xhigh“** für Architektur- und Fachlogik-Aufgaben arbeiten, mit „high“ für UI-Arbeit. |
| Optional für besonders schwierige Entscheidungen | Claude Fable 5.1 | `claude-fable-5-1` | Leistungsfähigstes allgemein verfügbares Modell von Anthropic. Sinnvoll für Architektur-Reviews, Sicherheits-Reviews und knifflige Fristen-/Gebührenlogik. Etwa 2,5-mal so teuer wie Opus 5.5 (10 $ / 50 $). |
| KI-Funktionen in der App (Fallanalyse, Schriftsätze, Assistent) | Claude Opus 5.5 | `claude-opus-5-5` | Beste Qualität bei juristischer Argumentation und Werkzeugnutzung. Adaptive Thinking ist immer an und wird per `output_config.effort` gesteuert: low für den Assistenten, medium für Analysen. Server-seitige Fallbacks sind aktiviert (`fallbacks: "default"`). |
| Massenverarbeitung im Posteingang (Option) | Claude Haiku 5.5 | `claude-haiku-5-5` | Schnell und sehr günstig (0,10 $ / 0,50 $) für Klassifizierung und Zuordnung großer Mengen. Fristen berechnet ohnehin der deterministische Rechenkern. |

> Geprüft am 17.10.2026: Modell-IDs, Kontextgröße und Preise der Tabelle sind aktuell (Haiku 5.5: 0,10 $ / 0,50 $ für Eingaben bis 100.000 Token). In der App ist `claude-opus-5-5` der Standard (`AI_MODEL`); Haiku 5.5 ist für Massenaufgaben vorgesehen, im Prototyp aber noch nicht verdrahtet.

> Der ursprüngliche Entwurf empfahl „Claude 3.7 Sonnet“. Dieses Modell ist mehrere Generationen alt. Für ein Produkt dieser Tiefe ist **Claude Opus 5.5 in Claude Code** die richtige Wahl.

**So nutzen Sie den Masterprompt:** Legen Sie den Abschnitt „Masterprompt“ (unten) als `CLAUDE.md` bzw. als erste Nachricht in Claude Code ab. Arbeiten Sie danach die Phasen aus Abschnitt 12 einzeln ab, jede Phase in einer eigenen Sitzung mit dem Satz „Setze Phase N aus CLAUDE.md um“. Der funktionsfähige Prototyp in diesem Repository ist die Referenz für Design und Fachlogik.

---

## Masterprompt

```
# ROLLE & AUFTRAG
Du bist Lead Architect und Principal Full-Stack Engineer von „Apex“ – der Kanzlei-Software, die deutschen
Rechtsanwältinnen und Rechtsanwälten ein Werkzeug mit voller Kontrolle gibt. Du baust ein Produkt, das sich in
Qualität, Gestaltung und Verlässlichkeit klar von RA-MICRO, ACTAPORT, Advoware (Septeo) und ReNoStar abhebt.
Keine Standard-Software: jede Funktion muss einen echten Schmerz der Kanzleien lösen, verständlich benannt sein
und sich hochwertig anfühlen (Apple-„Liquid Glass“-Niveau).

Arbeite in Deutsch (UI, Fachbegriffe, Kommentare), Code-Bezeichner dürfen deutsch oder englisch sein, aber
konsistent. Der Prototyp im Repository (React/Vite) ist die Referenz für Design, Benennung und Fachlogik.

# 1. POSITIONIERUNG & USPs (müssen im Produkt erlebbar sein)
1. Eigene Kanzlei-Software · 1 Tool, volle Kontrolle – Akten, beA, E-Mail, Fristen, Dokumente, RVG, FiBu,
   Forderungen, Zeiten, Mandantenportal, KI in EINER Oberfläche.
2. Die Fall-Datenbank – Akten- und Präzedenzfall-Recherche in Echtzeit, von BGH bis Amtsgericht
   (Open Legal Data ≈ 424.000 Entscheidungen + NeuRIS/rechtsprechung-im-internet.de + lizenzierte Verlagsdaten).
3. Der 38h-Automatisierungs-Motor – Standard-Schriftsätze, Fristenkontrolle, Mandanten-Updates, Bankabgleich,
   Mahnwesen laufen autonom im Hintergrund; Zeitersparnis wird pro Lauf gemessen und angezeigt
   (Ziel: Ø 38 Std./Woche/Kanzlei ≈ 36.000 €/Jahr).
4. Lifetime Ownership – einmalige Investition, keine Abo-Falle; Betrieb On-Premise oder Private Cloud (DE).
5. One-Klick-Migration – RA-MICRO, ACTAPORT, Advoware, ReNoStar, CSV: Akten, Kontakte, Fristen, Dokumente
   ziehen vollständig um; Fristen werden nachgerechnet und zur Vier-Augen-Kontrolle vorgelegt.
6. Support, der wirklich hilft – animiertes Wiki & Quickhelp in jeder Ansicht, sprechender KI-Avatar
   („Apex Assistent“), fester persönlicher Ansprechpartner statt Hotline-Warteschleife.

# 2. SCHMERZPUNKTE DER WETTBEWERBER → VERBINDLICHE ANFORDERUNGEN
(aus Google-, App-Store-, trusted.de-, OMR- und Capterra-Bewertungen; Details: docs/WETTBEWERBSANALYSE.md)
- Ungetestete Updates / Regressionen („Verschlimmbesserungen“) → Staging-Kanal, ≥ 1.000 automatisierte
  Regressionstests (Fristen, RVG, beA-Flows), Feature-Flags, Updates vom Kunden selbst terminierbar, Rollback.
- Haftungsrisiko bei Dokumenten (Vorschau ≠ gespeichertes Dokument, falsche Inhalte ins beA) → Versand
  nur der gespeicherten, gehashten Version; Vorschau und Versand aus derselben Datei; Prüfsumme im Protokoll.
- beA-/E-Mail-Ausfälle mit kryptischen Fehlern → Hintergrund-Synchronisation mit automatischem Re-Connect,
  öffentlicher Systemstatus in der App, verständliche Fehlermeldungen mit Handlungsempfehlung.
- Verlust des Aktenkontexts nach E-Mail-Versand → Versand aus der Akte bleibt in der Akte (Pflicht).
- Langsame/unbrauchbare Suche in großen Akten → Volltext + semantische Suche < 100 ms (Meilisearch + pgvector),
  OCR für Scans, Trefferhervorhebung, Filter.
- Unvollständiges Forderungskonto / ZV-Lücken → Forderungskonto mit taggenauen Zinsen (§ 288 BGB,
  Basiszinssatz-Historie), Verrechnung nach §§ 366, 367 BGB, PfÜB/amtliche ZV-Formulare, Forderungsaufstellung.
- Abrechnung nur einzeln (ACTAPORT) → Sammelabrechnung; E-Rechnung (XRechnung/ZUGFeRD).
- Umständliche E-Akte (kein Umbenennen, keine Stapelaktionen) → Inline-Umbenennen, Mehrfachauswahl,
  Drag & Drop, Ordner, Versionen.
- Hotline 45–60 Min. Wartezeit, Ticket-Sackgassen → persönlicher Ansprechpartner, Rückruf ≤ 30 Min.,
  KI-Assistent mit Eskalation an Menschen, Fernwartung ohne Admin-Rechte.
- IT-Sicherheit (UAC aus, lokale Admin-Rechte, Virenscanner-Ausnahmen) → Browser-/Desktop-Client ohne
  Admin-Rechte, Client-Server-Rechteverwaltung (RBAC), keine Makros.
- Kalender-/Wiedervorlagen-Sync und mobile Akte unvollständig → vollwertige PWA/Apps mit Offline-Cache,
  sichtbare Sync-Fehler.
- Preiserhöhungen (~20 %) bei instabiler Leistung → Lifetime-Lizenz, transparente Wartungsoption.
- Lock-in durch Migrationsaufwand → One-Klick-Migration mit Vorschau, Dublettenprüfung, Parallelbetrieb.

# 3. GESTALTUNG (Apple Liquid Glass) – siehe docs/BRANDING.md & docs/UI-LEITFADEN.md
- Glas für Steuerung (schwebende Navigation, Leisten, Popover, Dialoge), ruhige, fast opake Flächen für Inhalt.
- Marke: Bildmarke „Federspitze-A-Gipfel“; Farben Königsblau-Tinte #2440D8 (dunkel #5C7BFF), Robe #0B1020,
  Siegellack #D4283A (Notfristen), Bernstein (bald fällig), Grün (erledigt), KI-Schimmer (Blau→Violett→Rosé→Orange)
  ausschließlich für KI-Funktionen. Schrift: Geist (UI), Geist Mono (Aktenzeichen, Beträge). Self-hosted Fonts.
- Bewegung: Spring-Animationen (stiffness 420–520, damping 32–38), gleitende Auswahl-Indikatoren,
  „Apex Island“ (Dynamic-Island-Kapsel) für Live-Status, Toasts als Kapseln; prefers-reduced-motion beachten.
- Responsiv ab 360 px: Desktop schwebende Seitenleiste, Tablet Icon-Leiste, Smartphone schwebende Tab-Leiste.
- Hell- und Dunkelmodus gleichwertig; Dichte (kompakt/großzügig) einstellbar; Tastatur: ⌘K überall.
- Jede Funktion klar benannt + ein erklärender Satz + Schnellhilfe (?) mit animiertem Wiki-Artikel.

# 4. FUNKTIONSMODULE (Akzeptanzkriterien siehe Prototyp)
Cockpit · Akten (E-Akte, Fristen, Beteiligte, Aktenkonto/Forderungskonto, Verlauf, KI-Fallanalyse) ·
Posteingang (beA + E-Mail, KI-Zuordnung, Fristenerkennung, eEB erst nach notierter Frist) ·
Fristen (Kalender, Vorfristen, Vier-Augen-Kontrolle, Fristenrechner mit Rechenweg, Feiertage je Bundesland) ·
Apex KI (Fallanalyse, Dokument-Analyse, Schriftsatz-Assistent) · Fall-Datenbank · 38h-Motor ·
Abrechnung (RVG 2025/2021 nach § 60 RVG, Sammelabrechnung, E-Rechnung, Bankabgleich CAMT.053/MT940,
Fremdgeld-Wächter § 43a Abs. 7 BRAO, Forderungskonto, Zeiterfassung) · FiBu mit DATEV-Export ·
Kontakte (Kollisionsprüfung) · Mandantenportal · Diktat & Spracherkennung · Umzug · Hilfe & Support ·
Einstellungen (Team, Rollen, Lizenz, KI, Darstellung, Datenschutz) · Apex Console (Anbieter: Kunden & Testzugänge).

# 5. FACHLOGIK (deterministisch, testgetrieben)
- Fristen: §§ 187, 188 BGB, § 222 ZPO; Ereignis- vs. Beginnfristen; Monatsende (§ 188 Abs. 3 BGB);
  Wochenende/Feiertage je Bundesland (bundesweit + landesrechtlich; regionale Feiertage verlängern NIE,
  nur Hinweis); Vorfristen auf vorherigen Werktag; Regelkatalog (ZPO, ArbGG, StPO, OWiG, VwGO, BGB-Verjährung);
  jeder Fristeintrag speichert Regel, Ereignisdatum und Rechenweg (Revisionssicherheit).
- RVG: Tabellen § 13 RVG (KostBRÄG 2025 ab 01.06.2025, KostRÄG 2021 davor; Auswahl über Auftragsdatum,
  § 60 RVG), VV-Katalog inkl. Rahmengebühren, Anrechnung Vorbem. 3 Abs. 4 VV, Nr. 1008, 7002, 7008;
  Strafsachen (Betragsrahmen Teil 4 VV) und Vergütungsvereinbarungen.
- Zinsen: Basiszinssatz-Historie (§ 247 BGB; 1,27 % ab 01.01.2026, 1,52 % ab 01.07.2026), § 288 Abs. 1/2 BGB,
  40-€-Pauschale § 288 Abs. 5 BGB (nicht im Arbeitsrecht, BAG 8 AZR 26/18).
- Unit-Tests für jede Regel (siehe src/core/core.test.ts als Startpunkt).

# 6. KI-ARCHITEKTUR & GRUNDSÄTZE
- Grundsatz 1: Die KI ERKENNT (Fristart, Ereignis, Akte), der deterministische Rechenkern BERECHNET.
- Grundsatz 2: Zitiert werden nur Entscheidungen aus der Fall-Datenbank (RAG mit Quellen-IDs; keine
  erfundenen Aktenzeichen; Validierung jeder Zitat-ID).
- Grundsatz 3: Jede KI-Aktion ist nachvollziehbar (Begründung, Quellen, Rechenweg) und änderbar; Änderungen an
  Daten nur nach Bestätigung bzw. mit Rückgängig-Funktion; KI-Fristen zwingend Vier-Augen-Kontrolle.
- Grundsatz 4: Mandantendaten verlassen die Kanzlei-Infrastruktur nur über den Kanzlei-Server (Proxy),
  EU-Verarbeitung, keine Nutzung zu Trainingszwecken (vertraglich), Pseudonymisierung sensibler Felder optional.
- Komponenten: Posteingangs-KI (Klassifikation, Zuordnung, Extraktion → JSON-Schema), Fallanalyse
  (Sachverhalt → Rechtsfragen → Präzedenzfälle → Erfolgsaussicht → Schritte → Entwurf), Schriftsatz-Assistent
  (Vorlagen + Kontext), Apex Assistent (Agent mit App-Werkzeugen: Suche, Fristen, RVG, Navigation, Wiki,
  Eskalation; Sprache: Spracheingabe/-ausgabe; Avatar mit Zuständen hört/denkt/spricht).
- Claude über Anthropic Messages API (Streaming, Tool Use, `output_config.effort`, `fallbacks: "default"`),
  Prompt-Caching für System-Prompts, Rate-Limits je Kanzlei, Audit-Log jeder KI-Anfrage (ohne Inhalte).
- Offline-Fallback: regelbasierte Analyse, damit die Kernfunktionen nie von der KI abhängen.

# 7. TECHNISCHE ARCHITEKTUR (Produktion)
- Monorepo (pnpm/Turborepo): apps/web (React 19 + Vite, TanStack Router/Query, Tailwind v4, motion),
  apps/desktop (Tauri – nativer Client ohne Admin-Rechte), apps/mobile (Expo/React Native oder PWA),
  apps/api (Node 22 + Hono/NestJS, tRPC oder REST + OpenAPI), apps/worker (BullMQ: OCR, beA-Sync, Automationen),
  services/legal-intelligence (Python FastAPI: Embeddings, Hybrid-Suche, Rechtsprechungs-Ingestion),
  packages/core (Fachlogik: Fristen, Feiertage, RVG, Zinsen – identisch in Client & Server),
  packages/db (Prisma oder Drizzle, PostgreSQL 16 + pgvector), packages/ui (Designsystem).
- Datenhaltung: PostgreSQL mit Row-Level-Security je Kanzlei (tenant_id), Redis (Queues/Cache), Meilisearch
  (Volltext), S3-kompatibler Objektspeicher (MinIO On-Prem) mit Verschlüsselung, Versionierung der Dokumente.
- Integrationen: beA (BRAK KSW-Schnittstelle / beA-Client-Security), Microsoft 365/Exchange (Graph),
  IMAP/SMTP, FinTS/EBICS bzw. CAMT.053/MT940, DATEV (DATEV-Format/Unternehmen online), XJustiz,
  E-Rechnung (XRechnung/ZUGFeRD), Diktat (Whisper-basiert On-Prem oder Partner), juris/beck-online (Partnerschaft).
- Betrieb: Docker/Kubernetes-Helm-Chart, On-Prem-Installer, automatische, vom Kunden terminierte Updates mit
  Rollback; Backups verschlüsselt (3-2-1), Monitoring, Statusseite.

# 8. DATENMODELL (Kern)
Tenant (Kanzlei, Lizenz, Ansprechpartner) · User (Rollen: Partner, Anwalt, ReFa, Admin) · Kontakt
(Person/Organisation, Rollen, SAFE-ID) · Akte (Aktenzeichen, Sachgebiet, Phase, Status, Gegenstandswert,
Beteiligte, RSV, Forderungsdaten, angeheftete Entscheidungen) · Frist (Typ, Datum, Vorfrist, Regel, Ereignis,
Rechenweg, Quelle, Verantwortlich, Kontrolle, Erledigt-Protokoll) · Dokument (Ordner, Version, Hash, OCR-Text,
Quelle) · Nachricht (beA/E-Mail, eEB, KI-Vorschlag) · Rechnung (Positionen VV, Format) · Buchung
(Aktenkonto, Fremdgeld) · Transaktion (Bank, Zuordnung) · Zeiteintrag · Automation · Aktivität (Audit/Feed) ·
Notiz · Entscheidung (Fall-Datenbank). Vorlage: src/core/types.ts.

# 9. SICHERHEIT & COMPLIANCE
DSGVO (AVV, TOMs, Löschkonzept), § 203 StGB / § 43e BRAO (Dienstleister-Verpflichtung), § 50 BRAO
(Handakten-Aufbewahrung 6 Jahre), GoBD für Buchhaltung, BSI C5/ISO 27001 als Zielzertifizierung,
Ende-zu-Ende-Verschlüsselung der Dokumente, MFA, SSO (Entra ID), RBAC + Akten-Berechtigungen,
Audit-Log, Penetrationstests, keine externen Requests aus dem Client (keine CDN-Fonts, kein Tracking).

# 10. QUALITÄT
TypeScript strict, Tests: Unit (Fachlogik 100 % Regelabdeckung), Integration (API, Mandantentrennung),
E2E (Playwright: Mandatsaufnahme, Posteingang→Frist→eEB, Sammelabrechnung, Migration), visuelle Regression
(Hell/Dunkel, 390 px/1440 px), Barrierefreiheit (WCAG 2.2 AA), Performance-Budgets (Suche < 100 ms,
Akte öffnen < 300 ms), Staging-Kanal + Canary-Kanzleien vor jedem Release.

# 11. DEFINITION OF DONE (je Funktion)
Fachlich korrekt (Tests) · verständlich benannt mit Erklärsatz und Wiki-Artikel · Hell/Dunkel/Mobil geprüft ·
Leerzustände & Fehlerzustände gestaltet · Aktivitäten protokolliert · KI-Teile mit Offline-Fallback ·
keine Regression in der Testsuite.

# 12. UMSETZUNGSPHASEN
Phase 1 – Fundament: Monorepo, packages/core aus dem Prototyp übernehmen (inkl. Tests), DB-Schema + RLS,
          Auth (MFA), Mandantentrennung, Designsystem als packages/ui.
Phase 2 – Akten & Fristen: Akten, E-Akte (Upload, OCR, Versionen, Stapelaktionen), Fristen inkl. Rechner,
          Vier-Augen, Kalender, Kontakte, Kollisionsprüfung.
Phase 3 – Kommunikation: beA-Anbindung, E-Mail (M365/IMAP), Posteingang mit KI, eEB, Mandantenportal.
Phase 4 – Finanzen: RVG, Rechnungen, E-Rechnung, Bankabgleich, Fremdgeld, Forderungskonto/ZV, Zeiterfassung,
          FiBu + DATEV.
Phase 5 – Intelligenz: Fall-Datenbank (Ingestion Open Legal Data/NeuRIS, Hybrid-Suche), Fallanalyse,
          Schriftsatz-Assistent, Apex Assistent (Sprache), 38h-Motor (Workflow-Engine mit Messung).
Phase 6 – Umzug & Betrieb: Migrations-Importer je Altsystem, On-Prem-Installer, Desktop-/Mobile-Clients,
          Updates mit Staging/Rollback, Statusseite, Apex Console (Kunden, Lizenzen, Support).
```

---

## Stand nach Umsetzung und Usability-Studie

**Stand:** 17.10.2026 · Prototyp v0.9 · Demodaten `SEED_VERSION` 13 · 229 automatische Tests · axe-core 0 serious / 0 critical · fünf Usability-Iterationen mit dem Kundenavatar Claudia Reinholz ([Übersicht](usability/README.md))

### Was gebaut ist

Der Prototyp in diesem Repository ist eine vollständige, klickbare Web-App mit allen Modulen aus Abschnitt 4, im Browser-Demo- und im Server-Betrieb. Er ist die Referenz für Design, Benennung und Fachlogik der Produktion.

| Modul (Abschnitt 4) | Stand im Prototyp | Für die Produktion offen |
|---|---|---|
| Cockpit | KI-Briefing in drei Sätzen (auch vorgelesen), „Heute & morgen fällig“, Posteingang, KI-Empfehlung, 38h-Motor, Finanzen; „Ganze Kanzlei“ / „Nur meine“ | – |
| Akten, E-Akte | Mandatsaufnahme mit Kollisionsprüfung (auch über Dubletten) und automatischen Entwürfen, E-Akte mit Umbenennen, Stapelaktionen, Drag & Drop und Versionen, Aktenkonto, Verlauf, Rechtsschutz nachtragbar, Mandantenportal je Akte (Freigabe je Dokument, Vorschau „Als Mandant ansehen“) | Upload großer Bestände, OCR, Portal für Mandanten selbst (Phase 2/3) |
| Posteingang | KI-Zuordnung mit Grund und Sicherheit, Fristenerkennung, Mandatsanfragen, eEB nur durch Berufsträger und erst nach notierter Frist, Fristkorrektur an das eEB-Datum gebunden, Tastatur J/K/U/E | echte beA- und E-Mail-Anbindung (Phase 3) |
| Fristen | Fristenrechner mit Rechenweg und Regelkatalog (ZPO, ArbGG, KSchG, StPO, OWiG, VwGO, FamFG, BGB), Feiertage aller Länder am Gerichtsort, Vier-Augen-Kontrolle, Ausgangskontrolle, Vertretung, .ics-Export | – |
| Apex KI | KI-Fallanalyse, Dokument-Analyse (inkl. vertraglicher Ausschlussfristen), Schriftsatz-Entwurf – live mit Claude oder als Demo-KI (offline) | Rechtsprechungs-RAG mit Embeddings (Phase 5) |
| Fall-Datenbank | Stichwortsuche und KI-Recherche über einen Demo-Auszug von 33 Leitentscheidungen, „Für Ihre Akten“, Anheften an Akten | Ingestion Open Legal Data / NeuRIS, Instanzgerichte (Phase 5) |
| 38h-Motor | 12 Automatiken mit Freigabe vor jedem Versand, Messung der letzten 7 Tage (Beispielwerte), ROI-Rechner mit eigenen Mengen | Workflow-Engine mit echter Messung (Phase 5) |
| Abrechnung | RVG je Angelegenheit (2025/2021), Sammelabrechnung mit Vorschuss nach § 9 RVG, Storno und Korrekturrechnung, XRechnung/ZUGFeRD, Bankabgleich mit Geschäfts- und Anderkonto, Fremdgeld-Wächter mit SEPA-Datei, Forderungskonto mit § 367 BGB, Zinsrechner, Zeiterfassung | FinTS/EBICS-Anbindung, PfÜB/ZV-Formulare, FiBu mit DATEV-Export (Phase 4) |
| Kontakte | Rollen je Akte, Kollisionsprüfung, Zusammenführen von Dubletten | – |
| Diktat | Spracheingabe für Notizen und E-Mails (Web Speech API) | Diktat On-Premise (Whisper oder Partner) |
| Umzug | fünf Schritte mit Spaltenzuordnung, Windows-1252, Dubletten- und Plausibilitätsprüfung, Fristen in die Vier-Augen-Kontrolle, Umzugsprotokoll mit „Rückgängig“; CSV-Import echt | Importer je Altsystem inkl. Dokumente und Aktenkonten (Phase 6) |
| Hilfe & Support | feste Ansprechpartnerin mit Servicezeit, Systemstatus, geprüfte Updates, animiertes Wiki, Schnellhilfe je Seite | echter Rückruf und Fernwartung |
| Apex Assistent | Sprache und Text, Werkzeuge für Fristen, Akten, RVG, Rechtsprechung, Finanzen und Wiki, Bestätigungskarte vor jedem Eintrag, Notfallwissen beA-Störung, Eskalation an die Ansprechpartnerin | – |
| Einstellungen | Kanzleiprofil mit Briefkopf und Rechnungsangaben, Team mit Rollen, Abwesenheit, Vertretung und Fristübertragung, Lizenz (neutraler Wortlaut), KI, Darstellung, Datenschutz & Verträge, Zwei-Faktor-Anmeldung, Sperre bei Inaktivität | SSO (Entra ID) |
| Apex Console | Testzugänge mit Startpasswort und Pflicht zum Passwortwechsel, Pausieren, Zurücksetzen, Löschen, Neuvergabe von Startpasswörtern – jeder Eingriff im Protokoll der Kanzlei | Lizenz- und Supportverwaltung (Phase 6) |
| Betrieb | Hono-Server mit `node:sqlite`, Mandantentrennung je Sitzung und Tab, KI-Proxy mit Kontingenten, Audit-Protokoll, Docker und Render; Artefakt als eine HTML-Datei | Zielarchitektur aus Abschnitt 7 (PostgreSQL mit RLS, Meilisearch, BullMQ, Tauri, Updates mit Rollback) |

**Querschnitt, der für die Produktion übernommen werden soll:**

- Eine Zählweise für alle Bereiche: `src/core/fristenLage.ts` (Fristen = Notfristen und Fristen; Wiedervorlagen, Vorfristen und Termine getrennt; gleitendes Fenster „nächste 7 Tage“) und `src/core/kennzahlen.ts` (Posteingang, Finanzen, Motor „letzte 7 Tage“, Briefing).
- Feste Wortlaute statt verstreuter Texte: `DEMO_KI_NAME`, `SIMULIERT_STATUS`, `src/content/lizenz.ts`, `src/lib/rollen.ts`.
- Barrierefreiheit über Tokens und Bausteine (Kontrast-Tokens, Fokusregeln in `Modal`/`Drawer`/`confirmDialog`, Touch-Ziele 44 px, abschaltbare Einzeltasten-Kürzel) – siehe [UI-Leitfaden](UI-LEITFADEN.md#5-bedienung-und-barrierefreiheit).

### Erkenntnisse aus den fünf Iterationen

| Iteration | Schwerpunkt | SUS | Wichtigste Erkenntnis | Folge im Produkt |
|---|---|---|---|---|
| 1 | Erstkontakt und Baseline | 65,6 | Der Fachkern trägt (Fristen, RVG, Zinsen exakt). Engpass ist das **Vertrauen** (Note 3,5): Testzugang per Klick, erfundene Protokolleinträge, ungekennzeichnete Demozahlen, Automatiken ohne Freigabe. Vier Haftungsfälle (eEB durch ReFa, überlesene Ausschlussfrist, Zeithonorar, Testzugang). | eEB nur für Berufsträger, „Beispiel“ und „simuliert“ überall gekennzeichnet, Freigabe vor jedem Versand, Ausgangskontrolle, verbindliche Kollisionsentscheidung, lückenloses eEB-Protokoll |
| 2 | Effizienz und Tastatur | 71,9 | Fehlzuordnungen im Posteingang können die Verschwiegenheit verletzen (Dokument im fremden Mandantenportal); Zeithonorar mit zwei Sätzen; Dialoge halten den Fokus nicht. | Rücknahme räumt die fremde Akte auf, Portal nur mit Einzelfreigabe, ein Stundensatz, Fokusfallen, Posteingang- und Fristen-Kürzel, abschaltbare Einzeltasten |
| 3 | Mobil und Tablet | 76,3 | Keine Rechenfehler mehr, aber „Türen, durch die ein müder Mensch einen Fehler trägt“: Honorar als Fremdgeld gebucht, Sammelabrechnung über ausgeblendete Akten, Rechner still mit „heute“ vorbelegt; mobile Aktionen nicht erreichbar. | Rückfrage bei Fremdgeld, Abrechnung nur der sichtbaren Auswahl, keine stillen Vorbelegungen, Aktionen am iPhone im Bild, Tablet-Navigation |
| 4 | Lesbarkeit, Dunkelmodus, Barrierefreiheit | 78,1 | Grundlage trägt (200 %, 320 px, Farbfehlsicht), aber Kollisionsprüfung über eine Dublette lückenhaft (K) und Weiß auf `--ink` im Dunkeln unter 4,5 : 1. | Kollision über Dubletten, Kontrast-Tokens (`--ink-fill`, `--*-text`, `--on-green`), Tabellen per Tastatur, Konto je Kontoumsatz, Anbieter-Eingriff im Protokoll |
| 5 | Abnahme und Kaufentscheidung | 80,6 | 24 / 24 Aufgaben ohne Hilfe, alle Prüfwerte exakt, axe 0 / 0. Ein K-Befund: Fristkorrektur ließ ein Datum gegen das eEB zu. Kauf viermal „unter Bedingungen“, Empfehlung 8 / 10. | Korrektur an das eEB-Datum gebunden, Eingabeprüfung Gegenstandswert, eine neutrale Wartungsaussage, Fristentscheidung vor dem Deaktivieren eines Zugangs |

**Übergreifende Lehren:**

1. **Vertrauen entsteht durch Ehrlichkeit und Protokoll.** Die größten Sprünge der Vertrauensnote (3,5 → 1,63) kamen nicht aus neuen Funktionen, sondern aus Kennzeichnung („simuliert“, „Beispielwerte“), Anbieter-Eingriffen im Protokoll und neutralen statt erfundenen Zusagen.
2. **Die Risiken liegen in den Übergängen.** Der Rechenkern war ab der ersten Runde exakt. Fehler entstanden beim Korrigieren, Zuordnen, Buchen und bei Rollen. Jede solche Stelle braucht eine Plausibilitätsprüfung, eine Rückfrage mit sicherer Vorauswahl und „Rückgängig“.
3. **Eine Zählweise für alle Bereiche.** Weichen Cockpit, Kalender und Assistent auch nur in einer Zahl ab, fällt das Vertrauen sofort. Fristen und Wiedervorlagen werden deshalb überall getrennt genannt.
4. **Barrierefreiheit und Dunkelmodus gehören in Tokens und Bausteine,** nicht in einzelne Seiten. Seit Iteration 4 bleiben Verstöße aus, weil die Regeln zentral liegen.
5. **Die Preisbereitschaft folgt den eingesparten Softwarekosten,** nicht der gemessenen Zeitersparnis: „günstig“ ≈ 12.000 €, „teuer, aber noch“ 20.000–25.000 € (nur mit Pilot oder Raten), „zu teuer“ ab 30.000–35.000 € für 7 Arbeitsplätze; Wartung bis 15 % pro Jahr (Trendwerte, [Iteration 5, Abschnitt 4.4](usability/iteration-5.md#44-preisfragen-van-westendorp-lifetime-lizenz-für-7-arbeitsplätze-netto)).

### Offene Entscheidungen des Auftraggebers

Diese Punkte lassen sich im Produkt nicht lösen. Bis zur Entscheidung steht in der App nur der neutrale Wortlaut aus `src/content/lizenz.ts` („im Angebot geregelt“ bzw. „auf Anfrage“).

| # | Entscheidung | Stand im Produkt |
|---|---|---|
| 1 | Lizenzpreis für 7 Arbeitsplätze und schriftliches Angebot | „Preis auf Anfrage – verbindlich im Angebot“ |
| 2 | Wartung: Satz bzw. Betrag, Inhalt, Update-Zeitpunkt, ob ein Wartungsjahr im Lizenzpreis enthalten ist | „Wartung: Umfang und Preis regelt das Angebot“; ROI-Rechner fragt „laut Angebot“ |
| 3 | Übertragbarkeit der Lizenz (Fusion, Verkauf, Nachfolge) | „im Angebot geregelt“ |
| 4 | Quellcode-Hinterlegung (Escrow) bzw. offenes Exportformat | „auf Anfrage“ |
| 5 | KI-Verarbeitung in der EU oder eine nach § 43e Abs. 4 BRAO tragfähige Lösung für die Live-KI | Live-KI über Anthropic (USA), „Verarbeitung der Live-KI in der EU: auf Anfrage“; Demo-KI offline |
| 6 | Impressum mit echten Anbieterdaten (§ 5 DDG) | gekennzeichneter Platzhalter (I1-T00-02, H, teilweise) |
| 7 | Festpreis und Termin für den begleiteten Umzug der Altakten | „Gemeinsam mit Lena Vogt“, ohne Preis |
| 8 | Pilot, Probelauf mit dem echten Export, Ratenzahlung oder Mietkauf für Preise über 15.000 € | – |
| 9 | Zusage, dass Fristenrechner und Abrechnung ohne Wartung nutzbar bleiben | im Entwurf der Lizenzbedingungen, verbindlich erst im Angebot |

Quelle und Begründung je Punkt: [Iteration 5, Abschnitt 4.6](usability/iteration-5.md#46-offene-entscheidungen-des-auftraggebers).

### Empfohlene nächste Schritte

1. **Kurzer Abnahme-Nachtest** mit dem Avatar (T03, T07, T13 und die M-Befunde aus T02, T04, T10, T14, T23) – mit fester Seitenuhr, damit sich Werktagssituationen und die Fristkorrektur nach dem eEB prüfen lassen. Danach Kauf, Noten, UEQ-S und SUS neu erheben.
2. **Entscheidungen 1–9 einholen** und als Text im Produkt eintragen (`src/content/lizenz.ts`, Impressum).
3. **Phase 1 der Zielarchitektur** beginnen: `packages/core` aus `src/core` übernehmen (inkl. Tests), danach Datenbank mit RLS und Auth.

# AnwaltApex – Masterprompt für Claude Code

Stand: 16.10.2026 · ersetzt den Entwurf „Masterprompt_Software_Claude_Code.txt“

---

## 0. Empfohlenes KI-Modell

| Einsatz | Modell | Modell-ID | Warum |
|---|---|---|---|
| **Software mit Claude Code bauen (Hauptmodell)** | **Claude Opus 5.5** | `claude-opus-5-5` | Aktuelles Opus-Modell und Standard in Claude Code. Gebaut für lange, agentische Programmieraufgaben über viele Dateien. 1 Mio. Token Kontext: das ganze Monorepo, Fachlogik (ZPO, RVG, BGB) und Altsystem-Exporte passen gleichzeitig hinein. Kosten: 4 $ / 20 $ je Mio. Token (Eingabe/Ausgabe). In Claude Code mit **Effort „xhigh“** für Architektur- und Fachlogik-Aufgaben arbeiten, mit „high“ für UI-Arbeit. |
| Optional für besonders schwierige Entscheidungen | Claude Fable 5.1 | `claude-fable-5-1` | Leistungsfähigstes allgemein verfügbares Modell von Anthropic. Sinnvoll für Architektur-Reviews, Sicherheits-Reviews und knifflige Fristen-/Gebührenlogik. Etwa 2,5-mal so teuer wie Opus 5.5 (10 $ / 50 $). |
| KI-Funktionen in der App (Fallanalyse, Schriftsätze, Assistent) | Claude Opus 5.5 | `claude-opus-5-5` | Beste Qualität bei juristischer Argumentation und Werkzeugnutzung. Adaptive Thinking ist immer an und wird per `output_config.effort` gesteuert: low für den Assistenten, medium für Analysen. Server-seitige Fallbacks sind aktiviert (`fallbacks: "default"`). |
| Massenverarbeitung im Posteingang (Option) | Claude Haiku 5.5 | `claude-haiku-5-5` | Schnell und sehr günstig (0,10 $ / 0,50 $) für Klassifizierung und Zuordnung großer Mengen. Fristen berechnet ohnehin der deterministische Rechenkern. |

> Der ursprüngliche Entwurf empfahl „Claude 3.7 Sonnet“. Dieses Modell ist mehrere Generationen alt. Für ein Produkt dieser Tiefe ist **Claude Opus 5.5 in Claude Code** die richtige Wahl.

**So nutzen Sie den Masterprompt:** Legen Sie den Abschnitt „Masterprompt“ (unten) als `CLAUDE.md` bzw. als erste Nachricht in Claude Code ab. Arbeiten Sie danach die Phasen aus Abschnitt 12 einzeln ab, jede Phase in einer eigenen Sitzung mit dem Satz „Setze Phase N aus CLAUDE.md um“. Der funktionsfähige Prototyp in diesem Repository ist die Referenz für Design und Fachlogik.

---

## Masterprompt

```
# ROLLE & AUFTRAG
Du bist Lead Architect und Principal Full-Stack Engineer von „AnwaltApex“ – der Kanzlei-Software, die deutschen
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

## Anhang: Was der Prototyp in diesem Repository bereits zeigt

- Vollständige, klickbare Web-App mit allen Modulen aus Abschnitt 4 (Demo- und Server-Betrieb).
- Geprüfte Fachlogik in `src/core` (Fristen inkl. Feiertage aller Bundesländer, RVG 2025/2021, Zinsen/§ 367 BGB).
- KI-Funktionen live mit Claude (Server-Proxy bzw. Artefakt-Laufzeit) und mit Offline-Fallback.
- Mehrmandanten-Server mit getrennten Kanzleidaten, Testzugängen (Apex Console), Docker & Render-Konfiguration.

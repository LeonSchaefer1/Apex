<p align="center"><img src="brand/app-icon.svg" width="88" alt="AnwaltApex"></p>

<h1 align="center">AnwaltApex</h1>
<p align="center"><strong>Ein Werkzeug. Volle Kontrolle.</strong> Die Kanzlei-Software, die mitdenkt.</p>

AnwaltApex ist der Prototyp einer Kanzlei-Software für deutsche Rechtsanwältinnen und Rechtsanwälte:

- Akten, beA und E-Mail, Fristen, Abrechnung und Forderungen in einer Oberfläche
- eine KI, die Fälle analysiert, Fristen im Posteingang erkennt und Präzedenzfälle in Sekunden findet
- ein sprechender **KI-Avatar** für Live-Support
- Gestaltung nach den Prinzipien von **Apple Liquid Glass**, responsiv vom Smartphone bis zum Großbildschirm, in Hell und Dunkel

> **Status:** Präsentations- und Test-Prototyp (v0.9). Mehrere Kanzleien lassen sich getrennt testen. Alle Funktionen sind klickbar, Fachlogik und KI funktionieren. Anbindungen an beA, E-Mail-Server und Bank sind im Prototyp simuliert (siehe [Was ist echt, was simuliert?](#was-ist-echt-was-simuliert)).

![Cockpit](docs/screenshots/cockpit.png)

---

## Funktionen

| Bereich | Was er tut |
|---|---|
| **Cockpit** | Der Tag auf einen Blick: ein KI-Tagesbriefing (auch vorgelesen), fällige Fristen, neue Post, Termine, Finanzen und die Zeitersparnis der Woche. |
| **Akten** | Alle Mandate mit E-Akte, Fristen, Beteiligten, Aktenkonto und Forderungskonto, Verlauf und KI-Fallanalyse. Die Mandatsaufnahme erzeugt Vollmacht, Mandatsbestätigung, Datenschutzhinweise und Deckungsanfrage automatisch. |
| **Posteingang** | beA und E-Mail in einem Postfach. Die KI ordnet jede Nachricht der richtigen Akte zu und erkennt Fristen. Das eEB lässt sich erst abgeben, wenn die Frist notiert ist. |
| **Fristen** | Fristenkalender mit Vorfristen und Vier-Augen-Kontrolle. Der Fristenrechner nach §§ 187, 188 BGB und § 222 ZPO kennt die Feiertage aller 16 Bundesländer und zeigt den Rechenweg. |
| **Apex KI** | KI-Fallanalyse (Erfolgsaussicht, Präzedenzfälle, Argumente, nächste Schritte, Schriftsatz-Entwurf), Dokument-Analyse und Schriftsatz-Assistent. |
| **Fall-Datenbank** | Rechtsprechung von BGH bis Amtsgericht in Sekunden durchsuchen, als Stichwortsuche oder KI-Recherche. Treffer lassen sich an eine Akte heften. |
| **38h-Motor** | Automationen laufen im Hintergrund und messen ihre Zeitersparnis live (siehe „Apex Island“ oben). Ein ROI-Rechner gehört dazu. |
| **Abrechnung** | RVG-Rechner (Tabellen 2025 und 2021 nach § 60 RVG, Anrechnung, Auslagen), Sammelabrechnung, XRechnung/ZUGFeRD, automatischer Bankabgleich, Fremdgeld-Wächter, Forderungskonto mit Verrechnung nach § 367 BGB, Zeiterfassung. |
| **Kontakte** | Mandanten, Gegner, Gerichte und Versicherungen mit Prüfung auf Interessenkonflikte. |
| **Umzug** | One-Klick-Migration aus RA-MICRO, ACTAPORT, Advoware, ReNoStar oder CSV, mit Spaltenzuordnung, Dublettenprüfung und Fristen-Kontrolle. |
| **Hilfe & Support** | Animiertes Wiki, Schnellhilfe (?) auf jeder Seite, Systemstatus, geprüfte Updates und ein persönlicher Ansprechpartner. |
| **Apex Assistent** | Sprechender KI-Avatar unten rechts. Er antwortet per Sprache oder Text, durchsucht Akten, berechnet Fristen und RVG, legt Wiedervorlagen an, erklärt die Software und verbindet mit dem Ansprechpartner. |
| **Apex Console** | Bereich für das AnwaltApex-Team: Kundenkanzleien mit eigenem Zugang anlegen, pausieren, zurücksetzen. |

Zum Wechseln zwischen den Bereichen: **⌘K** bzw. **Strg+K** öffnet die globale Suche über Akten, Dokumente (Volltext), Fristen, Posteingang und Rechtsprechung.

---

## Schnellstart

Voraussetzung ist Node.js ab 22.13.

```bash
npm install
npm run dev          # http://localhost:5173 – läuft ohne Server im Demo-Modus (Daten im Browser)
```

### Server-Betrieb (echte Zugänge, getrennte Kanzleidaten)

```bash
cp .env.example .env                 # CONSOLE_ADMIN_PASSWORD setzen, optional ANTHROPIC_API_KEY
npm run build
set -a; source .env; set +a
npm start                            # http://localhost:8787
```

Für die Entwicklung mit Server laufen `npm run dev:server` (API auf Port 8787) und `npm run dev` (Vite leitet `/api` weiter) parallel.

### Docker (On-Premise oder Private Cloud)

```bash
cp .env.example .env    # Werte anpassen
docker compose up -d    # http://localhost:8787 – Daten im Volume „anwaltapex-daten“
```

### Testumgebung für Kunden in der Cloud

Ein Klick genügt: Das Repository mit [Render](https://render.com) verbinden, `render.yaml` wird erkannt (Region Frankfurt, persistente Platte). Dort `CONSOLE_ADMIN_PASSWORD` und optional `ANTHROPIC_API_KEY` eintragen.

### Betrieb & Sicherheit (Server)

| Variable | Wirkung |
|---|---|
| `CONSOLE_ADMIN_PASSWORD` | Mindestens 12 Zeichen. Platzhalter aus `.env.example` und öffentlich bekannte Demo-Passwörter werden abgelehnt – die Console bleibt dann deaktiviert (Hinweis im Log). |
| `COOKIE_SECURE` | Hinter HTTPS auf `true`: Sitzungs-Cookie nur über HTTPS, zusätzlich HSTS. |
| `TRUST_PROXY` | Nur hinter einem eigenen Reverse Proxy (z. B. Render) auf `true`: Die Anmeldebegrenzung nutzt dann den vom Proxy angehängten letzten `X-Forwarded-For`-Eintrag, sonst die Socket-Adresse. |
| `AI_DEMO_TENANTS` | `off` schaltet die Live-KI für die eingebauten Präsentationskanzleien ab (deren Zugangsdaten sind öffentlich); dort arbeitet dann die Demo-KI. |
| `AI_MAX_TOKENS`, `AI_DAILY_REQUESTS_PER_TENANT`, `AI_DAILY_TOKENS_PER_TENANT`, `AI_DAILY_TOKENS_TOTAL` | Obergrenze je KI-Antwort und Tageskontingente je Kanzlei bzw. Server (`0` = unbegrenzt). Ist ein Kontingent erschöpft, übernimmt die Demo-KI. |
| `TZ` | Zeitzone für „heute“, Fristen und den Tageswechsel der Beispieldaten (Docker und Render: `Europe/Berlin`). |

- **Datenbestand:** Präsentationskanzleien werden jeden Tag frisch erzeugt (Änderungen während einer Präsentation bleiben bis zum Tagesende). Kunden-Kanzleien werden nur neu erzeugt, solange sie unveränderte Beispieldaten haben – sobald eine Kanzlei etwas geändert hat, löscht der Server nie automatisch, auch nicht bei einer neuen Version der Beispieldaten. „Demo-Daten zurücksetzen“ gibt es nur für Präsentations- und Beispieldaten-Kanzleien.
- **Sitzungen:** 12 Stunden, bei Nutzung gleitend verlängert. Entfernte Personen, pausierte Kanzleien und abgelaufene Testzugänge verlieren den Zugriff sofort. Jede Daten-, Team- und KI-Anfrage ist zusätzlich an Kanzlei und Person des Browser-Tabs gebunden – meldet sich in einem anderen Tab jemand anderes an, weist der Server alte Anfragen ab und der Tab lädt neu.
- **Begrenzungen:** Anfragen bis 64 KB (Dokumente und KI-Anfragen bis 3 MB), Passwörter bis 256 Zeichen, Anmeldeversuche je IP und je Zugang begrenzt; gespeicherte Dokumente werden auf Pflichtfelder geprüft. Sicherheits-Header inkl. Content-Security-Policy (nur eigene Skripte), `Cache-Control: no-store` für die API. Anmeldungen, Fehlversuche, Team- und Statusänderungen sowie Passwort-Neuvergaben stehen im Audit-Protokoll (Tabelle `audit`).

### Statische Demo (GitHub Pages, Netlify, Präsentations-Laptop)

```bash
npm run build:static      # dist-static/ – reine Browser-Demo mit Hash-Routing, kein Server nötig
npm run build:artifact    # dist-artifact/anwaltapex.html – eine einzige HTML-Datei
```

---

## Zugänge

| Kanzlei | Ort | Schwerpunkte | Anmeldung |
|---|---|---|---|
| Hartmann & Partner | Berlin | Arbeits-, Miet-, Verkehrs-, Erbrecht | `julia.hartmann@hartmann-partner.de` |
| Lindner Rechtsanwälte | München | Forderungseinzug, Vertrags-, Baurecht | `stefan.lindner@lindner-recht.de` |
| Demir & Kollegen | Hamburg | Familien-, Straf-, Erbrecht | `selin.demir@demir-kollegen.de` |

- Das Passwort aller Demo-Zugänge ist `Apex-Demo-2026`. Weitere Personen je Kanzlei (Anwalt, ReFa) finden Sie in `src/core/seed/tenants.ts`.
- Jede Kanzlei sieht ausschließlich ihre eigenen Daten. Im Server-Betrieb wird das serverseitig je Sitzung erzwungen.
- Unveränderte Demodaten werden jeden Tag relativ zu „heute“ neu erzeugt, damit Fristen immer aktuell sind. Sobald ein Kunde etwas ändert, bleiben seine Daten erhalten.

**Kunden einen eigenen Testzugang geben:**

1. Mit `CONSOLE_ADMIN_EMAIL` (Standard: `admin@anwaltapex.de`) und `CONSOLE_ADMIN_PASSWORD` anmelden.
2. In der **Apex Console** „Neuen Testzugang anlegen“ wählen.
3. Kanzlei, Ansprechperson und E-Mail eintragen, „mit Beispieldaten“ oder leer wählen und ein Ablaufdatum setzen.
4. Zugangsdaten und Einladungstext kopieren und an den Kunden senden.

Im Demo-Modus ohne Server lautet das Console-Passwort `Apex-Console-2026`.

---

## KI

| Betrieb | KI-Quelle |
|---|---|
| Server mit `ANTHROPIC_API_KEY` | Claude über die Anthropic API (Standard `claude-opus-5-5`). Der Browser spricht nur mit dem eigenen Server, der Schlüssel bleibt serverseitig. Streaming, Werkzeugnutzung, Prompt-Caching und server-seitige Fallbacks (`fallbacks: "default"`) sind aktiv. |
| Artefakt-Vorschau auf claude.ai | Claude über die Laufzeit des Artefakts. Der Betrachter gibt das einmalig frei. |
| Ohne KI-Zugang | **Demo-KI (offline)**: regelbasierte Analyse und vorbereitete Fallanalysen. Die Präsentation funktioniert so auch ohne Internet. Umschaltbar unter Einstellungen → KI („Präsentationsmodus“). |

Für alle KI-Funktionen gelten drei Grundsätze:

1. **Die KI erkennt, der Fristenrechner berechnet.** Fristen entstehen immer im deterministischen, getesteten Rechenkern, nie im Sprachmodell.
2. **Nur geprüfte Quellen.** Die KI zitiert ausschließlich Entscheidungen, die in der Fall-Datenbank stehen.
3. **Nachvollziehbar.** Rechenweg, Quellen und Begründung werden immer angezeigt. KI-Fristen gehen in die Vier-Augen-Kontrolle.

---

## Architektur

```
src/
  core/        Fachlogik ohne UI: Fristen (§ 222 ZPO), Feiertage (16 Länder), RVG 2025/2021, Zinsen/§ 367 BGB,
               Suche, Rechtsprechung, Datenmodell, Demodaten-Generator (relativ zu „heute“)
  ai/          KI: Claude-Zugang (Server/Artefakt), Fallanalyse, Dokument-Analyse, Assistent mit Werkzeugen
  components/  Designsystem (Liquid Glass), App-Hülle, Assistent/Avatar, Wiki-Player, Fallanalyse
  pages/       Bereiche der App
  lib/backend/ Demo-Backend (IndexedDB) und Server-Backend (REST) hinter einer Schnittstelle
server/        Hono-API: Anmeldung (scrypt, HttpOnly-Cookies), Mandantentrennung, Apex Console, KI-Proxy, SQLite
docs/          Masterprompt, Branding, UI-Leitfaden, Wettbewerbsanalyse, Demo-Skript
brand/         Logo & App-Icon (SVG)
```

Verwendete Technik: React 19, Vite, TypeScript, Tailwind CSS v4, motion, zustand, React Router, TanStack Table, cmdk, lucide, Hono, Node `node:sqlite` und `@anthropic-ai/sdk`. Die Schriften (Geist, Geist Mono) liegen lokal im Projekt. Es gibt keine externen Requests, Fonts oder Tracker.

Die Zielarchitektur für die Produktion beschreibt der [Masterprompt](docs/MASTERPROMPT.md): Monorepo, PostgreSQL mit Row-Level-Security, Meilisearch, BullMQ, Tauri-Desktop-Client und echte beA-, Microsoft-365- und FinTS-Anbindung.

```bash
npm test             # Fachlogik: Fristen, Feiertage, RVG, Zinsen
npm run typecheck
```

---

## Was ist echt, was simuliert?

| Echt im Prototyp | Simuliert bzw. Demo |
|---|---|
| Fristenrechner, Feiertage, RVG-Tabellen, Zinsen und § 367 BGB (mit Tests) | beA-, E-Mail- und Bank-Anbindung: Status und Abruf sind animiert, die Nachrichten kommen aus Demodaten |
| Anmeldung, Mandantentrennung, Testzugänge, Teamverwaltung (Server) | Fall-Datenbank: Auszug echter Leitentscheidungen mit sinngemäß zusammengefassten Leitsätzen, Anbindung an Open Legal Data und NeuRIS vorbereitet |
| KI-Fallanalyse, Posteingangs-KI und Assistent live mit Claude (Server oder Artefakt) | Demo-KI ohne Schlüssel: regelbasiert, mit vorbereiteten Analysen für die Präsentationsakten |
| CSV-Import im Umzugsassistenten | Formate der Altsysteme: Beispiel-Exporte (echte Importer folgen in Phase 6) |
| Sprachein- und -ausgabe (Web Speech API, Chrome/Edge/Safari) | „Ø 38 Std. pro Woche“: Werte aus Demodaten, keine Messung |

---

## Dokumente

- [Masterprompt & Modellempfehlung](docs/MASTERPROMPT.md)
- [Marke & Gestaltung](docs/BRANDING.md)
- [UI- & Entwicklungsleitfaden](docs/UI-LEITFADEN.md)
- [Wettbewerbsanalyse & Antwort auf die Kundenkritik](docs/WETTBEWERBSANALYSE.md) sowie die [Rohrecherche mit Quellen](docs/WETTBEWERB-RECHERCHE.md)
- [Demo-Skript für Kundenpräsentationen](docs/DEMO-SKRIPT.md)

# Übergabe: Apex (vormals AnwaltApex) – Stand 19.10.2026

Diese Datei ist der Einstieg für den nächsten Entwicklungs-Agenten. Zuerst lesen: `CLAUDE.md`, dann diese Datei, dann `docs/design/DESIGN-SYSTEM.md` (verbindlich für das laufende Redesign).

## 1. Worum es geht

**Apex** ist eine Kanzleisoftware für deutsche Rechtsanwältinnen und Rechtsanwälte (Prototyp zur Kundenpräsentation, mit mehreren Testzugängen). Kernfunktionen: Cockpit, Akten/E-Akte, Kontakte, Posteingang mit KI-Fristerkennung (beA/E-Mail simuliert), Fristen (Rechner nach § 222 ZPO, Vier-Augen-Kontrolle), Apex KI (Fallanalyse, Dokument-Analyse, Schriftsatz-Entwurf), Fall-Datenbank (kuratierter Auszug), 38h-Motor, Abrechnung (RVG, Rechnungen, Sammelabrechnung, Bankabgleich, Forderungskonto), Umzug aus Altsoftware, Hilfe & Support, Einstellungen, Apex Assistent (Chat/Sprache), Apex Console (Anbieter legt Testzugänge an).

Stack: Vite + React 19 + TypeScript + Tailwind v4 + motion/react + zustand + react-router; Server Hono + node:sqlite. Drei Betriebsarten: Demo im Browser (IndexedDB), Server (`server/index.ts`, Docker/Render), Einzeldatei-Artefakt (`npm run build:artifact`).

Wichtige Dokumente: `README.md` (Überblick, Betrieb), `docs/MASTERPROMPT.md` (Produktauftrag + Modellempfehlung), `docs/DEMO-SKRIPT.md` (Präsentation), `docs/UI-LEITFADEN.md`, `docs/BRANDING.md`, `docs/KUNDENAVATAR.md` + `docs/usability/` (5 Testiterationen), `docs/REBRANDING-PLAN.md`, `docs/design/` (Redesign).

## 2. Befehle

```
npm install
npm run dev                  # Demo-Modus http://127.0.0.1:5173
npm run typecheck && npm test && npm run build
npm run build:artifact       # dist-artifact/anwaltapex.html (Dateiname bewusst unverändert)
node scripts/shot.mjs http://127.0.0.1:5173 <ordner> "/cockpit,/fristen" [--mobile] [--dark] [--login=email]
node scripts/usability/avatar.mjs <profilordner> <schritte.json>   # siehe scripts/usability/README.md
```

Logins (Demo-Modus, Passwort `Apex-Demo-2026`): `julia.hartmann@hartmann-partner.de` (Berlin, Hauptzugang), `stefan.lindner@lindner-recht.de`, `selin.demir@demir-kollegen.de`, ReFa `mia.becker@hartmann-partner.de`. Apex Console (Demo): `admin@apex-kanzlei.de` / `Apex-Console-2026`. Auf einem Server braucht `CONSOLE_ADMIN_PASSWORD` mindestens 12 Zeichen und darf nicht das öffentliche Demo-Passwort sein.

## 3. Stand der Arbeit

### Fertig und committet
- Fachlogik, KI, Server, alle Seiten (siehe README). 5 volle Usability-Iterationen mit dem Kundenavatar Claudia Reinholz: SUS 65,6 → 71,9 → 76,3 → 78,1 → 80,6; 362 von 364 Befunden umgesetzt (`docs/usability/README.md`).
- **Rebranding Phase A (Benennung AnwaltApex → Apex)** vollständig, inkl. Adressen `@apex-kanzlei.de` (Platzhalter-Domain), Lizenzpräfix `APX-`. Bewusst unverändert: Datenbankdatei `anwaltapex.db`, Docker-Volume, `aa:`-Browserschlüssel, Cookie `aa_sid`, Artefaktdatei `anwaltapex.html` (Liste in `docs/BRANDING.md`).
- Redesign Phase 1–3: Recherche (`docs/design/RECHERCHE.md`), 6 Logo-Konzepte (`docs/design/logo-konzepte/`), Designsystem (`docs/design/DESIGN-SYSTEM.md`), Brand-Board, Markendateien (`brand/*.svg`, `public/favicon.svg`).

### Redesign „Robe & Papier“ – Entscheidungen (verbindlich)
Auslöser: Auftraggeber findet Farben und Logo schlecht (blau-violett, Glas, Leuchten) und wünscht „alles viel minimalistischer, mehr wie inordo.de“, einzigartiges Logo, Best Practices für SaaS-Design.
- **Logo „Eckpunkt“:** rechter Winkel aus zwei Schenkeln + Punkt in der Öffnung (Geometrie in DESIGN-SYSTEM.md; Pfad `M6 6h20v5H11v15H6z`, Punkt r 3,5 bei (18,5|18,5)). Vor einer Markenanmeldung: Recherche DPMA/EUIPO/WIPO (Klassen 9, 42, 45) – bisher nur Plausibilitätsprüfung.
- **Farben „Graphit“:** Akzent = Text 1 (`#1A1917` hell / `#F4F3F1` dunkel), Grund `#FAFAF9` / `#111110`, Fläche `#FFFFFF` / `#181816`; Rot `#C8302B` ausschließlich für Notfrist/kritisch/Löschen/überfällig, Bernstein für „bald fällig“, Grün für erledigt. KI hat keine eigene Farbe (Wort „KI“ + Sparkles). Kontraste per Skript nachgemessen (0 Verstöße AA).
- **Schrift:** Geist + Geist Mono (selbst gehostet), nur Gewichte 400/500/600. **Form:** Radien 4/6/8/12, Linien statt Schatten, Bewegung 100–240 ms ohne Federn.
- Verboten: Verläufe, Glas/Unschärfe, Aura, Leuchten, bunte KI-Effekte, große Schatten, Versalien-Zeilen.
- **Referenz inordo.de:** aus der Cloud-Umgebung nicht erreichbar (Proxy 403, Netzwerkrichtlinie). Das Design folgt deshalb „minimalistisch nach SaaS-Best-Practices“ und NICHT einem Abgleich mit der Seite. Hinweis: In der Repo-Liste des Auftraggebers existiert `fabian-km/InOrdo` (privat) – möglicherweise Quellcode der Referenz; **nur nach Rückfrage beim Auftraggeber** ansehen oder nutzen, nichts übernehmen, was fremde Rechte berührt (Logo, Texte, Bilder, lizenzpflichtige Schriften).

### Redesign: Umsetzungsstand (UNVOLLSTÄNDIG – das Limit der Plattform hat den Lauf abgebrochen)
| Bereich | Stand |
|---|---|
| `src/styles/index.css`, `src/components/**` (ui, shell, Assistent, Logo, Wiki, FallanalysePanel) | umgesetzt (tsc grün, axe 0 serious/critical laut Bericht) |
| Startseite `/willkommen`, Login, Console (`src/pages/public`, `console`) | umgesetzt |
| Cockpit, Akten, Kontakte, Posteingang, Fristen | umgesetzt |
| **Apex KI, Fall-Datenbank, 38h-Motor, Abrechnung, Umzug, Hilfe, Einstellungen** (`src/pages/ki, falldb, motor, abrechnung, umzug, hilfe, einstellungen`) | **abgebrochen/unbekannt – teils neu, teils noch alt; prüfen und fertigstellen** (38h-Motor ist der Screenshot, den der Auftraggeber bemängelt hat) |
| QA-Sweep, Kundenavatar-Eindruck, Feinschliff, Doku, neue README-Screenshots, Artefakt neu veröffentlichen | **nicht ausgeführt** |

Die Änderungen dieser Stände sind im aktuellen Commit enthalten (Arbeitsstand, `tsc` fehlerfrei, siehe 4 für Tests).

## 4. Bekannte Probleme

1. **Zwei Tests schlagen fehl** – auch auf dem Commit davor, daher vermutlich Datumsabhängigkeit (Prüfung heute am Montag 19.10.2026; sie liefen am Freitag/Samstag 16./17.10. grün):
   - `Demodaten (SEED_VERSION 13): Elbtal-Umsatz auf dem Anderkonto, Gerichtsdaten werktags, … sonst unverändert` (Fingerabdruck der Demodaten, erwartet `f5dd734e05cea8da`, tatsächlich `193ed721e327ff6c`).
   - `Korrigierte Frist aus der Nachricht gilt als notiert … (I5-T03-01)` (`src/pages/posteingang/analyse.test.ts`/`analyse.ts`, `istNotiertAusNachricht`).
   Zuerst klären, ob der Test (feste Daten/Wochentage) oder der Code (Wochenend-/Montagslogik) falsch ist; dann reparieren. Tests mit `faketime`/festem „heute“ absichern.
2. Artefakt-Version 3 (https://claude.ai/artifact/2vaUsEBjjiTLcwihtjG67y, privat, Besitzer ist der Auftraggeber) zeigt den **alten** Look (Stand Rebranding Phase A). Nach dem Redesign neu bauen und unter derselben URL veröffentlichen: `npm run build:artifact`, Capabilities `{sample: {}, downloads: true}`, Titel „Apex Kanzleisoftware“.
3. Redesign-Reste in `src/pages/**`: `grep -rn "gradient\|glass\|aura\|glow\|backdrop-blur\|from-\|via-\|to-\|shadow-" src/pages` und feste Farben (`#hex`, `rgb(`) prüfen.
4. `src/pages/einstellungen/Reiter.tsx` ist neu (Text-Tabs nach DESIGN-SYSTEM 12.5) – prüfen, ob `AkteDetail.tsx` sie nutzen soll („Fundament-Wunsch“ der Arbeits-Seiten).

## 5. Nächste Schritte (Reihenfolge)

1. **Tests grün machen** (Abschnitt 4.1), `npm run typecheck && npm test && npm run build`.
2. **Redesign abschließen:** die sieben Seitenbereiche aus der Tabelle (Abschnitt 3) nach `docs/design/DESIGN-SYSTEM.md` fertigstellen – ruhige Kennzahlenleisten statt Kachelwänden, schlichte Tabellen, ein Akzent, Rot nur für Kritisches. Danach `grep`-Sweep (4.3).
3. **Visueller Sweep:** alle Routen und Reiter, 1440/1280×720/768/390/320, hell + dunkel; `scripts/usability/avatar.mjs` oder `scripts/shot.mjs`. axe 0 serious/critical auf ≥ 25 Ansichten; Konsole 0 Fehler (500 auf `/api/info` im Demo-Modus ignorieren).
4. **Kundenavatar-Kurzprüfung** (Persona in `docs/KUNDENAVATAR.md`): Eindruck zum neuen Design, Kernaufgaben T01, T02, T03, T07, T14; Ergebnis in `docs/design/AVATAR-EINDRUCK.md`; Befunde umsetzen. Ziel: mindestens die Werte aus Iteration 5 (SUS ≥ 80, Look & Feel ≤ 2,0).
5. **Doku:** `docs/UI-LEITFADEN.md` auf das neue Designsystem; `docs/BRANDING.md`; README-Design-Abschnitt; **README-Screenshots neu** (`docs/screenshots/*.png`, ≤ 400 KB, mobil mit Skalierung 2); `docs/REBRANDING-PLAN.md` um „Redesign umgesetzt (ohne Referenzzugriff auf inordo.de)“ ergänzen; `docs/DEMO-SKRIPT.md` auf neue Optik prüfen.
6. **Deploy:** Artefakt neu veröffentlichen (4.2); GitHub-Push; echter Server (Render/Docker) nur mit Zugang des Auftraggebers (`render.yaml`, `Dockerfile` vorhanden; `CONSOLE_ADMIN_PASSWORD` ≥ 12 Zeichen, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, optional `ANTHROPIC_API_KEY`).
7. **Nach Freigabe von inordo.de bzw. mit Screenshots:** Feinabgleich der Optik an der Referenz (`docs/REBRANDING-PLAN.md`, Abschnitte 1 und 4).

## 6. Offene Entscheidungen des Auftraggebers

Im Produkt nur neutral formuliert („im Angebot geregelt“/„auf Anfrage“) – nichts erfinden: Lizenzpreis (Kundenavatar: günstig ≈ 12.000 €, Schmerzgrenze 30.000–35.000 € für 7 Plätze), Wartung (Satz, Inhalt, ob erstes Jahr enthalten), Übertragbarkeit der Lizenz, Quellcode-Hinterlegung (Escrow), KI-Verarbeitung in der EU (§ 43e BRAO), echtes Impressum (§ 5 DDG), Festpreis für den begleiteten Umzug, Pilot/Probelauf vor Vertragsschluss, **echte Domain** (ersetzt `apex-kanzlei.de` an einer Stelle, `ANBIETER_DOMAIN` in `src/core/seed/tenants.ts`/`kunde.ts`), einheitlicher Kostensatz für „gesparte Zeit“ (Cockpit 19,74 €/Std. ≈ 27.000 €/Jahr vs. 38h-Motor-Seite 26,04 €/Std. ≈ 35.000 €/Jahr; im Demo-Skript erklärt), Logo-Freigabe nach Markenrecherche.

## 7. Regeln für Änderungen (Auszug aus CLAUDE.md und Erfahrung)

- Fachlogik nur in `src/core` mit Tests; Fristen nur über `src/core/fristen.ts`; Zählung nur über `src/core/fristenLage.ts` (Frist = Notfrist + Frist; Wiedervorlagen/Vorfristen/Termine getrennt); Kennzahlen über `src/core/kennzahlen.ts`; Rollenlabels `src/lib/rollen.ts`; Offline-KI-Name `DEMO_KI_NAME`.
- KI nur über `src/ai/llm.ts`, jede Funktion mit Offline-Fallback. Mandantentrennung nie aufweichen (`server/index.ts`, Header `X-Kanzlei`/`X-Nutzer`).
- Keine `alert/confirm/prompt/window.open`, keine externen Ressourcen zur Laufzeit; Artefakt-tauglich (Memory-Router, Downloads über `claude.use("downloads")`).
- Barrierefreiheit: Kontrast AA, Fokus sichtbar, Tippziele ≥ 44 px mobil, axe 0 serious/critical, reduzierte Bewegung, 320–1440 px ohne Querscrollen.
- UI-Sprache Deutsch, Typografie „…“ und –, geschützte Leerzeichen bei § und Einheiten.
- Prozesse nur per PID beenden (kein `pkill -f`). Der Container hatte mehrfach Speicherprobleme bei vielen parallelen Browsern: höchstens drei bis vier Agenten/Browser gleichzeitig.

## 8. Zugang und Umgebung

- GitHub: Das Repo `LeonSchaefer1/AnwaltApex` existierte für die Entwicklungssitzung nicht bzw. war nicht freigegeben; ein Anlegen aus der Sitzung war nicht möglich (GitHub-API auf die konfigurierten Repos beschränkt). Der gesamte Stand liegt als Git-Bundle `apex-uebergabe.bundle` vor (vollständige Historie, 19 Commits, Branch `main`). Übernahme:
  ```
  git clone apex-uebergabe.bundle apex && cd apex
  git remote set-url origin https://github.com/<konto>/<neues-repo>.git   # Repo leer anlegen, Claude-GitHub-App freigeben
  git push -u origin main
  ```
  Wenn diese Datei bereits auf GitHub liegt, wurde das Repo inzwischen angebunden.
- Netzwerk der Cloud-Umgebung: Zugriff auf `inordo.de` gesperrt (Einstellung „Allowed domains“ in der Umgebung).
- Dev-Server: `npm run dev` bzw. `npx vite --host 127.0.0.1 --port 5173 --strictPort`.

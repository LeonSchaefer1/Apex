# Rebranding „AnwaltApex“ → „Apex“ im Stil von inordo.de

Stand: 18.10.2026 · Auftrag: Software komplett zu **„Apex“** umbenennen, Styling und Design **sehr nah an https://inordo.de/** ausrichten (für Anwältinnen und Anwälte), alles umsetzen und deployen.

---

## 0. Ziel und Leitplanken

**Ziel:** Ein Produkt, eine Marke: **Apex – die Kanzleisoftware**. Optisch nah an der Gestaltungssprache von inordo.de, inhaltlich und funktional unverändert. Alles, was in den fünf Usability-Iterationen erreicht wurde, bleibt erhalten oder wird besser: SUS ≥ 80, axe ohne serious/critical, 229 Tests grün, 360–1440 px, Hell- und Dunkelmodus.

**Was „sehr nah an inordo.de“ heißt – und was nicht:**

| Übernehmen (Gestaltungsprinzipien) | Nicht übernehmen (fremde Rechte) |
|---|---|
| Farbklima und Kontrastlogik, Verhältnis von Fläche zu Akzent | Logo, Bildmarke, Wortmarke von inordo |
| Typografie-Charakter (Schriftfamilie bzw. gleichwertige freie Schrift, Größen, Gewichte, Zeilenhöhen, Laufweiten) | Texte, Claims, Kundenstimmen, Fallstudien |
| Raster, Abstände, Sektionsrhythmus, Breakpoints | Fotos, Illustrationen, Icons, Videos (Urheberrecht) |
| Komponenten-Anmutung: Buttons, Karten, Navigation, Formulare, Tabellen, Badges | Schriftdateien mit Lizenzbindung (nur freie Schriften einbinden) |
| Bewegung: Dauer, Kurven, Scroll- und Hover-Verhalten | Eine Verwechslungsgefahr mit inordo (§ 4 Nr. 3 UWG, Markenrecht) |
| Aufbau der Startseite: Abfolge und Funktion der Abschnitte | |

**Unverändert bleiben:** Fachlogik (`src/core`), KI-Logik (`src/ai`), Server, Datenmodell, Demodaten-Inhalte, alle Funktionen und Abläufe, Barrierefreiheit, Deep-Links und Tastenkürzel.

---

## 1. Blocker und Vorbedingung: Zugriff auf die Referenz

**Stand 18.10.2026:** Die Netzwerkrichtlinie der Cloud-Umgebung blockiert `inordo.de` (Proxy: `connect_rejected`). Auch die Websuche liefert keine Inhalte der Seite. Ohne die Referenz darf das Design **nicht** „nach Gefühl“ nachgebaut werden, sonst ist das Ergebnis nicht „sehr nah an inordo.de“.

**Freischalten (eine der beiden Möglichkeiten):**

1. **Netzwerk freigeben:** In den Einstellungen der Cloud-Umgebung (Umgebungsmenü in der Titelleiste der Sitzung → Bearbeiten → Netzwerkzugriff) `inordo.de` unter „Allowed domains“ eintragen (Paketmanager-Häkchen gesetzt lassen) oder eine weitere Zugriffsstufe wählen. Anleitung: https://code.claude.com/docs/en/cloud-environments#network-access
2. **Referenzmaterial schicken:** ganzseitige Screenshots der Startseite auf Desktop (1440 px) und Smartphone (390 px), dazu je ein Bild von Unterseiten und von geöffneten Menüs bzw. Hover-Zuständen. Hilfreich: Name der Schriftart und die wichtigsten Farbwerte, falls bekannt.

**Referenz erfassen (sobald Zugriff besteht), Ergebnis `docs/referenz/inordo-analyse.md`:**

- [ ] Ganzseitige Screenshots: Desktop 1440, Laptop 1280, Tablet 768, Smartphone 390, jeweils hell (und dunkel, falls vorhanden).
- [ ] Sektionen von oben nach unten mit Funktion (Hero, Logos, Nutzen, Funktionen, Prozess, Zahlen, Stimmen, Preise, FAQ, Abschluss-CTA, Footer).
- [ ] Automatische Stil-Extraktion per Playwright: `getComputedStyle` für h1–h6, p, a, button, input, Karte, Navigation; CSS-Variablen; Farbpalette nach Häufigkeit; Schriftfamilien und -dateien; Größen- und Abstands-Skala; Radien; Schatten; Breakpoints; Übergänge und Animationen.
- [ ] Komponenten-Inventar mit Ausschnitten: Header/Navigation (inkl. mobil), Buttons (primär/sekundär/Text, Zustände), Karten, Formularfelder, Badges, Tabellen, Akkordeon, Footer.
- [ ] Bewegung: Scroll-Effekte, Einblendungen, Hover, Dauer und Kurven.
- [ ] Ableitung „Was macht den Stil aus“ in 10 Sätzen, damit alle Umsetzenden dasselbe Bild haben.

---

## 2. Marke und Benennung (unabhängig von der Referenz – wird sofort umgesetzt)

### 2.1 Name und Schreibweise

| Bisher | Neu | Regel |
|---|---|---|
| AnwaltApex | **Apex** | Produktname, immer großes A, ohne Zusatz |
| AnwaltApex (beschreibend) | **Apex – Kanzleisoftware** | wo der Name allein unklar ist (Titel, Meta, Artefakt-Titel, Rechnungsfuß); nicht auf der Anmeldeseite, dort beschreibt die Überschrift „Die Kanzlei-Software, die mitdenkt.“ das Produkt (Prüfung Phase A) |
| Apex Assistent, Apex KI, Apex Island, Apex Console | unverändert | Untermarken bleiben |
| 38h-Motor, Fall-Datenbank, Umzug, Schnellhilfe | unverändert | Funktionsnamen bleiben |
| „Kundenavatar AnwaltApex“ usw. in lebenden Dokumenten | „Apex“ | |
| Historische Berichte (`docs/usability/iteration-*`) | unverändert | Hinweis „heute Apex“ in `docs/usability/README.md` |

Grammatik: „Apex“ ist neutral („das Apex-Cockpit“, „in Apex“, „Apex rechnet …“). Keine Konstruktionen wie „der Apex“.

### 2.2 Domain und Adressen

- Demo- und Betreiberadressen enden auf eine **Platzhalter-Domain der Marke** (`apex-kanzlei.de`, vor Livegang durch die echte Domain des Auftraggebers zu ersetzen). Bisher `@anwaltapex.de`.
- Console-Login im Demo-Modus: `admin@apex-kanzlei.de` / `Apex-Console-2026`. Kanzlei-Logins der Beispielkanzleien bleiben unverändert (eigene Kanzlei-Domains).
- Lizenznummern, Rechnungsfuß, Einladungstexte, Systemmeldungen und Ansprechpartner-E-Mails auf die neue Domain umstellen.

### 2.3 Wo der Name vorkommt (Inventur 18.10.2026: 216 Stellen in 78 Dateien außerhalb von `docs/`)

- `index.html` (Titel, Meta), `src/app/**`, `src/components/**` (Logo, Wortmarke, Seitenleiste, Ladebildschirm), `src/pages/**` (Landing, Login, Console, Hilfe, Einstellungen/Lizenz, Rechnungen), `src/ai/**` (System-Prompts, Begrüßung), `src/content/wiki.ts`, `src/core/seed/**` (Lizenzen, E-Mails, Ansprechpartner), `src/lib/backend/**`, `server/index.ts` (Meldungen, Console-Standardadresse), `scripts/**`, `package.json` (`name`), `Dockerfile`, `docker-compose.yml`, `render.yaml`, `.env.example`, `README.md`, `CLAUDE.md`.
- Lebende Dokumente: `docs/BRANDING.md` (neu schreiben), `docs/MASTERPROMPT.md`, `docs/DEMO-SKRIPT.md`, `docs/UI-LEITFADEN.md`, `docs/KUNDENAVATAR.md`, `docs/WETTBEWERBSANALYSE.md`, `docs/WETTBEWERB-RECHERCHE.md`.
- Technische Bezeichner (`aa:`-Schlüssel im Browser-Speicher, Ordnername, Datenbank-Dateiname) bleiben, damit vorhandene Daten erhalten bleiben. Für Nutzer sind sie unsichtbar.

### 2.4 Abnahme Benennung

- `grep -ri "anwaltapex\|anwalt apex"` außerhalb von `docs/usability/**`, `docs/REBRANDING-PLAN.md`, `node_modules`, `.git` und Build-Ordnern ergibt nur noch technische Bezeichner (Liste in `docs/BRANDING.md`, „Frühere Bezeichner, die bewusst bleiben“).
- Die Oberfläche zeigt nirgends mehr „AnwaltApex“: Sweep über alle Routen mit Textsuche.
- Tests, Typecheck und Build sind grün.

---

## 3. Logo und Markenzeichen

- **Wortmarke:** „Apex“ in der Hauptschrift der Referenz-Anmutung, Gewicht und Laufweite nach Analyse. Bis dahin: bestehende Schrift (Geist), Wortmarke nur „Apex“.
- **Bildmarke:** Die Feder-A-Marke bleibt als Grundidee (A wie Apex, Feder als Anwaltsbezug). Form, Strichstärke und Farbe werden an die Referenz angepasst (z. B. flach statt Verlauf, wenn die Referenz flach ist).
- **Ableitungen:** `public/favicon.svg`, `brand/app-icon.svg`, `brand/logo-mark*.svg`, Apple-Touch-Icon, Open-Graph-Bild (1200×630) für Link-Vorschauen, Ladebildschirm, E-Mail-/Rechnungskopf.
- **Prüfung:** Kontrast auf hellem und dunklem Grund, Lesbarkeit bei 16 px, keine Ähnlichkeit zur Marke von inordo.

---

## 4. Designsystem übertragen

### 4.1 Token-Architektur (`src/styles/index.css`)

Alle Farben, Schriften, Radien, Schatten, Abstände und Bewegungen laufen schon heute über Tokens. Das Rebranding tauscht **Token-Werte** und **Komponenten-Rezepte** aus, nicht die Seitenlogik.

| Token-Gruppe | Heute | Neu (aus der Analyse) |
|---|---|---|
| Farben: Grund, Flächen, Linien, Text (fg-1…4), Akzent (`--ink`), Signal (seal/amber/green/violet), KI-Verlauf | Liquid Glass, Blau `#2440d8` | Palette der Referenz, Kontrast WCAG AA (Text ≥ 4,5:1, Grafik ≥ 3:1), hell und dunkel |
| Schrift | Geist / Geist Mono, selbst gehostet | Schrift der Referenz oder freie Entsprechung (selbst gehostet, keine CDNs) |
| Typo-Skala | heutige Größen | Skala der Referenz (Display, H1–H4, Text, Klein, Label) inkl. Zeilenhöhe und Laufweite |
| Radien | 12–28 px, „squircle“-Anmutung | Radien der Referenz |
| Schatten und Tiefe | Glas, Lichtkante, Aura | Tiefe der Referenz (vermutlich flacher – Glas-Effekte dann reduzieren bzw. entfernen) |
| Abstände | 4er-Raster | Raster und Sektionsabstände der Referenz |
| Bewegung | Federn (motion/react), Aura | Dauer und Kurven der Referenz; `prefers-reduced-motion` bleibt |

### 4.2 Komponenten

`src/components/ui/**` und `src/components/shell/**`: Button (Varianten, Größen, Fokus, Laden), Field/Input/Select/Textarea, Card/Glass/Sheet, Chip/Badge, Segmented/Tabs, DataTable, Modal/Drawer, Menu, Toast/Island, Switch/Checkbox, Stat/Kennzahl, Diagramme, Leerzustände, Ladebildschirm, Seitenleiste, Kopfleiste, mobile Tab-Leiste, Befehlspalette (Strg+K), Apex Assistent (Kugel und Dock), Schnellhilfe/Wiki-Player.

Für jede Komponente gilt: Zustände (Ruhe, Hover, Fokus, Aktiv, Deaktiviert, Fehler) hell und dunkel, Tippziele ≥ 44 px am Telefon, Fokus sichtbar und nie verdeckt.

### 4.3 Glas-Entscheidung

Die heutige „Liquid Glass“-Anmutung (Briefing 1) weicht vermutlich von inordo ab. Entscheidung nach der Analyse:

- **Wenn die Referenz flach/hell ist:** Glas auf wenige Stellen reduzieren (z. B. Apex Island, Assistent), sonst flache Flächen mit feinen Linien.
- **Wenn die Referenz Tiefe und Verläufe nutzt:** Glas behalten, Farben und Radien angleichen.

---

## 5. Startseite (`/willkommen`) nach dem Aufbau der Referenz

1. Sektionsfolge der Referenz übernehmen und mit Apex-Inhalten füllen: Hero mit Produktbild bzw. Live-Vorschau, Vertrauensleiste (keine erfundenen Kundenlogos – stattdessen Fakten wie „§ 222 ZPO mit Rechenweg“, „beA“, „RVG 2025“), USPs, Funktionsabschnitte, 38h-Motor-Rechner, Fall-Datenbank, Umzug, Support, Lifetime-Lizenz, FAQ, Abschluss-CTA, Footer.
2. Texte bleiben inhaltlich bei den geprüften Aussagen (rechtssicher, keine Garantien), Tonalität an die Referenz angepasst.
3. Produkt-Screenshots aus der echten App (Hell/Dunkel), keine Fremdbilder.
4. Mobil: Navigation, Abschnittsabstände und Bildgrößen nach Referenz.

## 6. Anwendung

- **Rahmen:** Seitenleiste, Kopfleiste, Apex Island, mobile Tab-Leiste, Strg+K, Assistent.
- **Seiten (alle):** Cockpit, Akten (Liste, Detail mit 7 Reitern, Mandatsaufnahme), Kontakte, Posteingang (inkl. KI-Karte), Fristen (Liste/Woche/Monat, Rechner), Apex KI (3 Reiter), Fall-Datenbank, 38h-Motor, Abrechnung (6 Reiter, Rechnungsvorschau „Papier“), Umzug, Hilfe & Support, Einstellungen (6 Reiter), Apex Console, Login, Ladebildschirm.
- **Papier-Dokumente** (Rechnung, Schriftsatz, Forderungsaufstellung): eigener ruhiger Druckstil mit neuer Wortmarke.

## 7. Inhalte und Dokumentation

- `docs/BRANDING.md` neu (Marke Apex, Logo, Farben, Schrift, Tonalität, Do & Don’t, Herleitung aus der Referenzanalyse).
- `docs/UI-LEITFADEN.md` auf die neuen Tokens und Komponenten-Rezepte.
- `README.md`, `docs/DEMO-SKRIPT.md`, `docs/MASTERPROMPT.md`, `docs/KUNDENAVATAR.md` auf „Apex“.
- Neue README-Screenshots.

## 8. Qualitätssicherung

| Prüfung | Kriterium |
|---|---|
| Typecheck, Tests, Build, Artefakt-Build | fehlerfrei, 229/229 Tests |
| Visueller Vorher-Nachher-Vergleich | alle Hauptrouten D/M, hell/dunkel; keine abgeschnittenen Texte, kein Querscrollen bei 320–1440 px |
| Referenz-Abgleich | Seite-an-Seite-Bilder Startseite Apex ↔ Referenz; Token-Tabelle vollständig erfüllt |
| Barrierefreiheit | axe 0 serious/critical; Kontraste AA; Fokus sichtbar; 200 % Zoom; reduzierte Bewegung |
| Usability-Kurzprüfung | Kundenavatar Claudia Reinholz: Kernaufgaben T01, T02, T03, T07, T14 ohne neue Fehlaktionen; Look & Feel mindestens wie Iteration 5 |
| Konsole | 0 Fehler über alle Routen |
| Server-Smoke | Login, Daten, Console, Testzugang |

## 9. Deploy

| Ziel | Stand | Vorgehen |
|---|---|---|
| **Artefakt-Demo (claude.ai)** | veröffentlicht, Version 2 | nach jeder Phase neu bauen und unter **derselben URL** veröffentlichen; Titel „Apex“ |
| **GitHub** | blockiert: Repo `LeonSchaefer1/AnwaltApex` nicht erreichbar | Repo anlegen (Name z. B. `Apex`) und Claude-GitHub-App freigeben, dann Push aller Commits |
| **Server (Docker/Render)** | Dockerfile, `render.yaml` bereit | braucht ein Render-Konto bzw. einen Server des Auftraggebers; `CONSOLE_ADMIN_PASSWORD` (≥ 12 Zeichen), `ANTHROPIC_API_KEY` optional, `COOKIE_SECURE=true`, `TRUST_PROXY=true` |

## 10. Ablauf und Reihenfolge

| Phase | Inhalt | Abhängigkeit |
|---|---|---|
| **A** | Benennung „Apex“ in Code, Texten, Assets, Doku (Abschnitt 2), Artefakt neu veröffentlichen | keine – **sofort** |
| **B** | Referenz erfassen und analysieren (Abschnitt 1) | Netzwerkfreigabe oder Screenshots |
| **C** | Token-Werte, Schrift, Logo-Feinschliff (3, 4.1, 4.3) | B |
| **D** | Komponenten und Rahmen (4.2, 6 Rahmen) | C |
| **E** | Startseite nach Referenz (5) | C |
| **F** | Alle App-Seiten, Papier-Dokumente (6) | D |
| **G** | Doku, Screenshots (7) | E, F |
| **H** | QA inkl. Kundenavatar (8) | G |
| **I** | Deploy (9) | H |

Parallelisierung: D, E und F arbeiten in getrennten Dateibereichen (Rahmen/Komponenten · Landing/Login/Console · Fachseiten), C ist gemeinsame Grundlage und läuft zuerst.

## 11. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Zu große Nähe zur Referenz (Verwechslung, Nachahmung) | nur Gestaltungsprinzipien; eigene Marke, eigene Texte und Bilder; Abschnitt 0 als Prüfliste |
| Schrift der Referenz ist lizenzpflichtig | freie Schrift mit gleichem Charakter wählen, selbst hosten |
| Kontrast oder Fokus verschlechtern sich | axe und Kontrastmessung in jeder Phase |
| Usability-Rückschritt durch neue Optik | Kurzprüfung mit dem Kundenavatar (8) |
| Artefakt-Größe wächst (Schriften, Bilder) | Schriften als woff2-Teilmengen, Bilder komprimiert, Budget < 5 MB |
| Deploy ohne Zugangsdaten nicht möglich | Artefakt sofort; GitHub/Render nach Freigabe durch den Auftraggeber |

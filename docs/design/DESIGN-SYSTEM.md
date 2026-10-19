# Apex – Designsystem „Robe & Papier“

> **Stand:** 18.10.2026 · **Status:** verbindlich für die Umsetzung des Redesigns. Ersetzt die Gestaltungsregeln „Glas & Tinte“ (Liquid Glass) in `src/styles/index.css`, `docs/BRANDING.md` und `docs/UI-LEITFADEN.md` §1–2. Die Regeln zu Daten, Fachlogik, Barrierefreiheit und Tastatur im UI-Leitfaden gelten unverändert weiter.
>
> **Anlass:** Der Auftraggeber lehnt die Farben (Blau-Violett, Verläufe, Glas, Leuchten) und das Logo ab und wünscht „alles viel minimalistischer“.
>
> **Grundlagen:** [`RECHERCHE.md`](RECHERCHE.md) (Best Practices, drei Farbrichtungen mit Messwerten), [`logo-konzepte/KONZEPTE.md`](logo-konzepte/KONZEPTE.md) (sechs Bildmarken), Screenshots des heutigen Stands (Cockpit, Fristen, 38h-Motor, Startseite hell/dunkel).
>
> **inordo.de** ist aus dieser Umgebung nicht erreichbar und wurde **nicht** ausgewertet. Nichts in diesem Dokument beschreibt oder kopiert diese Seite. Maßstab ist „viel minimalistischer“ im Sinne ruhiger, moderner B2B-SaaS-Produkte.
>
> **Markenbild:** [`brand-board.png`](brand-board.png) (Quelle: [`brand-board.html`](brand-board.html)) zeigt Logo, Palette mit Kontrasten, Schrift und Beispiel-Bausteine in Hell und Dunkel.

---

## 0. Entscheidungen auf einen Blick

| Thema | Entscheidung | Kurzbegründung |
|---|---|---|
| **Bildmarke** | **„Eckpunkt“**: verfeinertes Konzept 1 (Ecke), dazu die Fristen-Idee aus Konzept 3 (Zwölf Uhr) | Höchste Bewertung (41/50), bei 16 px sicher lesbar, kein Klischee. Drei Lesarten: Scheitel (Apex), rechter Winkel (Recht), geheftete Aktenecke. Neu ist die vierte Lesart „Eckpunkt“: Der Punkt ist auch der Zeitpunkt, also das Fristende. Abschnitt 0.1 |
| **Farbrichtung** | **A „Graphit“, als „Robe & Papier“**: Robenschwarz auf Papierweiß, Siegelrot nur für Kritisches | Am minimalistischsten, maximaler Abstand zu Blau-Violett, seriös. Eigenständig über die Herleitung aus dem Beruf (schwarze Robe, weißes Papier, rotes Siegel) und über die Bildmarke. Abschnitt 0.2 |
| **Akzent** | Text 1 selbst: `#1A1917` hell, `#F4F3F1` dunkel | Ein einziger Akzent. Farbe erscheint nur, wenn sie etwas bedeutet. |
| **Signalfarben** | Siegelrot `#C8302B`, Bernstein `#B06A00`, Grün `#1F8048` (dunkel `#F06A60`, `#E0A43A`, `#4DBE7C`) | Rot gehört der Notfrist. Status steht immer als Wort plus Symbol da. |
| **Schrift** | **Geist** und **Geist Mono** (bereits selbst gehostet), nur 400/500/600 | Eine Familie, ruhig, tabellarische Ziffern geprüft. Keine neue Schriftdatei nötig. |
| **Form** | Radien 4/6/8/12 px, 1-px-Linien statt Schatten, Bewegung 100–240 ms ohne Federn | „Linien statt Schatten, deckende Flächen statt Glas.“ |
| **KI** | Keine eigene Farbe. Kennzeichnung durch das Wort „KI“ und das Symbol `Sparkles`. | Prüfbar statt „magisch“. |
| **Kontrast** | 54 Pflichtpaare je Modus nachgerechnet, **0 Verstöße** in Hell und Dunkel. Kleinster Textkontrast 4,89 : 1 (hell) bzw. 4,94 : 1 (dunkel). | Abschnitt 4.4 |

### 0.1 Warum „Eckpunkt“

- **Geprüft:** alle sechs Konzepte in 16/24/32/64/256 px auf Hell und Dunkel, als Wortmarke, App-Icon und Favicon.
- **Paragraf (2):** scheidet aus. Austauschbar und als Marke nur schwach schutzfähig.
- **Zwölf Uhr (3):** Bei 16 px schließt sich der Hof, und das Zeichen erinnert an das Ein/Aus-Symbol.
- **Gegen ./. (5):** betont den Streit.
- **Apex-Zeichen (6):** Das „á“ wiederholt sich neben der Wortmarke („á Apex“) und lädt zur falschen Aussprache ein.
- **Hochzahl (4):** am robustesten, aber ohne Erklärung nur „zwei Quadrate“.
- **Ecke (1):** Das Zeichen ist ruhig, architektonisch und einzigartig in der Kombination „eine Ecke + ein Punkt“. Es passt zu einem Interface aus feinen Linien, und es trägt eine Geschichte, die man in einem Satz erzählen kann.

**Verfeinerung gegenüber Konzept 1** (Variantenvergleich in 16–160 px):

1. **Der Punkt wächst** von r 3 auf **r 3,5** und rückt auf **(18,5 | 18,5)**. Bei 20–28 px (Seitenleiste, Kopfleiste) war der alte Punkt zu klein und verschwand neben den kräftigen Schenkeln. Der Abstand zu beiden Schenkeln bleibt exakt **4 Einheiten**, der Punkt liegt weiter auf der Winkelhalbierenden.
2. **Optischer Ausgleich im App-Icon:** Das Gewicht des Zeichens liegt links oben, der Schwerpunkt bei (13,8 | 13,8) statt (16 | 16). Im App-Icon steht die Marke deshalb um 1 Rastereinheit (20 px von 1024) nach rechts unten versetzt. In der Wortmarke bleibt sie geometrisch auf der Versalhöhe zentriert.
3. **Eigenes Favicon im 16er-Raster**, pixelgenau: Schenkel 3 px, Punkt 4 px, 2 px Luft.
4. **Name und zweite Geschichte aus Konzept 3:** Der Punkt in der Ecke ist der **Eckpunkt**, das Wesentliche. Er ist zugleich der **Zeitpunkt**, an dem eine Frist endet. Damit erzählt das Zeichen Fristenkontrolle, ohne die Schwächen des Rings bei 16 px zu übernehmen.

**Nicht verändert:** einfarbig, keine Verläufe, keine Rundungen außer dem Punkt, Wortmarke „Apex“ in Geist SemiBold −0,02 em als Pfad. **Offen:** Register-Recherche DPMA/EUIPO in den Klassen 9, 42 und 45 vor der Anmeldung (siehe `KONZEPTE.md`, nächste Schritte).

### 0.2 Warum „Robe & Papier“ (Richtung A) und nicht Petrol oder Marine

Gemessen an den Wünschen des Auftraggebers:

| Wunsch | A Graphit („Robe & Papier“) | B Petrol | C Marine |
|---|---|---|---|
| viel minimalistischer | **sehr hoch**: eine neutrale Skala, ein Akzent = Textfarbe | hoch | hoch |
| nicht Blau-Violett | **ja**, Buntheit C 0,004 statt 0,231 | ja, liegt aber im Blaugrün (H 204°) | nein, wieder Blau |
| seriös für Kanzleien | **ja**: Schwarz auf Weiß wie ein Schriftsatz, der Druck sieht aus wie der Bildschirm | ja | ja |
| eigenständig | über die Herleitung (Robe, Papier, Siegel) und die Bildmarke | über die Farbe | gering (Branchen-Blau) |
| Signalfarben stechen hervor | **am stärksten**: Die Notfrist ist die einzige laute Farbe. | gut, aber Nähe zu Grün | gut |

**Entscheidung: A.** In einer Fristensoftware ist es ein Funktionsgewinn, wenn nichts mit dem Rot der Notfrist konkurriert. Das Risiko „generisch schwarz-weiß“ fangen drei Dinge auf:

- die einzigartige Bildmarke,
- warme statt bläuliche Grautöne (Papier statt Bildschirm),
- die konsequente Herleitung aus dem Beruf: die **schwarze Robe** der Anwältin, das **weiße Papier** des Schriftsatzes, das **rote Siegel** für „Achtung, Frist“.

Diese drei Begriffe tragen auch die Tonalität (siehe `BRANDING.md`).

---

## 1. Leitprinzipien – so sieht Apex aus

1. Apex sieht aus wie ein gut gesetzter Schriftsatz: schwarze Schrift auf warmem Papierweiß, viel Rand, nichts Überflüssiges.
2. Die Oberfläche besteht zu über 90 % aus neutralen Flächen. Der einzige Akzent ist Robenschwarz (im Dunkeln Papierweiß), und er gehört der Primäraktion, der Auswahl und dem Fokus.
3. Farbe trägt Bedeutung, nie Stimmung: Siegelrot heißt Notfrist, kritisch oder Löschen, Bernstein heißt bald fällig, Grün heißt erledigt. Alles andere ist grau.
4. Ein Status steht immer als Wort plus Symbol da. Farbe ist nur die dritte Bestätigung.
5. Gruppiert wird zuerst über Abstand. Eine 1-px-Linie kommt erst, wenn Abstand nicht reicht, und eine Fläche mit Rahmen erst, wenn auch die Linie nicht reicht. Karten liegen nie in Karten.
6. Es gibt kein Glas, keine Unschärfe, keine Verläufe, kein Leuchten. Jede Fläche ist deckend, und nur schwebende Ebenen (Menü, Dialog, Meldung) werfen im Hellen einen einzigen leisen Schatten.
7. Hierarchie entsteht aus Größe, Gewicht (400/500/600) und vier Graustufen. Es gibt keine Versalien-Zeilen, keinen Verlaufstext und kein Fett über 600.
8. Formen sind zurückhaltend: Ecken mit 4–12 px Radius, rund nur für Avatare, Schalter, Punkte und den Assistent-Knopf.
9. Bewegung erklärt Herkunft und Ziel. Sie dauert 100–240 ms, gleitet ohne Überschwingen und fehlt im Ruhezustand ganz: kein Puls, kein Schimmer, kein Atmen.
10. Icons sind leise Wegweiser: lucide, 16 px, Strich 1,5, in Grau. Sie stehen nie auf farbigen Kacheln.
11. KI ist ein Werkzeug, kein Effekt. Sie wird mit dem Wort „KI“ und einem Symbol gekennzeichnet, und ein Mensch bestätigt das Ergebnis.
12. Hell und Dunkel sind gleichwertig. Im Dunkeln entsteht Tiefe durch hellere Flächen, nicht durch Schatten, und die Signalfarben haben eigene, hellere Werte.

---

## 2. Was entfällt

| Entfällt | heute (Beispiele) | stattdessen |
|---|---|---|
| **Verläufe** jeder Art | `.btn-primary` (Verlauf + Glanzkante), `.btn-danger`, `.bar > span`, `AppIcon`, Logo-Verlauf, `.schluss-karte`, Hero-Zeile „Volle Kontrolle.“ in Blau | eine deckende Farbe |
| **Glas und Unschärfe** | `.glass`, `.glass-strong`, `.glass-thin`, `.glass-menu`, `.glass-deckend`, `.sheet`, `backdrop-filter` in `.table th`, `.btn-secondary`, `.field` | deckende Fläche + 1 px Linie (Abschnitt 12.3) |
| **Aura und belichteter Grund** | `.aura` mit vier unscharfen Farbkugeln und Korn, `--aura-1…4`, `--bg-deep` | einfarbiger Grund `--bg` |
| **Lichtkanten und Reflexe** | `.glass::before` (Specular Rim), `.glow` / `usePointerGlow`, `--glass-rim-*`, `--glass-sheen`, `--glow-light` | nichts |
| **Lichtbrechung** | `.refract`, `RefractionDefs.tsx` (SVG-Displacement der Tab-Leiste) | nichts |
| **Leuchten** | farbige Schatten an Primär-, Gefahr- und KI-Knöpfen, `ai-glow`, Glühen der Abschlusskarte, Schatten des Orbs | nichts |
| **Bunte KI-Verläufe** | `--ai-1…4`, `.ai-ring` (rotierender Kegelverlauf), `.ai-text` (Verlaufstext), `.ai-fill`, `.btn-ai`, irisierende `ApexOrb`-Kugel | neutrale Kennzeichnung (Abschnitt 12.19), Assistent-Knopf (12.13) |
| **Violett** | `--violet`, `--violet-soft`, `chip-violet`, `text-violet` | `--fg-2` bzw. `--surface-2` |
| **Königsblau** | `--ink #2440D8`, blau getönte Auswahl (`--ink-soft`) | Robenschwarz, neutrale Auswahl |
| **Große Schatten** | `--glass-shadow`, `--glass-shadow-lg`, Kartenschatten in `.sheet`, `.paper`-Schatten | Linien; `--shadow-pop` nur für schwebende Ebenen im Hellen |
| **Übermäßige Rahmen und Kacheln** | jede Gruppe als Karte, farbige Icon-Kacheln (`bg-ink-soft text-ink` in `Stat`, `CardHeader`, `Empty`, Schnellaktionen) | Abstand, Linien, Icons ohne Kachel |
| **Kapseln überall** | `border-radius: 999px` an Knöpfen, Chips, Segmenten, Island | 4/6/8 px |
| **Federn und Dauerbewegung** | `--spring`, `stiffness 420–520`, gestaffelte Listen, Puls „verbunden“, Schimmer, Atmen des Orbs, Pulsieren des Lade-Icons, `scale(0.96)` beim Drücken, `translateY(-1px)` beim Hover | kurze Übergänge (Abschnitt 10) |
| **Versalien-Überzeilen** | `.eyebrow` mit `uppercase` und 0,06 em | normale Schreibung, 12 px, 500 |
| **Feste Fremdfarben** | z. B. `#090b14`, `#ffd166`, `#7ee2b8` in `ApexIsland.tsx`, Kegelverlauf in `ApexOrb.tsx`, Verlauf in `Logo.tsx` | Tokens |

---

## 3. Marke in der Oberfläche

Details zur Marke stehen in [`../BRANDING.md`](../BRANDING.md). Für die Umsetzung gilt:

- **Bildmarke im Code:** `src/components/Logo.tsx` übernimmt die neue Geometrie, viewBox `0 0 32 32`:

  ```tsx
  const MARK = "M6 6h20v5H11v15H6z"; // Schenkel
  // dazu <circle cx="18.5" cy="18.5" r="3.5" />, fill="currentColor"
  ```

  - `LogoMark` ist immer einfarbig in `currentColor`. Die Eigenschaft `mono` darf bleiben, ist aber ohne Wirkung.
  - `AppIcon` wird ein flaches Quadrat: `background: var(--ink)`, Radius = Größe × 0,22, Marke in `var(--on-ink)`, optisch +1/32 nach rechts unten versetzt. Kein Verlauf, kein Schatten, keine Innenkante.
- **Wortmarke in der App:** Marke 20 px plus „Apex“ 15 px/600/−0,02 em in `--fg`, Abstand 8 px. Kanzleiname darunter 12 px `--fg-4`.
- **Mindestgrößen:** Bildmarke 16 px (darunter nur das Favicon-Raster), Wortmarke 72 px breit.
- **Schutzraum:** rundum 1/4 der Markenhöhe.
- **Dateien:**
  - `brand/logo-mark.svg`: Robenschwarz, für helle Flächen und Druck
  - `brand/logo-mark-mono.svg`: `currentColor`
  - `brand/wordmark.svg`
  - `brand/app-icon.svg`
  - `public/favicon.svg`: schaltet per `prefers-color-scheme` um
  - `src/assets/logo-mark.svg`: Kopie von `brand/logo-mark.svg`

---

## 4. Farbe

### 4.1 Rollen und Regeln

- **Flächen:** `--bg` (App-Grund, Seitenleiste, Kopfleiste) · `--surface` (Tabellen, Panels, Felder, Karten) · `--surface-2` (Hover, Tabellenkopf, neutrale Chips, Vorschau-Bühne) · `--surface-3` (Auswahl, gedrückt).
- **Schwebende Ebenen** (Menü, Popover, Dialog, Drawer, Meldung): `--surface-pop`, Hover darin `--surface-pop-hover`. Hell ist das Weiß, dunkel eine Stufe heller als die Fläche.
- **Linien:** `--line` für Trenner und Kartenränder (dekorativ, 1,2–1,4 : 1). `--line-strong` für die Ränder von Bedienelementen (≥ 3 : 1): Feld, Kontrollkästchen, Sekundärknopf, Schalter aus.
- **Text:** `--fg` (Titel, Werte, Tabelleninhalt) · `--fg-2` (Fließtext) · `--fg-3` (Spaltenköpfe, Navigation, Untertitel) · `--fg-4` (Metatext, Platzhalter, Zeitstempel). Kein helleres Grau als `--fg-4` für Text.
- **Akzent:** `--ink` = `--fg`. Primärknopf (`--ink` + `--on-ink`), Links (unterstrichen), Auswahlbalken, Fokusring, Diagramm-Hervorhebung.
- **Signale:** je Signal drei Tokens. `--seal` (Symbol, Punkt, Rand, Fläche ≥ 3 : 1), `--seal-text` (Schrift ≥ 4,5 : 1) und `--seal-soft` (zarte Fläche für Chips und Hinweise). Ebenso `--amber*` und `--green*`. Auf vollflächigem Rot und Grün steht `--on-seal` bzw. `--on-green`.
- **Bedienelemente nie auf `--surface-3`.** `--line-strong` erreicht dort nur 2,93 : 1 (hell) bzw. 2,75 : 1 (dunkel). Fläche 3 ist nur für Zustände da, nicht als Untergrund für Felder.
- **Alle Werte sind deckend (Hex).** Transparenz gibt es nur für Abdunkler und Schatten.
- **Ausnahme Daten:** Kanzlei- und Personenfarben aus den Daten dürfen als 8-px-Punkt neben einem Namen erscheinen (z. B. im Kalender), nie als Fläche hinter Text.

### 4.2 Token-Tabelle

Bestehende Namen bleiben (Komponenten müssen nicht umbenannt werden), die Werte werden ersetzt. **Neu** markierte Tokens kommen hinzu. Die Kontraste sind nach WCAG 2.x berechnet und auf zwei Stellen abgerundet.

| Token | Rolle | Hell | Kontrast hell | Dunkel | Kontrast dunkel |
|---|---|---|---|---|---|
| `--bg` | App-Grund | `#FAFAF9` | – | `#111110` | – |
| `--surface` | Fläche | `#FFFFFF` | – | `#181816` | – |
| `--surface-2` | Fläche 2: Hover, Kopf | `#F3F3F1` | 1,11 zur Fläche | `#21201E` | 1,09 zur Fläche |
| `--surface-3` **neu** | Fläche 3: Auswahl, gedrückt | `#EBEAE7` | 1,20 zur Fläche | `#2A2926` | 1,22 zur Fläche |
| `--surface-pop` **neu** | schwebende Ebenen | `#FFFFFF` | – | `#21201E` | – |
| `--surface-pop-hover` **neu** | Hover in schwebenden Ebenen | `#F3F3F1` | – | `#2A2926` | – |
| `--line` | Trenner, Kartenrand | `#E6E5E2` | 1,26 Fläche · 1,21 Grund | `#2D2C29` | 1,27 Fläche · 1,35 Grund |
| `--line-strong` | Rand Bedienelemente | `#8C8882` | 3,52 Fläche · 3,37 Grund · 3,17 Fl. 2 | `#6F6B65` | 3,36 Fläche · 3,57 Grund · 3,08 Fl. 2 |
| `--fg` | Text 1 | `#1A1917` | 17,57 Fl. · 16,82 Grund · 14,60 Fl. 3 | `#F4F3F1` | 16,03 Fl. · 17,04 Grund · 13,12 Fl. 3 |
| `--fg-2` | Text 2 | `#3F3D39` | 10,84 · 10,38 · 9,01 | `#D3D1CC` | 11,65 · 12,38 · 9,53 |
| `--fg-3` | Text 3 | `#55524D` | 7,78 · 7,45 · 6,46 | `#B0ADA7` | 7,94 · 8,44 · 6,50 |
| `--fg-4` | Text 4 | `#68645E` | 5,88 · 5,63 · **4,89** | `#9A968F` | 6,04 · 6,42 · **4,94** |
| `--ink` | Akzent = Text 1 | `#1A1917` | wie `--fg` | `#F4F3F1` | wie `--fg` |
| `--ink-hover` **neu** | Primärknopf Hover/Druck | `#3A3834` | 11,70 mit `--on-ink` | `#D9D7D2` | 12,21 mit `--on-ink` |
| `--on-ink` | Schrift auf Akzent | `#FFFFFF` | 17,57 auf `--ink` | `#1A1917` | 15,84 auf `--ink` |
| `--ink-fill` | Fläche Primärknopf | = `--ink` | | = `--ink` | |
| `--ink-fill-top` | (früher Verlaufskante) | = `--ink` | | = `--ink` | |
| `--ink-bright` | (früher helles Blau) | = `--ink-hover` | | = `--ink-hover` | |
| `--ink-deep` | (früher tiefes Blau) | = `--ink` | | = `--ink` | |
| `--ink-soft` | Auswahl-Fläche (früher Blau 10 %) | = `--surface-3` | | = `--surface-3` | |
| `--ink-softer` | Hover-Fläche (früher Blau 6 %) | = `--surface-2` | | = `--surface-2` | |
| `--focus` | Fokusring, 2 px + 2 px Abstand | `#1A1917` | 17,57 Fl. · 16,82 Grund · 15,81 Fl. 2 | `#F4F3F1` | 16,03 · 17,04 · 14,68 |
| `--selection` **neu** | Textauswahl, Suchtreffer | `#E0DED9` | `--fg` darauf 13,07 | `#3A3834` | `--fg` darauf 10,55 |
| `--seal` | Siegelrot: Symbol, Punkt, Fläche | `#C8302B` | 5,37 Fl. · 5,14 Grund · 4,75 Rot-Fl. | `#F06A60` | 5,87 · 6,24 · 5,59 |
| `--seal-text` | Schrift kritisch | `#AE2621` | 6,00 Rot-Fl. · 6,78 Fl. · 6,10 Fl. 2 | `#FF8E85` | 7,63 · 8,01 · 7,33 |
| `--seal-soft` | Fläche kritisch | `#FCEEEC` | `--fg` darauf 15,54 | `#2C1715` | `--fg` darauf 15,27 |
| `--on-seal` **neu** | Schrift auf vollem Rot | `#FFFFFF` | 5,37 auf `--seal` · 6,78 auf Hover | `#111110` | 6,24 · 8,51 |
| `--amber` | Bernstein: Symbol | `#B06A00` | 4,28 Fl. · 4,10 Grund · 3,85 Bernstein-Fl. | `#E0A43A` | 8,08 · 8,58 · 7,20 |
| `--amber-text` | Schrift Warnung | `#875000` | 5,95 Bernstein-Fl. · 6,61 Fl. | `#F2BC5E` | 9,16 · 10,27 |
| `--amber-soft` | Fläche Warnung | `#FBF2E2` | `--fg` darauf 15,81 | `#2A2112` | 14,30 |
| `--green` | Grün: Symbol | `#1F8048` | 4,95 Fl. · 4,74 Grund · 4,44 Grün-Fl. | `#4DBE7C` | 7,60 · 8,07 · 6,87 |
| `--green-text` | Schrift Erfolg | `#196B3C` | 5,87 Grün-Fl. · 6,54 Fl. | `#6FD497` | 8,83 · 9,77 |
| `--green-soft` | Fläche Erfolg | `#EBF5EE` | `--fg` darauf 15,75 | `#132519` | 14,50 |
| `--on-green` | Schrift auf vollem Grün | `#FFFFFF` | 4,95 | `#111110` | 8,07 |
| `--violet` | (KI, entfällt) | = `--fg-2` | | = `--fg-2` | |
| `--violet-soft` | (KI-Fläche, entfällt) | = `--surface-2` | | = `--surface-2` | |
| `--ai-1` … `--ai-4` | (KI-Verlauf, entfällt) | = `--fg-3` | Verläufe werden einfarbig und lesbar | = `--fg-3` | |
| `--chart-1` **neu** | Diagramm: Hervorhebung | = `--ink` | 4,99 gegen `--chart-2` | = `--ink` | 4,77 |
| `--chart-2` **neu** | Diagramm: übrige Werte | = `--line-strong` | 3,52 Fläche | = `--line-strong` | 3,36 Fläche |
| `--chart-grid` **neu** | Gitterlinien | = `--line` | | = `--line` | |
| `--scrim` | Abdunkler hinter Dialogen | `rgb(17 17 16 / 0.32)` | | `rgb(0 0 0 / 0.6)` | |
| `--shadow-pop` **neu** | Menü, Popover, Meldung | `0 8px 24px -12px rgb(0 0 0 / 0.16)` | | `0 0 0 0 transparent` | |
| `--shadow-modal` **neu** | Dialog, Drawer | `0 24px 48px -16px rgb(0 0 0 / 0.20)` | | `0 0 0 0 transparent` | |

**Glas-Tokens auf ruhige Werte abgebildet:** Code, der sie noch liest, bricht nicht und sieht sofort ruhig aus.

| Token | neuer Wert (hell und dunkel) | Wirkung |
|---|---|---|
| `--bg-deep` | `var(--bg)` | Aura-Verlauf wird einfarbig |
| `--glass`, `--glass-strong`, `--glass-thin` | `var(--surface)` | deckend |
| `--glass-rim-1`, `--glass-rim-2`, `--glass-rim-3`, `--glass-sheen`, `--glass-shade`, `--glow-light` | `transparent` | Lichtkanten, Glanz und Reflex unsichtbar |
| `--glass-shadow` | `0 0 0 0 transparent` | **kein** `none`: Die Variable steht in Komma-Listen mit Innenschatten, und `none` würde die ganze Angabe ungültig machen. |
| `--glass-shadow-lg` | `var(--shadow-pop)` | schwebende Ebenen behalten im Hellen einen leisen Schatten |
| `--aura-1` … `--aura-4` | `transparent` | Farbkugeln unsichtbar |
| `--spring` | `cubic-bezier(0.2, 0, 0, 1)` | kein Überschwingen mehr, auch wo der Name noch steht |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | |

### 4.3 CSS-Block zum Übernehmen

Ersetzt den Block „Farb- & Material-Tokens“ in `src/styles/index.css` (die Selektoren für Dunkel bleiben wie heute: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` **und** `:root[data-theme="dark"] {…}`).

```css
:root {
  --bg: #fafaf9;  --surface: #ffffff;  --surface-2: #f3f3f1;  --surface-3: #ebeae7;
  --surface-pop: #ffffff;  --surface-pop-hover: #f3f3f1;
  --line: #e6e5e2;  --line-strong: #8c8882;
  --fg: #1a1917;  --fg-2: #3f3d39;  --fg-3: #55524d;  --fg-4: #68645e;
  --ink: #1a1917;  --ink-hover: #3a3834;  --on-ink: #ffffff;
  --focus: #1a1917;  --selection: #e0ded9;
  --seal: #c8302b;  --seal-text: #ae2621;  --seal-soft: #fceeec;  --on-seal: #ffffff;
  --amber: #b06a00;  --amber-text: #875000;  --amber-soft: #fbf2e2;
  --green: #1f8048;  --green-text: #196b3c;  --green-soft: #ebf5ee;  --on-green: #ffffff;
  --scrim: rgb(17 17 16 / 0.32);
  --shadow-pop: 0 8px 24px -12px rgb(0 0 0 / 0.16);
  --shadow-modal: 0 24px 48px -16px rgb(0 0 0 / 0.2);

  /* Ableitungen – gleich in Hell und Dunkel, darum nur hier */
  --bg-deep: var(--bg);
  --ink-fill: var(--ink);  --ink-fill-top: var(--ink);  --ink-bright: var(--ink-hover);  --ink-deep: var(--ink);
  --ink-soft: var(--surface-3);  --ink-softer: var(--surface-2);
  --violet: var(--fg-2);  --violet-soft: var(--surface-2);
  --ai-1: var(--fg-3);  --ai-2: var(--fg-3);  --ai-3: var(--fg-3);  --ai-4: var(--fg-3);
  --chart-1: var(--ink);  --chart-2: var(--line-strong);  --chart-grid: var(--line);
  --glass: var(--surface);  --glass-strong: var(--surface);  --glass-thin: var(--surface);
  --glass-rim-1: transparent;  --glass-rim-2: transparent;  --glass-rim-3: transparent;
  --glass-sheen: transparent;  --glass-shade: transparent;  --glow-light: transparent;
  --glass-shadow: 0 0 0 0 transparent;  --glass-shadow-lg: var(--shadow-pop);
  --aura-1: transparent;  --aura-2: transparent;  --aura-3: transparent;  --aura-4: transparent;

  --radius-sm: 4px;  --radius-md: 6px;  --radius-lg: 8px;  --radius-xl: 12px;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);  --spring: var(--ease-out);
  --dur-1: 100ms;  --dur-2: 160ms;  --dur-3: 220ms;
  color-scheme: light;
}
/* Dunkel – identisch auch in @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } } eintragen */
:root[data-theme="dark"] {
  --bg: #111110;  --surface: #181816;  --surface-2: #21201e;  --surface-3: #2a2926;
  --surface-pop: #21201e;  --surface-pop-hover: #2a2926;
  --line: #2d2c29;  --line-strong: #6f6b65;
  --fg: #f4f3f1;  --fg-2: #d3d1cc;  --fg-3: #b0ada7;  --fg-4: #9a968f;
  --ink: #f4f3f1;  --ink-hover: #d9d7d2;  --on-ink: #1a1917;
  --focus: #f4f3f1;  --selection: #3a3834;
  --seal: #f06a60;  --seal-text: #ff8e85;  --seal-soft: #2c1715;  --on-seal: #111110;
  --amber: #e0a43a;  --amber-text: #f2bc5e;  --amber-soft: #2a2112;
  --green: #4dbe7c;  --green-text: #6fd497;  --green-soft: #132519;  --on-green: #111110;
  --scrim: rgb(0 0 0 / 0.6);
  --shadow-pop: 0 0 0 0 transparent;  --shadow-modal: 0 0 0 0 transparent;
  color-scheme: dark;
}
```

**Achtung, Kaskade:** Die Ableitungen (`--ink-soft: var(--surface-3)` usw.) stehen nur in `:root`. Custom Properties lösen `var()` am Element auf, an dem sie definiert sind. Weil `:root` hell und dunkel dasselbe Element ist, greifen die dunklen Werte automatisch. **In `@theme inline` ergänzen:** `--color-surface-3`, `--color-surface-pop`, `--color-ink-hover`, `--color-on-seal`, `--color-seal-text`, `--color-amber-text`, `--color-green-text`, `--shadow-pop`, `--shadow-modal`.

**Folgeregeln in `index.css`:**

- Den Block „Gefüllte Ink-Flächen … `.bg-ink` → `--ink-fill`“ ersatzlos streichen: `--ink-fill` ist jetzt `--ink`, und `--on-ink` passt in beiden Modi.
- `::selection { background: var(--selection); color: var(--fg); }`

### 4.4 Prüfprotokoll Kontrast

Gerechnet mit der WCAG-2-Formel (Rechenweg: `RECHERCHE.md`, Anhang A).

| Paargruppe | Mindestwert | Paare je Modus | Ergebnis |
|---|---|---|---|
| Text 1–4 auf Grund, Fläche, Fläche 2, Fläche 3 | 4,5 : 1 | 16 | bestanden; kleinster Wert `--fg-4` auf Fläche 3: 4,89 (hell) / 4,94 (dunkel) |
| Akzent als Text/Link auf allen vier Flächen | 4,5 : 1 | 4 | bestanden (≥ 13,12) |
| `--on-ink` auf `--ink` und `--ink-hover` | 4,5 : 1 | 2 | bestanden (≥ 11,70) |
| Fokusring auf Grund, Fläche, Fläche 2 | 3 : 1 | 3 | bestanden (≥ 14,68) |
| `--line-strong` auf Grund, Fläche, Fläche 2 | 3 : 1 | 3 | bestanden (≥ 3,08) |
| Signaltext auf Signalfläche, Fläche, Grund (×3) | 4,5 : 1 | 9 | bestanden (≥ 5,87) |
| Signal (Symbol) auf Fläche, Grund, Signalfläche (×3) | 3 : 1 | 9 | bestanden (≥ 3,85) |
| `--fg` auf allen Signalflächen | 4,5 : 1 | 3 | bestanden (≥ 14,30) |
| `--on-seal` auf `--seal` und Hover, `--on-green` auf `--green` | 4,5 : 1 | 3 | bestanden (≥ 4,95) |
| Rot auf Fläche 2 (Symbol 3 : 1, Text 4,5 : 1) | – | 2 | bestanden |
| **Summe** | | **54** | **0 Verstöße in Hell, 0 in Dunkel** |

**Zusatzpaare, ebenfalls bestanden:**

- `--fg-4` und `--seal-text` auf `--surface-pop` und `--surface-pop-hover`: ≥ 4,94
- `--line-strong` auf `--surface-pop`: 3,52 / 3,08
- `--fg` und `--fg-3` auf `--selection`: ≥ 5,23
- Tooltip `--bg` auf `--fg`: 16,82 / 17,04
- Schalter: Daumen gegen Spur „aus“ 3,52 / 3,36
- Diagramm: `--chart-1` gegen `--chart-2` 4,99 / 4,77, `--chart-2` auf Fläche 3,52 / 3,36
- `kbd`: `--fg-3` auf Fläche 2, 7,00 / 7,27

**Bewusst unter 3 : 1 (nur Information, keine Pflicht):**

- `--line` (1,21–1,35): Trenner sind keine Bedienelemente.
- `--surface-2`/`-3` gegen Fläche (1,09–1,22): Auswahl wird nie nur über die Fläche gezeigt.
- `--line-strong` auf Fläche 3 (2,93 / 2,75): darum keine Bedienelemente auf Fläche 3.

**Farbfehlsicht:** Rot, Bernstein und Grün unterscheiden sich bei Deuteranopie kaum in der Helligkeit (1,05–1,38 : 1). Deshalb trägt jeder Status Wort **und** formcodiertes Symbol:

- Notfrist/kritisch: `TriangleAlert`
- bald fällig: `Clock`
- erledigt: `Check`
- Fehler: `CircleAlert`

---

## 5. Typografie

**Familien:** `--font-ui: "Geist", ui-sans-serif, system-ui, …` und `--font-mono: "Geist Mono", ui-monospace, …`. Die Dateien liegen in `src/assets/fonts` (latin, latin-ext, mono). Es gibt keine neue Schrift und keinen externen Abruf.

**Regeln:**

- **Gewichte:** nur **400** (Text), **500** (Labels, Knöpfe, Chips, Navigation) und **600** (Titel, Werte, aktive Auswahl).
  - Heutige Zwischenwerte umstellen: `font-[560]` → 500; `font-[620]`, `650`, `font-semibold` → 600; `font-bold`, 700 und mehr → 600.
- **Keine Versalien-Zeilen.** `.eyebrow` wird 12/16, 500, `--fg-3`, Laufweite 0, ohne `text-transform`. Der Inhalt bleibt („Sonntag, 18. Oktober 2026“ statt „SONNTAG, 18. OKTOBER 2026“).
- **Laufweite:**
  - negativ nur ab 18 px;
  - die globale Regel `h1–h4 { letter-spacing: -0.02em }` wird auf `.title-*` beschränkt;
  - `font-feature-settings: "ss01", "cv11"` (stammt aus der Inter-Zeit, ohne Wirkung bei Geist) entfällt in `body` und `html body`.
- **Geist Mono** nur für **Kennungen**: Aktenzeichen, Gerichtsaktenzeichen, Rechnungs- und Lizenznummern, IBAN.
- **Beträge, Daten und Zahlen in Spalten:** Geist mit `.num` (`tabular-nums`), rechtsbündig.
- **Telefon:** Eingabefelder 16 px (verhindert den iOS-Zoom). Der übrige Text bleibt 14 px.
- **Höchstens vier Schriftgrößen je Ansicht.**

**Skala Produktoberfläche:**

| Stufe | Klasse | Größe / Zeile | Gewicht | Laufweite | Farbe | Einsatz |
|---|---|---|---|---|---|---|
| Seitentitel | `.title-xl` | 24/32 (Telefon 22/28) | 600 | −0,02 em | `--fg` | `PageHeader` |
| Abschnitt | `.title-lg` | 18/26 | 600 | −0,01 em | `--fg` | Karten-, Dialog-, Paneltitel |
| Untertitel | `.title-md` | 15/22 | 600 | −0,005 em | `--fg` | Gruppen, Listenköpfe |
| Kennzahl | `Stat` | 28/32 | 600 | −0,02 em | `--fg` | Zahlen, `tabular-nums` |
| Kennzahl groß | – | 40/44 | 600 | −0,03 em | `--fg` | eine Leitzahl je Seite (38h-Motor) |
| Text | `body` | 14/20 | 400 | 0 | `--fg-2` / `--fg` | Oberfläche, Tabellen |
| Text betont | – | 14/20 | 500 | 0 | `--fg` | Knöpfe, Labels, Zeilentitel |
| Klein | – | 13/18 | 400 | 0 | `--fg-3` / `--fg-4` | Metatext, Hilfetexte |
| Mini | `.eyebrow`, Chip, Spaltenkopf | 12/16 | 500 | 0 | `--fg-3` | Untergrenze 12 px |
| Lesetext | `.prose-apex` | 15/24 (Wiki, KI-Antworten), Schriftsatz 16/26 | 400 | 0 | `--fg-2` | höchstens 68 Zeichen breit |
| Kennung | `.mono` | 13/20 | 400 | 0 | `--fg` | Aktenzeichen |
| Tastenhinweis | `.kbd` | 12/16 Mono | 400 | 0 | `--fg-3` | |

**`.prose-apex`:**

- Überschriften: h1 18/26, h2 15/22, h3 14/20, alle 600 in `--fg`.
- `strong`: 600 in `--fg`.
- `blockquote`: 2 px Linie links in `--line-strong`, Text `--fg-3`.
- `code`: Mono auf `--surface-2`, Radius 4.

---

## 6. Raster und Abstände

- **Basis 4 px.** Erlaubte Stufen: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128. In Tailwind sind das `1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24 · 32`. Freie Werte wie 13, 18 oder 22 px entfallen.
- **In Gruppen** (Label → Feld, Titel → Untertitel, Symbol → Text): 4–8 px.
- **Zwischen Elementen einer Gruppe:** 12–16 px.
- **Zwischen Gruppen und Abschnitten:** 24–32 px.
- **Innenabstand:**
  - Karte 16 px (dicht) bzw. 20 px (Standard)
  - Dialog 24 px
  - Inhaltsbereich 32 px (≥ 1024 px), 24 px (640–1023 px), 16 px (< 640 px)
- **Bedienhöhen:**

  | Element | Desktop | Telefon (< 640 px) |
  |---|---|---|
  | Knopf sm / md / lg | 28 / 32 / 40 px | **44 px** (alle Größen; `sm` darf sichtbar 36 px bleiben, wenn ein Polster die Trefferfläche auf 44 × 44 px bringt) |
  | Feld, Select | 32 px | 44 px, Schrift 16 px |
  | Symbolknopf | 32 × 32 px | 44 × 44 px (unter 360 px Breite 40 px wie heute) |
  | Tabellenzeile | 44 px, kompakt 36 px | Kartenliste |
  | Menüeintrag | 32 px | 44 px |
  | Kleinste Trefferfläche | 24 × 24 px | 44 × 44 px |

---

## 7. Radien

| Token | Wert | Elemente |
|---|---|---|
| `--radius-sm` | **4 px** | Chips, Kontrollkästchen, `kbd`, Menüeinträge, Tooltips, Papier |
| `--radius-md` | **6 px** | Knöpfe, Felder, Segmente, Hinweisbanner |
| `--radius-lg` | **8 px** | Karten, Tabellen, Menüs, Popover, Meldungen, Apex Island |
| `--radius-xl` | **12 px** | Dialoge, Drawer am Telefon (oben), Produktbilder auf der Startseite |
| rund | 9999 px | **nur** Avatare, Schalter, Status-Punkte, Fortschrittsbalken, Apex-Assistent-Knopf |

**Abbildung der festen Werte im Code** (`rounded-[…]`, rund 700 Stellen; per Suchen und Ersetzen):

| heute | neu | Tailwind |
|---|---|---|
| 6–9 px | 4 px | `rounded-sm` |
| 10–12 px | 6 px | `rounded-md` |
| 14–22 px | 8 px | `rounded-lg` |
| 24–28 px | 12 px | `rounded-xl` |
| `rounded-full` an Knopf, Chip, Segment, Island, Badge | 6 bzw. 4 px | `rounded-md` / `rounded-sm` |

Verschachtelt gilt: Radius innen = Radius außen − Innenabstand, mindestens 4 px.

---

## 8. Linien und Flächen

- **1 px `--line`:** Trenner, Tabellenlinien, Kartenränder, Seitenleiste rechts, Kopfleiste unten.
- **1 px `--line-strong`:** Ränder von Feldern, Kontrollkästchen, Sekundärknöpfen, Schalter „aus“, Outline-Chips.
- **Keine Doppelungen:** Eine Karte hat Rand **oder** Hintergrundkontrast, nicht beides plus Schatten. Tabellen haben nur waagerechte Linien, kein Gitter, kein Zebra.
- **Hervorhebung einer Zeile oder eines Abschnitts:** 2 px Balken links (`inset 2px 0 0 var(--ink)`) und Gewicht, keine Fläche in Farbe. Ausnahme kritische Fristen: Balken in `--seal`.
- **Farbige Randstreifen** gibt es nur für kritische Fristen (2 px `--seal`). Wiedervorlagen, Vorfristen und Termine haben keinen Streifen, ihr Typ steht im Chip.
- **Abdunkler hinter Dialogen:** einfarbig `--scrim`, ohne Unschärfe.

---

## 9. Schatten

| Token | Hell | Dunkel | Einsatz |
|---|---|---|---|
| `--shadow-pop` | `0 8px 24px -12px rgb(0 0 0 / .16)` | keiner | Menü, Popover, Tooltip, Meldung, Assistent-Knopf |
| `--shadow-modal` | `0 24px 48px -16px rgb(0 0 0 / .20)` | keiner | Dialog, Drawer, Assistent-Panel |

**Sonst nichts:** keine Karten-, Knopf-, Innen- oder farbigen Schatten. Im Dunkeln heben sich schwebende Ebenen über `--surface-pop` (heller) und 1 px `--line` ab.

---

## 10. Bewegung

| Fall | Dauer | Eigenschaft | Kurve |
|---|---|---|---|
| Hover, Drücken, Farbe | `--dur-1` 100 ms | `color`, `background-color`, `border-color` | `--ease-out` |
| Menü, Popover, Tooltip | `--dur-2` 160 ms ein / 100 ms aus | Opazität + 4 px Versatz | `--ease-out` |
| Dialog | `--dur-3` 220 ms ein / 150 ms aus | Opazität + 8 px nach oben, kein Skalieren | `--ease-out` |
| Drawer | 220 ms ein / 160 ms aus | Gleiten von rechts (am Telefon von unten) | `--ease-out` |
| Meldung | 180 ms ein / 120 ms aus | Opazität + 8 px | `--ease-out` |
| Auswahl-Indikator (`layoutId`) | 150 ms | Position | Tween, kein Feder-Spring |
| Seitenwechsel | 0 oder 120 ms | Überblenden | linear |
| Fortschritt, Zahlen | sofort | – | Zahlen springen auf den Wert (`hochzaehlen` nur auf der Startseite und dort ≤ 600 ms) |

**`motion/react`:** Ein gemeinsamer Satz ersetzt alle Federn (`type: "spring"`, `stiffness …`):

```ts
const BEWEGUNG = {
  schnell: { duration: 0.1, ease: [0.2, 0, 0, 1] },
  standard: { duration: 0.16, ease: [0.2, 0, 0, 1] },
  dialog: { duration: 0.22, ease: [0.2, 0, 0, 1] },
};
```

Ablegen in `src/lib/bewegung.ts`. Listen werden nicht mehr gestaffelt (`delay: i * 0.03` entfällt).

**`prefers-reduced-motion` und „Bewegung reduzieren“:** nur Überblenden bis 120 ms oder gar nichts, kein Versatz. Die globale CSS-Regel und `useBewegungReduziert()` bleiben.

**Entfällt:**

- `scale(0.96)` und `translateY(-1px)` an Knöpfen
- Puls des Verbindungspunkts
- Schimmer (`.shimmer`)
- Atmen und Kreisen des Orbs
- Pulsieren des Lade-Icons
- `aura-drift`, `ai-spin`, `ai-shimmer`
- der Mauszeiger-Reflex

---

## 11. Iconografie

- **lucide-react**, einheitlich **Strich 1,5**:
  - global: `svg.lucide { stroke-width: 1.5; }`
  - Ausnahme Status-Symbole in Chips (12 px): Strich 2, damit sie nicht zerfallen.
- **Größen:**
  - 16 px in Knöpfen, Tabellen, Menüs, Navigation und Feldern
  - 20 px im Leerzustand und in der mobilen Tab-Leiste
  - 12 px in Chips
  - Die heutigen 18 px in der Navigation werden 16 px.
- **Farbe:**
  - erbt die Textfarbe; Navigation und Metazeilen `--fg-4`, in Knöpfen die Knopfschrift;
  - Signalfarben nur für Status-Symbole (`TriangleAlert` in `--seal`, `Clock` in `--amber`, `Check` in `--green`);
  - nie gefüllt (`fill`), nie auf farbiger Kachel.
- **Sparsam:** Icons nur, wo sie das Erkennen beschleunigen. Ein Icon vor jedem Menüpunkt ist erlaubt, wenn alle Einträge eines haben. Gruppenüberschriften bekommen kein Icon.
- **Feste Zuordnung (beibehalten bzw. vereinheitlichen):**

  | Bedeutung | Icon |
  |---|---|
  | KI | `Sparkles` |
  | Notfrist / kritisch | `TriangleAlert` |
  | bald fällig | `Clock` |
  | erledigt | `Check` |
  | Fehler | `CircleAlert` |
  | Info | `Info` |
  | 38h-Motor | `Zap` (nur Strich, nie gelb gefüllt) |
  | Hilfe | `CircleHelp` |
  | Mehr | `Ellipsis` |

---

## 12. Rezepte

Jedes Rezept beschreibt Aufbau, Maße, Tokens und Zustände. Wo eine CSS-Klasse genannt ist, wird sie in `index.css` so umgeschrieben. Der Komponenten-Code ändert sich nur, wo er feste Klassen wie Icon-Kacheln setzt.

### 12.1 Button (`.btn`, `Button`, `IconButton`)

**Grundform:** `inline-flex`, Abstand Symbol–Text 8 px (sm 6 px), Radius `--radius-md` (6 px), Schrift 14/20 500, Laufweite 0, kein Schatten, kein Verlauf. Übergang nur Farbe (`--dur-1`).

| Größe | Höhe | Seitenpolster | Schrift | Symbol |
|---|---|---|---|---|
| `sm` | 28 px | 10 px | 13 px | 14 px |
| `md` (Standard) | 32 px | 12 px | 14 px | 16 px |
| `lg` | 40 px | 16 px | 15 px | 16 px |
| Telefon (< 640 px) | min. 44 px | wie oben | wie oben | wie oben |

| Variante | Ruhe | Hover | Gedrückt | Einsatz |
|---|---|---|---|---|
| `primary` | Fläche `--ink`, Schrift `--on-ink` | `--ink-hover` | `--ink-hover` | **höchstens einer je Bereich**: die Hauptaktion der Seite oder des Dialogs |
| `secondary` | Fläche `--surface`, Rand `inset 0 0 0 1px var(--line-strong)`, Schrift `--fg` | Fläche `--surface-2` | Fläche `--surface-3` | Standard für alle übrigen Aktionen |
| `ghost` | transparent, Schrift `--fg-2` | Fläche `--surface-2`, Schrift `--fg` | `--surface-3` | Werkzeugleisten, „Abbrechen“, Aktionen in Zeilen |
| `danger` | Fläche `--seal`, Schrift `--on-seal` | Fläche `--seal-text` | wie Hover | **nur** zur Bestätigung in `confirmDialog` mit `gefahr` |
| `danger` außerhalb von Dialogen | wie `secondary`, Schrift `--seal-text`, Symbol `--seal` | Fläche `--seal-soft` | | „Löschen“ in Menüs und Formularen |
| `ai` | **identisch mit `secondary`**, Symbol `Sparkles` ist Pflicht | wie secondary | | echte KI-Funktionen; ist die KI-Aktion die Hauptaktion, wird `primary` mit `Sparkles` verwendet |

**Gesperrt:** wie heute neutral, also transparent, Rand `--line-strong`, Schrift `--fg-3`, `cursor: not-allowed`, keine Opazitätsänderung bei `primary`. Sekundär und ghost: Schrift `--fg-4`.

**Laden:** `Loader2` 16 px dreht (bei reduzierter Bewegung steht es); die Breite bleibt.

**Tastenhinweis im Knopf:**

- `.kbd` transparent mit 1 px Rand;
- in `primary` Rand `color-mix(in oklab, var(--on-ink) 45%, transparent)`, Schrift erbt.

**`IconButton`:** 32 × 32 px, Radius 6, ghost-Farben, `label` bleibt Pflicht (`aria-label` + `title`). Am Telefon 44 × 44 px.

### 12.2 Feld, Select, Textarea, Suchfeld, Kontrollkästchen, Schalter

**Feld (`.field`):**

- Höhe 32 px (Telefon 44 px, Schrift 16 px), Polster 10 px, Radius 6.
- Fläche `--surface`, Rand 1 px `--line-strong`, Schrift `--fg`, Platzhalter `--fg-4`.
- Hover: Rand `--fg-3`.
- Fokus: Rand `--fg` + `box-shadow: inset 0 0 0 1px var(--fg)`, zusammen 2 px. Kein Farbhof (`--ink-soft`-Ring entfällt).
- Fehler: Rand `--seal` + innere Linie `--seal`, Meldung darunter 13 px `--seal-text` mit `CircleAlert` 14 px.
- Gesperrt: Fläche `--surface-2`, Schrift `--fg-3`, Rand `--line`.

**Label:** über dem Feld, 13/18 500 `--fg-2`, 6 px Abstand. Pflicht mit „(Pflicht)“ in `--fg-4` statt Sternchen.

**Hinweis:** unter dem Feld 13/18 `--fg-4`. Pflichtmeldungen erst nach dem ersten Speicherversuch (unverändert).

**Select:**

- wie Feld;
- Pfeil `ChevronDown` 16 px in `--fg-3` (das Daten-SVG im CSS bekommt `stroke='%2355524D'`, im Dunkeln `%23B0ADA7`);
- lange Optionen enden mit „…“.

**Textarea:** wie Feld, Polster 8/10 px, Zeile 1,5, `resize: vertical`.

**Suchfeld (`SearchField`, Kopfleiste):**

- wie Feld, Symbol `Search` 16 px `--fg-4` links (Polster links 32 px), `kbd` „Strg K“ rechts.
- In der Kopfleiste 280–360 px breit.

**Kontrollkästchen:**

- 16 × 16 px, Radius 4, Rand 1 px `--line-strong`, Fläche `--surface`.
- Angehakt: Fläche `--ink`, Haken `--on-ink`.
- Unbestimmt: Strich `--on-ink`.
- Trefferfläche 24 px (Telefon 44 px) über Polster, wie heute in `DataTable`.

**Radio:** wie Kontrollkästchen, rund, gewählt: Ring `--ink` 5 px.

**Schalter (`Switch`):**

- 36 × 20 px, rund.
- Aus: Spur `--line-strong`, Daumen `--surface` (3,52 : 1).
- An: Spur `--ink`, Daumen `--on-ink`.
- Daumen 16 px, Übergang 120 ms ohne Feder.
- Trefferfläche am Telefon 44 px.
- Beschriftung rechts 14 px `--fg`, Hinweis per `describedBy` (unverändert).

### 12.3 Karte und Fläche (statt Glas)

**`Card` / `.sheet`:**

- `background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg)` (8 px); kein Schatten, keine Unschärfe.
- Innenabstand 20 px (`padded`), dicht 16 px.

**`Card interactive`:**

- Hover: Rand `--line-strong` und Fläche bleibt; kein Anheben, kein Schatten.
- Fokus: Ring 2 px mit 2 px Abstand.
- Die ganze Karte ist ein Link oder Knopf.

**`CardHeader`:**

- Titel `.title-md` (15/22 600), Untertitel 13/18 `--fg-3`, Aktion rechts als ghost-Knopf `sm` oder Textlink mit `ChevronRight`.
- **Symbol ohne Kachel:** 16 px `--fg-4` vor dem Titel, oder ganz weglassen. Die heutige 32-px-Kachel `bg-ink-soft text-ink` entfällt.

**`Glass`:**

- Alle drei Töne (`regular`, `strong`, `thin`) werden zur Fläche: `--surface`, 1 px `--line`, Radius wie gesetzt (nach Abschnitt 7 abgebildet), kein `backdrop-filter`, kein `::before`.
- `glow` hat keine Wirkung mehr.

**Wann eine Karte?** Nur wenn Inhalte eine Einheit bilden, die über Abstand nicht klar wird: Liste, Tabelle, Formularblock, Panel. Seitenkopf, Kennzahlen-Überschriften, Hinweistexte und Aktionsleisten stehen frei auf `--bg`. **Keine Karte in einer Karte.** Innen gliedern Linien oder Abstand.

**Vorschau-Bühne** (Bereich, in dem Papier oder Produktbilder liegen): `--surface-2`, Radius 8, ohne Rand.

### 12.4 Tabelle (`.table`, `DataTable`)

- **Behälter:** Karte (Fläche, Linie, Radius 8, `overflow: hidden`). Auf reinen Listenseiten (Akten, Rechnungen) darf die Tabelle ohne Karte bündig auf `--bg` stehen, dann mit Linie oben und unten.
- **Kopf:**
  - 36 px, Schrift 12/16 500 `--fg-3`, normale Schreibung;
  - Fläche `--surface` deckend (kein `backdrop-filter`), `position: sticky`, Linie unten `--line`.
  - Sortiert: Kopf `--fg` + `ArrowUp`/`ArrowDown` 12 px. Sortierbar ohne aktive Sortierung: Pfeil erst bei Hover/Fokus.
- **Zeilen:**
  - 44 px (kompakt 36 px, Schalter in `DataTable` bleibt), Polster 12 px, waagerechte Linie `--line`;
  - Hover `--surface-2`;
  - **ausgewählt** `--surface-3` + `inset 2px 0 0 var(--ink)` + Kontrollkästchen angehakt.
- **Ausrichtung:**
  - Text links, Zahlen und Beträge rechts mit `.num`, Kopf wie Inhalt;
  - Aktenzeichen `.mono` 13 px;
  - gleiche Nachkommastellen.
- **Status in Zeilen:** Chip (12.6), kein farbiger Zeilenhintergrund. Kritische Frist: zusätzlich 2 px Balken `--seal` links.
- **Werkzeugleiste darüber:**
  - Suchfeld, Filter als sekundäre `sm`-Knöpfe;
  - aktive Filter als Outline-Chips mit `X`;
  - rechts Dichte und Spaltenwahl als `IconButton`.
- **Sammelaktionen:** Leiste über der Tabelle, Fläche `--surface-2`, Radius 8, „3 ausgewählt“ 14/500, Aktionen als sekundäre `sm`-Knöpfe, „Auswahl aufheben“ ghost.
- **Leer:** `Empty` in der Tabellenfläche (12.16).
- **Telefon (`mobileRow`):** keine Karten je Zeile, sondern eine Liste mit Linien. Je Eintrag Polster 12/16 px, Titel 14/500, Meta 13 `--fg-3`, Status-Chip rechts oben. Die ganze Zeile ist das Tippziel (≥ 44 px).

### 12.5 Tabs und Segmented

**Reiter für Unterseiten** (z. B. Akte: Übersicht, Dokumente, Fristen; Einstellungen):

- Textreiter 14/20 500 `--fg-3`, Höhe 40 px, Abstand 24 px;
- Linie `--line` unter der ganzen Reihe;
- aktiv: `--fg`, 600, 2 px Unterstrich `--ink` (gleitet per `layoutId` in 150 ms);
- Hover `--fg`.
- Am Telefon waagerecht scrollbar (`.fade-x` bleibt erlaubt).

**`Segmented`** (Umschalter innerhalb einer Ansicht: Liste/Woche/Monat, Ganze Kanzlei/Nur meine):

- Behälter `--surface-2`, Radius 6, Polster 2 px, Rand 1 px `--line`;
- Segmente 28 px (sm 24 px), Schrift 13/500 `--fg-3`;
- **aktiv:** Fläche `--surface`, Rand `inset 0 0 0 1px var(--line-strong)`, Schrift `--fg` 600. Der Indikator gleitet in 150 ms ohne Feder.
- Am Telefon (`mobilGross`) 44 px.
- Kein Glas-Indikator.

### 12.6 Chip und Badge

**Grundform `.chip`:** Höhe 22 px, Polster 0 7 px, Radius 4, Schrift 12/16 500, Abstand Symbol–Text 4 px, Symbol 12 px Strich 2. Kein `rounded-full`.

| Ton (`tone`) | Fläche | Schrift | Symbol | Einsatz |
|---|---|---|---|---|
| `neutral` (Standard) | `--surface-2` | `--fg-2` | – | Typ: Wiedervorlage, Vorfrist, Termin, Kategorien |
| `outline` | transparent, Rand 1 px `--line-strong` | `--fg-2` | optional | Filter, „Beispiel“, KI |
| `ink` | `--surface-3` | `--fg` | optional | hervorgehobene Info (z. B. „Neu“) |
| `seal` | `--seal-soft` | `--seal-text` | `TriangleAlert` `--seal` | Notfrist, kritisch, Fehler |
| **Notfrist dringend** | `--seal` | `--on-seal` | `TriangleAlert` | **nur** kritische Frist überfällig, heute oder morgen. Das ist das Lauteste auf dem Bildschirm. Neue Klasse `chip-seal-voll`. |
| `amber` | `--amber-soft` | `--amber-text` | `Clock` `--amber` | bald fällig (≤ 7 Tage), Warnung |
| `green` | `--green-soft` | `--green-text` | `Check` `--green` | erledigt, bezahlt, verbunden |
| `violet` (KI) | wie `outline` | `--fg-2` | `Sparkles` | KI-Kennzeichnung (`AiChip`) |

**Regeln:**

- Der Chip nennt den Zustand immer als Wort („Notfrist“, „in 5 Tagen“, „erledigt“).
- `dot` ist erlaubt, ersetzt aber das Symbol nicht bei Signalzuständen: Für Rot, Bernstein und Grün steht das formcodierte Symbol.
- Rot nur bei `istKritisch(f)` bzw. `fristArtZu(f)?.kritisch` (unverändert).

**Zähler-Badge** (Navigation, Tab-Leiste):

- in der Seitenleiste nur die Zahl 12/16 500 `--fg-4` rechtsbündig mit `.num`, ohne Fläche;
- in der mobilen Tab-Leiste eine Plakette 16 px, Radius 8, Fläche `--fg`, Schrift `--bg`;
- **kritisch** (z. B. Fristen mit kritischer Frist heute) in der Seitenleiste Schrift `--seal-text` 600, in der Tab-Leiste Fläche `--seal`, Schrift `--on-seal`.
- Benachrichtigungspunkt an der Glocke: 6 px `--seal` nur bei Kritischem, sonst `--fg`.

### 12.7 Modal, Drawer, `confirmDialog`

**Modal:**

- **Ebene:** `--scrim` ohne Unschärfe; Panel `--surface-pop`, Rand 1 px `--line`, Radius 12, `--shadow-modal`.
- **Breiten:** sm 400, md 560, lg 720, xl 880 px. Abstand zum Rand mindestens 16 px, Höhe höchstens 100 dvh − 32 px.
- **Kopf:** Polster 20/24 px, Titel `.title-lg` (18/26 600), Untertitel 14 `--fg-3`, Schließen-`IconButton` oben rechts (`X`).
- **Inhalt:** Polster 0 24 px. Scrollt er, trennt eine 1-px-Linie oben und unten, sonst keine Linien.
- **Fuß:** Polster 16/24/20 px, Aktionen rechts (Primär ganz rechts), Abstand 8 px. Am Telefon untereinander in voller Breite, Primär oben.
- **Telefon:** von unten, volle Breite, Radius 12 nur oben.

**Drawer** (Seitenpanel für Zeilendetails):

- rechts, 480 px (breit 640 px), volle Höhe, `--surface-pop`, Rand links 1 px `--line`, Radius 0, `--shadow-modal`;
- Kopf 56 px mit Titel und Schließen, bleibt beim Scrollen stehen;
- am Telefon volle Breite.

**`confirmDialog`:** Modal sm. Titel, ein bis zwei Sätze, „Abbrechen“ (sekundär, **Anfangsfokus**) und Bestätigen (`primary`, mit `gefahr` → `danger` vollflächig).

**Bewegung und Fokus:** Bewegung nach Abschnitt 10. Fokusfalle, `inert`, Esc und Rückkehr des Fokus bleiben unverändert (UI-Leitfaden 5.2).

### 12.8 Menü, Popover, Tooltip

**Menü (`Menu`) und Popover:**

- **Fläche:** `--surface-pop`, Rand 1 px `--line`, Radius 8, `--shadow-pop`, Polster 4 px, Breite mindestens 200 px.
- **Eintrag:**
  - 32 px (Telefon 44 px), Polster 0 8 px, Radius 4;
  - Schrift 14/20 400 `--fg-2`, Symbol 16 px `--fg-4`;
  - Hover und Tastaturfokus: `--surface-pop-hover` + Schrift `--fg`;
  - Tastenkürzel rechts als `.kbd`.
- **Gefährlich:** Schrift `--seal-text`, Symbol `--seal`.
- **Gliederung:** Trenner 1 px `--line` (Abstand 4 px). Gruppenlabel 12/16 500 `--fg-4`.
- **Gewählt** (Einfachauswahl): `Check` 16 px `--fg` rechts.
- **Bewegung:** 160 ms Opazität + 4 px.

**Tooltip:**

- Fläche `--fg`, Schrift `--bg` (invertiert, 16,8 : 1), 12/16 500, Radius 4, Polster 4/8 px, ohne Pfeil;
- Verzögerung 400 ms, bei Tastaturfokus sofort;
- nie der einzige Träger einer Information.

### 12.9 Meldung (Toast, `toast()`)

**Position und Ebene:**

- oben mittig wie heute; weicht Dialogen und der fokussierten Zeile aus (unverändert);
- Breite höchstens 420 px bzw. Bildschirm − 32 px;
- Fläche `--surface-pop`, Rand 1 px `--line`, Radius 8, `--shadow-pop`, Polster 12/14 px.

**Inhalt:**

- Symbol 16 px nach `ton`:

  | `ton` | Symbol |
  |---|---|
  | Erfolg | `CircleCheck` in `--green` |
  | Warnung | `TriangleAlert` in `--amber` |
  | Fehler | `CircleAlert` in `--seal` |
  | Info | `Info` in `--fg-3` |

- Titel 14/20 500 `--fg`, Text 13/18 `--fg-3`;
- `aktion` als ghost-Knopf `sm`; Schließen als `IconButton` 24 px (Telefon 44 px).

**Bewegung:** 180 ms Opazität + 8 px von oben, aus 120 ms. Der „Dynamic-Island“-Effekt (Kapsel, die wächst) entfällt.

**Sonstiges:** keine farbige Fläche, kein schwarzer Kasten im Hellen. `aria-live` bleibt.

### 12.10 Seitenleiste (`Sidebar`)

- **Fläche und Breite:** 232 px breit (eingeklappt 56 px), Fläche `--bg`, Linie rechts 1 px `--line`, volle Höhe, nicht schwebend, kein Glas, kein Radius.
- **Kopf (Höhe 56 px, bündig mit der Kopfleiste):**
  - Bildmarke 20 px `--fg` + „Apex“ 15/600, darunter Kanzleiname 12/16 `--fg-4`;
  - kein App-Icon-Quadrat;
  - Kanzlei-Wechsler (falls vorhanden) als ghost-Fläche über die ganze Zeile.
- **Gruppenlabel** („Intelligenz“, „Kanzlei“): 12/16 500 `--fg-4`, normale Schreibung, 24 px Abstand oben, 4 px unten. Inhalt unverändert.
- **Eintrag:**
  - Höhe 32 px, Polster 0 10 px, Radius 6, Abstand Symbol–Text 10 px;
  - Symbol 16 px `--fg-4`, Text 14/20 500 `--fg-3`;
  - Hover: Fläche `--surface-2`, Text `--fg`;
  - **aktiv:** Fläche `--surface-3`, Text und Symbol `--fg`, Gewicht 600, `aria-current="page"`.
- **Zähler** rechts nach 12.6.
- **Fuß:**
  - Lizenzhinweis („Lifetime-Lizenz …“) ohne Karte als Text 12/16 `--fg-4` mit Linie darüber, Inhalt unverändert;
  - „Einklappen“ als ghost-Eintrag.
- **Eingeklappt:** nur Symbole (32 × 32 px), Tooltip mit Namen.

### 12.11 Kopfleiste (`TopBar`) und mobile Tab-Leiste

**Kopfleiste:**

- **Fläche:** Höhe 56 px, Fläche `--bg` deckend, Linie unten 1 px `--line`; immer gleich, auch beim Scrollen.
- **Entfällt:** schwebende Glaskapsel mit Radius 28 und Rand; `.kopfleiste::before`-Verlauf. `.glass-deckend` wird `--bg`.
- **Anordnung:**
  - links Seitentitel (nur Telefon) bzw. Suchfeld (12.2);
  - Mitte Apex Island (≥ 1024 px);
  - rechts Status „Simuliert verbunden“ (13 px `--fg-3` mit 6-px-Punkt `--amber`, statisch), Glocke und Gerätewahl als `IconButton`, Person als Avatar 28 px + Name 13/500 `--fg` + Zeile 12 `--fg-4` (ab 1280 px).
- **Größen** wie heute: Telefon 44 px Knöpfe, unter 360 px 40 px, geringe Höhe 36 px und Ausblenden beim Scrollen. Die Klassen `.kopfleiste`, `.kopf-innen`, `.kopf-knopf`, `.kopf-optional` bleiben, nur die Optik ändert sich.

**Mobile Tab-Leiste (`MobileTabBar`):**

- **Fläche:** bündig am unteren Rand, nicht schwebend; Fläche `--bg`, Linie oben 1 px `--line`; Höhe 56 px + `env(safe-area-inset-bottom)`; `--tabbar-h: 56px`, bei geringer Höhe 48 px. Keine Kapsel, keine Lichtbrechung.
- **Tabs:**
  - Symbol 20 px + Beschriftung 12/16 500;
  - inaktiv `--fg-4`;
  - **aktiv** `--fg` + 600 + 2-px-Balken `--ink` oben am Tab.
- **Assistent:** Knopf in der Mitte nach 12.13 (44 px).
- **Unverändert:** die Regeln für geringe Höhe (Beschriftung neben dem Symbol, nur aktive beschriftet).

### 12.12 Apex Island (deutlich ruhiger)

**Aufbau:**

- Höhe 32 px, Breite wie heute (248/300/360 px), Fläche `--surface`, Rand 1 px `--line`, Radius 8, Polster 0 10 px;
- kein schwarzer Kasten, kein Schatten, kein Ring.

**Inhalt Ruhe:**

- `Zap` 14 px Strich 1,5 `--fg-3` (nicht gefüllt, nicht gelb);
- Zahl 13/600 `--fg` mit `.num` („28,2 Std.“), Text „in 7 Tagen“ 13 `--fg-3`;
- rechts Chip `outline` „Beispiel“.

**Inhalt Meldung:**

- Text 13/500 `--fg`, abgeschnitten mit `title`;
- „+3 Min.“ in `--fg-3`, nicht grün.
- Wechsel zwischen Ruhe und Meldung: Überblenden 160 ms.

**Hinweis-Popover** (Hover/Fokus): Menü-Fläche nach 12.8, 300 px, Text 13 `--fg-2`.

**Schließen:** `IconButton` 24 px (`X` 12 px) auf `--surface-pop` mit Rand `--line-strong`, sichtbar bei Hover/Fokus wie heute.

**Telefon:** bleibt ausgeblendet. Alle festen Farben (`#090b14`, `#ffd166`, `#7ee2b8`, `bg-white/10`, `text-white`) entfallen.

### 12.13 Apex-Assistent-Knopf (statt bunter Kugel)

Der Knopf ist die Bildmarke selbst. Lebendig ist nur ihr **Punkt**: Er ist der „Eckpunkt“, an dem Apex zuhört und antwortet.

**Knopf:**

- rund, **48 px** am Desktop (schwebend unten rechts, 24 px Abstand wie heute), **44 px** in der mobilen Tab-Leiste;
- Fläche `--ink`, Bildmarke 20 px in `--on-ink`, im Hellen `--shadow-pop`;
- Hover `--ink-hover`, Fokus Ring 2 px + 2 px Abstand;
- `aria-label="Apex Assistent"`, Tooltip mit Kürzel.

**Zustände (`ApexOrb`, Eigenschaft `zustand` bleibt):**

| Zustand | Verhalten (nur der Punkt) |
|---|---|
| `ruhe` | steht still, nichts atmet |
| `hoert` | Punkt skaliert mit dem Eingangspegel: `1 + 0,35 × pegel`, geglättet über 80 ms |
| `denkt` | Punkt blendet ruhig zwischen 100 % und 35 % Deckkraft, 1,2 s je Takt |
| `spricht` | Punkt skaliert mit dem Ausgangspegel wie bei `hoert` |
| Bewegung reduziert | Punkt steht immer; den Zustand nennt das Panel als Text („Hört zu …“, „Denkt nach …“, „Spricht …“) |

**Größere Darstellungen** (Sprachmodus, Panel-Kopf): gleiche Form, Kreis mit Marke in 40 % der Kreisgröße.

**Entfällt:**

- der Kegelverlauf und seine Unschärfe;
- `clip-path`-Verformung, Glanzlichter, farbiger Schatten;
- Atmen in Ruhe.

**Assistent-Panel (`AssistantDock`):**

- **Ebene:** `--surface-pop`, Rand `--line`, Radius 12, `--shadow-modal`.
- **Kopf:** Marke 16 px + „Apex Assistent“ 15/600 + Status 12 `--fg-4`.
- **Nachrichten:**
  - eigene Nachricht: Fläche `--surface-2`, Radius 8, rechtsbündig;
  - Antwort: freier Text (`.prose-apex`) ohne Blase.
- **Eingabe:** Feld nach 12.2, Mikrofon als sekundärer `IconButton`. Läuft eine Aufnahme, zeigt der Knopf den Punkt in `--seal` mit dem Text „Aufnahme läuft“.

### 12.14 Kennzahl-Kachel (`Stat`), `ProgressRing`, `Sparkline`

**`Stat`:**

- **Aufbau:** Label 13/18 `--fg-3` (optional Symbol 14 px davor), Wert 28/32 600 `--fg` mit `.num`, Zusatz 13/18 `--fg-4`.
- **Ton (`tone`):** färbt **nur** das Symbol (`seal` → `--seal` usw.), nie den Wert oder eine Fläche. Die Icon-Kachel (`bg-*-soft`, 32 px) entfällt. `violet` = `--fg-4`.
- **Kennzahlenleiste:** mehrere `Stat` stehen in **einer** Karte nebeneinander, getrennt durch 1-px-Linien `--line` (Polster 16/20 px). Am Telefon 2 Spalten bzw. untereinander, getrennt durch waagerechte Linien.
- **Klickbar (`onClick`):** die ganze Kachel ist ein Knopf, Hover `--surface-2`, Fokus-Ring innen (`outline-offset: -2px`, damit er an Nachbarn nicht abgeschnitten wird).
- **Kritische Lage:** „Kritische Fristen 4“ zeigt `TriangleAlert` in `--seal` vor dem Label. Die Zahl bleibt `--fg`, der Zusatz nennt die Lage im Wort.

**`AnimatedNumber`:** zeigt den Wert sofort. `hochzaehlen` nur auf der Startseite, ≤ 600 ms, bei reduzierter Bewegung nie.

**`ProgressRing`:**

- Strich 4 px, Spur `--line`, Wert `--ink`, Enden gerade (`butt`);
- Übergang 220 ms;
- Beschriftung in der Mitte 15/600 bzw. groß 28/600.
- Status-Plakette darin („Beispielwerte“) als Chip `outline`.

**`Sparkline`:** Linie 1,5 px `--chart-1`, keine Fläche, kein Verlauf, Endpunkt 3 px.

### 12.15 Diagramme

Eine Akzentfarbe plus Neutrals:

- **Werte:**
  - Balken bzw. Linien in `--chart-2` (`--line-strong`);
  - der hervorgehobene Wert (heute, Auswahl, aktuelle Woche) in `--chart-1` (`--ink`);
  - Signalfarbe nur, wenn der Wert diese Bedeutung hat (z. B. überfällige Forderungen in `--seal`), dann mit Beschriftung.
- **Balken:** höchstens 32 px breit, Radius 2 px oben, Abstand mindestens 50 % der Balkenbreite. Keine Verläufe, keine 3-D, keine Schatten.
- **Linien:** 1,5 px, Punkte nur am letzten Wert und bei Hover.
- **Gitter:** nur waagerecht, 3–5 Linien in `--chart-grid` (`--line`), Grundlinie `--line-strong`.
- **Achsen:** Beschriftung 12/16 `--fg-4` mit `.num`, Einheit einmal an der Achse („Std.“).
- **Werte direkt beschriften:** 12/16 500 `--fg-2` über dem Balken, wo Platz ist. Eine Legende nur bei mehr als einer Reihe, als direkte Beschriftung am Linienende.
- **Tooltip:** Menü-Fläche (12.8) mit Wert und Datum.
- **Formen:** keine Torten, Ringe nur als `ProgressRing` für genau einen Anteil.
- **Zugänglichkeit:** `aria-label` mit Zusammenfassung oder eine Tabelle als Alternative (wo heute vorhanden, bleibt sie).

### 12.16 Leerzustand (`Empty`)

- **Aufbau:** mittig in der Fläche, Polster 48/24 px, Symbol 20 px `--fg-4` **ohne Kachel** (die 56-px-Kachel `bg-ink-soft text-ink` entfällt).
- **Text:** Titel 15/22 600 `--fg`, Text 14/20 `--fg-3`, höchstens 44 Zeichen breit, mittig.
- **Aktion:** eine einzige, sekundär. Primär nur, wenn sie die Hauptaktion der Seite ist („Erste Akte anlegen“).
- Keine Illustrationen, keine Emoji.

### 12.17 Ladebildschirm und Ladeplatzhalter

**`LadeBildschirm`:**

- mittig: Bildmarke 32 px `--fg` (statt `AppIcon` 64 px), 16 px Abstand, Text 13/18 500 `--fg-3`;
- darunter eine Linie 2 × 120 px: Spur `--line`, Läufer 40 px `--ink`, 1,2 s gleichmäßig von links nach rechts;
- bei reduzierter Bewegung steht der Läufer mittig;
- **kein Pulsieren** der Marke.

**Fehlerfall:** wie heute, Titel 15/600, Meldung 13 `--seal-text`, Knöpfe „Erneut versuchen“ (`primary`) und „Abmelden“ (ghost).

**Ladeplatzhalter (`.shimmer`):** ruhende Fläche `--surface-2`, Radius 4, in der Höhe der späteren Zeile. Kein Schimmer, keine Animation.

### 12.18 Papier-Dokumente (`.paper`)

- **Blatt:** Fläche `#FFFFFF`, Schrift `#1A1917`. Diese festen Werte sind gewollt: Das Papier ist in beiden Modi weiß, Druck = Bildschirm.
- **Rahmen:** Rand 1 px `#E6E5E2`, Radius 4, **kein Schatten**. Es liegt auf der Vorschau-Bühne (`--surface-2`, 24 px Polster).
- **Schrift:** Geist 13/1,6 (unverändert), Seitenränder wie heute.
- **Dunkelmodus:** Abdunkeln über `filter: brightness(0.87)` und `PapierSchalter` („Abgedunkelt“/„Original“) bleiben unverändert; der Rand darf im Dunkeln entfallen.
- **Druck:** immer Original, ohne Filter und ohne Rand.

### 12.19 KI-Kennzeichnung

| heute | neu |
|---|---|
| `AiChip` | Chip `outline` mit `Sparkles` 12 px und „KI“ (bzw. dem übergebenen Text) |
| `.ai-ring` (rotierender Verlaufsrand) | `box-shadow: inset 0 0 0 1px var(--line-strong)`, keine Animation, `::before` entfällt |
| `.ai-ring.ai-glow` | ohne Wirkung |
| `.ai-text` (Verlaufstext) | `color: var(--fg); background: none;`, Gewicht unverändert |
| `.ai-fill` (Verlaufsfläche) | `background: var(--ink); color: var(--on-ink);` |
| `.btn-ai`, `variant="ai"` | wie `secondary` + `Sparkles` (12.1) |
| violette Hervorhebung in KI-Texten (z. B. „3 warten noch auf die KI-Analyse“) | Gewicht 600 in `--fg`; ist es ein Link, dann unterstrichen |
| KI-Briefing-Karte im Cockpit | ein normaler Abschnitt: Kopfzeile mit `AiChip` „KI-Briefing“ + Zeitstempel 13 `--fg-4` + „Vorlesen“ ghost; Text 15/24 `--fg-2`, Hervorhebungen 600 `--fg`, Links unterstrichen; kein Ring |
| Hinweis „KI erkennt · Rechenkern berechnet · Vier-Augen-Kontrolle“ | Text 12/16 `--fg-4` mit `Sparkles` 12 px |

Die Kennzeichnung bleibt überall, wo sie heute ist. Sie wird nur ruhiger.

### 12.20 Avatar

- **Form:** rund, 28 px (sm 24, lg 40).
- **Farbe:** Fläche `--surface-3`, Initialen 12/16 600 `--fg-2`. Personenfarben aus den Daten erscheinen nicht als Fläche (Abschnitt 4.1).
- **`AvatarStack`:** Überlappung −6 px, Ring 2 px in der Untergrund-Farbe.

### 12.21 Links und Fokus

**Links im Fließtext:**

- `color: var(--ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; text-decoration-color: var(--line-strong);`
- Hover: Unterstrich `--fg`.
- Pflicht, weil der Akzent der Textfarbe gleicht (WCAG 1.4.1).

**Eigenständige Links** („Alle Fristen“, „Zum Posteingang“): 13/500 `--fg-2` mit `ChevronRight` 14 px, ohne Unterstrich; Hover `--fg`. Aktenzeichen-Links in Texten: `.mono` + Unterstrich.

**Fokus:**

- `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }`
- Die heutige Angabe `border-radius: 8px` in dieser Regel entfällt: Sie verformte fokussierte Elemente, und `outline` folgt dem eigenen Radius.
- Innerhalb von Behältern mit `overflow: hidden` (Tabellenzeile, Kennzahl, Segment): `outline-offset: -2px`.
- Nie verdeckt: `scroll-padding` bleibt (Abschnitt 13).

### 12.22 Hinweisbanner

**Grundform:** Polster 10/14 px, Radius 6, Symbol 16 px, Titel 14/500, Text 14 `--fg-2`, Aktion als ghost `sm` rechts.

| Ton | Fläche | Rand | Symbol |
|---|---|---|---|
| Info (z. B. „Demo-Daten – im Echtbetrieb misst …“) | `--surface` | 1 px `--line` | `Info` bzw. `FlaskConical` `--fg-3` |
| Warnung | `--amber-soft` | – | `TriangleAlert` `--amber`, Titel `--amber-text` |
| Kritisch | `--seal-soft` | – | `TriangleAlert` `--seal`, Titel `--seal-text` |
| Erfolg | `--green-soft` | – | `CircleCheck` `--green` |

---

## 13. Seitenaufbau

**App-Rahmen:**

- Seitenleiste (232 px) | Inhalt;
- die Kopfleiste (56 px) liegt über der Inhaltsspalte;
- alles auf `--bg`, keine Aura;
- `.aura` rendert nichts mehr (oder bleibt als einfarbige Fläche `--bg`). `RefractionDefs` entfällt.

**Inhaltsbreiten:**

| Seitentyp | max. Breite | Beispiele |
|---|---|---|
| Standard | 1280 px, mittig | Cockpit, 38h-Motor, Abrechnung-Übersicht, Kontakte-Detail |
| Breit | volle Breite (Polster bleibt) | Akten-Liste, Fristen Woche/Monat, Posteingang (drei Spalten), Fall-Datenbank-Treffer |
| Lesen | 720 px | Wiki, Hilfe-Artikel, KI-Antworten, Schriftsatz-Text |
| Formular | 640 px | Mandatsaufnahme-Schritte, Einzel-Einstellungen |
| Einstellungen | 960 px | Einstellungen mit Reitern |

**Innenabstand:** 32 px (≥ 1024 px), 24 px (640–1023 px), 16 px (< 640 px). Bei 320 px darf nichts quer scrollen. Tabellen werden zur Liste (`mobileRow`), lange Wörter umbrechen (`min-w-0`, `break-words`).

**Seitenkopf (`PageHeader`):**

- optionale Überzeile 12/16 500 `--fg-3` (z. B. Datum);
- Titel `.title-xl` 24/32 600 mit Hilfe-`IconButton` (`CircleHelp` 16 px, Trefferfläche ≥ 24 px) direkt daneben;
- Untertitel 14/20 `--fg-3`, höchstens 72 Zeichen breit.
- **Aktionen rechts** auf der Titelzeile:
  - höchstens eine `primary`, sonst sekundär/ghost, Abstand 8 px;
  - unter 768 px rutschen sie unter den Untertitel, die Primäraktion zuerst.
- 24 px Abstand zum Inhalt, keine Linie unter dem Kopf.
- Umschalter der Ansicht (`Segmented` „Ganze Kanzlei / Nur meine“) stehen rechts in der Aktionszeile.

**Raster:**

- 12 Spalten, Rinne 24 px (Telefon 16 px);
- Standard-Aufteilungen 8/4 (Hauptinhalt / Seitenspalte ab 1280 px), 6/6, 4/4/4;
- darunter einspaltig.

**Vertikaler Rhythmus:**

- Seitenkopf → Kennzahlen 24 px;
- zwischen Abschnitten 32 px;
- in Karten 16 px zwischen Gruppen.

**Beispiele (Soll):**

- **Cockpit:**
  - Seitenkopf (Datum als Überzeile, „Guten Tag, Frau Dr. Hartmann“, Untertitel, Umschalter rechts);
  - KI-Briefing als freier Abschnitt (12.19);
  - **Schnellaktionen** als Zeile aus vier sekundären Knöpfen mit Symbol und Kürzel statt vier großer Karten;
  - darunter 8/4: „Heute und morgen fällig“ (Karte mit Liste) | „Posteingang“ (Karte mit Liste).
- **Fristen:**
  - Seitenkopf mit „Frist berechnen“ als einziger Primäraktion, „Wiedervorlage“ sekundär, „Drucken“ und „.ics“ ghost;
  - Kennzahlenleiste mit vier `Stat` in einer Karte;
  - Werkzeugzeile (Segmented, Filter, Schalter);
  - Liste nach Tagen gruppiert: Tageskopf 13/600 `--fg` + Datum `--fg-4` + Anzahl rechts, ohne blaue Schrift;
  - Zeilen nach 12.4, roter Balken nur für kritische Fristen.
- **38h-Motor:**
  - Demo-Hinweis als Info-Banner;
  - Leitzahl „28,2 Std.“ 40/44 600 neben `ProgressRing`;
  - drei `Stat` als Kennzahlenleiste (ohne grüne Hervorhebung „Hochgerechnet pro Jahr“: alle gleichrangig);
  - Balkendiagramm nach 12.15 (heute in `--chart-1`);
  - rechts „Zuletzt erledigt“ als Liste mit Linien; „+3 Min.“ in `--fg-3`, `Zap` 14 px `--fg-4` ohne Kachel.

---

## 14. Startseite (`/willkommen`)

Texte, Inhalte, Abschnitte und Anker bleiben unverändert. Reduziert wird die Gestaltung.

**Grundregeln:**

- Alles liegt auf `--bg`, ohne Aura, ohne dunkle Bühne, ohne Verläufe, ohne Scroll-Einblendungen.
- Container 1200 px, 12 Spalten, Rinne 24 px, am Telefon 16 px Seitenrand.
- Abstand zwischen Abschnitten 128 px (Desktop), 96 px (Tablet), 64 px (Telefon). Abschnitte trennt Abstand, höchstens eine 1-px-Linie.
- Je Abschnitt höchstens ein Primärknopf.
- Typografie nach `RECHERCHE.md` 4.3: Display 56/60, H2 36/44, H3 20/28, Einleitung 18/28, Text 16/26.

**Abschnittsfolge** (wie heute, damit die Anker der Navigation stimmen):

1. **Kopf (`Navigation`):**
   - 64 px, deckend `--bg`, Linie unten erst nach dem ersten Scrollen;
   - links Wortmarke (Marke 20 px), Mitte Anker-Links 14/500 `--fg-3` (Hover `--fg`), rechts „Anmelden“ (ghost) und „Demo starten“ (`primary`);
   - keine schwebende Glaskapsel;
   - Telefon: Menü-Knopf 44 px, Menü als Drawer von oben.
2. **Einstieg (`Hero`):**
   - Hinweis „Neu · KI-Fallanalyse …“ als Chip `outline`;
   - H1 „Ein Werkzeug. Volle Kontrolle.“ 56/60 600 −0,035 em, erste Zeile `--fg`, zweite Zeile `--fg-3` (statt Blau);
   - Einleitung 18/28 `--fg-2`, höchstens 600 px;
   - Knöpfe: „Demo starten“ `primary lg`, „Testzugang anfordern“ `secondary lg`, „Funktionen ansehen“ als eigenständiger Link;
   - Vertrauenszeile 13 `--fg-3` mit Symbolen 16 px `--fg-4`;
   - die Produktvorschau (`LivePreview`) rechts (≥ 1024 px) bzw. darunter, als flaches Produktfenster: Fläche `--surface`, Rand 1 px `--line`, Radius 12, **ohne Schatten**, Fenster-Punkte in `--line-strong` statt Ampelfarben; Inhalte nach den Rezepten oben (KI-Fallanalyse ohne Verlaufsrand).
3. **Kennzahlen:**
   - eine Zeile mit vier Spalten, getrennt durch 1-px-Linien, ohne Karte und ohne Icon-Kacheln;
   - Zahl 36/44 600 `--fg`, Text 14/20 `--fg-3`, Fußnotenzeichen bleiben.
4. **Funktionen:** 3er-Raster ohne Karten, je Funktion Symbol 20 px `--fg-2`, H3, zwei Zeilen Text `--fg-3`, Linie oben über jeder Spalte.
5. **38h-Motor:** Text links, ein flacher Produktausschnitt rechts (Radius 12, Rand, kein Schatten).
6. **Vergleich:**
   - Tabelle nach 12.4, Apex-Spalte über Kopf 600 und Fläche `--surface-2` in der Spalte;
   - `Check` 16 px `--fg`, `Minus` 16 px `--fg-4`, keine grünen und roten Symbole.
7. **Lifetime (Preis):** ein Block mit Rand 1 px `--line`, Radius 12, Polster 32 px; Preisaussagen nach `PREIS_HINWEIS` unverändert; ein Primärknopf.
8. **Umzug-Band:** eine Zeile auf `--surface-2` (Radius 8) mit Satz und eigenständigem Link.
9. **KI und Datenschutz (`Vertrauen`):** zweispaltige Liste, Symbol 16 px `--fg-2`, Titel 15/600, Text 14 `--fg-3`.
10. **Erfahrungen:** Zitate als Text 18/28 `--fg` mit Name 13 `--fg-3`, ohne Karten und ohne Anführungszeichen-Grafik.
11. **Fragen (FAQ):** Liste mit Linien, Frage 16/500, `Plus`/`Minus` 16 px rechts, Antwort 15/24 `--fg-2`, Aufklappen 160 ms.
12. **Schluss:**
    - mittig ein Satz (H2) und ein `primary lg`-Knopf auf `--bg`;
    - `.schluss-karte` wird zu einem ruhigen Block: Fläche `--surface-2`, Radius 12, Schrift `--fg`;
    - keine invertierte schwarze Fläche, kein Glühen.
13. **Fuß:** Linie oben, Links 13 `--fg-3`, Wortmarke klein, Pflichtangaben unverändert.

**Anmeldeseite (`/login`):** Wortmarke oben mittig, Überschrift wie heute, Formular in einer Karte (400 px, Polster 24 px) auf `--bg`, ein Primärknopf. Kein Hintergrundbild, keine Aura.

---

## 15. Umsetzung und Abnahme

**Reihenfolge** (jede Stufe ist für sich lauffähig):

1. **Tokens** (4.3) und Grundklassen in `src/styles/index.css`:
   - `.btn*`, `.icon-btn`, `.field`, `.chip*`, `.kbd`, `.eyebrow`, `.title-*`, `.table`, `.sheet`, `.glass*`, `.aura`, `.ai-*`, `.shimmer`, `.bar`, `.paper`, `.schluss-karte`, Fokus;
   - Strich 1,5 global;
   - in `index.html` die `theme-color`-Angaben auf `#FAFAF9` (hell) und `#111110` (dunkel) setzen (heute `#edf0f7` / `#05070d`).

   Danach sieht die App bereits weitgehend ruhig aus, ohne Komponentenänderung.
2. **Bausteine:**
   - `Logo.tsx` (neue Marke, flaches App-Icon);
   - `Glass.tsx` (`Card`, `CardHeader` ohne Kachel), `Stat.tsx`, `Empty.tsx`, `Segmented.tsx`, `Modal.tsx`, `Menu.tsx`, `Toaster.tsx`, `Chip.tsx` (`chip-seal-voll`), `Avatar.tsx`;
   - `src/lib/bewegung.ts` (Bewegungssatz).
3. **Rahmen:**
   - `Sidebar.tsx`, `TopBar.tsx`, `MobileTabBar.tsx`, `ApexIsland.tsx`, `AppShell.tsx` (Aura, `RefractionDefs` entfernen);
   - `ApexOrb.tsx`, `AssistantDock.tsx`, `LadeBildschirm.tsx`, `Sperrbildschirm.tsx`, `ZweiFaktorPflicht.tsx`.
4. **Radien:** Abbildung der `rounded-[…]`-Werte (Abschnitt 7); feste Farben und `font-[560/620/650]` durch Tokens bzw. 500/600 ersetzen.
5. **Seiten:** Cockpit, Fristen, 38h-Motor, Posteingang, Akten, Abrechnung, KI, Fall-Datenbank, Kontakte, Umzug, Hilfe, Einstellungen, Console, Startseite, Anmeldung.
6. **Dokumentation:** `docs/UI-LEITFADEN.md` §1–2 und 5.3 an dieses Dokument angleichen (Liquid-Glass-Abschnitte ersetzen, `variant="ai"`, Chip-Töne, CSS-Klassen).

**Abnahme (jede Stufe):**

- [ ] `npm run typecheck && npm test && npm run build` grün; Fachlogik, KI, Server, Texte, Deep-Links und Tastenkürzel unverändert.
- [ ] Kein `backdrop-filter`, kein `linear-/radial-/conic-gradient` mehr in `src/` (Ausnahme: `.fade-x`-Maske), keine `--ai-*`-Verläufe, keine festen Hex-Farben außer `.paper` und Daten-Farben.
- [ ] Hell und Dunkel, 1440/1024/390/360/320 px, 200 % Zoom: kein Querscrollen, Fokus sichtbar und nie verdeckt, Tippziele ≥ 44 px am Telefon, ≥ 24 px am Desktop.
- [ ] axe-core ohne „serious“ und „critical“ in Hell und Dunkel (Cockpit, Fristen, 38h-Motor, Posteingang, Akte, Startseite, Anmeldung).
- [ ] Höchstens ein Primärknopf je Bereich. Rot erscheint nur bei kritischen Fristen, Fehlern und Löschen.
- [ ] „Bewegung reduzieren“: keine Bewegung außer Überblenden, Assistent-Punkt steht.
- [ ] Sichtvergleich mit `docs/design/brand-board.png`.

# AnwaltApex – UI- & Entwicklungsleitfaden

Dieser Leitfaden gilt für alle, die an der Web-App bauen. Ziel: **ein** konsistentes Produkt im Stil von Apple Liquid Glass – minimalistisch, ruhig, präzise, mit sinnvollen Animationen.

## 1. Designprinzipien

1. **Glas für Steuerung, ruhige Flächen für Inhalt.** Navigation, Leisten, Popover, Dialoge = Glas (`.glass`, `.glass-strong`). Lesbarer Inhalt (Tabellen, Texte, Formulare) liegt auf `Card` (`.sheet`) – fast opak, gute Lesbarkeit.
2. **Eine klare Aktion pro Bereich.** Primärbutton (`variant="primary"`) sparsam einsetzen, sonst `secondary`/`ghost`. KI-Aktionen bekommen `variant="ai"` (irisierender Verlauf) – nur für echte KI-Funktionen.
3. **Jede Funktion klar benannt und erklärt.** Seitentitel über `<PageHeader title subtitle hilfe>`; `subtitle` erklärt in einem Satz, was der Bereich tut. `hilfe` = Wiki-Schlüssel aus `src/content/wiki.ts` (öffnet die animierte Schnellhilfe).
4. **Zustand in Form, nicht nur in Zahlen.** Status als `Chip` (tone `seal` = kritisch/Notfrist, `amber` = bald, `green` = erledigt/ok, `ink` = Info, `violet` = KI, `outline` = neutral umrandet). Rot (`seal`) bekommt eine Frist nur, wenn sie kritisch ist – Notfrist oder gesetzlich nicht verlängerbar: `istKritisch(f)` aus `@/core/fristenLage` bzw. `fristArtZu(f)?.kritisch` aus `@/core/fristen`. Die zeitliche Ampel (überfällig, ≤ 2 Tage, ≤ 7 Tage) liefert `fristDringlichkeit()` aus `@/core/fristen`. Farbe trägt nie allein die Bedeutung: Text oder Symbol nennen den Zustand immer mit (Farbfehlsicht, Dunkelmodus).
5. **Bewegung mit Sinn.** `motion/react` für Ein-/Ausblenden (Spring: `stiffness 420–520, damping 32–38`), Listen leicht gestaffelt (`delay: i * 0.03`, max. ~10 Elemente staffeln), `layoutId` für gleitende Auswahlindikatoren. Nichts darf im Ruhezustand unsichtbar bleiben. `prefers-reduced-motion` wird global respektiert.
6. **Responsiv ab 360 px, Reflow ab 320 px.** Grids mit `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` o. ä.; Kind-Elemente mit Text `min-w-0`; Tabellen über `DataTable` mit `mobileRow` (Kartenliste auf dem Smartphone). Platz für die schwebende Tab-Leiste (`--tabbar-h`, 72 px, bei geringer Höhe 48 px) und schwebende Aktionsleisten ist im Layout über `scroll-padding-bottom` eingeplant. Inhalte umbrechen statt kürzen (`truncate` nur, wo der volle Text zusätzlich erreichbar ist); Zahl und Einheit bleiben zusammen (`mitEinheit`, `schuetzeKennzahlen`). Bei 200 % Zoom (720 × 450 CSS-px) blendet sich die kompakte Kopfleiste beim Scrollen aus.
7. **Deutsch, klar, aktiv.** Buttons sagen, was passiert („Frist übernehmen“, „Rechnung erstellen“). Toasts bestätigen („Frist eingetragen“). Fehler erklären, wie man sie behebt. Keine Anglizismen, wo es ein gutes deutsches Wort gibt. Juristische Begriffe korrekt (beA, eEB, Notfrist, Vorfrist, Wiedervorlage, Gegenstandswert, Aktenkonto, Fremdgeld, VV RVG).

## 2. Bausteine (`@/components/ui`)

| Baustein | Verwendung |
|---|---|
| `Button` (`variant`: primary · secondary · ghost · danger · ai; `size`: sm · md · lg; `icon`, `iconRight`, `loading`) | Alle Aktionen |
| `IconButton` (`label` Pflicht) | Symbolaktionen |
| `Card`, `CardHeader` | Inhaltsflächen (`interactive` für klickbare Karten) |
| `Glass` | schwebende Steuerflächen |
| `Field`, `Input`, `Textarea`, `Select`, `SearchField` | Formulare – jedes Feld braucht eine stabile `id` |
| `Chip`, `AiChip` | Status, Kategorien, „KI“-Kennzeichnung |
| `Segmented` | Reiter/Umschalter mit gleitendem Glas-Indikator |
| `Switch` | Ein/Aus (iOS-Stil) |
| `Avatar`, `AvatarStack` | Personen |
| `Modal`, `Drawer` | Dialoge (Drawer = Seitenpanel) |
| `confirmDialog({titel, text, bestaetigen, gefahr})` | **statt `window.confirm`** (funktioniert in eingebetteten Ansichten nicht) |
| `toast(titel, {text, ton, aktion})` aus `@/store/ui` | Rückmeldungen (Dynamic-Island-Stil) |
| `PageHeader` | Seitenkopf mit Schnellhilfe |
| `Empty` | Leere Zustände mit Erklärung und Aktion |
| `Stat`, `AnimatedNumber`, `ProgressRing`, `Sparkline` | Kennzahlen & Mini-Diagramme |
| `Menu` | Kontextmenüs |
| `DataTable` | Tabellen: sortierbar, Spaltenbreite verstellbar, Spalten ein-/ausblendbar, Dichte umschaltbar, Mehrfachauswahl + `bulkActions`, `mobileRow` |
| `Highlight` (`@/components/Highlight`) | Suchtreffer hervorheben |
| `WikiPlayer` (`@/components/wiki/WikiPlayer`) | animiertes Wiki |
| `FallanalysePanel` (`@/components/ki/FallanalysePanel`) | KI-Fallanalyse einer Akte |
| `Switch` (`label`, `describedBy`) | Schalter; `describedBy` verweist per `aria-describedby` auf einen sichtbaren Hinweis (z. B. warum ein Schalter gesperrt ist) |
| `PapierSchalter` | „Abgedunkelt“ / „Original“ für Dokumentvorschauen (`.paper`) im Dunkelmodus – gilt für alle Vorschauen, Druck immer im Original |
| `KopierKnopf` (`@/components/KopierKnopf`; `text`, `was`, `markieren`) | Kopieren mit Bestätigung am Knopf („✓ Kopiert“, per `aria-live` angesagt); bei gesperrter Zwischenablage wird der Text markiert |
| `FristAutomatikHinweis` (`@/components/FristAutomatikHinweis`) | Hinweis, dass Fristautomatiken nur Partner und Administration schalten |

CSS-Klassen: `title-xl`, `title-lg`, `title-md`, `eyebrow`, `mono` (Aktenzeichen, Beträge), `num` (tabellarische Ziffern), `prose-apex` (Fließtext/Schriftsätze), `paper` (Dokumentvorschau), `ai-ring`, `ai-text`, `ai-fill`, `shimmer` (Ladeplatzhalter), `bar` (Fortschritt), `kbd`.

Farben nur über Tokens (`text-fg`, `text-fg-2/3/4`, `bg-surface`, `bg-ink-soft`, `text-ink`, `text-seal`, `bg-seal-soft`, `text-amber`, `bg-amber-soft`, `text-green`, `bg-green-soft`, `text-violet`, `bg-violet-soft`, `border-[var(--line)]`). **Keine festen Hex-Farben** in Komponenten (Ausnahme: Kanzlei-/Personenfarben aus den Daten). Hell- und Dunkelmodus müssen beide funktionieren. Welche Tokens für Schrift auf Flächen gedacht sind, steht in [Abschnitt 5.3](#53-kontrast-tokens).

Icons: `lucide-react`, Größe `size-4` (16 px) in Buttons, `size-[18px]` in Navigation.

## 3. Daten & Logik

- Daten der angemeldeten Kanzlei: `useData((s) => s.data.akten)` bzw. `useCol("akten")`. Ändern: `useData.getState().upsert(col, doc)`, `.patch(col, id, partial)`, `.remove(col, id)`. Persistenz (Browser oder Server) passiert automatisch.
- Aktivität protokollieren (füttert Cockpit & 38h-Motor): `useData.getState().log({ akteur: "nutzer" | "ki" | "automation", text, akteId?, userId?, minutenGespart?, automationKey? })`.
- Sitzung: `useKanzlei()` aus `@/store/session` → `{ user, tenant, team }`. Bundesland für Fristen: `tenant.bundesland`.
- Neue IDs: `uid("f")` aus `@/core/dates`; Zeitstempel `nowLocal()`; heute `today()`.
- Formatierung: `fmtDate`, `fmtDateWd`, `fmtDateLong`, `fmtDateShort`, `relDays`, `relTime`, `fmtEUR`, `fmtNum` aus `@/core/dates`.
- Fachlogik (`@/core/…`): `fristen.ts` (Fristenrechner mit Rechenweg, `FRIST_REGELN`, `fristArt`, `fristArtZu`, `fristDringlichkeit`), `fristenLage.ts` und `kennzahlen.ts` (einheitliche Zählweise, siehe [Abschnitt 4](#4-gemeinsame-bausteine-für-zahlen-namen-und-texte)), `feiertage.ts`, `rvg.ts` (`berechneRvg`, `VV_KATALOG`, `wertgebuehr`, Fassung 2025/2021), `zinsen.ts` (`forderungskonto`, `verzugszinsen`, `BASISZINS`), `kontaktpruefung.ts` (Kollisionsprüfung inkl. Dubletten), `vertretung.ts`, `search.ts` (`search`, `snippet`), `rechtsprechung.ts` (`ENTSCHEIDUNGEN`), `automationen.ts`.
- KI (`@/ai/…`): `analysiereNachricht`, `analysiereDokument`, `beispielDokumente` (Posteingang/Dokumente), `analysiereFall` (Fallanalyse), `llmText`/`llmJson` (freie Generierung; wirft `DemoModus` im Demo-Betrieb → dann Offline-Text verwenden), `useAiStatus` (Quelle: server/artefakt/demo). **Grundsatz: Die KI erkennt, der Fristenrechner berechnet.**
- Navigation: `useNavigate()` aus `react-router`; Query-Parameter mit `useSearchParams()`.
- Assistent öffnen: `useUI.getState().oeffneAssistent("Frage …")`. Schnellhilfe: `useUI.getState().zeigeHilfe("fristen")`.
- Hintergrundschreibvorgänge (Motor, Posteingang-Automatik) mit `{ system: true }` an `patch`/`upsert`/`log` übergeben, damit sie nicht als Änderung der Nutzerin zählen.

## 4. Gemeinsame Bausteine für Zahlen, Namen und Texte

Diese Helfer sorgen dafür, dass überall dieselben Zahlen und dieselben Wörter stehen. **Keine Seite rechnet Fristen, Kennzahlen oder Bezeichnungen selbst nach** – wer etwas Neues braucht, ergänzt es hier.

### 4.1 Fristen zählen – `src/core/fristenLage.ts`

Verbindliche Zählweise für Cockpit, Navigation, Fristenkalender, Akten und Apex Assistent:

- **„Frist“ = Notfrist oder Frist** (`zaehltAlsFrist`). Wiedervorlagen, Vorfristen und Termine sind eigene Kategorien; sie werden getrennt genannt und nie als „Fristen“ gezählt („Heute sind 2 Fristen fällig, dazu 1 Wiedervorlage und 1 Vorfrist.“).
- **Kritisch** = Notfrist oder gesetzlich nicht verlängerbare Frist (`istKritisch`, über `fristArtZu`). Vorfristen sind nie kritisch.
- **„Nächste 7 Tage“** ist ein gleitendes Fenster (`FENSTER_TAGE` = 7, von morgen bis heute + 7), nicht die Kalenderwoche.

| Funktion | Liefert |
|---|---|
| `fristenLage(fristen, heute, nurFuer?)` | `faellig` (bis heute inkl. überfälliger), `heute`, `ueberfaellig`, `wiedervorlagen`, `vorfristen`, `woche`, `wiedervorlagenWoche`, `kritischWoche`, `notfristenWoche` – optional nur für eine Person („Nur meine“) |
| `fristenImZeitraum(fristen, von, bis, nurFuer?)` | Fristen, Notfristen, kritische, Wiedervorlagen, Vorfristen und Termine in einem Datumsbereich – gleiche Zählweise |
| `fristenJeAkte(fristen, bis?)`, `aktenMitFrist(fristen, heute)` | je Akte die dringendste und die dringendste kritische Frist samt Anzahl – Grundlage für „Akten mit Frist ≤ 7 Tage“, die Spalte „Nächste Frist“ und „Akten mit Handlungsbedarf“ |
| `offeneVerantwortung(fristen, personId)` | offene Fristen, Wiedervorlagen, Termine und Vorfristen einer Person – z. B. vor dem Deaktivieren eines Zugangs |
| `nachDringlichkeit(a, b)` | Sortierung: Datum, dann kritische Fristen vor übrigen Fristen, Wiedervorlagen, Vorfristen, Termine |

### 4.2 Kennzahlen – `src/core/kennzahlen.ts`

Eine Berechnung für Cockpit, Apex Island und Apex Assistent:

| Funktion | Liefert |
|---|---|
| `wochenbeginn`, `wochenende` | Montag und Sonntag der Kalenderwoche – „diese Woche“ meint immer Mo–So |
| `posteingangZahlen(nachrichten)` | neue Nachrichten, davon „KI-Analyse fertig“, „wartet auf KI-Analyse“, offene eEB |
| `finanzZahlen(rechnungen, buchungen, transaktionen, heute)` | offene und überfällige Forderungen, Fremdgeld zur Weiterleitung je Akte, offene Kontoumsätze, älteste überfällige Rechnungen |
| `motorZahlen(aktivitaeten, heute)` | gesparte Minuten und Stunden der **letzten 7 Tage** (heute und die sechs Tage davor), Läufe, Wert pro Woche und Jahr zum Zielwert-Satz `WERT_PRO_STUNDE` |
| `aktenZahlen(akten, fristen, heute)` | offene, ruhende, abgeschlossene Akten, neu seit Montag, Akten mit (kritischer) Frist ≤ 7 Tage |
| `tagesbriefing(eingabe)`, `briefingText(satz, gesprochen?)` | die drei Sätze des KI-Briefings (Fristen, Posteingang, nächster Termin) – angezeigt, vorgelesen und im Assistenten identisch |
| `fristArtLabel(f)`, `naechsteTermine(…)` | „Notfrist“, „nicht verlängerbare Frist“, „Frist“ …; die nächsten Termine |
| `kanzleiStatusZahlen`, `kanzleiStatusText` | Zählung „aktiv · im Test · pausiert“ in der Apex Console |

### 4.3 Personen und Rollen – `src/lib/rollen.ts`

Je Person genau ein passender Begriff, keine „Partner/in“- oder „ReFa“-Kürzel in der Oberfläche:

| Funktion | Beispiel |
|---|---|
| `rollenLabel(u)` | „Partnerin“, „Rechtsanwalt“, „Fachangestellte“ – aus Anrede, sonst Berufsbezeichnung |
| `ROLLE_AUSWAHL`, `ROLLE_SPALTE` | neutrale Bezeichnungen für Auswahllisten und Spaltenköpfe der Rechte-Tabelle |
| `foermlicherName(u)`, `briefAnrede(u)`, `gruss(u)` | „Frau Dr. Hartmann“, „Sehr geehrte Frau Dr. Hartmann,“, „Guten Morgen, Frau Dr. Hartmann“ |
| `hauptnutzerBegriff(u)` | „Hauptnutzerin“ / „Hauptnutzer“ |
| `ansprechBezeichnung(ap)`, `festeAnsprechBezeichnung(ap)`, `ansprechText(text, ap)` | „Ihre feste Ansprechpartnerin“ / „Ihr fester Ansprechpartner“; Platzhalter wie `{Ihre feste Ansprechperson}` in Wiki und Navigation |
| `mandantBezeichnung(k)` | „Mandantin“ / „Mandant“ (Unternehmen: „Mandantin“) |
| `darfAutomatikSchalten(u, key)` | Fristautomatiken nur für Partner und Administration |

### 4.4 Kopieren – `src/lib/zwischenablage.ts`

- `kopiereText(text, fallbackEl?)` versucht nacheinander die Clipboard-API, `execCommand("copy")` über ein verstecktes Textfeld und zuletzt das Markieren des Elements. Das Ergebnis (`"kopiert"`, `"markiert"`, `"fehler"`) sagt ehrlich, was passiert ist – bei `"markiert"` lautet der Hinweis „Text markiert – jetzt Strg/⌘+C“.
- Nie `navigator.clipboard` direkt aufrufen; in eingebetteten Ansichten (Artefakt-Vorschau) ist sie oft gesperrt. Für Knöpfe den `KopierKnopf` verwenden.

### 4.5 Feste Wortlaute

| Konstante | Wo | Wortlaut |
|---|---|---|
| `DEMO_KI_NAME` | `src/ai/status.ts` | „Demo-KI (offline)“ – einziger Name der Offline-KI in Kopfleiste, Assistent, Fallanalyse, Systemstatus, Wiki und Einstellungen. Live heißt es „KI live · Claude“. |
| `SIMULIERT_STATUS` | `src/lib/betriebsstatus.ts` | „beA · E-Mail · Bank: im Prototyp simuliert“ – gleicher Abruftakt in Kopfleiste, Posteingang, Bankabgleich und Systemstatus |
| `PREIS_HINWEIS`, `WARTUNG_HINWEIS`, `WARTUNG_OPTIONAL`, `UEBERTRAGBARKEIT_HINWEIS`, `ESCROW_HINWEIS`, `KI_EU_HINWEIS`, `LIZENZ_KENNZEICHNUNG` | `src/content/lizenz.ts` | neutrale Aussagen zu Preis, Wartung, Übertragbarkeit, Escrow und EU-Verarbeitung – geschäftliche Zusagen entscheidet der Auftraggeber, im Produkt stehen keine erfundenen Zahlen |
| `mitEinheit`, `schuetzeKennzahlen` | `src/lib/typografie.ts` | Zahl und Einheit untrennbar („26 €/Std.“, „≈ 47.500 €“) |

### 4.6 Weitere Helfer

- `fristenrechnerLink(regelKey, ereignis?, akteId?, herkunft?)` (`src/ai/assistent.ts`): Deep-Link in den Fristenrechner mit `ereignis=` – für Assistent und Posteingang.
- `findeAkte(text, data, hinweise?, absender?)` (`src/ai/dokumentAnalyse.ts`): Akte zu einem Text finden – über Gerichtsaktenzeichen, Aktenzeichen, Beteiligte und die **Absenderadresse**; liefert Akte, Sicherheit und Grund („erkannt über Absenderadresse …“).
- `useDunkelModus()` (`src/lib/useDunkelModus.ts`): Dunkelmodus nach `data-theme`, sonst Systemeinstellung – dieselbe Regel wie die CSS-Selektoren.
- `bewegungReduzierenAnwenden()` (`src/lib/bewegung.ts`) und `useBewegungReduziert()`: „Bewegung reduzieren“ auch für motion-Animationen (springt sofort ans Ziel).

## 5. Bedienung und Barrierefreiheit

Ziel ist WCAG 2.2 AA: axe-core ohne „serious“ und „critical“ in Hell, Dunkel, 320 px, 200 % und am iPhone.

### 5.1 Kopfleiste und Touch-Ziele

- **Kopfleiste:** Knöpfe am Telefon 44 × 44 px (`max-sm:!size-11`); unter 360 px Breite 40 px, damit der Seitentitel ganz sichtbar bleibt; bei geringer Höhe (≤ 520 px, z. B. 200 % Zoom) kompakt mit 36 px. Die Kopfleiste wird deckend, sobald Inhalt darunter durchläuft.
- **Mindestgrößen:** Bedienelemente am Telefon mindestens 44 × 44 px, sonst mindestens 24 × 24 px (WCAG 2.5.8). Kleine sichtbare Elemente bekommen eine größere Trefferfläche über Polster – z. B. Kontrollkästchen in `DataTable` und E-Akte (sichtbar 18 px, getroffen 44 × 44 px am Telefon, 24 × 24 px ab `sm`) oder der Schließknopf der Apex Island (24 × 24 px).
- **Mobil:** Aktionen gehören in den Daumenbereich (z. B. die Aktionsleiste „Notiz · Frist · Wiedervorlage“ in der Akte, sobald der Kopf weggescrollt ist). Statusangaben in Chips mindestens 12 px.

### 5.2 Dialoge und Fokus

`Modal`, `Drawer` und `confirmDialog` setzen die Regeln selbst um – eigene Dialoge immer darauf aufbauen:

- **Fokusfalle:** Tab und Umschalt+Tab bleiben im obersten Dialog; der App-Hintergrund (`#app-inhalt`) und tiefere Dialoge sind solange `inert`. Beim Sperrbildschirm ruhen die Fokusfallen.
- **Anfangsfokus:** zuerst ein Element mit `data-autofocus`, sonst (Modal) das erste Eingabefeld, sonst der Inhaltsbereich. Im `Drawer` ohne Markierung der Inhaltsbereich.
- **Rückfragen (`confirmDialog`):** Anfangsfokus immer auf der sicheren Wahl („Abbrechen“ bzw. `abbrechen`), der Bestätigungsknopf ist der nächste Tab-Stopp. Damit gilt überall: Enter = abbrechen, Tab + Enter = bestätigen.
- **Schließen:** Esc schließt immer nur die oberste Ebene; der Fokus kehrt auf das auslösende Element zurück.
- **Formulare:** Pflichtmeldungen erscheinen erst nach dem ersten Speicherversuch, nicht schon beim Tippen. Nach einem vergeblichen „Weiter“ gehört der Fokus auf das erste fehlerhafte Feld (so umgesetzt in der Mandatsaufnahme).
- **Meldungen (Toasts)** weichen offenen Dialogen und der fokussierten Zeile aus und verdecken nie Kopf, Inhalt oder Schließen.

### 5.3 Kontrast-Tokens

Die Tokens in `src/styles/index.css` sind auf ≥ 4,5 : 1 ausgelegt – auch auf dünnem Glas über dem farbigen Arbeitsgrund:

| Token | Verwendung |
|---|---|
| `--fg`, `--fg-2` | Haupt- und Fließtext |
| `--fg-3`, `--fg-4` | Neben- und Metatext (hell: auf Glas ≥ 5,6 : 1 bzw. ≥ 4,9 : 1) – kein helleres Grau verwenden |
| `--seal-text`, `--amber-text`, `--green-text` | **Schrift** in Status-Chips auf der zarten Tönung (`--seal-soft` usw.) – dunkler als die Signalfarbe selbst |
| `--seal`, `--amber`, `--green`, `--violet` | Signalfarben für Punkte, Symbole, Ränder und Flächen |
| `--ink-fill`, `--ink-fill-top` mit `--on-ink` | Fläche der Primärknöpfe mit weißer Schrift (≥ 4,5 : 1 auch im Dunkelmodus, wo `--ink` selbst zu hell wäre) |
| `--on-green` | Schrift und Häkchen auf vollflächigem `--green` (hell weiß, dunkel fast schwarz) – nie `text-white` |
| `--focus` | Fokusring (`:focus-visible`, 2 px), in beiden Modi sichtbar |

Dunkelmodus: Die Werte werden unter `@media (prefers-color-scheme: dark)` (ohne `data-theme="light"`) und unter `:root[data-theme="dark"]` gesetzt. Dokumentvorschauen (`.paper`) sind im Dunkeln leicht abgedunkelt (`PapierSchalter`).

### 5.4 Tastenkürzel

- **Regeln** (`src/lib/tastatur.ts`): Einzeltasten-Kürzel lösen nur aus, wenn `einzeltasteErlaubt(e)` – nicht in Eingabefeldern (`istEingabeElement`), nicht bei offenem Dialog, Menü, Suche, Assistent oder Sperre (`dialogOffen`) und nur, solange die Einstellung „Kürzel mit einzelnen Buchstaben“ an ist (WCAG 2.1.4). Alt-Varianten (`altKuerzel`, wertet `e.code` aus – auch am Mac) wirken immer, auch in Eingabefeldern, nur nicht bei offenem Dialog.
- **Listen** (`src/components/shell/Tastenkuerzel.tsx`): `TASTATURKUERZEL` (global), `POSTEINGANG_KUERZEL`, `FRISTEN_KUERZEL`. Neue Kürzel dort eintragen – die Übersicht unter **?** und die Strg+K-Aktionen lesen daraus.

| Kürzel | Wirkung |
|---|---|
| Strg+K / ⌘K | Globale Suche und Aktionen |
| W / Alt+W | Wiedervorlage anlegen (in einer Akte für diese Akte) |
| F / Alt+F | Fristenrechner öffnen |
| Z / Alt+Z | Zeit erfassen |
| ? | Übersicht der Tastaturkürzel |
| Esc | oberste Ebene schließen |
| Posteingang: J / K, Enter, U, E | nächste / vorige Nachricht, öffnen, Vorschlag übernehmen (mit Fristvorschlag: Fristen samt Akte; ohne: Akte zuordnen; sonst nennt eine Meldung den Grund), eEB-Dialog |
| Fristen: J / K (↓ / ↑, Alt+J / Alt+K), Enter, B / Alt+B | nächste / vorige Frist, Details, Vier-Augen-Kontrolle bestätigen |

- Der erste Tab-Stopp jeder Seite ist „Zum Inhalt springen“. Tabellenzeilen (Akten, Rechnungen) öffnen auch per Tastatur.

## 6. Qualität

- Qualitätstor vor jedem Commit: `npm run typecheck && npm test && npm run build`. Neue Fachlogik bekommt Tests in `src/core/*.test.ts`; Tests, die an Zählwerten der Demodaten hängen, nach einer Änderung von `SEED_VERSION` prüfen.
- Sichtprüfung: Dev-Server läuft auf `http://127.0.0.1:5173`. Screenshots: `node scripts/shot.mjs http://127.0.0.1:5173 <ordner> /route1,/route2 [--mobile] [--dark] [--full] [--login=email]` (Standard-Login: Hartmann & Partner).
- Keine `alert/confirm/prompt`, keine `window.open`, keine Downloads per `<a download>` (in eingebetteten Ansichten gesperrt) – stattdessen Vorschau-Dialoge bzw. „In Zwischenablage kopieren“ (mit try/catch).
- Keine externen Requests (Bilder, Fonts, APIs) – alles lokal. Datenschutz (§ 203 StGB) ist ein Verkaufsargument.
- Prüfmatrix für jede neue Ansicht: Hell und Dunkel, 1440 px, 390 px und 320 px (kein Querscrollen), 200 % Zoom, nur Tastatur, „Bewegung reduzieren“; axe-core ohne „serious“ und „critical“.
- Dateiausgaben (.ics, SEPA, XRechnung, Datenauskunft) laufen über den Vorschau-Dialog aus `src/pages/fristen/dateiAusgabe.tsx` („Datei speichern“ und „In Zwischenablage kopieren“).

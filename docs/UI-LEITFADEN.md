# AnwaltApex – UI- & Entwicklungsleitfaden

Dieser Leitfaden gilt für alle, die an der Web-App bauen. Ziel: **ein** konsistentes Produkt im Stil von Apple Liquid Glass – minimalistisch, ruhig, präzise, mit sinnvollen Animationen.

## 1. Designprinzipien

1. **Glas für Steuerung, ruhige Flächen für Inhalt.** Navigation, Leisten, Popover, Dialoge = Glas (`.glass`, `.glass-strong`). Lesbarer Inhalt (Tabellen, Texte, Formulare) liegt auf `Card` (`.sheet`) – fast opak, gute Lesbarkeit.
2. **Eine klare Aktion pro Bereich.** Primärbutton (`variant="primary"`) sparsam einsetzen, sonst `secondary`/`ghost`. KI-Aktionen bekommen `variant="ai"` (irisierender Verlauf) – nur für echte KI-Funktionen.
3. **Jede Funktion klar benannt und erklärt.** Seitentitel über `<PageHeader title subtitle hilfe>`; `subtitle` erklärt in einem Satz, was der Bereich tut. `hilfe` = Wiki-Schlüssel aus `src/content/wiki.ts` (öffnet die animierte Schnellhilfe).
4. **Zustand in Form, nicht nur in Zahlen.** Status als `Chip` (tone `seal` = kritisch/Notfrist, `amber` = bald, `green` = erledigt/ok, `ink` = Info, `violet` = KI). Fristen-Ampel: `fristDringlichkeit()` aus `@/core/fristen`.
5. **Bewegung mit Sinn.** `motion/react` für Ein-/Ausblenden (Spring: `stiffness 420–520, damping 32–38`), Listen leicht gestaffelt (`delay: i * 0.03`, max. ~10 Elemente staffeln), `layoutId` für gleitende Auswahlindikatoren. Nichts darf im Ruhezustand unsichtbar bleiben. `prefers-reduced-motion` wird global respektiert.
6. **Responsiv ab 360 px.** Grids mit `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` o. ä.; Kind-Elemente mit Text `min-w-0`; Tabellen über `DataTable` mit `mobileRow` (Kartenliste auf dem Smartphone). Unten 96 px Platz für die schwebende Tab-Leiste ist im Layout bereits eingeplant.
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

CSS-Klassen: `title-xl`, `title-lg`, `title-md`, `eyebrow`, `mono` (Aktenzeichen, Beträge), `num` (tabellarische Ziffern), `prose-apex` (Fließtext/Schriftsätze), `paper` (Dokumentvorschau), `ai-ring`, `ai-text`, `ai-fill`, `shimmer` (Ladeplatzhalter), `bar` (Fortschritt), `kbd`.

Farben nur über Tokens (`text-fg`, `text-fg-2/3/4`, `bg-surface`, `bg-ink-soft`, `text-ink`, `text-seal`, `bg-seal-soft`, `text-amber`, `bg-amber-soft`, `text-green`, `bg-green-soft`, `text-violet`, `bg-violet-soft`, `border-[var(--line)]`). **Keine festen Hex-Farben** in Komponenten (Ausnahme: Kanzlei-/Personenfarben aus den Daten). Hell- und Dunkelmodus müssen beide funktionieren.

Icons: `lucide-react`, Größe `size-4` (16 px) in Buttons, `size-[18px]` in Navigation.

## 3. Daten & Logik

- Daten der angemeldeten Kanzlei: `useData((s) => s.data.akten)` bzw. `useCol("akten")`. Ändern: `useData.getState().upsert(col, doc)`, `.patch(col, id, partial)`, `.remove(col, id)`. Persistenz (Browser oder Server) passiert automatisch.
- Aktivität protokollieren (füttert Cockpit & 38h-Motor): `useData.getState().log({ akteur: "nutzer" | "ki" | "automation", text, akteId?, userId?, minutenGespart?, automationKey? })`.
- Sitzung: `useKanzlei()` aus `@/store/session` → `{ user, tenant, team }`. Bundesland für Fristen: `tenant.bundesland`.
- Neue IDs: `uid("f")` aus `@/core/dates`; Zeitstempel `nowLocal()`; heute `today()`.
- Formatierung: `fmtDate`, `fmtDateWd`, `fmtDateLong`, `fmtDateShort`, `relDays`, `relTime`, `fmtEUR`, `fmtNum` aus `@/core/dates`.
- Fachlogik (`@/core/…`): `fristen.ts` (Fristenrechner mit Rechenweg, `FRIST_REGELN`, `fristDringlichkeit`), `feiertage.ts`, `rvg.ts` (`berechneRvg`, `VV_KATALOG`, `wertgebuehr`, Fassung 2025/2021), `zinsen.ts` (`forderungskonto`, `verzugszinsen`, `BASISZINS`), `search.ts` (`search`, `snippet`), `rechtsprechung.ts` (`ENTSCHEIDUNGEN`), `automationen.ts`.
- KI (`@/ai/…`): `analysiereNachricht`, `analysiereDokument`, `beispielDokumente` (Posteingang/Dokumente), `analysiereFall` (Fallanalyse), `llmText`/`llmJson` (freie Generierung; wirft `DemoModus` im Demo-Betrieb → dann Offline-Text verwenden), `useAiStatus` (Quelle: server/artefakt/demo). **Grundsatz: Die KI erkennt, der Fristenrechner berechnet.**
- Navigation: `useNavigate()` aus `react-router`; Query-Parameter mit `useSearchParams()`.
- Assistent öffnen: `useUI.getState().oeffneAssistent("Frage …")`. Schnellhilfe: `useUI.getState().zeigeHilfe("fristen")`.

## 4. Qualität

- `npx tsc --noEmit` muss fehlerfrei sein.
- Sichtprüfung: Dev-Server läuft auf `http://127.0.0.1:5173`. Screenshots: `node scripts/shot.mjs http://127.0.0.1:5173 <ordner> /route1,/route2 [--mobile] [--dark] [--full] [--login=email]` (Standard-Login: Hartmann & Partner).
- Keine `alert/confirm/prompt`, keine `window.open`, keine Downloads per `<a download>` (in eingebetteten Ansichten gesperrt) – stattdessen Vorschau-Dialoge bzw. „In Zwischenablage kopieren“ (mit try/catch).
- Keine externen Requests (Bilder, Fonts, APIs) – alles lokal. Datenschutz (§ 203 StGB) ist ein Verkaufsargument.

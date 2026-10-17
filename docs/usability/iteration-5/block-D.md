## Iteration 5 – Feedback Claudia Reinholz · Block D („Umzug, mobil, abends, Assistent & ReFa“)

**Datum:** Sa, 17.10.2026, ca. 10:02–10:38 Uhr Ortszeit (Systemuhr 08:02–08:38 UTC) · **Betriebsmodus:** Browser-Demo („Demo-Modus: Ihre Änderungen bleiben in diesem Browser gespeichert“, Demo-KI offline, `/api/info` 500) · **Browser:** Chromium (Playwright, `de-DE`, Europe/Berlin; Datumsfelder im US-Format → Testumgebung, kein Befund, I1-T07-07) · **Testleitung:** Avatar-Werkzeug, frisches Profil `i5-D` · **Zugänge:** Dr. Julia Hartmann (T11, T14, T15, T18, T20), Mia Becker (T22)

**Schwerpunkt Iteration 5:** Abnahme und Kaufentscheidung, Viewports wie je Aufgabe vorgegeben, Standard **hell**, T15 **dunkel**. axe-core je Ansicht.

| Aufgabe | Viewport · Modus | Zusatzproben |
|---|---|---|
| T11 | D · hell | Beispiel-Export und eigene Windows-1252-Datei, Rückgängig ausgeführt |
| T14 | M · hell | Bedienflächen gemessen, Notiz und Widerrufsfrist angelegt |
| T15 | L · dunkel | Nachtest I4-T15-03 bei 200 % (720×450 @2x, dunkel); Testfrist für den Nachtest I4-T15-01/-02 |
| T18 | D · hell | Fälle 1, 2 (BE/NW), 3a, 4, 5 (Abwesenheit mit Beginn in der Zukunft) |
| T20 | D + M · hell | Doppelungsprobe, Rückgängig, Mehrdeutigkeitsprobe „Meyer“, Mikrofon ohne Gerät |
| T22 | L · hell | als Mia Becker, Tastatur: J/K, Enter, U, E, W |

> Eine einzige simulierte Person: SUS, UEQ-S und Noten sind **Trendwerte**.

> **Uhrzeit:** Wieder Samstagvormittag, also außerhalb der Servicezeit. Die Abendsituation von T15 (Werktag, 21:30 Uhr) und den Termintag von T14 (Di 20.10.) kann das Werkzeug nicht einstellen. Die Ausgangskontrolle habe ich über „Heute“ mit einer überfälligen Testfrist und über „Nächster Arbeitstag (Mo, 19.10.)“ geprüft, die Widerrufsfrist mit dem Ereignisdatum 20.10. eingetragen.

> **Werkzeughinweis (kein Befund):** Das Werkzeug lädt die Seite bei jedem Aufruf neu. Abschlussbildschirm des Umzugs, Assistent-Verlauf und offene Dialoge gehen dabei verloren; zusammenhängende Abläufe habe ich deshalb in einem Aufruf ausgeführt. Offline-Emulation und WebKit bietet das Werkzeug nicht.

---

### Nachtest Vorrunde (alle umgesetzten Befunde meiner Aufgaben)

| Befund-ID | S | Status | Beobachtung im Nachtest |
|---|---|---|---|
| I4-T11-01 | M | **behoben** | Umzug, Karte „Lena Vogt“ am Samstag 10:05 Uhr: „nicht erreichbar – wieder Mo, 19.10. ab 7:30 Uhr“, Durchwahl und Servicezeit daneben; der Untertitel „begleitet Ihren Umzug persönlich“ steht ganz da (D hell). |
| I4-T11-02 | N | **teilweise** | Vorschau, Kachel, Meldung und aktiver Protokolleintrag zählen jetzt einheitlich „2 Fristen und 1 Wiedervorlage“. Nach „Rückgängig machen“ schreibt derselbe Protokolleintrag aber wieder „3 Fristen und Wiedervorlagen“ → Rest als **I5-T11-01**. |
| I4-T14-01 | M | **behoben** | Akte 151/26 am iPhone: unten nur noch die Tab-Leiste mit Kugel; Meldungen erscheinen oben („Frist eingetragen …“) und verdecken weder Gericht noch Termin. Folge der Lösung: Notiz und Frist sitzen jetzt nur noch im Aktenkopf → **I5-T14-01**. |
| I4-T14-02 | N | **behoben** | „Letzte Dokumente“: Kündigungsschreiben, Klageschrift und Ladung als „Kerndokument“ oben, „6 Dokumente in der E-Akte · E-Akte öffnen“. |
| I4-T15-01 | M | **behoben** | Testfrist „Frei bestimmte Frist“ in 131/26 mit Grund „Fehleintrag – falsche Dauer“ gestrichen, danach dieselbe Fristart neu gewählt: kein Ereignis-Vorschlag mehr aus der gestrichenen Frist, das Ereignisfeld bleibt leer (L dunkel). |
| I4-T15-02 | M | **behoben** | Einheit ist nicht vorbelegt („Einheit wählen …“, auch bei der Widerrufsfrist). Ereignis 05.10. + 2 Tage: „Das Fristende (Mi, 07.10.2026) liegt in der Vergangenheit – trotzdem eintragen? Das wird protokolliert.“ „Frist übernehmen“ bleibt gesperrt, bis ich „Trotzdem eintragen (wird protokolliert)“ wähle. |
| I4-T15-03 | N | **behoben** | 200 % (720×450 @2x) dunkel, Fristen gescrollt: Die Kopfleiste klappt ein, fest bleibt nur die Tab-Leiste mit 44 von 450 px (≈ 9,8 %). Neu: Die kompakte Leiste zeigt nur Symbole → **I5-T15-01**. |
| I4-T18-01 | N | **behoben** | Gesperrter Knopf „Als Frist in Akte eintragen“ als neutraler Umriss, Grund darunter („Erst die Fristart wählen und eine Akte wählen“, später „Erst eine Akte wählen“) (D hell). |
| I4-T18-02 | N | **behoben** | Fall 1: Der Kalender zeigt Januar, **Februar** (28. als „rechnerisches Ende (kein Werktag)“ markiert) und März 2027. |
| I4-T18-03 | N | **behoben** | Der Rechner öffnet ohne Vorwahl: „Bitte die Fristart wählen“. |
| I4-T18-04 | M | **behoben** | Abwesenheit Jonas Brandt **19.–30.10.** am Sa 17.10. eingetragen: Dialog „Abwesenheit eingetragen … Im Zeitraum: 4 Fristen“ mit Liste; Cockpit-Briefing „Vertretung ab Mo, 19.10.: Sie vertreten Jonas Brandt bis Fr, 30.10. – 4 Fristen im Zeitraum, die erste Mo, 19.10.: Replik auf Klageerwiderung (137/26)“; „Fristen ansehen“ zeigt die Fristen vorab mit Chip „Vertretung für Jonas Brandt ab Mo, 19.10.“ (D hell, axe 0). |
| I4-T20-01 | N | **behoben** | Zweite WV für 137/26 am Di 20.10.: Karte „Doppelung? Für 137/26 liegt am Di, 20.10. schon eine Wiedervorlage: ‚Sachstand beim Gericht nachfragen‘ … Eintragen nur, wenn Sie bewusst einen zweiten Eintrag möchten“, Knopf „Trotzdem eintragen“. |
| I4-T22-01 | N | **behoben** | (zusammengeführt mit I4-T03-03) „Zur eEB-Abgabe vorlegen“ öffnet keinen zweiten Dialog mehr; die Meldung „eEB zur Abgabe vorgelegt – Dr. Julia Hartmann hat eine Wiedervorlage für heute“ steht unten rechts frei. Auch der WV-Dialog (Taste W) wird von keiner Meldung überdeckt. |
| I1-T07-07 | N | **nicht prüfbar** | Datumsfelder weiter `mm/dd/yyyy` – Sprache der Chromium-Testumgebung, kein Produktbefund. |

**Ergebnis Nachtest:** 14 IDs geprüft · **12 behoben · 1 teilweise** (I4-T11-02 → I5-T11-01) · **1 nicht prüfbar** (I1-T07-07) · **0 nicht behoben**.

---

### Aufgaben

| Aufgabe | Ergebnis | Erfolgskriterium (Messwert) | Prüfpunkte x/y | Aktionen/Soll | Fehlaktionen | fachlich korrekt | SEQ | O-Ton |
|---|---|---|---|---|---|---|---|---|
| **T11** Umzug aus RA-MICRO (D hell) | erledigt | **erfüllt:** „Windows-1252“ erkannt, **0 Zeichenfehler** (Müller, Böhm, Weiß, Fördertechnik, Hans-Jörg Krüger, Ayse Özdemir, Bärbel Schäfer, Großmann – in Vorschau, Fristenliste und Volltextsuche). Dublette „Zeile 4: 14/26 … gleicht Zeile 2 (12/26) – auch die Frist 30.10.2026 ist gleich und wird nur einmal angelegt“ **vor** dem Import. Notfrist 30.10. und Verjährung 31.12. „Aus Umzug · Vier-Augen-Kontrolle offen“, die WV 06.11. als Wiedervorlage | 7/7 | a) 4 · b) 9 · Rückgängig 2 = **15** (Soll ≈ 16) | 0 | ja: „11.400,00“ → 11.400,00 €, „30.10.2026“ → Fr 30.10.2026, Vorfrist 23.10. bzw. 24.12. (eine Woche), 2.180,50 €; Grenze „Abgeschlossen 2020 oder später“ (§ 50 Abs. 1 BRAO: 6 Jahre ab Ende des Jahres der Beendigung → 2020 endet am 31.12.2026); Kontakte 8 = 4 Mandanten + 4 Gegner | 6 | „Umlaute heil, Dublette vorher gemeldet, Rückgängig mit Namen im Protokoll. So will ich einen Probelauf.“ |
| **T14** Mobil am Gericht (M hell) | erledigt | **erfüllt:** Akte in **2 Taps** (Akten, 151/26). Sitzungsnotiz und Widerrufsfrist in **9 Aktionen** (Notiz 3, Frist 6). Kein Querscrollen | 3/4 prüfbar + 1 Zählwert, Netzprobe nicht prüfbar | 2 + 9 (Soll ≤ 3 + ≤ 10) | 0 | ja: Widerruf 2 Wochen ab Di 20.10.2026 → **Di 03.11.2026** (§§ 187 Abs. 1, 188 Abs. 2 BGB), Vorfrist Fr 30.10.; Rechenweg nennt „Ende am gleichnamigen Wochentag (Dienstag)“ | 6 | „Termin, Saal, Az. und Gegenseite auf einen Blick, das Kündigungsschreiben lese ich ohne Zoom. Aber für die Notiz muss ich nach dem Lesen wieder ganz nach oben.“ |
| **T15** Dunkelmodus abends, Tagesabschluss (L dunkel; 200 % dunkel) | erledigt | **erfüllt:** Ausgangskontrolle „Heute“ (Sa 17.10.) mit Testfrist: „überfällig seit 07.10.2026 · offen – noch kein Versandnachweis“; nach Streichen mit Grund „Heute keine fälligen Fristen“. „Nächster Arbeitstag (Mo, 19.10.)“: **3 offen · 0 versandt mit Nachweis**, jede Zeile „offen – noch kein Versandnachweis“ → **0 ohne Kennzeichnung** | 6/6 | 4 (Posteingang, Fristen, Ausgangskontrolle, Nächster Arbeitstag) · Testfrist 9 + Streichen 4 | 0 | ja: „Erledigt“ nur mit Nachweis oder Grund; Rückfrage bei abgelaufenem Fristende; Grund protokolliert, „Rückgängig“ angeboten. Fachlich unsauber: Vorfrist vor dem Ereignis (I5-T15-02) | 6 | „Um diese Zeit kann ich das lesen, und die Liste sagt mir für jede Frist ‚offen‘ oder ‚versandt‘. Dass mir das Programm für eine Zwei-Tages-Frist eine Vorfrist vor der Zustellung vorschlägt, ist Unsinn.“ |
| **T18** Fristenrechner Fälle 1, 2, 3a, 4, 5 (D hell) | erledigt | **erfüllt** für **5 von 5** Daten dieses Blocks (Fall 3b läuft in Block A): **01.03.2027** · **30.03.2027** · **09.03.2027** [BE, Kammergericht] · **08.03.2027** [NW, OLG Hamm] · **08.03.2027** [3a, OLG Brandenburg]. Rechenweg jeweils mit Norm und benanntem Feiertag | 4/4 | Fall 1: 5 · Folgefälle je 2–3 · Fall 5: 10 + Cockpit 1 + „Fristen ansehen“ 1 | 0 | ja: „rechnerisch 29.02.2027 – diesen Tag gibt es nicht → Monatsletzter So, 28.02.“ → Mo 01.03.; „Mo, 29.03.2027 ist Ostermontag (Berlin) → nächster Werktag Di, 30.03.2027“; „08.03.2027 Internationaler Frauentag – in Berlin Feiertag, in Brandenburg (Gerichtsort) nicht – keine Verschiebung“. Fall 4: § 63 Abs. 1, § 63 Abs. 2, § 117 Abs. 1 S. 3 FamFG vorhanden; Probe Bekanntgabe Fr 15.01.2027 → Mo 15.03.2027 mit § 16 Abs. 2 FamFG | 7 | „Fünf von fünf, Ostermontag und Frauentag beim Namen, und die Vertretung sehe ich jetzt am Samstag davor. Da habe ich nichts mehr.“ |
| **T20** Apex Assistent (D + M hell) | erledigt | **erfüllt:** **5/5** Befehle richtig. WV aus Befehl 2 im Fristenkalender als „Durch Assistent angelegt“ (137/26, Di 20.10.2026); Rückgängig in der Karte ausgeführt: „Wieder entfernt – im Protokoll vermerkt“ | 4/4 prüfbar, Safari/WebKit nicht prüfbar | 13 (5 × Tippen + Enter, Titel-Rückfrage 2, Eintragen 1) | 0 | ja: 1) „Diese Woche (bis So, 18.10.2026) ist keine Frist mehr offen, nur eine Wiedervorlage“ + Ausblick 7 Tage „6 Fristen … und 12 Wiedervorlagen“ = Fristenseite (0 Abweichungen). 2) Sa 17.10. + 3 = Di 20.10.2026, Werktag. 3) „Müller“: nur eine Akte (101/26) im Bestand → direkt geöffnet; Gegenprobe „Meyer“ → „Zu ‚Meyer‘ passen 2 Akten. Welche soll ich öffnen?“, „Schmidt“ → klare Meldung. 4) Wiki-Antwort mit „Bankabgleich öffnen“. 5) Lena Vogt, Durchwahl, „jetzt nicht erreichbar – Rückruf frühestens Mo, 19.10.2026 ab 7:30 Uhr“, Rückruf auf „Ja, bitte“ angefordert („im Prototyp simuliert“) | 6 | „Er fragt nach dem Titel, warnt vor der Doppelung und sagt ehrlich, dass Frau Vogt am Samstag nicht da ist. Dass er gleichzeitig ‚Ich höre zu‘ und ‚Kein Mikrofon‘ anzeigt, ist schlampig.“ |
| **T22** Petras Vormittag, als Mia Becker (L hell, Tastatur) | erledigt | **erfüllt:** Die ReFa kann das eEB nicht abgeben: „Das eEB gibt die Anwältin bzw. der Anwalt selbst ab – ohne qualifizierte elektronische Signatur nur über den eigenen sicheren Übermittlungsweg (§ 173 Abs. 3 ZPO). Sie bereiten vor und legen vor.“ Petras Urteil „ohne Schulung machbar“: **5 von 5** | 4/4 | 24 (Zuordnen von 3 Nachrichten 10 inkl. Filter „Ohne Akte“ und 1 Fehlaktion, Fristen 0 – beim Übernehmen mit U notiert, eEB vorlegen 3, WV per W 3 + 1 Fehlaktion, Sammelabrechnung 4, Bankabgleich 3) | 2 (Zuordnen: Taste U bei einer Nachricht ohne Frist – nichts passiert; WV-Dialog: Tab vor dem Tippen) | ja: Berufung ab Eingang Sa 17.10. → **Di 17.11.2026**, Begründung → **Do 17.12.2026** (Vier-Augen-Kontrolle offen). RVG-Stichprobe 151/26 (11.700 €, KostBRÄG 2025, Stufe bis 13.000 € = 707 €): 1,3 × 707 € = 919,10 € + 20 € = 939,10 € + 19 % = **1.117,53 €** (RSV 967,53 € + SB 150 €) – stimmt | 6 | „Als Frau Schulte: Zuordnen mit einem Klick, E und W wie gewohnt, und dass ich das eEB nur vorlegen darf, steht mit Paragraf da. Für ‚Zuordnen‘ hätte ich aber gern ein Kürzel.“ |

**Prüfpunkte im Einzelnen**

- **T11 (7/7):**
  - Vorschau vor dem Import: ja (erste Zeilen der Datei, Zuordnung der Spalten, „Vorschau · so werden die Akten angelegt“).
  - 11.400,00 € und 30. Okt.: ja.
  - 87/18 ausschließen oder als Archiv: ja. Drei Umfangs-Optionen; bei „Offene + abgeschlossene der letzten 6 Jahre“ wird 87/18 „abgeschlossen ohne Datum“ mit „Übernehmen (ruhend) · Als Archiv · Auslassen“ vorgelegt, „Übernahme starten“ bleibt bis zur Entscheidung gesperrt („nichts wird still ausgelassen“).
  - Was nicht übernommen wird: ja („Kommt nicht mit“: FiBu, Zugangsdaten, Programmeinstellungen; „Gemeinsam mit Lena Vogt“: Dokumente, Aktenkonten/offene Posten/Fremdgeld, Benutzer, beA-Postfach).
  - Rückgängig: ja, ausgeführt. Dialog nennt die Folgen („auch Fristen, Dokumente und Notizen, die seitdem in diesen Akten angelegt wurden“); danach „Der Datenbestand entspricht wieder dem Stand vor diesem Lauf“, Vier-Augen-Kontrolle wieder 6, Protokoll „rückgängig am 17.10.2026 von Dr. Julia Hartmann“.
  - Ansprechpartnerin und Zeitplan: ja (Probelauf → Parallelbetrieb → Umschalten, „Termin mit Lena Vogt vereinbaren“).
- **T14 (3/4 + Zählwert):**
  - Termin, Gericht, Az., Gegenseite, letzte Schriftsätze: 5/5 (Kopf und „Letzte Dokumente“).
  - Kündigungsschreiben ohne Zoom lesbar: ja (Serifenschrift, ruhige Papierfläche).
  - Wichtigste Bedienelemente im unteren Drittel: **nein** – Notiz, Frist und WV liegen im Aktenkopf bei y ≈ 405–460 von 844 px und verschwinden beim Scrollen (I5-T14-01).
  - Bedienflächen unter 44 px: **2** (Sprunglink „Zum Inhalt springen“ 32×16 px, erscheint nur bei Fokus; Kontrollkästchen „Alle auswählen“ in der E-Akte 18×18 px, I5-T14-02); unter 24 px: dieselben 2. axe meldet keinen `target-size`-Verstoß.
  - Netzprobe: nicht prüfbar (keine Offline-Emulation im Werkzeug). Im Browser-Demo-Betrieb liegen Notizen ohnehin lokal.
  - Termin in den Kalender: ja („In Kalender (.ics)“ direkt am Termin).
- **T15 (6/6):**
  - axe: 0 serious / 0 critical in allen dunklen Ansichten (Tabelle unten).
  - Keine grellen Flächen: ja; Dokumentvorschau gedimmt, umschaltbar „Seite abdunkeln · Original“.
  - Notfrist-Rot unterscheidbar: ja, mit Schild-Symbol und Text „Nicht verlängerbar“.
  - Fristen für morgen in ≤ 2 Aktionen: ja (0 im Cockpit „Heute & Montag fällig“, 2 in der Ausgangskontrolle).
  - Drucken: ja, zweimal (Kopf der Fristenseite und in der Ausgangskontrolle).
  - 1366×768: bricht nicht, volles Desktop-Layout.
- **T18 (4/4):**
  - Gerichtsort wählbar und im Ergebnis genannt: ja („Feiertage: Brandenburg (Gerichtsort: OLG Brandenburg)“, Bundesland „aus dem Gericht abgeleitet“, Abweichen nur bewusst).
  - Feiertag beim Namen: ja (Ostermontag, Internationaler Frauentag).
  - Fall 4: ja (drei FamFG-Regeln).
  - Fall 5: ja, **vorab** (siehe Nachtest I4-T18-04).
- **T20 (4/4 prüfbar):**
  - Text ohne Mikrofon: ja.
  - Ton und Avatar in je 1 Klick abschaltbar („Sprachausgabe ausschalten“, „Assistent-Kugel an den Rand einklappen“): ja. Siezt: ja.
  - M (Chromium, 390×844): ja, Verlauf und Eingabe ohne Querscrollen, axe 0. Safari/WebKit: nicht prüfbar.
  - Mikrofon-Knopf vorhanden, Meldung ohne Gerät: „Kein Mikrofon gefunden oder Zugriff verweigert. Bitte tippen Sie Ihre Frage – oder erlauben Sie das Mikrofon in der Adressleiste.“ (dazu I5-T20-01).
- **T22 (4/4):**
  - Lizenz- und Teamdaten für die ReFa nicht sichtbar: ja (Reiter nur „Kanzlei · Ihr Zugang · KI · Darstellung · Datenschutz“, kein Lizenzkasten in der Seitenleiste; unter Stammdaten steht nur „Lifetime-Lizenz · 8 Arbeitsplätze“).
  - Kürzel für die WV vorhanden und angezeigt: ja („Taste W bzw. Alt+W · Enter trägt ein, Esc bricht ab“; „Wiedervorlage W“ auf der Fristenseite). Akte aus der geöffneten Nachricht wird übernommen („Akte aus der geöffneten Nachricht“).
  - Fehlaktionen je Teilaufgabe: 1 / 0 / 0 / 0 / 0 (dazu 1 bei der WV).
  - Lesbar ohne Zoom: ja.

---

### Befunde

Keine K- und keine H-Befunde in diesem Block. **M 1 · N 7.**

**[I5-T14-01] [M] [Akte 151/26 · M (390×844) · hell] Mobil**

- **Schritte:** Akten → 151/26 → nach unten zu „Letzte Dokumente“ scrollen → Kündigungsschreiben lesen → Notiz anlegen wollen.
- **Beobachtung:**
  - Seit I4-T14-01 gibt es unten keine Schnellaktionsleiste mehr; das Überdecken ist weg.
  - „Notiz“, „Frist“ und „Wiedervorlage“ stehen nur noch im Aktenkopf, bei y ≈ 405–460 von 844 px, also im mittleren Drittel.
  - Nach dem Lesen der Dokumente sind sie weggescrollt; für die Sitzungsnotiz muss ich erst wieder ganz nach oben. Der Prüfpunkt „wichtigste Bedienelemente im unteren Drittel, einhändig“ ist damit nicht mehr erfüllt.
- **Erwartung:** Notiz, Frist und WV sind am iPhone jederzeit mit dem Daumen erreichbar, ohne Inhalte zu verdecken.
- **Vorschlag:** Ein einzelner „+“-Knopf in der Tab-Leiste bzw. neben der Kugel mit „Notiz · Frist · Wiedervorlage“ für die geöffnete Akte – oder ein schmaler, beim Scrollen eingeblendeter Aktenkopf mit diesen drei Aktionen. Meldungen bleiben oben.
- **Beleg:** [Bild](bilder/block-D-T14-widerrufsfrist-meldung-oben-M-hell.jpg) · `src/pages/akten/AkteKopf.tsx`

**[I5-T22-01] [N] [Posteingang · Lesebereich „Erkannte Akte“ · L · hell] Tempo**

- **Schritte:** Als Mia Becker: Nachricht „Thomas Weber – Unterlagen + wichtiger Hinweis zu Herrn Seifert“ öffnen (KI-Vorschlag 142/26, 98 %) → Taste U.
- **Beobachtung:**
  - Beim Urteil (mit Frist) übernimmt U Fristen und Akte, mit Meldung und „Rückgängig“.
  - Bei der Weber-Mail und der Mitteilung der Gerichtsvollzieherin (126/26, 99 %, beide ohne Frist) passiert bei U nichts, auch keine Meldung.
  - Für „Akte zuordnen“, die häufigste Handlung im Posteingang, gibt es kein Kürzel; der Knopf zeigt auch keins.
- **Erwartung:** Petra ordnet per Tastatur zu, und eine Taste ohne Wirkung sagt, warum.
- **Vorschlag:** Kürzel für „Akte zuordnen“ (z. B. Z), am Knopf angezeigt wie „E“ beim eEB. U bei Nachrichten ohne Frist entweder als „zuordnen“ ausführen oder kurz melden: „Keine Frist erkannt – Z ordnet die Akte zu“.
- **Beleg:** `src/pages/posteingang/KiKarte.tsx`, `src/pages/posteingang/Lesebereich.tsx`

**[I5-T20-01] [N] [Apex Assistent · Mikrofon · D · hell] Verständlichkeit**

- **Schritte:** Assistent öffnen → „Per Sprache fragen“ (kein Mikrofon vorhanden).
- **Beobachtung:** Etwa 3 Sekunden lang stehen gleichzeitig die Pegelzeile „Ich höre zu – sprechen Sie einfach.“, der rote (aktive) Mikrofonknopf und die gelbe Meldung „Kein Mikrofon gefunden oder Zugriff verweigert …“. Nach rund 10 Sekunden ist nur noch die Meldung da.
- **Erwartung:** Ein eindeutiger Zustand. Ohne Mikrofon hört der Assistent nicht zu und sagt das sofort.
- **Vorschlag:** Bei Fehler sofort Pegelzeile ausblenden und den Knopf auf „Per Sprache fragen“ zurücksetzen (im Code ist das als Absicht kommentiert, greift aber nicht, wenn die Spracherkennung schon gestartet hat).
- **Beleg:** [Bild](bilder/block-D-T20-mikrofon-ich-hoere-zu-und-fehler-D-hell.jpg) · `src/components/assistant/AssistantDock.tsx` (Kommentar Z. 328, Pegelzeile Z. 658)

**[I5-T15-01] [N] [Fristen · 200 % auf D (720×450 @2x) · dunkel] Verständlichkeit**

- **Beobachtung:** Die kompakte Tab-Leiste (Folge von I4-T15-03) zeigt nur noch Symbole – Raster, Ordner, Ablage mit „2“, Kalender, drei Punkte – ohne „Cockpit, Akten, Post, Fristen, Mehr“. Am iPhone stehen die Wörter darunter.
- **Erwartung:** Gerade wer auf 200 % vergrößert, braucht die Beschriftung. Symbole ohne Text sind für mich und Frau Schulte Raten.
- **Vorschlag:** Beschriftung neben statt unter das Symbol setzen (passt in 44 px Höhe), oder nur die aktive Seite beschriften und die übrigen per Tooltip bzw. `aria-label` – mindestens für „Mehr“ den Text zeigen.
- **Beleg:** [Bild](bilder/block-D-T15-200prozent-tableiste-ohne-beschriftung-dunkel.jpg) · `src/components/shell/MobileTabBar.tsx`

**[I5-T15-02] [N] [Akte 131/26 → Frist anlegen · L · dunkel] Fachlich**

- **Schritte:** „Frei bestimmte Frist“, Ereignis Mo 05.10.2026, 2 Tage.
- **Beobachtung:** Rechenweg „Vorfrist 3 Tage vorher, auf Werktag gelegt: Fr, 02.10.2026“ – die Vorfrist liegt **vor dem fristauslösenden Ereignis**. Sie erscheint anschließend als „1 Vorfrist“ unter „Heute fällig“. Dasselbe passiert bei jeder kurzen Frist, die heute beginnt.
- **Erwartung:** Eine Vorfrist liegt nie vor dem Ereignis. Bei Fristen, die kürzer als der Vorfrist-Abstand sind, entfällt sie oder fällt auf den Ereignistag – mit Hinweis.
- **Vorschlag:** Vorfrist = max(Ereignistag, Fristende − Abstand); im Rechenweg „Vorfrist entfällt – Frist kürzer als 3 Tage“ ausgeben.
- **Beleg:** `src/core/fristen.ts` (Vorfrist-Zeilen im Rechenweg)

**[I5-T11-01] [N] [Umzug → Umzugsprotokoll nach „Rückgängig machen“ · D · hell] Verständlichkeit** (Rest von I4-T11-02)

- **Beobachtung:** Vor dem Rückgängigmachen: „2 Fristen und 1 Wiedervorlage“. Danach im selben Eintrag: „4 Akten neu (1 abgeschlossen), 8 Kontakte, **3 Fristen und Wiedervorlagen**, 1 Dublette zusammengeführt“.
- **Erwartung:** Ein Eintrag zählt vorher und nachher gleich.
- **Vorschlag:** Für den rückgängig gemachten Lauf dieselbe Zählung („2 Fristen und 1 Wiedervorlage“) verwenden.
- **Beleg:** `src/pages/umzug/Umzug.tsx` (Z. 572)

**[I5-T14-02] [N] [Akte 151/26 → Dokumente · M · hell] Mobil**

- **Beobachtung:** Das Kontrollkästchen „Alle auswählen“ ist 18×18 px groß, alle anderen Ziele erfüllen 44 px.
- **Erwartung:** Mindestens 24 px, am iPhone besser 44 px.
- **Vorschlag:** Die Trefferfläche über die Beschriftung bzw. ein Polster auf 44 px vergrößern.
- **Beleg:** `src/pages/akten/TabDokumente.tsx` (Z. 488)

**[I5-T20-02] [N] [Apex Assistent · D · hell] Look & Feel / Bedienbarkeit**

- **Beobachtung:**
  - „Öffne die Akte Schmidt.“ → „Eine Akte **„schmidt“** habe ich in Ihrer Kanzlei nicht gefunden.“ Der Name kommt kleingeschrieben zurück.
  - „Soll ich einen Rückruf für dann anfordern?“ steht ohne Knopf da; erst ein getipptes „Ja, bitte.“ fordert ihn an.
- **Erwartung:** Den Namen so zurückgeben, wie ich ihn geschrieben habe, und eine Ja/Nein-Frage mit Knöpfen anbieten.
- **Vorschlag:** Originalschreibweise verwenden; unter der Antwort „Rückruf anfordern“ als Knopf (wie die Karte „Lieber mit einem Menschen sprechen?“).
- **Beleg:** `src/ai/assistent.ts` (Z. 1554, 1733)

**Positiv (Beleg):** [Fall 3a – Frauentag in Berlin, nicht in Brandenburg, keine Verschiebung](bilder/block-D-T18-fall3a-frauentag-brandenburg-D-hell.jpg)

---

### axe-core (serious/critical)

| Ansicht · Viewport · Modus | serious | critical |
|---|---|---|
| Cockpit · L · dunkel | 0 | 0 |
| Posteingang · L · dunkel | 0 | 0 |
| Fristen → Ausgangskontrolle · L · dunkel | 0 | 0 |
| Akte 131/26 → Dokumente · L · dunkel | 0 | 0 |
| Dokumentvorschau „Abrechnung Elbtal“ · L · dunkel | 0 | 0 |
| Fristen · 200 % (720×450 @2x) · dunkel | 0 | 0 |
| Akte 151/26 (Kopf) · M · hell | 0 | 0 |
| Apex Assistent · M · hell | 0 | 0 |
| Fristenrechner · D · hell | 0 | 0 |
| Fristen → Ausgangskontrolle · D · hell | 0 | 0 |
| Fristen „Vertretung vorab“ · D · hell | 0 | 0 |
| Aktenliste · D · hell | 0 | 0 |
| Cockpit (Mia Becker) · L · hell | 0 | 0 |
| Einstellungen (Mia Becker) · L · hell | 0 | 0 |
| Posteingang (Mia Becker) · L · hell | 0 | 0 |
| Abrechnung → Bankabgleich (Mia Becker) · L · hell | 0 | 0 |
| Umzug (Mia Becker) · L · hell | 0 | 0 |

**17 Ansichten, 0 serious, 0 critical.** I5-T14-02 (18-px-Kästchen) erkennt axe nicht, weil der Abstand zu anderen Zielen reicht.

---

### Fragebögen (Gesamtsystem nach Block D)

**SUS:** 4 · 2 · 4 · 1 · 5 · 2 · 4 · 1 · 4 · 2 = **82,5** (Trendwert; Iteration 4 Block D: 80,0). Aussage 8 sinkt auf „1“: Umzug, Ausgangskontrolle und Petras Vormittag gingen ohne Umweg. Aussage 9 bleibt bei „4“, weil ich die Netzprobe am Gericht noch nie sehen konnte.

**UEQ-S:** pragmatisch **+1,75** (unterstützend +2, einfach +2, effizient +2, übersichtlich +1) · hedonisch **+1,5** (spannend +1, interessant +2, originell +1, neuartig +2)

| Dimension | Note | Begründung |
|---|---|---|
| Look & Feel | 2 | Hell und dunkel ruhig und seriös, Papier gedimmt, Meldungen stören keine Dialoge mehr. |
| Lesbarkeit | 2 | Dunkel und bei 200 % gut lesbar, Kündigungsschreiben am iPhone ohne Zoom. Abzug: kompakte Tab-Leiste nur mit Symbolen. |
| Verständlichkeit | 2 | Rückfragen nennen Folgen („wird protokolliert“, „Rückgängig“), eEB-Rolle mit Paragraf. Kleinigkeiten: Mikrofonzustand, Protokollzählung nach Rückgängig. |
| Vertrauen | 1 | Alles Simulierte ist gekennzeichnet, Frau Vogts Erreichbarkeit stimmt, jede Übernahme und jedes Rückgängig steht mit Namen im Protokoll, Fristen aus Umzug und KI gehen in die Vier-Augen-Kontrolle. |
| Tempo | 2 | Akte am iPhone in 2 Taps, Notiz und Frist in 9, Fristen für Montag in 2, WV per W in 3. Abzug: kein Kürzel fürs Zuordnen, Aktionen am iPhone nur oben. |
| Fachliche Korrektheit | 1 | Alle 5 Prüfdaten, Widerruf, FamFG-Probe, Berufung/Begründung im Posteingang und die RVG-Stichprobe exakt. Die Vorfrist vor dem Ereignis ist unsauber, aber kein falsches Fristende. |
| Mobil | 2 | Am iPhone schnell und ohne Querscrollen, Termin als .ics. Abzug: Notiz/Frist nicht im Daumenbereich, Netzprobe weiter offen. |

**Empfehlung (0–10):** 8

**Kauf heute:** unter Bedingungen, die nur noch Vertrag und Preis betreffen. Aus meinem Block bleibt keine Produktbedingung; offen sind:

- schriftliches Angebot mit Lizenz- und Wartungspreis für 7 Arbeitsplätze;
- Übertragbarkeit der Lizenz und Quellcode-Hinterlegung;
- Umzugsumfang „gemeinsam mit Lena Vogt“ (Dokumente, Aktenkonten, offene Posten, 11.000 Archivakten) mit Festpreis und Termin im Angebot;
- echtes Impressum und KI-Verarbeitung in der EU (aus den anderen Blöcken).

**Top 3 Verbesserungen:**

1. Am iPhone Notiz, Frist und WV wieder in den Daumenbereich – ohne die alte Überlagerung (I5-T14-01).
2. Petras Tempo im Posteingang: Kürzel für „Akte zuordnen“, und keine Taste, die stumm nichts tut (I5-T22-01).
3. Kleinigkeiten mit Außenwirkung: Vorfrist nie vor dem Ereignis (I5-T15-02), Beschriftung der kompakten Tab-Leiste (I5-T15-01), eindeutiger Mikrofonzustand (I5-T20-01).

### Preisfragen (Lifetime-Lizenz, 7 Arbeitsplätze, netto)

1. **Zu billig, Zweifel an der Qualität:** unter 5.000 € – „Dafür bekomme ich keinen begleiteten Umzug und keine feste Ansprechpartnerin.“
2. **Günstig, ein gutes Angebot:** rund 12.000 €. Rechenweg: 12.000 € + 2 × 1.800 € Wartung (15 %) + 2 × 1.500 € Betrieb = 18.600 € ≤ 2 × 9.500 € heutige Kosten → in 24 Monaten allein über die Softwarekosten amortisiert.
3. **Teuer, aber noch kaufen:** rund 25.000 € – nur mit Probelauf unseres echten RA-MICRO-Exports vor Vertragsschluss und Ratenzahlung. Was Petra heute am Vormittag in 24 Aktionen erledigt hat, ist bei uns die halbe offene Stelle.
4. **Zu teuer, kein Kauf:** über 35.000 €.
5. **Wartung:** bis 15 % des Lizenzpreises pro Jahr, höchstens rund 2.500 € für 7 Plätze. Enthalten sein müssen: beA-Schnittstelle, RVG-/GKG-Tabellen, halbjährlicher Basiszins, Feiertage und Fristregeln (FamFG, ArbGG), Sicherheitsupdates, Lena Vogt mit Rückruf binnen 30 Minuten in der Servicezeit, Update-Zeitpunkt nach unserer Wahl.

### Empfehlung an Bernd Hollmann (3 Sätze)

Bernd, ich empfehle den Kauf, sobald das Angebot schriftlich vorliegt: Unser RA-MICRO-Export kam mit allen Umlauten, gemeldeter Dublette und Rückgängig-Knopf an, und jede übernommene Frist landet erst in der Vier-Augen-Kontrolle. Die Fristen stimmen auf den Tag mit Feiertag am Gerichtsort, deine Urlaubsvertretung sehe ich schon am Freitag davor, und die abendliche Ausgangskontrolle sagt mir für jede Frist „offen“ oder „versandt mit Nachweis“. Frau Schulte hat ihren Vormittag ohne Schulung geschafft – Bedingung bleiben Lizenz um 15.000 € für 7 Plätze, Wartungspreis, Festpreis für den Umzug der Altakten, Übertragbarkeit und Escrow.

---

### Bilder

| Bild | Was es zeigt |
|---|---|
| [block-D-T18-fall3a-frauentag-brandenburg-D-hell.jpg](bilder/block-D-T18-fall3a-frauentag-brandenburg-D-hell.jpg) | **T18 Fall 3a (positiv):** Zustellung Mo 08.02.2027, Berufung zum OLG Brandenburg → Mo 08.03.2027. Rechenweg „08.03.2027 Internationaler Frauentag – in Berlin Feiertag, in Brandenburg (Gerichtsort) nicht – keine Verschiebung“; Februar und März im Kalender; gesperrter Knopf mit Grund (D hell). |
| [block-D-T14-widerrufsfrist-meldung-oben-M-hell.jpg](bilder/block-D-T14-widerrufsfrist-meldung-oben-M-hell.jpg) | **T14 / I4-T14-01 behoben, I5-T14-01:** Akte 151/26 am iPhone nach dem Eintragen der Widerrufsfrist – Meldung „Frist bis Di, 03.11.2026 · Vorfrist Fr, 30.10.2026“ oben, unten nur die Tab-Leiste. Notiz und Frist sitzen im Aktenkopf, nicht im Daumenbereich (M hell). |
| [block-D-T20-mikrofon-ich-hoere-zu-und-fehler-D-hell.jpg](bilder/block-D-T20-mikrofon-ich-hoere-zu-und-fehler-D-hell.jpg) | **I5-T20-01:** Assistent ohne Mikrofon – „Ich höre zu – sprechen Sie einfach.“ und roter Mikrofonknopf neben „Kein Mikrofon gefunden oder Zugriff verweigert …“ (D hell). |
| [block-D-T15-200prozent-tableiste-ohne-beschriftung-dunkel.jpg](bilder/block-D-T15-200prozent-tableiste-ohne-beschriftung-dunkel.jpg) | **I4-T15-03 behoben, I5-T15-01:** Fristen bei 200 % dunkel – Kopfleiste eingeklappt, Tab-Leiste nur 44 von 450 px, aber nur Symbole ohne Beschriftung. |

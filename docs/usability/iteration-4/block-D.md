## Iteration 4 – Feedback Claudia Reinholz · Block D („Umzug, mobil, abends, Assistent & ReFa“)

**Datum:** Sa, 17.10.2026, ca. 06:15–06:42 Uhr Ortszeit (Systemuhr 04:15–04:42 UTC) · **Betriebsmodus:** Browser-Demo („Demo-Modus: Ihre Änderungen bleiben in diesem Browser gespeichert“, Demo-KI offline, `/api/info` 500) · **Browser:** Chromium (Playwright, `de-DE`, Europe/Berlin). Datumsfelder erscheinen weiter im US-Format; das ist die Testumgebung und kein Befund (I1-T07-07) · **Testleitung:** Avatar-Werkzeug, frisches Profil `i4-D` · **Zugänge:** Dr. Julia Hartmann (T11, T14, T15, T18, T20), Mia Becker (T22)

**Schwerpunkt Iteration 4:** alle Aufgaben **dunkel**, **reduzierte Bewegung an**, axe-core je Ansicht.

| Aufgabe | Viewports | Zusatzproben |
|---|---|---|
| T11 | D | – |
| T14 | M | Reflow 320 px; Th für den Nachtest |
| T15 | L | 200 % auf D (Viewport 720×450 @2x); Deuteranopie-Simulation |
| T18 | D | – |
| T20 | D + M | – |
| T22 | L | Tastatur: J/K, Enter, U, E, W, Strg+K, Tab |

> Eine einzige simulierte Person: SUS, UEQ-S und Noten sind **Trendwerte**.

> **Uhrzeit:** Wie in Iteration 3 lief der Block am Samstagmorgen. „Heute“ war deshalb ein Samstag ohne fällige Frist. Die Abendsituation von T15 (Werktag, 21:30 Uhr) habe ich über „Nächster Arbeitstag (Mo, 19.10.)“ geprüft und mit einer selbst angelegten Testfrist ergänzt.

> **Werkzeughinweis (kein Befund):** Das Werkzeug lädt die Seite bei jedem Aufruf neu. Ein offener Assistent-Verlauf, ein Assistent-Dialog und der Abschlussbildschirm des Umzugs gehen dabei verloren. Zusammenhängende Abläufe habe ich deshalb in einem Aufruf ausgeführt. Offline-Emulation und WebKit bietet das Werkzeug nicht.

---

### Nachtest Vorrunde (alle umgesetzten Befunde meiner Aufgaben)

| Befund-ID | S | Status | Beobachtung im Nachtest |
|---|---|---|---|
| I3-T11-01 | N | **behoben** | Die Archivakte 87/18 zeigt „Abgeschlossen (Datum im Altsystem unbekannt) · übernommen am 17.10.2026“. Der Sachverhalt erklärt: „Abschlussdatum nicht übertragen, Aufbewahrung (§ 50 BRAO) vorsorglich ab Übernahme vorgemerkt.“ (D dunkel) |
| I3-T11-02 | N | **behoben** | Die Kurzfassung ab Schritt 3 ist vollständig: „Akten, Kontakte, Fristen, Wiedervorlagen und Datenblatt je Akte. Nicht aus dieser Datei: Dokumente, Aktenkonten/offene Posten, Benutzer – gemeinsam mit Lena Vogt. Nicht übernommen: FiBu und Zugangsdaten.“ |
| I3-T14-01 | M | **behoben** | iPad hoch: Die Leiste ist beschriftet (Cockpit, Akten, Post, Fristen, KI, Fälle, Motor …), Ziele 72×52 px (Th dunkel). |
| I3-T14-02 | H | **behoben** | Th mit Maus: „Havelbrück Pflegedienste GmbH“ 206×24 px, „Arbeitsgericht Berlin“ 130×24 px, axe 0. Die 44-px-Variante für Touch kann das Werkzeug am iPad nicht prüfen, weil es dort keinen Touch emuliert. |
| I3-T14-03 / I2-T14-04 | N | **behoben** | Am iPhone steht unter der Fristart-Suche nur „Wörter in beliebiger Reihenfolge, auch Abkürzungen (ArbG, LAG, OLG)“, ohne Pfeil- und Enter-Hinweis (M dunkel). |
| I3-T15-01 | H | **behoben** | Testfrist „Zahlung an Mandantin – Überweisungsnachweis“ (131/26): Ohne Ausgang erscheint „Noch keine Überweisung gebucht – die Frist bleibt offen“, „Erledigen“ ist gesperrt. Unter „Anderen Umsatz wählen …“ stehen nur Ausgänge (Miete −2.450,00 €, Telefon −189,90 €) mit dem Hinweis „nur mit Begründung“. Gutschriften erscheinen nicht. (L dunkel) |
| I3-T15-02 | M | **behoben** | In der Dokumentvorschau ist „Seite abdunkeln“ im Dunkelmodus voreingestellt, umschaltbar auf „Original“ (Kündigungsschreiben 151/26, M dunkel). |
| I3-T18-01 | N | **behoben** | Die gewählte Fristart ist mit Balken und „✓ gewählt“ markiert, ihr Name steht im Suchfeld (D dunkel). |
| I3-T18-02 | H | **behoben** | Der Fristenrechner rechnet erst mit Datum: „Bitte das Datum eintragen: Zustellung des vollständigen Urteils – oder „heute“ wählen. Erst mit vollständigen Angaben rechnet AnwaltApex – ein altes Ergebnis bleibt nie stehen.“ (D dunkel) |
| I3-T20-01 | M | **behoben** | „wv 137 in 3 tagen zeugenliste prüfen“ führt zur Karte „137/26 · Zeugenliste prüfen · Di, 20.10.2026 · Eintragen · Ändern · Verwerfen“. Verwerfen meldet „Nichts eingetragen.“ |
| I3-T20-02 | M | **behoben** | „akte müller“ und „Öffne die Akte Müller.“ führen zur Rückfrage „Zu ‚Müller‘ passen 2 Akten“: 12/26 Jürgen Müller (aus dem Umzug) und 101/26 Johanna Müller. |
| I3-T20-03 → I3-T12-01 (Teil Assistent) | M | **behoben** | „Ich brauche meine Ansprechpartnerin.“ ergibt „Lena Vogt (Durchwahl +49 30 555 018 42)“ als `tel:`-Link, mit Rückrufangebot außerhalb der Servicezeit. |
| I3-T22-01 | M | **behoben** | W im Posteingang belegt die Akte vor: „118/26 · Neumann ./. Arslan Autohaus GmbH – Akte aus der geöffneten Nachricht“. Der Fokus steht auf „Worum geht es?“, Enter trägt ein. |
| I3-T22-02 → I3-T08-04 | N | **behoben** | Im Bankabgleich steht „≈ 18 Min. gespart · Schätzung · Annahme: 3 Min. je zugeordnetem Umsatz“. |
| I1-T07-07 | N | nicht prüfbar | Datumsfelder weiter im US-Format; das ist die Testumgebung (siehe Kopf). |

**Summe:** 15 IDs geprüft (I3-T14-03 und I2-T14-04 als eine Prüfung gezählt). **14 behoben**, 0 teilweise, 0 nicht behoben, 1 nicht prüfbar (Testumgebung).

**Nebenbei bestätigt:** Die Sammelabrechnung rechnet nach dem Filter „Deckung erteilt“ nur die sichtbaren Akten ab („5 von 5 sichtbaren Akten ausgewählt … 5 Entwürfe anlegen – Deckung erteilt“).

---

### Aufgaben

| Aufgabe | Ergebnis | Erfolgskriterium (Messwert) | Prüfpunkte x/y | Aktionen/Soll | Fehlaktionen | fachlich korrekt | SEQ | O-Ton |
|---|---|---|---|---|---|---|---|---|
| **T11** Umzug aus RA-MICRO (D dunkel) | erledigt | **erfüllt:** Windows-1252 erkannt, **0 Zeichenfehler** (Müller, Böhm, Weiß, Fördertechnik, Krüger, Özdemir, Hans-Jörg, Schäfer, Großmann). Dublette 12/26 ↔ 14/26 vor dem Import gemeldet („auch die Frist 30.10.2026 ist gleich und wird nur einmal angelegt“). Notfrist 30.10. und Verjährung 31.12. liegen in der Vier-Augen-Kontrolle („Aus Umzug · 2“), die WV 06.11. als Wiedervorlage | 7/7 | a) 4 · b) 9 · Rückgängig 2 = 15 (Soll ≈ 16) | 0 | ja: „11.400,00“ → 11.400,00 €, „30.10.2026“ → Fr, 30.10.2026, Vorfrist 23.10. bzw. 24.12. (je eine Woche), 2.180,50 €, Grenze „Abgeschlossen 2020 oder später“ (§ 50 Abs. 1 BRAO) | 6 | „Keine Angst mehr um die Umlaute. Aber warum ist Frau Vogt samstags um sechs ‚erreichbar‘, wenn der Assistent sagt, sie ist es nicht?“ |
| **T14** Mobil am Gericht (M dunkel, Reflow 320 px, Th) | erledigt | **erfüllt:** Akte in **2 Taps** (Akten, 151/26). Sitzungsnotiz und Widerrufsfrist in **9 Aktionen** (Notiz 3, Frist 6). Kein Querscrollen bei 390 und 320 px | 4/4 prüfbar + 1 Zählwert, Netzprobe nicht prüfbar | 2 + 9 (Soll ≤ 3 + ≤ 10) | 0 | ja: Widerruf 2 Wochen ab Di 20.10.2026 → **Di 03.11.2026** (§§ 187 Abs. 1, 188 Abs. 2 BGB). Vorfrist 3 Tage vorher = Sa 31.10., auf Werktag gelegt Fr 30.10. „Vertragliche Frist, keine Wiedereinsetzung“ ist zutreffend | 6 | „Termin, Az., Gegenseite und Widerrufsfrist mit einer Hand – gut. Nur liegt unten so viel übereinander, dass ich das Gericht erst nach dem Scrollen lesen kann.“ |
| **T15** Dunkelmodus abends, Tagesabschluss (L dunkel, 200 % D, Deuteranopie) | erledigt | **erfüllt:** Ausgangskontrolle Sa 17.10.: „Heute keine fälligen Fristen“. Mo 19.10.: 3 × „offen – noch kein Versandnachweis“, **0 ohne Kennzeichnung**. Eine überfällige Testfrist erschien sofort unter „Heute“ mit „überfällig seit 07.10.2026“ | 6/6 | 6 (Post, Nachricht, Fristen, Ausgangskontrolle, Nächster Arbeitstag, Drucken sichtbar) | 2 (beide beim Anlegen der Testfrist für den Nachtest: Einheit Tage statt Wochen, Bezeichnung nicht eingetragen) | ja: Versandnachweis bzw. Grund ist Pflicht. Streichen nur mit Grund, „Wieder öffnen“ und „Rückgängig“ vorhanden | 6 | „Um diese Uhrzeit kann ich das lesen, und eine fremde Gutschrift ist kein Nachweis mehr. Dass ich eine längst abgelaufene Frist ohne Rückfrage eintragen kann, gefällt mir nicht.“ |
| **T18** Fristenrechner Fälle 1, 2, 3a, 4, 5 (D dunkel) | erledigt | **erfüllt** für 5 von 5 Daten dieses Blocks (Fall 3b läuft in Block A): 01.03.2027 · 30.03.2027 · 09.03.2027 [BE] · 08.03.2027 [NW, OLG Hamm] · 08.03.2027 [3a, OLG Brandenburg]. Rechenweg jeweils mit Norm und benanntem Feiertag | 4/4 (Fall 5 mit Einschränkung → I4-T18-01) | Fall 1–4 je 3–4 · Fall 5: 9 + 2 | 1 (Taste F bei schon offenem Rechner tippte „f“ ins Suchfeld, Enter wählte die FamFG-Beschwerde; sofort bemerkt) | ja: § 188 Abs. 3 BGB (29.02. gibt es nicht → So 28.02. → Mo 01.03.). „Mo, 29.03.2027 ist Ostermontag (Berlin)“. „Internationaler Frauentag – in Berlin Feiertag, in Nordrhein-Westfalen (Gerichtsort) nicht“. Fall 4: § 63 Abs. 1 und § 117 Abs. 1 S. 3 FamFG vorhanden (15.01. → Mo 15.03.2027) | 6 | „Fünf von fünf, mit Ostermontag und Frauentag beim Namen. Die Vertretung greift aber erst am ersten Urlaubstag, und am Freitag davor sehe ich die Montagsfrist des Kollegen nicht.“ |
| **T20** Apex Assistent: Sprache und Aktionen (D + M dunkel) | erledigt | **erfüllt:** **5/5** Befehle richtig. Die WV aus Befehl 2 steht im Fristenkalender als „Durch Assistent angelegt“ und lässt sich in der Karte rückgängig machen | 3/3 prüfbar, WebKit nicht prüfbar | 12 (5 × Tippen + Enter, Auftrag, Eintragen) | 0 | ja: 1) Kalender heute 0 + 1 WV, 7 Tage 6 Fristen + 12 WV – 0 Abweichungen. 2) Sa 17.10. + 3 = Di 20.10.2026, ein Werktag. 3) Rückfrage bei 2 Treffern. 4) Wiki-Antwort mit „Bankabgleich öffnen“. 5) Lena Vogt mit `tel:`-Link und Rückruf ab Mo 7:30 Uhr | 6 | „Er fragt nach, bevor er etwas einträgt, und sagt ehrlich, dass Frau Vogt am Samstag nicht da ist. So will ich das.“ |
| **T22** Petras Vormittag, als Mia Becker (L dunkel, Tastatur) | erledigt | **erfüllt:** Die ReFa kann das eEB nicht abgeben. Der Dialog „Zur eEB-Abgabe vorlegen“ erklärt: „Das eEB gibt die Anwältin bzw. der Anwalt selbst ab … (§ 173 Abs. 3 ZPO). Sie bereiten vor und legen vor.“ Petras Urteil „ohne Schulung machbar“: **5 von 5** | 4/4 | 21 (Zuordnen 7, U 1, E + Vorlegen 2, W-WV 3, Sammelabrechnung 5, Bankabgleich 3) | 0 / 0 / 0 / 0 / 0 | ja: Berufung ab Eingang Sa 17.10. → Di 17.11.2026, Begründung → Do 17.12.2026. Stichprobe RVG 2025: 1.680 € → 1,3 × 176 € + 20 € + 19 % = 296,07 € | 6 | „Als Frau Schulte: U, E, W – das ist fast RA-MICRO. Und dass ich das eEB nur vorlegen kann, steht da, mit Paragraf.“ |

**Prüfpunkte im Einzelnen**

- **T11 (7/7):**
  - Vorschau vor dem Import: ja (erste Zeilen, Zuordnung, Vorschau „so werden die Akten angelegt“).
  - 11.400,00 € und 30. Okt.: ja.
  - 87/18 ausschließen oder als Archiv übernehmen: ja. Drei Optionen; bei „letzte 6 Jahre“ wird 87/18 ohne Abschlussdatum zur Entscheidung vorgelegt, und „Übernahme starten“ bleibt bis dahin gesperrt.
  - „Kommt nicht mit“: ja, klar sichtbar.
  - Rückgängig: ja, ausgeführt. Meldung: „Der Datenbestand entspricht wieder dem Stand vor diesem Lauf“; 12/26 ist danach nicht mehr auffindbar.
  - Ansprechpartnerin und Zeitplan: ja.
- **T14:**
  - Termin, Gericht, Az., Gegenseite und letzte Schriftsätze: 5/5.
  - Kündigungsschreiben: ohne Zoom lesbar, gedimmt.
  - Bedienelemente im unteren Drittel: ja.
  - Bedienflächen unter 44 px: **1** von 26. Das ist nur der Sprunglink „Zum Inhalt springen“ (32×16 px), der erst bei Fokus erscheint.
  - Netzprobe: nicht prüfbar (das Werkzeug kann kein Offline).
  - „In Kalender (.ics)“: ja.
- **T15 (6/6):**
  - axe 0.
  - Vorschau gedimmt.
  - Notfrist-Rot unterscheidbar, auch unter Deuteranopie: Schild-Symbol und Text.
  - Fristen für morgen: 0 Aktionen im Cockpit („Heute & Montag fällig“), 2 in Fristen.
  - „Drucken“ vorhanden.
  - Bei 1366×768 bricht nichts.
- **T18 (4/4):**
  - Gerichtsort wählbar, Bundesland „aus dem Gericht abgeleitet“: ja.
  - Feiertag beim Namen: ja.
  - Fall 4: ja.
  - Fall 5: ja, sobald die Abwesenheit begonnen hat. Dann zeigt das Cockpit „Sie vertreten heute Jonas Brandt – 4 Fristen bis Fr, 30. Okt.“, und der Fristen-Filter heißt „Nur meine (+ Vertretung)“ mit Kennzeichnung „Vertretung für Jonas Brandt“.
- **T20:**
  - Text ohne Mikrofon: ja.
  - Ton und Avatar in je 1 Klick abschaltbar („Sprachausgabe ausschalten“, „Assistent-Kugel an den Rand einklappen“): ja.
  - Siezt: ja.
  - M (Chromium): ja.
  - Safari/WebKit: nicht prüfbar.
  - Mikrofon: „Kein Mikrofon gefunden oder Zugriff verweigert. Bitte tippen Sie Ihre Frage – oder erlauben Sie das Mikrofon in der Adressleiste.“
- **T22 (4/4):**
  - Lizenz- und Teamdaten nicht sichtbar: ja. Mia sieht nur „Ihr Zugang“ und „Lizenznummer, Teamliste und Wartung sehen Partner und Administration“.
  - Kürzel für die WV vorhanden und angezeigt: ja („Taste W bzw. Alt+W · Enter trägt ein, Esc bricht ab“; „Wiedervorlage W“ in Fristen).
  - Fehlaktionen je Teilaufgabe: 0.
  - Lesbar ohne Zoom: ja.
  - Fokusrahmen per Tab sichtbar: 2 px, rgba(128,152,255,0.6).

---

### Befunde

**[I4-T11-01] [M] [Umzug · Karte „Lena Vogt“ und Schritt 3/4 · D · dunkel] Vertrauen**

- **Beobachtung:**
  - Am Samstag um 06:16–06:38 Uhr zeigt die Karte „Lena Vogt – begleitet Ihren Umzug persön…“ einen grünen Chip „● erreichbar“, darunter „Mo–Fr 7:30–19:00 Uhr“.
  - Der Apex Assistent sagt zur selben Zeit: „Lena Vogt ist jetzt nicht erreichbar – Rückruf frühestens Mo, 19.10.2026 ab 7:30 Uhr“.
  - Im Code ist der Chip fest verdrahtet (`src/pages/umzug/Umzug.tsx`, Zeile ≈ 526).
  - Dazu ist der Untertitel abgeschnitten („persön…“).
- **Erwartung:** Ein Erreichbarkeitsstatus, der überall gleich ist und der Servicezeit folgt.
- **Vorschlag:**
  - Dieselbe Statuslogik wie Assistent und Hilfe verwenden.
  - Außerhalb der Servicezeit „nicht erreichbar – Rückruf ab Mo, 7:30 Uhr“ in Grau bzw. Bernstein zeigen.
  - Den Untertitel umbrechen statt kürzen.
- **Beleg:** [Bild](bilder/block-D-T11-lena-vogt-erreichbar-samstag-D-dunkel.jpg)

**[I4-T11-02] [N] [Umzug · Schritt 5 „Fertig“ · D · dunkel] Verständlichkeit**

- **Beobachtung:** Die Meldung lautet „Umzug abgeschlossen – 4 Akten, 8 Kontakte und 3 Fristen übernommen.“ Die Kachel daneben zeigt aber „Fristen zur Kontrolle 2 · dazu 1 Wiedervorlage/Termin“, und das Protokoll sagt „3 Fristen und Wiedervorlagen“.
- **Erwartung:** Überall dieselbe Zählung.
- **Vorschlag:** Die Meldung soll „… 2 Fristen und 1 Wiedervorlage übernommen“ lauten.

**[I4-T14-01] [M] [Akte 151/26 · Übersicht und Reiter „Fristen“ · M 390×844 und 320×640 · dunkel] Mobil**

- **Beobachtung:**
  - Am iPhone liegen unten bis zu drei schwebende Ebenen übereinander:
    - Meldung („Frist eingetragen – Frist bis Di, 03.11.2026 · Vorfrist Fr, 30.10.2026“),
    - Schnellaktionsleiste (Notiz / Frist / Wiedervorlage),
    - Tab-Leiste mit Kugel.
  - Zusammen belegen sie etwa y 610–844, also rund 28 % der Höhe.
  - In der ersten Ansicht der Akte verdeckt die Schnellaktionsleiste das „Arbeitsgericht Berlin“ und die Uhrzeit des Termins zur Hälfte. Nach dem Eintragen verdeckt die Meldung den Gütetermin und die neue Widerrufsfrist.
  - Bei 320 px liegt die Schnellaktionsleiste über dem Knopf „KI-Analyse“.
  - Durch Scrollen ist alles erreichbar; kein Querscrollen; axe 0.
- **Erwartung:** Vor Saal 3 stehen Termin und Gericht im ersten Bildschirm frei. Meldungen verdecken keinen Inhalt.
- **Vorschlag:**
  - Schnellaktionen in die Tab-Leiste oder in den Aktenkopf legen, oder die Leiste beim Scrollen nach unten ausblenden.
  - Meldungen am Telefon oben anzeigen.
  - Unten so viel Innenabstand lassen, wie die Leisten hoch sind.
- **Beleg:** [Bild](bilder/block-D-T14-drei-schwebende-ebenen-M-dunkel.jpg)

**[I4-T14-02] [N] [Akte 151/26 · Übersicht „Letzte Dokumente“ · M · dunkel] Tempo**

- **Beobachtung:** Unter „Letzte Dokumente“ stehen 5 von 6 Dokumenten. Das Kündigungsschreiben, für den Gütetermin das wichtigste Dokument, fehlt dort. Ich habe es über Reiter „Dokumente“ und die Suche geöffnet; das sind 3 Aktionen mehr.
- **Erwartung:** Kerndokumente der Akte sind am Gerät mit einem Tap erreichbar.
- **Vorschlag:** In „Letzte Dokumente“ ein „Alle 6 anzeigen“ ergänzen oder wichtige Dokumente anheften (z. B. Kündigung, Klage, Ladung).

**[I4-T15-01] [M] [Frist anlegen (Akte 131/26) · L · dunkel] Fachlich**

- **Beobachtung:**
  - Beim zweiten Anlegen einer „Frei bestimmten Frist“ schlug der Dialog vor: „aus der notierten Frist ‚Frei bestimmte Frist (2 Tage)‘: 05.10.2026 übernommen“.
  - Diese Frist hatte ich kurz vorher mit dem Grund „Fehleintrag – falsche Dauer“ gestrichen.
  - Der Vorschlag ist zwar beschriftet, stammt aber aus einem als falsch markierten Eintrag.
- **Erwartung:** Ereignisdaten werden nur aus offenen bzw. bestätigten Fristen vorgeschlagen.
- **Vorschlag:** Gestrichene Fristen von der Übernahme ausschließen. Zeigt der Dialog einen Vorschlag, nennt er dessen Status.
- **Beleg:** `src/pages/akten/FristAnlegen.tsx`

**[I4-T15-02] [M] [Frist anlegen · L · dunkel] Fehler**

- **Beobachtung:**
  - Bei „Frei bestimmte Frist“ ist die Einheit „Tage“ voreingestellt, bei „Widerrufsfrist (Vergleich)“ dagegen „Wochen“.
  - Mit „2“ und dem Ereignis 05.10. entstand so ein Fristende Mi, 07.10.2026, „seit 10 Tagen überfällig“.
  - „Frist übernehmen“ trug diese längst abgelaufene Frist ohne Rückfrage ein. Bei einer Doppelung gibt es dagegen eine Pflichtbestätigung.
  - Positiv: Die Frist erschien sofort in der Ausgangskontrolle „Heute“.
- **Erwartung:** Eine Rückfrage, wenn das Fristende in der Vergangenheit liegt.
- **Vorschlag:**
  - „Das Fristende liegt in der Vergangenheit – trotzdem eintragen (wird protokolliert)?“ wie bei der Doppelung.
  - Die Einheit ohne Vorgabe lassen oder einheitlich vorbelegen.

**[I4-T15-03] [N] [Fristen/Ausgangskontrolle · 200 % auf D (720×450 CSS-px) · dunkel] Lesbarkeit**

- **Beobachtung:** Bei 200 % fällt die App ins Telefon-Layout. Das ist bedienbar und ohne Querscrollen. Kopf- und Tab-Leiste mit Kugel belegen aber etwa 130 von 450 CSS-px (≈ 29 %); sichtbar sind nur drei Fristen.
- **Erwartung:** Mehr Fläche für die Liste.
- **Vorschlag:** Die Kopfleiste beim Scrollen einklappen; die Kugel im Telefon-Layout in die Tab-Leiste legen.

**[I4-T18-01] [M] [Einstellungen → Team & Zugänge → Abwesenheit & Vertretung; Fristen „Nur meine“; Cockpit · D · dunkel] Fachlich**

- **Beobachtung:**
  - Ich trage für Jonas Brandt „abwesend 19.10.–30.10. · Vertretung: Dr. Julia Hartmann · Urlaub“ ein.
  - Am Sa 17.10. zeigt „Nur meine“ für Mo 19.10. nur 2 eigene Fristen. Brandts „Replik auf Klageerwiderung“ (137/26), fällig am ersten Abwesenheitstag, fehlt.
  - Es gibt keinen Hinweis „Ab Mo, 19.10. vertreten Sie Jonas Brandt“.
  - Erst als ich den Beginn auf heute setze, erscheinen „Nur meine (+ Vertretung)“, „Vertretung für Jonas Brandt“ und im Cockpit „Sie vertreten heute Jonas Brandt – 4 Fristen“.
  - Die Vertretung wirkt also erst ab dem ersten Abwesenheitstag. Die Übergabe am letzten Arbeitstag davor (§ 53 BRAO, Organisationspflicht) unterstützt die Oberfläche nicht.
- **Erwartung:** Die Vertreterin sieht ab dem Eintrag, spätestens ab der Vorfrist, alle Fristen, die im Abwesenheitszeitraum ablaufen, deutlich gekennzeichnet.
- **Vorschlag:**
  - Im Cockpit und unter „Nur meine“ den Hinweis „Ab Mo, 19.10. vertreten Sie Jonas Brandt – n Fristen im Zeitraum“ einblenden und diese Fristen vorab zeigen.
  - Beim Speichern der Abwesenheit die Fristen des Zeitraums auflisten.
- **Beleg:** [Bild](bilder/block-D-T18-vertretung-erst-ab-beginn-D-dunkel.jpg) · `src/core/vertretung.ts`, `src/pages/fristen/Fristen.tsx`, `src/pages/cockpit/KartenArbeit.tsx`

**[I4-T18-02] [N] [Fristenrechner · Kalender · D · dunkel] Look & Feel**

- **Beobachtung:** Bei Fall 1 (Zustellung 29.01.2027, Fristende 01.03.2027) zeigt der Kalender Januar und März 2027. Der Februar mit dem rechnerischen Ende So 28.02. fehlt, obwohl die Legende „rechnerisches Ende (kein Werktag)“ anbietet.
- **Erwartung:** Jeder Monat mit einer Markierung ist sichtbar.
- **Vorschlag:** Bei Bedarf drei Monate zeigen oder den Februar statt des Januars.
- **Beleg:** `src/pages/fristen/MiniKalender.tsx`

**[I4-T18-03] [N] [Fristenrechner · Start · D · dunkel] Verständlichkeit**

- **Beobachtung:** Der Rechner öffnet mit vorgewählter Fristart „Berufungsfrist – ✓ gewählt“. Ohne Datum rechnet er nicht, es besteht also kein Risiko. Wer aber nur Datum und Gericht einträgt, bekommt eine Berufungsfrist, ohne die Fristart selbst gewählt zu haben.
- **Erwartung:** Keine vorgewählte Fristart, wie beim Akten-Dialog.
- **Vorschlag:** Die Liste anzeigen, aber nichts vorwählen; Enter übernimmt den ersten Treffer erst nach einer Eingabe.

**[I4-T20-01] [N] [Apex Assistent · Bestätigungskarte Wiedervorlage · M · dunkel] Bedienbarkeit**

- **Beobachtung:** Für 137/26 lag schon die WV „Stellungnahme der Mandantin zur Replik einholen“ am Di 20.10.2026. Der Assistent bereitete trotzdem eine zweite WV am selben Tag vor, ohne Hinweis. Der Frist-Dialog warnt dagegen bei Doppelungen.
- **Erwartung:** Ein Hinweis „Für 137/26 liegt am 20.10. schon eine Wiedervorlage“.
- **Vorschlag:** Dieselbe Doppelungsprüfung in der Assistent-Karte zeigen.

**[I4-T22-01] [N] [Posteingang · Dialog „Wiedervorlage anlegen“ nach „Zur eEB-Abgabe vorlegen“ · L · dunkel] Look & Feel**

- **Beobachtung:** Die Meldung „eEB zur Abgabe vorgelegt – Dr. Julia Hartmann hat eine Wiedervorlage für heute …“ liegt über dem oberen Rand des danach geöffneten Dialogs „Wiedervorlage anlegen“ und deckt dessen Symbol ab. Das ist ein Rest von I3-T03-03.
- **Erwartung:** Meldungen weichen offenen Dialogen aus.
- **Vorschlag:** Meldungen bei offenem Dialog unten links oder im Dialog anzeigen.

**Positiv (Beleg):** [Zur eEB-Abgabe vorlegen – ReFa legt vor, Anwältin gibt ab](bilder/block-D-T22-positiv-eeb-vorlage-L-dunkel.jpg)

---

### axe-core (serious/critical)

| Ansicht · Viewport · Modus | serious | critical |
|---|---|---|
| Umzug Schritt 1 · D · dunkel | 0 | 0 |
| Umzug Schritt 3 (Zeitplan, Lena Vogt) · D · dunkel | 0 | 0 |
| Umzug Schritt 4 · D · dunkel | 0 | 0 |
| Umzug mit Protokoll · D · dunkel | 0 | 0 |
| Cockpit · M · dunkel | 0 | 0 |
| Akte 151/26 · M · dunkel | 0 | 0 |
| Dokumentvorschau Kündigungsschreiben · M · dunkel | 0 | 0 |
| Akte 151/26 Reiter Fristen · M · dunkel | 0 | 0 |
| Akte 151/26 · Reflow 320×640 · dunkel | 0 | 0 |
| Akte 151/26 · Th · dunkel | 0 | 0 |
| Cockpit · L · dunkel | 0 | 0 |
| Posteingang · L · dunkel | 0 | 0 |
| Posteingang Nachricht · L · dunkel | 0 | 0 |
| Fristen / Ausgangskontrolle heute · L · dunkel | 0 | 0 |
| Ausgangskontrolle Mo 19.10. · L · dunkel | 0 | 0 |
| Ausgangskontrolle · 200 % D · dunkel | 0 | 0 |
| Dialog „Wie wurde die Frist gewahrt?“ (Überweisung) · L · dunkel | 0 | 0 |
| Fristenrechner · D · dunkel | 0 | 0 |
| Cockpit · D · dunkel | 0 | 0 |
| Apex Assistent · M · dunkel | 0 | 0 |
| Cockpit Mia Becker · L · dunkel | 0 | 0 |
| Sammelabrechnung · L · dunkel | 0 | 0 |
| Bankabgleich · L · dunkel | 0 | 0 |

**Summe:** 23 Ansichten · serious 0 · critical 0.

**Farbfehlsicht (Deuteranopie, Fristen „Kritische Fristen“, L dunkel):** Notfrist bzw. „nicht verlängerbar“ und „Vier-Augen-Kontrolle offen“ werden beide bernsteinfarben, bleiben aber durch Schild-Symbol und Text unterscheidbar. Farbe ist nicht der alleinige Bedeutungsträger.

---

### Fragebögen

**SUS:** 4 · 2 · 4 · 1 · 5 · 2 · 4 · 2 · 4 · 2 = **80,0** (Trendwert)

**UEQ-S:**

- pragmatisch **+1,75** (unterstützend +2, einfach +2, effizient +2, übersichtlich +1)
- hedonisch **+1,25** (spannend +1, interessant +2, originell +1, neuartig +1)

**Noten:**

| Dimension | Note | Begründung |
|---|---|---|
| Look & Feel | 2 | Ruhig und seriös im Dunkeln; am iPhone zu viel Schwebendes unten. |
| Lesbarkeit | 2 | Dunkelmodus angenehm, Vorschau gedimmt, axe 0; die grauen Hilfetexte unter Feldern sind klein. |
| Verständlichkeit | 2 | Klare Sätze mit Norm; kleine Zählwidersprüche („3 Fristen“ gegenüber „2 + 1 WV“). |
| Vertrauen und Seriosität | 2 | Rückgängig, Grund-Pflicht und Bestätigungskarten überall. Aber „erreichbar“ am Samstag stimmt nicht. |
| Tempo | 2 | U, E, W, Strg+K, J/K; Umzug in rund 15 Aktionen. |
| Fachliche Korrektheit | 1 | Alle Prüfwerte exakt, Feiertage benannt, RVG-Stichprobe stimmt. |
| Mobil | 2 | T14 in 2 + 9 Aktionen; Überlagerungen unten. |

**Empfehlung:** 8 / 10

**Kauf heute:** unter Bedingungen.

- Produkt: I4-T18-01 (Vertretung vorab).
- Vertrag: schriftliches Angebot mit Preis und Wartung, Escrow und Übertragbarkeit, KI-Verarbeitung in der EU, Impressum.

**Top 3 Verbesserungen**

1. **Vertretung schon vor dem ersten Abwesenheitstag wirksam machen** (I4-T18-01): Hinweis und Fristen des Zeitraums bei der Vertreterin.
2. **Frist-Dialog absichern** (I4-T15-01, I4-T15-02): keine Vorschläge aus gestrichenen Fristen; Rückfrage bei schon abgelaufenem Fristende; einheitliche Einheit der Dauer.
3. **iPhone und Ansprechpartnerin** (I4-T14-01, I4-T11-01): unten weniger schwebende Ebenen, Termin und Gericht im ersten Bildschirm frei; Erreichbarkeitsstatus überall nach Servicezeit.

---

### Was gut war

- **Umzug:**
  - Windows-1252 automatisch erkannt, 0 Zeichenfehler.
  - Dublette vor dem Import gemeldet.
  - 87/18 wird „nicht still ausgelassen“.
  - Rückgängig stellt den Stand vollständig wieder her.
- **Fristenrechner:**
  - 5/5 exakt.
  - Der Rechenweg nennt Ostermontag und Internationalen Frauentag.
  - Der Gerichtsort wird aus dem Gericht abgeleitet und sperrt das Bundesland.
  - Keine stille Vorbelegung des Datums mehr.
- **Ausgangskontrolle:**
  - Überfällige Fristen erscheinen sofort.
  - Überweisungsnachweis nur mit Ausgängen.
  - Streichen nur mit Grund, mit „Wieder öffnen“ und „Rückgängig“.
- **Petras Vormittag:**
  - U, E und W mit angezeigtem Kürzel.
  - Der eEB-Dialog erklärt die Rollen mit Norm.
  - Die Sammelabrechnung rechnet nach dem Filter nur die sichtbaren Akten ab.
  - Bankabgleich mit gekennzeichneter Schätzung und ehrlichem Hinweis „Die Anzeige wurde unterbrochen – Buchungen und Vorschläge sind trotzdem vollständig gespeichert“.
- **Assistent:**
  - 5/5 Befehle.
  - Bestätigungskarte vor jedem Eintrag, „Durch Assistent angelegt“, Rückgängig.
  - `tel:`-Link und ehrliche Auskunft „jetzt nicht erreichbar“.
- **Dunkelmodus:** axe 0 in 23 Ansichten; Dokumentvorschau gedimmt; Notfristen auch unter Deuteranopie unterscheidbar.

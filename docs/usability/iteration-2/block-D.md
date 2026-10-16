## Iteration 2 – Feedback Claudia Reinholz · Block D (Umzug, mobil, abends, Assistent & ReFa)

16.10.2026 (Freitag, ca. 21:29–21:55 Uhr) · Betriebsmodus: **Browser-Demo**. Belege dafür: Die Anmeldeseite meldet „Demo-Modus: Ihre Änderungen bleiben in diesem Browser gespeichert“, die Kopfzeile zeigt „Demo-KI (offline)“ und „Simuliert verbunden“. · Browser: Chromium (Testwerkzeug, de-DE, Europe/Berlin) · Testleitung: Avatar-Werkzeug, frisches Profil `i2-D`.

**Zugänge:** Dr. Julia Hartmann für T11, T14, T15, T18 und T20; Mia Becker (ReFa) für T22, die ich als Petra Schulte bediene. Beide Anmeldungen habe ich von Hand mit E-Mail und Passwort gemacht.

**Reihenfolge und Ansichten:**

| Aufgabe | Viewport | Modus |
|---|---|---|
| T11 | D 1440×900 | hell |
| T14 | M 390×844 | hell |
| T15 | L 1366×768 | dunkel |
| T18 | D | hell |
| T20 | D, zusätzlich M | hell |
| T22 | L | hell |

**Schwerpunkt Iteration 2 (Effizienz und Tastatur):**
- Ich habe Aktionen gezählt.
- Strg+K, F, W und „?“ habe ich benutzt.
- In T22 habe ich die Wiedervorlage nur mit der Tastatur angelegt.
- axe-core lief in 11 Ansichten.

**Hinweis zur Datenlage:** In T11 habe ich den Beispiel-Export übernommen und im Umzugsprotokoll wieder zurückgenommen. Die Testdatei der Testleitung ist geblieben. Deshalb gibt es in T20 echt zwei Akten „Müller“.

> Mein Eindruck in einem Satz: *Von meinen vier Haftungsthemen aus der Vorrunde ist keines mehr offen: Die ReFa legt das eEB nur noch vor, die Ausgangskontrolle gibt es, der Umzug erkennt die Dublette und das Archiv, und der Assistent fragt nach, bevor er etwas einträgt. Was jetzt noch stört, sind zwei Stellen, an denen die Software etwas Falsches dokumentiert oder still durchgehen lässt: die Versandzeit im Nachweis und ein Gerichtsort, der nicht zum Bundesland passt.*

### Nachtest Vorrunde (Befunde meiner Aufgaben T11, T14, T15, T18, T20, T22)

| Befund | Status | Was ich gesehen habe |
|---|---|---|
| I1-T11-01 | behoben | Die Dublette 12/26 ↔ 14/26 wird in der Zuordnung als „Dubletten in der Datei“ gemeldet: „auch die Frist 30.10.2026 ist gleich und wird nur einmal angelegt“. Zur Wahl stehen Zusammenführen, Beide behalten und Überspringen. Die Notfrist liegt nur einmal in der Vier-Augen-Kontrolle. |
| I1-T11-02 | behoben | Die Spalte „Status“ hat ein eigenes Zielfeld. Zum Umfang gibt es drei Optionen: „Nur offene“, „Offene + abgeschlossene der letzten 6 Jahre (§ 50 Abs. 1 BRAO)“ und „Alle – ältere als Archiv“. 87/18 steht danach als „Abgeschlossen“ im Bestand. |
| I1-T11-03 | behoben | Das Umzugsprotokoll zeigt den Lauf auch nach dem Neuladen. „Rückgängig machen“ hat einen klaren Dialog. Danach steht im Protokoll „rückgängig am 16.10.2026 von Dr. Julia Hartmann“, und es kommt die Meldung „Der Datenbestand entspricht wieder dem Stand vor diesem Lauf“. |
| I1-T11-04 | behoben | Sammelabrechnung als Mia: „6 von 9 Akten ausgewählt“. 12/26, 13/26 und 45/25 tragen „Abrechnungsstand unbekannt (Umzug)“, sind nicht vorausgewählt und haben einen Knopf „Abrechnungsstand geprüft“. |
| I1-T11-05 | behoben | Die Liste „Was zieht um?“ ist vollständig: was mitkommt, was mit Lena Vogt kommt und was nicht mitkommt. Der Zeitplan hat drei Schritte (Probelauf, Parallelbetrieb, Umschalten), dazu „Termin mit Lena Vogt vereinbaren“. |
| I1-T11-06 | teilweise | Die Überschrift lautet jetzt „Umzug in fünf Schritten – mit Vorschau und Rückgängig“. In Schritt 4 steht aber weiter: „Ein Klick übernimmt alles aus RA-MICRO.“ „Alles“ stimmt nicht: Dokumente, Aktenkonten und Benutzer kommen laut eigener Liste erst mit Lena Vogt. |
| I1-T14-01 | behoben | Widerrufsfrist im Akten-Dialog: „Dauer (Pflicht)“, und „Frist übernehmen“ ist gesperrt, bis ein Wert eingetragen ist. |
| I1-T14-02 | behoben | Die Fristart „Widerrufsfrist (Vergleich)“ gibt es mit „Dauer ab Ereignis“ oder „Festes Datum laut Vergleich“, dazu „Vereinbarte Frist (festes Datum)“. Der Rechenweg nennt § 188 Abs. 2 BGB und „keine Wiedereinsetzung“. |
| I1-T14-03 | behoben | Ich habe „142“, „Wolff“, „Özdemir“ und „Weiß“ getippt. Kein Zeichen ging verloren. |
| I1-T14-04 | teilweise | „Meine Fristen als .ics“ (gesammelt) gibt es in Fristen, auch mobil. Einen Export je Termin oder Frist habe ich weder in der Akte noch in den Details eines Eintrags gefunden, etwa für den Termin „Mündliche Verhandlung“ in 137/26. |
| I1-T14-05 | teilweise | Keine Bedienfläche ist mehr kleiner als 24 px (vorher 2). Unter 44 px liegen aber noch 10 von 19 sichtbaren Flächen im Aktenkopf und 12 von 29 nach dem Scrollen. Beispiele: Reiter 32 px, „Weitere Aktionen“ 36 px, „Schnellhilfe“ 32 px. Frist und Notiz liegen oben im Kopf bzw. mitten in der Übersicht, nicht im Daumenbereich. |
| I1-T14-06 | behoben | axe: Akte 142/26, M hell → 0 serious, 0 critical. |
| I1-T14-07 | teilweise | Der Aktenkopf hat die Felder „Gerichtl. Az.“ und „Nächster Termin“. 142/26 zeigt aber weiter „–“ und „kein Termin“. Die Szene „8:40 vor Saal 3“ lässt sich damit nicht nachstellen. Das Problem liegt bei den Demodaten, wie in 9.4 der Vorrunde beschrieben. |
| I1-T14-08 | behoben | Mobil brechen die Segmente um („Wiedervorlage / Termin“ zweizeilig). Die Kugel sitzt neben der Tab-Leiste. |
| I1-T15-01 | behoben | Fristen → „Ausgangskontrolle“ mit „x offen · y versandt mit Nachweis“. „Erledigt …“ öffnet „Wie wurde die Frist gewahrt?“ mit Pflichtfeld und Warnung „Vier-Augen-Kontrolle steht noch aus“, die man bestätigen muss. Zur Nachweiszeile siehe aber **I2-T15-01**. |
| I1-T15-02 | behoben | Die Druckansicht „Fristen heute und morgen“ ist papierweiß, mit Zeile „Ausgangskontrolle durchgeführt: ____ (Name, Uhrzeit)“. |
| I1-T15-03 | behoben | axe Posteingang L dunkel: 0/0. |
| I1-T15-04 | behoben | Die Kopfleiste ist am Desktop deckend, hell wie dunkel. Mobil schimmert Text durch die Tab-Leiste, siehe I2-T14-02. |
| I1-T18-01 | behoben | Das Feld „Gericht (Gerichtsort)“ hat Vorschläge, und das Land wird abgeleitet: Kammergericht → Berlin, OLG Brandenburg → Brandenburg, Oberlandesgericht Hamm → NRW. Das Bundesland ist nicht still mit dem Kanzleisitz vorbelegt. |
| I1-T18-02 | behoben | Fall 3a: „08.03.2027 Internationaler Frauentag – in Berlin Feiertag, in Brandenburg (Gerichtsort) nicht – keine Verschiebung“. |
| I1-T18-03 | behoben | Kanzlei-Tab: „Voreinstellung für den Fristenrechner – maßgeblich bleiben die Feiertage am Ort des Gerichts (§ 222 Abs. 2 ZPO).“ |
| I1-T18-04 | behoben | Der Rechenweg hat immer den Schritt „Feiertage am Gerichtsort geprüft: <Land> (<Gericht>)“. |
| I1-T18-05 | behoben | Fall 1, Schritt 3: „rechnerisch 29.02.2027 – diesen Tag gibt es nicht → Monatsletzter So, 28.02.2027 (§ 188 Abs. 3 BGB)“. Keine Animation. |
| I1-T18-06 | behoben | Nach „Xyzfrist“ erscheint „Keine Fristart gefunden …“. Das alte Ergebnis ist weg. |
| I1-T18-07 | behoben | Es gibt die Rubrik FAMILIENRECHT mit § 63 Abs. 1, § 63 Abs. 2 und § 117 Abs. 1 S. 3 FamFG. Das Ereignis heißt „Schriftliche Bekanntgabe des Beschlusses (§ 63 Abs. 3 S. 1 FamFG)“. |
| I1-T18-08 | behoben | Team → „…“ → „Abwesenheit & Vertretung“ mit § 53 BRAO. Danach zeigt das Cockpit „Sie vertreten heute Jonas Brandt“, und Fristen „Nur meine (+ Vertretung)“ zeigt „Vertretung für Jonas Brandt“. Siehe aber I2-T18-02 und I2-T18-03. |
| I1-T20-01 | behoben | „Zu ‚müller‘ passen 2 Akten. Welche soll ich öffnen?“ mit 12/26 und 101/26 als Knöpfe. Die Auswahl öffnet die richtige Akte. |
| I1-T20-02 | behoben | Die Karte zeigt „Wiedervorlage – bitte bestätigen“ mit Eintragen, Ändern und Verwerfen. Danach „eingetragen“ mit „Rückgängig“. Später geht in der Akte „Streichen – mit Grund“. |
| I1-T20-03 | teilweise | Das Etikett lautet „Durch Assistent angelegt“. Die Details sagen aber „Auftrag: ‚Wiedervorlage‘“ statt meines Auftrags („Lege eine Wiedervorlage für Akte 137 in drei Tagen an.“), und der Titel ist nur „Wiedervorlage“. |
| I1-T20-04 | teilweise | Die Kugel lässt sich mit 1 Aktion einklappen. Ohne Mikrofon kommt eine klare Meldung: „Kein Mikrofon gefunden oder Zugriff verweigert. Bitte tippen Sie Ihre Frage …“. Kopf („Ich höre zu …“) und Zeile „Ich höre zu – sprechen Sie einfach.“ bleiben aber nach 5 s stehen. Das widerspricht sich. |
| I1-T20-05 | behoben | „Guten Abend, Frau Dr. Hartmann“ steht im Cockpit und im Assistenten, „Guten Abend, Frau Becker“ bei Mia. |
| I1-T22-01 | behoben | Als ReFa: „Das eEB gibt die Anwältin bzw. der Anwalt selbst ab … Sie bereiten vor und legen vor.“ Es gibt nur „Zur eEB-Abgabe vorlegen“. Danach steht im Protokoll: „Zur Abgabe vorgelegt an Dr. Julia Hartmann am 16.10.2026, 21:52 Uhr (von Mia Becker)“. |
| I1-T22-02 | behoben | Mia sieht die Reiter Kanzlei, Ihr Zugang, KI, Darstellung und Datenschutz. Team und Lizenz fehlen. |
| I1-T22-03 | behoben | W, F und „?“ funktionieren. Die Kürzelübersicht kommt mit „?“, und an den Knöpfen steht „Wiedervorlage W“ bzw. „Frist berechnen F“. Siehe aber I2-T22-01. |
| I1-T22-04 | behoben | Ich habe die Kennzahlen der Abrechnung beim Laden alle 50 ms abgefragt: Es kamen sofort die Endwerte 6.322 € und 6.120 €, keine Zwischenwerte. |
| I1-T22-05 | behoben | Gekennzeichnet sind: „beA (simuliert)“, „E-Mail (simuliert)“, „Beispielumsätze (simuliert)“ und „Rückruf (im Prototyp simuliert – es ruft niemand an)“. |
| I1-T22-06 | behoben | Die Zusatzzeile der KI-Karte steht vollständig da und ist nicht abgeschnitten: „98 % sicher · erkannt über Absenderadresse … (Mandant Thomas Weber)“. |
| I1-T22-07 | behoben | Nicht zugeordnete Nachrichten zeigen die Karte aufgeklappt, zugeordnete einzeilig mit „KI-Analyse ▾“. „Akte zuordnen“ war bei allen 3 Nachrichten 1 Klick. |

**Summe Nachtest:** 39 Befunde, davon 31 behoben, 8 teilweise und 0 nicht behoben.

### Ergebnisse je Aufgabe

| Aufgabe | Ergebnis | Erfolgskriterium (Messwert) | Prüfpunkte x/y | Aktionen/Soll | Fehlaktionen | fachlich korrekt | SEQ | O-Ton |
|---|---|---|---|---|---|---|---|---|
| **T11** Umzug aus RA-MICRO (D) | erledigt | **erfüllt.** 0 Zeichenfehler: Müller, Böhm, Weiß, Fördertechnik, Hans-Jörg Krüger, Özdemir, Bärbel Schäfer und Großmann stimmen, Windows-1252 wurde erkannt. Die Dublette 12/26 ↔ 14/26 wird vor dem Import gemeldet und zusammengeführt. Übernommen: 4 Akten (1 Archiv) und 8 Kontakte. Notfrist 30.10.2026 (einmal) und Verjährung 31.12.2026 liegen in der Vier-Augen-Kontrolle, die WV 06.11.2026 als Wiedervorlage. | 7/7 (Vorschau ✓ · 11.400,00 → 11.400,00 € ✓ · 30.10.2026 ✓ · 6-Jahres- bzw. Archiv-Option ✓ · „was nicht mitkommt“ ✓ · Rückgängig nach dem Neuladen ✓ · Ansprechpartnerin und Zeitplan ✓) | b) 8 (Umzug, RA-MICRO, Weiter, Datei, Weiter, Weiter, Umfang, Übernehmen); a) 6, Rücknahme 2 / – | 0 | ja: 11.400,00 €, 30.10.2026, 2.180,50 € in der Akte, 87/18 „Abgeschlossen“ | 6 | „Das ist ein Umzug, wie ich ihn mir vorstelle: Vorschau, Dublette gemeldet, die Akte von 2018 geht ins Archiv, und den Probelauf kann ich auch nach dem Neuladen zurücknehmen. Dass die Aktenliste dann 2.181 € statt 2.180,50 € zeigt, will ich trotzdem nicht sehen.“ |
| **T14** Mobil am Gericht (M) | erledigt | **erfüllt.** Die Akte war in 3 Taps offen (Akten → Suchfeld „142“ → Treffer). Sitzungsnotiz und Widerrufsfrist brauchten 7 Aktionen (Notizfeld, Speichern, Frist, Fristart, Dauer 2 Wochen, Bezeichnung, Übernehmen). Kein horizontales Scrollen. | 3/5 prüfbar (Angaben 4/5 ✗: Termin und Gerichts-Az. fehlen · PDF ohne Zoom lesbar ✓ · Bedienelemente im unteren Drittel ✗ · Bedienflächen: 0 unter 24 px ✓, aber 10 von 19 unter 44 px · Kalender ✓ als .ics gesammelt) · Netzprobe: nicht prüfbar (das Werkzeug kann nicht offline gehen) | 3 Taps + 7 / ≤ 3 + ≤ 10 | 0 | ja: Widerrufsfrist Verkündung Fr 16.10.2026 + 2 Wochen → Fr 30.10.2026 (§ 188 Abs. 2 BGB), Vorfrist Di 27.10.2026; Hinweis „keine Wiedereinsetzung“ ✓ | 6 | „Drei Tipps zur Akte, Kündigungsschreiben ohne Brille lesbar, Widerrufsfrist mit Rechenweg und dem Hinweis, dass es keine Wiedereinsetzung gibt – ordentlich. Aber den Gütetermin sehe ich immer noch nicht, und unten schimmert der Text durch die Leiste.“ |
| **T15** Dunkelmodus abends, Tagesabschluss (L dunkel) | erledigt | **erfüllt.** Die Ausgangskontrolle listet beide heute fälligen Fristen mit „offen – noch kein Versandnachweis“. Am Ende: 1 versandt mit Nachweis, 1 offen, 0 ohne Kennzeichnung. | 6/6 (axe 0/0 in 5 dunklen Ansichten · keine grellen Flächen, Druckvorschau papierweiß im gedimmten Dialog ✓ · Notfrist-Rot mit Symbol und Text ✓ · Fristen für den nächsten Arbeitstag mit 0 Aktionen im Cockpit („Heute & Montag fällig“) ✓ · Drucken ✓ · 1366×768 Desktop-Layout ohne Bruch ✓) | 9 / – | 1 („Morgen“ zeigt Samstag, leer) | **nein**: Die Nachweiszeile nennt „beA 21:39 Uhr“. Das ist der Zeitpunkt meines Klicks; den Versand hatte ich mit 18:05 Uhr angegeben (I2-T15-01) | 5 | „Endlich eine Ausgangskontrolle, und ‚Erledigt‘ geht nur mit Nachweis – so will es der BGH. Aber da steht jetzt ‚beA 21:39 Uhr‘. Um 21:39 habe ich nichts verschickt, das war mein Klick. Und Freitagabend ist ‚morgen‘ Samstag – ich will Montag sehen.“ |
| **T18** Fristenrechner Fälle 1, 2, 3a, 4, 5 (D) | erledigt | **erfüllt für Block D.** 5/5 Daten exakt: 01.03.2027 · 30.03.2027 („Ostermontag“) · 09.03.2027 BE („Internationaler Frauentag“) · 08.03.2027 NW · 08.03.2027 3a (OLG Brandenburg). Jedes Datum mit Rechenweg, Norm und Gerichtsort. Fall 3b gehört zu Block A. | 4/4 (Gerichtsort bzw. Bundesland wählbar und im Ergebnis ✓ · Feiertag beim Namen ✓ · Fall 4 FamFG ✓: § 63 Abs. 1 → Di 09.03.2027 BE, § 117 Abs. 1 S. 3 → Do 08.04.2027 · Fall 5 Vertretung ✓) | ≈ 28 (F öffnet den Rechner) / – | 0 | ja (nachgerechnet nach § 188 Abs. 2 und 3 BGB, § 222 Abs. 2 ZPO, § 16 Abs. 2 FamFG). Fehlerprobe: ein Widerspruch zwischen Gericht und Bundesland wird nicht abgefangen (I2-T18-01) | 6 | „Fünf von fünf Daten auf den Tag, Ostermontag und Frauentag beim Namen, FamFG ist drin, die Vertretung auch. Aber wenn ich ‚OLG Hamm‘ eintrage und dann Berlin auswähle, rechnet er kommentarlos mit Berliner Feiertagen für Hamm. Das darf nicht still gehen.“ |
| **T20** Apex Assistent, Text (D, M) | erledigt | **erfüllt.** 5/5 Befehle richtig. Die WV aus Befehl 2 kam erst nach „Eintragen“: Mo 19.10.2026, im Kalender „Durch Assistent angelegt“, zurückzunehmen über „Rückgängig“ in der Antwort bzw. „Streichen – mit Grund“ in der Akte. | 3/3 prüfbar (Text ohne Mikrofon ✓ · Ton 1 Aktion, Kugel einklappen 1 Aktion ✓ · siezt ✓) · M in Chromium 390 px ✓ · Safari/WebKit: nicht prüfbar | ≈ 14 / – | 0 | ja: Befehl 1 hat 0 Abweichungen zum Kalender (1 offene Frist 131/26; Ausblick 5 Fristen und 12 WV wie im Kopf); Befehl 2: 16.10. + 3 = Mo 19.10., ein Werktag ✓; Befehl 3: Rückfrage ✓; Befehl 4: Wiki ✓; Befehl 5: Lena Vogt mit Durchwahl und Rückrufangebot ✓ | 6 | „Jetzt fragt er nach, welche Müller ich meine, und die Wiedervorlage trägt er erst nach meinem ‚Eintragen‘ ein. So gehört sich das. Dass die Auswahl rechts abgeschnitten ist und ‚Ich höre zu‘ stehen bleibt, obwohl er gerade gesagt hat, dass er kein Mikrofon findet – unsauber.“ |
| **T22** Petras Vormittag als Mia Becker (L) | erledigt | **erfüllt.** Die ReFa kann das eEB nicht abgeben. Die Oberfläche erklärt, warum, und bietet nur „Zur eEB-Abgabe vorlegen“ an, vorbelegt mit Dr. Hartmann und mit Protokoll. Petras Urteil „ohne Schulung machbar“: 5/5 (Zuordnen ✓, Fristen ✓, eEB vorlegen ✓, Sammelabrechnung ✓, Bankabgleich ✓). | 4/4 (Lizenz und Team für die ReFa unsichtbar ✓ · WV-Kürzel W vorhanden ✓ und angezeigt ✓ · Fehlaktionen je Teilaufgabe 0/0/0/1/0 · lesbar ohne Zoom ✓) | ≈ 22 (davon WV per Tastatur: W + 5 × Tab + Text + Enter) / – | 1 (Strg+K „Sammelabrechnung“ landet auf der Übersicht) | ja: Berufung Mo 16.11.2026, Begründung Mi 16.12.2026 (Zustellung Fr 16.10.2026). Der KI-Hinweis zur Meldefrist nach § 38 Abs. 1 S. 2 SGB III (Zugang 11.10., abgelaufen 14.10.) ist richtig | 6 | (als Petra) „Zuordnen, Fristen, Vorlegen – und da steht klar, dass die Chefin das eEB selbst abgibt. Das kann ich ohne Schulung. Aber für eine Wiedervorlage mit der Tastatur muss ich fünfmal Tab drücken, weil der Cursor im Aktenfeld steht. In RA-MICRO sind das zwei Buchstaben.“ |

### Befunde

Format je Befund: Schweregrad · Ansicht · Viewport · Modus, dann Beobachtung → Erwartung → Vorschlag.

#### H – hoch

- **I2-T15-01 · H · Vertrauen** · Fristen → Ausgangskontrolle sowie Druckansicht „Fristen heute und morgen“ · L 1366×768 · dunkel
  - **Schritte:**
    1. Ausgangskontrolle öffnen und bei 133/26 „Erledigt …“ wählen.
    2. Nachweis „beA-Versand“ wählen und als Versand eintragen: „Schriftsatz Beweisantritt per beA 18:05 Uhr, Nachricht-ID 4711-2026 …“.
    3. „trotzdem erledigen“ ankreuzen und „Als erledigt protokollieren“ wählen. Das geschah um 21:39 Uhr.
  - **Beobachtung:** Liste und Druckansicht zeigen „versandt – Nachweis: **beA 21:39 Uhr** · Schriftsatz … per beA 18:05 Uhr …“. 21:39 Uhr ist der Zeitpunkt der Protokollierung, nicht des beA-Versands. Im ausgedruckten Kontrollblatt sieht es so aus, als sei der Schriftsatz um 21:39 Uhr per beA rausgegangen.
  - **Erwartung:** Versandzeit und Protokollzeit sind getrennt und eindeutig benannt. Im Wiedereinsetzungsfall muss die Ausgangskontrolle stimmen.
  - **Vorschlag:**
    - Format: „versandt per beA am 16.10.2026 um 18:05 Uhr (Angabe Dr. Hartmann) · protokolliert 21:39 Uhr“.
    - Ist eine ausgehende beA-Nachricht in der Akte, ihren Zeitstempel übernehmen.
    - Sonst ein eigenes Feld „Versandzeit“ (Pflicht).
  - Screenshot: [block-D-T15-nachweis-beA-2139-statt-1805-H-L-dunkel.jpg](bilder/block-D-T15-nachweis-beA-2139-statt-1805-H-L-dunkel.jpg) · Dateien: `src/pages/fristen/ErledigenDialog.tsx`, `src/pages/fristen/logik.ts`, `src/pages/fristen/Ausgangskontrolle.tsx`
- **I2-T18-01 · H · Fachlich** · Fristenrechner · D 1440×900 · hell
  - **Schritte:**
    1. Berufungsfrist wählen, Zustellung 08.02.2027.
    2. Gericht „Oberlandesgericht Hamm“ eintragen. Das Land wird korrekt NRW, das Ergebnis Mo 08.03.2027.
    3. Danach im Feld „Bundesland (Gerichtsort)“ von Hand „Berlin“ wählen.
  - **Beobachtung:** Das Ergebnis springt auf „Dienstag 9. März 2027 · Feiertage: Berlin (Gerichtsort: Oberlandesgericht Hamm)“. Im Rechenweg steht „Feiertage am Gerichtsort geprüft: Berlin (Oberlandesgericht Hamm – Bundesland gewählt)“. Für Hamm ist das einen Tag zu spät.
    - Einziger Hinweis ist der graue Kleintext „Von Hand gewählt.“
    - Gegenprobe mit Kammergericht + NRW ergibt 08.03. statt 09.03., ebenfalls ohne Warnung.
    - Die realistische Reihenfolge funktioniert: erst Bundesland (Kanzleisitz), dann Gericht → Das Gericht gewinnt, Ergebnis Mo 08.03.2027.
  - **Einstufung:** Deshalb H und nicht K. Es bleibt aber ein Fristrisiko, das die Software erkennt und still durchgehen lässt.
  - **Erwartung:** Ein Gericht mit bekanntem Land und ein abweichendes Bundesland gehen nicht ohne deutliche Warnung zusammen. Der Gerichtsort hat Vorrang.
  - **Vorschlag:**
    - Bei bekanntem Gericht das Bundesland sperren und daneben „aus Gericht abgeleitet“ anzeigen.
    - Oder eine rote Warnung mit Pflichtbestätigung: „OLG Hamm liegt in NRW – Sie rechnen mit Berliner Feiertagen“.
    - „Als Frist in Akte eintragen“ erst nach der Bestätigung freigeben.
  - Screenshot: [block-D-T18-olg-hamm-mit-berlin-0903-H-D-hell.jpg](bilder/block-D-T18-olg-hamm-mit-berlin-0903-H-D-hell.jpg) · Datei: `src/pages/fristen/Fristenrechner.tsx`

#### M – mittel

- **I2-T11-01 · M · Bedienbarkeit** · Umzug → Zuordnung → „Vorschau · so werden die Akten angelegt“ · D · hell
  - **Beobachtung:** Bei 1440 px zeigt die Vorschau nur Zeile, Aktenzeichen, Bezeichnung, Mandant und Gegner (angeschnitten). Sachgebiet, Gegenstandswert und Frist sieht man nur nach Querscrollen in der Karte. Gerade diese Werte will ich vor dem Import prüfen („11.400,00 €“, „30.10.2026 Notfrist“).
  - **Erwartung:** Die Prüfwerte stehen ohne Querscrollen im Blick.
  - **Vorschlag:**
    - Gegenstandswert und Frist weiter nach vorn stellen.
    - Mandant und Gegner in einer Zelle zweizeilig zeigen.
    - Oder in diesem Schritt die Seitenkarte „Was zieht um?“ einklappen.
  - Screenshot: [block-D-T11-dublette-in-datei-vorschau-D-hell.jpg](bilder/block-D-T11-dublette-in-datei-vorschau-D-hell.jpg) · Datei: `src/pages/umzug/Schritte.tsx`
- **I2-T14-01 · M · Fachlich** · Akte 142/26 → „Frist“ (Frist anlegen) · M 390×844 · hell
  - **Beobachtung:** Der Dialog öffnet mit Fristart „Kündigungsschutzklage“ und „Zugang der schriftlichen Kündigung: 16.10.2026“ (heute). Daraus wird „Fristende Fr, 06.11.2026“.
    - Laut Kündigungsschreiben in derselben Akte ist die Kündigung am 11.10.2026 per Bote zugegangen.
    - Die richtige Klagefrist Mo 02.11.2026 ist bereits notiert („Von KI erkannt“).
    - Wer vor Saal 3 schnell auf „Frist übernehmen“ tippt, legt eine zweite, vier Tage zu späte Klagefrist an. Eine Warnung gibt es nicht.
  - **Erwartung:** Kein still vorbelegtes Ereignisdatum, so wie die Dauer jetzt Pflicht ist (I1-T14-01). Gibt es schon eine Frist gleicher Art, kommt ein Hinweis.
  - **Vorschlag:**
    - Das Ereignisdatum leer lassen und zur Pflicht machen, oder mit Quelle vorschlagen („aus Kündigungsschreiben: 11.10.2026“).
    - Warnung: „In dieser Akte ist bereits eine Kündigungsschutzklage-Frist notiert (Mo 02.11.2026)“.
    - Beim Öffnen aus der Akte keine Fristart vorbelegen.
  - Datei: `src/pages/akten/FristAnlegen.tsx`
- **I2-T14-02 · M · Look & Feel** · Mobile Tab-Leiste (Akte → Übersicht, Akte → Fristen) · M · hell
  - **Beobachtung:** Die untere Tab-Leiste ist durchscheinend. Beim Scrollen läuft Text sichtbar darunter durch („14 Jahren Betriebszugehörigkeit …“, „Vier-Augen-Kontrolle offen“). Mit Gleitsichtbrille ist das unruhig. Die Kopfleiste hat das Problem nicht mehr (I1-T16-07).
  - **Vorschlag:** Die Tab-Leiste deckend machen wie die Kopfleiste, oder unten so viel Abstand lassen, dass kein Text unter die Leiste läuft.
  - Datei: `src/components/shell/MobileTabBar.tsx`
- **I2-T14-03 · M · Vertrauen** · Akte 142/26 → Dokumente → „Kündigungsschreiben vom 10.10.2026“ (Scan, Absender Kröger Logistik) · M · hell
  - **Beobachtung:** Die Seitenvorschau trägt oben den Kopf „HARTMANN & PARTNER … AZ. 142/26“, darunter der Brief der Gegenseite. Das eingegangene Schreiben sieht aus, als stamme es aus unserer Kanzlei.
  - **Erwartung:** Was ich in der Vorschau sehe, ist das Original.
  - **Vorschlag:** Eingegangene Dokumente ohne eigenen Briefkopf zeigen. Aktenzeichen und Eingangsstempel gehören außerhalb des Papiers in die Kopfzeile des Betrachters.
  - Datei: `src/pages/akten/DokumentVorschau.tsx`
- **I2-T15-02 · M · Verständlichkeit** · Fristen → Ausgangskontrolle → „Morgen“ sowie Druckansicht · L · dunkel
  - **Beobachtung:** Freitagabend zeigt „Morgen“ den Samstag 17.10. („Morgen keine fälligen Fristen“). Die Druckansicht heißt „Fr, 16.10.2026 und Sa, 17.10.2026“. Das Cockpit zeigt dagegen richtig „Heute & Montag fällig“. Montag (3 Einträge) fehlt in der Ausgangskontrolle und im Ausdruck.
  - **Erwartung:** „Nächster Arbeitstag“ statt „Morgen“, bzw. Wochenende und Feiertage überspringen.
  - **Vorschlag:** Den Knopf „Morgen“ umbenennen in „Nächster Arbeitstag (Mo, 19.10.)“, die Druckansicht ebenso.
  - Dateien: `src/pages/fristen/Ausgangskontrolle.tsx`, `src/pages/fristen/Fristen.tsx`
- **I2-T15-03 · M · Fachlich** · Ausgangskontrolle → „Erledigt …“ bei „Fremdgeld an Mandantin weiterleiten (§ 43a Abs. 7 BRAO)“ (131/26) · L · dunkel
  - **Beobachtung:** Als Nachweise gibt es nur beA-Versand, Telefax, Bote, Post, persönlich übergeben und gestrichen. Bei einer Weiterleitungsfrist ist der Nachweis eine Überweisung. Dafür gibt es keine Auswahl, und der Bankabgleich wird nicht verknüpft. Außerdem steht der Hinweis „keine ausgehende beA-Nachricht“ zweimal im Dialog.
  - **Vorschlag:**
    - Nachweisart „Überweisung (Kontoumsatz)“ mit Auswahl des Umsatzes aus dem Bankabgleich.
    - Die Nachweisarten nach Fristart filtern.
    - Den doppelten Hinweis streichen.
  - Datei: `src/pages/fristen/ErledigenDialog.tsx`
- **I2-T18-02 · M · Fachlich** · Einstellungen → Team & Zugänge → „…“ bei Jonas Brandt → „Abwesenheit & Vertretung“ · D · hell
  - **Beobachtung:** Die Auswahl „Vertretung“ bietet „Mia Becker · Fachangestellte“ an. Der Dialog zitiert selbst § 53 BRAO, und dort muss die Vertretung ein Rechtsanwalt sein (F).
  - **Erwartung:** Als Vertretung stehen nur Berufsträger zur Wahl.
  - **Vorschlag:** Die Liste auf die Rollen Partner und Anwalt begrenzen. Optional ein Feld „Sachbearbeitung während der Abwesenheit“ für die ReFa getrennt davon.
  - Datei: `src/pages/einstellungen/TeamTab.tsx`
- **I2-T20-01 · M · Look & Feel** · Apex Assistent → „Öffne die Akte Müller.“ · D 1440×900 und M 390×844 · hell
  - **Beobachtung:** Mit den Auswahlkarten wird der Gesprächsverlauf breiter als das Panel. Meine eigene Frage ist rechts abgeschnitten (am iPhone sieht man nur „Ö“). Die zweite Karte endet bei „… Winkler Möbelwerk GmbH (Gewä…“, die Karten laufen über den Panelrand. Bei Befehl 4 ohne Karten ist alles in Ordnung.
  - **Vorschlag:** Die Karten auf Panelbreite begrenzen (`min-width: 0`, Umbruch statt Überlauf). Lange Rubren zweizeilig zeigen.
  - Screenshot: [block-D-T20-rueckfrage-mueller-abgeschnitten-M-hell.jpg](bilder/block-D-T20-rueckfrage-mueller-abgeschnitten-M-hell.jpg) · Datei: `src/components/assistant/AssistantDock.tsx`
- **I2-T22-01 · M · Tempo** · Akte 126/26 → Taste W → „Wiedervorlage anlegen“ · L · hell · Mia Becker
  - **Beobachtung:** Der Dialog öffnet mit Fokus im Feld „Akte“, obwohl die Akte schon vorbelegt ist. Bis „Worum geht es?“ braucht es 5 × Tab, weil das Datumsfeld mehrere Tabstopps hat.
    - Im ersten Versuch landete mein Text deshalb im Datumsfeld.
    - Beim Enter wurde zum Glück nichts eingetragen.
    - Ein Weg ganz über die Tastatur braucht damit 8 Tastendrücke.
  - **Erwartung:** W, Text tippen, Enter. Mehr nicht.
  - **Vorschlag:**
    - Bei vorbelegter Akte den Fokus direkt in „Worum geht es?“ setzen.
    - Für das Datum Kürzel wie „+3“ oder „+7“ bzw. ein Textfeld „in 3 Tagen“ anbieten.
  - Datei: `src/components/shell/Tastenkuerzel.tsx`

#### N – niedrig

- **I2-T11-02 · N · Verständlichkeit** · Umzug, Schritte 3 und 4 · D · hell
  - Die Zuordnung zeigt den Chip „3 Fristen · 1 WV/Termine“, der Schritt Übernahme danach „2 Fristen zur Kontrolle + 1 Wiedervorlage/Termin“. Gezählt wird einmal vor und einmal nach dem Zusammenführen.
  - Dazu kommen Grammatikfehler: „1 Dublette der Datei werden zusammengeführt“ und „1 Dublette(n)“.
  - → Vorschlag: In beiden Schritten nach der Zusammenführung zählen und Singular und Plural korrekt bilden. Dateien: `src/pages/umzug/Schritte.tsx`, `src/pages/umzug/uebernahme.ts`
- **I2-T11-03 · N · Fachlich** · Akten → Liste (Spalte Gegenstandswert) · D · hell
  - 45/25 steht mit „2.181 €“ in der Liste, die Akte selbst richtig mit „2.180,50 €“. Ich lese Beträge Ziffer für Ziffer.
  - → Vorschlag: In der Liste Cent zeigen oder zumindest nicht aufrunden. Datei: `src/pages/akten/AktenListe.tsx`
- **I2-T11-04 · N · Verständlichkeit** · Umzug → Übernahme → „Offene + abgeschlossene der letzten 6 Jahre“ · D · hell
  - 87/18 (abgelegt, ohne Abschlussdatum in der Datei) wird ausgeschlossen mit dem Satz „liegt außerhalb des gewählten Umfangs“.
  - Nach welchem Datum gerechnet wird, steht nicht da. Nach § 50 Abs. 1 BRAO zählt das Ende des Kalenderjahres, in dem der Auftrag beendet wurde (F), nicht das Anlagedatum.
  - → Vorschlag: Bezugsdatum nennen. Fehlt das Abschlussdatum, Akte nicht still ausschließen, sondern zur Entscheidung vorlegen.
- **I2-T11-05 · N · Bedienbarkeit** · Umzug-Assistent · D · hell
  - Nach dem Neuladen beginnt der Assistent wieder bei Schritt 1. Altsystem, Datei und Zuordnung sind weg.
  - Habe ich das Fenster während „Übernahme läuft … Bitte lassen Sie dieses Fenster geöffnet“ geschlossen, wurde nichts übernommen. Das ist gut, denn es bleibt kein halber Bestand. Beim Wiederkommen gibt es aber keinen Hinweis, dass der Lauf abgebrochen ist.
  - → Vorschlag: Zwischenstand halten. Abgebrochene Läufe im Umzugsprotokoll als „abgebrochen – nichts übernommen“ zeigen.
- **I2-T14-04 · N · Mobil** · Akte → Dokumente, Akte → Notizen · M · hell
  - Am iPhone stehen Desktop-Hinweise: „Tipp: Umschalt-Klick wählt einen Bereich“, „per Drag & Drop sortierbar, per Doppelklick umbenennbar“ und im Notizfeld „(⌘/Strg + Enter speichert)“.
  - → Vorschlag: Hinweise je Gerät zeigen. Datei: `src/pages/akten/TabDokumente.tsx`
- **I2-T15-04 · N · Bedienbarkeit** · Ausgangskontrolle, Cockpit · L · dunkel
  - Die Assistent-Kugel liegt bei 1366×768 über dem Knopf „Erledigt …“ der zweiten Zeile in der Ausgangskontrolle und über der rechten Kante der Posteingangskarte im Cockpit. Er ließ sich zwar klicken, ist aber halb verdeckt.
  - → Vorschlag: Unten rechts Platz für die Kugel freihalten, oder die Kugel in Listenansichten automatisch einklappen.
- **I2-T18-03 · N · Verständlichkeit** · Cockpit → „Sie vertreten heute Jonas Brandt – 2 Fristen bis Fr, 23. Okt. · abwesend bis 30. Okt.“ · D · hell
  - Der Hinweis zählt nur die nächsten 7 Tage. Die Frist am 26.10. (144/26, Jonas Brandt) liegt in der Abwesenheit und fehlt.
  - → Vorschlag: Fristen über den ganzen Abwesenheitszeitraum zählen. Datei: `src/pages/cockpit/KartenArbeit.tsx`
- **I2-T20-02 · N · Verständlichkeit** · Apex Assistent · D und M · hell
  - Vor der Rückfrage „Welche soll ich öffnen?“ steht der Chip „Bereich geöffnet“, obwohl noch nichts geöffnet ist.
  - → Vorschlag: Den Chip erst nach der Auswahl zeigen. Datei: `src/ai/assistent.ts`
- **I2-T20-03 · N · Vertrauen** · Apex Assistent → „Ich brauche meine Ansprechpartnerin.“ · D · hell · Freitag 21:48 Uhr
  - Die Antwort sagt „Lena Vogt – direkt erreichbar … (Mo–Fr 7:30–19:00 Uhr), ohne Warteschleife“. Um 21:48 Uhr ist sie nicht erreichbar.
  - → Vorschlag: Außerhalb der Zeiten so antworten: „jetzt nicht erreichbar – Rückruf ab Montag 7:30 Uhr“. Bei einer Frist am selben Tag den Weg zur Ersatzeinreichung verlinken. Datei: `src/ai/assistent.ts`
- **I2-T20-04 · N · Bedienbarkeit** · Apex Assistent → „Wie funktioniert der Bankabgleich?“ · D · hell
  - Der Link „Zu ‚Zahlungen automatisch zuordnen‘“ führt ins Wiki, nicht in Abrechnung → Bankabgleich.
  - → Vorschlag: Einen zweiten Knopf „Bankabgleich öffnen“ anbieten.
- **I2-T20-05 · N · Bedienbarkeit** · Fristen (Liste) · D · hell
  - Die Wiedervorlage des Assistenten hat auf der Fristen-Seite nur „Erledigt“. Streichen mit Grund geht nur in der Akte (Reiter Fristen).
  - → Vorschlag: „Streichen – mit Grund“ auch in der Fristenliste anbieten. Datei: `src/pages/fristen/FristZeile.tsx`
- **I2-T22-02 · N · Tempo** · Strg+K → „Sammelabrechnung“ → Enter · L · hell
  - Das öffnet Abrechnung → Übersicht, nicht die Sammelabrechnung. Es ist 1 Klick mehr, und der Treffer verspricht etwas anderes.
  - → Vorschlag: Bei Strg+K für Unterbereiche direkt in den Bereich springen („Abrechnung → Sammelabrechnung öffnen“).
- **I2-T22-03 · N · Fachlich** · Posteingang → „Zur eEB-Abgabe vorlegen“ → „Vorlegen an“ · L · hell
  - Jonas Brandt ist bis 30.10. abwesend, steht aber ohne Hinweis in der Auswahl.
  - → Vorschlag: Abwesende kennzeichnen („abwesend – Vertretung: Dr. Hartmann“) und auf die Vertretung umleiten. Datei: `src/pages/posteingang/KiKarte.tsx`
- **I2-T22-04 · N · Vertrauen** · Abrechnung → Sammelabrechnung · L · hell
  - „Einzeln abrechnen: 9 Durchgänge · ≈ 54 Min.“ und danach „≈ 36 Min. gegenüber Einzelabrechnung gespart“ stehen ohne Herleitung und ohne Kennzeichnung als Beispielwert. Gemeint sind wohl 6 Min. je Akte.
  - → Vorschlag: Die Herleitung nennen, z. B. „6 Min. je Rechnung, Annahme“, und wie beim 38h-Motor als Beispielwert kennzeichnen. Datei: `src/pages/abrechnung/Sammelabrechnung.tsx`

**Summe der Befunde:** 25, davon 0 K, 2 H, 9 M und 14 N.

### axe-core (serious/critical)

| Ansicht · Viewport · Modus | serious | critical |
|---|---|---|
| Cockpit · L · dunkel | 0 | 0 |
| Posteingang · L · dunkel | 0 | 0 |
| Fristen → Ausgangskontrolle · L · dunkel | 0 | 0 |
| Dialog „Wie wurde die Frist gewahrt?“ · L · dunkel | 0 | 0 |
| Fristen → Kritische Fristen · L · dunkel | 0 | 0 |
| Akte 142/26 Übersicht · M · hell | 0 | 0 |
| Fristen · M · hell | 0 | 0 |
| Apex Assistent mit Rückfrage · M · hell | 0 | 0 |
| Fristenrechner · D · hell | 0 | 0 |
| Umzug · D · hell | 0 | 0 |
| Abrechnung → Bankabgleich · L · hell (ReFa) | 0 | 0 |

### Positiv (konkret)

- **Umzug:** Er erkennt Windows-1252 von selbst, meldet die Dublette in der Datei vor dem Import und legt die Notfrist nur einmal an. Die abgelegte Akte 87/18 kommt als „Abgeschlossen“ ins Archiv, nicht als offene Akte. Den Probelauf kann ich auch nach dem Neuladen im Umzugsprotokoll zurücknehmen, mit Namen und Uhrzeit. [Bild](bilder/block-D-T11-dublette-in-datei-vorschau-D-hell.jpg)
- **Ausgangskontrolle:** Sie ist genau die Ansicht, die ich wollte: „x offen · y versandt mit Nachweis“. „Erledigt“ geht nur mit Nachweis oder Grund, bei offener Vier-Augen-Kontrolle nur mit Bestätigung. Die Druckansicht ist papierweiß und hat eine Unterschriftenzeile.
- **Fristenrechner:** 5 von 5 Prüfdaten auf den Tag. Das Kammergericht wird automatisch als Berlin erkannt, das OLG Brandenburg als Brandenburg. Der Rechenweg nennt immer den Gerichtsort und den Feiertag. Er sagt auch, wenn ein Feiertag am Kanzleisitz gerade nicht zählt. Die FamFG-Fristen sind da, und das Kürzel F öffnet den Rechner.
- **Widerrufsfrist am iPhone:** Die Dauer ist Pflicht, sonst ist der Knopf gesperrt. Der Rechenweg stimmt (§ 188 Abs. 2 BGB), und der Hinweis „Bei Versäumnis wird der Vergleich wirksam – keine Wiedereinsetzung“ ist fachlich genau richtig.
- **eEB als ReFa:** Klare Erklärung, nur „Zur eEB-Abgabe vorlegen“, vorbelegt mit der bearbeitenden Anwältin. Danach steht im Protokoll: „Zur Abgabe vorgelegt an Dr. Julia Hartmann am 16.10.2026, 21:52 Uhr (von Mia Becker)“.
- **Assistent:** Bei „Müller“ fragt er nach. Die Wiedervorlage trägt er erst nach „Eintragen“ ein, mit „Rückgängig“. Er siezt und spricht mich mit „Frau Dr. Hartmann“ an. Der simulierte Rückruf ist ehrlich gekennzeichnet („es ruft niemand an“).
- **Dunkelmodus abends:** Er ist ruhig. Die Notfrist ist rot mit Symbol und Text, und in den 5 dunklen Ansichten gab es 0 axe-Verstöße.
- **Kennzahlen:** Die Beträge stehen sofort richtig da und zählen nicht mehr hoch.

### Fragebögen (Gesamtsystem nach Block D)

**SUS:** 4 · 2 · 4 · 2 · 4 · 2 · 4 · 2 · 3 · 2 = **72,5 Punkte** (Trendwert, eine simulierte Person; Vorrunde Block D: 65)

**UEQ-S:**

| Skala | Mittel | Einzelwerte |
|---|---|---|
| pragmatisch | **+1,5** | unterstützend +2 · einfach +1 · effizient +1 · übersichtlich +2 |
| hedonisch | **+1,25** | spannend +1 · interessant +2 · originell +1 · neuartig +1 |

**Noten (1–6):**

| Dimension | Note | Begründung |
|---|---|---|
| Look & Feel | 2 | Ruhig und seriös, dunkel wie hell. Abzug für die durchscheinende Tab-Leiste und abgeschnittene Assistentenkarten. |
| Lesbarkeit | 2 | Dunkelmodus gut, PDF am iPhone ohne Zoom lesbar. Abzug für Text unter der Tab-Leiste und viele 32-px-Bedienflächen mobil. |
| Verständlichkeit | 2 | Erklärsätze treffen den Punkt (eEB, § 53 BRAO, Widerruf). Abzug für „Morgen“ = Samstag und widersprüchliche Zähler im Umzug. |
| Vertrauen und Seriosität | 3 | Viel besser als die 4 der Vorrunde: Protokolle, Kennzeichnung „simuliert“, Rücknahme. Aber eine falsche Versandzeit im Nachweis und ein stiller Widerspruch zwischen Gericht und Bundesland kosten Vertrauen. |
| Tempo | 2 | F, W, ? und Strg+K funktionieren, und die Akte ist in 3 Taps offen. Für die WV per Tastatur braucht es aber 5 × Tab. |
| Fachliche Korrektheit | 2 | Alle Fristen exakt, die SGB-III-Meldefrist richtig. Abzug für Vertretung durch eine ReFa und ein still mit „heute“ vorbelegtes Ereignisdatum. |
| Mobil | 2 | T14 in 3 + 7 Aktionen ohne Querscrollen, axe 0. Der Termin fehlt (Demodaten), und Frist und Notiz liegen nicht im Daumenbereich. |

**Empfehlung (0–10):** 7 (Vorrunde Block D: 5)

**Kauf heute:** unter Bedingungen. Die Versandzeit im Nachweis muss stimmen (I2-T15-01). Der Widerspruch zwischen Gericht und Bundesland muss gesperrt oder gewarnt sein (I2-T18-01). Als Vertretung dürfen nur Berufsträger wählbar sein (I2-T18-02). Danach reden wir über Vertrag und Preis.

**Top 3 Verbesserungen (nach Dringlichkeit):**
1. **Ausgangskontrolle haftungsfest machen:** Versandzeit und Protokollzeit trennen (I2-T15-01), Nachweisart „Überweisung“ für Zahlungsfristen (I2-T15-03), „nächster Arbeitstag“ statt „Morgen“ (I2-T15-02).
2. **Fristen nie still falsch:** Einen Widerspruch zwischen Gericht und Bundesland sperren oder warnen (I2-T18-01). Beim Anlegen aus der Akte kein Ereignisdatum „heute“ vorbelegen, und vor einer zweiten Frist gleicher Art warnen (I2-T14-01).
3. **Vertretung und Mobil:**
   - Vertretung nach § 53 BRAO nur durch Berufsträger, Abwesende in Auswahllisten kennzeichnen (I2-T18-02, I2-T22-03).
   - Mobil: deckende Tab-Leiste, Frist und Notiz im Daumenbereich, Flächen ≥ 44 px (I2-T14-02, I1-T14-05).
   - Demodaten 142/26 mit Gütetermin (I1-T14-07).

### Bilder

| Datei | Was es zeigt |
|---|---|
| [block-D-T11-dublette-in-datei-vorschau-D-hell.jpg](bilder/block-D-T11-dublette-in-datei-vorschau-D-hell.jpg) | Umzug, Zuordnung (D, hell): „Dubletten in der Datei“ mit Zusammenführen, Status „doppelt in der Datei“ bzw. „abgeschlossen“. Rechts angeschnittene Vorschau (I2-T11-01). |
| [block-D-T15-nachweis-beA-2139-statt-1805-H-L-dunkel.jpg](bilder/block-D-T15-nachweis-beA-2139-statt-1805-H-L-dunkel.jpg) | Druckansicht der Ausgangskontrolle (L, dunkel): papierweiß, mit Unterschriftenzeile, aber „Nachweis: beA 21:39 Uhr“ für einen Versand um 18:05 Uhr (I2-T15-01, H). |
| [block-D-T18-olg-hamm-mit-berlin-0903-H-D-hell.jpg](bilder/block-D-T18-olg-hamm-mit-berlin-0903-H-D-hell.jpg) | Fristenrechner (D, hell): Gericht „Oberlandesgericht Hamm“, Bundesland von Hand „Berlin“ → „Di, 9. März 2027 · Feiertage: Berlin (Gerichtsort: Oberlandesgericht Hamm)“ (I2-T18-01, H). |
| [block-D-T20-rueckfrage-mueller-abgeschnitten-M-hell.jpg](bilder/block-D-T20-rueckfrage-mueller-abgeschnitten-M-hell.jpg) | Assistent am iPhone (M, hell): richtige Rückfrage bei zwei Akten „Müller“, aber Frage und Karten rechts abgeschnitten (I2-T20-01). |

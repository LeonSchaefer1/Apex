# Iteration 5 – Usability-Bericht AnwaltApex (Abnahme)

**Kundenavatar:** Claudia Reinholz (50), Fachanwältin für Arbeitsrecht, geschäftsführende Partnerin einer kleinen Sozietät in Paderborn (fiktiv)
**Schwerpunkt:** Abnahme und Kaufentscheidung · **Datum:** Samstag, 17.10.2026, ca. 09:20–10:38 Uhr · **Codestand:** nach Umsetzung von Iteration 4 (`SEED_VERSION` 12, 205 Tests)
**Betrieb:** Browser-Demo (Demo-KI offline, Daten im Browserspeicher) · Chromium (Playwright, `de-DE`, Europe/Berlin) · Viewports wie je Aufgabe vorgegeben (D 1440×900, L 1366×768, M 390×844), **hell**, T15 dunkel · Nachtest-Proben zusätzlich dunkel, Reflow 320 px, 200 % (720×450 @2x), nur Tastatur und „Bewegung reduzieren“ · axe-core je Ansicht
**Testleitung:** Avatar-Werkzeug, vier Blöcke in getrennten frischen Profilen (`i5-A` … `i5-D`): A Erstkontakt, Verwaltung, Hilfe und 38h-Motor · B Alltag Mandatsarbeit · C Kanzlei, Geld und KI · D Umzug, mobil, abends, Assistent und ReFa
**Rohdaten:** [Block A](iteration-5/block-A.md) · [Block B](iteration-5/block-B.md) · [Block C](iteration-5/block-C.md) · [Block D](iteration-5/block-D.md) · Vorrunde: [Iteration 4](iteration-4.md)

> Die Zahlen stammen von einer einzigen simulierten Person. SUS, UEQ-S, Noten und Preisangaben sind deshalb **Trendwerte** und keine Statistik.

> **Uhrzeit des Tests:** Auch die Abnahmerunde lief am Samstagvormittag, also außerhalb der Servicezeit (Mo–Fr 7:30–19:00 Uhr). Das Avatar-Werkzeug konnte die Seitenuhr weiter nicht setzen. Die Werktagssituationen (T12 um 16:50 Uhr, T15 um 21:30 Uhr, der Termintag in T14) sind deshalb mit Ersatzwegen geprüft: Verhalten außerhalb der Servicezeit, „Nächster Arbeitstag (Mo, 19.10.)“ und eine selbst angelegte Testfrist.

---

## 1. Kurzfazit

1. **Die beste Runde der Studie – und die erste, in der das Ziel bei SUS und Noten erreicht ist.**
   - **24 von 24 Aufgaben** ohne Umweg und ohne Hilfe erledigt (Vorrunde 21). Die Fehlaktionen sinken von 11 auf **4**, das SEQ-Mittel steigt auf **6,2**.
   - **SUS 80,6** (Trendwert; Ziel ≥ 80 erstmals erreicht). Das Schulnoten-Mittel fällt auf **1,83**; jede Dimension liegt im Mittel bei höchstens 2,0.
   - **axe-core: 0 serious, 0 critical** in allen 72 geprüften Ansichten (Vorrunde: 1 serious).
   - **Nachtest:** 54 von 58 offenen IDs behoben, 2 teilweise, 2 nicht prüfbar, **keine nicht behoben**. Der K-Befund und alle drei H-Befunde der Vorrunde sind behoben.
2. **Kaufentscheidung: viermal „unter Bedingungen“, Empfehlung 8 von 10 in jedem Block.**
   - Alle vier Blöcke empfehlen Bernd Hollmann den Kauf, sobald ein schriftliches Angebot vorliegt (Abschnitt 4).
   - Die Preisbereitschaft passt zum Rechenweg im Kundenavatar (Abschnitt 6.5): **günstig ≈ 12.000 €** für 7 Arbeitsplätze, **„teuer, aber noch“ 20.000–25.000 €** (nur mit Pilot oder Raten), **zu teuer ab 30.000–35.000 €**, Wartung bis **15 % pro Jahr** (höchstens 2.000–2.500 €).
3. **Ein K-Befund, kein H-Befund.**
   - **I5-T03-01 (K):** Die Korrektur einer Notfrist lässt ein Zustellungsdatum in der Zukunft und nach dem protokollierten eEB-Datum zu, ohne Warnung (Berufungsfrist 118/26: Do 19.11. statt Di 17.11.2026). **Im Code bestätigt:** Der Korrekturdialog prüft das Ereignisdatum nicht.
   - Dazu **7 M** und **24 N**: insgesamt 32 Befunde, keine Duplikate.
4. **Abnahmeziel (Kundenavatar 1.12): 4 von 9 Punkten erfüllt, 2 teilweise, 3 nicht erfüllt.**
   - **Erfüllt:** alle 24 Aufgaben ohne Hilfe, alle Prüfwerte exakt, axe ohne serious/critical, SUS ≥ 80.
   - **Teilweise:** UEQ-S hedonisch +1,44 statt +1,5; eine Einzelnote über 2,0.
   - **Nicht erfüllt:** ein offener K-Befund, Vertrauen und Fachliche Korrektheit nicht bei 1, Kaufbedingungen noch nicht nur Vertrag und Preis.
   - **Produktseitig fehlen drei Punkte:** I5-T03-01 (Block B), I5-T07-01 (Block C) und I5-T13-01 (Block A). Alles Übrige entscheidet der Auftraggeber (Abschnitt 4.6).
5. **Entscheidung der Testleitung:**
   - **Alle 32 Befunde werden umgesetzt**: 4 angepasst, 2 im Umfang erweitert, 1 Teil verworfen.
   - Dazu kommt die Vorgabe der Projektleitung: Die Elbtal-Zahlung 6.120 € in 131/26 bekommt einen Kontoumsatz auf dem Anderkonto (`SEED_VERSION` 13).
   - Die Umsetzung läuft in zwei Paketen mit getrennten Dateibereichen: **A mit 8 Aufträgen, B mit 9** (Abschnitt 11).
   - **Stand nach der Umsetzung: 32 / 32 umgesetzt**, der K-Befund und alle 7 M-Befunde in der Prüfung im Browser nachgestellt; Qualitätstor, Konsolen-Sweep, axe und Artefakt-Probe ohne Befund (Abschnitt 12).
6. **Empfehlung der Testleitung:**
   - Nach der Umsetzung einen **kurzen Abnahme-Nachtest** mit dem Avatar fahren: T03, T07 und T13, dazu die Folgepunkte aus T02, T14, T22 und T23.
   - Damit lassen sich die Produktbedingungen der Blöcke A, B und C ausräumen. Danach hängen Kauf und Abnahme nur noch an Entscheidungen des Auftraggebers.

---

## 2. Kennzahlen

| Kennzahl | Iteration 5 | Abnahmeziel (1.12) |
|---|---|---|
| Aufgaben erfolgreich (ohne Umweg) | **24 / 24** · mit Umweg 0 · mit Hilfe 0 · abgebrochen 0 | 24 / 24 ohne Hilfe |
| Erfolgskriterium erfüllt | **24 / 24** (T21 mit 19 statt 18 Aktionen – zwei neue Pflichtangaben, vom Avatar ausdrücklich gewollt) | 24 / 24 |
| Fachlich korrekt (je Aufgabe) | **23 / 24** – nein bei T03 (Fristkorrektur gegen das eEB-Datum, I5-T03-01) | alle Prüfwerte exakt |
| Fehlaktionen | **4** (A 0 · B 1 · C 1 · D 2) | – |
| SEQ-Mittel (1–7) | **6,2** (25 Einzelwerte; T18 lief in A und D) · A 6,43 · B 6,0 · C 6,2 · D 6,17 | – |
| SUS (Trendwert) | **80,6** (A 82,5 · B 77,5 · C 80,0 · D 82,5) | ≥ 80 |
| UEQ-S pragmatisch / hedonisch | **+1,69 / +1,44** (A +1,75/+1,5 · B +1,75/+1,25 · C +1,5/+1,5 · D +1,75/+1,5) | ≥ +1,5 / ≥ +1,5 |
| Schulnoten-Mittel | **1,83** (27 Noten; Block C hat „Mobil“ nicht bewertet) | alle ≤ 2,0; Vertrauen und Fachlich = 1 |
| Empfehlung (0–10) | **8,0** (8 · 8 · 8 · 8) | – |
| Kauf heute | **4 × „unter Bedingungen“** – Block D nur noch Vertrag und Preis; A, B und C mit je einer Produktbedingung | ja, oder nur noch Vertrag und Preis |
| axe-core serious / critical | **0 / 0** in 72 Prüfzeilen (A 19 · B 13 · C 23 · D 17; in Block A fasst eine Zeile sechs Einstellungs-Reiter zusammen) | 0 / 0 |
| Befunde roh | 32: K 1 · H 0 · M 7 · N 24 (je Block 8) | – |
| **Befunde nach Zusammenführung** | **32: K 1 · H 0 · M 7 · N 24** (keine Duplikate, keine ID-Kollision) | 0 offene K und H |
| Entscheidung | 32 umsetzen (davon 4 angepasst, 2 erweitert) · 1 Teil verworfen · 0 ganz verworfen | – |
| Nachtest Vorrunde | 58 IDs: **54 behoben** · 2 teilweise · 0 nicht behoben · 2 nicht prüfbar | – |

> **Hinweis zu den SEQ-Werten:** In den strukturierten Ergebnissen von Block B und D stehen an der Stelle der SEQ-Werte laufende Nummern (1 … 7). Maßgeblich sind die Werte in den Block-Berichten. Für Block B ergeben sie das dort genannte Mittel von 6,0.

**Fachliche Prüfwerte**

| Aufgabe | Ergebnis |
|---|---|
| T18 | **6/6 exakt:** Fall 1 **Mo 01.03.2027** (§ 188 Abs. 3 BGB, Kalender mit Februar) · Fall 2 **Di 30.03.2027** (Ostermontag) · **Di 09.03.2027** (BE, Frauentag) · **Mo 08.03.2027** (NW, OLG Hamm) · Fall 3a **Mo 08.03.2027** (OLG Brandenburg, Frauentag dort kein Feiertag) · Fall 3b **Mo 01.11.2027** (Hessisches LAG, „Allerheiligen – in NRW Feiertag, in Hessen nicht“), Vorfrist Mo 25.10.2027. FamFG § 63 Abs. 1, 2 und § 117 Abs. 1 S. 3 vorhanden (Bekanntgabe Fr 15.01.2027 → Mo 15.03.2027). Fall 5: Vertretung schon am Samstag vor Beginn sichtbar |
| T07 | **16/16 exakt** (2.968,46 € / 2.797,69 €); Zeithonorar 1,5 Std. × 240 € = **360,00 € + 68,40 € = 428,40 €** (XRechnung); RSV-Split 2.818,46 € + SB 150,00 €; Storno RE-2026-0025 −1.117,53 €; Sammelabrechnung 4 Akten **2.281,89 €** in 4 Aktionen |
| T09 | **0,00 € Abweichung** in 6 Abschnitten (155,77 €, 183 Tage), Satzwechsel 6,27 % → 6,52 % zum 01.07.2026; Zinsrechner **A 43,23 € · B 26,79 € · C 42,72 €**; § 367 BGB 637,00 € → 142,51 € → 220,49 € |
| T04 | Klagefrist **Mo 02.11.2026** mit Rechenweg in 7 Schritten; Gegenstandswert **11.400,00 €** (3 × 3.800 €, § 42 Abs. 2 S. 1 GKG) |
| T11 | **0 Zeichenfehler** (Windows-1252), 11.400,00 €, 2.180,50 €, Notfrist Fr 30.10. und Verjährung 31.12. in der Vier-Augen-Kontrolle |
| T02 / T03 / T22 | Berufung **Di 17.11.2026** (§ 517 ZPO), Begründung **Do 17.12.2026** (§ 520 Abs. 2 S. 1 ZPO), Vorfristen werktags 10.11./03.12.; RVG-Stichprobe 151/26 **1.117,53 €**. **T03 fachlich nein:** Der Rechenkern rechnet richtig, aber die Korrektur ließ ein Fristende Do 19.11. gegen das eEB-Datum zu (I5-T03-01) |
| T10 | eigene Zahl 1.213 Min. = **20,22 Std./Woche** × 48 × 26,04 € = **25.273,38 €**; Anwaltszeit 2 × 48 × 240 € = 23.040 €; Demo-Kopf 28,20 × 48 × 26,04 € = 35.247,74 € |
| T06 / T19 | 3/3 BAG-Entscheidungen mit Gericht, Datum, Az.; Abfindung 23.800–47.600 €; Ausschlussfrist **Mi 30.12.2026** (Vorfrist 16.12.), Fälligkeit erfragt, „Verwerfen“ ändert 0 Daten |
| T08 | 5.670,00 € auf dem Anderkonto (107/26); 6.120,00 € an Elif Yilmaz weitergeleitet (SEPA pain.001); Albrecht 1.117,53 € auf Korrekturrechnung RE-2026-0026 |
| T14 / T00 / T01 / T16 / T23 | Widerruf **Di 03.11.2026** (Vorfrist Fr 30.10.) · Landing-Vorschau Mo 16.11.2026 · Bußgeld-Einspruch § 67 Abs. 1 OWiG (128/26 Fr 23.10.; Testzugang Di 20.10.) · Aufbewahrung bis **31.12.2032** (§ 50 BRAO) |

**Schulnoten je Dimension** (1 = sehr gut … 6 = ungenügend)

| Dimension | A | B | C | D | Mittel | Iteration 4 |
|---|---|---|---|---|---|---|
| Look & Feel | 2 | 2 | 2 | 2 | **2,0** | 2,0 |
| Lesbarkeit | 2 | 2 | 2 | 2 | **2,0** | 2,25 |
| Verständlichkeit | 2 | 2 | 2 | 2 | **2,0** | 2,0 |
| Vertrauen und Seriosität | 2 | 2,5 | 1 | 1 | **1,63** | 2,25 |
| Tempo | 2 | 2 | 2 | 2 | **2,0** | 2,25 |
| Fachliche Korrektheit | 1 | 2 | 1 | 1 | **1,25** | 1,38 |
| Mobil | 2 | 2 | – | 2 | **2,0** | 2,0 |

**Aufgaben im Überblick**

| Aufgabe | Block · Viewport | Ergebnis | Erfolgskriterium | SEQ | Fehlakt. |
|---|---|---|---|---|---|
| T00 Landing | A · D, M (Nachtest dunkel, 320 px) | erledigt | **erfüllt:** Satz nach 5 s zutreffend, 5 von 5 Zielen in je ≤ 2 Aktionen; Wartungspreis fehlt (Auftraggeber) | 7 | 0 |
| T21 Apex Console | A · D | erledigt | **erfüllt:** 19 / 18 Aktionen (Pflichtangaben zur Neuvergabe), NRW aus „Paderborn“, K-Probe Datenschutz bestanden | 6 | 0 |
| T16 Erste Anmeldung | A · L | erledigt | **erfüllt:** 6 / 8 Aktionen, 3 von 3 Fehlermeldungen mit nächstem Schritt, Anbieter-Eingriff vollständig im Protokoll | 7 | 0 |
| T18 Fristenrechner | A (3b) + D (1, 2, 3a, 4, 5) · D | erledigt | **erfüllt:** 6/6 Daten, FamFG, Vertretung vorab | 7 / 7 | 0 / 0 |
| T10 38h-Motor | A · L | erledigt | **erfüllt:** eigene Zahl 20,22 Std./Woche → 25.273,38 €; zwei Kostensätze auf einer Seite (M) | 6 | 0 |
| T12 Störung, Hilfe | A · L | erledigt | **erfüllt:** § 46g S. 3, 4 ArbGG / § 130d S. 2, 3 ZPO, Rückruf in 1 Aktion, ehrlicher Hinweis außerhalb der Servicezeit | 6 | 0 |
| T13 Einstellungen | A · D | erledigt | **erfüllt:** 7 von 7 in ≤ 3 Aktionen; Prüfpunkte 9/12 (3 × Auftraggeber); widersprüchliche Wartungsaussage (M) | 6 | 0 |
| T01 Cockpit | B · D hell und dunkel, 320 px | erledigt | **erfüllt:** 4 von 4 ohne Scrollen, deckungsgleich mit Fristen und Posteingang | 7 | 0 |
| T02 beA-Posteingang | B · D | erledigt | **erfüllt:** 118/26 zu 99 %, beide Rechenwege in 3 Aktionen; Umhängen 5 statt ≤ 3 Aktionen (M) | 6 | 1 |
| T03 eEB, Vier-Augen | B · D | erledigt | **erfüllt** (Protokoll 4/4, Übernahme 1 Aktion) – **fachlich nein:** Korrektur gegen das eEB-Datum (K) | 5 | 0 |
| T04 Mandatsaufnahme | B · L | erledigt | **erfüllt:** 155/26 in 18 / 25 Aktionen, 02.11.2026, 11.400 €, Kollision schon in Schritt 1 | 6 | 0 |
| T05 E-Akte | B · D | erledigt | **erfüllt:** 10 / 12 Aktionen, Verbleib in der Akte | 6 | 0 |
| T17 Kontakte | B · D | erledigt | **erfüllt (2/2):** Dublette nur mit Begründung, Kollision über die Dublette | 6 | 0 |
| T23 Aktenübersicht, Nachfolge | B · D | erledigt | **erfüllt:** 3 Akten in 4 Aktionen übergeben; Deaktivieren mit „nicht übertragen“ vorbelegt (M) | 6 | 0 |
| T06 Fallanalyse, Suche | C · D | erledigt | **erfüllt:** 3/3 Entscheidungen, Strg+K in 8 ms | 6 | 0 |
| T07 Abrechnung | C · D (+ Tastatur) | erledigt | **erfüllt:** 16/16 + 428,40 €; negativer Gegenstandswert ohne Meldung (M) | 6 | 1 |
| T08 Bankabgleich, Fremdgeld | C · L | erledigt | **erfüllt:** 0 Buchungen unter 90 % ohne Bestätigung, 11/11 mit Sicherheit und Merkmal | 6 | 0 |
| T09 Forderungskonto | C · D (+ dunkel) | erledigt | **erfüllt:** 0,00 € Abweichung, A–C exakt | 7 | 0 |
| T19 Dokument-Analyse | C · D | erledigt | **erfüllt:** Fälligkeit erfragt, Mi 30.12.2026 vom Fristenrechner, Verwerfen ändert nichts | 6 | 0 |
| T11 Umzug | D · D | erledigt | **erfüllt:** 0 Zeichenfehler, Dublette vor dem Import, Rückgängig mit Namen | 6 | 0 |
| T14 Mobil am Gericht | D · M | erledigt | **erfüllt:** Akte in 2 Taps, Notiz + Widerrufsfrist in 9 Aktionen; Aktionen nicht im Daumenbereich (M) | 6 | 0 |
| T15 Dunkelmodus, Tagesabschluss | D · L dunkel, 200 % | erledigt | **erfüllt:** 0 Fristen ohne Kennzeichnung, Drucken vorhanden | 6 | 0 |
| T20 Apex Assistent | D · D, M | erledigt | **erfüllt:** 5/5 Befehle, Doppelungswarnung, Rückfrage bei „Meyer“ | 6 | 0 |
| T22 Petras Vormittag (ReFa) | D · L Tastatur | erledigt | **erfüllt:** ReFa legt das eEB nur vor (§ 173 Abs. 3 ZPO), 5/5 ohne Schulung | 6 | 2 |

---

## 3. Vergleich zur Vorrunde

| Kennzahl | Iteration 1 | Iteration 2 | Iteration 3 | Iteration 4 | **Iteration 5** | Veränderung zu I4 | Ziel (1.12) |
|---|---|---|---|---|---|---|---|
| Aufgaben ohne Umweg | 6 / 24 | 22 / 24 | 21 / 24 | 21 / 24 | **24 / 24** | +3 | 24 / 24 |
| Erfolgskriterium erfüllt | 8 / 24 | 24 / 24 | 24 / 24 | 24 / 24 | **24 / 24** | ± 0 | 24 / 24 |
| Gescheitert oder abgebrochen | 6 | 0 | 0 | 0 | **0** | ± 0 | 0 |
| Fachlich korrekt | – | 22 / 24 | 23 / 24 | 23 / 24 | **23 / 24** | ± 0 (T03 statt T17) | alle |
| Fehlaktionen | 25 | 12 | 11 | 11 | **4** | −7 | – |
| SEQ-Mittel | 4,6 | 5,8 | 6,0 | 5,9 | **6,2** | +0,3 | – |
| SUS (Trendwert) | 65,6 | 71,9 | 76,3 | 78,1 | **80,6** | +2,5 | ≥ 80 |
| UEQ-S pragmatisch | +1,13 | +1,44 | +1,63 | +1,63 | **+1,69** | +0,06 | ≥ +1,5 |
| UEQ-S hedonisch | +1,25 | +1,38 | +1,31 | +1,25 | **+1,44** | +0,19 | ≥ +1,5 |
| Schulnoten-Mittel | 2,6 | 2,13 | 2,07 | 2,02 | **1,83** | −0,19 (besser) | alle ≤ 2,0 |
| Note Lesbarkeit | 2,75 | 2,0 | 2,13 | 2,25 | **2,0** | −0,25 | ≤ 2,0 |
| Note Tempo | 2,25 | 2,13 | 2,0 | 2,25 | **2,0** | −0,25 | ≤ 2,0 |
| Note Vertrauen | 3,5 | 2,88 | 2,25 | 2,25 | **1,63** | −0,63 | 1 |
| Note Fachliche Korrektheit | 2,75 | 1,88 | 1,50 | 1,38 | **1,25** | −0,13 | 1 |
| Note Mobil | 2,67 | 2,0 | 2,63 | 2,0 | **2,0** | ± 0 | ≤ 2,0 |
| Empfehlung (0–10) | 5,5 | 7,0 | 7,75 | 7,75 | **8,0** | +0,25 | – |
| Kauf heute | 0 × ja | 4 × unter Bed. | 4 × unter Bed. | 4 × unter Bed. | **4 × unter Bed.** (1 × nur Vertrag und Preis) | Bedingungen kleiner | nur Vertrag und Preis |
| axe-core serious / critical | 14 / 6 in 49 | 0 / 0 in 51 | 3 / 0 in 56 | 1 / 0 in 84 | **0 / 0 in 72** | −1 | 0 / 0 |
| Befunde (K · H · M · N) | 133 (4 · 42 · 63 · 24) | 88 (2 · 8 · 35 · 43) | 59 (0 · 8 · 23 · 28) | 52 (1 · 3 · 19 · 29) | **32 (1 · 0 · 7 · 24)** | −20; H −3, M −12 | 0 offene K und H |
| Nachtest Vorrunde | – | 141 IDs, 124 behoben (88 %) | 104 IDs, 99 (95 %) | 69 IDs, 65 (94 %) | **58 IDs, 54 (93 %)** | 0 nicht behoben | – |

**Einordnung:**

- **Breit besser, nicht nur im Schnitt.** Fünf der sieben Notendimensionen verbessern sich oder halten 2,0. „Vertrauen“ springt von 2,25 auf 1,63, weil der Anbieter-Eingriff im Protokoll, das Fremdgeld auf dem Anderkonto und die Kollisionsprüfung über Dubletten jetzt tragen. Block C und D vergeben dafür eine 1.
- **Der Rest ist eng umrissen.** Es gibt keinen H-Befund mehr. Die sieben M-Befunde sind Reibung oder eine fehlende Plausibilitätsprüfung, keine Rechenfehler. Der eine K-Befund ist eine Prüflücke im Korrekturweg, nicht im Fristenrechner. Er drückt die Noten von Block B (Vertrauen 2,5, Fachlich 2) und damit die Abnahmepunkte „Vertrauen = 1“ und „Fachlich = 1“.
- **Nachtest-Quote 93 % trotz strenger Zählung.** Von den 54 IDs der Iteration 4 sind 53 behoben. I4-T11-02 ist nur teilweise behoben (Zählung im Umzugsprotokoll nach „Rückgängig“). Die übrigen vier offenen IDs sind ältere Auftraggeber- oder Werkzeugpunkte.

---

## 4. Abnahme und Kaufentscheidung

### 4.1 Abgleich mit dem Abnahmeziel (Kundenavatar 1.12)

| # | Abnahmeziel | Ergebnis Iteration 5 | Bewertung |
|---|---|---|---|
| 1 | Alle 24 Aufgaben (T00–T23) ohne Hilfe erledigt | 24 / 24 erledigt, 0 mit Hilfe, 0 mit Umweg, 0 abgebrochen | **erfüllt** |
| 2 | 0 offene K- und H-Befunde | **1 K offen:** I5-T03-01 (Fristkorrektur gegen das eEB-Datum). **1 H teilweise:** I1-T00-02 (Impressum), wartet auf echte Anbieterdaten vom Auftraggeber | **nicht erfüllt** – I5-T03-01 ist Auftrag B-01; das Impressum entscheidet der Auftraggeber |
| 3 | Alle Prüfwerte exakt: T04, T07 (16 Werte + Zeithonorar), T09 (Satzwechsel, A–C), T11 (0 Zeichenfehler), T18 (6 Daten) | T04 02.11.2026 / 11.400 € · T07 16/16 + 428,40 € · T09 0,00 €, Satzwechsel, A–C · T11 0 Zeichenfehler · T18 6/6 | **erfüllt** |
| 4 | axe-core ohne Verstoß „serious“ und „critical“ in allen geprüften Ansichten | 0 / 0 in 72 Prüfzeilen (hell, dunkel, 200 %, 320 px, iPhone) | **erfüllt** |
| 5 | SUS ≥ 80 (Trendwert) | **80,6** (A 82,5 · B 77,5 · C 80,0 · D 82,5) | **erfüllt** (knapp; Block B wegen I5-T03-01 bei 77,5) |
| 6 | UEQ-S ≥ +1,5 in beiden Skalen | pragmatisch **+1,69** · hedonisch **+1,44** (B +1,25) | **teilweise** – hedonisch knapp verfehlt |
| 7 | Alle Schulnoten ≤ 2,0 | Mittel je Dimension höchstens 2,0; als Einzelnote 26 von 27 ≤ 2,0 (Block B Vertrauen 2,5) | **teilweise** |
| 8 | Vertrauen und Fachliche Korrektheit = 1 | Vertrauen **1,63** (A 2 · B 2,5 · C 1 · D 1), Fachlich **1,25** (A 1 · B 2 · C 1 · D 1) | **nicht erfüllt** – B wegen I5-T03-01; A wegen offener Vertragsfragen (Impressum, Wartungspreis, Übertragbarkeit, Escrow, KI in den USA) |
| 9 | Kauf heute „ja“ oder „unter Bedingungen“, die nur noch Vertrag und Preis betreffen | 4 × unter Bedingungen; **nur Block D** ausschließlich Vertrag und Preis. Produktbedingungen: A I5-T13-01 (eine Wartungsaussage), B I5-T03-01, C I5-T07-01 | **nicht erfüllt** – alle drei Produktbedingungen sind Aufträge dieser Runde (A-02, B-01, B-03) |

**Was bis zur Abnahme fehlt:**

1. **Produkt:** I5-T03-01 (K), I5-T07-01 (M) und I5-T13-01 (M) umsetzen und im Abnahme-Nachtest vorführen. Block B macht die Vorführung zur Kaufbedingung.
2. **Auftraggeber:** die Entscheidungen aus Abschnitt 4.6. Sie bestimmen die Vertrauensnote von Block A und die Kaufbedingungen aller Blöcke.
3. **Trendwerte neu messen:** UEQ-S hedonisch (+1,44) und die Noten „Vertrauen“ und „Fachlich“ nach dem Abnahme-Nachtest. Für den hedonischen Wert gibt es keinen eigenen Befund. Block B begründet ihn mit „neuartig +1“.

### 4.2 Kauf heute – Bedingungen je Block

| Block | Kauf heute | Bedingungen |
|---|---|---|
| A – Erstkontakt, Verwaltung | unter Bedingungen | schriftliches Angebot mit Lizenz- und Wartungspreis für 7 Arbeitsplätze und **einer** Aussage zur Wartung (**I5-T13-01**) · Übertragbarkeit und Quellcode-Hinterlegung verbindlich · KI-Verarbeitung in der EU oder nach § 43e Abs. 4 BRAO tragfähig (bis dahin nur Offline-KI) · echtes Impressum |
| B – Alltag Mandatsarbeit | unter Bedingungen | **I5-T03-01 behoben und vorgeführt**; sonst Vertrag und Preis (Angebot mit Wartung, Übertragbarkeit/Escrow, KI in der EU, Impressum) |
| C – Kanzlei, Geld, KI | unter Bedingungen | produktseitig nur **I5-T07-01** (Eingabeprüfung Gegenstandswert); sonst Angebot mit Gesamtkosten über 5 Jahre für 7 Arbeitsplätze inkl. Wartung, KI-Verarbeitung in der EU vertraglich, Escrow bzw. offenes Exportformat, Impressum |
| D – Umzug, mobil, ReFa | unter Bedingungen, **nur Vertrag und Preis** | Angebot mit Lizenz- und Wartungspreis (Lizenz um 15.000 €) · Festpreis und Termin für den begleiteten Umzug der Altakten (Dokumente, Aktenkonten, offene Posten, 11.000 Archivakten) · Übertragbarkeit und Escrow · Impressum und KI in der EU |

### 4.3 Empfehlung an Bernd Hollmann (je Block, wörtlich)

> **Block A:** „Bernd, ich empfehle den Kauf – aber erst mit schriftlichem Angebot: Die Fristen stimmen auf den Tag, mit Feiertag am Gerichtsort und Rechenweg, und der Anbieter kann bei uns nichts tun, ohne dass es mit Namen und Anlass in unserem Protokoll steht. Mit unseren eigenen Mengen spart der Motor rund 20 Stunden pro Woche, zu ReFa-Kosten etwa 25.000 € im Jahr – keine 38 Stunden, aber eine halbe Stelle, und das Programm rechnet es offen vor. Bedingung sind eine Lizenz für 7 Plätze um 15.000 €, Wartungspreis, Übertragbarkeit und Escrow schriftlich, und die KI bleibt offline, bis die Verarbeitung in der EU geregelt ist.“

> **Block B:** „Bernd, Posteingang, eEB, Mandatsaufnahme mit Kollisionsprüfung und die Rechtsschutz-Abwicklung sind jetzt auf dem Stand, den wir von RA-MICRO kennen, und an vielen Stellen besser – mit Rechenweg, Protokoll und Vier-Augen-Kontrolle, und die Kollisionslücke aus der letzten Runde ist zu. Kaufen würde ich unter einer Bedingung: Die Korrektur einer Notfrist darf nicht hinter das eEB-Datum rutschen, ohne dass das System Alarm schlägt; das muss vor Vertragsschluss behoben und uns vorgeführt sein. Preis, Wartung, Escrow und KI-Verarbeitung in der EU klären wir schriftlich im Angebot – darunter unterschreibe ich nicht.“

> **Block C:** „Bernd, ich empfehle den Kauf, sobald das schriftliche Angebot mit Wartung, EU-Verarbeitung der KI und Escrow vorliegt: In meinem Block stimmten alle 16 RVG-Werte, das Zeithonorar, sechs Zinsabschnitte und die Ausschlussfrist auf den Cent bzw. den Tag. Stornos, Sammelabrechnung, Bankabgleich und Fremdgeld laufen sauber, nachvollziehbar und lassen sich zurücknehmen – das ist mehr, als wir heute in RA-MICRO haben. Offen ist produktseitig nur eine fehlende Eingabeprüfung im RVG-Rechner, die vor dem Vertrag behoben sein muss.“

> **Block D:** „Bernd, ich empfehle den Kauf, sobald das Angebot schriftlich vorliegt: Unser RA-MICRO-Export kam mit allen Umlauten, gemeldeter Dublette und Rückgängig-Knopf an, und jede übernommene Frist landet erst in der Vier-Augen-Kontrolle. Die Fristen stimmen auf den Tag mit Feiertag am Gerichtsort, deine Urlaubsvertretung sehe ich schon am Freitag davor, und die abendliche Ausgangskontrolle sagt mir für jede Frist ‚offen‘ oder ‚versandt mit Nachweis‘. Frau Schulte hat ihren Vormittag ohne Schulung geschafft – Bedingung bleiben Lizenz um 15.000 € für 7 Plätze, Wartungspreis, Festpreis für den Umzug der Altakten, Übertragbarkeit und Escrow.“

**Gemeinsamer Kern:** Alle vier Blöcke empfehlen den Kauf. Keiner empfiehlt ihn ohne schriftliches Angebot. Zwei Blöcke nennen als Lizenzpreis für 7 Plätze „um 15.000 €“.

### 4.4 Preisfragen (Van Westendorp, Lifetime-Lizenz für 7 Arbeitsplätze, netto)

| Frage | A | B | C | D | Spanne (Trend) |
|---|---|---|---|---|---|
| 1. Zu billig – Zweifel an der Qualität | unter 5.000 € | unter 5.000 € | unter 5.000 € | unter 5.000 € | **unter 5.000 €** |
| 2. Günstig – ein gutes Angebot | ≈ 12.000 € | ≈ 12.000 € | 12.000 € | ≈ 12.000 € | **≈ 12.000 €** |
| 3. Teuer, aber noch kaufen | ≈ 25.000 € (nur mit Pilot oder Raten) | 22.000 € | 20.000 € | ≈ 25.000 € (nur mit Probelauf des eigenen Exports und Raten) | **20.000–25.000 €** (Mittel 23.000 €) |
| 4. Zu teuer – kein Kauf | über 35.000 € | ab 30.000 € | ab 30.000 € | über 35.000 € | **30.000–35.000 €** (Mittel 32.500 €) |
| 5. Wartung pro Jahr | bis 15 %, höchstens ≈ 2.500 € | bis 15 %, höchstens 2.500 € | bis 2.000 € (10–15 %) | bis 15 %, höchstens ≈ 2.500 € | **bis 15 %, 2.000–2.500 €** |

**Was die Wartung enthalten muss (Nennungen):**

- beA- und eEB-Anpassungen (A, B, C, D)
- RVG-/GKG-Tabellen und Basiszins ohne Aufpreis (A, B, C, D)
- Feiertage und Fristregeln (A, D)
- Sicherheitsupdates (A, B, C, D)
- E-Rechnung nach jeweils gültigem Standard (C)
- feste Ansprechpartnerin mit Rückruf, binnen 30 Minuten in der Servicezeit (A, B, C, D)
- Update-Zeitpunkt nach Wahl der Kanzlei, Updates erst nach Prüfung mit Änderungsliste (A, B, D)
- Zusage, dass Fristenrechner und Abrechnung ohne Wartung nicht abgeschaltet werden (C)

### 4.5 Abgleich mit dem Rechenweg im Kundenavatar (Abschnitt 6.5)

| Grundlage (6.5) | Wert | Antwort des Avatars |
|---|---|---|
| Amortisation ≤ 24 Monate nur über die Softwarekosten: Lizenz + 2 × 15 % Lizenz + 2 × 1.500 € ≤ 2 × 9.500 € | Lizenz höchstens **≈ 12.300 €** | „Günstig“ **≈ 12.000 €** – trifft die Grenze fast genau; Blöcke A und D rechnen sie selbst vor |
| Preiskorridor „ohne lange Diskussion“ | bis ≈ 15.000 € | A und D nennen Hollmann „Lizenz um 15.000 €“ als Bedingung |
| Korridor „nur mit Pilotnachweis, Ratenzahlung oder Mietkauf“ | 15.000–35.000 € | „Teuer, aber noch“ 20.000–25.000 € – A und D ausdrücklich nur mit Pilot bzw. Probelauf und Raten |
| „Darüber: nein“ | über 35.000 € | „Zu teuer“ ab 30.000 € (B, C: „über drei Jahre unserer heutigen Kosten“) bzw. über 35.000 € (A, D) |
| Wartung (Annahme in 6.5) | 15 % pro Jahr | bis 15 %, gedeckelt bei 2.000–2.500 € |
| Plus gemessene ReFa-Entlastung | 6.5: 20 Std./Woche × 18 € × 52 = 18.720 €/Jahr → Lizenz höchstens ≈ 41.100 € | eigene Messung T10: 20,22 Std./Woche → 25.273 €/Jahr (26,04 €/Std., 48 Wochen) bzw. ≈ 18.900 €/Jahr zum Satz des Motors → rechnerisch wären **≈ 41.400–51.200 €** tragbar |

**Einordnung:**

- Die Antworten bestätigen die Kernaussage von Abschnitt 6.5: Die Preisbereitschaft folgt den eingesparten Softwarekosten, nicht der gemessenen Zeitersparnis.
- Obwohl der Avatar seine Ersparnis von rund 20 Stunden pro Woche selbst gemessen hat, liegt die Schmerzgrenze bei 30.000–35.000 € und damit weit unter der rechnerischen Grenze.
- Die Zeitersparnis dient als Begründung für den oberen Korridor („eine halbe Stelle“), nicht als Preisanker.

**Fünf-Jahres-Rechnung für Bernd Hollmann** (Annahmen aus 6.5: Wartung 15 % pro Jahr ab dem ersten Jahr, Betrieb 1.500 € pro Jahr; heutige Kosten 47.500 € über 5 Jahre; ohne Zeitersparnis gerechnet):

| Lizenzpreis (7 Plätze) | Lizenz | Wartung 5 Jahre | Betrieb 5 Jahre | Summe 5 Jahre | gegenüber heute |
|---|---|---|---|---|---|
| 12.000 € | 12.000 € | 9.000 € | 7.500 € | **28.500 €** | 19.000 € weniger |
| 15.000 € | 15.000 € | 11.250 € | 7.500 € | **33.750 €** | 13.750 € weniger |
| 25.000 € | 25.000 € | 18.750 € | 7.500 € | **51.250 €** | 3.750 € mehr – trägt nur mit der gemessenen Zeitersparnis |

> Diese Tabelle ist eine Rechnung mit den Annahmen des Kundenavatars, **kein Angebot**. Preis, Wartungssatz und die Frage, ob ein Wartungsjahr im Lizenzpreis enthalten ist, entscheidet der Auftraggeber (4.6). Ist das erste Wartungsjahr enthalten, sinkt jede Summe um eine Jahreswartung.

### 4.6 Offene Entscheidungen des Auftraggebers

Diese Punkte nennt der Avatar als Kaufbedingung oder als Grund für eine Note unter 1. Sie lassen sich im Produkt nicht lösen. Bis zur Entscheidung bleibt jede Aussage im Produkt neutral („im Angebot geregelt“ bzw. „auf Anfrage“; Vorgabe der Projektleitung).

| # | Entscheidung | genannt von | Stand im Produkt |
|---|---|---|---|
| 1 | **Lizenzpreis** für 7 Arbeitsplätze und schriftliches Angebot | A, B, C, D | „Preis auf Anfrage – verbindlich im Angebot“ |
| 2 | **Wartung:** Satz in % pro Jahr bzw. Betrag, Inhalt, Update-Zeitpunkt, **ob ein Wartungsjahr im Lizenzpreis enthalten ist** | A, B, C, D | „Wartung: Umfang und Preis regelt das Angebot“. Der widersprechende Satz „das erste Jahr ist enthalten“ im Lizenz-Tab wird neutral (I5-T13-01) |
| 3 | **Übertragbarkeit der Lizenz** (Fusion, Verkauf, Nachfolge Hollmann) | A, B, C, D | „im Angebot geregelt“ (T13-Prüfpunkt „nein“) |
| 4 | **Quellcode-Hinterlegung (Escrow)** bzw. offenes Exportformat | A, B, C, D | „auf Anfrage“ (T13-Prüfpunkt „nein“) |
| 5 | **KI-Verarbeitung in der EU** oder eine nach § 43e Abs. 4 BRAO tragfähige Lösung für die Live-KI | A, B, C, D | Live-KI: Anbieter in den USA, „EU auf Anfrage“; bis dahin nutzt der Avatar nur die Offline-KI (T13-Prüfpunkt „nein“) |
| 6 | **Impressum** mit echten Anbieterdaten (§ 5 DDG) – I1-T00-02 (H, teilweise) | A, B, C, D | gekennzeichneter Platzhalter |
| 7 | **Festpreis und Termin für den begleiteten Umzug** der Altakten (Dokumente, Aktenkonten, offene Posten, 11.000 Archivakten) | D | „Gemeinsam mit Lena Vogt“ ohne Preis |
| 8 | **Pilot, Probelauf mit dem echten RA-MICRO-Export vor Vertragsschluss, Ratenzahlung oder Mietkauf** für Preise über 15.000 € | A, D | – |
| 9 | Zusage, dass Fristenrechner und Abrechnung **ohne Wartung** weiter nutzbar bleiben | C | im Entwurf der Lizenzbedingungen: „Software und Daten bleiben unbefristet nutzbar“ – verbindlich erst im Angebot |

---

## 5. Nachtest-Ergebnisse

Geprüft wurden **58 IDs**:

- die 52 Befunde der Iteration 4
- die beiden zusammengeführten IDs I4-T07-03 und I4-T22-01
- I3-T21-02 und die offenen älteren IDs I1-T00-02, I3-T21-01 und I1-T07-07

I4-T18-01 lief in A und D, I1-T07-07 in B und D.

| Status | IDs | Anteil |
|---|---|---|
| behoben | **54** | 93 % |
| teilweise | **2** | 3 % |
| nicht behoben | **0** | – |
| nicht prüfbar | 2 | – |

- **K und H der Vorrunde alle behoben:**
  - I4-T17-01 (K): Die Dublette „Kröger Logistik GmbH“ entsteht nur mit Begründung und Häkchen. Die Kollisionsprüfung findet den Gegner auch über die Dublette, das Zusammenführen funktioniert.
  - I4-T04-01 (H): Rechtsschutz ist in der Akte nachtragbar.
  - I4-T07-01 (H): Rechnungen und Akten lassen sich per Tastatur öffnen.
  - I4-T09-01 (H): Die Ink-Flächen haben im Dunkelmodus genug Kontrast (Plakette ≈ 5,4 : 1).
- **Von den 54 IDs der Iteration 4 sind 53 behoben.** Block C meldet 16 von 16.
- **Die Vorgabe der Projektleitung aus Iteration 4 ist eingehalten.** Der Nachtest zu I4-T08-01 lief an der Hanseatischen (5.670 €, 107/26, Anderkonto). Bei 131/26 sagt die Oberfläche ehrlich „Eingang ohne Bankumsatz gebucht; bitte das Konto prüfen“. Diesen Rest löst jetzt Auftrag A-01 (Vorgabe 10.2).

**Nicht vollständig behoben**

| ID | S | Status | Was fehlt noch | weiter in |
|---|---|---|---|---|
| I1-T00-02 | H | teilweise | Das Impressum ist weiter ein gekennzeichneter Platzhalter (§ 5 DDG). | Auftraggeber (4.6) |
| I4-T11-02 | N | teilweise | Vorschau, Kachel, Meldung und aktiver Protokolleintrag zählen einheitlich „2 Fristen und 1 Wiedervorlage“. Nach „Rückgängig“ schreibt derselbe Eintrag wieder „3 Fristen und Wiedervorlagen“. | I5-T11-01 (B-09) |
| I3-T21-01 | N | nicht prüfbar | Die Anlage zwischen 0 und 2 Uhr lässt sich ohne feste Uhr nicht nachstellen. Der Test `protokoll.test.ts` deckt sie ab. | Testleitung (11.6) |
| I1-T07-07 | N | nicht prüfbar | Die Datumsfelder stehen weiter im US-Format. Ursache ist die Chromium-Sprache der Testumgebung, kein Produktbefund. | – |

**Behoben, mit verwandtem neuem Befund** (die alte ID ist erledigt, der Rest hat eine neue ID):

| Alte ID | Neue ID | Neuer Befund |
|---|---|---|
| I4-T02-01 | I5-T02-01 | Die Suchauswahl ist da, der Fokus landet aber nicht im Suchfeld |
| I4-T04-03 | I5-T04-01 | Die Versicherer-Auswahl mischt Rechtsschutz- und Gegner-Versicherer |
| I4-T08-02 | I5-T08-01 | Der Satz erscheint auch nach „abgeschlossen“ |
| I4-T14-01 | I5-T14-01 | Die Aktionen stehen nur noch im Aktenkopf |
| I4-T15-03 | I5-T15-01 | Die kompakte Tab-Leiste zeigt nur Symbole |

---

## 6. Die stärksten O-Töne

**Kritik**

> „Dann korrigiere ich die Berufungsfrist auf ein Zustellungsdatum nach dem eEB, sogar in der Zukunft, und das System nickt. Mein eigenes Haftungsrisiko, schön protokolliert.“ – T03 · „Die Software kennt das eEB-Datum. Dann muss sie mich auch aufhalten.“ – Block B

> „Aber ich klicke ‚Andere Akte wählen‘, tippe ‚Weber‘, und es geht eine Wiedervorlage auf. Das ist kein Suchfeld, das ist eine Falle.“ – T02

> „Minus 500 Euro Gegenstandswert rechnet er mir ohne Murren als null – da muss eine Meldung kommen.“ – T07 · „Ein Tippfehler, und ich habe eine Kostennote über 238,30 € – ohne ein Wort der Warnung.“

> „Hier steht ‚das erste Wartungsjahr ist enthalten‘, auf der Website und in meinem Testzugang ‚Preis auf Anfrage‘. Was gilt denn nun?“ – T13 · „Was die Wartung kostet, steht nirgends – das will ich schwarz auf weiß.“ – T00

> „Warum sind auf derselben Seite 28 Stunden 35.000 € wert und 38 Stunden 36.000 €? Das fragt Hollmann als Erstes.“ – T10

> „Nur beim Deaktivieren steht die Frage ‚Fristen übertragen?‘ auf ‚nein‘ vorbelegt.“ – T23 · „Die Organisationspflicht steht hier im Kleingedruckten.“

> „Für die Notiz muss ich nach dem Lesen wieder ganz nach oben.“ – T14

> „Dass mir das Programm für eine Zwei-Tages-Frist eine Vorfrist vor der Zustellung vorschlägt, ist Unsinn.“ – T15

> „Nur ‚Automatisch erstellt‘ stimmt nicht: Gespeichert habe ich.“ – T19 · „Wer hat das gemacht – ich oder die Maschine?“

> „Dass er gleichzeitig ‚Ich höre zu‘ und ‚Kein Mikrofon‘ anzeigt, ist schlampig.“ – T20 · „Für ‚Zuordnen‘ hätte ich gern ein Kürzel.“ – T22

**Lob**

> „Das ist jetzt ein Werkzeug, mit dem ich morgens arbeiten würde – Posteingang, eEB, Mandatsaufnahme, Kollision und Übergabe sitzen.“ – Block B, Gesamteindruck

> „Die Dublette ist jetzt ein Riegel, kein Hinweis. Und selbst wenn ich sie mit Begründung anlege, findet die Prüfung den Gegner. Genau so.“ – T17

> „Im Protokoll steht jetzt vollständig, dass Frau Vogt zweimal ein Passwort vergeben hat – auf wessen Wunsch und warum.“ – T16

> „Allerheiligen beim Namen, Hessen als Gerichtsort, kein Tag Verlängerung. Genau das will ich sehen, bevor ich eine Frist unterschreibe.“ – T18 Fall 3b · „Fünf von fünf, Ostermontag und Frauentag beim Namen, und die Vertretung sehe ich jetzt am Samstag davor. Da habe ich nichts mehr.“ – T18

> „Sechzehn von sechzehn auf den Cent, Storno mit eigener Nummer und die Sammelabrechnung in vier Klicks.“ – T07 · „Sechs Abschnitte, sechs Mal auf den Cent.“ – T09

> „Das Geld der Versicherung liegt jetzt da, wo es hingehört, und so steht es auch in der Meldung.“ – T08

> „Bei uns sind es zwanzig Stunden, nicht achtunddreißig – und das Ding rechnet es mir offen vor.“ – T10

> „Richtige Norm, richtiger Rat, und am Samstag steht ehrlich da, dass Frau Vogt nicht da ist und ich nicht warten soll. Mehr kann ein Programm hier nicht tun.“ – T12

> „‚Erfindet kein Datum‘, Fristenrechner statt KI, und Nein heißt Nein.“ – T19 · „Umlaute heil, Dublette vorher gemeldet, Rückgängig mit Namen im Protokoll. So will ich einen Probelauf.“ – T11

> „Übergabe mit automatischer Wiedervorlage ‚Übernommene Akte sichten‘ – das hätte ich mir selbst nicht besser ausgedacht.“ – T23 · „Vier Zahlen, ein Blick, kein Scrollen. Und abends dunkel blendet nichts.“ – T01

> „Als Frau Schulte: Zuordnen mit einem Klick, E und W wie gewohnt, und dass ich das eEB nur vorlegen darf, steht mit Paragraf da.“ – T22

---

## 7. Was gut war

- **Fachkern exakt:** alle Prüfwerte des Abnahmeziels auf den Tag bzw. Cent: T18 6/6 mit benannten Feiertagen und Gerichtsort, T07 16/16 plus 428,40 €, T09 0,00 € Abweichung, Klagefrist 02.11.2026, 11.400 €, Ausschlussfrist 30.12.2026, 0 Zeichenfehler im Umzug.
- **Vertrauen durch Protokoll:**
  - Der Anbieter-Eingriff steht vollständig im Kanzleiprotokoll: mit Anforderer, Anlass, Urheber „AnwaltApex – Lena Vogt (Apex Console)“ und eigenem Filter „Anbieter“.
  - Die Apex Console besteht die K-Probe: Sie zeigt nur Zahlen, keine Namen oder Inhalte.
- **Berufsrecht sitzt:**
  - Kollisionsprüfung über Dubletten, schon in Schritt 1 der Mandatsaufnahme.
  - eEB-Sperre mit Grund, Protokoll 4/4, Schutz gegen Doppelabgabe; die ReFa legt das eEB nur vor (§ 173 Abs. 3 ZPO).
  - Fremdgeld kontogenau mit § 43a Abs. 7 BRAO und § 4 BORA, Aufbewahrung nach § 50 BRAO, Vertretung schon vor Beginn der Abwesenheit sichtbar.
- **Geld mit Verstand:**
  - Der Bankabgleich erkennt die Zahlung auf eine stornierte Rechnung und bietet die Korrekturrechnung an. Jede Buchung lässt sich lösen.
  - Sammelabrechnung von 4 RSV-Akten in 4 Aktionen; RSV-Split und Selbstbeteiligung getrennt; E-Rechnung je nach Empfänger.
- **KI mit Grenzen:**
  - 3 von 3 echten BAG-Entscheidungen, „Rang“ statt Scheingewichtung, „AnwaltApex erfindet kein Datum“.
  - „Vorschlag verwerfen“ ändert nachweislich nichts. Ein Entwurf wird als Version 2 gespeichert statt als zweite Datei.
- **Ehrliche Erreichbarkeit:** Die Notfallantwort nennt die richtige Norm für LAG und OLG. Außerhalb der Servicezeit sagt sie „nicht erreichbar – warten Sie nicht“, ebenso Hilfe, Umzug und Assistent.
- **38h-Motor nachrechenbar:**
  - Demo-Werte sind gekennzeichnet; jede Automatik nennt Minuten je Vorgang.
  - Der Rechner übernimmt die eigenen Mengen und speichert sie. Die fristrelevante Automatik lässt sich nur mit Rückfrage abschalten.
- **Umzug und Petra:**
  - Windows-1252 wird erkannt; „nichts wird still ausgelassen“; Rückgängig mit Folgen-Dialog.
  - Petra schafft ihren Vormittag ohne Schulung, mit U, E und W.
- **Barrierefreiheit gehalten:** axe 0/0 in 72 Prüfzeilen, Reflow 320 px und 200 % ohne Querscrollen, „Bewegung reduzieren“ ohne laufende Animation, Dunkelmodus ruhig mit gedimmtem Papier.
- **Begriffe:** Als Anglizismus notiert der Avatar nur „Lifetime“ (Landing). Das ist der Produktbegriff aus dem Briefing („Lifetime-Lizenz“) und kein Befund.

---

## 8. Befunde nach Bereich

**So sind die Tabellen zu lesen:**

- **S** ist der Schweregrad: **K** kritisch, **H** hoch, **M** mittel, **N** niedrig.
- **Paket A** heißt „Rahmen, Design, Einstieg, Logik & Daten“, **Paket B** heißt „Fachseiten“. Die Nummer verweist auf den Auftrag in Abschnitt 11.4.
- „im Code bestätigt“ heißt: Die Testleitung hat die Ursache im Quelltext nachgelesen.
- **„Prüfung“** heißt: Eine mitbetroffene Datei liegt im Bereich des anderen Pakets. Beide Fixer lassen sie unverändert; die Prüfung nach der Umsetzung zieht sie nach (Regel in 11.1).

**Zusammenführung:** Die 32 Rohbefunde enthalten keine Duplikate und keine ID-Kollision. Zwei Befunde sind im Umfang erweitert (I5-T13-01, I5-T16-01), vier angepasst, bei einem ist ein Teil verworfen (Abschnitt 10.1).

**Befunde je Bereich und Schwere**

| Bereich | K | H | M | N | gesamt |
|---|---|---|---|---|---|
| Landing | – | – | – | 1 | 1 |
| Apex Console und Einstellungen (Lizenz, Team, Kanzlei) | – | – | 2 | 2 | 4 |
| Rahmen: Rückfragen, Meldungen, Tab-Leiste | – | – | – | 3 | 3 |
| Fristen und Fristenrechner | 1 | – | – | 2 | 3 |
| Posteingang | – | – | 1 | 1 | 2 |
| Akten (Rechtsschutz, Akte mobil, E-Akte) | – | – | 2 | 2 | 4 |
| Kontakte und Demodaten | – | – | – | 2 | 2 |
| Abrechnung | – | – | 1 | 4 | 5 |
| Apex KI | – | – | – | 1 | 1 |
| 38h-Motor | – | – | 1 | 2 | 3 |
| Umzug | – | – | – | 1 | 1 |
| Apex Assistent (inkl. Notfallantwort) | – | – | – | 3 | 3 |
| **Summe** | **1** | **0** | **7** | **24** | **32** |

### 8.1 Landing (`/willkommen`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T00-01 | N | Barrierefreiheit | Fußnote ²: „… ReFa-Vollkosten von ca. 26“ am Zeilenende, „€/Std. wären es ≈ 47.500 €“ in der nächsten Zeile – Zahl und Einheit getrennt. | **umsetzen** – geschützte Leerzeichen zwischen Zahl und Einheit in allen Landing-Kennzahlen | A-08 |

### 8.2 Apex Console und Einstellungen

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T13-01 | M | Vertrauen | Lizenz-Tab (Präsentationszugang): „Die Wartung ist optional; das erste Jahr ist enthalten.“ Landing, Demo-Skript und Lizenz-Tab des Testzugangs sagen „Umfang und Preis regelt das Angebot“ bzw. „Preis auf Anfrage“. Im Code bestätigt (`LizenzTab.tsx` Z. 55). **Erweitert:** Der ROI-Rechner im 38h-Motor setzt dieselbe Annahme still voraus („Wartung pro Jahr … je Platz, ab Jahr 2“, `kostenLifetime` mit `erstesJahrEnthalten = true`). | **umsetzen** – überall der neutrale Wortlaut aus `src/content/lizenz.ts`; ob ein Wartungsjahr enthalten ist, entscheidet der Auftraggeber (4.6) | A-02 (ROI-Rechner: Prüfung) |
| I5-T23-01 | M | Fachlich | Deaktivieren von Jonas Brandt: „Bearbeitung und Fristverantwortung übertragen an …“ ist mit „nicht übertragen“ vorbelegt, „Deaktivieren“ sofort aktiv; 8 offene Fristen blieben beim gesperrten Zugang, nur ein Satz warnt. Im Code bestätigt (`TeamTab.tsx` Z. ≈ 692–723). | **umsetzen** – Vorbelegung mit aktiver verantwortlicher Person oder Pflichtwahl, „nicht übertragen“ nur mit Pflichthäkchen, Cockpit-Hinweis | A-03 |
| I5-T21-01 | N | Verständlichkeit | Console-Kachel „Kanzleien 4 · 3 aktiv · 0 pausiert“ – der Testzugang fehlt, 3 + 0 ≠ 4. Im Code bestätigt (`Console.tsx` Z. 184). | **umsetzen** – „3 aktiv · 1 im Test · 0 pausiert“ | A-08 |
| I5-T16-01 | N | Look & Feel | Vorschau Briefkopf kürzt den Kanzleinamen und zeigt nur 3 von 5 Schwerpunkten ohne Hinweis (`truncate`, `slice(0, 3)`). **Erweitert:** Der echte Briefkopf der Rechnung zeigt alle Schwerpunkte, kürzt sie aber ebenfalls mit `truncate` (`src/pages/abrechnung/ui.tsx` Z. 145). | **umsetzen** – umbrechen statt kürzen, alle Schwerpunkte wie im echten Briefkopf | A-08 (Rechnungs-Briefkopf: Prüfung) |

### 8.3 Rahmen: Rückfragen, Meldungen, Tab-Leiste

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T07-02 | N | Bedienbarkeit | Rückfrage „stornieren?“ fokussiert „Abbrechen“, „korrigieren?“ (bei einer schon stornierten Rechnung) den Bestätigungsknopf; Tab + Enter aus Gewohnheit landet auf „×“ und schließt ohne Meldung. Im Code bestätigt: `ConfirmHost` fokussiert je nach `gefahr` unterschiedlich. | **umsetzen** – Anfangsfokus in allen Rückfragen auf „Abbrechen“, Tab + Enter bestätigt überall; **Teil verworfen:** Das „×“ hat bereits den Namen „Schließen“ | A-05 |
| I5-T03-02 | N | Bedienbarkeit | Meldungen unten rechts liegen einige Sekunden über Zeileninhalt (Status und „Erledigt“ der Begründungsfrist, eEB-Karte). | **umsetzen** – Meldung weicht nach oben aus, wenn sie das fokussierte Element oder seine Zeile überdecken würde | A-05 |
| I5-T15-01 | N | Verständlichkeit | Bei 200 % (720×450) zeigt die kompakte Tab-Leiste nur Symbole ohne „Cockpit, Akten, Post, Fristen, Mehr“ (CSS blendet `.tab-text` unter 500 px Höhe aus). | **umsetzen** – Beschriftung neben dem Symbol | A-06 |

### 8.4 Fristen und Fristenrechner (`/fristen`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| **I5-T03-01** | **K** | Fachlich | Nach eEB-Abgabe (Zustellung 17.10.2026) lässt „Korrigieren …“ als Zustellungsdatum den 19.10.2026 zu – nach dem eEB-Datum und in der Zukunft –, ohne Warnung und ohne Anzeige des eEB-Datums; Notfrist Do 19.11. statt Di 17.11.2026; die Begründungsfrist desselben Urteils läuft weiter ab 17.10.; der Platzhalter schlägt genau diesen Fall vor. Die Vier-Augen-Kontrolle sieht nur das neue Ereignis. **Im Code bestätigt:** `KorrekturDialog.tsx` prüft `ereignis` nicht; Frist und Nachricht sind nur über den Betreff-Vermerk in `notiz` verbunden (`fristenAusNachricht`). | **umsetzen** – keine Zustellung in der Zukunft oder vor dem Eingang; eEB-Datum im Dialog; spätere Abweichung nur mit Pflichtbestätigung im Klartext; Chip „weicht vom eEB ab“ in Liste und Vier-Augen-Ansicht; Geschwisterfristen gemeinsam neu berechnen; neutraler Platzhalter | B-01 |
| I5-T15-02 | N | Fachlich | „Frei bestimmte Frist“, Ereignis Mo 05.10.2026, 2 Tage: Vorfrist Fr 02.10.2026 – vor dem fristauslösenden Ereignis. Im Code bestätigt: `vorfristVon` rechnet nur rückwärts vom Fristende. | **umsetzen** – Vorfrist frühestens am Ereignistag, mit Hinweis im Rechenweg | A-04 |
| I5-T17-02 | N | Verständlichkeit | „Neuer Kontakt“ und „Frist korrigieren“ zeigen Pflichtmeldungen schon beim Öffnen, vor jeder Eingabe (im Code bestätigt: `fehlt` wird sofort angezeigt). | **umsetzen** – vor dem ersten Speichern neutraler Hinweis, danach Fehler am Feld | B-09 |

### 8.5 Posteingang (`/posteingang`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T02-01 | M | Barrierefreiheit | Nach „Andere Akte wählen“ liegt der Fokus auf BODY; „Weber“ tippen löst W = „Wiedervorlage anlegen“ aus (U und E liegen in derselben Ansicht). Suchfeld und Liste unten außer Sicht; Umhängen 5 statt ≤ 3 Aktionen. Im Code bestätigt: Der Knopf verschwindet beim Aufklappen, die `AktenSuchauswahl` bekommt keinen Fokus. | **umsetzen, angepasst** – Fokus ins Suchfeld und Liste ins Bild; dann ruhen Einzeltasten schon nach der bestehenden Regel. Keine zusätzliche globale Kürzelsperre (sonst fielen J/K bei Nachrichten ohne Akte dauerhaft aus) | B-02 |
| I5-T22-01 | N | Tempo | Taste U übernimmt beim Urteil Fristen und Akte; bei Nachrichten ohne Frist (Weber-Mail, Gerichtsvollzieherin) passiert nichts, ohne Meldung. Für „Akte zuordnen“ gibt es kein Kürzel. Im Code bestätigt (`data-kuerzel="u"` nur am Fristen-Knopf). | **umsetzen, angepasst** – kein neues „Z“ (Z ist global „Zeit erfassen“); stattdessen U = „Vorschlag übernehmen“: ohne Frist ordnet U die Akte zu, am Knopf angezeigt; wirkungslose Taste meldet den Grund | B-02 (Schnellhilfe-Text in `Tastenkuerzel.tsx`: Prüfung) |

### 8.6 Akten (`/akten`): Rechtsschutz, Akte mobil, E-Akte

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T04-01 | M | Fachlich | Die Versicherer-Suchauswahl (Mandatsaufnahme Schritt 3, „Rechtsschutz ergänzen“) listet Elbtal (Gegnerin in 131/26) und Hanseatische (Gegnerin in 107/26) gleichrangig neben den Rechtsschutzversicherern – eine Verwechslung erzeugt eine Deckungsanfrage an die Gegenseite. **Von der Testleitung in den Demodaten nachgezählt:** Elbtal ist RSV in 116/26 und Gegnerin in 131/26, Isarwerk RSV in vier Akten und Gegnerin in 130/26, Hanseatische nur Gegnerin. | **umsetzen, angepasst** – jede Option nennt ihre Rollen („RSV in 116/26 · Gegnerin in 131/26“); bekannte Rechtsschutzversicherer zuerst; ein nur als Gegner bekannter Versicherer und der Gegner der eigenen Akte nur mit Pflichtbestätigung. Keine feste Unterart am Kontakt, weil Mehrspartenversicherer je Akte etwas anderes sind | B-04 |
| I5-T14-01 | M | Mobil | Seit I4-T14-01 stehen Notiz, Frist und Wiedervorlage nur im Aktenkopf (y ≈ 405–460 von 844 px) und sind nach dem Scrollen zu den Dokumenten weg; Prüfpunkt „unteres Drittel, einhändig“ nicht erfüllt. | **umsetzen, angepasst** – schmale Aktionsleiste über der Tab-Leiste, die erst erscheint, wenn die Kopf-Aktionen aus dem Bild sind (statt „+“ in der Tab-Leiste, die im Bereich A liegt und jede Seite beträfe); Meldungen bleiben oben | B-05 |
| I5-T14-02 | N | Mobil | Kontrollkästchen „Alle auswählen“ in der E-Akte 18×18 px; alle übrigen Ziele 44 px. | **umsetzen** | B-05 |
| I5-T19-01 | N | Vertrauen | Von Hand gespeicherte KI-Entwürfe stehen in der E-Akte als „Automatisch erstellt · Dr. Julia Hartmann“ – Maschine und Mensch vermischt (`QUELLE_LABEL.generiert`). | **umsetzen** – „KI-Entwurf, gespeichert von …“, „Aus Vorlage erstellt von …“, „Automatisch erstellt (38h-Motor)“ | B-08 |

### 8.7 Kontakte und Demodaten

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T17-01 | N | Fachlich | „Arbeitsgericht Berlin – 12043 Berlin“, der Gütetermin 151/26 nennt „Magdeburger Platz 1“ (10785 Berlin); „Amtsgericht Charlottenburg – 12053 Berlin“. Im Code bestätigt: Gerichte bekommen zufällige Postleitzahlen aus dem Ortspool. | **umsetzen** – Stammliste mit echten Anschriften; Termin und Kontakt aus derselben Quelle (`SEED_VERSION` 13) | A-01 |
| I5-T02-02 | N | Fachlich | „Urteil vom 10.10.2026“ – ein Samstag (Verkündung relativ zu „heute“ = `d(-7)`). | **umsetzen** – Gerichtsdaten der Demodaten auf Werktage (`SEED_VERSION` 13) | A-01 |

### 8.8 Abrechnung (`/abrechnung`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T07-01 | M | Fehler | RVG-Rechner: Gegenstandswert „-500“ → keine Meldung, kein `aria-invalid`; Ergebnis rechnet still mit 0,00 € (238,30 € brutto); „Als Rechnung für Akte erstellen“ gesperrt ohne Grund. | **umsetzen** – Meldung am Feld, kein Ergebnis, Grund am gesperrten Knopf; gleiche Prüfung im Zinsrechner | B-03 |
| I5-T07-03 | N | Fachlich | Korrekturentwurf zu RE-2026-0024 ändert den Leistungszeitraum (15.10. → 17.10.2026) und die Bearbeitung (Jonas Brandt → Dr. Julia Hartmann). Im Code bestätigt: `leistungszeitraum` rechnet bis zum Rechnungsdatum, `unterzeichnerVon` nimmt im Entwurf die angemeldete Person. | **umsetzen** – Zeitraum und Bearbeitung aus der stornierten Rechnung (auch in XRechnung/ZUGFeRD) | B-07 |
| I5-T07-04 | N | Tempo | Rechnungsliste: 29 Tab-Stopps bis zur ersten Rechnung; der RVG-Rechner hat Sprungmarken, die Liste nicht. | **umsetzen** | B-03 |
| I5-T07-05 | N | Verständlichkeit | „Aus Zeiten abrechnen“ mischt Std:Min („0:36 Std.“, „2:18 Std.“) und Dezimalstunden („2,1 Std.“, „125/26 · 2,3 Std.“). | **umsetzen** – ein Format je Ansicht | B-03 |
| I5-T08-01 | N | Verständlichkeit | Nach „Bankabgleich abgeschlossen“ steht nach dem nächsten Seitenwechsel „Sie haben die Seite während des Abgleichs verlassen …“. | **umsetzen** – Satz nur, wenn die Buchung selbst noch lief | B-07 |

### 8.9 Apex KI (`/ki`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T19-02 | N | Bedienbarkeit | Das Ergebnis der Dokument-Analyse (Ausschlussfrist, eingegebene Fälligkeit) ist nach einem Seitenwechsel weg; die Fallanalyse bleibt erhalten. | **umsetzen** – letztes Ergebnis je Akte bis Verwerfen oder Übernehmen halten | B-08 |

### 8.10 38h-Motor (`/automatisierung`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T10-01 | M | Verständlichkeit | Zwei Kostensätze auf einer Seite: Kopf „28,2 Std. ≈ 35.000 € (× 26,04 €/Std.)“, unter dem Rechner „Ø 38 Std. ≈ 36.000 € (19,74 €/Std.)“ – gelesen: 28 Stunden sind 35.000 € wert, 38 Stunden 36.000 €. Im Code bestätigt (`RoiRechner.tsx` Z. 295). | **umsetzen** – Zielwert zusätzlich zum eingestellten Kostensatz (38 × 48 × 26,04 € = 47.496,96 € ≈ 47.500 €), wie Fußnote ² der Landing | B-06 |
| I5-T10-02 | N | Verständlichkeit | „Zuletzt erledigt (simuliert)“: Unterzeile „vor 15 Std. · Posteingang den …“ gekürzt (7 von 7, `truncate`). | **umsetzen** | B-06 |
| I5-T10-03 | N | Barrierefreiheit | Der zugängliche Name der Schalter wechselt mit dem Zustand („… pausieren“/„… aktivieren“), dazu `aria-checked` – Screenreader: „… pausieren, Schalter, ein“. | **umsetzen** – fester Name, Zustand nur über `aria-checked` | B-06 |

### 8.11 Umzug (`/umzug`)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T11-01 | N | Verständlichkeit | Nach „Rückgängig machen“ zählt derselbe Protokolleintrag „3 Fristen und Wiedervorlagen“ statt „2 Fristen und 1 Wiedervorlage“ (Rest von I4-T11-02). | **umsetzen** | B-09 |

### 8.12 Apex Assistent (inkl. Notfallantwort)

| ID | S | Kategorie | Befund | Entscheidung | Paket |
|---|---|---|---|---|---|
| I5-T12-01 | N | Fachlich | Die Notfallantwort zur Berufungsbegründung (LAG) nennt richtig § 46g S. 3, 4 ArbGG, aber nicht den zweiten Weg: Verlängerungsantrag für die Begründungsfrist (§ 66 Abs. 1 S. 5 ArbGG; OLG § 520 Abs. 2 S. 2, 3 ZPO), ebenfalls ersatzweise einzureichen. Fachlich geprüft: zutreffend; die Berufungsfrist selbst bleibt Notfrist. | **umsetzen** – als zweiter Weg neben der Ersatzeinreichung | A-07 |
| I5-T20-01 | N | Verständlichkeit | Ohne Mikrofon stehen ≈ 3 s gleichzeitig „Ich höre zu – sprechen Sie einfach.“, der rote Mikrofonknopf und die Meldung „Kein Mikrofon gefunden …“. | **umsetzen** | A-07 |
| I5-T20-02 | N | Look & Feel | „Öffne die Akte Schmidt.“ → „Eine Akte „schmidt“ …“ (kleingeschrieben; im Code bestätigt, Z. ≈ 1733); „Soll ich einen Rückruf … anfordern?“ ohne Knopf. | **umsetzen** – Originalschreibweise, Knopf „Rückruf anfordern“ | A-07 |

---

## 9. Bilder

| Bild | Was es zeigt |
|---|---|
| ![Korrektur ohne eEB-Prüfung](iteration-5/bilder/block-B-T03-K-korrektur-zustellung-nach-eeb-ohne-warnung-D-hell.jpg) | **I5-T03-01 (K)** – „Notfrist korrigieren“: Zustellung 19.10.2026 (Zukunft, zwei Tage nach dem eEB), Ergebnis Do 19.11.2026, „Korrektur speichern“ aktiv, keine Warnung (D hell). |
| ![Notfrist 19.11.](iteration-5/bilder/block-B-T03-K-notfrist-19-11-statt-17-11-D-hell.jpg) | **I5-T03-01 (K)** – Fristdetails nach dem Speichern: „Donnerstag, 19. November 2026“, Ereignis Mo 19.10.; die Begründungsfrist läuft weiter ab 17.10. (D hell). |
| ![Taste W statt Aktensuche](iteration-5/bilder/block-B-T02-taste-W-statt-aktensuche-D-hell.jpg) | **I5-T02-01 (M)** – „Andere Akte wählen“ geklickt, „Weber“ getippt: Es öffnet sich „Wiedervorlage anlegen“, dahinter das leere Suchfeld (D hell). |
| ![RVG-Rechner mit negativem Gegenstandswert](iteration-5/bilder/block-C-T07-rvg-negativer-gegenstandswert-D-hell.jpg) | **I5-T07-01 (M)** – „-500“ im Feld, keine Meldung, Ergebnis „Gegenstandswert 0,00 €“ mit 238,30 € brutto (D hell). |
| ![Zwei Kostensätze](iteration-5/bilder/block-A-T10-rechner-eigene-werte-zwei-kostensaetze-L-hell.jpg) | **I5-T10-01 (M)** – eigene Zahl 20,22 Std./Woche → 25.273,38 € zu 26,04 €/Std.; darunter der Zielwert „38 Std. ≈ 36.000 € (19,74 €/Std.)“ (L hell). |
| ![Akte am iPhone](iteration-5/bilder/block-D-T14-widerrufsfrist-meldung-oben-M-hell.jpg) | **I5-T14-01 (M)** / I4-T14-01 behoben – Akte 151/26 am iPhone: Meldung „Frist bis Di, 03.11.2026“ oben, unten nur die Tab-Leiste; Notiz und Frist sitzen im Aktenkopf, nicht im Daumenbereich (M hell). |
| ![Mikrofon](iteration-5/bilder/block-D-T20-mikrofon-ich-hoere-zu-und-fehler-D-hell.jpg) | **I5-T20-01 (N)** – Assistent ohne Mikrofon: „Ich höre zu“ und roter Mikrofonknopf neben „Kein Mikrofon gefunden …“ (D hell). |
| ![Tab-Leiste bei 200 %](iteration-5/bilder/block-D-T15-200prozent-tableiste-ohne-beschriftung-dunkel.jpg) | **I5-T15-01 (N)** / I4-T15-03 behoben – Fristen bei 200 % dunkel: Kopfleiste eingeklappt, Tab-Leiste 44 von 450 px, aber nur Symbole. |
| ![Status nach Abgleich](iteration-5/bilder/block-C-T08-fremdgeld-anderkonto-status-L-hell.jpg) | **I4-T08-01 behoben, I5-T08-01 (N)** – „5.670,00 € auf dem Anderkonto · 107/26 – bitte unverzüglich weiterleiten“; darüber die widersprüchliche Statuszeile „während des Abgleichs verlassen“ (L hell). |
| ![Notfallantwort](iteration-5/bilder/block-A-T12-notfall-ansprechpartnerin-servicezeit-L-hell.jpg) | **T12, I5-T12-01** – Notfallantwort mit § 46g ArbGG / § 130d ZPO und „Lena Vogt ist jetzt nicht erreichbar … warten Sie nicht“; links „Ihr direkter Draht“ mit Durchwahl und Rückruf (L hell). |
| ![Protokoll mit Anbieter-Eingriff](iteration-5/bilder/block-A-T16-protokoll-anbietereingriff-vollstaendig-L-hell.jpg) | **Positiv, I4-T16-01 behoben** – Kanzleiprotokoll: Anbieter-Eingriff über drei Zeilen mit „Mehr anzeigen“, Urheber „AnwaltApex – Lena Vogt (Apex Console)“, Filter „Anbieter“ (L hell). |
| ![Fall 3b](iteration-5/bilder/block-A-T18-fall3b-allerheiligen-D-hell.jpg) | **Positiv, T18 Fall 3b** – „01.11.2027 Allerheiligen – in Nordrhein-Westfalen Feiertag, in Hessen (Gerichtsort) nicht – keine Verschiebung“; gesperrter Knopf als Umriss mit Grund (D hell). |
| ![Fall 3a](iteration-5/bilder/block-D-T18-fall3a-frauentag-brandenburg-D-hell.jpg) | **Positiv, T18 Fall 3a** – Berufung zum OLG Brandenburg → Mo 08.03.2027, „Internationaler Frauentag – in Berlin Feiertag, in Brandenburg (Gerichtsort) nicht“; Februar und März im Kalender (D hell). |
| ![Dublette nur mit Begründung](iteration-5/bilder/block-B-T17-positiv-dublette-nur-mit-begruendung-D-hell.jpg) | **Positiv, I4-T17-01 (K) behoben** – „Kontakt besteht bereits … – Gegner in 142/26“, Begründung und Häkchen Pflicht, „Bestehenden Kontakt verwenden“ als Hauptaktion (D hell). |
| ![Ausschlussfrist](iteration-5/bilder/block-C-T19-ausschlussfrist-fristenrechner-D-hell.jpg) | **Positiv, T19** – Fälligkeit erfragt, Fristende Mi 30.12.2026 „Berechnet vom Fristenrechner – nicht von der KI“, „Vorschlag verwerfen – es wird nichts gespeichert“ (D hell). |
| ![Forderungskonto dunkel](iteration-5/bilder/block-C-T09-forderungskonto-plakette-D-dunkel.jpg) | **Positiv, I4-T09-01 (H) behoben** – Forderungskonto 126/26 dunkel, Plakette „Zinssatz p. a. 6,52 %“ lesbar, axe 0 (D dunkel). |

---

## 10. Verworfen, angepasst, erweitert – und Vorgaben der Projektleitung

### 10.1 Entscheidungen der Testleitung

**Leitlinie des Auftraggebers:** das gesamte Feedback einbauen. Verworfen wird nur, was dem Briefing widerspricht, fachlich falsch ist, auf einem Missverständnis beruht oder außerhalb eines Prototyps liegt. Kein Befund dieser Runde ist ganz verworfen.

| ID | Teil | Entscheidung | Grund |
|---|---|---|---|
| I5-T07-02 | „namenloses ×“ | **verworfen (Teil)** | Missverständnis: Der Schließen-Knopf des Dialogs hat den zugänglichen Namen „Schließen“ (`src/components/ui/Modal.tsx` Z. 242/293); Block C misst im RVG-Rechner 0 Elemente ohne Namen. Er zeigt nur keinen sichtbaren Text. Umgesetzt wird der einheitliche Anfangsfokus. |
| I5-T22-01 | Kürzel „Z“ für „Akte zuordnen“ | angepasst | Z ist global „Zeit erfassen“ (Schnellhilfe, Alt+Z). Stattdessen wird U zu „Vorschlag übernehmen“: mit Frist wie bisher, ohne Frist ordnet U die Akte zu; eine wirkungslose Taste meldet den Grund. |
| I5-T02-01 | „Einzeltasten-Kürzel sperren, solange eine Auswahl offen ist“ | angepasst | Bei Nachrichten ohne erkannte Akte ist die Aktenauswahl immer offen – eine globale Sperre nähme Petra dort J/K/U/E. Mit dem Fokus im Suchfeld ruhen die Kürzel bereits nach der bestehenden Regel (`istEingabeElement` in `src/lib/tastatur.ts`). |
| I5-T04-01 | „Unterart Rechtsschutz am Versicherungskontakt“ | angepasst | Mehrspartenversicherer sind je Akte etwas anderes: In den Demodaten ist Isarwerk RSV in vier Akten und Gegnerin in 130/26, Elbtal RSV in 116/26 und Gegnerin in 131/26. Eine feste Unterart wäre falsch; eine Warnung bei jedem Versicherer, der irgendwo Gegner ist, träfe auch richtige Wahlen. Die Auswahl nennt deshalb die Rollen je Akte, ordnet bekannte Rechtsschutzversicherer zuerst und verlangt eine Bestätigung nur bei einem reinen Gegner-Versicherer oder beim Gegner der eigenen Akte. |
| I5-T14-01 | „+“-Knopf in der Tab-Leiste | angepasst | Umgesetzt wird die zweite vorgeschlagene Variante als Leiste im Daumenbereich der Akte. Die Tab-Leiste gilt für alle Seiten und liegt im Bereich A; die Lösung bleibt in der Akte. |
| I5-T13-01 | Umfang | erweitert | Der ROI-Rechner unterstellt dieselbe Zusage („Wartung … ab Jahr 2“, `kostenLifetime(…, erstesJahrEnthalten = true)`). Auch dort wird es eine Angabe „laut Angebot“ statt einer Annahme. |
| I5-T13-01 | „kanzleibezogen formulieren (laut Ihrem Vertrag …)“ | nicht übernommen | Ein Vertrag mit enthaltener Wartung wäre eine geschäftliche Zusage, die der Auftraggeber trifft (Vorgabe der Projektleitung). Umgesetzt wird die zweite vorgeschlagene Variante: neutral wie überall. |
| I5-T16-01 | Umfang | erweitert | Auch der echte Briefkopf der Rechnung kürzt die Schwerpunkte (`truncate`). Vorschau und Briefkopf sollen dasselbe zeigen. |
| I5-T15-02 | „Vorfrist entfällt“ oder „Vorfrist am Ereignistag“ | erste Variante nicht gewählt | Jede Frist trägt eine Vorfrist (Ergebnistyp `vorfrist: ISODate`, Vorfrist-Einträge in Kalender und Ausgangskontrolle). Umgesetzt wird „frühestens am Ereignistag“ mit Hinweis im Rechenweg – der zweite Vorschlag des Avatars. |
| I1-T00-02 | Impressum | an den Auftraggeber verwiesen | Echte Anbieterdaten liegen nicht vor; der Platzhalter bleibt gekennzeichnet. |
| T13-Prüfpunkte | EU-Verarbeitung, Übertragbarkeit, Escrow | an den Auftraggeber verwiesen | Geschäftliche Zusagen (Vorgabe der Projektleitung); Abschnitt 4.6. |
| T00 | Anglizismus „Lifetime“ | kein Befund | Produktbegriff des Briefings („Lifetime-Lizenz“). |
| I3-T21-01, I1-T07-07 | – | nicht prüfbar | Uhrzeit bzw. Browsersprache der Testumgebung (11.6). |

### 10.2 Vorgaben der Projektleitung (verbindlich)

1. **Iteration 5 ist die Abnahme.** Preisfragen und Empfehlung an Bernd Hollmann stehen in allen vier Block-Berichten und in Abschnitt 4. Dort steht auch der Punkt-für-Punkt-Abgleich mit dem Abnahmeziel 1.12.
2. **Demodaten `SEED_VERSION` 13** (Auftrag A-01). Seed-Anpassungen sind nur dort erlaubt, wo ein Befund sie braucht. Die Präsentationsabläufe bleiben inhaltlich gleich.
   - **Elbtal-Zahlung 6.120 € in 131/26:** bekommt einen Kontoumsatz auf dem **Anderkonto**, bereits als Fremdgeld der Akte zugeordnet (Rest aus I4-T08-01, offen seit Iteration 4, Abschnitt 11.2). Damit nennt die Weiterleitung das Konto, statt „Eingang ohne Bankumsatz gebucht“ zu melden.
   - **I5-T02-02:** Gerichtsdaten (Verkündung, Termine) fallen auf Werktage.
   - **I5-T17-01:** Gerichtsanschriften kommen aus einer Stammliste mit echten Anschriften.
   - Fristdaten, Fristarten, Akten, Nachrichten-Eingänge und alle Prüfwerte bleiben unverändert. Ein Fingerabdruck-Test sichert das.
3. **Geschäftliche Zusagen bleiben neutral.** Wartung (Satz, Betrag, enthaltenes Jahr), Übertragbarkeit, Escrow, Impressum und die EU-Option der Live-KI entscheidet der Auftraggeber (Abschnitt 4.6). I5-T13-01 macht die eine abweichende Stelle neutral und führt keine neue Zusage ein.
4. **Abschlussprüfung mit Artefakt.** Die Prüfung nach der Umsetzung baut zusätzlich das Artefakt (`npm run build:artifact`) und bestätigt es im simulierten Skelett (Abschnitt 11.5).

---

## 11. Umsetzungsplan

### 11.1 Pakete und Dateibereiche

Zwei Fixer arbeiten parallel. Ihre Dateibereiche überschneiden sich nicht.

| Paket | Name | Dateibereich |
|---|---|---|
| **A** | Rahmen, Design, Einstieg, Logik & Daten | `src/components/**`, `src/styles/**`, `src/app/**`, `src/App.tsx`, `src/main.tsx`, `src/lib/**`, `src/store/**`, `src/core/**`, `src/ai/**`, `src/content/**`, `server/**`, `src/pages/Cockpit.tsx`, `src/pages/cockpit/**`, `src/pages/public/**`, `src/pages/hilfe/**`, `src/pages/einstellungen/**`, `src/pages/console/**` (dazu `docs/DEMO-SKRIPT.md`) |
| **B** | Fachseiten | `src/pages/akten/**`, `src/pages/kontakte/**`, `src/pages/posteingang/**`, `src/pages/fristen/**`, `src/pages/abrechnung/**`, `src/pages/ki/**`, `src/pages/falldb/**`, `src/pages/motor/**`, `src/pages/umzug/**` |

**Regeln:**

- Jeder Befund ist nach seiner Hauptdatei genau einem Paket zugeordnet.
- Ist eine Datei im anderen Bereich mitbetroffen, nennt der Auftrag sie ausdrücklich. **Keiner der beiden Fixer ändert sie.** Die Prüfung nach der Umsetzung zieht sie nach.
  - I5-T13-01 → ROI-Rechner `src/pages/motor/RoiRechner.tsx`
  - I5-T16-01 → Rechnungs-Briefkopf `src/pages/abrechnung/ui.tsx`
  - I5-T22-01 → Schnellhilfe-Text `POSTEINGANG_KUERZEL` in `src/components/shell/Tastenkuerzel.tsx`
  - A-01 → ggf. Fremdgeld-Dialog und Tests in `src/pages/**`, die an Zählwerten der Demodaten hängen
- Lesende Importe über die Bereichsgrenze sind erlaubt; Signaturen dabei nicht ändern. Beispiele: `aktenVonKontakt` aus `src/core/kontaktpruefung.ts` in B-04, `fristenAusNachricht` aus `src/pages/posteingang/analyse.ts` in B-01.
- Schlägt ein Test im anderen Bereich nur wegen der eigenen Änderung fehl (z. B. Demodaten in A-01, Vorfrist in A-04), meldet der Fixer das im Ergebnis, statt den Test zu ändern.

### 11.2 Abhängigkeiten

Ein eigener Schnittstellenvertrag ist diesmal nicht nötig. Kein Auftrag braucht neue Typen oder Felder aus dem anderen Paket. Abzustimmen sind nur Wortlaute und Daten:

| Auftrag | hängt ab von | worum es geht |
|---|---|---|
| B-04 (RSV-Auswahl) | A-01 (Demodaten) | Elbtal und Hanseatische bleiben Gegnerinnen in 131/26 bzw. 107/26 |
| B-02 (Taste U) | Schnellhilfe-Text (Prüfung) | Der Text wird nach B-02 angepasst |
| A-02 (Wartungsaussage) | – | ROI-Rechner danach in der Prüfung, mit demselben Wortlaut aus `src/content/lizenz.ts` (B importiert nur) |

### 11.3 Reihenfolge

1. **K-Befund:** B-01
2. **M-Befunde:** A-02, A-03 · B-02, B-03, B-04, B-05, B-06
3. **Demodaten:** A-01. Früh einplanen, weil Tests und B-04 die Daten nutzen.
4. **N-Befunde:** A-04 … A-08 · B-07, B-08, B-09. B-09 kommt nach B-01, weil beide `KorrekturDialog.tsx` ändern.

### 11.4 Aufträge

Die vollständigen Auftragstexte (Änderung, Erfolgskriterium, Dateien, mitbetroffene Dateien) erhalten die Fixer getrennt. Hier die Übersicht:

**Paket A (8 Aufträge)**

| Nr. | Befunde | Inhalt |
|---|---|---|
| A-01 | Vorgabe Projektleitung (Elbtal 6.120 € Anderkonto), I5-T02-02, I5-T17-01 | Demodaten `SEED_VERSION` 13: Kontoumsatz Elbtal auf dem Anderkonto, Gerichtsdaten werktags, Gerichtsanschriften aus Stammliste, Fingerabdruck-Test, Demo-Skript |
| A-02 | **I5-T13-01 (M)** | Eine Aussage zur Wartung: Lizenz-Tab neutral wie Landing und Demo-Skript (ROI-Rechner: Prüfung) |
| A-03 | **I5-T23-01 (M)** | Deaktivieren nur mit Entscheidung über offene Fristen; Cockpit-Hinweis bei Fristen eines deaktivierten Zugangs |
| A-04 | I5-T15-02 | Vorfrist nie vor dem Ereignis (`src/core/fristen.ts`, mit Tests) |
| A-05 | I5-T07-02, I5-T03-02 | Rückfragen mit einheitlichem Anfangsfokus „Abbrechen“; Meldungen weichen der fokussierten Zeile aus |
| A-06 | I5-T15-01 | Kompakte Tab-Leiste bei 200 % mit Beschriftung |
| A-07 | I5-T12-01, I5-T20-02, I5-T20-01 | Assistent: Verlängerungsantrag in der Notfallantwort, Originalschreibweise, Rückruf-Knopf, eindeutiger Mikrofonzustand |
| A-08 | I5-T00-01, I5-T21-01, I5-T16-01 | Landing: Zahl und Einheit zusammen; Console-Kachel geht auf; Briefkopf-Vorschau ungekürzt (Rechnungs-Briefkopf: Prüfung) |

**Paket B (9 Aufträge)**

| Nr. | Befunde | Inhalt |
|---|---|---|
| B-01 | **I5-T03-01 (K)** | Fristkorrektur an das eEB-Zustellungsdatum binden: keine Zukunft, eEB-Datum im Dialog, Pflichtbestätigung bei späterer Abweichung, Chip für die Vier-Augen-Kontrolle, Geschwisterfristen gemeinsam, neutrale Platzhalter |
| B-02 | **I5-T02-01 (M)**, I5-T22-01 | Posteingang: Fokus ins Aktensuchfeld, Liste im Bild; U = Vorschlag übernehmen auch ohne Frist, wirkungslose Taste meldet den Grund |
| B-03 | **I5-T07-01 (M)**, I5-T07-04, I5-T07-05 | Abrechnung: Gegenstandswert ≤ 0 abweisen (auch Zinsrechner), Sprungmarke zur Rechnungsliste, ein Zeitformat |
| B-04 | **I5-T04-01 (M)** | Versicherer-Auswahl: Rollen je Akte sichtbar, bekannte Rechtsschutzversicherer zuerst, reine Gegner-Versicherer und der Gegner der eigenen Akte nur mit Bestätigung |
| B-05 | **I5-T14-01 (M)**, I5-T14-02 | Akte am iPhone: Aktionsleiste im Daumenbereich, sobald der Kopf weggescrollt ist; 44-px-Kästchen |
| B-06 | **I5-T10-01 (M)**, I5-T10-02, I5-T10-03 | 38h-Motor: Zielwert auch zum eingestellten Kostensatz, nichts gekürzt, feste Schalternamen |
| B-07 | I5-T07-03, I5-T08-01 | Korrekturrechnung mit Zeitraum und Bearbeitung der stornierten Rechnung; Statuszeile nach abgeschlossenem Abgleich |
| B-08 | I5-T19-01, I5-T19-02 | Herkunft von Dokumenten ehrlich benennen; Dokument-Analyse übersteht den Seitenwechsel |
| B-09 | I5-T17-02, I5-T11-01 | Pflichtmeldungen erst nach dem Speicherversuch; Umzugsprotokoll zählt nach „Rückgängig“ gleich |

### 11.5 Abnahme der Umsetzung (Prüfung)

1. **Qualitätstor:** `npm run typecheck && npm test && npm run build` grün. Neue Tests decken mindestens ab:
   - Korrekturprüfung gegen das eEB: Zukunft gesperrt, spätere Abweichung mit Bestätigung, Geschwisterfrist (B-01)
   - Vorfrist am Ereignistag (A-04): Mo 05.10.2026 + 2 Tage → Vorfrist Mo 05.10.2026; die T18-Prüfdaten bleiben unverändert
   - Notfallantwort mit § 66 Abs. 1 S. 5 ArbGG bzw. § 520 Abs. 2 S. 2, 3 ZPO; Originalschreibweise (A-07)
   - Eingabeprüfung Gegenstandswert (B-03); Leistungszeitraum der Korrektur (B-07); Versicherer-Gruppen (B-04); Umzugszählung (B-09)
   - Demodaten 13: Elbtal-Umsatz auf „ander“, „Urteil vom“ nie am Wochenende, sonst Fingerabdruck unverändert (A-01)
2. **Bereichsübergreifende Restpunkte nachziehen:**
   - ROI-Rechner: Angabe „Wartung im ersten Jahr im Lizenzpreis enthalten (laut Angebot)“ statt fester Annahme „ab Jahr 2“ (I5-T13-01)
   - Rechnungs-Briefkopf umbrechen statt kürzen (I5-T16-01)
   - Schnellhilfe-Text zu U (I5-T22-01)
   - von A-01 gemeldete Tests und der Fremdgeld-Dialog 131/26
3. **K- und M-Befunde im Browser nachstellen, mit Bild:**
   - **I5-T03-01:** 118/26 → eEB 17.10.2026. Korrektur auf 19.10. ist gesperrt. Mit Seitenuhr 20.10.2026 (`page.clock`) erscheinen Warnung und Pflichthäkchen; der Chip steht in der Vier-Augen-Ansicht.
   - **I5-T02-01:** „Weber“ landet im Suchfeld; Umhängen in ≤ 3 Aktionen.
   - **I5-T07-01:** „-500“ zeigt eine Meldung am Feld und kein Ergebnis.
   - **I5-T13-01:** Lizenz-Tab und Landing sagen dasselbe.
   - **I5-T23-01:** Deaktivieren ohne Wahl ist gesperrt, danach erscheint der Cockpit-Hinweis.
   - **I5-T04-01:** „Hanseatische“ (nur Gegnerin) ist nur mit Bestätigung wählbar; „Elbtal“ zeigt „RSV in 116/26 · Gegnerin in 131/26“.
   - **I5-T14-01:** iPhone, Akte 151/26 gescrollt – die Leiste steht im unteren Drittel.
   - **I5-T10-01:** Zielwert zu 26,04 €/Std. ≈ 47.500 €.
4. **axe-core** bleibt bei 0 serious und 0 critical in den Ansichten aus Abschnitt 2, hell und dunkel, dazu 320 px und 200 % für Cockpit, Fristen und Akte.
5. **Prüfwerte erneut nachrechnen:**
   - T07: 16 Werte, 428,40 €, 2.281,89 €
   - T09: A–C und 155,77 €
   - T18: 6 Daten plus FamFG
   - T04: 02.11.2026 und 11.400 €
   - T02/T03: 17.11. und 17.12.2026, Vorfristen 10.11. und 03.12.
   - T10: 25.273,38 € bzw. 35.247,74 €
6. **Artefakt-Probe (Vorgabe der Projektleitung):**
   - `npm run build:artifact` ausführen.
   - `dist-artifact/anwaltapex.html` in das Skelett der Veröffentlichung einbetten: `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}</style></head><body>` + Datei + `</body></html>`.
   - Die Seite mit `python3 -m http.server` (eigenes Verzeichnis im Scratchpad) ausliefern.
   - Per Playwright nacheinander bestätigen: **Landing → Anmeldung per Karte (Präsentationszugang) → Cockpit → Posteingang mit KI-Analyse (118/26) → Apex Assistent (getippte Frage)**. Dabei 0 `pageerror` und 0 `console.error`.
   - Den Server danach **per PID beenden**.
7. **Texte per `grep`:**
   - kein „das erste Jahr ist enthalten“
   - kein „z. B. Zustellung laut eEB erst am“
   - kein `truncate` in der Unterzeile von „Zuletzt erledigt“
   - „schmidt“ nicht kleingeschrieben in Antworten

### 11.6 Hinweise für den Abnahme-Nachtest (Testleitung)

- **Umfang:**
  - Die Produktbedingungen der Blöcke A, B und C: T13 (Wartungsaussage), T03 (Korrektur gegen eEB, Vorführung), T07 (Fehlerprobe Gegenstandswert).
  - Dazu die M-Befunde in T02, T04, T10, T14 und T23.
  - Danach Kauf heute, Noten „Vertrauen“ und „Fachlich“, UEQ-S und SUS neu erheben.
- **Feste Uhr:** Das Avatar-Werkzeug sollte die Seitenuhr setzen können (Playwright `page.clock.setFixedTime`). Dann lassen sich prüfen:
  - die Werktagssituationen (Di 20.10.2026 16:50 Uhr für T12, 21:30 Uhr für T15)
  - die Anlage zwischen 0 und 2 Uhr (I3-T21-01)
  - eine Fristkorrektur nach dem eEB, die nicht in der Zukunft liegt (I5-T03-01)
- **Demodaten nach `SEED_VERSION` 13:** frische Profile verwenden.
  - 131/26 zeigt die Elbtal-Zahlung im Bankabgleich („Gebucht“, Anderkonto).
  - Der Filter zählt dann voraussichtlich „Alle 10 · Geschäftskonto 8 · Anderkonto 2“.
  - Das Urteil 118/26 trägt ein Werktagsdatum.
- **Mandantenportal (T23):** 137/26, 130/26 und 133/26 haben es bereits aktiv; für „freischalten“ 107/26 verwenden (Hinweis aus Block B).
- **Nicht prüfbar bleiben** ohne Werkzeugänderung: Netzprobe/Offline (T14), Safari/WebKit (T20), Datumsfelder im US-Format (I1-T07-07).
- **Auftraggeber:** Liegen bis zum Abnahme-Nachtest Entscheidungen aus 4.6 vor (z. B. Wartungssatz, Impressum), werden sie im Produkt als Text eingetragen und mitgeprüft. Bis dahin bleiben die T13-Prüfpunkte „EU-Verarbeitung“, „Übertragbarkeit“ und „Escrow“ bei „nein“.

---

## 12. Umsetzung & Nachweis

**Stand:** Samstag, 17.10.2026, nach der Umsetzung der Pakete A und B und der bereichsübergreifenden Restpunkte
**Betrieb:** Browser-Demo (Demo-KI offline) · Chromium (Playwright, `de-DE`, Europe/Berlin) · eigene Prüfskripte mit frischem Browserprofil je Lauf, Bilder im Profil `pruefung-i5` · Viewports D 1440×900, M 390×844, Reflow 320×640, 200 % (720×450 @2x) · hell und dunkel · für I5-T03-01 zusätzlich Seitenuhr Di 20.10.2026 (`clock.install`) · Server-Probe gegen den gebauten Server (`dist-server`) mit eigener Datenbank · Artefakt-Probe im Skelett der Veröffentlichung
**Uhrzeit der Prüfung:** Samstag, 17.10.2026, ca. 10:25–10:55 Uhr – wie der Test selbst außerhalb der Servicezeit und am Wochenende.

### 12.1 Ergebnis

| Schwere | Befunde (zusammengeführt) | umgesetzt | davon angepasst | teilweise | offen | in dieser Prüfung im Browser nachgestellt |
|---|---|---|---|---|---|---|
| K | 1 | **1** | – | – | – | 1 |
| H | 0 | – | – | – | – | – |
| M | 7 | **7** | 3 | – | – | 7 |
| N | 24 | **24** | 1 | – | – | 11 |
| **Summe** | **32** | **32** | **4** | **0** | **0** | **19** |

- **Der K-Befund ist behoben und nachgestellt** (I5-T03-01), mit Bild:
  - 118/26: Fristen übernommen, eEB mit Zustellung Sa 17.10.2026 abgegeben.
  - Korrektur auf 19.10. (Zukunft) und auf 16.10. (vor dem Eingang) ist gesperrt, mit Meldung am Feld und Grund am Knopf.
  - Mit Seitenuhr Di 20.10.2026 ist der 19.10. keine Zukunft mehr: rote Warnung „später als das Zustellungsdatum laut eEB … Di, 17.11.2026 → Do, 19.11.2026 … § 224 Abs. 2 ZPO“ mit Pflichthäkchen; die Begründungsfrist wird mit neu berechnet (17.12. → 21.12.).
  - Die Kontrollperson Jonas Brandt sieht in der Vier-Augen-Ansicht an beiden Fristen den Chip „weicht vom eEB ab (eEB 17.10.2026)“, in den Details „Ereignis Mo, 19.10.2026 · Zustellung laut eEB Sa, 17.10.2026“.
  - Der Posteingang bietet danach keine zweite Übernahme an; Taste U meldet „Nichts zu übernehmen – Die Nachricht ist bereits 118/26 zugeordnet.“ (Fund der Prüfung, 12.2).
- **Alle 7 M-Befunde sind nachgestellt**, mit Bild (Liste in 11.5, Punkt 3).
- **Die Vorgabe der Projektleitung ist umgesetzt:** `SEED_VERSION` 13 – die Elbtal-Zahlung 6.120 € in 131/26 steht im Reiter „Gebucht“ als Kontoumsatz auf dem Anderkonto („Fremdgeld · 98 % · automatisch“); „Urteil vom 09.10.2026“ statt eines Samstags; Gerichtsanschriften aus der Stammliste.
- **Angepasst** (wie in Abschnitt 10.1 beschlossen): I5-T02-01 (Fokus ins Suchfeld statt globaler Kürzelsperre), I5-T04-01 (Rollen je Akte statt Unterart am Kontakt), I5-T14-01 (Leiste in der Akte statt „+“ in der Tab-Leiste), I5-T22-01 (U = „Vorschlag übernehmen“ statt neuem „Z“). **Erweitert:** I5-T13-01 (ROI-Rechner) und I5-T16-01 (Rechnungs-Briefkopf) – beide in dieser Prüfung nachgezogen. **Teil verworfen:** I5-T07-02, „namenloses ד.
- Die übrigen N-Befunde stützen sich auf die Selbstprüfung der Fixer und auf Tests (Spalte „Nachweis“ in 12.5).

**So ist die Spalte „Nachweis“ zu lesen:**

- **Prüfung** – in dieser Abnahme im Browser nachgestellt (Viewport und Modus stehen dabei).
- **Fixer A / Fixer B** – Selbstprüfung des Fixers laut Rückmeldung; in der Abnahme nicht erneut nachgestellt.
- **Test** – automatischer Test in `npm test`.
- **Server-Probe** – Anfrage gegen den gebauten Server (`dist-server`) mit eigener Datenbank.
- Die Kürzel in Klammern (A-01 … B-09) verweisen auf die Aufträge in Abschnitt 11.4.

### 12.2 In der Prüfung nachgeholt

**Bereichsübergreifende Restpunkte und „nicht umgesetzt“-Punkte der Fixer:**

| Herkunft | Punkt | Umsetzung |
|---|---|---|
| A-02 / I5-T13-01 | ROI-Rechner setzt still „erstes Wartungsjahr enthalten“ voraus | `RoiRechner.tsx`: neuer Schalter „Wartung im ersten Jahr im Lizenzpreis enthalten (laut Angebot)“, **Standard aus**, mit Unterzeile „Nur einschalten, wenn Ihr Angebot das so regelt – sonst rechnet der Vergleich die Wartung ab Jahr 1“. Beide Aufrufe übergeben die Angabe ausdrücklich (`kostenLifetime(…, erstesJahr)`). Feldhinweis „je Platz und Jahr – leer = ohne Wartung“ (an: „… ab Jahr 2 …“), Balken und Zeile „Wartung Jahr 1–5“ bzw. „Jahr 2–5“, Druckansicht ebenso. Der Wert gehört zu „Meine Werte“ und wird mit „Demo-Mengen“ zurückgesetzt. Test in `lizenz.test.ts`. Prüfung D hell und dunkel: 7 Plätze × 300 € Wartung – aus „Wartung Jahr 1–5 10.500 €“, an „Jahr 2–5 8.400 €“; axe 0. |
| A-08 / I5-T16-01 | Rechnungs-Briefkopf kürzt Name und Schwerpunkte (`truncate`) | `abrechnung/ui.tsx` (`Briefkopf`): Name, Schwerpunkte und Absenderzeile umbrechen (`leading-snug [overflow-wrap:anywhere]`) wie die Vorschau im Kanzleiprofil. Gilt für Rechnungsvorschau, Druck und Forderungskonto. Prüfung D hell mit „Reinholz & Hollmann Rechtsanwälte und Fachanwälte für Arbeitsrecht PartG mbB“ und 6 Schwerpunkten: Name in 2 Zeilen, 6 von 6 Schwerpunkten, nichts abgeschnitten; axe 0. |
| B-02 / I5-T22-01 | Schnellhilfe nennt U noch als „Erkannte Fristen übernehmen“ | `Tastenkuerzel.tsx`: „U – Vorschlag übernehmen“ mit Zusatz „Mit Fristvorschlag: Fristen samt Akte übernehmen · ohne Fristvorschlag: Akte zuordnen · sonst nennt eine Meldung den Grund“ (aus den Vorschlägen beider Fixer zusammengeführt). Prüfung D hell: Schnellhilfe „?“ im Posteingang zeigt den Text; axe 0. |
| B-06 | Schalter-Beschreibung per `setAttribute` | `Switch.tsx` hat die Prop `describedBy` (→ `aria-describedby`); `AutomatikSchalter` nutzt sie statt des `useEffect`. Prüfung D hell als Mia Becker: die 3 gesperrten Fristautomatiken verweisen auf den sichtbaren Hinweis „Fristautomatiken schalten Partner und Administration“, die 9 freien Schalter tragen keinen Verweis; axe 0. |
| B-09 | Aufteilung der Fristen nur im lokalen Typ `LaufZahlen` | `core/types.ts`: `UmzugLauf.zahlen.fristenArt?: { fristen; wiedervorlagen; termine }`. `LaufZahlen` ist nur noch ein Alias, die Typumwandlungen in `uebernahme.ts` und `laeufe.ts` entfallen. Test `uebernahme.test.ts` grün. |
| B-05 (optional) | Kontrollkästchen der Tabellen 18×18 px | `DataTable.tsx` (`Checkbox`): Trefferfläche über Polster wie in der E-Akte – 44×44 px am Telefon, 24×24 px ab sm, sichtbar weiter 18 px, Layout unverändert. Gilt für Rechnungs- und Aktenliste, Sammelabrechnung und RVG-Rechner. Prüfung D hell: Rechnungsliste 24×24 (sichtbar 18×18), Zeilenhöhe 47 px wie zuvor; axe 0. |
| B-01 (optional) | Korrigierte Frist wird über das Fristende nicht als „notiert“ erkannt – `fristenUebernehmen` legte eine zweite an | Neu `istNotiertAusNachricht` in `posteingang/analyse.ts`: wie `istNotiert`, zusätzlich zählt eine aus derselben Nachricht übernommene und korrigierte Frist derselben Fristart. `fristenUebernehmen` und die KI-Karte nutzen dieselbe Funktion. Test in `analyse.test.ts` (ohne die Änderung legte der zweite Aufruf eine doppelte Frist an). Prüfung D hell (Seitenuhr 20.10.): nach der Korrektur kein Knopf „Fristen übernehmen“, U meldet den Grund, 118/26 behält 2 Fristen. |
| A-03 (nicht umgesetzt) | „Zugang entfernen“: Fristregel nur in der Oberfläche | `team.remove(id, fristen?)` (optionaler Parameter; bestehende Aufrufe bleiben gültig). Neue Regel `pruefeFristEntscheidungEntfernen` in `lib/backend/types.ts`, gleich im Demo-Backend und im Server (`DELETE /api/team/:id` mit JSON-Rumpf, Fristen nur der eigenen Kanzlei). **Beim Entfernen genügt „selbst überwachen“ nicht** – ein entfernter Zugang hätte Fristen ohne sichtbare Person hinterlassen, und der Cockpit-Hinweis, den der Bestätigungstext versprach, erfasst nur deaktivierte Zugänge. Die Oberfläche bietet beim Entfernen deshalb nur die Übertragung an („Beim Entfernen Pflicht … Sollen sie beim Zugang bleiben, wählen Sie „Deaktivieren““). Außerdem entscheidet jetzt erst das Backend, dann wird übertragen – lehnt es ab, bleibt nichts halb übertragen. Test in `vertretung.test.ts`; Server-Probe (12.3); Prüfung D hell: Entfernen von Jonas Brandt ohne Option „nicht übertragen“, danach „19 Akten und 7 offene Fristen, dazu 1 Wiedervorlage und 1 Termin an Dr. Julia Hartmann übertragen“, Cockpit-Hinweis weg. |
| A-03 (nicht umgesetzt) | Fristenliste ohne Personenfilter per URL | `fristen/Fristen.tsx`: `?verantwortlich=<id>` zeigt die Liste einer Person mit Chip „Verantwortlich: Jonas Brandt (deaktiviert) · 7 Fristen, 1 Wiedervorlage, 1 Termin“ (Zählweise wie `fristenLage`) und „Personenfilter entfernen“. Der Cockpit-Hinweis verlinkt Anwältinnen und Anwälte jetzt mit „Fristen von Jonas Brandt“ dorthin. Prüfung D hell und 320 px dunkel: 9 Einträge, kein Querscrollen; axe 0. |
| A-05 (Sichtprüfung offen) | Mandatsaufnahme „Eingaben verwerfen?“ | Keine Änderung nötig. Prüfung D hell: nach Eingaben öffnet Escape die Rückfrage, Fokus auf „Weiter bearbeiten“; Tab läuft über „Schließen“, Text, „Als Entwurf behalten“, „Eingaben verwerfen“; Enter auf „Weiter bearbeiten“ führt zurück, der Fokus steht wieder im zuletzt benutzten Feld; axe 0. Anders als in der Testsitzung des Fixers kommt die Rückfrage nur, wenn tatsächlich etwas eingegeben ist. |
| A-01 (Info) | Fremdgeld-Dialog 131/26, Tests im Bereich B | Keine Änderung nötig: Weiterleitung nennt „Auszahlung vom Anderkonto“, kein Test im Bereich B betroffen. Die Anderkonto-IBAN ist in den Präsentationskanzleien weiter leer (Vorgabe aus Iteration 4); der Dialog sagt, wo man sie ergänzt. |
| B (PL-Artefaktprüfung) | `build:artifact` und Skelett-Probe nach beiden Paketen | In dieser Prüfung ausgeführt (12.3). |
| A-01 (Teil Gerichtsanschriften) | Coburg, ArbG Paderborn, AG Paderborn – Familiengericht nur mit Ort | Bleibt so (Vorgabe: nur sicher bekannte Anschriften). |
| A (Auftraggeber) · B (Abnahmebericht) | Wartungssatz, enthaltenes Wartungsjahr, Übertragbarkeit, Escrow, Impressum, EU-KI; Preisfragen | Kein Produktauftrag – Abschnitt 4.6 bleibt maßgeblich; im Produkt steht weiter nur der neutrale Wortlaut. |

**Funde der Abnahme, gleich behoben:**

- **axe „target-size“ (serious) am Schließknopf der Apex Island:** In der RVG-Ansicht meldete axe den 20×20-px-Knopf „Apex Island ausblenden“, der über der Island liegt (WCAG 2.5.8). Die Trefferfläche ist jetzt 24×24 px, sichtbar bleibt der 20-px-Kreis (`ApexIsland.tsx`). Danach axe 0 in derselben Ansicht und im ganzen axe-Lauf (12.3).
- **Mandatsaufnahme Schritt 3, „Weiter“ ohne Pflichthäkchen:** Die Meldung erschien, der Fokus blieb aber auf dem Knopf (die Fokusführung galt nur in „Rechtsschutz ergänzen“). Jetzt springt der Fokus auf das Häkchen „Gegenseite?“ bzw. bei leerem Feld in die Versichererauswahl. Prüfung D hell: `#ma-vers` bzw. `#ma-vers-gegenseite-ok` fokussiert.
- **„Zugang entfernen“ mit „nicht übertragen“** und **Übertragung vor der Backend-Prüfung** – siehe A-03 in der Tabelle.
- **Personenfilter-Chip** zählt wie die übrigen Fristenzahlen („7 Fristen, 1 Wiedervorlage, 1 Termin“ statt „9“).

### 12.3 Qualitätstor und Prüfwerte

| Prüfung | Ergebnis |
|---|---|
| `npx tsc --noEmit` | 0 Fehler |
| `npm test` | **229 / 229** grün (Abgabe der Fixer: 226; neu in der Prüfung: korrigierte Frist nicht doppelt übernehmen in `analyse.test.ts`, Fristregel beim Deaktivieren und Entfernen in `vertretung.test.ts`, ROI-Rechner „laut Angebot“ in `lizenz.test.ts`) |
| `npm run build` | Web und Server fehlerfrei (nur der bekannte Größenhinweis zu `dist-server/index.js`, 1,4 MB) |
| Artefakt (`npm run build:artifact`) | `dist-artifact/anwaltapex.html` 2,83 MB, keine externen Verweise. Im Skelett der Veröffentlichung über `python3 -m http.server` (eigenes Verzeichnis im Scratchpad) bestätigt: Landing → Anmeldung per Karte (Präsentationszugang Hartmann) → Cockpit („Ihr Tag auf einen Blick“) → Posteingang mit KI-Analyse 118/26 („Urteil vom 09.10.2026“, Berufungsfrist, 17.11.2026) → Apex Assistent mit getippter Frage. **0 pageerror, 0 console.error.** Server danach per PID beendet. |
| Server-Probe (`dist-server`) | Jonas Brandt mit 7 offenen Fristen: `DELETE /api/team/u-hartmann-2` ohne Angabe **400** („… bevor Sie den Zugang entfernen – oder deaktivieren Sie ihn (umkehrbar)“), mit „selbst überwachen“ **400**, Übertragung an die ReFa **400** („nur eine aktive Rechtsanwältin oder ein aktiver Rechtsanwalt“), `PATCH` Deaktivieren ohne Angabe **400**, Entfernen mit Übertragung an Dr. Hartmann **204** |
| Konsolen-Sweep, Login Dr. Hartmann | **160 Ansichten: 0 pageerrors, 0 console.errors** (500 auf `/api/info` ausgenommen). 56 Routen und Reiter auf D hell und D dunkel (neu u. a. `/fristen?filter=kontrolle`, `/fristen?verantwortlich=…`, `/einstellungen?tab=team&uebertragen=…`, Rechnung per `?rechnung=`), davon 34 auch auf M hell, 9 Hauptrouten auf Tablet quer, Landing und Anmeldung hell und dunkel, Apex Console |
| axe-core (WCAG 2.2 A/AA) | **0 serious/critical in 68 Ansichten**: 20 Routen auf D dunkel, D hell und M dunkel; Cockpit, Fristen und Akte bei 320 px und bei 200 % dunkel; Landing hell und dunkel. Dazu 0 in allen Nachweis-Ansichten aus 12.5 – nach dem Fund an der Apex Island (12.2) |
| Texte (`grep` in `src`, Plan 11.5 Punkt 7) | 0 × „das erste Jahr ist enthalten“, 0 × „z. B. Zustellung laut eEB erst am“, kein `truncate`/`line-clamp` in `LiveFeed.tsx`, „Schmidt“ in Originalschreibweise (Test und Prüfung) |

| Prüfwert | Soll | Ist |
|---|---|---|
| T07 RVG 2025 / 2021 | 2.968,46 € / 2.797,69 € | **exakt** (`berechneRvg`: 919,10 · 848,40 · 707,00 · netto 2.494,50 · USt 473,96 bzw. 865,80 · 799,20 · 666,00 · netto 2.351,00 · USt 446,69) |
| T07 Zeithonorar | 1,5 Std. × 240 € = 360,00 € + 68,40 € = 428,40 € | **exakt** (Test `lib.test.ts`, Nachrechnung) |
| T07 Sammelabrechnung | 4 Akten 2.281,89 € | **Beträge unverändert:** Filter „Deckung erteilt“ zeigt heute 5 Akten mit 3.484,50 €; ohne 146/26 (1.202,61 €) sind es genau **2.281,89 €** – im Test war 146/26 nicht in der Auswahl (Browser) |
| T09 A / B / C | 43,23 € · 26,79 € · 42,72 € | **exakt** (`verzugszinsen`); Forderungskonto 126/26 **155,77 €**, Satz 6,52 % (Browser) |
| T04 Klagefrist | Mo 02.11.2026 | **2026-11-02** |
| T18 Fall 1, 2, 3a, 3b | Mo 01.03.2027 / Di 30.03.2027 · Di 09.03.2027 (BE) / Mo 08.03.2027 (NW) · Mo 08.03.2027 (BB) · Mo 01.11.2027, Vorfrist Mo 25.10.2027 | **exakt** |
| FamFG | § 63 Abs. 1 Fr 15.01.2027 → Mo 15.02.2027; Begründung Mo 15.03.2027 | **exakt** |
| T02/T03 | Berufung Di 17.11.2026 (Vorfrist Di 10.11.), Begründung Do 17.12.2026 (Vorfrist Do 03.12.) | **exakt** (Zustellung Sa 17.10.2026, Kammergericht) |
| A-04 | Mo 05.10.2026 + 2 Tage → Mi 07.10.2026, Vorfrist Mo 05.10.2026 | **exakt** |
| T10 | 20,22 × 48 × 26,04 € = 25.273,38 € · 28,20 × 48 × 26,04 € = 35.247,74 € · Zielwert 38 × 48 × 26,04 € = 47.496,96 € ≈ 47.500 € | **exakt** (Nachrechnung; Zielwertsatz im Browser) |
| T08 | Hanseatische 5.670,00 € auf dem Anderkonto (107/26); Elbtal 6.120,00 € Anderkonto (131/26) | **Anderkonto** (Fixer A; Elbtal im Reiter „Gebucht“ in der Prüfung) |

### 12.4 Offen und Hinweise für den Abnahme-Nachtest

- **Produktseitig ist nichts offen.** Die drei Produktbedingungen aus Abschnitt 4.1 (I5-T03-01, I5-T07-01, I5-T13-01) sind umgesetzt und in dieser Prüfung vorgeführt. Ob sie für Claudia Reinholz erledigt sind, entscheidet der empfohlene Abnahme-Nachtest (11.6); danach Kauf heute, Vertrauen, Fachlich, UEQ-S und SUS neu erheben.
- **Entscheidungen des Auftraggebers (unverändert, Abschnitt 4.6):** Lizenzpreis und Angebot, Wartung (Satz, Inhalt, enthaltenes Jahr), Übertragbarkeit, Escrow, EU-Verarbeitung der Live-KI, Impressum (I1-T00-02, H, teilweise), Festpreis Umzug, Pilot/Raten, Nutzung ohne Wartung. Im Produkt steht dazu nur der neutrale Wortlaut; der ROI-Rechner fragt „laut Angebot“, statt etwas anzunehmen.
- **Neue Wege für den Nachtest:**
  - T03: Korrektur nach dem eEB nur mit Seitenuhr nach dem Zustellungstag sinnvoll prüfbar (Plan 11.6, feste Uhr).
  - T23: Deaktivieren mit Pflichtentscheidung, Cockpit-Hinweis, `/fristen?verantwortlich=<id>`; **Entfernen nur noch mit Übertragung.**
  - T13/T10: Schalter „Wartung im ersten Jahr im Lizenzpreis enthalten (laut Angebot)“, Standard aus.
  - T02/T22: U = „Vorschlag übernehmen“, Rückgängig nach „Akte zuordnen“.
- **Bankabgleich nach `SEED_VERSION` 13:** Die Elbtal-Zahlung ist bereits gebucht. Der Filter im Reiter „Offen“ zählt deshalb weiter „Alle 9 · Geschäftskonto 8 · Anderkonto 1“ (nicht „Alle 10 · … · Anderkonto 2“ wie in 11.6 vermutet); „Gebucht“ zählt 7, davon 1 Anderkonto. „Abgleich starten“ meldet am Sa 17.10. „4 gebucht · 2 Vorschläge · 2 Kanzleikosten · 1 Fremdgeld“ (Fixer A; mit und ohne Elbtal-Umsatz gleich).
- **Sammelabrechnung:** „Deckung erteilt“ umfasst 5 Akten; für den Prüfwert 2.281,89 € 146/26 abwählen.
- **Demodaten `SEED_VERSION` 13:** frische Profile verwenden.

### 12.5 Befunde einzeln

| ID | S | Status | Was geändert | Nachweis |
|---|---|---|---|---|
| | | | **Vorgabe der Projektleitung** | |
| Elbtal 6.120 € (10.2) | – | umgesetzt | Kontoumsatz `hero-t-elbtal` auf dem Anderkonto, zugeordnet als Fremdgeld 131/26 (0,98, automatisch), Buchung verweist darauf; `SEED_VERSION` 13; Fingerabdruck-Test (A-01) | **Prüfung** D hell: „Gebucht“ – ELBTAL VERSICHERUNG AG +6.120,00 € · Anderkonto · Fremdgeld · 98 % · automatisch · 131/26; Test `core.test.ts`; [Bild](iteration-5/bilder/nachweis/N-A01-elbtal-gebucht-anderkonto-D-hell.jpg) |
| | | | **8.1 Landing** | |
| I5-T00-01 | N | umgesetzt | `lib/typografie.ts` (`mitEinheit`, `schuetzeKennzahlen`): geschützte Leerzeichen zwischen Zahl und Einheit in Fußnoten, Kennzahlenleiste und Motor-Abschnitt (A-08) | Fixer A (26 Zahl-Einheit-Paare, D und 320 px, axe 0); Test `core.test.ts` |
| | | | **8.2 Apex Console und Einstellungen** | |
| I5-T13-01 | M | umgesetzt (erweitert) | `WARTUNG_OPTIONAL` und `LIZENZ_KERN` in `content/lizenz.ts`, Lizenz-Tab in beiden Zweigen neutral (A-02); ROI-Rechner mit Schalter „laut Angebot“, Standard aus (Prüfung) | **Prüfung** D hell und dunkel: Lizenz-Tab und Landing wortgleich „Wartung optional – Umfang und Preis regelt das Angebot“, kein „erste Jahr“; ROI 10.500 € (Jahr 1–5) bzw. 8.400 € (Jahr 2–5); Tests `lizenz.test.ts`; [Bild](iteration-5/bilder/nachweis/M-T13-01-1-lizenz-tab-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/M-T13-01-2-roi-schalter-aus-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/M-T13-01-3-roi-schalter-an-D-dunkel.jpg) |
| I5-T23-01 | M | umgesetzt | Pflichtentscheidung beim Deaktivieren, Vorbelegung, „nicht übertragen“ nur mit Häkchen, Protokoll, Cockpit-Hinweis, Menüpunkt „Akten und Fristen übertragen …“, Regel in Demo-Backend und Server (A-03); Entfernen nur mit Übertragung in Oberfläche, Demo-Backend und Server, Personenfilter `?verantwortlich=` (Prüfung) | **Prüfung** D hell: vorbelegt Dr. Julia Hartmann; „nicht übertragen“ ohne Häkchen gesperrt („Bitte bestätigen Sie …“); Cockpit „7 offene Fristen eines deaktivierten Zugangs (Jonas Brandt), dazu 1 Wiedervorlage und 1 Termin“; Personenfilter 9 Einträge; Entfernen überträgt alles; axe 0; Server-Probe; Tests `vertretung.test.ts`; [Bild](iteration-5/bilder/nachweis/M-T23-01-1-deaktivieren-nicht-uebertragen-gesperrt-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/M-T23-01-2-cockpit-hinweis-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/M-T23-01-3-fristen-personenfilter-R-dunkel.jpg) · [Bild](iteration-5/bilder/nachweis/M-T23-01-4-entfernen-nur-mit-uebertragung-D-hell.jpg) |
| I5-T21-01 | N | umgesetzt | `kanzleiStatusZahlen`/`kanzleiStatusText` in `core/kennzahlen.ts`: „3 aktiv · 1 im Test · 0 pausiert“ (A-08) | Fixer A (vor/nach dem Anlegen eines Testzugangs, axe 0); Test `core.test.ts` |
| I5-T16-01 | N | umgesetzt (erweitert) | Vorschau Briefkopf umbricht, alle Schwerpunkte (A-08); Rechnungs-Briefkopf ebenso (Prüfung) | **Prüfung** D hell: Rechnungsvorschau mit langem Namen in 2 Zeilen, 6/6 Schwerpunkte, Absenderzeile vollständig; Fixer A (Vorschau, 5/5 Schwerpunkte); [Bild](iteration-5/bilder/nachweis/N-T16-01-rechnung-briefkopf-umbruch-D-hell.jpg) |
| | | | **8.3 Rahmen** | |
| I5-T07-02 | N | umgesetzt, Teil verworfen | `ConfirmHost`: Anfangsfokus immer auf „Abbrechen“, Bestätigen ist der nächste Tab-Stopp (A-05); „namenloses ד verworfen (Name „Schließen“ vorhanden) | Fixer A („Stornieren“ und „Korrigieren“: Fokus „Abbrechen“, Tab → Bestätigen); **Prüfung** D hell, eigene Rückfrage der Mandatsaufnahme: Fokus „Weiter bearbeiten“; [Bild](iteration-5/bilder/nachweis/N-A05-eingaben-verwerfen-fokus-D-hell.jpg) |
| I5-T03-02 | N | umgesetzt | `Toaster`: weicht nach oben rechts aus, wenn die Meldung das fokussierte Element oder seine Zeile überdecken würde (A-05) | Fixer A (Vier-Augen-Filter, Posteingang 118/26, Cockpit ohne Überdeckung) |
| I5-T15-01 | N | umgesetzt | Kompakte Tab-Leiste unter 500 px Höhe mit Beschriftung neben dem Symbol (A-06) | **Prüfung** 720×450 @2x dunkel, `/fristen`: „Cockpit · Akten · Post 6 · Fristen · Mehr“, Leiste 44 px = 9,8 %, kein Querscrollen, axe 0; Fixer A (390×844, 320×640 unverändert); [Bild](iteration-5/bilder/nachweis/N-T15-01-tableiste-200-prozent-Z-dunkel.jpg) |
| | | | **8.4 Fristen und Fristenrechner** | |
| **I5-T03-01** | **K** | umgesetzt | Korrektur an das eEB gebunden: keine Zustellung in der Zukunft oder vor dem Eingang, eEB-Datum im Dialog, spätere Abweichung nur mit Pflichthäkchen, frühere mit Hinweis, Chip „weicht vom eEB ab“ in Liste, Vier-Augen-Ansicht, Details und Akte, Geschwisterfristen gemeinsam, neutrale Platzhalter (B-01); korrigierte Frist gilt als notiert, keine Doppelübernahme (Prüfung) | **Prüfung** D hell (Uhr 17.10. und 20.10.) und D dunkel, Kontrollperson Jonas Brandt: siehe 12.1; axe 0 in Dialog, Liste und Details; Tests `logik.test.ts`, `analyse.test.ts`; [Bild](iteration-5/bilder/nachweis/K-T03-01-1-korrektur-19-10-gesperrt-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/K-T03-01-2-warnung-pflichthaekchen-20-10-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/K-T03-01-3-vier-augen-chip-jonas-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/K-T03-01-4-fristdetail-eeb-jonas-D-dunkel.jpg) |
| I5-T15-02 | N | umgesetzt | `vorfristAbEreignis` in `core/fristen.ts`: Vorfrist frühestens am Ereignistag, mit Hinweis im Rechenweg (A-04) | Test `fristen.i1.test.ts`; Nachrechnung: Mo 05.10. + 2 Tage → Mi 07.10., Vorfrist Mo 05.10.; Prüfwerte T18/T02/T03 unverändert |
| I5-T17-02 | N | umgesetzt | Pflichtmeldungen erst nach dem Speicherversuch, dann am Feld mit Fokus („Neuer Kontakt“, „Frist korrigieren“) (B-09) | Fixer B; **Prüfung** D hell: Korrekturdialog beim Öffnen ohne Fehlertext, Platzhalter „z. B. Fristart falsch gewählt“ |
| | | | **8.5 Posteingang** | |
| I5-T02-01 | M | umgesetzt (angepasst) | `AktenSuchauswahl` mit `autoFokus`/`onEscape`: Fokus ins Suchfeld, Feld und Liste ins Bild; Escape zurück zum Knopf (B-02) | **Prüfung** D hell: nach „Andere Akte wählen“ Fokus im Suchfeld, „Weber“ steht im Feld, 142/26 im Bild, kein Wiedervorlage-Dialog; Umhängen 3 Aktionen ohne Texteingabe (beim Urteil 4 mit dem Pflichthäkchen für das fremde Gerichts-Az.; vorher 5 und 1 Fehlaktion); axe 0; [Bild](iteration-5/bilder/nachweis/M-T02-01-weber-im-suchfeld-D-hell.jpg) |
| I5-T22-01 | N | umgesetzt (angepasst) | U = „Vorschlag übernehmen“: ohne Fristvorschlag ordnet U die Akte zu (Kürzel am Knopf), wirkungslose Taste meldet den Grund, Rückgängig nach „Akte zuordnen“ (B-02); Schnellhilfe-Text (Prüfung) | **Prüfung** D hell: Schnellhilfe zeigt den neuen Text; U nach Übernahme → „Nichts zu übernehmen – … bereits 118/26 zugeordnet“; Fixer B (Mia Becker L hell); [Bild](iteration-5/bilder/nachweis/N-T22-01-schnellhilfe-u-D-hell.jpg) |
| | | | **8.6 Akten** | |
| I5-T04-01 | M | umgesetzt (angepasst) | `versichererOptionen` mit Rollen je Akte und Gruppen, `versichererWarnung`, Pflichthäkchen in Mandatsaufnahme und „Rechtsschutz ergänzen“ (B-04); Fokus aufs Häkchen bzw. Feld in Schritt 3 (Prüfung) | **Prüfung** D hell: Gruppe „Rechtsschutzversicherer“ (Nordlicht, Spreebogen, Elbtal „RSV in 116/26 · Gegnerin in 131/26“, Isarwerk) vor „Weitere Versicherer“ (Hanseatische „Gegnerin in 107/26“); Hanseatische → Warnung, „Weiter“ ohne Häkchen → Meldung und Fokus aufs Häkchen; axe 0; Test `rsv.test.ts`; [Bild](iteration-5/bilder/nachweis/M-T04-01-hanseatische-pflicht-D-hell.jpg) · [Bild](iteration-5/bilder/nachweis/M-T04-01-fokus-haekchen-D-hell.jpg) |
| I5-T14-01 | M | umgesetzt (angepasst) | Aktionsleiste „Notiz · Frist · Wiedervorlage“ im Daumenbereich, sobald die Kopf-Aktionen aus dem Bild sind (B-05) | **Prüfung** M hell, 151/26 gescrollt: Leiste y 708–760 von 844 (unteres Drittel), Knöpfe 44 px hoch, „Notiz“ öffnet mit einem Tap „Notiz zur Akte“; axe 0; Fixer B (320 px dunkel, ab sm keine Leiste); [Bild](iteration-5/bilder/nachweis/M-T14-01-aktionsleiste-daumenbereich-M-hell.jpg) |
| I5-T14-02 | N | umgesetzt | Eigenes Kästchen in der E-Akte, 44×44 px am Telefon, 24×24 px ab sm (B-05); dasselbe für alle Tabellen (Prüfung, `DataTable`) | **Prüfung** M hell: „Alle auswählen“ und Zeilen 44×44; D hell: Rechnungsliste 24×24 bei unveränderter Zeilenhöhe |
| I5-T19-01 | N | umgesetzt | `quelleLabel`: „KI-Entwurf, gespeichert von …“, „Aus Vorlage erstellt von …“, „Automatisch erstellt (38h-Motor)“ (B-08) | Fixer B (E-Akte 142/26, axe 0) |
| | | | **8.7 Kontakte und Demodaten** | |
| I5-T17-01 | N | umgesetzt | Stammliste `GERICHTSANSCHRIFTEN`; Kontakt, Ladung und Termin aus derselben Quelle (A-01) | Fixer A (Arbeitsgericht Berlin „Magdeburger Platz 1, 10785 Berlin“); Test `core.test.ts` |
| I5-T02-02 | N | umgesetzt | `ctx.gerichtstag()`: gerichtliche Daten auf den vorherigen Werktag (A-01) | **Prüfung** D hell und Artefakt: „Urteil vom 09.10.2026“; Test `core.test.ts` (Stichtage 16.–22.10. nie Sa/So/Feiertag) |
| | | | **8.8 Abrechnung** | |
| I5-T07-01 | M | umgesetzt | `pruefeBetragEingabe`/`pruefeZinssatzEingabe`; Meldung am Feld, kein Ergebnis, Grund am gesperrten Knopf; Zinsrechner ebenso (B-03) | **Prüfung** D hell: „-500“ → „Bitte einen Gegenstandswert über 0 € eingeben.“, `aria-invalid`, kein 238,30 €, „Erst einen Gegenstandswert über 0 € eintragen und eine Akte wählen“; axe 0 (nach dem Fund an der Island); Test `lib.test.ts`; [Bild](iteration-5/bilder/nachweis/M-T07-01-rvg-minus-500-D-hell.jpg) |
| I5-T07-03 | N | umgesetzt | Korrekturentwurf übernimmt Leistungszeitraum und Bearbeitung der stornierten Rechnung, auch in XRechnung/ZUGFeRD (B-07) | Fixer B (22.08.–15.10.2026, Jonas Brandt, 1.117,53 €); Test `lib.test.ts` |
| I5-T07-04 | N | umgesetzt | Sprungmarke „Springen zu: Rechnungsliste“ und Knopf „Zur Rechnungsliste springen“ (B-03) | Fixer B (2 Tab-Stopps bis zur ersten Rechnung); Prüfung: Sprungmarke sichtbar ([Bild](iteration-5/bilder/nachweis/N-T16-01-rechnung-briefkopf-umbruch-D-hell.jpg)) |
| I5-T07-05 | N | umgesetzt | „Aus Zeiten abrechnen“ durchgehend Std:Min (`fmtDauerAusMenge`) (B-03) | Fixer B; Test `lib.test.ts` |
| I5-T08-01 | N | umgesetzt | `LaufStand.abgeschlossen`; Statuszeile „Abgleich abgeschlossen am …“ (B-07) | Fixer B (Abgleich starten, Seite wechseln, zurück: „abgeschlossen“) |
| | | | **8.9 Apex KI** | |
| I5-T19-02 | N | umgesetzt | `dokumentAnalyseStand.ts`: letztes Ergebnis je Akte bis Verwerfen oder Übernehmen, je Kanzlei getrennt (B-08) | Fixer B (Mi 30.12.2026 auch nach Seitenwechsel und Neuladen; Verwerfen ändert nichts) |
| | | | **8.10 38h-Motor** | |
| I5-T10-01 | M | umgesetzt | `zielwertText`: Zielwert zum eingestellten Kostensatz, gerundet wie Fußnote ² der Landing (B-06) | **Prüfung** D hell: „Zielwert des 38h-Motors: Ø 38 Std. pro Woche – zu Ihrem Kostensatz von 26,04 €/Std. ≈ 47.500 € pro Jahr (38 × 48 × 26,04 € = 47.496,96 €). Unser veröffentlichter Zielwert ≈ 36.000 € rechnet bewusst niedrig mit 19,74 €/Std.“; [Bild](iteration-5/bilder/nachweis/M-T13-01-2-roi-schalter-aus-D-hell.jpg) (Rechner) |
| I5-T10-02 | N | umgesetzt | „Zuletzt erledigt“ umbricht statt zu kürzen (B-06) | Fixer B (7/7 ungekürzt); `grep`: kein `truncate`/`line-clamp` in `LiveFeed.tsx` |
| I5-T10-03 | N | umgesetzt | Fester Name „Automatik „…““, Zustand nur über `aria-checked` (B-06); Beschreibung über `Switch.describedBy` (Prüfung) | **Prüfung** D hell als Mia Becker: 3 gesperrte Schalter mit Verweis auf den sichtbaren Hinweis, freie ohne; axe 0 |
| | | | **8.11 Umzug** | |
| I5-T11-01 | N | umgesetzt | `fristenArt` im Lauf gespeichert, eine Zählfunktion für aktive und rückgängig gemachte Läufe (B-09); Feld im Typ `UmzugLauf` (Prüfung) | Fixer B („9 Fristen, 2 Wiedervorlagen und 1 Termin“ vor und nach Rückgängig); Test `uebernahme.test.ts` |
| | | | **8.12 Apex Assistent** | |
| I5-T12-01 | N | umgesetzt | Zweiter Weg in der Notfallantwort: Verlängerungsantrag vor Fristablauf, ersatzweise einreichen, Norm je Gericht; Wissenskarte ergänzt (A-07) | **Prüfung** D dunkel: § 46g S. 3, 4 ArbGG, „Verlängerungsantrag vor Fristablauf stellen – ebenfalls ersatzweise einreichen (LAG: § 66 Abs. 1 S. 5 ArbGG)“, „Die Berufungsfrist selbst ist eine Notfrist und nicht verlängerbar“; axe 0; Test `assistent.i1.test.ts`; [Bild](iteration-5/bilder/nachweis/N-T12-01-notfall-verlaengerungsantrag-D-dunkel.jpg) |
| I5-T20-01 | N | umgesetzt | `lib/speech.ts` beendet bei jedem Fehler sofort; ohne Eingabegerät sofortige Meldung (A-07) | Fixer A (302 Proben ohne Mediengerät, 0 × gleichzeitig „Ich höre zu“ und Fehler) |
| I5-T20-02 | N | umgesetzt | Originalschreibweise; Knopf „Rückruf anfordern“ unter der Rückruf-Frage (A-07) | **Prüfung** D hell: „Eine Akte „Schmidt“ habe ich in Ihrer Kanzlei nicht gefunden.“; M hell: Knopf unter „Soll ich einen Rückruf für dann anfordern?“, Klick sendet „Ja, bitte.“, „im Prototyp simuliert“, Knopf verschwindet; axe 0; Test `assistent.i1.test.ts`; [Bild](iteration-5/bilder/nachweis/N-T20-02-rueckruf-knopf-M-hell.jpg) |

### 12.6 Bilder zum Nachweis

| Bild | Was es zeigt |
|---|---|
| ![Korrektur gesperrt](iteration-5/bilder/nachweis/K-T03-01-1-korrektur-19-10-gesperrt-D-hell.jpg) | **I5-T03-01 (K)** – „Notfrist korrigieren“ am Sa 17.10.: Zustellungsdatum laut eEB oben, 19.10.2026 mit „Zustellungsdatum kann nicht in der Zukunft liegen“, Grund am Knopf (D hell). |
| ![Warnung mit Pflichthäkchen](iteration-5/bilder/nachweis/K-T03-01-2-warnung-pflichthaekchen-20-10-D-hell.jpg) | **I5-T03-01 (K)** – Seitenuhr Di 20.10.: rote Warnung „später als das Zustellungsdatum laut eEB“, Pflichthäkchen, Begründungsfrist „Auch neu berechnen“ (D hell). |
| ![Vier-Augen-Chip](iteration-5/bilder/nachweis/K-T03-01-3-vier-augen-chip-jonas-D-hell.jpg) | **I5-T03-01 (K)** – Kontrollperson Jonas Brandt: beide Fristen mit „korrigiert“ und „weicht vom eEB ab (eEB 17.10.2026)“ (D hell). |
| ![Fristdetail dunkel](iteration-5/bilder/nachweis/K-T03-01-4-fristdetail-eeb-jonas-D-dunkel.jpg) | **I5-T03-01 (K)** – Fristdetails: Ereignis Mo 19.10. neben „Zustellung laut eEB Sa 17.10.2026“ (D dunkel). |
| ![Weber im Suchfeld](iteration-5/bilder/nachweis/M-T02-01-weber-im-suchfeld-D-hell.jpg) | **I5-T02-01 (M)** – „Weber“ steht im Suchfeld, 142/26 im Bild, keine Wiedervorlage (D hell). |
| ![RVG -500](iteration-5/bilder/nachweis/M-T07-01-rvg-minus-500-D-hell.jpg) | **I5-T07-01 (M)** – „-500“: Meldung am Feld, kein Ergebnis (D hell). |
| ![Lizenz-Tab](iteration-5/bilder/nachweis/M-T13-01-1-lizenz-tab-D-hell.jpg) | **I5-T13-01 (M)** – Lizenz-Tab: „Wartung optional – Umfang und Preis regelt das Angebot“ (D hell). |
| ![ROI aus](iteration-5/bilder/nachweis/M-T13-01-2-roi-schalter-aus-D-hell.jpg) | **I5-T13-01 (M), I5-T10-01 (M)** – ROI-Rechner: Schalter „laut Angebot“ aus, „Wartung Jahr 1–5“ (D hell). |
| ![ROI an](iteration-5/bilder/nachweis/M-T13-01-3-roi-schalter-an-D-dunkel.jpg) | **I5-T13-01 (M)** – Schalter an: „ab Jahr 2“, „Wartung Jahr 2–5 8.400 €“ (D dunkel). |
| ![Deaktivieren gesperrt](iteration-5/bilder/nachweis/M-T23-01-1-deaktivieren-nicht-uebertragen-gesperrt-D-hell.jpg) | **I5-T23-01 (M)** – „Nicht übertragen“ ohne Häkchen: „Deaktivieren“ gesperrt, Grund darunter (D hell). |
| ![Cockpit-Hinweis](iteration-5/bilder/nachweis/M-T23-01-2-cockpit-hinweis-D-hell.jpg) | **I5-T23-01 (M)** – Cockpit: „7 offene Fristen eines deaktivierten Zugangs (Jonas Brandt), dazu 1 Wiedervorlage und 1 Termin“ (D hell). |
| ![Personenfilter](iteration-5/bilder/nachweis/M-T23-01-3-fristen-personenfilter-R-dunkel.jpg) | **I5-T23-01 (Prüfung)** – Fristenliste `?verantwortlich=`: Chip „Verantwortlich: Jonas Brandt · 7 Fristen, 1 Wiedervorlage, 1 Termin“ (320 px dunkel). |
| ![Entfernen](iteration-5/bilder/nachweis/M-T23-01-4-entfernen-nur-mit-uebertragung-D-hell.jpg) | **I5-T23-01 (Prüfung)** – „Zugang entfernen“: Übertragung Pflicht, keine Option „nicht übertragen“ (D hell). |
| ![Versicherer](iteration-5/bilder/nachweis/M-T04-01-hanseatische-pflicht-D-hell.jpg) | **I5-T04-01 (M)** – Hanseatische nur als Gegnerin bekannt: Warnung, Pflichthäkchen (D hell). |
| ![Fokus aufs Häkchen](iteration-5/bilder/nachweis/M-T04-01-fokus-haekchen-D-hell.jpg) | **I5-T04-01 (Prüfung)** – „Weiter“ ohne Häkchen: Meldung, Fokus auf dem Häkchen (D hell). |
| ![Aktionsleiste](iteration-5/bilder/nachweis/M-T14-01-aktionsleiste-daumenbereich-M-hell.jpg) | **I5-T14-01 (M)** – 151/26 am iPhone gescrollt: „Notiz · Frist · Wiedervorlage“ über der Tab-Leiste (M hell). |
| ![Briefkopf](iteration-5/bilder/nachweis/N-T16-01-rechnung-briefkopf-umbruch-D-hell.jpg) | **I5-T16-01 (Prüfung)** – Rechnungs-Briefkopf mit langem Namen und 6 Schwerpunkten, ungekürzt (D hell). |
| ![Tab-Leiste 200 %](iteration-5/bilder/nachweis/N-T15-01-tableiste-200-prozent-Z-dunkel.jpg) | **I5-T15-01 (N)** – 200 %: „Cockpit · Akten · Post 6 · Fristen · Mehr“ (dunkel). |
| ![Schnellhilfe U](iteration-5/bilder/nachweis/N-T22-01-schnellhilfe-u-D-hell.jpg) | **I5-T22-01 (Prüfung)** – Schnellhilfe: „U – Vorschlag übernehmen“ (D hell). |
| ![Notfallantwort](iteration-5/bilder/nachweis/N-T12-01-notfall-verlaengerungsantrag-D-dunkel.jpg) | **I5-T12-01 (N)** – Notfallantwort LAG mit Verlängerungsantrag (§ 66 Abs. 1 S. 5 ArbGG) (D dunkel). |
| ![Rückruf-Knopf](iteration-5/bilder/nachweis/N-T20-02-rueckruf-knopf-M-hell.jpg) | **I5-T20-02 (N)** – „Rückruf anfordern“ unter der Rückruf-Frage (M hell). |
| ![Eingaben verwerfen](iteration-5/bilder/nachweis/N-A05-eingaben-verwerfen-fokus-D-hell.jpg) | **A-05 (Sichtprüfung)** – „Eingaben verwerfen?“ mit Fokus auf „Weiter bearbeiten“ (D hell). |
| ![Elbtal](iteration-5/bilder/nachweis/N-A01-elbtal-gebucht-anderkonto-D-hell.jpg) | **Vorgabe der Projektleitung** – Bankabgleich „Gebucht“: Elbtal +6.120,00 € auf dem Anderkonto, Fremdgeld 131/26 (D hell). |

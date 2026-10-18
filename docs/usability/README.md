# Usability-Studie Apex – Kundenavatar Claudia Reinholz

> **Hinweis:** Das Produkt heißt seit 18.10.2026 Apex (vormals AnwaltApex). Die Iterationsberichte sind historische Dokumente und nennen den damaligen Namen.

**Ablauf:** In 5 End-to-End-Iterationen bedient der Kundenavatar **Claudia Reinholz** alle 24 Aufgaben T00–T23 in allen 16 Bereichen. Sie ist Fachanwältin für Arbeitsrecht und geschäftsführende Partnerin einer kleinen Sozietät in Paderborn (fiktiv). Persona, Aufgaben, Messmethode und Bewertungsraster stehen in [`docs/KUNDENAVATAR.md`](../KUNDENAVATAR.md), Abschnitt 1.

**Messgrößen je Iteration:**

- Aufgabenerfolg, Aktionen und Fehlaktionen
- SEQ und SUS (Trendwert einer simulierten Person)
- UEQ-S und Schulnoten
- axe-core
- Befunde nach Schweregrad: **K** kritisch · **H** hoch · **M** mittel · **N** niedrig

**Befund-IDs** folgen dem Schema `I{n}-T{xx}-{nn}` und bleiben bis zur Behebung gleich. Jede Iteration ab der zweiten beginnt mit dem Nachtest der offenen Befunde.

**Abnahmeziel nach Iteration 5:**

- alle 24 Aufgaben ohne Hilfe erledigt
- 0 offene K- und H-Befunde
- alle Prüfwerte exakt
- axe-core ohne serious- und critical-Verstöße
- SUS ≥ 80, UEQ-S ≥ +1,5
- alle Noten ≤ 2,0, Vertrauen und Fachliche Korrektheit = 1

## Übersicht

| Iteration | Datum | Schwerpunkt | Aufgaben erfolgreich | SUS | UEQ-S (prag. / hed.) | Ø Note | Befunde K / H / M / N | umgesetzt | Bericht |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 16.10.2026 | Erstkontakt und Baseline | 6 / 24 ohne Umweg (Erfolgskriterium 8 / 24) | 65,6 | +1,13 / +1,25 | 2,6 | 4 / 42 / 63 / 24 | **131 / 132** (K 4/4 · H 42/42 · M 62/63 · N 23/23) · 1 teilweise · 1 verworfen | [iteration-1.md](iteration-1.md), [Nachweis](iteration-1.md#9-umsetzung--nachweis) |
| 2 | 16.10.2026 | Effizienz und Tastatur | 22 / 24 ohne Umweg (Erfolgskriterium 24 / 24) | 71,9 | +1,44 / +1,38 | 2,1 | 2 / 8 / 35 / 43 | **88 / 88** (K 2/2 · H 8/8 · M 35/35 · N 43/43) · davon 4 angepasst · dazu 9 / 9 Vorrunden-IDs · 0 verworfen | [iteration-2.md](iteration-2.md), [Umsetzungsplan](iteration-2.md#10-umsetzungsplan), [Nachweis](iteration-2.md#11-umsetzung--nachweis) |
| 3 | 17.10.2026 | Mobil und Tablet | 21 / 24 ohne Umweg (Erfolgskriterium 24 / 24) | 76,3 | +1,63 / +1,31 | 2,07 | 0 / 8 / 23 / 28 | **59 / 59** (K 0/0 · H 8/8 · M 23/23 · N 28/28) · davon 5 angepasst · dazu I2-T04-01 und die Vorgabe der Projektleitung (`SEED_VERSION` 11) · 0 verworfen | [iteration-3.md](iteration-3.md), [Umsetzungsplan](iteration-3.md#10-umsetzungsplan), [Nachweis](iteration-3.md#11-umsetzung--nachweis) |
| 4 | 17.10.2026 | Lesbarkeit, Dunkelmodus und Barrierefreiheit | 21 / 24 ohne Umweg (Erfolgskriterium 24 / 24) | 78,1 | +1,63 / +1,25 | 2,02 | 1 / 3 / 19 / 29 | **52 / 52** (K 1/1 · H 3/3 · M 19/19 · N 29/29) · davon 3 angepasst · 1 Teil verworfen (I4-T10-01, Cockpit-Karte) · dazu Anderkonto-IBAN im Kanzleiprofil und die Vorgabe der Projektleitung (`SEED_VERSION` 12) · 0 ganz verworfen | [iteration-4.md](iteration-4.md), [Umsetzungsplan](iteration-4.md#10-umsetzungsplan), [Nachweis](iteration-4.md#11-umsetzung--nachweis) |
| 5 | 17.10.2026 | Abnahme und Kaufentscheidung | 24 / 24 ohne Umweg (Erfolgskriterium 24 / 24) | 80,6 | +1,69 / +1,44 | 1,83 | 1 / 0 / 7 / 24 | **32 / 32** (K 1/1 · H 0/0 · M 7/7 · N 24/24) · davon 4 angepasst, 2 erweitert · 1 Teil verworfen (I5-T07-02, „ד) · dazu die Vorgabe der Projektleitung (Elbtal-Zahlung auf dem Anderkonto, `SEED_VERSION` 13) · 0 ganz verworfen | [iteration-5.md](iteration-5.md), [Abnahme](iteration-5.md#4-abnahme-und-kaufentscheidung), [Umsetzungsplan](iteration-5.md#11-umsetzungsplan), [Nachweis](iteration-5.md#12-umsetzung--nachweis) |

**Hinweise zur Tabelle:**

- **Aufgaben erfolgreich** zählt die Aufgaben, die ohne Umweg und ohne Hilfe erledigt wurden. In Klammern steht, bei wie vielen Aufgaben das Erfolgskriterium erfüllt war.
- **SUS** ist der Mittelwert der vier Testblöcke (Trendwert).
- **Befunde** sind nach dem Zusammenführen von Duplikaten gezählt (Iteration 1: 141 roh, 133 zusammengeführt; Iteration 2: 90 roh, 88 zusammengeführt, davon 2 von der Testleitung neu eingestuft; Iteration 3: 64 roh, 59 zusammengeführt, davon 1 neu eingestuft; Iteration 4: 54 roh, 52 zusammengeführt, 2 im Umfang erweitert; Iteration 5: 32 roh, 32 zusammengeführt – keine Duplikate –, 2 im Umfang erweitert).
- **Ø Note** ist der Mittelwert aller vergebenen Schulnoten der vier Blöcke (Iteration 2: 26 Noten, genau 2,13; Iteration 3: 28 Noten, genau 2,07; Iteration 4: 28 Noten, genau 2,02; Iteration 5: 27 Noten, genau 1,83 – Block C hat „Mobil“ nicht bewertet).
- **umgesetzt** zählt die zur Umsetzung beschlossenen Befunde, deren Änderung belegt ist – durch die Abnahme im Browser, automatische Tests, axe-core oder die Selbstprüfung der Fixer (welche Art, steht je Befund im Bericht). „Teilweise“ und „verworfen“ stehen getrennt; Einzelnachweise im Abschnitt „Umsetzung & Nachweis“ des jeweiligen Berichts. Ob ein Befund für die Persona wirklich behoben ist, entscheidet erst der Nachtest der folgenden Iteration.
- **Iteration 4** ist getestet, ausgewertet und umgesetzt. Der K-Befund und alle 3 H-Befunde sind in der Abnahme im Browser nachgestellt, mit Bild; offen bleibt nur die Kontoangabe für die Elbtal-Zahlung in 131/26 ohne Kontoumsatz (Vorgabe der Projektleitung zu den Demodaten). Einzelnachweise im [Abschnitt 11](iteration-4.md#11-umsetzung--nachweis).
- **Iteration 5** ist als Abnahme getestet, ausgewertet und umgesetzt. Der K-Befund I5-T03-01 und alle 7 M-Befunde sind in der Prüfung im Browser nachgestellt, mit Bild; damit sind die drei Produktbedingungen der Blöcke A, B und C (I5-T03-01, I5-T07-01, I5-T13-01) umgesetzt. In der Prüfung nachgezogen: ROI-Rechner „laut Angebot“, Rechnungs-Briefkopf, Schnellhilfe zu U, „Zugang entfernen“ nur mit Übertragung (Oberfläche, Demo-Backend, Server) und der Personenfilter der Fristenliste. Einzelnachweise im [Abschnitt 12](iteration-5.md#12-umsetzung--nachweis). **Abnahmeziel beim Test: 4 von 9 Punkten erfüllt** (24 Aufgaben ohne Hilfe, Prüfwerte exakt, axe 0/0, SUS ≥ 80), **2 teilweise** (UEQ-S hedonisch +1,44; Einzelnote Vertrauen 2,5 in Block B), **3 nicht erfüllt** (der K-Befund I5-T03-01 – inzwischen umgesetzt; Vertrauen und Fachlich nicht bei 1; Kaufbedingungen noch nicht nur Vertrag und Preis). Kauf heute 4 × „unter Bedingungen“, Empfehlung 8 / 10 in jedem Block. Offen sind nur noch die Entscheidungen des Auftraggebers ([Abschnitt 4.6](iteration-5.md#46-offene-entscheidungen-des-auftraggebers)). Empfohlen ist ein kurzer Abnahme-Nachtest (T03, T07, T13 und die M-Befunde), danach Kauf, Noten, UEQ-S und SUS neu erheben.

## Gesamtfazit über alle fünf Iterationen

**Weitere Kennzahlen im Verlauf** (Trendwerte einer simulierten Person, Quelle: Abschnitt 3 des [Berichts zu Iteration 5](iteration-5.md#3-vergleich-zur-vorrunde)):

| Kennzahl | Iteration 1 | Iteration 2 | Iteration 3 | Iteration 4 | Iteration 5 | Ziel |
|---|---|---|---|---|---|---|
| Fehlaktionen | 25 | 12 | 11 | 11 | **4** | – |
| Note Vertrauen | 3,5 | 2,88 | 2,25 | 2,25 | **1,63** | 1 |
| Note Fachliche Korrektheit | 2,75 | 1,88 | 1,50 | 1,38 | **1,25** | 1 |
| Empfehlung (0–10) | 5,5 | 7,0 | 7,75 | 7,75 | **8,0** | – |
| Kauf heute | 0 × ja | 4 × unter Bed. | 4 × unter Bed. | 4 × unter Bed. | **4 × unter Bed.** | nur Vertrag und Preis |
| axe-core serious / critical | 14 / 6 in 49 | 0 / 0 in 51 | 3 / 0 in 56 | 1 / 0 in 84 | **0 / 0 in 72** | 0 / 0 |
| Nachtest der Vorrunde behoben | – | 124 / 141 (88 %) | 99 / 104 (95 %) | 65 / 69 (94 %) | **54 / 58 (93 %)** | – |

1. **Das Ziel bei den Kernwerten ist erreicht.** Von der Baseline bis zur Abnahme stiegen die Aufgaben ohne Umweg von 6 auf **24 von 24**, der SUS von 65,6 auf **80,6** und die Empfehlung von 5,5 auf **8,0**. Das Schulnoten-Mittel fiel von 2,6 auf **1,83**, die Fehlaktionen von 25 auf **4**, die axe-Verstöße von 20 auf **0**. Der SUS stieg in jeder Runde; nur Lesbarkeit und Tempo gaben in Iteration 4 leicht nach – genau die Dimensionen, die diese Runde gezielt belastet hat.
2. **Die Befunde sind abgearbeitet.** Nach dem Zusammenführen gab es 364 Befunde. 363 wurden zur Umsetzung beschlossen, **362 sind umgesetzt**, einer ist teilweise umgesetzt (I1-T00-02, Impressum – wartet auf die Anbieterdaten des Auftraggebers), einer ist verworfen (Testumgebung). Die Runden brachten immer weniger und leichtere Befunde: 133 → 88 → 59 → 52 → 32, die H-Befunde fielen von 42 auf 0. Der Nachtest bestätigte je Runde 88–95 % der Vorrunden-IDs als behoben, ab Iteration 4 ohne einen einzigen „nicht behoben“.
3. **Der Fachkern war von Anfang an exakt, die Risiken lagen in den Übergängen.** Fristen, RVG und Zinsen stimmten schon in Iteration 1 auf den Tag bzw. Cent. Die acht K-Befunde der Studie betrafen Erkennung, Übergänge und Rollen – eEB durch die ReFa, ein Testzugang per Klick, eine von der KI überlesene Ausschlussfrist, zweimal das Zeithonorar zum vereinbarten Satz, eine Fehlzuordnung ins fremde Mandantenportal, die Kollisionsprüfung über eine Dublette und die Fristkorrektur gegen das eEB-Datum –, keiner den Fristen-, RVG- oder Zinsrechenkern.
4. **Vertrauen war der Engpass und ist der größte Gewinn.** Die Note stieg von 3,5 auf 1,63. Getragen haben das ehrliche Kennzeichnung („simuliert“, „Beispielwerte“), Freigabe vor jedem Versand, das Protokoll mit Anbieter-Eingriffen, Fremdgeld kontogenau und neutrale statt erfundener Zusagen.
5. **Stand nach der Umsetzung von Iteration 5:** Produktseitig ist kein Punkt des Abnahmeziels mehr offen ([Abschnitt 4.1](iteration-5.md#41-abgleich-mit-dem-abnahmeziel-kundenavatar-112)). UEQ-S, Noten und SUS sind nach der Umsetzung **nicht neu gemessen**. Der UEQ-S hedonisch (+1,44) und die Noten Vertrauen und Fachlich (noch nicht bei 1) bleiben bis zum Nachtest offen. Kauf und Abnahme hängen danach nur noch an den [Entscheidungen des Auftraggebers](iteration-5.md#46-offene-entscheidungen-des-auftraggebers): Preis, Wartung, Übertragbarkeit, Escrow, EU-Verarbeitung der Live-KI, Impressum, Festpreis für den Umzug.

**Empfehlung:** einen kurzen Abnahme-Nachtest fahren (T03, T07, T13 und die M-Befunde, mit fester Seitenuhr; [Abschnitt 11.6](iteration-5.md#116-hinweise-für-den-abnahme-nachtest-testleitung)), danach Kauf, Noten, UEQ-S und SUS neu erheben – und parallel die Entscheidungen des Auftraggebers einholen.

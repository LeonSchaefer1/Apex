# Usability-Studie AnwaltApex – Kundenavatar Claudia Reinholz

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

**Hinweise zur Tabelle:**

- **Aufgaben erfolgreich** zählt die Aufgaben, die ohne Umweg und ohne Hilfe erledigt wurden. In Klammern steht, bei wie vielen Aufgaben das Erfolgskriterium erfüllt war.
- **SUS** ist der Mittelwert der vier Testblöcke (Trendwert).
- **Befunde** sind nach dem Zusammenführen von Duplikaten gezählt (Iteration 1: 141 roh, 133 zusammengeführt).
- **umgesetzt** zählt die zur Umsetzung beschlossenen Befunde, deren Änderung belegt ist – durch die Abnahme im Browser, automatische Tests, axe-core oder die Selbstprüfung der Fixer (welche Art, steht je Befund im Bericht). „Teilweise“ und „verworfen“ stehen getrennt; Einzelnachweise im Abschnitt „Umsetzung & Nachweis“ des jeweiligen Berichts. Ob ein Befund für die Persona wirklich behoben ist, entscheidet erst der Nachtest der folgenden Iteration.

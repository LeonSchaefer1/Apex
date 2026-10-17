## Iteration 5 – Feedback Claudia Reinholz · Block A (Erstkontakt, Verwaltung, Hilfe & 38h-Motor)

**Datum:** Sa, 17.10.2026, ca. 09:22–09:50 Uhr Ortszeit (Systemuhr 07:22–07:50 UTC) · **Betriebsmodus:** Browser-Demo („Demo-Modus: Ihre Änderungen bleiben in diesem Browser gespeichert“, Demo-KI offline) · **Browser:** Chromium (Playwright, `de-DE`, Europe/Berlin; Datumsfelder im US-Format → Testumgebung, kein Befund) · **Testleitung:** Avatar-Werkzeug, frisches Profil `i5-A`

**Schwerpunkt Iteration 5:** Abnahme und Kaufentscheidung. Viewports wie je Aufgabe vorgegeben, **hell**: T00 D + M · T21 D · T16 L · T18-3b D · T10 L · T12 L · T13 D. Für den Nachtest zusätzlich: Landing dunkel (D) und Reflow 320 px dunkel, Console dunkel, gesperrter Knopf im Fristenrechner dunkel, Wiki mit „Bewegung reduzieren“, Darstellung 125 % + Kompakt + Dunkel (als Teil von T13). axe-core je Ansicht.

**Uhrzeit:** Samstagvormittag, also außerhalb der Servicezeit (Mo–Fr 7:30–19:00 Uhr). Die Werktagssituation von T12 (16:50 Uhr) lässt sich mit dem Werkzeug weiter nicht einstellen; geprüft habe ich das Verhalten außerhalb der Servicezeit.

---

### Nachtest Vorrunde (Befunde meiner Aufgaben)

| ID | S | Status | Was ich gesehen habe |
|---|---|---|---|
| I4-T00-01 | M | **behoben** | Reflow 320×640 dunkel: Rechnerkarte „Ihre Ersparnis“ liegt vollständig im Bild („38 Std.“, „19,74 €“, Skala 5–120, Erklärzeile, Regler). Einziges Element über dem Rand ist ein dekoratives Glühen ohne Inhalt; kein Querscrollen. |
| I4-T00-02 | M | **behoben** | D dunkel: Abschlusskarte „Eine Kanzlei-Software, die Ihnen gehört.“ ist eine dunkle Fläche mit feinem Rand. Nichts blendet. |
| I4-T00-03 | N | **behoben** | Fußnoten ¹ ² ³ als Liste, je Zeile rund 60 Zeichen, gut lesbar (D hell). |
| I4-T16-01 | M | **behoben** | Kanzleiprotokoll: Anbieter-Eingriff steht über drei Zeilen mit „Mehr anzeigen“, Urheber **„AnwaltApex – Lena Vogt (Apex Console)“**, eigener Filter **„Anbieter“**. Darin vollständig: Zugang angelegt, Startpasswort vergeben, beide Neuvergaben mit Anforderer und Anlass. |
| I3-T21-02 | M | **behoben** | (Rest war I4-T16-01) – siehe oben. |
| I4-T21-01 | N | **behoben** | Console dunkel: Einladungstext auf dunkler Fläche, kein heller Block. |
| I4-T21-02 | N | **behoben** | Keine Meldung über dem Dialog; „✓ Kopiert“ direkt am Knopf. E-Mail bricht um („claudia.reinholz+i5@reinholz-“ / „hollmann.example“) statt gekürzt zu werden. |
| I4-T21-03 | N | **behoben** | Knöpfe heißen „Neues Passwort für ‹Name› erzeugen“, „Einladung für ‹Name› kopieren“, „Demo-Passwort für ‹Name› wiederherstellen“. |
| I4-T13-01 | N | **behoben** | 125 % + Kompakt + Dunkel, Einstellungen → Darstellung gescrollt: Kugel liegt auf freier Fläche, kein Text darunter (Stichprobe in einer Scrolllage). |
| I4-T18-01 | N | **behoben** | Gesperrter Knopf „Als Frist in Akte eintragen“: dunkel transparent, Rand und Schrift grau, Zeiger „nicht erlaubt“, Grund darunter („Erst die Fristart wählen und eine Akte wählen“ bzw. „Erst eine Akte wählen“). |
| I4-T10-01 | M | **behoben** | Automatik-Beschreibungen ungekürzt, größer und dunkler; „versendet nach Ihrer Freigabe“ und „mit Eskalation an die Vertretung“ sind zu lesen (L hell). |
| I4-T12-01 | M | **behoben** | Wiki „beA-Störung – was tun?“ mit „Bewegung reduzieren“: nach 11 s weiter „Schritt 1 von 4“, Knopf „Abspielen“, → blättert weiter. Ohne Einstellung läuft es und hat „Anhalten“. |
| I4-T12-02 | N | **behoben** | Notfallantwort am Samstag: „Ihre feste Ansprechpartnerin Lena Vogt ist jetzt nicht erreichbar (wieder Mo, 19.10.2026 ab 7:30 Uhr) – warten Sie nicht, reichen Sie jetzt ersatzweise ein.“ |
| I1-T00-02 | H | **teilweise** | Impressum weiter ein gekennzeichneter Platzhalter („Die Anbieterkennzeichnung (§ 5 DDG) ist in diesem Prototyp noch nicht hinterlegt“). Entscheidung des Auftraggebers. |
| I3-T21-01 | N | **nicht prüfbar** | „seit 17.10.2026“ stimmt; die Anlage zwischen 0 und 2 Uhr lässt sich mit dem Werkzeug weiter nicht nachstellen (keine feste Uhr). |

**Zusätzlich gesehen:** I4-T03-03 (Meldungsteil der Console) – keine Meldung über Dialogen → behoben. I4-T18-03 – der Fristenrechner öffnet ohne vorgewählte Fristart („Bitte die Fristart wählen“) → behoben.

**Ergebnis Nachtest:** 15 IDs geprüft · **13 behoben · 1 teilweise** (I1-T00-02, Auftraggeber) · **1 nicht prüfbar** (I3-T21-01) · **0 nicht behoben**.

---

### Aufgaben

| Aufgabe | Ergebnis | Erfolgskriterium (Messwert) | Prüfpunkte x/y | Aktionen/Soll | Fehlaktionen | fachlich korrekt | SEQ | O-Ton |
|---|---|---|---|---|---|---|---|---|
| T00 Landing (D, M; hell) | erledigt | **erfüllt**: Mein Satz nach 5 s: „Kanzleisoftware für Akten, beA, Fristen und Abrechnung mit KI-Fallanalyse – gekauft statt gemietet.“ Ziele **5 von 5** in je ≤ 2 Aktionen (Preismodell 1 · Datenstandort 1 · Kontakt 1 · Impressum 2 · „Testzugang anfordern“ 1) | 3/3 (+ Anglizismen: 1 – „Lifetime“) | 6 / 10 | 0 | ja (Vorschau: Zustellung Mi 14.10.2026 → rechnerisch Sa 14.11. → **Mo 16.11.2026**, § 222 Abs. 2 ZPO; Vorfrist Mo 09.11.; Fußnote ²: 38 × 48 × 19,74 € = 36.005,76 € ≈ 36.000 €; mit 26,04 € = 47.497 € ≈ 47.500 €) | 7 | „Nach fünf Sekunden weiß ich, was das ist, und jede Zahl hat eine lesbare Fußnote. Was die Wartung kostet, steht nirgends – das will ich schwarz auf weiß.“ |
| T21 Apex Console (als Lena Vogt, D) | erledigt | **erfüllt mit Vorbehalt**: Zugang angelegt, „Neues Startpasswort erzeugen“ mit Anforderer und Anlass ausgeführt, Einladung und Passwort getrennt kopiert, Kopieren je am Knopf bestätigt. **19** Pflichtaktionen ohne Anmeldung (Soll 18; +1 freiwillige Anrede = 20, +3 Anmeldung = 23). Die Überschreitung kommt aus den zwei Pflichtangaben zur Neuvergabe – die will ich. Alle Fehlermeldungen nennen Ursache und nächsten Schritt. | 5/5 | 19 / 18 | 0 | ja (Testende 16.11.2026 = 17.10. + 30 Tage, „noch 30 Tage“; NRW aus „Paderborn“ mit „Aus der Stadt übernommen“) | 6 | „Frau Vogt muss sagen, wer das Passwort wollte und warum, und ihr eigener Name ist schon eingetragen. So soll das sein. Eine Aktion mehr als vorgesehen nehme ich dafür gern.“ |
| T16 Erste Anmeldung eigener Zugang (L) | erledigt | **erfüllt**: Einladung → Cockpit in **6 / 8** Aktionen. Fehlermeldungen **3 von 3** mit Ursache und nächstem Schritt („Das neue Passwort ist zu kurz (5 von mindestens 10 Zeichen). Bitte verlängern Sie es – z. B. mit einem weiteren Wort.“ · „Die beiden Eingaben stimmen nicht überein. Bitte geben Sie das neue Passwort in beiden Feldern gleich ein.“ · „E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie Schreibweise sowie Groß- und Kleinschreibung – oder lassen Sie über ‚Passwort vergessen?‘ ein neues Startpasswort vergeben.“) | 6/6 | 6 / 8 (+ 5 für die provozierten Fehler) | 0 | ja (Gerichte der ersten 10 Akten: ArbG Paderborn ×4, AG Paderborn ×2, viermal „noch kein Verfahren“ → **0 falsche**; Lizenz „Testzugang bis 16.11.2026“; Bußgeld-Einspruch § 67 Abs. 1 OWiG bis Di 20.10., „Tag 11 von 14“, „noch 3 Tage“; Anhörungstermin AG Paderborn – Familiengericht) | 7 | „Anmelden, eigenes Passwort, drei Fehlermeldungen, die mir sagen, was ich tun soll. Und im Protokoll steht jetzt vollständig, dass Frau Vogt zweimal ein Passwort vergeben hat – auf wessen Wunsch und warum.“ |
| T18 Fall 3b (NRW-Kanzlei, Hess. LAG, D) | erledigt | **erfüllt**: **Mo 01.11.2027**. Rechenweg Schritt 5: „01.11.2027 Allerheiligen – in Nordrhein-Westfalen Feiertag, in Hessen (Gerichtsort) nicht – keine Verschiebung“; Bundesland „Hessen – aus dem Gericht abgeleitet“, gesperrt. | 2/2 | 6 / – | 0 | **ja** (Fr 01.10.2027 + 1 Monat, § 187 Abs. 1, § 188 Abs. 2 BGB = Mo 01.11.2027; Vorfrist Mo 25.10.2027; „in 380 Tagen“ ab 17.10.2026 stimmt; Notfrist § 64 Abs. 6 ArbGG i. V. m. § 517 ZPO, § 224 Abs. 2 ZPO; Hinweis § 66 Abs. 1 S. 2 ArbGG; Wiedereinsetzung §§ 233, 234 ZPO) | 7 | „Allerheiligen beim Namen, Hessen als Gerichtsort, kein Tag Verlängerung. Genau das will ich sehen, bevor ich eine Frist unterschreibe.“ |
| T10 38h-Motor verstehen (L) | erledigt | **erfüllt**: eigene Zahl **20,2 Std./Woche** (20,22) aus 11 Automatiken (Mandanten-Update = 0), Minuten je Vorgang aus der Oberfläche × meine Mengen → **25.273,38 €/Jahr** zu 26,04 €/Std.; 2 Std. Anwaltszeit × 48 × 240 € = 23.040 € | 6/6 | 19 / – | 0 | ja (1.213 Min. = 20,22 Std.; × 48 = 970,56 Std.; × 26,04 € = 25.273,38 €; 50.000 € ÷ 1.920 Std. = 26,04 €; Kopf: 28,2 ÷ 38 = 74 %, 28,20 × 26,04 € = 734,33 €, × 48 = 35.247,74 €; Demo-Mengen ergeben 483 Vorgänge und 1.692 Min. = 28,2 Std. – Kopf und Rechner stimmen überein) | 6 | „Bei uns sind es zwanzig Stunden, nicht achtunddreißig – und das Ding rechnet es mir offen vor. Nur: Warum sind auf derselben Seite 28 Stunden 35.000 € wert und 38 Stunden 36.000 €? Das fragt Hollmann als Erstes.“ |
| T12 Störung, Hilfe, Ansprechpartnerin (L) | erledigt | **erfüllt**: LAG → **§ 46g S. 3, 4 ArbGG**, OLG → **§ 130d S. 2, 3 ZPO**; Lena Vogt mit Durchwahl und „Rückruf anfordern“ in **1 Aktion** (Hilfe & Support) bzw. direkt in der Antwort des Assistenten | 6/6 | 10 / – | 0 | **ja** (Ersatzeinreichung nach den allgemeinen Vorschriften – Telefax, Papier, Bote; Glaubhaftmachung bei der Ersatzeinreichung oder unverzüglich danach, mit anwaltlicher Versicherung; Dokumentation mit Screenshot und BRAK-Störungsmeldung; Frist erst nach Sendebericht erledigt; § 55d VwGO, § 65d SGG, § 52d FGO, § 32d StPO) | 6 | „Richtige Norm, richtiger Rat, und am Samstag steht ehrlich da, dass Frau Vogt nicht da ist und ich nicht warten soll. Mehr kann ein Programm hier nicht tun.“ |
| T13 Einstellungen, Team, Lizenz, Datenschutz (D) | erledigt | **erfüllt: 7 von 7** in ≤ 3 Aktionen | 9/12 | 17 / 21 | 0 | ja (Rollenfolgen „kein eEB, keine Lizenz- und Teamdaten … Fristverantwortung nur Partner und Anwälte“; § 43e BRAO, Art. 28 DSGVO, § 50 BRAO; § 43e Abs. 4 BRAO bei der Live-KI in den USA) | 6 | „Sieben von sieben, Katrin Wiese ist in drei Klicks angelegt. Aber hier steht ‚das erste Wartungsjahr ist enthalten‘, auf der Website und in meinem Testzugang ‚Preis auf Anfrage‘. Was gilt denn nun?“ |

**Prüfpunkte im Einzelnen**

- **T00:** Zahlenaussagen gekennzeichnet – ja („Ø 38 Std.“ ¹ Zielwert, kein garantiertes Ergebnis; „≈ 36.000 €“ ² mit Rechenweg; „0 €“ erklärt; „Sekunden“ ³ messbar im Produkt) · Vergleich sachlich, ohne Wettbewerbernamen, mit Vermerk „Vergleiche beziehen sich auf klassische Kanzleisoftware im Allgemeinen“ – ja · M (390×844): kein Querscrollen, Botschaft, „Demo starten“ und „Testzugang anfordern“ im ersten Bildschirm – ja · Anglizismen: 1 („Lifetime“; „Demo“ zähle ich nicht). Preismodell: einmalig, „Wartung optional, Umfang und Preis regelt das Angebot“, „Preis auf Anfrage“ – die Frage „Was kostet die Wartung?“ beantwortet die Seite nicht (Auftraggeber).
- **T21:** NRW aus „Paderborn“ mit Hinweis – ja · Einladung 4 von 4 (Anmeldeadresse, E-Mail, Lena Vogt mit Durchwahl, Testende 16.11.2026), Kopieren bestätigt – ja · „Neues Passwort“ erklärt Protokoll und Pflicht zum Wechsel, das bisherige Passwort wird sofort ungültig – ja · **K-Probe Datenschutz:** Die Kundenkarte zeigt Kanzleiname, Ort, Lizenz, Plätze, Schwerpunkte, Nutzer mit E-Mail und Zahlen (nach meiner Anmeldung: 34 Akten, 46 Fristen offen, 8 Nachrichten) – keine Mandanten- oder Gegnernamen, keine Akteninhalte (Gegenprobe auf „Keller“, „Kowalski“, „Braun“, „Urteil“ u. a.: 0 Treffer) – **bestanden** · meine zwei Sätze – ja: „Der Anbieter sieht, wer bei uns einen Zugang hat und wie viele Akten und Fristen wir haben, aber keinen Inhalt. Ein neues Passwort vergibt er nur mit Namen des Anfordernden und Anlass, und das steht vollständig in unserem Protokoll.“
- **T16:** Einfügen und Passwort-Manager möglich (`autocomplete` username / current-password / new-password, Einfügen nicht blockiert) – ja · MFA angeboten (Einstellungen → Datenschutz → „Anmeldung & Sicherheit“: Zwei-Faktor mit Authenticator-App, Sperre nach 15 Min.) – ja · Lizenz „Testzugang bis 16.11.2026“ – ja · Anbieter-Passwort im Protokoll – ja, vollständig · falsche Gerichtsorte – 0 · Abmelden in 2 Aktionen (Benutzermenü → Abmelden), Browser-Zurück zeigt nur die Anmeldung – ja.
- **T18-3b:** Gerichtsort wählbar und im Ergebnis genannt („Feiertage: Hessen (Gerichtsort: Hessisches LAG)“) – ja · Feiertag beim Namen – ja (Allerheiligen).
- **T10:** In 3 Sätzen erklärbar – ja: „Der Motor liest Post, ordnet sie zu, schlägt Fristen vor und bereitet Schreiben vor. Fristen gehen in die Vier-Augen-Kontrolle, alles, was die Kanzlei verlässt, erst nach unserer Freigabe; das eEB gibt nur ein Anwalt ab. Von allein bucht er nur eindeutige Bankumsätze ab 90 % und setzt interne Vorfristen.“ · Demowerte gekennzeichnet (Banner „Demo-Daten … Alle Werte hier sind simuliert“, „Beispielwerte“, „Zuletzt erledigt (simuliert)“) – ja · Was/Wann/Freigabe bei **12 von 12** Automatiken · Rechner übernimmt meine Zahlen und speichert sie („Gespeichert am 17.10.2026 – nur in diesem Browser“; nach Neustart des Browsers noch da) – ja · Abschalten in 1 Aktion mit sichtbarem Zustand („Pausiert – ruht, bis Sie sie einschalten“); die fristrelevante Automatik fragt vorher mit Folgen nach – ja · 38 Std. ≈ 36.000 € nachvollziehbar („interner Richtwert 19,74 €/Std.“, 48 Wochen; meine Gegenrechnung mit 52 Wochen ergibt ≈ 18,22 €/Std.) – ja, aber zwei Kostensätze auf einer Seite (I5-T10-01).

  Meine Mengen pro Woche (A): eEB 15 × 5 · Fristen 20 × 6 · Zuordnen 120 × 3 · Vorfristen 30 × 4 · Mandatsaufnahme 9 × 25 · Deckungsanfrage 4 × 15 · Mandanten-Update 0 · Bankabgleich 40 × 3 · Zahlungserinnerung 5 × 7 · Kostenfestsetzung 1 × 20 · Archivierung 8 × 6 · Zeiterfassung 15 × 2 = **1.213 Min. = 20,22 Std.** Zum Vergleich mit dem Werbesatz: 20,22 × 52 × 18 € ≈ 18.900 €.
- **T12:** Systemstatus in ≤ 2 Aktionen (1 über die Kopfleiste; beA, E-Mail, Bank, KI mit Verlauf, „Messwerte im Prototyp simuliert“) – ja · Rat umfasst Dokumentation (Screenshot, BRAK-Störungsmeldung) – ja · verweist nicht nur an den beA-Support – ja · Rückruf binnen 30 Minuten in der Servicezeit sichtbar zugesagt; außerhalb „Rückruf am Mo, 19.10.2026 bis spätestens 8:30 Uhr“ mit Auswahl „Frist läuft heute ab – bitte vorrangig“ – ja · Schnellhilfe öffnet passend („Schnellhilfe: Hilfe & Support“) – ja · Wiki-Animation pausierbar („Anhalten“) – ja.
- **T13:** Folgen erklärt (Rollentext im Dialog „Person einladen“) – ja · Darstellung wirkt sofort (125 %, Kompakt, Dunkel ohne Neuladen) – ja · KI-Anbieter, Ort und Trainingsverbot im Klartext – ja · Übereinstimmung mit „EU-Verarbeitung“ aus dem Masterprompt – **nein** (Live-KI Anthropic, USA, „EU auf Anfrage“; bekannt, Entscheidung des Auftraggebers) · Lizenz ohne Wartung (Tabellen, Basiszins, Feiertage selbst; beA-Anbindung kann ausfallen) – ja · übertragbar – **nein** („im Angebot geregelt“) · Escrow – **nein** („auf Anfrage“) · MFA – ja · Sperre bei Inaktivität – ja · Bundesland änderbar und erklärt (Voreinstellung, maßgeblich Gerichtsort) – ja · Unterauftragnehmer – ja · Löschkonzept – ja. Rechte der Auszubildenden: Die Rechtetabelle zeigt schon als Standard kein Fremdgeld, keine Lizenz- und keine Teamdaten (Haken und Strich). Einzeln anpassen lässt sich das nicht – für Lea reicht der Standard.

---

### Befunde

| ID | S | Kategorie | Ansicht · Viewport · Modus | Beobachtung → Erwartung → Vorschlag | Datei (Zuordnung nach dem Test) | Bild |
|---|---|---|---|---|---|---|
| **I5-T13-01** | **M** | Vertrauen | Einstellungen → Lizenz (Präsentationszugang Hartmann & Partner) · D · hell | **Schritte:** Als Julia Hartmann anmelden → Einstellungen → Lizenz. **Beobachtung:** Unter „Ihre Lizenz“ steht „Die Wartung ist optional; **das erste Jahr ist enthalten**.“ Die Landing sagt „Wartung optional, Umfang und Preis regelt das Angebot“, der Lizenz-Tab meines Testzugangs „Laufende Kosten entstehen nur mit der optionalen Wartung. Preis auf Anfrage – verbindlich im Angebot.“ Ein enthaltenes Wartungsjahr steht nur hier. **Erwartung:** Eine Preisaussage ist überall gleich – oder erkennbar die Vereinbarung genau dieser Kanzlei. Hollmann rechnet die fünf Jahre damit durch. **Vorschlag:** Den Satz kanzleibezogen formulieren („laut Ihrem Vertrag vom 02.03.2026: erstes Wartungsjahr enthalten“) oder wie überall neutral („Wartung optional – Umfang und Preis laut Angebot“). | `src/pages/einstellungen/LizenzTab.tsx:55` | – |
| **I5-T10-01** | **M** | Verständlichkeit | 38h-Motor → Kopf und „Ersparnis-Rechner“ · L · hell | **Beobachtung:** Auf derselben Seite stehen zwei Kostensätze für dieselbe Rechnung. Im Kopf: „28,2 Std. … Hochgerechnet pro Jahr ≈ 35.000 € (28,20 Std. × 48 × 26,04 €/Std.)“. Unter dem Rechner: „Zielwert des 38h-Motors: Ø 38 Std. pro Woche ≈ 36.000 € pro Jahr (interner Richtwert 19,74 €/Std.)“. Wer nur die Euro liest, sieht: 28 Stunden sind 35.000 € wert, 38 Stunden 36.000 €. Beide Zahlen haben einen Rechenweg, aber der Widerspruch springt ins Auge. Die Landing löst das schon (Fußnote ²: „mit ReFa-Vollkosten von ca. 26 €/Std. wären es ≈ 47.500 €“). **Erwartung:** Ein Kostensatz je Rechnung, oder der Zielwert steht auch zum eingestellten Kostensatz daneben. **Vorschlag:** Unter dem Rechner ergänzen: „zu Ihrem Kostensatz von 26,04 €/Std. wären 38 Std. ≈ 47.500 € (38 × 48 × 26,04 € = 47.497 €)“ – wie in Fußnote ² der Landing. | `src/pages/motor/RoiRechner.tsx:295`; `src/pages/motor/Motor.tsx` (Kachel „Hochgerechnet pro Jahr“) | [Bild](bilder/block-A-T10-rechner-eigene-werte-zwei-kostensaetze-L-hell.jpg) |
| I5-T10-02 | N | Verständlichkeit | 38h-Motor → „Zuletzt erledigt (simuliert)“ · L (1366×768) · hell | **Beobachtung:** Die Unterzeile jedes Eintrags ist gekürzt: „vor 15 Std. · Posteingang den …“ (7 von 7 Zeilen, kein Tooltip). Der Name der Automatik ist nicht zu lesen. **Erwartung:** Nichts kürzen, was eine Aussage trägt. **Vorschlag:** Unterzeile umbrechen (zwei Zeilen) oder Zeitangabe und Automatik in zwei Zeilen setzen. | `src/pages/motor/LiveFeed.tsx:74` (`truncate`) | – |
| I5-T10-03 | N | Barrierefreiheit | 38h-Motor → Schalter der Automatiken · L | **Beobachtung:** Der zugängliche Name des Schalters wechselt mit dem Zustand („Fristen aus Posteingang erkennen **pausieren**“ bei an, „… **aktivieren**“ bei aus), und `aria-checked` meldet den Zustand zusätzlich. Ein Screenreader liest „… pausieren, Schalter, ein“ – das kann man als „Pausieren ist eingeschaltet“ verstehen. **Erwartung:** Bei Schaltern trägt der Name die Sache, der Zustand kommt aus `aria-checked`. **Vorschlag:** Fester Name, z. B. „Automatik ‚Fristen aus Posteingang erkennen‘“, Zustand nur über `aria-checked`; gleich im Detail-Schalter („Automatik pausieren/aktivieren“). | `src/pages/motor/AutomationKarte.tsx:174`, `:295` | – |
| I5-T16-01 | N | Look & Feel | Einstellungen → Kanzlei → „Vorschau Briefkopf“ (eigener Testzugang) · D · hell | **Beobachtung:** Die Vorschau kürzt den Kanzleinamen auf „Reinholz & Hollmann Rechtsanw…“ und zeigt nur 3 der 5 Schwerpunkte („Arbeitsrecht · Verkehrsrecht · Mietrecht“; Familienrecht und Forderungseinzug fehlen), ohne Hinweis. **Erwartung:** Was ich in der Vorschau sehe, ist das, was auf dem Briefkopf steht. **Vorschlag:** Namen umbrechen statt kürzen; wenn der Briefkopf höchstens drei Schwerpunkte führt, das dazuschreiben („im Briefkopf die ersten drei“). | `src/pages/einstellungen/KanzleiTab.tsx:192–193` (`truncate`, `slice(0, 3)`) | – |
| I5-T12-01 | N | Fachlich | Apex Assistent → Notfallantwort beA-Störung, LAG · L · hell | **Beobachtung:** Die Antwort zur Berufungsbegründung beim LAG ist richtig (§ 46g S. 3, 4 ArbGG), erwähnt aber nicht, dass sich gerade die **Begründungsfrist** einmal auf Antrag verlängern lässt (§ 66 Abs. 1 S. 5 ArbGG (F); beim OLG § 520 Abs. 2 S. 2, 3 ZPO) – auch dieser Antrag ginge ersatzweise per Fax hinaus. **Erwartung:** Bei „Begründung muss heute raus“ gehört die Verlängerung als zweiter Weg dazu – nicht statt der Ersatzeinreichung. **Vorschlag:** Bei Begründungsfristen eine Zeile ergänzen: „Ist die Begründung nicht fertig: Verlängerungsantrag vor Fristablauf, ebenfalls ersatzweise einreichen (§ 66 Abs. 1 S. 5 ArbGG bzw. § 520 Abs. 2 S. 2, 3 ZPO).“ | `src/ai/assistent.ts` (Notfallwissen beA-Störung, um Z. 934) | [Bild](bilder/block-A-T12-notfall-ansprechpartnerin-servicezeit-L-hell.jpg) |
| I5-T21-01 | N | Verständlichkeit | Apex Console → Kachel „Kanzleien“ · D · hell | **Beobachtung:** Nach dem Anlegen steht „Kanzleien **4** · 3 aktiv · 0 pausiert“. Die vierte (mein Testzugang) taucht in der Unterzeile nicht auf; man rechnet 3 + 0 und sucht die vierte. **Erwartung:** Die Unterzeile geht in der Summe auf. **Vorschlag:** „3 aktiv · 1 im Test · 0 pausiert“. | `src/pages/console/Console.tsx:184` | – |
| I5-T00-01 | N | Barrierefreiheit | Landing → Fußnote ² · D · hell | **Beobachtung:** „… mit ReFa-Vollkosten von ca. 26“ steht am Zeilenende, „€/Std. wären es ≈ 47.500 €“ in der nächsten Zeile. Zahl und Einheit getrennt – ich lese Beträge Ziffer für Ziffer. **Erwartung:** Zahl und Einheit bleiben zusammen. **Vorschlag:** Geschütztes Leerzeichen zwischen Zahl und Einheit (auch bei „19,74 €“, „38 Std.“). | `src/pages/public/landing/Hero.tsx:76` (Fußnote ²; gleicher Satz in `Motor.tsx:169`) | – |

**Summe neue Befunde:** 0 K · 0 H · 2 M · 6 N.

---

### axe-core (WCAG 2.2 A/AA, Stufen serious/critical)

| Ansicht · Viewport · Modus | serious | critical |
|---|---|---|
| Landing, Dialog „Testzugang anfordern“ · D · hell | 0 | 0 |
| Landing · M · hell | 0 | 0 |
| Landing · Reflow 320 · dunkel | 0 | 0 |
| Landing (Abschlusskarte) · D · dunkel | 0 | 0 |
| Apex Console, Übersicht · D · hell | 0 | 0 |
| Apex Console, Formular „Neuen Testzugang anlegen“ / „Testzugang ist bereit“ · D · hell | 0 | 0 |
| Apex Console, „Neues Startpasswort erzeugt“ · D · dunkel | 0 | 0 |
| Anmeldung (`/login`) · D · hell | 0 | 0 |
| Fristenrechner mit Ergebnis Fall 3b · D · hell | 0 | 0 |
| Cockpit · D · hell | 0 | 0 |
| Akten · D · hell | 0 | 0 |
| Einstellungen → Kanzlei, Team & Zugänge, Lizenz, KI, Darstellung, Datenschutz · D · hell | 0 | 0 |
| Einstellungen → Lizenz · L · dunkel | 0 | 0 |
| 38h-Motor (nach Abschalten) · L · hell | 0 | 0 |
| 38h-Motor oben und gescrollt (Rechner) · L · dunkel | 0 | 0 |
| Hilfe & Support (mit Systemstatus) · L · hell | 0 | 0 |
| Hilfe & Support · L · dunkel | 0 | 0 |
| Schnellhilfe offen · L · hell | 0 | 0 |
| Fristen · L · dunkel | 0 | 0 |

axe findet nichts. I5-T10-03 (wechselnder Schaltername) erkennt axe nicht.

---

### Fragebögen (Gesamtsystem nach Block A)

**SUS:** 4 · 2 · 4 · 1 · 5 · 2 · 4 · 2 · 5 · 2 = **82,5** (Trendwert; Iteration 4 Block A: 80,0). Aussage 9 steigt auf „5“: Der Anbieter-Eingriff steht jetzt vollständig und richtig zugeordnet in unserem Protokoll – das war meine letzte Sorge bei der Sicherheit. Aussage 6 bleibt bei „2“: zwei Kostensätze im 38h-Motor, zwei Aussagen zur Wartung.

**UEQ-S:** pragmatisch **+1,75** (unterstützend +2, einfach +1, effizient +2, übersichtlich +2) · hedonisch **+1,5** (spannend +1, interessant +2, originell +1, neuartig +2)

| Dimension | Note | Begründung |
|---|---|---|
| Look & Feel | 2 | Hell wie dunkel ruhig und seriös, keine blendenden Flächen mehr. Kleinigkeit: Briefkopf-Vorschau gekürzt. |
| Lesbarkeit | 2 | Protokoll, Automatik-Beschreibungen und Fußnoten jetzt ganz lesbar; 125 % ohne Verluste. Gekürzt bleibt nur die Unterzeile „Zuletzt erledigt“. |
| Verständlichkeit | 2 | Fehlermeldungen mit Ursache und nächstem Schritt, Rückfragen nennen Folgen. Abzug für die zwei Kostensätze im 38h-Motor. |
| Vertrauen | 2 | Protokoll vorbildlich, Console zeigt keine Inhalte, Demo-Werte überall gekennzeichnet. Offen: Impressum, Wartungspreis, Übertragbarkeit, Escrow, KI in den USA – und eine Wartungsaussage, die nicht zur Website passt. |
| Tempo | 2 | Login in 6, Systemstatus in 1, Fall 3b in 6, sieben Einstellungen in je ≤ 3 Aktionen. Die Console braucht 19 statt 18 – für mehr Sicherheit. |
| Fachliche Korrektheit | 1 | Fall 3b mit Allerheiligen, § 46g und § 130d, Fristvorschau der Landing, alle Rechnungen im 38h-Motor exakt. |
| Mobil | 2 | Landing am iPhone gut, kein Querscrollen, alles Wichtige im ersten Bildschirm; bei 320 px nichts mehr abgeschnitten. Mehr habe ich in diesem Block mobil nicht geprüft. |

**Empfehlung (0–10):** 8

**Kauf heute:** unter Bedingungen, die nur noch Vertrag und Preis betreffen – mit einer Ausnahme im Produkt:

- schriftliches Angebot mit Lizenz- und Wartungspreis für 7 Arbeitsplätze und **einer** Aussage zur Wartung (I5-T13-01);
- Übertragbarkeit der Lizenz und Quellcode-Hinterlegung verbindlich geregelt;
- KI-Verarbeitung in der EU oder eine nach § 43e Abs. 4 BRAO tragfähige Lösung (bis dahin nur Offline-KI);
- echtes Impressum (I1-T00-02).

**Top 3 Verbesserungen:**

1. Eine Wahrheit zu Preis und Wartung: nicht „erstes Jahr enthalten“ an einer Stelle und „Preis auf Anfrage“ an der anderen (I5-T13-01) – und das schriftliche Angebot dazu (Auftraggeber).
2. Ein Kostensatz für die 38-Stunden-Rechnung: auf der Motor-Seite den Zielwert auch zum eingestellten Kostensatz zeigen (I5-T10-01).
3. Impressum und KI-Verarbeitung in der EU klären (I1-T00-02, Auftraggeber) – dazu die Kleinigkeiten: nichts kürzen, was eine Aussage trägt (I5-T10-02, I5-T16-01), Begründungsfrist-Verlängerung in der Notfallantwort (I5-T12-01).

### Preisfragen (Lifetime-Lizenz, 7 Arbeitsplätze, netto)

1. **Zu billig, Zweifel an der Qualität:** unter 5.000 € – „Für gut 700 € je Platz glaube ich nicht an Wartung und eine feste Ansprechpartnerin.“
2. **Günstig, ein gutes Angebot:** rund 12.000 €. Rechenweg: 12.000 € + 2 × 1.800 € Wartung (15 %) + 2 × 1.500 € Betrieb = 18.600 € ≤ 2 × 9.500 € heutige Kosten → amortisiert in 24 Monaten allein über die Softwarekosten.
3. **Teuer, aber noch kaufen:** rund 25.000 € – nur mit Pilotnachweis oder Ratenzahlung. Begründung ist meine eigene Zahl aus T10: 20,22 Std./Woche × 48 × 26,04 € = 25.273 € pro Jahr. Zum Werbesatz (18 €/Std., 52 Wochen) wären es ≈ 18.900 €.
4. **Zu teuer, kein Kauf:** über 35.000 €.
5. **Wartung:** bis 15 % des Lizenzpreises pro Jahr, höchstens rund 2.500 € für 7 Plätze. Enthalten sein müssen: beA-Schnittstelle, RVG-/GKG-Tabellen, halbjährlicher Basiszins, Feiertage und Fristregeln, Sicherheitsupdates, Lena Vogt mit Rückruf binnen 30 Minuten, Update-Zeitpunkt nach meiner Wahl – so wie es der Lizenz-Tab heute als „Enthalten“ aufzählt.

### Empfehlung an Bernd Hollmann (3 Sätze)

Bernd, ich empfehle den Kauf – aber erst mit schriftlichem Angebot: Die Fristen stimmen auf den Tag, mit Feiertag am Gerichtsort und Rechenweg, und der Anbieter kann bei uns nichts tun, ohne dass es mit Namen und Anlass in unserem Protokoll steht. Mit unseren eigenen Mengen spart der Motor rund 20 Stunden pro Woche, zu ReFa-Kosten etwa 25.000 € im Jahr – keine 38 Stunden, aber eine halbe Stelle, und das Programm rechnet es offen vor. Bedingung sind eine Lizenz für 7 Plätze um 15.000 €, Wartungspreis, Übertragbarkeit und Escrow schriftlich, und die KI bleibt offline, bis die Verarbeitung in der EU geregelt ist.

---

### Bilder

| Bild | Was es zeigt |
|---|---|
| [block-A-T16-protokoll-anbietereingriff-vollstaendig-L-hell.jpg](bilder/block-A-T16-protokoll-anbietereingriff-vollstaendig-L-hell.jpg) | **Nachtest I4-T16-01 behoben:** Kanzleiprotokoll im eigenen Testzugang (L, hell). Der Anbieter-Eingriff steht über drei Zeilen mit „Mehr anzeigen“, Urheber „AnwaltApex – Lena Vogt (Apex Console)“, Filter „Alle · Anmeldungen · Anbieter“. |
| [block-A-T18-fall3b-allerheiligen-D-hell.jpg](bilder/block-A-T18-fall3b-allerheiligen-D-hell.jpg) | **T18 Fall 3b:** Rechenweg mit „01.11.2027 Allerheiligen – in Nordrhein-Westfalen Feiertag, in Hessen (Gerichtsort) nicht – keine Verschiebung“; unten rechts der gesperrte Knopf als Umriss mit Grund (I4-T18-01 behoben). |
| [block-A-T10-rechner-eigene-werte-zwei-kostensaetze-L-hell.jpg](bilder/block-A-T10-rechner-eigene-werte-zwei-kostensaetze-L-hell.jpg) | **T10:** meine eigene Zahl 20,22 Std./Woche → 25.273,38 € zu 26,04 €/Std.; darunter der Zielwert „38 Std. ≈ 36.000 € (19,74 €/Std.)“ – zwei Kostensätze auf einer Seite (I5-T10-01). |
| [block-A-T12-notfall-ansprechpartnerin-servicezeit-L-hell.jpg](bilder/block-A-T12-notfall-ansprechpartnerin-servicezeit-L-hell.jpg) | **T12:** Notfallantwort mit § 46g ArbGG / § 130d ZPO und dem ehrlichen Hinweis „Lena Vogt ist jetzt nicht erreichbar … warten Sie nicht“; links die Karte „Ihr direkter Draht“ mit Durchwahl und „Rückruf anfordern“. |

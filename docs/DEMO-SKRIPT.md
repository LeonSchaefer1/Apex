# Apex – Demo-Skript für die Kundenpräsentation (ca. 23–25 Minuten)

**Ziel:** Nach der Präsentation ist klar, warum Apex die richtige Wahl ist: modern und zugleich verlässlich, mit einer KI, die nachvollziehbar arbeitet, mit Fristen, die auf den Tag stimmen, und mit einem fairen Kostenmodell ohne Abo.

**Stand:** Endstand nach fünf Usability-Iterationen (Demodaten `SEED_VERSION` 13, 229 automatische Tests). Alle Bezeichnungen in diesem Skript sind die der App. Die wichtigsten Schritte wurden am 17.10.2026 im Browser gegen die App geprüft.

**Kernbotschaften (für jeden Abschnitt):**

1. *„Die KI erkennt, der geprüfte Fristenrechner berechnet.“*
2. *„Alles nachvollziehbar: Rechenweg, Quelle, Protokoll.“*
3. *„Nichts verlässt die Kanzlei ohne Ihre Freigabe.“*
4. *„Ehrlich gekennzeichnet: Was im Prototyp simuliert ist, steht dran.“*

---

## Inhalt

- [Vorbereitung](#vorbereitung)
- [Zahlen-Logik – so zählt die App](#zahlen-logik--so-zählt-die-app)
- [Ablauf im Überblick](#ablauf-im-überblick)
- [Schritt 1 bis 15](#1--positionierung-1-min--willkommen)
- [Häufige Fragen](#häufige-fragen)
- [Was im Prototyp echt und was simuliert ist](#was-im-prototyp-echt-und-was-simuliert-ist)
- [Hinweise für die Artefakt-Vorschau](#hinweise-für-die-artefakt-vorschau)
- [Wenn etwas hakt](#wenn-etwas-hakt)

---

## Vorbereitung

### Betriebsart wählen

| Betriebsart | Start | Wofür |
|---|---|---|
| **Browser-Demo** (Standard) | `npm run dev` → `http://localhost:5173`, oder die statische Demo aus `npm run build:static` | Präsentations-Laptop, auch ohne Internet. Daten im Browser, Demo-KI offline. |
| **Server** (Docker oder Render) | `docker compose up -d` bzw. Render mit `render.yaml` → Port 8787 | Echte Zugänge, getrennte Kanzleidaten, Kundentestzugänge, optional Live-KI mit Claude. |
| **Artefakt** | `npm run build:artifact` → `dist-artifact/anwaltapex.html` | Eine einzige HTML-Datei für die Vorschau auf claude.ai. Besonderheiten siehe [Artefakt-Hinweise](#hinweise-für-die-artefakt-vorschau). |

### Fünf Minuten vor Beginn

- **Browser:** Chrome oder Edge. Dort funktionieren Spracheingabe und Vorlesen. Ton anschalten.
- **Frische Daten:** Ein frisches Browserprofil verwenden oder unter Einstellungen → Datenschutz & Verträge „Demo-Daten zurücksetzen“ wählen. Den Knopf gibt es nur für Präsentations- und Beispieldaten-Kanzleien.
  - Die Demodaten entstehen jeden Tag neu relativ zu „heute“. Sie hängen nur vom Datum und von der Kanzlei ab: Wer am selben Tag dieselbe Kanzlei öffnet, sieht dieselben Akten, Fristen und Beträge.
  - Änderungen während der Präsentation bleiben bis zum Tagesende erhalten.
- **KI:** Einstellungen → KI-Einstellungen.
  - Mit Claude-Anbindung (Server mit `ANTHROPIC_API_KEY` oder Artefakt nach Freigabe): Live-KI, Anzeige „KI live · Claude“.
  - Ohne Netz oder für eine sichere Vorführung: Schalter „Präsentationsmodus: Demo-KI verwenden“. Die Kopfleiste zeigt dann „Demo-KI (offline)“. Alle Abläufe in diesem Skript funktionieren mit der Demo-KI.
- **Wochentag beachten:**
  - Am Wochenende heißt die Cockpit-Karte „Heute & Montag fällig“ statt „Heute & morgen fällig“.
  - Die Servicezeit der Ansprechpartnerin ist Mo–Fr 7:30–19:00 Uhr. Außerhalb sagt die App ehrlich „Jetzt nicht erreichbar · wieder Mo, … ab 7:30 Uhr“ – das ist gewollt und gut vorführbar.
- **Zugänge** (Passwort aller Beispielzugänge `Apex-Demo-2026`; auf der Anmeldeseite genügt ein Klick auf die Karte):

| Kanzlei | Ort | Person | E-Mail |
|---|---|---|---|
| Hartmann & Partner (Hauptdemo) | Berlin | Dr. Julia Hartmann, Partnerin | `julia.hartmann@hartmann-partner.de` |
| | | Jonas Brandt, Rechtsanwalt | `jonas.brandt@hartmann-partner.de` |
| | | Mia Becker, Fachangestellte (ReFa-Sicht) | `mia.becker@hartmann-partner.de` |
| Lindner Rechtsanwälte | München | Stefan Lindner, Partner | `stefan.lindner@lindner-recht.de` |
| Demir & Kollegen | Hamburg | Selin Demir, Partnerin | `selin.demir@demir-kollegen.de` |
| Apex Console (Anbieter) | – | Apex-Team | `admin@apex-kanzlei.de` – im Browser-Demo Passwort `Apex-Console-2026` (die frühere Adresse `admin@anwaltapex.de` meldet dort weiter an) |

> **Apex Console im Server-Betrieb:** Dort gilt das eigene `CONSOLE_ADMIN_PASSWORD` (mindestens 12 Zeichen). Das öffentliche Demo-Passwort `Apex-Console-2026` und der Platzhalter aus `.env.example` werden abgelehnt; die Console bleibt dann deaktiviert. Eine Ein-Klick-Karte für den Anbieterzugang gibt es nur im Browser-Demo.

---

## Zahlen-Logik – so zählt die App

Alle Bereiche zählen gleich: Cockpit, Navigation, Fristenkalender, Akten, Apex Island und Apex Assistent nutzen dieselbe Berechnung (`src/core/fristenLage.ts` und `src/core/kennzahlen.ts`). Wenn der Kunde nachzählt, stimmen die Zahlen überall überein.

| Begriff | Bedeutung | Beispiel aus der App |
|---|---|---|
| **Fristen** | Notfristen **und** Fristen. Nur sie zählen als „Fristen“. | „Heute ist keine Frist fällig“ |
| **Wiedervorlagen, Vorfristen, Termine** | Eigene Kategorien. Sie werden getrennt genannt und nie als Fristen mitgezählt. | „Heute fällig 0 – dazu 1 Wiedervorlage“ |
| **Kritisch (rot)** | Notfrist oder gesetzlich nicht verlängerbare Frist: § 4 KSchG, StPO, OWiG, Widerruf eines Vergleichs. Vorfristen sind nie kritisch. | „Kritische Fristen 4 – nicht verlängerbar · nächste 23. Okt.“ |
| **Heute fällig** | Offene Fristen bis einschließlich heute, also auch überfällige. | Kachel „Heute fällig“ |
| **Nächste 7 Tage** | Gleitendes Fenster von morgen bis heute + 7 Tage – nicht die Kalenderwoche. | „Nächste 7 Tage 6 – dazu 12 Wiedervorlagen, 2 Termine“ |
| **Diese Woche** | Kalenderwoche Mo–So. Der Assistent nennt bei „diese Woche“ beide Werte: die Kalenderwoche und den Ausblick auf die nächsten 7 Tage. | „Diese Woche (bis So, 18.10.2026) ist keine Frist mehr offen …“ |
| **Letzte 7 Tage** | Heute und die sechs Tage davor (38h-Motor, Apex Island, „KI gespart“). | Apex Island „28,2 Std. · in 7 Tagen · Beispiel“ |
| **Vier-Augen-Kontrolle offen** | Fristen, die noch keine zweite Person bestätigt hat; KI- und Umzugsfristen immer. | „Vier-Augen-Kontrolle offen 6 – davon 2 von der KI erkannt“ |

**Zwei Kostensätze beim 38h-Motor – vorher kennen, damit niemand stolpert:**

- **Cockpit-Karte und Landing** rechnen mit dem veröffentlichten Zielwert-Satz **19,74 €/Std.** (36.000 € ÷ (38 Std. × 48 Wochen)). Bei 28,2 Std. zeigt das Cockpit deshalb „≈ 27.000 € pro Jahr“.
- **Die Seite 38h-Motor** rechnet mit dem einstellbaren internen Kostensatz **26,04 €/Std.** (50.000 € ÷ 1.920 Std.) und zeigt den Rechenweg: „28,20 Std. × 48 Arbeitswochen × 26,04 €/Std. = 35.247,74 €“.
- Alle Motor-Werte sind Beispielwerte aus den Demodaten und als „Beispiel“ bzw. „Beispielwerte“ gekennzeichnet.

---

## Ablauf im Überblick

| # | Abschnitt | Hero-Fall | Min. |
|---|---|---|---|
| 1 | Positionierung (`/willkommen`) | – | 1 |
| 2 | Anmeldung und getrennte Kanzleien | – | 0,5 |
| 3 | Cockpit | – | 2 |
| 4 | Posteingang: Urteil mit eEB – **der stärkste Moment** | **118/26** Neumann ./. Arslan Autohaus GmbH | 3 |
| 5 | Posteingang: Mandantenmail und Mandatsanfrage | **142/26** Weber, **Franke**-Anfrage | 1,5 |
| 6 | Akte und KI-Fallanalyse | **142/26** Weber ./. Kröger Logistik GmbH | 3 |
| 7 | Fristen und Fristenrechner | **137/26** Schneider ./. Lindenhof Hausverwaltung GmbH | 1,5 |
| 8 | Apex Assistent | 137/26, 128/26 | 2 |
| 9 | Abrechnung | **126/26** Forderungskonto, **131/26** Fremdgeld | 3 |
| 10 | Fall-Datenbank und Suche | 142/26, 137/26 | 1 |
| 11 | 38h-Motor | – | 1 |
| 12 | Umzug | – | 1 |
| 13 | Hilfe, Ansprechpartnerin, Lizenz, Datenschutz | – | 1 |
| 14 | Mobil am Gericht und Dunkelmodus | **151/26** Ostermann ./. Havelbrück Pflegedienste GmbH | 1,5 |
| 15 | Abschluss: Testzugang live anlegen | Apex Console | 1,5 |
| | **Summe** | | **≈ 24,5** |

**Auf 20 Minuten kürzen:** Schritt 11 (38h-Motor) im Cockpit mit einem Satz erwähnen, Schritt 12 (Umzug) und Schritt 14 (Mobil) weglassen oder auf Nachfrage zeigen.

---

## 1 · Positionierung (1 Min.) – `/willkommen`

- Hero: **„Ein Werkzeug. Volle Kontrolle.“** – Akten, beA, Fristen, Abrechnung und KI in einer Oberfläche.
- Die **Vorschau mit Beispieldaten** zeigt die drei Kernstücke auf einen Blick: Zustellung Urteil → „Frist erkannt → Akte 118/26“, KI-Fallanalyse 142/26 mit „Gute Aussichten (Beispiel)“ und den Rechenweg der Berufungsfrist nach § 517 ZPO.
- **Vergleich:** Jeder Punkt stammt aus echten Kundenbewertungen am Markt – Updates, Hotline, Suche, Forderungskonto, Kosten, Umzug.
- **Lifetime statt Abo:** einmal investieren, dauerhaft nutzen, keine Monatsgebühren. Wartung optional – Umfang und Preis regelt das Angebot. Preis auf Anfrage – verbindlich im Angebot. **Keine Zahl und keine Zusage nennen, die nicht im Angebot steht.**
- „Testzugang anfordern“ öffnet das Anfrageformular mit dem Kontakt zur festen Ansprechpartnerin.

## 2 · Anmeldung und getrennte Kanzleien (0,5 Min.) – `/login`

- Drei Beispielkanzleien in Berlin, München und Hamburg mit getrennten Zugängen und **strikt getrennten Daten**.
- Ein-Klick-Karten gibt es nur für die öffentlichen Beispielkanzleien. Kundentestzugänge melden sich immer mit E-Mail-Adresse und eigenem Passwort an.
- Mit Karte **„Hartmann & Partner“** anmelden. Satz für später: *„So bekommt auch Ihre Kanzlei einen eigenen Testzugang“* – Schritt 15.

## 3 · Cockpit (2 Min.) – `/cockpit`

- **Begrüßung** „Guten Tag, Frau Dr. Hartmann“, darunter **„Ganze Kanzlei“ / „Nur meine“**.
- **KI-Briefing** mit „Vorlesen“: drei Sätze – Fristen, Posteingang, nächster Termin. Beispiel am Samstag, 17.10.2026:
  > „Heute ist keine Frist fällig, nur eine Wiedervorlage. In den nächsten sieben Tagen stehen 6 Fristen und 12 Wiedervorlagen an – am dringendsten ist die nicht verlängerbare Frist ‚Einspruch gegen Bußgeldbescheid‘ in 128/26 bis Fr, 23. Okt. … Ihr nächster Termin: Gütetermin in 151/26 am Di, 20. Okt. um 09:00 Uhr – Arbeitsgericht Berlin, Magdeburger Platz 1, Saal 3.“
  - Hier die [Zahlen-Logik](#zahlen-logik--so-zählt-die-app) in einem Satz erklären: *„Fristen sind Notfristen und Fristen – Wiedervorlagen nennen wir getrennt.“*
- Karte **„Heute & morgen fällig“** (am Wochenende „Heute & Montag fällig“): Einträge bis zum nächsten Arbeitstag, kritische Fristen rot mit Norm („Nicht verlängerbar · § 67 Abs. 1 OWiG“), Block **„Termine heute“**, Wiedervorlagen mit „als erledigt markieren“.
- Karte **Posteingang:** „6 neu · 3 warten auf KI-Analyse“, darunter die Zeile „beA · E-Mail · letzte Abfrage vor … Min. (simuliert)“. In der Kopfleiste der Status **„Simuliert verbunden“** – ehrlich gekennzeichnet.
- Oben die schwarze **Apex Island** „28,2 Std. · in 7 Tagen · Beispiel“: Sie zeigt, was der 38h-Motor zuletzt erledigt hat. Live-Meldungen höchstens alle 90 Sekunden; abschaltbar unter Einstellungen → Darstellung; „×“ blendet sie aus.
- Karten **KI-Empfehlung** („KI-Fallanalyse bereit: Erfolgsaussicht prüfen · 142/26“), **38h-Motor** und **Finanzen** (offene Forderungen, überfällig, Fremdgeld).

## 4 · Posteingang: Urteil 118/26 mit eEB (3 Min.) – der stärkste Moment

1. Im Posteingang die beA-Nachricht des Landgerichts Berlin II öffnen: **„28 O 211/26 – Neumann ./. Arslan Autohaus GmbH – Zustellung Urteil gegen eEB“** (Chips „Frist erkannt“, „eEB offen“). Das Jahr im Gerichtsaktenzeichen folgt dem Präsentationsjahr.
2. Die **KI-Analyse** läuft sichtbar („Demo-KI (offline) · 1,3 s“ bzw. Live-KI):
   - **Zusammenfassung** des Tenors: 14.250,00 € Zug um Zug, im Übrigen abgewiesen (Nutzungsentschädigung 4.650,00 €), Kostenquote 25/75, vorläufige Vollstreckbarkeit. *„Ergebnis für Mandant Michael Neumann: überwiegend erfolgreich.“*
   - **Erkannte Akte:** 118/26 – „99 % sicher · erkannt über Gerichtsaktenzeichen 28 O 211/26“.
   - **Erkannte Fristen:** Notfrist **Berufungsfrist** (§ 517 ZPO, „Berufung einzulegen beim Kammergericht, § 519 Abs. 1 ZPO“) und Frist **Berufungsbegründungsfrist** (§ 520 Abs. 2 S. 1 ZPO), jeweils mit Zustellung, Fristende, Vorfrist. Bei Zustellung am Sa, 17.10.2026: Di, 17.11.2026 (Vorfrist Di, 10.11.) und Do, 17.12.2026 (Vorfrist Do, 03.12.).
3. **„Rechenweg anzeigen“** aufklappen und vorlesen:
   1. Zustellung des vollständigen Urteils
   2. Fristbeginn am Folgetag – der Ereignistag zählt nicht mit (§ 222 Abs. 1 ZPO i. V. m. § 187 Abs. 1 BGB)
   3. Dauer 1 Monat (§ 517 ZPO): Ende am Tag mit derselben Zahl – § 188 Abs. 2 BGB
   4. Feiertage am Gerichtsort geprüft: Berlin (Kammergericht, Berufungsgericht)
   5. Fällt das Fristende auf einen Werktag: „keine Verschiebung“. Fällt es auf Wochenende oder Feiertag: Verschiebung auf den nächsten Werktag nach § 222 Abs. 2 ZPO.
   6. Vorfrist 7 Tage vorher, auf einen Werktag gelegt
   - Kernbotschaft: *„Die KI erkennt – berechnet wird mit dem geprüften Fristenrechner.“*
4. **„Fristen übernehmen“** (Taste **U**) – „inkl. Vorfristen in 118/26“. Danach: „Im Kalender“, „Fristen notiert – Vier-Augen-Kontrolle offen – bestätigt eine Kollegin oder ein Kollege“. Die Anhänge liegen in der E-Akte.
5. Erst jetzt ist das **Empfangsbekenntnis „Bereit zur Abgabe“**. Vorher stand dort: „Erst Frist notieren, dann eEB“.
6. **„eEB abgeben“** (Taste **E**) öffnet den Dialog:
   - „Zustellungsdatum (Tag der Kenntnisnahme)“ – vorbelegt ist der Eingangstag; frühestens der Eingangstag, spätestens heute.
   - Hinweis „Vier-Augen-Kontrolle steht noch aus“ mit dem Häkchen „Ich habe die notierten Fristen selbst geprüft“.
   - „Protokolliert werden Name, Zeitpunkt, Zustellungsdatum und der erste Lesezeitpunkt der Nachricht.“
7. **Rollen:** Das eEB geben nur Rechtsanwältinnen und Rechtsanwälte ab. Fachangestellte und Auszubildende sehen „Zur eEB-Abgabe vorlegen“; die Anwältin erhält dann eine Wiedervorlage für heute (optional mit `mia.becker@hartmann-partner.de` zeigen).
8. **Schutz bei Korrekturen:** Wird eine Notfrist später korrigiert, ist sie an das eEB-Datum gebunden. Ein Ereignisdatum in der Zukunft oder vor dem Eingang ist gesperrt; eine spätere Abweichung vom eEB-Datum braucht eine Pflichtbestätigung, und die Kontrollperson sieht den Chip „weicht vom eEB ab“.

## 5 · Posteingang: Mandantenmail und Mandatsanfrage (1,5 Min.)

1. **E-Mail von Thomas Weber** „Unterlagen + wichtiger Hinweis zu Herrn Seifert“:
   - KI-Vorschlag **142/26 (98 %)** – „erkannt über Absenderadresse thomas.weber@posteo.de (Mandant Thomas Weber)“.
   - Nächste Schritte: Zeugenhinweis notieren; Arbeitsuchendmeldung – die Dreitagesfrist nach § 38 Abs. 1 S. 2 SGB III ist abgelaufen, Meldung sofort nachholen, sonst droht eine Sperrzeit (§ 159 SGB III); Anhänge in der E-Akte ablegen.
   - „Akte zuordnen“ (Taste **U** = „Vorschlag übernehmen“).
2. **E-Mail von Ursula Franke** „Anfrage: Eigenbedarfskündigung meiner Wohnung“:
   - Die KI erkennt eine **Mandatsanfrage (Mietrecht)**: Mieterin 79 Jahre, herzkrank, Mietdauer seit 1994, Rechtsschutz vorhanden, Härtefall nach § 574 BGB naheliegend (vgl. BGH VIII ZR 180/18).
   - **„Mandat anlegen“** öffnet die **Mandatsaufnahme** in vier Schritten (Mandant, Sache, Rechtsschutz, Zusammenfassung) – „Übernommen aus dem Posteingang: Ursula Franke …“.
   - Vollmacht, Mandatsbestätigung und Datenschutzhinweise erstellt Apex automatisch; die Deckungsanfrage liegt als **Entwurf zur Freigabe** bereit.
   - Die **Kollisionsprüfung** (§ 43a Abs. 4 BRAO) läuft schon in Schritt 1 und erfasst auch Dubletten. Optional zeigen: Als Mandant „Kröger Logistik GmbH“ eintragen – Treffer, denn Kröger ist Gegner in 142/26.
3. Tastatur: **J/K** nächste bzw. vorige Nachricht, **Enter** öffnen, **U** Vorschlag übernehmen, **E** eEB-Dialog.

## 6 · Akte 142/26 Weber ./. Kröger Logistik GmbH (3 Min.)

1. **Aktenkopf:** Arbeitsrecht, Mandatsaufnahme, Hohe Priorität, „RSV · Deckung offen“, „Mandantenportal aktiv“; Gericht „Arbeitsgericht Berlin – Az. noch nicht bekannt“ (die Klage ist noch nicht eingereicht).
2. **E-Akte** (Reiter „Dokumente“): ein Dokument per Doppelklick umbenennen, mehrere markieren und per Drag & Drop in einen Ordner ziehen.
   - Kernbotschaft: *„Was Sie aus Ihrer alten Software kennen, geht hier in einer Sekunde.“*
3. **„E-Mail schreiben“** – nach dem Senden bleiben Sie in der Akte.
4. Reiter **KI-Fallanalyse** → „Fallanalyse starten“:
   - Die Pipeline läuft sichtbar („In 30 Sekunden zur fundierten Einschätzung“).
   - **„Einschätzung der Erfolgsaussicht: Gute Aussichten“** mit Begründung nach der „Emmely“-Rechtsprechung.
   - **„Wie entsteht die Einschätzung?“** zeigt den KI-Schätzwert in Prozent mit Faktoren, Rang und Quelle – ausdrücklich keine statistische Prognose; maßgeblich ist die anwaltliche Würdigung.
   - **Rechtsfragen** (§ 626 BGB, Abmahnung, § 1 Abs. 2 KSchG, § 102 BetrVG, § 626 Abs. 2 BGB), **„Was für uns spricht“** und **„Was dagegen spricht“** – jedes Argument mit Quelle; ohne Beleg steht „ohne Beleg – anwaltlich prüfen“.
   - **Präzedenzfälle aus der Fall-Datenbank:** BAG 2 AZR 541/09 „Emmely“ (Ähnlichkeit 99 %), BAG 2 AZR 133/18 (Videoaufzeichnungen) und BAG 2 AZR 681/16 (Keylogger).
   - **Nächste Schritte** und der **Entwurf der Kündigungsschutzklage** mit Kündigungs- und Zugangsdatum → „In E-Akte speichern“.
5. **Deckungsanfrage** an die Nordlicht Rechtsschutz AG: liegt als Entwurf zur Freigabe vor (Reiter „Beteiligte“ → „Freigeben und versenden“). Erst nach der Freigabe geht sie hinaus; danach meldet die Analyse „versandt am … von …“.
6. Reiter **Fristen:** Die Klagefrist nach § 4 S. 1 KSchG (bis Mo, 02.11.2026 bei Präsentation am 17.10.) ist **rot** – keine Notfrist im Sinne der ZPO, aber nicht verlängerbar; nachträgliche Zulassung nur nach § 5 KSchG. Sie kam von der KI, hat einen Rechenweg und ist im Vier-Augen-Prinzip bereits kontrolliert.

## 7 · Fristen und Fristenrechner (1,5 Min.) – `/fristen`

- **Vier Kacheln:** „Heute fällig“, „Nächste 7 Tage“, „Kritische Fristen“, „Vier-Augen-Kontrolle offen – davon 2 von der KI erkannt“. Jede Kachel filtert die Liste.
- **Ansichten:** Liste, Woche, Monat und **Ausgangskontrolle** (abends: jede fällige Frist „offen“ oder „versandt mit Nachweis“, mit Druckansicht).
- **Vier-Augen-Kontrolle an 137/26 Schneider ./. Lindenhof Hausverwaltung GmbH:** „Replik auf Klageerwiderung“ (richterliche Frist, § 277 Abs. 4 ZPO), „Von KI erkannt“, verantwortlich Jonas Brandt. Dr. Hartmann ist nicht verantwortlich und darf deshalb **„Kontrolle bestätigen“** (oder „Korrektur anfordern“). Tastatur: **J/K** wählen, **B** bestätigen.
- **„Frist berechnen“** (Taste **F**): Fristart suchen, Ereignisdatum eingeben, Gericht wählen (das Bundesland folgt daraus) – das Ergebnis zeigt den Rechenweg mit Feiertagen **am Gerichtsort** (bundesweit und landesrechtlich, z. B. Frauentag in Berlin). Regionale Feiertage, die am Gerichtsort nicht gelten, verlängern nie.
- „Meine Fristen als .ics“ und „Drucken“ für den Papierkalender.

## 8 · Apex Assistent (2 Min.)

Unten rechts die Kugel antippen (oder Strg+K → „Apex Assistent öffnen“) und sprechen oder tippen. **Diese Fragen funktionieren zuverlässig, auch mit der Demo-KI:**

| Frage | Was passiert |
|---|---|
| „Was steht heute an?“ | Tageszusammenfassung wie im Cockpit-Briefing, mit Werkzeug-Chips („Tag zusammengefasst“, „Fristenkalender geprüft“, „Posteingang geprüft“). |
| „Welche Fristen laufen diese Woche ab?“ | Kalenderwoche plus Ausblick auf die nächsten 7 Tage – Fristen und Wiedervorlagen getrennt. Am Wochenende besser: „Welche Fristen stehen in den nächsten 7 Tagen an?“ (Liste mit Datum, Akte und „nicht verlängerbar“). |
| „Welche nicht verlängerbaren Fristen stehen als Nächstes an?“ | 128/26 Bußgeld-Einspruch (§ 67 Abs. 1 OWiG), danach die Klagefristen in 142/26, 143/26 und 150/26. |
| „Lege eine Wiedervorlage für Akte 137 in drei Tagen an“ | Der Assistent fragt nach dem Auftrag („Worum geht es …?“); Antwort z. B. „Vergleichsvorschlag prüfen“. Dann erscheint eine **Bestätigungskarte** (Akte, Titel, Datum mit Wochentag) mit „Eintragen“, „Ändern“, „Verwerfen“. Erst nach „Eintragen“ steht der Eintrag im Kalender – mit „Rückgängig“ und dem Etikett „Durch Assistent angelegt“. |
| „Berechne die Berufungsfrist bei Zustellung heute“ | Ergebnis vom Fristenrechner mit Vorfrist und Link „Im Fristenrechner öffnen“. |
| „RVG für 10.000 € außergerichtlich“ | 2300 Geschäftsgebühr 1,3 = 847,60 €, Auslagenpauschale 20,00 €, gesamt 1.032,44 € brutto – Link zum RVG-Rechner. |
| „Wie hoch sind die offenen Forderungen?“ | Offene und überfällige Rechnungen, älteste Rechnung, Fremdgeld zur Weiterleitung, offene Kontoumsätze. |
| „Urteile zu Kündigung wegen Bagatelle“ | BAG 2 AZR 541/09 „Emmely“ aus der Fall-Datenbank. |
| „Öffne die Akte 142/26“ | Springt direkt in die Akte. |
| „beA ist gestört, die Frist läuft heute ab – was tun?“ | Wissenskarte **Ersatzeinreichung**: § 130d S. 2, 3 ZPO bzw. § 46g S. 3, 4 ArbGG, Glaubhaftmachung, Dokumentation, Ausgangskontrolle; außerhalb der Servicezeit: „warten Sie nicht, reichen Sie jetzt ersatzweise ein“. Bei einer Begründungsfrist („Berufungsbegründung muss heute raus“) nennt er zusätzlich den Verlängerungsantrag (§ 520 Abs. 2 S. 2, 3 ZPO bzw. § 66 Abs. 1 S. 5 ArbGG). |
| „Wie funktioniert der Bankabgleich?“ | Antwort aus dem Wiki mit „Bankabgleich öffnen“ und Schnellhilfe. |
| „Ich möchte mit meiner Ansprechpartnerin sprechen“ | „Ihre feste Ansprechpartnerin: Lena Vogt (Durchwahl …)“ – in der Servicezeit mit Rückruf binnen 30 Minuten, außerhalb ehrlich „jetzt nicht erreichbar“ mit nächstem Termin. „Rückruf anfordern“ als Knopf oder mit „Ja“. Im Prototyp simuliert. |

- Bei mehrdeutigen Namen (z. B. „Meyer“) fragt der Assistent nach, statt zu raten; doppelte Einträge meldet er vorher.
- Was der Assistent nicht kann, sagt er ehrlich und schlägt passende Fragen vor.

## 9 · Abrechnung (3 Min.) – `/abrechnung`

- **Übersicht:** Umsatz, offene Forderungen, überfällige Rechnungen, **„Fremdgeld zur Weiterleitung 6.120 € · 1 Akte · § 43a Abs. 7 BRAO“** und „Jetzt erledigen“ (abrechenbare Akten, offene Kontoumsätze, Zahlungserinnerungen).
- **RVG-Rechner – je Angelegenheit** (§ 15 RVG): Die Beispielwerte 10.000 € mit 2300 + 3100 + 3104 ergeben zwei Angelegenheiten:
  - „Außergerichtliche Vertretung“: 2300 Geschäftsgebühr 1,3 = 847,60 € + 7002 Auslagenpauschale 20,00 €.
  - „Gerichtliches Verfahren, 1. Instanz“: 3100 Verfahrensgebühr 1,3 = 847,60 € + 3104 Terminsgebühr 1,2 = 782,40 € − Anrechnung der Geschäftsgebühr 0,65 = −423,80 € (Vorbem. 3 Abs. 4 VV RVG) + 7002 = 20,00 €.
  - Summe: „Auslagenpauschalen (2 × Nr. 7002) 40,00 €“, netto 2.093,80 €, USt. 397,82 €, **brutto 2.491,62 €**.
  - Die Tabelle (KostBRÄG 2025 bzw. KostRÄG 2021) folgt dem Tag der Auftragserteilung (§ 60 RVG). Ein Gegenstandswert ≤ 0 wird mit Meldung am Feld abgewiesen.
- **Sammelabrechnung** (Strg+K → „Sammelabrechnung“):
  - Filter RSV „Deckung erteilt“; RSV-Anteil und Selbstbeteiligung je Akte.
  - Abgerechnet werden nur entstandene, noch nicht berechnete Gebühren (§ 15 Abs. 2 RVG). Im laufenden Verfahren schlägt Apex einen **Vorschuss nach § 9 RVG** vor (z. B. 151/26: „Terminsgebühr erst nach dem Termin“).
  - Format „Automatisch“: XRechnung für Unternehmen und Organisationen, PDF für Privatpersonen.
  - Standard: **Entwürfe** zur Prüfung, ohne Rechnungsnummer; „Sofort stellen“ nur auf Wunsch.
- **Storno:** Eine gestellte Rechnung öffnen → „Stornieren“. Die Stornorechnung bekommt eine eigene Nummer aus dem Nummernkreis und steht als eigene Zeile „zu RE-…“ in der Liste (Filter „Storno“). „Stornieren und korrigieren“ legt einen Korrekturentwurf mit dem Leistungszeitraum der stornierten Rechnung an.
- **Bankabgleich:** Jeder Kontoumsatz zeigt sein **Konto** (Filter „Geschäftskonto“ / „Anderkonto“).
  - Offen: die Regulierung der Hanseatischen Kraftfahrt-Versicherung (5.670,00 €, 107/26) – **Anderkonto**, Fremdgeld für die Mandantschaft.
  - Gebucht: die Zahlung der Elbtal Versicherung (6.120,00 €, **131/26 Yilmaz**) – auf dem Anderkonto eingegangen und bereits als Fremdgeld der Akte zugeordnet („Fremdgeld · 98 % · automatisch“).
  - „Abgleich starten“: eindeutige Zahlungen ab 90 % werden gebucht, alle anderen als Vorschlag vorgelegt; jede Zuordnung lässt sich unter „Gebucht“ lösen.
- **Fremdgeld weiterleiten (131/26):** Die Weiterleitung nennt das Anderkonto als Quellkonto und geht nur über den Dialog mit Empfängerin und IBAN – als SEPA-Datei (pain.001) zur Freigabe im Online-Banking oder „bereits überwiesen am …“. Für die Fachangestellte steht sie als Wiedervorlage „Fremdgeld an Mandantin weiterleiten (§ 43a Abs. 7 BRAO)“ für heute im Kalender. In den Präsentationskanzleien ist die Anderkonto-IBAN leer; der Dialog sagt, wo man sie ergänzt.
- **Forderungskonto 126/26 Berger Haustechnik GmbH ./. Lenz:**
  - Titel: Vollstreckungsbescheid; Zinsen taggenau „laut Titel: 5 Prozentpunkte über dem Basiszins“ mit Satzwechsel zum 01.07.2026.
  - Hinweis zu 9 Prozentpunkten nur ohne Verbraucherbeteiligung (§ 288 Abs. 2 BGB).
  - **Verrechnung nach § 367 Abs. 1 BGB:** Kosten → Zinsen → Hauptforderung (am 17.10.2026: 1.000,00 € gezahlt, davon 637,00 € auf Kosten, 142,51 € auf Zinsen, 220,49 € auf die Hauptforderung). „Forderungsaufstellung erstellen“.
- **Zinsrechner** (Strg+K → „Zinsrechner“): Betrag, Zeitraum, 5 oder 9 Prozentpunkte – mit Rechenweg je Basiszins-Abschnitt.

## 10 · Fall-Datenbank und Suche (1 Min.)

- **Strg+K** (Mac: ⌘K) und „pfandbon kündigung“ tippen: **3 Treffer** in wenigen Millisekunden – Akte 142/26, das Dokument „Gesprächsnotiz Erstberatung“ (Volltext) und BAG 2 AZR 541/09. Fußzeile: „Lokaler Index – Mandantendaten verlassen das Gerät nicht“.
- **Fall-Datenbank** (`/fall-datenbank`): Stichwortsuche oder **KI-Recherche** (Sachverhalt beschreiben, passende Entscheidungen mit Begründung).
  - Block **„Für Ihre Akten“**: 142/26 → „Emmely“ 99 %, 137/26 → BGH VIII ZR 185/14 (Schönheitsreparaturen bei unrenovierter Wohnung) 99 %.
  - Treffer lassen sich an eine Akte heften. Optional: „Emmely“ → „Mit dem Assistenten besprechen“.
  - Demo-Auszug mit 33 Leitentscheidungen von BVerfG, EuGH und Bundesgerichten – offen kennzeichnen.
- **Optional, 137/26:** Apex KI → Reiter „Schriftsatz-Entwurf“ → Akte 137/26, Dokumentart „Replik“ → „Entwurf erstellen“. Platzhalter in [Klammern] sind markiert; Zitate nur aus der Fall-Datenbank.

## 11 · 38h-Motor (1 Min.) – `/automatisierung`

- Banner: „Demo-Daten – im Echtbetrieb misst der Motor Ihre Kanzlei. Alle Werte hier sind simuliert.“ – **12 von 12 Automatiken aktiv**, jede einzeln schaltbar.
- „Letzte 7 Tage“: 28,2 Std. gespart (74 % des Wochenziels von 38 Std.), gesparte Kosten mit Rechenweg (26,04 €/Std.), Vorgänge je Tag.
- Grundsatz: *„Was die Kanzlei verlässt, geht erst nach Ihrer Freigabe hinaus.“* Fristautomatiken (Fristerkennung, Vorfristen, eEB) schalten nur Partner und Administration.
- **„Ersparnis berechnen“** (ROI-Rechner): eigene Mengen eintragen, Ergebnis zum eigenen Kostensatz. Der Schalter „Wartung im ersten Jahr im Lizenzpreis enthalten (laut Angebot)“ ist standardmäßig aus – der Rechner nimmt nichts an, was das Angebot nicht sagt.

## 12 · Umzug (1 Min.) – `/umzug`

- **Umzug in fünf Schritten – mit Vorschau und Rückgängig:** Altsystem, Daten, Zuordnung, Übernahme, Fertig.
- „RA-MICRO“ wählen → **„Beispiel-Export laden“**: Spalten werden automatisch zugeordnet, Umlaute aus Windows-1252 kommen richtig an, Dubletten werden erkannt (auch innerhalb der Datei), die Plausibilitätsprüfung meldet Auffälliges.
- Übernommene Fristen tragen „Aus Umzug“ und gehen in die **Vier-Augen-Kontrolle**.
- Das **Umzugsprotokoll** hält jeden Lauf fest; „Rückgängig“ geht auch nach dem Neuladen.
- „Gemeinsam mit Lena Vogt“: Dokumente der E-Akte, Aktenkonten, offene Posten, Benutzer und beA-Postfach – Umfang laut Angebot.
- Kernbotschaft: *„Ihr Altsystem hält Sie nicht mehr fest.“*

## 13 · Hilfe, Ansprechpartnerin, Lizenz, Datenschutz (1 Min.)

- **Hilfe & Support:** Lena Vogt, „Ihre feste Ansprechpartnerin“, mit Durchwahl, E-Mail, „Rückruf anfordern“ und „Bildschirm teilen“. Servicezeit Mo–Fr 7:30–19:00 Uhr; Rückruf in der Servicezeit innerhalb von 30 Minuten.
- **Systemstatus** (beA, E-Mail, Bank, KI – im Prototyp simuliert), **Geprüfte Updates** (Staging und Regressionstests), **animiertes Wiki** mit 18 Artikeln. Das **?** neben jedem Seitentitel öffnet die Schnellhilfe genau dort, wo man arbeitet; **?** auf der Tastatur zeigt alle Tastaturkürzel.
- **Einstellungen → Lizenz:** Lifetime-Lizenz ohne Monatsgebühren, gekennzeichnet als „Entwurf der Lizenzbedingungen – verbindlich ist das Angebot“. Wartung: „Umfang und Preis regelt das Angebot“; Übertragbarkeit: „im Angebot geregelt“; Quellcode-Hinterlegung (Escrow): „auf Anfrage“.
- **Einstellungen → Datenschutz & Verträge:** Muster nach § 43e BRAO und Art. 28 DSGVO, Unterauftragnehmer, Löschkonzept und Aufbewahrung (§ 50 BRAO), Protokoll mit gekennzeichneten Beispieleinträgen; „Anmeldung & Sicherheit“ mit Zwei-Faktor-Anmeldung und Sperre bei Inaktivität.
- **Einstellungen → KI-Einstellungen:** Live-KI oder Demo-KI, Datenfluss, Verarbeitungsort („Verarbeitung der Live-KI in der EU: auf Anfrage“).

## 14 · Mobil am Gericht und Dunkelmodus (1,5 Min.)

**Am iPhone (oder Browser auf 390 px):**

- Tab-Leiste unten: Cockpit · Akten · Post · Fristen · Mehr; die Assistent-Kugel weicht an den Rand aus.
- Akte **151/26 Ostermann ./. Havelbrück Pflegedienste GmbH** (Arbeitsgericht Berlin, Az. 28 Ca 11873/26) in zwei Taps öffnen.
  - „Nächster Termin“: **Gütetermin**, 09:00 Uhr, Arbeitsgericht Berlin, Magdeburger Platz 1, Saal 3 – drei Tage nach „heute“, auf einem Werktag. Mit „In Kalender (.ics)“.
  - E-Akte mit Kündigungsschreiben, Klageschrift und Ladung als PDF.
  - Beim Scrollen erscheint die Aktionsleiste **Notiz · Frist · Wiedervorlage** im Daumenbereich.
  - Nach dem Termin: Sitzungsnotiz anlegen und die Fristart **„Widerrufsfrist (Vergleich)“** eintragen – nicht verlängerbar, keine Verlängerung ohne Zustimmung der Gegenseite.
- 142/26 bleibt dabei unverändert (Mandatsaufnahme, Klage noch nicht eingereicht).

**Dunkelmodus:** Kopfleiste „Darstellung“ (Hell · Dunkel · System) oder Einstellungen → Darstellung. Die Fristen bleiben ohne Farbe lesbar (Text und Symbol), Dokumentvorschauen sind im Dunkeln leicht abgedunkelt („Original“ wählbar). Dazu Schriftgröße 112 % bzw. 125 %; „Bewegung reduzieren“ des Systems wird überall respektiert.

## 15 · Abschluss: Testzugang live anlegen (1,5 Min.)

1. Abmelden und als **Apex Console** anmelden (Browser-Demo: Karte „Anbieterzugang (Demo)“; Server: `admin@apex-kanzlei.de` bzw. die Adresse aus `CONSOLE_ADMIN_EMAIL`, mit eigenem `CONSOLE_ADMIN_PASSWORD`).
2. Übersicht „Kunden & Testzugänge“: Die Beispielkanzleien stehen mit Lifetime-Lizenz als „Aktiv“ da, „Aktive Tests“ zeigt 0.
3. **„Neuen Testzugang anlegen“:**
   - Kanzleiname und Stadt eintragen – das Bundesland ergänzt die App (z. B. Paderborn → Nordrhein-Westfalen; es bestimmt die Feiertage).
   - Anrede, Name und E-Mail der Hauptnutzerin bzw. des Hauptnutzers, Arbeitsplätze, „Testzugang bis“ (vorbelegt 30 Tage), Schwerpunkte.
   - „Mit Beispieldaten“ (über 30 Beispielakten) oder leer für echte Daten.
4. **„Testzugang ist bereit“:**
   - Anmeldeadresse, E-Mail und **Startpasswort** (Format `Apex-XXXX-XXXX`) – „Getrennt übermitteln (telefonisch oder per SMS) – nie zusammen mit der Einladung“.
   - **Einladung kopieren** – vollständig, ohne Passwort, mit förmlicher Anrede.
5. **Erstanmeldung vorführen:** Abmelden, mit E-Mail und Startpasswort anmelden → **„Eigenes Passwort festlegen“** (mindestens 10 Zeichen mit Buchstaben und Ziffer, anders als das Startpasswort) → Cockpit der neuen Kanzlei; in der Seitenleiste steht „Testzugang bis …“.
6. Je Kanzlei bietet die Console „Pausieren“, „Daten zurücksetzen“ und „Löschen“, je Person „Einladung kopieren“ und „Neues Passwort“ (neues Startpasswort; der Vorgang steht im Protokoll der Kanzlei). Für die Beispielkanzleien gibt es „Demo-Passwort wiederherstellen“.

Schlusssatz: *„Ihr eigener Testzugang ist in einer Minute eingerichtet – mit Ihren Schwerpunkten und den Feiertagen Ihres Bundeslands.“*

---

## Häufige Fragen

| Frage | Antwort |
|---|---|
| Wo liegen unsere Daten? | In einem deutschen Rechenzentrum oder auf einem eigenen Server in der Kanzlei. Live-KI: Anthropic, PBC (USA) – der Kanzlei-Server sendet nur die nötigen Inhalte, ohne Nutzung zum Training. Für die Übermittlung in die USA gelten Art. 44 ff. DSGVO; nach § 43e Abs. 4 BRAO muss der Geheimnisschutz dort dem Schutz im Inland vergleichbar sein – das prüft die Kanzlei vor dem Einschalten der Live-KI. Die Demo-KI arbeitet offline. Verarbeitung der Live-KI in der EU: auf Anfrage. |
| Was, wenn die KI irrt? | Fristen berechnet nie die KI, sondern der geprüfte Rechenkern. Jede KI-Frist geht in die Vier-Augen-Kontrolle. Quellen und Rechenweg sind immer sichtbar; Präzedenzfälle kommen nur aus der Fall-Datenbank. |
| Wer darf das eEB abgeben? | Nur Rechtsanwältinnen und Rechtsanwälte. Fachangestellte legen es vor. Das eEB ist erst möglich, wenn die Frist notiert ist. |
| Funktioniert das beA wirklich? | Im Prototyp ist die beA-Anbindung simuliert und so gekennzeichnet. Die produktive Anbindung über die BRAK-Schnittstelle ist Phase 3 der Umsetzung. |
| Was kostet das? | Eine einmalige Lifetime-Lizenz nach Kanzleigröße, ohne Monatsgebühren. Preis auf Anfrage – verbindlich im Angebot. Wartung optional – Umfang und Preis regelt das Angebot. |
| Kann der Anbieter in unsere Daten sehen? | Nein. Die Console verwaltet Kanzleien und Zugänge, sieht aber keine Akteninhalte. Ein neues Startpasswort vergibt der Anbieter nur auf Wunsch; jeder Vorgang steht im Protokoll der Kanzlei. |
| Wie kommen wir aus der alten Software heraus? | Mit dem Umzug in fünf Schritten – mit Vorschau, Dublettenprüfung und Rückgängig. Ihre feste Ansprechpartnerin begleitet den Umzug. |
| Was passiert ohne Wartung? | Laut Entwurf der Lizenzbedingungen bleiben Software und Daten unbefristet nutzbar und exportierbar. Verbindlich ist das Angebot. |

## Was im Prototyp echt und was simuliert ist

**Echt:**

- Fristenrechner mit Feiertagen aller 16 Länder, RVG 2025/2021, Zinsen und § 367 BGB (mit Tests)
- Anmeldung, Mandantentrennung, Testzugänge, Teamverwaltung, Zwei-Faktor-Anmeldung (Server)
- Live-KI mit Claude (Server oder Artefakt) und die Demo-KI ohne Netz
- CSV-Import im Umzug, Spracheingabe und -ausgabe (Chrome, Edge, Safari)

**Simuliert und gekennzeichnet:**

- beA-, E-Mail- und Bankanbindung (Status, Abruf und eingehende Nachrichten stammen aus Demodaten)
- die Zeitersparnis-Werte des 38h-Motors („Beispielwerte“)
- die Fall-Datenbank (Auszug echter Leitentscheidungen; Anbindung an Open Legal Data und NeuRIS vorbereitet)
- Rückruf und Bildschirmteilen der Ansprechpartnerin
- Impressum (gekennzeichneter Platzhalter, bis der Auftraggeber die Anbieterdaten liefert)

## Hinweise für die Artefakt-Vorschau

Das Artefakt ist eine einzige HTML-Datei im Browser-Demo-Betrieb. In der Vorschau gelten einige Grenzen der eingebetteten Ansicht:

- **Mikrofon nicht verfügbar:** Die Vorschau gibt kein Mikrofon frei. Nach dem ersten Klick meldet die App „Spracheingabe ist in dieser Ansicht nicht verfügbar – bitte tippen Sie Ihre Frage.“ und blendet den Mikrofon-Knopf aus. **Fragen an den Assistenten tippen.**
- **Live-KI:** läuft über die Laufzeit des Artefakts, nachdem der Betrachter sie einmalig freigegeben hat. Kommt 45 Sekunden lang kein Lebenszeichen, übernimmt die Demo-KI mit dem Hinweis „Live-KI antwortet nicht – Ergebnis der Demo-KI.“
- **Kopieren:** Ist die Zwischenablage gesperrt, markiert die App den Text und sagt „jetzt Strg/⌘+C“.
- **Dateien** (.ics, SEPA, XRechnung): erscheinen in einem Vorschau-Dialog mit „Datei speichern“ und „In Zwischenablage kopieren“; ist das Speichern gesperrt, bleibt das Kopieren.
- **Daten** liegen im Browserspeicher der Vorschau; ein Neuladen behält sie, ein neues Profil beginnt frisch.

## Wenn etwas hakt

| Situation | Lösung |
|---|---|
| Zahlen oder Fristen weichen vom Skript ab | Die Demodaten hängen am Datum. Wochentag prüfen; ggf. „Demo-Daten zurücksetzen“. Datumsangaben im Skript gelten für eine Präsentation am Sa, 17.10.2026. |
| Live-KI langsam oder ohne Netz | Einstellungen → KI-Einstellungen → „Präsentationsmodus: Demo-KI verwenden“. |
| Spracheingabe geht nicht | Frage tippen; im Chrome das Mikrofon in der Adressleiste erlauben. |
| Posteingang schon abgearbeitet | Frisches Profil oder „Demo-Daten zurücksetzen“ – die Nachrichten 118/26, Weber und Franke sind danach wieder neu. |
| Console im Server-Betrieb deaktiviert | `CONSOLE_ADMIN_PASSWORD` mit mindestens 12 Zeichen setzen, das kein Platzhalter und kein öffentliches Demo-Passwort ist; Server neu starten. |

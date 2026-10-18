# Kundenavatar Apex: Claudia Reinholz

**Claudia Reinholz, 50, Fachanwältin für Arbeitsrecht, geschäftsführende Partnerin einer kleinen Sozietät in Paderborn (fiktiv)**

Stand: 16.10.2026 · Finale Fassung für die 5 End-to-End-Testiterationen · Grundlage: Recherche in vier Linsen (Markt und Demografie, Digitalisierung und KI, Software und Wechselgründe, Arbeitsalltag), Prüfbericht zum Entwurf vom 16.10.2026, die Projektunterlagen `docs/WETTBEWERBSANALYSE.md`, `docs/WETTBEWERB-RECHERCHE.md`, `docs/MASTERPROMPT.md`, `docs/DEMO-SKRIPT.md` sowie der Codestand vom 16.10.2026.

> **Lesehilfe:** Zahlen in eckigen Klammern verweisen auf das Quellenverzeichnis (Abschnitt 10). **(S)** = eigene Schätzung oder Rechnung aus belegten Zahlen. **(A)** = Annahme für die fiktive Persona: plausibel aus den Daten abgeleitet, aber nicht belegt. **(F)** = Fachwissen, in dieser Recherche nicht am Original abgerufen; vor externer Verwendung prüfen. Name, Kanzlei und alle Mitarbeitenden sind frei erfunden; Ähnlichkeiten mit realen Personen oder Kanzleien sind nicht beabsichtigt.
>
> **Vorbehalt zur Datenlage:** Die meisten Primärquellen (brak.de, soldan.de, lto.de, beck-aktuell.de, gdv.de, gesetze-im-internet.de u. a.) waren in der Arbeitsumgebung nicht abrufbar, das Suchbudget war bei der Endprüfung erschöpft. Die Werte stammen aus Such-Auszügen dieser Seiten, aus der bereits verifizierten Projektrecherche (`docs/WETTBEWERB-RECHERCHE.md`, Abschnitt 4) und aus eigenen Nachrechnungen. Alle Daten, Wochentage, Gebühren und Zinsen in den Testszenarien sind nachgerechnet. Für Persona und Tests reicht das; vor einer externen Verwendung (Pitch, Website) sind die Marktzahlen am Original zu prüfen.

---

## Kurzfassung

1. **Wer:** Claudia Reinholz (50, fiktiv), Fachanwältin für Arbeitsrecht und geschäftsführende Partnerin von Reinholz & Hollmann in Paderborn – 3 Anwälte, 3 Mitarbeitende, eine ReFa-Stelle seit Februar 2026 unbesetzt, seit 20 Jahren RA-MICRO.
2. **Warum jetzt:** Der Kanzleiserver (Windows Server 2016) verliert am 12.01.2027 den Support, und die fehlende Fachkraft kostet sie jeden Abend Zeit. Sie sucht ein System, das Routine abnimmt, ohne Haftungsrisiko.
3. **Was sie kauft:** Fristensicherheit mit Rechenweg, eine vollständige Migration, Bedienbarkeit für ihre Büroleiterin, ehrliche Kosten über 5 Jahre und einen Menschen am Telefon. KI nur gekennzeichnet und mit ihrer Freigabe.
4. **Wie sie testet:** streng, mit Gleitsichtbrille; sie rechnet jede Frist, Gebühr und jeden Zins nach und bedient 24 Aufgaben (T00–T23) aus allen 16 Bereichen. Gemessen werden Aktionen, Fehlaktionen, Schweregrade, SEQ, SUS, UEQ-S und Schulnoten.
5. **Abnahme:** alle 24 Aufgaben ohne Hilfe, 0 offene K- und H-Befunde, alle Prüfwerte exakt, SUS ≥ 80 (Trendwert) – sonst empfiehlt sie ihrem Partner nicht den Kauf.

---

## 1. So testet der Avatar Apex

### 1.1 Rollenanweisung für den Testagenten

> Sie sind **Claudia Reinholz**, 50, Fachanwältin für Arbeitsrecht und geschäftsführende Partnerin von Reinholz & Hollmann Rechtsanwälte PartG mbB in Paderborn: 3 Anwälte, Büroleiterin Petra Schulte (58), eine ReFa in Teilzeit, eine Auszubildende, eine ReFa-Stelle seit Februar 2026 unbesetzt.
>
> Sie arbeiten seit 20 Jahren mit RA-MICRO, kennen jedes Kürzel und sind es leid: Hotline, Updates, Masken, Buchhaltung. Sie arbeiten rund 52 Stunden pro Woche und rechnen weniger als die Hälfte davon ab. Abends machen Sie die Ausgangskontrolle allein.
>
> Sie testen Apex, weil der Support Ihres Windows-Servers 2016 am 12.01.2027 endet. Ihr Partner Bernd Hollmann (61) ist skeptisch und rechnet in Fünf-Jahres-Kosten, Petra Schulte hat bei der Bedienbarkeit ein Veto.
>
> Sie sind pragmatisch und nicht technikfeindlich, aber allergisch gegen KI-Hype, Anglizismen und Werbezahlen ohne Herleitung. Fristen, beA und eEB sind für Sie Haftungsfragen. Sie rechnen jede Frist, jede Gebühr und jeden Zins nach.
>
> Sie tragen eine Gleitsichtbrille; kleine graue Schrift und Text auf durchscheinenden Flächen ärgern Sie. Sie sprechen knapp und sachlich, siezen und erwarten, gesiezt zu werden.
>
> Sie denken laut, sind ehrlich statt höflich und ungeduldig bei Umwegen. Sie bedienen nur die Oberfläche und bewerten nach dem Raster in Abschnitt 1.8.
>
> **Wichtig:** Die Persona-Details und O-Töne (Abschnitt 9) sind Beispiele, keine Pflicht. Bewertet wird das beobachtete Verhalten der Software, nicht die Rolle. Übertreiben Sie die Rolle nicht.

### 1.2 Zugänge und Testumgebung

| Was | Wert |
|---|---|
| Start-Adresse (Dev-Server) | **http://127.0.0.1:5173** – die Testleitung startet den Dev-Server (`npm run dev` im Projektordner `/home/user/anwaltapex`) und öffnet die Adresse. Die Landing liegt unter `/willkommen`, die Anmeldung unter `/login`. |
| **Testzugang der Persona** (Präsentationszugang) | Kanzlei **Hartmann & Partner Rechtsanwälte (Berlin)** · E-Mail `julia.hartmann@hartmann-partner.de` · Passwort `Apex-Demo-2026`. Claudia meldet sich als **Dr. Julia Hartmann, Rechtsanwältin und Fachanwältin für Arbeitsrecht, Partnerin** an – stellvertretend für sich selbst. Diese Demo-Nutzerin passt in Fachgebiet und Rolle zu ihr. |
| ReFa-Perspektive (nur T22) | Im selben Präsentationszugang: `mia.becker@hartmann-partner.de` · `Apex-Demo-2026` (Rolle ReFa). Claudia spielt hier Petra Schulte. |
| **Apex Console** (Anbieterwerkzeug, T21) | E-Mail `admin@apex-kanzlei.de` · Passwort `Apex-Console-2026`. Damit legt der Avatar zusätzlich einen **eigenen Testzugang** an. |
| Eigener Testzugang (wird in T21 je Iteration neu angelegt) | Kanzleiname **„Reinholz & Hollmann Rechtsanwälte PartG mbB – Test I{n}“** · Stadt **Paderborn** · Bundesland **Nordrhein-Westfalen** · Hauptnutzerin **Claudia Reinholz** · E-Mail **`claudia.reinholz+i{n}@reinholz-hollmann.example`** · 7 Arbeitsplätze · Schwerpunkte Arbeitsrecht, Verkehrsrecht, Mietrecht, Familienrecht, Forderungseinzug · Testzugang bis heute + 30 Tage · mit Beispieldaten. `{n}` ist die Nummer der Iteration (1–5). Das Passwort erzeugt die Console. |
| Betriebsmodus | Die App nutzt den Server-Betrieb, wenn die API erreichbar ist, sonst den Browser-Demo-Betrieb (Daten im Browserspeicher). Die Testleitung notiert je Iteration, welcher Modus lief. Im Browser-Demo-Betrieb liegen Zugänge und Änderungen nur im Speicher dieses Browserprofils. Deshalb: alle Blöcke einer Iteration im selben Profil, jede Iteration in einem frischen Profil (bzw. Websitedaten gelöscht), damit die Demodaten neu und relativ zu „heute“ entstehen. |
| Browser | Chromium-basiert (Chrome oder Edge); Spracheingabe und -ausgabe sind laut Demo-Skript dort vorgesehen [62]. In T20 zusätzlich Safari bzw. WebKit, falls das Testwerkzeug es bietet. |

**Was im Prototyp simuliert ist** [62]: die Anbindungen an beA, E-Mail-Server und Bank, die Zeitersparnis-Werte des 38h-Motors, Teile der Fall-Datenbank (Auszug echter Leitentscheidungen) und die Demo-KI ohne Schlüssel. **Echt sind:** Fristenrechner, RVG, Zinsen, Logins und Mandantentrennung, Live-KI (falls eingerichtet), CSV-Import, Spracheingabe und -ausgabe. Claudia akzeptiert Simuliertes, **wenn es in der Oberfläche ehrlich gekennzeichnet ist**, und bewertet den Ablauf. Nicht gekennzeichnete Demozahlen gelten als Vertrauensabzug (Befund H).

**Referenzakten im Präsentationszugang** (Aktenzeichen mit dem laufenden Jahr, 2026 also „/26“):

| Akte | Inhalt | genutzt in |
|---|---|---|
| 118/26 Neumann ./. Arslan Autohaus GmbH | Urteil per beA „gegen eEB“, Berufung zum Kammergericht | T02, T03 |
| 142/26 Weber ./. Kröger Logistik GmbH | Kündigungsschutz (Bagatellkündigung), Arbeitsvertrag mit Ausschlussfrist, Gegenstandswert 10.200 €, RSV Nordlicht Rechtsschutz AG (Vers.-Nr. RS-4471209, Schaden-Nr. S26-88412 aus der Schadenmeldung des Mandanten, Deckung offen, Selbstbeteiligung 150 €), Mandantenportal aktiv | T04, T05, T06, T17, T19, T23 |
| 151/26 Ostermann ./. Havelbrück Pflegedienste GmbH | Kündigungsschutz, Arbeitsgericht Berlin (28 Ca 11873/26), Klage per beA eingereicht (Klagefrist erledigt, mit Versandnachweis), Gegenstandswert 11.700 €, RSV Spreebogen Rechtsschutz VVaG (Deckung erteilt), Gegenseite vertreten durch Tanneberg & Sternberg Rechtsanwälte PartG mbB; Gütetermin drei Tage nach „heute“ (auf den nächsten Werktag verschoben) um 9:00 Uhr, Magdeburger Platz 1, Saal 3; Kündigungsschreiben, Klageschrift und Ladung als PDF; Mandantenportal aktiv | T14 |
| 152/26 Engelke ./. Stadtwerke Spreetal GmbH, 153/26 Rehbein ./. Wohnungsgenossenschaft Marzahn-Ost eG, 154/26 Vossberg ./. Reiseveranstalter Sonnenkap GmbH | außergerichtlich, Deckungszusage der RSV liegt vor – zusammen mit 151/26 vier RSV-Akten für die Sammelabrechnung | T07, T22 |
| 126/26 Berger Haustechnik GmbH ./. Lenz | Forderungskonto, Vollstreckung | T09 |
| 137/26 Schneider ./. Lindenhof Hausverwaltung GmbH | Mietrecht, gerichtlich | T20, T23 |
| 131/26 Yilmaz ./. Elbtal Versicherung AG | Verkehrsunfall, Fremdgeld; „Fremdgeld an Mandantin weiterleiten“ ist eine heute fällige **Wiedervorlage** von Mia Becker (keine Frist – zählt nicht als „Frist heute“) | T08, T22 |

**Daten relativ zu „heute“:** Die Demodaten werden täglich relativ zum aktuellen Datum erzeugt [62]. Datumsprüfungen an Demodaten erfolgen daher gegen den angezeigten Rechenweg und das Zustellungsdatum im eEB, nicht gegen feste Kalenderdaten. Feste Prüfwerte (T04, T07, T09, T18) gibt die Persona mit den dort genannten Daten selbst ein.

**Namensregel gegen Verwechslungen:** In den Demodaten gibt es einen Anwalt „Jonas Brandt“, eine Mandantin „Elif Yilmaz“, die Gegnerkanzlei „Dr. Kessler & Kollegen“ und den Nachnamen „Köhler“. Die Kolleginnen und Kollegen der Persona heißen deshalb **Hollmann, Kaplan, Pohl, Schulte und Brinkmann**. Wer in der Oberfläche „Brandt“ liest, sieht den Demo-Anwalt, nicht Claudias Partner. In T23 steht Jonas Brandt ausdrücklich stellvertretend für Hollmanns Dezernat.

### 1.3 Viewports und Modi

Die Testleitung stellt den Viewport ein; gemeint ist immer der innere Fensterbereich in CSS-Pixeln (`innerWidth × innerHeight`) bei Browser-Zoom 100 %, sofern nichts anderes steht.

| Kürzel | Gerät der Persona | Viewport | Einsatz |
|---|---|---|---|
| **D** | Büro-PC, 24-Zoll-Monitor Full HD | **1440×900** | Standard für Schreibtisch-Aufgaben |
| **L** | 14-Zoll-Laptop (Homeoffice, Zug, abends); Petras PC mit 125 % Zoom | **1366×768** | strengster Desktop-Fall |
| **Tq** | Kanzlei-iPad quer (Besprechung, Termin) | **1024×768** | Tablet-Layout |
| **Th** | Kanzlei-iPad hoch | **768×1024** | Tablet-Layout, Lesen |
| **M** | iPhone 14, Safari | **390×844** | Gericht, unterwegs |

**Modi:** hell ist Standard. **Dunkel** gilt für T15 in jeder Iteration, für T01 zusätzlich in jeder Iteration und für alle Aufgaben in Iteration 4.

**Warum diese Größen (S):** Ihr Full-HD-Monitor zeigt bei 110 % Zoom nach Abzug der Browserleisten etwa 1745×870 CSS-px, ihr Laptop (1536×864 bei 125 % Skalierung) etwa 1536×760 CSS-px. Die Test-Viewports sind bewusst kleiner: Was bei 1440×900 und 1366×768 passt, passt auch an ihren echten Geräten.

**Zusatzproben nur in Iteration 4:** 200 % Textgröße bzw. Browser-Zoom 200 % auf D (WCAG 1.4.4) und Reflow bei 320 CSS-px Breite (Viewport 320×640, entspricht 1280 px bei 400 %, WCAG 1.4.10) [65]. Der Masterprompt sagt Responsivität erst ab 360 px zu; ein Befund ist dort zu erwarten.

### 1.4 Ablauf einer Iteration (entlang der Kundenreise)

| Block | Zugang | Aufgaben in dieser Reihenfolge |
|---|---|---|
| **0 – Nachtest** (ab Iteration 2) | je nach Befund | Alle offenen Befunde der Vorrunde prüfen: behoben · teilweise · nicht behoben (mit Befund-ID). |
| **A – Erstkontakt** | ohne Anmeldung, dann Apex Console, dann eigener Testzugang | **T00** Landing → **T21** Apex Console (Rollenwechsel) → **T16** erste Anmeldung im eigenen Testzugang → **T18 Fall 3b** (Gerichtsort-Probe NRW) → abmelden |
| **B – Alltag** | Präsentationszugang Julia Hartmann | **T01 → T15** in Nummernfolge → **T17** → **T18** (Fälle 1, 2, 3a, 4, 5) → **T19** → **T20** → **T23** |
| **C – Petras Vormittag** | Mia Becker (ReFa) | **T22** |
| **D – Abschluss** | – | Fragebögen (SUS, UEQ-S, Schulnoten, Gesamturteil; in Iteration 5 zusätzlich die Preisfragen), Feedback-Datei nach Vorlage 1.11 |

**Volle Iteration heißt:** alle 24 Aufgaben, alle Fragebögen, alle für diese Iteration vorgesehenen Zusatzproben (Abschnitt 1.10). Fällt eine Aufgabe aus technischen Gründen aus, wird sie mit Grund als „nicht prüfbar“ vermerkt und in derselben Iteration nachgeholt, sobald der Grund behoben ist.

### 1.5 Abdeckung: alle 16 Bereiche

| # | Bereich (Route) | Aufgaben |
|---|---|---|
| 1 | Landing (`/willkommen`) | T00 |
| 2 | Login und Testzugang (`/login`) | T16; Anmeldung vor jedem Block |
| 3 | Cockpit (`/cockpit`) mit KI-Briefing und Apex Island | T01, T15 |
| 4 | Akten (`/akten`, `/akten/:id`): Liste, Mandatsaufnahme, E-Akte, Fristen, Beteiligte, Aktenkonto, Verlauf, Mandantenportal | T04, T05, T14, T23 |
| 5 | Kontakte (`/kontakte`) | T17, T04 |
| 6 | Posteingang (`/posteingang`): beA und E-Mail | T02, T03, T22 |
| 7 | Fristen (`/fristen`): Kalender, Vier-Augen-Kontrolle, Fristenrechner | T03, T15, T18 |
| 8 | Apex KI (`/ki`): Fallanalyse, Dokument-Analyse, Schriftsatz | T06, T19 |
| 9 | Fall-Datenbank (`/fall-datenbank`) | T06 |
| 10 | 38h-Motor (`/automatisierung`) | T10 |
| 11 | Abrechnung (`/abrechnung`): RVG-Rechner, Rechnungen, Storno, Sammelabrechnung, Zeiterfassung, Bankabgleich, Forderungskonto | T07, T08, T09, T22 |
| 12 | Umzug (`/umzug`) | T11 |
| 13 | Hilfe & Support (`/hilfe`): Wiki, Schnellhilfe „?“, Systemstatus, geprüfte Updates, Ansprechpartnerin | T12 |
| 14 | Einstellungen (`/einstellungen`): Kanzlei, Team, Lizenz, KI, Darstellung, Datenschutz | T13, T16 |
| 15 | Apex Assistent (Kugel unten rechts; Text und Sprache) | T20, T12 |
| 16 | Apex Console (`/console`) | T21 |
| – | Querschnitt: globale Suche Strg+K, Navigation (Seitenleiste, Tablet-Leiste, mobile Tab-Leiste), Meldungen, Dunkelmodus, Tastatur, Barrierefreiheit | T06, T14, T15, T22; Iteration 4 für alle |

### 1.6 Testszenarien T00–T23

**Zählregeln für alle Aufgaben:**

- **Aktion** = ein Klick oder Tap, eine Tastenkombination oder ein ausgefülltes Eingabefeld (das Tippen in ein Feld zählt als 1). Scrollen, Lesen und Warten zählen nicht.
- **Fehlaktion** = eine Aktion, die nicht zum Ziel führt oder zurückgenommen werden muss. **Umweg** = eine Folge von Fehlaktionen, nach der sie auf den richtigen Weg zurückfindet.
- **Max. Aktionen** = der Sollpfad aus Sicht der Persona (A). Die Testleitung ermittelt in Iteration 1 zusätzlich den tatsächlich kürzesten Pfad und trägt ihn als Referenz ein.
- **Bestanden** = das **Erfolgskriterium** ist erfüllt, und zwar ohne Hilfe. Schnellhilfe oder Assistent zählen als Hilfe, außer die Aufgabe verlangt sie.
- **Prüfpunkte** werden einzeln als ja/nein oder Zahl erfasst und als „x von y erfüllt“ zusammengefasst.
- **Richtwert Mensch** = geschätzte Dauer für eine geübte Nutzerin (A). Er dient nur zur Einordnung, nicht als Messgröße (siehe 1.7).
- **Löschproben** gehen nur bis zur Sicherheitsabfrage und werden dort abgebrochen. Wird ohne Abfrage gelöscht, ist das ein K-Befund, und die Testleitung setzt die Demodaten zurück.

---

#### Block A – Erstkontakt

#### T00 · Landing: der erste Eindruck

*Bereich:* Landing · *Zugang:* ohne Anmeldung · *Viewport:* D, danach M · *Richtwert Mensch:* 3 Min.

**Situation:** Ein Kollege aus ihrem Arbeitsrechts-Netzwerk hat ihr den Link geschickt. Sie hat 5 Minuten zwischen zwei Mandanten.

**Aufgabe:** Die Seite öffnen und 5 Sekunden ansehen. Dann suchen: Preismodell (einmalig, und was kostet die Wartung?), Datenstandort, Impressum, Kontakt mit echten Menschen, „Testzugang anfordern“. Die Zahlenaussagen und den Vergleich mit klassischer Kanzleisoftware lesen.

**Erfolgskriterium:** Nach 5 Sekunden sagt sie in einem Satz zutreffend, was Apex ist, **und** sie findet alle 5 Ziele in je ≤ 2 Aktionen (5 von 5).

**Prüfpunkte:**
- Jede Zahlenaussage (z. B. „38 Std.“, „36.000 €“) hat eine sichtbare Herleitung oder ist als Beispiel gekennzeichnet (ja/nein je Aussage).
- Der Vergleich ist sachlich, nennt keine Wettbewerber beim Namen und behauptet nichts, was die Seite nicht belegt (§ 6 UWG, (F)) (ja/nein).
- M: kein horizontales Scrollen; Hauptbotschaft und „Testzugang anfordern“ sind ohne Scrollen bzw. nach 1 Wischbewegung sichtbar (ja/nein).
- Anglizismen und Marketingwörter ohne Not (Anzahl).

#### T21 · Apex Console: eigenen Testzugang anlegen (Rollenwechsel)

*Bereich:* Apex Console · *Zugang:* `admin@apex-kanzlei.de` / `Apex-Console-2026` · *Viewport:* D · *Richtwert Mensch:* 4 Min.

**Situation:** Nach der Online-Demo legt die Kundenbetreuerin Lena Vogt den Testzugang gemeinsam mit Claudia an. Der Agent bedient die Console als Lena Vogt; Claudia sitzt daneben und prüft Verständlichkeit und Datenschutz.

**Aufgabe:** In der Console anmelden. „Neuen Testzugang anlegen“ wählen und die Daten aus Abschnitt 1.2 eintragen. Danach für diesen neuen Zugang einmal „Neues Passwort erzeugen“ ausführen (falls angeboten; sonst „nicht vorhanden“ vermerken) und erst dann Einladungstext und Passwort kopieren. Die Präsentationskanzleien werden weder zurückgesetzt noch verändert.

**Erfolgskriterium:** Der Testzugang ist angelegt und Einladungstext plus Passwort sind kopiert, in ≤ 18 Aktionen und ohne eine Fehlermeldung, die nicht Ursache und nächsten Schritt nennt.

**Prüfpunkte:**
- Wird Nordrhein-Westfalen aus „Paderborn“ automatisch erkannt? Wenn nein: Erscheint ein verständlicher Hinweis, das Bundesland zu prüfen (ja/nein)?
- Der Einladungstext enthält Anmeldeadresse, E-Mail, Ansprechpartnerin mit Durchwahl und das Testende; das Kopieren wird bestätigt (4 von 4 Angaben).
- „Neues Passwort erzeugen“ erklärt, dass die Kanzlei das sieht und beim nächsten Anmelden ein eigenes Passwort festlegen muss (ja/nein). Ob die Kanzlei es tatsächlich im Protokoll sieht, prüft T16.
- **Datenschutz (K-Probe):** Zeigt die Console Akteninhalte, Dokumente oder Mandantennamen einer Kanzlei? Erwartet: nein; ein Ja ist ein K-Befund. Nutzer- und Aktenzahlen sind in Ordnung.
- Claudia kann danach in 2 Sätzen sagen, was der Anbieter über ihre Kanzlei sieht und was nicht (ja/nein).

#### T16 · Erste Anmeldung im eigenen Testzugang

*Bereich:* Login und Testzugang, Einstellungen · *Zugang:* Daten aus T21 · *Viewport:* L · *Richtwert Mensch:* 3 Min.

**Aufgabe:** Mit E-Mail und Passwort aus der Einladung anmelden und ein eigenes Passwort festlegen. Dabei zuerst zwei Fehlerfälle provozieren: ein zu kurzes Passwort und eine abweichende Wiederholung. Danach abmelden, einmal ein falsches Passwort eingeben, richtig anmelden. Kurz die Beispieldaten ansehen (die ersten 10 Akten) und in Einstellungen → Lizenz das Testende prüfen.

**Erfolgskriterium:** Von der Einladung bis zum Cockpit mit eigenem Passwort in ≤ 8 Aktionen (ohne die provozierten Fehlerfälle), **und** jede der 3 Fehlermeldungen nennt Ursache und nächsten Schritt (3 von 3).

**Prüfpunkte:**
- Passwort einfügen (Strg+V) und Ausfüllen durch einen Passwort-Manager sind möglich (WCAG 3.3.8) (ja/nein).
- MFA wird angeboten (ja/nein; nein = Befund H mit Vermerk „Prototyp“, der Masterprompt sieht MFA vor).
- Einstellungen → Lizenz zeigt „Testzugang bis …“ mit dem Datum aus T21 (ja/nein).
- Das in T21 vom Anbieter erzeugte Passwort steht für die Kanzlei sichtbar im Protokoll (ja/nein).
- Gerichte der Beispieldaten passen zum Kanzleisitz (ArbG Paderborn, LAG Hamm, LG Paderborn, OLG Hamm): Zahl falscher Gerichtsorte in den ersten 10 Akten.
- Abmelden in ≤ 2 Aktionen; nach dem Abmelden zeigt Browser-Zurück keine Kanzleidaten (ja/nein).

#### T18 Fall 3b · Gerichtsort-Probe im eigenen Zugang (NRW)

Wird hier im eigenen Paderborner Zugang ausgeführt; Beschreibung und Prüfwert stehen bei T18.

---

#### Block B – Alltag als Julia Hartmann

#### T01 · Morgenroutine im Cockpit

*Bereich:* Cockpit, Apex Island · *Viewport:* D hell, zusätzlich D dunkel · *Richtwert Mensch:* 1 Min.

**Situation:** Dienstag, 7:20 Uhr. Um 8:45 Uhr ist Gütetermin.

**Aufgabe:** Erfassen, was heute brennt: Fristen und Notfristen, Termine, neue Nachrichten, Status von beA und E-Mail.

**Erfolgskriterium:** Sie nennt mit 0 Aktionen und **ohne Scrollen** (D 1440×900) die Zahl der heute fälligen Fristen einschließlich Notfristen, die heutigen Termine, die Zahl neuer Nachrichten und den beA-Status. Alle 4 Angaben stimmen mit den Detailansichten überein (4 von 4).

**Prüfpunkte:**
- Notfristen sind von Vorfristen durch Farbe **und** Text oder Symbol unterscheidbar, auch in der Farbfehlsicht-Simulation (Iteration 4) (ja/nein).
- Das KI-Briefing ist als KI gekennzeichnet; seine Zahlen decken sich mit den Karten (Zahl der Abweichungen).
- **Apex Island:** verdeckt weder Inhalt noch Tastaturfokus (WCAG 2.4.11) (ja/nein); höchstens 1 Bewegung je 60 Sekunden im Blickfeld (gezählte Bewegungen in 3 Minuten); in ≤ 2 Aktionen abschaltbar (ja/nein); bei „reduzierte Bewegung“ ohne Animation (Iteration 4) (ja/nein); der Name erklärt sich per Text oder Tooltip (ja/nein).
- Dunkel: dieselben 4 Angaben sind ohne Anstrengung lesbar, keine grellen Flächen (ja/nein).

#### T02 · beA-Posteingang mit Urteil

*Bereich:* Posteingang · *Viewport:* D · *Richtwert Mensch:* 3 Min.

**Situation:** Im Posteingang liegt „28 O 211/25 – Neumann ./. Arslan Autohaus GmbH – Zustellung Urteil gegen eEB“, eine Zivilsache aus einem anderen Dezernat. Normalerweise bereitet Petra den Posteingang vor; wegen der offenen Stelle übernimmt Claudia frühmorgens die Erstsichtung.

**Aufgabe:** Nachricht lesen, Aktenzuordnung prüfen, Zusammenfassung mit dem Urteilstext abgleichen, Fristvorschläge prüfen.

**Erfolgskriterium:** Die Nachricht ist der Akte 118/26 zugeordnet, mit sichtbarer Begründung (Gerichtsaktenzeichen), **und** beide Fristen sind vorgeschlagen – Berufung 1 Monat (§ 517 ZPO) und Berufungsbegründung 2 Monate (§ 520 Abs. 2 S. 1 ZPO), jeweils ab Zustellung und mit Rechenweg. Bis zur Ansicht beider Rechenwege braucht sie ≤ 3 Aktionen.

**Prüfpunkte:**
- Die Zusammenfassung ist als KI erkennbar und deckt sich mit dem Urteil: Klage überwiegend erfolgreich (14.250,00 € Zug um Zug gegen Rückgabe des Fahrzeugs), Abweisung der Nutzungsentschädigung (4.650,00 €), Kosten 25 % Kläger / 75 % Beklagte (Zahl der Abweichungen).
- Klar erkennbar: „Die KI erkennt, der Rechenkern berechnet“ (ja/nein).
- Das Berufungsgericht (Kammergericht) wird erkannt; der Rechenweg nennt die Feiertage am Gerichtsort Berlin (ja/nein).
- Eine Nachricht lässt sich in ≤ 3 Aktionen von Hand einer anderen Akte zuordnen und zurück (ja/nein); gibt es eine Nachricht ohne passende Akte, lässt sich daraus eine Akte anlegen (ja/nein/nicht vorhanden).
- Petras Blick: „Kann Frau Schulte das ohne Schulung?“ (ja/nein, mit Grund).

#### T03 · Frist übernehmen, eEB abgeben, Vier-Augen-Kontrolle

*Bereich:* Posteingang, Fristen · *Viewport:* D · *Richtwert Mensch:* 2 Min.

**Aufgabe:** Die Fristen aus T02 übernehmen, dann das eEB abgeben, dann im Fristenkalender die Vier-Augen-Freigabe erteilen.

**Erfolgskriterium:** „eEB abgeben“ ist vor der Fristübernahme gesperrt, mit verständlichem Grund, und danach aktiv; die Fristübernahme braucht ≤ 2 Aktionen; nach der Abgabe gibt es einen Protokolleintrag mit Wer, Wann, Zustellungsdatum und erstem Lesezeitpunkt (4 von 4 Angaben).

**Prüfpunkte:**
- **Fristbeginn ist das im eEB angegebene Zustellungsdatum.** Rechenweg und Datum erst nach der Abgabe prüfen. Weicht das Zustellungsdatum vom Eingangsdatum ab, wird neu berechnet oder ein Hinweis erscheint. Fehlt beides: K-Befund.
- Im Kalender stehen Frist und Vorfrist; die Vorfrist liegt nicht auf einem Wochenende oder Feiertag (ja/nein).
- Der Status „zu kontrollieren“ lässt sich mit 1 Aktion freigeben; Korrekturen sind möglich und werden protokolliert (ja/nein).
- Ein Doppelklick auf „eEB abgeben“ erzeugt keine doppelte Abgabe (ja/nein).

#### T04 · Neue Mandatsanfrage Kündigungsschutz mit Kollisionsprobe

*Bereich:* Akten (Mandatsaufnahme), Kontakte, Fristen · *Viewport:* L · *Richtwert Mensch:* 10 Min.

**Situation:** Herr Martin Oberhaus (fiktiv), Bruttomonatsentgelt 3.800 €, rechtsschutzversichert bei der Nordlicht Rechtsschutz AG (aus den Demodaten), Selbstbeteiligung 150 €. Die Kündigung der „Nordwerk Fördertechnik GmbH“ (fiktiv) ging ihm am **Samstag, 10.10.2026** zu. **Zusatzprobe:** Kurz darauf fragt die **Kröger Logistik GmbH** an, ob die Kanzlei sie in einem arbeitsrechtlichen Streit vertritt.

**Aufgabe:** Akte anlegen, Kollisionsprüfung, Klagefrist, RSV-Daten und Deckungsanfrage, Mandatsunterlagen. Danach die Anfrage von Kröger prüfen.

**Erfolgskriterium:** Die Akte ist ohne Hilfe in ≤ 25 Aktionen angelegt, **und** die Klagefrist nach § 4 KSchG wird mit **Montag, 02.11.2026** vorgeschlagen, mit sichtbarem Rechenweg.

**Prüfwerte (nachgerechnet):**
- Fristbeginn § 187 Abs. 1 BGB; 3 Wochen ab Sa 10.10.2026 enden rechnerisch am Sa 31.10.2026; nach § 193 BGB (bzw. § 222 Abs. 2 ZPO) verschiebt sich das Ende auf den nächsten Werktag, **Mo 02.11.2026**. Der 31.10. (Reformationstag) ist in NRW und Berlin kein Feiertag und ohnehin ein Samstag; der 01.11.2026 ist ein Sonntag. Das Ergebnis gilt deshalb in allen Bundesländern.
- Gegenstandswert **11.400 €** = Vierteljahresentgelt (3 × 3.800 €), Höchstwert nach § 42 Abs. 2 S. 1 GKG [33].

**Prüfpunkte:**
- Hinweis nach § 12a ArbGG (keine Kostenerstattung in der 1. Instanz) ist vorhanden (ja/nein).
- RSV: Versicherer, Versicherungsnummer und Selbstbeteiligung sind erfassbar (ja/nein); ein Entwurf der Deckungsanfrage entsteht (ja/nein); die Schadennummer lässt sich nachtragen, sobald die Deckungszusage kommt (ja/nein); ein Kostenvorschuss nach § 9 RVG an den Versicherer lässt sich anfordern (ja/nein); ein elektronischer Weg zum Versicherer (z. B. drebis) ist vorhanden oder ehrlich als „nicht angebunden“ benannt (ja/nein).
- **Kollision (K-Probe):** Bei Kröger Logistik warnt das System **vor** der Aktenanlage mit dem Treffer „Gegner in 142/26 Weber ./. Kröger Logistik GmbH“ und verlangt eine bewusste Entscheidung mit Vermerk (§ 43a Abs. 4 BRAO, § 3 BORA) [33]. Fehlt die Warnung: K-Befund.
- Die Tab-Reihenfolge ist logisch, Pflichtfelder sind erkennbar; ein Abbruch mitten in der Maske fragt nach und hinterlässt nichts halb Gespeichertes (je ja/nein).

#### T05 · E-Akte aufräumen und schreiben

*Bereich:* Akten (E-Akte, Verlauf) · *Viewport:* D · *Richtwert Mensch:* 3 Min.

**Aufgabe:** In Akte 142/26 ein Dokument umbenennen, 3 Dokumente in den Ordner „Gericht“ verschieben, in der Akte nach „Bruchware“ suchen und dem Mandanten eine E-Mail aus der Akte schicken.

**Erfolgskriterium:** Jede der 4 Teilaufgaben gelingt mit ≤ 3 Aktionen (Texteingaben nicht mitgezählt), **und** nach dem Versand ist sie noch in der Akte, und die E-Mail steht im Verlauf (4 von 4 plus ja).

**Prüfpunkte:**
- Verschieben geht auch **ohne Ziehen** (z. B. „Verschieben nach …“) mit ≤ 3 Aktionen (WCAG 2.5.7) (ja/nein); Mehrfachauswahl per Tastatur (Umschalt/Strg) (ja/nein).
- Die Suche markiert die Treffer im Dokument (ja/nein).
- Erkennbar ist, dass Vorschau und Versand dieselbe Datei bzw. Version sind (ja/nein).
- Umbenennen und Verschieben lassen sich rückgängig machen (ja/nein).
- In Akte oder Notiz gibt es eine Diktat- bzw. Spracheingabe (ja/nein; nein = Befund M „Erwartung der Persona“).

#### T06 · Fallanalyse, Fall-Datenbank und Suche

*Bereich:* Apex KI (Fallanalyse), Fall-Datenbank, globale Suche · *Viewport:* D · *Richtwert Mensch:* 6 Min.

**Aufgabe:** Für 142/26 die KI-Fallanalyse starten, Quellen prüfen, den Entwurf in die E-Akte speichern. Danach mit Strg+K nach „pfandbon kündigung“ suchen und in der Fall-Datenbank nach Bagatellkündigungen recherchieren.

**Erfolgskriterium:** Keine erfundene Fundstelle: **100 %** der zitierten Entscheidungen lassen sich öffnen und zeigen Gericht, Datum und Aktenzeichen (Quote x von y), darunter BAG 2 AZR 541/09 („Emmely“).

**Prüfpunkte:**
- Die Erfolgsaussicht nennt ≥ 3 benannte Faktoren mit Quelle, und Claudia kann sie in 2 Sätzen wiedergeben (ja/nein).
- Der Entwurf wird als Entwurf in der E-Akte gespeichert, nicht versendet (ja/nein).
- KI-Kennzeichnung und Hinweis zur Datenverarbeitung sind sichtbar (ja/nein).
- Strg+K liefert Treffer aus Akten, Dokumenten und Rechtsprechung; die angezeigte Antwortzeit liegt unter 1 Sekunde (Wert); ein Zitat lässt sich in Zitierform kopieren (ja/nein).
- Die Abdeckung der Fall-Datenbank (Gerichte, Stand, Anzahl) ist in der Ansicht genannt (ja/nein); LAG- und ArbG-Entscheidungen sind enthalten oder ehrlich als nicht enthalten benannt (ja/nein).

#### T07 · Abrechnung: RVG, Storno, Sammelabrechnung, Zeithonorar, E-Rechnung

*Bereich:* Abrechnung (RVG-Rechner, Rechnungen, Sammelabrechnung, Zeiterfassung) · *Viewport:* D · *Richtwert Mensch:* 8 Min.

**Situation:** Der Fall Oberhaus aus T04 wurde im Gütetermin verglichen; Auftrag nach dem 01.06.2025. Fehlt die Akte Oberhaus, nimmt sie 142/26 Weber: 10.200 € liegen in derselben Wertstufe (bis 13.000 €), die Prüfwerte sind identisch.

**Aufgabe:**
1. Kostennote: Gegenstandswert 11.400 €, VV 3100 (1,3), 3104 (1,2), 1003 (1,0), 7002, 19 % USt; Selbstbeteiligung 150 € getrennt ausweisen.
2. Zweiter Prüfsatz: dieselbe Rechnung mit Auftrag vor dem 01.06.2025 (Tabelle 2021).
3. Eine Rechnung stornieren und korrigieren.
4. Monatsende: 4 RSV-Akten in einem Durchgang abrechnen.
5. Arbeitgebermandat: 1,5 Std. zu 240 €/Std. (Vergütungsvereinbarung) erfassen und als E-Rechnung abrechnen.

**Erfolgskriterium:** Beide Prüfsätze stimmen auf den Cent (**16 von 16 Werten**):

| Position | Tabelle 2025 (Auftrag ab 01.06.2025) | Tabelle 2021 (Auftrag vor 01.06.2025) |
|---|---|---|
| 1,0-Gebühr bei 11.400 € | 707,00 € | 666,00 € |
| VV 3100 (1,3) | 919,10 € | 865,80 € |
| VV 3104 (1,2) | 848,40 € | 799,20 € |
| VV 1003 (1,0) | 707,00 € | 666,00 € |
| VV 7002 | 20,00 € | 20,00 € |
| netto | 2.494,50 € | 2.351,00 € |
| USt 19 % | 473,96 € | 446,69 € |
| brutto | **2.968,46 €** | **2.797,69 €** |

Quellen der Tabellenwerte: § 13 RVG mit Anlage 2 in der Fassung des KostBRÄG 2025 (10.000 € → 652,00 €, verifiziert; je weitere angefangene 3.000 € + 55 €) und in der Fassung 2021 (10.000 € → 614,00 €; je weitere angefangene 3.000 € + 52 €, (F)) [63, 64]; Nr. 7002 unverändert höchstens 20 € [63]. Beträge nachgerechnet (S).

**Prüfpunkte:**
- Die Fassung (2025/2021) wird angezeigt und nach dem Auftragsdatum begründet (§ 60 RVG) (ja/nein).
- Die Selbstbeteiligung ist getrennt ausgewiesen: Der Versicherer zahlt den Rest, die 150 € trägt der Mandant (ja/nein).
- Ein Storno erzeugt eine Stornorechnung bzw. Gegenbuchung und löscht nichts (ja/nein).
- Die Sammelabrechnung läuft für 4 Akten in einem Durchgang mit Vorschau, in ≤ 8 Aktionen (ja/nein).
- Zeiterfassung: Die 1,5 Std. erscheinen auf der Rechnung mit **360,00 € netto, 68,40 € USt, 428,40 € brutto**. Der vereinbarte Satz (240 €) lässt sich statt des Nutzer-Stundensatzes (bei Julia Hartmann 280 €) verwenden (ja/nein).
- Die E-Rechnung ist als XRechnung oder ZUGFeRD wählbar, mit Hinweis auf die Ausstellungspflicht im Inland B2B ab 01.01.2027 bei Vorjahresumsatz über 800.000 €, sonst ab 01.01.2028 (F) [72] (ja/nein).
- Petras Blick: „Kann Frau Schulte das ohne Schulung?“ (ja/nein, mit Grund).

#### T08 · Bankabgleich und Fremdgeld

*Bereich:* Abrechnung (Bankabgleich, Aktenkonto) · *Viewport:* L · *Richtwert Mensch:* 4 Min.

**Situation:** Freitagnachmittag im Homeoffice. Unter den Umsätzen ist eine Zahlung, die der Mandantschaft zusteht – in den Demodaten die Versicherungsleistung in Akte 131/26 Yilmaz. In ihrer eigenen Kanzlei wäre das typischerweise eine Abfindung des Arbeitgebers.

**Aufgabe:** Abgleich starten, eine unsichere Zuordnung von Hand korrigieren, die Fremdgeldzahlung erkennen und die Weiterleitung anstoßen.

**Erfolgskriterium:** 0 Buchungen mit niedriger Sicherheit werden ohne Bestätigung gebucht, **und** 100 % der automatischen Buchungen zeigen ihren Grund (Sicherheitsgrad und Merkmal).

**Prüfpunkte:**
- Jede automatische Buchung lässt sich rückgängig machen (ja/nein).
- Die Korrektur einer unsicheren Zuordnung gelingt in ≤ 4 Aktionen (ja/nein).
- Fremdgeld ist getrennt markiert, mit dem Hinweis auf unverzügliche Weiterleitung (§ 43a Abs. 7 BRAO, § 4 BORA) [33] (ja/nein).
- Petras Blick (ja/nein, mit Grund).

#### T09 · Forderungskonto und Zinsen

*Bereich:* Abrechnung (Forderungskonto) · *Viewport:* D · *Richtwert Mensch:* 5 Min.

**Aufgabe:** In Akte 126/26 Berger Haustechnik GmbH ./. Lenz Zinsen, Teilzahlung und Forderungsaufstellung prüfen; einen Zinszeitraum von Hand nachrechnen. Falls ein frei bedienbarer Zinsrechner vorhanden ist, zusätzlich die Prüfwerte unten eingeben.

**Erfolgskriterium:** Ein Zinszeitraum aus dem Forderungskonto lässt sich von Hand nachrechnen (Betrag × Satz × Tage / 365) mit **0,00 € Abweichung**, **und** der Satzwechsel zum **01.07.2026** ist berücksichtigt: Basiszins 1,27 % bis 30.06.2026, **1,52 % ab 01.07.2026** [78]; Verzugszins damit 6,27 % → **6,52 %** (§ 288 Abs. 1 BGB) bzw. 10,27 % → **10,52 %** (§ 288 Abs. 2 BGB).

**Prüfwerte (nachgerechnet, Tage/365):**

| Fall | Rechnung | Ergebnis |
|---|---|---|
| A – Geschäftsverkehr | 5.000 € × 10,52 % × 30 Tage (01.07.–30.07.2026) | **43,23 €** |
| B – Verbraucher | 5.000 € × 6,52 % × 30 Tage (01.07.–30.07.2026) | **26,79 €** |
| C – über die Halbjahresgrenze | 5.000 € Geschäftsverkehr, 16.06.–15.07.2026: 15 Tage × 10,27 % + 15 Tage × 10,52 % | 21,10 € + 21,62 € = **42,72 €** |

**Prüfpunkte:**
- Die verwendete Tageszählung wird angezeigt (ja/nein).
- Erkennbar ist, ob § 288 Abs. 1 (5 Prozentpunkte) oder Abs. 2 BGB (9 Prozentpunkte, Geschäftsverkehr ohne Verbraucher) angewandt wird (ja/nein).
- Die Teilzahlung wird nach § 367 BGB verrechnet: Kosten, dann Zinsen, dann Hauptforderung (ja/nein).
- Die 40-€-Pauschale (§ 288 Abs. 5 BGB) erscheint nur, wo sie zulässig ist – nicht gegenüber Verbrauchern und nicht im Arbeitsrecht (BAG 8 AZR 26/18) [33] (ja/nein).
- Die Forderungsaufstellung hat eine Vorschau (ja/nein).

#### T10 · 38h-Motor verstehen

*Bereich:* 38h-Motor · *Viewport:* L · *Richtwert Mensch:* 5 Min.

**Situation:** Ihr Partner Hollmann fragt: „Was macht das Ding eigentlich?“

**Aufgabe:** Drei Automatiken verstehen, nachvollziehen, wie die Ersparnis gemessen wird, den Rechner mit eigenen Zahlen füllen (7 Arbeitsplätze, ReFa-Vollkosten ~50.000 € (S), 240 €/Std.) und eine Automatik abschalten.

**Erfolgskriterium:** Sie nennt eine **eigene Zahl X Std./Woche** für ihre Kanzlei, hergeleitet aus ≥ 3 Automatiken mit Minuten je Vorgang × Vorgängen pro Woche – und zwar nur aus Angaben, die die Oberfläche zeigt.

**Prüfpunkte:**
- Sie kann Hollmann in 3 Sätzen erklären, was automatisch läuft und was ihre Freigabe braucht (ja/nein).
- Demowerte sind als Beispiel gekennzeichnet (ja/nein).
- Jede Automatik zeigt Was, Wann und mit welcher Freigabe (Anteil der Automatiken).
- Der Rechner übernimmt ihre Zahlen (ja/nein).
- Eine Automatik lässt sich in ≤ 3 Aktionen abschalten, mit Bestätigung (ja/nein).
- Die Umrechnung „38 Std./Woche ≈ 36.000 €/Jahr“ ist nachvollziehbar; rechnerisch sind das ≈ 18 €/Std. bei 52 Wochen (S) (ja/nein).

#### T11 · Umzug aus RA-MICRO

*Bereich:* Umzug · *Viewport:* D · *Richtwert Mensch:* 8 Min.

**Aufgabe:** a) „RA-MICRO“ wählen und den Beispiel-Export laden; Zuordnung, Dubletten und Fristen prüfen. b) Danach die realistische Exportdatei der Testleitung importieren (Semikolon, **Windows-1252**, Umlaute, deutsches Datums- und Zahlenformat, eine Dublette, eine alte abgelegte Akte).

**Testdatei** (die Testleitung speichert den Inhalt als `ramicro-export-cp1252.csv`, z. B. mit `iconv -f UTF-8 -t WINDOWS-1252`; alle Namen fiktiv):

```
Aktennummer;Kurzrubrum;Mandant;Gegner;Sachgebiet;Angelegt am;Nächste Frist;Fristart;Gegenstandswert;Status
12/26;Müller ./. Böhm Maschinenbau;Jürgen Müller;Böhm Maschinenbau GmbH;Arbeitsrecht;12.01.2026;30.10.2026;Notfrist;11.400,00;offen
13/26;Weiß ./. Fördertechnik Senne;Anke Weiß;Fördertechnik Senne GmbH;Arbeitsrecht;02.02.2026;06.11.2026;Wiedervorlage;8.250,00;offen
14/26;Müller ./. Böhm Maschinenbau;Jürgen Müller;Böhm Maschinenbau GmbH;Arbeitsrecht;12.01.2026;30.10.2026;Notfrist;11.400,00;offen
87/18;Krüger ./. Özdemir;Hans-Jörg Krüger;Ayse Özdemir;Mietrecht;14.05.2018;;;3.600,00;abgelegt
45/25;Schäfer ./. Großmann KG;Bärbel Schäfer;Großmann KG;Forderungseinzug;03.09.2025;31.12.2026;Verjährung;2.180,50;offen
```

**Erfolgskriterium:** Nach dem Import sind Umlaute und ß in allen Feldern korrekt (**0 Zeichenfehler**), die Dublette 12/26 ↔ 14/26 wird vor dem Import gemeldet, und die 3 Fristen (nach Zusammenführung der Dublette) liegen zur Vier-Augen-Kontrolle vor.

**Prüfpunkte:**
- Vor dem Import gibt es eine Vorschau (ja/nein).
- „11.400,00“ wird als 11.400 € gelesen (nicht 11,40 €), „30.10.2026“ als 30. Oktober (je ja/nein).
- Option „nur offene Akten bzw. die letzten 6 Jahre“ (Aufbewahrung der Handakten, § 50 BRAO (F)): 87/18 lässt sich ausschließen oder als Archiv übernehmen (ja/nein).
- Klar sichtbar ist, **was nicht übernommen wird** (Dokumente, Aktenkonten, offene Posten, Wiedervorlagen, Benutzer) (ja/nein).
- Der Import lässt sich rückgängig machen (ja/nein).
- Ansprechpartnerin und Zeitplan für den echten Umzug sind sichtbar (ja/nein).

#### T12 · Störung, Hilfe und Ansprechpartnerin

*Bereich:* Hilfe & Support (Systemstatus, Schnellhilfe, Wiki, Ansprechpartnerin), Apex Assistent · *Viewport:* L · *Richtwert Mensch:* 4 Min.

**Situation:** 16:50 Uhr. Eine Berufungsbegründung zum Landesarbeitsgericht muss heute raus, die beA-Signatur klappt nicht.

**Aufgabe:** Ursache eingrenzen (beA oder Apex?), die Schnellhilfe „?“ öffnen, den Assistenten fragen: „Was mache ich, wenn das beA gestört ist und meine Berufungsbegründung zum Landesarbeitsgericht heute raus muss?“ Danach: „Und bei einer Berufung zum Oberlandesgericht?“ Zum Schluss: „Ich brauche meine Ansprechpartnerin.“

**Erfolgskriterium:** Der Assistent nennt für das Landesarbeitsgericht die richtige Norm – **§ 46g S. 3, 4 ArbGG**: Ersatzeinreichung nach den allgemeinen Vorschriften, vorübergehende Unmöglichkeit bei der Ersatzeinreichung oder unverzüglich danach glaubhaft machen (F) [69] – und für das Oberlandesgericht **§ 130d S. 2, 3 ZPO** [33]; **und** ein Mensch mit Namen, Durchwahl und Rückrufangebot ist in ≤ 2 Aktionen erreichbar.

**Prüfpunkte:**
- Der Systemstatus zeigt in ≤ 2 Aktionen, welcher Dienst gestört ist (ja/nein).
- Der Rat umfasst: Störung dokumentieren (Screenshot, Störungsmeldung der BRAK) [53] (ja/nein); der Assistent verweist nicht nur an den beA-Support (ja/nein).
- Ein Rückruf binnen 30 Minuten ist zugesagt und sichtbar (Zusage im Masterprompt) (ja/nein).
- Die Schnellhilfe öffnet an der passenden Stelle; die Wiki-Animation lässt sich pausieren (je ja/nein).
- **Bewertung:** falsche oder fehlende Norm = H; ein Rat, der zur Fristversäumung führen kann (z. B. „warten Sie, bis das beA wieder läuft“) = K.

#### T13 · Einstellungen, Team, Lizenz und Datenschutz

*Bereich:* Einstellungen (Kanzlei, Team, Lizenz, KI, Darstellung, Datenschutz) · *Viewport:* D · *Richtwert Mensch:* 6 Min.

**Situation:** Die neue ReFa fängt hoffentlich bald an.

**Aufgabe:** Sieben Dinge finden bzw. einstellen: (1) neue Nutzerin „Katrin Wiese“ (fiktiv) mit Rolle ReFa anlegen, (2) Rechte einer Auszubildenden einschränken (kein Fremdgeld, keine Lizenz-, keine Teamdaten), (3) Bundesland für Feiertage prüfen, (4) Schriftgröße, Dichte und Dunkelmodus einstellen, (5) KI-Einstellungen (Anbieter, Verarbeitungsort, Training, Offline), (6) Vertrag nach § 43e BRAO bzw. AV-Vertrag, (7) Lizenzumfang.

**Erfolgskriterium:** Jede der 7 Einstellungen ist in ≤ 3 Aktionen gefunden (**7 von 7**).

**Prüfpunkte:**
- Die Folgen einer Einstellung sind erklärt (z. B. „ReFa sieht keine Lizenzdaten“) (ja/nein); Änderungen an der Darstellung wirken sofort (ja/nein).
- KI-Anbieter, Verarbeitungsort und Trainingsverbot stehen im Klartext und stimmen mit der Zusage „EU-Verarbeitung, keine Nutzung zu Trainingszwecken“ aus dem Masterprompt überein (ja/nein; Widerspruch = H).
- Der Lizenz-Tab beantwortet: Was funktioniert **ohne Wartung** nicht mehr (beA-Schnittstelle, RVG-Änderungen, Basiszins)? Ist die Lizenz übertragbar (Fusion, Verkauf)? Gibt es eine Quellcode-Hinterlegung (Escrow)? (je ja/nein)
- MFA und automatische Sperre bei Inaktivität (je ja/nein).
- Das Bundesland ist änderbar oder es ist erklärt, warum nicht (ja/nein).
- Liste der Unterauftragnehmer und Löschkonzept sind auffindbar (je ja/nein).

#### T14 · Mobil am Gericht

*Bereich:* Akten, Fristen (mobil), Navigation · *Viewport:* M; in Iteration 3 zusätzlich Th · *Richtwert Mensch:* 3 Min.

**Situation:** 8:40 Uhr vor Saal 3, um 9:00 Uhr ist Gütetermin in 151/26 Ostermann ./. Havelbrück Pflegedienste GmbH (Arbeitsgericht Berlin). Das WLAN im Gericht ist schwach. In den Demodaten liegt der Termin drei Tage nach „heute“; die Testleitung spielt den Termintag durch.

**Aufgabe:** Akte am iPhone öffnen: Termin, Gericht und Aktenzeichen, Gegenseite, letzte Schriftsätze, Kündigungsschreiben als PDF. Nach dem Termin eine Sitzungsnotiz und eine Frist „Widerruf des Vergleichs bis …“ (Fristart „Widerrufsfrist (Vergleich)“) anlegen.

**Erfolgskriterium:** Die Akte ist in ≤ 3 Taps erreicht, **und** Sitzungsnotiz plus Widerrufsfrist sind in ≤ 10 Aktionen angelegt, ohne horizontales Scrollen.

**Prüfpunkte:**
- Termin, Gericht, Aktenzeichen, Gegenseite und letzte Schriftsätze sind sichtbar (5 von 5); das PDF ist ohne Zoom lesbar (ja/nein).
- Die wichtigsten Bedienelemente liegen im unteren Bildschirmdrittel, einhändig erreichbar (ja/nein).
- Bedienflächen sind ≥ 44 px groß (Apple-Empfehlung), mindestens aber 24 px (WCAG 2.5.8) [65]: Zahl der Unterschreitungen (misst die Testleitung).
- **Netzprobe:** Die Testleitung schaltet das Netz ab (Offline-Emulation). Die Notiz wird lokal gehalten oder es erscheint eine eindeutige Meldung; nach dem Wiederverbinden ist sie vorhanden (ja/nein; kann das Werkzeug kein Offline, „nicht prüfbar“).
- Der Termin lässt sich in den iPhone- bzw. Exchange-Kalender übernehmen (Kalenderdatei oder Abo) (ja/nein).

#### T15 · Dunkelmodus abends und Tagesabschluss

*Bereich:* Cockpit, Fristen, Posteingang, Dunkelmodus · *Viewport:* L dunkel; in Iteration 4 zusätzlich D mit 200 % · *Richtwert Mensch:* 4 Min.

**Situation:** 21:30 Uhr zu Hause am Laptop.

**Aufgabe:** Neue Post sichten; Ausgangskontrolle: „Sind alle fristgebundenen Schriftsätze von heute raus?“; Fristen für morgen prüfen.

**Erfolgskriterium:** Eine Ansicht listet alle heute fälligen Fristen mit dem Status „versandt mit Nachweis“ bzw. „offen“, und am Ende sind **0 heute fällige Fristen ohne Kennzeichnung** (BGH IV ZB 30/23: gestufte Ausgangskontrolle vor Büroschluss) [30].

**Prüfpunkte:**
- Kontrast: automatische Prüfung durch die Testleitung (axe-core je Ansicht), Text ≥ 4,5:1 auch auf Glasflächen [65] (Zahl der Verstöße).
- Keine grellen weißen Flächen; die Dokumentvorschau darf papierweiß bleiben, ist aber gedimmt oder umschaltbar (ja/nein).
- Notfrist-Rot bleibt im Dunkelmodus unterscheidbar (ja/nein).
- Die Fristen für morgen sind in ≤ 2 Aktionen sichtbar (ja/nein).
- Die Fristenliste lässt sich drucken oder als PDF speichern (ja/nein).
- Bei 1366×768 bricht das Layout nicht; fällt die App dort ins Tablet-Layout, ist das bewusst mitzubewerten (ja/nein).

#### T17 · Kontakte

*Bereich:* Kontakte · *Viewport:* D · *Richtwert Mensch:* 5 Min.

**Aufgabe:**
1. Neuen Kontakt „Senne Rechtsschutz VVaG“ (fiktiv) als Versicherung anlegen.
2. Einen zweiten Kontakt „Kröger Logistik GmbH“ anlegen wollen.
3. Mandant Thomas Weber öffnen und von dort seine Akten öffnen.
4. Die Kollisionsprüfung aus den Kontakten starten (für „Kröger Logistik GmbH“).
5. Auskunft bzw. Export der Daten von Herrn Weber erzeugen (Art. 15 DSGVO).
6. Herrn Weber löschen wollen (nur bis zur Sicherheitsabfrage).

**Erfolgskriterium:** Die Dublettenwarnung erscheint beim zweiten „Kröger Logistik GmbH“ vor dem Speichern, **und** das Löschen von Herrn Weber ist gesperrt oder mit Hinweis auf die Aufbewahrung erklärt (6 Jahre, § 50 BRAO (F)) (2 von 2).

**Prüfpunkte:**
- Der Export für Herrn Weber gelingt in ≤ 3 Aktionen (ja/nein).
- Die verknüpften Akten sind in ≤ 2 Aktionen offen (ja/nein).
- Die Kollisionsprüfung lässt sich aus den Kontakten starten (ja/nein).
- Die Kontaktart „Versicherung“ hat passende Felder (ja/nein); die Schadennummer gehört an die Akte, nicht an den Kontakt (fachlich richtig getrennt: ja/nein).

#### T18 · Fristenrechner: Monatsende, Feiertag, Bundesland, Gerichtsort, Familiensache, Vertretung

*Bereich:* Fristen (Fristenrechner, Kalender) · *Zugang:* Präsentationszugang (Fälle 1, 2, 3a, 4, 5), eigener Paderborner Zugang (Fall 3b, Block A) · *Viewport:* D · *Richtwert Mensch:* 8 Min.

**Aufgabe:** Die folgenden Fälle im Fristenrechner bzw. in einer Akte durchrechnen lassen und das Ergebnis mit den Prüfwerten vergleichen.

| Fall | Eingabe | Erwartetes Ergebnis (nachgerechnet) |
|---|---|---|
| 1 – Monatsende und Ostern | Zustellung Fr 29.01.2027; Berufung (§ 517 ZPO) und Begründung (§ 520 Abs. 2 ZPO) | Berufung: rechnerisch So 28.02.2027 (§ 188 Abs. 3 BGB) → **Mo 01.03.2027** (§ 222 Abs. 2 ZPO). Begründung: rechnerisch Mo 29.03.2027 = Ostermontag (Ostersonntag 28.03.2027) → **Di 30.03.2027** |
| 2 – Bundesland | Zustellung Mo 08.02.2027, Berufung 1 Monat | Rechnerisch Mo 08.03.2027. Gericht in **Berlin**: Internationaler Frauentag ist dort Feiertag → **Di 09.03.2027**. Gericht in **NRW**: **Mo 08.03.2027** |
| 3a – Gerichtsort (K-Probe, Präsentationszugang Berlin) | Berliner Kanzlei, Berufung zum OLG Brandenburg, Zustellung Mo 08.02.2027 | **Mo 08.03.2027** – maßgeblich ist der Feiertag am Ort des Gerichts (h. M., (F); im Kommentar zu § 222 ZPO prüfen). Verlängert die Software wegen des Kanzleisitzes auf den 09.03.: **K-Befund** |
| 3b – Gerichtsort (K-Probe, eigener Zugang NRW) | Paderborner Kanzlei, Urteil ArbG Kassel, zugestellt Fr 01.10.2027, Berufung zum Hessischen LAG (§ 66 Abs. 1 ArbGG, 1 Monat) [69] | **Mo 01.11.2027** – Allerheiligen ist in NRW Feiertag, in Hessen nicht. Verlängert die Software auf Di 02.11.2027: **K-Befund** |
| 4 – Familiensache (Deniz) | Beschwerde gegen eine Endentscheidung (§ 63 Abs. 1 FamFG, 1 Monat); Begründung in Familienstreitsachen (§ 117 Abs. 1 S. 3 FamFG, 2 Monate ab schriftlicher Bekanntgabe) (F) [70] | Regeln vorhanden (ja/nein). Fehlen sie: mindestens H, denn die Kanzlei führt Familiensachen |
| 5 – Vertretung | Abwesenheit des Partners über eine Woche eintragen bzw. Vertretung festlegen (§ 53 BRAO (F)) | Die Fristen des Abwesenden erscheinen bei Claudia (ja/nein) |

**Erfolgskriterium:** Alle Daten der Fälle 1 bis 3b stimmen exakt (**6 von 6**: 01.03.2027, 30.03.2027, 09.03.2027 [BE], 08.03.2027 [NW], 08.03.2027 [3a], 01.11.2027 [3b]), jeweils mit Rechenweg samt Norm und benanntem Feiertag.

**Prüfpunkte:**
- Bundesland bzw. Gerichtsort ist wählbar und wird im Ergebnis angezeigt (ja/nein).
- Der Rechenweg nennt den Feiertag beim Namen (ja/nein).
- Fall 4 und Fall 5 wie in der Tabelle.

#### T19 · Apex KI: Dokument-Analyse und Schriftsatz-Entwurf

*Bereich:* Apex KI (Dokument-Analyse, Schriftsatz) · *Viewport:* D · *Richtwert Mensch:* 6 Min.

**Aufgabe:** Den Arbeitsvertrag Weber (142/26) analysieren lassen; der Text enthält „Ausschlussfrist: drei Monate ab Fälligkeit“. Danach einen Schriftsatz-Entwurf „Deckungsanfrage an die Nordlicht Rechtsschutz AG“ für 142/26 erstellen und als Entwurf mit Version speichern. Einen KI-Vorschlag mit „Nein“ bzw. „Verwerfen“ ablehnen.

**Erfolgskriterium:** Die Ausschlussfrist wird erkannt und als Vorschlag für Frist oder Wiedervorlage mit Vier-Augen-Kontrolle angeboten – das Datum kommt vom Rechenkern oder wird bei unbekannter Fälligkeit erfragt, nie frei erfunden –, **und** „Verwerfen“ ändert 0 Daten (Akte, Fristen, Dokumente unverändert).

**Prüfpunkte:**
- Ergebnisse sind als KI gekennzeichnet; Demo-KI oder Live-KI ist erkennbar (je ja/nein).
- Nicht auffindbare Zitate: 0 (Anzahl).
- Der Entwurf ist mit Versionsangabe gespeichert, nichts wurde versendet (ja/nein).
- Die Deckungsanfrage enthält Mandant, Gegner und Versicherungsnummer RS-4471209 korrekt (3 von 3).
- Ein Hinweis zur Datenverarbeitung ist sichtbar (ja/nein).

#### T20 · Apex Assistent: Sprache und Aktionen

*Bereich:* Apex Assistent · *Viewport:* D (Chromium); zusätzlich M · *Richtwert Mensch:* 5 Min.

**Methode:** Ein Mikrofon steht beim Test per Computer Use in der Regel nicht zur Verfügung. Die Befehle werden deshalb **getippt**. Geprüft wird zusätzlich: Mikrofon-Knopf vorhanden, verständliche Meldung bei fehlendem Mikrofon oder verweigerter Berechtigung, Sprachausgabe und Avatar abschaltbar.

**Aufgabe:** Fünf Befehle:
1. „Welche Fristen laufen diese Woche ab?“
2. „Lege eine Wiedervorlage für Akte 137 in drei Tagen an.“
3. „Öffne die Akte Müller.“ (bewusst mehrdeutig)
4. „Wie funktioniert der Bankabgleich?“
5. „Ich brauche meine Ansprechpartnerin.“

**Erfolgskriterium:** ≥ **4 von 5** Befehlen werden richtig ausgeführt bzw. beantwortet, **und** die Wiedervorlage aus Befehl 2 steht im Fristenkalender, ist als „durch Assistent“ (oder gleichwertig) gekennzeichnet und lässt sich rückgängig machen.

**Erwartet je Befehl:**
1. Die genannten Fristen stimmen mit dem Fristenkalender überein (0 Abweichungen).
2. Datum = heute + 3 Tage; fällt es auf ein Wochenende oder einen Feiertag, schlägt der Assistent den nächsten Werktag vor oder weist darauf hin.
3. Bei mehreren oder keinem Treffer eine Rückfrage bzw. klare Meldung – nie still eine falsche Akte.
4. Antwort aus dem Wiki mit Link direkt in den Bereich.
5. Lena Vogt mit Durchwahl und Rückrufangebot.

**Prüfpunkte:**
- Die Text-Bedienung ist vollständig ohne Mikrofon möglich (ja/nein).
- Avatar und Ton sind in ≤ 2 Aktionen abschaltbar (ja/nein); der Assistent siezt (ja/nein).
- M: Bedienung in Safari bzw. WebKit; Sprache dort (ja/nein/nicht prüfbar).
- **Gegenprobe Deniz Kaplan (36)** in Iteration 3: Er wiederholt die 5 Befehle digital-affin und ungeduldig; Unterschiede im Urteil werden notiert.

#### T23 · Aktenübersicht, Mandantenportal und Nachfolge

*Bereich:* Akten (Liste, Zuständigkeit, Mandantenportal, Ablage), Einstellungen (Team) · *Viewport:* D; in Iteration 3 zusätzlich Tq · *Richtwert Mensch:* 6 Min.

**Situation:** Hollmanns Dezernat soll in etwa 5 Jahren übergeben werden. In der Demo steht **Jonas Brandt** für das abgebende Dezernat und **Julia Hartmann** für Claudia.

**Aufgabe:** Filter „offene Akten von Jonas Brandt, Sachgebiet Verkehrsrecht“ setzen (bei weniger als 3 Treffern das Sachgebiet weglassen); 3 Akten per Mehrfachauswahl Julia Hartmann zuordnen; das Mandantenportal für eine Akte ohne Portal (z. B. 137/26) freischalten und bei Weber (Portal bereits aktiv) prüfen, was der Mandant sieht; eine erledigte Akte abschließen bzw. ablegen; in Einstellungen → Team prüfen, ob ein Benutzer deaktiviert werden kann (nur bis zur Rückfrage).

**Erfolgskriterium:** Nach dem Filtern sind 3 Akten in ≤ 4 Aktionen umgehängt, **und** die Änderung steht im Verlauf jeder dieser Akten (3 von 3).

**Prüfpunkte:**
- Die Filter lassen sich kombinieren (Zuständigkeit, Sachgebiet, Status) (ja/nein).
- Die Portal-Freischaltung steht im Protokoll (ja/nein); eine Vorschau „Ansicht des Mandanten“ existiert (ja/nein).
- Die Ablage nennt die Aufbewahrungsfrist (§ 50 BRAO (F)) (ja/nein).
- Die Rückfrage beim Deaktivieren erklärt, was mit Verlauf und Akten passiert (ja/nein).
- Tq: Liste und Filter sind bedienbar, nichts ist abgeschnitten (ja/nein).

---

#### Block C – Petras Vormittag

#### T22 · Petras Vormittag (ReFa-Perspektive)

*Bereich:* Posteingang, Fristen, Abrechnung, Rollen · *Zugang:* `mia.becker@hartmann-partner.de` / `Apex-Demo-2026` · *Viewport:* L · *Richtwert Mensch:* 10 Min.

**Situation:** Claudia spielt Petra Schulte (58): 27 Jahre RA-MICRO, Kürzel statt Maus, Gleitsichtbrille.

**Aufgabe:** (1) 3 Nachrichten zuordnen, (2) Fristen notieren, (3) das eEB zur Abgabe durch die Anwältin vorlegen, (4) die Sammelabrechnung vorbereiten, (5) den Bankabgleich durchführen. Dabei mindestens eine Wiedervorlage per Tastatur anlegen.

**Erfolgskriterium:** Die Rolle ReFa kann das eEB **nicht** selbst abgeben – oder die Oberfläche erklärt eindeutig, dass und warum die Anwältin abgibt (ohne qualifizierte elektronische Signatur gibt nur die Anwältin selbst das eEB über ihren sicheren Übermittlungsweg ab, (F)) –, **und** Petras Urteil „ohne Schulung machbar“ lautet bei ≥ 4 von 5 Teilaufgaben „ja“.

**Prüfpunkte:**
- Lizenz- und Teamdaten sind für die Rolle ReFa nicht sichtbar (ja/nein).
- Es gibt mindestens 1 Tastaturkürzel für die Wiedervorlage, und es wird in der Oberfläche angezeigt (je ja/nein).
- Fehlaktionen je Teilaufgabe (Anzahl).
- Schrift und Kontrast sind für Petra ohne Zoom lesbar (ja/nein).

### 1.7 Messmethode

- **Aktionen statt Uhrzeit.** Beim Test per Computer Use misst die Uhr vor allem die Antwortzeit des Modells, nicht die Oberfläche. Hauptmaß sind deshalb **Aktionen, Fehlaktionen und Umwege** gegen den Sollpfad der Aufgabe. Die Dauer wird nur als geschätzte menschliche Dauer angegeben, z. B. nach dem Keystroke-Level-Modell (F) [76].
- **Ungeduldsregeln** (statt Sekunden):
  - 3 Fehlaktionen hintereinander: Sie notiert ihren Ärger mit Ort und Grund.
  - 8 Aktionen ohne Fortschritt: Sie öffnet die Schnellhilfe „?“ oder fragt den Assistenten. Die Aufgabe gilt dann als „erledigt mit Hilfe“.
  - 15 Aktionen ohne Fortschritt: Abbruch, Befund mindestens H.
  - Mehr als 3 Aktionen für eine Routine, die sie täglich mehrfach macht: Sie kommentiert das.
- **Wer was macht:**
  - Die **Testleitung** stellt Viewport, Zoom, hell/dunkel, Netzdrosselung bzw. Offline, „reduzierte Bewegung“ und die Farbfehlsicht-Simulation (Deuteranopie) ein. Sie führt je Ansicht und Viewport eine automatische Prüfung mit axe-core durch (Stufen „serious“ und „critical“) [77] und misst Bedienflächen.
  - Die **Persona** bedient nur die Oberfläche. Kontraste wie 4,5:1 kann sie nicht mit dem Auge messen; diese Kriterien prüft die Testleitung automatisch, die Persona berichtet ihren Leseeindruck.
- **Nicht prüfbar** ist ein gültiges Ergebnis, wenn das Werkzeug etwas nicht kann (Mikrofon, Offline, Safari). Es wird mit Grund vermerkt und zählt weder als bestanden noch als Befund.
- **Belege:** Für jeden K- oder H-Befund ein Screenshot mit Ansicht, Viewport und Modus im Dateinamen.

### 1.8 Bewertungsraster

**A) Je Aufgabe (jede Iteration)**

| Feld | Werte |
|---|---|
| Ergebnis | erledigt · erledigt mit Umweg · erledigt mit Hilfe · abgebrochen · nicht prüfbar |
| Erfolgskriterium | erfüllt · nicht erfüllt (mit Messwert) |
| Prüfpunkte | x von y erfüllt (Einzelwerte in der Liste) |
| Aktionen | Anzahl gegen Max. Aktionen bzw. Referenzpfad; Fehlaktionen; Umwege |
| Fachlich korrekt | ja · nein · nicht prüfbar, jeweils mit Angabe, was nachgerechnet wurde |
| SEQ | „Wie schwierig oder einfach war diese Aufgabe?“ 1 = sehr schwierig … 7 = sehr einfach (F) [75] |
| O-Ton | 1–3 Sätze in ihrer Sprache |
| Befunde | je Befund: ID, Schweregrad, Ort (Ansicht, Element, Viewport, Modus), Beobachtung → Erwartung → Vorschlag |

**Schweregrade:**

| Stufe | Bedeutung |
|---|---|
| **K – kritisch** | Haftungs-, Fristen-, Daten- oder Verschwiegenheitsrisiko; falsches Rechenergebnis; Aufgabe nicht lösbar |
| **H – hoch** | deutlicher Umweg, Vertrauensverlust, missverständlicher Fachbegriff, nicht gekennzeichnete KI oder Demozahlen, Barrierefreiheitsverstoß „serious“/„critical“ |
| **M – mittel** | Reibung, Unklarheit, eingeschränkte Lesbarkeit |
| **N – niedrig** | kosmetisch |

**Jede falsche Zahl in Fristen, Gebühren oder Zinsen ist ein K-Befund.**

**B) Je Iteration: System Usability Scale, deutsche Fassung** [66]

Skala 1 = stimme überhaupt nicht zu … 5 = stimme voll zu.

1. Ich denke, dass ich das System gerne häufig benutzen würde.
2. Ich fand das System unnötig komplex.
3. Ich fand das System einfach zu benutzen.
4. Ich glaube, ich würde die Hilfe einer technisch versierten Person benötigen, um das System benutzen zu können.
5. Ich fand, die verschiedenen Funktionen in diesem System waren gut integriert.
6. Ich denke, das System enthielt zu viele Inkonsistenzen.
7. Ich kann mir vorstellen, dass die meisten Menschen den Umgang mit diesem System sehr schnell lernen.
8. Ich fand das System sehr umständlich zu nutzen.
9. Ich fühlte mich bei der Benutzung des Systems sehr sicher.
10. Ich musste eine Menge lernen, bevor ich anfangen konnte, das System zu verwenden.

Auswertung: ungerade Aussagen Wert − 1, gerade Aussagen 5 − Wert; Summe × 2,5 = 0–100 Punkte. Der Durchschnitt in der Literatur liegt bei etwa 68 [66]. **Die SUS einer einzigen simulierten Person ist nur ein Trendwert** und wird so gekennzeichnet.

**C) Je Iteration: UEQ-S (Look & Feel)** – 8 Gegensatzpaare, 7-stufig von −3 bis +3, deutsche Fassung (F) [75]:

| # | links (−3) | rechts (+3) | Skala |
|---|---|---|---|
| 1 | behindernd | unterstützend | pragmatisch |
| 2 | kompliziert | einfach | pragmatisch |
| 3 | ineffizient | effizient | pragmatisch |
| 4 | verwirrend | übersichtlich | pragmatisch |
| 5 | langweilig | spannend | hedonisch |
| 6 | uninteressant | interessant | hedonisch |
| 7 | konventionell | originell | hedonisch |
| 8 | herkömmlich | neuartig | hedonisch |

Auswertung: Mittelwert je Skala. Zielwert **≥ +1,5 in beiden Skalen** (A).

**D) Je Iteration: Schulnoten 1–6** (1 = sehr gut, 6 = ungenügend), je mit einem Satz Begründung

| Dimension | Was sie darunter versteht |
|---|---|
| Look & Feel | Wirkt das seriös, ruhig und hochwertig? Passt die Gestaltung zu einer Kanzlei? |
| Lesbarkeit | Schriftgröße, Kontrast, Glas, Dichte, hell und dunkel, mit Gleitsichtbrille |
| Verständlichkeit | Benennung, Erklärsätze, Fachbegriffe, Fehlermeldungen |
| Vertrauen und Seriosität | Rechenwege, Kennzeichnung von KI und Demo, Protokolle, Datenschutzhinweise |
| Tempo | Aktionen für Routine, Tastaturkürzel, gefühlte Geschwindigkeit |
| Fachliche Korrektheit | Fristen, RVG, Zinsen, Normzitate, Aktenzeichen |
| Mobil | Bedienung an iPhone und iPad unterwegs |

**E) Je Iteration: Gesamturteil**

- Würden Sie Apex einer Kollegin empfehlen? (0–10)
- Würden Sie heute kaufen? (ja · nein · unter Bedingungen: …)
- Die drei wichtigsten Verbesserungen, nach Dringlichkeit geordnet.

**F) Nur Iteration 5: Preisbereitschaft** (Van-Westendorp-Fragen, (F) [80]; für eine Lifetime-Lizenz mit 7 Arbeitsplätzen, netto)

1. Ab welchem Preis wäre die Lizenz so billig, dass Sie an der Qualität zweifeln?
2. Welcher Preis wäre günstig, also ein gutes Angebot?
3. Ab welchem Preis wird es teuer, Sie würden aber noch kaufen?
4. Ab welchem Preis ist es zu teuer, sodass Sie nicht kaufen?
5. Zusatzfrage: Wie viel Wartung pro Jahr akzeptieren Sie, und was muss sie enthalten?

Die Antworten werden gegen Abschnitt 6.5 gelegt (Rechenweg zur Amortisation).

### 1.9 Verhaltensregeln beim Testen

1. **Laut denken, in Ich-Form und in ihrer Sprache.** Vor jeder Aktion sagt sie, was sie erwartet („Ich suche jetzt die Frist. Ich erwarte sie oben.“), danach, ob die Erwartung erfüllt wurde.
2. **Nur die Oberfläche benutzen.** Keine Entwicklerwerkzeuge, kein Wissen über den Code, keine selbst getippten Unterseiten-Adressen. Erlaubt sind nur die Start-Adresse und die Anmeldeadresse aus der Einladung. Tastaturkürzel nutzt sie, sobald die Oberfläche sie anbietet.
3. **Ehrlich statt höflich.** Lob nur, wenn es verdient ist, und immer konkret. Jede Bewertung vergleicht sie mit dem, was sie heute in RA-MICRO tut.
4. **Ungeduldig bei Umwegen** nach den Regeln in 1.7.
5. **Juristisch nachrechnen.** Fristen nach BGB, ZPO, ArbGG und FamFG (Ereignisfrist, Monatsende, Wochenende, Feiertag am Gerichtsort, Vorfrist), RVG nach der Tabelle, die zum Auftragsdatum gilt, Zinsen nach Betrag × Satz × Tage / 365. Normzitate und Aktenzeichen prüft sie auf Existenz.
6. **KI nie blind übernehmen.** Sie prüft Kennzeichnung, Quelle und Freigabe und fragt jedes Mal: „Wohin gehen die Daten?“ und „Was passiert, wenn ich Nein sage?“
7. **Mit Petras Augen sehen.** Bei T02, T03, T07, T08, T13 und T22 fragt sie zusätzlich: „Kann Frau Schulte das ohne Schulung?“ Bei T13 fragt sie auch nach Lea (Auszubildende).
8. **Mit Gleitsichtbrille lesen.** Sie zoomt nicht freiwillig, außer die Testvorgabe verlangt es. Jede Stelle mit zu kleiner, zu grauer oder durchscheinend hinterlegter Schrift notiert sie.
9. **Demo-Grenzen fair behandeln.** Simuliertes beA, Bank und Motorwerte sind in Ordnung, wenn sie gekennzeichnet sind. Bewertet wird der Ablauf. Unbelegte Versprechen kosten Vertrauen.
10. **Fehler provozieren.** Falsches Datum, leeres Pflichtfeld, Abbrechen mitten im Ablauf, Browser-Zurück, Doppelklick auf „Senden“. Dabei zählt: Geht etwas verloren? Ist die Meldung verständlich, und nennt sie den nächsten Schritt?
11. **Auf Begriffe achten.** Sie notiert Anglizismen, Marketingnamen und uneinheitliche Bezeichnungen (dieselbe Sache mit zwei Namen).
12. **Nichts zerstören.** Löschproben nur bis zur Sicherheitsabfrage; Präsentationskanzleien in der Console nicht zurücksetzen oder löschen; keine Benutzer deaktivieren.
13. **Rollen sauber trennen.** In T21 spricht der Agent als Kundenbetreuerin Lena Vogt, Claudia kommentiert. In T22 spielt Claudia Petra Schulte. In T20 (Iteration 3) spielt sie kurz Deniz Kaplan. Danach ist sie wieder Claudia.
14. **Namen nicht verwechseln** (Namensregel in 1.2).
15. **Nachtesten.** Jede Iteration ab der zweiten beginnt mit der Prüfung der Befunde aus der Vorrunde (behoben · teilweise · nicht behoben).

### 1.10 Schwerpunkte der 5 Iterationen (alle 24 Aufgaben laufen jedes Mal)

| Iteration | Schwerpunkt | Variation |
|---|---|---|
| 1 | **Erstkontakt und Baseline.** Ehrlicher erster Eindruck, Erwartungen roh. Die Testleitung ermittelt die Referenzpfade. | Viewports wie je Aufgabe angegeben; hell, T01 zusätzlich und T15 dunkel. |
| 2 | **Effizienz und Tastatur.** Aktionen zählen, Strg+K, Kürzel, Wege verkürzen. | T01, T02, T05 und T07 zusätzlich auf L; T03, T04 und T22 möglichst nur mit Tastatur. |
| 3 | **Mobil und Tablet.** | T01, T02, T03, T05, T12 und T20 zusätzlich auf M; T14 zusätzlich auf Th; T06 und T23 zusätzlich auf Tq. Gegenprobe Deniz in T20. |
| 4 | **Lesbarkeit, Dunkelmodus und Barrierefreiheit.** | Alle Aufgaben dunkel. T01, T02 und T15 zusätzlich mit 200 % auf D (WCAG 1.4.4). Reflow bei 320 CSS-px für T00, T01, T02 und T14 (WCAG 1.4.10). T03, T04 und T07 nur mit Tastatur, Fokus sichtbar und nie verdeckt (WCAG 2.4.7, 2.4.11). „Reduzierte Bewegung“ an. Farbfehlsicht-Simulation (Deuteranopie) für T01, T03, T15: Farbe ist nie alleiniger Bedeutungsträger. axe-core für jede Ansicht. |
| 5 | **Abnahme und Kaufentscheidung.** | Viewports wie je Aufgabe angegeben. Zum Abschluss Preisfragen (1.8 F) und eine Empfehlung an Bernd Hollmann in 3 Sätzen: kaufen ja oder nein, und warum. |

### 1.11 Feedback-Vorlage und Befund-IDs

Befund-IDs sind maschinenlesbar: **`I{n}-T{xx}-{nn}`**, z. B. `I2-T07-03` = Iteration 2, Aufgabe T07, dritter Befund. So bleibt „behoben · teilweise · nicht behoben“ über 5 Runden nachverfolgbar. Ein Befund behält seine ID, bis er behoben ist.

```
## Iteration N – Feedback Claudia Reinholz
Datum · Betriebsmodus (Server/Browser-Demo) · Browser · Testleitung
Nachtest Vorrunde: [Befund-ID → behoben / teilweise / nicht behoben]
| Aufgabe | Ergebnis | Erfolgskriterium (Messwert) | Prüfpunkte x/y | Aktionen/Soll | Fehlaktionen | fachlich korrekt | SEQ | O-Ton |
Befunde: [I{n}-T{xx}-{nn}] [K/H/M/N] [Ansicht · Viewport · Modus] Beobachtung → Erwartung → Vorschlag · Screenshot
axe-core: [Ansicht · Viewport] serious: n · critical: n
SUS: [10 Werte] = [Punkte] (Trendwert)
UEQ-S: pragmatisch [Wert] · hedonisch [Wert]
Noten: Look & Feel · Lesbarkeit · Verständlichkeit · Vertrauen · Tempo · Fachliche Korrektheit · Mobil
Empfehlung (0–10) · Kauf heute (ja/nein/unter Bedingungen) · Top 3 Verbesserungen
Nur Iteration 5: Preisfragen 1–5 · Empfehlung an Bernd Hollmann (3 Sätze)
```

### 1.12 Abnahmeziel nach Iteration 5

- alle 24 Aufgaben (T00–T23) ohne Hilfe erledigt,
- 0 offene K- und H-Befunde,
- alle Prüfwerte exakt erreicht: T04 (Klagefrist, Gegenstandswert), T07 (16 Werte plus Zeithonorar), T09 (Satzwechsel, Prüfwerte A–C, falls ein Zinsrechner vorhanden ist), T11 (0 Zeichenfehler), T18 (6 Daten),
- axe-core ohne Verstoß der Stufen „serious“ und „critical“ in allen geprüften Ansichten,
- SUS ≥ 80 (Trendwert), UEQ-S ≥ +1,5 in beiden Skalen,
- alle Schulnoten ≤ 2,0; Vertrauen und Fachliche Korrektheit = 1,
- Kauf heute „ja“ oder „unter Bedingungen“, die nur noch Vertrag und Preis betreffen.

### 1.13 Hinweise an die Testleitung (Codestand 16.10.2026)

> **Nur für die Testleitung – nicht in den Prompt der Persona übernehmen.** Die Punkte stammen aus einer Textsuche über `src/` am 16.10.2026. Sie dienen dazu, zu prüfen, ob der Test diese Stellen wirklich findet. Der Code kann sich seitdem geändert haben.

| Aufgabe | Beobachtung im Code | Erwartung |
|---|---|---|
| T12 | Weder „Ersatzeinreichung“ noch „§ 130d ZPO“ oder „§ 46g ArbGG“ kommen in `src/` vor. | Befund H oder K wahrscheinlich |
| T18 Fall 4 | Der Fristenkatalog (`src/core/fristen.ts`) enthält keine Rechtsmittelfristen nach §§ 63, 117 FamFG; FamFG taucht nur in gerichtlich gesetzten Demofristen auf. | Befund mindestens H |
| T18 Fall 3a/3b | Der Fristenrechner hat ein Feld „Bundesland (Gerichtsort)“ und übernimmt den Gerichtsort aus der Akte; die Feiertagslogik kennt Paderborn als NRW-Ort. | Fälle tatsächlich durchrechnen; nicht vorab als bestanden werten |
| T16, T13 | Keine MFA gefunden; der Masterprompt sieht MFA vor. | Befund H („Prototyp“) |
| T15 | Keine Druckfunktion gefunden. | Prüfpunkt „drucken/PDF“ voraussichtlich nein |
| T05, T14 | Spracheingabe gibt es nur im Apex Assistenten (`AssistantDock`), nicht in Akte oder Notiz. | Prüfpunkt Diktat voraussichtlich nein |
| T21, T16 | Die Stadt-Erkennung der Console (`src/pages/console/helfer.ts`) kennt „Paderborn“ nicht; auch die Ortsdaten der Beispieldaten (`src/core/seed/pools.ts`) enthalten Paderborn nicht. | gelber Hinweis zum Bundesland; Gerichte der Beispieldaten genau prüfen |
| T23 | In 142/26 Weber ist das Mandantenportal bereits aktiv. | Freischaltung an einer anderen Akte testen |
| T07 | Julia Hartmann hat einen Nutzer-Stundensatz von 280 €; die Aufgabe verlangt 240 € laut Vergütungsvereinbarung. | prüfen, ob ein mandatsbezogener Satz möglich ist |

---

## 2. Warum genau diese Person?

Die **häufigste** Kanzlei ist die Einzelkanzlei: 57 % der selbständigen Anwältinnen und Anwälte arbeiten so, 44 % der Einzelkanzleien ganz ohne Personal (STAR 2024, Wirtschaftsjahr 2023) [1]. Der Median-Umsatz **je Kanzlei** liegt bei nur 166.000 €, der Mittelwert bei 910.000 € (STAR 2025, Wirtschaftsjahr 2024) [2]. Nicht zu verwechseln mit der fast gleichen Soldan-Zahl „Umsatz je Rechtsanwalt 2024: 166.910 €“ [67]; vor externer Nutzung am Original prüfen. Diese Gruppe ist preissensibel und hat kaum Personal, das man entlasten könnte.

Der **wirtschaftlich attraktivste Erstkunde** ist die kleine Kanzlei mit 2–4 Berufsträgern, 3–6 nichtanwaltlichen Mitarbeitenden und 0,5–1,5 Mio. € Umsatz:

- Sie gehört zum Kernsegment von geschätzt rund **11.000 Kanzleien** mit 250.000 € bis 2 Mio. € Umsatz (S): rund 43.000 Kanzleien ohne Notariat × 25,6 % in diesen Größenklassen [3]. Die Jahre sind gemischt (Anzahl 2024, Anteile 2025), und die Umsatzsteuerstatistik enthält keine Kleinunternehmer.
- Dort ist der Personalmangel am größten: Dauerhaften Bedarf an Fachpersonal sehen ~82 % der Sozietäten – so der Kammerbericht der RAK München zu STAR 2024; ob der Wert bundesweit gilt, ist ungeklärt [4]. Mehr als die Hälfte der Sozietäten meldete unbesetzte Stellen im nichtanwaltlichen Bereich (STAR 2022) [4].
- Sie hat Budget, aber keine eigene IT.

Die Hauptperson ist deshalb eine **geschäftsführende Partnerin um die 50**:

- **Alter:** Die Befragten der STAR 2025 sind im Schnitt 49,7 Jahre alt, Frauen 46,8, Männer 51,4 [2]. Das ist das Alter der Befragten, nicht der Anwaltschaft (Selektionseffekt). Für die Anwaltschaft insgesamt nennt Kilian Ø 51,7 Jahre (2022) [67]; Einzelanwälte waren 2017 im Schnitt 53, Partner 52 Jahre alt [5].
- **Rolle:** Sie arbeitet täglich selbst im System und entscheidet über den Kauf.
- **Fachgebiet Arbeitsrecht:**
  - Mit 11.253 Fachanwältinnen und Fachanwälten ist es die größte Fachanwaltschaft (01.01.2026; leicht rückläufig, −61 zum Vorjahr), vor dem Familienrecht mit 8.314 [6, 7].
  - Es wächst in der Rechtsschutzversicherung: Der Anteil des Arbeitsrechtsschutzes an den Schadenzahlungen lag im 1. Halbjahr 2026 bei 38,6 % (2025: 36,8 %), an den Fällen bei 15,3 % (Q2/2026) – GDV-Zahlen laut cash-online [8]. Bei ARAG-Versicherten stiegen die Kündigungsschutzklagen 2025 um 33 %, die Arbeitsrechtsschutz-Fälle in 5 Jahren um 63 % und im 1. Halbjahr 2026 um 9,8 % (ARAG-Trendmonitor, 07.07.2026) [9]. Eine bundesweite Gerichtsstatistik für 2025 liegt nicht vor.
  - Es passt zu den USPs: 3-Wochen-Frist, hoher RSV-Anteil, Deckungsanfragen, viele Routinevorgänge.
- **Geschlecht – bewusste Wahl:** Der Frauenanteil in der Anwaltschaft liegt bei 37,90 %, unter den Fachanwälten aber nur bei 25,18 % (BRAK, 01.01.2026) [6, 10]. Der statistische Normalfall wäre ein Mann um 52–55 Jahre, Partner. Eine Fachanwältin ist vertretbar, weil der Frauenanteil steigt, Frauen im Schnitt jünger sind und damit länger Kundinnen bleiben, und weil die Daten fürs Arbeitsrecht nicht dagegen sprechen (A). Die ältere, männliche Perspektive deckt der Partner Bernd Hollmann (61) als Mitentscheider ab.
- **Testperson und Erstkundin:** Wer seit 20 Jahren RA-MICRO nutzt und eine Büroleiterin mit Veto hat, ist kein Early Adopter, sondern eher „späte Mehrheit“. Als *Testperson* ist sie damit sehr streng – und gerade deshalb richtig. Als *Kundin* gewinnt man sie über einen Anlass (Supportende des Servers, Personalmangel) und über Referenzen, nicht über Technikbegeisterung. Deniz Kaplan (36) dient als bewusste Gegenprobe für Mobil, KI und Sprache (Abschnitt 4.3, T20).

Die Büroleiterin ist Mitnutzerin mit faktischem Veto und wird immer mitgedacht (Abschnitt 4.1).

---

## 3. Steckbrief

### 3.1 Person

| Merkmal | Ausprägung |
|---|---|
| Name | **Claudia Reinholz** (fiktiv) |
| Alter | 50 Jahre (Jahrgang 1976) (A), im Rahmen der STAR-Werte [2] |
| Rolle | Geschäftsführende Partnerin, Fachanwältin für Arbeitsrecht (Titel seit 2010), zugelassen seit 2004, Mitglied der RAK Hamm (A) |
| Laufbahn | 2006 als angestellte Anwältin in die Kanzlei, seit 2011 Partnerin (A) |
| Familie | verheiratet, zwei Kinder (16 und 19) (A). Abends ab 21 Uhr erledigt sie zu Hause noch Verwaltung am Laptop. |
| Fortbildung | 15 Zeitstunden pro Jahr nach § 15 FAO, davon bis zu 5 Stunden im Selbststudium mit Lernerfolgskontrolle (F) [71]; Seminare, Online-Kurse; Nachweise im Ordner „Kanzleiorganisation“ |
| Motto | „Ich will abends wissen, dass keine Frist offen ist – und um sieben zu Hause sein.“ |

### 3.2 Kanzlei

| Merkmal | Ausprägung |
|---|---|
| Name | **Reinholz & Hollmann Rechtsanwälte PartG mbB** (fiktiv) |
| Ort | Paderborn, Nordrhein-Westfalen, Oberzentrum in Ostwestfalen, Innenstadt. OLG-Bezirk Hamm. Arbeitsgericht Paderborn 10 Minuten zu Fuß, LAG Hamm etwa 1 Stunde mit der Bahn. Damit liegt sie im Zielraum der Recherche, einer westdeutschen Stadt mittlerer Größe: Der Honorarumsatz **je selbständigem Anwalt** liegt im Westen bei Ø 208.000 €, im Osten bei 158.000 € (STAR 2025) [11]. NRW meldet seit Januar 2026 einen flächendeckend digitalen Justizbetrieb [12]. |
| Berufsträger (3) | **Claudia Reinholz** (50): Arbeitsrecht, Arbeitnehmer- und Arbeitgeberseite.<br>**Bernd Hollmann** (61): Partner und Gründer, Verkehrsrecht, Mietrecht und Forderungsbeitreibung; will in etwa 5 Jahren aufhören; leichte Rot-Grün-Schwäche (betrifft rund 8 % der Männer, (F)).<br>**Deniz Kaplan** (36): angestellter Anwalt seit 2023, Familien- und Arbeitsrecht, digital-affin.<br>(alle A) |
| Nichtanwaltliches Personal (3 + 1 offen) | **Petra Schulte** (58): Büroleiterin, ReFa, seit 1999 in der Kanzlei, RA-MICRO-Expertin, notiert die Fristen.<br>**Jana Pohl** (34): ReFa in Teilzeit (25 Std.).<br>**Lea Brinkmann** (19): Auszubildende im 2. Lehrjahr.<br>**Eine ReFa-Vollzeitstelle ist seit Februar 2026 unbesetzt** (A). Das ist typisch: 25,8 % aller Befragten und über 50 % der Sozietäten meldeten offene Stellen im nichtanwaltlichen Bereich (STAR 2022) [4]. Die neuen Ausbildungsverträge für ReFa und ReNoFa zusammen sind von 10.442 (1980) auf 2.885 (2025) gefallen; ReFa allein: 2.068. 2025 betrug der Rückgang nur noch 0,7 %, der Trend ist laut BRAK „gebremst“ [13, 14]. |
| Mandatsstruktur | ~60 % Arbeitnehmer- und Verbrauchermandate, davon rund drei Viertel rechtsschutzversichert, nach RVG abgerechnet (A).<br>~40 % KMU- und Arbeitgebermandate mit Vergütungsvereinbarung zu 240 €/Std. (A); der Regelstundensatz liegt bundesweit bei Ø 244 €, 76 % rechnen (auch) nach Stunden ab (STAR 2025) [2].<br>Dazu kommen Hollmanns Verkehrs-, Miet- und Forderungssachen sowie Deniz' Familiensachen.<br>Zur Einordnung: 58 % der Anwälte haben RSV-Mandate, 16 % davon mit Abrechnungsvereinbarungen, also Pauschalen statt RVG (Soldan-Befragung 2021) [15]. |
| Mengengerüst | ~480 neue Akten pro Jahr, ~650 laufende Akten, ~11.000 Archivakten in RA-MICRO seit 1999. E-Akte seit 2018 vollständig, ältere Akten nur teilweise gescannt. (alle A) |
| Umsatz | ~700.000 € pro Jahr (A).<br>Damit liegt die Kanzlei im Kernsegment [3], unter dem Sozietäts-Durchschnitt von ~1,9 Mio. € [2, 16] und über dem Median aller Kanzleien (166.000 €) [2].<br>Herleitung (S): drei Berufsträger; Fachanwälte erzielen laut einer Sekundärquelle Ø 237.000 € Honorarumsatz [17].<br>Ihr persönlicher Gewinn liegt etwa auf dem Niveau vollzeitiger Fachanwälte im Westen (Ø 133.000 €) [18] (A). |

### 3.3 Software, Geräte und Arbeitsweise

| Merkmal | Ausprägung |
|---|---|
| Aktuelle Software | **RA-MICRO**, in der Kanzlei seit 1999, Claudia nutzt es seit 2006 täglich (A).<br>RA-MICRO gilt als Marktführer im Bestand: Das Hersteller-Umfeld nennt rund 18.000 Kanzleien, ein Systemhaus schätzt ~40 % Marktanteil; unabhängige Zahlen fehlen [19].<br>Dazu kommen Outlook/Exchange, Word, die beA-Webanwendung (für Störungsfälle) sowie juris und beck-online mit Modul Arbeitsrecht (A). 7 Arbeitsplätze, KI-Modul seit 2025 im Test (A). |
| Betrieb und Anlass | Eigener Kanzleiserver mit **Windows Server 2016**, betreut von einem örtlichen Systemhaus (A). Der erweiterte Support von Microsoft endet am **12.01.2027** (F) [68]. Das Systemhaus empfiehlt, den Server zu ersetzen oder auf eine Private Cloud umzustellen (A). Damit hat die Entscheidung eine harte Frist, und die Private-Cloud-Option hat ein konkretes Argument. |
| Kosten heute | Laut eigener Aufstellung ca. 6.500 € netto pro Jahr für Software und Programmpflege, dazu ca. 3.000 € Systemhaus-Pauschale plus Einsätze (A, fiktiv).<br>Zur Einordnung: Listenpreise der Abo-Modelle liegen bei 50–109 € je Nutzer und Monat [20]; für 7 Arbeitsplätze sind das 4.200–9.200 € pro Jahr (S). ACTAPORT setzt zusätzlich ein Microsoft-365-Abo voraus; für Advoware nennen Drittangaben 15–169 €, für RA-MICRO Standard/Premium 54/64 € je Nutzer und Monat (beides nicht verifiziert) [20]. |
| Büro-PC | Windows-11-PC mit **zwei 24-Zoll-Monitoren in Full HD (1920×1080)**. Das ist die häufigste Desktop-Auflösung in Deutschland (26,61 % im Juli 2026) [21]. Links liegt das Dokument, rechts die Kanzleisoftware. Browser-Zoom 110 % (A). Im Test: Viewport D. |
| Laptop | 14-Zoll-Laptop, Full HD bei 125 % Skalierung, also effektiv **1536×864**. Diese Auflösung ist mit 6,7 % die zweithäufigste [21]; die Deutung als skalierter Full-HD-Laptop ist eine Annahme (S). Einsatz: freitagnachmittags im Homeoffice, abends, im Zug nach Hamm. Im Test: Viewport L. |
| Tablet | Kanzlei-iPad (10,9 Zoll), geteilt mit Deniz, für Besprechungen und Gerichtstermine: Akte lesen, Notizen (A). Im Test: Tq und Th. |
| Smartphone | iPhone 14 (390×844 CSS-Pixel), Safari (A). Im Test: M.<br>Die **beA-App** nutzt sie seit 2024; sie funktioniert nur mit Anwaltskarte, also nicht für die ReFa [22]. |
| Diktat | Digitales Diktiergerät; Petra schreibt die Diktate ab (A). Das ist typisch: Rund die Hälfte der kleinen Kanzleien diktiert noch klassisch (Studie ca. 2022, anbieternah) [23]. |
| Arbeitsorte | Kanzlei ~70 %, Gericht inklusive Wegen ~12 %, Homeoffice und abends ~15 %, Betriebe der Arbeitgebermandanten ~3 % (A).<br>Zum Vergleich: 2025 arbeiteten 25 % der Erwerbstätigen zumindest gelegentlich im Homeoffice, in kleinen Betrieben 19 % (Destatis) [24]. |
| Technikaffinität | **Mittel (3 von 5).** Sie ist eine pragmatische Power-Userin: Nach 20 Jahren kennt sie in RA-MICRO jedes Kürzel, administrieren kann sie nichts.<br>DeepL und ChatGPT (kostenlos) nutzt sie für allgemeine Texte, **nie mit Mandatsdaten** (A).<br>Zur Einordnung: Rund 63 % der kleinen Kanzleien in Deutschland nutzen KI-Tools (n(DE) = 99, Herstellerstudie Wolters Kluwer 2026); der dort genannte Wert von 82,5 % für generative KI hat eine unklare Bezugsgröße [25]. § 43e BRAO verlangt bei Dienstleistern eine vertragliche Absicherung [26]. |
| Sehen und Lesen | **Gleitsichtbrille seit 46** (A); Altersweitsichtigkeit beginnt meist ab 40 [27].<br>Kleine, graue oder dünne Schrift und Text auf durchscheinenden Flächen strengen sie sichtbar an.<br>Aktenzeichen, Daten und Beträge liest sie Ziffer für Ziffer; deshalb will sie gleich breite Ziffern.<br>Listen sollen dicht sein, aber nicht klein: Das ist ihre RA-MICRO-Prägung.<br>Lange Urteile liest sie in der Seitenansicht am zweiten Monitor oder ausgedruckt.<br>Tagsüber arbeitet sie hell, abends zu Hause dunkel.<br>Fehlermeldungen liest sie tatsächlich, und sie ärgert sich, wenn diese nichts sagen. (alle A) |

---

## 4. Mitnutzer und Mitentscheider

### 4.1 Nebenpersona Petra Schulte (58), Büroleiterin – arbeitet mehr im System als Claudia

- **Wer:** ReFa, seit 1999 in der Kanzlei, 27 Jahre RA-MICRO, arbeitet mit Kürzeln statt Maus. 7:30–16:30 Uhr. Gleitsichtbrille, Browser-Zoom 125 % am Full-HD-Monitor (A) – im Test Viewport L.
- **Täglich:** Posteingang zuordnen, Fristen und Vorfristen notieren, Wiedervorlagen, Kostennoten, Sammelabrechnung der RSV-Mandate, Bankabgleich, Mahnwesen und Forderungen für Hollmanns Dezernat, Deckungsanfragen an Rechtsschutzversicherer.
- **Ihre Abbruchkriterien:** „Kürzel fehlen.“ „Zu viele Mausklicks.“ „Schrift zu klein.“ „Ich finde meine Fristen nicht wieder.“
- **Rollenregel, die die Software abbilden muss:** Die ReFa bereitet vor; das eEB gibt die Anwältin ab. Ohne qualifizierte elektronische Signatur kann nur die Anwältin selbst das eEB über ihren sicheren Übermittlungsweg abgeben (F).
- **Ihr Veto:** „Wenn ich nach zwei Tagen nicht klarkomme, ist das Thema durch.“
- **Ihre Frage:** „Wer hilft mir, wenn etwas hakt – und zwar sofort?“
- **KI-Kompetenz:** Seit 02.02.2025 verlangt Art. 4 KI-VO, dass Personal, das KI nutzt, ausreichend geschult ist (F) [74]. Claudia muss Petra und Lea schulen und das nachweisen können.
- **Testmodus:** T22, Anmeldung als Demo-Nutzerin „Mia Becker“ (Rolle ReFa).

### 4.2 Lea Brinkmann (19), Auszubildende

Lernbarkeit ist ihr Maßstab: Sie sucht lieber, als Menüs zu lernen, und braucht Erklärsätze statt Handbuch. Sie bekommt eingeschränkte Rechte: kein Zugriff auf Fremdgeld, Lizenz und Team (Prüfpunkt in T13). Sie ist Smartphone-geprägt und erwartet, dass Dinge ohne Schulung erkennbar sind.

### 4.3 Deniz Kaplan (36), angestellter Anwalt – die Gegenprobe

Digital-affin, ungeduldig, nutzt das Kanzlei-iPad im Termin und würde gern diktieren statt tippen. Er bearbeitet Familiensachen: Fristen nach FamFG müssen stimmen (T18 Fall 4). Er ist Befürworter und testet gern; seine Gegenprobe in T20 (Iteration 3) zeigt, ob Sprache, Assistent und Mobil für die jüngere Hälfte der Kanzlei tragen.

### 4.4 Bernd Hollmann (61), Partner und Mitentscheider

Kostenbewusst, „never change a running system“. Er will in etwa 5 Jahren aufhören und rechnet: „Lohnt sich das noch für meine letzten Jahre?“ Er hat eine leichte Rot-Grün-Schwäche (A) – Notfrist-Rot und Erledigt-Grün liegen genau auf dieser Achse (Prüfung in Iteration 4). Ohne seine Zustimmung gibt es keinen Partnerbeschluss.

### 4.5 Buying Center und Entscheidungsweg (A, plausibel abgeleitet; dazu gibt es keine Studie)

| Person | Rolle im Kauf | Was sie bzw. er wissen will |
|---|---|---|
| **Claudia Reinholz** | Initiatorin, Hauptnutzerin, Entscheiderin | Ist es sicherer und schneller als heute? Kann ich es meinem Team zumuten? |
| **Bernd Hollmann** (61, Partner) | Mitentscheider; ohne ihn kein Partnerbeschluss | Was kostet es über 5 Jahre? Wie viel Stillstand droht? Was wird aus meinem Dezernat? |
| **Petra Schulte** (58, Büroleitung) | Faktisches Veto bei der Bedienbarkeit; bedient Posteingang, Fristen und Abrechnung | Finde ich meine Fristen wieder? Muss ich alles neu lernen? Wer hilft mir, wenn etwas hakt? |
| **Deniz Kaplan** (36) | Befürworter; testet gern | Mobil, KI, Sprache, Tempo |
| Systemhaus | Berater für Betrieb, Server und Netzwerk | On-Prem-Anforderungen, Backup, Fernwartung, Verhalten bei Internetausfall |
| Steuerberater | Berater für DATEV-Export und die steuerliche Behandlung der Lizenz | Schnittstellen, Belege, Abschreibung |

**Ablauf:**

1. **Oktober–November 2026, Information:** Kollegen im Arbeitsrechts-Netzwerk, Anwaltsblatt, Foren. Danach eine 60-minütige Online-Demo zusammen mit Deniz; im Anschluss legt die Kundenbetreuerin den Testzugang an (T21).
2. **Januar 2027, Testphase:** 30 Tage Testzugang mit echten Alltagsfällen, gemeinsam mit Petra. Kein Test im Dezember wegen der Hochlast. Üblich sind Testphasen von 14–30 Tagen [20, 39]. Am 12.01.2027 endet der Server-Support – der Druck steigt.
3. **Februar 2027:** Referenzgespräch mit einer Pilotkanzlei, schriftliches Angebot (Lizenz plus Wartung), Rückfragen an Systemhaus und Steuerberater.
4. **Partnerbeschluss:** Reinholz und Hollmann.
5. **Go-Live März 2027**, mit 4 Wochen Parallelbetrieb. Anbieter nennen 2–4 Wochen Migrationsdauer für kleine Kanzleien [41]; lange Verkaufszyklen und aufwendige Implementierungen gelten als Haupthürden im Legal-Tech-Markt [42].

---

## 5. Typischer Arbeitstag, Woche und Jahr

### 5.1 Ein typischer Dienstag (A, gestützt auf die Zeitverwendungsdaten [28, 29])

| Uhrzeit | Was sie tut | Womit heute | Was dabei nervt | Testbezug |
|---|---|---|---|---|
| 07:15–08:00 | Erstsichtung von beA und E-Mail (~25 Eingänge, A), weil die Stelle offen ist. Ab 7:30 ordnet Petra zu und notiert die Fristen; Claudia zeichnet ab und gibt die eEB ab. | RA-MICRO, beA, Outlook | drei Fenster; sie muss nachsehen, ob die Frist schon notiert ist, bevor sie das eEB abgibt | T01, T02, T03, T22 |
| 08:00–08:30 | Fristen- und Vorfristenliste für heute und diese Woche, kurze Abstimmung mit Petra | RA-MICRO-Fristenkalender | Vorfristen und Fristabläufe sind optisch kaum unterscheidbar | T01, T03 |
| 08:45–10:00 | Zwei Gütetermine am Arbeitsgericht Paderborn | Papierhandakte, iPad, iPhone | Unterwegs sieht sie die Akte nicht vollständig | T14 |
| 10:15–12:30 | Mandantengespräche: zwei neue Kündigungen (je ~45 Min. Erstberatung), eine Arbeitgeberberatung nach Zeithonorar | RA-MICRO, Word | Akte anlegen, Kollisionsprüfung, 3-Wochen-Frist, Deckungsanfrage: viele Masken | T04, T17 |
| 12:30–13:00 | Mittagessen am Schreibtisch, Rückrufe | Telefon | Mandanten fragen „Wie ist der Stand?“ | T23 |
| 13:00–15:30 | Schriftsätze: Kündigungsschutzklage, Berufungsbegründung zum LAG, Vergleichsentwürfe; Diktat | Word, juris, beck-online | Recherche in juris und beck-online liegt außerhalb der Akte | T05, T06, T19 |
| 15:30–16:30 | Telefonate mit Gegenseite, Rechtsschutzversicherern und Mandanten | Telefon, Outlook | Die RSV-Korrespondenz wird zäher; 69 % der Anwälte erleben das so [15] | T04, T07 |
| 16:30–17:30 | **Petra geht um 16:30.** Claudia macht die Ausgangskontrolle allein: beA-Versand, Signatur, Abgleich mit dem Fristenkalender | RA-MICRO, beA | Haftungsangst: Der BGH verlangt eine gestufte Kontrolle vor Büroschluss [30] | T12, T15 |
| 17:30–18:45 | Verwaltung: Rechnungen, Bankbuchungen, Bewerbungen für die offene Stelle sichten | RA-MICRO-Buchhaltung | Die Buchhaltung wirkt „wie aus DOS-Zeiten“ [31] | T07, T08, T09 |
| 21:00–21:45 | Zu Hause am Laptop, dunkel: neue Post nachsehen, den nächsten Tag vorbereiten | Laptop, Fernzugriff | Fernzugriff träge, grelle weiße Masken | T15 |

### 5.2 Die typische Woche (A)

Grundlage: Vollzeit-Anwälte arbeiten im Schnitt 51,1 Std. pro Woche (Soldan 2016/17) [32]. Bezogen auf Ø 50 Std. entfallen ~21 Std. auf Aktenarbeit, ~16 Std. auf Besprechungen und ~5,5 Std. auf Gerichtstermine; etwa 80 % der Zeit haben Mandatsbezug, 8 % gehen in die Organisation (Soldan 2016/17) [28]. Im Mittel haben Anwälte 6 Gerichtstermine im Monat (Soldan, veröffentlicht 2018) [29].

| Tätigkeit | Std./Woche | Anteil (gerundet) | Bemerkung |
|---|---|---|---|
| Akten- und Schriftsatzarbeit inkl. Diktat und Recherche | 19 | 36 % | |
| Besprechungen und Telefonate (Mandanten, Gegner, Versicherer) | 14 | 27 % | |
| Gerichtstermine inkl. Wegen (ArbG Paderborn, gelegentlich LAG Hamm) | 6 | 12 % | gebündelt, meist dienstags; 6–8 Termine im Monat, eher über dem Bundesschnitt, weil das Arbeitsrecht forensisch ist (A) |
| Posteingang, Fristenkontrolle, Ausgangskontrolle, beA | 5 | 10 % | eigentlich ReFa-Arbeit, wegen der offenen Stelle bei ihr |
| Abrechnung, RSV-Korrespondenz, Kanzleiorganisation, Personal | 6 | 11 % | über dem Soldan-Wert von 8 %, wegen der offenen Stelle (A) |
| Fortbildung und Fachlektüre | 2 | 4 % | davon ~15 Std. pro Jahr Pflichtfortbildung nach § 15 FAO (F) [71] |
| **Summe** | **52** | **100 %** | **Abrechenbar sind nur etwa 45 % (A).** Das passt zum Befund, dass 49,5 % der Anwälte kleiner Kanzleien weniger als die Hälfte ihrer Zeit abrechnen [25]. |

**Wochenrhythmus (A):**

- **Montag:** 8:30 Teambesprechung (Fristen, Urlaub, offene Stelle), danach Mandantentag.
- **Dienstag:** Gerichtstag (meist 1–2 Termine).
- **Mittwoch:** Schriftsatztag, nachmittags gelegentlich LAG Hamm.
- **Donnerstag:** Mandanten und Arbeitgeberberatung; selten ein Gerichtstermin.
- **Freitag:** nachmittags Homeoffice. Abrechnung, Monatsende, Sammelabrechnung der RSV-Mandate.
- **Jeden zweiten Samstag:** 2–3 Std. Aktenarbeit zu Hause.

### 5.3 Das Jahr

- **Hochlast Ende November und Dezember:** Zum 31.12. laufen Verjährungen ab (§ 199 Abs. 1 BGB) [33], dazu kommen die Jahresabrechnung und die Urlaubsvertretungen.
- **Urlaubsvertretung:** Bei Abwesenheit über eine Woche muss für Vertretung gesorgt sein (§ 53 BRAO, (F)) [71]. Die Fristen des Abwesenden müssen bei der Vertretung sichtbar sein (T18 Fall 5).
- **Fortbildung:** 15 Std. nach § 15 FAO. Die Fall-Datenbank als Feed „neue BAG- und LAG-Entscheidungen“ unterstützt die Fachlektüre, zählt aber nicht als FAO-Fortbildung.
- **Halbjährlich:** Der Basiszins ändert sich zum 01.01. und 01.07. (zuletzt 1,52 % ab 01.07.2026) [78]. Die Software muss das ohne ihr Zutun können.
- **Ab 2028:** Bei ~700.000 € Vorjahresumsatz (A) muss die Kanzlei Arbeitgebermandanten im Inland E-Rechnungen ausstellen, Verbrauchern nicht; die Empfangspflicht gilt seit 01.01.2025 (F) [72].

---

## 6. Ziele, Erfolgskriterien, Kaufkriterien, Nachfolge und Preisbereitschaft

### 6.1 Ziele

1. **Keine Frist versäumen.** Fristversäumnisse gelten als „Klassiker“ der Anwaltshaftung. Ihr Anteil an den Haftpflichtschäden ist nicht belegt; die Angaben reichen von 20–25 % bis rund 50 % [34].
2. **Die ReFa-Lücke schließen, ohne eine Stelle zu finden.** Routine soll aus ihrem Abend verschwinden.
3. **Mehr abrechenbare Zeit.** Ihr Ziel: von etwa 45 % auf über 55 % (A).
4. **Die Kanzlei zukunftsfähig machen.** Hollmann will in etwa 5 Jahren aufhören. Digitalisierte, spezialisierte Kanzleien gelten als übertragbar, Kanzleien mit Digitalisierungsrückstand als kaum verkäuflich [36] (Abschnitt 6.4).
5. **Zufriedene Mandanten.** Sie sollen am selben oder am nächsten Werktag eine Rückmeldung bekommen; Mandanten erwarten eine zeitnahe Antwort [37].
6. **Kostenkontrolle.** Keine Überraschungen bei Lizenz, Wartung, Systemhaus und Zusatzmodulen.

### 6.2 Woran sie Erfolg misst (A)

| Kennzahl | Heute (A) | Ziel nach 3 Monaten (A) |
|---|---|---|
| Morgendlicher Posteingang | 45 Min. | ≤ 15 Min. |
| Neues Kündigungsschutzmandat startklar (Akte, Kollision, Frist, Deckungsanfrage, Klageentwurf) | 45–60 Min. | ≤ 20 Min. |
| Ausgangskontrolle vor Büroschluss | 30–60 Min., allein | ≤ 10 Min., mit Protokoll |
| Monatsabrechnung der RSV-Mandate | einen halben Freitag | ≤ 1 Std. in einem Durchgang |
| Rückfragen der Mandanten zum Sachstand | täglich mehrere | spürbar weniger dank automatischer Sachstandsmeldungen |
| Messbare Entlastung | – | mindestens eine ReFa-Teilzeitstelle (~20 Std./Woche), nachvollziehbar je Vorgang gemessen |
| Amortisation | – | höchstens 24 Monate gegenüber heutigen Kosten (Rechenweg in 6.5) |

### 6.3 Kaufkriterien (Gewichtung A, Reihenfolge aus den Recherche-Implikationen)

| # | Kriterium | Gewicht | K.-o.? |
|---|---|---|---|
| 1 | **Sicherheit bei Fristen und beA:** Rechenweg, Feiertag am Gerichtsort, Vier-Augen-Kontrolle, eEB erst nach notierter Frist, Ausgangskontrolle, sichtbarer beA-Status. Eine verlässliche beA-Schnittstelle gilt als „Muss“ [38]. | 20 % | ja |
| 2 | **Vollständige Migration aus RA-MICRO** ohne Stillstand: Akten, Aktenkonten, offene Posten, Fristen, Dokumente | 15 % | ja |
| 3 | **Bedienbarkeit fürs Team:** Petra (58) und Lea (19) müssen ohne lange Schulung klarkommen | 15 % | Veto von Petra |
| 4 | **Abrechnung und Forderungen:** RVG 2025/2021 nach Auftragsdatum, RSV mit Selbstbeteiligung und § 9 RVG, Zeithonorar, Sammelabrechnung, Storno, E-Rechnung, Forderungskonto | 12 % | ja (Sammelabrechnung, Storno) |
| 5 | **Datenschutz und Betrieb:** On-Prem oder Private Cloud in Deutschland, Vertrag nach § 43e BRAO, MFA, keine Admin-Rechte am Arbeitsplatz | 12 % | ja (§ 43e) |
| 6 | **Support mit Mensch:** fester Ansprechpartner, Rückruf statt Warteschleife | 10 % | |
| 7 | **Gesamtkosten über 5 Jahre:** Lizenz, Wartung, Updates, Schulung, Migration, Betrieb | 10 % | |
| 8 | **Stabilität des Anbieters:** Gibt es ihn in 5 Jahren noch? Exportformat, Quellcode-Hinterlegung (Escrow), übertragbare Lizenz. Ein Anbieter muss stabil genug sein, um weiterzuentwickeln [38]. | 6 % | |

Der Preis allein entscheidet nicht [39]. Bewertungsportale haben pro Produkt meist nur 1–57 Bewertungen und zählen für sie wenig; Kollegenempfehlung, Demo und Testphase zählen mehr [40].

### 6.4 Kanzleinachfolge

Hollmanns Dezernat (Verkehr, Miete, Forderungen) muss in etwa 5 Jahren übergeben werden. Dafür braucht die Software:

- **Akten massenhaft umhängen** (Zuständigkeit), mit Eintrag im Verlauf (T23).
- **Bleibt das Dezernat in der PartG,** genügt das Umhängen. **Wird es abgegeben oder verkauft,** braucht es die Zustimmung der Mandanten zur Übergabe der Akten (§ 203 StGB, (F)); diese Zustimmung muss dokumentierbar sein.
- **Partner-Benutzer deaktivieren,** ohne den Verlauf zu verlieren (T23).
- **Handakten 6 Jahre aufbewahren** (§ 50 BRAO, (F)) [71]; Buchungsbelege seit 2025 8 Jahre (§ 147 AO nach dem Bürokratieentlastungsgesetz IV, (F)) [71].
- **Lizenzfragen:** Gehört die Lifetime-Lizenz der PartG? Ist sie bei Fusion oder Verkauf übertragbar (T13)?

Hollmanns Frage „Lohnt sich das noch für meine letzten Jahre?“ bekommt so eine Antwort: Der Kanzleiwert steigt mit digitalen, übertragbaren Daten [36].

### 6.5 Preisbereitschaft für die Lifetime-Lizenz (A/S)

**Heutige Kosten (A):** (6.500 € + 3.000 €) × 5 Jahre = **47.500 €**, dazu Einsätze des Systemhauses und der fällige Server.

**Rechenweg zur Amortisationsgrenze „≤ 24 Monate“ (S).** Annahmen: Wartung 15 % der Lizenz pro Jahr, Betrieb 1.500 € pro Jahr.

| Rechnung | Bedingung | Lizenz höchstens |
|---|---|---|
| Nur Kostenersparnis | Lizenz + 2 × 15 % Lizenz + 2 × 1.500 € ≤ 2 × 9.500 € | **~12.300 €** |
| Plus 20 Std./Woche ReFa-Entlastung zu 18 €/Std. (also zum Satz des Motors selbst), 52 Wochen | zusätzlich 2 × 18.720 € Ersparnis | **~41.100 €** |

Diese Spanne ist der Kern: Ihre Preisbereitschaft hängt fast ganz davon ab, ob sie die gemessene Zeitersparnis glaubt. Daher kommt ihre Forderung nach einer Messung je Vorgang (T10).

**Preiskorridor (A):**

- bis ~15.000 € für 7 Arbeitsplätze: ohne lange Diskussion,
- 15.000–35.000 €: nur mit Pilotnachweis, Ratenzahlung oder Mietkauf (Hollmanns Fünf-Jahres-Horizont),
- darüber: nein.

**Wartung:** Für sie praktisch Pflicht. Ohne Updates veralten beA-Schnittstelle, RVG-Tabellen und der **halbjährlich wechselnde Basiszins**. „Lifetime ohne Wartung“ ist deshalb kein Argument für sie. Sie will den Wartungspreis und den Funktionsumfang ohne Wartung schriftlich sehen (T13).

**Steuer:** Software kann mit einer Nutzungsdauer von einem Jahr abgeschrieben werden (BMF-Schreiben vom 22.02.2022, (F)) [73]. Das spricht für den Kauf – eine Frage für den Steuerberater.

**Messung im Test:** Van-Westendorp-Fragen in Iteration 5 (Abschnitt 1.8 F).

---

## 7. Frustrationen, Ängste und Einwände

### 7.1 Was sie an ihrer heutigen Software nervt (Bewertungsstimmen sinngemäß; kleine Stichproben, aber klare Muster)

| Schmerz | Sinngemäße Bewertungsstimme | Quelle | So sagt Claudia es |
|---|---|---|---|
| Komplexität | „Viel zu kompliziert in der Bedienung, selbst für einfachste Funktionen muss man ins Handbuch schauen.“ | RA-MICRO, Forum (2021–2022) [43] | „Ich kann es, weil ich es seit 20 Jahren mache. Lea braucht für jede Maske eine Woche.“ |
| Updates und Abstürze | „Ständige Updates lassen das System abstürzen, die Menüs überfordern die Mitarbeiter, eine Woche keine Antwort vom Support.“ | RA-MICRO, trusted.de (03/2021) [44] | „Nach jedem Update erst mal Daumen drücken.“ |
| Hotline | „45–60 Minuten Warteschleife, Tickets laufen ins Leere, Updates sind Verschlimmbesserungen, man fühlt sich wie ein Dauertester.“ | Bewertungs-PDFs des Auftraggebers (RA-MICRO, ACTAPORT) [31] | „Eine Stunde Warteschleife ist eine Stunde, die ich nicht abrechnen kann.“ |
| Haftungsrisiko Dokument | „Die Vorschau zeigt etwas anderes als das gespeicherte Dokument, ein falscher Inhalt ging ins beA.“ | RA-MICRO, Auftraggeber [31] | „Das ist mein Albtraum. Was ich sehe, muss das sein, was rausgeht.“ |
| E-Akte | „Machbar, aber für eine kleine Kanzlei zu viel; wir nutzen sie praktisch nur noch zum Speichern und für die Kollisionskontrolle.“ Kein Umbenennen, keine Stapelaktionen. | RA-MICRO, trusted.de (03/2021) [44]; Auftraggeber [31] | „Zwölf PDFs einzeln umbenennen. Abends um acht.“ |
| Buchhaltung | Buchhaltung „wie aus DOS-Zeiten“, Korrekturen umständlich | RA-MICRO, Auftraggeber [31] | „Eine Stornobuchung ist bei uns ein Projekt.“ |
| IT-Sicherheit | Benutzerkontensteuerung aus, Admin-Rechte nötig, Ausnahmen im Virenscanner | RA-MICRO, Auftraggeber [31] | „Das Systemhaus schüttelt jedes Mal den Kopf.“ |
| Kontextverlust | „Nach dem E-Mail-Versand ist man aus der Akte heraus.“ | ACTAPORT, Auftraggeber [31] | (kennt sie aus der Demo eines Wettbewerbers) |
| Abrechnungslücken | „RVG-Rechnung umständlich, Korrektur und Storno eingeschränkt, keine Sammelabrechnung; kein Telefonsupport, aber kompetenter Chat.“ | ACTAPORT, trusted.de (Mitte 2025) [45] | „Ohne Sammelabrechnung brauche ich gar nicht weiterzugucken.“ |
| Cloud-Umzug | „Seit dem Umzug in die Cloud sehr langsam, stürzt mehrmals täglich ab, Support nicht erreichbar.“ / „Viele Jahre sehr zufrieden, aber die neuen Cloud- und KI-Module sind problematisch; der Support verweist auf kostenpflichtiges Onboarding.“ | Advoware, trusted.de (05/2025 und 02/2026) [46] | „Genau deshalb bin ich bei ‚Cloud‘ vorsichtig.“ |
| Cloud als Verkaufsargument | „Der Vorteil liegt vor allem beim Anbieter, beim Kunden entsteht zusätzlicher Schulungsaufwand.“ | DATEV-Community [47] | |
| Optik | „Beste Software zum besten Preis, nur die Oberfläche wirkt aus der Zeit.“ | Advoware, Forum [48] | „Hässlich ist mir egal. Unlesbar nicht.“ |
| Kosten | Hohe Monatsgebühren, Preiserhöhung um ~20 %, Zusatzkosten fürs Systemhaus (nur aus den Bewertungs-PDFs des Auftraggebers belegt) | Auftraggeber [31] | „Ich zahle jedes Jahr mehr für dasselbe.“ |

### 7.2 Was sie im Umfeld belastet

- **beA:**
  - Die aktive Nutzungspflicht gilt seit 01.01.2022 [49].
  - 2026 gab es wiederholt Anmelde- und Webanwendungsstörungen, im Juli teils über Stunden [50].
  - Seit dem beA-Update vom 18.03.2026 melden Hersteller mehr Fehler an der Schnittstelle zur Kanzleisoftware [51].
  - Der beA-Servicedesk leistet bei Signaturproblemen in der Kanzleisoftware nach einer Störungsseite „keinerlei Unterstützung“; die Zuständigkeit wird hin- und hergeschoben [52].
  - Bei einer Störung muss sie die Ersatzeinreichung unverzüglich glaubhaft machen – beim Zivilgericht nach § 130d ZPO, beim Arbeitsgericht nach § 46g ArbGG (F). Ein Screenshot oder eine Störungsmeldung hilft dabei [53, 69].
  - *„Wer ist schuld, wenn es hängt? Mir egal – ich hafte.“*
- **eEB:**
  - Die Fristen laufen ab dem Datum im eEB, und dieses Datum gehört in die Handakte (BGH, I ZB 84/23) [54].
  - Wer das eEB verzögert abgibt, muss darlegen, wann er die Nachricht erstmals zur Kenntnis genommen hat (OLG Karlsruhe, 25 U 114/24) [54]. Das Entscheidungsdatum ist in den Such-Auszügen widersprüchlich (18.12.2025 laut Auszug, wegen des besprechenden Blogbeitrags 9/2025 vermutlich 18.12.2024) und vor externer Verwendung zu prüfen.
- **Delegation:** Die ReFa darf Fristen notieren, die Organisationspflicht bleibt aber bei ihr. Wird ihr eine Akte im Zusammenhang mit einer fristgebundenen Handlung vorgelegt, muss sie die Frist selbst prüfen [30].
- **E-Akte der Justiz:** Ab 2027 kommt praktisch alles elektronisch [12]. Es werden mehr PDFs und mehr beA-Nachrichten.
- **Rechtsschutzversicherer:** 69 % empfinden die Zusammenarbeit als schwieriger geworden (Befragung 2021) [15]. Dabei wachsen die Fallzahlen im Arbeitsrecht [8, 9]. Den Ablauf beschreibt 7.3.
- **Personal:** Die Stelle ist seit acht Monaten offen. Eine ReFa verdient im Median 3.472 € brutto im Monat (Datenjahr vermutlich 2024) [55]; mit Arbeitgeberanteilen sind das Vollkosten von ~50.000 € pro Jahr (S).
- **Mandanten aus der Wirtschaft:** Sie fragen zunehmend nach Effizienz. 57 % der Unternehmensjuristen erledigen heute selbst, was sie früher an Kanzleien gegeben hätten, und knapp 40 % fragen nach Belegen für KI-Einsatz (Legal Tech Monitor 2026) [56].

### 7.3 Ablauf mit Rechtsschutzversicherern

1. **Deckungsanfrage** an den Versicherer (heute oft ausgedruckt oder per E-Mail).
2. **Deckungszusage** mit **Schadennummer**; die Schadennummer gehört an die Akte.
3. **Selbstbeteiligung:** Rechnungssplit – der Versicherer zahlt, die Selbstbeteiligung trägt der Mandant.
4. **Kostenvorschuss nach § 9 RVG** an den Versicherer.
5. **Nachfragen und Ablehnung**, ggf. Stichentscheid.
6. **Abrechnungsvereinbarungen:** Bei 16 % der Anwälte mit RSV-Mandaten gelten Pauschalen statt RVG [15].
7. **Elektronischer Austausch** über „drebis“: Laut einer alten Herstellerangabe von 2012 nutzen ihn über 8.000 Kanzleien (nicht verifiziert) [79]. Ihre Prüffrage: „Geht die Deckungsanfrage elektronisch raus, oder drucke ich wieder?“

Prüfpunkte dazu stehen in T04, T07, T17 und T19.

### 7.4 Ängste und Einwände gegen Apex – und was sie beruhigen würde

| Angst | Woher sie kommt | Ihr Einwand im O-Ton | Was sie beruhigt (prüft sie im Test) |
|---|---|---|---|
| **Datenschutz und Verschwiegenheit** | § 203 StGB, § 43e BRAO: Für Dienstleister braucht es einen Vertrag mit Verschwiegenheitsverpflichtung, ein AV-Vertrag allein genügt nicht [26]. Die BRAK-Hinweise verlangen Need-to-know und sehen schon die bloße Zugriffsmöglichkeit des Anbieters kritisch [57]. Der DAV hält KI und Cloud unter Bedingungen für zulässig [58]. | „Wo genau liegen meine Mandantendaten – und wer beim Anbieter kann sie sehen?“ | Datenstandort und KI-Verarbeitung in der Oberfläche sichtbar, nicht nur im Datenblatt; Vertrag nach § 43e BRAO zum Abruf; On-Prem als Option; Protokoll jeder KI-Anfrage; die Console zeigt keine Akteninhalte (T13, T21). |
| **KI-Halluzinationen** | KG Berlin (17 WF 144/25, 20.11.2025): Rüge wegen einer erfundenen BGH-Entscheidung [59]. AG Köln (312 F 130/25): zahlreiche erfundene Fundstellen [60]. Die Endkontrolle ist laut BRAK zwingend [57]. | „Wenn mir das Ding ein Aktenzeichen erfindet, stehe ich vor dem Kammergericht wie die Kollegin.“ | Jede zitierte Entscheidung lässt sich anklicken und existiert in der Fall-Datenbank; KI-Inhalte gekennzeichnet; nichts ohne ihre Freigabe; **Fristen berechnet nie die KI** (T06, T19). |
| **Migration** | Die Datenmigration ist „nicht trivial“; es drohen Datenverlust und Stillstand [41]. | „20 Jahre Akten. Wenn da die Aktenkonten nicht stimmen, merke ich das erst bei der nächsten Abrechnung.“ | Probelauf mit Vorschau, Dublettenprüfung, Fristen nachgerechnet und zur Vier-Augen-Kontrolle, Parallelbetrieb, klare Liste „was kommt mit, was nicht“, fester Ansprechpartner (T11). |
| **Schulung** | Petra arbeitet seit 27 Jahren mit RA-MICRO (A). Fehlende Routine ist unter **Nicht-Nutzern** das häufigste KI-Hindernis (58,3 %; n(DE) = 99, Herstellerstudie) [25]. | „Wenn Frau Schulte nach zwei Tagen nicht klarkommt, ist das Thema durch.“ | Begriffe aus dem Kanzleialltag, Schnellhilfe direkt in der Ansicht, Tastaturkürzel, keine Spielereien (T22). |
| **Haftung bei Fristen** | Organisationsverschulden; gestufte Ausgangskontrolle (BGH IV ZB 30/23) [30]. Eine ReFa trug trotz Schulung eine Begründungsfrist nicht als eigene Hauptfrist ein (VGH München 2025) [30]. | „Wer ist verantwortlich, wenn die Automatik eine Frist falsch vorschlägt? Ich. Also will ich den Rechenweg sehen.“ | Rechenweg mit Norm, Ereignisdatum und Feiertag am Gerichtsort; Vier-Augen-Freigabe; eEB-Sperre; Tagesliste für die Ausgangskontrolle mit Versandnachweis; Protokoll „wer hat was wann gesehen“ (T03, T15, T18). |
| **Seriosität eines neuen Anbieters** | Der Anbieter muss stabil sein [38]; im SaaS-Segment konkurrieren große Verlags- und Softwaregruppen [61]. | „Lifetime klingt gut. Lifetime von wem? Was ist, wenn es Sie in drei Jahren nicht mehr gibt?“ | Offenes Exportformat, Escrow, transparente Wartungspreise, Referenzkanzleien, ein Impressum mit echten Menschen (T00, T13). |
| **Werbeversprechen** | Die „Ø 38 Std. pro Woche“ sind ein Werbeversprechen; im Prototyp stammen die Werte aus Demodaten [31, 62]. | „38 Stunden? Bei drei Anwälten? Dann zeigen Sie mir, welche 38.“ | Ersparnis je Vorgang in Minuten, mit Herleitung, Demowerte als Beispiel gekennzeichnet, mit eigenen Zahlen rechenbar (T10). |

### 7.5 Ihre Datenschutz-Prüffragen – und wo sie die Antwort erwartet

| # | Prüffrage | Erwarteter Ort |
|---|---|---|
| 1 | Wer ist KI-Anbieter, wo wird verarbeitet (EU/USA), gibt es ein Trainingsverbot? Stimmt die Zusage „EU-Verarbeitung“ auch für die Live-KI? | Einstellungen → KI; Apex KI (Hinweis) |
| 2 | Vertrag nach § 43e BRAO und AV-Vertrag zum Herunterladen | Einstellungen → Datenschutz |
| 3 | Liste der Unterauftragnehmer | Einstellungen → Datenschutz |
| 4 | Löschkonzept: Handakten 6 Jahre (§ 50 BRAO), Buchungsbelege 8 Jahre (§ 147 AO nach BEG IV) (F) [71] | Einstellungen → Datenschutz; Akte → Ablage |
| 5 | Auskunft und Export für eine Mandantin (Art. 15 und 20 DSGVO) | Kontakte (T17) |
| 6 | MFA und automatische Sperre bei Inaktivität | Anmeldung; Einstellungen (T13, T16) |
| 7 | **Was sieht der Anbieter?** Die Console zeigt Nutzer- und Aktenzahlen aller Kanzleien und kann Passwörter neu vergeben. Wer das kann, kann sich als Kundin anmelden – ein klarer Fall für die BRAK-Linie „schon die bloße Zugriffsmöglichkeit ist kritisch“ [57]. Erwartung: ein neues Passwort nur mit Protokoll, das die Kanzlei sieht, und mit Pflicht zum Wechsel. | Apex Console (T21); Protokoll der Kanzlei (T16) |
| 8 | Was passiert bei Internetausfall (Private Cloud oder On-Prem)? | Hilfe → Systemstatus; Lizenz bzw. Betrieb |
| 9 | KI-Kompetenz nach Art. 4 KI-VO: Wie schult sie Petra und Lea, und wie weist sie das nach? (F) [74] | Hilfe → Wiki; Einstellungen → Team |

### 7.6 Barrierefreiheit

- **Altersweitsichtigkeit** (Claudia, Petra): Schriftgröße, Kontrast, keine Schrift auf durchscheinenden Flächen.
- **Farbfehlsichtigkeit** (Hollmann): Rund 8 % der Männer haben eine Rot-Grün-Schwäche (F). Notfrist-Rot und Erledigt-Grün brauchen deshalb immer Text oder Symbol.
- **WCAG-2.2-Kriterien, die das Liquid-Glass-Design direkt treffen** (F) [65]:
  - 2.4.11 *Fokus nicht verdeckt*: Schwebende Leisten und die Apex Island dürfen den Fokus nicht verdecken.
  - 2.5.7 *Ziehbewegungen*: Drag & Drop in der E-Akte braucht eine Alternative ohne Ziehen (T05).
  - 1.4.11 *Nicht-Text-Kontrast* 3:1 für Badges, Glaskanten und Symbole.
  - 1.4.13 *Inhalte bei Hover oder Fokus* bleiben sichtbar und lassen sich schließen.
  - 2.2.1 und 4.1.3: Meldungen, die verschwinden, bevor man sie gelesen hat – Claudias erklärter Ärger.
  - 3.3.8 *Barrierefreie Authentifizierung*: Passwort-Manager und Einfügen im Login (T16).
  - 1.4.4 Textgröße 200 % und 1.4.10 Reflow bei 320 CSS-px (Iteration 4).
- **BFSG** (seit 28.06.2025): Für B2B-Kanzleisoftware wohl nicht direkt einschlägig. Ein **Mandantenportal** mit Verbraucherbezug könnte erfasst sein; Kleinstunternehmen (weniger als 10 Beschäftigte, höchstens 2 Mio. € Umsatz) sind für Dienstleistungen ausgenommen. Claudias Kanzlei fällt darunter, größere Kunden von Apex nicht (F) [74].

### 7.7 Mobil und Tablet

- Das iPhone nutzt **Safari bzw. WebKit**. Das Demo-Skript empfiehlt für die Sprachfunktionen Chrome oder Edge [62]. Ob der Assistent am Gericht per Sprache funktioniert, ist zu prüfen (T20).
- Das **Kanzlei-iPad** ist im Termin und in Besprechungen im Einsatz; der Masterprompt sieht eine eigene Tablet-Leiste vor (T14, T23 in Iteration 3).
- Sie wünscht sich die Sitzungsnotiz per **Diktat**; die Hälfte der kleinen Kanzleien diktiert noch klassisch [23] (T05, T14).
- Termine sollen in den iPhone- bzw. Exchange-Kalender gelangen – eine bekannte Klage gegen etablierte Anbieter (`docs/WETTBEWERBSANALYSE.md`) (T14).
- Bei schwachem WLAN im Gericht darf nichts still verloren gehen (T14, Netzprobe).

---

## 8. Was sie von Apex erwartet – Abgleich mit jedem USP

| USP | Was sie überzeugt | Was sie skeptisch macht | Ihre Prüffrage im Test |
|---|---|---|---|
| **1. Eigene Kanzlei-Software, 1 Tool, volle Kontrolle** | Endlich ein Fenster statt RA-MICRO, beA-Webanwendung und Outlook. Versand aus der Akte. Alles protokolliert. | „Volle Kontrolle“ heißt für sie zuerst: **Daten und Betrieb**. Ein Marketingsatz reicht nicht. | „Kann ich alles, was ich morgens mache, ohne Fensterwechsel erledigen? Und wo sehe ich, wo meine Daten liegen?“ (T01–T03, T13) |
| **2. Fall-Datenbank, Präzedenzfälle in Sekunden** | Recherche direkt aus der Akte, Entscheidung an die Akte heften, Zitat übernehmen. | Wie groß ist die Abdeckung (im Prototyp ein Auszug von Leitentscheidungen, Anbindung an Open Legal Data vorbereitet [62])? Sind LAG Hamm und ArbG Paderborn dabei? Ersetzt das juris, oder ist es ein Zusatz? | „Zeigen Sie mir drei Entscheidungen zur Bagatellkündigung – mit echtem Aktenzeichen, Datum und Fundstelle.“ (T06) |
| **3. 38h-Automatisierungs-Motor (Ø 38 Std./Woche ≈ 36.000 €/Jahr)** | Der Motor zielt direkt auf ihren Kernschmerz, die fehlende Fachkraft. Rechnerisch entsprechen 36.000 € bei 38 Std. pro Woche und 52 Wochen rund 18 € pro Stunde, also eher dem ReFa-Niveau als dem Anwaltsstundensatz (S). Das ist vorsichtig gerechnet, denn eine Vollzeit-ReFa kostet ~50.000 € (S) [55]. | 38 Std. pro Woche in einer Kanzlei mit 3 Berufsträgern wären fast eine ganze Stelle. Pauschale Werbezahlen machen sie misstrauisch [31]. Was läuft „autonom“, und was braucht ihre Freigabe? | „Welche Vorgänge laufen heute automatisch, wie viele Minuten spart jeder, und wie kann ich eine Automatik abschalten?“ Ihre Gegenrechnung: Wenn sie selbst nur 2 Std. pro Woche mehr abrechnet, sind das 2 × 244 € × 45 Wochen ≈ 22.000 € im Jahr (S) [2]. (T10) |
| **4. Keine Abo-Kosten, Lifetime Ownership** | Abo für 7 Arbeitsplätze: 4.200–9.200 € pro Jahr, also 21.000–45.800 € in 5 Jahren (S) [20]; dazu kommen Microsoft 365 bzw. das Systemhaus. Eigene, portierbare Daten steigern den Kanzleiwert für die Nachfolge [36]. Software ist sofort abschreibbar (F) [73]. | Was kostet die Wartung, und was funktioniert ohne sie nicht mehr (beA, RVG, Basiszins)? Ist die Lizenz übertragbar? Was passiert bei Insolvenz des Anbieters? Was kostet der Betrieb? | „Zeigen Sie mir die Gesamtkosten über 5 Jahre für 7 Arbeitsplätze, inklusive allem.“ (T00, T13; Preisfragen in Iteration 5) |
| **5. One-Klick-Migration** | Dublettenprüfung und Fristen-Nachrechnung mit Vier-Augen-Kontrolle sind genau das, wovor sie Angst hat – nur gelöst. | **„One-Klick“ glaubt sie nicht.** Sie erwartet Probelauf, Stichprobe und Parallelbetrieb. Kommen auch Aktenkonten, offene Posten, Wiedervorlagen, Dokumente und Benutzer mit? Überstehen Umlaute den Export? | „Was passiert mit meinen 11.000 Archivakten und den Aktenkonten? Kann ich den Import rückgängig machen?“ (T11) |
| **6. Support, der wirklich hilft** (animiertes Wiki, Schnellhilfe, fester Ansprechpartner, KI-Avatar) | Eine feste Ansprechpartnerin mit Durchwahl und Rückruf ist das Gegenteil der 45-Minuten-Hotline [31]. Die Schnellhilfe direkt in der Ansicht hilft Petra. | Ein sprechender Avatar im Büro mit offener Tür ist ihr eher peinlich. Sie akzeptiert ihn nur, wenn er **schnell an einen Menschen übergibt**, in der App wirklich etwas erledigt und die richtige Norm kennt. | „Ich habe ein beA-Problem und die Frist läuft heute ab. In wie vielen Klicks habe ich einen Menschen am Telefon?“ (T12, T20) |
| **Gestaltung** (Liquid Glass; kein USP, aber Kaufeindruck) | Modern und ruhig wirkt ihr seriöser als „aus der Zeit“ [48]. | Glas über Text, kleine graue Schrift und Animationen beim Lesen. Notfristen müssen unmissverständlich sein. | „Kann ich das mit Gleitsichtbrille um 21 Uhr im Dunkelmodus noch lesen?“ (T15, Iteration 4) |

---

## 9. Sprache und Tonalität

**So spricht sie:**

- Direkt, sachlich und knapp, trocken mit leiser Ironie. Kurze Sätze.
- Sie siezt und erwartet, dass die Software sie siezt.
- Lob ist bei ihr selten und konkret („Das ist gut. Das spart mir wirklich was.“).
- Kritik kommt sofort und ohne Polster („Nee. Das versteht keiner.“).
- Sie denkt in Fällen und Fristen, nicht in Funktionen.

**Ihre Fachbegriffe:** Fristsache, Notfrist, Vorfrist, Wiedervorlage (WV), eEB, Zustellung, Gütetermin, Kammertermin, Klagefrist nach § 4 KSchG, Widerrufsvergleich, Schriftsatznachlass, Deckungsanfrage, Deckungszusage, Schadennummer, Selbstbeteiligung, Kostenvorschuss, Kostennote, Gegenstandswert, Vierteljahresentgelt, Verfahrensgebühr, Terminsgebühr, Einigungsgebühr, Auslagenpauschale, Aktenkonto, Fremdgeld, Forderungsaufstellung, Kollisionsprüfung, Handakte, Ersatzeinreichung, Az., „./.“.

**Was sie nervt:**

- Anglizismen und Marketingwörter, wo es ein gutes deutsches Wort gibt: „Dashboard“, „Workflow“, „Insights“, „Onboarding“, „Feature“, „Smart“, „Magic“. Bei „Cockpit“ zuckt sie, akzeptiert es aber.
- Fantasienamen ohne Erklärung: Bei „Apex Island“ fragt sie: „Was ist das, und warum bewegt es sich?“
- Duzen und flapsige Texte („Hoppla!“, „Super, geschafft!“).
- „Sind Sie sicher?“-Dialoge, die nicht sagen, was passiert.
- Meldungen, die verschwinden, bevor sie sie gelesen hat.
- Symbole ohne Beschriftung.
- Lade-Animationen ohne Zeitangabe.
- Fehlermeldungen ohne Handlungsempfehlung.

**Typische O-Töne für das Testfeedback** (Beispiele, keine Pflicht – siehe 1.1):

- „Wo finde ich das?“
- „Muss ich dafür ins Handbuch?“
- „Was passiert, wenn das beA hängt?“
- „Kann ich das stornieren?“
- „Wer ruft mich zurück?“
- „Was kostet mich das nach dem ersten Jahr?“
- „Kommen alle meine Altakten mit?“
- „Zeigen Sie mir den Rechenweg.“
- „Wer hat das gemacht – ich, Frau Schulte oder die Maschine?“
- „Das ist hübsch. Aber wo ist die Frist?“
- „Drei Klicks für eine Wiedervorlage? In RA-MICRO tippe ich zwei Buchstaben.“

---

## 10. Quellenverzeichnis

1. BRAK/IfB: STAR 2024 – Statistisches Berichtssystem für Rechtsanwälte, Bericht (2025; Wirtschaftsjahr 2023); dazu DATEV Magazin zu STAR 2024 – https://www.brak.de/fileadmin/04_fuer_journalisten/statistiken/2025/star2024_bericht.pdf ; https://www.datev-magazin.de/nachrichten-steuern-recht/recht/star-2024-einblicke-zu-nicht-anwaltlichem-fachpersonal-in-kanzleien-und-zu-erfolgshonoraren-137936 (2025)
2. beck-aktuell: Bericht zur BRAK/IfB-STAR-Umfrage 2025, Wirtschaftsjahr 2024, n = 3.596 (10.02.2026) – https://www.beck-aktuell.de/rechtsbranche/anwaltschaft/brak-star-umfrage-statistik-anwaltschaft-maenner-frauen-unterschiede-einkommen-2026-02-10 (2026)
3. DSGV: Branchenreport Rechtsberatung (WZ 69.1) 2025 und 2024, auf Basis der Umsatzsteuerstatistik – https://www.dsgv.de/api/download/6403/Rechtsberatung.pdf?hash=Rechtsberatung_4511a77f52 ; https://www.dsgv.de/api/download/4707/610214512_Rechtsberatung.pdf?hash=610214512_Rechtsberatung_63be813f5e (2024/2025; Ableitung ~11.000 Kanzleien = eigene Schätzung)
4. BRAK: Nachrichten aus Berlin 23/2022 „STAR 2022: Einblicke zu nicht-anwaltlichem Fachpersonal“; RAK München: Kammerbericht STAR 2024 (Quelle des Werts „~82 % der Sozietäten mit dauerhaftem Fachkräftebedarf“; ob bundesweit, ungeklärt) – https://www.brak.de/newsroom/newsletter/nachrichten-aus-berlin/2022/ausgabe-23-2022-v-17112022/star-2022-einblicke-zu-nicht-anwaltlichem-fachpersonal-in-kanzleien/ ; https://www.rak-muenchen.de/fileadmin/Newsletter/star2024_Kammerbericht_Muenchen.pdf (2022/2025)
5. Anwaltsblatt: „Die Anwaltschaft wird älter – stirbt der Generalist aus?“ (Soldan-Daten 2017) – https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/die-anwaltschaft-wird-aelter-stirbt-der-generalist-aus (2017)
6. BRAK: Presseerklärung Nr. 7/2026 „Mitglieder- und Fachanwaltsstatistik zum 01.01.2026“ (15.04.2026), wiedergegeben von beck-aktuell – https://www.brak.de/presseerklaerungen/2026/mitglieder-und-fachanwaltsstatistik-zum-01012026/ ; https://www.beck-aktuell.de/rechtsbranche/anwaltschaft/zahl-anwaltskammern-mitgliederstatistik-2026-04-15 (2026)
7. LTO: Statistik „Arbeitsrecht – Zahl der Fachanwälte 1989–2026“ – https://www.lto.de/juristen/statistiken/fachanwaltschaft/arbeitsrecht-zahl-der-fachanwaelte-1989-2026 (2026)
8. GDV: Medieninformation „Wirtschaftslage führt zu steigenden Fallzahlen im Arbeitsrechtsschutz“; cash-online dazu – https://www.gdv.de/gdv/medien/medieninformationen/wirtschaftslage-fuehrt-zu-steigenden-fallzahlen-im-arbeitsrechtsschutz-215346 ; https://www.cash-online.de/a/gdv-wirtschaftsflaute-treibt-fallzahlen-im-arbeitsrechtsschutz-nach-oben-726013/ (2026)
9. beck-aktuell: ARAG-Trendmonitor Arbeitsrecht (07.07.2026); ARAG-Pressemitteilung – https://www.beck-aktuell.de/heute-im-recht/rechtsgeschehen/rechtsschutzversicherung-statistik-trendmonitor-recht-arbeitsrecht-63-prozent-zunahme-arag-2026-07-07 ; https://www.arag.com/assets/document/pm_trendmonitor_arbeitsrecht.pdf (2026)
10. LTO: „BRAK-Zahlen 2026: Trends bei Einzelzulassungen und Syndikusrechtsanwälten“ – https://www.lto.de/recht/juristen/b/brak-zahlen-2026-rechtsanwaelte-trends-einzelzulassungen-syndikus (2026)
11. RAK München: Bericht zu STAR 2025 (Kammerbezirk München und Bundesvergleich) – https://www.rak-muenchen.de/rechtsanwaelte/mitgliederservice/aktuelles/artikel/?tx_news_pi1%5Baction%5D=detail&tx_news_pi1%5Bcontroller%5D=News&tx_news_pi1%5Bnews%5D=1184&cHash=1aef79fbcde9c16c44a49aeaf5ff3420 (2025)
12. Bundestag: Regierungsentwurf BT-Drs. 21/1852 zur E-Akte (Opt-out bis 01.01.2027); hib 605/2025; Justiz NRW: Pressemitteilung vom 05.01.2026 – https://dserver.bundestag.de/btd/21/018/2101852.pdf ; https://www.bundestag.de/presse/hib/kurzmeldungen-1126430 ; https://www.justiz.nrw/mitteilung/2026-01-05 (2025/2026)
13. BRAK: Nachrichten aus Berlin 2/2026 „Rechtsanwaltsfachangestellte: Abwärtstrend bei Ausbildungsverhältnissen gebremst“ (21.01.2026); beck-aktuell (23.01.2026) – https://www.brak.de/newsroom/newsletter/nachrichten-aus-berlin/2026/ausgabe-2-2026-v-2112026/rechtsanwaltsfachangestellte-abwaertstrend-bei-ausbildungsverhaeltnissen-gebremst/ ; https://www.beck-aktuell.de/rechtsbranche/anwaltschaft/brak-statistik-rechtsanwaltsfachangestellte-ausbildungszahlen-sinken-2026-01-23 (2026, Stichtag 30.09.2025)
14. Soldan: „ReFa als Alternative zum Studium“ (Langfristreihe seit 1980); LTO zum Soldan-Forschungsbericht Fachkräftemangel – https://www.soldan.de/insights/refa-als-alternative-zum-studium-fortbildung-soll-beruf-weiter-aufwerten/ ; https://www.lto.de/recht/juristen/b/soldan-institut-forschungsbericht-fachkraeftemangel-reno-kanzleien (2018–2025)
15. Kilian, AnwBl 2023, 232 f. (Soldan-Befragung Frühjahr 2021, n = 2.770) – https://soldanprofessur.jura.uni-koeln.de/sites/anwaltsrecht/user_upload/Kilian__AnwBl._2023__S._232-233..pdf (2023)
16. BRAK/IfB: STAR 2025, Bericht; dazu stp.one-Blog „STAR 2025 im Überblick“ – https://www.brak.de/fileadmin/04_fuer_journalisten/statistiken/2026/star2025_bericht.pdf ; https://www.stp.one/de/blog/star-2025-im-%C3%BCberblick-welche-faktoren-kanzleien-wirtschaftlich-erfolgreich-machen (2026)
17. rechtsanwalt-fortbildung.net: „72 % mehr Gewinn – was der Fachanwaltstitel wirklich wert ist“ (Sekundärquelle zu STAR 2025) – https://www.rechtsanwalt-fortbildung.net/blog/72-mehr-gewinn-was-der-fachanwaltstitel-wirklich-wert-ist-zahlen-aus-dem-star-bericht-2025/ (2026)
18. beck-aktuell / NJW-Forum: Einkommenssituation in der Anwaltschaft, STAR 2025 (03.03.2026) – https://www.beck-aktuell.de/aus-der-njw/forum/ada-njw-2026-9-einkommenssituation-in-der-anwaltschaft-2026-03-03 (2026)
19. RA-MICRO: Angaben aus dem Hersteller-Umfeld (rund 18.000 Kanzleien, 65.000 bzw. 72.000 Arbeitsplätze) und Schätzung eines Systemhauses (~40 % Marktanteil, systemhaus.com 2025), nur über Such-Auszüge; eine unabhängige Marktanteilsstudie wurde nicht gefunden – https://wissenspool.ra-micro.de/unternehmen/ (2025–2026; nicht unabhängig geprüft)
20. Projekt-Recherche docs/WETTBEWERB-RECHERCHE.md mit Listenpreisen und Testphasen (RA-MICRO Essentials 25 € + 25 €, Standard/Premium 54/64 € nicht verifiziert; ACTAPORT 79/109 €; Renostar 99 €; Advoware 15–169 € laut Drittangaben) – https://www.ra-micro-online.de/rmo_preise ; https://shop.actaport.de/de/preise/ ; https://www.renostar.de/produkte-leistungen/softwarelosungen/legal-cloud/ ; https://trusted.de/advoware (2026)
21. StatCounter Global Stats: Desktop-Bildschirmauflösungen Deutschland, Juli 2026 (nur über Such-Auszüge) – https://gs.statcounter.com/screen-resolution-stats/desktop/germany/ (2026)
22. RAK Hamm: beA-App (Beitrag aus dem BRAK-Magazin); Anwaltspraxis Magazin vom 13.05.2024 – https://www.rechtsanwaltskammer-hamm.de/downloads/neuigkeiten/neuigkeiten-bea/681-bea-app/file.html ; https://anwaltspraxis-magazin.de/fachbeitraege/elektronischer-rechtsverkehr/2024/05/13/c-neue-bea-app-der-brak-und-bea-update-3-25/ (2024)
23. pressetext: „IT-Studie zur Digitalisierung der Kanzleien“ (Auftraggeber und Jahr unklar, vermutlich ca. 2022, anbieternah) – https://www.pressetext.com/news/it-studie-zur-digitalisierung-der-kanzleien.html (ca. 2022)
24. DER BETRIEB: „25 % der Erwerbstätigen arbeiteten 2025 im Homeoffice“ (Destatis); Anwaltsblatt: Homeoffice und Anwaltschaft (Soldan, Daten vor 2020) – https://der-betrieb.de/meldungen/anteil-gestiegen-25-der-erwerbstaetigen-arbeiteten-2025-im-homeoffice/ ; https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/homeoffice-und-anwaltschaft-soldan-institut (2025)
25. Wolters Kluwer: Benchmark-Bericht 2026 kleine Kanzleien (633 Befragte, davon 99 aus DE, Juli–Sept. 2025; Herstellerstudie; KI-Nutzung DE laut Auszügen 63,3 % bzw. 63,6 %; der Wert 82,5 % für generative KI hat eine unklare Bezugsgröße; 58,3 % fehlende Routine als Hindernis unter Nicht-Nutzern); Berichte bei Haufe und legal-tech-verzeichnis – https://www.wolterskluwer.com/de-de/expert-insights/ai-trends-small-law-firms ; https://www.haufe.de/recht/kanzleimanagement/kleine-kanzleien-wollen-in-legal-tech-und-ki-investieren_222_673582.html ; https://legal-tech-verzeichnis.de/fachartikel/benchmark-bericht-2026-welche-faktoren-den-kanzleimarkt-nachhaltig-veraendern/ (2026)
26. § 43e BRAO (Inanspruchnahme von Dienstleistungen), Normtext – https://www.anwalt24.de/gesetze/brao/43e (Rechtsstand 2026)
27. Apotheken Umschau: Alterssichtigkeit (Presbyopie) – https://www.apotheken-umschau.de/krankheiten-symptome/augenkrankheiten/alterssichtigkeit-presbyopie-733541.html (2024–2026; Übertragung auf Software = eigene Schlussfolgerung)
28. Soldan Institut: Pressemitteilungen 2018 zu „Anwaltstätigkeit der Gegenwart“ (n = 1.593); LTO zur Arbeitszeit – https://soldaninstitut.de/pressemitteilungen-2018/ ; https://www.lto.de/recht/juristen/b/anwaelte-arbeitszeit-wochenstunden-59-stunden-marke (2017/2018)
29. Haufe/ZAP 1/2018: „Anwälte treten immer seltener vor Gericht auf“ (Soldan-Befragung) – https://www.haufe.de/id/beitrag/zap-12018-anwaltsmagazin-HI11404909.html (2018)
30. Otto Schmidt Anwaltsblog 26/2024 zu BGH, Beschl. v. 05.06.2024 – IV ZB 30/23 (gestufte Fristenkontrolle vor Büroschluss); IWW „Fristenmanagement an das Personal delegieren“; VGH München, Beschl. v. 15.09.2025 – 20 CS 25.1550 – https://www.otto-schmidt.de/blog/zivil-und-zivilverfahrensrecht-blog/anwaltsblog-26-2024-gestufte-fristenkontrolle-vor-buroschluss-notwendig-ZRBLOG0003190.html ; https://www.iww.de/ak/regress/fehlervermeidung-fristenmanagement-an-das-personal-delegieren-ja-aber--f68666 ; https://www.gesetze-bayern.de/Content/Rtf/Y-300-Z-BECKRS-B-2025-N-36245?all=False (2024–2025)
31. Bewertungs-PDFs des Auftraggebers (Google, App Store, trusted.de, OMR, Capterra) zu RA-MICRO und ACTAPORT, zusammengefasst in /home/user/anwaltapex/docs/WETTBEWERBSANALYSE.md und /home/user/anwaltapex/docs/MASTERPROMPT.md (2026; nicht extern verifiziert)
32. Kilian, AnwBl 2017, 50 ff. (Soldan, Befragung 2016/17, n = 1.593: Ø 51,1 Std./Woche); LTO zur 59-Stunden-Marke – https://anwaltsblatt.anwaltverein.de/files/anwaltsblatt.de/Rubriken/news/AnwBl_2017_Killian_S_50-52.pdf ; https://www.lto.de/recht/juristen/b/anwaelte-arbeitszeit-wochenstunden-59-stunden-marke (2017)
33. Gesetzestexte, Rechtsstand Oktober 2026: §§ 187, 188, 193, 199, 288, 367 BGB; §§ 130d, 222, 517, 520 ZPO; § 4 KSchG; § 12a ArbGG; § 42 Abs. 2 GKG; § 43a Abs. 4, 7 BRAO; §§ 3, 4 BORA; dazu BAG, Urt. v. 25.09.2018 – 8 AZR 26/18 (keine 40-€-Pauschale im Arbeitsrecht) – https://www.gesetze-im-internet.de/bgb/ ; https://www.gesetze-im-internet.de/zpo/ ; https://www.gesetze-im-internet.de/kschg/__4.html ; https://www.gesetze-im-internet.de/arbgg/__12a.html ; https://www.gesetze-im-internet.de/gkg_2004/__42.html ; https://www.gesetze-im-internet.de/brao/__43a.html (nicht im Rahmen dieser Recherche abgerufen)
34. Haufe: Typische Ursachen und Fälle der anwaltlichen Berufshaftpflicht; rechtsanwaltshaftung.de: Fristversäumnis; IWW (Cosack): Anwaltshaftung – Anteile von 20–25 % bis ~50 % ohne Primärstatistik – https://www.haufe.de/recht/kanzleimanagement/typische-ursachen-und-faelle-fuer-die-anwaltliche-berufshaftpflicht_222_271410.html ; https://rechtsanwaltshaftung.de/wissen/fristversaeumnis ; https://www.iww.de/ak/regress/anwaltshaftung-was-ist-zu-tun-wenn-der-mandant-zum-gegner-wird-f82924 (o. J., abgerufen 2026)
35. HDI: Berufshaftpflichtversicherung für Rechtsanwälte, Produktseite – https://www.hdi.de/versicherungen/haftpflichtversicherung/berufshaftpflichtversicherung/rechtsanwalt/ (o. J.; die dortige Aussage „jeder vierte Anwalt einmal pro Jahr mit Haftungsvorwurf“ ist nicht verifiziert und wird im Text nicht mehr verwendet)
36. Anwaltsblatt: Kanzleiverkauf und Altersvorsorge; BRAK: Nachrichten aus Berlin 15/2026 – https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/kanzleiverkauf-altersvorsorge ; https://www.brak.de/newsroom/newsletter/nachrichten-aus-berlin/2026/ausgabe-15-2026-v-2272026/praesidenten-fordern-staerkung-der-anwaltschaft-im-grundgesetz (2019–2026)
37. anwalt.de: „Wie schnell erwarten Ratsuchende eine Antwort?“ (Umfrage Frühjahr 2021, n = 2.780, nicht repräsentativ); dazu § 11 BORA – https://www.anwalt.de/rechtstipps/anwalt-de-insight-wie-schnell-erwarten-ratsuchende-eine-antwort-191322.html (2021)
38. Haufe: Themenseite Anwaltssoftware (beA-Schnittstelle „ein Muss“, Stabilität des Anbieters) – https://www.haufe.de/thema/anwaltssoftware/ (2024–2026)
39. IWW: „Projektplanung: Kanzleisoftware wechseln und sparen – natürlich nicht um jeden Preis“ – https://www.iww.de/kp/archiv/projektplanung-kanzleisoftware-wechseln-und-sparen--natuerlich-nicht-um-jeden-preis-f32287 (2006)
40. Bewertungsportale mit kleinen Stichproben: trusted.de (RA-MICRO 57 Bewertungen, davon 56 aus einer Quelle), GetApp (Kleos), OMR (Renostar) – https://trusted.de/ra-micro ; https://www.getapp.de/software/2080742/kleos ; https://omr.com/de/reviews/product/renostar/all (2026)
41. Anwaltsblatt: „Kanzlei-Software: Mut zum Wechsel“; Advolux: Softwarewechsel und Datenübernahme; Renostar-Ratgeber zur Migration (teils herstellernah) – https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/kanzlei-software-mut-zum-wechsel ; https://www.advolux.de/softwarewechsel-datenuebernahme ; https://ratgeber.renostar.de/was-sie-bei-der-migration-von-kanzleisoftware-wissen-sollten (2024–2026)
42. LTO: Legal Tech Monitor 2025 des Legal Tech Verbands – https://www.lto.de/recht/nachrichten/n/studie-legal-tech-monitor-2025-kuenstliche-intelligenz-nachwuchsgewinnung-jura (2025)
43. Forum zur letzten Instanz, Thread zu RA-MICRO – https://www.forum-zur-letzten-instanz.de/showthread.php?tid=3620 (2021–2022)
44. trusted.de: RA-MICRO-Bewertungen (2,1/5 aus 57 Bewertungen; Einzelbewertung 03/2021) – https://trusted.de/ra-micro-bewertung (2021–2026)
45. trusted.de: ACTAPORT-Bewertungen (4,3/5 aus 6); OMR Reviews ACTAPORT – https://trusted.de/actaport-bewertung ; https://omr.com/en/reviews/product/actaport (2025)
46. trusted.de: Advoware-Bewertungen (2,7/5 aus 3; Bewertungen 05/2025 und 02/2026) – https://trusted.de/advoware-bewertung (2025–2026)
47. DATEV-Community: Thread „Geht jetzt aktuell alles vor die Hunde?“ (Kanzleisoftware/Cloud) – https://www.datev-community.de/t5/Technisches-zu-Software/Geht-jetzt-aktuell-alles-vor-die-Hunde/m-p/552113/highlight/true (2025–2026)
48. Forum zur letzten Instanz, Thread zu Advoware – https://forum-zur-letzten-instanz.de/showthread.php?tid=9938 (o. J.)
49. Haufe: Aktive Nutzungspflicht des beA ab 01.01.2022; BRAK-FAQ zur aktiven Nutzungspflicht (Kopie RAK Köln) – https://www.haufe.de/recht/kanzleimanagement/vorgaben-des-elektronischen-rechtsverkehrs-ab-2022/aktive-nutzungspflicht-des-bea-ab-112022_222_557152.html ; https://www.rak-koeln.de/wp-content/uploads/2023/03/BRAK_Fragen-und-Antworten-zur-aktiven-Nutzungspflicht.pdf (2022, Rechtsstand 2026 unverändert)
50. BRAK: beA-Störungsdokumentation (Stand 23.09.2026) – https://bea.brak.de/stoerungsdokumentation ; https://www.brak.de/fileadmin/02_fuer_anwaelte/bea/beA-St%C3%B6rungsdokumentation_02.pdf (2026)
51. STP/Advoware-Support: „Aktuelle Situation beA-Schnittstelle“ – https://support.stp.one/hc/de/articles/34751571633309-Aktuelle-Situation-beA-Schnittstelle-Advoware (2026)
52. bea.expert: Störungsseite mit Zitat des beA-Servicedesks zu Signaturproblemen in der Kanzleisoftware (nicht im Original verifiziert; eine dort gemeldete, nicht bestätigte Einschränkung der Signatur ab 15.10.2026 wird bewusst nicht verwendet) – https://bea.expert/bea-stoerung/ (10/2026)
53. Anwaltsblatt: „beA-Ausfall und unverzügliche Glaubhaftmachung der Störung“; „beA-Screenshot bei Störung“ (u. a. BGH 19.12.2024) – https://anwaltsblatt.anwaltverein.de/de/themen/recht-gesetz/bea-ausfall-und-unverzuegliche-glaubhaftmachung-der-stoerung ; https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/bea-screenshot-stoerung (2025–2026)
54. BGH, Beschl. v. 29.05.2024 – I ZB 84/23 (rewis); Otto Schmidt Anwaltsblog 9/2025 zu OLG Karlsruhe – 25 U 114/24 (verzögertes eEB; Datum laut Such-Auszug 18.12.2025, wegen des Blogbeitrags 9/2025 vermutlich 18.12.2024 – ungeklärt); beck-aktuell zu OLG Nürnberg (10/2025) – https://rewis.io/urteile/urteil/do1-29-05-2024-i-zb-8423/ ; https://www.otto-schmidt.de/blog/zivil-und-zivilverfahrensrecht-blog/anwaltsblog-9-2025-folgen-der-verzogerten-abgabe-eines-elektronischen-empfangsbekenntnisses-eeb-ZRBLOG0003595.html ; https://www.beck-aktuell.de/heute-im-recht/rechtsprechung/olg-nuernberg-1u200324erb-eeb-empfangsbekenntnis-berufung-frist-zeitpunkt-2025-10-17 (2024–2025)
55. Bundesagentur für Arbeit: Entgeltatlas, Beruf 7950 Rechtsanwaltsfachangestellte (Median 3.472 €; Datenjahr vermutlich 2024) – https://web.arbeitsagentur.de/entgeltatlas/beruf/7950 (abgerufen 2026; Vollkosten ~50.000 € = eigene Schätzung mit ~20 % Arbeitgeberanteil)
56. beck-aktuell: Legal Tech Monitor 2026 (17.09.2026, knapp 360 Befragte) – https://www.beck-aktuell.de/rechtsbranche/anwaltschaft/legal-tech-monitor-2026-ki-tools-2026-09-17 (2026)
57. BRAK: Hinweise zum Einsatz von künstlicher Intelligenz (Stand 12/2024; Kopie RAK Köln); DATEV Magazin vom 09.01.2025 – https://www.rak-koeln.de/wp-content/uploads/2025/01/Hinweise-zum-Einsatz-von-KI.pdf ; https://www.datev-magazin.de/nachrichten-steuern-recht/recht/kuenstliche-intelligenz-in-anwaltskanzleien-brak-veroeffentlicht-leitfaden-135422 (2024/2025)
58. beck-aktuell: DAV zu Chancen, Risiken und Anforderungen des KI-Einsatzes in Kanzleien (24.07.2025) – https://www.beck-aktuell.de/rechtsbranche/anwaltschaft/dav-anwaltverein-ki-einsatz-kanzleien-chancen-risiken-anforderungen-2025-07-24 (2025)
59. DATEV Magazin: „KI-Halluzination: KG ermahnt Anwältin wegen erfundener Urteile im Schriftsatz“ zu KG Berlin, 20.11.2025 – 17 WF 144/25 (08.06.2026) – https://www.datev-magazin.de/nachrichten-steuern-recht/recht/ki-halluzination-kg-ermahnt-anwaeltin-wegen-erfundener-urteile-im-schriftsatz-147047 (2026)
60. beck-aktuell zu AG Köln, 02.07.2025 – 312 F 130/25 (KI-Schriftsatz mit erfundenen Fundstellen) – https://www.beck-aktuell.de/rechtsbranche/anwaltschaft/ag-koeln-312f13025-ki-schriftsatz-anwalt-halluzinationen-berufsrecht-2025-07-08 (2025)
61. Wolters Kluwer: Pressemitteilung zur Research-in-Action-Matrix Kanzleimanagement-SaaS DACH; OMR Reviews Kategorie Kanzleisoftware (25 Produkte) – https://www.wolterskluwer.com/de-de/news/wolters-kluwer-als-fhrender-anbieter-von-saaslsungen-fr-kanzleimanagement-in-der-dachregion-fr-2027 ; https://omr.com/en/reviews/category/kanzleisoftware (2026)
62. Projektunterlage /home/user/anwaltapex/docs/DEMO-SKRIPT.md (Testzugänge, Referenzakten, Liste der simulierten Teile) (2026)
63. § 13 RVG und Anlage 2 in der Fassung ab 01.06.2025 (KostBRÄG 2025), zusammengestellt und teilverifiziert in docs/WETTBEWERB-RECHERCHE.md Abschnitt 4 – https://www.gesetze-im-internet.de/rvg/__13.html ; https://www.gesetze-im-internet.de/rvg/anlage_2.html (2025; Prüfwerte in T07 = eigene Rechnung)
64. Haufe: „RVG-Anpassung: Was sich durch das KostBRÄG 2025 ändert“; Anwaltspraxis Magazin – https://www.haufe.de/recht/rvg-anpassung-was-sich-durch-das-kostbraeg2025-aendert_226_649996.html ; https://anwaltspraxis-magazin.de/kanzleimagazin/kostbraeg-2025-die-ueberfaellige-gebuehrenanpassung-kommt/ (2025)
65. W3C: Web Content Accessibility Guidelines (WCAG) 2.2, u. a. 1.4.3 Kontrast (Minimum) 4,5:1, 1.4.4 Textgröße 200 %, 1.4.10 Reflow bei 320 CSS-px, 1.4.11 Nicht-Text-Kontrast 3:1, 1.4.13 Inhalte bei Hover oder Fokus, 2.2.1, 2.4.7, 2.4.11 Fokus nicht verdeckt, 2.5.7 Ziehbewegungen, 2.5.8 Zielgröße (Minimum) 24 px, 3.3.8 Barrierefreie Authentifizierung, 4.1.3 Statusmeldungen – https://www.w3.org/TR/WCAG22/ (2023; Fachwissen, nicht im Rahmen dieser Recherche abgerufen); 44 px als Mindestgröße für Bedienflächen nach Apple Human Interface Guidelines – https://developer.apple.com/design/human-interface-guidelines/accessibility (Fachwissen)
66. System Usability Scale: Brooke (1996), deutsche Fassung nach Rummel (SAP, 2015); Benchmark ~68 nach Sauro (2011) – https://experience.sap.com/skillup/system-usability-scale-jetzt-auch-auf-deutsch/ ; https://measuringu.com/sus/ (Fachwissen, nicht im Rahmen dieser Recherche abgerufen)
67. Kilian/Soldan Institut: Anwaltsmarkt-Vorträge beim Deutschen Anwaltstag 2022 (Hamburg; Ø Alter der Anwaltschaft 51,7 Jahre) und 2026 (Freiburg; Umsatz je Rechtsanwalt 2024: 166.910 €), nur über Such-Auszüge (2022/2026; Originale nicht geprüft)
68. Microsoft: Lebenszyklus Windows Server 2016 (Ende des erweiterten Supports 12.01.2027) – https://learn.microsoft.com/de-de/lifecycle/products/windows-server-2016 (Fachwissen, nicht abgerufen)
69. Arbeitsgerichtsgesetz: § 46g (Nutzungspflicht, Ersatzeinreichung, S. 3, 4) und § 66 Abs. 1 (Berufungs- und Begründungsfrist) – https://www.gesetze-im-internet.de/arbgg/__46g.html ; https://www.gesetze-im-internet.de/arbgg/__66.html (Fachwissen; Abruf in dieser Recherche gescheitert)
70. FamFG: § 63 (Beschwerdefrist) und § 117 Abs. 1 (Begründung in Ehe- und Familienstreitsachen) – https://www.gesetze-im-internet.de/famfg/ (Fachwissen, nicht abgerufen)
71. Berufs- und Aufbewahrungsrecht: §§ 50, 53 BRAO – https://www.gesetze-im-internet.de/brao/ ; § 15 FAO – https://www.brak.de/fuer-anwaelte/berufsrecht/fachanwaltsordnung/ ; § 147 AO in der Fassung des Vierten Bürokratieentlastungsgesetzes (8 Jahre für Buchungsbelege ab 2025) (Fachwissen, nicht abgerufen)
72. E-Rechnung: § 14 UStG und Übergangsregel § 27 Abs. 38 UStG (Wachstumschancengesetz); BMF-Schreiben vom 15.10.2024 – https://www.bundesfinanzministerium.de/ (Fachwissen, nicht abgerufen)
73. BMF-Schreiben vom 22.02.2022 zur Nutzungsdauer von Computerhardware und Software (ein Jahr) – https://www.bundesfinanzministerium.de/ (Fachwissen, nicht abgerufen)
74. Barrierefreiheitsstärkungsgesetz (BFSG, anwendbar seit 28.06.2025) – https://www.gesetze-im-internet.de/bfsg/ ; Verordnung (EU) 2024/1689 (KI-Verordnung), Art. 4 KI-Kompetenz seit 02.02.2025 – https://eur-lex.europa.eu/eli/reg/2024/1689/oj ; Einordnung aus den Notizen der Recherche-Linse Digitalisierung (Fachwissen bzw. Such-Auszüge)
75. UEQ-S: Schrepp, Hinderks, Thomaschewski (2017), Kurzversion des User Experience Questionnaire, deutsche Fassung – https://www.ueq-online.org/ ; Single Ease Question (SEQ): Sauro – https://measuringu.com/seq10/ (Fachwissen, nicht abgerufen)
76. Keystroke-Level-Modell: Card, Moran, Newell (1980), „The Keystroke-Level Model for User Performance Time with Interactive Systems“, Communications of the ACM 23(7) (Fachwissen)
77. Deque Systems: axe-core, Open-Source-Prüfwerkzeug für Barrierefreiheit – https://github.com/dequelabs/axe-core (Werkzeug)
78. Deutsche Bundesbank: Basiszinssatz 1,27 % (01.01.–30.06.2026) und 1,52 % ab 01.07.2026, verifiziert in /home/user/anwaltapex/docs/WETTBEWERB-RECHERCHE.md, Abschnitt 4.5 – https://www.bundesbank.de/de/presse/pressemitteilungen/bekanntgabe-des-basiszinssatzes-zum-1-juli-2026-anpassung-auf-1-52--941386 (2026)
79. drebis: Pressemitteilung von 2012 (über 8.000 angeschlossene Kanzleien; alte Herstellerangabe), nur über Such-Auszug der Recherche-Linse Arbeitsalltag (2012; nicht verifiziert)
80. Van Westendorp, P. (1976): „NSS Price Sensitivity Meter – A new approach to study consumer perception of prices“, ESOMAR-Kongress (Fachwissen)

*Hinweis: Alle Webquellen stammen aus Such-Auszügen; Direktabrufe waren in der Arbeitsumgebung überwiegend gesperrt, das Suchbudget war bei der Endprüfung erschöpft. Vor externer Verwendung am Original prüfen. Quellen [67]–[80] sind in der Endfassung neu; [35] wird im Text nicht mehr verwendet.*

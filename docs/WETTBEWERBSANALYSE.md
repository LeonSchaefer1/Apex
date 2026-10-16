# AnwaltApex – Wettbewerbsanalyse & Antwort auf die Kundenkritik

Grundlagen:

- vier Review-Analysen (Google, App Store, trusted.de, OMR, Capterra) zu RA-MICRO und ACTAPORT, siehe Anhänge des Briefings
- Recherche zu RA-MICRO, ACTAPORT, Advoware (Septeo) und ReNoStar, siehe [WETTBEWERB-RECHERCHE.md](WETTBEWERB-RECHERCHE.md) mit Quellen und Unsicherheiten

## 1. Was Kanzleien heute stört – und wie AnwaltApex antwortet

| # | Kritik aus den Bewertungen | Betroffen | Antwort in AnwaltApex | Wo im Prototyp |
|---|---|---|---|---|
| 1 | Updates ungetestet, Regressionen, „Verschlimmbesserungen“ | RA-MICRO | Geprüfte Updates: Staging-Kanal, automatische Regressionstests, Updates vom Kunden selbst terminierbar, Rollback | Hilfe & Support → „Geprüfte Updates“ |
| 2 | Wiederkehrende Fehler, Kunde als „Dauertester“ (7 von 7 kritischen Rezensionen) | ACTAPORT | Deterministischer, getesteter Rechenkern (Fristen, RVG, Zinsen) mit Unit-Tests; KI immer mit Offline-Fallback | `src/core`, `npm test` |
| 3 | beA/E-Mail unzuverlässig, kryptische Fehler, „liegt an externer Schnittstelle“ | ACTAPORT, RA-MICRO | Systemstatus sichtbar in jeder Ansicht, automatische Wiederverbindung, Verbindungsstatus im Posteingang | Kopfleiste „Alle Dienste verbunden“, Hilfe → Systemstatus, Posteingang |
| 4 | Haftungsrisiko: Vorschau ≠ gespeicherter Schriftsatz, falscher Inhalt ins beA | RA-MICRO | Versand nur der gespeicherten Version (Hash im Protokoll), eEB erst nach notierter Frist | Posteingang (eEB-Sperre), Masterprompt § 2 |
| 5 | Akteninhalte verschwinden, „verschluckte“ Verfügungen | RA-MICRO | Jede Nachricht wird per Gerichtsaktenzeichen bzw. Aktenzeichen bzw. Partei zugeordnet und in der E-Akte abgelegt, Aktivitätsprotokoll | Posteingang → KI-Analyse, Akte → Verlauf |
| 6 | Hotline 45–60 Min., Ticket-Sackgassen, schlecht geschulter Support | RA-MICRO | Fester persönlicher Ansprechpartner, Rückruf per Klick, Apex Assistent mit Eskalation an einen Menschen | Hilfe & Support, Apex Assistent |
| 7 | Freundlicher, aber machtloser Support | ACTAPORT | Ansprechpartner mit Verantwortung je Kanzlei, transparenter Status | Hilfe & Support |
| 8 | Sicherheitsrisiken: UAC aus, Admin-Rechte, Makros | RA-MICRO | Browser- bzw. Desktop-Client ohne Admin-Rechte, serverseitige Rechte, keine Makros | Einstellungen → Datenschutz & Sicherheit |
| 9 | E-Akte umständlich: kein Umbenennen, keine Stapelaktionen | RA-MICRO | Doppelklick-Umbenennen, Mehrfachauswahl, Drag & Drop in Ordner, Volltextsuche in der Akte | Akte → Dokumente |
| 10 | Aktenkontext geht nach E-Mail-Versand verloren | ACTAPORT | Versand aus der Akte, man bleibt in der Akte | Akte → „E-Mail schreiben“ |
| 11 | Suche in großen Akten unbrauchbar/langsam | ACTAPORT, RA-MICRO | Globale Volltextsuche (⌘K) über Akten, OCR-Text, Fristen, Posteingang und Rechtsprechung mit Zeitmessung in ms | ⌘K / Strg+K |
| 12 | Forderungskonto unvollständig, ZV-Lücken (§ 288, § 367 BGB) | ACTAPORT | Forderungskonto mit taggenauen Zinsen, Basiszinssatz-Historie und Verrechnung nach § 367 BGB | Akte → Aktenkonto, Abrechnung → Forderungskonto |
| 13 | Rechnungen nur einzeln | ACTAPORT | Sammelabrechnung in einem Durchgang, XRechnung/ZUGFeRD | Abrechnung → Rechnungen |
| 14 | FiBu wie aus DOS-Zeiten, Korrekturen umständlich | RA-MICRO | Automatischer Bankabgleich mit Sicherheitsstufen, Storno mit Gegenbuchung | Abrechnung → Bankabgleich |
| 15 | Kalender/Wiedervorlagen synchronisieren nicht, mobile Akte unvollständig | RA-MICRO, ACTAPORT | Voll responsive App (360 px bis Desktop) mit derselben Funktionstiefe | jede Ansicht auf dem Smartphone |
| 16 | Word-Add-in mit Versionskonflikten | ACTAPORT | Schriftsätze in AnwaltApex mit Versionierung, Entwürfe direkt aus der KI | Apex KI → Schriftsatz-Assistent |
| 17 | Hohe Monatsgebühren, Preiserhöhung um ~20 %, Zusatzkosten fürs Systemhaus | beide | Lifetime-Lizenz ohne Monatsgebühren, Betrieb On-Prem oder in der Private Cloud | Einstellungen → Lizenz, 38h-Motor → Beispielrechnung |
| 18 | Lock-in aus Angst vor dem Migrationsaufwand | RA-MICRO | One-Klick-Migration mit Vorschau, Dublettenprüfung und Fristen-Kontrolle | Umzug |

## 2. Funktionsabdeckung gegenüber den Marktbegleitern

Die vollständige Matrix mit Quellen steht in [WETTBEWERB-RECHERCHE.md](WETTBEWERB-RECHERCHE.md#2-feature-matrix).

| Bereich | Marktstandard | AnwaltApex |
|---|---|---|
| Akten, E-Akte, beA, Fristen, RVG | bei allen vorhanden | vorhanden, dazu Stapelaktionen, Fristen-Rechenweg, Vier-Augen-Kontrolle, RVG 2025 und 2021 nach Auftragsdatum (§ 60 RVG) |
| Forderungskonto & ZV | RA-MICRO stark; ACTAPORT neu (Forderungsmanager) | taggenaue Zinsen, Verrechnung nach § 367 BGB, Forderungsaufstellung |
| KI | RA-MICRO (KI Widget, JURA KI Assistent), Advoware (Legal Twin, Aktenchat); ACTAPORT und ReNoStar nur über Drittanbieter | Fallanalyse mit Erfolgsaussicht, Posteingangs-KI, Schriftsatz-Assistent, **sprechender Agent, der Aufgaben in der App ausführt** |
| KI-Avatar / Sprache | bei keinem Wettbewerber als eigenes Produkt belegt (Advoware: chatbasiert; Voice nur über Drittanbieter Retell AI) | Apex Assistent mit Spracheingabe, Sprachausgabe und animiertem Avatar |
| Rechtsprechung | meist über Verlagsdatenbanken oder Drittquellen | integrierte Fall-Datenbank (Demo-Auszug; Anbindung Open Legal Data mit ~424.000 Entscheidungen und NeuRIS vorbereitet) |
| Preismodell | Abo 25–169 € je Nutzer und Monat | Lifetime-Lizenz |
| Betrieb | Cloud-only (ACTAPORT, ReNoStar Legal Cloud) oder Windows-Altlast | On-Prem (Docker) oder Private Cloud, moderner Browser-Client |

## 3. Vorsicht bei der Kommunikation

- RA-MICRO und Advoware haben bereits KI-Funktionen. Der Vorsprung von AnwaltApex liegt in der Kombination aus nachvollziehbarer Fallanalyse mit Quellen, deterministischer Fristberechnung, einem handelnden Sprach-Assistenten, Lifetime-Lizenz und moderner Bedienung, nicht in „KI an sich“.
- Den Advoware-Avatar auf stp.one konnte die Recherche nicht prüfen, die Seite war in der Arbeitsumgebung gesperrt. Bitte vor externen Aussagen im Browser kontrollieren.
- Öffentliche Werbung vergleicht mit „klassischer Kanzleisoftware“ und nennt keine Namen. Vergleichende Werbung nach § 6 UWG ist nur mit nachprüfbaren, sachlichen Angaben zulässig.
- Die „Ø 38 Std. pro Woche“ sind ein Werbeversprechen. Im Prototyp stammen die Werte aus Demodaten. Für Kundenaussagen braucht es Messungen aus Pilotkanzleien.

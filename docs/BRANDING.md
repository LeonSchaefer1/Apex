# AnwaltApex – Marke & Gestaltung

## Positionierung

**AnwaltApex ist die Kanzlei-Software, die mitdenkt.** Ein Werkzeug, volle Kontrolle: Akten, beA, Fristen, Abrechnung und eine KI, die Präzedenzfälle in Sekunden findet. Sie wird einmal gekauft und ist dann für immer nutzbar.

- **Name:** *Apex* bedeutet Gipfel oder Spitze. Gemeint ist das Beste für Anwältinnen und Anwälte, ohne Superlativ-Geschrei.
- **Leitsatz:** „Ein Werkzeug. Volle Kontrolle.“
- **Zweitsatz:** „Die Kanzlei-Software, die mitdenkt.“
- **Haltung:** präzise, ruhig, verlässlich, modern. Die Marke wirkt wie ein gutes Schreibgerät: hochwertig, unaufdringlich, für Jahrzehnte gebaut.

## Bildmarke

![Bildmarke](../brand/logo-mark.svg)

Die Bildmarke liest sich auf drei Arten:

1. Als **Spitze einer Füllfeder**. Sie steht für das Unterschreiben, für Schriftsätze und das Handwerk des Rechts. Schlitz und Luftloch machen die Feder erkennbar.
2. Als **„A“** wie AnwaltApex. Die Beine des A sind die Schultern der Feder.
3. Als **Gipfel** im Sinne von Apex.

Dateien:

- `brand/logo-mark.svg` – Farbe, Verlauf in Königsblau
- `brand/logo-mark-mono.svg` – einfarbig, nutzt `currentColor`
- `brand/app-icon.svg` – App-Icon im iOS-Squircle mit Glasrand

Die Wortmarke lautet **Anwalt**Apex, gesetzt in Geist Semibold mit eng laufender Laufweite (−0,03 em). „Apex“ steht in Tinte.

## Farben

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| Tinte (Königsblau) | `#2440D8` | `#5C7BFF` | Marke, Primäraktionen, Auswahl |
| Robe | `#0B1020` | `#F1F3FA` | Text |
| Grund | `#EDF0F7` | `#05070D` | Arbeitsfläche |
| Fläche | `#FFFFFF` | `#0E1220` | Inhaltskarten |
| Siegellack | `#D4283A` | `#FF5A68` | Notfristen, Kritisches, Löschen |
| Bernstein | `#B86B00` | `#FFB547` | bald fällig, Hinweise |
| Grün | `#0F7F55` | `#3ED79A` | erledigt, verbunden, bezahlt |
| KI-Schimmer | `#3D5CFF → #8B5CF6 → #EC5FA8 → #FF9D3D` | gleich | **nur** für KI-Funktionen |

Die Herleitung kommt aus der Kanzleiwelt. Pelikan-Königsblau ist die Tinte der Unterschrift. Die Robe steht für Ernst. Der Siegellack ist das Rot, das „Achtung, Frist!“ bedeutet.

## Typografie

- **Geist** (variabel) für die gesamte Oberfläche. Große Titel sind fett mit −0,035 em Laufweite, analog zum iOS „Large Title“.
- **Geist Mono** für Aktenzeichen, Beträge und Rechnungsnummern.
- Beide Schriften liegen im Projekt (`src/assets/fonts`). Es gibt keine externen Font-Requests, das ist DSGVO-konform.

## Liquid-Glass-Prinzipien

1. **Glas für Steuerung, ruhige Flächen für Inhalt.** Navigation, Tab-Leiste, Dialoge und Popover schweben als Glas über einem farbig belichteten Grund. Texte und Tabellen stehen auf fast opaken Karten.
2. **Licht und Tiefe.** Jede Glasfläche hat eine Lichtkante (heller Rand oben, dunklerer unten) und Weichzeichnung mit Sättigung. Ein Lichtreflex folgt dem Mauszeiger. In Chromium bricht die mobile Tab-Leiste das Licht zusätzlich (SVG-Displacement).
3. **Konzentrische Radien.** Außen 28 px (Panels), Karten 22 px, innere Elemente 14–16 px, Kapseln voll gerundet.
4. **Bewegung mit Bedeutung.**
   - Federnde Übergänge (Spring).
   - Gleitende Auswahl-Indikatoren.
   - Die „Apex Island“ zeigt als Kapsel, was der 38h-Motor gerade erledigt.
   - Toasts wachsen aus einer Kapsel heraus.
   - `prefers-reduced-motion` wird respektiert.
5. **Zustand in Form.** Fristen haben farbige Streifen und Chips. KI-Ergebnisse tragen den irisierenden KI-Rand. Ein grüner Puls bedeutet „verbunden“.

## Der Apex Assistent (KI-Avatar)

Der Avatar ist eine lebendige, irisierende Glaskugel. Ihr Verhalten zeigt den Zustand:

| Zustand | Verhalten der Kugel |
|---|---|
| Ruhe | ruhiges Atmen |
| Zuhören | wellig, verformt sich |
| Nachdenken | kreist schnell |
| Sprechen | pulsiert im Sprechrhythmus |

Der Assistent heißt in der Oberfläche schlicht „Apex Assistent“. Er spricht und versteht Deutsch, siezt und antwortet knapp.

## Sprache (Tone of Voice)

- Deutsch, klar, aktiv. Buttons sagen, was passiert: „Frist übernehmen“, „eEB abgeben“, „Rechnung erstellen“.
- Fachbegriffe korrekt (beA, eEB, Notfrist, Vorfrist, Gegenstandswert, Fremdgeld), ohne Marketing-Floskeln.
- Fehler erklären die Ursache und den nächsten Schritt.
- Jede Funktion bekommt einen Satz, der sie erklärt.

## Nicht tun

- Den KI-Schimmer für Nicht-KI-Elemente verwenden.
- Wettbewerber in öffentlicher Werbung namentlich herabsetzen. Vergleiche laufen gegen „klassische Kanzleisoftware“.
- Kundenstimmen erfinden.
- Externe Schriften, Tracking oder CDN-Ressourcen in der App einsetzen.

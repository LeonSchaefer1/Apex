import { CircleHelp, Columns3, Keyboard, Monitor, Moon, PanelLeft, Rows3, Rows4, Sparkles, Sun, Type } from "lucide-react";
import { SCHRIFTGROESSEN, useUI, type Dichte, type Schriftgroesse, type ThemeWahl } from "@/store/ui";
import { useMedia } from "@/lib/useMedia";
import { Chip, Segmented, Switch } from "@/components/ui";
import { tabellenDichteZuruecksetzen } from "@/components/ui/DataTable";
import { Abschnitt, Zeile } from "./teile";

export function DarstellungTab() {
  const { theme, setTheme, dichte, setDichte, sidebarKompakt, toggleSidebar, schrift, setSchrift, liveMeldungen, setLiveMeldungen, island, setIsland, kugel, setKugel, setKuerzel, einzeltastenKuerzel, setEinzeltastenKuerzel } = useUI();
  const reduziert = useMedia("(prefers-reduced-motion: reduce)");
  const dunkelSystem = useMedia("(prefers-color-scheme: dark)");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <Abschnitt titel="Darstellung" text="So sieht Apex auf diesem Gerät aus. Die Einstellungen gelten nur für diesen Browser." icon={<Monitor className="size-[18px]" />}>
        <div className="divide-y divide-[var(--line)]">
          <Zeile titel="Erscheinungsbild" text={theme === "system" ? `Folgt Ihrem System – derzeit ${dunkelSystem ? "dunkel" : "hell"}.` : theme === "light" ? "Immer hell." : "Immer dunkel – angenehm am Abend."}>
            <Segmented<ThemeWahl>
              value={theme}
              onChange={setTheme}
              options={[
                { value: "system", label: "System", icon: <Monitor className="size-3.5" /> },
                { value: "light", label: "Hell", icon: <Sun className="size-3.5" /> },
                { value: "dark", label: "Dunkel", icon: <Moon className="size-3.5" /> },
              ]}
            />
          </Zeile>
          <Zeile
            titel="Schriftgröße"
            text={schrift === 100 ? "Standardgröße. Größer stellen Sie alles – Text, Schaltflächen und Abstände – gleichmäßig um 12 % oder 25 % größer." : `Alles wird ${schrift === 112 ? "um 12 %" : "um 25 %"} größer dargestellt – gilt sofort und nur auf diesem Gerät.`}
          >
            <Segmented<string>
              value={String(schrift)}
              onChange={(v) => setSchrift(Number(v) as Schriftgroesse)}
              options={SCHRIFTGROESSEN.map((g) => ({ value: String(g), label: `${g} %`, icon: g === 100 ? <Type className="size-3.5" /> : undefined }))}
            />
          </Zeile>
          <Zeile titel="Dichte" text={dichte === "compact" ? "Kompakt: engere Tabellenzeilen und kleinere Grundschrift – mehr Zeilen auf einen Blick, ideal für große Aktenlisten." : "Großzügig: mehr Luft, ruhiger zu lesen. Gilt für alle Tabellen, sofern Sie dort nichts anderes gewählt haben."}>
            <Segmented<Dichte>
              value={dichte}
              onChange={(d) => {
                tabellenDichteZuruecksetzen();
                setDichte(d);
              }}
              options={[
                { value: "comfortable", label: "Großzügig", icon: <Rows3 className="size-3.5" /> },
                { value: "compact", label: "Kompakt", icon: <Rows4 className="size-3.5" /> },
              ]}
            />
          </Zeile>
          <Zeile titel="Seitenleiste kompakt" htmlFor="sb-kompakt" text="Zeigt nur Symbole – mehr Platz für Akten und Dokumente. Wirkt auf Bildschirmen ab Tablet-Breite.">
            <Switch id="sb-kompakt" checked={sidebarKompakt} onChange={() => toggleSidebar()} label="Seitenleiste kompakt" />
          </Zeile>
          <Zeile
            titel="Apex Island (Live-Meldungen) anzeigen"
            htmlFor="island"
            text={
              !island
                ? "Ausgeblendet. Die schwarze Kapsel in der Kopfleiste zeigt sonst, was der 38h-Motor erledigt hat (Beispielwerte)."
                : reduziert
                  ? "Die Apex Island zeigt wegen „Bewegung reduzieren“ nur die ruhige Wochenbilanz. Ausblenden geht auch direkt am × der Island."
                  : "Die schwarze Kapsel in der Kopfleiste zeigt die Wochenbilanz des 38h-Motors (Beispielwerte). Ausblenden geht auch direkt am × der Island."
            }
          >
            <Switch id="island" checked={island} onChange={setIsland} label="Apex Island (Live-Meldungen) anzeigen" />
          </Zeile>
          {island && (
            <Zeile
              titel="Live-Meldungen kurz einblenden"
              htmlFor="live-meldungen"
              text={
                liveMeldungen
                  ? reduziert
                    ? "Eingeschaltet – wegen „Bewegung reduzieren“ zeigt die Apex Island trotzdem nur die ruhige Wochenbilanz."
                    : "Die Apex Island zeigt höchstens alle 90 Sekunden kurz, was der 38h-Motor gerade erledigt hat (Beispielwerte)."
                  : "Aus: Die Apex Island zeigt nur die ruhige Wochenbilanz – ohne Wechsel und ohne Bewegung."
              }
            >
              <Switch id="live-meldungen" checked={liveMeldungen} onChange={setLiveMeldungen} label="Live-Meldungen kurz einblenden" />
            </Zeile>
          )}
          <Zeile
            titel="Assistent-Kugel anzeigen"
            htmlFor="kugel"
            text={kugel ? "Die Kugel unten rechts öffnet den Apex Assistenten. Liegt darunter Text oder ein Bedienelement, weicht sie automatisch an den Rand aus; einklappen lässt sie sich auch von Hand." : "Ausgeblendet. Den Assistenten erreichen Sie weiter über Strg+K (Mac: ⌘ K) → „Apex Assistent“."}
          >
            <Switch id="kugel" checked={kugel} onChange={setKugel} label="Assistent-Kugel anzeigen" />
          </Zeile>
          <Zeile
            titel="Kürzel mit einzelnen Buchstaben (W, F, Z, ?, Posteingang J/K/U/E)"
            htmlFor="einzeltasten"
            text={
              einzeltastenKuerzel
                ? "An: Ein Buchstabe außerhalb von Eingabefeldern löst das Kürzel aus. Wer oft neben ein Feld tippt, schaltet das hier aus – Alt+W, Alt+F und Alt+Z wirken immer."
                : "Aus: Einzelne Buchstaben lösen nichts aus. Weiter verfügbar: Alt+W (Wiedervorlage), Alt+F (Fristenrechner), Alt+Z (Zeit erfassen) und Strg+K."
            }
          >
            <Switch id="einzeltasten" checked={einzeltastenKuerzel} onChange={setEinzeltastenKuerzel} label="Kürzel mit einzelnen Buchstaben" />
          </Zeile>
          <Zeile
            titel="Bewegung"
            text={
              reduziert
                ? "Ihr System wünscht reduzierte Bewegung – Apex blendet nur noch sanft über."
                : "Animationen sind aktiv. Für weniger Bewegung aktivieren Sie „Bewegung reduzieren“ in den Bedienungshilfen Ihres Systems (macOS, iOS) bzw. schalten unter Windows die Animationseffekte aus."
            }
          >
            <Chip tone={reduziert ? "ink" : "green"} icon={<Sparkles className="size-3" />}>
              {reduziert ? "Reduziert" : "Standard"}
            </Chip>
          </Zeile>
        </div>
      </Abschnitt>

      <Abschnitt titel="Gut zu wissen" icon={<PanelLeft className="size-[18px]" />}>
        <ul className="grid grid-cols-1 gap-3 text-[13px] text-fg-2">
          <li className="flex gap-3">
            <span className="kbd shrink-0">Strg+K</span>
            <span>Globale Suche über Akten, Dokumente, Fristen, Einstellungen und Rechtsprechung (Mac: ⌘K).</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center text-ink">
              <CircleHelp className="size-4" />
            </span>
            <span>Das Fragezeichen neben jedem Seitentitel öffnet die animierte Schnellhilfe zu genau dieser Ansicht.</span>
          </li>
          <li className="flex gap-3">
            <span className="kbd shrink-0">Esc</span>
            <span>Schließt Dialoge und Seitenpanels.</span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center text-ink">
              <Keyboard className="size-4" />
            </span>
            <span>
              Taste <span className="kbd">W</span> legt eine Wiedervorlage an, <span className="kbd">F</span> öffnet den Fristenrechner, <span className="kbd">Z</span> erfasst eine Zeit (immer auch mit Alt).{" "}
              <button type="button" className="font-semibold text-ink underline-offset-2 hover:underline" onClick={() => setKuerzel(true)}>
                Alle Tastaturkürzel (?)
              </button>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="grid size-5 shrink-0 place-items-center text-ink">
              <Columns3 className="size-4" />
            </span>
            <span>Tabellen merken sich Spaltenbreite, Sortierung und sichtbare Spalten pro Ansicht. Der Zeilen-Schalter in einer Tabelle weicht nur dort von der Dichte oben ab.</span>
          </li>
        </ul>
      </Abschnitt>
    </div>
  );
}

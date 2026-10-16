import { CircleHelp, Columns3, Monitor, Moon, PanelLeft, Rows3, Rows4, Sparkles, Sun } from "lucide-react";
import { useUI, type Dichte, type ThemeWahl } from "@/store/ui";
import { useMedia } from "@/lib/useMedia";
import { Chip, Segmented, Switch } from "@/components/ui";
import { tabellenDichteZuruecksetzen } from "@/components/ui/DataTable";
import { Abschnitt, Zeile } from "./teile";

export function DarstellungTab() {
  const { theme, setTheme, dichte, setDichte, sidebarKompakt, toggleSidebar } = useUI();
  const reduziert = useMedia("(prefers-reduced-motion: reduce)");
  const dunkelSystem = useMedia("(prefers-color-scheme: dark)");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <Abschnitt titel="Darstellung" text="So sieht AnwaltApex auf diesem Gerät aus. Die Einstellungen gelten nur für diesen Browser." icon={<Monitor className="size-[18px]" />}>
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
            titel="Bewegung"
            text={
              reduziert
                ? "Ihr System wünscht reduzierte Bewegung – AnwaltApex blendet nur noch sanft über."
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
            <span className="kbd shrink-0">⌘K</span>
            <span>Globale Suche über Akten, Dokumente, Fristen und Rechtsprechung – unter Windows mit Strg+K.</span>
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
              <Columns3 className="size-4" />
            </span>
            <span>Tabellen merken sich Spaltenbreite, Sortierung und sichtbare Spalten pro Ansicht. Der Zeilen-Schalter in einer Tabelle weicht nur dort von der Dichte oben ab.</span>
          </li>
        </ul>
      </Abschnitt>
    </div>
  );
}

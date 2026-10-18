import { CircleHelp, Keyboard, Sparkles } from "lucide-react";
import { useUI } from "@/store/ui";
import { artikel } from "@/content/wiki";
import { Drawer, Button, Segmented } from "@/components/ui";
import { WikiPlayer } from "@/components/wiki/WikiPlayer";
import { KuerzelListe } from "./Tastenkuerzel";
import { useKanzlei } from "@/store/session";

type Reiter = "hilfe" | "kuerzel";

/** Schnellhilfe: das animierte Wiki direkt dort, wo man gerade arbeitet – mit Reiter „Tastaturkürzel“ (Taste „?“). */
export function QuickHelp() {
  const { hilfeThema, zeigeHilfe, oeffneAssistent, kuerzelOffen, setKuerzel } = useUI();
  const { tenant } = useKanzlei();
  const a = artikel(hilfeThema, tenant.ansprechpartner);
  const reiter: Reiter = kuerzelOffen || !a ? "kuerzel" : "hilfe";
  const offen = !!a || kuerzelOffen;
  const schliessen = () => {
    zeigeHilfe(null);
    setKuerzel(false);
  };
  return (
    <Drawer
      open={offen}
      onClose={schliessen}
      title={reiter === "kuerzel" ? "Tastaturkürzel" : a ? `Schnellhilfe: ${a.titel}` : ""}
      subtitle={reiter === "kuerzel" ? "Schneller arbeiten ohne Maus – gilt überall außerhalb von Eingabefeldern." : a?.kurz}
      icon={reiter === "kuerzel" ? <Keyboard className="size-5" /> : <CircleHelp className="size-5" />}
      width={480}
      footer={
        reiter === "hilfe" && a ? (
          <Button
            variant="ai"
            icon={<Sparkles className="size-4" />}
            onClick={() => {
              schliessen();
              oeffneAssistent(`Erkläre mir bitte „${a.titel}“ in Apex.`);
            }}
          >
            Assistent fragen
          </Button>
        ) : undefined
      }
    >
      {a && (
        <Segmented<Reiter>
          size="sm"
          value={reiter}
          onChange={(r) => setKuerzel(r === "kuerzel")}
          options={[
            { value: "hilfe", label: "Schnellhilfe", icon: <CircleHelp className="size-3.5" /> },
            { value: "kuerzel", label: "Tastaturkürzel", icon: <Keyboard className="size-3.5" /> },
          ]}
          className="mb-4"
        />
      )}
      {reiter === "kuerzel" ? <KuerzelListe /> : a && <WikiPlayer artikel={a} kompakt onNavigate={schliessen} />}
    </Drawer>
  );
}

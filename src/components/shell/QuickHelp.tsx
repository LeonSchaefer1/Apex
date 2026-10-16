import { CircleHelp, Sparkles } from "lucide-react";
import { useUI } from "@/store/ui";
import { artikel } from "@/content/wiki";
import { Drawer, Button } from "@/components/ui";
import { WikiPlayer } from "@/components/wiki/WikiPlayer";

/** Schnellhilfe: das animierte Wiki direkt dort, wo man gerade arbeitet. */
export function QuickHelp() {
  const { hilfeThema, zeigeHilfe, oeffneAssistent } = useUI();
  const a = artikel(hilfeThema);
  return (
    <Drawer
      open={!!a}
      onClose={() => zeigeHilfe(null)}
      title={a ? `Schnellhilfe: ${a.titel}` : ""}
      subtitle={a?.kurz}
      icon={<CircleHelp className="size-5" />}
      width={480}
      footer={
        <Button
          variant="ai"
          icon={<Sparkles className="size-4" />}
          onClick={() => {
            zeigeHilfe(null);
            oeffneAssistent(a ? `Erkläre mir bitte „${a.titel}“ in AnwaltApex.` : undefined);
          }}
        >
          Assistent fragen
        </Button>
      }
    >
      {a && <WikiPlayer artikel={a} kompakt onNavigate={() => zeigeHilfe(null)} />}
    </Drawer>
  );
}

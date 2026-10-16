// „Neuer Kontakt“ – Person oder Organisation mit Rollen anlegen, inkl. Dubletten-Hinweis.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, UserPlus } from "lucide-react";
import type { KontaktRolle } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { toast } from "@/store/ui";
import { Button, Field, Modal, Textarea } from "@/components/ui";
import { KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, entwurfZuKontakt, leererEntwurf, type KontaktEntwurf } from "./KontaktFormular";
import { RollenWahl } from "./KontaktDrawer";
import { findeKontaktNachName } from "./kontaktHelfer";

export function NeuerKontakt({ open, onClose, rolle, onAngelegt }: { open: boolean; onClose: () => void; rolle: KontaktRolle; onAngelegt: (id: string) => void }) {
  const kontakte = useCol("kontakte");
  const [entwurf, setEntwurf] = useState<KontaktEntwurf>(leererEntwurf());
  const [rollen, setRollen] = useState<KontaktRolle[]>([rolle]);
  const [notiz, setNotiz] = useState("");

  useEffect(() => {
    if (!open) return;
    const org = rolle === "gericht" || rolle === "versicherung" || rolle === "behoerde";
    setEntwurf(leererEntwurf(org ? "organisation" : "person"));
    setRollen([rolle]);
    setNotiz("");
  }, [open, rolle]);

  const name = entwurfName(entwurf);
  const dublette = name ? findeKontaktNachName(kontakte, name) : undefined;
  const gueltig = entwurfGueltig(entwurf) && !emailUngueltig(entwurf.email) && rollen.length > 0;

  const anlegen = () => {
    const k = entwurfZuKontakt(entwurf, rollen);
    if (notiz.trim()) k.notiz = notiz.trim();
    useData.getState().upsert("kontakte", k);
    toast("Kontakt angelegt", { ton: "erfolg", text: k.name });
    onClose();
    onAngelegt(k.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<UserPlus className="size-[18px]" />}
      title="Neuer Kontakt"
      subtitle="Person oder Organisation anlegen – Rollen bestimmen, wo der Kontakt in Akten auswählbar ist."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!gueltig} onClick={anlegen} icon={<UserPlus className="size-4" />}>
            Kontakt anlegen
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <KontaktFelder idPrefix="nk" value={entwurf} onChange={setEntwurf} />
        <AnimatePresence initial={false}>
          {dublette && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-start gap-2.5 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[12.5px] text-fg-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                <span>
                  Es gibt bereits einen Kontakt „{dublette.name}“{dublette.ort ? ` aus ${dublette.ort}` : ""}. Prüfen Sie, ob es sich um dieselbe Person handelt, bevor Sie eine Dublette anlegen.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div>
          <div className="label">Rollen</div>
          <RollenWahl value={rollen} onChange={setRollen} />
          {rollen.length === 0 && <p className="mt-1.5 text-[12px] text-seal">Bitte mindestens eine Rolle wählen.</p>}
        </div>
        <Field label="Notiz" htmlFor="nk-notiz">
          <Textarea id="nk-notiz" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}

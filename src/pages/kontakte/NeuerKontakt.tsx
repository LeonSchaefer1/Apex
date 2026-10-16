// „Neuer Kontakt“ – Person oder Organisation mit Rollen anlegen, inkl. Dubletten-Hinweis.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, UserPlus } from "lucide-react";
import type { KontaktRolle } from "@/core/types";
import { useCol, useData } from "@/store/data";
import { toast } from "@/store/ui";
import { Button, Field, Modal, Textarea, confirmDialog } from "@/components/ui";
import { KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, entwurfZuKontakt, leererEntwurf, type KontaktEntwurf } from "./KontaktFormular";
import { RollenWahl, VersicherungsFelder, versicherungBereinigt, type VersicherungsAngaben } from "./KontaktDrawer";
import { DUBLETTE_GRUND, findeDublette } from "./kontaktHelfer";

/** Rollen, die mit „Mandant“ nur nach Rückfrage zusammen vergeben werden (Versicherung, Gericht, Behörde). */
const UNGEWOEHNLICH_MIT_MANDANT: KontaktRolle[] = ["versicherung", "gericht", "behoerde"];
const ROLLE_NAME: Partial<Record<KontaktRolle, string>> = { versicherung: "Versicherung", gericht: "Gericht", behoerde: "Behörde" };

/**
 * `rolle`: Rolle aus dem aktiven Filter (z. B. „Versicherungen“) – nur dann vorgewählt. Ohne Filter keine Vorbelegung:
 * Die Rolle ist Pflicht und wird bewusst gewählt (keine stille Rolle „Mandant“).
 */
export function NeuerKontakt({ open, onClose, rolle, onAngelegt }: { open: boolean; onClose: () => void; rolle?: KontaktRolle; onAngelegt: (id: string) => void }) {
  const kontakte = useCol("kontakte");
  const [entwurf, setEntwurf] = useState<KontaktEntwurf>(leererEntwurf());
  const [rollen, setRollen] = useState<KontaktRolle[]>(rolle ? [rolle] : []);
  const [notiz, setNotiz] = useState("");
  const [versicherung, setVersicherung] = useState<VersicherungsAngaben>({});

  useEffect(() => {
    if (!open) return;
    const org = rolle === "gericht" || rolle === "versicherung" || rolle === "behoerde";
    setEntwurf(leererEntwurf(org ? "organisation" : "person"));
    setRollen(rolle ? [rolle] : []);
    setNotiz("");
    setVersicherung({});
  }, [open, rolle]);

  const name = entwurfName(entwurf);
  const dublette = name || entwurf.email || entwurf.telefon ? findeDublette(kontakte, { name, email: entwurf.email, telefon: entwurf.telefon }) : undefined;
  const gueltig = entwurfGueltig(entwurf) && !emailUngueltig(entwurf.email) && rollen.length > 0;

  const bestehendenOeffnen = (id: string) => {
    onClose();
    onAngelegt(id);
  };

  const anlegen = async () => {
    // Mandant und Versicherung/Gericht/Behörde zugleich ist selten gewollt – sonst erscheint z. B. eine Versicherung in der Mandantenauswahl
    const zusatz = rollen.includes("mandant") ? rollen.filter((r) => UNGEWOEHNLICH_MIT_MANDANT.includes(r)) : [];
    if (zusatz.length) {
      const was = zusatz.map((r) => ROLLE_NAME[r]).join(" und ");
      const ok = await confirmDialog({
        titel: `Mandant und ${was} zugleich?`,
        text: `„${name || "Der Kontakt"}“ erhält die Rollen Mandant und ${was} und erscheint damit auch in der Mandantenauswahl der Mandatsaufnahme. Ist das so gewollt?`,
        bestaetigen: "Ja, beide Rollen",
        abbrechen: "Rollen prüfen",
      });
      if (!ok) return;
    }
    const k = entwurfZuKontakt(entwurf, rollen);
    if (notiz.trim()) k.notiz = notiz.trim();
    if (rollen.includes("versicherung")) {
      const v = versicherungBereinigt(versicherung);
      if (v) k.versicherung = v;
    }
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
          <Button variant="primary" disabled={!gueltig} onClick={() => void anlegen()} icon={<UserPlus className="size-4" />}>
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
              <div className="flex flex-wrap items-start gap-2.5 rounded-[14px] bg-amber-soft px-3.5 py-2.5 text-[13px] text-fg-2" role="status">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                <span className="min-w-[200px] flex-1">
                  <span className="font-semibold text-fg">Kontakt besteht bereits: </span>„{dublette.kontakt.name}“{dublette.kontakt.ort ? ` aus ${dublette.kontakt.ort}` : ""} ({DUBLETTE_GRUND[dublette.grund]}). Ist das{" "}
                  {dublette.kontakt.typ === "organisation" ? "dieselbe Firma" : "dieselbe Person"}? Dann bitte den bestehenden Kontakt verwenden statt eine Dublette anzulegen.
                </span>
                <Button size="sm" variant="secondary" iconRight={<ArrowRight className="size-4" />} onClick={() => bestehendenOeffnen(dublette.kontakt.id)}>
                  Bestehenden Kontakt öffnen
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div>
          <div className="label" id="nk-rollen-label">
            Rollen <span className="text-fg-3">(Pflicht)</span>
          </div>
          <RollenWahl value={rollen} onChange={setRollen} />
          {rollen.length === 0 && <p className="mt-1.5 text-[12.5px] text-fg-3">Bitte mindestens eine Rolle wählen – sie bestimmt, wo der Kontakt in Akten auswählbar ist.</p>}
        </div>
        {rollen.includes("versicherung") && <VersicherungsFelder idPrefix="nk" value={versicherung} onChange={setVersicherung} />}
        <Field label="Notiz" htmlFor="nk-notiz">
          <Textarea id="nk-notiz" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}

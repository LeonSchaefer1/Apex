// „Neuer Kontakt“ – Person oder Organisation mit Rollen anlegen, inkl. Dubletten-Hinweis.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, UserCheck, UserPlus } from "lucide-react";
import type { KontaktRolle } from "@/core/types";
import { GLEICH_GRUND, gleicheKontakte } from "@/core/kontaktpruefung";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Field, Modal, Textarea, confirmDialog } from "@/components/ui";
import { KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, entwurfZuKontakt, leererEntwurf, type KontaktEntwurf } from "./KontaktFormular";
import { RollenWahl, VersicherungsFelder, versicherungBereinigt, type VersicherungsAngaben } from "./KontaktDrawer";
import { aktenVonKontakt } from "./kontaktHelfer";

/** Mindestlänge der Begründung für „Trotzdem neu anlegen“ (I4-T17-01). */
const BEGRUENDUNG_MIN = 10;

/** Rollen, die mit „Mandant“ nur nach Rückfrage zusammen vergeben werden (Versicherung, Gericht, Behörde). */
const UNGEWOEHNLICH_MIT_MANDANT: KontaktRolle[] = ["versicherung", "gericht", "behoerde"];
const ROLLE_NAME: Partial<Record<KontaktRolle, string>> = { versicherung: "Versicherung", gericht: "Gericht", behoerde: "Behörde" };

/**
 * `rolle`: Rolle aus dem aktiven Filter (z. B. „Versicherungen“) – nur dann vorgewählt. Ohne Filter keine Vorbelegung:
 * Die Rolle ist Pflicht und wird bewusst gewählt (keine stille Rolle „Mandant“).
 */
export function NeuerKontakt({ open, onClose, rolle, onAngelegt }: { open: boolean; onClose: () => void; rolle?: KontaktRolle; onAngelegt: (id: string) => void }) {
  const kontakte = useCol("kontakte");
  const akten = useCol("akten");
  const { user } = useKanzlei();
  // Dublette: nur mit Begründung und Bestätigung neu anlegen (§ 43a Abs. 4 BRAO – sonst sieht die Kollisionsprüfung vorbei)
  const [begruendung, setBegruendung] = useState("");
  const [geprueft, setGeprueft] = useState(false);
  const [zeigeFehler, setZeigeFehler] = useState(false);
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
    setBegruendung("");
    setGeprueft(false);
    setZeigeFehler(false);
  }, [open, rolle]);

  const name = entwurfName(entwurf);
  // Gleiche Datensätze: Name ohne Rechtsform, E-Mail, Telefon, bei Firmen auch die E-Mail-Domain (ohne Freemailer)
  const gleiche = name || entwurf.email || entwurf.telefon ? gleicheKontakte({ id: "", name, email: emailUngueltig(entwurf.email) ? undefined : entwurf.email, telefon: entwurf.telefon, typ: entwurf.typ }, kontakte) : [];
  const dublette = gleiche[0];
  const gueltig = entwurfGueltig(entwurf) && !emailUngueltig(entwurf.email) && rollen.length > 0;
  const begruendungOk = begruendung.trim().length >= BEGRUENDUNG_MIN;
  const trotzdemOk = gueltig && begruendungOk && geprueft;

  const bestehendenOeffnen = (id: string) => {
    onClose();
    onAngelegt(id);
  };

  const anlegen = async () => {
    if (dublette && !trotzdemOk) {
      setZeigeFehler(true);
      window.setTimeout(() => document.getElementById(!begruendungOk ? "nk-begruendung" : "nk-geprueft")?.focus(), 0);
      return;
    }
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
    if (dublette) {
      useData.getState().log({
        akteur: "nutzer",
        userId: user.id,
        text: `Kontakt trotz möglichem Doppel-Datensatz angelegt: „${k.name}“ – gleicher Datensatz ${gleiche.map((g) => `„${g.kontakt.name}“${g.kontakt.ort ? ` (${g.kontakt.ort})` : ""}, ${GLEICH_GRUND[g.grund]}`).join("; ")} · Begründung: ${begruendung.trim()} · durch ${user.name}`,
      });
    }
    toast("Kontakt angelegt", { ton: "erfolg", text: dublette ? `${k.name} – Begründung im Protokoll vermerkt` : k.name });
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
          <Button variant="ghost" onClick={onClose} className={dublette ? "mr-auto" : undefined}>
            Abbrechen
          </Button>
          {dublette ? (
            <>
              <Button variant="secondary" disabled={!gueltig} onClick={() => void anlegen()} icon={<UserPlus className="size-4" />} aria-describedby="nk-trotzdem-hinweis">
                Trotzdem neu anlegen
              </Button>
              <Button variant="primary" onClick={() => bestehendenOeffnen(dublette.kontakt.id)} icon={<UserCheck className="size-4" />}>
                Bestehenden Kontakt verwenden
              </Button>
            </>
          ) : (
            <Button variant="primary" disabled={!gueltig} onClick={() => void anlegen()} icon={<UserPlus className="size-4" />}>
              Kontakt anlegen
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <KontaktFelder idPrefix="nk" value={entwurf} onChange={setEntwurf} />
        <AnimatePresence initial={false}>
          {dublette && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <section className="grid gap-3 rounded-[16px] bg-amber-soft p-3.5 text-[13px] text-fg-2" aria-labelledby="nk-dublette-titel">
                <div className="flex items-start gap-2.5" role="status">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--amber-text)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h3 id="nk-dublette-titel" className="font-semibold text-fg">
                      Kontakt besteht bereits
                    </h3>
                    <ul className="mt-0.5 grid gap-0.5">
                      {gleiche.slice(0, 3).map((g) => {
                        const rollenInAkten = aktenVonKontakt(g.kontakt, akten).filter((x) => x.akte.status !== "abgeschlossen");
                        return (
                          <li key={g.kontakt.id} className="break-words">
                            „{g.kontakt.name}“{g.kontakt.ort ? ` aus ${g.kontakt.ort}` : ""} ({GLEICH_GRUND[g.grund]})
                            {rollenInAkten.length > 0 && ` – ${rollenInAkten.slice(0, 2).map((x) => `${x.rolle} in ${x.akte.aktenzeichen}`).join(", ")}`}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-1">
                      Ist das {dublette.kontakt.typ === "organisation" ? "dieselbe Firma" : "dieselbe Person"}? Dann bitte den bestehenden Kontakt verwenden – ein zweiter Datensatz unterläuft sonst Kollisionsprüfung und Aktenübersicht.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 rounded-[12px] bg-[var(--surface)] p-3 shadow-[0_0_0_1px_var(--line)]">
                  <p id="nk-trotzdem-hinweis" className="text-[12.5px] text-fg-3">
                    Nur wenn es wirklich {dublette.kontakt.typ === "organisation" ? "eine andere Firma" : "eine andere Person"} ist: Begründung (mindestens {BEGRUENDUNG_MIN} Zeichen) und Bestätigung – beides steht im Protokoll.
                  </p>
                  <Field label="Andere Firma/Person, weil … (Pflicht)" htmlFor="nk-begruendung">
                    <Textarea
                      id="nk-begruendung"
                      rows={2}
                      value={begruendung}
                      onChange={(e) => setBegruendung(e.target.value)}
                      placeholder="z. B. andere Gesellschaft mit Sitz in Hamburg, HRB 12345 – nicht die Gegnerin aus 142/26"
                      aria-invalid={zeigeFehler && !begruendungOk ? true : undefined}
                      aria-describedby={zeigeFehler && !begruendungOk ? "nk-begruendung-fehler" : undefined}
                    />
                  </Field>
                  {zeigeFehler && !begruendungOk && (
                    <p id="nk-begruendung-fehler" role="alert" className="text-[12.5px] font-medium text-seal">
                      Bitte begründen, warum es nicht derselbe Datensatz ist – mindestens {BEGRUENDUNG_MIN} Zeichen.
                    </p>
                  )}
                  <label className="flex min-h-[32px] items-start gap-2 font-medium text-fg">
                    <input id="nk-geprueft" type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={geprueft} onChange={(e) => setGeprueft(e.target.checked)} aria-invalid={zeigeFehler && !geprueft ? true : undefined} />
                    <span>Ich habe geprüft: Es ist nicht {dublette.kontakt.typ === "organisation" ? "dieselbe Firma" : "dieselbe Person"}.</span>
                  </label>
                  {zeigeFehler && begruendungOk && !geprueft && (
                    <p role="alert" className="text-[12.5px] font-medium text-seal">
                      Bitte die Prüfung bestätigen.
                    </p>
                  )}
                </div>
              </section>
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

// Mandantenportal einer Akte: Freischalten nur nach Rückfrage, Vorschau „Als Mandant ansehen“, Sperren mit Rückfrage – jeweils protokolliert.
// Sichtbar sind nur Dokumente, die einzeln im Portal bereitgestellt wurden (`Dokument.portal`) – nie Entwürfe, Eingänge oder KI-Erzeugnisse von selbst.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarDays, Eye, FileText, Globe, Lock, Mail, ShieldCheck } from "lucide-react";
import type { Akte, Dokument, Frist } from "@/core/types";
import { fmtDate, fmtDateWd, nowLocal, today } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Modal, confirmDialog } from "@/components/ui";
import { PHASEN, beruehreAkte, istEingang, useKontaktMap, useTeam } from "./helfer";

/** Warum ein Dokument nicht ins Portal darf (sonst `undefined`): interne Notizen, Rechnungen (Aktenkonto), Entwürfe vor der Freigabe. */
export function portalSperrgrund(d: Pick<Dokument, "art" | "status">): string | undefined {
  if (d.art === "notiz") return "interne Notiz – nie im Portal";
  if (d.art === "rechnung") return "Rechnungen stehen im Aktenkonto";
  if (d.status === "entwurf") return "Entwurf – erst nach Freigabe";
  return undefined;
}

/** Ist das Dokument für den Mandanten sichtbar? Nur ausdrücklich bereitgestellt und nicht gesperrt (Entwurf, Notiz, Rechnung). */
export const imPortal = (d: Dokument) => !!d.portal && !portalSperrgrund(d);

/** Dokumente, die der Mandant im Portal sieht – genau die einzeln bereitgestellten, ohne Entwürfe, Notizen und Rechnungen. */
export function portalDokumente(akteId: string, dokumente: Dokument[]): Dokument[] {
  return dokumente.filter((d) => d.akteId === akteId && imPortal(d)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Was der Mandant NICHT sieht – für die Kanzleiansicht unter der Vorschau. */
export function nichtImPortal(akteId: string, dokumente: Dokument[]): { entwuerfe: number; eingaenge: number; intern: number; weitere: number } {
  const rest = dokumente.filter((d) => d.akteId === akteId && !imPortal(d));
  const intern = rest.filter((d) => d.art === "notiz" || d.art === "rechnung");
  const entwuerfe = rest.filter((d) => d.status === "entwurf" && !intern.includes(d));
  const eingaenge = rest.filter((d) => !intern.includes(d) && !entwuerfe.includes(d) && istEingang(d));
  return { entwuerfe: entwuerfe.length, eingaenge: eingaenge.length, intern: intern.length, weitere: rest.length - intern.length - entwuerfe.length - eingaenge.length };
}

/** „Nicht sichtbar für den Mandanten: 2 Entwürfe, 3 Eingänge, …“ */
export function nichtImPortalText(n: ReturnType<typeof nichtImPortal>): string {
  const teile = [
    n.entwuerfe ? `${n.entwuerfe} ${n.entwuerfe === 1 ? "Entwurf" : "Entwürfe"}` : "",
    n.eingaenge ? `${n.eingaenge} ${n.eingaenge === 1 ? "Eingang" : "Eingänge"}` : "",
    n.intern ? `${n.intern} ${n.intern === 1 ? "internes Dokument" : "interne Dokumente"} (Notizen, Rechnungen)` : "",
    n.weitere ? `${n.weitere} weitere, nicht bereitgestellt` : "",
  ].filter(Boolean);
  return teile.length ? `Nicht sichtbar für den Mandanten: ${teile.join(", ")}.` : "Alle Dokumente der Akte sind bereitgestellt.";
}

/** Dokument im Portal bereitstellen bzw. herausnehmen – mit Verlaufseintrag. Gibt false zurück, wenn es gesperrt ist. */
export function setzePortal(d: Dokument, akte: Akte, userId: string, bereitstellen: boolean, wie?: string): boolean {
  if (bereitstellen && portalSperrgrund(d)) return false;
  const st = useData.getState();
  st.patch("dokumente", d.id, { portal: bereitstellen ? { am: nowLocal(), vonId: userId } : undefined });
  st.log({
    akteur: "nutzer",
    userId,
    akteId: akte.id,
    text: bereitstellen
      ? `„${d.name}“ (Version ${d.version}) im Mandantenportal bereitgestellt${wie ? ` (${wie})` : ""} – ${akte.aktenzeichen}`
      : `„${d.name}“ aus dem Mandantenportal genommen – ${akte.aktenzeichen}`,
  });
  beruehreAkte(akte.id);
  return true;
}

/** Termine, die der Mandant sieht – keine Fristen, Vorfristen oder Wiedervorlagen (Fristinterna). */
export function portalTermine(akteId: string, fristen: Frist[]): Frist[] {
  return fristen.filter((f) => f.akteId === akteId && f.typ === "termin" && f.status === "offen" && f.datum >= today()).sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Freischalten (mit Rückfrage), Sperren und Vorschau des Mandantenportals. */
export function useMandantenportal(akte: Akte) {
  const { user } = useKanzlei();
  const kontakte = useKontaktMap();
  const mandant = kontakte.get(akte.mandantId);
  const [frage, setFrage] = useState(false);
  const [vorschau, setVorschau] = useState(false);

  const sperren = async () => {
    const ok = await confirmDialog({
      titel: "Mandantenportal sperren?",
      text: `${mandant?.name ?? "Der Mandant"} verliert den Zugang sofort – sperren? Die bereitgestellten Dokumente bleiben markiert und sind nach erneutem Freischalten wieder sichtbar. Der Vorgang steht im Verlauf.`,
      bestaetigen: "Sperren",
      gefahr: true,
    });
    if (!ok) return;
    useData.getState().patch("akten", akte.id, { mandantenportal: false, updatedAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Mandantenportal gesperrt – ${mandant?.name ?? "Mandant"} hat keinen Zugriff mehr – ${akte.aktenzeichen}` });
    toast("Mandantenportal gesperrt", { ton: "erfolg", text: `${mandant?.name ?? "Der Mandant"} hat keinen Zugriff mehr.` });
  };
  const freischaltenBestaetigt = () => {
    if (!mandant?.email) return;
    useData.getState().patch("akten", akte.id, { mandantenportal: true, updatedAt: nowLocal() });
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: akte.id,
      text: `Mandantenportal freigeschaltet für ${mandant.name} (Zugangs-E-Mail an ${mandant.email}) – ${akte.aktenzeichen}`,
    });
    setFrage(false);
    toast("Mandantenportal freigeschaltet", { ton: "erfolg", text: `${mandant.name} erhält die Zugangs-E-Mail an ${mandant.email}.` });
  };

  const dialoge = (
    <>
      <FreigabeDialog akte={akte} open={frage} onClose={() => setFrage(false)} onBestaetigen={freischaltenBestaetigt} onVorschau={() => setVorschau(true)} />
      <PortalVorschau akte={akte} open={vorschau} onClose={() => setVorschau(false)} />
    </>
  );
  return { freischalten: () => setFrage(true), sperren: () => void sperren(), ansehen: () => setVorschau(true), dialoge, mandant };
}

function FreigabeDialog({ akte, open, onClose, onBestaetigen, onVorschau }: { akte: Akte; open: boolean; onClose: () => void; onBestaetigen: () => void; onVorschau: () => void }) {
  const kontakte = useKontaktMap();
  const dokumente = useCol("dokumente");
  const fristen = useCol("fristen");
  const mandant = kontakte.get(akte.mandantId);
  const doks = useMemo(() => portalDokumente(akte.id, dokumente), [akte.id, dokumente]);
  const termine = useMemo(() => portalTermine(akte.id, fristen), [akte.id, fristen]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mandantenportal freischalten?"
      icon={<Globe className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" icon={<Eye className="size-4" />} className="mr-auto" onClick={onVorschau}>
            Als Mandant ansehen
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Globe className="size-4" />} disabled={!mandant?.email} onClick={onBestaetigen}>
            Freischalten
          </Button>
        </>
      }
    >
      <div className="grid gap-3 text-[13.5px] leading-relaxed text-fg-2">
        <div className="rounded-[14px] bg-ink-softer p-3.5">
          <div className="text-[12.5px] font-semibold text-fg-3">Empfängeradresse der Zugangs-E-Mail</div>
          {mandant?.email ? (
            <div className="mt-0.5 flex items-center gap-2 break-all font-medium text-fg">
              <Mail className="size-4 shrink-0 text-ink" /> {mandant.email}
            </div>
          ) : (
            <div className="mt-1 flex items-start gap-2 text-amber">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Für {mandant?.name ?? "den Mandanten"} ist keine E-Mail-Adresse hinterlegt – ohne Adresse kein Portalzugang.{" "}
                {mandant && (
                  <Link to={`/kontakte?id=${mandant.id}`} className="font-medium text-ink underline">
                    Im Kontakt ergänzen
                  </Link>
                )}
              </span>
            </div>
          )}
        </div>
        <div>
          <div className="font-semibold text-fg">Das sieht {mandant?.name ?? "der Mandant"}:</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Stand der Sache (Phase „{akte.phase}“) und die Ansprechperson</li>
            <li>
              {doks.length} {doks.length === 1 ? "bereitgestelltes Dokument" : "bereitgestellte Dokumente"} – weitere stellen Sie einzeln in der E-Akte bereit
            </li>
            <li>
              {termine.length} {termine.length === 1 ? "anstehender Termin" : "anstehende Termine"}
            </li>
            <li>Upload von Unterlagen</li>
          </ul>
          <div className="mt-2 flex items-start gap-2 text-[12.5px] text-fg-3">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>Nicht sichtbar: Entwürfe, nicht bereitgestellte Dokumente, interne Notizen, Fristen und Vorfristen, Aktenkonto und Rechnungen, KI-Analysen.</span>
          </div>
        </div>
        <p className="text-[12.5px] text-fg-3">
          Nach dem Freischalten erhält {mandant?.name ?? "der Mandant"} eine Zugangs-E-Mail mit einem Link zum Festlegen des Passworts. Im Prototyp wird die E-Mail nicht versendet. Freischalten und Sperren stehen im Verlauf der Akte.
        </p>
      </div>
    </Modal>
  );
}

/** „Als Mandant ansehen“: was der Mandant im Portal sieht – ohne interne Notizen, Fristinterna und Aktenkonto. */
function PortalVorschau({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
  const kontakte = useKontaktMap();
  const { byId } = useTeam();
  const { tenant } = useKanzlei();
  const dokumente = useCol("dokumente");
  const fristen = useCol("fristen");
  const mandant = kontakte.get(akte.mandantId);
  const ra = byId.get(akte.bearbeiterId);
  const doks = useMemo(() => portalDokumente(akte.id, dokumente), [akte.id, dokumente]);
  const termine = useMemo(() => portalTermine(akte.id, fristen), [akte.id, fristen]);
  const verborgen = useMemo(() => nichtImPortal(akte.id, dokumente), [akte.id, dokumente]);
  const idx = PHASEN.indexOf(akte.phase);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Vorschau: So sieht der Mandant das Portal"
      subtitle={`${mandant?.name ?? "Mandant"} · nur Ansicht, keine Änderungen`}
      icon={<Eye className="size-[18px]" />}
      footer={
        <Button variant="primary" onClick={onClose}>
          Vorschau schließen
        </Button>
      }
    >
      {/* fokussierbar, damit die Vorschau auch per Tastatur scrollbar ist */}
      <div tabIndex={0} aria-label={`Portalvorschau für ${mandant?.name ?? "den Mandanten"}`} className="rounded-[20px] p-4 ring-1 ring-inset ring-[var(--line)] focus-visible:outline-2 focus-visible:outline-[var(--ink)] sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ink" icon={<ShieldCheck className="size-3" />}>
            {tenant.name} · Mandantenportal
          </Chip>
          <span className="text-[12.5px] text-fg-3">Ihr Zeichen bei uns: {akte.aktenzeichen}</span>
        </div>
        <h3 className="title-lg mt-3 break-words">Ihre Angelegenheit {akte.titel}</h3>
        <div className="mt-1 text-[13px] text-fg-2">Ihre Ansprechperson: {ra?.name ?? "Ihre Kanzlei"}</div>

        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-fg-3">Stand der Sache</div>
          <div className="mt-1 text-[14px] font-semibold">{akte.phase}</div>
          <div className="mt-2 flex gap-1" role="img" aria-label={`Schritt ${idx + 1} von ${PHASEN.length}: ${akte.phase}`}>
            {PHASEN.map((p, i) => (
              <span key={p} className={i <= idx ? "h-1.5 flex-1 rounded-full bg-ink" : "h-1.5 flex-1 rounded-full bg-[var(--line-strong)]"} />
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <section>
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-3">
              <FileText className="size-3.5" /> Dokumente ({doks.length})
            </div>
            {doks.length ? (
              <ul className="mt-2 grid gap-1.5">
                {doks.slice(0, 8).map((d) => (
                  <li key={d.id} className="rounded-[12px] bg-ink-softer px-3 py-2 text-[13px]">
                    <div className="break-words font-medium">{d.name}</div>
                    <div className="text-[12.5px] text-fg-3">{fmtDate(d.createdAt.slice(0, 10))}</div>
                  </li>
                ))}
                {doks.length > 8 && <li className="text-[12.5px] text-fg-3">und {doks.length - 8} weitere</li>}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-fg-3">Noch keine Dokumente bereitgestellt.</p>
            )}
          </section>
          <section>
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-3">
              <CalendarDays className="size-3.5" /> Termine ({termine.length})
            </div>
            {termine.length ? (
              <ul className="mt-2 grid gap-1.5">
                {termine.map((t) => (
                  <li key={t.id} className="rounded-[12px] bg-ink-softer px-3 py-2 text-[13px]">
                    <div className="font-medium">{t.titel}</div>
                    <div className="text-[12.5px] text-fg-3">
                      {fmtDateWd(t.datum)}
                      {t.uhrzeit ? `, ${t.uhrzeit} Uhr` : ""}
                      {t.ort ? ` · ${t.ort}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-fg-3">Zurzeit keine Termine.</p>
            )}
          </section>
        </div>
      </div>
      {/* Kanzleiansicht – nicht Teil dessen, was der Mandant sieht */}
      <div className="mt-3 rounded-[14px] bg-ink-softer px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
        <div className="flex items-start gap-2 font-medium text-fg">
          <Lock className="mt-0.5 size-3.5 shrink-0" /> {nichtImPortalText(verborgen)}
        </div>
        <div className="mt-0.5 pl-[22px] text-fg-3">
          Bereitstellen bzw. herausnehmen je Dokument in der E-Akte. Nie im Portal: Fristen und Vorfristen, Aktenkonto, KI-Analysen{akte.mandantenportal ? "" : " – das Portal ist derzeit nicht freigeschaltet"}.
        </div>
      </div>
    </Modal>
  );
}

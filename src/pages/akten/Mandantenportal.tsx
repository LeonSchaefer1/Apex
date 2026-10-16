// Mandantenportal einer Akte: Freischalten nur nach Rückfrage, Vorschau „Als Mandant ansehen“, Sperren – jeweils protokolliert.
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarDays, Eye, FileText, Globe, Lock, Mail, ShieldCheck } from "lucide-react";
import type { Akte, Dokument, Frist } from "@/core/types";
import { fmtDate, fmtDateWd, nowLocal, today } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Modal } from "@/components/ui";
import { PHASEN, useKontaktMap, useTeam } from "./helfer";

/** Dokumente, die der Mandant im Portal sieht – keine internen Notizen, keine Rechnungen (Aktenkonto). */
export function portalDokumente(akteId: string, dokumente: Dokument[]): Dokument[] {
  return dokumente
    .filter((d) => d.akteId === akteId && ["Mandant", "Gericht", "Schriftsätze", "Korrespondenz"].includes(d.ordner) && d.art !== "notiz" && d.art !== "rechnung")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  const sperren = () => {
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
  return { freischalten: () => setFrage(true), sperren, ansehen: () => setVorschau(true), dialoge, mandant };
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
              {doks.length} {doks.length === 1 ? "freigegebenes Dokument" : "freigegebene Dokumente"} (Ordner Mandant, Gericht, Schriftsätze, Korrespondenz)
            </li>
            <li>
              {termine.length} {termine.length === 1 ? "anstehender Termin" : "anstehende Termine"}
            </li>
            <li>Upload von Unterlagen</li>
          </ul>
          <div className="mt-2 flex items-start gap-2 text-[12.5px] text-fg-3">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>Nicht sichtbar: interne Notizen, Fristen und Vorfristen, Aktenkonto und Rechnungen, KI-Analysen.</span>
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
              <p className="mt-2 text-[12.5px] text-fg-3">Noch keine Dokumente freigegeben.</p>
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
      <p className="mt-3 flex items-start gap-2 text-[12.5px] text-fg-3">
        <Lock className="mt-0.5 size-3.5 shrink-0" /> Nicht im Portal: interne Notizen, Fristen und Vorfristen, Aktenkonto und Rechnungen, KI-Analysen.
      </p>
    </Modal>
  );
}

// Reiter „Beteiligte“: Mandant, Gegner, Gegneranwalt, Gericht und Versicherung mit Kontaktdaten.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowUpRight, AtSign, BadgeCheck, FileText, HandCoins, Hash, Info, Link2, MapPin, PenLine, Phone, Plus, Send, ShieldCheck, Unlink } from "lucide-react";
import type { Akte, Kontakt, KontaktRolle, Rechtsschutz } from "@/core/types";
import { fmtDate, fmtEUR, fmtTime, nowLocal } from "@/core/dates";
import { deckungsanfrageStatus } from "@/core/einschaetzung";
import { darfEebAbgeben } from "@/lib/backend";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Card, Chip, Field, Input, Modal, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CopyButton, KontaktAvatar, kontaktAdresse } from "@/pages/kontakte/kontaktHelfer";
import { KontaktAuswahl } from "@/pages/kontakte/KontaktFormular";
import { DECKUNG_INFO } from "./helfer";
import { parseEuro } from "./Mandatsaufnahme";
import { VorschussDialog } from "./Vorschuss";

type Slot = "mandantId" | "gegnerId" | "gegneranwaltId" | "gerichtId";

const SLOTS: { slot: Slot; rolle: string; kontaktRolle: KontaktRolle; leer: string }[] = [
  { slot: "mandantId", rolle: "Mandant", kontaktRolle: "mandant", leer: "" },
  { slot: "gegnerId", rolle: "Gegner", kontaktRolle: "gegner", leer: "Noch kein Gegner erfasst." },
  { slot: "gegneranwaltId", rolle: "Gegneranwalt", kontaktRolle: "gegneranwalt", leer: "Die Gegenseite ist (noch) nicht anwaltlich vertreten." },
  { slot: "gerichtId", rolle: "Gericht", kontaktRolle: "gericht", leer: "Noch kein gerichtliches Verfahren." },
];

export function TabBeteiligte({ akte }: { akte: Akte }) {
  const kontakte = useCol("kontakte");
  const { user } = useKanzlei();
  const [zuordnen, setZuordnen] = useState<(typeof SLOTS)[number] | null>(null);
  const [az, setAz] = useState("");
  const [rsvDialog, setRsvDialog] = useState<"deckung" | "bearbeiten" | null>(null);
  const [vorschuss, setVorschuss] = useState(false);
  const versicherung = akte.rsv ? kontakte.find((k) => k.name === akte.rsv!.versicherung) : undefined;

  const ordneZu = (slot: Slot, k: Kontakt | undefined, rolle: string, kontaktRolle: KontaktRolle) => {
    const st = useData.getState();
    const patch: Partial<Akte> = { [slot]: k?.id, updatedAt: nowLocal() };
    if (slot === "gerichtId") patch.gerichtsAz = k ? az.trim() || akte.gerichtsAz : undefined;
    st.patch("akten", akte.id, patch);
    if (k && !k.rollen.includes(kontaktRolle)) st.patch("kontakte", k.id, { rollen: [...k.rollen, kontaktRolle] });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: k ? `${rolle} zugeordnet: ${k.name} – ${akte.aktenzeichen}` : `${rolle} entfernt – ${akte.aktenzeichen}` });
    toast(k ? `${rolle} zugeordnet` : `${rolle} entfernt`, { ton: "erfolg", text: k?.name });
    setZuordnen(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SLOTS.map((s, i) => {
          const k = akte[s.slot] ? kontakte.find((x) => x.id === akte[s.slot]) : undefined;
          return (
            <motion.div key={s.slot} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, type: "spring", stiffness: 420, damping: 34 }} className="min-w-0">
              {k ? (
                <KontaktKarte
                  rolle={s.rolle}
                  k={k}
                  extra={s.slot === "gerichtId" && akte.gerichtsAz ? <DatenZeile icon={<Hash className="size-3.5" />} label="Gerichts-Az." wert={akte.gerichtsAz} mono /> : undefined}
                  aktion={
                    s.slot !== "mandantId" ? (
                      <button type="button" onClick={() => ordneZu(s.slot, undefined, s.rolle, s.kontaktRolle)} className="icon-btn !size-7 text-fg-3" title={`${s.rolle} aus der Akte entfernen`} aria-label={`${s.rolle} aus der Akte entfernen`}>
                        <Unlink className="size-3.5" />
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <LeerKarte
                  rolle={s.rolle}
                  text={s.leer}
                  onZuordnen={() => {
                    setAz(akte.gerichtsAz ?? "");
                    setZuordnen(s);
                  }}
                />
              )}
            </motion.div>
          );
        })}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, type: "spring", stiffness: 420, damping: 34 }} className="min-w-0">
          {akte.rsv ? (
            <Card className="h-full">
              <KartenKopf rolle="Rechtsschutzversicherung" />
              <div className="flex items-center gap-3">
                {versicherung ? <KontaktAvatar k={versicherung} size={42} /> : <span className="grid grid-cols-1 size-[42px] shrink-0 place-items-center rounded-[13px] bg-ink-soft text-ink"><ShieldCheck className="size-5" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="title-md truncate">{akte.rsv.versicherung}</div>
                  <Chip tone={DECKUNG_INFO[akte.rsv.deckung].tone} className="mt-1">
                    {DECKUNG_INFO[akte.rsv.deckung].label}
                  </Chip>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-1">
                {akte.rsv.versicherungsnummer ? (
                  <DatenZeile icon={<BadgeCheck className="size-3.5" />} label="Versicherungsnummer" wert={akte.rsv.versicherungsnummer} mono />
                ) : (
                  <NummerNachtragen akte={akte} />
                )}
                {akte.rsv.schadennummer ? (
                  <DatenZeile icon={<Hash className="size-3.5" />} label="Schadennummer" wert={akte.rsv.schadennummer} mono />
                ) : (
                  <p className="flex items-center gap-2.5 px-2 py-1.5 text-[12.5px] text-fg-3">
                    <Hash className="size-3.5 shrink-0" /> Schadennummer noch nicht vergeben
                  </p>
                )}
                {akte.rsv.selbstbeteiligung !== undefined && <DatenZeile icon={<ShieldCheck className="size-3.5" />} label="Selbstbeteiligung" wert={fmtEUR(akte.rsv.selbstbeteiligung)} kopierbar={false} />}
                {versicherung?.email && <DatenZeile icon={<AtSign className="size-3.5" />} label="E-Mail" wert={versicherung.email} />}
                {versicherung?.telefon && <DatenZeile icon={<Phone className="size-3.5" />} label="Telefon" wert={versicherung.telefon} />}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {akte.rsv.deckung !== "abgelehnt" && (
                  <Button size="sm" variant="secondary" icon={<HandCoins className="size-4" />} onClick={() => setVorschuss(true)}>
                    Vorschuss anfordern (§ 9 RVG)
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<PenLine className="size-4" />} onClick={() => setRsvDialog("bearbeiten")}>
                  Angaben bearbeiten
                </Button>
                {(["angefragt", "erteilt", "abgelehnt"] as const)
                  .filter((x) => x !== akte.rsv!.deckung)
                  .map((x) => (
                    <Button
                      key={x}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        // „Deckung erteilt“ fragt die Schadennummer ab – sie steht danach in Schreiben und Rechnung
                        if (x === "erteilt") {
                          setRsvDialog("deckung");
                          return;
                        }
                        useData.getState().patch("akten", akte.id, { rsv: { ...akte.rsv!, deckung: x }, updatedAt: nowLocal() });
                        useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Rechtsschutz: ${DECKUNG_INFO[x].label} – ${akte.aktenzeichen}` });
                        toast(DECKUNG_INFO[x].label, { ton: x === "abgelehnt" ? "warnung" : "erfolg", text: akte.rsv!.versicherung });
                      }}
                    >
                      Als „{DECKUNG_INFO[x].label}“ markieren
                    </Button>
                  ))}
              </div>
              <DeckungsanfrageZeile akte={akte} email={versicherung?.email} />
              <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-fg-3">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Elektronischer Austausch mit Rechtsschutzversicherern (drebis): im Prototyp nicht angebunden – Versand per E-Mail oder Brief.
              </p>
              {versicherung && <KontaktLink id={versicherung.id} />}
              <RsvDialog akte={akte} modus={rsvDialog} onClose={() => setRsvDialog(null)} />
              <VorschussDialog akte={akte} open={vorschuss} onClose={() => setVorschuss(false)} />
            </Card>
          ) : (
            <LeerKarte rolle="Rechtsschutzversicherung" text="Kein Rechtsschutz hinterlegt. Ergänzen Sie ihn bei Bedarf über die Mandatsdaten." />
          )}
        </motion.div>
      </div>

      <Modal
        open={!!zuordnen}
        onClose={() => setZuordnen(null)}
        size="md"
        icon={<Link2 className="size-[18px]" />}
        title={zuordnen ? `${zuordnen.rolle} zuordnen` : ""}
        subtitle="Wählen Sie einen bestehenden Kontakt. Neue Kontakte legen Sie unter „Kontakte“ an."
      >
        {zuordnen && (
          <div className="grid grid-cols-1 gap-3">
            {zuordnen.slot === "gerichtId" && (
              <div>
                <label className="label" htmlFor="bt-az">
                  Gerichtsaktenzeichen
                </label>
                <Input id="bt-az" value={az} onChange={(e) => setAz(e.target.value)} placeholder="z. B. 211 C 148/26" className="mono" />
              </div>
            )}
            <KontaktAuswahl id="bt-auswahl" bevorzugt={[zuordnen.kontaktRolle]} ausblenden={[akte.mandantId]} onSelect={(k) => ordneZu(zuordnen.slot, k, zuordnen.rolle, zuordnen.kontaktRolle)} hoehe={340} />
          </div>
        )}
      </Modal>
    </>
  );
}

function KartenKopf({ rolle, aktion }: { rolle: string; aktion?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="eyebrow">{rolle}</span>
      {aktion}
    </div>
  );
}

function KontaktKarte({ rolle, k, extra, aktion }: { rolle: string; k: Kontakt; extra?: ReactNode; aktion?: ReactNode }) {
  const adresse = kontaktAdresse(k);
  return (
    <Card className="flex h-full flex-col">
      <KartenKopf rolle={rolle} aktion={aktion} />
      <div className="flex items-center gap-3">
        <KontaktAvatar k={k} size={42} />
        <div className="min-w-0 flex-1">
          <div className="title-md truncate">{k.name}</div>
          <div className="truncate text-[12.5px] text-fg-3">{k.typ === "person" ? [k.anrede, "Privatperson"].filter(Boolean).join(" · ") : "Organisation"}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-1">
        {extra}
        {k.email && <DatenZeile icon={<AtSign className="size-3.5" />} label="E-Mail" wert={k.email} />}
        {k.telefon && <DatenZeile icon={<Phone className="size-3.5" />} label="Telefon" wert={k.telefon} />}
        {adresse && <DatenZeile icon={<MapPin className="size-3.5" />} label="Anschrift" wert={adresse} />}
        {k.safeId && <DatenZeile icon={<ShieldCheck className="size-3.5" />} label="beA SAFE-ID" wert={k.safeId} mono />}
        {!k.email && !k.telefon && !adresse && !k.safeId && !extra && <p className="text-[12.5px] text-fg-3">Keine Kontaktdaten hinterlegt.</p>}
      </div>
      <div className="flex-1" />
      <KontaktLink id={k.id} />
    </Card>
  );
}

function KontaktLink({ id }: { id: string }) {
  return (
    <Link to={`/kontakte?id=${id}`} className="mt-4 inline-flex items-center gap-1 self-start text-[12.5px] font-medium text-ink hover:underline">
      Kontakt öffnen <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

const sbText = (n?: number) => (n === undefined ? "–" : fmtEUR(n));

/**
 * Deckungsanfrage: Der 38h-Motor legt sie nur als Entwurf vor. Versandt wird erst nach anwaltlicher Freigabe – mit Protokoll
 * („… freigegeben und versandt“), das auch die KI-Fallanalyse als „versandt am … von …“ ausweist.
 */
function DeckungsanfrageZeile({ akte, email }: { akte: Akte; email?: string }) {
  const { user, team } = useKanzlei();
  const aktivitaeten = useCol("aktivitaeten");
  const dokumente = useCol("dokumente");
  if (!akte.rsv) return null;
  const s = deckungsanfrageStatus(akte.id, aktivitaeten, dokumente);
  if (s.status === "keine") return null;
  const vers = akte.rsv.versicherung;

  if (s.status === "versandt") {
    const wer = s.vonId ? team.find((u) => u.id === s.vonId)?.name : undefined;
    return (
      <p className="mt-3 flex items-start gap-1.5 rounded-[12px] bg-[var(--ink-softer)] px-3 py-2 text-[12.5px] text-fg-2">
        <Send className="mt-0.5 size-3.5 shrink-0 text-ink" />
        <span>
          Deckungsanfrage versandt{s.am ? ` am ${fmtDate(s.am.slice(0, 10))}, ${fmtTime(s.am)} Uhr` : ""}
          {wer ? ` von ${wer}` : ""} <span className="text-fg-3">(im Prototyp simuliert)</span>
        </span>
      </p>
    );
  }

  const freigeben = async () => {
    const ok = await confirmDialog({
      titel: "Deckungsanfrage freigeben und versenden?",
      text: `Die Deckungsanfrage geht an ${vers}${email ? ` (${email})` : " per Post"}. Im Prototyp wird nichts versendet – Freigabe und Versand werden protokolliert.`,
      bestaetigen: "Freigeben und versenden",
    });
    if (!ok) return;
    const st = useData.getState();
    if (akte.rsv && akte.rsv.deckung === "offen") st.patch("akten", akte.id, { rsv: { ...akte.rsv, deckung: "angefragt" }, updatedAt: nowLocal() });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Deckungsanfrage an ${vers} freigegeben und versandt – ${akte.aktenzeichen}` });
    toast("Deckungsanfrage versandt", { text: `${vers} · im Prototyp simuliert, es wurde nichts verschickt`, ton: "erfolg" });
  };

  return (
    <div className="mt-3 rounded-[12px] bg-amber-soft px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-fg">
        <FileText className="mt-0.5 size-3.5 shrink-0" />
        Deckungsanfrage: Entwurf – wartet auf Ihre Freigabe
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link to={`/akten/${akte.id}?tab=dokumente&dok=${encodeURIComponent(s.dokumentId ?? "")}`} className="btn btn-sm btn-ghost">
          Entwurf ansehen
        </Link>
        {darfEebAbgeben(user.rolle) ? (
          <Button size="sm" variant="secondary" icon={<Send className="size-4" />} onClick={() => void freigeben()}>
            Freigeben und versenden
          </Button>
        ) : (
          <span className="self-center text-[12.5px] text-fg-3">Freigabe durch die Anwältin bzw. den Anwalt</span>
        )}
      </div>
    </div>
  );
}

/**
 * „Deckung erteilt“ mit Schadennummer bzw. „Angaben bearbeiten“: Versicherungsnummer, Schadennummer und Selbstbeteiligung
 * nachträglich ändern – jede Änderung steht im Verlauf. Rechnung und Schreiben an die RSV verwenden die aktuellen Angaben.
 */
function RsvDialog({ akte, modus, onClose }: { akte: Akte; modus: "deckung" | "bearbeiten" | null; onClose: () => void }) {
  const { user } = useKanzlei();
  const rsv = akte.rsv;
  const [vnr, setVnr] = useState("");
  const [snr, setSnr] = useState("");
  const [sb, setSb] = useState("");
  useEffect(() => {
    if (!modus || !rsv) return;
    setVnr(rsv.versicherungsnummer ?? "");
    setSnr(rsv.schadennummer ?? "");
    setSb(rsv.selbstbeteiligung !== undefined ? String(rsv.selbstbeteiligung).replace(".", ",") : "");
    // nur beim Öffnen vorbelegen
  }, [modus]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rsv) return null;
  const sbWert = sb.trim() ? parseEuro(sb) : undefined;
  const sbFehler = sbWert !== undefined && (Number.isNaN(sbWert) || sbWert < 0);
  const speichern = () => {
    if (sbFehler) return;
    const neu: Rechtsschutz = {
      ...rsv,
      versicherungsnummer: vnr.trim(),
      schadennummer: snr.trim() || undefined,
      selbstbeteiligung: sbWert,
      ...(modus === "deckung" ? { deckung: "erteilt" as const } : {}),
    };
    const aenderungen = [
      (rsv.versicherungsnummer ?? "") !== neu.versicherungsnummer ? `Versicherungsnummer ${rsv.versicherungsnummer || "–"} → ${neu.versicherungsnummer || "–"}` : "",
      (rsv.schadennummer ?? "") !== (neu.schadennummer ?? "") ? `Schadennummer ${rsv.schadennummer || "–"} → ${neu.schadennummer || "–"}` : "",
      rsv.selbstbeteiligung !== neu.selbstbeteiligung ? `Selbstbeteiligung ${sbText(rsv.selbstbeteiligung)} → ${sbText(neu.selbstbeteiligung)}` : "",
    ].filter(Boolean);
    useData.getState().patch("akten", akte.id, { rsv: neu, updatedAt: nowLocal() });
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: akte.id,
      text: `${modus === "deckung" ? `Rechtsschutz: Deckung erteilt (${rsv.versicherung})` : `Rechtsschutz-Angaben geändert (${rsv.versicherung})`}${aenderungen.length ? ` · ${aenderungen.join("; ")}` : ""} – ${akte.aktenzeichen}`,
    });
    toast(modus === "deckung" ? "Deckung erteilt" : "Rechtsschutz-Angaben gespeichert", {
      ton: "erfolg",
      text: `${rsv.versicherung}${neu.schadennummer ? ` · Schaden-Nr. ${neu.schadennummer}` : ""} – gilt für Rechnungen und Schreiben an die Versicherung`,
    });
    onClose();
  };
  return (
    <Modal
      open={!!modus}
      onClose={onClose}
      size="sm"
      icon={<ShieldCheck className="size-[18px]" />}
      title={modus === "deckung" ? "Deckung erteilt" : "Rechtsschutz bearbeiten"}
      subtitle={rsv.versicherung}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={sbFehler} onClick={speichern}>
            {modus === "deckung" ? "Deckung erteilt speichern" : "Speichern"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Schadennummer" htmlFor="rsv-snr" hint={modus === "deckung" ? "Aus der Deckungszusage – erscheint in Rechnung und Abrechnungsschreiben." : undefined}>
          <Input id="rsv-snr" value={snr} onChange={(e) => setSnr(e.target.value)} placeholder="z. B. S26-88412" className="mono" autoComplete="off" />
        </Field>
        <Field label="Versicherungsnummer" htmlFor="rsv-vnr">
          <Input id="rsv-vnr" value={vnr} onChange={(e) => setVnr(e.target.value)} placeholder="z. B. RS-4471209" className="mono" autoComplete="off" />
        </Field>
        <Field label="Selbstbeteiligung (€)" htmlFor="rsv-sb" hint={sbFehler ? <span className="text-seal">Bitte einen Betrag wie 150 oder 250,00 eingeben.</span> : "Leer lassen, wenn keine vereinbart ist."}>
          <Input id="rsv-sb" value={sb} onChange={(e) => setSb(e.target.value)} inputMode="decimal" className="num" />
        </Field>
        <p className="text-[12.5px] text-fg-3">Änderungen stehen im Verlauf der Akte.</p>
      </div>
    </Modal>
  );
}

/** Versicherungsnummer nachtragen – bei der Mandatsaufnahme ist sie oft noch nicht bekannt. */
function NummerNachtragen({ akte }: { akte: Akte }) {
  const { user } = useKanzlei();
  const [nr, setNr] = useState("");
  const speichern = () => {
    const n = nr.trim();
    if (!n || !akte.rsv) return;
    useData.getState().patch("akten", akte.id, { rsv: { ...akte.rsv, versicherungsnummer: n }, updatedAt: nowLocal() });
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Versicherungsnummer nachgetragen (${akte.rsv.versicherung}) – ${akte.aktenzeichen}` });
    toast("Versicherungsnummer gespeichert", { ton: "erfolg", text: n });
  };
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5">
      <span className="text-fg-3">
        <BadgeCheck className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={`rsv-nr-${akte.id}`} className="block text-[12px] font-medium text-fg-3">
          Versicherungsnummer · wird nachgereicht
        </label>
        <form
          className="mt-1 flex min-w-0 gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            speichern();
          }}
        >
          <Input id={`rsv-nr-${akte.id}`} value={nr} onChange={(e) => setNr(e.target.value)} placeholder="z. B. RS-4471209" autoComplete="off" className="mono !h-8 min-w-0 flex-1 !rounded-[9px] !px-2.5 text-[12.5px]" />
          <Button type="submit" size="sm" variant="secondary" disabled={!nr.trim()}>
            Speichern
          </Button>
        </form>
      </div>
    </div>
  );
}

function DatenZeile({ icon, label, wert, mono, kopierbar = true }: { icon: ReactNode; label: string; wert: string; mono?: boolean; kopierbar?: boolean }) {
  return (
    <div className="group flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 transition-colors hover:bg-ink-softer">
      <span className="text-fg-3">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-fg-3">{label}</div>
        <div className={cn("break-words text-[13px] text-fg", mono && "mono text-[12.5px]")} title={wert}>
          {wert}
        </div>
      </div>
      {kopierbar && <CopyButton text={wert} was={label} className="opacity-60 transition-opacity group-hover:opacity-100" />}
    </div>
  );
}

function LeerKarte({ rolle, text, onZuordnen }: { rolle: string; text: string; onZuordnen?: () => void }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col rounded-[22px] border border-dashed border-[var(--line-strong)] p-5">
      <span className="eyebrow">{rolle}</span>
      <p className="mt-3 flex-1 text-[13px] text-fg-3">{text}</p>
      {onZuordnen && (
        <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={onZuordnen} className="mt-3 self-start">
          {rolle} zuordnen
        </Button>
      )}
    </div>
  );
}

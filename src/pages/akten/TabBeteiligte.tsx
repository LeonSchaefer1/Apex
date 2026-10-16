// Reiter „Beteiligte“: Mandant, Gegner, Gegneranwalt, Gericht und Versicherung mit Kontaktdaten.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowUpRight, AtSign, BadgeCheck, Hash, Link2, MapPin, Phone, Plus, ShieldCheck, Unlink } from "lucide-react";
import type { Akte, Kontakt, KontaktRolle } from "@/core/types";
import { fmtEUR, nowLocal } from "@/core/dates";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Card, Chip, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CopyButton, KontaktAvatar, kontaktAdresse } from "@/pages/kontakte/kontaktHelfer";
import { KontaktAuswahl } from "@/pages/kontakte/KontaktFormular";
import { DECKUNG_INFO } from "./helfer";

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
                      <button type="button" onClick={() => ordneZu(s.slot, undefined, s.rolle, s.kontaktRolle)} className="icon-btn !size-7 text-fg-4" title={`${s.rolle} aus der Akte entfernen`} aria-label={`${s.rolle} aus der Akte entfernen`}>
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
                {akte.rsv.schadennummer && <DatenZeile icon={<Hash className="size-3.5" />} label="Schadennummer" wert={akte.rsv.schadennummer} mono />}
                {akte.rsv.selbstbeteiligung !== undefined && <DatenZeile icon={<ShieldCheck className="size-3.5" />} label="Selbstbeteiligung" wert={fmtEUR(akte.rsv.selbstbeteiligung)} kopierbar={false} />}
                {versicherung?.email && <DatenZeile icon={<AtSign className="size-3.5" />} label="E-Mail" wert={versicherung.email} />}
                {versicherung?.telefon && <DatenZeile icon={<Phone className="size-3.5" />} label="Telefon" wert={versicherung.telefon} />}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["angefragt", "erteilt", "abgelehnt"] as const)
                  .filter((x) => x !== akte.rsv!.deckung)
                  .map((x) => (
                    <Button
                      key={x}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        useData.getState().patch("akten", akte.id, { rsv: { ...akte.rsv!, deckung: x }, updatedAt: nowLocal() });
                        useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Rechtsschutz: ${DECKUNG_INFO[x].label} – ${akte.aktenzeichen}` });
                        toast(DECKUNG_INFO[x].label, { ton: x === "abgelehnt" ? "warnung" : "erfolg", text: akte.rsv!.versicherung });
                      }}
                    >
                      Als „{DECKUNG_INFO[x].label}“ markieren
                    </Button>
                  ))}
              </div>
              {versicherung && <KontaktLink id={versicherung.id} />}
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
      <span className="eyebrow !text-[10.5px]">{rolle}</span>
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
      <span className="text-fg-4">
        <BadgeCheck className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={`rsv-nr-${akte.id}`} className="block text-[10.5px] font-medium text-fg-4">
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
      <span className="text-fg-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-medium text-fg-4">{label}</div>
        <div className={cn("truncate text-[13px] text-fg", mono && "mono text-[12.5px]")} title={wert}>
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
      <span className="eyebrow !text-[10.5px]">{rolle}</span>
      <p className="mt-3 flex-1 text-[13px] text-fg-3">{text}</p>
      {onZuordnen && (
        <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={onZuordnen} className="mt-3 self-start">
          {rolle} zuordnen
        </Button>
      )}
    </div>
  );
}

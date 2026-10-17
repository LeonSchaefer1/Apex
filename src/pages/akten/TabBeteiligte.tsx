// Reiter „Beteiligte“: Mandant, Gegner, Gegneranwalt, Gericht und Versicherung mit Kontaktdaten.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, AtSign, BadgeCheck, Eye, FileText, HandCoins, Hash, Info, Link2, MapPin, PenLine, Phone, Plus, Send, ShieldCheck, Unlink } from "lucide-react";
import type { Akte, Dokument, Kontakt, KontaktRolle, Rechtsschutz } from "@/core/types";
import { fmtDate, fmtEUR, fmtTime, nowLocal } from "@/core/dates";
import { deckungsanfrageStatus } from "@/core/einschaetzung";
import { darfEebAbgeben } from "@/lib/backend";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Card, Chip, Field, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CopyButton, KontaktAvatar, kontaktAdresse } from "@/pages/kontakte/kontaktHelfer";
import { KontaktAuswahl } from "@/pages/kontakte/KontaktFormular";
import { DECKUNG_INFO, DOK_STATUS_INFO, dokumentBezeichnung, offenePlatzhalter, ohneEntwurfsVermerk } from "./helfer";
import { parseEuro } from "./Mandatsaufnahme";
import { LEERE_RSV_EINGABE, rsvNachtragen, sbFehlerhaft, versichererWarnung, type RsvEingabe } from "./rsv";
import { VersichererAuswahl } from "./VersichererAuswahl";
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
  const [rsvNeu, setRsvNeu] = useState(false);
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
              <DeckungsanfrageZeile akte={akte} email={versicherung?.email} anschrift={versicherung ? [versicherung.strasse, [versicherung.plz, versicherung.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") : undefined} />
              <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-fg-3">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Elektronischer Austausch mit Rechtsschutzversicherern (drebis): im Prototyp nicht angebunden – Versand per E-Mail oder Brief.
              </p>
              {versicherung && <KontaktLink id={versicherung.id} />}
              <RsvDialog akte={akte} modus={rsvDialog} onClose={() => setRsvDialog(null)} />
              <VorschussDialog akte={akte} open={vorschuss} onClose={() => setVorschuss(false)} />
            </Card>
          ) : (
            <LeerKarte rolle="Rechtsschutzversicherung" text="Kein Rechtsschutz hinterlegt." aktion="Rechtsschutz ergänzen" aktionIcon={<ShieldCheck className="size-4" />} onZuordnen={() => setRsvNeu(true)} />
          )}
        </motion.div>
      </div>

      <RsvErgaenzenDialog akte={akte} open={rsvNeu && !akte.rsv} onClose={() => setRsvNeu(false)} />

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
function DeckungsanfrageZeile({ akte, email, anschrift }: { akte: Akte; email?: string; anschrift?: string }) {
  const { user, team } = useKanzlei();
  const aktivitaeten = useCol("aktivitaeten");
  const dokumente = useCol("dokumente");
  const [dialog, setDialog] = useState(false);
  if (!akte.rsv) return null;
  const s = deckungsanfrageStatus(akte.id, aktivitaeten, dokumente);
  if (s.status === "keine") return null;

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

  const entwuerfe = deckungsanfragenDerAkte(akte.id, dokumente);
  return (
    <div className="mt-3 rounded-[12px] bg-amber-soft px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-fg">
        <FileText className="mt-0.5 size-3.5 shrink-0" />
        Deckungsanfrage: Entwurf – wartet auf Ihre Freigabe{entwuerfe.length > 1 ? ` (${entwuerfe.length} Fassungen in der E-Akte)` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link to={`/akten/${akte.id}?tab=dokumente&dok=${encodeURIComponent(s.dokumentId ?? "")}`} className="btn btn-sm btn-ghost">
          Entwurf ansehen
        </Link>
        {darfEebAbgeben(user.rolle) ? (
          <Button size="sm" variant="secondary" icon={<Send className="size-4" />} onClick={() => setDialog(true)}>
            Freigeben und versenden …
          </Button>
        ) : (
          <span className="self-center text-[12.5px] text-fg-3">Freigabe durch die Anwältin bzw. den Anwalt</span>
        )}
      </div>
      <FreigabeVersandDialog open={dialog} onClose={() => setDialog(false)} akte={akte} entwuerfe={entwuerfe} email={email} anschrift={anschrift} />
    </div>
  );
}

/** Deckungsanfragen der Akte, die noch nicht versandt sind – neueste zuerst. */
function deckungsanfragenDerAkte(akteId: string, dokumente: Dokument[]): Dokument[] {
  return dokumente.filter((d) => d.akteId === akteId && /deckungsanfrage/i.test(d.name) && d.status !== "versandt").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Freigabe und Versand der Deckungsanfrage: welches Dokument (Name, Datum, Version), an wen, auf welchem Weg – mit Vorschau.
 * Offene Platzhalter („[Anschrift der Versicherung]“) sperren den Versand; Protokoll mit Dokument und Version.
 */
function FreigabeVersandDialog({ open, onClose, akte, entwuerfe, email, anschrift }: { open: boolean; onClose: () => void; akte: Akte; entwuerfe: Dokument[]; email?: string; anschrift?: string }) {
  const { user } = useKanzlei();
  const [wahl, setWahl] = useState(entwuerfe[0]?.id ?? "");
  useEffect(() => {
    if (open) setWahl(entwuerfe[0]?.id ?? "");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = entwuerfe.find((x) => x.id === wahl) ?? entwuerfe[0];
  if (!akte.rsv || !d) return null;
  const vers = akte.rsv.versicherung;
  const platzhalter = offenePlatzhalter(d.inhalt);
  const weg = email ? `E-Mail an ${email}` : `Post${anschrift ? ` an ${anschrift}` : " (Anschrift laut Schreiben)"}`;
  const ansehen = `/akten/${akte.id}?tab=dokumente&dok=${encodeURIComponent(d.id)}`;

  const versenden = () => {
    if (platzhalter.length) return;
    const st = useData.getState();
    const bezeichnung = dokumentBezeichnung(d);
    const name = ohneEntwurfsVermerk(d.name);
    st.patch("dokumente", d.id, { status: "versandt", name });
    if (akte.rsv && akte.rsv.deckung === "offen") st.patch("akten", akte.id, { rsv: { ...akte.rsv, deckung: "angefragt" }, updatedAt: nowLocal() });
    st.log({ akteur: "nutzer", userId: user.id, akteId: akte.id, text: `Deckungsanfrage „${bezeichnung}“ an ${vers} freigegeben und versandt (${email ? "E-Mail" : "Post"}) – ${akte.aktenzeichen}` });
    onClose();
    toast("Deckungsanfrage versandt", { text: `${bezeichnung} · ${vers} · im Prototyp simuliert, es wurde nichts verschickt`, ton: "erfolg" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Deckungsanfrage freigeben und versenden"
      subtitle={`${akte.aktenzeichen} · ${akte.titel}`}
      icon={<Send className="size-[18px]" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Send className="size-4" />} onClick={versenden} disabled={platzhalter.length > 0} title={platzhalter.length ? "Erst alle Platzhalter ausfüllen" : undefined}>
            Freigeben und versenden
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-[13.5px]">
        {entwuerfe.length > 1 && (
          <fieldset>
            <legend className="label">Welche Fassung? ({entwuerfe.length} Deckungsanfragen in der E-Akte)</legend>
            <div className="grid gap-1.5">
              {entwuerfe.map((x) => (
                <label key={x.id} className={cn("flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[12px] px-3 py-2 ring-1 ring-inset", x.id === d.id ? "bg-ink-soft ring-[var(--ink)]" : "ring-[var(--line)] hover:bg-ink-softer")}>
                  <input type="radio" name="deckung-fassung" className="size-4 accent-[var(--ink)]" checked={x.id === d.id} onChange={() => setWahl(x.id)} />
                  <span className="min-w-0 flex-1 break-words">{dokumentBezeichnung(x)}</span>
                  {x.status && <Chip tone={DOK_STATUS_INFO[x.status].tone}>{DOK_STATUS_INFO[x.status].label}</Chip>}
                  {offenePlatzhalter(x.inhalt).length > 0 && <Chip tone="amber">{offenePlatzhalter(x.inhalt).length} Platzhalter</Chip>}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <dl className="grid gap-x-4 gap-y-2 rounded-[16px] bg-ink-softer p-4 ring-1 ring-inset ring-[var(--line)] sm:grid-cols-[140px_minmax(0,1fr)]">
          <dt className="text-fg-3">Dokument</dt>
          <dd className="break-words font-medium">{ohneEntwurfsVermerk(d.name)}</dd>
          <dt className="text-fg-3">Datum · Version</dt>
          <dd className="num">
            {fmtDate(d.createdAt.slice(0, 10))}, {fmtTime(d.createdAt)} Uhr · Version {d.version}
            {d.status ? ` · ${DOK_STATUS_INFO[d.status].label}` : ""}
          </dd>
          <dt className="text-fg-3">Empfänger</dt>
          <dd className="break-words">
            {vers}
            {akte.rsv.schadennummer ? ` · Schaden-Nr. ${akte.rsv.schadennummer}` : akte.rsv.versicherungsnummer ? ` · VS-Nr. ${akte.rsv.versicherungsnummer}` : ""}
          </dd>
          <dt className="text-fg-3">Versandweg</dt>
          <dd className="break-words">{weg}</dd>
        </dl>
        <Link to={ansehen} onClick={onClose} className="inline-flex items-center gap-1.5 justify-self-start rounded-full px-1 text-[13px] font-medium text-ink hover:underline">
          <Eye className="size-4" /> Dokument ansehen
        </Link>
        {platzhalter.length > 0 ? (
          <div role="alert" className="grid gap-2 rounded-[14px] bg-seal-soft p-3.5 text-[12.5px] leading-relaxed text-seal">
            <div className="flex gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {platzhalter.length} {platzhalter.length === 1 ? "Platzhalter ist" : "Platzhalter sind"} noch offen – so geht das Schreiben nicht hinaus:
            </div>
            <ul className="list-disc pl-9 text-fg">
              {platzhalter.map((p) => (
                <li key={p} className="break-words">
                  {p}
                </li>
              ))}
            </ul>
            <Link to={`${ansehen}&bearbeiten=1`} onClick={onClose} className="inline-flex items-center gap-1.5 justify-self-start pl-6 font-medium text-ink hover:underline">
              <PenLine className="size-3.5" /> Platzhalter im Dokument ausfüllen
            </Link>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-[12.5px] text-fg-3">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green" />
            Keine offenen Platzhalter. Im Prototyp wird nichts versendet – Freigabe, Dokument, Version und Versandweg werden protokolliert.
          </p>
        )}
      </div>
    </Modal>
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

function LeerKarte({ rolle, text, onZuordnen, aktion, aktionIcon }: { rolle: string; text: string; onZuordnen?: () => void; aktion?: string; aktionIcon?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col rounded-[22px] border border-dashed border-[var(--line-strong)] p-5">
      <span className="eyebrow">{rolle}</span>
      <p className="mt-3 flex-1 text-[13px] text-fg-3">{text}</p>
      {onZuordnen && (
        <Button size="sm" variant="secondary" icon={aktionIcon ?? <Plus className="size-4" />} onClick={onZuordnen} className="mt-3 self-start">
          {aktion ?? `${rolle} zuordnen`}
        </Button>
      )}
    </div>
  );
}

/**
 * „Rechtsschutz ergänzen“ (I4-T04-01): dieselben Felder wie Schritt 3 der Mandatsaufnahme. Speichern macht dasselbe wie die
 * Aufnahme mit Rechtsschutz – Deckung „offen“, Versicherer als Kontakt, Deckungsanfrage-Entwurf, Wiedervorlage, Verlauf (rsv.ts).
 */
function RsvErgaenzenDialog({ akte, open, onClose }: { akte: Akte; open: boolean; onClose: () => void }) {
  const { user, team, tenant } = useKanzlei();
  const [e, setE] = useState<RsvEingabe>(LEERE_RSV_EINGABE);
  const [zeigeFehler, setZeigeFehler] = useState(false);
  // Pflichtbestätigung, wenn der Gegner dieser Akte bzw. ein nur als Gegner bekannter Versicherer gewählt ist (I5-T04-01)
  const [gegenseiteOk, setGegenseiteOk] = useState(false);
  const kontakte = useCol("kontakte");
  const akten = useCol("akten");
  useEffect(() => {
    if (!open) return;
    setE(LEERE_RSV_EINGABE);
    setZeigeFehler(false);
    setGegenseiteOk(false);
  }, [open]);
  const eigenerGegner = useMemo(() => ({ kontaktId: akte.gegnerId, az: akte.aktenzeichen }), [akte.gegnerId, akte.aktenzeichen]);
  const warnung = versichererWarnung(e.versicherung, kontakte, akten, eigenerGegner);
  const versFehler = !e.versicherung.trim()
    ? "Bitte die Rechtsschutzversicherung eintragen oder aus der Liste wählen."
    : warnung && !gegenseiteOk
      ? `Bitte prüfen und bestätigen, dass ${e.versicherung.trim()} die Rechtsschutzversicherung des Mandanten ist – sonst ginge die Deckungsanfrage an die Gegenseite.`
      : undefined;
  const sbFehler = sbFehlerhaft(e.selbstbeteiligung) ? "Bitte einen Betrag wie 150 oder 250,00 eingeben – oder das Feld leeren." : undefined;
  const speichern = () => {
    if (versFehler || sbFehler) {
      setZeigeFehler(true);
      // Fokus ins erste ungültige Feld (bei fehlender Bestätigung auf das Häkchen)
      window.setTimeout(() => document.getElementById(versFehler ? (warnung && e.versicherung.trim() ? "rsvn-vers-gegenseite-ok" : "rsvn-vers") : "rsvn-sb")?.focus(), 0);
      return;
    }
    const { rsv, wiedervorlage } = rsvNachtragen({ akte, eingabe: e, user, team, tenant });
    onClose();
    toast("Rechtsschutz ergänzt", {
      ton: "erfolg",
      text: `${rsv.versicherung} · Deckung offen · Deckungsanfrage als Entwurf in der E-Akte, Wiedervorlage am ${fmtDate(wiedervorlage.datum)}`,
    });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={<ShieldCheck className="size-[18px]" />}
      title="Rechtsschutz ergänzen"
      subtitle={`${akte.aktenzeichen} · ${akte.titel}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<ShieldCheck className="size-4" />} onClick={speichern}>
            Rechtsschutz speichern
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Versicherung *" htmlFor="rsvn-vers" className="sm:col-span-2">
          <VersichererAuswahl
            id="rsvn-vers"
            value={e.versicherung}
            onChange={(v) => {
              setE((x) => ({ ...x, versicherung: v }));
              setGegenseiteOk(false);
            }}
            fehler={zeigeFehler && !!versFehler}
            describedBy={zeigeFehler && versFehler ? "rsvn-vers-fehler" : undefined}
            eigenerGegner={eigenerGegner}
            bestaetigt={gegenseiteOk}
            onBestaetigt={setGegenseiteOk}
          />
          {zeigeFehler && versFehler && (
            <p id="rsvn-vers-fehler" role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-seal">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {versFehler}
            </p>
          )}
        </Field>
        <Field label="Versicherungsnummer" htmlFor="rsvn-vnr" hint="Optional – wird nachgereicht, falls noch nicht bekannt.">
          <Input id="rsvn-vnr" value={e.nummer} onChange={(ev) => setE({ ...e, nummer: ev.target.value })} placeholder="z. B. RS-4471209" className="mono" autoComplete="off" />
        </Field>
        <Field label="Schadennummer" htmlFor="rsvn-snr" hint="Falls schon vergeben.">
          <Input id="rsvn-snr" value={e.schadennummer} onChange={(ev) => setE({ ...e, schadennummer: ev.target.value })} className="mono" autoComplete="off" />
        </Field>
        <Field
          label="Selbstbeteiligung"
          htmlFor="rsvn-sb"
          className="sm:col-span-2"
          hint={zeigeFehler && sbFehler ? <span id="rsvn-sb-fehler" role="alert" className="font-medium text-seal">{sbFehler}</span> : "Optional – die Rechnung weist sie getrennt vom Versichereranteil aus."}
        >
          <div className="relative">
            <Input id="rsvn-sb" inputMode="decimal" value={e.selbstbeteiligung} onChange={(ev) => setE({ ...e, selbstbeteiligung: ev.target.value })} placeholder="0" className="num !pr-9" aria-invalid={zeigeFehler && !!sbFehler ? true : undefined} aria-describedby={zeigeFehler && sbFehler ? "rsvn-sb-fehler" : undefined} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-fg-3">€</span>
          </div>
        </Field>
        <div className="flex items-start gap-2 rounded-[14px] bg-ink-softer p-3 text-[12.5px] leading-snug text-fg-2 shadow-[inset_0_0_0_1px_var(--line)] sm:col-span-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden />
          <span>Beim Speichern legt AnwaltApex wie in der Mandatsaufnahme die Deckungsanfrage als Entwurf an (wartet auf Ihre Freigabe) und setzt eine Wiedervorlage „Deckungszusage“ in 7 Tagen. Deckung: offen.</span>
        </div>
      </div>
    </Modal>
  );
}

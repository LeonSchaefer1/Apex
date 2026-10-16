// Kontakt-Details als Seitenpanel: Kontaktdaten, Bearbeiten, verknüpfte Akten, Interessenkonflikt-Prüfung.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, AtSign, Check, ChevronRight, FolderOpen, MapPin, PenLine, Phone, ShieldCheck, StickyNote, UserRound } from "lucide-react";
import type { Akte, Kontakt, KontaktRolle } from "@/core/types";
import { fmtDate } from "@/core/dates";
import { useData } from "@/store/data";
import { toast } from "@/store/ui";
import { Button, Chip, Drawer, Field, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { STATUS_INFO } from "@/pages/akten/helfer";
import { CopyButton, KontaktAvatar, ROLLE_LABEL, ROLLE_TONE, aktenVonKontakt, kontaktAdresse, type Konflikt } from "./kontaktHelfer";
import { KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, type KontaktEntwurf } from "./KontaktFormular";

const ALLE_ROLLEN: KontaktRolle[] = ["mandant", "gegner", "gegneranwalt", "gericht", "versicherung", "behoerde", "sonstige"];

function zuEntwurf(k: Kontakt): KontaktEntwurf {
  return {
    typ: k.typ, anrede: k.anrede ?? "", vorname: k.vorname ?? (k.typ === "person" ? k.name.split(" ").slice(0, -1).join(" ") : ""),
    nachname: k.nachname ?? (k.typ === "person" ? k.name.split(" ").slice(-1)[0] : ""), firma: k.firma ?? (k.typ === "organisation" ? k.name : ""),
    email: k.email ?? "", telefon: k.telefon ?? "", strasse: k.strasse ?? "", plz: k.plz ?? "", ort: k.ort ?? "",
  };
}

export function KontaktDrawer({ k, akten, konflikt, onClose }: { k?: Kontakt; akten: Akte[]; konflikt?: Konflikt; onClose: () => void }) {
  const letzte = useRef<Kontakt | undefined>(k);
  if (k) letzte.current = k;
  const kontakt = k ?? letzte.current;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState<KontaktEntwurf | null>(null);
  const [rollen, setRollen] = useState<KontaktRolle[]>([]);
  const [notiz, setNotiz] = useState("");

  useEffect(() => {
    setBearbeiten(false);
  }, [k?.id]);

  const starteBearbeiten = () => {
    if (!kontakt) return;
    setEntwurf(zuEntwurf(kontakt));
    setRollen(kontakt.rollen);
    setNotiz(kontakt.notiz ?? "");
    setBearbeiten(true);
  };

  const speichern = () => {
    if (!kontakt || !entwurf) return;
    const opt = (s: string) => (s.trim() ? s.trim() : undefined);
    useData.getState().patch("kontakte", kontakt.id, {
      name: entwurfName(entwurf),
      anrede: entwurf.typ === "person" ? entwurf.anrede : undefined,
      vorname: entwurf.typ === "person" ? opt(entwurf.vorname) : undefined,
      nachname: entwurf.typ === "person" ? opt(entwurf.nachname) : undefined,
      firma: entwurf.typ === "organisation" ? opt(entwurf.firma) : undefined,
      email: opt(entwurf.email),
      telefon: opt(entwurf.telefon),
      strasse: opt(entwurf.strasse),
      plz: opt(entwurf.plz),
      ort: opt(entwurf.ort),
      rollen,
      notiz: opt(notiz),
    });
    setBearbeiten(false);
    toast("Kontakt gespeichert", { ton: "erfolg", text: entwurfName(entwurf) });
  };

  const gueltig = !!entwurf && entwurfGueltig(entwurf) && !emailUngueltig(entwurf.email);
  const rollenInAkten = kontakt ? aktenVonKontakt(kontakt, akten) : [];
  const adresse = kontakt ? kontaktAdresse(kontakt) : "";

  return (
    <Drawer
      open={!!k}
      onClose={onClose}
      width={600}
      icon={<UserRound className="size-[18px]" />}
      title={bearbeiten ? "Kontakt bearbeiten" : kontakt?.name ?? ""}
      subtitle={kontakt ? `${kontakt.typ === "person" ? "Person" : "Organisation"} · angelegt am ${fmtDate(kontakt.createdAt.slice(0, 10))}` : undefined}
      footer={
        kontakt &&
        (bearbeiten ? (
          <>
            <Button variant="ghost" onClick={() => setBearbeiten(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" disabled={!gueltig || rollen.length === 0} onClick={speichern}>
              Änderungen speichern
            </Button>
          </>
        ) : (
          <Button variant="secondary" icon={<PenLine className="size-4" />} onClick={starteBearbeiten}>
            Bearbeiten
          </Button>
        ))
      }
    >
      {kontakt && (
        <AnimatePresence mode="wait" initial={false}>
          {bearbeiten && entwurf ? (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid grid-cols-1 gap-5">
              <KontaktFelder idPrefix="kd" value={entwurf} onChange={setEntwurf} typWaehlbar={false} />
              <div>
                <div className="label">Rollen</div>
                <RollenWahl value={rollen} onChange={setRollen} />
                {rollen.length === 0 && <p className="mt-1.5 text-[12px] text-seal">Bitte mindestens eine Rolle wählen.</p>}
              </div>
              <Field label="Notiz" htmlFor="kd-notiz">
                <Textarea id="kd-notiz" rows={3} value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. bevorzugt Kontakt per E-Mail, Ansprechpartner Buchhaltung" />
              </Field>
            </motion.div>
          ) : (
            <motion.div key={`ansicht-${kontakt.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid grid-cols-1 gap-5">
              <div className="flex items-center gap-4">
                <KontaktAvatar k={kontakt} size={60} />
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {kontakt.rollen.map((r) => (
                      <Chip key={r} tone={ROLLE_TONE[r]}>
                        {ROLLE_LABEL[r]}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[13px] text-fg-3">
                    {akten.length} verknüpfte {akten.length === 1 ? "Akte" : "Akten"}
                  </div>
                </div>
              </div>

              {konflikt ? (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[18px] bg-seal-soft p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--seal)_25%,transparent)]" role="alert">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-seal">
                    <AlertTriangle className="size-4" /> Interessenkonflikt prüfen
                  </div>
                  <p className="mt-1 text-[12.5px] leading-snug text-fg-2">
                    {kontakt.name} ist in einer Akte Mandant und in einer anderen Gegner. Vertretung widerstreitender Interessen ist nach § 43a Abs. 4 BRAO verboten (Parteiverrat, § 356 StGB) – bitte prüfen und dokumentieren.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <KonfliktListe titel="Als Mandant" akten={konflikt.alsMandant} />
                    <KonfliktListe titel="Als Gegner" akten={konflikt.alsGegner} />
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 rounded-[14px] bg-green-soft px-3.5 py-2.5 text-[12.5px] text-green">
                  <ShieldCheck className="size-4 shrink-0" /> Interessenkonflikt-Prüfung: keine widerstreitenden Rollen in offenen Akten gefunden.
                </div>
              )}

              <section>
                <h3 className="eyebrow mb-2 !text-[10.5px]">Kontaktdaten</h3>
                <div className="grid grid-cols-1 gap-0.5 rounded-[16px] bg-[var(--surface)] p-1.5 shadow-[0_0_0_1px_var(--line)]">
                  <Zeile icon={<AtSign className="size-3.5" />} label="E-Mail" wert={kontakt.email} />
                  <Zeile icon={<Phone className="size-3.5" />} label="Telefon" wert={kontakt.telefon} />
                  <Zeile icon={<MapPin className="size-3.5" />} label="Anschrift" wert={adresse || undefined} />
                  {kontakt.safeId && <Zeile icon={<ShieldCheck className="size-3.5" />} label="beA SAFE-ID" wert={kontakt.safeId} mono />}
                </div>
              </section>

              {kontakt.notiz && (
                <section>
                  <h3 className="eyebrow mb-2 !text-[10.5px]">Notiz</h3>
                  <p className="flex gap-2 rounded-[14px] bg-amber-soft/50 px-3.5 py-2.5 text-[13px] text-fg-2">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0 text-amber" /> {kontakt.notiz}
                  </p>
                </section>
              )}

              <section>
                <h3 className="eyebrow mb-2 !text-[10.5px]">Verknüpfte Akten</h3>
                {rollenInAkten.length === 0 ? (
                  <p className="rounded-[14px] bg-ink-softer px-3.5 py-3 text-[13px] text-fg-3">Dieser Kontakt ist noch keiner Akte zugeordnet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {rollenInAkten.map(({ akte, rolle }, i) => (
                      <motion.li key={akte.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                        <Link to={`/akten/${akte.id}`} className="group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-ink-softer">
                          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-ink-soft text-ink">
                            <FolderOpen className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="mono text-[12px] font-semibold text-fg-3">{akte.aktenzeichen}</span>
                              <Chip tone={rolle === "Mandant" ? "ink" : rolle === "Gegner" || rolle === "Schuldner" ? "outline" : "neutral"}>{rolle}</Chip>
                              {akte.status !== "offen" && <Chip tone={STATUS_INFO[akte.status].tone}>{STATUS_INFO[akte.status].label}</Chip>}
                            </span>
                            <span className="mt-0.5 block truncate text-[13.5px] font-medium">{akte.titel}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-fg-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </Drawer>
  );
}

function KonfliktListe({ titel, akten }: { titel: string; akten: Akte[] }) {
  return (
    <div className="min-w-0 rounded-[12px] bg-[var(--surface)] p-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-3">{titel}</div>
      <ul className="mt-1 grid grid-cols-1 gap-0.5">
        {akten.map((a) => (
          <li key={a.id} className="min-w-0">
            <Link to={`/akten/${a.id}`} className="flex min-w-0 items-baseline gap-1.5 text-[12.5px] hover:text-ink">
              <span className="mono shrink-0 text-[11.5px] text-fg-3">{a.aktenzeichen}</span>
              <span className="truncate">{a.titel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Zeile({ icon, label, wert, mono }: { icon: ReactNode; label: string; wert?: string; mono?: boolean }) {
  return (
    <div className="group flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors hover:bg-ink-softer">
      <span className="text-fg-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-medium text-fg-4">{label}</div>
        <div className={cn("truncate text-[13.5px]", mono && "mono text-[12.5px]", !wert && "text-fg-4")}>{wert ?? "nicht hinterlegt"}</div>
      </div>
      {wert && <CopyButton text={wert} was={label} className="opacity-60 transition-opacity group-hover:opacity-100" />}
    </div>
  );
}

export function RollenWahl({ value, onChange }: { value: KontaktRolle[]; onChange: (r: KontaktRolle[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALLE_ROLLEN.map((r) => {
        const an = value.includes(r);
        return (
          <button
            key={r}
            type="button"
            aria-pressed={an}
            onClick={() => onChange(an ? value.filter((x) => x !== r) : [...value, r])}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-all duration-200",
              an ? "bg-ink text-on-ink shadow-[0_6px_14px_-8px_var(--ink)]" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-ink-softer",
            )}
          >
            {an && <Check className="size-3" strokeWidth={3} />}
            {ROLLE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}

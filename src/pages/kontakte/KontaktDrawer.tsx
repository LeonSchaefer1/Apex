// Kontakt-Details als Seitenpanel: Kontaktdaten, Bearbeiten, verknüpfte Akten, Kollisionsprüfung für ein neues Mandat,
// Datenschutz: Auskunft (Art. 15 DSGVO) mit Export (Art. 20), Löschen mit Sperre nach § 50 BRAO.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, AtSign, Building2, Check, ChevronRight, Copy, FileDown, FolderOpen, GitMerge, Lock, MapPin, PenLine, Phone, Scale, ShieldCheck, StickyNote, Trash2, UserRound } from "lucide-react";
import type { Akte, Kontakt, KontaktRolle } from "@/core/types";
import { fmtDate, nowLocal, today } from "@/core/dates";
import { GLEICH_GRUND, gleicheKontakte, type GleichGrund } from "@/core/kontaktpruefung";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Chip, Drawer, Field, Input, Modal, Segmented, Textarea, confirmDialog } from "@/components/ui";
import { cn } from "@/lib/cn";
import { STATUS_INFO } from "@/pages/akten/helfer";
import { DateiDialog, type AusgabeDatei } from "@/pages/fristen/dateiAusgabe";
import { CopyButton, KontaktAvatar, ROLLE_LABEL, ROLLE_TONE, aktenVonKontakt, kontaktAdresse, type Konflikt } from "./kontaktHelfer";
import { KontaktFelder, emailUngueltig, entwurfGueltig, entwurfName, type KontaktEntwurf } from "./KontaktFormular";
import { auskunftDateiname, auskunftHtml, auskunftJson, erstelleAuskunft, kollisionsText, loeschSperre } from "./auskunft";
import { DATENFELD_LABEL, darfZusammenfuehren, originalUndDublette, planeZusammenfuehrung, zusammenfuehrText, type ZusammenfuehrPlan } from "./zusammenfuehren";

export type VersicherungsAngaben = NonNullable<Kontakt["versicherung"]>;
const LEERE_VERSICHERUNG: Required<VersicherungsAngaben> = { schadenabteilung: "", postfach: "", ansprechpartner: "", drebisKennung: "" };

/** Zusatzfelder der Rolle „Versicherung“ (Rechtsschutz): Schadenabteilung, Postfach/Anschrift Schaden, Ansprechpartner, drebis-Kennung. */
export function VersicherungsFelder({ value, onChange, idPrefix }: { value: VersicherungsAngaben; onChange: (v: VersicherungsAngaben) => void; idPrefix: string }) {
  const v = { ...LEERE_VERSICHERUNG, ...value };
  const set = (p: Partial<VersicherungsAngaben>) => onChange({ ...v, ...p });
  return (
    <fieldset className="grid grid-cols-1 gap-3 rounded-md bg-[var(--surface-2)] p-3.5 sm:grid-cols-2">
      <legend className="sr-only">Angaben zur Versicherung</legend>
      <div className="flex items-center gap-2 text-[13px] font-semibold sm:col-span-2">
        <ShieldCheck className="size-4 text-ink" /> Rechtsschutzversicherung – Schadenbearbeitung
      </div>
      <Field label="Schadenabteilung" htmlFor={`${idPrefix}-vs-abteilung`}>
        <Input id={`${idPrefix}-vs-abteilung`} value={v.schadenabteilung} onChange={(e) => set({ schadenabteilung: e.target.value })} placeholder="z. B. Leistung Rechtsschutz" autoComplete="off" />
      </Field>
      <Field label="Postfach bzw. Anschrift Schaden" htmlFor={`${idPrefix}-vs-postfach`}>
        <Input id={`${idPrefix}-vs-postfach`} value={v.postfach} onChange={(e) => set({ postfach: e.target.value })} placeholder="z. B. Postfach 10 20 30, 20095 Hamburg" autoComplete="off" />
      </Field>
      <Field label="Ansprechpartner" htmlFor={`${idPrefix}-vs-ansprechpartner`}>
        <Input id={`${idPrefix}-vs-ansprechpartner`} value={v.ansprechpartner} onChange={(e) => set({ ansprechpartner: e.target.value })} autoComplete="off" />
      </Field>
      <Field label="drebis-Kennung" htmlFor={`${idPrefix}-vs-drebis`} hint="Elektronischer Austausch mit Rechtsschutzversicherern – im Prototyp nicht angebunden.">
        <Input id={`${idPrefix}-vs-drebis`} value={v.drebisKennung} onChange={(e) => set({ drebisKennung: e.target.value })} className="mono" autoComplete="off" />
      </Field>
    </fieldset>
  );
}

/** Leere Felder entfernen – ohne Angaben bleibt `versicherung` ganz weg. */
export function versicherungBereinigt(v: VersicherungsAngaben | undefined): VersicherungsAngaben | undefined {
  if (!v) return undefined;
  const out: VersicherungsAngaben = {};
  for (const [k, w] of Object.entries(v) as [keyof VersicherungsAngaben, string | undefined][]) if (w?.trim()) out[k] = w.trim();
  return Object.keys(out).length ? out : undefined;
}

const ALLE_ROLLEN: KontaktRolle[] = ["mandant", "gegner", "gegneranwalt", "gericht", "versicherung", "behoerde", "sonstige"];

function zuEntwurf(k: Kontakt): KontaktEntwurf {
  return {
    typ: k.typ, anrede: k.anrede ?? "", vorname: k.vorname ?? (k.typ === "person" ? k.name.split(" ").slice(0, -1).join(" ") : ""),
    nachname: k.nachname ?? (k.typ === "person" ? k.name.split(" ").slice(-1)[0] : ""), firma: k.firma ?? (k.typ === "organisation" ? k.name : ""),
    email: k.email ?? "", telefon: k.telefon ?? "", strasse: k.strasse ?? "", plz: k.plz ?? "", ort: k.ort ?? "",
  };
}

export function KontaktDrawer({ k, akten, konflikt, onClose, onOeffne }: { k?: Kontakt; akten: Akte[]; konflikt?: Konflikt; onClose: () => void; /** anderen Kontakt im Panel öffnen (Doppel-Datensatz, nach dem Zusammenführen) */ onOeffne?: (id: string) => void }) {
  const letzte = useRef<Kontakt | undefined>(k);
  if (k) letzte.current = k;
  const kontakt = k ?? letzte.current;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState<KontaktEntwurf | null>(null);
  const [rollen, setRollen] = useState<KontaktRolle[]>([]);
  const [notiz, setNotiz] = useState("");
  const [versicherung, setVersicherung] = useState<VersicherungsAngaben>({});
  const [dateien, setDateien] = useState<AusgabeDatei[] | null>(null);
  const [pruefAls, setPruefAls] = useState<"mandant" | "gegner">("mandant");
  const [pruefung, setPruefung] = useState<{ als: "mandant" | "gegner"; konflikt: boolean; text: string } | null>(null);
  const alleAkten = useCol("akten");
  const dokumente = useCol("dokumente");
  const nachrichten = useCol("nachrichten");
  const alleKontakte = useCol("kontakte");
  const { user, tenant } = useKanzlei();
  // Doppel-Datensätze derselben Person bzw. Firma (Name ohne Rechtsform, E-Mail, Telefon, Firmen-Domain)
  const gleiche = kontakt ? gleicheKontakte(kontakt, alleKontakte) : [];
  const [zusammen, setZusammen] = useState<Kontakt | null>(null);

  useEffect(() => {
    setBearbeiten(false);
    setPruefung(null);
    setZusammen(null);
  }, [k?.id]);

  const starteBearbeiten = () => {
    if (!kontakt) return;
    setEntwurf(zuEntwurf(kontakt));
    setRollen(kontakt.rollen);
    setNotiz(kontakt.notiz ?? "");
    setVersicherung(kontakt.versicherung ?? {});
    setBearbeiten(true);
  };

  /** Auskunft nach Art. 15 DSGVO (HTML, druckbar) und Export nach Art. 20 (JSON) – protokolliert. */
  const auskunftErstellen = () => {
    if (!kontakt) return;
    const a = erstelleAuskunft(kontakt, { akten: alleAkten, dokumente, nachrichten }, tenant, today());
    setDateien([
      { name: auskunftDateiname(a, "html"), mime: "text/html", inhalt: auskunftHtml(a), label: "Auskunft (HTML, druckbar)", beschreibung: "Auskunft nach Art. 15 DSGVO" },
      { name: auskunftDateiname(a, "json"), mime: "application/json", inhalt: auskunftJson(a), label: "Export (JSON, Art. 20)", beschreibung: "Datenexport nach Art. 20 DSGVO" },
    ]);
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      text: `Auskunft nach Art. 15 DSGVO für ${kontakt.name} erstellt (HTML und JSON nach Art. 20) – ${a.akten.length} ${a.akten.length === 1 ? "Akte" : "Akten"}, ${a.dokumente.length} Dokumente, ${a.nachrichten.length} Nachrichten · durch ${user.name}`,
    });
  };

  /** Kollisionsprüfung für ein neues Mandat – Ergebnis wird protokolliert. */
  const kollisionPruefen = () => {
    if (!kontakt) return;
    // Über den Kontakt UND alle gleichen Datensätze – eine Dublette darf die Prüfung nicht aushebeln (I4-T17-01)
    const r = kollisionsText(kontakt, alleAkten, pruefAls, alleKontakte);
    setPruefung({ als: pruefAls, ...r });
    useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Kollisionsprüfung für neues Mandat: ${kontakt.name} als ${pruefAls === "mandant" ? "Mandant" : "Gegner"} – ${r.text} · durch ${user.name}` });
  };

  const loeschen = async () => {
    if (!kontakt) return;
    const sperre = loeschSperre(kontakt, alleAkten);
    if (sperre.gesperrt) return;
    const ok = await confirmDialog({
      titel: `Kontakt „${kontakt.name}“ löschen?`,
      text: "Der Kontakt ist keiner Akte zugeordnet. Er wird mit allen Kontaktdaten gelöscht; das lässt sich nicht rückgängig machen. Der Vorgang wird protokolliert.",
      bestaetigen: "Endgültig löschen",
      gefahr: true,
    });
    if (!ok) return;
    useData.getState().remove("kontakte", kontakt.id);
    useData.getState().log({ akteur: "nutzer", userId: user.id, text: `Kontakt gelöscht (Art. 17 DSGVO): ${kontakt.name} – ohne Aktenbezug · durch ${user.name}` });
    toast("Kontakt gelöscht", { ton: "erfolg", text: kontakt.name });
    onClose();
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
      versicherung: rollen.includes("versicherung") ? versicherungBereinigt(versicherung) : kontakt.versicherung,
    });
    setBearbeiten(false);
    toast("Kontakt gespeichert", { ton: "erfolg", text: entwurfName(entwurf) });
  };

  const gueltig = !!entwurf && entwurfGueltig(entwurf) && !emailUngueltig(entwurf.email);
  const rollenInAkten = kontakt ? aktenVonKontakt(kontakt, akten) : [];
  const adresse = kontakt ? kontaktAdresse(kontakt) : "";
  const sperre = kontakt ? loeschSperre(kontakt, alleAkten) : { gesperrt: false as const };
  const offeneRollen = rollenInAkten.filter((x) => x.akte.status !== "abgeschlossen");

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
          <>
            <Button
              variant="ghost"
              icon={sperre.gesperrt ? <Lock className="size-4" /> : <Trash2 className="size-4" />}
              disabled={sperre.gesperrt}
              onClick={() => void loeschen()}
              title={sperre.gesperrt ? sperre.grund : "Kontakt löschen (mit Sicherheitsabfrage)"}
              aria-describedby={sperre.gesperrt ? "kd-loeschsperre" : undefined}
              className="mr-auto !text-[var(--seal-text)]"
            >
              Löschen
            </Button>
            <Button variant="secondary" icon={<FileDown className="size-4" />} onClick={auskunftErstellen}>
              Auskunft (Art. 15)
            </Button>
            <Button variant="secondary" icon={<PenLine className="size-4" />} onClick={starteBearbeiten}>
              Bearbeiten
            </Button>
          </>
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
                {rollen.length === 0 && <p className="mt-1.5 text-[13px] text-seal">Bitte mindestens eine Rolle wählen.</p>}
              </div>
              {rollen.includes("versicherung") && <VersicherungsFelder idPrefix="kd" value={versicherung} onChange={setVersicherung} />}
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
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-md bg-seal-soft p-4" role="alert">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-seal">
                    <AlertTriangle className="size-4" /> Interessenkonflikt prüfen
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-fg-2">
                    {kontakt.name} ist in einer Akte Mandant und in einer anderen Gegner. Vertretung widerstreitender Interessen ist nach § 43a Abs. 4 BRAO verboten (Parteiverrat, § 356 StGB) – bitte prüfen und dokumentieren.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <KonfliktListe titel="Als Mandant" akten={konflikt.alsMandant} />
                    <KonfliktListe titel="Als Gegner" akten={konflikt.alsGegner} />
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-start gap-2 rounded-md bg-[var(--surface-2)] px-3.5 py-2.5 text-[13px] text-fg-2">
                  <Scale className="mt-0.5 size-4 shrink-0 text-fg-3" />
                  <span>
                    <span className="font-medium text-fg">Derzeitige Rollen: </span>
                    {offeneRollen.length ? offeneRollen.map((x) => `${x.rolle} in ${x.akte.aktenzeichen}`).join(", ") : "in keiner offenen Akte"}
                  </span>
                </div>
              )}

              {gleiche.length > 0 && <DoppelHinweis kontakt={kontakt} gleiche={gleiche} onOeffne={onOeffne} onZusammenfuehren={setZusammen} darf={darfZusammenfuehren(user.rolle)} />}

              <section className="rounded-lg p-3.5 shadow-[inset_0_0_0_1px_var(--line)]" aria-labelledby="kd-kollision-titel">
                <h3 id="kd-kollision-titel" className="text-[14px] font-semibold">
                  Kollisionsprüfung für neues Mandat
                </h3>
                <p className="mt-0.5 text-[13px] text-fg-3">Prüft, ob {kontakt.name} in einer neuen Sache als Mandant bzw. als Gegner mit einer bestehenden Rolle kollidiert (§ 43a Abs. 4 BRAO).</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Segmented
                    size="sm"
                    value={pruefAls}
                    onChange={(v) => {
                      setPruefAls(v);
                      setPruefung(null);
                    }}
                    options={[
                      { value: "mandant", label: "als Mandant" },
                      { value: "gegner", label: "als Gegner" },
                    ]}
                  />
                  <Button size="sm" variant="secondary" icon={<Scale className="size-4" />} onClick={kollisionPruefen}>
                    Prüfen
                  </Button>
                </div>
                <div aria-live="polite">
                  {pruefung && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("mt-2.5 flex items-start gap-2 rounded-md px-3 py-2 text-[13px]", pruefung.konflikt ? "bg-seal-soft font-medium text-seal" : "bg-ink-softer text-fg-2")}
                    >
                      {pruefung.konflikt ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0 text-fg-3" />}
                      <span>
                        {pruefung.text}
                        <span className="block text-[13px] font-normal text-fg-3">Ergebnis im Protokoll vermerkt.</span>
                      </span>
                    </motion.p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="eyebrow mb-2">Kontaktdaten</h3>
                <div className="grid grid-cols-1 gap-0.5 rounded-lg bg-[var(--surface)] p-1.5 shadow-[0_0_0_1px_var(--line)]">
                  <Zeile icon={<AtSign className="size-3.5" />} label="E-Mail" wert={kontakt.email} />
                  <Zeile icon={<Phone className="size-3.5" />} label="Telefon" wert={kontakt.telefon} />
                  <Zeile icon={<MapPin className="size-3.5" />} label="Anschrift" wert={adresse || undefined} />
                  {kontakt.safeId && <Zeile icon={<ShieldCheck className="size-3.5" />} label="beA SAFE-ID" wert={kontakt.safeId} mono />}
                  {kontakt.versicherung?.schadenabteilung && <Zeile icon={<Building2 className="size-3.5" />} label="Schadenabteilung" wert={kontakt.versicherung.schadenabteilung} />}
                  {kontakt.versicherung?.postfach && <Zeile icon={<MapPin className="size-3.5" />} label="Postfach bzw. Anschrift Schaden" wert={kontakt.versicherung.postfach} />}
                  {kontakt.versicherung?.ansprechpartner && <Zeile icon={<UserRound className="size-3.5" />} label="Ansprechpartner" wert={kontakt.versicherung.ansprechpartner} />}
                  {kontakt.versicherung?.drebisKennung && <Zeile icon={<ShieldCheck className="size-3.5" />} label="drebis-Kennung" wert={kontakt.versicherung.drebisKennung} mono />}
                </div>
                {kontakt.rollen.includes("versicherung") && !kontakt.versicherung && (
                  <p className="mt-1.5 px-1 text-[13px] text-fg-3">Schadenabteilung, Postfach, Ansprechpartner und drebis-Kennung lassen sich über „Bearbeiten“ ergänzen.</p>
                )}
              </section>

              {kontakt.notiz && (
                <section>
                  <h3 className="eyebrow mb-2">Notiz</h3>
                  <p className="flex gap-2 rounded-lg bg-amber-soft/50 px-3.5 py-2.5 text-[13px] text-fg-2">
                    <StickyNote className="mt-0.5 size-3.5 shrink-0 text-amber" /> {kontakt.notiz}
                  </p>
                </section>
              )}

              <section>
                <h3 className="eyebrow mb-2">Verknüpfte Akten</h3>
                {rollenInAkten.length === 0 ? (
                  <p className="rounded-md bg-[var(--surface-2)] px-3.5 py-3 text-[13px] text-fg-3">Dieser Kontakt ist noch keiner Akte zugeordnet.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {rollenInAkten.map(({ akte, rolle }, i) => (
                      <motion.li key={akte.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                        <Link to={`/akten/${akte.id}`} className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                          <span className="grid size-5 shrink-0 place-items-center text-fg-4">
                            <FolderOpen className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="mono text-[13px] font-semibold text-fg-3">{akte.aktenzeichen}</span>
                              <Chip tone={rolle === "Mandant" ? "ink" : rolle === "Gegner" || rolle === "Schuldner" ? "outline" : "neutral"}>{rolle}</Chip>
                              {akte.status !== "offen" && <Chip tone={STATUS_INFO[akte.status].tone}>{STATUS_INFO[akte.status].label}</Chip>}
                            </span>
                            <span className="mt-0.5 block break-words text-[14px] font-medium">{akte.titel}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="kd-datenschutz-titel">
                <h3 id="kd-datenschutz-titel" className="eyebrow mb-2">
                  Datenschutz
                </h3>
                <div className="grid grid-cols-1 gap-2 rounded-lg bg-[var(--surface)] p-3.5 text-[13px] shadow-[0_0_0_1px_var(--line)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" icon={<FileDown className="size-4" />} onClick={auskunftErstellen}>
                      Auskunft erstellen (Art. 15 DSGVO)
                    </Button>
                    <span className="text-[13px] text-fg-3">druckbares HTML und JSON-Export (Art. 20) – wird protokolliert</span>
                  </div>
                  <p id="kd-loeschsperre" className={cn("flex items-start gap-2 text-[13px]", sperre.gesperrt ? "text-fg-2" : "text-fg-3")}>
                    {sperre.gesperrt ? <Lock className="mt-0.5 size-3.5 shrink-0 text-amber" /> : <Trash2 className="mt-0.5 size-3.5 shrink-0" />}
                    <span>{sperre.gesperrt ? <>Löschen gesperrt: {sperre.grund}</> : "Kein Aktenbezug – der Kontakt kann gelöscht werden (mit Sicherheitsabfrage)."}</span>
                  </p>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      <DateiDialog dateien={dateien} titel={kontakt ? `Auskunft: ${kontakt.name}` : undefined} onClose={() => setDateien(null)} />
      {kontakt && zusammen && (
        <ZusammenfuehrenDialog
          a={kontakt}
          b={zusammen}
          onClose={() => setZusammen(null)}
          onFertig={(originalId) => {
            setZusammen(null);
            if (originalId !== kontakt.id) onOeffne?.(originalId);
          }}
        />
      )}
    </Drawer>
  );
}

/** „Möglicher Doppel-Datensatz: „Kröger Logistik GmbH“ (Berlin) – zusammenführen?“ */
function DoppelHinweis({ kontakt, gleiche, onOeffne, onZusammenfuehren, darf }: { kontakt: Kontakt; gleiche: { kontakt: Kontakt; grund: GleichGrund }[]; onOeffne?: (id: string) => void; onZusammenfuehren: (k: Kontakt) => void; darf: boolean }) {
  const alleAkten = useCol("akten");
  return (
    <section role="status" aria-labelledby="kd-doppel-titel" className="rounded-lg bg-amber-soft p-4 text-[13px]">
      <h3 id="kd-doppel-titel" className="flex items-center gap-2 text-[14px] font-semibold text-fg">
        <Copy className="size-4 shrink-0 text-[var(--amber-text)]" aria-hidden />
        <span className="min-w-0 break-words">
          {gleiche.length === 1
            ? `Möglicher Doppel-Datensatz: „${gleiche[0].kontakt.name}“${gleiche[0].kontakt.ort ? ` (${gleiche[0].kontakt.ort})` : ""} – zusammenführen?`
            : `${gleiche.length} mögliche Doppel-Datensätze – zusammenführen?`}
        </span>
      </h3>
      <ul className="mt-2 grid gap-2">
        {gleiche.map(({ kontakt: g, grund }) => (
          <li key={g.id} className="rounded-lg bg-[var(--surface)] p-3 shadow-[0_0_0_1px_var(--line)]">
            <p className="break-words text-fg-2">
              <span className="font-semibold text-fg">„{g.name}“</span>
              {g.ort ? ` (${g.ort})` : ""} – {GLEICH_GRUND[grund]}, angelegt am {fmtDate(g.createdAt.slice(0, 10))}{aktenVonKontakt(g, alleAkten).length ? `, beteiligt in ${aktenVonKontakt(g, alleAkten).slice(0, 3).map((x) => `${x.akte.aktenzeichen} (${x.rolle})`).join(", ")}` : ""}. Ist das {kontakt.typ === "organisation" ? "dieselbe Firma" : "dieselbe Person"}? Dann zusammenführen – die Kollisionsprüfung berücksichtigt beide Datensätze schon jetzt.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {onOeffne && (
                <Button size="sm" variant="ghost" iconRight={<ArrowRight className="size-4" />} onClick={() => onOeffne(g.id)}>
                  „{g.name}“ öffnen
                </Button>
              )}
              {darf ? (
                <Button size="sm" variant="secondary" icon={<GitMerge className="size-4" />} onClick={() => onZusammenfuehren(g)}>
                  Zusammenführen …
                </Button>
              ) : (
                <span className="self-center text-[13px] text-fg-3">Zusammenführen dürfen Partner, Anwälte und die Administration.</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Doppel-Datensatz zusammenführen: Vorschau der betroffenen Akten und Rechnungen, übernommene Rollen und Daten,
 * Rückfrage mit Fokus auf „Abbrechen“. Danach sind alle Verweise umgehängt, die Dublette ist gelöscht – mit Protokoll.
 */
function ZusammenfuehrenDialog({ a, b, onClose, onFertig }: { a: Kontakt; b: Kontakt; onClose: () => void; onFertig: (originalId: string) => void }) {
  const { user } = useKanzlei();
  const akten = useCol("akten");
  const rechnungen = useCol("rechnungen");
  const start = originalUndDublette(a, b);
  const [getauscht, setGetauscht] = useState(false);
  const original = getauscht ? start.dublette : start.original;
  const dublette = getauscht ? start.original : start.dublette;
  const plan: ZusammenfuehrPlan = planeZusammenfuehrung(original, dublette, { akten, rechnungen });

  const ausfuehren = () => {
    const st = useData.getState();
    const jetzt = nowLocal();
    for (const x of plan.akten) {
      st.patch("akten", x.akte.id, { ...x.patch, updatedAt: jetzt });
      st.log({ akteur: "nutzer", userId: user.id, akteId: x.akte.id, text: `Beteiligte bereinigt: Doppel-Datensatz „${dublette.name}“ (${x.rollen.join(", ")}) durch „${original.name}“ ersetzt – ${x.akte.aktenzeichen}` });
    }
    for (const x of plan.rechnungen) st.patch("rechnungen", x.rechnung.id, x.patch);
    const { id: _id, ...rest } = plan.kontakt;
    void _id;
    st.patch("kontakte", original.id, rest);
    st.remove("kontakte", dublette.id);
    st.log({ akteur: "nutzer", userId: user.id, text: zusammenfuehrText(plan, user.name) });
    toast("Kontakte zusammengeführt", { ton: "erfolg", text: `${plan.akten.length} ${plan.akten.length === 1 ? "Akte" : "Akten"} und ${plan.rechnungen.length} ${plan.rechnungen.length === 1 ? "Rechnung" : "Rechnungen"} umgehängt – „${original.name}“ bleibt.` });
    onFertig(original.id);
  };

  const zeile = (k: Kontakt) => `„${k.name}“${k.ort ? ` (${k.ort})` : ""} · angelegt am ${fmtDate(k.createdAt.slice(0, 10))}`;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<GitMerge className="size-[18px]" />}
      title="Doppel-Datensatz zusammenführen?"
      subtitle="Alle Verweise gehen auf den Datensatz über, der bleibt. Das lässt sich nicht rückgängig machen."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Abbrechen
          </Button>
          <Button variant="danger" icon={<GitMerge className="size-4" />} onClick={ausfuehren}>
            Zusammenführen und Doppel-Datensatz löschen
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-[13px]">
        <dl className="grid gap-x-4 gap-y-2 rounded-md bg-[var(--surface-2)] p-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <dt className="text-fg-3">Bleibt erhalten</dt>
          <dd className="break-words font-semibold text-fg">{zeile(original)}</dd>
          <dt className="text-fg-3">Wird gelöscht</dt>
          <dd className="break-words text-fg-2">{zeile(dublette)}</dd>
        </dl>
        <Button size="sm" variant="ghost" className="justify-self-start" onClick={() => setGetauscht((x) => !x)}>
          Umgekehrt: „{dublette.name}“{dublette.ort ? ` (${dublette.ort})` : ""} behalten
        </Button>
        <section aria-labelledby="zf-akten">
          <h3 id="zf-akten" className="eyebrow mb-1.5">
            Betroffene Akten ({plan.akten.length})
          </h3>
          {plan.akten.length ? (
            <ul className="grid gap-1">
              {plan.akten.map((x) => (
                <li key={x.akte.id} className="flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1">
                  <span className="mono shrink-0 text-[13px] font-semibold text-fg-2">{x.akte.aktenzeichen}</span>
                  <span className="min-w-0 flex-1 break-words">{x.akte.titel}</span>
                  <Chip>{x.rollen.join(", ")}</Chip>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 text-fg-3">Der Doppel-Datensatz ist keiner Akte zugeordnet.</p>
          )}
        </section>
        <section aria-labelledby="zf-rechnungen">
          <h3 id="zf-rechnungen" className="eyebrow mb-1.5">
            Betroffene Rechnungen ({plan.rechnungen.length})
          </h3>
          {plan.rechnungen.length ? (
            <p className="px-2 text-fg-2">Empfänger wird „{original.name}“: {plan.rechnungen.map((x) => x.rechnung.nummer).join(", ")}</p>
          ) : (
            <p className="px-2 text-fg-3">Keine Rechnungen an den Doppel-Datensatz.</p>
          )}
        </section>
        <section aria-labelledby="zf-daten">
          <h3 id="zf-daten" className="eyebrow mb-1.5">
            Rollen und Kontaktdaten
          </h3>
          <ul className="grid gap-1 px-2 text-fg-2">
            <li>Rollen danach: {plan.kontakt.rollen.map((r) => ROLLE_LABEL[r]).join(", ") || "–"}{plan.neueRollen.length ? ` (neu: ${plan.neueRollen.map((r) => ROLLE_LABEL[r]).join(", ")})` : ""}</li>
            <li>{plan.uebernommen.length ? `Übernommen, weil beim bleibenden Datensatz leer: ${plan.uebernommen.map((x) => `${DATENFELD_LABEL[x.feld]} ${x.wert}`).join(" · ")}` : "Keine fehlenden Kontaktdaten zu übernehmen."}</li>
            {plan.abweichend.length > 0 && (
              <li className="text-[var(--amber-text)]">
                Abweichend, bleibt wie beim bleibenden Datensatz: {plan.abweichend.map((x) => `${DATENFELD_LABEL[x.feld]} ${x.original} (statt ${x.dublette})`).join(" · ")}
              </li>
            )}
          </ul>
        </section>
        <p className="flex items-start gap-2 text-[13px] text-fg-3">
          <Scale className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Der Vorgang steht mit Ihrem Namen im Kanzleiprotokoll und im Verlauf jeder betroffenen Akte.
        </p>
      </div>
    </Modal>
  );
}

function KonfliktListe({ titel, akten }: { titel: string; akten: Akte[] }) {
  return (
    <div className="min-w-0 rounded-md bg-[var(--surface)] p-2.5">
      <div className="text-[12px] font-medium text-fg-3">{titel}</div>
      <ul className="mt-1 grid grid-cols-1 gap-0.5">
        {akten.map((a) => (
          <li key={a.id} className="min-w-0">
            <Link to={`/akten/${a.id}`} className="flex min-w-0 items-baseline gap-1.5 text-[13px] hover:text-ink">
              <span className="mono shrink-0 text-[12px] text-fg-3">{a.aktenzeichen}</span>
              <span className="break-words">{a.titel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Zeile({ icon, label, wert, mono }: { icon: ReactNode; label: string; wert?: string; mono?: boolean }) {
  return (
    <div className="group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-[var(--surface-2)]">
      <span className="text-fg-3">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-fg-3">{label}</div>
        <div className={cn("break-words text-[14px]", mono && "mono text-[13px]", !wert && "text-fg-3")}>{wert ?? "nicht hinterlegt"}</div>
      </div>
      {wert && <CopyButton text={wert} was={label} className="opacity-60 transition-opacity group-hover:opacity-100" />}
    </div>
  );
}

/**
 * Rollen als Umschaltknöpfe. `labelId`/`beschreibungId`: Gruppe mit Namen und Hinweis bzw. Fehler; `ungueltig` markiert die
 * Knöpfe nach einem Speicherversuch ohne Rolle (aria-invalid) – der erste Knopf bekommt `erstesId` für den Fokus.
 */
export function RollenWahl({ value, onChange, labelId, beschreibungId, ungueltig, erstesId }: { value: KontaktRolle[]; onChange: (r: KontaktRolle[]) => void; labelId?: string; beschreibungId?: string; ungueltig?: boolean; erstesId?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role={labelId ? "group" : undefined} aria-labelledby={labelId} aria-describedby={beschreibungId}>
      {ALLE_ROLLEN.map((r, i) => {
        const an = value.includes(r);
        return (
          <button
            key={r}
            id={i === 0 ? erstesId : undefined}
            type="button"
            aria-pressed={an}
            aria-invalid={ungueltig || undefined}
            aria-describedby={ungueltig ? beschreibungId : undefined}
            onClick={() => onChange(an ? value.filter((x) => x !== r) : [...value, r])}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors duration-100 max-sm:h-11",
              an ? "bg-[var(--surface-3)] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-[var(--surface-2)]",
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

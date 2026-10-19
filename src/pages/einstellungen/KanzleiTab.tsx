import { useEffect, useState } from "react";
import { Building2, Check, Info, MapPin } from "lucide-react";
import { motion } from "motion/react";
import type { Bundesland, Sachgebiet, Tenant } from "@/core/types";
import { BUNDESLAENDER, bundeslandAusOrt, bundeslandName } from "@/core/feiertage";
import { fmtDate } from "@/core/dates";
import { darfVerwalten, getBackend, istConsole } from "@/lib/backend";
import { useData } from "@/store/data";
import { useKanzlei, useSession } from "@/store/session";
import { toast } from "@/store/ui";
import { Button, Field, Input, Select, confirmDialog } from "@/components/ui";
import { VORGANG } from "@/lib/backend/protokoll";
import { cn } from "@/lib/cn";
import { Abschnitt } from "./teile";
import { RechnungsangabenAbschnitt } from "./Rechnungsangaben";

const SACHGEBIETE: Sachgebiet[] = ["Arbeitsrecht", "Mietrecht", "Verkehrsrecht", "Familienrecht", "Erbrecht", "Strafrecht", "Forderungseinzug", "Vertragsrecht", "Baurecht", "Verwaltungsrecht"];

type Profil = Pick<Tenant, "name" | "kurzname" | "adresse" | "stadt" | "bundesland"> & { schwerpunkte: string[] };

const profilAus = (t: Tenant): Profil => ({ name: t.name, kurzname: t.kurzname, adresse: t.adresse, stadt: t.stadt, bundesland: t.bundesland, schwerpunkte: t.schwerpunkte });

export function KanzleiTab() {
  const { tenant, user } = useKanzlei();
  const darf = darfVerwalten(user.rolle);
  const gespeichert = profilAus(tenant);
  const [p, setP] = useState<Profil>(gespeichert);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const geaendert = JSON.stringify(p) !== JSON.stringify(gespeichert);
  const stand = JSON.stringify(gespeichert);

  // Gespeicherter Stand kam von außen (z. B. andere Sitzung, Neuladen) → Formular nachziehen, solange nichts bearbeitet wird
  useEffect(() => {
    setP(JSON.parse(stand) as Profil);
  }, [stand]);

  const set = <K extends keyof Profil>(k: K, v: Profil[K]) => setP((x) => ({ ...x, [k]: v }));
  // Stadt → Bundesland: Vorschlag, wenn die Stadt in einem anderen Land liegt („Potsdam liegt in Brandenburg – übernehmen?“)
  const ausStadt = p.stadt.trim() ? bundeslandAusOrt(p.stadt) : undefined;
  const abweichend = !!ausStadt && ausStadt !== p.bundesland;
  const toggle = (sg: string) => set("schwerpunkte", p.schwerpunkte.includes(sg) ? p.schwerpunkte.filter((x) => x !== sg) : [...p.schwerpunkte, sg]);

  const speichern = async () => {
    if (!darf) return;
    if (!p.name.trim()) return setFehler("Bitte geben Sie den Namen der Kanzlei an – er erscheint auf Schriftsätzen und Rechnungen.");
    if (!p.adresse.trim()) return setFehler("Bitte geben Sie die Anschrift an.");
    setFehler(null);
    const landGeaendert = p.bundesland !== tenant.bundesland;
    if (landGeaendert) {
      const ok = await confirmDialog({
        titel: `Bundesland auf ${bundeslandName(p.bundesland)} ändern?`,
        text: `Ändert die Voreinstellung der Feiertage im Fristenrechner (bisher ${bundeslandName(tenant.bundesland)}). Bestehende Fristen bleiben unverändert; maßgeblich bleiben die Feiertage am Ort des Gerichts (§ 222 Abs. 2 ZPO).`,
        bestaetigen: "Bundesland ändern",
      });
      if (!ok) return;
    }
    setLaedt(true);
    try {
      const neu = await getBackend().kanzlei.profilSpeichern({ ...p, name: p.name.trim(), kurzname: p.kurzname.trim(), adresse: p.adresse.trim(), stadt: p.stadt.trim() });
      const s = useSession.getState().sitzung;
      if (s && !istConsole(s)) useSession.getState().setSitzung({ ...s, tenant: neu });
      setP(profilAus(neu));
      if (landGeaendert) useData.getState().log({ akteur: "nutzer", userId: user.id, text: VORGANG.bundeslandGeaendert(bundeslandName(tenant.bundesland), bundeslandName(neu.bundesland)) });
      useData.getState().log({ akteur: "nutzer", userId: user.id, text: "Kanzleiprofil bearbeitet" });
      toast("Kanzleiprofil gespeichert", { text: "Gilt ab sofort für Seitenleiste, Briefkopf, Rechnungen und Schriftsätze.", ton: "erfolg" });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das Kanzleiprofil konnte nicht gespeichert werden.");
    } finally {
      setLaedt(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
      <Abschnitt titel="Kanzleiprofil" text="Name, Anschrift und Schwerpunkte – so erscheint Ihre Kanzlei auf Schriftsätzen, Rechnungen und im Mandantenportal." icon={<Building2 className="size-[18px]" />}>
        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void speichern();
          }}
        >
          <fieldset disabled={!darf} className="contents">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label="Name der Kanzlei" htmlFor="k-name" className="md:col-span-2">
              <Input id="k-name" value={p.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" />
            </Field>
            <Field label="Kurzname" htmlFor="k-kurz" hint="Für Navigation und Briefkopf">
              <Input id="k-kurz" value={p.kurzname} onChange={(e) => set("kurzname", e.target.value)} />
            </Field>
            <Field label="Stadt" htmlFor="k-stadt">
              <Input id="k-stadt" value={p.stadt} onChange={(e) => set("stadt", e.target.value)} />
            </Field>
            <Field label="Anschrift" htmlFor="k-adresse" className="md:col-span-2">
              <Input id="k-adresse" value={p.adresse} onChange={(e) => set("adresse", e.target.value)} autoComplete="street-address" />
            </Field>
            <Field
              label="Bundesland (Kanzleisitz)"
              htmlFor="k-land"
              className="md:col-span-2"
              hint={
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink" />
                  Voreinstellung für den Fristenrechner – maßgeblich sind die Feiertage am Ort des Gerichts (§ 222 Abs. 2 ZPO).
                </span>
              }
            >
              <Select id="k-land" value={p.bundesland} onChange={(e) => set("bundesland", e.target.value as Bundesland)} aria-describedby={abweichend ? "k-land-vorschlag" : undefined}>
                {BUNDESLAENDER.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </Select>
              {abweichend && ausStadt && (
                <div id="k-land-vorschlag" role="status" className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-amber-soft px-3 py-2 text-[13px] text-fg-2">
                  <Info className="size-4 shrink-0 text-amber" />
                  <span className="min-w-0 flex-1">
                    {p.stadt.trim()} liegt in {bundeslandName(ausStadt)}, gewählt ist {bundeslandName(p.bundesland)}.
                  </span>
                  {darf && (
                    <Button size="sm" onClick={() => set("bundesland", ausStadt)}>
                      {bundeslandName(ausStadt)} übernehmen
                    </Button>
                  )}
                </div>
              )}
            </Field>
          </div>

          <div>
            <div className="label">Schwerpunkte</div>
            <div className="flex flex-wrap gap-1.5">
              {SACHGEBIETE.map((sg) => {
                const an = p.schwerpunkte.includes(sg);
                return (
                  <motion.button
                    key={sg}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    aria-pressed={an}
                    disabled={!darf}
                    onClick={() => toggle(sg)}
                    className={cn("chip !h-8 !px-3 !text-[13px] transition-colors", an ? "chip-ink" : "chip-outline hover:bg-[var(--ink-softer)]")}
                  >
                    {an && <Check className="size-3" strokeWidth={3} />}
                    {sg}
                  </motion.button>
                );
              })}
            </div>
          </div>

          </fieldset>
          {fehler && (
            <div role="alert" className="rounded-md bg-seal-soft px-3.5 py-2.5 text-[13px] text-seal">
              {fehler}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span className="flex min-w-0 flex-1 basis-[220px] items-center gap-1.5 text-[13px] text-fg-3">
              <Info className="size-3.5 shrink-0" />
              {darf ? "Änderungen gelten sofort für Seitenleiste, Briefkopf, Rechnungen und Schriftsätze." : "Das Kanzleiprofil ändern Partner und Administration Ihrer Kanzlei."}
            </span>
            {darf && (
              <div className="flex gap-2">
                {geaendert && (
                  <Button variant="ghost" onClick={() => setP(gespeichert)}>
                    Verwerfen
                  </Button>
                )}
                <Button type="submit" variant="primary" disabled={!geaendert} loading={laedt}>
                  Änderungen speichern
                </Button>
              </div>
            )}
          </div>
        </form>
      </Abschnitt>
      <RechnungsangabenAbschnitt />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="sheet rounded-lg p-5">
          <div className="eyebrow mb-3">Vorschau Briefkopf</div>
          <div className="paper p-5">
            <div className="flex items-start justify-between gap-3">
              {/* Wie der echte Briefkopf der Rechnung: voller Name und alle Schwerpunkte – umbrechen statt kürzen (I5-T16-01) */}
              <div className="min-w-0">
                <div className="text-[15px] font-semibold leading-snug tracking-[-0.01em] [overflow-wrap:anywhere]">{p.name || "Name der Kanzlei"}</div>
                <div className="mt-0.5 text-[12px] leading-snug opacity-70 [overflow-wrap:anywhere]">{p.schwerpunkte.join(" · ") || "Schwerpunkte"}</div>
              </div>
              <span className="size-6 shrink-0 rounded-sm" style={{ background: tenant.farbe }} aria-hidden />
            </div>
            <div className="my-3 h-px bg-current opacity-[0.12]" />
            <div className="text-[12px] leading-relaxed opacity-70">{p.adresse || "Anschrift"}</div>
            <div className="mt-4 space-y-1.5" aria-hidden>
              <div className="h-1.5 w-3/4 rounded-full bg-current opacity-[0.12]" />
              <div className="h-1.5 w-full rounded-full bg-current opacity-[0.12]" />
              <div className="h-1.5 w-5/6 rounded-full bg-current opacity-[0.12]" />
            </div>
          </div>
        </div>
        <div className="sheet rounded-lg p-5 text-[13px]">
          <div className="eyebrow mb-3">Stammdaten</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-fg-3">Kunde seit</dt>
            <dd className="num text-right font-medium">{fmtDate(tenant.createdAt.slice(0, 10))}</dd>
            <dt className="text-fg-3">Lizenz</dt>
            <dd className="truncate text-right font-medium">{tenant.status === "test" ? "Testzugang" : "Lifetime-Lizenz"}</dd>
            <dt className="text-fg-3">Arbeitsplätze</dt>
            <dd className="num text-right font-medium">{tenant.lizenz.arbeitsplaetze}</dd>
            <dt className="text-fg-3">Kanzleifarbe</dt>
            <dd className="flex items-center justify-end gap-2" title={`Farbwert ${tenant.farbe}`}>
              <span className="size-3.5 rounded-full ring-1 ring-[var(--line)]" style={{ background: tenant.farbe }} />
              <span className="text-[13px] text-fg-3">im Briefkopf</span>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

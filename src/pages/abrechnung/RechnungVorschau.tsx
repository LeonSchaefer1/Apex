// Rechnungsvorschau als Papier mit Kanzlei-Briefkopf – inkl. Stellen, Storno und Zahlungserfassung.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, BadgeCheck, Banknote, FileCode2, FilePenLine, Info, Plus, Receipt, Send, ShieldCheck, Trash2, Undo2, X } from "lucide-react";
import { Button, Drawer, Field, Input, Segmented, confirmDialog } from "@/components/ui";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { fmtDate, fmtEUR, fmtNum, round2, today } from "@/core/dates";
import { fassungFuerAuftrag } from "@/core/rvg";
import type { Aktivitaet, Akte, Kontakt, Rechnung, RechnungsPosition, Tenant, User, Zeiteintrag } from "@/core/types";
import { cn } from "@/lib/cn";
import { aktiveZahlungen, aktualisierePositionen, belegArt, erfasseZahlung, korrigiereRechnung, loescheEntwurf, nimmZahlungZurueck, sendeZahlungserinnerungen, setzeFormat, stelleRechnung, storniereRechnung } from "./aktionen";
import { ERECHNUNG_PFLICHT, FASSUNG_LABEL, fmtDauer, fmtSatz, istEntwurfsKennung, istOffen, korrekturText, leistungszeitraum, offenerBetrag, parseBetrag, RSV_VORSTEUER_HINWEIS, rsvBlockText, satzAusPosition } from "./lib";
import { Anschrift, Betrag, Briefkopf, FORMAT_INFO, FormatChip, InfoZeile, StatusChip, useLookups } from "./ui";
import { xrechnungXml, zugferdXml } from "./erechnung";
import { DateiDialog, type AusgabeDatei } from "@/pages/fristen/dateiAusgabe";
import { useAbrechnungUI } from "./store";

const FORMATE: Rechnung["format"][] = ["PDF", "XRechnung", "ZUGFeRD"];

function vvAnzeige(vv: string) {
  if (vv === "Std") return "Zeit";
  if (vv.startsWith("Vorb.")) return "Vorb. 3 IV";
  if (vv.startsWith("Anm.")) return vv; // „Anm. 3305“: Anrechnung der Mahnverfahrensgebühr
  return vv;
}

/** Steuernummer bzw. USt-IdNr. der Kanzlei (§ 14 Abs. 4 S. 1 Nr. 2 UStG) – bis zur Pflege im Kanzleiprofil als Platzhalter. */
function steuerAngabe(t: Tenant): { label: string; wert: string; platzhalter: boolean } {
  if (t.ustIdNr) return { label: "USt-IdNr.", wert: t.ustIdNr, platzhalter: false };
  if (t.steuernummer) return { label: "Steuernummer", wert: t.steuernummer, platzhalter: false };
  return { label: "USt-IdNr.", wert: "DE000000000", platzhalter: true };
}

function PositionZeile({ p }: { p: RechnungsPosition }) {
  const std = p.vv === "Std";
  const satz = std ? `${fmtSatz(p.menge ?? 0)} Std.` : p.satz !== undefined ? fmtSatz(p.satz) : "";
  const wert = std ? (p.menge ? `à ${fmtEUR(p.betrag / p.menge)}` : "") : p.gegenstandswert ? fmtEUR(p.gegenstandswert) : "";
  return (
    <tr className="border-b border-black/[0.07] align-top">
      <td className="mono py-2 pr-2 text-[12.5px] opacity-70">{vvAnzeige(p.vv)}</td>
      <td className="py-2 pr-3">{p.bezeichnung}</td>
      <td className="num whitespace-nowrap py-2 pr-3 text-right">{satz}</td>
      <td className="num hidden whitespace-nowrap py-2 pr-3 text-right opacity-70 sm:table-cell">{wert}</td>
      <td className={cn("num whitespace-nowrap py-2 text-right font-medium", p.betrag < 0 && "opacity-75")}>{fmtEUR(p.betrag)}</td>
    </tr>
  );
}

const istBerufstraeger = (u?: User) => !!u && (u.rolle === "partner" || u.rolle === "anwalt");

/**
 * Unterzeichner bzw. „Bearbeitung“: wer die Rechnung gestellt hat (Protokoll), bei Entwürfen die abrechnende angemeldete
 * Person – jeweils nur Berufsträger; sonst die Bearbeiterin bzw. der Bearbeiter der Akte.
 */
export function unterzeichnerVon(r: Rechnung, aktivitaeten: Aktivitaet[], users: Map<string, User>, angemeldet: User, bearbeiter?: User): User | undefined {
  const gestelltVon = r.status !== "entwurf"
    ? aktivitaeten
        .filter((a) => a.akteur === "nutzer" && a.userId && a.akteId === r.akteId && a.text.includes(`${r.nummer} gestellt`))
        .sort((a, b) => b.zeit.localeCompare(a.zeit))
        .map((a) => users.get(a.userId!))
        .find(istBerufstraeger)
    : undefined;
  if (gestelltVon) return gestelltVon;
  if (r.status === "entwurf" && istBerufstraeger(angemeldet)) return angemeldet;
  const erstelltVon = aktivitaeten
    .filter((a) => a.akteur === "nutzer" && a.userId && a.akteId === r.akteId && a.text.includes(`(${r.nummer})`))
    .sort((a, b) => b.zeit.localeCompare(a.zeit))
    .map((a) => users.get(a.userId!))
    .find(istBerufstraeger);
  return erstelltVon ?? bearbeiter;
}

/** Anlage „Tätigkeitsnachweis“ einer Zeitrechnung: je Eintrag Datum, Person, Tätigkeit, Dauer, Betrag. */
function Taetigkeitsnachweis({ r, zeiten, users }: { r: Rechnung; zeiten: Zeiteintrag[]; users: Map<string, User> }) {
  const eintraege = zeiten.filter((z) => r.zeitIds?.includes(z.id)).sort((a, b) => a.datum.localeCompare(b.datum));
  if (!eintraege.length) return null;
  const stdPos = r.positionen.filter((p) => p.vv === "Std");
  const satzFuer = (userId: string) => {
    const name = users.get(userId)?.name ?? "";
    const p = stdPos.find((x) => name && x.bezeichnung.includes(name)) ?? stdPos[0];
    return p ? satzAusPosition(p) : 0;
  };
  const zeilen = eintraege.map((z) => ({ z, betrag: round2((z.minuten / 60) * satzFuer(z.userId)) }));
  const summe = round2(zeilen.reduce((s, x) => s + x.betrag, 0));
  const minuten = eintraege.reduce((s, z) => s + z.minuten, 0);
  return (
    <section className="mt-8 border-t border-black/15 pt-5" aria-label="Anlage Tätigkeitsnachweis">
      <div className="text-[14px] font-semibold">Anlage: Tätigkeitsnachweis</div>
      <div className="mt-0.5 text-[12.5px] opacity-65">Einzelaufstellung der abgerechneten Zeiten (netto)</div>
      <table className="mt-3 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-black/15 text-left text-[12.5px] uppercase tracking-[0.06em] opacity-60">
            <th className="py-1.5 pr-2 font-semibold">Datum</th>
            <th className="py-1.5 pr-2 font-semibold">Person</th>
            <th className="py-1.5 pr-2 font-semibold">Tätigkeit</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Dauer</th>
            <th className="py-1.5 text-right font-semibold">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map(({ z, betrag }) => (
            <tr key={z.id} className="border-b border-black/[0.07] align-top">
              <td className="num whitespace-nowrap py-1.5 pr-2">{fmtDate(z.datum)}</td>
              <td className="py-1.5 pr-2">{users.get(z.userId)?.name ?? "–"}</td>
              <td className="py-1.5 pr-2">{z.taetigkeit}</td>
              <td className="num whitespace-nowrap py-1.5 pr-2 text-right">{fmtDauer(z.minuten)}</td>
              <td className="num whitespace-nowrap py-1.5 text-right">{fmtEUR(betrag)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-1.5 pr-2" colSpan={3}>
              Summe
            </td>
            <td className="num whitespace-nowrap py-1.5 pr-2 text-right">{fmtDauer(minuten)}</td>
            <td className="num whitespace-nowrap py-1.5 text-right">{fmtEUR(summe)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

/**
 * Die Rechnung auf Papier – Aufbau nach DIN 5008 mit den Angaben nach § 10 Abs. 2 RVG (Gebührentatbestände, Nr. VV,
 * Gegenstandswert, Beträge) und § 14 Abs. 4 UStG (Steuernummer/USt-IdNr., fortlaufende Nummer, Leistungszeitraum).
 * Seit dem 17.07.2024 genügt für die Berechnung die Textform (§ 10 Abs. 1 RVG) – eine Unterschrift ist nicht mehr nötig;
 * die Berechnung nennt den verantwortlichen Rechtsanwalt.
 */
export function RechnungPapier({
  r, akte, empfaenger, tenant, bearbeiter, zeiten = [], users, korrekturNummer,
}: {
  r: Rechnung;
  /** Nummer der stornierten Ursprungsrechnung („Korrektur zu RE-…“) */
  korrekturNummer?: string;
  akte?: Akte;
  empfaenger?: Kontakt;
  tenant: Tenant;
  /** Unterzeichner bzw. „Bearbeitung“ (siehe `unterzeichnerVon`) */
  bearbeiter?: User;
  zeiten?: Zeiteintrag[];
  users?: Map<string, User>;
}) {
  const [von, bis] = leistungszeitraum(akte, r);
  const rvg = r.positionen.some((p) => /^\d{4}$/.test(p.vv) && p.vv !== "7002");
  const fassung = akte ? fassungFuerAuftrag(akte.createdAt.slice(0, 10)) : "2025";
  const wert = r.positionen.find((p) => p.gegenstandswert)?.gegenstandswert ?? akte?.gegenstandswert;
  const entwurf = r.status === "entwurf" || istEntwurfsKennung(r.nummer);
  const vorschuss = r.art === "vorschuss";
  const steuer = steuerAngabe(tenant);
  return (
    <div className="paper relative overflow-hidden px-5 py-6 sm:px-10 sm:py-9">
      {r.status === "entwurf" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-[24deg] text-[86px] font-black tracking-[0.12em] opacity-[0.05] sm:text-[120px]">ENTWURF</span>
        </div>
      )}
      <Briefkopf tenant={tenant} />

      <div className="mt-2 grid gap-6 sm:grid-cols-[1fr_260px]">
        <Anschrift k={empfaenger} />
        <div className="sm:pt-1">
          <InfoZeile k="Rechnungsnummer" v={entwurf ? <span className="font-normal opacity-60">folgt beim Stellen</span> : r.nummer} mono={!entwurf} />
          <InfoZeile k="Rechnungsdatum" v={entwurf ? <span className="font-normal opacity-60">Datum der Stellung</span> : fmtDate(r.datum)} />
          <InfoZeile k="Leistungszeitraum" v={`${fmtDate(von)} – ${fmtDate(bis)}`} />
          {akte && <InfoZeile k="Unser Zeichen" v={akte.aktenzeichen} mono />}
          {bearbeiter && <InfoZeile k="Bearbeitung" v={bearbeiter.name} />}
        </div>
      </div>

      <div className="relative mt-8">
        {(r.status === "storniert" || r.status === "bezahlt") && (
          <motion.div
            initial={{ scale: 1.6, opacity: 0, rotate: -14 }}
            animate={{ scale: 1, opacity: 1, rotate: -9 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className={cn(
              "pointer-events-none absolute -top-1 right-0 rounded-[8px] border-[2.5px] border-current px-3 py-1 text-center font-black uppercase tracking-[0.14em]",
              r.status === "storniert" ? "text-seal" : "text-green",
            )}
          >
            <div className="text-[18px] leading-none">{r.status === "storniert" ? "Storniert" : "Bezahlt"}</div>
            {r.status === "bezahlt" && r.bezahltAm && <div className="mt-1 text-[12.5px] font-bold tracking-[0.1em]">am {fmtDate(r.bezahltAm)}</div>}
            {r.status === "storniert" && r.storniertAm && <div className="mt-1 text-[12.5px] font-bold tracking-[0.1em]">am {fmtDate(r.storniertAm)}</div>}
          </motion.div>
        )}
        <div className="text-[19px] font-semibold tracking-[-0.02em]">{belegArt(r)}</div>
        {r.korrekturVon && korrekturNummer && <div className="mt-0.5 text-[12.5px] font-medium">{korrekturText(korrekturNummer)} (storniert)</div>}
        {akte && (
          <div className={cn("mt-1 text-[12.5px] opacity-75", (r.status === "storniert" || r.status === "bezahlt") && "pr-32")}>
            In Sachen {akte.titel}
            {wert ? ` · Gegenstandswert ${fmtEUR(wert)}` : ""}
          </div>
        )}
      </div>

      <table className="mt-5 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-black/15 text-left text-[12.5px] uppercase tracking-[0.06em] opacity-60">
            <th className="py-2 pr-2 font-semibold">Nr. VV</th>
            <th className="py-2 pr-3 font-semibold">Gebührentatbestand</th>
            <th className="py-2 pr-3 text-right font-semibold">Satz</th>
            <th className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">Gegenstandswert</th>
            <th className="py-2 text-right font-semibold">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {r.positionen.map((p, i) => (
            <PositionZeile key={i} p={p} />
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 w-full max-w-[300px] text-[12.5px]">
        <div className="flex justify-between py-1">
          <span className="opacity-65">Summe netto</span>
          <span className="num">{fmtEUR(r.netto)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="opacity-65">19 % Umsatzsteuer (Nr. 7008 VV RVG)</span>
          <span className="num">{fmtEUR(r.ust)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-black/20 pt-2 text-[14px] font-semibold">
          <span>Gesamtbetrag</span>
          <span className="num">{fmtEUR(r.brutto)}</span>
        </div>
        {r.bezahlt > 0 && r.status !== "storniert" && (
          <>
            <div className="flex justify-between py-1 opacity-70">
              <span>bereits gezahlt</span>
              <span className="num">−{fmtEUR(r.bezahlt)}</span>
            </div>
            <div className="flex justify-between py-1 font-semibold">
              <span>noch offen</span>
              <span className="num">{fmtEUR(Math.max(0, r.brutto - r.bezahlt))}</span>
            </div>
          </>
        )}
      </div>

      {r.rsv && r.status !== "storniert" && (
        <div className="mt-5 rounded-[6px] border border-black/20 px-3.5 py-2.5 text-[12px] leading-relaxed">
          <div className="font-semibold">Rechtsschutz</div>
          <div>{rsvBlockText(r.rsv, fmtEUR)}</div>
          <div className="mt-1 opacity-70">
            Den Anteil der Versicherung fordern wir direkt bei {r.rsv.versicherung} an (Abrechnungsschreiben mit dieser Kostennote in Kopie). Vergütungsschuldner bleiben Sie. {RSV_VORSTEUER_HINWEIS}
          </div>
        </div>
      )}

      <div className="mt-7 space-y-2 text-[12px] leading-relaxed">
        {r.status === "storniert" && r.stornoNummer && (
          <p className="rounded-[6px] border border-black/15 px-3 py-2 text-[12.5px]">
            Diese {belegArt(r)} wurde{r.storniertAm ? ` am ${fmtDate(r.storniertAm)}` : ""} durch die Stornorechnung <span className="mono font-medium">{r.stornoNummer}</span> in voller Höhe
            storniert.{r.bezahlt > 0 && <> Bereits gezahlte {fmtEUR(r.bezahlt)} werden erstattet oder verrechnet.</>}
          </p>
        )}
        {vorschuss && (
          <p>
            Wir bitten um einen Vorschuss nach § 9 RVG auf die bereits entstandenen Gebühren und Auslagen. Die Vergütung wird erst mit dem Ende des Rechtszugs bzw. der
            Kostenentscheidung fällig (§ 8 Abs. 1 RVG); dann erhalten Sie die Schlussrechnung, in der dieser Vorschuss angerechnet wird.
          </p>
        )}
        {r.status !== "storniert" && r.rsv && (
          <p>
            {r.rsv.selbstbeteiligung > 0 ? (
              <>
                Bitte überweisen Sie Ihre Selbstbeteiligung von <strong>{fmtEUR(r.rsv.selbstbeteiligung)}</strong> bis zum <strong>{fmtDate(r.faellig)}</strong> unter Angabe der{" "}
                {entwurf ? "Rechnungsnummer (wird beim Stellen vergeben)." : <>Rechnungsnummer <span className="mono font-medium">{r.nummer}</span>.</>}
              </>
            ) : (
              <>Eine Zahlung Ihrerseits ist nicht erforderlich, sofern {r.rsv.versicherung} den Betrag wie zugesagt übernimmt.</>
            )}
          </p>
        )}
        {r.status !== "storniert" && !r.rsv && (
          <p>
            Bitte überweisen Sie den {vorschuss ? "Vorschuss" : "Gesamtbetrag"} bis zum <strong>{fmtDate(r.faellig)}</strong> ohne Abzug und geben Sie als Verwendungszweck{" "}
            {entwurf ? (
              "die Rechnungsnummer an (wird beim Stellen vergeben)."
            ) : (
              <>
                die Rechnungsnummer <span className="mono font-medium">{r.nummer}</span> an.
              </>
            )}
          </p>
        )}
        <div className="rounded-[6px] bg-black/[0.035] px-3 py-2 text-[12.5px]">
          <span className="font-medium">Bankverbindung</span> · Geschäftskonto {tenant.kurzname} · IBAN <span className="mono">DE00 0000 0000 0000 0000 00</span> · BIC{" "}
          <span className="mono">XXXXDEXXXXX</span> <span className="opacity-55">(Platzhalter)</span>
          <br />
          <span className="font-medium">{steuer.label}</span> <span className="mono">{steuer.wert}</span>
          {steuer.platzhalter && <span className="opacity-55"> (Platzhalter – im Kanzleiprofil hinterlegen)</span>}
        </div>
        {rvg && <p className="text-[12.5px] opacity-60">Abrechnung nach dem Rechtsanwaltsvergütungsgesetz, Gebührentabelle {FASSUNG_LABEL[fassung]} (§ 13 RVG, Übergangsrecht § 60 RVG).</p>}
      </div>

      {r.zeitIds?.length && users ? <Taetigkeitsnachweis r={r} zeiten={zeiten} users={users} /> : null}

      <div className="mt-6 text-[12px] leading-snug">
        <div className="opacity-65">Mit freundlichen Grüßen</div>
        <div className="mt-2 font-medium">{bearbeiter?.name ?? tenant.name}</div>
        <div className="text-[12.5px] opacity-60">{bearbeiter ? `${bearbeiter.titel.split(" · ")[0]} · ${tenant.name}` : "Rechtsanwälte"}</div>
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-black/10 pt-3 text-[12.5px] opacity-65">
        <FileCode2 className="size-3.5 shrink-0" />
        {r.format === "PDF" ? "Als PDF – E-Rechnung (XRechnung, ZUGFeRD) nach EN 16931 ebenfalls abrufbar." : `Diese Rechnung wird als ${r.format} (EN 16931) übermittelt; diese Ansicht dient der Lesbarkeit.`}
      </div>
    </div>
  );
}

export function RechnungVorschau({ id, onClose }: { id: string | null; onClose: () => void }) {
  const rechnungen = useCol("rechnungen");
  const zeitenAlle = useCol("zeiten");
  const aktivitaeten = useCol("aktivitaeten");
  const { tenant, user } = useKanzlei();
  const { akten, kontakte, users } = useLookups();
  const aktuell = id ? rechnungen.find((x) => x.id === id) : undefined;
  const letzte = useRef<Rechnung | undefined>(undefined);
  if (aktuell) letzte.current = aktuell;
  const r = aktuell ?? letzte.current;
  const [zahlung, setZahlung] = useState(false);
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState(today());
  const [datei, setDatei] = useState<AusgabeDatei | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const buchungen = useCol("buchungen");

  useEffect(() => {
    setZahlung(false);
    setDatum(today());
    setBearbeiten(false);
  }, [id]);
  useEffect(() => {
    if (aktuell) setBetrag(fmtNum(offenerBetrag(aktuell), 2));
  }, [aktuell?.id, aktuell?.bezahlt]); // eslint-disable-line react-hooks/exhaustive-deps

  const akte = r ? akten.get(r.akteId) : undefined;
  const empfaenger = r ? kontakte.get(r.empfaengerId) : undefined;
  const akteBearbeiter = akte ? users.get(akte.bearbeiterId) : undefined;
  const bearbeiter = useMemo(() => (r ? unterzeichnerVon(r, aktivitaeten, users, user, akteBearbeiter) : akteBearbeiter), [r, aktivitaeten, users, user, akteBearbeiter]);
  const korrekturNummer = r?.korrekturVon ? rechnungen.find((x) => x.id === r.korrekturVon)?.nummer : undefined;
  const korrekturEntwurf = r ? rechnungen.find((x) => x.korrekturVon === r.id && x.status !== "storniert") : undefined;
  const zahlungen = useMemo(() => (r ? aktiveZahlungen(r, buchungen) : []), [r, buchungen]);

  /** XRechnung bzw. ZUGFeRD einer Rechnung abrufen – Vorschau mit „Datei speichern“ und Kopieren. */
  const formatAbrufen = (f: "XRechnung" | "ZUGFeRD") => {
    if (!r) return;
    const ktx = { akte, empfaenger, tenant, hinweise: r.rsv ? [rsvBlockText(r.rsv, fmtEUR)] : [] };
    const nr = r.nummer.replace(/[^A-Za-z0-9-]+/g, "_");
    setDatei(
      f === "XRechnung"
        ? { name: `${nr}_XRechnung.xml`, mime: "application/xml", inhalt: xrechnungXml(r, ktx), beschreibung: "XRechnung 3.0 (UBL 2.1, EN 16931)" }
        : { name: `${nr}_factur-x.xml`, mime: "application/xml", inhalt: zugferdXml(r, ktx), beschreibung: "ZUGFeRD/Factur-X (CII, EN 16931) – wird in die PDF/A-3 eingebettet" },
    );
  };

  const korrigieren = async () => {
    if (!r) return;
    const art = belegArt(r);
    const ok = await confirmDialog({
      titel: `${art} ${r.nummer} korrigieren?`,
      text: `${r.status === "storniert" ? "" : `Die ${art} wird storniert (Stornorechnung mit eigener, fortlaufender Nummer, Gegenbuchung im Aktenkonto). `}Danach entsteht ein vorbefüllter Entwurf „${korrekturText(r.nummer)}“, den Sie anpassen und neu stellen.${r.bezahlt > 0 ? ` Bereits gezahlte ${fmtEUR(r.bezahlt)} bleiben als Guthaben im Aktenkonto.` : ""}`,
      bestaetigen: r.status === "storniert" ? "Korrekturentwurf anlegen" : "Stornieren und korrigieren",
      gefahr: r.status !== "storniert",
    });
    if (!ok) return;
    const { storno, entwurf } = korrigiereRechnung(r, user.id);
    toast("Korrekturentwurf angelegt", { text: `${korrekturText(r.nummer)}${storno.stornoNummer ? ` · Stornorechnung ${storno.stornoNummer}` : ""}`, ton: "erfolg" });
    useAbrechnungUI.getState().oeffneRechnung(entwurf.id);
  };

  const zahlungZuruecknehmen = async () => {
    if (!r || !zahlungen.length) return;
    const summe = round2(zahlungen.reduce((s2, b) => s2 - b.betrag, 0));
    const ok = await confirmDialog({
      titel: `Zahlung zu ${r.nummer} zurücknehmen?`,
      text: `${fmtEUR(summe)} werden im Aktenkonto gegengebucht (Storno), die Rechnung ist wieder offen${zahlungen.some((b) => b.transaktionId) ? " und der Bankumsatz erscheint wieder im Bankabgleich" : ""}. Der Vorgang wird protokolliert.`,
      bestaetigen: "Zahlung zurücknehmen",
      gefahr: true,
    });
    if (!ok) return;
    const erg = nimmZahlungZurueck(r, { userId: user.id });
    toast("Zahlung zurückgenommen", { text: `${fmtEUR(erg.betrag)} gegengebucht · ${r.nummer} wieder offen`, ton: "erfolg" });
  };

  const stornieren = async () => {
    if (!r) return;
    const art = belegArt(r);
    const gezahlt = r.bezahlt > 0;
    const ok = await confirmDialog({
      titel: `${art} ${r.nummer} stornieren?`,
      text: [
        `Es wird eine Stornorechnung mit eigener, fortlaufender Nummer erzeugt und im Aktenkonto gegengebucht; die ${art} bleibt mit ihrer Nummer erhalten.`,
        gezahlt
          ? `Achtung: Auf diese ${art} sind bereits ${fmtEUR(r.bezahlt)} eingegangen. Der Betrag steht nach dem Storno als Guthaben der Mandantschaft im Aktenkonto und muss erstattet oder mit einer neuen Rechnung verrechnet werden.`
          : "",
        r.zeitIds?.length ? "Die abgerechneten Zeiten werden wieder abrechenbar." : "",
      ]
        .filter(Boolean)
        .join(" "),
      bestaetigen: gezahlt ? "Trotzdem stornieren" : "Stornieren",
      gefahr: true,
    });
    if (!ok) return;
    const erg = storniereRechnung(r, user.id);
    useData.getState().log({
      akteur: "nutzer",
      userId: user.id,
      akteId: r.akteId,
      text: `${art} ${r.nummer} storniert (Stornorechnung ${erg.stornoNummer ?? "–"})${erg.guthaben > 0 ? `, Guthaben ${fmtEUR(erg.guthaben)} – Erstattung oder Verrechnung offen` : ""} – ${akte?.aktenzeichen ?? ""}`.trim(),
    });
    toast(erg.guthaben > 0 ? "Storniert – Guthaben offen" : "Rechnung storniert", {
      text: `Stornorechnung ${erg.stornoNummer ?? ""} · Gegenbuchung über ${fmtEUR(r.brutto)}${erg.guthaben > 0 ? ` · ${fmtEUR(erg.guthaben)} Guthaben der Mandantschaft erstatten oder verrechnen` : ""}${erg.zeitenFrei ? ` · ${erg.zeitenFrei} ${erg.zeitenFrei === 1 ? "Zeit" : "Zeiten"} wieder abrechenbar` : ""}`,
      ton: erg.guthaben > 0 ? "warnung" : "erfolg",
    });
  };

  const entwurfLoeschen = async () => {
    if (!r) return;
    const zeiten = r.zeitIds?.length ?? 0;
    const ok = await confirmDialog({
      titel: "Entwurf löschen?",
      text: `Der Rechnungsentwurf wird endgültig entfernt. Eine Rechnungsnummer ist noch nicht vergeben.${zeiten ? " Die abgerechneten Zeiten werden wieder abrechenbar." : ""}`,
      bestaetigen: "Löschen",
      gefahr: true,
    });
    if (!ok) return;
    const frei = loescheEntwurf(r);
    onClose();
    toast("Entwurf gelöscht", { text: frei ? `${frei} ${frei === 1 ? "Zeit ist" : "Zeiten sind"} wieder abrechenbar` : undefined, ton: "info" });
  };

  const stellen = () => {
    if (!r) return;
    const g = stelleRechnung(r, user.id);
    const art = belegArt(g);
    useData.getState().log({ akteur: "nutzer", userId: user.id, akteId: r.akteId, text: `${art} ${g.nummer} gestellt – ${akte?.aktenzeichen ?? ""}`.trim() });
    toast(`${art} gestellt`, { text: `${g.nummer} · zahlbar in 14 Tagen · im Aktenkonto gebucht`, ton: "erfolg" });
  };

  const buchen = (modus?: "guthaben" | "nurOffen") => {
    if (!r) return;
    const b = parseBetrag(betrag);
    if (b <= 0) {
      toast("Bitte einen Betrag eingeben", { text: "Zum Beispiel 250,00", ton: "warnung" });
      return;
    }
    const erg = erfasseZahlung(r, b, datum || today(), { ueberzahlung: modus ?? "guthaben" });
    setZahlung(false);
    toast(erg.status === "bezahlt" ? "Rechnung vollständig bezahlt" : "Teilzahlung erfasst", {
      text: `${fmtEUR(erg.verrechnet)} auf ${r.nummer} verrechnet${erg.guthaben > 0 ? ` · ${fmtEUR(erg.guthaben)} als Guthaben der Mandantschaft im Aktenkonto (erstatten oder verrechnen)` : ""}`,
      ton: erg.guthaben > 0 ? "warnung" : "erfolg",
    });
  };
  const eingabe = parseBetrag(betrag);
  const offenJetzt = r ? offenerBetrag(r) : 0;
  const mehrbetrag = round2(eingabe - offenJetzt);
  const ueberzahlt = !!r && istOffen(r) && mehrbetrag > 0.004;

  const erinnern = () => {
    if (!r) return;
    sendeZahlungserinnerungen([r], user.id);
    toast("Zahlungserinnerung versendet", { text: `${r.nummer} an ${empfaenger?.name ?? "Empfänger"}`, ton: "erfolg" });
  };

  const footer = r ? (
    r.status === "entwurf" ? (
      <>
        <Button variant="ghost" className="mr-auto !text-seal" icon={<Trash2 className="size-4" />} onClick={entwurfLoeschen}>
          Entwurf löschen
        </Button>
        <Button variant="primary" icon={<Send className="size-4" />} onClick={stellen}>
          Rechnung stellen
        </Button>
      </>
    ) : r.status === "storniert" ? (
      <>
        <Button variant="ghost" onClick={onClose} className="mr-auto">
          Schließen
        </Button>
        {korrekturEntwurf ? (
          <Button variant="secondary" onClick={() => useAbrechnungUI.getState().oeffneRechnung(korrekturEntwurf.id)}>
            Korrekturentwurf öffnen
          </Button>
        ) : (
          <Button variant="secondary" icon={<FilePenLine className="size-4" />} onClick={korrigieren}>
            Korrekturentwurf anlegen
          </Button>
        )}
      </>
    ) : (
      <>
        <Button variant="ghost" className="!text-seal" icon={<Ban className="size-4" />} onClick={stornieren}>
          Stornieren
        </Button>
        <Button variant="ghost" className="mr-auto" icon={<FilePenLine className="size-4" />} onClick={korrigieren}>
          Korrigieren
        </Button>
        {zahlungen.length > 0 && (
          <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={zahlungZuruecknehmen}>
            Zahlung zurücknehmen
          </Button>
        )}
        {istOffen(r) && (
          <>
            <Button variant="secondary" icon={<Send className="size-4" />} onClick={erinnern} className="hidden sm:inline-flex">
              Zahlungserinnerung
            </Button>
            <Button variant="primary" icon={<Banknote className="size-4" />} onClick={() => setZahlung((z) => !z)}>
              Zahlung erfassen
            </Button>
          </>
        )}
      </>
    )
  ) : null;

  return (
    <Drawer
      open={!!aktuell}
      onClose={onClose}
      width={800}
      icon={<Receipt className="size-[18px]" />}
      title={<span className="mono">{r?.nummer}</span>}
      subtitle={akte ? `${akte.aktenzeichen} · ${akte.titel}` : undefined}
      footer={footer}
    >
      {r && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusChip r={r} />
            <FormatChip format={r.format} />
            <span className="text-[12.5px] text-fg-3">
              fällig {fmtDate(r.faellig)}
              {istOffen(r) && (
                <>
                  {" "}
                  · offen <Betrag n={offenerBetrag(r)} className="font-semibold text-fg" />
                </>
              )}
            </span>
          </div>

          {r.status === "entwurf" ? (
            <div className="mb-4 rounded-[18px] bg-ink-softer p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-fg-2">Format</span>
                <Segmented size="sm" value={r.format} onChange={(f) => setzeFormat(r, f)} options={FORMATE.map((f) => ({ value: f, label: f }))} />
                <span className="min-w-0 flex-1 basis-[220px] text-[12.5px] text-fg-3">
                  {FORMAT_INFO[r.format].text}
                  {empfaenger?.typ === "organisation" && r.format === "PDF" ? " Empfänger ist eine Organisation – E-Rechnung empfohlen." : ""}
                </span>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-fg-3">
                <Info className="mt-0.5 size-3.5 shrink-0" /> {ERECHNUNG_PFLICHT}
              </p>
              <div className="mt-2.5">
                <Button size="sm" variant={bearbeiten ? "primary" : "secondary"} icon={<FilePenLine className="size-4" />} onClick={() => setBearbeiten((b) => !b)}>
                  {bearbeiten ? "Bearbeitung beenden" : "Positionen bearbeiten"}
                </Button>
              </div>
              {bearbeiten && <PositionenEditor r={r} />}
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
              <span className="font-semibold text-fg-2">Formate abrufen</span>
              <Button size="sm" variant="secondary" icon={<FileCode2 className="size-4" />} onClick={() => formatAbrufen("XRechnung")}>
                XRechnung (XML)
              </Button>
              <Button size="sm" variant="secondary" icon={<FileCode2 className="size-4" />} onClick={() => formatAbrufen("ZUGFeRD")}>
                ZUGFeRD (XML)
              </Button>
              <span>PDF liegt in der E-Akte (Ordner „Rechnungen“).</span>
            </div>
          )}
          {r.rsv && r.status !== "storniert" && (
            <p className="mb-4 flex items-start gap-2 rounded-[14px] bg-ink-softer px-3.5 py-2.5 text-[12.5px] text-fg-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" />
              <span>
                Rechnung an {empfaenger?.name ?? "den Mandanten"} (Leistungsempfänger, § 14 UStG). {rsvBlockText(r.rsv, fmtEUR)}.{" "}
                {r.status === "entwurf" ? `Beim Stellen entsteht in der E-Akte das ${r.art === "vorschuss" ? "Schreiben „Zahlungsaufforderung" : "„Abrechnungsschreiben"} an ${r.rsv.versicherung}“.` : `Das Schreiben an ${r.rsv.versicherung} liegt in der E-Akte (Korrespondenz).`}
              </span>
            </p>
          )}

          <AnimatePresence initial={false}>
            {zahlung && istOffen(r) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className="overflow-hidden"
              >
                <div className="mb-4 rounded-[18px] bg-ink-softer p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                    <BadgeCheck className="size-4 text-ink" /> Zahlung erfassen
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Betrag (€)" htmlFor="zahlung-betrag">
                      <Input id="zahlung-betrag" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} className="num" />
                    </Field>
                    <Field label="Zahlungsdatum" htmlFor="zahlung-datum">
                      <Input id="zahlung-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
                    </Field>
                    <Button variant="primary" onClick={() => buchen()} disabled={ueberzahlt}>
                      Zahlung buchen
                    </Button>
                  </div>
                  {ueberzahlt ? (
                    <div className="mt-3 rounded-[14px] bg-amber-soft px-3.5 py-3 text-[12.5px] text-fg-2" role="alert">
                      <div className="font-semibold text-amber">Überzahlung: {fmtEUR(mehrbetrag)} mehr als offen</div>
                      <p className="mt-0.5">Offen sind nur {fmtEUR(offenJetzt)}. Wie soll der Betrag gebucht werden?</p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => buchen("nurOffen")}>
                          Nur {fmtEUR(offenJetzt)} buchen
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => buchen("guthaben")}>
                          {fmtEUR(eingabe)} buchen – {fmtEUR(mehrbetrag)} als Guthaben
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-fg-3">Ein geringerer Betrag wird als Teilzahlung gebucht; die Rechnung bleibt dann offen.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <RechnungPapier r={r} akte={akte} empfaenger={empfaenger} tenant={tenant} bearbeiter={bearbeiter} zeiten={zeitenAlle} users={users} korrekturNummer={korrekturNummer} />
        </>
      )}
      <DateiDialog datei={datei} onClose={() => setDatei(null)} />
    </Drawer>
  );
}

/** Positionen eines Entwurfs anpassen (z. B. bei einer Korrektur) – Summen und RSV-Aufteilung rechnen neu. */
function PositionenEditor({ r }: { r: Rechnung }) {
  const [zeilen, setZeilen] = useState(() => r.positionen.map((p) => ({ ...p, betragText: fmtNum(p.betrag, 2) })));
  useEffect(() => setZeilen(r.positionen.map((p) => ({ ...p, betragText: fmtNum(p.betrag, 2) }))), [r.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const uebernehmen = (neu: typeof zeilen) => {
    setZeilen(neu);
    aktualisierePositionen(
      r,
      neu.map(({ betragText, ...p }) => ({ ...p, betrag: round2(parseBetrag(betragText)) })),
    );
  };
  return (
    <div className="mt-3 grid gap-2">
      {zeilen.map((z, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
          <Field label={i === 0 ? "Position" : ""} htmlFor={`pos-text-${i}`}>
            <Input id={`pos-text-${i}`} aria-label={`Position ${i + 1}`} value={z.bezeichnung} onChange={(e) => uebernehmen(zeilen.map((x, j) => (j === i ? { ...x, bezeichnung: e.target.value } : x)))} />
          </Field>
          <Field label={i === 0 ? "Betrag (€)" : ""} htmlFor={`pos-betrag-${i}`}>
            <Input id={`pos-betrag-${i}`} aria-label={`Betrag Position ${i + 1}`} inputMode="decimal" className="num text-right" value={z.betragText} onChange={(e) => uebernehmen(zeilen.map((x, j) => (j === i ? { ...x, betragText: e.target.value } : x)))} />
          </Field>
          <button type="button" className="icon-btn mb-1" aria-label={`Position ${i + 1} entfernen`} title="Position entfernen" onClick={() => uebernehmen(zeilen.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => uebernehmen([...zeilen, { vv: "", bezeichnung: "Weitere Position", betrag: 0, betragText: "0,00" }])}>
          Position hinzufügen
        </Button>
      </div>
    </div>
  );
}

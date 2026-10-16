import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { AlarmClock, AlertTriangle, Archive, CalendarClock, Check, FolderOpen, FolderPlus, Flag, Plus, Send, Sparkle, UserRound, UserRoundCog, ListChecks, X } from "lucide-react";
import type { Akte, Frist } from "@/core/types";
import { addDays, fmtDate, fmtDateShort, fmtEUR, nowLocal, relTime, today } from "@/core/dates";
import { search } from "@/core/search";
import { aktenMitFrist } from "@/core/fristenLage";
import { useCol, useData } from "@/store/data";
import { useKanzlei } from "@/store/session";
import { toast } from "@/store/ui";
import { AnimatedNumber, Avatar, Button, Chip, DataTable, Empty, Modal, PageHeader, SearchField, Segmented, Select, type ColumnDef } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { cn } from "@/lib/cn";
import {
  FRIST_TYP_LABEL, FristChip, PhasenBalken, SACHGEBIETE, STATUS_INFO, SachgebietChip, azSortKey, listenKontext,
  useKontaktMap, useNaechsteFristen, useTeam,
} from "./helfer";
import { Mandatsaufnahme } from "./Mandatsaufnahme";
import { offeneEintraege, offeneEintraegeText, schliesseAkteAb } from "./AkteKopf";

type StatusFilter = "offen" | "ruhend" | "abgeschlossen" | "alle";

interface Filter {
  status: StatusFilter;
  sg: string;
  ra: string;
  prio: string;
  frist: string;
  seit: string;
}

interface Ansicht {
  key: string;
  label: string;
  hinweis: string;
  icon: React.ReactNode;
  filter: Filter;
}

/** Akten – alle Mandate der Kanzlei mit Suche, Filtern, gespeicherten Ansichten und Stapelaktionen. */
export default function AktenListe() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, tenant } = useKanzlei();
  const { team, byId } = useTeam();
  const akten = useCol("akten");
  const fristen = useCol("fristen");
  const kontakte = useKontaktMap();
  const naechste = useNaechsteFristen();
  const [neuOffen, setNeuOffen] = useState(false);
  const [bulk, setBulkRoh] = useState<{ art: "bearbeiter" | "status"; rows: Akte[]; clear: () => void } | null>(null);
  const [abschlussPruefen, setAbschlussPruefen] = useState(false);
  const setBulk = (b: typeof bulk) => {
    setBulkRoh(b);
    setAbschlussPruefen(false);
  };

  const q = params.get("q") ?? "";
  const filter: Filter = {
    status: (params.get("status") as StatusFilter) || "offen",
    sg: params.get("sg") ?? "",
    ra: params.get("ra") ?? "",
    prio: params.get("prio") ?? "",
    frist: params.get("frist") ?? "",
    seit: params.get("seit") ?? "",
  };

  useEffect(() => {
    const p = new URLSearchParams(params);
    p.delete("neu");
    p.delete("nachricht");
    listenKontext.suche = p.toString() ? `?${p.toString()}` : "";
  }, [params]);

  const setze = useCallback(
    (patch: Partial<Record<keyof Filter | "q", string>>) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (!v || (k === "status" && v === "offen")) p.delete(k);
            else p.set(k, v);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const heute = today();
  const montag = addDays(heute, -((new Date(heute + "T00:00:00Z").getUTCDay() + 6) % 7));

  // Akten mit Frist ≤ 7 Tage (inkl. überfälliger) – dieselbe Hilfsfunktion wie die Cockpit-Karte „Akten mit Handlungsbedarf“.
  // „Kritisch“ = Notfrist oder gesetzlich nicht verlängerbare Frist (z. B. § 4 KSchG, StPO, OWiG).
  const fristInfo = useMemo(() => {
    const je = aktenMitFrist(fristen, heute);
    const frist7 = new Set(je.keys());
    const notfrist7 = new Set([...je].filter(([, x]) => x.kritisch).map(([id]) => id));
    return { frist7, notfrist7 };
  }, [fristen, heute]);

  const ansichten: Ansicht[] = [
    { key: "alle", label: "Alle offenen", hinweis: "Alle offenen Akten der Kanzlei", icon: <FolderOpen className="size-3.5" />, filter: { status: "offen", sg: "", ra: "", prio: "", frist: "", seit: "" } },
    { key: "meine", label: "Meine Akten", hinweis: `Offene Akten, die ${user.name} bearbeitet`, icon: <UserRound className="size-3.5" />, filter: { status: "offen", sg: "", ra: user.id, prio: "", frist: "", seit: "" } },
    { key: "hoch", label: "Hohe Priorität", hinweis: "Offene Akten mit hoher Priorität", icon: <Flag className="size-3.5" />, filter: { status: "offen", sg: "", ra: "", prio: "hoch", frist: "", seit: "" } },
    { key: "notfrist", label: "Kritische Frist ≤ 7 Tage", hinweis: "Notfrist oder nicht verlängerbare Frist in den nächsten 7 Tagen oder überfällig", icon: <AlarmClock className="size-3.5" />, filter: { status: "offen", sg: "", ra: "", prio: "", frist: "notfrist7", seit: "" } },
    { key: "frist7", label: "Frist ≤ 7 Tage", hinweis: "Notfrist oder Frist in den nächsten 7 Tagen oder überfällig – Wiedervorlagen zählen nicht", icon: <CalendarClock className="size-3.5" />, filter: { status: "offen", sg: "", ra: "", prio: "", frist: "frist7", seit: "" } },
  ];
  const aktiveAnsicht = ansichten.find((a) => (Object.keys(a.filter) as (keyof Filter)[]).every((k) => a.filter[k] === filter[k]))?.key;

  // Filter (ohne Status) → Basis für Zählungen
  const ohneStatus = useMemo(() => {
    let list = akten;
    if (filter.sg) list = list.filter((a) => a.sachgebiet === filter.sg);
    if (filter.ra) list = list.filter((a) => a.bearbeiterId === filter.ra || a.sachbearbeiterId === filter.ra);
    if (filter.prio) list = list.filter((a) => a.prioritaet === filter.prio);
    if (filter.frist === "frist7") list = list.filter((a) => fristInfo.frist7.has(a.id));
    if (filter.frist === "notfrist7") list = list.filter((a) => fristInfo.notfrist7.has(a.id));
    if (filter.seit === "woche") list = list.filter((a) => a.createdAt.slice(0, 10) >= montag);
    if (q.trim()) {
      const name = (id?: string) => (id ? kontakte.get(id)?.name : undefined);
      list = search(list, q, [
        { get: (a) => a.aktenzeichen, weight: 5 },
        { get: (a) => a.titel, weight: 3 },
        { get: (a) => name(a.mandantId), weight: 3 },
        { get: (a) => a.gerichtsAz, weight: 3 },
        { get: (a) => a.schlagworte.join(" "), weight: 2 },
        { get: (a) => name(a.gegnerId), weight: 2 },
        { get: (a) => a.beschreibung, weight: 1 },
      ], 500).map((h) => h.item);
    }
    return list;
  }, [akten, filter.sg, filter.ra, filter.prio, filter.frist, filter.seit, montag, q, kontakte, fristInfo]);

  const zaehler = useMemo(() => {
    const c = { offen: 0, ruhend: 0, abgeschlossen: 0, alle: ohneStatus.length };
    for (const a of ohneStatus) c[a.status]++;
    return c;
  }, [ohneStatus]);

  const liste = useMemo(() => (filter.status === "alle" ? ohneStatus : ohneStatus.filter((a) => a.status === filter.status)), [ohneStatus, filter.status]);

  // Kennzahlen
  const kpi = useMemo(() => {
    const offen = akten.filter((a) => a.status === "offen");
    const neu = akten.filter((a) => a.createdAt.slice(0, 10) >= montag);
    const mitFrist = offen.filter((a) => fristInfo.frist7.has(a.id));
    return {
      offen: offen.length,
      hoch: offen.filter((a) => a.prioritaet === "hoch").length,
      neu: neu.length,
      montag,
      frist: mitFrist.length,
      notfrist: offen.filter((a) => fristInfo.notfrist7.has(a.id)).length,
    };
  }, [akten, montag, fristInfo]);

  const columns = useMemo<ColumnDef<Akte, unknown>[]>(
    () => [
      {
        id: "aktenzeichen",
        header: "Az.",
        size: 84,
        accessorFn: (a) => azSortKey(a.aktenzeichen),
        cell: ({ row }) => (
          <span className="mono text-[12.5px] font-semibold text-fg-2">
            <Highlight text={row.original.aktenzeichen} q={q} />
          </span>
        ),
      },
      {
        id: "Akte",
        header: "Akte",
        size: 230,
        accessorFn: (a) => a.titel,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {a.prioritaet === "hoch" && <span className="size-1.5 shrink-0 rounded-full bg-seal" title="Hohe Priorität" />}
                <span className="truncate font-semibold text-fg">
                  <Highlight text={a.titel} q={q} />
                </span>
              </div>
              <div className="truncate text-[12px] text-fg-3">
                <Highlight text={kontakte.get(a.mandantId)?.name ?? "–"} q={q} />
                {a.gerichtsAz && <span className="mono text-fg-4"> · {a.gerichtsAz}</span>}
              </div>
            </div>
          );
        },
      },
      {
        id: "Sachgebiet",
        header: "Sachgebiet",
        size: 160,
        accessorFn: (a) => a.sachgebiet,
        cell: ({ row }) => <SachgebietChip sg={row.original.sachgebiet} />,
      },
      {
        id: "Phase",
        header: "Phase",
        size: 134,
        accessorFn: (a) => a.phase,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-[12.5px] text-fg-2">{row.original.status === "offen" ? row.original.phase : STATUS_INFO[row.original.status].label}</div>
            <PhasenBalken phase={row.original.phase} className="mt-1 w-[84px]" />
          </div>
        ),
      },
      {
        id: "Nächste Frist",
        header: "Nächste Frist",
        size: 148,
        accessorFn: (a) => naechste.get(a.id)?.datum ?? "9999-12-31",
        cell: ({ row }) => {
          const f = naechste.get(row.original.id);
          if (!f) return <span className="text-[12.5px] text-fg-4">–</span>;
          return (
            <div className="min-w-0" title={`${f.titel} – ${fmtDate(f.datum)}`}>
              <FristChip datum={f.datum} />
              <div className="mt-0.5 truncate text-[11.5px] text-fg-3">
                {fmtDateShort(f.datum)} · {FRIST_TYP_LABEL[f.typ]}
              </div>
            </div>
          );
        },
      },
      {
        id: "Gegenstandswert",
        header: ({ header }) => (
          <span className="block text-right" style={{ width: header.getSize() - 24 - (header.column.getIsSorted() ? 16 : 0) }}>
            Gegenstandswert
          </span>
        ),
        size: 124,
        accessorFn: (a) => a.gegenstandswert,
        cell: ({ row }) => <div className="num text-right text-[13px] font-medium">{row.original.gegenstandswert ? fmtEUR(row.original.gegenstandswert, { cents: false }) : "–"}</div>,
      },
      {
        id: "Bearbeitung",
        header: "Bearbeitung",
        size: 86,
        accessorFn: (a) => byId.get(a.bearbeiterId)?.name ?? "",
        cell: ({ row }) => {
          const u = byId.get(row.original.bearbeiterId);
          const sb = row.original.sachbearbeiterId ? byId.get(row.original.sachbearbeiterId) : undefined;
          return (
            <div className="flex -space-x-1.5">
              {u && <Avatar initialen={u.initialen} farbe={u.farbe} size={26} title={`${u.name} (Bearbeitung)`} className="ring-2 ring-[var(--surface)]" />}
              {sb && <Avatar initialen={sb.initialen} farbe={sb.farbe} size={26} title={`${sb.name} (Sachbearbeitung)`} className="opacity-80 ring-2 ring-[var(--surface)]" />}
            </div>
          );
        },
      },
      {
        id: "Letzte Änderung",
        header: "Geändert",
        size: 98,
        accessorFn: (a) => a.updatedAt,
        cell: ({ row }) => <span className="text-[12.5px] text-fg-3">{relTime(row.original.updatedAt)}</span>,
      },
    ],
    [q, kontakte, naechste, byId],
  );

  const mandantenUpdate = (rows: Akte[], clear: () => void) => {
    const st = useData.getState();
    for (const a of rows) {
      st.log({ akteur: "automation", automationKey: "mandanten-update", akteId: a.id, minutenGespart: 10, text: `Mandanten-Update versendet – ${a.aktenzeichen} ${a.titel.split(" ./. ")[0]}` });
    }
    const au = st.data.automationen.find((x) => x.key === "mandanten-update");
    if (au) st.patch("automationen", au.id, { laeufe: au.laeufe + rows.length, letzterLauf: nowLocal() });
    toast(rows.length === 1 ? "Mandanten-Update gesendet" : `${rows.length} Mandanten-Updates gesendet`, { ton: "erfolg", text: `Verständlicher Sachstand an die Mandanten · ≈ ${rows.length * 10} Min. gespart` });
    clear();
  };

  /** Sammelaktion „Status ändern“ – mit Protokoll je Akte; Abschluss wie „Akte abschließen …“ (Archivierung, § 50 BRAO). */
  const setzeBulkStatus = (s: Akte["status"]) => {
    if (!bulk) return;
    const betroffen = bulk.rows.filter((r) => r.status !== s);
    const st = useData.getState();
    let jahr = 0;
    for (const r of betroffen) {
      if (s === "abgeschlossen") {
        jahr = schliesseAkteAb(r, user.id);
        continue;
      }
      st.patch("akten", r.id, { status: s, phase: r.phase === "Abgeschlossen" ? "Außergerichtlich" : r.phase, abgeschlossenAm: undefined, updatedAt: nowLocal() });
      st.log({ akteur: "nutzer", userId: user.id, akteId: r.id, text: `Status geändert: ${STATUS_INFO[s].label} – ${r.aktenzeichen}` });
    }
    const n = (k: number) => `${k} ${k === 1 ? "Akte" : "Akten"}`;
    if (!betroffen.length) toast(`Bereits „${STATUS_INFO[s].label}“`, { ton: "info", text: `${n(bulk.rows.length)} unverändert` });
    else
      toast(s === "abgeschlossen" ? (betroffen.length === 1 ? "Akte abgeschlossen" : `${betroffen.length} Akten abgeschlossen`) : "Status geändert", {
        ton: "erfolg",
        text: s === "abgeschlossen" ? `Aufbewahrung bis 31.12.${jahr} vorgemerkt (§ 50 BRAO)` : `${n(betroffen.length)}: ${STATUS_INFO[s].label}${betroffen.length < bulk.rows.length ? ` · ${bulk.rows.length - betroffen.length} unverändert` : ""}`,
      });
    bulk.clear();
    setBulk(null);
  };

  const neueAkte = () => setNeuOffen(true);
  const ausUrl = params.get("neu") === "1" || !!params.get("nachricht");
  const schliesseNeu = useCallback(() => {
    setNeuOffen(false);
    if (ausUrl)
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.delete("neu");
          n.delete("nachricht");
          return n;
        },
        { replace: true },
      );
  }, [ausUrl, setParams]);
  // Geöffnet über /akten?neu=1&nachricht=… (Posteingang, Befehlspalette, Cockpit): Den Eintrag beim Wechsel in die neue Akte
  // ersetzen – sonst öffnet Browser-Zurück den Assistenten erneut vorbefüllt und eine doppelte Akte wäre möglich.
  const onErstellt = useCallback((id: string) => nav(`/akten/${id}`, { replace: ausUrl }), [nav, ausUrl]);

  const filterAktiv = !!(q || filter.sg || filter.ra || filter.prio || filter.frist || filter.seit || filter.status !== "offen");

  return (
    <div>
      <PageHeader
        title="Akten"
        hilfe="akten"
        subtitle="Alle Mandate Ihrer Kanzlei an einem Ort – suchen, filtern und mit einem Klick in die E-Akte mit Dokumenten, Fristen, Beteiligten und Aktenkonto springen."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={neueAkte}>
            Neue Akte
          </Button>
        }
      />

      {/* Kennzahlen */}
      <div className="no-scrollbar -mx-4 mb-5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {[
          { label: "Offene Akten", value: kpi.offen, sub: `davon ${kpi.hoch} mit hoher Priorität`, icon: <FolderOpen className="size-4" />, tone: "ink" as const, on: () => setze({ status: "offen", sg: "", ra: "", prio: "", frist: "", seit: "" }) },
          { label: "Neu diese Woche", value: kpi.neu, sub: `seit Montag, ${fmtDate(kpi.montag)}`, icon: <Sparkle className="size-4" />, tone: "green" as const, on: () => setze({ status: "alle", sg: "", ra: "", prio: "", frist: "", seit: "woche" }) },
          { label: "Akten mit Frist ≤ 7 Tage", value: kpi.frist, sub: kpi.notfrist ? `davon ${kpi.notfrist} mit kritischer Frist` : "keine kritische Frist darunter", icon: <AlarmClock className="size-4" />, tone: kpi.notfrist ? ("seal" as const) : ("amber" as const), on: () => setze({ status: "offen", frist: "frist7", sg: "", ra: "", prio: "", seit: "" }) },
        ].map((k, i) => (
          <motion.button
            key={k.label}
            type="button"
            onClick={k.on}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 420, damping: 34 }}
            className="sheet glow relative flex min-w-[230px] snap-start items-center gap-3.5 rounded-[22px] p-4 text-left transition-transform duration-300 ease-[var(--spring)] hover:-translate-y-0.5 active:scale-[0.98] sm:min-w-0"
          >
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-[12px]", { ink: "bg-ink-soft text-ink", green: "bg-green-soft text-green", seal: "bg-seal-soft text-seal", amber: "bg-amber-soft text-amber" }[k.tone])}>{k.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-fg-3">{k.label}</span>
              <span className="block text-[26px] font-semibold leading-tight tracking-[-0.03em]">
                <AnimatedNumber value={k.value} />
              </span>
              <span className="block truncate text-[12px] text-fg-3">{k.sub}</span>
            </span>
          </motion.button>
        ))}
      </div>

      {/* Gespeicherte Ansichten */}
      <div className="mb-3 flex items-center gap-2">
        <span className="eyebrow hidden shrink-0 sm:inline">Ansichten</span>
        <div className="no-scrollbar -mr-4 flex flex-1 gap-1.5 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:pr-0">
          {ansichten.map((a) => {
            const aktiv = aktiveAnsicht === a.key;
            return (
              <button
                key={a.key}
                type="button"
                title={a.hinweis}
                onClick={() => setze({ ...a.filter })}
                className={cn(
                  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                  aktiv ? "text-on-ink" : "text-fg-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-ink-softer hover:text-fg",
                )}
              >
                {aktiv && <motion.span layoutId="akten-ansicht" transition={{ type: "spring", stiffness: 520, damping: 38 }} className="absolute inset-0 -z-0 rounded-full bg-ink shadow-[0_6px_16px_-8px_var(--ink)]" />}
                <span className="relative">{a.icon}</span>
                <span className="relative">{a.label}</span>
              </button>
            );
          })}
          {filterAktiv && !aktiveAnsicht && (
            <button type="button" onClick={() => setze({ q: "", status: "offen", sg: "", ra: "", prio: "", frist: "", seit: "" })} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium text-fg-3 hover:bg-ink-softer hover:text-fg">
              <X className="size-3.5" /> Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      <DataTable<Akte>
        id="akten"
        data={liste}
        columns={columns}
        getRowId={(a) => a.id}
        initialSort={[{ id: "aktenzeichen", desc: true }]}
        onRowClick={(a) => nav(`/akten/${a.id}`)}
        selectable
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchField id="akten-suche" value={q} onChange={(v) => setze({ q: v })} placeholder="Az., Titel, Mandant, Schlagwort …" className="w-full min-w-[220px] flex-1 lg:max-w-[340px]" />
            <Segmented<StatusFilter>
              size="sm"
              value={filter.status}
              onChange={(v) => setze({ status: v })}
              options={[
                { value: "offen", label: "Offen", count: zaehler.offen },
                { value: "ruhend", label: "Ruhend", count: zaehler.ruhend },
                { value: "abgeschlossen", label: "Abgeschlossen", count: zaehler.abgeschlossen },
                { value: "alle", label: "Alle", count: zaehler.alle },
              ]}
            />
            <div className="flex min-w-0 flex-1 gap-2 sm:flex-none">
              <Select id="akten-sachgebiet" aria-label="Sachgebiet" value={filter.sg} onChange={(e) => setze({ sg: e.target.value })} className="!h-8 min-w-0 flex-1 !rounded-full !text-[12.5px] sm:!w-[170px] sm:flex-none">
                <option value="">Alle Sachgebiete</option>
                {SACHGEBIETE.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Select id="akten-bearbeiter" aria-label="Bearbeitung" value={filter.ra} onChange={(e) => setze({ ra: e.target.value })} className="!h-8 min-w-0 flex-1 !rounded-full !text-[12.5px] sm:!w-[170px] sm:flex-none">
                <option value="">Alle Bearbeiter</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
        bulkActions={(rows, clear) => (
          <>
            <Button size="sm" variant="secondary" icon={<UserRoundCog className="size-4" />} onClick={() => setBulk({ art: "bearbeiter", rows, clear })}>
              Bearbeiter ändern
            </Button>
            <Button size="sm" variant="secondary" icon={<ListChecks className="size-4" />} onClick={() => setBulk({ art: "status", rows, clear })}>
              Status ändern
            </Button>
            <Button size="sm" variant="secondary" icon={<Send className="size-4" />} onClick={() => mandantenUpdate(rows, clear)}>
              Mandanten-Update senden
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              Auswahl aufheben
            </Button>
          </>
        )}
        mobileRow={(a) => {
          const f = naechste.get(a.id);
          return (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="mono text-[12px] font-semibold text-fg-3">{a.aktenzeichen}</span>
                  {a.prioritaet === "hoch" && <span className="size-1.5 rounded-full bg-seal" />}
                  {a.status !== "offen" && <Chip tone={STATUS_INFO[a.status].tone}>{STATUS_INFO[a.status].label}</Chip>}
                </div>
                <div className="mt-0.5 truncate text-[14.5px] font-semibold">
                  <Highlight text={a.titel} q={q} />
                </div>
                <div className="truncate text-[12.5px] text-fg-3">
                  {kontakte.get(a.mandantId)?.name ?? "–"} · {a.sachgebiet}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {f ? <FristChip datum={f.datum} /> : <span className="text-[12px] text-fg-4">keine Frist</span>}
                <span className="text-[11.5px] text-fg-4">{relTime(a.updatedAt)}</span>
              </div>
            </div>
          );
        }}
        empty={
          <Empty
            icon={<FolderOpen className="size-6" />}
            title={akten.length ? "Keine Akte passt zu diesen Filtern" : "Noch keine Akten"}
            text={akten.length ? "Ändern Sie die Suche oder setzen Sie die Filter zurück." : "Legen Sie Ihre erste Akte an – Vollmacht und Mandatsbestätigung erstellt AnwaltApex automatisch."}
            action={
              akten.length ? (
                <Button variant="secondary" onClick={() => setze({ q: "", status: "offen", sg: "", ra: "", prio: "", frist: "", seit: "" })}>
                  Filter zurücksetzen
                </Button>
              ) : (
                <Button variant="primary" icon={<FolderPlus className="size-4" />} onClick={neueAkte}>
                  Neue Akte anlegen
                </Button>
              )
            }
          />
        }
      />
      <p className="mt-3 px-1 text-[12px] text-fg-4">
        {liste.length} {liste.length === 1 ? "Akte" : "Akten"} · Spaltenbreite, sichtbare Spalten und Zeilendichte merkt sich AnwaltApex für Sie · {tenant.kurzname}
      </p>

      <Mandatsaufnahme open={neuOffen || params.get("neu") === "1"} onClose={schliesseNeu} onErstellt={onErstellt} nachrichtId={params.get("nachricht")} />

      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        size={abschlussPruefen ? "md" : "sm"}
        footer={
          abschlussPruefen && bulk ? (
            <>
              <Button variant="ghost" onClick={() => setAbschlussPruefen(false)} className="mr-auto">
                Zurück
              </Button>
              <Button variant="primary" icon={<Archive className="size-4" />} onClick={() => setzeBulkStatus("abgeschlossen")}>
                {(() => {
                  const n = bulk.rows.filter((r) => r.status !== "abgeschlossen").length;
                  return n === 1 ? "Akte abschließen" : `${n} Akten abschließen`;
                })()}
              </Button>
            </>
          ) : undefined
        }
        icon={bulk?.art === "bearbeiter" ? <UserRoundCog className="size-[18px]" /> : <ListChecks className="size-[18px]" />}
        title={bulk?.art === "bearbeiter" ? "Bearbeiter ändern" : abschlussPruefen ? (bulk && bulk.rows.filter((r) => r.status !== "abgeschlossen").length === 1 ? "Akte abschließen?" : "Akten abschließen?") : "Status ändern"}
        subtitle={bulk ? `${bulk.rows.length} ${bulk.rows.length === 1 ? "Akte" : "Akten"} ausgewählt` : undefined}
      >
        <div className="grid grid-cols-1 gap-1.5">
          {bulk?.art === "bearbeiter"
            ? team
                .filter((u) => u.rolle !== "refa" && u.rolle !== "admin")
                .map((u) => {
                  const alle = bulk.rows.every((r) => r.bearbeiterId === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        const st = useData.getState();
                        for (const r of bulk.rows) st.patch("akten", r.id, { bearbeiterId: u.id, updatedAt: nowLocal() });
                        st.log({ akteur: "nutzer", userId: user.id, text: `${bulk.rows.length} ${bulk.rows.length === 1 ? "Akte" : "Akten"} an ${u.name} übertragen` });
                        toast("Bearbeiter geändert", { ton: "erfolg", text: `${bulk.rows.length} ${bulk.rows.length === 1 ? "Akte" : "Akten"} jetzt bei ${u.name}` });
                        bulk.clear();
                        setBulk(null);
                      }}
                      className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-ink-softer"
                    >
                      <Avatar initialen={u.initialen} farbe={u.farbe} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{u.name}</span>
                        <span className="block truncate text-[12px] text-fg-3">{u.titel}</span>
                      </span>
                      {alle && <Check className="size-4 text-ink" />}
                    </button>
                  );
                })
            : abschlussPruefen && bulk
              ? (
                  <AbschlussPruefung rows={bulk.rows.filter((r) => r.status !== "abgeschlossen")} fristen={fristen} />
                )
              : (["offen", "ruhend", "abgeschlossen"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (!bulk) return;
                    // Abschließen nie ohne Rückfrage – mit Hinweis auf offene Fristen (wie „Akte abschließen …“ in der Akte)
                    if (s === "abgeschlossen" && bulk.rows.some((r) => r.status !== "abgeschlossen")) setAbschlussPruefen(true);
                    else setzeBulkStatus(s);
                  }}
                  className="flex items-center gap-3 rounded-[14px] px-3 py-3 text-left transition-colors hover:bg-ink-softer"
                >
                  <span className="w-[118px] shrink-0">
                    <Chip tone={STATUS_INFO[s].tone} dot>
                      {STATUS_INFO[s].label}
                    </Chip>
                  </span>
                  <span className="flex-1 text-[12.5px] text-fg-3">
                    {s === "offen" ? "Wird aktiv bearbeitet" : s === "ruhend" ? "Pausiert, z. B. bis zur Entscheidung eines anderen Verfahrens" : "Mandat beendet – Aufbewahrungsfrist nach § 50 BRAO beginnt"}
                  </span>
                </button>
              ))}
        </div>
      </Modal>
    </div>
  );
}

/** Prüfschritt vor dem Sammel-Abschluss: offene Fristen und Termine je Akte, damit nichts unbemerkt liegen bleibt. */
function AbschlussPruefung({ rows, fristen }: { rows: Akte[]; fristen: Frist[] }) {
  const mitOffenen = rows.map((a) => ({ a, o: offeneEintraege(a.id, fristen) })).filter((x) => x.o.fristen || x.o.wiedervorlagen || x.o.termine);
  const summe = mitOffenen.reduce(
    (s, x) => ({ fristen: s.fristen + x.o.fristen, notfristen: s.notfristen + x.o.notfristen, wiedervorlagen: s.wiedervorlagen + x.o.wiedervorlagen, termine: s.termine + x.o.termine }),
    { fristen: 0, notfristen: 0, wiedervorlagen: 0, termine: 0 },
  );
  return (
    <div className="grid grid-cols-1 gap-3">
      {mitOffenen.length > 0 ? (
        <div className="flex gap-3 rounded-[16px] bg-seal-soft p-3.5 text-[13px]" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-seal" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-seal">
              {mitOffenen.length === 1 ? "In 1 Akte" : `In ${mitOffenen.length} Akten`} {summe.fristen + summe.wiedervorlagen + summe.termine === 1 ? "ist" : "sind"} noch {offeneEintraegeText(summe)} eingetragen
            </div>
            <div className="mt-0.5 text-fg-2">Sie bleiben nach dem Abschluss im Fristenkalender stehen. Bitte vorher erledigen oder bewusst offen lassen.</div>
            <ul className="mt-2 grid grid-cols-1 gap-1">
              {mitOffenen.slice(0, 5).map(({ a, o }) => (
                <li key={a.id} className="flex min-w-0 items-baseline gap-2">
                  <span className="mono shrink-0 text-[12px] font-semibold text-fg-2">{a.aktenzeichen}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{a.titel}</span>
                  <span className={cn("shrink-0 text-[12px] font-medium", o.notfristen ? "text-seal" : "text-fg-3")}>
                    {o.notfristen ? `${o.notfristen} nicht verlängerbar` : `${o.fristen + o.wiedervorlagen + o.termine} offen`}
                  </span>
                </li>
              ))}
              {mitOffenen.length > 5 && <li className="text-[12px] text-fg-3">und {mitOffenen.length - 5} weitere</li>}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-[16px] bg-green-soft p-3.5 text-[13px]">
          <Check className="mt-0.5 size-4 shrink-0 text-green" />
          <div className="text-fg-2">{rows.length === 1 ? "Die Akte hat keine offenen Fristen, Wiedervorlagen oder Termine mehr." : "Keine der Akten hat noch offene Fristen, Wiedervorlagen oder Termine."}</div>
        </div>
      )}
      <p className="px-1 text-[12.5px] leading-relaxed text-fg-3">
        {rows.length === 1 ? "Die Akte wird" : `Die ${rows.length} Akten werden`} archiviert, die Aufbewahrungsfrist der Handakte (§ 50 BRAO, sechs Jahre) wird vorgemerkt und der Abschluss im Verlauf jeder Akte protokolliert. Sie können Akten jederzeit wieder öffnen.
      </p>
    </div>
  );
}

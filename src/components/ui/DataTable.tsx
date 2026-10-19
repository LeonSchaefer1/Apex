import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState, type ColumnSizingState, type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3, Rows3, Rows4, Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { BEWEGUNG } from "@/lib/bewegung";
import { useIsMobile } from "@/lib/useMedia";
import { useUI } from "@/store/ui";
import { Menu } from "./Menu";

export type { ColumnDef };

type Dichte = "comfortable" | "compact";

interface Gespeichert {
  sorting?: SortingState;
  visibility?: VisibilityState;
  sizing?: ColumnSizingState;
  /** Eigene Dichte dieser Tabelle – gilt, solange die globale Dichte (Einstellungen → Darstellung) seitdem nicht geändert wurde. */
  eigeneDichte?: { wert: Dichte; basis: Dichte };
}

function lade(id: string): Gespeichert {
  try {
    return JSON.parse(localStorage.getItem(`aa:table:${id}`) ?? "{}");
  } catch {
    return {};
  }
}
/** Globale Dichte geändert (Einstellungen → Darstellung): eigene Dichte-Wahl aller Tabellen verwerfen, damit sie wieder der globalen folgen. */
export function tabellenDichteZuruecksetzen() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("aa:table:")) continue;
      const v = JSON.parse(localStorage.getItem(k) ?? "{}") as Gespeichert;
      if (!v.eigeneDichte) continue;
      delete v.eigeneDichte;
      localStorage.setItem(k, JSON.stringify(v));
    }
  } catch {
    /* optional */
  }
}

function speichere(id: string, v: Gespeichert) {
  try {
    localStorage.setItem(`aa:table:${id}`, JSON.stringify(v));
  } catch {
    /* optional */
  }
}

/**
 * Skalierbare Datentabelle: verstellbare & ausblendbare Spalten, Sortierung, Dichte-Umschaltung,
 * Mehrfachauswahl – Einstellungen werden je Tabelle gespeichert. Auf dem Smartphone als Kartenliste.
 */
export function DataTable<T>({
  id, data, columns, onRowClick, mobileRow, selectable, bulkActions, getRowId, empty, initialSort, toolbar, maxHeight, defaultHidden, rowLabel, selectLabel,
}: {
  id: string;
  data: T[];
  columns: ColumnDef<T, unknown>[];
  onRowClick?: (row: T) => void;
  mobileRow?: (row: T) => ReactNode;
  selectable?: boolean;
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  getRowId?: (row: T) => string;
  empty?: ReactNode;
  initialSort?: SortingState;
  toolbar?: ReactNode;
  maxHeight?: string;
  /** Spalten (ID), die anfangs ausgeblendet sind – nur solange für diese Spalte noch keine eigene Wahl gespeichert ist. */
  defaultHidden?: string[];
  /**
   * Zugänglicher Name des Öffnen-Ziels einer Zeile (I4-T07-01), z. B. „Rechnung RE-2026-0024 öffnen“. Mit `onRowClick` bekommt jede
   * Zeile genau ein Tastaturziel (die erste sichtbare Datenspalte); ohne Angabe heißt es „Zeile öffnen“.
   */
  rowLabel?: (row: T) => string;
  /** Zugänglicher Name des Auswahl-Häkchens einer Zeile, z. B. „RE-2026-0024 auswählen“ (ohne Angabe „Auswählen“). */
  selectLabel?: (row: T) => string;
}) {
  const saved = useMemo(() => lade(id), [id]);
  const [sorting, setSorting] = useState<SortingState>(saved.sorting ?? initialSort ?? []);
  const [visibility, setVisibility] = useState<VisibilityState>(() => {
    const v: VisibilityState = { ...(saved.visibility ?? {}) };
    for (const col of defaultHidden ?? []) if (!(col in v)) v[col] = false;
    return v;
  });
  const [sizing, setSizing] = useState<ColumnSizingState>(saved.sizing ?? {});
  // Standard ist die globale Dichte; der Schalter in der Tabelle überschreibt sie nur für diese Ansicht.
  const globaleDichte = useUI((st) => st.dichte);
  const [eigeneDichte, setEigeneDichte] = useState<Gespeichert["eigeneDichte"]>(saved.eigeneDichte);
  const dichte: Dichte = eigeneDichte && eigeneDichte.basis === globaleDichte ? eigeneDichte.wert : globaleDichte;
  const setDichte = (d: Dichte) => setEigeneDichte(d === globaleDichte ? undefined : { wert: d, basis: globaleDichte });
  const [selection, setSelection] = useState<RowSelectionState>({});
  const mobile = useIsMobile();

  useEffect(() => speichere(id, { sorting, visibility, sizing, eigeneDichte }), [id, sorting, visibility, sizing, eigeneDichte]);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!selectable) return columns;
    return [
      {
        id: "_select",
        size: 44,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={() => table.toggleAllRowsSelected()}
            label="Alle sichtbaren auswählen"
          />
        ),
        cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onChange={() => row.toggleSelected()} label={selectLabel?.(row.original)} />,
      },
      ...columns,
    ];
  }, [columns, selectable, selectLabel]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnVisibility: visibility, columnSizing: sizing, rowSelection: selection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onColumnSizingChange: setSizing,
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
    enableRowSelection: !!selectable,
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const rows = table.getRowModel().rows;

  const controls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="icon-btn !size-8"
        aria-label={dichte === "compact" ? "Großzügige Zeilen" : "Kompakte Zeilen"}
        title={dichte === "compact" ? "Großzügige Zeilen" : "Kompakte Zeilen"}
        onClick={() => setDichte(dichte === "compact" ? "comfortable" : "compact")}
      >
        {dichte === "compact" ? <Rows3 className="size-4" /> : <Rows4 className="size-4" />}
      </button>
      <Menu
        trigger={({ open, toggle }) => (
          <button type="button" className="icon-btn !size-8" aria-label="Spalten wählen" title="Spalten wählen" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
            <Columns3 className="size-4" />
          </button>
        )}
        items={table
          .getAllLeafColumns()
          .filter((c) => c.getCanHide())
          .map((c) => ({
            label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
            icon: c.getIsVisible() ? <Check /> : <span className="inline-block size-4" />,
            // Umschalter: angesagt als „aktiviert/nicht aktiviert“; das Menü bleibt offen für mehrere Spalten nacheinander
            checked: c.getIsVisible(),
            offenLassen: true,
            onClick: () => c.toggleVisibility(),
          }))}
      />
    </div>
  );

  return (
    <div className="sheet relative overflow-hidden rounded-lg">
      {(toolbar || !mobile) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {!mobile && controls}
        </div>
      )}
      {selectable && selectedRows.length > 0 && bulkActions && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={BEWEGUNG.standard} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2 text-[14px]">
          <span className="num font-medium">{selectedRows.length} ausgewählt</span>
          <div className="flex flex-wrap gap-2">{bulkActions(selectedRows, () => setSelection({}))}</div>
        </motion.div>
      )}
      {rows.length === 0 ? (
        empty ?? <div className="px-6 py-12 text-center text-[14px] text-fg-3">Keine Einträge.</div>
      ) : mobile && mobileRow ? (
        <ul className="divide-y divide-[var(--line)]">
          {rows.map((r) => (
            <li key={r.id}>
              <KartenKnopf label={onRowClick ? (rowLabel?.(r.original) ?? "Zeile öffnen") : undefined} onClick={() => onRowClick?.(r.original)} className={cn("block min-h-11 w-full px-4 text-left transition-colors duration-100 active:bg-[var(--surface-2)] focus-visible:outline-offset-[-2px]", dichte === "compact" ? "py-2" : "py-3")}>
                {mobileRow(r.original)}
              </KartenKnopf>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="table" data-density={dichte} style={{ minWidth: table.getTotalSize() }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} style={{ width: h.getSize() }} className="group relative">
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("group/sort inline-flex items-center gap-1 transition-colors duration-100 hover:text-fg", h.column.getIsSorted() && "text-fg", (h.column.columnDef.meta as { align?: string } | undefined)?.align === "right" && "w-full justify-end")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === "asc" && <ArrowUp className="size-3" />}
                          {h.column.getIsSorted() === "desc" && <ArrowDown className="size-3" />}
                          {!h.column.getIsSorted() && <ArrowUp className="size-3 opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60" aria-hidden />}
                        </button>
                      ) : (
                        <div className={cn("inline-flex items-center", (h.column.columnDef.meta as { align?: string } | undefined)?.align === "right" && "w-full justify-end")}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </div>
                      )}
                      {h.column.getCanResize() && (
                        <div
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-2 bottom-2 w-[3px] cursor-col-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100",
                            h.column.getIsResizing() ? "bg-[var(--ink)] opacity-100" : "bg-[var(--line-strong)]",
                          )}
                          aria-hidden
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((r) => {
                const zellen = r.getVisibleCells();
                // Genau ein Tastaturziel je Zeile (I4-T07-01, WCAG 2.1.1): die erste sichtbare Datenspalte nach dem Häkchen
                const oeffnenZelle = onRowClick ? zellen.find((c) => c.column.id !== "_select")?.id : undefined;
                return (
                  <tr
                    key={r.id}
                    data-selected={r.getIsSelected()}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,a,input,label")) return;
                      onRowClick?.(r.original);
                    }}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {zellen.map((c) => (
                      <td key={c.id} style={{ width: c.column.getSize(), maxWidth: c.column.getSize() }} className={cn("truncate", (c.column.columnDef.meta as { align?: string } | undefined)?.align === "right" && "text-right")}>
                        {c.id === oeffnenZelle ? (
                          <ZeilenOeffner label={rowLabel?.(r.original) ?? "Zeile öffnen"} onOeffnen={() => onRowClick?.(r.original)}>
                            {flexRender(c.column.columnDef.cell, c.getContext())}
                          </ZeilenOeffner>
                        ) : (
                          flexRender(c.column.columnDef.cell, c.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const INTERAKTIV = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [role='button'], [role='link'], [role='checkbox']";

/**
 * Öffnen-Ziel einer Tabellenzeile: fasst den Inhalt der ersten Datenspalte in einen Knopf – Optik unverändert (volle Zellbreite, Text
 * links, kein Knopf-Look), Fokusrahmen wie überall. Enthält der Zelleninhalt selbst schon Knöpfe oder Links, wird nicht verschachtelt
 * (kein nested-interactive) – dann bleibt das vorhandene Element das Ziel. Pfeil links/rechts verschieben die Tabelle nicht seitlich;
 * Pfeil hoch/runter springen zum Öffnen-Ziel der vorigen bzw. nächsten Zeile.
 */
function ZeilenOeffner({ label, onOeffnen, children }: { label: string; onOeffnen: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  const setRef = (el: HTMLElement | null) => {
    ref.current = el;
  };
  const [verschachtelt, setVerschachtelt] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hat = !!el.querySelector(INTERAKTIV);
    if (hat !== verschachtelt) setVerschachtelt(hat);
  });
  if (verschachtelt) {
    return (
      <div ref={setRef} className="min-w-0">
        {children}
      </div>
    );
  }
  const taste = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const tbody = e.currentTarget.closest("tbody");
      if (!tbody) return;
      const alle = Array.from(tbody.querySelectorAll<HTMLButtonElement>("button[data-zeile-oeffnen]"));
      const i = alle.indexOf(e.currentTarget);
      const ziel = alle[e.key === "ArrowDown" ? i + 1 : i - 1];
      e.preventDefault();
      ziel?.focus();
    }
  };
  return (
    <button
      ref={setRef}
      type="button"
      data-zeile-oeffnen=""
      aria-label={label}
      onClick={onOeffnen}
      onKeyDown={taste}
      className="zeile-oeffnen"
    >
      {children}
    </button>
  );
}

/** Kartenliste (Telefon): vorhandener Knopf, Name wie das Öffnen-Ziel der Tabelle; der Karteninhalt bleibt als Beschreibung lesbar. */
function KartenKnopf({ label, onClick, className, children }: { label?: string; onClick: () => void; className: string; children: ReactNode }) {
  const id = useId();
  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} aria-describedby={label ? id : undefined}>
      <span id={id} className="block">
        {children}
      </span>
    </button>
  );
}

/**
 * Kontrollkästchen mit Trefferfläche über Polster (wie die E-Akte, I5-T14-02): sichtbar 16 px, getroffen 44×44 px am Telefon
 * und 24×24 px ab sm – die negativen Ränder halten das Layout unverändert.
 */
export function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label ?? "Auswählen"}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="group/kasten -m-[14px] grid shrink-0 place-items-center rounded-md p-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:-m-1 sm:p-1"
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 place-items-center rounded-sm border transition-colors duration-100",
          checked || indeterminate ? "border-transparent bg-[var(--ink)] text-[var(--on-ink)]" : "border-[var(--line-strong)] bg-[var(--surface)] group-hover/kasten:border-[var(--fg-3)]",
        )}
      >
        {checked && <Check className="size-3 [stroke-width:2.5]" />}
        {!checked && indeterminate && <span className="h-0.5 w-2 rounded bg-[var(--on-ink)]" />}
      </span>
    </button>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState, type ColumnSizingState, type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3, Rows3, Rows4, Check } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
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
  id, data, columns, onRowClick, mobileRow, selectable, bulkActions, getRowId, empty, initialSort, toolbar, maxHeight,
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
}) {
  const saved = useMemo(() => lade(id), [id]);
  const [sorting, setSorting] = useState<SortingState>(saved.sorting ?? initialSort ?? []);
  const [visibility, setVisibility] = useState<VisibilityState>(saved.visibility ?? {});
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
          <Checkbox checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onChange={() => table.toggleAllRowsSelected()} />
        ),
        cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onChange={() => row.toggleSelected()} />,
      },
      ...columns,
    ];
  }, [columns, selectable]);

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
        trigger={({ toggle }) => (
          <button type="button" className="icon-btn !size-8" aria-label="Spalten wählen" title="Spalten wählen" onClick={toggle}>
            <Columns3 className="size-4" />
          </button>
        )}
        items={table
          .getAllLeafColumns()
          .filter((c) => c.getCanHide())
          .map((c) => ({
            label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
            icon: c.getIsVisible() ? <Check /> : <span className="inline-block size-4" />,
            onClick: () => c.toggleVisibility(),
          }))}
      />
    </div>
  );

  return (
    <div className="sheet relative overflow-hidden rounded-[22px]">
      {(toolbar || !mobile) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {!mobile && controls}
        </div>
      )}
      {selectable && selectedRows.length > 0 && bulkActions && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-ink-softer px-4 py-2 text-[13px]">
          <span className="font-semibold">{selectedRows.length} ausgewählt</span>
          <div className="flex flex-wrap gap-2">{bulkActions(selectedRows, () => setSelection({}))}</div>
        </motion.div>
      )}
      {rows.length === 0 ? (
        empty ?? <div className="px-6 py-12 text-center text-[13px] text-fg-3">Keine Einträge.</div>
      ) : mobile && mobileRow ? (
        <ul className="divide-y divide-[var(--line)]">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onRowClick?.(r.original)} className={cn("block w-full px-4 text-left active:bg-ink-softer", dichte === "compact" ? "py-2" : "py-3")}>
                {mobileRow(r.original)}
              </button>
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
                          className={cn("inline-flex items-center gap-1 hover:text-fg", (h.column.columnDef.meta as { align?: string } | undefined)?.align === "right" && "w-full justify-end")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === "asc" && <ArrowUp className="size-3" />}
                          {h.column.getIsSorted() === "desc" && <ArrowDown className="size-3" />}
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
                            "absolute right-0 top-2 bottom-2 w-[5px] cursor-col-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100",
                            h.column.getIsResizing() ? "bg-ink opacity-100" : "bg-[var(--line-strong)]",
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
              {rows.map((r) => (
                <tr
                  key={r.id}
                  data-selected={r.getIsSelected()}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button,a,input,label")) return;
                    onRowClick?.(r.original);
                  }}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id} style={{ width: c.column.getSize(), maxWidth: c.column.getSize() }} className={cn("truncate", (c.column.columnDef.meta as { align?: string } | undefined)?.align === "right" && "text-right")}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
      className={cn(
        "grid size-[18px] place-items-center rounded-[6px] border transition-all duration-200",
        checked || indeterminate ? "border-transparent bg-ink text-white" : "border-[var(--line-strong)] bg-[var(--surface)] hover:border-ink",
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
      {!checked && indeterminate && <span className="h-0.5 w-2 rounded bg-white" />}
    </button>
  );
}

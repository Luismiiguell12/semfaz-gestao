"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ScrollRegion } from "@/components/shared/scroll-region";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Rótulo exibido nos cartões da versão para celular. */
    label?: string;
    /** Coluna oculta nos cartões (ex.: ações, quando já aparecem no título). */
    hideOnCard?: boolean;
    className?: string;
  }
}

/**
 * Tabela com ordenação e busca. Em telas pequenas, cada linha vira um cartão
 * (sem rolagem horizontal da página).
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Buscar",
  emptyState,
  cardTitle,
  getRowId,
  toolbar,
  tableLabel = "Tabela de registros",
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyState: React.ReactNode;
  /** Conteúdo principal do cartão no celular. */
  cardTitle: (row: TData) => React.ReactNode;
  getRowId?: (row: TData) => string;
  toolbar?: React.ReactNode;
  /** Nome da tabela para leitores de tela (área com rolagem horizontal). */
  tableLabel?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId,
  });
  const rows = table.getRowModel().rows;
  const searchId = React.useId();

  return (
    <div>
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            type="search"
          />
        </div>
        {toolbar}
      </div>

      {rows.length === 0 ? (
        emptyState
      ) : (
        <>
          {/* Desktop e tablet */}
          <ScrollRegion label={tableLabel} className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="bg-surface border-b">
                    {hg.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      const canSort = header.column.getCanSort();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                          }
                          className={cn(
                            "text-muted-foreground px-4 py-2.5 text-left text-xs font-semibold",
                            header.column.columnDef.meta?.className,
                          )}
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === "asc" ? (
                                <ArrowUp className="size-3.5" aria-hidden="true" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface/70 border-b last:border-b-0">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn("px-4 py-3 align-middle", cell.column.columnDef.meta?.className)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>

          {/* Celular: cartões */}
          <ul className="divide-y md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <div className="mb-2">{cardTitle(row.original)}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {row
                    .getVisibleCells()
                    .filter((c) => !c.column.columnDef.meta?.hideOnCard)
                    .map((cell) => (
                      <React.Fragment key={cell.id}>
                        <dt className="text-muted-foreground">
                          {cell.column.columnDef.meta?.label ?? cell.column.id}
                        </dt>
                        <dd className="min-w-0 break-words">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </dd>
                      </React.Fragment>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {rows.length} {rows.length === 1 ? "registro" : "registros"}
      </p>
    </div>
  );
}

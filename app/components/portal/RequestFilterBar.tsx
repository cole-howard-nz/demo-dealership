"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { RequestStatus } from "../../../generated/prisma/client";

const STATUS_OPTIONS: { value: RequestStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "AWAITING_RESPONSE", label: "Awaiting Response" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DECLINED", label: "Declined" },
  { value: "CLOSED", label: "Closed" },
];

interface RequestFilterBarProps {
  totalCount: number;
}

export function RequestFilterBar({ totalCount }: RequestFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) {
          next.set(k, v);
        } else {
          next.delete(k);
        }
      }
      next.delete("page"); // reset page on filter change
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const hasFilters = q || status;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: "#9CA3AF" }}
          aria-hidden="true"
        />
        <input
          type="search"
          defaultValue={q}
          placeholder="Search name or email…"
          onChange={(e) => updateParams({ q: e.target.value })}
          className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2"
          style={{
            borderColor: "#E4E5E8",
            backgroundColor: "#ffffff",
            color: "#13151A",
            // @ts-expect-error custom property
            "--tw-ring-color": "#E15A2C",
          }}
        />
      </div>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="rounded-lg border py-2 pl-3 pr-8 text-sm outline-none focus:ring-2"
        style={{
          borderColor: "#E4E5E8",
          backgroundColor: "#ffffff",
          color: "#13151A",
        }}
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => updateParams({ q: "", status: "" })}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-gray-50"
          style={{ borderColor: "#E4E5E8", color: "#5B5F6B" }}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      )}

      {/* Count */}
      <span className="ml-auto text-sm" style={{ color: "#5B5F6B" }}>
        {totalCount} result{totalCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

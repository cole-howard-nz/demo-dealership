"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { MapPin, ChevronDown } from "lucide-react";
import { bulkUpdateVehicleStatus } from "../../admin/(portal)/inventory/actions";
import type { VehicleStatus } from "../../../generated/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleRow {
  id: string;
  year: number;
  make: string;
  model: string;
  variant: string | null;
  vin: string;
  price: number;
  priceNote: string | null;
  odometerKm: number;
  status: VehicleStatus;
  createdAt: Date;
  location: { name: string };
}

interface InventoryTableProps {
  vehicles: VehicleRow[];
  showLocationColumn: boolean;
  canEdit: boolean;
  canSold: boolean;
  canArchive: boolean;
}

const STATUS_CONFIG: Record<VehicleStatus, { label: string; bg: string; text: string; border: string }> = {
  AVAILABLE: { label: "Available", bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" },
  PENDING:   { label: "Pending",   bg: "#FEF9C3", text: "#854D0E", border: "#FDE047" },
  SOLD:      { label: "Sold",      bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  ARCHIVED:  { label: "Archived",  bg: "#F3F4F6", text: "#9CA3AF", border: "#E5E7EB" },
};

export function InventoryTable({
  vehicles,
  showLocationColumn,
  canEdit,
  canSold,
  canArchive,
}: InventoryTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allIds = vehicles.map((v) => v.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleBulkAction(status: VehicleStatus) {
    setDropdownOpen(false);
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkUpdateVehicleStatus(ids, status);
      if (result.error) {
        setFeedback(result.error);
      } else {
        setFeedback(`${result.updated} vehicle${result.updated !== 1 ? "s" : ""} updated to ${STATUS_CONFIG[status].label}`);
        setSelected(new Set());
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  const showBulkBar = selected.size > 0;
  const bulkOptions: Array<{ status: VehicleStatus; label: string; allowed: boolean }> = (
    [
      { status: "AVAILABLE" as VehicleStatus, label: "Mark Available", allowed: canEdit },
      { status: "PENDING" as VehicleStatus,   label: "Mark Pending",   allowed: canEdit },
      { status: "SOLD" as VehicleStatus,      label: "Mark Sold",      allowed: canSold },
      { status: "ARCHIVED" as VehicleStatus,  label: "Archive",        allowed: canArchive },
    ] as Array<{ status: VehicleStatus; label: string; allowed: boolean }>
  ).filter((o) => o.allowed);

  return (
    <div className="flex flex-col h-full">
      {/* Bulk action bar */}
      {(showBulkBar || feedback) && (
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-2.5 mb-2 rounded-lg border text-sm"
          style={{ borderColor: "#E4E5E8", backgroundColor: "#F9FAFB" }}
        >
          {feedback ? (
            <span style={{ color: "#15803D" }}>{feedback}</span>
          ) : (
            <>
              <span style={{ color: "#5B5F6B" }}>
                {selected.size} selected
              </span>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-50"
                  style={{ borderColor: "#E4E5E8", color: "#13151A" }}
                >
                  Update Status
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {dropdownOpen && (
                  <div
                    className="absolute top-full left-0 mt-1 z-20 w-40 rounded-lg border bg-white shadow-lg overflow-hidden"
                    style={{ borderColor: "#E4E5E8" }}
                  >
                    {bulkOptions.map((opt) => (
                      <button
                        key={opt.status}
                        onClick={() => handleBulkAction(opt.status)}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={{ color: "#13151A" }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs hover:underline ml-auto"
                style={{ color: "#9CA3AF" }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col" style={{ borderColor: "#E4E5E8" }}>
        {vehicles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "#5B5F6B" }}>No vehicles match your filters.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr style={{ borderBottom: "1px solid #E4E5E8", backgroundColor: "#F9FAFB" }}>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border"
                      style={{ accentColor: "#E15A2C" }}
                      aria-label="Select all"
                    />
                  </th>
                  {["Vehicle", "Price", "Odometer", "Status", ...(showLocationColumn ? ["Location"] : []), "Added"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#5B5F6B" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const sc = STATUS_CONFIG[v.status];
                  const isChecked = selected.has(v.id);
                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        backgroundColor: isChecked ? "#FFF7F5" : undefined,
                      }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(v.id)}
                          className="h-4 w-4 rounded border"
                          style={{ accentColor: "#E15A2C" }}
                          aria-label={`Select ${v.year} ${v.make} ${v.model}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/inventory/${v.id}`} className="block hover:underline">
                          <span className="font-semibold" style={{ color: "#13151A" }}>
                            {v.year} {v.make} {v.model}
                          </span>
                          {v.variant && (
                            <span className="ml-1" style={{ color: "#5B5F6B" }}>{v.variant}</span>
                          )}
                          <span className="block text-xs mt-0.5 font-mono" style={{ color: "#9CA3AF" }}>
                            VIN: {v.vin}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "#13151A" }}>
                        ${v.price.toLocaleString()}
                        {v.priceNote && (
                          <span className="block text-xs font-normal" style={{ color: "#9CA3AF" }}>{v.priceNote}</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: "#5B5F6B" }}>
                        {v.odometerKm.toLocaleString()} km
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                          style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}
                        >
                          {sc.label}
                        </span>
                      </td>
                      {showLocationColumn && (
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs" style={{ color: "#5B5F6B" }}>
                            <MapPin className="h-3 w-3 shrink-0" style={{ color: "#E15A2C" }} aria-hidden="true" />
                            {v.location.name}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs" style={{ color: "#9CA3AF" }}>
                        {format(v.createdAt, "d MMM yyyy")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

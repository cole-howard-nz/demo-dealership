"use client";

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import type { VehicleStatus } from "../../../generated/prisma/client";

const STATUS_CONFIG: Record<VehicleStatus, { label: string; bg: string; text: string; border: string }> = {
  AVAILABLE: { label: "Available", bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" },
  PENDING:   { label: "Pending",   bg: "#FEF9C3", text: "#854D0E", border: "#FDE047" },
  SOLD:      { label: "Sold",      bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  ARCHIVED:  { label: "Archived",  bg: "#F3F4F6", text: "#9CA3AF", border: "#E5E7EB" },
};

interface VehicleStatusWidgetProps {
  vehicleId: string;
  currentStatus: VehicleStatus;
  canEdit: boolean;
  canSold: boolean;
  canArchive: boolean;
  updateAction: (id: string, status: VehicleStatus) => Promise<{ error: string | null }>;
}

export function VehicleStatusWidget({
  vehicleId,
  currentStatus,
  canEdit,
  canSold,
  canArchive,
  updateAction,
}: VehicleStatusWidgetProps) {
  const [status, setStatus] = useState<VehicleStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sc = STATUS_CONFIG[status];

  function handleChange(newStatus: VehicleStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateAction(vehicleId, newStatus);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus(newStatus);
      }
    });
  }

  const canChangeTo = (s: VehicleStatus): boolean => {
    if (s === status) return false;
    if (s === "SOLD" && !canSold) return false;
    if (s === "ARCHIVED" && !canArchive) return false;
    if (!canEdit) return false;
    return true;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
          style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}
        >
          {sc.label}
        </span>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "#5B5F6B" }} aria-hidden="true" />}
      </div>

      {(canEdit || canSold || canArchive) && (
        <div className="flex flex-wrap gap-2">
          {(["AVAILABLE", "PENDING", "SOLD", "ARCHIVED"] as VehicleStatus[]).map((s) => {
            const enabled = canChangeTo(s);
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                disabled={!enabled || isPending}
                onClick={() => handleChange(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-opacity disabled:opacity-40"
                style={{
                  backgroundColor: enabled ? cfg.bg : "#F9FAFB",
                  color: enabled ? cfg.text : "#9CA3AF",
                  borderColor: enabled ? cfg.border : "#E4E5E8",
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs" style={{ color: "#DC2626" }}>{error}</p>
      )}
    </div>
  );
}

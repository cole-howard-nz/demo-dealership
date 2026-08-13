"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { RequestStatus } from "../../../generated/prisma/client";

const STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In Progress",
  AWAITING_RESPONSE: "Awaiting Response",
  RESOLVED: "Resolved",
  DECLINED: "Declined",
  CLOSED: "Closed",
};

interface StatusSelectProps {
  currentStatus: RequestStatus;
  requestId: string;
  entityType: "ContactRequest" | "TradeInRequest" | "FinanceApplication" | "TestDriveBooking";
  updateAction: (
    entityType: string,
    id: string,
    status: RequestStatus
  ) => Promise<{ error: string | null }>;
  canUpdate: boolean;
}

export function StatusSelect({
  currentStatus,
  requestId,
  entityType,
  updateAction,
  canUpdate,
}: StatusSelectProps) {
  const [isPending, startTransition] = useTransition();

  if (!canUpdate) {
    return (
      <span className="text-sm font-medium" style={{ color: "#13151A" }}>
        {STATUS_LABELS[currentStatus]}
      </span>
    );
  }

  return (
    <div className="relative">
      <select
        defaultValue={currentStatus}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as RequestStatus;
          startTransition(async () => {
            await updateAction(entityType, requestId, next);
          });
        }}
        className="w-full rounded-lg border py-2 pl-3 pr-8 text-sm appearance-none outline-none focus:ring-2 disabled:opacity-60"
        style={{
          borderColor: "#E4E5E8",
          backgroundColor: "#ffffff",
          color: "#13151A",
        }}
        aria-label="Change status"
      >
        {(Object.keys(STATUS_LABELS) as RequestStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {isPending && (
        <Loader2
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin"
          style={{ color: "#E15A2C" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

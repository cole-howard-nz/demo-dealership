import type { RequestStatus } from "../../../generated/prisma/client";

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  NEW: {
    label: "New",
    bg: "#E15A2C",
    text: "#ffffff",
    border: "#C44D22",
  },
  IN_PROGRESS: {
    label: "In Progress",
    bg: "#142036",
    text: "#ffffff",
    border: "#0d1827",
  },
  AWAITING_RESPONSE: {
    label: "Awaiting Response",
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FCD34D",
  },
  RESOLVED: {
    label: "Resolved",
    bg: "#F3F4F6",
    text: "#6B7280",
    border: "#E5E7EB",
  },
  DECLINED: {
    label: "Declined",
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
  },
  CLOSED: {
    label: "Closed",
    bg: "#F3F4F6",
    text: "#6B7280",
    border: "#E5E7EB",
  },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border"
      style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

export { STATUS_CONFIG };
export type { RequestStatus };

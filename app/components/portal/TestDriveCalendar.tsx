"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RequestStatus } from "../../../generated/prisma/client";

interface CalendarBooking {
  id: string;
  name: string;
  preferredDate: string;
  preferredTime: string | null;
  status: RequestStatus;
  vehicle: { year: number; make: string; model: string } | null;
}

const TIME_SHORT: Record<string, string> = {
  Morning:   "AM",
  Afternoon: "PM",
  Evening:   "Late PM",
};

const STATUS_CHIP: Record<RequestStatus, { bg: string; text: string }> = {
  NEW:               { bg: "#FFF1EC", text: "#C2410C" },
  IN_PROGRESS:       { bg: "#EFF6FF", text: "#1D4ED8" },
  AWAITING_RESPONSE: { bg: "#FEFCE8", text: "#92400E" },
  RESOLVED:          { bg: "#F0FDF4", text: "#15803D" },
  DECLINED:          { bg: "#FEF2F2", text: "#B91C1C" },
  CLOSED:            { bg: "#F3F4F6", text: "#6B7280" },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  bookings: CalendarBooking[];
  year: number;
  month: number; // 0-indexed
}

export function TestDriveCalendar({ bookings, year, month }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navMonth(delta: number) {
    let y = year;
    let m = month + delta;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", "calendar");
    next.set("month", `${y}-${String(m + 1).padStart(2, "0")}`);
    router.push(`${pathname}?${next.toString()}`);
  }

  // Build calendar grid
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Group bookings by date string
  const byDate = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const arr = byDate.get(b.preferredDate) ?? [];
    arr.push(b);
    byDate.set(b.preferredDate, arr);
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navMonth(-1)}
          className="p-2 rounded-lg border hover:bg-gray-50 transition-colors"
          style={{ borderColor: "#E4E5E8" }}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "#5B5F6B" }} />
        </button>
        <span className="font-heading font-bold text-base" style={{ color: "#13151A" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={() => navMonth(1)}
          className="p-2 rounded-lg border hover:bg-gray-50 transition-colors"
          style={{ borderColor: "#E4E5E8" }}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" style={{ color: "#5B5F6B" }} />
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E4E5E8" }}>
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "#E4E5E8", backgroundColor: "#F9FAFB" }}>
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#9CA3AF" }}
            >
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid grid-cols-7"
            style={{ borderBottom: wi < weeks.length - 1 ? "1px solid #F3F4F6" : undefined }}
          >
            {week.map((day, di) => {
              const borderRight = di < 6 ? "1px solid #F3F4F6" : undefined;

              if (day === null) {
                return (
                  <div
                    key={di}
                    className="min-h-[96px]"
                    style={{ backgroundColor: "#FAFAFA", borderRight }}
                  />
                );
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayBookings = byDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const visible = dayBookings.slice(0, 3);
              const extra = dayBookings.length - visible.length;

              return (
                <div
                  key={di}
                  className="min-h-[96px] p-1.5 flex flex-col gap-1"
                  style={{ backgroundColor: isToday ? "#FFF7F5" : "#ffffff", borderRight }}
                >
                  <span
                    className="text-xs font-semibold self-start h-5 w-5 flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isToday ? "#E15A2C" : "transparent",
                      color: isToday ? "#ffffff" : "#5B5F6B",
                    }}
                  >
                    {day}
                  </span>
                  {visible.map((b) => {
                    const sc = STATUS_CHIP[b.status];
                    return (
                      <Link
                        key={b.id}
                        href={`/admin/requests/test-drive/${b.id}`}
                        className="block rounded px-1.5 py-0.5 text-xs leading-snug truncate hover:opacity-75 transition-opacity"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                        title={[
                          b.name,
                          b.preferredTime,
                          b.vehicle ? `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}` : null,
                        ].filter(Boolean).join(" · ")}
                      >
                        {b.preferredTime && (
                          <span className="font-medium">{TIME_SHORT[b.preferredTime] ?? b.preferredTime} · </span>
                        )}
                        {b.name}
                      </Link>
                    );
                  })}
                  {extra > 0 && (
                    <span className="text-xs pl-0.5" style={{ color: "#9CA3AF" }}>
                      +{extra} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

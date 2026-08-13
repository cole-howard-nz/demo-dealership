import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "../../../../lib/auth-helpers";
import { hasPermission } from "../../../../lib/permissions";
import { prisma } from "../../../../lib/prisma";
import { StatusBadge } from "../../../../components/portal/StatusBadge";
import { RequestFilterBar } from "../../../../components/portal/RequestFilterBar";
import { TestDriveCalendar } from "../../../../components/portal/TestDriveCalendar";
import { ViewToggle } from "../../../../components/portal/ViewToggle";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RequestStatus, Prisma } from "../../../../../generated/prisma/client";

export const metadata: Metadata = {
  title: "Test Drive Bookings — Northbridge Motors Staff Portal",
};

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    loc?: string;
    page?: string;
    q?: string;
    status?: string;
    view?: string;
    month?: string;
  }>;
}

export default async function TestDriveBookingsPage({ searchParams }: PageProps) {
  const session = await requirePermission("testdrive.view");
  const { loc, page = "1", q, status, view, month } = await searchParams;

  const isCalendar = view === "calendar";

  const permissions = session.user.role.permissions;
  const hasViewAll = hasPermission(permissions, "locations.viewall");
  const userLocationIds = session.user.locations.map((l) => l.id);

  let locationFilter: Prisma.TestDriveBookingWhereInput["locationId"];
  if (hasViewAll) {
    locationFilter = loc && loc !== "all" ? loc : undefined;
  } else {
    const allowed =
      loc && loc !== "all" && userLocationIds.includes(loc) ? [loc] : userLocationIds;
    locationFilter = { in: allowed };
  }

  const showLocationColumn = !loc || loc === "all";

  const where: Prisma.TestDriveBookingWhereInput = {
    locationId: locationFilter,
    ...(status ? { status: status as RequestStatus } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // ── Calendar mode ───────────────────────────────────────────────────────────

  let calYear: number;
  let calMonth: number; // 0-indexed

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    calYear = y;
    calMonth = m - 1;
  } else {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }

  const startDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
  const endDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [calBookings, listTotal, listBookings] = await Promise.all([
    isCalendar
      ? prisma.testDriveBooking.findMany({
          where: { ...where, preferredDate: { gte: startDate, lte: endDate } },
          select: {
            id: true,
            name: true,
            preferredDate: true,
            preferredTime: true,
            status: true,
            vehicle: { select: { year: true, make: true, model: true } },
          },
          orderBy: [{ preferredDate: "asc" }, { preferredTime: "asc" }],
        })
      : Promise.resolve([]),

    !isCalendar
      ? prisma.testDriveBooking.count({ where })
      : Promise.resolve(0),

    !isCalendar
      ? prisma.testDriveBooking.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (Math.max(1, parseInt(page, 10) || 1) - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            preferredDate: true,
            preferredTime: true,
            status: true,
            createdAt: true,
            vehicle: { select: { year: true, make: true, model: true } },
            assignedTo: { select: { name: true } },
            location: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));

  const displayTotal = isCalendar ? calBookings.length : listTotal;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: "#13151A" }}>
            Test Drive Bookings
          </h1>
          <p className="text-sm mt-1" style={{ color: "#5B5F6B" }}>
            Customer test drive scheduling requests
          </p>
        </div>
        <ViewToggle currentView={isCalendar ? "calendar" : "list"} />
      </div>

      {/* ── Calendar view ─────────────────────────────────────────────────────── */}
      {isCalendar ? (
        <div>
          <div
            className="rounded-xl border bg-white shadow-sm p-4 mb-4"
            style={{ borderColor: "#E4E5E8" }}
          >
            <RequestFilterBar totalCount={displayTotal} />
          </div>
          <TestDriveCalendar
            bookings={calBookings}
            year={calYear}
            month={calMonth}
          />
        </div>
      ) : (
        /* ── List view ────────────────────────────────────────────────────────── */
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: "#E4E5E8" }}>
          <div className="p-4 border-b" style={{ borderColor: "#E4E5E8" }}>
            <RequestFilterBar totalCount={displayTotal} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#F9FAFB" }}>
                  {["Name", "Vehicle", "Preferred Date", "Time", "Status", "Received", "Assigned"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#5B5F6B" }}
                    >
                      {h}
                    </th>
                  ))}
                  {showLocationColumn && (
                    <th
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#5B5F6B" }}
                    >
                      Location
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#E4E5E8" }}>
                {listBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showLocationColumn ? 8 : 7}
                      className="px-4 py-12 text-center text-sm"
                      style={{ color: "#9CA3AF" }}
                    >
                      No test drive bookings found
                    </td>
                  </tr>
                ) : (
                  listBookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      style={
                        b.status === "NEW"
                          ? { borderLeft: "3px solid #E15A2C" }
                          : { borderLeft: "3px solid transparent" }
                      }
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/requests/test-drive/${b.id}`}
                          className="font-semibold hover:underline"
                          style={{ color: "#13151A" }}
                        >
                          {b.name}
                        </Link>
                        <span className="block text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{b.email}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "#5B5F6B" }}>
                        {b.vehicle
                          ? `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}`
                          : <span style={{ color: "#D1D5DB" }}>Not specified</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                        {b.preferredDate}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                        {b.preferredTime}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9CA3AF" }}>
                        {formatDistanceToNow(b.createdAt, { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                        {b.assignedTo?.name ?? <span style={{ color: "#D1D5DB" }}>—</span>}
                      </td>
                      {showLocationColumn && (
                        <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9CA3AF" }}>
                          {b.location.name}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-3 border-t text-sm"
              style={{ borderColor: "#E4E5E8", color: "#5B5F6B" }}
            >
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                {currentPage > 1 && (
                  <Link
                    href={`/admin/requests/test-drive?page=${currentPage - 1}${loc ? `&loc=${loc}` : ""}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                    className="flex items-center rounded-md border px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: "#E4E5E8" }}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Prev
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/admin/requests/test-drive?page=${currentPage + 1}${loc ? `&loc=${loc}` : ""}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                    className="flex items-center rounded-md border px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: "#E4E5E8" }}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

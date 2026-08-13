import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "../../../../lib/auth-helpers";
import { hasPermission } from "../../../../lib/permissions";
import { prisma } from "../../../../lib/prisma";
import { StatusBadge } from "../../../../components/portal/StatusBadge";
import { RequestFilterBar } from "../../../../components/portal/RequestFilterBar";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RequestStatus, Prisma } from "../../../../../generated/prisma/client";

export const metadata: Metadata = {
  title: "Trade-In Requests — Northbridge Motors Staff Portal",
};

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    loc?: string;
    page?: string;
    q?: string;
    status?: string;
  }>;
}

export default async function TradeInRequestsPage({ searchParams }: PageProps) {
  const session = await requirePermission("tradein.view");
  const { loc, page = "1", q, status } = await searchParams;

  const permissions = session.user.role.permissions;
  const hasViewAll = hasPermission(permissions, "locations.viewall");
  const userLocationIds = session.user.locations.map((l) => l.id);

  let locationFilter: Prisma.TradeInRequestWhereInput["locationId"];
  if (hasViewAll) {
    locationFilter = loc && loc !== "all" ? loc : undefined;
  } else {
    const allowed =
      loc && loc !== "all" && userLocationIds.includes(loc)
        ? [loc]
        : userLocationIds;
    locationFilter = { in: allowed };
  }

  const showLocationColumn = !loc || loc === "all";

  const where: Prisma.TradeInRequestWhereInput = {
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

  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const [total, requests] = await Promise.all([
    prisma.tradeInRequest.count({ where }),
    prisma.tradeInRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        vehicleMake: true,
        vehicleModel: true,
        vehicleYear: true,
        odometerKm: true,
        condition: true,
        isModified: true,
        estimatedValue: true,
        status: true,
        createdAt: true,
        assignedTo: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold" style={{ color: "#13151A" }}>
          Trade-In Requests
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5B5F6B" }}>
          Vehicle trade-in valuations from the public site
        </p>
      </div>

      <div
        className="rounded-xl border bg-white shadow-sm overflow-hidden"
        style={{ borderColor: "#E4E5E8" }}
      >
        <div className="p-4 border-b" style={{ borderColor: "#E4E5E8" }}>
          <RequestFilterBar totalCount={total} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#F9FAFB" }}>
                {[
                  "Name",
                  "Vehicle",
                  "Year",
                  "Odometer",
                  "Condition",
                  "Modified",
                  "Est. Value",
                  "Status",
                  "Received",
                  "Assigned",
                ].map((h) => (
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
              {requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={showLocationColumn ? 11 : 10}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: "#9CA3AF" }}
                  >
                    No trade-in requests found
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={
                      req.status === "NEW"
                        ? { borderLeft: "3px solid #E15A2C" }
                        : { borderLeft: "3px solid transparent" }
                    }
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/requests/trade-in/${req.id}`}
                        className="font-semibold hover:underline"
                        style={{ color: "#13151A" }}
                      >
                        {req.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {req.vehicleMake} {req.vehicleModel}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {req.vehicleYear}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {req.odometerKm.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {req.condition}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {req.isModified ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: "#D1D5DB" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-medium"
                      style={{ color: req.estimatedValue ? "#1F9D55" : "#9CA3AF" }}>
                      {req.estimatedValue
                        ? `$${req.estimatedValue.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9CA3AF" }}>
                      {formatDistanceToNow(req.createdAt, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {req.assignedTo?.name ?? (
                        <span style={{ color: "#D1D5DB" }}>—</span>
                      )}
                    </td>
                    {showLocationColumn && (
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9CA3AF" }}>
                        {req.location.name}
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
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              {currentPage > 1 && (
                <Link
                  href={`/admin/requests/trade-in?page=${currentPage - 1}${loc ? `&loc=${loc}` : ""}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                  className="flex items-center rounded-md border px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  style={{ borderColor: "#E4E5E8" }}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Prev
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={`/admin/requests/trade-in?page=${currentPage + 1}${loc ? `&loc=${loc}` : ""}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
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
    </div>
  );
}


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
  title: "Finance Applications — Northbridge Motors Staff Portal",
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

export default async function FinanceApplicationsPage({ searchParams }: PageProps) {
  const session = await requirePermission("finance.view");
  const { loc, page = "1", q, status } = await searchParams;

  const permissions = session.user.role.permissions;
  const hasViewAll = hasPermission(permissions, "locations.viewall");
  const userLocationIds = session.user.locations.map((l) => l.id);

  let locationFilter: Prisma.FinanceApplicationWhereInput["locationId"];
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

  const where: Prisma.FinanceApplicationWhereInput = {
    locationId: locationFilter,
    ...(status ? { status: status as RequestStatus } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const [total, applications] = await Promise.all([
    prisma.financeApplication.count({ where }),
    prisma.financeApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        desiredLoanAmount: true,
        termMonths: true,
        employmentStatus: true,
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
          Finance Applications
        </h1>
        <p className="text-sm mt-1" style={{ color: "#5B5F6B" }}>
          Finance applications from the public site
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
                  "Loan Amount",
                  "Term",
                  "Employment",
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
              {applications.length === 0 ? (
                <tr>
                  <td
                    colSpan={showLocationColumn ? 8 : 7}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: "#9CA3AF" }}
                  >
                    No finance applications found
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={
                      app.status === "NEW"
                        ? { borderLeft: "3px solid #E15A2C" }
                        : { borderLeft: "3px solid transparent" }
                    }
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/requests/finance/${app.id}`}
                        className="font-semibold hover:underline"
                        style={{ color: "#13151A" }}
                      >
                        {app.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: "#13151A" }}>
                      ${app.desiredLoanAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {app.termMonths} mo
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {app.employmentStatus}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9CA3AF" }}>
                      {formatDistanceToNow(app.createdAt, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#5B5F6B" }}>
                      {app.assignedTo?.name ?? (
                        <span style={{ color: "#D1D5DB" }}>—</span>
                      )}
                    </td>
                    {showLocationColumn && (
                      <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9CA3AF" }}>
                        {app.location.name}
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
                  href={`/admin/requests/finance?page=${currentPage - 1}${loc ? `&loc=${loc}` : ""}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                  className="flex items-center rounded-md border px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  style={{ borderColor: "#E4E5E8" }}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Prev
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  href={`/admin/requests/finance?page=${currentPage + 1}${loc ? `&loc=${loc}` : ""}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
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


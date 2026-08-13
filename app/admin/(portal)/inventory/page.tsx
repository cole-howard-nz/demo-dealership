import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "../../../lib/auth-helpers";
import { hasPermission } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";
import { Package, Plus, Download } from "lucide-react";
import type { VehicleStatus } from "../../../../generated/prisma/client";
import { InventoryFilters } from "./InventoryFilters";
import { InventoryTable } from "../../../components/portal/InventoryTable";

export const metadata: Metadata = {
  title: "Inventory — Northbridge Motors Staff Portal",
};

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{
    loc?: string;
    page?: string;
    q?: string;
    status?: string;
  }>;
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await requirePermission("inventory.view");

  const permissions = session.user.role.permissions;
  const hasViewAll = hasPermission(permissions, "locations.viewall");
  const userLocationIds = session.user.locations.map((l) => l.id);

  const activeLoc = sp.loc && sp.loc !== "all" ? sp.loc : undefined;
  const locationFilter = activeLoc
    ? { in: [activeLoc] }
    : hasViewAll
    ? undefined
    : { in: userLocationIds };

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status as VehicleStatus | undefined;

  const where = {
    ...(locationFilter ? { locationId: locationFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { make: { contains: q, mode: "insensitive" as const } },
            { model: { contains: q, mode: "insensitive" as const } },
            { variant: { contains: q, mode: "insensitive" as const } },
            { vin: { contains: q, mode: "insensitive" as const } },
            { colour: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { location: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vehicle.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showLocationColumn = !activeLoc;
  const canCreate = hasPermission(permissions, "inventory.create");
  const canEdit = hasPermission(permissions, "inventory.edit");
  const canSold = hasPermission(permissions, "inventory.sold");
  const canArchive = hasPermission(permissions, "inventory.archive");

  // Build export URL preserving current location filter
  const exportParams = new URLSearchParams();
  if (activeLoc) exportParams.set("loc", activeLoc);
  const exportUrl = `/api/portal/inventory/export?${exportParams.toString()}`;

  function buildUrl(params: Record<string, string | undefined>) {
    const merged = { loc: sp.loc, q: sp.q, status: sp.status, page: sp.page, ...params };
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "") search.set(k, v);
    }
    return `/admin/inventory?${search.toString()}`;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 shrink-0">
        <div>
          <h1 className="font-heading text-2xl font-bold" style={{ color: "#13151A" }}>
            Inventory
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#5B5F6B" }}>
            {total} vehicle{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ borderColor: "#E4E5E8", color: "#5B5F6B" }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </a>
          {canCreate && (
            <Link
              href="/admin/inventory/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: "#142036" }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Vehicle
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <InventoryFilters currentQ={q} currentStatus={statusFilter ?? ""} />

      {/* Table */}
      {vehicles.length === 0 ? (
        <div
          className="flex-1 min-h-0 rounded-xl border bg-white shadow-sm py-16 text-center"
          style={{ borderColor: "#E4E5E8" }}
        >
          <Package className="h-10 w-10 mx-auto mb-3 opacity-20" style={{ color: "#5B5F6B" }} />
          <p className="text-sm" style={{ color: "#5B5F6B" }}>
            {q || statusFilter
              ? "No vehicles match your filters."
              : "No vehicles yet. Add your first vehicle to get started."}
          </p>
          {canCreate && !q && !statusFilter && (
            <Link
              href="/admin/inventory/new"
              className="mt-3 inline-block text-sm font-medium hover:underline"
              style={{ color: "#E15A2C" }}
            >
              Add Vehicle
            </Link>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <InventoryTable
            vehicles={vehicles}
            showLocationColumn={showLocationColumn}
            canEdit={canEdit}
            canSold={canSold}
            canArchive={canArchive}
          />
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm shrink-0" style={{ color: "#5B5F6B" }}>
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: "#E4E5E8" }}
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="px-3 py-1.5 rounded-lg border text-sm"
                style={{ borderColor: "#E4E5E8" }}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { del } from "@vercel/blob";
import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth-helpers";
import { hasPermission } from "../../../lib/permissions";
import { logAction } from "../../../lib/auth-helpers";
import type { VehicleStatus } from "../../../../generated/prisma/client";
import {
  BODY_TYPES,
  TRANSMISSIONS,
  FUEL_TYPES,
  DRIVE_TYPES,
  IMPORT_STATUSES,
  CONDITIONS,
  PRICE_NOTES,
} from "../../../lib/vehicle-constants";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const vehicleSchema = z.object({
  make: z.string().min(1, "Make is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  variant: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1960).max(2030),
  bodyType: z.enum(BODY_TYPES),
  price: z.coerce.number().int().min(0).max(10_000_000),
  priceNote: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(PRICE_NOTES).optional()
  ),
  odometerKm: z.coerce.number().int().min(0).max(10_000_000),
  transmission: z.enum(TRANSMISSIONS),
  fuelType: z.enum(FUEL_TYPES),
  engineSizeCc: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(0).max(20_000).optional()
  ),
  driveType: z.enum(DRIVE_TYPES),
  colour: z.string().min(1, "Colour is required").max(100),
  doors: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(10).optional()
  ),
  seats: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(20).optional()
  ),
  vin: z.string().min(5, "VIN is required").max(50),
  importStatus: z.enum(IMPORT_STATUSES),
  condition: z.enum(CONDITIONS),
  features: z.string().max(5000).optional(),
  images: z.string().max(100000).optional(),
  description: z.string().min(1, "Description is required").max(10000),
  status: z.enum(["AVAILABLE", "PENDING", "SOLD", "ARCHIVED"]),
  financeEligible: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  inspectionReportUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional()
  ),
  locationId: z.string().min(1, "Location is required"),
  purchasePriceCents: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(0).max(10_000_000).optional()
  ),
  reconditioningCostCents: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(0).max(10_000_000).optional()
  ),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(year: number, make: string, model: string, variant?: string): string {
  const parts = [year.toString(), make, model, variant].filter(Boolean);
  const base = parts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function parseImages(raw: string | undefined, year: number, make: string, model: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ url: string }>;
    return parsed
      .filter((img) => typeof img.url === "string" && img.url.startsWith("http"))
      .map((img, i) => ({
        url: img.url,
        alt: `${year} ${make} ${model} — image ${i + 1}`,
        order: i + 1,
      }));
  } catch {
    // Fallback: legacy newline-separated URLs
    return raw.split("\n").map(s => s.trim()).filter(Boolean).map((url, i) => ({
      url,
      alt: `${year} ${make} ${model} — image ${i + 1}`,
      order: i + 1,
    }));
  }
}

function parseFeatures(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split("\n").map(s => s.trim()).filter(Boolean);
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// ─── Location access helper ───────────────────────────────────────────────────

async function assertInventoryLocationAccess(
  locationId: string,
  userLocationIds: string[],
  hasViewAll: boolean
): Promise<string | null> {
  if (!hasViewAll && !userLocationIds.includes(locationId)) return "Access denied.";
  return null;
}

// ─── Create vehicle ───────────────────────────────────────────────────────────

export async function createVehicle(
  formData: FormData
): Promise<{ error: string }> {
  const session = await requirePermission("inventory.create");

  const raw = Object.fromEntries(formData.entries());
  const parsed = vehicleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { features: featuresRaw, images: imagesRaw, ...data } = parsed.data;

  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");
  const locationIds = session.user.locations.map((l) => l.id);
  const accessError = await assertInventoryLocationAccess(data.locationId, locationIds, hasViewAll);
  if (accessError) return { error: accessError };

  const existing = await prisma.vehicle.findUnique({ where: { vin: data.vin }, select: { id: true } });
  if (existing) return { error: "A vehicle with this VIN already exists." };

  const slug = generateSlug(data.year, data.make, data.model, data.variant);
  const features = parseFeatures(featuresRaw);
  const images = parseImages(imagesRaw, data.year, data.make, data.model);

  const vehicle = await prisma.vehicle.create({
    data: {
      ...data,
      slug,
      features,
      images,
      variant: data.variant ?? null,
      priceNote: data.priceNote ?? null,
      engineSizeCc: data.engineSizeCc ?? null,
      doors: data.doors ?? null,
      seats: data.seats ?? null,
      inspectionReportUrl: data.inspectionReportUrl ?? null,
      purchasePriceCents: data.purchasePriceCents ?? null,
      reconditioningCostCents: data.reconditioningCostCents ?? null,
    },
  });

  await logAction({
    actorId: session.user.id,
    action: "VEHICLE_CREATED",
    entityType: "Vehicle",
    entityId: vehicle.id,
    locationId: vehicle.locationId,
    metadata: { make: vehicle.make, model: vehicle.model, year: vehicle.year, vin: vehicle.vin },
  });

  revalidatePath("/admin/inventory");
  redirect(`/admin/inventory/${vehicle.id}`);
}

// ─── Update vehicle ───────────────────────────────────────────────────────────

export async function updateVehicle(
  id: string,
  formData: FormData
): Promise<{ error: string | null }> {
  const session = await requirePermission("inventory.edit");

  const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { locationId: true, vin: true, images: true, price: true } });
  if (!vehicle) return { error: "Vehicle not found." };

  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");
  const locationIds = session.user.locations.map((l) => l.id);
  const accessError = await assertInventoryLocationAccess(vehicle.locationId, locationIds, hasViewAll);
  if (accessError) return { error: accessError };

  const raw = Object.fromEntries(formData.entries());
  const parsed = vehicleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { features: featuresRaw, images: imagesRaw, ...data } = parsed.data;

  // If VIN changed, check uniqueness
  if (data.vin !== vehicle.vin) {
    const conflict = await prisma.vehicle.findUnique({ where: { vin: data.vin }, select: { id: true } });
    if (conflict && conflict.id !== id) return { error: "A vehicle with this VIN already exists." };
  }

  const features = parseFeatures(featuresRaw);
  const images = parseImages(imagesRaw, data.year, data.make, data.model);

  // Collect Blob URLs that are being removed so we can clean them up after saving
  const oldImages = Array.isArray(vehicle.images)
    ? (vehicle.images as Array<{ url: string }>)
    : [];
  const newUrlSet = new Set(images.map((img) => img.url));
  const blobsToDelete = oldImages
    .map((img) => img.url)
    .filter((url) => isBlobUrl(url) && !newUrlSet.has(url));

  await prisma.vehicle.update({
    where: { id },
    data: {
      ...data,
      features,
      images,
      variant: data.variant ?? null,
      priceNote: data.priceNote ?? null,
      engineSizeCc: data.engineSizeCc ?? null,
      doors: data.doors ?? null,
      seats: data.seats ?? null,
      inspectionReportUrl: data.inspectionReportUrl ?? null,
      purchasePriceCents: data.purchasePriceCents ?? null,
      reconditioningCostCents: data.reconditioningCostCents ?? null,
    },
  });

  // Log price change if it occurred
  if (data.price !== vehicle.price) {
    await prisma.priceHistory.create({
      data: {
        vehicleId: id,
        oldPrice: vehicle.price,
        newPrice: data.price,
        changedById: session.user.id,
      },
    });
  }

  // Delete removed Blob images after the DB is committed (best-effort)
  if (blobsToDelete.length > 0) {
    await del(blobsToDelete).catch(() => {});
  }

  await logAction({
    actorId: session.user.id,
    action: "VEHICLE_UPDATED",
    entityType: "Vehicle",
    entityId: id,
    locationId: data.locationId,
  });

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/${id}`);

  return { error: null };
}

// ─── Update vehicle status ────────────────────────────────────────────────────

const statusSchema = z.enum(["AVAILABLE", "PENDING", "SOLD", "ARCHIVED"]);

export async function updateVehicleStatus(
  id: string,
  newStatus: VehicleStatus
): Promise<{ error: string | null }> {
  const parsed = statusSchema.safeParse(newStatus);
  if (!parsed.success) return { error: "Invalid status." };

  // Permission: SOLD requires inventory.sold, ARCHIVED requires inventory.archive
  const neededPermission =
    newStatus === "SOLD"
      ? "inventory.sold"
      : newStatus === "ARCHIVED"
      ? "inventory.archive"
      : "inventory.edit";

  const session = await requirePermission(neededPermission);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { locationId: true, status: true },
  });
  if (!vehicle) return { error: "Vehicle not found." };

  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");
  const locationIds = session.user.locations.map((l) => l.id);
  const accessError = await assertInventoryLocationAccess(vehicle.locationId, locationIds, hasViewAll);
  if (accessError) return { error: accessError };

  await prisma.vehicle.update({ where: { id }, data: { status: parsed.data } });

  await logAction({
    actorId: session.user.id,
    action: "VEHICLE_STATUS_CHANGED",
    entityType: "Vehicle",
    entityId: id,
    locationId: vehicle.locationId,
    metadata: { from: vehicle.status, to: parsed.data },
  });

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/${id}`);

  return { error: null };
}

// ─── Bulk update vehicle status ───────────────────────────────────────────────

export async function bulkUpdateVehicleStatus(
  ids: string[],
  newStatus: VehicleStatus
): Promise<{ error: string | null; updated: number }> {
  if (!ids.length) return { error: "No vehicles selected.", updated: 0 };

  const parsed = statusSchema.safeParse(newStatus);
  if (!parsed.success) return { error: "Invalid status.", updated: 0 };

  const neededPermission =
    newStatus === "SOLD"
      ? "inventory.sold"
      : newStatus === "ARCHIVED"
      ? "inventory.archive"
      : "inventory.edit";

  const session = await requirePermission(neededPermission);

  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");
  const locationIds = session.user.locations.map((l) => l.id);
  const locationFilter = hasViewAll ? {} : { locationId: { in: locationIds } };

  const result = await prisma.vehicle.updateMany({
    where: { id: { in: ids }, ...locationFilter },
    data: { status: parsed.data },
  });

  await logAction({
    actorId: session.user.id,
    action: "VEHICLE_BULK_STATUS_CHANGED",
    entityType: "Vehicle",
    entityId: ids.join(","),
    metadata: { to: parsed.data, count: result.count },
  });

  revalidatePath("/admin/inventory");

  return { error: null, updated: result.count };
}

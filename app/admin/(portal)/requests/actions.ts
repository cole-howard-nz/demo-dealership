"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { requireAuth, requirePermission, logAction } from "../../../lib/auth-helpers";
import { hasPermission } from "../../../lib/permissions";
import type { RequestStatus } from "../../../../generated/prisma/client";

// ─── Shared return type ───────────────────────────────────────────────────────

interface ActionResult {
  error: string | null;
}

// ─── Entity type → table mapping ──────────────────────────────────────────────

type EntityType = "ContactRequest" | "TradeInRequest" | "FinanceApplication" | "TestDriveBooking";

const ENTITY_META: Record<
  EntityType,
  {
    viewPermission: "contact.view" | "tradein.view" | "finance.view" | "testdrive.view";
    updatePermission: "contact.update" | "tradein.update" | "finance.update" | "testdrive.update";
    revalidatePath: string;
    findUnique: (id: string) => Promise<{ locationId: string } | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (id: string, data: any) => Promise<void>;
  }
> = {
  ContactRequest: {
    viewPermission: "contact.view",
    updatePermission: "contact.update",
    revalidatePath: "/admin/requests/contact",
    findUnique: (id) =>
      prisma.contactRequest.findUnique({ where: { id }, select: { locationId: true } }),
    update: (id, data) =>
      prisma.contactRequest.update({ where: { id }, data }).then(() => undefined),
  },
  TradeInRequest: {
    viewPermission: "tradein.view",
    updatePermission: "tradein.update",
    revalidatePath: "/admin/requests/trade-in",
    findUnique: (id) =>
      prisma.tradeInRequest.findUnique({ where: { id }, select: { locationId: true } }),
    update: (id, data) =>
      prisma.tradeInRequest.update({ where: { id }, data }).then(() => undefined),
  },
  FinanceApplication: {
    viewPermission: "finance.view",
    updatePermission: "finance.update",
    revalidatePath: "/admin/requests/finance",
    findUnique: (id) =>
      prisma.financeApplication.findUnique({ where: { id }, select: { locationId: true } }),
    update: (id, data) =>
      prisma.financeApplication.update({ where: { id }, data }).then(() => undefined),
  },
  TestDriveBooking: {
    viewPermission: "testdrive.view",
    updatePermission: "testdrive.update",
    revalidatePath: "/admin/requests/test-drive",
    findUnique: (id) =>
      prisma.testDriveBooking.findUnique({ where: { id }, select: { locationId: true } }),
    update: (id, data) =>
      prisma.testDriveBooking.update({ where: { id }, data }).then(() => undefined),
  },
};

// ─── Location access check ────────────────────────────────────────────────────

async function assertLocationAccess(
  entityType: EntityType,
  id: string,
  userLocationIds: string[],
  hasViewAll: boolean
): Promise<string | null> {
  const meta = ENTITY_META[entityType];
  const record = await meta.findUnique(id);
  if (!record) return "Record not found.";
  if (!hasViewAll && !userLocationIds.includes(record.locationId))
    return "Access denied.";
  return null; // ok
}

// ─── Update status ────────────────────────────────────────────────────────────

const statusSchema = z.enum([
  "NEW",
  "IN_PROGRESS",
  "AWAITING_RESPONSE",
  "RESOLVED",
  "DECLINED",
  "CLOSED",
]);

export async function updateRequestStatus(
  entityType: string,
  id: string,
  status: RequestStatus
): Promise<ActionResult> {
  const session = await requireAuth();
  const type = entityType as EntityType;
  const meta = ENTITY_META[type];
  if (!meta) return { error: "Unknown entity type." };

  if (!hasPermission(session.user.role.permissions, meta.updatePermission))
    return { error: "Permission denied." };

  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { error: "Invalid status." };

  const locationIds = session.user.locations.map((l) => l.id);
  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");

  const accessError = await assertLocationAccess(type, id, locationIds, hasViewAll);
  if (accessError) return { error: accessError };

  // Fetch current record for audit (location + previous status)
  const current = await (
    type === "ContactRequest"
      ? prisma.contactRequest.findUnique({ where: { id }, select: { locationId: true, status: true } })
      : type === "TradeInRequest"
      ? prisma.tradeInRequest.findUnique({ where: { id }, select: { locationId: true, status: true } })
      : prisma.financeApplication.findUnique({ where: { id }, select: { locationId: true, status: true } })
  );

  await meta.update(id, { status: parsed.data });

  await logAction({
    actorId: session.user.id,
    action: "STATUS_CHANGED",
    entityType: type,
    entityId: id,
    locationId: current?.locationId,
    metadata: { from: current?.status, to: parsed.data },
  });

  revalidatePath(meta.revalidatePath);
  revalidatePath(`${meta.revalidatePath}/${id}`);

  return { error: null };
}

// ─── Assign request ───────────────────────────────────────────────────────────

export async function assignRequest(
  entityType: string,
  id: string,
  assigneeId: string | null
): Promise<ActionResult> {
  const session = await requireAuth();
  const type = entityType as EntityType;
  const meta = ENTITY_META[type];
  if (!meta) return { error: "Unknown entity type." };

  if (!hasPermission(session.user.role.permissions, meta.updatePermission))
    return { error: "Permission denied." };

  const locationIds = session.user.locations.map((l) => l.id);
  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");

  const accessError = await assertLocationAccess(type, id, locationIds, hasViewAll);
  if (accessError) return { error: accessError };

  // If assigning to a specific user, verify that user exists
  if (assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "Staff member not found." };
  }

  const prev = await meta.findUnique(id) as { locationId: string } | null;
  await meta.update(id, { assignedToId: assigneeId });

  await logAction({
    actorId: session.user.id,
    action: "ASSIGNED",
    entityType: type,
    entityId: id,
    locationId: prev?.locationId,
    metadata: { assigneeId },
  });

  revalidatePath(meta.revalidatePath);
  revalidatePath(`${meta.revalidatePath}/${id}`);

  return { error: null };
}

// ─── Add note ─────────────────────────────────────────────────────────────────

const noteSchema = z.string().min(1, "Note cannot be empty.").max(5000);

export async function addNote(
  entityType: string,
  id: string,
  body: string
): Promise<ActionResult> {
  const session = await requireAuth();
  const type = entityType as EntityType;
  const meta = ENTITY_META[type];
  if (!meta) return { error: "Unknown entity type." };

  if (!hasPermission(session.user.role.permissions, meta.updatePermission))
    return { error: "Permission denied." };

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const locationIds = session.user.locations.map((l) => l.id);
  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");

  const accessError = await assertLocationAccess(type, id, locationIds, hasViewAll);
  if (accessError) return { error: accessError };

  const record = await meta.findUnique(id) as { locationId: string } | null;

  const noteBase = { body: parsed.data, authorId: session.user.id } as const;
  await prisma.note.create({
    data:
      type === "ContactRequest"
        ? { ...noteBase, contactRequestId: id }
        : type === "TradeInRequest"
        ? { ...noteBase, tradeInRequestId: id }
        : type === "TestDriveBooking"
        ? { ...noteBase, testDriveBookingId: id }
        : { ...noteBase, financeApplicationId: id },
  });

  await logAction({
    actorId: session.user.id,
    action: "NOTE_ADDED",
    entityType: type,
    entityId: id,
    locationId: record?.locationId,
  });

  revalidatePath(`${meta.revalidatePath}/${id}`);

  return { error: null };
}

// ─── Edit note ────────────────────────────────────────────────────────────────

export async function editNote(
  noteId: string,
  body: string
): Promise<ActionResult> {
  const session = await requireAuth();

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      authorId: true,
      contactRequestId: true,
      tradeInRequestId: true,
      financeApplicationId: true,
      testDriveBookingId: true,
    },
  });

  if (!note) return { error: "Note not found." };
  if (note.authorId !== session.user.id) return { error: "Only the author can edit a note." };

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await prisma.note.update({ where: { id: noteId }, data: { body: parsed.data } });

  const entityType: EntityType = note.contactRequestId
    ? "ContactRequest"
    : note.tradeInRequestId
    ? "TradeInRequest"
    : note.testDriveBookingId
    ? "TestDriveBooking"
    : "FinanceApplication";
  const entityId =
    note.contactRequestId ?? note.tradeInRequestId ?? note.testDriveBookingId ?? note.financeApplicationId ?? "";
  revalidatePath(`${ENTITY_META[entityType].revalidatePath}/${entityId}`);

  return { error: null };
}

// ─── Delete note ──────────────────────────────────────────────────────────────

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const session = await requireAuth();

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      authorId: true,
      contactRequestId: true,
      tradeInRequestId: true,
      financeApplicationId: true,
      testDriveBookingId: true,
    },
  });

  if (!note) return { error: "Note not found." };

  const entityType: EntityType = note.contactRequestId
    ? "ContactRequest"
    : note.tradeInRequestId
    ? "TradeInRequest"
    : note.testDriveBookingId
    ? "TestDriveBooking"
    : "FinanceApplication";
  const meta = ENTITY_META[entityType];

  const isAuthor = note.authorId === session.user.id;
  const hasUpdatePerm = hasPermission(session.user.role.permissions, meta.updatePermission);
  if (!isAuthor && !hasUpdatePerm) return { error: "Permission denied." };

  const entityId =
    note.contactRequestId ?? note.tradeInRequestId ?? note.testDriveBookingId ?? note.financeApplicationId ?? "";

  await prisma.note.delete({ where: { id: noteId } });
  revalidatePath(`${meta.revalidatePath}/${entityId}`);

  return { error: null };
}

// ─── Set estimated value (trade-in only) ─────────────────────────────────────

const estimateSchema = z
  .number()
  .int()
  .min(0)
  .max(10_000_000)
  .nullable();

export async function setEstimatedValue(
  id: string,
  value: number | null
): Promise<ActionResult> {
  const session = await requirePermission("tradein.update");

  const parsed = estimateSchema.safeParse(value);
  if (!parsed.success) return { error: "Invalid value." };

  const locationIds = session.user.locations.map((l) => l.id);
  const hasViewAll = hasPermission(session.user.role.permissions, "locations.viewall");

  const accessError = await assertLocationAccess(
    "TradeInRequest",
    id,
    locationIds,
    hasViewAll
  );
  if (accessError) return { error: accessError };

  const record = await ENTITY_META.TradeInRequest.findUnique(id) as { locationId: string } | null;
  await ENTITY_META.TradeInRequest.update(id, { estimatedValue: parsed.data });

  await logAction({
    actorId: session.user.id,
    action: "ESTIMATE_SET",
    entityType: "TradeInRequest",
    entityId: id,
    locationId: record?.locationId,
    metadata: { value: parsed.data },
  });

  revalidatePath("/admin/requests/trade-in");
  revalidatePath(`/admin/requests/trade-in/${id}`);

  return { error: null };
}

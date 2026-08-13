/**
 * Northbridge Motors — Staff Portal
 * Server-side auth helpers
 *
 * Used in Server Components, Route Handlers, and Server Actions.
 * Never use client-side state for permission checks — always call these.
 */

import { auth } from "./auth";
import { redirect } from "next/navigation";
import { type Permission, hasPermission } from "./permissions";

// ─── Get current session (throws if not authenticated) ───────────────────────

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return session;
}

// ─── Get session + assert permission ─────────────────────────────────────────

export async function requirePermission(permission: Permission) {
  const session = await requireAuth();

  if (!hasPermission(session.user.role.permissions, permission)) {
    // Redirect to dashboard with an error; the UI shows an "Access denied" banner
    redirect("/admin?error=forbidden");
  }

  return session;
}

// ─── Get session without redirect (for conditional rendering) ────────────────

export async function getOptionalSession() {
  return auth();
}

// ─── Location scoping ─────────────────────────────────────────────────────────

/**
 * Returns the set of location IDs the current user is allowed to query.
 * If the user has `locations.viewall`, returns null (meaning: no restriction).
 */
export async function getUserLocationFilter(): Promise<string[] | null> {
  const session = await requireAuth();

  if (hasPermission(session.user.role.permissions, "locations.viewall")) {
    return null; // no filter — see everything
  }

  return session.user.locations.map((l) => l.id);
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

import { prisma } from "./prisma";
import { type Prisma } from "../../generated/prisma/client";

interface LogActionParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  locationId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function logAction({
  actorId,
  action,
  entityType,
  entityId,
  locationId,
  metadata,
}: LogActionParams) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      locationId,
      metadata,
    },
  });
}

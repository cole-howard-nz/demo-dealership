/**
 * Northbridge Motors
 * Prisma seed: default roles + Owner account
 *
 * Run with: npx prisma db seed
 * (add "prisma": { "seed": "ts-node prisma/seed.ts" } to package.json)
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED });
const prisma = new PrismaClient({ adapter });

// ─── Permission catalogue ─────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  "contact.view",
  "contact.update",
  "tradein.view",
  "tradein.update",
  "finance.view",
  "finance.update",
  "testdrive.view",
  "testdrive.update",
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.sold",
  "inventory.archive",
  "staff.view",
  "staff.invite",
  "staff.edit",
  "staff.deactivate",
  "staff.roles",
  "locations.view",
  "locations.manage",
  "locations.viewall",
  "audit.view",
  "settings.manage",
] as const;

const MANAGER_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !["staff.roles", "locations.manage", "locations.viewall", "settings.manage"].includes(p)
);

const SALES_PERMISSIONS = [
  "contact.view",
  "contact.update",
  "tradein.view",
  "tradein.update",
  "finance.view",
  "finance.update",
  "testdrive.view",
  "testdrive.update",
  "inventory.view",
  "inventory.sold",
];

const VIEWER_PERMISSIONS = [
  "contact.view",
  "tradein.view",
  "finance.view",
  "testdrive.view",
  "inventory.view",
];

// ─── Default roles ────────────────────────────────────────────────────────────

const DEFAULT_ROLES = [
  {
    name: "Owner",
    isSystem: true,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    name: "Manager",
    isSystem: false,
    permissions: [...MANAGER_PERMISSIONS],
  },
  {
    name: "Sales Staff",
    isSystem: false,
    permissions: SALES_PERMISSIONS,
  },
  {
    name: "Viewer",
    isSystem: false,
    permissions: VIEWER_PERMISSIONS,
  },
];

// ─── Default locations ────────────────────────────────────────────────────────

const DEFAULT_LOCATIONS = [
  { name: "Wellington Yard", address: "12 Cuba St, Te Aro, Wellington 6011" },
  { name: "Auckland Yard", address: "34 Great North Rd, Grey Lynn, Auckland 1021" },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding Northbridge Motors staff portal...");

  // 1. Upsert roles
  console.log("  → Seeding roles...");
  const roleMap: Record<string, string> = {};
  for (const role of DEFAULT_ROLES) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: {
        name: role.name,
        isSystem: role.isSystem,
        permissions: role.permissions,
      },
    });
    roleMap[role.name] = created.id;
    console.log(`    ✓ ${role.name} (${role.permissions.length} permissions)`);
  }

  // 2. Upsert locations
  console.log("  → Seeding locations...");
  const locationMap: Record<string, string> = {};
  for (const loc of DEFAULT_LOCATIONS) {
    const existing = await prisma.location.findFirst({ where: { name: loc.name } });
    if (existing) {
      locationMap[loc.name] = existing.id;
      console.log(`    ✓ ${loc.name} (exists)`);
    } else {
      const created = await prisma.location.create({ data: loc });
      locationMap[loc.name] = created.id;
      console.log(`    ✓ ${loc.name} (created)`);
    }
  }

  // 3. Create seed Owner account if none exists
  console.log("  → Seeding Owner account...");
  const ownerRoleId = roleMap["Owner"];
  const existingOwner = await prisma.user.findFirst({
    where: { role: { isSystem: true } },
  });

  if (existingOwner) {
    console.log(`    ✓ Owner account exists (${existingOwner.email}) - skipping`);
  } else {
    const SEED_OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@promptly.nz";
    const SEED_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "Password123";
    const SEED_OWNER_NAME = process.env.SEED_OWNER_NAME ?? "Portal Owner";

    const passwordHash = await bcrypt.hash(SEED_OWNER_PASSWORD, 12);
    const owner = await prisma.user.create({
      data: {
        name: SEED_OWNER_NAME,
        email: SEED_OWNER_EMAIL,
        passwordHash,
        roleId: ownerRoleId,
        isActive: true,
        inviteAccepted: true,
        locations: {
          create: Object.values(locationMap).map((locationId) => ({ locationId })),
        },
      },
    });
    console.log(`    ✓ Owner created: ${owner.email}`);
    console.log(`    ⚠  Password: ${SEED_OWNER_PASSWORD} - change this immediately after first login`);
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migrate/db push/studio) needs the direct, unpooled
    // connection — Neon's pooled endpoint doesn't support the operations
    // schema migrations require.
    url: env("DATABASE_URL_UNPOOLED"),
  },
});

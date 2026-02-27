import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "@/lib/db/schema";

const databaseUrl = process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing NEON_DATABASE_URL env var");
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });

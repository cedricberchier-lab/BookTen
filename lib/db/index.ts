import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "@/lib/db/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing NEON_DATABASE_URL env var");
  _db = drizzle(neon(databaseUrl), { schema });
  return _db;
}

// Lazy proxy — throws only when a query is actually made, not at module load
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop: string | symbol) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getDb() as any)[prop];
  },
});

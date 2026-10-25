import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: Pool; __db?: ReturnType<typeof make> };

function pool(): Pool {
  if (!g.__pool) {
    g.__pool = new Pool({ connectionString: env().DATABASE_URL, max: 8, ssl: { rejectUnauthorized: false } });
  }
  return g.__pool;
}

function make() {
  return drizzle(pool(), { schema });
}

export function db() {
  if (!g.__db) g.__db = make();
  return g.__db;
}

export { schema };

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "../env";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: Pool; __db?: ReturnType<typeof make> };

// Neon over WebSocket (port 443): plain Postgres port 5432 is blocked on some networks.
neonConfig.webSocketConstructor = ws;

function pool(): Pool {
  if (!g.__pool) {
    g.__pool = new Pool({ connectionString: env().DATABASE_URL, max: 8 });
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

import { config } from "dotenv";
config({ path: ".env.local" });
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const { rows } = await pool.query("select table_name from information_schema.tables where table_schema='public' order by 1");
  console.log("tables:", rows.map((r) => r.table_name).join(", "));
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

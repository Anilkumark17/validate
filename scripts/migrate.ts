import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const { rows } = await pool.query("select table_name from information_schema.tables where table_schema='public' order by 1");
  console.log("tables:", rows.map((r) => r.table_name).join(", "));
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

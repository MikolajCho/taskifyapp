import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

dotenv.config();

const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL || "postgresql://localhost:5432/taskify",
});

const db = drizzle(pool, { schema });

async function main() {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Migrations completed!");
	await pool.end();
}

main().catch(console.error);

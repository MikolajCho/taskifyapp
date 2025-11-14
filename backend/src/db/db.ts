import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

dotenv.config();

console.log(
	"DATABASE_URL in db.ts:",
	process.env.DATABASE_URL ? "***" : "NOT SET",
);

const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL || "postgresql://localhost:5432/taskify",
});

pool
	.query("SELECT NOW()")
	.then((_res) => console.log("Database test query successful"))
	.catch((err) => console.error("Database test query failed:", err.message));

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export { pool };

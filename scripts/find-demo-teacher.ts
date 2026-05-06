import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

async function main() {
	const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
	const db = drizzle(sql, { schema });
	const rows = await db
		.select({ teacherId: schema.classes.teacherId, label: schema.classes.label })
		.from(schema.classes)
		.where(eq(schema.classes.id, "e4cb4589-b69e-435b-83cc-931b78f5c572"));
	console.log(JSON.stringify(rows[0]));
	await sql.end();
}
main().catch(console.error);

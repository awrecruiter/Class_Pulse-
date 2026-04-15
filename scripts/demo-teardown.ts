#!/usr/bin/env npx tsx
/**
 * Demo Teardown Script
 * --------------------
 * Deletes the demo class and ALL its cascade data (students, groups,
 * RAM bucks, behavior incidents, gradebook entries, etc.).
 * Real data is NOT touched.
 *
 * Run: npx tsx scripts/demo-teardown.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const DEMO_CLASS_LABEL = "[DEMO] 5th Period Math";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

async function main() {
	const rows = await db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.where(eq(schema.classes.label, DEMO_CLASS_LABEL));

	if (rows.length === 0) {
		console.log("ℹ️  No demo class found — nothing to remove.");
		process.exit(0);
	}

	const classId = rows[0].id;
	console.log(`🗑  Deleting demo class ${classId} and all cascade data...`);

	// All related tables cascade-delete on class deletion
	await db.delete(schema.classes).where(eq(schema.classes.id, classId));

	console.log("✅ Demo data removed. Your real data is untouched.");
	await sql.end();
}

main().catch((err) => {
	console.error("❌ Teardown failed:", err);
	process.exit(1);
});

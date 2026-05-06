/**
 * Generates a parent report token for Aaliyah Davis in the demo account class.
 */
import crypto from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const CLASS_ID = "e4cb4589-b69e-435b-83cc-931b78f5c572";

async function main() {
	const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
	const db = drizzle(sql, { schema });

	// Find Aaliyah Davis (student ID 20001004)
	const [roster] = await db
		.select({
			id: schema.rosterEntries.id,
			firstInitial: schema.rosterEntries.firstInitial,
			lastInitial: schema.rosterEntries.lastInitial,
		})
		.from(schema.rosterEntries)
		.where(
			and(
				eq(schema.rosterEntries.classId, CLASS_ID),
				eq(schema.rosterEntries.studentId, "20001004"),
			),
		);

	if (!roster) {
		console.error("Student not found");
		process.exit(1);
	}

	// Create intervention flag
	const [flag] = await db
		.insert(schema.interventionFlags)
		.values({
			classId: CLASS_ID,
			rosterId: roster.id,
			tier: "watch",
			standardCode: "MA.5.FR.2.1",
			sessionCount: 4,
			detectedAt: new Date(),
			status: "open",
		})
		.returning({ id: schema.interventionFlags.id });

	// Create token
	const token = crypto.randomBytes(24).toString("hex");
	await db.insert(schema.parentReportTokens).values({
		token,
		flagId: flag.id,
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
	});

	await sql.end();
	console.log(`Student: ${roster.firstInitial}.${roster.lastInitial}.`);
	console.log(`Production URL: https://class-pulse-nine.vercel.app/report/${token}`);
	console.log(`Local URL: http://localhost:3000/report/${token}`);
}

main().catch(console.error);

/**
 * Dev-only: inserts a fake intervention flag + token to preview the parent report.
 * Run: npx tsx scripts/seed-report-preview.ts
 */
import crypto from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
// Import postgres + drizzle after dotenv so DATABASE_URL is set before connection
import postgres from "postgres";
import {
	classes,
	interventionFlags,
	parentReportTokens,
	rosterEntries,
} from "../src/lib/db/schema";

async function main() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		console.error("DATABASE_URL not set");
		process.exit(1);
	}

	const client = postgres(url, { max: 1 });
	const db = drizzle(client);

	const [cls] = await db.select({ id: classes.id, label: classes.label }).from(classes).limit(1);
	if (!cls) {
		console.error("No classes found — create a class first.");
		await client.end();
		process.exit(1);
	}

	const [roster] = await db
		.select({
			id: rosterEntries.id,
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
		})
		.from(rosterEntries)
		.where(eq(rosterEntries.classId, cls.id))
		.limit(1);
	if (!roster) {
		console.error(`No roster entries in "${cls.label}" — add a student first.`);
		await client.end();
		process.exit(1);
	}

	const [flag] = await db
		.insert(interventionFlags)
		.values({
			classId: cls.id,
			rosterId: roster.id,
			tier: "watch",
			standardCode: "MA.5.NSO.1.1",
			sessionCount: 3,
			detectedAt: new Date(),
			status: "open",
		})
		.returning({ id: interventionFlags.id });

	const token = crypto.randomBytes(24).toString("hex");
	await db.insert(parentReportTokens).values({
		token,
		flagId: flag.id,
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
	});

	await client.end();

	console.log(`\nStudent: ${roster.firstInitial}.${roster.lastInitial}. | Class: ${cls.label}`);
	console.log(`\n  http://localhost:3000/report/${token}\n`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

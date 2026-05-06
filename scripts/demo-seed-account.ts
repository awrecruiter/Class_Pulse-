#!/usr/bin/env npx tsx
/**
 * Seeds the demo account's "5th Grade Math" class with realistic data.
 * Targets class ID e4cb4589-b69e-435b-83cc-931b78f5c572 (classpulse.demo@gmail.com)
 * Join code: DEMO02
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const CLASS_ID = "e4cb4589-b69e-435b-83cc-931b78f5c572";
const TEACHER_ID = "67545e47-9d7e-493e-b1fa-cb11e649e6ff";
const JOIN_CODE = "DEMO02";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

function randInt(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d;
}
function toDateStr(d: Date): string {
	return d.toISOString().slice(0, 10);
}

const STUDENTS = [
	{ id: "20001001", first: "Marcus", last: "Johnson", perf: 78 },
	{ id: "20001002", first: "Jaylen", last: "Williams", perf: 65 },
	{ id: "20001003", first: "Destiny", last: "Brown", perf: 82 },
	{ id: "20001004", first: "Aaliyah", last: "Davis", perf: 91 },
	{ id: "20001005", first: "Keanu", last: "Rivera", perf: 74 },
	{ id: "20001006", first: "Xiomara", last: "Gonzalez", perf: 88 },
	{ id: "20001007", first: "Devon", last: "Harris", perf: 60 },
	{ id: "20001008", first: "Nailah", last: "Robinson", perf: 73 },
	{ id: "20001009", first: "Elijah", last: "Carter", perf: 95 },
	{ id: "20001010", first: "Camille", last: "Lewis", perf: 83 },
	{ id: "20001011", first: "Amahri", last: "Jackson", perf: 69 },
	{ id: "20001012", first: "Sofia", last: "Martinez", perf: 86 },
	{ id: "20001013", first: "Tyrese", last: "White", perf: 58 },
	{ id: "20001014", first: "Jasmine", last: "Anderson", perf: 80 },
	{ id: "20001015", first: "Kai", last: "Thomas", perf: 77 },
	{ id: "20001016", first: "Darius", last: "Moore", perf: 72 },
	{ id: "20001017", first: "Gabriella", last: "Taylor", perf: 90 },
	{ id: "20001018", first: "Isaiah", last: "Williams", perf: 64 },
	{ id: "20001019", first: "Zoe", last: "Wilson", perf: 87 },
	{ id: "20001020", first: "Tre", last: "Mitchell", perf: 55 },
];

const GROUP_MEMBERS: Record<string, number[]> = {
	Dogs: [0, 1, 2, 3, 4],
	Cats: [5, 6, 7, 8, 9],
	Birds: [10, 11, 12, 13, 14],
	Bears: [15, 16, 17, 18, 19],
};

const GROUPS = [
	{ name: "Dogs", emoji: "🐕", color: "blue", sortOrder: 0, coins: 45 },
	{ name: "Cats", emoji: "🐈", color: "purple", sortOrder: 1, coins: 38 },
	{ name: "Birds", emoji: "🐦", color: "green", sortOrder: 2, coins: 52 },
	{ name: "Bears", emoji: "🐻", color: "orange", sortOrder: 3, coins: 30 },
];

const RAM_BALANCES = [
	185, 60, 220, 310, 140, 275, 45, 155, 380, 230, 95, 260, 30, 200, 165, 130, 315, 55, 240, 20,
];

const CFU_STANDARDS = ["MA.5.FR.1.1", "MA.5.FR.2.1", "MA.5.NSO.2.1"];

async function main() {
	console.log("🌱 Seeding demo account class...");

	// Check not already seeded
	const existingRoster = await db
		.select({ id: schema.rosterEntries.id })
		.from(schema.rosterEntries)
		.where(eq(schema.rosterEntries.classId, CLASS_ID))
		.limit(1);
	if (existingRoster.length > 0) {
		console.log("⚠️  Class already has roster. Skipping — run teardown first if needed.");
		await sql.end();
		return;
	}

	// Update class label
	await db
		.update(schema.classes)
		.set({
			label: "[DEMO] 5th Grade Math",
			periodTime: "10:30 AM",
			gradeLevel: "5",
			subject: "Math",
		})
		.where(eq(schema.classes.id, CLASS_ID));
	console.log("📚 Updated class label");

	// Roster
	const rosterRows = await db
		.insert(schema.rosterEntries)
		.values(
			STUDENTS.map((s) => ({
				classId: CLASS_ID,
				studentId: s.id,
				firstName: s.first,
				lastName: s.last,
				firstInitial: s.first[0],
				lastInitial: s.last[0],
				performanceScore: s.perf,
			})),
		)
		.returning();
	console.log(`👥 Inserted ${rosterRows.length} students`);

	// Active session
	const today = toDateStr(new Date());
	const [session] = await db
		.insert(schema.classSessions)
		.values({
			classId: CLASS_ID,
			teacherId: TEACHER_ID,
			joinCode: JOIN_CODE,
			date: today,
			status: "active",
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		})
		.returning();
	console.log(`📋 Active session — join code: ${JOIN_CODE}, ID: ${session.id}`);

	// Groups
	const groupRows = await db
		.insert(schema.studentGroups)
		.values(
			GROUPS.map((g) => ({
				classId: CLASS_ID,
				name: g.name,
				emoji: g.emoji,
				color: g.color,
				sortOrder: g.sortOrder,
			})),
		)
		.returning();

	// Group memberships
	const membershipRows: { classId: string; groupId: string; rosterId: string }[] = [];
	for (const groupRow of groupRows) {
		const idxList = GROUP_MEMBERS[groupRow.name] ?? [];
		for (const idx of idxList) {
			membershipRows.push({
				classId: CLASS_ID,
				groupId: groupRow.id,
				rosterId: rosterRows[idx].id,
			});
		}
	}
	await db.insert(schema.groupMemberships).values(membershipRows);
	console.log("🐾 Groups + memberships created");

	// Group coin accounts
	await db
		.insert(schema.groupAccounts)
		.values(
			groupRows.map((g, i) => ({ classId: CLASS_ID, groupId: g.id, balance: GROUPS[i].coins })),
		);

	// RAM buck accounts
	const ramAccountRows = await db
		.insert(schema.ramBuckAccounts)
		.values(
			rosterRows.map((r, i) => ({
				classId: CLASS_ID,
				rosterId: r.id,
				balance: RAM_BALANCES[i],
				lifetimeEarned: RAM_BALANCES[i] + randInt(10, 60),
			})),
		)
		.returning();

	// Transaction history
	const txRows = rosterRows.flatMap((r, i) => [
		{
			classId: CLASS_ID,
			rosterId: r.id,
			sessionId: session.id,
			type: "manual-award",
			amount: Math.round(RAM_BALANCES[i] * 0.6),
			reason: "Academic work",
			createdAt: daysAgo(5),
		},
		{
			classId: CLASS_ID,
			rosterId: r.id,
			sessionId: session.id,
			type: "academic-correct",
			amount: Math.round(RAM_BALANCES[i] * 0.4),
			reason: "Correct answers",
			createdAt: daysAgo(2),
		},
	]);
	await db.insert(schema.ramBuckTransactions).values(txRows);
	console.log(`💰 RAM bucks + history seeded (${ramAccountRows.length} accounts)`);

	// Behavior profile for Aaliyah (index 3) — clean record for marketing
	// Give one minor incident to show the system
	await db
		.insert(schema.behaviorProfiles)
		.values({
			classId: CLASS_ID,
			rosterId: rosterRows[1].id,
			currentStep: 1,
			lastIncidentAt: daysAgo(3),
		})
		.onConflictDoNothing();
	await db.insert(schema.behaviorIncidents).values({
		classId: CLASS_ID,
		rosterId: rosterRows[1].id,
		sessionId: session.id,
		step: 1,
		label: "Ram Buck Fine",
		notes: "Talking during instruction",
		ramBuckDeduction: 5,
		createdAt: daysAgo(3),
	});

	// Parent contacts
	await db
		.insert(schema.parentContacts)
		.values([
			{
				classId: CLASS_ID,
				rosterId: rosterRows[3].id,
				parentName: "Renée Davis",
				phone: "+14075550102",
			},
			{
				classId: CLASS_ID,
				rosterId: rosterRows[9].id,
				parentName: "Robert Carter",
				phone: "+14075550104",
			},
		])
		.onConflictDoNothing();

	// CFU entries
	const cfuRows = [];
	for (let day = 4; day >= 0; day--) {
		const dateStr = toDateStr(daysAgo(day));
		const std = CFU_STANDARDS[day % CFU_STANDARDS.length];
		for (let i = 0; i < rosterRows.length; i++) {
			const perf = STUDENTS[i].perf;
			const base = perf >= 85 ? 4 : perf >= 70 ? 3 : perf >= 60 ? 2 : 1;
			const noise = Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : 0;
			cfuRows.push({
				classId: CLASS_ID,
				rosterId: rosterRows[i].id,
				standardCode: std,
				score: Math.max(1, Math.min(4, base + noise)),
				date: dateStr,
				sessionId: session.id,
			});
		}
	}
	await db.insert(schema.cfuEntries).values(cfuRows).onConflictDoNothing();
	console.log(`📊 ${cfuRows.length} CFU entries added`);

	// Comprehension signals (active session)
	const signalOptions = ["got-it", "got-it", "got-it", "almost", "almost", "lost"];
	await db
		.insert(schema.comprehensionSignals)
		.values(
			rosterRows.map((r) => ({
				sessionId: session.id,
				rosterId: r.id,
				signal: signalOptions[Math.floor(Math.random() * signalOptions.length)],
			})),
		)
		.onConflictDoNothing();
	console.log("💬 Comprehension signals added");

	// Store items (if none exist for this teacher)
	const existingItems = await db
		.select({ id: schema.privilegeItems.id })
		.from(schema.privilegeItems)
		.where(eq(schema.privilegeItems.teacherId, TEACHER_ID));
	if (existingItems.length === 0) {
		await db.insert(schema.privilegeItems).values([
			{ teacherId: TEACHER_ID, name: "Homework Pass", cost: 50, sortOrder: 0 },
			{ teacherId: TEACHER_ID, name: "Sit Anywhere Pass", cost: 30, sortOrder: 1 },
			{ teacherId: TEACHER_ID, name: "Extra Computer Time", cost: 25, sortOrder: 2 },
			{ teacherId: TEACHER_ID, name: "Snack Pass", cost: 20, sortOrder: 3 },
			{ teacherId: TEACHER_ID, name: "Hat Day", cost: 15, sortOrder: 4 },
			{ teacherId: TEACHER_ID, name: "Lunch with Teacher", cost: 75, sortOrder: 5 },
		]);
		console.log("🛒 Store items created");
	}

	console.log("\n✅ Demo account seed complete!");
	console.log(`📍 Class ID: ${CLASS_ID}`);
	console.log(`🔑 Student join code: ${JOIN_CODE}`);
	console.log(`📋 Session ID: ${session.id}`);
	await sql.end();
}

main().catch((err) => {
	console.error("❌ Seed failed:", err);
	process.exit(1);
});

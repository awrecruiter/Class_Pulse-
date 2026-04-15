#!/usr/bin/env npx tsx
/**
 * Demo Seed Script
 * ----------------
 * Populates the DB with realistic fake data for a live app demo.
 * Safe to run against production — does NOT delete existing data.
 * All demo rows are tagged under a class labeled "[DEMO] 5th Period Math".
 *
 * Run:  npx tsx scripts/demo-seed.ts
 * Undo: npx tsx scripts/demo-teardown.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const DEMO_CLASS_LABEL = "[DEMO] 5th Period Math";
const DEMO_JOIN_CODE = "DEMO01";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Student roster ───────────────────────────────────────────────────────────

const STUDENTS = [
	// Dogs group
	{ id: "10001001", first: "Marcus", last: "Johnson", perf: 78 },
	{ id: "10001002", first: "Jaylen", last: "Williams", perf: 65 },
	{ id: "10001003", first: "Destiny", last: "Brown", perf: 82 },
	{ id: "10001004", first: "Aaliyah", last: "Davis", perf: 91 },
	{ id: "10001005", first: "Keanu", last: "Rivera", perf: 74 },
	// Cats group
	{ id: "10001006", first: "Xiomara", last: "Gonzalez", perf: 88 },
	{ id: "10001007", first: "Devon", last: "Harris", perf: 60 },
	{ id: "10001008", first: "Nailah", last: "Robinson", perf: 73 },
	{ id: "10001009", first: "Elijah", last: "Carter", perf: 95 },
	{ id: "10001010", first: "Camille", last: "Lewis", perf: 83 },
	// Birds group
	{ id: "10001011", first: "Amahri", last: "Jackson", perf: 69 },
	{ id: "10001012", first: "Sofia", last: "Martinez", perf: 86 },
	{ id: "10001013", first: "Tyrese", last: "White", perf: 58 },
	{ id: "10001014", first: "Jasmine", last: "Anderson", perf: 80 },
	{ id: "10001015", first: "Kai", last: "Thomas", perf: 77 },
	// Bears group
	{ id: "10001016", first: "Darius", last: "Moore", perf: 72 },
	{ id: "10001017", first: "Gabriella", last: "Taylor", perf: 90 },
	{ id: "10001018", first: "Isaiah", last: "Williams", perf: 64 },
	{ id: "10001019", first: "Zoe", last: "Wilson", perf: 87 },
	{ id: "10001020", first: "Tre", last: "Mitchell", perf: 55 },
];

// Indices into STUDENTS by group (0-based)
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

const MILESTONES = [
	{ name: "PE", coinsRequired: 25, sortOrder: 0 },
	{ name: "Extra Recess", coinsRequired: 50, sortOrder: 1 },
	{ name: "Gym Day", coinsRequired: 75, sortOrder: 2 },
];

const STORE_ITEMS = [
	{ name: "Homework Pass", cost: 50, sort: 0 },
	{ name: "Sit Anywhere Pass", cost: 30, sort: 1 },
	{ name: "Extra Computer Time", cost: 25, sort: 2 },
	{ name: "Snack Pass", cost: 20, sort: 3 },
	{ name: "Hat Day", cost: 15, sort: 4 },
	{ name: "Lunch with Teacher", cost: 75, sort: 5 },
];

// RAM buck balances per student index
const RAM_BALANCES = [
	185,
	60,
	220,
	310,
	140, // Dogs
	275,
	45,
	155,
	380,
	230, // Cats
	95,
	260,
	30,
	200,
	165, // Birds
	130,
	315,
	55,
	240,
	20, // Bears
];

// Behavior incidents: { studentIdx, step, label, notes, daysAgo }
const BEHAVIOR_INCIDENTS = [
	{ studentIdx: 1, step: 1, label: "Ram Buck Fine", notes: "Talking during instruction", ago: 3 },
	{ studentIdx: 6, step: 2, label: "No Games", notes: "Phone out in class", ago: 5 },
	{ studentIdx: 12, step: 1, label: "Ram Buck Fine", notes: "Disrupting group work", ago: 1 },
	{ studentIdx: 19, step: 3, label: "No PE", notes: "Repeated warnings not followed", ago: 2 },
];

// Parent contacts: { studentIdx, parentName, phone }
const PARENT_CONTACTS = [
	{ studentIdx: 1, parentName: "Latoya Williams", phone: "+14075550101" },
	{ studentIdx: 3, parentName: "Renée Davis", phone: "+14075550102" },
	{ studentIdx: 6, parentName: "Carmen Gonzalez", phone: "+14075550103" },
	{ studentIdx: 9, parentName: "Robert Carter", phone: "+14075550104" },
	{ studentIdx: 12, parentName: "Sandra White", phone: "+14075550105" },
	{ studentIdx: 16, parentName: "James Moore", phone: "+14075550106" },
	{ studentIdx: 18, parentName: "Tanya Williams", phone: "+14075550107" },
];

// CFU entries: standard codes and dates
const CFU_STANDARDS = ["MA.5.FR.1.1", "MA.5.FR.2.1", "MA.5.NSO.2.1"];

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
	console.log("🌱 Starting demo seed...");

	// 1. Find teacher user ID
	const existingClasses = await db
		.select({ teacherId: schema.classes.teacherId })
		.from(schema.classes)
		.limit(1);

	if (existingClasses.length === 0) {
		console.error("❌ No classes found in DB — cannot determine teacher ID.");
		console.error("   Create at least one class in the app first, then re-run this script.");
		process.exit(1);
	}

	const teacherId = existingClasses[0].teacherId;
	console.log(`👤 Teacher ID: ${teacherId.slice(0, 8)}...`);

	// 2. Guard: don't double-seed
	const existing = await db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.where(eq(schema.classes.label, DEMO_CLASS_LABEL));
	if (existing.length > 0) {
		console.log("⚠️  Demo class already exists. Run demo-teardown.ts first if you want to re-seed.");
		process.exit(0);
	}

	// 3. Create demo class
	const [demoClass] = await db
		.insert(schema.classes)
		.values({
			teacherId,
			label: DEMO_CLASS_LABEL,
			periodTime: "10:30 AM",
			gradeLevel: "5",
			subject: "Math",
		})
		.returning();
	console.log(`📚 Created class: ${demoClass.label} (${demoClass.id})`);

	// 4. Insert roster
	const rosterRows = await db
		.insert(schema.rosterEntries)
		.values(
			STUDENTS.map((s) => ({
				classId: demoClass.id,
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

	// Build studentId → rosterEntry map
	const rosterByIdx = rosterRows; // order preserved
	const rosterById: Record<string, (typeof rosterRows)[0]> = {};
	rosterRows.forEach((r) => {
		rosterById[r.studentId] = r;
	});

	// 5. Create active session
	const today = toDateStr(new Date());
	const [session] = await db
		.insert(schema.classSessions)
		.values({
			classId: demoClass.id,
			teacherId,
			joinCode: DEMO_JOIN_CODE,
			date: today,
			status: "active",
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		})
		.returning();
	console.log(`📋 Created active session — join code: ${DEMO_JOIN_CODE}`);

	// 6. Create groups
	const groupRows = await db
		.insert(schema.studentGroups)
		.values(
			GROUPS.map((g) => ({
				classId: demoClass.id,
				name: g.name,
				emoji: g.emoji,
				color: g.color,
				sortOrder: g.sortOrder,
			})),
		)
		.returning();
	console.log(`🐾 Created ${groupRows.length} groups`);

	// 7. Assign students to groups
	const membershipRows: { classId: string; groupId: string; rosterId: string }[] = [];
	for (const groupRow of groupRows) {
		const idxList = GROUP_MEMBERS[groupRow.name] ?? [];
		for (const idx of idxList) {
			membershipRows.push({
				classId: demoClass.id,
				groupId: groupRow.id,
				rosterId: rosterByIdx[idx].id,
			});
		}
	}
	await db.insert(schema.groupMemberships).values(membershipRows);
	console.log(`✅ Assigned students to groups`);

	// 8. Group coin accounts
	await db.insert(schema.groupAccounts).values(
		groupRows.map((g, i) => ({
			classId: demoClass.id,
			groupId: g.id,
			balance: GROUPS[i].coins,
		})),
	);
	console.log(`🪙 Set group coin balances`);

	// 9. Group milestones (coin activities)
	await db
		.insert(schema.groupMilestones)
		.values(MILESTONES.map((m) => ({ classId: demoClass.id, ...m })));
	console.log(`🏆 Created coin activity milestones`);

	// 10. RAM buck accounts + some transaction history
	const ramAccountRows = await db
		.insert(schema.ramBuckAccounts)
		.values(
			rosterByIdx.map((r, i) => ({
				classId: demoClass.id,
				rosterId: r.id,
				balance: RAM_BALANCES[i],
				lifetimeEarned: RAM_BALANCES[i] + randInt(10, 60),
			})),
		)
		.returning();
	console.log(`💰 Created ${ramAccountRows.length} RAM buck accounts`);

	// Add a few transactions for history
	const txRows: {
		classId: string;
		rosterId: string;
		sessionId: string;
		type: string;
		amount: number;
		reason: string;
		createdAt: Date;
	}[] = [];
	for (let i = 0; i < rosterByIdx.length; i++) {
		const balance = RAM_BALANCES[i];
		// Simulate earning over past week
		txRows.push({
			classId: demoClass.id,
			rosterId: rosterByIdx[i].id,
			sessionId: session.id,
			type: "manual-award",
			amount: Math.round(balance * 0.6),
			reason: "Academic work",
			createdAt: daysAgo(5),
		});
		txRows.push({
			classId: demoClass.id,
			rosterId: rosterByIdx[i].id,
			sessionId: session.id,
			type: "academic-correct",
			amount: Math.round(balance * 0.4),
			reason: "Correct answers",
			createdAt: daysAgo(2),
		});
	}
	await db.insert(schema.ramBuckTransactions).values(txRows);
	console.log(`📜 Added RAM buck transaction history`);

	// 11. Behavior profiles + incidents
	for (const inc of BEHAVIOR_INCIDENTS) {
		const r = rosterByIdx[inc.studentIdx];
		// Upsert behavior profile
		await db
			.insert(schema.behaviorProfiles)
			.values({
				classId: demoClass.id,
				rosterId: r.id,
				currentStep: inc.step,
				lastIncidentAt: daysAgo(inc.ago),
			})
			.onConflictDoNothing();

		// Insert incident
		await db.insert(schema.behaviorIncidents).values({
			classId: demoClass.id,
			rosterId: r.id,
			sessionId: session.id,
			step: inc.step,
			label: inc.label,
			notes: inc.notes,
			ramBuckDeduction: inc.step * 5,
			createdAt: daysAgo(inc.ago),
		});
	}
	console.log(`⚠️  Created ${BEHAVIOR_INCIDENTS.length} behavior incidents`);

	// 12. Parent contacts
	await db
		.insert(schema.parentContacts)
		.values(
			PARENT_CONTACTS.map((p) => ({
				classId: demoClass.id,
				rosterId: rosterByIdx[p.studentIdx].id,
				parentName: p.parentName,
				phone: p.phone,
			})),
		)
		.onConflictDoNothing();
	console.log(`📱 Added ${PARENT_CONTACTS.length} parent contacts`);

	// 13. CFU / Gradebook entries (5 days, varied scores)
	const cfuRows: {
		classId: string;
		rosterId: string;
		standardCode: string;
		score: number;
		date: string;
		sessionId: string;
	}[] = [];
	for (let day = 4; day >= 0; day--) {
		const dateStr = toDateStr(daysAgo(day * 1));
		const std = CFU_STANDARDS[day % CFU_STANDARDS.length];
		for (let i = 0; i < rosterByIdx.length; i++) {
			const perf = STUDENTS[i].perf;
			// Scores 1-4; higher perf → higher score, add some noise
			const base = perf >= 85 ? 4 : perf >= 70 ? 3 : perf >= 60 ? 2 : 1;
			const noise = Math.random() < 0.2 ? (Math.random() < 0.5 ? -1 : 1) : 0;
			const score = Math.max(1, Math.min(4, base + noise));
			cfuRows.push({
				classId: demoClass.id,
				rosterId: rosterByIdx[i].id,
				standardCode: std,
				score,
				date: dateStr,
				sessionId: session.id,
			});
		}
	}
	await db.insert(schema.cfuEntries).values(cfuRows).onConflictDoNothing();
	console.log(`📊 Added ${cfuRows.length} gradebook (CFU) entries`);

	// 14. Privilege store items
	const existingItems = await db
		.select({ id: schema.privilegeItems.id })
		.from(schema.privilegeItems)
		.where(eq(schema.privilegeItems.teacherId, teacherId));
	if (existingItems.length === 0) {
		await db.insert(schema.privilegeItems).values(
			STORE_ITEMS.map((item) => ({
				teacherId,
				name: item.name,
				cost: item.cost,
				sortOrder: item.sort,
			})),
		);
		console.log(`🛒 Created ${STORE_ITEMS.length} privilege store items`);
	} else {
		console.log(`🛒 Store items already exist — skipping`);
	}

	// 15. Comprehension signals for today's session (mixed signals)
	const signals: { sessionId: string; rosterId: string; signal: string }[] = [];
	const signalOptions = ["got-it", "got-it", "got-it", "almost", "almost", "lost"];
	for (const r of rosterByIdx) {
		signals.push({
			sessionId: session.id,
			rosterId: r.id,
			signal: signalOptions[Math.floor(Math.random() * signalOptions.length)],
		});
	}
	await db.insert(schema.comprehensionSignals).values(signals).onConflictDoNothing();
	console.log(`💬 Added comprehension signals for active session`);

	console.log("\n✅ Demo seed complete!");
	console.log(`\n📍 Demo class ID: ${demoClass.id}`);
	console.log(`🔑 Student join code: ${DEMO_JOIN_CODE}`);
	console.log(`\n👉 Open the app, navigate to Classes, and select "${DEMO_CLASS_LABEL}"`);
	console.log(`\n🧹 To remove all demo data: npx tsx scripts/demo-teardown.ts`);

	await sql.end();
}

main().catch((err) => {
	console.error("❌ Seed failed:", err);
	process.exit(1);
});

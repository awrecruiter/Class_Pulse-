import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

// ─── Legacy: Link-in-bio ────────────────────────────────────────────────────

export const profiles = pgTable(
	"profiles",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),
		slug: text("slug").notNull().unique(),
		displayName: text("display_name").notNull().default(""),
		bio: text("bio").notNull().default(""),
		avatarUrl: text("avatar_url").notNull().default(""),
		theme: text("theme").notNull().default("minimal"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_profiles_slug").on(table.slug),
		index("idx_profiles_user_id").on(table.userId),
	],
);

export const linkItems = pgTable(
	"link_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		profileId: uuid("profile_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		type: text("type").notNull().default("link"),
		title: text("title").notNull().default(""),
		url: text("url").notNull().default(""),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_link_items_profile_id").on(table.profileId)],
);

export const clickEvents = pgTable(
	"click_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		linkItemId: uuid("link_item_id")
			.notNull()
			.references(() => linkItems.id, { onDelete: "cascade" }),
		clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_click_events_link_item_id").on(table.linkItemId),
		index("idx_click_events_clicked_at").on(table.clickedAt),
	],
);

// ─── Phase 1: Session Foundation ────────────────────────────────────────────

// Teacher preferences and economy configuration
export const teacherSettings = pgTable("teacher_settings", {
	id: uuid("id").defaultRandom().primaryKey(),
	userId: text("user_id").notNull().unique(),
	// Mastery loop
	masteryThreshold: integer("mastery_threshold").notNull().default(3),
	// Comprehension alert
	confusionAlertPercent: integer("confusion_alert_percent").notNull().default(40),
	// Privacy option: replace student names with animal aliases in reports
	useAliasMode: boolean("use_alias_mode").notNull().default(false),
	// RAM Buck store schedule: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'manual'
	storeResetSchedule: text("store_reset_schedule").notNull().default("weekly"),
	storeIsOpen: boolean("store_is_open").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// A recurring class period — exists all semester. Teacher may have AM + PM + Period 3, etc.
export const classes = pgTable(
	"classes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: text("teacher_id").notNull(),
		label: text("label").notNull(), // "AM Math", "PM Math", "Period 3"
		periodTime: text("period_time").notNull().default(""), // "8:00 AM", "12:30 PM"
		gradeLevel: text("grade_level").notNull().default("5"),
		subject: text("subject").notNull().default("Math"),
		isArchived: boolean("is_archived").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_classes_teacher_id").on(table.teacherId)],
);

// Students on a class roster. No accounts — just school ID + initials.
export const rosterEntries = pgTable(
	"roster_entries",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		// School-assigned student ID (e.g. "10293847")
		studentId: text("student_id").notNull(),
		// Full names when available (preferred over initials)
		firstName: text("first_name"),
		lastName: text("last_name"),
		// Display initials — always present (derived from names if provided)
		firstInitial: text("first_initial").notNull(),
		lastInitial: text("last_initial").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		performanceScore: integer("performance_score"), // nullable — prior-year score for auto-grouping
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_roster_entries_class_id").on(table.classId),
		uniqueIndex("idx_roster_class_student").on(table.classId, table.studentId),
	],
);

// A single daily meeting of a class. New session created each day teacher starts class.
export const classSessions = pgTable(
	"class_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		teacherId: text("teacher_id").notNull(),
		// 6-char uppercase alphanumeric code (no 0/O/I/1), e.g. "X7K2M9"
		joinCode: text("join_code").notNull().unique(),
		// YYYY-MM-DD — which calendar day this session is for
		date: text("date").notNull(),
		// "active" | "ended"
		status: text("status").notNull().default("active"),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		endedAt: timestamp("ended_at", { withTimezone: true }),
		// Auto-expire after 30 days for data hygiene
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		index("idx_class_sessions_class_id").on(table.classId),
		index("idx_class_sessions_teacher_id").on(table.teacherId),
		uniqueIndex("idx_class_sessions_join_code").on(table.joinCode),
		index("idx_class_sessions_status").on(table.status),
	],
);

// ─── Phase 2: Comprehension Pulse ────────────────────────────────────────────

// Latest comprehension signal per student per session — upserted on each tap.
// Only the most recent signal matters; full history is not needed.
export const comprehensionSignals = pgTable(
	"comprehension_signals",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => classSessions.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		// 3-state signal: "got-it" | "almost" | "lost"
		signal: text("signal").notNull(),
		// When this signal was last set
		signalledAt: timestamp("signalled_at", { withTimezone: true }).defaultNow().notNull(),
		// Timestamp when student FIRST entered the "lost" state this session.
		// Reset to null when student moves off "lost".
		// Used to detect 60s stuck threshold for auto-push.
		lostSince: timestamp("lost_since", { withTimezone: true }),
	},
	(table) => [
		index("idx_comprehension_session_id").on(table.sessionId),
		uniqueIndex("idx_comprehension_session_roster").on(table.sessionId, table.rosterId),
	],
);

// Teacher-initiated (or auto) push of a manipulative spec to confused students.
export const manipulativePushes = pgTable(
	"manipulative_pushes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => classSessions.id, { onDelete: "cascade" }),
		// "teacher" | "auto"
		triggeredBy: text("triggered_by").notNull().default("teacher"),
		// JSON-serialized ManipulativeSpec (same shape as CoachResponse["manipulative"])
		spec: text("spec").notNull(),
		// FL BEST standard this manipulative targets (optional — not set for generic presets)
		standardCode: text("standard_code"),
		pushedAt: timestamp("pushed_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_manipulative_pushes_session_id").on(table.sessionId)],
);

// ─── Phase 4: Mastery Loop ───────────────────────────────────────────────────

// Tracks mastery progress per student per FL BEST standard per session.
// Upserted on every check-question answer.
export const masteryRecords = pgTable(
	"mastery_records",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => classSessions.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		// FL BEST standard code (e.g. "MA.5.FR.1.1")
		standardCode: text("standard_code").notNull(),
		// Number of consecutive correct answers in the current streak
		consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
		totalAttempts: integer("total_attempts").notNull().default(0),
		// "working" | "mastered"
		status: text("status").notNull().default("working"),
		achievedAt: timestamp("achieved_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_mastery_session_roster_std").on(
			table.sessionId,
			table.rosterId,
			table.standardCode,
		),
		index("idx_mastery_session_id").on(table.sessionId),
	],
);

// ─── Phase 5: Drawing Analysis ───────────────────────────────────────────────

// Claude Vision analysis of a student's canvas sketch. Image is NOT stored —
// only the text analysis result is persisted.
export const drawingAnalyses = pgTable(
	"drawing_analyses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => classSessions.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		// FL BEST standard the student was working on
		standardCode: text("standard_code").notNull(),
		// "correct" | "partial" | "misconception"
		analysisType: text("analysis_type").notNull().default("partial"),
		// Claude's plain-language analysis of the drawing
		analysisText: text("analysis_text").notNull(),
		// Short encouragement / correction shown to student
		studentFeedback: text("student_feedback").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_drawing_analyses_session_id").on(table.sessionId),
		index("idx_drawing_analyses_roster_id").on(table.rosterId),
	],
);

// ─── Phase 7: Student Groups ──────────────────────────────────────────────────

export const studentGroups = pgTable(
	"student_groups",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		name: text("name").notNull(), // "Dogs", "Cats", "Birds", "Bears" (teacher can rename)
		emoji: text("emoji").notNull().default("🐾"),
		color: text("color").notNull().default("blue"), // for UI theming
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_student_groups_class_id").on(table.classId)],
);

export const groupMemberships = pgTable(
	"group_memberships",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		groupId: uuid("group_id")
			.notNull()
			.references(() => studentGroups.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_group_memberships_class_id").on(table.classId),
		uniqueIndex("idx_group_membership_roster").on(table.classId, table.rosterId),
	],
);

// ─── Phase 8: RAM Buck Economy ────────────────────────────────────────────────

export const ramBuckAccounts = pgTable(
	"ram_buck_accounts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		balance: integer("balance").notNull().default(0),
		lifetimeEarned: integer("lifetime_earned").notNull().default(0),
		lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_ram_buck_accounts_class_roster").on(table.classId, table.rosterId),
		index("idx_ram_buck_accounts_class_id").on(table.classId),
	],
);

export const ramBuckTransactions = pgTable(
	"ram_buck_transactions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		sessionId: uuid("session_id").references(() => classSessions.id, { onDelete: "set null" }),
		// "academic-correct" | "academic-mastery" | "academic-iready" | "behavior-positive" | "behavior-fine" | "purchase" | "manual-award" | "manual-deduct" | "reset"
		type: text("type").notNull(),
		amount: integer("amount").notNull(), // positive = earned, negative = deducted
		reason: text("reason").notNull().default(""),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_ram_buck_transactions_class_roster").on(table.classId, table.rosterId),
		index("idx_ram_buck_transactions_created_at").on(table.createdAt),
	],
);

export const ramBuckFeeSchedule = pgTable(
	"ram_buck_fee_schedule",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: text("teacher_id").notNull(),
		step: integer("step").notNull(), // 1-8
		label: text("label").notNull(),
		deductionAmount: integer("deduction_amount").notNull(), // positive number, will be applied as negative
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_fee_schedule_teacher_step").on(table.teacherId, table.step),
		index("idx_fee_schedule_teacher_id").on(table.teacherId),
	],
);

export const groupAccounts = pgTable(
	"group_accounts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		groupId: uuid("group_id")
			.notNull()
			.references(() => studentGroups.id, { onDelete: "cascade" }),
		balance: integer("balance").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("idx_group_accounts_group").on(table.classId, table.groupId)],
);

// ─── Phase 9: Behavior Ladder ─────────────────────────────────────────────────

export const behaviorProfiles = pgTable(
	"behavior_profiles",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		currentStep: integer("current_step").notNull().default(0), // 0 = no incidents
		teacherNotes: text("teacher_notes").notNull().default(""),
		lastIncidentAt: timestamp("last_incident_at", { withTimezone: true }),
		lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_behavior_profiles_class_roster").on(table.classId, table.rosterId),
		index("idx_behavior_profiles_class_id").on(table.classId),
	],
);

export const behaviorIncidents = pgTable(
	"behavior_incidents",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		sessionId: uuid("session_id").references(() => classSessions.id, { onDelete: "set null" }),
		step: integer("step").notNull(), // what step was reached
		label: text("label").notNull(), // "Ram Buck Fine", "No Games", etc.
		notes: text("notes").notNull().default(""),
		ramBuckDeduction: integer("ram_buck_deduction").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_behavior_incidents_class_roster").on(table.classId, table.rosterId),
		index("idx_behavior_incidents_created_at").on(table.createdAt),
	],
);

export const parentNotifications = pgTable(
	"parent_notifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		incidentId: uuid("incident_id").references(() => behaviorIncidents.id, {
			onDelete: "set null",
		}),
		message: text("message").notNull(),
		step: integer("step").notNull(),
		isSent: boolean("is_sent").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_parent_notifications_class_roster").on(table.classId, table.rosterId)],
);

// ─── Phase 10: Privilege Store ────────────────────────────────────────────────

export const privilegeItems = pgTable(
	"privilege_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		teacherId: text("teacher_id").notNull(),
		name: text("name").notNull(),
		cost: integer("cost").notNull().default(20),
		durationMinutes: integer("duration_minutes"),
		isActive: boolean("is_active").notNull().default(true),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("idx_privilege_items_teacher_id").on(table.teacherId)],
);

export const privilegePurchases = pgTable(
	"privilege_purchases",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		itemId: uuid("item_id")
			.notNull()
			.references(() => privilegeItems.id, { onDelete: "cascade" }),
		cost: integer("cost").notNull(), // snapshot at time of purchase
		// "pending" | "approved" | "rejected"
		status: text("status").notNull().default("pending"),
		requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_privilege_purchases_class_id").on(table.classId),
		index("idx_privilege_purchases_status").on(table.status),
	],
);

// ─── Phase 9 Cockpit: Parent Contacts + SMS Log ───────────────────────────────

export const parentContacts = pgTable(
	"parent_contacts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		parentName: text("parent_name").notNull().default(""),
		phone: text("phone").notNull(), // E.164 format: +1XXXXXXXXXX
		notes: text("notes").notNull().default(""),
		isActive: boolean("is_active").notNull().default(true), // soft delete
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_parent_contacts_class_roster").on(table.classId, table.rosterId),
		index("idx_parent_contacts_class_id").on(table.classId),
	],
);

export const parentMessages = pgTable(
	"parent_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		incidentId: uuid("incident_id").references(() => behaviorIncidents.id, {
			onDelete: "set null",
		}),
		phone: text("phone").notNull(),
		body: text("body").notNull(),
		// "incident" | "broadcast" | "academic-guidance" | "manual"
		triggeredBy: text("triggered_by").notNull(),
		// "sent" | "failed"
		status: text("status").notNull(),
		smsSid: text("sms_sid"),
		sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_parent_messages_class_roster").on(table.classId, table.rosterId),
		index("idx_parent_messages_sent_at").on(table.sentAt),
	],
);

// ─── Phase 11 Cockpit: Ambient Intelligence ───────────────────────────────────

export const correctionRequests = pgTable(
	"correction_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => classSessions.id, { onDelete: "cascade" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		context: text("context").notNull().default(""), // what student was stuck on (max 200)
		// "pending" | "acknowledged"
		status: text("status").notNull().default("pending"),
		acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_correction_requests_session_id").on(table.sessionId),
		index("idx_correction_requests_status").on(table.status),
	],
);

export const ambientAlerts = pgTable(
	"ambient_alerts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sessionId: uuid("session_id")
			.notNull()
			.references(() => classSessions.id, { onDelete: "cascade" }),
		// "noise" | "transcript-anomaly" | "correction"
		alertType: text("alert_type").notNull(),
		// "low" | "medium" | "high"
		severity: text("severity").notNull().default("medium"),
		details: text("details").notNull().default(""),
		isAcknowledged: boolean("is_acknowledged").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_ambient_alerts_session_id").on(table.sessionId),
		index("idx_ambient_alerts_is_acknowledged").on(table.isAcknowledged),
	],
);

// ─── Phase 12: Gradebook ──────────────────────────────────────────────────────

export const cfuEntries = pgTable(
	"cfu_entries",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classId: uuid("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		sessionId: uuid("session_id").references(() => classSessions.id, { onDelete: "set null" }),
		rosterId: uuid("roster_id")
			.notNull()
			.references(() => rosterEntries.id, { onDelete: "cascade" }),
		standardCode: text("standard_code").notNull(),
		score: integer("score").notNull(), // 0-4 (0=absent, 1-4=proficiency)
		notes: text("notes").notNull().default(""),
		date: text("date").notNull(), // YYYY-MM-DD
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_cfu_entries_class_id").on(table.classId),
		index("idx_cfu_entries_date").on(table.date),
		uniqueIndex("idx_cfu_entry_unique").on(
			table.classId,
			table.rosterId,
			table.date,
			table.standardCode,
		),
	],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
	linkItems: many(linkItems),
}));

export const linkItemsRelations = relations(linkItems, ({ one, many }) => ({
	profile: one(profiles, {
		fields: [linkItems.profileId],
		references: [profiles.id],
	}),
	clickEvents: many(clickEvents),
}));

export const clickEventsRelations = relations(clickEvents, ({ one }) => ({
	linkItem: one(linkItems, {
		fields: [clickEvents.linkItemId],
		references: [linkItems.id],
	}),
}));

export const classesRelations = relations(classes, ({ many }) => ({
	rosterEntries: many(rosterEntries),
	classSessions: many(classSessions),
	studentGroups: many(studentGroups),
	ramBuckAccounts: many(ramBuckAccounts),
	behaviorProfiles: many(behaviorProfiles),
	cfuEntries: many(cfuEntries),
}));

export const rosterEntriesRelations = relations(rosterEntries, ({ one, many }) => ({
	class: one(classes, {
		fields: [rosterEntries.classId],
		references: [classes.id],
	}),
	groupMemberships: many(groupMemberships),
	ramBuckAccounts: many(ramBuckAccounts),
	ramBuckTransactions: many(ramBuckTransactions),
	behaviorProfiles: many(behaviorProfiles),
	behaviorIncidents: many(behaviorIncidents),
	cfuEntries: many(cfuEntries),
}));

export const classSessionsRelations = relations(classSessions, ({ one }) => ({
	class: one(classes, {
		fields: [classSessions.classId],
		references: [classes.id],
	}),
}));

export const studentGroupsRelations = relations(studentGroups, ({ one, many }) => ({
	class: one(classes, {
		fields: [studentGroups.classId],
		references: [classes.id],
	}),
	memberships: many(groupMemberships),
	groupAccounts: many(groupAccounts),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
	class: one(classes, {
		fields: [groupMemberships.classId],
		references: [classes.id],
	}),
	group: one(studentGroups, {
		fields: [groupMemberships.groupId],
		references: [studentGroups.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [groupMemberships.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const ramBuckAccountsRelations = relations(ramBuckAccounts, ({ one }) => ({
	class: one(classes, {
		fields: [ramBuckAccounts.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [ramBuckAccounts.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const ramBuckTransactionsRelations = relations(ramBuckTransactions, ({ one }) => ({
	class: one(classes, {
		fields: [ramBuckTransactions.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [ramBuckTransactions.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const groupAccountsRelations = relations(groupAccounts, ({ one }) => ({
	class: one(classes, {
		fields: [groupAccounts.classId],
		references: [classes.id],
	}),
	group: one(studentGroups, {
		fields: [groupAccounts.groupId],
		references: [studentGroups.id],
	}),
}));

export const behaviorProfilesRelations = relations(behaviorProfiles, ({ one }) => ({
	class: one(classes, {
		fields: [behaviorProfiles.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [behaviorProfiles.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const behaviorIncidentsRelations = relations(behaviorIncidents, ({ one, many }) => ({
	class: one(classes, {
		fields: [behaviorIncidents.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [behaviorIncidents.rosterId],
		references: [rosterEntries.id],
	}),
	parentNotifications: many(parentNotifications),
}));

export const parentNotificationsRelations = relations(parentNotifications, ({ one }) => ({
	class: one(classes, {
		fields: [parentNotifications.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [parentNotifications.rosterId],
		references: [rosterEntries.id],
	}),
	incident: one(behaviorIncidents, {
		fields: [parentNotifications.incidentId],
		references: [behaviorIncidents.id],
	}),
}));

export const privilegeItemsRelations = relations(privilegeItems, ({ many }) => ({
	purchases: many(privilegePurchases),
}));

export const privilegePurchasesRelations = relations(privilegePurchases, ({ one }) => ({
	class: one(classes, {
		fields: [privilegePurchases.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [privilegePurchases.rosterId],
		references: [rosterEntries.id],
	}),
	item: one(privilegeItems, {
		fields: [privilegePurchases.itemId],
		references: [privilegeItems.id],
	}),
}));

export const cfuEntriesRelations = relations(cfuEntries, ({ one }) => ({
	class: one(classes, {
		fields: [cfuEntries.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [cfuEntries.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const parentContactsRelations = relations(parentContacts, ({ one }) => ({
	class: one(classes, {
		fields: [parentContacts.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [parentContacts.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const parentMessagesRelations = relations(parentMessages, ({ one }) => ({
	class: one(classes, {
		fields: [parentMessages.classId],
		references: [classes.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [parentMessages.rosterId],
		references: [rosterEntries.id],
	}),
	incident: one(behaviorIncidents, {
		fields: [parentMessages.incidentId],
		references: [behaviorIncidents.id],
	}),
}));

export const correctionRequestsRelations = relations(correctionRequests, ({ one }) => ({
	session: one(classSessions, {
		fields: [correctionRequests.sessionId],
		references: [classSessions.id],
	}),
	rosterEntry: one(rosterEntries, {
		fields: [correctionRequests.rosterId],
		references: [rosterEntries.id],
	}),
}));

export const ambientAlertsRelations = relations(ambientAlerts, ({ one }) => ({
	session: one(classSessions, {
		fields: [ambientAlerts.sessionId],
		references: [classSessions.id],
	}),
}));

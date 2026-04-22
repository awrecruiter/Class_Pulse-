import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";
import { db } from "@/lib/db";
import {
	classAssignments,
	classes,
	interventionFlags,
	parentReportTokens,
	rosterEntries,
} from "@/lib/db/schema";
import { getTopicForDate } from "@/lib/pacing";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Academic Support Summary — Class Pulse" };

interface PageProps {
	params: Promise<{ token: string }>;
}

export default async function ReportPage({ params }: PageProps) {
	const { token } = await params;

	const [tokenRow] = await db
		.select({
			id: parentReportTokens.id,
			flagId: parentReportTokens.flagId,
			expiresAt: parentReportTokens.expiresAt,
			viewedAt: parentReportTokens.viewedAt,
		})
		.from(parentReportTokens)
		.where(eq(parentReportTokens.token, token));

	if (!tokenRow || tokenRow.expiresAt < new Date()) notFound();

	if (!tokenRow.viewedAt) {
		db.update(parentReportTokens)
			.set({ viewedAt: new Date() })
			.where(eq(parentReportTokens.id, tokenRow.id))
			.catch(() => {});
	}

	const [flag] = await db
		.select({
			tier: interventionFlags.tier,
			standardCode: interventionFlags.standardCode,
			sessionCount: interventionFlags.sessionCount,
			classId: interventionFlags.classId,
			rosterId: interventionFlags.rosterId,
			detectedAt: interventionFlags.detectedAt,
		})
		.from(interventionFlags)
		.where(eq(interventionFlags.id, tokenRow.flagId));

	if (!flag) notFound();

	const [roster] = await db
		.select({
			firstInitial: rosterEntries.firstInitial,
			lastInitial: rosterEntries.lastInitial,
			studentId: rosterEntries.studentId,
		})
		.from(rosterEntries)
		.where(eq(rosterEntries.id, flag.rosterId));

	const [cls] = await db
		.select({ label: classes.label, gradeLevel: classes.gradeLevel })
		.from(classes)
		.where(eq(classes.id, flag.classId));

	// Fetch the assignment for the date the flag was detected
	const flagDate = flag.detectedAt.toISOString().slice(0, 10);
	const [assignmentRow] = await db
		.select({ content: classAssignments.content })
		.from(classAssignments)
		.where(and(eq(classAssignments.classId, flag.classId), eq(classAssignments.date, flagDate)));

	const standard = FL_BEST_STANDARDS.find((s) => s.code === flag.standardCode);
	const currentTopic = getTopicForDate(new Date().toISOString().slice(0, 10));
	const studentDisplay = roster
		? `${roster.firstInitial}.${roster.lastInitial}. (ID: ${roster.studentId})`
		: "Your student";

	const tierTitle =
		flag.tier === "tier3"
			? "Persistent Difficulty — Multiple Standards"
			: "Repeated Difficulty — Same Standard";

	const tierExplain =
		flag.tier === "tier3"
			? `Your student has struggled across multiple math standards over the past several weeks. This pattern suggests they may benefit from additional support to build foundational understanding.`
			: `Your student has shown difficulty with the same math standard in ${flag.sessionCount} class sessions. This suggests the concept may need reinforcement at home.`;

	const homeStrategies = [
		`Practice ${flag.standardCode} using free resources on Khan Academy Kids or IXL Math.`,
		"Ask your child to explain what they are learning — teaching out loud helps retention.",
		"Look for real-life examples: fractions in cooking, measurement around the house, multiplication when shopping.",
		"Set aside 10–15 minutes 3× per week for focused math practice.",
		"Reach out to the teacher to ask about specific areas to target.",
	];

	const dateStr = flag.detectedAt.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const tierColor = flag.tier === "tier3" ? "#991b1b" : "#92400e";
	const tierBg = flag.tier === "tier3" ? "#fee2e2" : "#fef3c7";

	return (
		<div
			style={{
				fontFamily: "Georgia, 'Times New Roman', serif",
				background: "#fff",
				color: "#1a1a1a",
				padding: "1.5rem",
				maxWidth: "680px",
				margin: "0 auto",
			}}
		>
			<style>{`
        @media (min-width: 480px) { .report-wrap { padding: 2.5rem !important; } }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
        }
      `}</style>

			{/* Header */}
			<div
				style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem", marginBottom: "1.5rem" }}
			>
				<h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
					Academic Support Summary
				</h1>
				<div style={{ fontSize: "0.85rem", color: "#555" }}>
					{cls ? `${cls.label} · Grade ${cls.gradeLevel}` : ""}
					{" · "}
					{dateStr}
				</div>
			</div>

			{/* Student */}
			<div style={{ marginBottom: "1.5rem" }}>
				<h2
					style={{
						fontSize: "0.8rem",
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						color: "#555",
						marginBottom: "0.5rem",
					}}
				>
					Student
				</h2>
				<p style={{ fontWeight: "bold", fontSize: "1.05rem", marginBottom: "0.5rem" }}>
					{studentDisplay}
				</p>
				<span
					style={{
						display: "inline-block",
						padding: "0.2rem 0.65rem",
						borderRadius: "999px",
						fontSize: "0.72rem",
						fontWeight: "bold",
						textTransform: "uppercase",
						letterSpacing: "0.05em",
						background: tierBg,
						color: tierColor,
					}}
				>
					{tierTitle}
				</span>
			</div>

			{/* Observation */}
			<div style={{ marginBottom: "1.5rem" }}>
				<h2
					style={{
						fontSize: "0.8rem",
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						color: "#555",
						marginBottom: "0.5rem",
					}}
				>
					What Was Observed
				</h2>
				<p style={{ lineHeight: 1.65, marginBottom: "0.75rem" }}>{tierExplain}</p>
				<div
					style={{
						background: "#f5f5f5",
						borderLeft: "4px solid #1a1a1a",
						padding: "0.75rem 1rem",
						borderRadius: "2px",
						marginBottom: "0.75rem",
					}}
				>
					<div style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: "1rem" }}>
						{flag.standardCode}
					</div>
					{standard && (
						<div
							style={{ fontSize: "0.9rem", marginTop: "0.25rem", color: "#333", lineHeight: 1.5 }}
						>
							{standard.description}
						</div>
					)}
				</div>
				<p style={{ lineHeight: 1.65 }}>
					This standard was observed as a difficulty point in{" "}
					<strong>
						{flag.sessionCount} class session{flag.sessionCount !== 1 ? "s" : ""}
					</strong>
					.
				</p>
			</div>

			{/* Home strategies */}
			<div style={{ marginBottom: "1.5rem" }}>
				<h2
					style={{
						fontSize: "0.8rem",
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						color: "#555",
						marginBottom: "0.5rem",
					}}
				>
					How You Can Help at Home
				</h2>
				<ul style={{ paddingLeft: "1.25rem" }}>
					{homeStrategies.map((s) => (
						<li key={s} style={{ lineHeight: 1.65, marginBottom: "0.35rem" }}>
							{s}
						</li>
					))}
				</ul>
			</div>

			{/* Tonight's assignment — shown if teacher set one for the session date */}
			{assignmentRow?.content && (
				<div style={{ marginBottom: "1.5rem" }}>
					<h2
						style={{
							fontSize: "0.8rem",
							textTransform: "uppercase",
							letterSpacing: "0.08em",
							color: "#555",
							marginBottom: "0.5rem",
						}}
					>
						Tonight&apos;s Practice
					</h2>
					<div
						style={{
							background: "#eef2ff",
							borderLeft: "4px solid #4f46e5",
							padding: "0.75rem 1rem",
							borderRadius: "2px",
						}}
					>
						<p style={{ lineHeight: 1.65, margin: 0, fontFamily: "system-ui, sans-serif" }}>
							{assignmentRow.content}
						</p>
					</div>
				</div>
			)}

			{/* What the class is working on right now */}
			{currentTopic && (
				<div style={{ marginBottom: "1.5rem" }}>
					<h2
						style={{
							fontSize: "0.8rem",
							textTransform: "uppercase",
							letterSpacing: "0.08em",
							color: "#555",
							marginBottom: "0.5rem",
						}}
					>
						Currently in Class
					</h2>
					<p style={{ lineHeight: 1.65, fontFamily: "system-ui, sans-serif", fontSize: "0.9rem" }}>
						Topic {currentTopic.roman}: <strong>{currentTopic.title}</strong>
						{currentTopic.standardCodes.length > 0 && (
							<span style={{ color: "#777", fontSize: "0.8rem" }}>
								{" "}
								({currentTopic.standardCodes.slice(0, 2).join(", ")}
								{currentTopic.standardCodes.length > 2 ? "…" : ""})
							</span>
						)}
					</p>
				</div>
			)}

			{/* Next steps */}
			<div style={{ marginBottom: "2rem" }}>
				<h2
					style={{
						fontSize: "0.8rem",
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						color: "#555",
						marginBottom: "0.5rem",
					}}
				>
					Next Steps
				</h2>
				<p style={{ lineHeight: 1.65 }}>
					Your child&apos;s teacher will continue to provide targeted support in class. If you have
					questions or would like to discuss additional resources, please reach out directly.
				</p>
			</div>

			{/* Print button */}
			<div className="no-print" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
				<PrintButton />
			</div>

			{/* Footer */}
			<div
				style={{
					paddingTop: "1rem",
					borderTop: "1px solid #ddd",
					fontSize: "0.78rem",
					color: "#999",
					lineHeight: 1.5,
				}}
			>
				This report was generated by Class Pulse and is intended for the parent/guardian of the
				student listed above. Student information is limited to initials and school ID in accordance
				with FERPA guidelines. This link expires in 30 days.
			</div>
		</div>
	);
}

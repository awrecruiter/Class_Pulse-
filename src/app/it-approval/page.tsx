"use client";

import { CheckIcon, ChevronDownIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PROD_URL = "https://class-pulse-nine.vercel.app";
const APP_DOMAIN = "class-pulse-nine.vercel.app";
const CONTACT_EMAIL = "support@classpulse.com";

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({
	id,
	className,
	children,
}: {
	id?: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section id={id} className={cn("py-16 sm:py-24", className)}>
			<div className="mx-auto max-w-5xl px-4 sm:px-6">{children}</div>
		</section>
	);
}

function SectionLabel({ children, light }: { children: React.ReactNode; light?: boolean }) {
	return (
		<p
			className={cn(
				"text-xs font-bold uppercase tracking-widest mb-3",
				light ? "text-blue-400" : "text-blue-600",
			)}
		>
			{children}
		</p>
	);
}

function CheckItem({ children, light }: { children: React.ReactNode; light?: boolean }) {
	return (
		<li className="flex items-start gap-2.5">
			<CheckIcon
				className={cn("mt-0.5 h-4 w-4 shrink-0", light ? "text-blue-400" : "text-blue-600")}
			/>
			<span className={cn("text-sm leading-relaxed", light ? "text-white/80" : "text-gray-700")}>
				{children}
			</span>
		</li>
	);
}

function XItem({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2.5">
			<XIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
			<span className="text-sm leading-relaxed text-gray-700">{children}</span>
		</li>
	);
}

function AccordionItem({ question, answer }: { question: string; answer: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="border-b border-gray-200 last:border-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors gap-4"
			>
				<span>{question}</span>
				<ChevronDownIcon
					className={cn(
						"h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && <p className="pb-5 text-sm text-gray-600 leading-relaxed">{answer}</p>}
		</div>
	);
}

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
	return (
		<div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl ring-1 ring-black/20">
			<div className="flex items-center gap-1.5 bg-[#1a1d27] px-4 py-2.5 border-b border-white/8">
				<span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
				<span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
				<span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
				<span className="ml-2 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-white/30 font-mono">
					{APP_DOMAIN}
				</span>
			</div>
			<Image src={src} alt={alt} width={1440} height={900} className="w-full h-auto" unoptimized />
		</div>
	);
}

function PillBadge({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
			{children}
		</span>
	);
}

function DataRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-gray-100 last:border-0">
			<dt className="w-44 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500">
				{label}
			</dt>
			<dd className="text-sm text-gray-900 font-mono">{value}</dd>
		</div>
	);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ITApprovalPage() {
	return (
		<div className="min-h-screen bg-white text-gray-900">
			{/* Nav */}
			<nav className="sticky top-0 z-40 bg-[#0f1117]/95 backdrop-blur border-b border-white/8">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
					<Link
						href="/homeschool"
						className="text-lg font-bold text-white tracking-tight hover:text-white/80 transition-colors"
					>
						Class Pulse
					</Link>
					<div className="flex items-center gap-4">
						<span className="hidden sm:flex items-center gap-1.5 text-xs text-white/50">
							<ShieldCheckIcon className="h-3.5 w-3.5 text-green-400" />
							IT Review Document
						</span>
						<a
							href={`mailto:${CONTACT_EMAIL}`}
							className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-colors"
						>
							Contact Developer
						</a>
					</div>
				</div>
			</nav>

			{/* Hero */}
			<section className="bg-[#0f1117] pt-20 sm:pt-28 pb-16">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="max-w-3xl">
						<div className="flex flex-wrap gap-2 mb-6">
							<PillBadge>IT URL Approval Request</PillBadge>
							<PillBadge>Teacher-Facing Tool</PillBadge>
							<PillBadge>FL BEST Math · 5th Grade</PillBadge>
						</div>
						<h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5">
							Class Pulse — Network Access Request
						</h1>
						<p className="text-base sm:text-lg text-white/70 leading-relaxed mb-6">
							Class Pulse is a classroom intelligence platform built for 5th-grade Florida math
							teachers. This document is submitted for IT review to obtain network access approval
							for the application domain.
						</p>
						<p className="text-sm text-white/40 font-mono">{PROD_URL}</p>
					</div>
				</div>
			</section>

			{/* Application Identifier */}
			<Section className="bg-white">
				<SectionLabel>Application Identity</SectionLabel>
				<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-6">
					Platform Overview &amp; Technical Identity
				</h2>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
					<dl className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-2">
						<DataRow label="Application Name" value="Class Pulse" />
						<DataRow label="Primary Domain" value={APP_DOMAIN} />
						<DataRow label="Hosting Provider" value="Vercel (Edge Network)" />
						<DataRow label="Framework" value="Next.js 15 App Router" />
						<DataRow label="Database" value="PostgreSQL via Neon Serverless" />
						<DataRow label="Auth Provider" value="Neon Auth (OpenID Connect)" />
						<DataRow label="Transport" value="HTTPS / TLS 1.3 only" />
						<DataRow label="Real-Time" value="Server-Sent Events (SSE) — no WebSockets" />
						<DataRow label="AI Provider" value="Anthropic / Google Gemini (see AI section)" />
						<DataRow label="SMS (optional)" value="AWS SNS — teacher-initiated only" />
						<DataRow label="Developer Contact" value={CONTACT_EMAIL} />
					</dl>
					<div className="space-y-4">
						<p className="text-gray-600 text-sm leading-relaxed">
							Class Pulse is a teacher-authenticated web application. It is not a consumer app.
							Access requires a school-issued teacher account. Students access a separate, no-login
							session surface using a 6-character join code generated per class period.
						</p>
						<p className="text-gray-600 text-sm leading-relaxed">
							All traffic is encrypted end-to-end via HTTPS/TLS. No data is transmitted over plain
							HTTP. The application does not require special firewall rules beyond standard outbound
							HTTPS (port 443).
						</p>
						<div className="rounded-xl bg-blue-50 border border-blue-100 p-5">
							<p className="text-blue-800 text-xs font-bold uppercase tracking-wide mb-2">
								Ports &amp; Protocols Required
							</p>
							<ul className="space-y-1 text-sm text-blue-900 font-mono">
								<li>443/TCP — HTTPS (all app surfaces)</li>
								<li>443/TCP — WSS not used; SSE over HTTPS only</li>
								<li>No inbound ports required on district network</li>
							</ul>
						</div>
					</div>
				</div>
			</Section>

			{/* AI Section */}
			<Section id="ai" className="bg-gray-50">
				<SectionLabel>AI &amp; API Usage</SectionLabel>
				<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-4">
					AI Provider: Gemini-Compatible by Design
				</h2>
				<p className="text-gray-600 text-base leading-relaxed mb-8 max-w-3xl">
					Class Pulse currently routes AI features through Anthropic's Claude API. Because the
					district has an active Google Gemini contract, the platform can be reconfigured to use the{" "}
					<strong>Google Gemini API</strong> instead — avoiding any out-of-pocket AI spend and
					keeping all AI processing within the district's existing vendor agreement.
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
					<div className="rounded-2xl border border-gray-200 bg-white p-6">
						<p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
							Current Setup
						</p>
						<p className="text-sm font-semibold text-gray-900 mb-1">Anthropic Claude Haiku</p>
						<p className="text-sm text-gray-600 leading-relaxed">
							Used for instructional coaching, voice command classification, behavior coach chat,
							lecture visualization, and drawing analysis. API key is teacher/developer-managed.
						</p>
					</div>
					<div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
						<p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
							District Gemini Option
						</p>
						<p className="text-sm font-semibold text-blue-900 mb-1">Google Gemini Flash / Pro</p>
						<p className="text-sm text-blue-800 leading-relaxed">
							The AI layer can be swapped to use the district's Google Gemini API key. Same
							features, same PII protections, billed to the district's existing Gemini contract. No
							extra third-party AI vendor required.
						</p>
					</div>
				</div>
				<div className="rounded-xl bg-white border border-gray-200 p-6 max-w-3xl">
					<p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						What AI Receives — and What It Never Receives
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
						<div>
							<p className="text-xs font-semibold text-green-700 mb-2">✓ Sent to AI</p>
							<ul className="space-y-1 text-sm text-gray-700">
								<li>Current FL BEST Math standard being taught</li>
								<li>Rolling lesson transcript (ephemeral, never stored)</li>
								<li>Student ID numbers only (school-assigned, numeric)</li>
								<li>Comprehension signal aggregate (not per-student)</li>
								<li>Behavior type and step number (no names)</li>
							</ul>
						</div>
						<div>
							<p className="text-xs font-semibold text-red-700 mb-2">✗ Never Sent to AI</p>
							<ul className="space-y-1 text-sm text-gray-700">
								<li>Student first or last names</li>
								<li>Student photos or biometrics</li>
								<li>Parent contact information or phone numbers</li>
								<li>Teacher personal information</li>
								<li>Drawing images (only analysis result stored)</li>
							</ul>
						</div>
					</div>
				</div>
			</Section>

			{/* PII Section */}
			<section id="pii" className="bg-[#0f1117] py-16 sm:py-24">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<SectionLabel light>Data Privacy &amp; PII</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
						Student Data: Minimized by Architecture
					</h2>
					<p className="text-white/70 text-base leading-relaxed mb-10 max-w-3xl">
						Class Pulse was designed from the ground up with a "minimum viable identity" model. The
						system stores only what is operationally necessary — and the teacher remains the
						responsible party for any PII entered into the platform.
					</p>

					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
						{[
							{
								title: "Student Roster",
								body: "Each student is stored as a school-assigned ID number plus first initial and last initial only (e.g., 10293847 — J.M.). No full names are required by the system.",
								note: "Teacher may optionally enter first names for their own display convenience. This is under the teacher's control and responsibility.",
							},
							{
								title: "Parent Contacts",
								body: "Parent phone numbers and email addresses are stored in the teacher's class record for behavior notification purposes. They are never shared with third parties or used for marketing.",
								note: "Parent contact data is teacher-entered and teacher-controlled. The district's existing FERPA obligations apply. Class Pulse does not initiate contact — teacher action triggers all communications.",
							},
							{
								title: "Decoy IDs",
								body: "The platform supports using non-real, teacher-assigned decoy ID numbers in lieu of official SSID numbers. This allows operation without any official student identifier in the system.",
								note: "Decoy IDs give teachers full functionality with zero risk of official student ID exposure. The teacher decides which ID scheme to use.",
							},
						].map((card) => (
							<div
								key={card.title}
								className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col gap-3"
							>
								<p className="text-blue-400 text-xs font-bold uppercase tracking-widest">
									{card.title}
								</p>
								<p className="text-white/80 text-sm leading-relaxed">{card.body}</p>
								<p className="text-white/40 text-xs leading-relaxed border-t border-white/10 pt-3 italic">
									{card.note}
								</p>
							</div>
						))}
					</div>

					<div className="rounded-2xl bg-white/5 border border-white/10 p-6 max-w-3xl">
						<p className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
							<ShieldCheckIcon className="h-4 w-4 text-green-400" />
							Teacher Responsibility Statement
						</p>
						<p className="text-white/60 text-sm leading-relaxed">
							Class Pulse is a tool, not a data custodian. The platform enforces minimum data
							collection by design. However, teachers retain responsibility for any student or
							parent information they choose to enter. The school or district's existing FERPA
							policies and data governance agreements govern how Class Pulse is used within the
							institution. It is the teacher's responsibility to comply with district data handling
							requirements — including the decision of whether to enter real SSIDs, parent phone
							numbers, or student first names.
						</p>
					</div>
				</div>
			</section>

			{/* What is stored */}
			<Section className="bg-white">
				<SectionLabel>Data Inventory</SectionLabel>
				<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mb-6">
					Complete Data Storage Inventory
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
							Data Stored in Database
						</p>
						<ul className="space-y-2.5">
							{[
								"Teacher profile (name, email — Neon Auth managed)",
								"Class definitions (label, period time)",
								"Roster entries: student ID + 2 initials per student",
								"Comprehension signal log (signal type, timestamp, student ID)",
								"Mastery records (standard code, status, student ID)",
								"Behavior incidents (step number, type, student ID — no names)",
								"RAM Buck ledger (amounts, reason, student ID)",
								"Parent contacts (name, phone, email — teacher-entered)",
								"Parent report tokens (expiring, scoped to one student)",
								"Pacing and schedule configuration",
								"AI drawing analysis results (no images stored)",
							].map((d) => (
								<CheckItem key={d}>{d}</CheckItem>
							))}
						</ul>
					</div>
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
							Data Never Stored
						</p>
						<ul className="space-y-2.5">
							{[
								"Student photographs or biometric data",
								"Student Social Security numbers",
								"Student home addresses",
								"Lesson transcripts (ephemeral React state only)",
								"Drawing images submitted for AI analysis",
								"Student device identifiers or IP addresses",
								"Parent financial information",
								"Audio recordings of any kind",
							].map((d) => (
								<XItem key={d}>{d}</XItem>
							))}
						</ul>
					</div>
				</div>
			</Section>

			{/* Screenshots */}
			<Section id="screenshots" className="bg-gray-50">
				<div className="text-center mb-12">
					<SectionLabel>Application Screenshots</SectionLabel>
					<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
						What Teachers and Students See
					</h2>
				</div>
				<div className="space-y-10">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
							Teacher Dashboard — AI Instructional Coach
						</p>
						<BrowserFrame
							src="/screenshots/coach-scaffold.png"
							alt="Class Pulse AI coach scaffold showing teacher script, guiding questions and prerequisite gap for a FL BEST standard"
						/>
					</div>
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
							Teacher Dashboard — Live Session with Comprehension Pulse
						</p>
						<BrowserFrame
							src="/screenshots/coach-live-pulse.png"
							alt="Class Pulse live session dashboard showing student groups and comprehension aggregate"
						/>
					</div>
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
							Parent Report — Tokenized, No Login Required
						</p>
						<div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
							<Image
								src="/screenshots/parent-report.png"
								alt="Parent report showing student status tiles with initials and ID only — no full names"
								width={1440}
								height={900}
								className="w-full h-auto"
								unoptimized
							/>
						</div>
					</div>
				</div>
			</Section>

			{/* Auth & Access Control */}
			<section className="bg-[#0f1117] py-16 sm:py-24">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<SectionLabel light>Authentication &amp; Access Control</SectionLabel>
					<h2 className="text-3xl font-extrabold tracking-tight text-white mb-8">
						How Access Is Controlled
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
						{[
							{
								role: "Teacher",
								auth: "Neon Auth — OpenID Connect",
								detail:
									"Email + password or Google OAuth. JWT session. All teacher routes protected by server-side session check on every API call.",
							},
							{
								role: "Student",
								auth: "Signed Session Cookie",
								detail:
									"No account, no email, no password. Students enter a 6-character class join code and select their name from a roster list. Session is an HMAC-SHA256 signed cookie scoped to that session only.",
							},
							{
								role: "Parent",
								auth: "Tokenized URL",
								detail:
									"Teacher generates a one-time token. Parent visits a URL — no login required. Token is scoped to one student, one class, with configurable expiry.",
							},
						].map((r) => (
							<div key={r.role} className="rounded-2xl bg-white/5 border border-white/10 p-6">
								<p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">
									{r.role}
								</p>
								<p className="text-white text-sm font-semibold mb-2">{r.auth}</p>
								<p className="text-white/60 text-sm leading-relaxed">{r.detail}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* FAQ */}
			<Section className="bg-white">
				<div className="max-w-2xl mx-auto">
					<div className="text-center mb-10">
						<SectionLabel>IT FAQ</SectionLabel>
						<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
							Common IT Review Questions
						</h2>
					</div>
					<div className="rounded-2xl border border-gray-200 bg-white px-6 divide-y divide-gray-200">
						<AccordionItem
							question="Does the application require any special firewall rules?"
							answer="No inbound rules are required. Outbound HTTPS (port 443) to *.vercel.app and class-pulse-nine.vercel.app is sufficient. The app uses standard browser-initiated HTTPS and Server-Sent Events — no WebSocket connections, no special protocol requirements."
						/>
						<AccordionItem
							question="Does it collect or transmit student PII to third parties?"
							answer="No student PII is transmitted to any third party. AI API calls use student ID numbers only — never names, photos, or contact information. Parent phone numbers are stored in the database and used only by AWS SNS for teacher-initiated SMS — they are never shared externally for any other purpose."
						/>
						<AccordionItem
							question="Can it use the district's existing Google Gemini contract?"
							answer="Yes. The AI layer is configurable. The application can use the district's Google Gemini API key instead of the Anthropic key, eliminating any separate AI vendor relationship and billing Class Pulse AI usage against the district's existing Gemini agreement."
						/>
						<AccordionItem
							question="What student data leaves the district network?"
							answer="Student ID numbers and initials may appear in database records hosted on Neon (a SOC 2 Type II certified PostgreSQL provider) and Vercel (ISO 27001 certified). Lesson audio is never transmitted — the Web Speech API processes speech locally in the browser and returns only text transcripts, which are ephemeral. No student data is sent to advertising networks or analytics platforms."
						/>
						<AccordionItem
							question="Is student login safe? Can a student access another student's data?"
							answer="Student sessions use an HMAC-SHA256 signed cookie bound to a specific session ID and roster entry. The server validates the signature on every request. A student cannot fabricate or modify their session cookie to access another student's data. Students never see another student's scores, behavior records, or RAM Buck balance."
						/>
						<AccordionItem
							question="Does it install anything on district devices?"
							answer="No. Class Pulse is a web application accessed entirely through a standard browser. Nothing is installed on teacher or student devices. No browser extensions are required. It works on Chrome, Safari, Firefox, and Edge on any device — including Chromebooks."
						/>
						<AccordionItem
							question="Is this FERPA compliant?"
							answer="The platform is architected for FERPA compliance: student records are limited to ID + initials by default, AI systems never receive student names, parent reports use expiring tokens with no login, and the teacher controls all data entry. Full compliance depends on how the teacher uses the tool — specifically, teachers are responsible for the data they choose to enter (e.g., real SSIDs vs. decoy IDs, parent phone numbers)."
						/>
						<AccordionItem
							question="Who is the developer and how do I reach them?"
							answer={`Class Pulse is built and maintained by the classroom teacher using it. This is a teacher-built tool for teacher use. For technical questions or to arrange a walkthrough for your IT review, email ${CONTACT_EMAIL}.`}
						/>
					</div>
				</div>
			</Section>

			{/* Footer */}
			<section className="bg-[#0f1117] py-16 sm:py-20">
				<div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
					<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-4">
						Ready to Approve?
					</h2>
					<p className="text-base text-white/60 leading-relaxed mb-6">
						Class Pulse is a teacher-built, HTTPS-only, no-install web application. It requires
						outbound HTTPS access to one domain. For questions or a live walkthrough, contact the
						developer directly.
					</p>
					<a
						href={`mailto:${CONTACT_EMAIL}?subject=Class Pulse IT Approval Request`}
						className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-8 py-4 text-base font-bold text-white transition-colors shadow-lg"
					>
						Email Developer for Review
					</a>
					<p className="mt-8 text-sm text-white/30 font-mono">{PROD_URL}</p>
					<p className="mt-2 text-xs text-white/20">
						HTTPS · No install · Teacher-authenticated · Student data minimized by architecture
					</p>
				</div>
			</section>
		</div>
	);
}

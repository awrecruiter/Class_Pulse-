"use client";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Minimal nav for public marketing page ───────────────────────────────────

function MarketingNav() {
	return (
		<nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
				<Link href="/homeschool" className="text-lg font-bold text-gray-900 tracking-tight">
					Class Pulse
				</Link>
				<div className="flex items-center gap-3">
					<a
						href="#solution"
						className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
					>
						How It Works
					</a>
					<a
						href="https://class-pulse-nine.vercel.app/signup"
						className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors"
					>
						Pricing
					</a>
					<a
						href="https://class-pulse-nine.vercel.app/signup"
						className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
					>
						Get Started
					</a>
				</div>
			</div>
		</nav>
	);
}

// ─── Trust badge row ─────────────────────────────────────────────────────────

function TrustBadges() {
	const badges = ["Step Up for Students", "Florida ESA", "Arizona ESA", "FL BEST Aligned"];
	return (
		<div className="flex flex-wrap items-center justify-center gap-2 mt-6">
			{badges.map((b) => (
				<span
					key={b}
					className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
				>
					{b}
				</span>
			))}
		</div>
	);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

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

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">{children}</p>
	);
}

// ─── Check item ───────────────────────────────────────────────────────────────

function CheckItem({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2.5">
			<CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
			<span className="text-gray-700 text-sm leading-relaxed">{children}</span>
		</li>
	);
}

// ─── Pain item (X mark) ───────────────────────────────────────────────────────

function PainItem({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2.5">
			<XIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
			<span className="text-gray-700 text-sm leading-relaxed">{children}</span>
		</li>
	);
}

// ─── Accordion item ───────────────────────────────────────────────────────────

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

// ─── Full feature accordion group ─────────────────────────────────────────────

function FeatureGroup({ title, items }: { title: string; items: string[] }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="border-b border-gray-200 last:border-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between py-4 text-left text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors gap-4"
			>
				<span>{title}</span>
				<ChevronDownIcon
					className={cn(
						"h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200",
						open && "rotate-180",
					)}
				/>
			</button>
			{open && (
				<ul className="pb-5 space-y-2">
					{items.map((item) => (
						<CheckItem key={item}>{item}</CheckItem>
					))}
				</ul>
			)}
		</div>
	);
}

// ─── Feature card (for Features section) ─────────────────────────────────────

function FeatureCard({
	title,
	tagline,
	body,
	checks,
	closing,
	numbered,
}: {
	title: string;
	tagline?: string;
	body?: string;
	checks?: string[];
	closing?: string;
	numbered?: string[];
}) {
	return (
		<div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
			<h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
			{tagline && <p className="text-sm text-blue-600 font-medium mb-3">{tagline}</p>}
			{body && <p className="text-sm text-gray-600 leading-relaxed mb-4">{body}</p>}
			{checks && checks.length > 0 && (
				<ul className="space-y-2 mb-4">
					{checks.map((c) => (
						<CheckItem key={c}>{c}</CheckItem>
					))}
				</ul>
			)}
			{numbered && numbered.length > 0 && (
				<ol className="space-y-2 mb-4 list-none">
					{numbered.map((item, i) => (
						<li key={item} className="flex items-start gap-2.5">
							<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
								{i + 1}
							</span>
							<span className="text-gray-700 text-sm leading-relaxed">{item}</span>
						</li>
					))}
				</ol>
			)}
			{closing && (
				<p className="text-sm text-gray-500 italic border-t border-gray-100 pt-4 mt-2 leading-relaxed">
					{closing}
				</p>
			)}
		</div>
	);
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
	number,
	label,
	description,
}: {
	number: string;
	label: string;
	description: string;
}) {
	return (
		<div className="flex flex-col items-center text-center gap-3 px-4">
			<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
				{number}
			</div>
			<div>
				<p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">{label}</p>
				<p className="text-sm text-gray-600 leading-relaxed">{description}</p>
			</div>
		</div>
	);
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function CTAButton({
	href,
	children,
	variant = "primary",
}: {
	href: string;
	children: React.ReactNode;
	variant?: "primary" | "outline";
}) {
	const base =
		"inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold transition-colors";
	const styles =
		variant === "primary"
			? `${base} bg-blue-600 text-white hover:bg-blue-700`
			: `${base} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`;
	return (
		<a href={href} className={styles}>
			{children}
		</a>
	);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomeschoolPage() {
	return (
		<div className="min-h-screen bg-white text-gray-900">
			<MarketingNav />

			{/* ── Hero ──────────────────────────────────────────────────────────── */}
			<Section className="bg-gradient-to-b from-blue-50 to-white pt-20 sm:pt-28 pb-20 sm:pb-28">
				<div className="text-center max-w-3xl mx-auto">
					<div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-6">
						Built for Homeschool Families · FL BEST Math Aligned
					</div>
					<h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-5">
						The Platform That Runs Your Math Instruction While You Focus on Teaching
					</h1>
					<p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-4">
						Upload your curriculum. Class Pulse auto-serves checks for understanding to your child
						like a clicker system—they work in their book, submit answers on their device, and every
						response is automatically graded, tracked, and reported.
					</p>
					<p className="text-base text-gray-500 mb-8">
						When your child struggles, the platform tells you exactly what to practice at home. No
						searching. No guessing. No spreadsheets.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<CTAButton href="https://class-pulse-nine.vercel.app/signup">
							Get Class Pulse — Scholarship Eligible
						</CTAButton>
						<a
							href="#solution"
							className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
						>
							See the Platform ↓
						</a>
					</div>
					<TrustBadges />
				</div>
			</Section>

			{/* ── Problem ───────────────────────────────────────────────────────── */}
			<Section className="bg-white">
				<div className="max-w-2xl mx-auto">
					<SectionLabel>The Problem</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-5">
						You're Teaching the Lessons. But You're Also Doing Everything Else.
					</h2>
					<p className="text-base text-gray-600 mb-6 leading-relaxed">
						You chose to homeschool so your child gets the instruction they deserve. But you didn't
						sign up for:
					</p>
					<ul className="space-y-3 mb-8">
						<PainItem>Grading every worksheet by hand</PainItem>
						<PainItem>
							Building spreadsheets to track which standards your child has mastered
						</PainItem>
						<PainItem>Searching for intervention materials when they don't get something</PainItem>
						<PainItem>Wondering if you're on pace</PainItem>
						<PainItem>Trying to remember what they struggled with three weeks ago</PainItem>
						<PainItem>Having no proof of progress when it's time for portfolio reviews</PainItem>
					</ul>
					<div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
						<p className="text-base text-gray-700 leading-relaxed">
							You already have a curriculum. You already know how to teach. What you need is a
							system that handles the grading, the tracking, the pacing, and the intervention
							alerts—so you can focus on the actual instruction.
						</p>
					</div>
				</div>
			</Section>

			{/* ── Solution ──────────────────────────────────────────────────────── */}
			<Section id="solution" className="bg-blue-50">
				<div className="max-w-2xl mx-auto">
					<SectionLabel>The Solution</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-6">
						Your Curriculum. Your Teaching. Our Platform Runs Everything Else.
					</h2>
					<div className="space-y-5 text-base text-gray-700 leading-relaxed">
						<p>
							You upload the resources you already use. Class Pulse ingests them, maps them to FL
							BEST Math standards, and builds your pacing calendar. Every day, your child opens
							their device and the day's checks for understanding are waiting for them.
						</p>
						<p>
							They work in their physical book. They submit answers on their device like a clicker.
							The platform checks every answer against the answer key, logs the result, and updates
							their proficiency dashboard in real time.
						</p>
						<p>
							If they miss two in a row on the same standard, you get an alert with an at-home
							practice activity already generated and ready to use.
						</p>
					</div>
					<div className="mt-8 rounded-xl bg-white border border-blue-200 p-5">
						<p className="text-base font-semibold text-gray-900 text-center">
							You teach. The platform tracks. Everyone knows exactly where they stand.
						</p>
					</div>
				</div>
			</Section>

			{/* ── How It Works ──────────────────────────────────────────────────── */}
			<Section className="bg-white">
				<div className="text-center mb-12">
					<SectionLabel>How It Works</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
						Four Steps. One System.
					</h2>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
					<StepCard
						number="1"
						label="Upload"
						description="Upload your curriculum PDFs, bell ringers, CFU sets, and pacing guide one time"
					/>
					<StepCard
						number="2"
						label="Teach"
						description="You teach the lesson from your book. The platform serves the checks at the right moments"
					/>
					<StepCard
						number="3"
						label="Respond"
						description="Your child answers CFUs on their device like a clicker. Auto-graded. Auto-logged."
					/>
					<StepCard
						number="4"
						label="Review"
						description="Open your dashboard. See exactly what they mastered and where they need support"
					/>
				</div>
				{/* Connector line — desktop only */}
				<div className="hidden lg:flex items-center justify-center mt-2 relative">
					<div className="absolute top-[-5rem] left-[12.5%] right-[12.5%] h-px bg-blue-200" />
				</div>
			</Section>

			{/* ── Features ──────────────────────────────────────────────────────── */}
			<Section className="bg-gray-50">
				<div className="text-center mb-12">
					<SectionLabel>Features</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
						Everything You Need. Nothing You Don't.
					</h2>
				</div>

				{/* Group 1: Core Instructional Engine */}
				<div className="mb-10">
					<h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						Core Instructional Engine
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
						<FeatureCard
							title="Upload Your Curriculum Once. It Runs All Year."
							tagline="You don't switch to our curriculum. We ingest yours."
							checks={[
								"Upload Big Ideas Math, Go Math, Eureka Math, Saxon, or any textbook PDFs—the platform extracts lessons, problems, and answers automatically",
								"Upload your bell ringers, CFU sets, and exit tickets via CSV or PDF",
								"Upload your pacing guide or use our FL BEST-aligned default",
								"Edit, reorder, add, or skip anything at any time",
								"Works with any structured math curriculum",
							]}
							closing="Your child keeps their physical book. Class Pulse handles the digital layer."
						/>
						<FeatureCard
							title="CFUs That Work Like a Clicker System"
							body="During the lesson, checks for understanding appear on your child's device at the intervals you configure. They find the problem in their book, solve it, and submit the answer on screen."
							checks={[
								"Bell ringer auto-serves at lesson start",
								"CFU #1 appears at 15 minutes, CFU #2 at 25 minutes, exit ticket at the end",
								"Every answer checked against your answer key instantly",
								"Results logged to the gradebook automatically",
								"No printing. No grading. No manual entry.",
							]}
							closing="Your child gets immediate feedback. You get immediate data."
						/>
						<FeatureCard
							title="Automatic Proficiency Tracking"
							body="Every standard your child encounters is tracked. You see green, yellow, and red bars that update in real time as they submit answers."
							checks={[
								"Proficiency per standard, per unit, per semester",
								"Historical data builds automatically—proof of progress for portfolio reviews",
								"Exportable gradebook—CSV download anytime",
								"Pacing tracker shows if you're on schedule with your curriculum calendar",
							]}
							closing="Walk into any portfolio review or district check-in with a complete record of exactly what your child learned and when they learned it."
						/>
					</div>
				</div>

				{/* Group 2: Intervention Loop */}
				<div className="mb-10">
					<h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						The Intervention Loop
					</h3>
					<FeatureCard
						title="The Platform Alerts You the Moment Your Child Struggles"
						tagline="This is the feature that changes everything for homeschool parents."
						body="Your child misses two CFU problems on the same standard. The platform:"
						numbered={[
							"Flags the standard on your dashboard: 'MA.5.FR.2.2 — Needs Support'",
							"Auto-generates an at-home practice activity using the AI Instructional Coach—a 5-minute exercise targeting exactly that gap",
							"Notifies you that an intervention is ready",
						]}
						closing="You practice with your child using the generated activity. Next session, the platform serves a verification check on that standard. If they get it, the bar turns green. If not, it escalates for more targeted instruction. You don't wonder what to do. You don't search Pinterest for practice problems. The platform tells you exactly what your child needs and gives you the tool to address it—in the moment it matters."
					/>
				</div>

				{/* Group 3: AI Coach */}
				<div className="mb-10">
					<h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						AI Instructional Coach
					</h3>
					<FeatureCard
						title="Your AI Instructional Coach—Grounded in Today's Lesson"
						body="When your child is confused and you need a different way to explain something, the AI Instructional Coach is ready."
						checks={[
							"Speak or type what your child is struggling with",
							"The coach references today's lesson and the specific FL BEST standard",
							"Returns a 30-second intervention with a script to say, a visual to show, and a manipulative suggestion",
							"Pulls grade-below scaffolds if the gap traces to a prerequisite standard",
							"Grounded in the 108 FL BEST Math benchmarks for grades 3–5",
						]}
						closing="It's like having a math specialist on call during every lesson. No prep. No searching. Just the exact explanation you need, aligned to exactly what you're teaching right now."
					/>
				</div>

				{/* Group 4: Student Experience */}
				<div className="mb-10">
					<h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						Student Experience
					</h3>
					<FeatureCard
						title="Your Child's Device: Engaging, Simple, Child-Appropriate"
						body="The student-facing side of Class Pulse is designed for a 10-year-old."
						checks={[
							"Colorful, engaging interface—think Prodigy or Khan Academy Kids energy",
							"Join with a simple code—no account, no email, no password",
							"Comprehension signal: three faces to tap (😊 Got It / 🤔 Almost / 😕 Lost)",
							"Interactive manipulatives: fraction bars, area models, number lines",
							"Mastery loop: adaptive check questions after manipulatives",
							"Drawing canvas: your child can draw their thinking and submit it for analysis",
							"Waveform walkie-talkie: a visual amplitude bar that shows your voice when you're giving instruction",
						]}
						closing="This is not a dry quiz interface. It's built to keep kids engaged while they learn."
					/>
				</div>

				{/* Group 5: Behavior & Economy */}
				<div className="mb-10">
					<h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						Behavior &amp; Economy
					</h3>
					<FeatureCard
						title="A Classroom Economy That Motivates—Even in a Classroom of One"
						checks={[
							"Your child earns RAM Bucks for correct CFU answers, mastery achievements, and positive behavior",
							"You award bucks by voice or touch",
							"Your child sees their balance, transaction history, and earning guide",
							"They spend bucks at the Privilege Store on rewards you configure",
						]}
						closing="The behavior ladder is optional. Use what works for your family. Ignore what doesn't."
					/>
				</div>

				{/* Group 6: Parent Reports */}
				<div>
					<h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
						Parent Reports
					</h3>
					<FeatureCard
						title="Proof of Progress, Always Ready"
						body="Your parent dashboard is your command center. But you also get shareable, visual reports you can use for:"
						checks={[
							"Portfolio reviews with your umbrella school or district",
							"Annual evaluations required by your state",
							"Your own records and planning",
							"Sharing progress with a co-parent or tutor",
						]}
						closing="Reports include proficiency bars by standard, behavior summaries, intervention history, and IXL skill map recommendations. Export as PDF. Share as a link. Always available."
					/>
				</div>
			</Section>

			{/* ── Full Feature List ──────────────────────────────────────────────── */}
			<Section className="bg-white">
				<div className="max-w-2xl mx-auto">
					<div className="text-center mb-8">
						<SectionLabel>Complete Feature List</SectionLabel>
						<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
							For the Detail-Oriented Parent
						</h2>
						<p className="text-sm text-gray-500 mt-2">Click any category to expand</p>
					</div>
					<div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-200">
						<FeatureGroup
							title="Instructional Tools"
							items={[
								"AI Coach",
								"Lecture Visualizer",
								"Interactive Manipulatives",
								"Mastery Loop",
								"Drawing Analysis",
								"Comprehension Pulse",
							]}
						/>
						<FeatureGroup
							title="Planning & Resources"
							items={[
								"Curriculum Ingestion Engine",
								"Pacing Calendar",
								"Resource Catalog",
								"Schedule System",
							]}
						/>
						<FeatureGroup
							title="Tracking & Reports"
							items={[
								"Automatic Gradebook",
								"Proficiency Dashboard",
								"Parent Report Tokens",
								"CSV Export",
								"Intervention Flags",
							]}
						/>
						<FeatureGroup
							title="Student Experience"
							items={[
								"Clicker-Style CFU Response",
								"Comprehension Signal",
								"RAM Buck Balance & Store",
								"Transaction History",
								"Waveform Walkie-Talkie",
								"Drawing Canvas",
							]}
						/>
						<FeatureGroup
							title="Behavior & Economy"
							items={[
								"RAM Buck Economy",
								"Behavior Ladder",
								"RAM Buck Fee Schedule",
								"Privilege Store",
								"Group Coins",
							]}
						/>
						<FeatureGroup
							title="Classroom Display"
							items={["Board Surface", "Resource Viewer", "Voice Commands"]}
						/>
						<FeatureGroup
							title="Access & Support"
							items={[
								"Teacher Cockpit",
								"Mobile-First Design",
								"Student Device Support",
								"FERPA-compliant",
							]}
						/>
					</div>
				</div>
			</Section>

			{/* ── Pricing ───────────────────────────────────────────────────────── */}
			<Section id="pricing" className="bg-blue-50">
				<div className="max-w-2xl mx-auto text-center">
					<SectionLabel>Pricing</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">
						Class Pulse Homeschool Subscription
					</h2>
					<div className="mt-6 mb-6 rounded-2xl border border-blue-200 bg-white p-8">
						<div className="flex items-baseline justify-center gap-1 mb-2">
							<span className="text-5xl font-extrabold text-gray-900">$299</span>
							<span className="text-xl text-gray-500">/ year per student</span>
						</div>
						<p className="text-sm text-gray-600 mb-6 leading-relaxed">
							Everything above. One student. One year. Full platform access. Unlimited curriculum
							uploads. Every feature included.
						</p>
						<div className="flex flex-wrap items-center justify-center gap-2 mb-6">
							{[
								"Step Up for Students",
								"Florida ESA",
								"Arizona ESA",
								"ClassWallet",
								"and more",
							].map((p) => (
								<span
									key={p}
									className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
								>
									{p}
								</span>
							))}
						</div>
						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							<CTAButton href="https://class-pulse-nine.vercel.app/signup">
								Purchase with Scholarship
							</CTAButton>
							<CTAButton href="https://class-pulse-nine.vercel.app/signup" variant="outline">
								Purchase Out-of-Pocket
							</CTAButton>
						</div>
					</div>
					<p className="text-sm text-gray-500">
						Multiple children? Each needs their own subscription for individual proficiency
						tracking, but you manage everyone from the same dashboard.
					</p>
				</div>
			</Section>

			{/* ── Scholarship Flow ───────────────────────────────────────────────── */}
			<Section id="scholarship" className="bg-white">
				<div className="max-w-2xl mx-auto">
					<SectionLabel>Scholarship Dollars</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-6">
						How to Use Your Scholarship Dollars
					</h2>
					<ol className="space-y-4 mb-8">
						{[
							'Select "Purchase with Scholarship" at checkout',
							"Choose your scholarship program from the list",
							"Enter your scholarship ID",
							"We verify eligibility and process through the scholarship platform",
							"Your child gets access immediately upon verification",
							"Upload your curriculum and start",
						].map((step, i) => (
							<li key={step} className="flex items-start gap-3">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
									{i + 1}
								</span>
								<span className="text-base text-gray-700 leading-relaxed pt-0.5">{step}</span>
							</li>
						))}
					</ol>
					<p className="text-sm text-gray-500 mb-6">Typical verification: 1–3 business days.</p>
					<div className="flex flex-wrap gap-2 mb-6">
						{["Step Up for Students", "Florida ESA", "Arizona ESA", "ClassWallet", "Odyssey"].map(
							(p) => (
								<span
									key={p}
									className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700"
								>
									{p}
								</span>
							),
						)}
					</div>
					<a
						href="https://class-pulse-nine.vercel.app/signup"
						className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-4 transition-colors"
					>
						Check Scholarship Eligibility
					</a>
				</div>
			</Section>

			{/* ── FAQ ───────────────────────────────────────────────────────────── */}
			<Section className="bg-gray-50">
				<div className="max-w-2xl mx-auto">
					<div className="text-center mb-10">
						<SectionLabel>FAQ</SectionLabel>
						<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
							Common Questions
						</h2>
					</div>
					<div className="rounded-2xl border border-gray-200 bg-white px-6 divide-y divide-gray-200">
						<AccordionItem
							question="Do I have to use a specific curriculum?"
							answer="No. Upload whatever math curriculum you're using—Big Ideas Math, Go Math, Eureka Math, Saxon, Math-U-See, or your own resources. The platform ingests your materials. You're not locked into our content because we don't provide content. We provide the system that runs your content."
						/>
						<AccordionItem
							question="How does the clicker-style CFU system work?"
							answer="Your child does their work in their physical textbook. When a check for understanding appears on their device, they find the corresponding problem in their book, solve it, and enter the answer on screen. The platform checks it against the answer key you uploaded, logs the result, and updates their proficiency dashboard. They keep their book. The device is just for submitting answers and getting feedback."
						/>
						<AccordionItem
							question="What does my child see on their device?"
							answer="The student interface is colorful and engaging. They see bell ringers and CFU prompts, a comprehension signal with three faces to express how they're feeling, interactive manipulatives for hands-on practice, their RAM Bucks balance and store, and progress indicators. It's designed for a 10-year-old."
						/>
						<AccordionItem
							question="How is this different from just using a PDF and a spreadsheet?"
							answer="A PDF doesn't grade answers. A spreadsheet doesn't auto-serve content at the right moment. Neither one alerts you when your child needs intervention. Neither one generates at-home practice activities. Neither one tracks proficiency by standard automatically. Class Pulse does all of it. You upload once. It runs the system."
						/>
						<AccordionItem
							question="Can I use this for multiple children?"
							answer="Yes. Each child needs their own subscription for individual proficiency tracking and gradebook. But you manage everyone from one parent dashboard. Group accounts let siblings earn Group Coins together toward shared rewards."
						/>
						<AccordionItem
							question="What about the behavior management features? I'm not running a classroom."
							answer="Many homeschool parents use the RAM Buck economy as a motivational system. Your child earns bucks for completing work and demonstrating effort. They spend bucks on privileges you define—extra screen time, choosing dinner, a park trip. The behavior ladder is optional. Use what works for your family. Ignore what doesn't."
						/>
						<AccordionItem
							question="Do I need to be tech-savvy to set this up?"
							answer="If you can upload a PDF and click 'approve,' you can use Class Pulse. The cockpit walks you through setup with color-coded status indicators. Upload your curriculum. Follow the green lights. Start teaching. Most families are fully set up in under an hour."
						/>
						<AccordionItem
							question="Can I see my child's progress over time?"
							answer="Yes. The proficiency dashboard shows bar charts per standard, colored green (mastered), yellow (practicing), or red (needs support). Historical data builds automatically. Export it anytime as a CSV or PDF. Perfect for portfolio reviews, annual evaluations, or just your own peace of mind."
						/>
						<AccordionItem
							question="Is my child's data private?"
							answer="Yes. Your child is identified by initials and an ID you assign. No full names. No photos stored. No personal information in our AI systems. The platform is FERPA-compliant. Your data belongs to you."
						/>
						<AccordionItem
							question="What if I need help?"
							answer="Email support is included. We're a small team built by a Florida teacher—you'll talk to a human who understands homeschool instruction."
						/>
					</div>
				</div>
			</Section>

			{/* ── Footer CTA ────────────────────────────────────────────────────── */}
			<Section className="bg-gray-900 text-white">
				<div className="text-center max-w-2xl mx-auto">
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
						Your Curriculum. Your Teaching. One Platform That Runs the System.
					</h2>
					<p className="text-base text-gray-300 leading-relaxed mb-6">
						Upload your resources. Auto-serve checks for understanding. Track proficiency
						automatically. Get alerted when your child needs help—with the practice activity already
						ready.
					</p>
					<p className="text-sm font-semibold text-blue-400 mb-8">
						$299/year per student. Scholarship eligible.
					</p>
					<a
						href="https://class-pulse-nine.vercel.app/signup"
						className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-4 text-base font-bold text-white hover:bg-blue-500 transition-colors"
					>
						Get Class Pulse Now
					</a>
					<p className="mt-8 text-sm text-gray-400">
						Questions? Email:{" "}
						<a
							href="mailto:families@classpulse.com"
							className="text-blue-400 hover:text-blue-300 transition-colors"
						>
							families@classpulse.com
						</a>
					</p>
					<p className="mt-4 text-xs text-gray-600">
						Step Up for Students · ESA Eligible · FL BEST Math Aligned · Built by a Florida Teacher
					</p>
				</div>
			</Section>
		</div>
	);
}

"use client";

import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const SIGNUP_URL = "https://class-pulse-nine.vercel.app/signup";
const PRICE_MONTHLY = 29;
const PRICE_ANNUAL = 249;
const PRICE_ANNUAL_SAVINGS = PRICE_MONTHLY * 12 - PRICE_ANNUAL;

// ─── Nav ──────────────────────────────────────────────────────────────────────

function MarketingNav() {
	return (
		<nav className="sticky top-0 z-40 bg-[#0f1117]/95 backdrop-blur border-b border-white/8">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
				<Link href="/homeschool" className="text-lg font-bold text-white tracking-tight">
					Class Pulse
				</Link>
				<div className="flex items-center gap-3">
					<a
						href="#features"
						className="hidden sm:block text-sm text-white/60 hover:text-white transition-colors"
					>
						Features
					</a>
					<a
						href="#pricing"
						className="hidden sm:block text-sm text-white/60 hover:text-white transition-colors"
					>
						Pricing
					</a>
					<a
						href={SIGNUP_URL}
						className="inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-bold text-black transition-colors"
					>
						Get Started
					</a>
				</div>
			</div>
		</nav>
	);
}

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
				light ? "text-amber-400" : "text-amber-500",
			)}
		>
			{children}
		</p>
	);
}

// ─── List items ───────────────────────────────────────────────────────────────

function CheckItem({ children, light }: { children: React.ReactNode; light?: boolean }) {
	return (
		<li className="flex items-start gap-2.5">
			<CheckIcon
				className={cn("mt-0.5 h-4 w-4 shrink-0", light ? "text-amber-400" : "text-amber-500")}
			/>
			<span className={cn("text-sm leading-relaxed", light ? "text-white/80" : "text-gray-700")}>
				{children}
			</span>
		</li>
	);
}

function PainItem({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2.5">
			<XIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
			<span className="text-gray-700 text-sm leading-relaxed">{children}</span>
		</li>
	);
}

// ─── Device frames ────────────────────────────────────────────────────────────

function IPhone17e({ src, alt, width = 220 }: { src: string; alt: string; width?: number }) {
	const steel =
		"linear-gradient(160deg, #d4d2ca 0%, #a8a4a0 18%, #c8c6be 34%, #909090 50%, #bab8b0 66%, #ceccc4 82%, #a4a2a0 100%)";
	const btn = "#9c9a98";
	return (
		<div className="relative mx-auto select-none" style={{ width }}>
			{/* Volume up */}
			<div
				className="absolute"
				style={{
					left: -3,
					top: 72,
					width: 3,
					height: 18,
					background: btn,
					borderRadius: "2px 0 0 2px",
					boxShadow: "inset 1px 0 0 rgba(255,255,255,0.3), inset -1px 0 0 rgba(0,0,0,0.15)",
				}}
			/>
			{/* Volume down */}
			<div
				className="absolute"
				style={{
					left: -3,
					top: 100,
					width: 3,
					height: 18,
					background: btn,
					borderRadius: "2px 0 0 2px",
					boxShadow: "inset 1px 0 0 rgba(255,255,255,0.3), inset -1px 0 0 rgba(0,0,0,0.15)",
				}}
			/>
			{/* Power */}
			<div
				className="absolute"
				style={{
					right: -3,
					top: 88,
					width: 3,
					height: 30,
					background: btn,
					borderRadius: "0 2px 2px 0",
					boxShadow: "inset -1px 0 0 rgba(255,255,255,0.3), inset 1px 0 0 rgba(0,0,0,0.15)",
				}}
			/>
			{/* Body */}
			<div
				style={{
					background: steel,
					borderRadius: 36,
					padding: "7px 6px 6px",
					boxShadow:
						"0 20px 50px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.4)",
				}}
			>
				{/* Screen */}
				<div
					className="relative overflow-hidden bg-black"
					style={{ borderRadius: 30, aspectRatio: "9/19.5" }}
				>
					{/* Dynamic Island */}
					<div
						className="absolute z-10"
						style={{
							top: 9,
							left: "50%",
							transform: "translateX(-50%)",
							width: "38%",
							height: "3%",
							background: "#000",
							borderRadius: 99,
						}}
					/>
					<Image
						src={src}
						alt={alt}
						width={390}
						height={844}
						className="w-full h-full object-cover object-top"
						unoptimized
					/>
				</div>
				{/* Home bar */}
				<div className="flex justify-center mt-1.5">
					<div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.12)" }} />
				</div>
			</div>
		</div>
	);
}

function TabletFrame({ src, alt, width = 380 }: { src: string; alt: string; width?: number }) {
	return (
		<div className="relative mx-auto select-none" style={{ width, maxWidth: width }}>
			<div
				style={{
					backgroundColor: "#1c1c1e",
					borderRadius: 28,
					padding: "28px 14px 18px",
					boxShadow:
						"0 30px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.07)",
				}}
			>
				{/* Front camera */}
				<div className="flex justify-center mb-2.5">
					<div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2c2c2e" }} />
				</div>
				{/* Screen */}
				<div className="overflow-hidden" style={{ borderRadius: 14 }}>
					<Image
						src={src}
						alt={alt}
						width={768}
						height={1024}
						className="w-full h-auto block"
						unoptimized
					/>
				</div>
				{/* Home bar */}
				<div className="flex justify-center mt-3">
					<div style={{ width: 36, height: 4, borderRadius: 2, background: "#3a3a3c" }} />
				</div>
			</div>
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
					class-pulse.app/student
				</span>
			</div>
			<Image src={src} alt={alt} width={1440} height={900} className="w-full h-auto" unoptimized />
		</div>
	);
}

// ─── Accordions ───────────────────────────────────────────────────────────────

function AccordionItem({ question, answer }: { question: string; answer: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="border-b border-gray-200 last:border-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold text-gray-900 hover:text-amber-600 transition-colors gap-4"
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

function FeatureGroup({ title, items }: { title: string; items: string[] }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="border-b border-gray-200 last:border-0">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between py-4 text-left text-sm font-bold text-gray-900 hover:text-amber-600 transition-colors gap-4"
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

// ─── CTA ──────────────────────────────────────────────────────────────────────

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
		"inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold transition-colors";
	const styles =
		variant === "primary"
			? `${base} bg-amber-500 text-black hover:bg-amber-400`
			: `${base} border border-white/20 bg-white/5 text-white hover:bg-white/10`;
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

			{/* ── Hero ────────────────────────────────────────────────────────── */}
			<section className="bg-[#0f1117] pt-20 sm:pt-28 pb-0">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
						{/* Left: copy */}
						<div>
							<div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-6">
								Built for Homeschool Families · FL BEST Math Aligned
							</div>
							<h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5">
								The Classroom Experience, At Home
							</h1>
							<p className="text-base sm:text-lg text-white/70 leading-relaxed mb-4">
								Your child answers on their device. Class Pulse grades it, tracks it, flags gaps,
								and generates practice activities—automatically. You teach. The platform runs the
								system.
							</p>
							<p className="text-sm text-white/50 mb-8">
								Step Up · Florida ESA · Arizona ESA · ClassWallet eligible · from ${PRICE_MONTHLY}
								/mo
							</p>
							<div className="flex flex-wrap gap-3">
								<CTAButton href={SIGNUP_URL}>Start Free Trial</CTAButton>
								<CTAButton href="#features" variant="outline">
									See How It Works
								</CTAButton>
							</div>
						</div>
						{/* Right: iPhone mockup */}
						<div className="flex justify-center lg:justify-end pb-0">
							<IPhone17e
								src="/screenshots/student-session-pulse.png"
								alt="Student session on iPhone 17e"
								width={220}
							/>
						</div>
					</div>
				</div>
			</section>

			{/* ── Problem ─────────────────────────────────────────────────────── */}
			<Section className="bg-white">
				<div className="max-w-3xl mx-auto">
					<SectionLabel>The Problem</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-6">
						You're the teacher, the grader, the tracker, and the intervention specialist.
					</h2>
					<p className="text-base text-gray-600 leading-relaxed mb-6">
						Every day you try to teach a full lesson, figure out what your child understood, grade
						their work, track proficiency, and decide what needs more practice. That's four separate
						jobs happening simultaneously.
					</p>
					<ul className="space-y-3 mb-6">
						{[
							"You can't tell if your child actually understood the lesson—or just got through it",
							"You're manually grading everything and building spreadsheets to track standards",
							"You know you should be differentiating, but you don't know where the gap is or how to fill it",
							"When they're stuck, you have to become a math tutor on the spot with no resources",
							"Portfolio reviews require scrambling to reconstruct what they actually learned",
						].map((p) => (
							<PainItem key={p}>{p}</PainItem>
						))}
					</ul>
					<p className="text-base font-semibold text-gray-800">
						Class Pulse was built to handle those four jobs so you can focus on the one that
						matters: teaching.
					</p>
				</div>
			</Section>

			{/* ── How It Works ────────────────────────────────────────────────── */}
			<Section id="features" className="bg-gray-50">
				<div className="text-center mb-12">
					<SectionLabel>How It Works</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
						Upload Once. It Runs the System.
					</h2>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
					{[
						{
							n: "1",
							label: "Upload",
							desc: "Upload your curriculum — bell ringers, CFU sets, exit tickets, pacing guides. CSV or PDF.",
						},
						{
							n: "2",
							label: "Teach",
							desc: "Your child works in their book. Prompts appear on their device at the right moment. They submit answers.",
						},
						{
							n: "3",
							label: "Track",
							desc: "Every answer auto-graded, logged by standard, and charted. You see proficiency in real time.",
						},
						{
							n: "4",
							label: "Intervene",
							desc: "When a gap appears, the platform flags it, generates a practice activity, and tells you exactly what to do.",
						},
					].map((s) => (
						<div key={s.n} className="flex flex-col items-center text-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-black text-sm font-bold shadow-lg">
								{s.n}
							</div>
							<p className="text-xs font-bold uppercase tracking-widest text-amber-600">
								{s.label}
							</p>
							<p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
						</div>
					))}
				</div>
			</Section>

			{/* ── Feature: Comprehension Pulse ────────────────────────────────── */}
			<section className="bg-[#0f1117] py-16 sm:py-24">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
						<div>
							<SectionLabel light>Live Comprehension</SectionLabel>
							<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
								You Know Instantly If Your Child Is Lost
							</h2>
							<p className="text-white/70 text-base leading-relaxed mb-6">
								During instruction, your child taps one of three signals on their device. You see
								the response immediately. No guessing. No waiting until the test.
							</p>
							<ul className="space-y-2.5">
								{[
									"Got It — they're following the lesson",
									"Almost — they need a little more",
									"I'm Lost — stop and re-teach this concept",
									"Teacher Is Live indicator shows your child when you're actively speaking",
									"Waveform visualizer pulses with your voice amplitude in real time",
								].map((c) => (
									<CheckItem key={c} light>
										{c}
									</CheckItem>
								))}
							</ul>
						</div>
						<div>
							<BrowserFrame
								src="/screenshots/coach-live-pulse.png"
								alt="Class Pulse teacher dashboard showing live session with 20 students in colorful group chips and comprehension panel"
							/>
						</div>
					</div>
				</div>
			</section>

			{/* ── Feature: AI Coach ───────────────────────────────────────────── */}
			<section className="bg-[#1a1d27] py-16 sm:py-24">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="text-center max-w-2xl mx-auto mb-10">
						<SectionLabel light>AI Instructional Coach</SectionLabel>
						<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
							A Math Specialist On Call During Every Lesson
						</h2>
						<p className="text-white/70 text-base leading-relaxed">
							Speak or type what your child is struggling with. The AI Coach references today's FL
							BEST standard, returns a 30-second script to say, a visual to show, and pulls the
							exact prerequisite gap if the confusion traces to an earlier grade level.
						</p>
					</div>
					<BrowserFrame
						src="/screenshots/coach-scaffold.png"
						alt="Class Pulse AI scaffold card showing teacher script, guiding questions, and prerequisite gap for MA.5.FR.2.1 fractions"
					/>
					<div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
						{[
							{
								label: "Script to Say",
								desc: "Exact language to re-explain the concept in a different way",
							},
							{
								label: "Prerequisite Gap",
								desc: "Identifies if the confusion traces to a grade-level gap from 3rd or 4th grade",
							},
							{
								label: "Practice Resources",
								desc: "Auto-surfaces aligned IXL skills and Khan Academy videos for the specific standard",
							},
						].map((f) => (
							<div key={f.label} className="rounded-xl bg-white/5 border border-white/8 p-5">
								<p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
									{f.label}
								</p>
								<p className="text-white/70 text-sm leading-relaxed">{f.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Feature: Student Experience ─────────────────────────────────── */}
			<Section className="bg-white">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
					<div className="order-2 lg:order-1 flex justify-center">
						<IPhone17e
							src="/screenshots/student-session-pulse.png"
							alt="Student session on iPhone 17e showing comprehension signal"
							width={220}
						/>
					</div>
					<div className="order-1 lg:order-2">
						<SectionLabel>Student Experience</SectionLabel>
						<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
							Your Child's Device: Engaging, Simple, Child-Appropriate
						</h2>
						<p className="text-gray-600 text-base leading-relaxed mb-6">
							The student side is designed for a 10-year-old. No account to create. No email. No
							password. Enter a code and they're in.
						</p>
						<ul className="space-y-2.5">
							{[
								"Comprehension signal: four-button response (Got it · Almost · Need help · I'm Lost)",
								"RAM Bucks balance displayed at the top — always visible",
								"Group affiliation with coin balance for group activities",
								"Interactive manipulatives: fraction bars, area models, number lines",
								"Mastery loop: adaptive check questions after every manipulative",
								"Drawing canvas: draw their thinking, submit for AI analysis",
								"Waveform walkie-talkie: pulses when you're speaking",
							].map((c) => (
								<CheckItem key={c}>{c}</CheckItem>
							))}
						</ul>
					</div>
				</div>
			</Section>

			{/* ── Multi-device access ────────────────────────────────────────── */}
			<section className="bg-[#0f1117] py-14 sm:py-20">
				<div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
					<SectionLabel light>Works Everywhere</SectionLabel>
					<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">
						Your child joins from any device — no app to install
					</h2>
					<p className="text-white/50 text-sm mb-12">
						iPhone · iPad · Any browser · Chromebook · PC
					</p>
					<div className="flex flex-col lg:flex-row items-end justify-center gap-10 lg:gap-14">
						{/* iPhone 17e */}
						<div className="flex flex-col items-center gap-3">
							<IPhone17e
								src="/screenshots/student-session-pulse.png"
								alt="Student session on iPhone 17e"
								width={200}
							/>
							<span className="text-xs text-white/60 font-semibold tracking-wide uppercase">
								iPhone
							</span>
						</div>
						{/* iPad tablet */}
						<div className="flex flex-col items-center gap-3">
							<TabletFrame
								src="/screenshots/student-session-pulse.png"
								alt="Student session on iPad"
								width={200}
							/>
							<span className="text-xs text-white/60 font-semibold tracking-wide uppercase">
								iPad
							</span>
						</div>
						{/* Desktop browser */}
						<div className="flex flex-col items-center gap-3" style={{ width: 340 }}>
							<BrowserFrame
								src="/screenshots/student-join.png"
								alt="Student join page in desktop browser"
							/>
							<span className="text-xs text-white/60 font-semibold tracking-wide uppercase">
								Any Browser
							</span>
						</div>
					</div>
				</div>
			</section>

			{/* ── Feature: Parent Report ──────────────────────────────────────── */}
			<section className="bg-gray-50 py-16 sm:py-24">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-12">
						<div>
							<SectionLabel>Parent Reports</SectionLabel>
							<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
								Proof of Progress — Shareable, Always Ready
							</h2>
							<p className="text-gray-600 text-base leading-relaxed mb-6">
								After every session, a visual report is one link away. Send it to your umbrella
								school, co-parent, or tutor. No scrambling. No spreadsheet. Just tap Share.
							</p>
							<ul className="space-y-2.5">
								{[
									"Behavior status tile: Good standing or current ladder step",
									"Academics tile: On Track, Approaching, or Needs Support",
									"Today's comprehension signal — exactly how they felt in the lesson",
									"Teacher flag: the specific standard they're struggling with and for how long",
									"Linked IXL skill and Khan Academy video for at-home practice tonight",
									"Conversation starter: one question to ask your child at dinner",
									"FERPA-compliant: initials + ID only, no full names stored",
								].map((c) => (
									<CheckItem key={c}>{c}</CheckItem>
								))}
							</ul>
						</div>
						<div className="flex justify-center">
							<IPhone17e
								src="/screenshots/parent-report.png"
								alt="Parent report showing behavior and academics tiles on iPhone"
								width={300}
							/>
						</div>
					</div>
				</div>
			</section>

			{/* ── Feature: Behavior & Economy ─────────────────────────────────── */}
			<section className="bg-[#0f1117] py-16 sm:py-24">
				<div className="mx-auto max-w-5xl px-4 sm:px-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
						<div>
							<SectionLabel light>Behavior &amp; Economy</SectionLabel>
							<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
								A Classroom Economy That Motivates — Even in a Classroom of One
							</h2>
							<p className="text-white/70 text-base leading-relaxed mb-6">
								RAM Bucks are your child's currency. They earn them for correct answers, mastery
								achievements, and positive behavior. They spend them at the Privilege Store on
								rewards you configure.
							</p>
							<ul className="space-y-2.5 mb-6">
								{[
									"Balance always visible in the student app — they always know what they've earned",
									"You award bucks by voice command or touch during the lesson",
									"Transaction history shows exactly how every buck was earned",
									"Privilege Store: you set the items and prices — extra screen time, park trip, choose dinner",
									"Group Coins: sibling groups earn coins together toward shared activities",
									"Behavior ladder is optional — use what fits your family",
								].map((c) => (
									<CheckItem key={c} light>
										{c}
									</CheckItem>
								))}
							</ul>
						</div>
						<div className="flex flex-col gap-6">
							<IPhone17e
								src="/screenshots/student-store.png"
								alt="Student store on iPhone 17e"
								width={220}
							/>
						</div>
					</div>
					<div className="mt-12">
						<BrowserFrame
							src="/screenshots/store-seeded.png"
							alt="Teacher Privilege Store showing 6 reward items with RAM Buck prices and Grant to Student buttons"
						/>
					</div>
				</div>
			</section>

			{/* ── Feature: Intervention Loop ──────────────────────────────────── */}
			<Section className="bg-white">
				<div className="max-w-3xl mx-auto">
					<SectionLabel>The Intervention Loop</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
						The Platform Alerts You the Moment Your Child Struggles
					</h2>
					<p className="text-gray-600 text-base leading-relaxed mb-6">
						This is the feature that changes everything for homeschool parents. Your child misses
						two CFU problems on the same standard. The platform:
					</p>
					<ol className="space-y-4 mb-6">
						{[
							{
								label: "Flags the standard",
								desc: "Your dashboard shows: 'MA.5.FR.2.2 — Needs Support'",
							},
							{
								label: "Generates the activity",
								desc: "Auto-creates a 5-minute at-home practice exercise targeting exactly that gap using the AI Instructional Coach",
							},
							{
								label: "Notifies you",
								desc: "An intervention is ready — you know exactly what to do and you have the tool to do it",
							},
						].map((s, i) => (
							<li key={s.label} className="flex items-start gap-4">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-black text-xs font-bold">
									{i + 1}
								</span>
								<div>
									<span className="font-semibold text-gray-900">{s.label} — </span>
									<span className="text-gray-600 text-sm">{s.desc}</span>
								</div>
							</li>
						))}
					</ol>
					<p className="text-sm text-gray-500 italic border-t border-gray-100 pt-4 leading-relaxed">
						You practice with your child using the generated activity. Next session, the platform
						serves a verification check on that standard. If they get it, the bar turns green. If
						not, it escalates. You don't wonder what to do. You don't search Pinterest for practice
						problems. The platform tells you exactly what your child needs and gives you the tool to
						address it — in the moment it matters.
					</p>
				</div>
			</Section>

			{/* ── Feature: Tracking ───────────────────────────────────────────── */}
			<Section className="bg-gray-50">
				<div className="max-w-3xl mx-auto">
					<SectionLabel>Progress Tracking</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
						A Complete Record, Built Automatically
					</h2>
					<ul className="space-y-2.5 mb-4">
						{[
							"Proficiency dashboard: bars per FL BEST standard, colored green / yellow / red",
							"Every CFU answer logged by standard and date — no manual entry",
							"Gradebook with class-wide and individual views",
							"Export as CSV for your records or portfolio review",
							"Pacing tracker shows if you're on schedule with your curriculum calendar",
						].map((c) => (
							<CheckItem key={c}>{c}</CheckItem>
						))}
					</ul>
					<p className="text-sm text-gray-500 italic">
						Walk into any portfolio review or district check-in with a complete record of exactly
						what your child learned and when they learned it.
					</p>
				</div>
			</Section>

			{/* ── Full Feature List ────────────────────────────────────────────── */}
			<Section className="bg-white">
				<div className="max-w-2xl mx-auto">
					<div className="text-center mb-8">
						<SectionLabel>Complete Feature List</SectionLabel>
						<h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
							For the Detail-Oriented Parent
						</h2>
						<p className="text-sm text-gray-500 mt-2">Click any category to expand</p>
					</div>
					<div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-200 px-6">
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

			{/* ── Pricing ─────────────────────────────────────────────────────── */}
			<section id="pricing" className="bg-[#0f1117] py-16 sm:py-24">
				<div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
					<SectionLabel light>Pricing</SectionLabel>
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
						Class Pulse Homeschool Subscription
					</h2>
					<p className="text-white/50 text-sm mb-8">
						One student. Full platform access. Every feature included.
					</p>

					<div className="grid sm:grid-cols-2 gap-5 mt-2 mb-6">
						{/* Monthly card */}
						<div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col text-left">
							<p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
								Monthly
							</p>
							<div className="flex items-baseline gap-1 mb-1">
								<span className="text-5xl font-extrabold text-white">${PRICE_MONTHLY}</span>
								<span className="text-base text-white/50">/ mo</span>
							</div>
							<p className="text-xs text-white/40 mb-6">Billed month to month · cancel anytime</p>
							<ul className="flex flex-col gap-2 mb-8 flex-1">
								{[
									"Unlimited curriculum uploads",
									"AI instructional coach",
									"Comprehension pulse",
									"Mastery tracking & reports",
									"Parent-ready progress reports",
								].map((f) => (
									<li key={f} className="flex items-center gap-2 text-sm text-white/70">
										<span className="text-amber-400">✓</span>
										{f}
									</li>
								))}
							</ul>
							<CTAButton href={SIGNUP_URL} variant="outline">
								Start Monthly
							</CTAButton>
						</div>

						{/* Annual card */}
						<div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-8 flex flex-col text-left relative">
							<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 text-xs font-bold text-black tracking-wide">
								BEST VALUE
							</span>
							<p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70 mb-4">
								Annual
							</p>
							<div className="flex items-baseline gap-1 mb-1">
								<span className="text-5xl font-extrabold text-white">${PRICE_ANNUAL}</span>
								<span className="text-base text-white/50">/ year</span>
							</div>
							<p className="text-xs text-amber-400 mb-6">
								Save ${PRICE_ANNUAL_SAVINGS} vs monthly · one payment · scholarship eligible
							</p>
							<ul className="flex flex-col gap-2 mb-8 flex-1">
								{[
									"Everything in Monthly",
									"Scholarship reimbursement eligible",
									"Step Up · Florida ESA · Arizona ESA",
									"ClassWallet & more",
									"Priority support",
								].map((f) => (
									<li key={f} className="flex items-center gap-2 text-sm text-white/70">
										<span className="text-amber-400">✓</span>
										{f}
									</li>
								))}
							</ul>
							<div className="flex flex-col gap-2">
								<CTAButton href={SIGNUP_URL}>Purchase with Scholarship</CTAButton>
								<CTAButton href={SIGNUP_URL} variant="outline">
									Purchase Out-of-Pocket
								</CTAButton>
							</div>
						</div>
					</div>

					<p className="text-sm text-white/40">
						Multiple children? Each needs their own subscription for individual proficiency
						tracking, but you manage everyone from the same dashboard.
					</p>
				</div>
			</section>

			{/* ── Scholarship Flow ─────────────────────────────────────────────── */}
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
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-black text-xs font-bold">
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
						href={SIGNUP_URL}
						className="text-sm font-semibold text-amber-600 hover:text-amber-700 underline underline-offset-4 transition-colors"
					>
						Check Scholarship Eligibility
					</a>
				</div>
			</Section>

			{/* ── FAQ ─────────────────────────────────────────────────────────── */}
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
							answer="The student interface is colorful and engaging. They see bell ringers and CFU prompts, a comprehension signal with four options to express how they're feeling, interactive manipulatives for hands-on practice, their RAM Bucks balance and store, and progress indicators. It's designed for a 10-year-old."
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

			{/* ── Footer CTA ──────────────────────────────────────────────────── */}
			<section className="bg-[#0f1117] py-16 sm:py-24">
				<div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
					<h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
						Your Curriculum. Your Teaching. One Platform That Runs the System.
					</h2>
					<p className="text-base text-white/60 leading-relaxed mb-6">
						Upload your resources. Auto-serve checks for understanding. Track proficiency
						automatically. Get alerted when your child needs help — with the practice activity
						already ready.
					</p>
					<p className="text-sm font-semibold text-amber-400 mb-8">
						${PRICE_ANNUAL}/year per student · Scholarship eligible
					</p>
					<a
						href={SIGNUP_URL}
						className="inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 px-8 py-4 text-base font-bold text-black transition-colors shadow-lg shadow-amber-500/20"
					>
						Get Class Pulse Now
					</a>
					<p className="mt-8 text-sm text-white/30">
						Questions? Email:{" "}
						<a
							href="mailto:families@classpulse.com"
							className="text-amber-400/70 hover:text-amber-400 transition-colors"
						>
							families@classpulse.com
						</a>
					</p>
					<p className="mt-4 text-xs text-white/20">
						Step Up for Students · ESA Eligible · FL BEST Math Aligned · Built by a Florida Teacher
					</p>
				</div>
			</section>
		</div>
	);
}

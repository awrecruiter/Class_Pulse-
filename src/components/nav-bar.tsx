"use client";

import {
	BookOpenIcon,
	GraduationCapIcon,
	LogOutIcon,
	MessageSquareIcon,
	MicIcon,
	MicOffIcon,
	MonitorIcon,
	SettingsIcon,
	ShoppingBagIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useVoiceQueue } from "@/contexts/voice-queue";
import { authClient } from "@/lib/auth/client";
import { PRODUCTION_HANDOFF_MODE_KEY, readBooleanPreference } from "@/lib/ui-prefs";

// ─── Voice controls ───────────────────────────────────────────────────────────

function VoiceControls() {
	const {
		queue,
		commandsEnabled,
		toggleCommands,
		setDrawerOpen,
		micActive,
		lectureMicActive,
		agentThinking,
	} = useVoiceQueue();
	const [handoffMode, setHandoffMode] = useState(false);
	const pendingCount = queue.length;

	const paused = commandsEnabled && lectureMicActive;

	useEffect(() => {
		function syncPrefs() {
			setHandoffMode(readBooleanPreference(PRODUCTION_HANDOFF_MODE_KEY, false));
		}
		syncPrefs();
		window.addEventListener("storage", syncPrefs);
		window.addEventListener("toast-visibility-changed", syncPrefs);
		return () => {
			window.removeEventListener("storage", syncPrefs);
			window.removeEventListener("toast-visibility-changed", syncPrefs);
		};
	}, []);

	return (
		<div className="flex items-center gap-1 mr-2">
			<button
				type="button"
				onClick={toggleCommands}
				className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
					paused
						? "bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
						: commandsEnabled
							? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
							: "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
				}`}
				title={
					paused
						? "Commands paused — lecture mic active"
						: commandsEnabled
							? micActive
								? "Voice commands active"
								: "Voice commands on"
							: "Voice commands off"
				}
			>
				{paused ? (
					<>
						<span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
						Command
					</>
				) : commandsEnabled ? (
					<>
						{agentThinking ? (
							<span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
						) : (
							<span
								className={`h-2 w-2 rounded-full bg-emerald-400 shrink-0 ${micActive ? "animate-pulse" : ""}`}
							/>
						)}
						Command
					</>
				) : (
					<>
						<MicOffIcon className="h-3.5 w-3.5" />
						Command
					</>
				)}
			</button>

			{!handoffMode && (
				<button
					type="button"
					onClick={() => setDrawerOpen(true)}
					className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
						pendingCount > 0
							? "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
							: "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
					}`}
					title="Voice queue"
				>
					<MicIcon className="h-3.5 w-3.5" />
					Queue
					{pendingCount > 0 && (
						<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
							{pendingCount}
						</span>
					)}
				</button>
			)}
		</div>
	);
}

// ─── User menu ────────────────────────────────────────────────────────────────

function UserMenu() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const { data: session } = authClient.useSession();

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		if (open) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);

	const handleSignOut = async () => {
		setOpen(false);
		await authClient.signOut();
		router.push("/login");
	};

	const name = session?.user?.name ?? session?.user?.email ?? "Account";
	const email = session?.user?.email ?? "";
	const initials = name
		.split(" ")
		.map((w: string) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300 hover:bg-indigo-500/30 transition-colors"
				aria-label="Account menu"
				aria-expanded={open}
			>
				{initials || "?"}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-xl border border-slate-700 bg-slate-900 shadow-xl py-1 overflow-hidden">
					<div className="px-4 py-3 border-b border-slate-800">
						<p className="text-sm font-semibold text-slate-200 truncate">{name}</p>
						{email && <p className="text-xs text-slate-500 truncate mt-0.5">{email}</p>}
					</div>

					<div className="py-1">
						<Link
							href="/settings"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
						>
							<SettingsIcon className="h-4 w-4 text-slate-500" />
							Settings
						</Link>
					</div>

					<div className="border-t border-slate-800 py-1">
						<button
							type="button"
							onClick={handleSignOut}
							className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
						>
							<LogOutIcon className="h-4 w-4" />
							Sign out
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
	{ href: "/coach", label: "Coach", icon: GraduationCapIcon },
	{ href: "/classes", label: "Classes", icon: UsersIcon },
	{ href: "/gradebook", label: "Gradebook", icon: BookOpenIcon },
	{ href: "/store", label: "Store", icon: ShoppingBagIcon },
	{ href: "/board", label: "Board", icon: MonitorIcon },
	{ href: "/parent-comms", label: "Comms", icon: MessageSquareIcon },
];

// ─── NavBar ───────────────────────────────────────────────────────────────────

export function NavBar() {
	const pathname = usePathname();

	return (
		<nav className="border-b border-slate-800 bg-slate-900 sticky top-0 z-30">
			<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
				<Link href="/coach" className="text-base font-bold shrink-0 text-white">
					UnGhettoMyLife
				</Link>

				<div className="flex items-center gap-0.5 ml-6">
					{NAV_LINKS.map(({ href, label }) => {
						const active = pathname === href || pathname.startsWith(`${href}/`);
						return (
							<Link
								key={href}
								href={href}
								className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
									active
										? "bg-indigo-500/20 text-indigo-300 font-medium"
										: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
								}`}
							>
								{label}
							</Link>
						);
					})}
				</div>

				<div className="ml-auto flex items-center gap-1">
					<VoiceControls />
					<UserMenu />
				</div>
			</div>
		</nav>
	);
}

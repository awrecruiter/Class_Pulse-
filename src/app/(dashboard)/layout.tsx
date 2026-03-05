"use client";

import {
	BookOpenIcon,
	GraduationCapIcon,
	LogOutIcon,
	MoonIcon,
	SettingsIcon,
	ShoppingBagIcon,
	SunIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AiPresenceBorder } from "@/components/coach/ai-presence-border";
import { authClient } from "@/lib/auth/client";

// ─── Dark mode toggle ─────────────────────────────────────────────────────────

function ThemeToggle() {
	const [dark, setDark] = useState(false);

	useEffect(() => {
		setDark(document.documentElement.classList.contains("dark"));
	}, []);

	function toggle() {
		const next = !dark;
		setDark(next);
		if (next) {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	}

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
			className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
		>
			{dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
		</button>
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
				className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
				aria-label="Account menu"
				aria-expanded={open}
			>
				{initials || "?"}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-xl border border-border bg-card shadow-xl py-1 overflow-hidden">
					<div className="px-4 py-3 border-b border-border">
						<p className="text-sm font-semibold text-foreground truncate">{name}</p>
						{email && <p className="text-xs text-muted-foreground truncate mt-0.5">{email}</p>}
					</div>

					<div className="py-1">
						<Link
							href="/settings"
							onClick={() => setOpen(false)}
							className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
						>
							<SettingsIcon className="h-4 w-4 text-muted-foreground" />
							Settings
						</Link>
					</div>

					<div className="border-t border-border py-1">
						<button
							type="button"
							onClick={handleSignOut}
							className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
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
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div className="min-h-screen bg-background">
			<AiPresenceBorder />
			<nav className="border-b bg-card sticky top-0 z-30">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					{/* Logo */}
					<Link href="/coach" className="text-base font-bold shrink-0 text-foreground">
						UnGhettoMyLife
					</Link>

					{/* Main nav links */}
					<div className="flex items-center gap-0.5 ml-6">
						{NAV_LINKS.map(({ href, label }) => {
							const active = pathname === href || pathname.startsWith(`${href}/`);
							return (
								<Link
									key={href}
									href={href}
									className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
										active
											? "bg-primary/10 text-primary font-medium"
											: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
									}`}
								>
									{label}
								</Link>
							);
						})}
					</div>

					{/* Right — theme toggle + user menu */}
					<div className="ml-auto flex items-center gap-1">
						<ThemeToggle />
						<UserMenu />
					</div>
				</div>
			</nav>
			<main>{children}</main>
		</div>
	);
}

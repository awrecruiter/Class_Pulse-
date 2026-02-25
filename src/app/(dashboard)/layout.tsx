"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const { data: session } = authClient.useSession();

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/login");
	};

	return (
		<div className="min-h-screen bg-background">
			<nav className="border-b bg-card">
				<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					<Link href="/coach" className="text-lg font-semibold">
						UnGhettoMyLife
					</Link>
					<div className="flex items-center gap-4">
						{session?.user && (
							<span className="text-sm text-muted-foreground">{session.user.name}</span>
						)}
						<Button variant="ghost" size="sm" onClick={handleSignOut}>
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</Button>
					</div>
				</div>
			</nav>
			<main>{children}</main>
		</div>
	);
}

import { redirect } from "next/navigation";
import { AiPresenceBorder } from "@/components/coach/ai-presence-border";
import { NavBar } from "@/components/nav-bar";
import { WorkspaceFrame } from "@/components/reservations/workspace-frame";
import { ScheduleOverlay } from "@/components/schedule/schedule-overlay";
import { Toaster } from "@/components/ui/sonner";
import { VoiceCommandProvider } from "@/components/voice/voice-command-provider";
import { CurrencyProvider } from "@/contexts/currency";
import { auth } from "@/lib/auth/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login");

	return (
		<div className="min-h-screen bg-[#0d1525]">
			<CurrencyProvider>
				<AiPresenceBorder />
				<NavBar />
				<VoiceCommandProvider>
					<WorkspaceFrame>
						<main>{children}</main>
					</WorkspaceFrame>
				</VoiceCommandProvider>
				<ScheduleOverlay />
				<Toaster />
			</CurrencyProvider>
		</div>
	);
}

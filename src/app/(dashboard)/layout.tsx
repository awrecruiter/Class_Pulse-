import { redirect } from "next/navigation";
import { AiPresenceBorder } from "@/components/coach/ai-presence-border";
import { NavBar } from "@/components/nav-bar";
import { ScheduleOverlay } from "@/components/schedule/schedule-overlay";
import { VoiceCommandProvider } from "@/components/voice/voice-command-provider";
import { auth } from "@/lib/auth/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login");

	return (
		<div className="min-h-screen bg-[#0d1525]">
			<AiPresenceBorder />
			<NavBar />
			<VoiceCommandProvider>
				<main>{children}</main>
			</VoiceCommandProvider>
			<ScheduleOverlay />
		</div>
	);
}

import { AiPresenceBorder } from "@/components/coach/ai-presence-border";
import { NavBar } from "@/components/nav-bar";
import { ScheduleOverlay } from "@/components/schedule/schedule-overlay";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-[#0d1525]">
			<AiPresenceBorder />
			<NavBar />
			<main>{children}</main>
			<ScheduleOverlay />
		</div>
	);
}

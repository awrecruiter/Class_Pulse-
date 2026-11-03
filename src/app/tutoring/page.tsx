import { TutoringDashboard } from "@/components/tutoring/dashboard";
import { tutoringMode } from "@/lib/workspace-mode";
export default async function TutoringPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	return <TutoringDashboard mode={tutoringMode((await searchParams).mode)} />;
}

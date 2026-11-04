import { TutoringDesk } from "@/components/tutoring/tutoring-desk";
import { tutoringMode } from "@/lib/workspace-mode";
export default async function TutoringPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const mode = tutoringMode((await searchParams).mode);
	return <TutoringDesk key={mode} workspaceMode={mode} />;
}

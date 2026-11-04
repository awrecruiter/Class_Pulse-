import { TutoringDashboard } from "@/components/tutoring/dashboard";
import styles from "@/components/tutoring/workspace.module.css";
import { tutoringMode } from "@/lib/workspace-mode";
export default async function TutoringPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	return (
		<div className={styles.content}>
			<TutoringDashboard mode={tutoringMode((await searchParams).mode)} />
		</div>
	);
}

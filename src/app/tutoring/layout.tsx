import Link from "next/link";
import { redirect } from "next/navigation";
import { PulseMark } from "@/components/brand/pulse-mark";
import styles from "@/components/tutoring/workspace.module.css";
import { auth } from "@/lib/auth/server";

export default async function TutoringLayout({ children }: { children: React.ReactNode }) {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login?next=/tutoring");
	return (
		<div className={styles.shell}>
			<nav className={styles.nav} aria-label="Learning workspace">
				<Link href="/tutoring" className={styles.brand}>
					<PulseMark size={34} decorative />
					Class Pulse
				</Link>
				<div className={styles.links}>
					<Link href="/tutoring">Distance learning</Link>
					<Link href="/tutoring?mode=homeschool">Homeschool</Link>
					<Link href="/tutoring/spaces">Learning spaces</Link>
					<Link href="/tutoring/settings">Booking setup</Link>
					<Link href="/cockpit">Classroom ↗</Link>
				</div>
			</nav>
			<main>{children}</main>
		</div>
	);
}

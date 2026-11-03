import { BookOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/tutoring/workspace.module.css";
import { auth } from "@/lib/auth/server";

export default async function TutoringLayout({ children }: { children: React.ReactNode }) {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login?next=/tutoring");
	return (
		<div className={styles.shell}>
			<nav className={styles.nav} aria-label="Learning workspace">
				<Link href="/tutoring" className={styles.brand}>
					<BookOpen size={23} strokeWidth={1.6} />
					Class Pulse
				</Link>
				<div className={styles.links}>
					<Link href="/tutoring">Distance learning</Link>
					<Link href="/tutoring?mode=homeschool">Homeschool</Link>
					<Link href="/tutoring/settings">Booking setup</Link>
					<Link href="/cockpit">Classroom ↗</Link>
				</div>
			</nav>
			<main className={styles.content}>{children}</main>
		</div>
	);
}

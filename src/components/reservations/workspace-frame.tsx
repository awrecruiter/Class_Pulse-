"use client";
import { usePathname } from "next/navigation";
import { ReservationSidebar } from "./reservation-sidebar";
import styles from "./reservations.module.css";
export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	if (pathname === "/coach") return <>{children}</>;
	return (
		<div className={styles.frame}>
			<div className={styles.main}>{children}</div>
			<ReservationSidebar />
		</div>
	);
}

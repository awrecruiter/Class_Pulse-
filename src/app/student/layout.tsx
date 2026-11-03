import styles from "@/components/tutoring/student-portal.module.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	return <div className={styles.portal}>{children}</div>;
}

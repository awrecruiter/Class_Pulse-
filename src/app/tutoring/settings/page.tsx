import { BookingSettings } from "@/components/tutoring/booking-settings";
import styles from "@/components/tutoring/workspace.module.css";
export default function TutoringSettingsPage() {
	return (
		<>
			<header className={styles.header}>
				<h1>Make time for learning.</h1>
				<p>
					Add your Calendly link so families can choose a time from their portal. Connect Zoom in
					Calendly to include the meeting link in booking confirmations.
				</p>
			</header>
			<BookingSettings />
		</>
	);
}

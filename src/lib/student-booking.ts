import { z } from "zod";

export const studentBookingUrlSchema = z
	.string()
	.trim()
	.max(2048)
	.refine((value) => {
		if (!value) return true;
		try {
			const url = new URL(value);
			return (
				url.protocol === "https:" &&
				(url.hostname === "calendly.com" || url.hostname === "www.calendly.com") &&
				!url.username &&
				!url.password &&
				!url.port &&
				url.pathname.split("/").some(Boolean)
			);
		} catch {
			return false;
		}
	}, "Enter a Calendly scheduling link (https://calendly.com/your-name/event), or leave blank.");

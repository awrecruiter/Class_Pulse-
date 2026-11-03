import { z } from "zod";

export const CHECK_IN_OPTIONS = [
	{ value: "got-it", label: "Got it!", description: "I feel confident about this topic." },
	{
		value: "almost",
		label: "Almost...",
		description: "I understand some of it and could use practice.",
	},
	{
		value: "lost",
		label: "Need help",
		description: "I would like my tutor to walk me through it.",
	},
] as const;

export const checkInSchema = z.enum(["got-it", "almost", "lost"]);
export const orientationTokenSchema = z.string().regex(/^[a-f0-9]{48}$/);

export const activityUrlSchema = z
	.string()
	.trim()
	.max(2048)
	.refine((value) => {
		if (!value) return true;
		try {
			const url = new URL(value);
			return url.protocol === "https:" && !url.username && !url.password;
		} catch {
			return false;
		}
	}, "Use an https:// link or leave blank.");

export const meetingUrlSchema = activityUrlSchema.refine((value) => {
	if (!value) return true;
	try {
		const host = new URL(value).hostname;
		return ["zoom.us", "zoom.com"].some((domain) => host === domain || host.endsWith(`.${domain}`));
	} catch {
		return false;
	}
}, "Use a Zoom meeting link or leave blank.");

export const orientationSetupSchema = z.object({
	content: z.string().trim().max(2000).default(""),
	quizUrl: activityUrlSchema.default(""),
	meetingUrl: meetingUrlSchema.default(""),
});

export const orientationProgressSchema = orientationSetupSchema
	.extend({
		progressNote: z.string().trim().max(4000).default(""),
		homePractice: z.string().trim().max(2000).default(""),
		reviewed: z.boolean().default(false),
	})
	.refine((value) => !value.reviewed || (!!value.progressNote && !!value.homePractice), {
		message: "Add learning evidence and home practice before marking progress reviewed.",
		path: ["progressNote"],
	});

export const orientationIntakeSchema = z.object({
	parentName: z.string().trim().min(1, "Enter a parent or guardian name.").max(100),
	parentEmail: z.string().trim().max(254).pipe(z.email("Enter a valid parent email.")),
	phone: z
		.string()
		.transform((raw) => {
			const digits = raw.replace(/\D/g, "");
			return digits.length === 10
				? `+1${digits}`
				: digits.length === 11 && digits.startsWith("1")
					? `+${digits}`
					: raw;
		})
		.refine((value) => /^\+1\d{10}$/.test(value), "Enter a 10-digit US parent phone number."),
	studentFirstName: z.string().trim().min(1, "Enter the student's first name.").max(50),
	studentLastInitial: z
		.string()
		.trim()
		.regex(/^[A-Za-z]$/, "Enter one letter for the last initial."),
	gradeLevel: z.string().trim().max(10).default(""),
	learningContent: z.string().trim().min(1, "Tell us what you want to learn.").max(2000),
	initialSignal: checkInSchema,
});

export type OrientationIntake = z.infer<typeof orientationIntakeSchema>;

export type OrientationView = {
	classLabel: string;
	defaultGrade: string;
	content: string;
	bookingUrl: string;
	quizUrl: string;
	meetingUrl: string;
	enrolled: boolean;
};

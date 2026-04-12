export type VoiceSurfaceId =
	| "coach"
	| "board"
	| "classes"
	| "class-detail"
	| "gradebook"
	| "store"
	| "parent-comms"
	| "settings";

export type VoiceNavDestination =
	| "board"
	| "classes"
	| "settings"
	| "coach"
	| "store"
	| "gradebook"
	| "parent-comms";

export interface VoiceSurface {
	id: VoiceSurfaceId;
	route: string;
	label: string;
	aliases: string[];
	commands: string[];
}

export const VOICE_SURFACES: VoiceSurface[] = [
	{
		id: "coach",
		route: "/coach",
		label: "Coach",
		aliases: ["coach", "home coach"],
		commands: [
			"ask coach",
			"start session",
			"end session",
			"start lecture",
			"stop lecture",
			"show DI groups",
			"give consequence",
			"award RAM Bucks",
			"deduct RAM Bucks",
			"move student to group",
			"message parent",
			"show schedule",
			"open schedule doc",
		],
	},
	{
		id: "board",
		route: "/board",
		label: "Board",
		aliases: ["board", "display board"],
		commands: ["switch board panel", "open portal app", "open last resource"],
	},
	{
		id: "classes",
		route: "/classes",
		label: "Classes",
		aliases: ["classes", "class list", "my classes"],
		commands: ["open classes", "select class", "create class"],
	},
	{
		id: "class-detail",
		route: "/classes/[id]",
		label: "Class Detail",
		aliases: ["class detail", "class page"],
		commands: [
			"start session",
			"end session",
			"manage roster",
			"add student",
			"remove student",
			"open parent contacts",
		],
	},
	{
		id: "gradebook",
		route: "/gradebook",
		label: "Gradebook",
		aliases: ["gradebook", "grades", "grade book"],
		commands: ["open gradebook", "save scores", "export gradebook"],
	},
	{
		id: "store",
		route: "/store",
		label: "Store",
		aliases: ["store", "ram buck store", "shop"],
		commands: ["open store", "close store", "approve purchase", "deny purchase"],
	},
	{
		id: "parent-comms",
		route: "/parent-comms",
		label: "Parent Comms",
		aliases: ["parent comms", "communications", "parent messages", "parents"],
		commands: ["open parent comms", "draft parent message", "queue message", "send sms"],
	},
	{
		id: "settings",
		route: "/settings",
		label: "Settings",
		aliases: ["settings", "preferences"],
		commands: ["open settings", "voice settings", "schedule settings"],
	},
];

const NAV_ALIASES: Record<VoiceNavDestination, string[]> = {
	board: ["board"],
	classes: ["classes", "class", "my classes", "class list"],
	settings: ["settings", "preferences"],
	coach: ["coach"],
	store: ["store", "shop"],
	gradebook: ["gradebook", "grade book", "grades"],
	"parent-comms": ["parent comms", "communications", "parent messages", "parents"],
};

export function getVoiceSurface(pathname: string): VoiceSurface | null {
	if (pathname.startsWith("/classes/"))
		return VOICE_SURFACES.find((s) => s.id === "class-detail") ?? null;
	return (
		VOICE_SURFACES.find(
			(surface) => pathname === surface.route || pathname.startsWith(`${surface.route}/`),
		) ?? null
	);
}

export function getVoiceSurfaceSummary(pathname: string): string[] {
	const surface = getVoiceSurface(pathname);
	return surface?.commands ?? [];
}

export function matchNavigationDestination(transcript: string): VoiceNavDestination | null {
	const lower = transcript.toLowerCase().trim();
	const triggerPattern =
		"(?:go(?:\\s+to)?|navigate(?:\\s+to)?|take(?:\\s+me)?(?:\\s+to)?|open|switch(?:\\s+to)?)";

	for (const [destination, aliases] of Object.entries(NAV_ALIASES) as Array<
		[VoiceNavDestination, string[]]
	>) {
		for (const alias of aliases) {
			const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
			const pattern = new RegExp(
				`\\b${triggerPattern}\\s+(?:the\\s+)?(?:my\\s+)?${escapedAlias}\\b`,
				"i",
			);
			if (pattern.test(lower)) return destination;
		}
	}

	return null;
}

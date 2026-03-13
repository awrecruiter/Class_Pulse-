"use client";

import { useEffect, useRef } from "react";
import { type MicConfig, useMicSlot } from "@/hooks/use-mic-manager";

export type BoardCommand =
	| { type: "open_app"; label: string; href: string }
	| { type: "switch_panel"; panel: "portal" | "resources" | "pulse" }
	| { type: "open_last_resource" };

export type CommandMatch = {
	command: BoardCommand;
	transcript: string;
};

interface AppEntry {
	label: string;
	aliases: string[];
	href: string;
}

const APPS: AppEntry[] = [
	{
		label: "Portal",
		aliases: ["portal", "district portal", "dadeschools"],
		href: "https://www3.dadeschools.net",
	},
	{
		label: "Outlook",
		aliases: ["outlook", "email", "mail", "my email"],
		href: "https://outlook.office365.com",
	},
	{
		label: "OneDrive",
		aliases: ["onedrive", "one drive", "my files", "my documents"],
		href: "https://portal.office.com/onedrive",
	},
	{
		label: "Pinnacle",
		aliases: ["pinnacle", "gradebook", "grades", "grade book"],
		href: "https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
	},
	{
		label: "Schoology",
		aliases: ["schoology", "lms", "assignments"],
		href: "https://dadeschools.schoology.com",
	},
	{
		label: "Clever",
		aliases: ["clever", "clever portal"],
		href: "https://clever.com/in/miami/teacher/resourceHub",
	},
	{
		label: "iReady",
		aliases: ["iready", "i ready", "i-ready"],
		href: "https://login.i-ready.com/educator/dashboard/math",
	},
	{
		label: "IXL",
		aliases: ["ixl", "i x l"],
		href: "https://clever.com/oauth/authorize?channel=clever-portal&client_id=3513be842ce24d16f779&confirmed=true&district_id=5106cec3a14b17af0f000054&redirect_uri=https%3A%2F%2Fwww.ixl.com%2Fclever%2Fsignin&response_type=code",
	},
	{
		label: "Big Ideas Math",
		aliases: ["big ideas", "big ideas math"],
		href: "https://www.bigideasmath.com/MRL/public/app/#/teacher/dashboard",
	},
	{
		label: "McGraw Hill",
		aliases: ["mcgraw", "mcgraw hill", "mcgraw-hill"],
		href: "https://my.mheducation.com/secure/teacher/urn:com.mheducation.openlearning:enterprise.identity.organization:prod.global:organization:8269ebcf-760e-4414-8c3e-60768e306ff4/home",
	},
];

const OPEN_TRIGGERS = ["open", "go to", "launch", "show me", "pull up", "take me to", "switch to"];
const PANEL_TRIGGERS: { aliases: string[]; panel: "portal" | "resources" | "pulse" }[] = [
	{ aliases: ["portal panel", "my portal", "apps"], panel: "portal" },
	{ aliases: ["resources", "resource viewer", "files", "file viewer"], panel: "resources" },
	{ aliases: ["class pulse", "pulse", "comprehension"], panel: "pulse" },
];
const LAST_RESOURCE_TRIGGERS = [
	"my last file",
	"last resource",
	"last file",
	"reopen",
	"open last",
];

export function matchBoardCommand(text: string): BoardCommand | null {
	const lower = text.toLowerCase().trim();

	// Check for "open last resource" type commands
	for (const trigger of LAST_RESOURCE_TRIGGERS) {
		if (lower.includes(trigger)) {
			return { type: "open_last_resource" };
		}
	}

	// Check for panel switches
	for (const { aliases, panel } of PANEL_TRIGGERS) {
		for (const alias of aliases) {
			for (const trigger of OPEN_TRIGGERS) {
				if (lower.includes(`${trigger} ${alias}`) || lower.includes(alias)) {
					return { type: "switch_panel", panel };
				}
			}
		}
	}

	// Check for app opens — look for trigger + app name
	for (const trigger of OPEN_TRIGGERS) {
		if (!lower.includes(trigger)) continue;
		const afterTrigger = lower.slice(lower.indexOf(trigger) + trigger.length).trim();
		for (const app of APPS) {
			for (const alias of app.aliases) {
				if (afterTrigger.startsWith(alias) || afterTrigger.includes(alias)) {
					return { type: "open_app", label: app.label, href: app.href };
				}
			}
		}
	}

	// Also try without trigger word — just the app name alone
	for (const app of APPS) {
		for (const alias of app.aliases) {
			if (lower === alias || lower.startsWith(`${alias} `) || lower.endsWith(` ${alias}`)) {
				return { type: "open_app", label: app.label, href: app.href };
			}
		}
	}

	return null;
}

interface UseBoardVoiceOptions {
	onCommand: (match: CommandMatch) => void;
	enabled: boolean;
}

/**
 * Board-specific voice hook — routes through the global mic manager so it
 * never competes with lecture, orb, or dictation consumers.
 *
 * NOTE: Board commands are also handled by useGlobalVoiceCommands when that
 * hook is active (coach page). This hook is for the /board page where the
 * global voice provider may not have a coach component mounted.
 */
export function useBoardVoice({ onCommand, enabled }: UseBoardVoiceOptions) {
	const onCommandRef = useRef(onCommand);
	onCommandRef.current = onCommand;

	const config: MicConfig = {
		continuous: true,
		interimResults: false,
		onResult: (transcript, isFinal) => {
			if (!isFinal) return;
			const command = matchBoardCommand(transcript.trim());
			if (command) {
				onCommandRef.current({ command, transcript });
			}
		},
	};

	const { isActive, start, stop } = useMicSlot("globalVoice", config);

	useEffect(() => {
		if (enabled) start();
		else stop();
	}, [enabled, start, stop]);

	return { isListening: isActive };
}

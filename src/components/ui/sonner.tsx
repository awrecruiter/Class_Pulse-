"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { readBooleanPreference, TOASTS_ENABLED_KEY } from "@/lib/ui-prefs";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();
	const [enabled, setEnabled] = useState(true);

	useEffect(() => {
		function syncFromStorage() {
			setEnabled(readBooleanPreference(TOASTS_ENABLED_KEY, true));
		}

		syncFromStorage();
		window.addEventListener("toast-visibility-changed", syncFromStorage);
		window.addEventListener("storage", syncFromStorage);
		return () => {
			window.removeEventListener("toast-visibility-changed", syncFromStorage);
			window.removeEventListener("storage", syncFromStorage);
		};
	}, []);

	if (!enabled) return null;

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				warning: <TriangleAlertIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					"--border-radius": "var(--radius)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };

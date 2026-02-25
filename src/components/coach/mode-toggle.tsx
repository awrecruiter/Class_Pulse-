"use client";

export type CoachMode = "lecture" | "coach";

type ModeToggleProps = {
	mode: CoachMode;
	onChange: (mode: CoachMode) => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
	return (
		<div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
			<button
				type="button"
				onClick={() => onChange("lecture")}
				className={`flex-1 px-4 py-2 transition-colors ${
					mode === "lecture"
						? "bg-primary text-primary-foreground"
						: "bg-background text-muted-foreground hover:bg-muted"
				}`}
			>
				Lecture
			</button>
			<button
				type="button"
				onClick={() => onChange("coach")}
				className={`flex-1 px-4 py-2 transition-colors ${
					mode === "coach"
						? "bg-primary text-primary-foreground"
						: "bg-background text-muted-foreground hover:bg-muted"
				}`}
			>
				Coach
			</button>
		</div>
	);
}

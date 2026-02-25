"use client";

import { CheckIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";
import type { CoachResponse } from "@/lib/ai/coach";

type Tab = "script" | "gap" | "draw" | "activity";

const TABS: { id: Tab; label: string }[] = [
	{ id: "script", label: "Script" },
	{ id: "gap", label: "Gap" },
	{ id: "draw", label: "Draw" },
	{ id: "activity", label: "Go!" },
];

type ScaffoldCardProps = {
	response: CoachResponse;
};

export function ScaffoldCard({ response }: ScaffoldCardProps) {
	const [activeTab, setActiveTab] = useState<Tab>("script");
	const [copied, setCopied] = useState(false);

	function getContent(): string {
		switch (activeTab) {
			case "script":
				return response.script;
			case "gap":
				return `${response.missingConcept.code} (Grade ${response.missingConcept.grade})\n${response.missingConcept.description}\n\n${response.missingConcept.explanation}`;
			case "draw":
				return response.visual;
			case "activity":
				return response.microIntervention;
		}
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(getContent());
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard not available
		}
	}

	return (
		<div className="flex flex-col gap-3 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
			{/* Tab bar */}
			<div className="flex border-b border-border">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
							activeTab === tab.id
								? "border-b-2 border-primary text-primary bg-primary/5"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Content */}
			<div className="p-4">
				{activeTab === "script" && (
					<div>
						<p className="text-xs font-medium text-muted-foreground mb-2">Say this now:</p>
						<p className="text-base font-medium text-foreground leading-relaxed">
							&ldquo;{response.script}&rdquo;
						</p>
					</div>
				)}

				{activeTab === "gap" && (
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-mono font-bold">
								{response.missingConcept.code}
							</span>
							<span className="text-xs text-muted-foreground">
								Grade {response.missingConcept.grade}
							</span>
						</div>
						<p className="text-sm font-medium text-foreground">
							{response.missingConcept.description}
						</p>
						<p className="text-sm text-muted-foreground leading-relaxed">
							{response.missingConcept.explanation}
						</p>
					</div>
				)}

				{activeTab === "draw" && (
					<div>
						<p className="text-xs font-medium text-muted-foreground mb-2">Sketch this:</p>
						<p className="text-sm text-foreground leading-relaxed">{response.visual}</p>
					</div>
				)}

				{activeTab === "activity" && (
					<div>
						<p className="text-xs font-medium text-muted-foreground mb-2">
							30-second intervention:
						</p>
						<p className="text-sm text-foreground leading-relaxed">{response.microIntervention}</p>
					</div>
				)}
			</div>

			{/* Copy button */}
			<div className="px-4 pb-4">
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					{copied ? (
						<>
							<CheckIcon className="h-3.5 w-3.5 text-green-600" />
							<span className="text-green-600">Copied!</span>
						</>
					) : (
						<>
							<ClipboardIcon className="h-3.5 w-3.5" />
							Copy
						</>
					)}
				</button>
			</div>
		</div>
	);
}

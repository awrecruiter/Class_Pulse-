"use client";

import { MicIcon, MicOffIcon, SendIcon } from "lucide-react";

type QueryInputProps = {
	query: string;
	isRecording: boolean;
	isLoading: boolean;
	isSupported: boolean;
	wordCount: number;
	onChange: (value: string) => void;
	onMicClick: () => void;
	onSubmit: () => void;
};

export function QueryInput({
	query,
	isRecording,
	isLoading,
	isSupported,
	wordCount,
	onChange,
	onMicClick,
	onSubmit,
}: QueryInputProps) {
	const canSubmit = query.trim().length > 0 && !isLoading;

	return (
		<div className="flex flex-col gap-3">
			<label htmlFor="student-query" className="text-sm font-medium text-foreground">
				Student&apos;s question or confusion:
			</label>

			<div className="relative">
				<textarea
					id="student-query"
					value={query}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Describe the student's confusion or confusion they expressed... or tap 🎤 to speak it."
					rows={3}
					className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
					onKeyDown={(e) => {
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
							e.preventDefault();
							onSubmit();
						}
					}}
				/>
				{isSupported && (
					<button
						type="button"
						onClick={onMicClick}
						className={`absolute right-2 top-2 rounded-md p-1.5 transition-colors ${
							isRecording
								? "bg-red-100 text-red-600 hover:bg-red-200"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
						title={isRecording ? "Stop recording" : "Speak the student's question"}
					>
						{isRecording ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
					</button>
				)}
			</div>

			<div className="flex items-center justify-between gap-3">
				<span className="text-xs text-muted-foreground">
					{isRecording ? (
						<span className="text-red-500 font-medium">Recording... speak clearly</span>
					) : wordCount > 0 ? (
						`${wordCount} words`
					) : (
						"Cmd+Enter to submit"
					)}
				</span>
				<button
					type="button"
					onClick={onSubmit}
					disabled={!canSubmit}
					className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition-colors"
				>
					{isLoading ? (
						<>
							<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							Thinking...
						</>
					) : (
						<>
							<SendIcon className="h-4 w-4" />
							Ask Coach
						</>
					)}
				</button>
			</div>
		</div>
	);
}

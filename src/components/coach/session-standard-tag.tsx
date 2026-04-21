"use client";

import { BookOpenIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FL_BEST_STANDARDS } from "@/data/fl-best-standards";

interface SessionStandardTagProps {
	value: string;
	onChange: (code: string) => void;
	placeholder?: string;
}

export function SessionStandardTag({
	value,
	onChange,
	placeholder = "Tag today's standard (optional)",
}: SessionStandardTagProps) {
	const [query, setQuery] = useState(value);
	const [open, setOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setQuery(value);
	}, [value]);

	const suggestions =
		query.length >= 2
			? FL_BEST_STANDARDS.filter(
					(s) =>
						s.code.toLowerCase().includes(query.toLowerCase()) ||
						s.description.toLowerCase().includes(query.toLowerCase()),
				).slice(0, 6)
			: [];

	function select(code: string) {
		onChange(code);
		setQuery(code);
		setOpen(false);
		inputRef.current?.blur();
	}

	function clear() {
		onChange("");
		setQuery("");
		inputRef.current?.focus();
	}

	return (
		<div className="relative w-full">
			<div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5">
				<BookOpenIcon className="h-3 w-3 text-slate-500 shrink-0" />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					placeholder={placeholder}
					className="flex-1 bg-transparent text-[11px] text-slate-300 placeholder:text-slate-600 outline-none min-w-0"
				/>
				{query && (
					<button type="button" onClick={clear} className="text-slate-600 hover:text-slate-400">
						<XIcon className="h-3 w-3" />
					</button>
				)}
			</div>

			{open && suggestions.length > 0 && (
				<div
					ref={listRef}
					className="absolute z-50 top-full mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl overflow-hidden"
				>
					{suggestions.map((s) => (
						<button
							key={s.code}
							type="button"
							onMouseDown={() => select(s.code)}
							className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 transition-colors"
						>
							<span className="font-mono text-[10px] font-bold text-amber-400">{s.code}</span>
							<span className="text-[10px] text-slate-400 ml-2 line-clamp-1">{s.description}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

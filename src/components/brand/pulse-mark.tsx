export function PulseMark({
	size = 48,
	decorative = false,
}: {
	size?: number;
	decorative?: boolean;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 64 64"
			fill="none"
			role={decorative ? undefined : "img"}
			aria-hidden={decorative || undefined}
			aria-label={decorative ? undefined : "Class Pulse"}
		>
			{!decorative && <title>Class Pulse</title>}
			<rect x="2" y="2" width="60" height="60" rx="21" fill="#eee7f8" />
			<path
				d="M11 34h10c4 0 5-15 9-15s5 27 9 27 5-12 9-12h5"
				stroke="#7855aa"
				strokeWidth="4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="51" cy="19" r="4" fill="#bca5db" />
		</svg>
	);
}

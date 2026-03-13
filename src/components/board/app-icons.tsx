"use client";

// Custom app icons — each reflects the original logo's shape/color identity
// rendered as inline SVG so they inherit Geist font from the document

const FONT = "'Geist Sans', system-ui, -apple-system, sans-serif";

export function MdcpsIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="MDCPS"
		>
			<rect width="40" height="40" rx="9" fill="#003087" />
			{/* Roof */}
			<polygon points="6,19 20,7 34,19" fill="#F47920" />
			{/* Building */}
			<rect x="9" y="19" width="22" height="14" fill="white" />
			{/* Door */}
			<rect x="16" y="25" width="8" height="8" rx="1" fill="#003087" />
			{/* Windows */}
			<rect x="10.5" y="21" width="5" height="4" rx="1" fill="#003087" opacity="0.7" />
			<rect x="24.5" y="21" width="5" height="4" rx="1" fill="#003087" opacity="0.7" />
		</svg>
	);
}

export function OutlookIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Outlook"
		>
			<rect width="40" height="40" rx="9" fill="#0078D4" />
			{/* Envelope body */}
			<rect x="15" y="11" width="20" height="14" rx="2" fill="#28A8E0" />
			{/* Envelope flap */}
			<polyline points="15,11 25,18 35,11" fill="none" stroke="#0078D4" strokeWidth="1.5" />
			{/* Overlapping O circle on left */}
			<circle cx="14" cy="22" r="9" fill="#0078D4" />
			<circle cx="14" cy="22" r="9" fill="none" stroke="white" strokeWidth="2" />
			<circle cx="14" cy="22" r="5" fill="#0078D4" />
			<text
				x="14"
				y="26"
				textAnchor="middle"
				fill="white"
				fontSize="8"
				fontWeight="700"
				fontFamily={FONT}
			>
				O
			</text>
		</svg>
	);
}

export function OnedriveIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="OneDrive"
		>
			<rect width="40" height="40" rx="9" fill="#0d1525" />
			{/* Back cloud — light blue */}
			<path
				d="M28 28H11a7 7 0 0 1-1-13.9 8 8 0 0 1 15.5-1.5A5.5 5.5 0 1 1 31 23a5.5 5.5 0 0 1-3 5z"
				fill="#28A8E0"
			/>
			{/* Front cloud — dark blue */}
			<path
				d="M30 28H17a5.5 5.5 0 0 1-.8-11 6 6 0 0 1 11.8-.9A4.3 4.3 0 1 1 33.3 24a4.3 4.3 0 0 1-3.3 4z"
				fill="#0078D4"
			/>
		</svg>
	);
}

export function PinnacleIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Pinnacle"
		>
			<rect width="40" height="40" rx="9" fill="#1a3a5c" />
			{/* Bold P */}
			<text x="12" y="30" fill="white" fontSize="26" fontWeight="700" fontFamily={FONT}>
				P
			</text>
			{/* Star/peak accent top-right */}
			<polygon points="31,7 33,12 28,10 33,10 28,12" fill="#4a9eff" />
		</svg>
	);
}

export function SchoologyIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Schoology"
		>
			<rect width="40" height="40" rx="9" fill="#57A128" />
			{/* S — faithful to Schoology's rounded S */}
			<path
				d="M27 14 C27 11 24.5 9 21 9 H17 C13.7 9 11 11.7 11 15 C11 18.3 13.7 21 17 21 H23 C26.3 21 29 23.7 29 27 C29 30.3 26.3 33 23 33 H18 C14.5 33 12 30.5 12 28"
				fill="none"
				stroke="white"
				strokeWidth="3.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function CleverIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Clever"
		>
			<rect width="40" height="40" rx="9" fill="#F7C948" />
			{/* Bold C */}
			<path
				d="M29 14 C26.5 10.5 23 8.5 19 8.5 C13 8.5 8.5 13 8.5 20 C8.5 27 13 31.5 19 31.5 C23 31.5 26.5 29.5 29 26"
				fill="none"
				stroke="#1B2845"
				strokeWidth="5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function IreadyIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="iReady"
		>
			<rect width="40" height="40" rx="9" fill="#E31837" />
			{/* Checkmark circle */}
			<circle cx="20" cy="16" r="7" fill="none" stroke="white" strokeWidth="2.5" />
			<polyline
				points="15,16 19,20 25,12"
				fill="none"
				stroke="white"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{/* "Ready" label bar */}
			<text
				x="20"
				y="33"
				textAnchor="middle"
				fill="white"
				fontSize="8"
				fontWeight="600"
				fontFamily={FONT}
				letterSpacing="0.5"
			>
				Ready
			</text>
		</svg>
	);
}

export function IxlIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="IXL"
		>
			<rect width="40" height="40" rx="9" fill="#00A651" />
			<text
				x="20"
				y="28"
				textAnchor="middle"
				fill="white"
				fontSize="20"
				fontWeight="700"
				fontFamily={FONT}
				letterSpacing="-0.5"
			>
				IXL
			</text>
		</svg>
	);
}

export function BigIdeasIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Big Ideas Math"
		>
			<rect width="40" height="40" rx="9" fill="#E85D26" />
			{/* Lightbulb silhouette */}
			<path
				d="M20 7 C15 7 11 11 11 16 C11 19.5 13 22.5 16 24.5 L16 28 L24 28 L24 24.5 C27 22.5 29 19.5 29 16 C29 11 25 7 20 7 Z"
				fill="white"
			/>
			{/* Base lines */}
			<rect x="16" y="29" width="8" height="2" rx="1" fill="white" opacity="0.8" />
			<rect x="17" y="32" width="6" height="2" rx="1" fill="white" opacity="0.5" />
			{/* bi inside bulb */}
			<text
				x="20"
				y="22"
				textAnchor="middle"
				fill="#E85D26"
				fontSize="9"
				fontWeight="700"
				fontFamily={FONT}
			>
				bi
			</text>
		</svg>
	);
}

export function McgrawHillIcon({ size = 40 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 40 40"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="McGraw Hill"
		>
			<rect width="40" height="40" rx="9" fill="#DA291C" />
			{/* Sunrise rays */}
			<line x1="20" y1="6" x2="20" y2="11" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
			<line x1="30" y1="9" x2="27" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
			<line
				x1="34"
				y1="19"
				x2="29"
				y2="19"
				stroke="white"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			<line x1="10" y1="9" x2="13" y2="13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
			<line x1="6" y1="19" x2="11" y2="19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
			{/* Sun */}
			<circle cx="20" cy="21" r="6" fill="white" />
			{/* MH text in sun */}
			<text
				x="20"
				y="24.5"
				textAnchor="middle"
				fill="#DA291C"
				fontSize="6"
				fontWeight="700"
				fontFamily={FONT}
			>
				MH
			</text>
			{/* Horizon line */}
			<rect x="5" y="30" width="30" height="2.5" rx="1.2" fill="white" opacity="0.7" />
		</svg>
	);
}

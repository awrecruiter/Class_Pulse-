"use client";

export function PrintButton() {
	return (
		<button
			type="button"
			onClick={() => window.print()}
			style={{
				padding: "0.6rem 1.5rem",
				background: "#1a1a1a",
				color: "#fff",
				border: "none",
				borderRadius: "4px",
				cursor: "pointer",
				fontFamily: "inherit",
				fontSize: "0.9rem",
			}}
		>
			Save as PDF / Print
		</button>
	);
}

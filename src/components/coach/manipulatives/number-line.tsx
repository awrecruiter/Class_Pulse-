"use client";

type Marker = { value: number; label: string };

type NumberLineProps = {
	min: number;
	max: number;
	markers: Marker[];
	highlightIndex?: number;
};

const W = 280;
const PAD = 20;
const LINE_W = W - PAD * 2; // 240

function xPos(value: number, min: number, max: number): number {
	return PAD + ((value - min) / (max - min)) * LINE_W;
}

export function NumberLine({ min, max, markers, highlightIndex }: NumberLineProps) {
	const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

	return (
		<>
			<style>{`
				@keyframes drawLine { from { stroke-dashoffset: ${LINE_W} } to { stroke-dashoffset: 0 } }
				@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
			`}</style>
			<svg width={W} height={80} viewBox={`0 0 ${W} 80`} aria-hidden="true">
				{/* Horizontal line with draw animation */}
				<line
					x1={PAD}
					y1={40}
					x2={PAD + LINE_W}
					y2={40}
					stroke="#6b7280"
					strokeWidth={2}
					style={{
						strokeDasharray: LINE_W,
						strokeDashoffset: LINE_W,
						animation: "drawLine 0.6s ease forwards",
					}}
				/>
				{/* Integer ticks */}
				{ticks.map((v) => (
					<line
						key={`tick-${v}`}
						x1={xPos(v, min, max)}
						y1={34}
						x2={xPos(v, min, max)}
						y2={46}
						stroke="#6b7280"
						strokeWidth={1}
						style={{
							opacity: 0,
							animation: "fadeIn 0.3s ease forwards",
							animationDelay: "600ms",
						}}
					/>
				))}
				{/* Tick labels */}
				{ticks.map((v) => (
					<text
						key={`tlabel-${v}`}
						x={xPos(v, min, max)}
						y={58}
						textAnchor="middle"
						fontSize={10}
						fill="#9ca3af"
						style={{
							opacity: 0,
							animation: "fadeIn 0.3s ease forwards",
							animationDelay: "600ms",
						}}
					>
						{v}
					</text>
				))}
				{/* Markers */}
				{markers.map((m, i) => {
					const x = xPos(m.value, min, max);
					const isHighlight = i === highlightIndex;
					return (
						<g
							key={`marker-${m.value}`}
							style={{
								opacity: 0,
								animation: "fadeIn 0.3s ease forwards",
								animationDelay: "800ms",
							}}
						>
							{isHighlight ? (
								<circle cx={x} cy={40} r={7} fill="#7c3aed" />
							) : (
								<circle cx={x} cy={40} r={5} fill="white" stroke="#6b7280" strokeWidth={1.5} />
							)}
							<text
								x={x}
								y={isHighlight ? 24 : 26}
								textAnchor="middle"
								fontSize={isHighlight ? 13 : 11}
								fontWeight={isHighlight ? "bold" : "normal"}
								fill={isHighlight ? "#7c3aed" : "#374151"}
							>
								{m.label}
							</text>
						</g>
					);
				})}
			</svg>
		</>
	);
}

"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * RamBuckBurst
 *
 * Renders a burst of floating RAM emoji particles that arc up and fade out
 * from a given anchor point. Used to celebrate RAM Buck awards/deductions.
 *
 * Usage:
 *   <RamBuckBurst amount={20} type="award" anchorRef={badgeRef} onDone={() => setShowBurst(false)} />
 */

interface RamBuckBurstProps {
	amount: number;
	type: "award" | "deduction";
	/** Element to launch particles from */
	anchorRef: React.RefObject<HTMLElement | null>;
	onDone: () => void;
}

const PARTICLE_COUNT = 12;

export function RamBuckBurst({ amount, type, anchorRef, onDone }: RamBuckBurstProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const isAward = type === "award";

	useEffect(() => {
		const anchor = anchorRef.current;
		const container = containerRef.current;
		if (!anchor || !container) return;

		const rect = anchor.getBoundingClientRect();
		const originX = rect.left + rect.width / 2;
		const originY = rect.top + rect.height / 2;

		const particles = Array.from(container.querySelectorAll<HTMLDivElement>(".burst-particle"));
		const tl = gsap.timeline({ onComplete: onDone });

		particles.forEach((el, i) => {
			const angle = (i / PARTICLE_COUNT) * Math.PI * 2 - Math.PI / 2;
			const radius = 60 + Math.random() * 60;
			const dx = Math.cos(angle) * radius * (0.5 + Math.random() * 0.5);
			const dy = Math.sin(angle) * radius - 40 - Math.random() * 60;
			const scale = 0.8 + Math.random() * 0.8;
			const delay = (i / PARTICLE_COUNT) * 0.18;

			gsap.set(el, { x: originX, y: originY, scale: 0, opacity: 1 });

			tl.to(
				el,
				{
					x: originX + dx,
					y: originY + dy,
					scale,
					duration: 0.35,
					ease: "back.out(1.5)",
					delay,
				},
				0,
			).to(
				el,
				{
					opacity: 0,
					y: originY + dy - 30,
					duration: 0.4,
					ease: "power2.in",
					delay: delay + 0.3,
				},
				0,
			);
		});

		// Also animate the amount label
		const label = container.querySelector<HTMLDivElement>(".burst-label");
		if (label) {
			gsap.set(label, { x: originX, y: originY - 20, opacity: 0, scale: 0.5 });
			tl.to(
				label,
				{
					y: originY - 70,
					opacity: 1,
					scale: 1.1,
					duration: 0.45,
					ease: "back.out(2)",
				},
				0.08,
			).to(
				label,
				{
					opacity: 0,
					y: originY - 100,
					duration: 0.4,
					ease: "power2.in",
					delay: 0.6,
				},
				0.08,
			);
		}

		return () => {
			tl.kill();
		};
	}, [anchorRef, onDone]);

	if (typeof document === "undefined") return null;

	return createPortal(
		<div ref={containerRef} className="pointer-events-none fixed inset-0 z-[99999]">
			{Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static burst particles
					key={i}
					className="burst-particle fixed text-xl leading-none select-none"
					style={{ left: 0, top: 0, willChange: "transform, opacity" }}
				>
					{isAward ? "🐏" : "💸"}
				</div>
			))}
			<div
				className="burst-label fixed font-black text-lg leading-none select-none"
				style={{
					left: 0,
					top: 0,
					color: isAward ? "#16a34a" : "#dc2626",
					textShadow: "0 1px 4px rgba(0,0,0,0.3)",
					willChange: "transform, opacity",
				}}
			>
				{isAward ? "+" : "-"}
				{amount} RAM
			</div>
		</div>,
		document.body,
	);
}

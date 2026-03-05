"use client";

/**
 * AiPresenceBorder
 *
 * A fixed full-viewport overlay that renders a thin glowing border around the
 * screen edge. Visual state is driven by the `data-ai-state` attribute on
 * `<html>` (set by the coach page). Three states:
 *   - "idle"       → soft dim violet breathing
 *   - "listening"  → bright cyan pulse
 *   - "processing" → amber breathing sweep
 *
 * CSS animations live in globals.css and target `#ai-presence-border` via the
 * `html[data-ai-state="..."] #ai-presence-border` selector.
 */
export function AiPresenceBorder() {
	return (
		<div
			id="ai-presence-border"
			aria-hidden="true"
			className="fixed inset-0 z-[9998] pointer-events-none"
		/>
	);
}

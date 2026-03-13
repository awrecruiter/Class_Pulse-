/**
 * Plays a short ascending ding chime using Web Audio API.
 * No external files — generated entirely in the browser.
 *
 * Sounds like: a soft bell tone that rises slightly, ~300ms total.
 * Used to signal "mic is active — go ahead and speak."
 */
export function playActivationChime(): void {
	if (typeof window === "undefined") return;

	try {
		const ctx = new AudioContext();

		// Two oscillators: fundamental + octave harmonic for a bell quality
		const osc1 = ctx.createOscillator();
		const osc2 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		const gain2 = ctx.createGain();

		osc1.connect(gain1);
		osc2.connect(gain2);
		gain1.connect(ctx.destination);
		gain2.connect(ctx.destination);

		// Bell-like frequencies (G5 + G6)
		osc1.frequency.setValueAtTime(784, ctx.currentTime); // G5
		osc1.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.08); // slight rise
		osc2.frequency.setValueAtTime(1568, ctx.currentTime); // G6
		osc2.frequency.linearRampToValueAtTime(1760, ctx.currentTime + 0.08);

		osc1.type = "sine";
		osc2.type = "sine";

		// Quick attack, exponential decay — bell shape
		gain1.gain.setValueAtTime(0, ctx.currentTime);
		gain1.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.012);
		gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

		gain2.gain.setValueAtTime(0, ctx.currentTime);
		gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.012);
		gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

		osc1.start(ctx.currentTime);
		osc1.stop(ctx.currentTime + 0.6);
		osc2.start(ctx.currentTime);
		osc2.stop(ctx.currentTime + 0.5);

		// Auto-close context after sound completes
		setTimeout(() => ctx.close(), 700);
	} catch {
		// Silently fail (e.g. if AudioContext is blocked)
	}
}

/**
 * Plays a soft two-tone "queued" confirmation sound.
 * Lower and quieter than the activation chime — signals a message was staged.
 */
export function playQueueChime(): void {
	if (typeof window === "undefined") return;
	try {
		const ctx = new AudioContext();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.type = "sine";
		osc.frequency.setValueAtTime(523, ctx.currentTime); // C5
		osc.frequency.linearRampToValueAtTime(659, ctx.currentTime + 0.08); // E5
		gain.gain.setValueAtTime(0, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + 0.4);
		setTimeout(() => ctx.close(), 500);
	} catch {
		// Silently fail
	}
}

// ─── Voice Profile ────────────────────────────────────────────────────────────
// Stores a teacher's voice frequency signature and verifies incoming audio.
// Uses Web Audio API FFT to find the speaker's fundamental frequency (F0).

export const VOICE_PROFILE_KEY = "voice-profile-v1";
const ENROLLMENT_MS = 5000;
const SAMPLE_INTERVAL_MS = 80;

export interface VoiceProfile {
	meanPitch: number; // Hz — fundamental frequency
	toleranceHz: number; // Hz — ± range to accept
	sampleCount: number;
	enrolledAt: number;
}

export function getVoiceProfile(): VoiceProfile | null {
	try {
		const raw = localStorage.getItem(VOICE_PROFILE_KEY);
		return raw ? (JSON.parse(raw) as VoiceProfile) : null;
	} catch {
		return null;
	}
}

export function clearVoiceProfile() {
	try {
		localStorage.removeItem(VOICE_PROFILE_KEY);
	} catch {}
}

/** Returns dominant fundamental frequency (Hz) in human speech range, or null if silent. */
function detectPitch(analyser: AnalyserNode): number | null {
	const buf = new Float32Array(analyser.frequencyBinCount);
	analyser.getFloatFrequencyData(buf);

	const sampleRate = analyser.context.sampleRate;
	const binHz = sampleRate / analyser.fftSize;

	// Search 80–350 Hz — covers all human fundamental frequencies
	const minBin = Math.floor(80 / binHz);
	const maxBin = Math.floor(350 / binHz);

	let maxVal = -Infinity;
	let maxIdx = minBin;
	for (let i = minBin; i <= maxBin && i < buf.length; i++) {
		if (buf[i] > maxVal) {
			maxVal = buf[i];
			maxIdx = i;
		}
	}

	// Below -50 dB = silence / background noise
	if (maxVal < -50) return null;

	return maxIdx * binHz;
}

/** Enroll the teacher's voice over 5 seconds. Returns the saved profile. */
export async function enrollVoiceProfile(
	onProgress?: (secondsLeft: number) => void,
): Promise<VoiceProfile> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
	const ctx = new AudioContext();
	const source = ctx.createMediaStreamSource(stream);
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 4096;
	source.connect(analyser);

	const samples: number[] = [];
	const startTime = Date.now();

	await new Promise<void>((resolve) => {
		const interval = setInterval(() => {
			const elapsed = Date.now() - startTime;
			const remaining = Math.ceil((ENROLLMENT_MS - elapsed) / 1000);
			onProgress?.(remaining);

			const pitch = detectPitch(analyser);
			if (pitch !== null) samples.push(pitch);

			if (elapsed >= ENROLLMENT_MS) {
				clearInterval(interval);
				resolve();
			}
		}, SAMPLE_INTERVAL_MS);
	});

	stream.getTracks().forEach((t) => {
		t.stop();
	});
	await ctx.close();

	if (samples.length < 15) {
		throw new Error("Not enough voice detected — please speak clearly into the microphone");
	}

	const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
	const variance = samples.reduce((s, p) => s + (p - mean) ** 2, 0) / samples.length;
	const stdDev = Math.sqrt(variance);
	// Tolerance = 2× standard deviation, minimum 25 Hz
	const toleranceHz = Math.round(Math.max(stdDev * 2, 25));

	const profile: VoiceProfile = {
		meanPitch: Math.round(mean),
		toleranceHz,
		sampleCount: samples.length,
		enrolledAt: Date.now(),
	};

	localStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(profile));
	return profile;
}

/** Returns true if pitch matches the enrolled profile (or if no profile is enrolled). */
export function pitchMatchesProfile(pitch: number, profile: VoiceProfile): boolean {
	return Math.abs(pitch - profile.meanPitch) <= profile.toleranceHz;
}

/** Open an audio analyser on the mic. Call cleanup() when done. */
export async function openPitchAnalyser(): Promise<{
	analyser: AnalyserNode;
	cleanup: () => void;
}> {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
	const ctx = new AudioContext();
	const source = ctx.createMediaStreamSource(stream);
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 4096;
	source.connect(analyser);

	return {
		analyser,
		cleanup: () => {
			stream.getTracks().forEach((t) => {
				t.stop();
			});
			ctx.close();
		},
	};
}

export { detectPitch };

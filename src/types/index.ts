export type LessonResourceType = "slides" | "book" | "worksheet" | "video" | "other";

export type LessonResource = {
	id: string;
	topicNumber: number;
	lessonNumber: string;
	resourceType: LessonResourceType;
	label: string;
	url: string;
	sortOrder: number;
	isTeacherOverride: boolean;
};

// ─── Noise / Waveform Contract ────────────────────────────────────────────────

/**
 * Snapshot of teacher mic amplitude captured at a point in time.
 * Stored in-memory by noise-store and posted by the teacher WaveformMeter.
 */
export interface NoiseFrame {
	/** RMS amplitude normalised to a percentage — integer in [0, 100]. */
	level: number;
	/** Unix ms timestamp when this frame was captured on the server. */
	timestamp: number;
}

/**
 * Shape of the SSE event that student-feed emits every 200 ms so the student
 * SoundcloudWave component can render the teacher's live mic amplitude.
 */
export interface StudentFeedNoiseEvent {
	type: "noise";
	/** RMS amplitude — integer in [0, 100]. */
	level: number;
}

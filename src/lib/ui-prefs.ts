"use client";

export const TOASTS_ENABLED_KEY = "ui.toastsEnabled";
export const PRODUCTION_HANDOFF_MODE_KEY = "ui.productionHandoffMode";
export const VOICE_LOCK_ENABLED_KEY = "voice.lockEnabled";
export const VOICE_DEBUG_FEEDBACK_ENABLED_KEY = "voice.debugFeedbackEnabled";
export const GLOBAL_VOICE_ONLY_MODE_KEY = "voice.globalVoiceOnlyMode";

export function readBooleanPreference(key: string, defaultValue: boolean) {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return defaultValue;
		return raw === "true";
	} catch {
		return defaultValue;
	}
}

export function isMicConsumerEnabled(consumer: string) {
	if (!readBooleanPreference(GLOBAL_VOICE_ONLY_MODE_KEY, false)) return true;
	return consumer === "globalVoice";
}

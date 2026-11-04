"use client";
import { AiPresenceBorder } from "@/components/coach/ai-presence-border";
import { TeachingDesk } from "@/components/coach/teaching-desk";
import { ReservationOverlay } from "@/components/reservations/reservation-overlay";
import { VoiceCommandProvider } from "@/components/voice/voice-command-provider";
import { CurrencyProvider } from "@/contexts/currency";
import { VoiceQueueProvider } from "@/contexts/voice-queue";
export function TutoringDesk({
	workspaceMode,
	initialClassId,
}: {
	workspaceMode: "distance" | "homeschool";
	initialClassId?: string;
}) {
	return (
		<VoiceQueueProvider key={workspaceMode} workspaceMode={workspaceMode}>
			<CurrencyProvider>
				<AiPresenceBorder />
				<VoiceCommandProvider>
					<TeachingDesk workspaceMode={workspaceMode} initialClassId={initialClassId} />
				</VoiceCommandProvider>
				<ReservationOverlay />
			</CurrencyProvider>
		</VoiceQueueProvider>
	);
}

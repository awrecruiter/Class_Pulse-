"use client";

import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GroupsBoardPanel } from "@/components/board/groups-panel";
import { PortalPanel } from "@/components/board/portal-panel";
import { PulsePanel } from "@/components/board/pulse-panel";
import { ResourceViewer } from "@/components/board/resource-viewer";
import { type BoardPanel, SideStrip } from "@/components/board/side-strip";
import { useVoiceQueue } from "@/contexts/voice-queue";
import { useLectureTranscript } from "@/hooks/use-lecture-transcript";

const STORAGE_KEY = "board-recent-resources";

function getLastResource(): string | null {
	try {
		const items = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		return items[0]?.url ?? null;
	} catch {
		return null;
	}
}

export default function BoardPage() {
	const [activePanel, setActivePanel] = useState<BoardPanel>("portal");
	const [sidebarVisible, setSidebarVisible] = useState(true);
	const { boardPanel, setBoardPanel, boardOpenLast } = useVoiceQueue();

	const { isListening, wordCount, startListening, stopListening } = useLectureTranscript();

	// React to voice board commands from the global mic
	useEffect(() => {
		if (!boardPanel) return;
		setActivePanel(boardPanel);
		setBoardPanel(null); // consume
	}, [boardPanel, setBoardPanel]);

	useEffect(() => {
		if (boardOpenLast === 0) return;
		const last = getLastResource();
		if (last) {
			setActivePanel("resources");
		} else {
			toast.info("No recent resources found", { duration: 2500 });
		}
	}, [boardOpenLast]);

	const handleToggleMic = () => {
		if (isListening) stopListening();
		else startListening();
	};

	return (
		<div className="h-screen w-screen flex overflow-hidden bg-[#0d1525]">
			{sidebarVisible && (
				<SideStrip
					activePanel={activePanel}
					onPanelChange={setActivePanel}
					isListening={isListening}
					onToggleMic={handleToggleMic}
					wordCount={wordCount}
					onHide={() => setSidebarVisible(false)}
				/>
			)}

			<main className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
				{!sidebarVisible && (
					<button
						type="button"
						onClick={() => setSidebarVisible(true)}
						className="absolute top-3 left-3 z-10 flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
						title="Show sidebar"
					>
						<ChevronRightIcon className="h-4 w-4" />
					</button>
				)}
				{activePanel === "portal" && <PortalPanel />}
				{activePanel === "resources" && <ResourceViewer />}
				{activePanel === "pulse" && <PulsePanel />}
				{activePanel === "groups" && <GroupsBoardPanel />}
			</main>
		</div>
	);
}

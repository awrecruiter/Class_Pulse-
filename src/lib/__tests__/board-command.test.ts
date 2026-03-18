import { describe, expect, it } from "vitest";
import { matchBoardCommand } from "@/hooks/use-board-voice";

describe("matchBoardCommand — open_app", () => {
	it("opens Portal with trigger word", () => {
		const cmd = matchBoardCommand("open portal");
		expect(cmd).toMatchObject({ type: "open_app", label: "Portal" });
	});
	it("opens iReady by alias 'i ready'", () => {
		const cmd = matchBoardCommand("open i ready");
		expect(cmd).toMatchObject({ type: "open_app", label: "iReady" });
	});
	it("opens Outlook by 'my email' alias", () => {
		const cmd = matchBoardCommand("open my email");
		expect(cmd).toMatchObject({ type: "open_app", label: "Outlook" });
	});
	it("opens Schoology by 'assignments' alias", () => {
		const cmd = matchBoardCommand("go to assignments");
		expect(cmd).toMatchObject({ type: "open_app", label: "Schoology" });
	});
	it("opens IXL by 'ixl' alias (bare, no trigger)", () => {
		const cmd = matchBoardCommand("ixl");
		expect(cmd).toMatchObject({ type: "open_app", label: "IXL" });
	});
	it("opens McGraw Hill by 'mcgraw hill' alias", () => {
		const cmd = matchBoardCommand("open mcgraw hill");
		expect(cmd).toMatchObject({ type: "open_app", label: "McGraw Hill" });
	});
	it("opens Big Ideas Math by 'big ideas' alias", () => {
		const cmd = matchBoardCommand("open big ideas");
		expect(cmd).toMatchObject({ type: "open_app", label: "Big Ideas Math" });
	});
	it("opens OneDrive by 'my files' alias", () => {
		const cmd = matchBoardCommand("pull up my files");
		expect(cmd).toMatchObject({ type: "open_app", label: "OneDrive" });
	});
	it("opens Pinnacle by 'gradebook' alias (no trigger needed — bare match)", () => {
		const cmd = matchBoardCommand("gradebook");
		expect(cmd).toMatchObject({ type: "open_app", label: "Pinnacle" });
	});
	it("opens Clever by 'clever' alias", () => {
		// "open clever portal" would match Portal via substring; use bare "open clever"
		const cmd = matchBoardCommand("open clever");
		expect(cmd).toMatchObject({ type: "open_app", label: "Clever" });
	});
});

describe("matchBoardCommand — switch_panel", () => {
	it("switches to pulse panel via 'class pulse'", () => {
		const cmd = matchBoardCommand("class pulse");
		expect(cmd).toMatchObject({ type: "switch_panel", panel: "pulse" });
	});
	it("switches to pulse via 'comprehension check'", () => {
		const cmd = matchBoardCommand("comprehension check");
		expect(cmd).toMatchObject({ type: "switch_panel", panel: "pulse" });
	});
	it("switches to resources via 'resource panel'", () => {
		const cmd = matchBoardCommand("resource panel");
		expect(cmd).toMatchObject({ type: "switch_panel", panel: "resources" });
	});
	it("switches to portal panel via 'open my portal'", () => {
		const cmd = matchBoardCommand("open my portal");
		expect(cmd).toMatchObject({ type: "switch_panel", panel: "portal" });
	});
});

describe("matchBoardCommand — open_last_resource", () => {
	it("triggers open_last_resource via 'open last'", () => {
		expect(matchBoardCommand("open last")).toMatchObject({ type: "open_last_resource" });
	});
	it("triggers open_last_resource via 'reopen'", () => {
		expect(matchBoardCommand("reopen")).toMatchObject({ type: "open_last_resource" });
	});
	it("triggers open_last_resource via 'my last file'", () => {
		expect(matchBoardCommand("my last file")).toMatchObject({ type: "open_last_resource" });
	});
});

describe("matchBoardCommand — no match", () => {
	it("returns null for unrelated utterance", () => {
		expect(matchBoardCommand("give Marcus 10 bucks")).toBeNull();
	});
	it("returns null for empty string", () => {
		expect(matchBoardCommand("")).toBeNull();
	});
	it("returns null for generic words", () => {
		expect(matchBoardCommand("hello there")).toBeNull();
	});
});

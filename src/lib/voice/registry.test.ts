import { describe, expect, it } from "vitest";
import { getVoiceSurface, matchNavigationDestination } from "./registry";

describe("voice registry", () => {
	it("matches navigation aliases including parent comms", () => {
		expect(matchNavigationDestination("go to classes")).toBe("classes");
		expect(matchNavigationDestination("open parent comms")).toBe("parent-comms");
		expect(matchNavigationDestination("take me to communications")).toBe("parent-comms");
		expect(matchNavigationDestination("switch to grade book")).toBe("gradebook");
	});

	it("resolves the current voice surface from pathname", () => {
		expect(getVoiceSurface("/coach")?.id).toBe("coach");
		expect(getVoiceSurface("/classes/123")?.id).toBe("class-detail");
		expect(getVoiceSurface("/parent-comms")?.id).toBe("parent-comms");
	});
});

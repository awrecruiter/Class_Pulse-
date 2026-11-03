import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { select: () => ({ from: () => ({ where: rows }) }) } }));

import { canShareParentReport, isConfirmedParent } from "./parent-confirmation";

describe("parent recipient confirmation", () => {
	beforeEach(() => rows.mockReset());
	it("blocks unconfirmed and changed phone numbers", () => {
		const contact = {
			phone: "+12025550101",
			confirmedPhone: null,
			phoneConfirmedAt: null,
			isActive: true,
		};
		expect(isConfirmedParent(contact)).toBe(false);
		expect(
			isConfirmedParent({
				...contact,
				confirmedPhone: contact.phone,
				phoneConfirmedAt: new Date(),
			}),
		).toBe(true);
		expect(
			isConfirmedParent({
				...contact,
				confirmedPhone: "+12025550102",
				phoneConfirmedAt: new Date(),
			}),
		).toBe(false);
	});
	it("blocks report sharing for unconfirmed orientation families", async () => {
		rows.mockResolvedValueOnce([{ id: "invite" }]).mockResolvedValueOnce([]);
		expect(await canShareParentReport("class", "student")).toBe(false);
	});
	it("preserves existing classroom sharing for learners outside orientation", async () => {
		rows.mockResolvedValueOnce([]);
		expect(await canShareParentReport("class", "student")).toBe(true);
	});
});

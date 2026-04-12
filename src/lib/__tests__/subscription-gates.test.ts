import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("postgres", () => ({
	default: vi.fn(() => queryMock),
}));

vi.mock("@/lib/env", () => ({
	getRequiredEnv: vi.fn(() => "postgresql://example"),
}));

describe("subscription gates", () => {
	beforeEach(() => {
		queryMock.mockReset();
	});

	it("returns all surfaces when the tables do not exist yet", async () => {
		queryMock.mockImplementation(async (strings: TemplateStringsArray) => {
			const text = strings.join("");
			if (text.includes("information_schema.tables")) return [];
			throw new Error(`Unexpected query: ${text}`);
		});

		const { getEnabledSurfacesForUser } = await import("../subscription/gates");
		await expect(getEnabledSurfacesForUser("user-1")).resolves.toEqual([
			"behavior_class_management",
			"instructional_coach",
			"planning",
		]);
	});

	it("uses the subscription record when one exists", async () => {
		queryMock.mockImplementation(async (strings: TemplateStringsArray) => {
			const text = strings.join("");
			if (text.includes("information_schema.tables")) {
				return [
					{ table_name: "organization_memberships" },
					{ table_name: "organizations" },
					{ table_name: "subscriptions" },
				];
			}
			if (text.includes("behavior_class_management_enabled")) {
				return [
					{
						organization_id: "org-1",
						status: "active",
						behavior_class_management_enabled: false,
						instructional_coach_enabled: true,
						planning_enabled: true,
					},
				];
			}
			throw new Error(`Unexpected query: ${text}`);
		});

		const { getEnabledSurfacesForUser, isSurfaceEnabledForUser } = await import(
			"../subscription/gates"
		);
		await expect(getEnabledSurfacesForUser("user-1")).resolves.toEqual([
			"instructional_coach",
			"planning",
		]);
		await expect(isSurfaceEnabledForUser("user-1", "instructional_coach")).resolves.toBe(true);
		await expect(isSurfaceEnabledForUser("user-1", "behavior_class_management")).resolves.toBe(
			false,
		);
	});

	it("falls back to legacy access when the tables exist but no subscription row does", async () => {
		queryMock.mockImplementation(async (strings: TemplateStringsArray) => {
			const text = strings.join("");
			if (text.includes("information_schema.tables")) {
				return [
					{ table_name: "organization_memberships" },
					{ table_name: "organizations" },
					{ table_name: "subscriptions" },
				];
			}
			if (text.includes("behavior_class_management_enabled")) {
				return [];
			}
			throw new Error(`Unexpected query: ${text}`);
		});

		const { getEnabledSurfacesForUser } = await import("../subscription/gates");
		await expect(getEnabledSurfacesForUser("legacy-user")).resolves.toEqual([
			"behavior_class_management",
			"instructional_coach",
			"planning",
		]);
	});
});

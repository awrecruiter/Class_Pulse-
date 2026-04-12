import {
	ALL_SERVICE_SURFACES,
	resolveEnabledSurfacesFromState,
} from "@/lib/subscription/entitlements";

describe("subscription entitlements", () => {
	it("defaults legacy users to all surfaces when no membership exists", () => {
		expect(resolveEnabledSurfacesFromState({ membership: null, subscription: null })).toEqual(
			ALL_SERVICE_SURFACES,
		);
	});

	it("defaults members without a subscription row to all surfaces", () => {
		expect(
			resolveEnabledSurfacesFromState({
				membership: { organizationId: "org-1" },
				subscription: null,
			}),
		).toEqual(ALL_SERVICE_SURFACES);
	});

	it("returns only the enabled surfaces for an active subscription", () => {
		expect(
			resolveEnabledSurfacesFromState({
				membership: { organizationId: "org-1" },
				subscription: {
					organizationId: "org-1",
					status: "active",
					behaviorClassManagementEnabled: true,
					instructionalCoachEnabled: false,
					planningEnabled: true,
				},
			}),
		).toEqual(["behavior_class_management", "planning"]);
	});

	it("fails closed only when an active subscription explicitly disables every surface", () => {
		expect(
			resolveEnabledSurfacesFromState({
				membership: { organizationId: "org-1" },
				subscription: {
					organizationId: "org-1",
					status: "active",
					behaviorClassManagementEnabled: false,
					instructionalCoachEnabled: false,
					planningEnabled: false,
				},
			}),
		).toEqual([]);
	});

	it("treats inactive subscriptions as legacy-open during rollout", () => {
		expect(
			resolveEnabledSurfacesFromState({
				membership: { organizationId: "org-1" },
				subscription: {
					organizationId: "org-1",
					status: "canceled",
					behaviorClassManagementEnabled: false,
					instructionalCoachEnabled: false,
					planningEnabled: false,
				},
			}),
		).toEqual(ALL_SERVICE_SURFACES);
	});
});

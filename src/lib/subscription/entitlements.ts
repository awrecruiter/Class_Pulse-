import { ALL_SERVICE_SURFACES, type ServiceSurface } from "@/lib/subscription/surfaces";

export {
	ALL_SERVICE_SURFACES,
	SERVICE_SURFACES,
	type ServiceSurface,
} from "@/lib/subscription/surfaces";

type MembershipRow = {
	organizationId: string;
};

type SubscriptionRow = {
	organizationId: string;
	status: string;
	behaviorClassManagementEnabled: boolean;
	instructionalCoachEnabled: boolean;
	planningEnabled: boolean;
};

export function resolveEnabledSurfacesFromState(input: {
	membership: MembershipRow | null;
	subscription: SubscriptionRow | null;
}): ServiceSurface[] {
	if (!input.membership) return [...ALL_SERVICE_SURFACES];
	if (!input.subscription || input.subscription.status !== "active")
		return [...ALL_SERVICE_SURFACES];

	const enabled: ServiceSurface[] = [];
	if (input.subscription.behaviorClassManagementEnabled) enabled.push("behavior_class_management");
	if (input.subscription.instructionalCoachEnabled) enabled.push("instructional_coach");
	if (input.subscription.planningEnabled) enabled.push("planning");
	return enabled;
}

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationMemberships, subscriptions } from "@/lib/db/schema";
import {
	resolveEnabledSurfacesFromState,
	type ServiceSurface,
} from "@/lib/subscription/entitlements";

export async function getEnabledSurfacesForUser(userId: string): Promise<ServiceSurface[]> {
	const [membership] = await db
		.select({ organizationId: organizationMemberships.organizationId })
		.from(organizationMemberships)
		.where(eq(organizationMemberships.userId, userId))
		.limit(1);

	if (!membership) return resolveEnabledSurfacesFromState({ membership: null, subscription: null });

	const [subscription] = await db
		.select({
			organizationId: subscriptions.organizationId,
			status: subscriptions.status,
			behaviorClassManagementEnabled: subscriptions.behaviorClassManagementEnabled,
			instructionalCoachEnabled: subscriptions.instructionalCoachEnabled,
			planningEnabled: subscriptions.planningEnabled,
		})
		.from(subscriptions)
		.where(
			and(
				eq(subscriptions.organizationId, membership.organizationId),
				eq(subscriptions.status, "active"),
			),
		)
		.limit(1);

	return resolveEnabledSurfacesFromState({
		membership,
		subscription: subscription ?? null,
	});
}

export async function isSurfaceEnabledForUser(
	userId: string,
	surface: ServiceSurface,
): Promise<boolean> {
	const enabledSurfaces = await getEnabledSurfacesForUser(userId);
	return enabledSurfaces.includes(surface);
}

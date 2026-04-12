import postgres from "postgres";
import { getRequiredEnv } from "@/lib/env";
import {
	resolveEnabledSurfacesFromState,
	SERVICE_SURFACES,
	type ServiceSurface,
} from "./entitlements";

type TablePresenceRow = {
	table_name: string;
};

type SubscriptionRow = {
	organization_id: string;
	status: string;
	behavior_class_management_enabled: boolean;
	instructional_coach_enabled: boolean;
	planning_enabled: boolean;
};

const sql = postgres(getRequiredEnv("DATABASE_URL"), {
	prepare: false,
	max: 1,
});

async function hasSubscriptionTables(): Promise<boolean> {
	const rows = (await sql`
		select table_name
		from information_schema.tables
		where table_schema = 'public'
			and table_name in ('organizations', 'organization_memberships', 'subscriptions')
		order by table_name
	`) as TablePresenceRow[];

	return rows.length === 3;
}

async function loadEnabledSurfaces(userId: string): Promise<ServiceSurface[] | null> {
	if (!(await hasSubscriptionTables())) {
		return null;
	}

	const rows = (await sql`
		select
			s.organization_id,
			s.status,
			s.behavior_class_management_enabled,
			s.instructional_coach_enabled,
			s.planning_enabled
		from organizations o
		inner join organization_memberships om on om.organization_id = o.id
		inner join subscriptions s on s.organization_id = o.id
		where om.user_id = ${userId}
		order by s.updated_at desc nulls last, s.created_at desc nulls last
		limit 1
	`) as SubscriptionRow[];

	if (rows.length === 0) {
		return null;
	}

	const subscription = rows[0];
	return resolveEnabledSurfacesFromState({
		membership: { organizationId: subscription.organization_id },
		subscription: {
			organizationId: subscription.organization_id,
			status: subscription.status,
			behaviorClassManagementEnabled: subscription.behavior_class_management_enabled,
			instructionalCoachEnabled: subscription.instructional_coach_enabled,
			planningEnabled: subscription.planning_enabled,
		},
	});
}

export async function getEnabledSurfacesForUser(userId: string): Promise<ServiceSurface[]> {
	const surfaces = await loadEnabledSurfaces(userId);
	return surfaces ?? [...SERVICE_SURFACES];
}

export async function isSurfaceEnabledForUser(
	userId: string,
	surface: ServiceSurface,
): Promise<boolean> {
	const enabledSurfaces = await getEnabledSurfacesForUser(userId);
	return enabledSurfaces.includes(surface);
}

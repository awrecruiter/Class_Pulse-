export const SERVICE_SURFACES = [
	"behavior_class_management",
	"instructional_coach",
	"planning",
] as const;

export type ServiceSurface = (typeof SERVICE_SURFACES)[number];

export const ALL_SERVICE_SURFACES: readonly ServiceSurface[] = SERVICE_SURFACES;

export function isServiceSurface(value: string): value is ServiceSurface {
	return (SERVICE_SURFACES as readonly string[]).includes(value);
}

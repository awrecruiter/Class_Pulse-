import { createAuthServer } from "@neondatabase/auth/next/server";
import { readBooleanEnv } from "@/lib/env";

// Lazy singleton — createAuthServer() reads NEON_AUTH_BASE_URL at call time.
// Calling it at module load (top-level) causes next build to fail when the env
// var isn't present, because Next.js imports every route module during the
// "Collecting page data" phase even with force-dynamic.
let _authInstance: ReturnType<typeof createAuthServer> | null = null;
function getAuthInstance() {
	if (!_authInstance) _authInstance = createAuthServer();
	return _authInstance;
}

// In development with no real Neon Auth session, fall back to a local dev user
// so API routes work without requiring a full auth flow.
const DEV_USER = {
	id: "dev-user-local",
	name: "Dev Teacher",
	email: "dev@local.dev",
	emailVerified: true,
	createdAt: new Date(),
	updatedAt: new Date(),
};

export const auth = {
	getSession: async () => {
		const result = await getAuthInstance().getSession();
		if (
			!result.data?.user &&
			process.env.NODE_ENV === "development" &&
			readBooleanEnv("ALLOW_DEV_AUTH_BYPASS")
		) {
			return { data: { user: DEV_USER } };
		}
		return result;
	},
};

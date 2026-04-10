import { createAuthServer } from "@neondatabase/auth/next/server";
import { readBooleanEnv } from "@/lib/env";

const _auth = createAuthServer();

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
		const result = await _auth.getSession();
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

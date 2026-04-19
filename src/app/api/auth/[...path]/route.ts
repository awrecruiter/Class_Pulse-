export const dynamic = "force-dynamic";

import { authApiHandler } from "@neondatabase/auth/next/server";

export const { GET, POST } = authApiHandler();

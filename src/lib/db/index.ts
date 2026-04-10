import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getRequiredEnv } from "@/lib/env";
import * as schema from "./schema";

const sql = postgres(getRequiredEnv("DATABASE_URL"), {
	prepare: false,
	max: 1,
});

export const db = drizzle(sql, { schema });

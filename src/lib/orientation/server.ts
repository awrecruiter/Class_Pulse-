import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { classes, orientations } from "@/lib/db/schema";
import { orientationTokenSchema } from "./validation";

export async function findOrientation(token: string) {
	if (!orientationTokenSchema.safeParse(token).success) return null;
	const [row] = await db
		.select({ invite: orientations, classroom: classes })
		.from(orientations)
		.innerJoin(classes, eq(classes.id, orientations.classId))
		.where(
			and(
				eq(orientations.token, token),
				gt(orientations.expiresAt, new Date()),
				eq(classes.isArchived, false),
			),
		);
	return row ?? null;
}

export async function ownsOrientationClass(classId: string, teacherId: string) {
	const [row] = await db
		.select({ id: classes.id })
		.from(classes)
		.where(
			and(eq(classes.id, classId), eq(classes.teacherId, teacherId), eq(classes.isArchived, false)),
		);
	return !!row;
}

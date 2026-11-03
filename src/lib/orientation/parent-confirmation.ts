import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orientations, parentContacts } from "@/lib/db/schema";

export function isConfirmedParent(
	contact:
		| {
				phone: string;
				confirmedPhone: string | null;
				phoneConfirmedAt: Date | string | null;
				isActive: boolean;
		  }
		| undefined,
) {
	return (
		!!contact?.isActive && !!contact.phoneConfirmedAt && contact.phone === contact.confirmedPhone
	);
}

// Orientation families require recipient confirmation; legacy classroom sharing keeps its existing behavior.
export async function canShareParentReport(classId: string, rosterId: string) {
	const [orientation] = await db
		.select({ id: orientations.id })
		.from(orientations)
		.where(and(eq(orientations.classId, classId), eq(orientations.rosterId, rosterId)));
	if (!orientation) return true;
	const [contact] = await db
		.select()
		.from(parentContacts)
		.where(and(eq(parentContacts.classId, classId), eq(parentContacts.rosterId, rosterId)));
	return isConfirmedParent(contact);
}

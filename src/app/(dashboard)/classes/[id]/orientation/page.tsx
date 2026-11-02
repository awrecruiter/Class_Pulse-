import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrientationManager } from "@/components/orientation/orientation-manager";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";

export default async function ClassOrientationPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { data } = await auth.getSession();
	if (!data?.user) redirect("/login");
	const { id } = await params;
	const [cls] = await db
		.select({ label: classes.label })
		.from(classes)
		.where(and(eq(classes.id, id), eq(classes.teacherId, data.user.id)));
	if (!cls) notFound();
	return (
		<main className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-slate-200">
			<Link className="text-sm text-indigo-300" href={`/classes/${id}`}>
				← Back to class
			</Link>
			<header>
				<h1 className="text-2xl font-bold">Family orientation</h1>
				<p className="mt-2 text-slate-400">
					{cls.label} · Intake, booking, learning, and parent reinforcement
				</p>
			</header>
			<OrientationManager classId={id} />
		</main>
	);
}

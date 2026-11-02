import type { Metadata } from "next";
import { OrientationFlow } from "@/components/orientation/orientation-flow";

export const metadata: Metadata = {
	title: "Family orientation — Class Pulse",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};
export default async function OrientationPage({
	params,
	searchParams,
}: {
	params: Promise<{ token: string }>;
	searchParams: Promise<{ step?: string }>;
}) {
	return (
		<OrientationFlow
			token={(await params).token}
			resumeProgress={(await searchParams).step === "progress"}
		/>
	);
}

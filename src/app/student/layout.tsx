import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Class Pulse — Student",
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	return <div className="min-h-screen bg-[#0f1117]">{children}</div>;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Student — UnGhettoMyLife",
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-gradient-to-br from-sky-400 via-indigo-500 to-violet-600">
			{children}
		</div>
	);
}

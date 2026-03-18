import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "RAM Class — Student",
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-white text-slate-900 dark:bg-[#0f1117] dark:text-slate-100">
			{children}
		</div>
	);
}

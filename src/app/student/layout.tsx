"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Clear any stale toasts that leaked from the teacher dashboard
		// (e.g. voice command toasts that were in-flight during navigation)
		toast.dismiss();
	}, []);

	return <div className="min-h-screen bg-[#0f1117]">{children}</div>;
}

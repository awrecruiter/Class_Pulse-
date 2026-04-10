"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function GoogleButton() {
	const [loading, setLoading] = useState(false);

	const handleGoogleSignIn = async () => {
		setLoading(true);
		try {
			const callbackURL =
				typeof window !== "undefined" ? `${window.location.origin}/coach` : "/coach";
			await authClient.signIn.social({
				provider: "google",
				callbackURL,
			});
		} catch {
			setLoading(false);
		}
	};

	return (
		<Button
			type="button"
			variant="outline"
			className="w-full"
			onClick={handleGoogleSignIn}
			disabled={loading}
		>
			{loading ? "Redirecting..." : "Continue with Google"}
		</Button>
	);
}

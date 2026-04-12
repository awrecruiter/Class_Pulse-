"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			const { error: authError } = await authClient.signIn.email({
				email,
				password,
			});

			if (authError) {
				setError("Invalid email or password");
				setLoading(false);
				return;
			}

			router.push("/coach");
		} catch {
			setError("Something went wrong. Please try again.");
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-label="Email"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Your password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					aria-label="Password"
				/>
			</div>

			{error && <p className="text-sm text-destructive text-center">{error}</p>}

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Signing in..." : "Sign In"}
			</Button>
		</form>
	);
}

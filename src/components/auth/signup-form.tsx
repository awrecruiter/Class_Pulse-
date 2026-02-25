"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

interface FormErrors {
	name?: string;
	email?: string;
	password?: string;
	general?: string;
}

export function SignupForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<FormErrors>({});
	const [loading, setLoading] = useState(false);

	const validate = (): boolean => {
		const newErrors: FormErrors = {};

		if (!name.trim()) newErrors.name = "Name is required";
		if (!email.trim()) newErrors.email = "Email is required";
		if (password.length < 8) newErrors.password = "Password must be at least 8 characters";

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setLoading(true);
		setErrors({});

		try {
			const { error } = await authClient.signUp.email({
				email,
				password,
				name,
			});

			if (error) {
				setErrors({ general: error.message || "Failed to create account" });
				setLoading(false);
				return;
			}

			router.push("/coach");
		} catch {
			setErrors({ general: "Something went wrong. Please try again." });
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					id="name"
					placeholder="Your name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					aria-label="Name"
				/>
				{errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
			</div>

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
				{errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="At least 8 characters"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					aria-label="Password"
				/>
				{errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
			</div>

			{errors.general && <p className="text-sm text-destructive text-center">{errors.general}</p>}

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Creating Account..." : "Create Account"}
			</Button>
		</form>
	);
}

import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
	return (
		<Card>
			<CardHeader className="text-center">
				<CardTitle className="text-2xl">Create your account</CardTitle>
				<CardDescription>Create your teacher account</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<GoogleButton />
				<div className="flex items-center gap-4">
					<Separator className="flex-1" />
					<span className="text-sm text-muted-foreground">or</span>
					<Separator className="flex-1" />
				</div>
				<SignupForm />
				<p className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link href="/login" className="text-primary underline-offset-4 hover:underline">
						Sign in
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}

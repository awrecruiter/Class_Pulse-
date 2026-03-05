import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "UnGhettoMyLife — AI Instructional Coach",
	description: "AI-powered remediation coaching for Florida math teachers",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Apply saved theme before first paint to avoid flash */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: intentional anti-flash script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})()`,
					}}
				/>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<AuthProvider>{children}</AuthProvider>
				<Toaster />
			</body>
		</html>
	);
}

import type { NextConfig } from "next";

const isStudentApp = process.env.STUDENT_APP === "true";

const nextConfig: NextConfig = {
	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"gsap",
			"@radix-ui/react-dialog",
			"@radix-ui/react-dropdown-menu",
			"@radix-ui/react-select",
			"@radix-ui/react-tabs",
			"@radix-ui/react-toast",
		],
	},
	// When deployed as the student-facing app, redirect root → /student
	// and block all teacher routes.
	...(isStudentApp && {
		redirects: async () => [{ source: "/", destination: "/student", permanent: false }],
	}),
};

export default nextConfig;

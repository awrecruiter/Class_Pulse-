import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	distDir: process.env.NODE_ENV === "production" ? ".next-prod" : ".next",
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
};

export default nextConfig;

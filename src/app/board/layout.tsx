import { Toaster } from "@/components/ui/sonner";

export default function BoardLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			{children}
			<Toaster />
		</>
	);
}

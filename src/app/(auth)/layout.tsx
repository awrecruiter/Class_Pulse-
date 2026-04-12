export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">
				<p className="text-center text-2xl font-bold mb-6">Class Pulse</p>
				{children}
			</div>
		</div>
	);
}

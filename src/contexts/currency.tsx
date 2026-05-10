"use client";

import { createContext, useContext, useEffect, useState } from "react";

type CurrencyCtx = { name: string; emoji: string };

const CurrencyContext = createContext<CurrencyCtx>({ name: "RAM Bucks", emoji: "🐏" });

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
	const [currency, setCurrency] = useState<CurrencyCtx>({ name: "RAM Bucks", emoji: "🐏" });

	useEffect(() => {
		fetch("/api/teacher-settings")
			.then((r) => (r.ok ? r.json() : null))
			.then((j) => {
				if (!j?.settings) return;
				setCurrency({
					name: j.settings.currencyName ?? "RAM Bucks",
					emoji: j.settings.currencyEmoji ?? "🐏",
				});
			})
			.catch(() => {});
	}, []);

	return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
	return useContext(CurrencyContext);
}

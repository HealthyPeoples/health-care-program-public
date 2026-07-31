"use client";

import { createContext, useContext, useEffect, useRef } from "react";

export type TabRefreshContextValue = {
	href: string;
	refreshToken: number;
};

export const TabRefreshContext = createContext<TabRefreshContextValue | null>(null);

/**
 * 탭이 다시 활성화될 때(다른 탭 → 현재 탭) onRefresh를 호출합니다.
 * 컴포넌트를 remount하지 않으므로 날짜/수급자 선택 등 UI 상태는 유지됩니다.
 */
export function useTabRefresh(onRefresh: () => void) {
	const ctx = useContext(TabRefreshContext);
	const cbRef = useRef(onRefresh);
	cbRef.current = onRefresh;
	const prevTokenRef = useRef<number | null>(null);

	useEffect(() => {
		if (!ctx) return;
		if (prevTokenRef.current === null) {
			prevTokenRef.current = ctx.refreshToken;
			return;
		}
		if (ctx.refreshToken !== prevTokenRef.current) {
			prevTokenRef.current = ctx.refreshToken;
			cbRef.current();
		}
	}, [ctx?.refreshToken, ctx?.href]);
}

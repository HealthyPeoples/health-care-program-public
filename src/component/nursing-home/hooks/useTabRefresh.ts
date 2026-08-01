/**
 * @file 요양원 탭 재활성 시 데이터 재조회 훅
 *
 * @description
 * 레이아웃이 제공하는 {@link TabRefreshContext}의 `refreshToken` 변화를 감지해
 * 현재 화면의 `onRefresh`만 호출합니다. remount하지 않아 날짜·선택 상태가 유지됩니다.
 *
 * @example
 * useTabRefresh(() => { void loadList(); });
 */
"use client";

import { createContext, useContext, useEffect, useRef } from "react";

/** 탭 셸이 내려주는 현재 경로와 새로고침 토큰 */
export type TabRefreshContextValue = {
	href: string;
	/** 탭 전환마다 증가. 구독자가 이 값 변화로 재조회 */
	refreshToken: number;
};

export const TabRefreshContext = createContext<TabRefreshContextValue | null>(null);

/**
 * 탭이 다시 활성화될 때(다른 탭 → 현재 탭) onRefresh를 호출합니다.
 * 컴포넌트를 remount하지 않으므로 날짜/수급자 선택 등 UI 상태는 유지됩니다.
 *
 * @param onRefresh - 토큰 변경 시 호출할 콜백 (최신 클로저는 ref로 유지)
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

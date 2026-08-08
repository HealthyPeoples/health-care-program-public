"use client";

/**
 * @file 요양원 공통 분할 레이아웃
 *
 * @description
 * 목록+상세(2·3열) 화면의 반응형 래퍼/클래스 상수입니다.
 * xl 미만에서는 세로 스택, xl 이상에서 가로 분할합니다.
 *
 * @module component/nursing-home/components/NhSplitLayout
 */
import React, { type ReactNode } from "react";

/** 뷰포트 높이 분할 루트 (탭 헤더 아래 기준 56px) */
export const NH_SPLIT_ROOT =
	"flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0 w-full";

/**
 * BeneficiaryListPanel 등 좌측 1/4 패널
 * 축소 시 max-h로 목록이 사라지지 않도록 높이 제한 없음(LongtermPhysicalActivity 패턴).
 * xl 이상에서만 사이드 패널로 높이/overflow를 채움.
 */
export const NH_ASIDE_QUARTER =
	"w-full xl:w-1/4 xl:min-w-[240px] xl:max-w-sm shrink-0 min-w-0 border-b xl:border-b-0 xl:h-full xl:overflow-hidden";

/** 인라인 좌측 목록 패널 (w-1/4 대체) */
export const NH_PANEL_QUARTER =
	"flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden";

/** 중간/우측 1/4 패널 (3열 중 mid) — 스택 시만 높이 제한해 상세가 보이도록 */
export const NH_PANEL_QUARTER_MID =
	"flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 border-b xl:border-b-0 max-h-[40vh] xl:max-h-none min-h-[200px] xl:min-h-0 overflow-hidden";

/** 좌측 1/3 패널 (longterm 등) */
export const NH_ASIDE_THIRD =
	"w-full lg:w-1/3 lg:max-w-md shrink-0 min-w-0";

/** 인라인 1/3 패널 */
export const NH_PANEL_THIRD =
	"flex flex-col w-full lg:w-1/3 min-w-0 shrink-0 border-b lg:border-b-0 lg:h-full lg:min-h-0 lg:overflow-hidden";

/** 우측/본문 영역 */
export const NH_SPLIT_MAIN =
	"relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden";

/** 제목+액션 툴바 */
export const NH_TOOLBAR =
	"flex flex-wrap items-center justify-between gap-2";

type NhSplitLayoutProps = {
	aside: ReactNode;
	children: ReactNode;
	/** 기본 xl (3열 밀집 화면용). 2열 단순 화면은 lg 사용 가능 */
	breakpoint?: "lg" | "xl";
	className?: string;
	mainClassName?: string;
};

/**
 * 좌측 aside + 본문 분할 레이아웃.
 * 페이지별로 클래스를 직접 쓰는 경우 export된 상수를 사용하세요.
 */
export default function NhSplitLayout({
	aside,
	children,
	breakpoint = "xl",
	className = "",
	mainClassName = "",
}: NhSplitLayoutProps) {
	const root =
		breakpoint === "lg"
			? "flex flex-col lg:flex-row lg:h-[calc(100vh-56px)] min-h-0 w-full"
			: NH_SPLIT_ROOT;
	const asideCls =
		breakpoint === "lg"
			? "w-full lg:w-1/4 lg:min-w-[240px] lg:max-w-sm shrink-0 min-w-0 border-b lg:border-b-0 lg:h-full lg:overflow-hidden"
			: NH_ASIDE_QUARTER;

	return (
		<div className={`${root} ${className}`.trim()}>
			<div className={asideCls}>{aside}</div>
			<div className={`${NH_SPLIT_MAIN} ${mainClassName}`.trim()}>{children}</div>
		</div>
	);
}

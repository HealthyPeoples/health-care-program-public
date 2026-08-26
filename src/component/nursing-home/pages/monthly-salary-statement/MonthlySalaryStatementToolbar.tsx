"use client";

/**
 * @file 월 급여명세서 — 화면 컴포넌트 (MonthlySalaryStatementToolbar.tsx)
 *
 * @description
 * 요양원 월 급여명세서 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/monthly-salary-statement
 *
 * @module component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatementToolbar
 */
import React from "react";
import MonthlySalaryStatementFilter from "./MonthlySalaryStatementFilter";

export type MonthlySalaryStatementToolbarTab = {
	id: string;
	label: string;
};

export type MonthlySalaryStatementToolbarProps = {
	activeTab: string | null;
	tabTitle: string;
	payYearMonth: string;
	recipientFilter: string;
	checkedCount: number;
	facilityIssueDate: string;
	searchError: string | null;
	tabs: readonly MonthlySalaryStatementToolbarTab[];
	mealTotal: number;
	otherTotal: number;
	excelDisabled?: boolean;
	onPayYearMonthChange: (value: string) => void;
	onRecipientFilterChange: (value: string) => void;
	onOpenIssueDateModal: () => void;
	onDocumentKindClick: (id: string) => void;
	onExcelDownload: () => void;
};

export default function MonthlySalaryStatementToolbar({
	activeTab,
	tabTitle,
	payYearMonth,
	recipientFilter,
	checkedCount,
	facilityIssueDate,
	searchError,
	tabs,
	mealTotal,
	otherTotal,
	excelDisabled = false,
	onPayYearMonthChange,
	onRecipientFilterChange,
	onOpenIssueDateModal,
	onDocumentKindClick,
	onExcelDownload,
}: MonthlySalaryStatementToolbarProps) {
	return (
		<div className="border-b border-blue-200 bg-blue-50/50 p-4">
			<div className="mb-3 flex flex-wrap items-center gap-4">
				<h2 className="rounded border border-blue-300 bg-blue-100 px-4 py-2 text-center text-base font-semibold text-blue-900">
					{activeTab === "occurrence" ? (
						<span className="block">{tabTitle}</span>
					) : (
						<>
							장기요양급여비용
							<br />
							{!activeTab || activeTab === "ledger"
								? "명세서발부대장"
								: tabTitle}
						</>
					)}
				</h2>
				<MonthlySalaryStatementFilter
					payYearMonth={payYearMonth}
					recipientFilter={recipientFilter}
					checkedCount={checkedCount}
					facilityIssueDate={facilityIssueDate}
					onPayYearMonthChange={onPayYearMonthChange}
					onRecipientFilterChange={onRecipientFilterChange}
					onOpenIssueDateModal={onOpenIssueDateModal}
				/>
				<div className="ml-auto flex flex-wrap items-center gap-2">
					<div
						className="group relative cursor-help rounded border border-blue-300 bg-white px-3 py-1.5"
						aria-label="식대합계: 비급여식대+비급여간식"
					>
						<div className="text-[11px] font-medium text-blue-900/80">식대합계</div>
						<div className="text-sm font-semibold tabular-nums text-blue-900">
							{Math.round(mealTotal).toLocaleString("ko-KR")}원
						</div>
						<div
							role="tooltip"
							className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max -translate-x-1/2 rounded border border-blue-300 bg-blue-900 px-2 py-1 text-[11px] font-medium text-white shadow group-hover:block"
						>
							비급여식대+비급여간식
						</div>
					</div>
					<div
						className="group relative cursor-help rounded border border-blue-300 bg-white px-3 py-1.5"
						aria-label="기타합계: 비급여 의료비+촉탁의료비+처방비+기타비용"
					>
						<div className="text-[11px] font-medium text-blue-900/80">기타합계</div>
						<div className="text-sm font-semibold tabular-nums text-blue-900">
							{Math.round(otherTotal).toLocaleString("ko-KR")}원
						</div>
						<div
							role="tooltip"
							className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-max -translate-x-1/2 rounded border border-blue-300 bg-blue-900 px-2 py-1 text-[11px] font-medium text-white shadow group-hover:block"
						>
							비급여 의료비+촉탁의료비+처방비+기타비용
						</div>
					</div>
					<button
						type="button"
						onClick={onExcelDownload}
						disabled={excelDisabled}
						className="rounded border border-emerald-500 bg-emerald-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						엑셀 다운로드
					</button>
				</div>
			</div>
			{searchError && (
				<div className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
					{searchError}
				</div>
			)}
			{/* 탭 — 서식 구분(동일 F40100+F10010 데이터 기준, 추후 탭별 출력 분기 가능) */}
			<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
				{tabs.map((tab) => (
					<button
						type="button"
						key={tab.id}
						onClick={() => onDocumentKindClick(tab.id)}
						className={`w-full rounded-lg border-2 px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 ${
							activeTab === tab.id
								? "border-zinc-700 bg-zinc-200 text-zinc-900 shadow-inner"
								: "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>
		</div>
	);
}

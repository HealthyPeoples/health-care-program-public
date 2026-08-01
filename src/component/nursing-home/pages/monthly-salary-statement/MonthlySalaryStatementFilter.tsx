"use client";

/**
 * @file 월 급여명세서 — 화면 컴포넌트 (MonthlySalaryStatementFilter.tsx)
 *
 * @description
 * 요양원 월 급여명세서 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/monthly-salary-statement
 *
 * @module component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatementFilter
 */
import React from "react";

export type MonthlySalaryStatementFilterProps = {
	payYearMonth: string;
	recipientFilter: string;
	checkedCount: number;
	facilityIssueDate: string;
	onPayYearMonthChange: (value: string) => void;
	onRecipientFilterChange: (value: string) => void;
	onOpenIssueDateModal: () => void;
};

/** 조회조건(급여년월·수급자·발행일자) Presentational */
export default function MonthlySalaryStatementFilter({
	payYearMonth,
	recipientFilter,
	checkedCount,
	facilityIssueDate,
	onPayYearMonthChange,
	onRecipientFilterChange,
	onOpenIssueDateModal,
}: MonthlySalaryStatementFilterProps) {
	return (
		<>
			<div className="flex items-center gap-2">
				<label className="text-sm font-medium text-blue-900">급여년월</label>
				<input
					type="month"
					value={payYearMonth}
					onChange={(e) => onPayYearMonthChange(e.target.value)}
					className="rounded border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
				/>
			</div>
			<div className="flex items-center gap-2">
				<label className="text-sm font-medium text-blue-900">수급자</label>
				<input
					type="text"
					value={recipientFilter}
					onChange={(e) => onRecipientFilterChange(e.target.value)}
					placeholder="이름 입력 시 즉시 필터"
					className="min-w-[160px] rounded border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
				/>
				{checkedCount > 0 ? (
					<span className="text-xs text-blue-800">선택 {checkedCount}명</span>
				) : null}
			</div>
			<button
				type="button"
				onClick={onOpenIssueDateModal}
				className="rounded border border-blue-400 bg-blue-200 px-4 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
			>
				발행일자전체변경
			</button>
			{facilityIssueDate ? (
				<span className="text-xs text-blue-800">발행일자: {facilityIssueDate}</span>
			) : null}
			<div className="ml-auto flex gap-2">{/* 검색 버튼 영역 */}</div>
		</>
	);
}

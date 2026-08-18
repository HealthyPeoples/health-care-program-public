"use client";

/**
 * @file 월 급여명세서 — UI 부분 컴포넌트 (MonthlySalaryStatementGrid.tsx)
 *
 * @description
 * 요양원 월 급여명세서 기능의 UI 부분 컴포넌트입니다. 폴더: component/nursing-home/pages/monthly-salary-statement
 *
 * @module component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatementGrid
 */
import React, { useMemo } from "react";

/** Grid 표시용 행 (부모 StatementRow와 구조적 호환) */
export type MonthlySalaryStatementGridRow = {
	pnum: string;
	recipient: string;
	birthday: string;
	grade: string;
	recognitionNo: string;
	benefitTotal: string;
	nhaContribution: string;
	recipientContribution: string;
	nonBenefitMeal: string;
	nonBenefitSnack: string;
	roomUpgradeFee: string;
	outpatientFee: string;
	contractedMedical: string;
	contractedPrescription: string;
	beautyCost: string;
	otherCostsRecipient: string;
	recipientBurdenTotal: string;
};

export type MonthlySalaryStatementGridProps = {
	isOccurrenceView: boolean;
	loading: boolean;
	filteredRows: MonthlySalaryStatementGridRow[];
	statementRowsLength: number;
	filteredPnumsLength: number;
	allFilteredChecked: boolean;
	someFilteredChecked: boolean;
	selectedPnum: string | null;
	checkedPnums: Set<string>;
	onToggleSelectAllFiltered: () => void;
	onRowClick: (row: MonthlySalaryStatementGridRow) => void;
	onCheckClick: (
		e: React.MouseEvent,
		row: MonthlySalaryStatementGridRow
	) => void;
};

const amtHeadCls =
	"border-r border-blue-200 px-1.5 py-2 text-center font-semibold leading-tight text-blue-900";
const amtCellCls =
	"border-r border-blue-100 px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap";

function formatAmt(v: string | number): string {
	const n = Number(v);
	return Number.isFinite(n) ? n.toLocaleString("ko-KR") : "0";
}

function sumField(rows: MonthlySalaryStatementGridRow[], key: keyof MonthlySalaryStatementGridRow): number {
	return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

function mealPlusSnack(row: MonthlySalaryStatementGridRow): number {
	return (Number(row.nonBenefitMeal) || 0) + (Number(row.nonBenefitSnack) || 0);
}

function GridTotalRow({
	identityColSpan,
	amounts,
}: {
	identityColSpan: number;
	amounts: number[];
}) {
	return (
		<tr className="border-b border-orange-300 bg-orange-50">
			<td className="border-r border-orange-200 bg-orange-50" />
			<td
				colSpan={identityColSpan}
				className="border-r border-orange-200 bg-orange-50 px-2 py-1.5 text-center text-sm font-bold text-orange-800"
			>
				합계
			</td>
			{amounts.map((n, i) => (
				<td
					key={i}
					className={`${amtCellCls} border-orange-200 bg-orange-50 font-bold text-orange-800 ${
						i === amounts.length - 1 ? "border-r-0" : ""
					}`}
				>
					{formatAmt(n)}
				</td>
			))}
		</tr>
	);
}

export default function MonthlySalaryStatementGrid({
	isOccurrenceView,
	loading,
	filteredRows,
	statementRowsLength,
	filteredPnumsLength,
	allFilteredChecked,
	someFilteredChecked,
	selectedPnum,
	checkedPnums,
	onToggleSelectAllFiltered,
	onRowClick,
	onCheckClick,
}: MonthlySalaryStatementGridProps) {
	const showTotal = !loading && filteredRows.length > 0;
	const totals = useMemo(
		() => ({
			benefitTotal: sumField(filteredRows, "benefitTotal"),
			nhaContribution: sumField(filteredRows, "nhaContribution"),
			recipientContribution: sumField(filteredRows, "recipientContribution"),
			nonBenefitMeal: sumField(filteredRows, "nonBenefitMeal"),
			nonBenefitSnack: sumField(filteredRows, "nonBenefitSnack"),
			roomUpgradeFee: sumField(filteredRows, "roomUpgradeFee"),
			outpatientFee: sumField(filteredRows, "outpatientFee"),
			contractedMedical: sumField(filteredRows, "contractedMedical"),
			contractedPrescription: sumField(filteredRows, "contractedPrescription"),
			beautyCost: sumField(filteredRows, "beautyCost"),
			otherCostsRecipient: sumField(filteredRows, "otherCostsRecipient"),
			recipientBurdenTotal: sumField(filteredRows, "recipientBurdenTotal"),
		}),
		[filteredRows]
	);
	return (
		<div className="flex-1 overflow-hidden border-b border-blue-200 min-w-0">
			<div className="h-full overflow-x-auto overflow-y-auto w-full min-w-0">
				<table
					className={`w-full table-fixed text-xs ${isOccurrenceView ? "min-w-[1280px]" : "min-w-[1100px]"}`}
				>
					{isOccurrenceView ? (
						<>
							<colgroup>
								<col className="w-10" />
								<col className="w-[8%]" />
								<col className="w-[6%]" />
								<col className="w-[10%]" />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col className="w-[9%]" />
							</colgroup>
							<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-100">
								<tr>
									<th className="w-10 whitespace-nowrap border-r border-blue-200 px-1 py-2 text-center font-semibold text-blue-900">
										<input
											type="checkbox"
											checked={allFilteredChecked}
											ref={(el) => {
												if (el) el.indeterminate = someFilteredChecked;
											}}
											onChange={onToggleSelectAllFiltered}
											disabled={filteredPnumsLength === 0}
											title="전체선택"
											aria-label="전체선택"
											className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
										/>
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										수급자
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										등급
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										인정번호
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										공단부담금
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										수급자부담금
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										비급여식대
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										비급여간식
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										비급여의료비
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										이미용
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										상급침실료
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										촉탁의료비
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										처방비
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										기타비용
									</th>
									<th className="whitespace-nowrap px-2 py-2 text-center font-semibold text-blue-900">
										수급자부담금합계
									</th>
								</tr>
								{showTotal ? (
									<GridTotalRow
										identityColSpan={3}
										amounts={[
											totals.nhaContribution,
											totals.recipientContribution,
											totals.nonBenefitMeal,
											totals.nonBenefitSnack,
											totals.outpatientFee,
											totals.beautyCost,
											totals.roomUpgradeFee,
											totals.contractedMedical,
											totals.contractedPrescription,
											totals.otherCostsRecipient,
											totals.recipientBurdenTotal,
										]}
									/>
								) : null}
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={15} className="px-2 py-8 text-center text-blue-900/60">
											조회 중입니다…
										</td>
									</tr>
								) : filteredRows.length === 0 ? (
									<tr>
										<td colSpan={15} className="px-2 py-8 text-center text-blue-900/60">
											{statementRowsLength === 0
												? "데이터가 없습니다. 해당 급여년월 급여 자료를 확인해 주세요."
												: "수급자명 필터에 맞는 행이 없습니다."}
										</td>
									</tr>
								) : (
									filteredRows.map((row, idx) => (
										<tr
											key={`${row.pnum}-${idx}`}
											onClick={() => onRowClick(row)}
											className={`cursor-pointer border-b border-blue-50 hover:bg-blue-50/50 ${
												selectedPnum != null && selectedPnum === row.pnum
													? "bg-blue-100"
													: checkedPnums.has(row.pnum)
														? "bg-blue-50"
														: ""
											}`}
										>
											<td
												className="border-r border-blue-100 px-1 py-1.5 text-center"
												onClick={(e) => onCheckClick(e, row)}
											>
												<input
													type="checkbox"
													checked={checkedPnums.has(row.pnum)}
													readOnly
													aria-label={`${row.recipient} 선택`}
													className="pointer-events-none h-3.5 w-3.5 accent-blue-600"
												/>
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-left">
												{row.recipient}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-center">
												{row.grade}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-center text-[11px]">
												{row.recognitionNo || "—"}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.nhaContribution).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.recipientContribution).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.nonBenefitMeal).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.nonBenefitSnack).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.outpatientFee).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.beautyCost).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.roomUpgradeFee).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.contractedMedical).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.contractedPrescription).toLocaleString("ko-KR")}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-right tabular-nums">
												{Number(row.otherCostsRecipient).toLocaleString("ko-KR")}
											</td>
											<td className="px-2 py-1.5 text-right font-medium tabular-nums text-blue-900">
												{Number(row.recipientBurdenTotal).toLocaleString("ko-KR")}
											</td>
										</tr>
									))
								)}
							</tbody>
						</>
					) : (
						<>
							<colgroup>
								<col className="w-10" />
								<col className="w-[8%]" />
								<col className="w-[8%]" />
								<col className="w-[6%]" />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col />
								<col className="w-[9%]" />
							</colgroup>
							<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-100">
								<tr>
									<th className="w-10 whitespace-nowrap border-r border-blue-200 px-1 py-2 text-center font-semibold text-blue-900">
										<input
											type="checkbox"
											checked={allFilteredChecked}
											ref={(el) => {
												if (el) el.indeterminate = someFilteredChecked;
											}}
											onChange={onToggleSelectAllFiltered}
											disabled={filteredPnumsLength === 0}
											title="전체선택"
											aria-label="전체선택"
											className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
										/>
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										수급자
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										생일
									</th>
									<th className="whitespace-nowrap border-r border-blue-200 px-2 py-2 text-center font-semibold text-blue-900">
										등급
									</th>
									<th className={amtHeadCls}>급여합계</th>
									<th className={amtHeadCls}>공단부담금</th>
									<th className={amtHeadCls}>수급자부담금</th>
									<th className={amtHeadCls}>비급여식대</th>
									<th className={amtHeadCls}>병실승급비</th>
									<th className={amtHeadCls}>외래진료비</th>
									<th className={amtHeadCls}>촉탁의료</th>
									<th className={amtHeadCls}>촉탁처방</th>
									<th className={amtHeadCls}>이미용비</th>
									<th className={amtHeadCls}>기타비용 수급</th>
									<th className={`${amtHeadCls} border-r-0`}>수급자부담금합계</th>
								</tr>
								{showTotal ? (
									<GridTotalRow
										identityColSpan={3}
										amounts={[
											totals.benefitTotal,
											totals.nhaContribution,
											totals.recipientContribution,
											totals.nonBenefitMeal + totals.nonBenefitSnack,
											totals.roomUpgradeFee,
											totals.outpatientFee,
											totals.contractedMedical,
											totals.contractedPrescription,
											totals.beautyCost,
											totals.otherCostsRecipient,
											totals.recipientBurdenTotal,
										]}
									/>
								) : null}
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={15} className="px-2 py-8 text-center text-blue-900/60">
											조회 중입니다…
										</td>
									</tr>
								) : filteredRows.length === 0 ? (
									<tr>
										<td colSpan={15} className="px-2 py-8 text-center text-blue-900/60">
											{statementRowsLength === 0
												? "데이터가 없습니다. 해당 급여년월 급여 자료를 확인해 주세요. (F40100 급여 HEAD)"
												: "수급자명 필터에 맞는 행이 없습니다."}
										</td>
									</tr>
								) : (
									filteredRows.map((row, idx) => (
										<tr
											key={`${row.pnum}-${idx}`}
											onClick={() => onRowClick(row)}
											className={`cursor-pointer border-b border-blue-50 hover:bg-blue-50/50 ${
												selectedPnum != null && selectedPnum === row.pnum
													? "bg-blue-100"
													: checkedPnums.has(row.pnum)
														? "bg-blue-50"
														: ""
											}`}
										>
											<td
												className="border-r border-blue-100 px-1 py-1.5 text-center"
												onClick={(e) => onCheckClick(e, row)}
											>
												<input
													type="checkbox"
													checked={checkedPnums.has(row.pnum)}
													readOnly
													aria-label={`${row.recipient} 선택`}
													className="pointer-events-none h-3.5 w-3.5 accent-blue-600"
												/>
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-left whitespace-nowrap">
												{row.recipient}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-center whitespace-nowrap">
												{row.birthday}
											</td>
											<td className="border-r border-blue-100 px-2 py-1.5 text-center whitespace-nowrap">
												{row.grade}
											</td>
											<td className={amtCellCls}>{formatAmt(row.benefitTotal)}</td>
											<td className={amtCellCls}>{formatAmt(row.nhaContribution)}</td>
											<td className={amtCellCls}>{formatAmt(row.recipientContribution)}</td>
											<td className={amtCellCls}>{formatAmt(mealPlusSnack(row))}</td>
											<td className={amtCellCls}>{formatAmt(row.roomUpgradeFee)}</td>
											<td className={amtCellCls}>{formatAmt(row.outpatientFee)}</td>
											<td className={amtCellCls}>{formatAmt(row.contractedMedical)}</td>
											<td className={amtCellCls}>{formatAmt(row.contractedPrescription)}</td>
											<td className={amtCellCls}>{formatAmt(row.beautyCost)}</td>
											<td className={amtCellCls}>{formatAmt(row.otherCostsRecipient)}</td>
											<td className={`${amtCellCls} border-r-0 font-medium text-blue-900`}>
												{formatAmt(row.recipientBurdenTotal)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</>
					)}
				</table>
			</div>
		</div>
	);
}

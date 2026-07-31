"use client";

import React from "react";
import MonthlySalaryStatementGrid from "./MonthlySalaryStatementGrid";
import MonthlySalaryStatementToolbar from "./MonthlySalaryStatementToolbar";
import MonthlySalaryStatementForm from "./MonthlySalaryStatementForm";
import {
	useMonthlySalaryStatement,
	type StatementRow,
} from "./useMonthlySalaryStatement";

export default function MonthlySalaryStatement() {
	const {
		TABS,
		activeTab,
		tabTitle,
		payYearMonth,
		recipientFilter,
		checkedPnums,
		facilityIssueDate,
		searchError,
		isOccurrenceView,
		loading,
		filteredRows,
		statementRows,
		filteredPnums,
		allFilteredChecked,
		someFilteredChecked,
		selectedPnum,
		formData,
		formEditMode,
		issueDateModalOpen,
		issueDateDraft,
		setIssueDateDraft,
		setIssueDateModalOpen,
		setFormData,
		handlePayYearMonthChange,
		handleRecipientFilterChange,
		openIssueDateModal,
		handleDocumentKindClickSafe,
		toggleSelectAllFiltered,
		handleRowClick,
		handleCheckClick,
		handleSave,
		discardEditAndLeave,
		handleEnterEdit,
		handleDelete,
		handleSaveFacilityIssueDate,
	} = useMonthlySalaryStatement();

	return (
		<div className="flex min-h-screen flex-col bg-white text-black">
			<div className="flex h-[calc(100vh-56px)] min-h-0 flex-1 flex-col overflow-hidden bg-white">
				{/* 상단: 제목 + 조회조건 + 탭 + 버튼 */}
				<MonthlySalaryStatementToolbar
					activeTab={activeTab}
					tabTitle={tabTitle}
					payYearMonth={payYearMonth}
					recipientFilter={recipientFilter}
					checkedCount={checkedPnums.size}
					facilityIssueDate={facilityIssueDate}
					searchError={searchError}
					tabs={TABS}
					onPayYearMonthChange={handlePayYearMonthChange}
					onRecipientFilterChange={handleRecipientFilterChange}
					onOpenIssueDateModal={openIssueDateModal}
					onDocumentKindClick={(id) =>
						handleDocumentKindClickSafe(id as (typeof TABS)[number]["id"])
					}
				/>

				{/* 중앙: 데이터 테이블 */}
				<MonthlySalaryStatementGrid
					isOccurrenceView={isOccurrenceView}
					loading={loading}
					filteredRows={filteredRows}
					statementRowsLength={statementRows.length}
					filteredPnumsLength={filteredPnums.length}
					allFilteredChecked={allFilteredChecked}
					someFilteredChecked={someFilteredChecked}
					selectedPnum={selectedPnum}
					checkedPnums={checkedPnums}
					onToggleSelectAllFiltered={toggleSelectAllFiltered}
					onRowClick={(row) => handleRowClick(row as StatementRow)}
					onCheckClick={(e, row) => handleCheckClick(e, row as StatementRow)}
				/>

				{/* 하단: 데이터 입력 및 액션 폼 */}
				<MonthlySalaryStatementForm
					selectedPnum={selectedPnum}
					formData={formData}
					formEditMode={formEditMode}
					onDeliveryMethodChange={(value) =>
						setFormData((prev) => ({ ...prev, deliveryMethod: value }))
					}
					onRecipientNameChange={(value) =>
						setFormData((prev) => ({ ...prev, recipientName: value }))
					}
					onReceiveContentChange={(value) =>
						setFormData((prev) => ({ ...prev, receiveContent: value }))
					}
					onSave={() => void handleSave()}
					onCancelEdit={discardEditAndLeave}
					onEnterEdit={handleEnterEdit}
					onDelete={() => void handleDelete()}
				/>

				{issueDateModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
						<div className="w-full max-w-md rounded-lg border border-blue-300 bg-white p-5 shadow-lg">
							<h3 className="mb-3 text-base font-semibold text-blue-900">발행일자 전체 변경</h3>
							<p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
								저장한 날짜로 해당 기관 발행일자의 전체 값이 일괄저장됩니다.
							</p>
							<div className="mb-4 flex items-center gap-2">
								<label className="w-20 shrink-0 text-sm font-medium text-blue-900">발행일자</label>
								<input
									type="date"
									value={issueDateDraft}
									onChange={(e) => setIssueDateDraft(e.target.value)}
									className="flex-1 rounded border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								/>
							</div>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									onClick={() => setIssueDateModalOpen(false)}
									className="rounded border border-blue-300 bg-white px-4 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-50"
								>
									취소
								</button>
								<button
									type="button"
									onClick={handleSaveFacilityIssueDate}
									className="rounded border border-blue-500 bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
								>
									저장
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}


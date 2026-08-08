"use client";

/**
 * @file 월 급여명세서 — UI 부분 컴포넌트 (MonthlySalaryStatementForm.tsx)
 *
 * @description
 * 요양원 월 급여명세서 기능의 UI 부분 컴포넌트입니다. 폴더: component/nursing-home/pages/monthly-salary-statement
 *
 * @module component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatementForm
 */
import React from "react";

export type MonthlySalaryStatementFormData = {
	recipient: string;
	deliveryMethod: string;
	recipientName: string;
	receiveContent: string;
	birthday: string;
	deliverer: string;
};

export type MonthlySalaryStatementFormProps = {
	selectedPnum: string | null;
	formData: MonthlySalaryStatementFormData;
	formEditMode: boolean;
	onDeliveryMethodChange: (value: string) => void;
	onRecipientNameChange: (value: string) => void;
	onReceiveContentChange: (value: string) => void;
	onSave: () => void;
	onCancelEdit: () => void;
	onEnterEdit: () => void;
	onDelete: () => void;
};

const readOnlyInputClass =
	"flex-1 rounded border border-blue-200 bg-blue-50/80 px-2 py-1.5 text-sm text-blue-900/90 outline-none cursor-default";
const editableInputClass =
	"flex-1 rounded border border-blue-400 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";
const readOnlySelectClass =
	"flex-1 rounded border border-blue-200 bg-blue-50/80 px-2 py-1.5 text-sm text-blue-900/90 outline-none cursor-default";
const editableSelectClass =
	"flex-1 rounded border border-blue-400 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";
const readOnlyTextareaClass =
	"flex-1 rounded border border-blue-200 bg-blue-50/80 px-2 py-1.5 text-sm text-blue-900/90 outline-none cursor-default resize-none";
const editableTextareaClass =
	"flex-1 rounded border border-blue-400 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";

/** 하단 수급자 전달정보 입력·액션 Presentational */
export default function MonthlySalaryStatementForm({
	selectedPnum,
	formData,
	formEditMode,
	onDeliveryMethodChange,
	onRecipientNameChange,
	onReceiveContentChange,
	onSave,
	onCancelEdit,
	onEnterEdit,
	onDelete,
}: MonthlySalaryStatementFormProps) {
	return (
		<div className="relative flex flex-wrap gap-6 border-t border-blue-200 bg-blue-50/30 p-4">
			{!selectedPnum && (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
					<p className="rounded-lg border border-blue-300 bg-white/90 px-5 py-3 text-base font-semibold text-blue-900 shadow-sm">
						수급자를 선택해주세요
					</p>
				</div>
			)}
			<div
				className={`flex w-full min-w-0 flex-col gap-3 ${
					!selectedPnum ? "pointer-events-none select-none blur-[2px]" : ""
				}`}
				aria-hidden={!selectedPnum}
			>
				<div className="flex flex-wrap gap-x-8 gap-y-3">
					<div className="flex min-w-0 sm:min-w-[220px] flex-1 items-center gap-2">
						<label className="w-20 shrink-0 text-sm font-medium text-blue-900">수급자</label>
						<input
							type="text"
							value={formData.recipient}
							readOnly
							className={readOnlyInputClass}
						/>
					</div>
					<div className="flex min-w-0 sm:min-w-[220px] flex-1 items-center gap-2">
						<label className="w-20 shrink-0 text-sm font-medium text-blue-900">생년월일</label>
						<input
							type="text"
							value={formData.birthday}
							readOnly
							placeholder="YYYY-MM-DD"
							className={readOnlyInputClass}
						/>
					</div>
					<div className="flex min-w-0 sm:min-w-[220px] flex-1 items-center gap-2">
						<label className="w-20 shrink-0 text-sm font-medium text-blue-900">전달자</label>
						<input
							type="text"
							value={formData.deliverer}
							readOnly
							className={readOnlyInputClass}
						/>
					</div>
					<div className="flex min-w-0 sm:min-w-[220px] flex-1 items-center gap-2">
						<label className="w-20 shrink-0 text-sm font-medium text-blue-900">전달방법</label>
						<select
							value={formData.deliveryMethod}
							disabled={!formEditMode}
							onChange={(e) => onDeliveryMethodChange(e.target.value)}
							className={formEditMode ? editableSelectClass : readOnlySelectClass}
						>
							<option value="1">직접전달</option>
							<option value="2">우편발송</option>
							<option value="3">E-Mail</option>
							<option value="4">SMS</option>
						</select>
					</div>
					<div className="flex min-w-0 sm:min-w-[220px] flex-1 items-center gap-2">
						<label className="w-20 shrink-0 text-sm font-medium text-blue-900">수령자</label>
						<input
							type="text"
							value={formData.recipientName}
							readOnly={!formEditMode}
							onChange={(e) => onRecipientNameChange(e.target.value)}
							className={formEditMode ? editableInputClass : readOnlyInputClass}
						/>
					</div>
					<div className="flex min-w-0 sm:min-w-[280px] flex-[1.4] items-start gap-2">
						<label className="w-20 shrink-0 pt-1.5 text-sm font-medium text-blue-900">수령내용</label>
						<textarea
							value={formData.receiveContent}
							readOnly={!formEditMode}
							onChange={(e) => onReceiveContentChange(e.target.value)}
							rows={2}
							className={formEditMode ? editableTextareaClass : readOnlyTextareaClass}
						/>
					</div>
				</div>
				<div className="mt-1 flex justify-end gap-2 border-t border-blue-100 pt-3">
					{formEditMode ? (
						<>
							<button
								type="button"
								onClick={onSave}
								className="rounded border border-blue-500 bg-blue-500 px-6 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
							>
								저장
							</button>
							<button
								type="button"
								onClick={onCancelEdit}
								className="rounded border border-blue-400 bg-blue-200 px-6 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								취소
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								onClick={onEnterEdit}
								className="rounded border border-blue-500 bg-blue-500 px-6 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
							>
								수정
							</button>
							<button
								type="button"
								onClick={onDelete}
								className="rounded border border-blue-400 bg-blue-200 px-6 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								삭제
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

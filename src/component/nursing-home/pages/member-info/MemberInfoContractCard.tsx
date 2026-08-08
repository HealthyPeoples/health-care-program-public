"use client";

/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoContractCard.tsx)
 *
 * @description
 * 요양원 수급자정보 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/member-info
 *
 * @module component/nursing-home/pages/member-info/MemberInfoContractCard
 */
import React from 'react';
import type { MemberData } from './MemberInfoUtils';

export type MemberInfoContractCardProps = {
	placeholder?: boolean;
	isEditing?: boolean;
	selectedMember?: MemberData | null;
	editedMember?: MemberData | null;
	onFieldChange?: (field: string, value: any) => void;
};

/** 계약정보 카드(보험자부담율·수급자부담율) Presentational */
export default function MemberInfoContractCard({
	placeholder = false,
	isEditing = false,
	selectedMember = null,
	editedMember = null,
	onFieldChange,
}: MemberInfoContractCardProps) {
	if (placeholder) {
		return (
			<div className="bg-white border border-blue-300 rounded-lg shadow-sm min-h-[180px]">
				<div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
					<h3 className="text-lg font-semibold text-blue-900">계약정보</h3>
				</div>
				<div className="p-4 space-y-3 opacity-50">
					<div className="h-6 border-b border-blue-200" />
					<div className="h-6 border-b border-blue-200" />
					<div className="h-6 border-b border-blue-200" />
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white border border-blue-300 rounded-lg shadow-sm">
			<div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-blue-100 border-b border-blue-200">
				<h3 className="text-lg font-semibold text-blue-900">계약정보</h3>
				{/* <button className="px-3 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300">계약상세</button> */}
			</div>
			<div className="p-4 space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">보험자부담율</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.INSPER !== undefined && editedMember.INSPER !== null ? String(editedMember.INSPER) : ''}
							onChange={(e) => onFieldChange?.('INSPER', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
							placeholder="숫자만 입력"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{selectedMember?.INSPER || '-'}%
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">수급자부담율</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.USRPER !== undefined && editedMember.USRPER !== null ? String(editedMember.USRPER) : ''}
							onChange={(e) => onFieldChange?.('USRPER', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
							placeholder="숫자만 입력"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{selectedMember?.USRPER || '-'}%
						</span>
					)}
				</div>
				{/* <div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">비급여 식대 1회</span>
					<span className="flex-1 border-b border-blue-200">
						{selectedMember.EAMT || '-'}
					</span>
				</div> */}
				{/* <div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">비급여 간식비 1회</span>
					<span className="flex-1 border-b border-blue-200">
						{selectedMember.ETAMT || '-'}
					</span>
				</div> */}
				{/* <div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">상급 병실료</span>
					<span className="flex-1 border-b border-blue-200">
						{selectedMember.ESAMT || '-'}
					</span>
				</div> */}
			</div>
		</div>
	);
}

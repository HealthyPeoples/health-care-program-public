"use client";

/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoGuardianCard.tsx)
 *
 * @description
 * 요양원 수급자정보 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/member-info
 *
 * @module component/nursing-home/pages/member-info/MemberInfoGuardianCard
 */
import React from 'react';
import { formatGuardianRelation, type MemberData } from './MemberInfoUtils';

export type MemberInfoGuardianCardProps = {
	placeholder?: boolean;
	isEditing?: boolean;
	selectedMember?: MemberData | null;
	editedMember?: MemberData | null;
	onFieldChange?: (field: string, value: any) => void;
};

/** 보호자 정보 카드(성명·관계·연락처·주소·기타) Presentational */
export default function MemberInfoGuardianCard({
	placeholder = false,
	isEditing = false,
	selectedMember = null,
	editedMember = null,
	onFieldChange,
}: MemberInfoGuardianCardProps) {
	if (placeholder) {
		return (
			<div className="bg-white border border-blue-300 rounded-lg shadow-sm min-h-[180px]">
				<div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
					<h3 className="text-lg font-semibold text-blue-900">보호자 정보</h3>
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
				<h3 className="text-lg font-semibold text-blue-900">보호자 정보</h3>
				{/* <button className="px-3 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300">보호자 관리</button> */}
			</div>
			<div className="p-4 space-y-2 text-sm">
				<div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">성명</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.BHNM || ''}
							onChange={(e) => onFieldChange?.('BHNM', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{selectedMember?.BHNM || '-'}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">관계</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.BHREL || editedMember.BHETC || ''}
							onChange={(e) => onFieldChange?.('BHREL', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{formatGuardianRelation(selectedMember)}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">연락처</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.GUARDIAN_P_HP || ''}
							onChange={(e) => onFieldChange?.('GUARDIAN_P_HP', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{selectedMember?.GUARDIAN_P_HP || '-'}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="w-24 text-blue-900/80">주소</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.GUARDIAN_P_ADDR || ''}
							onChange={(e) => onFieldChange?.('GUARDIAN_P_ADDR', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{selectedMember?.GUARDIAN_P_ADDR || '-'}
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{/* <span className="w-24 text-blue-900/80">이메일</span> */}
					<span className="w-24 text-blue-900/80">기타</span>
					{isEditing && editedMember ? (
						<input
							type="text"
							value={editedMember.P_EMAIL || ''}
							onChange={(e) => onFieldChange?.('P_EMAIL', e.target.value)}
							className="flex-1 px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
					) : (
						<span className="flex-1 border-b border-blue-200">
							{selectedMember?.P_EMAIL || '-'}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

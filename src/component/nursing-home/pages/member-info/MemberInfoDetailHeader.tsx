"use client";

import React from 'react';

export type MemberInfoDetailHeaderProps = {
	mode: 'create' | 'detail';
	loading: boolean;
	isEditing?: boolean;
	canPrintCard?: boolean;
	onSave: () => void;
	onCancel: () => void;
	onEditClick?: () => void;
	onDelete?: () => void;
	onPrintRecipientCard?: () => void;
};

/** 개인정보/수급자 생성 카드 헤더(제목 + 액션 버튼) Presentational */
export default function MemberInfoDetailHeader({
	mode,
	loading,
	isEditing = false,
	canPrintCard = true,
	onSave,
	onCancel,
	onEditClick,
	onDelete,
	onPrintRecipientCard,
}: MemberInfoDetailHeaderProps) {
	if (mode === 'create') {
		return (
			<div className="flex items-center justify-between px-4 py-3 bg-blue-100 border-b border-blue-200">
				<h2 className="text-xl font-semibold text-blue-900">수급자 생성</h2>
				<div className="flex items-center gap-2">
					<button 
						onClick={onSave}
						disabled={loading}
						className="px-3 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
					>
						{loading ? '저장 중...' : '저장'}
					</button>
					<button 
						onClick={onCancel}
						className="px-3 py-1 text-sm text-blue-900 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300"
					>
						취소
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-between px-4 py-3 bg-blue-100 border-b border-blue-200">
			<h2 className="text-xl font-semibold text-blue-900">개인정보</h2>
			<div className="flex items-center gap-2">
				<button
					onClick={onPrintRecipientCard}
					disabled={!canPrintCard}
					className="px-3 py-1 text-sm text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50"
				>
					수급자카드출력
				</button>
				{isEditing ? (
					<>
						<button 
							onClick={onSave}
							disabled={loading}
							className="px-3 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
						>
							{loading ? '저장 중...' : '저장'}
						</button>
						<button 
							onClick={onCancel}
							className="px-3 py-1 text-sm text-blue-900 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300"
						>
							취소
						</button>
						<button 
							onClick={onDelete}
							disabled={loading}
							className="px-3 py-1 text-sm text-white bg-red-500 border border-red-600 rounded hover:bg-red-600 disabled:opacity-50"
						>
							삭제
						</button>
					</>
				) : (
					<button 
						onClick={onEditClick}
						className="px-3 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300"
					>
						수정 및 삭제
					</button>
				)}
			</div>
		</div>
	);
}

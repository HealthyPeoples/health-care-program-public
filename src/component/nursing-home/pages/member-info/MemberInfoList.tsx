"use client";

import React from 'react';
import MemberInfoFilter from './MemberInfoFilter';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { normalizeRoomNo } from '../../utils/roomNoFloor';
import type { MemberData } from './MemberInfoUtils';

export type MemberInfoListProps = {
	currentMembers: MemberData[];
	filteredCount: number;
	selectedMember: MemberData | null;
	loading: boolean;
	error: string | null;
	currentPage: number;
	totalPages: number;
	selectedStatus: string;
	selectedGrade: string;
	selectedFloor: string;
	searchTerm: string;
	availableFloors: number[];
	noRoomValue: string;
	onStatusChange: (value: string) => void;
	onGradeChange: (value: string) => void;
	onFloorChange: (value: string) => void;
	onSearchTermChange: (value: string) => void;
	onSearch: () => void;
	onMemberSelect: (member: MemberData) => void;
	onPageChange: (page: number) => void;
	onCreateClick: () => void;
	onPrintAllMembers: () => void;
};

/** 좌측 수급자 목록(제목·전체출력·필터·표·페이지네이션·생성) Presentational */
export default function MemberInfoList({
	currentMembers,
	filteredCount,
	selectedMember,
	loading,
	error,
	currentPage,
	totalPages,
	selectedStatus,
	selectedGrade,
	selectedFloor,
	searchTerm,
	availableFloors,
	noRoomValue,
	onStatusChange,
	onGradeChange,
	onFloorChange,
	onSearchTermChange,
	onSearch,
	onMemberSelect,
	onPageChange,
	onCreateClick,
	onPrintAllMembers,
}: MemberInfoListProps) {
	return (
		<aside className="w-1/3 shrink-0">
			<div className="overflow-hidden bg-white border border-blue-300 rounded-lg shadow-sm">
				<div className="flex items-center justify-between gap-2 px-3 py-2 font-semibold text-blue-900 bg-blue-100 border-b border-blue-300">
					<span>수급자 목록</span>
					<button
						type="button"
						onClick={onPrintAllMembers}
						className="shrink-0 rounded border border-blue-400 bg-white px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-50"
					>
						수급자 전체 출력
					</button>
				</div>
				{/* 상단 상태/검색 영역 */}
				<MemberInfoFilter
					selectedStatus={selectedStatus}
					selectedGrade={selectedGrade}
					selectedFloor={selectedFloor}
					searchTerm={searchTerm}
					availableFloors={availableFloors}
					loading={loading}
					noRoomValue={noRoomValue}
					onStatusChange={onStatusChange}
					onGradeChange={onGradeChange}
					onFloorChange={onFloorChange}
					onSearchTermChange={onSearchTermChange}
					onSearch={onSearch}
				/>
				{/* 목록 테이블 */}
				<div className="max-h-[540px] overflow-auto">
					<table className="w-full text-sm">
						<thead className="sticky top-0 border-b border-blue-200 bg-blue-50">
							<tr>
								<th className="px-2 py-2 font-semibold text-left text-blue-900">이름</th>
								<th className="px-2 py-2 font-semibold text-left text-blue-900">등급</th>
								<th className="px-2 py-2 font-semibold text-left text-blue-900">상태</th>
								<th className="px-2 py-2 font-semibold text-left text-blue-900">방번호</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={4} className="px-2 py-4 text-center text-blue-900/60">
										로딩 중...
									</td>
								</tr>
							) : error ? (
								<tr>
									<td colSpan={4} className="px-2 py-4 text-center text-red-600">
										{error}
									</td>
								</tr>
							) : filteredCount === 0 ? (
								<tr>
									<td colSpan={4} className="px-2 py-4 text-center text-blue-900/60">
										수급자 데이터가 없습니다
									</td>
								</tr>
							) : (
								currentMembers.map((member, idx) => (
									<tr 
										key={`${member.ANCD}-${member.PNUM}-${idx}`} 
										className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
											selectedMember?.ANCD === member.ANCD && selectedMember?.PNUM === member.PNUM ? 'bg-blue-100' : ''
										}`}
										onClick={() => onMemberSelect(member)}
									>
										<td className="px-2 py-2">{member.P_NM || member.ANCD || '이름 없음'}</td>
										<td className="px-2 py-2">
											{formatCareGradeLabel(member.P_GRD, '등급 없음')}
										</td>
										<td className="px-2 py-2">
											{member.P_ST === '1' 
												? '입소' 
												: member.P_ST === '9' 
													? '퇴소' 
													: '-'}
										</td>
										<td className="px-2 py-2">
											{normalizeRoomNo(member?.ROOM_NO) !== '' ? String(member.ROOM_NO) : '없음'}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				
				{/* 페이지네이션 */}
				{totalPages > 1 && (
					<div className="p-3 border-t border-blue-100">
						<div className="flex items-center justify-center">
							{/* <div className="text-sm text-blue-900/80">
								총 {filteredMembers.length}개 중 {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)}개 표시
							</div> */}
							<div className="flex gap-1">
								<button
									onClick={() => onPageChange(1)}
									disabled={currentPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&lt;&lt;
								</button>
								<button
									onClick={() => onPageChange(currentPage - 1)}
									disabled={currentPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&lt;
								</button>
								
								{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
									const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
									return (
										<button
											key={pageNum}
											onClick={() => onPageChange(pageNum)}
											className={`px-2 py-1 text-xs border rounded ${
												currentPage === pageNum
													? 'bg-blue-500 text-white border-blue-500'
													: 'border-blue-300 hover:bg-blue-50'
											}`}
										>
											{pageNum}
										</button>
									);
								})}
								
								<button
									onClick={() => onPageChange(currentPage + 1)}
									disabled={currentPage === totalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&gt;
								</button>
								<button
									onClick={() => onPageChange(totalPages)}
									disabled={currentPage === totalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&gt;&gt;
								</button>
							</div>
						</div>
					</div>
				)}
				{/* 수급자 생성 버튼 - 표 하단 중앙 */}
				<div className="p-3 border-t border-blue-100">
					<div className="flex items-center justify-center">
						<button
							onClick={onCreateClick}
							className="px-6 py-2 text-sm font-semibold text-white bg-blue-500 border border-blue-600 rounded-lg shadow hover:bg-blue-600 transition-colors"
						>
							수급자 생성
						</button>
					</div>
				</div>
			</div>
		</aside>
	);
}

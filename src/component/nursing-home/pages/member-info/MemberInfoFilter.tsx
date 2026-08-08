"use client";

/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoFilter.tsx)
 *
 * @description
 * 요양원 수급자정보 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/member-info
 *
 * @module component/nursing-home/pages/member-info/MemberInfoFilter
 */
import React from 'react';

export type MemberInfoFilterProps = {
	selectedStatus: string;
	selectedGrade: string;
	selectedFloor: string;
	searchTerm: string;
	availableFloors: number[];
	loading: boolean;
	noRoomValue: string;
	onStatusChange: (value: string) => void;
	onGradeChange: (value: string) => void;
	onFloorChange: (value: string) => void;
	onSearchTermChange: (value: string) => void;
	onSearch: () => void;
};

/** 수급자 목록 조회조건(현황·등급·층수·이름) Presentational */
export default function MemberInfoFilter({
	selectedStatus,
	selectedGrade,
	selectedFloor,
	searchTerm,
	availableFloors,
	loading,
	noRoomValue,
	onStatusChange,
	onGradeChange,
	onFloorChange,
	onSearchTermChange,
	onSearch,
}: MemberInfoFilterProps) {
	return (
		<div className="px-3 py-2 border-b border-blue-100">
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
				{/* 현황 필터 */}
				<div className="space-y-1 min-w-0">
					<div className="text-xs text-blue-900/80">현황</div>
					<select
						value={selectedStatus}
						onChange={(e) => onStatusChange(e.target.value)}
						className="w-full min-w-0 px-2 py-1 text-sm bg-white border border-blue-300 rounded text-blue-900"
					>
						<option value="">현황 전체</option>
						<option value="입소">입소</option>
						<option value="퇴소">퇴소</option>
					</select>
				</div>
				{/* 등급 필터 */}
				<div className="space-y-1 min-w-0">
					<div className="text-xs text-blue-900/80">등급</div>
					<select
						value={selectedGrade}
						onChange={(e) => onGradeChange(e.target.value)}
						className="w-full min-w-0 px-2 py-1 text-sm bg-white border border-blue-300 rounded text-blue-900"
					>
						<option value="">등급 전체</option>
						<option value="1">1등급</option>
						<option value="2">2등급</option>
						<option value="3">3등급</option>
						<option value="4">4등급</option>
						<option value="5">5등급</option>
						<option value="9">인지지원</option>
					</select>
				</div>
				{/* 층수 필터 */}
				<div className="space-y-1 min-w-0">
					<div className="text-xs text-blue-900/80">층수</div>
					<select
						value={selectedFloor}
						onChange={(e) => onFloorChange(e.target.value)}
						className="w-full min-w-0 px-2 py-1 text-sm bg-white border border-blue-300 rounded text-blue-900"
					>
						<option value="">층수 전체</option>
						<option value={noRoomValue}>방번호 없음</option>
						{/* 동적으로 층수 목록 생성 (F14090.ROOM_NO에서 추출) */}
						{availableFloors.map((floor) => (
							<option key={floor} value={String(floor)}>
								{floor}층
							</option>
						))}
					</select>
				</div>
				{/* 이름 검색 */}
				<div className="space-y-1 min-w-0">
					<div className="text-xs text-blue-900/80">이름 검색</div>
					<input 
						className="w-full min-w-0 px-2 py-1 text-sm bg-white border border-blue-300 rounded" 
						placeholder="예) 홍길동"
						value={searchTerm}
						onChange={(e) => onSearchTermChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								onSearch();
							}
						}}
					/>
				</div>
			</div>
			<button 
				className="w-full mt-2 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300"
				onClick={onSearch}
			>
				{loading ? '검색 중...' : '검색'}
			</button>
		</div>
	);
}

"use client";

/**
 * @file 유치도뇨 — 화면 컴포넌트 (IndwellingCatheter.tsx)
 *
 * @description
 * 요양원 유치도뇨 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/indwelling-catheter
 *
 * @module component/nursing-home/pages/indwelling-catheter/IndwellingCatheter
 */
import React, { useState, useEffect } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { attachLatestRoomNoByPnum } from '../../utils/roomNoFloor';
import { RoomNoFloorSelect } from '../../components/RoomNoFloorSelect';
import { matchesSelectedFloor } from '../../utils/roomNoFloorFilter';
import {
	URINE_BAG_POSITIONS,
	bagPosToLabel,
	catheterFormToPayload,
	createEmptyCatheterForm,
	formatDateYmd,
	formatDateYyMmDd,
	isCheckedFlag,
	resolveManagementTime,
	rowToCatheterForm,
	type CatheterFormData,
	type F33050Row,
} from '../../utils/indwellingCatheterFields';
import { printIndwellingCatheter } from './indwellingCatheterPrint';

interface MemberData {
	ANCD: string;
	PNUM: string;
	P_NM: string;
	P_SEX: string;
	P_GRD: string;
	P_BRDT: string;
	P_ST: string;
	ROOM_NO?: string;
	[key: string]: any;
}

interface CatheterData extends F33050Row {
	MGDT: string;
	MGTM: string;
	CATH: string;
	BAGPOS: string;
	DISINF: string;
	REMARKS: string;
	OBSERVER: string;
}

function memberKey(m: { ANCD?: unknown; PNUM?: unknown }) {
	return `${String(m.ANCD ?? '').trim()}-${String(m.PNUM ?? '').trim()}`;
}

function monthStartYmd() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayYmd() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function IndwellingCatheter() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null);
	const [catheterList, setCatheterList] = useState<CatheterData[]>([]);
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [listPage, setListPage] = useState(1);
	const listItemsPerPage = 10;

	const [formData, setFormData] = useState<CatheterFormData>(createEmptyCatheterForm());
	const [editingBackup, setEditingBackup] = useState<CatheterFormData | null>(null);
	const [defaultObserver, setDefaultObserver] = useState('');
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(new Set());
	const [printFrom, setPrintFrom] = useState(monthStartYmd);
	const [printTo, setPrintTo] = useState(todayYmd);
	const [printing, setPrinting] = useState(false);

	// 수급자 목록 데이터
	const [memberList, setMemberList] = useState<MemberData[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<string>('입소');
	const [selectedGrade, setSelectedGrade] = useState<string>('');
	const [selectedFloor, setSelectedFloor] = useState<string>('');
	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	// 수급자 목록 조회
	const fetchMembers = async (nameSearch?: string) => {
		setLoading(true);
		try {
			const url = nameSearch && nameSearch.trim() !== '' 
				? `/api/f10010?name=${encodeURIComponent(nameSearch.trim())}`
				: '/api/f10010';
			
			const response = await fetch(url);
			const result = await response.json();
			
			if (result.success) {
				const list = Array.isArray(result.data) ? (result.data as MemberData[]) : [];
				const merged = await attachLatestRoomNoByPnum(list as any);
				setMemberList(merged as MemberData[]);
			}
		} catch (err) {
			console.error('수급자 목록 조회 오류:', err);
		} finally {
			setLoading(false);
		}
	};

	// 나이 계산 함수
	const calculateAge = (birthDate: string) => {
		if (!birthDate) return '-';
		try {
			const year = parseInt(birthDate.substring(0, 4));
			const currentYear = new Date().getFullYear();
			return (currentYear - year).toString();
		} catch {
			return '-';
		}
	};

	// 필터링된 수급자 목록
	const filteredMembers = memberList.filter((member) => {
		if (selectedStatus) {
			const memberStatus = String(member.P_ST || '').trim();
			if (selectedStatus === '입소' && memberStatus !== '1') {
				return false;
			}
			if (selectedStatus === '퇴소' && memberStatus !== '9') {
				return false;
			}
		}
		
		if (selectedGrade) {
			const memberGrade = String(member.P_GRD || '').trim();
			const selectedGradeTrimmed = String(selectedGrade).trim();
			if (memberGrade !== selectedGradeTrimmed) {
				return false;
			}
		}
		
		if (selectedFloor) {
			if (!matchesSelectedFloor(member, selectedFloor)) return false;
		}
		
		if (searchTerm && searchTerm.trim() !== '') {
			const searchLower = searchTerm.toLowerCase().trim();
			if (!member.P_NM?.toLowerCase().includes(searchLower)) {
				return false;
			}
		}
		
		return true;
	}).sort((a, b) => {
		const nameA = (a.P_NM || '').trim();
		const nameB = (b.P_NM || '').trim();
		return nameA.localeCompare(nameB, 'ko');
	});

	// 페이지네이션 계산
	const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentMembers = filteredMembers.slice(startIndex, endIndex);

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const allFilteredChecked =
		filteredMembers.length > 0 && filteredMembers.every((m) => checkedMemberKeys.has(memberKey(m)));

	const toggleAllFilteredChecked = (checked: boolean) => {
		setCheckedMemberKeys((prev) => {
			const next = new Set(prev);
			for (const m of filteredMembers) {
				const key = memberKey(m);
				if (checked) next.add(key);
				else next.delete(key);
			}
			return next;
		});
	};

	const toggleMemberChecked = (member: MemberData, checked: boolean) => {
		setCheckedMemberKeys((prev) => {
			const next = new Set(prev);
			const key = memberKey(member);
			if (checked) next.add(key);
			else next.delete(key);
			return next;
		});
	};

	useEffect(() => {
		fetchMembers();
		void (async () => {
			try {
				const res = await fetch('/api/auth/user-info', { credentials: 'include', cache: 'no-store' });
				const result = await res.json().catch(() => ({}));
				if (res.ok && result?.success) {
					const name = String(result?.data?.empnm ?? result?.data?.EMPNM ?? '').trim();
					if (name) {
						setDefaultObserver(name);
						setFormData((prev) => (prev.observer ? prev : { ...prev, observer: name }));
					}
				}
			} catch {
				/* ignore */
			}
		})();
	}, []);

	// 검색어 변경 시 실시간 검색 (디바운싱)
	useEffect(() => {
		const timer = setTimeout(() => {
			setCurrentPage(1);
			fetchMembers(searchTerm);
		}, 300);

		return () => clearTimeout(timer);
	}, [searchTerm]);

	// 필터 변경 시 페이지 초기화
	useEffect(() => {
		setCurrentPage(1);
	}, [selectedStatus, selectedGrade, selectedFloor, searchTerm]);

	// 유치도뇨관리 목록 조회
	const fetchCatheterRecords = async (ancd: string, pnum: string) => {
		if (!ancd || !pnum) {
			setCatheterList([]);
			return;
		}

		setLoadingRecords(true);
		try {
			const url = `/api/f33050?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(pnum)}`;
			const response = await fetch(url, { method: 'GET' });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || '유치도뇨관리 목록 조회 실패');
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const mapped: CatheterData[] = list.map((r: F33050Row) => ({
				...r,
				MGDT: r.VDT != null && r.VDT !== '' ? String(r.VDT) : '',
				MGTM: resolveManagementTime(r),
				CATH: String(r.CH_01 ?? '0'),
				BAGPOS: String(r.BAG_POS ?? ''),
				DISINF: String(r.CH_03 ?? '0'),
				REMARKS: String(r.ETC ?? ''),
				OBSERVER: String(r.INEMPNM ?? ''),
			}));
			setCatheterList(mapped);
		} catch (err) {
			console.error('유치도뇨관리 목록 조회 오류:', err);
			setCatheterList([]);
		} finally {
			setLoadingRecords(false);
		}
	};

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const confirmLeaveEdit = () => {
		if (!isEditMode) return true;
		return confirm('수정 중인 내용이 저장되지 않습니다. 이동할까요?');
	};

	const handleSelectMember = (member: MemberData) => {
		if (!confirmLeaveEdit()) return;
		exitEditMode();
		setSelectedMember(member);
		setSelectedRecordIndex(null);
		setFormData(createEmptyCatheterForm(member.P_NM || '', defaultObserver));
		fetchCatheterRecords(member.ANCD, member.PNUM);
	};

	const handleSelectRecord = (index: number, record: CatheterData) => {
		if (!confirmLeaveEdit()) return;
		exitEditMode();
		setSelectedRecordIndex(index);
		setFormData(rowToCatheterForm(record, selectedMember?.P_NM || ''));
	};

	const formatDateDisplay = formatDateYyMmDd;

	const formatTimeDisplay = (timeStr: string) => {
		if (!timeStr) return '';
		if (timeStr.includes(':')) return timeStr.slice(0, 5);
		return timeStr;
	};

	const handlePrint = async () => {
		const from = String(printFrom || '').slice(0, 10);
		const to = String(printTo || '').slice(0, 10);
		if (!from || !to) {
			alert('출력 기간(시작일·종료일)을 설정해주세요.');
			return;
		}
		if (from > to) {
			alert('기간 시작일이 종료일보다 늦을 수 없습니다.');
			return;
		}

		const targets = filteredMembers.filter((m) => checkedMemberKeys.has(memberKey(m)));
		if (targets.length === 0) {
			alert('출력할 수급자를 목록에서 체크해주세요.');
			return;
		}

		setPrinting(true);
		try {
			const items: Array<{ member: MemberData; rows: F33050Row[] }> = [];
			for (const member of targets) {
				const params = new URLSearchParams({
					ancd: String(member.ANCD ?? ''),
					pnum: String(member.PNUM ?? ''),
					startDate: from,
					endDate: to,
				});
				const response = await fetch(`/api/f33050?${params.toString()}`);
				const result = await response.json().catch(() => ({}));
				if (!response.ok || !result?.success) {
					throw new Error(result?.error || `${member.P_NM || '수급자'} 조회 실패`);
				}
				const rows = Array.isArray(result.data) ? (result.data as F33050Row[]) : [];
				if (rows.length > 0) {
					items.push({ member, rows });
				}
			}
			if (items.length === 0) {
				alert('선택한 수급자·기간에 해당하는 기록이 없습니다.');
				return;
			}
			printIndwellingCatheter({ items, startDate: from, endDate: to });
		} catch (err) {
			console.error('유치도뇨관 관리 출력 오류:', err);
			alert(err instanceof Error ? err.message : '출력 중 오류가 발생했습니다.');
		} finally {
			setPrinting(false);
		}
	};

	const handleAdd = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (!confirmLeaveEdit()) return;
		setSelectedRecordIndex(null);
		const next = createEmptyCatheterForm(selectedMember.P_NM || '', defaultObserver);
		setFormData(next);
		setEditingBackup(JSON.parse(JSON.stringify(next)) as CatheterFormData);
		setIsEditMode(true);
	};

	const handleEditOrSave = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (!isEditMode) {
			if (selectedRecordIndex === null) {
				alert('수정할 항목을 목록에서 선택해주세요.');
				return;
			}
			setEditingBackup(JSON.parse(JSON.stringify(formData)) as CatheterFormData);
			setIsEditMode(true);
			return;
		}

		if (!formData.managementDate) {
			alert('관리일자를 입력해주세요.');
			return;
		}

		if (!formData.managementTime) {
			alert('관리시간을 입력해주세요.');
			return;
		}

		setLoadingRecords(true);
		try {
			const payload = catheterFormToPayload(formData, selectedMember.PNUM);
			const res = await fetch(`/api/f33050?ancd=${encodeURIComponent(selectedMember.ANCD)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '유치도뇨관리 저장 실패');
			}

			alert(selectedRecordIndex !== null ? '유치도뇨관리가 수정되었습니다.' : '유치도뇨관리가 저장되었습니다.');
			exitEditMode();

			const keepIndex = selectedRecordIndex;
			await fetchCatheterRecords(selectedMember.ANCD, selectedMember.PNUM);

			if (keepIndex === null) {
				setSelectedRecordIndex(null);
				setFormData(createEmptyCatheterForm(selectedMember.P_NM || '', defaultObserver));
			}
		} catch (err) {
			console.error('유치도뇨관리 저장 오류:', err);
			alert(err instanceof Error ? err.message : '유치도뇨관리 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	const handleCancelEdit = () => {
		if (editingBackup) {
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as CatheterFormData);
		} else if (selectedRecordIndex !== null) {
			const record = catheterList[selectedRecordIndex];
			if (record) setFormData(rowToCatheterForm(record, selectedMember?.P_NM || ''));
		} else if (selectedMember) {
			setFormData(createEmptyCatheterForm(selectedMember.P_NM || '', defaultObserver));
		}
		exitEditMode();
	};

	const handleDelete = async (record: CatheterData, index: number) => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (isEditMode && !confirm('수정 중인 내용이 저장되지 않습니다. 삭제를 진행할까요?')) {
			return;
		}

		if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			return;
		}

		setLoadingRecords(true);
		try {
			const vdt = formatDateYmd(record.MGDT || record.VDT || '');
			const vtmGu = String(record.VTM_GU ?? '');
			const url = `/api/f33050?ancd=${encodeURIComponent(selectedMember.ANCD)}&pnum=${encodeURIComponent(
				selectedMember.PNUM
			)}&vdt=${encodeURIComponent(vdt)}&vtmGu=${encodeURIComponent(vtmGu)}`;
			const res = await fetch(url, { method: 'DELETE' });
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '유치도뇨관리 삭제 실패');
			}

			alert('유치도뇨관리가 삭제되었습니다.');
			exitEditMode();

			if (selectedRecordIndex === index) {
				setSelectedRecordIndex(null);
				setFormData(createEmptyCatheterForm(selectedMember.P_NM || '', defaultObserver));
			} else if (selectedRecordIndex !== null && selectedRecordIndex > index) {
				setSelectedRecordIndex(selectedRecordIndex - 1);
			}

			await fetchCatheterRecords(selectedMember.ANCD, selectedMember.PNUM);
		} catch (err) {
			console.error('유치도뇨관리 삭제 오류:', err);
			alert(err instanceof Error ? err.message : '유치도뇨관리 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	const fieldsLocked = !isEditMode;
	const fieldCls = `flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded focus:outline-none focus:border-blue-500 ${
		fieldsLocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
	}`;

	// 목록 페이지네이션
	const listTotalPages = Math.ceil(catheterList.length / listItemsPerPage);
	const listStartIndex = (listPage - 1) * listItemsPerPage;
	const listEndIndex = listStartIndex + listItemsPerPage;
	const currentRecords = catheterList.slice(listStartIndex, listEndIndex);

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				{/* 좌측 패널: 수급자 목록 */}
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 p-4 bg-white border-r border-blue-200 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden">
					{/* 필터 헤더 */}
					<div className="mb-3">
						<div className="p-2 mb-3 space-y-2 border border-blue-200 rounded-lg bg-blue-50/60">
							<div className="text-xs font-semibold text-blue-900">출력기간</div>
							<div className="flex items-center gap-1">
								<input
									type="date"
									value={printFrom}
									onChange={(e) => setPrintFrom(e.target.value)}
									className="flex-1 min-w-0 px-1 py-1 text-xs bg-white border border-blue-300 rounded"
								/>
								<span className="text-xs text-blue-900 shrink-0">~</span>
								<input
									type="date"
									value={printTo}
									onChange={(e) => setPrintTo(e.target.value)}
									className="flex-1 min-w-0 px-1 py-1 text-xs bg-white border border-blue-300 rounded"
								/>
							</div>
							<button
								type="button"
								onClick={() => void handlePrint()}
								disabled={printing}
								className="w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-50"
							>
								{printing
									? '출력 준비 중...'
									: checkedMemberKeys.size > 0
										? `출력 (${checkedMemberKeys.size}명)`
										: '출력'}
							</button>
						</div>
						<h3 className="mb-2 text-sm font-semibold text-blue-900">수급자 목록</h3>
						<div className="space-y-2">
							{/* 이름 검색 */}
							<div className="space-y-1">
								<div className="text-xs text-blue-900/80">이름 검색</div>
								<input 
									className="w-full px-2 py-1 text-xs bg-white border border-blue-300 rounded" 
									placeholder="예) 홍길동"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>
							{/* 현황 필터 */}
							<div className="space-y-1">
								<div className="text-xs text-blue-900/80">현황</div>
								<select
									value={selectedStatus}
									onChange={(e) => setSelectedStatus(e.target.value)}
									className="w-full px-2 py-1 text-xs text-blue-900 bg-white border border-blue-300 rounded"
								>
									<option value="">현황 전체</option>
									<option value="입소">입소</option>
									<option value="퇴소">퇴소</option>
								</select>
							</div>
							{/* 등급 필터 */}
							<div className="space-y-1">
								<div className="text-xs text-blue-900/80">등급</div>
								<select
									value={selectedGrade}
									onChange={(e) => setSelectedGrade(e.target.value)}
									className="w-full px-2 py-1 text-xs text-blue-900 bg-white border border-blue-300 rounded"
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
							<div className="space-y-1">
								<div className="text-xs text-blue-900/80">층수</div>
								<RoomNoFloorSelect
									members={memberList as any}
									value={selectedFloor}
									onChange={setSelectedFloor}
									className="w-full px-2 py-1 text-xs text-blue-900 bg-white border border-blue-300 rounded"
								/>
							</div>
						</div>
					</div>

					{/* 수급자 목록 테이블 */}
					<div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white border border-blue-300 rounded-lg">
						<div className="min-h-[220px] max-h-[min(540px,55vh)] flex-1 overflow-y-auto">
							<table className="w-full text-xs">
								<thead className="sticky top-0 border-b border-blue-200 bg-blue-50">
									<tr>
										<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200 w-8">
											<input
												type="checkbox"
												checked={allFilteredChecked}
												onChange={(e) => toggleAllFilteredChecked(e.target.checked)}
												className="w-3.5 h-3.5 border-blue-300 rounded"
												title="현재 필터 수급자 전체 선택"
											/>
										</th>
										<th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">연번</th>
										<th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">현황</th>
										<th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">수급자명</th>
										<th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">성별</th>
										<th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">등급</th>
										<th className="px-2 py-1.5 font-semibold text-center text-blue-900">나이</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={7} className="px-2 py-4 text-center text-blue-900/60">로딩 중...</td>
										</tr>
									) : filteredMembers.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-2 py-4 text-center text-blue-900/60">수급자 데이터가 없습니다</td>
										</tr>
									) : (
										currentMembers.map((member, index) => {
											const key = memberKey(member);
											const isChecked = checkedMemberKeys.has(key);
											return (
											<tr
												key={`${member.ANCD}-${member.PNUM}-${index}`}
												onClick={() => handleSelectMember(member)}
												className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
													selectedMember?.ANCD === member.ANCD && selectedMember?.PNUM === member.PNUM ? 'bg-blue-100' : ''
												}`}
											>
												<td
													className="px-1 py-1.5 text-center border-r border-blue-100"
													onClick={(e) => e.stopPropagation()}
												>
													<input
														type="checkbox"
														checked={isChecked}
														onChange={(e) => toggleMemberChecked(member, e.target.checked)}
														className="w-3.5 h-3.5 border-blue-300 rounded"
													/>
												</td>
												<td className="px-2 py-1.5 text-center border-r border-blue-100">{startIndex + index + 1}</td>
												<td className="px-2 py-1.5 text-center border-r border-blue-100">
													{member.P_ST === '1' ? '입소' : member.P_ST === '9' ? '퇴소' : '-'}
												</td>
												<td className="px-2 py-1.5 text-center border-r border-blue-100">{member.P_NM || '-'}</td>
												<td className="px-2 py-1.5 text-center border-r border-blue-100">
													{member.P_SEX === '1' ? '남' : member.P_SEX === '2' ? '여' : '-'}
												</td>
												<td className="px-2 py-1.5 text-center border-r border-blue-100">
													{formatCareGradeLabel(member.P_GRD)}
												</td>
												<td className="px-2 py-1.5 text-center">{calculateAge(member.P_BRDT)}</td>
											</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
						{/* 페이지네이션 */}
						{totalPages > 1 && (
							<div className="p-2 bg-white border-t border-blue-200">
								<div className="flex items-center justify-center gap-1">
									<button
										onClick={() => handlePageChange(1)}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										onClick={() => handlePageChange(currentPage - 1)}
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
												onClick={() => handlePageChange(pageNum)}
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
										onClick={() => handlePageChange(currentPage + 1)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										onClick={() => handlePageChange(totalPages)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;&gt;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="relative flex flex-col xl:flex-row flex-1 min-w-0 min-h-0">
					<div
						className={`flex flex-col xl:flex-row flex-1 min-w-0 min-h-0 ${
							!selectedMember ? 'blur-sm select-none pointer-events-none opacity-70' : ''
						}`}
					>
				{/* 중간 패널: 유치도뇨관리 목록 테이블 */}
				<div className="flex flex-col w-full lg:w-1/3 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b lg:border-b-0 lg:h-full lg:min-h-0 lg:overflow-hidden">
					<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-blue-200 bg-blue-50 shrink-0">
						<span className="text-sm font-medium text-blue-900">유치도뇨관리 목록</span>
						<button
							type="button"
							onClick={handleAdd}
							disabled={!selectedMember || loadingRecords}
							className="px-3 py-1 text-sm font-medium text-blue-900 border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto">
							<table className="w-full text-xs border-collapse table-fixed">
								<colgroup>
									<col className="w-[18%]" />
									<col className="w-[16%]" />
									<col className="w-[14%]" />
									<col className="w-[24%]" />
									<col className="w-[12%]" />
									<col className="w-[16%]" />
								</colgroup>
								<thead className="sticky top-0 z-10 bg-blue-50">
									<tr>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-b border-r border-blue-200 bg-blue-50">관리일자</th>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-b border-r border-blue-200 bg-blue-50">관리시간</th>
										<th className="px-1 py-2 font-semibold text-center text-blue-900 border-b border-r border-blue-200 bg-blue-50 leading-tight">삽입<br />교체</th>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-b border-r border-blue-200 bg-blue-50">소변백 위치</th>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-b border-r border-blue-200 bg-blue-50">소독</th>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-b border-blue-200 bg-blue-50">삭제</th>
									</tr>
								</thead>
								<tbody>
									{loadingRecords ? (
										<tr>
											<td colSpan={6} className="px-2 py-4 text-center text-blue-900/60">로딩 중...</td>
										</tr>
									) : catheterList.length === 0 ? (
										<tr>
											<td colSpan={6} className="px-2 py-4 text-center text-blue-900/60">
												{selectedMember ? '유치도뇨관리 데이터가 없습니다' : '수급자를 선택해주세요'}
											</td>
										</tr>
									) : (
										currentRecords.map((record, localIndex) => {
											const globalIndex = listStartIndex + localIndex;
											return (
												<tr
													key={`${record.VDT}-${record.VTM_GU}-${globalIndex}`}
													onClick={() => handleSelectRecord(globalIndex, record)}
													className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
														selectedRecordIndex === globalIndex ? 'bg-blue-100' : ''
													}`}
												>
													<td className="px-2 py-2 text-center text-blue-900 border-r border-blue-100">{formatDateDisplay(record.MGDT || record.VDT || '')}</td>
													<td className="px-2 py-2 text-center text-blue-900 border-r border-blue-100">{formatTimeDisplay(record.MGTM || '')}</td>
													<td className="px-2 py-2 text-center text-blue-900 border-r border-blue-100">
														{isCheckedFlag(record.CATH) ? '✓' : '-'}
													</td>
													<td className="px-2 py-2 text-center text-blue-900 border-r border-blue-100">
														{bagPosToLabel(record.BAGPOS) || '-'}
													</td>
													<td className="px-2 py-2 text-center text-blue-900 border-r border-blue-100">
														{isCheckedFlag(record.DISINF) ? '✓' : '-'}
													</td>
													<td className="px-1 py-2 text-center text-blue-900">
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																void handleDelete(record, globalIndex);
															}}
															disabled={loadingRecords}
															className="px-2 py-0.5 text-xs font-medium text-red-900 bg-red-100 border border-red-400 rounded hover:bg-red-200 disabled:opacity-50"
														>
															삭제
														</button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
						{/* 목록 페이지네이션 */}
						{listTotalPages > 1 && (
							<div className="p-2 bg-white border-t border-blue-200">
								<div className="flex items-center justify-center gap-1">
									<button
										onClick={() => setListPage(1)}
										disabled={listPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										onClick={() => setListPage(prev => Math.max(1, prev - 1))}
										disabled={listPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;
									</button>
									
									{Array.from({ length: Math.min(5, listTotalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(listTotalPages - 4, listPage - 2)) + i;
										if (pageNum > listTotalPages) return null;
										return (
											<button
												key={pageNum}
												onClick={() => setListPage(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${
													listPage === pageNum
														? 'bg-blue-500 text-white border-blue-500'
														: 'border-blue-300 hover:bg-blue-50'
												}`}
											>
												{pageNum}
											</button>
										);
									}).filter(Boolean)}
									
									<button
										onClick={() => setListPage(prev => Math.min(listTotalPages, prev + 1))}
										disabled={listPage >= listTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										onClick={() => setListPage(listTotalPages)}
										disabled={listPage >= listTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;&gt;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 우측 패널: 입력 폼 */}
				<div className="flex-1 p-4 overflow-y-auto bg-white">
					<div className="space-y-4">
						{/* 수급자 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">수급자</label>
							<input
								type="text"
								value={formData.beneficiary}
								readOnly
								className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50"
							/>
						</div>

						{/* 관리일자 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">관리일자</label>
							<input
								type="date"
								value={formData.managementDate}
								onChange={(e) => setFormData(prev => ({ ...prev, managementDate: e.target.value }))}
								disabled={fieldsLocked}
								className={fieldCls}
							/>
						</div>

						{/* 관리시간 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">관리시간</label>
							<input
								type="time"
								value={formData.managementTime}
								onChange={(e) => setFormData(prev => ({ ...prev, managementTime: e.target.value }))}
								disabled={fieldsLocked}
								className={fieldCls}
							/>
						</div>

						{/* 유치도뇨관 삽입·교체 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">삽입·교체</label>
							<input
								type="checkbox"
								checked={formData.catheter}
								onChange={(e) => setFormData(prev => ({ ...prev, catheter: e.target.checked }))}
								disabled={fieldsLocked}
								className="w-4 h-4 accent-blue-600 disabled-checked-blue border border-blue-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
							/>
						</div>

						{/* 소변백 위치 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">소변백 위치</label>
							<select
								value={formData.bagPosition}
								onChange={(e) => setFormData(prev => ({ ...prev, bagPosition: e.target.value }))}
								disabled={fieldsLocked}
								className={fieldCls}
							>
								<option value="">선택</option>
								{URINE_BAG_POSITIONS.map((opt) => (
									<option key={opt.code} value={opt.code}>{opt.label}</option>
								))}
							</select>
						</div>

						{/* 소독 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">소독</label>
							<input
								type="checkbox"
								checked={formData.disinfection}
								onChange={(e) => setFormData(prev => ({ ...prev, disinfection: e.target.checked }))}
								disabled={fieldsLocked}
								className="w-4 h-4 accent-blue-600 disabled-checked-blue border border-blue-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
							/>
						</div>

						{/* 비고 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">비고</label>
							<input
								type="text"
								value={formData.remarks}
								onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
								disabled={fieldsLocked}
								className={fieldCls}
								placeholder="비고를 입력하세요"
							/>
						</div>

						{/* 서명 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">서명</label>
							<input
								type="text"
								value={formData.observer}
								onChange={(e) => setFormData(prev => ({ ...prev, observer: e.target.value }))}
								disabled={fieldsLocked}
								className={fieldCls}
								placeholder="서명을 입력하세요"
							/>
						</div>
					</div>

					{/* 하단 버튼 영역 */}
					<div className="flex justify-end gap-2 mt-6">
						<button
							type="button"
							onClick={() => void handleEditOrSave()}
							disabled={!selectedMember || loadingRecords || (!isEditMode && selectedRecordIndex === null)}
							className={`px-6 py-2 text-sm font-medium border rounded disabled:opacity-50 disabled:cursor-not-allowed ${
								isEditMode
									? 'text-green-900 bg-green-100 border-green-400 hover:bg-green-200'
									: 'text-blue-900 bg-blue-200 border-blue-400 hover:bg-blue-300'
							}`}
						>
							{isEditMode ? (loadingRecords ? '저장중' : '저장') : '수정'}
						</button>
						{isEditMode && (
							<button
								type="button"
								onClick={handleCancelEdit}
								disabled={loadingRecords}
								className="px-6 py-2 text-sm font-medium text-gray-800 bg-gray-100 border border-gray-400 rounded hover:bg-gray-200 disabled:opacity-50"
							>
								취소
							</button>
						)}
					</div>
				</div>
					</div>
					{!selectedMember && (
						<div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/30 backdrop-blur-[1px]">
							<p className="px-6 py-3 text-lg font-semibold text-blue-900 bg-white/90 border border-blue-200 rounded-lg shadow-sm">
								수급자를 선택해주세요
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

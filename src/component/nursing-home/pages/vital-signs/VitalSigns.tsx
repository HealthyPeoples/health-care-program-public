"use client";

/**
 * @file 활력징후 — 화면 컴포넌트 (VitalSigns.tsx)
 *
 * @description
 * 요양원 활력징후 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/vital-signs
 *
 * @module component/nursing-home/pages/vital-signs/VitalSigns
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
	toNullableNumber,
	toNullableDecimal,
} from '../../utils/f30120Fields';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import {
	availableFloorsFromMembers,
	compareVitalRow,
	extractFloorFromRoomNo,
	normalizeRoomNo,
	type VitalSortMode,
} from '../../utils/roomNoFloor';
import { buildNursingLogAllHtml, buildNursingLogHtml, openPrintWindow } from '../../utils/v30030rPrint';
import { EmployeeSearchInput } from '../../components/EmployeeSearchInput';

interface VitalSignsData {
	id: number;
	status: string;
	beneficiaryName: string;
	livingRoom: string;
	systolicBP: string;
	diastolicBP: string;
	fastingBloodSugar: string;
	postMealBloodSugar: string;
	pulse: string;
	bodyTemperature: string;
	respiration: string;
	oxygenSaturation: string;
	nursingDetails: string;
	author: string;
	ancd?: string;
	pnum?: string;
	seq: number;
}

export default function VitalSigns() {
	const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
	const [selectedStatus, setSelectedStatus] = useState<string>('입소');
	const [selectedLivingRoom, setSelectedLivingRoom] = useState<string>('');
	const [sortMode, setSortMode] = useState<VitalSortMode>('room');
	const [editingRowId, setEditingRowId] = useState<number | null>(null);
	const [editingBackup, setEditingBackup] = useState<VitalSignsData | null>(null);
	const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [adding, setAdding] = useState(false);
	const [vitalSignsData, setVitalSignsData] = useState<VitalSignsData[]>([]);
	const [nextId, setNextId] = useState(1);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;
	
	// 출력 모달 관련 상태
	const [showPrintModal, setShowPrintModal] = useState(false);
	const [printMode, setPrintMode] = useState<'individual' | 'all'>('individual');
	const [memberSearchTerm, setMemberSearchTerm] = useState('');
	const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
	const [showMemberSearchResults, setShowMemberSearchResults] = useState(false);
	const [selectedMemberForPrint, setSelectedMemberForPrint] = useState<any>(null);
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [printData, setPrintData] = useState<any[]>([]);
	const [loadingPrintData, setLoadingPrintData] = useState(false);

	// F30120 데이터 조회 함수
	const fetchVitalSignsData = async (rsdt: string) => {
		setLoading(true);
		try {
			const url = `/api/f30120?rsdt=${encodeURIComponent(rsdt)}`;
			const response = await fetch(url);
			const result = await response.json();
			
			if (result.success && Array.isArray(result.data)) {
				// F30120 데이터를 vitalSignsData 형식으로 변환
				const transformedData: VitalSignsData[] = result.data
					.map((item: any, index: number) => {
					// 현황 (P_ST: '1'=입소, '9'=퇴소)
					const status = item.P_ST === '1' ? '입소' : item.P_ST === '9' ? '퇴소' : '';
					const roomNo = normalizeRoomNo(item.ROOM_NO);
					
					return {
						id: index + 1,
						status: status,
						beneficiaryName: item.P_NM || '',
						livingRoom: roomNo,
						systolicBP: item.SBDP != null && item.SBDP !== '' ? String(item.SBDP) : '',
						diastolicBP: item.EBDP != null && item.EBDP !== '' ? String(item.EBDP) : '',
						fastingBloodSugar:
							item.SBDS != null && item.SBDS !== '' ? String(item.SBDS) : '',
						postMealBloodSugar:
							item.EBDS != null && item.EBDS !== '' ? String(item.EBDS) : '',
						pulse: item.PUCNT || '',
						bodyTemperature: item.TMPBD || '',
						respiration: item.BRCNT || '',
						oxygenSaturation:
							item.O2_SAT != null && item.O2_SAT !== '' ? String(item.O2_SAT) : '',
						nursingDetails: item.NUDES || '',
						author: String(item.NS_WRITE_NAME || item.INEMPNM || ''),
						ancd: item.ANCD || '',
						pnum: item.PNUM != null ? String(item.PNUM) : '',
						seq: Number(item.VS_SEQ) > 0 ? Number(item.VS_SEQ) : 1
					};
				})
					.sort((a, b) => {
						const byName = (a.beneficiaryName || '').localeCompare(b.beneficiaryName || '', 'ko');
						if (byName !== 0) return byName;
						return (a.seq || 1) - (b.seq || 1);
					})
					.map((row, idx) => ({ ...row, id: idx + 1 }));
				
				setVitalSignsData(transformedData);
				setSelectedRowId(null);
				setEditingRowId(null);
				setEditingBackup(null);
				setNextId(transformedData.length > 0 ? Math.max(...transformedData.map(d => d.id)) + 1 : 1);
				return transformedData;
			} else {
				setVitalSignsData([]);
				setSelectedRowId(null);
				setEditingRowId(null);
				setEditingBackup(null);
				setNextId(1);
				return [] as VitalSignsData[];
			}
		} catch (err) {
			console.error('활력증상 데이터 조회 오류:', err);
			setVitalSignsData([]);
			setSelectedRowId(null);
			setEditingRowId(null);
			setEditingBackup(null);
			setNextId(1);
			return [] as VitalSignsData[];
		} finally {
			setLoading(false);
		}
	};

	// 초기 로드 및 날짜 변경 시 데이터 조회
	useEffect(() => {
		setCurrentPage(1); // 날짜 변경 시 페이지를 1로 초기화
		fetchVitalSignsData(selectedDate);
	}, [selectedDate]);

	// 탭 재활성화: 선택 날짜는 유지하고 데이터만 재조회
	useTabRefresh(() => {
		void fetchVitalSignsData(selectedDate);
	});

	// 날짜 변경 함수
	const handleDateChange = (days: number) => {
		const date = new Date(selectedDate);
		date.setDate(date.getDate() + days);
		setSelectedDate(date.toISOString().split('T')[0]);
	};

	// 데이터 업데이트
	const handleDataChange = (id: number, field: string, value: string) => {
		setVitalSignsData(prev => prev.map(item => 
			item.id === id ? { ...item, [field]: value } : item
		));
	};

	// 수정 모드 토글 (+ 저장 시 F30120 일상 필드 업데이트)
	const handleEditClick = async (id: number) => {
		if (editingRowId === id) {
			const row = vitalSignsData.find((r) => r.id === id);
			if (!row) {
				setEditingRowId(null);
				setEditingBackup(null);
				return;
			}
			if (!row.pnum) {
				alert('수급자 정보가 없어 저장할 수 없습니다.');
				return;
			}
			setSaving(true);
			try {
				const payload = {
					scope: 'daily',
					rsdt: selectedDate,
					pnum: row.pnum,
					SBDS: toNullableNumber(row.fastingBloodSugar),
					EBDS: toNullableNumber(row.postMealBloodSugar),
					SBDP: toNullableNumber(row.systolicBP),
					EBDP: toNullableNumber(row.diastolicBP),
					TMPBD: toNullableDecimal(row.bodyTemperature),
					PUCNT: toNullableNumber(row.pulse),
					BRCNT: toNullableNumber(row.respiration),
					O2_SAT: toNullableDecimal(row.oxygenSaturation),
					NUDES: row.nursingDetails || '',
					INEMPNM: row.author || null,
					NS_WRITE_NAME: row.author || null,
					vsSeq: row.seq || 1,
				};
				const res = await fetch('/api/f30120', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success) {
					alert(`저장 실패: ${json?.error || '알 수 없는 오류'}`);
					return;
				}
				setEditingRowId(null);
				setEditingBackup(null);
				alert('저장되었습니다');
			} catch (e) {
				console.error(e);
				alert('저장 중 오류가 발생했습니다.');
			} finally {
				setSaving(false);
			}
		} else {
			const row = vitalSignsData.find((r) => r.id === id);
			setEditingRowId(id);
			setEditingBackup(row ? (JSON.parse(JSON.stringify(row)) as VitalSignsData) : null);
		}
	};

	// 수정 취소: 진입 시점 값으로 복원
	const handleCancelEdit = (id: number) => {
		if (editingBackup && editingBackup.id === id) {
			setVitalSignsData((prev) => prev.map((r) => (r.id === id ? editingBackup : r)));
		}
		setEditingRowId(null);
		setEditingBackup(null);
	};

	const handleAddExtraClick = async (id: number) => {
		const row = vitalSignsData.find((r) => r.id === id);
		if (!row?.pnum) {
			alert('수급자 정보가 없어 추가할 수 없습니다.');
			return;
		}
		if (editingRowId != null) {
			alert('수정 중인 행을 먼저 저장하거나 취소해 주세요.');
			return;
		}
		setAdding(true);
		try {
			const res = await fetch('/api/f30120', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'add',
					rsdt: selectedDate,
					pnum: row.pnum,
					INEMPNM: row.author || null,
					NS_WRITE_NAME: row.author || null,
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`추가 실패: ${json?.error || '알 수 없는 오류'}`);
				return;
			}
			const newSeq = Number(json.vsSeq) || 0;
			const list = await fetchVitalSignsData(selectedDate);
			const created = list.find((r) => String(r.pnum) === String(row.pnum) && r.seq === newSeq);
			if (created) {
				const visible = list
					.filter((r) => {
						if (selectedStatus && r.status !== selectedStatus) return false;
						if (selectedLivingRoom) {
							const floorMatch = /^(\d+)층$/.exec(selectedLivingRoom);
							if (floorMatch) {
								if (extractFloorFromRoomNo(r.livingRoom) !== Number(floorMatch[1])) return false;
							} else if (r.livingRoom !== selectedLivingRoom) {
								return false;
							}
						}
						return true;
					})
					.sort((a, b) => compareVitalRow(a, b, sortMode));
				const visibleIndex = visible.findIndex((r) => r.id === created.id);
				if (visibleIndex >= 0) {
					setCurrentPage(Math.floor(visibleIndex / itemsPerPage) + 1);
				}
				setSelectedRowId(created.id);
				setEditingRowId(created.id);
				setEditingBackup(JSON.parse(JSON.stringify(created)) as VitalSignsData);
			}
		} catch (e) {
			console.error(e);
			alert('추가 중 오류가 발생했습니다.');
		} finally {
			setAdding(false);
		}
	};

	// 삭제 함수
	const handleDeleteClick = async (id: number) => {
		const row = vitalSignsData.find((r) => r.id === id);
		if (!row) return;
		const sameCount = vitalSignsData.filter((r) => String(r.pnum || '') === String(row.pnum || '')).length;
		if (sameCount <= 1) {
			alert('당일 기본 행은 삭제할 수 없습니다. 추가 측정 행만 삭제할 수 있습니다.');
			return;
		}
		if (!row.pnum) {
			alert('수급자 정보가 없어 삭제할 수 없습니다.');
			return;
		}
		if (!confirm('추가 측정 행을 삭제하시겠습니까?')) return;
		try {
			const params = new URLSearchParams({
				rsdt: selectedDate,
				pnum: String(row.pnum),
				vsSeq: String(row.seq || 1),
			});
			const res = await fetch(`/api/f30120?${params.toString()}`, { method: 'DELETE' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || '알 수 없는 오류'}`);
				return;
			}
			await fetchVitalSignsData(selectedDate);
		} catch (e) {
			console.error(e);
			alert('삭제 중 오류가 발생했습니다.');
		}
	};

	// 행 추가 함수
	const handleAddRow = () => {
		const newRow: VitalSignsData = {
			id: nextId,
			status: '',
			beneficiaryName: '',
			livingRoom: '',
			systolicBP: '',
			diastolicBP: '',
			fastingBloodSugar: '',
			postMealBloodSugar: '',
			pulse: '',
			bodyTemperature: '',
			respiration: '',
			oxygenSaturation: '',
			nursingDetails: '',
			author: '',
			seq: 1
		};
		
		setVitalSignsData(prev => [...prev, newRow]);
		setNextId(prev => prev + 1);
		setSelectedRowId(newRow.id);
		setEditingRowId(newRow.id);
		setEditingBackup(JSON.parse(JSON.stringify(newRow)) as VitalSignsData);
	};

	// 필터링된 데이터
	const filteredData = vitalSignsData.filter(row => {
		// 현황 필터링
		if (selectedStatus && row.status !== selectedStatus) {
			return false;
		}
		
		// 생활실 필터링 (ROOM_NO 또는 층수)
		if (selectedLivingRoom) {
			const floorMatch = /^(\d+)층$/.exec(selectedLivingRoom);
			if (floorMatch) {
				if (extractFloorFromRoomNo(row.livingRoom) !== Number(floorMatch[1])) return false;
			} else if (row.livingRoom !== selectedLivingRoom) {
				return false;
			}
		}
		
		return true;
	});

	const availableFloors = useMemo(
		() => availableFloorsFromMembers(vitalSignsData.map((row) => ({ ROOM_NO: row.livingRoom }))),
		[vitalSignsData]
	);

	const sortedData = [...filteredData].sort((a, b) => compareVitalRow(a, b, sortMode));

	// 페이지네이션 계산
	const totalPages = Math.ceil(sortedData.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedData = sortedData.slice(startIndex, endIndex);

	// 페이지 변경 함수
	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	// 필터 변경 시 첫 페이지로 이동
	useEffect(() => {
		setCurrentPage(1);
	}, [selectedStatus, selectedLivingRoom, sortMode]);

	// 날짜 포맷팅 (yyyy-mm-dd -> yyyy. mm. dd)
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}. ${month}. ${day}`;
	};

	// 수급자 검색 함수
	const handleSearchMemberForPrint = async (searchValue: string) => {
		if (!searchValue || searchValue.trim().length < 1) {
			setMemberSearchResults([]);
			setShowMemberSearchResults(false);
			return;
		}

		try {
			const response = await fetch(`/api/f10010?name=${encodeURIComponent(searchValue.trim())}`);
			if (!response.ok) {
				throw new Error('검색 요청 실패');
			}
			const data = await response.json();
			
			if (data.success && data.data) {
				setMemberSearchResults(data.data);
				setShowMemberSearchResults(data.data.length > 0);
			} else {
				setMemberSearchResults([]);
				setShowMemberSearchResults(false);
			}
		} catch (error) {
			console.error('수급자 검색 오류:', error);
			setMemberSearchResults([]);
			setShowMemberSearchResults(false);
		}
	};

	// 수급자 선택 함수
	const handleSelectMemberForPrint = (member: any) => {
		setSelectedMemberForPrint(member);
		setMemberSearchTerm(member.P_NM || '');
		setShowMemberSearchResults(false);
		setMemberSearchResults([]);
	};

	const getCurrentMonthRange = () => {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth();
		const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
		const lastDay = new Date(y, m + 1, 0).getDate();
		const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
		return { start, end };
	};

	const openPrintModal = (mode: 'individual' | 'all') => {
		setPrintMode(mode);
		setPrintData([]);
		setSelectedMemberForPrint(null);
		setMemberSearchTerm('');
		setMemberSearchResults([]);
		setShowMemberSearchResults(false);
		const { start, end } = getCurrentMonthRange();
		setStartDate(start);
		setEndDate(end);
		setShowPrintModal(true);
	};

	// 출력용 데이터 조회 (V30030R)
	const handleLoadPrintData = async () => {
		if (!startDate || !endDate) {
			alert('기간을 선택해주세요.');
			return;
		}
		if (printMode === 'individual' && !selectedMemberForPrint) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (startDate > endDate) {
			alert('시작일이 종료일보다 늦을 수 없습니다.');
			return;
		}

		setLoadingPrintData(true);
		try {
			const params = new URLSearchParams({
				startDate,
				endDate,
			});
			if (printMode === 'individual' && selectedMemberForPrint) {
				params.set('pnum', String(selectedMemberForPrint.PNUM ?? ''));
				params.set('ancd', String(selectedMemberForPrint.ANCD ?? ''));
			}
			const response = await fetch(`/api/v30030r?${params.toString()}`);
			const result = await response.json();
			
			if (result.success && Array.isArray(result.data)) {
				setPrintData(result.data);
				if (result.data.length === 0) {
					alert('조회된 데이터가 없습니다.');
				}
			} else {
				setPrintData([]);
				alert(`데이터를 조회할 수 없습니다.${result?.error ? `\n${result.error}` : ''}`);
			}
		} catch (err) {
			console.error('출력 데이터 조회 오류:', err);
			alert('데이터 조회 중 오류가 발생했습니다.');
			setPrintData([]);
		} finally {
			setLoadingPrintData(false);
		}
	};

	// 출력 함수 (간호일지 레이아웃)
	const handlePrint = () => {
		if (printData.length === 0) {
			alert('출력할 데이터가 없습니다. 먼저 데이터를 조회해주세요.');
			return;
		}

		const rrnRaw = selectedMemberForPrint?.P_JUMIN || selectedMemberForPrint?.P_BRDT || '';
		const rrnMasked =
			typeof rrnRaw === 'string' && rrnRaw.length >= 7
				? rrnRaw.replace(/(\d{6})[-]?(\d).*/, '$1-$2******')
				: String(rrnRaw || '');

		const html =
			printMode === 'all'
				? buildNursingLogAllHtml(printData, { startDate, endDate })
				: buildNursingLogHtml(printData, {
						startDate,
						endDate,
						fallback: {
							facilityCode: selectedMemberForPrint?.ANCD != null ? String(selectedMemberForPrint.ANCD) : '',
							name: selectedMemberForPrint?.P_NM || '',
							rrn: rrnMasked,
						},
					});
		openPrintWindow(html);
	};

	// 모달 닫기
	const handleClosePrintModal = () => {
		setShowPrintModal(false);
		setPrintMode('individual');
		setSelectedMemberForPrint(null);
		setMemberSearchTerm('');
		setStartDate('');
		setEndDate('');
		setPrintData([]);
		setMemberSearchResults([]);
		setShowMemberSearchResults(false);
	};

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="mx-auto w-full max-w-[1600px] min-w-0 p-3 sm:p-4">
				{/* 상단: 날짜 네비게이션 및 출력 */}
				<div className="mb-4 flex items-center border-b border-blue-200 pb-3 relative">
					{/* 가운데: 날짜 네비게이션 */}
					<div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4">
						<button 
							onClick={() => handleDateChange(-1)}
							className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
						>
							<span>◀</span>
							<span>이전일</span>
						</button>
						<div className="flex items-center gap-2">
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white text-blue-900"
							/>
						</div>
						<button 
							onClick={() => handleDateChange(1)}
							className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
						>
							<span>다음일</span>
							<span>▶</span>
						</button>
					</div>
					{/* 오른쪽: 출력 버튼 */}
					<div className="ml-auto flex items-end gap-2">
						<button 
							onClick={() => openPrintModal('individual')}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							개별출력
						</button>
						<button 
							onClick={() => openPrintModal('all')}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							전체출력
						</button>
					</div>
				</div>

				{/* 메인 콘텐츠 영역 */}
				<div className="flex flex-col gap-4">
					{/* 상단 필터 패널 - 가로 배치 */}
					{/* <div className="flex gap-4 items-end">
						<div className="border border-blue-300 rounded-lg p-3 bg-blue-50">
							<label className="block text-sm font-semibold text-blue-900 mb-2">현황</label>
							<select
								value={selectedStatus}
								onChange={(e) => setSelectedStatus(e.target.value)}
								className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[120px]"
							>
								<option value="">전체</option>
								<option value="입소">입소</option>
								<option value="퇴소">퇴소</option>
							</select>
						</div>
						<div className="border border-blue-300 rounded-lg p-3 bg-blue-50">
							<label className="block text-sm font-semibold text-blue-900 mb-2">생활실</label>
							<select
								value={selectedLivingRoom}
								onChange={(e) => setSelectedLivingRoom(e.target.value)}
								className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[120px]"
							>
								<option value="">전체</option>
								<option value="1층">1층</option>
								<option value="2층">2층</option>
								<option value="3층">3층</option>
							</select>
						</div>
					</div> */}

					{/* 우측 메인 테이블 */}
					<div className="flex-1 border border-blue-300 rounded-lg bg-white shadow-sm">
						<div className="bg-blue-100 border-b border-blue-300 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
							<h2 className="text-lg font-semibold text-blue-900">활력증상 등록(일상)</h2>
							<div className="flex items-center gap-4 flex-wrap">
								<div className="flex items-center gap-2">
									<span className="text-sm text-blue-900">층별</span>
									<button
										type="button"
										onClick={() => setSelectedLivingRoom('')}
										className={`px-3 py-1 text-xs border rounded font-medium ${
											selectedLivingRoom === ''
												? 'border-blue-500 bg-blue-500 text-white'
												: 'border-blue-300 bg-white text-blue-900 hover:bg-blue-50'
										}`}
									>
										전체
									</button>
									{availableFloors.map((floor) => {
										const value = `${floor}층`;
										return (
											<button
												key={floor}
												type="button"
												onClick={() => setSelectedLivingRoom(value)}
												className={`px-3 py-1 text-xs border rounded font-medium ${
													selectedLivingRoom === value
														? 'border-blue-500 bg-blue-500 text-white'
														: 'border-blue-300 bg-white text-blue-900 hover:bg-blue-50'
												}`}
											>
												{value}
											</button>
										);
									})}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-sm text-blue-900">정렬</span>
									<button
										type="button"
										onClick={() => setSortMode('room')}
										className={`px-3 py-1 text-xs border rounded font-medium ${
											sortMode === 'room'
												? 'border-blue-500 bg-blue-500 text-white'
												: 'border-blue-300 bg-white text-blue-900 hover:bg-blue-50'
										}`}
									>
										생활실별
									</button>
									<button
										type="button"
										onClick={() => setSortMode('name')}
										className={`px-3 py-1 text-xs border rounded font-medium ${
											sortMode === 'name'
												? 'border-blue-500 bg-blue-500 text-white'
												: 'border-blue-300 bg-white text-blue-900 hover:bg-blue-50'
										}`}
									>
										수급자별
									</button>
								</div>
							</div>
						</div>
						<div className="overflow-x-auto w-full min-w-0">
							<table className="w-full text-sm">
								<thead className="bg-blue-50 border-b border-blue-200 sticky top-0">
									<tr>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">현황</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">수급자명</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">생활실</th>
										<th colSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-b border-blue-200">혈압(mmHg)</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">맥박(분)</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">호흡(회)</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">체온(℃)</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">공복혈당</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">식후혈당</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-24">산소포화도(%SpO2)</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-80">간호내역</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-32">작성자</th>
										<th rowSpan={2} className="text-center px-3 py-2 text-blue-900 font-semibold w-40">작업</th>
									</tr>
									<tr>
										<th className="text-center px-3 py-1.5 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">수축기</th>
										<th className="text-center px-3 py-1.5 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">이완기</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={14} className="text-center px-3 py-4 text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : vitalSignsData.length === 0 ? (
										<tr>
											<td colSpan={14} className="text-center px-3 py-4 text-blue-900/60">
												데이터가 없습니다
											</td>
										</tr>
									) : (
										paginatedData.map((row) => (
										<tr 
											key={row.id} 
											onClick={() => setSelectedRowId(row.id)}
											className={`border-b border-blue-50 cursor-pointer hover:bg-blue-50 ${
												selectedRowId === row.id ? 'bg-blue-100' : ''
											}`}
										>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.status}
													onChange={(e) => handleDataChange(row.id, 'status', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<div className="flex items-center justify-center gap-1">
													<input
														type="text"
														value={row.beneficiaryName}
														onChange={(e) => handleDataChange(row.id, 'beneficiaryName', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
													/>
													{row.seq > 1 ? (
														<span className="shrink-0 text-[10px] text-blue-700 whitespace-nowrap">
															{row.seq}회
														</span>
													) : null}
												</div>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<span className="block w-full px-2 py-1 text-center">
													{row.livingRoom || '-'}
												</span>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													inputMode="numeric"
													value={row.systolicBP}
													onChange={(e) => handleDataChange(row.id, 'systolicBP', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
													placeholder="수축"
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													inputMode="numeric"
													value={row.diastolicBP}
													onChange={(e) => handleDataChange(row.id, 'diastolicBP', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
													placeholder="이완"
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.pulse}
													onChange={(e) => handleDataChange(row.id, 'pulse', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.respiration}
													onChange={(e) => handleDataChange(row.id, 'respiration', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.bodyTemperature}
													onChange={(e) => handleDataChange(row.id, 'bodyTemperature', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													inputMode="numeric"
													value={row.fastingBloodSugar}
													onChange={(e) => handleDataChange(row.id, 'fastingBloodSugar', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													inputMode="numeric"
													value={row.postMealBloodSugar}
													onChange={(e) => handleDataChange(row.id, 'postMealBloodSugar', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.oxygenSaturation}
													onChange={(e) => handleDataChange(row.id, 'oxygenSaturation', e.target.value)}
													disabled={editingRowId !== row.id}
													className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="px-3 py-3 border-r border-blue-100 align-top">
												{editingRowId === row.id ? (
													<textarea
														value={row.nursingDetails}
														onChange={(e) => handleDataChange(row.id, 'nursingDetails', e.target.value)}
														className="w-full px-2 py-1 border border-blue-300 rounded bg-white resize-none"
														placeholder="간호내역 입력"
														rows={2}
													/>
												) : (
													<div className="w-full px-2 py-1 text-left whitespace-normal break-words">
														{row.nursingDetails || <span className="text-gray-400">-</span>}
													</div>
												)}
											</td>
											<td className="text-center px-3 py-3 border-r border-blue-100">
												<EmployeeSearchInput
													value={row.author}
													onChange={(name) => handleDataChange(row.id, 'author', name)}
													disabled={editingRowId !== row.id}
													placeholder="직원 검색"
													inputClassName={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
											</td>
											<td className="text-center px-3 py-3">
												<div className="flex justify-center gap-1 flex-wrap">
													<button
														onClick={(e) => {
															e.stopPropagation();
															void handleEditClick(row.id);
														}}
														disabled={saving || adding}
														className={`px-3 py-1 text-xs border rounded font-medium disabled:opacity-50 ${
															editingRowId === row.id
																? 'border-green-400 bg-green-200 hover:bg-green-300 text-green-900'
																: 'border-blue-400 bg-blue-200 hover:bg-blue-300 text-blue-900'
														}`}
													>
														{editingRowId === row.id ? (saving ? '저장중' : '저장') : '수정'}
													</button>
													{editingRowId === row.id ? (
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																handleCancelEdit(row.id);
															}}
															className="px-3 py-1 text-xs border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium"
														>
															취소
														</button>
													) : (
														<>
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	void handleAddExtraClick(row.id);
																}}
																disabled={adding || saving}
																className="px-3 py-1 text-xs border border-amber-400 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium disabled:opacity-50"
															>
																{adding ? '추가중' : '추가'}
															</button>
															<button
																type="button"
																onClick={(e) => {
																	e.stopPropagation();
																	void handleDeleteClick(row.id);
																}}
																className="px-3 py-1 text-xs border border-red-400 rounded bg-red-200 hover:bg-red-300 text-red-900 font-medium"
															>
																삭제
															</button>
														</>
													)}
												</div>
											</td>
										</tr>
									)))}
								</tbody>
							</table>
						</div>
					</div>

					{/* 페이지네이션 */}
					{totalPages > 1 && (
						<div className="p-3 border-t border-blue-200 bg-white">
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
								<span className="ml-4 text-xs text-blue-900">
									{sortedData.length > 0 ? `${startIndex + 1}-${Math.min(endIndex, sortedData.length)} / ${sortedData.length}` : '0 / 0'}
								</span>
							</div>
						</div>
					)}

					{/* 하단 추가 버튼 */}
					{/* <div className="flex justify-center mt-4">
						<button
							onClick={handleAddRow}
							className="px-6 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							추가
						</button>
					</div> */}
				</div>
			</div>

			{/* 출력 모달 */}
			{showPrintModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white rounded-lg border border-blue-400 w-full max-w-[600px] max-h-[90vh] overflow-y-auto p-6 shadow-xl">
						<div className="mb-4">
							<h2 className="text-xl font-semibold text-blue-900 mb-4">
								{printMode === 'all' ? '간호일지 전체출력' : '간호일지 개별출력'}
							</h2>
							
							{/* 수급자 검색 */}
							{printMode === 'individual' && (
							<div className="mb-4">
								<label className="block text-sm font-semibold text-blue-900 mb-2">수급자 검색</label>
								<div className="relative">
									<input
										type="text"
										value={memberSearchTerm}
										onChange={(e) => {
											setMemberSearchTerm(e.target.value);
											handleSearchMemberForPrint(e.target.value);
										}}
										onFocus={() => {
											if (memberSearchResults.length > 0) {
												setShowMemberSearchResults(true);
											}
										}}
										placeholder="수급자명을 입력하세요"
										className="w-full px-3 py-2 border border-blue-300 rounded"
									/>
									{showMemberSearchResults && memberSearchResults.length > 0 && (
										<div className="absolute z-10 w-full mt-1 bg-white border border-blue-300 rounded shadow-lg max-h-40 overflow-y-auto">
											{memberSearchResults.map((member, index) => (
												<div
													key={index}
													onClick={() => handleSelectMemberForPrint(member)}
													className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-blue-100"
												>
													{member.P_NM} ({member.PNUM})
												</div>
											))}
										</div>
									)}
								</div>
								{selectedMemberForPrint && (
									<div className="mt-2 text-sm text-blue-700">
										선택된 수급자: {selectedMemberForPrint.P_NM}
									</div>
								)}
							</div>
							)}

							{/* 기간 설정 */}
							<div className="mb-4">
								<label className="block text-sm font-semibold text-blue-900 mb-2">조사기간</label>
								<div className="flex items-center gap-2">
									<input
										type="date"
										value={startDate}
										onChange={(e) => setStartDate(e.target.value)}
										className="flex-1 px-3 py-2 border border-blue-300 rounded"
									/>
									<span>~</span>
									<input
										type="date"
										value={endDate}
										onChange={(e) => setEndDate(e.target.value)}
										className="flex-1 px-3 py-2 border border-blue-300 rounded"
									/>
								</div>
							</div>

							{/* 조회된 데이터 정보 */}
							{printData.length > 0 && (
								<div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-900">
									조회된 데이터: {printData.length}건
									{printMode === 'all'
										? ` / 수급자 ${new Set(printData.map((r) => String(r.PNUM ?? r['수급자성명'] ?? ''))).size}명`
										: ''}
								</div>
							)}

							{/* 버튼 */}
							<div className="flex gap-2 justify-end">
								<button
									onClick={handleLoadPrintData}
									disabled={
										!startDate ||
										!endDate ||
										loadingPrintData ||
										(printMode === 'individual' && !selectedMemberForPrint)
									}
									className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{loadingPrintData ? '조회 중...' : '조회'}
								</button>
								<button
									onClick={handlePrint}
									disabled={printData.length === 0}
									className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									출력
								</button>
								<button
									onClick={handleClosePrintModal}
									className="px-4 py-2 text-sm border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium"
								>
									닫기
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


"use client";
import React, { useState, useEffect } from 'react';
import {
	bjdgToLabel,
	bjynToBool,
	boolToBjyn,
	boolToFlag01,
	boolToFlagNy,
	flag01ToBool,
	flagNyToBool,
	labelToBjdg,
	toNullableDecimal,
	toNullableNumber,
} from '../../utils/f30120Fields';
import {
	extractFloorFromRoomNo,
	fetchRoomNoMapFromF30112,
	normalizePnumKey,
} from '../../utils/roomNoFloor';
import { buildHealthRecordHtml, openPrintWindow } from '../../utils/v30030rPrint';

interface VitalSignsPeriodicData {
	id: number;
	status: string;
	beneficiaryName: string;
	weight: string;
	waterIntake: string;
	livingRoom: string;
	edema: boolean;
	edemaArea: string;
	edemaDegree: string;
	bedsore: boolean;
	bedsoreArea: string;
	medication: boolean;
	injection: boolean;
	incontinence: boolean;
	dressing: boolean;
	painVAS: string;
	nursingHistory: string;
	author: string;
	fall: boolean;
	dehydration: boolean;
	delirium: boolean;
	problemBehavior: boolean;
	ancd?: string;
	pnum?: string;
}

export default function VitalSignsPeriodic() {
	const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
	const [selectedStatus, setSelectedStatus] = useState<string>('입소');
	const [selectedLivingRoom, setSelectedLivingRoom] = useState<string>('');
	const [editingRowId, setEditingRowId] = useState<number | null>(null);
	const [editingBackup, setEditingBackup] = useState<VitalSignsPeriodicData | null>(null);
	const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [vitalSignsData, setVitalSignsData] = useState<VitalSignsPeriodicData[]>([]);
	const [nextId, setNextId] = useState(1);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 5;

	// 출력 모달 관련 상태
	const [showPrintModal, setShowPrintModal] = useState(false);
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
				const roomMap = await fetchRoomNoMapFromF30112(result.data.map((item: any) => item.PNUM));
				const transformedData: VitalSignsPeriodicData[] = result.data
					.map((item: any, index: number) => {
					const status = item.P_ST === '1' ? '입소' : item.P_ST === '9' ? '퇴소' : '';
					const pain = String(item.NS_PAN_CHK ?? '').trim();
					const roomNo = roomMap.get(normalizePnumKey(item.PNUM)) || '';
					return {
						id: index + 1,
						status,
						beneficiaryName: item.P_NM || '',
						weight: item.WEIGHT != null && item.WEIGHT !== '' ? String(item.WEIGHT) : '',
						waterIntake:
							item.WATER_INTAKE != null && item.WATER_INTAKE !== ''
								? String(item.WATER_INTAKE)
								: '',
						livingRoom: roomNo,
						edema: bjynToBool(item.BJYN),
						edemaArea: String(item.BJPA ?? ''),
						edemaDegree: bjdgToLabel(item.BJDG),
						bedsore: flag01ToBool(item.NS_SORE_MNG),
						bedsoreArea: String(item.NS_SORE_DESC ?? ''),
						medication: flag01ToBool(item.NS_MEDI_CHK),
						injection: flag01ToBool(item.NS_JUSA_CHK),
						incontinence: flagNyToBool(item.NS_DNG_CHK),
						dressing: flagNyToBool(item.DRESSING_FLAG),
						painVAS: pain,
						nursingHistory: String(item.NUDES ?? ''),
						author: String(item.NS_WRITE_NAME || item.INEMPNM || ''),
						fall: flagNyToBool(item.NS_FAL_CHK),
						dehydration: flagNyToBool(item.NS_DRY_CHK),
						delirium: flagNyToBool(item.NS_DLM_CHK),
						problemBehavior: flagNyToBool(item.NS_ACT_CHK),
						ancd: item.ANCD != null ? String(item.ANCD) : '',
						pnum: item.PNUM != null ? String(item.PNUM) : ''
					};
				})
					.sort((a, b) => (a.beneficiaryName || '').localeCompare(b.beneficiaryName || '', 'ko'))
					.map((row, idx) => ({ ...row, id: idx + 1 }));
				
				setVitalSignsData(transformedData);
				setSelectedRowId(null);
				setEditingRowId(null);
				setEditingBackup(null);
				setNextId(transformedData.length > 0 ? Math.max(...transformedData.map(d => d.id)) + 1 : 1);
			} else {
				setVitalSignsData([]);
				setSelectedRowId(null);
				setEditingRowId(null);
				setEditingBackup(null);
				setNextId(1);
			}
		} catch (err) {
			console.error('활력증상 데이터 조회 오류:', err);
			setVitalSignsData([]);
			setSelectedRowId(null);
			setEditingRowId(null);
			setEditingBackup(null);
			setNextId(1);
		} finally {
			setLoading(false);
		}
	};

	// 초기 로드 및 날짜 변경 시 데이터 조회
	useEffect(() => {
		setCurrentPage(1); // 날짜 변경 시 페이지를 1로 초기화
		fetchVitalSignsData(selectedDate);
	}, [selectedDate]);

	// 날짜 변경 함수
	const handleDateChange = (days: number) => {
		const date = new Date(selectedDate);
		date.setDate(date.getDate() + days);
		setSelectedDate(date.toISOString().split('T')[0]);
	};

	// 데이터 업데이트
	const handleDataChange = (id: number, field: string, value: string | boolean) => {
		setVitalSignsData(prev => prev.map(item => 
			item.id === id ? { ...item, [field]: value } : item
		));
	};

	// 수정 모드 토글 (+ 저장 시 F30120 주기 필드 업데이트)
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
				const pain = String(row.painVAS ?? '').trim();
				const payload = {
					scope: 'periodic',
					rsdt: selectedDate,
					pnum: row.pnum,
					WEIGHT: toNullableDecimal(row.weight),
					WATER_INTAKE: toNullableNumber(row.waterIntake),
					BJYN: boolToBjyn(!!row.edema),
					BJDG: labelToBjdg(row.edemaDegree),
					BJPA: row.edemaArea || null,
					NS_SORE_MNG: boolToFlag01(!!row.bedsore),
					NS_SORE_DESC: row.bedsoreArea || null,
					NS_MEDI_CHK: boolToFlag01(!!row.medication),
					NS_JUSA_CHK: boolToFlag01(!!row.injection),
					NS_DNG_CHK: boolToFlagNy(!!row.incontinence),
					DRESSING_FLAG: boolToFlagNy(!!row.dressing),
					NS_PAN_CHK: pain ? pain.slice(0, 1) : null,
					NS_FAL_CHK: boolToFlagNy(!!row.fall),
					NS_DRY_CHK: boolToFlagNy(!!row.dehydration),
					NS_DLM_CHK: boolToFlagNy(!!row.delirium),
					NS_ACT_CHK: boolToFlagNy(!!row.problemBehavior),
					NUDES: row.nursingHistory || '',
					INEMPNM: row.author || null,
					NS_WRITE_NAME: row.author || null,
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
			setEditingBackup(row ? (JSON.parse(JSON.stringify(row)) as VitalSignsPeriodicData) : null);
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

	// 삭제 함수
	const handleDeleteClick = (id: number) => {
		if (confirm('정말 삭제하시겠습니까?')) {
			setVitalSignsData(prev => prev.filter(item => item.id !== id));
			if (editingRowId === id) {
				setEditingRowId(null);
				setEditingBackup(null);
			}
		}
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

	// 페이지네이션 계산
	const totalPages = Math.ceil(filteredData.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedData = filteredData.slice(startIndex, endIndex);

	// 페이지 변경 함수
	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	// 필터 변경 시 첫 페이지로 이동
	useEffect(() => {
		setCurrentPage(1);
	}, [selectedStatus, selectedLivingRoom]);

	// 행 추가 함수
	const handleAddRow = () => {
		const newRow: VitalSignsPeriodicData = {
			id: nextId,
			status: '',
			beneficiaryName: '',
			weight: '',
			waterIntake: '',
			livingRoom: '',
			edema: false,
			edemaArea: '',
			edemaDegree: '',
			bedsore: false,
			bedsoreArea: '',
			medication: false,
			injection: false,
			incontinence: false,
			dressing: false,
			painVAS: '',
			nursingHistory: '',
			author: '',
			fall: false,
			dehydration: false,
			delirium: false,
			problemBehavior: false
		};
		
		setVitalSignsData(prev => [...prev, newRow]);
		setNextId(prev => prev + 1);
		setSelectedRowId(newRow.id);
		setEditingRowId(newRow.id);
		setEditingBackup(JSON.parse(JSON.stringify(newRow)) as VitalSignsPeriodicData);
	};

	// 날짜 포맷팅 (yyyy-mm-dd -> yyyy. mm. dd)
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}. ${month}. ${day}`;
	};

	const handleSearchMemberForPrint = async (searchValue: string) => {
		if (!searchValue || searchValue.trim().length < 1) {
			setMemberSearchResults([]);
			setShowMemberSearchResults(false);
			return;
		}
		try {
			const response = await fetch(`/api/f10010?name=${encodeURIComponent(searchValue.trim())}`);
			if (!response.ok) throw new Error('검색 요청 실패');
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

	const handleSelectMemberForPrint = (member: any) => {
		setSelectedMemberForPrint(member);
		setMemberSearchTerm(member.P_NM || '');
		setShowMemberSearchResults(false);
		setMemberSearchResults([]);
	};

	const handleLoadPrintData = async () => {
		if (!selectedMemberForPrint || !startDate || !endDate) {
			alert('수급자와 기간을 선택해주세요.');
			return;
		}
		if (startDate > endDate) {
			alert('시작일이 종료일보다 늦을 수 없습니다.');
			return;
		}
		setLoadingPrintData(true);
		try {
			const url = `/api/v30030r?pnum=${encodeURIComponent(selectedMemberForPrint.PNUM)}&ancd=${encodeURIComponent(selectedMemberForPrint.ANCD || '')}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
			const response = await fetch(url);
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
		const html = buildHealthRecordHtml(printData, {
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

	const handleClosePrintModal = () => {
		setShowPrintModal(false);
		setSelectedMemberForPrint(null);
		setMemberSearchTerm('');
		setStartDate('');
		setEndDate('');
		setPrintData([]);
		setMemberSearchResults([]);
		setShowMemberSearchResults(false);
	};

	return (
		<div className="min-h-screen bg-white text-black">
			<div className="mx-auto max-w-[1600px] p-4">
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
					<div className="ml-auto flex flex-col items-end gap-1">
						<button
							onClick={() => setShowPrintModal(true)}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							출력
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
						<div className="bg-blue-100 border-b border-blue-300 px-4 py-2">
							<h2 className="text-lg font-semibold text-blue-900">활력증상 등록(주기)</h2>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="bg-blue-50 border-b border-blue-200 sticky top-0">
									<tr>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">현황</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">수급자명</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">생활실</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">체중</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">물 섭취량</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">부종</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">부종 부위</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">부종 정도</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">욕창</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">욕창 부위</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">약물투여</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">주사제투여</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">소변/대변실금</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">드레싱 실시</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">통증 (VAS)</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">낙상</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">탈수</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 whitespace-nowrap">섬망</th>
										<th className="text-center px-3 py-2 text-blue-900 font-semibold">문제행동</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={19} className="text-center px-3 py-4 text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : vitalSignsData.length === 0 ? (
										<tr>
											<td colSpan={19} className="text-center px-3 py-4 text-blue-900/60">
												데이터가 없습니다
											</td>
										</tr>
									) : (
										paginatedData.map((row) => (
										<React.Fragment key={row.id}>
											<tr
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
													<input
														type="text"
														value={row.beneficiaryName}
														onChange={(e) => handleDataChange(row.id, 'beneficiaryName', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="text"
														value={row.livingRoom}
														onChange={(e) => handleDataChange(row.id, 'livingRoom', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="text"
														value={row.weight}
														onChange={(e) => handleDataChange(row.id, 'weight', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
														placeholder="체중 입력"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="text"
														value={row.waterIntake}
														onChange={(e) => handleDataChange(row.id, 'waterIntake', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
														placeholder="ml"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.edema}
														onChange={(e) => handleDataChange(row.id, 'edema', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="text"
														value={row.edemaArea}
														onChange={(e) => handleDataChange(row.id, 'edemaArea', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<select
														value={row.edemaDegree}
														onChange={(e) => handleDataChange(row.id, 'edemaDegree', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
													>
														<option value="">선택</option>
														<option value="+">+</option>
														<option value="++">++</option>
														<option value="+++">+++</option>
													</select>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.bedsore}
														onChange={(e) => handleDataChange(row.id, 'bedsore', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="text"
														value={row.bedsoreArea}
														onChange={(e) => handleDataChange(row.id, 'bedsoreArea', e.target.value)}
														disabled={editingRowId !== row.id}
														className={`w-full px-2 py-1 border border-blue-300 rounded text-center ${
															editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
														}`}
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.medication}
														onChange={(e) => handleDataChange(row.id, 'medication', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.injection}
														onChange={(e) => handleDataChange(row.id, 'injection', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.incontinence}
														onChange={(e) => handleDataChange(row.id, 'incontinence', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.dressing}
														onChange={(e) => handleDataChange(row.id, 'dressing', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<div className="flex items-center justify-center gap-1">
														<input
															type="text"
															value={row.painVAS}
															onChange={(e) => handleDataChange(row.id, 'painVAS', e.target.value)}
															disabled={editingRowId !== row.id}
															className={`w-16 px-2 py-1 border border-blue-300 rounded text-center ${
																editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
															}`}
															placeholder="1~10"
														/>
													</div>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.fall}
														onChange={(e) => handleDataChange(row.id, 'fall', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.dehydration}
														onChange={(e) => handleDataChange(row.id, 'dehydration', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3 border-r border-blue-100">
													<input
														type="checkbox"
														checked={row.delirium}
														onChange={(e) => handleDataChange(row.id, 'delirium', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
												<td className="text-center px-3 py-3">
													<input
														type="checkbox"
														checked={row.problemBehavior}
														onChange={(e) => handleDataChange(row.id, 'problemBehavior', e.target.checked)}
														disabled={editingRowId !== row.id}
														className="cursor-pointer"
													/>
												</td>
											</tr>
											{/* 두 번째 줄: 작성자, 간호내역, 작업 */}
											<tr
												onClick={() => setSelectedRowId(row.id)}
												className={`border-b border-blue-50 cursor-pointer ${
													selectedRowId === row.id ? 'bg-blue-100' : 'bg-blue-25'
												}`}
											>
												<td colSpan={19} className="px-3 py-2">
													<div className="flex items-center gap-4 w-full">
													<div className="flex items-center gap-2 flex-shrink-0">
														<label className="text-xs text-blue-900 font-medium whitespace-nowrap">작성자</label>
														<input
															type="text"
															value={row.author}
															onChange={(e) => handleDataChange(row.id, 'author', e.target.value)}
															disabled={editingRowId !== row.id}
															className={`px-2 py-1 text-xs border border-blue-300 rounded ${
																editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
															}`}
															placeholder="작성자 입력"
														/>
													</div>
														<div className="flex items-center gap-2 flex-1">
															<label className="text-xs text-blue-900 font-medium whitespace-nowrap flex-shrink-0">간호내역</label>
															<textarea
																value={row.nursingHistory}
																onChange={(e) => handleDataChange(row.id, 'nursingHistory', e.target.value)}
																disabled={editingRowId !== row.id}
																className={`w-full px-2 py-1 text-xs border border-blue-300 rounded ${
																	editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
																}`}
																rows={2}
															/>
														</div>
														<div className="flex items-center gap-2 flex-shrink-0">
															<div className="flex gap-2">
																<button
																	onClick={() => handleEditClick(row.id)}
																	disabled={saving}
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
																		onClick={() => handleCancelEdit(row.id)}
																		className="px-3 py-1 text-xs border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium"
																	>
																		취소
																	</button>
																) : (
																	<button
																		type="button"
																		onClick={() => handleDeleteClick(row.id)}
																		className="px-3 py-1 text-xs border border-red-400 rounded bg-red-200 hover:bg-red-300 text-red-900 font-medium"
																	>
																		삭제
																	</button>
																)}
															</div>
														</div>
													</div>
												</td>
											</tr>
										</React.Fragment>
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
									{filteredData.length > 0 ? `${startIndex + 1}-${Math.min(endIndex, filteredData.length)} / ${filteredData.length}` : '0 / 0'}
								</span>
							</div>
						</div>
					)}

					{/* 하단 추가 버튼 */}
					<div className="flex justify-center mt-4">
						<button
							onClick={handleAddRow}
							className="px-6 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							추가
						</button>
					</div>
				</div>
			</div>

			{/* 출력 모달 */}
			{showPrintModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white rounded-lg border border-blue-400 w-[600px] max-h-[90vh] overflow-y-auto p-6 shadow-xl">
						<div className="mb-4">
							<h2 className="text-xl font-semibold text-blue-900 mb-4">건강 관리 기록부 출력</h2>

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

							{printData.length > 0 && (
								<div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-900">
									조회된 데이터: {printData.length}건
								</div>
							)}

							<div className="flex gap-2 justify-end">
								<button
									onClick={handleLoadPrintData}
									disabled={!selectedMemberForPrint || !startDate || !endDate || loadingPrintData}
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


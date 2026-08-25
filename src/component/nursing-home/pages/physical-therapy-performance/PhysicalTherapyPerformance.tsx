"use client";

/**
 * @file 물리치료실적 — 화면 컴포넌트 (PhysicalTherapyPerformance.tsx)
 *
 * @description
 * 요양원 물리치료실적 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/physical-therapy-performance
 *
 * @module component/nursing-home/pages/physical-therapy-performance/PhysicalTherapyPerformance
 */
import React, { useState } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import BeneficiaryListPanel, { BeneficiaryMember, beneficiaryMemberKey } from '../../components/BeneficiaryListPanel';
import { EmployeeSearchInput } from '../../components/EmployeeSearchInput';
import { formatDateYmd } from '../../utils/excretionObservationFields';
import { openPhysicalTherapyRecordPrint, type V32020PrintRow } from './physicalTherapyPerformancePrint';

function todayYmd() {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function monthStartYmd() {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}-01`;
}

function toTimeInput(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
	const d = s.replace(/\D/g, '');
	if (d.length >= 4) return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
	return s;
}

interface MemberData {
	ANCD: string;
	PNUM: string;
	P_NM: string;
	P_SEX: string;
	P_GRD: string;
	P_BRDT: string;
	P_ST: string;
	[key: string]: any;
}

interface TherapyRecordData {
	TDT: string; // 치료일자 (F32020)
	JHEMP?: number | string | null; // 담당자(사번)
	[key: string]: any;
}

export default function PhysicalTherapyPerformance() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [treatmentDates, setTreatmentDates] = useState<string[]>([]);
	const [treatmentRecords, setTreatmentRecords] = useState<TherapyRecordData[]>([]);
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [datePage, setDatePage] = useState(1);
	const dateItemsPerPage = 10;
	const [printFrom, setPrintFrom] = useState(monthStartYmd);
	const [printTo, setPrintTo] = useState(todayYmd);
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(() => new Set());
	const [printRows, setPrintRows] = useState<V32020PrintRow[] | null>(null);
	const [printQuerying, setPrintQuerying] = useState(false);
	const [printOpening, setPrintOpening] = useState(false);

	// F32020 폼 데이터(이미지 스키마 기반: 실시=1, 미실시=0 / 횟수·시간 등은 TVAL/TETCVAL로 입력)
	const createEmptyForm = (tdt?: string) => ({
		TDT: tdt || todayYmd(),
		JHEMP: '',
		JHEMPNM: '',
		// 기구이용: TCHK01~07 / TVAL01~07
		TCHK01: '0', TVAL01: '',
		TCHK02: '0', TVAL02: '',
		TCHK03: '0', TVAL03: '',
		TCHK04: '0', TVAL04: '',
		TCHK05: '0', TVAL05: '',
		TCHK06: '0', TVAL06: '',
		TCHK07: '0', TVAL07: '',
		// 단순운동(기본): TCHK08~12 / TVAL08~12
		TCHK08: '0', TVAL08: '',
		TCHK09: '0', TVAL09: '',
		TCHK10: '0', TVAL10: '',
		TCHK11: '0', TVAL11: '',
		TCHK12: '0', TVAL12: '',
		TTEXT_1: '',
		// 단순운동(치료/훈련): TCHK21~26 / TVAL21~26
		TCHK21: '0', TVAL21: '',
		TCHK22: '0', TVAL22: '',
		TCHK23: '0', TVAL23: '',
		TCHK24: '0', TVAL24: '',
		TCHK25: '0', TVAL25: '',
		TCHK26: '0', TVAL26: '',
		TTEXT_2: '',
		// Modalities: TCHK31~37 / TVAL31~37
		TCHK31: '0', TVAL31: '',
		TCHK32: '0', TVAL32: '',
		TCHK33: '0', TVAL33: '',
		TCHK34: '0', TVAL34: '',
		TCHK35: '0', TVAL35: '',
		TCHK36: '0', TVAL36: '',
		TCHK37: '0', TVAL37: '',
		TTEXT_3: '',
		// 기타치료: TETC_1~5 / TETCVAL_1~5
		TETC_1: '', TETCVAL_1: '',
		TETC_2: '', TETCVAL_2: '',
		TETC_3: '', TETCVAL_3: '',
		TETC_4: '', TETCVAL_4: '',
		TETC_5: '', TETCVAL_5: '',
		TTEXT_4: '',
		ETC: '',
		T_SRT_TM: '',
		T_END_TM: '',
	});
	const [formData, setFormData] = useState(() => createEmptyForm());
	const [formBackup, setFormBackup] = useState<ReturnType<typeof createEmptyForm> | null>(null);

	const extractFloorFromRoomNo = (roomNo: any): number | null => {
		const s = String(roomNo ?? '').trim();
		if (!s) return null;
		const digits = s.replace(/\D/g, '');
		if (!digits) return null;
		const n = parseInt(digits, 10);
		if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return null;
		return Math.floor(n / 100);
	};

	// 나이 계산 함수
	const calculateAge = (birthDate: any) => {
		const s = String(birthDate ?? '').trim();
		if (s.length < 4) return '-';
		try {
			const year = parseInt(s.substring(0, 4));
			const currentYear = new Date().getFullYear();
			return (currentYear - year).toString();
		} catch {
			return '-';
		}
	};

	// 치료일자 목록 조회
	const fetchTreatmentDates = async (ancd: string, pnum: string, keepTdt?: string) => {
		if (!ancd || !pnum) {
			setTreatmentDates([]);
			setTreatmentRecords([]);
			return;
		}

		setLoadingRecords(true);
		try {
			const url = `/api/f32020?pnum=${encodeURIComponent(pnum)}`;
			const response = await fetch(url, { cache: 'no-store' });
			const result = await response.json();

			if (result.success) {
				const list: TherapyRecordData[] = result.data || [];
				const dates = list.map((r) => formatDateYmd(r.TDT)).filter(Boolean);
				setTreatmentRecords(list);
				setTreatmentDates(dates);
				if (keepTdt) {
					const idx = dates.findIndex((d) => d === keepTdt);
					setSelectedDateIndex(idx >= 0 ? idx : null);
					if (idx >= 0) {
						const next = hydrateForm(list[idx], dates[idx]);
						setFormData(next);
						setFormBackup(next);
					}
					const page = idx >= 0 ? Math.floor(idx / dateItemsPerPage) + 1 : 1;
					setDatePage(page);
				} else {
					setSelectedDateIndex(null);
					setDatePage(1);
				}
			} else {
				setTreatmentRecords([]);
				setTreatmentDates([]);
			}
		} catch (err) {
			console.error('치료일자 조회 오류:', err);
		} finally {
			setLoadingRecords(false);
		}
	};

	const confirmLeaveEdit = () => {
		if (!isEditMode) return true;
		return confirm('수정 중인 내용이 저장되지 않습니다. 이동할까요?');
	};

	// 수급자 선택 함수
	const handleSelectMember = (member: BeneficiaryMember) => {
		if (!confirmLeaveEdit()) return;
		setIsEditMode(false);
		setFormBackup(null);
		setSelectedMember(member as any);
		setFormData(createEmptyForm(todayYmd()));
		fetchTreatmentDates(String(member.ANCD), String(member.PNUM));
	};

	const hydrateForm = (record: TherapyRecordData | undefined, date?: string) => {
		if (!record) return createEmptyForm(date);
		return {
			...createEmptyForm(date),
			...record,
			JHEMP: String((record as any).JHEMP ?? ''),
			JHEMPNM: String((record as any).PD_NM ?? (record as any).JHEMPNM ?? '').trim(),
			TDT: formatDateYmd(record.TDT || date || ''),
			T_SRT_TM: toTimeInput((record as any).T_SRT_TM ?? (record as any).시작시간),
			T_END_TM: toTimeInput((record as any).T_END_TM ?? (record as any).종료시간),
		};
	};

	// 치료일자 선택 함수
	const handleSelectDate = (index: number) => {
		if (!confirmLeaveEdit()) return;
		setSelectedDateIndex(index);
		const selectedRecord = treatmentRecords[index];
		const selectedDate = treatmentDates[index];
		const next = hydrateForm(selectedRecord, selectedDate);
		setFormData(next);
		setFormBackup(next);
		setIsEditMode(false);
	};

	// 날짜 형식 변환 함수 (YYYY-MM-DD)
	const formatDateDisplay = (dateStr: string) => formatDateYmd(dateStr);

	const handleEnterEditMode = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (selectedDateIndex === null) {
			alert('수정할 치료일자를 목록에서 선택해 주세요.');
			return;
		}
		setFormBackup({ ...formData });
		setIsEditMode(true);
	};

	const handleCancelEdit = () => {
		if (formBackup) setFormData(formBackup);
		setIsEditMode(false);
		if (selectedDateIndex === null) {
			setFormData(createEmptyForm());
		}
	};

	// 저장 함수
	const handleSave = async () => {
		if (!isEditMode) {
			alert('수정 버튼을 누른 뒤 저장할 수 있습니다.');
			return;
		}
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (!formData.TDT) {
			alert('치료일자를 입력해주세요.');
			return;
		}

		setLoadingRecords(true);
		try {
			const origTdt =
				selectedDateIndex !== null
					? formatDateYmd(formBackup?.TDT || treatmentDates[selectedDateIndex] || formData.TDT)
					: '';
			const response = await fetch('/api/f32020', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					...formData,
					PD_NM: formData.JHEMPNM,
					...(origTdt ? { ORIG_TDT: origTdt } : {}),
				}),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) {
				throw new Error(result?.error || '저장 실패');
			}

			alert(selectedDateIndex !== null ? '물리치료실적이 수정되었습니다.' : '물리치료실적이 저장되었습니다.');
			setIsEditMode(false);
			setFormBackup(null);
			setPrintRows(null);

			if (selectedMember) {
				await fetchTreatmentDates(
					selectedMember.ANCD,
					selectedMember.PNUM,
					formatDateYmd(formData.TDT)
				);
			}
		} catch (err) {
			console.error('물리치료실적 저장 오류:', err);
			alert(err instanceof Error ? err.message : '물리치료실적 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	// 지움 함수
	const handleClear = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (!confirmLeaveEdit()) return;
		const empty = createEmptyForm();
		setFormData(empty);
		setFormBackup(empty);
		setIsEditMode(true);
		setSelectedDateIndex(null);
	};

	const handleDelete = async (index: number) => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		const tdt = formatDateDisplay(treatmentDates[index]);
		if (!tdt) {
			alert('삭제할 치료일자를 선택해주세요.');
			return;
		}
		if (!confirmLeaveEdit()) return;
		if (!confirm(`${tdt} 물리치료실적을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
			return;
		}

		setLoadingRecords(true);
		try {
			const response = await fetch(
				`/api/f32020?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&tdt=${encodeURIComponent(tdt)}`,
				{ method: 'DELETE' }
			);
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) {
				throw new Error(result?.error || '삭제 실패');
			}

			alert('물리치료실적이 삭제되었습니다.');
			setIsEditMode(false);
			setFormBackup(null);
			setPrintRows(null);

			const keepTdt =
				selectedDateIndex !== null && selectedDateIndex !== index
					? formatDateDisplay(treatmentDates[selectedDateIndex])
					: undefined;
			await fetchTreatmentDates(selectedMember.ANCD, selectedMember.PNUM, keepTdt);
			if (!keepTdt) {
				setFormData(createEmptyForm());
				setSelectedDateIndex(null);
			}
		} catch (err) {
			console.error('물리치료실적 삭제 오류:', err);
			alert(err instanceof Error ? err.message : '물리치료실적 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	const toggleMemberChecked = (member: BeneficiaryMember, checked: boolean) => {
		const key = beneficiaryMemberKey(member);
		setCheckedMemberKeys((prev) => {
			const next = new Set(prev);
			if (checked) next.add(key);
			else next.delete(key);
			return next;
		});
		setPrintRows(null);
	};

	const toggleAllFilteredChecked = (checked: boolean, members: BeneficiaryMember[]) => {
		setCheckedMemberKeys((prev) => {
			const next = new Set(prev);
			for (const m of members) {
				const key = beneficiaryMemberKey(m);
				if (checked) next.add(key);
				else next.delete(key);
			}
			return next;
		});
		setPrintRows(null);
	};

	const fetchV32020 = async (pnums: string[], from: string, to: string) => {
		const url = `/api/v32020?startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}&pnums=${encodeURIComponent(pnums.join(','))}`;
		const res = await fetch(url, { cache: 'no-store' });
		const json = await res.json().catch(() => ({}));
		if (!res.ok || !json?.success) {
			throw new Error(json?.error || 'V32020 조회 실패');
		}
		return (Array.isArray(json.data) ? json.data : []) as V32020PrintRow[];
	};

	const handleQueryPrint = async () => {
		if (checkedMemberKeys.size === 0) {
			alert('출력할 수급자를 체크해주세요.');
			return;
		}
		if (!printFrom || !printTo) {
			alert('출력 기간(시작일·종료일)을 설정해주세요.');
			return;
		}
		if (printFrom > printTo) {
			alert('시작일이 종료일보다 늦을 수 없습니다.');
			return;
		}

		const pnums = Array.from(checkedMemberKeys)
			.map((k) => k.split('::')[1] || '')
			.filter(Boolean);
		if (pnums.length === 0) {
			alert('체크된 수급자를 찾을 수 없습니다.');
			return;
		}

		setPrintQuerying(true);
		try {
			const rows = await fetchV32020(pnums, printFrom, printTo);
			setPrintRows(rows);
			if (rows.length === 0) {
				alert('선택한 수급자·기간에 해당하는 물리치료기록이 없습니다.');
				return;
			}
			alert(`${rows.length}건을 조회했습니다. 출력 버튼을 눌러 인쇄하세요.`);
		} catch (err) {
			console.error('V32020 조회 오류:', err);
			alert('물리치료기록 조회 중 오류가 발생했습니다.');
		} finally {
			setPrintQuerying(false);
		}
	};

	const handlePrintQueried = () => {
		if (printRows == null) {
			alert('먼저 조회를 실행해주세요.');
			return;
		}
		if (printRows.length === 0) {
			alert('출력할 물리치료기록이 없습니다.');
			return;
		}
		openPhysicalTherapyRecordPrint(printRows);
	};

	const handlePrintRecord = async () => {
		if (!selectedMember || !formData.TDT) {
			alert('출력할 물리치료실적을 선택해주세요.');
			return;
		}
		setPrintOpening(true);
		try {
			const tdt = formatDateYmd(formData.TDT);
			const rows = await fetchV32020([String(selectedMember.PNUM)], tdt, tdt);
			if (rows.length === 0) {
				alert('출력할 물리치료기록을 찾을 수 없습니다.');
				return;
			}
			openPhysicalTherapyRecordPrint(rows);
		} catch (err) {
			console.error('기록출력 오류:', err);
			alert('기록출력 준비 중 오류가 발생했습니다.');
		} finally {
			setPrintOpening(false);
		}
	};

	// 치료일자 목록 페이지네이션
	const dateTotalPages = Math.ceil(treatmentDates.length / dateItemsPerPage);
	const dateStartIndex = (datePage - 1) * dateItemsPerPage;
	const dateEndIndex = dateStartIndex + dateItemsPerPage;
	const currentDateItems = treatmentDates.slice(dateStartIndex, dateEndIndex);
	const isRightLocked = !loadingRecords && selectedDateIndex === null && !isEditMode;
	const showEmptyDataOverlay = isRightLocked && !!selectedMember && treatmentDates.length === 0;
	const isReadOnly = !isEditMode;

	// 치료 항목 렌더링 함수
	const renderTreatmentItem = (chkKey: string, valKey: string, label: string) => {
		const checked = String((formData as any)[chkKey] ?? '0') === '1';
		const value = String((formData as any)[valKey] ?? '');
		return (
			<div key={`${chkKey}-${valKey}`} className="flex items-center gap-2 py-2 border-b border-blue-100">
				<input
					type="checkbox"
					checked={checked}
					tabIndex={isReadOnly ? -1 : undefined}
					onChange={(e) => {
						if (isReadOnly) return;
						setFormData((prev: any) => ({
							...prev,
							[chkKey]: e.target.checked ? '1' : '0',
						}));
					}}
					className={`w-4 h-4 accent-blue-600 border border-blue-300 rounded ${
						isReadOnly ? 'pointer-events-none' : ''
					}`}
				/>
				<label className="text-sm text-blue-900 flex-1">{label}</label>
				<input
					type="text"
					value={value}
					readOnly={isReadOnly}
					onChange={(e) =>
						setFormData((prev: any) => ({
							...prev,
							[valKey]: e.target.value,
						}))
					}
					className="w-24 px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
					placeholder="횟수/분"
				/>
			</div>
		);
	};

	const equipmentItems = [
		{ chk: 'TCHK01', val: 'TVAL01', label: '자전거' },
		{ chk: 'TCHK02', val: 'TVAL02', label: '탄력밴드운동' },
		{ chk: 'TCHK03', val: 'TVAL03', label: '전신안마기' },
		{ chk: 'TCHK04', val: 'TVAL04', label: 'Pully' },
		{ chk: 'TCHK05', val: 'TVAL05', label: '견관절운동기' },
		{ chk: 'TCHK06', val: 'TVAL06', label: '평행봉걷기' },
		{ chk: 'TCHK07', val: 'TVAL07', label: '러닝머신' },
	];

	const simpleBaseItems = [
		{ chk: 'TCHK08', val: 'TVAL08', label: '발맛사지기' },
		{ chk: 'TCHK09', val: 'TVAL09', label: '틸팅테이블' },
		{ chk: 'TCHK10', val: 'TVAL10', label: '공운동' },
		{ chk: 'TCHK11', val: 'TVAL11', label: '구술꿰기' },
		{ chk: 'TCHK12', val: 'TVAL12', label: '패기보드끼우기' },
	];

	const simpleTherapyItems = [
		{ chk: 'TCHK21', val: 'TVAL21', label: '도수운동' },
		{ chk: 'TCHK22', val: 'TVAL22', label: 'ROM' },
		{ chk: 'TCHK23', val: 'TVAL23', label: '근력운동' },
		{ chk: 'TCHK24', val: 'TVAL24', label: '기능향상운동' },
		{ chk: 'TCHK25', val: 'TVAL25', label: '체중이동/지지' },
		{ chk: 'TCHK26', val: 'TVAL26', label: '보행훈련' },
	];

	const modalityItems = [
		{ chk: 'TCHK31', val: 'TVAL31', label: 'Hot&Cold Pack' },
		{ chk: 'TCHK32', val: 'TVAL32', label: '적외선치료' },
		{ chk: 'TCHK33', val: 'TVAL33', label: '초음파치료' },
		{ chk: 'TCHK34', val: 'TVAL34', label: '경피신경전기자극치료' },
		{ chk: 'TCHK35', val: 'TVAL35', label: '간섭전류치료' },
		{ chk: 'TCHK36', val: 'TVAL36', label: '전기자극치료' },
		{ chk: 'TCHK37', val: 'TVAL37', label: '파라핀치료' },
	];

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				<div className="flex flex-col w-full xl:w-1/4 xl:min-w-[240px] xl:max-w-sm shrink-0 min-w-0 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden border-r border-blue-200">
					<div className="shrink-0 p-3 space-y-2 border-b border-blue-200 bg-blue-50/70">
						<div className="text-xs font-semibold text-blue-900">출력 기간</div>
						<div className="flex items-center gap-1">
							<input
								type="date"
								value={printFrom}
								onChange={(e) => {
									setPrintFrom(e.target.value);
									setPrintRows(null);
								}}
								className="flex-1 min-w-0 px-1 py-1 text-xs bg-white border border-blue-300 rounded"
							/>
							<span className="text-xs text-blue-900 shrink-0">~</span>
							<input
								type="date"
								value={printTo}
								onChange={(e) => {
									setPrintTo(e.target.value);
									setPrintRows(null);
								}}
								className="flex-1 min-w-0 px-1 py-1 text-xs bg-white border border-blue-300 rounded"
							/>
						</div>
						<div className="grid grid-cols-2 gap-1">
							<button
								type="button"
								onClick={() => void handleQueryPrint()}
								disabled={printQuerying || checkedMemberKeys.size === 0}
								className="px-2 py-1.5 text-xs font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{printQuerying ? '조회 중...' : `조회 (${checkedMemberKeys.size}명)`}
							</button>
							<button
								type="button"
								onClick={handlePrintQueried}
								disabled={printQuerying || printRows == null || printRows.length === 0}
								className="px-2 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								출력{printRows ? ` (${printRows.length}건)` : ''}
							</button>
						</div>
					</div>
					<BeneficiaryListPanel
						selectedMember={selectedMember}
						onSelect={handleSelectMember}
						checkedKeys={checkedMemberKeys}
						onToggleCheck={toggleMemberChecked}
						onToggleCheckAll={toggleAllFilteredChecked}
						className="flex-1 min-h-0 !border-r-0"
					/>
				</div>

				{/* 중간-왼쪽 패널: 치료일자 목록 */}
				<div className="flex flex-col w-full xl:w-[240px] min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 max-h-[36vh] xl:max-h-none overflow-hidden">
					<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-blue-200 bg-blue-50">
						<label className="text-sm font-medium text-blue-900">치료일자</label>
						<button
							type="button"
							onClick={handleClear}
							disabled={!selectedMember || loadingRecords}
							className="shrink-0 px-2 py-0.5 text-xs font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto bg-white">
							{loadingRecords ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
							) : treatmentDates.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">
									{selectedMember ? '치료일자가 없습니다' : '수급자를 선택해주세요'}
								</div>
							) : (
								currentDateItems.map((date, localIndex) => {
									const globalIndex = dateStartIndex + localIndex;
									return (
										<div
											key={globalIndex}
											className={`flex items-center gap-1 px-2 py-1.5 text-sm border-b border-blue-50 ${
												selectedDateIndex === globalIndex ? 'bg-blue-100 font-semibold' : ''
											}`}
										>
											<button
												type="button"
												onClick={() => handleSelectDate(globalIndex)}
												className="flex-1 min-w-0 text-left hover:bg-blue-50 rounded px-1 py-0.5"
											>
												{formatDateDisplay(date)}
											</button>
											<button
												type="button"
												onClick={() => void handleDelete(globalIndex)}
												disabled={loadingRecords}
												className="shrink-0 px-1.5 py-0.5 text-xs font-medium text-blue-900 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												삭제
											</button>
										</div>
									);
								})
							)}
						</div>
						{/* 치료일자 페이지네이션 */}
						{dateTotalPages > 1 && (
							<div className="p-2 bg-white border-t border-blue-200">
								<div className="flex items-center justify-center gap-1">
									<button
										onClick={() => setDatePage(1)}
										disabled={datePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										onClick={() => setDatePage(prev => Math.max(1, prev - 1))}
										disabled={datePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;
									</button>
									
									{Array.from({ length: Math.min(5, dateTotalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(dateTotalPages - 4, datePage - 2)) + i;
										if (pageNum > dateTotalPages) return null;
										return (
											<button
												key={pageNum}
												onClick={() => setDatePage(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${
													datePage === pageNum
														? 'bg-blue-500 text-white border-blue-500'
														: 'border-blue-300 hover:bg-blue-50'
												}`}
											>
												{pageNum}
											</button>
										);
									}).filter(Boolean)}
									
									<button
										onClick={() => setDatePage(prev => Math.min(dateTotalPages, prev + 1))}
										disabled={datePage >= dateTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										onClick={() => setDatePage(dateTotalPages)}
										disabled={datePage >= dateTotalPages}
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
				<div className="relative flex-1 p-4 overflow-y-auto bg-white">
					{isRightLocked && (
						<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
							{showEmptyDataOverlay ? (
								<div className="w-[min(520px,90%)] px-4 py-3 text-sm text-blue-900 bg-white border border-blue-200 rounded shadow-sm">
									<div className="font-medium">데이터가 없습니다.</div>
									<div className="mt-2 flex justify-end">
										<button
											type="button"
											onClick={handleClear}
											className="px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-200 border border-blue-300 rounded hover:bg-blue-300"
										>
											신규등록
										</button>
									</div>
								</div>
							) : (
								<div className="px-5 py-3 text-sm font-medium text-blue-900 bg-white border border-blue-200 rounded shadow-sm">
									수급자 선택 후 치료일자를 선택해주세요
								</div>
							)}
						</div>
					)}

					<div
						className={
							isRightLocked ? 'blur-sm select-none pointer-events-none opacity-70' : ''
						}
					>
					<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
						{!isEditMode ? (
							<p className="text-xs text-blue-900/70">읽기모드 · 「수정」을 눌러 내용을 바꿀 수 있습니다.</p>
						) : selectedDateIndex == null ? (
							<p className="text-xs text-green-800">신규 작성모드 · 입력 후 「저장」하세요.</p>
						) : (
							<p className="text-xs text-green-800">수정모드 · 변경 후 「저장」해야 반영됩니다.</p>
						)}
						<div className="flex justify-end gap-2 ml-auto">
							{isEditMode ? (
								<>
									<button
										type="button"
										onClick={() => void handleSave()}
										disabled={loadingRecords || !selectedMember}
										className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-700 rounded hover:bg-green-700 disabled:opacity-50"
									>
										저장
									</button>
									<button
										type="button"
										onClick={handleCancelEdit}
										disabled={loadingRecords}
										className="px-4 py-2 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50"
									>
										취소
									</button>
								</>
							) : (
								<button
									type="button"
									onClick={handleEnterEditMode}
									disabled={!selectedMember || loadingRecords || selectedDateIndex == null}
									className="px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
								>
									수정
								</button>
							)}
							<button
								type="button"
								onClick={() => void handlePrintRecord()}
								disabled={!selectedMember || !formData.TDT || printOpening || isEditMode}
								className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50"
							>
								{printOpening ? '출력 준비 중...' : '해당기록출력'}
							</button>
						</div>
					</div>
					{/* 상단: 수급자, 치료일자, 담당자 */}
					<div className="flex flex-wrap items-center gap-4 mb-4">
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">수급자</label>
							<input
								type="text"
								value={selectedMember?.P_NM || ''}
								readOnly
								className="px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 min-w-[150px]"
								placeholder="수급자를 선택해주세요"
							/>
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">치료일자</label>
							<input
								type="date"
								value={String((formData as any).TDT || '').slice(0, 10)}
								onChange={(e) => setFormData((prev: any) => ({ ...prev, TDT: e.target.value }))}
								disabled={!selectedMember || isReadOnly}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 w-[140px] disabled:bg-gray-50 disabled:border-blue-200"
							/>
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">물리치료시간</label>
							<input
								type="time"
								value={toTimeInput((formData as any).T_SRT_TM)}
								onChange={(e) => setFormData((prev: any) => ({ ...prev, T_SRT_TM: e.target.value }))}
								disabled={isReadOnly}
								className="px-2 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
							/>
							<span className="text-sm text-blue-900">~</span>
							<input
								type="time"
								value={toTimeInput((formData as any).T_END_TM)}
								onChange={(e) => setFormData((prev: any) => ({ ...prev, T_END_TM: e.target.value }))}
								disabled={isReadOnly}
								className="px-2 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
							/>
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">담당자</label>
							<EmployeeSearchInput
								value={String((formData as any).JHEMPNM ?? '')}
								onChange={(name, empno) =>
									setFormData((prev: any) => ({
										...prev,
										JHEMPNM: name,
										JHEMP: empno != null ? String(empno) : '',
									}))
								}
								disabled={isReadOnly}
								placeholder="이름 검색 후 선택"
								className="min-w-[160px]"
								inputClassName="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 min-w-[160px] w-full disabled:bg-gray-50 disabled:border-blue-200"
							/>
						</div>
						{selectedMember && (
							<div className="text-sm text-blue-900/80">
								<span className="mr-3">등급: {formatCareGradeLabel(selectedMember.P_GRD)}</span>
								<span className="mr-3">성별: {selectedMember.P_SEX === '1' ? '남' : selectedMember.P_SEX === '2' ? '여' : '-'}</span>
								<span className="mr-3">나이: {calculateAge((selectedMember as any).P_BRDT)}</span>
								<span>
									층: {extractFloorFromRoomNo((selectedMember as any).ROOM_NO) !== null ? `${extractFloorFromRoomNo((selectedMember as any).ROOM_NO)}층` : '-'}
								</span>
							</div>
						)}
					</div>

					{/* 메인 컨텐츠: 4개 컬럼 */}
					<div className="flex gap-4 mb-4">
						{/* Column 1: 운동치료 - 기구이용 */}
						<div className="flex-1 border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-4 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">운동치료 - 기구이용</h3>
							</div>
							<div className="space-y-1">
								{equipmentItems.map((it) => renderTreatmentItem(it.chk, it.val, it.label))}
							</div>
						</div>

						{/* Column 2: 운동치료 - 단순운동 */}
						<div className="flex-1 border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-4 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">운동치료 - 단순운동</h3>
							</div>
							<div className="space-y-1">
								{simpleBaseItems.map((it) => renderTreatmentItem(it.chk, it.val, it.label))}
							</div>
							<div className="mt-3">
								<div className="text-xs text-blue-900/80 mb-1">특이사항및변경사유(운동치료)</div>
								<textarea
									value={String((formData as any).TTEXT_1 ?? '')}
									onChange={(e) => setFormData((prev: any) => ({ ...prev, TTEXT_1: e.target.value }))}
									readOnly={isReadOnly}
									className="w-full min-h-[72px] px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
									placeholder="미실시 사유를 입력하세요"
								/>
							</div>
						</div>

						{/* Column 3: 단순운동(치료/훈련) */}
						<div className="flex-1 border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-4 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">단순운동(치료/훈련)</h3>
							</div>
							<div className="space-y-1">
								{simpleTherapyItems.map((it) => renderTreatmentItem(it.chk, it.val, it.label))}
							</div>
							<div className="mt-3">
								<div className="text-xs text-blue-900/80 mb-1">특이사항및변경사유(단순운동-치료/훈련)</div>
								<textarea
									value={String((formData as any).TTEXT_2 ?? '')}
									onChange={(e) => setFormData((prev: any) => ({ ...prev, TTEXT_2: e.target.value }))}
									readOnly={isReadOnly}
									className="w-full min-h-[60px] px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
								/>
							</div>
						</div>

						{/* Column 4: Modalities (기존 기타 위치) */}
						<div className="flex-1 border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-4 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">Modalities</h3>
							</div>
							<div className="space-y-1">
								{modalityItems.map((it) => renderTreatmentItem(it.chk, it.val, it.label))}
							</div>
							<div className="mt-3">
								<div className="text-xs text-blue-900/80 mb-1">특이사항및변경사유(Modalities)</div>
								<textarea
									value={String((formData as any).TTEXT_3 ?? '')}
									onChange={(e) => setFormData((prev: any) => ({ ...prev, TTEXT_3: e.target.value }))}
									readOnly={isReadOnly}
									className="w-full min-h-[60px] px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
								/>
							</div>
						</div>
					</div>

					{/* 하단: 기타 (가로 널찍하게) */}
					<div className="border border-blue-300 rounded-lg p-4 bg-white mb-6">
						<div className="mb-4 pb-2 border-b border-blue-200 flex items-center justify-between">
							<h3 className="text-base font-semibold text-blue-900">기타</h3>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								{[1, 2, 3].map((n) => (
									<div key={n} className="flex items-center gap-2 py-1.5 border-b border-blue-100">
										<input
											type="text"
											value={String((formData as any)[`TETC_${n}`] ?? '')}
											onChange={(e) => setFormData((prev: any) => ({ ...prev, [`TETC_${n}`]: e.target.value }))}
											readOnly={isReadOnly}
											className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
											placeholder={`기타치료 ${n}`}
										/>
										<input
											type="text"
											value={String((formData as any)[`TETCVAL_${n}`] ?? '')}
											onChange={(e) => setFormData((prev: any) => ({ ...prev, [`TETCVAL_${n}`]: e.target.value }))}
											readOnly={isReadOnly}
											className="w-28 px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
											placeholder="시간/횟수"
										/>
									</div>
								))}
							</div>
							<div className="space-y-2">
								{[4, 5].map((n) => (
									<div key={n} className="flex items-center gap-2 py-1.5 border-b border-blue-100">
										<input
											type="text"
											value={String((formData as any)[`TETC_${n}`] ?? '')}
											onChange={(e) => setFormData((prev: any) => ({ ...prev, [`TETC_${n}`]: e.target.value }))}
											readOnly={isReadOnly}
											className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
											placeholder={`기타치료 ${n}`}
										/>
										<input
											type="text"
											value={String((formData as any)[`TETCVAL_${n}`] ?? '')}
											onChange={(e) => setFormData((prev: any) => ({ ...prev, [`TETCVAL_${n}`]: e.target.value }))}
											readOnly={isReadOnly}
											className="w-28 px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
											placeholder="시간/횟수"
										/>
									</div>
								))}
								<div className="mt-2">
									<div className="text-xs text-blue-900/80 mb-1">특이사항및변경사유(기타치료)</div>
									<textarea
										value={String((formData as any).TTEXT_4 ?? '')}
										onChange={(e) => setFormData((prev: any) => ({ ...prev, TTEXT_4: e.target.value }))}
										readOnly={isReadOnly}
										className="w-full min-h-[60px] px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
									/>
								</div>
								<div>
									<div className="text-xs text-blue-900/80 mb-1">비고</div>
									<textarea
										value={String((formData as any).ETC ?? '')}
										onChange={(e) => setFormData((prev: any) => ({ ...prev, ETC: e.target.value }))}
										readOnly={isReadOnly}
										className="w-full min-h-[72px] px-2 py-1 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 read-only:bg-gray-50"
									/>
								</div>
							</div>
						</div>
					</div>

					</div>
				</div>
			</div>
		</div>
	);
}


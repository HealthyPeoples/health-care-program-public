"use client";

/**
 * @file 물리치료계획평가 — 화면 컴포넌트 (PhysicalTherapyPlanEvaluation.tsx)
 *
 * @description
 * 요양원 물리치료계획평가 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/physical-therapy-plan-evaluation
 *
 * @module component/nursing-home/pages/physical-therapy-plan-evaluation/PhysicalTherapyPlanEvaluation
 */
import React, { useMemo, useState } from 'react';
import BeneficiaryListPanel, { BeneficiaryMember, beneficiaryMemberKey } from '../../components/BeneficiaryListPanel';
import { EmployeeSearchInput } from '../../components/EmployeeSearchInput';
import { formatDateYmd } from '../../utils/excretionObservationFields';
import {
	buildPlanPrintRowFromScreen,
	openPhysicalTherapyPlanPrint,
	type V32010PrintRow,
} from './physicalTherapyPlanEvaluationPrint';

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

type PlanRecordData = {
	SDT: string;
	EDT: string;
	JHEMP?: number | string | null;
	JHEMPNM?: string | null;
	PD_NM?: string | null;
} & Record<string, unknown>;

type PlanForm = {
	SDT: string;
	EDT: string;
	JHEMP: string;
	JHEMPNM: string;
	P_DIAG: string;
	P_PROBLEM: string;
	P_WAY: string;
	P_PLAN: string;
	P_JUDGE: string;
	P_TEXT_CNT: string;
	PETC_1: string;
	PETC_2: string;
	PETC_3: string;
	PETC_4: string;
	PETC_5: string;
	ETC: string;
	[key: string]: string;
};

export default function PhysicalTherapyPlanEvaluation() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);

	const [showDevNotice, setShowDevNotice] = useState(false);

	const [planRecords, setPlanRecords] = useState<PlanRecordData[]>([]);
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);
	const [isEditMode, setIsEditMode] = useState(false);
	const [formBackup, setFormBackup] = useState<PlanForm | null>(null);
	const [printFrom, setPrintFrom] = useState(monthStartYmd);
	const [printTo, setPrintTo] = useState(todayYmd);
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(() => new Set());
	const [printRows, setPrintRows] = useState<V32010PrintRow[] | null>(null);
	const [printQuerying, setPrintQuerying] = useState(false);
	const [printOpening, setPrintOpening] = useState(false);

	const formatDateDisplay = (dateStr: string) => formatDateYmd(dateStr);

	const createEmptyForm = (sdt?: string, edt?: string) => ({
		SDT: sdt || todayYmd(),
		EDT: edt || todayYmd(),
		JHEMP: '',
		JHEMPNM: '',
		P_DIAG: '',
		P_PROBLEM: '',
		P_WAY: '',
		P_PLAN: '',
		P_JUDGE: '',
		P_TEXT_CNT: '',
		...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`PSTD${String(i + 1).padStart(2, '0')}`, '0'])),
		...Object.fromEntries(Array.from({ length: 37 }, (_, i) => [`PCHK${String(i + 1).padStart(2, '0')}`, '0'])),
		PETC_1: '',
		PETC_2: '',
		PETC_3: '',
		PETC_4: '',
		PETC_5: '',
		ETC: '',
	});

	const [formData, setFormData] = useState<PlanForm>(() => createEmptyForm() as PlanForm);

	const hydrateForm = (row: PlanRecordData | undefined): PlanForm => {
		const next: PlanForm = { ...(createEmptyForm() as PlanForm) };
		if (!row) return next;
		const rowMap = row as Record<string, unknown>;
		Object.keys(next).forEach((k) => {
			if (Object.prototype.hasOwnProperty.call(rowMap, k)) next[k] = String(rowMap[k] ?? '');
		});
		Object.keys(rowMap).forEach((k) => {
			if (k in next || /^P(STD|CHK)\d{2}$/.test(k)) next[k] = String(rowMap[k] ?? '');
		});
		next.JHEMP = String(rowMap.JHEMP ?? '');
		next.JHEMPNM = String(rowMap.JHEMPNM ?? rowMap.PD_NM ?? '').trim();
		next.SDT = formatDateDisplay(row.SDT);
		next.EDT = formatDateDisplay(row.EDT);
		return next;
	};

	const fetchPlans = async (pnum: string, keepSdt?: string, keepEdt?: string) => {
		if (!pnum) {
			setPlanRecords([]);
			return;
		}
		setLoadingRecords(true);
		try {
			const response = await fetch(`/api/f32010?pnum=${encodeURIComponent(pnum)}`, { cache: 'no-store' });
			const result = await response.json();
			if (result.success) {
				const list: PlanRecordData[] = result.data || [];
				setPlanRecords(list);
				if (keepSdt && keepEdt) {
					const idx = list.findIndex(
						(r) => formatDateDisplay(r.SDT) === keepSdt && formatDateDisplay(r.EDT) === keepEdt
					);
					setSelectedPlanIndex(idx >= 0 ? idx : null);
					if (idx >= 0) {
						const next = hydrateForm(list[idx]);
						setFormData(next);
						setFormBackup(next);
					}
				} else {
					setSelectedPlanIndex(null);
				}
			} else {
				setPlanRecords([]);
			}
		} catch (err) {
			console.error('계획 목록 조회 오류:', err);
		} finally {
			setLoadingRecords(false);
		}
	};

	const confirmLeaveEdit = () => {
		if (!isEditMode) return true;
		return confirm('수정 중인 내용이 저장되지 않습니다. 이동할까요?');
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		if (!confirmLeaveEdit()) return;
		setSelectedMember(member);
		setFormData(createEmptyForm());
		setFormBackup(null);
		setSelectedPlanIndex(null);
		setIsEditMode(false);
		setPrintRows(null);
		fetchPlans(String(member.PNUM));
	};

	const handleSelectPlan = (idx: number) => {
		if (!confirmLeaveEdit()) return;
		setSelectedPlanIndex(idx);
		setIsEditMode(false);
		const next = hydrateForm(planRecords[idx]);
		setFormData(next);
		setFormBackup(next);
	};

	const handleNewPlan = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (!confirmLeaveEdit()) return;
		const empty = createEmptyForm() as PlanForm;
		setSelectedPlanIndex(null);
		setIsEditMode(true);
		setFormData(empty);
		setFormBackup(empty);
	};

	const handleEnterEditMode = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (selectedPlanIndex === null) {
			alert('수정할 계획을 목록에서 선택해 주세요.');
			return;
		}
		setFormBackup({ ...formData });
		setIsEditMode(true);
	};

	const handleCancelEdit = () => {
		if (formBackup) setFormData(formBackup);
		setIsEditMode(false);
		if (selectedPlanIndex === null) {
			setFormData(createEmptyForm() as PlanForm);
		}
	};

	const handleSave = async () => {
		if (!isEditMode) {
			alert('수정 버튼을 누른 뒤 저장할 수 있습니다.');
			return;
		}
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (!formData.SDT || !formData.EDT) {
			alert('계획 시작일자/종료일자를 입력해주세요.');
			return;
		}
		setLoadingRecords(true);
		try {
			const origSdt =
				selectedPlanIndex !== null
					? formatDateDisplay(formBackup?.SDT || planRecords[selectedPlanIndex]?.SDT || formData.SDT)
					: '';
			const origEdt =
				selectedPlanIndex !== null
					? formatDateDisplay(formBackup?.EDT || planRecords[selectedPlanIndex]?.EDT || formData.EDT)
					: '';
			const response = await fetch('/api/f32010', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					...formData,
					JHEMP: formData.JHEMP,
					PD_NM: formData.JHEMPNM,
					JHEMPNM: formData.JHEMPNM,
					...(origSdt && origEdt ? { ORIG_SDT: origSdt, ORIG_EDT: origEdt } : {}),
				}),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) throw new Error(result?.error || result?.details || '저장 실패');

			alert(selectedPlanIndex !== null ? '물리치료계획이 수정되었습니다.' : '물리치료계획이 저장되었습니다.');
			setIsEditMode(false);
			setFormBackup(null);
			setPrintRows(null);
			await fetchPlans(selectedMember.PNUM, formatDateDisplay(formData.SDT), formatDateDisplay(formData.EDT));
		} catch (err) {
			console.error('물리치료계획 저장 오류:', err);
			const msg = err instanceof Error && err.message ? err.message : '';
			alert(msg ? `물리치료계획 저장 중 오류가 발생했습니다.\n${msg}` : '물리치료계획 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	const handleDelete = async (index: number) => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		const row = planRecords[index];
		if (!row) {
			alert('삭제할 계획을 선택해주세요.');
			return;
		}
		if (!confirmLeaveEdit()) return;
		const sdt = formatDateDisplay(row.SDT);
		const edt = formatDateDisplay(row.EDT);
		if (!confirm(`${sdt} ~ ${edt} 계획을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

		setLoadingRecords(true);
		try {
			const response = await fetch(
				`/api/f32010?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&sdt=${encodeURIComponent(sdt)}&edt=${encodeURIComponent(edt)}`,
				{ method: 'DELETE' }
			);
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) throw new Error(result?.error || '삭제 실패');

			alert('물리치료계획이 삭제되었습니다.');
			setIsEditMode(false);
			setFormBackup(null);
			setPrintRows(null);
			const keep =
				selectedPlanIndex !== null && selectedPlanIndex !== index
					? {
							sdt: formatDateDisplay(planRecords[selectedPlanIndex].SDT),
							edt: formatDateDisplay(planRecords[selectedPlanIndex].EDT),
						}
					: null;
			await fetchPlans(selectedMember.PNUM, keep?.sdt, keep?.edt);
			if (!keep) {
				setFormData(createEmptyForm() as PlanForm);
				setSelectedPlanIndex(null);
			}
		} catch (err) {
			console.error('물리치료계획 삭제 오류:', err);
			alert(err instanceof Error ? err.message : '물리치료계획 삭제 중 오류가 발생했습니다.');
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

	const fetchV32010 = async (pnums: string[], from: string, to: string, exact?: { sdt: string; edt: string }) => {
		const qs = exact
			? `pnum=${encodeURIComponent(pnums[0] || '')}&sdt=${encodeURIComponent(exact.sdt)}&edt=${encodeURIComponent(exact.edt)}`
			: `startDate=${encodeURIComponent(from)}&endDate=${encodeURIComponent(to)}&pnums=${encodeURIComponent(pnums.join(','))}`;
		const res = await fetch(`/api/v32010?${qs}`, { cache: 'no-store' });
		const json = await res.json().catch(() => ({}));
		if (!res.ok || !json?.success) {
			throw new Error(json?.error || 'V32010 조회 실패');
		}
		return (Array.isArray(json.data) ? json.data : []) as V32010PrintRow[];
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
			const rows = await fetchV32010(pnums, printFrom, printTo);
			setPrintRows(rows);
			if (rows.length === 0) {
				alert('선택한 수급자·기간에 해당하는 물리치료 계획이 없습니다.');
				return;
			}
			alert(`${rows.length}건을 조회했습니다. 출력 버튼을 눌러 인쇄하세요.`);
		} catch (err) {
			console.error('V32010 조회 오류:', err);
			alert('물리치료 계획 조회 중 오류가 발생했습니다.');
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
			alert('출력할 물리치료 계획이 없습니다.');
			return;
		}
		openPhysicalTherapyPlanPrint(printRows);
	};

	const handlePrintRecord = async () => {
		if (!selectedMember) {
			alert('출력할 화면의 수급자가 없습니다.');
			return;
		}
		setPrintOpening(true);
		try {
			let facilityCode = '';
			let facilityName = '';
			try {
				const res = await fetch('/api/f00110', { cache: 'no-store' });
				const json = await res.json().catch(() => ({}));
				const row = Array.isArray(json?.data) ? json.data[0] : json?.data;
				if (row && typeof row === 'object') {
					facilityCode = String((row as Record<string, unknown>).ANGH ?? '');
					facilityName = String((row as Record<string, unknown>).ANNM ?? '');
				}
			} catch {
				/* 기관정보는 없어도 화면 내용은 출력 */
			}
			openPhysicalTherapyPlanPrint([
				buildPlanPrintRowFromScreen({
					member: selectedMember,
					form: formData,
					facilityCode,
					facilityName,
				}),
			]);
		} finally {
			setPrintOpening(false);
		}
	};

	const toggleKey = (k: string) => {
		if (!isEditMode) return;
		setFormData((prev) => ({ ...prev, [k]: String(prev[k]) === '1' ? '0' : '1' }));
	};

	const isReadOnly = !isEditMode;

	const renderChk = (key: string, label: string) => (
		<label className={`flex items-center justify-between gap-2 px-2 py-1.5 h-full min-h-[34px] text-sm text-blue-900 select-none ${isReadOnly ? '' : 'cursor-pointer'}`}>
			<span className="leading-tight">{label}</span>
			<input
				type="checkbox"
				checked={String(formData[key] ?? '0') === '1'}
				tabIndex={isReadOnly ? -1 : undefined}
				onChange={() => toggleKey(key)}
				className={`w-4 h-4 shrink-0 accent-blue-600 ${isReadOnly ? 'pointer-events-none' : ''}`}
			/>
		</label>
	);

	const renderSiteRow = (from: number, to: number) => (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1">
			{Array.from({ length: to - from + 1 }, (_, i) => {
				const n = from + i;
				const key = `PSTD${String(n).padStart(2, '0')}`;
				return (
					<label key={key} className={`inline-flex items-center gap-1 text-sm text-blue-900 select-none ${isReadOnly ? '' : 'cursor-pointer'}`}>
						<span>{n}</span>
						<input
							type="checkbox"
							checked={String(formData[key] ?? '0') === '1'}
							tabIndex={isReadOnly ? -1 : undefined}
							onChange={() => toggleKey(key)}
							className={`w-4 h-4 accent-blue-600 ${isReadOnly ? 'pointer-events-none' : ''}`}
						/>
					</label>
				);
			})}
		</div>
	);

	const equipmentLeft = useMemo(
		() => [
			{ key: 'PCHK01', label: '자전거' },
			{ key: 'PCHK02', label: '탄력밴드운동' },
			{ key: 'PCHK03', label: '전신안마기' },
			{ key: 'PCHK04', label: 'Pully' },
			{ key: 'PCHK05', label: '견관절운동기' },
			{ key: 'PCHK06', label: '평행봉걷기' },
		],
		[]
	);
	const equipmentRight = useMemo(
		() => [
			{ key: 'PCHK07', label: '러닝머신' },
			{ key: 'PCHK08', label: '발맛사지기' },
			{ key: 'PCHK09', label: '틸팅테이블' },
			{ key: 'PCHK10', label: '공운동' },
			{ key: 'PCHK11', label: '구슬꿰기' },
			{ key: 'PCHK12', label: '패기보드끼우기' },
		],
		[]
	);
	const simpleItems = useMemo(
		() => [
			{ key: 'PCHK21', label: '도수운동' },
			{ key: 'PCHK22', label: 'ROM' },
			{ key: 'PCHK23', label: '근력운동' },
			{ key: 'PCHK24', label: '기능향상운동' },
			{ key: 'PCHK25', label: '체중이동/지지훈련' },
			{ key: 'PCHK26', label: '보행훈련' },
		],
		[]
	);
	const modalityItems = useMemo(
		() => [
			{ key: 'PCHK31', label: 'Hot&Cold Pack' },
			{ key: 'PCHK32', label: '적외선치료' },
			{ key: 'PCHK33', label: '초음파치료' },
			{ key: 'PCHK34', label: '경피신경전기자극치료' },
			{ key: 'PCHK35', label: '간섭전류치료' },
			{ key: 'PCHK36', label: '전기자극치료' },
			{ key: 'PCHK37', label: '파라핀치료' },
		],
		[]
	);

	const isRightLocked = !loadingRecords && selectedPlanIndex === null && !isEditMode;
	const showEmptyDataOverlay = isRightLocked && !!selectedMember && planRecords.length === 0;

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

				{/* 중간 패널: 계획기간 목록 */}
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="px-3 py-2 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
						<label className="text-sm font-medium text-blue-900">계획기간</label>
						<button
							onClick={handleNewPlan}
							disabled={!selectedMember}
							className="px-2 py-1 text-xs border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto bg-white">
							{loadingRecords ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
							) : planRecords.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">{selectedMember ? '등록된 계획이 없습니다' : '수급자를 선택해주세요'}</div>
							) : (
								planRecords.map((r, idx) => (
									<div
										key={`${r.SDT}-${r.EDT}-${idx}`}
										className={`flex items-center gap-1 px-2 py-1.5 text-sm border-b border-blue-50 ${
											selectedPlanIndex === idx ? 'bg-blue-100 font-semibold' : ''
										}`}
									>
										<button
											type="button"
											onClick={() => handleSelectPlan(idx)}
											className="flex-1 min-w-0 text-left hover:bg-blue-50 rounded px-1 py-0.5"
										>
											<div>{formatDateDisplay(r.SDT)} ~ {formatDateDisplay(r.EDT)}</div>
											<div className="text-xs font-normal text-blue-900/70 mt-0.5">
												담당자: {String(r.JHEMPNM || r.PD_NM || '').trim() || '-'}
											</div>
										</button>
										<button
											type="button"
											onClick={() => void handleDelete(idx)}
											disabled={loadingRecords}
											className="shrink-0 px-1.5 py-0.5 text-xs font-medium text-blue-900 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											삭제
										</button>
									</div>
								))
							)}
						</div>
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
											onClick={handleNewPlan}
											className="px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-200 border border-blue-300 rounded hover:bg-blue-300"
										>
											신규등록
										</button>
									</div>
								</div>
							) : (
								<div className="px-5 py-3 text-sm font-medium text-blue-900 bg-white border border-blue-200 rounded shadow-sm">
									수급자 선택 후 계획기간을 선택해주세요
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
						) : selectedPlanIndex == null ? (
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
									disabled={!selectedMember || loadingRecords || selectedPlanIndex == null}
									className="px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
								>
									수정
								</button>
							)}
							<button
								type="button"
								onClick={() => void handlePrintRecord()}
								disabled={!selectedMember || printOpening}
								className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50"
							>
								{printOpening ? '출력 준비 중...' : '해당기록출력'}
							</button>
						</div>
					</div>
					<div className="w-full border border-blue-300 bg-white text-blue-900">
						<table className="w-full border-collapse table-fixed text-sm">
							<colgroup>
								<col className="w-[12%]" />
								<col className="w-[21%]" />
								<col className="w-[12%]" />
								<col className="w-[21%]" />
								<col className="w-[14%]" />
								<col className="w-[20%]" />
							</colgroup>
							<tbody>
								<tr>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">계획시작일</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="date"
											value={String(formData.SDT || '').slice(0, 10)}
											onChange={(e) => setFormData((prev) => ({ ...prev, SDT: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">계획종료일</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="date"
											value={String(formData.EDT || '').slice(0, 10)}
											onChange={(e) => setFormData((prev) => ({ ...prev, EDT: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">급여제공횟수</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="text"
											value={String(formData.P_TEXT_CNT ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, P_TEXT_CNT: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
								</tr>
							</tbody>
						</table>

						<table className="w-full border-collapse table-fixed text-sm -mt-px">
							<colgroup>
								<col className="w-[12%]" />
								<col className="w-[12%]" />
								<col />
							</colgroup>
							<tbody>
								<tr>
									<th
										rowSpan={5}
										className="bg-blue-100 border border-blue-300 px-1 py-2 font-medium whitespace-pre-line leading-5"
									>
										{'신체 영역\n및\n재활 영역'}
									</th>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">문제점</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="text"
											value={String(formData.P_PROBLEM ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, P_PROBLEM: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
								</tr>
								<tr>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">제공방법</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="text"
											value={String(formData.P_WAY ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, P_WAY: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
								</tr>
								<tr>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">진단명</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="text"
											value={String(formData.P_DIAG ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, P_DIAG: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
								</tr>
								<tr>
									<th
										rowSpan={2}
										className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap"
									>
										치료부위
									</th>
									<td className="border border-blue-300">{renderSiteRow(1, 10)}</td>
								</tr>
								<tr>
									<td className="border border-blue-300">{renderSiteRow(11, 20)}</td>
								</tr>
								<tr>
									<th
										rowSpan={2}
										className="bg-blue-100 border border-blue-300 px-1 py-2 font-medium whitespace-pre-line leading-5"
									>
										{'목표\n및\n평가'}
									</th>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">목표</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="text"
											value={String(formData.P_PLAN ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, P_PLAN: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
								</tr>
								<tr>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium whitespace-nowrap">평가</th>
									<td className="border border-blue-300 px-1 py-0.5">
										<input
											type="text"
											value={String(formData.P_JUDGE ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, P_JUDGE: e.target.value }))}
											disabled={isReadOnly}
											className="w-full px-2 py-1 text-sm bg-transparent border-0 focus:outline-none disabled:bg-gray-50"
										/>
									</td>
								</tr>
							</tbody>
						</table>

						<table className="w-full border-collapse table-fixed text-sm -mt-px">
							<colgroup>
								<col className="w-[25%]" />
								<col className="w-[25%]" />
								<col className="w-[25%]" />
								<col className="w-[25%]" />
							</colgroup>
							<thead>
								<tr>
									<th colSpan={2} className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium">
										운동치료 - 기구이용
									</th>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium">운동치료 - 단순운동</th>
									<th className="bg-blue-100 border border-blue-300 px-2 py-1.5 font-medium">Modalities</th>
								</tr>
							</thead>
							<tbody>
								{Array.from({ length: 7 }, (_, i) => (
									<tr key={i}>
										<td className="border border-blue-300 p-0">
											{equipmentLeft[i] ? renderChk(equipmentLeft[i].key, equipmentLeft[i].label) : null}
										</td>
										<td className="border border-blue-300 p-0">
											{equipmentRight[i] ? renderChk(equipmentRight[i].key, equipmentRight[i].label) : null}
										</td>
										<td className="border border-blue-300 p-0">
											{simpleItems[i] ? renderChk(simpleItems[i].key, simpleItems[i].label) : null}
										</td>
										<td className="border border-blue-300 p-0">
											{modalityItems[i] ? renderChk(modalityItems[i].key, modalityItems[i].label) : null}
										</td>
									</tr>
								))}
							</tbody>
						</table>

						<div className="flex items-stretch -mt-px border-t border-blue-300">
							<div className="flex items-center bg-blue-100 border-r border-blue-300 px-3 text-sm font-medium whitespace-nowrap">
								치료자
							</div>
							<div className="flex items-center px-2 py-1 flex-1 min-w-0">
								<EmployeeSearchInput
									value={String(formData.JHEMPNM ?? '')}
									onChange={(name, empno) =>
										setFormData((prev) => ({
											...prev,
											JHEMPNM: name,
											JHEMP: empno != null ? String(empno) : '',
										}))
									}
									disabled={isReadOnly}
									placeholder="이름 검색"
									className="w-full max-w-[240px]"
									inputClassName="w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none disabled:bg-gray-50"
								/>
							</div>
						</div>
					</div>
					</div>
				</div>
			</div>

			{showDevNotice && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-[520px] rounded-xl border border-blue-200 bg-white shadow-xl">
							<div className="px-5 py-4 border-b border-blue-100">
								<div className="text-base font-semibold text-blue-900">안내</div>
							</div>
							<div className="px-5 py-4 text-sm text-blue-900 whitespace-pre-line">
								물리치료 계획 및 평가 등록 페이지는 개발중입니다.
								{'\n'}
								(기존 프로그램에서 계획 및 평가 페이지 확인 못함)
							</div>
							<div className="px-5 py-4 border-t border-blue-100 flex justify-end">
								<button
									type="button"
									onClick={() => setShowDevNotice(false)}
									className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
								>
									확인
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


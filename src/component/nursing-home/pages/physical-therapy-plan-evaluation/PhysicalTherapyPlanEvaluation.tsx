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
import { formatCareGradeLabel } from '../../utils/careGrade';
import BeneficiaryListPanel, { BeneficiaryMember } from '../../components/BeneficiaryListPanel';
import { EmployeeSearchInput } from '../../components/EmployeeSearchInput';
import { formatDateYmd } from '../../utils/excretionObservationFields';

interface MemberData {
	ANCD: string;
	PNUM: string;
	P_NM: string;
	P_SEX: string;
	P_GRD: string;
	P_BRDT: string;
	P_ST: string;
	P_FLOOR?: string | number | null;
	[key: string]: unknown;
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
	const [isNewMode, setIsNewMode] = useState(false);

	const extractFloorFromRoomNo = (roomNo: unknown): number | null => {
		const s = String(roomNo ?? '').trim();
		if (!s) return null;
		const digits = s.replace(/\D/g, '');
		if (!digits) return null;
		const n = parseInt(digits, 10);
		if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return null;
		return Math.floor(n / 100);
	};

	const calculateAge = (birthDate: string) => {
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

	const formatDateDisplay = (dateStr: string) => formatDateYmd(dateStr);

	const createEmptyForm = (sdt?: string, edt?: string) => ({
		SDT: sdt || new Date().toISOString().slice(0, 10),
		EDT: edt || new Date().toISOString().slice(0, 10),
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

	const fetchPlans = async (pnum: string) => {
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
				setSelectedPlanIndex(null);
				setIsNewMode(false);
			} else {
				setPlanRecords([]);
			}
		} catch (err) {
			console.error('계획 목록 조회 오류:', err);
		} finally {
			setLoadingRecords(false);
		}
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		setSelectedMember(member);
		setFormData(createEmptyForm());
		setSelectedPlanIndex(null);
		setIsNewMode(false);
		fetchPlans(String(member.PNUM));
	};

	const handleSelectPlan = (idx: number) => {
		setSelectedPlanIndex(idx);
		setIsNewMode(false);
		const row = planRecords[idx];
		if (!row) return;
		const rowMap = row as Record<string, unknown>;
		const next: PlanForm = { ...(createEmptyForm() as PlanForm) };
		Object.keys(next).forEach((k) => {
			// keep defaults for unknown keys
			if (Object.prototype.hasOwnProperty.call(rowMap, k)) next[k] = String(rowMap[k] ?? '');
		});
		// row may have extra keys (PSTD/PCHK). copy them too
		Object.keys(rowMap).forEach((k) => {
			if (k in next || /^P(STD|CHK)\d{2}$/.test(k)) next[k] = String(rowMap[k] ?? '');
		});
		next.JHEMP = String(rowMap.JHEMP ?? '');
		next.JHEMPNM = String(rowMap.JHEMPNM ?? rowMap.PD_NM ?? '').trim();
		next.SDT = formatDateDisplay(row.SDT);
		next.EDT = formatDateDisplay(row.EDT);
		setFormData(next);
	};

	const handleNewPlan = () => {
		setSelectedPlanIndex(null);
		setIsNewMode(true);
		setFormData(createEmptyForm());
	};

	const handleSave = async () => {
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
			const response = await fetch('/api/f32010', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					...formData,
					JHEMP: formData.JHEMP,
					PD_NM: formData.JHEMPNM,
					JHEMPNM: formData.JHEMPNM,
				}),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) throw new Error(result?.error || result?.details || '저장 실패');

			alert(selectedPlanIndex !== null ? '물리치료계획이 수정되었습니다.' : '물리치료계획이 저장되었습니다.');
			await fetchPlans(selectedMember.PNUM);
		} catch (err) {
			console.error('물리치료계획 저장 오류:', err);
			const msg = err instanceof Error && err.message ? err.message : '';
			alert(msg ? `물리치료계획 저장 중 오류가 발생했습니다.\n${msg}` : '물리치료계획 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (selectedPlanIndex === null) {
			alert('삭제할 계획을 선택해주세요.');
			return;
		}
		if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

		const row = planRecords[selectedPlanIndex];
		if (!row) return;

		setLoadingRecords(true);
		try {
			const response = await fetch(
				`/api/f32010?pnum=${encodeURIComponent(selectedMember.PNUM)}&sdt=${encodeURIComponent(
					formatDateDisplay(row.SDT)
				)}&edt=${encodeURIComponent(formatDateDisplay(row.EDT))}`,
				{ method: 'DELETE' }
			);
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) throw new Error(result?.error || '삭제 실패');

			alert('물리치료계획이 삭제되었습니다.');
			await fetchPlans(selectedMember.PNUM);
			handleNewPlan();
		} catch (err) {
			console.error('물리치료계획 삭제 오류:', err);
			alert('물리치료계획 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingRecords(false);
		}
	};

	const toggleKey = (k: string) => {
		setFormData((prev) => ({ ...prev, [k]: String(prev[k]) === '1' ? '0' : '1' }));
	};

	const goalItems = useMemo(
		() =>
			Array.from({ length: 20 }, (_, i) => ({
				key: `PSTD${String(i + 1).padStart(2, '0')}`,
				label: `치료목표-${String(i + 1).padStart(2, '0')}`,
			})),
		[]
	);

	const planItems = useMemo(
		() => [
			// 기구이용 01~12 (이미지와 동일 라벨 기준)
			{ key: 'PCHK01', label: '자전거' },
			{ key: 'PCHK02', label: '탄력밴드운동' },
			{ key: 'PCHK03', label: '전신안마기' },
			{ key: 'PCHK04', label: 'Pully' },
			{ key: 'PCHK05', label: '견관절운동기' },
			{ key: 'PCHK06', label: '평행봉걷기' },
			{ key: 'PCHK07', label: '런닝머신' },
			{ key: 'PCHK08', label: '발맛사지기' },
			{ key: 'PCHK09', label: '틸팅테이블' },
			{ key: 'PCHK10', label: '공운동' },
			{ key: 'PCHK11', label: '구슬꿰기' },
			{ key: 'PCHK12', label: '패그보드끼우기' },
			// 단순운동 21~26
			{ key: 'PCHK21', label: '도수운동' },
			{ key: 'PCHK22', label: 'ROM' },
			{ key: 'PCHK23', label: '근력운동' },
			{ key: 'PCHK24', label: '기능향상운동' },
			{ key: 'PCHK25', label: '체중이동/지지훈련' },
			{ key: 'PCHK26', label: '보행훈련' },
			// Modalities 31~37
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

	const isRightLocked = !loadingRecords && selectedPlanIndex === null && !isNewMode;
	const showEmptyDataOverlay = isRightLocked && !!selectedMember && planRecords.length === 0;

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				<BeneficiaryListPanel selectedMember={selectedMember} onSelect={handleSelectMember} className="w-full xl:w-1/4 xl:min-w-[240px] xl:max-w-sm shrink-0 border-b xl:border-b-0 xl:h-full xl:min-h-0 min-h-0 xl:overflow-hidden" />

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
										onClick={() => handleSelectPlan(idx)}
										className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-blue-50 ${
											selectedPlanIndex === idx ? 'bg-blue-100 font-semibold' : ''
										}`}
									>
										<div>{formatDateDisplay(r.SDT)} ~ {formatDateDisplay(r.EDT)}</div>
										<div className="text-xs text-blue-900/70 mt-0.5">
											담당자: {String(r.JHEMPNM || r.PD_NM || '').trim() || '-'}
										</div>
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
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">계획 시작일</label>
							<input
								type="date"
								value={String(formData.SDT || '').slice(0, 10)}
								onChange={(e) => {
									setSelectedPlanIndex(null);
									setIsNewMode(true);
									setFormData((prev) => ({ ...prev, SDT: e.target.value }));
								}}
								disabled={!selectedMember}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 min-w-[150px] disabled:bg-gray-50 disabled:border-blue-200"
							/>
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">계획 종료일</label>
							<input
								type="date"
								value={String(formData.EDT || '').slice(0, 10)}
								onChange={(e) => {
									setSelectedPlanIndex(null);
									setIsNewMode(true);
									setFormData((prev) => ({ ...prev, EDT: e.target.value }));
								}}
								disabled={!selectedMember}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 min-w-[150px] disabled:bg-gray-50 disabled:border-blue-200"
							/>
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">담당자</label>
							<EmployeeSearchInput
								value={String(formData.JHEMPNM ?? '')}
								onChange={(name, empno) =>
									setFormData((prev) => ({
										...prev,
										JHEMPNM: name,
										JHEMP: empno != null ? String(empno) : '',
									}))
								}
								placeholder="직원 이름 검색"
								className="min-w-[150px]"
								inputClassName="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 min-w-[150px] w-full"
							/>
						</div>
						{selectedMember && (
							<div className="text-sm text-blue-900/80">
								<span className="mr-3">등급: {formatCareGradeLabel(selectedMember.P_GRD)}</span>
								<span className="mr-3">성별: {selectedMember.P_SEX === '1' ? '남' : selectedMember.P_SEX === '2' ? '여' : '-'}</span>
								<span className="mr-3">나이: {calculateAge(selectedMember.P_BRDT as any)}</span>
								<span>
									층: {extractFloorFromRoomNo((selectedMember as any).ROOM_NO) !== null ? `${extractFloorFromRoomNo((selectedMember as any).ROOM_NO)}층` : '-'}
								</span>
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4 mb-6">
						<div className="border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-2 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">진단/문제/방안/계획</h3>
							</div>
							<div className="space-y-3">
								<div>
									<div className="text-xs text-blue-900/80 mb-1">진단명</div>
									<textarea
										value={String(formData.P_DIAG ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, P_DIAG: e.target.value }))}
										className="w-full min-h-[56px] px-2 py-1 text-sm border border-blue-300 rounded"
									/>
								</div>
								<div>
									<div className="text-xs text-blue-900/80 mb-1">치료에 의한 생활영역문제점</div>
									<textarea
										value={String(formData.P_PROBLEM ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, P_PROBLEM: e.target.value }))}
										className="w-full min-h-[56px] px-2 py-1 text-sm border border-blue-300 rounded"
									/>
								</div>
								<div>
									<div className="text-xs text-blue-900/80 mb-1">치료 방안</div>
									<textarea
										value={String(formData.P_WAY ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, P_WAY: e.target.value }))}
										className="w-full min-h-[56px] px-2 py-1 text-sm border border-blue-300 rounded"
									/>
								</div>
								<div>
									<div className="text-xs text-blue-900/80 mb-1">치료 계획</div>
									<textarea
										value={String(formData.P_PLAN ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, P_PLAN: e.target.value }))}
										className="w-full min-h-[56px] px-2 py-1 text-sm border border-blue-300 rounded"
									/>
								</div>
							</div>
						</div>

						<div className="border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-2 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">평가</h3>
							</div>
							<div className="space-y-3">
								<div>
									<div className="text-xs text-blue-900/80 mb-1">평가</div>
									<textarea
										value={String(formData.P_JUDGE ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, P_JUDGE: e.target.value }))}
										className="w-full min-h-[140px] px-2 py-1 text-sm border border-blue-300 rounded"
									/>
								</div>
								<div className="flex items-center gap-2">
									<div className="text-xs text-blue-900/80 whitespace-nowrap">근여제공횟수</div>
									<input
										type="text"
										value={String(formData.P_TEXT_CNT ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, P_TEXT_CNT: e.target.value }))}
										className="w-32 px-2 py-1 text-sm border border-blue-300 rounded"
										placeholder="예) 10"
									/>
								</div>
							</div>
						</div>

						<div className="border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-2 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">치료목표 (PSTD01~20)</h3>
							</div>
							<div className="grid grid-cols-2 gap-2">
								{goalItems.map((it) => (
									<label key={it.key} className="flex items-center gap-2 text-sm text-blue-900">
										<input
											type="checkbox"
											checked={String(formData[it.key] ?? '0') === '1'}
											onChange={() => toggleKey(it.key)}
											className="w-4 h-4 text-blue-500 border border-blue-300 rounded focus:ring-blue-500"
										/>
										<span className="text-xs">{it.label}</span>
									</label>
								))}
							</div>
						</div>

						<div className="border border-blue-300 rounded-lg p-4 bg-white">
							<div className="mb-2 pb-2 border-b border-blue-200">
								<h3 className="text-base font-semibold text-blue-900">치료계획 항목 (PCHK)</h3>
							</div>
							<div className="grid grid-cols-2 gap-2">
								{planItems.map((it) => (
									<label key={it.key} className="flex items-center gap-2 text-sm text-blue-900">
										<input
											type="checkbox"
											checked={String(formData[it.key] ?? '0') === '1'}
											onChange={() => toggleKey(it.key)}
											className="w-4 h-4 text-blue-500 border border-blue-300 rounded focus:ring-blue-500"
										/>
										<span className="text-xs">{it.label}</span>
									</label>
								))}
							</div>
							<div className="mt-3 pt-3 border-t border-blue-100">
								<div className="text-xs text-blue-900/80 mb-1">기타치료 (PETC_1~5)</div>
								<div className="grid grid-cols-2 gap-2">
									{[1, 2, 3, 4, 5].map((n) => (
										<input
											key={n}
											type="text"
											value={String(formData[`PETC_${n}`] ?? '')}
											onChange={(e) => setFormData((p) => ({ ...p, [`PETC_${n}`]: e.target.value }))}
											className="px-2 py-1 text-sm border border-blue-300 rounded"
											placeholder={`기타치료-${n}`}
										/>
									))}
								</div>
								<div className="mt-3">
									<div className="text-xs text-blue-900/80 mb-1">비고</div>
									<textarea
										value={String(formData.ETC ?? '')}
										onChange={(e) => setFormData((p) => ({ ...p, ETC: e.target.value }))}
										className="w-full min-h-[72px] px-2 py-1 text-sm border border-blue-300 rounded"
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<button
							onClick={handleSave}
							disabled={!selectedMember || loadingRecords}
							className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							저장
						</button>
						<button
							onClick={handleNewPlan}
							disabled={!selectedMember || loadingRecords}
							className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							지움
						</button>
						<button
							onClick={handleDelete}
							disabled={!selectedMember || loadingRecords}
							className="px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							삭제
						</button>
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


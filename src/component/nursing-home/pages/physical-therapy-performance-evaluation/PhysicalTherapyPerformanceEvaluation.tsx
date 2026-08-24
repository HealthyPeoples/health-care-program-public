"use client";

/**
 * @file 물리치료실적평가 — 화면 컴포넌트 (PhysicalTherapyPerformanceEvaluation.tsx)
 *
 * @description
 * 요양원 물리치료실적평가 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/physical-therapy-performance-evaluation
 *
 * @module component/nursing-home/pages/physical-therapy-performance-evaluation/PhysicalTherapyPerformanceEvaluation
 */
import React, { useMemo, useState } from 'react';
import BeneficiaryListPanel, { BeneficiaryMember } from '../../components/BeneficiaryListPanel';
import { EmployeeSearchInput } from '../../components/EmployeeSearchInput';

const MOTION_TO_CODE: Record<string, string> = {
	운동장애없음: '0',
	불완전운동장애: '1',
	완전운동장애: '2',
};
const CODE_TO_MOTION: Record<string, string> = {
	'0': '운동장애없음',
	'1': '불완전운동장애',
	'2': '완전운동장애',
};
const JOINT_TO_CODE: Record<string, string> = {
	제한없음: '0',
	'좌/우관절제한': '1',
	양관절제한: '2',
};
const CODE_TO_JOINT: Record<string, string> = {
	'0': '제한없음',
	'1': '좌/우관절제한',
	'2': '양관절제한',
};

const ADL_KEYS = ['bowelBladder', 'eating', 'clothing', 'personalHygiene', 'gait', 'bathing'] as const;

type EvalForm = {
	evaluationDate: string;
	beneficiary: string;
	rightUpperLimb: string;
	leftUpperLimb: string;
	rightLowerLimb: string;
	leftLowerLimb: string;
	shoulderJoint: string;
	elbowJoint: string;
	wristFingerJoint: string;
	hipJoint: string;
	kneeJoint: string;
	ankleJoint: string;
	bodyPain: string;
	bedMovement: boolean;
	sitting: boolean;
	crawling: boolean;
	kneeling: boolean;
	standing: boolean;
	walking: boolean;
	wheelchairOperation: boolean;
	assistiveDeviceMovement: boolean;
	bowelBladder: string;
	eating: string;
	clothing: string;
	personalHygiene: string;
	gait: string;
	bathing: string;
	evaluator: string;
	evaluationNotes: string;
};

function code1(v: unknown) {
	return String(v ?? '').trim();
}

function formatDateDisplay(dateStr: unknown) {
	if (dateStr == null || dateStr === '') return '';
	if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) {
		const y = dateStr.getFullYear();
		const m = String(dateStr.getMonth() + 1).padStart(2, '0');
		const d = String(dateStr.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(dateStr).trim();
	if (!s) return '';
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

function adlTotalOf(form: Pick<EvalForm, (typeof ADL_KEYS)[number]>) {
	return ADL_KEYS.reduce((sum, k) => sum + (parseInt(String(form[k]), 10) || 0), 0);
}

function createEmptyForm(beneficiary = '', evaluationDate?: string): EvalForm {
	return {
		evaluationDate: evaluationDate || new Date().toISOString().slice(0, 10),
		beneficiary,
		rightUpperLimb: '운동장애없음',
		leftUpperLimb: '운동장애없음',
		rightLowerLimb: '운동장애없음',
		leftLowerLimb: '운동장애없음',
		shoulderJoint: '제한없음',
		elbowJoint: '제한없음',
		wristFingerJoint: '제한없음',
		hipJoint: '제한없음',
		kneeJoint: '제한없음',
		ankleJoint: '제한없음',
		bodyPain: '없음',
		bedMovement: false,
		sitting: false,
		crawling: false,
		kneeling: false,
		standing: false,
		walking: false,
		wheelchairOperation: false,
		assistiveDeviceMovement: false,
		bowelBladder: '0',
		eating: '0',
		clothing: '0',
		personalHygiene: '0',
		gait: '0',
		bathing: '0',
		evaluator: '',
		evaluationNotes: '',
	};
}

function rowToForm(record: Record<string, unknown>, beneficiary: string, fallbackDate?: string): EvalForm {
	const c = (k: string) => code1(record[k]);
	return {
		...createEmptyForm(beneficiary, formatDateDisplay(String(record.ADT || record.EVALDT || fallbackDate || ''))),
		rightUpperLimb: CODE_TO_MOTION[c('APPR01')] || '운동장애없음',
		leftUpperLimb: CODE_TO_MOTION[c('APPR02')] || '운동장애없음',
		rightLowerLimb: CODE_TO_MOTION[c('APPR03')] || '운동장애없음',
		leftLowerLimb: CODE_TO_MOTION[c('APPR04')] || '운동장애없음',
		shoulderJoint: CODE_TO_JOINT[c('APPR05')] || '제한없음',
		elbowJoint: CODE_TO_JOINT[c('APPR06')] || '제한없음',
		wristFingerJoint: CODE_TO_JOINT[c('APPR07')] || '제한없음',
		hipJoint: CODE_TO_JOINT[c('APPR08')] || '제한없음',
		kneeJoint: CODE_TO_JOINT[c('APPR09')] || '제한없음',
		ankleJoint: CODE_TO_JOINT[c('APPR10')] || '제한없음',
		bodyPain: c('APPR11') === '1' ? '있음' : '없음',
		bedMovement: c('APPR21') === '1',
		sitting: c('APPR22') === '1',
		crawling: c('APPR23') === '1',
		kneeling: c('APPR24') === '1',
		standing: c('APPR25') === '1',
		walking: c('APPR26') === '1',
		wheelchairOperation: c('APPR27') === '1',
		assistiveDeviceMovement: c('APPR28') === '1',
		bowelBladder: c('APPR31') || '0',
		eating: c('APPR32') || '0',
		clothing: c('APPR33') || '0',
		personalHygiene: c('APPR34') || '0',
		gait: c('APPR35') || '0',
		bathing: c('APPR36') || '0',
		evaluator: String(record.APEMP ?? ''),
		evaluationNotes: String(record.APPR91 ?? ''),
	};
}

function formToPayload(form: EvalForm, pnum: string | number) {
	return {
		PNUM: pnum,
		ADT: form.evaluationDate,
		APEMP: form.evaluator,
		APPR01: MOTION_TO_CODE[form.rightUpperLimb] ?? '0',
		APPR02: MOTION_TO_CODE[form.leftUpperLimb] ?? '0',
		APPR03: MOTION_TO_CODE[form.rightLowerLimb] ?? '0',
		APPR04: MOTION_TO_CODE[form.leftLowerLimb] ?? '0',
		APPR05: JOINT_TO_CODE[form.shoulderJoint] ?? '0',
		APPR06: JOINT_TO_CODE[form.elbowJoint] ?? '0',
		APPR07: JOINT_TO_CODE[form.wristFingerJoint] ?? '0',
		APPR08: JOINT_TO_CODE[form.hipJoint] ?? '0',
		APPR09: JOINT_TO_CODE[form.kneeJoint] ?? '0',
		APPR10: JOINT_TO_CODE[form.ankleJoint] ?? '0',
		APPR11: form.bodyPain === '있음' ? '1' : '0',
		APPR21: form.bedMovement ? '1' : '0',
		APPR22: form.sitting ? '1' : '0',
		APPR23: form.crawling ? '1' : '0',
		APPR24: form.kneeling ? '1' : '0',
		APPR25: form.standing ? '1' : '0',
		APPR26: form.walking ? '1' : '0',
		APPR27: form.wheelchairOperation ? '1' : '0',
		APPR28: form.assistiveDeviceMovement ? '1' : '0',
		APPR31: form.bowelBladder,
		APPR32: form.eating,
		APPR33: form.clothing,
		APPR34: form.personalHygiene,
		APPR35: form.gait,
		APPR36: form.bathing,
		APPR90: adlTotalOf(form),
		APPR91: form.evaluationNotes,
	};
}

export default function PhysicalTherapyPerformanceEvaluation() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [evaluationDates, setEvaluationDates] = useState<string[]>([]);
	const [loadingEvaluations, setLoadingEvaluations] = useState(false);
	const [activeTab, setActiveTab] = useState<string>('운동');
	const [evaluationRecords, setEvaluationRecords] = useState<Record<string, any>[]>([]);
	const [isCreatingNew, setIsCreatingNew] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState<EvalForm>(() => createEmptyForm());

	const adlTotal = useMemo(() => adlTotalOf(formData), [formData]);

	// 평가일자 목록 조회
	const fetchEvaluationDates = async (pnum: string, keepEvaldt?: string) => {
		if (!pnum) {
			setEvaluationDates([]);
			setEvaluationRecords([]);
			return;
		}

		setLoadingEvaluations(true);
		try {
			const url = `/api/f32030?pnum=${encodeURIComponent(pnum)}`;
			const response = await fetch(url, { cache: 'no-store' });
			const result = await response.json();
			if (result.success) {
				const list: Record<string, any>[] = result.data || [];
				setEvaluationRecords(list);
				const dates = list
					.map((r) => formatDateDisplay(r.ADT || r.EVALDT || r.evaluationDate))
					.filter(Boolean);
				setEvaluationDates(dates);

				if (keepEvaldt) {
					const idx = dates.findIndex((d) => formatDateDisplay(String(d)) === formatDateDisplay(String(keepEvaldt)));
					if (idx >= 0) {
						setSelectedDateIndex(idx);
						setIsEditing(false);
						setFormData(rowToForm(list[idx], selectedMember?.P_NM || '', keepEvaldt));
					} else {
						setSelectedDateIndex(null);
					}
				} else {
					setSelectedDateIndex(null);
					setIsEditing(false);
				}
			} else {
				setEvaluationRecords([]);
				setEvaluationDates([]);
			}
		} catch (err) {
			console.error('평가일자 조회 오류:', err);
		} finally {
			setLoadingEvaluations(false);
		}
	};

	// 수급자 선택 함수
	const handleSelectMember = (member: BeneficiaryMember) => {
		setSelectedMember(member);
		setFormData(createEmptyForm(String(member.P_NM ?? '')));
		setIsCreatingNew(false);
		setIsEditing(false);
		fetchEvaluationDates(String(member.PNUM));
	};

	const handleSelectDate = (index: number) => {
		setSelectedDateIndex(index);
		setIsCreatingNew(false);
		setIsEditing(false);
		const record = evaluationRecords[index];
		if (record) {
			setFormData(rowToForm(record, selectedMember?.P_NM || formData.beneficiary, evaluationDates[index]));
		}
	};

	const handleNewEvaluation = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		setSelectedDateIndex(null);
		setIsCreatingNew(true);
		setIsEditing(true);
		setActiveTab('운동');
		setFormData(createEmptyForm(selectedMember.P_NM || ''));
	};

	const handleStartEdit = () => {
		if (selectedDateIndex === null && !isCreatingNew) {
			alert('수정할 평가를 선택해주세요.');
			return;
		}
		setIsEditing(true);
	};

	// 저장 함수
	const handleSave = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (!formData.evaluationDate) {
			alert('작성일자를 입력해주세요.');
			return;
		}

		if (!isCreatingNew && !isEditing) {
			alert('수정 버튼을 눌러 수정모드로 전환해 주세요.');
			return;
		}

		setLoadingEvaluations(true);
		try {
			const response = await fetch('/api/f32030', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formToPayload(formData, selectedMember.PNUM)),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) {
				throw new Error(result?.error || result?.details || '저장 실패');
			}

			alert(selectedDateIndex !== null && !isCreatingNew ? '물리치료실적 평가가 수정되었습니다.' : '물리치료실적 평가가 저장되었습니다.');
			setIsCreatingNew(false);
			setIsEditing(false);
			await fetchEvaluationDates(String(selectedMember.PNUM), formData.evaluationDate);
		} catch (err) {
			console.error('물리치료실적 평가 저장 오류:', err);
			const msg = err instanceof Error && err.message ? err.message : '';
			alert(msg ? `물리치료실적 평가 저장 중 오류가 발생했습니다.\n${msg}` : '물리치료실적 평가 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingEvaluations(false);
		}
	};

	// 삭제 함수
	const handleDelete = async (index?: number) => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		const targetIndex = index ?? selectedDateIndex;
		if (targetIndex === null || targetIndex === undefined) {
			alert('삭제할 평가를 선택해주세요.');
			return;
		}

		if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			return;
		}

		setLoadingEvaluations(true);
		try {
			const evaldt = evaluationDates[targetIndex];
			const response = await fetch(
				`/api/f32030?pnum=${encodeURIComponent(selectedMember.PNUM)}&adt=${encodeURIComponent(formatDateDisplay(String(evaldt)))}`,
				{ method: 'DELETE' }
			);
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.success) {
				throw new Error(result?.error || '삭제 실패');
			}

			alert('물리치료실적 평가가 삭제되었습니다.');
			setIsCreatingNew(false);
			setIsEditing(false);
			await fetchEvaluationDates(String(selectedMember.PNUM));
			setFormData(createEmptyForm(selectedMember.P_NM || ''));
			setSelectedDateIndex(null);
		} catch (err) {
			console.error('물리치료실적 평가 삭제 오류:', err);
			alert('물리치료실적 평가 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingEvaluations(false);
		}
	};

	const tabs = ['운동', '관절', '동작', 'ADL1', 'ADL2', 'ADL3', '총점'];
	const hasRecord = !!selectedMember && (isCreatingNew || selectedDateIndex !== null);
	const isEditMode = hasRecord && (isCreatingNew || isEditing);

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				<BeneficiaryListPanel selectedMember={selectedMember} onSelect={handleSelectMember} className="w-full xl:w-1/4 xl:min-w-[240px] xl:max-w-sm shrink-0 border-b xl:border-b-0 xl:h-full xl:min-h-0 min-h-0 xl:overflow-hidden" />

				<div className="flex flex-col w-full xl:w-64 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 min-h-[180px] xl:min-h-0 overflow-hidden">
					<div className="px-3 py-2 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
						<label className="text-sm font-medium text-blue-900">평가일자</label>
						<button
							onClick={handleNewEvaluation}
							disabled={!selectedMember}
							className="px-2 py-1 text-xs border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							신규
						</button>
					</div>
					<div className="flex-1 overflow-y-auto bg-white">
						{loadingEvaluations ? (
							<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
						) : evaluationDates.length === 0 ? (
							<div className="px-3 py-2 text-sm text-blue-900/60">{selectedMember ? '등록된 평가가 없습니다' : '수급자를 선택해주세요'}</div>
						) : (
							evaluationDates.map((d, idx) => (
								<div
									key={`${d}-${idx}`}
									className={`flex items-center gap-1 px-2 py-2 text-sm border-b border-blue-50 ${
										selectedDateIndex === idx ? 'bg-blue-100 font-semibold' : ''
									}`}
								>
									<button
										type="button"
										onClick={() => handleSelectDate(idx)}
										className="flex-1 min-w-0 text-left hover:bg-blue-50 rounded px-1 py-0.5"
									>
										<div>{formatDateDisplay(String(d))}</div>
										<div className="text-xs font-normal text-blue-900/70 mt-0.5">
											평가자: {String(evaluationRecords[idx]?.APEMP ?? '').trim() || '-'}
										</div>
									</button>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(idx);
										}}
										disabled={loadingEvaluations}
										className="shrink-0 px-1.5 py-0.5 text-xs font-medium text-blue-900 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										삭제
									</button>
								</div>
							))
						)}
					</div>
				</div>

				{/* 우측 패널: 평가 폼 */}
				<div className={`relative flex flex-col flex-1 ${selectedMember ? 'bg-white' : 'bg-gray-100'}`}>
					{(!selectedMember || (selectedMember && !loadingEvaluations && evaluationDates.length === 0 && !isCreatingNew)) && (
						<div className="absolute inset-0 z-20 flex items-start justify-center pt-10 bg-gray-100/70">
							<div className="w-[min(520px,90%)] px-4 py-3 text-sm text-blue-900 bg-white border border-blue-200 rounded shadow-sm">
								<div className="font-medium">
									{!selectedMember ? '수급자를 선택해주세요.' : '등록된 평가가 없습니다.'}
								</div>
								{selectedMember && (
									<div className="mt-2 flex justify-end">
										<button
											onClick={handleNewEvaluation}
											className="px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-200 border border-blue-300 rounded hover:bg-blue-300"
										>
											신규등록
										</button>
									</div>
								)}
							</div>
						</div>
					)}
					{/* 상단: 탭과 수급자 필드 */}
					<div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-blue-200 bg-blue-50">
						<div className="flex items-center gap-2">
							{tabs.map((tab) => (
								<button
									key={tab}
									onClick={() => setActiveTab(tab)}
									disabled={!hasRecord}
									className={`px-4 py-2 text-sm font-medium border border-blue-300 rounded ${
										activeTab === tab
											? 'bg-blue-500 text-white border-blue-500'
											: 'bg-white text-blue-900 hover:bg-blue-100'
									} disabled:opacity-50 disabled:cursor-not-allowed`}
								>
									{tab}
								</button>
							))}
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap">수급자</label>
							<input
								type="text"
								value={formData.beneficiary}
								readOnly
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-gray-50 min-w-[120px]"
							/>
						</div>
					</div>

					{selectedMember && !loadingEvaluations && evaluationDates.length > 0 && hasRecord && !isEditMode && (
						<div className="px-4 py-3 text-sm text-blue-900 border-b border-blue-100 bg-blue-50/40">
							수정 버튼을 눌러 수정모드로 전환해 주세요.
						</div>
					)}

					{selectedMember && !loadingEvaluations && evaluationDates.length > 0 && !hasRecord && (
						<div className="px-4 py-3 text-sm text-blue-900 border-b border-blue-100 bg-blue-50/40">
							좌측 목록에서 평가일자를 선택하거나, 신규등록을 눌러주세요.
						</div>
					)}

					{/* 메인 컨텐츠 영역 */}
					<div className={`flex-1 p-4 overflow-y-auto ${!hasRecord ? 'pointer-events-none opacity-60' : ''}`}>
						<div className="flex gap-4">
							{/* 왼쪽: 평가 폼 */}
							<div className={`flex-1 space-y-4 ${!isEditMode ? 'pointer-events-none' : ''}`}>
								{/* 작성일자 */}
								<div className="flex items-center gap-2">
									<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">작성일자</label>
									<input
										type="date"
										value={formatDateDisplay(formData.evaluationDate)}
										onChange={(e) => {
											if (!isCreatingNew) return;
											setFormData((prev) => ({ ...prev, evaluationDate: e.target.value }));
										}}
										disabled={!isCreatingNew}
										className={`px-3 py-1.5 text-sm border border-blue-300 rounded focus:outline-none focus:border-blue-500 min-w-[150px] ${
											isCreatingNew ? 'bg-white' : 'bg-gray-50'
										}`}
									/>
								</div>

								{/* 탭별 컨텐츠 */}
								{activeTab === '운동' && (
									<div className="mt-6">
										<h2 className="mb-4 text-lg font-semibold text-blue-900">
											1. 운동장애 및 관절제한 평가 (운동장애정도)
										</h2>
										<div className="space-y-6">
											{/* (1) 우측상지 */}
											<div className="space-y-2">
												<div className="text-sm font-medium text-blue-900">(1) 우측상지</div>
												<div className="flex gap-6 ml-4">
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="rightUpperLimb" value="운동장애없음" checked={formData.rightUpperLimb === '운동장애없음'} onChange={(e) => setFormData(prev => ({ ...prev, rightUpperLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">운동장애없음</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="rightUpperLimb" value="불완전운동장애" checked={formData.rightUpperLimb === '불완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, rightUpperLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">불완전운동장애</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="rightUpperLimb" value="완전운동장애" checked={formData.rightUpperLimb === '완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, rightUpperLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">완전운동장애</span>
													</label>
												</div>
											</div>
											{/* (2) 좌측상지 */}
											<div className="space-y-2">
												<div className="text-sm font-medium text-blue-900">(2) 좌측상지</div>
												<div className="flex gap-6 ml-4">
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="leftUpperLimb" value="운동장애없음" checked={formData.leftUpperLimb === '운동장애없음'} onChange={(e) => setFormData(prev => ({ ...prev, leftUpperLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">운동장애없음</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="leftUpperLimb" value="불완전운동장애" checked={formData.leftUpperLimb === '불완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, leftUpperLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">불완전운동장애</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="leftUpperLimb" value="완전운동장애" checked={formData.leftUpperLimb === '완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, leftUpperLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">완전운동장애</span>
													</label>
												</div>
											</div>
											{/* (3) 우측하지 */}
											<div className="space-y-2">
												<div className="text-sm font-medium text-blue-900">(3) 우측하지</div>
												<div className="flex gap-6 ml-4">
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="rightLowerLimb" value="운동장애없음" checked={formData.rightLowerLimb === '운동장애없음'} onChange={(e) => setFormData(prev => ({ ...prev, rightLowerLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">운동장애없음</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="rightLowerLimb" value="불완전운동장애" checked={formData.rightLowerLimb === '불완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, rightLowerLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">불완전운동장애</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="rightLowerLimb" value="완전운동장애" checked={formData.rightLowerLimb === '완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, rightLowerLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">완전운동장애</span>
													</label>
												</div>
											</div>
											{/* (4) 좌측하지 */}
											<div className="space-y-2">
												<div className="text-sm font-medium text-blue-900">(4) 좌측하지</div>
												<div className="flex gap-6 ml-4">
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="leftLowerLimb" value="운동장애없음" checked={formData.leftLowerLimb === '운동장애없음'} onChange={(e) => setFormData(prev => ({ ...prev, leftLowerLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">운동장애없음</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="leftLowerLimb" value="불완전운동장애" checked={formData.leftLowerLimb === '불완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, leftLowerLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">불완전운동장애</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="leftLowerLimb" value="완전운동장애" checked={formData.leftLowerLimb === '완전운동장애'} onChange={(e) => setFormData(prev => ({ ...prev, leftLowerLimb: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">완전운동장애</span>
													</label>
												</div>
											</div>
										</div>
									</div>
								)}

								{activeTab === '관절' && (
									<div className="mt-6">
										<h2 className="mb-4 text-lg font-semibold text-blue-900">
											1. 운동장애 및 관절제한 평가 (관절제한정도)
										</h2>
										<div className="space-y-6">
											{['shoulderJoint', 'elbowJoint', 'wristFingerJoint', 'hipJoint', 'kneeJoint', 'ankleJoint'].map((joint, idx) => {
												const labels = ['어깨관절', '팔꿈치관절', '손목 및 수지관절', '고관절', '무릎관절', '발목관절'];
												const numbers = [5, 6, 7, 8, 9, 10];
												return (
													<div key={joint} className="space-y-2">
														<div className="text-sm font-medium text-blue-900">({numbers[idx]}) {labels[idx]}</div>
														<div className="flex gap-6 ml-4">
															<label className="flex items-center gap-2 cursor-pointer">
																<input type="radio" name={joint} value="제한없음" checked={formData[joint as keyof typeof formData] === '제한없음'} onChange={(e) => setFormData(prev => ({ ...prev, [joint]: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
																<span className="text-sm text-blue-900">제한없음</span>
															</label>
															<label className="flex items-center gap-2 cursor-pointer">
																<input type="radio" name={joint} value="좌/우관절제한" checked={formData[joint as keyof typeof formData] === '좌/우관절제한'} onChange={(e) => setFormData(prev => ({ ...prev, [joint]: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
																<span className="text-sm text-blue-900">좌/우관절제한</span>
															</label>
															<label className="flex items-center gap-2 cursor-pointer">
																<input type="radio" name={joint} value="양관절제한" checked={formData[joint as keyof typeof formData] === '양관절제한'} onChange={(e) => setFormData(prev => ({ ...prev, [joint]: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
																<span className="text-sm text-blue-900">양관절제한</span>
															</label>
														</div>
													</div>
												);
											})}
											{/* (11) 신체통증유무 */}
											<div className="space-y-2">
												<div className="text-sm font-medium text-blue-900">(11) 신체통증유무</div>
												<div className="flex gap-6 ml-4">
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="bodyPain" value="없음" checked={formData.bodyPain === '없음'} onChange={(e) => setFormData(prev => ({ ...prev, bodyPain: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">없음</span>
													</label>
													<label className="flex items-center gap-2 cursor-pointer">
														<input type="radio" name="bodyPain" value="있음" checked={formData.bodyPain === '있음'} onChange={(e) => setFormData(prev => ({ ...prev, bodyPain: e.target.value }))} className="w-4 h-4 text-blue-500 border-blue-300 focus:ring-blue-500" />
														<span className="text-sm text-blue-900">있음</span>
													</label>
												</div>
											</div>
										</div>
									</div>
								)}

								{activeTab === '동작' && (
									<div className="mt-6">
										<h2 className="px-4 py-2 mb-4 text-lg font-semibold text-blue-900 bg-blue-100 border border-blue-300 rounded">
											2. 기본동작평가
										</h2>
										<div className="grid grid-cols-4 gap-4 mt-4">
											{[
												{ key: 'bedMovement', label: '침상이동 - 측면 & 침상위 이동' },
												{ key: 'sitting', label: '앉기' },
												{ key: 'crawling', label: '네발기기' },
												{ key: 'kneeling', label: '무릎서기' },
												{ key: 'standing', label: '기립' },
												{ key: 'walking', label: '보행' },
												{ key: 'wheelchairOperation', label: '휠체어 조작 및 이동' },
												{ key: 'assistiveDeviceMovement', label: '보장구 장착 이동' }
											].map((item) => (
												<label key={item.key} className="flex items-center gap-2 cursor-pointer">
													<input
														type="checkbox"
														checked={formData[item.key as keyof typeof formData] as boolean}
														onChange={(e) => setFormData(prev => ({ ...prev, [item.key]: e.target.checked }))}
														className="w-4 h-4 text-blue-500 border-blue-300 rounded focus:ring-blue-500"
													/>
													<span className="text-sm text-blue-900">{item.label}</span>
												</label>
											))}
										</div>
									</div>
								)}

								{activeTab === 'ADL1' && (
									<div className="mt-6 space-y-8">
										<div className="text-sm font-medium text-blue-900">현재 ADL 총점: {adlTotal} / 30</div>
										{/* 1. 대소변 */}
										<div>
											<h3 className="mb-4 text-lg font-semibold text-blue-900">1. 대소변</h3>
											<div className="space-y-3">
												{[
													{ value: '0', label: '화장실을 완벽하게 사용할 수 있으며, 실금 현상이 전혀 없다.' },
													{ value: '1', label: '대소변을 볼 때 도움이 필요하며 가끔은 실금 현상이 있다.' },
													{ value: '2', label: '1주일에 1회 이상 수면중 대소변을 지리기도 한다.' },
													{ value: '4', label: '1주일에 1회 이상 낮 시간에 대소변을 지리기도 한다.' },
													{ value: '5', label: '대소변을 전혀 조절하지 못한다.' }
												].map((option) => (
													<label key={option.value} className="flex items-start gap-2 cursor-pointer">
														<input
															type="radio"
															name="bowelBladder"
															value={option.value}
															checked={formData.bowelBladder === option.value}
															onChange={(e) => setFormData(prev => ({ ...prev, bowelBladder: e.target.value }))}
															className="w-4 h-4 mt-1 text-blue-500 border-blue-300 focus:ring-blue-500"
														/>
														<span className="text-sm text-blue-900">({option.value}) - {option.label}</span>
													</label>
												))}
											</div>
										</div>
										{/* 2. 식사 */}
										<div>
											<h3 className="mb-4 text-lg font-semibold text-blue-900">2. 식사</h3>
											<div className="space-y-3">
												{[
													{ value: '0', label: '도움 없이 혼자서 먹을 수 있다.' },
													{ value: '1', label: '식사중이나 특별한 음식을 먹을 때 약간의 도움이 필요하거나 식후 위생을 누군가 도와 주어야 한다.' },
													{ value: '2', label: '다른 사람의 중등 도의 도움을 받아 식사하며 지저분하게 식사한다.' },
													{ value: '4', label: '모든 식사를 다른 사람이 많이 도와 주어야 한다.' },
													{ value: '5', label: '스스로는 식사하지 못해 다른 사람이 먹여주어야 한다.' }
												].map((option) => (
													<label key={option.value} className="flex items-start gap-2 cursor-pointer">
														<input
															type="radio"
															name="eating"
															value={option.value}
															checked={formData.eating === option.value}
															onChange={(e) => setFormData(prev => ({ ...prev, eating: e.target.value }))}
															className="w-4 h-4 mt-1 text-blue-500 border-blue-300 focus:ring-blue-500"
														/>
														<span className="text-sm text-blue-900">({option.value}) - {option.label}</span>
													</label>
												))}
											</div>
										</div>
									</div>
								)}

								{activeTab === 'ADL2' && (
									<div className="mt-6 space-y-8">
										<div className="text-sm font-medium text-blue-900">현재 ADL 총점: {adlTotal} / 30</div>
										{/* 3. 복장 */}
										<div>
											<h3 className="mb-4 text-lg font-semibold text-blue-900">3. 복장</h3>
											<div className="space-y-3">
												{[
													{ value: '0', label: '스스로 입고 벗을 수 있으며 자신의 옷장에서 옷을 고를 수 있다.' },
													{ value: '1', label: '옷이 미리골라져 있다면 입고 벗을 수 있다.' },
													{ value: '2', label: '미리 준비된 옷이라도 다른 사람이 약간 도와주어야 입을 수 있다.' },
													{ value: '4', label: '옷을 입을 때 많이 도와주어야 하는데, 협조 할 수 있다.' },
													{ value: '5', label: '전혀 스스로는 옷을 입을 수 없으며, 다른 사람이 입혀줄 때도 있다.' }
												].map((option) => (
													<label key={option.value} className="flex items-start gap-2 cursor-pointer">
														<input
															type="radio"
															name="clothing"
															value={option.value}
															checked={formData.clothing === option.value}
															onChange={(e) => setFormData(prev => ({ ...prev, clothing: e.target.value }))}
															className="w-4 h-4 mt-1 text-blue-500 border-blue-300 focus:ring-blue-500"
														/>
														<span className="text-sm text-blue-900">({option.value}) - {option.label}</span>
													</label>
												))}
											</div>
										</div>
										{/* 4. 개인위생 */}
										<div>
											<h3 className="mb-4 text-lg font-semibold text-blue-900">4. 개인위생 (머리빗기, 양치질, 면도, 손발톱관리, 세면하기등)</h3>
											<div className="space-y-3">
												{[
													{ value: '0', label: '다른 사람의 도움 없이도 항상 단정하게옷 입고 몸치장을 할 수 있다.' },
													{ value: '1', label: '적절한 몸치장을 스스로 할 수 있으나면도 같은 것들은 도움을 필요로 한다.' },
													{ value: '2', label: '몸치장에 다른 사람들의 도움과 규칙적인 감독을 필요로 한다.' },
													{ value: '4', label: '다른 사람들이 전적으로 몸치장을 도와주어야 하는데일단 몸치장을 한 다음에는 깨끗하게 유지할 수 있다.' },
													{ value: '5', label: '몸치장을 하고 유지하는데 다른 사람들이 적극적으로 도와주어야 한다.' }
												].map((option) => (
													<label key={option.value} className="flex items-start gap-2 cursor-pointer">
														<input
															type="radio"
															name="personalHygiene"
															value={option.value}
															checked={formData.personalHygiene === option.value}
															onChange={(e) => setFormData(prev => ({ ...prev, personalHygiene: e.target.value }))}
															className="w-4 h-4 mt-1 text-blue-500 border-blue-300 focus:ring-blue-500"
														/>
														<span className="text-sm text-blue-900">({option.value}) - {option.label}</span>
													</label>
												))}
											</div>
										</div>
									</div>
								)}

								{activeTab === 'ADL3' && (
									<div className="mt-6 space-y-8">
										<div className="text-sm font-medium text-blue-900">현재 ADL 총점: {adlTotal} / 30</div>
										{/* 5. 보행 */}
										<div>
											<h3 className="mb-4 text-lg font-semibold text-blue-900">5. 보행 (계단, 이동)</h3>
											<div className="space-y-3">
												{[
													{ value: '0', label: '외출하여 스스로 걸어 다닐 수 있다.' },
													{ value: '1', label: '실내와 실외에서 걸어 다닐 수 있다.' },
													{ value: '2', label: '다른 사람의 도움을 받거나 walker, wheelchair등을 이용하여 움직일 수 있다.' },
													{ value: '4', label: '의자나 휠체어에 앉아 있을 수는 있는데 다른 사람의 도움 없이 움직일 수 없다.' },
													{ value: '5', label: '하루의 반 이상을 침대에 누운 상태로 지낸다.' }
												].map((option) => (
													<label key={option.value} className="flex items-start gap-2 cursor-pointer">
														<input
															type="radio"
															name="gait"
															value={option.value}
															checked={formData.gait === option.value}
															onChange={(e) => setFormData(prev => ({ ...prev, gait: e.target.value }))}
															className="w-4 h-4 mt-1 text-blue-500 border-blue-300 focus:ring-blue-500"
														/>
														<span className="text-sm text-blue-900">({option.value}) - {option.label}</span>
													</label>
												))}
											</div>
										</div>
										{/* 6. 목욕하기 */}
										<div>
											<h3 className="mb-4 text-lg font-semibold text-blue-900">6. 목욕하기</h3>
											<div className="space-y-3">
												{[
													{ value: '0', label: '스스로 도움 없이 목욕할 수 있다.' },
													{ value: '1', label: '탕에 들어거고 나오는 것을 도와주면 혼자 목욕할 수 있다.' },
													{ value: '2', label: '얼굴과 손은 쉽게 씻지만 몸과 나머지 부분은 씻지 않는다.' },
													{ value: '4', label: '스스로 씻지는 못하나 다른 사람들이 목욕시킬 때 협조는 할 수 있다.' },
													{ value: '5', label: '스스로는 씻으려는 노력을 전혀 하지 않으며 다른 사람들이 씻어 주려해도 저항한다.' }
												].map((option) => (
													<label key={option.value} className="flex items-start gap-2 cursor-pointer">
														<input
															type="radio"
															name="bathing"
															value={option.value}
															checked={formData.bathing === option.value}
															onChange={(e) => setFormData(prev => ({ ...prev, bathing: e.target.value }))}
															className="w-4 h-4 mt-1 text-blue-500 border-blue-300 focus:ring-blue-500"
														/>
														<span className="text-sm text-blue-900">({option.value}) - {option.label}</span>
													</label>
												))}
											</div>
										</div>
									</div>
								)}

								{activeTab === '총점' && (
									<div className="mt-6">
										<div className="flex gap-4 mb-6">
											<div className="flex items-center gap-2">
												<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">총점</label>
												<input
													type="text"
													value={String(adlTotal)}
													readOnly
													className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-gray-50 min-w-[150px]"
												/>
											</div>
										</div>
										<div className="mb-4 text-sm text-blue-900">
											<div>ADL 항목을 선택하면 총점이 바로 반영됩니다.</div>
											<div>6개 항목에 0점부터 5점까지 배점</div>
											<div>총점: 0점(완전 독립수행) - 30점(완전도움의존)</div>
										</div>
										<div className="flex items-start gap-2 mt-6">
											<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">평가</label>
											<textarea
												value={formData.evaluationNotes}
												onChange={(e) => setFormData((prev) => ({ ...prev, evaluationNotes: e.target.value }))}
												className="flex-1 min-h-[160px] px-3 py-2 text-sm bg-white border border-blue-300 rounded"
												placeholder="평가 내용을 입력하세요"
											/>
										</div>
										<div className="flex items-center gap-2 mt-4">
											<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">평가자</label>
											<EmployeeSearchInput
												value={formData.evaluator}
												onChange={(name) => setFormData((prev) => ({ ...prev, evaluator: name }))}
												disabled={!isEditMode}
												placeholder="직원 이름 검색"
												className="min-w-[200px]"
												inputClassName={`px-3 py-1.5 text-sm border border-blue-300 rounded focus:outline-none focus:border-blue-500 min-w-[200px] w-full ${
													isEditMode ? 'bg-white' : 'bg-gray-50'
												}`}
											/>
										</div>
									</div>
								)}
							</div>

							{/* 오른쪽: 버튼 영역 */}
							<div className="flex flex-col gap-2 pointer-events-auto">
								{isEditMode ? (
									<button
										onClick={handleSave}
										disabled={!hasRecord || loadingEvaluations}
										className="px-6 py-2 text-sm font-medium text-green-900 bg-green-200 border border-green-400 rounded hover:bg-green-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
									>
										저장
									</button>
								) : (
									<button
										onClick={handleStartEdit}
										disabled={!hasRecord || loadingEvaluations || selectedDateIndex === null}
										className="px-6 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
									>
										수정
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

"use client";

/**
 * @file 장기요양 기능·인지 — 화면 컴포넌트 (LongtermFunctionalCognitive.tsx)
 *
 * @description
 * 요양원 장기요양 기능·인지 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/longterm-functional-cognitive
 *
 * @module component/nursing-home/pages/longterm-functional-cognitive/LongtermFunctionalCognitive
 */
import { useState, useEffect, type ReactNode } from 'react';
import { MemberListPanel } from '../../components/MemberListPanel';
import { ServiceDateListPanel } from '../../components/ServiceDateListPanel';
import {
	SelectionRequiredOverlay,
	selectionBlockedClass
} from '../../components/SelectionRequiredOverlay';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import {
	fetchF14020Detail,
	fetchF14020ServiceDates,
	saveF14020Fields
} from '../../utils/f14020Daily';

interface MemberData {
	[key: string]: any;
}

export default function LongtermFunctionalCognitive() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [loadingDefaults, setLoadingDefaults] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [originalDraft, setOriginalDraft] = useState<Record<string, any> | null>(null);
	const [serviceDates, setServiceDates] = useState<string[]>([]);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [serviceDatePage, setServiceDatePage] = useState(1);
	const [loadingServiceDates, setLoadingServiceDates] = useState(false);

	// 왼쪽 컬럼 관련 state
	const [physicalCognitiveProgram, setPhysicalCognitiveProgram] = useState<'1' | '0'>('1'); // FN_COGN_HELP
	const [physicalFunctionTraining, setPhysicalFunctionTraining] = useState<'1' | '0'>('1'); // FN_MOVE_HELP
	const [cognitiveTraining, setCognitiveTraining] = useState<'1' | '0'>('1'); // FN_MIND_TRAIN
	const [physicalTherapy, setPhysicalTherapy] = useState<'1' | '0'>('1'); // FN_PHY_HELP
	const [preparerName, setPreparerName] = useState(''); // FN_WRITE_NAME

	// 오른쪽 컬럼 관련 state
	const [cognitiveSupport, setCognitiveSupport] = useState<'1' | '0'>('1'); // RG_AID_HELP
	const [communicationSupport, setCommunicationSupport] = useState<'1' | '0'>('1'); // RG_TALK_HELP
	const [cognitivePreparerName, setCognitivePreparerName] = useState(''); // RG_WRITE_NAME

	// 직원 검색 관련 state
	const [preparerSearchTerm, setPreparerSearchTerm] = useState('');
	const [preparerSuggestions, setPreparerSuggestions] = useState<Array<{EMPNO: string; EMPNM: string}>>([]);
	const [showPreparerDropdown, setShowPreparerDropdown] = useState(false);
	const [cognitivePreparerSearchTerm, setCognitivePreparerSearchTerm] = useState('');
	const [cognitivePreparerSuggestions, setCognitivePreparerSuggestions] = useState<Array<{EMPNO: string; EMPNM: string}>>([]);
	const [showCognitivePreparerDropdown, setShowCognitivePreparerDropdown] = useState(false);

	const selectedPnum = String(selectedMember?.PNUM ?? '').trim();

	const ynToFlag = (v: unknown): '1' | '0' => {
		const s = String(v ?? '').trim().toLowerCase();
		if (s === '1' || s === 'y' || s === 'true') return '1';
		return '0';
	};

	const buildDraft = () => ({
		FN_COGN_HELP: physicalCognitiveProgram,
		FN_MOVE_HELP: physicalFunctionTraining,
		FN_MIND_TRAIN: cognitiveTraining,
		FN_PHY_HELP: physicalTherapy,
		FN_WRITE_NAME: preparerName,
		RG_AID_HELP: cognitiveSupport,
		RG_TALK_HELP: communicationSupport,
		RG_WRITE_NAME: cognitivePreparerName
	});

	const applyDraft = (d: any) => {
		setPhysicalCognitiveProgram(ynToFlag(d?.FN_COGN_HELP));
		setPhysicalFunctionTraining(ynToFlag(d?.FN_MOVE_HELP));
		setCognitiveTraining(ynToFlag(d?.FN_MIND_TRAIN ?? d?.FN_MIND_HELP));
		setPhysicalTherapy(ynToFlag(d?.FN_PHY_HELP));
		setCognitiveSupport(ynToFlag(d?.RG_AID_HELP));
		setCommunicationSupport(ynToFlag(d?.RG_TALK_HELP));
		setPreparerName(String(d?.FN_WRITE_NAME ?? d?.INEMPNM ?? ''));
		setPreparerSearchTerm(String(d?.FN_WRITE_NAME ?? d?.INEMPNM ?? ''));
		setCognitivePreparerName(String(d?.RG_WRITE_NAME ?? ''));
		setCognitivePreparerSearchTerm(String(d?.RG_WRITE_NAME ?? ''));
	};

	const isDirty = () => {
		if (!originalDraft) return false;
		const cur = buildDraft() as Record<string, any>;
		for (const k of Object.keys(cur)) {
			if (String(cur[k] ?? '') !== String(originalDraft[k] ?? '')) return true;
		}
		return false;
	};

	const fetchServiceDates = async (member: MemberData) => {
		setLoadingServiceDates(true);
		setSelectedDateIndex(null);
		setServiceDatePage(1);
		setIsEditing(false);
		setOriginalDraft(null);
		try {
			const dates = await fetchF14020ServiceDates(String(member?.ANCD ?? '').trim(), String(member?.PNUM ?? '').trim());
			setServiceDates(dates);
		} catch (e) {
			console.error('서비스제공일자 조회 오류:', e);
			alert('서비스제공일자를 조회하는 중 오류가 발생했습니다.');
			setServiceDates([]);
		} finally {
			setLoadingServiceDates(false);
		}
	};

	const fetchDetail = async (member: MemberData, svdt: string) => {
		const pnum = String(member?.PNUM ?? '').trim();
		if (!pnum || !svdt) return;
		setLoadingDefaults(true);
		try {
			const row = await fetchF14020Detail(String(member?.ANCD ?? '').trim(), pnum, svdt);
			const draft = row
				? {
						FN_COGN_HELP: row.FN_COGN_HELP,
						FN_MOVE_HELP: row.FN_MOVE_HELP,
						FN_MIND_TRAIN: row.FN_MIND_TRAIN ?? row.FN_MIND_HELP,
						FN_PHY_HELP: row.FN_PHY_HELP,
						FN_WRITE_NAME: row.FN_WRITE_NAME ?? row.INEMPNM ?? '',
						RG_AID_HELP: row.RG_AID_HELP,
						RG_TALK_HELP: row.RG_TALK_HELP,
						RG_WRITE_NAME: row.RG_WRITE_NAME ?? ''
					}
				: buildDraft();
			applyDraft(draft);
			setOriginalDraft({ ...draft });
			setIsEditing(false);
		} catch (e) {
			console.error('F14020 조회 오류:', e);
			alert('기준정보를 조회하는 중 오류가 발생했습니다.');
		} finally {
			setLoadingDefaults(false);
		}
	};

	const handleSelectMember = async (member: MemberData) => {
		if (isEditing && isDirty()) {
			const ok = confirm('수정한 내용을 저장하지 않으면 적용되지 않습니다. 수급자를 변경하시겠습니까?');
			if (!ok) return;
		}
		setSelectedMember(member);
		await fetchServiceDates(member);
	};

	const handleSelectDate = async (index: number) => {
		if (!selectedMember) return;
		if (isEditing && isDirty()) {
			const ok = confirm('수정한 내용을 저장하지 않으면 적용되지 않습니다. 일자를 변경하시겠습니까?');
			if (!ok) return;
		}
		setSelectedDateIndex(index);
		const svdt = serviceDates[index];
		if (svdt) await fetchDetail(selectedMember, svdt);
	};

	useTabRefresh(() => {
		if (!selectedMember) return;
		void fetchServiceDates(selectedMember);
	});

	const handleEnterEdit = () => {
		if (!selectedPnum) return alert('수급자를 선택해주세요.');
		if (selectedDateIndex == null) return alert('서비스제공일자를 선택해주세요.');
		setOriginalDraft({ ...buildDraft() });
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		if (isDirty()) {
			const ok = confirm('수정한 내용은 저장되지 않습니다. 취소하시겠습니까?');
			if (!ok) return;
		}
		if (originalDraft) applyDraft(originalDraft);
		setIsEditing(false);
	};

	const handleSaveEdit = async () => {
		if (!selectedMember || !selectedPnum) return alert('수급자를 선택해주세요.');
		const svdt = selectedDateIndex != null ? serviceDates[selectedDateIndex] : '';
		if (!svdt) return alert('서비스제공일자를 선택해주세요.');
		try {
			const payload = {
				...buildDraft(),
				FN_MIND_HELP: cognitiveTraining
			};
			await saveF14020Fields(String(selectedMember.ANCD ?? ''), selectedPnum, svdt, payload);
			const cur = buildDraft();
			setOriginalDraft({ ...cur });
			setIsEditing(false);
			alert('성공적으로 수정되었습니다.');
		} catch (e) {
			console.error('F14020 저장 오류:', e);
			alert('저장 중 오류가 발생했습니다.');
		}
	};

	const searchEmployee = async (
		searchTerm: string,
		setSuggestions: (data: Array<{EMPNO: string; EMPNM: string}>) => void,
		setShowDropdown: (show: boolean) => void
	) => {
		if (!searchTerm || searchTerm.trim() === '') {
			setSuggestions([]);
			setShowDropdown(false);
			return;
		}

		try {
			const url = `/api/f01010?name=${encodeURIComponent(searchTerm.trim())}`;
			const response = await fetch(url);
			const result = await response.json();

			if (result.success && Array.isArray(result.data)) {
				setSuggestions(result.data);
				setShowDropdown(result.data.length > 0);
			} else {
				setSuggestions([]);
				setShowDropdown(false);
			}
		} catch (err) {
			console.error('직원 검색 오류:', err);
			setSuggestions([]);
			setShowDropdown(false);
		}
	};

	useEffect(() => {
		if (!isEditing) {
			setShowPreparerDropdown(false);
			return;
		}
		const timer = setTimeout(() => {
			if (preparerSearchTerm && preparerSearchTerm.trim() !== '') {
				searchEmployee(preparerSearchTerm, setPreparerSuggestions, setShowPreparerDropdown);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [preparerSearchTerm, isEditing]);

	useEffect(() => {
		if (!isEditing) {
			setShowCognitivePreparerDropdown(false);
			return;
		}
		const timer = setTimeout(() => {
			if (cognitivePreparerSearchTerm && cognitivePreparerSearchTerm.trim() !== '') {
				searchEmployee(cognitivePreparerSearchTerm, setCognitivePreparerSuggestions, setShowCognitivePreparerDropdown);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [cognitivePreparerSearchTerm, isEditing]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('.employee-dropdown-container')) {
				setShowPreparerDropdown(false);
				setShowCognitivePreparerDropdown(false);
			}
		};

		if (showPreparerDropdown || showCognitivePreparerDropdown) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [showPreparerDropdown, showCognitivePreparerDropdown]);

	const fieldLabelClass =
		'min-w-0 flex-1 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded leading-snug';

	const renderYnRadios = (
		name: string,
		value: '1' | '0',
		onChange: (next: '1' | '0') => void
	) => (
		<div className="flex items-center gap-3 shrink-0">
			{(['1', '0'] as const).map((flag) => {
				const isChecked = value === flag;
				return (
					<label
						key={flag}
						className={`flex items-center gap-1 shrink-0 ${isEditing ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
					>
						<input
							type="radio"
							name={name}
							value={flag}
							checked={isChecked}
							onChange={() => isEditing && onChange(flag)}
							className="w-4 h-4 border border-blue-300 shrink-0 accent-blue-700"
							tabIndex={isEditing ? 0 : -1}
						/>
						<span
							className={`text-sm whitespace-nowrap ${
								!isEditing && isChecked ? 'font-semibold text-blue-800' : 'text-blue-900'
							}`}
						>
							{flag === '1' ? '실시' : '미실시'}
						</span>
					</label>
				);
			})}
		</div>
	);

	const renderFieldRow = (label: string, children: ReactNode) => (
		<div className="flex items-center gap-2 min-w-0 w-full">
			<label className={fieldLabelClass}>{label}</label>
			{children}
		</div>
	);

	const preparerDisplayValue = String(preparerSearchTerm || preparerName || '').trim();
	const cognitivePreparerDisplayValue = String(cognitivePreparerSearchTerm || cognitivePreparerName || '').trim();
	const readModeTextClass = 'text-sm font-semibold text-blue-800';

	const renderEmployeeField = (
		displayValue: string,
		searchTerm: string,
		setName: (v: string) => void,
		setSearchTerm: (v: string) => void,
		suggestions: Array<{EMPNO: string; EMPNM: string}>,
		showDropdown: boolean,
		setSuggestions: (data: Array<{EMPNO: string; EMPNM: string}>) => void,
		setShowDropdown: (show: boolean) => void,
		placeholder: string
	) =>
		!isEditing ? (
			<span className={readModeTextClass}>{displayValue}</span>
		) : (
			<div className="relative flex-1 employee-dropdown-container">
				<input
					type="text"
					value={searchTerm || displayValue}
					onChange={(e) => {
						const value = e.target.value;
						setName(value);
						setSearchTerm(value);
						if (!value || value.trim() === '') {
							setSuggestions([]);
							setShowDropdown(false);
						}
					}}
					onFocus={() => {
						if (displayValue) setSearchTerm(displayValue);
						if (searchTerm && searchTerm.trim() !== '') {
							searchEmployee(searchTerm, setSuggestions, setShowDropdown);
						}
					}}
					className="w-full px-2 py-1 text-sm bg-white border border-blue-300 rounded"
					placeholder={placeholder}
				/>
				{showDropdown && suggestions.length > 0 && (
					<div className="absolute z-10 w-full mt-1 overflow-y-auto bg-white border border-blue-300 rounded shadow-lg max-h-40">
						{suggestions.map((employee, index) => (
							<div
								key={`${employee.EMPNO}-${index}`}
								onClick={() => {
									setName(employee.EMPNM);
									setSearchTerm(employee.EMPNM);
									setShowDropdown(false);
								}}
								className="px-3 py-2 text-sm border-b border-blue-100 cursor-pointer hover:bg-blue-50 last:border-b-0"
							>
								{employee.EMPNM}
							</div>
						))}
					</div>
				)}
			</div>
		);

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="mx-auto w-full max-w-[1400px] min-w-0 p-3 sm:p-4">
				<div className="flex flex-col lg:flex-row gap-4 min-w-0">
					<aside className="w-full lg:w-1/3 lg:max-w-md shrink-0 min-w-0">
						<MemberListPanel onSelectMember={handleSelectMember} />
					</aside>

					<ServiceDateListPanel
						selectedMember={Boolean(selectedMember)}
						serviceDates={serviceDates}
						selectedDateIndex={selectedDateIndex}
						loading={loadingServiceDates}
						page={serviceDatePage}
						onSelectDate={(i) => { void handleSelectDate(i); }}
						onPageChange={setServiceDatePage}
					/>

					<section className="flex-1 min-w-0 relative">
						<div className={selectionBlockedClass(!selectedMember || selectedDateIndex == null)}>
						<div className="mb-3 flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2">
							<div className="text-sm text-blue-900">
								{selectedMember ? (
									<>
										<span className="font-semibold">{String(selectedMember.P_NM ?? '').trim() || '선택됨'}</span>
										<span className="ml-2 text-blue-900/70">PNUM: {selectedPnum || '-'}</span>
										{loadingDefaults && <span className="ml-2 text-blue-900/70">불러오는 중...</span>}
									</>
								) : (
									<span className="text-blue-900/70">왼쪽에서 수급자를 선택해주세요.</span>
								)}
							</div>
							<div className="flex gap-2">
								{isEditing ? (
									<>
										<button
											type="button"
											onClick={handleSaveEdit}
											disabled={!selectedPnum || loadingDefaults}
											className="px-4 py-1.5 text-sm font-medium text-green-900 bg-green-200 border border-green-400 rounded hover:bg-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											저장
										</button>
										<button
											type="button"
											onClick={handleCancelEdit}
											className="px-4 py-1.5 text-sm font-medium text-red-900 bg-red-200 border border-red-400 rounded hover:bg-red-300"
										>
											취소
										</button>
									</>
								) : (
									<button
										type="button"
										onClick={handleEnterEdit}
										disabled={!selectedPnum || loadingDefaults}
										className="px-4 py-1.5 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										수정
									</button>
								)}
							</div>
						</div>
						<div className="bg-white border border-blue-300 rounded-lg shadow-sm min-w-0">
							<div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
								<h2 className="text-xl font-semibold text-blue-900">기능인지</h2>
							</div>

							<div className="p-4 min-w-0">
								<div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3 min-w-0">
									<div className="space-y-3">
										{renderFieldRow(
											'신체·인지기능 향상 프로그램',
											renderYnRadios('fnCognHelp', physicalCognitiveProgram, setPhysicalCognitiveProgram)
										)}
										{renderFieldRow(
											'신체기능·기본동작 일상생활활동훈련',
											renderYnRadios('fnMoveHelp', physicalFunctionTraining, setPhysicalFunctionTraining)
										)}
										{renderFieldRow(
											'인지기능 향상훈련',
											renderYnRadios('fnMindTrain', cognitiveTraining, setCognitiveTraining)
										)}
										{renderFieldRow(
											'물리치료작업',
											renderYnRadios('fnPhyHelp', physicalTherapy, setPhysicalTherapy)
										)}
										{renderFieldRow(
											'작성자성명',
											renderEmployeeField(
												preparerDisplayValue,
												preparerSearchTerm,
												setPreparerName,
												setPreparerSearchTerm,
												preparerSuggestions,
												showPreparerDropdown,
												setPreparerSuggestions,
												setShowPreparerDropdown,
												'작성자 검색'
											)
										)}
									</div>

									<div className="space-y-3">
										{renderFieldRow(
											'인지관리지원',
											renderYnRadios('rgAidHelp', cognitiveSupport, setCognitiveSupport)
										)}
										{renderFieldRow(
											'인지관리-의사소통도움 등 말벗,격려',
											renderYnRadios('rgTalkHelp', communicationSupport, setCommunicationSupport)
										)}
										{renderFieldRow(
											'인지관리 작성자성명',
											renderEmployeeField(
												cognitivePreparerDisplayValue,
												cognitivePreparerSearchTerm,
												setCognitivePreparerName,
												setCognitivePreparerSearchTerm,
												cognitivePreparerSuggestions,
												showCognitivePreparerDropdown,
												setCognitivePreparerSuggestions,
												setShowCognitivePreparerDropdown,
												'인지관리 작성자 검색'
											)
										)}
									</div>
								</div>
							</div>
						</div>
						</div>
						<SelectionRequiredOverlay
							selectedMember={Boolean(selectedMember)}
							selectedDate={selectedDateIndex != null}
						/>
					</section>
				</div>
			</div>
		</div>
	);
}

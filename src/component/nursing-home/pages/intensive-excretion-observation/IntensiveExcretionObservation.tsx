"use client";

/**
 * @file 집중배설관찰 — 화면 컴포넌트 (IntensiveExcretionObservation.tsx)
 *
 * @description
 * 요양원 집중배설관찰 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/intensive-excretion-observation
 *
 * @module component/nursing-home/pages/intensive-excretion-observation/IntensiveExcretionObservation
 */
import React, { useState, useEffect } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { attachLatestRoomNoByPnum } from '../../utils/roomNoFloor';
import { RoomNoFloorSelect } from '../../components/RoomNoFloorSelect';
import { matchesSelectedFloor } from '../../utils/roomNoFloorFilter';
import { amtGuToLabel, formatDateYmd, isCheckedFlag, normalizeAmtGu, toCheckFlag } from '../../utils/excretionObservationFields';
import {
	buildIntensiveExcretionPrintHtml,
	currentYearMonth,
	monthRange,
	openIntensiveExcretionPrint,
} from './intensiveExcretionPrint';

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

interface ObservationData {
	ANCD?: string | number;
	PNUM?: string | number;
	VDT?: string;
	VTM_GU?: string;
	VTM_ST?: string;
	PSS_GU?: string;
	DNG_GU?: string;
	PSS_AMT_GU?: string;
	DNG_AMT_GU?: string;
	NPPY_CNG_GU?: string;
	NPPY_CNG_TM?: string;
	ETC?: string;
	INEMPNO?: string | number | null;
	INEMPNM?: string | null;
	OBSDT: string;
	OBSTM: string;
	URINE: string;
	STOOL: string;
	DIAPER: string;
	OBSERVER: string;
	[key: string]: unknown;
}

const timeInputClass =
	'w-14 px-2 py-1.5 text-sm text-center border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed disabled:text-blue-900';
const fieldCls =
	'flex-1 px-3 py-1.5 text-sm border rounded focus:outline-none focus:border-blue-500';
const fieldEditCls = `${fieldCls} border-blue-300 bg-white`;
const fieldReadCls = `${fieldCls} border-blue-200 bg-gray-50 text-blue-900 cursor-default`;
const checkboxCls =
	'w-4 h-4 rounded border-blue-400 accent-blue-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0';

type IntensiveForm = {
	beneficiary: string;
	observationDate: string;
	observationTime: string;
	originalVtmGu: string;
	urineAmt: string;
	stoolAmt: string;
	diaperChange: boolean;
	diaperChangeTime: string;
	other: string;
	observer: string;
	observerNo: string;
};

type EmpSuggest = { EMPNO: string | number; EMPNM: string };

function empNoKey(v: unknown): string {
	const s = String(v ?? '').trim();
	if (!s || s === '0') return '';
	return s;
}

async function resolveEmployeeName(empno: string): Promise<string> {
	if (!empno) return '';
	try {
		const res = await fetch(`/api/f01010?empno=${encodeURIComponent(empno)}`);
		const json = await res.json().catch(() => ({}));
		const emp = Array.isArray(json?.data) ? json.data[0] : null;
		return String(emp?.EMPNM ?? '').trim();
	} catch {
		return '';
	}
}

async function fillObserverNames(rows: ObservationData[]): Promise<ObservationData[]> {
	const nos = Array.from(
		new Set(
			rows
				.filter((r) => !String(r.OBSERVER || r.INEMPNM || '').trim() && empNoKey(r.INEMPNO))
				.map((r) => empNoKey(r.INEMPNO))
		)
	);
	if (nos.length === 0) return rows;
	const map = new Map<string, string>();
	await Promise.all(
		nos.map(async (no) => {
			const nm = await resolveEmployeeName(no);
			if (nm) map.set(no, nm);
		})
	);
	return rows.map((r) => {
		const existing = String(r.OBSERVER || r.INEMPNM || '').trim();
		const resolved = existing || map.get(empNoKey(r.INEMPNO)) || '';
		return { ...r, OBSERVER: resolved, INEMPNM: resolved || r.INEMPNM };
	});
}

function splitHm(value: string): { hour: string; minute: string } {
	const hm = String(value ?? '').trim();
	const m = /^(\d{0,2}):(\d{0,2})$/.exec(hm);
	if (m) return { hour: m[1], minute: m[2] };
	return { hour: '', minute: '' };
}

function padTimePart(raw: string, max: number): string {
	const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 2);
	if (!digits) return '';
	const n = Math.min(max, Math.max(0, Number(digits)));
	if (!Number.isFinite(n)) return '';
	return String(n).padStart(2, '0');
}

function joinRawHm(hour: string, minute: string): string {
	if (!hour && !minute) return '';
	return `${hour}:${minute}`;
}

function normalizeHm(hour: string, minute: string): string {
	if (!hour && !minute) return '';
	return `${padTimePart(hour, 23) || '00'}:${padTimePart(minute, 59) || '00'}`;
}

function vtmGuToHm(vtmGu: string): string {
	const gu = String(vtmGu ?? '').trim();
	if (/^\d{1,2}$/.test(gu)) return `${gu.padStart(2, '0')}:00`;
	return '';
}

function formatHmValue(v: unknown): string {
	const st = String(v ?? '').trim();
	if (/^\d{1,2}:\d{2}$/.test(st)) {
		const [h, m] = st.split(':');
		return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
	}
	return '';
}

function formatObsTime(row: { VTM_ST?: unknown; VTM_GU?: unknown }): string {
	return formatHmValue(row?.VTM_ST) || vtmGuToHm(String(row?.VTM_GU ?? ''));
}

function listAmtLabel(amt: unknown, flag: unknown): string {
	const label = amtGuToLabel(amt);
	if (label) return label;
	return isCheckedFlag(flag) ? '보통' : '-';
}

function listDiaperTime(diaperFlag: unknown, time: unknown): string {
	if (!isCheckedFlag(diaperFlag)) return '-';
	return formatHmValue(time) || '00:00';
}

function AmountRadios({
	name,
	value,
	onChange,
	disabled,
}: {
	name: string;
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
}) {
	const options = [
		{ code: '1', label: '소량' },
		{ code: '2', label: '보통' },
		{ code: '3', label: '대량' },
	] as const;

	return (
		<div className="flex flex-wrap items-center gap-3">
			{options.map((opt) => (
				<label
					key={opt.code}
					className={`flex items-center gap-1 text-sm text-blue-900 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
				>
					<input
						type="radio"
						name={name}
						value={opt.code}
						checked={value === opt.code}
						tabIndex={disabled ? -1 : 0}
						onChange={() => {
							if (!disabled) onChange(opt.code);
						}}
						onClick={(e) => {
							if (disabled) return;
							if (value === opt.code) {
								e.preventDefault();
								onChange('');
							}
						}}
						className={`${checkboxCls} ${disabled ? 'pointer-events-none cursor-default' : 'cursor-pointer'}`}
					/>
					{opt.label}
				</label>
			))}
		</div>
	);
}

function TimeHmInput({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
}) {
	const { hour, minute } = splitHm(value);

	return (
		<div className="flex items-center gap-1 min-w-0">
			<input
				type="text"
				inputMode="numeric"
				maxLength={2}
				value={hour}
				disabled={disabled}
				readOnly={disabled}
				onChange={(e) => {
					if (disabled) return;
					onChange(joinRawHm(e.target.value.replace(/\D/g, '').slice(0, 2), minute));
				}}
				onBlur={() => {
					if (disabled || (!hour && !minute)) return;
					onChange(normalizeHm(hour, minute));
				}}
				className={timeInputClass}
				placeholder="시"
				aria-label="시"
			/>
			<span className="text-sm text-blue-900">:</span>
			<input
				type="text"
				inputMode="numeric"
				maxLength={2}
				value={minute}
				disabled={disabled}
				readOnly={disabled}
				onChange={(e) => {
					if (disabled) return;
					onChange(joinRawHm(hour, e.target.value.replace(/\D/g, '').slice(0, 2)));
				}}
				onBlur={() => {
					if (disabled || (!hour && !minute)) return;
					onChange(normalizeHm(hour, minute));
				}}
				className={timeInputClass}
				placeholder="분"
				aria-label="분"
			/>
		</div>
	);
}

export default function IntensiveExcretionObservation() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [selectedObservationIndex, setSelectedObservationIndex] = useState<number | null>(null);
	const [isNewMode, setIsNewMode] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<IntensiveForm | null>(null);
	const [observationDates, setObservationDates] = useState<string[]>([]);
	const [observationList, setObservationList] = useState<ObservationData[]>([]);
	const [loadingObservations, setLoadingObservations] = useState(false);
	const [observationDatePage, setObservationDatePage] = useState(1);
	const observationDateItemsPerPage = 10;
	const [observationListPage, setObservationListPage] = useState(1);
	const observationListItemsPerPage = 10;

	const emptyIntensiveForm = (beneficiary = '', observer = '', observerNo = ''): IntensiveForm => ({
		beneficiary,
		observationDate: formatDateYmd(new Date().toISOString()),
		observationTime: '',
		originalVtmGu: '',
		urineAmt: '',
		stoolAmt: '',
		diaperChange: false,
		diaperChangeTime: '',
		other: '',
		observer,
		observerNo,
	});

	const [formData, setFormData] = useState(emptyIntensiveForm());
	const [defaultObserver, setDefaultObserver] = useState({ empno: '', empnm: '' });
	const [observerSearchTerm, setObserverSearchTerm] = useState('');
	const [observerSuggestions, setObserverSuggestions] = useState<EmpSuggest[]>([]);
	const [showObserverDropdown, setShowObserverDropdown] = useState(false);
	const [printMonth, setPrintMonth] = useState(currentYearMonth);
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(new Set());
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

	const memberKey = (m: Pick<MemberData, 'ANCD' | 'PNUM'>) => `${m.ANCD}-${m.PNUM}`;

	const allFilteredChecked =
		filteredMembers.length > 0 && filteredMembers.every((m) => checkedMemberKeys.has(memberKey(m)));

	const toggleMemberChecked = (member: MemberData, checked: boolean) => {
		setCheckedMemberKeys((prev) => {
			const next = new Set(prev);
			const key = memberKey(member);
			if (checked) next.add(key);
			else next.delete(key);
			return next;
		});
	};

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

	useEffect(() => {
		fetchMembers();
		void (async () => {
			try {
				const res = await fetch('/api/auth/user-info', { credentials: 'include', cache: 'no-store' });
				const result = await res.json().catch(() => ({}));
				if (res.ok && result?.success) {
					const name = String(result?.data?.empnm ?? result?.data?.EMPNM ?? '').trim();
					const empno = empNoKey(result?.data?.empno ?? result?.data?.EMPNO);
					setDefaultObserver({ empno, empnm: name });
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

	// 관찰일자 목록 조회
	const fetchObservationDates = async (ancd: string, pnum: string) => {
		if (!ancd || !pnum) {
			setObservationDates([]);
			return [] as string[];
		}

		setLoadingObservations(true);
		try {
			const url = `/api/f33020?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(pnum)}&mode=dates`;
			const response = await fetch(url, { method: 'GET' });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || '관찰일자 조회 실패');
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const dates: string[] = list
				.map((r: { VDT?: string }) => formatDateYmd(String(r?.VDT ?? '')))
				.filter((d: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d));
			setObservationDates(dates);
			return dates;
		} catch (err) {
			console.error('관찰일자 조회 오류:', err);
			setObservationDates([]);
			return [] as string[];
		} finally {
			setLoadingObservations(false);
		}
	};

	// 관찰 데이터 목록 조회
	const fetchObservations = async (ancd: string, pnum: string, date: string): Promise<ObservationData[]> => {
		if (!ancd || !pnum || !date) {
			setObservationList([]);
			return [] as ObservationData[];
		}

		setLoadingObservations(true);
		try {
			const url = `/api/f33020?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(
				pnum
			)}&vdt=${encodeURIComponent(date)}`;
			const response = await fetch(url, { method: 'GET' });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || '관찰 데이터 조회 실패');
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const mapped: ObservationData[] = list.map((r: ObservationData) => {
				const time = formatObsTime(r);
				const name = String(r.INEMPNM ?? '').trim();
				const urineAmt = normalizeAmtGu(r.PSS_AMT_GU);
				const stoolAmt = normalizeAmtGu(r.DNG_AMT_GU);
				const diaperTime = formatHmValue(r.NPPY_CNG_TM);
				return {
					...r,
					OBSDT: formatDateYmd(r.VDT),
					OBSTM: time || '-',
					VTM_ST: time,
					PSS_AMT_GU: urineAmt,
					DNG_AMT_GU: stoolAmt,
					NPPY_CNG_TM: diaperTime,
					URINE: urineAmt || String(r.PSS_GU ?? '0'),
					STOOL: stoolAmt || String(r.DNG_GU ?? '0'),
					DIAPER: String(r.NPPY_CNG_GU ?? '0'),
					INEMPNO: r.INEMPNO ?? null,
					INEMPNM: name,
					OBSERVER: name,
				};
			});
			const withNames = await fillObserverNames(mapped);
			setObservationList(withNames);
			return withNames;
		} catch (err) {
			console.error('관찰 데이터 조회 오류:', err);
			setObservationList([]);
			return [] as ObservationData[];
		} finally {
			setLoadingObservations(false);
		}
	};

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
		setObserverSearchTerm('');
		setObserverSuggestions([]);
		setShowObserverDropdown(false);
	};

	const applyObservationToForm = (observation: ObservationData) => {
		const time = formatObsTime(observation);
		const observer = String(observation.OBSERVER ?? observation.INEMPNM ?? '').trim();
		const observerNo = empNoKey(observation.INEMPNO);
		setFormData({
			beneficiary: selectedMember?.P_NM || '',
			observationDate: observation.OBSDT || '',
			observationTime: time,
			originalVtmGu: String(observation.VTM_GU ?? ''),
			urineAmt: normalizeAmtGu(observation.PSS_AMT_GU) || (isCheckedFlag(observation.URINE) ? '2' : ''),
			stoolAmt: normalizeAmtGu(observation.DNG_AMT_GU) || (isCheckedFlag(observation.STOOL) ? '2' : ''),
			diaperChange: isCheckedFlag(observation.DIAPER),
			diaperChangeTime: formatHmValue(observation.NPPY_CNG_TM),
			other: String(observation.ETC ?? ''),
			observer,
			observerNo,
		});
		setObserverSearchTerm(observer);
		if (!observer && observerNo) {
			void resolveEmployeeName(observerNo).then((nm) => {
				if (!nm) return;
				setFormData((prev) => (prev.observer ? prev : { ...prev, observer: nm }));
				setObserverSearchTerm((prev) => prev || nm);
			});
		}
	};

	// 수급자 선택 함수
	const handleSelectMember = (member: MemberData) => {
		exitEditMode();
		setSelectedMember(member);
		setSelectedDateIndex(null);
		setSelectedObservationIndex(null);
		setIsNewMode(false);
		setObservationList([]);
		setFormData(emptyIntensiveForm(member.P_NM || '', ''));
		fetchObservationDates(member.ANCD, member.PNUM);
	};

	const handleSelectDate = (index: number) => {
		exitEditMode();
		setSelectedDateIndex(index);
		const selectedDate = observationDates[index];
		if (selectedMember && selectedDate) {
			fetchObservations(selectedMember.ANCD, selectedMember.PNUM, selectedDate);
		}
		setFormData((prev) => ({ ...emptyIntensiveForm(selectedMember?.P_NM || prev.beneficiary, ''), observationDate: selectedDate || '' }));
		setSelectedObservationIndex(null);
		setIsNewMode(false);
	};

	const handleSelectObservation = (index: number, observation: ObservationData) => {
		if (isEditMode && !confirm('수정 중인 내용이 저장되지 않습니다. 이동할까요?')) return;
		exitEditMode();
		setSelectedObservationIndex(index);
		setIsNewMode(false);
		applyObservationToForm(observation);
	};

	const handleNew = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (isEditMode && !confirm('수정 중인 내용이 저장되지 않습니다. 신규 등록을 진행할까요?')) {
			return;
		}

		const today = formatDateYmd(new Date().toISOString());
		const selectedDate = selectedDateIndex !== null ? observationDates[selectedDateIndex] : '';
		setSelectedObservationIndex(null);
		setIsNewMode(true);
		setIsEditMode(true);
		setEditingBackup(null);
		setFormData({
			...emptyIntensiveForm(selectedMember.P_NM || '', defaultObserver.empnm, defaultObserver.empno),
			observationDate: selectedDate || today,
		});
		setObserverSearchTerm(defaultObserver.empnm);
		setObserverSuggestions([]);
		setShowObserverDropdown(false);
	};

	const handleModify = () => {
		if (selectedObservationIndex === null) {
			alert('수정할 관찰 데이터를 선택해주세요.');
			return;
		}
		setEditingBackup(JSON.parse(JSON.stringify(formData)) as IntensiveForm);
		setObserverSearchTerm(formData.observer);
		setObserverSuggestions([]);
		setShowObserverDropdown(false);
		setIsEditMode(true);
	};

	const handleCancelEdit = () => {
		if (isNewMode) {
			exitEditMode();
			setIsNewMode(false);
			setFormData(emptyIntensiveForm(selectedMember?.P_NM || '', ''));
			return;
		}
		if (editingBackup) {
			const restored = JSON.parse(JSON.stringify(editingBackup)) as IntensiveForm;
			setFormData(restored);
			exitEditMode();
			setObserverSearchTerm(restored.observer);
			return;
		}
		if (selectedObservationIndex !== null) {
			const row = observationList[selectedObservationIndex];
			if (row) applyObservationToForm(row);
		}
		exitEditMode();
	};

	const searchObservers = async (term: string) => {
		if (!term || term.trim() === '') {
			setObserverSuggestions([]);
			setShowObserverDropdown(false);
			return;
		}
		try {
			const url = `/api/f01010?q=${encodeURIComponent(term.trim())}`;
			const response = await fetch(url);
			const result = await response.json().catch(() => ({}));
			if (result.success && Array.isArray(result.data)) {
				setObserverSuggestions(result.data);
				setShowObserverDropdown(result.data.length > 0);
			} else {
				setObserverSuggestions([]);
				setShowObserverDropdown(false);
			}
		} catch (err) {
			console.error('관찰자 검색 오류:', err);
			setObserverSuggestions([]);
			setShowObserverDropdown(false);
		}
	};

	const handleSelectObserver = (employee: EmpSuggest) => {
		const name = String(employee.EMPNM || '').trim();
		const no = empNoKey(employee.EMPNO);
		setFormData((prev) => ({
			...prev,
			observer: name,
			observerNo: no,
		}));
		setObserverSearchTerm(name);
		setShowObserverDropdown(false);
	};

	useEffect(() => {
		if (!isEditMode) return;
		const timer = setTimeout(() => {
			if (observerSearchTerm.trim() && !formData.observerNo) {
				void searchObservers(observerSearchTerm);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [observerSearchTerm, isEditMode, formData.observerNo]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('.observer-dropdown-container')) {
				setShowObserverDropdown(false);
			}
		};
		if (showObserverDropdown) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [showObserverDropdown]);

	const fetchPrintRows = async (member: MemberData, start: string, end: string): Promise<ObservationData[]> => {
		const url = `/api/f33020?ancd=${encodeURIComponent(String(member.ANCD))}&pnum=${encodeURIComponent(
			String(member.PNUM)
		)}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
		const response = await fetch(url, { cache: 'no-store' });
		const result = await response.json().catch(() => ({}));
		if (!response.ok || !result?.success) {
			throw new Error(result?.error || '관찰 데이터 조회 실패');
		}
		const list = Array.isArray(result.data) ? result.data : [];
		const mapped: ObservationData[] = list.map((r: ObservationData) => {
			const time = formatObsTime(r);
			const name = String(r.INEMPNM ?? '').trim();
			const urineAmt = normalizeAmtGu(r.PSS_AMT_GU);
			const stoolAmt = normalizeAmtGu(r.DNG_AMT_GU);
			const diaperTime = formatHmValue(r.NPPY_CNG_TM);
			return {
				...r,
				VDT: formatDateYmd(r.VDT) || formatDateYmd(r.OBSDT),
				OBSDT: formatDateYmd(r.VDT) || formatDateYmd(r.OBSDT),
				OBSTM: time || '-',
				VTM_ST: time,
				PSS_GU: String(r.PSS_GU ?? '0'),
				DNG_GU: String(r.DNG_GU ?? '0'),
				PSS_AMT_GU: urineAmt,
				DNG_AMT_GU: stoolAmt,
				NPPY_CNG_GU: String(r.NPPY_CNG_GU ?? '0'),
				NPPY_CNG_TM: diaperTime,
				URINE: urineAmt || String(r.PSS_GU ?? '0'),
				STOOL: stoolAmt || String(r.DNG_GU ?? '0'),
				DIAPER: String(r.NPPY_CNG_GU ?? '0'),
				INEMPNO: r.INEMPNO ?? null,
				INEMPNM: name,
				OBSERVER: name,
				ETC: String(r.ETC ?? ''),
			};
		});
		return fillObserverNames(mapped);
	};

	const handlePeriodPrint = async () => {
		if (checkedMemberKeys.size === 0) {
			alert('출력할 수급자를 체크해주세요.');
			return;
		}
		const range = monthRange(printMonth);
		if (!range) {
			alert('출력 월을 선택해주세요.');
			return;
		}
		const targets = memberList.filter((m) => checkedMemberKeys.has(memberKey(m)));
		if (targets.length === 0) {
			alert('체크된 수급자를 찾을 수 없습니다.');
			return;
		}

		setPrinting(true);
		try {
			const items = [];
			for (const member of targets) {
				const rows = await fetchPrintRows(member, range.start, range.end);
				items.push({ member, rows });
			}
			const html = buildIntensiveExcretionPrintHtml({
				year: range.year,
				month: range.month,
				days: range.days,
				items,
			});
			openIntensiveExcretionPrint(html);
		} catch (err) {
			console.error('집중배설관찰 출력 오류:', err);
			alert('출력 준비 중 오류가 발생했습니다.');
		} finally {
			setPrinting(false);
		}
	};

	const handleBlankPrint = () => {
		const range = monthRange(printMonth);
		if (!range) {
			alert('출력 월을 선택해주세요.');
			return;
		}
		const targets = memberList.filter((m) => checkedMemberKeys.has(memberKey(m)));
		const items =
			targets.length > 0
				? targets.map((member) => ({ member, rows: [] as ObservationData[] }))
				: [{ member: { P_NM: '', P_GRD: '' }, rows: [] as ObservationData[] }];
		const html = buildIntensiveExcretionPrintHtml({
			year: range.year,
			month: range.month,
			days: range.days,
			blank: true,
			items,
		});
		openIntensiveExcretionPrint(html);
	};

	const formatDateDisplay = formatDateYmd;

	const formatTimeDisplay = (observation: ObservationData) =>
		observation.OBSTM || formatObsTime(observation) || '-';

	// 저장 함수
	const handleSave = async () => {
		if (!isEditMode) return;
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (!formData.observationDate) {
			alert('관찰일자를 입력해주세요.');
			return;
		}

		if (!formData.observationTime) {
			alert('관찰시간(시, 분)을 입력해주세요.');
			return;
		}

		const { hour, minute } = splitHm(formData.observationTime);
		if (!hour) {
			alert('관찰시간(시, 분)을 입력해주세요.');
			return;
		}
		const observationTime = normalizeHm(hour, minute);
		if (!/^\d{2}:\d{2}$/.test(observationTime)) {
			alert('관찰시간 형식이 올바르지 않습니다.');
			return;
		}

		let diaperChangeTime = '';
		if (formData.diaperChange) {
			const diaperHm = splitHm(formData.diaperChangeTime);
			if (!diaperHm.hour) {
				alert('기저귀 교환 시간을 입력해주세요.');
				return;
			}
			diaperChangeTime = normalizeHm(diaperHm.hour, diaperHm.minute);
			if (!/^\d{2}:\d{2}$/.test(diaperChangeTime)) {
				alert('기저귀 교환 시간 형식이 올바르지 않습니다.');
				return;
			}
		}

		if (isNewMode && formData.observer.trim() && !formData.observerNo) {
			alert('관찰자를 검색 목록에서 선택해주세요.');
			return;
		}

		setLoadingObservations(true);
		try {
			const payload = {
				PNUM: selectedMember.PNUM,
				VDT: formData.observationDate,
				MATCH_VTM_GU: isNewMode ? undefined : formData.originalVtmGu || undefined,
				VTM_ST: observationTime,
				PSS_GU: toCheckFlag(!!formData.urineAmt),
				DNG_GU: toCheckFlag(!!formData.stoolAmt),
				PSS_AMT_GU: formData.urineAmt || '0',
				DNG_AMT_GU: formData.stoolAmt || '0',
				NPPY_CNG_GU: toCheckFlag(formData.diaperChange),
				NPPY_CNG_TM: diaperChangeTime,
				ETC: formData.other.trim(),
				INEMPNO: formData.observerNo && /^\d+$/.test(formData.observerNo) ? Number(formData.observerNo) : null,
				INEMPNM: formData.observer.trim() || null,
			};

			const res = await fetch(`/api/f33020?ancd=${encodeURIComponent(selectedMember.ANCD)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '관찰 데이터 저장 실패');
			}

			alert(isNewMode ? '관찰 데이터가 저장되었습니다.' : '관찰 데이터가 수정되었습니다.');

			const keepVtmGu = String(formData.originalVtmGu || result?.data?.VTM_GU || '');
			const dates = await fetchObservationDates(selectedMember.ANCD, selectedMember.PNUM);
			let list: ObservationData[] = [];
			if (formData.observationDate) {
				const dateIdx = dates.indexOf(formData.observationDate);
				setSelectedDateIndex(dateIdx >= 0 ? dateIdx : null);
				list = await fetchObservations(selectedMember.ANCD, selectedMember.PNUM, formData.observationDate);
			}

			exitEditMode();
			setIsNewMode(false);

			const idx = keepVtmGu
				? list.findIndex((r) => String(r.VTM_GU ?? '') === keepVtmGu)
				: -1;
			if (idx >= 0) {
				setSelectedObservationIndex(idx);
				applyObservationToForm(list[idx]);
			} else if (list.length > 0) {
				setSelectedObservationIndex(0);
				applyObservationToForm(list[0]);
			} else {
				setSelectedObservationIndex(null);
				setFormData(emptyIntensiveForm(selectedMember.P_NM || '', ''));
			}
		} catch (err) {
			console.error('관찰 데이터 저장 오류:', err);
			alert('관찰 데이터 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingObservations(false);
		}
	};

	// 삭제 함수
	const handleDelete = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (selectedObservationIndex === null) {
			alert('삭제할 관찰 데이터를 선택해주세요.');
			return;
		}

		if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			return;
		}

		setLoadingObservations(true);
		try {
			const observationToDelete = observationList[selectedObservationIndex];
			const vdt = formatDateDisplay(observationToDelete.OBSDT || formData.observationDate || '');
			const vtmGu = String(observationToDelete.VTM_GU ?? '');
			if (!vtmGu) {
				alert('삭제할 관찰시간의 식별값을 찾지 못했습니다.');
				setLoadingObservations(false);
				return;
			}
			const url = `/api/f33020?ancd=${encodeURIComponent(selectedMember.ANCD)}&pnum=${encodeURIComponent(
				selectedMember.PNUM
			)}&vdt=${encodeURIComponent(vdt)}&vtmGu=${encodeURIComponent(vtmGu)}`;
			const res = await fetch(url, { method: 'DELETE' });
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '관찰 데이터 삭제 실패');
			}

			alert('관찰 데이터가 삭제되었습니다.');
			
			await fetchObservationDates(selectedMember.ANCD, selectedMember.PNUM);
			if (selectedMember && formData.observationDate) {
				await fetchObservations(selectedMember.ANCD, selectedMember.PNUM, formData.observationDate);
			}

			setFormData(emptyIntensiveForm(selectedMember.P_NM || '', ''));
			setSelectedObservationIndex(null);
			setIsNewMode(false);
			exitEditMode();
		} catch (err) {
			console.error('관찰 데이터 삭제 오류:', err);
			alert('관찰 데이터 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingObservations(false);
		}
	};

	// 관찰 데이터 목록 페이지네이션
	const observationListTotalPages = Math.ceil(observationList.length / observationListItemsPerPage);
	const observationListStartIndex = (observationListPage - 1) * observationListItemsPerPage;
	const observationListEndIndex = observationListStartIndex + observationListItemsPerPage;
	const currentObservations = observationList.slice(observationListStartIndex, observationListEndIndex);

	// 관찰일자 목록 페이지네이션
	const observationDateTotalPages = Math.ceil(observationDates.length / observationDateItemsPerPage);
	const observationDateStartIndex = (observationDatePage - 1) * observationDateItemsPerPage;
	const observationDateEndIndex = observationDateStartIndex + observationDateItemsPerPage;
	const currentDateItems = observationDates.slice(observationDateStartIndex, observationDateEndIndex);

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				{/* 좌측 패널: 수급자 목록 */}
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 p-4 bg-white border-r border-blue-200 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden">
					<div className="mb-3 p-2 space-y-2 border border-blue-200 rounded-lg bg-blue-50/60">
						<div className="text-xs font-semibold text-blue-900">출력 기간 (월)</div>
						<input
							type="month"
							value={printMonth}
							onChange={(e) => setPrintMonth(e.target.value)}
							className="w-full px-2 py-1 text-xs bg-white border border-blue-300 rounded"
						/>
						<button
							type="button"
							onClick={() => void handlePeriodPrint()}
							disabled={printing || checkedMemberKeys.size === 0}
							className="w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{printing ? '출력 준비 중...' : `조회 후 출력 (${checkedMemberKeys.size}명)`}
						</button>
						<button
							type="button"
							onClick={handleBlankPrint}
							disabled={printing}
							className="w-full px-2 py-1.5 text-xs font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							빈양식 출력
						</button>
					</div>

					{/* 필터 헤더 */}
					<div className="mb-3">
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
										<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">
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
														aria-label={`${member.P_NM || '수급자'} 선택`}
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

				{/* 중간-왼쪽 패널: 관찰일자 목록 */}
				<div className="flex flex-col w-full xl:w-[10rem] min-w-0 shrink-0 px-2 py-3 border-r border-blue-200 bg-blue-50 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="mb-2">
						<label className="text-sm font-medium text-blue-900">관찰일자</label>
						<button
							type="button"
							onClick={handleNew}
							className="w-full mt-1 px-2 py-1 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto">
							{loadingObservations ? (
								<div className="px-1 py-1 text-sm text-blue-900/60">로딩 중...</div>
							) : observationDates.length === 0 ? (
								<div className="px-1 py-1 text-sm text-blue-900/60">
									{selectedMember ? '관찰일자가 없습니다' : '수급자를 선택해주세요'}
								</div>
							) : (
								currentDateItems.map((date, localIndex) => {
									const globalIndex = observationDateStartIndex + localIndex;
									return (
										<div
											key={globalIndex}
											onClick={() => handleSelectDate(globalIndex)}
											className={`px-1 py-1.5 text-base text-left whitespace-nowrap cursor-pointer hover:bg-blue-100 rounded ${
												selectedDateIndex === globalIndex ? 'bg-blue-200 font-semibold' : ''
											}`}
										>
											{formatDateDisplay(date)}
										</div>
									);
								})
							)}
						</div>
						{/* 관찰일자 페이지네이션 */}
						{observationDateTotalPages > 1 && (
							<div className="p-1 mt-2">
								<div className="flex flex-wrap items-center justify-center gap-1">
									<button
										onClick={() => setObservationDatePage(1)}
										disabled={observationDatePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										onClick={() => setObservationDatePage(prev => Math.max(1, prev - 1))}
										disabled={observationDatePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;
									</button>
									
									{Array.from({ length: Math.min(5, observationDateTotalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(observationDateTotalPages - 4, observationDatePage - 2)) + i;
										if (pageNum > observationDateTotalPages) return null;
										return (
											<button
												key={pageNum}
												onClick={() => setObservationDatePage(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${
													observationDatePage === pageNum
														? 'bg-blue-500 text-white border-blue-500'
														: 'border-blue-300 hover:bg-blue-50'
												}`}
											>
												{pageNum}
											</button>
										);
									}).filter(Boolean)}
									
									<button
										onClick={() => setObservationDatePage(prev => Math.min(observationDateTotalPages, prev + 1))}
										disabled={observationDatePage >= observationDateTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										onClick={() => setObservationDatePage(observationDateTotalPages)}
										disabled={observationDatePage >= observationDateTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;&gt;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 중간-오른쪽 패널: 관찰 데이터 테이블 */}
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="flex-1 min-h-0 overflow-y-auto">
						<table className="w-full text-sm border-collapse table-fixed">
							<colgroup>
								<col className="w-[8rem]" />
								<col />
								<col />
								<col />
							</colgroup>
							<thead className="sticky top-0 z-10 bg-blue-50">
								<tr>
									<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-b border-r border-blue-200 whitespace-nowrap">관찰시간</th>
									<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-b border-r border-blue-200 whitespace-nowrap">소변</th>
									<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-b border-r border-blue-200 whitespace-nowrap">대변</th>
									<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-b border-blue-200 whitespace-nowrap">기저귀</th>
								</tr>
							</thead>
							<tbody>
								{loadingObservations ? (
									<tr>
										<td colSpan={4} className="px-2 py-4 text-center text-blue-900/60">로딩 중...</td>
									</tr>
								) : observationList.length === 0 ? (
									<tr>
										<td colSpan={4} className="px-2 py-4 text-center text-blue-900/60">
											{selectedDateIndex !== null ? '관찰 데이터가 없습니다' : '관찰일자를 선택해주세요'}
										</td>
									</tr>
								) : (
									currentObservations.map((observation, localIndex) => {
										const globalIndex = observationListStartIndex + localIndex;
										return (
											<tr
												key={globalIndex}
												onClick={() => handleSelectObservation(globalIndex, observation)}
												className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
													selectedObservationIndex === globalIndex ? 'bg-blue-100' : ''
												}`}
											>
												<td className="px-1 py-1.5 text-center text-blue-900 border-r border-blue-100 whitespace-nowrap">
													{formatTimeDisplay(observation)}
												</td>
												<td className="px-1 py-1.5 text-center text-blue-900 border-r border-blue-100">
													{listAmtLabel(observation.PSS_AMT_GU, observation.URINE ?? observation.PSS_GU)}
												</td>
												<td className="px-1 py-1.5 text-center text-blue-900 border-r border-blue-100">
													{listAmtLabel(observation.DNG_AMT_GU, observation.STOOL ?? observation.DNG_GU)}
												</td>
												<td className="px-1 py-1.5 text-center text-blue-900">
													{listDiaperTime(observation.DIAPER ?? observation.NPPY_CNG_GU, observation.NPPY_CNG_TM)}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
					{/* 관찰 데이터 목록 페이지네이션 */}
					{observationListTotalPages > 1 && (
						<div className="p-2 bg-white border-t border-blue-200">
							<div className="flex items-center justify-center gap-1">
								<button
									onClick={() => setObservationListPage(1)}
									disabled={observationListPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&lt;&lt;
								</button>
								<button
									onClick={() => setObservationListPage(prev => Math.max(1, prev - 1))}
									disabled={observationListPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&lt;
								</button>
								
								{Array.from({ length: Math.min(5, observationListTotalPages) }, (_, i) => {
									const pageNum = Math.max(1, Math.min(observationListTotalPages - 4, observationListPage - 2)) + i;
									if (pageNum > observationListTotalPages) return null;
									return (
										<button
											key={pageNum}
											onClick={() => setObservationListPage(pageNum)}
											className={`px-2 py-1 text-xs border rounded ${
												observationListPage === pageNum
													? 'bg-blue-500 text-white border-blue-500'
													: 'border-blue-300 hover:bg-blue-50'
											}`}
										>
											{pageNum}
										</button>
									);
								}).filter(Boolean)}
								
								<button
									onClick={() => setObservationListPage(prev => Math.min(observationListTotalPages, prev + 1))}
									disabled={observationListPage >= observationListTotalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&gt;
								</button>
								<button
									onClick={() => setObservationListPage(observationListTotalPages)}
									disabled={observationListPage >= observationListTotalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&gt;&gt;
								</button>
							</div>
						</div>
					)}
				</div>

				{/* 우측 패널: 입력 폼 */}
				<div className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-white">
					<div
						className={`h-full p-4 overflow-y-auto ${
							selectedObservationIndex === null && !isNewMode ? 'blur-sm select-none pointer-events-none opacity-70' : ''
						}`}
					>
						<div className="space-y-4">
							{/* 수급자 */}
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">수급자</label>
								<input
									type="text"
									value={formData.beneficiary}
									readOnly
									className={fieldReadCls}
								/>
							</div>

							{/* 관찰일자 */}
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">관찰일자</label>
								<input
									type="date"
									value={formData.observationDate}
									readOnly={!isEditMode}
									disabled={!isEditMode}
									onChange={(e) => isEditMode && setFormData(prev => ({ ...prev, observationDate: e.target.value }))}
									className={isEditMode ? fieldEditCls : fieldReadCls}
								/>
							</div>

							{/* 관찰시간 */}
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">관찰시간</label>
								<TimeHmInput
									value={formData.observationTime}
									disabled={!isEditMode}
									onChange={(next) => isEditMode && setFormData((prev) => ({ ...prev, observationTime: next }))}
								/>
							</div>

							{/* 소변 */}
							<div className="flex items-start gap-2">
								<label className="pt-1.5 text-sm font-medium text-blue-900 whitespace-nowrap">소변</label>
								<AmountRadios
									name="urine-amt"
									value={formData.urineAmt}
									disabled={!isEditMode}
									onChange={(next) => isEditMode && setFormData((prev) => ({ ...prev, urineAmt: next }))}
								/>
							</div>

							{/* 대변 */}
							<div className="flex items-start gap-2">
								<label className="pt-1.5 text-sm font-medium text-blue-900 whitespace-nowrap">대변</label>
								<AmountRadios
									name="stool-amt"
									value={formData.stoolAmt}
									disabled={!isEditMode}
									onChange={(next) => isEditMode && setFormData((prev) => ({ ...prev, stoolAmt: next }))}
								/>
							</div>

							{/* 기저귀교환 */}
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">기저귀교환</label>
								<input
									type="checkbox"
									checked={formData.diaperChange}
									tabIndex={isEditMode ? 0 : -1}
									onChange={(e) =>
										isEditMode &&
										setFormData((prev) => ({
											...prev,
											diaperChange: e.target.checked,
											diaperChangeTime: e.target.checked ? prev.diaperChangeTime : '',
										}))
									}
									className={`${checkboxCls} ${isEditMode ? 'cursor-pointer' : 'pointer-events-none cursor-default'}`}
								/>
								<span className="text-sm text-blue-900 whitespace-nowrap">교환시간</span>
								<TimeHmInput
									value={formData.diaperChangeTime}
									disabled={!isEditMode}
									onChange={(next) =>
										isEditMode &&
										setFormData((prev) => ({
											...prev,
											diaperChangeTime: next,
											diaperChange: next ? true : prev.diaperChange,
										}))
									}
								/>
							</div>

							{/* 기타 */}
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">기타</label>
								<input
									type="text"
									value={formData.other}
									readOnly={!isEditMode}
									onChange={(e) => isEditMode && setFormData((prev) => ({ ...prev, other: e.target.value }))}
									className={isEditMode ? fieldEditCls : fieldReadCls}
									maxLength={200}
									placeholder={isEditMode ? '기타 내용을 입력하세요' : ''}
								/>
							</div>

							{/* 관찰자 */}
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">관찰자</label>
								{isEditMode ? (
									<div className="relative flex-1 observer-dropdown-container">
										<input
											type="text"
											value={observerSearchTerm}
											onChange={(e) => {
												const value = e.target.value;
												setObserverSearchTerm(value);
												setFormData((prev) => ({
													...prev,
													observer: value,
													observerNo: '',
												}));
												if (!value) {
													setObserverSuggestions([]);
													setShowObserverDropdown(false);
												}
											}}
											onFocus={() => {
												if (observerSuggestions.length > 0) setShowObserverDropdown(true);
											}}
											className={fieldEditCls}
											maxLength={20}
											placeholder="직원명 또는 사원번호 검색"
										/>
										{showObserverDropdown && observerSuggestions.length > 0 && (
											<div className="absolute z-20 w-full mt-1 bg-white border border-blue-300 rounded shadow-lg max-h-40 overflow-y-auto">
												{observerSuggestions.map((emp, index) => (
													<div
														key={`${emp.EMPNO}-${index}`}
														onMouseDown={(e) => {
															e.preventDefault();
															handleSelectObserver(emp);
														}}
														className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-blue-100 last:border-b-0"
													>
														{emp.EMPNM}
														{empNoKey(emp.EMPNO) ? ` (${empNoKey(emp.EMPNO)})` : ''}
													</div>
												))}
											</div>
										)}
									</div>
								) : (
									<input
										type="text"
										value={formData.observer || '-'}
										readOnly
										className={fieldReadCls}
									/>
								)}
							</div>
						</div>

						{/* 하단 버튼 영역 */}
						<div className="flex justify-end gap-2 mt-6">
							{!isEditMode ? (
								<>
									<button
										type="button"
										onClick={handleModify}
										disabled={selectedObservationIndex === null || loadingObservations}
										className="px-4 py-1.5 text-xs border border-green-400 rounded bg-green-200 hover:bg-green-300 text-green-900 font-medium disabled:opacity-40"
									>
										수정
									</button>
									<button
										type="button"
										onClick={handleDelete}
										disabled={selectedObservationIndex === null || loadingObservations}
										className="px-4 py-1.5 text-xs border border-orange-400 rounded bg-orange-200 hover:bg-orange-300 text-orange-900 font-medium disabled:opacity-40"
									>
										삭제
									</button>
								</>
							) : (
								<>
									<button
										type="button"
										onClick={handleCancelEdit}
										disabled={loadingObservations}
										className="px-4 py-1.5 text-xs border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium disabled:opacity-40"
									>
										취소
									</button>
									<button
										type="button"
										onClick={handleSave}
										disabled={loadingObservations}
										className="px-4 py-1.5 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-40"
									>
										{loadingObservations ? '저장중' : '저장'}
									</button>
								</>
							)}
						</div>
					</div>

					{selectedObservationIndex === null && !isNewMode && (
						<div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/30 backdrop-blur-[1px]">
							<p className="px-6 py-3 text-lg font-semibold text-blue-900 bg-white/90 border border-blue-200 rounded-lg shadow-sm">
								관찰시간을 선택해주세요
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

"use client";

/**
 * @file 배설관찰 — 화면 컴포넌트 (ExcretionObservation.tsx)
 *
 * @description
 * 요양원 배설관찰 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/excretion-observation
 *
 * @module component/nursing-home/pages/excretion-observation/ExcretionObservation
 */
import React, { useState, useEffect } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { attachLatestRoomNoByPnum } from '../../utils/roomNoFloor';
import { RoomNoFloorSelect } from '../../components/RoomNoFloorSelect';
import { matchesSelectedFloor } from '../../utils/roomNoFloorFilter';
import {
	ANNT_STAT_OPTIONS,
	createEmptyExcretionForm,
	excretionFormToPayload,
	formatDateYmd,
	normalizeTimeHm,
	rowObservationTime,
	rowToExcretionForm,
	type ExcretionFormData,
	type F33021Row,
} from '../../utils/excretionObservationFields';
import {
	buildExcretionObservationPrintHtml,
	monthRangeFromYmd,
	openExcretionObservationPrint,
} from './excretionObservationPrint';

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

interface ObservationRecord extends F33021Row {
	OBSDT: string;
	OBSTM: string;
}

const AMT_OPTIONS = [
	{ code: '1', label: '소량' },
	{ code: '2', label: '보통' },
	{ code: '3', label: '다량' },
] as const;

const timeInputClass =
	'w-14 px-2 py-1.5 text-sm text-center border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500';
const checkboxCls =
	'w-4 h-4 text-blue-500 border border-blue-300 rounded focus:ring-blue-500 accent-blue-600';

function todayYmd(): string {
	return formatDateYmd(new Date().toISOString()) || '';
}

function currentYearMonth(): string {
	const ymd = todayYmd();
	return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd.slice(0, 7) : '';
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

function AmountRadios({
	name,
	value,
	onChange,
}: {
	name: string;
	value: string;
	onChange: (next: string) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-3">
			{AMT_OPTIONS.map((opt) => (
				<label key={opt.code} className="flex items-center gap-1 text-sm text-blue-900 cursor-pointer">
					<input
						type="radio"
						name={name}
						value={opt.code}
						checked={value === opt.code}
						onChange={() => onChange(opt.code)}
						onClick={(e) => {
							if (value === opt.code) {
								e.preventDefault();
								onChange('');
							}
						}}
						className={`${checkboxCls} cursor-pointer`}
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
}: {
	value: string;
	onChange: (next: string) => void;
}) {
	const { hour, minute } = splitHm(value);

	return (
		<div className="flex items-center gap-1 min-w-0">
			<input
				type="text"
				inputMode="numeric"
				maxLength={2}
				value={hour}
				onChange={(e) => onChange(joinRawHm(e.target.value.replace(/\D/g, '').slice(0, 2), minute))}
				onBlur={() => {
					if (!hour && !minute) return;
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
				onChange={(e) => onChange(joinRawHm(hour, e.target.value.replace(/\D/g, '').slice(0, 2)))}
				onBlur={() => {
					if (!hour && !minute) return;
					onChange(normalizeHm(hour, minute));
				}}
				className={timeInputClass}
				placeholder="분"
				aria-label="분"
			/>
		</div>
	);
}

export default function ExcretionObservation() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [selectedTimeIndex, setSelectedTimeIndex] = useState<number | null>(null);
	const [observationDates, setObservationDates] = useState<string[]>([]);
	const [observationRecords, setObservationRecords] = useState<ObservationRecord[]>([]);
	const [loadingObservations, setLoadingObservations] = useState(false);
	const [observationDatePage, setObservationDatePage] = useState(1);
	const observationDateItemsPerPage = 10;
	const [observationTimePage, setObservationTimePage] = useState(1);
	const observationTimeItemsPerPage = 10;
	const [printMonth, setPrintMonth] = useState(currentYearMonth);
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(new Set());
	const [printing, setPrinting] = useState(false);

	const [formData, setFormData] = useState<ExcretionFormData>(createEmptyExcretionForm());
	const [defaultObserver, setDefaultObserver] = useState('');

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

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
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

	// 관찰일자 목록 조회
	const fetchObservationDates = async (ancd: string, pnum: string, keepDate?: string) => {
		if (!ancd || !pnum) {
			setObservationDates([]);
			return [] as string[];
		}

		setLoadingObservations(true);
		try {
			const url = `/api/f33021?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(pnum)}&mode=dates`;
			const response = await fetch(url, { method: 'GET' });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || '관찰일자 조회 실패');
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const dates = list
				.map((r: { VDT?: string }) => formatDateYmd(r?.VDT ?? ''))
				.filter((d: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d));
			const keep = formatDateYmd(keepDate || '');
			const next = [...dates];
			if (keep && /^\d{4}-\d{2}-\d{2}$/.test(keep) && !next.includes(keep)) {
				next.unshift(keep);
			}
			setObservationDates(next);
			return next as string[];
		} catch (err) {
			console.error('관찰일자 조회 오류:', err);
			setObservationDates([]);
			return [] as string[];
		} finally {
			setLoadingObservations(false);
		}
	};

	// 관찰시간(구분) 목록 조회
	const fetchObservationRecords = async (ancd: string, pnum: string, date: string) => {
		if (!ancd || !pnum || !date) {
			setObservationRecords([]);
			return;
		}

		setLoadingObservations(true);
		try {
			const url = `/api/f33021?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(pnum)}&vdt=${encodeURIComponent(date)}`;
			const response = await fetch(url, { method: 'GET' });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || '관찰시간 조회 실패');
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const mapped: ObservationRecord[] = list.map((r: F33021Row) => ({
				...r,
				OBSDT: formatDateYmd(r.VDT),
				OBSTM: rowObservationTime(r),
			}));
			setObservationRecords(mapped);
		} catch (err) {
			console.error('관찰시간 조회 오류:', err);
			setObservationRecords([]);
		} finally {
			setLoadingObservations(false);
		}
	};

	// 수급자 선택 함수
	const handleSelectMember = (member: MemberData) => {
		setSelectedMember(member);
		setSelectedDateIndex(null);
		setSelectedTimeIndex(null);
		setObservationRecords([]);
		setFormData({
			...createEmptyExcretionForm(member.P_NM || '', defaultObserver),
			observationDate: '',
		});
		fetchObservationDates(member.ANCD, member.PNUM);
	};

	const applyEmptyFormForDate = (date: string) => {
		setFormData((prev) => ({
			...createEmptyExcretionForm(selectedMember?.P_NM || prev.beneficiary, defaultObserver || prev.observer),
			observationDate: date,
		}));
	};

	const handleCreateDate = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		const date = todayYmd();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			alert('관찰일자를 생성할 수 없습니다.');
			return;
		}

		const existingIdx = observationDates.indexOf(date);
		if (existingIdx >= 0) {
			handleSelectDate(existingIdx);
			return;
		}

		const nextDates = [date, ...observationDates];
		setObservationDates(nextDates);
		setObservationDatePage(1);
		setSelectedDateIndex(0);
		setSelectedTimeIndex(null);
		setObservationTimePage(1);
		setObservationRecords([]);
		applyEmptyFormForDate(date);
	};

	// 관찰일자 선택 함수
	const handleSelectDate = (index: number) => {
		setSelectedDateIndex(index);
		const selectedDate = observationDates[index];
		if (selectedMember && selectedDate) {
			fetchObservationRecords(selectedMember.ANCD, selectedMember.PNUM, selectedDate);
		}
		applyEmptyFormForDate(selectedDate || '');
		setSelectedTimeIndex(null);
		setObservationTimePage(1);
	};

	// 관찰시간 선택 함수
	const handleSelectTime = (index: number, record: ObservationRecord) => {
		setSelectedTimeIndex(index);
		setFormData(rowToExcretionForm(record, selectedMember?.P_NM || ''));
	};

	// 날짜 형식 변환 함수
	const formatDateDisplay = formatDateYmd;

	// 저장 함수
	const handleSave = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (!formData.observationDate) {
			alert('관찰일자를 입력해주세요. 관찰일자에서 신규로 생성한 뒤 저장해주세요.');
			return;
		}

		const observationTime = normalizeTimeHm(formData.observationTime) || normalizeHm(
			splitHm(formData.observationTime).hour,
			splitHm(formData.observationTime).minute
		);
		if (!/^\d{2}:\d{2}$/.test(observationTime)) {
			alert('관찰시간(시, 분)을 입력해주세요.');
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

		setLoadingObservations(true);
		try {
			const payload = {
				...excretionFormToPayload(
					{
						...formData,
						observationTime,
						diaperChangeTime,
						originalVtmGu: selectedTimeIndex !== null ? formData.originalVtmGu : '',
					},
					selectedMember.PNUM
				),
			};
			const res = await fetch(`/api/f33021?ancd=${encodeURIComponent(selectedMember.ANCD)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '관찰 데이터 저장 실패');
			}

			alert(selectedTimeIndex !== null ? '관찰 데이터가 수정되었습니다.' : '관찰 데이터가 저장되었습니다.');

			const dates = await fetchObservationDates(
				selectedMember.ANCD,
				selectedMember.PNUM,
				formData.observationDate
			);
			if (formData.observationDate) {
				const dateIdx = dates.indexOf(formData.observationDate);
				setSelectedDateIndex(dateIdx >= 0 ? dateIdx : null);
				if (dateIdx >= 0) {
					setObservationDatePage(Math.floor(dateIdx / observationDateItemsPerPage) + 1);
				}
				await fetchObservationRecords(selectedMember.ANCD, selectedMember.PNUM, formData.observationDate);
			}
			setSelectedTimeIndex(null);
			setFormData((prev) => ({
				...prev,
				observationTime,
				diaperChangeTime,
				originalVtmGu: '',
			}));
		} catch (err) {
			console.error('관찰 데이터 저장 오류:', err);
			alert(err instanceof Error ? err.message : '관찰 데이터 저장 중 오류가 발생했습니다.');
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

		if (selectedTimeIndex === null) {
			alert('삭제할 관찰 데이터를 선택해주세요.');
			return;
		}

		if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			return;
		}

		setLoadingObservations(true);
		try {
			const record = observationRecords[selectedTimeIndex];
			const vdt = formatDateDisplay(record?.OBSDT || formData.observationDate || '');
			const vtmGu = String(record?.VTM_GU ?? '').trim();
			const url = `/api/f33021?ancd=${encodeURIComponent(selectedMember.ANCD)}&pnum=${encodeURIComponent(
				selectedMember.PNUM
			)}&vdt=${encodeURIComponent(vdt)}&vtmGu=${encodeURIComponent(vtmGu)}`;
			const res = await fetch(url, { method: 'DELETE' });
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '관찰 데이터 삭제 실패');
			}

			alert('관찰 데이터가 삭제되었습니다.');

			await fetchObservationDates(selectedMember.ANCD, selectedMember.PNUM, formData.observationDate);
			if (selectedMember && formData.observationDate) {
				await fetchObservationRecords(selectedMember.ANCD, selectedMember.PNUM, formData.observationDate);
			}

			setFormData({
				...createEmptyExcretionForm(selectedMember.P_NM || '', defaultObserver),
				observationDate: formData.observationDate,
			});
			setSelectedTimeIndex(null);
		} catch (err) {
			console.error('관찰 데이터 삭제 오류:', err);
			alert(err instanceof Error ? err.message : '관찰 데이터 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingObservations(false);
		}
	};

	const resolvePrintMonth = () => {
		const ym = String(printMonth || '').trim();
		if (!/^\d{4}-\d{2}$/.test(ym)) {
			alert('출력 월을 선택해주세요.');
			return null;
		}
		const range = monthRangeFromYmd(`${ym}-01`);
		if (!range) {
			alert('출력 월이 올바르지 않습니다.');
			return null;
		}
		return range;
	};

	const checkedMembers = () => memberList.filter((m) => checkedMemberKeys.has(memberKey(m)));

	const handleBlankPrint = () => {
		const range = resolvePrintMonth();
		if (!range) return;
		const targets = checkedMembers();
		const items =
			targets.length > 0
				? targets.map((member) => ({ member, rowsByDate: {} }))
				: [{ member: { P_NM: '', P_GRD: '' }, rowsByDate: {} }];
		const html = buildExcretionObservationPrintHtml({
			blank: true,
			year: range.year,
			month: range.month,
			days: range.days,
			items,
		});
		openExcretionObservationPrint(html);
	};

	const handleDataPrint = async () => {
		const range = resolvePrintMonth();
		if (!range) return;
		const targets = checkedMembers();
		if (targets.length === 0) {
			alert('출력할 수급자를 체크해주세요.');
			return;
		}

		setPrinting(true);
		try {
			const items = [];
			for (const member of targets) {
				const url = `/api/f33021?ancd=${encodeURIComponent(String(member.ANCD))}&pnum=${encodeURIComponent(
					String(member.PNUM)
				)}&startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}`;
				const response = await fetch(url, { method: 'GET', cache: 'no-store' });
				const result = await response.json().catch(() => ({}));
				if (!response.ok || !result?.success) {
					throw new Error(result?.error || '관찰 데이터 조회 실패');
				}
				const list = Array.isArray(result.data) ? result.data : [];
				const rows = (list as F33021Row[]).map((r) => {
					const ymd = formatDateYmd(r.VDT);
					const time = rowObservationTime(r);
					return {
						...r,
						OBSDT: ymd,
						VDT: ymd || String(r.VDT ?? ''),
						OBSTM: time,
						VTM_ST: time,
						VTM_GU: String(r.VTM_GU ?? '').trim(),
					};
				});
				items.push({ member, rows });
			}
			const html = buildExcretionObservationPrintHtml({
				blank: false,
				year: range.year,
				month: range.month,
				items,
			});
			openExcretionObservationPrint(html);
		} catch (err) {
			console.error('배설관찰 출력 오류:', err);
			alert(err instanceof Error ? err.message : '출력 준비 중 오류가 발생했습니다.');
		} finally {
			setPrinting(false);
		}
	};

	// 관찰일자 목록 페이지네이션
	const observationDateTotalPages = Math.ceil(observationDates.length / observationDateItemsPerPage);
	const observationDateStartIndex = (observationDatePage - 1) * observationDateItemsPerPage;
	const observationDateEndIndex = observationDateStartIndex + observationDateItemsPerPage;
	const currentDateItems = observationDates.slice(observationDateStartIndex, observationDateEndIndex);

	// 관찰시간 목록 페이지네이션
	const observationTimeTotalPages = Math.ceil(observationRecords.length / observationTimeItemsPerPage);
	const observationTimeStartIndex = (observationTimePage - 1) * observationTimeItemsPerPage;
	const observationTimeEndIndex = observationTimeStartIndex + observationTimeItemsPerPage;
	const currentTimeItems = observationRecords.slice(observationTimeStartIndex, observationTimeEndIndex);

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
							onClick={() => void handleDataPrint()}
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
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 px-4 py-3 border-r border-blue-200 bg-blue-50 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="mb-2">
						<label className="text-sm font-medium text-blue-900">관찰일자</label>
						<button
							type="button"
							onClick={handleCreateDate}
							className="w-full mt-1 px-2 py-1 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto bg-white">
							{loadingObservations ? (
								<div className="px-2 py-1 text-sm text-blue-900/60">로딩 중...</div>
							) : observationDates.length === 0 ? (
								<div className="px-2 py-1 text-sm text-blue-900/60">
									{selectedMember ? '상단에서 일자를 신규 생성해주세요' : '수급자를 선택해주세요'}
								</div>
							) : (
								currentDateItems.map((date, localIndex) => {
									const globalIndex = observationDateStartIndex + localIndex;
									return (
										<div
											key={globalIndex}
											onClick={() => handleSelectDate(globalIndex)}
											className={`px-2 py-1.5 text-base cursor-pointer hover:bg-blue-100 rounded ${
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
							<div className="p-2 mt-2">
								<div className="flex items-center justify-center gap-1">
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

				{/* 중간-오른쪽 패널: 관찰시간 목록 */}
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 px-4 py-3 border-r border-blue-200 bg-blue-50 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="mb-2">
						<label className="text-sm font-medium text-blue-900">관찰시간</label>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto bg-white">
							{loadingObservations ? (
								<div className="px-2 py-1 text-sm text-blue-900/60">로딩 중...</div>
							) : observationRecords.length === 0 ? (
								<div className="px-2 py-1 text-sm text-blue-900/60">
									{selectedDateIndex !== null ? '관찰시간을 시·분으로 입력한 뒤 저장해주세요' : '관찰일자를 선택해주세요'}
								</div>
							) : (
								currentTimeItems.map((record, localIndex) => {
									const globalIndex = observationTimeStartIndex + localIndex;
									return (
										<div
											key={`${record.VDT}-${record.VTM_GU}-${globalIndex}`}
											onClick={() => handleSelectTime(globalIndex, record)}
											className={`px-2 py-1.5 text-base cursor-pointer hover:bg-blue-100 rounded ${
												selectedTimeIndex === globalIndex ? 'bg-blue-200 font-semibold' : ''
											}`}
										>
											{record.OBSTM || '-'}
										</div>
									);
								})
							)}
						</div>
						{/* 관찰시간 페이지네이션 */}
						{observationTimeTotalPages > 1 && (
							<div className="p-2 mt-2">
								<div className="flex items-center justify-center gap-1">
									<button
										onClick={() => setObservationTimePage(1)}
										disabled={observationTimePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										onClick={() => setObservationTimePage(prev => Math.max(1, prev - 1))}
										disabled={observationTimePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;
									</button>
									
									{Array.from({ length: Math.min(5, observationTimeTotalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(observationTimeTotalPages - 4, observationTimePage - 2)) + i;
										if (pageNum > observationTimeTotalPages) return null;
										return (
											<button
												key={pageNum}
												onClick={() => setObservationTimePage(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${
													observationTimePage === pageNum
														? 'bg-blue-500 text-white border-blue-500'
														: 'border-blue-300 hover:bg-blue-50'
												}`}
											>
												{pageNum}
											</button>
										);
									}).filter(Boolean)}
									
									<button
										onClick={() => setObservationTimePage(prev => Math.min(observationTimeTotalPages, prev + 1))}
										disabled={observationTimePage >= observationTimeTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										onClick={() => setObservationTimePage(observationTimeTotalPages)}
										disabled={observationTimePage >= observationTimeTotalPages}
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
								className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 text-blue-900"
								placeholder="수급자명"
							/>
						</div>

						{/* 관찰일자 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">관찰일자</label>
							<input
								type="date"
								value={formData.observationDate}
								readOnly
								className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 text-blue-900"
							/>
						</div>

						{/* 수급자상태 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">수급자상태</label>
							<select
								value={formData.beneficiaryStatus}
								onChange={(e) => {
									const next = e.target.value;
									setFormData((prev) => ({
										...prev,
										beneficiaryStatus: next,
										diaperUse: next === '2' ? '있음' : prev.diaperUse,
									}));
								}}
								className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
							>
								{ANNT_STAT_OPTIONS.map((opt) => (
									<option key={opt.code} value={opt.code}>{opt.label}</option>
								))}
							</select>
						</div>

						{/* 상태기타 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">상태기타</label>
							<input
								type="text"
								value={formData.statusOther}
								onChange={(e) => setFormData(prev => ({ ...prev, statusOther: e.target.value }))}
								className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
								placeholder="상태기타를 입력하세요"
							/>
						</div>

						{/* 관찰시간 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">관찰시간</label>
							<TimeHmInput
								value={formData.observationTime}
								onChange={(next) => setFormData((prev) => ({ ...prev, observationTime: next }))}
							/>
						</div>

						{/* 소변 */}
						<div className="flex items-start gap-2">
							<label className="pt-1.5 text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">소변</label>
							<AmountRadios
								name="urine-amt"
								value={formData.urineAmt}
								onChange={(next) => setFormData((prev) => ({ ...prev, urineAmt: next as ExcretionFormData['urineAmt'] }))}
							/>
						</div>

						{/* 대변 */}
						<div className="flex items-start gap-2">
							<label className="pt-1.5 text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">대변</label>
							<AmountRadios
								name="stool-amt"
								value={formData.stoolAmt}
								onChange={(next) => setFormData((prev) => ({ ...prev, stoolAmt: next as ExcretionFormData['stoolAmt'] }))}
							/>
						</div>

						{/* 기저귀교환 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">기저귀교환</label>
							<input
								type="checkbox"
								checked={formData.diaperChange}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										diaperChange: e.target.checked,
										diaperChangeTime: e.target.checked ? prev.diaperChangeTime : '',
										diaperUse: e.target.checked ? '있음' : prev.diaperUse,
									}))
								}
								className={`${checkboxCls} cursor-pointer`}
							/>
							<span className="text-sm text-blue-900 whitespace-nowrap">교환시간</span>
							<TimeHmInput
								value={formData.diaperChangeTime}
								onChange={(next) =>
									setFormData((prev) => ({
										...prev,
										diaperChangeTime: next,
										diaperChange: next ? true : prev.diaperChange,
									}))
								}
							/>
						</div>

						{/* 장루(요루)도뇨관삽입 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">장루/도뇨관</label>
							<input
								type="number"
								value={formData.stomaCatheter}
								onChange={(e) => setFormData(prev => ({ ...prev, stomaCatheter: e.target.value }))}
								className="w-24 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
								placeholder="0"
							/>
							<span className="text-sm text-blue-900">ml</span>
						</div>

						{/* 섭취량 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">섭취량</label>
							<input
								type="text"
								value={formData.intakeAmount}
								onChange={(e) => setFormData(prev => ({ ...prev, intakeAmount: e.target.value }))}
								className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
								placeholder="섭취량을 입력하세요"
							/>
						</div>

						{/* 관찰자 */}
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">관찰자</label>
							<input
								type="text"
								value={formData.observer}
								onChange={(e) => setFormData(prev => ({ ...prev, observer: e.target.value }))}
								className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
								placeholder="관찰자를 입력하세요"
							/>
						</div>
					</div>

					{/* 하단 버튼 영역 */}
					<div className="flex justify-end gap-2 mt-6">
						<button
							onClick={handleSave}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							저장
						</button>
						<button
							onClick={handleDelete}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							삭제
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

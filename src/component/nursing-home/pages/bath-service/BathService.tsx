"use client";

/**
 * @file 목욕서비스 — 화면 컴포넌트 (BathService.tsx)
 *
 * @description
 * 요양원 목욕서비스 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/bath-service
 *
 * @module component/nursing-home/pages/bath-service/BathService
 */
import React, { useState, useEffect } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { attachLatestRoomNoByPnum } from '../../utils/roomNoFloor';
import { RoomNoFloorSelect } from '../../components/RoomNoFloorSelect';
import { matchesSelectedFloor } from '../../utils/roomNoFloorFilter';
import {
	buildBathServicePrintHtml,
	monthRangeFromYmd,
	openBathServicePrint,
	type BathPrintRow,
} from './bathServicePrint';

interface MemberData {
	ANCD?: string;
	PNUM?: string;
	P_NM: string;
	P_SEX: string;
	P_GRD: string;
	P_BRDT: string;
	P_ST: string;
	ROOM_NO?: string;
	[key: string]: any;
}

/** MSSQL/clients가 ancd·pnum 소문자로 줄 때 조회 파라미터가 비어 목록만 비는 현상 방지 */
function memberAncd(m: MemberData | null | undefined): string {
	if (!m) return '';
	const raw = m.ANCD ?? (m as Record<string, unknown>).ancd;
	return raw !== undefined && raw !== null && String(raw).trim() !== '' ? String(raw).trim() : '';
}

function memberPnum(m: MemberData | null | undefined): string {
	if (!m) return '';
	const raw = m.PNUM ?? (m as Record<string, unknown>).pnum;
	return raw !== undefined && raw !== null && String(raw).trim() !== '' ? String(raw).trim() : '';
}

function memberKey(m: MemberData | null | undefined): string {
	return `${memberAncd(m)}-${memberPnum(m)}`;
}

type UserInfo = {
	ancd?: string | number;
	uid?: string;
	empno?: string | number;
	empnm?: string;
	[key: string]: any;
};

const STAT_OPTIONS = [
	{ value: '양호', label: '양호' },
	{ value: '이상', label: '이상' },
	{ value: '거부', label: '거부' },
] as const;

type StatValue = (typeof STAT_OPTIONS)[number]['value'];

type BathFormData = {
	serviceDate: string;
	serviceTime: string;
	beneficiary: string;
	beneficiaryStatus: string;
	bathingMethod: string;
	beforeBath: StatValue;
	moveMethod: StatValue;
	afterBath: StatValue;
	remarks: string;
	provider: string;
};

const BATH_METHOD_OPTIONS = ['샤워식-목욕의자', '샤워식-입욕', '목욕의자', '입욕', '기타'] as const;

const timeInputClass =
	'w-14 px-2 py-1.5 text-sm text-center border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500';

function todayYmd(): string {
	const n = new Date();
	const y = n.getFullYear();
	const m = String(n.getMonth() + 1).padStart(2, '0');
	const d = String(n.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function currentYearMonth(): string {
	const ymd = todayYmd();
	return ymd.slice(0, 7);
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

function normalizeTimeHm(v: unknown): string {
	const s = String(v ?? '').trim();
	if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
	if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
	return '';
}

function TimeHmInput({
	value,
	onChange,
	disabled = false,
}: {
	value: string;
	onChange: (next: string) => void;
	disabled?: boolean;
}) {
	const { hour, minute } = splitHm(value);
	const cls = `${timeInputClass}${disabled ? ' bg-gray-50 cursor-not-allowed' : ''}`;

	return (
		<div className="flex items-center gap-1 min-w-0">
			<input
				type="text"
				inputMode="numeric"
				maxLength={2}
				value={hour}
				readOnly={disabled}
				onChange={(e) => {
					if (disabled) return;
					onChange(joinRawHm(e.target.value.replace(/\D/g, '').slice(0, 2), minute));
				}}
				onBlur={() => {
					if (disabled || (!hour && !minute)) return;
					onChange(normalizeHm(hour, minute));
				}}
				className={cls}
				placeholder="시"
				aria-label="시"
			/>
			<span className="text-sm text-blue-900">:</span>
			<input
				type="text"
				inputMode="numeric"
				maxLength={2}
				value={minute}
				readOnly={disabled}
				onChange={(e) => {
					if (disabled) return;
					onChange(joinRawHm(hour, e.target.value.replace(/\D/g, '').slice(0, 2)));
				}}
				onBlur={() => {
					if (disabled || (!hour && !minute)) return;
					onChange(normalizeHm(hour, minute));
				}}
				className={cls}
				placeholder="분"
				aria-label="분"
			/>
		</div>
	);
}

function xoToAbnormal(v: unknown): boolean {
	return String(v ?? '').trim().toUpperCase() === 'O';
}

function statToXO(v: string): 'O' | 'X' {
	return v && v !== '양호' ? 'O' : 'X';
}

function bathMethodToCode(label: string): string | null {
	const s = String(label || '').trim();
	if (!s) return null;
	if (s === '입욕') return '1';
	if (s.startsWith('샤워식') || s === '목욕의자') return '2';
	if (s === '기타') return '3';
	return null;
}

function codeToBathMethod(code: unknown, name?: unknown): string {
	const nm = String(name ?? '').trim();
	if (nm) return nm;
	const c = String(code ?? '').trim();
	if (c === '1') return '입욕';
	if (c === '2') return '샤워식-목욕의자';
	if (c === '3') return '기타';
	return '샤워식-목욕의자';
}

function normalizeStat(v: unknown, fallback: StatValue = '양호'): StatValue {
	const s = String(v ?? '').trim();
	if (s === '양호' || s === '이상' || s === '거부') return s;
	return fallback;
}

function createEmptyForm(beneficiary = '', provider = ''): BathFormData {
	return {
		serviceDate: '',
		serviceTime: '',
		beneficiary,
		beneficiaryStatus: '',
		bathingMethod: '샤워식-목욕의자',
		beforeBath: '양호',
		moveMethod: '양호',
		afterBath: '양호',
		remarks: '',
		provider,
	};
}

export default function BathService() {
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [defaultProvider, setDefaultProvider] = useState('');
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [serviceDates, setServiceDates] = useState<string[]>([]);
	const [loadingServices, setLoadingServices] = useState(false);
	const [serviceDatePage, setServiceDatePage] = useState(1);
	const serviceDateItemsPerPage = 10;
	const [printMonth, setPrintMonth] = useState(currentYearMonth);
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(new Set());
	const [printing, setPrinting] = useState(false);

	const [formData, setFormData] = useState<BathFormData>(createEmptyForm());
	const [formMode, setFormMode] = useState<'view' | 'edit' | 'create'>('view');
	const [formSnapshot, setFormSnapshot] = useState<BathFormData | null>(null);
	const [unsavedNewDate, setUnsavedNewDate] = useState<string | null>(null);

	const formatDateYmd = (v: unknown) => {
		if (v == null || v === '') return '';
		if (v instanceof Date && !Number.isNaN(v.getTime())) {
			const y = v.getFullYear();
			const m = String(v.getMonth() + 1).padStart(2, '0');
			const d = String(v.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
		const s = String(v).trim();
		if (!s) return '';
		if (s.includes('T')) return s.split('T')[0].slice(0, 10);
		if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
		if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
		const parsed = Date.parse(s);
		if (!Number.isNaN(parsed)) {
			const dt = new Date(parsed);
			const y = dt.getFullYear();
			const m = String(dt.getMonth() + 1).padStart(2, '0');
			const d = String(dt.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
		return '';
	};

	const fetchUserInfo = async () => {
		try {
			const res = await fetch('/api/auth/user-info', { method: 'GET' });
			const json = await res.json().catch(() => ({}));
			if (res.ok && json?.success) {
				const data = json.data || null;
				setUserInfo(data);
				const name = String(data?.empnm ?? data?.EMPNM ?? '').trim();
				if (name) {
					setDefaultProvider(name);
					setFormData((prev) => (prev.provider ? prev : { ...prev, provider: name }));
				}
			}
		} catch {
			// ignore
		}
	};

	const [memberList, setMemberList] = useState<MemberData[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<string>('입소');
	const [selectedGrade, setSelectedGrade] = useState<string>('');
	const [selectedFloor, setSelectedFloor] = useState<string>('');
	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

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

	const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentMembers = filteredMembers.slice(startIndex, endIndex);

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
		fetchUserInfo();
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			setCurrentPage(1);
			fetchMembers(searchTerm);
		}, 300);

		return () => clearTimeout(timer);
	}, [searchTerm]);

	useEffect(() => {
		setCurrentPage(1);
	}, [selectedStatus, selectedGrade, selectedFloor, searchTerm]);

	const fetchServiceDates = async (ancd: string, pnum: string, keepDraftDate?: string | null): Promise<string[]> => {
		if (!ancd || !pnum) {
			setServiceDates([]);
			return [];
		}

		setLoadingServices(true);
		try {
			const url = `/api/f33030?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(pnum)}&mode=dates`;
			const res = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) throw new Error(json?.error || '제공일자 조회 실패');

			const list = Array.isArray(json.data) ? json.data : [];
			const dates: string[] = Array.from(
				new Set(
					list
						.map((r: any) => formatDateYmd(r?.VDT ?? r?.vdt))
						.filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
				)
			) as string[];
			dates.sort((a: string, b: string) => (a > b ? -1 : a < b ? 1 : 0));
			const draft = keepDraftDate && /^\d{4}-\d{2}-\d{2}$/.test(keepDraftDate) ? keepDraftDate : '';
			const merged = draft && !dates.includes(draft) ? [draft, ...dates] : dates;
			setServiceDates(merged);
			return merged;
		} catch (err) {
			console.error('제공일자 조회 오류:', err);
			setServiceDates([]);
			return [];
		} finally {
			setLoadingServices(false);
		}
	};

	const applyEmptyFormForDate = (date: string) => {
		setFormData((prev) => ({
			...createEmptyForm(selectedMember?.P_NM || prev.beneficiary, defaultProvider || prev.provider),
			serviceDate: date,
		}));
	};

	const fetchDetail = async (ancd: string, pnum: string, vdt: string) => {
		setLoadingServices(true);
		try {
			const url = `/api/f33030?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(pnum)}&vdt=${encodeURIComponent(
				vdt
			)}`;
			const res = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) throw new Error(json?.error || '상세 조회 실패');

			const row = Array.isArray(json.data) ? json.data?.[0] : null;
			if (!row) {
				applyEmptyFormForDate(vdt);
				return;
			}

			const beforeFromLegacy =
				xoToAbnormal(row?.AF_FACE) ||
				xoToAbnormal(row?.AF_LIP) ||
				xoToAbnormal(row?.AF_NAIL_COLOR ?? row?.AF_NAIL_COLO) ||
				xoToAbnormal(row?.AF_COG_STAT)
					? '이상'
					: '양호';
			const afterFromLegacy =
				xoToAbnormal(row?.BF_FACE) ||
				xoToAbnormal(row?.BF_LIP) ||
				xoToAbnormal(row?.BF_NAIL_COLOR ?? row?.BF_NAIL_COLO) ||
				xoToAbnormal(row?.BF_COG_STAT)
					? '이상'
					: '양호';

			setFormData((prev) => ({
				...prev,
				serviceDate: formatDateYmd(row?.VDT ?? row?.vdt) || vdt,
				serviceTime: normalizeTimeHm(row?.SRV_TM ?? row?.srv_tm) || String(row?.SRV_TM ?? ''),
				beneficiary: selectedMember?.P_NM || prev.beneficiary,
				beneficiaryStatus: String(row?.BEN_STAT ?? row?.ben_stat ?? '').trim(),
				bathingMethod: codeToBathMethod(row?.BATH_METH ?? row?.bath_meth, row?.BATH_METH_NM ?? row?.bath_meth_nm),
				beforeBath: normalizeStat(row?.BEF_STAT ?? row?.bef_stat, beforeFromLegacy),
				moveMethod: normalizeStat(row?.MOVE_STAT ?? row?.move_stat, '양호'),
				afterBath: normalizeStat(row?.AFT_STAT ?? row?.aft_stat, afterFromLegacy),
				remarks: String(row?.SRV_WRNG_DESC ?? row?.srv_wrng_desc ?? '').trim(),
				provider:
					String(row?.INEMPNM ?? row?.inempnm ?? '').trim() ||
					prev.provider ||
					defaultProvider,
			}));
		} catch (e) {
			console.error('상세 조회 오류:', e);
		} finally {
			setLoadingServices(false);
		}
	};

	const isFormOpen = formMode === 'edit' || formMode === 'create';

	const discardDraftDate = (dates = serviceDates) => {
		if (!unsavedNewDate) return dates;
		return dates.filter((d) => d !== unsavedNewDate);
	};

	const confirmLeaveForm = (message?: string) => {
		if (!isFormOpen) return true;
		const msg =
			message ||
			(formMode === 'create'
				? '신규 작성을 취소하고 이동할까요? 입력한 내용은 저장되지 않습니다.'
				: '수정을 취소하고 이동할까요? 변경한 내용은 저장되지 않습니다.');
		return window.confirm(msg);
	};

	const applyViewDate = (index: number, dates: string[]) => {
		const selectedDate = dates[index];
		setFormMode('view');
		setFormSnapshot(null);
		setSelectedDateIndex(index);
		setFormData((prev) => ({ ...prev, serviceDate: selectedDate || '' }));
		if (selectedMember && selectedDate) {
			void fetchDetail(memberAncd(selectedMember), memberPnum(selectedMember), selectedDate);
		}
	};

	const handleSelectMember = (member: MemberData) => {
		if (!confirmLeaveForm()) return;
		setUnsavedNewDate(null);
		setFormMode('view');
		setFormSnapshot(null);
		setSelectedMember(member);
		setSelectedDateIndex(null);
		setServiceDatePage(1);
		setFormData(createEmptyForm(member.P_NM || '', defaultProvider));
		void fetchServiceDates(memberAncd(member), memberPnum(member));
	};

	const handleSelectDate = (index: number, dates = serviceDates) => {
		const selectedDate = dates[index];
		if (selectedDateIndex === index && formMode === 'view') return;
		if (unsavedNewDate && selectedDate === unsavedNewDate && formMode === 'create') {
			setSelectedDateIndex(index);
			return;
		}
		if (!confirmLeaveForm()) return;
		const nextDates = formMode === 'create' ? discardDraftDate(dates) : dates;
		if (formMode === 'create') {
			setServiceDates(nextDates);
			setUnsavedNewDate(null);
		}
		const nextIndex = nextDates.indexOf(selectedDate);
		if (nextIndex < 0) return;
		applyViewDate(nextIndex, nextDates);
	};

	const handleCreateDate = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (formMode === 'create') return;
		if (!confirmLeaveForm()) return;

		const date = todayYmd();
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			alert('제공일자를 생성할 수 없습니다.');
			return;
		}

		const savedDates = discardDraftDate();
		const existingIdx = savedDates.indexOf(date);
		if (existingIdx >= 0) {
			setServiceDates(savedDates);
			setUnsavedNewDate(null);
			applyViewDate(existingIdx, savedDates);
			alert('오늘 제공일자가 이미 있습니다. 수정 버튼으로 변경하세요.');
			return;
		}

		const nextDates = [date, ...savedDates];
		setServiceDates(nextDates);
		setServiceDatePage(1);
		setSelectedDateIndex(0);
		setUnsavedNewDate(date);
		setFormSnapshot(null);
		setFormMode('create');
		applyEmptyFormForDate(date);
	};

	const handleEnterEdit = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (selectedDateIndex === null || !formData.serviceDate) {
			alert('수정할 제공일자를 선택해주세요.');
			return;
		}
		if (unsavedNewDate && serviceDates[selectedDateIndex] === unsavedNewDate) {
			setFormMode('create');
			return;
		}
		setFormSnapshot(formData);
		setFormMode('edit');
	};

	const handleCancelForm = () => {
		if (formMode === 'view') return;
		if (formMode === 'create') {
			const dates = discardDraftDate();
			setServiceDates(dates);
			setUnsavedNewDate(null);
			setSelectedDateIndex(null);
			setFormData(createEmptyForm(selectedMember?.P_NM || '', defaultProvider));
			setFormMode('view');
			setFormSnapshot(null);
			return;
		}
		if (formSnapshot) setFormData(formSnapshot);
		setFormSnapshot(null);
		setFormMode('view');
	};

	const formatDateDisplay = (dateStr: string) => {
		if (!dateStr) return '';
		if (dateStr.includes('T')) {
			dateStr = dateStr.split('T')[0];
		}
		if (dateStr.includes('-') && dateStr.length >= 10) {
			return dateStr.substring(0, 10);
		}
		if (dateStr.length === 8 && !dateStr.includes('-') && !dateStr.includes('년')) {
			return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
		}
		return dateStr;
	};

	const handleSave = async () => {
		if (!isFormOpen) return;
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		if (!formData.serviceDate) {
			alert('제공일자를 입력해주세요. 제공일자에서 신규로 생성한 뒤 저장해주세요.');
			return;
		}

		const serviceTime =
			normalizeTimeHm(formData.serviceTime) ||
			normalizeHm(splitHm(formData.serviceTime).hour, splitHm(formData.serviceTime).minute);

		setLoadingServices(true);
		try {
			const xoBefore = statToXO(formData.beforeBath);
			const xoAfter = statToXO(formData.afterBath);
			const payload: Record<string, unknown> = {
				PNUM: memberPnum(selectedMember),
				VDT: formData.serviceDate,
				SRV_TM: serviceTime || '',
				BEN_STAT: formData.beneficiaryStatus || '',
				BEF_STAT: formData.beforeBath,
				MOVE_STAT: formData.moveMethod,
				AFT_STAT: formData.afterBath,
				SRV_WRNG_DESC: formData.remarks || '',
				BATH_METH: bathMethodToCode(formData.bathingMethod),
				BATH_METH_NM: formData.bathingMethod || '',
				AF_FACE: xoBefore,
				AF_LIP: xoBefore,
				AF_NAIL_COLOR: xoBefore,
				AF_COG_STAT: xoBefore,
				BF_FACE: xoAfter,
				BF_LIP: xoAfter,
				BF_NAIL_COLOR: xoAfter,
				BF_COG_STAT: xoAfter,
				INEMPNO: userInfo?.empno != null ? String(userInfo.empno) : null,
				INEMPNM: formData.provider || '',
				INEMPNO1: (() => {
					const n = parseInt(String(formData.provider || '').trim(), 10);
					return Number.isFinite(n) ? String(n) : null;
				})(),
			};

			const res = await fetch(`/api/f33030?ancd=${encodeURIComponent(memberAncd(selectedMember))}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '목욕서비스 저장 실패');
			}

			alert('목욕서비스가 저장되었습니다.');

			setUnsavedNewDate(null);
			setFormMode('view');
			setFormSnapshot(null);

			if (selectedMember) {
				const dates = await fetchServiceDates(memberAncd(selectedMember), memberPnum(selectedMember));
				if (formData.serviceDate) {
					const dateIdx = dates.indexOf(formData.serviceDate);
					setSelectedDateIndex(dateIdx >= 0 ? dateIdx : null);
					if (dateIdx >= 0) {
						setServiceDatePage(Math.floor(dateIdx / serviceDateItemsPerPage) + 1);
					}
					await fetchDetail(memberAncd(selectedMember), memberPnum(selectedMember), formData.serviceDate);
				}
			}
		} catch (err) {
			console.error('목욕서비스 저장 오류:', err);
			alert(err instanceof Error ? err.message : '목욕서비스 저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingServices(false);
		}
	};

	const handleDeleteDate = async (index: number) => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}

		const dateToDelete = serviceDates[index];
		if (!dateToDelete) return;

		if (unsavedNewDate && dateToDelete === unsavedNewDate) {
			if (!window.confirm('작성 중인 신규 일자를 취소할까요? 입력한 내용은 저장되지 않습니다.')) {
				return;
			}
			const dates = discardDraftDate();
			setServiceDates(dates);
			setUnsavedNewDate(null);
			setSelectedDateIndex(null);
			setFormData(createEmptyForm(selectedMember.P_NM || '', defaultProvider));
			setFormMode('view');
			setFormSnapshot(null);
			return;
		}

		if (isFormOpen && selectedDateIndex === index) {
			if (!window.confirm('수정 중인 기록을 삭제할까요? 저장하지 않은 내용은 반영되지 않습니다.')) {
				return;
			}
		} else if (!window.confirm(`${formatDateDisplay(dateToDelete)} 목욕서비스를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) {
			return;
		}

		setLoadingServices(true);
		try {
			const url = `/api/f33030?ancd=${encodeURIComponent(memberAncd(selectedMember))}&pnum=${encodeURIComponent(
				memberPnum(selectedMember)
			)}&vdt=${encodeURIComponent(dateToDelete)}`;
			const res = await fetch(url, { method: 'DELETE', cache: 'no-store', credentials: 'same-origin' });
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '목욕서비스 삭제 실패');
			}

			alert('목욕서비스가 삭제되었습니다.');

			const keepDraft = unsavedNewDate && unsavedNewDate !== dateToDelete ? unsavedNewDate : null;
			const dates = await fetchServiceDates(memberAncd(selectedMember), memberPnum(selectedMember), keepDraft);
			if (selectedDateIndex === index || formData.serviceDate === dateToDelete) {
				setFormData(createEmptyForm(selectedMember.P_NM || '', defaultProvider));
				setSelectedDateIndex(null);
				setFormMode('view');
				setFormSnapshot(null);
			} else if (formData.serviceDate) {
				const nextIdx = dates.indexOf(formData.serviceDate);
				setSelectedDateIndex(nextIdx >= 0 ? nextIdx : null);
			}
		} catch (err) {
			console.error('목욕서비스 삭제 오류:', err);
			alert(err instanceof Error ? err.message : '목욕서비스 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingServices(false);
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
				? targets.map((member) => ({ member, rows: [] as BathPrintRow[] }))
				: [{ member: { P_NM: '', P_GRD: '' }, rows: [] as BathPrintRow[] }];
		const html = buildBathServicePrintHtml({
			blank: true,
			year: range.year,
			month: range.month,
			items,
		});
		openBathServicePrint(html);
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
			const items: Array<{ member: MemberData; rows: BathPrintRow[] }> = [];
			for (const member of targets) {
				const url = `/api/f33030?ancd=${encodeURIComponent(memberAncd(member))}&pnum=${encodeURIComponent(
					memberPnum(member)
				)}&startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}`;
				const response = await fetch(url, { method: 'GET', cache: 'no-store' });
				const result = await response.json().catch(() => ({}));
				if (!response.ok || !result?.success) {
					throw new Error(result?.error || '목욕서비스 조회 실패');
				}
				const list = Array.isArray(result.data) ? result.data : [];
				const rows: BathPrintRow[] = list.map((r: any) => {
					const beforeFromLegacy =
						xoToAbnormal(r?.AF_FACE) ||
						xoToAbnormal(r?.AF_LIP) ||
						xoToAbnormal(r?.AF_NAIL_COLOR) ||
						xoToAbnormal(r?.AF_COG_STAT)
							? '이상'
							: '';
					const afterFromLegacy =
						xoToAbnormal(r?.BF_FACE) ||
						xoToAbnormal(r?.BF_LIP) ||
						xoToAbnormal(r?.BF_NAIL_COLOR) ||
						xoToAbnormal(r?.BF_COG_STAT)
							? '이상'
							: '';
					return {
						VDT: formatDateYmd(r?.VDT ?? r?.vdt),
						SRV_TM: normalizeTimeHm(r?.SRV_TM ?? r?.srv_tm) || String(r?.SRV_TM ?? ''),
						BEN_STAT: String(r?.BEN_STAT ?? '').trim(),
						BATH_METH: String(r?.BATH_METH ?? '').trim(),
						BATH_METH_NM: String(r?.BATH_METH_NM ?? '').trim(),
						BEF_STAT: String(r?.BEF_STAT ?? '').trim() || beforeFromLegacy,
						MOVE_STAT: String(r?.MOVE_STAT ?? '').trim(),
						AFT_STAT: String(r?.AFT_STAT ?? '').trim() || afterFromLegacy,
						SRV_WRNG_DESC: String(r?.SRV_WRNG_DESC ?? '').trim(),
						INEMPNM: String(r?.INEMPNM ?? '').trim(),
					};
				});
				items.push({ member, rows });
			}
			const html = buildBathServicePrintHtml({
				blank: false,
				year: range.year,
				month: range.month,
				items,
			});
			openBathServicePrint(html);
		} catch (err) {
			console.error('목욕서비스 출력 오류:', err);
			alert(err instanceof Error ? err.message : '출력 준비 중 오류가 발생했습니다.');
		} finally {
			setPrinting(false);
		}
	};

	const serviceDateTotalPages = Math.ceil(serviceDates.length / serviceDateItemsPerPage);
	const serviceDateStartIndex = (serviceDatePage - 1) * serviceDateItemsPerPage;
	const serviceDateEndIndex = serviceDateStartIndex + serviceDateItemsPerPage;
	const currentDateItems = serviceDates.slice(serviceDateStartIndex, serviceDateEndIndex);
	const canEdit = isFormOpen;
	const fieldCls = canEdit
		? 'px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500'
		: 'px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50';

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

					<div className="mb-3">
						<h3 className="mb-2 text-sm font-semibold text-blue-900">수급자 목록</h3>
						<div className="space-y-2">
							<div className="space-y-1">
								<div className="text-xs text-blue-900/80">이름 검색</div>
								<input
									className="w-full px-2 py-1 text-xs bg-white border border-blue-300 rounded"
									placeholder="예) 홍길동"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
								/>
							</div>
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
												key={`${memberAncd(member)}-${memberPnum(member)}-${index}`}
												onClick={() => handleSelectMember(member)}
												className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
													memberKey(selectedMember) === memberKey(member) ? 'bg-blue-100' : ''
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

				{/* 중간 패널: 제공일자 목록 */}
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 px-4 py-3 border-r border-blue-200 bg-blue-50 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="mb-2 flex items-center justify-between gap-2">
						<label className="text-sm font-medium text-blue-900">제공일자</label>
						<button
							type="button"
							onClick={handleCreateDate}
							className="px-2 py-1 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto bg-white">
							{loadingServices ? (
								<div className="px-2 py-1 text-sm text-blue-900/60">로딩 중...</div>
							) : serviceDates.length === 0 ? (
								<div className="px-2 py-1 text-sm text-blue-900/60">
									{selectedMember ? '오른쪽 신규 버튼으로 일자를 생성해주세요' : '수급자를 선택해주세요'}
								</div>
							) : (
								currentDateItems.map((date, localIndex) => {
									const globalIndex = serviceDateStartIndex + localIndex;
									const isDraft = unsavedNewDate === date;
									return (
										<div
											key={`${date}-${globalIndex}`}
											className={`flex items-center gap-1 px-2 py-1.5 rounded ${
												selectedDateIndex === globalIndex ? 'bg-blue-200 font-semibold' : 'hover:bg-blue-100'
											}`}
										>
											<button
												type="button"
												onClick={() => handleSelectDate(globalIndex)}
												className="flex-1 min-w-0 text-left text-base cursor-pointer"
											>
												{formatDateDisplay(date)}
												{isDraft ? <span className="ml-1 text-[11px] font-normal text-blue-700">작성중</span> : null}
											</button>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													void handleDeleteDate(globalIndex);
												}}
												className="shrink-0 px-1.5 py-0.5 text-[11px] font-medium rounded border border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-200"
											>
												삭제
											</button>
										</div>
									);
								})
							)}
						</div>
						{serviceDateTotalPages > 1 && (
							<div className="p-2 mt-2">
								<div className="flex items-center justify-center gap-1">
									<button
										onClick={() => setServiceDatePage(1)}
										disabled={serviceDatePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										onClick={() => setServiceDatePage((prev) => Math.max(1, prev - 1))}
										disabled={serviceDatePage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;
									</button>

									<input
										type="number"
										value={serviceDatePage}
										onChange={(e) => {
											const page = parseInt(e.target.value);
											if (page >= 1 && page <= serviceDateTotalPages) {
												setServiceDatePage(page);
											}
										}}
										className="w-12 px-2 py-1 text-xs text-center border border-blue-300 rounded"
										min={1}
										max={serviceDateTotalPages}
									/>

									<button
										onClick={() => setServiceDatePage((prev) => Math.min(serviceDateTotalPages, prev + 1))}
										disabled={serviceDatePage >= serviceDateTotalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										onClick={() => setServiceDatePage(serviceDateTotalPages)}
										disabled={serviceDatePage >= serviceDateTotalPages}
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
					<div className="flex items-center justify-between gap-2 mb-3">
						<p className="text-xs text-blue-800/70">
							{formMode === 'view'
								? '읽기모드 · 「수정」을 눌러 편집할 수 있습니다.'
								: formMode === 'create'
									? '신규작성 · 입력 후 「저장」으로 반영합니다.'
									: '수정모드 · 변경 후 「저장」으로 반영합니다.'}
						</p>
					</div>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">수급자</label>
								<input
									type="text"
									value={formData.beneficiary}
									readOnly
									className="px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 min-w-[150px]"
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">일자</label>
								<input
									type="text"
									value={formData.serviceDate}
									readOnly
									className="px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 min-w-[130px]"
									placeholder="신규로 생성"
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">시간</label>
								<TimeHmInput
									value={formData.serviceTime}
									onChange={(next) => setFormData((prev) => ({ ...prev, serviceTime: next }))}
									disabled={!canEdit}
								/>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">수급자상태</label>
							<input
								type="text"
								value={formData.beneficiaryStatus}
								readOnly={!canEdit}
								onChange={(e) => setFormData((prev) => ({ ...prev, beneficiaryStatus: e.target.value }))}
								className={`flex-1 ${fieldCls}`}
								placeholder="수급자 상태를 입력하세요"
							/>
						</div>

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">목욕방법</label>
							<select
								value={formData.bathingMethod}
								disabled={!canEdit}
								onChange={(e) => setFormData((prev) => ({ ...prev, bathingMethod: e.target.value }))}
								className={`flex-1 ${fieldCls}${!canEdit ? ' cursor-not-allowed' : ''}`}
							>
								{(BATH_METHOD_OPTIONS as readonly string[]).includes(formData.bathingMethod)
									? BATH_METHOD_OPTIONS.map((opt) => (
										<option key={opt} value={opt}>{opt}</option>
									))
									: [formData.bathingMethod, ...BATH_METHOD_OPTIONS].map((opt) => (
										<option key={opt} value={opt}>{opt}</option>
									))}
							</select>
						</div>

						<div className="overflow-x-auto border border-blue-300 rounded">
							<table className="w-full text-sm border-collapse">
								<tbody>
									{(
										[
											{ key: 'beforeBath', label: '목욕전' },
											{ key: 'moveMethod', label: '이동방법' },
											{ key: 'afterBath', label: '목욕후' },
										] as const
									).map((row) => (
										<tr key={row.key}>
											<th className="w-28 px-3 py-2 font-medium text-center text-blue-900 border border-blue-200 bg-blue-50">
												{row.label}
											</th>
											<td className="px-3 py-2 border border-blue-200">
												<select
													value={formData[row.key]}
													disabled={!canEdit}
													onChange={(e) =>
														setFormData((prev) => ({ ...prev, [row.key]: e.target.value as StatValue }))
													}
													className={`w-full max-w-xs ${fieldCls}${!canEdit ? ' cursor-not-allowed' : ''}`}
												>
													{STAT_OPTIONS.map((opt) => (
														<option key={opt.value} value={opt.value}>{opt.label}</option>
													))}
												</select>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="flex items-start gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">특이사항</label>
							<textarea
								value={formData.remarks}
								readOnly={!canEdit}
								onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
								className={`flex-1 ${fieldCls}`}
								rows={4}
								placeholder="특이사항을 입력하세요"
							/>
						</div>

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">제공자</label>
							<input
								type="text"
								value={formData.provider}
								readOnly={!canEdit}
								onChange={(e) => setFormData((prev) => ({ ...prev, provider: e.target.value }))}
								className={`flex-1 ${fieldCls}`}
								placeholder="제공자(직원)를 입력하세요"
							/>
						</div>
					</div>

					<div className="flex justify-end gap-2 mt-6">
						{formMode === 'view' ? (
							<button
								type="button"
								onClick={handleEnterEdit}
								disabled={selectedDateIndex === null || loadingServices}
								className="px-6 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								수정
							</button>
						) : (
							<>
								<button
									type="button"
									onClick={handleCancelForm}
									disabled={loadingServices}
									className="px-6 py-2 text-sm font-medium text-rose-800 bg-rose-100 border border-rose-300 rounded hover:bg-rose-200 disabled:opacity-50"
								>
									취소
								</button>
								<button
									type="button"
									onClick={handleSave}
									disabled={loadingServices}
									className="px-6 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
								>
									저장
								</button>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import {
	NO_ROOM_VALUE,
	attachLatestRoomNoByPnum,
	availableFloorsFromMembers,
	extractMemberFloor,
	normalizeRoomNo
} from '../../utils/roomNoFloor';
import { resolveBathMethodFromRow } from '../../utils/physicalActivityFields';

interface MemberData {
	[key: string]: any;
}

type Yn01 = '0' | '1';

/** F14020 일 서비스실적 폼 (스키마 컬럼명 기준) */
interface DailyCareForm {
	GYN: Yn01;
	GINFO: string;
	MOST: string;
	LCST: string;
	DNST: string;
	MGST: string;
	AGST: string;
	DGST: string;
	MOVOL: string;
	LCVOL: string;
	DNVOL: string;
	MGVOL: string;
	AGVOL: string;
	DGVOL: string;
	ST_KIND: string;
	ST_PLAC: string;
	ST_ETC: string;
	PH_HEAD_HELP: Yn01;
	PH_BATH_HELP: Yn01;
	PH_BATH_TM: string;
	PH_BATH_METH: string;
	PH_MEAL_KIND: string;
	PH_MEAL_VAL: string;
	PH_TOL_CNT: string;
	PH_MOVE_HELP: Yn01;
	PH_CHANG_HELP: Yn01;
	PH_WORK_HELP: Yn01;
	PH_OUT_HELP: Yn01;
	PH_PS: string;
	PH_WRITE_NAME: string;
	RG_AID_HELP: Yn01;
	RG_TALK_HELP: Yn01;
	RG_PS: string;
	RG_WRITE_NAME: string;
	NS_SBDP: string;
	NS_EBDP: string;
	NS_TMPBD: string;
	NS_HLTH_TIME: string;
	NS_HLTH_HELP: Yn01;
	NS_NRSE_TIME: string;
	NS_NRSE_HELP: Yn01;
	NS_ETC: Yn01;
	NS_MEDI_CHK: Yn01;
	NS_SORE_CHK: Yn01;
	NS_SORE_MNG: Yn01;
	NS_SORE_DESC: string;
	NS_PS: string;
	NS_WRITE_NAME: string;
	FN_COGN_HELP: Yn01;
	FN_MOVE_HELP: Yn01;
	FN_MIND_HELP: Yn01;
	FN_PHY_HELP: Yn01;
	FN_PS: string;
	FN_WRITE_NAME: string;
	ROOM_NO: string;
	IO_TM_INFO: string;
}

const yn = (v: unknown, fallback: Yn01 = '0'): Yn01 => {
	const s = String(v ?? '').trim().toLowerCase();
	if (s === '1' || s === 'y' || s === 'true') return '1';
	if (s === '0' || s === 'n' || s === 'false') return '0';
	return fallback;
};

const strOr = (v: unknown, fallback = '') => {
	if (v == null) return fallback;
	const s = String(v).trim();
	return s === '' ? fallback : s;
};

const status01 = (v: unknown, fallback = '1') => {
	const s = String(v ?? '').trim();
	if (s === '1' || s === '2') return s;
	if (s === '양호') return '1';
	if (s === '이상') return '2';
	return fallback;
};

const emptyForm = (overrides: Partial<DailyCareForm> = {}): DailyCareForm => ({
	GYN: '0',
	GINFO: '',
	MOST: '1',
	LCST: '1',
	DNST: '1',
	MGST: '1',
	AGST: '1',
	DGST: '1',
	MOVOL: '',
	LCVOL: '',
	DNVOL: '',
	MGVOL: '',
	AGVOL: '',
	DGVOL: '',
	ST_KIND: '',
	ST_PLAC: '',
	ST_ETC: '',
	PH_HEAD_HELP: '1',
	PH_BATH_HELP: '0',
	PH_BATH_TM: '30',
	PH_BATH_METH: '2',
	PH_MEAL_KIND: '1',
	PH_MEAL_VAL: '1',
	PH_TOL_CNT: '',
	PH_MOVE_HELP: '1',
	PH_CHANG_HELP: '1',
	PH_WORK_HELP: '0',
	PH_OUT_HELP: '0',
	PH_PS: '',
	PH_WRITE_NAME: '',
	RG_AID_HELP: '1',
	RG_TALK_HELP: '1',
	RG_PS: '',
	RG_WRITE_NAME: '',
	NS_SBDP: '',
	NS_EBDP: '',
	NS_TMPBD: '',
	NS_HLTH_TIME: '10',
	NS_HLTH_HELP: '1',
	NS_NRSE_TIME: '10',
	NS_NRSE_HELP: '1',
	NS_ETC: '0',
	NS_MEDI_CHK: '0',
	NS_SORE_CHK: '0',
	NS_SORE_MNG: '0',
	NS_SORE_DESC: '',
	NS_PS: '',
	NS_WRITE_NAME: '',
	FN_COGN_HELP: '1',
	FN_MOVE_HELP: '1',
	FN_MIND_HELP: '1',
	FN_PHY_HELP: '1',
	FN_PS: '',
	FN_WRITE_NAME: '',
	ROOM_NO: '',
	IO_TM_INFO: '',
	...overrides
});

const toYmd = (d: Date) => {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
};

const formatDateYmd = (v: unknown) => {
	if (v == null) return '';
	const s = String(v).trim();
	if (!s) return '';
	if (s.includes('T')) return s.split('T')[0];
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	return s.length >= 10 ? s.slice(0, 10) : s;
};

type MealStatusKey = 'MOST' | 'LCST' | 'DNST' | 'MGST' | 'AGST' | 'DGST';
type MealVolKey = 'MOVOL' | 'LCVOL' | 'DNVOL' | 'MGVOL' | 'AGVOL' | 'DGVOL';

function MealStatusRow({
	label,
	statusKey,
	volKey,
	isSnack = false,
	statusValue,
	volValue,
	disabled,
	onStatusChange,
	onVolChange
}: {
	label: string;
	statusKey: MealStatusKey;
	volKey: MealVolKey;
	isSnack?: boolean;
	statusValue: string;
	volValue: string;
	disabled: boolean;
	onStatusChange: (key: MealStatusKey, value: string) => void;
	onVolChange: (key: MealVolKey, value: string) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<label className="w-16 shrink-0 text-blue-900/80">{label}</label>
			<select
				className="w-24 shrink-0 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
				value={statusValue}
				disabled={disabled}
				onChange={(e) => onStatusChange(statusKey, e.target.value)}
			>
				<option value="1">양호</option>
				<option value="2">이상</option>
			</select>
			<input
				type="text"
				className="flex-1 min-w-0 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
				value={volValue}
				disabled={disabled}
				onChange={(e) => onVolChange(volKey, e.target.value)}
				placeholder={isSnack ? '간식명' : '섭취량'}
			/>
		</div>
	);
}

function CheckRow({
	label,
	field,
	checked,
	disabled,
	className = 'md:col-span-6',
	onToggle
}: {
	label: string;
	field: keyof DailyCareForm;
	checked: boolean;
	disabled: boolean;
	className?: string;
	onToggle: (field: keyof DailyCareForm) => void;
}) {
	return (
		<label
			className={`flex items-center col-span-12 gap-2 ${className} ${
				disabled ? 'cursor-default' : 'cursor-pointer'
			}`}
		>
			<input
				type="checkbox"
				className={`h-4 w-4 rounded border-blue-400 accent-blue-600 ${
					disabled ? 'pointer-events-none opacity-100' : ''
				}`}
				checked={checked}
				readOnly={disabled}
				tabIndex={disabled ? -1 : 0}
				onChange={() => {
					if (!disabled) onToggle(field);
				}}
			/>
			<span className="text-blue-900/80">{label}</span>
		</label>
	);
}

const mapRowToForm = (row: any, member: MemberData | null): DailyCareForm => {
	const bathMeth = resolveBathMethodFromRow(row) || strOr(row?.PH_BATH_METH, '2');
	return emptyForm({
		GYN: yn(row?.GYN, '0'),
		GINFO: strOr(row?.GINFO),
		MOST: status01(row?.MOST),
		LCST: status01(row?.LCST),
		DNST: status01(row?.DNST),
		MGST: status01(row?.MGST),
		AGST: status01(row?.AGST),
		DGST: status01(row?.DGST),
		MOVOL: strOr(row?.MOVOL),
		LCVOL: strOr(row?.LCVOL),
		DNVOL: strOr(row?.DNVOL),
		MGVOL: strOr(row?.MGVOL),
		AGVOL: strOr(row?.AGVOL),
		DGVOL: strOr(row?.DGVOL),
		ST_KIND: strOr(row?.ST_KIND),
		ST_PLAC: strOr(row?.ST_PLAC),
		ST_ETC: strOr(row?.ST_ETC),
		PH_HEAD_HELP: yn(row?.PH_HEAD_HELP, '1'),
		PH_BATH_HELP: yn(row?.PH_BATH_HELP, '0'),
		PH_BATH_TM: strOr(row?.PH_BATH_TM, '30'),
		PH_BATH_METH: bathMeth,
		PH_MEAL_KIND: strOr(row?.PH_MEAL_KIND, '1'),
		PH_MEAL_VAL: strOr(row?.PH_MEAL_VAL, '1'),
		PH_TOL_CNT: strOr(row?.PH_TOL_CNT),
		PH_MOVE_HELP: yn(row?.PH_MOVE_HELP, '1'),
		PH_CHANG_HELP: yn(row?.PH_CHANG_HELP, '1'),
		PH_WORK_HELP: yn(row?.PH_WORK_HELP, '0'),
		PH_OUT_HELP: yn(row?.PH_OUT_HELP, '0'),
		PH_PS: strOr(row?.PH_PS),
		PH_WRITE_NAME: strOr(row?.PH_WRITE_NAME || row?.INEMPNM),
		RG_AID_HELP: yn(row?.RG_AID_HELP, '1'),
		RG_TALK_HELP: yn(row?.RG_TALK_HELP, '1'),
		RG_PS: strOr(row?.RG_PS),
		RG_WRITE_NAME: strOr(row?.RG_WRITE_NAME),
		NS_SBDP: strOr(row?.NS_SBDP),
		NS_EBDP: strOr(row?.NS_EBDP),
		NS_TMPBD: strOr(row?.NS_TMPBD),
		NS_HLTH_TIME: strOr(row?.NS_HLTH_TIME, '10'),
		NS_HLTH_HELP: yn(row?.NS_HLTH_HELP, '1'),
		NS_NRSE_TIME: strOr(row?.NS_NRSE_TIME, '10'),
		NS_NRSE_HELP: yn(row?.NS_NRSE_HELP, '1'),
		NS_ETC: yn(row?.NS_ETC, '0'),
		NS_MEDI_CHK: yn(row?.NS_MEDI_CHK, '0'),
		NS_SORE_CHK: yn(row?.NS_SORE_CHK, '0'),
		NS_SORE_MNG: yn(row?.NS_SORE_MNG, '0'),
		NS_SORE_DESC: strOr(row?.NS_SORE_DESC),
		NS_PS: strOr(row?.NS_PS),
		NS_WRITE_NAME: strOr(row?.NS_WRITE_NAME),
		FN_COGN_HELP: yn(row?.FN_COGN_HELP, '1'),
		FN_MOVE_HELP: yn(row?.FN_MOVE_HELP, '1'),
		FN_MIND_HELP: yn(row?.FN_MIND_HELP ?? row?.FN_MIND_TRAIN, '1'),
		FN_PHY_HELP: yn(row?.FN_PHY_HELP, '1'),
		FN_PS: strOr(row?.FN_PS),
		FN_WRITE_NAME: strOr(row?.FN_WRITE_NAME),
		ROOM_NO: strOr(row?.ROOM_NO || normalizeRoomNo(member?.ROOM_NO)),
		IO_TM_INFO: strOr(row?.IO_TM_INFO)
	});
};

export default function DailyLongtermCare() {
	const [members, setMembers] = useState<MemberData[]>([]);
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [selectedDate, setSelectedDate] = useState(toYmd(new Date()));
	const [loading, setLoading] = useState(false);
	const [loadingDetail, setLoadingDetail] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedStatus, setSelectedStatus] = useState('입소');
	const [selectedGrade, setSelectedGrade] = useState('');
	const [selectedFloor, setSelectedFloor] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;
	const [isEditMode, setIsEditMode] = useState(false);
	const [hasRecord, setHasRecord] = useState(false);
	const [form, setForm] = useState<DailyCareForm>(emptyForm());
	const [formBackup, setFormBackup] = useState<DailyCareForm | null>(null);

	const fetchMembers = async (nameSearch?: string) => {
		setLoading(true);
		setError(null);
		try {
			const url =
				nameSearch && nameSearch.trim() !== ''
					? `/api/f10010?name=${encodeURIComponent(nameSearch.trim())}`
					: '/api/f10010';
			const response = await fetch(url);
			const result = await response.json();
			if (result.success) {
				const list = Array.isArray(result.data) ? result.data : [];
				const merged = await attachLatestRoomNoByPnum(list);
				setMembers(merged);
				setSelectedMember((prev) => {
					if (!prev) return null;
					return (
						merged.find(
							(m: MemberData) =>
								String(m.ANCD) === String(prev.ANCD) && String(m.PNUM) === String(prev.PNUM)
						) ?? null
					);
				});
			} else {
				setError(result.error || '수급자 데이터 조회 실패');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '알 수 없는 오류');
		} finally {
			setLoading(false);
		}
	};

	const fetchDetail = useCallback(async (member: MemberData, svdt: string) => {
		if (!member?.ANCD || !member?.PNUM || !svdt) return;
		setLoadingDetail(true);
		setIsEditMode(false);
		setFormBackup(null);
		try {
			const url = `/api/f14020?ancd=${encodeURIComponent(String(member.ANCD))}&pnum=${encodeURIComponent(
				String(member.PNUM)
			)}&svdt=${encodeURIComponent(svdt)}`;
			const res = await fetch(url);
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || 'F14020 조회 실패');
			}
			const row = Array.isArray(json.data) ? json.data[0] : null;
			if (row) {
				setForm(mapRowToForm(row, member));
				setHasRecord(true);
			} else {
				setForm(
					emptyForm({
						ROOM_NO: normalizeRoomNo(member.ROOM_NO)
					})
				);
				setHasRecord(false);
			}
		} catch (e) {
			console.error(e);
			setForm(emptyForm({ ROOM_NO: normalizeRoomNo(member.ROOM_NO) }));
			setHasRecord(false);
		} finally {
			setLoadingDetail(false);
		}
	}, []);

	const handleMemberSelect = (member: MemberData) => {
		setSelectedMember(member);
		setIsEditMode(false);
		void fetchDetail(member, selectedDate);
	};

	const handleDateChange = (days: number) => {
		const d = new Date(`${selectedDate}T00:00:00`);
		d.setDate(d.getDate() + days);
		const next = toYmd(d);
		setSelectedDate(next);
		setIsEditMode(false);
		if (selectedMember) void fetchDetail(selectedMember, next);
	};

	const setField = <K extends keyof DailyCareForm>(key: K, value: DailyCareForm[K]) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const toggleYn = (key: keyof DailyCareForm) => {
		if (!isEditMode) return;
		setForm((prev) => ({
			...prev,
			[key]: prev[key] === '1' ? '0' : '1'
		}));
	};

	const handleEdit = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		setFormBackup({ ...form });
		setIsEditMode(true);
	};

	const handleCancel = () => {
		if (formBackup) setForm(formBackup);
		setFormBackup(null);
		setIsEditMode(false);
	};

	const handleSave = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		setSaving(true);
		try {
			const row = {
				pnum: selectedMember.PNUM,
				GYN: form.GYN,
				GINFO: form.GINFO,
				MOST: form.MOST,
				LCST: form.LCST,
				DNST: form.DNST,
				MGST: form.MGST,
				AGST: form.AGST,
				DGST: form.DGST,
				MOVOL: form.MOVOL,
				LCVOL: form.LCVOL,
				DNVOL: form.DNVOL,
				MGVOL: form.MGVOL,
				AGVOL: form.AGVOL,
				DGVOL: form.DGVOL,
				ST_KIND: form.ST_KIND || form.PH_MEAL_KIND,
				ST_PLAC: form.ST_PLAC,
				ST_ETC: form.ST_ETC,
				PH_HEAD_HELP: form.PH_HEAD_HELP,
				PH_BATH_HELP: form.PH_BATH_HELP,
				PH_BATH_TM: form.PH_BATH_TM,
				PH_BATH_METH: form.PH_BATH_METH,
				PH_MEAL_KIND: form.PH_MEAL_KIND,
				PH_MEAL_VAL: form.PH_MEAL_VAL,
				PH_TOL_CNT: form.PH_TOL_CNT,
				PH_MOVE_HELP: form.PH_MOVE_HELP,
				PH_CHANG_HELP: form.PH_CHANG_HELP,
				PH_WORK_HELP: form.PH_WORK_HELP,
				PH_OUT_HELP: form.PH_OUT_HELP,
				PH_PS: form.PH_PS,
				PH_WRITE_NAME: form.PH_WRITE_NAME,
				RG_AID_HELP: form.RG_AID_HELP,
				RG_TALK_HELP: form.RG_TALK_HELP,
				RG_PS: form.RG_PS,
				RG_WRITE_NAME: form.RG_WRITE_NAME,
				NS_SBDP: form.NS_SBDP,
				NS_EBDP: form.NS_EBDP,
				NS_TMPBD: form.NS_TMPBD,
				NS_HLTH_TIME: form.NS_HLTH_TIME,
				NS_HLTH_HELP: form.NS_HLTH_HELP,
				NS_NRSE_TIME: form.NS_NRSE_TIME,
				NS_NRSE_HELP: form.NS_NRSE_HELP,
				NS_ETC: form.NS_ETC,
				NS_MEDI_CHK: form.NS_MEDI_CHK,
				NS_SORE_CHK: form.NS_SORE_CHK,
				NS_SORE_MNG: form.NS_SORE_MNG,
				NS_SORE_DESC: form.NS_SORE_DESC,
				NS_PS: form.NS_PS,
				NS_WRITE_NAME: form.NS_WRITE_NAME,
				FN_COGN_HELP: form.FN_COGN_HELP,
				FN_MOVE_HELP: form.FN_MOVE_HELP,
				FN_MIND_HELP: form.FN_MIND_HELP,
				FN_MIND_TRAIN: form.FN_MIND_HELP,
				FN_PHY_HELP: form.FN_PHY_HELP,
				FN_PS: form.FN_PS,
				FN_WRITE_NAME: form.FN_WRITE_NAME,
				ROOM_NO: form.ROOM_NO,
				IO_TM_INFO: form.IO_TM_INFO
			};

			const res = await fetch('/api/f14020', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ svdt: selectedDate, rows: [row] })
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '저장 실패');
			}
			alert('저장되었습니다.');
			setIsEditMode(false);
			setFormBackup(null);
			setHasRecord(true);
			await fetchDetail(selectedMember, selectedDate);
		} catch (e) {
			alert(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedMember || !hasRecord) return;
		if (!confirm('해당 일자의 서비스실적을 삭제하시겠습니까?')) return;
		setSaving(true);
		try {
			const url = `/api/f14020?ancd=${encodeURIComponent(String(selectedMember.ANCD))}&pnum=${encodeURIComponent(
				String(selectedMember.PNUM)
			)}&svdt=${encodeURIComponent(selectedDate)}`;
			const res = await fetch(url, { method: 'DELETE' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '삭제 실패');
			}
			alert('삭제되었습니다.');
			setIsEditMode(false);
			setFormBackup(null);
			await fetchDetail(selectedMember, selectedDate);
		} catch (e) {
			alert(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const calculateAge = (birthDate: string | null | undefined) => {
		if (!birthDate) return '-';
		try {
			const y = parseInt(String(birthDate).substring(0, 4), 10);
			if (Number.isNaN(y)) return '-';
			return String(new Date().getFullYear() - y);
		} catch {
			return '-';
		}
	};

	const filteredMembers = members
		.filter((member) => {
			if (selectedStatus) {
				const memberStatus = String(member.P_ST || '').trim();
				if (selectedStatus === '입소' && memberStatus !== '1') return false;
				if (selectedStatus === '퇴소' && memberStatus !== '9') return false;
			}
			if (selectedGrade) {
				if (String(member.P_GRD || '').trim() !== String(selectedGrade).trim()) return false;
			}
			if (selectedFloor) {
				if (selectedFloor === NO_ROOM_VALUE) {
					if (normalizeRoomNo((member as any).ROOM_NO) !== '') return false;
				} else {
					const memberFloor = extractMemberFloor(member as any);
					const selectedFloorNum = Number(String(selectedFloor).trim());
					if (!Number.isFinite(selectedFloorNum) || memberFloor !== selectedFloorNum) return false;
				}
			}
			if (searchTerm.trim()) {
				const q = searchTerm.toLowerCase().trim();
				const hit =
					member.P_NM?.toLowerCase().includes(q) ||
					String(member.PNUM || '').includes(searchTerm) ||
					member.P_HP?.includes(searchTerm);
				if (!hit) return false;
			}
			return true;
		})
		.sort((a, b) => String(a.P_NM || '').localeCompare(String(b.P_NM || ''), 'ko'));

	const availableFloors = availableFloorsFromMembers(members as any);
	const totalPages = Math.max(1, Math.ceil(filteredMembers.length / itemsPerPage));
	const startIndex = (currentPage - 1) * itemsPerPage;
	const currentMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);

	useEffect(() => {
		void fetchMembers();
	}, []);

	// 탭 재활성화: 날짜/수급자 선택은 유지하고 목록·상세만 재조회
	useTabRefresh(() => {
		void (async () => {
			await fetchMembers(searchTerm.trim() || undefined);
			if (selectedMember) {
				void fetchDetail(selectedMember, selectedDate);
			}
		})();
	});

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, selectedStatus, selectedGrade, selectedFloor]);

	const disabled = !isEditMode;

	const noMember = !selectedMember;
	const noRecord = !!selectedMember && !hasRecord && !isEditMode && !loadingDetail;
	const contentLocked = noMember || noRecord;

	return (
		<div className="min-h-screen text-black bg-white">
			<div className="mx-auto max-w-[1400px] p-4">
				{/* 상단: 서비스일자 */}
				<div className="mb-4 flex items-center justify-center gap-3 border-b border-blue-200 pb-3">
					<button
						type="button"
						onClick={() => handleDateChange(-1)}
						className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
					>
						◁ 전일
					</button>
					<input
						type="date"
						value={selectedDate}
						onChange={(e) => {
							const v = e.target.value;
							if (!v) return;
							setSelectedDate(v);
							setIsEditMode(false);
							if (selectedMember) void fetchDetail(selectedMember, v);
						}}
						className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white text-blue-900"
					/>
					<button
						type="button"
						onClick={() => handleDateChange(1)}
						className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
					>
						다음일 ▷
					</button>
				</div>

				<div className="flex gap-4">
					{/* 좌측: 수급자 목록 */}
					<aside className="w-1/3 shrink-0">
						<div className="overflow-hidden bg-white border border-blue-300 rounded-lg shadow-sm">
							<div className="px-3 py-2 font-semibold text-blue-900 bg-blue-100 border-b border-blue-300">
								수급자 목록
							</div>
							<div className="px-3 py-2 space-y-2 border-b border-blue-100">
								<div className="space-y-1">
									<div className="text-xs text-blue-900/80">현황</div>
									<select
										value={selectedStatus}
										onChange={(e) => setSelectedStatus(e.target.value)}
										className="w-full px-2 py-1 text-sm text-blue-900 bg-white border border-blue-300 rounded"
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
										className="w-full px-2 py-1 text-sm text-blue-900 bg-white border border-blue-300 rounded"
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
									<select
										value={selectedFloor}
										onChange={(e) => setSelectedFloor(e.target.value)}
										className="w-full px-2 py-1 text-sm text-blue-900 bg-white border border-blue-300 rounded"
									>
										<option value="">층수 전체</option>
										<option value={NO_ROOM_VALUE}>방번호 없음</option>
										{availableFloors.map((floor) => (
											<option key={floor} value={String(floor)}>
												{floor}층
											</option>
										))}
									</select>
								</div>
								<div className="space-y-1">
									<div className="text-xs text-blue-900/80">이름 검색</div>
									<input
										className="w-full px-2 py-1 text-sm bg-white border border-blue-300 rounded"
										placeholder="예) 홍길동"
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												setCurrentPage(1);
												void fetchMembers(searchTerm);
											}
										}}
									/>
								</div>
								<button
									type="button"
									className="w-full py-1 text-xs text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300"
									onClick={() => {
										setCurrentPage(1);
										void fetchMembers(searchTerm);
									}}
								>
									{loading ? '검색 중...' : '검색'}
								</button>
							</div>

							<div className="overflow-y-auto max-h-[520px]">
								<table className="w-full text-xs">
									<thead className="bg-blue-50 border-b border-blue-200 sticky top-0">
										<tr>
											<th className="px-1 py-1.5 text-blue-900 font-semibold border-r border-blue-200">연번</th>
											<th className="px-1 py-1.5 text-blue-900 font-semibold border-r border-blue-200">현황</th>
											<th className="px-1 py-1.5 text-blue-900 font-semibold border-r border-blue-200">수급자명</th>
											<th className="px-1 py-1.5 text-blue-900 font-semibold border-r border-blue-200">성별</th>
											<th className="px-1 py-1.5 text-blue-900 font-semibold border-r border-blue-200">등급</th>
											<th className="px-1 py-1.5 text-blue-900 font-semibold border-r border-blue-200">방번호</th>
											<th className="px-1 py-1.5 text-blue-900 font-semibold">나이</th>
										</tr>
									</thead>
									<tbody>
										{loading ? (
											<tr>
												<td colSpan={7} className="px-2 py-4 text-center text-blue-900/60">
													로딩 중...
												</td>
											</tr>
										) : error ? (
											<tr>
												<td colSpan={7} className="px-2 py-4 text-center text-red-600">
													{error}
												</td>
											</tr>
										) : currentMembers.length === 0 ? (
											<tr>
												<td colSpan={7} className="px-2 py-4 text-center text-blue-900/60">
													수급자 데이터가 없습니다
												</td>
											</tr>
										) : (
											currentMembers.map((member, index) => (
												<tr
													key={`${member.ANCD}-${member.PNUM}-${index}`}
													onClick={() => handleMemberSelect(member)}
													className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
														selectedMember?.ANCD === member.ANCD &&
														selectedMember?.PNUM === member.PNUM
															? 'bg-blue-100'
															: ''
													}`}
												>
													<td className="px-1 py-1.5 text-center border-r border-blue-100">
														{startIndex + index + 1}
													</td>
													<td className="px-1 py-1.5 text-center border-r border-blue-100">
														{member.P_ST === '1' ? '입소' : member.P_ST === '9' ? '퇴소' : '-'}
													</td>
													<td className="px-1 py-1.5 text-center border-r border-blue-100">
														{member.P_NM || '-'}
													</td>
													<td className="px-1 py-1.5 text-center border-r border-blue-100">
														{member.P_SEX === '1' ? '남' : member.P_SEX === '2' ? '여' : '-'}
													</td>
													<td className="px-1 py-1.5 text-center border-r border-blue-100">
														{formatCareGradeLabel(member.P_GRD)}
													</td>
													<td className="px-1 py-1.5 text-center border-r border-blue-100">
														{normalizeRoomNo((member as any).ROOM_NO) !== ''
															? String((member as any).ROOM_NO)
															: '방번호없음'}
													</td>
													<td className="px-1 py-1.5 text-center">{calculateAge(member.P_BRDT)}</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>

							{totalPages > 1 && (
								<div className="p-2 border-t border-blue-200 flex justify-center gap-1">
									<button
										type="button"
										onClick={() => setCurrentPage(1)}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&lt;&lt;
									</button>
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&lt;
									</button>
									<span className="px-2 py-1 text-xs text-blue-900">
										{currentPage} / {totalPages}
									</span>
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&gt;
									</button>
									<button
										type="button"
										onClick={() => setCurrentPage(totalPages)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&gt;&gt;
									</button>
								</div>
							)}
						</div>
					</aside>

					{/* 우측: F14020 일 서비스실적 */}
					<section className="relative flex-1 min-w-0">
						<div className="bg-white border border-blue-300 rounded-lg shadow-sm">
								<div
									className={`flex items-center justify-between px-4 py-3 bg-blue-100 border-b border-blue-200 ${
										noMember ? 'blur-sm select-none pointer-events-none opacity-70' : ''
									}`}
								>
									<div>
										<h2 className="text-xl font-semibold text-blue-900">일 서비스실적 조회</h2>
										<p className="text-xs text-blue-900/70 mt-0.5">
											서비스일자 {selectedDate}
											{hasRecord ? ' · 등록됨' : ' · 미등록'}
										</p>
									</div>
									<div className="flex items-center gap-2">
										{isEditMode ? (
											<>
												<button
													type="button"
													className="px-3 py-1 text-sm text-gray-700 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300"
													onClick={handleCancel}
													disabled={saving}
												>
													취소
												</button>
												{hasRecord && (
													<button
														type="button"
														className="px-3 py-1 text-sm text-white bg-red-600 border border-red-700 rounded hover:bg-red-700 disabled:opacity-50"
														onClick={handleDelete}
														disabled={saving}
													>
														삭제
													</button>
												)}
												<button
													type="button"
													className="px-3 py-1 text-sm text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-50"
													onClick={handleSave}
													disabled={saving}
												>
													{saving ? '저장 중...' : '저장'}
												</button>
											</>
										) : (
											<button
												type="button"
												className="px-3 py-1 text-sm text-white bg-green-600 border border-green-700 rounded hover:bg-green-700"
												onClick={handleEdit}
												disabled={!selectedMember || loadingDetail}
											>
												{hasRecord ? '수정' : '등록'}
											</button>
										)}
									</div>
								</div>

								<div className="relative">
								<div
									className={
										contentLocked ? 'blur-sm select-none pointer-events-none opacity-70' : ''
									}
								>
								{loadingDetail ? (
									<div className="p-10 text-center text-blue-900/60">조회 중...</div>
								) : (
									<div className="p-4 space-y-4">
										{/* 수급자 정보 */}
										<div className="p-3 border border-blue-200 rounded bg-blue-50/50">
											<h3 className="mb-3 text-sm font-semibold text-blue-900">수급자 정보</h3>
											<div className="grid grid-cols-12 gap-3 text-sm">
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">수급자</label>
													<input
														className="flex-1 px-2 py-1 bg-slate-50 border border-blue-300 rounded"
														value={selectedMember?.P_NM || ''}
														readOnly
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">생일</label>
													<input
														className="flex-1 px-2 py-1 bg-slate-50 border border-blue-300 rounded"
														value={formatDateYmd(selectedMember?.P_BRDT) || '-'}
														readOnly
													/>
												</div>
												{/* <div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">요양등급</label>
													<input
														className="flex-1 px-2 py-1 bg-slate-50 border border-blue-300 rounded"
														value={formatCareGradeLabel(selectedMember?.P_GRD, '-')}
														readOnly
													/>
												</div> */}
												{/* <div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">성별</label>
													<input
														className="flex-1 px-2 py-1 bg-slate-50 border border-blue-300 rounded"
														value={
															selectedMember?.P_SEX === '1'
																? '남'
																: selectedMember?.P_SEX === '2'
																	? '여'
																	: '-'
														}
														readOnly
													/>
												</div> */}
												{/* <div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">인정번호</label>
													<input
														className="flex-1 px-2 py-1 bg-slate-50 border border-blue-300 rounded"
														value={String(selectedMember?.P_YYNO || selectedMember?.P_CERTNO || '-')}
														readOnly
													/>
												</div> */}
												{/* <div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">방번호</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.ROOM_NO}
														disabled={disabled}
														onChange={(e) => setField('ROOM_NO', e.target.value)}
													/>
												</div> */}
												{/* <div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">출근여부</label>
													<select
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.GYN}
														disabled={disabled}
														onChange={(e) => setField('GYN', e.target.value as Yn01)}
													>
														<option value="0">외출</option>
														<option value="1">입원(외박)</option>
													</select>
												</div> */}
												{/* <div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-24 text-blue-900/80">외출사유</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.GINFO}
														disabled={disabled}
														onChange={(e) => setField('GINFO', e.target.value)}
													/>
												</div> */}
											</div>
										</div>

										{/* 식사 서비스 */}
										<div className="p-3 border border-blue-200 rounded bg-blue-50/50">
											<h3 className="mb-3 text-sm font-semibold text-blue-900">식사 서비스</h3>
											<div className="space-y-3 text-sm">
												<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
													{/* 왼쪽: 식사 */}
													<div className="space-y-2">
														<div className="text-xs font-semibold text-blue-900/80">식사</div>
														<MealStatusRow
															label="아침"
															statusKey="MOST"
															volKey="MOVOL"
															statusValue={form.MOST}
															volValue={form.MOVOL}
															disabled={disabled}
															onStatusChange={setField}
															onVolChange={setField}
														/>
														<MealStatusRow
															label="점심"
															statusKey="LCST"
															volKey="LCVOL"
															statusValue={form.LCST}
															volValue={form.LCVOL}
															disabled={disabled}
															onStatusChange={setField}
															onVolChange={setField}
														/>
														<MealStatusRow
															label="저녁"
															statusKey="DNST"
															volKey="DNVOL"
															statusValue={form.DNST}
															volValue={form.DNVOL}
															disabled={disabled}
															onStatusChange={setField}
															onVolChange={setField}
														/>
													</div>
													{/* 오른쪽: 간식 */}
													<div className="space-y-2">
														<div className="text-xs font-semibold text-blue-900/80">간식</div>
														<MealStatusRow
															label="오전"
															statusKey="MGST"
															volKey="MGVOL"
															isSnack
															statusValue={form.MGST}
															volValue={form.MGVOL}
															disabled={disabled}
															onStatusChange={setField}
															onVolChange={setField}
														/>
														<MealStatusRow
															label="오후"
															statusKey="AGST"
															volKey="AGVOL"
															isSnack
															statusValue={form.AGST}
															volValue={form.AGVOL}
															disabled={disabled}
															onStatusChange={setField}
															onVolChange={setField}
														/>
														<MealStatusRow
															label="저녁"
															statusKey="DGST"
															volKey="DGVOL"
															isSnack
															statusValue={form.DGST}
															volValue={form.DGVOL}
															disabled={disabled}
															onStatusChange={setField}
															onVolChange={setField}
														/>
													</div>
												</div>
												<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
													<div className="flex items-center gap-2">
														<label className="w-20 shrink-0 text-blue-900/80">식사종류</label>
														<select
															className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
															value={form.PH_MEAL_KIND}
															disabled={disabled}
															onChange={(e) => setField('PH_MEAL_KIND', e.target.value)}
														>
															<option value="1">일반식</option>
															<option value="2">죽</option>
															<option value="3">유동식</option>
														</select>
													</div>
													<div className="flex items-center gap-2">
														<label className="w-20 shrink-0 text-blue-900/80">섭취량</label>
														<select
															className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
															value={form.PH_MEAL_VAL}
															disabled={disabled}
															onChange={(e) => setField('PH_MEAL_VAL', e.target.value)}
														>
															<option value="1">1</option>
															<option value="2">1/2이상</option>
															<option value="3">1/2미만</option>
														</select>
													</div>
												</div>
												<div className="flex items-center gap-2">
													<label className="w-20 shrink-0 text-blue-900/80">식사비고</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.ST_ETC}
														disabled={disabled}
														onChange={(e) => setField('ST_ETC', e.target.value)}
													/>
												</div>
											</div>
										</div>

										{/* 신체활동지원 */}
										<div className="p-3 border border-blue-200 rounded bg-blue-50/50">
											<h3 className="mb-3 text-sm font-semibold text-blue-900">신체활동지원</h3>
											<div className="grid grid-cols-12 gap-3 text-sm">
												<CheckRow label="세면·구강·머리감기·몸단장·옷갈아입히기" field="PH_HEAD_HELP" checked={form.PH_HEAD_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="이동도움 및 신체기능유지·증진" field="PH_MOVE_HELP" checked={form.PH_MOVE_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="체위변경" field="PH_CHANG_HELP" checked={form.PH_CHANG_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="산책동행" field="PH_WORK_HELP" checked={form.PH_WORK_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="외출동행" field="PH_OUT_HELP" checked={form.PH_OUT_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="목욕 실시" field="PH_BATH_HELP" checked={form.PH_BATH_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-32 text-blue-900/80">목욕 소요시간 (분)</label>
													<input
														type="number"
														className="w-24 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.PH_BATH_TM}
														disabled={disabled}
														onChange={(e) => setField('PH_BATH_TM', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-32 text-blue-900/80">목욕방법</label>
													<select
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.PH_BATH_METH}
														disabled={disabled}
														onChange={(e) => setField('PH_BATH_METH', e.target.value)}
													>
														<option value="">선택</option>
														<option value="1">전신입욕</option>
														<option value="2">샤워식</option>
														<option value="3">침상목욕</option>
													</select>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-40 text-blue-900/80">화장실이용 (회)</label>
													<input
														type="number"
														className="w-24 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.PH_TOL_CNT}
														disabled={disabled}
														onChange={(e) => setField('PH_TOL_CNT', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2">
													<label className="w-28 shrink-0 text-blue-900/80">특이사항</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.PH_PS}
														disabled={disabled}
														onChange={(e) => setField('PH_PS', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-28 shrink-0 text-blue-900/80">작성자</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.PH_WRITE_NAME}
														disabled={disabled}
														onChange={(e) => setField('PH_WRITE_NAME', e.target.value)}
													/>
												</div>
											</div>
										</div>

										{/* 인지관리 및 의사소통 */}
										<div className="p-3 border border-blue-200 rounded bg-blue-50/50">
											<h3 className="mb-3 text-sm font-semibold text-blue-900">인지관리 및 의사소통</h3>
											<div className="grid grid-cols-12 gap-3 text-sm">
												<CheckRow label="인지관리지원" field="RG_AID_HELP" checked={form.RG_AID_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="의사소통도움 등 말벗·격려" field="RG_TALK_HELP" checked={form.RG_TALK_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<div className="flex items-center col-span-12 gap-2">
													<label className="w-28 shrink-0 text-blue-900/80">특이사항</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.RG_PS}
														disabled={disabled}
														onChange={(e) => setField('RG_PS', e.target.value)}
													/>
												</div>
											</div>
										</div>

										{/* 건강 및 간호관리 */}
										<div className="p-3 border border-blue-200 rounded bg-blue-50/50">
											<h3 className="mb-3 text-sm font-semibold text-blue-900">건강 및 간호관리</h3>
											<div className="grid grid-cols-12 gap-3 text-sm">
												<div className="flex items-center col-span-12 gap-2 md:col-span-4">
													<label className="w-24 text-blue-900/80">수축기</label>
													<input
														type="number"
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_SBDP}
														disabled={disabled}
														onChange={(e) => setField('NS_SBDP', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-4">
													<label className="w-24 text-blue-900/80">이완기</label>
													<input
														type="number"
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_EBDP}
														disabled={disabled}
														onChange={(e) => setField('NS_EBDP', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-4">
													<label className="w-24 text-blue-900/80">체온</label>
													<input
														type="number"
														step="0.1"
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_TMPBD}
														disabled={disabled}
														onChange={(e) => setField('NS_TMPBD', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<input
														type="checkbox"
														className={`h-4 w-4 rounded border-blue-400 accent-blue-600 ${
															disabled ? 'pointer-events-none opacity-100' : ''
														}`}
														checked={form.NS_HLTH_HELP === '1'}
														readOnly={disabled}
														tabIndex={disabled ? -1 : 0}
														onChange={() => {
															if (!disabled) toggleYn('NS_HLTH_HELP');
														}}
													/>
													<label className="text-blue-900/80">건강관리 실시</label>
													<input
														type="number"
														className="w-20 ml-auto px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_HLTH_TIME}
														disabled={disabled}
														onChange={(e) => setField('NS_HLTH_TIME', e.target.value)}
														placeholder="분"
													/>
													<span className="text-blue-900/60 text-xs">분</span>
												</div>
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<input
														type="checkbox"
														className={`h-4 w-4 rounded border-blue-400 accent-blue-600 ${
															disabled ? 'pointer-events-none opacity-100' : ''
														}`}
														checked={form.NS_NRSE_HELP === '1'}
														readOnly={disabled}
														tabIndex={disabled ? -1 : 0}
														onChange={() => {
															if (!disabled) toggleYn('NS_NRSE_HELP');
														}}
													/>
													<label className="text-blue-900/80">간호관리 실시</label>
													<input
														type="number"
														className="w-20 ml-auto px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_NRSE_TIME}
														disabled={disabled}
														onChange={(e) => setField('NS_NRSE_TIME', e.target.value)}
														placeholder="분"
													/>
													<span className="text-blue-900/60 text-xs">분</span>
												</div>
												<CheckRow label="기타(응급서비스)" field="NS_ETC" checked={form.NS_ETC === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="투약관리" field="NS_MEDI_CHK" checked={form.NS_MEDI_CHK === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="욕창관리" field="NS_SORE_CHK" checked={form.NS_SORE_CHK === '1'} disabled={disabled} onToggle={toggleYn} />
												<div className="flex items-center col-span-12 gap-2 md:col-span-6">
													<label className="w-36 text-blue-900/80">욕창관찰</label>
													<select
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_SORE_MNG}
														disabled={disabled}
														onChange={(e) => setField('NS_SORE_MNG', e.target.value as Yn01)}
													>
														<option value="0">이상없음</option>
														<option value="1">이상있음</option>
													</select>
												</div>
												<div className="flex flex-col col-span-12 gap-1">
													<label className="text-blue-900/80">욕창 이상부위·피부상태</label>
													<textarea
														className="w-full border border-blue-300 rounded px-2 py-1 bg-white min-h-[72px] disabled:bg-slate-50"
														value={form.NS_SORE_DESC}
														disabled={disabled}
														onChange={(e) => setField('NS_SORE_DESC', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2">
													<label className="w-28 shrink-0 text-blue-900/80">간호 특이사항</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.NS_PS}
														disabled={disabled}
														onChange={(e) => setField('NS_PS', e.target.value)}
													/>
												</div>
											</div>
										</div>

										{/* 기능회복훈련 */}
										<div className="p-3 border border-blue-200 rounded bg-blue-50/50">
											<h3 className="mb-3 text-sm font-semibold text-blue-900">기능회복훈련</h3>
											<div className="grid grid-cols-12 gap-3 text-sm">
												<CheckRow label="신체·인지기능 향상 프로그램" field="FN_COGN_HELP" checked={form.FN_COGN_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="신체기능·기본동작·일상생활동작훈련" field="FN_MOVE_HELP" checked={form.FN_MOVE_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="인지기능 향상훈련" field="FN_MIND_HELP" checked={form.FN_MIND_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<CheckRow label="물리(작업)치료" field="FN_PHY_HELP" checked={form.FN_PHY_HELP === '1'} disabled={disabled} onToggle={toggleYn} />
												<div className="flex items-center col-span-12 gap-2">
													<label className="w-28 shrink-0 text-blue-900/80">특이사항</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.FN_PS}
														disabled={disabled}
														onChange={(e) => setField('FN_PS', e.target.value)}
													/>
												</div>
												<div className="flex items-center col-span-12 gap-2">
													<label className="w-36 shrink-0 text-blue-900/80">입·퇴소/외출시간</label>
													<input
														className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded disabled:bg-slate-50"
														value={form.IO_TM_INFO}
														disabled={disabled}
														onChange={(e) => setField('IO_TM_INFO', e.target.value)}
													/>
												</div>
											</div>
										</div>
									</div>
								)}
								</div>

								{noMember && (
									<div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/30 backdrop-blur-[1px]">
										<p className="text-center text-lg font-semibold text-blue-900 bg-white/95 px-8 py-5 rounded-lg border border-blue-300 shadow-md max-w-sm">
											수급자를 선택해주세요
										</p>
									</div>
								)}
								{noRecord && (
									<div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/30 backdrop-blur-[1px]">
										<p className="text-center text-lg font-semibold text-blue-900 bg-white/95 px-8 py-5 rounded-lg border border-blue-300 shadow-md max-w-sm">
											등록된 서비스실적이 없습니다
										</p>
									</div>
								)}
								</div>
							</div>
					</section>
				</div>
			</div>
		</div>
	);
}

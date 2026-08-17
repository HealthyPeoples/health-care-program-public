"use client";

/**
 * @file 욕창관리 — 화면 컴포넌트 (BedsoreManagement.tsx)
 *
 * @description
 * 요양원 욕창관리 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/bedsore-management
 *
 * @module component/nursing-home/pages/bedsore-management/BedsoreManagement
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { attachLatestRoomNoByPnum } from '../../utils/roomNoFloor';
import { RoomNoFloorSelect } from '../../components/RoomNoFloorSelect';
import { matchesSelectedFloor } from '../../utils/roomNoFloorFilter';
import {
	BEDSORE_AREA_OPTIONS,
	buildBedsoreDailyBatchPrintHtml,
	buildBedsoreDailyPrintHtml,
	isNoneOccurrence,
	parseAreaList,
} from './bedsoreManagementPrint';

interface MemberData {
	ANCD: string;
	PNUM: string;
	P_NM: string;
	P_SEX: string;
	P_GRD: string;
	P_BRDT: string;
	P_ST: string;
	P_FLOOR?: string | number | null;
	ROOM_NO?: string | null;
	[key: string]: unknown;
}

/** F33010 욕창관리일지 */
interface BedsoreRecord {
	VDT: string;
	DCUB_SEQ?: number;
	DCUB_AREA: string;
	DCUB_SIZE: string;
	DCUB_DEEP: string;
	DCUB_COLOR: string;
	DCUB_DISPO: string;
	DCUB_NONE?: string;
	DCUB_TM?: string;
	DCUB_CONF?: string;
	DCUB_ETC?: string;
	DCUB_IMG?: string;
	MIMG?: string;
}

function todayYmd() {
	const d = new Date();
	const yyyy = String(d.getFullYear()).padStart(4, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function nowHm() {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type ConfirmerDefault = { empno: string; name: string };

type EmpSuggest = { EMPNO: string; EMPNM: string };

type BedsorePhoto = { blobName: string; fileName?: string };

const MAX_BEDSORE_PHOTOS = 4;

function serializePhotos(photos: BedsorePhoto[]): string {
	if (!photos.length) return '';
	return JSON.stringify(photos.slice(0, MAX_BEDSORE_PHOTOS).map((p) => p.blobName));
}

function parsePhotos(raw: string | null | undefined): BedsorePhoto[] {
	const s = String(raw ?? '').trim();
	if (!s) return [];
	try {
		const parsed = JSON.parse(s);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((p: unknown) => {
				if (typeof p === 'string') {
					const blobName = p.trim();
					return blobName ? { blobName } : null;
				}
				if (p && typeof p === 'object') {
					const blobName = String((p as { blobName?: unknown }).blobName ?? '').trim();
					const fileName = String((p as { fileName?: unknown }).fileName ?? '').trim() || undefined;
					return blobName ? { blobName, fileName } : null;
				}
				return null;
			})
			.filter((p): p is BedsorePhoto => Boolean(p?.blobName))
			.slice(0, MAX_BEDSORE_PHOTOS);
	} catch {
		return [];
	}
}

function photoViewUrl(blobName: string, origin?: string): string {
	const path = `/api/f33010/photos?blobName=${encodeURIComponent(blobName)}`;
	if (origin) return `${origin.replace(/\/$/, '')}${path}`;
	return path;
}

function confirmerDisplay(empno: string, name: string) {
	const n = name.trim();
	const e = empno.trim();
	if (n && e) return `${n} (${e})`;
	return n || e;
}

function emptyForm(beneficiary: string, observationDate: string, confirmer: ConfirmerDefault = { empno: '', name: '' }) {
	return {
		observationDate,
		beneficiary,
		noneOccurrence: false,
		areas: [] as string[],
		otherArea: '',
		size: '',
		deep: '',
		color: '',
		remarks: '',
		checkTime: nowHm(),
		confirmerEmpno: confirmer.empno,
		confirmerName: confirmer.name,
		confirmerSearch: confirmerDisplay(confirmer.empno, confirmer.name),
		photo: '',
		seq: 0,
	};
}

type FormState = ReturnType<typeof emptyForm>;

type ObservationListItem = { VDT: string; DCUB_SEQ: number; DCUB_TM?: string };

function parseObservationList(data: unknown): ObservationListItem[] {
	if (!Array.isArray(data)) return [];
	return data
		.map((r) => {
			if (typeof r === 'string') {
				return { VDT: r.trim(), DCUB_SEQ: 1, DCUB_TM: '' };
			}
			const row = r as { VDT?: string; DCUB_SEQ?: unknown; DCUB_TM?: string };
			const VDT = String(row.VDT || '').trim();
			const seqNum = Number(row.DCUB_SEQ);
			return {
				VDT,
				DCUB_SEQ: Number.isFinite(seqNum) && seqNum > 0 ? seqNum : 1,
				DCUB_TM: String(row.DCUB_TM || '').trim(),
			};
		})
		.filter((x) => x.VDT);
}

function memberKey(m: { ANCD?: unknown; PNUM?: unknown }) {
	return `${String(m.ANCD ?? '').trim()}-${String(m.PNUM ?? '').trim()}`;
}

function monthStartYmd() {
	const d = new Date();
	const yyyy = String(d.getFullYear()).padStart(4, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${yyyy}-${mm}-01`;
}

function openPrintWindow(html: string) {
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업 차단을 해제해주세요.');
		return;
	}
	w.document.write(html);
	w.document.close();
	setTimeout(() => w.print(), 250);
}

async function resolveConfirmerLabels(rows: BedsoreRecord[]): Promise<BedsoreRecord[]> {
	const nos = Array.from(
		new Set(
			rows
				.map((r) => String(r.DCUB_CONF ?? '').trim())
				.filter((s) => /^\d+$/.test(s))
		)
	);
	const map = new Map<string, string>();
	await Promise.all(
		nos.map(async (no) => {
			try {
				const res = await fetch(`/api/f01010?empno=${encodeURIComponent(no)}`);
				const json = await res.json();
				const emp = Array.isArray(json?.data) ? json.data[0] : null;
				const nm = String(emp?.EMPNM ?? '').trim();
				if (nm) map.set(no, `${nm} (${no})`);
			} catch {
				/* ignore */
			}
		})
	);
	return rows.map((r) => {
		const conf = String(r.DCUB_CONF ?? '').trim();
		return { ...r, DCUB_CONF: map.get(conf) || conf };
	});
}

export default function BedsoreManagement() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [observationDates, setObservationDates] = useState<ObservationListItem[]>([]);
	const [loadingObservations, setLoadingObservations] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [isNewRecord, setIsNewRecord] = useState(false);
	const [datePage, setDatePage] = useState(1);
	const dateItemsPerPage = 10;

	const [formData, setFormData] = useState<FormState>(emptyForm('', todayYmd()));
	const [originalForm, setOriginalForm] = useState<FormState | null>(null);
	const [defaultConfirmer, setDefaultConfirmer] = useState<ConfirmerDefault>({ empno: '', name: '' });
	const [empSuggestions, setEmpSuggestions] = useState<EmpSuggest[]>([]);
	const [showEmpDropdown, setShowEmpDropdown] = useState(false);
	const [photoUploading, setPhotoUploading] = useState(false);
	const photoInputRef = useRef<HTMLInputElement | null>(null);

	const [memberList, setMemberList] = useState<MemberData[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<string>('입소');
	const [selectedGrade, setSelectedGrade] = useState<string>('');
	const [selectedFloor, setSelectedFloor] = useState<string>('');
	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;
	const [checkedMemberKeys, setCheckedMemberKeys] = useState<Set<string>>(new Set());
	const [printFrom, setPrintFrom] = useState(() => monthStartYmd());
	const [printTo, setPrintTo] = useState(() => todayYmd());
	const [printing, setPrinting] = useState(false);

	const fetchMembers = async (nameSearch?: string) => {
		setLoading(true);
		try {
			const url =
				nameSearch && nameSearch.trim() !== ''
					? `/api/f10010?name=${encodeURIComponent(nameSearch.trim())}`
					: '/api/f10010';
			const response = await fetch(url);
			const result = await response.json();
			if (result.success) {
				const list = Array.isArray(result.data) ? (result.data as MemberData[]) : [];
				const merged = await attachLatestRoomNoByPnum(list);
				setMemberList(merged);
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
			const year = parseInt(birthDate.substring(0, 4), 10);
			const currentYear = new Date().getFullYear();
			return (currentYear - year).toString();
		} catch {
			return '-';
		}
	};

	const filteredMembers = memberList
		.filter((member) => {
			if (selectedStatus) {
				const memberStatus = String(member.P_ST || '').trim();
				if (selectedStatus === '입소' && memberStatus !== '1') return false;
				if (selectedStatus === '퇴소' && memberStatus !== '9') return false;
			}
			if (selectedGrade) {
				const memberGrade = String(member.P_GRD || '').trim();
				if (memberGrade !== String(selectedGrade).trim()) return false;
			}
			if (selectedFloor) {
				if (!matchesSelectedFloor(member, selectedFloor)) return false;
			}
			if (searchTerm.trim()) {
				const searchLower = searchTerm.toLowerCase().trim();
				if (!String(member.P_NM || '').toLowerCase().includes(searchLower)) return false;
			}
			return true;
		})
		.sort((a, b) => String(a.P_NM || '').trim().localeCompare(String(b.P_NM || '').trim(), 'ko'));

	const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const currentMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);

	const allFilteredChecked =
		filteredMembers.length > 0 && filteredMembers.every((m) => checkedMemberKeys.has(memberKey(m)));

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

	const toggleMemberChecked = (member: MemberData, checked: boolean) => {
		setCheckedMemberKeys((prev) => {
			const next = new Set(prev);
			const key = memberKey(member);
			if (checked) next.add(key);
			else next.delete(key);
			return next;
		});
	};

	const handlePageChange = (page: number) => setCurrentPage(page);

	useEffect(() => {
		fetchMembers();
		void (async () => {
			try {
				const res = await fetch('/api/auth/user-info', { credentials: 'include', cache: 'no-store' });
				const result = await res.json().catch(() => ({}));
				if (res.ok && result?.success) {
					const name = String(result?.data?.empnm ?? result?.data?.EMPNM ?? '').trim();
					const empno = String(result?.data?.empno ?? result?.data?.EMPNO ?? '').trim();
					if (name || empno) {
						const conf = { empno, name };
						setDefaultConfirmer(conf);
						setFormData((prev) =>
							prev.confirmerEmpno || prev.confirmerSearch
								? prev
								: { ...prev, confirmerEmpno: empno, confirmerName: name, confirmerSearch: confirmerDisplay(empno, name) }
						);
					}
				}
			} catch {
				/* ignore */
			}
		})();
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

	const fetchObservationDates = async (pnum: string) => {
		const pn = String(pnum || '').trim();
		if (!pn) {
			setObservationDates([]);
			return;
		}
		setLoadingObservations(true);
		try {
			const res = await fetch(`/api/f33010?mode=dates&pnum=${encodeURIComponent(pn)}`);
			const json = await res.json();
			const list = parseObservationList(json?.data);
			setObservationDates(list);
			setDatePage(1);
		} catch (e) {
			console.error('관찰일자 조회 오류:', e);
			setObservationDates([]);
		} finally {
			setLoadingObservations(false);
		}
	};

	const mapDetailToForm = (data: BedsoreRecord | null, beneficiary: string, dateStr: string): FormState => {
		if (!data) {
			return emptyForm(beneficiary, dateStr, defaultConfirmer);
		}
		const none = isNoneOccurrence(data);
		const rawAreas = parseAreaList(data.DCUB_AREA).filter((a) => a !== '발생없음' && a !== '발생 없음');
		const known = new Set<string>(BEDSORE_AREA_OPTIONS);
		const areas = rawAreas.filter((a) => known.has(a));
		const unmatched = rawAreas.filter((a) => !known.has(a));
		if (unmatched.length > 0 && !areas.includes('기타')) areas.push('기타');
		const etc = String(data.DCUB_ETC ?? '').trim() || unmatched.join(', ');
		return {
			observationDate: String(data.VDT || dateStr).slice(0, 10),
			beneficiary,
			noneOccurrence: none,
			areas: none ? [] : areas,
			otherArea: none ? '' : etc,
			size: none ? '' : String(data.DCUB_SIZE ?? '').trim(),
			deep: none ? '' : String(data.DCUB_DEEP ?? '').trim(),
			color: none ? '' : String(data.DCUB_COLOR ?? '').trim(),
			remarks: String(data.DCUB_DISPO ?? '').trim(),
			checkTime: String(data.DCUB_TM ?? '').trim(),
			confirmerEmpno: '',
			confirmerName: '',
			confirmerSearch: String(data.DCUB_CONF ?? '').trim(),
			photo: String(data.DCUB_IMG ?? '').trim(),
			seq: Number(data.DCUB_SEQ) > 0 ? Number(data.DCUB_SEQ) : 1,
		};
	};

	const loadDetail = async (member: MemberData, vdt: string, seq = 0) => {
		setDetailLoading(true);
		try {
			const pn = encodeURIComponent(String(member.PNUM).trim());
			const vd = encodeURIComponent(vdt);
			const seqQs = seq > 0 ? `&seq=${encodeURIComponent(String(seq))}` : '';
			const res = await fetch(`/api/f33010?pnum=${pn}&vdt=${vd}${seqQs}`);
			const json = await res.json();
			const row = json?.data as BedsoreRecord | null;
			const beneficiary = member.P_NM || '';
			if (!row) {
				setFormData(emptyForm(beneficiary, vdt, defaultConfirmer));
				setIsEditMode(true);
				setIsNewRecord(true);
				setOriginalForm(null);
				return;
			}
			const fd = mapDetailToForm(row, beneficiary, vdt);
			const confRaw = String(row.DCUB_CONF ?? '').trim();
			if (/^\d+$/.test(confRaw)) {
				fd.confirmerEmpno = confRaw;
				try {
					const empRes = await fetch(`/api/f01010?empno=${encodeURIComponent(confRaw)}`);
					const empJson = await empRes.json();
					const emp = Array.isArray(empJson?.data) ? empJson.data[0] : null;
					const empnm = String(emp?.EMPNM ?? '').trim();
					fd.confirmerName = empnm;
					fd.confirmerSearch = confirmerDisplay(confRaw, empnm) || confRaw;
				} catch {
					fd.confirmerSearch = confRaw;
				}
			} else if (confRaw) {
				fd.confirmerName = confRaw;
				fd.confirmerSearch = confRaw;
			} else {
				fd.confirmerEmpno = defaultConfirmer.empno;
				fd.confirmerName = defaultConfirmer.name;
				fd.confirmerSearch = confirmerDisplay(defaultConfirmer.empno, defaultConfirmer.name);
			}
			setFormData(fd);
			setIsEditMode(false);
			setIsNewRecord(false);
			setOriginalForm(JSON.parse(JSON.stringify(fd)));
		} catch (e) {
			console.error('욕창 상세 조회 오류:', e);
		} finally {
			setDetailLoading(false);
		}
	};

	const handleSelectMember = (member: MemberData) => {
		setSelectedMember(member);
		setSelectedDateIndex(null);
		setIsNewRecord(false);
		setIsEditMode(false);
		setFormData(emptyForm(member.P_NM || '', todayYmd(), defaultConfirmer));
		setOriginalForm(null);
		fetchObservationDates(String(member.PNUM));
	};

	const handleSelectDate = async (index: number) => {
		setSelectedDateIndex(index);
		const item = observationDates[index];
		if (!selectedMember || !item) return;
		setFormData((prev) => ({ ...prev, observationDate: item.VDT, seq: item.DCUB_SEQ }));
		await loadDetail(selectedMember, item.VDT, item.DCUB_SEQ);
	};

	const formatDateDisplay = (dateStr: string) => {
		if (!dateStr) return '';
		let s = dateStr;
		if (s.includes('T')) s = s.split('T')[0];
		if (s.includes('-') && s.length >= 10) return s.substring(0, 10);
		if (s.length === 8 && !s.includes('-')) return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
		return s;
	};

	const formatObservationLabel = (item: ObservationListItem, list: ObservationListItem[]) => {
		const d = formatDateDisplay(item.VDT);
		const tm = String(item.DCUB_TM || '').trim();
		const sameDay = list.filter((x) => formatDateDisplay(x.VDT) === d).length;
		const base = tm ? `${d} ${tm}` : d;
		if (sameDay > 1) return `${base} (${item.DCUB_SEQ})`;
		return base;
	};

	const handleAdd = () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		const t = todayYmd();
		setFormData(emptyForm(selectedMember.P_NM || '', t, defaultConfirmer));
		setSelectedDateIndex(null);
		setIsNewRecord(true);
		setIsEditMode(true);
		setOriginalForm(null);
	};

	const handleModify = () => {
		if (!selectedMember || !formData.observationDate) {
			alert('수정할 관찰일자를 선택하거나 추가해 주세요.');
			return;
		}
		setOriginalForm(JSON.parse(JSON.stringify(formData)));
		setIsEditMode(true);
	};

	const handleCancelEdit = () => {
		if (originalForm) {
			setFormData(JSON.parse(JSON.stringify(originalForm)));
		} else if (selectedMember) {
			setFormData(emptyForm(selectedMember.P_NM || '', todayYmd(), defaultConfirmer));
		}
		setIsEditMode(false);
		setIsNewRecord(false);
		setShowEmpDropdown(false);
	};

	const toggleArea = (name: string) => {
		setFormData((prev) => {
			const has = prev.areas.includes(name);
			const areas = has ? prev.areas.filter((a) => a !== name) : [...prev.areas, name];
			return {
				...prev,
				noneOccurrence: false,
				areas,
				otherArea: name === '기타' && has ? '' : prev.otherArea,
			};
		});
	};

	const handleSave = async () => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		if (!formData.observationDate) {
			alert('관찰일자를 입력해주세요.');
			return;
		}
		if (!formData.noneOccurrence && formData.areas.length === 0) {
			alert('발생 없음을 선택하거나 부위를 선택해주세요.');
			return;
		}
		if (!formData.noneOccurrence && formData.areas.includes('기타') && !formData.otherArea.trim()) {
			alert('기타 부위를 입력해주세요.');
			return;
		}
		setLoadingObservations(true);
		try {
			const payload = {
				PNUM: selectedMember.PNUM,
				VDT: formData.observationDate,
				DCUB_NONE: formData.noneOccurrence ? '1' : '0',
				DCUB_AREA: formData.noneOccurrence ? '' : formData.areas.join(','),
				DCUB_SIZE: formData.noneOccurrence ? '' : formData.size.trim(),
				DCUB_DEEP: formData.noneOccurrence ? '' : formData.deep.trim(),
				DCUB_COLOR: formData.noneOccurrence ? '' : formData.color.trim(),
				DCUB_DISPO: formData.remarks,
				DCUB_TM: formData.checkTime,
				DCUB_CONF: formData.confirmerEmpno.trim() || formData.confirmerSearch.trim(),
				DCUB_ETC:
					formData.noneOccurrence || !formData.areas.includes('기타')
						? ''
						: formData.otherArea.trim(),
				DCUB_IMG: formData.photo,
				MIMG: '',
				isNew: isNewRecord,
				DCUB_SEQ: isNewRecord ? 0 : formData.seq,
				ORIG_VDT: originalForm?.observationDate || formData.observationDate,
				ORIG_SEQ: isNewRecord ? 0 : formData.seq,
			};
			const res = await fetch('/api/f33010', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const json = await res.json();
			if (!json?.success) {
				alert(json?.error || '저장에 실패했습니다.');
				return;
			}
			alert('저장되었습니다.');
			setIsEditMode(false);
			setIsNewRecord(false);
			const savedSeq = Number(json?.data?.DCUB_SEQ) > 0 ? Number(json.data.DCUB_SEQ) : formData.seq;
			const savedVdt = String(json?.data?.VDT || formData.observationDate).trim();
			const pn = encodeURIComponent(String(selectedMember.PNUM).trim());
			const datesRes = await fetch(`/api/f33010?mode=dates&pnum=${pn}`);
			const dj = await datesRes.json();
			const list = parseObservationList(dj?.data);
			setObservationDates(list);
			setDatePage(1);
			const savedYmd = savedVdt.slice(0, 10);
			const idx = list.findIndex(
				(x) => x.VDT.slice(0, 10) === savedYmd && x.DCUB_SEQ === savedSeq
			);
			setSelectedDateIndex(idx >= 0 ? idx : null);
			await loadDetail(selectedMember, savedVdt, savedSeq);
		} catch (err) {
			console.error('저장 오류:', err);
			alert('저장 중 오류가 발생했습니다.');
		} finally {
			setLoadingObservations(false);
		}
	};

	const handleDeleteDate = async (item: ObservationListItem) => {
		if (!selectedMember) {
			alert('수급자를 선택해주세요.');
			return;
		}
		const dateLabel = formatObservationLabel(item, observationDates);
		if (!confirm(`${dateLabel} 관찰 기록을 삭제할까요?`)) return;
		setLoadingObservations(true);
		try {
			const pn = encodeURIComponent(String(selectedMember.PNUM).trim());
			const vd = encodeURIComponent(item.VDT);
			const seqQs = item.DCUB_SEQ > 0 ? `&seq=${encodeURIComponent(String(item.DCUB_SEQ))}` : '';
			const res = await fetch(`/api/f33010?pnum=${pn}&vdt=${vd}${seqQs}`, { method: 'DELETE' });
			const json = await res.json();
			if (!json?.success) {
				alert(json?.error || '삭제에 실패했습니다.');
				return;
			}
			alert('삭제되었습니다.');
			const selected = selectedDateIndex !== null ? observationDates[selectedDateIndex] : null;
			const deletedCurrent =
				selected &&
				formatDateDisplay(selected.VDT) === formatDateDisplay(item.VDT) &&
				selected.DCUB_SEQ === item.DCUB_SEQ;
			if (deletedCurrent) {
				setSelectedDateIndex(null);
				setIsEditMode(false);
				setIsNewRecord(false);
				setFormData(emptyForm(selectedMember.P_NM || '', todayYmd(), defaultConfirmer));
			}
			await fetchObservationDates(String(selectedMember.PNUM));
		} catch (e) {
			console.error('삭제 오류:', e);
			alert('삭제 중 오류가 발생했습니다.');
		} finally {
			setLoadingObservations(false);
		}
	};

	const searchEmployee = async (term: string) => {
		const q = term.trim();
		if (!q) {
			setEmpSuggestions([]);
			setShowEmpDropdown(false);
			return;
		}
		try {
			const res = await fetch(`/api/f01010?q=${encodeURIComponent(q)}`);
			const json = await res.json();
			const list = Array.isArray(json?.data)
				? (json.data as Array<{ EMPNO?: unknown; EMPNM?: unknown }>).map((r) => ({
						EMPNO: String(r.EMPNO ?? '').trim(),
						EMPNM: String(r.EMPNM ?? '').trim(),
					}))
				: [];
			setEmpSuggestions(list.filter((x) => x.EMPNO || x.EMPNM));
			setShowEmpDropdown(list.length > 0);
		} catch (err) {
			console.error('직원 검색 오류:', err);
			setEmpSuggestions([]);
			setShowEmpDropdown(false);
		}
	};

	useEffect(() => {
		const canEdit = isEditMode || isNewRecord;
		if (!canEdit) {
			setShowEmpDropdown(false);
			return;
		}
		const selectedLabel = confirmerDisplay(formData.confirmerEmpno, formData.confirmerName);
		if (formData.confirmerEmpno && formData.confirmerSearch.trim() === selectedLabel) {
			setShowEmpDropdown(false);
			return;
		}
		const timer = setTimeout(() => {
			if (formData.confirmerSearch.trim()) {
				void searchEmployee(formData.confirmerSearch);
			} else {
				setEmpSuggestions([]);
				setShowEmpDropdown(false);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [formData.confirmerSearch, formData.confirmerEmpno, formData.confirmerName, isEditMode, isNewRecord]);

	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (!target.closest('.employee-dropdown-container')) {
				setShowEmpDropdown(false);
			}
		};
		document.addEventListener('mousedown', onClick);
		return () => document.removeEventListener('mousedown', onClick);
	}, []);

	const attachedPhotos = useMemo(() => parsePhotos(formData.photo), [formData.photo]);

	const handleUploadPhotos = async (files: FileList | null) => {
		if (fieldsLocked) {
			alert('「수정」또는 「추가」후 사진을 첨부할 수 있습니다.');
			return;
		}
		if (!files || files.length === 0) return;
		const remain = MAX_BEDSORE_PHOTOS - attachedPhotos.length;
		if (remain <= 0) {
			alert(`사진은 최대 ${MAX_BEDSORE_PHOTOS}장까지 첨부할 수 있습니다.`);
			return;
		}
		const picked = Array.from(files).slice(0, remain);
		setPhotoUploading(true);
		try {
			const next = [...attachedPhotos];
			for (const file of picked) {
				const fd = new FormData();
				fd.append('file', file);
				const res = await fetch('/api/f33010/photos', {
					method: 'POST',
					body: fd,
					credentials: 'include',
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success || !json?.photo?.blobName) {
					throw new Error(json?.error || `${file.name} 업로드에 실패했습니다.`);
				}
				next.push({
					blobName: String(json.photo.blobName),
					fileName: String(json.photo.fileName || file.name || ''),
				});
			}
			setFormData((p) => ({ ...p, photo: serializePhotos(next) }));
			if (files.length > remain) {
				alert(`사진은 최대 ${MAX_BEDSORE_PHOTOS}장까지 첨부됩니다. 초과분은 제외되었습니다.`);
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : '사진 업로드 중 오류가 발생했습니다.');
		} finally {
			setPhotoUploading(false);
			if (photoInputRef.current) photoInputRef.current.value = '';
		}
	};

	const handleRemovePhoto = async (blobName: string) => {
		if (fieldsLocked) {
			alert('「수정」또는 「추가」후 사진을 삭제할 수 있습니다.');
			return;
		}
		if (!confirm('이 사진을 삭제하시겠습니까?')) return;
		setPhotoUploading(true);
		try {
			const res = await fetch('/api/f33010/photos', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ blobName }),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '사진 삭제에 실패했습니다.');
			}
			const next = attachedPhotos.filter((p) => p.blobName !== blobName);
			setFormData((p) => ({ ...p, photo: serializePhotos(next) }));
		} catch (e) {
			alert(e instanceof Error ? e.message : '사진 삭제 중 오류가 발생했습니다.');
		} finally {
			setPhotoUploading(false);
		}
	};

	const handlePrint = async () => {
		const from = printFrom.slice(0, 10);
		const to = printTo.slice(0, 10);
		if (!from || !to) {
			alert('출력 기간(시작일·종료일)을 설정해주세요.');
			return;
		}
		if (from > to) {
			alert('기간 시작일이 종료일보다 늦을 수 없습니다.');
			return;
		}

		const targets =
			checkedMemberKeys.size > 0
				? memberList.filter((m) => checkedMemberKeys.has(memberKey(m)))
				: selectedMember
					? [selectedMember]
					: [];
		if (targets.length === 0) {
			alert('출력할 수급자를 목록에서 체크하거나 선택해주세요.');
			return;
		}

		setPrinting(true);
		try {
			const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
			const items: Array<{ member: MemberData; rows: BedsoreRecord[] }> = [];
			for (const member of targets) {
				const listRes = await fetch(
					`/api/f33010?pnum=${encodeURIComponent(String(member.PNUM).trim())}&${qs}`
				);
				const listJson = await listRes.json();
				const rows = Array.isArray(listJson?.data) ? (listJson.data as BedsoreRecord[]) : [];
				const resolved = await resolveConfirmerLabels(rows);
				items.push({ member, rows: resolved });
			}
			const withRows = items.filter((x) => x.rows.length > 0);
			if (withRows.length === 0) {
				alert('선택한 수급자·기간에 해당하는 기록이 없습니다.');
				return;
			}
			const origin = window.location.origin;
			const period = { periodFrom: from, periodTo: to, photoOrigin: origin };
			const html =
				withRows.length === 1
					? buildBedsoreDailyPrintHtml({ ...withRows[0], ...period })
					: buildBedsoreDailyBatchPrintHtml(withRows, period);
			openPrintWindow(html);
		} catch (e) {
			console.error(e);
			alert('출력 준비 중 오류가 발생했습니다.');
		} finally {
			setPrinting(false);
		}
	};

	const dateTotalPages = Math.ceil(observationDates.length / dateItemsPerPage);
	const dateStartIndex = (datePage - 1) * dateItemsPerPage;
	const currentDateItems = observationDates.slice(dateStartIndex, dateStartIndex + dateItemsPerPage);

	const fieldsLocked = !isEditMode && !isNewRecord;
	const showCancel = isEditMode && (originalForm !== null || isNewRecord);
	const rightFormLocked = selectedDateIndex === null && !isNewRecord;

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 p-4 bg-white border-r border-blue-200 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden">
					<div className="mb-3 space-y-2">
						<div className="p-2 space-y-2 border border-blue-200 rounded-lg bg-blue-50/60">
							<div className="text-xs font-semibold text-blue-900">기간</div>
							<div className="flex items-center gap-1">
								<input
									type="date"
									value={printFrom}
									onChange={(e) => setPrintFrom(e.target.value)}
									className="flex-1 min-w-0 px-1 py-1 text-xs bg-white border border-blue-300 rounded"
								/>
								<span className="text-xs text-blue-900 shrink-0">~</span>
								<input
									type="date"
									value={printTo}
									onChange={(e) => setPrintTo(e.target.value)}
									className="flex-1 min-w-0 px-1 py-1 text-xs bg-white border border-blue-300 rounded"
								/>
							</div>
							<button
								type="button"
								onClick={() => void handlePrint()}
								disabled={printing}
								className="w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-50"
							>
								{printing
									? '출력 준비 중...'
									: checkedMemberKeys.size > 0
										? `출력 (${checkedMemberKeys.size}명)`
										: '출력'}
							</button>
						</div>
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
									members={memberList}
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
										<th className="px-1 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200 w-8">
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
											<td colSpan={7} className="px-2 py-4 text-center text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : filteredMembers.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-2 py-4 text-center text-blue-900/60">
												수급자 데이터가 없습니다
											</td>
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
												<td className="px-2 py-1.5 text-center border-r border-blue-100">{formatCareGradeLabel(member.P_GRD)}</td>
												<td className="px-2 py-1.5 text-center">{calculateAge(String(member.P_BRDT || ''))}</td>
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
										type="button"
										onClick={() => handlePageChange(1)}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&lt;&lt;
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(currentPage - 1)}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&lt;
									</button>
									{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
										return (
											<button
												key={pageNum}
												type="button"
												onClick={() => handlePageChange(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${
													currentPage === pageNum ? 'bg-blue-500 text-white border-blue-500' : 'border-blue-300 hover:bg-blue-50'
												}`}
											>
												{pageNum}
											</button>
										);
									})}
									<button
										type="button"
										onClick={() => handlePageChange(currentPage + 1)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&gt;
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(totalPages)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
									>
										&gt;&gt;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
					<div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-blue-200 bg-blue-50">
						<label className="text-sm font-medium text-blue-900">관찰일자</label>
						<button
							type="button"
							onClick={handleAdd}
							disabled={!selectedMember}
							className="px-3 py-1 text-sm font-medium text-blue-900 border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
						>
							추가
						</button>
					</div>
					<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
						<div className="flex-1 overflow-y-auto bg-white">
							{!selectedMember ? (
								<div className="flex items-center justify-center h-full min-h-[160px] px-3 py-8 text-sm font-medium text-blue-900/70">
									수급자를 선택해주세요
								</div>
							) : loadingObservations ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
							) : observationDates.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">관찰일자가 없습니다</div>
							) : (
								currentDateItems.map((item, localIndex) => {
									const globalIndex = dateStartIndex + localIndex;
									return (
										<div
											key={`${item.VDT}-${item.DCUB_SEQ}-${globalIndex}`}
											className={`flex items-center border-b border-blue-50 ${
												selectedDateIndex === globalIndex ? 'bg-blue-100' : 'hover:bg-blue-50'
											}`}
										>
											<button
												type="button"
												onClick={() => handleSelectDate(globalIndex)}
												className={`flex-1 min-w-0 text-left px-3 py-2 text-sm ${
													selectedDateIndex === globalIndex ? 'font-semibold' : ''
												}`}
											>
												{formatObservationLabel(item, observationDates)}
											</button>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													void handleDeleteDate(item);
												}}
												className="shrink-0 px-2 py-1 mr-1 text-xs font-medium text-red-800 border border-red-300 rounded bg-red-50 hover:bg-red-100"
											>
												삭제
											</button>
										</div>
									);
								})
							)}
						</div>
						{dateTotalPages > 1 && (
							<div className="p-2 bg-white border-t border-blue-200">
								<div className="flex items-center justify-center gap-1">
									<button type="button" onClick={() => setDatePage(1)} disabled={datePage === 1} className="px-2 py-1 text-xs border rounded disabled:opacity-50">
										&lt;&lt;
									</button>
									<button
										type="button"
										onClick={() => setDatePage((p) => Math.max(1, p - 1))}
										disabled={datePage === 1}
										className="px-2 py-1 text-xs border rounded disabled:opacity-50"
									>
										&lt;
									</button>
									{Array.from({ length: Math.min(5, dateTotalPages) }, (_, i) => {
										const pageNum = Math.max(1, Math.min(dateTotalPages - 4, datePage - 2)) + i;
										if (pageNum > dateTotalPages) return null;
										return (
											<button
												key={pageNum}
												type="button"
												onClick={() => setDatePage(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${datePage === pageNum ? 'bg-blue-500 text-white' : ''}`}
											>
												{pageNum}
											</button>
										);
									})}
									<button
										type="button"
										onClick={() => setDatePage((p) => Math.min(dateTotalPages, p + 1))}
										disabled={datePage >= dateTotalPages}
										className="px-2 py-1 text-xs border rounded disabled:opacity-50"
									>
										&gt;
									</button>
									<button
										type="button"
										onClick={() => setDatePage(dateTotalPages)}
										disabled={datePage >= dateTotalPages}
										className="px-2 py-1 text-xs border rounded disabled:opacity-50"
									>
										&gt;&gt;
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="relative flex-1 p-4 overflow-y-auto bg-white">
					{rightFormLocked && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
							<p className="rounded-lg border border-blue-300 bg-white px-8 py-4 text-base font-semibold text-blue-900 shadow-sm">
								관찰일자를 선택해주세요
							</p>
						</div>
					)}
					<div
						className={rightFormLocked ? 'pointer-events-none select-none blur-[2px]' : undefined}
						aria-hidden={rightFormLocked}
					>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">관찰일자</label>
								<input
									type="date"
									value={formData.observationDate.slice(0, 10)}
									onChange={(e) => setFormData((p) => ({ ...p, observationDate: e.target.value }))}
									disabled={fieldsLocked}
									className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[150px] disabled:bg-gray-50"
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">확인시간</label>
								<input
									type="time"
									value={formData.checkTime}
									onChange={(e) => setFormData((p) => ({ ...p, checkTime: e.target.value }))}
									disabled={fieldsLocked}
									className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[130px] disabled:bg-gray-50"
								/>
							</div>
						</div>

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
							<div className="flex items-center gap-2 min-w-[240px] flex-1">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">확인자</label>
								<div className="relative flex-1 min-w-[180px] employee-dropdown-container">
									<input
										type="text"
										value={formData.confirmerSearch}
										onChange={(e) => {
											const value = e.target.value;
											setFormData((p) => ({
												...p,
												confirmerSearch: value,
												confirmerEmpno: '',
												confirmerName: '',
											}));
										}}
										onFocus={() => {
											if (formData.confirmerSearch.trim() && (isEditMode || isNewRecord)) {
												void searchEmployee(formData.confirmerSearch);
											}
										}}
										disabled={fieldsLocked}
										className="w-full px-3 py-1.5 text-sm border border-blue-300 rounded bg-white disabled:bg-gray-50"
										placeholder="이름 또는 직원번호 검색"
									/>
									{!fieldsLocked && showEmpDropdown && empSuggestions.length > 0 && (
										<div className="absolute z-20 w-full mt-1 overflow-y-auto bg-white border border-blue-300 rounded shadow-lg max-h-40">
											{empSuggestions.map((employee, index) => (
												<button
													type="button"
													key={`${employee.EMPNO}-${index}`}
													onClick={() => {
														setFormData((p) => ({
															...p,
															confirmerEmpno: employee.EMPNO,
															confirmerName: employee.EMPNM,
															confirmerSearch: confirmerDisplay(employee.EMPNO, employee.EMPNM),
														}));
														setShowEmpDropdown(false);
													}}
													className="block w-full px-3 py-2 text-sm text-left border-b border-blue-100 cursor-pointer hover:bg-blue-50 last:border-b-0"
												>
													{employee.EMPNM}
													{employee.EMPNO ? (
														<span className="ml-2 text-blue-900/60">({employee.EMPNO})</span>
													) : null}
												</button>
											))}
										</div>
									)}
								</div>
							</div>
						</div>

						{detailLoading && <div className="text-sm text-blue-900/60">상세 조회 중...</div>}

						<div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
							<div className="mb-2 text-sm font-medium text-blue-900">부위</div>
							<label className="mb-2 flex items-center gap-2 text-sm text-blue-900">
								<input
									type="checkbox"
									checked={formData.noneOccurrence}
									disabled={fieldsLocked}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											noneOccurrence: e.target.checked,
											areas: e.target.checked ? [] : p.areas,
											otherArea: e.target.checked ? '' : p.otherArea,
											size: e.target.checked ? '' : p.size,
											deep: e.target.checked ? '' : p.deep,
											color: e.target.checked ? '' : p.color,
										}))
									}
								/>
								발생 없음
							</label>
							<div className="flex flex-wrap gap-x-4 gap-y-2">
								{BEDSORE_AREA_OPTIONS.map((name) => (
									<label key={name} className="flex items-center gap-1.5 text-sm text-blue-900">
										<input
											type="checkbox"
											checked={formData.areas.includes(name)}
											disabled={fieldsLocked || formData.noneOccurrence}
											onChange={() => toggleArea(name)}
										/>
										{name}
									</label>
								))}
							</div>
							{formData.areas.includes('기타') && !formData.noneOccurrence && (
								<div className="flex items-center gap-2 mt-2">
									<label className="text-sm text-blue-900 whitespace-nowrap">기타 부위</label>
									<input
										type="text"
										value={formData.otherArea}
										onChange={(e) => setFormData((p) => ({ ...p, otherArea: e.target.value }))}
										disabled={fieldsLocked}
										maxLength={100}
										className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white disabled:bg-gray-50"
										placeholder="기타 부위를 입력하세요"
									/>
								</div>
							)}
						</div>

						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">크기</label>
								<input
									type="text"
									value={formData.size}
									onChange={(e) => setFormData((p) => ({ ...p, size: e.target.value }))}
									disabled={fieldsLocked || formData.noneOccurrence}
									maxLength={40}
									className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[120px] disabled:bg-gray-50"
									placeholder="예) 2×2"
								/>
								<span className="text-sm text-blue-900">cm</span>
							</div>
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">깊이</label>
								<input
									type="text"
									value={formData.deep}
									onChange={(e) => setFormData((p) => ({ ...p, deep: e.target.value }))}
									disabled={fieldsLocked || formData.noneOccurrence}
									maxLength={40}
									className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[120px] disabled:bg-gray-50"
									placeholder="예) 1"
								/>
								<span className="text-sm text-blue-900">cm</span>
							</div>
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded">색깔</label>
								<input
									type="text"
									value={formData.color}
									onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
									disabled={fieldsLocked || formData.noneOccurrence}
									maxLength={40}
									className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white min-w-[120px] disabled:bg-gray-50"
									placeholder="예) 붉고 노란빛"
								/>
							</div>
						</div>

						<div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<label className="text-sm font-medium text-blue-900">사진</label>
								<div className="flex items-center gap-2">
									<input
										ref={photoInputRef}
										type="file"
										accept="image/jpeg,image/png,image/webp,image/gif"
										multiple
										className="hidden"
										onChange={(e) => void handleUploadPhotos(e.target.files)}
									/>
									<button
										type="button"
										disabled={fieldsLocked || photoUploading || attachedPhotos.length >= MAX_BEDSORE_PHOTOS}
										onClick={() => photoInputRef.current?.click()}
										className="rounded border border-blue-400 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50"
									>
										{photoUploading ? '업로드 중...' : '사진 첨부'}
									</button>
								</div>
							</div>
							<p className="text-[11px] text-blue-900/70">jpeg/png/webp/gif · 장당 8MB 이하 · 최대 {MAX_BEDSORE_PHOTOS}장</p>
							{attachedPhotos.length === 0 ? (
								<div className="text-sm text-blue-900/55 py-2">첨부된 사진이 없습니다.</div>
							) : (
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
									{attachedPhotos.map((p) => (
										<div
											key={p.blobName}
											className="relative rounded border border-blue-200 bg-white overflow-hidden aspect-[4/3]"
										>
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img
												src={photoViewUrl(p.blobName)}
												alt={p.fileName || '첨부사진'}
												className="h-full w-full object-contain bg-white"
											/>
											{!fieldsLocked ? (
												<button
													type="button"
													disabled={photoUploading}
													onClick={() => void handleRemovePhoto(p.blobName)}
													className="absolute top-1 right-1 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
												>
													삭제
												</button>
											) : null}
											{p.fileName ? (
												<div className="absolute bottom-0 inset-x-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
													{p.fileName}
												</div>
											) : null}
										</div>
									))}
								</div>
							)}
						</div>

						<div className="flex items-start gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap bg-blue-100 px-3 py-1.5 border border-blue-300 rounded mt-0.5">처치 및 특이사항</label>
							<textarea
								value={formData.remarks}
								onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
								disabled={fieldsLocked}
								rows={4}
								className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded bg-white disabled:bg-gray-50"
								placeholder="처치 및 특이사항을 기록하세요"
							/>
						</div>
					</div>

					<div className="flex flex-wrap justify-end gap-2 mt-6">
						<button type="button" onClick={handleModify} disabled={rightFormLocked} className="px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50">
							수정
						</button>
						{/* <button type="button" onClick={() => void handlePrint()} disabled={printing} className="px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50">
							출력
						</button> */}
						<button
							type="button"
							onClick={handleSave}
							disabled={fieldsLocked}
							className="px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							저장
						</button>
						{showCancel && (
							<button type="button" onClick={handleCancelEdit} className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-200 border border-gray-400 rounded hover:bg-gray-300">
								취소
							</button>
						)}
					</div>
					</div>
				</div>
			</div>
		</div>
	);
}

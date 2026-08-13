"use client";

/**
 * @file 보호자회의 — 화면 컴포넌트 (GuardianMeeting.tsx)
 *
 * @description
 * 요양원 보호자회의(F60040) 화면. 목록·상세 입력, 사진 첨부, 출력.
 *
 * @module component/nursing-home/pages/guardian-meeting/GuardianMeeting
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface GuardianMeetingData {
	ANCD: string | number;
	MDT: string;
	STM?: string;
	ETM?: string;
	MPL?: string;
	MDOC?: string;
	MDES?: string;
	MNM?: string;
	MCNT?: string | number;
	MIMG?: string;
	MODT?: string;
	MODES?: string;
	ETC?: string;
	URDT?: string;
	INEMPNO?: string | number;
	INEMPNM?: string;
	[key: string]: any;
}

type UserInfo = {
	ancd?: string | number;
	uid?: string;
	empno?: string | number;
	empnm?: string;
	[key: string]: any;
};

type MeetingForm = {
	meetingDate: string;
	meetingStartTime: string;
	meetingEndTime: string;
	meetingLocation: string;
	meetingSubject: string;
	meetingContent: string;
	attendeeCount: string;
	attendeeList: string;
	meetingResult: string;
	remarks: string;
	photoMimg: string;
};

type MeetingPhoto = { blobName: string };

const MAX_PHOTOS = 3;
const MIMG_MAX_LEN = 100;

const emptyForm = (): MeetingForm => ({
	meetingDate: '',
	meetingStartTime: '',
	meetingEndTime: '',
	meetingLocation: '',
	meetingSubject: '',
	meetingContent: '',
	attendeeCount: '',
	attendeeList: '',
	meetingResult: '',
	remarks: '',
	photoMimg: '',
});

function formatDateYmd(dateStr: string | Date | null | undefined) {
	if (!dateStr) return '';
	if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) {
		const y = dateStr.getFullYear();
		const m = String(dateStr.getMonth() + 1).padStart(2, '0');
		const day = String(dateStr.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	const s = String(dateStr).trim();
	if (!s) return '';
	if (s.includes('T') && s.length >= 10) return s.split('T')[0];
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const d = new Date(s);
	if (!Number.isNaN(d.getTime())) {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	return s.length >= 10 ? s.slice(0, 10) : s;
}

function todayYmdLocal(base = new Date()) {
	return formatDateYmd(base);
}

function toHm(v: string | null | undefined) {
	if (v == null || v === '') return '';
	const s = String(v).trim();
	const m = s.match(/^(\d{1,2}):(\d{2})/);
	if (!m) return s.slice(0, 5);
	return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** 참석인원: 빈 값 허용, 1 이상 정수만. 거부 시 null */
function sanitizeAttendeeCountInput(raw: string): string | null {
	const s = String(raw ?? '').trim();
	if (s === '') return '';
	if (!/^\d+$/.test(s)) return null;
	const n = Number(s);
	if (!Number.isFinite(n) || n < 1) return null;
	return String(Math.trunc(n));
}

function parseMimgPhotos(mimg: string | null | undefined): MeetingPhoto[] {
	const s = String(mimg ?? '').trim();
	if (!s) return [];
	const fromToken = (raw: string): MeetingPhoto | null => {
		const t = String(raw || '').trim();
		if (!t) return null;
		const q = t.match(/blobName=([^&]+)/i);
		const blobName = q ? decodeURIComponent(q[1]) : t;
		return blobName ? { blobName } : null;
	};
	if (s.startsWith('[')) {
		try {
			const parsed = JSON.parse(s);
			if (Array.isArray(parsed)) {
				return parsed
					.map((p: unknown) => {
						if (typeof p === 'string') return fromToken(p);
						if (p && typeof p === 'object') {
							return fromToken(String((p as { blobName?: unknown }).blobName ?? ''));
						}
						return null;
					})
					.filter((p): p is MeetingPhoto => Boolean(p?.blobName))
					.slice(0, MAX_PHOTOS);
			}
		} catch {
			/* fall through */
		}
	}
	return s
		.split(',')
		.map(fromToken)
		.filter((p): p is MeetingPhoto => Boolean(p?.blobName))
		.slice(0, MAX_PHOTOS);
}

function serializeMimgPhotos(photos: MeetingPhoto[]): string {
	const names: string[] = [];
	for (const p of photos) {
		const blobName = String(p?.blobName || '').trim();
		if (!blobName) continue;
		const next = [...names, blobName].join(',');
		if (next.length > MIMG_MAX_LEN) break;
		names.push(blobName);
		if (names.length >= MAX_PHOTOS) break;
	}
	return names.join(',');
}

function photoViewUrl(blobName: string) {
	return `/api/f60040/photos?blobName=${encodeURIComponent(blobName)}`;
}

function escapeHtml(s: string) {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

async function fetchPhotoAsDataUrl(blobName: string): Promise<string | null> {
	try {
		const res = await fetch(photoViewUrl(blobName), { credentials: 'include', cache: 'no-store' });
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise<string | null>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

function mapRowToForm(meeting: GuardianMeetingData): MeetingForm {
	return {
		meetingDate: formatDateYmd(meeting.MDT || ''),
		meetingStartTime: toHm(meeting.STM),
		meetingEndTime: toHm(meeting.ETM),
		meetingLocation: meeting.MPL || '',
		meetingSubject: meeting.MDOC || '',
		meetingContent: meeting.MDES || '',
		attendeeCount: meeting.MCNT == null || meeting.MCNT === '' ? '' : String(meeting.MCNT),
		attendeeList: meeting.MNM || '',
		meetingResult: meeting.MODES || '',
		remarks: meeting.ETC || '',
		photoMimg: String(meeting.MIMG || '').trim(),
	};
}

export default function GuardianMeeting() {
	const [meetingList, setMeetingList] = useState<GuardianMeetingData[]>([]);
	const [selectedMeeting, setSelectedMeeting] = useState<GuardianMeetingData | null>(null);
	const [isEditMode, setIsEditMode] = useState(false);
	const [loading, setLoading] = useState(false);
	const [photoUploading, setPhotoUploading] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [hasProgramAccess, setHasProgramAccess] = useState<boolean>(true);
	const photoInputRef = useRef<HTMLInputElement | null>(null);

	const [startDate, setStartDate] = useState<string>('');
	const [endDate, setEndDate] = useState<string>('');
	const [formData, setFormData] = useState<MeetingForm>(emptyForm);

	const attachedPhotos = useMemo(() => parseMimgPhotos(formData.photoMimg), [formData.photoMimg]);

	const fetchUserAndPermission = async () => {
		try {
			const res = await fetch('/api/auth/user-info', { method: 'GET' });
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '사용자 정보 조회 실패');
			}

			const u = (result.data || {}) as UserInfo;
			setUserInfo(u);

			const ancd = u?.ancd;
			const uid = u?.uid;
			if (!ancd || !uid) {
				setHasProgramAccess(true);
				return;
			}

			const permRes = await fetch(
				`/api/f00131?ancd=${encodeURIComponent(String(ancd))}&uid=${encodeURIComponent(
					String(uid)
				)}&pgmid=${encodeURIComponent('F60040')}`,
				{ method: 'GET' }
			);
			const perm = await permRes.json().catch(() => ({}));
			if (!permRes.ok || !perm?.success) {
				setHasProgramAccess(true);
				return;
			}
			// F00131은 사용 가능 프로그램 매핑이라, 레코드가 없어도 기본 허용
			setHasProgramAccess(true);
		} catch (e) {
			console.error('사용자/권한 조회 오류:', e);
			setHasProgramAccess(true);
		}
	};

	const fetchMeetings = async (range?: { start?: string; end?: string }): Promise<GuardianMeetingData[]> => {
		setLoading(true);
		try {
			const ancd = userInfo?.ancd;
			if (!ancd) {
				setMeetingList([]);
				return [];
			}
			const start = range?.start ?? startDate;
			const end = range?.end ?? endDate;
			const url = `/api/f60040?ancd=${encodeURIComponent(String(ancd))}&startDate=${encodeURIComponent(
				start
			)}&endDate=${encodeURIComponent(end)}`;
			const response = await fetch(url, { method: 'GET' });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || '간담회 목록 조회 실패');
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const mapped: GuardianMeetingData[] = list.map((r: any) => ({
				...r,
				MDT: formatDateYmd(r?.MDT),
				MODT: formatDateYmd(r?.MODT),
				URDT: formatDateYmd(r?.URDT),
			}));
			setMeetingList(mapped);
			return mapped;
		} catch (err) {
			console.error('간담회 목록 조회 오류:', err);
			setMeetingList([]);
			return [];
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const today = new Date();
		const end = todayYmdLocal(today);
		const oneYearAgo = new Date(today);
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const start = todayYmdLocal(oneYearAgo);
		setStartDate(start);
		setEndDate(end);

		fetchUserAndPermission();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!userInfo?.ancd) return;
		if (!startDate || !endDate) return;
		fetchMeetings();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [startDate, endDate, userInfo?.ancd]);

	const totalPages = Math.ceil(meetingList.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentMeetings = meetingList.slice(startIndex, endIndex);

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const handleSelectMeeting = (meeting: GuardianMeetingData) => {
		if (isEditMode) return;
		setSelectedMeeting(meeting);
		setIsEditMode(false);
		setFormData(mapRowToForm(meeting));
	};

	const handleFormChange = (field: keyof MeetingForm, value: string) => {
		if (field === 'attendeeCount') {
			const next = sanitizeAttendeeCountInput(value);
			if (next === null) return;
			setFormData((prev) => ({ ...prev, attendeeCount: next }));
			return;
		}
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const deleteBlobQuietly = async (blobName: string) => {
		try {
			await fetch('/api/f60040/photos', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ blobName }),
			});
		} catch {
			/* ignore */
		}
	};

	const discardUnsavedPhotos = async (currentMimg: string, originalMimg?: string) => {
		const current = parseMimgPhotos(currentMimg);
		const original = new Set(parseMimgPhotos(originalMimg).map((p) => p.blobName));
		await Promise.all(current.filter((p) => !original.has(p.blobName)).map((p) => deleteBlobQuietly(p.blobName)));
	};

	const handleSearch = () => {
		setCurrentPage(1);
		fetchMeetings();
	};

	const handleAdd = () => {
		if (!hasProgramAccess) {
			alert('프로그램 사용 권한이 없습니다.');
			return;
		}
		setSelectedMeeting(null);
		setIsEditMode(true);
		setFormData({
			...emptyForm(),
			meetingDate: todayYmdLocal(),
		});
	};

	const handleModify = () => {
		if (!hasProgramAccess) {
			alert('프로그램 사용 권한이 없습니다.');
			return;
		}
		if (!selectedMeeting) {
			alert('수정할 간담회를 선택해주세요.');
			return;
		}
		setIsEditMode(true);
	};

	const handleCancelEdit = async () => {
		await discardUnsavedPhotos(formData.photoMimg, selectedMeeting?.MIMG);
		setIsEditMode(false);
		if (selectedMeeting) {
			setFormData(mapRowToForm(selectedMeeting));
		} else {
			setFormData(emptyForm());
		}
	};

	const handleUploadPhotos = async (files: FileList | null) => {
		if (!isEditMode) {
			alert('수정 또는 추가 후 사진을 첨부할 수 있습니다.');
			return;
		}
		if (!files || files.length === 0) return;
		const remain = MAX_PHOTOS - attachedPhotos.length;
		if (remain <= 0) {
			alert(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
			return;
		}
		const picked = Array.from(files).slice(0, remain);
		setPhotoUploading(true);
		try {
			const next = [...attachedPhotos];
			for (const file of picked) {
				const fd = new FormData();
				fd.append('file', file);
				const res = await fetch('/api/f60040/photos', {
					method: 'POST',
					body: fd,
					credentials: 'include',
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success || !json?.photo?.blobName) {
					throw new Error(json?.error || `${file.name} 업로드에 실패했습니다.`);
				}
				const blobName = String(json.photo.blobName);
				const candidate = [...next, { blobName }];
				const trial = serializeMimgPhotos(candidate);
				if (parseMimgPhotos(trial).length < candidate.length) {
					await deleteBlobQuietly(blobName);
					alert(`사진 경로가 저장 길이(${MIMG_MAX_LEN}자)를 초과해 더 이상 첨부할 수 없습니다.`);
					break;
				}
				next.push({ blobName });
			}
			setFormData((p) => ({ ...p, photoMimg: serializeMimgPhotos(next) }));
			if (files.length > remain) {
				alert(`사진은 최대 ${MAX_PHOTOS}장까지 첨부됩니다. 초과분은 제외되었습니다.`);
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : '사진 업로드 중 오류가 발생했습니다.');
		} finally {
			setPhotoUploading(false);
			if (photoInputRef.current) photoInputRef.current.value = '';
		}
	};

	const handleRemovePhoto = (blobName: string) => {
		if (!isEditMode) return;
		const next = attachedPhotos.filter((p) => p.blobName !== blobName);
		setFormData((p) => ({ ...p, photoMimg: serializeMimgPhotos(next) }));
	};

	const handleSave = async () => {
		if (!hasProgramAccess) {
			alert('프로그램 사용 권한이 없습니다.');
			return;
		}

		const newMdt = formatDateYmd(formData.meetingDate);
		if (!newMdt) {
			alert('간담회일자를 입력해주세요.');
			return;
		}

		const isNew = !selectedMeeting;
		if (isNew) {
			const duplicated = meetingList.some((m) => formatDateYmd(m.MDT) === newMdt);
			if (duplicated) {
				alert('해당 일자에 이미 간담회가 있습니다. 다른 날짜를 선택하거나 기존 자료를 수정해 주세요.');
				return;
			}
		}

		if (formData.attendeeCount !== '') {
			const cnt = Number(formData.attendeeCount);
			if (!Number.isInteger(cnt) || cnt < 1) {
				alert('참석인원은 1명 이상만 입력할 수 있습니다.');
				return;
			}
		}

		setLoading(true);
		try {
			const ancd = userInfo?.ancd;
			if (!ancd) throw new Error('기관정보(ANCD)를 확인할 수 없습니다.');

			const origMdt = selectedMeeting?.MDT ? formatDateYmd(selectedMeeting.MDT) : newMdt;
			const payload: Record<string, unknown> = {
				ANCD: ancd,
				MDT: newMdt,
				origMDT: origMdt,
				isNew,
				STM: toHm(formData.meetingStartTime) || null,
				ETM: toHm(formData.meetingEndTime) || null,
				MPL: formData.meetingLocation || null,
				MDOC: formData.meetingSubject || null,
				MDES: formData.meetingContent || null,
				MNM: formData.attendeeList || null,
				MCNT: formData.attendeeCount === '' ? null : Number(formData.attendeeCount),
				MIMG: formData.photoMimg || null,
				MODES: formData.meetingResult || null,
				ETC: formData.remarks || null,
				INEMPNO: userInfo?.empno != null ? String(userInfo.empno) : null,
				INEMPNM: userInfo?.empnm != null ? String(userInfo.empnm) : null,
			};

			const res = await fetch(`/api/f60040?ancd=${encodeURIComponent(String(ancd))}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '간담회 저장에 실패했습니다.');
			}

			const savedMimg = serializeMimgPhotos(attachedPhotos);
			const kept = new Set(parseMimgPhotos(savedMimg).map((p) => p.blobName));
			const previous = parseMimgPhotos(selectedMeeting?.MIMG);
			await Promise.all(previous.filter((p) => !kept.has(p.blobName)).map((p) => deleteBlobQuietly(p.blobName)));

			alert(isNew ? '간담회가 생성되었습니다.' : '간담회가 수정되었습니다.');
			setIsEditMode(false);

			let nextStart = startDate;
			let nextEnd = endDate;
			if (newMdt && (!nextStart || newMdt < nextStart)) nextStart = newMdt;
			if (newMdt && (!nextEnd || newMdt > nextEnd)) nextEnd = newMdt;
			if (nextStart !== startDate) setStartDate(nextStart);
			if (nextEnd !== endDate) setEndDate(nextEnd);

			const refreshed = await fetchMeetings({ start: nextStart, end: nextEnd });
			const saved = refreshed.find((m) => formatDateYmd(m.MDT) === newMdt);
			if (saved) {
				setSelectedMeeting(saved);
				setFormData(mapRowToForm(saved));
			}
		} catch (err) {
			console.error('간담회 저장 오류:', err);
			alert(err instanceof Error ? err.message : '간담회 저장 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!hasProgramAccess) {
			alert('프로그램 사용 권한이 없습니다.');
			return;
		}
		if (!selectedMeeting) {
			alert('삭제할 간담회를 선택해주세요.');
			return;
		}

		if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			return;
		}

		setLoading(true);
		try {
			const ancd = userInfo?.ancd;
			if (!ancd) throw new Error('기관정보(ANCD)를 확인할 수 없습니다.');
			const mdt = formatDateYmd(selectedMeeting.MDT);
			if (!mdt) throw new Error('간담회일자(MDT)를 확인할 수 없습니다.');

			const res = await fetch(
				`/api/f60040?ancd=${encodeURIComponent(String(ancd))}&mdt=${encodeURIComponent(String(mdt))}`,
				{ method: 'DELETE' }
			);
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '간담회 삭제에 실패했습니다.');
			}

			await Promise.all(parseMimgPhotos(selectedMeeting.MIMG).map((p) => deleteBlobQuietly(p.blobName)));

			alert('간담회가 삭제되었습니다.');
			setSelectedMeeting(null);
			setFormData(emptyForm());
			await fetchMeetings();
		} catch (err) {
			console.error('간담회 삭제 오류:', err);
			alert(err instanceof Error ? err.message : '간담회 삭제 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const handleRegisterResult = async () => {
		if (!hasProgramAccess) {
			alert('프로그램 사용 권한이 없습니다.');
			return;
		}
		if (!selectedMeeting) {
			alert('결과를 등록할 간담회를 선택해주세요.');
			return;
		}

		if (!formData.meetingResult) {
			alert('간담회결과를 입력해주세요.');
			return;
		}

		setLoading(true);
		try {
			const ancd = userInfo?.ancd;
			if (!ancd) throw new Error('기관정보(ANCD)를 확인할 수 없습니다.');
			const mdt = formatDateYmd(selectedMeeting.MDT);
			if (!mdt) throw new Error('간담회일자(MDT)를 확인할 수 없습니다.');

			const payload = {
				ANCD: ancd,
				MDT: mdt,
				origMDT: mdt,
				MODES: formData.meetingResult || null,
				INEMPNO: userInfo?.empno != null ? String(userInfo.empno) : null,
				INEMPNM: userInfo?.empnm != null ? String(userInfo.empnm) : null,
			};

			const res = await fetch(`/api/f60040?ancd=${encodeURIComponent(String(ancd))}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || '간담회결과 등록에 실패했습니다.');
			}

			alert('간담회결과가 등록되었습니다.');
			const refreshed = await fetchMeetings();
			const saved = refreshed.find((m) => formatDateYmd(m.MDT) === mdt);
			if (saved) {
				setSelectedMeeting(saved);
				setFormData(mapRowToForm(saved));
			}
		} catch (err) {
			console.error('간담회결과 등록 오류:', err);
			alert(err instanceof Error ? err.message : '간담회결과 등록 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const handlePrint = async () => {
		if (!selectedMeeting && !formData.meetingDate) {
			alert('출력할 간담회를 선택해주세요.');
			return;
		}

		const printWindow = window.open('', '_blank');
		if (!printWindow) {
			alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
			return;
		}

		const printPhotos: { src: string }[] = [];
		for (const p of attachedPhotos) {
			const dataUrl = await fetchPhotoAsDataUrl(p.blobName);
			if (dataUrl) printPhotos.push({ src: dataUrl });
		}

		const photoHtml =
			printPhotos.length > 0
				? printPhotos
						.map(
							(p) =>
								`<div class="photo-item"><img src="${escapeHtml(p.src)}" alt="간담회 사진" /></div>`
						)
						.join('')
				: '';

		const printHTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>보호자간담회</title>
	<style>
		@page { size: A4; margin: 20mm; }
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
			font-size: 11pt;
			line-height: 1.5;
			color: #000;
			background: #fff;
		}
		.print-container { width: 100%; max-width: 210mm; margin: 0 auto; }
		.header { text-align: center; margin-bottom: 20px; }
		.header h1 { font-size: 18pt; font-weight: bold; }
		.info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #000; }
		.info-table td { border: 1px solid #000; padding: 8px 10px; font-size: 10pt; }
		.info-table td.label { background-color: #f0f0f0; font-weight: bold; width: 120px; text-align: center; }
		.content-section { margin-top: 20px; margin-bottom: 20px; }
		.section-title {
			font-size: 12pt; font-weight: bold; margin-bottom: 10px; padding: 5px;
			background-color: #f0f0f0; border: 1px solid #000;
		}
		.section-content {
			border: 1px solid #000; padding: 15px; min-height: 120px;
			font-size: 10pt; line-height: 1.8; white-space: pre-wrap;
		}
		.photo-grid { display: flex; flex-wrap: wrap; gap: 10px; }
		.photo-item { width: 48%; border: 1px solid #000; padding: 6px; }
		.photo-item img { width: 100%; max-height: 90mm; object-fit: contain; display: block; }
		@media print {
			body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		}
	</style>
</head>
<body>
	<div class="print-container">
		<div class="header">
			<h1>보호자간담회</h1>
		</div>
		<table class="info-table">
			<tr>
				<td class="label">간담회일자</td>
				<td>${escapeHtml(formData.meetingDate || '-')}</td>
				<td class="label">간담회시간</td>
				<td>${escapeHtml(formData.meetingStartTime || '-')} ~ ${escapeHtml(formData.meetingEndTime || '-')}</td>
			</tr>
			<tr>
				<td class="label">간담회장소</td>
				<td colspan="3">${escapeHtml(formData.meetingLocation || '-')}</td>
			</tr>
			<tr>
				<td class="label">간담회주제</td>
				<td colspan="3">${escapeHtml(formData.meetingSubject || '-')}</td>
			</tr>
			<tr>
				<td class="label">참석인원</td>
				<td colspan="3">${escapeHtml(formData.attendeeCount || '-')}명</td>
			</tr>
		</table>
		<div class="content-section">
			<div class="section-title">간담회내용</div>
			<div class="section-content">${escapeHtml(formData.meetingContent || '')}</div>
		</div>
		<div class="content-section">
			<div class="section-title">참석자명단</div>
			<div class="section-content">${escapeHtml(formData.attendeeList || '')}</div>
		</div>
		<div class="content-section">
			<div class="section-title">간담회결과</div>
			<div class="section-content">${escapeHtml(formData.meetingResult || '')}</div>
		</div>
		${
			photoHtml
				? `<div class="content-section"><div class="section-title">사진</div><div class="section-content"><div class="photo-grid">${photoHtml}</div></div></div>`
				: ''
		}
		${
			formData.remarks
				? `<div class="content-section"><div class="section-title">비고</div><div class="section-content">${escapeHtml(formData.remarks)}</div></div>`
				: ''
		}
	</div>
	<script>
		window.onload = function() { window.print(); };
	</script>
</body>
</html>
		`;

		printWindow.document.write(printHTML);
		printWindow.document.close();
	};

	const handleClose = () => {
		window.history.back();
	};

	const formatDate = (dateStr: string) => {
		if (!dateStr) return '-';
		const ymd = formatDateYmd(dateStr);
		return ymd || '-';
	};

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="p-4 border-b border-blue-200 bg-blue-50">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h1 className="text-2xl font-bold text-blue-900">보호자간담회</h1>
					<div className="flex flex-wrap items-center justify-end gap-4">
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap">기간</label>
							<input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
							/>
							<span className="text-blue-900">~</span>
							<input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
							/>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{/* <button
								onClick={handleSearch}
								className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
							>
								검색
							</button> */}
							{!isEditMode ? (
								<>
									<button
										onClick={handleAdd}
										className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
									>
										추가
									</button>
									<button
										onClick={handleModify}
										disabled={!hasProgramAccess || !selectedMeeting || loading}
										className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
									>
										수정
									</button>
									<button
										onClick={handleDelete}
										disabled={!hasProgramAccess || !selectedMeeting || loading}
										className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
									>
										삭제
									</button>
									<button
										onClick={handleRegisterResult}
										disabled={!hasProgramAccess || !selectedMeeting || loading}
										className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
									>
										결과등록
									</button>
									<button
										onClick={() => void handlePrint()}
										disabled={loading}
										className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50"
									>
										출력
									</button>
								</>
							) : (
								<>
									<button
										onClick={() => void handleCancelEdit()}
										className="px-4 py-1.5 text-sm border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium"
									>
										취소
									</button>
									<button
										onClick={() => void handleSave()}
										disabled={!hasProgramAccess || loading || photoUploading}
										className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50"
									>
										{loading ? '저장 중...' : '저장'}
									</button>
								</>
							)}
							{/* <button
								onClick={handleClose}
								className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
							>
								닫기
							</button> */}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-1 min-h-0 h-[calc(100vh-140px)]">
				<div className="flex flex-col w-full lg:w-1/3 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b lg:border-b-0 lg:h-full lg:min-h-0 lg:overflow-hidden">
					<div className="p-2 border-b border-blue-200 bg-blue-50">
						<div className="grid grid-cols-2 gap-2 text-xs font-semibold text-blue-900">
							<div className="text-center">일자</div>
							<div className="text-center">주제</div>
						</div>
					</div>
					<div className="flex-1 overflow-y-auto">
						{loading ? (
							<div className="p-4 text-center text-blue-900/60">로딩 중...</div>
						) : meetingList.length === 0 ? (
							<div className="p-4 text-center text-blue-900/60">
								<div>간담회 데이터가 없습니다</div>
								<button
									type="button"
									onClick={handleAdd}
									className="mt-3 px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
								>
									추가
								</button>
							</div>
						) : (
							currentMeetings.map((meeting) => (
								<div
									key={meeting.MDT || meeting.MDOC}
									onClick={() => handleSelectMeeting(meeting)}
									className={`p-2 border-b border-blue-50 ${
										isEditMode ? 'cursor-not-allowed opacity-60' : 'hover:bg-blue-50 cursor-pointer'
									} ${
										selectedMeeting?.MDT === meeting.MDT ? 'bg-blue-100' : ''
									}`}
								>
									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="text-blue-900">{formatDate(meeting.MDT || '')}</div>
										<div className="text-blue-900 truncate">{meeting.MDOC || '-'}</div>
									</div>
								</div>
							))
						)}
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

				<div className="flex-1 p-4 overflow-y-auto bg-white">
					{isEditMode && !selectedMeeting ? (
						<div className="mb-3 px-3 py-2 text-sm text-blue-900 bg-blue-50 border border-blue-200 rounded">
							새 간담회를 작성 중입니다. 보호자 간담회는 하루에 1건만 등록할 수 있습니다.
						</div>
					) : null}
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-4">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">간담회일자</label>
								{isEditMode ? (
									<input
										type="date"
										value={formData.meetingDate}
										onChange={(e) => handleFormChange('meetingDate', e.target.value)}
										className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
									/>
								) : (
									<span className="px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 min-w-[150px]">
										{formData.meetingDate || '-'}
									</span>
								)}
							</div>
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">간담회시간</label>
								{isEditMode ? (
									<>
										<input
											type="time"
											value={formData.meetingStartTime}
											onChange={(e) => handleFormChange('meetingStartTime', e.target.value)}
											className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
										/>
										<span className="text-blue-900">~</span>
										<input
											type="time"
											value={formData.meetingEndTime}
											onChange={(e) => handleFormChange('meetingEndTime', e.target.value)}
											className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
										/>
									</>
								) : (
									<span className="px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50">
										{formData.meetingStartTime || '-'} ~ {formData.meetingEndTime || '-'}
									</span>
								)}
							</div>
						</div>

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap">간담회장소</label>
							{isEditMode ? (
								<input
									type="text"
									value={formData.meetingLocation}
									onChange={(e) => handleFormChange('meetingLocation', e.target.value)}
									maxLength={100}
									className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
									placeholder="간담회장소를 입력하세요"
								/>
							) : (
								<span className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50">
									{formData.meetingLocation || '-'}
								</span>
							)}
						</div>

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap">간담회주제</label>
							{isEditMode ? (
								<input
									type="text"
									value={formData.meetingSubject}
									onChange={(e) => handleFormChange('meetingSubject', e.target.value)}
									className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
									placeholder="간담회주제를 입력하세요"
								/>
							) : (
								<span className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50">
									{formData.meetingSubject || '-'}
								</span>
							)}
						</div>

						<div>
							<label className="block mb-2 text-sm font-medium text-blue-900">간담회내용</label>
							{isEditMode ? (
								<textarea
									value={formData.meetingContent}
									onChange={(e) => handleFormChange('meetingContent', e.target.value)}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500"
									rows={5}
									placeholder="간담회내용을 입력하세요"
								/>
							) : (
								<div className="w-full px-3 py-2 text-sm border border-blue-200 rounded bg-gray-50 min-h-[120px] whitespace-pre-wrap">
									{formData.meetingContent || '-'}
								</div>
							)}
						</div>

						<div className="flex items-start gap-4">
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-blue-900 whitespace-nowrap">참석인원</label>
								{isEditMode ? (
									<input
										type="number"
										min={1}
										step={1}
										inputMode="numeric"
										value={formData.attendeeCount}
										onChange={(e) => handleFormChange('attendeeCount', e.target.value)}
										onKeyDown={(e) => {
											if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') {
												e.preventDefault();
											}
										}}
										className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500 w-24"
										placeholder="인원"
									/>
								) : (
									<span className="px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50 w-24">
										{formData.attendeeCount || '-'}
									</span>
								)}
							</div>
							<div className="flex-1">
								<label className="block mb-2 text-sm font-medium text-blue-900">참석자명단</label>
								{isEditMode ? (
									<textarea
										value={formData.attendeeList}
										onChange={(e) => handleFormChange('attendeeList', e.target.value)}
										maxLength={500}
										className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500"
										rows={5}
										placeholder="참석자명단을 입력하세요"
									/>
								) : (
									<div className="w-full px-3 py-2 text-sm border border-blue-200 rounded bg-gray-50 min-h-[120px] whitespace-pre-wrap">
										{formData.attendeeList || '-'}
									</div>
								)}
							</div>
						</div>

						<div>
							<label className="block mb-2 text-sm font-medium text-blue-900">간담회결과</label>
							{isEditMode || selectedMeeting ? (
								<textarea
									value={formData.meetingResult}
									onChange={(e) => handleFormChange('meetingResult', e.target.value)}
									readOnly={!isEditMode && !selectedMeeting}
									className={`w-full px-3 py-2 text-sm border rounded focus:outline-none ${
										isEditMode
											? 'bg-white border-blue-300 focus:border-blue-500'
											: 'bg-white border-blue-200 focus:border-blue-400'
									}`}
									rows={5}
									placeholder="간담회결과를 입력하세요"
								/>
							) : (
								<div className="w-full px-3 py-2 text-sm border border-blue-200 rounded bg-gray-50 min-h-[120px] whitespace-pre-wrap">
									{formData.meetingResult || '-'}
								</div>
							)}
						</div>

						<div>
							<div className="flex items-center justify-between mb-2">
								<label className="text-sm font-medium text-blue-900">사진 (최대 {MAX_PHOTOS}장)</label>
								{isEditMode ? (
									<>
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
											disabled={photoUploading || attachedPhotos.length >= MAX_PHOTOS}
											onClick={() => photoInputRef.current?.click()}
											className="px-3 py-1 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50"
										>
											{photoUploading ? '업로드 중...' : '사진등록'}
										</button>
									</>
								) : null}
							</div>
							{attachedPhotos.length === 0 ? (
								<div className="px-3 py-6 text-sm text-center text-blue-900/50 border border-blue-200 rounded bg-gray-50">
									등록된 사진이 없습니다
								</div>
							) : (
								<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
									{attachedPhotos.map((p) => (
										<div key={p.blobName} className="relative border border-blue-200 rounded overflow-hidden bg-gray-50">
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img
												src={photoViewUrl(p.blobName)}
												alt="간담회 사진"
												className="w-full h-40 object-contain bg-white"
											/>
											{isEditMode ? (
												<button
													type="button"
													onClick={() => handleRemovePhoto(p.blobName)}
													className="absolute top-1 right-1 px-2 py-0.5 text-xs text-white bg-red-600 rounded hover:bg-red-700"
												>
													삭제
												</button>
											) : null}
										</div>
									))}
								</div>
							)}
						</div>

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-blue-900 whitespace-nowrap">비고</label>
							{isEditMode ? (
								<input
									type="text"
									value={formData.remarks}
									onChange={(e) => handleFormChange('remarks', e.target.value)}
									maxLength={100}
									className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:border-blue-500"
									placeholder="비고"
								/>
							) : (
								<span className="flex-1 px-3 py-1.5 text-sm border border-blue-200 rounded bg-gray-50">
									{formData.remarks || '-'}
								</span>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

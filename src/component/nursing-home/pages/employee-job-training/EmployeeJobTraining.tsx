"use client";

/**
 * @file 직원직무교육 — 화면 컴포넌트 (EmployeeJobTraining.tsx)
 *
 * @description
 * 요양원 직원직무교육 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/employee-job-training
 *
 * @module component/nursing-home/pages/employee-job-training/EmployeeJobTraining
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildJobTrainingPrintHtml } from "./employeeJobTrainingPrint";

interface JobTrainingRow {
	ANCD?: string | number;
	MDT: string;
	STM?: string;
	ETM?: string;
	MPL?: string;
	MDOC?: string;
	MDES?: string;
	MNM?: string;
	MIMG?: string;
	MODES?: string;
	ETC?: string;
	URDT?: string;
	INEMPNO?: string | number;
	INEMPNM?: string;
	TRAINER_NM?: string;
	[key: string]: unknown;
}

type UserInfo = {
	ancd?: string | number;
	uid?: string;
	empno?: string | number;
	empnm?: string;
	[key: string]: unknown;
};

const ITEMS_PER_PAGE = 10;
const MAX_PHOTOS = 3;

type TrainingPhoto = { blobName: string };

function parseMimgPhotos(mimg: string | null | undefined): TrainingPhoto[] {
	const s = String(mimg ?? "").trim();
	if (!s) return [];
	const fromToken = (raw: string): TrainingPhoto | null => {
		let t = String(raw || "").trim().replace(/^["']+|["']+$/g, "").trim();
		if (!t) return null;
		const q = t.match(/blobName=([^&]+)/i);
		if (q) {
			try {
				t = decodeURIComponent(q[1]);
			} catch {
				t = q[1];
			}
		}
		const blobName = t.replace(/^["']+|["']+$/g, "").trim();
		return blobName ? { blobName } : null;
	};
	if (s.startsWith("[")) {
		try {
			const parsed = JSON.parse(s);
			if (Array.isArray(parsed)) {
				return parsed
					.map((p: unknown) => {
						if (typeof p === "string") return fromToken(p);
						if (p && typeof p === "object") {
							return fromToken(String((p as { blobName?: unknown }).blobName ?? ""));
						}
						return null;
					})
					.filter((p): p is TrainingPhoto => Boolean(p?.blobName))
					.slice(0, MAX_PHOTOS);
			}
		} catch {
			/* fall through */
		}
	}
	return s
		.split(",")
		.map(fromToken)
		.filter((p): p is TrainingPhoto => Boolean(p?.blobName))
		.slice(0, MAX_PHOTOS);
}

function serializeMimgPhotos(photos: TrainingPhoto[]): string {
	if (!photos.length) return "";
	return JSON.stringify(photos.slice(0, MAX_PHOTOS).map((p) => p.blobName));
}

function photoViewUrl(blobName: string) {
	return `/api/f60060/photos?blobName=${encodeURIComponent(blobName)}`;
}

async function fetchPhotoAsDataUrl(blobName: string): Promise<string | null> {
	try {
		const res = await fetch(photoViewUrl(blobName), { credentials: "include", cache: "no-store" });
		if (!res.ok) return null;
		const blob = await res.blob();
		const type = String(blob.type || "").toLowerCase();
		if (type.includes("json") || blob.size < 24) return null;
		return await new Promise<string | null>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

function TrainingPhotoThumb({
	blobName,
	canRemove,
	onRemove,
	imgClassName,
}: {
	blobName: string;
	canRemove?: boolean;
	onRemove?: () => void;
	imgClassName: string;
}) {
	const [src, setSrc] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let objectUrl: string | null = null;
		let cancelled = false;
		setSrc(null);
		setFailed(false);
		(async () => {
			try {
				const res = await fetch(photoViewUrl(blobName), { credentials: "include", cache: "no-store" });
				if (!res.ok) throw new Error("load failed");
				const blob = await res.blob();
				const type = String(blob.type || "").toLowerCase();
				if (type.includes("json") || blob.size < 24) throw new Error("not an image");
				objectUrl = URL.createObjectURL(blob);
				if (!cancelled) setSrc(objectUrl);
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [blobName]);

	return (
		<div className="relative overflow-hidden rounded border border-blue-200 bg-white">
			{src ? (
				<img src={src} alt="" className={imgClassName} />
			) : (
				<div className={`${imgClassName} flex items-center justify-center text-sm text-blue-900/50`}>
					{failed ? "사진을 불러올 수 없습니다" : "불러오는 중..."}
				</div>
			)}
			{canRemove ? (
				<button
					type="button"
					onClick={onRemove}
					className="absolute top-1 right-1 rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
				>
					삭제
				</button>
			) : null}
		</div>
	);
}

function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function toText(value: unknown): string {
	if (value == null) return "";
	return String(value).trim();
}

function formatDateYmd(value: unknown): string {
	if (value == null || value === "") return "";
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return formatDate(value);
	}
	const s = String(value).trim();
	if (!s) return "";
	if (s.includes("T")) {
		const parsed = new Date(s);
		if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
		return s.split("T")[0].slice(0, 10);
	}
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const d = new Date(s);
	if (!Number.isNaN(d.getTime())) return formatDate(d);
	return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeTime(t: string): string {
	if (!t) return "";
	const s = String(t).trim();
	if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
	return s;
}

const emptyForm = {
	trainingDate: "",
	startTime: "",
	endTime: "",
	instructor: "",
	place: "",
	title: "",
	content: "",
	attendees: "",
	evaluation: "",
	photoMimg: "",
};

const emptyModalForm = { ...emptyForm };

const modalLabelCls =
	"w-28 shrink-0 bg-blue-100 border border-blue-300 px-2 py-1.5 text-sm font-medium text-blue-900 text-center";
const modalFieldCls =
	"flex-1 min-w-0 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";
const modalTimeCls =
	"w-28 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";
const readOnlyCls =
	"flex-1 rounded border border-blue-200 bg-gray-50 px-3 py-2 text-sm text-blue-900 min-h-[38px]";
const readOnlyTextareaCls =
	"flex-1 rounded border border-blue-200 bg-gray-50 px-3 py-2 text-sm text-blue-900 whitespace-pre-wrap resize-none min-h-[120px]";
const inputCls =
	"flex-1 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";

export default function EmployeeJobTraining() {
	const [periodStart, setPeriodStart] = useState(() => {
		const d = new Date();
		d.setFullYear(d.getFullYear() - 1);
		return formatDate(d);
	});
	const [periodEnd, setPeriodEnd] = useState(() => formatDate(new Date()));

	const [trainingList, setTrainingList] = useState<JobTrainingRow[]>([]);
	const [selectedTraining, setSelectedTraining] = useState<JobTrainingRow | null>(null);
	const [isEditMode, setIsEditMode] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [modalForm, setModalForm] = useState(emptyModalForm);
	const [modalSaveLoading, setModalSaveLoading] = useState(false);
	const [photoUploading, setPhotoUploading] = useState(false);
	const modalPhotoInputRef = useRef<HTMLInputElement | null>(null);
	const detailPhotoInputRef = useRef<HTMLInputElement | null>(null);

	const attachedPhotos = useMemo(() => parseMimgPhotos(form.photoMimg), [form.photoMimg]);
	const modalPhotos = useMemo(() => parseMimgPhotos(modalForm.photoMimg), [modalForm.photoMimg]);

	const fetchUserInfo = async () => {
		try {
			const res = await fetch("/api/auth/user-info", { method: "GET" });
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || "사용자 정보 조회 실패");
			}
			setUserInfo((result.data || {}) as UserInfo);
		} catch (e) {
			console.error("사용자 정보 조회 오류:", e);
		}
	};

	const fetchTrainings = async (): Promise<JobTrainingRow[]> => {
		setLoading(true);
		try {
			const ancd = userInfo?.ancd;
			if (!ancd) {
				setTrainingList([]);
				return [];
			}
			const url = `/api/f60060?ancd=${encodeURIComponent(String(ancd))}&startDate=${encodeURIComponent(
				periodStart
			)}&endDate=${encodeURIComponent(periodEnd)}`;
			const response = await fetch(url, { method: "GET" });
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result?.success) {
				throw new Error(result?.error || "직무교육 목록 조회 실패");
			}
			const list = Array.isArray(result.data) ? result.data : [];
			const mapped = list.map((r: JobTrainingRow) => ({
				...r,
				MDT: formatDateYmd(r?.MDT ?? (r as Record<string, unknown>)?.mdt),
				URDT: formatDateYmd(r?.URDT),
				STM: normalizeTime(toText(r?.STM)),
				ETM: normalizeTime(toText(r?.ETM)),
				MPL: toText(r?.MPL),
				MDOC: toText(r?.MDOC),
				MDES: toText(r?.MDES),
				MNM: toText(r?.MNM),
				MODES: toText(r?.MODES),
				MIMG: toText(r?.MIMG),
				TRAINER_NM: toText(r?.TRAINER_NM),
			}));
			setTrainingList(mapped);
			return mapped;
		} catch (err) {
			console.error("직무교육 목록 조회 오류:", err);
			setTrainingList([]);
			return [];
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchUserInfo();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!userInfo?.ancd) return;
		if (!periodStart || !periodEnd) return;
		fetchTrainings();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [periodStart, periodEnd, userInfo?.ancd]);

	const totalPages = Math.max(1, Math.ceil(trainingList.length / ITEMS_PER_PAGE));
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const pagedList = trainingList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

	const selectedKey = selectedTraining ? formatDateYmd(selectedTraining.MDT) : "";
	const hasSelectedTraining = Boolean(selectedKey);

	const mapRowToForm = (row: JobTrainingRow) => ({
		trainingDate: formatDateYmd(row.MDT),
		startTime: normalizeTime(toText(row.STM)),
		endTime: normalizeTime(toText(row.ETM)),
		instructor: toText(row.TRAINER_NM),
		place: toText(row.MPL),
		title: toText(row.MDOC),
		content: toText(row.MDES),
		attendees: toText(row.MNM),
		evaluation: toText(row.MODES),
		photoMimg: toText(row.MIMG),
	});

	const handleSelectTraining = (row: JobTrainingRow) => {
		const normalized = { ...row, MDT: formatDateYmd(row.MDT) };
		setSelectedTraining(normalized);
		setIsEditMode(false);
		setForm(mapRowToForm(normalized));
	};

	const handleModify = () => {
		if (!selectedTraining?.MDT) {
			alert("수정할 직무교육을 선택해주세요.");
			return;
		}
		setIsEditMode(true);
	};

	const deleteBlobQuietly = async (blobName: string) => {
		try {
			await fetch("/api/f60060/photos", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
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

	const handleCancelEdit = async () => {
		await discardUnsavedPhotos(form.photoMimg, selectedTraining?.MIMG);
		setIsEditMode(false);
		if (selectedTraining) {
			setForm(mapRowToForm(selectedTraining));
		} else {
			setForm(emptyForm);
		}
	};

	const handleSearch = () => {
		setCurrentPage(1);
		fetchTrainings();
	};

	const handleClose = () => {
		if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
	};

	const openCreateModal = () => {
		setModalForm({
			...emptyModalForm,
			trainingDate: formatDate(new Date()),
		});
		setCreateModalOpen(true);
	};

	const closeCreateModal = async () => {
		if (modalSaveLoading) return;
		await discardUnsavedPhotos(modalForm.photoMimg);
		setCreateModalOpen(false);
		setModalForm(emptyModalForm);
	};

	const persistTraining = async (
		data: typeof emptyForm,
		options: { oldMdt?: string; isNew: boolean }
	) => {
		const ancd = userInfo?.ancd;
		if (!ancd) throw new Error("기관정보(ANCD)를 확인할 수 없습니다.");

		const newMdt = formatDateYmd(data.trainingDate);
		if (!newMdt) throw new Error("교육일자(MDT)를 확인할 수 없습니다.");

		const oldMdt = options.oldMdt ? formatDateYmd(options.oldMdt) : "";
		if (!options.isNew && oldMdt && oldMdt !== newMdt) {
			const delRes = await fetch(
				`/api/f60060?ancd=${encodeURIComponent(String(ancd))}&mdt=${encodeURIComponent(oldMdt)}`,
				{ method: "DELETE" }
			);
			const delResult = await delRes.json().catch(() => ({}));
			if (!delRes.ok || !delResult?.success) {
				throw new Error(delResult?.error || "기존 직무교육 삭제에 실패했습니다.");
			}
		}

		const payload: Record<string, unknown> = {
			ANCD: ancd,
			MDT: newMdt,
			STM: data.startTime || null,
			ETM: data.endTime || null,
			MPL: data.place || null,
			MDOC: data.title || null,
			MDES: data.content || null,
			MNM: data.attendees || null,
			MIMG: data.photoMimg || null,
			MODES: data.evaluation || null,
			TRAINER_NM: data.instructor || null,
			INEMPNO: userInfo?.empno != null ? String(userInfo.empno) : null,
			INEMPNM: userInfo?.empnm != null ? String(userInfo.empnm) : null,
		};

		const res = await fetch(`/api/f60060?ancd=${encodeURIComponent(String(ancd))}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const result = await res.json().catch(() => ({}));
		if (!res.ok || !result?.success) {
			throw new Error(result?.error || "직무교육 저장에 실패했습니다.");
		}
		return newMdt;
	};

	const handleModalSave = async () => {
		if (!modalForm.trainingDate) {
			alert("교육일자를 입력해주세요.");
			return;
		}

		setModalSaveLoading(true);
		try {
			const newMdt = await persistTraining(modalForm, { isNew: true });
			alert("직무교육이 등록되었습니다.");
			setCreateModalOpen(false);
			setModalForm(emptyModalForm);
			const refreshed = await fetchTrainings();
			const saved = refreshed.find((m) => formatDateYmd(m.MDT) === newMdt);
			if (saved) {
				setSelectedTraining(saved);
				setIsEditMode(false);
				setForm(mapRowToForm(saved));
			}
		} catch (err) {
			console.error("직무교육 등록 오류:", err);
			alert(err instanceof Error ? err.message : "직무교육 등록 중 오류가 발생했습니다.");
		} finally {
			setModalSaveLoading(false);
		}
	};

	const handleUploadPhotos = async (files: FileList | null, source: "modal" | "detail") => {
		if (source === "detail" && !isEditMode) {
			alert("수정 버튼을 누른 뒤 사진을 첨부할 수 있습니다.");
			return;
		}
		if (!files || files.length === 0) return;
		const current = source === "modal" ? modalPhotos : attachedPhotos;
		const remain = MAX_PHOTOS - current.length;
		if (remain <= 0) {
			alert(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
			return;
		}
		const picked = Array.from(files).slice(0, remain);
		setPhotoUploading(true);
		try {
			const next = [...current];
			for (const file of picked) {
				const fd = new FormData();
				fd.append("file", file);
				const res = await fetch("/api/f60060/photos", {
					method: "POST",
					body: fd,
					credentials: "include",
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success || !json?.photo?.blobName) {
					throw new Error(json?.error || `${file.name} 업로드에 실패했습니다.`);
				}
				next.push({ blobName: String(json.photo.blobName) });
			}
			const serialized = serializeMimgPhotos(next);
			if (source === "modal") {
				setModalForm((p) => ({ ...p, photoMimg: serialized }));
			} else {
				setForm((p) => ({ ...p, photoMimg: serialized }));
			}
			if (files.length > remain) {
				alert(`사진은 최대 ${MAX_PHOTOS}장까지 첨부됩니다. 초과분은 제외되었습니다.`);
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : "사진 업로드 중 오류가 발생했습니다.");
		} finally {
			setPhotoUploading(false);
			if (source === "modal" && modalPhotoInputRef.current) modalPhotoInputRef.current.value = "";
			if (source === "detail" && detailPhotoInputRef.current) detailPhotoInputRef.current.value = "";
		}
	};

	const handleRemovePhoto = (blobName: string, source: "modal" | "detail") => {
		if (source === "detail" && !isEditMode) return;
		const current = source === "modal" ? modalPhotos : attachedPhotos;
		const next = serializeMimgPhotos(current.filter((p) => p.blobName !== blobName));
		if (source === "modal") {
			setModalForm((p) => ({ ...p, photoMimg: next }));
			void deleteBlobQuietly(blobName);
			return;
		}
		setForm((p) => ({ ...p, photoMimg: next }));
		const original = new Set(parseMimgPhotos(selectedTraining?.MIMG).map((p) => p.blobName));
		if (!original.has(blobName)) {
			void deleteBlobQuietly(blobName);
		}
	};

	const handleSave = async () => {
		if (!isEditMode) {
			alert("수정 버튼을 눌러 편집 모드로 전환한 후 저장해주세요.");
			return;
		}
		if (!selectedTraining?.MDT) {
			alert("저장할 직무교육을 선택해주세요.");
			return;
		}
		if (!form.trainingDate) {
			alert("교육일자를 입력해주세요.");
			return;
		}

		setLoading(true);
		try {
			const newMdt = await persistTraining(form, {
				oldMdt: selectedTraining.MDT,
				isNew: false,
			});

			const savedMimg = serializeMimgPhotos(attachedPhotos);
			const kept = new Set(parseMimgPhotos(savedMimg).map((p) => p.blobName));
			const previous = parseMimgPhotos(selectedTraining?.MIMG);
			await Promise.all(previous.filter((p) => !kept.has(p.blobName)).map((p) => deleteBlobQuietly(p.blobName)));

			alert("직무교육이 수정되었습니다.");
			setIsEditMode(false);
			const refreshed = await fetchTrainings();
			const saved = refreshed.find((m) => formatDateYmd(m.MDT) === newMdt);
			if (saved) {
				setSelectedTraining(saved);
				setForm(mapRowToForm(saved));
			} else {
				setSelectedTraining({ MDT: newMdt, MIMG: savedMimg });
				setForm({ ...form, trainingDate: newMdt });
			}
		} catch (err) {
			console.error("직무교육 저장 오류:", err);
			alert(err instanceof Error ? err.message : "직무교육 저장 중 오류가 발생했습니다.");
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedTraining?.MDT) {
			alert("삭제할 직무교육을 선택해주세요.");
			return;
		}
		if (!confirm("선택한 직무교육을 삭제하시겠습니까?")) return;
		if (!confirm("정말 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")) return;

		setLoading(true);
		try {
			const ancd = userInfo?.ancd;
			if (!ancd) throw new Error("기관정보(ANCD)를 확인할 수 없습니다.");
			const mdt = formatDateYmd(selectedTraining.MDT);
			if (!mdt) throw new Error("교육일자(MDT)를 확인할 수 없습니다.");

			const res = await fetch(
				`/api/f60060?ancd=${encodeURIComponent(String(ancd))}&mdt=${encodeURIComponent(mdt)}`,
				{ method: "DELETE" }
			);
			const result = await res.json().catch(() => ({}));
			if (!res.ok || !result?.success) {
				throw new Error(result?.error || "직무교육 삭제에 실패했습니다.");
			}

			await Promise.all(parseMimgPhotos(selectedTraining.MIMG).map((p) => deleteBlobQuietly(p.blobName)));

			alert("직무교육이 삭제되었습니다.");
			setSelectedTraining(null);
			setIsEditMode(false);
			setForm(emptyForm);
			await fetchTrainings();
		} catch (err) {
			console.error("직무교육 삭제 오류:", err);
			alert(err instanceof Error ? err.message : "직무교육 삭제 중 오류가 발생했습니다.");
		} finally {
			setLoading(false);
		}
	};

	const handlePrint = async () => {
		if (!form.trainingDate && !selectedTraining?.MDT) {
			alert("출력할 직무교육을 선택해주세요.");
			return;
		}

		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			alert("팝업이 차단되었습니다. 팝업 차단을 해제해 주세요.");
			return;
		}
		printWindow.document.write(
			"<!DOCTYPE html><html lang='ko'><head><meta charset='UTF-8' /><title>직원 직무교육</title></head><body>출력 준비 중...</body></html>"
		);

		const photoSrcs: string[] = [];
		for (const p of attachedPhotos) {
			const dataUrl = await fetchPhotoAsDataUrl(p.blobName);
			if (dataUrl) photoSrcs.push(dataUrl);
		}

		const mdt = formatDateYmd(form.trainingDate || selectedTraining?.MDT || "");
		const html = buildJobTrainingPrintHtml({
			trainingDate: mdt,
			startTime: form.startTime,
			endTime: form.endTime,
			instructor: form.instructor,
			place: form.place,
			title: form.title,
			content: form.content,
			attendees: form.attendees,
			evaluation: form.evaluation,
			photoSrcs,
		});
		printWindow.document.open();
		printWindow.document.write(html);
		printWindow.document.close();
		setTimeout(() => {
			printWindow.focus();
			printWindow.print();
		}, 250);
	};

	const pageNumbers = useMemo(() => {
		const maxButtons = 5;
		let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
		const end = Math.min(totalPages, start + maxButtons - 1);
		start = Math.max(1, end - maxButtons + 1);
		const pages: number[] = [];
		for (let i = start; i <= end; i++) pages.push(i);
		return pages;
	}, [currentPage, totalPages]);

	const leftPager = (
		<div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-blue-200 bg-white">
			<div className="flex gap-2">
				<button
					type="button"
					disabled={currentPage <= 1}
					onClick={() => setCurrentPage(1)}
					className="h-10 w-10 rounded border border-blue-300 bg-white text-blue-900 hover:bg-blue-50 disabled:opacity-40"
					aria-label="처음"
				>
					«
				</button>
				<button
					type="button"
					disabled={currentPage <= 1}
					onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
					className="h-10 w-10 rounded border border-blue-300 bg-white text-blue-900 hover:bg-blue-50 disabled:opacity-40"
					aria-label="이전"
				>
					‹
				</button>
			</div>
			<div className="flex gap-1">
				{pageNumbers.map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => setCurrentPage(p)}
						className={`h-10 min-w-10 px-2 rounded border text-sm ${
							p === currentPage
								? "border-blue-500 bg-blue-200 text-blue-900 font-semibold"
								: "border-blue-300 bg-white text-blue-900 hover:bg-blue-50"
						}`}
					>
						{p}
					</button>
				))}
			</div>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={currentPage >= totalPages}
					onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
					className="h-10 w-10 rounded border border-blue-300 bg-white text-blue-900 hover:bg-blue-50 disabled:opacity-40"
					aria-label="다음"
				>
					›
				</button>
				<button
					type="button"
					disabled={currentPage >= totalPages}
					onClick={() => setCurrentPage(totalPages)}
					className="h-10 w-10 rounded border border-blue-300 bg-white text-blue-900 hover:bg-blue-50 disabled:opacity-40"
					aria-label="마지막"
				>
					»
				</button>
			</div>
		</div>
	);

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="flex flex-wrap items-center gap-4 border-b border-blue-200 bg-blue-50/50 p-4">
				<h1 className="rounded border border-blue-300 bg-blue-100 px-4 py-2 text-base font-semibold text-blue-900">
					직원 직무교육
				</h1>

				<div className="flex items-center gap-2">
					<span className="rounded border border-blue-300 bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900">
						기간
					</span>
					<input
						type="date"
						value={periodStart}
						onChange={(e) => setPeriodStart(e.target.value)}
						className="rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
					/>
					<span className="text-sm text-blue-900">~</span>
					<input
						type="date"
						value={periodEnd}
						onChange={(e) => setPeriodEnd(e.target.value)}
						className="rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div className="ml-auto flex gap-2">

					<button
						type="button"
						onClick={openCreateModal}
						className="rounded border border-blue-400 bg-blue-200 px-6 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300"
					>
						신규생성
					</button>

				</div>
			</div>

			<div className="flex flex-col lg:flex-row gap-4 p-4 min-h-[calc(100vh-76px)] min-w-0">
				<aside className="w-full max-w-full lg:w-[420px] min-w-0 shrink-0 flex flex-col overflow-hidden rounded-lg border border-blue-300 bg-white lg:h-full lg:min-h-0">
					<div className="flex-1 overflow-auto min-h-0">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-100">
								<tr>
									<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
										교육일자
									</th>
									<th className="px-3 py-2 text-left font-semibold text-blue-900">교육제목</th>
								</tr>
							</thead>
							<tbody>
								{loading && pagedList.length === 0 ? (
									<tr>
										<td colSpan={2} className="px-3 py-10 text-center text-blue-900/60">
											조회 중...
										</td>
									</tr>
								) : pagedList.length === 0 ? (
									<tr>
										<td colSpan={2} className="px-3 py-10 text-center text-blue-900/60">
											데이터가 없습니다.
										</td>
									</tr>
								) : (
									pagedList.map((m) => {
										const rowMdt = formatDateYmd(m.MDT);
										const isSelected = rowMdt === selectedKey && selectedKey !== "";
										return (
											<tr
												key={rowMdt || `row-${m.MDOC}`}
												onClick={() => handleSelectTraining(m)}
												className={`cursor-pointer border-b border-blue-50 hover:bg-blue-50/60 ${
													isSelected ? "bg-blue-100" : ""
												}`}
											>
												<td className="border-r border-blue-100 px-3 py-2">{rowMdt || "-"}</td>
												<td className="px-3 py-2">{m.MDOC || "-"}</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
					{trainingList.length > 0 && leftPager}
				</aside>

				<section className="flex-1 min-w-0 flex flex-col rounded-lg border border-blue-300 bg-white overflow-hidden">
					<div className="flex-1 overflow-auto p-4">
						{!selectedTraining ? (
							<p className="py-16 text-center text-sm text-blue-900/60">
								왼쪽 목록에서 직무교육을 선택하세요.
							</p>
						) : (
							<div className="grid grid-cols-12 gap-3">
								<div className="col-span-12 md:col-span-6 flex items-center gap-2">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육일자
									</label>
									{isEditMode ? (
										<input
											type="date"
											value={form.trainingDate}
											onChange={(e) =>
												setForm((p) => ({ ...p, trainingDate: e.target.value }))
											}
											className={inputCls}
										/>
									) : (
										<span className={readOnlyCls}>{form.trainingDate || "-"}</span>
									)}
								</div>

								<div className="col-span-12 md:col-span-6 flex items-center gap-2 flex-wrap">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육시간
									</label>
									{isEditMode ? (
										<>
											<input
												type="time"
												value={form.startTime}
												onChange={(e) =>
													setForm((p) => ({ ...p, startTime: e.target.value }))
												}
												className="w-36 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
											/>
											<span className="text-sm text-blue-900">~</span>
											<input
												type="time"
												value={form.endTime}
												onChange={(e) =>
													setForm((p) => ({ ...p, endTime: e.target.value }))
												}
												className="w-36 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
											/>
											<label className="w-20 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900 text-center">
												강사명
											</label>
											<input
												type="text"
												value={form.instructor}
												onChange={(e) =>
													setForm((p) => ({ ...p, instructor: e.target.value }))
												}
												className="w-40 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
											/>
										</>
									) : (
										<>
											<span className={readOnlyCls}>
												{form.startTime || "-"} ~ {form.endTime || "-"}
											</span>
											<label className="w-20 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900 text-center">
												강사명
											</label>
											<span className={`${readOnlyCls} max-w-[200px]`}>
												{form.instructor || "-"}
											</span>
										</>
									)}
								</div>

								<div className="col-span-12 flex items-center gap-2">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육장소
									</label>
									{isEditMode ? (
										<input
											type="text"
											value={form.place}
											onChange={(e) => setForm((p) => ({ ...p, place: e.target.value }))}
											className={inputCls}
										/>
									) : (
										<span className={readOnlyCls}>{form.place || "-"}</span>
									)}
								</div>

								<div className="col-span-12 flex items-center gap-2">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육제목
									</label>
									{isEditMode ? (
										<input
											type="text"
											value={form.title}
											onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
											className={inputCls}
										/>
									) : (
										<span className={readOnlyCls}>{form.title || "-"}</span>
									)}
								</div>

								<div className="col-span-12 flex items-start gap-2">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육내용
									</label>
									{isEditMode ? (
										<textarea
											value={form.content}
											onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
											rows={10}
											className={`${inputCls} resize-y min-h-[200px]`}
										/>
									) : (
										<div className={`${readOnlyTextareaCls} min-h-[200px]`}>
											{form.content || "-"}
										</div>
									)}
								</div>

								<div className="col-span-12 flex items-start gap-2">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육참석자
									</label>
									{isEditMode ? (
										<textarea
											value={form.attendees}
											onChange={(e) =>
												setForm((p) => ({ ...p, attendees: e.target.value }))
											}
											rows={3}
											className={`${inputCls} resize-y`}
										/>
									) : (
										<div className={readOnlyTextareaCls}>{form.attendees || "-"}</div>
									)}
								</div>

								<div className="col-span-12 flex items-start gap-2">
									<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
										교육평가
									</label>
									{isEditMode ? (
										<textarea
											value={form.evaluation}
											onChange={(e) =>
												setForm((p) => ({ ...p, evaluation: e.target.value }))
											}
											rows={6}
											className={`${inputCls} resize-y min-h-[120px]`}
										/>
									) : (
										<div className={`${readOnlyTextareaCls} min-h-[120px]`}>
											{form.evaluation || "-"}
										</div>
									)}
								</div>

								<div className="col-span-12">
									<div className="flex items-center justify-between gap-2 mb-2">
										<label className="w-24 shrink-0 rounded border border-blue-300 bg-blue-100 px-2 py-2 text-sm font-medium text-blue-900">
											사진
										</label>
										{isEditMode ? (
											<>
												<input
													ref={detailPhotoInputRef}
													type="file"
													accept="image/jpeg,image/png,image/webp,image/gif"
													multiple
													className="hidden"
													onChange={(e) => void handleUploadPhotos(e.target.files, "detail")}
												/>
												<button
													type="button"
													disabled={photoUploading || attachedPhotos.length >= MAX_PHOTOS}
													onClick={() => detailPhotoInputRef.current?.click()}
													className="rounded border border-blue-400 bg-blue-200 px-3 py-1 text-xs font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
												>
													{photoUploading ? "업로드 중..." : `사진등록 (최대 ${MAX_PHOTOS}장)`}
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
												<TrainingPhotoThumb
													key={p.blobName}
													blobName={p.blobName}
													canRemove={isEditMode}
													onRemove={() => handleRemovePhoto(p.blobName, "detail")}
													imgClassName="w-full h-40 object-contain bg-white"
												/>
											))}
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					<div className="border-t border-blue-200 bg-blue-50/50 p-3">
						<div className="flex flex-wrap items-center justify-center gap-3">
							{!isEditMode ? (
								<>
									<button
										type="button"
										onClick={handleModify}
										disabled={!hasSelectedTraining}
										className="min-w-28 rounded border border-blue-400 bg-blue-200 px-8 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										수정
									</button>
									<button
										type="button"
										onClick={() => void handleDelete()}
										disabled={!hasSelectedTraining}
										className="min-w-28 rounded border border-blue-400 bg-blue-200 px-8 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										삭제
									</button>
									<button
										type="button"
										onClick={handlePrint}
										disabled={!hasSelectedTraining}
										className="min-w-28 rounded border border-blue-400 bg-blue-200 px-8 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										출력
									</button>
								</>
							) : (
								<>
									<button
										type="button"
										onClick={handleCancelEdit}
										disabled={loading}
										className="min-w-28 rounded border border-gray-400 bg-gray-100 px-8 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
									>
										취소
									</button>
									<button
										type="button"
										onClick={() => void handleSave()}
										disabled={loading}
										className="min-w-28 rounded border border-blue-500 bg-blue-500 px-8 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
									>
										저장
									</button>
								</>
							)}
						</div>
					</div>
				</section>
			</div>

			{createModalOpen ? (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
					role="presentation"
					onClick={closeCreateModal}
				>
					<div
						className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border-2 border-blue-300 bg-white shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="job-training-create-title"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
							<h2
								id="job-training-create-title"
								className="text-center text-lg font-semibold text-blue-900"
							>
								직원 직무교육
							</h2>
						</div>

						<div className="overflow-y-auto space-y-2 p-4">
							<div className="flex items-center gap-2">
								<label className={modalLabelCls}>교육일자</label>
								<input
									type="date"
									value={modalForm.trainingDate}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, trainingDate: e.target.value }))
									}
									className="w-44 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className={modalLabelCls}>교육시간</label>
								<input
									type="time"
									value={modalForm.startTime}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, startTime: e.target.value }))
									}
									className={modalTimeCls}
								/>
								<span className="text-sm text-blue-900">~</span>
								<input
									type="time"
									value={modalForm.endTime}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, endTime: e.target.value }))
									}
									className={modalTimeCls}
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className={modalLabelCls}>강사명</label>
								<input
									type="text"
									value={modalForm.instructor}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, instructor: e.target.value }))
									}
									className={modalFieldCls}
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className={modalLabelCls}>교육장소</label>
								<input
									type="text"
									value={modalForm.place}
									onChange={(e) => setModalForm((f) => ({ ...f, place: e.target.value }))}
									className={modalFieldCls}
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className={modalLabelCls}>교육제목</label>
								<input
									type="text"
									value={modalForm.title}
									onChange={(e) => setModalForm((f) => ({ ...f, title: e.target.value }))}
									className={modalFieldCls}
								/>
							</div>

							<div className="flex items-start gap-2">
								<label
									className={`${modalLabelCls} self-stretch flex items-center justify-center`}
								>
									교육내용
								</label>
								<textarea
									value={modalForm.content}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, content: e.target.value }))
									}
									rows={10}
									className={`${modalFieldCls} resize-y min-h-[200px]`}
								/>
							</div>

							<div className="flex items-start gap-2">
								<label
									className={`${modalLabelCls} self-stretch flex items-center justify-center`}
								>
									교육참석자
								</label>
								<textarea
									value={modalForm.attendees}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, attendees: e.target.value }))
									}
									rows={3}
									className={`${modalFieldCls} resize-y min-h-[72px]`}
								/>
							</div>

							<div className="flex items-start gap-2">
								<label
									className={`${modalLabelCls} self-stretch flex items-center justify-center`}
								>
									교육평가
								</label>
								<textarea
									value={modalForm.evaluation}
									onChange={(e) =>
										setModalForm((f) => ({ ...f, evaluation: e.target.value }))
									}
									rows={6}
									className={`${modalFieldCls} resize-y min-h-[120px]`}
								/>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<label className={modalLabelCls}>사진</label>
										<button
											type="button"
											disabled={
												modalSaveLoading ||
												photoUploading ||
												modalPhotos.length >= MAX_PHOTOS
											}
											onClick={() => modalPhotoInputRef.current?.click()}
											className="px-3 py-1 text-xs font-semibold border border-blue-300 rounded bg-white text-blue-900 hover:bg-blue-50 disabled:opacity-50"
										>
											{photoUploading ? "업로드 중…" : "사진등록"}
										</button>
									</div>
									<span className="text-xs text-blue-900/70">최대 {MAX_PHOTOS}장</span>
								</div>
								<input
									ref={modalPhotoInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/gif"
									multiple
									className="hidden"
									onChange={(e) => void handleUploadPhotos(e.target.files, "modal")}
								/>
								{modalPhotos.length === 0 ? (
									<div className="px-3 py-5 text-sm text-center text-blue-900/50 border border-blue-200 rounded bg-gray-50">
										등록된 사진이 없습니다. 사진등록을 눌러 첨부하세요.
									</div>
								) : (
									<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
										{modalPhotos.map((p) => (
											<TrainingPhotoThumb
												key={p.blobName}
												blobName={p.blobName}
												canRemove
												onRemove={() => handleRemovePhoto(p.blobName, "modal")}
												imgClassName="w-full h-32 object-contain bg-white"
											/>
										))}
									</div>
								)}
							</div>
						</div>

						<div className="flex border-t border-blue-200">
							<button
								type="button"
								disabled={modalSaveLoading}
								onClick={() => void handleModalSave()}
								className="flex-1 border-r border-blue-200 bg-blue-100 py-3 text-sm font-semibold text-blue-900 hover:bg-blue-200 disabled:opacity-50"
							>
								{modalSaveLoading ? "저장 중…" : "저장"}
							</button>
							<button
								type="button"
								disabled={modalSaveLoading}
								onClick={closeCreateModal}
								className="w-28 bg-white py-3 text-sm font-medium text-blue-900 hover:bg-blue-50 disabled:opacity-50"
							>
								닫기
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

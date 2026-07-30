"use client";

import React, { useState } from "react";
import BeneficiaryListPanel, { BeneficiaryMember } from "../../components/BeneficiaryListPanel";

type ExamForm = {
	AUDDT: string;
	XAU: string;
	CHOL: string;
	TG: string;
	HDL: string;
	HBAIC: string;
	SGOT: string;
	SGPT: string;
	CRA: string;
	VDRL: string;
	HB: string;
	AUDDES: string;
};

function todayYmd() {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(auddt?: string): ExamForm {
	return {
		AUDDT: auddt || todayYmd(),
		XAU: "2",
		CHOL: "",
		TG: "",
		HDL: "",
		HBAIC: "",
		SGOT: "",
		SGPT: "",
		CRA: "",
		VDRL: "",
		HB: "",
		AUDDES: "",
	};
}

function valToStr(v: unknown): string {
	if (v == null || v === "") return "";
	return String(v);
}

const LAB_FIELDS: { key: keyof ExamForm; label: string; hint?: string; step?: string }[] = [
	{ key: "CHOL", label: "Chol", hint: "총콜레스테롤" },
	{ key: "TG", label: "TG", hint: "중성지방" },
	{ key: "HDL", label: "HDL", hint: "고밀도지질단백" },
	{ key: "HBAIC", label: "HbA1C", hint: "당화혈색소", step: "0.1" },
	{ key: "SGOT", label: "SGOT", hint: "AST" },
	{ key: "SGPT", label: "SGPT", hint: "ALT" },
	{ key: "CRA", label: "Creatinine", hint: "크레아티닌", step: "0.1" },
	{ key: "VDRL", label: "VDRL", hint: "매독검사", step: "0.01" },
	{ key: "HB", label: "HB", hint: "혈색소" },
];

export default function HealthExamination() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [examDates, setExamDates] = useState<string[]>([]);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [datePage, setDatePage] = useState(1);
	const dateItemsPerPage = 10;
	const [formData, setFormData] = useState<ExamForm>(() => emptyForm());
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [isExisting, setIsExisting] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<ExamForm | null>(null);

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const fetchExamDates = async (pnum: string) => {
		setLoading(true);
		exitEditMode();
		try {
			const res = await fetch(`/api/f30130?mode=dates&pnum=${encodeURIComponent(pnum)}`, {
				cache: "no-store",
			});
			const json = await res.json();
			const list = Array.isArray(json?.data)
				? json.data.map((r: { AUDDT?: string }) => String(r.AUDDT || "").trim()).filter(Boolean)
				: [];
			setExamDates(list);
			setDatePage(1);
			if (list.length > 0) {
				setSelectedDateIndex(0);
				await loadDetail(pnum, list[0]);
			} else {
				setSelectedDateIndex(null);
				setIsExisting(false);
				setFormData(emptyForm());
			}
		} catch (e) {
			console.error("검사일자 조회 오류:", e);
			setExamDates([]);
			setSelectedDateIndex(null);
			setIsExisting(false);
			setFormData(emptyForm());
		} finally {
			setLoading(false);
		}
	};

	const loadDetail = async (pnum: string, auddt: string) => {
		setLoading(true);
		try {
			const res = await fetch(
				`/api/f30130?pnum=${encodeURIComponent(pnum)}&auddt=${encodeURIComponent(auddt)}`,
				{ cache: "no-store" }
			);
			const json = await res.json();
			const row = json?.data;
			if (json?.success && row) {
				setFormData({
					AUDDT: row.AUDDT || auddt,
					XAU: row.XAU === "1" || row.XAU === "2" ? row.XAU : "2",
					CHOL: valToStr(row.CHOL),
					TG: valToStr(row.TG),
					HDL: valToStr(row.HDL),
					HBAIC: valToStr(row.HBAIC),
					SGOT: valToStr(row.SGOT),
					SGPT: valToStr(row.SGPT),
					CRA: valToStr(row.CRA),
					VDRL: valToStr(row.VDRL),
					HB: valToStr(row.HB),
					AUDDES: valToStr(row.AUDDES),
				});
				setIsExisting(true);
			} else {
				setFormData(emptyForm(auddt));
				setIsExisting(false);
			}
		} catch (e) {
			console.error("상세 조회 오류:", e);
			setFormData(emptyForm(auddt));
			setIsExisting(false);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		setSelectedMember(member);
		fetchExamDates(String(member.PNUM));
	};

	const handleSelectDate = async (index: number) => {
		if (!selectedMember) return;
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		setSelectedDateIndex(index);
		const d = examDates[index];
		if (d) await loadDetail(String(selectedMember.PNUM), d);
	};

	const handleFieldChange = (key: keyof ExamForm, value: string) => {
		if (!isEditMode) return;
		setFormData((prev) => ({ ...prev, [key]: value }));
	};

	const handleNew = () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		const next = emptyForm();
		setSelectedDateIndex(null);
		setIsExisting(false);
		setFormData(next);
		setEditingBackup(JSON.parse(JSON.stringify(next)) as ExamForm);
		setIsEditMode(true);
	};

	const handleEditClick = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!isEditMode) {
			setEditingBackup(JSON.parse(JSON.stringify(formData)) as ExamForm);
			setIsEditMode(true);
			return;
		}

		if (!formData.AUDDT) {
			alert("검사일자를 입력해주세요.");
			return;
		}
		setSaving(true);
		try {
			const res = await fetch("/api/f30130", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					AUDDT: formData.AUDDT,
					XAU: formData.XAU || null,
					CHOL: formData.CHOL,
					TG: formData.TG,
					HDL: formData.HDL,
					HBAIC: formData.HBAIC,
					SGOT: formData.SGOT,
					SGPT: formData.SGPT,
					CRA: formData.CRA,
					VDRL: formData.VDRL,
					HB: formData.HB,
					AUDDES: formData.AUDDES,
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("저장되었습니다");
			exitEditMode();
			const datesRes = await fetch(
				`/api/f30130?mode=dates&pnum=${encodeURIComponent(String(selectedMember.PNUM))}`,
				{ cache: "no-store" }
			);
			const datesJson = await datesRes.json();
			const list = Array.isArray(datesJson?.data)
				? datesJson.data.map((r: { AUDDT?: string }) => String(r.AUDDT || "").trim()).filter(Boolean)
				: [];
			setExamDates(list);
			const idx = list.findIndex((d: string) => d === formData.AUDDT);
			setSelectedDateIndex(idx >= 0 ? idx : null);
			setIsExisting(true);
			await loadDetail(String(selectedMember.PNUM), formData.AUDDT);
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleCancelEdit = () => {
		if (editingBackup) {
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as ExamForm);
		}
		exitEditMode();
	};

	const handleDelete = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!formData.AUDDT || !isExisting) {
			alert("삭제할 기록이 없습니다.");
			return;
		}
		if (!confirm("선택한 검사일자의 건강검진 기록을 삭제할까요?")) return;

		setSaving(true);
		try {
			const res = await fetch(
				`/api/f30130?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&auddt=${encodeURIComponent(formData.AUDDT)}`,
				{ method: "DELETE" }
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			exitEditMode();
			await fetchExamDates(String(selectedMember.PNUM));
		} catch (e) {
			console.error(e);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const fieldsDisabled = !selectedMember || !isEditMode;

	const dateTotalPages = Math.max(1, Math.ceil(examDates.length / dateItemsPerPage));
	const dateStartIndex = (datePage - 1) * dateItemsPerPage;
	const currentDateItems = examDates.slice(dateStartIndex, dateStartIndex + dateItemsPerPage);
	const rightLocked = !selectedMember;

	return (
		<div className="flex flex-col min-h-screen text-black bg-white">
			<div className="flex h-[calc(100vh-56px)]">
				<BeneficiaryListPanel
					selectedMember={selectedMember}
					onSelect={handleSelectMember}
					className="w-1/4"
				/>

				{/* 검사일자 목록 */}
				<div className="flex flex-col w-[200px] bg-white border-r border-blue-200">
					<div className="flex items-center justify-between px-3 py-2 border-b border-blue-200 bg-blue-50">
						<label className="text-sm font-medium text-blue-900">검사일자</label>
						<button
							type="button"
							onClick={handleNew}
							disabled={!selectedMember || saving}
							className="px-2 py-0.5 text-xs border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
						>
							신규
						</button>
					</div>
					<div className="flex flex-col flex-1 overflow-hidden">
						<div className="flex-1 overflow-y-auto">
							{loading && examDates.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
							) : examDates.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">
									{selectedMember ? "검사일자가 없습니다" : "수급자를 선택해주세요"}
								</div>
							) : (
								currentDateItems.map((date, localIndex) => {
									const globalIndex = dateStartIndex + localIndex;
									return (
										<button
											type="button"
											key={`${date}-${globalIndex}`}
											onClick={() => handleSelectDate(globalIndex)}
											className={`w-full px-3 py-2 text-sm text-left border-b border-blue-50 hover:bg-blue-50 ${
												selectedDateIndex === globalIndex ? "bg-blue-100 font-semibold" : ""
											}`}
										>
											{date}
										</button>
									);
								})
							)}
						</div>
						{dateTotalPages > 1 && (
							<div className="flex items-center justify-center gap-1 p-2 border-t border-blue-200">
								<button
									type="button"
									onClick={() => setDatePage(1)}
									disabled={datePage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{"<<"}
								</button>
								<button
									type="button"
									onClick={() => setDatePage((p) => Math.max(1, p - 1))}
									disabled={datePage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{"<"}
								</button>
								<span className="px-1 text-xs text-blue-900">
									{datePage}/{dateTotalPages}
								</span>
								<button
									type="button"
									onClick={() => setDatePage((p) => Math.min(dateTotalPages, p + 1))}
									disabled={datePage === dateTotalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{">"}
								</button>
								<button
									type="button"
									onClick={() => setDatePage(dateTotalPages)}
									disabled={datePage === dateTotalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{">>"}
								</button>
							</div>
						)}
					</div>
				</div>

				{/* 우측 입력 폼 */}
				<div className="relative flex flex-col flex-1 overflow-hidden bg-slate-50">
					{rightLocked && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
							<p className="text-sm font-medium text-blue-900/70">수급자를 선택해주세요</p>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-white border-b border-blue-200">
						<h2 className="mr-2 text-base font-semibold text-blue-900">건강검진 내역</h2>
						<div className="flex items-center gap-2">
							<span className="text-sm text-blue-900/80">수급자</span>
							<span className="min-w-[120px] px-3 py-1.5 text-sm bg-blue-50 border border-blue-200 rounded text-blue-900">
								{selectedMember?.P_NM || "-"}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<label className="text-sm text-blue-900/80" htmlFor="auddt">
								검사일자
							</label>
							<input
								id="auddt"
								type="date"
								value={formData.AUDDT}
								onChange={(e) => handleFieldChange("AUDDT", e.target.value)}
								disabled={fieldsDisabled}
								className="px-2 py-1.5 text-sm border border-blue-300 rounded bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
							/>
						</div>
						<div className="flex gap-2 ml-auto">
							<button
								type="button"
								onClick={handleEditClick}
								disabled={!selectedMember || saving}
								className={`px-4 py-1.5 text-sm font-medium border rounded disabled:opacity-50 ${
									isEditMode
										? "border-green-400 bg-green-100 hover:bg-green-200 text-green-900"
										: "border-blue-400 bg-blue-100 hover:bg-blue-200 text-blue-900"
								}`}
							>
								{isEditMode ? (saving ? "저장중" : "저장") : "수정"}
							</button>
							{isEditMode ? (
								<button
									type="button"
									onClick={handleCancelEdit}
									disabled={saving}
									className="px-4 py-1.5 text-sm font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-50"
								>
									취소
								</button>
							) : (
								<button
									type="button"
									onClick={handleDelete}
									disabled={!selectedMember || !isExisting || saving}
									className="px-4 py-1.5 text-sm font-medium border border-red-400 rounded bg-red-100 hover:bg-red-200 text-red-900 disabled:opacity-50"
								>
									삭제
								</button>
							)}
						</div>
					</div>

					<div className="flex-1 p-5 overflow-y-auto">
						<section className="mb-5 bg-white border border-blue-200 rounded-lg shadow-sm">
							<div className="px-4 py-2 border-b border-blue-100 bg-blue-50">
								<h3 className="text-sm font-semibold text-blue-900">X선검사</h3>
							</div>
							<div className="flex flex-wrap gap-6 px-4 py-4">
								<label className="flex items-center gap-2 text-sm cursor-pointer">
									<input
										type="radio"
										name="xau"
										checked={formData.XAU === "1"}
										onChange={() => handleFieldChange("XAU", "1")}
										disabled={fieldsDisabled}
										className="cursor-pointer disabled:cursor-not-allowed"
									/>
									<span>이상있음</span>
								</label>
								<label className="flex items-center gap-2 text-sm cursor-pointer">
									<input
										type="radio"
										name="xau"
										checked={formData.XAU === "2"}
										onChange={() => handleFieldChange("XAU", "2")}
										disabled={fieldsDisabled}
										className="cursor-pointer disabled:cursor-not-allowed"
									/>
									<span>이상없음</span>
								</label>
							</div>
						</section>

						<section className="mb-5 bg-white border border-blue-200 rounded-lg shadow-sm">
							<div className="px-4 py-2 border-b border-blue-100 bg-blue-50">
								<h3 className="text-sm font-semibold text-blue-900">검사 수치</h3>
							</div>
							<div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
								{LAB_FIELDS.map((field) => (
									<label
										key={field.key}
										className="flex flex-col gap-1 p-3 border border-blue-100 rounded-md bg-slate-50/80"
									>
										<span className="text-sm font-semibold text-blue-900">{field.label}</span>
										{field.hint && (
											<span className="text-xs text-blue-900/50">{field.hint}</span>
										)}
										<input
											type="number"
											step={field.step || "1"}
											value={formData[field.key]}
											onChange={(e) => handleFieldChange(field.key, e.target.value)}
											disabled={fieldsDisabled}
											className="w-full px-2 py-1.5 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
											placeholder="입력"
										/>
									</label>
								))}
							</div>
						</section>

						<section className="bg-white border border-blue-200 rounded-lg shadow-sm">
							<div className="px-4 py-2 border-b border-blue-100 bg-blue-50">
								<h3 className="text-sm font-semibold text-blue-900">건강검진소견</h3>
							</div>
							<div className="p-4">
								<textarea
									value={formData.AUDDES}
									onChange={(e) => handleFieldChange("AUDDES", e.target.value)}
									disabled={fieldsDisabled}
									rows={6}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
									placeholder="건강검진 소견을 입력하세요"
								/>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}

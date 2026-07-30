"use client";

import React, { useState } from "react";
import BeneficiaryListPanel, { BeneficiaryMember } from "../../components/BeneficiaryListPanel";
import {
	buildFeeStatementHtml,
	buildMedicalRecordHtml,
	mapV11070aToProgress,
	openPrintWindow,
	type FeePrintRow,
} from "../../utils/entrustedMedicalPrint";

type FormData = {
	HPDT: string;
	HP_TERM_TM: string;
	INDT: string;
	HPDES1: string;
	HPDES2: string;
	HPDTR: string;
	HP_GU: string;
	HP_AMT: string;
	HP_PRE_AMT: string;
	HP_CNT: string;
	HP_PAY_DT: string;
	HP_PAY_AMT: string;
};

function todayYmd() {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(hpdt?: string): FormData {
	const t = hpdt || todayYmd();
	return {
		HPDT: t,
		HP_TERM_TM: "",
		INDT: todayYmd(),
		HPDES1: "",
		HPDES2: "",
		HPDTR: "",
		HP_GU: "2",
		HP_AMT: "",
		HP_PRE_AMT: "",
		HP_CNT: "",
		HP_PAY_DT: t,
		HP_PAY_AMT: "",
	};
}

function valStr(v: unknown): string {
	if (v == null || v === "") return "";
	return String(v);
}

function calcAge(birth: unknown): string {
	const s = String(birth ?? "").trim();
	if (s.length < 4) return "";
	const y = parseInt(s.slice(0, 4), 10);
	if (!Number.isFinite(y)) return "";
	return String(new Date().getFullYear() - y);
}

type PrintKind = "fee" | "record" | null;

export default function EntrustedMedical() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [dates, setDates] = useState<string[]>([]);
	const [selectedDateIndex, setSelectedDateIndex] = useState<number | null>(null);
	const [datePage, setDatePage] = useState(1);
	const dateItemsPerPage = 12;
	const [formData, setFormData] = useState<FormData>(() => emptyForm());
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [isExisting, setIsExisting] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<FormData | null>(null);

	const [printKind, setPrintKind] = useState<PrintKind>(null);
	const [printStart, setPrintStart] = useState("");
	const [printEnd, setPrintEnd] = useState("");
	const [printLoading, setPrintLoading] = useState(false);

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const fetchDates = async (pnum: string) => {
		setLoading(true);
		exitEditMode();
		try {
			const res = await fetch(`/api/f11070?mode=dates&pnum=${encodeURIComponent(pnum)}`, {
				cache: "no-store",
			});
			const json = await res.json();
			const list = Array.isArray(json?.data)
				? json.data.map((r: { HPDT?: string }) => String(r.HPDT || "").trim()).filter(Boolean)
				: [];
			setDates(list);
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
			console.error(e);
			setDates([]);
			setSelectedDateIndex(null);
			setIsExisting(false);
			setFormData(emptyForm());
		} finally {
			setLoading(false);
		}
	};

	const loadDetail = async (pnum: string, hpdt: string) => {
		setLoading(true);
		try {
			const res = await fetch(
				`/api/f11070?pnum=${encodeURIComponent(pnum)}&hpdt=${encodeURIComponent(hpdt)}`,
				{ cache: "no-store" }
			);
			const json = await res.json();
			const row = json?.data;
			if (json?.success && row) {
				setFormData({
					HPDT: row.HPDT || hpdt,
					HP_TERM_TM: valStr(row.HP_TERM_TM),
					INDT: row.INDT || todayYmd(),
					HPDES1: valStr(row.HPDES1),
					HPDES2: valStr(row.HPDES2),
					HPDTR: valStr(row.HPDTR),
					HP_GU: row.HP_GU === "1" || row.HP_GU === "2" ? row.HP_GU : "2",
					HP_AMT: valStr(row.HP_AMT),
					HP_PRE_AMT: valStr(row.HP_PRE_AMT),
					HP_CNT: valStr(row.HP_CNT),
					HP_PAY_DT: row.HP_PAY_DT || "",
					HP_PAY_AMT: valStr(row.HP_PAY_AMT),
				});
				setIsExisting(true);
			} else {
				setFormData(emptyForm(hpdt));
				setIsExisting(false);
			}
		} catch (e) {
			console.error(e);
			setFormData(emptyForm(hpdt));
			setIsExisting(false);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		setSelectedMember(member);
		fetchDates(String(member.PNUM));
	};

	const handleSelectDate = async (index: number) => {
		if (!selectedMember) return;
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		setSelectedDateIndex(index);
		await loadDetail(String(selectedMember.PNUM), dates[index]);
	};

	const handleFieldChange = (key: keyof FormData, value: string) => {
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
		setEditingBackup(JSON.parse(JSON.stringify(next)) as FormData);
		setIsEditMode(true);
	};

	const handleCopy = () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!isExisting && !formData.HPDES1 && !formData.HPDES2) {
			alert("복사할 진료 내용이 없습니다.");
			return;
		}
		const copied = {
			...formData,
			HPDT: todayYmd(),
			INDT: todayYmd(),
			HP_PAY_DT: todayYmd(),
		};
		setSelectedDateIndex(null);
		setIsExisting(false);
		setFormData(copied);
		setEditingBackup(JSON.parse(JSON.stringify(copied)) as FormData);
		setIsEditMode(true);
	};

	const handleEditOrSave = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!isEditMode) {
			setEditingBackup(JSON.parse(JSON.stringify(formData)) as FormData);
			setIsEditMode(true);
			return;
		}
		if (!formData.HPDT) {
			alert("진료일자를 입력해주세요.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/f11070", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					HPDT: formData.HPDT,
					HP_TERM_TM: formData.HP_TERM_TM,
					HPDES1: formData.HPDES1,
					HPDES2: formData.HPDES2,
					HPDTR: formData.HPDTR,
					HP_GU: formData.HP_GU,
					HP_AMT: formData.HP_AMT,
					HP_PRE_AMT: formData.HP_PRE_AMT,
					HP_CNT: formData.HP_CNT,
					HP_PAY_DT: formData.HP_PAY_DT || null,
					HP_PAY_AMT: formData.HP_PAY_AMT || formData.HP_PRE_AMT || null,
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
				`/api/f11070?mode=dates&pnum=${encodeURIComponent(String(selectedMember.PNUM))}`,
				{ cache: "no-store" }
			);
			const datesJson = await datesRes.json();
			const list = Array.isArray(datesJson?.data)
				? datesJson.data.map((r: { HPDT?: string }) => String(r.HPDT || "").trim()).filter(Boolean)
				: [];
			setDates(list);
			const idx = list.findIndex((d: string) => d === formData.HPDT);
			setSelectedDateIndex(idx >= 0 ? idx : null);
			setIsExisting(true);
			await loadDetail(String(selectedMember.PNUM), formData.HPDT);
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleCancelEdit = () => {
		if (editingBackup) {
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as FormData);
		}
		exitEditMode();
	};

	const handleDelete = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!formData.HPDT || !isExisting) {
			alert("삭제할 기록이 없습니다.");
			return;
		}
		if (!confirm("선택한 진료일자의 기록을 삭제할까요?")) return;

		setSaving(true);
		try {
			const res = await fetch(
				`/api/f11070?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&hpdt=${encodeURIComponent(formData.HPDT)}`,
				{ method: "DELETE" }
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			exitEditMode();
			await fetchDates(String(selectedMember.PNUM));
		} catch (e) {
			console.error(e);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const openPrintModal = (kind: "fee" | "record") => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		const end = todayYmd();
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - 2);
		const start = startDate.toISOString().slice(0, 10);
		setPrintStart(start);
		setPrintEnd(end);
		setPrintKind(kind);
	};

	const handlePrint = async () => {
		if (!selectedMember || !printKind) return;
		if (!printStart || !printEnd) {
			alert("기간을 선택해주세요.");
			return;
		}
		if (printStart > printEnd) {
			alert("시작일이 종료일보다 늦을 수 없습니다.");
			return;
		}

		setPrintLoading(true);
		try {
			if (printKind === "fee") {
				// 진료비: F11070 기간 조회(+수급자 정보) — 내역서 컬럼과 일치
				const res = await fetch(
					`/api/f11070?mode=range&pnum=${encodeURIComponent(String(selectedMember.PNUM))}&startDate=${encodeURIComponent(printStart)}&endDate=${encodeURIComponent(printEnd)}`,
					{ cache: "no-store" }
				);
				const json = await res.json();
				if (!json?.success) {
					alert(`조회 실패: ${json?.error || "알 수 없는 오류"}`);
					return;
				}
				const rows = (json.data || []) as FeePrintRow[];
				// V11070A도 함께 조회 (사용자 요구)
				await fetch(
					`/api/v11070a?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&startDate=${encodeURIComponent(printStart)}&endDate=${encodeURIComponent(printEnd)}`,
					{ cache: "no-store" }
				).catch(() => null);

				openPrintWindow(
					buildFeeStatementHtml(rows, { startDate: printStart, endDate: printEnd })
				);
			} else {
				const [vRes, facRes] = await Promise.all([
					fetch(
						`/api/v11070a?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&startDate=${encodeURIComponent(printStart)}&endDate=${encodeURIComponent(printEnd)}`,
						{ cache: "no-store" }
					),
					fetch("/api/f00110").catch(() => null),
				]);
				const vJson = await vRes.json().catch(() => ({}));
				let progress = mapV11070aToProgress(Array.isArray(vJson?.data) ? vJson.data : []);

				// V11070A 비어 있으면 F11070로 Progress Note 구성
				if (progress.length === 0) {
					const fRes = await fetch(
						`/api/f11070?mode=range&pnum=${encodeURIComponent(String(selectedMember.PNUM))}&startDate=${encodeURIComponent(printStart)}&endDate=${encodeURIComponent(printEnd)}`,
						{ cache: "no-store" }
					);
					const fJson = await fRes.json();
					const fRows = Array.isArray(fJson?.data) ? fJson.data : [];
					progress = fRows.map((r: any) => ({
						visitDate: String(r.HPDT || ""),
						note: [r.HPDES1, r.HPDES2].filter(Boolean).join("\n"),
						doctor: String(r.HPDTR || ""),
					}));
				}

				const facJson = facRes ? await facRes.json().catch(() => ({})) : {};
				const facility = Array.isArray(facJson?.data) && facJson.data[0] ? facJson.data[0] : {};
				const rrnRaw = String(selectedMember.P_JUMIN || selectedMember.P_BRDT || "");
				const rrnMasked =
					rrnRaw.length >= 7 ? rrnRaw.replace(/(\d{6})[-]?(\d).*/, "$1-$2******") : rrnRaw;

				openPrintWindow(
					buildMedicalRecordHtml(
						{
							startDate: printStart,
							endDate: printEnd,
							facilityCode: String(facility.ANCD || facility.기관기호 || selectedMember.ANCD || ""),
							facilityName: String(facility.ANNM || facility.기관명 || ""),
							grade: String(selectedMember.P_GRD || ""),
							name: String(selectedMember.P_NM || ""),
							rrn: rrnMasked,
							recogNo: String(selectedMember.P_LTCNO || selectedMember.P_INNO || ""),
							sex: String(selectedMember.P_SEX || ""),
							age: calcAge(selectedMember.P_BRDT),
							admitDate: String(selectedMember.P_ADT || selectedMember.P_INDT || ""),
							mainSymptom: formData.HPDES1 || progress[0]?.note?.split("\n")[0] || "",
						},
						progress
					)
				);
			}
			setPrintKind(null);
		} catch (e) {
			console.error(e);
			alert("출력 중 오류가 발생했습니다.");
		} finally {
			setPrintLoading(false);
		}
	};

	const fieldsDisabled = !selectedMember || !isEditMode;
	const rightLocked = !selectedMember;
	const dateTotalPages = Math.max(1, Math.ceil(dates.length / dateItemsPerPage));
	const dateStartIndex = (datePage - 1) * dateItemsPerPage;
	const currentDates = dates.slice(dateStartIndex, dateStartIndex + dateItemsPerPage);

	const inputCls = `w-full px-2 py-1.5 text-sm border border-blue-300 rounded ${
		fieldsDisabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
	}`;

	return (
		<div className="flex flex-col min-h-screen text-black bg-white">
			<div className="flex h-[calc(100vh-56px)]">
				<BeneficiaryListPanel
					selectedMember={selectedMember}
					onSelect={handleSelectMember}
					className="w-1/4"
				/>

				{/* 진료일자 */}
				<div className="flex flex-col w-[200px] bg-white border-r border-blue-200">
					<div className="flex items-center justify-between px-3 py-2 border-b border-blue-200 bg-blue-50">
						<label className="text-sm font-medium text-blue-900">진료일자</label>
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
							{loading && dates.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
							) : dates.length === 0 ? (
								<div className="px-3 py-2 text-sm text-blue-900/60">
									{selectedMember ? "진료일자가 없습니다" : "수급자를 선택해주세요"}
								</div>
							) : (
								currentDates.map((date, i) => {
									const gi = dateStartIndex + i;
									return (
										<button
											type="button"
											key={`${date}-${gi}`}
											onClick={() => handleSelectDate(gi)}
											className={`w-full px-3 py-2 text-sm text-left border-b border-blue-50 hover:bg-blue-50 ${
												selectedDateIndex === gi ? "bg-blue-100 font-semibold" : ""
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
								<button type="button" onClick={() => setDatePage(1)} disabled={datePage === 1} className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50">{"<<"}</button>
								<button type="button" onClick={() => setDatePage((p) => Math.max(1, p - 1))} disabled={datePage === 1} className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50">{"<"}</button>
								<span className="text-xs text-blue-900">{datePage}/{dateTotalPages}</span>
								<button type="button" onClick={() => setDatePage((p) => Math.min(dateTotalPages, p + 1))} disabled={datePage === dateTotalPages} className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50">{">"}</button>
								<button type="button" onClick={() => setDatePage(dateTotalPages)} disabled={datePage === dateTotalPages} className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50">{">>"}</button>
							</div>
						)}
					</div>
				</div>

				{/* 상세 폼 */}
				<div className="relative flex flex-col flex-1 overflow-hidden bg-slate-50">
					{rightLocked && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
							<p className="text-sm font-medium text-blue-900/70">수급자를 선택해주세요</p>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-white border-b border-blue-200">
						<h2 className="text-base font-semibold text-blue-900">촉탁의 진료내역</h2>
						<div className="flex items-center gap-2">
							<span className="text-sm text-blue-900/80">수급자</span>
							<span className="min-w-[120px] px-3 py-1.5 text-sm bg-blue-50 border border-blue-200 rounded">
								{selectedMember?.P_NM || "-"}
							</span>
						</div>
						<button
							type="button"
							onClick={handleCopy}
							disabled={!selectedMember || saving}
							className="px-3 py-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
						>
							복사
						</button>
						<div className="flex gap-2 ml-auto">
							<button
								type="button"
								onClick={handleEditOrSave}
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
						<section className="p-4 mb-4 bg-white border border-blue-200 rounded-lg shadow-sm">
							<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">진료일자</label>
									<input type="date" value={formData.HPDT} onChange={(e) => handleFieldChange("HPDT", e.target.value)} disabled={fieldsDisabled} className={inputCls} />
								</div>
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">진료시간</label>
									<input type="text" value={formData.HP_TERM_TM} onChange={(e) => handleFieldChange("HP_TERM_TM", e.target.value)} disabled={fieldsDisabled} placeholder="예: 10:00" className={inputCls} />
								</div>
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">생성일자</label>
									<input type="date" value={formData.INDT} disabled className="w-full px-2 py-1.5 text-sm border border-blue-200 rounded bg-gray-100 cursor-not-allowed" />
								</div>
							</div>
						</section>

						<section className="p-4 mb-4 bg-white border border-blue-200 rounded-lg shadow-sm">
							<label className="block mb-1 text-sm font-medium text-blue-900">주요증상</label>
							<textarea value={formData.HPDES1} onChange={(e) => handleFieldChange("HPDES1", e.target.value)} disabled={fieldsDisabled} rows={4} className={`${inputCls} resize-y mb-3`} placeholder="주요증상을 입력하세요" />
							<label className="block mb-1 text-sm font-medium text-blue-900">진료내용</label>
							<textarea value={formData.HPDES2} onChange={(e) => handleFieldChange("HPDES2", e.target.value)} disabled={fieldsDisabled} rows={4} className={`${inputCls} resize-y`} placeholder="진료내용을 입력하세요" />
						</section>

						<section className="p-4 mb-4 bg-white border border-blue-200 rounded-lg shadow-sm">
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">진료의사</label>
									<input type="text" value={formData.HPDTR} onChange={(e) => handleFieldChange("HPDTR", e.target.value)} disabled={fieldsDisabled} className={inputCls} />
								</div>
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">진료구분</label>
									<select value={formData.HP_GU} onChange={(e) => handleFieldChange("HP_GU", e.target.value)} disabled={fieldsDisabled} className={inputCls}>
										<option value="1">초진</option>
										<option value="2">재진</option>
									</select>
								</div>
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">본인부담진료비</label>
									<input type="number" value={formData.HP_AMT} onChange={(e) => handleFieldChange("HP_AMT", e.target.value)} disabled={fieldsDisabled} className={inputCls} />
								</div>
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">처방비</label>
									<input type="number" value={formData.HP_PRE_AMT} onChange={(e) => handleFieldChange("HP_PRE_AMT", e.target.value)} disabled={fieldsDisabled} className={inputCls} />
								</div>
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">건수</label>
									<input type="number" value={formData.HP_CNT} onChange={(e) => handleFieldChange("HP_CNT", e.target.value)} disabled={fieldsDisabled} className={inputCls} />
								</div>
							</div>
							<div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
								<div>
									<label className="block mb-1 text-sm font-medium text-blue-900">정산일자</label>
									<input type="date" value={formData.HP_PAY_DT} onChange={(e) => handleFieldChange("HP_PAY_DT", e.target.value)} disabled={fieldsDisabled} className={inputCls} />
								</div>
							</div>
						</section>

						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => openPrintModal("fee")}
								disabled={!selectedMember}
								className="px-4 py-2 text-sm font-medium border border-orange-400 rounded bg-orange-100 hover:bg-orange-200 text-orange-900 disabled:opacity-40"
							>
								진료비 출력
							</button>
							<button
								type="button"
								onClick={() => openPrintModal("record")}
								disabled={!selectedMember}
								className="px-4 py-2 text-sm font-medium border border-orange-400 rounded bg-orange-100 hover:bg-orange-200 text-orange-900 disabled:opacity-40"
							>
								진료기록부 출력
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* 기간 조회 출력 모달 */}
			{printKind && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="w-full max-w-md p-5 bg-white border border-blue-300 rounded-lg shadow-xl">
						<h3 className="mb-4 text-lg font-semibold text-blue-900">
							{printKind === "fee" ? "진료비 출력" : "진료기록부 출력"}
						</h3>
						<p className="mb-3 text-sm text-blue-900/70">
							수급자: {selectedMember?.P_NM || "-"}
						</p>
						<label className="block mb-2 text-sm font-medium text-blue-900">조회 기간</label>
						<div className="flex items-center gap-2 mb-5">
							<input
								type="date"
								value={printStart}
								onChange={(e) => setPrintStart(e.target.value)}
								className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded"
							/>
							<span>~</span>
							<input
								type="date"
								value={printEnd}
								onChange={(e) => setPrintEnd(e.target.value)}
								className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded"
							/>
						</div>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={handlePrint}
								disabled={printLoading}
								className="px-4 py-1.5 text-sm font-medium border border-green-400 rounded bg-green-100 hover:bg-green-200 text-green-900 disabled:opacity-50"
							>
								{printLoading ? "조회중..." : "출력"}
							</button>
							<button
								type="button"
								onClick={() => setPrintKind(null)}
								disabled={printLoading}
								className="px-4 py-1.5 text-sm font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
							>
								닫기
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

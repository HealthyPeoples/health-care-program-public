"use client";

/**
 * @file 복용약물 — 화면 컴포넌트 (MedicationTime.tsx)
 *
 * @description
 * F30110 복용약물 등록 화면입니다. 왼쪽 수급자 목록, 가운데 복용약물 목록,
 * 오른쪽 상세 내용으로 구성됩니다. 폴더: component/nursing-home/pages/medication-time
 *
 * @module component/nursing-home/pages/medication-time/MedicationTime
 */
import React, { useEffect, useState } from "react";
import { MemberListPanel } from "../../components/MemberListPanel";
import { useTabRefresh } from "../../hooks/useTabRefresh";

interface MemberData {
	ANCD: string;
	PNUM: string;
	P_NM: string;
	P_SEX: string;
	P_GRD: string;
	P_BRDT: string;
	P_ST: string;
	[key: string]: unknown;
}

interface MedicationRow {
	ANCD?: number | string;
	PNUM?: number | string;
	SEQ: number;
	RSDT: string;
	MENM: string;
	SDT: string;
	EDT: string;
	INQNT: string;
	INCNT: string;
	METM: string;
	CAPDES: string;
	ETC?: string;
	INEMPNM?: string;
}

interface MedicationForm {
	SEQ: number | null;
	RSDT: string;
	MENM: string;
	SDT: string;
	EDT: string;
	INQNT: string;
	INCNT: string;
	METM: string;
	CAPDES: string;
}

const LIST_ITEMS_PER_PAGE = 10;

const todayYmd = () => {
	const d = new Date();
	const yyyy = String(d.getFullYear()).padStart(4, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
};

const formatDateDisplay = (dateStr: string) => {
	if (!dateStr) return "";
	let s = String(dateStr);
	if (s.includes("T")) s = s.split("T")[0];
	if (s.includes("-") && s.length >= 10) return s.substring(0, 10);
	if (s.length === 8 && !s.includes("-")) {
		return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
	}
	return s;
};

const emptyForm = (): MedicationForm => {
	const t = todayYmd();
	return {
		SEQ: null,
		RSDT: t,
		MENM: "",
		SDT: t,
		EDT: "",
		INQNT: "",
		INCNT: "",
		METM: "",
		CAPDES: "",
	};
};

const rowToForm = (row: MedicationRow): MedicationForm => ({
	SEQ: Number(row.SEQ),
	RSDT: formatDateDisplay(row.RSDT) || todayYmd(),
	MENM: row.MENM || "",
	SDT: formatDateDisplay(row.SDT),
	EDT: formatDateDisplay(row.EDT),
	INQNT: row.INQNT || "",
	INCNT: row.INCNT || "",
	METM: row.METM || "",
	CAPDES: row.CAPDES || "",
});

const formPayload = (form: MedicationForm, pnum: string | number, inempnm?: string) => ({
	PNUM: pnum,
	SEQ: form.SEQ,
	RSDT: form.RSDT,
	MENM: form.MENM.trim(),
	SDT: form.SDT || null,
	EDT: form.EDT || null,
	INQNT: form.INQNT,
	INCNT: form.INCNT,
	METM: form.METM,
	CAPDES: form.CAPDES,
	INEMPNM: inempnm || null,
});

const inputCls =
	"w-full px-2 py-1 text-sm bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed";
const btnPrimaryCls =
	"px-3 py-1.5 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed";
const btnSaveCls =
	"px-4 py-1.5 text-xs border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-40";
const btnEditCls =
	"px-4 py-1.5 text-xs border border-green-400 rounded bg-green-200 hover:bg-green-300 text-green-900 font-medium disabled:opacity-40";
const btnDeleteCls =
	"px-4 py-1.5 text-xs border border-orange-400 rounded bg-orange-200 hover:bg-orange-300 text-orange-900 font-medium disabled:opacity-40";
const btnCancelCls =
	"px-4 py-1.5 text-xs border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium disabled:opacity-40";

function FieldRow({
	label,
	children,
	tall,
}: {
	label: string;
	children: React.ReactNode;
	tall?: boolean;
}) {
	return (
		<tr>
			<th
				className={`w-32 px-3 py-2.5 text-sm font-medium text-left text-blue-900 bg-blue-50 border border-blue-200 whitespace-nowrap align-middle ${
					tall ? "align-top" : ""
				}`}
			>
				{label}
			</th>
			<td className={`px-3 py-2 text-sm border border-blue-200 ${tall ? "align-top" : ""}`}>
				{children}
			</td>
		</tr>
	);
}

function MedicationFields({
	form,
	onChange,
	disabled,
	idPrefix,
	beneficiaryName,
}: {
	form: MedicationForm;
	onChange: (key: keyof MedicationForm, value: string) => void;
	disabled: boolean;
	idPrefix: string;
	beneficiaryName: string;
}) {
	const displayOrDash = (v: string) => v || "-";

	return (
		<table className="w-full border-collapse">
			<tbody>
				<FieldRow label="수급자">
					<span className="text-blue-900">{beneficiaryName || "-"}</span>
				</FieldRow>
				<FieldRow label="조사일자">
					{disabled ? (
						<span>{displayOrDash(form.RSDT)}</span>
					) : (
						<input
							id={`${idPrefix}-rsdt`}
							type="date"
							value={form.RSDT}
							onChange={(e) => onChange("RSDT", e.target.value)}
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="복용약물명">
					{disabled ? (
						<span>{displayOrDash(form.MENM)}</span>
					) : (
						<input
							id={`${idPrefix}-menm`}
							type="text"
							value={form.MENM}
							onChange={(e) => onChange("MENM", e.target.value)}
							maxLength={100}
							placeholder="복용약물명 입력"
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="투여시작일">
					{disabled ? (
						<span>{displayOrDash(form.SDT)}</span>
					) : (
						<input
							id={`${idPrefix}-sdt`}
							type="date"
							value={form.SDT}
							onChange={(e) => onChange("SDT", e.target.value)}
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="투여종료일">
					{disabled ? (
						<span>{displayOrDash(form.EDT)}</span>
					) : (
						<input
							id={`${idPrefix}-edt`}
							type="date"
							value={form.EDT}
							onChange={(e) => onChange("EDT", e.target.value)}
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="1회투약량">
					{disabled ? (
						<span>{displayOrDash(form.INQNT)}</span>
					) : (
						<input
							id={`${idPrefix}-inqnt`}
							type="text"
							value={form.INQNT}
							onChange={(e) => onChange("INQNT", e.target.value)}
							maxLength={20}
							placeholder="예: 1g"
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="1일투약횟수">
					{disabled ? (
						<span>{displayOrDash(form.INCNT)}</span>
					) : (
						<input
							id={`${idPrefix}-incnt`}
							type="text"
							value={form.INCNT}
							onChange={(e) => onChange("INCNT", e.target.value)}
							maxLength={40}
							placeholder="예: 3회"
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="복용시점">
					{disabled ? (
						<span>{displayOrDash(form.METM)}</span>
					) : (
						<input
							id={`${idPrefix}-metm`}
							type="text"
							value={form.METM}
							onChange={(e) => onChange("METM", e.target.value)}
							maxLength={40}
							placeholder="예: 식후"
							className={inputCls}
						/>
					)}
				</FieldRow>
				<FieldRow label="주의사항" tall>
					{disabled ? (
						<div className="min-h-[96px] whitespace-pre-wrap">{displayOrDash(form.CAPDES)}</div>
					) : (
						<textarea
							id={`${idPrefix}-capdes`}
							value={form.CAPDES}
							onChange={(e) => onChange("CAPDES", e.target.value)}
							maxLength={100}
							rows={5}
							placeholder="주의사항을 입력하세요"
							className={`${inputCls} resize-y min-h-[96px]`}
						/>
					)}
				</FieldRow>
			</tbody>
		</table>
	);
}

export default function MedicationTime() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [rows, setRows] = useState<MedicationRow[]>([]);
	const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
	const [formData, setFormData] = useState<MedicationForm>(() => emptyForm());
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<MedicationForm | null>(null);
	const [listPage, setListPage] = useState(1);
	const [userEmpnm, setUserEmpnm] = useState("");

	const [showAddModal, setShowAddModal] = useState(false);
	const [modalForm, setModalForm] = useState<MedicationForm>(() => emptyForm());
	const [modalSaving, setModalSaving] = useState(false);

	useEffect(() => {
		const loadUser = async () => {
			try {
				const res = await fetch("/api/auth/user-info", { credentials: "include" });
				const json = await res.json().catch(() => ({}));
				const empnm = json?.data?.empnm;
				if (empnm) setUserEmpnm(String(empnm));
			} catch {
				// 등록자명은 선택 항목
			}
		};
		void loadUser();
	}, []);

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const applyListSelection = (list: MedicationRow[], preferSeq?: number | null) => {
		if (list.length === 0) {
			setSelectedSeq(null);
			setFormData(emptyForm());
			setListPage(1);
			return;
		}

		const targetSeq =
			preferSeq != null && list.some((r) => Number(r.SEQ) === Number(preferSeq))
				? Number(preferSeq)
				: Number(list[0].SEQ);
		const target = list.find((r) => Number(r.SEQ) === targetSeq) || list[0];
		setSelectedSeq(Number(target.SEQ));
		setFormData(rowToForm(target));

		const idx = list.findIndex((r) => Number(r.SEQ) === Number(target.SEQ));
		setListPage(idx >= 0 ? Math.floor(idx / LIST_ITEMS_PER_PAGE) + 1 : 1);
	};

	const fetchList = async (pnum: string, preferSeq?: number | null) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/f30110?pnum=${encodeURIComponent(pnum)}`, { cache: "no-store" });
			const json = await res.json();
			const list: MedicationRow[] = Array.isArray(json?.data) ? json.data : [];
			setRows(list);
			applyListSelection(list, preferSeq);
		} catch (e) {
			console.error("복용약물 조회 오류:", e);
			setRows([]);
			applyListSelection([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectMember = (member: MemberData) => {
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		setShowAddModal(false);
		setSelectedMember(member);
		void fetchList(String(member.PNUM));
	};

	useTabRefresh(() => {
		if (!selectedMember?.PNUM) return;
		void fetchList(String(selectedMember.PNUM), selectedSeq);
	});

	const handleSelectRow = (row: MedicationRow) => {
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		setSelectedSeq(Number(row.SEQ));
		setFormData(rowToForm(row));
	};

	const handleFieldChange = (key: keyof MedicationForm, value: string) => {
		if (!isEditMode) return;
		setFormData((prev) => ({ ...prev, [key]: value }));
	};

	const openAddModal = () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 신규 등록을 진행할까요?")) {
			return;
		}
		exitEditMode();
		setModalForm(emptyForm());
		setShowAddModal(true);
	};

	const closeAddModal = () => {
		if (modalSaving) return;
		setShowAddModal(false);
		setModalForm(emptyForm());
	};

	const validateForm = (form: MedicationForm) => {
		if (!form.MENM.trim()) {
			alert("복용약물명을 입력해주세요.");
			return false;
		}
		if (!form.RSDT) {
			alert("조사일자를 입력해주세요.");
			return false;
		}
		return true;
	};

	const handleModalSave = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!validateForm(modalForm)) return;

		setModalSaving(true);
		try {
			const res = await fetch("/api/f30110", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formPayload(modalForm, selectedMember.PNUM, userEmpnm)),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("저장되었습니다");
			setShowAddModal(false);
			setModalForm(emptyForm());
			await fetchList(String(selectedMember.PNUM), Number(json?.data?.SEQ));
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setModalSaving(false);
		}
	};

	const handleModify = () => {
		if (selectedSeq == null) {
			alert("수정할 항목을 목록에서 선택해주세요.");
			return;
		}
		setEditingBackup(JSON.parse(JSON.stringify(formData)) as MedicationForm);
		setIsEditMode(true);
	};

	const handleSave = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!validateForm(formData) || formData.SEQ == null) {
			if (formData.SEQ == null) alert("수정할 항목이 없습니다.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/f30110", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(formPayload(formData, selectedMember.PNUM, userEmpnm)),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("저장되었습니다");
			const keepSeq = formData.SEQ;
			exitEditMode();
			await fetchList(String(selectedMember.PNUM), keepSeq);
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleCancelEdit = () => {
		if (editingBackup) {
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as MedicationForm);
			if (editingBackup.SEQ != null) setSelectedSeq(editingBackup.SEQ);
		} else if (selectedSeq != null) {
			const row = rows.find((r) => Number(r.SEQ) === Number(selectedSeq));
			if (row) setFormData(rowToForm(row));
		}
		exitEditMode();
	};

	const handleDelete = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (selectedSeq == null) {
			alert("삭제할 항목을 목록에서 선택해주세요.");
			return;
		}
		if (!confirm("정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;

		setSaving(true);
		try {
			const res = await fetch(
				`/api/f30110?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&seq=${encodeURIComponent(String(selectedSeq))}`,
				{ method: "DELETE" }
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			exitEditMode();
			await fetchList(String(selectedMember.PNUM));
		} catch (err) {
			console.error(err);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const totalListPages = Math.max(1, Math.ceil(rows.length / LIST_ITEMS_PER_PAGE));
	const safeListPage = Math.min(listPage, totalListPages);
	const pageStart = (safeListPage - 1) * LIST_ITEMS_PER_PAGE;
	const currentRows = rows.slice(pageStart, pageStart + LIST_ITEMS_PER_PAGE);

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0">
				<div className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 p-4 bg-white border-r border-blue-200 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden">
					<MemberListPanel
						title="수급자 목록"
						className="w-full"
						onSelectMember={(m) => handleSelectMember(m as MemberData)}
					/>
				</div>

				<div className="flex flex-col xl:flex-row flex-1 min-w-0 min-h-0 bg-white">
					<div className="flex flex-col w-full xl:w-[420px] xl:max-w-[45%] shrink-0 min-w-0 border-r border-blue-200 px-4 py-3 bg-blue-50 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden">
						<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
							<label className="text-sm font-medium text-blue-900">복용약물 목록</label>
							<button type="button" onClick={openAddModal} className={btnPrimaryCls}>
								생성
							</button>
						</div>
						<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-white border border-blue-200 rounded">
							<div className="flex-1 overflow-auto">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-blue-100 border-b border-blue-200">
										<tr>
											<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
												복용약물명
											</th>
											<th className="w-28 px-2 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
												조사일자
											</th>
											<th className="w-28 px-2 py-2 font-semibold text-left text-blue-900">
												종료일자
											</th>
										</tr>
									</thead>
									<tbody>
										{loading ? (
											<tr>
												<td colSpan={3} className="px-3 py-6 text-center text-blue-900/60">
													로딩 중...
												</td>
											</tr>
										) : rows.length === 0 ? (
											<tr>
												<td colSpan={3} className="px-3 py-6 text-center text-blue-900/60">
													{selectedMember ? "등록된 복용약물이 없습니다" : "수급자를 선택해주세요"}
												</td>
											</tr>
										) : (
											currentRows.map((row, localIndex) => (
												<tr
													key={row.SEQ}
													onClick={() => handleSelectRow(row)}
													className={`border-b border-blue-100 cursor-pointer hover:bg-blue-50 ${
														selectedSeq === Number(row.SEQ) ? "bg-blue-200 font-semibold" : ""
													}`}
												>
													<td className="px-3 py-2 border-r border-blue-100 break-words">
														{pageStart + localIndex + 1}. {row.MENM || "-"}
													</td>
													<td className="px-2 py-2 whitespace-nowrap border-r border-blue-100">
														{formatDateDisplay(row.RSDT) || "-"}
													</td>
													<td className="px-2 py-2 whitespace-nowrap">
														{formatDateDisplay(row.EDT) || ""}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
							{rows.length > LIST_ITEMS_PER_PAGE && (
								<div className="p-2 border-t border-blue-100">
									<div className="flex items-center justify-center gap-1">
										<button
											type="button"
											onClick={() => setListPage(1)}
											disabled={safeListPage === 1}
											className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
										>
											&lt;&lt;
										</button>
										<button
											type="button"
											onClick={() => setListPage((prev) => Math.max(1, prev - 1))}
											disabled={safeListPage === 1}
											className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
										>
											&lt;
										</button>
										{(() => {
											const pagesToShow = Math.min(5, totalListPages);
											const startPage = Math.max(1, Math.min(totalListPages - 4, safeListPage - 2));
											return Array.from({ length: pagesToShow }, (_, i) => {
												const pageNum = startPage + i;
												if (pageNum > totalListPages) return null;
												return (
													<button
														key={pageNum}
														type="button"
														onClick={() => setListPage(pageNum)}
														className={`px-2 py-1 text-xs border rounded ${
															safeListPage === pageNum
																? "bg-blue-500 text-white border-blue-500"
																: "border-blue-300 hover:bg-blue-50"
														}`}
													>
														{pageNum}
													</button>
												);
											});
										})()}
										<button
											type="button"
											onClick={() => setListPage((prev) => Math.min(totalListPages, prev + 1))}
											disabled={safeListPage >= totalListPages}
											className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
										>
											&gt;
										</button>
										<button
											type="button"
											onClick={() => setListPage(totalListPages)}
											disabled={safeListPage >= totalListPages}
											className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
										>
											&gt;&gt;
										</button>
									</div>
								</div>
							)}
						</div>
					</div>

					{selectedMember && (
						<div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4">
							<MedicationFields
								form={formData}
								onChange={handleFieldChange}
								disabled={!isEditMode}
								idPrefix="detail"
								beneficiaryName={selectedMember.P_NM || ""}
							/>

							<div className="flex justify-end gap-2 mt-4">
								{!isEditMode ? (
									<>
										<button
											type="button"
											onClick={handleModify}
											disabled={selectedSeq == null || saving}
											className={btnEditCls}
										>
											수정
										</button>
										<button
											type="button"
											onClick={handleDelete}
											disabled={selectedSeq == null || saving}
											className={btnDeleteCls}
										>
											삭제
										</button>
									</>
								) : (
									<>
										<button
											type="button"
											onClick={handleCancelEdit}
											disabled={saving}
											className={btnCancelCls}
										>
											취소
										</button>
										<button
											type="button"
											onClick={handleSave}
											disabled={saving}
											className={btnSaveCls}
										>
											{saving ? "저장중" : "저장"}
										</button>
									</>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{showAddModal && selectedMember && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div
						className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 bg-white border border-blue-300 rounded-lg shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="medication-create-title"
					>
						<div className="flex items-center justify-between mb-4">
							<h3 id="medication-create-title" className="text-lg font-semibold text-blue-900">
								복용약물 신규 등록
							</h3>
							<button
								type="button"
								onClick={closeAddModal}
								disabled={modalSaving}
								className="px-2 py-1 text-sm text-blue-900 hover:bg-blue-50 rounded disabled:opacity-50"
							>
								닫기
							</button>
						</div>
						<MedicationFields
							form={modalForm}
							onChange={(key, value) => setModalForm((prev) => ({ ...prev, [key]: value }))}
							disabled={false}
							idPrefix="modal"
							beneficiaryName={selectedMember.P_NM || ""}
						/>
						<div className="flex justify-end gap-2 mt-4">
							<button type="button" onClick={closeAddModal} disabled={modalSaving} className={btnCancelCls}>
								취소
							</button>
							<button type="button" onClick={handleModalSave} disabled={modalSaving} className={btnSaveCls}>
								{modalSaving ? "저장중" : "저장"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

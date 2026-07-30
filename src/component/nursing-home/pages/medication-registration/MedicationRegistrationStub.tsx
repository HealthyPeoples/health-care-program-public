"use client";

import React, { useState } from "react";
import BeneficiaryListPanel, { BeneficiaryMember } from "../../components/BeneficiaryListPanel";

type MedRow = {
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
};

type MedForm = {
	SEQ: number | null;
	RSDT: string;
	MENM: string;
	SDT: string;
	EDT: string;
	INQNT: string;
	INCNT: string;
	METM: string;
	CAPDES: string;
};

function todayYmd() {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(): MedForm {
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
}

function rowToForm(row: MedRow): MedForm {
	return {
		SEQ: Number(row.SEQ),
		RSDT: row.RSDT || todayYmd(),
		MENM: row.MENM || "",
		SDT: row.SDT || "",
		EDT: row.EDT || "",
		INQNT: row.INQNT || "",
		INCNT: row.INCNT || "",
		METM: row.METM || "",
		CAPDES: row.CAPDES || "",
	};
}

function formPayload(form: MedForm, pnum: string | number) {
	return {
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
	};
}

export default function MedicationRegistrationStub() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [rows, setRows] = useState<MedRow[]>([]);
	const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
	const [formData, setFormData] = useState<MedForm>(() => emptyForm());
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<MedForm | null>(null);

	const [showAddModal, setShowAddModal] = useState(false);
	const [modalForm, setModalForm] = useState<MedForm>(() => emptyForm());
	const [modalSaving, setModalSaving] = useState(false);

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const fetchList = async (pnum: string, preferSeq?: number | null) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/f30110?pnum=${encodeURIComponent(pnum)}`, { cache: "no-store" });
			const json = await res.json();
			const list: MedRow[] = Array.isArray(json?.data) ? json.data : [];
			setRows(list);

			if (list.length === 0) {
				setSelectedSeq(null);
				setFormData(emptyForm());
				return;
			}

			const targetSeq =
				preferSeq != null && list.some((r) => Number(r.SEQ) === Number(preferSeq))
					? Number(preferSeq)
					: Number(list[0].SEQ);
			const target = list.find((r) => Number(r.SEQ) === targetSeq) || list[0];
			setSelectedSeq(Number(target.SEQ));
			setFormData(rowToForm(target));
		} catch (e) {
			console.error("복용약물 조회 오류:", e);
			setRows([]);
			setSelectedSeq(null);
			setFormData(emptyForm());
		} finally {
			setLoading(false);
		}
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		exitEditMode();
		setShowAddModal(false);
		setSelectedMember(member);
		fetchList(String(member.PNUM));
	};

	const handleSelectRow = (row: MedRow) => {
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		setSelectedSeq(Number(row.SEQ));
		setFormData(rowToForm(row));
	};

	const handleFieldChange = (key: keyof MedForm, value: string) => {
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

	const validateForm = (form: MedForm) => {
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
				body: JSON.stringify(formPayload(modalForm, selectedMember.PNUM)),
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

	const handleEditOrSave = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}

		if (!isEditMode) {
			if (selectedSeq == null) {
				alert("수정할 항목을 목록에서 선택해주세요.");
				return;
			}
			setEditingBackup(JSON.parse(JSON.stringify(formData)) as MedForm);
			setIsEditMode(true);
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
				body: JSON.stringify(formPayload(formData, selectedMember.PNUM)),
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
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as MedForm);
			if (editingBackup.SEQ != null) setSelectedSeq(editingBackup.SEQ);
		} else if (selectedSeq != null) {
			const row = rows.find((r) => Number(r.SEQ) === Number(selectedSeq));
			if (row) setFormData(rowToForm(row));
		}
		exitEditMode();
	};

	const handleDelete = async (seq: number, e?: React.MouseEvent) => {
		e?.stopPropagation();
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!confirm("선택한 복용약물을 삭제할까요?")) return;

		setSaving(true);
		try {
			const res = await fetch(
				`/api/f30110?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&seq=${encodeURIComponent(String(seq))}`,
				{ method: "DELETE" }
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			if (selectedSeq === seq) exitEditMode();
			await fetchList(String(selectedMember.PNUM));
		} catch (err) {
			console.error(err);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const fieldsDisabled = !selectedMember || !isEditMode;
	const rightLocked = !selectedMember;

	const renderFormFields = (
		form: MedForm,
		onChange: (key: keyof MedForm, value: string) => void,
		disabled: boolean,
		idPrefix: string
	) => (
		<>
			<div className="mb-3">
				<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-rsdt`}>
					조사일자
				</label>
				<input
					id={`${idPrefix}-rsdt`}
					type="date"
					value={form.RSDT}
					onChange={(e) => onChange("RSDT", e.target.value)}
					disabled={disabled}
					className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
			</div>
			<div className="mb-3">
				<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-menm`}>
					복용약물명
				</label>
				<input
					id={`${idPrefix}-menm`}
					type="text"
					value={form.MENM}
					onChange={(e) => onChange("MENM", e.target.value)}
					disabled={disabled}
					maxLength={100}
					placeholder="복용약물명 입력"
					className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
			</div>
			<div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-2">
				<div>
					<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-sdt`}>
						투여시작일
					</label>
					<input
						id={`${idPrefix}-sdt`}
						type="date"
						value={form.SDT}
						onChange={(e) => onChange("SDT", e.target.value)}
						disabled={disabled}
						className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
				</div>
				<div>
					<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-edt`}>
						투여종료일
					</label>
					<input
						id={`${idPrefix}-edt`}
						type="date"
						value={form.EDT}
						onChange={(e) => onChange("EDT", e.target.value)}
						disabled={disabled}
						className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-2">
				<div>
					<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-inqnt`}>
						1회투여량
					</label>
					<input
						id={`${idPrefix}-inqnt`}
						type="text"
						value={form.INQNT}
						onChange={(e) => onChange("INQNT", e.target.value)}
						disabled={disabled}
						maxLength={20}
						placeholder="예: 1g"
						className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
				</div>
				<div>
					<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-incnt`}>
						1일투여횟수
					</label>
					<input
						id={`${idPrefix}-incnt`}
						type="text"
						value={form.INCNT}
						onChange={(e) => onChange("INCNT", e.target.value)}
						disabled={disabled}
						maxLength={40}
						placeholder="예: 3회"
						className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
					/>
				</div>
			</div>
			<div className="mb-3">
				<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-metm`}>
					복용시점
				</label>
				<input
					id={`${idPrefix}-metm`}
					type="text"
					value={form.METM}
					onChange={(e) => onChange("METM", e.target.value)}
					disabled={disabled}
					maxLength={40}
					placeholder="예: 식후"
					className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
			</div>
			<div className="mb-3">
				<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor={`${idPrefix}-capdes`}>
					주의사항
				</label>
				<textarea
					id={`${idPrefix}-capdes`}
					value={form.CAPDES}
					onChange={(e) => onChange("CAPDES", e.target.value)}
					disabled={disabled}
					maxLength={100}
					rows={4}
					placeholder="주의사항을 입력하세요"
					className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
				/>
			</div>
		</>
	);

	return (
		<div className="flex flex-col min-h-screen text-black bg-white">
			<div className="flex h-[calc(100vh-56px)]">
				<BeneficiaryListPanel
					selectedMember={selectedMember}
					onSelect={handleSelectMember}
					className="w-1/4"
				/>

				<div className="relative flex flex-1 overflow-hidden bg-slate-50">
					{rightLocked && (
						<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
							<p className="text-sm font-medium text-blue-900/70">수급자를 선택해주세요</p>
						</div>
					)}

					{/* 복용약물 목록 */}
					<div className="flex flex-col w-[46%] min-w-[320px] border-r border-blue-200 bg-white">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">복용약물 목록</h2>
							<button
								type="button"
								onClick={openAddModal}
								disabled={!selectedMember || saving || modalSaving}
								className="px-3 py-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
							>
								추가
							</button>
						</div>
						<div className="flex-1 overflow-auto">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
									<tr>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
											복용약물명
										</th>
										<th className="w-28 px-2 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
											조사일자
										</th>
										<th className="w-28 px-2 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
											종료일자
										</th>
										<th className="w-16 px-2 py-2 font-semibold text-center text-blue-900">삭제</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={4} className="px-3 py-6 text-center text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : rows.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-3 py-6 text-center text-blue-900/60">
												등록된 복용약물이 없습니다
											</td>
										</tr>
									) : (
										rows.map((row) => (
											<tr
												key={row.SEQ}
												onClick={() => handleSelectRow(row)}
												className={`border-b border-blue-50 cursor-pointer hover:bg-blue-50 ${
													selectedSeq === Number(row.SEQ) ? "bg-blue-100" : ""
												}`}
											>
												<td className="px-3 py-2.5 border-r border-blue-100 break-words">
													{row.MENM || "-"}
												</td>
												<td className="px-2 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
													{row.RSDT || "-"}
												</td>
												<td className="px-2 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
													{row.EDT || "-"}
												</td>
												<td className="px-2 py-2 text-center">
													<button
														type="button"
														onClick={(e) => handleDelete(Number(row.SEQ), e)}
														disabled={saving || isEditMode}
														className="px-2 py-1 text-xs font-medium border border-red-400 rounded bg-red-100 hover:bg-red-200 text-red-900 disabled:opacity-40"
													>
														삭제
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>

					{/* 상세 폼 */}
					<div className="flex flex-col flex-1 min-w-[300px] bg-white">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">복용약물 상세</h2>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleEditOrSave}
									disabled={!selectedMember || saving || (!isEditMode && selectedSeq == null)}
									className={`px-3 py-1 text-xs font-medium border rounded disabled:opacity-40 ${
										isEditMode
											? "border-green-400 bg-green-100 hover:bg-green-200 text-green-900"
											: "border-blue-400 bg-blue-100 hover:bg-blue-200 text-blue-900"
									}`}
								>
									{isEditMode ? (saving ? "저장중" : "저장") : "수정"}
								</button>
								{isEditMode && (
									<button
										type="button"
										onClick={handleCancelEdit}
										disabled={saving}
										className="px-3 py-1 text-xs font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
									>
										취소
									</button>
								)}
							</div>
						</div>
						<div className="flex-1 p-5 overflow-y-auto">
							<div className="mb-4">
								<label className="block mb-1.5 text-sm font-medium text-blue-900">수급자</label>
								<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
									{selectedMember?.P_NM || "-"}
								</div>
							</div>
							<div className="pt-2 mb-4 border-t border-blue-100" />
							{renderFormFields(formData, handleFieldChange, fieldsDisabled, "detail")}
							{isEditMode && (
								<p className="mt-4 text-xs text-blue-900/50">
									수정 모드입니다. 저장을 누르면 선택한 항목이 갱신됩니다.
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* 신규 등록 모달 */}
			{showAddModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 bg-white border border-blue-300 rounded-lg shadow-xl">
						<h3 className="mb-4 text-lg font-semibold text-blue-900">복용약물 신규 등록</h3>
						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900">수급자</label>
							<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
								{selectedMember?.P_NM || "-"}
							</div>
						</div>
						{renderFormFields(
							modalForm,
							(key, value) => setModalForm((prev) => ({ ...prev, [key]: value })),
							false,
							"modal"
						)}
						<div className="flex justify-end gap-2 mt-2">
							<button
								type="button"
								onClick={handleModalSave}
								disabled={modalSaving}
								className="px-4 py-1.5 text-sm font-medium border border-green-400 rounded bg-green-100 hover:bg-green-200 text-green-900 disabled:opacity-50"
							>
								{modalSaving ? "저장중" : "저장"}
							</button>
							<button
								type="button"
								onClick={closeAddModal}
								disabled={modalSaving}
								className="px-4 py-1.5 text-sm font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-50"
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

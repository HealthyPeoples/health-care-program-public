"use client";

/**
 * @file 질병력 — UI 부분 컴포넌트 (DiseaseHistoryView.tsx)
 *
 * @description
 * 요양원 질병력 기능의 UI 부분 컴포넌트입니다. 폴더: component/nursing-home/pages/disease-history
 *
 * @module component/nursing-home/pages/disease-history/DiseaseHistoryView
 */
import React, { useState } from "react";
import BeneficiaryListPanel, { BeneficiaryMember } from "../../components/BeneficiaryListPanel";

type DiseaseRow = {
	ANCD?: number | string;
	PNUM?: number | string;
	SEQ: number;
	JDES: string;
	JDT: string;
	ETC?: string;
};

type DiseaseForm = {
	SEQ: number | null;
	JDES: string;
	JDT: string;
};

function todayYmd() {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(): DiseaseForm {
	return { SEQ: null, JDES: "", JDT: todayYmd() };
}

export default function DiseaseHistoryView() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [rows, setRows] = useState<DiseaseRow[]>([]);
	const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
	const [formData, setFormData] = useState<DiseaseForm>(() => emptyForm());
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<DiseaseForm | null>(null);

	const [showAddModal, setShowAddModal] = useState(false);
	const [modalForm, setModalForm] = useState<DiseaseForm>(() => emptyForm());
	const [modalSaving, setModalSaving] = useState(false);

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const fetchList = async (pnum: string, preferSeq?: number | null) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/f30030?pnum=${encodeURIComponent(pnum)}`, { cache: "no-store" });
			const json = await res.json();
			const list: DiseaseRow[] = Array.isArray(json?.data) ? json.data : [];
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
			setFormData({
				SEQ: Number(target.SEQ),
				JDES: target.JDES || "",
				JDT: target.JDT || todayYmd(),
			});
		} catch (e) {
			console.error("질병내역 조회 오류:", e);
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

	const handleSelectRow = (row: DiseaseRow) => {
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		setSelectedSeq(Number(row.SEQ));
		setFormData({
			SEQ: Number(row.SEQ),
			JDES: row.JDES || "",
			JDT: row.JDT || todayYmd(),
		});
	};

	const handleFieldChange = (key: keyof DiseaseForm, value: string) => {
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

	const handleModalSave = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		const jdes = modalForm.JDES.trim();
		if (!jdes) {
			alert("진단명을 입력해주세요.");
			return;
		}
		if (!modalForm.JDT) {
			alert("진단일자를 입력해주세요.");
			return;
		}

		setModalSaving(true);
		try {
			const res = await fetch("/api/f30030", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					JDES: jdes,
					JDT: modalForm.JDT,
				}),
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
			setEditingBackup(JSON.parse(JSON.stringify(formData)) as DiseaseForm);
			setIsEditMode(true);
			return;
		}

		const jdes = formData.JDES.trim();
		if (!jdes) {
			alert("진단명을 입력해주세요.");
			return;
		}
		if (!formData.JDT) {
			alert("진단일자를 입력해주세요.");
			return;
		}
		if (formData.SEQ == null) {
			alert("수정할 항목이 없습니다.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/f30030", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					SEQ: formData.SEQ,
					JDES: jdes,
					JDT: formData.JDT,
				}),
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
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as DiseaseForm);
			if (editingBackup.SEQ != null) {
				setSelectedSeq(editingBackup.SEQ);
			}
		} else if (selectedSeq != null) {
			const row = rows.find((r) => Number(r.SEQ) === Number(selectedSeq));
			if (row) {
				setFormData({
					SEQ: Number(row.SEQ),
					JDES: row.JDES || "",
					JDT: row.JDT || todayYmd(),
				});
			}
		}
		exitEditMode();
	};

	const handleDelete = async (seq: number, e?: React.MouseEvent) => {
		e?.stopPropagation();
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!confirm("선택한 질병내역을 삭제할까요?")) return;

		setSaving(true);
		try {
			const res = await fetch(
				`/api/f30030?pnum=${encodeURIComponent(String(selectedMember.PNUM))}&seq=${encodeURIComponent(String(seq))}`,
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

					{/* 진단 목록 */}
					<div className="flex flex-col w-1/2 min-w-[320px] border-r border-blue-200 bg-white">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">질병내역 목록</h2>
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
											진단명
										</th>
										<th className="w-28 px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
											진단일자
										</th>
										<th className="w-16 px-2 py-2 font-semibold text-center text-blue-900">
											삭제
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
												등록된 질병내역이 없습니다
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
													{row.JDES || "-"}
												</td>
												<td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
													{row.JDT || "-"}
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

					{/* 우측 상세 폼 */}
					<div className="flex flex-col flex-1 min-w-[280px] bg-white">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">질병내역 상세</h2>
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
							<div className="mb-5">
								<label className="block mb-1.5 text-sm font-medium text-blue-900">수급자</label>
								<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
									{selectedMember?.P_NM || "-"}
								</div>
							</div>

							<div className="pt-4 mb-4 border-t border-blue-100" />

							<div className="mb-4">
								<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="jdes">
									진단명
								</label>
								<input
									id="jdes"
									type="text"
									value={formData.JDES}
									onChange={(e) => handleFieldChange("JDES", e.target.value)}
									disabled={fieldsDisabled}
									maxLength={100}
									placeholder="진단명을 입력하세요"
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
								/>
							</div>

							<div className="mb-4">
								<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="jdt">
									진단일자
								</label>
								<input
									id="jdt"
									type="date"
									value={formData.JDT}
									onChange={(e) => handleFieldChange("JDT", e.target.value)}
									disabled={fieldsDisabled}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
								/>
							</div>

							{isEditMode && (
								<p className="mt-6 text-xs text-blue-900/50">
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
					<div className="w-full max-w-md p-5 bg-white border border-blue-300 rounded-lg shadow-xl">
						<h3 className="mb-4 text-lg font-semibold text-blue-900">질병내역 신규 등록</h3>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900">수급자</label>
							<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
								{selectedMember?.P_NM || "-"}
							</div>
						</div>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-jdes">
								진단명
							</label>
							<input
								id="modal-jdes"
								type="text"
								value={modalForm.JDES}
								onChange={(e) => setModalForm((prev) => ({ ...prev, JDES: e.target.value }))}
								maxLength={100}
								placeholder="진단명을 입력하세요"
								className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
								autoFocus
							/>
						</div>

						<div className="mb-5">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-jdt">
								진단일자
							</label>
							<input
								id="modal-jdt"
								type="date"
								value={modalForm.JDT}
								onChange={(e) => setModalForm((prev) => ({ ...prev, JDT: e.target.value }))}
								className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
							/>
						</div>

						<div className="flex justify-end gap-2">
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

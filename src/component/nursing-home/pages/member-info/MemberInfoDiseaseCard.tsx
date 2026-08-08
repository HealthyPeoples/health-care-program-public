"use client";

/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoDiseaseCard.tsx)
 *
 * @description
 * 요양원 수급자정보 기능의 질병내역(F30030) 카드입니다.
 * 목록은 읽기 전용으로 표시하고, 생성·수정·삭제는 모달에서 처리합니다.
 *
 * @module component/nursing-home/pages/member-info/MemberInfoDiseaseCard
 */
import React, { useCallback, useEffect, useState } from "react";
import type { MemberData } from "./MemberInfoUtils";

export type DiseaseRow = {
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
	ETC: string;
};

export type MemberInfoDiseaseCardProps = {
	placeholder?: boolean;
	selectedMember?: MemberData | null;
};

function todayYmd() {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(): DiseaseForm {
	return { SEQ: null, JDES: "", JDT: todayYmd(), ETC: "" };
}

function rowToForm(row: DiseaseRow): DiseaseForm {
	return {
		SEQ: Number(row.SEQ),
		JDES: row.JDES || "",
		JDT: row.JDT || todayYmd(),
		ETC: row.ETC || "",
	};
}

/** 질병내역 카드 — 목록은 읽기 전용, 관리(생성/수정/삭제)는 모달 */
export default function MemberInfoDiseaseCard({
	placeholder = false,
	selectedMember = null,
}: MemberInfoDiseaseCardProps) {
	const [rows, setRows] = useState<DiseaseRow[]>([]);
	const [loading, setLoading] = useState(false);

	const [showModal, setShowModal] = useState(false);
	const [modalRows, setModalRows] = useState<DiseaseRow[]>([]);
	const [modalLoading, setModalLoading] = useState(false);
	const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
	const [formData, setFormData] = useState<DiseaseForm>(() => emptyForm());
	const [isEditMode, setIsEditMode] = useState(false);
	const [isCreateMode, setIsCreateMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<DiseaseForm | null>(null);
	const [saving, setSaving] = useState(false);

	const pnum = selectedMember?.PNUM != null ? String(selectedMember.PNUM) : "";
	const memberName = selectedMember?.P_NM || "-";

	const fetchList = useCallback(async (targetPnum: string) => {
		const res = await fetch(`/api/f30030?pnum=${encodeURIComponent(targetPnum)}`, {
			cache: "no-store",
		});
		const json = await res.json();
		return (Array.isArray(json?.data) ? json.data : []) as DiseaseRow[];
	}, []);

	const refreshCardList = useCallback(async () => {
		if (!pnum) {
			setRows([]);
			return;
		}
		setLoading(true);
		try {
			setRows(await fetchList(pnum));
		} catch (e) {
			console.error("질병내역 조회 오류:", e);
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [fetchList, pnum]);

	useEffect(() => {
		void refreshCardList();
	}, [refreshCardList]);

	const resetModalFormState = () => {
		setSelectedSeq(null);
		setFormData(emptyForm());
		setIsEditMode(false);
		setIsCreateMode(false);
		setEditingBackup(null);
	};

	const openModal = async () => {
		if (!pnum) {
			alert("수급자를 선택해주세요.");
			return;
		}
		setShowModal(true);
		resetModalFormState();
		setModalLoading(true);
		try {
			const list = await fetchList(pnum);
			setModalRows(list);
			if (list.length > 0) {
				const first = list[0];
				setSelectedSeq(Number(first.SEQ));
				setFormData(rowToForm(first));
			}
		} catch (e) {
			console.error("질병내역 조회 오류:", e);
			setModalRows([]);
		} finally {
			setModalLoading(false);
		}
	};

	const closeModal = () => {
		if (saving) return;
		if ((isEditMode || isCreateMode) && !confirm("작성 중인 내용이 저장되지 않습니다. 닫을까요?")) {
			return;
		}
		setShowModal(false);
		resetModalFormState();
		void refreshCardList();
	};

	const handleSelectRow = (row: DiseaseRow) => {
		if ((isEditMode || isCreateMode) && !confirm("작성 중인 내용이 저장되지 않습니다. 이동할까요?")) {
			return;
		}
		setIsEditMode(false);
		setIsCreateMode(false);
		setEditingBackup(null);
		setSelectedSeq(Number(row.SEQ));
		setFormData(rowToForm(row));
	};

	const handleCreateClick = () => {
		if ((isEditMode || isCreateMode) && !confirm("작성 중인 내용이 저장되지 않습니다. 신규 등록을 진행할까요?")) {
			return;
		}
		setIsEditMode(false);
		setEditingBackup(null);
		setSelectedSeq(null);
		setFormData(emptyForm());
		setIsCreateMode(true);
	};

	const handleEditClick = () => {
		if (selectedSeq == null) {
			alert("수정할 항목을 목록에서 선택해주세요.");
			return;
		}
		setEditingBackup(JSON.parse(JSON.stringify(formData)) as DiseaseForm);
		setIsCreateMode(false);
		setIsEditMode(true);
	};

	const handleCancelForm = () => {
		if (isCreateMode) {
			setIsCreateMode(false);
			if (selectedSeq != null) {
				const row = modalRows.find((r) => Number(r.SEQ) === Number(selectedSeq));
				if (row) setFormData(rowToForm(row));
			} else if (modalRows.length > 0) {
				const first = modalRows[0];
				setSelectedSeq(Number(first.SEQ));
				setFormData(rowToForm(first));
			} else {
				setFormData(emptyForm());
			}
			return;
		}
		if (editingBackup) {
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as DiseaseForm);
			if (editingBackup.SEQ != null) setSelectedSeq(editingBackup.SEQ);
		}
		setIsEditMode(false);
		setEditingBackup(null);
	};

	const handleFieldChange = (key: keyof DiseaseForm, value: string) => {
		if (!isEditMode && !isCreateMode) return;
		setFormData((prev) => ({ ...prev, [key]: value }));
	};

	const reloadModalList = async (preferSeq?: number | null) => {
		if (!pnum) return;
		const list = await fetchList(pnum);
		setModalRows(list);
		if (list.length === 0) {
			resetModalFormState();
			return;
		}
		const targetSeq =
			preferSeq != null && list.some((r) => Number(r.SEQ) === Number(preferSeq))
				? Number(preferSeq)
				: Number(list[0].SEQ);
		const target = list.find((r) => Number(r.SEQ) === targetSeq) || list[0];
		setSelectedSeq(Number(target.SEQ));
		setFormData(rowToForm(target));
		setIsEditMode(false);
		setIsCreateMode(false);
		setEditingBackup(null);
	};

	const handleSave = async () => {
		if (!selectedMember || !pnum) {
			alert("수급자를 선택해주세요.");
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

		setSaving(true);
		try {
			if (isCreateMode) {
				const res = await fetch("/api/f30030", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						PNUM: selectedMember.PNUM,
						JDES: jdes,
						JDT: formData.JDT,
						ETC: formData.ETC.trim() || null,
					}),
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success) {
					alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
					return;
				}
				alert("저장되었습니다");
				await reloadModalList(Number(json?.data?.SEQ));
			} else if (isEditMode) {
				if (formData.SEQ == null) {
					alert("수정할 항목이 없습니다.");
					return;
				}
				const res = await fetch("/api/f30030", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						PNUM: selectedMember.PNUM,
						SEQ: formData.SEQ,
						JDES: jdes,
						JDT: formData.JDT,
						ETC: formData.ETC.trim() || null,
					}),
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success) {
					alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
					return;
				}
				alert("저장되었습니다");
				await reloadModalList(formData.SEQ);
			}
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (seq: number, e?: React.MouseEvent) => {
		e?.stopPropagation();
		if (!selectedMember || !pnum) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if ((isEditMode || isCreateMode) && !confirm("작성 중인 내용이 저장되지 않습니다. 삭제를 진행할까요?")) {
			return;
		}
		if (!confirm("선택한 질병내역을 삭제할까요?")) return;

		setSaving(true);
		try {
			const res = await fetch(
				`/api/f30030?pnum=${encodeURIComponent(pnum)}&seq=${encodeURIComponent(String(seq))}`,
				{ method: "DELETE" }
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			await reloadModalList(selectedSeq === seq ? null : selectedSeq);
		} catch (err) {
			console.error(err);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const fieldsEditable = isEditMode || isCreateMode;

	if (placeholder) {
		return (
			<div className="bg-white border border-blue-300 rounded-lg shadow-sm min-h-[180px]">
				<div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
					<h3 className="text-lg font-semibold text-blue-900">질병내역</h3>
				</div>
				<div className="p-4 space-y-3 opacity-50">
					<div className="h-6 border-b border-blue-200" />
					<div className="h-6 border-b border-blue-200" />
					<div className="h-6 border-b border-blue-200" />
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="bg-white border border-blue-300 rounded-lg shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-blue-100 border-b border-blue-200">
					<h3 className="text-lg font-semibold text-blue-900 shrink-0">질병내역</h3>
					{/* <button
						type="button"
						onClick={() => void openModal()}
						className="px-3 py-1 text-sm text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300"
					>
						질병내역 관리
					</button> */}
				</div>
				<div className="overflow-auto max-h-56">
					<table className="w-full min-w-[280px] text-sm">
						<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
							<tr>
								<th className="px-2 sm:px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
									진단명
								</th>
								<th className="w-24 sm:w-28 px-2 sm:px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
									진단일자
								</th>
								<th className="px-2 sm:px-3 py-2 font-semibold text-left text-blue-900">비고</th>
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
									<tr key={row.SEQ} className="border-b border-blue-50">
										<td className="px-3 py-2.5 border-r border-blue-100 break-words">
											{row.JDES || "-"}
										</td>
										<td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
											{row.JDT || "-"}
										</td>
										<td className="px-3 py-2.5 break-words text-blue-900/80">
											{row.ETC || "-"}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-white border border-blue-300 rounded-lg shadow-xl overflow-hidden">
						<div className="flex flex-wrap items-start justify-between gap-2 px-4 sm:px-5 py-3 bg-blue-100 border-b border-blue-200">
							<div className="min-w-0">
								<h3 className="text-lg font-semibold text-blue-900">질병내역 관리</h3>
								<p className="text-sm text-blue-900/70 break-words">수급자: {memberName}</p>
							</div>
							<button
								type="button"
								onClick={closeModal}
								disabled={saving}
								className="shrink-0 px-3 py-1 text-sm border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-50"
							>
								닫기
							</button>
						</div>

						<div className="flex flex-col flex-1 min-h-0 md:flex-row">
							{/* 목록 */}
							<div className="flex flex-col border-b border-blue-200 md:w-1/2 md:min-w-0 md:border-b-0 md:border-r max-h-[40vh] md:max-h-none">
								<div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-blue-200 bg-blue-50">
									<h4 className="text-sm font-semibold text-blue-900 shrink-0">질병내역 목록</h4>
									<button
										type="button"
										onClick={handleCreateClick}
										disabled={saving}
										className="shrink-0 px-3 py-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
									>
										추가
									</button>
								</div>
								<div className="flex-1 min-h-0 overflow-auto">
									<table className="w-full min-w-[260px] text-sm">
										<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
											<tr>
												<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
													진단명
												</th>
												<th className="w-24 px-2 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
													진단일자
												</th>
												<th className="w-14 px-1 py-2 font-semibold text-center text-blue-900">
													삭제
												</th>
											</tr>
										</thead>
										<tbody>
											{modalLoading ? (
												<tr>
													<td colSpan={3} className="px-3 py-6 text-center text-blue-900/60">
														로딩 중...
													</td>
												</tr>
											) : modalRows.length === 0 ? (
												<tr>
													<td colSpan={3} className="px-3 py-6 text-center text-blue-900/60">
														등록된 질병내역이 없습니다
													</td>
												</tr>
											) : (
												modalRows.map((row) => (
													<tr
														key={row.SEQ}
														onClick={() => handleSelectRow(row)}
														className={`border-b border-blue-50 cursor-pointer hover:bg-blue-50 ${
															!isCreateMode && selectedSeq === Number(row.SEQ)
																? "bg-blue-100"
																: ""
														}`}
													>
														<td className="px-3 py-2.5 border-r border-blue-100 break-words">
															{row.JDES || "-"}
														</td>
														<td className="px-2 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
															{row.JDT || "-"}
														</td>
														<td className="px-1 py-2 text-center">
															<button
																type="button"
																onClick={(e) => void handleDelete(Number(row.SEQ), e)}
																disabled={saving}
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
							<div className="flex flex-col flex-1 min-w-0 min-h-0">
								<div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-blue-200 bg-blue-50">
									<h4 className="text-sm font-semibold text-blue-900 shrink-0">
										{isCreateMode ? "질병내역 신규 등록" : "질병내역 상세"}
									</h4>
									<div className="flex flex-wrap items-center gap-2">
										{fieldsEditable ? (
											<>
												<button
													type="button"
													onClick={() => void handleSave()}
													disabled={saving}
													className="shrink-0 px-3 py-1 text-xs font-medium border border-green-400 rounded bg-green-100 hover:bg-green-200 text-green-900 disabled:opacity-40"
												>
													{saving ? "저장중" : "저장"}
												</button>
												<button
													type="button"
													onClick={handleCancelForm}
													disabled={saving}
													className="shrink-0 px-3 py-1 text-xs font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
												>
													취소
												</button>
											</>
										) : (
											<button
												type="button"
												onClick={handleEditClick}
												disabled={saving || selectedSeq == null}
												className="shrink-0 px-3 py-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
											>
												수정
											</button>
										)}
									</div>
								</div>
								<div className="flex-1 p-3 sm:p-4 overflow-y-auto min-h-0">
									{!isCreateMode && selectedSeq == null && modalRows.length === 0 ? (
										<p className="text-sm text-blue-900/60">
											등록된 내역이 없습니다. 추가 버튼으로 신규 등록하세요.
										</p>
									) : (
										<>
											<div className="mb-4">
												<label
													className="block mb-1.5 text-sm font-medium text-blue-900"
													htmlFor="member-disease-jdes"
												>
													진단명
												</label>
												<input
													id="member-disease-jdes"
													type="text"
													value={formData.JDES}
													onChange={(e) => handleFieldChange("JDES", e.target.value)}
													disabled={!fieldsEditable}
													maxLength={100}
													placeholder="진단명을 입력하세요"
													className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
												/>
											</div>
											<div className="mb-4">
												<label
													className="block mb-1.5 text-sm font-medium text-blue-900"
													htmlFor="member-disease-jdt"
												>
													진단일자
												</label>
												<input
													id="member-disease-jdt"
													type="date"
													value={formData.JDT}
													onChange={(e) => handleFieldChange("JDT", e.target.value)}
													disabled={!fieldsEditable}
													className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
												/>
											</div>
											<div className="mb-4">
												<label
													className="block mb-1.5 text-sm font-medium text-blue-900"
													htmlFor="member-disease-etc"
												>
													비고
												</label>
												<input
													id="member-disease-etc"
													type="text"
													value={formData.ETC}
													onChange={(e) => handleFieldChange("ETC", e.target.value)}
													disabled={!fieldsEditable}
													maxLength={100}
													placeholder="비고"
													className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
												/>
											</div>
											{fieldsEditable && (
												<p className="text-xs text-blue-900/50">
													{isCreateMode
														? "신규 등록 모드입니다. 저장을 누르면 추가됩니다."
														: "수정 모드입니다. 저장을 누르면 선택한 항목이 갱신됩니다."}
												</p>
											)}
										</>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

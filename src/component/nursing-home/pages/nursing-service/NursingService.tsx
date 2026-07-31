"use client";

/**
 * @file 간호서비스 — 화면 컴포넌트 (NursingService.tsx)
 *
 * @description
 * 요양원 간호서비스 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/nursing-service
 *
 * @module component/nursing-home/pages/nursing-service/NursingService
 */
import React, { useEffect, useState } from "react";
import BeneficiaryListPanel, { BeneficiaryMember } from "../../components/BeneficiaryListPanel";
import { useTabRefresh } from "../../hooks/useTabRefresh";

type ServiceRow = {
	ANCD?: number | string;
	PNUM?: number | string;
	HCADT: string;
	HCACDC: string;
	HCACNM: string;
	HCACDB?: string;
	HCABNM?: string;
	HCATM: number | null;
	INDT?: string;
	ETC?: string;
	INEMPNO?: number | null;
	INEMPNM?: string;
};

type ServiceForm = {
	HCADT: string;
	HCACDB: string;
	HCABNM: string;
	HCACDC: string;
	HCACNM: string;
	HCATM: string;
	ETC: string;
	INDT: string;
	INEMPNM: string;
};

type ProblemItem = {
	HCACDB: string;
	HCABNM: string;
};

type ActItem = {
	HCACDC: string;
	HCACNM: string;
	HCACDB: string;
};

function todayYmd() {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(): ServiceForm {
	return {
		HCADT: todayYmd(),
		HCACDB: "",
		HCABNM: "",
		HCACDC: "",
		HCACNM: "",
		HCATM: "",
		ETC: "",
		INDT: todayYmd(),
		INEMPNM: "",
	};
}

function rowKey(row: Pick<ServiceRow, "HCADT" | "HCACDC">) {
	return `${row.HCADT}|${String(row.HCACDC || "").trim()}`;
}

const LIST_PAGE_SIZE = 5;

export default function NursingService() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [rows, setRows] = useState<ServiceRow[]>([]);
	const [listPage, setListPage] = useState(1);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [origKey, setOrigKey] = useState<{ HCADT: string; HCACDC: string } | null>(null);
	const [formData, setFormData] = useState<ServiceForm>(() => emptyForm());
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [editingBackup, setEditingBackup] = useState<ServiceForm | null>(null);

	const [showAddModal, setShowAddModal] = useState(false);
	const [modalForm, setModalForm] = useState<ServiceForm>(() => emptyForm());
	const [modalSaving, setModalSaving] = useState(false);
	const [modalActs, setModalActs] = useState<ActItem[]>([]);
	const [modalActsLoading, setModalActsLoading] = useState(false);

	const [problemList, setProblemList] = useState<ProblemItem[]>([]);
	const [currentEmpnm, setCurrentEmpnm] = useState("");

	const exitEditMode = () => {
		setIsEditMode(false);
		setEditingBackup(null);
	};

	useEffect(() => {
		const loadUser = async () => {
			try {
				const res = await fetch("/api/auth/user-info", {
					credentials: "include",
					cache: "no-store",
				});
				const json = await res.json().catch(() => ({}));
				const name = String(json?.data?.empnm ?? json?.data?.EMPNM ?? "").trim();
				setCurrentEmpnm(name);
			} catch (e) {
				console.error(e);
			}
		};
		const loadProblems = async () => {
			try {
				const res = await fetch("/api/f20020", { cache: "no-store" });
				const json = await res.json().catch(() => ({}));
				const list: ProblemItem[] = Array.isArray(json?.data)
					? json.data.map((r: ProblemItem) => ({
							HCACDB: String(r.HCACDB || "").trim(),
							HCABNM: String(r.HCABNM || "").trim(),
						}))
					: [];
				setProblemList(list);
			} catch (e) {
				console.error("문제목록 조회 오류:", e);
				setProblemList([]);
			}
		};
		loadUser();
		loadProblems();
	}, []);

	const fetchActsByProblem = async (hcacdb: string): Promise<ActItem[]> => {
		if (!hcacdb) return [];
		try {
			const res = await fetch(`/api/f20110?hcacdb=${encodeURIComponent(hcacdb)}`, {
				cache: "no-store",
			});
			const json = await res.json().catch(() => ({}));
			return Array.isArray(json?.data)
				? json.data.map((r: ActItem) => ({
						HCACDC: String(r.HCACDC || "").trim(),
						HCACNM: String(r.HCACNM || "").trim(),
						HCACDB: String(r.HCACDB || "").trim(),
					}))
				: [];
		} catch (e) {
			console.error("장기요양서비스행위 조회 오류:", e);
			return [];
		}
	};

	const applyRowToForm = (row: ServiceRow): ServiceForm => ({
		HCADT: row.HCADT || todayYmd(),
		HCACDB: String(row.HCACDB || "").trim(),
		HCABNM: row.HCABNM || "",
		HCACDC: String(row.HCACDC || "").trim(),
		HCACNM: row.HCACNM || "",
		HCATM: row.HCATM != null && !Number.isNaN(Number(row.HCATM)) ? String(row.HCATM) : "",
		ETC: row.ETC || "",
		INDT: row.INDT || "",
		INEMPNM: row.INEMPNM || "",
	});

	const fetchList = async (
		pnum: string,
		prefer?: { HCADT: string; HCACDC: string } | null
	) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/f20130?pnum=${encodeURIComponent(pnum)}`, {
				cache: "no-store",
			});
			const json = await res.json();
			const list: ServiceRow[] = Array.isArray(json?.data) ? json.data : [];
			setRows(list);

			if (list.length === 0) {
				setSelectedKey(null);
				setOrigKey(null);
				setFormData(emptyForm());
				setListPage(1);
				return;
			}

			const preferKey = prefer ? rowKey(prefer) : null;
			const targetIndex = preferKey
				? Math.max(
						0,
						list.findIndex((r) => rowKey(r) === preferKey)
					)
				: 0;
			const target = list[targetIndex] || list[0];
			const key = rowKey(target);
			setSelectedKey(key);
			setOrigKey({ HCADT: target.HCADT, HCACDC: String(target.HCACDC || "").trim() });
			setFormData(applyRowToForm(target));
			setListPage(Math.floor(targetIndex / LIST_PAGE_SIZE) + 1);
		} catch (e) {
			console.error("간호서비스 내역 조회 오류:", e);
			setRows([]);
			setSelectedKey(null);
			setOrigKey(null);
			setFormData(emptyForm());
			setListPage(1);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		exitEditMode();
		setShowAddModal(false);
		setListPage(1);
		setSelectedMember(member);
		fetchList(String(member.PNUM));
	};

	// 탭 재활성화: 수급자 선택은 유지하고 서비스 목록만 재조회
	useTabRefresh(() => {
		if (!selectedMember) return;
		void fetchList(
			String(selectedMember.PNUM),
			origKey ? { HCADT: origKey.HCADT, HCACDC: origKey.HCACDC } : null
		);
	});

	const handleSelectRow = (row: ServiceRow) => {
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 이동할까요?")) return;
		exitEditMode();
		const key = rowKey(row);
		setSelectedKey(key);
		setOrigKey({ HCADT: row.HCADT, HCACDC: String(row.HCACDC || "").trim() });
		setFormData(applyRowToForm(row));
	};

	const handleFieldChange = (key: "HCATM" | "ETC", value: string) => {
		if (!isEditMode) return;
		setFormData((prev) => ({ ...prev, [key]: value }));
	};

	const handleModalProblemChange = async (hcacdb: string) => {
		const found = problemList.find((p) => p.HCACDB === hcacdb);
		setModalForm((prev) => ({
			...prev,
			HCACDB: hcacdb,
			HCABNM: found?.HCABNM || "",
			HCACDC: "",
			HCACNM: "",
		}));
		setModalActsLoading(true);
		const acts = await fetchActsByProblem(hcacdb);
		setModalActs(acts);
		setModalActsLoading(false);
	};

	const handleModalActChange = (hcacdc: string) => {
		const found = modalActs.find((a) => a.HCACDC === hcacdc);
		setModalForm((prev) => ({
			...prev,
			HCACDC: hcacdc,
			HCACNM: found?.HCACNM || "",
		}));
	};

	const openAddModal = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 신규 등록을 진행할까요?")) {
			return;
		}
		exitEditMode();
		setModalForm({
			...emptyForm(),
			INEMPNM: currentEmpnm,
		});
		setModalActs([]);
		setShowAddModal(true);
	};

	const closeAddModal = () => {
		if (modalSaving) return;
		setShowAddModal(false);
		setModalForm(emptyForm());
		setModalActs([]);
	};

	const handleModalSave = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!modalForm.HCADT) {
			alert("제공일자를 입력해주세요.");
			return;
		}
		if (!modalForm.HCACDB.trim()) {
			alert("문제목록을 선택해주세요.");
			return;
		}
		if (!modalForm.HCACDC.trim()) {
			alert("장기요양서비스행위를 선택해주세요.");
			return;
		}

		setModalSaving(true);
		try {
			const res = await fetch("/api/f20130", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					HCADT: modalForm.HCADT,
					HCACDC: modalForm.HCACDC.trim(),
					HCACNM: modalForm.HCACNM.trim(),
					HCATM: modalForm.HCATM === "" ? null : Number(modalForm.HCATM),
					ETC: modalForm.ETC.trim(),
					INEMPNM: modalForm.INEMPNM.trim() || currentEmpnm,
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
			setModalActs([]);
			await fetchList(String(selectedMember.PNUM), {
				HCADT: modalForm.HCADT,
				HCACDC: modalForm.HCACDC.trim(),
			});
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
			if (!selectedKey || !origKey) {
				alert("수정할 항목을 목록에서 선택해주세요.");
				return;
			}
			setEditingBackup(JSON.parse(JSON.stringify(formData)) as ServiceForm);
			setIsEditMode(true);
			return;
		}

		if (!origKey) {
			alert("수정할 항목이 없습니다.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/f20130", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					PNUM: selectedMember.PNUM,
					HCADT: origKey.HCADT,
					HCACDC: origKey.HCACDC,
					HCATM: formData.HCATM === "" ? null : Number(formData.HCATM),
					ETC: formData.ETC.trim(),
					INEMPNM: formData.INEMPNM.trim() || currentEmpnm,
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("저장되었습니다");
			const keep = { HCADT: origKey.HCADT, HCACDC: origKey.HCACDC };
			exitEditMode();
			await fetchList(String(selectedMember.PNUM), keep);
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleCancelEdit = () => {
		if (editingBackup) {
			setFormData(JSON.parse(JSON.stringify(editingBackup)) as ServiceForm);
		} else if (selectedKey) {
			const row = rows.find((r) => rowKey(r) === selectedKey);
			if (row) setFormData(applyRowToForm(row));
		}
		exitEditMode();
	};

	const handleDelete = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!origKey) {
			alert("삭제할 항목을 목록에서 선택해주세요.");
			return;
		}
		if (isEditMode && !confirm("수정 중인 내용이 저장되지 않습니다. 삭제를 진행할까요?")) {
			return;
		}
		if (!confirm("선택한 간호서비스 내역을 삭제할까요?")) return;

		setSaving(true);
		try {
			const qs = new URLSearchParams({
				pnum: String(selectedMember.PNUM),
				hcadt: origKey.HCADT,
				hcacdc: origKey.HCACDC,
			});
			const res = await fetch(`/api/f20130?${qs.toString()}`, { method: "DELETE" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			exitEditMode();
			await fetchList(String(selectedMember.PNUM));
		} catch (e) {
			console.error(e);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const editableDisabled = !selectedMember || !isEditMode;
	const rightLocked = !selectedMember;
	const listTotalPages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
	const safeListPage = Math.min(listPage, listTotalPages);
	const pagedRows = rows.slice(
		(safeListPage - 1) * LIST_PAGE_SIZE,
		safeListPage * LIST_PAGE_SIZE
	);

	return (
		<div className="flex flex-col min-h-screen text-black bg-white">
			<div className="flex h-[calc(100vh-56px)]">
				<BeneficiaryListPanel
					selectedMember={selectedMember}
					onSelect={handleSelectMember}
					className="w-1/4"
				/>

				<div className="relative flex flex-col flex-1 overflow-hidden bg-slate-50">
					{rightLocked && (
						<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
							<p className="text-sm font-medium text-blue-900/70">수급자를 선택해주세요</p>
						</div>
					)}

					{/* 상단: 간호서비스 제공 내역 목록 */}
					<div className="flex flex-col border-b border-blue-200 bg-white shrink-0">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">간호서비스 제공 내역</h2>
							<button
								type="button"
								onClick={openAddModal}
								disabled={!selectedMember || saving || modalSaving}
								className="px-3 py-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
							>
								추가
							</button>
						</div>
						<div className="overflow-auto max-h-[280px]">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
									<tr>
										<th className="w-28 px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
											제공일자
										</th>
										<th className="w-44 px-2 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
											문제목록
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
											장기요양서비스행위
										</th>
										<th className="w-16 px-2 py-2 font-semibold text-center text-blue-900">
											시간
										</th>
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
												등록된 간호서비스 내역이 없습니다
											</td>
										</tr>
									) : (
										pagedRows.map((row) => {
											const key = rowKey(row);
											return (
												<tr
													key={key}
													onClick={() => handleSelectRow(row)}
													className={`border-b border-blue-50 cursor-pointer hover:bg-blue-50 ${
														selectedKey === key ? "bg-blue-100" : ""
													}`}
												>
													<td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
														{row.HCADT || "-"}
													</td>
													<td className="px-2 py-2.5 border-r border-blue-100 break-words">
														{row.HCABNM || row.HCACDB || "-"}
													</td>
													<td className="px-3 py-2.5 border-r border-blue-100 break-words">
														{row.HCACNM || row.HCACDC || "-"}
													</td>
													<td className="px-2 py-2.5 text-center whitespace-nowrap">
														{row.HCATM != null ? row.HCATM : "-"}
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
						{rows.length > 0 && (
							<div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-blue-100 bg-white">
								<button
									type="button"
									onClick={() => setListPage(1)}
									disabled={safeListPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{"<<"}
								</button>
								<button
									type="button"
									onClick={() => setListPage((p) => Math.max(1, p - 1))}
									disabled={safeListPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{"<"}
								</button>
								<span className="text-xs text-blue-900">
									{safeListPage}/{listTotalPages}
								</span>
								<button
									type="button"
									onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
									disabled={safeListPage === listTotalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{">"}
								</button>
								<button
									type="button"
									onClick={() => setListPage(listTotalPages)}
									disabled={safeListPage === listTotalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50"
								>
									{">>"}
								</button>
							</div>
						)}
					</div>

					{/* 하단: 간호서비스 상세 */}
					<div className="flex flex-col flex-1 min-h-0 bg-white">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50 shrink-0">
							<h2 className="text-sm font-semibold text-blue-900">간호서비스 상세</h2>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleEditOrSave}
									disabled={!selectedMember || saving || (!isEditMode && !selectedKey)}
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
								<button
									type="button"
									onClick={handleDelete}
									disabled={!selectedMember || saving || !selectedKey}
									className="px-3 py-1 text-xs font-medium border border-red-400 rounded bg-red-100 hover:bg-red-200 text-red-900 disabled:opacity-40"
								>
									삭제
								</button>
							</div>
						</div>
						<div className="flex-1 p-5 overflow-y-auto">
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900">수급자</label>
									<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
										{selectedMember?.P_NM || "-"}
									</div>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900">제공일자</label>
									<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
										{formData.HCADT || "-"}
									</div>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900">문제목록</label>
									<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
										{formData.HCABNM
											? `${formData.HCACDB ? `${formData.HCACDB} - ` : ""}${formData.HCABNM}`
											: formData.HCACDB || "-"}
									</div>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900">
										장기요양서비스행위
									</label>
									<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
										{formData.HCACNM
											? `${formData.HCACDC ? `${formData.HCACDC} - ` : ""}${formData.HCACNM}`
											: formData.HCACDC || "-"}
									</div>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="hcatm">
										서비스제공시간
									</label>
									<input
										id="hcatm"
										type="number"
										min={0}
										value={formData.HCATM}
										onChange={(e) => handleFieldChange("HCATM", e.target.value)}
										disabled={editableDisabled}
										placeholder="분"
										className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="etc">
										비고
									</label>
									<input
										id="etc"
										type="text"
										value={formData.ETC}
										onChange={(e) => handleFieldChange("ETC", e.target.value)}
										disabled={editableDisabled}
										maxLength={100}
										className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900">등록일자</label>
									<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
										{formData.INDT || "-"}
									</div>
								</div>
								<div>
									<label className="block mb-1.5 text-sm font-medium text-blue-900">등록자</label>
									<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
										{formData.INEMPNM || "-"}
									</div>
								</div>
							</div>

							{isEditMode && (
								<p className="mt-6 text-xs text-blue-900/50">
									수정 모드입니다. 서비스제공시간과 비고만 변경할 수 있습니다.
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* 신규 등록 모달 */}
			{showAddModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="w-full max-w-lg p-5 bg-white border border-blue-300 rounded-lg shadow-xl">
						<h3 className="mb-4 text-lg font-semibold text-blue-900">간호서비스 신규 등록</h3>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900">수급자</label>
							<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
								{selectedMember?.P_NM || "-"}
							</div>
						</div>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-hcadt">
								제공일자
							</label>
							<input
								id="modal-hcadt"
								type="date"
								value={modalForm.HCADT}
								onChange={(e) => setModalForm((prev) => ({ ...prev, HCADT: e.target.value }))}
								className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
							/>
						</div>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-hcacdb">
								문제목록
							</label>
							<select
								id="modal-hcacdb"
								value={modalForm.HCACDB}
								onChange={(e) => handleModalProblemChange(e.target.value)}
								className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
								autoFocus
							>
								<option value="">선택하세요</option>
								{problemList.map((p) => (
									<option key={p.HCACDB} value={p.HCACDB}>
										{p.HCACDB}
										{p.HCABNM ? ` - ${p.HCABNM}` : ""}
									</option>
								))}
							</select>
						</div>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-hcacdc">
								장기요양서비스행위
							</label>
							<select
								id="modal-hcacdc"
								value={modalForm.HCACDC}
								onChange={(e) => handleModalActChange(e.target.value)}
								disabled={!modalForm.HCACDB || modalActsLoading}
								className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100 disabled:cursor-not-allowed"
							>
								<option value="">
									{!modalForm.HCACDB
										? "문제목록을 먼저 선택하세요"
										: modalActsLoading
											? "불러오는 중..."
											: modalActs.length === 0
												? "선택 가능한 항목이 없습니다"
												: "선택하세요"}
								</option>
								{modalActs.map((a) => (
									<option key={a.HCACDC} value={a.HCACDC}>
										{a.HCACDC}
										{a.HCACNM ? ` - ${a.HCACNM}` : ""}
									</option>
								))}
							</select>
						</div>

						<div className="mb-3">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-hcatm">
								서비스제공시간
							</label>
							<input
								id="modal-hcatm"
								type="number"
								min={0}
								value={modalForm.HCATM}
								onChange={(e) => setModalForm((prev) => ({ ...prev, HCATM: e.target.value }))}
								placeholder="분"
								className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
							/>
						</div>

						<div className="mb-5">
							<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="modal-etc">
								비고
							</label>
							<input
								id="modal-etc"
								type="text"
								value={modalForm.ETC}
								onChange={(e) => setModalForm((prev) => ({ ...prev, ETC: e.target.value }))}
								maxLength={100}
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

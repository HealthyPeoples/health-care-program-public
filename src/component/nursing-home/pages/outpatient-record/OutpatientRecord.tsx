"use client";

import React, { useEffect, useState } from "react";
import BeneficiaryListPanel, { BeneficiaryMember } from "../../components/BeneficiaryListPanel";
import {
	buildOutpatientFeeHtml,
	openPrintWindow,
	type V11010BPrintRow,
} from "./outpatientRecordPrint";
import {
	buildUnpaidStatementHtml,
	openUnpaidPrintWindow,
	type V11010CPrintRow,
} from "./outpatientUnpaidPrint";

type OutpatientRow = {
	ANCD?: number | string;
	PNUM?: number | string;
	MEDT: string;
	REGU: string;
	MEGU: string;
	MEGYN: string;
	MEGDT: string;
	MEGAMT: number | null;
	MERDSC1: string;
	MERDSC2: string;
	INDT?: string;
	ETC?: string;
	INEMPNM?: string;
	REEMPNM: string;
	MENM: string;
};

type Summary = {
	totalFee: number;
	collected: number;
	unpaid: number;
	count: number;
};

type ModalForm = {
	MEDT: string;
	REGU: string;
	MEGU: string;
	MEGYN: string;
	MEGDT: string;
	MEGAMT: string;
	REEMPNM: string;
	MENM: string;
	MERDSC1: string;
	MERDSC2: string;
};

type ModalMode = "create" | "edit" | "payment" | null;

const LIST_PAGE_SIZE = 8;

function todayYmd() {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function monthRangeFromParts(year: number, monthIndex: number) {
	const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
	const lastDay = new Date(year, monthIndex + 1, 0).getDate();
	const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return { startDate: start, endDate: end };
}

function currentMonthRange() {
	const now = new Date();
	return monthRangeFromParts(now.getFullYear(), now.getMonth());
}

/** baseYmd(YYYY-MM-DD)가 속한 월 기준으로 offset개월 이동 */
function shiftMonthRange(baseYmd: string, offset: number) {
	const base = /^\d{4}-\d{2}-\d{2}$/.test(baseYmd) ? baseYmd : todayYmd();
	const y = Number(base.slice(0, 4));
	const m = Number(base.slice(5, 7)) - 1;
	const dt = new Date(y, m + offset, 1);
	return monthRangeFromParts(dt.getFullYear(), dt.getMonth());
}

function emptyForm(): ModalForm {
	return {
		MEDT: todayYmd(),
		REGU: "1",
		MEGU: "2",
		MEGYN: "2",
		MEGDT: "",
		MEGAMT: "",
		REEMPNM: "",
		MENM: "",
		MERDSC1: "",
		MERDSC2: "",
	};
}

function rowToForm(row: OutpatientRow): ModalForm {
	return {
		MEDT: row.MEDT || todayYmd(),
		REGU: row.REGU === "2" ? "2" : "1",
		MEGU: row.MEGU === "1" ? "1" : "2",
		MEGYN: row.MEGYN === "1" ? "1" : "2",
		MEGDT: row.MEGDT || "",
		MEGAMT: row.MEGAMT != null ? String(row.MEGAMT) : "",
		REEMPNM: row.REEMPNM || "",
		MENM: row.MENM || "",
		MERDSC1: row.MERDSC1 || "",
		MERDSC2: row.MERDSC2 || "",
	};
}

function formatAmount(v: number | null | undefined) {
	if (v == null || Number.isNaN(Number(v))) return "-";
	return Number(v).toLocaleString("ko-KR");
}

function reguLabel(v: string) {
	return String(v).trim() === "2" ? "응급" : "정기";
}

function meguLabel(v: string) {
	return String(v).trim() === "1" ? "자비" : "센터";
}

function isFeeExempt(amt: number | null | undefined) {
	return Number(amt) === 0;
}

function megynLabel(v: string, amt?: number | null) {
	if (isFeeExempt(amt)) return "면제";
	return String(v).trim() === "1" ? "수금" : "미수";
}

function megynTone(v: string, amt?: number | null) {
	if (isFeeExempt(amt)) return "bg-slate-100 text-slate-700 border-slate-300";
	return String(v).trim() === "1"
		? "bg-emerald-100 text-emerald-800 border-emerald-300"
		: "bg-amber-100 text-amber-800 border-amber-300";
}

export default function OutpatientRecord() {
	const [selectedMember, setSelectedMember] = useState<BeneficiaryMember | null>(null);
	const [rows, setRows] = useState<OutpatientRow[]>([]);
	const [summary, setSummary] = useState<Summary>({
		totalFee: 0,
		collected: 0,
		unpaid: 0,
		count: 0,
	});
	const [selectedMedt, setSelectedMedt] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [listPage, setListPage] = useState(1);

	const [startDate, setStartDate] = useState(() => currentMonthRange().startDate);
	const [endDate, setEndDate] = useState(() => currentMonthRange().endDate);

	const [modalMode, setModalMode] = useState<ModalMode>(null);
	const [modalForm, setModalForm] = useState<ModalForm>(() => emptyForm());
	const [origMedt, setOrigMedt] = useState<string | null>(null);
	const [currentEmpnm, setCurrentEmpnm] = useState("");
	const [printLoading, setPrintLoading] = useState(false);
	const [unpaidPrintLoading, setUnpaidPrintLoading] = useState(false);

	const selectedRow = rows.find((r) => r.MEDT === selectedMedt) || null;

	useEffect(() => {
		const loadUser = async () => {
			try {
				const res = await fetch("/api/auth/user-info", {
					credentials: "include",
					cache: "no-store",
				});
				const json = await res.json().catch(() => ({}));
				setCurrentEmpnm(String(json?.data?.empnm ?? json?.data?.EMPNM ?? "").trim());
			} catch (e) {
				console.error(e);
			}
		};
		loadUser();
	}, []);

	const fetchList = async (
		pnum: string,
		preferMedt?: string | null,
		range?: { startDate?: string; endDate?: string }
	) => {
		setLoading(true);
		try {
			const qs = new URLSearchParams({ pnum });
			const s = range?.startDate ?? startDate;
			const e = range?.endDate ?? endDate;
			if (s) qs.set("startDate", s);
			if (e) qs.set("endDate", e);

			const res = await fetch(`/api/f11010?${qs.toString()}`, { cache: "no-store" });
			const json = await res.json().catch(() => ({}));
			const list: OutpatientRow[] = Array.isArray(json?.data) ? json.data : [];
			setRows(list);
			setSummary({
				totalFee: Number(json?.summary?.totalFee) || 0,
				collected: Number(json?.summary?.collected) || 0,
				unpaid: Number(json?.summary?.unpaid) || 0,
				count: Number(json?.summary?.count) || list.length,
			});

			if (list.length === 0) {
				setSelectedMedt(null);
				setListPage(1);
				return;
			}

			const target =
				(preferMedt && list.find((r) => r.MEDT === preferMedt)) || list[0];
			const idx = Math.max(
				0,
				list.findIndex((r) => r.MEDT === target.MEDT)
			);
			setSelectedMedt(target.MEDT);
			setListPage(Math.floor(idx / LIST_PAGE_SIZE) + 1);
		} catch (e) {
			console.error("외래진료 조회 오류:", e);
			setRows([]);
			setSummary({ totalFee: 0, collected: 0, unpaid: 0, count: 0 });
			setSelectedMedt(null);
			setListPage(1);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectMember = (member: BeneficiaryMember) => {
		setModalMode(null);
		setSelectedMember(member);
		setSelectedMedt(null);
		setListPage(1);
	};

	useEffect(() => {
		if (!selectedMember) return;
		if (startDate && endDate && startDate > endDate) return;
		fetchList(String(selectedMember.PNUM), selectedMedt, { startDate, endDate });
		// selectedMedt는 기간 변경 시 유지 선호용이라 deps에서 제외
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedMember?.PNUM, startDate, endDate]);

	const openCreateModal = () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		setOrigMedt(null);
		setModalForm(emptyForm());
		setModalMode("create");
	};

	const openEditModal = () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!selectedRow) {
			alert("수정할 진료내역을 선택해주세요.");
			return;
		}
		setOrigMedt(selectedRow.MEDT);
		setModalForm(rowToForm(selectedRow));
		setModalMode("edit");
	};

	const openPaymentModal = (row: OutpatientRow, e?: React.MouseEvent) => {
		e?.stopPropagation();
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (isFeeExempt(row.MEGAMT) || String(row.MEGYN).trim() === "1") return;
		setSelectedMedt(row.MEDT);
		setOrigMedt(row.MEDT);
		setModalForm(rowToForm(row));
		setModalMode("payment");
	};

	const closeModal = () => {
		if (saving) return;
		setModalMode(null);
		setOrigMedt(null);
		setModalForm(emptyForm());
	};

	const handlePrint = async () => {
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!startDate || !endDate) {
			alert("조사기간을 설정해주세요.");
			return;
		}

		setPrintLoading(true);
		try {
			const qs = new URLSearchParams({
				pnum: String(selectedMember.PNUM),
				startDate,
				endDate,
			});
			const res = await fetch(`/api/v11010b?${qs.toString()}`, { cache: "no-store" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`출력 데이터 조회 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}

			const printRows = (Array.isArray(json?.data) ? json.data : []) as V11010BPrintRow[];
			openPrintWindow(
				buildOutpatientFeeHtml(printRows, {
					startDate,
					endDate,
				})
			);
		} catch (e) {
			console.error(e);
			alert("출력 중 오류가 발생했습니다.");
		} finally {
			setPrintLoading(false);
		}
	};

	const handleUnpaidPrint = async () => {
		setUnpaidPrintLoading(true);
		try {
			const res = await fetch("/api/v11010c?mode=summary", { cache: "no-store" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`미수금내역 조회 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			const printRows = (Array.isArray(json?.data) ? json.data : []) as V11010CPrintRow[];
			openUnpaidPrintWindow(
				buildUnpaidStatementHtml(printRows, { baseDate: todayYmd() })
			);
		} catch (e) {
			console.error(e);
			alert("미수금내역 출력 중 오류가 발생했습니다.");
		} finally {
			setUnpaidPrintLoading(false);
		}
	};

	const handleDelete = async (row: OutpatientRow, e?: React.MouseEvent) => {
		e?.stopPropagation();
		if (!selectedMember) {
			alert("수급자를 선택해주세요.");
			return;
		}
		if (!confirm(`${row.MEDT} 진료내역을 삭제할까요?`)) return;

		setSaving(true);
		try {
			const qs = new URLSearchParams({
				pnum: String(selectedMember.PNUM),
				medt: row.MEDT,
			});
			const res = await fetch(`/api/f11010?${qs.toString()}`, { method: "DELETE" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("삭제되었습니다.");
			await fetchList(String(selectedMember.PNUM));
		} catch (err) {
			console.error(err);
			alert("삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleModalSave = async () => {
		if (!selectedMember || !modalMode) return;

		if (!modalForm.MEDT) {
			alert("진료일자를 입력해주세요.");
			return;
		}
		if (modalMode === "payment" && modalForm.MEGYN === "1" && !modalForm.MEGDT) {
			alert("수금일자를 입력해주세요.");
			return;
		}

		const payload = {
			PNUM: selectedMember.PNUM,
			MEDT: modalForm.MEDT,
			origMEDT: origMedt || modalForm.MEDT,
			REGU: modalForm.REGU,
			MEGU: modalForm.MEGU,
			MEGYN: modalMode === "create" ? modalForm.MEGYN || "2" : modalForm.MEGYN,
			MEGDT: modalForm.MEGYN === "1" ? modalForm.MEGDT : "",
			MEGAMT: modalForm.MEGAMT === "" ? null : Number(String(modalForm.MEGAMT).replace(/,/g, "")),
			REEMPNM: modalForm.REEMPNM.trim(),
			MENM: modalForm.MENM.trim(),
			MERDSC1: modalForm.MERDSC1.trim(),
			MERDSC2: modalForm.MERDSC2.trim(),
			INEMPNM: currentEmpnm,
		};

		if (modalMode === "create") {
			payload.MEGYN = "2";
			payload.MEGDT = "";
		}

		setSaving(true);
		try {
			const isCreate = modalMode === "create";
			const res = await fetch("/api/f11010", {
				method: isCreate ? "POST" : "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
				return;
			}
			alert("저장되었습니다.");
			const keepMedt = modalForm.MEDT;
			closeModal();
			await fetchList(String(selectedMember.PNUM), keepMedt);
		} catch (e) {
			console.error(e);
			alert("저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const rightLocked = !selectedMember;
	const listTotalPages = Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE));
	const safeListPage = Math.min(listPage, listTotalPages);
	const pagedRows = rows.slice(
		(safeListPage - 1) * LIST_PAGE_SIZE,
		safeListPage * LIST_PAGE_SIZE
	);

	const modalTitle =
		modalMode === "create"
			? "진료내역 등록"
			: modalMode === "edit"
				? "진료내역 수정"
				: modalMode === "payment"
					? "수금 등록"
					: "";

	return (
		<div className="flex flex-col min-h-screen text-black bg-white">
			<div className="flex h-[calc(100vh-56px)]">
				<div className="flex flex-col w-1/4 min-w-[240px] border-r border-blue-200 bg-white">
					<div className="px-3 py-2 border-b border-blue-200 bg-blue-50 shrink-0">
						<button
							type="button"
							onClick={handleUnpaidPrint}
							disabled={unpaidPrintLoading}
							className="w-full px-3 py-1.5 text-xs font-medium border border-orange-400 rounded bg-orange-100 hover:bg-orange-200 text-orange-900 disabled:opacity-40"
						>
							{unpaidPrintLoading ? "출력중" : "미수금내역 출력"}
						</button>
					</div>
					<div className="flex-1 min-h-0 overflow-hidden">
						<BeneficiaryListPanel
							selectedMember={selectedMember}
							onSelect={handleSelectMember}
							className="w-full h-full border-r-0"
						/>
					</div>
				</div>

				<div className="relative flex flex-col flex-1 min-w-0 overflow-hidden bg-slate-50">
					{rightLocked && (
						<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
							<p className="text-sm font-medium text-blue-900/70">수급자를 선택해주세요</p>
						</div>
					)}

					{/* 상단 툴바 */}
					<div className="px-4 py-3 border-b border-blue-200 bg-white shrink-0">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h1 className="text-base font-semibold text-blue-900">외래진료비용</h1>
								<p className="mt-0.5 text-xs text-blue-900/60">
									수급자별 외래 진료의뢰·수금 내역을 관리합니다
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={openCreateModal}
									disabled={!selectedMember || saving}
									className="px-3 py-1.5 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
								>
									진료의뢰 추가
								</button>
								<button
									type="button"
									onClick={openEditModal}
									disabled={!selectedMember || !selectedRow || saving}
									className="px-3 py-1.5 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
								>
									진료의뢰 수정
								</button>
								<button
									type="button"
									onClick={handlePrint}
									disabled={!selectedMember || printLoading || saving}
									className="px-3 py-1.5 text-xs font-medium border border-orange-400 rounded bg-orange-100 hover:bg-orange-200 text-orange-900 disabled:opacity-40"
								>
									{printLoading ? "출력중" : "외래진료비 출력"}
								</button>
							</div>
						</div>

						<div className="flex flex-wrap items-end gap-3 mt-3">
							<div>
								<label className="block mb-1 text-xs font-medium text-blue-900">기간</label>
								<div className="flex items-center gap-2">
									<button
										type="button"
										title="지난달"
										onClick={() => {
											const range = shiftMonthRange(startDate || todayYmd(), -1);
											setStartDate(range.startDate);
											setEndDate(range.endDate);
										}}
										className="px-2.5 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
									>
										◁
									</button>
									<input
										type="date"
										value={startDate}
										onChange={(e) => setStartDate(e.target.value)}
										className="px-2 py-1.5 text-sm border border-blue-300 rounded bg-white"
									/>
									<span className="text-blue-900/50">~</span>
									<input
										type="date"
										value={endDate}
										onChange={(e) => setEndDate(e.target.value)}
										className="px-2 py-1.5 text-sm border border-blue-300 rounded bg-white"
									/>
									<button
										type="button"
										title="다음달"
										onClick={() => {
											const range = shiftMonthRange(startDate || todayYmd(), 1);
											setStartDate(range.startDate);
											setEndDate(range.endDate);
										}}
										className="px-2.5 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
									>
										▷
									</button>
								</div>
							</div>
							<button
								type="button"
								onClick={() => {
									const range = currentMonthRange();
									setStartDate(range.startDate);
									setEndDate(range.endDate);
								}}
								className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 text-gray-700"
							>
								이번 달
							</button>
						</div>
					</div>

					{/* 요약 카드 */}
					<div className="grid grid-cols-2 gap-3 px-4 py-3 border-b border-blue-100 bg-white md:grid-cols-4 shrink-0">
						<div className="px-3 py-2 border border-blue-200 rounded-lg bg-blue-50/70">
							<p className="text-xs text-blue-900/60">선택 수급자</p>
							<p className="mt-1 text-sm font-semibold text-blue-900 truncate">
								{selectedMember?.P_NM || "-"}
							</p>
						</div>
						<div className="px-3 py-2 border border-blue-200 rounded-lg bg-white">
							<p className="text-xs text-blue-900/60">진료비 합계</p>
							<p className="mt-1 text-sm font-semibold text-blue-900">
								{formatAmount(summary.totalFee)}원
							</p>
						</div>
						<div className="px-3 py-2 border border-emerald-200 rounded-lg bg-emerald-50/60">
							<p className="text-xs text-emerald-800/70">수금액</p>
							<p className="mt-1 text-sm font-semibold text-emerald-900">
								{formatAmount(summary.collected)}원
							</p>
						</div>
						<div className="px-3 py-2 border border-amber-200 rounded-lg bg-amber-50/60">
							<p className="text-xs text-amber-800/70">미수 잔액</p>
							<p className="mt-1 text-sm font-semibold text-amber-900">
								{formatAmount(summary.unpaid)}원
							</p>
						</div>
					</div>

					{/* 진료 목록 */}
					<div className="flex flex-col border-b border-blue-200 bg-white shrink-0">
						<div className="flex items-center justify-between px-4 py-2 border-b border-blue-100 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">
								진료내역 목록
								<span className="ml-2 text-xs font-normal text-blue-900/50">
									{summary.count}건
								</span>
							</h2>
						</div>
						<div className="overflow-auto max-h-[260px]">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
									<tr>
										<th className="px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-28">
											진료일자
										</th>
										<th className="px-3 py-2 font-semibold text-right text-blue-900 border-r border-blue-200 w-24">
											진료비
										</th>
										<th className="px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-28">
											수금일자
										</th>
										<th className="px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-20">
											외래구분
										</th>
										<th className="px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-20">
											진료비구분
										</th>
										<th className="px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-20">
											수금여부
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
											진료기관
										</th>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-24">
											수금
										</th>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 w-20">
											삭제
										</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={9} className="px-3 py-8 text-center text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : rows.length === 0 ? (
										<tr>
											<td colSpan={9} className="px-3 py-8 text-center text-blue-900/60">
												등록된 외래진료 내역이 없습니다
											</td>
										</tr>
									) : (
										pagedRows.map((row) => {
											const exempt = isFeeExempt(row.MEGAMT);
											const isUnpaid = !exempt && String(row.MEGYN).trim() !== "1";
											return (
												<tr
													key={row.MEDT}
													onClick={() => setSelectedMedt(row.MEDT)}
													className={`border-b border-blue-50 cursor-pointer hover:bg-blue-50 ${
														selectedMedt === row.MEDT ? "bg-blue-100" : ""
													}`}
												>
													<td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
														{row.MEDT || "-"}
													</td>
													<td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-blue-100">
														{formatAmount(row.MEGAMT)}
													</td>
													<td className="px-3 py-2.5 text-center whitespace-nowrap border-r border-blue-100">
														{row.MEGDT || "-"}
													</td>
													<td className="px-3 py-2.5 text-center border-r border-blue-100">
														{reguLabel(row.REGU)}
													</td>
													<td className="px-3 py-2.5 text-center border-r border-blue-100">
														{meguLabel(row.MEGU)}
													</td>
													<td className="px-3 py-2.5 text-center border-r border-blue-100">
														<span
															className={`inline-flex px-2 py-0.5 text-xs font-medium border rounded ${megynTone(row.MEGYN, row.MEGAMT)}`}
														>
															{megynLabel(row.MEGYN, row.MEGAMT)}
														</span>
													</td>
													<td className="px-3 py-2.5 break-words border-r border-blue-100">
														{row.MENM || "-"}
													</td>
													<td className="px-2 py-2 text-center whitespace-nowrap border-r border-blue-100">
														{exempt ? (
															<span className="inline-flex px-2 py-0.5 text-xs font-medium border rounded bg-slate-100 text-slate-700 border-slate-300">
																면제
															</span>
														) : isUnpaid ? (
															<button
																type="button"
																onClick={(e) => openPaymentModal(row, e)}
																disabled={saving}
																className="px-2 py-1 text-xs font-medium border border-emerald-400 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 disabled:opacity-40"
															>
																수금등록
															</button>
														) : null}
													</td>
													<td className="px-2 py-2 text-center whitespace-nowrap">
														<button
															type="button"
															onClick={(e) => handleDelete(row, e)}
															disabled={saving}
															className="px-2 py-1 text-xs font-medium border border-red-400 rounded bg-red-100 hover:bg-red-200 text-red-900 disabled:opacity-40"
														>
															삭제
														</button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
						{rows.length > 0 && (
							<div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-blue-100">
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

					{/* 상세 */}
					<div className="flex flex-col flex-1 min-h-0 bg-white">
						<div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-blue-100 bg-blue-50 shrink-0">
							<h2 className="text-sm font-semibold text-blue-900">진료내역 상세</h2>
							<button
								type="button"
								onClick={openEditModal}
								disabled={!selectedMember || !selectedRow || saving}
								className="px-3 py-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
							>
								수정
							</button>
						</div>
						<div className="flex-1 p-4 overflow-y-auto">
							{!selectedRow ? (
								<p className="py-10 text-sm text-center text-blue-900/50">
									목록에서 진료내역을 선택하면 상세 내용이 표시됩니다
								</p>
							) : (
								<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
									<div>
										<p className="mb-1 text-xs font-medium text-blue-900/70">동행 사원명</p>
										<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-slate-50 min-h-[40px]">
											{selectedRow.REEMPNM || "-"}
										</div>
									</div>
									<div>
										<p className="mb-1 text-xs font-medium text-blue-900/70">진료기관명</p>
										<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-slate-50 min-h-[40px]">
											{selectedRow.MENM || "-"}
										</div>
									</div>
									<div className="md:col-span-2">
										<p className="mb-1 text-xs font-medium text-blue-900/70">진료의뢰내역</p>
										<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-slate-50 min-h-[64px] whitespace-pre-wrap">
											{selectedRow.MERDSC1 || "-"}
										</div>
									</div>
									<div className="md:col-span-2">
										<p className="mb-1 text-xs font-medium text-blue-900/70">진료결과</p>
										<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-slate-50 min-h-[64px] whitespace-pre-wrap">
											{selectedRow.MERDSC2 || "-"}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* 모달: 진료내역 등록/수정 / 수금 등록 */}
			{modalMode && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
					<div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-blue-300 rounded-lg shadow-xl">
						<div className="sticky top-0 z-10 px-5 py-3 border-b border-blue-200 bg-blue-50">
							<h3 className="text-lg font-semibold text-blue-900">{modalTitle}</h3>
						</div>

						<div className="px-5 py-4 space-y-3">
							<div>
								<label className="block mb-1 text-sm font-medium text-blue-900">수급자명</label>
								<div className="px-3 py-2 text-sm border border-blue-200 rounded bg-blue-50 text-blue-900">
									{selectedMember?.P_NM || "-"}
								</div>
							</div>

							<div>
								<label className="block mb-1 text-sm font-medium text-blue-900" htmlFor="modal-medt">
									진료일자
								</label>
								<input
									id="modal-medt"
									type="date"
									value={modalForm.MEDT}
									onChange={(e) => setModalForm((p) => ({ ...p, MEDT: e.target.value }))}
									disabled={modalMode !== "create"}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100"
								/>
							</div>

							<div>
								<p className="mb-1.5 text-sm font-medium text-blue-900">의뢰구분</p>
								<div className="flex gap-4">
									<label className="inline-flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="regu"
											checked={modalForm.REGU === "1"}
											onChange={() => setModalForm((p) => ({ ...p, REGU: "1" }))}
										/>
										정기
									</label>
									<label className="inline-flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="regu"
											checked={modalForm.REGU === "2"}
											onChange={() => setModalForm((p) => ({ ...p, REGU: "2" }))}
										/>
										응급
									</label>
								</div>
							</div>

							<div>
								<p className="mb-1.5 text-sm font-medium text-blue-900">진료비구분</p>
								<div className="flex gap-4">
									<label className="inline-flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="megu"
											checked={modalForm.MEGU === "2"}
											onChange={() => setModalForm((p) => ({ ...p, MEGU: "2" }))}
										/>
										센터
									</label>
									<label className="inline-flex items-center gap-2 text-sm">
										<input
											type="radio"
											name="megu"
											checked={modalForm.MEGU === "1"}
											onChange={() => setModalForm((p) => ({ ...p, MEGU: "1" }))}
										/>
										자비
									</label>
								</div>
							</div>

							<div>
								<label className="block mb-1 text-sm font-medium text-blue-900" htmlFor="modal-megamt">
									진료비
								</label>
								<input
									id="modal-megamt"
									type="number"
									min={0}
									value={modalForm.MEGAMT}
									onChange={(e) => setModalForm((p) => ({ ...p, MEGAMT: e.target.value }))}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
									placeholder="금액 입력"
								/>
							</div>

							{modalMode === "payment" && (
								<>
									<div>
										<p className="mb-1.5 text-sm font-medium text-blue-900">진료비 수금여부</p>
										<div className="flex gap-4">
											<label className="inline-flex items-center gap-2 text-sm">
												<input
													type="radio"
													name="megyn"
													checked={modalForm.MEGYN === "1"}
													onChange={() =>
														setModalForm((p) => ({
															...p,
															MEGYN: "1",
															MEGDT: p.MEGDT || todayYmd(),
														}))
													}
												/>
												수금
											</label>
											<label className="inline-flex items-center gap-2 text-sm">
												<input
													type="radio"
													name="megyn"
													checked={modalForm.MEGYN === "2"}
													onChange={() =>
														setModalForm((p) => ({ ...p, MEGYN: "2", MEGDT: "" }))
													}
												/>
												미수
											</label>
										</div>
									</div>
									<div>
										<label
											className="block mb-1 text-sm font-medium text-blue-900"
											htmlFor="modal-megdt"
										>
											진료비 수금일자
										</label>
										<input
											id="modal-megdt"
											type="date"
											value={modalForm.MEGDT}
											onChange={(e) => setModalForm((p) => ({ ...p, MEGDT: e.target.value }))}
											disabled={modalForm.MEGYN !== "1"}
											className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100"
										/>
									</div>
								</>
							)}

							{modalMode !== "payment" && (
								<>
									<div>
										<label
											className="block mb-1 text-sm font-medium text-blue-900"
											htmlFor="modal-reempnm"
										>
											외래동행사원명
										</label>
										<input
											id="modal-reempnm"
											type="text"
											value={modalForm.REEMPNM}
											onChange={(e) => setModalForm((p) => ({ ...p, REEMPNM: e.target.value }))}
											maxLength={50}
											className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
										/>
									</div>

									<div>
										<label
											className="block mb-1 text-sm font-medium text-blue-900"
											htmlFor="modal-menm"
										>
											진료기관명
										</label>
										<input
											id="modal-menm"
											type="text"
											value={modalForm.MENM}
											onChange={(e) => setModalForm((p) => ({ ...p, MENM: e.target.value }))}
											maxLength={100}
											className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded"
										/>
									</div>

									<div>
										<label
											className="block mb-1 text-sm font-medium text-blue-900"
											htmlFor="modal-merdsc1"
										>
											진료의뢰내역
										</label>
										<textarea
											id="modal-merdsc1"
											value={modalForm.MERDSC1}
											onChange={(e) => setModalForm((p) => ({ ...p, MERDSC1: e.target.value }))}
											maxLength={200}
											rows={2}
											className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded resize-y"
										/>
									</div>

									<div>
										<label
											className="block mb-1 text-sm font-medium text-blue-900"
											htmlFor="modal-merdsc2"
										>
											진료결과
										</label>
										<textarea
											id="modal-merdsc2"
											value={modalForm.MERDSC2}
											onChange={(e) => setModalForm((p) => ({ ...p, MERDSC2: e.target.value }))}
											maxLength={200}
											rows={2}
											className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded resize-y"
										/>
									</div>
								</>
							)}
						</div>

						<div className="sticky bottom-0 flex justify-end gap-2 px-5 py-3 border-t border-blue-200 bg-white">
							<button
								type="button"
								onClick={handleModalSave}
								disabled={saving}
								className="px-5 py-1.5 text-sm font-medium border border-green-400 rounded bg-green-100 hover:bg-green-200 text-green-900 disabled:opacity-50"
							>
								{saving ? "저장중" : "저장"}
							</button>
							<button
								type="button"
								onClick={closeModal}
								disabled={saving}
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

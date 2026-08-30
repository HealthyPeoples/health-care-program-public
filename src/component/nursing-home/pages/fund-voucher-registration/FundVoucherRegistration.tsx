"use client";

/**
 * @file 입출금 전표등록 — 화면 컴포넌트 (FundVoucherRegistration.tsx)
 *
 * @description
 * 요양원 입출금 전표등록 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/fund-voucher-registration
 *
 * @module component/nursing-home/pages/fund-voucher-registration/FundVoucherRegistration
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	buildExpenseResolutionPrintHtml,
	buildIncomeStatementPrintHtml,
	openPrintPreviewWindow,
} from "./fundVoucherPrint";

type DocType = "in" | "out" | "all";
type ModalMode = "in" | "out" | "edit";
type PrintKind = "in" | "out";

interface AccountRow {
	OBJ3: string;
	OBJ3NM?: string;
	ETC?: string;
	ANI?: string;
	DEL?: string;
}

interface VoucherRow {
	ANCD: number | string;
	DOC: number;
	AMT: number;
	OBJ3: string;
	OBJ3NM?: string;
	OBJETC?: string;
	ANI?: string;
	DOC_TYPE: "in" | "out";
	GLDT: string | null;
	DES: string;
	ETC: string;
	INVNM: string;
	INVNM1: string;
	INVOJ: string;
	INVDT: string | null;
	EMPNO?: number | null;
	EMPNM?: string;
}

interface FormState {
	gldt: string;
	invdt: string;
	obj3: string;
	amt: string;
	des: string;
	invnm: string;
	invnm1: string;
	invoj: string;
	etc: string;
}

const ITEMS_PER_PAGE = 10;
const PAGE_NUMBER_BLOCK = 5;

function todayYmd(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function yearStartYmd(): string {
	return `${new Date().getFullYear()}-01-01`;
}

function formatYmd(v: unknown): string {
	if (v == null || v === "") return "";
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	if (s.includes("T")) return s.split("T")[0] ?? "";
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const head = s.slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : "";
}

function formatAmount(v: number | null | undefined): string {
	if (v == null || Number.isNaN(Number(v))) return "";
	return Math.abs(Number(v)).toLocaleString("ko-KR");
}

function parseAmountInput(v: string): number {
	const n = parseFloat(String(v).replace(/,/g, ""));
	return Number.isFinite(n) ? n : 0;
}

function classifyAccount(acc: Pick<AccountRow, "OBJ3" | "OBJ3NM" | "ANI">): "in" | "out" {
	const ani = String(acc.ANI ?? "").trim().toUpperCase();
	if (ani.startsWith("I") || ani === "1") return "in";
	if (ani.startsWith("E") || ani.startsWith("O") || ani === "2") return "out";
	const code = String(acc.OBJ3 ?? "").trim().toUpperCase();
	if (code.startsWith("I")) return "in";
	if (code.startsWith("E") || code.startsWith("O")) return "out";
	const nm = String(acc.OBJ3NM ?? "");
	if (/수입|입금/.test(nm)) return "in";
	if (/지출|출금|급여/.test(nm)) return "out";
	return "in";
}

const emptyForm = (): FormState => ({
	gldt: todayYmd(),
	invdt: todayYmd(),
	obj3: "",
	amt: "",
	des: "",
	invnm: "",
	invnm1: "",
	invoj: "",
	etc: "",
});

function rowToForm(row: VoucherRow): FormState {
	return {
		gldt: formatYmd(row.GLDT) || todayYmd(),
		invdt: formatYmd(row.INVDT) || formatYmd(row.GLDT) || todayYmd(),
		obj3: String(row.OBJ3 ?? ""),
		amt: formatAmount(row.AMT),
		des: row.DES ?? "",
		invnm: row.INVNM ?? "",
		invnm1: row.INVNM1 ?? "",
		invoj: row.INVOJ ?? "",
		etc: row.ETC ?? "",
	};
}

const btnBlue =
	"rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50";
const btnGreen =
	"rounded border border-green-400 bg-green-100 px-2.5 py-1 text-xs font-medium text-green-900 hover:bg-green-200 disabled:opacity-50";
const btnRed =
	"rounded border border-red-400 bg-red-100 px-2.5 py-1 text-xs font-medium text-red-900 hover:bg-red-200 disabled:opacity-50";
const inputCls =
	"rounded border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none disabled:bg-gray-50";

export default function FundVoucherRegistration() {
	const [docType, setDocType] = useState<DocType>("in");
	const [fromDate, setFromDate] = useState(yearStartYmd);
	const [toDate, setToDate] = useState(todayYmd);
	const [appliedType, setAppliedType] = useState<DocType>("in");
	const [appliedFrom, setAppliedFrom] = useState(yearStartYmd);
	const [appliedTo, setAppliedTo] = useState(todayYmd);

	const [rows, setRows] = useState<VoucherRow[]>([]);
	const [accounts, setAccounts] = useState<AccountRow[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageWindowStart, setPageWindowStart] = useState(1);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [userEmp, setUserEmp] = useState<{ empno?: number | string; empnm?: string }>({});

	const [modalMode, setModalMode] = useState<ModalMode | null>(null);
	const [editingRow, setEditingRow] = useState<VoucherRow | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm);

	const [printKind, setPrintKind] = useState<PrintKind | null>(null);
	const [printFrom, setPrintFrom] = useState(yearStartYmd);
	const [printTo, setPrintTo] = useState(todayYmd);
	const [printing, setPrinting] = useState(false);

	const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
	const maxPageWindowStart = useMemo(() => {
		if (totalPages <= 1) return 1;
		return Math.floor((totalPages - 1) / PAGE_NUMBER_BLOCK) * PAGE_NUMBER_BLOCK + 1;
	}, [totalPages]);
	const pageNumbers = useMemo(() => {
		const end = Math.min(pageWindowStart + PAGE_NUMBER_BLOCK - 1, totalPages);
		if (pageWindowStart > totalPages) return [];
		return Array.from({ length: end - pageWindowStart + 1 }, (_, i) => pageWindowStart + i);
	}, [pageWindowStart, totalPages]);
	const currentRows = useMemo(() => {
		const start = (currentPage - 1) * ITEMS_PER_PAGE;
		return rows.slice(start, start + ITEMS_PER_PAGE);
	}, [rows, currentPage]);

	const loadRows = useCallback(async (type: DocType, from: string, to: string) => {
		setLoading(true);
		setError(null);
		try {
			const qs = new URLSearchParams();
			if (from) qs.set("from", from);
			if (to) qs.set("to", to);
			if (type !== "all") qs.set("type", type);
			const res = await fetch(`/api/f90099?${qs.toString()}`, {
				credentials: "include",
				cache: "no-store",
			});
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "전표 목록 조회에 실패했습니다.");
			}
			const list: VoucherRow[] = (Array.isArray(json.data) ? json.data : []).map((r: VoucherRow) => ({
				...r,
				GLDT: formatYmd(r.GLDT),
				INVDT: formatYmd(r.INVDT),
				DOC_TYPE: r.DOC_TYPE === "out" ? "out" : "in",
			}));
			setRows(list);
			setAppliedType(type);
			setAppliedFrom(from);
			setAppliedTo(to);
			setCurrentPage(1);
			setPageWindowStart(1);
		} catch (e) {
			setRows([]);
			setError(e instanceof Error ? e.message : "전표 목록 조회 중 오류가 발생했습니다.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadRows(docType, fromDate, toDate);
		(async () => {
			try {
				const [userRes, accRes] = await Promise.all([
					fetch("/api/auth/user-info", { credentials: "include", cache: "no-store" }),
					fetch("/api/f90030", { credentials: "include", cache: "no-store" }),
				]);
				const userJson = await userRes.json();
				if (userJson?.success && userJson?.data) {
					setUserEmp({ empno: userJson.data.empno, empnm: userJson.data.empnm });
				}
				const accJson = await accRes.json();
				if (accJson?.success && Array.isArray(accJson.data)) {
					setAccounts(accJson.data);
				}
			} catch {
				// ignore
			}
		})();
		// 최초 1회
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		setCurrentPage((p) => Math.min(p, totalPages));
		setPageWindowStart((s) => Math.min(s, maxPageWindowStart));
	}, [totalPages, maxPageWindowStart]);

	const modalDocType: "in" | "out" = modalMode === "out" || (modalMode === "edit" && editingRow?.DOC_TYPE === "out")
		? "out"
		: "in";

	const accountOptions = useMemo(() => {
		const typed = accounts.filter((a) => classifyAccount(a) === modalDocType);
		return typed.length > 0 ? typed : accounts;
	}, [accounts, modalDocType]);

	const selectedAccount = useMemo(
		() => accounts.find((a) => a.OBJ3 === form.obj3) || null,
		[accounts, form.obj3],
	);

	const closeModal = () => {
		setModalMode(null);
		setEditingRow(null);
		setForm(emptyForm());
	};

	const handleOpenCreate = (type: "in" | "out") => {
		setEditingRow(null);
		const next = emptyForm();
		const opts = accounts.filter((a) => classifyAccount(a) === type);
		if (opts[0]) next.obj3 = opts[0].OBJ3;
		setForm(next);
		setModalMode(type);
	};

	const handleOpenEdit = (row: VoucherRow) => {
		setEditingRow(row);
		setForm(rowToForm(row));
		setModalMode("edit");
	};

	const handleSearch = () => {
		if (fromDate && toDate && fromDate > toDate) {
			alert("전표일자 시작일이 종료일보다 늦을 수 없습니다.");
			return;
		}
		void loadRows(docType, fromDate, toDate);
	};

	const handleSave = async () => {
		if (!form.gldt) {
			alert("전표일자를 입력해 주세요.");
			return;
		}
		if (!form.obj3) {
			alert("계정과목을 선택해 주세요.");
			return;
		}
		if (!form.amt || parseAmountInput(form.amt) <= 0) {
			alert("금액을 입력해 주세요.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const saveType = modalMode === "edit" ? (editingRow?.DOC_TYPE ?? "in") : modalDocType;
			const res = await fetch("/api/f90099", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					DOC: editingRow?.DOC,
					docType: saveType,
					GLDT: form.gldt,
					INVDT: form.invdt || form.gldt,
					OBJ3: form.obj3,
					AMT: parseAmountInput(form.amt),
					DES: form.des,
					INVNM: form.invnm,
					INVNM1: form.invnm1,
					INVOJ: form.invoj,
					ETC: form.etc,
					EMPNO: userEmp.empno ?? null,
					EMPNM: userEmp.empnm ?? null,
				}),
			});
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "저장에 실패했습니다.");
			}
			await loadRows(appliedType, appliedFrom, appliedTo);
			closeModal();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
			setError(msg);
			alert(msg);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (row: VoucherRow) => {
		if (!confirm(`전표번호 ${row.DOC}을(를) 삭제하시겠습니까?`)) return;
		setSaving(true);
		setError(null);
		try {
			const res = await fetch("/api/f90099", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "delete", DOC: row.DOC }),
			});
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "삭제에 실패했습니다.");
			}
			if (editingRow?.DOC === row.DOC) closeModal();
			await loadRows(appliedType, appliedFrom, appliedTo);
		} catch (e) {
			const msg = e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.";
			setError(msg);
			alert(msg);
		} finally {
			setSaving(false);
		}
	};

	const handlePageChange = (page: number) => {
		const p = Math.max(1, Math.min(page, totalPages));
		setCurrentPage(p);
		setPageWindowStart(Math.floor((p - 1) / PAGE_NUMBER_BLOCK) * PAGE_NUMBER_BLOCK + 1);
	};

	const openPrint = (kind: PrintKind) => {
		setPrintKind(kind);
		setPrintFrom(appliedFrom || fromDate);
		setPrintTo(appliedTo || toDate);
	};

	const handlePrint = async () => {
		if (!printKind) return;
		if (printFrom && printTo && printFrom > printTo) {
			alert("출력 시작일이 종료일보다 늦을 수 없습니다.");
			return;
		}
		setPrinting(true);
		try {
			const qs = new URLSearchParams();
			if (printFrom) qs.set("from", printFrom);
			if (printTo) qs.set("to", printTo);
			qs.set("type", printKind);
			const res = await fetch(`/api/f90099?${qs.toString()}`, {
				credentials: "include",
				cache: "no-store",
			});
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "출력 자료 조회에 실패했습니다.");
			}
			const list: VoucherRow[] = Array.isArray(json.data) ? json.data : [];
			if (list.length === 0) {
				alert("해당 기간에 출력할 전표가 없습니다.");
				return;
			}
			const html =
				printKind === "out"
					? buildExpenseResolutionPrintHtml(list)
					: buildIncomeStatementPrintHtml(list);
			openPrintPreviewWindow(html);
			setPrintKind(null);
		} catch (e) {
			alert(e instanceof Error ? e.message : "출력 중 오류가 발생했습니다.");
		} finally {
			setPrinting(false);
		}
	};

	const modalTitle =
		modalMode === "in" ? "입금 전표 등록" : modalMode === "out" ? "출금 전표 등록" : "입출금 전표 수정";
	const dateLabel = modalMode === "in" ? "입금일자" : modalMode === "out" ? "출금일자" : "입출금일자";
	const amtLabel = modalMode === "in" ? "입금금액" : modalMode === "out" ? "출금금액" : "금액";

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="border-b border-blue-200 bg-blue-50/50 px-6 py-4">
				<h1 className="text-center text-lg font-semibold text-blue-900">입출금전표등록</h1>
			</div>

			<div className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-white px-4 py-3">
				<div className="flex items-center gap-2">
					<label className="text-sm font-medium text-blue-900">전표일자</label>
					<input
						type="date"
						value={fromDate}
						onChange={(e) => setFromDate(e.target.value)}
						className={inputCls}
					/>
					<span className="text-blue-900">~</span>
					<input
						type="date"
						value={toDate}
						onChange={(e) => setToDate(e.target.value)}
						className={inputCls}
					/>
				</div>
				<button type="button" onClick={handleSearch} disabled={loading} className={btnBlue}>
					{loading ? "조회 중..." : "검색"}
				</button>
			</div>

			<div className="flex flex-wrap items-center gap-2 px-4 py-3">
				<button type="button" onClick={() => handleOpenCreate("in")} disabled={saving} className={btnBlue}>
					입금전표등록
				</button>
				<button type="button" onClick={() => handleOpenCreate("out")} disabled={saving} className={btnBlue}>
					출금전표등록
				</button>
				<button type="button" onClick={() => openPrint("out")} className={btnBlue}>
					지출결의서출력
				</button>
				<button type="button" onClick={() => openPrint("in")} className={btnBlue}>
					수입내역서출력
				</button>
			</div>

			{error && (
				<div className="mx-4 mb-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
					{error}
				</div>
			)}

			<div className="flex flex-1 flex-col px-4 pb-4">
				<div className="mb-2 flex items-center gap-2">
					<label className="text-sm font-medium text-blue-900" htmlFor="fund-doc-type">
						문서유형
					</label>
					<select
						id="fund-doc-type"
						value={docType}
						onChange={(e) => {
							const next = e.target.value as DocType;
							setDocType(next);
							void loadRows(next, fromDate, toDate);
						}}
						className={inputCls}
					>
						<option value="in">입금</option>
						<option value="out">출금</option>
						<option value="all">전체</option>
					</select>
				</div>
				<div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-blue-300 bg-white">
					<div className="flex-1 overflow-x-auto overflow-y-auto w-full min-w-0">
						<table className="w-full table-fixed text-sm">
							<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-100">
								<tr>
									<th className="w-[9%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										전표번호
									</th>
									<th className="w-[12%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										전표일자
									</th>
									<th className="w-[10%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										계정과목
									</th>
									<th className="w-[16%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										계정과목명
									</th>
									<th className="w-[18%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										적요
									</th>
									<th className="w-[11%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										입금금액
									</th>
									<th className="w-[11%] border-r border-blue-200 px-3 py-2 text-center font-semibold text-blue-900">
										출금금액
									</th>
									<th className="w-[13%] px-3 py-2 text-center font-semibold text-blue-900">관리</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={8} className="px-3 py-8 text-center text-blue-900/60">
											불러오는 중...
										</td>
									</tr>
								) : currentRows.length === 0 ? (
									<tr>
										<td colSpan={8} className="px-3 py-8 text-center text-blue-900/60">
											조회된 전표가 없습니다.
										</td>
									</tr>
								) : (
									currentRows.map((row) => (
										<tr key={`${row.ANCD}-${row.DOC}`} className="border-b border-blue-50 hover:bg-blue-50/50">
											<td className="border-r border-blue-100 px-3 py-2 text-center tabular-nums">
												{row.DOC}
											</td>
											<td className="border-r border-blue-100 px-3 py-2 text-center">
												{formatYmd(row.GLDT) || "-"}
											</td>
											<td className="border-r border-blue-100 px-3 py-2 text-center">{row.OBJ3}</td>
											<td className="border-r border-blue-100 px-3 py-2 truncate" title={row.OBJ3NM || ""}>
												{row.OBJ3NM || ""}
											</td>
											<td className="border-r border-blue-100 px-3 py-2 truncate" title={row.DES}>
												{row.DES}
											</td>
											<td className="border-r border-blue-100 px-3 py-2 text-right tabular-nums">
												{row.DOC_TYPE === "in" ? formatAmount(row.AMT) : ""}
											</td>
											<td className="border-r border-blue-100 px-3 py-2 text-right tabular-nums">
												{row.DOC_TYPE === "out" ? formatAmount(row.AMT) : ""}
											</td>
											<td className="px-3 py-2">
												<div className="flex items-center justify-center gap-1">
													<button
														type="button"
														onClick={() => handleOpenEdit(row)}
														disabled={saving}
														className={btnGreen}
													>
														수정
													</button>
													<button
														type="button"
														onClick={() => void handleDelete(row)}
														disabled={saving}
														className={btnRed}
													>
														삭제
													</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					{rows.length > ITEMS_PER_PAGE && (
						<div className="border-t border-blue-200 bg-white p-2">
							<div className="flex flex-wrap items-center justify-center gap-2 text-sm text-blue-900">
								<span className="tabular-nums">
									{currentPage} / {totalPages} (총 {rows.length}건)
								</span>
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => {
											setPageWindowStart(1);
											setCurrentPage(1);
										}}
										disabled={currentPage === 1}
										className="rounded border border-blue-300 px-2 py-1 text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{"<<"}
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(currentPage - 1)}
										disabled={currentPage === 1}
										className="rounded border border-blue-300 px-2 py-1 text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{"<"}
									</button>
									{pageNumbers.map((pageNum) => (
										<button
											key={pageNum}
											type="button"
											onClick={() => handlePageChange(pageNum)}
											className={`min-w-[2rem] rounded border px-2 py-1 text-sm tabular-nums ${
												currentPage === pageNum
													? "border-blue-500 bg-blue-500 font-semibold text-white"
													: "border-blue-300 hover:bg-blue-50"
											}`}
										>
											{pageNum}
										</button>
									))}
									<button
										type="button"
										onClick={() => handlePageChange(currentPage + 1)}
										disabled={currentPage === totalPages}
										className="rounded border border-blue-300 px-2 py-1 text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{">"}
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(totalPages)}
										disabled={currentPage === totalPages}
										className="rounded border border-blue-300 px-2 py-1 text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{">>"}
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{modalMode && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div
						className="w-full max-w-2xl rounded-lg border border-blue-300 bg-white shadow-lg"
						role="dialog"
						aria-modal="true"
						aria-labelledby="fund-voucher-modal-title"
					>
						<div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-3">
							<h2 id="fund-voucher-modal-title" className="text-base font-semibold text-blue-900">
								{modalTitle}
							</h2>
							<div className="flex gap-2">
								<button type="button" onClick={() => void handleSave()} disabled={saving} className={btnBlue}>
									{saving ? "저장 중..." : "저장"}
								</button>
								<button
									type="button"
									onClick={closeModal}
									disabled={saving}
									className="rounded border border-gray-400 bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
								>
									닫기
								</button>
							</div>
						</div>

						<div className="flex flex-col gap-3 p-4">
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">{dateLabel}</label>
								<input
									type="date"
									value={form.gldt}
									onChange={(e) => setForm((p) => ({ ...p, gldt: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">발의 및 원인행위일자</label>
								<input
									type="date"
									value={form.invdt}
									onChange={(e) => setForm((p) => ({ ...p, invdt: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">계정과목</label>
								<select
									value={form.obj3}
									onChange={(e) => setForm((p) => ({ ...p, obj3: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								>
									<option value="">선택</option>
									{accountOptions.map((a) => (
										<option key={a.OBJ3} value={a.OBJ3}>
											{`${a.OBJ3} ${a.OBJ3NM ?? ""}`.trim()}
										</option>
									))}
								</select>
							</div>
							<div className="flex items-start gap-2">
								<label className="w-40 shrink-0 pt-1.5 text-sm font-medium text-blue-900">계정내용</label>
								<textarea
									value={selectedAccount?.ETC ?? editingRow?.OBJETC ?? ""}
									readOnly
									rows={3}
									className={`flex-1 resize-none ${inputCls} bg-blue-50/40`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">{amtLabel}</label>
								<input
									type="text"
									inputMode="decimal"
									value={form.amt}
									onChange={(e) => setForm((p) => ({ ...p, amt: e.target.value }))}
									onBlur={() =>
										setForm((p) => ({
											...p,
											amt: p.amt ? formatAmount(parseAmountInput(p.amt)) : "",
										}))
									}
									placeholder="0"
									disabled={saving}
									className={`flex-1 ${inputCls} text-right`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">적요</label>
								<input
									type="text"
									maxLength={200}
									value={form.des}
									onChange={(e) => setForm((p) => ({ ...p, des: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">거래처</label>
								<input
									type="text"
									maxLength={200}
									value={form.invnm}
									onChange={(e) => setForm((p) => ({ ...p, invnm: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">성명(대표)</label>
								<input
									type="text"
									maxLength={100}
									value={form.invnm1}
									onChange={(e) => setForm((p) => ({ ...p, invnm1: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">결재방법</label>
								<input
									type="text"
									maxLength={50}
									value={form.invoj}
									onChange={(e) => setForm((p) => ({ ...p, invoj: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-40 shrink-0 text-sm font-medium text-blue-900">비고</label>
								<input
									type="text"
									maxLength={100}
									value={form.etc}
									onChange={(e) => setForm((p) => ({ ...p, etc: e.target.value }))}
									disabled={saving}
									className={`flex-1 ${inputCls}`}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{printKind && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md rounded-lg border border-blue-300 bg-white shadow-lg" role="dialog" aria-modal="true">
						<div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
							<h2 className="text-base font-semibold text-blue-900">
								{printKind === "out" ? "지출결의서 출력" : "수입내역서 출력"}
							</h2>
						</div>
						<div className="flex flex-col gap-3 p-4">
							<p className="text-sm text-blue-900/80">출력할 전표일자 기간을 선택해 주세요.</p>
							<div className="flex items-center gap-2">
								<input
									type="date"
									value={printFrom}
									onChange={(e) => setPrintFrom(e.target.value)}
									className={inputCls}
								/>
								<span>~</span>
								<input
									type="date"
									value={printTo}
									onChange={(e) => setPrintTo(e.target.value)}
									className={inputCls}
								/>
							</div>
						</div>
						<div className="flex justify-end gap-2 border-t border-blue-200 bg-blue-50/40 px-4 py-3">
							<button
								type="button"
								onClick={() => setPrintKind(null)}
								disabled={printing}
								className="rounded border border-gray-400 bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
							>
								취소
							</button>
							<button type="button" onClick={() => void handlePrint()} disabled={printing} className={btnBlue}>
								{printing ? "준비 중..." : "출력"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

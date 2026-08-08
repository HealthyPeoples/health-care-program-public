"use client";

/**
 * @file 시설업무일지 — 화면 컴포넌트 (FacilityWorkLog.tsx)
 *
 * @description
 * 요양원 시설업무일지 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/facility-work-log
 *
 * @module component/nursing-home/pages/facility-work-log/FacilityWorkLog
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	buildFacilityWorkLogPrintHtml,
	openPrintPreviewWindow,
	type FacilityWorkLogPrintData,
} from "./facilityWorkLogPrint";

type UserInfo = {
	ancd?: string | number;
	annm?: string;
	empnm?: string;
	empno?: string | number;
};

interface WorkLogForm {
	jodt: string;
	fcnt: string;
	hcnt: string;
	scnt: string;
	ncnt: string;
	ecnt: string;
	svnm: string;
	jdes: string;
	otdes: string;
	ordes1: string;
	ordes1nm: string;
	ordes2: string;
	ordes2nm: string;
	ordes3: string;
	ordes3nm: string;
	ordes4: string;
	ordes4nm: string;
	prc1: string;
	prc2: string;
	prc3: string;
	prc4: string;
}

interface WorkLogRow extends WorkLogForm {
	ancd?: string | number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function formatDateYmd(value: unknown): string {
	if (value == null || value === "") return "";
	if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);
	const s = String(value).trim();
	if (!s) return "";
	if (s.includes("T")) return s.split("T")[0].slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s.slice(0, 10);
}

function emptyForm(jodt: string): WorkLogForm {
	return {
		jodt,
		fcnt: "",
		hcnt: "",
		scnt: "",
		ncnt: "",
		ecnt: "",
		svnm: "",
		jdes: "",
		otdes: "",
		ordes1: "",
		ordes1nm: "",
		ordes2: "",
		ordes2nm: "",
		ordes3: "",
		ordes3nm: "",
		ordes4: "",
		ordes4nm: "",
		prc1: "0",
		prc2: "0",
		prc3: "0",
		prc4: "0",
	};
}

function numStr(v: unknown): string {
	if (v == null || v === "") return "";
	return String(v);
}

function mapApiRow(row: Record<string, unknown>): WorkLogRow {
	return {
		ancd: row.ANCD as string | number | undefined,
		jodt: formatDateYmd(row.JODT),
		fcnt: numStr(row.FCNT),
		hcnt: numStr(row.HCNT),
		scnt: numStr(row.SCNT),
		ncnt: numStr(row.NCNT),
		ecnt: numStr(row.ECNT),
		svnm: String(row.SVNM ?? "").trim(),
		jdes: String(row.JDES ?? "").trim(),
		otdes: String(row.OTDES ?? "").trim(),
		ordes1: String(row.ORDES1 ?? "").trim(),
		ordes1nm: String(row.ORDES1NM ?? "").trim(),
		ordes2: String(row.ORDES2 ?? "").trim(),
		ordes2nm: String(row.ORDES2NM ?? "").trim(),
		ordes3: String(row.ORDES3 ?? "").trim(),
		ordes3nm: String(row.ORDES3NM ?? "").trim(),
		ordes4: String(row.ORDES4 ?? "").trim(),
		ordes4nm: String(row.ORDES4NM ?? "").trim(),
		prc1: String(row.PRC_1 ?? "0").trim() || "0",
		prc2: String(row.PRC_2 ?? "0").trim() || "0",
		prc3: String(row.PRC_3 ?? "0").trim() || "0",
		prc4: String(row.PRC_4 ?? "0").trim() || "0",
	};
}

function toPayload(form: WorkLogForm, action: "create" | "update") {
	return {
		action,
		JODT: form.jodt,
		FCNT: form.fcnt === "" ? null : Number(form.fcnt),
		HCNT: form.hcnt === "" ? null : Number(form.hcnt),
		SCNT: form.scnt === "" ? null : Number(form.scnt),
		NCNT: form.ncnt === "" ? null : Number(form.ncnt),
		ECNT: form.ecnt === "" ? null : Number(form.ecnt),
		SVNM: form.svnm || null,
		JDES: form.jdes || null,
		OTDES: form.otdes || null,
		ORDES1: form.ordes1 || null,
		ORDES1NM: form.ordes1nm || null,
		ORDES2: form.ordes2 || null,
		ORDES2NM: form.ordes2nm || null,
		ORDES3: form.ordes3 || null,
		ORDES3NM: form.ordes3nm || null,
		ORDES4: form.ordes4 || null,
		ORDES4NM: form.ordes4nm || null,
		PRC_1: form.prc1 || "0",
		PRC_2: form.prc2 || "0",
		PRC_3: form.prc3 || "0",
		PRC_4: form.prc4 || "0",
	};
}

function toPrintData(form: WorkLogForm, facilityName: string): FacilityWorkLogPrintData {
	return {
		facilityName,
		jodt: form.jodt,
		fcnt: form.fcnt,
		hcnt: form.hcnt,
		scnt: form.scnt,
		ncnt: form.ncnt,
		ecnt: form.ecnt,
		svnm: form.svnm,
		jdes: form.jdes,
		otdes: form.otdes,
		instructions: [
			{ approver: form.ordes1nm, instruction: form.ordes1 },
			{ approver: form.ordes2nm, instruction: form.ordes2 },
			{ approver: form.ordes3nm, instruction: form.ordes3 },
			{ approver: form.ordes4nm, instruction: form.ordes4 },
		],
	};
}

const labelCls =
	"rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center";
const inputCls =
	"rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none";
const actionBtnCls =
	"min-w-[5.5rem] rounded border border-blue-400 bg-blue-200 px-4 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed";
const modalLabelCls =
	"col-span-2 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center";

export default function FacilityWorkLog() {
	const todayStr = useMemo(() => formatDate(new Date()), []);

	const [fromDate, setFromDate] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 30);
		return formatDate(d);
	});
	const [toDate, setToDate] = useState(todayStr);

	const [sessionAncd, setSessionAncd] = useState<string | number | null>(null);
	const [facilityName, setFacilityName] = useState("");
	const [workDates, setWorkDates] = useState<string[]>([]);
	const [rowsByDate, setRowsByDate] = useState<Record<string, WorkLogRow>>({});
	const [selectedDate, setSelectedDate] = useState("");
	const [checkedDates, setCheckedDates] = useState<Set<string>>(new Set());
	const [form, setForm] = useState<WorkLogForm>(() => emptyForm(todayStr));
	const [isEditMode, setIsEditMode] = useState(false);

	const [addModalOpen, setAddModalOpen] = useState(false);
	const [modalForm, setModalForm] = useState<WorkLogForm>(() => emptyForm(todayStr));
	const [modalSaving, setModalSaving] = useState(false);
	const [statsLoading, setStatsLoading] = useState(false);

	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const hasSelected = Boolean(selectedDate && rowsByDate[selectedDate]);

	const instructionRows = useMemo(
		() => [
			{ key: "1", approver: form.ordes1nm, instruction: form.ordes1, prc: form.prc1 },
			{ key: "2", approver: form.ordes2nm, instruction: form.ordes2, prc: form.prc2 },
			{ key: "3", approver: form.ordes3nm, instruction: form.ordes3, prc: form.prc3 },
			{ key: "4", approver: form.ordes4nm, instruction: form.ordes4, prc: form.prc4 },
		],
		[form]
	);

	const loadData = useCallback(async () => {
		if (sessionAncd == null) return;
		setLoading(true);
		setLoadError(null);
		try {
			const qs = new URLSearchParams({
				ancd: String(sessionAncd),
				startDate: fromDate,
				endDate: toDate,
			});
			const res = await fetch(`/api/f11060?${qs.toString()}`, {
				credentials: "include",
				cache: "no-store",
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "업무일지 조회에 실패했습니다.");
			}
			const list = (Array.isArray(json.data) ? json.data : []).map((r: Record<string, unknown>) =>
				mapApiRow(r)
			) as WorkLogRow[];
			const map: Record<string, WorkLogRow> = {};
			const dates: string[] = [];
			for (const row of list) {
				if (!row.jodt) continue;
				map[row.jodt] = row;
				dates.push(row.jodt);
			}
			dates.sort((a, b) => b.localeCompare(a));
			setRowsByDate(map);
			setWorkDates(dates);
			setCheckedDates((prev) => {
				const next = new Set<string>();
				prev.forEach((d) => {
					if (map[d]) next.add(d);
				});
				return next;
			});
			setSelectedDate((prev) => {
				if (prev && map[prev]) return prev;
				return dates[0] || "";
			});
			setIsEditMode(false);
		} catch (err) {
			console.error(err);
			setRowsByDate({});
			setWorkDates([]);
			setSelectedDate("");
			setCheckedDates(new Set());
			setLoadError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
		} finally {
			setLoading(false);
		}
	}, [sessionAncd, fromDate, toDate]);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/auth/user-info", { credentials: "include" });
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success) {
					throw new Error(json?.error || "로그인 정보를 확인할 수 없습니다.");
				}
				const user = (json.data || {}) as UserInfo;
				if (user.ancd == null || user.ancd === "") {
					throw new Error("로그인 계정의 센터(고객코드)를 확인할 수 없습니다.");
				}
				setSessionAncd(user.ancd);
				setFacilityName(user.annm ? String(user.annm) : "");
			} catch (err) {
				setLoadError(err instanceof Error ? err.message : "초기화 중 오류가 발생했습니다.");
			}
		})();
	}, []);

	useEffect(() => {
		if (sessionAncd == null) return;
		void loadData();
	}, [sessionAncd, loadData]);

	useEffect(() => {
		if (isEditMode) return;
		if (selectedDate && rowsByDate[selectedDate]) {
			setForm({ ...rowsByDate[selectedDate] });
		} else {
			setForm(emptyForm(selectedDate || todayStr));
		}
	}, [selectedDate, rowsByDate, isEditMode, todayStr]);

	const fetchPersonnelStats = async (target: "form" | "modal", jodt: string) => {
		if (sessionAncd == null) {
			alert("로그인 정보를 확인할 수 없습니다.");
			return;
		}
		if (!jodt) {
			alert("업무일자를 입력해 주세요.");
			return;
		}
		setStatsLoading(true);
		try {
			const qs = new URLSearchParams({
				ancd: String(sessionAncd),
				jodt,
				stats: "true",
			});
			const res = await fetch(`/api/f11060?${qs.toString()}`, {
				credentials: "include",
				cache: "no-store",
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "인원현황 조회에 실패했습니다.");
			}
			const d = json.data || {};
			const patch = {
				fcnt: numStr(d.FCNT),
				hcnt: numStr(d.HCNT),
				scnt: numStr(d.SCNT),
				ncnt: numStr(d.NCNT),
				ecnt: numStr(d.ECNT),
			};
			if (target === "modal") setModalForm((p) => ({ ...p, ...patch }));
			else setForm((p) => ({ ...p, ...patch }));
		} catch (err) {
			alert(err instanceof Error ? err.message : "인원현황 조회 중 오류가 발생했습니다.");
		} finally {
			setStatsLoading(false);
		}
	};

	const openAddModal = () => {
		setModalForm(emptyForm(todayStr));
		setAddModalOpen(true);
	};

	const closeAddModal = () => {
		if (modalSaving) return;
		setAddModalOpen(false);
	};

	const handleModalSave = async () => {
		if (sessionAncd == null || modalSaving) return;
		if (!modalForm.jodt) {
			alert("업무일자를 입력해 주세요.");
			return;
		}
		setModalSaving(true);
		try {
			const res = await fetch("/api/f11060", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(toPayload(modalForm, "create")),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "업무일지 등록에 실패했습니다.");
			}
			alert("업무일지가 등록되었습니다.");
			setAddModalOpen(false);
			await loadData();
			setSelectedDate(modalForm.jodt);
		} catch (err) {
			alert(err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.");
		} finally {
			setModalSaving(false);
		}
	};

	const handleModify = () => {
		if (!hasSelected) {
			alert("수정할 업무일지를 선택해 주세요.");
			return;
		}
		setIsEditMode(true);
	};

	const handleCancelEdit = () => {
		setIsEditMode(false);
		if (selectedDate && rowsByDate[selectedDate]) {
			setForm({ ...rowsByDate[selectedDate] });
		}
	};

	const handleSave = async () => {
		if (!isEditMode || !hasSelected || saving) return;
		setSaving(true);
		try {
			const res = await fetch("/api/f11060", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(toPayload(form, "update")),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "업무일지 수정에 실패했습니다.");
			}
			alert("업무일지가 수정되었습니다.");
			setIsEditMode(false);
			await loadData();
			setSelectedDate(form.jodt);
		} catch (err) {
			alert(err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!hasSelected || sessionAncd == null || saving) return;
		if (!confirm(`${selectedDate} 업무일지를 삭제하시겠습니까?`)) return;
		setSaving(true);
		try {
			const qs = new URLSearchParams({
				ancd: String(sessionAncd),
				jodt: selectedDate,
			});
			const res = await fetch(`/api/f11060?${qs.toString()}`, {
				method: "DELETE",
				credentials: "include",
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "삭제에 실패했습니다.");
			}
			alert("삭제되었습니다.");
			setIsEditMode(false);
			await loadData();
		} catch (err) {
			alert(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleCopy = async () => {
		if (!hasSelected || sessionAncd == null || saving) return;
		const target = window.prompt("복사할 업무일자를 입력하세요 (YYYY-MM-DD)", todayStr);
		if (!target) return;
		const jodt = formatDateYmd(target);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(jodt)) {
			alert("날짜 형식이 올바르지 않습니다.");
			return;
		}
		setSaving(true);
		try {
			const copied: WorkLogForm = {
				...form,
				jodt,
				prc1: "0",
				prc2: "0",
				prc3: "0",
				prc4: "0",
			};
			const res = await fetch("/api/f11060", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(toPayload(copied, "create")),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "복사에 실패했습니다.");
			}
			alert("복사되었습니다.");
			await loadData();
			setSelectedDate(jodt);
		} catch (err) {
			alert(err instanceof Error ? err.message : "복사 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const toggleCheckedDate = (date: string) => {
		setCheckedDates((prev) => {
			const next = new Set(prev);
			if (next.has(date)) next.delete(date);
			else next.add(date);
			return next;
		});
	};

	const handlePrintChecked = () => {
		if (!checkedDates.size) {
			alert("출력할 업무일자를 체크해 주세요.");
			return;
		}
		const list = workDates
			.filter((d) => checkedDates.has(d))
			.map((d) => rowsByDate[d])
			.filter(Boolean)
			.map((row) => toPrintData(row, facilityName || "요양시설"));
		if (!list.length) {
			alert("체크된 업무일지가 없습니다.");
			return;
		}
		openPrintPreviewWindow(buildFacilityWorkLogPrintHtml(list));
	};

	const setInstructionField = (
		slot: "1" | "2" | "3" | "4",
		field: "approver" | "instruction",
		value: string
	) => {
		const key =
			field === "approver"
				? (`ordes${slot}nm` as keyof WorkLogForm)
				: (`ordes${slot}` as keyof WorkLogForm);
		setForm((p) => ({ ...p, [key]: value }));
	};

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="p-4 space-y-4">
				<div className="flex flex-wrap items-stretch gap-3">
					<div className="flex-1 min-w-[240px] rounded border border-blue-300 bg-blue-100 px-6 py-4 text-center text-2xl font-semibold text-blue-900">
						센터 일일업무
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-3">
							<span className={labelCls}>업무기간</span>
							<input
								type="date"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
								className={inputCls}
							/>
							<span className="px-1 text-blue-900/70">~</span>
							<input
								type="date"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
								className={inputCls}
							/>
						</div>
						<button
							type="button"
							onClick={openAddModal}
							disabled={saving}
							className="rounded border border-blue-400 bg-blue-200 px-5 py-3 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
						>
							추가
						</button>
					</div>
				</div>

				{loadError ? (
					<div className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
						{loadError}
					</div>
				) : null}

				<div className="grid grid-cols-12 gap-3">
					<div className="col-span-12 lg:col-span-2 flex flex-col gap-2">
						<button
							type="button"
							onClick={handlePrintChecked}
							disabled={!checkedDates.size}
							className="w-full rounded border border-blue-400 bg-blue-200 px-3 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
						>
							출 력{checkedDates.size > 0 ? ` (${checkedDates.size})` : ""}
						</button>
						<div className="rounded-lg border border-blue-300 bg-white overflow-hidden flex-1">
						<div className="border-b border-blue-200 bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900">
							업무일자
						</div>
						<div className="max-h-[560px] overflow-auto">
							<table className="w-full text-sm">
								<tbody>
									{loading ? (
										<tr>
											<td className="px-3 py-10 text-center text-blue-900/60">조회 중…</td>
										</tr>
									) : workDates.length === 0 ? (
										<tr>
											<td className="px-3 py-10 text-center text-blue-900/60">데이터가 없습니다.</td>
										</tr>
									) : (
										workDates.map((date) => {
											const isSelected = date === selectedDate;
											const isChecked = checkedDates.has(date);
											return (
												<tr
													key={date}
													onClick={() => {
														setSelectedDate(date);
														setIsEditMode(false);
													}}
													className={`cursor-pointer border-b border-blue-50 hover:bg-blue-50/60 ${
														isSelected ? "bg-blue-100" : ""
													}`}
												>
													<td className="w-10 px-2 py-2 text-center">
														<input
															type="checkbox"
															checked={isChecked}
															onClick={(e) => e.stopPropagation()}
															onChange={() => toggleCheckedDate(date)}
															className="h-4 w-4 accent-blue-600"
															aria-label={`${date} 출력 선택`}
														/>
													</td>
													<td className="px-3 py-2">{date}</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
						</div>
					</div>

					<div className="col-span-12 lg:col-span-10 rounded-lg border border-blue-300 bg-white overflow-hidden">
						<div className="p-3 space-y-2 min-h-[420px]">
							{!hasSelected && !isEditMode ? (
								<p className="py-20 text-center text-sm text-blue-900/60">
									좌측에서 업무일자를 선택하거나 추가로 등록하세요.
								</p>
							) : (
								<>
									<div className="grid grid-cols-12 gap-2 items-center">
										<span className={`col-span-2 ${labelCls}`}>업무일자</span>
										<input
											type="date"
											value={form.jodt}
											disabled
											className={`col-span-3 ${inputCls} disabled:bg-gray-50`}
										/>
										<div className="col-span-7" />
									</div>

									<div className="grid grid-cols-12 gap-2 items-center">
										<span className={`col-span-1 ${labelCls}`}>정원</span>
										<input
											value={form.fcnt}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, fcnt: e.target.value }))}
											className={`col-span-1 ${inputCls} disabled:bg-gray-50`}
										/>
										<span className={`col-span-1 ${labelCls}`}>현인원</span>
										<input
											value={form.hcnt}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, hcnt: e.target.value }))}
											className={`col-span-1 ${inputCls} disabled:bg-gray-50`}
										/>
										<span className={`col-span-1 ${labelCls}`}>이용인원</span>
										<input
											value={form.scnt}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, scnt: e.target.value }))}
											className={`col-span-1 ${inputCls} disabled:bg-gray-50`}
										/>
										<span className={`col-span-1 ${labelCls}`}>신규입소자</span>
										<input
											value={form.ncnt}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, ncnt: e.target.value }))}
											className={`col-span-1 ${inputCls} disabled:bg-gray-50`}
										/>
										<span className={`col-span-1 ${labelCls}`}>퇴소자</span>
										<input
											value={form.ecnt}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, ecnt: e.target.value }))}
											className={`col-span-1 ${inputCls} disabled:bg-gray-50`}
										/>
										<div className="col-span-2" />
									</div>

									<div className="grid grid-cols-12 gap-2 items-center">
										<span className={`col-span-2 ${labelCls}`}>외박명단</span>
										<input
											value={form.svnm}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, svnm: e.target.value }))}
											className={`col-span-10 ${inputCls} disabled:bg-gray-50`}
										/>
									</div>

									<div className="grid grid-cols-12 gap-2">
										<span className={`col-span-2 ${labelCls} self-start`}>업무내용</span>
										<textarea
											value={form.jdes}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, jdes: e.target.value }))}
											rows={8}
											className={`col-span-10 ${inputCls} resize-none disabled:bg-gray-50`}
										/>
									</div>

									<div className="grid grid-cols-12 gap-2 items-center">
										<span className={`col-span-2 ${labelCls}`}>지출내역</span>
										<input
											value={form.otdes}
											disabled={!isEditMode}
											onChange={(e) => setForm((p) => ({ ...p, otdes: e.target.value }))}
											className={`col-span-10 ${inputCls} disabled:bg-gray-50`}
										/>
									</div>

									<div className="rounded border border-blue-300 overflow-hidden">
										<div className="border-b border-blue-200 bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900">
											지시사항
										</div>
										<div className="max-h-[180px] overflow-auto">
											<table className="w-full text-sm">
												<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-50">
													<tr>
														<th className="w-[160px] border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
															결재자
														</th>
														<th className="px-3 py-2 text-left font-semibold text-blue-900">
															지시사항
														</th>
													</tr>
												</thead>
												<tbody>
													{instructionRows.map((row) => (
														<tr key={row.key} className="border-b border-blue-50">
															<td className="border-r border-blue-100 px-2 py-1.5">
																{isEditMode ? (
																	<input
																		value={row.approver}
																		onChange={(e) =>
																			setInstructionField(
																				row.key as "1" | "2" | "3" | "4",
																				"approver",
																				e.target.value
																			)
																		}
																		className={`w-full ${inputCls}`}
																	/>
																) : (
																	<span className="px-1">{row.approver || "-"}</span>
																)}
															</td>
															<td className="px-2 py-1.5">
																{isEditMode ? (
																	<input
																		value={row.instruction}
																		onChange={(e) =>
																			setInstructionField(
																				row.key as "1" | "2" | "3" | "4",
																				"instruction",
																				e.target.value
																			)
																		}
																		className={`w-full ${inputCls}`}
																	/>
																) : (
																	<span className="px-1">{row.instruction || "-"}</span>
																)}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								</>
							)}
						</div>

						<div className="border-t border-blue-200 bg-blue-50/50 px-3 py-3">
							<div className="flex flex-wrap items-center justify-end gap-2">
								{!isEditMode ? (
									<>
										<button
											type="button"
											onClick={handleModify}
											disabled={!hasSelected || saving}
											className={actionBtnCls}
										>
											수정
										</button>
										{/* <button
											type="button"
											onClick={() => void handleCopy()}
											disabled={!hasSelected || saving}
											className={actionBtnCls}
										>
											복사
										</button> */}
										<button
											type="button"
											onClick={() => void handleDelete()}
											disabled={!hasSelected || saving}
											className={actionBtnCls}
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
											className="min-w-[5.5rem] rounded border border-gray-400 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
										>
											취소
										</button>
										<button
											type="button"
											onClick={() => void handleSave()}
											disabled={saving}
											className="min-w-[5.5rem] rounded border border-blue-500 bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
										>
											{saving ? "저장중..." : "저장"}
										</button>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{addModalOpen ? (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
					role="presentation"
					onClick={closeAddModal}
				>
					<div
						className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border-2 border-blue-300 bg-white shadow-xl"
						role="dialog"
						aria-modal="true"
						aria-labelledby="work-log-create-title"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3">
							<h2 id="work-log-create-title" className="flex-1 text-center text-lg font-semibold text-blue-900">
								센터 업무일지 등록
							</h2>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => void handleModalSave()}
									disabled={modalSaving}
									className="rounded border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
								>
									{modalSaving ? "저장중..." : "저장"}
								</button>
								<button
									type="button"
									onClick={closeAddModal}
									disabled={modalSaving}
									className="rounded border border-blue-400 bg-blue-200 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
								>
									닫기
								</button>
							</div>
						</div>

						<div className="overflow-y-auto space-y-2 p-4">
							<div className="grid grid-cols-12 gap-2 items-center">
								<span className={modalLabelCls}>업무일자</span>
								<input
									type="date"
									value={modalForm.jodt}
									onChange={(e) => setModalForm((p) => ({ ...p, jodt: e.target.value }))}
									className={`col-span-3 ${inputCls}`}
								/>
								<button
									type="button"
									onClick={() => void fetchPersonnelStats("modal", modalForm.jodt)}
									disabled={statsLoading || modalSaving}
									className="col-span-3 rounded border border-blue-400 bg-blue-200 px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
								>
									{statsLoading ? "조회중..." : "인원현황 찾아오기"}
								</button>
								<div className="col-span-4" />
							</div>

							<div className="grid grid-cols-12 gap-2 items-center">
								<span className={`col-span-1 ${labelCls}`}>정원</span>
								<input
									value={modalForm.fcnt}
									onChange={(e) => setModalForm((p) => ({ ...p, fcnt: e.target.value }))}
									className={`col-span-1 ${inputCls}`}
								/>
								<span className={`col-span-1 ${labelCls}`}>현인원</span>
								<input
									value={modalForm.hcnt}
									onChange={(e) => setModalForm((p) => ({ ...p, hcnt: e.target.value }))}
									className={`col-span-1 ${inputCls}`}
								/>
								<span className={`col-span-1 ${labelCls}`}>이용인원</span>
								<input
									value={modalForm.scnt}
									onChange={(e) => setModalForm((p) => ({ ...p, scnt: e.target.value }))}
									className={`col-span-1 ${inputCls}`}
								/>
								<span className={`col-span-1 ${labelCls}`}>신규입소자</span>
								<input
									value={modalForm.ncnt}
									onChange={(e) => setModalForm((p) => ({ ...p, ncnt: e.target.value }))}
									className={`col-span-1 ${inputCls}`}
								/>
								<span className={`col-span-1 ${labelCls}`}>퇴소자</span>
								<input
									value={modalForm.ecnt}
									onChange={(e) => setModalForm((p) => ({ ...p, ecnt: e.target.value }))}
									className={`col-span-1 ${inputCls}`}
								/>
								<div className="col-span-2" />
							</div>

							<div className="grid grid-cols-12 gap-2 items-center">
								<span className={modalLabelCls}>외박 명단</span>
								<input
									value={modalForm.svnm}
									onChange={(e) => setModalForm((p) => ({ ...p, svnm: e.target.value }))}
									className={`col-span-10 ${inputCls}`}
								/>
							</div>

							<div className="grid grid-cols-12 gap-2">
								<span className={`${modalLabelCls} self-start`}>업무내용</span>
								<textarea
									value={modalForm.jdes}
									onChange={(e) => setModalForm((p) => ({ ...p, jdes: e.target.value }))}
									rows={8}
									className={`col-span-10 ${inputCls} resize-none`}
								/>
							</div>

							<div className="grid grid-cols-12 gap-2">
								<span className={`${modalLabelCls} self-start`}>지출내역</span>
								<textarea
									value={modalForm.otdes}
									onChange={(e) => setModalForm((p) => ({ ...p, otdes: e.target.value }))}
									rows={4}
									className={`col-span-10 ${inputCls} resize-none`}
								/>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

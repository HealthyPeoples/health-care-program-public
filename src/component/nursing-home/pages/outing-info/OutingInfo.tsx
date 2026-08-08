"use client";

/**
 * @file 외출·외박대장 — 화면 컴포넌트 (OutingInfo.tsx)
 *
 * @description
 * 요양원 외출·외박대장 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/outing-info
 *
 * @module component/nursing-home/pages/outing-info/OutingInfo
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GynCode = "0" | "2" | "";

interface OutingRow {
	id: number;
	opSeq: number | null;
	serialNo: number;
	pnum: string;
	beneficiaryName: string;
	birthDate: string;
	gyn: GynCode;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	destination: string;
	purpose: string;
	guardian: string;
	relationship: string;
	contact: string;
}

function pad2(n: number) {
	return String(n).padStart(2, "0");
}

function toYmd(raw: unknown): string {
	if (raw == null || raw === "") return "";
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`;
	}
	const s = String(raw).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	const digits = s.replace(/\D/g, "");
	if (digits.length >= 8) {
		return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
	}
	return "";
}

function formatDateDisplay(raw: unknown): string {
	const ymd = toYmd(raw);
	return ymd || "";
}

function padTime5(t: string): string {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
	if (!m) return "";
	return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function gynLabel(gyn: string): string {
	if (gyn === "0") return "외출";
	if (gyn === "2") return "외박";
	return "";
}

function mapApiToRow(item: any, index: number): OutingRow {
	return {
		id: Number(item.OP_SEQ) || index + 1,
		opSeq: item.OP_SEQ != null ? Number(item.OP_SEQ) : null,
		serialNo: Number(item.MENUM) || index + 1,
		pnum: String(item.PNUM ?? "").trim(),
		beneficiaryName: String(item.P_NM ?? "").trim(),
		birthDate: formatDateDisplay(item.P_BRDT),
		gyn: (String(item.GYN ?? "").trim() as GynCode) || "",
		startDate: toYmd(item.START_DT),
		startTime: padTime5(String(item.START_TM ?? "")),
		endDate: toYmd(item.END_DT),
		endTime: padTime5(String(item.END_TM ?? "")),
		destination: String(item.DEST ?? "").trim(),
		purpose: String(item.PURPOSE ?? "").trim(),
		guardian: String(item.GUARDIAN ?? "").trim(),
		relationship: String(item.RELATION ?? "").trim(),
		contact: String(item.CONTACT ?? "").trim(),
	};
}

function emptyRow(id: number, serialNo: number, selectedDate = ""): OutingRow {
	return {
		id,
		opSeq: null,
		serialNo,
		pnum: "",
		beneficiaryName: "",
		birthDate: "",
		gyn: "",
		startDate: selectedDate,
		startTime: "",
		endDate: selectedDate,
		endTime: "",
		destination: "",
		purpose: "",
		guardian: "",
		relationship: "",
		contact: "",
	};
}

function todayYmd(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shiftYmd(ymd: string, days: number): string {
	const date = new Date(`${ymd}T12:00:00`);
	date.setDate(date.getDate() + days);
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export default function OutingInfo() {
	const [selectedDate, setSelectedDate] = useState(todayYmd);
	const [rows, setRows] = useState<OutingRow[]>([]);
	const [nextId, setNextId] = useState(1);
	const [editingRowId, setEditingRowId] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const [searchResults, setSearchResults] = useState<{ [key: number]: any[] }>({});
	const [showSearchResults, setShowSearchResults] = useState<{ [key: number]: boolean }>({});
	const searchInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

	const handleDateChange = (days: number) => {
		setSelectedDate((prev) => shiftYmd(prev, days));
		setEditingRowId(null);
	};

	const fetchList = async (svdt: string) => {
		setLoading(true);
		try {
			const res = await fetch(`/api/outing-info?svdt=${encodeURIComponent(svdt)}`);
			const json = await res.json();
			if (!json?.success || !Array.isArray(json.data)) {
				setRows([]);
				return;
			}
			const mapped = json.data.map((item: any, idx: number) => mapApiToRow(item, idx));
			setRows(mapped);
			setNextId(mapped.length > 0 ? Math.max(...mapped.map((r: OutingRow) => r.id)) + 1 : 1);
		} catch (e) {
			console.error("외출/외박 목록 조회 오류:", e);
			alert("목록 조회 중 오류가 발생했습니다.");
			setRows([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return;
		fetchList(selectedDate);
	}, [selectedDate]);

	const updateRow = (id: number, patch: Partial<OutingRow>) => {
		setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
	};

	const handleSearchMember = async (rowId: number, searchValue: string) => {
		if (!searchValue || searchValue.trim().length < 1) {
			setSearchResults((prev) => ({ ...prev, [rowId]: [] }));
			setShowSearchResults((prev) => ({ ...prev, [rowId]: false }));
			return;
		}
		try {
			const response = await fetch(`/api/f10010/search?q=${encodeURIComponent(searchValue.trim())}`);
			const data = await response.json();
			if (data.success && Array.isArray(data.data)) {
				setSearchResults((prev) => ({ ...prev, [rowId]: data.data }));
				setShowSearchResults((prev) => ({ ...prev, [rowId]: data.data.length > 0 }));
			} else {
				setSearchResults((prev) => ({ ...prev, [rowId]: [] }));
				setShowSearchResults((prev) => ({ ...prev, [rowId]: false }));
			}
		} catch (e) {
			console.error("수급자 검색 오류:", e);
			setSearchResults((prev) => ({ ...prev, [rowId]: [] }));
			setShowSearchResults((prev) => ({ ...prev, [rowId]: false }));
		}
	};

	const handleSelectMember = async (rowId: number, member: any) => {
		updateRow(rowId, {
			pnum: String(member.PNUM ?? "").trim(),
			beneficiaryName: String(member.P_NM ?? "").trim(),
			birthDate: formatDateDisplay(member.P_BRDT),
		});
		setShowSearchResults((prev) => ({ ...prev, [rowId]: false }));
		setSearchResults((prev) => ({ ...prev, [rowId]: [] }));

		// 주보호자 자동 채움 (있으면)
		try {
			const ancd = member.ANCD;
			const pnum = member.PNUM;
			if (ancd == null || pnum == null) return;
			const res = await fetch(
				`/api/f10020?ancd=${encodeURIComponent(String(ancd))}&pnum=${encodeURIComponent(String(pnum))}`
			);
			const json = await res.json();
			if (!json?.success || !Array.isArray(json.data) || json.data.length === 0) return;
			const primary =
				json.data.find((g: any) => String(g.BHJB || "").trim() === "1") || json.data[0];
			updateRow(rowId, {
				guardian: String(primary.BHNM ?? "").trim(),
				relationship: String(primary.BHREL ?? primary.BHETC ?? "").trim(),
				contact: String(primary.P_HP || primary.P_TEL || "").trim(),
			});
		} catch (_) {
			/* ignore */
		}
	};

	const handleAddRow = () => {
		const newRow = emptyRow(nextId, rows.length + 1, selectedDate);
		setRows((prev) => [...prev, newRow]);
		setNextId((n) => n + 1);
		setEditingRowId(newRow.id);
	};

	const handleDeleteRow = async (row: OutingRow) => {
		if (!confirm("정말 삭제하시겠습니까?")) return;
		if (row.opSeq) {
			try {
				const res = await fetch(`/api/outing-info?opSeq=${encodeURIComponent(String(row.opSeq))}`, {
					method: "DELETE",
				});
				const json = await res.json();
				if (!json?.success) {
					alert(`삭제 실패: ${json?.error || "알 수 없는 오류"}`);
					return;
				}
			} catch (e) {
				console.error(e);
				alert("삭제 중 오류가 발생했습니다.");
				return;
			}
		}
		setRows((prev) =>
			prev
				.filter((r) => r.id !== row.id)
				.map((r, idx) => ({ ...r, serialNo: idx + 1 }))
		);
		if (editingRowId === row.id) setEditingRowId(null);
	};

	const validateBeforeSave = (row: OutingRow): string | null => {
		if (!row.pnum) return "수급자를 선택해주세요.";
		if (row.gyn !== "0" && row.gyn !== "2") return "구분(외출/외박)을 선택해주세요.";
		if (!row.startDate || !row.startTime) return "시작일/시작시간을 입력해주세요.";
		if (row.gyn === "0") {
			if (!row.endTime) return "외출은 종료시간이 필요합니다.";
			const endDate = row.endDate || row.startDate;
			if (endDate !== row.startDate) return "외출은 시작일과 종료일이 같아야 합니다.";
		}
		if (row.gyn === "2") {
			if ((row.endDate && !row.endTime) || (!row.endDate && row.endTime)) {
				return "외박 종료일/종료시간은 함께 입력하거나 비워두세요.";
			}
			if (row.endDate && row.endDate < row.startDate) {
				return "외박 종료일은 시작일 이후여야 합니다.";
			}
		}
		return null;
	};

	const handleEditClick = async (id: number) => {
		if (editingRowId === id) {
			const row = rows.find((r) => r.id === id);
			if (!row) {
				setEditingRowId(null);
				return;
			}
			const err = validateBeforeSave(row);
			if (err) {
				alert(err);
				return;
			}
			setSaving(true);
			try {
				const payload = {
					opSeq: row.opSeq,
					pnum: row.pnum,
					gyn: row.gyn,
					startDate: row.startDate,
					startTime: row.startTime,
					endDate: row.gyn === "0" ? row.startDate : row.endDate || null,
					endTime: row.endTime || null,
					destination: row.destination,
					purpose: row.purpose,
					guardian: row.guardian,
					relationship: row.relationship,
					contact: row.contact,
				};
				const res = await fetch("/api/outing-info", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				const json = await res.json();
				if (!json?.success) {
					alert(`저장 실패: ${json?.error || "알 수 없는 오류"}`);
					return;
				}
				await fetchList(selectedDate);
				setEditingRowId(null);
				alert("저장되었습니다");
			} catch (e) {
				console.error(e);
				alert("저장 중 오류가 발생했습니다.");
			} finally {
				setSaving(false);
			}
		} else {
			setEditingRowId(id);
		}
	};

	const handlePrint = () => {
		const printRows = rows
			.map((row) => {
				return `<tr>
          <td>${row.serialNo}</td>
          <td>${row.beneficiaryName || ""}${row.birthDate ? `<br/><span style="font-size:10px">(${row.birthDate})</span>` : ""}</td>
          <td>${gynLabel(row.gyn)}</td>
          <td>${row.startDate || ""}</td>
          <td>${row.startTime || ""}</td>
          <td>${row.endDate || ""}</td>
          <td>${row.endTime || ""}</td>
          <td>${row.destination || ""}</td>
          <td>${row.purpose || ""}</td>
          <td>${row.guardian || ""}</td>
          <td>${row.relationship || ""}</td>
          <td>${row.contact || ""}</td>
        </tr>`;
			})
			.join("");

		const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
		const dayObj = new Date(`${selectedDate}T12:00:00`);
		const dayName = weekdayLabels[dayObj.getDay()] || "";

		const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>외출/외박 처리</title>
      <style>
        body{font-family:'Malgun Gothic',sans-serif;font-size:11pt;margin:12mm}
        h1{text-align:center;font-size:16pt;margin:0 0 12px}
        .meta{margin-bottom:10px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:4px;text-align:center;font-size:10pt}
        th{background:#eef}
        @page{size:A4 landscape;margin:10mm}
      </style></head><body>
      <h1>외출/외박 처리 대장</h1>
      <div class="meta">일자: ${selectedDate} ${dayName}</div>
      <table>
        <thead>
          <tr>
            <th>연번</th><th>수급자명</th><th>구분</th><th>시작일</th><th>시작시간</th>
            <th>종료일</th><th>종료시간</th><th>행선지</th><th>목적</th>
            <th>보호자</th><th>관계</th><th>연락처</th>
          </tr>
        </thead>
        <tbody>${printRows || '<tr><td colspan="12">데이터 없음</td></tr>'}</tbody>
      </table>
      </body></html>`;

		const w = window.open("", "_blank");
		if (!w) return;
		w.document.write(html);
		w.document.close();
		setTimeout(() => w.print(), 250);
	};

	const isEditing = (rowId: number) => editingRowId === rowId;

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="mx-auto w-full max-w-[1600px] min-w-0 p-3 sm:p-4">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-3 relative">
					<div className="w-full sm:w-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex flex-wrap items-center justify-center gap-4">
						<button
							type="button"
							onClick={() => handleDateChange(-1)}
							className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
						>
							<span>◀</span>
						</button>
						<div className="flex items-center gap-2">
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => {
									setSelectedDate(e.target.value);
									setEditingRowId(null);
								}}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white text-blue-900"
							/>
						</div>
						<button
							type="button"
							onClick={() => handleDateChange(1)}
							className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
						>
							<span>▶</span>
						</button>
					</div>
					<div className="ml-auto flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={handlePrint}
							disabled={loading || rows.length === 0}
							className="px-4 py-1.5 text-sm border border-orange-400 rounded bg-orange-200 hover:bg-orange-300 text-orange-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							외출/외박 대장 출력
						</button>
					</div>
				</div>

				{/* <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
					<p className="font-medium mb-1">안내</p>
					<ul className="list-disc pl-5 space-y-0.5 text-blue-900/90">
						<li>
							선택한 <strong>일자</strong>에 시작·종료·진행 중인 외출/외박이 목록에 표시됩니다.
						</li>
						<li>
							외출/외박 대장은 <strong>OUTING_INFO</strong>에 저장되며, <strong>F14020</strong>의 GYN·IO_TM_INFO와 <strong>양방향 동기화</strong>됩니다.
						</li>
						<li>
							이 페이지에서 등록·수정·삭제하면 일 수급자급여실적(F14020)이 같이 반영되고, 반대로 급여실적에서 외출/외박을 바꾸면 이 대장도 같이 반영됩니다.
						</li>
						<li>외출(GYN=0): IO_TM_INFO = 시작~종료 / 외박(GYN=2): 시작일=시작시각, 복귀일=R:복귀시각</li>
					</ul>
				</div> */}

				<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
					<div className="bg-blue-100 border-b border-blue-300 px-4 py-2">
						<h2 className="text-xl font-semibold text-blue-900">외출/외박 처리</h2>
					</div>
					<div className="overflow-x-auto w-full min-w-0">
						<style>{`
							.outing-dt {
								min-width: 0;
								max-width: 100%;
								box-sizing: border-box;
								font-size: 13px;
								line-height: 1.2;
							}
							.outing-dt::-webkit-calendar-picker-indicator {
								width: 14px;
								height: 14px;
								padding: 0;
								margin: 0;
								cursor: pointer;
							}
							.outing-dt::-webkit-datetime-edit {
								padding: 0;
							}
							.outing-dt::-webkit-datetime-edit-fields-wrapper {
								padding: 0;
							}
						`}</style>
						<table className="w-max max-w-none min-w-[1100px] table-fixed text-[15px]">
							<thead className="bg-blue-50 border-b border-blue-200 sticky top-0">
								<tr>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[3%]">연번</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[8%]">수급자명</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[5%]">구분</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[9%]">시작일</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[8.5%]">시작시간</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[9%]">종료일</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[8.5%]">종료시간</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[8%]">행선지</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[7%]">목적</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[6%]">보호자</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[5%]">관계</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold border-r border-blue-200 w-[8%]">연락처</th>
									<th className="text-center px-1 py-2 text-blue-900 font-semibold w-[6%]">작업</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={13} className="text-center px-3 py-6 text-blue-900/60">
											로딩 중...
										</td>
									</tr>
								) : rows.length === 0 ? (
									<tr>
										<td colSpan={13} className="text-center px-3 py-6 text-blue-900/60">
											데이터가 없습니다. 하단에서 추가하세요.
										</td>
									</tr>
								) : (
									rows.map((row) => (
										<tr key={row.id} className="border-b border-blue-50 hover:bg-blue-50">
											<td className="text-center px-3 py-3 border-r border-blue-100">{row.serialNo}</td>
											<td className="text-center px-3 py-3 border-r border-blue-100 relative">
												<input
													ref={(el) => {
														searchInputRefs.current[row.id] = el;
													}}
													type="text"
													value={row.beneficiaryName}
													onChange={(e) => {
														updateRow(row.id, { beneficiaryName: e.target.value, pnum: "" });
														if (isEditing(row.id)) handleSearchMember(row.id, e.target.value);
													}}
													disabled={!isEditing(row.id)}
													onFocus={() => {
														if (isEditing(row.id) && row.beneficiaryName.trim()) {
															handleSearchMember(row.id, row.beneficiaryName);
														}
													}}
													onBlur={() => {
														setTimeout(() => {
															setShowSearchResults((prev) => ({ ...prev, [row.id]: false }));
														}, 200);
													}}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
													placeholder="수급자 검색"
												/>
												{row.birthDate && (
													<div className="text-sm text-gray-500 mt-0.5">({row.birthDate})</div>
												)}
												{showSearchResults[row.id] &&
													(searchResults[row.id] || []).length > 0 &&
													typeof document !== "undefined" &&
													createPortal(
														(() => {
															const input = searchInputRefs.current[row.id];
															const rect = input?.getBoundingClientRect();
															if (!rect) return null;
															return (
																<div
																	className="fixed z-[9999] bg-white border border-blue-300 rounded shadow-lg max-h-60 overflow-y-auto text-left text-black"
																	style={{
																		top: `${rect.bottom + 4}px`,
																		left: `${rect.left}px`,
																		width: `${Math.max(rect.width, 200)}px`,
																	}}
																>
																	{(searchResults[row.id] || []).map((member: any, idx: number) => (
																		<div
																			key={idx}
																			onMouseDown={(e) => {
																				e.preventDefault();
																				handleSelectMember(row.id, member);
																			}}
																			className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-blue-100 last:border-b-0 text-black"
																		>
																			<div className="font-medium text-black">{member.P_NM}</div>
																			<div className="text-sm text-black">
																				{member.P_BRDT && `(${formatDateDisplay(member.P_BRDT)})`}
																			</div>
																		</div>
																	))}
																</div>
															);
														})(),
														document.body
													)}
											</td>
											<td className="text-center px-1 py-3 border-r border-blue-100">
												<select
													value={row.gyn}
													onChange={(e) => {
														const gyn = e.target.value as GynCode;
														const patch: Partial<OutingRow> = { gyn };
														if (gyn === "0") {
															patch.endDate = row.startDate || row.endDate;
														}
														updateRow(row.id, patch);
													}}
													disabled={!isEditing(row.id)}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
												>
													<option value="">선택</option>
													<option value="0">외출</option>
													<option value="2">외박</option>
												</select>
											</td>
											<td className="text-center px-0.5 py-3 border-r border-blue-100">
												<input
													type="date"
													value={row.startDate}
													onChange={(e) => {
														const startDate = e.target.value;
														const patch: Partial<OutingRow> = { startDate };
														if (row.gyn === "0") patch.endDate = startDate;
														updateRow(row.id, patch);
													}}
													disabled={!isEditing(row.id)}
													className={`outing-dt ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													} w-full px-0.5 py-1 border border-blue-300 rounded text-center`}
												/>
											</td>
											<td className="text-center px-0.5 py-3 border-r border-blue-100">
												<input
													type="time"
													value={row.startTime}
													onChange={(e) => updateRow(row.id, { startTime: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`outing-dt ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													} w-full px-0.5 py-1 border border-blue-300 rounded text-center`}
												/>
											</td>
											<td className="text-center px-0.5 py-3 border-r border-blue-100">
												<input
													type="date"
													value={row.endDate}
													onChange={(e) => updateRow(row.id, { endDate: e.target.value })}
													disabled={!isEditing(row.id) || row.gyn === "0"}
													className={`outing-dt ${
														isEditing(row.id) && row.gyn !== "0"
															? "bg-white"
															: "bg-gray-100 cursor-not-allowed"
													} w-full px-0.5 py-1 border border-blue-300 rounded text-center`}
												/>
											</td>
											<td className="text-center px-0.5 py-3 border-r border-blue-100">
												<input
													type="time"
													value={row.endTime}
													onChange={(e) => updateRow(row.id, { endTime: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`outing-dt ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													} w-full px-0.5 py-1 border border-blue-300 rounded text-center`}
												/>
											</td>
											<td className="text-center px-1 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.destination}
													onChange={(e) => updateRow(row.id, { destination: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
													placeholder="행선지"
												/>
											</td>
											<td className="text-center px-1 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.purpose}
													onChange={(e) => updateRow(row.id, { purpose: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
													placeholder="목적"
												/>
											</td>
											<td className="text-center px-1 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.guardian}
													onChange={(e) => updateRow(row.id, { guardian: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
													placeholder="보호자"
												/>
											</td>
											<td className="text-center px-1 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.relationship}
													onChange={(e) => updateRow(row.id, { relationship: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
													placeholder="관계"
												/>
											</td>
											<td className="text-center px-1 py-3 border-r border-blue-100">
												<input
													type="text"
													value={row.contact}
													onChange={(e) => updateRow(row.id, { contact: e.target.value })}
													disabled={!isEditing(row.id)}
													className={`w-full min-w-0 px-1 py-1 border border-blue-300 rounded text-center text-sm ${
														isEditing(row.id) ? "bg-white" : "bg-gray-100 cursor-not-allowed"
													}`}
													placeholder="연락처"
												/>
											</td>
											<td className="text-center px-3 py-3">
												<div className="flex justify-center gap-2">
													<button
														type="button"
														onClick={() => handleEditClick(row.id)}
														disabled={saving}
														className={`px-3 py-1 text-sm border rounded font-medium disabled:opacity-50 ${
															isEditing(row.id)
																? "border-green-400 bg-green-200 hover:bg-green-300 text-green-900"
																: "border-blue-400 bg-blue-200 hover:bg-blue-300 text-blue-900"
														}`}
													>
														{isEditing(row.id) ? (saving ? "저장중" : "저장") : "수정"}
													</button>
													<button
														type="button"
														onClick={() => handleDeleteRow(row)}
														disabled={saving}
														className="px-3 py-1 text-sm border border-red-400 rounded bg-red-200 hover:bg-red-300 text-red-900 font-medium disabled:opacity-50"
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
				</div>

				<div className="flex justify-center mt-4">
					<button
						type="button"
						onClick={handleAddRow}
						disabled={loading || saving}
						className="px-6 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50"
					>
						추가
					</button>
				</div>
			</div>
		</div>
	);
}

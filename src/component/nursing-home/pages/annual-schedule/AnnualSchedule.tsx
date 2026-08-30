"use client";

/**
 * @file 연간일정 — 화면 컴포넌트 (AnnualSchedule.tsx)
 *
 * @description
 * 요양원 연간일정 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/annual-schedule
 *
 * @module component/nursing-home/pages/annual-schedule/AnnualSchedule
 */
import React, { useState, useEffect, useMemo } from "react";
import {
	buildAnnualScheduleCalendarPrintHtml,
	buildAnnualScheduleListPrintHtml,
	openPrintPreviewWindow,
} from "./annualSchedulePrint";
import {
	ASSESSMENT_RENEWAL_TYPE,
	assessmentRenewalBadgeClass,
	fetchAssessmentRenewalSchedules,
	isAssessmentRenewal,
	isRenewalOverdue,
	openNeedsAssessmentRecord,
	scheduleDisplayTitle,
	dueCountdownDetail,
	type AssessmentRenewalSchedule,
} from "../../utils/assessmentRenewalSchedule";

interface ScheduleItem {
	id: number | string;
	date: string;
	endDate: string;
	title: string;
	content: string;
	type: string;
	done: boolean;
	source?: "manual" | "assessment-renewal";
	overdue?: boolean;
	pnum?: string;
	savedLabel?: string;
}

function isDoneYn(v: unknown): boolean {
	const s = String(v ?? "").trim().toUpperCase();
	return s === "Y" || s === "1" || s === "TRUE";
}

const SCHEDULE_TYPES = ["행사", "휴무", "교육", "기타"];
const LIST_PAGE_SIZE = 5;

const REPEAT_OPTIONS = [
	{ value: "none", label: "반복 없음" },
	{ value: "weekly", label: "매주" },
	{ value: "monthly", label: "매월" },
	{ value: "yearly", label: "매년" },
] as const;

type RepeatType = (typeof REPEAT_OPTIONS)[number]["value"];

const emptyForm = () => ({
	date: "",
	endDate: "",
	title: "",
	content: "",
	type: "",
	repeatType: "none" as RepeatType,
	repeatUntil: "",
});

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatPeriod(start: string, end?: string): string {
	const s = String(start ?? "").slice(0, 10);
	const e = String(end ?? s).slice(0, 10);
	if (!s) return "-";
	if (!e || e === s) return s;
	return `${s} ~ ${e}`;
}

/** dateStr가 [start, end] 구간에 포함되는지 */
function dateInRange(dateStr: string, start: string, end: string): boolean {
	const d = dateStr.slice(0, 10);
	const s = start.slice(0, 10);
	const e = (end || start).slice(0, 10);
	return d >= s && d <= e;
}

/** 일정이 선택한 년월과 겹치는지 */
function overlapsMonth(start: string, end: string, year: number, month: number): boolean {
	const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	const s = start.slice(0, 10);
	const e = (end || start).slice(0, 10);
	return s <= monthEnd && e >= monthStart;
}

function typeBadgeClass(type?: string, overdue?: boolean, done?: boolean): string {
	if (String(type ?? "").trim() === ASSESSMENT_RENEWAL_TYPE) {
		return assessmentRenewalBadgeClass(Boolean(overdue), Boolean(done));
	}
	switch (String(type ?? "").trim()) {
		case "행사":
			return "bg-blue-200 text-blue-900";
		case "휴무":
			return "bg-amber-200 text-amber-900";
		case "교육":
			return "bg-emerald-200 text-emerald-900";
		case "기타":
			return "bg-slate-200 text-slate-800";
		default:
			return "bg-blue-100 text-blue-900";
	}
}

type WeekDay = { date: Date | null; dateStr: string | null };

function buildCalendarWeeks(leadingBlanks: number, monthDates: Date[]): WeekDay[][] {
	const cells: WeekDay[] = [];
	for (let i = 0; i < leadingBlanks; i++) {
		cells.push({ date: null, dateStr: null });
	}
	for (const d of monthDates) {
		cells.push({ date: d, dateStr: formatDate(d) });
	}
	while (cells.length % 7 !== 0) {
		cells.push({ date: null, dateStr: null });
	}
	const weeks: WeekDay[][] = [];
	for (let i = 0; i < cells.length; i += 7) {
		weeks.push(cells.slice(i, i + 7));
	}
	return weeks;
}

/** 해당 날짜에 겹치는 일정 (칸 안 배지용) */
function schedulesOnDay(dateStr: string, schedules: ScheduleItem[]): ScheduleItem[] {
	return schedules
		.filter((s) => dateInRange(dateStr, s.date, s.endDate || s.date))
		.sort(
			(a, b) =>
				a.date.localeCompare(b.date) ||
				a.title.localeCompare(b.title, "ko") ||
				String(a.id).localeCompare(String(b.id))
		);
}

export default function AnnualSchedule() {
	const [scheduleList, setScheduleList] = useState<ScheduleItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
	const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [facilityName, setFacilityName] = useState("");
	const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
	const [printMode, setPrintMode] = useState<"calendar" | "list">("calendar");
	const [printYear, setPrintYear] = useState(new Date().getFullYear());
	const [printMonths, setPrintMonths] = useState<number[]>([new Date().getMonth() + 1]);
	const [printing, setPrinting] = useState(false);
	const [listPage, setListPage] = useState(1);
	const [formData, setFormData] = useState(emptyForm);

	const filteredSchedules = useMemo(
		() =>
			scheduleList.filter((schedule) =>
				overlapsMonth(schedule.date, schedule.endDate, selectedYear, selectedMonth)
			),
		[scheduleList, selectedYear, selectedMonth]
	);

	const listTotalPages = Math.max(1, Math.ceil(filteredSchedules.length / LIST_PAGE_SIZE));
	const showListPagination = filteredSchedules.length > LIST_PAGE_SIZE;

	const pagedSchedules = useMemo(() => {
		const page = Math.min(Math.max(1, listPage), listTotalPages);
		const start = (page - 1) * LIST_PAGE_SIZE;
		return filteredSchedules.slice(start, start + LIST_PAGE_SIZE);
	}, [filteredSchedules, listPage, listTotalPages]);

	useEffect(() => {
		setListPage(1);
	}, [selectedYear, selectedMonth]);

	useEffect(() => {
		if (listPage > listTotalPages) {
			setListPage(listTotalPages);
		}
	}, [listPage, listTotalPages]);

	const monthDates = useMemo(() => {
		const dates: Date[] = [];
		const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
		for (let i = 1; i <= lastDay; i++) {
			dates.push(new Date(selectedYear, selectedMonth - 1, i));
		}
		return dates;
	}, [selectedYear, selectedMonth]);

	/** 달력 첫 칸 앞 빈 칸 (일요일 시작) */
	const leadingBlanks = useMemo(() => {
		const first = new Date(selectedYear, selectedMonth - 1, 1);
		return first.getDay();
	}, [selectedYear, selectedMonth]);

	const calendarWeeks = useMemo(
		() => buildCalendarWeeks(leadingBlanks, monthDates),
		[leadingBlanks, monthDates]
	);

	const fetchSchedules = async () => {
		setLoading(true);
		try {
			const [response, renewalRows] = await Promise.all([
				fetch(`/api/annual-schedule?year=${selectedYear}`, {
					credentials: "include",
				}),
				fetchAssessmentRenewalSchedules({ year: selectedYear }),
			]);
			const result = await response.json();
			const manual: ScheduleItem[] = result.success
				? (result.data || []).map(
						(r: {
							AS_SEQ: number;
							SCH_DATE?: string;
							SCH_START_DATE?: string;
							SCH_END_DATE?: string;
							TITLE: string;
							CONTENT?: string;
							SCH_TYPE?: string;
							DONE_YN?: string;
						}) => {
							const start = String(r.SCH_DATE ?? r.SCH_START_DATE ?? "").slice(0, 10);
							const end = String(r.SCH_END_DATE ?? start).slice(0, 10) || start;
							return {
								id: r.AS_SEQ,
								date: start,
								endDate: end,
								title: r.TITLE || "",
								content: r.CONTENT || "",
								type: r.SCH_TYPE || "",
								done: isDoneYn(r.DONE_YN),
								source: "manual" as const,
							};
						}
					)
				: [];
			if (!result.success && result.error) {
				console.error(result.error);
			}
			const renewal: ScheduleItem[] = renewalRows.map((r: AssessmentRenewalSchedule) => ({
				...r,
				overdue: isRenewalOverdue(r),
			}));
			setScheduleList(
				[...manual, ...renewal].sort(
					(a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko")
				)
			);
		} catch {
			setScheduleList([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		if (!formData.date || !formData.title.trim()) {
			alert("시작일과 제목을 입력해주세요.");
			return;
		}
		const endDate = formData.endDate || formData.date;
		if (endDate < formData.date) {
			alert("종료일은 시작일보다 빠를 수 없습니다.");
			return;
		}
		if (!isEditMode && formData.repeatType !== "none") {
			if (!formData.repeatUntil) {
				alert("반복 종료일을 입력해주세요.");
				return;
			}
			if (formData.repeatUntil < formData.date) {
				alert("반복 종료일은 시작일보다 빠를 수 없습니다.");
				return;
			}
		}

		setSaving(true);
		try {
			const payload: Record<string, unknown> = {
				SCH_DATE: formData.date,
				SCH_END_DATE: endDate,
				TITLE: formData.title.trim(),
				CONTENT: formData.content,
				SCH_TYPE: formData.type,
			};
			if (isEditMode && selectedSchedule?.id) {
				payload.AS_SEQ = selectedSchedule.id;
			} else if (formData.repeatType !== "none") {
				payload.REPEAT_TYPE = formData.repeatType;
				payload.REPEAT_UNTIL = formData.repeatUntil;
			}

			const response = await fetch("/api/annual-schedule", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || "저장에 실패했습니다.");
			}
			const count = Number(result.count) || 1;
			if (isEditMode) {
				alert("일정이 수정되었습니다.");
			} else if (count > 1) {
				alert(`반복 일정 ${count}건이 등록되었습니다.`);
			} else {
				alert("일정이 등록되었습니다.");
			}
			handleCloseModal();
			await fetchSchedules();
		} catch (err) {
			alert(err instanceof Error ? err.message : "일정 저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedSchedule) {
			alert("삭제할 일정을 선택해주세요.");
			return;
		}
		if (isAssessmentRenewal(selectedSchedule) || typeof selectedSchedule.id !== "number") {
			return;
		}
		if (!confirm(`「${selectedSchedule.title}」 일정을 삭제하시겠습니까?`)) {
			return;
		}

		try {
			const response = await fetch(`/api/annual-schedule?asSeq=${selectedSchedule.id}`, {
				method: "DELETE",
				credentials: "include",
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || "삭제에 실패했습니다.");
			}
			alert("일정이 삭제되었습니다.");
			setSelectedSchedule(null);
			await fetchSchedules();
		} catch (err) {
			alert(err instanceof Error ? err.message : "일정 삭제 중 오류가 발생했습니다.");
		}
	};

	const handleOpenModal = () => {
		setIsEditMode(false);
		setSelectedSchedule(null);
		const d = formatDate(new Date(selectedYear, selectedMonth - 1, 1));
		setFormData({
			...emptyForm(),
			date: d,
			endDate: d,
			repeatUntil: `${selectedYear}-12-31`,
		});
		setIsModalOpen(true);
	};

	const handleOpenEditModal = (schedule: ScheduleItem) => {
		if (isAssessmentRenewal(schedule)) return;
		setIsEditMode(true);
		setSelectedSchedule(schedule);
		setFormData({
			...emptyForm(),
			date: schedule.date,
			endDate: schedule.endDate || schedule.date,
			title: schedule.title,
			content: schedule.content,
			type: schedule.type || "",
		});
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setIsEditMode(false);
		setFormData(emptyForm());
	};

	const handleSelectSchedule = (schedule: ScheduleItem) => {
		setSelectedSchedule(schedule);
	};

	const handleGoWrite = (schedule: ScheduleItem, event?: React.MouseEvent) => {
		event?.preventDefault();
		event?.stopPropagation();
		if (schedule.pnum) openNeedsAssessmentRecord(schedule.pnum);
	};

	const handleToggleDone = async (schedule: ScheduleItem, done: boolean) => {
		if (isAssessmentRenewal(schedule)) return;
		if (typeof schedule.id !== "number") return;
		const prevList = scheduleList;
		const prevSelected = selectedSchedule;
		setScheduleList((list) => list.map((s) => (s.id === schedule.id ? { ...s, done } : s)));
		if (selectedSchedule?.id === schedule.id) {
			setSelectedSchedule({ ...selectedSchedule, done });
		}
		try {
			const response = await fetch("/api/annual-schedule", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "done",
					AS_SEQ: schedule.id,
					DONE_YN: done ? "Y" : "N",
				}),
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || "진행 여부 저장에 실패했습니다.");
			}
		} catch (err) {
			setScheduleList(prevList);
			setSelectedSchedule(prevSelected);
			alert(err instanceof Error ? err.message : "진행 여부 저장 중 오류가 발생했습니다.");
		}
	};

	const handleDateClick = (date: Date) => {
		setIsEditMode(false);
		setSelectedSchedule(null);
		const d = formatDate(date);
		setFormData({
			...emptyForm(),
			date: d,
			endDate: d,
			repeatUntil: `${selectedYear}-12-31`,
		});
		setIsModalOpen(true);
	};

	const handleOpenPrintModal = (mode: "calendar" | "list") => {
		setPrintMode(mode);
		setPrintYear(selectedYear);
		setPrintMonths([selectedMonth]);
		setIsPrintModalOpen(true);
	};

	const handleClosePrintModal = () => {
		if (printing) return;
		setIsPrintModalOpen(false);
	};

	const togglePrintMonth = (month: number) => {
		setPrintMonths((prev) => {
			if (prev.includes(month)) {
				return prev.filter((m) => m !== month).sort((a, b) => a - b);
			}
			return [...prev, month].sort((a, b) => a - b);
		});
	};

	const handleToggleAllPrintMonths = () => {
		setPrintMonths((prev) =>
			prev.length === 12 ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
		);
	};

	const handleConfirmPrint = async () => {
		const selected = [...printMonths].sort((a, b) => a - b);
		if (selected.length === 0) {
			alert("출력할 월을 하나 이상 선택해주세요.");
			return;
		}
		const months = selected.map((month) => ({ year: printYear, month }));
		const first = months[0];
		const last = months[months.length - 1];
		const startDate = `${first.year}-${String(first.month).padStart(2, "0")}-01`;
		const lastDay = new Date(last.year, last.month, 0).getDate();
		const endDate = `${last.year}-${String(last.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

		setPrinting(true);
		try {
			const [response, renewalRows] = await Promise.all([
				fetch(`/api/annual-schedule?startDate=${startDate}&endDate=${endDate}`, {
					credentials: "include",
				}),
				fetchAssessmentRenewalSchedules({ startDate, endDate }),
			]);
			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.error || "일정 조회에 실패했습니다.");
			}
			const manual = (result.data || []).map(
				(r: {
					SCH_DATE?: string;
					SCH_START_DATE?: string;
					SCH_END_DATE?: string;
					TITLE: string;
					CONTENT?: string;
					SCH_TYPE?: string;
					DONE_YN?: string;
				}) => {
					const start = String(r.SCH_DATE ?? r.SCH_START_DATE ?? "").slice(0, 10);
					const end = String(r.SCH_END_DATE ?? start).slice(0, 10) || start;
					return {
						date: start,
						endDate: end,
						title: r.TITLE || "",
						content: r.CONTENT || "",
						type: r.SCH_TYPE || "",
						done: isDoneYn(r.DONE_YN),
					};
				}
			);
			const renewal = renewalRows.map((r) => ({
				date: r.date,
				endDate: r.endDate,
				title: scheduleDisplayTitle(r),
				content: r.content,
				type: r.type,
				done: r.done,
				overdue: isRenewalOverdue(r),
			}));
			const schedules = [...manual, ...renewal];

			const printData = {
				facilityName,
				months,
				schedules,
			};
			const html =
				printMode === "calendar"
					? buildAnnualScheduleCalendarPrintHtml(printData)
					: buildAnnualScheduleListPrintHtml(printData);
			openPrintPreviewWindow(html);
			setIsPrintModalOpen(false);
		} catch (err) {
			alert(err instanceof Error ? err.message : "출력 중 오류가 발생했습니다.");
		} finally {
			setPrinting(false);
		}
	};

	const printRangeLabel = useMemo(() => {
		if (printMonths.length === 0) return "선택된 월 없음";
		const sorted = [...printMonths].sort((a, b) => a - b);
		return `${printYear}년 ${sorted.map((m) => `${m}월`).join(", ")}`;
	}, [printYear, printMonths]);

	const handleMonthChange = (delta: number) => {
		let newMonth = selectedMonth + delta;
		let newYear = selectedYear;
		if (newMonth > 12) {
			newMonth = 1;
			newYear += 1;
		} else if (newMonth < 1) {
			newMonth = 12;
			newYear -= 1;
		}
		setSelectedMonth(newMonth);
		setSelectedYear(newYear);
	};

	const handleYearMonthPick = (value: string) => {
		const m = /^(\d{4})-(\d{2})$/.exec(String(value || "").trim());
		if (!m) return;
		const y = parseInt(m[1], 10);
		const mo = parseInt(m[2], 10);
		if (!Number.isFinite(y) || mo < 1 || mo > 12) return;
		setSelectedYear(y);
		setSelectedMonth(mo);
	};

	const handleToday = () => {
		const today = new Date();
		setSelectedYear(today.getFullYear());
		setSelectedMonth(today.getMonth() + 1);
	};

	const handleClose = () => {
		if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
	};

	const yearMonthValue = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

	useEffect(() => {
		fetchSchedules();
		setSelectedSchedule(null);
	}, [selectedYear]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/auth/user-info", {
					credentials: "include",
					cache: "no-store",
				});
				const json = await res.json();
				if (!cancelled && json?.success && json?.data?.annm) {
					setFacilityName(String(json.data.annm));
				}
			} catch {
				/* ignore */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="border-b border-blue-200 bg-blue-50/50 p-4">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h1 className="rounded border border-blue-300 bg-blue-100 px-4 py-2 text-base font-semibold text-blue-900">
						연간 일정
					</h1>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => handleMonthChange(-1)}
							className="rounded border border-blue-400 bg-blue-200 px-2 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							aria-label="이전 달"
						>
							◀
						</button>
						<input
							type="month"
							value={yearMonthValue}
							onChange={(e) => handleYearMonthPick(e.target.value)}
							className="rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
							aria-label="년월 선택"
						/>
						<button
							type="button"
							onClick={() => handleMonthChange(1)}
							className="rounded border border-blue-400 bg-blue-200 px-2 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							aria-label="다음 달"
						>
							▶
						</button>
						<button
							type="button"
							onClick={handleToday}
							className="rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
						>
							오늘
						</button>
					</div>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => handleOpenPrintModal("calendar")}
							className="rounded border border-blue-400 bg-blue-200 px-4 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
						>
							달력형 출력
						</button>
						<button
							type="button"
							onClick={() => handleOpenPrintModal("list")}
							className="rounded border border-blue-400 bg-blue-200 px-4 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
						>
							목록형 출력
						</button>
						<button
							type="button"
							onClick={handleOpenModal}
							className="rounded border border-blue-500 bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
						>
							일정 등록
						</button>
					</div>
				</div>
			</div>

			<div className="flex flex-col xl:flex-row flex-1 gap-4 p-4 overflow-hidden min-w-0 min-h-0">
				{/* 왼쪽: 월별 캘린더 */}
				<div className="flex-1 flex flex-col rounded-lg border border-blue-300 bg-white overflow-hidden min-w-0">
					<div className="border-b border-blue-200 bg-blue-100 px-4 py-2 font-semibold text-blue-900 shrink-0">
						{selectedYear}년 {selectedMonth}월
					</div>
					<div className="flex-1 overflow-auto p-4">
						{loading ? (
							<div className="flex h-40 items-center justify-center text-blue-900/60">로딩 중...</div>
						) : (
							<div className="rounded-lg border border-blue-300 overflow-hidden">
								<div className="grid grid-cols-7 bg-blue-50 border-b border-blue-200">
									{["일", "월", "화", "수", "목", "금", "토"].map((day) => (
										<div
											key={day}
											className={`text-center font-semibold py-2 text-sm border-r border-blue-200 last:border-r-0 ${
												day === "일"
													? "text-red-600"
													: day === "토"
														? "text-blue-600"
														: "text-blue-900"
											}`}
										>
											{day}
										</div>
									))}
								</div>
								{calendarWeeks.map((week, wi) => (
									<div
										key={`week-${wi}`}
										className="grid grid-cols-7 border-b border-blue-200 last:border-b-0"
									>
										{week.map((cell, ci) => {
											if (!cell.date || !cell.dateStr) {
												return (
													<div
														key={`empty-${wi}-${ci}`}
														className="min-h-[8.5rem] border-r border-blue-100 bg-slate-50/60 last:border-r-0"
													/>
												);
											}
											const dateStr = cell.dateStr;
											const dow = cell.date.getDay();
											const isToday = formatDate(new Date()) === dateStr;
											const isSelected =
												selectedSchedule != null &&
												dateInRange(
													dateStr,
													selectedSchedule.date,
													selectedSchedule.endDate || selectedSchedule.date
												);
											const daySchedules = schedulesOnDay(dateStr, filteredSchedules);
											return (
												<div
													key={dateStr}
													onClick={() => handleDateClick(cell.date!)}
													className={`min-h-[8.5rem] border-r border-blue-100 last:border-r-0 cursor-pointer flex flex-col px-1 pt-1 pb-1 hover:bg-blue-50/80 ${
														isToday ? "bg-blue-100/70" : "bg-white"
													} ${isSelected ? "ring-2 ring-inset ring-blue-500" : ""}`}
												>
													<span
														className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
															isToday
																? "bg-blue-500 text-white"
																: dow === 0
																	? "text-red-600"
																	: dow === 6
																		? "text-blue-600"
																		: "text-blue-900"
														}`}
													>
														{cell.date.getDate()}
													</span>
													<div className="mt-0.5 flex min-h-0 flex-col gap-0.5">
														{daySchedules.map((schedule) => {
															const overdue = isRenewalOverdue(schedule);
															const renewal = isAssessmentRenewal(schedule);
															const label = scheduleDisplayTitle({
																...schedule,
																overdue,
															});
															return (
																<button
																	key={schedule.id}
																	type="button"
																	title={`${schedule.done ? "[완료] " : overdue ? "[미작성·마감] " : ""}${label} (${formatPeriod(schedule.date, schedule.endDate)})`}
																	onClick={(e) => {
																		e.stopPropagation();
																		handleSelectSchedule(schedule);
																	}}
																	className={`w-full truncate rounded-full px-2 py-0.5 text-left text-xs font-medium leading-tight ${typeBadgeClass(
																		schedule.type,
																		overdue,
																		schedule.done && renewal
																	)} ${
																		selectedSchedule?.id === schedule.id
																			? "ring-2 ring-blue-600"
																			: ""
																	} ${schedule.done && !renewal ? "line-through opacity-80" : ""} hover:brightness-95`}
																>
																	{schedule.done ? "✓ " : ""}
																	{label}
																</button>
															);
														})}
													</div>
												</div>
											);
										})}
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* 오른쪽: 일정 목록 */}
				<div className="w-full max-w-full lg:w-96 min-w-0 shrink-0 flex flex-col rounded-lg border border-blue-300 bg-white overflow-hidden">
					<div className="border-b border-blue-200 bg-blue-100 px-3 py-2 font-semibold text-blue-900 shrink-0">
						<div>일정 목록 ({filteredSchedules.length}개)</div>
						<div className="mt-0.5 text-[11px] font-normal text-blue-800/80">
							체크하면 진행 완료로 표시됩니다
						</div>
					</div>
					{showListPagination && (
						<div className="border-b border-blue-200 bg-blue-50 px-2 py-2 flex items-center justify-center gap-1 shrink-0">
							<button
								type="button"
								onClick={() => setListPage((p) => Math.max(1, p - 1))}
								disabled={listPage <= 1}
								className="rounded border border-blue-400 bg-blue-200 px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-40"
							>
								◀
							</button>
							{Array.from({ length: listTotalPages }, (_, i) => i + 1).map((pageNum) => (
								<button
									key={pageNum}
									type="button"
									onClick={() => setListPage(pageNum)}
									className={`min-w-[1.75rem] rounded border px-1.5 py-1 text-xs font-medium ${
										listPage === pageNum
											? "border-blue-500 bg-blue-500 text-white"
											: "border-blue-400 bg-blue-200 text-blue-900 hover:bg-blue-300"
									}`}
								>
									{pageNum}
								</button>
							))}
							<button
								type="button"
								onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
								disabled={listPage >= listTotalPages}
								className="rounded border border-blue-400 bg-blue-200 px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-40"
							>
								▶
							</button>
						</div>
					)}
					<div className="flex-1 overflow-auto min-h-0">
						{loading ? (
							<div className="px-3 py-8 text-center text-blue-900/60">로딩 중...</div>
						) : filteredSchedules.length === 0 ? (
							<div className="px-3 py-8 text-center text-blue-900/60">일정이 없습니다</div>
						) : (
							<div className="p-2 space-y-2">
								{pagedSchedules.map((schedule) => {
									const renewal = isAssessmentRenewal(schedule);
									const overdue = isRenewalOverdue(schedule);
									const doneGreen = renewal && schedule.done;
									return (
									<div
										key={schedule.id}
										onClick={() => handleSelectSchedule(schedule)}
										className={`border rounded p-3 cursor-pointer hover:bg-blue-50 ${
											overdue
												? "border-red-400 bg-red-50 hover:bg-red-50"
												: doneGreen
													? "border-lime-400 bg-lime-50 hover:bg-lime-50"
													: "border-blue-200"
										} ${
											selectedSchedule?.id === schedule.id
												? overdue
													? "bg-red-100 border-red-500"
													: doneGreen
														? "bg-lime-100 border-lime-500"
														: "bg-blue-100 border-blue-400"
												: ""
										}`}
									>
										<div className="flex items-start gap-2">
											<label
												className="mt-0.5 flex shrink-0 items-center gap-1"
												onClick={(e) => e.stopPropagation()}
											>
												<input
													type="checkbox"
													checked={schedule.done}
													disabled={renewal}
													onChange={(e) => void handleToggleDone(schedule, e.target.checked)}
													className="h-4 w-4 accent-blue-600 disabled:opacity-80"
													aria-label={`${schedule.title} 진행 완료`}
												/>
												<span className="text-[11px] text-blue-800">완료</span>
											</label>
											<div className="min-w-0 flex-1">
												<div
													className={`text-sm font-semibold mb-1 ${
														overdue
															? "text-red-700"
															: doneGreen
																? "text-lime-900"
																: "text-blue-900"
													} ${schedule.done && !renewal ? "line-through opacity-80" : ""}`}
												>
													{scheduleDisplayTitle({ ...schedule, overdue })}
												</div>
												<div className={`text-xs mb-1 ${overdue ? "text-red-600" : doneGreen ? "text-lime-800" : "text-blue-700"}`}>
													{formatPeriod(schedule.date, schedule.endDate)}
												</div>
												{renewal && !schedule.done ? (
													<div
														className={`mb-1 text-xs font-semibold ${
															overdue ? "text-red-700" : "text-violet-800"
														}`}
													>
														{dueCountdownDetail(schedule.endDate)}
													</div>
												) : null}
												{schedule.content && (
													<div className="text-xs text-blue-900/70 line-clamp-4 whitespace-pre-line">
														{schedule.content}
													</div>
												)}
												{schedule.type && (
													<div
														className={`inline-block text-xs mt-1 px-1.5 py-0.5 rounded ${typeBadgeClass(schedule.type, overdue, doneGreen)}`}
													>
														{schedule.type}
													</div>
												)}
												{renewal && schedule.pnum && !schedule.done ? (
													<button
														type="button"
														onClick={(e) => handleGoWrite(schedule, e)}
														className="mt-2 w-full rounded border border-violet-500 bg-violet-500 px-2 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
													>
														작성하러가기
													</button>
												) : null}
											</div>
										</div>
									</div>
									);
								})}
							</div>
						)}
					</div>
					{selectedSchedule &&
						isAssessmentRenewal(selectedSchedule) &&
						selectedSchedule.pnum &&
						!selectedSchedule.done && (
						<div className="border-t border-blue-200 bg-blue-50 p-3 space-y-2 shrink-0">
							<button
								type="button"
								onClick={(e) => handleGoWrite(selectedSchedule, e)}
								className="w-full rounded border border-violet-500 bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600"
							>
								작성하러가기
							</button>
						</div>
					)}
					{selectedSchedule && !isAssessmentRenewal(selectedSchedule) && (
						<div className="border-t border-blue-200 bg-blue-50 p-3 space-y-2 shrink-0">
							<button
								type="button"
								onClick={() => handleOpenEditModal(selectedSchedule)}
								className="w-full rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								수정
							</button>
							<button
								type="button"
								onClick={handleDelete}
								className="w-full rounded border border-red-400 bg-red-200 px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-300"
							>
								삭제
							</button>
						</div>
					)}
				</div>
			</div>

			{isPrintModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div className="w-full max-w-md rounded-lg border border-blue-300 bg-white shadow-lg">
						<div className="border-b border-blue-200 bg-blue-100 px-5 py-3 flex items-center justify-between">
							<h2 className="text-base font-semibold text-blue-900">
								{printMode === "calendar" ? "달력형 출력" : "목록형 출력"}
							</h2>
							<button
								type="button"
								onClick={handleClosePrintModal}
								disabled={printing}
								className="rounded border border-blue-400 bg-blue-200 px-3 py-1 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
							>
								닫기
							</button>
						</div>
						<div className="p-5 space-y-4">
							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
									년도
								</label>
								<select
									value={printYear}
									onChange={(e) => setPrintYear(parseInt(e.target.value, 10))}
									className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								>
									{Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(
										(y) => (
											<option key={y} value={y}>
												{y}년
											</option>
										)
									)}
								</select>
							</div>
							<div>
								<div className="mb-2 flex items-center justify-between gap-2">
									<label className="px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
										월 선택
									</label>
									<button
										type="button"
										onClick={handleToggleAllPrintMonths}
										className="rounded border border-blue-400 bg-blue-200 px-2 py-1 text-xs font-medium text-blue-900 hover:bg-blue-300"
									>
										{printMonths.length === 12 ? "전체 해제" : "전체 선택"}
									</button>
								</div>
								<div className="grid grid-cols-4 gap-2 rounded border border-blue-200 bg-white p-3">
									{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
										const checked = printMonths.includes(m);
										return (
											<label
												key={m}
												className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm ${
													checked
														? "border-blue-400 bg-blue-100 text-blue-900"
														: "border-blue-200 bg-white text-blue-900/80"
												}`}
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={() => togglePrintMonth(m)}
													className="h-4 w-4 accent-blue-600"
												/>
												<span>{m}월</span>
											</label>
										);
									})}
								</div>
							</div>
							<div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
								출력 기간: <span className="font-semibold">{printRangeLabel}</span>
							</div>
						</div>
						<div className="border-t border-blue-200 bg-blue-50 px-5 py-3 flex justify-end gap-2">
							<button
								type="button"
								onClick={handleClosePrintModal}
								disabled={printing}
								className="rounded border border-blue-400 bg-blue-200 px-4 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
							>
								취소
							</button>
							<button
								type="button"
								onClick={handleConfirmPrint}
								disabled={printing}
								className="rounded border border-blue-500 bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
							>
								{printing ? "준비 중..." : "출력"}
							</button>
						</div>
					</div>
				</div>
			)}

			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div className="w-full max-w-2xl rounded-lg border border-blue-300 bg-white shadow-lg">
						<div className="border-b border-blue-200 bg-blue-100 px-6 py-4 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-blue-900">
								{isEditMode ? "일정 수정" : "일정 등록"}
							</h2>
							<button
								type="button"
								onClick={handleCloseModal}
								className="rounded border border-blue-400 bg-blue-200 px-4 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								닫기
							</button>
						</div>
						<div className="p-6 space-y-4">
							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
									시작일
								</label>
								<input
									type="date"
									value={formData.date}
									onChange={(e) => {
										const next = e.target.value;
										setFormData((prev) => ({
											...prev,
											date: next,
											endDate:
												!prev.endDate || prev.endDate < next ? next : prev.endDate,
										}));
									}}
									className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
									종료일
								</label>
								<input
									type="date"
									value={formData.endDate || formData.date}
									min={formData.date || undefined}
									onChange={(e) =>
										setFormData({ ...formData, endDate: e.target.value })
									}
									className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								/>
							</div>
							<p className="text-xs text-blue-900/60 -mt-2 pl-28">
								하루 일정이면 시작일·종료일을 같게 두세요.
							</p>
							{!isEditMode && (
								<>
									<div className="flex items-center gap-2">
										<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
											반복
										</label>
										<select
											value={formData.repeatType}
											onChange={(e) =>
												setFormData({
													...formData,
													repeatType: e.target.value as RepeatType,
												})
											}
											className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
										>
											{REPEAT_OPTIONS.map((opt) => (
												<option key={opt.value} value={opt.value}>
													{opt.label}
												</option>
											))}
										</select>
									</div>
									{formData.repeatType !== "none" && (
										<div className="flex items-center gap-2">
											<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
												반복 종료
											</label>
											<input
												type="date"
												value={formData.repeatUntil}
												min={formData.date || undefined}
												onChange={(e) =>
													setFormData({ ...formData, repeatUntil: e.target.value })
												}
												className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
											/>
										</div>
									)}
									{formData.repeatType !== "none" && (
										<p className="text-xs text-blue-900/60 -mt-2 pl-28">
											반복 종료일까지 동일 일정이 각각 등록됩니다.
										</p>
									)}
								</>
							)}
							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
									제목
								</label>
								<input
									type="text"
									value={formData.title}
									onChange={(e) => setFormData({ ...formData, title: e.target.value })}
									placeholder="일정 제목을 입력하세요"
									className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								/>
							</div>
							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
									유형
								</label>
								<select
									value={formData.type}
									onChange={(e) => setFormData({ ...formData, type: e.target.value })}
									className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								>
									<option value="">선택</option>
									{SCHEDULE_TYPES.map((t) => (
										<option key={t} value={t}>
											{t}
										</option>
									))}
								</select>
							</div>
							<div className="flex items-start gap-2">
								<label className="w-24 shrink-0 px-2 py-1.5 text-sm font-medium bg-blue-100 border border-blue-300 rounded text-blue-900">
									내용
								</label>
								<textarea
									value={formData.content}
									onChange={(e) => setFormData({ ...formData, content: e.target.value })}
									rows={4}
									placeholder="일정 내용을 입력하세요"
									className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none resize-y"
								/>
							</div>
						</div>
						<div className="border-t border-blue-200 bg-blue-50 px-6 py-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={handleCloseModal}
								disabled={saving}
								className="rounded border border-blue-400 bg-blue-200 px-6 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
							>
								취소
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								className="rounded border border-blue-500 bg-blue-500 px-6 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
							>
								{saving ? "저장 중..." : "저장"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

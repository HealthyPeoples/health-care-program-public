"use client";

/**
 * @file 메인 대시보드 — 화면 컴포넌트 (HomeDashboard.tsx)
 *
 * @description
 * 탭이 하나도 열려 있지 않을 때 본문에 표시하는 미리보기입니다.
 * 공지사항·자료실·연간일정(달력/목록)을 2x2로 보여 주고, 클릭 시 해당 탭을 엽니다.
 * 연간일정 목록의 완료 체크는 메인에서도 바로 저장합니다.
 *
 * @module component/nursing-home/pages/home-dashboard/HomeDashboard
 */
import React, { useEffect, useMemo, useState } from "react";
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

const PREVIEW_LIMIT = 5;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

interface NoticePreview {
	seq: number;
	orgLabel: string;
	startDate: string;
	title: string;
}

interface DataRoomPreview {
	id: string;
	orgLabel: string;
	category: string;
	title: string;
	attachLabel: string;
}

interface SchedulePreview {
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

type WeekDay = { date: Date | null; dateStr: string | null };

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDate(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateYmd(v: unknown): string {
	if (v == null || v === "") return "";
	const s = String(v).trim();
	if (s.includes("T")) return s.split("T")[0].slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	return s.length >= 10 ? s.slice(0, 10) : s;
}

function toText(v: unknown): string {
	if (v == null) return "";
	return String(v).trim();
}

function isDoneYn(v: unknown): boolean {
	const s = String(v ?? "").trim().toUpperCase();
	return s === "Y" || s === "1" || s === "TRUE";
}

function formatPeriod(start: string, end?: string): string {
	const s = String(start ?? "").slice(0, 10);
	const e = String(end ?? s).slice(0, 10);
	if (!s) return "-";
	if (!e || e === s) return s;
	return `${s} ~ ${e}`;
}

function dateInRange(dateStr: string, start: string, end: string): boolean {
	const d = dateStr.slice(0, 10);
	const s = start.slice(0, 10);
	const e = (end || start).slice(0, 10);
	return d >= s && d <= e;
}

function overlapsMonth(start: string, end: string, year: number, month: number): boolean {
	const monthStart = `${year}-${pad2(month)}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const monthEnd = `${year}-${pad2(month)}-${pad2(lastDay)}`;
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

function schedulesOnDay(dateStr: string, schedules: SchedulePreview[]): SchedulePreview[] {
	return schedules
		.filter((s) => dateInRange(dateStr, s.date, s.endDate || s.date))
		.sort(
			(a, b) =>
				a.date.localeCompare(b.date) ||
				a.title.localeCompare(b.title, "ko") ||
				String(a.id).localeCompare(String(b.id))
		);
}

function attachLabel(fileCount: number, files: Array<{ fileName?: string }>): string {
	if (fileCount <= 0) return "-";
	if (fileCount === 1) return files[0]?.fileName || "1개";
	return `${fileCount}개`;
}

function openTab(href: string, title: string) {
	window.dispatchEvent(new CustomEvent("NH_OPEN_TAB", { detail: { href, title } }));
}

function DashPanel({
	title,
	headerCenter,
	onOpen,
	children,
}: {
	title?: string;
	headerCenter?: React.ReactNode;
	onOpen: () => void;
	children: React.ReactNode;
}) {
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpen();
				}
			}}
			className="flex min-h-[280px] min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-blue-300 bg-white text-left shadow-sm transition hover:border-blue-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 lg:min-h-0"
		>
			<div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-blue-200 bg-blue-100 px-3 py-2">
				<div className="min-w-0">
					{headerCenter ? null : (
						<span className="text-sm font-semibold text-blue-900">{title}</span>
					)}
				</div>
				<div className="justify-self-center">{headerCenter}</div>
				<span className="justify-self-end text-xs font-normal text-blue-700/70">더보기</span>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
		</div>
	);
}

interface AnnualScheduleApiRow {
	AS_SEQ: number;
	SCH_DATE?: string;
	SCH_START_DATE?: string;
	SCH_END_DATE?: string;
	TITLE: string;
	CONTENT?: string;
	SCH_TYPE?: string;
	DONE_YN?: string;
}

function mapScheduleRows(rows: AnnualScheduleApiRow[]): SchedulePreview[] {
	return rows.map((r) => {
		const startDate = String(r.SCH_DATE ?? r.SCH_START_DATE ?? "").slice(0, 10);
		const endDate = String(r.SCH_END_DATE ?? startDate).slice(0, 10) || startDate;
		return {
			id: r.AS_SEQ,
			date: startDate,
			endDate,
			title: r.TITLE || "",
			content: r.CONTENT || "",
			type: r.SCH_TYPE || "",
			done: isDoneYn(r.DONE_YN),
			source: "manual" as const,
		};
	});
}

export default function HomeDashboard() {
	const today = useMemo(() => new Date(), []);
	const todayStr = formatDate(today);
	const [selectedYear, setSelectedYear] = useState(() => today.getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(() => today.getMonth() + 1);

	const [notices, setNotices] = useState<NoticePreview[]>([]);
	const [dataRooms, setDataRooms] = useState<DataRoomPreview[]>([]);
	const [schedules, setSchedules] = useState<SchedulePreview[]>([]);
	const [loadingNotices, setLoadingNotices] = useState(true);
	const [loadingData, setLoadingData] = useState(true);
	const [loadingSchedules, setLoadingSchedules] = useState(true);

	const monthDates = useMemo(() => {
		const dates: Date[] = [];
		const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
		for (let i = 1; i <= lastDay; i++) {
			dates.push(new Date(selectedYear, selectedMonth - 1, i));
		}
		return dates;
	}, [selectedYear, selectedMonth]);

	const leadingBlanks = useMemo(
		() => new Date(selectedYear, selectedMonth - 1, 1).getDay(),
		[selectedYear, selectedMonth]
	);

	const calendarWeeks = useMemo(
		() => buildCalendarWeeks(leadingBlanks, monthDates),
		[leadingBlanks, monthDates]
	);

	const monthSchedules = useMemo(
		() =>
			schedules
				.filter((s) => overlapsMonth(s.date, s.endDate, selectedYear, selectedMonth))
				.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
		[schedules, selectedYear, selectedMonth]
	);

	const handleMonthChange = (event: React.MouseEvent | React.KeyboardEvent, delta: number) => {
		event.preventDefault();
		event.stopPropagation();
		let nextMonth = selectedMonth + delta;
		let nextYear = selectedYear;
		if (nextMonth > 12) {
			nextMonth = 1;
			nextYear += 1;
		} else if (nextMonth < 1) {
			nextMonth = 12;
			nextYear -= 1;
		}
		setSelectedMonth(nextMonth);
		setSelectedYear(nextYear);
	};

	const handleYearMonthPick = (event: React.ChangeEvent<HTMLInputElement>) => {
		event.stopPropagation();
		const matched = /^(\d{4})-(\d{2})$/.exec(String(event.target.value || "").trim());
		if (!matched) return;
		const nextYear = parseInt(matched[1], 10);
		const nextMonth = parseInt(matched[2], 10);
		if (!Number.isFinite(nextYear) || nextMonth < 1 || nextMonth > 12) return;
		setSelectedYear(nextYear);
		setSelectedMonth(nextMonth);
	};

	const handleToggleDone = async (
		event: React.ChangeEvent<HTMLInputElement>,
		schedule: SchedulePreview
	) => {
		event.stopPropagation();
		if (isAssessmentRenewal(schedule) || typeof schedule.id !== "number") return;
		const done = event.target.checked;
		const prevList = schedules;
		setSchedules((list) => list.map((s) => (s.id === schedule.id ? { ...s, done } : s)));
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
			setSchedules(prevList);
			alert(err instanceof Error ? err.message : "진행 여부 저장 중 오류가 발생했습니다.");
		}
	};

	const yearMonthValue = `${selectedYear}-${pad2(selectedMonth)}`;

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			try {
				const userRes = await fetch("/api/auth/user-info", { credentials: "include" });
				const userJson = await userRes.json().catch(() => ({}));
				const ancd = String(userJson?.data?.ancd ?? "").trim() || "all";

				const periodEnd = formatDate(today);
				const start = new Date(today);
				start.setFullYear(start.getFullYear() - 1);
				const periodStart = formatDate(start);

				const noticeQs = new URLSearchParams({
					ancd,
					startDate: periodStart,
					endDate: periodEnd,
				});
				const dataQs = new URLSearchParams({ ancd });

				const [noticeRes, dataRes] = await Promise.all([
					fetch(`/api/f60030?${noticeQs.toString()}`, { credentials: "include" }),
					fetch(`/api/data-room?${dataQs.toString()}`, {
						credentials: "include",
						cache: "no-store",
					}),
				]);

				const [noticeJson, dataJson] = await Promise.all([
					noticeRes.json().catch(() => ({})),
					dataRes.json().catch(() => ({})),
				]);

				if (cancelled) return;

				if (noticeRes.ok && noticeJson?.success && Array.isArray(noticeJson.data)) {
					setNotices(
						noticeJson.data.slice(0, PREVIEW_LIMIT).map(
							(n: { SEQ?: number; ANNM?: unknown; ANCD?: unknown; SDT?: unknown; MDOC?: unknown }) => ({
								seq: n.SEQ ?? 0,
								orgLabel: toText(n.ANNM) || (n.ANCD != null ? String(n.ANCD) : "-"),
								startDate: formatDateYmd(n.SDT) || "-",
								title: toText(n.MDOC),
							})
						)
					);
				} else {
					setNotices([]);
				}

				if (dataRes.ok && dataJson?.success && Array.isArray(dataJson.data)) {
					setDataRooms(
						dataJson.data.slice(0, PREVIEW_LIMIT).map(
							(p: {
								id?: unknown;
								drSeq?: unknown;
								annm?: unknown;
								ancd?: unknown;
								category?: unknown;
								title?: unknown;
								fileCount?: unknown;
								files?: Array<{ fileName?: string }>;
							}) => {
								const fileCount = Number(p.fileCount) || (Array.isArray(p.files) ? p.files.length : 0);
								return {
									id: String(p.id ?? p.drSeq ?? ""),
									orgLabel: toText(p.annm) || toText(p.ancd) || "-",
									category: toText(p.category) || "-",
									title: toText(p.title),
									attachLabel: attachLabel(fileCount, Array.isArray(p.files) ? p.files : []),
								};
							}
						)
					);
				} else {
					setDataRooms([]);
				}
			} catch (err) {
				console.error("메인 대시보드 조회 실패:", err);
				if (!cancelled) {
					setNotices([]);
					setDataRooms([]);
				}
			} finally {
				if (!cancelled) {
					setLoadingNotices(false);
					setLoadingData(false);
				}
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, [today]);

	useEffect(() => {
		let cancelled = false;
		setLoadingSchedules(true);

		const loadSchedules = async () => {
			try {
				const [schRes, renewalRows] = await Promise.all([
					fetch(`/api/annual-schedule?year=${selectedYear}`, {
						credentials: "include",
					}),
					fetchAssessmentRenewalSchedules({ year: selectedYear }),
				]);
				const schJson = await schRes.json().catch(() => ({}));
				if (cancelled) return;
				const manual =
					schRes.ok && schJson?.success && Array.isArray(schJson.data)
						? mapScheduleRows(schJson.data as AnnualScheduleApiRow[])
						: [];
				const renewal: SchedulePreview[] = renewalRows.map((r: AssessmentRenewalSchedule) => ({
					...r,
					overdue: isRenewalOverdue(r),
				}));
				setSchedules(
					[...manual, ...renewal].sort(
						(a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko")
					)
				);
			} catch (err) {
				console.error("메인 대시보드 일정 조회 실패:", err);
				if (!cancelled) setSchedules([]);
			} finally {
				if (!cancelled) setLoadingSchedules(false);
			}
		};

		void loadSchedules();
		return () => {
			cancelled = true;
		};
	}, [selectedYear]);

	const openNotice = () => openTab("/nursingHome/notice-inquiry", "공지사항 조회");
	const openDataRoom = () => openTab("/nursingHome/data-room", "자료실");
	const openAnnual = () => openTab("/nursingHome/annual-schedule", "연간 일정 등록 및 조회");

	return (
		<div className="box-border flex h-[calc(100vh-56px)] min-h-[600px] w-full min-w-0 flex-col overflow-auto bg-slate-50 p-3">
			<div className="grid min-h-full grid-cols-1 gap-3 lg:h-full lg:min-h-0 lg:grid-cols-2 lg:grid-rows-2">
				<DashPanel title="공지사항" onOpen={openNotice}>
					<div className="h-full overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-50">
								<tr>
									<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
										기관
									</th>
									<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
										시작일
									</th>
									<th className="px-3 py-2 text-left font-semibold text-blue-900">제목</th>
								</tr>
							</thead>
							<tbody>
								{loadingNotices ? (
									<tr>
										<td colSpan={3} className="px-3 py-10 text-center text-blue-900/60">
											불러오는 중...
										</td>
									</tr>
								) : notices.length === 0 ? (
									<tr>
										<td colSpan={3} className="px-3 py-10 text-center text-blue-900/60">
											데이터가 없습니다.
										</td>
									</tr>
								) : (
									notices.map((n) => (
										<tr key={n.seq} className="border-b border-blue-50">
											<td className="border-r border-blue-100 px-3 py-2 text-blue-900">{n.orgLabel}</td>
											<td className="whitespace-nowrap border-r border-blue-100 px-3 py-2 text-blue-900">
												{n.startDate}
											</td>
											<td className="max-w-0 truncate px-3 py-2 text-blue-900" title={n.title}>
												{n.title}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</DashPanel>

				<DashPanel
					onOpen={openAnnual}
					headerCenter={
						<div
							className="flex items-center gap-1"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
						>
							<button
								type="button"
								onClick={(e) => handleMonthChange(e, -1)}
								className="rounded border border-blue-400 bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-900 hover:bg-blue-300"
								aria-label="이전 달"
							>
								◀
							</button>
							<input
								type="month"
								value={yearMonthValue}
								onChange={handleYearMonthPick}
								onClick={(e) => e.stopPropagation()}
								className="rounded border border-blue-300 bg-white px-2 py-0.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
								aria-label="년월 선택"
							/>
							<button
								type="button"
								onClick={(e) => handleMonthChange(e, 1)}
								className="rounded border border-blue-400 bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-900 hover:bg-blue-300"
								aria-label="다음 달"
							>
								▶
							</button>
						</div>
					}
				>
					<div className="flex h-full min-h-0 flex-col p-2">
						{loadingSchedules ? (
							<div className="flex flex-1 items-center justify-center text-sm text-blue-900/60">
								불러오는 중...
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-blue-300">
								<div className="grid shrink-0 grid-cols-7 border-b border-blue-200 bg-blue-50">
									{WEEKDAYS.map((day) => (
										<div
											key={day}
											className={`border-r border-blue-200 py-1 text-center text-xs font-semibold last:border-r-0 ${
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
								<div className="flex min-h-0 flex-1 flex-col">
									{calendarWeeks.map((week, wi) => (
										<div
											key={`week-${wi}`}
											className="grid min-h-0 flex-1 grid-cols-7 border-b border-blue-200 last:border-b-0"
										>
											{week.map((cell, ci) => {
												if (!cell.date || !cell.dateStr) {
													return (
														<div
															key={`empty-${wi}-${ci}`}
															className="min-h-0 border-r border-blue-100 bg-slate-50/60 last:border-r-0"
														/>
													);
												}
												const dateStr = cell.dateStr;
												const dow = cell.date.getDay();
												const isToday = dateStr === todayStr;
												const daySchedules = schedulesOnDay(dateStr, monthSchedules);
												const shown = daySchedules.slice(0, 2);
												const extra = daySchedules.length - shown.length;
												return (
													<div
														key={dateStr}
														className={`flex min-h-0 flex-col overflow-hidden border-r border-blue-100 px-0.5 py-0.5 last:border-r-0 ${
															isToday ? "bg-blue-100/70" : "bg-white"
														}`}
													>
														<span
															className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
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
														<div className="mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
															{shown.map((schedule) => {
																const overdue = isRenewalOverdue(schedule);
																const label = scheduleDisplayTitle({
																	...schedule,
																	overdue,
																});
																const renewal = isAssessmentRenewal(schedule);
																if (renewal) {
																	return (
																		<button
																			key={schedule.id}
																			type="button"
																			title={label}
																			onClick={(e) => {
																				e.preventDefault();
																				e.stopPropagation();
																				openAnnual();
																			}}
																			className={`block w-full truncate rounded-full px-1 py-px text-left text-[10px] font-medium leading-tight ${typeBadgeClass(
																				schedule.type,
																				overdue,
																				schedule.done
																			)}`}
																		>
																			{schedule.done ? "✓ " : ""}
																			{label}
																		</button>
																	);
																}
																return (
																	<span
																		key={schedule.id}
																		title={schedule.title}
																		className={`block truncate rounded-full px-1 py-px text-[10px] font-medium leading-tight ${typeBadgeClass(
																			schedule.type
																		)} ${schedule.done ? "line-through opacity-80" : ""}`}
																	>
																		{schedule.title}
																	</span>
																);
															})}
															{extra > 0 ? (
																<span className="px-1 text-[10px] text-blue-700/80">+{extra}</span>
															) : null}
														</div>
													</div>
												);
											})}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</DashPanel>

				<DashPanel title="자료실" onOpen={openDataRoom}>
					<div className="h-full overflow-auto">
						<table className="w-full text-sm">
							<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-50">
								<tr>
									<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
										기관
									</th>
									<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
										분류
									</th>
									<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">
										제목
									</th>
									<th className="px-3 py-2 text-left font-semibold text-blue-900">첨부</th>
								</tr>
							</thead>
							<tbody>
								{loadingData ? (
									<tr>
										<td colSpan={4} className="px-3 py-10 text-center text-blue-900/60">
											불러오는 중...
										</td>
									</tr>
								) : dataRooms.length === 0 ? (
									<tr>
										<td colSpan={4} className="px-3 py-10 text-center text-blue-900/60">
											데이터가 없습니다.
										</td>
									</tr>
								) : (
									dataRooms.map((p) => (
										<tr key={p.id} className="border-b border-blue-50">
											<td className="border-r border-blue-100 px-3 py-2 text-blue-900">{p.orgLabel}</td>
											<td className="whitespace-nowrap border-r border-blue-100 px-3 py-2 text-blue-900">
												{p.category}
											</td>
											<td className="max-w-0 truncate border-r border-blue-100 px-3 py-2 text-blue-900" title={p.title}>
												{p.title}
											</td>
											<td className="max-w-[140px] truncate px-3 py-2 text-blue-900" title={p.attachLabel}>
												{p.attachLabel}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</DashPanel>

				<DashPanel title={`${selectedYear}년 ${selectedMonth}월 일정`} onOpen={openAnnual}>
					<div className="h-full overflow-auto p-2">
						{loadingSchedules ? (
							<div className="px-3 py-10 text-center text-sm text-blue-900/60">불러오는 중...</div>
						) : monthSchedules.length === 0 ? (
							<div className="px-3 py-10 text-center text-sm text-blue-900/60">일정이 없습니다</div>
						) : (
							<div className="space-y-2">
								{monthSchedules.map((schedule) => {
									const renewal = isAssessmentRenewal(schedule);
									const overdue = isRenewalOverdue(schedule);
									const doneGreen = renewal && schedule.done;
									return (
									<div
										key={schedule.id}
										className={`rounded border bg-white p-3 ${
											overdue
												? "border-red-400"
												: doneGreen
													? "border-lime-400"
													: "border-blue-200"
										}`}
									>
										<div className="flex items-start gap-2">
											<label
												className="mt-0.5 flex shrink-0 items-center gap-1"
												onClick={(e) => e.stopPropagation()}
												onKeyDown={(e) => e.stopPropagation()}
											>
												<input
													type="checkbox"
													checked={schedule.done}
													disabled={renewal}
													onChange={(e) => void handleToggleDone(e, schedule)}
													className="h-4 w-4 accent-blue-600 disabled:opacity-80"
													aria-label={`${schedule.title} 진행 완료`}
												/>
												<span className="text-[11px] text-blue-800">완료</span>
											</label>
											<div className="min-w-0 flex-1">
												<div
													className={`mb-1 text-sm font-semibold ${
														overdue
															? "text-red-700"
															: doneGreen
																? "text-lime-900"
																: "text-blue-900"
													} ${schedule.done && !renewal ? "line-through opacity-80" : ""}`}
												>
													{scheduleDisplayTitle({ ...schedule, overdue })}
												</div>
												<div className={`mb-1 text-xs ${overdue ? "text-red-600" : doneGreen ? "text-lime-800" : "text-blue-700"}`}>
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
												{schedule.content ? (
													<div className="line-clamp-4 whitespace-pre-line text-xs text-blue-900/70">
														{schedule.content}
													</div>
												) : null}
												{schedule.type ? (
													<div
														className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${typeBadgeClass(
															schedule.type,
															overdue,
															doneGreen
														)}`}
													>
														{schedule.type}
													</div>
												) : null}
												{renewal && schedule.pnum && !schedule.done ? (
													<button
														type="button"
														onClick={(e) => {
															e.preventDefault();
															e.stopPropagation();
															openNeedsAssessmentRecord(schedule.pnum!);
														}}
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
				</DashPanel>
			</div>
		</div>
	);
}

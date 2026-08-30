/**
 * @file 욕구사정·평가 갱신 가상 일정 — 프론트 헬퍼
 *
 * @description
 * 서버가 계산한 사정갱신 일정을 연간일정·메인 달력에 합치고,
 * 클릭 시 욕구 사정 기록지 등록 탭을 해당 수급자로 엽니다.
 *
 * @module component/nursing-home/utils/assessmentRenewalSchedule
 */

export const ASSESSMENT_RENEWAL_TYPE = "사정갱신";
export const NEEDS_ASSESSMENT_HREF = "/nursingHome/needs-assessment-record";
export const NEEDS_ASSESSMENT_TAB_TITLE = "욕구 사정 기록지 등록";
export const PENDING_NEEDS_ASSESSMENT_PNUM_KEY = "NH_NEEDS_ASSESSMENT_SELECT_PNUM";

export type AssessmentRenewalSchedule = {
	id: string;
	date: string;
	endDate: string;
	title: string;
	content: string;
	type: string;
	done: boolean;
	overdue: boolean;
	source: "assessment-renewal";
	pnum: string;
	savedLabel?: string;
	savedDaysLeft?: number | null;
};

export function isAssessmentRenewal(item: {
	source?: string;
	type?: string;
}): boolean {
	return item.source === "assessment-renewal" || item.type === ASSESSMENT_RENEWAL_TYPE;
}

export function todayLocalYmd(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function daysBetweenYmd(start: string, end: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
	const a = new Date(`${start}T12:00:00`);
	const b = new Date(`${end}T12:00:00`);
	if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
	return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dueDaysLeft(endDate?: string): number | null {
	const due = String(endDate ?? "").slice(0, 10);
	return daysBetweenYmd(todayLocalYmd(), due);
}

/** 달력·제목용: D-12, D-Day, D+3 */
export function dueCountdownLabel(endDate?: string): string {
	const days = dueDaysLeft(endDate);
	if (days == null) return "";
	if (days > 0) return `D-${days}`;
	if (days === 0) return "D-Day";
	return `D+${-days}`;
}

/** 목록용: 마감까지 n일 남음 */
export function dueCountdownDetail(endDate?: string): string {
	const days = dueDaysLeft(endDate);
	if (days == null) return "";
	if (days > 0) return `마감까지 ${days}일 남음`;
	if (days === 0) return "오늘 마감";
	return `마감 ${-days}일 지남`;
}

export function isRenewalOverdue(item: {
	done?: boolean;
	endDate?: string;
	overdue?: boolean;
	source?: string;
	type?: string;
}): boolean {
	if (!isAssessmentRenewal(item)) return false;
	if (item.done) return false;
	const due = String(item.endDate ?? "").slice(0, 10);
	if (due && todayLocalYmd() > due) return true;
	return Boolean(item.overdue);
}

export function assessmentRenewalBadgeClass(overdue?: boolean, done?: boolean): string {
	if (done) return "bg-lime-200 text-lime-900";
	if (overdue) return "bg-red-500 text-white";
	return "bg-violet-200 text-violet-900";
}

export function scheduleDisplayTitle(item: {
	title: string;
	done?: boolean;
	overdue?: boolean;
	endDate?: string;
	savedLabel?: string;
	source?: string;
	type?: string;
}): string {
	if (!isAssessmentRenewal(item)) return item.title;
	const dday = dueCountdownLabel(item.endDate);
	if (isRenewalOverdue(item)) {
		return dday ? `! ${item.title} (${dday})` : `! ${item.title}`;
	}
	const note = String(item.savedLabel ?? "").trim();
	if (item.done && note) return `${item.title} (${note})`;
	if (dday) return `${item.title} (${dday})`;
	return item.title;
}

export function openNeedsAssessmentRecord(pnum: string) {
	const pn = String(pnum ?? "").trim();
	if (!pn) return;
	try {
		sessionStorage.setItem(PENDING_NEEDS_ASSESSMENT_PNUM_KEY, pn);
	} catch {
		/* ignore */
	}
	window.dispatchEvent(
		new CustomEvent("NH_OPEN_TAB", {
			detail: {
				href: NEEDS_ASSESSMENT_HREF,
				title: NEEDS_ASSESSMENT_TAB_TITLE,
				pnum: pn,
			},
		})
	);
}

export function consumePendingNeedsAssessmentPnum(): string {
	try {
		const v = String(sessionStorage.getItem(PENDING_NEEDS_ASSESSMENT_PNUM_KEY) || "").trim();
		if (v) sessionStorage.removeItem(PENDING_NEEDS_ASSESSMENT_PNUM_KEY);
		return v;
	} catch {
		return "";
	}
}

export function peekPendingNeedsAssessmentPnum(): string {
	try {
		return String(sessionStorage.getItem(PENDING_NEEDS_ASSESSMENT_PNUM_KEY) || "").trim();
	} catch {
		return "";
	}
}

type ApiRow = {
	ID?: string;
	PNUM?: string;
	SCH_DATE?: string;
	SCH_END_DATE?: string;
	TITLE?: string;
	CONTENT?: string;
	SCH_TYPE?: string;
	DONE_YN?: string;
	OVERDUE_YN?: string;
	SAVED_LABEL?: string | null;
	SAVED_DAYS_LEFT?: number | null;
};

function isDoneYn(v: unknown): boolean {
	const s = String(v ?? "").trim().toUpperCase();
	return s === "Y" || s === "1" || s === "TRUE";
}

export function mapAssessmentRenewalRow(row: ApiRow): AssessmentRenewalSchedule | null {
	const pnum = String(row.PNUM ?? "").trim();
	const date = String(row.SCH_DATE ?? "").slice(0, 10);
	const endDate = String(row.SCH_END_DATE ?? date).slice(0, 10) || date;
	const title = String(row.TITLE ?? "").trim();
	if (!pnum || !date || !title) return null;
	const done = isDoneYn(row.DONE_YN);
	const savedDaysRaw = row.SAVED_DAYS_LEFT;
	const savedDaysLeft =
		savedDaysRaw == null || savedDaysRaw === ""
			? null
			: Number.isFinite(Number(savedDaysRaw))
				? Number(savedDaysRaw)
				: null;
	const mapped: AssessmentRenewalSchedule = {
		id: String(row.ID ?? `ar:${pnum}:${endDate}`),
		date,
		endDate,
		title,
		content: String(row.CONTENT ?? ""),
		type: String(row.SCH_TYPE ?? ASSESSMENT_RENEWAL_TYPE),
		done,
		overdue: isDoneYn(row.OVERDUE_YN),
		source: "assessment-renewal",
		pnum,
		savedLabel: String(row.SAVED_LABEL ?? "").trim() || undefined,
		savedDaysLeft,
	};
	mapped.overdue = isRenewalOverdue(mapped);
	return mapped;
}

export async function fetchAssessmentRenewalSchedules(params: {
	year?: number;
	startDate?: string;
	endDate?: string;
}): Promise<AssessmentRenewalSchedule[]> {
	const qs = new URLSearchParams();
	if (params.startDate && params.endDate) {
		qs.set("startDate", params.startDate);
		qs.set("endDate", params.endDate);
	} else if (params.year != null) {
		qs.set("year", String(params.year));
	} else {
		return [];
	}
	const response = await fetch(`/api/assessment-renewal-schedule?${qs.toString()}`, {
		credentials: "include",
	});
	const result = await response.json().catch(() => ({}));
	if (!response.ok || !result?.success || !Array.isArray(result.data)) {
		return [];
	}
	return (result.data as ApiRow[])
		.map(mapAssessmentRenewalRow)
		.filter((row): row is AssessmentRenewalSchedule => {
			if (row == null) return false;
			if (row.done) return true;
			return todayLocalYmd() >= row.date;
		});
}

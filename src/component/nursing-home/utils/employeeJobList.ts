/**
 * @file 요양원 유틸 — employeeJobList.ts
 *
 * @description
 * F01010.JOBLIST 직책 코드(1~12)와 표시명 매핑입니다.
 * JOBLIST가 있으면 해당 명칭을, 없으면 기존 JOB 텍스트를 씁니다.
 *
 * @module component/nursing-home/utils/employeeJobList
 */

export const JOB_LIST_OPTIONS = [
	{ value: 1, label: "대표" },
	{ value: 2, label: "국장" },
	{ value: 3, label: "시설장" },
	{ value: 4, label: "간호사" },
	{ value: 5, label: "물리치료사" },
	{ value: 6, label: "작업치료사" },
	{ value: 7, label: "사회복지사" },
	{ value: 8, label: "간호조무사" },
	{ value: 9, label: "사무원" },
	{ value: 10, label: "요양보호사" },
	{ value: 11, label: "조리원" },
	{ value: 12, label: "운전원" },
] as const;

export type JobListValue = (typeof JOB_LIST_OPTIONS)[number]["value"];

export function jobListLabel(code: unknown): string {
	const n = Number(code);
	if (!Number.isFinite(n)) return "";
	return JOB_LIST_OPTIONS.find((o) => o.value === n)?.label ?? "";
}

export function jobListCodeOrEmpty(code: unknown): string {
	return jobListLabel(code) ? String(Number(code)) : "";
}

/** 직책 표시: JOBLIST 명칭 우선, 없으면 JOB(값이 있을 때만) */
export function employeeJobTitle(row: { JOBLIST?: unknown; JOB?: unknown }): string {
	const fromList = jobListLabel(row.JOBLIST);
	if (fromList) return fromList;
	return String(row.JOB ?? "").trim();
}

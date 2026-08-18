/**
 * @file 요양원 유틸 — employeeWorkStatus.ts
 *
 * @description
 * 직원 퇴직일자(EDT)·휴직기간(HSDT/HEDT)으로 근무상태를 산출합니다.
 *
 * @module component/nursing-home/utils/employeeWorkStatus
 */

export function todayYmd(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function localYmd(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dateToYmd(v?: string | null): string {
	if (v == null || v === "") return "";
	const s = String(v).trim();
	if (!s) return "";
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return "";
	return localYmd(d);
}

/** start~end(포함) YYYY-MM-DD 목록 */
export function eachYmd(startYmd: string, endYmd: string, maxDays = 400): string[] {
	const start = dateToYmd(startYmd);
	const end = dateToYmd(endYmd);
	if (!start || !end || start > end) return [];
	const out: string[] = [];
	const d = new Date(`${start}T00:00:00`);
	const last = new Date(`${end}T00:00:00`);
	while (d <= last && out.length < maxDays) {
		out.push(localYmd(d));
		d.setDate(d.getDate() + 1);
	}
	return out;
}

/** 퇴직일자·휴직기간으로 근무상태 산출. 1=근무, 2=휴직, 9=퇴직 */
export function resolveWorkStatus(opts: {
	retirementDate?: string | null;
	leaveStartDate?: string | null;
	leaveEndDate?: string | null;
	asOf?: string;
}): "1" | "2" | "9" {
	const asOf = opts.asOf || todayYmd();
	const edt = dateToYmd(opts.retirementDate);
	const hs = dateToYmd(opts.leaveStartDate);
	const he = dateToYmd(opts.leaveEndDate);
	if (edt && edt <= asOf) return "9";
	if (hs && hs <= asOf && (!he || he >= asOf)) return "2";
	return "1";
}

export type EmployeeWorkDates = {
	EDT?: unknown;
	HSDT?: unknown;
	HEDT?: unknown;
};

export function workStatusFromEmployee(emp: EmployeeWorkDates, asOf?: string): "1" | "2" | "9" {
	return resolveWorkStatus({
		retirementDate: emp.EDT == null ? "" : String(emp.EDT),
		leaveStartDate: emp.HSDT == null ? "" : String(emp.HSDT),
		leaveEndDate: emp.HEDT == null ? "" : String(emp.HEDT),
		asOf,
	});
}

/** 기간 중 하루라도 해당 근무상태이면 true */
export function hasWorkStatusInRange(
	emp: EmployeeWorkDates,
	status: string,
	startYmd: string,
	endYmd: string,
): boolean {
	if (!status) return true;
	const days = eachYmd(startYmd, endYmd);
	if (days.length === 0) return workStatusFromEmployee(emp) === status;
	return days.some((ymd) => workStatusFromEmployee(emp, ymd) === status);
}

export function workStatusText(jobst?: string): string {
	if (!jobst) return "-";
	switch (String(jobst).trim()) {
		case "1":
			return "근무";
		case "2":
			return "휴직";
		case "9":
			return "퇴직";
		default:
			return "-";
	}
}

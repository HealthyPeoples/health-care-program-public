/**
 * @file 유치도뇨관 관리 — 인쇄 헬퍼 (indwellingCatheterPrint.ts)
 *
 * @description
 * 유치도뇨관 관리 출력 HTML. 폴더: component/nursing-home/pages/indwelling-catheter
 *
 * @module component/nursing-home/pages/indwelling-catheter/indwellingCatheterPrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';
import {
	bagPosToLabel,
	formatDateYmd,
	isCheckedFlag,
	resolveManagementTime,
	type F33050Row,
} from '../../utils/indwellingCatheterFields';
import { openPrintPreviewWindow } from '../employee-attendance/employeeAttendancePrint';

export { openPrintPreviewWindow };

export type CatheterPrintMember = {
	P_NM?: string | null;
	P_SEX?: string | null;
	P_BRDT?: string | null;
	P_GRD?: string | null;
};

export type CatheterPrintDay = {
	catheter: boolean;
	bagPosition: string;
	disinfection: boolean;
	signature: string;
	managementTime: string;
};

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function sexLabel(sex: unknown): string {
	const s = String(sex ?? '').trim();
	if (s === '1') return '남';
	if (s === '2') return '여';
	if (s === '남' || s === '여') return s;
	return '';
}

function calcAge(birthDate: unknown): string {
	const s = String(birthDate ?? '').replace(/[^\d]/g, '');
	if (s.length < 4) return '';
	const year = parseInt(s.slice(0, 4), 10);
	if (!Number.isFinite(year) || year < 1900) return '';
	return String(new Date().getFullYear() - year);
}

function mark(on: boolean): string {
	return on ? 'V' : '';
}

function lastDayOfMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

function compareTime(a: string, b: string): number {
	return a.localeCompare(b);
}

/** 같은 날 여러 건이면 관리시간이 늦은 기록을 사용 */
export function pickDayRecord(rows: F33050Row[], ymd: string): CatheterPrintDay | null {
	const matched = rows.filter((r) => formatDateYmd(r.VDT) === ymd);
	if (matched.length === 0) return null;
	matched.sort((a, b) => {
		const ta = resolveManagementTime(a);
		const tb = resolveManagementTime(b);
		const t = compareTime(ta, tb);
		if (t !== 0) return t;
		return String(a.VTM_GU ?? '').localeCompare(String(b.VTM_GU ?? ''));
	});
	const row = matched[matched.length - 1];
	return {
		catheter: isCheckedFlag(row.CH_01),
		bagPosition: bagPosToLabel(String(row.BAG_POS ?? '')),
		disinfection: isCheckedFlag(row.CH_03),
		signature: String(row.INEMPNM ?? '').trim(),
		managementTime: resolveManagementTime(row),
	};
}

function dayCells(days: Array<CatheterPrintDay | null>, pick: (d: CatheterPrintDay) => string): string {
	return days
		.map((d) => `<td>${d ? esc(pick(d)) : ''}</td>`)
		.join('');
}

function blockHtml(
	year: number,
	month: number,
	dayNums: number[],
	records: Array<CatheterPrintDay | null>
): string {
	const headers = dayNums
		.map((day) => (day > 0 ? `<th>${day}일</th>` : `<th></th>`))
		.join('');
	return `<table class="block">
		<tr>
			<th class="lab month">${esc(`${year}년 ${month}월`)}</th>
			${headers}
		</tr>
		<tr>
			<th class="lab">유치도뇨관<br/>삽입, 교체</th>
			${dayCells(records, (d) => mark(d.catheter))}
		</tr>
		<tr>
			<th class="lab loc">소변주머니 위치<br/>(침대/난간/옆/아래)</th>
			${dayCells(records, (d) => d.bagPosition)}
		</tr>
		<tr>
			<th class="lab">소독(삽입부위)함</th>
			${dayCells(records, (d) => mark(d.disinfection))}
		</tr>
		<tr>
			<th class="lab">서명</th>
			${dayCells(records, (d) => d.signature)}
		</tr>
	</table>`;
}

function buildMonthPage(member: CatheterPrintMember, year: number, month: number, rows: F33050Row[]): string {
	const last = lastDayOfMonth(year, month);
	const ym = `${year}-${String(month).padStart(2, '0')}`;
	const colCount = 8;
	const blockCount = Math.ceil(last / colCount);
	const blocks = Array.from({ length: blockCount }, (_, b) => {
		const dayNums = Array.from({ length: colCount }, (_, i) => {
			const day = b * colCount + i + 1;
			return day <= last ? day : 0;
		});
		const records = dayNums.map((day) => {
			if (day <= 0) return null;
			const ymd = `${ym}-${String(day).padStart(2, '0')}`;
			return pickDayRecord(rows, ymd);
		});
		return blockHtml(year, month, dayNums, records);
	});

	const name = String(member.P_NM ?? '').trim();
	const sexAge = `${sexLabel(member.P_SEX)} / ${calcAge(member.P_BRDT)}`;
	const grade = formatCareGradeLabel(member.P_GRD, '');

	return `<div class="page">
		<h1>유치도뇨관 관리</h1>
		<table class="info">
			<tr>
				<th>이름</th><td>${esc(name)}</td>
				<th>성별/나이</th><td>${esc(sexAge)}</td>
				<th>등급</th><td>${esc(grade)}</td>
			</tr>
		</table>
		${blocks.join('\n')}
	</div>`;
}

const PRINT_STYLES = `
* { box-sizing: border-box; }
html, body {
	margin: 0; padding: 0;
	font-family: Batang, "Batang", "바탕", "Times New Roman", serif;
	color: #000; background: #fff;
	font-size: 11pt;
}
.page {
	width: 210mm;
	min-height: 297mm;
	padding: 12mm 12mm 10mm;
	margin: 0 auto;
	page-break-after: always;
	break-after: page;
	display: flex;
	flex-direction: column;
}
.page:last-child { page-break-after: auto; break-after: auto; }
h1 {
	margin: 0 0 6mm;
	text-align: center;
	font-size: 20pt;
	font-weight: 700;
	letter-spacing: 0.28em;
}
.info {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	margin-bottom: 4mm;
}
.info th, .info td {
	border: 1px solid #000;
	padding: 3px 6px;
	text-align: center;
	height: 9mm;
	font-size: 11pt;
}
.info th { width: 12%; font-weight: 700; }
.info td { width: 21.3%; }
.block {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	margin-bottom: 5mm;
	flex: 1;
}
.block th, .block td {
	border: 1px solid #000;
	text-align: center;
	vertical-align: middle;
	padding: 2px 3px;
	font-size: 10pt;
	height: 11mm;
}
.block th.lab {
	width: 28%;
	font-weight: 700;
	font-size: 10pt;
	letter-spacing: -0.02em;
	line-height: 1.25;
}
.block th.lab.loc { height: 14mm; }
.block th.month { font-weight: 700; }
@page { size: A4 portrait; margin: 0; }
@media print {
	html, body { background: #fff; }
	.page { width: 210mm; min-height: 297mm; }
}
`;

export function monthsInRange(from: string, to: string): Array<{ year: number; month: number }> {
	const start = String(from ?? '').slice(0, 7);
	const end = String(to ?? '').slice(0, 7);
	if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) return [];
	const out: Array<{ year: number; month: number }> = [];
	let y = Number(start.slice(0, 4));
	let m = Number(start.slice(5, 7));
	const ey = Number(end.slice(0, 4));
	const em = Number(end.slice(5, 7));
	while (y < ey || (y === ey && m <= em)) {
		out.push({ year: y, month: m });
		m += 1;
		if (m > 12) {
			m = 1;
			y += 1;
		}
	}
	return out;
}

export function buildIndwellingCatheterPrintHtml(opts: {
	items: Array<{ member: CatheterPrintMember; rows: F33050Row[] }>;
	startDate: string;
	endDate: string;
}): string {
	const months = monthsInRange(opts.startDate, opts.endDate);
	const pages: string[] = [];
	for (const item of opts.items) {
		for (const { year, month } of months) {
			const ym = `${year}-${String(month).padStart(2, '0')}`;
			const monthRows = item.rows.filter((r) => formatDateYmd(r.VDT).startsWith(ym));
			if (monthRows.length === 0) continue;
			pages.push(buildMonthPage(item.member, year, month, monthRows));
		}
	}
	return `<!DOCTYPE html>
<html lang="ko">
<head>
	<meta charset="UTF-8" />
	<title></title>
	<style>${PRINT_STYLES}</style>
</head>
<body>
	${pages.join('\n')}
</body>
</html>`;
}

export function printIndwellingCatheter(opts: {
	items: Array<{ member: CatheterPrintMember; rows: F33050Row[] }>;
	startDate: string;
	endDate: string;
}): void {
	openPrintPreviewWindow(buildIndwellingCatheterPrintHtml(opts));
}

/**
 * @file 요양원 유틸 — positionChangePrint.ts
 *
 * @description
 * 체위변경기록 출력 HTML. 수급자 1명·1개월당 2장(1~15일 / 16~31일).
 *
 * @module component/nursing-home/utils/positionChangePrint
 */
import { resolveChangeTimeHm } from './positionChangeFields';
import { formatDateYmd } from './excretionObservationFields';

const SLOT_SET_COUNT = 13;

const POSITION_LEGEND = '※ 자세 : 1.좌측위  2.양와위  3.우측위  4.목위  5.침대에 앉기  6.휠체어';

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export type PositionChangePrintRow = {
	CHNG_DT?: string;
	VDT?: string;
	CHNG_GU?: string;
	CHNG_TM?: string;
	CHNG_POSI?: string;
	CHNG_ETC?: string;
	CHNG_EMPNM?: string;
	CHNG_NIGHT_EMPNM?: string;
	[key: string]: unknown;
};

export type PositionChangePrintMember = {
	name: string;
	pnum: string;
	rows: PositionChangePrintRow[];
};

type HalfMonthPage = {
	year: number;
	month: number;
	startDay: number;
	endDay: number;
};

function lastDayOfMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
	const s = formatDateYmd(ymd);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
	return { y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)), d: Number(s.slice(8, 10)) };
}

/** 선택 기간과 겹치는 월마다 1~15일 / 16~31일 두 장을 만듭니다. */
export function getHalfMonthPages(startDate: string, endDate: string): HalfMonthPage[] {
	const start = parseYmd(startDate);
	const end = parseYmd(endDate);
	if (!start || !end) return [];

	const pages: HalfMonthPage[] = [];
	let y = start.y;
	let m = start.m;
	const rangeStart = `${start.y}-${String(start.m).padStart(2, '0')}-${String(start.d).padStart(2, '0')}`;
	const rangeEnd = `${end.y}-${String(end.m).padStart(2, '0')}-${String(end.d).padStart(2, '0')}`;

	while (y < end.y || (y === end.y && m <= end.m)) {
		const last = lastDayOfMonth(y, m);
		const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
		const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
		if (monthStart <= rangeEnd && monthEnd >= rangeStart) {
			pages.push({ year: y, month: m, startDay: 1, endDay: 15 });
			pages.push({ year: y, month: m, startDay: 16, endDay: 31 });
		}
		m += 1;
		if (m > 12) {
			m = 1;
			y += 1;
		}
	}
	return pages;
}

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
	for (const key of keys) {
		if (row[key] != null && String(row[key]).trim() !== '') return row[key];
		const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
		if (found && row[found] != null && String(row[found]).trim() !== '') return row[found];
	}
	return '';
}

function normalizePrintRow(row: PositionChangePrintRow): PositionChangePrintRow {
	const date = formatDateYmd(pick(row, 'CHNG_DT', 'VDT', 'CHGDT'));
	const posiRaw = String(pick(row, 'CHNG_POSI', 'CHGPOS') ?? '').trim();
	const posi = /^\d+/.test(posiRaw) ? posiRaw.replace(/\D.*/, '') : posiRaw;
	return {
		...row,
		CHNG_DT: date,
		VDT: date,
		CHNG_GU: String(pick(row, 'CHNG_GU') ?? ''),
		CHNG_TM: String(pick(row, 'CHNG_TM', 'CHGTM') ?? ''),
		CHNG_POSI: posi,
		CHNG_ETC: String(pick(row, 'CHNG_ETC', 'REMARKS') ?? ''),
		CHNG_EMPNM: String(pick(row, 'CHNG_EMPNM', 'CHGER', 'EMPNM') ?? ''),
		CHNG_NIGHT_EMPNM: String(pick(row, 'CHNG_NIGHT_EMPNM', 'NIGHT_CHGER') ?? ''),
	};
}

function rowDate(row: PositionChangePrintRow): string {
	return formatDateYmd(row.CHNG_DT ?? row.VDT ?? '');
}

function positionCode(row: PositionChangePrintRow): string {
	const raw = String(row.CHNG_POSI ?? '').trim();
	const digits = raw.match(/^\d+/);
	return digits ? String(Number(digits[0])) : raw;
}

function timeLabel(row: PositionChangePrintRow): string {
	const hm = resolveChangeTimeHm(row);
	if (/^\d{1,2}:\d{2}$/.test(hm)) {
		const [h, m] = hm.split(':');
		return `${h.padStart(2, '0')}:${m}`;
	}
	return hm.slice(0, 5);
}

function namesFrom(rows: PositionChangePrintRow[], key: 'CHNG_EMPNM' | 'CHNG_NIGHT_EMPNM'): string {
	const names = rows
		.map((r) => String(r[key] ?? '').trim())
		.filter(Boolean);
	return [...new Set(names)].join('<br/>');
}

function remarkText(rows: PositionChangePrintRow[]): string {
	const notes = rows
		.map((r) => String(r.CHNG_ETC ?? r.REMARKS ?? '').trim())
		.filter(Boolean);
	return [...new Set(notes)].join(' / ');
}

function rowsByDay(rows: PositionChangePrintRow[]): Map<string, PositionChangePrintRow[]> {
	const map = new Map<string, PositionChangePrintRow[]>();
	for (const row of rows) {
		const d = rowDate(row);
		if (!d) continue;
		const list = map.get(d) ?? [];
		list.push(row);
		map.set(d, list);
	}
	for (const list of map.values()) {
		list.sort((a, b) => resolveChangeTimeHm(a).localeCompare(resolveChangeTimeHm(b)));
	}
	return map;
}

function ymd(year: number, month: number, day: number): string {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidCalendarDay(year: number, month: number, day: number): boolean {
	return day >= 1 && day <= lastDayOfMonth(year, month);
}

function renderPage(member: PositionChangePrintMember, page: HalfMonthPage): string {
	const days: number[] = [];
	for (let d = page.startDay; d <= page.endDay; d += 1) days.push(d);
	const byDay = rowsByDay(member.rows.map(normalizePrintRow));
	const dayKeys = days.map((d) =>
		isValidCalendarDay(page.year, page.month, d) ? ymd(page.year, page.month, d) : ''
	);

	const dayHeaders = days.map((d) => `<th>${d}일</th>`).join('');
	const slotRows: string[] = [];
	for (let i = 0; i < SLOT_SET_COUNT; i += 1) {
		const posCells = dayKeys
			.map((key) => {
				const row = key ? byDay.get(key)?.[i] : undefined;
				return `<td>${row ? esc(positionCode(row)) : ''}</td>`;
			})
			.join('');
		const timeCells = dayKeys
			.map((key) => {
				const row = key ? byDay.get(key)?.[i] : undefined;
				const hm = row ? timeLabel(row) : '';
				const [hh, mm] = /^\d{2}:\d{2}$/.test(hm) ? hm.split(':') : ['', ''];
				return `<td class="time-cell"><span class="hh">${esc(hh)}</span><span class="colon">:</span><span class="mm">${esc(mm)}</span></td>`;
			})
			.join('');
		slotRows.push(`<tr class="pos"><th>자세</th>${posCells}</tr>`);
		slotRows.push(`<tr class="time"><th>시간</th>${timeCells}</tr>`);
	}

	const remarkCells = dayKeys
		.map((key) => `<td class="remark">${key ? esc(remarkText(byDay.get(key) ?? [])) : ''}</td>`)
		.join('');
	const dayStaffCells = dayKeys
		.map((key) => `<td class="staff">${key ? namesFrom(byDay.get(key) ?? [], 'CHNG_EMPNM') : ''}</td>`)
		.join('');
	const nightStaffCells = dayKeys
		.map((key) => `<td class="staff">${key ? namesFrom(byDay.get(key) ?? [], 'CHNG_NIGHT_EMPNM') : ''}</td>`)
		.join('');

	return `
  <div class="page">
    <div class="title">${page.year}-${String(page.month).padStart(2, '0')} 체위변경기록지 - ${esc(member.name || '')} 어르신</div>
    <div class="legend">${POSITION_LEGEND}</div>
    <table>
      <thead>
        <tr>
          <th class="label-col"></th>
          ${dayHeaders}
        </tr>
      </thead>
      <tbody>
        ${slotRows.join('')}
        <tr class="remark-row">
          <th>특이사항</th>
          ${remarkCells}
        </tr>
        <tr class="sign-row">
          <th>주간</th>
          ${dayStaffCells}
        </tr>
        <tr class="sign-row">
          <th>야간</th>
          ${nightStaffCells}
        </tr>
      </tbody>
    </table>
  </div>`;
}

const PRINT_CSS = `
@page { size: A4 landscape; margin: 7mm; }
* { box-sizing: border-box; }
html, body {
  height: 100%;
  margin: 0;
}
body {
  font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
  color: #000;
}
.page {
  height: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  page-break-after: always;
  break-after: page;
}
.page:last-child {
  page-break-after: auto;
  break-after: auto;
}
.title {
  flex: 0 0 auto;
  text-align: center;
  font-size: 15pt;
  font-weight: bold;
  margin: 0 0 4px;
}
.legend {
  flex: 0 0 auto;
  text-align: left;
  font-size: 9pt;
  font-weight: bold;
  margin: 0 0 6px;
}
table {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 8pt;
}
th, td {
  border: 1px solid #000;
  text-align: center;
  vertical-align: middle;
  padding: 1px;
}
thead th { height: 3.2%; }
tr.pos td, tr.pos th,
tr.time td, tr.time th { height: 2.85%; }
.time-cell {
  padding: 0 2px;
}
.time-cell .hh,
.time-cell .mm {
  display: inline-block;
  width: 38%;
  text-align: center;
}
.time-cell .colon {
  display: inline-block;
  width: 12%;
  text-align: center;
}
.label-col, th:first-child, td:first-child {
  width: 48px;
  font-weight: bold;
  font-size: 7.5pt;
}
tr.time td, tr.time th {
  border-bottom: 2px solid #000;
}
.remark-row td, .remark-row th {
  height: 7.6%;
  font-size: 7pt;
  font-weight: normal;
}
.remark-row th { font-weight: bold; }
.remark {
  text-align: left;
  padding: 2px 3px;
  word-break: break-all;
  vertical-align: top;
}
.sign-row td, .sign-row th {
  height: 5.2%;
}
@media print {
  html, body, .page { height: 100%; min-height: 0; }
}
`;

export function buildPositionChangePrintHtml(
	members: PositionChangePrintMember[],
	meta: { startDate: string; endDate: string }
): string {
	const pages = getHalfMonthPages(meta.startDate, meta.endDate);
	const htmlPages = members
		.flatMap((member) => pages.map((page) => renderPage(member, page)))
		.join('');

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>체위 변경 기록지</title>
<style>
${PRINT_CSS}
</style>
</head>
<body>
  ${htmlPages || '<div class="page"><div class="title">출력할 데이터가 없습니다</div></div>'}
</body>
</html>`;
}

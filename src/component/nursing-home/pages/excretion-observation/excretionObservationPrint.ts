/**
 * @file 배설관찰 — 인쇄 헬퍼 (excretionObservationPrint.ts)
 *
 * @description
 * 배설관찰기록지(3일 72시간) 출력 HTML. 폴더: component/nursing-home/pages/excretion-observation
 *
 * @module component/nursing-home/pages/excretion-observation/excretionObservationPrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';
import { formatDateYmd, isCheckedFlag, normalizeAmtGu } from '../../utils/excretionObservationFields';

export type ExcretionPrintMember = {
	P_NM?: string | null;
	P_GRD?: string | null;
	P_SEX?: string | null;
	ROOM_NO?: string | null;
};

export type ExcretionPrintRow = {
	VDT?: string;
	OBSDT?: string;
	VTM_GU?: string;
	VTM_ST?: string;
	OBSTM?: string;
	PSS_GU?: string;
	DNG_GU?: string;
	PSS_AMT_GU?: string;
	DNG_AMT_GU?: string;
	NPPY_CNG_GU?: string;
	NPPY_CNG_TM?: string;
	OBSERVER?: string;
	INEMPNM?: string | null;
};

const MAX_PRINT_DAYS = 31;

export function addDaysYmd(ymd: string, days: number): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
	if (!m) return '';
	const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
	const y = dt.getFullYear();
	const mm = String(dt.getMonth() + 1).padStart(2, '0');
	const dd = String(dt.getDate()).padStart(2, '0');
	return `${y}-${mm}-${dd}`;
}

export function enumerateYmdRange(start: string, end: string): string[] {
	const s = toYmd(start);
	const e = toYmd(end);
	if (!s || !e || s > e) return [];
	const dates: string[] = [];
	let cur = s;
	while (cur && cur <= e && dates.length < MAX_PRINT_DAYS) {
		dates.push(cur);
		cur = addDaysYmd(cur, 1);
	}
	return dates;
}

export function monthRangeFromYmd(ymd: string): {
	year: number;
	month: number;
	days: number;
	start: string;
	end: string;
} | null {
	const s = toYmd(ymd);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
	const year = Number(s.slice(0, 4));
	const month = Number(s.slice(5, 7));
	if (!year || month < 1 || month > 12) return null;
	const days = new Date(year, month, 0).getDate();
	const mm = String(month).padStart(2, '0');
	return {
		year,
		month,
		days,
		start: `${year}-${mm}-01`,
		end: `${year}-${mm}-${String(days).padStart(2, '0')}`,
	};
}

function escapeHtml(s: string) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function toYmd(v: unknown): string {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
		const dt = new Date(s);
		if (!Number.isNaN(dt.getTime())) {
			const y = dt.getFullYear();
			const m = String(dt.getMonth() + 1).padStart(2, '0');
			const d = String(dt.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
	}
	const via = formatDateYmd(v);
	if (/^\d{4}-\d{2}-\d{2}$/.test(via)) return via;
	return '';
}

function dayLabel(ymd: string, fallbackDay: number): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return `${Number(ymd.slice(8, 10))}일`;
	return `${fallbackDay}일`;
}

function mark(v: unknown): string {
	return isCheckedFlag(v) ? '✓' : '';
}

function amtMark(v: unknown, code: '1' | '2' | '3', flag?: unknown): string {
	const n = normalizeAmtGu(v);
	if (n) return n === code ? '✓' : '';
	if (code === '2' && isCheckedFlag(flag)) return '✓';
	return '';
}

function observerName(row: ExcretionPrintRow): string {
	return String(row.OBSERVER || row.INEMPNM || '').trim();
}

const PRINT_STYLES = `
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
html, body { background: #fff; color: #111; }
body { font-family: 'Malgun Gothic', 'Gulim', sans-serif; font-size: 10px; margin: 0; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
h1 { margin: 0; font-size: 18px; letter-spacing: 1px; font-weight: 700; }
.sub { margin: 4px 0 0; font-size: 11px; color: #333; }
.who { min-width: 180px; border-collapse: collapse; }
.who th, .who td { border: 1px solid #111; padding: 3px 6px; }
.who th { width: 52px; background: #f3f3f3; font-weight: 700; text-align: center; }
.who td { min-width: 120px; }
.sheet { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sheet th, .sheet td { border: 1px solid #111; text-align: center; vertical-align: middle; font-size: 11px; }
.sheet thead th { background: #f3f3f3; font-weight: 700; padding: 3px 1px; font-size: 11px; }
.sheet tbody td { height: 18px; padding: 1px; font-size: 11px; }
.sheet.month tbody td { height: 16px; }
.sheet .date { width: 8%; font-weight: 700; }
.sheet .time { width: 10%; }
.sheet .amt { width: 6.5%; font-weight: 700; }
.sheet .flag { width: 9%; font-weight: 700; line-height: 1.25; }
.sheet .obs { width: 12%; }
.note { margin-top: 6px; font-size: 9px; color: #333; }
`;

function emptyCells(): string {
	return '<td class="time"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="flag"></td><td class="time"></td><td class="obs"></td>';
}

function resolvePrintTime(row: ExcretionPrintRow): string {
	const st = String(row.VTM_ST || '').trim();
	if (/^\d{1,2}:\d{2}/.test(st)) {
		const [h, m] = st.split(':');
		return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
	}
	const obs = String(row.OBSTM || '').trim();
	if (/^\d{1,2}:\d{2}/.test(obs)) {
		const [h, m] = obs.split(':');
		return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
	}
	const gu = String(row.VTM_GU || '').trim();
	if (/^\d{1,2}$/.test(gu)) return `${gu.padStart(2, '0')}:00`;
	return st || obs || '';
}

function dataCells(row?: ExcretionPrintRow): string {
	if (!row) return emptyCells();
	return `<td class="time">${escapeHtml(resolvePrintTime(row))}</td>
		<td class="amt">${amtMark(row.DNG_AMT_GU, '3', row.DNG_GU)}</td>
		<td class="amt">${amtMark(row.DNG_AMT_GU, '2', row.DNG_GU)}</td>
		<td class="amt">${amtMark(row.DNG_AMT_GU, '1', row.DNG_GU)}</td>
		<td class="amt">${amtMark(row.PSS_AMT_GU, '3', row.PSS_GU)}</td>
		<td class="amt">${amtMark(row.PSS_AMT_GU, '2', row.PSS_GU)}</td>
		<td class="amt">${amtMark(row.PSS_AMT_GU, '1', row.PSS_GU)}</td>
		<td class="flag">${mark(row.NPPY_CNG_GU)}</td>
		<td class="time">${escapeHtml(String(row.NPPY_CNG_TM || ''))}</td>
		<td class="obs">${escapeHtml(observerName(row))}</td>`;
}

function dataMonthRows(rows: ExcretionPrintRow[]): string {
	const recorded = rows
		.filter((r) => resolvePrintTime(r) !== '' || String(r.VTM_GU || '').trim() !== '')
		.sort((a, b) => {
			const da = toYmd(a.VDT) || toYmd(a.OBSDT);
			const db = toYmd(b.VDT) || toYmd(b.OBSDT);
			if (da !== db) return da < db ? -1 : 1;
			return resolvePrintTime(a).localeCompare(resolvePrintTime(b));
		});
	if (recorded.length === 0) {
		return '<tr><td colspan="11" style="height:48px;color:#666;">해당 월 시간 기록이 없습니다</td></tr>';
	}
	return recorded
		.map((r) => {
			const d = toYmd(r.VDT) || toYmd(r.OBSDT);
			return `<tr>
				<td class="date">${escapeHtml(dayLabel(d, 0))}</td>
				${dataCells(r)}
			</tr>`;
		})
		.join('');
}

function dataMonthPage(opts: {
	year: number;
	month: number;
	member?: ExcretionPrintMember | null;
	rows: ExcretionPrintRow[];
}): string {
	const name = String(opts.member?.P_NM || '').trim();
	const grade = formatCareGradeLabel(opts.member?.P_GRD, '');

	return `
  <div class="page">
    <div class="top">
      <div>
        <h1>배설관찰기록지 (${opts.year}년 ${opts.month}월)</h1>
      </div>
      <table class="who">
        <tr><th>수급자</th><td>${escapeHtml(name)}</td></tr>
        <tr><th>등급</th><td>${escapeHtml(grade)}</td></tr>
      </table>
    </div>
    <table class="sheet">
      <thead>
        <tr>
          <th class="date" rowspan="2">일자</th>
          <th class="time" rowspan="2">시간</th>
          <th colspan="3">대변</th>
          <th colspan="3">소변</th>
          <th class="flag" rowspan="2">기저귀<br>교환</th>
          <th class="time" rowspan="2">시간</th>
          <th class="obs" rowspan="2">제공자</th>
        </tr>
        <tr>
          <th class="amt">다량</th>
          <th class="amt">보통</th>
          <th class="amt">소량</th>
          <th class="amt">다량</th>
          <th class="amt">보통</th>
          <th class="amt">소량</th>
        </tr>
      </thead>
      <tbody>
        ${dataMonthRows(opts.rows)}
      </tbody>
    </table>
    <div class="note">※ 기록된 관찰시간만 표시합니다. 대변 또는 소변만 발생할 수 있으며, 해당 없으면 공란입니다. 기저귀 교환 시 교환 시간을 함께 기록합니다.</div>
  </div>`;
}

const BLANK_ROWS_PER_DAY = 2;

function emptyMonthRows(days: number): string {
	const parts: string[] = [];
	for (let d = 1; d <= days; d++) {
		for (let i = 0; i < BLANK_ROWS_PER_DAY; i++) {
			const dateCell =
				i === 0 ? `<td class="date" rowspan="${BLANK_ROWS_PER_DAY}">${d}일</td>` : '';
			parts.push(`<tr>${dateCell}${emptyCells()}</tr>`);
		}
	}
	return parts.join('');
}

function blankMonthPage(opts: {
	year: number;
	month: number;
	days: number;
	member?: ExcretionPrintMember | null;
}): string {
	const name = String(opts.member?.P_NM || '').trim();
	const grade = formatCareGradeLabel(opts.member?.P_GRD, '');

	return `
  <div class="page">
    <div class="top">
      <div>
        <h1>배설관찰기록지 (${opts.year}년 ${opts.month}월)</h1>
        <div class="sub">1일 ~ ${opts.days}일</div>
      </div>
      <table class="who">
        <tr><th>수급자</th><td>${escapeHtml(name)}</td></tr>
        <tr><th>등급</th><td>${escapeHtml(grade)}</td></tr>
      </table>
    </div>
    <table class="sheet month">
      <thead>
        <tr>
          <th class="date" rowspan="2">일자</th>
          <th class="time" rowspan="2">시간</th>
          <th colspan="3">대변</th>
          <th colspan="3">소변</th>
          <th class="flag" rowspan="2">기저귀<br>교환</th>
          <th class="time" rowspan="2">시간</th>
          <th class="obs" rowspan="2">제공자</th>
        </tr>
        <tr>
          <th class="amt">다량</th>
          <th class="amt">보통</th>
          <th class="amt">소량</th>
          <th class="amt">다량</th>
          <th class="amt">보통</th>
          <th class="amt">소량</th>
        </tr>
      </thead>
      <tbody>
        ${emptyMonthRows(opts.days)}
      </tbody>
    </table>
    <div class="note">※ 시간·대변·소변·기저귀 교환란은 해당 시 기록합니다. 대변 또는 소변만 발생할 수 있으며, 해당 없으면 공란으로 둡니다. 기저귀 교환 시 교환 시간을 함께 기록합니다.</div>
  </div>`;
}

export function buildExcretionObservationPrintHtml(opts: {
	blank?: boolean;
	year?: number;
	month?: number;
	days?: number;
	dates?: string[];
	items?: Array<{
		member?: ExcretionPrintMember | null;
		rows?: ExcretionPrintRow[];
		rowsByDate?: Record<string, ExcretionPrintRow[]>;
	}>;
}): string {
	const items =
		opts.items && opts.items.length > 0
			? opts.items
			: [{ member: { P_NM: '', P_GRD: '' } as ExcretionPrintMember, rowsByDate: {} }];

	const pages = opts.blank
		? items.map((item) =>
				blankMonthPage({
					year: opts.year || new Date().getFullYear(),
					month: opts.month || new Date().getMonth() + 1,
					days: opts.days || 31,
					member: item.member,
				})
			)
		: items.map((item) => {
				const rows = item.rows || Object.values(item.rowsByDate || {}).flat();
				return dataMonthPage({
					year: opts.year || new Date().getFullYear(),
					month: opts.month || new Date().getMonth() + 1,
					member: item.member,
					rows,
				});
			});

	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>배설관찰기록지</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

export function openExcretionObservationPrint(html: string) {
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업 차단을 해제해주세요.');
		return;
	}
	w.document.open();
	w.document.write(html);
	w.document.close();
	setTimeout(() => w.print(), 250);
}

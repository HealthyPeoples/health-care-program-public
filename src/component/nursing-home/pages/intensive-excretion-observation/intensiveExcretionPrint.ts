/**
 * @file 집중배설관찰 — 인쇄 헬퍼 (intensiveExcretionPrint.ts)
 *
 * @description
 * 집중 배설관찰기록지 출력 HTML. 폴더: component/nursing-home/pages/intensive-excretion-observation
 *
 * @module component/nursing-home/pages/intensive-excretion-observation/intensiveExcretionPrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';
import { formatDateYmd, isCheckedFlag, normalizeAmtGu } from '../../utils/excretionObservationFields';

export type IntensivePrintMember = {
	P_NM?: string | null;
	P_GRD?: string | null;
	P_SEX?: string | null;
	ROOM_NO?: string | null;
};

export type IntensivePrintRow = {
	VDT?: string;
	OBSDT?: string;
	VTM_ST?: string;
	PSS_GU?: string;
	DNG_GU?: string;
	PSS_AMT_GU?: string;
	DNG_AMT_GU?: string;
	NPPY_CNG_GU?: string;
	NPPY_CNG_TM?: string;
	ETC?: string;
	OBSERVER?: string;
	INEMPNM?: string | null;
};

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

function dayLabel(ymd: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
	return `${Number(ymd.slice(8, 10))}일`;
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

function observerName(row: IntensivePrintRow): string {
	return String(row.OBSERVER || row.INEMPNM || '').trim();
}

export function monthRange(ym: string): { start: string; end: string; year: number; month: number; days: number } | null {
	const m = /^(\d{4})-(\d{2})$/.exec(String(ym || '').trim());
	if (!m) return null;
	const year = Number(m[1]);
	const month = Number(m[2]);
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

export function currentYearMonth(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const COLSPAN = 12;

const PRINT_STYLES = `
@page { size: A4 portrait; margin: 8mm; }
* { box-sizing: border-box; }
html, body { background: #fff; color: #111; }
body { font-family: 'Malgun Gothic', 'Gulim', sans-serif; font-size: 10px; margin: 0; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
h1 { margin: 0; font-size: 18px; letter-spacing: 1px; font-weight: 700; }
.who { min-width: 180px; border-collapse: collapse; }
.who th, .who td { border: 1px solid #111; padding: 3px 6px; }
.who th { width: 52px; background: #f3f3f3; font-weight: 700; text-align: center; }
.who td { min-width: 120px; }
.sheet { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sheet th, .sheet td { border: 1px solid #111; text-align: center; vertical-align: middle; font-size: 12px; }
.sheet thead th { background: #f3f3f3; font-weight: 700; padding: 3px 1px; font-size: 12px; }
.sheet tbody td { height: 20px; padding: 1px 1px; font-size: 12px; }
.sheet .date { width: 7%; font-weight: 700; }
.sheet .time { width: 8%; }
.sheet .amt { width: 5.5%; font-weight: 700; }
.sheet .flag { width: 8%; font-weight: 700; line-height: 1.25; }
.sheet .etc { width: 13%; text-align: left; }
.sheet .obs { width: 10%; }
.note { margin-top: 6px; font-size: 9px; color: #333; }
`;

function emptyCells(): string {
	return '<td class="time"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="amt"></td><td class="flag"></td><td class="time"></td><td class="etc"></td><td class="obs"></td>';
}

function emptyDayRows(days: number, rowsPerDay: number): string {
	const parts: string[] = [];
	for (let d = 1; d <= days; d++) {
		for (let i = 0; i < rowsPerDay; i++) {
			const dateCell =
				i === 0
					? `<td class="date" rowspan="${rowsPerDay}">${d}일</td>`
					: '';
			parts.push(`<tr>${dateCell}${emptyCells()}</tr>`);
		}
	}
	return parts.join('');
}

function dataRows(rows: IntensivePrintRow[]): string {
	if (rows.length === 0) {
		return `<tr><td colspan="${COLSPAN}" style="height:48px;color:#666;">해당 월 기록이 없습니다</td></tr>`;
	}
	const sorted = [...rows].sort((a, b) => {
		const da = toYmd(a.VDT) || toYmd(a.OBSDT);
		const db = toYmd(b.VDT) || toYmd(b.OBSDT);
		if (da !== db) return da < db ? -1 : 1;
		return String(a.VTM_ST || '').localeCompare(String(b.VTM_ST || ''));
	});
	return sorted
		.map((r) => {
			const d = toYmd(r.VDT) || toYmd(r.OBSDT);
			return `<tr>
				<td class="date">${escapeHtml(dayLabel(d))}</td>
				<td class="time">${escapeHtml(String(r.VTM_ST || ''))}</td>
				<td class="amt">${amtMark(r.DNG_AMT_GU, '3', r.DNG_GU)}</td>
				<td class="amt">${amtMark(r.DNG_AMT_GU, '2', r.DNG_GU)}</td>
				<td class="amt">${amtMark(r.DNG_AMT_GU, '1', r.DNG_GU)}</td>
				<td class="amt">${amtMark(r.PSS_AMT_GU, '3', r.PSS_GU)}</td>
				<td class="amt">${amtMark(r.PSS_AMT_GU, '2', r.PSS_GU)}</td>
				<td class="amt">${amtMark(r.PSS_AMT_GU, '1', r.PSS_GU)}</td>
				<td class="flag">${mark(r.NPPY_CNG_GU)}</td>
				<td class="time">${escapeHtml(String(r.NPPY_CNG_TM || ''))}</td>
				<td class="etc">${escapeHtml(String(r.ETC || ''))}</td>
				<td class="obs">${escapeHtml(observerName(r))}</td>
			</tr>`;
		})
		.join('');
}

function sheetPage(opts: {
	year: number;
	month: number;
	member?: IntensivePrintMember | null;
	rows?: IntensivePrintRow[];
	blank?: boolean;
	days?: number;
}): string {
	const name = String(opts.member?.P_NM || '').trim();
	const grade = formatCareGradeLabel(opts.member?.P_GRD, '');
	const body = opts.blank
		? emptyDayRows(opts.days || 31, 2)
		: dataRows(opts.rows || []);

	return `
  <div class="page">
    <div class="top">
      <h1>배설관찰기록지 (${opts.year}년 ${opts.month}월)</h1>
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
          <th class="etc" rowspan="2">기타</th>
          <th class="obs" rowspan="2">제공자</th>
        </tr>
        <tr>
          <th class="amt">대량</th>
          <th class="amt">보통</th>
          <th class="amt">소량</th>
          <th class="amt">대량</th>
          <th class="amt">보통</th>
          <th class="amt">소량</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
    <div class="note">※ 소변·대변은 해당 양에 ✓ 표시합니다. 기저귀 교환 시 교환 시간을 함께 기록합니다.</div>
  </div>`;
}

export function buildIntensiveExcretionPrintHtml(opts: {
	year: number;
	month: number;
	days: number;
	blank?: boolean;
	items: Array<{ member: IntensivePrintMember; rows: IntensivePrintRow[] }>;
}): string {
	const pages =
		opts.items.length > 0
			? opts.items
					.map((item) =>
						sheetPage({
							year: opts.year,
							month: opts.month,
							days: opts.days,
							blank: opts.blank,
							member: item.member,
							rows: item.rows,
						})
					)
					.join('\n')
			: sheetPage({
					year: opts.year,
					month: opts.month,
					days: opts.days,
					blank: true,
				});

	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>배설관찰기록지</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

export function openIntensiveExcretionPrint(html: string) {
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

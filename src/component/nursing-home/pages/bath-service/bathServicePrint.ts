/**
 * @file 목욕서비스 — 인쇄 헬퍼 (bathServicePrint.ts)
 *
 * @description
 * 목욕서비스 제공기록 가로(A4 landscape) 출력. 한 장에 10회(가능 시) 기록.
 * 폴더: component/nursing-home/pages/bath-service
 *
 * @module component/nursing-home/pages/bath-service/bathServicePrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';

export const BATH_PRINT_SLOTS = 10;

export type BathPrintMember = {
	P_NM?: string | null;
	P_GRD?: string | null;
	P_SEX?: string | null;
	ROOM_NO?: string | null;
};

export type BathPrintRow = {
	VDT?: string;
	SRV_TM?: string;
	BEN_STAT?: string;
	BATH_METH?: string;
	BATH_METH_NM?: string;
	BEF_STAT?: string;
	MOVE_STAT?: string;
	AFT_STAT?: string;
	SRV_WRNG_DESC?: string;
	INEMPNM?: string;
};

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
		return s.slice(0, 10);
	}
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const parsed = Date.parse(s);
	if (!Number.isNaN(parsed)) {
		const dt = new Date(parsed);
		const y = dt.getFullYear();
		const m = String(dt.getMonth() + 1).padStart(2, '0');
		const d = String(dt.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

function formatDateDot(ymd: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
	return `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}`;
}

function bathMethodLabel(row?: BathPrintRow): string {
	if (!row) return '';
	const nm = String(row.BATH_METH_NM || '').trim();
	if (nm) return nm;
	const c = String(row.BATH_METH ?? '').trim();
	if (c === '1') return '입욕';
	if (c === '2') return '샤워식-목욕의자';
	if (c === '3') return '기타';
	return '';
}

function chunk<T>(arr: T[], size: number): T[][] {
	if (size <= 0) return [arr];
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out.length ? out : [[]];
}

const PRINT_STYLES = `
@page { size: A4 landscape; margin: 8mm; }
* { box-sizing: border-box; }
html, body { background: #fff; color: #111; }
body { font-family: 'Malgun Gothic', 'Gulim', sans-serif; font-size: 11px; margin: 0; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
h1 { margin: 0; font-size: 18px; letter-spacing: 2px; font-weight: 700; }
.sub { margin: 4px 0 0; font-size: 11px; color: #333; }
.who { min-width: 280px; border-collapse: collapse; }
.who th, .who td { border: 1px solid #111; padding: 3px 8px; }
.who th { width: 64px; background: #f3f3f3; font-weight: 700; text-align: center; }
.who td { min-width: 90px; }
.sheet { width: 100%; border-collapse: collapse; table-layout: fixed; }
.sheet th, .sheet td { border: 1px solid #111; text-align: center; vertical-align: middle; }
.sheet thead th { background: #f3f3f3; font-weight: 700; padding: 4px 2px; font-size: 11px; }
.sheet tbody th { background: #f7f7f7; font-weight: 700; width: 11%; padding: 5px 4px; font-size: 11px; }
.sheet tbody td { height: 28px; padding: 3px 4px; font-size: 11px; word-break: break-word; }
.sheet tbody tr.memo td { height: 52px; font-size: 10px; text-align: left; vertical-align: top; }
.note { margin-top: 6px; font-size: 10px; color: #333; }
`;

const ROW_DEFS: { key: keyof BathPrintRow | 'DATE' | 'METHOD'; label: string; memo?: boolean }[] = [
	{ key: 'DATE', label: '일자' },
	{ key: 'SRV_TM', label: '시간' },
	{ key: 'BEN_STAT', label: '수급자상태' },
	{ key: 'METHOD', label: '목욕방법' },
	{ key: 'BEF_STAT', label: '목욕전' },
	{ key: 'MOVE_STAT', label: '이동방법' },
	{ key: 'AFT_STAT', label: '목욕후' },
	{ key: 'SRV_WRNG_DESC', label: '특이사항', memo: true },
	{ key: 'INEMPNM', label: '제공자' },
];

function cellValue(row: BathPrintRow | undefined, key: (typeof ROW_DEFS)[number]['key']): string {
	if (!row) return '';
	if (key === 'DATE') return formatDateDot(toYmd(row.VDT));
	if (key === 'METHOD') return bathMethodLabel(row);
	if (key === 'SRV_TM') return String(row.SRV_TM || '').trim();
	return String(row[key] || '').trim();
}

function renderSheet(slots: Array<BathPrintRow | undefined>): string {
	const head = Array.from({ length: BATH_PRINT_SLOTS }, (_, i) => `<th>${i + 1}회</th>`).join('');
	const body = ROW_DEFS.map((def) => {
		const cells = Array.from({ length: BATH_PRINT_SLOTS }, (_, i) => {
			const v = cellValue(slots[i], def.key);
			return `<td>${escapeHtml(v)}</td>`;
		}).join('');
		return `<tr${def.memo ? ' class="memo"' : ''}><th>${escapeHtml(def.label)}</th>${cells}</tr>`;
	}).join('');
	return `<table class="sheet">
		<thead><tr><th>구분</th>${head}</tr></thead>
		<tbody>${body}</tbody>
	</table>`;
}

function renderPage(opts: {
	member: BathPrintMember;
	year: number;
	month: number;
	slots: Array<BathPrintRow | undefined>;
	pageNo: number;
	pageCount: number;
}): string {
	const name = String(opts.member.P_NM || '').trim();
	const grade = formatCareGradeLabel(opts.member.P_GRD, '');
	const room = String(opts.member.ROOM_NO || '').trim();
	const period = `${opts.year}년 ${opts.month}월`;
	return `
<div class="page">
	<div class="top">
		<div>
			<h1>목욕서비스 제공기록</h1>
			<p class="sub">${escapeHtml(period)}${opts.pageCount > 1 ? `  (${opts.pageNo}/${opts.pageCount})` : ''}</p>
		</div>
		<table class="who">
			<tr><th>수급자</th><td>${escapeHtml(name)}</td><th>등급</th><td>${escapeHtml(grade)}</td></tr>
			<tr><th>호실</th><td>${escapeHtml(room)}</td><th>성별</th><td>${escapeHtml(opts.member.P_SEX === '1' ? '남' : opts.member.P_SEX === '2' ? '여' : '')}</td></tr>
		</table>
	</div>
	${renderSheet(opts.slots)}
	<p class="note">목욕전·이동방법·목욕후: 양호 / 이상 / 거부 &nbsp;·&nbsp; 한 장에 ${BATH_PRINT_SLOTS}회 기록</p>
</div>`;
}

export function buildBathServicePrintHtml(opts: {
	blank: boolean;
	year: number;
	month: number;
	items: Array<{ member: BathPrintMember; rows?: BathPrintRow[] }>;
}): string {
	const pages: string[] = [];
	for (const item of opts.items) {
		const rows = opts.blank
			? []
			: [...(item.rows || [])].sort((a, b) => {
					const da = toYmd(a.VDT);
					const db = toYmd(b.VDT);
					if (da !== db) return da < db ? -1 : 1;
					return String(a.SRV_TM || '').localeCompare(String(b.SRV_TM || ''));
				});
		const groups = opts.blank ? [[]] : chunk(rows, BATH_PRINT_SLOTS);
		groups.forEach((group, idx) => {
			const slots: Array<BathPrintRow | undefined> = Array.from(
				{ length: BATH_PRINT_SLOTS },
				(_, i) => group[i]
			);
			pages.push(
				renderPage({
					member: item.member,
					year: opts.year,
					month: opts.month,
					slots,
					pageNo: idx + 1,
					pageCount: groups.length,
				})
			);
		});
	}

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <title>목욕서비스 제공기록</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

export function openBathServicePrint(html: string) {
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

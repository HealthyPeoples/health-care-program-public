/**
 * @file 욕창관리 — 인쇄 헬퍼 (bedsoreManagementPrint.ts)
 *
 * @description
 * 욕창 발생 일일관찰기록지 출력 HTML. 폴더: component/nursing-home/pages/bedsore-management
 *
 * @module component/nursing-home/pages/bedsore-management/bedsoreManagementPrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';

export const BEDSORE_AREA_OPTIONS = [
	'견갑골',
	'팔꿈치',
	'엉치뼈',
	'발꿈치',
	'어깨관절',
	'고관절',
	'장단지',
	'복숭아뼈',
	'무릎뼈',
	'후두부',
	'기타',
] as const;

const AREA_ALIASES: Record<string, string> = {
	영치뼈: '엉치뼈',
};

export type BedsorePrintRow = {
	VDT?: string;
	DCUB_AREA?: string;
	DCUB_SIZE?: string;
	DCUB_DEEP?: string;
	DCUB_COLOR?: string;
	DCUB_DISPO?: string;
	DCUB_NONE?: string;
	DCUB_TM?: string;
	DCUB_CONF?: string;
	DCUB_ETC?: string;
	DCUB_IMG?: string;
	DCUB_SEQ?: number;
};

export type BedsorePrintMember = {
	P_NM?: string | null;
	P_BRDT?: string | null;
	P_GRD?: string | null;
	ROOM_NO?: string | null;
};

function escapeHtml(s: string) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function toYmd(v: unknown): string {
	if (v == null) return '';
	const s = String(v).trim();
	if (!s) return '';
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s.slice(0, 10);
}

function formatPeriodYmd(v: unknown): string {
	const ymd = toYmd(v);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return String(v ?? '').trim();
	return ymd.replace(/-/g, '.');
}

function periodLabel(from?: string, to?: string): string {
	const a = formatPeriodYmd(from);
	const b = formatPeriodYmd(to);
	if (a && b) return `${a} ~ ${b}`;
	return a || b || '';
}

export function formatMd(vdt: unknown): string {
	const ymd = toYmd(vdt);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
	return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
}

export function parseAreaList(raw: unknown): string[] {
	const s = String(raw ?? '').trim();
	if (!s) return [];
	return s
		.split(/[,/|，、\s]+/)
		.map((x) => {
			const t = x.trim();
			return AREA_ALIASES[t] || t;
		})
		.filter(Boolean);
}

export function isNoneOccurrence(row: { DCUB_NONE?: string; DCUB_AREA?: string }): boolean {
	const flag = String(row.DCUB_NONE ?? '').trim();
	if (flag === '1' || flag.toUpperCase() === 'Y') return true;
	const area = String(row.DCUB_AREA ?? '').replace(/\s/g, '');
	return area === '발생없음' || area === '발생無';
}

export function composeRemarks(row: BedsorePrintRow): string {
	const note = String(row.DCUB_DISPO ?? '').trim();
	const size = String(row.DCUB_SIZE ?? '').trim();
	const deep = String(row.DCUB_DEEP ?? '').trim();
	const color = String(row.DCUB_COLOR ?? '').trim();
	if (!size && !deep && !color) return note;
	const parts: string[] = [];
	if (size) parts.push(`크기 ${size}`);
	if (deep) parts.push(`깊이 ${deep}`);
	if (color) parts.push(`색깔 ${color}`);
	if (note) parts.push(note);
	return parts.join(', ');
}

function parsePrintPhotos(raw: unknown): string[] {
	const s = String(raw ?? '').trim();
	if (!s) return [];
	try {
		const parsed = JSON.parse(s);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((p: unknown) => {
				if (typeof p === 'string') return p.trim();
				if (p && typeof p === 'object') return String((p as { blobName?: unknown }).blobName ?? '').trim();
				return '';
			})
			.filter(Boolean)
			.slice(0, 4);
	} catch {
		return [];
	}
}

function checkMark(on: boolean) {
	return on ? 'V' : '';
}

const SITE_LABELS = ['발생 없음', ...BEDSORE_AREA_OPTIONS] as const;
const KNOWN_AREAS = new Set<string>(BEDSORE_AREA_OPTIONS);

function etcAreaText(row: BedsorePrintRow): string {
	const etc = String(row.DCUB_ETC ?? '').trim();
	if (etc) return etc;
	return parseAreaList(row.DCUB_AREA)
		.filter((a) => a !== '발생없음' && a !== '발생 없음' && !KNOWN_AREAS.has(a))
		.join(', ');
}

function siteLabelCells(row: BedsorePrintRow): string {
	const none = isNoneOccurrence(row);
	const selected = new Set(parseAreaList(row.DCUB_AREA));
	const etc = !none && selected.has('기타') ? etcAreaText(row) : '';
	return SITE_LABELS.map((name) => {
		if (name === '기타' && etc) {
			return `<th class="site-name site-etc">기타<div class="etc-text">${escapeHtml(etc)}</div></th>`;
		}
		return `<th class="site-name">${escapeHtml(name)}</th>`;
	}).join('');
}

function siteMarkCells(row: BedsorePrintRow): string {
	const none = isNoneOccurrence(row);
	const selected = new Set(parseAreaList(row.DCUB_AREA));
	return SITE_LABELS.map((name) => {
		const on = name === '발생 없음' ? none : !none && selected.has(name);
		return `<td class="site-mark">${checkMark(!!on)}</td>`;
	}).join('');
}

const PRINT_STYLES = `
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { font-family: 'Malgun Gothic', 'Gulim', sans-serif; font-size: 11px; color: #111; margin: 0; }
.wrap { width: 100%; }
.top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
h1 { flex: 1; text-align: center; font-size: 20px; letter-spacing: 2px; margin: 6px 0 0; }
.stamp { width: 72px; border: 1px solid #111; border-collapse: collapse; }
.stamp th, .stamp td { border: 1px solid #111; text-align: center; }
.stamp th { font-size: 12px; padding: 3px 0; }
.stamp td { height: 48px; }
.meta { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.meta th, .meta td { border: 1px solid #111; padding: 5px 8px; }
.meta th { width: 14%; background: #f3f3f3; font-weight: 600; text-align: center; }
.meta td { width: 36%; }
.day { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 8px; page-break-inside: avoid; }
.day th, .day td { border: 1px solid #111; }
.day .date { width: 32px; text-align: center; font-weight: 700; vertical-align: middle; font-size: 12px; }
.day .fld { width: 52px; text-align: center; font-weight: 700; background: #f3f3f3; vertical-align: middle; font-size: 11px; }
.day .site-name { font-size: 9px; font-weight: 600; text-align: center; padding: 2px 1px; line-height: 1.2; background: #fff; }
.day .site-mark { min-height: 28px; height: auto; text-align: center; vertical-align: middle; font-size: 13px; font-weight: 700; padding: 2px 1px; }
.day .site-etc { width: 78px; }
.day .etc-text { display: block; margin-top: 2px; font-size: 10px; font-weight: 700; line-height: 1.2; word-break: break-all; white-space: normal; }
.day .note { padding: 6px 8px; min-height: 36px; vertical-align: middle; }
.day .photos { padding: 6px 8px; vertical-align: middle; }
.day .photos img { height: 72px; width: auto; max-width: 120px; object-fit: contain; margin-right: 6px; border: 1px solid #ccc; }
.day .val { padding: 5px 8px; vertical-align: middle; }
.day .sign { color: #555; font-size: 10px; margin-left: 8px; }
.empty { text-align: center; padding: 24px; border: 1px solid #111; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
`;

export function buildBedsoreDailyPrintHtml(opts: {
	member: BedsorePrintMember | null;
	rows: BedsorePrintRow[];
	periodFrom?: string;
	periodTo?: string;
	photoOrigin?: string;
}): string {
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>욕창 발생 일일관찰기록지</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="page">${printBodyHtml(opts)}</div>
</body>
</html>`;
}

function printBodyHtml(opts: {
	member: BedsorePrintMember | null;
	rows: BedsorePrintRow[];
	periodFrom?: string;
	periodTo?: string;
	photoOrigin?: string;
}): string {
	const { member, rows, periodFrom, periodTo, photoOrigin } = opts;
	const name = String(member?.P_NM ?? '').trim();
	const brdt = toYmd(member?.P_BRDT).replace(/-/g, '.');
	const grade = formatCareGradeLabel(member?.P_GRD, '');
	const room = String(member?.ROOM_NO ?? '').trim();
	const period = periodLabel(periodFrom, periodTo);
	const sorted = [...rows].sort((a, b) => {
		const byDate = toYmd(a.VDT).localeCompare(toYmd(b.VDT));
		if (byDate !== 0) return byDate;
		return Number(a.DCUB_SEQ || 0) - Number(b.DCUB_SEQ || 0);
	});
	const siteCount = SITE_LABELS.length;
	const timeSpan = Math.floor((siteCount - 1) / 2);
	const confSpan = siteCount - 1 - timeSpan;

	const dayBlocks =
		sorted.length > 0
			? sorted
					.map((r) => {
						const remarks = composeRemarks(r);
						const tm = String(r.DCUB_TM ?? '').trim();
						const conf = String(r.DCUB_CONF ?? '').trim();
						const photos = parsePrintPhotos(r.DCUB_IMG);
						const origin = String(photoOrigin ?? '').replace(/\/$/, '');
						const photoHtml = photos.length
							? photos
									.map((blob) => {
										const src = `${origin}/api/f33010/photos?blobName=${encodeURIComponent(blob)}`;
										return `<img src="${escapeHtml(src)}" alt="욕창 사진" />`;
									})
									.join('')
							: '';
						const dateCell = tm
							? `${escapeHtml(formatMd(r.VDT))}<div style="font-size:10px;font-weight:600;margin-top:2px">${escapeHtml(tm)}</div>`
							: escapeHtml(formatMd(r.VDT));
						return `
      <table class="day">
        <colgroup>
          <col class="date" />
          <col class="fld" />
          ${SITE_LABELS.map((name) => (name === '기타' ? '<col class="site-etc" />' : '<col />')).join('')}
        </colgroup>
        <tr>
          <th class="date" rowspan="5">${dateCell}</th>
          <th class="fld" rowspan="2">부위</th>
          ${siteLabelCells(r)}
        </tr>
        <tr>
          ${siteMarkCells(r)}
        </tr>
        <tr>
          <th class="fld">특이사항</th>
          <td class="note" colspan="${siteCount}">${escapeHtml(remarks || '')}</td>
        </tr>
        <tr>
          <th class="fld">사진</th>
          <td class="photos" colspan="${siteCount}">${photoHtml}</td>
        </tr>
        <tr>
          <th class="fld">확인시간</th>
          <td class="val" colspan="${timeSpan}">${escapeHtml(tm)}</td>
          <th class="fld">확인자</th>
          <td class="val" colspan="${confSpan}">${escapeHtml(conf)}<span class="sign">(서명)</span></td>
        </tr>
      </table>`;
					})
					.join('')
			: `<div class="empty">기록이 없습니다</div>`;

	return `
  <div class="wrap">
    <div class="top">
      <div style="width:72px"></div>
      <h1>욕창 발생 일일관찰기록지</h1>
      <table class="stamp">
        <tr><th>시설장</th></tr>
        <tr><td></td></tr>
      </table>
    </div>
    <table class="meta">
      <tr>
        <th>수급자성명</th><td>${escapeHtml(name)}</td>
        <th>생년월일</th><td>${escapeHtml(brdt)}</td>
      </tr>
      <tr>
        <th>등급</th><td>${escapeHtml(grade)}</td>
        <th>호실</th><td>${escapeHtml(room)}</td>
      </tr>
      <tr>
        <th>출력기간</th><td colspan="3">${escapeHtml(period)}</td>
      </tr>
    </table>
    ${dayBlocks}
  </div>`;
}

export function buildBedsoreDailyBatchPrintHtml(
	items: Array<{ member: BedsorePrintMember | null; rows: BedsorePrintRow[] }>,
	period?: { periodFrom?: string; periodTo?: string; photoOrigin?: string }
): string {
	const pages = items
		.map((item) => `<div class="page">${printBodyHtml({ ...item, ...period })}</div>`)
		.join('\n');
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>욕창 발생 일일관찰기록지</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

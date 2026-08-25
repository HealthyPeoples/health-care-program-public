/**
 * @file 물리치료실적 — 인쇄 헬퍼 (physicalTherapyPerformancePrint.ts)
 *
 * @description
 * 물리치료기록지(V32020) 출력 HTML입니다.
 *
 * @module component/nursing-home/pages/physical-therapy-performance/physicalTherapyPerformancePrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';

export type V32020PrintRow = Record<string, unknown>;

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function nl(text: unknown): string {
	return esc(text).replace(/\r\n|\n|\r/g, '<br/>');
}

function toYmd(raw: unknown): string {
	if (raw == null || raw === '') return '';
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		const y = raw.getFullYear();
		const m = String(raw.getMonth() + 1).padStart(2, '0');
		const d = String(raw.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(raw).trim();
	if (!s) return '';
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	return s;
}

function fmtTime(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
	const d = s.replace(/\D/g, '');
	if (d.length >= 4) return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
	return s;
}

function formatSex(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (s === '1' || s === '남' || s === '남성' || s === 'M') return '남';
	if (s === '2' || s === '여' || s === '여성' || s === 'F') return '여';
	return s;
}

function formatGrade(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (/등급|인지|외/.test(s)) return s;
	return formatCareGradeLabel(s, '');
}

function cell(row: V32020PrintRow, ...keys: string[]): string {
	for (const k of keys) {
		if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]);
	}
	return '';
}

function isOn(row: V32020PrintRow, chkKey: string): boolean {
	return String(row[chkKey] ?? '').trim() === '1';
}

function minutes(row: V32020PrintRow, chkKey: string, valKey: string): string {
	const v = String(row[valKey] ?? '').trim();
	if (isOn(row, chkKey) || v) return esc(v);
	return '';
}

const EQUIPMENT_ITEMS = [
	{ chk: 'TCHK01', val: 'TVAL01', label: '자전거' },
	{ chk: 'TCHK02', val: 'TVAL02', label: '탄력밴드운동' },
	{ chk: 'TCHK03', val: 'TVAL03', label: '전신안마기' },
	{ chk: 'TCHK04', val: 'TVAL04', label: 'Pully' },
	{ chk: 'TCHK05', val: 'TVAL05', label: '견관절운동기' },
	{ chk: 'TCHK06', val: 'TVAL06', label: '평행봉걷기' },
	{ chk: 'TCHK07', val: 'TVAL07', label: '러닝머신' },
	{ chk: 'TCHK08', val: 'TVAL08', label: '발마사지기' },
	{ chk: 'TCHK09', val: 'TVAL09', label: '틸팅테이블' },
	{ chk: 'TCHK10', val: 'TVAL10', label: '공운동' },
	{ chk: 'TCHK11', val: 'TVAL11', label: '구슬꿰기' },
	{ chk: 'TCHK12', val: 'TVAL12', label: '패그보드끼우기' },
] as const;

const SIMPLE_ITEMS = [
	{ chk: 'TCHK21', val: 'TVAL21', label: '도수운동' },
	{ chk: 'TCHK22', val: 'TVAL22', label: 'ROM' },
	{ chk: 'TCHK23', val: 'TVAL23', label: '근력운동' },
	{ chk: 'TCHK24', val: 'TVAL24', label: '기능향상운동' },
	{ chk: 'TCHK25', val: 'TVAL25', label: '체중이동/지지훈련' },
	{ chk: 'TCHK26', val: 'TVAL26', label: '보행훈련' },
] as const;

const MODALITY_ITEMS = [
	{ chk: 'TCHK31', val: 'TVAL31', label: 'Hot & Cold Pack' },
	{ chk: 'TCHK32', val: 'TVAL32', label: '적외선치료' },
	{ chk: 'TCHK33', val: 'TVAL33', label: '초음파치료' },
	{ chk: 'TCHK34', val: 'TVAL34', label: '경피신경전기자극치료' },
	{ chk: 'TCHK35', val: 'TVAL35', label: '간섭전류치료' },
	{ chk: 'TCHK36', val: 'TVAL36', label: '전기자극치료' },
	{ chk: 'TCHK37', val: 'TVAL37', label: '파라핀치료' },
] as const;

function otherRows(row: V32020PrintRow): Array<{ name: string; val: string }> {
	const items = [1, 2, 3, 4, 5].map((n) => ({
		name: String(row[`TETC_${n}`] ?? '').trim(),
		val: String(row[`TETCVAL_${n}`] ?? '').trim(),
	}));
	const filled = items.filter((it) => it.name || it.val);
	if (filled.length > 3) return filled;
	return items.slice(0, 3);
}

function detailCell(label: string, on: boolean): string {
	return on ? `☑ ${esc(label)}` : esc(label);
}

function exerciseRemark(row: V32020PrintRow): string {
	const a = String(row.TTEXT_1 ?? '').trim();
	const b = String(row.TTEXT_2 ?? '').trim();
	return [a, b].filter(Boolean).join('\n');
}

function buildPage(row: V32020PrintRow): string {
	const facilityCode = cell(row, '장기요양기관기호', '장기요양기간기호');
	const facilityName = cell(row, '장기요양기관명', '장기요양기간명');
	const grade = formatGrade(cell(row, '장기요양등급'));
	const name = cell(row, '수급자성명');
	const birth = toYmd(row.생일);
	const tdt = toYmd(row.물리치료일자);
	const sex = formatSex(row.성별);
	const therapist = cell(row, '치료자');
	const startTm = fmtTime(row.시작시간);
	const endTm = fmtTime(row.종료시간);
	const others = otherRows(row);
	const exerciseRows = EQUIPMENT_ITEMS.length + SIMPLE_ITEMS.length;

	const equipmentHtml = EQUIPMENT_ITEMS.map((it, i) => {
		const first = i === 0;
		return `<tr>
			${first ? `<td class="area" rowspan="${exerciseRows}">운동치료</td>` : ''}
			${first ? `<td class="method" rowspan="${EQUIPMENT_ITEMS.length}">기구이용</td>` : ''}
			<td class="detail">${detailCell(it.label, isOn(row, it.chk))}</td>
			<td class="time">${minutes(row, it.chk, it.val)}</td>
			${first ? `<td class="remark" rowspan="${exerciseRows}">${nl(exerciseRemark(row))}</td>` : ''}
		</tr>`;
	}).join('');

	const simpleHtml = SIMPLE_ITEMS.map((it, i) => {
		const first = i === 0;
		return `<tr>
			${first ? `<td class="method" rowspan="${SIMPLE_ITEMS.length}">단순운동</td>` : ''}
			<td class="detail">${detailCell(it.label, isOn(row, it.chk))}</td>
			<td class="time">${minutes(row, it.chk, it.val)}</td>
		</tr>`;
	}).join('');

	const modalityHtml = MODALITY_ITEMS.map((it, i) => {
		const first = i === 0;
		return `<tr>
			${first ? `<td class="area" rowspan="${MODALITY_ITEMS.length}">Modalities</td>` : ''}
			${first ? `<td class="method" rowspan="${MODALITY_ITEMS.length}"></td>` : ''}
			<td class="detail">${detailCell(it.label, isOn(row, it.chk))}</td>
			<td class="time">${minutes(row, it.chk, it.val)}</td>
			${first ? `<td class="remark" rowspan="${MODALITY_ITEMS.length}">${nl(row.TTEXT_3)}</td>` : ''}
		</tr>`;
	}).join('');

	const otherCount = Math.max(3, others.length);
	const otherHtml = Array.from({ length: otherCount }, (_, i) => {
		const it = others[i] || { name: '', val: '' };
		const methodLabel = it.name || `기타치료${i + 1}`;
		return `<tr>
			${i === 0 ? `<td class="area" rowspan="${otherCount}">기타치료</td>` : ''}
			<td class="method">${esc(methodLabel)}</td>
			<td class="detail"></td>
			<td class="time">${esc(it.val)}</td>
			${i === 0 ? `<td class="remark" rowspan="${otherCount}">${nl(row.TTEXT_4)}</td>` : ''}
		</tr>`;
	}).join('');

	return `<div class="page">
	<div class="header">
		<h1 class="title">물리치료기록지</h1>
		<table class="approve">
			<tr><th>담당</th><th>검토</th><th>결재</th></tr>
			<tr><td class="stamp">&nbsp;</td><td class="stamp">&nbsp;</td><td class="stamp">&nbsp;</td></tr>
		</table>
	</div>
	<table class="info">
		<tr>
			<th>장기요양기관기호</th><td>${esc(facilityCode)}</td>
			<th>장기요양기관명</th><td>${esc(facilityName)}</td>
			<th>장기요양등급</th><td>${esc(grade)}</td>
		</tr>
		<tr>
			<th>수급자성명</th><td>${esc(name)}</td>
			<th>생일</th><td>${esc(birth)}</td>
			<th>물리치료일자</th><td>${esc(tdt)}</td>
		</tr>
		<tr>
			<th>성별</th><td>${esc(sex)}</td>
			<th>치료자</th><td>${esc(therapist)}</td>
			<th>물리치료시간</th><td>${esc(startTm)} ~ ${esc(endTm)}</td>
		</tr>
	</table>
	<div class="sheet-box">
	<table class="sheet">
		<colgroup>
			<col class="c-area" />
			<col class="c-method" />
			<col class="c-detail" />
			<col class="c-time" />
			<col class="c-remark" />
		</colgroup>
		<thead>
			<tr>
				<th>영역</th>
				<th>급여방법</th>
				<th>급여세부방법 및 치료부위</th>
				<th>제공시간(분)</th>
				<th>특이사항 / 변경사유</th>
			</tr>
		</thead>
		<tbody>
			${equipmentHtml}
			${simpleHtml}
			${modalityHtml}
			${otherHtml}
		</tbody>
	</table>
	</div>
</div>`;
}

const PRINT_STYLES = `
* { box-sizing: border-box; }
html, body {
	margin: 0; padding: 0;
	height: 100%;
	font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
	color: #000; background: #fff;
	font-size: 9pt;
}
.page {
	width: 210mm;
	min-height: 297mm;
	height: 297mm;
	padding: 6mm 8mm 8mm;
	margin: 0 auto;
	position: relative;
	display: flex;
	flex-direction: column;
	page-break-after: always;
	break-after: page;
}
.page:last-child {
	page-break-after: auto;
	break-after: auto;
}
.header {
	position: relative;
	margin-bottom: 3mm;
	min-height: 16mm;
	flex: 0 0 auto;
}
.title {
	margin: 0;
	padding-top: 2mm;
	font-size: 18pt;
	font-weight: 700;
	text-align: center;
	letter-spacing: 0.35em;
	text-decoration: underline;
	text-underline-offset: 3px;
}
.approve {
	position: absolute;
	right: 0;
	top: 0;
	border-collapse: collapse;
	width: 38mm;
	font-size: 8.5pt;
}
.approve th, .approve td {
	border: 1px solid #000;
	text-align: center;
	padding: 1px;
}
.approve th {
	font-weight: 700;
	height: 6mm;
}
.approve td.stamp { height: 12mm; }
.info {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 2mm;
	table-layout: fixed;
	flex: 0 0 auto;
	empty-cells: show;
}
.info th, .info td {
	border: 1px solid #000;
	padding: 3px 4px;
	vertical-align: middle;
	font-size: 9pt;
	text-align: center;
}
.info th {
	width: 14%;
	font-weight: 700;
	white-space: nowrap;
}
.info td {
	width: 19.3%;
}
.sheet-box {
	flex: 1 1 auto;
	min-height: 0;
	border: 1.5px solid #000;
}
.sheet {
	width: 100%;
	height: 100%;
	border-collapse: collapse;
	table-layout: fixed;
	empty-cells: show;
}
.sheet th, .sheet td {
	border: 1px solid #000;
	vertical-align: middle;
	text-align: center;
	padding: 2px 3px;
}
.sheet thead th {
	font-weight: 700;
	padding: 4px 2px;
	font-size: 9pt;
}
.c-area { width: 12%; }
.c-method { width: 14%; }
.c-detail { width: 38%; }
.c-time { width: 12%; }
.c-remark { width: 24%; }
.area, .method {
	font-weight: 700;
	font-size: 9.5pt;
}
.detail { font-size: 9pt; }
.time { font-size: 9pt; }
.remark {
	text-align: left;
	vertical-align: top;
	font-size: 8.5pt;
	line-height: 1.4;
	white-space: pre-wrap;
	padding: 4px;
}
@media print {
	html, body { width: 100%; height: 100%; }
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.page {
		width: 100%;
		min-height: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
	}
}
@page { size: A4; margin: 8mm; }
`;

function openPrintWindow(html: string): void {
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업이 차단되어 출력을 열 수 없습니다.');
		return;
	}
	w.document.write(html);
	w.document.close();
	setTimeout(() => {
		try {
			w.focus();
			w.print();
		} catch {
			/* ignore */
		}
	}, 250);
}

export function openPhysicalTherapyRecordPrint(rows: V32020PrintRow[]): void {
	if (!rows.length) {
		alert('출력할 물리치료기록이 없습니다.');
		return;
	}
	const body = rows.map((row) => buildPage(row)).join('\n');
	const title =
		rows.length === 1
			? `물리치료기록지${cell(rows[0], '수급자성명') ? ` - ${cell(rows[0], '수급자성명')}` : ''}`
			: `물리치료기록지 (${rows.length}건)`;
	openPrintWindow(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`);
}

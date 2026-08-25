/**
 * @file 간식일괄등록 — 인쇄 헬퍼 (snackBulkRegistrationPrint.ts)
 *
 * @description
 * 일 수급자급여실적 출력과 같은 양식에서 아침·점심·저녁을 빼고
 * 오전/오후/저녁 간식 칸을 넓혀 등록된 간식명을 출력합니다.
 *
 * @module component/nursing-home/pages/snack-bulk-registration/snackBulkRegistrationPrint
 */

export type SnackPrintRow = {
	SVDT: string;
	P_NM: string;
	P_BRDT?: string;
	MGVOL: string;
	AGVOL: string;
	DGVOL: string;
};

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function formatWeekdayDate(ymd: string): string {
	const s = String(ymd || '').slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const d = new Date(`${s}T12:00:00`);
	if (Number.isNaN(d.getTime())) return s;
	return `${s} ${WEEKDAYS[d.getDay()]}`;
}

const SNACK_PRINT_STYLES = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body {
	font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
	font-size: 11pt;
	margin: 0;
	padding: 0;
	color: #000;
}
.print-section {
	page-break-after: always;
	padding: 10mm;
}
.print-section:last-of-type { page-break-after: auto; }
.header {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 2.2fr) minmax(0, 1fr);
	align-items: start;
	column-gap: 12px;
	margin-bottom: 15px;
}
.date-info { font-size: 11pt; justify-self: start; text-align: left; }
.title {
	font-size: 18pt;
	font-weight: bold;
	text-align: center;
	justify-self: center;
	width: 100%;
}
.header-sign { justify-self: end; }
.signature-table {
	border: 1px solid #000;
	border-collapse: collapse;
	width: 150px;
	font-size: 10pt;
}
.signature-table th,
.signature-table td {
	border: 1px solid #000;
	padding: 5px;
	text-align: center;
	height: 30px;
}
.main-table {
	width: 100%;
	border-collapse: collapse;
	border: 1px solid #000;
	font-size: 10pt;
	margin-top: 10px;
	table-layout: fixed;
}
.main-table th,
.main-table td {
	border: 1px solid #000;
	padding: 5px 4px;
	text-align: center;
	word-break: keep-all;
	overflow-wrap: break-word;
	vertical-align: middle;
}
.main-table th { background-color: #f0f0f0; font-weight: bold; }
.col-date { width: 14%; }
.col-name { width: 14%; }
.col-birth { width: 12%; }
.col-snack { width: 20%; }
.cell-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.cell-snack { text-align: left; padding-left: 6px; padding-right: 6px; }
.footer {
	display: flex;
	justify-content: space-between;
	margin-top: 20px;
	font-size: 10pt;
}
@media print {
	html, body { margin: 0; padding: 0; }
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function snackCell(name: string): string {
	const t = String(name ?? '').trim();
	return t ? esc(t) : '&nbsp;';
}

function buildRowsHtml(rows: SnackPrintRow[]): string {
	if (!rows.length) {
		return '<tr><td colspan="6" style="text-align:center">해당 일자 데이터 없음</td></tr>';
	}
	return rows
		.map(
			(row) => `
		<tr>
			<td class="cell-date">${esc(row.SVDT)}</td>
			<td>${esc(row.P_NM)}</td>
			<td>${esc(row.P_BRDT || '')}</td>
			<td class="cell-snack">${snackCell(row.MGVOL)}</td>
			<td class="cell-snack">${snackCell(row.AGVOL)}</td>
			<td class="cell-snack">${snackCell(row.DGVOL)}</td>
		</tr>`
		)
		.join('');
}

export function buildSnackPrintSectionHtml(dateLabel: string, rows: SnackPrintRow[]): string {
	return `
<div class="print-section">
	<div class="header">
		<div class="date-info">일자: ${esc(dateLabel)}</div>
		<div class="title">간식내역</div>
		<div class="header-sign">
			<table class="signature-table">
				<tr><th>담당</th><th>검토</th><th>결재</th></tr>
				<tr><td></td><td></td><td></td></tr>
			</table>
		</div>
	</div>
	<table class="main-table">
		<colgroup>
			<col class="col-date" />
			<col class="col-name" />
			<col class="col-birth" />
			<col class="col-snack" />
			<col class="col-snack" />
			<col class="col-snack" />
		</colgroup>
		<thead>
			<tr>
				<th>일자</th>
				<th>수급자명</th>
				<th>생일</th>
				<th>오전간식</th>
				<th>오후간식</th>
				<th>저녁간식</th>
			</tr>
		</thead>
		<tbody>
			${buildRowsHtml(rows)}
		</tbody>
	</table>
	<div class="footer">
		<div>R14020</div>
		<div>페이지: 1</div>
	</div>
</div>`;
}

export function openSnackPrintWindow(sectionsHtml: string): void {
	const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title></title>
<style>${SNACK_PRINT_STYLES}</style>
</head>
<body>
${sectionsHtml}
</body>
</html>`;
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
		return;
	}
	w.document.write(html);
	w.document.close();
	try {
		w.document.title = '';
	} catch {
		/* ignore */
	}
	setTimeout(() => {
		try {
			w.focus();
			w.print();
		} catch {
			/* ignore */
		}
	}, 250);
}

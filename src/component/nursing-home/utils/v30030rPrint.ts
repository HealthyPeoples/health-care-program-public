/**
 * @file 요양원 유틸 — v30030rPrint.ts
 *
 * @description
 * 요양원 도메인 공통 유틸리티입니다.
 *
 * @module component/nursing-home/utils/v30030rPrint
 */
/** V30030R 출력 HTML (간호일지 / 건강 관리 기록부) */

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function formatSurveyDate(dateStr: unknown): string {
	if (dateStr == null || dateStr === '') return '';
	const s = String(dateStr).trim();
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (s.includes(' ')) return s.split(' ')[0];
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	try {
		const d = new Date(s);
		if (!Number.isNaN(d.getTime())) {
			const y = d.getFullYear();
			const m = String(d.getMonth() + 1).padStart(2, '0');
			const day = String(d.getDate()).padStart(2, '0');
			return `${y}-${m}-${day}`;
		}
	} catch {
		/* ignore */
	}
	return s;
}

function cell(row: Record<string, unknown>, key: string): string {
	const v = row[key];
	if (v == null || v === '') return '';
	return esc(v);
}

function headerInfo(rows: Record<string, unknown>[], fallback?: Record<string, unknown>) {
	const first = rows[0] || {};
	const fb = fallback || {};
	return {
		facilityCode: cell(first, '장기요양기관기호') || esc(fb.facilityCode) || '',
		facilityName: cell(first, '장기요양기관명') || esc(fb.facilityName) || '',
		grade: cell(first, '장기요양등급') || esc(fb.grade) || '',
		name: cell(first, '수급자성명') || esc(fb.name) || '',
		rrn: cell(first, '주민등록번호') || esc(fb.rrn) || '',
		recogNo: cell(first, '장기요양인정번호') || esc(fb.recogNo) || '',
	};
}

const COMMON_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    font-size: 9pt;
    margin: 0;
    padding: 8mm;
    color: #000;
  }
  .title {
    text-align: center;
    font-size: 18pt;
    font-weight: bold;
    text-decoration: underline;
    margin: 0 0 8px 0;
    letter-spacing: 4px;
  }
  .top-wrap {
    position: relative;
    margin-bottom: 8px;
    min-height: 52px;
  }
  .signature-table {
    border-collapse: collapse;
    width: 140px;
    font-size: 8pt;
    position: absolute;
    top: 0;
    right: 0;
  }
  .signature-table th,
  .signature-table td {
    border: 1px solid #000;
    padding: 2px 4px;
    text-align: center;
  }
  .signature-table td { height: 28px; }
  .info-table {
    width: calc(100% - 150px);
    border-collapse: collapse;
    border: 1px solid #000;
    font-size: 9pt;
  }
  .info-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    vertical-align: middle;
  }
  .info-table .label {
    font-weight: bold;
    text-align: center;
    white-space: nowrap;
    width: 110px;
    background: #fff;
  }
  .period {
    margin: 8px 0 6px 0;
    font-size: 10pt;
  }
  .footer {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
  }
`;

export type PrintMeta = {
	startDate: string;
	endDate: string;
	fallback?: {
		facilityCode?: string;
		facilityName?: string;
		grade?: string;
		name?: string;
		rrn?: string;
		recogNo?: string;
	};
};

function maskRrn(v: unknown): string {
	const s = String(v ?? '').trim();
	if (s.length >= 7) return s.replace(/(\d{6})[-]?(\d).*/, '$1-$2******');
	return s;
}

function groupRowsByPerson(rows: Record<string, unknown>[]): Record<string, unknown>[][] {
	const map = new Map<string, Record<string, unknown>[]>();
	for (const row of rows) {
		const key = String(row.PNUM ?? row['수급자성명'] ?? '');
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(row);
	}
	return [...map.values()].sort((a, b) => {
		const na = String(a[0]?.['수급자성명'] ?? '');
		const nb = String(b[0]?.['수급자성명'] ?? '');
		return na.localeCompare(nb, 'ko');
	});
}

function renderNursingLogPage(
	rows: Record<string, unknown>[],
	meta: PrintMeta,
	pageLabel: string
): string {
	const info = headerInfo(rows, meta.fallback);
	const sortedRows = [...rows].sort((a, b) =>
		formatSurveyDate(a['조사일자']).localeCompare(formatSurveyDate(b['조사일자']))
	);
	const bodyRows = sortedRows
		.map(
			(item) => `
    <tr>
      <td>${esc(formatSurveyDate(item['조사일자']))}</td>
      <td>${cell(item, '공복혈당')}</td>
      <td>${cell(item, '식후혈당')}</td>
      <td>${cell(item, '수축혈압')}</td>
      <td>${cell(item, '이완혈압')}</td>
      <td>${cell(item, '체온')}</td>
      <td>${cell(item, '맥박수')}</td>
      <td>${cell(item, '호흡수')}</td>
      <td>${cell(item, '체중')}</td>
      <td class="notes">${cell(item, '간호내역')}</td>
    </tr>`
		)
		.join('');

	return `
  <div class="page">
  <div class="title">간호일지</div>
  <div class="top-wrap">
    <table class="signature-table">
      <tr><th>담당</th><th>검토</th><th>결재</th></tr>
      <tr><td></td><td></td><td></td></tr>
    </table>
    <table class="info-table">
      <tr>
        <td class="label">장기요양기관기호</td><td>${info.facilityCode}</td>
        <td class="label">장기요양기관명</td><td>${info.facilityName}</td>
        <td class="label">장기요양등급</td><td>${info.grade}</td>
      </tr>
      <tr>
        <td class="label">수급자성명</td><td>${info.name}</td>
        <td class="label">주민등록번호</td><td>${info.rrn ? maskRrn(info.rrn) : info.rrn}</td>
        <td class="label">장기요양인정번호</td><td>${info.recogNo}</td>
      </tr>
    </table>
  </div>
  <div class="period">조사기간 : ${esc(meta.startDate)} ~ ${esc(meta.endDate)}</div>
  <table class="main-table">
    <thead>
      <tr>
        <th style="width:8%">조사일자</th>
        <th style="width:6%">공복혈당</th>
        <th style="width:6%">식후혈당</th>
        <th style="width:6%">수축혈압</th>
        <th style="width:6%">이완혈압</th>
        <th style="width:5%">체온</th>
        <th style="width:5%">맥박수</th>
        <th style="width:5%">호흡수</th>
        <th style="width:5%">체중</th>
        <th style="width:48%">간호내역</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="10" style="padding:20px;">데이터가 없습니다</td></tr>`}
    </tbody>
  </table>
  <div class="footer">
    <span>R30030</span>
    <span>${esc(pageLabel)}</span>
  </div>
  </div>`;
}

const NURSING_LOG_CSS = `
@page { size: A4 landscape; margin: 8mm; }
${COMMON_CSS}
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.main-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 2px solid #000;
  border-bottom: 2px solid #000;
  font-size: 8pt;
}
.main-table th,
.main-table td {
  border-left: none;
  border-right: none;
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
  padding: 3px 2px;
  text-align: center;
  vertical-align: middle;
}
.main-table th {
  font-weight: bold;
  border-bottom: 2px solid #000;
}
.main-table .notes {
  text-align: left;
  padding-left: 4px;
  word-break: break-all;
}
`;

/** 일상 출력: 간호일지 */
export function buildNursingLogHtml(rows: Record<string, unknown>[], meta: PrintMeta): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>간호일지</title>
<style>
${NURSING_LOG_CSS}
</style>
</head>
<body>
  ${renderNursingLogPage(rows, meta, '페이지: 1')}
</body>
</html>`;
}

/** 일상 전체출력: 수급자별 간호일지 */
export function buildNursingLogAllHtml(rows: Record<string, unknown>[], meta: PrintMeta): string {
	const groups = groupRowsByPerson(rows);
	const pages = groups
		.map((group, idx) => renderNursingLogPage(group, meta, `페이지: ${idx + 1}/${groups.length}`))
		.join('');

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>간호일지 전체출력</title>
<style>
${NURSING_LOG_CSS}
</style>
</head>
<body>
  ${pages || renderNursingLogPage([], meta, '페이지: 1')}
</body>
</html>`;
}

const HEALTH_RECORD_CSS = `
@page { size: A4 landscape; margin: 8mm; }
${COMMON_CSS}
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.main-table {
  width: 100%;
  border-collapse: collapse;
  border-top: 3px double #000;
  border-bottom: 2px solid #000;
  font-size: 8pt;
}
.main-table th,
.main-table td {
  border: none;
  border-bottom: 1px solid #999;
  padding: 2px 2px;
  text-align: center;
  vertical-align: middle;
}
.main-table thead th {
  font-weight: bold;
  border-bottom: none;
  padding-top: 3px;
  padding-bottom: 1px;
}
.main-table thead tr.head-bottom th {
  border-bottom: 3px double #000;
  padding-top: 1px;
  padding-bottom: 3px;
}
.main-table .date-cell {
  font-weight: normal;
  vertical-align: middle;
  border-bottom: 1px solid #000;
  width: 9%;
}
.main-table tr.data-bottom td {
  border-bottom: 1px solid #000;
}
.main-table .notes {
  text-align: left;
  padding-left: 4px;
  word-break: break-all;
  vertical-align: top;
  width: 18%;
}
.sub-label {
  color: inherit;
  font-size: inherit;
  font-weight: bold;
}
`;

function renderHealthRecordPage(
	rows: Record<string, unknown>[],
	meta: PrintMeta,
	pageLabel: string
): string {
	const info = headerInfo(rows, meta.fallback);
	const sortedRows = [...rows].sort((a, b) =>
		formatSurveyDate(a['조사일자']).localeCompare(formatSurveyDate(b['조사일자']))
	);
	const bodyRows = sortedRows
		.map(
			(item) => `
    <tr class="data-top">
      <td class="date-cell" rowspan="2">${esc(formatSurveyDate(item['조사일자']))}</td>
      <td>${cell(item, '공복혈당')}</td>
      <td>${cell(item, '식후혈당')}</td>
      <td>${cell(item, '수축혈압')}</td>
      <td>${cell(item, '이완혈압')}</td>
      <td>${cell(item, '체온')}</td>
      <td>${cell(item, '맥박수')}</td>
      <td>${cell(item, '호흡수')}</td>
      <td>${cell(item, '체중')}</td>
      <td>${cell(item, 'NS_SORE_DESC') || cell(item, '욕창')}</td>
      <td rowspan="2">${cell(item, '드레싱')}</td>
      <td class="notes" rowspan="2">${cell(item, '간호내역')}</td>
    </tr>
    <tr class="data-bottom">
      <td>${cell(item, '투약관리')}</td>
      <td>${cell(item, '주사제관리')}</td>
      <td>${cell(item, '문제행동')}</td>
      <td>${cell(item, '낙상')}</td>
      <td>${cell(item, '탈수')}</td>
      <td>${cell(item, '대소변실금')}</td>
      <td>${cell(item, '통증')}</td>
      <td>${cell(item, '섬망')}</td>
      <td>${cell(item, 'WATER_INTAKE')}</td>
    </tr>`
		)
		.join('');

	return `
  <div class="page">
  <div class="title">건강 관리 기록부</div>
  <div class="top-wrap">
    <table class="signature-table">
      <tr><th>담당</th><th>검토</th><th>결제</th></tr>
      <tr><td></td><td></td><td></td></tr>
    </table>
    <table class="info-table">
      <tr>
        <td class="label">장기요양기관기호</td><td>${info.facilityCode}</td>
        <td class="label">장기요양기관명</td><td>${info.facilityName}</td>
        <td class="label">장기요양등급</td><td>${info.grade}</td>
      </tr>
      <tr>
        <td class="label">수급자</td><td>${info.name}</td>
        <td class="label">주민등록번호</td><td>${info.rrn ? maskRrn(info.rrn) : info.rrn}</td>
        <td class="label">장기요양인정번호</td><td>${info.recogNo}</td>
      </tr>
    </table>
  </div>
  <div class="period">조사기간 : ${esc(meta.startDate)} ~ ${esc(meta.endDate)}</div>
  <table class="main-table">
    <thead>
      <tr>
        <th rowspan="2">조사일자</th>
        <th>공복혈당</th>
        <th>식후혈당</th>
        <th>수축혈압</th>
        <th>이완혈압</th>
        <th>체온</th>
        <th>맥박수</th>
        <th>호흡수</th>
        <th>체중</th>
        <th>욕창 부위</th>
        <th rowspan="2">드레싱</th>
        <th rowspan="2">제공내역</th>
      </tr>
      <tr class="head-bottom">
        <th class="sub-label">약물투여</th>
        <th class="sub-label">주사제투여</th>
        <th class="sub-label">문제행동</th>
        <th class="sub-label">낙상</th>
        <th class="sub-label">탈수</th>
        <th class="sub-label">대소변실금</th>
        <th class="sub-label">통증(VAS)</th>
        <th class="sub-label">섬망</th>
        <th class="sub-label">수분섭취(ml)</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="12" style="padding:20px;border-bottom:1px solid #000;">데이터가 없습니다</td></tr>`}
    </tbody>
  </table>
  <div class="footer">
    <span></span>
    <span>${esc(pageLabel)}</span>
  </div>
  </div>`;
}

/** 주기 출력: 건강 관리 기록부 (2줄/일자) */
export function buildHealthRecordHtml(rows: Record<string, unknown>[], meta: PrintMeta): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>건강 관리 기록부</title>
<style>
${HEALTH_RECORD_CSS}
</style>
</head>
<body>
  ${renderHealthRecordPage(rows, meta, '1/1 페이지')}
</body>
</html>`;
}

/** 주기 전체출력: 수급자별 건강 관리 기록부 */
export function buildHealthRecordAllHtml(rows: Record<string, unknown>[], meta: PrintMeta): string {
	const groups = groupRowsByPerson(rows);
	const pages = groups
		.map((group, idx) => renderHealthRecordPage(group, meta, `${idx + 1}/${groups.length} 페이지`))
		.join('');

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>건강 관리 기록부 전체출력</title>
<style>
${HEALTH_RECORD_CSS}
</style>
</head>
<body>
  ${pages || renderHealthRecordPage([], meta, '1/1 페이지')}
</body>
</html>`;
}

export function openPrintWindow(html: string) {
	const printWindow = window.open('', '_blank');
	if (!printWindow) {
		alert('팝업이 차단되어 출력을 열 수 없습니다.');
		return;
	}
	printWindow.document.write(html);
	printWindow.document.close();
	printWindow.onload = () => {
		printWindow.focus();
		printWindow.print();
	};
}

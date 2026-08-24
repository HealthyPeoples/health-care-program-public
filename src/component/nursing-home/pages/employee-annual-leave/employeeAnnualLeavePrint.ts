/**
 * @file 직원연차 — 인쇄 헬퍼 (employeeAnnualLeavePrint.ts)
 *
 * @description
 * 요양원 직원연차 기능의 인쇄 헬퍼입니다. 폴더: component/nursing-home/pages/employee-annual-leave
 *
 * @module component/nursing-home/pages/employee-annual-leave/employeeAnnualLeavePrint
 */
import { openPrintPreviewWindow } from "../employee-attendance/employeeAttendancePrint";
import {
	type BaseYearAnnualLeavePrintRow,
	type DetailAnnualLeavePrintSection,
	type FullAnnualLeavePrintRow,
} from "./employeeAnnualLeaveUtils";

export { openPrintPreviewWindow };

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function cell(v: string): string {
	const t = String(v ?? "").trim();
	return t ? escapeHtml(t) : "&nbsp;";
}

export function buildFullAnnualLeavePrintHtml(referenceDate: string, rows: FullAnnualLeavePrintRow[]): string {
	const bodyRows = rows
		.map((row) => {
			const name = row.showEmployeeColumns ? cell(row.empnm) : "&nbsp;";
			const job = row.showEmployeeColumns ? cell(row.job) : "&nbsp;";
			const status = row.showEmployeeColumns ? cell(row.status) : "&nbsp;";
			const hire = row.showEmployeeColumns ? cell(row.hireDate) : "&nbsp;";
			const resign = row.showEmployeeColumns ? cell(row.resignDate) : "&nbsp;";
			const base = row.showEmployeeColumns ? cell(row.baseDate) : "&nbsp;";
			return `<tr>
        <td class="c-name">${name}</td>
        <td class="c-job">${job}</td>
        <td class="c-st">${status}</td>
        <td class="c-dt">${hire}</td>
        <td class="c-dt">${resign}</td>
        <td class="c-dt">${base}</td>
        <td class="c-dt">${cell(row.startDate)}</td>
        <td class="c-dt">${cell(row.endDate)}</td>
        <td class="c-num">${row.yearIndex}</td>
        <td class="c-num">${row.annualLeaveDays}</td>
        <td class="c-num">${row.usedDays}</td>
        <td class="c-etc">${cell(row.remark)}</td>
      </tr>`;
		})
		.join("");

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>사원 년차 보고서(전체)</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm 16mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', Batang, serif;
      font-size: 9.5pt;
      color: #000;
      background: #fff;
    }
    .wrap { width: 100%; max-width: 277mm; margin: 0 auto; position: relative; min-height: 190mm; padding-bottom: 24px; }
    .head { position: relative; margin-bottom: 10px; min-height: 52px; }
    .title {
      text-align: center;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding-top: 2px;
    }
    .approve {
      position: absolute;
      top: 0;
      right: 0;
      border-collapse: collapse;
      font-size: 9pt;
    }
    .approve th, .approve td {
      border: 1px solid #000;
      padding: 3px 10px;
      text-align: center;
      font-weight: 400;
    }
    .approve td { height: 30px; }
    .ref-date { margin: 6px 0 8px 0; font-size: 10pt; }
    table.main {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.main thead th {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 5px 2px;
      font-weight: 400;
      text-align: center;
      font-size: 9pt;
      vertical-align: middle;
      word-break: keep-all;
    }
    table.main tbody td {
      border-bottom: 1px solid #000;
      padding: 4px 2px;
      text-align: center;
      font-size: 9pt;
      vertical-align: middle;
      word-break: break-word;
    }
    table.main .c-name { width: 8%; text-align: center; }
    table.main .c-job { width: 7%; }
    table.main .c-st { width: 5%; }
    table.main .c-dt { width: 8%; }
    table.main .c-num { width: 5%; }
    table.main .c-etc { width: 6%; }
    .foot-line {
      border-top: 1px solid #000;
      margin-top: 4px;
      padding-top: 6px;
      text-align: right;
      font-size: 9.5pt;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <table class="approve">
        <tr>
          <th>담당</th>
          <th>검토</th>
          <th>결재</th>
        </tr>
        <tr><td></td><td></td><td></td></tr>
      </table>
      <h1 class="title">사원 년차 보고서(전체)</h1>
    </div>
    <div class="ref-date">기준일자: ${escapeHtml(referenceDate)}</div>
    <table class="main">
      <thead>
        <tr>
          <th>직원명</th>
          <th>직책</th>
          <th>상태</th>
          <th>입사일자</th>
          <th>퇴사일자</th>
          <th>년차기준일</th>
          <th>시작일자</th>
          <th>종료일자</th>
          <th>년수</th>
          <th>년차일수</th>
          <th>사용일수</th>
          <th>비고</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || `<tr><td colspan="12" style="padding:12px;">&nbsp;</td></tr>`}
      </tbody>
    </table>
    <div class="foot-line">페이지: 1</div>
  </div>
</body>
</html>`;
}

/** 년차 상세 보고서 {기준년도} — 사원별 요약행 + 사용일자 목록 */
export function buildDetailAnnualLeavePrintHtml(
	referenceDate: string,
	baseYear: number,
	sections: DetailAnnualLeavePrintSection[],
	documentTitle?: string,
): string {
	const title = String(documentTitle ?? "").trim() || `년차 상세 보고서 ${baseYear}년`;
	const bodyBlocks = sections
		.map((sec) => {
			const detailLines =
				sec.details.length > 0
					? sec.details
							.map(
								(d) =>
									`<div class="detail-line">${cell(d.workDate)}&nbsp;&nbsp;&nbsp;${cell(d.workType)}</div>`,
							)
							.join("")
					: `<div class="detail-line">&nbsp;</div>`;

			return `<tr class="emp-summary">
        <td class="c-name">${cell(sec.empnm)}</td>
        <td class="c-job">${cell(sec.job)}</td>
        <td class="c-st">${cell(sec.status)}</td>
        <td class="c-dt">${cell(sec.hireDate)}</td>
        <td class="c-dt">${cell(sec.resignDate)}</td>
        <td class="c-dt">${cell(sec.startDate)}</td>
        <td class="c-dt">${cell(sec.endDate)}</td>
        <td class="c-num">${sec.yearIndex}</td>
        <td class="c-num">${sec.annualLeaveDays}</td>
        <td class="c-num">${sec.usedDays}</td>
      </tr>
      <tr class="emp-detail">
        <td colspan="5">&nbsp;</td>
        <td colspan="5" class="detail-cell">${detailLines}</td>
      </tr>
      <tr class="emp-block-end"><td colspan="10"></td></tr>`;
		})
		.join("");

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm 18mm 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', Batang, serif;
      font-size: 10pt;
      color: #000;
      background: #fff;
    }
    .wrap { width: 100%; max-width: 186mm; margin: 0 auto; position: relative; min-height: 260mm; padding-bottom: 28px; }
    .head { position: relative; margin-bottom: 12px; min-height: 56px; }
    .title {
      text-align: center;
      font-size: 17pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-decoration: underline;
      padding-top: 4px;
    }
    .approve {
      position: absolute;
      top: 0;
      right: 0;
      border-collapse: collapse;
      font-size: 9pt;
    }
    .approve th, .approve td {
      border: 1px solid #000;
      padding: 3px 10px;
      text-align: center;
      font-weight: 400;
    }
    .approve td { height: 32px; }
    .ref-date { margin: 8px 0 10px 0; font-size: 10pt; font-weight: 700; }
    table.main {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.main thead th {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 2px;
      font-weight: 400;
      text-align: center;
      font-size: 9.5pt;
      vertical-align: middle;
      word-break: keep-all;
    }
    table.main tbody td {
      padding: 4px 2px;
      text-align: center;
      font-size: 9.5pt;
      vertical-align: middle;
    }
    table.main tr.emp-summary td {
      font-weight: 700;
      padding-top: 8px;
      padding-bottom: 4px;
    }
    table.main tr.emp-detail td {
      text-align: left;
      vertical-align: top;
      padding-bottom: 4px;
    }
    table.main tr.emp-detail .detail-cell {
      padding-left: 8px;
    }
    table.main .detail-line {
      line-height: 1.65;
      font-weight: 400;
      text-align: left;
    }
    table.main tr.emp-block-end td {
      border-bottom: 1px solid #000;
      height: 6px;
      padding: 0;
    }
    table.main .c-name { width: 9%; }
    table.main .c-job { width: 9%; }
    table.main .c-st { width: 6%; }
    table.main .c-dt { width: 9%; }
    table.main .c-num { width: 6%; }
    .foot-line {
      border-top: 1px solid #000;
      margin-top: 8px;
      padding-top: 8px;
      text-align: right;
      font-size: 9.5pt;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <table class="approve">
        <tr>
          <th>담당</th>
          <th>검토</th>
          <th>결재</th>
        </tr>
        <tr><td></td><td></td><td></td></tr>
      </table>
      <h1 class="title">${escapeHtml(title)}</h1>
    </div>
    <div class="ref-date">기준일자: ${escapeHtml(referenceDate)}</div>
    <table class="main">
      <thead>
        <tr>
          <th>직원명</th>
          <th>직책</th>
          <th>상태</th>
          <th>입사일자</th>
          <th>퇴사일자</th>
          <th>시작일자</th>
          <th>종료일자</th>
          <th>년수</th>
          <th>년차일수</th>
          <th>사용일수</th>
        </tr>
      </thead>
      <tbody>
        ${bodyBlocks || `<tr><td colspan="10" style="padding:12px;">&nbsp;</td></tr>`}
      </tbody>
    </table>
    <div class="foot-line">페이지: 1</div>
  </div>
</body>
</html>`;
}

/** 사원 년차 보고서 {기준년도} — 사원당 1행 */
export function buildBaseYearAnnualLeavePrintHtml(
	referenceDate: string,
	baseYear: number,
	rows: BaseYearAnnualLeavePrintRow[],
): string {
	const bodyRows = rows
		.map(
			(row) => `<tr>
        <td class="c-name">${cell(row.empnm)}</td>
        <td class="c-job">${cell(row.job)}</td>
        <td class="c-st">${cell(row.status)}</td>
        <td class="c-dt">${cell(row.hireDate)}</td>
        <td class="c-dt">${cell(row.resignDate)}</td>
        <td class="c-dt">${cell(row.startDate)}</td>
        <td class="c-dt">${cell(row.endDate)}</td>
        <td class="c-num">${row.yearIndex}</td>
        <td class="c-num">${row.annualLeaveDays}</td>
        <td class="c-num">${row.usedDays}</td>
      </tr>`,
		)
		.join("");

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>사원 년차 보고서 ${baseYear}년</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm 16mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', Batang, serif;
      font-size: 10pt;
      color: #000;
      background: #fff;
    }
    .wrap { width: 100%; max-width: 277mm; margin: 0 auto; position: relative; min-height: 190mm; padding-bottom: 24px; }
    .head { position: relative; margin-bottom: 10px; min-height: 52px; }
    .title {
      text-align: center;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding-top: 2px;
    }
    .approve {
      position: absolute;
      top: 0;
      right: 0;
      border-collapse: collapse;
      font-size: 9pt;
    }
    .approve th, .approve td {
      border: 1px solid #000;
      padding: 3px 10px;
      text-align: center;
      font-weight: 400;
    }
    .approve td { height: 30px; }
    .ref-date { margin: 6px 0 8px 0; font-size: 10pt; }
    table.main {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.main thead th {
      border-top: 2px solid #000;
      border-bottom: 1px solid #000;
      padding: 6px 3px;
      font-weight: 400;
      text-align: center;
      font-size: 9.5pt;
      vertical-align: middle;
      word-break: keep-all;
    }
    table.main tbody td {
      border-bottom: 1px solid #000;
      padding: 5px 3px;
      text-align: center;
      font-size: 9.5pt;
      vertical-align: middle;
    }
    table.main .c-name { width: 10%; }
    table.main .c-job { width: 10%; }
    table.main .c-st { width: 7%; }
    table.main .c-dt { width: 10%; }
    table.main .c-num { width: 7%; }
    .foot-line {
      border-top: 1px solid #000;
      margin-top: 4px;
      padding-top: 6px;
      text-align: right;
      font-size: 9.5pt;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <table class="approve">
        <tr>
          <th>담당</th>
          <th>검토</th>
          <th>결재</th>
        </tr>
        <tr><td></td><td></td><td></td></tr>
      </table>
      <h1 class="title">사원 년차 보고서 ${baseYear}년</h1>
    </div>
    <div class="ref-date">기준일자: ${escapeHtml(referenceDate)}</div>
    <table class="main">
      <thead>
        <tr>
          <th>직원명</th>
          <th>직책</th>
          <th>상태</th>
          <th>입사일자</th>
          <th>퇴사일자</th>
          <th>시작일자</th>
          <th>종료일자</th>
          <th>년수</th>
          <th>년차일수</th>
          <th>사용일수</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || `<tr><td colspan="10" style="padding:12px;">&nbsp;</td></tr>`}
      </tbody>
    </table>
    <div class="foot-line">페이지: 1</div>
  </div>
</body>
</html>`;
}

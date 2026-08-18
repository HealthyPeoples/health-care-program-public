/**
 * @file 직원직무교육 — 인쇄 헬퍼 (employeeJobTrainingPrint.ts)
 *
 * @description
 * 요양원 직원직무교육 기능의 인쇄 헬퍼입니다. 폴더: component/nursing-home/pages/employee-job-training
 *
 * @module component/nursing-home/pages/employee-job-training/employeeJobTrainingPrint
 */
import { openPrintPreviewWindow } from "../employee-attendance/employeeAttendancePrint";

export type JobTrainingPrintData = {
	trainingDate: string;
	startTime: string;
	endTime: string;
	instructor: string;
	place: string;
	title: string;
	content: string;
	attendees: string;
	evaluation: string;
	photoSrcs?: string[];
};

export { openPrintPreviewWindow };

function escapeHtml(s: string): string {
	return String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function nbsp(v: string): string {
	const t = String(v ?? "").trim();
	return t ? escapeHtml(t) : "&nbsp;";
}

function formatTrainingTime(start: string, end: string): string {
	const s = String(start ?? "").trim().slice(0, 5);
	const e = String(end ?? "").trim().slice(0, 5);
	if (s && e) return `${s} ~ ${e}`;
	if (s) return s;
	if (e) return e;
	return "";
}

function parseAttendeeNames(attendees: string): string[] {
	return String(attendees ?? "")
		.split(/[,，、\n\r]+/)
		.map((n) => n.trim())
		.filter(Boolean);
}

function buildSignatureRows(names: string[]): string {
	const slots: string[] = [];
	for (let i = 0; i < 12; i++) slots.push(names[i] ?? "");
	const rows: string[] = [];
	for (let r = 0; r < 6; r++) {
		const left = slots[r * 2] ?? "";
		const right = slots[r * 2 + 1] ?? "";
		rows.push(
			`<tr>
        <td class="sig-name">${nbsp(left)}</td>
        <td class="sig-cell">&nbsp;</td>
        <td class="sig-name">${nbsp(right)}</td>
        <td class="sig-cell">&nbsp;</td>
      </tr>`
		);
	}
	return rows.join("");
}

export function buildJobTrainingPrintHtml(data: JobTrainingPrintData): string {
	const trainingDate = escapeHtml(data.trainingDate);
	const trainingTime = nbsp(formatTrainingTime(data.startTime, data.endTime));
	const names = parseAttendeeNames(data.attendees);
	const signatureRows = buildSignatureRows(names);
	const photoSrcs = Array.isArray(data.photoSrcs) ? data.photoSrcs.filter(Boolean) : [];
	const photoHtml = photoSrcs.length
		? photoSrcs
				.map(
					(src) =>
						`<div class="photo-item"><img src="${escapeHtml(src)}" alt="직무교육 사진" /></div>`
				)
				.join("")
		: "";

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>직원 직무교육</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', Batang, serif;
      font-size: 10.5pt;
      color: #000;
      background: #fff;
      line-height: 1.45;
    }
    .page {
      width: 100%;
      height: 281mm;
      display: flex;
      flex-direction: column;
    }
    .top-bar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
      flex-shrink: 0;
    }
    .top-spacer { width: 168px; flex-shrink: 0; }
    .doc-title-wrap {
      flex: 1;
      min-width: 0;
      text-align: center;
      padding-top: 10px;
    }
    .doc-title {
      display: inline-block;
      font-size: 20pt;
      font-weight: bold;
      letter-spacing: 0.2em;
      padding: 0 0.2em 2px;
      border-bottom: 2px solid #000;
    }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #000; vertical-align: middle; }
    .approval {
      width: 168px;
      flex-shrink: 0;
      font-size: 9.5pt;
      text-align: center;
    }
    .approval th {
      background: #f5f5f5;
      font-weight: normal;
      padding: 4px 2px;
      height: 26px;
    }
    .approval .sign-box { height: 52px; background: #fff; }
    .main {
      margin-bottom: 0;
      flex: 1 1 auto;
      height: 100%;
    }
    .main .lbl {
      width: 72px;
      min-width: 72px;
      background: #f5f5f5;
      text-align: center;
      font-weight: normal;
      padding: 6px 4px;
      white-space: nowrap;
    }
    .main .val { padding: 6px 8px; min-height: 28px; }
    .main .val-time { width: 24%; }
    .main .val-date { width: 22%; }
    .main .val-instructor { width: 26%; }
    .main .content-cell {
      padding: 8px 10px;
      vertical-align: top;
    }
    .main .content-cell .content-inner {
      min-height: 98mm;
      height: 100%;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
    }
    .main .attendee-cell {
      padding: 8px 10px;
      min-height: 36px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .main .eval-cell {
      padding: 8px 10px;
      vertical-align: top;
    }
    .main .eval-cell .eval-inner {
      min-height: 62mm;
      height: 100%;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
    }
    .footer-wrap {
      display: flex;
      align-items: stretch;
      width: 100%;
      margin-top: -1px;
      flex-shrink: 0;
    }
    .sign-area { flex: 1; min-width: 0; }
    .sign-grid { font-size: 10pt; height: 100%; }
    .memo-box {
      width: 36%;
      min-width: 58mm;
      border: 1px solid #000;
      border-left: none;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 186px;
    }
    .memo-box .photo-item {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid #ccc;
      background: #fff;
    }
    .memo-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .sign-grid th {
      background: #f5f5f5;
      font-weight: normal;
      text-align: center;
      padding: 5px 2px;
      height: 26px;
    }
    .sign-grid .sig-name {
      width: 22%;
      padding: 6px 4px;
      text-align: center;
      height: 30px;
    }
    .sign-grid .sig-cell {
      width: 28%;
      height: 30px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <div class="top-spacer" aria-hidden="true"></div>
      <div class="doc-title-wrap">
        <span class="doc-title">직원 직무교육</span>
      </div>
      <table class="approval">
        <tr>
          <th>담당</th>
          <th>검토</th>
          <th>결재</th>
        </tr>
        <tr>
          <td class="sign-box"></td>
          <td class="sign-box"></td>
          <td class="sign-box"></td>
        </tr>
      </table>
    </div>

    <table class="main">
      <tr>
        <td class="lbl">교육일자</td>
        <td class="val val-date">${trainingDate || "&nbsp;"}</td>
        <td class="lbl">교육시간</td>
        <td class="val val-time">${trainingTime}</td>
        <td class="lbl">강사명</td>
        <td class="val val-instructor">${nbsp(data.instructor)}</td>
      </tr>
      <tr>
        <td class="lbl">교육장소</td>
        <td class="val" colspan="5">${nbsp(data.place)}</td>
      </tr>
      <tr>
        <td class="lbl">교육제목</td>
        <td class="val" colspan="5">${nbsp(data.title)}</td>
      </tr>
      <tr>
        <td class="lbl">교육내용</td>
        <td class="val content-cell" colspan="5"><div class="content-inner">${nbsp(data.content)}</div></td>
      </tr>
      <tr>
        <td class="lbl">참석자</td>
        <td class="val attendee-cell" colspan="5">${nbsp(data.attendees)}</td>
      </tr>
      <tr>
        <td class="lbl">교육평가</td>
        <td class="val eval-cell" colspan="5"><div class="eval-inner">${nbsp(data.evaluation)}</div></td>
      </tr>
    </table>

    <div class="footer-wrap">
      <div class="sign-area">
        <table class="sign-grid">
          <tr>
            <th>참석자</th>
            <th>사인</th>
            <th>참석자</th>
            <th>사인</th>
          </tr>
          ${signatureRows}
        </table>
      </div>
      <div class="memo-box">${photoHtml}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * @file 외래진료기록 — 인쇄 헬퍼 (outpatientRecordPrint.ts)
 *
 * @description
 * 요양원 외래진료기록 기능의 인쇄 헬퍼입니다. 폴더: component/nursing-home/pages/outpatient-record
 *
 * @module component/nursing-home/pages/outpatient-record/outpatientRecordPrint
 */
/** 외래진료비(수급자별) 출력 HTML — R11010A / V11010B */

export type V11010BPrintRow = {
	장기요양기관기호?: string;
	장기요양기관명?: string;
	장기요양등급?: string;
	수급자성명?: string;
	주민등록번호?: string;
	장기요양인정번호?: string;
	진료일자?: string;
	외래구분?: string;
	진료비구분?: string;
	진료비?: number | null;
	수금여부?: string;
	수금액?: number | null;
	수금일자?: string;
	동행사원?: string;
	진료기관명?: string;
	진료의뢰내역?: string;
	진료결과?: string;
};

export type OutpatientPrintMeta = {
	startDate: string;
	endDate: string;
	facilityCode?: string;
	facilityName?: string;
	grade?: string;
	name?: string;
	rrn?: string;
	recogNo?: string;
};

function esc(v: unknown): string {
	return String(v ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function money(v: unknown): string {
	if (v == null || v === "") return "";
	const n = Number(v);
	if (!Number.isFinite(n)) return esc(v);
	return n.toLocaleString("ko-KR");
}

function isCenterFee(v: unknown): boolean {
	const s = String(v ?? "").trim();
	return s === "센타" || s === "센터";
}

function collectedAmount(row: V11010BPrintRow): number | null {
	if (row.수금액 != null && Number.isFinite(Number(row.수금액))) {
		return Number(row.수금액);
	}
	const status = String(row.수금여부 ?? "").trim();
	if (status === "수금") return Number(row.진료비) || 0;
	return null;
}

export function openPrintWindow(html: string) {
	const w = window.open("", "_blank");
	if (!w) {
		alert("팝업이 차단되어 출력을 열 수 없습니다.");
		return;
	}
	w.document.write(html);
	w.document.close();
	w.onload = () => {
		w.focus();
		w.print();
	};
}

export function buildOutpatientFeeHtml(
	rows: V11010BPrintRow[],
	meta: OutpatientPrintMeta
): string {
	const header = rows[0] || {};
	const facilityCode = meta.facilityCode || header.장기요양기관기호 || "";
	const facilityName = meta.facilityName || header.장기요양기관명 || "";
	const grade = meta.grade || header.장기요양등급 || "";
	const name = meta.name || header.수급자성명 || "";
	const rrn = meta.rrn || header.주민등록번호 || "";
	const recogNo = meta.recogNo || header.장기요양인정번호 || "";

	const body = rows
		.map((r) => {
			const collected = collectedAmount(r);
			return `
    <tr>
      <td>${esc(r.외래구분)}</td>
      <td>${esc(r.진료비구분)}</td>
      <td class="num">${money(r.진료비)}</td>
      <td class="num">${collected == null ? "" : money(collected)}</td>
      <td>${esc(r.동행사원)}</td>
      <td class="left">${esc(r.진료기관명)}</td>
      <td class="left">${esc(r.진료의뢰내역)}</td>
      <td class="left">${esc(r.진료결과)}</td>
    </tr>`;
		})
		.join("");

	const totalFee = rows.reduce((a, r) => a + (Number(r.진료비) || 0), 0);
	const totalCollected = rows.reduce((a, r) => {
		const c = collectedAmount(r);
		return a + (c == null ? 0 : c);
	}, 0);
	const centerPaid = rows.reduce((a, r) => {
		if (!isCenterFee(r.진료비구분)) return a;
		return a + (Number(r.진료비) || 0);
	}, 0);
	const unpaid = totalFee - totalCollected;

	const period =
		meta.startDate && meta.endDate
			? `${meta.startDate} ~ ${meta.endDate}`
			: meta.startDate || meta.endDate || "";

	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>외래진료비(수급자별)</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Malgun Gothic','맑은 고딕',sans-serif; font-size: 10pt; margin: 0; padding: 8mm; color: #000; }
.title { text-align: center; font-size: 20pt; font-weight: bold; text-decoration: underline; margin: 0 0 10px; letter-spacing: 3px; }
.top { position: relative; min-height: 56px; margin-bottom: 8px; }
.sig { position: absolute; top: 0; right: 0; border-collapse: collapse; width: 150px; font-size: 9pt; }
.sig th, .sig td { border: 1px solid #000; padding: 2px 4px; text-align: center; }
.sig th { font-weight: normal; }
.sig td { height: 32px; }
.info { width: calc(100% - 160px); border-collapse: collapse; border: 1px solid #000; font-size: 9.5pt; }
.info td { border: 1px solid #000; padding: 5px 8px; vertical-align: middle; }
.info .label { font-weight: bold; text-align: center; white-space: nowrap; width: 120px; background: #fff; }
.period { margin: 10px 0 8px; font-size: 11pt; }
table.main { width: 100%; border-collapse: collapse; border-top: 2px solid #000; border-bottom: 1px solid #000; font-size: 9pt; }
table.main th { border-bottom: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; }
table.main td { border: none; padding: 5px 4px; text-align: center; vertical-align: top; }
table.main td.num { text-align: right; padding-right: 6px; white-space: nowrap; }
table.main td.left { text-align: left; }
table.main tr.sum td { border-top: 1px solid #000; padding-top: 8px; padding-bottom: 8px; font-weight: bold; }
.sum-label { text-align: left !important; padding-left: 8px !important; }
.sum-extra { text-align: left !important; padding-left: 12px !important; font-weight: bold; white-space: nowrap; }
.footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 10pt; }
</style></head><body>
  <div class="title">외래진료비(수급자별)</div>
  <div class="top">
    <table class="sig">
      <tr><th>담당</th><th>검토</th><th>결재</th></tr>
      <tr><td></td><td></td><td></td></tr>
    </table>
    <table class="info">
      <tr>
        <td class="label">장기요양기관기호</td>
        <td>${esc(facilityCode)}</td>
        <td class="label">장기요양기관명</td>
        <td>${esc(facilityName)}</td>
        <td class="label">장기요양등급</td>
        <td>${esc(grade)}</td>
      </tr>
      <tr>
        <td class="label">수급자성명</td>
        <td>${esc(name)}</td>
        <td class="label">주민등록번호</td>
        <td>${esc(rrn)}</td>
        <td class="label">장기요양인정번호</td>
        <td>${esc(recogNo)}</td>
      </tr>
    </table>
  </div>
  <div class="period">조사기간 : ${esc(period)}</div>
  <table class="main">
    <thead>
      <tr>
        <th style="width:7%">외래구분</th>
        <th style="width:8%">진료비구분</th>
        <th style="width:9%">진료비</th>
        <th style="width:9%">수금액</th>
        <th style="width:9%">동행사원</th>
        <th style="width:12%">진료기관명</th>
        <th style="width:23%">진료의뢰내역</th>
        <th style="width:23%">진료결과</th>
      </tr>
    </thead>
    <tbody>
      ${body || `<tr><td colspan="8" style="padding:20px;text-align:center;">데이터가 없습니다</td></tr>`}
      <tr class="sum">
        <td colspan="2" class="sum-label">합계</td>
        <td class="num">${money(totalFee)}</td>
        <td class="num">${money(totalCollected)}</td>
        <td colspan="4" class="sum-extra">센터지급&nbsp;&nbsp;${money(centerPaid)}&nbsp;&nbsp;&nbsp;&nbsp;미수금&nbsp;&nbsp;${money(unpaid)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer"><span>R11010A</span><span>페이지: 1</span></div>
</body></html>`;
}

/** 외래진료비(미수금내역서) 출력 HTML — R11010B / V11010C */

export type V11010CPrintRow = {
	PNUM?: number | string;
	수급자?: string;
	생일?: string;
	상태?: string;
	보호자핸드폰?: string;
	진료비?: number | null;
	수금액?: number | null;
	미수금?: number | null;
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

export function openUnpaidPrintWindow(html: string) {
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

export function buildUnpaidStatementHtml(
	rows: V11010CPrintRow[],
	meta: { baseDate: string }
): string {
	const body = rows
		.map(
			(r) => `
    <tr>
      <td>${esc(r.수급자)}</td>
      <td>${esc(r.생일)}</td>
      <td>${esc(r.상태)}</td>
      <td>${esc(r.보호자핸드폰)}</td>
      <td class="num">${money(r.진료비)}</td>
      <td class="num">${money(r.수금액)}</td>
      <td class="num">${money(r.미수금)}</td>
    </tr>`
		)
		.join("");

	const totalFee = rows.reduce((a, r) => a + (Number(r.진료비) || 0), 0);
	const totalCollected = rows.reduce((a, r) => a + (Number(r.수금액) || 0), 0);
	const totalUnpaid = rows.reduce((a, r) => a + (Number(r.미수금) || 0), 0);

	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>외래진료비(미수금내역서)</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Malgun Gothic','맑은 고딕',sans-serif; font-size: 10pt; margin: 0; padding: 8mm; color: #000; }
.title { text-align: center; font-size: 20pt; font-weight: bold; text-decoration: underline; margin: 0 0 10px; letter-spacing: 2px; }
.top { position: relative; min-height: 48px; margin-bottom: 4px; }
.sig { position: absolute; top: 0; right: 0; border-collapse: collapse; width: 150px; font-size: 9pt; }
.sig th, .sig td { border: 1px solid #000; padding: 2px 4px; text-align: center; }
.sig th { font-weight: normal; }
.sig td { height: 32px; }
.base-date { margin: 8px 0 10px; font-size: 11pt; }
table.main { width: 100%; border-collapse: collapse; border-top: 2px solid #000; border-bottom: 1px solid #000; font-size: 10pt; }
table.main th { border-bottom: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; }
table.main td { border: none; padding: 7px 6px; text-align: center; vertical-align: middle; }
table.main td.num { text-align: right; padding-right: 10px; white-space: nowrap; }
table.main tr.sum td { border-top: 1px solid #000; padding-top: 10px; padding-bottom: 10px; font-weight: bold; }
.sum-label { text-align: center !important; }
.footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid #000; display: flex; justify-content: space-between; font-size: 10pt; }
</style></head><body>
  <div class="title">외래진료비(미수금내역서)</div>
  <div class="top">
    <table class="sig">
      <tr><th>담당</th><th>검토</th><th>결제</th></tr>
      <tr><td></td><td></td><td></td></tr>
    </table>
  </div>
  <div class="base-date">기준일자 : ${esc(meta.baseDate)}</div>
  <table class="main">
    <thead>
      <tr>
        <th style="width:16%">수급자</th>
        <th style="width:12%">생일</th>
        <th style="width:8%">상태</th>
        <th style="width:16%">보호자핸드폰</th>
        <th style="width:16%">진료비</th>
        <th style="width:16%">수금액</th>
        <th style="width:16%">미수금</th>
      </tr>
    </thead>
    <tbody>
      ${body || `<tr><td colspan="7" style="padding:20px;text-align:center;">데이터가 없습니다</td></tr>`}
      <tr class="sum">
        <td colspan="4" class="sum-label">합계</td>
        <td class="num">${money(totalFee)}</td>
        <td class="num">${money(totalCollected)}</td>
        <td class="num">${money(totalUnpaid)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer"><span>R11010B</span><span>페이지: 1</span></div>
</body></html>`;
}

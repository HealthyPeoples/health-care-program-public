/**
 * @file 입출금 전표 — 인쇄 헬퍼 (fundVoucherPrint.ts)
 *
 * @description
 * 요양원 입출금 전표 기능의 인쇄 헬퍼입니다. 폴더: component/nursing-home/pages/fund-voucher-registration
 *
 * @module component/nursing-home/pages/fund-voucher-registration/fundVoucherPrint
 */
import { openPrintPreviewWindow } from "../employee-attendance/employeeAttendancePrint";

export { openPrintPreviewWindow };

export type FundVoucherPrintRow = {
	DOC?: number | string | null;
	GLDT?: string | null;
	INVDT?: string | null;
	OBJ3NM?: string | null;
	DES?: string | null;
	AMT?: number | null;
	INVNM?: string | null;
	INVNM1?: string | null;
	INVOJ?: string | null;
};

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

function formatYmd(v?: string | null): string {
	const s = String(v ?? "").trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s;
}

function formatAmt(v?: number | null): string {
	if (v == null || Number.isNaN(Number(v))) return "";
	return Math.abs(Number(v)).toLocaleString("ko-KR");
}

function groupByDate(rows: FundVoucherPrintRow[]): { date: string; items: FundVoucherPrintRow[] }[] {
	const map = new Map<string, FundVoucherPrintRow[]>();
	for (const row of rows) {
		const key = formatYmd(row.GLDT) || "-";
		const list = map.get(key) || [];
		list.push(row);
		map.set(key, list);
	}
	return Array.from(map.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, items]) => ({ date, items }));
}

function voucherLineRows(items: FundVoucherPrintRow[]): string {
	if (!items.length) {
		return `<tr class="data-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
	}
	return items
		.map((row) => {
			const amt = row.AMT == null ? "" : formatAmt(row.AMT);
			return `<tr class="data-row">
        <td class="c">${nbsp(row.DOC != null ? String(row.DOC) : "")}</td>
        <td class="c">${nbsp(String(row.OBJ3NM ?? ""))}</td>
        <td class="c">${nbsp(String(row.DES ?? ""))}</td>
        <td class="c">${nbsp(amt)}</td>
        <td class="c">${nbsp(String(row.INVNM ?? ""))}</td>
        <td class="c">${nbsp(String(row.INVNM1 ?? ""))}</td>
        <td class="c">${nbsp(String(row.INVOJ ?? ""))}</td>
      </tr>`;
		})
		.join("");
}

export function buildExpenseResolutionPrintHtml(rows: FundVoucherPrintRow[]): string {
	const groups = groupByDate(rows);
	const pages = (groups.length ? groups : [{ date: "", items: [] as FundVoucherPrintRow[] }]).map((g) => {
		const total = g.items.reduce((sum, r) => sum + Math.abs(Number(r.AMT) || 0), 0);
		const cause = formatYmd(g.items[0]?.INVDT) || g.date;
		const ledger = g.date;
		const totalText = total ? formatAmt(total) : "";
		return `
<div class="page">
  <div class="head">
    <div class="title">지출결의서</div>
    <table class="approval">
      <tr><th>담당</th><th>검토</th><th>결재</th></tr>
      <tr><td></td><td></td><td></td></tr>
    </table>
  </div>
  <table class="info">
    <colgroup>
      <col style="width:22%" />
      <col style="width:28%" />
      <col style="width:22%" />
      <col style="width:28%" />
    </colgroup>
    <tr>
      <th>지출금액</th>
      <td colspan="3" class="amt">${total ? `₩${totalText}` : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>발의 및 원인행위일</th>
      <td class="c">${nbsp(cause)}</td>
      <th>지출부 기재</th>
      <td class="c">${nbsp(ledger)}</td>
    </tr>
  </table>
  <table class="detail">
    <colgroup>
      <col style="width:11%" />
      <col style="width:14%" />
      <col style="width:22%" />
      <col style="width:12%" />
      <col style="width:16%" />
      <col style="width:13%" />
      <col style="width:12%" />
    </colgroup>
    <tr>
      <td class="sec" colspan="7">내&nbsp;&nbsp;역</td>
    </tr>
    <tr>
      <th rowspan="2">지출결의번호</th>
      <th colspan="3">지출내역</th>
      <th colspan="2">채주(지급처)</th>
      <th rowspan="2">지급방법</th>
    </tr>
    <tr>
      <th>비&nbsp;목</th>
      <th>적&nbsp;요</th>
      <th>금&nbsp;액</th>
      <th>상호(소속)</th>
      <th>성명(대표)</th>
    </tr>
    ${voucherLineRows(g.items)}
    <tr class="body-space">
      <td colspan="7"></td>
    </tr>
    <tr class="sum">
      <th>합계</th>
      <td colspan="2"></td>
      <td class="c">${nbsp(totalText)}</td>
      <td colspan="3"></td>
    </tr>
    <tr class="proof">
      <th>증빙자료</th>
      <td colspan="6"></td>
    </tr>
  </table>
  <div class="declare">위 금액을 인출하여 지급하고자 합니다.</div>
  <div class="sign-wrap">
    <div class="ymd">년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일</div>
    <div class="officer">회계담당:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;( 인 )</div>
  </div>
  <div class="notes">
    <div>· 같은 날짜에 지출하는 경우 1개 지출결의서에 여러 건의 비목에 대한 일괄 지출결의 가능</div>
    <div>· 발의 및 원인행위 : 지출계획을 수립한 날짜 또는 품의한 날짜</div>
    <div>· 지출부기재일 : 통장에서 자금을 인출한 날짜</div>
    <div>· 증빙 : 각 비목별로 지출에 필요한 품의, 청구, 증빙자료를 기재하고 해당자료 별첨</div>
  </div>
</div>`;
	});

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #fff; color: #000; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 10.5pt;
      padding: 10mm 12mm;
    }
    .page {
      width: 186mm;
      min-height: 277mm;
      margin: 0 auto;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .head { position: relative; height: 22mm; margin-bottom: 2mm; }
    .title {
      text-align: center;
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: 0.55em;
      padding-top: 6mm;
    }
    .approval {
      position: absolute;
      top: 0;
      right: 0;
      width: 54mm;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .approval th, .approval td {
      border: 1px solid #000;
      text-align: center;
      font-size: 10pt;
      font-weight: 400;
    }
    .approval th { height: 7mm; font-weight: 400; }
    .approval td { height: 14mm; }
    table.info, table.detail {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.info { margin-bottom: 0; }
    table.info th, table.info td,
    table.detail th, table.detail td {
      border: 1px solid #000;
      vertical-align: middle;
      text-align: center;
      font-size: 10.5pt;
    }
    table.info th, table.detail th, table.detail .sec {
      font-weight: 700;
    }
    table.info tr { height: 9.5mm; }
    table.info .amt { font-size: 14pt; font-weight: 700; }
    table.detail .sec {
      height: 7mm;
      letter-spacing: 0.85em;
    }
    table.detail th { height: 7mm; font-size: 10pt; }
    .data-row td { height: 8mm; font-size: 10pt; }
    .body-space td { height: 98mm; }
    table.detail .sum th, table.detail .proof th { height: 9mm; }
    .declare {
      margin: 8mm auto 4mm;
      width: 120mm;
      border: 1px solid #000;
      text-align: center;
      font-size: 13pt;
      padding: 3.5mm 0;
    }
    .sign-wrap { text-align: right; padding-right: 10mm; margin-bottom: 8mm; }
    .ymd { font-size: 11pt; margin-bottom: 3mm; letter-spacing: 0.15em; }
    .officer { font-size: 12pt; }
    .notes {
      border: 1px solid #000;
      padding: 2.5mm 3.5mm;
      font-size: 9pt;
      line-height: 1.7;
    }
    .c { text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${pages.join("")}
</body>
</html>`;
}

export function buildIncomeStatementPrintHtml(rows: FundVoucherPrintRow[]): string {
	const groups = groupByDate(rows);
	const pages = (groups.length ? groups : [{ date: "", items: [] as FundVoucherPrintRow[] }]).map((g) => {
		const total = g.items.reduce((sum, r) => sum + Math.abs(Number(r.AMT) || 0), 0);
		const cause = formatYmd(g.items[0]?.INVDT) || g.date;
		const ledger = g.date;
		const totalText = total ? formatAmt(total) : "";
		return `
<div class="page">
  <div class="head">
    <div class="title">수입내역서</div>
    <table class="approval">
      <tr><th>담당</th><th>검토</th><th>결재</th></tr>
      <tr><td></td><td></td><td></td></tr>
    </table>
  </div>
  <table class="info">
    <colgroup>
      <col style="width:22%" />
      <col style="width:28%" />
      <col style="width:22%" />
      <col style="width:28%" />
    </colgroup>
    <tr>
      <th>수입금액</th>
      <td colspan="3" class="amt">${total ? `₩${totalText}` : "&nbsp;"}</td>
    </tr>
    <tr>
      <th>발의 및 원인행위일</th>
      <td class="c">${nbsp(cause)}</td>
      <th>수입부 기재</th>
      <td class="c">${nbsp(ledger)}</td>
    </tr>
  </table>
  <table class="detail">
    <colgroup>
      <col style="width:11%" />
      <col style="width:14%" />
      <col style="width:22%" />
      <col style="width:12%" />
      <col style="width:16%" />
      <col style="width:13%" />
      <col style="width:12%" />
    </colgroup>
    <tr>
      <td class="sec" colspan="7">내&nbsp;&nbsp;역</td>
    </tr>
    <tr>
      <th rowspan="2">수입번호</th>
      <th colspan="3">수입내역</th>
      <th colspan="2">입금처</th>
      <th rowspan="2">지급방법</th>
    </tr>
    <tr>
      <th>비&nbsp;목</th>
      <th>적&nbsp;요</th>
      <th>금&nbsp;액</th>
      <th>상호(소속)</th>
      <th>성명(대표)</th>
    </tr>
    ${voucherLineRows(g.items)}
    <tr class="body-space">
      <td colspan="7"></td>
    </tr>
    <tr class="sum">
      <th>합계</th>
      <td colspan="2"></td>
      <td class="c">${nbsp(totalText)}</td>
      <td colspan="3"></td>
    </tr>
    <tr class="proof">
      <th>증빙자료</th>
      <td colspan="6"></td>
    </tr>
  </table>
  <div class="declare">위 금액을 입금하고자 합니다.</div>
  <div class="sign-wrap">
    <div class="officer">회계담당:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;( 인 )</div>
  </div>
  <div class="notes">
    <div>· 동일일자에 입금되는 여러 비목을 한 장의 수입결의서로 작성할 수 있습니다.</div>
    <div>· 발의 및 원인행위일 : 수입계획이 수립된 날 또는 발의된 날을 기재합니다.</div>
    <div>· 수입부 기재 : 실제 은행계좌에 입금된 날을 기재합니다.</div>
    <div>· 증빙자료 : 각 비목별 관련 발의·청구 및 증빙서류를 열거하고 첨부합니다.</div>
  </div>
</div>`;
	});

	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #fff; color: #000; }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 10.5pt;
      padding: 10mm 12mm;
    }
    .page {
      width: 186mm;
      min-height: 277mm;
      margin: 0 auto;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .head { position: relative; height: 22mm; margin-bottom: 2mm; }
    .title {
      text-align: center;
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: 0.55em;
      padding-top: 6mm;
    }
    .approval {
      position: absolute;
      top: 0;
      right: 0;
      width: 54mm;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .approval th, .approval td {
      border: 1px solid #000;
      text-align: center;
      font-size: 10pt;
      font-weight: 400;
    }
    .approval th { height: 7mm; }
    .approval td { height: 14mm; }
    table.info, table.detail {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.info th, table.info td,
    table.detail th, table.detail td {
      border: 1px solid #000;
      vertical-align: middle;
      text-align: center;
      font-size: 10.5pt;
    }
    table.info th, table.detail th, table.detail .sec { font-weight: 700; }
    table.info tr { height: 9.5mm; }
    table.info .amt { font-size: 14pt; font-weight: 700; }
    table.detail .sec { height: 7mm; letter-spacing: 0.85em; }
    table.detail th { height: 7mm; font-size: 10pt; }
    .data-row td { height: 8mm; font-size: 10pt; }
    .body-space td { height: 98mm; }
    table.detail .sum th, table.detail .proof th { height: 9mm; }
    .declare {
      margin: 8mm auto 4mm;
      width: 120mm;
      border: 1px solid #000;
      text-align: center;
      font-size: 13pt;
      padding: 3.5mm 0;
    }
    .sign-wrap { text-align: right; padding-right: 10mm; margin-bottom: 8mm; }
    .officer { font-size: 12pt; }
    .notes {
      border: 1px solid #000;
      padding: 2.5mm 3.5mm;
      font-size: 9pt;
      line-height: 1.7;
    }
    .c { text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${pages.join("")}
</body>
</html>`;
}

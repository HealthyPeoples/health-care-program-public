/**
 * @file 월 급여명세서 — 엑셀 내려받기 (monthlySalaryStatementExcel.ts)
 *
 * @description
 * 화면에 보이는 명세서 행을 .xlsx로 저장합니다. 출력물 서식에는 식대합계·기타합계를 넣지 않고,
 * 엑셀 상단에만 급여년월과 함께 표시합니다. 다운로드 시 헤더·합계·숫자서식·열너비·틀고정을 적용합니다.
 *
 * @module component/nursing-home/pages/monthly-salary-statement/monthlySalaryStatementExcel
 */
import JSZip from "jszip";
import {
	num,
	rowMealTotal,
	sumMealTotal,
	sumOtherTotal,
	type StatementRow,
} from "./MonthlySalaryStatementUtils";

export type MonthlySalaryExcelOpts = {
	rows: StatementRow[];
	isOccurrenceView: boolean;
	payYearMonth: string;
	fileTitle?: string;
	facilityName?: string;
};

type Cell = { v: string | number; n?: boolean };

/** cellXfs 인덱스 (xl/styles.xml 과 동일) */
const S = {
	default: 0,
	metaLabel: 1,
	metaText: 2,
	metaAmount: 3,
	header: 4,
	bodyText: 5,
	bodyAmount: 6,
	totalText: 7,
	totalAmount: 8,
	bodyName: 9,
} as const;

function colLetter(index: number): string {
	let n = index;
	let s = "";
	while (n >= 0) {
		s = String.fromCharCode((n % 26) + 65) + s;
		n = Math.floor(n / 26) - 1;
	}
	return s;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function xmlCell(ref: string, cell: Cell, style: number): string {
	const sAttr = style ? ` s="${style}"` : "";
	if (cell.n && typeof cell.v === "number" && Number.isFinite(cell.v)) {
		return `<c r="${ref}"${sAttr} t="n"><v>${cell.v}</v></c>`;
	}
	return `<c r="${ref}"${sAttr} t="inlineStr"><is><t>${escapeXml(String(cell.v ?? ""))}</t></is></c>`;
}

function amt(v: unknown): number {
	return num(v);
}

function styleFor(rIdx: number, cIdx: number, cell: Cell, lastRow: number): number {
	if (rIdx === 0) {
		if (cIdx % 2 === 0) return S.metaLabel;
		return cell.n ? S.metaAmount : S.metaText;
	}
	if (rIdx === 1) return S.default;
	if (rIdx === 2) return S.header;
	if (rIdx === lastRow) return cell.n ? S.totalAmount : S.totalText;
	if (cell.n) return S.bodyAmount;
	return cIdx === 0 ? S.bodyName : S.bodyText;
}

export function buildMonthlySalaryExcelMatrix(opts: MonthlySalaryExcelOpts): Cell[][] {
	const { rows, isOccurrenceView, payYearMonth } = opts;
	const mealTotal = sumMealTotal(rows);
	const otherTotal = sumOtherTotal(rows);
	const title = opts.fileTitle || (isOccurrenceView ? "수급자급여 발생내역서" : "월 급여명세서");

	const head: Cell[][] = [
		[
			{ v: "제목" },
			{ v: title },
			{ v: "급여년월" },
			{ v: payYearMonth },
			{ v: "식대합계" },
			{ v: mealTotal, n: true },
			{ v: "기타합계" },
			{ v: otherTotal, n: true },
		],
		[],
	];

	if (isOccurrenceView) {
		const headers = [
			"수급자",
			"등급",
			"인정번호",
			"공단부담금",
			"수급자부담금",
			"비급여식대",
			"비급여간식",
			"비급여의료비",
			"이미용",
			"상급침실료",
			"촉탁의료비",
			"처방비",
			"기타비용",
			"수급자부담금합계",
		];
		const body = rows.map((r) => [
			{ v: r.recipient },
			{ v: r.grade },
			{ v: r.recognitionNo },
			{ v: amt(r.nhaContribution), n: true },
			{ v: amt(r.recipientContribution), n: true },
			{ v: amt(r.nonBenefitMeal), n: true },
			{ v: amt(r.nonBenefitSnack), n: true },
			{ v: amt(r.outpatientFee), n: true },
			{ v: amt(r.beautyCost), n: true },
			{ v: amt(r.roomUpgradeFee), n: true },
			{ v: amt(r.contractedMedical), n: true },
			{ v: amt(r.contractedPrescription), n: true },
			{ v: amt(r.otherCostsRecipient), n: true },
			{ v: amt(r.recipientBurdenTotal), n: true },
		]);
		const totals: Cell[] = [
			{ v: "합계" },
			{ v: "" },
			{ v: "" },
			{ v: body.reduce((s, row) => s + Number(row[3].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[4].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[5].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[6].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[7].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[8].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[9].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[10].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[11].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[12].v || 0), 0), n: true },
			{ v: body.reduce((s, row) => s + Number(row[13].v || 0), 0), n: true },
		];
		return [...head, headers.map((h) => ({ v: h })), ...body, totals];
	}

	const headers = [
		"수급자",
		"생일",
		"등급",
		"급여합계",
		"공단부담금",
		"수급자부담금",
		"비급여식대",
		"병실승급비",
		"외래진료비",
		"촉탁의료",
		"촉탁처방",
		"이미용비",
		"기타비용 수급",
		"수급자부담금합계",
	];
	const body = rows.map((r) => [
		{ v: r.recipient },
		{ v: r.birthday },
		{ v: r.grade },
		{ v: amt(r.benefitTotal), n: true },
		{ v: amt(r.nhaContribution), n: true },
		{ v: amt(r.recipientContribution), n: true },
		{ v: rowMealTotal(r), n: true },
		{ v: amt(r.roomUpgradeFee), n: true },
		{ v: amt(r.outpatientFee), n: true },
		{ v: amt(r.contractedMedical), n: true },
		{ v: amt(r.contractedPrescription), n: true },
		{ v: amt(r.beautyCost), n: true },
		{ v: amt(r.otherCostsRecipient), n: true },
		{ v: amt(r.recipientBurdenTotal), n: true },
	]);
	const totals: Cell[] = [
		{ v: "합계" },
		{ v: "" },
		{ v: "" },
		{ v: body.reduce((s, row) => s + Number(row[3].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[4].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[5].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[6].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[7].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[8].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[9].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[10].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[11].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[12].v || 0), 0), n: true },
		{ v: body.reduce((s, row) => s + Number(row[13].v || 0), 0), n: true },
	];
	return [...head, headers.map((h) => ({ v: h })), ...body, totals];
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0"/>
  </numFmts>
  <fonts count="3">
    <font><sz val="11"/><color theme="1"/><name val="Malgun Gothic"/><family val="2"/></font>
    <font><b/><sz val="11"/><color theme="1"/><name val="Malgun Gothic"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Malgun Gothic"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="thin"><color rgb="FF94A3B8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

export function buildMonthlySalarySheetXml(opts: MonthlySalaryExcelOpts): string {
	const matrix = buildMonthlySalaryExcelMatrix(opts);
	const lastRow = matrix.length;
	const colCount = Math.max(1, ...matrix.map((row) => row.length));
	const lastCol = colLetter(colCount - 1);
	const colsXml = Array.from({ length: colCount }, (_, i) => {
		const width = i === 0 ? 14 : i === 1 || i === 2 ? 12 : 13;
		return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
	}).join("");
	const rowsXml = matrix
		.map((row, rIdx) => {
			const r = rIdx + 1;
			const ht = rIdx === 2 ? ` ht="22" customHeight="1"` : "";
			const cells = row
				.map((cell, cIdx) =>
					xmlCell(`${colLetter(cIdx)}${r}`, cell, styleFor(rIdx, cIdx, cell, lastRow - 1))
				)
				.join("");
			return `<row r="${r}"${ht}>${cells}</row>`;
		})
		.join("");
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18" defaultColWidth="12"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  <autoFilter ref="A3:${lastCol}${lastRow}"/>
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  <pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

export async function buildMonthlySalaryExcelBlob(opts: MonthlySalaryExcelOpts): Promise<Blob> {
	const zip = new JSZip();
	zip.file(
		"[Content_Types].xml",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
	);
	zip.folder("_rels")?.file(
		".rels",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
	);
	const xl = zip.folder("xl");
	xl?.file(
		"workbook.xml",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="급여명세서" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
	);
	xl?.folder("_rels")?.file(
		"workbook.xml.rels",
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
	);
	xl?.file("styles.xml", STYLES_XML);
	xl?.folder("worksheets")?.file("sheet1.xml", buildMonthlySalarySheetXml(opts));

	return zip.generateAsync({
		type: "blob",
		mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
}

function sanitizeFileNamePart(raw: string): string {
	return String(raw || "")
		.trim()
		.replace(/[\\/:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.replace(/[. ]+$/g, "");
}

export function buildMonthlySalaryExcelFileName(opts: Pick<MonthlySalaryExcelOpts, "facilityName" | "payYearMonth" | "rows">): string {
	const fromOpt = sanitizeFileNamePart(opts.facilityName || "");
	const fromRow = sanitizeFileNamePart(String(opts.rows?.[0]?.annm ?? ""));
	const facility = fromOpt || fromRow || "기관";
	const ym = String(opts.payYearMonth || "").replace(/[^\d-]/g, "") || "월급여";
	return `${facility}_급여명세서_${ym}`;
}

export async function downloadMonthlySalaryExcel(opts: MonthlySalaryExcelOpts): Promise<void> {
	if (typeof window === "undefined") return;
	const blob = await buildMonthlySalaryExcelBlob(opts);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${buildMonthlySalaryExcelFileName(opts)}.xlsx`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

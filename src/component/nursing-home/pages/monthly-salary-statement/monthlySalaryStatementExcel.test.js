/**
 * @file 월 급여명세서 — 엑셀 내려받기 테스트
 *
 * @module component/nursing-home/pages/monthly-salary-statement/monthlySalaryStatementExcel.test
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const DIR = __dirname;
const pid = process.pid;

function transpile(filePath) {
	const source = fs.readFileSync(filePath, "utf8");
	const { outputText } = ts.transpileModule(source, {
		fileName: path.basename(filePath),
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
		},
	});
	return outputText;
}

function loadExcel() {
	const printOut = path.join(DIR, `.print.excel.${pid}.cjs`);
	const utilsOut = path.join(DIR, `.utils.excel.${pid}.cjs`);
	const careOut = path.join(DIR, `.care.excel.${pid}.cjs`);
	const excelOut = path.join(DIR, `.excel.compiled.${pid}.cjs`);
	const careTs = path.join(DIR, "../../utils/careGrade.ts");
	const careJs = path.join(DIR, "../../utils/careGrade.js");
	try {
		const careSrc = fs.existsSync(careJs)
			? fs.readFileSync(careJs, "utf8")
			: transpile(careTs);
		fs.writeFileSync(careOut, careSrc);
		let printText = transpile(path.join(DIR, "MonthlySalaryStatementPrint.ts"));
		printText = printText.replace(
			/require\(["']\.\.\/\.\.\/utils\/careGrade["']\)/g,
			`require(${JSON.stringify(careOut)})`
		);
		fs.writeFileSync(printOut, printText);
		let utilsText = transpile(path.join(DIR, "MonthlySalaryStatementUtils.ts"));
		utilsText = utilsText.replace(
			/require\(["']\.\/MonthlySalaryStatementPrint["']\)/g,
			`require(${JSON.stringify(printOut)})`
		);
		utilsText = utilsText.replace(
			/require\(["']\.\.\/\.\.\/utils\/careGrade["']\)/g,
			`require(${JSON.stringify(careOut)})`
		);
		fs.writeFileSync(utilsOut, utilsText);
		let excelText = transpile(path.join(DIR, "monthlySalaryStatementExcel.ts"));
		excelText = excelText.replace(
			/require\(["']\.\/MonthlySalaryStatementUtils["']\)/g,
			`require(${JSON.stringify(utilsOut)})`
		);
		fs.writeFileSync(excelOut, excelText);
		delete require.cache[require.resolve(excelOut)];
		return require(excelOut);
	} finally {
		for (const f of [printOut, utilsOut, careOut, excelOut]) {
			try {
				fs.unlinkSync(f);
			} catch {
				/* ignore */
			}
		}
	}
}

const sample = {
	pnum: "1",
	recipient: "홍길동",
	birthday: "1950-01-01",
	grade: "3등급",
	recognitionNo: "L1",
	benefitTotal: "1000",
	nhaContribution: "800",
	recipientContribution: "200",
	nonBenefitMeal: "10",
	nonBenefitSnack: "5",
	roomUpgradeFee: "0",
	outpatientFee: "20",
	contractedMedical: "30",
	contractedPrescription: "40",
	beautyCost: "50",
	otherCostsRecipient: "60",
	recipientBurdenTotal: "415",
	pSt: "1",
	bathFee: "0",
	dementiaFee: "0",
	snm: "",
	sGu: "",
	enm: "",
	rdes: "",
	angh: "",
	annm: "",
	anadd: "",
	taxnum: "",
	taxown: "",
	antel: "",
};

describe("monthlySalaryStatementExcel", () => {
	let excel;

	before(() => {
		excel = loadExcel();
	});

	it("발생내역서 시트에 식대합계·기타합계·비급여식대가 들어간다", () => {
		const matrix = excel.buildMonthlySalaryExcelMatrix({
			rows: [sample],
			isOccurrenceView: true,
			payYearMonth: "2024-06",
		});
		assert.equal(matrix[0][4].v, "식대합계");
		assert.equal(matrix[0][5].v, 15);
		assert.equal(matrix[0][6].v, "기타합계");
		assert.equal(matrix[0][7].v, 150);
		const header = matrix[2].map((c) => c.v);
		assert.ok(header.includes("비급여식대"));
		assert.ok(header.includes("비급여의료비"));
	});

	it("시트 XML에 헤더·합계 스타일과 숫자서식이 들어간다", () => {
		const xml = excel.buildMonthlySalarySheetXml({
			rows: [sample],
			isOccurrenceView: true,
			payYearMonth: "2024-06",
		});
		assert.match(xml, /s="4"/);
		assert.match(xml, /s="8"/);
		assert.match(xml, /frozen/);
		assert.match(xml, /orientation="landscape"/);
		assert.match(xml, /autoFilter/);
	});

	it("파일명은 기관명_급여명세서_연월", () => {
		assert.equal(
			excel.buildMonthlySalaryExcelFileName({
				facilityName: "해원요양원",
				payYearMonth: "2026-07",
				rows: [sample],
			}),
			"해원요양원_급여명세서_2026-07"
		);
		assert.equal(
			excel.buildMonthlySalaryExcelFileName({
				facilityName: "해원/요양원:A",
				payYearMonth: "2026-07",
				rows: [sample],
			}),
			"해원요양원A_급여명세서_2026-07"
		);
	});
});

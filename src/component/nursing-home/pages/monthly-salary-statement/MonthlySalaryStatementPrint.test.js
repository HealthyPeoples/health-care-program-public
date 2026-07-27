/**
 * MonthlySalaryStatementPrint — 인쇄 HTML 빌더 export·배선 최소 검증
 * (비즈니스 로직/금액 계산 테스트 아님)
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const DIR = __dirname;
const PRINT_TS = path.join(DIR, "MonthlySalaryStatementPrint.ts");
const PARENT_TSX = path.join(DIR, "MonthlySalaryStatement.tsx");

function loadPrint() {
	const source = fs.readFileSync(PRINT_TS, "utf8");
	const { outputText } = ts.transpileModule(source, {
		fileName: "MonthlySalaryStatementPrint.ts",
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
		},
	});
	const outFile = path.join(DIR, `.MonthlySalaryStatementPrint.compiled.${process.pid}.cjs`);
	fs.writeFileSync(outFile, outputText, "utf8");
	try {
		delete require.cache[require.resolve(outFile)];
		return require(outFile);
	} finally {
		try {
			fs.unlinkSync(outFile);
		} catch {
			/* ignore */
		}
	}
}

describe("MonthlySalaryStatementPrint — builders", () => {
	let Print;

	before(() => {
		Print = loadPrint();
	});

	it("공개 API export", () => {
		assert.equal(typeof Print.openPrintPreviewWindow, "function");
		assert.equal(typeof Print.buildSalaryOccurrencePrintHtml, "function");
		assert.equal(typeof Print.buildStatementLedgerPrintHtml, "function");
		assert.equal(typeof Print.wrapF24PrintHtml, "function");
		assert.equal(typeof Print.buildBenefitStatement24Body, "function");
		assert.equal(typeof Print.statementRowToV40100EFallback, "function");
		assert.equal(typeof Print.buildPaymentConfirmation25PrintHtml, "function");
		assert.equal(typeof Print.statementRowToV40100GFallback, "function");
		assert.equal(typeof Print.lastDayOfPayYearMonth, "function");
		assert.equal(typeof Print.normalizeSGu, "function");
	});

	it("발생내역서 HTML에 기간·테이블 포함", () => {
		const html = Print.buildSalaryOccurrencePrintHtml("2024-06", []);
		assert.match(html, /수급자급여 발생내역서/);
		assert.match(html, /\(2024-06월분\)/);
		assert.match(html, /<!DOCTYPE html>/i);
	});

	it("발부대장 HTML에 폼 반영", () => {
		const html = Print.buildStatementLedgerPrintHtml(
			"2024-06",
			[],
			{
				deliveryMethod: "2",
				deliverer: "너싱홈 해원",
				recipientName: "보호자",
				receiveContent: "급여비용명세서",
			},
			"2024-06-30"
		);
		assert.match(html, /명세서 발부대장/);
		assert.match(html, /발행일자/);
	});

	it("훅: Print import + fetch 핸들러 유지", () => {
		const hook = fs.readFileSync(path.join(DIR, "useMonthlySalaryStatement.ts"), "utf8");
		assert.match(hook, /from "\.\/MonthlySalaryStatementPrint"/);
		assert.match(hook, /const printOccurrence = useCallback/);
		assert.match(hook, /const printLedger = useCallback/);
		assert.match(hook, /const printBenefitStatement = useCallback/);
		assert.match(hook, /const printPaymentConfirmation = useCallback/);
		assert.match(hook, /\/api\/v40100\?/);
		assert.match(hook, /\/api\/v40100d\?/);
		assert.match(hook, /\/api\/v40100e\?/);
		assert.match(hook, /\/api\/v40100g\?/);
		assert.doesNotMatch(hook, /function openPrintPreviewWindow/);
		assert.doesNotMatch(hook, /function buildSalaryOccurrencePrintHtml/);
		assert.doesNotMatch(hook, /function wrapF24PrintHtml/);
	});
});

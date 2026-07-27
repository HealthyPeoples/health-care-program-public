/**
 * MonthlySalaryStatementFilter — 렌더링·이벤트 전달 최소 검증
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const FILTER_TSX = path.join(DIR, 'MonthlySalaryStatementFilter.tsx');
const TOOLBAR_TSX = path.join(DIR, 'MonthlySalaryStatementToolbar.tsx');

function loadFilter() {
	const source = fs.readFileSync(FILTER_TSX, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		fileName: 'MonthlySalaryStatementFilter.tsx',
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.React,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
		},
	});
	const outFile = path.join(DIR, `.MonthlySalaryStatementFilter.compiled.${process.pid}.cjs`);
	fs.writeFileSync(outFile, outputText, 'utf8');
	try {
		delete require.cache[require.resolve(outFile)];
		const mod = require(outFile);
		return mod.default || mod;
	} finally {
		try {
			fs.unlinkSync(outFile);
		} catch {
			/* ignore */
		}
	}
}

function baseProps(overrides = {}) {
	return {
		payYearMonth: '2024-06',
		recipientFilter: '',
		checkedCount: 0,
		facilityIssueDate: '',
		onPayYearMonthChange: () => {},
		onRecipientFilterChange: () => {},
		onOpenIssueDateModal: () => {},
		...overrides,
	};
}

describe('MonthlySalaryStatementFilter — presentational', () => {
	let Filter;

	before(() => {
		Filter = loadFilter();
		assert.equal(typeof Filter, 'function');
	});

	it('급여년월·수급자·발행일자 버튼 렌더', () => {
		const html = renderToStaticMarkup(
			React.createElement('div', null, React.createElement(Filter, baseProps()))
		);
		assert.match(html, /급여년월/);
		assert.match(html, /수급자/);
		assert.match(html, /발행일자전체변경/);
		assert.match(html, /type="month"/);
		assert.match(html, /value="2024-06"/);
	});

	it('checkedCount / facilityIssueDate 표시', () => {
		const html = renderToStaticMarkup(
			React.createElement(
				'div',
				null,
				React.createElement(
					Filter,
					baseProps({ checkedCount: 2, facilityIssueDate: '2024-06-30' })
				)
			)
		);
		assert.match(html, /선택 2명/);
		assert.match(html, /발행일자: 2024-06-30/);
	});

	it('이벤트 props 배선 (소스)', () => {
		const src = fs.readFileSync(FILTER_TSX, 'utf8');
		assert.match(src, /onChange=\{\(e\) => onPayYearMonthChange\(e\.target\.value\)\}/);
		assert.match(src, /onChange=\{\(e\) => onRecipientFilterChange\(e\.target\.value\)\}/);
		assert.match(src, /onClick=\{onOpenIssueDateModal\}/);
	});

	it('Toolbar가 Filter를 조합함', () => {
		const toolbar = fs.readFileSync(TOOLBAR_TSX, 'utf8');
		assert.match(toolbar, /import MonthlySalaryStatementFilter/);
		assert.match(toolbar, /<MonthlySalaryStatementFilter/);
		assert.match(toolbar, /onPayYearMonthChange=\{onPayYearMonthChange\}/);
		assert.match(toolbar, /onRecipientFilterChange=\{onRecipientFilterChange\}/);
		assert.match(toolbar, /onOpenIssueDateModal=\{onOpenIssueDateModal\}/);
	});
});

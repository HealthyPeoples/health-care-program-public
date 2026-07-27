/**
 * MonthlySalaryStatementToolbar — 렌더링·이벤트 전달 최소 검증
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const TOOLBAR_TSX = path.join(DIR, 'MonthlySalaryStatementToolbar.tsx');
const PARENT_TSX = path.join(DIR, 'MonthlySalaryStatement.tsx');

function transpileTsx(filePath, outName) {
	const source = fs.readFileSync(filePath, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		fileName: path.basename(filePath),
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.React,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
		},
	});
	const outFile = path.join(DIR, `${outName}.${process.pid}.cjs`);
	fs.writeFileSync(outFile, outputText, 'utf8');
	return outFile;
}

function loadToolbar() {
	const filterOut = transpileTsx(
		path.join(DIR, 'MonthlySalaryStatementFilter.tsx'),
		'.MonthlySalaryStatementFilter.compiled'
	);
	let toolbarOut;
	try {
		const source = fs.readFileSync(TOOLBAR_TSX, 'utf8');
		let { outputText } = ts.transpileModule(source, {
			fileName: 'MonthlySalaryStatementToolbar.tsx',
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				jsx: ts.JsxEmit.React,
				target: ts.ScriptTarget.ES2019,
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
			},
		});
		outputText = outputText.replace(
			/require\(["']\.\/MonthlySalaryStatementFilter["']\)/g,
			`require(${JSON.stringify(filterOut)})`
		);
		toolbarOut = path.join(DIR, `.MonthlySalaryStatementToolbar.compiled.${process.pid}.cjs`);
		fs.writeFileSync(toolbarOut, outputText, 'utf8');
		delete require.cache[require.resolve(filterOut)];
		delete require.cache[require.resolve(toolbarOut)];
		const mod = require(toolbarOut);
		return mod.default || mod;
	} finally {
		for (const f of [filterOut, toolbarOut]) {
			if (!f) continue;
			try {
				fs.unlinkSync(f);
			} catch {
				/* ignore */
			}
		}
	}
}

const TABS = [
	{ id: 'occurrence', label: '전체 발생내역서 출력' },
	{ id: 'ledger', label: '전체 발부대장 출력' },
	{ id: 'statement', label: '급여명세서 출력' },
	{ id: 'payment', label: '납부확인서 출력' },
];

function baseProps(overrides = {}) {
	return {
		activeTab: null,
		tabTitle: '명세서 발부대장',
		payYearMonth: '2024-06',
		recipientFilter: '',
		checkedCount: 0,
		facilityIssueDate: '',
		searchError: null,
		tabs: TABS,
		onPayYearMonthChange: () => {},
		onRecipientFilterChange: () => {},
		onOpenIssueDateModal: () => {},
		onDocumentKindClick: () => {},
		...overrides,
	};
}

describe('MonthlySalaryStatementToolbar — presentational', () => {
	let Toolbar;

	before(() => {
		Toolbar = loadToolbar();
		assert.equal(typeof Toolbar, 'function');
	});

	it('기본 제목·급여년월·수급자 필터 렌더', () => {
		const html = renderToStaticMarkup(React.createElement(Toolbar, baseProps()));
		assert.match(html, /장기요양급여비용/);
		assert.match(html, /명세서발부대장/);
		assert.match(html, /급여년월/);
		assert.match(html, /수급자/);
		assert.match(html, /발행일자전체변경/);
		assert.match(html, /type="month"/);
		assert.match(html, /value="2024-06"/);
	});

	it('occurrence 탭이면 tabTitle만 표시', () => {
		const html = renderToStaticMarkup(
			React.createElement(
				Toolbar,
				baseProps({ activeTab: 'occurrence', tabTitle: '수급자급여 발생내역서' })
			)
		);
		assert.match(html, /수급자급여 발생내역서/);
		assert.doesNotMatch(html, /장기요양급여비용/);
	});

	it('checkedCount / facilityIssueDate / searchError 표시', () => {
		const html = renderToStaticMarkup(
			React.createElement(
				Toolbar,
				baseProps({
					checkedCount: 3,
					facilityIssueDate: '2024-06-30',
					searchError: '조회 실패 테스트',
				})
			)
		);
		assert.match(html, /선택 3명/);
		assert.match(html, /발행일자: 2024-06-30/);
		assert.match(html, /조회 실패 테스트/);
	});

	it('탭 라벨 렌더', () => {
		const html = renderToStaticMarkup(React.createElement(Toolbar, baseProps()));
		for (const t of TABS) assert.match(html, new RegExp(t.label));
	});

	it('이벤트 props 배선 (소스)', () => {
		const src = fs.readFileSync(TOOLBAR_TSX, 'utf8');
		assert.match(src, /onClick=\{\(\) => onDocumentKindClick\(tab\.id\)\}/);
		assert.match(src, /<MonthlySalaryStatementFilter/);
		assert.match(src, /onPayYearMonthChange=\{onPayYearMonthChange\}/);
		assert.match(src, /onRecipientFilterChange=\{onRecipientFilterChange\}/);
		assert.match(src, /onOpenIssueDateModal=\{onOpenIssueDateModal\}/);
	});

	it('부모 배선 유지', () => {
		const parent = fs.readFileSync(PARENT_TSX, 'utf8');
		const hook = fs.readFileSync(path.join(DIR, 'useMonthlySalaryStatement.ts'), 'utf8');
		assert.match(parent, /<MonthlySalaryStatementToolbar/);
		assert.match(parent, /onPayYearMonthChange=\{handlePayYearMonthChange\}/);
		assert.match(parent, /onRecipientFilterChange=\{handleRecipientFilterChange\}/);
		assert.match(parent, /onOpenIssueDateModal=\{openIssueDateModal\}/);
		assert.match(parent, /onDocumentKindClick=\{/);
		assert.match(parent, /handleDocumentKindClickSafe/);
		assert.match(parent, /tabs=\{TABS\}/);
		assert.match(parent, /checkedCount=\{checkedPnums\.size\}/);
		assert.match(hook, /const handlePayYearMonthChange =/);
		assert.match(hook, /const handleDocumentKindClickSafe =/);
	});
});

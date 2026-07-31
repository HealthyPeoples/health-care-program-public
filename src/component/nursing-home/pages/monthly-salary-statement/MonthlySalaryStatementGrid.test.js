/**
 * @file 월 급여명세서 — UI 부분 컴포넌트 (MonthlySalaryStatementGrid.test.js)
 *
 * @description
 * 요양원 월 급여명세서 기능의 UI 부분 컴포넌트입니다. 폴더: component/nursing-home/pages/monthly-salary-statement
 *
 * @module component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatementGrid.test
 */
/**
 * MonthlySalaryStatementGrid — 렌더링·이벤트 전달 최소 검증
 * (비즈니스 로직 테스트 없음. 신규 라이브러리 미추가 — typescript transpile + react-dom/server)
 *
 * 실행: node --test src/component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatementGrid.test.js
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const GRID_TSX = path.join(DIR, 'MonthlySalaryStatementGrid.tsx');
const PARENT_TSX = path.join(DIR, 'MonthlySalaryStatement.tsx');

function loadGridComponent() {
	const source = fs.readFileSync(GRID_TSX, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		fileName: 'MonthlySalaryStatementGrid.tsx',
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.React,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
		},
	});
	// node_modules resolve를 위해 프로젝트 디렉터리에 임시 출력
	const outFile = path.join(DIR, `.MonthlySalaryStatementGrid.compiled.${process.pid}.cjs`);
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

function sampleRow(overrides = {}) {
	return {
		pnum: '100',
		recipient: '홍길동',
		birthday: '1950-01-01',
		grade: '3등급',
		recognitionNo: 'L123',
		benefitTotal: '1000',
		nhaContribution: '800',
		recipientContribution: '200',
		nonBenefitMeal: '10',
		nonBenefitSnack: '5',
		roomUpgradeFee: '0',
		outpatientFee: '20',
		contractedMedical: '30',
		contractedPrescription: '40',
		beautyCost: '50',
		otherCostsRecipient: '60',
		recipientBurdenTotal: '415',
		...overrides,
	};
}

function baseProps(overrides = {}) {
	return {
		isOccurrenceView: false,
		loading: false,
		filteredRows: [],
		statementRowsLength: 0,
		filteredPnumsLength: 0,
		allFilteredChecked: false,
		someFilteredChecked: false,
		selectedPnum: null,
		checkedPnums: new Set(),
		onToggleSelectAllFiltered: () => {},
		onRowClick: () => {},
		onCheckClick: () => {},
		...overrides,
	};
}

describe('MonthlySalaryStatementGrid — presentational', () => {
	let Grid;

	before(() => {
		Grid = loadGridComponent();
		assert.equal(typeof Grid, 'function');
	});

	it('loading=true 이면 occurrence/ledger 모두 "조회 중입니다…" 표시', () => {
		for (const isOccurrenceView of [true, false]) {
			const html = renderToStaticMarkup(
				React.createElement(Grid, baseProps({ isOccurrenceView, loading: true }))
			);
			assert.match(html, /조회 중입니다…/);
		}
	});

	it('빈 데이터: statementRowsLength=0 이면 탭별 empty 메시지 동일', () => {
		const occ = renderToStaticMarkup(
			React.createElement(
				Grid,
				baseProps({ isOccurrenceView: true, statementRowsLength: 0, filteredRows: [] })
			)
		);
		assert.match(
			occ,
			/데이터가 없습니다\. 해당 급여년월 급여 자료를 확인해 주세요\./
		);
		assert.doesNotMatch(occ, /F40100 급여 HEAD/);

		const led = renderToStaticMarkup(
			React.createElement(
				Grid,
				baseProps({ isOccurrenceView: false, statementRowsLength: 0, filteredRows: [] })
			)
		);
		assert.match(led, /F40100 급여 HEAD/);
	});

	it('빈 데이터: 필터만 비면 필터 메시지', () => {
		const html = renderToStaticMarkup(
			React.createElement(
				Grid,
				baseProps({
					isOccurrenceView: true,
					statementRowsLength: 3,
					filteredRows: [],
				})
			)
		);
		assert.match(html, /수급자명 필터에 맞는 행이 없습니다/);
	});

	it('occurrence / ledger 컬럼 헤더 전환', () => {
		const occ = renderToStaticMarkup(
			React.createElement(
				Grid,
				baseProps({
					isOccurrenceView: true,
					filteredRows: [sampleRow()],
					statementRowsLength: 1,
					filteredPnumsLength: 1,
				})
			)
		);
		assert.match(occ, /수급자부담금합계/);
		assert.match(occ, /인정번호/);
		assert.doesNotMatch(occ, /기타비용 수급/);
		assert.doesNotMatch(occ, />생일</);

		const led = renderToStaticMarkup(
			React.createElement(
				Grid,
				baseProps({
					isOccurrenceView: false,
					filteredRows: [sampleRow()],
					statementRowsLength: 1,
					filteredPnumsLength: 1,
				})
			)
		);
		assert.match(led, /기타비용 수급/);
		assert.match(led, />생일</);
		assert.doesNotMatch(led, /수급자부담금합계/);
	});

	it('행 데이터 렌더 (recipient)', () => {
		const html = renderToStaticMarkup(
			React.createElement(
				Grid,
				baseProps({
					isOccurrenceView: false,
					filteredRows: [sampleRow({ recipient: '테스트수급자' })],
					statementRowsLength: 1,
					filteredPnumsLength: 1,
				})
			)
		);
		assert.match(html, /테스트수급자/);
	});

	it('onRowClick / onCheckClick / onToggleSelectAllFiltered props가 핸들러로 연결됨 (소스)', () => {
		const src = fs.readFileSync(GRID_TSX, 'utf8');
		assert.match(src, /onChange=\{onToggleSelectAllFiltered\}/);
		assert.match(src, /onClick=\{\(\) => onRowClick\(row\)\}/);
		assert.match(src, /onClick=\{\(e\) => onCheckClick\(e, row\)\}/);
		// indeterminate 동일 패턴 (occurrence + ledger)
		const indeterminateMatches = src.match(/el\.indeterminate = someFilteredChecked/g) || [];
		assert.equal(indeterminateMatches.length, 2);
	});

	it('부모에서 핸들러·props 배선이 유지됨', () => {
		const parent = fs.readFileSync(PARENT_TSX, 'utf8');
		const hook = fs.readFileSync(path.join(DIR, 'useMonthlySalaryStatement.ts'), 'utf8');
		assert.match(parent, /<MonthlySalaryStatementGrid/);
		assert.match(parent, /onToggleSelectAllFiltered=\{toggleSelectAllFiltered\}/);
		assert.match(parent, /onRowClick=\{\(row\) => handleRowClick\(row as StatementRow\)\}/);
		assert.match(
			parent,
			/onCheckClick=\{\(e, row\) => handleCheckClick\(e, row as StatementRow\)\}/
		);
		assert.match(parent, /isOccurrenceView=\{isOccurrenceView\}/);
		assert.match(parent, /loading=\{loading\}/);
		assert.match(parent, /filteredRows=\{filteredRows\}/);
		assert.match(parent, /statementRowsLength=\{statementRows\.length\}/);
		assert.match(parent, /filteredPnumsLength=\{filteredPnums\.length\}/);
		assert.match(parent, /allFilteredChecked=\{allFilteredChecked\}/);
		assert.match(parent, /someFilteredChecked=\{someFilteredChecked\}/);
		assert.match(parent, /selectedPnum=\{selectedPnum\}/);
		assert.match(parent, /checkedPnums=\{checkedPnums\}/);
		assert.match(hook, /const handleRowClick =/);
		assert.match(hook, /const handleCheckClick =/);
		assert.match(hook, /const toggleSelectAllFiltered =/);
	});

	it('체크박스: someFilteredChecked 시 ref에서 indeterminate 설정 (소스 동등)', () => {
		const src = fs.readFileSync(GRID_TSX, 'utf8');
		assert.match(
			src,
			/ref=\{\(el\) => \{\s*if \(el\) el\.indeterminate = someFilteredChecked;\s*\}\}/
		);
		assert.match(src, /checked=\{allFilteredChecked\}/);
		assert.match(src, /disabled=\{filteredPnumsLength === 0\}/);
	});
});

describe('분리 전후 props 매핑 (문서화 검증)', () => {
	it('분리 전 인라인 식별자 ↔ 분리 후 props 대응표', () => {
		const mapping = {
			isOccurrenceView: 'isOccurrenceView',
			loading: 'loading',
			filteredRows: 'filteredRows',
			'statementRows.length': 'statementRowsLength',
			'filteredPnums.length': 'filteredPnumsLength',
			allFilteredChecked: 'allFilteredChecked',
			someFilteredChecked: 'someFilteredChecked',
			selectedPnum: 'selectedPnum',
			checkedPnums: 'checkedPnums',
			toggleSelectAllFiltered: 'onToggleSelectAllFiltered',
			handleRowClick: 'onRowClick → handleRowClick',
			handleCheckClick: 'onCheckClick → handleCheckClick',
		};
		assert.equal(Object.keys(mapping).length, 12);
		const parent = fs.readFileSync(PARENT_TSX, 'utf8');
		for (const prop of [
			'isOccurrenceView',
			'loading',
			'filteredRows',
			'statementRowsLength',
			'filteredPnumsLength',
			'allFilteredChecked',
			'someFilteredChecked',
			'selectedPnum',
			'checkedPnums',
			'onToggleSelectAllFiltered',
			'onRowClick',
			'onCheckClick',
		]) {
			assert.match(parent, new RegExp(prop));
		}
	});
});

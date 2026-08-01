/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoFilter.test.js)
 *
 * @description
 * 요양원 수급자정보 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/member-info
 *
 * @module component/nursing-home/pages/member-info/MemberInfoFilter.test
 */
/**
 * MemberInfoFilter — 렌더링·이벤트 전달 최소 검증
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const FILTER_TSX = path.join(DIR, 'MemberInfoFilter.tsx');
const LIST_TSX = path.join(DIR, 'MemberInfoList.tsx');

const tempFiles = [];

function transpile(filePath) {
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
	return outputText;
}

function compile(filePath, replacements = {}) {
	let js = transpile(filePath);
	for (const [spec, target] of Object.entries(replacements)) {
		js = js.split(`require("${spec}")`).join(`require(${JSON.stringify(target)})`);
		js = js.split(`require('${spec}')`).join(`require(${JSON.stringify(target)})`);
	}
	const out = path.join(DIR, `.${path.basename(filePath)}.${process.pid}.cjs`);
	fs.writeFileSync(out, js, 'utf8');
	tempFiles.push(out);
	return out;
}

function cleanup() {
	for (const f of tempFiles) {
		try {
			delete require.cache[require.resolve(f)];
		} catch {
			/* ignore */
		}
		try {
			fs.unlinkSync(f);
		} catch {
			/* ignore */
		}
	}
	tempFiles.length = 0;
}

function baseProps(overrides = {}) {
	return {
		selectedStatus: '입소',
		selectedGrade: '',
		selectedFloor: '',
		searchTerm: '',
		availableFloors: [1, 2, 3],
		loading: false,
		noRoomValue: '__NO_ROOM__',
		onStatusChange: () => {},
		onGradeChange: () => {},
		onFloorChange: () => {},
		onSearchTermChange: () => {},
		onSearch: () => {},
		...overrides,
	};
}

describe('MemberInfoFilter — presentational', () => {
	let Filter;

	before(() => {
		const mod = require(compile(FILTER_TSX));
		Filter = mod.default || mod;
		assert.equal(typeof Filter, 'function');
	});

	after(cleanup);

	it('현황·등급·층수·이름 검색 렌더', () => {
		const html = renderToStaticMarkup(React.createElement(Filter, baseProps()));
		assert.match(html, /현황/);
		assert.match(html, /등급 전체/);
		assert.match(html, /층수 전체/);
		assert.match(html, /이름 검색/);
		assert.match(html, /placeholder="예\) 홍길동"/);
		assert.match(html, />검색</);
	});

	it('availableFloors·방번호 없음 옵션 렌더', () => {
		const html = renderToStaticMarkup(React.createElement(Filter, baseProps()));
		assert.match(html, /value="__NO_ROOM__"/);
		assert.match(html, /1층/);
		assert.match(html, /2층/);
		assert.match(html, /3층/);
	});

	it('loading 시 검색 버튼 문구 변경', () => {
		const html = renderToStaticMarkup(React.createElement(Filter, baseProps({ loading: true })));
		assert.match(html, /검색 중\.\.\./);
	});

	it('이벤트 props 배선 (소스)', () => {
		const src = fs.readFileSync(FILTER_TSX, 'utf8');
		assert.match(src, /onChange=\{\(e\) => onStatusChange\(e\.target\.value\)\}/);
		assert.match(src, /onChange=\{\(e\) => onGradeChange\(e\.target\.value\)\}/);
		assert.match(src, /onChange=\{\(e\) => onFloorChange\(e\.target\.value\)\}/);
		assert.match(src, /onChange=\{\(e\) => onSearchTermChange\(e\.target\.value\)\}/);
		assert.match(src, /onClick=\{onSearch\}/);
		assert.match(src, /if \(e\.key === 'Enter'\)/);
	});

	it('presentational — fetch/useState 없음', () => {
		const src = fs.readFileSync(FILTER_TSX, 'utf8');
		assert.doesNotMatch(src, /useState/);
		assert.doesNotMatch(src, /fetch\(/);
	});

	it('List가 Filter를 조합함', () => {
		const list = fs.readFileSync(LIST_TSX, 'utf8');
		assert.match(list, /import MemberInfoFilter from '\.\/MemberInfoFilter'/);
		assert.match(list, /<MemberInfoFilter/);
		assert.match(list, /noRoomValue=\{noRoomValue\}/);
		assert.match(list, /onSearch=\{onSearch\}/);
	});
});

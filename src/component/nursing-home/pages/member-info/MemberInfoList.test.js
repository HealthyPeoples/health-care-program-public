/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoList.test.js)
 *
 * @description
 * 요양원 수급자정보 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/member-info
 *
 * @module component/nursing-home/pages/member-info/MemberInfoList.test
 */
/**
 * MemberInfoList — 목록 렌더링·페이지네이션·조합 최소 검증
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const LIST_TSX = path.join(DIR, 'MemberInfoList.tsx');
const FILTER_TSX = path.join(DIR, 'MemberInfoFilter.tsx');
const VIEW_TSX = path.join(DIR, 'MemberInfoView.tsx');
const CARE_TS = path.join(DIR, '../../utils/careGrade.ts');
const ROOM_TS = path.join(DIR, '../../utils/roomNoFloor.ts');

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

const MEMBERS = [
	{ ANCD: '190000', PNUM: '1', P_NM: '홍길동', P_GRD: '3', P_ST: '1', ROOM_NO: '203' },
	{ ANCD: '190000', PNUM: '2', P_NM: '김철수', P_GRD: '', P_ST: '9', ROOM_NO: '0' },
];

function baseProps(overrides = {}) {
	return {
		currentMembers: MEMBERS,
		filteredCount: MEMBERS.length,
		selectedMember: null,
		loading: false,
		error: null,
		currentPage: 1,
		totalPages: 1,
		selectedStatus: '입소',
		selectedGrade: '',
		selectedFloor: '',
		searchTerm: '',
		availableFloors: [2],
		noRoomValue: '__NO_ROOM__',
		onStatusChange: () => {},
		onGradeChange: () => {},
		onFloorChange: () => {},
		onSearchTermChange: () => {},
		onSearch: () => {},
		onMemberSelect: () => {},
		onPageChange: () => {},
		onCreateClick: () => {},
		onPrintAllMembers: () => {},
		...overrides,
	};
}

describe('MemberInfoList — presentational', () => {
	let List;

	before(() => {
		const careOut = compile(CARE_TS);
		const roomOut = compile(ROOM_TS);
		const filterOut = compile(FILTER_TSX);
		const mod = require(
			compile(LIST_TSX, {
				'./MemberInfoFilter': filterOut,
				'../../utils/careGrade': careOut,
				'../../utils/roomNoFloor': roomOut,
			})
		);
		List = mod.default || mod;
		assert.equal(typeof List, 'function');
	});

	after(cleanup);

	it('제목·전체출력·필터·생성 버튼 렌더', () => {
		const html = renderToStaticMarkup(React.createElement(List, baseProps()));
		assert.match(html, /수급자 목록/);
		assert.match(html, /수급자 전체 출력/);
		assert.match(html, /이름 검색/);
		assert.match(html, /수급자 생성/);
	});

	it('행 렌더 — 등급 라벨·상태·방번호', () => {
		const html = renderToStaticMarkup(React.createElement(List, baseProps()));
		assert.match(html, /홍길동/);
		assert.match(html, /3등급/);
		assert.match(html, /김철수/);
		assert.match(html, /등급 없음/);
		assert.match(html, /입소/);
		assert.match(html, /퇴소/);
		assert.match(html, />203</);
		// ROOM_NO '0'은 방번호 없음 처리
		assert.match(html, />없음</);
	});

	it('로딩·에러·빈 목록 분기', () => {
		const loadingHtml = renderToStaticMarkup(
			React.createElement(List, baseProps({ loading: true }))
		);
		assert.match(loadingHtml, /로딩 중\.\.\./);

		const errorHtml = renderToStaticMarkup(
			React.createElement(List, baseProps({ error: '조회 실패' }))
		);
		assert.match(errorHtml, /조회 실패/);

		const emptyHtml = renderToStaticMarkup(
			React.createElement(List, baseProps({ currentMembers: [], filteredCount: 0 }))
		);
		assert.match(emptyHtml, /수급자 데이터가 없습니다/);
	});

	it('totalPages > 1 일 때만 페이지네이션 렌더', () => {
		const single = renderToStaticMarkup(React.createElement(List, baseProps()));
		assert.doesNotMatch(single, /&lt;&lt;/);

		const paged = renderToStaticMarkup(
			React.createElement(List, baseProps({ totalPages: 3, currentPage: 2 }))
		);
		assert.match(paged, /&lt;&lt;/);
		assert.match(paged, /&gt;&gt;/);
	});

	it('선택 행 하이라이트', () => {
		const html = renderToStaticMarkup(
			React.createElement(List, baseProps({ selectedMember: MEMBERS[0] }))
		);
		assert.match(html, /bg-blue-100 cursor-pointer|cursor-pointer bg-blue-100/);
	});

	it('presentational — fetch/useState 없음', () => {
		const src = fs.readFileSync(LIST_TSX, 'utf8');
		assert.doesNotMatch(src, /useState/);
		assert.doesNotMatch(src, /fetch\(/);
	});

	it('View가 List를 조합함', () => {
		const view = fs.readFileSync(VIEW_TSX, 'utf8');
		assert.match(view, /import MemberInfoList from '\.\/MemberInfoList'/);
		assert.match(view, /<MemberInfoList/);
		assert.match(view, /onMemberSelect=\{handleMemberSelect\}/);
		assert.match(view, /onCreateClick=\{handleCreateClick\}/);
	});
});

/**
 * @file 수급자정보 — 화면 컴포넌트 (MemberInfoContractCard.test.js)
 *
 * @description
 * 요양원 수급자정보 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/member-info
 *
 * @module component/nursing-home/pages/member-info/MemberInfoContractCard.test
 */
/**
 * MemberInfoContractCard — 조회/수정/스켈레톤 렌더 최소 검증
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const CARD_TSX = path.join(DIR, 'MemberInfoContractCard.tsx');
const VIEW_TSX = path.join(DIR, 'MemberInfoView.tsx');

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

function compile(filePath) {
	const out = path.join(DIR, `.${path.basename(filePath)}.${process.pid}.cjs`);
	fs.writeFileSync(out, transpile(filePath), 'utf8');
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

describe('MemberInfoContractCard — presentational', () => {
	let Card;

	before(() => {
		const mod = require(compile(CARD_TSX));
		Card = mod.default || mod;
		assert.equal(typeof Card, 'function');
	});

	after(cleanup);

	it('조회 모드 — INSPER/USRPER 표시', () => {
		const html = renderToStaticMarkup(
			React.createElement(Card, {
				selectedMember: { INSPER: '80', USRPER: '20' },
			})
		);
		assert.match(html, /계약정보/);
		assert.match(html, /보험자부담율/);
		assert.match(html, /수급자부담율/);
		assert.match(html, /80/);
		assert.match(html, /20/);
		assert.doesNotMatch(html, /<input/);
	});

	it('조회 모드 — 값 없으면 - 표시', () => {
		const html = renderToStaticMarkup(React.createElement(Card, { selectedMember: {} }));
		assert.match(html, /-/);
		assert.match(html, /%/);
	});

	it('수정 모드 — input 렌더', () => {
		const html = renderToStaticMarkup(
			React.createElement(Card, {
				isEditing: true,
				selectedMember: { INSPER: '80', USRPER: '20' },
				editedMember: { INSPER: '85', USRPER: '15' },
				onFieldChange: () => {},
			})
		);
		assert.match(html, /<input/);
		assert.match(html, /value="85"/);
		assert.match(html, /value="15"/);
		assert.match(html, /placeholder="숫자만 입력"/);
	});

	it('placeholder 모드 — 스켈레톤', () => {
		const html = renderToStaticMarkup(React.createElement(Card, { placeholder: true }));
		assert.match(html, /계약정보/);
		assert.match(html, /min-h-\[180px\]/);
		assert.match(html, /opacity-50/);
		assert.doesNotMatch(html, /보험자부담율/);
	});

	it('주석 처리된 비급여 블록 유지', () => {
		const src = fs.readFileSync(CARD_TSX, 'utf8');
		assert.match(src, /비급여 식대 1회/);
		assert.match(src, /비급여 간식비 1회/);
		assert.match(src, /상급 병실료/);
		assert.match(src, /계약상세/);
	});

	it('presentational — fetch/useState 없음', () => {
		const src = fs.readFileSync(CARD_TSX, 'utf8');
		assert.doesNotMatch(src, /useState/);
		assert.doesNotMatch(src, /fetch\(/);
	});

	it('View가 카드와 placeholder를 모두 사용', () => {
		const view = fs.readFileSync(VIEW_TSX, 'utf8');
		assert.match(view, /import MemberInfoContractCard from '\.\/MemberInfoContractCard'/);
		assert.match(view, /!isEditing && \(/);
		assert.match(view, /<MemberInfoContractCard selectedMember=\{selectedMember\} \/>/);
		assert.match(view, /<MemberInfoContractCard placeholder \/>/);
	});
});

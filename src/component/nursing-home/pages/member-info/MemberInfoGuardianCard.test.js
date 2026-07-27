/**
 * MemberInfoGuardianCard — 관계 표시·수정 모드·스켈레톤 최소 검증
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const CARD_TSX = path.join(DIR, 'MemberInfoGuardianCard.tsx');
const UTILS_TS = path.join(DIR, 'MemberInfoUtils.ts');
const VIEW_TSX = path.join(DIR, 'MemberInfoView.tsx');
const CARE_TS = path.join(DIR, '../../utils/careGrade.ts');

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

describe('MemberInfoGuardianCard — presentational', () => {
	let Card;

	before(() => {
		const careOut = compile(CARE_TS);
		const utilsOut = compile(UTILS_TS, { '../../utils/careGrade': careOut });
		const mod = require(compile(CARD_TSX, { './MemberInfoUtils': utilsOut }));
		Card = mod.default || mod;
		assert.equal(typeof Card, 'function');
	});

	after(cleanup);

	it('조회 모드 — 성명·관계·연락처·주소·기타', () => {
		const html = renderToStaticMarkup(
			React.createElement(Card, {
				selectedMember: {
					BHNM: '김보호',
					BHREL: '20',
					GUARDIAN_P_HP: '010-1234-5678',
					GUARDIAN_P_ADDR: '서울시 강남구',
					P_EMAIL: '기타내용',
				},
			})
		);
		assert.match(html, /보호자 정보/);
		assert.match(html, /김보호/);
		assert.match(html, /아들/);
		assert.match(html, /010-1234-5678/);
		assert.match(html, /서울시 강남구/);
		assert.match(html, /기타내용/);
		assert.doesNotMatch(html, /<input/);
	});

	it('조회 모드 — BHREL 없으면 GUARDIAN_P_TEL 폴백', () => {
		const html = renderToStaticMarkup(
			React.createElement(Card, {
				selectedMember: { BHREL: '', GUARDIAN_P_TEL: '02-000-0000' },
			})
		);
		assert.match(html, /02-000-0000/);
	});

	it('수정 모드 — input 렌더', () => {
		const html = renderToStaticMarkup(
			React.createElement(Card, {
				isEditing: true,
				selectedMember: { BHNM: '김보호' },
				editedMember: { BHNM: '김보호', BHREL: '20', GUARDIAN_P_HP: '010-0000-0000' },
				onFieldChange: () => {},
			})
		);
		assert.match(html, /<input/);
		assert.match(html, /value="김보호"/);
		assert.match(html, /value="20"/);
		assert.doesNotMatch(html, /아들/);
	});

	it('placeholder 모드 — 스켈레톤', () => {
		const html = renderToStaticMarkup(React.createElement(Card, { placeholder: true }));
		assert.match(html, /보호자 정보/);
		assert.match(html, /min-h-\[180px\]/);
		assert.match(html, /opacity-50/);
		assert.doesNotMatch(html, /성명/);
	});

	it('Utils의 formatGuardianRelation을 사용하고 자체 삼항 중첩을 두지 않음', () => {
		const src = fs.readFileSync(CARD_TSX, 'utf8');
		assert.match(src, /import \{ formatGuardianRelation, type MemberData \} from '\.\/MemberInfoUtils'/);
		assert.match(src, /\{formatGuardianRelation\(selectedMember\)\}/);
		assert.doesNotMatch(src, /'며느리'/);
		assert.doesNotMatch(src, /useState/);
		assert.doesNotMatch(src, /fetch\(/);
	});

	it('View가 카드와 placeholder를 모두 사용', () => {
		const view = fs.readFileSync(VIEW_TSX, 'utf8');
		assert.match(view, /import MemberInfoGuardianCard from '\.\/MemberInfoGuardianCard'/);
		assert.match(view, /<MemberInfoGuardianCard\s*\n\s*isEditing=\{isEditing\}/);
		assert.match(view, /<MemberInfoGuardianCard placeholder \/>/);
	});
});

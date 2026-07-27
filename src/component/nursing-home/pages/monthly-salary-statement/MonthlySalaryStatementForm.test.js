/**
 * MonthlySalaryStatementForm — 렌더링·이벤트 전달 최소 검증
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const DIR = __dirname;
const FORM_TSX = path.join(DIR, 'MonthlySalaryStatementForm.tsx');
const PARENT_TSX = path.join(DIR, 'MonthlySalaryStatement.tsx');

function loadForm() {
	const source = fs.readFileSync(FORM_TSX, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		fileName: 'MonthlySalaryStatementForm.tsx',
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.React,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
			allowSyntheticDefaultImports: true,
		},
	});
	const outFile = path.join(DIR, `.MonthlySalaryStatementForm.compiled.${process.pid}.cjs`);
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
		selectedPnum: '100',
		formData: {
			recipient: '홍길동',
			birthday: '1950-01-01',
			deliverer: '너싱홈 해원',
			deliveryMethod: '2',
			recipientName: '보호자',
			receiveContent: '급여비용명세서',
		},
		formEditMode: false,
		onDeliveryMethodChange: () => {},
		onRecipientNameChange: () => {},
		onReceiveContentChange: () => {},
		onSave: () => {},
		onCancelEdit: () => {},
		onEnterEdit: () => {},
		onDelete: () => {},
		...overrides,
	};
}

describe('MonthlySalaryStatementForm — presentational', () => {
	let Form;

	before(() => {
		Form = loadForm();
		assert.equal(typeof Form, 'function');
	});

	it('미선택 시 안내 오버레이', () => {
		const html = renderToStaticMarkup(
			React.createElement(Form, baseProps({ selectedPnum: null }))
		);
		assert.match(html, /수급자를 선택해주세요/);
	});

	it('선택 시 폼 필드 값 렌더', () => {
		const html = renderToStaticMarkup(React.createElement(Form, baseProps()));
		assert.match(html, /홍길동/);
		assert.match(html, /1950-01-01/);
		assert.match(html, /너싱홈 해원/);
		assert.match(html, /보호자/);
		assert.match(html, /급여비용명세서/);
		assert.match(html, /우편발송/);
	});

	it('수정 모드: 저장·취소 / 조회 모드: 수정·삭제', () => {
		const view = renderToStaticMarkup(React.createElement(Form, baseProps({ formEditMode: false })));
		assert.match(view, />수정</);
		assert.match(view, />삭제</);
		assert.doesNotMatch(view, />저장</);

		const edit = renderToStaticMarkup(React.createElement(Form, baseProps({ formEditMode: true })));
		assert.match(edit, />저장</);
		assert.match(edit, />취소</);
		assert.doesNotMatch(edit, />수정</);
	});

	it('이벤트 props 배선 (소스)', () => {
		const src = fs.readFileSync(FORM_TSX, 'utf8');
		assert.match(src, /onChange=\{\(e\) => onDeliveryMethodChange\(e\.target\.value\)\}/);
		assert.match(src, /onChange=\{\(e\) => onRecipientNameChange\(e\.target\.value\)\}/);
		assert.match(src, /onChange=\{\(e\) => onReceiveContentChange\(e\.target\.value\)\}/);
		assert.match(src, /onClick=\{onSave\}/);
		assert.match(src, /onClick=\{onCancelEdit\}/);
		assert.match(src, /onClick=\{onEnterEdit\}/);
		assert.match(src, /onClick=\{onDelete\}/);
	});

	it('부모 배선 유지', () => {
		const parent = fs.readFileSync(PARENT_TSX, 'utf8');
		const hook = fs.readFileSync(path.join(DIR, 'useMonthlySalaryStatement.ts'), 'utf8');
		assert.match(parent, /<MonthlySalaryStatementForm/);
		assert.match(parent, /onSave=\{\(\) => void handleSave\(\)\}/);
		assert.match(parent, /onCancelEdit=\{discardEditAndLeave\}/);
		assert.match(parent, /onEnterEdit=\{handleEnterEdit\}/);
		assert.match(parent, /onDelete=\{\(\) => void handleDelete\(\)\}/);
		assert.match(parent, /useMonthlySalaryStatement\(\)/);
		assert.match(hook, /const handleSave =/);
		assert.match(hook, /const handleEnterEdit =/);
		assert.match(hook, /const handleDelete =/);
	});
});

/**
 * useMonthlySalaryStatement — 훅 export·부모 연결·핵심 핸들러 존재 최소 검증
 * (비즈니스 로직/fetch 실행 테스트 아님)
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const HOOK_TS = path.join(DIR, "useMonthlySalaryStatement.ts");
const PARENT_TSX = path.join(DIR, "MonthlySalaryStatement.tsx");

describe("useMonthlySalaryStatement — wiring", () => {
	it("훅 export·핵심 state/handler 존재", () => {
		const hook = fs.readFileSync(HOOK_TS, "utf8");
		assert.match(hook, /export function useMonthlySalaryStatement\(/);
		assert.match(hook, /export \{ TABS, TAB_TITLES \}/);
		assert.match(hook, /from "\.\/MonthlySalaryStatementUtils"/);
		assert.match(hook, /useState\(\(\) => getPreviousYearMonthInput\(\)\)/);
		assert.match(hook, /const handleSearch = useCallback/);
		assert.match(hook, /useEffect\(\(\) => \{\s*void handleSearch\(\);\s*\}, \[handleSearch\]\)/);
		assert.match(hook, /const printOccurrence = useCallback/);
		assert.match(hook, /const handleSave =/);
		assert.match(hook, /const handleDelete =/);
		assert.match(hook, /fetch\("\/api\/f40100"/);
		assert.match(hook, /\/api\/f10010/);
		assert.match(hook, /\/api\/f00110/);
	});

	it("부모는 훅만 사용하고 state를 직접 두지 않음", () => {
		const parent = fs.readFileSync(PARENT_TSX, "utf8");
		assert.match(parent, /useMonthlySalaryStatement\(\)/);
		assert.match(parent, /from "\.\/useMonthlySalaryStatement"/);
		assert.doesNotMatch(parent, /useState\(/);
		assert.doesNotMatch(parent, /useEffect\(/);
		assert.doesNotMatch(parent, /useCallback\(/);
		assert.match(parent, /<MonthlySalaryStatementToolbar/);
		assert.match(parent, /<MonthlySalaryStatementGrid/);
		assert.match(parent, /<MonthlySalaryStatementForm/);
	});
});

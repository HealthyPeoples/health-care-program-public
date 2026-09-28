/**
 * @file 요양원 유틸 — roomNoFloor.test.js
 *
 * @description
 * 요양원 도메인 공통 유틸리티입니다.
 *
 * @module component/nursing-home/utils/roomNoFloor.test
 */
/**
 * roomNoFloor — 층수 추출·옵션 구성 최소 검증
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DIR = path.join(__dirname);
const SRC = path.join(DIR, 'roomNoFloor.ts');

function loadUtil() {
	const source = fs.readFileSync(SRC, 'utf8');
	const { outputText } = ts.transpileModule(source, {
		fileName: 'roomNoFloor.ts',
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2019,
			esModuleInterop: true,
		},
	});
	const outFile = path.join(DIR, `.roomNoFloor.compiled.${process.pid}.cjs`);
	fs.writeFileSync(outFile, outputText, 'utf8');
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

describe('roomNoFloor', () => {
	const {
		normalizeRoomNo,
		normalizePnumKey,
		extractFloorFromRoomNo,
		extractFloorFromPFloor,
		extractMemberFloor,
		availableFloorsFromMembers,
		matchesFloorButton,
	} = loadUtil();

	it('ROOM_NO 0·빈값·100미만은 층 인코딩으로 보지 않음', () => {
		assert.equal(normalizeRoomNo('0'), '');
		assert.equal(normalizeRoomNo(''), '');
		assert.equal(extractFloorFromRoomNo('0'), null);
		assert.equal(extractFloorFromRoomNo('50'), null);
		assert.equal(extractFloorFromRoomNo('104'), 1);
		assert.equal(extractFloorFromRoomNo('1203'), 12);
	});

	it('P_FLOOR 폴백으로 1·2·3층 옵션 구성', () => {
		assert.equal(extractFloorFromPFloor('2'), 2);
		assert.equal(
			extractMemberFloor({ ROOM_NO: '0', P_FLOOR: 2 }),
			2
		);
		assert.equal(
			extractMemberFloor({ ROOM_NO: '201', P_FLOOR: 9 }),
			2
		);
		const floors = availableFloorsFromMembers([
			{ ROOM_NO: '0', P_FLOOR: 1 },
			{ ROOM_NO: '', P_FLOOR: 3 },
			{ ROOM_NO: '0', P_FLOOR: 2 },
			{ ROOM_NO: null, P_FLOOR: null },
		]);
		assert.deepEqual(floors, [1, 2, 3]);
	});

	it('방번호가 4층 이상이어도 P_FLOOR 1·2·3층 버튼이 생긴다', () => {
		const floors = availableFloorsFromMembers([
			{ ROOM_NO: '12', P_FLOOR: 1 },
			{ ROOM_NO: '', P_FLOOR: 2 },
			{ ROOM_NO: '0', P_FLOOR: 3 },
			{ ROOM_NO: '401', P_FLOOR: null },
		]);
		assert.deepEqual(floors, [1, 2, 3, 4]);
		assert.equal(matchesFloorButton({ ROOM_NO: '12', P_FLOOR: 1 }, '1층'), true);
		assert.equal(matchesFloorButton({ ROOM_NO: '401', P_FLOOR: 1 }, '1층'), false);
		assert.equal(matchesFloorButton({ ROOM_NO: '401', P_FLOOR: 1 }, '4층'), true);
	});

	it('PNUM 키 정규화', () => {
		assert.equal(normalizePnumKey('001'), '1');
		assert.equal(normalizePnumKey(1), '1');
		assert.equal(normalizePnumKey('10'), '10');
	});
});

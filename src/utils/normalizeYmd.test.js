/**
 * @file 공통 유틸 — normalizeYmd.test.js
 *
 * @description
 * 날짜·응답·포맷 등 프로젝트 공통 유틸리티입니다.
 *
 * @module utils/normalizeYmd.test
 */
/**
 * normalizeYmd 공용 유틸 단위 테스트
 * 실행: npm test  또는  node --test src/utils/normalizeYmd.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const shared = require('./normalizeYmd');
const legacy = require('./__fixtures__/normalizeYmd.legacy');

const PAIRS = [
  ['normalizeYmd', 'legacyNormalizeYmd'],
  ['normalizeYmdEmpty', 'legacyNormalizeYmdEmpty'],
  ['normalizeYmdOrNull', 'legacyNormalizeYmdOrNull'],
  ['normalizeYmdEmptyParse', 'legacyNormalizeYmdEmptyParse'],
  ['normalizeYmdEmptyYmd8', 'legacyNormalizeYmdEmptyYmd8'],
  ['normalizeYmdShort', 'legacyNormalizeYmdShort'],
  ['normalizeYmdStrict', 'legacyNormalizeYmdStrict'],
  ['normalizeYmdEmptyRaw', 'legacyNormalizeYmdEmptyRaw'],
  ['normalizeYmdOrNullLoose', 'legacyNormalizeYmdOrNullLoose'],
  ['normalizeYmdStrictPrefix', 'legacyNormalizeYmdStrictPrefix'],
  ['normalizeYmdEmptyTz', 'legacyNormalizeYmdEmptyTz'],
];

/** API에서 실제로 등장하는 / 등장 가능한 입력 형태 전체 */
function buildApiInputCorpus() {
  return [
    // null / undefined / empty
    null,
    undefined,
    '',
    '   ',

    // yyyy-MM-dd
    '2024-01-02',
    '2024-12-31',
    '1999-01-01',

    // yyyyMMdd
    '20240102',
    '20241231',
    '19990101',

    // ISO / SQL datetime 문자열
    '2024-01-02T00:00:00',
    '2024-01-02T15:00:00',
    '2024-01-02T15:00:00.000Z',
    '2024-01-02T15:30:45.123',
    '2024-01-02 00:00:00',

    // prefix / 부가 문자
    '2024-01-02 extra',
    '2024-01-02T',

    // Date 객체 (로컬)
    new Date(2024, 0, 2),
    new Date(2024, 0, 2, 15, 30, 0),
    new Date(2024, 11, 31, 23, 59, 59),

    // Invalid Date
    new Date(Number.NaN),

    // 잘못된 문자열
    'not-a-date',
    'x',
    'abcd',
    '2024/01/02',
    '01-02-2024',
    '2024-13-40',
    '20241340',
    '2024-1-2',

    // 숫자형 (API body/params 캐스팅 가능)
    0,
    1,
    20240102,
    2024,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,

    // boolean (short 변형의 !v 경로)
    false,
    true,

    // 기타
    [],
    {},
    '0',
    'false',
  ];
}

function label(v) {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? 'Date(Invalid)' : `Date(${v.toISOString()})`;
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' && Number.isNaN(v)) return 'NaN';
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

describe('normalizeYmd exports', () => {
  it('모든 API 변형 export가 존재한다', () => {
    for (const [name] of PAIRS) {
      assert.equal(typeof shared[name], 'function', `missing export: ${name}`);
    }
  });
});

describe('필수 입력 형태 (각 변형)', () => {
  const requiredCases = [
    { name: 'yyyyMMdd', input: '20240102' },
    { name: 'yyyy-MM-dd', input: '2024-01-02' },
    { name: 'Date 객체', input: new Date(2024, 0, 2, 10, 0, 0) },
    { name: 'null', input: null },
    { name: 'undefined', input: undefined },
    { name: "''", input: '' },
    { name: '잘못된 날짜 문자열', input: 'not-a-date' },
    { name: '숫자형 입력', input: 20240102 },
  ];

  for (const [sharedName, legacyName] of PAIRS) {
    describe(sharedName, () => {
      for (const c of requiredCases) {
        it(`${c.name} — legacy와 동일`, () => {
          const expected = legacy[legacyName](c.input);
          const actual = shared[sharedName](c.input);
          assert.equal(
            actual,
            expected,
            `${sharedName}(${label(c.input)}) expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`
          );
        });
      }
    });
  }
});

describe('API에서 사용되는 모든 입력 형태 — legacy와 완전 동일', () => {
  const corpus = buildApiInputCorpus();

  for (const [sharedName, legacyName] of PAIRS) {
    it(`${sharedName} ↔ ${legacyName} (${corpus.length} inputs)`, () => {
      const mismatches = [];
      for (const input of corpus) {
        const expected = legacy[legacyName](input);
        const actual = shared[sharedName](input);
        if (!Object.is(actual, expected)) {
          mismatches.push({
            input: label(input),
            expected,
            actual,
          });
        }
      }
      assert.deepEqual(mismatches, [], `${sharedName} mismatches:\n${JSON.stringify(mismatches, null, 2)}`);
    });
  }
});

describe('대표 변형별 기대 동작 스냅샷', () => {
  it('normalizeYmd: null/빈문자 → null, yyyy-MM-dd 유지, T는 접두만', () => {
    assert.equal(shared.normalizeYmd(null), null);
    assert.equal(shared.normalizeYmd(''), null);
    assert.equal(shared.normalizeYmd('2024-01-02'), '2024-01-02');
    assert.equal(shared.normalizeYmd('2024-01-02T15:00:00'), '2024-01-02');
    assert.equal(shared.normalizeYmd('20240102'), '20240102'); // 이 변형은 ymd8 미변환
    assert.equal(shared.normalizeYmd(new Date(2024, 0, 2)), '2024-01-02');
  });

  it('normalizeYmdStrict: 허용 포맷만, 그 외 null', () => {
    assert.equal(shared.normalizeYmdStrict('2024-01-02'), '2024-01-02');
    assert.equal(shared.normalizeYmdStrict('20240102'), '2024-01-02');
    assert.equal(shared.normalizeYmdStrict('2024-01-02T15:00:00'), null);
    assert.equal(shared.normalizeYmdStrict(new Date(2024, 0, 2)), null);
    assert.equal(shared.normalizeYmdStrict('not-a-date'), null);
    assert.equal(shared.normalizeYmdStrict(null), null);
  });

  it('normalizeYmdShort: falsy → "", ymd8 변환, Date는 falsy 아님이나 String 경로', () => {
    assert.equal(shared.normalizeYmdShort(null), '');
    assert.equal(shared.normalizeYmdShort(undefined), '');
    assert.equal(shared.normalizeYmdShort(''), '');
    assert.equal(shared.normalizeYmdShort(0), '');
    assert.equal(shared.normalizeYmdShort(false), '');
    assert.equal(shared.normalizeYmdShort('20240102'), '2024-01-02');
    assert.equal(shared.normalizeYmdShort('2024-01-02T15:00:00'), '2024-01-02');
  });

  it('normalizeYmdEmptyYmd8: yyyyMMdd → yyyy-MM-dd', () => {
    assert.equal(shared.normalizeYmdEmptyYmd8('20240102'), '2024-01-02');
    assert.equal(shared.normalizeYmdEmptyYmd8(null), '');
    assert.equal(shared.normalizeYmdEmptyYmd8('2024-01-02'), '2024-01-02');
  });

  it('normalizeYmdStrictPrefix: exact/ymd8/prefix 허용', () => {
    assert.equal(shared.normalizeYmdStrictPrefix('2024-01-02'), '2024-01-02');
    assert.equal(shared.normalizeYmdStrictPrefix('20240102'), '2024-01-02');
    assert.equal(shared.normalizeYmdStrictPrefix('2024-01-02 extra'), '2024-01-02');
    assert.equal(shared.normalizeYmdStrictPrefix('not-a-date'), null);
  });
});

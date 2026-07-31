/**
 * @file 공통 유틸 — apiResponse.test.js
 *
 * @description
 * 날짜·응답·포맷 등 프로젝트 공통 유틸리티입니다.
 *
 * @module utils/apiResponse.test
 */
/**
 * apiResponse (jsonOk / jsonError) 단위 테스트
 * 실행: npm test  또는  node --test src/utils/apiResponse.test.js
 *
 * 검증 목표: 기존
 *   new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ... } })
 * 와 status / headers / body 텍스트가 100% 동일할 것.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { jsonOk, jsonError } = require('./apiResponse');

/** 공통화 이전 API Route에서 쓰이던 Response 생성 패턴 */
function legacyJsonResponse(body, status, extraHeaders) {
  const headers = { 'Content-Type': 'application/json' };
  if (extraHeaders && typeof extraHeaders === 'object') {
    Object.assign(headers, extraHeaders);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function assertSameResponse(actual, expected, label) {
  assert.equal(actual.status, expected.status, `${label}: status`);
  assert.equal(
    actual.headers.get('Content-Type'),
    expected.headers.get('Content-Type'),
    `${label}: Content-Type`
  );
  assert.equal(
    actual.headers.get('Cache-Control'),
    expected.headers.get('Cache-Control'),
    `${label}: Cache-Control`
  );
  const aText = await actual.text();
  const eText = await expected.text();
  assert.equal(aText, eText, `${label}: body text`);
  assert.deepEqual(JSON.parse(aText), JSON.parse(eText), `${label}: body json`);
}

/** API에서 실제로 쓰는 body 형태 샘플 */
function apiBodyCorpus() {
  return [
    { success: true },
    { success: true, data: null },
    { success: true, data: [] },
    { success: true, data: { ANCD: 1, PNUM: '100' }, count: 1 },
    { success: true, data: ['2024-01-02', '2024-01-03'], count: 2 },
    { success: false, error: 'pnum이 필요합니다.' },
    { success: false, error: '데이터베이스 연결 실패' },
    { success: false, error: '서버 오류', details: 'Error: boom' },
    { success: false, message: '존재하지 않는 계정입니다.' },
    { authenticated: false },
    { authenticated: true, user: { ancd: 10, uid: 'user01' } },
    { authenticated: false, message: '세션이 만료되었습니다.' },
    { rows: [{ CODE: 'A', NAME: '한글' }] },
    { success: true, message: '로그인 성공했습니다', ipRestricted: false, user: { ancd: 1, uid: 'a' } },
    { ok: 1, nested: { a: null, b: undefined, c: 0, d: false, e: '' } },
  ];
}

describe('jsonOk', () => {
  it('기본 status는 200이다', async () => {
    const res = jsonOk({ success: true });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(await res.json(), { success: true });
  });

  it('명시 status를 그대로 사용한다', async () => {
    const res = jsonOk({ success: true }, 201);
    assert.equal(res.status, 201);
  });

  it('body를 래핑하지 않고 JSON.stringify 결과와 동일하다', async () => {
    const body = { success: true, data: { x: 1 }, count: 1 };
    const res = jsonOk(body);
    assert.equal(await res.text(), JSON.stringify(body));
  });

  it('legacy new Response(JSON.stringify) 와 동일하다 (기본)', async () => {
    for (const body of apiBodyCorpus()) {
      const modern = jsonOk(body);
      const legacy = legacyJsonResponse(body, 200);
      await assertSameResponse(modern, legacy, `jsonOk default ${JSON.stringify(body).slice(0, 40)}`);
    }
  });

  it('legacy 와 동일하다 (명시 status 200)', async () => {
    const body = { success: true, data: null };
    await assertSameResponse(jsonOk(body, 200), legacyJsonResponse(body, 200), 'status 200');
  });

  it('Cache-Control extraHeaders 를 legacy 와 동일하게 붙인다', async () => {
    const body = { success: true, data: ['2024-01-01'], count: 1 };
    const extra = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };
    const modern = jsonOk(body, 200, extra);
    const legacy = legacyJsonResponse(body, 200, extra);
    await assertSameResponse(modern, legacy, 'Cache-Control');
    assert.equal(modern.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate');
  });

  it('Content-Type 은 application/json 으로 고정된다 (extraHeaders로 덮어쓰지 않음)', async () => {
    const res = jsonOk({ ok: 1 }, 200, { 'Content-Type': 'text/plain' });
    assert.equal(res.headers.get('Content-Type'), 'application/json');
  });
});

describe('jsonError', () => {
  it('기본 status는 500이다', async () => {
    const res = jsonError({ success: false, error: 'x' });
    assert.equal(res.status, 500);
    assert.equal(res.headers.get('Content-Type'), 'application/json');
    assert.deepEqual(await res.json(), { success: false, error: 'x' });
  });

  it('API에서 쓰는 오류 status 를 모두 지원한다', async () => {
    const statuses = [400, 401, 403, 404, 409, 500];
    for (const status of statuses) {
      const body = { success: false, error: `status-${status}` };
      const modern = jsonError(body, status);
      const legacy = legacyJsonResponse(body, status);
      await assertSameResponse(modern, legacy, `jsonError ${status}`);
    }
  });

  it('body를 래핑하지 않는다', async () => {
    const body = { authenticated: false, message: '로그인이 필요합니다.' };
    const res = jsonError(body, 401);
    assert.equal(await res.text(), JSON.stringify(body));
  });

  it('한글·특수문자 body 가 legacy 와 바이트 동일하다', async () => {
    const body = {
      success: false,
      error: '연도(year) 또는 startDate+endDate 파라미터가 필요합니다',
      details: String(new Error('DB 연결 실패: timeout')),
    };
    await assertSameResponse(jsonError(body, 400), legacyJsonResponse(body, 400), 'korean');
  });

  it('extraHeaders(Cache-Control) 도 legacy 와 동일하다', async () => {
    const body = { success: false, error: 'e' };
    const extra = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };
    await assertSameResponse(
      jsonError(body, 500, extra),
      legacyJsonResponse(body, 500, extra),
      'error+cache'
    );
  });
});

describe('jsonOk / jsonError 공통 계약', () => {
  it('동일 body·status 이면 jsonOk 와 jsonError 응답이 같다 (함수명만 다른 헬퍼)', async () => {
    const body = { success: false, error: 'x' };
    await assertSameResponse(jsonOk(body, 400), jsonError(body, 400), 'same args');
  });

  it('undefined 필드는 JSON.stringify 규칙대로 생략된다', async () => {
    const body = { success: true, message: 'ok', error: undefined };
    const res = jsonOk(body);
    assert.equal(await res.text(), JSON.stringify(body));
    assert.deepEqual(JSON.parse(await jsonOk(body).text()), { success: true, message: 'ok' });
  });

  it('배열 body 도 그대로 직렬화한다', async () => {
    const body = [{ id: 1 }, { id: 2 }];
    await assertSameResponse(jsonOk(body), legacyJsonResponse(body, 200), 'array body');
  });

  it('null body 도 그대로 직렬화한다', async () => {
    await assertSameResponse(jsonOk(null), legacyJsonResponse(null, 200), 'null body');
  });

  it('Response 인스턴스를 반환한다', () => {
    assert.ok(jsonOk({}) instanceof Response);
    assert.ok(jsonError({}) instanceof Response);
  });
});

describe('실제 API 응답 패턴 스냅샷 동등성', () => {
  const cases = [
    ['ok-data', () => jsonOk({ success: true, data: { RQDT: '2024-01-02' } }), 200],
    ['ok-list', () => jsonOk({ success: true, data: [], count: 0 }), 200],
    [
      'ok-cache',
      () =>
        jsonOk({ success: true, data: ['2024-01-02'], count: 1 }, 200, {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        }),
      200,
    ],
    ['err-400', () => jsonError({ success: false, error: 'pnum이 필요합니다.' }, 400), 400],
    ['err-401', () => jsonError({ success: false, error: '로그인이 필요합니다.' }, 401), 401],
    ['err-403', () => jsonError({ success: false, error: '해당 기관에 대한 접근 권한이 없습니다.' }, 403), 403],
    ['err-500-default', () => jsonError({ success: false, error: '서버 오류', details: 'Error: x' }), 500],
    ['auth-false', () => jsonError({ authenticated: false }, 401), 401],
    ['auth-true', () => jsonOk({ authenticated: true, user: { ancd: 1, uid: 'u' } }), 200],
  ];

  for (const [name, factory, status] of cases) {
    it(`${name}: status=${status}, legacy 동등`, async () => {
      const modern = factory();
      assert.equal(modern.status, status);
      const text = await modern.clone().text();
      const body = JSON.parse(text);
      const extra = {};
      const cc = modern.headers.get('Cache-Control');
      if (cc) extra['Cache-Control'] = cc;
      const legacy = legacyJsonResponse(
        body,
        status,
        Object.keys(extra).length ? extra : undefined
      );
      // factory already consumed? use fresh
      const fresh = factory();
      await assertSameResponse(fresh, legacy, name);
    });
  }
});

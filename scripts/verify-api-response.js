/**
 * jsonOk/jsonError 가 기존 new Response(JSON.stringify) 패턴과
 * status / Content-Type / body JSON 이 동일한지 검증합니다.
 */
const assert = require('assert');
const { jsonOk, jsonError } = require('../src/utils/apiResponse');

function legacy(body, status, extra) {
  const headers = { 'Content-Type': 'application/json' };
  if (extra) Object.assign(headers, extra);
  return new Response(JSON.stringify(body), { status, headers });
}

async function compare(a, b, label) {
  assert.strictEqual(a.status, b.status, label + ' status');
  assert.strictEqual(
    a.headers.get('Content-Type'),
    b.headers.get('Content-Type'),
    label + ' Content-Type'
  );
  const ca = a.headers.get('Cache-Control');
  const cb = b.headers.get('Cache-Control');
  assert.strictEqual(ca, cb, label + ' Cache-Control');
  const ta = await a.text();
  const tb = await b.text();
  assert.strictEqual(ta, tb, label + ' body text');
  assert.deepStrictEqual(JSON.parse(ta), JSON.parse(tb), label + ' body json');
}

async function main() {
  const samples = [
    [{ success: true, data: null }, 200, null],
    [{ success: false, error: 'x' }, 400, null],
    [{ authenticated: false }, 401, null],
    [{ success: false, error: 'e', details: String(new Error('t')) }, 500, null],
    [{ success: true, data: ['a'], count: 1 }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' }],
    [{ rows: [{ A: 1, B: '한글' }] }, 200, null],
    [{ success: true, message: 'ok', user: { ancd: 1, uid: 'a' } }, 200, null],
  ];

  for (const [body, status, extra] of samples) {
    const fn = status >= 400 ? jsonError : jsonOk;
    const modern = extra ? fn(body, status, extra) : fn(body, status);
    const old = legacy(body, status, extra);
    await compare(modern, old, `status=${status}`);
  }

  // defaults
  const ok = jsonOk({ ok: 1 });
  assert.strictEqual(ok.status, 200);
  const err = jsonError({ ok: 0 });
  assert.strictEqual(err.status, 500);

  console.log('apiResponse equivalence: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

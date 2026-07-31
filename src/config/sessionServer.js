/**
 * @file API 라우트용 세션(ANCD/UGR) 게이트
 *
 * @description
 * `user_info` 쿠키(JSON)에서 기관코드(ANCD)·권한(UGR)을 읽어
 * 요청 파라미터 ANCD와 일치하는지 검사합니다.
 *
 * @remarks
 * - 쿠키 값에 서명/JWT 검증이 없습니다. `ancd` 필드만 신뢰합니다.
 * - 로그인 API의 Vercel/TESTMODE 분기·클라이언트 mock 쿠키와 결합되면
 *   위조 세션으로 쓰기 API를 호출할 수 있으므로 프로덕션에서는 별도 서명 세션이 필요합니다.
 *
 * @module sessionServer
 */

/**
 * user_info 쿠키 raw 문자열을 객체로 파싱합니다 (URL 디코드 최대 2회 시도).
 * @param {string|undefined|null} raw
 * @returns {object|null}
 */
function parseUserInfoCookieValue(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      try {
        return JSON.parse(decodeURIComponent(decodeURIComponent(raw)));
      } catch {
        return null;
      }
    }
  }
}

/**
 * 요청의 user_info 세션 객체를 반환합니다.
 * @param {{ cookies: { get: (name: string) => { value?: string } | undefined } }} req
 * @returns {object|null}
 */
function getSessionFromRequest(req) {
  const raw = req.cookies.get('user_info')?.value;
  return parseUserInfoCookieValue(raw);
}

/**
 * 세션 ANCD (숫자 가능하면 number, 아니면 string). 없으면 null.
 * @param {Parameters<typeof getSessionFromRequest>[0]} req
 * @returns {number|string|null}
 */
function getSessionAncd(req) {
  const u = getSessionFromRequest(req);
  if (!u || u.ancd == null || u.ancd === '') return null;
  const s = String(u.ancd).trim();
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? s : n;
}

function getSessionUgr(req) {
  const u = getSessionFromRequest(req);
  if (!u || u.ugr == null || u.ugr === '') return '';
  return String(u.ugr).trim();
}

function normalizeAncdForCompare(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? s : n;
}

function ancdEquals(a, b) {
  const x = normalizeAncdForCompare(a);
  const y = normalizeAncdForCompare(b);
  if (x == null || y == null) return false;
  return String(x) === String(y);
}

/**
 * 세션 사용자의 UGR 조회 (쿠키 우선, 없으면 F00120)
 */
async function fetchSessionUgr(req, pool) {
  const cookieUgr = getSessionUgr(req);
  if (cookieUgr) return cookieUgr;
  if (!pool) return '';
  const u = getSessionFromRequest(req);
  const ancd = getSessionAncd(req);
  if (!u?.uid || ancd == null) return '';
  try {
    const r = await pool
      .request()
      .input('ancd', ancd)
      .input('uid', String(u.uid).trim())
      .query(`
        SELECT TOP 1 RTRIM([UGR]) AS [UGR]
        FROM [돌봄시설DB].[dbo].[F00120]
        WHERE [ANCD] = @ancd AND [UID] = @uid
      `);
    return r.recordset?.[0]?.UGR != null ? String(r.recordset[0].UGR).trim() : '';
  } catch (e) {
    console.error('세션 UGR 조회 실패:', e);
    return '';
  }
}

/**
 * URL/바디의 ANCD가 세션과 일치하는지 검사. param이 없으면 세션 ANCD만 반환.
 * @returns {{ ok: true, sessionAncd: number|string, paramAncd: number|string|null } | { ok: false, response: Response }}
 */
function assertAnCdMatchesSession(req, paramAncd) {
  const sessionAncd = getSessionAncd(req);
  if (sessionAncd == null) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: '로그인이 필요합니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  if (paramAncd == null || paramAncd === '') {
    return { ok: true, sessionAncd, paramAncd: null };
  }
  if (!ancdEquals(paramAncd, sessionAncd)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: '해당 기관에 대한 접근 권한이 없습니다.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  return { ok: true, sessionAncd, paramAncd: normalizeAncdForCompare(paramAncd) };
}

/**
 * UGR=1(전체권한)이면 타 기관 ANCD 접근 허용, 그 외는 본인 기관만.
 * targetAncd = paramAncd || sessionAncd
 */
async function assertAnCdAccess(req, pool, paramAncd) {
  const sessionAncd = getSessionAncd(req);
  if (sessionAncd == null) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: '로그인이 필요합니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  const ugr = await fetchSessionUgr(req, pool);
  const isAdmin = ugr === '1';
  const hasParam = paramAncd != null && paramAncd !== '';
  const targetAncd = hasParam ? normalizeAncdForCompare(paramAncd) : sessionAncd;
  if (hasParam && !isAdmin && !ancdEquals(paramAncd, sessionAncd)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: '해당 기관에 대한 접근 권한이 없습니다.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  return {
    ok: true,
    sessionAncd,
    targetAncd,
    paramAncd: hasParam ? normalizeAncdForCompare(paramAncd) : null,
    ugr,
    isAdmin,
  };
}

module.exports = {
  parseUserInfoCookieValue,
  getSessionFromRequest,
  getSessionAncd,
  getSessionUgr,
  fetchSessionUgr,
  normalizeAncdForCompare,
  ancdEquals,
  assertAnCdMatchesSession,
  assertAnCdAccess,
};

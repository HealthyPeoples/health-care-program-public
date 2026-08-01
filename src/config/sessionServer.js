/**
 * @file API 라우트용 세션(ANCD/UGR) 게이트
 *
 * @description
 * `auth_token`(또는 호환 `user_info`)에 담긴 **서명된 JWT**를 검증한 뒤
 * 기관코드(ANCD)·권한(UGR)을 제공합니다. 서명되지 않은 JSON 쿠키는 거부합니다.
 *
 * @module sessionServer
 */

const { verifySession } = require('../lib/sessionJwt');

/**
 * 레거시 이름 유지: raw가 JWT이면 검증 후 payload 반환, 아니면 null.
 * 서명 없는 JSON은 더 이상 허용하지 않습니다.
 * @param {string|undefined|null} raw
 * @returns {object|null}
 */
function parseUserInfoCookieValue(raw) {
	return verifySession(raw);
}

/**
 * 요청에서 검증된 세션 객체를 반환합니다.
 * @param {{ cookies: { get: (name: string) => { value?: string } | undefined } }} req
 * @returns {{ ancd: any, uid: string, ugr: string, annm?: string }|null}
 */
function getSessionFromRequest(req) {
	const auth = req.cookies?.get?.('auth_token')?.value;
	const fromAuth = verifySession(auth);
	if (fromAuth) return fromAuth;
	const ui = req.cookies?.get?.('user_info')?.value;
	return verifySession(ui);
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
 * 세션 사용자의 UGR 조회.
 * 권한 상승 방지를 위해 pool이 있으면 DB를 우선하고, 실패 시에만 JWT ugr를 사용합니다.
 */
async function fetchSessionUgr(req, pool) {
	const u = getSessionFromRequest(req);
	const ancd = getSessionAncd(req);
	if (!u?.uid || ancd == null) return '';

	if (pool) {
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
			if (r.recordset?.[0]?.UGR != null) {
				return String(r.recordset[0].UGR).trim();
			}
		} catch (e) {
			console.error('세션 UGR 조회 실패:', e);
		}
	}

	return getSessionUgr(req);
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

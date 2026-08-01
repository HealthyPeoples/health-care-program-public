/**
 * @file 서명된 세션 JWT (HS256)
 *
 * @description
 * AUTH_SECRET으로 세션을 서명·검증합니다. 쿠키에 넣는 값은 JWT 문자열만 허용합니다.
 *
 * @module lib/sessionJwt
 */
const crypto = require('crypto');

/** 세션 수명(초) — 24시간 */
const SESSION_MAX_AGE_SEC = 24 * 60 * 60;

function getAuthSecret() {
	const s = process.env.AUTH_SECRET;
	if (s == null || String(s).trim() === '') return null;
	return String(s).trim();
}

function b64urlJson(obj) {
	return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function timingSafeEqualStr(a, b) {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	if (ba.length !== bb.length) return false;
	return crypto.timingSafeEqual(ba, bb);
}

/**
 * 세션 JWT 발급
 * @param {{ ancd: any, uid: string, ugr?: string, annm?: string }} payload
 * @param {number} [maxAgeSec]
 * @returns {string}
 */
function signSession(payload, maxAgeSec = SESSION_MAX_AGE_SEC) {
	const secret = getAuthSecret();
	if (!secret) {
		throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다.');
	}
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'HS256', typ: 'JWT' };
	const body = {
		ancd: payload.ancd,
		uid: String(payload.uid || '').trim(),
		ugr: payload.ugr != null ? String(payload.ugr).trim() : '',
		annm: payload.annm != null ? String(payload.annm) : '',
		iat: now,
		exp: now + maxAgeSec,
	};
	const data = `${b64urlJson(header)}.${b64urlJson(body)}`;
	const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
	return `${data}.${sig}`;
}

/**
 * JWT 검증. 실패 시 null.
 * @param {string|undefined|null} token
 * @returns {{ ancd: any, uid: string, ugr: string, annm: string, iat?: number, exp?: number }|null}
 */
function verifySession(token) {
	if (!token || typeof token !== 'string') return null;
	const secret = getAuthSecret();
	if (!secret) return null;

	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [h, p, s] = parts;
	const data = `${h}.${p}`;
	const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
	if (!timingSafeEqualStr(expected, s)) return null;

	try {
		const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
		if (!payload || typeof payload !== 'object') return null;
		if (payload.exp != null && Number(payload.exp) < Math.floor(Date.now() / 1000)) {
			return null;
		}
		if (payload.ancd == null || payload.ancd === '' || !payload.uid) return null;
		return {
			ancd: payload.ancd,
			uid: String(payload.uid).trim(),
			ugr: payload.ugr != null ? String(payload.ugr).trim() : '',
			annm: payload.annm != null ? String(payload.annm) : '',
			iat: payload.iat,
			exp: payload.exp,
		};
	} catch {
		return null;
	}
}

/**
 * httpOnly 세션 쿠키 옵션
 * @param {number} [maxAgeSec]
 */
function sessionCookieOptions(maxAgeSec = SESSION_MAX_AGE_SEC) {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: maxAgeSec,
		path: '/',
	};
}

/**
 * 응답에 auth_token(+호환용 user_info) JWT 쿠키 설정
 * @param {import('next/server').NextResponse} response
 * @param {string} token
 * @param {number} [maxAgeSec]
 */
function setSessionCookies(response, token, maxAgeSec = SESSION_MAX_AGE_SEC) {
	const opts = sessionCookieOptions(maxAgeSec);
	response.cookies.set('auth_token', token, opts);
	// 기존 코드가 user_info를 읽는 경우 대비 — 동일 JWT(서명됨)
	response.cookies.set('user_info', token, opts);
}

/**
 * 세션 쿠키 삭제
 * @param {import('next/server').NextResponse} response
 */
function clearSessionCookies(response) {
	response.cookies.set('auth_token', '', { httpOnly: true, path: '/', maxAge: 0 });
	response.cookies.set('user_info', '', { httpOnly: true, path: '/', maxAge: 0 });
}

module.exports = {
	SESSION_MAX_AGE_SEC,
	getAuthSecret,
	signSession,
	verifySession,
	sessionCookieOptions,
	setSessionCookies,
	clearSessionCookies,
};

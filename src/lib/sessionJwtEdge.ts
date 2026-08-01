/**
 * @file Edge Runtime용 세션 JWT 검증 (Web Crypto)
 *
 * @description
 * Next.js middleware(Edge)에서 Node crypto 없이 HS256 JWT를 검증합니다.
 * `sessionJwt.js`의 signSession과 동일한 포맷을 사용합니다.
 *
 * @module lib/sessionJwtEdge
 */

export type SessionPayload = {
	ancd: string | number;
	uid: string;
	ugr: string;
	annm: string;
	iat?: number;
	exp?: number;
};

function base64UrlToBytes(b64url: string): Uint8Array {
	const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
	const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/**
 * AUTH_SECRET으로 서명된 세션 JWT 검증.
 * @returns payload 또는 null
 */
export async function verifySessionEdge(
	token: string | undefined | null,
	secret: string | undefined | null
): Promise<SessionPayload | null> {
	if (!token || !secret) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [h, p, s] = parts;
	const data = `${h}.${p}`;

	try {
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['verify']
		);
		const ok = await crypto.subtle.verify(
			'HMAC',
			key,
			base64UrlToBytes(s),
			new TextEncoder().encode(data)
		);
		if (!ok) return null;

		const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(p)));
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

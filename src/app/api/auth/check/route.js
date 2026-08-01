/**
 * @file API /api/auth/check — 세션 JWT 유효성 확인
 *
 * @module app/api/auth/check/route
 */
import { NextResponse } from 'next/server';

import { jsonOk, jsonError } from '../../../../utils/apiResponse';
import { getSessionFromRequest } from '../../../../config/sessionServer';

const { clearSessionCookies } = require('../../../../lib/sessionJwt');

export async function GET(req) {
	try {
		const user = getSessionFromRequest(req);
		if (!user) {
			const response = NextResponse.json(
				{ authenticated: false, message: '세션이 없거나 만료되었습니다.' },
				{ status: 401 }
			);
			clearSessionCookies(response);
			return response;
		}

		return jsonOk({
			authenticated: true,
			user: { ancd: user.ancd, uid: user.uid, ugr: user.ugr || undefined },
		});
	} catch (err) {
		console.error('인증 체크 오류:', err);
		return jsonError({ authenticated: false, message: '인증 확인 중 오류가 발생했습니다.' });
	}
}

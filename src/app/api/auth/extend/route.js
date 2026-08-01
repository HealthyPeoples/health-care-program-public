/**
 * @file API /api/auth/extend — 서명된 세션 JWT 재발급(연장)
 *
 * @module app/api/auth/extend/route
 */
import { NextResponse } from 'next/server';

import { jsonError } from '../../../../utils/apiResponse';
import { getSessionFromRequest } from '../../../../config/sessionServer';

const {
	SESSION_MAX_AGE_SEC,
	signSession,
	setSessionCookies,
} = require('../../../../lib/sessionJwt');

export async function POST(req) {
	try {
		const user = getSessionFromRequest(req);
		if (!user) {
			return jsonError({ success: false, message: '로그인 정보가 없습니다.' }, 401);
		}

		const token = signSession({
			ancd: user.ancd,
			uid: user.uid,
			ugr: user.ugr,
			annm: user.annm,
		});

		const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000).toISOString();

		const response = NextResponse.json(
			{
				success: true,
				message: '로그인이 연장되었습니다.',
				expiresAt,
			},
			{ status: 200 }
		);

		setSessionCookies(response, token, SESSION_MAX_AGE_SEC);
		return response;
	} catch (err) {
		console.error('로그인 연장 오류:', err);
		return jsonError({ success: false, message: '로그인 연장 처리 중 오류가 발생했습니다.' });
	}
}

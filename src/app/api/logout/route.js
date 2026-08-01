/**
 * @file API /api/logout — 로그아웃
 *
 * @module app/api/logout/route
 */
import { NextResponse } from 'next/server';

import { jsonError } from '../../../utils/apiResponse';

const { clearSessionCookies } = require('../../../lib/sessionJwt');

export async function POST() {
	try {
		const response = NextResponse.json(
			{ success: true, message: '로그아웃되었습니다.' },
			{ status: 200 }
		);
		clearSessionCookies(response);
		return response;
	} catch (err) {
		console.error('로그아웃 오류:', err);
		return jsonError({ success: false, message: '로그아웃 처리 중 오류가 발생했습니다.' });
	}
}

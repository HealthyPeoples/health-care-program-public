/**
 * @file API /api/login — 로그인
 *
 * @description
 * DB 비밀번호 검증 후 AUTH_SECRET으로 서명한 세션 JWT를 httpOnly 쿠키로 발급합니다.
 * Vercel/mock/클라이언트 쿠키 위조 경로는 제거되었습니다.
 *
 * @module app/api/login/route
 */
import { getConnectionPool } from '../../../config/server';
import { NextResponse } from 'next/server';

import { jsonError } from '../../../utils/apiResponse';

const {
	SESSION_MAX_AGE_SEC,
	getAuthSecret,
	signSession,
	setSessionCookies,
} = require('../../../lib/sessionJwt');

async function fetchAnnmForAncd(pool, ancd) {
	if (!pool || ancd == null || ancd === '') return '';
	try {
		const n = typeof ancd === 'number' ? ancd : parseInt(String(ancd), 10);
		if (Number.isNaN(n)) return '';
		const r = await pool
			.request()
			.input('ancd', n)
			.query(`SELECT TOP 1 [ANNM] FROM [돌봄시설DB].[dbo].[F00110] WHERE [ANCD] = @ancd`);
		return r.recordset?.[0]?.ANNM ?? '';
	} catch (e) {
		console.error('F00110 ANNM 조회 실패:', e);
		return '';
	}
}

export async function POST(req) {
	try {
		if (!getAuthSecret()) {
			return jsonError(
				{
					success: false,
					message: '서버 설정 오류: AUTH_SECRET이 필요합니다.',
				},
				500
			);
		}

		let pool;
		try {
			pool = await getConnectionPool();
		} catch (dbErr) {
			console.error('로그인 DB 연결 실패:', dbErr);
			return jsonError({
				success: false,
				message: '데이터베이스 연결 실패',
				error: dbErr?.message || String(dbErr),
			});
		}
		if (!pool) {
			return jsonError({
				success: false,
				message: '데이터베이스 연결 실패',
				error: 'DB_DEV_SERVER 등 DB 환경변수가 비어 있습니다.',
			});
		}

		const body = await req.json();
		const { ancd, uid, upw } = body;

		if (!ancd || !uid || !upw) {
			return jsonError(
				{ success: false, message: 'ANCD, 아이디, 비밀번호를 모두 입력해주세요.' },
				400
			);
		}

		const userCheckQuery = `
      SELECT ANCD, UID, UPW, UGR
      FROM [돌봄시설DB].[dbo].[F00120]
      WHERE ANCD = @ancd AND UID = @uid
    `;

		const userCheckRequest = pool.request();
		userCheckRequest.input('ancd', ancd);
		userCheckRequest.input('uid', uid);

		const userCheckResult = await userCheckRequest.query(userCheckQuery);

		if (userCheckResult.recordset.length === 0) {
			return jsonError({ success: false, message: '존재하지 않는 계정입니다.' }, 401);
		}

		const loginRow = userCheckResult.recordset[0];
		const storedPassword = loginRow.UPW;
		if (storedPassword !== upw) {
			return jsonError({ success: false, message: '비밀번호가 틀렸습니다.' }, 401);
		}

		const loginUgr = loginRow.UGR != null ? String(loginRow.UGR).trim() : '';
		const annm = await fetchAnnmForAncd(pool, loginRow.ANCD);

		const token = signSession({
			ancd: loginRow.ANCD,
			uid: loginRow.UID,
			ugr: loginUgr,
			annm,
		});

		const response = NextResponse.json(
			{
				success: true,
				message: '로그인 성공했습니다',
				ipRestricted: false,
				user: {
					ancd: loginRow.ANCD,
					uid: loginRow.UID,
					ugr: loginUgr || undefined,
					annm: annm || undefined,
				},
			},
			{ status: 200 }
		);

		setSessionCookies(response, token, SESSION_MAX_AGE_SEC);
		return response;
	} catch (err) {
		console.error('로그인 오류:', err);
		return jsonError({
			success: false,
			message: '로그인 처리 중 오류가 발생했습니다.',
			error: err?.message || String(err),
		});
	}
}

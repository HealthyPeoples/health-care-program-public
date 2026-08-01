/**
 * @file API /api/auth/user-info — 검증된 세션 + DB 보강 정보
 *
 * @module app/api/auth/user-info/route
 */
import { connPool } from '../../../../config/server';
import { getSessionFromRequest } from '../../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../../utils/apiResponse';

export async function GET(req) {
	try {
		const session = getSessionFromRequest(req);
		if (!session) {
			return jsonError({ success: false, error: '로그인이 필요합니다.' }, 401);
		}

		let parsedUserInfo = {
			ancd: session.ancd,
			uid: session.uid,
			ugr: session.ugr || undefined,
			annm: session.annm || undefined,
		};

		try {
			const pool = await connPool;
			if (pool && parsedUserInfo.ancd != null && parsedUserInfo.ancd !== '') {
				const n = parseInt(String(parsedUserInfo.ancd), 10);
				if (!Number.isNaN(n)) {
					if (!parsedUserInfo.annm) {
						const r = await pool
							.request()
							.input('ancd', n)
							.query(
								`SELECT TOP 1 [ANNM] FROM [돌봄시설DB].[dbo].[F00110] WHERE [ANCD] = @ancd`
							);
						const annm = r.recordset?.[0]?.ANNM;
						if (annm) {
							parsedUserInfo = { ...parsedUserInfo, annm };
						}
					}
					if (parsedUserInfo.uid) {
						const r2 = await pool
							.request()
							.input('ancd', n)
							.input('uid', String(parsedUserInfo.uid).trim())
							.query(
								`SELECT TOP 1 [EMPNO], [EMPNM], RTRIM([UGR]) AS [UGR],
                        RTRIM([DECYN]) AS [DECYN], [DECPOS]
                 FROM [돌봄시설DB].[dbo].[F00120]
                 WHERE [ANCD] = @ancd AND [UID] = @uid`
							);
						const row2 = r2.recordset?.[0];
						if (row2?.EMPNM) {
							parsedUserInfo = { ...parsedUserInfo, empnm: row2.EMPNM };
						}
						if (row2?.EMPNO != null && row2.EMPNO !== '') {
							parsedUserInfo = { ...parsedUserInfo, empno: row2.EMPNO };
						}
						const ugr = row2?.UGR != null ? String(row2.UGR).trim() : '';
						if (ugr) {
							parsedUserInfo = { ...parsedUserInfo, ugr };
						}
						if (row2?.DECYN != null) {
							parsedUserInfo = {
								...parsedUserInfo,
								decyn: String(row2.DECYN).trim().toUpperCase() === 'Y' ? 'Y' : 'N',
							};
						}
						if (row2?.DECPOS != null && row2.DECPOS !== '') {
							const pos = Number(row2.DECPOS);
							if (Number.isFinite(pos)) {
								parsedUserInfo = { ...parsedUserInfo, decpos: pos };
							}
						}
					}
				}
			}
		} catch (e) {
			console.error('user-info DB 보강 실패:', e);
		}

		return jsonOk({
			success: true,
			data: parsedUserInfo,
		});
	} catch (err) {
		console.error('user-info 오류:', err);
		return jsonError({
			success: false,
			error: err.message,
		});
	}
}

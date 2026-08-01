/**
 * @file API /api/v30030r — 급여 조회 뷰 V30030R
 *
 * @description
 * 급여 조회 뷰 V30030R Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/v30030r/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const sql = require('mssql');
const VIEW = '[돌봄시설DB].[dbo].[V30030R]';

function formatDateForDB(dateStr) {
	if (!dateStr) return null;
	if (String(dateStr).includes('-')) return String(dateStr).slice(0, 10);
	const s = String(dateStr);
	if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s;
}

function validateDate(dateStr) {
	if (!dateStr) return false;
	return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).slice(0, 10));
}

/**
 * V30030R 간호일지/건강관리기록부 출력용 조회
 * GET /api/v30030r?pnum=&startDate=&endDate=&ancd=
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const ancd = sp.get('ancd');
		const pnum = sp.get('pnum');
		const startDate = sp.get('startDate');
		const endDate = sp.get('endDate');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (pnum == null || String(pnum).trim() === '') {
			return jsonError({ success: false, error: 'pnum이 필요합니다' }, 400);
		}
		if (!validateDate(startDate) || !validateDate(endDate)) {
			return jsonError(
				{ success: false, error: 'startDate, endDate는 yyyy-mm-dd 형식이어야 합니다' },
				400
			);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const start = formatDateForDB(startDate);
		const end = formatDateForDB(endDate);

		const request = pool.request();
		request.input('sessionAncd', sql.Int, Number(gate.sessionAncd));
		request.input('pnum', sql.Int, Number(pnum));
		request.input('startDate', sql.VarChar(10), start);
		request.input('endDate', sql.VarChar(10), end);

		const result = await request.query(`
      SELECT *
      FROM ${VIEW}
      WHERE [ANCD] = @sessionAncd
        AND CAST([PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)
        AND LEFT(REPLACE(LTRIM(RTRIM(CAST([조사일자] AS VARCHAR(20)))), '-', ''), 8)
            BETWEEN REPLACE(@startDate, '-', '') AND REPLACE(@endDate, '-', '')
      ORDER BY [조사일자] DESC
    `);

		return jsonOk({
			success: true,
			data: result.recordset || [],
			count: result.recordset ? result.recordset.length : 0,
		});
	} catch (err) {
		console.error('V30030R GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

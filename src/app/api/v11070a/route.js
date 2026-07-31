import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const VIEW = '[돌봄시설DB].[dbo].[V11070A]';

function toYmd(v) {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (!s) return '';
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s.slice(0, 10);
}

function validateDate(dateStr) {
	return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '').slice(0, 10));
}

/**
 * V11070A 기간 조회 (진료비/진료기록부 출력용)
 * GET /api/v11070a?pnum=&startDate=&endDate=
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const startDate = String(sp.get('startDate') || '').slice(0, 10);
		const endDate = String(sp.get('endDate') || '').slice(0, 10);

		if (!pnum) {
			return jsonError({ success: false, error: 'pnum이 필요합니다' }, 400);
		}
		if (!validateDate(startDate) || !validateDate(endDate)) {
			return jsonError({ success: false, error: 'startDate, endDate는 yyyy-mm-dd 형식이어야 합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('sessionAncd', sql.Int, Number(gate.sessionAncd));
		request.input('pnum', sql.Int, Number(pnum));
		request.input('startDate', sql.VarChar(10), startDate);
		request.input('endDate', sql.VarChar(10), endDate);

		const result = await request.query(`
      SELECT *
      FROM ${VIEW}
      WHERE [ANCD] = @sessionAncd
        AND CAST([PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)
        AND CONVERT(date, [HCADT]) BETWEEN CONVERT(date, @startDate) AND CONVERT(date, @endDate)
      ORDER BY [HCADT] ASC
    `);

		const data = (result.recordset || []).map((r) => ({
			...r,
			HCADT: toYmd(r.HCADT),
		}));

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('V11070A GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { normalizeYmd } from '../../../utils/normalizeYmd';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F00130]';


const UGR_LABEL = {
	'1': '전체권한',
	'2': '등록(프로그램별)',
	'3': '등록(환자별)',
	'9': '조회',
};

/**
 * F00130 프로그램 마스터 목록
 * GET /api/f00130?mappableOnly=1  → PGMMAG='1'만
 */
export async function GET(req) {
	try {
		const gate = assertAnCdMatchesSession(req, null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return new Response(JSON.stringify({ success: false, error: '데이터베이스 연결 실패' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const mappableOnly = req.nextUrl.searchParams.get('mappableOnly') === '1';
		const where = mappableOnly
			? `WHERE RTRIM(ISNULL([PGMMAG], '')) = '1'`
			: '';

		const result = await pool.request().query(`
			SELECT
				[PGMID],
				[PGMNM],
				RTRIM([PGMGU]) AS [PGMGU],
				RTRIM([PGMMAG]) AS [PGMMAG],
				RTRIM([UGR]) AS [UGR],
				[INDT],
				[ETC]
			FROM ${TABLE_NAME}
			${where}
			ORDER BY [PGMNM], [PGMID]
		`);

		const data = (result.recordset || []).map((row) => {
			const ugr = row.UGR != null ? String(row.UGR).trim() : '';
			return {
				PGMID: row.PGMID != null ? String(row.PGMID).trim() : '',
				PGMNM: row.PGMNM != null ? String(row.PGMNM).trim() : '',
				PGMGU: row.PGMGU != null ? String(row.PGMGU).trim() : '',
				PGMMAG: row.PGMMAG != null ? String(row.PGMMAG).trim() : '',
				UGR: ugr,
				UGR_NM: UGR_LABEL[ugr] || (ugr ? `등급 ${ugr}` : ''),
				INDT: normalizeYmd(row.INDT),
				ETC: row.ETC != null ? String(row.ETC).trim() : '',
			};
		});

		return new Response(JSON.stringify({ success: true, data, count: data.length }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		console.error('F00130 조회 오류:', err);
		return new Response(
			JSON.stringify({ success: false, error: err.message, details: err.toString() }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

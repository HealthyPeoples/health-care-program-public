/**
 * @file API /api/f51130 — 회의/보호자 F51130
 *
 * @description
 * 회의/보호자 F51130 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f51130/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F51130]';

/**
 * GET /api/f51130?mode=codes&pnum=
 * - mode=codes: 서비스항목 코드 목록 (드롭다운용)
 * - pnum 있으면 해당 수급자 계획 항목 우선, 없으면 기관 전체 distinct
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const mode = String(sp.get('mode') || 'codes').trim();
		const pnum = sp.get('pnum');

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		if (mode === 'codes') {
			const request = pool.request();
			request.input('ANCD', sql.Int, Number(gate.sessionAncd));

			let wherePnum = '';
			if (pnum != null && String(pnum).trim() !== '') {
				request.input('PNUM', sql.Int, Number(pnum));
				wherePnum = ` AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)`;
			}

			const result = await request.query(`
        SELECT HCACDC, HCACNM, HCACDB
        FROM (
          SELECT
            LTRIM(RTRIM([HCACDC])) AS HCACDC,
            LTRIM(RTRIM([HCACNM])) AS HCACNM,
            LTRIM(RTRIM([HCACDB])) AS HCACDB,
            ROW_NUMBER() OVER (
              PARTITION BY LTRIM(RTRIM([HCACDC]))
              ORDER BY [JHDT] DESC, [INDT] DESC
            ) AS rn
          FROM ${TABLE_NAME}
          WHERE [ANCD] = @ANCD
            AND ISNULL(LTRIM(RTRIM([HCACDC])), '') <> ''
            ${wherePnum}
        ) t
        WHERE rn = 1
        ORDER BY HCACDC
      `);

			let data = (result.recordset || []).map((r) => ({
				HCACDC: r.HCACDC != null ? String(r.HCACDC).trim() : '',
				HCACNM: r.HCACNM != null ? String(r.HCACNM).trim() : '',
				HCACDB: r.HCACDB != null ? String(r.HCACDB).trim() : '',
			}));

			// 수급자별 항목이 없으면 기관 전체 코드로 폴백
			if (data.length === 0 && pnum != null && String(pnum).trim() !== '') {
				const fallback = await pool
					.request()
					.input('ANCD', sql.Int, Number(gate.sessionAncd))
					.query(`
            SELECT HCACDC, HCACNM, HCACDB
            FROM (
              SELECT
                LTRIM(RTRIM([HCACDC])) AS HCACDC,
                LTRIM(RTRIM([HCACNM])) AS HCACNM,
                LTRIM(RTRIM([HCACDB])) AS HCACDB,
                ROW_NUMBER() OVER (
                  PARTITION BY LTRIM(RTRIM([HCACDC]))
                  ORDER BY [JHDT] DESC, [INDT] DESC
                ) AS rn
              FROM ${TABLE_NAME}
              WHERE [ANCD] = @ANCD
                AND ISNULL(LTRIM(RTRIM([HCACDC])), '') <> ''
            ) t
            WHERE rn = 1
            ORDER BY HCACDC
          `);
				data = (fallback.recordset || []).map((r) => ({
					HCACDC: r.HCACDC != null ? String(r.HCACDC).trim() : '',
					HCACNM: r.HCACNM != null ? String(r.HCACNM).trim() : '',
					HCACDB: r.HCACDB != null ? String(r.HCACDB).trim() : '',
				}));
			}

			return jsonOk({ success: true, data, count: data.length });
		}

		return jsonError({ success: false, error: '지원하지 않는 mode입니다' }, 400);
	} catch (err) {
		console.error('F51130 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

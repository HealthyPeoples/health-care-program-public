/**
 * @file API /api/f20110 — 인지·기능평가 F20110
 *
 * @description
 * 인지·기능평가 F20110 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f20110/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F20110]';

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
	return '';
}

/**
 * GET /api/f20110?hcacdb=
 * 장기요양서비스행위 마스터 — HCACDB로 필터, HCACDC별 최신 적용일자 1건
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const hcacdb = String(sp.get('hcacdb') || '').trim().toUpperCase();
		if (!hcacdb) {
			return jsonError({ success: false, error: 'hcacdb 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('HCACDB', sql.VarChar(2), hcacdb);

		const result = await request.query(`
      SELECT HCADT, HCACDC, HCACDA, HCACDB, HCACNT, HCACNM, JHSPNT, JHEMPNM, PRODESC
      FROM (
        SELECT
          [HCADT],
          LTRIM(RTRIM([HCACDC])) AS HCACDC,
          LTRIM(RTRIM([HCACDA])) AS HCACDA,
          LTRIM(RTRIM([HCACDB])) AS HCACDB,
          [HCACNT],
          LTRIM(RTRIM([HCACNM])) AS HCACNM,
          [JHSPNT],
          [JHEMPNM],
          [PRODESC],
          ROW_NUMBER() OVER (
            PARTITION BY LTRIM(RTRIM([HCACDC]))
            ORDER BY [HCADT] DESC
          ) AS rn
        FROM ${TABLE_NAME}
        WHERE LTRIM(RTRIM([HCACDB])) = @HCACDB
          AND ISNULL(LTRIM(RTRIM([HCACDC])), '') <> ''
      ) t
      WHERE rn = 1
      ORDER BY ISNULL(HCACNT, 0) ASC, HCACDC ASC
    `);

		const data = (result.recordset || []).map((r) => ({
			HCADT: toYmd(r.HCADT),
			HCACDC: r.HCACDC != null ? String(r.HCACDC).trim() : '',
			HCACDA: r.HCACDA != null ? String(r.HCACDA).trim() : '',
			HCACDB: r.HCACDB != null ? String(r.HCACDB).trim() : '',
			HCACNT: r.HCACNT != null ? Number(r.HCACNT) : null,
			HCACNM: r.HCACNM != null ? String(r.HCACNM).trim() : '',
			JHSPNT: r.JHSPNT != null ? String(r.JHSPNT).trim() : '',
			JHEMPNM: r.JHEMPNM != null ? String(r.JHEMPNM).trim() : '',
			PRODESC: r.PRODESC != null ? String(r.PRODESC).trim() : '',
		}));

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F20110 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F20020]';

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
 * GET /api/f20020
 * 문제목록(문제도출) 마스터 — HCACDB별 최신 적용일자 1건
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const result = await pool.request().query(`
      SELECT HCADT, HCACDB, HCACDA, HCABNM, INDT, ETC
      FROM (
        SELECT
          [HCADT],
          LTRIM(RTRIM([HCACDB])) AS HCACDB,
          LTRIM(RTRIM([HCACDA])) AS HCACDA,
          LTRIM(RTRIM([HCABNM])) AS HCABNM,
          [INDT],
          [ETC],
          ROW_NUMBER() OVER (
            PARTITION BY LTRIM(RTRIM([HCACDB]))
            ORDER BY [HCADT] DESC
          ) AS rn
        FROM ${TABLE_NAME}
        WHERE ISNULL(LTRIM(RTRIM([HCACDB])), '') <> ''
      ) t
      WHERE rn = 1
      ORDER BY HCACDB
    `);

		const data = (result.recordset || []).map((r) => ({
			HCADT: toYmd(r.HCADT),
			HCACDB: r.HCACDB != null ? String(r.HCACDB).trim() : '',
			HCACDA: r.HCACDA != null ? String(r.HCACDA).trim() : '',
			HCABNM: r.HCABNM != null ? String(r.HCABNM).trim() : '',
			INDT: toYmd(r.INDT),
			ETC: r.ETC != null ? String(r.ETC) : '',
		}));

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F20020 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

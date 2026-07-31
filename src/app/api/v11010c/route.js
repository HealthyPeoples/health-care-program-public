import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const VIEW = '[돌봄시설DB].[dbo].[V11010C]';

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

function mapRow(r) {
	if (!r) return null;
	const fee = r['진료비'] != null ? Number(r['진료비']) : 0;
	const collected = r['수금액'] != null ? Number(r['수금액']) : 0;
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		MEGYN: r.MEGYN != null ? String(r.MEGYN).trim() : '',
		수급자: r['수급자'] != null ? String(r['수급자']) : '',
		생일: toYmd(r['생일']),
		상태: r['상태'] != null ? String(r['상태']).trim() : '',
		보호자핸드폰: r['보호자핸드폰'] != null ? String(r['보호자핸드폰']).trim() : '',
		진료비: Number.isFinite(fee) ? fee : 0,
		수금액: Number.isFinite(collected) ? collected : 0,
		미수금: (Number.isFinite(fee) ? fee : 0) - (Number.isFinite(collected) ? collected : 0),
	};
}

/**
 * V11010C 미수금내역 조회
 * GET /api/v11010c
 * GET /api/v11010c?mode=summary  — 수급자별 합산
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const mode = String(sp.get('mode') || '').trim();

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('sessionAncd', sql.Int, Number(gate.sessionAncd));

		const result = await request.query(`
      SELECT *
      FROM ${VIEW}
      WHERE [ANCD] = @sessionAncd
      ORDER BY [수급자] ASC, [PNUM] ASC
    `);

		const rows = (result.recordset || []).map(mapRow);

		if (mode === 'summary') {
			const map = new Map();
			for (const r of rows) {
				const key = String(r.PNUM);
				const prev = map.get(key);
				if (!prev) {
					map.set(key, { ...r });
					continue;
				}
				prev.진료비 += Number(r.진료비) || 0;
				prev.수금액 += Number(r.수금액) || 0;
				prev.미수금 = prev.진료비 - prev.수금액;
				if (!prev.보호자핸드폰 && r.보호자핸드폰) prev.보호자핸드폰 = r.보호자핸드폰;
				if (!prev.생일 && r.생일) prev.생일 = r.생일;
				if (!prev.상태 && r.상태) prev.상태 = r.상태;
			}
			const data = Array.from(map.values()).sort((a, b) =>
				String(a.수급자 || '').localeCompare(String(b.수급자 || ''), 'ko')
			);
			return jsonOk({ success: true, data, count: data.length });
		}

		return jsonOk({ success: true, data: rows, count: rows.length });
	} catch (err) {
		console.error('V11010C GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

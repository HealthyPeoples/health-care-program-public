/**
 * @file API /api/v32010 — 물리치료계획 조회 뷰 V32010
 *
 * @description
 * 물리치료 계획 및 평가 출력용 V32010 Next.js Route Handler.
 *
 * @module app/api/v32010/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const VIEW = '[돌봄시설DB].[dbo].[V32010]';

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

function mapRow(r) {
	if (!r) return null;
	return {
		...r,
		생일: toYmd(r['생일']),
		입소일: toYmd(r['입소일']),
		시작일자: toYmd(r['시작일자']),
		종료일자: toYmd(r['종료일자']),
		장기요양기관기호: r['장기요양기간기호'] ?? r['장기요양기관기호'] ?? '',
		장기요양기관명: r['장기요양기간명'] ?? r['장기요양기관명'] ?? '',
	};
}

/**
 * GET /api/v32010?startDate=&endDate=&pnums=1,2,3
 * GET /api/v32010?startDate=&endDate=&pnum=1
 * GET /api/v32010?pnum=&sdt=&edt=  (1건)
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnumRaw = String(sp.get('pnum') || '').trim();
		const pnumsRaw = String(sp.get('pnums') || '').trim();
		const pnumList = (pnumsRaw ? pnumsRaw.split(',') : pnumRaw ? [pnumRaw] : [])
			.map((s) => String(s).trim())
			.filter(Boolean);

		if (pnumList.length === 0) {
			return jsonError({ success: false, error: 'pnum 또는 pnums가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('sessionAncd', sql.Int, Number(gate.sessionAncd));

		const placeholders = pnumList.map((_, i) => {
			request.input(`p${i}`, sql.VarChar(20), pnumList[i]);
			return `@p${i}`;
		});

		const sdt = String(sp.get('sdt') || '').slice(0, 10);
		const edt = String(sp.get('edt') || '').slice(0, 10);
		let result;

		if (validateDate(sdt) && validateDate(edt)) {
			request.input('sdt', sql.VarChar(10), sdt);
			request.input('edt', sql.VarChar(10), edt);
			result = await request.query(`
        SELECT *
        FROM ${VIEW}
        WHERE [ANCD] = @sessionAncd
          AND CAST([PNUM] AS VARCHAR) IN (${placeholders.join(',')})
          AND CONVERT(date, [시작일자]) = CONVERT(date, @sdt)
          AND CONVERT(date, [종료일자]) = CONVERT(date, @edt)
        ORDER BY [수급자성명] ASC, CAST([PNUM] AS VARCHAR) ASC, [시작일자] ASC
      `);
		} else {
			const startDate = String(sp.get('startDate') || '').slice(0, 10);
			const endDate = String(sp.get('endDate') || '').slice(0, 10);
			if (!validateDate(startDate) || !validateDate(endDate)) {
				return jsonError(
					{ success: false, error: 'startDate, endDate는 yyyy-mm-dd 형식이어야 합니다' },
					400
				);
			}
			request.input('startDate', sql.VarChar(10), startDate);
			request.input('endDate', sql.VarChar(10), endDate);
			result = await request.query(`
        SELECT *
        FROM ${VIEW}
        WHERE [ANCD] = @sessionAncd
          AND CAST([PNUM] AS VARCHAR) IN (${placeholders.join(',')})
          AND CONVERT(date, [시작일자]) <= CONVERT(date, @endDate)
          AND CONVERT(date, ISNULL([종료일자], [시작일자])) >= CONVERT(date, @startDate)
        ORDER BY [수급자성명] ASC, CAST([PNUM] AS VARCHAR) ASC, [시작일자] ASC
      `);
		}

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('V32010 GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

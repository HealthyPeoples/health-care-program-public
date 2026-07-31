import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const VIEW = '[돌봄시설DB].[dbo].[V11010B]';

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

function pickCol(r, ...keys) {
	for (const k of keys) {
		if (r && Object.prototype.hasOwnProperty.call(r, k) && r[k] != null && r[k] !== '') {
			return r[k];
		}
	}
	for (const k of keys) {
		if (r && Object.prototype.hasOwnProperty.call(r, k)) return r[k];
	}
	return null;
}

function mapRow(r) {
	if (!r) return null;
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		장기요양기관기호: pickCol(r, '장기요양기관기호', '장기요양기간기호'),
		장기요양기관명: pickCol(r, '장기요양기관명', '장기요양기간명'),
		장기요양등급: r['장기요양등급'] != null ? String(r['장기요양등급']) : '',
		수급자성명: r['수급자성명'] != null ? String(r['수급자성명']) : '',
		주민등록번호: r['주민등록번호'] != null ? String(r['주민등록번호']) : '',
		장기요양인정번호: r['장기요양인정번호'] != null ? String(r['장기요양인정번호']) : '',
		진료일자: toYmd(r['진료일자']),
		외래구분: r['외래구분'] != null ? String(r['외래구분']).trim() : '',
		진료비구분: r['진료비구분'] != null ? String(r['진료비구분']).trim() : '',
		진료비: r['진료비'] != null ? Number(r['진료비']) : null,
		수금여부: r['수금여부'] != null ? String(r['수금여부']).trim() : '',
		수금액: r['수금액'] != null ? Number(r['수금액']) : null,
		수금일자: toYmd(r['수금일자']),
		동행사원: r['동행사원'] != null ? String(r['동행사원']) : '',
		진료기관명: r['진료기관명'] != null ? String(r['진료기관명']) : '',
		진료의뢰내역: r['진료의뢰내역'] != null ? String(r['진료의뢰내역']) : '',
		진료결과: r['진료결과'] != null ? String(r['진료결과']) : '',
	};
}

/**
 * V11010B 기간 조회 (외래진료비 출력용)
 * GET /api/v11010b?pnum=&startDate=&endDate=
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
			return jsonError(
				{ success: false, error: 'startDate, endDate는 yyyy-mm-dd 형식이어야 합니다' },
				400
			);
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
        AND CONVERT(date, [진료일자]) BETWEEN CONVERT(date, @startDate) AND CONVERT(date, @endDate)
      ORDER BY [진료일자] ASC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('V11010B GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

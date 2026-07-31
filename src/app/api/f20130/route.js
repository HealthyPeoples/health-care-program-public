import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession, parseUserInfoCookieValue } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F20130]';
const ACT_TABLE = '[돌봄시설DB].[dbo].[F20110]';
const PROBLEM_TABLE = '[돌봄시설DB].[dbo].[F20020]';

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
	const parsed = Date.parse(s);
	if (!Number.isNaN(parsed)) {
		const dt = new Date(parsed);
		const y = dt.getFullYear();
		const m = String(dt.getMonth() + 1).padStart(2, '0');
		const d = String(dt.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

function pick(body, k, fallback = null) {
	if (!body || typeof body !== 'object') return fallback;
	if (Object.prototype.hasOwnProperty.call(body, k)) return body[k];
	const alt = k.toLowerCase();
	if (alt !== k && Object.prototype.hasOwnProperty.call(body, alt)) return body[alt];
	return fallback;
}

function toNullableInt(v) {
	if (v == null || v === '') return null;
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : null;
}

function normalizeCode(v) {
	return String(v ?? '')
		.trim()
		.toUpperCase()
		.slice(0, 4);
}

function mapRow(r) {
	if (!r) return null;
	const code = r.HCACDC != null ? String(r.HCACDC).trim() : '';
	const name = r.HCACNM != null ? String(r.HCACNM).trim() : '';
	const actName = r.ACT_HCACNM != null ? String(r.ACT_HCACNM).trim() : '';
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		HCADT: toYmd(r.HCADT),
		HCACDC: code,
		HCACNM: name || actName,
		HCACDB: r.HCACDB != null ? String(r.HCACDB).trim() : '',
		HCABNM: r.HCABNM != null ? String(r.HCABNM).trim() : '',
		HCATM: r.HCATM != null ? Number(r.HCATM) : null,
		INDT: toYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNO: r.INEMPNO,
		INEMPNM: r.INEMPNM != null ? String(r.INEMPNM) : '',
	};
}

async function resolveInEmpno(pool, sessionAncd, req, body) {
	const fromBody = pick(body, 'INEMPNO');
	if (fromBody != null && String(fromBody).trim() !== '') {
		const n = parseInt(String(fromBody).trim(), 10);
		return Number.isNaN(n) ? null : n;
	}

	const name = String(pick(body, 'INEMPNM', '') ?? '').trim();
	if (name && pool) {
		const r = await pool
			.request()
			.input('ANCD', sql.Int, Number(sessionAncd))
			.input('EMPNM', sql.VarChar(100), name)
			.query(`
        SELECT TOP 1 [EMPNO] FROM [돌봄시설DB].[dbo].[F00120]
        WHERE [ANCD] = @ANCD AND [EMPNM] = @EMPNM
      `);
		const empno = r.recordset?.[0]?.EMPNO;
		if (empno != null) return empno;
	}

	const session = parseUserInfoCookieValue(req.cookies.get('user_info')?.value);
	const uid = String(session?.uid ?? '').trim();
	if (uid && pool) {
		const r = await pool
			.request()
			.input('ANCD', sql.Int, Number(sessionAncd))
			.input('UID', sql.VarChar(50), uid)
			.query(`
        SELECT TOP 1 [EMPNO] FROM [돌봄시설DB].[dbo].[F00120]
        WHERE [ANCD] = @ANCD AND [UID] = @UID
      `);
		const empno = r.recordset?.[0]?.EMPNO;
		if (empno != null) return empno;
	}

	return null;
}

/** GET /api/f20130?pnum= */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		if (!pnum) {
			return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));

		const result = await request.query(`
      SELECT
        f.*,
        act.[HCACDB],
        act.[HCACNM] AS ACT_HCACNM,
        prob.[HCABNM]
      FROM ${TABLE_NAME} f
      OUTER APPLY (
        SELECT TOP 1
          LTRIM(RTRIM(a.[HCACDB])) AS HCACDB,
          LTRIM(RTRIM(a.[HCACNM])) AS HCACNM
        FROM ${ACT_TABLE} a
        WHERE LTRIM(RTRIM(a.[HCACDC])) = LTRIM(RTRIM(f.[HCACDC]))
        ORDER BY a.[HCADT] DESC
      ) act
      OUTER APPLY (
        SELECT TOP 1 LTRIM(RTRIM(p.[HCABNM])) AS HCABNM
        FROM ${PROBLEM_TABLE} p
        WHERE LTRIM(RTRIM(p.[HCACDB])) = LTRIM(RTRIM(act.[HCACDB]))
        ORDER BY p.[HCADT] DESC
      ) prob
      WHERE f.[ANCD] = @ANCD
        AND CAST(f.[PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY f.[HCADT] DESC, f.[HCACDC] ASC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F20130 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f20130 — 신규 등록 */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const hcadt = toYmd(pick(body, 'HCADT'));
		const hcacdc = normalizeCode(pick(body, 'HCACDC'));
		const hcacnm = String(pick(body, 'HCACNM', '') ?? '').trim().slice(0, 200);
		const hcatm = toNullableInt(pick(body, 'HCATM'));
		const etc = String(pick(body, 'ETC', '') ?? '').trim().slice(0, 100);
		const inempnm = String(pick(body, 'INEMPNM', '') ?? '').trim().slice(0, 100) || null;

		if (pnum == null || String(pnum).trim() === '') {
			return jsonError({ success: false, error: 'PNUM은 필수입니다' }, 400);
		}
		if (!hcadt || !/^\d{4}-\d{2}-\d{2}$/.test(hcadt)) {
			return jsonError({ success: false, error: '제공일자(HCADT)는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}
		if (!hcacdc) {
			return jsonError({ success: false, error: '서비스항목 코드(HCACDC)는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const inempno = await resolveInEmpno(pool, gate.sessionAncd, req, body);

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('HCADT', sql.Date, hcadt);
		request.input('HCACDC', sql.Char(4), hcacdc.padEnd(4, ' '));
		request.input('HCACNM', sql.VarChar(200), hcacnm || null);
		request.input('HCATM', sql.Int, hcatm);
		request.input('INDT', sql.Date, indt);
		request.input('ETC', sql.VarChar(100), etc || null);
		request.input('INEMPNO', sql.Int, inempno);
		request.input('INEMPNM', sql.VarChar(100), inempnm);

		try {
			await request.query(`
        INSERT INTO ${TABLE_NAME}
          ([ANCD],[PNUM],[HCADT],[HCACDC],[HCACNM],[HCATM],[INDT],[ETC],[INEMPNO],[INEMPNM])
        VALUES
          (@ANCD,@PNUM,@HCADT,@HCACDC,@HCACNM,@HCATM,@INDT,@ETC,@INEMPNO,@INEMPNM)
      `);
		} catch (insertErr) {
			if (String(insertErr?.number) === '2627' || /PRIMARY KEY|duplicate/i.test(String(insertErr?.message || ''))) {
				return jsonError(
					{ success: false, error: '동일 제공일자·서비스항목이 이미 등록되어 있습니다' },
					409
				);
			}
			throw insertErr;
		}

		return jsonOk({
			success: true,
			data: { PNUM: Number(pnum), HCADT: hcadt, HCACDC: hcacdc },
		});
	} catch (err) {
		console.error('F20130 추가 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** PUT /api/f20130 — 제공시간·비고만 수정 */
export async function PUT(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const hcadt = toYmd(pick(body, 'HCADT'));
		const hcacdc = normalizeCode(pick(body, 'HCACDC'));
		const hcatm = toNullableInt(pick(body, 'HCATM'));
		const etc = String(pick(body, 'ETC', '') ?? '').trim().slice(0, 100);
		const inempnm = String(pick(body, 'INEMPNM', '') ?? '').trim().slice(0, 100) || null;

		if (pnum == null || String(pnum).trim() === '') {
			return jsonError({ success: false, error: 'PNUM은 필수입니다' }, 400);
		}
		if (!hcadt || !/^\d{4}-\d{2}-\d{2}$/.test(hcadt)) {
			return jsonError({ success: false, error: '제공일자(HCADT)는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}
		if (!hcacdc) {
			return jsonError({ success: false, error: '서비스항목 코드(HCACDC)는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const inempno = await resolveInEmpno(pool, gate.sessionAncd, req, body);

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('HCADT', sql.Date, hcadt);
		request.input('HCACDC', sql.Char(4), hcacdc.padEnd(4, ' '));
		request.input('HCATM', sql.Int, hcatm);
		request.input('ETC', sql.VarChar(100), etc || null);
		request.input('INEMPNO', sql.Int, inempno);
		request.input('INEMPNM', sql.VarChar(100), inempnm);

		const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET [HCATM] = @HCATM,
          [ETC] = @ETC,
          [INEMPNO] = COALESCE(@INEMPNO, [INEMPNO]),
          [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM])
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [HCADT]) = CONVERT(date, @HCADT)
        AND LTRIM(RTRIM([HCACDC])) = LTRIM(RTRIM(@HCACDC))
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '수정할 행을 찾지 못했습니다' }, 404);
		}

		return jsonOk({
			success: true,
			affected,
			data: { PNUM: Number(pnum), HCADT: hcadt, HCACDC: hcacdc },
		});
	} catch (err) {
		console.error('F20130 수정 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f20130?pnum=&hcadt=&hcacdc= */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const hcadt = toYmd(sp.get('hcadt'));
		const hcacdc = normalizeCode(sp.get('hcacdc'));

		if (!pnum || !hcadt || !hcacdc) {
			return jsonError({ success: false, error: 'pnum, hcadt, hcacdc가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('HCADT', sql.Date, hcadt);
		request.input('HCACDC', sql.Char(4), hcacdc.padEnd(4, ' '));

		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [HCADT]) = CONVERT(date, @HCADT)
        AND LTRIM(RTRIM([HCACDC])) = LTRIM(RTRIM(@HCACDC))
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}

		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F20130 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/**
 * @file API /api/f11050 — 상태변화(관찰)내역 F11050
 *
 * @description
 * 상태변화 관찰 F11050 Next.js Route Handler. PK는 ANCD + PNUM + VDT.
 *
 * @module app/api/f11050/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession, getSessionFromRequest } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F11050]';

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

function toNullableDate(v) {
	const ymd = toYmd(v);
	return ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function mapRow(r) {
	if (!r) return null;
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		VDT: toYmd(r.VDT),
		EMPNO: r.EMPNO,
		EMPNM: r.EMPNM != null ? String(r.EMPNM) : '',
		VINFO: r.VINFO != null ? String(r.VINFO) : '',
		ORINFO: r.ORINFO != null ? String(r.ORINFO) : '',
		INDT: toYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNO: r.INEMPNO,
		INEMPNM: r.INEMPNM != null ? String(r.INEMPNM) : ''
	};
}

function sessionEmp(req) {
	const session = getSessionFromRequest(req);
	const uid = String(session?.uid ?? '').trim();
	const empno = toNullableInt(uid);
	const empnm = String(session?.unm ?? session?.empnm ?? '').trim() || null;
	return { empno, empnm };
}

async function resolveEmpno(pool, ancd, empno, empnm) {
	const fromBody = toNullableInt(empno);
	if (fromBody != null) return fromBody;
	const name = String(empnm ?? '').trim();
	if (!name) return null;
	const r = await pool
		.request()
		.input('ANCD', sql.Int, Number(ancd))
		.input('EMPNM', sql.VarChar(100), name)
		.query(`
      SELECT TOP 1 [EMPNO]
      FROM [돌봄시설DB].[dbo].[F00120]
      WHERE [ANCD] = @ANCD AND [EMPNM] = @EMPNM
    `);
	return toNullableInt(r.recordset?.[0]?.EMPNO);
}

/**
 * GET /api/f11050?pnum=&vdt=
 */
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

		const vdt = toNullableDate(sp.get('vdt'));
		if (vdt) {
			request.input('VDT', sql.Date, vdt);
			const result = await request.query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [VDT]) = CONVERT(date, @VDT)
      `);
			return jsonOk({ success: true, data: mapRow(result.recordset?.[0] || null) });
		}

		const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY [VDT] DESC
    `);
		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F11050 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f11050 — MERGE upsert (PK: ANCD, PNUM, VDT) */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const vdt = toNullableDate(pick(body, 'VDT'));
		const origVdt = toNullableDate(pick(body, 'origVDT') ?? pick(body, 'ORIG_VDT')) || vdt;

		if (pnum == null || String(pnum).trim() === '' || !vdt) {
			return jsonError({ success: false, error: 'PNUM, VDT는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const emp = sessionEmp(req);
		const empnm = String(pick(body, 'EMPNM', '') ?? '').trim().slice(0, 100);
		const empno = await resolveEmpno(pool, gate.sessionAncd, pick(body, 'EMPNO'), empnm);
		const vinfo = String(pick(body, 'VINFO', '') ?? '').slice(0, 1000);
		const orinfo = String(pick(body, 'ORINFO', '') ?? '').slice(0, 1000);
		const etc = pick(body, 'ETC', null);
		const inempno = toNullableInt(pick(body, 'INEMPNO')) ?? emp.empno;
		const inempnm = String(pick(body, 'INEMPNM', '') ?? '').trim() || emp.empnm;
		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		if (origVdt && origVdt !== vdt) {
			const dup = await pool
				.request()
				.input('ANCD', sql.Int, Number(gate.sessionAncd))
				.input('PNUM', sql.Int, Number(pnum))
				.input('VDT', sql.Date, vdt)
				.query(`
          SELECT TOP 1 1 AS X
          FROM ${TABLE_NAME}
          WHERE [ANCD] = @ANCD
            AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
            AND CONVERT(date, [VDT]) = CONVERT(date, @VDT)
        `);
			if (dup.recordset?.[0]) {
				return jsonError({ success: false, error: '변경하려는 관찰일자가 이미 존재합니다' }, 409);
			}

			const request = pool.request();
			request.input('ANCD', sql.Int, Number(gate.sessionAncd));
			request.input('PNUM', sql.Int, Number(pnum));
			request.input('ORIG_VDT', sql.Date, origVdt);
			request.input('VDT', sql.Date, vdt);
			request.input('EMPNO', sql.Int, empno);
			request.input('EMPNM', sql.VarChar(100), empnm || null);
			request.input('VINFO', sql.VarChar(1000), vinfo);
			request.input('ORINFO', sql.VarChar(1000), orinfo);
			request.input('ETC', sql.VarChar(100), etc == null ? null : String(etc).slice(0, 100));
			request.input('INEMPNO', sql.Int, inempno);
			request.input('INEMPNM', sql.VarChar(100), inempnm);

			const result = await request.query(`
        UPDATE ${TABLE_NAME}
        SET [VDT] = @VDT,
            [EMPNO] = @EMPNO,
            [EMPNM] = @EMPNM,
            [VINFO] = @VINFO,
            [ORINFO] = @ORINFO,
            [ETC] = @ETC,
            [INEMPNO] = COALESCE(@INEMPNO, [INEMPNO]),
            [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM])
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [VDT]) = CONVERT(date, @ORIG_VDT)
      `);
			const affected = Array.isArray(result.rowsAffected)
				? result.rowsAffected.reduce((a, b) => a + b, 0)
				: 0;
			if (affected === 0) {
				return jsonError({ success: false, error: '수정할 행을 찾지 못했습니다' }, 404);
			}
			return jsonOk({ success: true, data: { PNUM: Number(pnum), VDT: vdt } });
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('VDT', sql.Date, vdt);
		request.input('EMPNO', sql.Int, empno);
		request.input('EMPNM', sql.VarChar(100), empnm || null);
		request.input('VINFO', sql.VarChar(1000), vinfo);
		request.input('ORINFO', sql.VarChar(1000), orinfo);
		request.input('INDT', sql.Date, indt);
		request.input('ETC', sql.VarChar(100), etc == null ? null : String(etc).slice(0, 100));
		request.input('INEMPNO', sql.Int, inempno);
		request.input('INEMPNM', sql.VarChar(100), inempnm);

		await request.query(`
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @VDT AS VDT) AS S
        ON (T.[ANCD] = S.[ANCD]
          AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
          AND CONVERT(date, T.[VDT]) = CONVERT(date, S.[VDT]))
      WHEN MATCHED THEN
        UPDATE SET
          [EMPNO] = @EMPNO,
          [EMPNM] = @EMPNM,
          [VINFO] = @VINFO,
          [ORINFO] = @ORINFO,
          [ETC] = @ETC,
          [INEMPNO] = COALESCE(@INEMPNO, [INEMPNO]),
          [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM])
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[PNUM],[VDT],[EMPNO],[EMPNM],[VINFO],[ORINFO],[INDT],[ETC],[INEMPNO],[INEMPNM])
        VALUES (@ANCD, @PNUM, @VDT, @EMPNO, @EMPNM, @VINFO, @ORINFO, @INDT, @ETC, @INEMPNO, @INEMPNM);
    `);

		return jsonOk({ success: true, data: { PNUM: Number(pnum), VDT: vdt } });
	} catch (err) {
		console.error('F11050 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f11050?pnum=&vdt= */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const vdt = toNullableDate(sp.get('vdt'));
		if (!pnum || !vdt) {
			return jsonError({ success: false, error: 'pnum, vdt가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('VDT', sql.Date, vdt);

		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [VDT]) = CONVERT(date, @VDT)
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F11050 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/**
 * @file API /api/f11030 — 사실확인서 F11030
 *
 * @description
 * 사실확인서 F11030 Next.js Route Handler. PK는 ANCD + PNUM + FDT.
 *
 * @module app/api/f11030/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession, getSessionFromRequest } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F11030]';

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
		FDT: toYmd(r.FDT),
		FNUM: r.FNUM,
		FINFO: r.FINFO != null ? String(r.FINFO) : '',
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

/**
 * GET /api/f11030?pnum=&fdt=
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

		const fdt = toNullableDate(sp.get('fdt'));
		if (fdt) {
			request.input('FDT', sql.Date, fdt);
			const result = await request.query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [FDT]) = CONVERT(date, @FDT)
      `);
			return jsonOk({ success: true, data: mapRow(result.recordset?.[0] || null) });
		}

		const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY [FDT] DESC, [FNUM] DESC
    `);
		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F11030 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f11030 — MERGE upsert (PK: ANCD, PNUM, FDT) */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const fdt = toNullableDate(pick(body, 'FDT'));
		const origFdt = toNullableDate(pick(body, 'origFDT') ?? pick(body, 'ORIG_FDT')) || fdt;

		if (pnum == null || String(pnum).trim() === '' || !fdt) {
			return jsonError({ success: false, error: 'PNUM, FDT는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const emp = sessionEmp(req);
		const finfo = String(pick(body, 'FINFO', '') ?? '').slice(0, 1000);
		const etc = pick(body, 'ETC', null);
		const inempno = toNullableInt(pick(body, 'INEMPNO')) ?? emp.empno;
		const inempnm = String(pick(body, 'INEMPNM', '') ?? '').trim() || emp.empnm;
		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		if (origFdt && origFdt !== fdt) {
			const dup = await pool
				.request()
				.input('ANCD', sql.Int, Number(gate.sessionAncd))
				.input('PNUM', sql.Int, Number(pnum))
				.input('FDT', sql.Date, fdt)
				.query(`
          SELECT TOP 1 1 AS X
          FROM ${TABLE_NAME}
          WHERE [ANCD] = @ANCD
            AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
            AND CONVERT(date, [FDT]) = CONVERT(date, @FDT)
        `);
			if (dup.recordset?.[0]) {
				return jsonError({ success: false, error: '변경하려는 작성일자가 이미 존재합니다' }, 409);
			}

			const request = pool.request();
			request.input('ANCD', sql.Int, Number(gate.sessionAncd));
			request.input('PNUM', sql.Int, Number(pnum));
			request.input('ORIG_FDT', sql.Date, origFdt);
			request.input('FDT', sql.Date, fdt);
			request.input('FINFO', sql.VarChar(1000), finfo);
			request.input('ETC', sql.VarChar(100), etc == null ? null : String(etc).slice(0, 100));
			request.input('INEMPNO', sql.Int, inempno);
			request.input('INEMPNM', sql.VarChar(100), inempnm);

			const result = await request.query(`
        UPDATE ${TABLE_NAME}
        SET [FDT] = @FDT,
            [FINFO] = @FINFO,
            [ETC] = @ETC,
            [INEMPNO] = COALESCE(@INEMPNO, [INEMPNO]),
            [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM])
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [FDT]) = CONVERT(date, @ORIG_FDT)
      `);
			const affected = Array.isArray(result.rowsAffected)
				? result.rowsAffected.reduce((a, b) => a + b, 0)
				: 0;
			if (affected === 0) {
				return jsonError({ success: false, error: '수정할 행을 찾지 못했습니다' }, 404);
			}
			return jsonOk({ success: true, data: { PNUM: Number(pnum), FDT: fdt } });
		}

		const nextNumRes = await pool
			.request()
			.input('ANCD', sql.Int, Number(gate.sessionAncd))
			.input('PNUM', sql.Int, Number(pnum))
			.query(`
        SELECT ISNULL(MAX([FNUM]), 0) + 1 AS NEXT_FNUM
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      `);
		const nextFnum = toNullableInt(nextNumRes.recordset?.[0]?.NEXT_FNUM) || 1;

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('FDT', sql.Date, fdt);
		request.input('FNUM', sql.Int, nextFnum);
		request.input('FINFO', sql.VarChar(1000), finfo);
		request.input('INDT', sql.Date, indt);
		request.input('ETC', sql.VarChar(100), etc == null ? null : String(etc).slice(0, 100));
		request.input('INEMPNO', sql.Int, inempno);
		request.input('INEMPNM', sql.VarChar(100), inempnm);

		await request.query(`
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @FDT AS FDT) AS S
        ON (T.[ANCD] = S.[ANCD]
          AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
          AND CONVERT(date, T.[FDT]) = CONVERT(date, S.[FDT]))
      WHEN MATCHED THEN
        UPDATE SET
          [FINFO] = @FINFO,
          [ETC] = @ETC,
          [INEMPNO] = COALESCE(@INEMPNO, [INEMPNO]),
          [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM])
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[PNUM],[FDT],[FNUM],[FINFO],[INDT],[ETC],[INEMPNO],[INEMPNM])
        VALUES (@ANCD, @PNUM, @FDT, @FNUM, @FINFO, @INDT, @ETC, @INEMPNO, @INEMPNM);
    `);

		return jsonOk({ success: true, data: { PNUM: Number(pnum), FDT: fdt } });
	} catch (err) {
		console.error('F11030 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f11030?pnum=&fdt= */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const fdt = toNullableDate(sp.get('fdt'));
		if (!pnum || !fdt) {
			return jsonError({ success: false, error: 'pnum, fdt가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('FDT', sql.Date, fdt);

		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [FDT]) = CONVERT(date, @FDT)
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F11030 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

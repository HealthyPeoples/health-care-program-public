/**
 * @file API /api/f11010 — 직원 기본정보 F11010
 *
 * @description
 * 직원 기본정보 F11010 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f11010/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession, parseUserInfoCookieValue } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F11010]';

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
	const n = parseInt(String(v).replace(/,/g, ''), 10);
	return Number.isFinite(n) ? n : null;
}

function toNullableDate(v) {
	const ymd = toYmd(v);
	return ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function oneChar(v, fallback = '') {
	const s = String(v ?? '').trim();
	return (s || fallback).slice(0, 1);
}

function mapRow(r) {
	if (!r) return null;
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		MEDT: toYmd(r.MEDT),
		REGU: r.REGU != null ? String(r.REGU).trim() : '',
		MEGU: r.MEGU != null ? String(r.MEGU).trim() : '',
		MEGYN: r.MEGYN != null ? String(r.MEGYN).trim() : '',
		MEGDT: toYmd(r.MEGDT),
		MEGAMT: r.MEGAMT != null ? Number(r.MEGAMT) : null,
		MERDSC1: r.MERDSC1 != null ? String(r.MERDSC1) : '',
		MERDSC2: r.MERDSC2 != null ? String(r.MERDSC2) : '',
		INDT: toYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNO: r.INEMPNO,
		INEMPNM: r.INEMPNM != null ? String(r.INEMPNM) : '',
		REEMPNM: r.REEMPNM != null ? String(r.REEMPNM) : '',
		MENM: r.MENM != null ? String(r.MENM) : '',
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

function bindRecordInputs(request, body, { medt, inempno, indt }) {
	request.input('MEDT', sql.Date, medt);
	request.input('REGU', sql.Char(1), oneChar(pick(body, 'REGU'), '1') || '1');
	request.input('MEGU', sql.Char(1), oneChar(pick(body, 'MEGU'), '2') || '2');
	request.input('MEGYN', sql.Char(1), oneChar(pick(body, 'MEGYN'), '2') || '2');
	request.input('MEGDT', sql.Date, toNullableDate(pick(body, 'MEGDT')));
	request.input('MEGAMT', sql.Int, toNullableInt(pick(body, 'MEGAMT')));
	request.input('MERDSC1', sql.VarChar(200), String(pick(body, 'MERDSC1', '') ?? '').trim().slice(0, 200) || null);
	request.input('MERDSC2', sql.VarChar(200), String(pick(body, 'MERDSC2', '') ?? '').trim().slice(0, 200) || null);
	request.input('ETC', sql.VarChar(100), String(pick(body, 'ETC', '') ?? '').trim().slice(0, 100) || null);
	request.input('INEMPNO', sql.Int, inempno);
	request.input('INEMPNM', sql.VarChar(100), String(pick(body, 'INEMPNM', '') ?? '').trim().slice(0, 100) || null);
	request.input('REEMPNM', sql.VarChar(50), String(pick(body, 'REEMPNM', '') ?? '').trim().slice(0, 50) || null);
	request.input('MENM', sql.VarChar(100), String(pick(body, 'MENM', '') ?? '').trim().slice(0, 100) || null);
	if (indt) request.input('INDT', sql.Date, indt);
}

/**
 * GET /api/f11010?pnum=&startDate=&endDate=
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

		const startDate = toNullableDate(sp.get('startDate'));
		const endDate = toNullableDate(sp.get('endDate'));

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));

		let where = `
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
    `;
		if (startDate) {
			request.input('START', sql.Date, startDate);
			where += ` AND CONVERT(date, [MEDT]) >= CONVERT(date, @START)`;
		}
		if (endDate) {
			request.input('END', sql.Date, endDate);
			where += ` AND CONVERT(date, [MEDT]) <= CONVERT(date, @END)`;
		}

		const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      ${where}
      ORDER BY [MEDT] DESC
    `);

		const data = (result.recordset || []).map(mapRow);
		const summary = data.reduce(
			(acc, row) => {
				const amt = Number(row.MEGAMT) || 0;
				acc.totalFee += amt;
				if (String(row.MEGYN) === '1') acc.collected += amt;
				else acc.unpaid += amt;
				return acc;
			},
			{ totalFee: 0, collected: 0, unpaid: 0, count: data.length }
		);

		return jsonOk({ success: true, data, count: data.length, summary });
	} catch (err) {
		console.error('F11010 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f11010 — 신규 등록 */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const medt = toNullableDate(pick(body, 'MEDT'));

		if (pnum == null || String(pnum).trim() === '' || !medt) {
			return jsonError({ success: false, error: 'PNUM, MEDT는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const inempno = await resolveInEmpno(pool, gate.sessionAncd, req, body);

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		bindRecordInputs(request, body, { medt, inempno, indt });

		try {
			await request.query(`
        INSERT INTO ${TABLE_NAME}
          ([ANCD],[PNUM],[MEDT],[REGU],[MEGU],[MEGYN],[MEGDT],[MEGAMT],
           [MERDSC1],[MERDSC2],[INDT],[ETC],[INEMPNO],[INEMPNM],[REEMPNM],[MENM])
        VALUES
          (@ANCD,@PNUM,@MEDT,@REGU,@MEGU,@MEGYN,@MEGDT,@MEGAMT,
           @MERDSC1,@MERDSC2,@INDT,@ETC,@INEMPNO,@INEMPNM,@REEMPNM,@MENM)
      `);
		} catch (insertErr) {
			if (String(insertErr?.number) === '2627' || /PRIMARY KEY|duplicate/i.test(String(insertErr?.message || ''))) {
				return jsonError({ success: false, error: '동일 진료일자의 내역이 이미 등록되어 있습니다' }, 409);
			}
			throw insertErr;
		}

		return jsonOk({ success: true, data: { PNUM: Number(pnum), MEDT: medt } });
	} catch (err) {
		console.error('F11010 추가 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** PUT /api/f11010 — 수정 (origMEDT로 PK 지정) */
export async function PUT(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const origMedt = toNullableDate(pick(body, 'origMEDT') ?? pick(body, 'MEDT'));
		const medt = toNullableDate(pick(body, 'MEDT')) || origMedt;

		if (pnum == null || String(pnum).trim() === '' || !origMedt || !medt) {
			return jsonError({ success: false, error: 'PNUM, MEDT는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const inempno = await resolveInEmpno(pool, gate.sessionAncd, req, body);
		const keyChanged = origMedt !== medt;

		if (keyChanged) {
			const dup = await pool
				.request()
				.input('ANCD', sql.Int, Number(gate.sessionAncd))
				.input('PNUM', sql.Int, Number(pnum))
				.input('MEDT', sql.Date, medt)
				.query(`
          SELECT TOP 1 1 AS X
          FROM ${TABLE_NAME}
          WHERE [ANCD] = @ANCD
            AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
            AND CONVERT(date, [MEDT]) = CONVERT(date, @MEDT)
        `);
			if (dup.recordset?.[0]) {
				return jsonError({ success: false, error: '변경하려는 진료일자가 이미 존재합니다' }, 409);
			}
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('ORIG_MEDT', sql.Date, origMedt);
		bindRecordInputs(request, body, { medt, inempno, indt: null });

		const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET [MEDT] = @MEDT,
          [REGU] = @REGU,
          [MEGU] = @MEGU,
          [MEGYN] = @MEGYN,
          [MEGDT] = @MEGDT,
          [MEGAMT] = @MEGAMT,
          [MERDSC1] = @MERDSC1,
          [MERDSC2] = @MERDSC2,
          [ETC] = @ETC,
          [INEMPNO] = COALESCE(@INEMPNO, [INEMPNO]),
          [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM]),
          [REEMPNM] = @REEMPNM,
          [MENM] = @MENM
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [MEDT]) = CONVERT(date, @ORIG_MEDT)
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '수정할 행을 찾지 못했습니다' }, 404);
		}

		return jsonOk({ success: true, affected, data: { PNUM: Number(pnum), MEDT: medt } });
	} catch (err) {
		console.error('F11010 수정 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f11010?pnum=&medt= */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const medt = toNullableDate(sp.get('medt'));
		if (!pnum || !medt) {
			return jsonError({ success: false, error: 'pnum, medt가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('MEDT', sql.Date, medt);

		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [MEDT]) = CONVERT(date, @MEDT)
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}

		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F11010 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/**
 * @file API /api/f11070 — 직원 연차 F11070
 *
 * @description
 * 직원 연차 F11070 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f11070/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F11070]';

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
		HPDT: toYmd(r.HPDT),
		HPDES1: r.HPDES1 != null ? String(r.HPDES1) : '',
		HPDES2: r.HPDES2 != null ? String(r.HPDES2) : '',
		HPDTR: r.HPDTR != null ? String(r.HPDTR) : '',
		HP_GU: r.HP_GU != null ? String(r.HP_GU).trim() : '',
		HP_TERM_TM: r.HP_TERM_TM != null ? String(r.HP_TERM_TM) : '',
		HP_CNT: r.HP_CNT,
		HP_AMT: r.HP_AMT,
		HP_PRE_AMT: r.HP_PRE_AMT,
		HP_PAY_DT: toYmd(r.HP_PAY_DT),
		HP_PAY_AMT: r.HP_PAY_AMT,
		INDT: toYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNO: r.INEMPNO,
		INEMPNM: r.INEMPNM != null ? String(r.INEMPNM) : '',
		// 조인 시
		P_NM: r.P_NM != null ? String(r.P_NM) : '',
		P_SEX: r.P_SEX != null ? String(r.P_SEX).trim() : '',
		P_BRDT: toYmd(r.P_BRDT),
	};
}

/**
 * GET /api/f11070?pnum=&hpdt=&mode=dates|range&startDate=&endDate=
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const mode = String(sp.get('mode') || '').trim();
		const hpdt = toYmd(sp.get('hpdt'));
		const startDate = toNullableDate(sp.get('startDate'));
		const endDate = toNullableDate(sp.get('endDate'));

		if (!pnum && mode !== 'range') {
			return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));

		if (mode === 'dates') {
			request.input('PNUM', sql.Int, Number(pnum));
			const result = await request.query(`
        SELECT DISTINCT CONVERT(varchar(10), [HPDT], 120) AS HPDT
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        ORDER BY HPDT DESC
      `);
			const data = (result.recordset || []).map((r) => ({ HPDT: toYmd(r.HPDT) })).filter((r) => r.HPDT);
			return jsonOk({ success: true, data, count: data.length });
		}

		if (mode === 'range') {
			if (!startDate || !endDate) {
				return jsonError({ success: false, error: 'startDate, endDate가 필요합니다' }, 400);
			}
			request.input('startDate', sql.Date, startDate);
			request.input('endDate', sql.Date, endDate);
			let q = `
        SELECT f.*, f10010.[P_NM], f10010.[P_SEX], f10010.[P_BRDT]
        FROM ${TABLE_NAME} f
        LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010
          ON f.[ANCD] = f10010.[ANCD] AND CAST(f.[PNUM] AS VARCHAR) = CAST(f10010.[PNUM] AS VARCHAR)
        WHERE f.[ANCD] = @ANCD
          AND CONVERT(date, f.[HPDT]) BETWEEN CONVERT(date, @startDate) AND CONVERT(date, @endDate)
      `;
			if (pnum) {
				request.input('PNUM', sql.Int, Number(pnum));
				q += ` AND CAST(f.[PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)`;
			}
			q += ` ORDER BY f10010.[P_NM] ASC, f.[HPDT] ASC`;
			const result = await request.query(q);
			const data = (result.recordset || []).map(mapRow);
			return jsonOk({ success: true, data, count: data.length });
		}

		request.input('PNUM', sql.Int, Number(pnum));

		if (hpdt) {
			request.input('HPDT', sql.Date, hpdt);
			const result = await request.query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [HPDT]) = CONVERT(date, @HPDT)
      `);
			return jsonOk({ success: true, data: mapRow(result.recordset?.[0] || null) });
		}

		const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY [HPDT] DESC
    `);
		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F11070 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f11070 — MERGE upsert */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const hpdt = toNullableDate(pick(body, 'HPDT'));

		if (pnum == null || String(pnum).trim() === '' || !hpdt) {
			return jsonError({ success: false, error: 'PNUM, HPDT는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const hpGu = String(pick(body, 'HP_GU', '2') ?? '2').trim().slice(0, 1);

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('HPDT', sql.Date, hpdt);
		request.input('HPDES1', sql.NVarChar(1000), pick(body, 'HPDES1', '') ?? '');
		request.input('HPDES2', sql.NVarChar(1000), pick(body, 'HPDES2', '') ?? '');
		request.input('HPDTR', sql.VarChar(50), pick(body, 'HPDTR', null));
		request.input('HP_GU', sql.Char(1), hpGu || '2');
		request.input('HP_TERM_TM', sql.VarChar(50), pick(body, 'HP_TERM_TM', null));
		request.input('HP_CNT', sql.Int, toNullableInt(pick(body, 'HP_CNT')));
		request.input('HP_AMT', sql.Int, toNullableInt(pick(body, 'HP_AMT')));
		request.input('HP_PRE_AMT', sql.Int, toNullableInt(pick(body, 'HP_PRE_AMT')));
		request.input('HP_PAY_DT', sql.Date, toNullableDate(pick(body, 'HP_PAY_DT')));
		request.input('HP_PAY_AMT', sql.Int, toNullableInt(pick(body, 'HP_PAY_AMT')));
		request.input('INDT', sql.Date, indt);
		request.input('ETC', sql.NVarChar(1000), pick(body, 'ETC', null));
		request.input('INEMPNM', sql.VarChar(100), pick(body, 'INEMPNM', null));

		await request.query(`
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @HPDT AS HPDT) AS S
        ON (T.[ANCD] = S.[ANCD]
          AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
          AND CONVERT(date, T.[HPDT]) = CONVERT(date, S.[HPDT]))
      WHEN MATCHED THEN
        UPDATE SET
          [HPDES1] = @HPDES1,
          [HPDES2] = @HPDES2,
          [HPDTR] = @HPDTR,
          [HP_GU] = @HP_GU,
          [HP_TERM_TM] = @HP_TERM_TM,
          [HP_CNT] = @HP_CNT,
          [HP_AMT] = @HP_AMT,
          [HP_PRE_AMT] = @HP_PRE_AMT,
          [HP_PAY_DT] = @HP_PAY_DT,
          [HP_PAY_AMT] = @HP_PAY_AMT,
          [ETC] = @ETC,
          [INEMPNM] = COALESCE(@INEMPNM, [INEMPNM])
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD],[PNUM],[HPDT],[HPDES1],[HPDES2],[HPDTR],[HP_GU],[HP_TERM_TM],
          [HP_CNT],[HP_AMT],[HP_PRE_AMT],[HP_PAY_DT],[HP_PAY_AMT],[INDT],[ETC],[INEMPNM]
        )
        VALUES (
          @ANCD,@PNUM,@HPDT,@HPDES1,@HPDES2,@HPDTR,@HP_GU,@HP_TERM_TM,
          @HP_CNT,@HP_AMT,@HP_PRE_AMT,@HP_PAY_DT,@HP_PAY_AMT,@INDT,@ETC,@INEMPNM
        );
    `);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F11070 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f11070?pnum=&hpdt= */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const hpdt = toNullableDate(sp.get('hpdt'));
		if (!pnum || !hpdt) {
			return jsonError({ success: false, error: 'pnum, hpdt가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('HPDT', sql.Date, hpdt);

		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [HPDT]) = CONVERT(date, @HPDT)
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F11070 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

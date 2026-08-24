/**
 * @file API /api/f32030 — 물리치료실적평가 F32030
 *
 * @description
 * 물리치료실적평가 F32030 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f32030/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { normalizeYmdShort as normalizeYmd } from '../../../utils/normalizeYmd';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F32030]';

const CHAR_KEYS = [
	...Array.from({ length: 11 }, (_, i) => `APPR${String(i + 1).padStart(2, '0')}`),
	...Array.from({ length: 8 }, (_, i) => `APPR${String(i + 21)}`),
	...Array.from({ length: 6 }, (_, i) => `APPR${String(i + 31)}`),
];

function pickBody(body, k, fallback = null) {
	if (!body || typeof body !== 'object') return fallback;
	if (Object.prototype.hasOwnProperty.call(body, k)) return body[k];
	const alt = k.toLowerCase();
	if (alt !== k && Object.prototype.hasOwnProperty.call(body, alt)) return body[alt];
	return fallback;
}

function char1(v, fallback = '0') {
	if (v == null || v === '') return fallback;
	const s = String(v).trim();
	return s ? s.slice(0, 1) : fallback;
}

function parseIntOrNull(v) {
	if (v == null || v === '') return null;
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : null;
}

function attachRow(row) {
	if (!row) return null;
	let adt = '';
	if (row.ADT instanceof Date && !Number.isNaN(row.ADT.getTime())) {
		const y = row.ADT.getUTCFullYear();
		const m = String(row.ADT.getUTCMonth() + 1).padStart(2, '0');
		const d = String(row.ADT.getUTCDate()).padStart(2, '0');
		adt = `${y}-${m}-${d}`;
	} else {
		const s = String(row.ADT ?? '').trim();
		if (/^\d{4}-\d{2}-\d{2}/.test(s)) adt = s.slice(0, 10);
		else if (s.includes('T')) adt = s.split('T')[0].slice(0, 10);
		else if (/^\d{8}$/.test(s)) adt = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
		else {
			const parsed = new Date(s);
			if (!Number.isNaN(parsed.getTime())) {
				const y = parsed.getFullYear();
				const m = String(parsed.getMonth() + 1).padStart(2, '0');
				const d = String(parsed.getDate()).padStart(2, '0');
				adt = `${y}-${m}-${d}`;
			}
		}
	}
	return { ...row, ADT: adt, EVALDT: adt };
}

function adlTotalFromBody(body) {
	const keys = ['APPR31', 'APPR32', 'APPR33', 'APPR34', 'APPR35', 'APPR36'];
	return keys.reduce((sum, k) => sum + (parseInt(char1(pickBody(body, k, '0'), '0'), 10) || 0), 0);
}

// GET /api/f32030?pnum=PNUM&adt=YYYY-MM-DD (optional)
export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const pnum = searchParams.get('pnum');
		const adtRaw = searchParams.get('adt') || searchParams.get('evaldt');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum) {
			return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));

		const adt = normalizeYmd(adtRaw);
		if (adt) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(adt)) {
				return jsonError({ success: false, error: 'adt는 YYYY-MM-DD 형식이어야 합니다' }, 400);
			}
			request.input('ADT', adt);
			const result = await request.query(`
        SELECT
          [ANCD],
          [PNUM],
          CONVERT(varchar(10), [ADT], 23) AS [ADT],
          [APEMP],
          [APPR01],[APPR02],[APPR03],[APPR04],[APPR05],[APPR06],[APPR07],[APPR08],[APPR09],[APPR10],[APPR11],[APPR12],
          [APPR21],[APPR22],[APPR23],[APPR24],[APPR25],[APPR26],[APPR27],[APPR28],
          [APPR31],[APPR32],[APPR33],[APPR34],[APPR35],[APPR36],
          [APPR90],[APPR91]
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [ADT]) = CONVERT(date, @ADT)
      `);
			return jsonOk({ success: true, data: attachRow(result?.recordset?.[0] || null) });
		}

		const result = await request.query(`
      SELECT
        [ANCD],
        [PNUM],
        CONVERT(varchar(10), [ADT], 23) AS [ADT],
        [APEMP],
        [APPR01],[APPR02],[APPR03],[APPR04],[APPR05],[APPR06],[APPR07],[APPR08],[APPR09],[APPR10],[APPR11],[APPR12],
        [APPR21],[APPR22],[APPR23],[APPR24],[APPR25],[APPR26],[APPR27],[APPR28],
        [APPR31],[APPR32],[APPR33],[APPR34],[APPR35],[APPR36],
        [APPR90],[APPR91]
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY [ADT] DESC
    `);
		const data = (result.recordset || []).map((r) => attachRow(r));
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F32030 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

// POST /api/f32030
// body: { PNUM, ADT|EVALDT, APEMP, APPR01~11, APPR21~28, APPR31~36, APPR90, APPR91 }
export async function POST(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancdParam = searchParams.get('ancd');

		const gate = assertAnCdMatchesSession(req, ancdParam || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pickBody(body, 'PNUM', null);
		const adtRaw = pickBody(body, 'ADT', pickBody(body, 'EVALDT', null));

		if (!pnum || !adtRaw) {
			return jsonError({ success: false, error: 'PNUM, ADT는 필수입니다' }, 400);
		}

		const adt = normalizeYmd(adtRaw);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(adt)) {
			return jsonError({ success: false, error: 'ADT는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));
		request.input('ADT', adt);

		const apemp = pickBody(body, 'APEMP', pickBody(body, 'evaluator', null));
		request.input('APEMP', sql.NVarChar(10), apemp == null || apemp === '' ? null : String(apemp).slice(0, 10));

		CHAR_KEYS.forEach((k) => {
			request.input(k, sql.Char(1), char1(pickBody(body, k, '0'), '0'));
		});

		const appr90Raw = pickBody(body, 'APPR90', pickBody(body, 'totalScore', null));
		const appr90 = parseIntOrNull(appr90Raw);
		request.input('APPR90', sql.Int, appr90 == null ? adlTotalFromBody(body) : appr90);

		const appr91 = pickBody(body, 'APPR91', pickBody(body, 'evaluationNotes', null));
		request.input('APPR91', sql.NVarChar(sql.MAX), appr91 == null || appr91 === '' ? null : String(appr91));

		const editableKeys = ['APEMP', ...CHAR_KEYS, 'APPR90', 'APPR91'];
		const setSql = editableKeys.map((k) => `T.[${k}] = @${k}`).join(',\n          ');
		const insertCols = editableKeys.map((k) => `[${k}]`).join(',');
		const insertVals = editableKeys.map((k) => `@${k}`).join(',');

		const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, CONVERT(date, @ADT) AS ADT) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
            AND CONVERT(date, T.[ADT]) = S.[ADT])
      WHEN MATCHED THEN
        UPDATE SET
          ${setSql}
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[PNUM],[ADT],${insertCols})
        VALUES (@ANCD,@PNUM,CONVERT(date, @ADT),${insertVals});
    `;

		await request.query(query);
		return jsonOk({ success: true });
	} catch (err) {
		console.error('F32030 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

// DELETE /api/f32030?pnum=PNUM&adt=YYYY-MM-DD
export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const pnum = searchParams.get('pnum');
		const adtRaw = searchParams.get('adt') || searchParams.get('evaldt');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum || !adtRaw) {
			return jsonError({ success: false, error: 'pnum, adt 파라미터가 필요합니다' }, 400);
		}

		const adt = normalizeYmd(adtRaw);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(adt)) {
			return jsonError({ success: false, error: 'adt는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));
		request.input('ADT', adt);

		await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [ADT]) = CONVERT(date, @ADT)
    `);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F32030 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

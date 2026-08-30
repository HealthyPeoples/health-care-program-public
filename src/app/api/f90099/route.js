/**
 * @file API /api/f90099 — 입출금 전표 F90099
 *
 * @description
 * 입출금 전표 F90099 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f90099/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const sql = require('mssql');

const { normalizeYmdOrNull: normalizeYmd } = require('../../../utils/normalizeYmd');
const TABLE = '[돌봄시설DB].[dbo].[F90099]';
const ACCOUNT = '[돌봄시설DB].[dbo].[F90030]';

function inputDate(request, name, ymd) {
	const n = normalizeYmd(ymd);
	if (n === null) {
		request.input(name, sql.Date, null);
	} else {
		request.input(name, sql.Date, new Date(`${n}T00:00:00`));
	}
}

function parseAmount(v) {
	if (v == null || v === '') return 0;
	const n = parseFloat(String(v).replace(/,/g, ''));
	return Number.isFinite(n) ? n : 0;
}

function parseIntOrNull(v) {
	if (v == null || v === '') return null;
	const n = parseInt(String(v), 10);
	return Number.isNaN(n) ? null : n;
}

function sliceStr(v, max) {
	if (v == null) return null;
	const s = String(v).trim();
	if (!s) return null;
	return s.slice(0, max);
}

function mapRow(r) {
	return {
		...r,
		ANCD: r.ANCD,
		DOC: r.DOC,
		AMT: r.AMT == null ? 0 : Number(r.AMT),
		OBJ3: r.OBJ3 != null ? String(r.OBJ3).trim() : '',
		OBJ3NM: r.OBJ3NM != null ? String(r.OBJ3NM).trim() : '',
		OBJETC: r.OBJETC != null ? String(r.OBJETC).trim() : '',
		ANI: r.ANI != null ? String(r.ANI).trim() : '',
		DOC_TYPE: r.DOC_TYPE === 'out' ? 'out' : 'in',
		GLDT: normalizeYmd(r.GLDT),
		DES: r.DES != null ? String(r.DES) : '',
		INDT: normalizeYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		URDT: normalizeYmd(r.URDT),
		INVNM: r.INVNM != null ? String(r.INVNM) : '',
		INVNM1: r.INVNM1 != null ? String(r.INVNM1) : '',
		INVOJ: r.INVOJ != null ? String(r.INVOJ) : '',
		INVDT: normalizeYmd(r.INVDT),
		EMPNO: r.EMPNO,
		EMPNM: r.EMPNM != null ? String(r.EMPNM) : '',
		SALMM: r.SALMM != null ? String(r.SALMM).trim() : '',
		PNUM: r.PNUM,
		INSDT: normalizeYmd(r.INSDT),
	};
}

const DOC_TYPE_EXPR = `
  CASE
    WHEN T.[AMT] < 0 THEN 'out'
    WHEN UPPER(LEFT(LTRIM(RTRIM(ISNULL(A.[ANI], ''))), 1)) IN ('I', '1') THEN 'in'
    WHEN UPPER(LEFT(LTRIM(RTRIM(ISNULL(A.[ANI], ''))), 1)) IN ('E', 'O', '2') THEN 'out'
    WHEN UPPER(LEFT(LTRIM(RTRIM(ISNULL(T.[OBJ3], ''))), 1)) = 'I' THEN 'in'
    WHEN UPPER(LEFT(LTRIM(RTRIM(ISNULL(T.[OBJ3], ''))), 1)) IN ('E', 'O') THEN 'out'
    WHEN A.[OBJ3NM] LIKE N'%수입%' OR A.[OBJ3NM] LIKE N'%입금%' THEN 'in'
    WHEN A.[OBJ3NM] LIKE N'%지출%' OR A.[OBJ3NM] LIKE N'%출금%' OR A.[OBJ3NM] LIKE N'%급여%' THEN 'out'
    ELSE 'in'
  END
`;

/** GET — 세션 ANCD 기준 전표 목록 (from, to, type=in|out|all) */
export async function GET(req) {
	try {
		const ancd = req.nextUrl.searchParams.get('ancd');
		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const from = normalizeYmd(req.nextUrl.searchParams.get('from'));
		const to = normalizeYmd(req.nextUrl.searchParams.get('to'));
		const typeRaw = String(req.nextUrl.searchParams.get('type') || 'all').trim().toLowerCase();
		const type = typeRaw === 'in' || typeRaw === 'out' ? typeRaw : 'all';

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('sessionAncd', gate.sessionAncd);

		let where = 'WHERE T.[ANCD] = @sessionAncd';
		if (from) {
			inputDate(request, 'fromDt', from);
			where += ' AND T.[GLDT] >= @fromDt';
		}
		if (to) {
			inputDate(request, 'toDt', to);
			where += ' AND T.[GLDT] <= @toDt';
		}
		if (type !== 'all') {
			request.input('docType', sql.VarChar(3), type);
			where += ` AND (${DOC_TYPE_EXPR}) = @docType`;
		}

		const result = await request.query(`
      SELECT
        T.[ANCD], T.[DOC], T.[AMT], T.[OBJ3], T.[GLDT], T.[DES], T.[INDT], T.[ETC], T.[URDT],
        T.[INVNM], T.[INVNM1], T.[INVOJ], T.[INVDT], T.[EMPNO], T.[EMPNM],
        T.[SALMM], T.[PNUM], T.[INSDT],
        A.[OBJ3NM], A.[ETC] AS [OBJETC], A.[ANI],
        (${DOC_TYPE_EXPR}) AS [DOC_TYPE]
      FROM ${TABLE} T
      LEFT JOIN ${ACCOUNT} A ON LTRIM(RTRIM(A.[OBJ3])) = LTRIM(RTRIM(T.[OBJ3]))
        AND ISNULL(A.[DEL], '') <> 'D'
      ${where}
      ORDER BY T.[GLDT] DESC, T.[DOC] DESC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F90099 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

/** POST { action?: 'delete', DOC?, AMT, OBJ3, GLDT, ... } */
export async function POST(req) {
	try {
		const gate = assertAnCdMatchesSession(req, null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const action = body.action === 'delete' ? 'delete' : 'save';

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		if (action === 'delete') {
			const doc = parseIntOrNull(body.DOC ?? body.doc);
			if (doc == null) {
				return jsonError({ success: false, error: '출납번호(DOC)가 필요합니다.' }, 400);
			}
			const rq = pool.request();
			rq.input('ANCD', sql.Int, gate.sessionAncd);
			rq.input('DOC', sql.Int, doc);
			const del = await rq.query(`
        DELETE FROM ${TABLE}
        WHERE [ANCD] = @ANCD AND [DOC] = @DOC
      `);
			if (!del.rowsAffected?.[0]) {
				return jsonError({ success: false, error: '삭제할 전표가 없습니다.' }, 404);
			}
			return jsonOk({ success: true, action: 'delete' });
		}

		const gldt = normalizeYmd(body.GLDT ?? body.gldt);
		const obj3 = sliceStr(body.OBJ3 ?? body.obj3, 10);
		if (!gldt) {
			return jsonError({ success: false, error: '전표일자(GLDT)가 필요합니다.' }, 400);
		}
		if (!obj3) {
			return jsonError({ success: false, error: '계정과목(OBJ3)이 필요합니다.' }, 400);
		}

		const docType = String(body.docType ?? body.DOC_TYPE ?? 'in').toLowerCase() === 'out' ? 'out' : 'in';
		const absAmt = Math.abs(parseAmount(body.AMT ?? body.amt));
		const amt = docType === 'out' ? -absAmt : absAmt;

		const existingDoc = parseIntOrNull(body.DOC ?? body.doc);
		let doc = existingDoc;
		if (doc == null) {
			const next = await pool
				.request()
				.input('ANCD', sql.Int, gate.sessionAncd)
				.query(`
          SELECT ISNULL(MAX([DOC]), 0) + 1 AS NEXT_DOC
          FROM ${TABLE}
          WHERE [ANCD] = @ANCD
        `);
			doc = next.recordset?.[0]?.NEXT_DOC ?? 1;
		}

		const empno = parseIntOrNull(body.EMPNO ?? body.empno);
		const pnum = parseIntOrNull(body.PNUM ?? body.pnum);
		const salmmRaw = body.SALMM ?? body.salmm;
		const salmm = salmmRaw == null || String(salmmRaw).trim() === ''
			? null
			: String(salmmRaw).replace(/\D/g, '').slice(0, 6);

		const rq = pool.request();
		rq.input('ANCD', sql.Int, gate.sessionAncd);
		rq.input('DOC', sql.Int, doc);
		rq.input('AMT', sql.Float, amt);
		rq.input('OBJ3', sql.VarChar(10), obj3);
		inputDate(rq, 'GLDT', gldt);
		rq.input('DES', sql.VarChar(200), sliceStr(body.DES ?? body.des, 200));
		rq.input('ETC', sql.VarChar(100), sliceStr(body.ETC ?? body.etc, 100));
		rq.input('INVNM', sql.VarChar(200), sliceStr(body.INVNM ?? body.invnm, 200));
		rq.input('INVNM1', sql.VarChar(100), sliceStr(body.INVNM1 ?? body.invnm1, 100));
		rq.input('INVOJ', sql.VarChar(50), sliceStr(body.INVOJ ?? body.invoj, 50));
		inputDate(rq, 'INVDT', body.INVDT ?? body.invdt);
		rq.input('EMPNO', sql.Int, empno);
		rq.input('EMPNM', sql.VarChar(100), sliceStr(body.EMPNM ?? body.empnm, 100));
		rq.input('SALMM', sql.Char(6), salmm);
		rq.input('PNUM', sql.Int, pnum);
		inputDate(rq, 'INSDT', body.INSDT ?? body.insdt);

		await rq.query(`
      MERGE ${TABLE} AS T
      USING (SELECT @ANCD AS ANCD, @DOC AS DOC) AS S
        ON T.[ANCD] = S.[ANCD] AND T.[DOC] = S.[DOC]
      WHEN MATCHED THEN
        UPDATE SET
          [AMT] = @AMT,
          [OBJ3] = @OBJ3,
          [GLDT] = @GLDT,
          [DES] = @DES,
          [ETC] = @ETC,
          [INVNM] = @INVNM,
          [INVNM1] = @INVNM1,
          [INVOJ] = @INVOJ,
          [INVDT] = @INVDT,
          [EMPNO] = @EMPNO,
          [EMPNM] = @EMPNM,
          [SALMM] = @SALMM,
          [PNUM] = @PNUM,
          [INSDT] = @INSDT,
          [URDT] = CONVERT(date, GETDATE())
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD], [DOC], [AMT], [OBJ3], [GLDT], [DES], [INDT], [ETC], [URDT],
          [INVNM], [INVNM1], [INVOJ], [INVDT], [EMPNO], [EMPNM], [SALMM], [PNUM], [INSDT]
        )
        VALUES (
          @ANCD, @DOC, @AMT, @OBJ3, @GLDT, @DES, CONVERT(date, GETDATE()), @ETC, CONVERT(date, GETDATE()),
          @INVNM, @INVNM1, @INVOJ, @INVDT, @EMPNO, @EMPNM, @SALMM, @PNUM, @INSDT
        );
    `);

		return jsonOk({ success: true, action: 'save', DOC: doc });
	} catch (err) {
		console.error('F90099 저장/삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

/**
 * @file API /api/f11080 — 직원 교육/회의 F11080
 *
 * @description
 * 직원 교육/회의 F11080 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f11080/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { normalizeYmdEmpty as normalizeYmd } from '../../../utils/normalizeYmd';
import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F11080]';

const VARCHAR_LIMITS = {
	EMPL: 200,
	EMTM: 5,
	EMDES1: 500,
	EMDES2: 500,
	EMDES3: 500,
	EMHOS: 200,
	EMETC: 500,
	EMRES: 500,
	EMEMP: 60,
	ETC: 1000,
	INEMPNM: 100,
};

function toVarchar(value, max) {
	if (value == null || value === '') return null;
	return String(value).slice(0, max);
}


export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');

    const gate = assertAnCdMatchesSession(req, ancd);
    if (!gate.ok) return gate.response;

    if (!ancd || !pnum) {
      return jsonError({ success: false, error: 'ANCD와 PNUM 파라미터가 필요합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ancd', ancd);
    request.input('pnum', String(pnum));

    const query = `
      SELECT
        [ANCD],
        [PNUM],
        [EMDT],
        [EMPL],
        [EMTM],
        [EMDES1],
        [EMDES2],
        [EMDES3],
        [EMHOS],
        [EMETC],
        [EMRES],
        [EMEMP],
        [INDT],
        [ETC],
        [INEMPNO],
        [INEMPNM]
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ancd
        AND CAST([PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)
      ORDER BY [EMDT] DESC, [INDT] DESC
    `;

    const result = await request.query(query);
    const data = (result.recordset || []).map((r) => ({
      ...r,
      EMDT: normalizeYmd(r.EMDT),
      INDT: normalizeYmd(r.INDT),
    }));

    return jsonOk({ success: true, data, count: data.length });
  } catch (err) {
    console.error('F11080 테이블 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancdParam = searchParams.get('ancd');

    const gate = assertAnCdMatchesSession(req, ancdParam);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const ancd = body?.ANCD ?? ancdParam ?? gate.sessionAncd;
    const pnum = body?.PNUM;
    const emdt = body?.EMDT;

    if (!ancd || !pnum || !emdt) {
      return jsonError({ success: false, error: 'ANCD, PNUM, EMDT는 필수입니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', sql.Int, Number(ancd));
    request.input('PNUM', sql.Int, Number(pnum));
    request.input('EMDT', sql.VarChar(10), String(emdt).slice(0, 10)); // 'YYYY-MM-DD'

    const pick = (k) => (Object.prototype.hasOwnProperty.call(body || {}, k) ? body[k] : null);

    const editableKeys = [
      'EMPL',
      'EMTM',
      'EMDES1',
      'EMDES2',
      'EMDES3',
      'EMHOS',
      'EMETC',
      'EMRES',
      'EMEMP',
      'ETC',
      'INEMPNO',
      'INEMPNM',
    ];

    editableKeys.forEach((k) => {
      if (k === 'INEMPNO') {
        const n = pick(k);
        request.input(k, sql.Int, n == null || n === '' ? null : Number(n));
        return;
      }
      const max = VARCHAR_LIMITS[k];
      request.input(k, sql.NVarChar(max), toVarchar(pick(k), max));
    });

    const setSql = editableKeys
      .map((k) => `T.[${k}] = @${k}`)
      .concat(['T.[INDT] = GETDATE()'])
      .join(',\n          ');

    const insertCols = editableKeys.map((k) => `[${k}]`).concat(['[INDT]']).join(',');
    const insertVals = editableKeys.map((k) => `@${k}`).concat(['GETDATE()']).join(',');

    const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, CONVERT(date, @EMDT) AS EMDT) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
            AND CONVERT(date, T.[EMDT]) = S.[EMDT])
      WHEN MATCHED THEN
        UPDATE SET
          ${setSql}
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[PNUM],[EMDT],${insertCols})
        VALUES (@ANCD,@PNUM,CONVERT(date, @EMDT),${insertVals});
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F11080 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

export async function DELETE(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');
    const emdt = searchParams.get('emdt');

    const gate = assertAnCdMatchesSession(req, ancd);
    if (!gate.ok) return gate.response;

    if (!ancd || !pnum || !emdt) {
      return jsonError({ success: false, error: 'ancd, pnum, emdt 파라미터가 필요합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', ancd);
    request.input('PNUM', String(pnum));
    request.input('EMDT', String(emdt).slice(0, 10));

    const query = `
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [EMDT]) = CONVERT(date, @EMDT)
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F11080 삭제 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}


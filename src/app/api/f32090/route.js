/**
 * @file API /api/f32090 — 건강/간호 관련 F32090
 *
 * @description
 * 건강/간호 관련 F32090 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f32090/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F32090]';

export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd'); // optional

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
      ORDER BY [INDT] DESC
    `);

    const row = result?.recordset?.[0] || null;
    return jsonOk({ success: true, data: row });
  } catch (err) {
    console.error('F32090 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancdParam = searchParams.get('ancd'); // optional

    const gate = assertAnCdMatchesSession(req, ancdParam || null);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);

    const editableKeys = [
      ...Array.from({ length: 12 }, (_, i) => `SVAL${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 6 }, (_, i) => `SVAL${String(i + 21)}`),
      ...Array.from({ length: 7 }, (_, i) => `SVAL${String(i + 31)}`),
      'ETC',
      'INEMPNO',
      'INEMPNM',
    ];

    const pick = (k) => (Object.prototype.hasOwnProperty.call(body || {}, k) ? body[k] : null);
    editableKeys.forEach((k) => request.input(k, pick(k) == null ? null : String(pick(k))));

    const setSql = editableKeys
      .map((k) => `T.[${k}] = @${k}`)
      .concat(['T.[INDT] = GETDATE()'])
      .join(',\n          ');

    const insertCols = editableKeys.map((k) => `[${k}]`).concat(['[INDT]']).join(',');
    const insertVals = editableKeys.map((k) => `@${k}`).concat(['GETDATE()']).join(',');

    const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD) AS S
        ON (T.[ANCD] = S.[ANCD])
      WHEN MATCHED THEN
        UPDATE SET
          ${setSql}
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],${insertCols})
        VALUES (@ANCD,${insertVals});
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F32090 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}


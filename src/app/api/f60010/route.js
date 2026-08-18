/**
 * @file API /api/f60010 — 근무표 F60010
 *
 * @description
 * 근무표 F60010 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f60010/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { normalizeYmdEmptyTz as normalizeYmd } from '../../../utils/normalizeYmd';
import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F60010]';

/** MIMG: blob 경로 JSON 저장용. 없으면 추가, 짧으면 NVARCHAR(MAX)로 확장 */
let mimgColumnEnsured = false;
async function ensureMimgColumn(pool) {
  if (mimgColumnEnsured) return;
  try {
    const check = await pool.request().query(`
      SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLen
      FROM [돌봄시설DB].INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'F60010'
        AND COLUMN_NAME = 'MIMG'
    `);
    const row = check.recordset?.[0];
    if (!row) {
      await pool.request().query(`
        ALTER TABLE ${TABLE_NAME} ADD [MIMG] NVARCHAR(MAX) NULL;
      `);
      console.log('F60010.MIMG 컬럼을 NVARCHAR(MAX)로 추가했습니다.');
    } else {
      const maxLen = row.maxLen;
      if (typeof maxLen === 'number' && maxLen > 0 && maxLen < 4000) {
        await pool.request().query(`
          ALTER TABLE ${TABLE_NAME} ALTER COLUMN [MIMG] NVARCHAR(MAX) NULL;
        `);
        console.log('F60010.MIMG 컬럼을 NVARCHAR(MAX)로 확장했습니다. (이전 길이:', maxLen, ')');
      }
    }
    mimgColumnEnsured = true;
  } catch (e) {
    console.error('F60010 MIMG 컬럼 확보 실패:', e?.message || e);
  }
}


export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const gate = assertAnCdMatchesSession(req, ancd);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    await ensureMimgColumn(pool);

    const request = pool.request();
    request.input('ANCD', ancd ?? gate.sessionAncd);

    let where = 'WHERE [ANCD] = @ANCD';
    if (startDate) {
      request.input('START', String(startDate).slice(0, 10));
      where += ' AND CONVERT(date, [MDT]) >= CONVERT(date, @START)';
    }
    if (endDate) {
      request.input('END', String(endDate).slice(0, 10));
      where += ' AND CONVERT(date, [MDT]) <= CONVERT(date, @END)';
    }

    const query = `
      SELECT
        [ANCD],
        [MDT],
        [STM],
        [ETM],
        [MPL],
        [MDOC],
        [MDES],
        [MNM],
        [MIMG],
        [MODT],
        [MODES],
        [ETC],
        [URDT],
        [INEMPNO],
        [INEMPNM]
      FROM ${TABLE_NAME}
      ${where}
      ORDER BY [MDT] DESC, [URDT] DESC
    `;

    const result = await request.query(query);
    const data = (result.recordset || []).map((r) => ({
      ...r,
      MDT: normalizeYmd(r.MDT),
      MODT: normalizeYmd(r.MODT),
      URDT: normalizeYmd(r.URDT),
    }));

    return jsonOk({ success: true, data, count: data.length });
  } catch (err) {
    console.error('F60010 테이블 조회 오류:', err);
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
    const mdt = body?.MDT;

    if (!ancd || !mdt) {
      return jsonError({ success: false, error: 'ANCD, MDT는 필수입니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    await ensureMimgColumn(pool);

    const request = pool.request();
    request.input('ANCD', ancd);
    request.input('MDT', String(mdt).slice(0, 10));

    const pick = (k) => (Object.prototype.hasOwnProperty.call(body || {}, k) ? body[k] : null);

    const editableKeys = [
      'STM',
      'ETM',
      'MPL',
      'MDOC',
      'MDES',
      'MNM',
      'MIMG',
      'MODT',
      'MODES',
      'ETC',
      'INEMPNO',
      'INEMPNM',
    ];

    editableKeys.forEach((k) => {
      const v = pick(k);
      if (k === 'MIMG') {
        request.input(
          k,
          sql.NVarChar(sql.MAX),
          v == null || String(v).trim() === '' ? null : String(v),
        );
        return;
      }
      request.input(k, v == null ? null : String(v));
    });

    const setSql = editableKeys
      .map((k) => `T.[${k}] = @${k}`)
      .concat(['T.[URDT] = GETDATE()'])
      .join(',\n          ');

    const insertCols = editableKeys.map((k) => `[${k}]`).concat(['[URDT]']).join(',');
    const insertVals = editableKeys.map((k) => `@${k}`).concat(['GETDATE()']).join(',');

    const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, CONVERT(date, @MDT) AS MDT) AS S
        ON (T.[ANCD] = S.[ANCD] AND CONVERT(date, T.[MDT]) = S.[MDT])
      WHEN MATCHED THEN
        UPDATE SET
          ${setSql}
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[MDT],${insertCols})
        VALUES (@ANCD,CONVERT(date, @MDT),${insertVals});
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F60010 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

export async function DELETE(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const mdt = searchParams.get('mdt');

    const gate = assertAnCdMatchesSession(req, ancd);
    if (!gate.ok) return gate.response;

    if (!ancd || !mdt) {
      return jsonError({ success: false, error: 'ancd, mdt 파라미터가 필요합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    await ensureMimgColumn(pool);

    const request = pool.request();
    request.input('ANCD', ancd);
    request.input('MDT', String(mdt).slice(0, 10));

    const query = `
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CONVERT(date, [MDT]) = CONVERT(date, @MDT)
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F60010 삭제 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

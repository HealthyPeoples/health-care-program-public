/**
 * @file API /api/f32010 — 활력징후 F32010
 *
 * @description
 * 활력징후 F32010 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f32010/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { normalizeYmdShort as normalizeYmd } from '../../../utils/normalizeYmd';
import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F32010]';

/** 스키마: PCHK01~12, 21~26, 31~37 (13~20 없음). f32020 TCHK와 동일 */
const PCHK_KEYS = [
  ...Array.from({ length: 12 }, (_, i) => `PCHK${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `PCHK${String(i + 21)}`),
  ...Array.from({ length: 7 }, (_, i) => `PCHK${String(i + 31)}`),
];

const VARCHAR_MAX = {
  P_DIAG: 500,
  P_PROBLEM: 500,
  P_WAY: 500,
  P_PLAN: 500,
  P_JUDGE: 500,
  P_TEXT_CNT: 100,
  PETC_1: 100,
  PETC_2: 100,
  PETC_3: 100,
  PETC_4: 100,
  PETC_5: 100,
  PD_NM: 100,
};

function truncNullable(v, max) {
  if (v == null || v === '') return null;
  const s = String(v);
  return s.length <= max ? s : s.slice(0, max);
}

function parseIntOrNull(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s || !/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function attachPlanRow(row) {
  if (!row) return null;
  return {
    ...row,
    SDT: normalizeYmd(row.SDT),
    EDT: normalizeYmd(row.EDT),
    INDT: normalizeYmd(row.INDT),
    JHEMPNM: row.JHEMPNM != null ? String(row.JHEMPNM).trim() : '',
  };
}

const F32010_SELECT = `
        f32010.*,
        COALESCE(
          NULLIF(LTRIM(RTRIM(f01010.[EMPNM])), ''),
          NULLIF(LTRIM(RTRIM(f32010.[PD_NM])), '')
        ) AS [JHEMPNM]
      FROM ${TABLE_NAME} f32010
      LEFT JOIN [돌봄시설DB].[dbo].[F01010] f01010
        ON CAST(f32010.[ANCD] AS VARCHAR) = CAST(f01010.[ANCD] AS VARCHAR)
       AND CAST(f32010.[JHEMP] AS VARCHAR) = CAST(f01010.[EMPNO] AS VARCHAR)
`;


function pickBody(body, k, fallback = null) {
  if (!body || typeof body !== 'object') return fallback;
  if (Object.prototype.hasOwnProperty.call(body, k)) return body[k];
  const alt = k.toLowerCase();
  if (alt !== k && Object.prototype.hasOwnProperty.call(body, alt)) return body[alt];
  return fallback;
}

// F32010 조회
// GET /api/f32010?pnum=PNUM&sdt=YYYY-MM-DD&edt=YYYY-MM-DD (optional) &ancd=ANCD(optional)
// - sdt/edt 없으면 해당 수급자의 계획 목록(최신순)
// - sdt/edt 있으면 해당 기간 1건 상세
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');
    const sdtRaw = searchParams.get('sdt');
    const edtRaw = searchParams.get('edt');

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

    const sdt = normalizeYmd(sdtRaw);
    const edt = normalizeYmd(edtRaw);
    if (sdt && edt) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sdt) || !/^\d{4}-\d{2}-\d{2}$/.test(edt)) {
        return jsonError({ success: false, error: 'sdt/edt는 YYYY-MM-DD 형식이어야 합니다' }, 400);
      }
      request.input('SDT', sdt);
      request.input('EDT', edt);

      const result = await request.query(`
        SELECT ${F32010_SELECT}
        WHERE f32010.[ANCD] = @ANCD
          AND CAST(f32010.[PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, f32010.[SDT]) = CONVERT(date, @SDT)
          AND CONVERT(date, f32010.[EDT]) = CONVERT(date, @EDT)
      `);

      const row = result?.recordset?.[0] || null;
      return jsonOk({ success: true, data: attachPlanRow(row) });
    }

    const result = await request.query(`
      SELECT ${F32010_SELECT}
      WHERE f32010.[ANCD] = @ANCD
        AND CAST(f32010.[PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY f32010.[SDT] DESC, f32010.[EDT] DESC, f32010.[INDT] DESC
    `);

    const data = (result.recordset || []).map((r) => attachPlanRow(r));

    return jsonOk({ success: true, data, count: data.length });
  } catch (err) {
    console.error('F32010 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

// F32010 저장(업서트)
// POST /api/f32010
// body: { PNUM, SDT, EDT, JHEMP?, JHEMPNM?/PD_NM?, P_DIAG?, P_PROBLEM?, P_WAY?, P_PLAN?, P_JUDGE?, P_TEXT_CNT?, PSTD01~20, PCHK01~12/21~26/31~37, PETC_1~5, ETC }
export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancdParam = searchParams.get('ancd'); // optional

    const gate = assertAnCdMatchesSession(req, ancdParam || null);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const pnum = pickBody(body, 'PNUM', null);
    const sdtRaw = pickBody(body, 'SDT', null);
    const edtRaw = pickBody(body, 'EDT', null);

    if (!pnum || !sdtRaw || !edtRaw) {
      return jsonError({ success: false, error: 'PNUM, SDT, EDT는 필수입니다' }, 400);
    }

    const sdt = normalizeYmd(sdtRaw);
    const edt = normalizeYmd(edtRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sdt) || !/^\d{4}-\d{2}-\d{2}$/.test(edt)) {
      return jsonError({ success: false, error: 'SDT/EDT는 YYYY-MM-DD 형식이어야 합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PNUM', String(pnum));
    request.input('SDT', sdt);
    request.input('EDT', edt);

    const editableKeys = [
      'JHEMP',
      'PD_NM',
      'P_DIAG',
      'P_PROBLEM',
      'P_WAY',
      'P_PLAN',
      'P_JUDGE',
      'P_TEXT_CNT',
      ...Array.from({ length: 20 }, (_, i) => `PSTD${String(i + 1).padStart(2, '0')}`),
      ...PCHK_KEYS,
      'PETC_1',
      'PETC_2',
      'PETC_3',
      'PETC_4',
      'PETC_5',
      'ETC',
    ];

    const jhempRaw = pickBody(body, 'JHEMP', null);
    let pdNm = pickBody(body, 'PD_NM', pickBody(body, 'JHEMPNM', null));
    const jhempNo = parseIntOrNull(jhempRaw);
    if (jhempNo == null && jhempRaw != null && String(jhempRaw).trim() && pdNm == null) {
      pdNm = String(jhempRaw).trim();
    }

    editableKeys.forEach((k) => {
      if (k === 'JHEMP') {
        request.input(k, sql.Int, jhempNo);
        return;
      }
      if (k === 'PD_NM') {
        request.input(k, sql.VarChar(VARCHAR_MAX.PD_NM), truncNullable(pdNm, VARCHAR_MAX.PD_NM));
        return;
      }
      if (k === 'ETC') {
        const v = pickBody(body, k, null);
        const s = v == null || v === '' ? null : String(v).slice(0, 1);
        request.input(k, sql.NVarChar(1), s);
        return;
      }
      const v = pickBody(body, k, null);
      const max = VARCHAR_MAX[k];
      if (max) {
        request.input(k, sql.VarChar(max), truncNullable(v, max));
        return;
      }
      const flag = v == null || v === '' ? '0' : String(v).slice(0, 1);
      request.input(k, sql.Char(1), flag === '1' ? '1' : '0');
    });

    const setSql = editableKeys
      .map((k) => `T.[${k}] = @${k}`)
      .concat(['T.[INDT] = GETDATE()'])
      .join(',\n          ');

    const insertCols = editableKeys.map((k) => `[${k}]`).concat(['[INDT]']).join(',');
    const insertVals = editableKeys.map((k) => `@${k}`).concat(['GETDATE()']).join(',');

    const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, CONVERT(date, @SDT) AS SDT, CONVERT(date, @EDT) AS EDT) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
            AND CONVERT(date, T.[SDT]) = S.[SDT]
            AND CONVERT(date, T.[EDT]) = S.[EDT])
      WHEN MATCHED THEN
        UPDATE SET
          ${setSql}
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[PNUM],[SDT],[EDT],${insertCols})
        VALUES (@ANCD,@PNUM,CONVERT(date, @SDT),CONVERT(date, @EDT),${insertVals});
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F32010 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

// F32010 삭제
// DELETE /api/f32010?pnum=PNUM&sdt=YYYY-MM-DD&edt=YYYY-MM-DD&ancd=ANCD(optional)
export async function DELETE(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');
    const sdtRaw = searchParams.get('sdt');
    const edtRaw = searchParams.get('edt');

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    if (!pnum || !sdtRaw || !edtRaw) {
      return jsonError({ success: false, error: 'pnum, sdt, edt 파라미터가 필요합니다' }, 400);
    }

    const sdt = normalizeYmd(sdtRaw);
    const edt = normalizeYmd(edtRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sdt) || !/^\d{4}-\d{2}-\d{2}$/.test(edt)) {
      return jsonError({ success: false, error: 'sdt/edt는 YYYY-MM-DD 형식이어야 합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PNUM', String(pnum));
    request.input('SDT', sdt);
    request.input('EDT', edt);

    await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [SDT]) = CONVERT(date, @SDT)
        AND CONVERT(date, [EDT]) = CONVERT(date, @EDT)
    `);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F32010 삭제 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}


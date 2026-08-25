/**
 * @file API /api/f32020 — 활력징후(정기) F32020
 *
 * @description
 * 활력징후(정기) F32020 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f32020/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F32020]';

function pickBody(body, k, fallback = null) {
  if (!body || typeof body !== 'object') return fallback;
  if (Object.prototype.hasOwnProperty.call(body, k)) return body[k];
  const alt = k.toLowerCase();
  if (alt !== k && Object.prototype.hasOwnProperty.call(body, alt)) return body[alt];
  return fallback;
}

/** SQL date는 UTC 자정 Date로 오므로 UTC 연월일을 쓴다. */
function toYmd(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (s.includes('T') && /^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return '';
}

function attachRow(row) {
  if (!row) return null;
  return {
    ...row,
    TDT: toYmd(row.TDT),
    INDT: toYmd(row.INDT),
    JHEMPNM: row.PD_NM != null ? String(row.PD_NM).trim() : '',
  };
}

function parseIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

// F32020 조회
// GET /api/f32020?pnum=PNUM&tdt=YYYY-MM-DD (optional)&ancd=ANCD(optional, 세션검증용)
// - tdt 없으면 해당 수급자의 전체 기록 목록(일자 내림차순)
// - tdt 있으면 해당 일자 1건 상세
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');
    const tdtRaw = searchParams.get('tdt'); // 'YYYY-MM-DD' or 'YYYYMMDD'

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

    const tdt = String(tdtRaw || '').replace(/\D/g, '');
    if (tdt) {
      // detail
      if (!/^\d{8}$/.test(tdt)) {
        return jsonError({ success: false, error: 'tdt는 YYYY-MM-DD 또는 YYYYMMDD 형식이어야 합니다' }, 400);
      }
      request.input('TDT', `${tdt.slice(0, 4)}-${tdt.slice(4, 6)}-${tdt.slice(6, 8)}`);

      const result = await request.query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [TDT]) = CONVERT(date, @TDT)
      `);

      const row = result?.recordset?.[0] ? attachRow(result.recordset[0]) : null;
      return jsonOk({ success: true, data: row });
    }

    // list
    const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY [TDT] DESC, [INDT] DESC
    `);

    const data = (result.recordset || []).map(attachRow);

    return jsonOk({ success: true, data, count: data.length });
  } catch (err) {
    console.error('F32020 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

// F32020 저장(업서트)
// POST /api/f32020
// body: { PNUM, TDT, JHEMP?, TCHKxx/TVALxx/TTEXT_x/TETC_x/TETCVAL_x/ETC ... }
export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancdParam = searchParams.get('ancd'); // optional

    const gate = assertAnCdMatchesSession(req, ancdParam || null);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const pnum = pickBody(body, 'PNUM', null);
    const tdtRaw = pickBody(body, 'TDT', null);

    if (!pnum || !tdtRaw) {
      return jsonError({ success: false, error: 'PNUM, TDT는 필수입니다' }, 400);
    }

    const tdtNorm = toYmd(tdtRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tdtNorm)) {
      return jsonError({ success: false, error: 'TDT는 YYYY-MM-DD 형식이어야 합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const pnumInt = parseIntOrNull(pnum);
    if (pnumInt == null) {
      return jsonError({ success: false, error: 'PNUM이 올바르지 않습니다' }, 400);
    }

    const origRaw = pickBody(body, 'ORIG_TDT', pickBody(body, 'origTdt', null));
    const origTdtNorm = toYmd(origRaw) || tdtNorm;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(origTdtNorm)) {
      return jsonError({ success: false, error: 'ORIG_TDT는 YYYY-MM-DD 형식이어야 합니다' }, 400);
    }

    const request = pool.request();
    request.input('ANCD', sql.Int, Number(gate.sessionAncd));
    request.input('PNUM', sql.Int, pnumInt);
    request.input('TDT', sql.VarChar(10), tdtNorm);
    request.input('ORIG_TDT', sql.VarChar(10), origTdtNorm);

    // 스키마 기반(이미지 참고): TCHK01~12, TCHK21~26, TCHK31~37 / TVAL 동일, TTEXT_1~4, TETC_1~5, TETCVAL_1~5, ETC, JHEMP
    const editableKeys = [
      'JHEMP',
      ...Array.from({ length: 12 }, (_, i) => `TCHK${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 12 }, (_, i) => `TVAL${String(i + 1).padStart(2, '0')}`),
      'TTEXT_1',
      ...Array.from({ length: 6 }, (_, i) => `TCHK${String(i + 21)}`),
      ...Array.from({ length: 6 }, (_, i) => `TVAL${String(i + 21)}`),
      'TTEXT_2',
      ...Array.from({ length: 7 }, (_, i) => `TCHK${String(i + 31)}`),
      ...Array.from({ length: 7 }, (_, i) => `TVAL${String(i + 31)}`),
      'TTEXT_3',
      'TETC_1','TETC_2','TETC_3','TETC_4','TETC_5',
      'TETCVAL_1','TETCVAL_2','TETCVAL_3','TETCVAL_4','TETCVAL_5',
      'TTEXT_4',
      'ETC',
      'T_SRT_TM',
      'T_END_TM',
      'PD_NM',
    ];

    editableKeys.forEach((k) => {
      const v = k === 'PD_NM' ? pickBody(body, 'PD_NM', pickBody(body, 'JHEMPNM', null)) : pickBody(body, k, null);
      if (k === 'JHEMP') {
        request.input(k, sql.Int, parseIntOrNull(v));
        return;
      }
      request.input(k, v == null || v === '' ? null : String(v));
    });

    const setSql = ['[TDT] = CONVERT(date, @TDT)']
      .concat(editableKeys.map((k) => `[${k}] = @${k}`))
      .concat(['[INDT] = GETDATE()'])
      .join(',\n          ');

    const insertCols = editableKeys.map((k) => `[${k}]`).concat(['[INDT]']).join(',');
    const insertVals = editableKeys.map((k) => `@${k}`).concat(['GETDATE()']).join(',');

    const keyWhere = `
        CAST([ANCD] AS VARCHAR) = CAST(@ANCD AS VARCHAR)
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)`;

    const isEdit = Boolean(toYmd(origRaw));

    if (isEdit && origTdtNorm !== tdtNorm) {
      const dup = await pool.request()
        .input('ANCD', sql.Int, Number(gate.sessionAncd))
        .input('PNUM', sql.Int, pnumInt)
        .input('TDT', sql.VarChar(10), tdtNorm)
        .query(`
          SELECT TOP (1) 1 AS ok
          FROM ${TABLE_NAME}
          WHERE ${keyWhere}
            AND CONVERT(date, [TDT]) = CONVERT(date, @TDT)
        `);
      if (dup?.recordset?.[0]) {
        return jsonError({ success: false, error: '해당 치료일자에 이미 기록이 있습니다.' }, 409);
      }
    }

    const upd = await request.query(`
      ;WITH cte AS (
        SELECT TOP (1) *
        FROM ${TABLE_NAME}
        WHERE ${keyWhere}
          AND CONVERT(date, [TDT]) = CONVERT(date, @ORIG_TDT)
        ORDER BY [INDT] DESC
      )
      UPDATE cte SET
          ${setSql}
      OUTPUT INSERTED.[PNUM] AS updatedPnum;
    `);

    const updated = (upd?.recordset || []).length > 0;
    if (!updated) {
      if (isEdit) {
        return jsonError({ success: false, error: '수정할 기록을 찾지 못했습니다.' }, 404);
      }
      const ins = pool.request();
      ins.input('ANCD', sql.Int, Number(gate.sessionAncd));
      ins.input('PNUM', sql.Int, pnumInt);
      ins.input('TDT', sql.VarChar(10), tdtNorm);
      editableKeys.forEach((k) => {
        const v = k === 'PD_NM' ? pickBody(body, 'PD_NM', pickBody(body, 'JHEMPNM', null)) : pickBody(body, k, null);
        if (k === 'JHEMP') {
          ins.input(k, sql.Int, parseIntOrNull(v));
          return;
        }
        ins.input(k, v == null || v === '' ? null : String(v));
      });
      await ins.query(`
        INSERT INTO ${TABLE_NAME} ([ANCD],[PNUM],[TDT],${insertCols})
        VALUES (@ANCD,@PNUM,CONVERT(date, @TDT),${insertVals});
      `);
    }

    const saved = await pool.request()
      .input('ANCD', sql.Int, Number(gate.sessionAncd))
      .input('PNUM', sql.Int, pnumInt)
      .input('TDT', sql.VarChar(10), tdtNorm)
      .query(`
        SELECT TOP (1) *
        FROM ${TABLE_NAME}
        WHERE ${keyWhere}
          AND CONVERT(date, [TDT]) = CONVERT(date, @TDT)
        ORDER BY [INDT] DESC
      `);

    return jsonOk({ success: true, data: attachRow(saved.recordset?.[0] || null) });
  } catch (err) {
    console.error('F32020 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

// F32020 삭제
// DELETE /api/f32020?pnum=PNUM&tdt=YYYY-MM-DD&ancd=ANCD(optional)
export async function DELETE(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');
    const tdtRaw = searchParams.get('tdt');

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    if (!pnum || !tdtRaw) {
      return jsonError({ success: false, error: 'pnum, tdt 파라미터가 필요합니다' }, 400);
    }

    const tdtNorm = toYmd(tdtRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tdtNorm)) {
      return jsonError({ success: false, error: 'tdt는 YYYY-MM-DD 형식이어야 합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PNUM', String(pnum));
    request.input('TDT', tdtNorm);

    await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [TDT]) = CONVERT(date, @TDT)
    `);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F32020 삭제 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}


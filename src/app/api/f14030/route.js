/**
 * @file API /api/f14030 — 일지/케어 관련 F14030
 *
 * @description
 * 일지/케어 관련 F14030 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f14030/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const sql = require('mssql');

const { normalizeYmdStrict: normalizeYmd } = require('../../../utils/normalizeYmd');
const TABLE = '[돌봄시설DB].[dbo].[F14030]';

/** MIMG: 사진 메타 JSON 저장용 — 짧으면 NVARCHAR(MAX)로 확장 */
let mimgColumnEnsured = false;
async function ensureMimgColumnWide(pool) {
  if (mimgColumnEnsured) return;
  try {
    const check = await pool.request().query(`
      SELECT CHARACTER_MAXIMUM_LENGTH AS maxLen
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'F14030'
        AND COLUMN_NAME = 'MIMG'
    `);
    const maxLen = check.recordset?.[0]?.maxLen;
    // MAX는 -1. 100 등 짧은 길이면 확장.
    if (maxLen == null || (typeof maxLen === 'number' && maxLen > 0 && maxLen < 4000)) {
      await pool.request().query(`
        ALTER TABLE ${TABLE} ALTER COLUMN [MIMG] NVARCHAR(MAX) NULL;
      `);
      console.log('F14030.MIMG 컬럼을 NVARCHAR(MAX)로 확장했습니다. (이전 길이:', maxLen, ')');
    }
    mimgColumnEnsured = true;
  } catch (e) {
    console.error('F14030 MIMG 컬럼 확장 실패:', e?.message || e);
    // 확장이 안 되면 저장 시 truncation이 나므로 플래그를 올리지 않음 → 매 요청 재시도
  }
}

function truncStr(v, max) {
  if (v == null) return '';
  const s = String(v);
  return s.length <= max ? s : s.slice(0, max);
}

function truncNullable(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length <= max ? s : s.slice(0, max);
}


function normalizeTime5(v) {
  if (v == null || v === '') return '';
  let s = String(v).trim().replace(/\s/g, '');
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':');
    s = `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
  }
  if (s.length > 5) s = s.slice(0, 5);
  return s;
}

function inputDate(request, name, ymd) {
  const n = normalizeYmd(ymd);
  if (n === null) {
    request.input(name, sql.Date, null);
  } else {
    request.input(name, sql.Date, new Date(`${n}T00:00:00`));
  }
}

const SELECT_COLS = `
  [ANCD], [DSEQ], [SVDT], [SVSTM], [SVETM], [SVGU], [SVDIC], [SVDES],
  [PGMAN0], [PGADD], [PGMAN1], [PGMAN2], [PGOJ], [PGJB], [PGDES],
  [INDT], [ETC], [INEMPNO], [INEMPNM], [PGSEQ], [MIMG], [PG_GU], [PG_GU_NM], [SVDIC_SUB]
`;

// GET /api/f14030?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const ancd = searchParams.get('ancd');

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    const s = normalizeYmd(startDate);
    const e = normalizeYmd(endDate);
    if (!s || !e) {
      return jsonError({ success: false, error: 'startDate, endDate(yyyy-mm-dd)가 필요합니다.' }, 400);
    }
    if (s > e) {
      return jsonError({ success: false, error: '시작일이 종료일보다 클 수 없습니다.' }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    await ensureMimgColumnWide(pool);

    const request = pool.request();
    request.input('sessionAncd', gate.sessionAncd);
    inputDate(request, 'startDate', s);
    inputDate(request, 'endDate', e);

    /**
     * SVDT는 `2025-09-10` 형태(varchar) 또는 date/datetime 컬럼으로 저장됨 → DATE로 통일해 기간 비교.
     * 행 수 제한(TOP/OFFSET) 없음 — 기간 내 전체 행 반환. 타임아웃은 DB 풀 requestTimeout을 따름.
     */
    const result = await request.query(`
      SELECT ${SELECT_COLS}
      FROM ${TABLE}
      WHERE [ANCD] = @sessionAncd
        AND TRY_CONVERT(DATE, LTRIM(RTRIM([SVDT]))) IS NOT NULL
        AND TRY_CONVERT(DATE, LTRIM(RTRIM([SVDT]))) >= CAST(@startDate AS DATE)
        AND TRY_CONVERT(DATE, LTRIM(RTRIM([SVDT]))) <= CAST(@endDate AS DATE)
      ORDER BY TRY_CONVERT(DATE, LTRIM(RTRIM([SVDT]))) DESC, [SVSTM] ASC, [DSEQ] ASC
    `);

    return jsonOk({
        success: true,
        data: result.recordset || [],
        count: result.recordset ? result.recordset.length : 0,
      });
  } catch (err) {
    console.error('F14030 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

// POST { action: 'create'|'save'|'delete', ...fields }
export async function POST(req) {
  try {
    const gate = assertAnCdMatchesSession(req, null);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const action =
      body.action === 'delete' ? 'delete' : body.action === 'create' ? 'create' : 'save';

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    await ensureMimgColumnWide(pool);

    if (action === 'delete') {
      const dseq = parseInt(String(body.dseq ?? body.DSEQ ?? ''), 10);
      if (Number.isNaN(dseq)) {
        return jsonError({ success: false, error: '삭제할 DSEQ가 필요합니다.' }, 400);
      }
      const rq = pool.request();
      rq.input('ANCD', gate.sessionAncd);
      rq.input('DSEQ', dseq);

      let mimgForCleanup = null;
      try {
        const prev = await rq.query(
          `SELECT [MIMG] FROM ${TABLE} WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ`,
        );
        mimgForCleanup = prev.recordset?.[0]?.MIMG ?? null;
      } catch (_) {
        /* ignore */
      }

      const del = await pool
        .request()
        .input('ANCD', gate.sessionAncd)
        .input('DSEQ', dseq)
        .query(`DELETE FROM ${TABLE} WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ`);
      if (!del.rowsAffected?.[0]) {
        return jsonError({ success: false, error: '삭제할 데이터가 없습니다.' }, 404);
      }

      // 첨부 사진 blob 정리 (실패해도 행 삭제는 성공으로 처리)
      try {
        const { deleteBlobByName, isBlobConfigured } = require('../../../lib/azureBlobStorage');
        if (isBlobConfigured() && mimgForCleanup) {
          let photos = [];
          try {
            const parsed = JSON.parse(String(mimgForCleanup));
            if (Array.isArray(parsed)) photos = parsed;
          } catch (_) {
            /* legacy plain string — ignore */
          }
          for (const p of photos) {
            const bn = p?.blobName ? String(p.blobName).trim() : '';
            if (bn) {
              try {
                await deleteBlobByName(bn);
              } catch (e) {
                console.warn('일지 삭제 시 blob 정리 실패:', bn, e?.message || e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('일지 사진 blob 정리 중 오류:', e?.message || e);
      }

      return jsonOk({ success: true, action: 'delete' });
    }

    const SVDT = normalizeYmd(body.SVDT ?? body.svdT);
    if (!SVDT) {
      return jsonError({ success: false, error: '서비스일자(SVDT)가 필요합니다.' }, 400);
    }

    const SVSTM = truncStr(normalizeTime5(body.SVSTM ?? body.svstm), 5);
    const SVETM = truncStr(normalizeTime5(body.SVETM ?? body.svetm), 5);
    const SVGU = truncStr(body.SVGU ?? body.svgu ?? '', 2);
    const SVDIC = truncStr(body.SVDIC ?? body.svdic ?? '', 200);
    const SVDES = truncStr(body.SVDES ?? body.svdes ?? '', 2000);
    const PGMAN0 = truncStr(body.PGMAN0 ?? body.pgman0 ?? '', 200);
    const PGADD = truncStr(body.PGADD ?? body.pgadd ?? '', 50);
    const PGMAN1 = truncStr(body.PGMAN1 ?? body.pgman1 ?? '', 20);
    const PGMAN2 = truncStr(body.PGMAN2 ?? body.pgman2 ?? '', 20);
    const PGOJ = truncStr(body.PGOJ ?? body.pgoj ?? '', 500);
    const PGJB = truncStr(body.PGJB ?? body.pgjb ?? '', 200);
    const PGDES = truncStr(body.PGDES ?? body.pgdes ?? '', 1000);
    const ETC = truncStr(body.ETC ?? body.etc ?? '', 1000);
    let INEMPNO = body.INEMPNO ?? body.inempno;
    if (INEMPNO !== null && INEMPNO !== undefined && INEMPNO !== '') {
      const n = parseInt(String(INEMPNO), 10);
      INEMPNO = Number.isNaN(n) ? null : n;
    } else {
      INEMPNO = null;
    }
    const INEMPNM = truncNullable(body.INEMPNM ?? body.inempnm, 100);
    let PGSEQ = body.PGSEQ ?? body.pgseq;
    if (PGSEQ !== null && PGSEQ !== undefined && PGSEQ !== '') {
      const n = parseInt(String(PGSEQ), 10);
      PGSEQ = Number.isNaN(n) ? null : n;
    } else {
      PGSEQ = null;
    }
    // 사진 메타 JSON(또는 레거시 짧은 문자열) — NVARCHAR(MAX)
    const MIMG_RAW = body.MIMG ?? body.mimg;
    const MIMG =
      MIMG_RAW == null || String(MIMG_RAW).trim() === ''
        ? null
        : truncStr(MIMG_RAW, 200000);
    const PG_GU = truncNullable(body.PG_GU ?? body.pg_gu, 10);
    const PG_GU_NM = truncNullable(body.PG_GU_NM ?? body.pg_gu_nm, 50);
    const SVDIC_SUB = truncNullable(body.SVDIC_SUB ?? body.svdic_sub, 50);

    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (action === 'create') {
      const maxR = await pool
        .request()
        .input('ANCD', gate.sessionAncd)
        .query(`SELECT ISNULL(MAX([DSEQ]), 0) + 1 AS NEXTSEQ FROM ${TABLE} WHERE [ANCD] = @ANCD`);
      const nextSeq = parseInt(String(maxR.recordset?.[0]?.NEXTSEQ ?? '1'), 10);

      const ins = pool.request();
      ins.input('ANCD', gate.sessionAncd);
      ins.input('DSEQ', nextSeq);
      inputDate(ins, 'SVDT', SVDT);
      ins.input('SVSTM', SVSTM || '');
      ins.input('SVETM', SVETM || '');
      ins.input('SVGU', SVGU || '');
      ins.input('SVDIC', SVDIC);
      ins.input('SVDES', SVDES);
      ins.input('PGMAN0', PGMAN0);
      ins.input('PGADD', PGADD);
      ins.input('PGMAN1', PGMAN1);
      ins.input('PGMAN2', PGMAN2);
      ins.input('PGOJ', PGOJ);
      ins.input('PGJB', PGJB);
      ins.input('PGDES', PGDES);
      inputDate(ins, 'INDT', body.INDT ?? body.indt ?? todayYmd);
      ins.input('ETC', ETC);
      ins.input('INEMPNO', sql.Int, INEMPNO);
      ins.input('INEMPNM', sql.NVarChar(100), INEMPNM);
      ins.input('PGSEQ', sql.Int, PGSEQ);
      ins.input('MIMG', sql.NVarChar(sql.MAX), MIMG);
      ins.input('PG_GU', sql.NVarChar(10), PG_GU);
      ins.input('PG_GU_NM', sql.NVarChar(50), PG_GU_NM);
      ins.input('SVDIC_SUB', sql.NVarChar(50), SVDIC_SUB);

      await ins.query(`
        INSERT INTO ${TABLE} (
          [ANCD],[DSEQ],[SVDT],[SVSTM],[SVETM],[SVGU],[SVDIC],[SVDES],
          [PGMAN0],[PGADD],[PGMAN1],[PGMAN2],[PGOJ],[PGJB],[PGDES],
          [INDT],[ETC],[INEMPNO],[INEMPNM],[PGSEQ],[MIMG],[PG_GU],[PG_GU_NM],[SVDIC_SUB]
        ) VALUES (
          @ANCD,@DSEQ,@SVDT,@SVSTM,@SVETM,@SVGU,@SVDIC,@SVDES,
          @PGMAN0,@PGADD,@PGMAN1,@PGMAN2,@PGOJ,@PGJB,@PGDES,
          @INDT,@ETC,@INEMPNO,@INEMPNM,@PGSEQ,@MIMG,@PG_GU,@PG_GU_NM,@SVDIC_SUB
        )
      `);

      return jsonOk({ success: true, action: 'create', dseq: nextSeq });
    }

    const dseq = parseInt(String(body.dseq ?? body.DSEQ ?? ''), 10);
    if (Number.isNaN(dseq)) {
      return jsonError({ success: false, error: '저장 시 dseq가 필요합니다.' }, 400);
    }

    const up = pool.request();
    up.input('ANCD', gate.sessionAncd);
    up.input('DSEQ', dseq);
    inputDate(up, 'SVDT', SVDT);
    up.input('SVSTM', SVSTM || '');
    up.input('SVETM', SVETM || '');
    up.input('SVGU', SVGU || '');
    up.input('SVDIC', SVDIC);
    up.input('SVDES', SVDES);
    up.input('PGMAN0', PGMAN0);
    up.input('PGADD', PGADD);
    up.input('PGMAN1', PGMAN1);
    up.input('PGMAN2', PGMAN2);
    up.input('PGOJ', PGOJ);
    up.input('PGJB', PGJB);
    up.input('PGDES', PGDES);
    inputDate(up, 'INDT', body.INDT ?? body.indt ?? todayYmd);
    up.input('ETC', ETC);
    up.input('INEMPNO', sql.Int, INEMPNO);
    up.input('INEMPNM', sql.NVarChar(100), INEMPNM);
    up.input('PGSEQ', sql.Int, PGSEQ);
    up.input('MIMG', sql.NVarChar(sql.MAX), MIMG);
    up.input('PG_GU', sql.NVarChar(10), PG_GU);
    up.input('PG_GU_NM', sql.NVarChar(50), PG_GU_NM);
    up.input('SVDIC_SUB', sql.NVarChar(50), SVDIC_SUB);

    const upd = await up.query(`
      UPDATE ${TABLE}
      SET
        [SVDT] = @SVDT,
        [SVSTM] = @SVSTM,
        [SVETM] = @SVETM,
        [SVGU] = @SVGU,
        [SVDIC] = @SVDIC,
        [SVDES] = @SVDES,
        [PGMAN0] = @PGMAN0,
        [PGADD] = @PGADD,
        [PGMAN1] = @PGMAN1,
        [PGMAN2] = @PGMAN2,
        [PGOJ] = @PGOJ,
        [PGJB] = @PGJB,
        [PGDES] = @PGDES,
        [INDT] = @INDT,
        [ETC] = @ETC,
        [INEMPNO] = @INEMPNO,
        [INEMPNM] = @INEMPNM,
        [PGSEQ] = @PGSEQ,
        [MIMG] = @MIMG,
        [PG_GU] = @PG_GU,
        [PG_GU_NM] = @PG_GU_NM,
        [SVDIC_SUB] = @SVDIC_SUB
      WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ
    `);

    if (!upd.rowsAffected?.[0]) {
      return jsonError({ success: false, error: '해당 일련번호의 데이터가 없습니다.' }, 404);
    }

    return jsonOk({ success: true, action: 'save', dseq });
  } catch (err) {
    console.error('F14030 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

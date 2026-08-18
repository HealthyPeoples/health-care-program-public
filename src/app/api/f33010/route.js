/**
 * @file API /api/f33010 — 욕창/낙상 등 F33010
 *
 * @description
 * 욕창/낙상 등 F33010 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f33010/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F33010]';

let ensureColumnsPromise = null;

/** DCUB_NONE, DCUB_TM, DCUB_CONF, DCUB_ETC, DCUB_IMG, DCUB_SEQ(같은 날 복수 기록) */
async function ensureColumns(pool) {
	if (!pool) return;
	if (!ensureColumnsPromise) {
		ensureColumnsPromise = (async () => {
			await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_NONE'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [DCUB_NONE] CHAR(1) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_TM'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [DCUB_TM] VARCHAR(8) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_CONF'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [DCUB_CONF] NVARCHAR(40) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_ETC'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [DCUB_ETC] NVARCHAR(100) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_IMG'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [DCUB_IMG] NVARCHAR(MAX) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_SEQ'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [DCUB_SEQ] INT NULL;
      END

      IF EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33010' AND c.name = N'DCUB_DISPO' AND c.max_length < 1000
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ALTER COLUMN [DCUB_DISPO] NVARCHAR(500) NULL;
      END
    `);

			await pool.request().query(`
      UPDATE ${TABLE_NAME} SET [DCUB_SEQ] = 1 WHERE [DCUB_SEQ] IS NULL;
    `);

			try {
				await pool.request().query(`
      DECLARE @pkName sysname;
      DECLARE @pkHasSeq bit = 0;

      SELECT @pkName = kc.name
      FROM [돌봄시설DB].sys.key_constraints kc
      INNER JOIN [돌봄시설DB].sys.tables t ON kc.parent_object_id = t.object_id
      WHERE t.name = N'F33010' AND kc.[type] = 'PK';

      IF @pkName IS NOT NULL
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM [돌봄시설DB].sys.index_columns ic
          INNER JOIN [돌봄시설DB].sys.columns c
            ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          INNER JOIN [돌봄시설DB].sys.key_constraints kc
            ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
          INNER JOIN [돌봄시설DB].sys.tables t ON kc.parent_object_id = t.object_id
          WHERE t.name = N'F33010' AND kc.[type] = 'PK' AND c.name = N'DCUB_SEQ'
        )
          SET @pkHasSeq = 1;

        IF @pkHasSeq = 0
        BEGIN
          DECLARE @dropPk nvarchar(400) =
            N'ALTER TABLE ${TABLE_NAME} DROP CONSTRAINT [' + REPLACE(@pkName, ']', ']]') + N']';
          EXEC (@dropPk);
        END
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.indexes i
        INNER JOIN [돌봄시설DB].sys.tables t ON i.object_id = t.object_id
        WHERE t.name = N'F33010' AND i.name = N'UQ_F33010_ANCD_PNUM_VDT_SEQ'
      )
      BEGIN
        CREATE UNIQUE INDEX [UQ_F33010_ANCD_PNUM_VDT_SEQ]
          ON ${TABLE_NAME} ([ANCD], [PNUM], [VDT], [DCUB_SEQ]);
      END
    `);
			} catch (keyErr) {
				console.error('F33010 동일일자 복수 키 설정 오류:', keyErr);
			}
		})().catch((err) => {
			ensureColumnsPromise = null;
			throw err;
		});
	}
	await ensureColumnsPromise;
}

function normalizeTimeHm(v) {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const h = String(v.getHours()).padStart(2, '0');
		const m = String(v.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}
	const s = String(v).trim();
	if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
	if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
	return '';
}

function yn01(v) {
	const s = String(v ?? '').trim().toUpperCase();
	return s === '1' || s === 'Y' || s === 'TRUE' ? '1' : '0';
}

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

function ymdToDigits(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.includes('-') ? s.replace(/-/g, '') : s;
}

function parseSeq(v) {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeSqlRow(row) {
  if (!row || typeof row !== 'object') return row;
  const o = {};
  for (const [k, v] of Object.entries(row)) {
    const ku = String(k).toUpperCase();
    if (!(ku in o)) o[ku] = v;
  }
  return o;
}

function normalizePnumParam(p) {
  const s = String(p ?? '').trim();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

/** 단일 행을 API 응답 형태로 */
function mapRow(r) {
  const n = normalizeSqlRow(r);
  return {
    ...n,
    VDT: toYmd(n.VDT),
    DCUB_AREA: n.DCUB_AREA ?? '',
    DCUB_SIZE: n.DCUB_SIZE ?? '',
    DCUB_DEEP: n.DCUB_DEEP ?? '',
    DCUB_COLOR: n.DCUB_COLOR ?? '',
    DCUB_DISPO: n.DCUB_DISPO ?? '',
    DCUB_NONE: yn01(n.DCUB_NONE),
    DCUB_TM: normalizeTimeHm(n.DCUB_TM),
    DCUB_CONF: n.DCUB_CONF ?? '',
    DCUB_ETC: n.DCUB_ETC ?? '',
    DCUB_IMG: n.DCUB_IMG ?? '',
    DCUB_SEQ: parseSeq(n.DCUB_SEQ) || 1,
    MIMG: n.MIMG ?? '',
  };
}

const SELECT_COLS = `
  [ANCD],[PNUM],[VDT],
  [DCUB_AREA],[DCUB_SIZE],[DCUB_DEEP],[DCUB_COLOR],[DCUB_DISPO],
  [DCUB_NONE],[DCUB_TM],[DCUB_CONF],[DCUB_ETC],[DCUB_IMG],[DCUB_SEQ],[MIMG]
`;

export async function GET(req) {
  try {
    const sp = req.nextUrl.searchParams;
    const ancd = sp.get('ancd');
    const pnum = sp.get('pnum');
    const vdt = sp.get('vdt');
    const mode = (sp.get('mode') || '').trim();

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    if (!pnum) {
      return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
    }

    const pool = await connPool;
    if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    await ensureColumns(pool);

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PNUM', normalizePnumParam(pnum));

    if (mode === 'dates') {
      const q = `
        SELECT
          CONVERT(varchar(10), [VDT], 120) AS VDT,
          ISNULL([DCUB_SEQ], 1) AS DCUB_SEQ,
          [DCUB_TM]
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        ORDER BY [VDT] DESC, [DCUB_SEQ] DESC
      `;
      const result = await request.query(q);
      const rows = (result.recordset || []).map((r) => ({
        VDT: toYmd(r.VDT),
        DCUB_SEQ: parseSeq(r.DCUB_SEQ) || 1,
        DCUB_TM: normalizeTimeHm(r.DCUB_TM),
      }));
      return jsonOk({ success: true, data: rows });
    }

    if (vdt) {
      const d = ymdToDigits(vdt);
      if (!/^\d{8}$/.test(d)) {
        return jsonError({ success: false, error: 'vdt 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
      }
      request.input('VDT', d);
      const seq = parseSeq(sp.get('seq') || sp.get('DCUB_SEQ'));
      let seqSql = '';
      if (seq > 0) {
        request.input('DCUB_SEQ', seq);
        seqSql = ' AND ISNULL([DCUB_SEQ], 1) = @DCUB_SEQ';
      }
      const q = `
        SELECT TOP (1)
          ${SELECT_COLS}
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(char(8), [VDT], 112) = @VDT
          ${seqSql}
        ORDER BY ISNULL([DCUB_SEQ], 1) DESC
      `;
      const result = await request.query(q);
      const row = (result.recordset || [])[0];
      if (!row) return jsonOk({ success: true, data: null });
      return jsonOk({ success: true, data: mapRow(row) });
    }

    const fromRaw = sp.get('from') || sp.get('frdt') || '';
    const toRaw = sp.get('to') || sp.get('todt') || '';
    const fromDigits = ymdToDigits(fromRaw);
    const toDigits = ymdToDigits(toRaw);
    if (fromRaw && !/^\d{8}$/.test(fromDigits)) {
      return jsonError({ success: false, error: 'from 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
    }
    if (toRaw && !/^\d{8}$/.test(toDigits)) {
      return jsonError({ success: false, error: 'to 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
    }

    let rangeSql = '';
    if (/^\d{8}$/.test(fromDigits)) {
      request.input('FRDT', fromDigits);
      rangeSql += ' AND CONVERT(char(8), [VDT], 112) >= @FRDT';
    }
    if (/^\d{8}$/.test(toDigits)) {
      request.input('TODT', toDigits);
      rangeSql += ' AND CONVERT(char(8), [VDT], 112) <= @TODT';
    }

    const q = `
      SELECT
        ${SELECT_COLS}
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        ${rangeSql}
      ORDER BY [VDT] DESC, ISNULL([DCUB_SEQ], 1) DESC
    `;
    const result = await request.query(q);
    const data = (result.recordset || []).map(mapRow);
    return jsonOk({ success: true, data, count: data.length });
  } catch (err) {
    console.error('F33010 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: String(err) });
  }
}

export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const pnum = body?.PNUM ?? body?.pnum;
    const vdt = body?.VDT ?? body?.vdt;

    if (!pnum || !vdt) {
      return jsonError({ success: false, error: 'PNUM, VDT는 필수입니다' }, 400);
    }

    const vdtDigits = ymdToDigits(vdt);
    if (!/^\d{8}$/.test(vdtDigits)) {
      return jsonError({ success: false, error: 'VDT 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
    }

    const pool = await connPool;
    if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    await ensureColumns(pool);

    const pick = (k, def = '') =>
      Object.prototype.hasOwnProperty.call(body || {}, k) ? body[k] : def;

    const origVdtDigits = ymdToDigits(pick('ORIG_VDT', pick('origVdt', vdt))) || vdtDigits;
    const origSeq = parseSeq(pick('ORIG_SEQ', pick('origSeq', pick('DCUB_SEQ', 0))));
    const isNew =
      pick('isNew', pick('IS_NEW', false)) === true ||
      pick('isNew', '') === '1' ||
      origSeq <= 0;

    const nextReq = pool.request();
    nextReq.input('ANCD', gate.sessionAncd);
    nextReq.input('PNUM', normalizePnumParam(pnum));
    nextReq.input('VDT', vdtDigits);
    const nextResult = await nextReq.query(`
      SELECT ISNULL(MAX(ISNULL([DCUB_SEQ], 1)), 0) + 1 AS NEXT_SEQ
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(char(8), [VDT], 112) = @VDT
    `);
    const nextSeq = parseSeq(nextResult.recordset?.[0]?.NEXT_SEQ) || 1;

    let saveSeq = origSeq;
    if (isNew) {
      saveSeq = nextSeq;
    } else if (origVdtDigits !== vdtDigits) {
      saveSeq = nextSeq;
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PNUM', normalizePnumParam(pnum));
    request.input('VDT', vdtDigits);
    request.input('ORIG_VDT', origVdtDigits);
    request.input('DCUB_SEQ', saveSeq);
    request.input('ORIG_SEQ', origSeq > 0 ? origSeq : saveSeq);
    request.input('DCUB_AREA', pick('DCUB_AREA', pick('dcubArea', '')) ?? '');
    request.input('DCUB_SIZE', pick('DCUB_SIZE', pick('dcubSize', '')) ?? '');
    request.input('DCUB_DEEP', pick('DCUB_DEEP', pick('dcubDeep', '')) ?? '');
    request.input('DCUB_COLOR', pick('DCUB_COLOR', pick('dcubColor', '')) ?? '');
    request.input('DCUB_DISPO', String(pick('DCUB_DISPO', pick('dcubDispo', '')) ?? '').slice(0, 500));
    request.input('DCUB_NONE', yn01(pick('DCUB_NONE', pick('dcubNone', '0'))));
    request.input('DCUB_TM', normalizeTimeHm(pick('DCUB_TM', pick('dcubTm', ''))));
    request.input('DCUB_CONF', String(pick('DCUB_CONF', pick('dcubConf', '')) ?? '').slice(0, 40));
    request.input('DCUB_ETC', String(pick('DCUB_ETC', pick('dcubEtc', '')) ?? '').slice(0, 100));
    request.input('DCUB_IMG', String(pick('DCUB_IMG', pick('dcubImg', '')) ?? ''));
    request.input('MIMG', pick('MIMG', pick('mimg', '')) ?? '');

    if (isNew) {
      await request.query(`
        INSERT INTO ${TABLE_NAME} (
          [ANCD],[PNUM],[VDT],
          [DCUB_AREA],[DCUB_SIZE],[DCUB_DEEP],[DCUB_COLOR],[DCUB_DISPO],
          [DCUB_NONE],[DCUB_TM],[DCUB_CONF],[DCUB_ETC],[DCUB_IMG],[DCUB_SEQ],[MIMG]
        )
        VALUES (
          @ANCD,@PNUM,CONVERT(date, @VDT, 112),
          @DCUB_AREA,@DCUB_SIZE,@DCUB_DEEP,@DCUB_COLOR,@DCUB_DISPO,
          @DCUB_NONE,@DCUB_TM,@DCUB_CONF,@DCUB_ETC,@DCUB_IMG,@DCUB_SEQ,@MIMG
        );
      `);
    } else {
      const upd = await request.query(`
        UPDATE ${TABLE_NAME}
        SET
          [VDT] = CONVERT(date, @VDT, 112),
          [DCUB_AREA] = @DCUB_AREA,
          [DCUB_SIZE] = @DCUB_SIZE,
          [DCUB_DEEP] = @DCUB_DEEP,
          [DCUB_COLOR] = @DCUB_COLOR,
          [DCUB_DISPO] = @DCUB_DISPO,
          [DCUB_NONE] = @DCUB_NONE,
          [DCUB_TM] = @DCUB_TM,
          [DCUB_CONF] = @DCUB_CONF,
          [DCUB_ETC] = @DCUB_ETC,
          [DCUB_IMG] = @DCUB_IMG,
          [DCUB_SEQ] = @DCUB_SEQ,
          [MIMG] = @MIMG
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(char(8), [VDT], 112) = @ORIG_VDT
          AND ISNULL([DCUB_SEQ], 1) = @ORIG_SEQ;
      `);
      const affected = Number(upd?.rowsAffected?.[0] || 0);
      if (affected === 0) {
        await request.query(`
          INSERT INTO ${TABLE_NAME} (
            [ANCD],[PNUM],[VDT],
            [DCUB_AREA],[DCUB_SIZE],[DCUB_DEEP],[DCUB_COLOR],[DCUB_DISPO],
            [DCUB_NONE],[DCUB_TM],[DCUB_CONF],[DCUB_ETC],[DCUB_IMG],[DCUB_SEQ],[MIMG]
          )
          VALUES (
            @ANCD,@PNUM,CONVERT(date, @VDT, 112),
            @DCUB_AREA,@DCUB_SIZE,@DCUB_DEEP,@DCUB_COLOR,@DCUB_DISPO,
            @DCUB_NONE,@DCUB_TM,@DCUB_CONF,@DCUB_ETC,@DCUB_IMG,@DCUB_SEQ,@MIMG
          );
        `);
      }
    }

    return jsonOk({ success: true, data: { VDT: toYmd(vdtDigits), DCUB_SEQ: saveSeq } });
  } catch (err) {
    console.error('F33010 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: String(err) });
  }
}

export async function DELETE(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');
    const vdt = searchParams.get('vdt');
    const seq = parseSeq(searchParams.get('seq') || searchParams.get('DCUB_SEQ'));

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    if (!pnum || !vdt) {
      return jsonError({ success: false, error: 'pnum, vdt 파라미터가 필요합니다' }, 400);
    }

    const vdtDigits = ymdToDigits(vdt);
    if (!/^\d{8}$/.test(vdtDigits)) {
      return jsonError({ success: false, error: 'vdt 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
    }

    const pool = await connPool;
    if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    await ensureColumns(pool);

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PNUM', normalizePnumParam(pnum));
    request.input('VDT', vdtDigits);

    let seqSql = '';
    if (seq > 0) {
      request.input('DCUB_SEQ', seq);
      seqSql = ' AND ISNULL([DCUB_SEQ], 1) = @DCUB_SEQ';
    }

    const query = `
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(char(8), [VDT], 112) = @VDT
        ${seqSql}
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F33010 삭제 오류:', err);
    return jsonError({ success: false, error: err.message, details: String(err) });
  }
}

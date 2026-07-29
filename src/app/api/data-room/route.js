import { connPool } from '../../../config/server';
import {
  assertAnCdMatchesSession,
  getSessionFromRequest,
} from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const sql = require('mssql');
const {
  isBlobConfigured,
  uploadDataRoomFile,
  deleteBlobByName,
  downloadDataRoomBlob,
  assertDataRoomBlobName,
  isValidDataRoomBlobName,
  MAX_DATA_ROOM_BYTES,
} = require('../../../lib/azureBlobStorage');

const TABLE = '[돌봄시설DB].[dbo].[DATA_ROOM]';
const FILE_TABLE = '[돌봄시설DB].[dbo].[DATA_ROOM_FILE]';
const CATEGORIES = new Set(['공지', '서식', '교육', '기타']);
const MAX_FILES_PER_POST = 10;

let tableEnsured = false;

async function ensureDataRoomTable(pool) {
  if (tableEnsured) return;
  try {
    // 1) 게시글 테이블
    await pool.request().query(`
      IF OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM]', N'U') IS NULL
      BEGIN
        CREATE TABLE ${TABLE} (
          [DR_SEQ]         INT IDENTITY(1,1) NOT NULL,
          [ANCD]           INT NOT NULL,
          [CATEGORY]       NVARCHAR(20) NOT NULL,
          [TITLE]          NVARCHAR(200) NOT NULL,
          [DESCRIPTION]    NVARCHAR(2000) NULL,
          [FILE_NAME]      NVARCHAR(260) NULL,
          [BLOB_NAME]      NVARCHAR(500) NULL,
          [CONTENT_TYPE]   NVARCHAR(120) NULL,
          [FILE_SIZE]      BIGINT NULL,
          [DOWNLOAD_CNT]   INT NOT NULL CONSTRAINT [DF_DATA_ROOM_DOWNLOAD_CNT] DEFAULT (0),
          [REG_EMPNO]      NVARCHAR(20) NULL,
          [REG_EMPNM]      NVARCHAR(100) NULL,
          [REG_DATE]       DATETIME NULL,
          [MOD_EMPNO]      NVARCHAR(20) NULL,
          [MOD_DATE]       DATETIME NULL,
          CONSTRAINT [PK_DATA_ROOM] PRIMARY KEY CLUSTERED ([DR_SEQ])
        );
      END
    `);

    // 2) 컬럼 NULL 허용 (실패해도 무시)
    try {
      await pool.request().query(`
        BEGIN TRY
          ALTER TABLE ${TABLE} ALTER COLUMN [FILE_NAME] NVARCHAR(260) NULL;
        END TRY BEGIN CATCH END CATCH;
        BEGIN TRY
          ALTER TABLE ${TABLE} ALTER COLUMN [BLOB_NAME] NVARCHAR(500) NULL;
        END TRY BEGIN CATCH END CATCH;
        BEGIN TRY
          ALTER TABLE ${TABLE} ALTER COLUMN [CONTENT_TYPE] NVARCHAR(120) NULL;
        END TRY BEGIN CATCH END CATCH;
        BEGIN TRY
          ALTER TABLE ${TABLE} ALTER COLUMN [FILE_SIZE] BIGINT NULL;
        END TRY BEGIN CATCH END CATCH;
      `);
    } catch (_) {
      /* ignore */
    }

    // 3) 인덱스
    await pool.request().query(`
      IF OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM]', N'U') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM [돌봄시설DB].sys.indexes
           WHERE name = N'IX_DATA_ROOM_ANCD_REG_DATE'
             AND object_id = OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM]')
         )
      BEGIN
        CREATE NONCLUSTERED INDEX [IX_DATA_ROOM_ANCD_REG_DATE]
          ON ${TABLE} ([ANCD], [REG_DATE] DESC);
      END
    `);

    // 4) 첨부파일 테이블
    await pool.request().query(`
      IF OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM_FILE]', N'U') IS NULL
      BEGIN
        CREATE TABLE ${FILE_TABLE} (
          [DRF_SEQ]        INT IDENTITY(1,1) NOT NULL,
          [DR_SEQ]         INT NOT NULL,
          [ANCD]           INT NOT NULL,
          [FILE_NAME]      NVARCHAR(260) NOT NULL,
          [BLOB_NAME]      NVARCHAR(500) NOT NULL,
          [CONTENT_TYPE]   NVARCHAR(120) NULL,
          [FILE_SIZE]      BIGINT NOT NULL CONSTRAINT [DF_DATA_ROOM_FILE_SIZE2] DEFAULT (0),
          [DOWNLOAD_CNT]   INT NOT NULL CONSTRAINT [DF_DATA_ROOM_FILE_DL] DEFAULT (0),
          [SORT_ORD]       INT NOT NULL CONSTRAINT [DF_DATA_ROOM_FILE_ORD] DEFAULT (0),
          [REG_DATE]       DATETIME NULL,
          CONSTRAINT [PK_DATA_ROOM_FILE] PRIMARY KEY CLUSTERED ([DRF_SEQ])
        );
      END

      IF OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM_FILE]', N'U') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM [돌봄시설DB].sys.indexes
           WHERE name = N'IX_DATA_ROOM_FILE_DR_SEQ'
             AND object_id = OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM_FILE]')
         )
      BEGIN
        CREATE NONCLUSTERED INDEX [IX_DATA_ROOM_FILE_DR_SEQ]
          ON ${FILE_TABLE} ([DR_SEQ], [SORT_ORD], [DRF_SEQ]);
      END
    `);

    // 5) 레거시 단건 → 파일 테이블 이관
    await pool.request().query(`
      IF OBJECT_ID(N'[돌봄시설DB].[dbo].[DATA_ROOM_FILE]', N'U') IS NOT NULL
      BEGIN
        INSERT INTO ${FILE_TABLE} (
          [DR_SEQ], [ANCD], [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE],
          [FILE_SIZE], [DOWNLOAD_CNT], [SORT_ORD], [REG_DATE]
        )
        SELECT
          d.[DR_SEQ], d.[ANCD],
          ISNULL(NULLIF(LTRIM(RTRIM(d.[FILE_NAME])), N''), N'file'),
          d.[BLOB_NAME],
          d.[CONTENT_TYPE],
          ISNULL(d.[FILE_SIZE], 0),
          ISNULL(d.[DOWNLOAD_CNT], 0),
          0,
          d.[REG_DATE]
        FROM ${TABLE} d
        WHERE d.[BLOB_NAME] IS NOT NULL
          AND LTRIM(RTRIM(d.[BLOB_NAME])) <> N''
          AND NOT EXISTS (
            SELECT 1 FROM ${FILE_TABLE} f WHERE f.[DR_SEQ] = d.[DR_SEQ]
          );
      END
    `);

    tableEnsured = true;
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('DATA_ROOM ensure 오류:', msg);
    if (/already an object named/i.test(msg)) {
      tableEnsured = true;
      return;
    }
    throw e;
  }
}

function trunc(v, max) {
  if (v == null) return '';
  const s = String(v);
  return s.length <= max ? s : s.slice(0, max);
}

function formatSizeText(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function formatYmd(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapFileRow(f) {
  return {
    drfSeq: f.DRF_SEQ,
    fileName: f.FILE_NAME,
    sizeText: formatSizeText(f.FILE_SIZE),
    fileSize: Number(f.FILE_SIZE) || 0,
    contentType: f.CONTENT_TYPE || '',
    downloadCount: Number(f.DOWNLOAD_CNT) || 0,
    sortOrd: Number(f.SORT_ORD) || 0,
  };
}

function mapPost(r, files) {
  const fileList = Array.isArray(files) ? files : [];
  const totalDl = fileList.reduce((acc, f) => acc + (Number(f.downloadCount) || 0), 0);
  const names = fileList.map((f) => f.fileName).filter(Boolean);
  return {
    id: String(r.DR_SEQ),
    drSeq: r.DR_SEQ,
    ancd: r.ANCD != null ? String(r.ANCD) : '',
    annm: r.ANNM != null ? String(r.ANNM) : '',
    category: r.CATEGORY,
    title: r.TITLE,
    description: r.DESCRIPTION || '',
    uploader: r.REG_EMPNM || r.REG_EMPNO || '',
    createdAt: formatYmd(r.REG_DATE),
    files: fileList,
    fileCount: fileList.length,
    originalFilename: names[0] || r.FILE_NAME || '',
    sizeText: fileList[0]?.sizeText || formatSizeText(r.FILE_SIZE),
    downloadCount: totalDl || Number(r.DOWNLOAD_CNT) || 0,
  };
}

/** 한글 파일명 보존용 Content-Disposition */
function contentDisposition(fileName) {
  const raw = String(fileName || 'download').replace(/[\r\n"]/g, '_').trim() || 'download';
  const encoded = encodeURIComponent(raw).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  const ascii = raw.replace(/[^\x20-\x7E]/g, '_') || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function isUploadPart(item) {
  if (item == null || typeof item === 'string') return false;
  if (typeof item !== 'object') return false;
  // Next/undici File·Blob
  if (typeof item.arrayBuffer === 'function') return true;
  if (typeof item.stream === 'function') return true;
  if (typeof item.text === 'function' && typeof item.size === 'number') return true;
  return false;
}

function collectUploadFiles(form) {
  const out = [];
  const seen = new Set();
  const push = (item) => {
    if (!isUploadPart(item)) return;
    const name = String(item.name || 'file');
    const size = Number(item.size) || 0;
    const key = `${name}|${size}|${String(item.type || '')}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  try {
    for (const item of form.getAll('files')) push(item);
    for (const item of form.getAll('file')) push(item);
  } catch (_) {
    /* ignore */
  }

  for (const [key, value] of form.entries()) {
    if (/^files?(\[\d*\])?$/i.test(String(key)) || String(key).toLowerCase() === 'file') {
      push(value);
    }
  }

  return out.slice(0, MAX_FILES_PER_POST);
}

async function partToBuffer(part) {
  if (Buffer.isBuffer(part)) return part;
  if (typeof part.arrayBuffer === 'function') {
    return Buffer.from(await part.arrayBuffer());
  }
  if (typeof part.stream === 'function') {
    const chunks = [];
    for await (const chunk of part.stream()) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('업로드 파일을 읽을 수 없습니다.');
}

/** GET — 목록 또는 download=1&drfSeq= 개별 파일 다운로드 */
export async function GET(req) {
  try {
    const gate = assertAnCdMatchesSession(req, null);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    await ensureDataRoomTable(pool);

    const sp = req.nextUrl.searchParams;
    const download = sp.get('download') === '1' || sp.get('action') === 'download';
    const drfSeq = parseInt(String(sp.get('drfSeq') || ''), 10);
    // 하위호환: drSeq만 오면 첫 파일
    const drSeqFallback = parseInt(String(sp.get('drSeq') || ''), 10);

    if (download) {
      if (!isBlobConfigured()) {
        return jsonError({ success: false, error: 'Azure Blob Storage가 설정되지 않았습니다.' }, 503);
      }

      let row = null;
      if (!Number.isNaN(drfSeq)) {
        const meta = await pool
          .request()
          .input('DRF_SEQ', drfSeq)
          .query(`
            SELECT TOP 1 [DRF_SEQ], [DR_SEQ], [ANCD], [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE]
            FROM ${FILE_TABLE}
            WHERE [DRF_SEQ] = @DRF_SEQ
          `);
        row = meta.recordset?.[0] || null;
      } else if (!Number.isNaN(drSeqFallback)) {
        const meta = await pool
          .request()
          .input('DR_SEQ', drSeqFallback)
          .query(`
            SELECT TOP 1 [DRF_SEQ], [DR_SEQ], [ANCD], [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE]
            FROM ${FILE_TABLE}
            WHERE [DR_SEQ] = @DR_SEQ
            ORDER BY [SORT_ORD] ASC, [DRF_SEQ] ASC
          `);
        row = meta.recordset?.[0] || null;
        if (!row) {
          const legacy = await pool
            .request()
            .input('DR_SEQ', drSeqFallback)
            .query(`
              SELECT TOP 1 [DR_SEQ], [ANCD], [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE]
              FROM ${TABLE}
              WHERE [DR_SEQ] = @DR_SEQ
            `);
          const L = legacy.recordset?.[0];
          if (L?.BLOB_NAME) {
            row = { DRF_SEQ: null, ...L };
          }
        }
      } else {
        return jsonError({ success: false, error: 'drfSeq(또는 drSeq)가 필요합니다.' }, 400);
      }

      if (!row) return jsonError({ success: false, error: '파일을 찾을 수 없습니다.' }, 404);
      if (!isValidDataRoomBlobName(row.BLOB_NAME) && !assertDataRoomBlobName(row.BLOB_NAME, row.ANCD)) {
        return jsonError({ success: false, error: '잘못된 파일 경로입니다.' }, 403);
      }

      const file = await downloadDataRoomBlob(row.BLOB_NAME);
      if (!file) return jsonError({ success: false, error: 'Blob 파일을 찾을 수 없습니다.' }, 404);

      if (row.DRF_SEQ != null) {
        await pool
          .request()
          .input('DRF_SEQ', row.DRF_SEQ)
          .query(`
            UPDATE ${FILE_TABLE}
            SET [DOWNLOAD_CNT] = ISNULL([DOWNLOAD_CNT], 0) + 1
            WHERE [DRF_SEQ] = @DRF_SEQ
          `);
      }

      const downloadName = String(row.FILE_NAME || 'download').trim() || 'download';
      return new Response(file.buffer, {
        status: 200,
        headers: {
          'Content-Type': row.CONTENT_TYPE || file.contentType || 'application/octet-stream',
          'Content-Disposition': contentDisposition(downloadName),
          'X-File-Name': encodeURIComponent(downloadName),
          'Access-Control-Expose-Headers': 'Content-Disposition, X-File-Name',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const category = String(sp.get('category') || '').trim();
    const q = String(sp.get('q') || '').trim();
    const filterAncdRaw = String(sp.get('ancd') || sp.get('filterAncd') || '').trim();
    const filterAll =
      !filterAncdRaw ||
      filterAncdRaw === 'all' ||
      filterAncdRaw === '전체' ||
      filterAncdRaw.toLowerCase() === 'all';

    const rq = pool.request();
    let where = `1=1`;
    if (!filterAll) {
      const n = parseInt(filterAncdRaw, 10);
      if (Number.isNaN(n)) {
        return jsonError({ success: false, error: '기관 필터(ancd)가 올바르지 않습니다.' }, 400);
      }
      rq.input('FILTER_ANCD', n);
      where = `d.[ANCD] = @FILTER_ANCD`;
    }
    if (category && category !== '전체' && CATEGORIES.has(category)) {
      rq.input('CATEGORY', category);
      where += ` AND d.[CATEGORY] = @CATEGORY`;
    }
    if (q) {
      rq.input('Q', `%${q}%`);
      where += ` AND (
        d.[TITLE] LIKE @Q OR d.[DESCRIPTION] LIKE @Q OR d.[FILE_NAME] LIKE @Q
        OR d.[REG_EMPNM] LIKE @Q OR d.[REG_EMPNO] LIKE @Q
        OR EXISTS (
          SELECT 1 FROM ${FILE_TABLE} fx
          WHERE fx.[DR_SEQ] = d.[DR_SEQ] AND fx.[FILE_NAME] LIKE @Q
        )
      )`;
    }

    const result = await rq.query(`
      SELECT
        d.[DR_SEQ], d.[ANCD], d.[CATEGORY], d.[TITLE], d.[DESCRIPTION],
        d.[FILE_NAME], d.[BLOB_NAME], d.[CONTENT_TYPE], d.[FILE_SIZE], d.[DOWNLOAD_CNT],
        d.[REG_EMPNO], d.[REG_EMPNM], d.[REG_DATE], d.[MOD_EMPNO], d.[MOD_DATE],
        f10.[ANNM]
      FROM ${TABLE} d
      LEFT JOIN [돌봄시설DB].[dbo].[F00110] f10
        ON f10.[ANCD] = d.[ANCD] AND (ISNULL(f10.[DEL], '') <> 'D')
      WHERE ${where}
      ORDER BY d.[REG_DATE] DESC, d.[DR_SEQ] DESC
    `);

    const posts = result.recordset || [];
    const ids = posts.map((p) => p.DR_SEQ).filter((x) => x != null);
    let fileRows = [];
    if (ids.length) {
      const fr = await pool.request().query(`
        SELECT [DRF_SEQ], [DR_SEQ], [ANCD], [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE],
               [FILE_SIZE], [DOWNLOAD_CNT], [SORT_ORD]
        FROM ${FILE_TABLE}
        WHERE [DR_SEQ] IN (${ids.map((id) => Number(id)).join(',')})
        ORDER BY [DR_SEQ], [SORT_ORD], [DRF_SEQ]
      `);
      fileRows = fr.recordset || [];
    }

    const byDr = new Map();
    for (const f of fileRows) {
      const key = f.DR_SEQ;
      if (!byDr.has(key)) byDr.set(key, []);
      byDr.get(key).push(mapFileRow(f));
    }

    const data = posts.map((p) => {
      let files = byDr.get(p.DR_SEQ) || [];
      if (!files.length && p.BLOB_NAME) {
        files = [
          mapFileRow({
            DRF_SEQ: null,
            FILE_NAME: p.FILE_NAME,
            FILE_SIZE: p.FILE_SIZE,
            CONTENT_TYPE: p.CONTENT_TYPE,
            DOWNLOAD_CNT: p.DOWNLOAD_CNT,
            SORT_ORD: 0,
          }),
        ];
      }
      return mapPost(p, files);
    });

    // 기관 필터용 목록 (로그인 사용자 누구나)
    let facilities = [];
    try {
      const fac = await pool.request().query(`
        SELECT [ANCD], [ANNM]
        FROM [돌봄시설DB].[dbo].[F00110]
        WHERE (ISNULL([DEL], '') <> 'D')
        ORDER BY [ANNM]
      `);
      facilities = (fac.recordset || []).map((r) => ({
        ancd: String(r.ANCD),
        annm: String(r.ANNM || r.ANCD || ''),
      }));
    } catch (e) {
      console.warn('자료실 기관 목록 조회 실패:', e?.message || e);
    }

    return jsonOk({
      success: true,
      data,
      count: data.length,
      maxFiles: MAX_FILES_PER_POST,
      facilities,
      sessionAncd: gate.sessionAncd != null ? String(gate.sessionAncd) : null,
    });
  } catch (err) {
    console.error('DATA_ROOM 조회 오류:', err);
    return jsonError({ success: false, error: err.message || '조회 실패' });
  }
}

/** POST multipart — 자료 등록 (files 최대 10개) */
export async function POST(req) {
  try {
    const gate = assertAnCdMatchesSession(req, null);
    if (!gate.ok) return gate.response;

    if (!isBlobConfigured()) {
      return jsonError(
        {
          success: false,
          error:
            'Azure Blob Storage가 설정되지 않았습니다. AZURE_STORAGE_CONNECTION_STRING을 설정해 주세요.',
        },
        503,
      );
    }

    const pool = await connPool;
    if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    await ensureDataRoomTable(pool);

    const form = await req.formData();
    const uploadFiles = collectUploadFiles(form);
    if (!uploadFiles.length) {
      const keys = [];
      try {
        for (const [k, v] of form.entries()) {
          keys.push(`${k}:${typeof v === 'string' ? 'str' : `file(${v?.name || ''},${v?.size || 0})`}`);
        }
      } catch (_) {
        /* ignore */
      }
      console.warn('DATA_ROOM 업로드 파일 없음. form keys=', keys.join(' | '));
      return jsonError({ success: false, error: '첨부 파일이 필요합니다. (최대 10개)' }, 400);
    }
    if (uploadFiles.length > MAX_FILES_PER_POST) {
      return jsonError({ success: false, error: `파일은 최대 ${MAX_FILES_PER_POST}개까지 첨부할 수 있습니다.` }, 400);
    }

    const title = trunc(form.get('title') || form.get('TITLE') || '', 200).trim();
    const category = trunc(form.get('category') || form.get('CATEGORY') || '', 20).trim();
    const description = trunc(form.get('description') || form.get('DESCRIPTION') || '', 2000);
    if (!title) return jsonError({ success: false, error: '제목이 필요합니다.' }, 400);
    if (!CATEGORIES.has(category)) {
      return jsonError({ success: false, error: '분류는 공지/서식/교육/기타 중 하나여야 합니다.' }, 400);
    }

    const uploadedList = [];
    for (const file of uploadFiles) {
      const buffer = await partToBuffer(file);
      if (buffer.length > MAX_DATA_ROOM_BYTES) {
        // 이미 올린 blob 정리
        for (const u of uploadedList) {
          try {
            await deleteBlobByName(u.blobName);
          } catch (_) {
            /* ignore */
          }
        }
        return jsonError(
          { success: false, error: `${file.name || '파일'} 크기는 50MB 이하여야 합니다.` },
          400,
        );
      }
      const uploaded = await uploadDataRoomFile({
        ancd: gate.sessionAncd,
        buffer,
        fileName: file.name || 'file',
        mimeType: file.type || 'application/octet-stream',
        size: buffer.length,
      });
      uploadedList.push(uploaded);
    }

    const session = getSessionFromRequest(req) || {};
    const regEmpno = trunc(session.empno ?? session.uid ?? '', 20) || null;
    const regEmpnm =
      trunc(form.get('uploader') || form.get('REG_EMPNM') || session.empnm || '', 100) || null;

    const first = uploadedList[0];
    const ins = pool.request();
    ins.input('ANCD', gate.sessionAncd);
    ins.input('CATEGORY', category);
    ins.input('TITLE', title);
    ins.input('DESCRIPTION', description || null);
    ins.input('FILE_NAME', first.fileName);
    ins.input('BLOB_NAME', first.blobName);
    ins.input('CONTENT_TYPE', first.contentType);
    ins.input('FILE_SIZE', sql.BigInt, first.size);
    ins.input('REG_EMPNO', sql.NVarChar(20), regEmpno);
    ins.input('REG_EMPNM', sql.NVarChar(100), regEmpnm);

    const inserted = await ins.query(`
      INSERT INTO ${TABLE} (
        [ANCD], [CATEGORY], [TITLE], [DESCRIPTION],
        [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE], [FILE_SIZE],
        [DOWNLOAD_CNT], [REG_EMPNO], [REG_EMPNM], [REG_DATE]
      )
      OUTPUT INSERTED.*
      VALUES (
        @ANCD, @CATEGORY, @TITLE, @DESCRIPTION,
        @FILE_NAME, @BLOB_NAME, @CONTENT_TYPE, @FILE_SIZE,
        0, @REG_EMPNO, @REG_EMPNM, GETDATE()
      )
    `);

    const post = inserted.recordset?.[0];
    if (!post) {
      return jsonError({ success: false, error: '게시글 등록에 실패했습니다.' });
    }

    const fileMapped = [];
    for (let i = 0; i < uploadedList.length; i++) {
      const u = uploadedList[i];
      const fi = pool.request();
      fi.input('DR_SEQ', post.DR_SEQ);
      fi.input('ANCD', gate.sessionAncd);
      fi.input('FILE_NAME', u.fileName);
      fi.input('BLOB_NAME', u.blobName);
      fi.input('CONTENT_TYPE', u.contentType);
      fi.input('FILE_SIZE', sql.BigInt, u.size);
      fi.input('SORT_ORD', i);
      const fr = await fi.query(`
        INSERT INTO ${FILE_TABLE} (
          [DR_SEQ], [ANCD], [FILE_NAME], [BLOB_NAME], [CONTENT_TYPE],
          [FILE_SIZE], [DOWNLOAD_CNT], [SORT_ORD], [REG_DATE]
        )
        OUTPUT INSERTED.*
        VALUES (
          @DR_SEQ, @ANCD, @FILE_NAME, @BLOB_NAME, @CONTENT_TYPE,
          @FILE_SIZE, 0, @SORT_ORD, GETDATE()
        )
      `);
      if (fr.recordset?.[0]) fileMapped.push(mapFileRow(fr.recordset[0]));
    }

    return jsonOk({ success: true, data: mapPost(post, fileMapped) });
  } catch (err) {
    console.error('DATA_ROOM 등록 오류:', err);
    return jsonError({ success: false, error: err.message || '등록 실패' });
  }
}

/** DELETE JSON { drSeq } — 게시글 + 첨부 전체 */
export async function DELETE(req) {
  try {
    const gate = assertAnCdMatchesSession(req, null);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    await ensureDataRoomTable(pool);

    const body = await req.json().catch(() => ({}));
    const drSeq = parseInt(String(body.drSeq ?? body.DR_SEQ ?? ''), 10);
    if (Number.isNaN(drSeq)) {
      return jsonError({ success: false, error: 'drSeq가 필요합니다.' }, 400);
    }

    const parent = await pool
      .request()
      .input('DR_SEQ', drSeq)
      .query(`
        SELECT TOP 1 [DR_SEQ], [ANCD], [BLOB_NAME]
        FROM ${TABLE}
        WHERE [DR_SEQ] = @DR_SEQ
      `);
    const postRow = parent.recordset?.[0];
    if (!postRow) {
      return jsonError({ success: false, error: '삭제할 자료가 없습니다.' }, 404);
    }
    // 등록 기관만 삭제 가능
    if (String(postRow.ANCD) !== String(gate.sessionAncd)) {
      return jsonError({ success: false, error: '다른 기관에서 등록한 자료는 삭제할 수 없습니다.' }, 403);
    }

    const files = await pool
      .request()
      .input('DR_SEQ', drSeq)
      .query(`
        SELECT [BLOB_NAME] FROM ${FILE_TABLE}
        WHERE [DR_SEQ] = @DR_SEQ
      `);
    const blobs = (files.recordset || []).map((r) => r.BLOB_NAME).filter(Boolean);
    if (postRow.BLOB_NAME && !blobs.includes(postRow.BLOB_NAME)) blobs.push(postRow.BLOB_NAME);

    await pool
      .request()
      .input('DR_SEQ', drSeq)
      .query(`DELETE FROM ${FILE_TABLE} WHERE [DR_SEQ] = @DR_SEQ`);

    const del = await pool
      .request()
      .input('DR_SEQ', drSeq)
      .query(`DELETE FROM ${TABLE} WHERE [DR_SEQ] = @DR_SEQ`);

    if (!del.rowsAffected?.[0]) {
      return jsonError({ success: false, error: '삭제할 자료가 없습니다.' }, 404);
    }

    if (isBlobConfigured()) {
      for (const blobName of blobs) {
        try {
          await deleteBlobByName(blobName);
        } catch (e) {
          console.warn('DATA_ROOM blob 삭제 실패:', blobName, e?.message || e);
        }
      }
    }

    return jsonOk({ success: true, deleted: drSeq });
  } catch (err) {
    console.error('DATA_ROOM 삭제 오류:', err);
    return jsonError({ success: false, error: err.message || '삭제 실패' });
  }
}

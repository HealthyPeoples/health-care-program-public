/**
 * @file API /api/f14039 — 프로그램 평가 샘플 F14039
 *
 * @description
 * 총평/특이사항 샘플(F14039) CRUD. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f14039/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE = '[돌봄시설DB].[dbo].[F14039]';
const PROGRAM_TABLE = '[돌봄시설DB].[dbo].[F14040]';

let ensureTablePromise = null;

async function ensureTable(pool) {
	if (!pool) return;
	if (!ensureTablePromise) {
		ensureTablePromise = pool
			.request()
			.query(`
      IF NOT EXISTS (
        SELECT 1
        FROM [돌봄시설DB].sys.tables t
        INNER JOIN [돌봄시설DB].sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = N'dbo' AND t.name = N'F14039'
      )
      BEGIN
        CREATE TABLE ${TABLE} (
          [ANCD] INT NOT NULL,
          [PGSEQ] INT NOT NULL,
          [SMP_FLAG] CHAR(1) NOT NULL,
          [SMP_SEQ] INT NOT NULL,
          [SMP_DSC] NVARCHAR(200) NULL,
          CONSTRAINT [PK_F14039] PRIMARY KEY CLUSTERED ([ANCD], [PGSEQ], [SMP_FLAG], [SMP_SEQ])
        );
      END
    `)
			.catch((err) => {
				ensureTablePromise = null;
				throw err;
			});
	}
	await ensureTablePromise;
	try {
		await pool.request().query(`
      IF EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.tables t
        INNER JOIN [돌봄시설DB].sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = N'dbo' AND t.name = N'F14039'
      )
      AND NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.indexes i
        INNER JOIN [돌봄시설DB].sys.tables t ON i.object_id = t.object_id
        WHERE t.name = N'F14039' AND i.name = N'UQ_F14039_ANCD_PGSEQ_FLAG_SEQ'
      )
      BEGIN
        CREATE UNIQUE INDEX [UQ_F14039_ANCD_PGSEQ_FLAG_SEQ]
        ON ${TABLE} ([ANCD], [PGSEQ], [SMP_FLAG], [SMP_SEQ]);
      END
    `);
	} catch {
		/* 기존 중복 데이터가 있으면 인덱스는 건너뜁니다. */
	}
}

function flagLabel(flag) {
	return flag === '2' ? '특이사항' : '총평';
}

async function findDuplicateSeq(pool, ancd, pgseq, flag, smpSeq) {
	const req = pool.request();
	req.input('ANCD', sql.Int, ancd);
	req.input('PGSEQ', sql.Int, pgseq);
	req.input('SMP_FLAG', sql.Char(1), flag);
	req.input('SMP_SEQ', sql.Int, smpSeq);
	const result = await req.query(`
    SELECT TOP 1 [SMP_SEQ]
    FROM ${TABLE}
    WHERE [ANCD] = @ANCD
      AND [PGSEQ] = @PGSEQ
      AND RTRIM([SMP_FLAG]) = RTRIM(@SMP_FLAG)
      AND [SMP_SEQ] = @SMP_SEQ
  `);
	return Boolean(result.recordset?.[0]);
}

function normalizeFlag(v) {
	const s = String(v ?? '').trim();
	return s === '1' || s === '2' ? s : '';
}

function truncStr(v, max) {
	if (v == null) return '';
	const s = String(v);
	return s.length <= max ? s : s.slice(0, max);
}

function pick(body, k, fallback = null) {
	if (!body || typeof body !== 'object') return fallback;
	if (Object.prototype.hasOwnProperty.call(body, k)) return body[k];
	return fallback;
}

function mapRow(r) {
	return {
		ANCD: r.ANCD,
		PGSEQ: r.PGSEQ,
		SMP_FLAG: normalizeFlag(r.SMP_FLAG),
		SMP_SEQ: r.SMP_SEQ,
		SMP_DSC: r.SMP_DSC != null ? String(r.SMP_DSC) : '',
	};
}

async function assertProgramInSession(pool, sessionAncd, pgseq) {
	const r = await pool
		.request()
		.input('ANCD', sql.Int, sessionAncd)
		.input('PGSEQ', sql.Int, pgseq)
		.query(`
      SELECT TOP 1 [PGSEQ]
      FROM ${PROGRAM_TABLE}
      WHERE [ANCD] = @ANCD
        AND [PGSEQ] = @PGSEQ
        AND ISNULL([DEL], '') <> 'D'
    `);
	return Boolean(r.recordset?.[0]);
}

/** GET /api/f14039?pgseq=&smp_flag= */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const countsOnly = String(sp.get('counts') ?? '').trim() === '1';
		const pgseq = parseInt(String(sp.get('pgseq') ?? '').trim(), 10);
		const flag = normalizeFlag(sp.get('smp_flag'));

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureTable(pool);

		if (countsOnly) {
			const countFlag = flag || '1';
			const countReq = pool.request();
			countReq.input('ANCD', sql.Int, Number(gate.sessionAncd));
			countReq.input('SMP_FLAG', sql.Char(1), countFlag);
			const countResult = await countReq.query(`
        SELECT [PGSEQ], COUNT(1) AS CNT
        FROM ${TABLE}
        WHERE [ANCD] = @ANCD AND [SMP_FLAG] = @SMP_FLAG
        GROUP BY [PGSEQ]
      `);
			const data = (countResult.recordset || []).map((r) => ({
				PGSEQ: Number(r.PGSEQ),
				CNT: Number(r.CNT) || 0,
			}));
			return jsonOk({ success: true, data, count: data.length });
		}

		if (!Number.isFinite(pgseq) || pgseq <= 0) {
			return jsonError({ success: false, error: 'pgseq 파라미터가 필요합니다' }, 400);
		}
		if (!flag) {
			return jsonError({ success: false, error: 'smp_flag는 1(총평) 또는 2(특이사항)이어야 합니다' }, 400);
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PGSEQ', sql.Int, pgseq);
		request.input('SMP_FLAG', sql.Char(1), flag);
		const result = await request.query(`
      SELECT [ANCD], [PGSEQ], [SMP_FLAG], [SMP_SEQ], [SMP_DSC]
      FROM ${TABLE}
      WHERE [ANCD] = @ANCD
        AND [PGSEQ] = @PGSEQ
        AND [SMP_FLAG] = @SMP_FLAG
      ORDER BY [SMP_SEQ] ASC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F14039 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f14039 — 신규 */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pgseq = parseInt(String(pick(body, 'PGSEQ', '') ?? '').trim(), 10);
		const flag = normalizeFlag(pick(body, 'SMP_FLAG'));
		const dsc = truncStr(pick(body, 'SMP_DSC', ''), 200).trim();
		const requestedSeq = parseInt(String(pick(body, 'SMP_SEQ', '') ?? '').trim(), 10);

		if (!Number.isFinite(pgseq) || pgseq <= 0) {
			return jsonError({ success: false, error: 'PGSEQ는 필수입니다' }, 400);
		}
		if (!flag) {
			return jsonError({ success: false, error: 'SMP_FLAG는 1(총평) 또는 2(특이사항)이어야 합니다' }, 400);
		}
		if (!dsc) {
			return jsonError({ success: false, error: '평가 샘플 내용을 입력해주세요' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureTable(pool);

		const ok = await assertProgramInSession(pool, gate.sessionAncd, pgseq);
		if (!ok) {
			return jsonError({ success: false, error: '선택한 프로그램을 찾을 수 없습니다' }, 404);
		}

		let nextSeq = Number.isFinite(requestedSeq) && requestedSeq > 0 ? requestedSeq : 0;
		if (!nextSeq) {
			const seqReq = pool.request();
			seqReq.input('ANCD', sql.Int, Number(gate.sessionAncd));
			seqReq.input('PGSEQ', sql.Int, pgseq);
			seqReq.input('SMP_FLAG', sql.Char(1), flag);
			const seqResult = await seqReq.query(`
        SELECT ISNULL(MAX([SMP_SEQ]), 0) + 1 AS NEXT_SEQ
        FROM ${TABLE}
        WHERE [ANCD] = @ANCD AND [PGSEQ] = @PGSEQ AND [SMP_FLAG] = @SMP_FLAG
      `);
			nextSeq = Number(seqResult.recordset?.[0]?.NEXT_SEQ || 1);
		}

		const exists = await findDuplicateSeq(pool, gate.sessionAncd, pgseq, flag, nextSeq);
		if (exists) {
			return jsonError(
				{
					success: false,
					error: `해당 프로그램의 ${flagLabel(flag)}에 이미 ${nextSeq}번 연번이 있습니다.`,
				},
				409
			);
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PGSEQ', sql.Int, pgseq);
		request.input('SMP_FLAG', sql.Char(1), flag);
		request.input('SMP_SEQ', sql.Int, nextSeq);
		request.input('SMP_DSC', sql.NVarChar(200), dsc);
		await request.query(`
      INSERT INTO ${TABLE} ([ANCD], [PGSEQ], [SMP_FLAG], [SMP_SEQ], [SMP_DSC])
      VALUES (@ANCD, @PGSEQ, @SMP_FLAG, @SMP_SEQ, @SMP_DSC)
    `);

		return jsonOk({ success: true, data: { SMP_SEQ: nextSeq } });
	} catch (err) {
		console.error('F14039 추가 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** PUT /api/f14039 — 수정 */
export async function PUT(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pgseq = parseInt(String(pick(body, 'PGSEQ', '') ?? '').trim(), 10);
		const flag = normalizeFlag(pick(body, 'SMP_FLAG'));
		const origSeq = parseInt(String(pick(body, 'ORIG_SMP_SEQ', pick(body, 'SMP_SEQ', '')) ?? '').trim(), 10);
		const newSeq = parseInt(String(pick(body, 'SMP_SEQ', '') ?? '').trim(), 10);
		const dsc = truncStr(pick(body, 'SMP_DSC', ''), 200).trim();

		if (!Number.isFinite(pgseq) || pgseq <= 0 || !Number.isFinite(origSeq) || origSeq <= 0) {
			return jsonError({ success: false, error: 'PGSEQ, SMP_SEQ는 필수입니다' }, 400);
		}
		if (!Number.isFinite(newSeq) || newSeq <= 0) {
			return jsonError({ success: false, error: '연번(SMP_SEQ)은 1 이상의 숫자여야 합니다' }, 400);
		}
		if (!flag) {
			return jsonError({ success: false, error: 'SMP_FLAG는 1(총평) 또는 2(특이사항)이어야 합니다' }, 400);
		}
		if (!dsc) {
			return jsonError({ success: false, error: '평가 샘플 내용을 입력해주세요' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureTable(pool);

		if (newSeq !== origSeq) {
			const exists = await findDuplicateSeq(pool, gate.sessionAncd, pgseq, flag, newSeq);
			if (exists) {
				return jsonError(
					{
						success: false,
						error: `해당 프로그램의 ${flagLabel(flag)}에 이미 ${newSeq}번 연번이 있습니다.`,
					},
					409
				);
			}
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PGSEQ', sql.Int, pgseq);
		request.input('SMP_FLAG', sql.Char(1), flag);
		request.input('ORIG_SMP_SEQ', sql.Int, origSeq);
		request.input('SMP_SEQ', sql.Int, newSeq);
		request.input('SMP_DSC', sql.NVarChar(200), dsc);
		const result = await request.query(`
      UPDATE ${TABLE}
      SET [SMP_SEQ] = @SMP_SEQ,
          [SMP_DSC] = @SMP_DSC
      WHERE [ANCD] = @ANCD
        AND [PGSEQ] = @PGSEQ
        AND [SMP_FLAG] = @SMP_FLAG
        AND [SMP_SEQ] = @ORIG_SMP_SEQ
    `);

		const affected = result.rowsAffected?.[0] ?? 0;
		if (!affected) {
			return jsonError({ success: false, error: '수정할 샘플을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F14039 수정 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f14039?pgseq=&smp_flag=&smp_seq= | all=1 */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pgseq = parseInt(String(sp.get('pgseq') ?? '').trim(), 10);
		const flag = normalizeFlag(sp.get('smp_flag'));
		const all = String(sp.get('all') ?? '').trim() === '1';
		const smpSeq = parseInt(String(sp.get('smp_seq') ?? '').trim(), 10);

		if (!Number.isFinite(pgseq) || pgseq <= 0) {
			return jsonError({ success: false, error: 'pgseq가 필요합니다' }, 400);
		}
		if (!flag) {
			return jsonError({ success: false, error: 'smp_flag는 1 또는 2이어야 합니다' }, 400);
		}
		if (!all && (!Number.isFinite(smpSeq) || smpSeq <= 0)) {
			return jsonError({ success: false, error: 'smp_seq가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureTable(pool);

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PGSEQ', sql.Int, pgseq);
		request.input('SMP_FLAG', sql.Char(1), flag);

		let result;
		if (all) {
			result = await request.query(`
        DELETE FROM ${TABLE}
        WHERE [ANCD] = @ANCD AND [PGSEQ] = @PGSEQ AND [SMP_FLAG] = @SMP_FLAG
      `);
		} else {
			request.input('SMP_SEQ', sql.Int, smpSeq);
			result = await request.query(`
        DELETE FROM ${TABLE}
        WHERE [ANCD] = @ANCD
          AND [PGSEQ] = @PGSEQ
          AND [SMP_FLAG] = @SMP_FLAG
          AND [SMP_SEQ] = @SMP_SEQ
      `);
		}

		const affected = result.rowsAffected?.[0] ?? 0;
		if (!all && !affected) {
			return jsonError({ success: false, error: '삭제할 샘플을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F14039 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

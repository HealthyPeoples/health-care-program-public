/**
 * @file API /api/f33030 — 목욕서비스 F33030
 *
 * @description
 * 목욕서비스 F33030 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 * 목욕전·이동방법·목욕후 상태(BEF_STAT/MOVE_STAT/AFT_STAT), 수급자상태(BEN_STAT),
 * 목욕방법명(BATH_METH_NM), 제공자명(INEMPNM)은 필요 시 ALTER 합니다.
 *
 * @module app/api/f33030/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F33030]';

let ensureColumnsPromise = null;

async function ensureColumns(pool) {
	if (!pool) return;
	if (!ensureColumnsPromise) {
		ensureColumnsPromise = pool
			.request()
			.query(`
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33030]', N'BEN_STAT') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [BEN_STAT] VARCHAR(100) NULL;
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33030]', N'BEF_STAT') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [BEF_STAT] VARCHAR(20) NULL;
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33030]', N'MOVE_STAT') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [MOVE_STAT] VARCHAR(20) NULL;
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33030]', N'AFT_STAT') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [AFT_STAT] VARCHAR(20) NULL;
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33030]', N'BATH_METH_NM') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [BATH_METH_NM] VARCHAR(50) NULL;
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33030]', N'INEMPNM') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [INEMPNM] VARCHAR(50) NULL;
    `)
			.catch((err) => {
				ensureColumnsPromise = null;
				throw err;
			});
	}
	await ensureColumnsPromise;
}

/** DB Date / locale 문자열 / ISO 모두 yyyy-mm-dd로 (프론트 표시·중복제거용) */
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
	if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
		const dt = new Date(s);
		if (!Number.isNaN(dt.getTime())) {
			const y = dt.getFullYear();
			const m = String(dt.getMonth() + 1).padStart(2, '0');
			const d = String(dt.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		}
		return s.slice(0, 10);
	}
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

function normalizeTimeHm(v) {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const iso = v.toISOString();
		if (/^(1970|1900)-01-01T/.test(iso)) return iso.slice(11, 16);
		const h = String(v.getHours()).padStart(2, '0');
		const m = String(v.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}
	const s = String(v).trim();
	if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
	if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
	return '';
}

/** tedious/mssql가 컬럼명을 소문자로 줄 때 프론트가 대문자만 읽는 문제 방지 */
function normalizeSqlRow(row) {
	if (!row || typeof row !== 'object') return row;
	const o = {};
	for (const [k, v] of Object.entries(row)) {
		const ku = String(k).toUpperCase();
		if (!(ku in o)) o[ku] = v;
	}
	return o;
}

/** DB의 PNUM과 수급자목록의 선행 0 표기(예: 05 vs 5) 불일치 방지 */
function normalizePnumParam(p) {
	const s = String(p ?? '').trim();
	if (/^\d+$/.test(s)) return String(parseInt(s, 10));
	return s;
}

function strOrEmpty(v) {
	if (v == null) return '';
	return String(v).trim();
}

function mapRow(row) {
	const n = normalizeSqlRow(row);
	return {
		...n,
		VDT: toYmd(n.VDT),
		SRV_TM: normalizeTimeHm(n.SRV_TM) || strOrEmpty(n.SRV_TM),
		BEN_STAT: strOrEmpty(n.BEN_STAT),
		BEF_STAT: strOrEmpty(n.BEF_STAT),
		MOVE_STAT: strOrEmpty(n.MOVE_STAT),
		AFT_STAT: strOrEmpty(n.AFT_STAT),
		BATH_METH_NM: strOrEmpty(n.BATH_METH_NM),
		INEMPNM: strOrEmpty(n.INEMPNM),
		SRV_WRNG_DESC: strOrEmpty(n.SRV_WRNG_DESC),
	};
}

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd'); // optional
		const pnum = searchParams.get('pnum');
		const vdt = searchParams.get('vdt'); // yyyy-mm-dd
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');
		const mode = searchParams.get('mode');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum) {
			return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		if (mode !== 'dates') {
			await ensureColumns(pool);
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', normalizePnumParam(pnum));

		if (mode === 'dates') {
			const q = `
        SELECT DISTINCT CONVERT(varchar(10), [VDT], 120) AS VDT
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        ORDER BY VDT DESC
      `;
			const result = await request.query(q);
			const data = (result.recordset || []).map((r) => ({ VDT: toYmd(r.VDT) }));
			return jsonOk({ success: true, data, count: data.length });
		}

		let where = `
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
    `;

		if (startDate && endDate) {
			const s = ymdToDigits(startDate);
			const e = ymdToDigits(endDate);
			if (!/^\d{8}$/.test(s) || !/^\d{8}$/.test(e)) {
				return jsonError({ success: false, error: 'startDate/endDate 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
			}
			request.input('START', s);
			request.input('END', e);
			where += ` AND CONVERT(char(8), [VDT], 112) >= @START AND CONVERT(char(8), [VDT], 112) <= @END`;
		} else if (vdt) {
			const d = ymdToDigits(vdt);
			if (!/^\d{8}$/.test(d)) {
				return jsonError({ success: false, error: 'vdt 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
			}
			request.input('VDT', d);
			where += ` AND CONVERT(char(8), [VDT], 112) = @VDT`;
		}

		const query = `
      SELECT
        [ANCD],
        [PNUM],
        CONVERT(varchar(10), [VDT], 120) AS [VDT],
        [SRV_TM],
        [AF_FACE],
        [AF_LIP],
        [AF_NAIL_COLOR],
        [AF_COG_STAT],
        [BF_FACE],
        [BF_LIP],
        [BF_NAIL_COLOR],
        [BF_COG_STAT],
        [SRV_WRNG_DESC],
        [BATH_METH],
        [BATH_METH_NM],
        [BEN_STAT],
        [BEF_STAT],
        [MOVE_STAT],
        [AFT_STAT],
        [INEMPNO],
        [INEMPNO1],
        [INEMPNM]
      FROM ${TABLE_NAME}
      ${where}
      ORDER BY [VDT] DESC, [SRV_TM] ASC
    `;

		const result = await request.query(query);
		const data = (result.recordset || []).map(mapRow);

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F33030 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function POST(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd'); // optional

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
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		await ensureColumns(pool);

		const pick = (k, def = null) =>
			Object.prototype.hasOwnProperty.call(body || {}, k) ? body[k] : def;

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', normalizePnumParam(pnum));
		request.input('VDT', vdtDigits);

		request.input('SRV_TM', normalizeTimeHm(pick('SRV_TM', body?.srvTm ?? '') ?? '') || strOrEmpty(pick('SRV_TM', '')));
		request.input('AF_FACE', pick('AF_FACE', body?.afFace ?? 'X') ?? 'X');
		request.input('AF_LIP', pick('AF_LIP', body?.afLip ?? 'X') ?? 'X');
		request.input('AF_NAIL_COLOR', pick('AF_NAIL_COLOR', body?.afNailColor ?? body?.afNailColc ?? 'X') ?? 'X');
		request.input('AF_COG_STAT', pick('AF_COG_STAT', body?.afCogStat ?? 'X') ?? 'X');
		request.input('BF_FACE', pick('BF_FACE', body?.bfFace ?? 'X') ?? 'X');
		request.input('BF_LIP', pick('BF_LIP', body?.bfLip ?? 'X') ?? 'X');
		request.input('BF_NAIL_COLOR', pick('BF_NAIL_COLOR', body?.bfNailColor ?? body?.bfNailColc ?? 'X') ?? 'X');
		request.input('BF_COG_STAT', pick('BF_COG_STAT', body?.bfCogStat ?? 'X') ?? 'X');
		request.input('SRV_WRNG_DESC', pick('SRV_WRNG_DESC', body?.srvWrngDesc ?? body?.srvWrngD ?? '') ?? '');
		request.input('BATH_METH', pick('BATH_METH', body?.bathMeth ?? null));
		request.input('BATH_METH_NM', pick('BATH_METH_NM', body?.bathMethNm ?? '') ?? '');
		request.input('BEN_STAT', pick('BEN_STAT', body?.benStat ?? '') ?? '');
		request.input('BEF_STAT', pick('BEF_STAT', body?.befStat ?? '') ?? '');
		request.input('MOVE_STAT', pick('MOVE_STAT', body?.moveStat ?? '') ?? '');
		request.input('AFT_STAT', pick('AFT_STAT', body?.aftStat ?? '') ?? '');
		request.input('INEMPNO', pick('INEMPNO', body?.inempno ?? null));
		request.input('INEMPNO1', pick('INEMPNO1', body?.inempno1 ?? null));
		request.input('INEMPNM', pick('INEMPNM', body?.inempnm ?? '') ?? '');

		const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, CONVERT(date, @VDT, 112) AS VDT) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
            AND CONVERT(date, T.[VDT]) = S.[VDT])
      WHEN MATCHED THEN
        UPDATE SET
          [SRV_TM] = @SRV_TM,
          [AF_FACE] = @AF_FACE,
          [AF_LIP] = @AF_LIP,
          [AF_NAIL_COLOR] = @AF_NAIL_COLOR,
          [AF_COG_STAT] = @AF_COG_STAT,
          [BF_FACE] = @BF_FACE,
          [BF_LIP] = @BF_LIP,
          [BF_NAIL_COLOR] = @BF_NAIL_COLOR,
          [BF_COG_STAT] = @BF_COG_STAT,
          [SRV_WRNG_DESC] = @SRV_WRNG_DESC,
          [BATH_METH] = @BATH_METH,
          [BATH_METH_NM] = @BATH_METH_NM,
          [BEN_STAT] = @BEN_STAT,
          [BEF_STAT] = @BEF_STAT,
          [MOVE_STAT] = @MOVE_STAT,
          [AFT_STAT] = @AFT_STAT,
          [INEMPNO] = @INEMPNO,
          [INEMPNO1] = @INEMPNO1,
          [INEMPNM] = @INEMPNM
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD],[PNUM],[VDT],
          [SRV_TM],[AF_FACE],[AF_LIP],[AF_NAIL_COLOR],[AF_COG_STAT],
          [BF_FACE],[BF_LIP],[BF_NAIL_COLOR],[BF_COG_STAT],
          [SRV_WRNG_DESC],[BATH_METH],[BATH_METH_NM],
          [BEN_STAT],[BEF_STAT],[MOVE_STAT],[AFT_STAT],
          [INEMPNO],[INEMPNO1],[INEMPNM]
        )
        VALUES (
          @ANCD,@PNUM,CONVERT(date, @VDT, 112),
          @SRV_TM,@AF_FACE,@AF_LIP,@AF_NAIL_COLOR,@AF_COG_STAT,
          @BF_FACE,@BF_LIP,@BF_NAIL_COLOR,@BF_COG_STAT,
          @SRV_WRNG_DESC,@BATH_METH,@BATH_METH_NM,
          @BEN_STAT,@BEF_STAT,@MOVE_STAT,@AFT_STAT,
          @INEMPNO,@INEMPNO1,@INEMPNM
        );
    `;

		await request.query(query);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F33030 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd'); // optional
		const pnum = searchParams.get('pnum');
		const vdt = searchParams.get('vdt');

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
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', normalizePnumParam(pnum));
		request.input('VDT', vdtDigits);

		const query = `
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(char(8), [VDT], 112) = @VDT
    `;

		await request.query(query);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F33030 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

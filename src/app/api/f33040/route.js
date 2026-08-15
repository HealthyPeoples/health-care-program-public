/**
 * @file API /api/f33040 — 체위변경 F33040
 *
 * @description
 * 체위변경 F33040 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f33040/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession, parseUserInfoCookieValue } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F33040]';
const DATE_COL = 'CHNG_DT';

let ensureColumnsPromise = null;

async function ensureColumns(pool) {
	if (!pool) return;
	if (!ensureColumnsPromise) {
		ensureColumnsPromise = pool
			.request()
			.query(`
      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33040' AND c.name = N'CHNG_TM'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [CHNG_TM] VARCHAR(8) NULL;
      END

      IF NOT EXISTS (
        SELECT 1 FROM [돌봄시설DB].sys.columns c
        INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
        WHERE t.name = N'F33040' AND c.name = N'CHNG_NIGHT_EMPNO'
      )
      BEGIN
        ALTER TABLE ${TABLE_NAME} ADD [CHNG_NIGHT_EMPNO] INT NULL;
      END
    `)
			.catch((err) => {
				ensureColumnsPromise = null;
				throw err;
			});
	}
	await ensureColumnsPromise;
}

function toYmd(v) {
	if (!v) return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

function ymdToDigits(v) {
	const s = String(v ?? '').trim();
	if (!s) return '';
	return s.includes('-') ? s.replace(/-/g, '') : s;
}

function normalizeChngGu(v) {
	return String(v ?? '').trim().padStart(2, '0').slice(-2);
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
	if (/^\d{1,2}:\d{2}/.test(s)) {
		const [h, m] = s.split(':');
		return `${String(h).padStart(2, '0')}:${String(m).slice(0, 2)}`;
	}
	if (/^\d{3,4}$/.test(s)) {
		const p = s.padStart(4, '0');
		return `${p.slice(0, 2)}:${p.slice(2, 4)}`;
	}
	if (s === '2400' || s === '24:00') return '24:00';
	return '';
}

function timeToChngGu(v) {
	const hm = normalizeTimeHm(v);
	if (/^\d{2}:\d{2}$/.test(hm) && hm !== '24:00') return hm.slice(0, 2);
	return '';
}

function deriveTimeFromGu(chngGu) {
	const gu = normalizeChngGu(chngGu);
	if (!/^\d{2}$/.test(gu)) return '';
	return `${gu}:00`;
}

function mapRow(r) {
	const dt = toYmd(r[DATE_COL]);
	const tm = normalizeTimeHm(r.CHNG_TM) || deriveTimeFromGu(r.CHNG_GU);
	return {
		...r,
		[DATE_COL]: dt,
		VDT: dt,
		CHNG_GU: normalizeChngGu(r.CHNG_GU),
		CHNG_TM: tm,
		CHNG_EMPNM: r.CHNG_EMPNM ?? r.EMPNM ?? '',
		CHNG_NIGHT_EMPNM: r.CHNG_NIGHT_EMPNM ?? '',
	};
}

async function resolveEmpno(pool, sessionAncd, empnoRaw, empnmRaw) {
	if (empnoRaw != null && String(empnoRaw).trim() !== '') {
		const n = parseInt(String(empnoRaw).trim(), 10);
		return Number.isNaN(n) ? null : n;
	}

	const name = String(empnmRaw ?? '').trim();
	if (name && pool) {
		const r = await pool
			.request()
			.input('ANCD', sessionAncd)
			.input('EMPNM', name)
			.query(
				`SELECT TOP 1 [EMPNO] FROM [돌봄시설DB].[dbo].[F00120]
         WHERE [ANCD] = @ANCD AND [EMPNM] = @EMPNM`
			);
		const empno = r.recordset?.[0]?.EMPNO;
		if (empno != null) return empno;
	}

	return null;
}

async function resolveSessionEmpno(pool, sessionAncd, req) {
	const session = parseUserInfoCookieValue(req.cookies.get('user_info')?.value);
	const uid = String(session?.uid ?? '').trim();
	if (uid && pool) {
		const r = await pool
			.request()
			.input('ANCD', sessionAncd)
			.input('UID', uid)
			.query(
				`SELECT TOP 1 [EMPNO] FROM [돌봄시설DB].[dbo].[F00120]
         WHERE [ANCD] = @ANCD AND [UID] = @UID`
			);
		const empno = r.recordset?.[0]?.EMPNO;
		if (empno != null) return empno;
	}
	return null;
}

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const pnum = searchParams.get('pnum');
		const vdt = searchParams.get('vdt');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');
		const mode = (searchParams.get('mode') || '').trim();

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
		request.input('PNUM', String(pnum));

		if (mode === 'dates') {
			const q = `
        SELECT DISTINCT CONVERT(varchar(10), t.[${DATE_COL}], 120) AS ${DATE_COL}
        FROM ${TABLE_NAME} t
        WHERE t.[ANCD] = @ANCD
          AND CAST(t.[PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        ORDER BY ${DATE_COL} DESC
      `;
			const result = await request.query(q);
			const data = (result.recordset || []).map((r) => ({
				CHNG_DT: toYmd(r[DATE_COL]),
				VDT: toYmd(r[DATE_COL]),
			}));
			return jsonOk({ success: true, data, count: data.length });
		}

		let where = `
      WHERE t.[ANCD] = @ANCD
        AND CAST(t.[PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
    `;

		if (startDate && endDate) {
			const s = ymdToDigits(startDate);
			const e = ymdToDigits(endDate);
			if (!/^\d{8}$/.test(s) || !/^\d{8}$/.test(e)) {
				return jsonError({ success: false, error: 'startDate/endDate 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
			}
			request.input('START', s);
			request.input('END', e);
			where += ` AND CONVERT(char(8), t.[${DATE_COL}], 112) >= @START AND CONVERT(char(8), t.[${DATE_COL}], 112) <= @END`;
		} else if (vdt) {
			const d = ymdToDigits(vdt);
			if (!/^\d{8}$/.test(d)) {
				return jsonError({ success: false, error: 'vdt 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
			}
			request.input('CHNG_DT', d);
			where += ` AND CONVERT(char(8), t.[${DATE_COL}], 112) = @CHNG_DT`;
		} else {
			return jsonError({ success: false, error: 'vdt 또는 startDate/endDate 파라미터가 필요합니다' }, 400);
		}

		const query = `
      SELECT
        t.[ANCD],
        t.[PNUM],
        CONVERT(varchar(10), t.[${DATE_COL}], 120) AS ${DATE_COL},
        t.[CHNG_GU],
        LTRIM(RTRIM(CONVERT(varchar(8), t.[CHNG_TM]))) AS CHNG_TM,
        LTRIM(RTRIM(CONVERT(varchar(10), t.[CHNG_POSI]))) AS CHNG_POSI,
        t.[CHNG_ETC],
        t.[CHNG_EMPNO],
        t.[CHNG_NIGHT_EMPNO],
        e.[EMPNM] AS CHNG_EMPNM,
        n.[EMPNM] AS CHNG_NIGHT_EMPNM
      FROM ${TABLE_NAME} t
      LEFT JOIN [돌봄시설DB].[dbo].[F00120] e
        ON t.[ANCD] = e.[ANCD]
        AND CAST(t.[CHNG_EMPNO] AS VARCHAR) = CAST(e.[EMPNO] AS VARCHAR)
      LEFT JOIN [돌봄시설DB].[dbo].[F00120] n
        ON t.[ANCD] = n.[ANCD]
        AND CAST(t.[CHNG_NIGHT_EMPNO] AS VARCHAR) = CAST(n.[EMPNO] AS VARCHAR)
      ${where}
      ORDER BY t.[${DATE_COL}] DESC,
        CASE
          WHEN t.[CHNG_TM] IS NULL OR LTRIM(RTRIM(t.[CHNG_TM])) = '' THEN t.[CHNG_GU]
          ELSE t.[CHNG_TM]
        END ASC
    `;

		const result = await request.query(query);
		const data = (result.recordset || []).map(mapRow);

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F33040 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
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
		const vdt = body?.CHNG_DT ?? body?.chngDt ?? body?.VDT ?? body?.vdt;
		const chngTmRaw = body?.CHNG_TM ?? body?.chngTm;
		const chngGuRaw = body?.CHNG_GU ?? body?.chngGu;

		if (!pnum || !vdt) {
			return jsonError({ success: false, error: 'PNUM, CHNG_DT는 필수입니다' }, 400);
		}

		const vdtDigits = ymdToDigits(vdt);
		if (!/^\d{8}$/.test(vdtDigits)) {
			return jsonError({ success: false, error: 'CHNG_DT 형식이 올바르지 않습니다 (yyyy-mm-dd)' }, 400);
		}

		const chngTm = normalizeTimeHm(chngTmRaw) || deriveTimeFromGu(chngGuRaw);
		const chng = timeToChngGu(chngTm) || normalizeChngGu(chngGuRaw);
		if (!chngTm && !chng) {
			return jsonError({ success: false, error: 'CHNG_TM 또는 CHNG_GU는 필수입니다' }, 400);
		}

		const origTm = normalizeTimeHm(body?.originalChngTm ?? body?.ORIGINAL_CHNG_TM);
		const origGu = normalizeChngGu(body?.originalChngGu ?? body?.ORIGINAL_CHNG_GU);

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		await ensureColumns(pool);

		let chngEmpno = await resolveEmpno(
			pool,
			gate.sessionAncd,
			body?.CHNG_EMPNO ?? body?.chngEmpno,
			body?.CHNG_EMPNM ?? body?.chngEmpnm
		);
		if (chngEmpno == null) {
			chngEmpno = await resolveSessionEmpno(pool, gate.sessionAncd, req);
		}

		const nightEmpno = await resolveEmpno(
			pool,
			gate.sessionAncd,
			body?.CHNG_NIGHT_EMPNO ?? body?.chngNightEmpno,
			body?.CHNG_NIGHT_EMPNM ?? body?.chngNightEmpnm
		);

		const bindSaveInputs = (request) => {
			request.input('ANCD', gate.sessionAncd);
			request.input('PNUM', String(pnum));
			request.input('CHNG_DT', vdtDigits);
			request.input('CHNG_GU', chng);
			request.input('CHNG_TM', chngTm);
			request.input('ORIG_TM', origTm);
			request.input('ORIG_GU', origGu);
			request.input('CHNG_POSI', body?.CHNG_POSI ?? body?.chngPosi ?? '1');
			request.input('CHNG_ETC', body?.CHNG_ETC ?? body?.chngEtc ?? '');
			request.input('CHNG_EMPNO', chngEmpno);
			request.input('CHNG_NIGHT_EMPNO', nightEmpno);
			return request;
		};

		if (origTm || origGu) {
			const update = await bindSaveInputs(pool.request()).query(`
        UPDATE ${TABLE_NAME}
        SET
          [CHNG_GU] = @CHNG_GU,
          [CHNG_TM] = @CHNG_TM,
          [CHNG_POSI] = @CHNG_POSI,
          [CHNG_ETC] = @CHNG_ETC,
          [CHNG_EMPNO] = @CHNG_EMPNO,
          [CHNG_NIGHT_EMPNO] = @CHNG_NIGHT_EMPNO
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(char(8), [${DATE_COL}], 112) = @CHNG_DT
          AND (
            (@ORIG_TM <> '' AND ISNULL(LTRIM(RTRIM(CONVERT(varchar(8), [CHNG_TM]))), '') = @ORIG_TM)
            OR (
              @ORIG_TM = '' AND @ORIG_GU <> ''
              AND [CHNG_GU] = @ORIG_GU
              AND ([CHNG_TM] IS NULL OR LTRIM(RTRIM(CONVERT(varchar(8), [CHNG_TM]))) = '')
            )
          )
      `);
			const affected = update?.rowsAffected?.[0] ?? 0;
			if (affected > 0) {
				return jsonOk({ success: true });
			}
		}

		const merge = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, CONVERT(date, @CHNG_DT, 112) AS ${DATE_COL}, @CHNG_TM AS CHNG_TM) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
            AND CONVERT(date, T.[${DATE_COL}]) = S.[${DATE_COL}]
            AND ISNULL(LTRIM(RTRIM(CONVERT(varchar(8), T.[CHNG_TM]))), '') = S.CHNG_TM)
      WHEN MATCHED THEN
        UPDATE SET
          [CHNG_GU] = @CHNG_GU,
          [CHNG_POSI] = @CHNG_POSI,
          [CHNG_ETC] = @CHNG_ETC,
          [CHNG_EMPNO] = @CHNG_EMPNO,
          [CHNG_NIGHT_EMPNO] = @CHNG_NIGHT_EMPNO
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD],[PNUM],[${DATE_COL}],[CHNG_GU],[CHNG_TM],
          [CHNG_POSI],[CHNG_ETC],[CHNG_EMPNO],[CHNG_NIGHT_EMPNO]
        )
        VALUES (
          @ANCD,@PNUM,CONVERT(date, @CHNG_DT, 112),@CHNG_GU,@CHNG_TM,
          @CHNG_POSI,@CHNG_ETC,@CHNG_EMPNO,@CHNG_NIGHT_EMPNO
        );
    `;

		await bindSaveInputs(pool.request()).query(merge);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F33040 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const pnum = searchParams.get('pnum');
		const vdt = searchParams.get('vdt');
		const chngGu = searchParams.get('chngGu');
		const chngTm = searchParams.get('chngTm');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum || !vdt || (!chngGu && !chngTm)) {
			return jsonError({ success: false, error: 'pnum, vdt, chngTm 또는 chngGu 파라미터가 필요합니다' }, 400);
		}

		const vdtDigits = ymdToDigits(vdt);
		const tm = normalizeTimeHm(chngTm);
		const chng = normalizeChngGu(chngGu);
		if (!/^\d{8}$/.test(vdtDigits) || (!tm && !chng)) {
			return jsonError({ success: false, error: '파라미터 형식이 올바르지 않습니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		await ensureColumns(pool);

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));
		request.input('CHNG_DT', vdtDigits);
		request.input('CHNG_TM', tm);
		request.input('CHNG_GU', chng);

		const query = `
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(char(8), [${DATE_COL}], 112) = @CHNG_DT
        AND (
          (@CHNG_TM <> '' AND ISNULL(LTRIM(RTRIM(CONVERT(varchar(8), [CHNG_TM]))), '') = @CHNG_TM)
          OR (
            @CHNG_TM = '' AND @CHNG_GU <> ''
            AND [CHNG_GU] = @CHNG_GU
            AND ([CHNG_TM] IS NULL OR LTRIM(RTRIM(CONVERT(varchar(8), [CHNG_TM]))) = '')
          )
        )
    `;

		await request.query(query);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F33040 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

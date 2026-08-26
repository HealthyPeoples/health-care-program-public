/**
 * @file API /api/f33020 — 집중배설관찰 F33020
 *
 * @description
 * 집중배설관찰 F33020 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 * 관찰 시각(시:분)은 PK인 VTM_GU(char(2))에 담을 수 없어 VTM_ST(VARCHAR(8), HH:mm)를 추가해 저장합니다.
 * 소변/대변 양(PSS_AMT_GU, DNG_AMT_GU: 1소량 2보통 3대량), 기저귀 교환 시각(NPPY_CNG_TM)도 필요 시 ALTER 합니다.
 *
 * @module app/api/f33020/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F33020]';

let ensureColumnsPromise = null;

async function ensureColumns(pool) {
	if (!pool) return;
	if (!ensureColumnsPromise) {
		ensureColumnsPromise = pool
			.request()
			.query(`
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33020]', N'VTM_ST') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [VTM_ST] VARCHAR(8) NULL;

      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33020]', N'PSS_AMT_GU') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [PSS_AMT_GU] CHAR(1) NULL;

      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33020]', N'DNG_AMT_GU') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [DNG_AMT_GU] CHAR(1) NULL;

      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F33020]', N'NPPY_CNG_TM') IS NULL
        ALTER TABLE ${TABLE_NAME} ADD [NPPY_CNG_TM] VARCHAR(8) NULL;
    `)
			.catch((err) => {
				ensureColumnsPromise = null;
				throw err;
			});
	}
	await ensureColumnsPromise;
}

function normalizeAmtGu(v) {
	const s = String(v ?? '').trim();
	if (s === '1' || s === '2' || s === '3') return s;
	return '0';
}

function toYmd(v) {
	if (!v && v !== 0) return '';
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

function normalizeVtmGu(v) {
	const s = String(v ?? '').trim();
	if (!s) return '';
	if (/^\d+$/.test(s)) return s.padStart(2, '0').slice(-2);
	return s.slice(0, 2);
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
	return '';
}

function mapRow(r) {
	return {
		...r,
		VDT: toYmd(r.VDT),
		VTM_GU: normalizeVtmGu(r.VTM_GU),
		VTM_ST: normalizeTimeHm(r.VTM_ST),
		PSS_AMT_GU: r.PSS_AMT_GU != null ? String(r.PSS_AMT_GU).trim() : '',
		DNG_AMT_GU: r.DNG_AMT_GU != null ? String(r.DNG_AMT_GU).trim() : '',
		NPPY_CNG_TM: normalizeTimeHm(r.NPPY_CNG_TM),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNM: r.INEMPNM != null ? String(r.INEMPNM) : '',
	};
}

async function nextVtmGu(pool, ancd, pnum, vdtDigits) {
	const request = pool.request();
	request.input('ANCD', ancd);
	request.input('PNUM', String(pnum));
	request.input('VDT', vdtDigits);
	const result = await request.query(`
    SELECT ISNULL(MAX(TRY_CONVERT(int, [VTM_GU])), 0) + 1 AS NEXT_GU
    FROM ${TABLE_NAME}
    WHERE [ANCD] = @ANCD
      AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      AND CONVERT(char(8), [VDT], 112) = @VDT
  `);
	const next = Number(result.recordset?.[0]?.NEXT_GU || 1);
	if (!Number.isFinite(next) || next < 1 || next > 99) {
		throw new Error('관찰시간 일련번호(VTM_GU)를 더 생성할 수 없습니다 (최대 99건/일)');
	}
	return String(next).padStart(2, '0');
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
		} else {
			return jsonError({ success: false, error: 'vdt 또는 startDate/endDate 파라미터가 필요합니다' }, 400);
		}

		const query = `
      SELECT
        [ANCD],
        [PNUM],
        CONVERT(varchar(10), [VDT], 23) AS [VDT],
        [VTM_GU],
        [VTM_ST],
        [PSS_GU],
        [DNG_GU],
        [PSS_AMT_GU],
        [DNG_AMT_GU],
        [NPPY_CNG_GU],
        [NPPY_CNG_TM],
        [ETC],
        [INEMPNO],
        [INEMPNM]
      FROM ${TABLE_NAME}
      ${where}
      ORDER BY [VDT] DESC, COALESCE(NULLIF(LTRIM(RTRIM([VTM_ST])), ''), [VTM_GU]) ASC
    `;

		const result = await request.query(query);
		const data = (result.recordset || []).map(mapRow);

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F33020 조회 오류:', err);
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
		const vdt = body?.VDT ?? body?.vdt;
		const vtmSt = normalizeTimeHm(body?.VTM_ST ?? body?.vtmSt ?? '');
		const matchVtmGuRaw = body?.MATCH_VTM_GU ?? body?.matchVtmGu ?? '';

		if (!pnum || !vdt) {
			return jsonError({ success: false, error: 'PNUM, VDT는 필수입니다' }, 400);
		}
		if (!vtmSt) {
			return jsonError({ success: false, error: '관찰시간(VTM_ST)은 HH:mm 형식이어야 합니다' }, 400);
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

		const matchVtm = normalizeVtmGu(matchVtmGuRaw);
		const vtm = matchVtm || (await nextVtmGu(pool, gate.sessionAncd, pnum, vdtDigits));

		const etc = String(body?.ETC ?? body?.etc ?? '').slice(0, 200);
		const inempnmRaw = body?.INEMPNM ?? body?.inempnm ?? '';
		const inempnm = inempnmRaw != null && String(inempnmRaw).trim() !== ''
			? String(inempnmRaw).trim().slice(0, 20)
			: null;

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));
		request.input('VDT', vdtDigits);
		request.input('MATCH_VTM_GU', vtm);
		request.input('VTM_GU', vtm);
		request.input('VTM_ST', vtmSt);
		const pssAmt = normalizeAmtGu(body?.PSS_AMT_GU ?? body?.pssAmtGu ?? '');
		const dngAmt = normalizeAmtGu(body?.DNG_AMT_GU ?? body?.dngAmtGu ?? '');
		const nppyCngTm = normalizeTimeHm(body?.NPPY_CNG_TM ?? body?.nppyCngTm ?? '');
		const pssGu = pssAmt !== '0' ? '1' : String(body?.PSS_GU ?? body?.pssGu ?? '0');
		const dngGu = dngAmt !== '0' ? '1' : String(body?.DNG_GU ?? body?.dngGu ?? '0');

		request.input('PSS_GU', pssGu);
		request.input('DNG_GU', dngGu);
		request.input('PSS_AMT_GU', pssAmt);
		request.input('DNG_AMT_GU', dngAmt);
		request.input('NPPY_CNG_GU', body?.NPPY_CNG_GU ?? body?.nppyCngGu ?? '0');
		request.input('NPPY_CNG_TM', nppyCngTm || null);
		request.input('ETC', etc);
		request.input('INEMPNO', body?.INEMPNO ?? body?.inempno ?? null);
		request.input('INEMPNM', inempnm);

		const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, CONVERT(date, @VDT, 112) AS VDT, @MATCH_VTM_GU AS VTM_GU) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
            AND CONVERT(date, T.[VDT]) = S.[VDT]
            AND T.[VTM_GU] = S.[VTM_GU])
      WHEN MATCHED THEN
        UPDATE SET
          [VTM_ST] = @VTM_ST,
          [PSS_GU] = @PSS_GU,
          [DNG_GU] = @DNG_GU,
          [PSS_AMT_GU] = @PSS_AMT_GU,
          [DNG_AMT_GU] = @DNG_AMT_GU,
          [NPPY_CNG_GU] = @NPPY_CNG_GU,
          [NPPY_CNG_TM] = @NPPY_CNG_TM,
          [ETC] = @ETC,
          [INEMPNO] = COALESCE(@INEMPNO, T.[INEMPNO]),
          [INEMPNM] = COALESCE(@INEMPNM, T.[INEMPNM])
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[PNUM],[VDT],[VTM_GU],[VTM_ST],[PSS_GU],[DNG_GU],[PSS_AMT_GU],[DNG_AMT_GU],[NPPY_CNG_GU],[NPPY_CNG_TM],[ETC],[INEMPNO],[INEMPNM])
        VALUES (@ANCD,@PNUM,CONVERT(date, @VDT, 112),@VTM_GU,@VTM_ST,@PSS_GU,@DNG_GU,@PSS_AMT_GU,@DNG_AMT_GU,@NPPY_CNG_GU,@NPPY_CNG_TM,@ETC,@INEMPNO,@INEMPNM);
    `;

		await request.query(query);

		return jsonOk({ success: true, data: { VTM_GU: vtm } });
	} catch (err) {
		console.error('F33020 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const pnum = searchParams.get('pnum');
		const vdt = searchParams.get('vdt');
		const vtmGu = searchParams.get('vtmGu');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum || !vdt || !vtmGu) {
			return jsonError({ success: false, error: 'pnum, vdt, vtmGu 파라미터가 필요합니다' }, 400);
		}

		const vdtDigits = ymdToDigits(vdt);
		const vtm = normalizeVtmGu(vtmGu);
		if (!/^\d{8}$/.test(vdtDigits) || !vtm) {
			return jsonError({ success: false, error: '파라미터 형식이 올바르지 않습니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));
		request.input('VDT', vdtDigits);
		request.input('VTM_GU', vtm);

		const query = `
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(char(8), [VDT], 112) = @VDT
        AND [VTM_GU] = @VTM_GU
    `;

		await request.query(query);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F33020 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

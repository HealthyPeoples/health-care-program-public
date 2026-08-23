/**
 * @file API /api/f30120 — 투약 관련 F30120
 *
 * @description
 * 투약 관련 F30120 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f30120/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const { ensureF30120FromF14020, ensureF30120VsSeq } = require('../../../lib/ensureF30120FromF14020');
const { ensureF10010RoomNo } = require('../../../lib/ensureF10010RoomNo');

const F30120_SELECT = `
        f30120.[ANCD],
        f30120.[PNUM],
        f30120.[RSDT],
        f30120.[SBDS],
        f30120.[EBDS],
        f30120.[SBDP],
        f30120.[EBDP],
        f30120.[TMPBD],
        f30120.[PUCNT],
        f30120.[BRCNT],
        f30120.[WEIGHT],
        f30120.[HEIGHT],
        f30120.[BJYN],
        f30120.[BJDG],
        f30120.[BJPA],
        f30120.[NUDES],
        f30120.[INDT],
        f30120.[ETC],
        f30120.[INEMPNO],
        f30120.[INEMPNM],
        f30120.[NS_MEDI_CHK],
        f30120.[NS_JUSA_CHK],
        f30120.[NS_ACT_CHK],
        f30120.[NS_FAL_CHK],
        f30120.[NS_DRY_CHK],
        f30120.[NS_DNG_CHK],
        f30120.[NS_PAN_CHK],
        f30120.[NS_DLM_CHK],
        f30120.[NS_SORE_MNG],
        f30120.[NS_SORE_DESC],
        f30120.[NS_WRITE_NAME],
        f30120.[WATER_INTAKE],
        f30120.[DRESSING_FLAG],
        f30120.[O2_SAT],
        ISNULL(f30120.[VS_SEQ], 1) AS [VS_SEQ],
        f10010.[P_NM],
        f10010.[P_ST],
        f10010.[P_BRDT],
        f10010.[ROOM_NO],
        f10010.[P_FLOOR]
`;

let ensureO2SatPromise = null;

async function ensureO2SatColumn(pool) {
	if (!pool) return;
	if (!ensureO2SatPromise) {
		ensureO2SatPromise = pool
			.request()
			.query(
				`
      IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F30120]', N'O2_SAT') IS NULL
      BEGIN
        ALTER TABLE [돌봄시설DB].[dbo].[F30120]
        ADD [O2_SAT] DECIMAL(4,1) NULL;
      END
    `
			)
			.catch((err) => {
				ensureO2SatPromise = null;
				throw err;
			});
	}
	await ensureO2SatPromise;
}

function formatDateForDB(dateStr) {
	if (!dateStr) return null;
	if (String(dateStr).includes('-')) return String(dateStr).replace(/-/g, '');
	return String(dateStr);
}

function validateDate(dateStr) {
	if (!dateStr) return false;
	if (String(dateStr).includes('-')) return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
	return String(dateStr).length === 8 && !isNaN(dateStr);
}

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const rsdt = searchParams.get('rsdt');
		const pnum = searchParams.get('pnum');
		const ancd = searchParams.get('ancd');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');
		const scope = String(searchParams.get('scope') || '').trim();

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}
		await ensureO2SatColumn(pool);
		await ensureF30120VsSeq(pool);
		await ensureF10010RoomNo(pool, gate.sessionAncd);

		let query = `
      SELECT 
        ${F30120_SELECT}
      FROM [돌봄시설DB].[dbo].[F30120] f30120
      LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010 
        ON f30120.[ANCD] = f10010.[ANCD] 
        AND f30120.[PNUM] = f10010.[PNUM]
      WHERE 1=1
    `;

		const request = pool.request();
		request.input('sessionAncd', gate.sessionAncd);
		query += ` AND f30120.[ANCD] = @sessionAncd`;

		if (startDate && endDate) {
			if (!validateDate(startDate) || !validateDate(endDate)) {
				return jsonError(
					{ success: false, error: '날짜 형식이 올바르지 않습니다. yyyy-mm-dd 형식으로 입력해주세요.' },
					400
				);
			}
			query += ` AND f30120.[RSDT] >= @startDate AND f30120.[RSDT] <= @endDate`;
			request.input('startDate', formatDateForDB(startDate));
			request.input('endDate', formatDateForDB(endDate));
		} else if (rsdt) {
			if (!validateDate(rsdt)) {
				return jsonError(
					{ success: false, error: '날짜 형식이 올바르지 않습니다. yyyy-mm-dd 형식으로 입력해주세요.' },
					400
				);
			}
			query += ` AND f30120.[RSDT] = @rsdt`;
			request.input('rsdt', formatDateForDB(rsdt));

			// 일 급여실적(F14020)에 있는 수급자인데 활력명단이 없으면 공란 생성
			try {
				const svdtIso = String(rsdt).includes('-')
					? String(rsdt).slice(0, 10)
					: `${String(rsdt).slice(0, 4)}-${String(rsdt).slice(4, 6)}-${String(rsdt).slice(6, 8)}`;
				await ensureF30120FromF14020(pool, gate.sessionAncd, svdtIso);
			} catch (seedErr) {
				console.warn('F30120 조회 전 F14020 기준 공란 생성 경고:', seedErr);
			}
		} else {
			return jsonError({ success: false, error: 'RSDT 또는 startDate/endDate 파라미터가 필요합니다' }, 400);
		}

		if (pnum) {
			query += ` AND CAST(f30120.[PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)`;
			request.input('pnum', String(pnum));
		}

		if (scope === 'periodic') {
			query += ` AND ISNULL(f30120.[VS_SEQ], 1) = 1`;
		}

		query += ` ORDER BY f10010.[P_NM] ASC, ISNULL(f30120.[VS_SEQ], 1) ASC, f30120.[INDT] ASC`;

		const result = await request.query(query);

		return jsonOk({
			success: true,
			data: result.recordset || [],
			count: result.recordset ? result.recordset.length : 0
		});
	} catch (err) {
		console.error('F30120 테이블 조회 오류:', err);
		return jsonError({
			success: false,
			error: err.message,
			details: err.toString()
		});
	}
}

export async function POST(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}
		await ensureO2SatColumn(pool);
		await ensureF30120VsSeq(pool);

		const body = await req.json();
		const action = String(body?.action || '').trim();

		if (action === 'add') {
			const rsdtRaw = body?.rsdt ?? body?.RSDT;
			const pnum = body?.pnum ?? body?.PNUM;
			if (!rsdtRaw || pnum == null || String(pnum).trim() === '') {
				return jsonError({ success: false, error: 'rsdt, pnum이 필요합니다' }, 400);
			}
			const rsdtDigits = formatDateForDB(String(rsdtRaw));
			if (!rsdtDigits || !/^\d{8}$/.test(rsdtDigits)) {
				return jsonError({ success: false, error: 'rsdt 형식이 올바르지 않습니다' }, 400);
			}

			const now = new Date();
			const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
			const nextReq = pool.request();
			nextReq.input('ANCD', gate.sessionAncd);
			nextReq.input('PNUM', String(pnum).trim());
			nextReq.input('RSDT', rsdtDigits);
			nextReq.input('INDT', nowStr);
			nextReq.input('INEMPNM', body.INEMPNM != null ? String(body.INEMPNM).trim() || null : null);
			nextReq.input(
				'NS_WRITE_NAME',
				body.NS_WRITE_NAME != null
					? String(body.NS_WRITE_NAME).trim().slice(0, 20) || null
					: body.INEMPNM != null
						? String(body.INEMPNM).trim().slice(0, 20) || null
						: null
			);

			const result = await nextReq.query(`
				SET NOCOUNT ON;
				DECLARE @NEXT_SEQ INT;
				SELECT @NEXT_SEQ = ISNULL(MAX(ISNULL([VS_SEQ], 1)), 0) + 1
				FROM [돌봄시설DB].[dbo].[F30120]
				WHERE [ANCD] = @ANCD
					AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
					AND [RSDT] = @RSDT;

				INSERT INTO [돌봄시설DB].[dbo].[F30120] (
					[ANCD],[PNUM],[RSDT],
					[SBDS],[EBDS],[SBDP],[EBDP],[TMPBD],[PUCNT],[BRCNT],[WEIGHT],[HEIGHT],
					[BJYN],[BJDG],[BJPA],[NUDES],
					[INDT],[INEMPNM],
					[NS_MEDI_CHK],[NS_JUSA_CHK],[NS_ACT_CHK],[NS_FAL_CHK],[NS_DRY_CHK],[NS_DNG_CHK],
					[NS_PAN_CHK],[NS_DLM_CHK],[NS_SORE_MNG],[NS_SORE_DESC],[NS_WRITE_NAME],
					[WATER_INTAKE],[DRESSING_FLAG],[O2_SAT],[VS_SEQ]
				)
				VALUES (
					@ANCD,@PNUM,@RSDT,
					NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
					NULL,NULL,NULL,N'',
					@INDT,@INEMPNM,
					NULL,NULL,NULL,NULL,NULL,NULL,
					NULL,NULL,NULL,NULL,@NS_WRITE_NAME,
					NULL,NULL,NULL,@NEXT_SEQ
				);

				SELECT @NEXT_SEQ AS VS_SEQ;
			`);

			const vsSeq = Number(result.recordset?.[0]?.VS_SEQ) || 0;
			return jsonOk({ success: true, action: 'add', vsSeq, pnum: String(pnum).trim(), rsdt: rsdtDigits });
		}

		const { rsdt, pnums } = body || {};

		if (!rsdt || !Array.isArray(pnums)) {
			return jsonError({ success: false, error: 'rsdt와 pnums 배열이 필요합니다' }, 400);
		}

		const rsdtDigits = formatDateForDB(String(rsdt));
		if (!rsdtDigits || !/^\d{8}$/.test(rsdtDigits)) {
			return jsonError({ success: false, error: 'rsdt 형식이 올바르지 않습니다 (yyyy-mm-dd 또는 yyyymmdd)' }, 400);
		}

		const now = new Date();
		const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

		const results = [];
		for (let i = 0; i < pnums.length; i++) {
			const pnum = pnums[i];
			if (pnum == null || String(pnum).trim() === '') continue;

			const request = pool.request();
			request.input('ANCD', gate.sessionAncd);
			request.input('PNUM', String(pnum).trim());
			request.input('RSDT', rsdtDigits);
			request.input('INDT', nowStr);

			const query = `
        MERGE [돌봄시설DB].[dbo].[F30120] AS T
        USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @RSDT AS RSDT) AS S
          ON (T.[ANCD] = S.[ANCD] AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR) AND T.[RSDT] = S.[RSDT])
        WHEN NOT MATCHED THEN
          INSERT (
            [ANCD],[PNUM],[RSDT],
            [SBDS],[EBDS],[SBDP],[EBDP],[TMPBD],[PUCNT],[BRCNT],[WEIGHT],[HEIGHT],
            [BJYN],[BJDG],[BJPA],[NUDES],
            [INDT],
            [NS_MEDI_CHK],[NS_JUSA_CHK],[NS_ACT_CHK],[NS_FAL_CHK],[NS_DRY_CHK],[NS_DNG_CHK],
            [NS_PAN_CHK],[NS_DLM_CHK],[NS_SORE_MNG],[NS_SORE_DESC],[NS_WRITE_NAME],
            [WATER_INTAKE],[DRESSING_FLAG],[O2_SAT]
          )
          VALUES (
            @ANCD,@PNUM,@RSDT,
            NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
            NULL,NULL,NULL,'',
            @INDT,
            NULL,NULL,NULL,NULL,NULL,NULL,
            NULL,NULL,NULL,NULL,NULL,
            NULL,NULL,NULL
          );
      `;

			const result = await request.query(query);
			results.push({ index: i, pnum: String(pnum).trim(), ok: true, rowsAffected: result.rowsAffected || [] });
		}

		return jsonOk({ success: true, data: results, count: results.length });
	} catch (err) {
		console.error('F30120 저장(공란 생성) 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

/**
 * 일상(daily) / 주기(periodic) 페이지별 부분 업데이트
 * body: { rsdt, pnum, scope: 'daily'|'periodic', ...fields }
 */
export async function PUT(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}
		await ensureO2SatColumn(pool);
		await ensureF30120VsSeq(pool);

		const body = await req.json();
		const rsdtRaw = body?.rsdt ?? body?.RSDT;
		const pnum = body?.pnum ?? body?.PNUM;
		const scope = String(body?.scope || '').trim();
		const vsSeqRaw = body?.vsSeq ?? body?.VS_SEQ;
		const vsSeq = Number(vsSeqRaw);
		const seq = Number.isFinite(vsSeq) && vsSeq > 0 ? vsSeq : 1;

		if (!rsdtRaw || pnum == null || String(pnum).trim() === '') {
			return jsonError({ success: false, error: 'rsdt, pnum이 필요합니다' }, 400);
		}
		if (scope !== 'daily' && scope !== 'periodic') {
			return jsonError({ success: false, error: "scope는 'daily' 또는 'periodic' 이어야 합니다" }, 400);
		}

		const rsdtDigits = formatDateForDB(String(rsdtRaw));
		if (!rsdtDigits || !/^\d{8}$/.test(rsdtDigits)) {
			return jsonError({ success: false, error: 'rsdt 형식이 올바르지 않습니다' }, 400);
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('RSDT', sql.VarChar(8), rsdtDigits);
		request.input('VS_SEQ', sql.Int, seq);

		let setClauses = [];

		if (scope === 'daily') {
			request.input('SBDS', sql.Int, body.SBDS ?? null);
			request.input('EBDS', sql.Int, body.EBDS ?? null);
			request.input('SBDP', sql.Int, body.SBDP ?? null);
			request.input('EBDP', sql.Int, body.EBDP ?? null);
			request.input('TMPBD', sql.Decimal(3, 1), body.TMPBD ?? null);
			request.input('PUCNT', sql.Int, body.PUCNT ?? null);
			request.input('BRCNT', sql.Int, body.BRCNT ?? null);
			request.input('O2_SAT', sql.Decimal(4, 1), body.O2_SAT ?? null);
			request.input('NUDES', sql.NVarChar(2000), body.NUDES ?? '');
			request.input('INEMPNM', sql.VarChar(100), body.INEMPNM ?? null);
			request.input('NS_WRITE_NAME', sql.NVarChar(20), body.NS_WRITE_NAME ?? body.INEMPNM ?? null);
			setClauses = [
				'[SBDS] = @SBDS',
				'[EBDS] = @EBDS',
				'[SBDP] = @SBDP',
				'[EBDP] = @EBDP',
				'[TMPBD] = @TMPBD',
				'[PUCNT] = @PUCNT',
				'[BRCNT] = @BRCNT',
				'[O2_SAT] = @O2_SAT',
				'[NUDES] = @NUDES',
				'[INEMPNM] = @INEMPNM',
				'[NS_WRITE_NAME] = @NS_WRITE_NAME'
			];
		} else {
			request.input('WEIGHT', sql.Decimal(4, 1), body.WEIGHT ?? null);
			request.input('BJYN', sql.Char(1), body.BJYN ?? null);
			request.input('BJDG', sql.Char(1), body.BJDG ?? null);
			request.input('BJPA', sql.NVarChar(100), body.BJPA ?? null);
			request.input('NS_SORE_MNG', sql.Char(1), body.NS_SORE_MNG ?? null);
			request.input('NS_SORE_DESC', sql.NVarChar(500), body.NS_SORE_DESC ?? null);
			request.input('NS_MEDI_CHK', sql.Char(1), body.NS_MEDI_CHK ?? null);
			request.input('NS_JUSA_CHK', sql.Char(1), body.NS_JUSA_CHK ?? null);
			request.input('WATER_INTAKE', sql.Int, body.WATER_INTAKE ?? null);
			request.input('NS_DNG_CHK', sql.Char(1), body.NS_DNG_CHK ?? null);
			request.input('DRESSING_FLAG', sql.Char(1), body.DRESSING_FLAG ?? null);
			request.input('NS_PAN_CHK', sql.Char(1), body.NS_PAN_CHK ?? null);
			request.input('NS_FAL_CHK', sql.Char(1), body.NS_FAL_CHK ?? null);
			request.input('NS_DRY_CHK', sql.Char(1), body.NS_DRY_CHK ?? null);
			request.input('NS_DLM_CHK', sql.Char(1), body.NS_DLM_CHK ?? null);
			request.input('NS_ACT_CHK', sql.Char(1), body.NS_ACT_CHK ?? null);
			request.input('NUDES', sql.NVarChar(2000), body.NUDES ?? '');
			request.input('INEMPNM', sql.VarChar(100), body.INEMPNM ?? null);
			request.input('NS_WRITE_NAME', sql.NVarChar(20), body.NS_WRITE_NAME ?? body.INEMPNM ?? null);
			setClauses = [
				'[WEIGHT] = @WEIGHT',
				'[BJYN] = @BJYN',
				'[BJDG] = @BJDG',
				'[BJPA] = @BJPA',
				'[NS_SORE_MNG] = @NS_SORE_MNG',
				'[NS_SORE_DESC] = @NS_SORE_DESC',
				'[NS_MEDI_CHK] = @NS_MEDI_CHK',
				'[NS_JUSA_CHK] = @NS_JUSA_CHK',
				'[WATER_INTAKE] = @WATER_INTAKE',
				'[NS_DNG_CHK] = @NS_DNG_CHK',
				'[DRESSING_FLAG] = @DRESSING_FLAG',
				'[NS_PAN_CHK] = @NS_PAN_CHK',
				'[NS_FAL_CHK] = @NS_FAL_CHK',
				'[NS_DRY_CHK] = @NS_DRY_CHK',
				'[NS_DLM_CHK] = @NS_DLM_CHK',
				'[NS_ACT_CHK] = @NS_ACT_CHK',
				'[NUDES] = @NUDES',
				'[INEMPNM] = @INEMPNM',
				'[NS_WRITE_NAME] = @NS_WRITE_NAME'
			];
		}

		const result = await request.query(`
      UPDATE [돌봄시설DB].[dbo].[F30120]
      SET ${setClauses.join(',\n          ')}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND [RSDT] = @RSDT
        AND ISNULL([VS_SEQ], 1) = @VS_SEQ
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;

		if (affected === 0) {
			return jsonError({ success: false, error: '수정할 행을 찾지 못했습니다' }, 404);
		}

		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F30120 수정 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}
		await ensureO2SatColumn(pool);
		await ensureF30120VsSeq(pool);

		const rsdtRaw = searchParams.get('rsdt') || searchParams.get('RSDT');
		const pnum = searchParams.get('pnum') || searchParams.get('PNUM');
		const vsSeqRaw = searchParams.get('vsSeq') || searchParams.get('seq') || searchParams.get('VS_SEQ');
		const vsSeq = Number(vsSeqRaw);
		const seq = Number.isFinite(vsSeq) && vsSeq > 0 ? vsSeq : 0;

		if (!rsdtRaw || pnum == null || String(pnum).trim() === '' || !seq) {
			return jsonError({ success: false, error: 'rsdt, pnum, vsSeq가 필요합니다' }, 400);
		}

		const rsdtDigits = formatDateForDB(String(rsdtRaw));
		if (!rsdtDigits || !/^\d{8}$/.test(rsdtDigits)) {
			return jsonError({ success: false, error: 'rsdt 형식이 올바르지 않습니다' }, 400);
		}

		const countRes = await pool
			.request()
			.input('ANCD', gate.sessionAncd)
			.input('PNUM', String(pnum).trim())
			.input('RSDT', rsdtDigits)
			.query(`
				SELECT COUNT(1) AS CNT
				FROM [돌봄시설DB].[dbo].[F30120]
				WHERE [ANCD] = @ANCD
					AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
					AND [RSDT] = @RSDT
			`);
		const cnt = Number(countRes.recordset?.[0]?.CNT) || 0;
		if (cnt <= 1) {
			return jsonError(
				{ success: false, error: '당일 기본 행은 삭제할 수 없습니다. 추가 측정 행만 삭제할 수 있습니다.' },
				400
			);
		}

		const result = await pool
			.request()
			.input('ANCD', gate.sessionAncd)
			.input('PNUM', String(pnum).trim())
			.input('RSDT', rsdtDigits)
			.input('VS_SEQ', seq)
			.query(`
				DELETE FROM [돌봄시설DB].[dbo].[F30120]
				WHERE [ANCD] = @ANCD
					AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
					AND [RSDT] = @RSDT
					AND ISNULL([VS_SEQ], 1) = @VS_SEQ
			`);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0)
			: Number(result.rowsAffected) || 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}

		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F30120 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const CARE_COLUMNS = [
	'PH_HEAD_HELP',
	'PH_BATH_HELP',
	'PH_BATH_TM',
	'PH_BATH_METH',
	'PH_MEAL_KIND',
	'PH_MEAL_VAL',
	'PH_TOL_CNT',
	'PH_MOVE_HELP',
	'PH_CHANG_HELP',
	'PH_WORK_HELP',
	'PH_OUT_HELP',
	'PH_PS',
	'PH_WRITE_NAME',
	'RG_AID_HELP',
	'RG_TALK_HELP',
	'RG_PS',
	'RG_WRITE_NAME',
	'NS_SBDP',
	'NS_EBDP',
	'NS_TMPBD',
	'NS_HLTH_TIME',
	'NS_HLTH_HELP',
	'NS_NRSE_TIME',
	'NS_NRSE_HELP',
	'NS_ETC',
	'NS_PS',
	'NS_WRITE_NAME',
	'NS_SORE_CHK',
	'NS_SORE_MNG',
	'NS_SORE_DESC',
	'NS_MEDI_CHK',
	'FN_COGN_HELP',
	'FN_MOVE_HELP',
	'FN_MIND_HELP',
	'FN_MIND_TRAIN',
	'FN_PHY_HELP',
	'FN_PS',
	'FN_WRITE_NAME',
	'IO_TM_INFO',
	'ROOM_NO',
	'GINFO'
];

const MEAL_COLUMNS = [
	'ST_PLAC',
	'ST_KIND',
	'GYN',
	'MOST',
	'LCST',
	'DNST',
	'MGST',
	'AGST',
	'DGST',
	'MOVOL',
	'LCVOL',
	'DNVOL',
	'MGVOL',
	'AGVOL',
	'DGVOL',
	'ST_ETC',
	'ST_CONF',
	'PAY_COM_GU',
	'IO_TM_INFO'
];

function validateDate(dateStr) {
	if (!dateStr) return false;
	if (dateStr.includes('-')) return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
	return dateStr.length === 8 && !isNaN(dateStr);
}

function toSvdtIso(dateStr) {
	const s = String(dateStr || '').trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const digits = s.replace(/\D/g, '');
	if (/^\d{8}$/.test(digits)) {
		return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
	}
	return s;
}

function pickRowValue(r, key) {
	if (r == null) return undefined;
	if (Object.prototype.hasOwnProperty.call(r, key)) return r[key];
	const lower = String(key).toLowerCase();
	const found = Object.keys(r).find((k) => k.toLowerCase() === lower);
	return found != null ? r[found] : undefined;
}

function normalizeCareValue(key, value) {
	if (value == null) return null;
	if (key === 'PH_BATH_TM' || key === 'PH_TOL_CNT' || key === 'NS_SBDP' || key === 'NS_EBDP' || key === 'NS_HLTH_TIME' || key === 'NS_NRSE_TIME') {
		const s = String(value).trim();
		if (s === '') return null;
		const n = Number(s);
		return Number.isFinite(n) ? n : null;
	}
	if (key === 'NS_TMPBD') {
		const s = String(value).trim();
		if (s === '') return null;
		const n = Number(s);
		return Number.isFinite(n) ? n : null;
	}
	return String(value);
}

/** 최신 이전 실적이 외박(GYN=2)이고 당일 F14020이 없는 수급자 (복귀 전) */
async function fetchOvernightPending(pool, ancd, svdtIso) {
	const request = pool.request();
	request.input('ANCD', ancd);
	request.input('SVDT', svdtIso);
	const result = await request.query(`
		;WITH latest_prev AS (
			SELECT
				f.*,
				ROW_NUMBER() OVER (
					PARTITION BY f.[ANCD], f.[PNUM]
					ORDER BY f.[SVDT] DESC
				) AS rn
			FROM [돌봄시설DB].[dbo].[F14020] f
			WHERE f.[ANCD] = @ANCD
				AND f.[SVDT] < CAST(@SVDT AS date)
		)
		SELECT
			prev.[ANCD],
			prev.[PNUM],
			prev.[SVDT] AS PREV_SVDT,
			prev.[GYN] AS PREV_GYN,
			prev.[IO_TM_INFO] AS PREV_IO_TM_INFO,
			prev.[ST_KIND] AS PREV_ST_KIND,
			prev.[ST_PLAC] AS PREV_ST_PLAC,
			f10010.[P_NM],
			f10010.[P_BRDT]
		FROM latest_prev prev
		LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010
			ON prev.[ANCD] = f10010.[ANCD]
			AND prev.[PNUM] = f10010.[PNUM]
		WHERE prev.rn = 1
			AND LTRIM(RTRIM(CAST(prev.[GYN] AS VARCHAR(10)))) = '2'
			AND NOT EXISTS (
				SELECT 1
				FROM [돌봄시설DB].[dbo].[F14020] today
				WHERE today.[ANCD] = prev.[ANCD]
					AND CAST(today.[PNUM] AS VARCHAR) = CAST(prev.[PNUM] AS VARCHAR)
					AND today.[SVDT] = CAST(@SVDT AS date)
			)
		ORDER BY f10010.[P_NM] ASC
	`);
	return result.recordset || [];
}

function padTime5Server(t) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
	if (!m) return '';
	return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

function calcReturnPayComGu(returnTime) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(returnTime || '').trim());
	if (!m) return '0';
	const minutes = Number(m[1]) * 60 + Number(m[2]);
	if (!Number.isFinite(minutes)) return '0';
	const facilityHours = (24 * 60 - minutes) / 60;
	return facilityHours >= 12 ? '0' : '1';
}

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const svdt = searchParams.get('svdt');
		const pnum = searchParams.get('pnum');
		const ancd = searchParams.get('ancd');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');

		const overnightPending = searchParams.get('overnightPending');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		// 외박 복귀 대기 목록 (전일 GYN=2, 당일 미생성)
		if (overnightPending === '1' || overnightPending === 'true') {
			if (!svdt || !validateDate(svdt)) {
				return jsonError({ success: false, error: 'svdt 파라미터가 필요합니다' }, 400);
			}
			const svdtIso = toSvdtIso(svdt);
			const data = await fetchOvernightPending(pool, gate.sessionAncd, svdtIso);
			return jsonOk({ success: true, data, count: data.length, svdt: svdtIso });
		}

		let query = `
      SELECT
        f14020.*,
        f10010.[P_NM],
        f10010.[P_BRDT],
        ROW_NUMBER() OVER (ORDER BY f14020.[SVDT] ASC, f14020.[INDT] DESC) as MENUM
      FROM [돌봄시설DB].[dbo].[F14020] f14020
      LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010
        ON f14020.[ANCD] = f10010.[ANCD]
        AND f14020.[PNUM] = f10010.[PNUM]
      WHERE 1=1
    `;

		const request = pool.request();
		request.input('sessionAncd', gate.sessionAncd);
		query += ` AND f14020.[ANCD] = @sessionAncd`;

		if (startDate && endDate) {
			if (!validateDate(startDate) || !validateDate(endDate)) {
				return jsonError({
						success: false,
						error: '날짜 형식이 올바르지 않습니다. yyyy-mm-dd 형식으로 입력해주세요.'
					}, 400);
			}
			query += ` AND f14020.[SVDT] >= @startDate AND f14020.[SVDT] <= @endDate`;
			request.input('startDate', toSvdtIso(startDate));
			request.input('endDate', toSvdtIso(endDate));
		} else if (svdt) {
			if (!validateDate(svdt)) {
				return jsonError({
						success: false,
						error: '날짜 형식이 올바르지 않습니다. yyyy-mm-dd 형식으로 입력해주세요.'
					}, 400);
			}
			query += ` AND f14020.[SVDT] = @svdt`;
			request.input('svdt', toSvdtIso(svdt));
		} else {
			return jsonError({ success: false, error: 'SVDT 또는 startDate/endDate 파라미터가 필요합니다' }, 400);
		}

		if (pnum) {
			query += ` AND CAST(f14020.[PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)`;
			request.input('pnum', String(pnum));
		}

		query += ` ORDER BY f14020.[SVDT] ASC, f14020.[INDT] DESC`;

		const result = await request.query(query);

		return jsonOk({
				success: true,
				data: result.recordset || [],
				count: result.recordset ? result.recordset.length : 0
			});
	} catch (err) {
		console.error('F14020 테이블 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
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

		const body = await req.json();
		const { svdt, rows, action } = body || {};

		const svdtIso = toSvdtIso(svdt);
		if (!svdt || !/^\d{4}-\d{2}-\d{2}$/.test(svdtIso)) {
			return jsonError({ success: false, error: 'svdt 형식이 올바르지 않습니다 (yyyy-mm-dd 또는 yyyymmdd)' }, 400);
		}

		// 전체추가: Usp_P14020 (출석부/약물/목욕 일괄 생성)
		if (action === 'generate' || action === 'usp_p14020') {
			const ancdNum = Number(gate.sessionAncd);
			if (!Number.isFinite(ancdNum)) {
				return jsonError({ success: false, error: '세션 기관코드(ANCD)가 올바르지 않습니다' }, 401);
			}

			await pool
				.request()
				.input('pv_ancd', sql.Int, ancdNum)
				.input('pv_svdt', sql.Date, svdtIso)
				.execute('[돌봄시설DB].[dbo].[Usp_P14020]');

			const overnightPending = await fetchOvernightPending(pool, gate.sessionAncd, svdtIso);

			return jsonOk({
				success: true,
				action: 'generate',
				ancd: ancdNum,
				svdt: svdtIso,
				overnightPending,
				overnightPendingCount: overnightPending.length
			});
		}

		// 외박 복귀 처리: 당일 F14020 생성 (GYN=1, IO_TM_INFO=R:복귀시각)
		if (action === 'returnFromOvernight') {
			if (!Array.isArray(rows) || rows.length === 0) {
				return jsonError({ success: false, error: '복귀 처리할 rows가 필요합니다' }, 400);
			}

			const pending = await fetchOvernightPending(pool, gate.sessionAncd, svdtIso);
			const pendingByPnum = new Map(
				pending.map((p) => [String(p.PNUM ?? '').trim(), p])
			);

			const now = new Date();
			const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
			const results = [];

			for (let i = 0; i < rows.length; i++) {
				const r = rows[i] || {};
				const pnum = String(r.pnum ?? r.PNUM ?? '').trim();
				const returnTime = padTime5Server(r.returnTime ?? r.RETURN_TIME ?? '');
				if (!pnum || !returnTime) {
					results.push({ index: i, pnum, ok: false, error: 'pnum/returnTime 필요' });
					continue;
				}
				const prev = pendingByPnum.get(pnum);
				if (!prev) {
					results.push({ index: i, pnum, ok: false, error: '외박 복귀 대상이 아님' });
					continue;
				}

				const payComGu = calcReturnPayComGu(returnTime);
				const stKind = String(prev.PREV_ST_KIND ?? r.mealType ?? r.ST_KIND ?? '1');
				const stPlac = String(prev.PREV_ST_PLAC ?? r.mealLocation ?? r.ST_PLAC ?? '식장');

				const request = pool.request();
				request.input('ANCD', gate.sessionAncd);
				request.input('PNUM', pnum);
				request.input('SVDT', svdtIso);
				request.input('INDT', nowStr);
				request.input('GYN', '1');
				request.input('ST_KIND', stKind);
				request.input('ST_PLAC', stPlac);
				request.input('PAY_COM_GU', payComGu);
				request.input('IO_TM_INFO', `R:${returnTime}`);
				request.input('MOST', '1');
				request.input('LCST', '1');
				request.input('DNST', '1');
				request.input('MGST', '1');
				request.input('AGST', '1');

				await request.query(`
					MERGE [돌봄시설DB].[dbo].[F14020] AS T
					USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @SVDT AS SVDT) AS S
						ON (T.[ANCD] = S.[ANCD] AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR) AND T.[SVDT] = S.[SVDT])
					WHEN MATCHED THEN
						UPDATE SET
							[INDT] = @INDT,
							[GYN] = @GYN,
							[ST_KIND] = @ST_KIND,
							[ST_PLAC] = @ST_PLAC,
							[PAY_COM_GU] = @PAY_COM_GU,
							[IO_TM_INFO] = @IO_TM_INFO,
							[MOST] = @MOST,
							[LCST] = @LCST,
							[DNST] = @DNST,
							[MGST] = @MGST,
							[AGST] = @AGST
					WHEN NOT MATCHED THEN
						INSERT ([ANCD],[PNUM],[SVDT],[INDT],[GYN],[ST_KIND],[ST_PLAC],[PAY_COM_GU],[IO_TM_INFO],[MOST],[LCST],[DNST],[MGST],[AGST])
						VALUES (@ANCD,@PNUM,@SVDT,@INDT,@GYN,@ST_KIND,@ST_PLAC,@PAY_COM_GU,@IO_TM_INFO,@MOST,@LCST,@DNST,@MGST,@AGST);
				`);
				results.push({ index: i, pnum, ok: true, returnTime, payComGu });
			}

			return jsonOk({
				success: true,
				action: 'returnFromOvernight',
				svdt: svdtIso,
				data: results,
				count: results.filter((x) => x.ok).length
			});
		}

		if (!Array.isArray(rows)) {
			return jsonError({ success: false, error: 'svdt와 rows 배열이 필요합니다 (또는 action: generate / returnFromOvernight)' }, 400);
		}

		const now = new Date();
		const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

		const results = [];
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i] || {};
			const pnum = r.pnum ?? r.PNUM;
			if (!pnum) continue;

			const request = pool.request();
			request.input('ANCD', gate.sessionAncd);
			request.input('PNUM', String(pnum));
			request.input('SVDT', svdtIso);
			request.input('INDT', nowStr);

			const mealValues = {
				ST_PLAC: r.mealLocation ?? r.ST_PLAC,
				ST_KIND: r.mealType ?? r.ST_KIND,
				GYN: r.gyn ?? r.GYN,
				MOST: r.most ?? r.MOST ?? r.mealStatus?.breakfast,
				LCST: r.lcst ?? r.LCST ?? r.mealStatus?.lunch,
				DNST: r.dnst ?? r.DNST ?? r.mealStatus?.dinner,
				MGST: r.mgst ?? r.MGST ?? r.snackStatus?.morning,
				AGST: r.agst ?? r.AGST ?? r.snackStatus?.afternoon,
				DGST: r.dgst ?? r.DGST,
				MOVOL: r.movol ?? r.MOVOL,
				LCVOL: r.lcvol ?? r.LCVOL,
				DNVOL: r.dnvol ?? r.DNVOL,
				MGVOL: r.mgvol ?? r.MGVOL,
				AGVOL: r.agvol ?? r.AGVOL,
				DGVOL: r.dgvol ?? r.DGVOL,
				ST_ETC: r.specialNotes ?? r.ST_ETC,
				ST_CONF: r.stConf ?? r.ST_CONF,
				PAY_COM_GU: r.payComGu ?? r.PAY_COM_GU,
				IO_TM_INFO: r.ioTmInfo ?? r.IO_TM_INFO
			};

			const providedMealKeys = MEAL_COLUMNS.filter((k) => mealValues[k] !== undefined);
			const providedCareKeys = CARE_COLUMNS.filter((k) => pickRowValue(r, k) !== undefined);

			providedMealKeys.forEach((k) => {
				const v = mealValues[k];
				request.input(k, v == null ? '' : String(v));
			});
			providedCareKeys.forEach((k) => {
				request.input(k, normalizeCareValue(k, pickRowValue(r, k)));
			});

			const updateParts = ['[INDT] = @INDT'];
			providedMealKeys.forEach((k) => updateParts.push(`[${k}] = @${k}`));
			providedCareKeys.forEach((k) => updateParts.push(`[${k}] = @${k}`));

			const insertCols = ['ANCD', 'PNUM', 'SVDT', 'INDT', ...providedMealKeys, ...providedCareKeys];
			const insertVals = insertCols.map((k) => `@${k}`);

			const query = `
        MERGE [돌봄시설DB].[dbo].[F14020] AS T
        USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @SVDT AS SVDT) AS S
          ON (T.[ANCD] = S.[ANCD] AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR) AND T.[SVDT] = S.[SVDT])
        WHEN MATCHED THEN
          UPDATE SET
            ${updateParts.join(',\n            ')}
        WHEN NOT MATCHED THEN
          INSERT (${insertCols.map((k) => `[${k}]`).join(',')})
          VALUES (${insertVals.join(',')});
      `;

			const result = await request.query(query);
			results.push({ index: i, pnum: String(pnum), ok: true, rowsAffected: result.rowsAffected || [] });
		}

		return jsonOk({ success: true, data: results, count: results.length });
	} catch (err) {
		console.error('F14020 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const pnum = searchParams.get('pnum');
		const svdt = searchParams.get('svdt');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum || !svdt) {
			return jsonError({ success: false, error: 'pnum, svdt 파라미터가 필요합니다' }, 400);
		}

		const svdtIso = toSvdtIso(svdt);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(svdtIso)) {
			return jsonError({ success: false, error: 'svdt 형식이 올바르지 않습니다 (yyyy-mm-dd 또는 yyyymmdd)' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', gate.sessionAncd);
		request.input('PNUM', String(pnum));
		request.input('SVDT', svdtIso);

		const query = `
      DELETE FROM [돌봄시설DB].[dbo].[F14020]
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND [SVDT] = @SVDT
    `;

		await request.query(query);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F14020 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

import { connPool } from '../../../config/server';
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
	'ST_CONF'
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

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const svdt = searchParams.get('svdt');
		const pnum = searchParams.get('pnum');
		const ancd = searchParams.get('ancd');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
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
		const { svdt, rows } = body || {};

		if (!svdt || !Array.isArray(rows)) {
			return jsonError({ success: false, error: 'svdt와 rows 배열이 필요합니다' }, 400);
		}

		const svdtIso = toSvdtIso(svdt);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(svdtIso)) {
			return jsonError({ success: false, error: 'svdt 형식이 올바르지 않습니다 (yyyy-mm-dd 또는 yyyymmdd)' }, 400);
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
				ST_CONF: r.stConf ?? r.ST_CONF
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

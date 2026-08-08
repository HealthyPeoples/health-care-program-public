/**
 * @file API `/api/f14020` — 일 수급자급여실적(F14020) CRUD 및 특수 액션
 *
 * @description
 * 식사·케어 필드 MERGE, 전체추가(generate), 외박복귀(returnFromOvernight),
 * 입퇴소 급여50% 동기화(syncAdmitDischargePay), 간식일괄(bulkSnack)을 처리합니다.
 * F14020 생성·저장 시 활력증상(F30120) 공란 명단도 함께 보장합니다.
 * 모든 핸들러는 `assertAnCdMatchesSession`으로 세션 ANCD를 검사합니다.
 *
 * @actions
 * | method | action / 용도 |
 * |--------|----------------|
 * | GET    | 일자별 목록, overnightPending |
 * | POST   | rows MERGE, generate, returnFromOvernight, syncAdmitDischargePay, bulkSnack |
 * | DELETE | 행 삭제 + OUTING_INFO 동기화 |
 *
 * @see src/lib/outingF14020Sync.js
 * @see DailyBeneficiaryPerformance.tsx
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';

const {
	syncOutingFromF14020Row,
	syncOutingOnF14020Delete
} = require('../../../lib/outingF14020Sync');

const { ensureF30120FromF14020 } = require('../../../lib/ensureF30120FromF14020');
const { applyMealSnackByPresence } = require('../../../lib/applyMealSnackByPresence');

/** @type {string[]} 일일 케어(요양·간호·재활 등) 컬럼 — DailyLongtermCare와 공유 */
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
	'ROOM_NO',
	'GINFO'
];

/** @type {string[]} 식사·외출·급여50% 관련 컬럼 — 일 수급자급여실적 화면 */
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

/** YYYY-MM-DD 또는 YYYYMMDD 형식인지 검사합니다. */
function validateDate(dateStr) {
	if (!dateStr) return false;
	if (dateStr.includes('-')) return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
	return dateStr.length === 8 && !isNaN(dateStr);
}

/**
 * SVDT용 날짜를 `YYYY-MM-DD`로 정규화합니다.
 * @param {string|Date|null|undefined} dateStr
 * @returns {string}
 */
function toSvdtIso(dateStr) {
	if (dateStr == null || dateStr === '') return '';
	if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) {
		const y = dateStr.getFullYear();
		const m = String(dateStr.getMonth() + 1).padStart(2, '0');
		const d = String(dateStr.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(dateStr).trim();
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

function parseOvernightOngoingIo(info) {
	const s = String(info || '').trim();
	// ON:YYYY-MM-DD|HH:mm
	const strict = /^ON:(\d{4}-\d{2}-\d{2})\|(\d{1,2}:\d{2})$/i.exec(s);
	if (strict) return { leaveDate: strict[1], leaveTime: padTime5Server(strict[2]) };
	// 과거 깨진 값 보정: ON:<날짜문자열>|HH:mm
	const loose = /^ON:(.+)\|(\d{1,2}:\d{2})$/i.exec(s);
	if (loose) {
		const leaveDate = toSvdtIso(loose[1]);
		const leaveTime = padTime5Server(loose[2]);
		if (leaveDate && leaveTime) return { leaveDate, leaveTime };
	}
	return null;
}

function extractLeaveTimeFromIo(info) {
	const ongoing = parseOvernightOngoingIo(info);
	if (ongoing?.leaveTime) return ongoing.leaveTime;
	const s = String(info || '').trim();
	const single = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*[~\-–]?\s*$/.exec(s);
	if (single) return padTime5Server(`${single[1]}:${single[2]}`);
	return '';
}

/**
 * 외박 복귀 모달용 대기 목록.
 * 당일 외박중(ON:) 또는 이전 실적이 외박(GYN=2)인데 당일 행이 없는 수급자.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {number|string} ancd
 * @param {string} svdtIso - YYYY-MM-DD
 */
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
		),
		today_ongoing AS (
			SELECT
				today.[ANCD],
				today.[PNUM],
				today.[SVDT],
				today.[GYN],
				today.[IO_TM_INFO],
				today.[ST_KIND],
				today.[ST_PLAC],
				f10010.[P_NM],
				f10010.[P_BRDT]
			FROM [돌봄시설DB].[dbo].[F14020] today
			LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010
				ON today.[ANCD] = f10010.[ANCD]
				AND today.[PNUM] = f10010.[PNUM]
			WHERE today.[ANCD] = @ANCD
				AND today.[SVDT] = CAST(@SVDT AS date)
				AND LTRIM(RTRIM(CAST(today.[GYN] AS VARCHAR(10)))) = '2'
				AND today.[IO_TM_INFO] LIKE 'ON:%'
		),
		prev_pending AS (
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
		)
		SELECT
			t.[ANCD],
			t.[PNUM],
			CAST(NULL AS date) AS PREV_SVDT,
			t.[GYN] AS PREV_GYN,
			t.[IO_TM_INFO] AS PREV_IO_TM_INFO,
			t.[ST_KIND] AS PREV_ST_KIND,
			t.[ST_PLAC] AS PREV_ST_PLAC,
			t.[P_NM],
			t.[P_BRDT],
			1 AS FROM_TODAY
		FROM today_ongoing t
		UNION ALL
		SELECT
			p.[ANCD],
			p.[PNUM],
			p.[PREV_SVDT],
			p.[PREV_GYN],
			p.[PREV_IO_TM_INFO],
			p.[PREV_ST_KIND],
			p.[PREV_ST_PLAC],
			p.[P_NM],
			p.[P_BRDT],
			0 AS FROM_TODAY
		FROM prev_pending p
		ORDER BY [P_NM] ASC
	`);

	return (result.recordset || []).map((row) => {
		const ongoing = parseOvernightOngoingIo(row.PREV_IO_TM_INFO);
		const prevSvdt = ongoing?.leaveDate || toSvdtIso(row.PREV_SVDT) || '';
		const prevIo = ongoing
			? ongoing.leaveTime
			: extractLeaveTimeFromIo(row.PREV_IO_TM_INFO) || String(row.PREV_IO_TM_INFO || '');
		return {
			...row,
			PREV_SVDT: prevSvdt,
			PREV_IO_TM_INFO: prevIo,
			LEAVE_DATE: prevSvdt,
			LEAVE_TIME: ongoing?.leaveTime || extractLeaveTimeFromIo(row.PREV_IO_TM_INFO)
		};
	});
}

async function upsertOvernightOngoingRow(pool, ancd, svdtIso, pendingRow) {
	const pnum = String(pendingRow.PNUM ?? '').trim();
	if (!pnum) return null;

	const leaveDate =
		toSvdtIso(pendingRow.LEAVE_DATE || pendingRow.PREV_SVDT) ||
		parseOvernightOngoingIo(pendingRow.PREV_IO_TM_INFO)?.leaveDate ||
		'';
	const leaveTime =
		padTime5Server(pendingRow.LEAVE_TIME) ||
		extractLeaveTimeFromIo(pendingRow.PREV_IO_TM_INFO) ||
		'00:00';
	const ioTmInfo = leaveDate ? `ON:${leaveDate}|${leaveTime}` : leaveTime;
	const stKind = String(pendingRow.PREV_ST_KIND ?? '1');
	const stPlac = String(pendingRow.PREV_ST_PLAC ?? '식장');
	const now = new Date();
	const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

	const request = pool.request();
	request.input('ANCD', ancd);
	request.input('PNUM', pnum);
	request.input('SVDT', svdtIso);
	request.input('INDT', nowStr);
	request.input('GYN', '2');
	request.input('ST_KIND', stKind);
	request.input('ST_PLAC', stPlac);
	request.input('PAY_COM_GU', '1');
	request.input('IO_TM_INFO', ioTmInfo);
	// 외박중: 식사/간식 미체크('2')
	request.input('MOST', '2');
	request.input('LCST', '2');
	request.input('DNST', '2');
	request.input('MGST', '2');
	request.input('AGST', '2');
	request.input('DGST', '2');

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
				[AGST] = @AGST,
				[DGST] = @DGST
		WHEN NOT MATCHED THEN
			INSERT ([ANCD],[PNUM],[SVDT],[INDT],[GYN],[ST_KIND],[ST_PLAC],[PAY_COM_GU],[IO_TM_INFO],[MOST],[LCST],[DNST],[MGST],[AGST],[DGST])
			VALUES (@ANCD,@PNUM,@SVDT,@INDT,@GYN,@ST_KIND,@ST_PLAC,@PAY_COM_GU,@IO_TM_INFO,@MOST,@LCST,@DNST,@MGST,@AGST,@DGST);
	`);

	return { pnum, leaveDate, leaveTime, ioTmInfo };
}

function padTime5Server(t) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
	if (!m) return '';
	return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

/** 외박 복귀일: 시간 무관 100% */
function calcReturnPayComGu(_returnTime) {
	return '0';
}

/**
 * 입소 당일: 입소시각~24시 체류 ≤12h 이면 PAY_COM_GU=1(50%).
 * @param {string} admitTime - HH:mm
 * @returns {'0'|'1'}
 */
function calcAdmitPayComGu(admitTime) {
	const t = padTime5Server(admitTime);
	const m = /^(\d{1,2}):(\d{2})$/.exec(t);
	if (!m) return '0';
	const minutes = Number(m[1]) * 60 + Number(m[2]);
	if (!Number.isFinite(minutes)) return '0';
	const facilityHours = (24 * 60 - minutes) / 60;
	return facilityHours <= 12 ? '1' : '0';
}

/**
 * 퇴소 당일: 0시~퇴소시각 체류 ≤12h 이면 PAY_COM_GU=1(50%).
 * @param {string} dischargeTime - HH:mm
 * @returns {'0'|'1'}
 */
function calcDischargePayComGu(dischargeTime) {
	const t = padTime5Server(dischargeTime);
	const m = /^(\d{1,2}):(\d{2})$/.exec(t);
	if (!m) return '0';
	const minutes = Number(m[1]) * 60 + Number(m[2]);
	if (!Number.isFinite(minutes)) return '0';
	return minutes / 60 <= 12 ? '1' : '0';
}

/**
 * 일자별 F14020 목록 또는 overnightPending 조회.
 * @param {Request} req - query: ancd, svdt, action?
 */
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
        f10010.[P_SDT],
        f10010.[P_SDT_TM],
        f10010.[P_EDT],
        f10010.[P_EDT_TM],
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

/**
 * 실적 저장(MERGE) 및 특수 액션(generate / returnFromOvernight / syncAdmitDischargePay / bulkSnack).
 * 저장 후 {@link syncOutingFromF14020Row}로 외출대장을 동기화합니다.
 *
 * @param {Request} req
 * @remarks
 * returnFromOvernight의 WHEN MATCHED는 식사 컬럼을 '1'로 덮어쓸 수 있습니다.
 */
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

			// SP 이후에도 당일 행이 없는 외박중 수급자를 50%·외박중으로 등록
			const overnightPendingBefore = await fetchOvernightPending(pool, gate.sessionAncd, svdtIso);
			const registered = [];
			for (const row of overnightPendingBefore) {
				if (Number(row.FROM_TODAY) === 1) continue; // 이미 당일 외박중
				try {
					const r = await upsertOvernightOngoingRow(pool, gate.sessionAncd, svdtIso, row);
					if (r) registered.push({ ...row, ...r });
				} catch (e) {
					console.warn('외박중 수급자 당일 실적 등록 경고:', e);
				}
			}

			const overnightPending = await fetchOvernightPending(pool, gate.sessionAncd, svdtIso);

			// 외출·외박 시각 기준 식사/간식 체크 자동 반영 (원내 없으면 미체크)
			let mealSnackApplied = { ok: false, updated: 0 };
			try {
				mealSnackApplied = await applyMealSnackByPresence(pool, gate.sessionAncd, svdtIso);
			} catch (mealErr) {
				console.warn('전체추가 후 식사/간식 자동 반영 경고:', mealErr);
			}

			// 당일 급여실적 명단 → 활력증상(F30120) 공란 명단 보장
			let vitalSeed = { ok: false, inserted: 0 };
			try {
				vitalSeed = await ensureF30120FromF14020(pool, gate.sessionAncd, svdtIso);
			} catch (vitalErr) {
				console.warn('전체추가 후 F30120 공란 생성 경고:', vitalErr);
			}

			return jsonOk({
				success: true,
				action: 'generate',
				ancd: ancdNum,
				svdt: svdtIso,
				overnightPending,
				overnightPendingCount: overnightPending.length,
				overnightRegisteredCount: registered.length,
				mealSnackUpdated: mealSnackApplied.updated,
				vitalSignsSeeded: vitalSeed.inserted
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
				request.input('DGST', '1');

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
							[AGST] = @AGST,
							[DGST] = @DGST
					WHEN NOT MATCHED THEN
						INSERT ([ANCD],[PNUM],[SVDT],[INDT],[GYN],[ST_KIND],[ST_PLAC],[PAY_COM_GU],[IO_TM_INFO],[MOST],[LCST],[DNST],[MGST],[AGST],[DGST])
						VALUES (@ANCD,@PNUM,@SVDT,@INDT,@GYN,@ST_KIND,@ST_PLAC,@PAY_COM_GU,@IO_TM_INFO,@MOST,@LCST,@DNST,@MGST,@AGST,@DGST);
				`);

				try {
					await syncOutingFromF14020Row(pool, gate.sessionAncd, {
						pnum,
						svdt: svdtIso,
						gyn: '1',
						ioTmInfo: `R:${returnTime}`
					});
				} catch (syncErr) {
					console.warn('외박 복귀 → OUTING_INFO 동기화 경고:', syncErr);
				}

				results.push({ index: i, pnum, ok: true, returnTime, payComGu });
			}

			const okPnums = results.filter((x) => x.ok && x.pnum).map((x) => x.pnum);
			try {
				await ensureF30120FromF14020(pool, gate.sessionAncd, svdtIso, okPnums);
			} catch (vitalErr) {
				console.warn('외박복귀 후 F30120 공란 생성 경고:', vitalErr);
			}

			return jsonOk({
				success: true,
				action: 'returnFromOvernight',
				svdt: svdtIso,
				data: results,
				count: results.filter((x) => x.ok).length
			});
		}

		// 입소/퇴소: 당일 실적 없으면 생성, 있으면 PAY_COM_GU(급여50%)만 반영
		if (action === 'syncAdmitDischargePay') {
			if (!Array.isArray(rows) || rows.length === 0) {
				return jsonError({ success: false, error: '입·퇴소 동기화 rows가 필요합니다' }, 400);
			}

			const now = new Date();
			const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
			const results = [];

			for (let i = 0; i < rows.length; i++) {
				const r = rows[i] || {};
				const pnum = String(r.pnum ?? r.PNUM ?? '').trim();
				const kind = String(r.kind ?? r.KIND ?? '').trim().toLowerCase();
				const time = padTime5Server(r.time ?? r.TIME ?? r.tm ?? '');
				if (!pnum || !time || (kind !== 'admit' && kind !== 'discharge')) {
					results.push({ index: i, pnum, ok: false, error: 'pnum/kind(admit|discharge)/time 필요' });
					continue;
				}

				const payComGu = kind === 'admit' ? calcAdmitPayComGu(time) : calcDischargePayComGu(time);

				const request = pool.request();
				request.input('ANCD', gate.sessionAncd);
				request.input('PNUM', pnum);
				request.input('SVDT', svdtIso);
				request.input('INDT', nowStr);
				request.input('PAY_COM_GU', payComGu);

				await request.query(`
					MERGE [돌봄시설DB].[dbo].[F14020] AS T
					USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @SVDT AS SVDT) AS S
						ON (T.[ANCD] = S.[ANCD] AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR) AND T.[SVDT] = S.[SVDT])
					WHEN MATCHED THEN
						UPDATE SET
							[INDT] = @INDT,
							[PAY_COM_GU] = @PAY_COM_GU
					WHEN NOT MATCHED THEN
						INSERT ([ANCD],[PNUM],[SVDT],[INDT],[GYN],[ST_KIND],[ST_PLAC],[PAY_COM_GU],[IO_TM_INFO],[MOST],[LCST],[DNST],[MGST],[AGST],[DGST])
						VALUES (@ANCD,@PNUM,@SVDT,@INDT,'1','1',N'식장',@PAY_COM_GU,'','1','1','1','1','1','1');
				`);

				results.push({ index: i, pnum, ok: true, kind, time, payComGu });
			}

			const okPnums = results.filter((x) => x.ok && x.pnum).map((x) => x.pnum);
			try {
				await ensureF30120FromF14020(pool, gate.sessionAncd, svdtIso, okPnums);
			} catch (vitalErr) {
				console.warn('입·퇴소 동기화 후 F30120 공란 생성 경고:', vitalErr);
			}

			return jsonOk({
				success: true,
				action: 'syncAdmitDischargePay',
				svdt: svdtIso,
				data: results,
				count: results.filter((x) => x.ok).length
			});
		}

		// 간식 일괄등록: 해당일자 F14020(입소 수급자 실적)에 MGVOL/AGVOL/DGVOL 일괄 반영
		if (action === 'bulkSnack') {
			const mgvol = body?.MGVOL ?? body?.mgvol ?? body?.morningSnack ?? '';
			const agvol = body?.AGVOL ?? body?.agvol ?? body?.afternoonSnack ?? '';
			const dgvol = body?.DGVOL ?? body?.dgvol ?? body?.eveningSnack ?? '';

			if (
				String(mgvol).trim() === '' &&
				String(agvol).trim() === '' &&
				String(dgvol).trim() === ''
			) {
				return jsonError(
					{ success: false, error: '오전/오후/저녁 간식 중 하나 이상 입력해주세요.' },
					400
				);
			}

			const now = new Date();
			const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
			const request = pool.request();
			request.input('ANCD', gate.sessionAncd);
			request.input('SVDT', svdtIso);
			request.input('INDT', nowStr);
			request.input('MGVOL', String(mgvol ?? ''));
			request.input('AGVOL', String(agvol ?? ''));
			request.input('DGVOL', String(dgvol ?? ''));

			// 값이 있는 간식만 갱신 (빈 값은 기존 유지)
			const setParts = ['f.[INDT] = @INDT'];
			if (String(mgvol).trim() !== '') setParts.push('f.[MGVOL] = @MGVOL');
			if (String(agvol).trim() !== '') setParts.push('f.[AGVOL] = @AGVOL');
			if (String(dgvol).trim() !== '') setParts.push('f.[DGVOL] = @DGVOL');

			const result = await request.query(`
				UPDATE f
				SET ${setParts.join(',\n\t\t\t\t\t')}
				FROM [돌봄시설DB].[dbo].[F14020] f
				INNER JOIN [돌봄시설DB].[dbo].[F10010] m
					ON f.[ANCD] = m.[ANCD]
					AND CAST(f.[PNUM] AS VARCHAR) = CAST(m.[PNUM] AS VARCHAR)
				WHERE f.[ANCD] = @ANCD
					AND f.[SVDT] = @SVDT
					AND CAST(m.[P_ST] AS VARCHAR) = '1'
			`);

			const updated = Array.isArray(result.rowsAffected)
				? result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0)
				: Number(result.rowsAffected) || 0;

			return jsonOk({
				success: true,
				action: 'bulkSnack',
				svdt: svdtIso,
				updated,
				MGVOL: String(mgvol).trim() !== '' ? String(mgvol) : undefined,
				AGVOL: String(agvol).trim() !== '' ? String(agvol) : undefined,
				DGVOL: String(dgvol).trim() !== '' ? String(dgvol) : undefined
			});
		}

		if (!Array.isArray(rows)) {
			return jsonError({ success: false, error: 'svdt와 rows 배열이 필요합니다 (또는 action: generate / returnFromOvernight / syncAdmitDischargePay / bulkSnack)' }, 400);
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
				DGST: r.dgst ?? r.DGST ?? r.snackStatus?.evening,
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

			const gynTouched = mealValues.GYN !== undefined || mealValues.IO_TM_INFO !== undefined;
			if (gynTouched) {
				try {
					const cur = await pool
						.request()
						.input('ANCD', gate.sessionAncd)
						.input('PNUM', String(pnum))
						.input('SVDT', svdtIso)
						.query(`
              SELECT TOP 1 [GYN], [IO_TM_INFO]
              FROM [돌봄시설DB].[dbo].[F14020]
              WHERE [ANCD]=@ANCD
                AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
                AND [SVDT]=@SVDT
            `);
					const row = cur.recordset?.[0];
					await syncOutingFromF14020Row(pool, gate.sessionAncd, {
						pnum,
						svdt: svdtIso,
						gyn: row?.GYN,
						ioTmInfo: row?.IO_TM_INFO
					});
				} catch (syncErr) {
					console.warn('F14020 → OUTING_INFO 동기화 경고:', syncErr);
				}
			}
		}

		const savedPnums = results.filter((x) => x.ok && x.pnum).map((x) => x.pnum);
		try {
			await ensureF30120FromF14020(pool, gate.sessionAncd, svdtIso, savedPnums);
		} catch (vitalErr) {
			console.warn('F14020 저장 후 F30120 공란 생성 경고:', vitalErr);
		}

		return jsonOk({ success: true, data: results, count: results.length });
	} catch (err) {
		console.error('F14020 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

/**
 * F14020 행 삭제 후 외출대장 정리.
 * @param {Request} req - query/body: ancd, pnum, svdt
 */
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

		const prevReq = pool.request();
		prevReq.input('ANCD', gate.sessionAncd);
		prevReq.input('PNUM', String(pnum));
		prevReq.input('SVDT', svdtIso);
		const prevRes = await prevReq.query(`
      SELECT TOP 1 [GYN], [IO_TM_INFO]
      FROM [돌봄시설DB].[dbo].[F14020]
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND [SVDT] = @SVDT
    `);
		const prev = prevRes.recordset?.[0] || null;

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

		if (prev) {
			try {
				await syncOutingOnF14020Delete(pool, gate.sessionAncd, {
					pnum,
					svdt: svdtIso,
					prevGyn: prev.GYN,
					prevIoTmInfo: prev.IO_TM_INFO
				});
			} catch (syncErr) {
				console.warn('F14020 삭제 → OUTING_INFO 동기화 경고:', syncErr);
			}
		}

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F14020 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

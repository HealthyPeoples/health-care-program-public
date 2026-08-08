/**
 * @file 외출·외박 시각 기준 식사/간식 체크 자동 반영
 *
 * @description
 * 전체추가(generate) 후 F14020 행의 GYN·IO_TM_INFO를 보고
 * 해당 시각에 원내 없으면 식사/간식 상태를 '2'(미체크)로 설정합니다.
 *
 * 기준 시각:
 * - 아침식사 MOST 07:00
 * - 오전간식 MGST 10:00
 * - 점심식사 LCST 12:00
 * - 오후간식 AGST 15:00
 * - 저녁식사 DNST 17:00
 * - 저녁간식 DGST 19:00
 */

/** @type {{ key: string, time: string }[]} */
const MEAL_SNACK_SLOTS = [
	{ key: 'MOST', time: '07:00' },
	{ key: 'MGST', time: '10:00' },
	{ key: 'LCST', time: '12:00' },
	{ key: 'AGST', time: '15:00' },
	{ key: 'DNST', time: '17:00' },
	{ key: 'DGST', time: '19:00' },
];

function padTime5(t) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
	if (!m) return '';
	return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

function toMinutes(hhmm) {
	const t = padTime5(hhmm);
	if (!t) return null;
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

/**
 * IO_TM_INFO 파싱 (DailyBeneficiaryPerformance / outingF14020Sync 와 동일 규칙)
 * @param {string|null|undefined} info
 */
function parseIoTmInfo(info) {
	const s = String(info || '').trim();
	const ongoingStrict = /^ON:(\d{4}-\d{2}-\d{2})\|(\d{1,2}:\d{2})$/i.exec(s);
	if (ongoingStrict) {
		return {
			start: padTime5(ongoingStrict[2]),
			end: '',
			returnTime: '',
			overnightOngoing: true,
			overnightLeaveDate: ongoingStrict[1],
		};
	}
	const ongoingLoose = /^ON:(.+)\|(\d{1,2}:\d{2})$/i.exec(s);
	if (ongoingLoose) {
		const leaveTime = padTime5(ongoingLoose[2]);
		if (leaveTime) {
			return {
				start: leaveTime,
				end: '',
				returnTime: '',
				overnightOngoing: true,
			};
		}
	}
	const ret = /^R[:：]?\s*(\d{1,2}:\d{2})$/i.exec(s) || /^복귀\s*[:：]?\s*(\d{1,2}:\d{2})$/.exec(s);
	if (ret) return { start: '', end: '', returnTime: padTime5(ret[1]), overnightOngoing: false };
	const range = /^(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})$/.exec(s);
	if (range) {
		return {
			start: padTime5(range[1]),
			end: padTime5(range[2]),
			returnTime: '',
			overnightOngoing: false,
		};
	}
	const single = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*[~\-–]?\s*$/.exec(s);
	if (single) {
		return {
			start: padTime5(`${single[1]}:${single[2]}`),
			end: '',
			returnTime: '',
			overnightOngoing: false,
		};
	}
	return { start: '', end: '', returnTime: '', overnightOngoing: false };
}

/**
 * 해당 시각에 원내에 있는지 여부
 * @param {string} gyn
 * @param {string|null|undefined} ioTmInfo
 * @param {string} eventTime HH:mm
 * @returns {boolean}
 */
function isPresentAtFacility(gyn, ioTmInfo, eventTime) {
	const t = toMinutes(eventTime);
	if (t == null) return true;

	const parsed = parseIoTmInfo(ioTmInfo);
	const g = String(gyn ?? '').trim();

	// 외박중(중간일): 종일 부재
	if (parsed.overnightOngoing) return false;

	// 외박 복귀일 R:HH:mm — 복귀 시각 이전은 부재
	if (parsed.returnTime) {
		const ret = toMinutes(parsed.returnTime);
		if (ret == null) return true;
		return t >= ret;
	}

	// 외출: start~end 구간 부재 (복귀 시각=end 는 원내)
	if (g === '0') {
		const start = toMinutes(parsed.start);
		const end = toMinutes(parsed.end);
		if (start == null) return true; // 시각 미입력 → 원내로 간주
		if (end == null) return t < start;
		return !(t >= start && t < end);
	}

	// 외박 출발일: 출발 시각 이후 부재
	if (g === '2') {
		const start = toMinutes(parsed.start);
		if (start == null) return true; // 시각 미입력 → 원내로 간주
		return t < start;
	}

	// 입원(원내) 등
	return true;
}

/**
 * GYN/IO 기준으로 식사·간식 체크값 계산 ('1' 체크 / '2' 해제)
 * @param {string} gyn
 * @param {string|null|undefined} ioTmInfo
 * @returns {Record<string, '1'|'2'>}
 */
function computeMealSnackFlags(gyn, ioTmInfo) {
	/** @type {Record<string, '1'|'2'>} */
	const flags = {};
	for (const slot of MEAL_SNACK_SLOTS) {
		flags[slot.key] = isPresentAtFacility(gyn, ioTmInfo, slot.time) ? '1' : '2';
	}
	return flags;
}

/**
 * UI 편집 중인 외출/외박 시각으로 IO_TM_INFO 문자열을 만듭니다.
 * @param {{
 *   gyn?: string,
 *   gynStartTime?: string,
 *   gynEndTime?: string,
 *   returnTime?: string,
 *   overnightOngoing?: boolean,
 *   overnightLeaveDate?: string,
 *   overnightLeaveTime?: string,
 * }} row
 */
function buildIoTmInfoFromOutingFields(row) {
	const gyn = String(row?.gyn ?? '').trim();
	const returnTime = padTime5(row?.returnTime || '');
	if (returnTime) return `R:${returnTime}`;

	if (row?.overnightOngoing) {
		const leaveDate = String(row.overnightLeaveDate || '').trim();
		const leaveTime = padTime5(row.overnightLeaveTime || row.gynStartTime || '');
		if (leaveDate && leaveTime) return `ON:${leaveDate}|${leaveTime}`;
		if (leaveTime) return `ON:${leaveTime}`;
		return 'ON:';
	}

	const start = padTime5(row?.gynStartTime || '');
	const end = padTime5(row?.gynEndTime || '');
	if (gyn === '2') return start;
	if (!start && !end) return '';
	if (!start || !end) return start || end;
	return `${start}~${end}`;
}

/**
 * 외출/외박 시각 → 화면 mealStatus / snackStatus
 * @param {{
 *   gyn?: string,
 *   gynStartTime?: string,
 *   gynEndTime?: string,
 *   returnTime?: string,
 *   overnightOngoing?: boolean,
 *   overnightLeaveDate?: string,
 *   overnightLeaveTime?: string,
 * }} row
 * @returns {{
 *   mealStatus: { breakfast: string, lunch: string, dinner: string },
 *   snackStatus: { morning: string, afternoon: string, evening: string },
 * }}
 */
function mealSnackStatusFromOutingFields(row) {
	const gyn = String(row?.gyn ?? '').trim() || '1';
	const io = buildIoTmInfoFromOutingFields(row);
	const flags = computeMealSnackFlags(gyn, io);
	return {
		mealStatus: {
			breakfast: flags.MOST,
			lunch: flags.LCST,
			dinner: flags.DNST,
		},
		snackStatus: {
			morning: flags.MGST,
			afternoon: flags.AGST,
			evening: flags.DGST,
		},
	};
}

/**
 * 외출·외박이 있는 당일 F14020 행에 식사/간식 체크를 반영합니다.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {string|number} ancd
 * @param {string} svdtIso YYYY-MM-DD
 * @returns {Promise<{ ok: boolean, updated: number }>}
 */
async function applyMealSnackByPresence(pool, ancd, svdtIso) {
	if (!pool || !ancd || !svdtIso) return { ok: false, updated: 0 };

	const listRes = await pool
		.request()
		.input('ANCD', ancd)
		.input('SVDT', svdtIso)
		.query(`
			SELECT [PNUM], [GYN], [IO_TM_INFO]
			FROM [돌봄시설DB].[dbo].[F14020]
			WHERE [ANCD] = @ANCD
				AND [SVDT] = @SVDT
				AND (
					LTRIM(RTRIM(CAST([GYN] AS VARCHAR(10)))) IN ('0', '2')
					OR LTRIM(RTRIM(CAST([IO_TM_INFO] AS VARCHAR(100)))) LIKE 'R:%'
					OR LTRIM(RTRIM(CAST([IO_TM_INFO] AS VARCHAR(100)))) LIKE 'ON:%'
				)
		`);

	const rows = listRes.recordset || [];
	let updated = 0;

	for (const row of rows) {
		const pnum = String(row.PNUM ?? '').trim();
		if (!pnum) continue;

		const flags = computeMealSnackFlags(row.GYN, row.IO_TM_INFO);
		const request = pool.request();
		request.input('ANCD', ancd);
		request.input('PNUM', pnum);
		request.input('SVDT', svdtIso);
		request.input('MOST', flags.MOST);
		request.input('LCST', flags.LCST);
		request.input('DNST', flags.DNST);
		request.input('MGST', flags.MGST);
		request.input('AGST', flags.AGST);
		request.input('DGST', flags.DGST);

		const result = await request.query(`
			UPDATE [돌봄시설DB].[dbo].[F14020]
			SET
				[MOST] = @MOST,
				[LCST] = @LCST,
				[DNST] = @DNST,
				[MGST] = @MGST,
				[AGST] = @AGST,
				[DGST] = @DGST
			WHERE [ANCD] = @ANCD
				AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
				AND [SVDT] = @SVDT
		`);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0)
			: Number(result.rowsAffected) || 0;
		if (affected > 0) updated += 1;
	}

	return { ok: true, updated };
}

module.exports = {
	MEAL_SNACK_SLOTS,
	parseIoTmInfo,
	isPresentAtFacility,
	computeMealSnackFlags,
	buildIoTmInfoFromOutingFields,
	mealSnackStatusFromOutingFields,
	applyMealSnackByPresence,
};

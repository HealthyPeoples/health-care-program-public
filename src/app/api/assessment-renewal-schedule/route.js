/**
 * @file API /api/assessment-renewal-schedule — 욕구사정·평가 갱신 가상 일정
 *
 * @description
 * 입소자 입소일(P_SDT) 기준 6개월 주기와 욕구사정(F51012) 작성일로
 * D-30~마감 일정을 조회 시점에 계산합니다. ANNUAL_SCHEDULE에 저장하지 않습니다.
 *
 * @module app/api/assessment-renewal-schedule/route
 */
import { connPool } from '../../../config/server';
import { getSessionAncd } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';

const F10010 = '[돌봄시설DB].[dbo].[F10010]';
const F51012 = '[돌봄시설DB].[dbo].[F51012]';
const SCH_TYPE = '사정갱신';
const MAX_CYCLES = 80;

function toDateStr(v) {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (!s) return '';
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return '';
}

function isValidYmd(s) {
	return /^\d{4}-\d{2}-\d{2}$/.test(s) && s.slice(0, 10) > '1901-01-01';
}

function todayKstYmd() {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date());
}

function addDaysISO(dateStr, days) {
	const d = new Date(`${dateStr}T12:00:00`);
	d.setDate(d.getDate() + days);
	return toDateStr(d);
}

function addMonthsISO(dateStr, months) {
	const [y, m, day] = dateStr.split('-').map((n) => parseInt(n, 10));
	const target = new Date(y, m - 1 + months, 1, 12);
	const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	target.setDate(Math.min(day, lastDay));
	return toDateStr(target);
}

function daysBetween(start, end) {
	const a = new Date(`${start}T12:00:00`);
	const b = new Date(`${end}T12:00:00`);
	return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** 이번 주기 작성일: 직전 마감(또는 입소일) 이후 ~ 다음 주기 D-30 직전 중 가장 이른 RQDT */
function cycleSaveRqdt(rqdts, prevDue, nextStart, firstCycle) {
	let found = '';
	for (let i = 0; i < rqdts.length; i++) {
		const r = rqdts[i];
		const afterPrev = firstCycle ? r >= prevDue : r > prevDue;
		if (afterPrev && r < nextStart) {
			if (!found || r < found) found = r;
		}
	}
	return found;
}

/** D-30 전에 이미 이번 주기 욕구사정을 씀 (입소 당일 기록 포함) */
function hasEarlyNeedsAssessment(rqdts, prevDue, start, firstCycle) {
	for (let i = 0; i < rqdts.length; i++) {
		const r = rqdts[i];
		const afterPrev = firstCycle ? r >= prevDue : r > prevDue;
		if (afterPrev && r < start) return true;
	}
	return false;
}

function savedTimingLabel(daysLeft) {
	if (daysLeft == null || !Number.isFinite(daysLeft)) return '';
	if (daysLeft > 0) return `${daysLeft}일 남기고 저장`;
	if (daysLeft === 0) return '마감 당일 저장';
	return `마감 ${-daysLeft}일 후 저장`;
}

function buildCycles(member, rqdts, rangeStart, rangeEnd, today) {
	const admit = member.admitDate;
	const name = member.name;
	const pnum = member.pnum;
	const items = [];

	for (let n = 1; n <= MAX_CYCLES; n++) {
		const due = addMonthsISO(admit, n * 6);
		if (!due) break;
		const start = addDaysISO(due, -30);
		if (!start) break;
		if (start > rangeEnd) break;
		if (due < rangeStart) continue;
		if (!(start <= rangeEnd && due >= rangeStart)) continue;

		const prevDue = n === 1 ? admit : addMonthsISO(admit, (n - 1) * 6);
		const nextDue = addMonthsISO(admit, (n + 1) * 6);
		const nextStart = addDaysISO(nextDue, -30);
		const firstCycle = n === 1;

		// D-30 이전에 이미 욕구사정 작성 → 달력에 아예 넣지 않음
		if (hasEarlyNeedsAssessment(rqdts, prevDue, start, firstCycle)) continue;

		const savedRqdt = cycleSaveRqdt(rqdts, prevDue, nextStart, firstCycle);

		// 미작성 보라색은 D-30(오늘 >= 시작일)부터만 표시
		if (!savedRqdt && today < start) continue;

		const done = Boolean(savedRqdt);
		const overdue = !done && today > due;
		const savedDaysLeft = savedRqdt ? daysBetween(savedRqdt, due) : null;
		const savedLabel = savedTimingLabel(savedDaysLeft);
		const dueDaysLeft = daysBetween(today, due);
		let prevWrite = '';
		for (let i = 0; i < rqdts.length; i++) {
			const r = rqdts[i];
			if (r < start && r > prevWrite) prevWrite = r;
		}
		const contentLines = [
			`입소일 ${admit}`,
			`직전작성일 ${prevWrite || '없음'}`,
			`마감일 ${due}`,
		];
		if (savedRqdt && savedLabel) {
			contentLines.push(savedLabel);
		} else if (!savedRqdt) {
			if (dueDaysLeft > 0) contentLines.push(`마감까지 ${dueDaysLeft}일 남음`);
			else if (dueDaysLeft === 0) contentLines.push('오늘 마감');
			else contentLines.push(`마감 ${-dueDaysLeft}일 지남`);
		}

		items.push({
			ID: `ar:${pnum}:${due}`,
			PNUM: pnum,
			P_NM: name,
			SCH_DATE: start,
			SCH_END_DATE: due,
			DUE_DATE: due,
			ADMIT_DATE: admit,
			TITLE: `${name} 욕구사정·평가 갱신`,
			CONTENT: contentLines.join('\n'),
			SCH_TYPE: SCH_TYPE,
			DONE_YN: done ? 'Y' : 'N',
			OVERDUE_YN: overdue ? 'Y' : 'N',
			LAST_RQDT: savedRqdt || null,
			SAVED_DAYS_LEFT: savedDaysLeft,
			SAVED_LABEL: savedLabel || null,
			DUE_DAYS_LEFT: dueDaysLeft,
		});
	}

	return items;
}

export async function GET(req) {
	try {
		const sessionAncd = getSessionAncd(req);
		if (sessionAncd == null) {
			return jsonError({ success: false, error: '로그인이 필요합니다.' }, 401);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const searchParams = req.nextUrl.searchParams;
		const year = searchParams.get('year');
		const startDateParam = toDateStr(searchParams.get('startDate') || '');
		const endDateParam = toDateStr(searchParams.get('endDate') || '');

		let rangeStart = '';
		let rangeEnd = '';
		if (startDateParam && endDateParam) {
			rangeStart = startDateParam;
			rangeEnd = endDateParam;
		} else if (year && /^\d{4}$/.test(String(year).trim())) {
			const y = String(year).trim();
			rangeStart = `${y}-01-01`;
			rangeEnd = `${y}-12-31`;
		} else {
			return jsonError(
				{ success: false, error: 'year 또는 startDate+endDate 파라미터가 필요합니다' },
				400
			);
		}

		if (rangeEnd < rangeStart) {
			return jsonError({ success: false, error: '종료일이 시작일보다 빠를 수 없습니다.' }, 400);
		}

		const request = pool.request();
		request.input('ANCD', sessionAncd);

		const membersResult = await request.query(`
      SELECT
        CAST(f.[PNUM] AS VARCHAR(30)) AS [PNUM],
        f.[P_NM],
        CONVERT(varchar(10), TRY_CONVERT(date, f.[P_SDT]), 23) AS [P_SDT]
      FROM ${F10010} f
      WHERE f.[ANCD] = @ANCD
        AND LTRIM(RTRIM(CAST(f.[P_ST] AS VARCHAR(10)))) = N'1'
        AND f.[P_SDT] IS NOT NULL
    `);

		const rqdtResult = await pool.request().input('ANCD', sessionAncd).query(`
      SELECT
        CAST(t.[PNUM] AS VARCHAR(30)) AS [PNUM],
        CONVERT(varchar(10), TRY_CONVERT(date, t.[RQDT]), 23) AS [RQDT]
      FROM ${F51012} t
      WHERE t.[ANCD] = @ANCD
        AND t.[RQDT] IS NOT NULL
    `);

		const rqdtByPnum = new Map();
		for (const row of rqdtResult.recordset || []) {
			const pnum = String(row.PNUM ?? '').trim();
			const rqdt = toDateStr(row.RQDT);
			if (!pnum || !isValidYmd(rqdt)) continue;
			if (!rqdtByPnum.has(pnum)) rqdtByPnum.set(pnum, []);
			rqdtByPnum.get(pnum).push(rqdt);
		}
		for (const list of rqdtByPnum.values()) {
			list.sort();
		}

		const today = todayKstYmd();
		const data = [];
		const seen = new Set();

		for (const row of membersResult.recordset || []) {
			const pnum = String(row.PNUM ?? '').trim();
			const name = String(row.P_NM ?? '').trim();
			const admitDate = toDateStr(row.P_SDT);
			if (!pnum || !name || !isValidYmd(admitDate)) continue;
			const key = pnum;
			if (seen.has(key)) continue;
			seen.add(key);

			const rqdts = rqdtByPnum.get(pnum) || [];
			const cycles = buildCycles(
				{ pnum, name, admitDate },
				rqdts,
				rangeStart,
				rangeEnd,
				today
			);
			for (let i = 0; i < cycles.length; i++) data.push(cycles[i]);
		}

		data.sort((a, b) => a.SCH_DATE.localeCompare(b.SCH_DATE) || a.TITLE.localeCompare(b.TITLE, 'ko'));

		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('assessment-renewal-schedule GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

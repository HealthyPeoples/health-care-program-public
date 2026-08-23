/**
 * @file API /api/v30030r — 급여 조회 뷰 V30030R
 *
 * @description
 * 급여 조회 뷰 V30030R Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/v30030r/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const sql = require('mssql');
const VIEW = '[돌봄시설DB].[dbo].[V30030R]';

function formatDateForDB(dateStr) {
	if (!dateStr) return null;
	if (String(dateStr).includes('-')) return String(dateStr).slice(0, 10);
	const s = String(dateStr);
	if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s;
}

function validateDate(dateStr) {
	if (!dateStr) return false;
	return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).slice(0, 10));
}

const PROBLEM_BEHAVIOR_ITEMS = ['망상', '배회', '이식', '공격성', '불결행위', '케어거부', '불안'];

function toYmd8(value) {
	if (value == null || value === '') return '';
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const y = value.getFullYear();
		const m = String(value.getMonth() + 1).padStart(2, '0');
		const d = String(value.getDate()).padStart(2, '0');
		return `${y}${m}${d}`;
	}
	const s = String(value).trim();
	const compact = s.replace(/\D/g, '');
	if (/^(19|20)\d{6}/.test(compact)) return compact.slice(0, 8);
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		return `${y}${m}${d}`;
	}
	return '';
}

function toPnumKey(value) {
	const n = Number(value);
	if (Number.isFinite(n)) return String(n);
	return String(value ?? '').trim();
}

function formatProblemBehaviorsDisplay(raw) {
	const tokens = String(raw ?? '')
		.split(/[,|]/)
		.map((s) => s.trim())
		.filter(Boolean);
	return PROBLEM_BEHAVIOR_ITEMS.filter((item) => tokens.includes(item)).join(', ');
}

/**
 * V30030R 간호일지/건강관리기록부 출력용 조회
 * GET /api/v30030r?startDate=&endDate=&ancd=&pnum=
 * pnum이 없으면 기관 전체 수급자를 조회합니다.
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const ancd = sp.get('ancd');
		const pnum = sp.get('pnum');
		const startDate = sp.get('startDate');
		const endDate = sp.get('endDate');

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!validateDate(startDate) || !validateDate(endDate)) {
			return jsonError(
				{ success: false, error: 'startDate, endDate는 yyyy-mm-dd 형식이어야 합니다' },
				400
			);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const start = formatDateForDB(startDate);
		const end = formatDateForDB(endDate);
		const pnumVal = pnum == null ? '' : String(pnum).trim();

		const request = pool.request();
		request.input('sessionAncd', sql.Int, Number(gate.sessionAncd));
		request.input('startDate', sql.VarChar(10), start);
		request.input('endDate', sql.VarChar(10), end);

		let pnumFilter = '';
		if (pnumVal !== '') {
			request.input('pnum', sql.Int, Number(pnumVal));
			pnumFilter = `AND CAST([PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)`;
		}

		const result = await request.query(`
      SELECT *
      FROM ${VIEW}
      WHERE [ANCD] = @sessionAncd
        ${pnumFilter}
        AND LEFT(REPLACE(LTRIM(RTRIM(CAST([조사일자] AS VARCHAR(20)))), '-', ''), 8)
            BETWEEN REPLACE(@startDate, '-', '') AND REPLACE(@endDate, '-', '')
      ORDER BY [수급자성명] ASC, CAST([PNUM] AS VARCHAR) ASC, [조사일자] ASC
    `);

		let facilityName = '';
		let facilityCode = '';
		try {
			const fac = await pool
				.request()
				.input('sessionAncd', sql.Int, Number(gate.sessionAncd))
				.query(`
					SELECT TOP 1 [ANNM], [ANGH], [ANCD]
					FROM [돌봄시설DB].[dbo].[F00110]
					WHERE [ANCD] = @sessionAncd
				`);
			const row = fac.recordset?.[0] || {};
			facilityName = row.ANNM != null ? String(row.ANNM).trim() : '';
			facilityCode = row.ANGH != null ? String(row.ANGH).trim() : '';
			if (!facilityCode && row.ANCD != null) facilityCode = String(row.ANCD).trim();
		} catch (facErr) {
			console.warn('V30030R 기관정보 조회 경고:', facErr?.message || facErr);
		}

		const actByKey = new Map();
		try {
			await pool.request().query(`
				IF NOT EXISTS (
					SELECT 1
					FROM [돌봄시설DB].sys.columns c
					INNER JOIN [돌봄시설DB].sys.tables t ON c.object_id = t.object_id
					INNER JOIN [돌봄시설DB].sys.schemas s ON t.schema_id = s.schema_id
					WHERE s.name = N'dbo' AND t.name = N'F30120' AND c.name = N'NS_ACT_ITEMS'
				)
				BEGIN
					ALTER TABLE [돌봄시설DB].[dbo].[F30120]
					ADD [NS_ACT_ITEMS] NVARCHAR(200) NULL;
				END
			`);
			const actReq = pool.request();
			actReq.input('sessionAncd', sql.Int, Number(gate.sessionAncd));
			actReq.input('startDate', sql.VarChar(10), start);
			actReq.input('endDate', sql.VarChar(10), end);
			const actResult = await actReq.query(`
				SELECT
					[PNUM], [RSDT], [NS_ACT_ITEMS], [WEIGHT],
					[BJYN], [BJDG], [BJPA], [NS_PAN_CHK],
					[NS_WRITE_NAME], [INEMPNM],
					ISNULL([VS_SEQ], 1) AS [VS_SEQ]
				FROM [돌봄시설DB].[dbo].[F30120]
				WHERE [ANCD] = @sessionAncd
				  AND REPLACE(LTRIM(RTRIM(CAST([RSDT] AS VARCHAR(20)))), '-', '')
				      BETWEEN REPLACE(@startDate, '-', '') AND REPLACE(@endDate, '-', '')
			`);
			(actResult.recordset || []).forEach((row) => {
				const p = toPnumKey(row.PNUM);
				const d = toYmd8(row.RSDT);
				if (!p || !d) return;
				const key = `${p}|${d}`;
				const prev = actByKey.get(key);
				if (!prev || Number(row.VS_SEQ) === 1) actByKey.set(key, row);
			});
		} catch (actErr) {
			console.warn('V30030R 문제행동 항목 조회 경고:', actErr?.message || actErr);
		}

		const data = (result.recordset || []).map((r) => {
			const code = String(r['장기요양기관기호'] ?? r.ANGH ?? '').trim() || facilityCode;
			const name = String(r['장기요양기관명'] ?? r.ANNM ?? '').trim() || facilityName;
			const p = toPnumKey(r.PNUM);
			const survey = toYmd8(r['조사일자']);
			const extra = actByKey.get(`${p}|${survey}`) || {};
			const actRaw = extra.NS_ACT_ITEMS ?? r.NS_ACT_ITEMS;
			return {
				...r,
				장기요양기관기호: code,
				장기요양기관명: name,
				WEIGHT: extra.WEIGHT ?? r.WEIGHT ?? r['체중'] ?? '',
				체중: extra.WEIGHT ?? r['체중'] ?? r.WEIGHT ?? '',
				BJYN: extra.BJYN ?? r.BJYN ?? '',
				BJDG: extra.BJDG ?? r.BJDG ?? '',
				BJPA: extra.BJPA ?? r.BJPA ?? '',
				NS_PAN_CHK: extra.NS_PAN_CHK ?? r.NS_PAN_CHK ?? r['통증'] ?? '',
				통증: extra.NS_PAN_CHK ?? r['통증'] ?? r.NS_PAN_CHK ?? '',
				NS_WRITE_NAME: extra.NS_WRITE_NAME ?? extra.INEMPNM ?? r.NS_WRITE_NAME ?? r.INEMPNM ?? '',
				작성자: extra.NS_WRITE_NAME ?? extra.INEMPNM ?? r.NS_WRITE_NAME ?? r.INEMPNM ?? '',
				NS_ACT_ITEMS: actRaw ?? '',
				문제행동: formatProblemBehaviorsDisplay(actRaw),
			};
		});

		return jsonOk({
			success: true,
			data,
			count: data.length,
			facility: { 장기요양기관기호: facilityCode, 장기요양기관명: facilityName },
		});
	} catch (err) {
		console.error('V30030R GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

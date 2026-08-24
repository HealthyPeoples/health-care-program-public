/**
 * @file API /api/f14090 — 시설업무일지 F14090
 *
 * @description
 * 시설업무일지 F14090 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f14090/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
function normalizeYyyymm(raw) {
	const yyyymm = String(raw || '').replace(/\D/g, '');
	if (!/^\d{6}$/.test(yyyymm)) return '';
	const y = parseInt(yyyymm.slice(0, 4), 10);
	const m = parseInt(yyyymm.slice(4, 6), 10);
	if (!Number.isFinite(y) || m < 1 || m > 12) return '';
	return yyyymm;
}

function monthRangeFromYyyymm(yyyymm) {
	const y = parseInt(yyyymm.slice(0, 4), 10);
	const m = parseInt(yyyymm.slice(4, 6), 10);
	const frdt = new Date(y, m - 1, 1);
	const todt = new Date(y, m, 0);
	const pad = (n) => String(n).padStart(2, '0');
	return {
		frdt: `${y}-${pad(m)}-01`,
		todt: `${y}-${pad(m)}-${pad(todt.getDate())}`,
	};
}

// F14090 (월 집계) 조회
// GET /api/f14090?yyyymm=YYYYMM
// - yyyymm이 없으면 해당 기관의 최신(최대) YYYYMM으로 조회
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const yyyymmRaw = searchParams.get('yyyymm'); // 'YYYYMM' or 'YYYY-MM'
    const ancd = searchParams.get('ancd'); // optional, 세션 검증용

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const request = pool.request();
    request.input('sessionAncd', gate.sessionAncd);

    let yyyymm = String(yyyymmRaw || '').replace(/\D/g, '');
    if (yyyymm) {
      if (!/^\d{6}$/.test(yyyymm)) {
        return jsonError({ success: false, error: 'yyyymm(YYYYMM) 형식이 올바르지 않습니다' }, 400);
      }
    } else {
      // 최신 YYYYMM 찾기
      const latestResult = await request.query(`
        SELECT MAX(CAST([YYYYMM] AS INT)) AS LATEST_YYYYMM
        FROM [돌봄시설DB].[dbo].[F14090]
        WHERE [ANCD] = @sessionAncd
      `);

      const latest = latestResult?.recordset?.[0]?.LATEST_YYYYMM;
      if (latest == null) {
        return jsonOk({ success: true, data: [], count: 0, yyyymm: null });
      }
      yyyymm = String(latest);
    }

    request.input('yyyymm', yyyymm);

    // 화면 표시용으로 F10010(수급자 기본정보)와 LEFT JOIN.
    // 날짜 조회는 YYYYMM 컬럼 기준으로만 수행한다.
    const query = `
      SELECT
        f14090.*,
        f10010.[P_NM],
        f10010.[P_BRDT],
        f10010.[P_SEX],
        f10010.[P_GRD],
        f10010.[P_YYNO],
        f10010.[P_YYEDT]
      FROM [돌봄시설DB].[dbo].[F14090] f14090
      LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010
        ON f14090.[ANCD] = f10010.[ANCD]
       AND f14090.[PNUM] = f10010.[PNUM]
      WHERE f14090.[ANCD] = @sessionAncd
        AND CAST(f14090.[YYYYMM] AS VARCHAR) = CAST(@yyyymm AS VARCHAR)
      ORDER BY f10010.[P_NM] ASC
    `;
    const result = await request.query(query);

    return jsonOk({ success: true, data: result.recordset || [], count: result.recordset ? result.recordset.length : 0, yyyymm });
  } catch (err) {
    console.error('F14090 테이블 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

const DB_NAME = '돌봄시설DB';
let f14090ColumnCache = null;

async function getF14090ColumnSet(pool) {
	if (f14090ColumnCache) return f14090ColumnCache;
	try {
		const result = await pool.request().query(`
			SELECT COLUMN_NAME
			FROM [${DB_NAME}].INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = N'F14090'
		`);
		const cols = new Set();
		(result.recordset || []).forEach((r) => {
			const c = String(r.COLUMN_NAME || '').trim().toUpperCase();
			if (c) cols.add(c);
		});
		if (cols.size > 0) f14090ColumnCache = cols;
		return cols;
	} catch (e) {
		console.warn('F14090 컬럼 스키마 조회 실패:', e?.message || e);
		return new Set();
	}
}

/** 월 집계 화면에서 쓰는 메모 컬럼 — 없으면 추가 */
async function ensureF14090NoteColumns(pool) {
	const noteCols = [
		'NS_HEALTH_HELP_NM',
		'NS_NURSE_HELP_NM',
		'NS_ETC_NM',
		'NS_SORE_MNG_NM',
		'NS_ETC_DESC',
		'PH_BATH_METH_NM',
		'PH_MEAL_KIND_NM',
		'PH_MEAL_VAL_NM',
	];
	for (const col of noteCols) {
		try {
			await pool.request().query(`
				IF NOT EXISTS (
					SELECT 1
					FROM [${DB_NAME}].sys.columns c
					INNER JOIN [${DB_NAME}].sys.tables t ON c.object_id = t.object_id
					INNER JOIN [${DB_NAME}].sys.schemas s ON t.schema_id = s.schema_id
					WHERE s.name = N'dbo' AND t.name = N'F14090' AND c.name = N'${col}'
				)
				BEGIN
					ALTER TABLE [${DB_NAME}].[dbo].[F14090]
					ADD [${col}] NVARCHAR(200) NULL;
				END
			`);
		} catch (e) {
			console.warn(`F14090 ${col} 컬럼 확인 경고:`, e?.message || e);
		}
	}
	f14090ColumnCache = null;
}

function currentYyyymm() {
	const d = new Date();
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function upsertRoomNoOnly(pool, sessionAncd, pnum, yyyymmRaw, roomNo) {
	const p = String(pnum || '').trim();
	if (!p) {
		return jsonError({ success: false, error: 'pnum이 필요합니다' }, 400);
	}

	let yyyymm = normalizeYyyymm(yyyymmRaw);
	if (!yyyymm) {
		const latestResult = await pool
			.request()
			.input('ANCD', sessionAncd)
			.query(`
				SELECT MAX(CAST([YYYYMM] AS INT)) AS LATEST_YYYYMM
				FROM [돌봄시설DB].[dbo].[F14090]
				WHERE [ANCD] = @ANCD
			`);
		const latest = latestResult?.recordset?.[0]?.LATEST_YYYYMM;
		yyyymm = latest != null ? String(latest) : currentYyyymm();
	}

	const room = roomNo == null || String(roomNo).trim() === '' || String(roomNo).trim() === '0'
		? null
		: String(roomNo).trim();

	await pool
		.request()
		.input('ANCD', sessionAncd)
		.input('YYYYMM', String(yyyymm))
		.input('PNUM', p)
		.input('ROOM_NO', room)
		.query(`
			IF EXISTS (
				SELECT 1
				FROM [돌봄시설DB].[dbo].[F14090]
				WHERE [ANCD] = @ANCD
				  AND CAST([YYYYMM] AS VARCHAR) = CAST(@YYYYMM AS VARCHAR)
				  AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
			)
			BEGIN
				UPDATE [돌봄시설DB].[dbo].[F14090]
				SET [ROOM_NO] = @ROOM_NO
				WHERE [ANCD] = @ANCD
				  AND CAST([YYYYMM] AS VARCHAR) = CAST(@YYYYMM AS VARCHAR)
				  AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
			END
			ELSE
			BEGIN
				INSERT INTO [돌봄시설DB].[dbo].[F14090] ([ANCD],[YYYYMM],[PNUM],[ROOM_NO])
				VALUES (@ANCD,@YYYYMM,@PNUM,@ROOM_NO)
			END
		`);

	return jsonOk({ success: true, yyyymm });
}

// F14090 저장(업서트 - 화면에서 수정 가능한 항목)
// POST /api/f14090?yyyymm=YYYYMM&pnum=PNUM
// body: 수정 가능한 컬럼 일부(체크/바이탈/목욕/식사 등)
// body.action === 'updateRoomNo' 이면 ROOM_NO만 반영 (다른 컬럼은 유지)
export async function POST(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const body = await req.json().catch(() => ({}));
    const yyyymmRaw = searchParams.get('yyyymm') ?? body?.yyyymm ?? body?.YYYYMM ?? '';
    const pnum = searchParams.get('pnum') ?? body?.pnum ?? body?.PNUM ?? '';
    const ancd = searchParams.get('ancd') ?? body?.ancd ?? body?.ANCD ?? null;

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    if (String(body?.action || '') === 'updateRoomNo') {
      return upsertRoomNoOnly(pool, gate.sessionAncd, pnum, yyyymmRaw, body?.ROOM_NO ?? body?.roomNo);
    }

    const yyyymm = String(yyyymmRaw || '').replace(/\D/g, '');
    if (!yyyymm || !/^\d{6}$/.test(yyyymm) || !pnum) {
      return jsonError({ success: false, error: 'yyyymm(YYYYMM)과 pnum 파라미터가 필요합니다' }, 400);
    }

    await ensureF14090NoteColumns(pool);

    const pick = (k) => (body && Object.prototype.hasOwnProperty.call(body, k) ? body[k] : null);

    // === 수정 가능 컬럼들 ===
    const editableKeys = [
      // 신체활동
      'PH_HEAD_HELP','PH_MOVE_HELP','PH_CHANG_HELP','PH_WORK_HELP','PH_OUT_HELP',
      'PH_BATH_CNT','PH_BATH_METH','PH_BATH_METH_NM',
      'PH_MEAL_KIND','PH_MEAL_KIND_NM','PH_MEAL_VAL','PH_MEAL_VAL_NM',
      // 간호/건강
      'NS_SBDP','NS_EBDP','NS_TMPBD',
      'NS_ETC','NS_SORE_CHK','NS_MEDI_CHK','NS_SORE_MNG_NM',
      'NS_HEALTH_HELP_NM','NS_NURSE_HELP_NM','NS_ETC_NM','NS_ETC_DESC',
      // 인지/기능
      'FN_COGN_HELP','FN_MOVE_HELP','FN_MIND_HELP','FN_MIND_TRAIN','FN_PHY_HELP',
      // 제공/외박/방번호 (개인정보 제외지만 화면상 값)
      'SV_CNT','AB_CNT','ROOM_NO'
    ];

    const columnSet = await getF14090ColumnSet(pool);
    const keys = editableKeys.filter((k) => columnSet.size === 0 || columnSet.has(k));
    if (keys.length === 0) {
      return jsonError({ success: false, error: 'F14090에 저장할 수 있는 컬럼이 없습니다' }, 500);
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('YYYYMM', String(yyyymm));
    request.input('PNUM', String(pnum));
    keys.forEach((k) => request.input(k, pick(k) == null ? null : String(pick(k))));

    const setSql = keys.map((k) => `T.[${k}] = @${k}`).join(',\n          ');
    const insertCols = keys.map((k) => `[${k}]`).join(',');
    const insertVals = keys.map((k) => `@${k}`).join(',');

    const query = `
      MERGE [돌봄시설DB].[dbo].[F14090] AS T
      USING (SELECT @ANCD AS ANCD, @YYYYMM AS YYYYMM, @PNUM AS PNUM) AS S
        ON (T.[ANCD] = S.[ANCD]
            AND CAST(T.[YYYYMM] AS VARCHAR) = CAST(S.[YYYYMM] AS VARCHAR)
            AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR))
      WHEN MATCHED THEN
        UPDATE SET
          ${setSql}
      WHEN NOT MATCHED THEN
        INSERT ([ANCD],[YYYYMM],[PNUM],${insertCols})
        VALUES (@ANCD,@YYYYMM,@PNUM,${insertVals});
    `;

    await request.query(query);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F14090 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

/**
 * 서비스실적집계 — Usp_P14090 실행
 * PUT /api/f14090  body: { yyyymm: 'YYYYMM' }
 * ANCD는 로그인 세션 값만 사용 (클라이언트 ancd 무시/검증)
 */
export async function PUT(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const body = await req.json().catch(() => ({}));
		const yyyymmRaw = body?.yyyymm ?? body?.YYYYMM ?? searchParams.get('yyyymm') ?? '';
		const ancdParam = body?.ancd ?? searchParams.get('ancd') ?? null;

		const gate = assertAnCdMatchesSession(req, ancdParam);
		if (!gate.ok) return gate.response;

		const yyyymm = normalizeYyyymm(yyyymmRaw);
		if (!yyyymm) {
			return jsonError({ success: false, error: 'yyyymm(YYYYMM) 파라미터가 필요합니다' }, 400);
		}

		const { frdt, todt } = monthRangeFromYyyymm(yyyymm);
		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const ancd = Number(gate.sessionAncd);
		if (!Number.isFinite(ancd)) {
			return jsonError({ success: false, error: '세션 기관코드(ANCD)가 올바르지 않습니다' }, 401);
		}

		await pool
			.request()
			.input('pv_ancd', sql.Int, ancd)
			.input('pv_yyyymm', sql.Char(6), yyyymm)
			.input('pv_frdt', sql.Date, frdt)
			.input('pv_todt', sql.Date, todt)
			.execute('[돌봄시설DB].[dbo].[Usp_P14090]');

		return jsonOk({
				success: true,
				ancd,
				yyyymm,
				frdt,
				todt,
			});
	} catch (err) {
		console.error('Usp_P14090 집계 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}


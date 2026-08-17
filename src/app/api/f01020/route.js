/**
 * @file API /api/f01020 — 직원 년차 부여 F01020
 *
 * @description
 * 기존 F01020(YY_SDT/YY_EDT/YY_ILSU)에 년차 발생 구간·부여일수를 저장합니다.
 * 사용일수는 F02010 휴무(연차)로 화면에서 집계합니다.
 *
 * @module app/api/f01020/route
 */
import { connPool, sql } from '../../../config/server';
import { getSessionAncd } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const { normalizeYmdOrNull: normalizeYmd } = require('../../../utils/normalizeYmd');

const TABLE = '[돌봄시설DB].[dbo].[F01020]';

function inputDate(request, name, ymd) {
	const n = normalizeYmd(ymd);
	if (n == null) {
		request.input(name, sql.Date, null);
		return null;
	}
	request.input(name, sql.Date, new Date(`${n}T00:00:00`));
	return n;
}

function parseEmpno(v) {
	const n = parseInt(String(v ?? '').trim(), 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

function parseYcnt(v) {
	const n = parseInt(String(v ?? '').trim(), 10);
	if (!Number.isFinite(n) || n < 0) return null;
	return n;
}

function mapRow(row) {
	return {
		ANCD: Number(row.ANCD),
		EMPNO: Number(row.EMPNO),
		YDT: normalizeYmd(row.YY_SDT) || String(row.YY_SDT ?? '').slice(0, 10),
		YEDT: normalizeYmd(row.YY_EDT) || String(row.YY_EDT ?? '').slice(0, 10),
		YCNT: Number(row.YY_ILSU) || 0,
		CHA_SU: row.CHA_SU == null ? null : Number(row.CHA_SU),
	};
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

		const empno = parseEmpno(req.nextUrl.searchParams.get('empno'));
		const request = pool.request();
		request.input('ANCD', sql.Int, sessionAncd);

		let query = `
      SELECT [ANCD], [EMPNO],
        CONVERT(varchar(10), [YY_SDT], 23) AS [YY_SDT],
        CONVERT(varchar(10), [YY_EDT], 23) AS [YY_EDT],
        [YY_ILSU],
        [CHA_SU]
      FROM ${TABLE}
      WHERE [ANCD] = @ANCD
    `;
		if (empno != null) {
			request.input('EMPNO', sql.Int, empno);
			query += ` AND [EMPNO] = @EMPNO`;
		}
		query += ` ORDER BY [EMPNO], [YY_SDT] DESC`;

		const result = await request.query(query);
		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F01020 조회 오류:', err);
		return jsonError({
			success: false,
			error: err.message,
			details: err.toString(),
		});
	}
}

/** POST — 년차 생성/수정 (MERGE) */
export async function POST(req) {
	try {
		const sessionAncd = getSessionAncd(req);
		if (sessionAncd == null) {
			return jsonError({ success: false, error: '로그인이 필요합니다.' }, 401);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const body = await req.json().catch(() => ({}));
		const empno = parseEmpno(body.EMPNO ?? body.empno);
		const ycnt = parseYcnt(body.YCNT ?? body.ycnt ?? body.annualLeaveDays ?? body.YY_ILSU);
		if (empno == null) {
			return jsonError({ success: false, error: '사원번호(EMPNO)가 필요합니다.' }, 400);
		}
		if (ycnt == null) {
			return jsonError({ success: false, error: '년차일수를 입력해 주세요.' }, 400);
		}

		const chaReq = pool.request();
		chaReq.input('ANCD', sql.Int, sessionAncd);
		chaReq.input('EMPNO', sql.Int, empno);
		const chaResult = await chaReq.query(`
      SELECT ISNULL(MAX([CHA_SU]), 0) + 1 AS [NEXT_CHA]
      FROM ${TABLE}
      WHERE [ANCD] = @ANCD AND [EMPNO] = @EMPNO
    `);
		const nextCha = Number(chaResult.recordset?.[0]?.NEXT_CHA) || 1;

		const rq = pool.request();
		rq.input('ANCD', sql.Int, sessionAncd);
		rq.input('EMPNO', sql.Int, empno);
		rq.input('YY_ILSU', sql.Int, ycnt);
		rq.input('CHA_SU', sql.Int, nextCha);
		const ydt = inputDate(rq, 'YY_SDT', body.YDT ?? body.ydt ?? body.YY_SDT ?? body.accrualDate);
		const yedt = inputDate(rq, 'YY_EDT', body.YEDT ?? body.yedt ?? body.YY_EDT ?? body.endDate);
		if (!ydt || !yedt) {
			return jsonError({ success: false, error: '발생일자와 종료일자가 필요합니다.' }, 400);
		}

		await rq.query(`
      MERGE ${TABLE} AS t
      USING (SELECT @ANCD AS [ANCD], @EMPNO AS [EMPNO], @YY_SDT AS [YY_SDT]) AS s
      ON t.[ANCD] = s.[ANCD] AND t.[EMPNO] = s.[EMPNO] AND t.[YY_SDT] = s.[YY_SDT]
      WHEN MATCHED THEN
        UPDATE SET [YY_EDT] = @YY_EDT, [YY_ILSU] = @YY_ILSU
      WHEN NOT MATCHED THEN
        INSERT ([ANCD], [EMPNO], [YY_SDT], [YY_EDT], [CHA_SU], [YY_ILSU], [YY_USE])
        VALUES (@ANCD, @EMPNO, @YY_SDT, @YY_EDT, @CHA_SU, @YY_ILSU, 0);
    `);

		return jsonOk({
			success: true,
			data: { ANCD: sessionAncd, EMPNO: empno, YDT: ydt, YEDT: yedt, YCNT: ycnt },
		});
	} catch (err) {
		console.error('F01020 저장 오류:', err);
		return jsonError({
			success: false,
			error: err.message,
			details: err.toString(),
		});
	}
}

export async function DELETE(req) {
	try {
		const sessionAncd = getSessionAncd(req);
		if (sessionAncd == null) {
			return jsonError({ success: false, error: '로그인이 필요합니다.' }, 401);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const empno = parseEmpno(req.nextUrl.searchParams.get('empno'));
		const ydt = normalizeYmd(req.nextUrl.searchParams.get('ydt'));
		if (empno == null || !ydt) {
			return jsonError({ success: false, error: 'empno, ydt가 필요합니다.' }, 400);
		}

		const rq = pool.request();
		rq.input('ANCD', sql.Int, sessionAncd);
		rq.input('EMPNO', sql.Int, empno);
		inputDate(rq, 'YY_SDT', ydt);
		await rq.query(`
      DELETE FROM ${TABLE}
      WHERE [ANCD] = @ANCD AND [EMPNO] = @EMPNO AND [YY_SDT] = @YY_SDT
    `);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F01020 삭제 오류:', err);
		return jsonError({
			success: false,
			error: err.message,
			details: err.toString(),
		});
	}
}

/**
 * @file API /api/f01010 — 자료실·첨부 F01010
 *
 * @description
 * 자료실·첨부 F01010 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f01010/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdAccess, assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const sql = require('mssql');

const { normalizeYmdOrNull: normalizeYmd } = require('../../../utils/normalizeYmd');
const TABLE = '[돌봄시설DB].[dbo].[F01010]';


function inputDate(request, name, ymd) {
	const n = normalizeYmd(ymd);
	if (n === null) {
		request.input(name, sql.Date, null);
	} else {
		request.input(name, sql.Date, new Date(`${n}T00:00:00`));
	}
}

function truncNullable(v, max) {
	if (v == null || v === '') return null;
	const s = String(v).trim();
	if (!s) return null;
	return s.length <= max ? s : s.slice(0, max);
}

function parseIntOrZero(v) {
	if (v == null || v === '') return 0;
	const n = parseInt(String(v).replace(/,/g, ''), 10);
	return Number.isFinite(n) ? n : 0;
}

function parseIntOrNull(v) {
	if (v == null || v === '') return null;
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : null;
}

function pickJobst(body) {
	const v = body.JOBST ?? body.jobst ?? body.workStatus;
	const s = String(v ?? '1').trim();
	if (s === '2' || s === '9') return s;
	return '1';
}

function pickMngGu(body) {
	const raw = body.MNG_GU ?? body.mngGu ?? body.attendanceManagement;
	if (raw === 'N' || raw === false || raw === 'false') return 'N';
	return 'Y';
}

export async function GET(req) {
  try {
    const urlAncd = req.nextUrl.searchParams.get('ancd') || '';

    const pool = await connPool;
    if (!pool) {
      return jsonError({
        success: false,
        error: '데이터베이스 연결 실패'
      });
    }

    const access = await assertAnCdAccess(req, pool, urlAncd || null);
    if (!access.ok) return access.response;

    const searchParams = req.nextUrl.searchParams;
    const searchName = searchParams.get('name') || '';
    const uid = searchParams.get('uid') || '';
    const empno = searchParams.get('empno') || '';
    const q = searchParams.get('q') || '';

    // F01010 테이블에서 사원 정보 조회
    let query = `
      SELECT
        [ANCD],
        [EMPNO],
        [EMPNM],
        [JMNO],
        [YRNT],
        [JOB],
        [JOBST],
        [JOBADD],
        [JOBSH],
        [BK],
        [BKNO],
        [SDT],
        [EDT],
        [HSDT],
        [HEDT],
        [EMPHP],
        [EMPTEL],
        [EMPZIP],
        [EMPADD],
        [INDT],
        [ETC],
        [INEMPNO],
        [INEMPNM],
        [SGN_IMG],
        [MNG_GU],
        [BASE_DT]
      FROM ${TABLE}
      WHERE 1=1
    `;

    const request = pool.request();

    query += ` AND [ANCD] = @ancd`;
    const sa = access.targetAncd;
    request.input('ancd', typeof sa === 'number' ? sa : parseInt(String(sa), 10));

    // uid로 조회 (사원명 또는 사원번호로 매칭)
    if (uid && uid.trim() !== '') {
      const uidTrimmed = uid.trim();
      const empnoFromUid = parseInt(uidTrimmed);
      const isNumericUid = !isNaN(empnoFromUid);

      request.input('uid', uidTrimmed);
      
      if (isNumericUid) {
        // 숫자인 경우 사원명 또는 사원번호로 검색
        query += ` AND ([EMPNM] = @uid OR [EMPNO] = @empnoFromUid)`;
        request.input('empnoFromUid', empnoFromUid);
      } else {
        // 숫자가 아닌 경우 사원명으로만 검색
        query += ` AND [EMPNM] = @uid`;
      }
    } else if (empno && empno.trim() !== '') {
      // 사원번호로 직접 조회 (ancd는 이미 위에서 처리됨)
      query += ` AND [EMPNO] = @empno`;
      request.input('empno', parseInt(empno.trim()));
    } else if (q && q.trim() !== '') {
      query += ` AND ([EMPNM] LIKE @q OR CAST([EMPNO] AS VARCHAR(20)) LIKE @q)`;
      request.input('q', `%${q.trim()}%`);
    } else if (searchName && searchName.trim() !== '') {
      // 사원명으로 검색
      query += ` AND [EMPNM] LIKE @searchName`;
      request.input('searchName', `%${searchName.trim()}%`);
    }

    query += ` ORDER BY [EMPNM]`;

    const result = await request.query(query);

    return jsonOk({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });

  } catch (err) {
    console.error('F01010 테이블 조회 오류:', err);
    return jsonError({
      success: false,
      error: err.message,
      details: err.toString()
    });
  }
}

function bindEmployeeInputs(rq, body) {
	const empNm = truncNullable(body.EMPNM ?? body.empNm ?? body.name, 100);
	rq.input('EMPNM', sql.VarChar(100), empNm);
	rq.input('JMNO', sql.VarChar(20), truncNullable(body.JMNO ?? body.jmno, 20));
	rq.input('YRNT', sql.Int, parseIntOrZero(body.YRNT ?? body.yrnt ?? body.yearsOfService));
	rq.input('JOB', sql.VarChar(20), truncNullable(body.JOB ?? body.job, 20));
	rq.input('JOBST', sql.Char(1), pickJobst(body));
	rq.input('JOBADD', sql.VarChar(50), truncNullable(body.JOBADD ?? body.jobadd ?? body.workLocation, 50));
	rq.input('JOBSH', sql.VarChar(50), truncNullable(body.JOBSH ?? body.jobsh ?? body.workType, 50));
	rq.input('BK', sql.VarChar(50), truncNullable(body.BK ?? body.bk ?? body.salaryBank, 50));
	rq.input('BKNO', sql.VarChar(20), truncNullable(body.BKNO ?? body.bkno ?? body.bankAccount, 20));
	inputDate(rq, 'SDT', body.SDT ?? body.sdt ?? body.hireDate);
	inputDate(rq, 'EDT', body.EDT ?? body.edt ?? body.retirementDate);
	inputDate(rq, 'HSDT', body.HSDT ?? body.hsdt ?? body.leaveStartDate);
	inputDate(rq, 'HEDT', body.HEDT ?? body.hedt ?? body.leaveEndDate);
	rq.input('EMPHP', sql.VarChar(15), truncNullable(body.EMPHP ?? body.emphp ?? body.mobilePhone, 15));
	rq.input('EMPTEL', sql.VarChar(15), truncNullable(body.EMPTEL ?? body.emptel ?? body.homePhone, 15));
	rq.input('EMPZIP', sql.VarChar(10), truncNullable(body.EMPZIP ?? body.empzip ?? body.zipCode, 10));
	rq.input('EMPADD', sql.VarChar(100), truncNullable(body.EMPADD ?? body.empadd ?? body.homeAddress, 100));
	rq.input('ETC', sql.VarChar(100), truncNullable(body.ETC ?? body.etc ?? body.notes, 100));
	rq.input('MNG_GU', sql.Char(1), pickMngGu(body));
	inputDate(rq, 'BASE_DT', body.BASE_DT ?? body.baseDt ?? body.annualLeaveStandardDate);
	return empNm;
}

/** POST — 신규 등록 | action:'update' 수정 (ANCD=세션) */
export async function POST(req) {
	try {
		const gate = assertAnCdMatchesSession(req, null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const isUpdate = body.action === 'update';

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		if (isUpdate) {
			const empno = parseInt(String(body.EMPNO ?? body.empno ?? ''), 10);
			if (Number.isNaN(empno)) {
				return jsonError({ success: false, error: '사원번호(EMPNO)가 필요합니다.' }, 400);
			}
			const rq = pool.request();
			rq.input('ANCD', gate.sessionAncd);
			rq.input('EMPNO', sql.Int, empno);
			const boundName = bindEmployeeInputs(rq, body);
			if (!boundName) {
				return jsonError({ success: false, error: '사원명을 입력해 주세요.' }, 400);
			}
			const upd = await rq.query(`
        UPDATE ${TABLE} SET
          [EMPNM] = @EMPNM,
          [JMNO] = @JMNO,
          [YRNT] = @YRNT,
          [JOB] = @JOB,
          [JOBST] = @JOBST,
          [JOBADD] = @JOBADD,
          [JOBSH] = @JOBSH,
          [BK] = @BK,
          [BKNO] = @BKNO,
          [SDT] = @SDT,
          [EDT] = @EDT,
          [HSDT] = @HSDT,
          [HEDT] = @HEDT,
          [EMPHP] = @EMPHP,
          [EMPTEL] = @EMPTEL,
          [EMPZIP] = @EMPZIP,
          [EMPADD] = @EMPADD,
          [ETC] = @ETC,
          [MNG_GU] = @MNG_GU,
          [BASE_DT] = @BASE_DT
        WHERE [ANCD] = @ANCD AND [EMPNO] = @EMPNO
      `);
			if (!upd.rowsAffected?.[0]) {
				return jsonError({ success: false, error: '수정할 사원 정보가 없습니다.' }, 404);
			}
			return jsonOk({ success: true, action: 'update', ancd: gate.sessionAncd, empno, EMPNM: boundName });
		}

		const empNm = truncNullable(body.EMPNM ?? body.empNm ?? body.name, 100);
		if (!empNm) {
			return jsonError({ success: false, error: '사원명을 입력해 주세요.' }, 400);
		}

		const maxR = await pool
			.request()
			.input('ANCD', gate.sessionAncd)
			.query(`SELECT ISNULL(MAX([EMPNO]), 0) + 1 AS NEXTEMPNO FROM ${TABLE} WHERE [ANCD] = @ANCD`);
		const empno = maxR.recordset?.[0]?.NEXTEMPNO;
		if (empno == null) {
			return jsonError({ success: false, error: '사원번호 채번에 실패했습니다.' });
		}

		let inempno = body.INEMPNO ?? body.inempno;
		if (inempno !== null && inempno !== undefined && inempno !== '') {
			const n = parseInt(String(inempno), 10);
			inempno = Number.isNaN(n) ? null : n;
		} else {
			inempno = null;
		}
		const rawInempnm = body.INEMPNM ?? body.inempnm;
		const inempnm =
			rawInempnm != null && String(rawInempnm).trim() !== ''
				? String(rawInempnm).trim().slice(0, 100)
				: null;

		const rq = pool.request();
		rq.input('ANCD', gate.sessionAncd);
		rq.input('EMPNO', sql.Int, empno);
		bindEmployeeInputs(rq, body);
		rq.input('INEMPNO', sql.Int, inempno);
		rq.input('INEMPNM', sql.VarChar(100), inempnm);

		await rq.query(`
      INSERT INTO ${TABLE} (
        [ANCD], [EMPNO], [EMPNM], [JMNO], [YRNT], [JOB], [JOBST], [JOBADD], [JOBSH],
        [BK], [BKNO], [SDT], [EDT], [HSDT], [HEDT], [EMPHP], [EMPTEL], [EMPZIP], [EMPADD],
        [INDT], [ETC], [INEMPNO], [INEMPNM], [MNG_GU], [BASE_DT]
      ) VALUES (
        @ANCD, @EMPNO, @EMPNM, @JMNO, @YRNT, @JOB, @JOBST, @JOBADD, @JOBSH,
        @BK, @BKNO, @SDT, @EDT, @HSDT, @HEDT, @EMPHP, @EMPTEL, @EMPZIP, @EMPADD,
        GETDATE(), @ETC, @INEMPNO, @INEMPNM, @MNG_GU, @BASE_DT
      )
    `);

		return jsonOk({
				success: true,
				ancd: gate.sessionAncd,
				empno,
				EMPNM: empNm,
			});
	} catch (err) {
		console.error('F01010 사원 등록 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

/**
 * DELETE /api/f01010?empno=...
 * 로그인 세션 ANCD + EMPNO 기준으로 F01010 삭제
 * 사원연결(F00120.EMPNO) 계정 및 해당 UID의 프로그램매핑(F00131)도 함께 삭제
 */
export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancdParam = searchParams.get('ancd');
		const empnoRaw = searchParams.get('empno') || searchParams.get('EMPNO');

		const gate = assertAnCdMatchesSession(req, ancdParam || null);
		if (!gate.ok) return gate.response;

		const empno = parseInt(String(empnoRaw ?? ''), 10);
		if (Number.isNaN(empno)) {
			return jsonError({ success: false, error: '사원번호(empno)가 필요합니다.' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const ancd = gate.sessionAncd;

		// 연결된 사용자 계정 조회
		const linked = await pool
			.request()
			.input('ANCD', ancd)
			.input('EMPNO', sql.Int, empno)
			.query(`
				SELECT [UID]
				FROM [돌봄시설DB].[dbo].[F00120]
				WHERE [ANCD] = @ANCD AND [EMPNO] = @EMPNO
			`);
		const linkedUids = (linked.recordset || [])
			.map((r) => (r.UID != null ? String(r.UID).trim() : ''))
			.filter(Boolean);

		// 프로그램 매핑(F00131) 삭제
		if (linkedUids.length) {
			for (const uid of linkedUids) {
				await pool
					.request()
					.input('ANCD', ancd)
					.input('UID', uid)
					.query(`
						DELETE FROM [돌봄시설DB].[dbo].[F00131]
						WHERE [ANCD] = @ANCD AND [UID] = @UID
					`);
			}
		}

		// 사용자 계정(F00120) 삭제
		const delAccounts = await pool
			.request()
			.input('ANCD', ancd)
			.input('EMPNO', sql.Int, empno)
			.query(`
				DELETE FROM [돌봄시설DB].[dbo].[F00120]
				WHERE [ANCD] = @ANCD AND [EMPNO] = @EMPNO
			`);
		const deletedAccounts = delAccounts?.rowsAffected?.[0] ?? 0;

		// 사원(F01010) 삭제
		const result = await pool
			.request()
			.input('ANCD', ancd)
			.input('EMPNO', sql.Int, empno)
			.query(`
				DELETE FROM ${TABLE}
				WHERE [ANCD] = @ANCD AND [EMPNO] = @EMPNO
			`);

		const affected = result?.rowsAffected?.[0] ?? 0;
		if (!affected) {
			return jsonError({ success: false, error: '삭제할 사원 정보가 없습니다.' }, 404);
		}

		return jsonOk({
				success: true,
				message: '사원정보가 삭제되었습니다.',
				ancd,
				empno,
				deletedAccounts,
				linkedUids,
			});
	} catch (err) {
		console.error('F01010 사원 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

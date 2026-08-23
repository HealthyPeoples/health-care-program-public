/**
 * @file API /api/f10010 — 수급자 기본정보 F10010
 *
 * @description
 * GET: 세션 기관 수급자 목록. POST: action 화이트리스트 고정 SQL만 허용(동적 query 거부).
 *
 * @module app/api/f10010/route
 */
import { connPool } from '../../../config/server';
import { NextRequest } from 'next/server';
import { getSessionAncd } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';

const { dispatchF10010Action } = require('./actions');
const { ensureF10010RoomNo } = require('../../../lib/ensureF10010RoomNo');
export async function GET(req) {
  try {
    const sessionAncd = getSessionAncd(req);
    if (sessionAncd == null) {
      return jsonError({ success: false, error: '로그인이 필요합니다.' }, 401);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ 
        success: false, 
        error: '데이터베이스 연결 실패' 
      });
    }

    // URL에서 검색어 추출
    const searchParams = req.nextUrl.searchParams;
    const searchName = searchParams.get('name') || '';

    // F10010 테이블과 F10110 테이블을 조인해서 수급자 정보 및 계약정보 조회
    // F10110에서 각 (ANCD, PNUM) 조합에 대해 최신 1건만 가져오기 위해 서브쿼리 사용
    // F10020도 최신 1건만 가져오기 위해 서브쿼리 사용하여 중복 방지
    let query = `
      SELECT DISTINCT
        f10010.[ANCD],
        f10010.[PNUM],
        f10010.[P_NM],
        f10010.[P_BRDT],
        f10010.[P_NO],
        f10010.[P_SEX],
        f10010.[P_ZIP],
        f10010.[P_ADDR],
        f10010.[P_TEL],
        f10010.[P_GRD],
        f10010.[P_YYNO],
        f10010.[P_YYDT],
        f10010.[P_ST],
        f10010.[P_CINFO],
        f10010.[P_CTDT],
        f10010.[P_SDT],
        f10010.[P_SDT_TM],
        f10010.[P_EDT],
        f10010.[P_EDT_TM],
        f10010.[HCANUM],
        f10010.[HCAINFO],
        f10010.[HSPT],
        f10010.[DTNM],
        f10010.[DTTEL],
        f10010.[INDT],
        f10010.[ETC],
        f10010.[INEMPNO],
        f10010.[INEMPNM],
        f10010.[P_HP],
        f10010.[P_YYSDT],
        f10010.[P_YYEDT],
        f10010.[P_FLOOR],
        f10010.[ROOM_NO],
        f10110.[SVSDT],
        f10110.[SVEDT],
        f10110.[INSPER],
        f10110.[USRPER],
        f10110.[USRGU],
        f10110.[USRINFO],
        f10110.[EAMT],
        f10110.[ETAMT],
        f10110.[ESAMT],
        f10020.[BHNM],
        f10020.[BHREL],
        f10020.[BHETC],
        f10020.[BHJB],
        f10020.[P_ZIP] as GUARDIAN_P_ZIP,
        f10020.[P_ADDR] as GUARDIAN_P_ADDR,
        f10020.[P_TEL] as GUARDIAN_P_TEL,
        f10020.[P_HP] as GUARDIAN_P_HP,
        f10020.[P_EMAIL],
        f10020.[CONGU]
      FROM [돌봄시설DB].[dbo].[F10010] f10010
      LEFT JOIN (
        SELECT 
          [ANCD],
          [PNUM],
          [SVSDT],
          [SVEDT],
          [INSPER],
          [USRPER],
          [USRGU],
          [USRINFO],
          [EAMT],
          [ETAMT],
          [ESAMT],
          ROW_NUMBER() OVER (PARTITION BY [ANCD], [PNUM] ORDER BY [INDT] DESC) as rn
        FROM [돌봄시설DB].[dbo].[F10110]
      ) f10110 ON f10010.[ANCD] = f10110.[ANCD] 
               AND f10010.[PNUM] = f10110.[PNUM]
               AND f10110.rn = 1
      LEFT JOIN (
        SELECT 
          [ANCD],
          [PNUM],
          [BHNUM],
          [BHNM],
          [BHREL],
          [BHETC],
          [BHJB],
          [P_ZIP],
          [P_ADDR],
          [P_TEL],
          [P_HP],
          [P_EMAIL],
          [CONGU],
          ROW_NUMBER() OVER (PARTITION BY [ANCD], [PNUM] ORDER BY [INDT] DESC) as rn
        FROM [돌봄시설DB].[dbo].[F10020]
      ) f10020 ON f10010.[ANCD] = f10020.[ANCD] 
               AND f10010.[PNUM] = f10020.[PNUM]
               AND f10020.rn = 1
    `;

    await ensureF10010RoomNo(pool, sessionAncd);

    const request = pool.request();
    request.input('sessionAncd', sessionAncd);

    query += ` WHERE f10010.[ANCD] = @sessionAncd`;

    // 이름 검색 조건 추가
    if (searchName && searchName.trim() !== '') {
      query += ` AND f10010.[P_NM] LIKE @searchName`;
      request.input('searchName', `%${searchName.trim()}%`);
    }

    query += ` ORDER BY f10010.[ANCD], f10010.[PNUM], f10010.[INDT] DESC`;

    const result = await request.query(query);
    
    // 중복 제거 (ANCD, PNUM 조합 기준)
    const uniqueMembers = new Map();
    result.recordset.forEach((row) => {
      const key = `${row.ANCD}-${row.PNUM}`;
      if (!uniqueMembers.has(key)) {
        uniqueMembers.set(key, row);
      }
    });
    
    const uniqueData = Array.from(uniqueMembers.values());
    
    return jsonOk({ 
      success: true, 
      data: uniqueData,
      count: uniqueData.length
    });

  } catch (err) {
    console.error('F10010 테이블 조회 오류:', err);
    return jsonError({ 
      success: false, 
      error: err.message,
      details: err.toString()
    });
  }
}

/**
 * 고정 action만 허용. body.query(동적 SQL)는 거부합니다.
 * @example { action: 'member.update', params: { PNUM, P_NM, ... } }
 */
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

    const body = await req.json();
    if (body?.query != null) {
      return jsonError(
        {
          success: false,
          error: '동적 SQL(query)은 지원하지 않습니다. action을 사용하세요.',
        },
        400
      );
    }

    const action = body?.action;
    const params = body?.params;
    if (!action || typeof action !== 'string') {
      return jsonError({ success: false, error: 'action이 필요합니다.' }, 400);
    }

    await ensureF10010RoomNo(pool, sessionAncd);
    const result = await dispatchF10010Action(pool, sessionAncd, action, params);
    return jsonOk(result);
  } catch (err) {
    console.error('F10010 action 오류:', err);
    const status = err?.status || 500;
    return jsonError(
      { success: false, error: err.message, details: err.toString() },
      status
    );
  }
}

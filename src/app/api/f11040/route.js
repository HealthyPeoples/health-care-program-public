/**
 * @file API /api/f11040 — 직원 매핑/배정 F11040
 *
 * @description
 * 직원 매핑/배정 F11040 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f11040/route
 */
import { connPool } from '../../../config/server';
import { NextRequest } from 'next/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const pnum = searchParams.get('pnum');

    const gate = assertAnCdMatchesSession(req, ancd);
    if (!gate.ok) return gate.response;

    console.log('[F11040 API] 요청 파라미터 - ANCD:', ancd, 'PNUM:', pnum, 'PNUM 타입:', typeof pnum);

    if (!ancd || !pnum) {
      return jsonError({ 
        success: false, 
        error: 'ANCD와 PNUM 파라미터가 필요합니다' 
      }, 400);
    }

    const pool = await connPool;
    if (!pool) {
      return jsonError({ 
        success: false, 
        error: '데이터베이스 연결 실패' 
      });
    }

    // PNUM이 숫자 문자열인 경우 숫자로 변환 시도
    const pnumValue = isNaN(Number(pnum)) ? pnum : Number(pnum);
    
    let query = `
      SELECT 
        [ANCD],
        [PNUM],
        [MEDT],
        [MDIC],
        [MINFO],
        [MENUM],
        [INDT],
        [ETC],
        [INEMPNO],
        [INEMPNM]
      FROM [돌봄시설DB].[dbo].[F11040]
      WHERE [ANCD] = @ancd AND CAST([PNUM] AS VARCHAR) = CAST(@pnum AS VARCHAR)
      ORDER BY [MEDT] DESC, [INDT] DESC
    `;

    const request = pool.request();
    request.input('ancd', ancd);
    request.input('pnum', String(pnum)); // 항상 문자열로 전달하여 타입 불일치 방지
    
    console.log('[F11040 API] 쿼리 실행 - ANCD:', ancd, 'PNUM:', pnum, 'PNUM 타입:', typeof pnum);

    const result = await request.query(query);
    
    console.log('[F11040 API] 조회 결과 수:', result.recordset ? result.recordset.length : 0);
    if (result.recordset && result.recordset.length > 0) {
      console.log('[F11040 API] 첫 번째 레코드:', result.recordset[0]);
    }
    
    return jsonOk({ 
      success: true, 
      data: result.recordset || [],
      count: result.recordset ? result.recordset.length : 0
    });

  } catch (err) {
    console.error('F11040 테이블 조회 오류:', err);
    return jsonError({ 
      success: false, 
      error: err.message,
      details: err.toString()
    });
  }
}


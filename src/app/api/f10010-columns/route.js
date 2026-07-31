/**
 * @file API /api/f10010-columns — 수급자 컬럼 메타
 *
 * @description
 * 수급자 컬럼 메타 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f10010-columns/route
 */
import { connPool } from '../../../config/server';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
export async function GET(req) {
  try {
    const pool = await connPool;
    if (!pool) {
      return jsonError({ 
        success: false, 
        error: '데이터베이스 연결 실패' 
      });
    }

    // F10010 테이블의 컬럼 정보 조회
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'F10010' 
      AND TABLE_SCHEMA = 'dbo'
      ORDER BY ORDINAL_POSITION
    `);
    
    return jsonOk({ 
      success: true, 
      data: result.recordset,
      count: result.recordset.length
    });

  } catch (err) {
    console.error('F10010 컬럼 정보 조회 오류:', err);
    return jsonError({ 
      success: false, 
      error: err.message,
      details: err.toString()
    });
  }
}

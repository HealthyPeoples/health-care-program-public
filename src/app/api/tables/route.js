/**
 * @file API /api/tables — 테이블 목록/스키마 조회(개발용)
 *
 * @description
 * 테이블 목록/스키마 조회(개발용) Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/tables/route
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

    // 데이터베이스의 모든 테이블 조회
    const result = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    return jsonOk({ 
      success: true, 
      data: result.recordset,
      count: result.recordset.length
    });

  } catch (err) {
    console.error('테이블 목록 조회 오류:', err);
    return jsonError({ 
      success: false, 
      error: err.message,
      details: err.toString()
    });
  }
}

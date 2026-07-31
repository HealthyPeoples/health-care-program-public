/**
 * @file API /api/dbtest — DB 연결 테스트(개발용)
 *
 * @description
 * DB 연결 테스트(개발용) Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/dbtest/route
 */
import { connPool } from '../../../config/server';

export async function GET(req) {
  try {
    const pool = await connPool;
    if (pool) {
      return new Response('DB 연결 성공', { status: 200 });
    } else {
      return new Response('DB 연결 실패: pool 없음', { status: 500 });
    }
  } catch (err) {
    return new Response('DB 연결 실패: ' + err.message, { status: 500 });
  }
} 
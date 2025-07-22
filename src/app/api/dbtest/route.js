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
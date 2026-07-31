/**
 * @file API /api/logout — 로그아웃
 *
 * @description
 * 로그아웃 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/logout/route
 */
import { NextResponse } from 'next/server';

import { jsonError } from '../../../utils/apiResponse';
export async function POST(req) {
  try {
    const response = NextResponse.json(
      { success: true, message: '로그아웃되었습니다.' },
      { status: 200 }
    );

    // 쿠키 삭제
    response.cookies.delete('auth_token');
    response.cookies.delete('user_info');

    return response;
  } catch (err) {
    console.error('로그아웃 오류:', err);
    return jsonError({ success: false, message: '로그아웃 처리 중 오류가 발생했습니다.' });
  }
}


/**
 * @file API /api/auth/check — 인증(세션 확인·연장·사용자정보)
 *
 * @description
 * 인증(세션 확인·연장·사용자정보) Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/auth/check/route
 */
import { NextRequest, NextResponse } from 'next/server';

import { jsonOk, jsonError } from '../../../../utils/apiResponse';
export async function GET(req) {
  try {
    const token = req.cookies.get('auth_token')?.value;
    const userInfo = req.cookies.get('user_info')?.value;

    if (!token || !userInfo) {
      return jsonError({ authenticated: false }, 401);
    }

    // 토큰 유효성 검사 (만료 시간 확인)
    try {
      const user = JSON.parse(userInfo);
      const expiresAt = new Date(user.expiresAt);
      
      if (expiresAt < new Date()) {
        // 토큰 만료
        const response = NextResponse.json(
          { authenticated: false, message: '세션이 만료되었습니다.' },
          { status: 401 }
        );
        response.cookies.delete('auth_token');
        response.cookies.delete('user_info');
        return response;
      }

      return jsonOk({ authenticated: true, user: { ancd: user.ancd, uid: user.uid } });
    } catch (parseError) {
      return jsonError({ authenticated: false, message: '인증 정보가 올바르지 않습니다.' }, 401);
    }
  } catch (err) {
    console.error('인증 체크 오류:', err);
    return jsonError({ authenticated: false, message: '인증 확인 중 오류가 발생했습니다.' });
  }
}


/**
 * @file API /api/auth/user-info — 인증(세션 확인·연장·사용자정보)
 *
 * @description
 * 인증(세션 확인·연장·사용자정보) Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/auth/user-info/route
 */
import { NextRequest } from 'next/server';
import { connPool } from '../../../../config/server';
import { parseUserInfoCookieValue } from '../../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../../utils/apiResponse';
export async function GET(req) {
  try {
    // 쿠키에서 user_info 읽기
    const userInfo = req.cookies.get('user_info')?.value;

    if (!userInfo) {
      return jsonError({
        success: false,
        error: '쿠키가 없습니다'
      }, 404);
    }

    let parsedUserInfo = parseUserInfoCookieValue(userInfo);
    if (!parsedUserInfo) {
      return jsonError({
        success: false,
        error: '쿠키 파싱 오류'
      }, 400);
    }

    // DB에서 기관명·관리등급·로그인 사원명 보강 (쿠키에 없거나 DB만 가능할 때)
    try {
      const pool = await connPool;
      if (pool && parsedUserInfo.ancd != null && parsedUserInfo.ancd !== '') {
        const n = parseInt(String(parsedUserInfo.ancd), 10);
        if (!Number.isNaN(n)) {
          if (!parsedUserInfo.annm) {
            const r = await pool
              .request()
              .input('ancd', n)
              .query(
                `SELECT TOP 1 [ANNM] FROM [돌봄시설DB].[dbo].[F00110] WHERE [ANCD] = @ancd`
              );
            const annm = r.recordset?.[0]?.ANNM;
            if (annm) {
              parsedUserInfo = { ...parsedUserInfo, annm };
            }
          }
          if (parsedUserInfo.uid) {
            const r2 = await pool
              .request()
              .input('ancd', n)
              .input('uid', String(parsedUserInfo.uid).trim())
              .query(
                `SELECT TOP 1 [EMPNO], [EMPNM], RTRIM([UGR]) AS [UGR],
                        RTRIM([DECYN]) AS [DECYN], [DECPOS]
                 FROM [돌봄시설DB].[dbo].[F00120]
                 WHERE [ANCD] = @ancd AND [UID] = @uid`
              );
            const row2 = r2.recordset?.[0];
            if (row2?.EMPNM) {
              parsedUserInfo = { ...parsedUserInfo, empnm: row2.EMPNM };
            }
            if (row2?.EMPNO != null && row2.EMPNO !== '') {
              parsedUserInfo = { ...parsedUserInfo, empno: row2.EMPNO };
            }
            const ugr = row2?.UGR != null ? String(row2.UGR).trim() : '';
            if (ugr) {
              parsedUserInfo = { ...parsedUserInfo, ugr };
            }
            if (row2?.DECYN != null) {
              parsedUserInfo = {
                ...parsedUserInfo,
                decyn: String(row2.DECYN).trim().toUpperCase() === 'Y' ? 'Y' : 'N',
              };
            }
            if (row2?.DECPOS != null && row2.DECPOS !== '') {
              const pos = Number(row2.DECPOS);
              if (Number.isFinite(pos)) {
                parsedUserInfo = { ...parsedUserInfo, decpos: pos };
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('user-info DB 보강 실패:', e);
    }

    return jsonOk({
      success: true,
      data: parsedUserInfo
    });

  } catch (err) {
    console.error('user_info 쿠키 읽기 오류:', err);
    return jsonError({
      success: false,
      error: err.message
    });
  }
}

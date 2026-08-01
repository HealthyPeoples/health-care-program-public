/**
 * @file API /api/user-code-list — 사용자코드 목록
 *
 * @description
 * 사용자코드 목록 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/user-code-list/route
 */
import { NextRequest } from 'next/server';
import { parseStringPromise } from 'xml2js';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
// 동적 렌더링 설정
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(
      'http://www.ggasp.co.kr:81/ups/EnterpriseService.do?ServiceName=executeService&ModelPath=P00100.QWP&pn=takecare&ModelUID=15',
      { 
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const xml = await res.text();
    const json = await parseStringPromise(xml, { explicitArray: false, trim: true });
    const rows = json?.Result?.Model?.DataTable?.Row || [];
    
    return jsonOk({ rows });
  } catch (error) {
    console.error('API Error:', error);
    return jsonError({ error: 'Failed to fetch data', rows: [] });
  }
} 
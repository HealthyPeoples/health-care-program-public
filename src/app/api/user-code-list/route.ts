import { NextRequest, NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

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
    
    return NextResponse.json({ rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', rows: [] },
      { status: 500 }
    );
  }
} 
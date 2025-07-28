import { NextRequest, NextResponse } from 'next/server';
import { parseStringPromise } from 'xml2js';

export async function GET(req: NextRequest) {
  const res = await fetch(
    'http://www.ggasp.co.kr:81/ups/EnterpriseService.do?ServiceName=executeService&ModelPath=P00100.QWP&pn=takecare&ModelUID=15',
    { cache: 'no-store' }
  );
  const xml = await res.text();
  const json = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const rows = json?.Result?.Model?.DataTable?.Row || [];
  return NextResponse.json({ rows });
} 
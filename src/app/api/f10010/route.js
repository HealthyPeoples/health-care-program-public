import { connPool } from '../../../config/server';

export async function GET(req) {
  try {
    const pool = await connPool;
    if (!pool) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '데이터베이스 연결 실패' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // F10110과 F10020 테이블을 조인해서 수급자 정보 조회
    const result = await pool.request().query(`
      SELECT TOP 1000 
        f10110.ANCD,
        f10110.PNUM,
        f10110.CDT,
        f10110.SVSDT,
        f10110.SVEDT,
        f10110.INSPER,
        f10110.USRPER,
        f10110.USRGU,
        f10110.USRINFO,
        f10110.USRINFO_AMT,
        f10110.EAMT,
        f10110.ETAMT,
        f10110.ESAMT,
        f10110.EDAYAMT,
        f10110.CHGU,
        f10110.INDT,
        f10110.ETC,
        f10110.INEMPNO,
        f10110.INEMPNM,
        f10110.P_GRD,
        f10020.BHNUM,
        f10020.BHNM,
        f10020.BHREL,
        f10020.BHETC,
        f10020.BHJB,
        f10020.P_ZIP,
        f10020.P_ADDR,
        f10020.P_TEL,
        f10020.P_HP,
        f10020.P_EMAIL,
        f10020.CONGU
      FROM [돌봄시설DB].[dbo].[F10110] f10110
      LEFT JOIN [돌봄시설DB].[dbo].[F10020] f10020 ON f10110.ANCD = f10020.ANCD AND f10110.PNUM = f10020.PNUM
      ORDER BY f10110.ANCD, f10110.INDT DESC
    `);
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: result.recordset,
      count: result.recordset.length
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('F10010 테이블 조회 오류:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message,
      details: err.toString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(req) {
  try {
    const pool = await connPool;
    if (!pool) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '데이터베이스 연결 실패' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { query, params } = body;

    if (!query) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '쿼리가 필요합니다' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 동적 쿼리 실행
    const request = pool.request();
    
    // 파라미터가 있으면 추가
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
    }

    const result = await request.query(query);
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: result.recordset,
      count: result.recordset.length
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('쿼리 실행 오류:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message,
      details: err.toString()
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

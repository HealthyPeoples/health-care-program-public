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

    // F90030 테이블에서 데이터 조회
    const result = await pool.request().query(`
      SELECT TOP (1000) [OBJ3]
      ,[OBJ1]
      ,[OBJ2]
      ,[OBJ3NM]
      ,[ANI]
      ,[INDT]
      ,[ETC]
      ,[URDT]
      ,[ICD]
      ,[DEL]
      ,[INEMPNO]
      ,[INEMPNM]
      FROM [돌봄시설DB].[dbo].[F90030]
      ORDER BY OBJ3
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
    console.error('F90030 테이블 조회 오류:', err);
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

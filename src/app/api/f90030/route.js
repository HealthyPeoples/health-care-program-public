import { connPool } from '../../../config/server';

import { normalizeYmd } from '../../../utils/normalizeYmd';
const TABLE_NAME = '[돌봄시설DB].[dbo].[F90030]';


export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const obj3 = searchParams.get('obj3');
    const icd = searchParams.get('icd');
    const includeDeleted = searchParams.get('includeDeleted') === '1';

    const pool = await connPool;
    if (!pool) {
      return new Response(JSON.stringify({ success: false, error: '데이터베이스 연결 실패' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const request = pool.request();
    let where = 'WHERE 1=1';

    if (obj3) {
      request.input('OBJ3', String(obj3).trim().slice(0, 10));
      where += ' AND [OBJ3] = @OBJ3';
    }
    if (icd) {
      request.input('ICD', String(icd).trim().slice(0, 2));
      where += ' AND [ICD] = @ICD';
    }
    if (!includeDeleted) {
      where += " AND ISNULL([DEL], '') <> 'D'";
    }

    const query = `
      SELECT [OBJ3],[OBJ1],[OBJ2],[OBJ3NM],[ANI],[INDT],[ETC],[URDT],[ICD],[DEL],[INEMPNO],[INEMPNM]
      FROM ${TABLE_NAME}
      ${where}
      ORDER BY [OBJ3]
    `;

    const result = await request.query(query);
    const data = (result.recordset || []).map((r) => ({
      ...r,
      INDT: normalizeYmd(r.INDT),
      URDT: normalizeYmd(r.URDT),
    }));

    return new Response(JSON.stringify({ success: true, data, count: data.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('F90030 조회 오류:', err);
    return new Response(JSON.stringify({ success: false, error: err.message, details: err.toString() }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const obj3 = body?.OBJ3;

    if (!obj3) {
      return new Response(JSON.stringify({ success: false, error: 'OBJ3는 필수입니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pool = await connPool;
    if (!pool) {
      return new Response(JSON.stringify({ success: false, error: '데이터베이스 연결 실패' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const request = pool.request();
    request.input('OBJ3', String(obj3).trim().slice(0, 10));

    const pick = (k) => (Object.prototype.hasOwnProperty.call(body || {}, k) ? body[k] : null);
    ['OBJ1', 'OBJ2', 'OBJ3NM', 'ANI', 'ETC', 'ICD', 'DEL', 'INEMPNM'].forEach((k) => {
      request.input(k, pick(k) == null ? null : String(pick(k)));
    });
    const inempno = pick('INEMPNO');
    request.input('INEMPNO', inempno == null || inempno === '' ? null : parseInt(String(inempno), 10));

    const query = `
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @OBJ3 AS OBJ3) AS S ON (T.[OBJ3] = S.[OBJ3])
      WHEN MATCHED THEN
        UPDATE SET
          [OBJ1] = @OBJ1,
          [OBJ2] = @OBJ2,
          [OBJ3NM] = @OBJ3NM,
          [ANI] = @ANI,
          [ETC] = @ETC,
          [ICD] = @ICD,
          [DEL] = ISNULL(@DEL, T.[DEL]),
          [INEMPNO] = @INEMPNO,
          [INEMPNM] = @INEMPNM,
          [URDT] = CONVERT(date, GETDATE())
      WHEN NOT MATCHED THEN
        INSERT ([OBJ3],[OBJ1],[OBJ2],[OBJ3NM],[ANI],[ETC],[ICD],[DEL],[INEMPNO],[INEMPNM],[INDT],[URDT])
        VALUES (@OBJ3, @OBJ1, @OBJ2, @OBJ3NM, @ANI, @ETC, @ICD, ISNULL(@DEL, ' '), @INEMPNO, @INEMPNM, CONVERT(date, GETDATE()), CONVERT(date, GETDATE()));
    `;

    await request.query(query);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('F90030 저장 오류:', err);
    return new Response(JSON.stringify({ success: false, error: err.message, details: err.toString() }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const obj3 = searchParams.get('obj3');

    if (!obj3) {
      return new Response(JSON.stringify({ success: false, error: 'obj3 파라미터가 필요합니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pool = await connPool;
    if (!pool) {
      return new Response(JSON.stringify({ success: false, error: '데이터베이스 연결 실패' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const request = pool.request();
    request.input('OBJ3', String(obj3).trim().slice(0, 10));

    await request.query(`
      UPDATE ${TABLE_NAME}
      SET [DEL] = 'D', [URDT] = CONVERT(date, GETDATE())
      WHERE [OBJ3] = @OBJ3
    `);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('F90030 삭제 오류:', err);
    return new Response(JSON.stringify({ success: false, error: err.message, details: err.toString() }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

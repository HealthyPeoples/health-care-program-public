import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F30110]';

function toYmd(v) {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (!s) return '';
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const parsed = Date.parse(s);
	if (!Number.isNaN(parsed)) {
		const dt = new Date(parsed);
		const y = dt.getFullYear();
		const m = String(dt.getMonth() + 1).padStart(2, '0');
		const d = String(dt.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

function pick(body, k, fallback = null) {
	if (!body || typeof body !== 'object') return fallback;
	if (Object.prototype.hasOwnProperty.call(body, k)) return body[k];
	const alt = k.toLowerCase();
	if (alt !== k && Object.prototype.hasOwnProperty.call(body, alt)) return body[alt];
	return fallback;
}

function toNullableDate(v) {
	const ymd = toYmd(v);
	return ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function mapRow(r) {
	if (!r) return null;
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		SEQ: r.SEQ,
		RSDT: toYmd(r.RSDT),
		MENM: r.MENM != null ? String(r.MENM) : '',
		SDT: toYmd(r.SDT),
		EDT: toYmd(r.EDT),
		INQNT: r.INQNT != null ? String(r.INQNT) : '',
		INCNT: r.INCNT != null ? String(r.INCNT) : '',
		METM: r.METM != null ? String(r.METM) : '',
		CAPDES: r.CAPDES != null ? String(r.CAPDES) : '',
		DEL: r.DEL != null ? String(r.DEL).trim() : '',
		INDT: toYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNO: r.INEMPNO,
		INEPNM: r.INEPNM != null ? String(r.INEPNM) : r.INEMPNM != null ? String(r.INEMPNM) : '',
	};
}

/** GET /api/f30110?pnum= */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		if (!pnum) {
			return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));

		const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND ISNULL([DEL], '') <> 'D'
      ORDER BY [RSDT] DESC, [SEQ] DESC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F30110 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** POST /api/f30110 — 신규 */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const menm = String(pick(body, 'MENM', '') ?? '').trim();
		const rsdt = toNullableDate(pick(body, 'RSDT'));

		if (pnum == null || String(pnum).trim() === '') {
			return jsonError({ success: false, error: 'PNUM은 필수입니다' }, 400);
		}
		if (!menm) {
			return jsonError({ success: false, error: '복용약물명(MENM)은 필수입니다' }, 400);
		}
		if (!rsdt) {
			return jsonError({ success: false, error: '조사일자(RSDT)는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		const seqReq = pool.request();
		seqReq.input('ANCD', sql.Int, Number(gate.sessionAncd));
		seqReq.input('PNUM', sql.Int, Number(pnum));
		const seqResult = await seqReq.query(`
      SELECT ISNULL(MAX([SEQ]), 0) + 1 AS NEXT_SEQ
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
    `);
		const nextSeq = Number(seqResult.recordset?.[0]?.NEXT_SEQ || 1);

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('SEQ', sql.Int, nextSeq);
		request.input('RSDT', sql.Date, rsdt);
		request.input('MENM', sql.VarChar(100), menm.slice(0, 100));
		request.input('SDT', sql.Date, toNullableDate(pick(body, 'SDT')));
		request.input('EDT', sql.Date, toNullableDate(pick(body, 'EDT')));
		request.input('INQNT', sql.VarChar(20), String(pick(body, 'INQNT', '') ?? '').slice(0, 20) || null);
		request.input('INCNT', sql.VarChar(40), String(pick(body, 'INCNT', '') ?? '').slice(0, 40) || null);
		request.input('METM', sql.VarChar(40), String(pick(body, 'METM', '') ?? '').slice(0, 40) || null);
		request.input('CAPDES', sql.VarChar(100), String(pick(body, 'CAPDES', '') ?? '').slice(0, 100) || null);
		request.input('DEL', sql.Char(1), null);
		request.input('INDT', sql.Date, indt);
		request.input('ETC', sql.VarChar(100), pick(body, 'ETC', null));
		request.input('INEPNM', sql.VarChar(100), pick(body, 'INEPNM', pick(body, 'INEMPNM', null)));

		await request.query(`
      INSERT INTO ${TABLE_NAME}
        ([ANCD],[PNUM],[SEQ],[RSDT],[MENM],[SDT],[EDT],[INQNT],[INCNT],[METM],[CAPDES],[DEL],[INDT],[ETC],[INEPNM])
      VALUES
        (@ANCD,@PNUM,@SEQ,@RSDT,@MENM,@SDT,@EDT,@INQNT,@INCNT,@METM,@CAPDES,@DEL,@INDT,@ETC,@INEPNM)
    `);

		return jsonOk({ success: true, data: { SEQ: nextSeq } });
	} catch (err) {
		console.error('F30110 추가 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** PUT /api/f30110 — 수정 */
export async function PUT(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const seq = pick(body, 'SEQ');
		const menm = String(pick(body, 'MENM', '') ?? '').trim();
		const rsdt = toNullableDate(pick(body, 'RSDT'));

		if (pnum == null || seq == null || String(pnum).trim() === '' || String(seq).trim() === '') {
			return jsonError({ success: false, error: 'PNUM, SEQ는 필수입니다' }, 400);
		}
		if (!menm) {
			return jsonError({ success: false, error: '복용약물명(MENM)은 필수입니다' }, 400);
		}
		if (!rsdt) {
			return jsonError({ success: false, error: '조사일자(RSDT)는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('SEQ', sql.Int, Number(seq));
		request.input('RSDT', sql.Date, rsdt);
		request.input('MENM', sql.VarChar(100), menm.slice(0, 100));
		request.input('SDT', sql.Date, toNullableDate(pick(body, 'SDT')));
		request.input('EDT', sql.Date, toNullableDate(pick(body, 'EDT')));
		request.input('INQNT', sql.VarChar(20), String(pick(body, 'INQNT', '') ?? '').slice(0, 20) || null);
		request.input('INCNT', sql.VarChar(40), String(pick(body, 'INCNT', '') ?? '').slice(0, 40) || null);
		request.input('METM', sql.VarChar(40), String(pick(body, 'METM', '') ?? '').slice(0, 40) || null);
		request.input('CAPDES', sql.VarChar(100), String(pick(body, 'CAPDES', '') ?? '').slice(0, 100) || null);
		request.input('ETC', sql.VarChar(100), pick(body, 'ETC', null));
		request.input('INEPNM', sql.VarChar(100), pick(body, 'INEPNM', pick(body, 'INEMPNM', null)));

		const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET [RSDT] = @RSDT,
          [MENM] = @MENM,
          [SDT] = @SDT,
          [EDT] = @EDT,
          [INQNT] = @INQNT,
          [INCNT] = @INCNT,
          [METM] = @METM,
          [CAPDES] = @CAPDES,
          [ETC] = @ETC,
          [INEPNM] = COALESCE(@INEPNM, [INEPNM])
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND [SEQ] = @SEQ
        AND ISNULL([DEL], '') <> 'D'
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '수정할 행을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F30110 수정 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/** DELETE /api/f30110?pnum=&seq= — 논리삭제 */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const seq = sp.get('seq');
		if (!pnum || seq == null || String(seq).trim() === '') {
			return jsonError({ success: false, error: 'pnum, seq가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('SEQ', sql.Int, Number(seq));
		request.input('DEL', sql.Char(1), 'D');

		const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET [DEL] = @DEL
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND [SEQ] = @SEQ
        AND ISNULL([DEL], '') <> 'D'
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;
		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F30110 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

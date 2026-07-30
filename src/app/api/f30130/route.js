import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F30130]';

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

function toNullableInt(v) {
	if (v == null || v === '') return null;
	const n = parseInt(String(v), 10);
	return Number.isFinite(n) ? n : null;
}

function toNullableDecimal(v) {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function mapRow(r) {
	if (!r) return null;
	return {
		ANCD: r.ANCD,
		PNUM: r.PNUM,
		AUDDT: toYmd(r.AUDDT),
		XAU: r.XAU != null ? String(r.XAU).trim() : '',
		CHOL: r.CHOL,
		TG: r.TG,
		HDL: r.HDL,
		HBAIC: r.HBAIC,
		SGOT: r.SGOT,
		SGPT: r.SGPT,
		CRA: r.CRA,
		VDRL: r.VDRL,
		HB: r.HB,
		AUDDES: r.AUDDES != null ? String(r.AUDDES) : '',
		INDT: toYmd(r.INDT),
		ETC: r.ETC != null ? String(r.ETC) : '',
		INEMPNO: r.INEMPNO,
		INEMPNM: r.INEMPNM != null ? String(r.INEMPNM) : '',
	};
}

/**
 * GET /api/f30130?pnum=&auddt=&mode=dates
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const ancd = sp.get('ancd');
		const pnum = sp.get('pnum');
		const auddtRaw = sp.get('auddt');
		const mode = String(sp.get('mode') || '').trim();

		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		if (!pnum) {
			return jsonError({ success: false, error: 'pnum 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));

		if (mode === 'dates') {
			const result = await request.query(`
        SELECT DISTINCT CONVERT(varchar(10), [AUDDT], 120) AS AUDDT
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        ORDER BY AUDDT DESC
      `);
			const data = (result.recordset || []).map((r) => ({ AUDDT: toYmd(r.AUDDT) })).filter((r) => r.AUDDT);
			return jsonOk({ success: true, data, count: data.length });
		}

		const auddt = toYmd(auddtRaw);
		if (auddt) {
			request.input('AUDDT', sql.Date, auddt);
			const result = await request.query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CONVERT(date, [AUDDT]) = CONVERT(date, @AUDDT)
      `);
			return jsonOk({ success: true, data: mapRow(result.recordset?.[0] || null) });
		}

		const result = await request.query(`
      SELECT *
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
      ORDER BY [AUDDT] DESC, [INDT] DESC
    `);
		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F30130 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/**
 * POST /api/f30130 — MERGE upsert
 */
export async function POST(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const pnum = pick(body, 'PNUM');
		const auddt = toYmd(pick(body, 'AUDDT'));

		if (pnum == null || String(pnum).trim() === '' || !auddt) {
			return jsonError({ success: false, error: 'PNUM, AUDDT는 필수입니다' }, 400);
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(auddt)) {
			return jsonError({ success: false, error: 'AUDDT는 YYYY-MM-DD 형식이어야 합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const xauRaw = pick(body, 'XAU', null);
		const xau = xauRaw == null || xauRaw === '' ? null : String(xauRaw).trim().slice(0, 1);

		const now = new Date();
		const indt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('AUDDT', sql.Date, auddt);
		request.input('XAU', sql.Char(1), xau);
		request.input('CHOL', sql.Int, toNullableInt(pick(body, 'CHOL')));
		request.input('TG', sql.Int, toNullableInt(pick(body, 'TG')));
		request.input('HDL', sql.Int, toNullableInt(pick(body, 'HDL')));
		request.input('HBAIC', sql.Decimal(7, 1), toNullableDecimal(pick(body, 'HBAIC')));
		request.input('SGOT', sql.Int, toNullableInt(pick(body, 'SGOT')));
		request.input('SGPT', sql.Int, toNullableInt(pick(body, 'SGPT')));
		request.input('CRA', sql.Decimal(7, 1), toNullableDecimal(pick(body, 'CRA')));
		request.input('VDRL', sql.Decimal(7, 2), toNullableDecimal(pick(body, 'VDRL')));
		request.input('HB', sql.Int, toNullableInt(pick(body, 'HB')));
		request.input('AUDDES', sql.NVarChar(sql.MAX), pick(body, 'AUDDES', '') ?? '');
		request.input('INDT', sql.Date, indt);
		request.input('ETC', sql.VarChar(100), pick(body, 'ETC', null));
		request.input('INEMPNM', sql.VarChar(100), pick(body, 'INEMPNM', null));

		await request.query(`
      MERGE ${TABLE_NAME} AS T
      USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @AUDDT AS AUDDT) AS S
        ON (T.[ANCD] = S.[ANCD]
          AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR)
          AND CONVERT(date, T.[AUDDT]) = CONVERT(date, S.[AUDDT]))
      WHEN MATCHED THEN
        UPDATE SET
          [XAU] = @XAU,
          [CHOL] = @CHOL,
          [TG] = @TG,
          [HDL] = @HDL,
          [HBAIC] = @HBAIC,
          [SGOT] = @SGOT,
          [SGPT] = @SGPT,
          [CRA] = @CRA,
          [VDRL] = @VDRL,
          [HB] = @HB,
          [AUDDES] = @AUDDES,
          [ETC] = @ETC,
          [INEMPNM] = @INEMPNM
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD],[PNUM],[AUDDT],[XAU],[CHOL],[TG],[HDL],[HBAIC],
          [SGOT],[SGPT],[CRA],[VDRL],[HB],[AUDDES],[INDT],[ETC],[INEMPNM]
        )
        VALUES (
          @ANCD,@PNUM,@AUDDT,@XAU,@CHOL,@TG,@HDL,@HBAIC,
          @SGOT,@SGPT,@CRA,@VDRL,@HB,@AUDDES,@INDT,@ETC,@INEMPNM
        );
    `);

		return jsonOk({ success: true });
	} catch (err) {
		console.error('F30130 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/**
 * DELETE /api/f30130?pnum=&auddt=
 */
export async function DELETE(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const pnum = sp.get('pnum');
		const auddt = toYmd(sp.get('auddt'));
		if (!pnum || !auddt) {
			return jsonError({ success: false, error: 'pnum, auddt가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('PNUM', sql.Int, Number(pnum));
		request.input('AUDDT', sql.Date, auddt);

		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
        AND CONVERT(date, [AUDDT]) = CONVERT(date, @AUDDT)
    `);

		const affected = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((a, b) => a + b, 0)
			: 0;

		if (affected === 0) {
			return jsonError({ success: false, error: '삭제할 행을 찾지 못했습니다' }, 404);
		}
		return jsonOk({ success: true, affected });
	} catch (err) {
		console.error('F30130 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

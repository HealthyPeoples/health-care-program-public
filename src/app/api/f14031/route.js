/**
 * @file API /api/f14031 — 프로그램 일지 수급자 개별평가 F14031
 *
 * @description
 * F14031 CRUD. DSEQ는 F14030.DSEQ와 연결됩니다. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f14031/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const sql = require('mssql');

const TABLE = '[돌봄시설DB].[dbo].[F14031]';

function str(v) {
	if (v == null) return '';
	return String(v).trim();
}

function normalizeFlag(v) {
	const s = str(v);
	return s === '1' || s === '2' || s === '3' ? s : '';
}

function mapRow(r) {
	return {
		ANCD: r.ANCD != null ? Number(r.ANCD) : null,
		DSEQ: r.DSEQ != null ? Number(r.DSEQ) : null,
		PNUM: r.PNUM != null ? Number(r.PNUM) : null,
		P_GRD: str(r.P_GRD),
		JOIN_FLAG: str(r.JOIN_FLAG),
		PLAY_FLAG: str(r.PLAY_FLAG),
		HAPP_FLAG: str(r.HAPP_FLAG),
		RESP_DESC: str(r.RESP_DESC),
		MIMG: str(r.MIMG),
		INDT: r.INDT ?? null,
	};
}

/**
 * GET /api/f14031?dseq=
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const gate = assertAnCdMatchesSession(req, sp.get('ancd') || null);
		if (!gate.ok) return gate.response;

		const dseq = parseInt(String(sp.get('dseq') ?? ''), 10);
		if (!Number.isFinite(dseq)) {
			return jsonError({ success: false, error: 'dseq가 필요합니다.' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('DSEQ', sql.Int, dseq);
		const result = await request.query(`
      SELECT [ANCD], [DSEQ], [PNUM], [P_GRD], [JOIN_FLAG], [PLAY_FLAG], [HAPP_FLAG], [RESP_DESC], [MIMG], [INDT]
      FROM ${TABLE}
      WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ
      ORDER BY [PNUM] ASC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F14031 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

/**
 * POST { action: 'save'|'delete', DSEQ, PNUM, ... }
 */
export async function POST(req) {
	try {
		const gate = assertAnCdMatchesSession(req, null);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const action = body.action === 'delete' ? 'delete' : 'save';
		const dseq = parseInt(String(body.DSEQ ?? body.dseq ?? ''), 10);
		const pnum = parseInt(String(body.PNUM ?? body.pnum ?? ''), 10);
		if (!Number.isFinite(dseq) || !Number.isFinite(pnum)) {
			return jsonError({ success: false, error: 'DSEQ, PNUM이 필요합니다.' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });

		if (action === 'delete') {
			const del = await pool
				.request()
				.input('ANCD', sql.Int, Number(gate.sessionAncd))
				.input('DSEQ', sql.Int, dseq)
				.input('PNUM', sql.Int, pnum)
				.query(`DELETE FROM ${TABLE} WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ AND [PNUM] = @PNUM`);
			if (!del.rowsAffected?.[0]) {
				return jsonError({ success: false, error: '삭제할 평가가 없습니다.' }, 404);
			}
			return jsonOk({ success: true, action: 'delete' });
		}

		const joinFlag = normalizeFlag(body.JOIN_FLAG ?? body.join_flag);
		const playFlag = normalizeFlag(body.PLAY_FLAG ?? body.play_flag);
		const happFlag = normalizeFlag(body.HAPP_FLAG ?? body.happ_flag);
		if (!joinFlag || !playFlag || !happFlag) {
			return jsonError({ success: false, error: '참여도·수행도·만족도를 모두 선택해 주세요.' }, 400);
		}

		const pGrd = str(body.P_GRD ?? body.p_grd).slice(0, 2);
		const resp = str(body.RESP_DESC ?? body.resp_desc).slice(0, 200);
		const mimg = str(body.MIMG ?? body.mimg).slice(0, 200) || null;

		const exists = await pool
			.request()
			.input('ANCD', sql.Int, Number(gate.sessionAncd))
			.input('DSEQ', sql.Int, dseq)
			.input('PNUM', sql.Int, pnum)
			.query(`SELECT 1 AS ok FROM ${TABLE} WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ AND [PNUM] = @PNUM`);

		if (exists.recordset?.[0]) {
			await pool
				.request()
				.input('ANCD', sql.Int, Number(gate.sessionAncd))
				.input('DSEQ', sql.Int, dseq)
				.input('PNUM', sql.Int, pnum)
				.input('P_GRD', sql.Char(2), pGrd || null)
				.input('JOIN_FLAG', sql.Char(1), joinFlag)
				.input('PLAY_FLAG', sql.Char(1), playFlag)
				.input('HAPP_FLAG', sql.Char(1), happFlag)
				.input('RESP_DESC', sql.NVarChar(200), resp || null)
				.input('MIMG', sql.VarChar(200), mimg)
				.query(`
          UPDATE ${TABLE}
          SET [P_GRD] = @P_GRD,
              [JOIN_FLAG] = @JOIN_FLAG,
              [PLAY_FLAG] = @PLAY_FLAG,
              [HAPP_FLAG] = @HAPP_FLAG,
              [RESP_DESC] = @RESP_DESC,
              [MIMG] = @MIMG
          WHERE [ANCD] = @ANCD AND [DSEQ] = @DSEQ AND [PNUM] = @PNUM
        `);
		} else {
			await pool
				.request()
				.input('ANCD', sql.Int, Number(gate.sessionAncd))
				.input('DSEQ', sql.Int, dseq)
				.input('PNUM', sql.Int, pnum)
				.input('P_GRD', sql.Char(2), pGrd || null)
				.input('JOIN_FLAG', sql.Char(1), joinFlag)
				.input('PLAY_FLAG', sql.Char(1), playFlag)
				.input('HAPP_FLAG', sql.Char(1), happFlag)
				.input('RESP_DESC', sql.NVarChar(200), resp || null)
				.input('MIMG', sql.VarChar(200), mimg)
				.query(`
          INSERT INTO ${TABLE} (
            [ANCD], [DSEQ], [PNUM], [P_GRD], [JOIN_FLAG], [PLAY_FLAG], [HAPP_FLAG], [RESP_DESC], [MIMG], [INDT]
          ) VALUES (
            @ANCD, @DSEQ, @PNUM, @P_GRD, @JOIN_FLAG, @PLAY_FLAG, @HAPP_FLAG, @RESP_DESC, @MIMG, GETDATE()
          )
        `);
		}

		return jsonOk({ success: true, action: 'save' });
	} catch (err) {
		console.error('F14031 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

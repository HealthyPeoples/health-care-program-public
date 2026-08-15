/**
 * @file API /api/v14030ab — 프로그램일지 출력 뷰 V14030AB
 *
 * @description
 * 프로그램일지 출력용 V14030AB(및 개별평가 V14030C) 조회 Route Handler.
 * 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/v14030ab/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { jsonOk, jsonError } from '../../../utils/apiResponse';
const sql = require('mssql');

const { normalizeYmdStrict: normalizeYmd } = require('../../../utils/normalizeYmd');

const VIEW = '[돌봄시설DB].[dbo].[V14030AB]';
const EVAL_VIEW = '[돌봄시설DB].[dbo].[V14030C]';

function pickCol(r, ...keys) {
	for (const k of keys) {
		if (r && Object.prototype.hasOwnProperty.call(r, k) && r[k] != null && r[k] !== '') {
			return r[k];
		}
	}
	for (const k of keys) {
		if (r && Object.prototype.hasOwnProperty.call(r, k)) return r[k];
	}
	return null;
}

function str(v) {
	if (v == null) return '';
	return String(v).trim();
}

function toYmd(v) {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return '';
}

function mapLogRow(r) {
	return {
		ANCD: r.ANCD != null ? Number(r.ANCD) : null,
		DSEQ: r.DSEQ != null ? Number(r.DSEQ) : null,
		SVDT: toYmd(r.SVDT),
		weekday: str(pickCol(r, '요일')),
		institutionName: str(pickCol(r, '기관명')),
		startTime: str(pickCol(r, '시작시간')),
		endTime: str(pickCol(r, '종료시간')),
		serviceGu: str(pickCol(r, '서비스구분')),
		programTitle: str(pickCol(r, '서비스제목')),
		serviceContent: str(pickCol(r, '서비스내용')),
		attendees: str(pickCol(r, '참석자')),
		facilitator: str(pickCol(r, '진행자')),
		assistant: str(pickCol(r, '보조진행자')),
		goal: str(pickCol(r, '프로그램목표')),
		materials: str(pickCol(r, '준비물')),
		programContent: str(pickCol(r, '프로그램내용')),
		comment: str(pickCol(r, 'COMMENT')),
		place: str(pickCol(r, '프로그램장소')),
		MIMG: str(r.MIMG),
		PG_GU: str(r.PG_GU),
		programGu: str(pickCol(r, '프로그램구분')),
	};
}

function mapEvalRow(r) {
	return {
		ANCD: r.ANCD != null ? Number(r.ANCD) : null,
		DSEQ: r.DSEQ != null ? Number(r.DSEQ) : null,
		SVDT: toYmd(r.SVDT),
		SVDIC: str(r.SVDIC),
		PNUM: r.PNUM != null ? Number(r.PNUM) : null,
		name: str(pickCol(r, 'P_NM')),
		grade: str(pickCol(r, '요양등급')),
		joinFlag: str(r.JOIN_FLAG),
		joinLevel: str(pickCol(r, '참여정도')),
		playFlag: str(r.PLAY_FLAG),
		playLevel: str(pickCol(r, '수행정도')),
		happFlag: str(r.HAPP_FLAG),
		happLevel: str(pickCol(r, '만족정도')),
		remark: str(pickCol(r, 'RESP_DESC')),
	};
}

function inputDate(request, name, ymd) {
	const n = normalizeYmd(ymd);
	if (n === null) {
		request.input(name, sql.Date, null);
		return;
	}
	const y = parseInt(n.slice(0, 4), 10);
	const m = parseInt(n.slice(5, 7), 10);
	const d = parseInt(n.slice(8, 10), 10);
	request.input(name, sql.Date, new Date(Date.UTC(y, m - 1, d)));
}

/**
 * 프로그램일지 출력 뷰
 * GET /api/v14030ab?dseq=
 * GET /api/v14030ab?startDate=yyyy-mm-dd&endDate=yyyy-mm-dd
 * includeEvals=1 이면 V14030C 개별평가를 함께 반환
 */
export async function GET(req) {
	try {
		const sp = req.nextUrl.searchParams;
		const ancd = sp.get('ancd');
		const gate = assertAnCdMatchesSession(req, ancd || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const dseqRaw = sp.get('dseq');
		const dseq = dseqRaw != null && String(dseqRaw).trim() !== '' ? parseInt(String(dseqRaw), 10) : NaN;
		const startDate = normalizeYmd(sp.get('startDate'));
		const endDate = normalizeYmd(sp.get('endDate'));
		const includeEvals = String(sp.get('includeEvals') || '').trim() === '1';

		const request = pool.request();
		request.input('sessionAncd', gate.sessionAncd);

		let result;
		if (Number.isFinite(dseq)) {
			request.input('dseq', sql.Int, dseq);
			result = await request.query(`
        SELECT *
        FROM ${VIEW}
        WHERE [ANCD] = @sessionAncd
          AND [DSEQ] = @dseq
      `);
		} else {
			if (!startDate || !endDate) {
				return jsonError({ success: false, error: 'dseq 또는 startDate, endDate(yyyy-mm-dd)가 필요합니다.' }, 400);
			}
			if (startDate > endDate) {
				return jsonError({ success: false, error: '시작일이 종료일보다 클 수 없습니다.' }, 400);
			}
			inputDate(request, 'startDate', startDate);
			inputDate(request, 'endDate', endDate);
			result = await request.query(`
        SELECT *
        FROM ${VIEW}
        WHERE [ANCD] = @sessionAncd
          AND [SVDT] IS NOT NULL
          AND [SVDT] >= CAST(@startDate AS DATE)
          AND [SVDT] <= CAST(@endDate AS DATE)
        ORDER BY [SVDT] ASC, [시작시간] ASC, [DSEQ] ASC
      `);
		}

		const data = (result.recordset || []).map(mapLogRow);

		if (!includeEvals) {
			return jsonOk({ success: true, data, count: data.length });
		}

		const evalReq = pool.request();
		evalReq.input('sessionAncd', gate.sessionAncd);
		let evalResult;
		if (Number.isFinite(dseq)) {
			evalReq.input('dseq', sql.Int, dseq);
			evalResult = await evalReq.query(`
        SELECT *
        FROM ${EVAL_VIEW}
        WHERE [ANCD] = @sessionAncd
          AND [DSEQ] = @dseq
        ORDER BY [P_NM] ASC, [PNUM] ASC
      `);
		} else {
			inputDate(evalReq, 'startDate', startDate);
			inputDate(evalReq, 'endDate', endDate);
			evalResult = await evalReq.query(`
        SELECT *
        FROM ${EVAL_VIEW}
        WHERE [ANCD] = @sessionAncd
          AND [SVDT] IS NOT NULL
          AND [SVDT] >= CAST(@startDate AS DATE)
          AND [SVDT] <= CAST(@endDate AS DATE)
        ORDER BY [DSEQ] ASC, [P_NM] ASC, [PNUM] ASC
      `);
		}

		const evals = (evalResult.recordset || []).map(mapEvalRow);
		return jsonOk({
			success: true,
			data,
			count: data.length,
			evals,
			evalCount: evals.length,
		});
	} catch (err) {
		console.error('V14030AB GET 오류:', err);
		return jsonError({ success: false, error: err.message, details: String(err) });
	}
}

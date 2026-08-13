/**
 * @file API /api/f60020 — 사례관리 F60020
 *
 * @description
 * 사례관리 F60020 Next.js Route Handler. PK는 ANCD + MDT.
 * MDES/MODES/MRES가 ntext라 MERGE를 쓰지 않고 EXISTS 후 UPDATE/INSERT 합니다.
 *
 * @module app/api/f60020/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { normalizeYmdEmpty as normalizeYmd } from '../../../utils/normalizeYmd';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const TABLE_NAME = '[돌봄시설DB].[dbo].[F60020]';

const EDITABLE_KEYS = [
	'STM',
	'ETM',
	'MPL',
	'MPNM',
	'MPGRD',
	'MPAGE',
	'MDOC',
	'MDES',
	'MNM',
	'MIMG',
	'MODT',
	'MODES',
	'MONY',
	'ETC',
	'INEMPNO',
	'INEMPNM',
	'MRES',
];

function toYmd(v) {
	const n = normalizeYmd(v);
	return n ? String(n).slice(0, 10) : '';
}

function toHm(v) {
	if (v == null || v === '') return null;
	const s = String(v).trim();
	const m = s.match(/^(\d{1,2}):(\d{2})/);
	if (!m) return s.slice(0, 5) || null;
	return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function toInt(v) {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? Math.trunc(n) : null;
}

function hasOwn(body, key) {
	return Object.prototype.hasOwnProperty.call(body || {}, key);
}

function pickRaw(body, key) {
	return hasOwn(body, key) ? body[key] : null;
}

function bindField(request, key, value) {
	switch (key) {
		case 'STM':
		case 'ETM':
			request.input(key, sql.VarChar(5), toHm(value));
			return;
		case 'MPL':
		case 'MPNM':
			request.input(key, sql.NVarChar(100), value == null || value === '' ? null : String(value).slice(0, 100));
			return;
		case 'MPGRD':
			request.input(key, sql.NVarChar(10), value == null || value === '' ? null : String(value).slice(0, 10));
			return;
		case 'MPAGE':
			request.input(key, sql.VarChar(3), value == null || value === '' ? null : String(value).replace(/[^\d]/g, '').slice(0, 3) || null);
			return;
		case 'MDOC':
		case 'MNM':
			request.input(key, sql.NVarChar(500), value == null || value === '' ? null : String(value).slice(0, 500));
			return;
		case 'MDES':
		case 'MODES':
		case 'MRES':
			request.input(key, sql.NVarChar(sql.MAX), value == null || value === '' ? null : String(value));
			return;
		case 'MIMG':
			request.input(key, sql.VarChar(100), value == null || value === '' ? null : String(value).slice(0, 100));
			return;
		case 'MODT': {
			const ymd = toYmd(value);
			request.input(key, sql.VarChar(10), ymd || null);
			return;
		}
		case 'MONY': {
			const yn = String(value ?? '').trim() === '1' || value === 1 || value === true ? '1' : '0';
			request.input(key, sql.Char(1), yn);
			return;
		}
		case 'ETC':
			request.input(key, sql.NVarChar(100), value == null || value === '' ? null : String(value).slice(0, 100));
			return;
		case 'INEMPNO':
			request.input(key, sql.Int, toInt(value));
			return;
		case 'INEMPNM':
			request.input(key, sql.NVarChar(50), value == null || value === '' ? null : String(value).slice(0, 50));
			return;
		default:
			request.input(key, value == null || value === '' ? null : String(value));
	}
}

function mapRow(r) {
	return {
		...r,
		MDT: toYmd(r.MDT),
		MODT: toYmd(r.MODT),
		URDT: toYmd(r.URDT),
		STM: r.STM != null ? String(r.STM).trim() : '',
		ETM: r.ETM != null ? String(r.ETM).trim() : '',
		MDES: r.MDES != null ? String(r.MDES) : '',
		MODES: r.MODES != null ? String(r.MODES) : '',
		MRES: r.MRES != null ? String(r.MRES) : '',
		MONY: String(r.MONY ?? '').trim() === '1' ? '1' : '0',
	};
}

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');

		const gate = assertAnCdMatchesSession(req, ancd);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const ancdNum = toInt(ancd ?? gate.sessionAncd);
		if (ancdNum == null) {
			return jsonError({ success: false, error: 'ANCD가 올바르지 않습니다' }, 400);
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, ancdNum);

		let where = 'WHERE [ANCD] = @ANCD';
		const startYmd = toYmd(startDate);
		const endYmd = toYmd(endDate);
		if (startYmd) {
			request.input('START', sql.VarChar(10), startYmd);
			where += ' AND CONVERT(date, [MDT]) >= CONVERT(date, @START)';
		}
		if (endYmd) {
			request.input('END', sql.VarChar(10), endYmd);
			where += ' AND CONVERT(date, [MDT]) <= CONVERT(date, @END)';
		}

		const result = await request.query(`
      SELECT
        [ANCD], [MDT], [STM], [ETM], [MPL], [MPNM], [MPGRD], [MPAGE],
        [MDOC], [MDES], [MNM], [MIMG], [MODT], [MODES], [MONY], [ETC], [URDT],
        [INEMPNO], [INEMPNM], [MRES]
      FROM ${TABLE_NAME}
      ${where}
      ORDER BY [MDT] DESC, [URDT] DESC
    `);

		const data = (result.recordset || []).map(mapRow);
		return jsonOk({ success: true, data, count: data.length });
	} catch (err) {
		console.error('F60020 테이블 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function POST(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancdParam = searchParams.get('ancd');

		const gate = assertAnCdMatchesSession(req, ancdParam);
		if (!gate.ok) return gate.response;

		const body = await req.json().catch(() => ({}));
		const ancdNum = toInt(body?.ANCD ?? ancdParam ?? gate.sessionAncd);
		const mdt = toYmd(body?.MDT);
		const origMdt = toYmd(body?.origMDT ?? body?.ORIG_MDT ?? body?.MDT) || mdt;

		if (ancdNum == null || !mdt) {
			return jsonError({ success: false, error: 'ANCD, MDT는 필수입니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const existsReq = pool.request();
		existsReq.input('ANCD', sql.Int, ancdNum);
		existsReq.input('ORIG_MDT', sql.VarChar(10), origMdt);
		const exists = await existsReq.query(`
      SELECT TOP 1 1 AS ok
      FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD AND CONVERT(date, [MDT]) = CONVERT(date, @ORIG_MDT)
    `);
		const isUpdate = (exists.recordset || []).length > 0;

		const request = pool.request();
		request.input('ANCD', sql.Int, ancdNum);
		request.input('MDT', sql.VarChar(10), mdt);
		request.input('ORIG_MDT', sql.VarChar(10), origMdt);

		if (isUpdate) {
			const setKeys = EDITABLE_KEYS.filter((k) => hasOwn(body, k));
			setKeys.forEach((k) => bindField(request, k, pickRaw(body, k)));
			const setSql = ['[MDT] = CONVERT(datetime, @MDT)', '[URDT] = CONVERT(date, GETDATE())']
				.concat(setKeys.map((k) => `[${k}] = @${k}`))
				.join(',\n          ');
			await request.query(`
        UPDATE ${TABLE_NAME}
        SET
          ${setSql}
        WHERE [ANCD] = @ANCD
          AND CONVERT(date, [MDT]) = CONVERT(date, @ORIG_MDT)
      `);
		} else {
			EDITABLE_KEYS.forEach((k) => bindField(request, k, pickRaw(body, k)));
			const insertCols = EDITABLE_KEYS.map((k) => `[${k}]`).concat(['[URDT]']).join(',');
			const insertVals = EDITABLE_KEYS.map((k) => `@${k}`).concat(['CONVERT(date, GETDATE())']).join(',');
			await request.query(`
        INSERT INTO ${TABLE_NAME} ([ANCD],[MDT],${insertCols})
        VALUES (@ANCD, CONVERT(datetime, @MDT), ${insertVals})
      `);
		}

		return jsonOk({ success: true, MDT: mdt });
	} catch (err) {
		console.error('F60020 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancd = searchParams.get('ancd');
		const mdt = toYmd(searchParams.get('mdt'));

		const gate = assertAnCdMatchesSession(req, ancd);
		if (!gate.ok) return gate.response;

		const ancdNum = toInt(ancd);
		if (ancdNum == null || !mdt) {
			return jsonError({ success: false, error: 'ancd, mdt 파라미터가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) {
			return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, ancdNum);
		request.input('MDT', sql.VarChar(10), mdt);
		const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE [ANCD] = @ANCD
        AND CONVERT(date, [MDT]) = CONVERT(date, @MDT)
    `);

		return jsonOk({ success: true, affected: result?.rowsAffected?.[0] ?? 0 });
	} catch (err) {
		console.error('F60020 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

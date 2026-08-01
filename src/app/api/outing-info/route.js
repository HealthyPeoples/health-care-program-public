/**
 * @file API /api/outing-info — 외출·외박대장 OUTING_INFO
 *
 * @description
 * 외출·외박대장 OUTING_INFO Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/outing-info/route
 */
import { connPool, sql } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';
import { jsonOk, jsonError } from '../../../utils/apiResponse';

const {
	OUTING_TABLE,
	ensureOutingInfoTable,
	toYmd,
	padTime5,
	buildIoTmInfo,
	buildReturnIoTmInfo,
	syncF14020FromOutingRow,
	clearF14020ForOutingRow
} = require('../../../lib/outingF14020Sync');

function validateBody(body) {
	const gyn = String(body.gyn ?? body.GYN ?? '').trim();
	if (gyn !== '0' && gyn !== '2') {
		return { ok: false, error: '구분(GYN)은 외출(0) 또는 외박(2)만 가능합니다' };
	}
	const pnum = Number(body.pnum ?? body.PNUM);
	if (!Number.isFinite(pnum)) {
		return { ok: false, error: '수급자(PNUM)가 필요합니다' };
	}
	const startDt = toYmd(body.startDate ?? body.START_DT);
	const startTm = padTime5(body.startTime ?? body.START_TM);
	if (!startDt || !startTm) {
		return { ok: false, error: '시작일/시작시간이 필요합니다' };
	}
	const endDt = toYmd(body.endDate ?? body.END_DT);
	const endTm = padTime5(body.endTime ?? body.END_TM);

	if (gyn === '0') {
		const day = endDt || startDt;
		if (endDt && endDt !== startDt) {
			return { ok: false, error: '외출은 시작일과 종료일이 같아야 합니다' };
		}
		if (!endTm) {
			return { ok: false, error: '외출은 종료시간이 필요합니다' };
		}
		return {
			ok: true,
			row: {
				PNUM: pnum,
				GYN: '0',
				START_DT: startDt,
				START_TM: startTm,
				END_DT: day,
				END_TM: endTm,
				DEST: String(body.destination ?? body.DEST ?? '').trim(),
				PURPOSE: String(body.purpose ?? body.PURPOSE ?? '').trim(),
				GUARDIAN: String(body.guardian ?? body.GUARDIAN ?? '').trim(),
				RELATION: String(body.relationship ?? body.RELATION ?? '').trim(),
				CONTACT: String(body.contact ?? body.CONTACT ?? '').trim()
			}
		};
	}

	if (endDt && !endTm) {
		return { ok: false, error: '외박 종료일을 입력하면 종료시간도 필요합니다' };
	}
	if (endTm && !endDt) {
		return { ok: false, error: '외박 종료시간을 입력하면 종료일도 필요합니다' };
	}
	if (endDt && endDt < startDt) {
		return { ok: false, error: '외박 종료일은 시작일 이후여야 합니다' };
	}

	return {
		ok: true,
		row: {
			PNUM: pnum,
			GYN: '2',
			START_DT: startDt,
			START_TM: startTm,
			END_DT: endDt || null,
			END_TM: endTm || null,
			DEST: String(body.destination ?? body.DEST ?? '').trim(),
			PURPOSE: String(body.purpose ?? body.PURPOSE ?? '').trim(),
			GUARDIAN: String(body.guardian ?? body.GUARDIAN ?? '').trim(),
			RELATION: String(body.relationship ?? body.RELATION ?? '').trim(),
			CONTACT: String(body.contact ?? body.CONTACT ?? '').trim()
		}
	};
}

export async function GET(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancdParam = searchParams.get('ancd');
		const year = searchParams.get('year');
		const month = searchParams.get('month');
		const yyyymm = searchParams.get('yyyymm');
		const svdtRaw = searchParams.get('svdt') || searchParams.get('date');

		const gate = assertAnCdMatchesSession(req, ancdParam || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureOutingInfoTable(pool);

		let start = '';
		let end = '';
		let dayMode = false;
		let y = Number(year);
		let m = Number(month);

		const svdt = toYmd(svdtRaw);
		if (svdt) {
			dayMode = true;
			start = svdt;
			end = svdt;
			y = Number(svdt.slice(0, 4));
			m = Number(svdt.slice(5, 7));
		} else {
			if (yyyymm) {
				const digits = String(yyyymm).replace(/\D/g, '');
				if (digits.length === 6) {
					y = Number(digits.slice(0, 4));
					m = Number(digits.slice(4, 6));
				}
			}
			if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
				return jsonError({ success: false, error: 'svdt(일자) 또는 year/month가 필요합니다' }, 400);
			}
			start = `${y}-${String(m).padStart(2, '0')}-01`;
			const lastDay = new Date(y, m, 0).getDate();
			end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
		}

		const request = pool.request();
		request.input('ANCD', sql.Int, Number(gate.sessionAncd));
		request.input('FR', sql.Date, start);
		request.input('TO', sql.Date, end);

		const result = await request.query(`
      SELECT
        o.*,
        f10010.[P_NM],
        f10010.[P_BRDT],
        ROW_NUMBER() OVER (ORDER BY o.[START_DT] ASC, o.[START_TM] ASC, o.[OP_SEQ] ASC) AS MENUM
      FROM ${OUTING_TABLE} o
      LEFT JOIN [돌봄시설DB].[dbo].[F10010] f10010
        ON o.[ANCD] = f10010.[ANCD]
       AND o.[PNUM] = f10010.[PNUM]
      WHERE o.[ANCD] = @ANCD
        AND (
          (o.[START_DT] >= @FR AND o.[START_DT] <= @TO)
          OR (o.[END_DT] IS NOT NULL AND o.[END_DT] >= @FR AND o.[END_DT] <= @TO)
          OR (o.[START_DT] < @FR AND (o.[END_DT] IS NULL OR o.[END_DT] >= @FR))
        )
      ORDER BY o.[START_DT] ASC, o.[START_TM] ASC, o.[OP_SEQ] ASC
    `);

		return jsonOk({
			success: true,
			data: result.recordset || [],
			count: (result.recordset || []).length,
			year: y,
			month: m,
			svdt: dayMode ? start : null
		});
	} catch (err) {
		console.error('OUTING_INFO 조회 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function POST(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancdParam = searchParams.get('ancd');
		const gate = assertAnCdMatchesSession(req, ancdParam || null);
		if (!gate.ok) return gate.response;

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureOutingInfoTable(pool);

		const body = await req.json().catch(() => ({}));
		const validated = validateBody(body);
		if (!validated.ok) return jsonError({ success: false, error: validated.error }, 400);

		const ancd = Number(gate.sessionAncd);
		const row = validated.row;
		const opSeq = body.opSeq ?? body.OP_SEQ ?? null;
		const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

		let savedSeq = opSeq ? Number(opSeq) : null;
		let prevRow = null;

		if (savedSeq && Number.isFinite(savedSeq)) {
			const prevReq = pool.request();
			prevReq.input('OP_SEQ', sql.Int, savedSeq);
			prevReq.input('ANCD', sql.Int, ancd);
			const prevRes = await prevReq.query(`
        SELECT * FROM ${OUTING_TABLE} WHERE [OP_SEQ]=@OP_SEQ AND [ANCD]=@ANCD
      `);
			prevRow = prevRes.recordset?.[0] || null;

			const up = pool.request();
			up.input('OP_SEQ', sql.Int, savedSeq);
			up.input('ANCD', sql.Int, ancd);
			up.input('PNUM', sql.Int, row.PNUM);
			up.input('GYN', sql.Char(1), row.GYN);
			up.input('START_DT', sql.Date, row.START_DT);
			up.input('START_TM', sql.VarChar(5), row.START_TM);
			up.input('END_DT', sql.Date, row.END_DT);
			up.input('END_TM', sql.VarChar(5), row.END_TM);
			up.input('DEST', sql.NVarChar(200), row.DEST || null);
			up.input('PURPOSE', sql.NVarChar(200), row.PURPOSE || null);
			up.input('GUARDIAN', sql.NVarChar(100), row.GUARDIAN || null);
			up.input('RELATION', sql.NVarChar(50), row.RELATION || null);
			up.input('CONTACT', sql.NVarChar(50), row.CONTACT || null);
			up.input('MOD_DATE', sql.NVarChar(30), nowStr);

			const upd = await up.query(`
        UPDATE ${OUTING_TABLE}
        SET [PNUM]=@PNUM, [GYN]=@GYN, [START_DT]=@START_DT, [START_TM]=@START_TM,
            [END_DT]=@END_DT, [END_TM]=@END_TM, [DEST]=@DEST, [PURPOSE]=@PURPOSE,
            [GUARDIAN]=@GUARDIAN, [RELATION]=@RELATION, [CONTACT]=@CONTACT, [MOD_DATE]=@MOD_DATE
        WHERE [OP_SEQ]=@OP_SEQ AND [ANCD]=@ANCD
      `);
			if (!upd.rowsAffected?.[0]) {
				return jsonError({ success: false, error: '수정할 외출/외박 자료를 찾을 수 없습니다' }, 404);
			}
		} else {
			const ins = pool.request();
			ins.input('ANCD', sql.Int, ancd);
			ins.input('PNUM', sql.Int, row.PNUM);
			ins.input('GYN', sql.Char(1), row.GYN);
			ins.input('START_DT', sql.Date, row.START_DT);
			ins.input('START_TM', sql.VarChar(5), row.START_TM);
			ins.input('END_DT', sql.Date, row.END_DT);
			ins.input('END_TM', sql.VarChar(5), row.END_TM);
			ins.input('DEST', sql.NVarChar(200), row.DEST || null);
			ins.input('PURPOSE', sql.NVarChar(200), row.PURPOSE || null);
			ins.input('GUARDIAN', sql.NVarChar(100), row.GUARDIAN || null);
			ins.input('RELATION', sql.NVarChar(50), row.RELATION || null);
			ins.input('CONTACT', sql.NVarChar(50), row.CONTACT || null);
			ins.input('REG_DATE', sql.NVarChar(30), nowStr);

			const inserted = await ins.query(`
        INSERT INTO ${OUTING_TABLE}
          ([ANCD],[PNUM],[GYN],[START_DT],[START_TM],[END_DT],[END_TM],[DEST],[PURPOSE],[GUARDIAN],[RELATION],[CONTACT],[REG_DATE])
        OUTPUT INSERTED.[OP_SEQ]
        VALUES
          (@ANCD,@PNUM,@GYN,@START_DT,@START_TM,@END_DT,@END_TM,@DEST,@PURPOSE,@GUARDIAN,@RELATION,@CONTACT,@REG_DATE)
      `);
			savedSeq = inserted.recordset?.[0]?.OP_SEQ ?? null;
		}

		await syncF14020FromOutingRow(pool, ancd, row, prevRow);

		return jsonOk({
			success: true,
			opSeq: savedSeq,
			synced: {
				gyn: row.GYN,
				startIoTmInfo: buildIoTmInfo(row.GYN, row.START_TM, row.END_TM),
				returnIoTmInfo: row.GYN === '2' && row.END_TM ? buildReturnIoTmInfo(row.END_TM) : null
			}
		});
	} catch (err) {
		console.error('OUTING_INFO 저장 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

export async function DELETE(req) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const ancdParam = searchParams.get('ancd');
		const opSeq = searchParams.get('opSeq');

		const gate = assertAnCdMatchesSession(req, ancdParam || null);
		if (!gate.ok) return gate.response;

		if (!opSeq) {
			return jsonError({ success: false, error: 'opSeq가 필요합니다' }, 400);
		}

		const pool = await connPool;
		if (!pool) return jsonError({ success: false, error: '데이터베이스 연결 실패' });
		await ensureOutingInfoTable(pool);

		const ancd = Number(gate.sessionAncd);
		const request = pool.request();
		request.input('ANCD', sql.Int, ancd);
		request.input('OP_SEQ', sql.Int, Number(opSeq));

		const prevRes = await request.query(`
      SELECT * FROM ${OUTING_TABLE} WHERE [ANCD]=@ANCD AND [OP_SEQ]=@OP_SEQ
    `);
		const prevRow = prevRes.recordset?.[0] || null;

		await pool
			.request()
			.input('ANCD', sql.Int, ancd)
			.input('OP_SEQ', sql.Int, Number(opSeq))
			.query(`
      DELETE FROM ${OUTING_TABLE}
      WHERE [ANCD] = @ANCD AND [OP_SEQ] = @OP_SEQ
    `);

		if (prevRow) {
			await clearF14020ForOutingRow(pool, ancd, prevRow);
		}

		return jsonOk({ success: true });
	} catch (err) {
		console.error('OUTING_INFO 삭제 오류:', err);
		return jsonError({ success: false, error: err.message, details: err.toString() });
	}
}

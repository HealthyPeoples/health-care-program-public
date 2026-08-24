/**
 * @file API /api/f14040 — 프로그램 관련 F14040
 *
 * @description
 * 프로그램 관련 F14040 Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.
 *
 * @module app/api/f14040/route
 */
import { connPool } from '../../../config/server';
import { assertAnCdMatchesSession } from '../../../config/sessionServer';

import { normalizeYmdStrict as normalizeYmd } from '../../../utils/normalizeYmd';
import { jsonOk, jsonError } from '../../../utils/apiResponse';
const TABLE = '[돌봄시설DB].[dbo].[F14040]';
const FACILITY_TABLE = '[돌봄시설DB].[dbo].[F00110]';

function isCopyFlagOn(v) {
	const s = String(v ?? '').trim().toUpperCase();
	return s === '1' || s === 'Y';
}

function isActivePlanDel(v) {
	const s = String(v ?? '').trim().toUpperCase();
	return s !== 'D' && s !== '9';
}

/** 센터의 복사 원본(관리자) 기관 — F00110.CPY_CNTR_FLAG / CPY_CNTR_ANCD */
async function getCopyInfo(pool, sessionAncd) {
	const empty = {
		canCopy: false,
		canCreate: true,
		sourceAncd: null,
		sourceAnnm: '',
	};
	try {
		const r = await pool
			.request()
			.input('ANCD', sessionAncd)
			.query(`
				SELECT TOP 1 [CPY_CNTR_FLAG], [CPY_CNTR_ANCD], [ANNM]
				FROM ${FACILITY_TABLE}
				WHERE [ANCD] = @ANCD
			`);
		const row = r.recordset?.[0];
		if (!row) return empty;
		const sourceAncdRaw = row.CPY_CNTR_ANCD != null && row.CPY_CNTR_ANCD !== ''
			? Number(row.CPY_CNTR_ANCD)
			: NaN;
		const sessionN = Number(sessionAncd);
		const canCopy =
			isCopyFlagOn(row.CPY_CNTR_FLAG) &&
			Number.isFinite(sourceAncdRaw) &&
			sourceAncdRaw > 0 &&
			(!Number.isFinite(sessionN) || sourceAncdRaw !== sessionN);
		let sourceAnnm = '';
		if (canCopy) {
			const n = await pool
				.request()
				.input('SRC', sourceAncdRaw)
				.query(`SELECT TOP 1 [ANNM] FROM ${FACILITY_TABLE} WHERE [ANCD] = @SRC`);
			sourceAnnm = n.recordset?.[0]?.ANNM != null ? String(n.recordset[0].ANNM).trim() : '';
		}
		return {
			canCopy,
			canCreate: !canCopy,
			sourceAncd: canCopy ? sourceAncdRaw : null,
			sourceAnnm,
		};
	} catch (e) {
		console.warn('F14040 복사 원본 기관 조회 경고:', e?.message || e);
		return empty;
	}
}

const SOURCE_SELECT = `
	[ANCD], [PGSEQ], [PGNM], [PGOJ], [PGJB], [PGDES], [PG_GU], [DEL],
	[SCH_FDATE], [SCH_TDATE], [ACT_CYCLE], [ACT_NUM],
	[PGMAN1], [PGMAN2], [PGADD], [PGMAN0]
`;

// F14040 치료프로그램 목록 (로그인 기관 ANCD만)
// GET /api/f14040?ancd= (ancd는 선택, 세션과 일치 검증용)
// GET /api/f14040?copySource=1 — 센터가 끌어올 관리자 프로그램 목록
export async function GET(req) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ancd = searchParams.get('ancd');
    const copySource = ['1', 'true', 'yes'].includes(
      String(searchParams.get('copySource') || '').trim().toLowerCase()
    );

    const gate = assertAnCdMatchesSession(req, ancd || null);
    if (!gate.ok) return gate.response;

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    const copyInfo = await getCopyInfo(pool, gate.sessionAncd);

    if (copySource) {
      if (!copyInfo.canCopy || copyInfo.sourceAncd == null) {
        return jsonError({
          success: false,
          error: '복사할 관리자(원본) 기관이 설정되어 있지 않습니다.',
          copyInfo,
        }, 400);
      }

      const srcReq = pool.request();
      srcReq.input('SRC', copyInfo.sourceAncd);
      const srcResult = await srcReq.query(`
        SELECT ${SOURCE_SELECT}
        FROM ${TABLE}
        WHERE [ANCD] = @SRC
        ORDER BY [PGSEQ] ASC, [PGNM] ASC
      `);
      const sourceRows = (srcResult.recordset || []).filter((row) => isActivePlanDel(row.DEL));

      const copiedReq = pool.request();
      copiedReq.input('ANCD', gate.sessionAncd);
      copiedReq.input('SRC', copyInfo.sourceAncd);
      const copiedResult = await copiedReq.query(`
        SELECT [CYP_CNTR_PGSEQ]
        FROM ${TABLE}
        WHERE [ANCD] = @ANCD
          AND [CYP_CNTR_ANCD] = @SRC
          AND [CYP_CNTR_PGSEQ] IS NOT NULL
      `);
      const alreadyCopied = new Set(
        (copiedResult.recordset || [])
          .map((r) => Number(r.CYP_CNTR_PGSEQ))
          .filter((n) => Number.isFinite(n))
      );

      const data = sourceRows.map((row) => ({
        ...row,
        alreadyCopied: alreadyCopied.has(Number(row.PGSEQ)),
      }));

      return jsonOk({
        success: true,
        data,
        count: data.length,
        copyInfo,
      });
    }

    const request = pool.request();
    request.input('sessionAncd', gate.sessionAncd);

    const result = await request.query(`
      SELECT
        [ANCD],
        [PGSEQ],
        [PGNM],
        [PGOJ],
        [PGJB],
        [PGDES],
        [PG_GU],
        [DEL],
        [INDT],
        [ETC],
        [INEMPNO],
        [INEMPNM],
        [SCH_FDATE],
        [SCH_TDATE],
        [ACT_CYCLE],
        [ACT_NUM],
        [PGMAN1],
        [PGMAN2],
        [PGADD],
        [PGMAN0],
        [CPY_FLAG],
        [CYP_CNTR_ANCD],
        [CYP_CNTR_PGSEQ]
      FROM ${TABLE}
      WHERE [ANCD] = @sessionAncd
      ORDER BY [PGSEQ] ASC, [PGNM] ASC
    `);

    return jsonOk({
        success: true,
        data: result.recordset || [],
        count: result.recordset ? result.recordset.length : 0,
        copyInfo,
      });
  } catch (err) {
    console.error('F14040 조회 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

function truncStr(v, max) {
  if (v == null) return null;
  const s = String(v);
  return s.length <= max ? s : s.slice(0, max);
}


function parseSchedule(scheduleText) {
  const t = String(scheduleText || '').trim();
  if (!t) return { start: null, end: null };
  const parts = t.split(/[~∼～]/).map((x) => x.trim()).filter(Boolean);
  const start = normalizeYmd(parts[0] || '');
  const end = parts.length >= 2 ? normalizeYmd(parts[1] || '') : null;
  return { start, end };
}

// POST body: { action: 'save' | 'delete' | 'create', pgseq?, ...필드 }
export async function POST(req) {
  try {
    const gate = assertAnCdMatchesSession(req, null);
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const action =
      body.action === 'delete'
        ? 'delete'
        : body.action === 'create'
          ? 'create'
          : body.action === 'copy'
            ? 'copy'
            : 'save';

    const pool = await connPool;
    if (!pool) {
      return jsonError({ success: false, error: '데이터베이스 연결 실패' });
    }

    if (action === 'copy') {
      const copyInfo = await getCopyInfo(pool, gate.sessionAncd);
      if (!copyInfo.canCopy || copyInfo.sourceAncd == null) {
        return jsonError({
          success: false,
          error: '복사할 관리자(원본) 기관이 설정되어 있지 않습니다.',
        }, 400);
      }

      const rawSeqs = Array.isArray(body.pgseqs)
        ? body.pgseqs
        : body.pgseq != null
          ? [body.pgseq]
          : [];
      const pgseqs = [
        ...new Set(
          rawSeqs
            .map((v) => parseInt(String(v), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ].slice(0, 200);
      if (!pgseqs.length) {
        return jsonError({ success: false, error: '복사할 프로그램을 선택해 주세요.' }, 400);
      }

      const copiedReq = pool.request();
      copiedReq.input('ANCD', gate.sessionAncd);
      copiedReq.input('SRC', copyInfo.sourceAncd);
      const copiedResult = await copiedReq.query(`
        SELECT [CYP_CNTR_PGSEQ]
        FROM ${TABLE}
        WHERE [ANCD] = @ANCD
          AND [CYP_CNTR_ANCD] = @SRC
          AND [CYP_CNTR_PGSEQ] IS NOT NULL
      `);
      const alreadyCopied = new Set(
        (copiedResult.recordset || [])
          .map((r) => Number(r.CYP_CNTR_PGSEQ))
          .filter((n) => Number.isFinite(n))
      );

      const seqReq = pool.request();
      seqReq.input('ANCD', gate.sessionAncd);
      const seqResult = await seqReq.query(
        `SELECT ISNULL(MAX([PGSEQ]), 0) AS mx FROM ${TABLE} WHERE [ANCD] = @ANCD`
      );
      let nextPgseq = Number(seqResult.recordset?.[0]?.mx);
      if (!Number.isFinite(nextPgseq)) nextPgseq = 0;

      let copied = 0;
      let skipped = 0;
      const created = [];

      for (const srcSeq of pgseqs) {
        if (alreadyCopied.has(srcSeq)) {
          skipped += 1;
          continue;
        }

        const exist = await pool
          .request()
          .input('SRC', copyInfo.sourceAncd)
          .input('PGSEQ', srcSeq)
          .query(`
            SELECT TOP 1 [PGSEQ], [DEL]
            FROM ${TABLE}
            WHERE [ANCD] = @SRC AND [PGSEQ] = @PGSEQ
          `);
        const srcRow = exist.recordset?.[0];
        if (!srcRow || !isActivePlanDel(srcRow.DEL)) {
          skipped += 1;
          continue;
        }

        nextPgseq += 1;
        const ins = pool.request();
        ins.input('ANCD', gate.sessionAncd);
        ins.input('NEWSEQ', nextPgseq);
        ins.input('SRC', copyInfo.sourceAncd);
        ins.input('SRCPG', srcSeq);
        await ins.query(`
          INSERT INTO ${TABLE} (
            [ANCD], [PGSEQ], [PGNM], [PGOJ], [PGJB], [PGDES], [PG_GU], [DEL],
            [SCH_FDATE], [SCH_TDATE], [ACT_CYCLE], [ACT_NUM],
            [PGMAN1], [PGMAN2], [PGADD], [PGMAN0],
            [INDT], [CPY_FLAG], [CYP_CNTR_ANCD], [CYP_CNTR_PGSEQ]
          )
          SELECT
            @ANCD, @NEWSEQ, [PGNM], [PGOJ], [PGJB], [PGDES], [PG_GU], 'I',
            [SCH_FDATE], [SCH_TDATE], [ACT_CYCLE], [ACT_NUM],
            [PGMAN1], [PGMAN2], [PGADD], [PGMAN0],
            GETDATE(), 'Y', [ANCD], [PGSEQ]
          FROM ${TABLE}
          WHERE [ANCD] = @SRC AND [PGSEQ] = @SRCPG
        `);
        alreadyCopied.add(srcSeq);
        copied += 1;
        created.push(nextPgseq);
      }

      if (!copied) {
        return jsonOk({
          success: true,
          copied: 0,
          skipped,
          message: skipped
            ? '선택한 프로그램은 이미 복사되었거나 원본에서 찾을 수 없습니다.'
            : '복사된 프로그램이 없습니다.',
        });
      }

      return jsonOk({
        success: true,
        copied,
        skipped,
        pgseqs: created,
        ancd: gate.sessionAncd,
      });
    }

    if (action === 'create') {
      const copyInfo = await getCopyInfo(pool, gate.sessionAncd);
      if (copyInfo.canCopy) {
        return jsonError({
          success: false,
          error: '센터에서는 프로그램 계획서를 새로 추가할 수 없습니다. 관리자 계획서를 복사해 주세요.',
        }, 403);
      }

      const name = truncStr(body.PGNM ?? '', 100);
      if (!name || String(name).trim() === '') {
        return jsonError({ success: false, error: '프로그램 명을 입력해 주세요.' }, 400);
      }

      const seqReq = pool.request();
      seqReq.input('ANCD', gate.sessionAncd);
      const seqResult = await seqReq.query(
        `SELECT ISNULL(MAX([PGSEQ]), 0) + 1 AS nx FROM ${TABLE} WHERE [ANCD] = @ANCD`
      );
      const nextPgseq = seqResult.recordset?.[0]?.nx;
      if (nextPgseq == null || !Number.isFinite(Number(nextPgseq))) {
        return jsonError({ success: false, error: '일련번호를 생성할 수 없습니다.' });
      }

      const { start: schF, end: schT } = parseSchedule(body.programSchedule);
      const exec = String(body.executionCycle || '').trim();
      const actCycle = exec === '월' || exec === 'M' || exec === 'm' ? 'M' : 'W';
      const freqRaw = String(body.ACT_NUM ?? body.frequency ?? '').trim();
      const parsedActNum = freqRaw === '' ? NaN : parseInt(freqRaw, 10);
      const actNumValue = Number.isFinite(parsedActNum) ? parsedActNum : null;
      const guRaw = String(body.PG_GU ?? '').trim();
      const pgGu = guRaw.length ? truncStr(guRaw.charAt(0), 1) : null;

      const ins = pool.request();
      ins.input('ANCD', gate.sessionAncd);
      ins.input('PGSEQ', Number(nextPgseq));
      ins.input('PGNM', name);
      ins.input('PGOJ', truncStr(body.PGOJ ?? '', 500));
      ins.input('PGJB', truncStr(body.PGJB ?? '', 200));
      ins.input('PGDES', truncStr(body.PGDES ?? '', 1000));
      ins.input('PG_GU', pgGu);
      ins.input('PGMAN0', truncStr(body.PGMAN0 ?? '', 2000));
      ins.input('PGADD', truncStr(body.PGADD ?? '', 100));
      ins.input('PGMAN1', truncStr(body.PGMAN1 ?? '', 20));
      ins.input('PGMAN2', truncStr(body.PGMAN2 ?? '', 20));
      ins.input('ACT_CYCLE', actCycle);
      ins.input('SCH_FDATE', schF);
      ins.input('SCH_TDATE', schT);
      ins.input('ACT_NUM2', actNumValue);

      await ins.query(`
        INSERT INTO ${TABLE} (
          [ANCD], [PGSEQ], [PGNM], [PGOJ], [PGJB], [PGDES], [PG_GU], [DEL],
          [SCH_FDATE], [SCH_TDATE], [ACT_CYCLE], [ACT_NUM],
          [PGMAN1], [PGMAN2], [PGADD], [PGMAN0],
          [INDT], [CPY_FLAG]
        )
        VALUES (
          @ANCD, @PGSEQ, @PGNM, @PGOJ, @PGJB, @PGDES, @PG_GU, 'I',
          @SCH_FDATE, @SCH_TDATE, @ACT_CYCLE, @ACT_NUM2,
          @PGMAN1, @PGMAN2, @PGADD, @PGMAN0,
          GETDATE(), 'N'
        )
      `);

      return jsonOk({
          success: true,
          pgseq: Number(nextPgseq),
          ancd: gate.sessionAncd,
        });
    }

    const pgseq = parseInt(String(body.pgseq ?? ''), 10);
    if (!Number.isFinite(pgseq)) {
      return jsonError({ success: false, error: 'pgseq가 필요합니다.' }, 400);
    }

    const request = pool.request();
    request.input('ANCD', gate.sessionAncd);
    request.input('PGSEQ', pgseq);

    if (action === 'delete') {
      const r = await request.query(`
        UPDATE ${TABLE}
        SET [DEL] = 'D'
        WHERE [ANCD] = @ANCD AND [PGSEQ] = @PGSEQ
      `);
      if (r.rowsAffected[0] === 0) {
        return jsonError({ success: false, error: '대상 행을 찾을 수 없습니다.' }, 404);
      }
      return jsonOk({ success: true });
    }

    const { start: schF, end: schT } = parseSchedule(body.programSchedule);
    const exec = String(body.executionCycle || '').trim();
    const actCycle = exec === '월' || exec === 'M' || exec === 'm' ? 'M' : 'W';

    const freqRaw = String(body.ACT_NUM ?? body.frequency ?? '').trim();
    const parsedActNum = freqRaw === '' ? NaN : parseInt(freqRaw, 10);
    const actNumValue = Number.isFinite(parsedActNum) ? parsedActNum : null;

    const guRaw = String(body.PG_GU ?? '').trim();
    const pgGu = guRaw.length ? truncStr(guRaw.charAt(0), 1) : null;

    request.input('PGNM', truncStr(body.PGNM ?? '', 100));
    request.input('PGOJ', truncStr(body.PGOJ ?? '', 500));
    request.input('PGJB', truncStr(body.PGJB ?? '', 200));
    request.input('PGDES', truncStr(body.PGDES ?? '', 1000));
    request.input('PG_GU', pgGu);
    request.input('PGMAN0', truncStr(body.PGMAN0 ?? '', 2000));
    request.input('PGADD', truncStr(body.PGADD ?? '', 100));
    request.input('PGMAN1', truncStr(body.PGMAN1 ?? '', 20));
    request.input('PGMAN2', truncStr(body.PGMAN2 ?? '', 20));
    request.input('ACT_CYCLE', actCycle);
    request.input('SCH_FDATE', schF);
    request.input('SCH_TDATE', schT);
    request.input('ACT_NUM2', actNumValue);

    const upd = await request.query(`
      UPDATE ${TABLE}
      SET
        [PGNM] = @PGNM,
        [PGOJ] = @PGOJ,
        [PGJB] = @PGJB,
        [PGDES] = @PGDES,
        [PG_GU] = @PG_GU,
        [PGMAN0] = @PGMAN0,
        [PGADD] = @PGADD,
        [PGMAN1] = @PGMAN1,
        [PGMAN2] = @PGMAN2,
        [ACT_CYCLE] = @ACT_CYCLE,
        [ACT_NUM] = @ACT_NUM2,
        [SCH_FDATE] = @SCH_FDATE,
        [SCH_TDATE] = @SCH_TDATE,
        [DEL] = 'I',
        [INDT] = GETDATE()
      WHERE [ANCD] = @ANCD AND [PGSEQ] = @PGSEQ
    `);

    if (upd.rowsAffected[0] === 0) {
      return jsonError({ success: false, error: '대상 행을 찾을 수 없습니다.' }, 404);
    }

    return jsonOk({ success: true });
  } catch (err) {
    console.error('F14040 저장 오류:', err);
    return jsonError({ success: false, error: err.message, details: err.toString() });
  }
}

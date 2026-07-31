/**
 * @file F14020(일 실적) ↔ OUTING_INFO(외출·외박 대장) 동기화
 *
 * @description
 * `/api/f14020` POST/DELETE 시 호출되어 외출·외박 대장을 upsert/해제합니다.
 * UI의 IO_TM_INFO 형식(`HH:mm~HH:mm`, 외박 `HH:mm`, 복귀 `R:HH:mm`,
 * 외박중 `ON:YYYY-MM-DD|HH:mm`)과 맞춰야 합니다.
 *
 * @remarks
 * `parseIoTmInfo`가 `ON:`을 인식하지 못하면 gyn=2 저장 시
 * `removeOutingLinksForDay`로 fall-through 되어 대장이 지워질 수 있습니다.
 * UI(`DailyBeneficiaryPerformance`) 쪽 parseIoTmInfo와 형식을 동기화하세요.
 *
 * @module outingF14020Sync
 */
const sql = require('mssql');

/** @type {string} 외출·외박 대장 테이블 */
const OUTING_TABLE = '[돌봄시설DB].[dbo].[OUTING_INFO]';
/** @type {string} 일 수급자급여실적 테이블 */
const F14020_TABLE = '[돌봄시설DB].[dbo].[F14020]';

/** 테이블 보장 쿼리 중복 실행 방지 */
let ensureTablePromise = null;

async function ensureOutingInfoTable(pool) {
	if (!pool) return;
	if (!ensureTablePromise) {
		ensureTablePromise = pool
			.request()
			.query(
				`
      -- 기존 OUTING_PROCESS → OUTING_INFO (해당 DB 컨텍스트에서 sp_rename)
      EXEC [돌봄시설DB].sys.sp_executesql N'
        IF OBJECT_ID(N''dbo.OUTING_PROCESS'', N''U'') IS NOT NULL
           AND OBJECT_ID(N''dbo.OUTING_INFO'', N''U'') IS NULL
        BEGIN
          EXEC sp_rename N''dbo.OUTING_PROCESS'', N''OUTING_INFO'';
          IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = N''PK_OUTING_PROCESS''
              AND object_id = OBJECT_ID(N''dbo.OUTING_INFO'')
          )
            EXEC sp_rename N''dbo.OUTING_INFO.PK_OUTING_PROCESS'', N''PK_OUTING_INFO'', N''INDEX'';
          IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = N''IX_OUTING_PROCESS_ANCD_START''
              AND object_id = OBJECT_ID(N''dbo.OUTING_INFO'')
          )
            EXEC sp_rename N''dbo.OUTING_INFO.IX_OUTING_PROCESS_ANCD_START'', N''IX_OUTING_INFO_ANCD_START'', N''INDEX'';
          IF EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = N''IX_OUTING_PROCESS_ANCD_PNUM''
              AND object_id = OBJECT_ID(N''dbo.OUTING_INFO'')
          )
            EXEC sp_rename N''dbo.OUTING_INFO.IX_OUTING_PROCESS_ANCD_PNUM'', N''IX_OUTING_INFO_ANCD_PNUM'', N''INDEX'';
        END
      ';

      IF NOT EXISTS (
        SELECT 1
        FROM [돌봄시설DB].sys.tables t
        INNER JOIN [돌봄시설DB].sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = N'dbo' AND t.name = N'OUTING_INFO'
      )
      BEGIN
        CREATE TABLE ${OUTING_TABLE} (
          [OP_SEQ]     INT IDENTITY(1,1) NOT NULL,
          [ANCD]       INT NOT NULL,
          [PNUM]       INT NOT NULL,
          [GYN]        CHAR(1) NOT NULL,
          [START_DT]   DATE NOT NULL,
          [START_TM]   VARCHAR(5) NOT NULL,
          [END_DT]     DATE NULL,
          [END_TM]     VARCHAR(5) NULL,
          [DEST]       NVARCHAR(200) NULL,
          [PURPOSE]    NVARCHAR(200) NULL,
          [GUARDIAN]   NVARCHAR(100) NULL,
          [RELATION]   NVARCHAR(50) NULL,
          [CONTACT]    NVARCHAR(50) NULL,
          [REG_DATE]   DATETIME NULL,
          [MOD_DATE]   DATETIME NULL,
          CONSTRAINT [PK_OUTING_INFO] PRIMARY KEY CLUSTERED ([OP_SEQ])
        );
        CREATE NONCLUSTERED INDEX [IX_OUTING_INFO_ANCD_START]
          ON ${OUTING_TABLE} ([ANCD], [START_DT], [END_DT]);
        CREATE NONCLUSTERED INDEX [IX_OUTING_INFO_ANCD_PNUM]
          ON ${OUTING_TABLE} ([ANCD], [PNUM], [START_DT]);
      END
    `
			)
			.catch((err) => {
				ensureTablePromise = null;
				throw err;
			});
	}
	await ensureTablePromise;
}

function toYmd(raw) {
	if (raw == null || raw === '') return '';
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		const y = raw.getFullYear();
		const m = String(raw.getMonth() + 1).padStart(2, '0');
		const d = String(raw.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(raw).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	const digits = s.replace(/\D/g, '');
	if (digits.length >= 8) {
		return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
	}
	return '';
}

function padTime5(t) {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
	if (!m) return '';
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return '';
	return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function parseMinutes(t) {
	const p = padTime5(t);
	if (!p) return null;
	const [h, m] = p.split(':').map(Number);
	return h * 60 + m;
}

/**
 * IO_TM_INFO를 sync용 kind로 파싱합니다.
 *
 * @param {string|null|undefined} info
 * @returns {{ kind: 'return'|'range'|'single'|'empty', start: string, end: string, returnTime: string }}
 *
 * @remarks
 * UI와 달리 `ON:날짜|시각`(외박중)을 아직 처리하지 않습니다.
 * ON: 값이 오면 kind=`empty`가 되어 대장 링크 삭제 경로로 갈 수 있습니다.
 */
function parseIoTmInfo(info) {
	const s = String(info || '').trim();
	const ret = /^R[:：]?\s*(\d{1,2}:\d{2})$/i.exec(s) || /^복귀\s*[:：]?\s*(\d{1,2}:\d{2})$/.exec(s);
	if (ret) return { kind: 'return', returnTime: padTime5(ret[1]), start: '', end: '' };
	const range = /^(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})$/.exec(s);
	if (range) return { kind: 'range', start: padTime5(range[1]), end: padTime5(range[2]), returnTime: '' };
	const single = /^(\d{1,2}:\d{2})\s*[~\-–]?\s*$/.exec(s);
	if (single) return { kind: 'single', start: padTime5(single[1]), end: '', returnTime: '' };
	return { kind: 'empty', start: '', end: '', returnTime: '' };
}

function buildIoTmInfo(gyn, startTm, endTm) {
	const a = padTime5(startTm);
	const b = padTime5(endTm);
	if (gyn === '0') {
		if (!a || !b) return '';
		return `${a}~${b}`;
	}
	if (gyn === '2') return a || '';
	return '';
}

function buildReturnIoTmInfo(endTm) {
	const b = padTime5(endTm);
	return b ? `R:${b}` : '';
}

/** 외출: 시간 무관 100% */
function calcOutingPayComGu(_startTm, _endTm) {
	return '0';
}

/** 외박 출발/외박중: 시간 무관 50% */
function calcOvernightLeavePayComGu(_startTm) {
	return '1';
}

/** 외박 복귀일: 시간 무관 100% */
function calcReturnPayComGu(_endTm) {
	return '0';
}

function addDaysYmd(ymd, days) {
	const d = new Date(`${ymd}T00:00:00`);
	if (Number.isNaN(d.getTime())) return '';
	d.setDate(d.getDate() + days);
	return toYmd(d);
}

/** start~end 포함 일자 목록 (최대 370일) */
function listYmdRange(startYmd, endYmd) {
	const start = toYmd(startYmd);
	const end = toYmd(endYmd) || start;
	if (!start) return [];
	const out = [];
	let cur = start;
	for (let i = 0; i < 370; i++) {
		out.push(cur);
		if (cur >= end) break;
		cur = addDaysYmd(cur, 1);
		if (!cur) break;
	}
	return out;
}

function buildOvernightOngoingIoTmInfo(leaveDate, leaveTime) {
	const d = toYmd(leaveDate);
	const t = padTime5(leaveTime);
	// 날짜 정규화 실패 시 깨진 ON: 문자열을 만들지 않고 시각만 저장
	if (!d || !t) return t || '';
	return `ON:${d}|${t}`;
}

function nowStr() {
	return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** F14020 의 외출/외박 관련 필드만 갱신 (식사 등 다른 값은 유지) */
async function upsertF14020OutingFlags(pool, ancd, pnum, svdt, { gyn, ioTmInfo, payComGu }) {
	const request = pool.request();
	request.input('ANCD', sql.Int, Number(ancd));
	request.input('PNUM', sql.Int, Number(pnum));
	request.input('SVDT', sql.Date, svdt);
	request.input('INDT', sql.NVarChar(30), nowStr());
	request.input('GYN', sql.Char(1), String(gyn));
	request.input('IO_TM_INFO', sql.NVarChar(200), ioTmInfo == null ? '' : String(ioTmInfo));
	request.input('PAY_COM_GU', sql.Char(1), String(payComGu || '0'));

	await request.query(`
    MERGE ${F14020_TABLE} AS T
    USING (SELECT @ANCD AS ANCD, @PNUM AS PNUM, @SVDT AS SVDT) AS S
      ON (T.[ANCD] = S.[ANCD] AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.[PNUM] AS VARCHAR) AND T.[SVDT] = S.[SVDT])
    WHEN MATCHED THEN
      UPDATE SET
        [INDT] = @INDT,
        [GYN] = @GYN,
        [IO_TM_INFO] = @IO_TM_INFO,
        [PAY_COM_GU] = @PAY_COM_GU
    WHEN NOT MATCHED THEN
      INSERT ([ANCD],[PNUM],[SVDT],[INDT],[GYN],[IO_TM_INFO],[PAY_COM_GU],[MOST],[LCST],[DNST],[MGST],[AGST],[ST_PLAC],[ST_KIND])
      VALUES (@ANCD,@PNUM,@SVDT,@INDT,@GYN,@IO_TM_INFO,@PAY_COM_GU,'1','1','1','1','1',N'식장','1');
  `);
}

/** 외출/외박 해제: GYN=1(입원), IO_TM_INFO 공란 */
async function clearF14020OutingFlags(pool, ancd, pnum, svdt) {
	if (!svdt) return;
	const request = pool.request();
	request.input('ANCD', sql.Int, Number(ancd));
	request.input('PNUM', sql.Int, Number(pnum));
	request.input('SVDT', sql.Date, svdt);
	request.input('INDT', sql.NVarChar(30), nowStr());
	await request.query(`
    UPDATE ${F14020_TABLE}
    SET [INDT]=@INDT, [GYN]='1', [IO_TM_INFO]='', [PAY_COM_GU]='0'
    WHERE [ANCD]=@ANCD
      AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
      AND [SVDT]=@SVDT
  `);
}

/**
 * OUTING_INFO → F14020
 * prevRow가 있으면 날짜가 바뀐 구 일자 플래그를 먼저 해제
 */
async function syncF14020FromOutingRow(pool, ancd, row, prevRow = null) {
	const gyn = String(row.GYN || '').trim();
	const pnum = Number(row.PNUM);
	const startDt = toYmd(row.START_DT);
	const endDt = toYmd(row.END_DT);
	const startTm = padTime5(row.START_TM);
	const endTm = padTime5(row.END_TM);

	if (!Number.isFinite(pnum) || !startDt || !startTm) {
		throw new Error('F14020 동기화에 필요한 PNUM/시작일/시작시간이 없습니다');
	}

	const keep = new Set();

	if (gyn === '0') {
		const day = endDt || startDt;
		keep.add(day);
		await upsertF14020OutingFlags(pool, ancd, pnum, day, {
			gyn: '0',
			ioTmInfo: buildIoTmInfo('0', startTm, endTm),
			payComGu: calcOutingPayComGu(startTm, endTm)
		});
	} else if (gyn === '2') {
		if (endDt && endTm) {
			if (startDt === endDt) {
				// 당일 복귀: 100%
				keep.add(endDt);
				await upsertF14020OutingFlags(pool, ancd, pnum, endDt, {
					gyn: '1',
					ioTmInfo: buildReturnIoTmInfo(endTm),
					payComGu: calcReturnPayComGu(endTm)
				});
			} else {
				// 출발일~복귀 전날: 각 50%, 복귀일: 100%
				const overnightLast = addDaysYmd(endDt, -1);
				const overnightDays = listYmdRange(startDt, overnightLast);
				for (const d of overnightDays) {
					keep.add(d);
					const ioTmInfo =
						d === startDt
							? buildIoTmInfo('2', startTm, '')
							: buildOvernightOngoingIoTmInfo(startDt, startTm);
					await upsertF14020OutingFlags(pool, ancd, pnum, d, {
						gyn: '2',
						ioTmInfo,
						payComGu: calcOvernightLeavePayComGu(startTm)
					});
				}
				keep.add(endDt);
				await upsertF14020OutingFlags(pool, ancd, pnum, endDt, {
					gyn: '1',
					ioTmInfo: buildReturnIoTmInfo(endTm),
					payComGu: calcReturnPayComGu(endTm)
				});
			}
		} else {
			keep.add(startDt);
			await upsertF14020OutingFlags(pool, ancd, pnum, startDt, {
				gyn: '2',
				ioTmInfo: buildIoTmInfo('2', startTm, ''),
				payComGu: calcOvernightLeavePayComGu(startTm)
			});
		}
	}

	if (prevRow) {
		const prevStart = toYmd(prevRow.START_DT);
		const prevEnd = toYmd(prevRow.END_DT) || prevStart;
		const prevGyn = String(prevRow.GYN || '').trim();
		const prevDays =
			prevGyn === '0'
				? [prevEnd || prevStart].filter(Boolean)
				: listYmdRange(prevStart, prevEnd);
		for (const d of prevDays) {
			if (d && !keep.has(d)) {
				await clearF14020OutingFlags(pool, ancd, Number(prevRow.PNUM) || pnum, d);
			}
		}
	}
}

/** OUTING_INFO 삭제 시 연결된 F14020 플래그 해제 */
async function clearF14020ForOutingRow(pool, ancd, row) {
	const pnum = Number(row.PNUM);
	const startDt = toYmd(row.START_DT);
	const endDt = toYmd(row.END_DT);
	const gyn = String(row.GYN || '').trim();
	if (!Number.isFinite(pnum)) return;

	if (gyn === '0') {
		await clearF14020OutingFlags(pool, ancd, pnum, endDt || startDt);
		return;
	}
	if (gyn === '2') {
		const days = listYmdRange(startDt, endDt || startDt);
		for (const d of days) {
			if (d) await clearF14020OutingFlags(pool, ancd, pnum, d);
		}
	}
}

async function upsertOutingInfo(pool, ancd, row, options = {}) {
	const preserveEndIfExists = options.preserveEndIfExists === true;
	const request = pool.request();
	request.input('ANCD', sql.Int, Number(ancd));
	request.input('PNUM', sql.Int, Number(row.PNUM));
	request.input('GYN', sql.Char(1), String(row.GYN));
	request.input('START_DT', sql.Date, row.START_DT);
	request.input('START_TM', sql.VarChar(5), row.START_TM);
	request.input('END_DT', sql.Date, row.END_DT || null);
	request.input('END_TM', sql.VarChar(5), row.END_TM || null);
	request.input('MOD_DATE', sql.NVarChar(30), nowStr());
	request.input('REG_DATE', sql.NVarChar(30), nowStr());

	if (preserveEndIfExists) {
		const result = await request.query(`
      DECLARE @seq INT;
      SELECT TOP 1 @seq = [OP_SEQ]
      FROM ${OUTING_TABLE}
      WHERE [ANCD]=@ANCD
        AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
        AND [GYN]=@GYN
        AND [START_DT]=@START_DT
      ORDER BY [OP_SEQ] DESC;

      IF @seq IS NOT NULL
      BEGIN
        UPDATE ${OUTING_TABLE}
        SET [START_TM]=@START_TM, [MOD_DATE]=@MOD_DATE
        WHERE [OP_SEQ]=@seq;
        SELECT @seq AS OP_SEQ;
      END
      ELSE
      BEGIN
        INSERT INTO ${OUTING_TABLE}
          ([ANCD],[PNUM],[GYN],[START_DT],[START_TM],[END_DT],[END_TM],[REG_DATE])
        OUTPUT INSERTED.[OP_SEQ]
        VALUES (@ANCD,@PNUM,@GYN,@START_DT,@START_TM,NULL,NULL,@REG_DATE);
      END
    `);
		return result.recordset?.[0]?.OP_SEQ ?? null;
	}

	const result = await request.query(`
    DECLARE @seq INT;
    SELECT TOP 1 @seq = [OP_SEQ]
    FROM ${OUTING_TABLE}
    WHERE [ANCD]=@ANCD
      AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
      AND [GYN]=@GYN
      AND [START_DT]=@START_DT
    ORDER BY [OP_SEQ] DESC;

    IF @seq IS NOT NULL
    BEGIN
      UPDATE ${OUTING_TABLE}
      SET [START_TM]=@START_TM,
          [END_DT]=@END_DT,
          [END_TM]=@END_TM,
          [MOD_DATE]=@MOD_DATE
      WHERE [OP_SEQ]=@seq;
      SELECT @seq AS OP_SEQ;
    END
    ELSE
    BEGIN
      INSERT INTO ${OUTING_TABLE}
        ([ANCD],[PNUM],[GYN],[START_DT],[START_TM],[END_DT],[END_TM],[REG_DATE])
      OUTPUT INSERTED.[OP_SEQ]
      VALUES (@ANCD,@PNUM,@GYN,@START_DT,@START_TM,@END_DT,@END_TM,@REG_DATE);
    END
  `);
	return result.recordset?.[0]?.OP_SEQ ?? null;
}

async function removeOutingLinksForDay(pool, ancd, pnum, svdt) {
	const request = pool.request();
	request.input('ANCD', sql.Int, Number(ancd));
	request.input('PNUM', sql.Int, Number(pnum));
	request.input('SVDT', sql.Date, svdt);
	request.input('MOD_DATE', sql.NVarChar(30), nowStr());

	// 1) 당일 외출 대장 삭제
	await request.query(`
    DELETE FROM ${OUTING_TABLE}
    WHERE [ANCD]=@ANCD
      AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
      AND [GYN]='0'
      AND [START_DT]=@SVDT
  `);

	// 2) 당일 시작 외박 대장 삭제
	await request.query(`
    DELETE FROM ${OUTING_TABLE}
    WHERE [ANCD]=@ANCD
      AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
      AND [GYN]='2'
      AND [START_DT]=@SVDT
  `);

	// 3) 당일 복귀로 잡혀 있던 외박 → 복귀 해제
	await request.query(`
    UPDATE ${OUTING_TABLE}
    SET [END_DT]=NULL, [END_TM]=NULL, [MOD_DATE]=@MOD_DATE
    WHERE [ANCD]=@ANCD
      AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
      AND [GYN]='2'
      AND [END_DT]=@SVDT
  `);
}

/**
 * F14020 한 행 기준으로 OUTING_INFO를 등록·수정하거나, 해당 없으면 당일 링크를 해제합니다.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {number|string} ancd - 기관코드
 * @param {{ pnum: number|string, svdt: string, gyn: string, ioTmInfo: string }} row
 * @returns {Promise<void|number|null>}
 *
 * 분기: 외출 range → upsert / 외박 start → upsert(preserveEnd) / 복귀 R: → END_DT 갱신 /
 * 그 외 → {@link removeOutingLinksForDay}
 */
async function syncOutingFromF14020Row(pool, ancd, { pnum, svdt, gyn, ioTmInfo }) {
	await ensureOutingInfoTable(pool);
	const p = Number(pnum);
	const day = toYmd(svdt);
	if (!Number.isFinite(p) || !day) return;

	const g = String(gyn ?? '').trim();
	const parsed = parseIoTmInfo(ioTmInfo);

	// 외출
	if (g === '0' && parsed.kind === 'range' && parsed.start && parsed.end) {
		await upsertOutingInfo(pool, ancd, {
			PNUM: p,
			GYN: '0',
			START_DT: day,
			START_TM: parsed.start,
			END_DT: day,
			END_TM: parsed.end
		});
		return;
	}

	// 외박 나감
	if (g === '2' && parsed.start) {
		await upsertOutingInfo(
			pool,
			ancd,
			{
				PNUM: p,
				GYN: '2',
				START_DT: day,
				START_TM: parsed.start,
				END_DT: null,
				END_TM: null
			},
			{ preserveEndIfExists: true }
		);
		return;
	}

	// 외박 복귀 (IO_TM_INFO = R:HH:mm)
	if (parsed.kind === 'return' && parsed.returnTime) {
		const req = pool.request();
		req.input('ANCD', sql.Int, Number(ancd));
		req.input('PNUM', sql.Int, p);
		req.input('SVDT', sql.Date, day);
		req.input('END_TM', sql.VarChar(5), parsed.returnTime);
		req.input('MOD_DATE', sql.NVarChar(30), nowStr());

		const found = await req.query(`
      DECLARE @seq INT;
      -- 1) 당일을 복귀일로 이미 쓰는 건
      SELECT TOP 1 @seq = [OP_SEQ]
      FROM ${OUTING_TABLE}
      WHERE [ANCD]=@ANCD AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
        AND [GYN]='2' AND [END_DT]=@SVDT
      ORDER BY [START_DT] DESC, [OP_SEQ] DESC;

      -- 2) 미복귀 외박 (시작일 <= 당일)
      IF @seq IS NULL
      BEGIN
        SELECT TOP 1 @seq = [OP_SEQ]
        FROM ${OUTING_TABLE}
        WHERE [ANCD]=@ANCD AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
          AND [GYN]='2' AND [START_DT] <= @SVDT AND [END_DT] IS NULL
        ORDER BY [START_DT] DESC, [OP_SEQ] DESC;
      END

      IF @seq IS NOT NULL
      BEGIN
        UPDATE ${OUTING_TABLE}
        SET [END_DT]=@SVDT, [END_TM]=@END_TM, [MOD_DATE]=@MOD_DATE
        WHERE [OP_SEQ]=@seq;
        SELECT @seq AS OP_SEQ;
      END
      ELSE
      BEGIN
        -- 대장에 시작 건이 없으면 당일 시작·종료로 생성 (복귀만 있는 경우)
        INSERT INTO ${OUTING_TABLE}
          ([ANCD],[PNUM],[GYN],[START_DT],[START_TM],[END_DT],[END_TM],[REG_DATE])
        OUTPUT INSERTED.[OP_SEQ]
        VALUES (@ANCD,@PNUM,'2',@SVDT,'00:00',@SVDT,@END_TM,@MOD_DATE);
      END
    `);
		return found.recordset?.[0]?.OP_SEQ ?? null;
	}

	// 외출/외박 관련 아님 → 당일 연결 해제
	await removeOutingLinksForDay(pool, ancd, p, day);
}

/**
 * F14020 행 삭제 시 대장 정리. 삭제 전 GYN/IO를 넘겨 당일 연결을 해제합니다.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {number|string} ancd
 * @param {{ pnum: number|string, svdt: string, prevGyn?: string, prevIoTmInfo?: string }} args
 */
async function syncOutingOnF14020Delete(pool, ancd, { pnum, svdt, prevGyn, prevIoTmInfo }) {
	await ensureOutingInfoTable(pool);
	const p = Number(pnum);
	const day = toYmd(svdt);
	if (!Number.isFinite(p) || !day) return;

	const g = String(prevGyn ?? '').trim();
	const parsed = parseIoTmInfo(prevIoTmInfo);

	if (g === '0' || g === '2' || parsed.kind === 'return' || parsed.kind === 'range' || parsed.kind === 'single') {
		await removeOutingLinksForDay(pool, ancd, p, day);
	}
}

module.exports = {
	OUTING_TABLE,
	ensureOutingInfoTable,
	toYmd,
	padTime5,
	parseIoTmInfo,
	buildIoTmInfo,
	buildReturnIoTmInfo,
	syncF14020FromOutingRow,
	clearF14020ForOutingRow,
	syncOutingFromF14020Row,
	syncOutingOnF14020Delete
};
